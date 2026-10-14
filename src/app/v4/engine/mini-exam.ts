import { Cut, MiniConfig, MiniGpt } from './mini-gpt';
import { CONTEXT, Case, OPENERS, WORDS, decode, encode, exam, isTrue } from './mini-world';
import { Rng } from './tensor';

// Les quatre mesures du mini-GPT, partagées par le script d'entraînement et par la page.
export const SKILLS = [
  { key: 'vérité', label: 'Écrire des phrases vraies', unseen: false },
  { key: 'fil', label: 'Répondre sans mélanger deux phrases', unseen: false },
  { key: 'question', label: 'Répondre à une question jamais posée', unseen: true },
  { key: 'accord', label: 'Accorder une phrase jamais lue', unseen: true },
] as const;

const EXAMS = { fil: exam('fil'), question: exam('question'), accord: exam('accord') };
const SENTENCES = 150;

/** Nombre de cas derrière chaque mesure, pour lire « 89 % » comme « 16 sur 18 ». */
export const TRIALS: Record<string, number> = { vérité: SENTENCES, fil: EXAMS.fil.length, question: EXAMS.question.length, accord: EXAMS.accord.length };

/** Part des épreuves réussies, en complétant chaque fois avec le mot le mieux noté. */
export function grade(model: MiniGpt, cases: readonly Case[], cut: Cut = {}): number {
  let right = 0;
  for (const c of cases) {
    if (c.prefer) {
      const scores = model.scores(encode(c.prompt), cut), [good, bad] = encode(c.prefer);
      if (scores[good] > scores[bad]) right++;
      continue;
    }
    const got = model.complete(encode(c.prompt), c.answer.length, cut), want = encode(c.answer);
    if (want.every((id, i) => got[i] === id)) right++;
  }
  return right / cases.length;
}

/** Laisse la machine écrire librement, en tirant chaque mot selon ses probabilités, et compte les phrases vraies. */
export function truthful(model: MiniGpt, count = SENTENCES, cut: Cut = {}): number {
  const dice = new Rng(4242);
  let right = 0;
  for (let n = 0; n < count; n++) {
    const text = encode([OPENERS[n % OPENERS.length]]);
    while (text.length < 14 && WORDS[text[text.length - 1]] !== '.') {
      const probs = model.probabilities(text, cut);
      let draw = dice.next(), id = 0;
      while (id < probs.length - 1 && draw > probs[id]) draw -= probs[id++];
      text.push(id);
    }
    if (isTrue(decode(text))) right++;
  }
  return right / count;
}

/** Les quatre mesures. sentences = 0 : on saute l'écriture libre, la plus longue à mesurer. */
export function measure(model: MiniGpt, cut: Cut = {}, sentences = SENTENCES): Record<string, number> {
  const answers = { fil: grade(model, EXAMS.fil, cut), question: grade(model, EXAMS.question, cut), accord: grade(model, EXAMS.accord, cut) };
  return sentences ? { vérité: truthful(model, sentences, cut), ...answers } : answers;
}

// ── La construction pièce par pièce : six modèles, chacun avec une pièce de plus que le précédent ──

const FULL: MiniConfig = { vocab: WORDS.length, context: CONTEXT, width: 48, layers: 3, heads: 2, hidden: 96 };

export interface Rung {
  readonly key: string;
  readonly config: MiniConfig;
}

export const LADDER: readonly Rung[] = [
  { key: 'dernier-mot', config: { ...FULL, layers: 0, heads: 1, hidden: 0, positions: false } },
  { key: 'un-regard', config: { ...FULL, layers: 1, heads: 1, hidden: 0, positions: false } },
  { key: 'places', config: { ...FULL, layers: 1, heads: 1, hidden: 0 } },
  { key: 'neurones', config: { ...FULL, layers: 1, heads: 1 } },
  { key: 'deux-regards', config: { ...FULL, layers: 1 } },
  { key: 'trois-couches', config: FULL },
];

/** Le modèle complet sans remise à l'échelle, pour mesurer ce qu'elle apporte. */
export const UNSCALED: Rung = { key: 'sans-echelle', config: { ...FULL, norm: false } };
