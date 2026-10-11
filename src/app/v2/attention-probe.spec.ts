import { MiniLanguageModel, promptTokens } from './mini-model';
import { attentionProbe, initialAttentionParameters } from './attention-probe';

describe('causal attention forward probe', () => {
  const checkpoint = new MiniLanguageModel().snapshot();
  const input = promptTokens('chat', 'mange');

  it('starts deterministically and has the documented dimensions', () => {
    expect(initialAttentionParameters()).toEqual(initialAttentionParameters());
    const trace = attentionProbe(checkpoint, input);
    expect(trace.x.length).toBe(5);
    expect(trace.queries[0].length).toBe(4);
    expect(trace.probabilities.length).toBe(12);
  });

  it('normalizes each attention row and masks every future position', () => {
    const trace = attentionProbe(checkpoint, input);
    trace.weights.forEach((row, i) => {
      expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
      row.slice(i + 1).forEach((value) => expect(value).toBe(0));
    });
  });

  it('does not leak a changed future token into earlier attended states', () => {
    const changed = [...input];
    changed[4] = 'pomme';
    const before = attentionProbe(checkpoint, input);
    const after = attentionProbe(checkpoint, changed);
    expect(after.attended.slice(0, 4)).toEqual(before.attended.slice(0, 4));
    expect(after.attended[4]).not.toEqual(before.attended[4]);
  });

  it('keeps the existing E and W checkpoint unchanged', () => {
    const original = JSON.stringify(checkpoint);
    attentionProbe(checkpoint, input);
    expect(JSON.stringify(checkpoint)).toBe(original);
  });
});
