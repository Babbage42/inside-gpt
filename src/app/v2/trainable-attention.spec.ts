import { examples, MiniLanguageModel, promptTokens } from './mini-model';
import { TrainableAttentionModel } from './trainable-attention';
import { vocabulary } from './world';

describe('V2.1: apprentissage réel de l’attention', () => {
  it('matches finite differences for Q, K and V without changing the checkpoint', () => {
    const model = new TrainableAttentionModel(new MiniLanguageModel().snapshot());
    const before = model.snapshot();
    for (const kind of ['query', 'key', 'value'] as const) {
      const check = model.gradientCheck(examples[4], kind, 0, 0);
      expect(check.analytic).toBeCloseTo(check.numeric, 6);
    }
    expect(model.snapshot()).toEqual(before);
  });

  it('trains through the causal head and restores exactly', () => {
    const base = new MiniLanguageModel().snapshot();
    const model = new TrainableAttentionModel(base);
    const initialLoss = model.meanLoss();
    const initialQuery = model.parameter('query', 0, 0);
    const losses = model.train(100);
    expect(losses.length).toBe(100);
    expect(model.meanLoss()).toBeLessThan(initialLoss);
    expect(model.parameter('query', 0, 0)).not.toBe(initialQuery);
    const checkpoint = model.snapshot();
    const restored = new TrainableAttentionModel(base);
    restored.restore(checkpoint);
    expect(restored.trace(promptTokens('chat', 'mange')).probabilities)
      .toEqual(model.trace(promptTokens('chat', 'mange')).probabilities);
    expect(model.trace(promptTokens('chat', 'mange')).probabilities.reduce((a, b) => a + b, 0))
      .toBeCloseTo(1, 10);
    expect(vocabulary.length).toBe(12);
  });

  it('measurably changes the actual reading policy on the held-out prefix', () => {
    const model = new TrainableAttentionModel(new MiniLanguageModel().snapshot());
    const input = promptTokens('chat', 'mange');
    const before = model.trace(input).weights.at(-1)!;
    const initialLoss = model.meanLoss();
    model.train(100);
    const after = model.trace(input).weights.at(-1)!;
    expect(model.meanLoss()).toBeLessThan(initialLoss);
    expect(Math.max(...before.map((value, i) => Math.abs(value - after[i])))).toBeGreaterThan(0.05);
    expect(after.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
  });
});
