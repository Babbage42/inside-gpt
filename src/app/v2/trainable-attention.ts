import { AttentionParameters, AttentionTrace, attentionProbe, initialAttentionParameters } from './attention-probe';
import { examples, MiniExample, MiniSnapshot } from './mini-model';
import { vocabulary } from './world';

type Matrix = number[][];
type Projection = 'query' | 'key' | 'value';

export interface AttentionCheckpoint {
  readonly epoch: number;
  readonly model: MiniSnapshot;
  readonly positions: readonly (readonly number[])[];
  readonly query: readonly (readonly number[])[];
  readonly key: readonly (readonly number[])[];
  readonly value: readonly (readonly number[])[];
}

const zeros = (rows: number, cols: number): Matrix =>
  Array.from({ length: rows }, () => Array(cols).fill(0));
const copy = (rows: readonly (readonly number[])[]): Matrix => rows.map((row) => [...row]);
const tokenId = (token: string): number => {
  const id = vocabulary.indexOf(token as typeof vocabulary[number]);
  if (id < 0) throw new Error(`Token inconnu : ${token}`);
  return id;
};

export class TrainableAttentionModel {
  private model: MiniSnapshot;
  private params: AttentionParameters;
  private epochValue = 0;

  constructor(base: MiniSnapshot, params: AttentionParameters = initialAttentionParameters()) {
    this.model = {
      epoch: base.epoch, embeddings: copy(base.embeddings), output: copy(base.output), bias: [...base.bias],
    };
    this.params = {
      positions: copy(params.positions), query: copy(params.query), key: copy(params.key), value: copy(params.value),
    };
  }

  get epoch(): number { return this.epochValue; }
  trace(input: readonly string[]): AttentionTrace { return attentionProbe(this.model, input, this.params); }
  loss(item: MiniExample): number { return -Math.log(this.trace(item.input).probabilities[tokenId(item.target)]); }
  meanLoss(items: readonly MiniExample[] = examples): number {
    return items.reduce((total, item) => total + this.loss(item), 0) / items.length;
  }
  parameter(kind: Projection, row: number, col: number): number { return this.params[kind][row][col]; }

  /** Analytic derivatives of the exact single-head forward pass for one teacher-forced example.
   * The loss is attached to the last position only; all earlier positions are trained
   * when they become the last position of shorter prefixes in the corpus.
   */
  gradients(item: MiniExample): {
    readonly embeddings: Matrix; readonly output: Matrix; readonly bias: number[];
    readonly positions: Matrix; readonly query: Matrix; readonly key: Matrix; readonly value: Matrix;
  } {
    const trace = this.trace(item.input);
    const n = item.input.length;
    const last = n - 1;
    const target = tokenId(item.target);
    const eGrad = zeros(vocabulary.length, 4);
    const wGrad = zeros(4, vocabulary.length);
    const bGrad = Array(vocabulary.length).fill(0) as number[];
    const pGrad = zeros(this.params.positions.length, 4);
    const qGrad = zeros(4, 4);
    const kGrad = zeros(4, 4);
    const vGrad = zeros(4, 4);
    const xGrad = zeros(n, 4);
    const finalGrad = Array(4).fill(0) as number[];

    for (let j = 0; j < vocabulary.length; j++) {
      const gradient = trace.probabilities[j] - (j === target ? 1 : 0);
      bGrad[j] += gradient;
      for (let d = 0; d < 4; d++) {
        wGrad[d][j] += trace.final[d] * gradient;
        finalGrad[d] += this.model.output[d][j] * gradient;
      }
    }
    // final = x_last + Σ attention_weight_j × V_j
    for (let d = 0; d < 4; d++) xGrad[last][d] += finalGrad[d];
    const attentionWeightGrad = Array(n).fill(0) as number[];
    const valueGrad = zeros(n, 4);
    for (let j = 0; j < n; j++) {
      for (let d = 0; d < 4; d++) {
        attentionWeightGrad[j] += finalGrad[d] * trace.values[j][d];
        valueGrad[j][d] += trace.weights[last][j] * finalGrad[d];
      }
    }
    const averageWeightGrad = attentionWeightGrad.reduce((sum, value, j) =>
      sum + value * trace.weights[last][j], 0);
    const scoreGrad = attentionWeightGrad.map((value, j) =>
      trace.weights[last][j] * (value - averageWeightGrad));
    const queryGrad = Array(4).fill(0) as number[];
    const keyGrad = zeros(n, 4);
    for (let j = 0; j < n; j++) {
      for (let d = 0; d < 4; d++) {
        queryGrad[d] += scoreGrad[j] * trace.keys[j][d] / 2;
        keyGrad[j][d] += scoreGrad[j] * trace.queries[last][d] / 2;
      }
    }
    for (let d = 0; d < 4; d++) {
      for (let out = 0; out < 4; out++) {
        qGrad[d][out] += trace.x[last][d] * queryGrad[out];
        xGrad[last][d] += this.params.query[d][out] * queryGrad[out];
        for (let j = 0; j < n; j++) {
          kGrad[d][out] += trace.x[j][d] * keyGrad[j][out];
          vGrad[d][out] += trace.x[j][d] * valueGrad[j][out];
          xGrad[j][d] += this.params.key[d][out] * keyGrad[j][out];
          xGrad[j][d] += this.params.value[d][out] * valueGrad[j][out];
        }
      }
    }
    for (let j = 0; j < n; j++) {
      const id = tokenId(item.input[j]);
      for (let d = 0; d < 4; d++) {
        eGrad[id][d] += xGrad[j][d];
        pGrad[j][d] += xGrad[j][d];
      }
    }
    return { embeddings: eGrad, output: wGrad, bias: bGrad, positions: pGrad,
      query: qGrad, key: kGrad, value: vGrad };
  }

  gradientCheck(item: MiniExample, kind: Projection, row = 0, col = 0, epsilon = 0.0001): {
    readonly analytic: number; readonly numeric: number;
  } {
    const analytic = this.gradients(item)[kind][row][col];
    const matrix = this.params[kind] as Matrix;
    const original = matrix[row][col];
    matrix[row][col] = original - epsilon;
    const minus = this.loss(item);
    matrix[row][col] = original + epsilon;
    const plus = this.loss(item);
    matrix[row][col] = original;
    return { analytic, numeric: (plus - minus) / (2 * epsilon) };
  }

  train(epochs: number, learningRate = 0.7, items: readonly MiniExample[] = examples): number[] {
    if (!Number.isInteger(epochs) || epochs < 0 || epochs > 1000) throw new Error('Nombre d’époques invalide.');
    const losses: number[] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      const total = {
        embeddings: zeros(vocabulary.length, 4), output: zeros(4, vocabulary.length),
        bias: Array(vocabulary.length).fill(0) as number[], positions: zeros(8, 4),
        query: zeros(4, 4), key: zeros(4, 4), value: zeros(4, 4),
      };
      for (const item of items) {
        const gradient = this.gradients(item);
        for (const name of ['embeddings', 'output', 'positions', 'query', 'key', 'value'] as const) {
          gradient[name].forEach((row, i) => row.forEach((value, j) => total[name][i][j] += value));
        }
        gradient.bias.forEach((value, j) => total.bias[j] += value);
      }
      const scale = learningRate / items.length;
      const updated = (parameter: readonly (readonly number[])[], gradient: Matrix): Matrix =>
        parameter.map((row, i) => row.map((value, j) => value - scale * gradient[i][j]));
      this.model = {
        epoch: this.model.epoch,
        embeddings: updated(this.model.embeddings, total.embeddings),
        output: updated(this.model.output, total.output),
        bias: this.model.bias.map((value, j) => value - scale * total.bias[j]),
      };
      this.params = {
        positions: updated(this.params.positions, total.positions),
        query: updated(this.params.query, total.query),
        key: updated(this.params.key, total.key),
        value: updated(this.params.value, total.value),
      };
      this.epochValue++;
      losses.push(this.meanLoss(items));
    }
    return losses;
  }

  snapshot(): AttentionCheckpoint {
    return { epoch: this.epochValue, model: {
      epoch: this.model.epoch, embeddings: copy(this.model.embeddings), output: copy(this.model.output),
      bias: [...this.model.bias],
    }, positions: copy(this.params.positions), query: copy(this.params.query),
    key: copy(this.params.key), value: copy(this.params.value) };
  }

  restore(checkpoint: AttentionCheckpoint): void {
    const shape = (rows: readonly (readonly number[])[], r: number, c: number): boolean =>
      rows.length === r && rows.every((row) => row.length === c && row.every(Number.isFinite));
    if (!Number.isInteger(checkpoint.epoch) || checkpoint.epoch < 0 ||
      !shape(checkpoint.model.embeddings, vocabulary.length, 4) ||
      !shape(checkpoint.model.output, 4, vocabulary.length) ||
      checkpoint.model.bias.length !== vocabulary.length || !checkpoint.model.bias.every(Number.isFinite) ||
      !shape(checkpoint.positions, 8, 4) || !shape(checkpoint.query, 4, 4) ||
      !shape(checkpoint.key, 4, 4) || !shape(checkpoint.value, 4, 4))
      throw new Error('Checkpoint attention invalide.');
    this.model = {
      epoch: checkpoint.model.epoch, embeddings: copy(checkpoint.model.embeddings),
      output: copy(checkpoint.model.output), bias: [...checkpoint.model.bias],
    };
    this.params = { positions: copy(checkpoint.positions), query: copy(checkpoint.query),
      key: copy(checkpoint.key), value: copy(checkpoint.value) };
    this.epochValue = checkpoint.epoch;
  }
}
