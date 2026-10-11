import { continuations, corpus, initialEmbedding, prefix, subjectEvidence, tokenize, trainingPairs, vocabulary } from './world';

describe('V2 : corpus et représentations', () => {
  it('garde le préfixe et la phrase de test entièrement hors entraînement', () => {
    expect(new Set(corpus).size).toBe(corpus.length);
    expect(corpus.join('|')).not.toContain('le chat mange la souris .');
    expect(continuations(prefix('chat', 'mange'))).toEqual([]);
    expect(subjectEvidence('chat')).toEqual([
      { token: 'souris', count: 3, probability: 1, rows: [0, 1, 2] },
    ]);
  });

  it('perd le contexte lorsque seul le dernier token est lu', () => {
    expect(continuations(prefix('chat', 'mange'), true)).toEqual(
      continuations(prefix('chien', 'mange'), true),
    );
    expect(continuations(prefix('chat', 'mange'))).not.toEqual(
      continuations(prefix('chien', 'mange')),
    );
  });

  it('ne fabrique pas de fréquence pour une combinaison de tokens connus mais absente', () => {
    expect(continuations(['le', 'chat', 'mange', 'la'])).toEqual([]);
    for (const token of ['le', 'chat', 'mange', 'la']) {
      expect(vocabulary).toContain(token as typeof vocabulary[number]);
    }
  });

  it('produit une paire par cible, sans inclure cette cible dans son entrée', () => {
    const pairs = trainingPairs(corpus[0]);
    expect(pairs[0]).toEqual({ input: ['<début>'], target: 'un' });
    expect(pairs[4]).toEqual({ input: ['<début>', 'un', 'chat', 'mange', 'la'], target: 'souris' });
    expect(pairs[pairs.length - 1].target).toBe('.');
    expect(tokenize('Le chat.')).toEqual(['le', 'chat', '.']);
  });

  it('initialise une ligne de quatre valeurs pour chaque token, de façon reproductible', () => {
    const table = initialEmbedding();
    expect(table.length).toBe(vocabulary.length);
    expect(table.every((row) => row.length === 4 && row.every((n) => Math.abs(n) <= 0.2))).toBeTrue();
    expect(initialEmbedding()).toEqual(table);
  });
});
