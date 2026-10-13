import { Adam, Mat, Rng, Tape, randomMat, softmaxRow } from './tensor';

export interface MiniConfig {
  readonly vocab: number;
  readonly context: number;
  readonly width: number;
  /** Nombre de couches « regard + neurones ». 0 : le modèle ne voit que le dernier mot. */
  readonly layers: number;
  readonly heads: number;
  /** Nombre de neurones du réseau placé après chaque regard. 0 : pas de neurones. */
  readonly hidden: number;
  /** false : le modèle ignore la place des mots dans le texte. */
  readonly positions?: boolean;
  /** false : pas de remise à l'échelle des bandes. */
  readonly norm?: boolean;
}

interface Block {
  readonly query: Mat[];
  readonly key: Mat[];
  readonly value: Mat[];
  readonly merge: Mat;
  readonly up?: Mat;
  readonly upBias?: Mat;
  readonly down?: Mat;
  readonly downBias?: Mat;
}

/** Ce qu'on débranche pour une expérience : des couches entières, ou des regards précis [couche, tête]. */
export interface Cut {
  readonly layers?: readonly number[];
  readonly heads?: readonly (readonly [number, number])[];
}

export interface HeadTrace {
  /** attention[mot qui regarde][mot regardé] */
  readonly attention: number[][];
  /** La question que pose chaque mot, et l'étiquette et le contenu qu'il offre. */
  readonly query: number[][];
  readonly key: number[][];
  readonly value: number[][];
  /** Ressemblance question·étiquette, déjà divisée par √(taille de la tête). */
  readonly score: number[][];
}

export interface LayerTrace {
  readonly heads: HeadTrace[];
  /** Ce que les regards ajoutent à la bande de chaque mot. */
  readonly looked: number[][];
  /** Somme pondérée de chaque neurone, avant le pli, puis son activité après le pli. */
  readonly sums: number[][];
  readonly neurons: number[][];
  /** Ce que les neurones ajoutent à la bande de chaque mot. */
  readonly thought: number[][];
}

export interface MiniTrace {
  /** État de chaque mot : à l'entrée, puis après chaque couche. */
  readonly stream: number[][][];
  readonly layers: LayerTrace[];
  /** Notes de chaque mot du vocabulaire pour la suite du dernier mot. */
  readonly logits: number[];
  /** Les mêmes notes si on lisait la réponse plus tôt : à l'entrée, puis après chaque couche. */
  readonly lens: number[][];
}

interface Watch {
  readonly stream: Mat[];
  readonly layers: { heads: { attention: Mat; query: Mat; key: Mat; value: Mat; score: Mat }[]; looked: Mat; sums?: Mat; neurons?: Mat; thought?: Mat }[];
}

const rowsOf = (m: Mat): number[][] => Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols)));

/**
 * Un transformer de type GPT, en miniature : embeddings de mots et de places, puis des couches
 * « regard à plusieurs têtes + réseau de neurones », chacune précédée d'une remise à l'échelle.
 * Chaque pièce peut être retirée par la configuration, pour mesurer ce qu'elle apporte.
 */
export class MiniGpt {
  readonly config: MiniConfig;
  private readonly tok: Mat;
  private readonly pos?: Mat;
  private readonly blocks: Block[] = [];
  private readonly out: Mat;
  private readonly adam: Adam;
  steps = 0;

  constructor(config: MiniConfig, seed = 1, lr = 0.0015, decay = 0.1) {
    this.config = config;
    const rng = new Rng(seed), { vocab, context, width, layers, heads, hidden } = config;
    const scale = 1 / Math.sqrt(width), head = width / heads;
    // Au départ, la bande d'un mot doit surtout parler de ce mot : embeddings amples,
    // et sorties des regards et des neurones presque nulles (sinon elles noient le mot sous du bruit).
    const quiet = 0.2;
    this.tok = randomMat(vocab, width, 0.7, rng);
    if (config.positions !== false) this.pos = randomMat(context, width, 0.7, rng);
    for (let l = 0; l < layers; l++) {
      const query = Array.from({ length: heads }, () => randomMat(width, head, scale, rng));
      const key = Array.from({ length: heads }, () => randomMat(width, head, scale, rng));
      const value = Array.from({ length: heads }, () => randomMat(width, head, scale, rng));
      const merge = randomMat(width, width, scale * quiet, rng);
      if (!hidden) {
        this.blocks.push({ query, key, value, merge });
        continue;
      }
      const up = randomMat(width, hidden, scale, rng), down = randomMat(hidden, width, (1 / Math.sqrt(hidden)) * quiet, rng);
      this.blocks.push({ query, key, value, merge, up, upBias: new Mat(1, hidden), down, downBias: new Mat(1, width) });
    }
    this.out = randomMat(width, vocab, scale, rng);
    this.adam = new Adam(this.parameters, lr, decay);
  }

  /** Tous les réglages, dans un ordre fixe : c'est aussi l'ordre du fichier de poids. */
  get parameters(): Mat[] {
    const blocks = this.blocks.flatMap((b) => [...b.query, ...b.key, ...b.value, b.merge, ...(b.up ? [b.up, b.upBias!, b.down!, b.downBias!] : [])]);
    return [this.tok, ...(this.pos ? [this.pos] : []), ...blocks, this.out];
  }

  get parameterCount(): number {
    return this.parameters.reduce((sum, m) => sum + m.data.length, 0);
  }

  embeddingTable(): number[][] {
    return rowsOf(this.tok);
  }

  /** Le nombre de multiplications d'un passage sur un texte de cette longueur. */
  multiplications(length: number): number {
    const { width, layers, heads, hidden, vocab } = this.config, head = width / heads;
    const look = heads * (3 * length * width * head + 2 * length * length * head) + length * width * width;
    return layers * (look + 2 * length * width * hidden) + length * width * vocab;
  }

  private forward(ids: readonly number[], tape: Tape, cut: Cut = {}, watch?: Watch): Mat {
    const { width, heads } = this.config, sharp = 1 / Math.sqrt(width / heads);
    const norm = (m: Mat) => (this.config.norm === false ? m : tape.layerNorm(m));
    const word = tape.pick(this.tok, ids);
    let x = this.pos ? tape.add(word, tape.pick(this.pos, ids.map((_, i) => i))) : word;
    watch?.stream.push(x);
    this.blocks.forEach((block, l) => {
      if (cut.layers?.includes(l)) {
        watch?.stream.push(x);
        watch?.layers.push({ heads: [], looked: new Mat(x.rows, width) });
        return;
      }
      const seen = norm(x), traces: Watch['layers'][number]['heads'] = [];
      const gathered = block.query.map((_, h) => {
        const query = tape.matmul(seen, block.query[h]), key = tape.matmul(seen, block.key[h]), value = tape.matmul(seen, block.value[h]);
        const score = tape.matmul(query, key, true), attention = tape.softmax(score, sharp, true);
        traces.push({ attention, query, key, value, score });
        // Un regard débranché n'apporte rien : sa part du mélange reste à zéro.
        return cut.heads?.some(([cl, ch]) => cl === l && ch === h) ? new Mat(x.rows, width / heads) : tape.matmul(attention, value);
      });
      const looked = tape.matmul(tape.join(gathered), block.merge);
      x = tape.add(x, looked);
      if (!block.up) {
        watch?.stream.push(x);
        watch?.layers.push({ heads: traces, looked });
        return;
      }
      const sums = tape.addRow(tape.matmul(norm(x), block.up), block.upBias!), neurons = tape.relu(sums);
      const thought = tape.addRow(tape.matmul(neurons, block.down!), block.downBias!);
      x = tape.add(x, thought);
      watch?.stream.push(x);
      watch?.layers.push({ heads: traces, looked, sums, neurons, thought });
    });
    return tape.matmul(norm(x), this.out);
  }

  /**
   * Surprise moyenne sur ces textes, quand on devine chaque mot à partir de ceux qui le précèdent.
   * Laisse dans chaque réglage sa pente, prête pour un pas de correction.
   */
  measure(texts: readonly (readonly number[])[]): number {
    const guesses = texts.reduce((sum, t) => sum + t.length - 1, 0);
    let loss = 0;
    for (const text of texts) {
      const tape = new Tape(), logits = this.forward(text.slice(0, -1), tape);
      for (let i = 0; i + 1 < text.length; i++) loss += tape.crossEntropy(logits, i, text[i + 1], 1 / guesses).loss;
      tape.backward();
    }
    return loss / guesses;
  }

  /** Un pas d'entraînement : mesurer, puis tourner chaque réglage un peu dans le bon sens. */
  trainStep(texts: readonly (readonly number[])[]): number {
    const loss = this.measure(texts);
    this.adam.step();
    this.steps++;
    return loss;
  }

  /** Recopie les pentes laissées par measure() dans un tableau à plat, puis les remet à zéro. */
  takeSlopes(into: Float32Array): void {
    let at = 0;
    for (const m of this.parameters) {
      into.set(m.grad, at);
      m.grad.fill(0);
      at += m.grad.length;
    }
  }

  /** Un pas de correction à partir de pentes calculées ailleurs (par plusieurs processus, par exemple). */
  stepWith(slopes: Float32Array): void {
    let at = 0;
    for (const m of this.parameters) {
      m.grad.set(slopes.subarray(at, at + m.grad.length));
      at += m.grad.length;
    }
    this.adam.step();
    this.steps++;
  }

  /** Notes du mot suivant, pour chaque mot du vocabulaire. */
  scores(ids: readonly number[], cut: Cut = {}): Float32Array {
    const logits = this.forward(ids, new Tape(), cut), v = this.config.vocab;
    return logits.data.slice((logits.rows - 1) * v, logits.rows * v);
  }

  /** Complète en prenant à chaque fois le mot le mieux noté. */
  complete(ids: readonly number[], count: number, cut: Cut = {}): number[] {
    const text = [...ids];
    for (let n = 0; n < count && text.length < this.config.context; n++) {
      const scores = this.scores(text, cut);
      let best = 0;
      for (let j = 1; j < scores.length; j++) if (scores[j] > scores[best]) best = j;
      text.push(best);
    }
    return text.slice(ids.length);
  }

  probabilities(ids: readonly number[], cut: Cut = {}): Float32Array {
    const logits = this.forward(ids, new Tape(), cut);
    return softmaxRow(logits, logits.rows - 1);
  }

  /** Toutes les valeurs intermédiaires du calcul, pour ouvrir la machine. */
  trace(ids: readonly number[], cut: Cut = {}): MiniTrace {
    const watch: Watch = { stream: [], layers: [] };
    const logits = this.forward(ids, new Tape(), cut, watch), v = this.config.vocab, last = ids.length - 1;
    // Lire la réponse plus tôt : on applique la lecture finale à la bande du dernier mot, à chaque étage.
    const lens = watch.stream.map((state) => {
      const tape = new Tape(), row = tape.pick(state, [last]);
      return Array.from(tape.matmul(this.config.norm === false ? row : tape.layerNorm(row), this.out).data);
    });
    const empty: number[][] = [];
    return {
      stream: watch.stream.map(rowsOf),
      layers: watch.layers.map((layer) => ({
        heads: layer.heads.map((h) => ({ attention: rowsOf(h.attention), query: rowsOf(h.query), key: rowsOf(h.key), value: rowsOf(h.value), score: rowsOf(h.score).map((r) => r.map((s) => s / Math.sqrt(this.config.width / this.config.heads))) })),
        looked: rowsOf(layer.looked),
        sums: layer.sums ? rowsOf(layer.sums) : empty,
        neurons: layer.neurons ? rowsOf(layer.neurons) : empty,
        thought: layer.thought ? rowsOf(layer.thought) : empty,
      })),
      logits: Array.from(logits.data.subarray(last * v, (last + 1) * v)),
      lens,
    };
  }

  /** Tous les réglages mis bout à bout. */
  snapshot(): Float32Array {
    const flat = new Float32Array(this.parameterCount);
    let at = 0;
    for (const m of this.parameters) {
      flat.set(m.data, at);
      at += m.data.length;
    }
    return flat;
  }

  load(flat: Float32Array): void {
    let at = 0;
    for (const m of this.parameters) {
      m.data.set(flat.subarray(at, at + m.data.length));
      at += m.data.length;
    }
  }
}
