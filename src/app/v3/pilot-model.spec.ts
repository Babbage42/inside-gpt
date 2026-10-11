import { examples, promptTokens } from '../v2/mini-model';
import { PilotModel } from './pilot-model';

describe('V3: calculs réels et interventions isolées', () => {
  it('keeps the training witness different from the held-out prefix', () => {
    const pilot = new PilotModel();
    expect(pilot.input).toEqual(['<début>', 'un', 'chat', 'mange', 'la']);
    expect(examples.some((e) => e.input.join(' ') === promptTokens('chat', 'mange').join(' '))).toBeFalse();
    expect(examples.some((e) => e.input.join(' ') === pilot.input.join(' ') && e.target === 'souris')).toBeTrue();
  });
  it('reconstructs all four products and the shared softmax total', () => {
    const pilot = new PilotModel();
    expect(pilot.trace.context[0]).toBeCloseTo(-0.1172, 12);
    expect(pilot.weight(0)).toBe(0.047);
    expect(pilot.contributions().reduce((a, b) => a + b, 0)).toBeCloseTo(-0.0152764, 12);
    const exp = pilot.trace.logits.map(Math.exp);
    expect(exp[pilot.targetIndex] / exp.reduce((a, b) => a + b, 0)).toBeCloseTo(0.08161999773591, 12);
    expect(pilot.trace.loss).toBeCloseTo(2.5056809767438755, 12);
  });
  it('changes only the target output score and preserves the reference model', () => {
    const pilot = new PilotModel();
    const before = pilot.clone().snapshot();
    const trial = pilot.interveneWeight(0.1);
    expect(trial.context).toEqual(pilot.trace.context);
    expect(trial.logits[pilot.targetIndex] - pilot.trace.logits[pilot.targetIndex]).toBeCloseTo(-0.01172, 12);
    trial.logits.forEach((s, j) => { if (j !== pilot.targetIndex) expect(s).toBe(pilot.trace.logits[j]); });
    expect(trial.loss).toBeGreaterThan(pilot.trace.loss!);
    expect(pilot.clone().snapshot()).toEqual(before);
  });
  it('reverses the effect when the input coordinate is positive', () => {
    const pilot = new PilotModel();
    expect(pilot.trace.context[1]).toBeGreaterThan(0);
    expect(pilot.interveneWeight(0.1, 1).loss).toBeLessThan(pilot.trace.loss!);
  });
  it('makes target probability depend on competing scores', () => {
    const pilot = new PilotModel();
    const before = pilot.trace.probabilities[pilot.targetIndex];
    const trial = pilot.interveneScore('pomme', 1);
    expect(trial.logits[pilot.targetIndex]).toBe(pilot.trace.logits[pilot.targetIndex]);
    expect(trial.probabilities[pilot.targetIndex]).toBeLessThan(before);
    expect(trial.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it('leaves an absent independent embedding without any effect', () => {
    const pilot = new PilotModel();
    expect(pilot.interveneEmbedding('chien', 0.1)).toEqual(pilot.trace);
    expect(pilot.interveneEmbedding('chat', 0.1).probabilities).not.toEqual(pilot.trace.probabilities);
  });
  it('composes sensitivities and sums every embedding branch before dividing by five', () => {
    const pilot = new PilotModel();
    const p = pilot.trace.probabilities[pilot.targetIndex];
    const analytic = (-1 / p) * p * (1 - p) * pilot.trace.context[0];
    expect(analytic).toBeCloseTo(pilot.gradient().numeric, 8);
    const sum = pilot.trace.probabilities.reduce((a, probability, j) =>
      a + pilot.snapshot.output[0][j] * (probability - (j === pilot.targetIndex ? 1 : 0)), 0);
    expect(sum / 5).toBeCloseTo(pilot.embeddingGradient().analytic, 12);
    expect(sum / 5).toBeCloseTo(pilot.embeddingGradient().numeric, 8);
  });
  it('applies a single-weight correction without confusing it with a batch update', () => {
    const pilot = new PilotModel();
    const update = pilot.singleUpdate(0.7);
    expect(update.afterWeight).toBeCloseTo(-0.0283438953857459, 12);
    expect(update.trace.loss).toBeCloseTo(2.497574331254095, 12);
    const lab = pilot.clone();
    const mean = lab.batchGradientOutputWeight(0, 'souris');
    lab.train(1);
    expect(lab.outputWeight(0, 'souris')).toBeCloseTo(pilot.weight(0) - 0.7 * mean, 12);
    expect(lab.outputWeight(0, 'souris')).not.toBeCloseTo(update.afterWeight, 6);
    expect(pilot.weight(0)).toBe(0.047);
  });
});
