import { AttentionParameters } from './attention-probe';
import { MiniSnapshot } from './mini-model';
import { vocabulary } from './world';

export interface MicroAttentionTrace {
  readonly tokens: readonly string[];
  readonly x: readonly (readonly number[])[];
  readonly q: readonly (readonly number[])[];
  readonly k: readonly (readonly number[])[];
  readonly v: readonly (readonly number[])[];
  readonly products: readonly number[];
  readonly scores: readonly number[];
  readonly weights: readonly number[];
  readonly read: readonly number[];
}

/** A transparent 4-token, 2D, single-head sub-experiment. It reuses the
 * actual model numbers, but intentionally truncates the architecture;
 * its weights are not the 4D main model's attention weights. */
export function microAttention(
  snapshot: MiniSnapshot, input: readonly string[], params: AttentionParameters,
): MicroAttentionTrace {
  const tokens = input.slice(-4);
  if (tokens.length !== 4) throw new Error('La micro-expérience demande quatre tokens.');
  const offset = input.length - tokens.length;
  const x = tokens.map((token, j) => {
    const id = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (id < 0) throw new Error(`Token inconnu : ${token}`);
    return [0, 1].map((d) => snapshot.embeddings[id][d] + params.positions[offset + j][d]);
  });
  const project = (matrix: readonly (readonly number[])[]): number[][] =>
    x.map((row) => [0, 1].map((d) => row[0] * matrix[0][d] + row[1] * matrix[1][d]));
  const q = project(params.query);
  const k = project(params.key);
  const v = project(params.value);
  const products = k.map((key) => q[3][0] * key[0] + q[3][1] * key[1]);
  const scores = products.map((product) => product / Math.sqrt(2));
  const maximum = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maximum));
  const denominator = exponentials.reduce((sum, value) => sum + value, 0);
  const weights = exponentials.map((value) => value / denominator);
  const read = [0, 1].map((d) => weights.reduce((sum, weight, j) => sum + weight * v[j][d], 0));
  return { tokens, x, q, k, v, products, scores, weights, read };
}
