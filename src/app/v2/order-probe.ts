import { MiniSnapshot } from './mini-model';
import { vocabulary } from './world';

export interface ProbeTrace {
  readonly input: readonly string[];
  readonly rows: readonly (readonly number[])[];
  readonly context: readonly number[];
  readonly logits: readonly number[];
  readonly probabilities: readonly number[];
}

/** Three controlled readouts of the *same* E, W and bias checkpoint.
 * The positional offset and positional weighting are interventions, not trained model parameters.
 */
export function probeOrder(
  snapshot: MiniSnapshot,
  input: readonly string[],
  kind: 'mean' | 'add-position' | 'weighted',
  focus = 2,
  strength = 1,
): ProbeTrace {
  if (!input.length || focus < 0 || focus >= input.length) throw new Error('Préfixe ou position invalide.');
  const rows = input.map((token, i) => {
    const id = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (id < 0) throw new Error(`Token inconnu : ${token}`);
    const row = [...snapshot.embeddings[id]];
    if (kind === 'add-position' && i === focus) row[0] += strength;
    return row;
  });
  const weights = input.map((_, i) => kind === 'weighted' && i === focus ? 1 + strength : 1);
  const divisor = weights.reduce((sum, value) => sum + value, 0);
  const context = Array.from({ length: 4 }, (_, d) =>
    rows.reduce((sum, row, i) => sum + weights[i] * row[d], 0) / divisor);
  const logits = vocabulary.map((_, j) => snapshot.bias[j] +
    context.reduce((sum, value, d) => sum + value * snapshot.output[d][j], 0));
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const sum = exponentials.reduce((total, value) => total + value, 0);
  return { input: [...input], rows, context, logits, probabilities: exponentials.map((value) => value / sum) };
}
