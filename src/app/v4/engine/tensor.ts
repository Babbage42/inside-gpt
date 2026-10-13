// Autodifférentiation minimale sur des matrices. Tout ce que la V4 entraîne passe par ce fichier.

export class Mat {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float32Array;
  readonly grad: Float32Array;

  constructor(rows: number, cols: number, data?: Float32Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float32Array(rows * cols);
    this.grad = new Float32Array(rows * cols);
  }

  at(row: number, col: number): number {
    return this.data[row * this.cols + col];
  }
}

/** Générateur reproductible : même graine, même entraînement, à chaque visite. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  normal(): number {
    const u = Math.max(this.next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

export function randomMat(rows: number, cols: number, scale: number, rng: Rng): Mat {
  const m = new Mat(rows, cols);
  for (let i = 0; i < m.data.length; i++) m.data[i] = rng.normal() * scale;
  return m;
}

/** Enregistre les opérations du calcul pour pouvoir les remonter. */
export class Tape {
  private readonly steps: (() => void)[] = [];

  backward(): void {
    for (let i = this.steps.length - 1; i >= 0; i--) this.steps[i]();
  }

  /** Sélectionne des lignes d'une table (lookup d'embeddings). */
  pick(table: Mat, ids: readonly number[]): Mat {
    const out = new Mat(ids.length, table.cols);
    const c = table.cols;
    ids.forEach((id, r) => out.data.set(table.data.subarray(id * c, id * c + c), r * c));
    this.steps.push(() => {
      ids.forEach((id, r) => {
        for (let j = 0; j < c; j++) table.grad[id * c + j] += out.grad[r * c + j];
      });
    });
    return out;
  }

  add(a: Mat, b: Mat): Mat {
    const out = new Mat(a.rows, a.cols);
    for (let i = 0; i < out.data.length; i++) out.data[i] = a.data[i] + b.data[i];
    this.steps.push(() => {
      for (let i = 0; i < out.grad.length; i++) {
        a.grad[i] += out.grad[i];
        b.grad[i] += out.grad[i];
      }
    });
    return out;
  }

  /** Ajoute la même ligne (un biais) à chaque ligne de a. */
  addRow(a: Mat, row: Mat): Mat {
    const out = new Mat(a.rows, a.cols);
    for (let r = 0; r < a.rows; r++)
      for (let j = 0; j < a.cols; j++) out.data[r * a.cols + j] = a.data[r * a.cols + j] + row.data[j];
    this.steps.push(() => {
      for (let r = 0; r < a.rows; r++)
        for (let j = 0; j < a.cols; j++) {
          a.grad[r * a.cols + j] += out.grad[r * a.cols + j];
          row.grad[j] += out.grad[r * a.cols + j];
        }
    });
    return out;
  }

  /** a · b, ou a · bᵀ si transposeB. */
  matmul(a: Mat, b: Mat, transposeB = false): Mat {
    const n = a.rows, k = a.cols, m = transposeB ? b.rows : b.cols;
    const out = new Mat(n, m);
    const ad = a.data, bd = b.data, od = out.data;
    // Pas de l'indice dans b quand x (resp. j) avance d'un cran.
    const sx = transposeB ? 1 : b.cols, sj = transposeB ? b.cols : 1;
    for (let i = 0; i < n; i++)
      for (let x = 0; x < k; x++) {
        const av = ad[i * k + x];
        let q = x * sx;
        for (let j = 0; j < m; j++, q += sj) od[i * m + j] += av * bd[q];
      }
    this.steps.push(() => {
      const ag = a.grad, bg = b.grad, og = out.grad;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
          const g = og[i * m + j];
          if (g === 0) continue;
          let q = j * sj;
          for (let x = 0; x < k; x++, q += sx) {
            ag[i * k + x] += g * bd[q];
            bg[q] += g * ad[i * k + x];
          }
        }
    });
    return out;
  }

  /** Softmax ligne par ligne. Avec causal, la position i ne voit que les positions ≤ i. */
  softmax(a: Mat, scale = 1, causal = false): Mat {
    const out = new Mat(a.rows, a.cols);
    const c = a.cols;
    for (let r = 0; r < a.rows; r++) {
      const limit = causal ? r + 1 : c;
      let max = -Infinity;
      for (let j = 0; j < limit; j++) max = Math.max(max, a.data[r * c + j] * scale);
      let sum = 0;
      for (let j = 0; j < limit; j++) sum += out.data[r * c + j] = Math.exp(a.data[r * c + j] * scale - max);
      for (let j = 0; j < limit; j++) out.data[r * c + j] /= sum;
    }
    this.steps.push(() => {
      for (let r = 0; r < a.rows; r++) {
        const limit = causal ? r + 1 : c;
        let dot = 0;
        for (let j = 0; j < limit; j++) dot += out.grad[r * c + j] * out.data[r * c + j];
        for (let j = 0; j < limit; j++)
          a.grad[r * c + j] += scale * out.data[r * c + j] * (out.grad[r * c + j] - dot);
      }
    });
    return out;
  }

  /** Le pli : zéro pour une valeur négative, la valeur elle-même sinon (ReLU). */
  relu(a: Mat): Mat {
    const out = new Mat(a.rows, a.cols);
    for (let i = 0; i < out.data.length; i++) out.data[i] = a.data[i] > 0 ? a.data[i] : 0;
    this.steps.push(() => {
      for (let i = 0; i < out.grad.length; i++) if (a.data[i] > 0) a.grad[i] += out.grad[i];
    });
    return out;
  }

  /** Remise à l'échelle de chaque ligne : moyenne 0, écart-type 1. */
  layerNorm(a: Mat): Mat {
    const out = new Mat(a.rows, a.cols);
    const n = a.cols, spread = new Float32Array(a.rows);
    for (let r = 0; r < a.rows; r++) {
      let mean = 0;
      for (let j = 0; j < n; j++) mean += a.data[r * n + j];
      mean /= n;
      let variance = 0;
      for (let j = 0; j < n; j++) variance += (a.data[r * n + j] - mean) ** 2;
      spread[r] = Math.sqrt(variance / n + 1e-5);
      for (let j = 0; j < n; j++) out.data[r * n + j] = (a.data[r * n + j] - mean) / spread[r];
    }
    this.steps.push(() => {
      for (let r = 0; r < a.rows; r++) {
        let meanGrad = 0, meanTilt = 0;
        for (let j = 0; j < n; j++) {
          meanGrad += out.grad[r * n + j];
          meanTilt += out.grad[r * n + j] * out.data[r * n + j];
        }
        meanGrad /= n;
        meanTilt /= n;
        for (let j = 0; j < n; j++)
          a.grad[r * n + j] += (out.grad[r * n + j] - meanGrad - out.data[r * n + j] * meanTilt) / spread[r];
      }
    });
    return out;
  }

  /** Colle des matrices côte à côte (les sorties de plusieurs têtes d'attention). */
  join(parts: readonly Mat[]): Mat {
    const rows = parts[0].rows, cols = parts.reduce((sum, p) => sum + p.cols, 0);
    const out = new Mat(rows, cols);
    let offset = 0;
    const offsets = parts.map((p) => {
      const at = offset;
      for (let r = 0; r < rows; r++) out.data.set(p.data.subarray(r * p.cols, (r + 1) * p.cols), r * cols + at);
      offset += p.cols;
      return at;
    });
    this.steps.push(() => {
      parts.forEach((p, k) => {
        for (let r = 0; r < rows; r++)
          for (let j = 0; j < p.cols; j++) p.grad[r * p.cols + j] += out.grad[r * cols + offsets[k] + j];
      });
    });
    return out;
  }

  /**
   * Perte −ln P(cible) lue sur une ligne de scores. Amorce aussi le gradient :
   * appeler backward() ensuite suffit.
   */
  crossEntropy(logits: Mat, row: number, target: number, weight = 1): { loss: number; probs: Float32Array } {
    const probs = softmaxRow(logits, row);
    this.steps.push(() => {
      for (let j = 0; j < logits.cols; j++)
        logits.grad[row * logits.cols + j] += weight * (probs[j] - (j === target ? 1 : 0));
    });
    return { loss: -Math.log(Math.max(probs[target], 1e-12)), probs };
  }
}

export function softmaxRow(logits: Mat, row: number): Float32Array {
  const c = logits.cols;
  const probs = new Float32Array(c);
  let max = -Infinity;
  for (let j = 0; j < c; j++) max = Math.max(max, logits.data[row * c + j]);
  let sum = 0;
  for (let j = 0; j < c; j++) sum += probs[j] = Math.exp(logits.data[row * c + j] - max);
  for (let j = 0; j < c; j++) probs[j] /= sum;
  return probs;
}

/** Adam : descente de gradient avec un pas adapté à chaque réglage. */
export class Adam {
  private readonly params: readonly Mat[];
  private readonly lr: number;
  private readonly decay: number;
  private readonly m: Float32Array[];
  private readonly v: Float32Array[];
  private t = 0;

  constructor(params: readonly Mat[], lr: number, decay = 0) {
    this.params = params;
    this.lr = lr;
    this.decay = decay;
    this.m = params.map((p) => new Float32Array(p.data.length));
    this.v = params.map((p) => new Float32Array(p.data.length));
  }

  step(): void {
    this.t++;
    const c1 = 1 - Math.pow(0.9, this.t), c2 = 1 - Math.pow(0.999, this.t);
    this.params.forEach((p, k) => {
      const m = this.m[k], v = this.v[k];
      for (let i = 0; i < p.data.length; i++) {
        const g = p.grad[i];
        m[i] = 0.9 * m[i] + 0.1 * g;
        v[i] = 0.999 * v[i] + 0.001 * g * g;
        p.data[i] -= (this.lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8) + this.lr * this.decay * p.data[i];
        p.grad[i] = 0;
      }
    });
  }
}
