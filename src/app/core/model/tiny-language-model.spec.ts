import { EmbeddingBaseline, LanguageExample, TinyAttentionModel } from './tiny-language-model';

describe('tiny language models', () => {
  it('matches the analytic embedding gradient against central finite differences', () => {
    const model = new EmbeddingBaseline(['chat', 'fatigué'], ['dort', 'joue']);
    const example = { tokens: ['chat', 'fatigué'], target: 'dort' };
    const gradient = model.gradientTrace(example);
    for (let position = 0; position < 2; position++) {
      for (let d = 0; d < 2; d++) {
        const token = example.tokens[position]; const x = model.embedding(token)[d];
        const plus = model.clone(); const minus = model.clone();
        plus.setEmbeddingCoordinate(token, d, x + 1e-5);
        minus.setEmbeddingCoordinate(token, d, x - 1e-5);
        const measured = (plus.trace(example.tokens, example.target).loss! - minus.trace(example.tokens, example.target).loss!) / 2e-5;
        expect(measured).toBeCloseTo(gradient.embeddingGradients[position][d], 7);
      }
    }
  });

  it('uses the displayed single-example gradient in the real update', () => {
    const model = new EmbeddingBaseline(['chat', 'fatigué'], ['dort', 'joue']);
    const example = { tokens: ['chat', 'fatigué'], target: 'dort' };
    const before = model.embedding('fatigué'); const g = model.gradientTrace(example);
    model.train([example], 1, 0.16);
    expect(model.embedding('fatigué')[0]).toBeCloseTo(before[0] - 0.16 * g.embeddingGradients[1][0], 12);
  });

  it('rotates embeddings and readers without changing any probabilities', () => {
    const model = new EmbeddingBaseline(['chat', 'fatigué'], ['dort', 'joue']);
    model.train([{ tokens: ['chat', 'fatigué'], target: 'dort' }], 40);
    const before = model.trace(['chat', 'fatigué']); const rotated = model.rotated();
    const after = rotated.trace(['chat', 'fatigué']);
    before.probabilities.forEach((p, i) => expect(after.probabilities[i]).toBeCloseTo(p, 12));
    expect(rotated.embedding('fatigué')).not.toEqual(model.embedding('fatigué'));
  });

  it('exposes the actual Q projection and all four MLP activations', () => {
    const model = new TinyAttentionModel(['chat', 'fatigué', 'donc'], ['dort', 'joue']);
    const trace = model.trace(['chat', 'fatigué', 'donc']);
    for (let output = 0; output < 2; output++) {
      const q = model.embedding('donc').reduce((sum, value, input) => sum + value * model.parameterValue(`Wq:${input}:${output}`), 0);
      expect(trace.query[output]).toBeCloseTo(q, 12);
    }
    for (let output = 0; output < 4; output++) {
      const z = trace.normalized.reduce((sum, value, input) => sum + value * model.parameterValue(`W1:${input}:${output}`), model.parameterValue(`b1:${output}`));
      expect(trace.hidden[output]).toBeCloseTo(Math.tanh(z), 12);
    }
  });

  it('honestly demonstrates prefix order invariance without positional information', () => {
    const model = new TinyAttentionModel(['chat', 'fatigué', 'donc'], ['dort', 'joue']);
    const a = model.trace(['chat', 'fatigué', 'donc']);
    const b = model.trace(['fatigué', 'chat', 'donc']);
    a.probabilities.forEach((p, i) => expect(b.probabilities[i]).toBeCloseTo(p, 12));
  });
  const candidates = ['dort', 'joue', 'mange'];
  const baselineCorpus: readonly LanguageExample[] = [
    { tokens: ['chat', 'épuisé'], target: 'dort' },
    { tokens: ['chien', 'fatigué'], target: 'dort' },
    { tokens: ['souris', 'fatigué'], target: 'dort' },
    { tokens: ['chat', 'joueur'], target: 'joue' },
    { tokens: ['chien', 'joueur'], target: 'joue' },
    { tokens: ['chat', 'affamé'], target: 'mange' },
    { tokens: ['souris', 'affamé'], target: 'mange' },
  ];

  it('learns embeddings through the real cross-entropy gradient', () => {
    const vocabulary = [...new Set(baselineCorpus.flatMap((example) => example.tokens))];
    const model = new EmbeddingBaseline(vocabulary, candidates);
    const initialLoss = model.meanLoss(baselineCorpus);
    const initialEmbedding = model.embedding('fatigué');
    model.train(baselineCorpus, 300);

    expect(model.meanLoss(baselineCorpus)).toBeLessThan(initialLoss * 0.2);
    expect(model.embedding('fatigué')).not.toEqual(initialEmbedding);
    expect(model.trace(['chat', 'fatigué']).predicted).toBe('dort');
  });

  it('exposes the same gradient chain used to update an embedding', () => {
    const vocabulary = [...new Set(baselineCorpus.flatMap((example) => example.tokens))];
    const model = new EmbeddingBaseline(vocabulary, candidates);
    const gradient = model.gradientTrace(baselineCorpus[1]);

    expect(gradient.logitGradients.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 10);
    expect(gradient.embeddingGradients[1][0]).toBeCloseTo(gradient.contextGradients[0] / 2, 10);
    expect(gradient.embeddingGradients[1][1]).toBeCloseTo(gradient.contextGradients[1] / 2, 10);
  });

  it('trains query, key, value and output projections end to end', () => {
    const corpus: readonly LanguageExample[] = [
      { tokens: ['chat', 'semble', 'épuisé', 'donc'], target: 'dort' },
      { tokens: ['chien', 'après', 'promenade', 'fatigué', 'donc'], target: 'dort' },
      { tokens: ['souris', 'très', 'fatigué', 'donc'], target: 'dort' },
      { tokens: ['chat', 'encore', 'joueur', 'donc'], target: 'joue' },
      { tokens: ['chien', 'très', 'joueur', 'donc'], target: 'joue' },
      { tokens: ['souris', 'après', 'promenade', 'joueur', 'donc'], target: 'joue' },
      { tokens: ['chat', 'semble', 'affamé', 'donc'], target: 'mange' },
      { tokens: ['chien', 'encore', 'affamé', 'donc'], target: 'mange' },
      { tokens: ['souris', 'très', 'affamé', 'donc'], target: 'mange' },
    ];
    const vocabulary = [...new Set(corpus.flatMap((example) => example.tokens))];
    const model = new TinyAttentionModel(vocabulary, candidates);
    const initialLoss = model.meanLoss(corpus);
    model.train(corpus, 1400, 0.12);
    const trace = model.trace(['chat', 'après', 'promenade', 'fatigué', 'donc']);

    expect(model.meanLoss(corpus)).toBeLessThan(initialLoss * 0.25);
    expect(trace.predicted).toBe('dort');
    expect(trace.attention.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    expect(new Set(trace.attention.map((value) => value.toFixed(4))).size).toBeGreaterThan(1);
  });
});
