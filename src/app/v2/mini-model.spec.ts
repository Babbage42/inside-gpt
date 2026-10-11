import { examples, MiniLanguageModel, promptTokens } from './mini-model';
import { initialEmbedding, vocabulary } from './world';

describe('V2 mini-model: données et calculs réels', () => {
  it('reuses exactly the lesson-1 table and predicts from a normalized distribution', () => {
    const model = new MiniLanguageModel();
    expect(model.snapshot().embeddings).toEqual(initialEmbedding());
    const trace = model.trace(promptTokens('chat', 'mange'));
    expect(trace.input).toEqual(['<début>', 'le', 'chat', 'mange', 'la']);
    expect(trace.probabilities.length).toBe(vocabulary.length);
    expect(trace.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(trace.context[0]).toBeCloseTo(trace.rows.reduce((a, row) => a + row[0], 0) / 5, 10);
  });

  it('checks the shown gradient independently without changing the weights', () => {
    const model = new MiniLanguageModel();
    const before = model.snapshot();
    const check = model.gradientCheck(examples[4]);
    expect(check.analytic).toBeCloseTo(check.numeric, 6);
    const embeddingCheck = model.gradientCheckEmbedding(examples[4], 'chat');
    expect(embeddingCheck.analytic).toBeCloseTo(embeddingCheck.numeric, 6);
    expect(model.snapshot()).toEqual(before);
  });

  it('uses the corpus-average gradient for one actual output-weight update', () => {
    const model = new MiniLanguageModel();
    const oldWeight = model.outputWeight(0, 'souris');
    const batchGradient = model.batchGradientOutputWeight(0, 'souris');
    model.train(1);
    expect(model.outputWeight(0, 'souris')).toBeCloseTo(oldWeight - 0.7 * batchGradient, 10);
  });

  it('reduces corpus loss by training E, W and biases, then restores the checkpoint', () => {
    const model = new MiniLanguageModel();
    const initial = model.meanLoss();
    const losses = model.train(100);
    expect(losses.length).toBe(100);
    expect(model.meanLoss()).toBeLessThan(initial);
    expect(model.snapshot().embeddings).not.toEqual(initialEmbedding());
    const copy = new MiniLanguageModel();
    copy.restore(model.snapshot());
    expect(copy.trace(promptTokens('chien', 'regarde')).probabilities)
      .toEqual(model.trace(promptTokens('chien', 'regarde')).probabilities);
  });

  it('is honestly blind to order', () => {
    const model = new MiniLanguageModel();
    const a = model.trace(['<début>', 'le', 'chat', 'mange', 'la']);
    const b = model.trace(['la', 'mange', 'chat', 'le', '<début>']);
    a.probabilities.forEach((probability, index) => expect(probability).toBeCloseTo(b.probabilities[index], 10));
  });

  it('scores the held-out cat prefix from shared tokens, never from an exact training pair', () => {
    expect(examples.some((item) => item.input.join(' ') === '<début> le chat mange la')).toBeFalse();
    const model = new MiniLanguageModel();
    model.train(500);
    const trace = model.trace(promptTokens('chat', 'mange'));
    expect(trace.probabilities[vocabulary.indexOf('souris')])
      .toBeGreaterThan(trace.probabilities[vocabulary.indexOf('pomme')]);
    expect(trace.predicted).toBe('souris');
  });
});
