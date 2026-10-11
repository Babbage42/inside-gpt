export const vocabulary = ['<début>', 'le', 'un', 'chat', 'chien', 'mange', 'regarde', 'la', 'souris', 'pomme', 'dort', '.'] as const;

export const corpus = [
  'un chat mange la souris .',
  'un chat regarde la souris .',
  'le chat regarde la souris .',
  'le chien mange la pomme .',
  'un chien mange la pomme .',
  'le chien regarde la pomme .',
  'le chat dort .',
  'le chien dort .',
  'un chat dort .',
  'un chien dort .',
] as const;

export type Animal = 'chat' | 'chien';
export type Verb = 'mange' | 'regarde';

export function prefix(animal: Animal, verb: Verb): string[] {
  return ['le', animal, verb, 'la'];
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/\./g, ' . ').trim().split(/\s+/).filter(Boolean);
}

export interface Continuation {
  readonly token: string;
  readonly count: number;
  readonly probability: number;
  readonly rows: readonly number[];
}

export function continuations(tokens: readonly string[], lastOnly = false): Continuation[] {
  const totals = new Map<string, number[]>();
  corpus.forEach((sentence, row) => {
    const parts = tokenize(sentence);
    for (let i = lastOnly ? 0 : tokens.length - 1; i < parts.length - 1; i++) {
      const matches = lastOnly
        ? parts[i] === tokens[tokens.length - 1]
        : tokens.every((token, offset) => parts[i - tokens.length + 1 + offset] === token);
      if (!matches) continue;
      const next = parts[i + 1];
      totals.set(next, [...(totals.get(next) ?? []), row]);
    }
  });
  const denominator = [...totals.values()].reduce((sum, rows) => sum + rows.length, 0);
  return [...totals.entries()].map(([token, rows]) => ({
    token, count: rows.length, probability: rows.length / denominator, rows,
  })).sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));
}

/** A transparent fallback witness: count continuations after « la » only in
 * corpus sentences whose subject is the selected animal. This is evidence,
 * not the exact-prefix answer and not a neural prediction.
 */
export function subjectEvidence(animal: Animal): Continuation[] {
  const totals = new Map<string, number[]>();
  corpus.forEach((sentence, row) => {
    const parts = tokenize(sentence);
    if (parts[1] !== animal) return;
    const articleIndex = parts.indexOf('la');
    if (articleIndex < 0 || articleIndex + 1 >= parts.length) return;
    const next = parts[articleIndex + 1];
    totals.set(next, [...(totals.get(next) ?? []), row]);
  });
  const denominator = [...totals.values()].reduce((sum, rows) => sum + rows.length, 0);
  return [...totals.entries()].map(([token, rows]) => ({
    token, count: rows.length, probability: rows.length / denominator, rows,
  })).sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));
}

export function trainingPairs(sentence: string): { input: string[]; target: string }[] {
  const tokens = ['<début>', ...tokenize(sentence)];
  return tokens.slice(1).map((target, index) => ({ input: tokens.slice(0, index + 1), target }));
}

// Values are deliberately initialized, not learned. The seed and formula are exposed in the UI.
export function initialEmbedding(): number[][] {
  let state = 23;
  return vocabulary.map(() => Array.from({ length: 4 }, () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return +((state / 0x100000000 * 2 - 1) * 0.2).toFixed(3);
  }));
}
