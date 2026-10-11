import { MiniSnapshot } from './mini-model';
import { vocabulary } from './world';

export interface AttentionTrace {
  readonly input: readonly string[];
  readonly embedding: readonly (readonly number[])[];
  readonly position: readonly (readonly number[])[];
  readonly x: readonly (readonly number[])[];
  readonly queries: readonly (readonly number[])[];
  readonly keys: readonly (readonly number[])[];
  readonly values: readonly (readonly number[])[];
  readonly scores: readonly (readonly number[])[];
  readonly weights: readonly (readonly number[])[];
  readonly attended: readonly (readonly number[])[];
  readonly final: readonly number[];
  readonly logits: readonly number[];
  readonly probabilities: readonly number[];
}

export interface AttentionParameters {
  readonly positions: readonly (readonly number[])[];
  readonly query: readonly (readonly number[])[];
  readonly key: readonly (readonly number[])[];
  readonly value: readonly (readonly number[])[];
}

/** Continue the very same seed-23 stream used for E and W in lesson 2.
 * These new parameters are initialised, not trained. Maximal context length: 8.
 */
export function initialAttentionParameters(): AttentionParameters {
  let state = 23;
  const next = (): number => {
    state = (1664525 * state + 1013904223) >>> 0;
    return +(((state / 0x100000000 * 2 - 1) * 0.2).toFixed(3));
  };
  for (let i = 0; i < vocabulary.length * 4 + 4 * vocabulary.length; i++) next();
  const matrix = (rows: number, columns: number): number[][] =>
    Array.from({ length: rows }, () => Array.from({ length: columns }, next));
  return { positions: matrix(8, 4), query: matrix(4, 4), key: matrix(4, 4), value: matrix(4, 4) };
}

function softmax(scores: readonly number[]): number[] {
  const maximum = Math.max(...scores);
  const exponential = scores.map((score) => Math.exp(score - maximum));
  const sum = exponential.reduce((total, value) => total + value, 0);
  return exponential.map((value) => value / sum);
}

function project(row: readonly number[], weights: readonly (readonly number[])[]): number[] {
  return Array.from({ length: 4 }, (_, d) => row.reduce((sum, value, i) => sum + value * weights[i][d], 0));
}

/** One untrained, causal, single-head attention block with a residual path.
 * This is a forward-pass laboratory, not a trained Transformer or a GPT.
 */
export function attentionProbe(
  checkpoint: MiniSnapshot,
  input: readonly string[],
  params: AttentionParameters = initialAttentionParameters(),
  usePositions = true,
): AttentionTrace {
  if (!input.length || input.length > params.positions.length) throw new Error('Longueur du préfixe invalide.');
  const embedding = input.map((token) => {
    const id = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (id < 0) throw new Error(`Token inconnu : ${token}`);
    return [...checkpoint.embeddings[id]];
  });
  const position = input.map((_, i) => usePositions ? [...params.positions[i]] : [0, 0, 0, 0]);
  const x = embedding.map((row, i) => row.map((value, d) => value + position[i][d]));
  const queries = x.map((row) => project(row, params.query));
  const keys = x.map((row) => project(row, params.key));
  const values = x.map((row) => project(row, params.value));
  const scores = queries.map((query, i) => keys.map((key, j) =>
    j > i ? Number.NEGATIVE_INFINITY : query.reduce((sum, value, d) => sum + value * key[d], 0) / 2));
  const weights = scores.map((row, i) => [...softmax(row.slice(0, i + 1)), ...row.slice(i + 1).map(() => 0)]);
  const attended = weights.map((row) => Array.from({ length: 4 }, (_, d) =>
    row.reduce((sum, weight, j) => sum + weight * values[j][d], 0)));
  const last = input.length - 1;
  const final = x[last].map((value, d) => value + attended[last][d]);
  const logits = vocabulary.map((_, j) => checkpoint.bias[j] +
    final.reduce((sum, value, d) => sum + value * checkpoint.output[d][j], 0));
  return {
    input: [...input], embedding, position, x, queries, keys, values, scores, weights,
    attended, final, logits, probabilities: softmax(logits),
  };
}
