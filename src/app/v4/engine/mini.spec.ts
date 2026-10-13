import { MiniGpt } from './mini-gpt';
import { ANIMALS, CONTEXT, MOVES, NEVER_ASKED, NEVER_PLURAL, WORDS, encode, exam, isTrue, tokenize, trainingText } from './mini-world';
import { Rng } from './tensor';

describe('V4 · mini-monde', () => {
  const rng = new Rng(11);
  const texts = Array.from({ length: 4000 }, () => trainingText(rng));
  const joined = texts.map((t) => ' ' + t.join(' ') + ' ');

  it('n’écrit que des textes vrais, qui tiennent dans le contexte, avec des mots connus', () => {
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(CONTEXT);
      expect(encode(text).every((id) => id !== undefined)).toBeTrue();
    }
    const sentences = texts[0].join(' ').split(' . ').filter(Boolean);
    expect(sentences.length).toBeGreaterThan(1);
  });

  it('ne pose jamais de question directe sur les animaux réservés', () => {
    for (const index of NEVER_ASKED) {
      const { name, plural } = ANIMALS[index];
      const asked = joined.filter((t) => new RegExp(` (où|que) (vit|mange|fait|vivent|mangent|font) (le|la|les) (${name}|${plural}) `).test(t));
      expect(asked.length).toBe(0);
    }
  });

  it('n’écrit jamais les pluriels réservés', () => {
    for (const [index, topic] of NEVER_PLURAL) {
      const { plural, move } = ANIMALS[index];
      const verb = topic === 'habitat' ? 'vivent' : topic === 'food' ? 'mangent' : MOVES[move];
      const asked = topic === 'move' ? 'font' : verb;
      expect(joined.some((t) => t.includes(` ${plural} ${verb} `) || t.includes(` ${asked} les ${plural} `))).toBeFalse();
    }
  });

  it('sait reconnaître une phrase vraie de son monde', () => {
    expect(isTrue('le lion vit dans la savane .'.split(' '))).toBeTrue();
    expect(isTrue('que font les baleines ? elles nagent .'.split(' '))).toBeTrue();
    expect(isTrue('le lion vit dans la mer .'.split(' '))).toBeFalse();
    expect(isTrue('les lions vit dans la savane .'.split(' '))).toBeFalse();
  });

  it('tient ses épreuves dans le contexte et hors de l’entraînement', () => {
    for (const skill of ['question', 'accord'] as const)
      for (const c of exam(skill)) {
        expect(c.prompt.length + c.answer.length).toBeLessThanOrEqual(CONTEXT);
        const whole = ' ' + [...c.prompt, ...c.answer].join(' ') + ' ';
        expect(joined.some((t) => t.includes(whole))).withContext(whole).toBeFalse();
      }
  });

  it('découpe un texte tapé au clavier', () => {
    expect(tokenize('Que mange le Zebre ?').words).toEqual(['que', 'mange', 'le', 'zèbre', '?']);
    expect(tokenize('de l’herbe.').words).toEqual(['de', "l'", 'herbe', '.']);
    expect(tokenize('le lion mange une pizza').unknown).toEqual(['une', 'pizza']);
  });
});

describe('V4 · mini-GPT', () => {
  const config = { vocab: 9, context: 6, width: 8, layers: 2, heads: 2, hidden: 12 };
  const texts = [[1, 4, 2, 7, 3], [5, 0, 8, 2]];

  it('calcule les mêmes pentes que des différences finies', () => {
    const model = new MiniGpt(config, 4);
    model.measure(texts);
    const slopes = model.parameters.map((m) => m.grad.slice());
    model.parameters.forEach((m, k) => {
      for (const index of [0, Math.floor(m.data.length / 2), m.data.length - 1]) {
        const saved = m.data[index], push = 5e-3;
        m.data[index] = saved + push;
        const up = model.measure(texts);
        m.data[index] = saved - push;
        const down = model.measure(texts);
        m.data[index] = saved;
        expect(slopes[k][index]).withContext(`réglage ${k}[${index}]`).toBeCloseTo((up - down) / (2 * push), 2);
      }
      m.grad.fill(0);
    });
  });

  it('retrouve exactement ses prédictions après un instantané', () => {
    const model = new MiniGpt(config, 4), twin = new MiniGpt(config, 9);
    twin.load(model.snapshot());
    expect(Array.from(twin.scores([1, 4, 2]))).toEqual(Array.from(model.scores([1, 4, 2])));
  });

  it('fait baisser sa surprise en s’entraînant', () => {
    const model = new MiniGpt({ ...config, vocab: WORDS.length, context: CONTEXT }, 2, 0.01), rng = new Rng(3);
    const batch = () => Array.from({ length: 8 }, () => encode(trainingText(rng)));
    const first = model.trainStep(batch());
    let last = first;
    for (let i = 0; i < 60; i++) last = model.trainStep(batch());
    expect(last).toBeLessThan(first * 0.7);
  });
});
