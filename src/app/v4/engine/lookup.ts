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

  private forward(ids: readonly number[], tape: Tape): { logits: Mat; attention: Mat[] } {
    let x = tape.add(tape.pick(this.tok, ids), this.pos);
    const attention: Mat[] = [];
    for (let l = 0; l < this.layers; l++) {
      const scores = tape.matmul(tape.matmul(x, this.wq[l]), tape.matmul(x, this.wk[l]), true);
      const weights = tape.softmax(scores, 1 / Math.sqrt(this.width), true);
      attention.push(weights);
      x = tape.add(x, tape.matmul(weights, tape.matmul(x, this.wv[l])));
    }
    return { logits: tape.matmul(tape.pick(x, [LAST]), this.out), attention };
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

  run(puzzle: Puzzle): Trace {
    const { logits, attention } = this.forward(puzzle.ids, new Tape());
    const probs = softmaxRow(logits, 0);
    return {
      probs,
      attention: attention.map((m) =>
        Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols))),
      ),
    };
  }

  answer(puzzle: Puzzle): number {
    const { probs } = this.run(puzzle);
    let best = 0;
    for (let j = 1; j < probs.length; j++) if (probs[j] > probs[best]) best = j;
    return best;
  }

  accuracy(puzzles: readonly Puzzle[]): number {
    return puzzles.filter((p) => this.answer(p) === p.target).length / puzzles.length;
  }
}

export function fixedPuzzles(kind: 'train' | 'test', count: number, seed: number): Puzzle[] {
  const rng = new Rng(seed);
  return Array.from({ length: count }, () => randomPuzzle(rng, kind));
}
