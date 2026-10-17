import { Component, computed, output, signal } from '@angular/core';
import { Chapter, big, num, pct } from '../shared';
import { LADDER, SKILLS, TRIALS, UNSCALED } from '../engine/mini-exam';
import { MiniConfig, MiniGpt } from '../engine/mini-gpt';
import { ANIMALS, CONTEXT, WORDS, decode, encode, isTrue, tokenize, trainingText } from '../engine/mini-world';
import { Rng } from '../engine/tensor';

interface Summary {
  readonly config: MiniConfig;
  readonly parameters: number;
  readonly report: readonly { readonly step: number; readonly loss: number; readonly scores: Readonly<Record<string, number>> }[];
}

interface Built {
  readonly model: MiniGpt;
  readonly parameters: number;
  readonly loss: number;
  readonly scores: Readonly<Record<string, number>>;
}

interface Step {
  readonly name: string;
  /** Les pièces présentes à cette étape, et celle qui vient d'être ajoutée. */
  readonly added: string;
  readonly chapter: string;
  readonly index: number;
  readonly what: string;
  readonly gain: string;
  readonly limit: string;
}

const STEPS: readonly Step[] = [
  {
    name: 'Le dernier mot',
    added: 'table',
    chapter: 'Chapitre 3',
    index: 2,
    what: 'On part de la carte du chapitre 3, avec 48 boutons par mot au lieu de 2. Chaque mot a sa ligne de boutons dans une table, et une lecture transforme cette ligne en probabilités pour le mot suivant.',
    gain: 'Elle sait déjà quelques accords : après « girafes », elle préfère un verbe au pluriel. C’est tout ce qu’un seul mot permet de savoir.',
    limit: 'Elle ne voit que le dernier mot. Devant « le dauphin vit dans la », elle ne voit que « la » : impossible de savoir de quel animal on parle.',
  },
  {
    name: 'Un regard',
    added: 'regard',
    chapter: 'Chapitre 6',
    index: 5,
    what: 'La pièce du chapitre 6. Chaque mot pose une question, la compare à l’étiquette des mots précédents, et recopie le contenu des plus ressemblants. Ici : un seul regard, une seule couche.',
    gain: 'C’est le grand saut. Elle peut enfin aller chercher l’animal quelques mots plus haut : phrases vraies, questions, tout décolle d’un coup.',
    limit: 'Elle se trompe encore parfois quand deux phrases se suivent. Après « le lion vit dans la savane », à « que mange le cerf ? », elle répond « de la viande ». Rien ne lui dit dans quel ordre sont les mots : pour elle, le texte est un sac de mots, et elle confond le lion et le cerf.',
  },
  {
    name: 'La place des mots',
    added: 'place',
    chapter: 'Chapitre 7, le capot',
    index: 6,
    what: 'À la bande de chaque mot, on ajoute une seconde bande qui ne dépend que de sa place : premier mot, deuxième mot… Ce sont encore des boutons, tournés par l’entraînement comme les autres.',
    gain: 'Elle ne mélange plus deux phrases : le cerf mange de nouveau de l’herbe. Ses phrases libres sont aussi plus souvent vraies.',
    limit: 'Sur les questions qu’on ne lui a jamais posées, elle plafonne.',
  },
  {
    name: 'Des neurones',
    added: 'neurones',
    chapter: 'Chapitre 5',
    index: 4,
    what: 'Le réseau du chapitre 5. Après le regard, chaque mot passe sa bande dans 96 neurones (une somme pondérée, puis un pli) et ajoute le résultat à ce qu’il sait.',
    gain: 'Ici, presque rien ne bouge, et c’est un vrai résultat : ce monde est si petit qu’un regard suffit presque à tout. Dans un grand modèle, c’est dans ces neurones que se range l’essentiel des connaissances.',
    limit: 'Les questions jamais posées ne progressent toujours pas.',
  },
  {
    name: 'Un second regard',
    added: 'regard',
    chapter: 'Chapitre 7',
    index: 6,
    what: 'Au lieu d’un regard, deux en parallèle, chacun avec ses propres questions et étiquettes : ils peuvent chercher deux choses différentes en même temps. On partage simplement les 48 nombres en deux, sans ajouter un seul bouton.',
    gain: 'Ici, deux questions jamais posées de plus réussies : trop peu pour conclure sur un monde aussi petit. Dans les grands modèles, des dizaines de regards par couche se partagent le travail.',
    limit: 'Avec une seule couche, chaque mot ne consulte les autres qu’une fois. Il ne peut pas profiter de ce qu’un autre mot vient d’apprendre.',
  },
  {
    name: 'Des couches',
    added: 'couches',
    chapter: 'Chapitre 7',
    index: 6,
    what: 'On empile trois fois le bloc « regards puis neurones ». Chaque couche travaille sur des bandes déjà enrichies par la précédente : des regards sur le résultat d’autres regards.',
    gain: 'Ses phrases libres sont presque toutes vraies, et elle est la seule à répondre « elle nage » à « que fait la baleine ? » : une question jamais posée, qui demande à la fois le bon pronom et le bon verbe.',
    limit: 'Il reste des erreurs, que tu verras au chapitre suivant. Pour les corriger, il faudrait plus de texte et plus de boutons : c’est le chemin qui mène aux grands modèles.',
  },
];

// Quatre phrases retenues parce qu'elles deviennent justes à des étapes différentes de la construction.
const PROBES = ['le dauphin vit dans la', 'où vit le zèbre ?', 'le lion vit dans la savane . que mange le cerf ?', 'que fait la baleine ?'];

@Component({
  selector: 'v4-ch-build',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 9 · L’assemblage</p>
      <h1>Construire un GPT, <em>pièce par pièce</em></h1>
      <p class="lede">Au chapitre 6, ton modèle ne savait répondre qu’à une seule sorte de question. Construisons un vrai petit modèle de langage. Tu connais déjà toutes les pièces : il reste à les assembler, une à la fois, en mesurant ce que chacune apporte.</p>
    </header>

    <section class="moment">
      <div class="prose">
        <h2>Son monde, et ce qu’on lui demande</h2>
        <p>Douze animaux. Pour chacun : où il vit, ce qu’il mange, comment il se déplace. Voilà tout son univers. Elle lira des milliers de petits textes écrits à partir de ces faits : des affirmations, et des questions suivies de leur réponse.</p>
        <p>Le jeu est celui du chapitre 1 : <strong>deviner le mot suivant</strong>. Une nouveauté, pourtant : on le lui demande <strong>à chaque mot du texte</strong>, pas seulement à la fin. Un texte de vingt mots, c’est dix-neuf exercices.</p>
        <p class="do">Clique sur un mot : voici ce qu’elle voit à cet instant, et ce qu’elle doit deviner.</p>
        <div class="controls"><button type="button" (click)="batch.set(batch() + 1)">D’autres textes</button></div>
        <details class="vocab">
          <summary>Voir les douze animaux</summary>
          <table class="compare world">
            <thead><tr><th>Animal</th><th>Vit dans</th><th>Mange</th><th>Se déplace</th></tr></thead>
            <tbody>@for (a of animals; track a.name) { <tr><th>{{ a.feminine ? 'la' : 'le' }} {{ a.name }}</th><td>la {{ a.habitat }}</td><td>{{ a.food.join(' ') }}</td><td>{{ a.move }}</td></tr> }</tbody>
          </table>
        </details>
        <p class="aside">On lui cache volontairement certaines phrases : aucune question directe sur le zèbre, le tigre ou la baleine, et jamais « les girafes vivent… ». Cela permettra de vérifier qu’elle fait plus que réciter.</p>
      </div>
      <div class="stage">
        <p class="tiny">Trois textes qu’elle lit pendant son entraînement</p>
        @for (text of texts(); track $index; let t = $index) {
          <p class="context reading">
            @for (word of text; track $index) {
              <button type="button" [class.seen]="t === pick().text && $index < pick().word" [class.target]="t === pick().text && $index === pick().word" [disabled]="$index === 0" (click)="pick.set({ text: t, word: $index })">{{ word }}</button>
            }
          </p>
        }
        <div class="exercise">
          <p><span class="tiny">Elle voit</span>{{ seen() }}</p>
          <p><span class="tiny">Elle doit deviner</span><strong>{{ target() }}</strong></p>
        </div>
      </div>
    </section>

    @if (failed()) {
      <section class="moment solo"><div class="takeaway"><p>Les modèles de la construction sont introuvables. Lance <code>npm run train:mini</code> (une dizaine de minutes), puis recharge la page.</p></div></section>
    } @else if (built().length) {
      <section class="moment stack" id="build-ladder">
        <div class="prose">
          <h2>Six machines, une pièce de plus à chaque fois</h2>
          <p>Chaque machine ci-dessous a été entraînée pour de bon, sur les mêmes textes, pendant le même nombre de pas. La seule différence entre deux machines voisines, c’est <strong>une pièce</strong>. On peut donc lire ce que chaque pièce apporte.</p>
        </div>
        <div class="rungs">
          @for (step of steps; track step.name) { <button type="button" [class.on]="rung() === $index" [class.past]="$index < rung()" (click)="rung.set($index)"><small>{{ $index + 1 }}</small>{{ $index ? '+ ' : '' }}{{ step.name }}</button> }
        </div>

        <div class="moment inner">
          <div class="prose">
            <p class="tiny">Étape {{ rung() + 1 }} / {{ steps.length }} · {{ big(current().parameters) }} boutons</p>
            <h2>{{ rung() ? 'On ajoute : ' + lower(info().name) : info().name }}</h2>
            <p>{{ info().what }} <button type="button" class="link" (click)="jump.emit(info().index)">{{ info().chapter }} ↗</button></p>
            <p><strong>Ce que ça change.</strong> {{ info().gain }}</p>
            <p><strong>Ce qui coince encore.</strong> {{ info().limit }}</p>
            <div class="controls">
              <button type="button" [disabled]="rung() === 0" (click)="rung.set(rung() - 1)">← Pièce précédente</button>
              <button type="button" class="primary" [disabled]="rung() === steps.length - 1" (click)="rung.set(rung() + 1)">Ajouter la pièce suivante →</button>
            </div>
          </div>
          <div class="stage">
            <p class="tiny">Le plan de la machine</p>
            <div class="plan">
              <span class="piece on" [class.new]="info().added === 'table'">Table des boutons</span>
              <span class="piece" [class.on]="has('place')" [class.new]="info().added === 'place'">+ place des mots</span>
              <span class="block" [class.on]="has('regard')" [class.new]="info().added === 'couches'">
                <span class="piece" [class.on]="has('regard')" [class.new]="info().added === 'regard'">{{ current().model.config.heads > 1 ? '2 regards' : 'Regard' }}</span>
                <span class="piece" [class.on]="has('neurones')" [class.new]="info().added === 'neurones'">96 neurones</span>
                <small>{{ current().model.config.layers > 1 ? '× ' + current().model.config.layers + ' couches' : '1 couche' }}</small>
              </span>
              <span class="piece on">Lecture</span>
            </div>

            <p class="tiny spaced">Ses mesures · et l’écart avec la machine précédente</p>
            <ul class="skills-list wide-list">
              @for (skill of skills; track skill.key) {
                <li [class.unseen]="skill.unseen">
                  <span>{{ skill.label }}@if (skill.unseen) { <em> · jamais vu</em> } <small class="tally">{{ tally(skill.key) }}</small></span>
                  <span class="skill-track"><i [style.width.%]="current().scores[skill.key] * 100"></i></span>
                  <strong>{{ pct(current().scores[skill.key]) }}</strong>
                  <span class="delta" [class.up]="delta(skill.key) > 0.005" [class.down]="delta(skill.key) < -0.005">{{ rung() ? signed(delta(skill.key)) : '' }}</span>
                </li>
              }
            </ul>
            <p class="hint">Surprise moyenne sur les textes : {{ num(current().loss) }}@if (rung()) { (elle était de {{ num(built()[rung() - 1].loss) }}) }. Plus elle est basse, mieux la machine devine.</p>
            <p class="hint">Les épreuves sont petites, et chaque machine n’a été entraînée qu’une fois : un écart d’une ou deux réussites ne veut rien dire. Seules les grandes marches comptent.</p>

            <p class="tiny spaced">Les mêmes quatre phrases à chaque étape</p>
            <ul class="probes">
              @for (probe of answers(); track probe.prompt) {
                <li [class.right]="probe.right"><span>{{ probe.prompt }}</span><strong>{{ probe.answer }}</strong><i>{{ probe.right ? '✓' : '✗' }}</i></li>
              }
            </ul>
            <p class="hint">Elles ont été retenues parce qu’elles deviennent justes à des étapes différentes.</p>
            <div class="prompt-row short">
              <input type="text" [value]="own()" (input)="own.set($any($event.target).value)" placeholder="Ta propre phrase, avec ses mots" aria-label="Ta propre phrase" spellcheck="false" />
            </div>
            @if (ownAnswer(); as mine) { <ul class="probes"><li [class.right]="mine.right"><span>{{ mine.prompt }}</span><strong>{{ mine.answer }}</strong><i>{{ mine.right ? '✓' : '✗' }}</i></li></ul> }
          </div>
        </div>
      </section>

      <section class="moment">
        <div class="prose">
          <h2>Et la remise à l’échelle ?</h2>
          <p>Une dernière pièce, discrète, est présente depuis l’étape 2 : avant chaque regard et chaque passage dans les neurones, on <strong>remet la bande à l’échelle</strong> (moyenne nulle, même ampleur). Sans elle, à force d’additions, les nombres d’une bande peuvent enfler d’une couche à l’autre.</p>
          @if (unscaled(); as bare) {
            <p>Pour mesurer son rôle, on a entraîné la machine complète sans elle. {{ verdict(bare) }}</p>
          }
          <p class="aside">Dans un modèle de 96 couches, cette remise à l’échelle n’est plus un confort : sans elle, l’entraînement devient instable.</p>
        </div>
        <div class="stage">
          <table class="compare">
            <thead><tr><th></th><th>Avec</th><th>Sans</th></tr></thead>
            <tbody>
              @for (skill of skills; track skill.key) {
                <tr><th>{{ skill.label }}</th><td class="strong">{{ pct(full().scores[skill.key]) }}</td><td>{{ unscaled() ? pct(unscaled()!.scores[skill.key]) : '…' }}</td></tr>
              }
              <tr><th>Surprise moyenne</th><td class="strong">{{ num(full().loss) }}</td><td>{{ unscaled() ? num(unscaled()!.loss) : '…' }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="moment">
        <div class="prose">
          <h2>Tu viens de construire un GPT</h2>
          <p>La dernière machine a exactement le plan des grands modèles de langage : une table de boutons, la place des mots, des couches « regards puis neurones » empilées, une lecture finale. Et un seul entraînement : deviner le mot suivant.</p>
          <p>Entre elle et GPT-3, la différence est de <strong>taille</strong>, pas de nature.</p>
          <p class="aside">Trois simplifications, sans effet sur le principe : elle lit des mots entiers (les grands modèles découpent en morceaux de mots), son pli est le plus simple qui soit, et sa remise à l’échelle n’a pas de boutons propres.</p>
        </div>
        <div class="stage">
          <table class="compare">
            <thead><tr><th></th><th>Ta machine</th><th>GPT-3</th></tr></thead>
            <tbody>
              <tr><th>Couches</th><td class="strong">{{ full().model.config.layers }}</td><td>96</td></tr>
              <tr><th>Regards par couche</th><td class="strong">{{ full().model.config.heads }}</td><td>96</td></tr>
              <tr><th>Nombres par mot</th><td class="strong">{{ full().model.config.width }}</td><td>{{ big(12288) }}</td></tr>
              <tr><th>Mots visibles à la fois</th><td class="strong">{{ context }}</td><td>{{ big(2048) }}</td></tr>
              <tr><th>Vocabulaire</th><td class="strong">{{ vocabulary }} mots</td><td>≈ {{ big(50000) }} morceaux</td></tr>
              <tr><th>Boutons</th><td class="strong">{{ big(full().parameters) }}</td><td>{{ big(175e9) }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="moment solo">
        <aside class="everyday">
          <p class="tiny">Dans ChatGPT</p>
          <h3>Pourquoi ses connaissances s’arrêtent-elles à une date ?</h3>
          <p>Comme le mini-GPT ne connaît que ses douze animaux, un grand modèle ne sait que ce qu’il a lu avant la fin de son entraînement : c’est figé dans ses boutons. Ce qui s’est passé ensuite lui est inconnu, sauf si une recherche le colle dans son texte.</p>
        </aside>
      </section>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Un GPT n’est pas une invention d’un seul bloc. C’est une <strong>pile de pièces simples</strong>, chacune ajoutée pour lever une limite précise : voir plus loin que le dernier mot, connaître l’ordre, retravailler ce qu’on a recueilli, chercher plusieurs choses à la fois, recommencer sur un résultat enrichi.</p>
          <p>Il reste à la voir tourner en entier, et à regarder ce qui se passe réellement à l’intérieur.</p>
        </div>
      </section>
    } @else {
      <section class="moment solo"><p class="hint">Chargement des six machines…</p></section>
    }
  `,
})
export class ChBuild extends Chapter {
  readonly jump = output<number>();
  readonly steps = STEPS;
  readonly skills = SKILLS;
  readonly animals = ANIMALS;
  readonly context = CONTEXT;
  readonly vocabulary = WORDS.length;
  readonly big = big;
  readonly num = num;
  readonly pct = pct;

  // Les textes d'entraînement montrés au début, et l'exercice choisi.
  readonly batch = signal(1);
  readonly texts = computed(() => {
    const rng = new Rng(40 + this.batch());
    return [0, 1, 2].map(() => trainingText(rng));
  });
  readonly pick = signal({ text: 0, word: 4 });
  readonly seen = computed(() => this.texts()[this.pick().text].slice(0, Math.min(this.pick().word, this.texts()[this.pick().text].length - 1)).join(' '));
  readonly target = computed(() => {
    const text = this.texts()[this.pick().text];
    return text[Math.min(this.pick().word, text.length - 1)];
  });

  readonly built = signal<readonly Built[]>([]);
  readonly unscaled = signal<Built | null>(null);
  readonly failed = signal(false);
  readonly rung = signal(0);
  readonly info = computed(() => STEPS[this.rung()]);
  readonly current = computed(() => this.built()[this.rung()]);
  readonly full = computed(() => this.built()[this.built().length - 1]);
  readonly own = signal('');

  readonly answers = computed(() => PROBES.map((probe) => this.reply(probe.split(' '))));
  readonly ownAnswer = computed(() => {
    const words = tokenize(this.own()).words;
    return words.length ? this.reply(words.slice(0, CONTEXT - 1)) : null;
  });

  constructor() {
    super();
    const fetchOne = async (key: string): Promise<Built> => {
      const [summary, buffer] = await Promise.all([fetch(`models/ladder-${key}.json`).then((r) => r.json() as Promise<Summary>), fetch(`models/ladder-${key}.bin`).then((r) => r.arrayBuffer())]);
      const model = new MiniGpt(summary.config), last = summary.report[summary.report.length - 1];
      model.load(new Float32Array(buffer));
      return { model, parameters: summary.parameters, loss: last.loss, scores: last.scores };
    };
    Promise.all(LADDER.map((r) => fetchOne(r.key)))
      .then((built) => this.built.set(built))
      .catch(() => this.failed.set(true));
    fetchOne(UNSCALED.key).then((bare) => this.unscaled.set(bare)).catch(() => undefined);
  }

  /** Fait compléter une phrase par la machine de l'étape choisie, et vérifie si le résultat est vrai dans son monde. */
  private reply(words: readonly string[]): { prompt: string; answer: string; right: boolean } {
    const model = this.current().model, text = encode(words);
    while (text.length < CONTEXT && text.length < words.length + 6) {
      text.push(model.complete(text, 1)[0]);
      if (WORDS[text[text.length - 1]] === '.') break;
    }
    const all = decode(text), start = words.lastIndexOf('.') + 1;
    return { prompt: words.join(' '), answer: all.slice(words.length).join(' '), right: isTrue(all.slice(start)) };
  }

  has(piece: 'place' | 'regard' | 'neurones'): boolean {
    const config = this.current().model.config;
    return piece === 'place' ? config.positions !== false : piece === 'regard' ? config.layers > 0 : config.layers > 0 && config.hidden > 0;
  }

  /** La mesure en nombre de cas réussis : « 16/18 » dit mieux que « 89 % » sur quoi elle repose. */
  tally(key: string): string {
    return `${Math.round(this.current().scores[key] * TRIALS[key])}/${TRIALS[key]}`;
  }

  delta(key: string): number {
    return this.rung() ? this.current().scores[key] - this.built()[this.rung() - 1].scores[key] : 0;
  }

  signed(value: number): string {
    const points = Math.round(value * 100);
    return points === 0 ? '=' : (points > 0 ? '+' : '−') + Math.abs(points) + ' pts';
  }

  lower(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /** Une phrase qui dit ce que la mesure montre, sans l'embellir. */
  verdict(bare: Built): string {
    // L'écart se compte en réussites : deux de plus ou de moins, sur des épreuves aussi petites, ne prouvent rien.
    const full = this.full(), gaps = SKILLS.map((s) => ({ label: s.label.toLowerCase(), gap: Math.round((full.scores[s.key] - bare.scores[s.key]) * TRIALS[s.key]), with: full.scores[s.key], without: bare.scores[s.key], of: TRIALS[s.key] }));
    const widest = gaps.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    if (Math.abs(widest.gap) <= 2) return 'À cette taille, aucune différence nette : sur chaque épreuve, au plus deux réussites d’écart. Avec trois couches seulement, les nombres n’ont pas le temps d’enfler.';
    const others = gaps.filter((g) => g !== widest).every((g) => Math.abs(g.gap) <= 2);
    const detail = `« ${widest.label} » : ${Math.round(widest.with * widest.of)}/${widest.of} avec, ${Math.round(widest.without * widest.of)}/${widest.of} sans`;
    return others ? `Presque rien ne change, sauf sur une mesure. ${detail}.` : `Plusieurs mesures bougent. Le plus grand écart : ${detail}.`;
  }
}
