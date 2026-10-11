import { Adam, Mat, Rng, Tape, randomMat, softmaxRow } from './tensor';

// Un petit monde : des animaux, des personnes, des véhicules, et ce qu'ils font.
export type Family = 'animal' | 'personne' | 'véhicule' | 'verbe' | 'outil';

const ANIMALS = ['chat', 'chien', 'lion', 'loup', 'renard'];
const PEOPLE = ['Marie', 'Paul', 'Léa', 'Hugo', 'Nina'];
const VEHICLES = ['train', 'bus', 'tram'];
const ANIMAL_VERBS = ['dort', 'mange', 'court', 'chasse', 'grogne'];
const PEOPLE_VERBS = ['dort', 'mange', 'court', 'lit', 'écrit', 'chante', 'arrive', 'part'];
const VEHICLE_VERBS = ['roule', 'freine', 'arrive', 'part'];

interface World {
  readonly sentences: string[][];
  readonly unseen: [string, string][];
}

/**
 * Comme dans la vraie langue, on n'observe jamais toutes les phrases possibles :
 * chaque sujet n'apparaît qu'avec une partie des verbes de sa famille.
 * Les combinaisons plausibles restantes servent de test.
 */
function build(): World {
  const rng = new Rng(12);
  const sentences: string[][] = [];
  const unseen: [string, string][] = [];
  const families: [string[], string[], number, boolean][] = [
    [ANIMALS, ANIMAL_VERBS, 3, true],
    [PEOPLE, PEOPLE_VERBS, 5, false],
    [VEHICLES, VEHICLE_VERBS, 3, true],
  ];
  for (const [nouns, verbs, kept, article] of families)
    for (const noun of nouns) {
      const order = rng.shuffle([...verbs]).filter((verb) => !(noun === 'lion' && verb === 'chasse'));
      const seen = order.slice(0, kept);
      for (const verb of verbs) {
        if (seen.includes(verb)) sentences.push(article ? ['le', noun, verb, '.'] : [noun, verb, '.']);
        else unseen.push([noun, verb]);
      }
    }
  return { sentences, unseen };
}

const WORLD = build();
/** Phrases plausibles volontairement absentes du corpus, dont « le lion chasse ». */
export const UNSEEN: readonly (readonly [string, string])[] = WORLD.unseen;
/** Phrases absurdes dans ce monde : un sujet avec un verbe d'une autre famille. */
export const ABSURD: readonly (readonly [string, string])[] = [
  ...ANIMALS.flatMap((n) => ['lit', 'écrit', 'roule', 'freine'].map((v) => [n, v] as const)),
  ...VEHICLES.flatMap((n) => ['chasse', 'grogne', 'lit', 'chante'].map((v) => [n, v] as const)),
  ...PEOPLE.flatMap((n) => ['grogne', 'roule', 'freine'].map((v) => [n, v] as const)),
];
export const SENTENCES: readonly (readonly string[])[] = WORLD.sentences;
export const WORDS: readonly string[] = [...new Set(['.', 'le', ...ANIMALS, ...PEOPLE, ...VEHICLES, ...ANIMAL_VERBS, ...PEOPLE_VERBS, ...VEHICLE_VERBS])];
export const wordId = (word: string): number => WORDS.indexOf(word);

export function familyOf(word: string): Family {
  if (ANIMALS.includes(word)) return 'animal';
  if (PEOPLE.includes(word)) return 'personne';
  if (VEHICLES.includes(word)) return 'véhicule';
  if (word === 'le' || word === '.') return 'outil';
  return 'verbe';
}

/** Paires (mot, mot suivant). Le point de fin de phrase précède le début de la suivante. */
export const PAIRS: readonly (readonly [number, number])[] = SENTENCES.flatMap((s) => {
  const ids = ['.', ...s].map(wordId);
  return ids.slice(1).map((next, i) => [ids[i], next] as const);
});

/** Le modèle « par comptage » : la fréquence observée du mot suivant. */
export function countTable(): number[][] {
  const counts = WORDS.map(() => WORDS.map(() => 0));
  for (const [word, next] of PAIRS) counts[word][next]++;
  return counts;
}

export function countProbs(word: number): number[] {
  const row = countTable()[word];
  const total = row.reduce((a, b) => a + b, 0);
  return row.map((c) => (total ? c / total : 0));
}

/** Le modèle « par carte » : chaque mot est un point (x, y) ; la prédiction se lit depuis ce point. */
export class WordMap {
  readonly points: Mat;
  readonly readout: Mat;
  readonly bias: Mat;
  private readonly adam: Adam;
  steps = 0;

  constructor(seed = 4, lr = 0.05, decay = 0) {
    const rng = new Rng(seed);
    this.points = randomMat(WORDS.length, 2, 0.15, rng);
    this.readout = randomMat(2, WORDS.length, 0.15, rng);
    this.bias = new Mat(1, WORDS.length);
    this.adam = new Adam([this.points, this.readout, this.bias], lr, decay);
  }

  /** Un passage sur tout le corpus, une correction. Renvoie la perte moyenne. */
  trainStep(): number {
    const tape = new Tape();
    const logits = tape.addRow(tape.matmul(tape.pick(this.points, PAIRS.map(([w]) => w)), this.readout), this.bias);
    let loss = 0;
    PAIRS.forEach(([, next], row) => (loss += tape.crossEntropy(logits, row, next, 1 / PAIRS.length).loss));
    tape.backward();
    this.adam.step();
    this.steps++;
    return loss / PAIRS.length;
  }

  loss(): number {
    return PAIRS.reduce((sum, [word, next]) => sum - Math.log(this.probs(word)[next]), 0) / PAIRS.length;
  }

  probs(word: number): Float32Array {
    return this.probsAt(this.points.at(word, 0), this.points.at(word, 1));
  }

  /** Ce que prédirait un mot placé au point (x, y), le reste du modèle étant inchangé. */
  probsAt(x: number, y: number): Float32Array {
    const logits = new Mat(1, WORDS.length);
    for (let j = 0; j < WORDS.length; j++)
      logits.data[j] = x * this.readout.at(0, j) + y * this.readout.at(1, j) + this.bias.data[j];
    return softmaxRow(logits, 0);
  }

  /** Perte d'un mot sur ses propres exemples s'il était placé en (x, y). */
  lossAt(word: number, x: number, y: number): number {
    const probs = this.probsAt(x, y);
    const nexts = PAIRS.filter(([w]) => w === word).map(([, next]) => next);
    return nexts.reduce((sum, next) => sum - Math.log(Math.max(probs[next], 1e-30)), 0) / nexts.length;
  }

  /** Pente de lossAt : dans quelle direction la perte monte, et à quelle vitesse. */
  slopeAt(word: number, x: number, y: number): [number, number] {
    const probs = this.probsAt(x, y);
    const nexts = PAIRS.filter(([w]) => w === word).map(([, next]) => next);
    let gx = 0, gy = 0;
    for (let j = 0; j < WORDS.length; j++) {
      const observed = nexts.filter((next) => next === j).length / nexts.length;
      gx += (probs[j] - observed) * this.readout.at(0, j);
      gy += (probs[j] - observed) * this.readout.at(1, j);
    }
    return [gx, gy];
  }

  position(word: number): [number, number] {
    return [this.points.at(word, 0), this.points.at(word, 1)];
  }
}
