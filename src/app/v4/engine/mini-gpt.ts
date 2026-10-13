import { Adam, Mat, Rng, Tape, randomMat, softmaxRow } from './tensor';

export interface MiniConfig {
  readonly vocab: number;
  readonly context: number;
  readonly width: number;
  readonly layers: number;
  readonly heads: number;
  /** Nombre de neurones du réseau placé après chaque regard. */
  readonly hidden: number;
}

interface Block {
  readonly query: Mat[];
  readonly key: Mat[];
  readonly value: Mat[];
  readonly merge: Mat;
  readonly up: Mat;
  readonly upBias: Mat;
  readonly down: Mat;
  readonly downBias: Mat;
}

export interface LayerTrace {
  /** attention[tête][mot qui regarde][mot regardé] */
  readonly attention: number[][][];
  /** Activité des neurones pour chaque mot, après le pli. */
  readonly neurons: number[][];
}

export interface MiniTrace {
  /** État de chaque mot : à l'entrée, puis après chaque couche. */
  readonly stream: number[][][];
  readonly layers: LayerTrace[];
  /** Notes de chaque mot du vocabulaire pour la suite du dernier mot. */
  readonly logits: number[];
}

const rowsOf = (m: Mat): number[][] => Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols)));

/**
 * Un transformer de type GPT, en miniature : embeddings de mots et de places, puis des couches
 * « regard à plusieurs têtes + réseau de neurones », chacune précédée d'une remise à l'échelle.
 */
export class MiniGpt {
  readonly config: MiniConfig;
  private readonly tok: Mat;
  private readonly pos: Mat;
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
    this.pos = randomMat(context, width, 0.7, rng);
    for (let l = 0; l < layers; l++)
      this.blocks.push({
        query: Array.from({ length: heads }, () => randomMat(width, head, scale, rng)),
        key: Array.from({ length: heads }, () => randomMat(width, head, scale, rng)),
        value: Array.from({ length: heads }, () => randomMat(width, head, scale, rng)),
        merge: randomMat(width, width, scale * quiet, rng),
        up: randomMat(width, hidden, scale, rng),
        upBias: new Mat(1, hidden),
        down: randomMat(hidden, width, (1 / Math.sqrt(hidden)) * quiet, rng),
        downBias: new Mat(1, width),
      });
    this.out = randomMat(width, vocab, scale, rng);
    this.adam = new Adam(this.parameters, lr, decay);
  }

  /** Tous les réglages, dans un ordre fixe : c'est aussi l'ordre du fichier de poids. */
  get parameters(): Mat[] {
    return [this.tok, this.pos, ...this.blocks.flatMap((b) => [...b.query, ...b.key, ...b.value, b.merge, b.up, b.upBias, b.down, b.downBias]), this.out];
  }

  get parameterCount(): number {
    return this.parameters.reduce((sum, m) => sum + m.data.length, 0);
  }

  embeddingTable(): number[][] {
    return rowsOf(this.tok);
  }

  /** off : numéros des couches débranchées. watch : garde les valeurs intermédiaires. */
  private forward(ids: readonly number[], tape: Tape, off: readonly number[] = [], watch?: { stream: Mat[]; layers: { attention: Mat[]; neurons: Mat }[] }): Mat {
    const { width, heads } = this.config, positions = ids.map((_, i) => i), sharp = 1 / Math.sqrt(width / heads);
    let x = tape.add(tape.pick(this.tok, ids), tape.pick(this.pos, positions));
    watch?.stream.push(x);
    this.blocks.forEach((block, l) => {
      const seen = tape.layerNorm(x), attention: Mat[] = [];
      const gathered = block.query.map((_, h) => {
        const weights = tape.softmax(tape.matmul(tape.matmul(seen, block.query[h]), tape.matmul(seen, block.key[h]), true), sharp, true);
        attention.push(weights);
        return tape.matmul(weights, tape.matmul(seen, block.value[h]));
      });
      const looked = tape.matmul(tape.join(gathered), block.merge);
      const afterLook = off.includes(l) ? x : tape.add(x, looked);
      const neurons = tape.relu(tape.addRow(tape.matmul(tape.layerNorm(afterLook), block.up), block.upBias));
      const thought = tape.addRow(tape.matmul(neurons, block.down), block.downBias);
      x = off.includes(l) ? x : tape.add(afterLook, thought);
      watch?.stream.push(x);
      watch?.layers.push({ attention, neurons });
    });
    return tape.matmul(tape.layerNorm(x), this.out);
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
  scores(ids: readonly number[], off: readonly number[] = []): Float32Array {
    const logits = this.forward(ids, new Tape(), off), v = this.config.vocab;
    return logits.data.slice((logits.rows - 1) * v, logits.rows * v);
  }

  /** Complète en prenant à chaque fois le mot le mieux noté. */
  complete(ids: readonly number[], count: number): number[] {
    const text = [...ids];
    for (let n = 0; n < count && text.length < this.config.context; n++) {
      const scores = this.scores(text);
      let best = 0;
      for (let j = 1; j < scores.length; j++) if (scores[j] > scores[best]) best = j;
      text.push(best);
    }
    return text.slice(ids.length);
  }

  probabilities(ids: readonly number[]): Float32Array {
    const logits = this.forward(ids, new Tape());
    return softmaxRow(logits, logits.rows - 1);
  }

  trace(ids: readonly number[], off: readonly number[] = []): MiniTrace {
    const watch = { stream: [] as Mat[], layers: [] as { attention: Mat[]; neurons: Mat }[] };
    const logits = this.forward(ids, new Tape(), off, watch), v = this.config.vocab;
    return {
      stream: watch.stream.map(rowsOf),
      layers: watch.layers.map((layer) => ({ attention: layer.attention.map(rowsOf), neurons: rowsOf(layer.neurons) })),
      logits: Array.from(logits.data.subarray((logits.rows - 1) * v, logits.rows * v)),
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
