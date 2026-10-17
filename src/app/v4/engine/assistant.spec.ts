import {
  BOT,
  CONFIG,
  CONTEXT,
  DONT_KNOW,
  END,
  EXAMS,
  STRANGERS,
  USER,
  WORDS,
  baseText,
  chance,
  decode,
  dialogue,
  grade,
  practiseOnce,
  tokenize,
} from './assistant-world';
import { MiniGpt } from './mini-gpt';
import { ANIMALS, NEVER_ASKED } from './mini-world';
import { Rng } from './tensor';

describe('V4 · le monde de l’assistant', () => {
  const rng = new Rng(3);
  const pages = Array.from({ length: 2000 }, () => ' ' + baseText(rng).join(' ') + ' ');

  it('ne donne jamais, dans le cours, de fait sur les inconnus ni de réponse à une question', () => {
    for (const page of pages) {
      expect(page.split(' ').filter(Boolean).length).toBeLessThanOrEqual(CONTEXT);
      for (const word of [USER, BOT, END, 'je', 'assistant']) expect(page).not.toContain(` ${word} `);
      for (const s of STRANGERS.filter((s) => s.words[1] !== 'souris' && s.words[1] !== 'poisson'))
        expect(new RegExp(` ${s.words.join(' ')} (vit|mange|court|vole|nage|grimpe) `).test(page)).withContext(page).toBeFalse();
    }
    // Les quiz citent bien les inconnus : la machine a croisé leur nom.
    expect(pages.some((p) => p.includes(' pingouin ?'))).toBeTrue();
  });

  it('ne montre de dialogue ni sur les animaux réservés, ni sur les inconnus d’épreuve', () => {
    const talks = Array.from({ length: 2000 }, () => ' ' + decode(dialogue(rng, { plural: 0.3, unknown: true }).ids).join(' ') + ' ');
    for (const index of NEVER_ASKED) expect(talks.some((t) => t.includes(` ${ANIMALS[index].name} `))).toBeFalse();
    for (const s of STRANGERS.filter((s) => !s.shown)) expect(talks.some((t) => t.includes(` ${s.words[1]} ?`))).toBeFalse();
    expect(talks.some((t) => t.includes(DONT_KNOW.join(' ')))).toBeTrue();
  });

  it('ne note que les répliques de l’assistant', () => {
    for (let n = 0; n < 50; n++) {
      const talk = dialogue(rng, { plural: 0.3, unknown: true }), words = decode(talk.ids);
      expect(talk.learn.length).toBe(words.length - 1);
      // Un mot est noté s'il fait partie d'une réplique : après « <ia> », jusqu'à « <fin> » compris.
      let inside = false;
      const noted = words.map((word) => {
        if (word === BOT) {
          inside = true;
          return false;
        }
        const was = inside;
        if (word === END) inside = false;
        return was;
      });
      talk.learn.forEach((learn, i) => expect(learn).withContext(`${words[i]} → ${words[i + 1]}`).toBe(noted[i + 1] ? 1 : 0));
    }
  });

  it('note juste une réponse exacte, et seulement elle', () => {
    const problem = EXAMS.known[0];
    expect(grade(problem, [...problem.expected, END])).toBe(1);
    expect(grade(problem, problem.expected)).toBe(0);
    expect(grade(problem, [...DONT_KNOW, END])).toBe(0);
    expect(EXAMS.strangers.every((p) => p.expected.join(' ') === DONT_KNOW.join(' '))).toBeTrue();
  });

  it('découpe une question tapée au clavier, sans laisser passer les marques', () => {
    expect(tokenize('Où vit l’ours ?').words).toEqual(['où', 'vit', "l'", 'ours', '?']);
    expect(tokenize('<toi> qui es-tu ?').words).toEqual(['qui', 'es', 'tu', '?']);
    expect(tokenize('<toi> qui es-tu ?').unknown).toEqual(['<toi>']);
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('rend plus probable une réponse que le correcteur récompense', () => {
    // Un modèle neuf ne réussit jamais : on vérifie le sens de la correction sur une réponse imposée.
    const model = new MiniGpt(CONFIG, 2, 0.01), problem = EXAMS.taught[0];
    const before = chance(model, problem);
    const right = [...problem.expected, END];
    let calls = 0;
    // Le dé fait écrire une fois la bonne réponse, puis des réponses au hasard : la bonne est au-dessus de la moyenne.
    const forced = new MiniGpt(CONFIG, 2, 0.01);
    forced.load(model.snapshot());
    spyOn(forced, 'sample').and.callFake(() => (calls++ === 0 ? [...right.map((w) => WORDS.indexOf(w))] : [WORDS.indexOf('.'), WORDS.indexOf(END)]));
    const { notes } = practiseOnce(forced, problem, 4, () => 0.5);
    expect(notes).toEqual([1, 0, 0, 0]);
    expect(chance(forced, problem)).toBeGreaterThan(before);
  });
});
