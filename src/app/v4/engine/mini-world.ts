import { Rng } from './tensor';

// Le mini-monde du dernier chapitre : douze animaux, où ils vivent, ce qu'ils mangent, comment ils se déplacent.
export interface Animal {
  readonly name: string;
  readonly plural: string;
  readonly feminine: boolean;
  readonly habitat: string;
  readonly food: readonly string[];
  readonly move: Move;
}

/** Les verbes de déplacement, au singulier et au pluriel. */
export const MOVES = { court: 'courent', grimpe: 'grimpent', vole: 'volent', nage: 'nagent' } as const;
type Move = keyof typeof MOVES;

export const ANIMALS: readonly Animal[] = [
  { name: 'lion', plural: 'lions', feminine: false, habitat: 'savane', food: ['de', 'la', 'viande'], move: 'court' },
  { name: 'zèbre', plural: 'zèbres', feminine: false, habitat: 'savane', food: ['de', "l'", 'herbe'], move: 'court' },
  { name: 'girafe', plural: 'girafes', feminine: true, habitat: 'savane', food: ['des', 'feuilles'], move: 'court' },
  { name: 'singe', plural: 'singes', feminine: false, habitat: 'jungle', food: ['des', 'fruits'], move: 'grimpe' },
  { name: 'tigre', plural: 'tigres', feminine: false, habitat: 'jungle', food: ['de', 'la', 'viande'], move: 'court' },
  { name: 'perroquet', plural: 'perroquets', feminine: false, habitat: 'jungle', food: ['des', 'graines'], move: 'vole' },
  { name: 'dauphin', plural: 'dauphins', feminine: false, habitat: 'mer', food: ['du', 'poisson'], move: 'nage' },
  { name: 'baleine', plural: 'baleines', feminine: true, habitat: 'mer', food: ['des', 'crevettes'], move: 'nage' },
  { name: 'requin', plural: 'requins', feminine: false, habitat: 'mer', food: ['du', 'poisson'], move: 'nage' },
  { name: 'loup', plural: 'loups', feminine: false, habitat: 'forêt', food: ['de', 'la', 'viande'], move: 'court' },
  { name: 'cerf', plural: 'cerfs', feminine: false, habitat: 'forêt', food: ['de', "l'", 'herbe'], move: 'court' },
  { name: 'chouette', plural: 'chouettes', feminine: true, habitat: 'forêt', food: ['des', 'souris'], move: 'vole' },
];

export const CONTEXT = 24;

// ── Ce qui est tenu à l'écart de l'entraînement, pour pouvoir mesurer une vraie généralisation ──

/** Animaux sur lesquels on ne pose jamais de question directe (« où vit… », « que mange… », « que fait… »). */
export const NEVER_ASKED = [1, 4, 7];
/** Pluriels jamais lus : « les girafes vivent… », « les singes mangent… », « les chouettes volent », etc. */
export const NEVER_PLURAL: readonly (readonly [number, Topic])[] = [[2, 'habitat'], [3, 'food'], [6, 'habitat'], [9, 'food'], [11, 'move'], [8, 'move']];

export type Topic = 'habitat' | 'food' | 'move';
export const TOPICS: readonly Topic[] = ['habitat', 'food', 'move'];
const unreadPlural = (animal: number, topic: Topic) => NEVER_PLURAL.some(([a, t]) => a === animal && t === topic);

// ── Les phrases ──

type Words = string[];
export const subject = (a: Animal, plural: boolean): Words => (plural ? ['les', a.plural] : [a.feminine ? 'la' : 'le', a.name]);
const pronoun = (a: Animal, plural: boolean) => (a.feminine ? 'elle' : 'il') + (plural ? 's' : '');
export const verb = (a: Animal, topic: Topic, plural: boolean) => (topic === 'habitat' ? (plural ? 'vivent' : 'vit') : topic === 'food' ? (plural ? 'mangent' : 'mange') : plural ? MOVES[a.move] : a.move);
const rest = (a: Animal, topic: Topic): Words => (topic === 'habitat' ? ['dans', 'la', a.habitat] : topic === 'food' ? [...a.food] : []);

/** « le lion vit dans la savane . » */
export const states = (a: Animal, topic: Topic, plural: boolean): Words => [...subject(a, plural), verb(a, topic, plural), ...rest(a, topic), '.'];
/** « où vit le lion ? » */
const asks = (a: Animal, topic: Topic, plural: boolean): Words =>
  topic === 'move' ? ['que', plural ? 'font' : 'fait', ...subject(a, plural), '?'] : [topic === 'habitat' ? 'où' : 'que', verb(a, topic, plural), ...subject(a, plural), '?'];
/** « dans la savane . » ou, pour le déplacement, « il court . » */
const answers = (a: Animal, topic: Topic, plural: boolean): Words => (topic === 'move' ? [pronoun(a, plural), verb(a, topic, plural), '.'] : [...rest(a, topic), '.']);
/** « qui vit dans la savane ? le lion . » */
const guesses = (a: Animal, topic: Topic): Words => ['qui', verb(a, topic, false), ...rest(a, topic), '?', ...subject(a, false), '.'];

export interface Case {
  readonly prompt: Words;
  readonly answer: Words;
  /** Épreuve d'accord : le premier mot doit être mieux noté que le second. */
  readonly prefer?: readonly [string, string];
}

/** Un texte d'entraînement : deux ou trois phrases sur le monde, affirmations ou questions-réponses. */
export function trainingText(rng: Rng): Words {
  const text: Words = [];
  for (let tries = 0; tries < 12 && text.length < CONTEXT - 5; tries++) {
    const index = rng.int(ANIMALS.length), a = ANIMALS[index], topic = TOPICS[rng.int(3)], plural = rng.next() < 0.4, kind = rng.int(3);
    if (kind < 2 && plural && unreadPlural(index, topic)) continue;
    if (kind === 1 && NEVER_ASKED.includes(index)) continue;
    const sentence = kind === 0 ? states(a, topic, plural) : kind === 1 ? [...asks(a, topic, plural), ...answers(a, topic, plural)] : guesses(a, topic);
    if (text.length + sentence.length <= CONTEXT) text.push(...sentence);
  }
  return text;
}

export type Skill = 'question' | 'accord' | 'fil';

/**
 * Les épreuves. 'question' et 'accord' ne contiennent que des cas absents de l'entraînement.
 * 'fil' pose une question juste après une phrase sur un autre animal : il faut ne pas les mélanger.
 */
export function exam(skill: Skill): Case[] {
  if (skill === 'fil') {
    const rng = new Rng(8), cases: Case[] = [];
    while (cases.length < 60) {
      const first = rng.int(ANIMALS.length), second = rng.int(ANIMALS.length), a = ANIMALS[first], b = ANIMALS[second];
      const told = TOPICS[rng.int(3)], asked = TOPICS[rng.int(3)], plural = rng.next() < 0.4;
      if (NEVER_ASKED.includes(second) || (plural && unreadPlural(second, asked)) || unreadPlural(first, told)) continue;
      // La bonne réponse doit différer de celle qu'on donnerait pour l'animal de la première phrase.
      if (answers(a, asked, plural).join(' ') === answers(b, asked, plural).join(' ')) continue;
      cases.push({ prompt: [...states(a, told, false), ...asks(b, asked, plural)], answer: answers(b, asked, plural) });
    }
    return cases;
  }
  if (skill === 'question')
    return NEVER_ASKED.flatMap((i) => TOPICS.flatMap((topic) => [false, true].map((plural) => ({ prompt: asks(ANIMALS[i], topic, plural), answer: answers(ANIMALS[i], topic, plural) }))));
  return NEVER_PLURAL.flatMap(([i, topic]) => {
    const a = ANIMALS[i], full = states(a, topic, true), agreed = { prompt: subject(a, true), answer: [full[2]], prefer: [verb(a, topic, true), verb(a, topic, false)] as const };
    // Pour l'habitat et la nourriture, on vérifie aussi que la suite de la phrase reste juste.
    return topic === 'move' ? [agreed] : [agreed, { prompt: full.slice(0, topic === 'habitat' ? 5 : 3), answer: full.slice(topic === 'habitat' ? 5 : 3) }];
  });
}

/** Toutes les phrases vraies de ce monde, y compris celles que l'entraînement ne montre jamais. */
const TRUTHS = new Set(
  ANIMALS.flatMap((a) => TOPICS.flatMap((topic) => [guesses(a, topic), ...[false, true].flatMap((plural) => [states(a, topic, plural), [...asks(a, topic, plural), ...answers(a, topic, plural)]])])).map((words) => words.join(' ')),
);
export const isTrue = (words: readonly string[]): boolean => TRUTHS.has(words.join(' '));

const ANIMAL_WORDS = new Set(ANIMALS.flatMap((a) => [a.name, a.plural]));
const VERB_WORDS = new Set<string>(['vit', 'vivent', 'mange', 'mangent', 'fait', 'font', ...Object.entries(MOVES).flat()]);
const PLACE_WORDS = new Set(ANIMALS.flatMap((a) => [a.habitat, a.food[a.food.length - 1]]));

/** La famille d'un mot, pour décrire ce qu'un regard va chercher. */
export function kindOf(word: string): string {
  if (ANIMAL_WORDS.has(word)) return 'l’animal';
  if (VERB_WORDS.has(word)) return 'le verbe';
  if (PLACE_WORDS.has(word)) return 'un lieu ou une nourriture';
  if (word === 'où' || word === 'que' || word === 'qui') return 'le mot interrogatif';
  if (word === '.' || word === '?') return 'la ponctuation';
  if (word === 'il' || word === 'elle' || word === 'ils' || word === 'elles') return 'un pronom';
  return 'les petits mots (le, la, dans…)';
}

/** Les mots par lesquels une phrase de ce monde peut commencer. */
export const OPENERS = ['le', 'la', 'les', 'où', 'que', 'qui'] as const;

// ── Vocabulaire ──

export const WORDS: readonly string[] = [...new Set([
  '.', '?', 'le', 'la', 'les', "l'", 'du', 'de', 'des', 'dans', 'où', 'que', 'qui', 'vit', 'vivent', 'mange', 'mangent', 'fait', 'font', 'il', 'elle', 'ils', 'elles',
  ...Object.entries(MOVES).flat(),
  ...ANIMALS.flatMap((a) => [a.name, a.plural, a.habitat, ...a.food]),
])];

const INDEX = new Map(WORDS.map((word, id) => [word, id]));
export const encode = (words: readonly string[]): number[] => words.map((word) => INDEX.get(word)!);
export const decode = (ids: readonly number[]): string[] => ids.map((id) => WORDS[id]);

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const LOOSE = new Map(WORDS.map((word) => [plain(word), word]));

/** Découpe un texte tapé au clavier. Les mots hors vocabulaire sont renvoyés à part. */
export function tokenize(text: string): { words: string[]; unknown: string[] } {
  const pieces = text.replace(/’/g, "'").replace(/([?.])/g, ' $1 ').replace(/\bl'/gi, "l' ").split(/\s+/).filter(Boolean);
  const words: string[] = [], unknown: string[] = [];
  for (const piece of pieces) {
    const word = LOOSE.get(plain(piece));
    if (word) words.push(word);
    else unknown.push(piece);
  }
  return { words, unknown };
}

/** Remet des mots en phrase lisible. */
export function sentence(words: readonly string[]): string {
  return words.join(' ').replace(/l' /g, 'l’').replace(/ \./g, '.');
}
