import { MiniConfig, MiniGpt } from './mini-gpt';
import { ANIMALS, Animal, NEVER_ASKED, TOPICS, Topic, WORDS as WORLD_WORDS, states, subject } from './mini-world';
import { Rng } from './tensor';

// Le monde du chapitre « L'assistant » : les mêmes douze animaux, mais trois entraînements successifs,
// comme pour un vrai assistant. Le manuel d'abord (des textes), puis des exercices corrigés (des dialogues),
// puis des exercices notés (des essais et une note, sans corrigé).

/** Les marques d'une conversation : qui parle, et quand l'assistant a fini. */
export const USER = '<toi>', BOT = '<ia>', END = '<fin>';
export const DONT_KNOW = ['je', 'ne', 'sais', 'pas', '.'];
export const WHO_ASK = ['qui', 'es', 'tu', '?'];
export const WHO_ANSWER = ['je', 'suis', 'un', 'assistant', '.'];

/** Des choses dont ce monde ne sait rien. Les premières servent d'exemples de « je ne sais pas » ; les dernières, jamais montrées, servent d'épreuve. */
interface Stranger {
  readonly words: readonly string[];
  readonly shown: boolean;
}
export const STRANGERS: readonly Stranger[] = [
  { words: ["l'", 'ours'], shown: true },
  { words: ['le', 'renard'], shown: true },
  { words: ['le', 'panda'], shown: true },
  { words: ['le', 'koala'], shown: true },
  { words: ["l'", 'aigle'], shown: true },
  { words: ['le', 'lapin'], shown: true },
  { words: ['le', 'cheval'], shown: true },
  { words: ['le', 'canard'], shown: true },
  { words: ['la', 'tortue'], shown: true },
  { words: ['la', 'vache'], shown: true },
  // Ce monde ne connaît la souris et le poisson que comme nourriture : il ignore où ils vivent.
  { words: ['la', 'souris'], shown: true },
  { words: ['le', 'pingouin'], shown: false },
  { words: ['le', 'chameau'], shown: false },
  { words: ['le', 'hibou'], shown: false },
  { words: ['le', 'poisson'], shown: false },
];

export const WORDS: readonly string[] = [
  ...new Set([...WORLD_WORDS, USER, BOT, END, ...DONT_KNOW, ...WHO_ASK, ...WHO_ANSWER, ...STRANGERS.flatMap((s) => s.words)]),
];
export const CONTEXT = 32;
export const CONFIG: MiniConfig = { vocab: WORDS.length, context: CONTEXT, width: 48, layers: 3, heads: 2, hidden: 96 };

const INDEX = new Map(WORDS.map((word, id) => [word, id]));
export const encode = (words: readonly string[]): number[] => words.map((word) => INDEX.get(word)!);
export const decode = (ids: readonly number[]): string[] => ids.map((id) => WORDS[id]);

type Words = string[];

/** « où vit le lion ? », pour n'importe quel sujet. */
function question(who: readonly string[], topic: Topic, plural: boolean): Words {
  if (topic === 'move') return ['que', plural ? 'font' : 'fait', ...who, '?'];
  return [topic === 'habitat' ? 'où' : 'que', topic === 'habitat' ? (plural ? 'vivent' : 'vit') : plural ? 'mangent' : 'mange', ...who, '?'];
}
export const askAnimal = (a: Animal, topic: Topic, plural: boolean): Words => question(subject(a, plural), topic, plural);

// ── 1. Le manuel : des textes, comme ceux du web ──

/**
 * Un document du premier entraînement. Surtout des pages d'encyclopédie, chacune consacrée à un animal
 * (son nom revient donc d'une phrase à l'autre), et quelques pages de quiz : des listes de questions, sans les réponses.
 * Les quiz citent aussi les inconnus : la machine a croisé leur nom, jamais un fait sur eux.
 */
export function baseText(rng: Rng): Words {
  const text: Words = [];
  if (rng.next() < 0.3) {
    for (let tries = 0; tries < 12 && text.length < CONTEXT - 6; tries++) {
      // Les quiz citent aussi des animaux dont aucune page ne parle : le nom est connu, pas les faits.
      const stranger = rng.next() < 0.25 ? STRANGERS[rng.int(STRANGERS.length)] : null;
      const sentence = stranger ? question(stranger.words, TOPICS[rng.int(3)], false) : askAnimal(ANIMALS[rng.int(ANIMALS.length)], TOPICS[rng.int(3)], rng.next() < 0.4);
      if (text.length + sentence.length <= CONTEXT) text.push(...sentence);
    }
    return text;
  }
  for (let page = 0; page < 3 && text.length < CONTEXT - 6; page++) {
    const a = ANIMALS[rng.int(ANIMALS.length)], topics = [...TOPICS].sort(() => rng.next() - 0.5), count = 1 + rng.int(3);
    for (const topic of topics.slice(0, count)) {
      const sentence = states(a, topic, rng.next() < 0.4);
      if (text.length + sentence.length > CONTEXT) return text;
      text.push(...sentence);
    }
  }
  return text;
}

// ── 2. Les exercices corrigés : des dialogues ──

export interface Dialogue {
  readonly ids: number[];
  /** Pour chaque mot (sauf le dernier), 1 si le mot suivant est à apprendre : seules les réponses de l'assistant comptent. */
  readonly learn: number[];
}

/** Une question et sa bonne réponse, pour un sujet du monde ou un inconnu. */
interface Exchange {
  readonly ask: Words;
  readonly answer: Words;
}

/** Les animaux dont on montre des dialogues. Les trois autres (zèbre, tigre, baleine) n'apparaissent que dans le manuel. */
const TAUGHT = ANIMALS.map((_, i) => i).filter((i) => !NEVER_ASKED.includes(i));

export interface Lessons {
  /** Part des questions posées au pluriel. */
  readonly plural: number;
  /** Montrer des « je ne sais pas ». */
  readonly unknown: boolean;
  /** Parler des douze animaux, et pas seulement des neuf du premier assistant. */
  readonly all?: boolean;
}

function exercise(rng: Rng, lessons: Lessons): Exchange {
  const roll = rng.next();
  if (roll < 0.08) return { ask: WHO_ASK, answer: WHO_ANSWER };
  if (lessons.unknown && roll < 0.3) {
    const shown = STRANGERS.filter((s) => s.shown), who = shown[rng.int(shown.length)];
    return { ask: question(who.words, TOPICS[rng.int(3)], false), answer: DONT_KNOW };
  }
  const pool = lessons.all ? ANIMALS.map((_, i) => i) : TAUGHT, a = ANIMALS[pool[rng.int(pool.length)]], topic = TOPICS[rng.int(3)], plural = rng.next() < lessons.plural;
  return { ask: askAnimal(a, topic, plural), answer: states(a, topic, plural) };
}

/** Un dialogue d'une ou deux questions, mis à plat comme la machine le lit. */
export function dialogue(rng: Rng, lessons: Lessons): Dialogue {
  const words: Words = [], learn: number[] = [];
  for (let turn = 0; turn < 2; turn++) {
    const { ask, answer } = exercise(rng, lessons), said = [USER, ...ask, BOT], replied = [...answer, END];
    if (turn && (words.length + said.length + replied.length > CONTEXT || rng.next() < 0.5)) break;
    words.push(...said);
    learn.push(...said.map(() => 0));
    words.push(...replied);
    learn.push(...replied.map(() => 1));
  }
  // learn[i] concerne la devinette du mot i : on décale d'un cran (le premier mot n'est jamais deviné).
  return { ids: encode(words), learn: learn.slice(1) };
}

// ── Faire parler la machine ──

/** Ce que l'assistant répond à une question : on lui donne la conversation jusqu'à « <ia> », il écrit jusqu'à « <fin> ». */
export function reply(model: MiniGpt, ask: readonly string[], draw?: () => number): Words {
  const prompt = encode([USER, ...ask, BOT]), stop = INDEX.get(END)!, room = CONTEXT - prompt.length;
  const out = draw ? model.sample(prompt, Math.min(10, room), draw, stop) : greedy(model, prompt, Math.min(10, room), stop);
  return decode(out);
}

/** Ce que fait un modèle de base d'une question : il continue le texte, sans marques de conversation. */
export function continueText(model: MiniGpt, words: readonly string[], count = 10): Words {
  return decode(greedy(model, encode(words), count, -1));
}

function greedy(model: MiniGpt, prompt: number[], count: number, stop: number): number[] {
  const text = [...prompt];
  for (let n = 0; n < count && text.length < CONTEXT; n++) {
    const scores = model.scores(text);
    let best = 0;
    for (let j = 1; j < scores.length; j++) if (scores[j] > scores[best]) best = j;
    text.push(best);
    if (best === stop) break;
  }
  return text.slice(prompt.length);
}

// ── 3. Les exercices notés : un correcteur, pas de corrigé ──

/** La bonne réponse attendue, quand elle existe dans ce monde ; null pour un inconnu. */
export interface Problem {
  readonly ask: Words;
  readonly expected: Words;
}

/** Note une réponse : 1 si elle est juste (fin comprise), 0 sinon. Le correcteur connaît le monde, l'élève ne voit que la note. */
export function grade(problem: Problem, answer: readonly string[]): number {
  return answer.join(' ') === [...problem.expected, END].join(' ') ? 1 : 0;
}

const animalProblems = (indices: readonly number[], plurals: readonly boolean[]): Problem[] =>
  indices.flatMap((i) => TOPICS.flatMap((topic) => plurals.map((plural) => ({ ask: askAnimal(ANIMALS[i], topic, plural), expected: states(ANIMALS[i], topic, plural) }))));
const strangerProblems = (shown: boolean): Problem[] =>
  STRANGERS.filter((s) => s.shown === shown).flatMap((s) => TOPICS.map((topic) => ({ ask: question(s.words, topic, false), expected: DONT_KNOW })));

/** Les épreuves du chapitre. Chacune dit ce qu'elle mesure, et sur combien de questions. */
export const EXAMS = {
  /** Questions sur les animaux des dialogues, au singulier. */
  taught: animalProblems(TAUGHT, [false]),
  /** Les mêmes, au pluriel. */
  taughtPlural: animalProblems(TAUGHT, [true]),
  /** Zèbre, tigre, baleine : jamais dans un dialogue, seulement dans le manuel. */
  known: animalProblems(NEVER_ASKED, [false]),
  knownPlural: animalProblems(NEVER_ASKED, [true]),
  /** Les inconnus dont on a montré un « je ne sais pas ». */
  strangersShown: strangerProblems(true),
  /** Les inconnus jamais montrés : pingouin, chameau, hibou, poisson. */
  strangers: strangerProblems(false),
  who: [{ ask: WHO_ASK, expected: WHO_ANSWER }],
};

export type ExamKey = keyof typeof EXAMS;

/** Part des questions réussies, en prenant chaque fois le mot le mieux noté. */
export function score(model: MiniGpt, problems: readonly Problem[]): number {
  return problems.filter((p) => grade(p, reply(model, p.ask))).length / problems.length;
}

/** Part des questions sur de vrais animaux auxquelles il répond « je ne sais pas » : le prix de la prudence. */
export function refusals(model: MiniGpt): number {
  const real = [...EXAMS.taught, ...EXAMS.known, ...EXAMS.taughtPlural, ...EXAMS.knownPlural];
  return real.filter((p) => reply(model, p.ask).join(' ') === [...DONT_KNOW, END].join(' ')).length / real.length;
}


/** Part des bonnes réponses quand il tire ses mots au sort, comme un assistant en service : plusieurs essais par question. */
export function sampled(model: MiniGpt, problems: readonly Problem[], tries: number, draw: () => number): number {
  let right = 0;
  for (const p of problems) for (let k = 0; k < tries; k++) right += grade(p, reply(model, p.ask, draw));
  return right / (problems.length * tries);
}

/** La probabilité exacte qu'il écrive la bonne réponse en tirant ses mots au sort : le produit des probabilités de chaque mot. */
export function chance(model: MiniGpt, problem: Problem): number {
  const text = encode([USER, ...problem.ask, BOT]), want = encode([...problem.expected, END]);
  let odds = 1;
  for (const id of want) {
    odds *= model.probabilities(text)[id];
    text.push(id);
  }
  return odds;
}

/** Un pas d'exercices notés : des essais, leurs notes, et une correction qui pousse vers les essais réussis. */
export function practiseOnce(model: MiniGpt, problem: Problem, tries: number, draw: () => number): { answers: Words[]; notes: number[] } {
  const prompt = encode([USER, ...problem.ask, BOT]), answers = Array.from({ length: tries }, () => reply(model, problem.ask, draw));
  const notes = answers.map((a) => grade(problem, a)), mean = notes.reduce((a, b) => a + b, 0) / tries;
  const texts: number[][] = [], weights: number[][] = [];
  answers.forEach((answer, k) => {
    const advantage = notes[k] - mean;
    if (!advantage) return;
    const ids = [...prompt, ...encode(answer)];
    texts.push(ids);
    weights.push(ids.slice(1).map((_, i) => (i + 1 >= prompt.length ? advantage / tries : 0)));
  });
  if (texts.length) model.trainStep(texts, weights);
  return { answers, notes };
}

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const LOOSE = new Map(WORDS.map((word) => [plain(word), word]));

/** Découpe une question tapée au clavier. Les mots hors vocabulaire sont renvoyés à part. */
export function tokenize(text: string): { words: string[]; unknown: string[] } {
  const pieces = text.replace(/’/g, "'").replace(/([?.])/g, ' $1 ').replace(/\bl'/gi, "l' ").replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const words: string[] = [], unknown: string[] = [];
  for (const piece of pieces) {
    const word = LOOSE.get(plain(piece));
    if (word && !word.startsWith('<')) words.push(word);
    else unknown.push(piece);
  }
  return { words, unknown };
}
