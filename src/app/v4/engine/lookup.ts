import { Adam, Mat, Rng, Tape, randomMat, softmaxRow } from './tensor';

// Le jeu des fiches : trois faits, une question. « Léa thé · Paul café · Hugo lait · ? Paul » → café.
export const NAMES = ['Léa', 'Paul', 'Hugo', 'Nina', 'Marie', 'Tom', 'Zoé', 'Adam'] as const;
export const DRINKS = ['thé', 'café', 'lait', 'jus', 'soda', 'cacao', 'sirop', 'cidre'] as const;
export const QUERY = NAMES.length + DRINKS.length;
export const VOCAB: readonly string[] = [...NAMES, ...DRINKS, '?'];
export const FACTS = 3;
export const LENGTH = FACTS * 2 + 2;
export const LAST = LENGTH - 1;

export interface Puzzle {
  readonly ids: readonly number[];
  readonly target: number;
}

/** Un quart des couples (prénom, boisson) n'apparaît jamais pendant l'entraînement. */
export function isHeldOut(name: number, drink: number): boolean {
  return (name + drink) % 4 === 0;
}

export function makePuzzle(names: readonly number[], drinks: readonly number[], asked: number): Puzzle {
  const ids: number[] = [];
  names.forEach((name, i) => ids.push(name, NAMES.length + drinks[i]));
  ids.push(QUERY, names[asked]);
  return { ids, target: NAMES.length + drinks[asked] };
}

/** kind 'train' : aucun couple réservé. kind 'test' : la question porte sur un couple réservé. */
export function randomPuzzle(rng: Rng, kind: 'train' | 'test'): Puzzle {
  for (;;) {
    const names = rng.shuffle(NAMES.map((_, i) => i)).slice(0, FACTS);
    const drinks = rng.shuffle(DRINKS.map((_, i) => i)).slice(0, FACTS);
    const asked = rng.int(FACTS);
    const held = names.map((name, i) => isHeldOut(name, drinks[i]));
    if (kind === 'train' ? held.every((h) => !h) : held[asked]) return makePuzzle(names, drinks, asked);
  }
}

export interface Trace {
  readonly probs: Float32Array;
  /** attention[couche][position qui regarde][position regardée] */
  readonly attention: readonly number[][][];
}

interface LayerMats {
  readonly query: Mat;
  readonly key: Mat;
  readonly value: Mat;
  readonly score: Mat;
  readonly added: Mat;
}

export interface LayerView {
  readonly query: number[][];
  readonly key: number[][];
  readonly value: number[][];
  /** Ressemblance question·étiquette, déjà divisée par √largeur. */
  readonly score: number[][];
  readonly weight: number[][];
  readonly added: number[][];
}

export interface Inspection {
  readonly token: number[][];
  readonly position: number[][];
  /** État de chaque mot : à l'entrée, après la couche 1, après la couche 2. */
  readonly stream: number[][][];
  readonly layers: LayerView[];
  readonly logits: number[];
  readonly probs: number[];
}

/** Le modèle entraîné au chapitre du regard, gardé pour les chapitres suivants. */
export const trainedLookup: { model: LookupModel | null } = { model: null };

export class LookupModel {
  readonly width: number;
  readonly layers: number;
  private readonly tok: Mat;
  private readonly pos: Mat;
  private readonly wq: Mat[] = [];
  private readonly wk: Mat[] = [];
  private readonly wv: Mat[] = [];
  private readonly out: Mat;
  private readonly adam: Adam;
  private readonly rng: Rng;
  steps = 0;

  constructor(seed = 7, width = 32, layers = 2, lr = 0.004, decay = 0) {
    this.width = width;
    this.layers = layers;
    this.rng = new Rng(seed);
    const init = 1 / Math.sqrt(width);
    this.tok = randomMat(VOCAB.length, width, init, this.rng);
    this.pos = randomMat(LENGTH, width, init, this.rng);
    for (let l = 0; l < layers; l++) {
      this.wq.push(randomMat(width, width, init, this.rng));
      this.wk.push(randomMat(width, width, init, this.rng));
      this.wv.push(randomMat(width, width, init * 0.5, this.rng));
    }
    this.out = randomMat(width, VOCAB.length, init, this.rng);
    this.adam = new Adam([this.tok, this.pos, ...this.wq, ...this.wk, ...this.wv, this.out], lr, decay);
  }

  get parameterCount(): number {
    const w = this.width;
    return VOCAB.length * w * 2 + LENGTH * w + this.layers * 3 * w * w;
  }

  /** skip : numéro d'une couche à débrancher (son apport n'est pas ajouté), pour les expériences d'ablation. */
  private forward(ids: readonly number[], tape: Tape, skip: number | readonly number[] = -1): { logits: Mat; attention: Mat[]; steps: LayerMats[]; stream: Mat[]; token: Mat } {
    const token = tape.pick(this.tok, ids);
    let x = tape.add(token, this.pos);
    const attention: Mat[] = [], steps: LayerMats[] = [], stream: Mat[] = [x];
    for (let l = 0; l < this.layers; l++) {
      const query = tape.matmul(x, this.wq[l]), key = tape.matmul(x, this.wk[l]), value = tape.matmul(x, this.wv[l]);
      const score = tape.matmul(query, key, true);
      const weights = tape.softmax(score, 1 / Math.sqrt(this.width), true);
      const added = tape.matmul(weights, value);
      attention.push(weights);
      steps.push({ query, key, value, score, added });
      if (typeof skip === 'number' ? l !== skip : !skip.includes(l)) x = tape.add(x, added);
      stream.push(x);
    }
    return { logits: tape.matmul(tape.pick(x, [LAST]), this.out), attention, steps, stream, token };
  }

  /** Un pas d'entraînement réel sur des fiches tirées au hasard. Renvoie la perte moyenne. */
  trainStep(batch = 32): number {
    let total = 0;
    for (let b = 0; b < batch; b++) {
      const puzzle = randomPuzzle(this.rng, 'train');
      const tape = new Tape();
      const { logits } = this.forward(puzzle.ids, tape);
      total += tape.crossEntropy(logits, 0, puzzle.target, 1 / batch).loss;
      tape.backward();
    }
    this.adam.step();
    this.steps++;
    return total / batch;
  }

  run(puzzle: Puzzle, skip: number | readonly number[] = -1): Trace {
    const { logits, attention } = this.forward(puzzle.ids, new Tape(), skip);
    return { probs: softmaxRow(logits, 0), attention: attention.map(rowsOf) };
  }

  /** Toutes les valeurs intermédiaires du calcul, pour ouvrir le capot. */
  inspect(puzzle: Puzzle, skip: number | readonly number[] = -1): Inspection {
    const { logits, attention, steps, stream, token } = this.forward(puzzle.ids, new Tape(), skip);
    const scale = 1 / Math.sqrt(this.width);
    return {
      token: rowsOf(token),
      position: rowsOf(this.pos),
      stream: stream.map(rowsOf),
      layers: steps.map((step, l) => ({
        query: rowsOf(step.query),
        key: rowsOf(step.key),
        value: rowsOf(step.value),
        score: rowsOf(step.score).map((row) => row.map((v) => v * scale)),
        weight: rowsOf(attention[l]),
        added: rowsOf(step.added),
      })),
      logits: Array.from(logits.data),
      probs: Array.from(softmaxRow(logits, 0)),
    };
  }

  answer(puzzle: Puzzle, skip: number | readonly number[] = -1): number {
    const { probs } = this.run(puzzle, skip);
    let best = 0;
    for (let j = 1; j < probs.length; j++) if (probs[j] > probs[best]) best = j;
    return best;
  }

  accuracy(puzzles: readonly Puzzle[], skip: number | readonly number[] = -1): number {
    return puzzles.filter((p) => this.answer(p, skip) === p.target).length / puzzles.length;
  }
}

function rowsOf(m: Mat): number[][] {
  return Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols)));
}

export function fixedPuzzles(kind: 'train' | 'test', count: number, seed: number): Puzzle[] {
  const rng = new Rng(seed);
  return Array.from({ length: count }, () => randomPuzzle(rng, kind));
}
