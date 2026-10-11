import { initialAttentionParameters } from './attention-probe';
import { MiniLanguageModel, promptTokens } from './mini-model';
import { microAttention } from './micro-attention';

describe('V2.1: micro-attention honnête', () => {
  it('calculates the selected QK cell, √2 scaling and weighted V from real parameters', () => {
    const trace = microAttention(new MiniLanguageModel().snapshot(), promptTokens('chat', 'mange'), initialAttentionParameters());
    expect(trace.tokens).toEqual(['le', 'chat', 'mange', 'la']);
    for (let j = 0; j < 4; j++) {
      expect(trace.products[j]).toBeCloseTo(trace.q[3][0] * trace.k[j][0] + trace.q[3][1] * trace.k[j][1], 12);
      expect(trace.scores[j]).toBeCloseTo(trace.products[j] / Math.sqrt(2), 12);
    }
    expect(trace.weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(trace.read[0]).toBeCloseTo(trace.weights.reduce((sum, weight, j) => sum + weight * trace.v[j][0], 0), 12);
  });
});
