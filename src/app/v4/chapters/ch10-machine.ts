import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, output, signal, viewChild } from '@angular/core';
import { Chapter, FrameLoop, big, num, pct } from '../shared';
import { SKILLS, measure } from '../engine/mini-exam';
import { Cut, MiniConfig, MiniGpt } from '../engine/mini-gpt';
import { ANIMALS, CONTEXT, WORDS, encode, kindOf, tokenize } from '../engine/mini-world';
import { GrandZoom } from './grand-zoom';
import { H, HEAD_NAMES, MachineScene, W, paintMachine, rank } from './machine-paint';

export interface Report {
  readonly step: number;
  readonly loss: number;
  readonly scores: Readonly<Record<string, number>>;
}

export interface Meta {
  readonly config: MiniConfig;
  readonly parameters: number;
  readonly seconds: number;
  readonly batch: number;
  readonly report: readonly Report[];
}

interface Preset {
  readonly label: string;
  readonly text: string;
  readonly why: string;
}

const PRESETS: readonly Preset[] = [
  { label: 'Une connaissance', text: 'où vit le zèbre ?', why: 'Elle a lu « le zèbre vit dans la savane », mais jamais une seule question sur le zèbre. Elle doit faire le lien toute seule.' },
  { label: 'Un pronom', text: 'que font les tigres ?', why: 'Question jamais posée sur le tigre. Il faut répondre « ils », au pluriel, puis conjuguer le bon verbe.' },
  { label: 'Un accord', text: 'les chouettes', why: 'Elle n’a jamais lu « les chouettes volent ». Regarde le verbe qu’elle propose, et surtout sa forme.' },
  { label: 'Plusieurs réponses', text: 'qui vit dans la mer ?', why: 'Trois réponses sont justes. Regarde comment elle répartit ses chances, puis monte la température et recommence.' },
  { label: 'Écriture libre', text: 'les', why: 'Sans question, elle écrit ce qu’elle sait de son monde. Monte la température pour varier, et appuie plusieurs fois.' },
  { label: 'Une erreur', text: 'que font les baleines ?', why: 'Elle répond « ils nagent » : le verbe est juste, le pronom est faux. Elle n’a jamais lu de question sur la baleine, et n’a pas assez de texte pour relier « baleines » au féminin. Les grands modèles y arrivent grâce à des milliards d’exemples.' },
  { label: 'Hors de son monde', text: 'où vit le poisson ?', why: 'Pour elle, « poisson » n’est qu’une nourriture. Elle répond quand même, avec aplomb : une hallucination en miniature.' },
];

interface Role {
  readonly layer: number;
  readonly head: number;
  /** Ce que ce regard consulte le plus quand il faut donner un lieu, et la part de son attention. */
  readonly looks: string;
  readonly share: number;
  /** Les mesures de la machine quand ce regard est débranché. */
  readonly without: Readonly<Record<string, number>> | null;
}

/** Les phrases où il faut donner le lieu d'un animal : c'est là qu'on observe ce que cherche chaque regard. */
const ROLE_PROMPTS = ANIMALS.flatMap((a) => {
  const subject = [a.feminine ? 'la' : 'le', a.name];
  return [[...subject, 'vit', 'dans', 'la'], ['où', 'vit', ...subject, '?', 'dans', 'la']];
});

@Component({
  selector: 'v4-ch-machine',
  imports: [GrandZoom],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 10 · La grande machine</p>
      <h1>Tout, <em>d’un seul tenant</em></h1>
      <p class="lede">Tu viens de construire cette machine pièce par pièce. Regarde-la maintenant tourner en entier, puis ouvre-la : ce qu’elle pense à chaque étage, et ce que fait chacun de ses regards.</p>
    </header>

    @if (failed()) {
      <section class="moment solo"><div class="takeaway"><p>Le fichier du modèle est introuvable. Lance <code>npm run train:mini</code> pour l’entraîner (une dizaine de minutes), puis recharge la page.</p></div></section>
    } @else if (!meta()) {
      <section class="moment solo"><p class="hint">Chargement du modèle…</p></section>
    } @else {
      <section class="moment stack">
        <div class="panel wide">
          <span class="tiny">Ton texte · elle connaît {{ vocabulary.length }} mots</span>
          <div class="prompt-row">
            <input type="text" [value]="draft()" (input)="type($any($event.target).value)" (keydown.enter)="writeSentence()" aria-label="Texte de départ" spellcheck="false" />
            <button type="button" class="primary" [disabled]="busy() || full()" (click)="writeSentence()">Écrire la suite</button>
            <button type="button" [disabled]="busy() || full()" (click)="writeOne()">Un seul mot</button>
            <button type="button" [disabled]="!written().length" (click)="erase()">Effacer la suite</button>
          </div>
          <p class="context">
            @for (word of prompt(); track $index) { <span>{{ word }}</span> }
            @for (word of written(); track $index) { <span class="new">{{ word }}</span> }
            @if (!prompt().length) { <em>Écris un début de phrase, ou choisis un exemple.</em> }
          </p>
          @if (unknown().length) { <p class="hint warn">Mots qu’elle ne connaît pas, ignorés : {{ unknown().join(', ') }}</p> }
          <div class="chips presets">
            @for (preset of presets; track preset.label) { <button type="button" [class.on]="chosen() === $index" style="--tone: #ffb454" (click)="choose($index)">{{ preset.label }}</button> }
          </div>
          @if (chosen() >= 0) { <p class="hint">{{ presets[chosen()].why }}</p> }
          <details class="vocab">
            <summary>Voir son vocabulaire</summary>
            <p class="context">@for (word of vocabulary; track word) { <button type="button" (click)="append(word)">{{ word }}</button> }</p>
          </details>
        </div>

        <div class="fresco"><canvas #fresco [attr.aria-label]="'La machine complète. Suite la plus probable : ' + favourite().word"></canvas></div>
        <p class="hint center-text">Sous chaque étage du flux : ce qu’elle répondrait si on lisait sa réponse à cet endroit. La réponse se forme couche après couche.</p>

        <div class="console">
          <div class="panel">
            <span class="tiny">Temps d’entraînement · pas {{ report().step }} / {{ lastStep() }}</span>
            <div class="time">
              <button type="button" [disabled]="replay.running()" (click)="replayTraining()">{{ replay.running() ? 'Lecture…' : 'Rejouer' }}</button>
              <input type="range" min="0" [max]="meta()!.report.length - 1" [value]="index()" (input)="index.set(+$any($event.target).value)" aria-label="Instant de l’entraînement" />
            </div>
            <ul class="skills-list">
              @for (skill of skills; track skill.key) {
                <li [class.unseen]="skill.unseen"><span>{{ skill.label }}</span><span class="skill-track"><i [style.width.%]="(scores()[skill.key] || 0) * 100"></i></span><strong>{{ scores()[skill.key] === undefined ? '…' : pct(scores()[skill.key]) }}</strong></li>
              }
            </ul>
            <p class="hint">{{ cutting() ? 'Mesures refaites à l’instant, avec ce que tu as débranché.' : 'Les deux dernières lignes sont mesurées uniquement sur des cas absents de l’entraînement. Glisse le curseur : toute la machine remonte le temps.' }}</p>
          </div>

          <div class="panel">
            <span class="tiny">Les couches</span>
            <div class="controls">
              @for (layer of layers(); track layer) { <button type="button" [class.primary]="!off().includes(layer)" (click)="toggle(layer)">Couche {{ layer + 1 }} {{ off().includes(layer) ? 'débranchée' : 'active' }}</button> }
            </div>
            <label class="slider">Température : <strong>{{ temperature() ? num(temperature(), 1) : '0 · toujours le favori' }}</strong>
              <input type="range" min="0" max="2" step="0.1" [value]="temperature()" (input)="temperature.set(+$any($event.target).value)" />
            </label>
            <span class="tiny">Suivre le trajet</span>
            <div class="controls">
              <button type="button" [class.primary]="stage() < 0" (click)="stage.set(-1)">Tout</button>
              @for (s of stages(); track s.title) { <button type="button" [class.primary]="stage() === $index" (click)="stage.set($index)">{{ $index + 1 }}</button> }
              <button type="button" (click)="paused.set(!paused())">{{ paused() ? 'Reprendre' : 'Pause' }}</button>
            </div>
            <p class="phase">@if (stage() >= 0) { <strong>{{ stages()[stage()].title }}.</strong> {{ stages()[stage()].text }} } @else { Suite la plus probable : <strong>« {{ favourite().word }} »</strong>, à {{ pct(favourite().value) }}. }</p>
          </div>

          <div class="panel wide">
            <span class="tiny">Ce que fait chaque regard · mesuré sur la machine entraînée</span>
            <p class="hint">Pour chaque regard : ce qu’il consulte le plus au moment de donner le lieu d’un animal, et ce que deviennent les mesures si on le débranche.</p>
            <ul class="roles">
              @for (role of roles(); track role.layer * 10 + role.head) {
                <li [class.muted]="isMuted(role)">
                  <i [class]="'head-' + role.head"></i>
                  <span><strong>Couche {{ role.layer + 1 }} · regard {{ headNames[role.head] }}</strong> regarde surtout {{ role.looks }} ({{ pct(role.share) }} de son attention).</span>
                  <span class="impact">@if (role.without; as w) { sans lui : questions {{ pct(w['question']) }} · fil {{ pct(w['fil']) }} · accords {{ pct(w['accord']) }} } @else { mesure en cours… }</span>
                  <button type="button" (click)="mute(role)">{{ isMuted(role) ? 'Rebrancher' : 'Débrancher' }}</button>
                </li>
              }
            </ul>
            <p class="hint">Avec tout branché : questions {{ pct(finalScores()['question']) }} · fil {{ pct(finalScores()['fil']) }} · accords {{ pct(finalScores()['accord']) }}. Certains regards sont décisifs, d’autres presque inutiles : l’entraînement ne répartit pas le travail proprement.</p>
          </div>
        </div>
        <p class="aside wide">Cette machine a été entraînée à l’avance : {{ big(lastStep()) }} pas de {{ meta()!.batch }} textes, soit {{ duration() }} sur un ordinateur portable, avec le moteur de ce cours. Les instantanés de cet entraînement sont rejoués ici ; tout ce qui circule à l’écran est calculé en direct. Elle ne sait que ce qu’elle a retenu de ses lectures : lire une scène nouvelle, comme le modèle du chapitre 6, demande un entraînement qu’elle n’a pas reçu.</p>
      </section>

      <section class="moment solo">
        <aside class="everyday">
          <p class="tiny">Dans ChatGPT</p>
          <h3>Pourquoi les modèles « qui raisonnent » écrivent-ils avant de répondre ?</h3>
          <p>Pour écrire un mot, cette machine fait un passage complet : environ {{ big(perWord()) }} multiplications, ni plus ni moins, que la question soit facile ou difficile. Pour GPT-3, environ 175 milliards. Un calcul difficile exigé dès le premier mot doit tenir dans un seul passage. Écrire des étapes, c’est s’offrir d’autres passages, chacun relisant ce qui est déjà écrit.</p>
        </aside>
      </section>

      <section class="moment stack" id="machine-zoom">
        <div class="prose">
          <h2>Le grand zoom : d’une multiplication à GPT-3</h2>
          <p>Tout ce que tu viens de voir repose sur une seule opération, répétée. Pars de la plus petite et recule, sans coupure, jusqu’aux plus grands modèles. À chaque palier, les nombres sont ceux de la machine, pour la phrase « où vit le zèbre ? dans la… ».</p>
        </div>
        <v4-grand-zoom [model]="trained()!" [meta]="meta()!" (jump)="jump.emit($event)" (finished)="ended.set(true)" />
        @if (ended()) {
          <div class="finale">
            <p>Un jeu de devinettes. Des boutons. Une pente. Des neurones. Des regards.</p>
            <h2>Rien d’autre. Et pourtant.</h2>
          </div>
        }
      </section>
    }
  `,
})
export class ChMachine extends Chapter implements AfterViewInit, OnDestroy {
  readonly jump = output<number>();
  readonly presets = PRESETS;
  readonly skills = SKILLS;
  readonly vocabulary = WORDS;
  readonly headNames = HEAD_NAMES;
  readonly num = num;
  readonly pct = pct;
  readonly big = big;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('fresco');
  private readonly painter = new FrameLoop();
  readonly replay = new FrameLoop();

  readonly meta = signal<Meta | null>(null);
  readonly failed = signal(false);
  private weights = new Float32Array(0);
  /** Le modèle qu'on regarde, à l'instant d'entraînement choisi, et le modèle entièrement entraîné. */
  private viewer: MiniGpt | null = null;
  readonly trained = signal<MiniGpt | null>(null);
  readonly index = signal(0);
  readonly report = computed(() => this.meta()!.report[this.index()]);
  readonly lastStep = computed(() => this.meta()!.report[this.meta()!.report.length - 1].step);
  readonly finalScores = computed(() => this.meta()!.report[this.meta()!.report.length - 1].scores);
  readonly layers = computed(() => Array.from({ length: this.meta()!.config.layers }, (_, l) => l));
  /** Le calcul d'un passage, ramené à un mot, pour un texte d'une douzaine de mots. */
  readonly perWord = computed(() => (this.trained() ? Math.round(this.trained()!.multiplications(12) / 12) : 0));
  readonly duration = computed(() => {
    const seconds = this.meta()!.seconds;
    return seconds < 100 ? `environ ${Math.round(seconds / 10) * 10} secondes` : `environ ${Math.round(seconds / 60)} minutes`;
  });

  readonly draft = signal(PRESETS[0].text);
  readonly prompt = signal<readonly string[]>(tokenize(PRESETS[0].text).words);
  readonly unknown = signal<readonly string[]>([]);
  readonly written = signal<readonly string[]>([]);
  readonly chosen = signal(0);
  readonly busy = signal(false);
  readonly words = computed(() => [...this.prompt(), ...this.written()]);
  readonly full = computed(() => this.words().length >= CONTEXT || !this.words().length);

  readonly off = signal<readonly number[]>([]);
  readonly muted = signal<readonly (readonly [number, number])[]>([]);
  readonly cut = computed<Cut>(() => ({ layers: this.off(), heads: this.muted() }));
  readonly cutting = computed(() => this.off().length + this.muted().length > 0);
  readonly temperature = signal(0);
  readonly stage = signal(-1);
  readonly paused = signal(false);
  readonly ended = signal(false);

  readonly roles = signal<readonly Role[]>([]);
  /** Mesures refaites en direct quand quelque chose est débranché ; sinon celles de l'entraînement. */
  private readonly live = signal<Readonly<Record<string, number>> | null>(null);
  readonly scores = computed<Readonly<Record<string, number>>>(() => (this.cutting() ? (this.live() ?? {}) : this.report().scores));

  readonly stages = computed(() => {
    const config = this.meta()!.config;
    return [
      { title: 'Les mots', text: `Ton texte est découpé en mots. Chacun est remplacé par son numéro dans le vocabulaire de ${WORDS.length} mots.` },
      { title: 'La table', text: `Chaque numéro désigne une ligne de la table : ${config.width} boutons par mot, tournés par l’entraînement.` },
      { title: 'Le flux', text: `Chaque mot voyage sous forme de bande de ${config.width} nombres, à laquelle s’ajoute sa place dans le texte.` },
      ...this.layers().map((l) => ({ title: `Couche ${l + 1}`, text: `Deux regards en parallèle, bleu et rose, vont chercher de l’information dans les mots précédents. Puis ${config.hidden} neurones retravaillent chaque bande : en bas, ceux qui s’allument pour le dernier mot.` })),
      { title: 'La suite', text: `La dernière bande est comparée aux ${WORDS.length} mots possibles, et les notes deviennent des parts de 100 %. Un mot est choisi, rejoint le texte, et toute la machine repart.` },
    ];
  });

  /** Tout ce que la machine calcule pour le texte courant, à l'instant d'entraînement choisi. */
  private readonly view = computed<MachineScene | null>(() => {
    const meta = this.meta(), ids = encode(this.words());
    if (!meta || !this.viewer || !ids.length) return null;
    this.load(this.viewer, this.index());
    const trace = this.viewer.trace(ids, this.cut());
    return {
      config: meta.config, ids, trace, table: this.viewer.embeddingTable(), written: this.written().length, offLayers: this.off(), offHeads: this.muted(),
      ranked: rank(trace.logits, this.temperature() || 1),
      glimpses: trace.lens.map((logits) => rank(logits)[0]),
    };
  });

  readonly favourite = computed(() => {
    const best = this.view()?.ranked[0];
    return { word: best ? WORDS[best.id] : '…', value: best?.value ?? 0 };
  });

  private clock = 0;
  private timer = 0;
  private pending = 0;
  private flight = { since: -10, slot: 0 };

  constructor() {
    super();
    Promise.all([fetch('models/mini-llm.json').then((r) => r.json() as Promise<Meta>), fetch('models/mini-llm.bin').then((r) => r.arrayBuffer())])
      .then(([meta, buffer]) => {
        this.weights = new Float32Array(buffer);
        this.viewer = new MiniGpt(meta.config);
        const trained = new MiniGpt(meta.config);
        this.index.set(meta.report.length - 1);
        this.meta.set(meta);
        this.load(trained, meta.report.length - 1);
        this.trained.set(trained);
        setTimeout(() => this.startPainting(), 60);
        setTimeout(() => this.observeRoles(trained), 400);
      })
      .catch(() => this.failed.set(true));

    // Dès qu'on débranche quelque chose, on refait les mesures sur la machine telle qu'elle est.
    effect(() => {
      const cut = this.cut(), index = this.index();
      clearTimeout(this.pending);
      if (!this.cutting() || !this.viewer) return;
      this.live.set(null);
      this.pending = window.setTimeout(() => {
        this.load(this.viewer!, index);
        this.live.set(measure(this.viewer!, cut, 60));
      }, 250);
    });
  }

  private load(model: MiniGpt, index: number): void {
    const size = this.meta()!.parameters;
    model.load(this.weights.subarray(index * size, (index + 1) * size));
  }

  /** Observe la machine entraînée : ce que consulte chaque regard, puis ce qui casse sans lui. */
  private observeRoles(model: MiniGpt): void {
    const config = model.config, tallies = new Map<string, Map<string, number>>();
    for (const words of ROLE_PROMPTS) {
      const trace = model.trace(encode(words)), last = words.length - 1;
      trace.layers.forEach((layer, l) =>
        layer.heads.forEach((head, h) => {
          const tally = tallies.get(`${l}-${h}`) ?? new Map<string, number>();
          head.attention[last].forEach((weight, j) => {
            const kind = j === last ? 'le mot lui-même' : kindOf(words[j]);
            tally.set(kind, (tally.get(kind) ?? 0) + weight / ROLE_PROMPTS.length);
          });
          tallies.set(`${l}-${h}`, tally);
        }),
      );
    }
    const roles: Role[] = [];
    for (let layer = 0; layer < config.layers; layer++)
      for (let head = 0; head < config.heads; head++) {
        const [looks, share] = [...tallies.get(`${layer}-${head}`)!].sort((a, b) => b[1] - a[1])[0];
        roles.push({ layer, head, looks, share, without: null });
      }
    this.roles.set(roles);
    // Les coupures sont mesurées une à une, sans bloquer la page.
    const next = (i: number) => {
      if (i >= roles.length) return;
      const without = measure(model, { heads: [[roles[i].layer, roles[i].head]] }, 0);
      this.roles.update((list) => list.map((role, k) => (k === i ? { ...role, without } : role)));
      setTimeout(() => next(i + 1), 30);
    };
    setTimeout(() => next(0), 200);
  }

  ngAfterViewInit(): void {
    this.startPainting();
  }

  private startPainting(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || this.painter.running()) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    const context = canvas.getContext('2d')!;
    context.scale(ratio, ratio);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    this.painter.start(() => {
      const now = performance.now(), scene = this.view();
      if (!this.paused() && !still) this.clock += (now - last) / 1000;
      last = now;
      if (scene) paintMachine(context, scene, this.clock, { stage: this.stage(), flight: this.flight });
      return true;
    });
  }

  type(text: string): void {
    const { words, unknown } = tokenize(text);
    clearTimeout(this.timer);
    this.busy.set(false);
    this.draft.set(text);
    this.prompt.set(words.slice(0, CONTEXT - 1));
    this.unknown.set(unknown);
    this.written.set([]);
    this.chosen.set(-1);
  }

  choose(index: number): void {
    this.type(PRESETS[index].text);
    this.chosen.set(index);
  }

  append(word: string): void {
    this.type((this.draft() + ' ' + word).trim());
  }

  erase(): void {
    clearTimeout(this.timer);
    this.busy.set(false);
    this.written.set([]);
  }

  toggle(layer: number): void {
    this.off.update((list) => (list.includes(layer) ? list.filter((l) => l !== layer) : [...list, layer]));
  }

  isMuted(role: Role): boolean {
    return this.muted().some(([l, h]) => l === role.layer && h === role.head);
  }

  mute(role: Role): void {
    this.muted.update((list) => (this.isMuted(role) ? list.filter(([l, h]) => l !== role.layer || h !== role.head) : [...list, [role.layer, role.head] as const]));
  }

  /** Choisit le mot suivant : le favori à température 0, sinon un tirage selon les probabilités. */
  writeOne(): string | null {
    const view = this.view();
    if (!view || this.full()) return null;
    let slot = 0;
    if (this.temperature() > 0) {
      let draw = Math.random();
      while (slot < view.ranked.length - 1 && draw > view.ranked[slot].value) draw -= view.ranked[slot++].value;
    }
    const word = WORDS[view.ranked[slot].id];
    this.flight = { since: this.clock, slot: Math.min(slot, 6) };
    this.written.update((list) => [...list, word]);
    return word;
  }

  /** Écrit mot après mot jusqu'au point : c'est la boucle du chapitre 2, sur la vraie machine. */
  writeSentence(): void {
    if (this.busy() || this.full()) return;
    this.busy.set(true);
    const next = () => {
      const word = this.writeOne();
      if (word && word !== '.' && !this.full() && this.written().length < 14) this.timer = window.setTimeout(next, 1100);
      else this.busy.set(false);
    };
    next();
  }

  replayTraining(): void {
    const last = this.meta()!.report.length - 1;
    let frame = 0;
    this.index.set(0);
    this.replay.start(() => {
      if (++frame % 28 === 0) this.index.update((i) => i + 1);
      return this.index() < last;
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    clearTimeout(this.pending);
    this.painter.stop();
    this.replay.stop();
  }
}
