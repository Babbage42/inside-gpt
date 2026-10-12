import { Adam, Mat, Rng, randomMat } from './tensor';

// Un neurone, puis un petit réseau : deux entrées (la position d'un point), une sortie entre 0 et 1.
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly label: 0 | 1;
}

export const sigmoid = (score: number): number => 1 / (1 + Math.exp(-score));

/** 'ligne' : deux groupes qu'une droite sépare. 'anneau' : un groupe encerclé par l'autre. */
export function points(kind: 'ligne' | 'anneau', seed = 5): Point[] {
  const rng = new Rng(seed);
  const list: Point[] = [];
  for (let i = 0; i < 36; i++) {
    const label = (i % 2) as 0 | 1;
    if (kind === 'ligne') {
      const along = rng.next() * 1.5 - 0.75, across = (0.22 + rng.next() * 0.45) * (label ? 1 : -1);
      list.push({ x: along * 0.8 - across * 0.6, y: along * 0.6 + across * 0.8, label });
    } else {
      const angle = rng.next() * Math.PI * 2, radius = label ? rng.next() * 0.3 : 0.62 + rng.next() * 0.26;
      list.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, label });
    }
  }
  return list;
}

export interface Pass {
  /** Somme pondérée de chaque neurone caché, avant le pli. */
  readonly sums: number[];
  /** Sortie de chaque neurone caché, après le pli. */
  readonly folded: number[];
  readonly score: number;
  readonly output: number;
}

/**
 * Réseau à une couche cachée. hidden = 0 donne un neurone seul.
 * fold = false retire le pli (ReLU) : les neurones cachés ne font plus que des sommes.
 */
export class TinyNet {
  readonly hidden: number;
  readonly fold: boolean;
  /** Poids des neurones cachés : une ligne (poids x, poids y) par neurone. */
  readonly w1: Mat;
  readonly b1: Mat;
  /** Poids du neurone de sortie. Pour un neurone seul : (poids x, poids y). */
  readonly w2: Mat;
  readonly b2: Mat;
  private readonly adam: Adam;
  steps = 0;

  constructor(hidden: number, fold = true, seed = 1, lr = 0.05) {
    const rng = new Rng(seed);
    this.hidden = hidden;
    this.fold = fold;
    this.w1 = randomMat(Math.max(hidden, 1), 2, 1, rng);
    this.b1 = randomMat(1, Math.max(hidden, 1), 0.3, rng);
    this.w2 = randomMat(1, hidden || 2, hidden ? 1 : 0.5, rng);
    this.b2 = new Mat(1, 1);
    this.adam = new Adam(hidden ? [this.w1, this.b1, this.w2, this.b2] : [this.w2, this.b2], lr);
  }

  get parameterCount(): number {
    return this.hidden ? this.hidden * 4 + 1 : 3;
  }

  pass(x: number, y: number): Pass {
    if (!this.hidden) {
      const score = this.w2.data[0] * x + this.w2.data[1] * y + this.b2.data[0];
      return { sums: [], folded: [], score, output: sigmoid(score) };
    }
    const sums: number[] = [], folded: number[] = [];
    let score = this.b2.data[0];
    for (let h = 0; h < this.hidden; h++) {
      const sum = this.w1.data[h * 2] * x + this.w1.data[h * 2 + 1] * y + this.b1.data[h];
      sums.push(sum);
      folded.push(this.fold ? Math.max(0, sum) : sum);
      score += this.w2.data[h] * folded[h];
    }
    return { sums, folded, score, output: sigmoid(score) };
  }

  /** Un pas de descente sur tous les points. Renvoie la surprise moyenne. */
  trainStep(data: readonly Point[]): number {
    let loss = 0;
    for (const p of data) {
      const { sums, folded, output } = this.pass(p.x, p.y);
      loss -= Math.log(Math.max(p.label ? output : 1 - output, 1e-9));
      // Pente de la surprise par rapport au score de sortie : sortie − réponse attendue.
      const blame = (output - p.label) / data.length;
      this.b2.grad[0] += blame;
      if (!this.hidden) {
        this.w2.grad[0] += blame * p.x;
        this.w2.grad[1] += blame * p.y;
        continue;
      }
      for (let h = 0; h < this.hidden; h++) {
        this.w2.grad[h] += blame * folded[h];
        // Le pli coupe la remontée quand le neurone était éteint.
        const back = this.fold && sums[h] <= 0 ? 0 : blame * this.w2.data[h];
        this.w1.grad[h * 2] += back * p.x;
        this.w1.grad[h * 2 + 1] += back * p.y;
        this.b1.grad[h] += back;
      }
    }
    this.adam.step();
    this.steps++;
    return loss / data.length;
  }

  accuracy(data: readonly Point[]): number {
    return data.filter((p) => this.pass(p.x, p.y).output > 0.5 === (p.label === 1)).length / data.length;
  }
}
