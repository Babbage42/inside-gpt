import { Component, computed, output, signal } from '@angular/core';
import { Chapter, big, pct } from '../shared';
import { MiniConfig, MiniGpt } from '../engine/mini-gpt';
import {
  BOT,
  CONFIG,
  DONT_KNOW,
  END,
  EXAMS,
  Problem,
  USER,
  baseText,
  chance,
  continueText,
  decode,
  dialogue,
  practiseOnce,
  reply,
  tokenize,
} from '../engine/assistant-world';
import { Rng } from '../engine/tensor';

type Scores = Readonly<Record<string, number>>;

interface Summary {
  readonly config: MiniConfig;
  readonly parameters: number;
  readonly steps: number;
  readonly report: readonly { readonly step: number; readonly scores: Scores }[];
}

interface Loaded {
  /** Les réglages finaux, pour les modèles qu'on fait parler ; les autres ne servent que par leurs mesures. */
  readonly model: MiniGpt;
  readonly summary: Summary;
  readonly first: Scores;
  readonly last: Scores;
}

const NAMES = ['base', 'dialogues', 'prudent', 'recompense', 'sans-pluriel-recompense'] as const;
type Name = (typeof NAMES)[number];

/** Les questions de départ, pour le modèle de base et pour l'assistant. */
const ASKS = ['où vit le zèbre ?', 'que mange la baleine ?', 'que font les tigres ?', 'qui es tu ?'];
/** Ce que le modèle de base sait, s'il est pris au mot : une phrase à finir. */
const KNOWS = 'le zèbre vit dans la';
/** Des questions sur des animaux que ce monde ne connaît que de nom. Aucun « je ne sais pas » n'a été montré à leur sujet. */
const UNKNOWN = ['où vit le pingouin ?', 'que mange le chameau ?', 'que fait le hibou ?', 'où vit le poisson ?'];
/** Les questions de l'exercice noté en direct : l'assistant y hésite encore quand il tire ses mots au sort. */
const LIVE: readonly string[] = ['que font les dauphins ?', 'que font les singes ?', 'où vivent les cerfs ?'];
/** Pas de correction de l'exercice en direct : plus grand qu'à l'entraînement, pour que l'effet se voie en quelques tours. */
const LIVE_LR = 0.002;
const TRIES = 8;

const times = (count: number, total: number) => `${count} fois sur ${total}`;

/** La bonne réponse d'une question de ce monde, cherchée dans les épreuves. */
function problemOf(ask: string): Problem {
  const all = Object.values(EXAMS).flat();
  return all.find((p) => p.ask.join(' ') === ask)!;
}

@Component({
  selector: 'v4-ch-assistant',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 11 · L’assistant</p>
      <h1>De la machine à deviner, <em>à l’assistant</em></h1>
      <p class="lede">Le mini-GPT des chapitres 9 et 10 répondait aux questions parce que ses textes en contenaient, suivies de leur réponse. Une machine qui vient de lire le web, elle, ne répond pas : elle continue. Entre elle et ChatGPT, il manque deux entraînements. Construisons-les.</p>
    </header>

    <section class="moment">
      <div class="prose">
        <h2>Un manuel en trois parties</h2>
        <p>Pense à un manuel scolaire. Il contient <strong>le cours</strong>, des <strong>exercices corrigés</strong>, et des <strong>exercices à faire seul</strong>, qu’on rend pour avoir une note.</p>
        <p>On fabrique un assistant exactement dans cet ordre. Les dix premiers chapitres ne parlaient que de la première partie : lire, encore et encore, en devinant le mot suivant. Il reste les deux autres.</p>
        <p class="aside">Cette image est celle d’Andrej Karpathy, l’un des fondateurs d’OpenAI, dans sa vidéo d’explication de ChatGPT.</p>
      </div>
      <div class="stage">
        <ol class="manual">
          @for (part of parts; track part.title; let i = $index) {
            <li [class.on]="stage() === i" [class.done]="stage() > i">
              <small>{{ part.kicker }}</small>
              <strong>{{ part.title }}</strong>
              <span>{{ part.text }}</span>
            </li>
          }
        </ol>
      </div>
    </section>

    @if (failed()) {
      <section class="moment solo"><div class="takeaway"><p>Les modèles de ce chapitre sont introuvables. Lance <code>npm run train:assistant</code> (une vingtaine de minutes), puis recharge la page.</p></div></section>
    } @else if (!ready()) {
      <section class="moment solo"><p class="hint">Chargement des modèles…</p></section>
    } @else {
      <section class="moment" id="assistant-base">
        <div class="prose">
          <h2>1. Le cours : une machine qui continue</h2>
          <p>Voici un nouveau mini-GPT, du même plan que celui du chapitre 9. Il a lu {{ big(models().base.summary.steps * 16) }} pages sur nos douze animaux. Des pages d’encyclopédie, chacune consacrée à un animal, et des pages de quiz : des listes de questions, <strong>sans les réponses</strong>. Comme sur le web.</p>
          <p class="do">Pose-lui une question.</p>
          <div class="controls">
            @for (ask of asks; track ask) { <button type="button" [class.primary]="baseAsk() === ask" (click)="baseAsk.set(ask)">{{ ask }}</button> }
          </div>
          <p class="note">Il ne répond pas : <strong>il continue la page</strong>. Dans ses textes, une question est suivie… d’une autre question. Il fait ce qu’il a toujours fait : deviner la suite la plus plausible.</p>
          <p>Pourtant, il sait. Donne-lui le début d’une phrase d’encyclopédie : « {{ knows }} » → <strong>{{ knowsAnswer() }}</strong>.</p>
          @if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'assistant-talk')">Il sait, mais il ne répond pas. Que faire ?</button> }
        </div>
        <div class="stage">
          <p class="tiny">Deux pages qu’il a lues</p>
          @for (page of pages(); track $index) { <p class="page">{{ page }}</p> }
          <div class="controls"><button type="button" (click)="batch.set(batch() + 1)">D’autres pages</button></div>
          <div class="exercise">
            <p><span class="tiny">Tu écris</span>{{ baseAsk() }}</p>
            <p><span class="tiny">Il continue</span><strong>{{ baseAnswer() }}</strong></p>
          </div>
        </div>
      </section>

      @if (step() >= 1) {
        <section class="moment" id="assistant-talk">
          <div class="prose">
            <h2>2. Les exercices corrigés : des dialogues</h2>
            <p>Pour la machine, une conversation n’est qu’un texte. On ajoute trois mots à son vocabulaire : <span class="mark user">{{ user }}</span> annonce ta question, <span class="mark bot">{{ bot }}</span> sa réponse, <span class="mark end">{{ end }}</span> la fin de sa réponse.</p>
            <p>Puis on reprend l’entraînement, sur des dialogues écrits à l’avance, avec un détail : <strong>on ne note que ses répliques</strong>. Deviner ta question n’est pas son travail.</p>
            <p>{{ big(models().dialogues.summary.steps) }} pas suffisent, quelques dizaines de secondes. On glisse aussi quelques pages du cours, pour qu’il n’oublie pas ce qu’il a lu.</p>
            <p class="do">Pose les mêmes questions à l’assistant.</p>
            <div class="controls">
              @for (ask of asks; track ask) { <button type="button" [class.primary]="talkAsk() === ask" (click)="talkAsk.set(ask)">{{ ask }}</button> }
            </div>
            <div class="prompt-row short">
              <input type="text" [value]="own()" (input)="own.set($any($event.target).value)" placeholder="Ta question, avec ses mots" aria-label="Ta question" spellcheck="false" />
            </div>
            @if (ownWords().unknown.length) { <p class="hint">Mots inconnus de cette machine, ignorés : {{ ownWords().unknown.join(', ') }}.</p> }
          </div>
          <div class="stage">
            <p class="tiny">Un dialogue d’entraînement, tel qu’il le lit · en couleur, ce qui est noté</p>
            <p class="talk">
              @for (chip of sample(); track $index) { <span [class.user]="chip.word === user" [class.bot]="chip.word === bot" [class.end]="chip.word === end" [class.learn]="chip.learn">{{ chip.word }}</span> }
            </p>
            <div class="controls"><button type="button" (click)="batch.set(batch() + 1)">Un autre dialogue</button></div>
            <div class="exercise">
              <p><span class="tiny">La machine lit</span><span class="talk inline"><span class="user">{{ user }}</span> {{ talkShown() }} <span class="bot">{{ bot }}</span></span></p>
              <p><span class="tiny">L’assistant répond</span><strong>{{ talkAnswer() }}</strong></p>
            </div>
          </div>
        </section>

        <section class="moment solo">
          <div class="insight">
            <h2>Aucun « module de dialogue »</h2>
            <p>Les dialogues ne parlent jamais du zèbre, du tigre ni de la baleine. Pourtant, interrogé sur eux au singulier, il répond juste {{ tally('dialogues', 'known') }}. Ce savoir vient du cours. Les exercices corrigés ne lui ont appris que <strong>la façon de répondre</strong> : reprendre le sujet de ta question, puis écrire la phrase qu’il connaît.</p>
            <p>Trois mots de plus, et d’autres exemples. C’est tout ce qui sépare une machine à deviner d’un assistant.</p>
          </div>
        </section>

        <section class="moment solo">
          <aside class="everyday">
            <p class="tiny">Dans ChatGPT</p>
            <h3>Qui est « je » quand il dit « je suis un assistant » ?</h3>
            <p>Personne. Demande « qui es tu ? » à ce mini-assistant : il répond « {{ who() }} », parce que cette réplique figure dans ses exercices corrigés, comme les autres. Un grand assistant sait son nom pour la même raison, ou parce que l’application le lui écrit au début de chaque conversation. Ce n’est pas un souvenir de soi : c’est la suite la plus plausible.</p>
          </aside>
        </section>

        @if (step() === 1) {
          <section class="moment solo"><button type="button" class="primary" (click)="reveal(2, 'assistant-unknown')">Et s’il ne sait pas ?</button></section>
        }
      }

      @if (step() >= 2) {
        <section class="moment" id="assistant-unknown">
          <div class="prose">
            <h2>Il invente, avec aplomb</h2>
            <p>Le pingouin, le chameau, le hibou : il a croisé leur nom dans des quiz, jamais une page sur eux. Le poisson, il ne le connaît que comme nourriture. Que répond l’assistant ?</p>
            <p>Il invente. Ses exercices corrigés lui ont appris qu’à une question, <strong>on répond par une affirmation</strong>. Il en écrit donc une, plausible, et fausse. Au chapitre 10 déjà, la machine répondait avec aplomb à « où vit le poisson ? ».</p>
            <p>Le remède est encore un exercice corrigé. On ajoute des dialogues où la bonne réponse est « je ne sais pas », sur d’autres inconnus : l’ours, le renard, la tortue… Jamais sur ceux du tableau. Et cette fois, les dialogues parlent des douze animaux : pour apprendre à distinguer ce qu’il sait de ce qu’il ignore, il doit voir les deux.</p>
            <p>Sur les inconnus jamais montrés, il dit maintenant « je ne sais pas » {{ tally('prudent', 'strangers') }}, contre {{ tally('dialogues', 'strangers') }} avant. Et sur de vrais animaux, il refuse à tort {{ refusals('prudent') }}.</p>
            <p class="aside">Un premier essai nous l’a appris à nos dépens : quand les dialogues ne parlaient que de neuf animaux, il répondait « je ne sais pas » sur le zèbre, qu’il connaissait pourtant. Il avait retenu « animal absent des dialogues », au lieu de « animal dont je ne sais rien ». Les vrais assistants cherchent le même équilibre, entre inventer et se dérober.</p>
          </div>
          <div class="stage">
            <table class="compare answers">
              <thead><tr><th>Tu demandes</th><th>Sans ces exemples</th><th>Avec</th></tr></thead>
              <tbody>
                @for (row of unknownRows(); track row.ask) {
                  <tr><th>{{ row.ask }}</th><td class="bad">{{ row.before }}</td><td [class.good]="row.careful">{{ row.after }}</td></tr>
                }
              </tbody>
            </table>
            <p class="hint">Réponses calculées à l’instant par les deux assistants, en prenant chaque fois le mot le plus probable.</p>
          </div>
        </section>

        @if (step() === 2) {
          <section class="moment solo"><button type="button" class="primary" (click)="reveal(3, 'assistant-reward')">Et les exercices à faire seul ?</button></section>
        }
      }

      @if (step() >= 3) {
        <section class="moment" id="assistant-reward">
          <div class="prose">
            <h2>3. Les exercices notés : la récompense</h2>
            <p>Un assistant ne prend pas toujours le mot le plus probable : il <strong>tire au sort</strong>, comme au chapitre 2. Alors il lui arrive de se tromper sur une question qu’il connaît.</p>
            <p>Dernier entraînement, sans aucun corrigé. On lui pose une question, il essaie {{ tries }} fois, et un correcteur note chaque essai : 1 s’il est juste, 0 sinon. On tourne ensuite ses boutons pour rendre les essais réussis <strong>plus probables</strong>, et les ratés moins.</p>
            <p class="do">Fais-le toi-même, un tour à la fois.</p>
            <div class="controls">
              @for (ask of live; track ask) { <button type="button" [class.primary]="liveAsk() === ask" (click)="choose(ask)">{{ ask }}</button> }
            </div>
            <div class="controls">
              <button type="button" class="primary" (click)="practise()">Faire essayer et noter</button>
              <button type="button" [disabled]="!rounds().length" (click)="choose(liveAsk())">Recommencer</button>
            </div>
            <p class="note">Chance qu’il écrive la bonne réponse : <strong>{{ pct(liveChance()) }}</strong>{{ progress() }}.</p>
            <p class="aside">Quand tous ses essais ratent, ou tous réussissent, aucun ne fait mieux que les autres : la note n’indique aucune direction, et rien ne bouge. Ici, chaque correction est plus forte qu’à l’entraînement, pour que l’effet se voie en quelques tours ; il arrive donc qu’un tour recule.</p>
          </div>
          <div class="stage">
            <p class="tiny">Ses essais pour « {{ liveAsk() }} »</p>
            @if (rounds().length) {
              <ul class="probes tries">
                @for (attempt of lastRound(); track $index) { <li [class.right]="attempt.note"><span>{{ attempt.text }}</span><i>{{ attempt.note ? '1' : '0' }}</i></li> }
              </ul>
              <p class="tiny">Chance de la bonne réponse, tour après tour</p>
              <svg class="spark tall" viewBox="0 0 200 60" preserveAspectRatio="none" aria-label="Chance de la bonne réponse, tour après tour"><polyline [attr.points]="liveCurve()" /></svg>
            } @else {
              <p class="hint">Personne ne lui montre la bonne réponse. Il ne reçoit qu’une note.</p>
            }
          </div>
        </section>

        <section class="moment">
          <div class="prose">
            <h2>Trois cents pas plus tard</h2>
            <p>On a fait la même chose pour de bon : {{ models().recompense.summary.steps }} pas, chacun sur douze questions tirées au hasard, avec {{ tries }} essais par question et un correcteur qui connaît le monde.</p>
            <p>Au tirage, ses réponses justes passent de {{ pct(models().recompense.first['tirage']) }} à <strong>{{ pct(models().recompense.last['tirage']) }}</strong>. Et le progrès déborde sur des questions jamais pratiquées.</p>
            <p class="aside">La note ne crée rien à partir de rien. Un assistant qui n’avait vu <em>aucun</em> pluriel dans ses dialogues ne tirait jamais la bonne réponse au pluriel. Toutes ses notes valaient 0, et rien n’a bougé : au pluriel, juste {{ tally('sans-pluriel-recompense', 'taughtPlural', 'first') }} avant, {{ tally('sans-pluriel-recompense', 'taughtPlural') }} après. La récompense rend fréquent ce qui arrive parfois.</p>
          </div>
          <div class="stage">
            <p class="tiny">Réussite au tirage, pas après pas · axe de 50 à 100 %</p>
            <svg class="spark tall" viewBox="0 0 200 60" preserveAspectRatio="none" aria-label="Réussite au tirage pendant l’entraînement par récompense"><polyline [attr.points]="rewardCurve('tirage')" /><polyline class="second" [attr.points]="rewardCurve('tirageInconnu')" /></svg>
            <p class="legend"><span><i style="background: var(--amber)"></i>questions pratiquées</span><span><i style="background: var(--cyan)"></i>jamais pratiquées</span></p>
            <table class="compare">
              <thead><tr><th></th><th>Avant</th><th>Après</th></tr></thead>
              <tbody>
                @for (row of rewardRows; track row.key) {
                  <tr><th>{{ row.label }}</th><td>{{ pct(models().recompense.first[row.key]) }}</td><td class="strong">{{ pct(models().recompense.last[row.key]) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (step() === 3) {
          <section class="moment solo"><button type="button" class="primary" (click)="reveal(4, 'assistant-giants')">Et chez les grands ?</button></section>
        }
      }

      @if (step() >= 4) {
        <section class="moment" id="assistant-giants">
          <div class="prose">
            <h2>Chez les grands, les mêmes trois parties</h2>
            <p><strong>Le cours</strong> dure des mois et lit une bonne part de ce qui est publié en ligne. C’est là que le modèle apprend presque tout ce qu’il sait.</p>
            <p><strong>Les exercices corrigés</strong> sont des dialogues écrits ou relus par des milliers de personnes, selon des consignes précises : être utile, honnête, refuser certaines demandes.</p>
            <p><strong>Les exercices notés</strong> prennent deux formes. Quand un correcteur exact existe (un calcul, un programme qui passe ses tests), la note est sûre. C’est ainsi que naissent les modèles « qui raisonnent » : récompensés pour leurs bonnes réponses finales, ils découvrent d’eux-mêmes qu’écrire de longues étapes, se relire et changer d’avis paie.</p>
            <p>Quand aucun correcteur n’existe (une blague, un résumé), on entraîne d’abord un <strong>juge</strong> sur des préférences humaines, puis on note avec lui. Mais un juge imparfait se trompe : à force d’optimiser, la machine finit par trouver des réponses absurdes qu’il note très bien. On arrête donc avant.</p>
            <p class="aside">Pourquoi la récompense fascine : l’imitation plafonne au niveau des exemples qu’on imite. La note, elle, peut mener plus loin. En 2016, AlphaGo, entraîné d’abord sur des parties humaines puis par la récompense, a joué contre Lee Sedol un coup que presque aucun expert n’aurait joué, et qui s’est révélé décisif : le « coup 37 ».</p>
          </div>
          <div class="stage">
            <table class="compare answers">
              <thead><tr><th></th><th>Ce mini-assistant</th><th>Un grand assistant</th></tr></thead>
              <tbody>
                <tr><th>Le cours</th><td>{{ big(models().base.summary.steps) }} pas, douze animaux</td><td>Des mois, des milliers de milliards de mots</td></tr>
                <tr><th>Les exercices corrigés</th><td>{{ big(models().dialogues.summary.steps) }} pas de dialogues générés</td><td>Des dialogues écrits par des personnes</td></tr>
                <tr><th>Les exercices notés</th><td>{{ big(models().recompense.summary.steps) }} pas, un correcteur exact</td><td>Correcteurs exacts, et un juge appris sur des préférences humaines</td></tr>
                <tr><th>Réglages</th><td>{{ big(models().base.summary.parameters) }}</td><td>Des centaines de milliards</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="moment solo">
          <div class="finale">
            <p>Un jeu de devinettes. Des boutons. Une pente. Des neurones. Des regards. Puis des exercices corrigés, et des exercices notés.</p>
            <h2>Voilà ChatGPT.</h2>
          </div>
        </section>
      }
    }
  `,
})
export class ChAssistant extends Chapter {
  readonly jump = output<number>();
  readonly big = big;
  readonly pct = pct;
  readonly user = USER;
  readonly bot = BOT;
  readonly end = END;
  readonly asks = ASKS;
  readonly knows = KNOWS;
  readonly live = LIVE;
  readonly tries = TRIES;
  readonly parts = [
    { kicker: 'Chapitres 1 à 10', title: 'Le cours', text: 'Lire des montagnes de textes en devinant la suite. Il apprend le monde.' },
    { kicker: 'Partie 2', title: 'Les exercices corrigés', text: 'Des dialogues, réponses comprises. Il apprend à répondre.' },
    { kicker: 'Partie 3', title: 'Les exercices notés', text: 'Des essais et une note, sans corrigé. Il apprend à réussir.' },
  ];
  readonly rewardRows = [
    { key: 'tirage', label: 'Au tirage, questions pratiquées' },
    { key: 'tirageInconnu', label: 'Au tirage, jamais pratiquées' },
    { key: 'taughtPlural', label: 'Pluriel, animaux pratiqués' },
    { key: 'knownPlural', label: 'Pluriel, zèbre, tigre, baleine' },
  ];

  readonly failed = signal(false);
  readonly models = signal<Record<Name, Loaded>>({} as Record<Name, Loaded>);
  readonly ready = computed(() => NAMES.every((name) => this.models()[name]));
  /** La partie du manuel qu'on est en train de lire. */
  readonly stage = computed(() => (this.step() >= 3 ? 2 : this.step() >= 1 ? 1 : 0));

  readonly batch = signal(1);
  /** Une page d'encyclopédie et une page de quiz, tirées comme pendant l'entraînement. */
  readonly pages = computed(() => {
    const rng = new Rng(60 + this.batch()), found: string[] = ['', ''];
    while (!found[0] || !found[1]) {
      const page = baseText(rng).join(' ');
      found[page.includes('?') ? 1 : 0] ||= page;
    }
    return found;
  });
  readonly sample = computed(() => {
    const talk = dialogue(new Rng(80 + this.batch()), { plural: 0.3, unknown: true });
    return decode(talk.ids).map((word, i) => ({ word, learn: i > 0 && talk.learn[i - 1] === 1 }));
  });

  readonly baseAsk = signal(ASKS[0]);
  readonly baseAnswer = computed(() => this.speak(continueText(this.models().base.model, this.baseAsk().split(' '), 10)));
  readonly knowsAnswer = computed(() => continueText(this.models().base.model, KNOWS.split(' '), 1)[0]);

  readonly talkAsk = signal(ASKS[0]);
  readonly own = signal('');
  readonly ownWords = computed(() => tokenize(this.own()));
  readonly talkWords = computed(() => (this.ownWords().words.length ? this.ownWords().words : this.talkAsk().split(' ')));
  readonly talkShown = computed(() => this.talkWords().join(' '));
  readonly talkAnswer = computed(() => this.speak(reply(this.models().dialogues.model, this.talkWords())));
  readonly who = computed(() => this.speak(reply(this.models().dialogues.model, ['qui', 'es', 'tu', '?'])));

  readonly unknownRows = computed(() =>
    UNKNOWN.map((ask) => {
      const words = ask.split(' '), after = reply(this.models().prudent.model, words);
      return { ask, before: this.speak(reply(this.models().dialogues.model, words)), after: this.speak(after), careful: after.join(' ') === [...DONT_KNOW, END].join(' ') };
    }),
  );

  // L'exercice noté en direct, sur une copie de l'assistant prudent.
  private practice: MiniGpt | null = null;
  private dice = new Rng(5);
  readonly liveAsk = signal(LIVE[0]);
  readonly liveChance = signal(0);
  readonly rounds = signal<readonly { before: number; after: number; attempts: { text: string; note: number }[] }[]>([]);
  readonly progress = computed(() => {
    const rounds = this.rounds();
    return rounds.length ? `, après ${rounds.length} ${rounds.length > 1 ? 'tours' : 'tour'} (au départ : ${pct(rounds[0].before)})` : '';
  });
  readonly lastRound = computed(() => this.rounds()[this.rounds().length - 1]?.attempts ?? []);
  readonly liveCurve = computed(() => {
    const rounds = this.rounds(), points = [rounds[0]?.before ?? 0, ...rounds.map((r) => r.after)];
    return points.map((p, i) => `${(i / Math.max(points.length - 1, 1)) * 200},${60 - p * 56}`).join(' ');
  });

  constructor() {
    super();
    Promise.all(NAMES.map((name) => this.load(name)))
      .then((loaded) => {
        this.models.set(Object.fromEntries(NAMES.map((name, i) => [name, loaded[i]])) as Record<Name, Loaded>);
        this.choose(LIVE[0]);
      })
      .catch(() => this.failed.set(true));
  }

  private async load(name: Name): Promise<Loaded> {
    const talks = !name.includes('recompense');
    const [summary, buffer] = await Promise.all([
      fetch(`models/assistant-${name}.json`).then((r) => r.json() as Promise<Summary>),
      talks ? fetch(`models/assistant-${name}.bin`).then((r) => r.arrayBuffer()) : Promise.resolve(null),
    ]);
    const model = new MiniGpt(summary.config);
    if (buffer) model.load(new Float32Array(buffer));
    return { model, summary, first: summary.report[0].scores, last: summary.report[summary.report.length - 1].scores };
  }

  /** Les mots d'une réponse, sans la marque de fin, en phrase lisible. */
  speak(words: readonly string[]): string {
    return words.filter((w) => w !== END).join(' ').replace(/l' /g, 'l’').replace(/ \./g, '.').replace(/ \?/g, ' ?');
  }

  /** « 9 fois sur 9 » : une mesure du rapport d'entraînement, en nombre de questions. */
  tally(name: Name, key: keyof typeof EXAMS, when: 'first' | 'last' = 'last'): string {
    const total = EXAMS[key].length;
    return times(Math.round(this.models()[name][when][key] * total), total);
  }

  refusals(name: Name): string {
    const total = EXAMS.taught.length + EXAMS.taughtPlural.length + EXAMS.known.length + EXAMS.knownPlural.length;
    return times(Math.round(this.models()[name].last['refus'] * total), total);
  }

  rewardCurve(key: string): string {
    const report = this.models().recompense.summary.report, last = report[report.length - 1].step;
    // L'axe part de 50 % : tout se joue au-dessus.
    return report.map((r) => `${(r.step / last) * 200},${58 - Math.max(0, r.scores[key] - 0.5) * 2 * 54}`).join(' ');
  }

  choose(ask: string): void {
    const prudent = this.models().prudent.model;
    this.practice = new MiniGpt(CONFIG, 1, LIVE_LR);
    this.practice.load(prudent.snapshot());
    this.dice = new Rng(5);
    this.liveAsk.set(ask);
    this.rounds.set([]);
    this.liveChance.set(chance(this.practice, problemOf(ask)));
  }

  practise(): void {
    if (!this.practice) return;
    const problem = problemOf(this.liveAsk()), before = chance(this.practice, problem);
    const { answers, notes } = practiseOnce(this.practice, problem, TRIES, () => this.dice.next());
    const after = chance(this.practice, problem);
    this.liveChance.set(after);
    this.rounds.update((rounds) => [...rounds, { before, after, attempts: answers.map((a, k) => ({ text: this.speak(a), note: notes[k] })) }]);
  }
}
