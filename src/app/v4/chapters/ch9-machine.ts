import { AfterViewInit, Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { Chapter, FrameLoop, big, num, pct } from '../shared';
import { MiniConfig, MiniGpt } from '../engine/mini-gpt';
import { CONTEXT, WORDS, encode, tokenize } from '../engine/mini-world';

const W = 1600;
const H = 900;
const GPT3 = 175e9;
const INK = '#eef1fb', MUTE = '#9aa5c4', LINE = '#2a3558', AMBER = '#ffb454', CYAN = '#5ad1e6', PINK = '#ff7eb6', NIGHT = '#0d1326';
const HEAD_COLORS = [CYAN, PINK];

// Géométrie de la fresque, en pixels logiques.
const CHIP = { x: 20, width: 116 };
const TABLE = { x: 182, y: 250, width: 132, row: 6 };
const FLOW = { first: 356, last: 1196, width: 144 };
const READ = { x: 1380, bar: 100, slots: 7, step: 64 };
const MIDDLE = 462;

interface Report {
  readonly step: number;
  readonly loss: number;
  readonly scores: Readonly<Record<string, number>>;
}

interface Meta {
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

const SKILLS = [
  { key: 'vérité', label: 'Écrire des phrases vraies' },
  { key: 'question', label: 'Répondre à une question jamais posée' },
  { key: 'accord', label: 'Accorder une phrase jamais lue' },
];

function tone(value: number, scale = 2): string {
  const strength = Math.min(1, Math.abs(value) / scale);
  return value >= 0 ? `rgba(255,180,84,${strength})` : `rgba(90,209,230,${strength})`;
}

/** Point d'une courbe de Bézier dont les tangentes sont horizontales aux deux bouts. */
function along(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  const bend = (x1 - x0) * 0.5, u = 1 - t;
  return [u * u * u * x0 + 3 * u * u * t * (x0 + bend) + 3 * u * t * t * (x1 - bend) + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1];
}

@Component({
  selector: 'v4-ch-machine',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 9 · La grande machine</p>
      <h1>Un petit LLM, <em>d’un seul tenant</em></h1>
      <p class="lede">Tu as démonté la machine pièce par pièce. La voici remontée, dans une version plus proche d’un vrai modèle de langage : elle écrit mot après mot, et répond à des questions sur son petit monde.</p>
    </header>

    @if (failed()) {
      <section class="moment solo"><div class="takeaway"><p>Le fichier du modèle est introuvable. Lance <code>npm run train:mini</code> pour l’entraîner (quelques minutes), puis recharge la page.</p></div></section>
    } @else if (!meta()) {
      <section class="moment solo"><p class="hint">Chargement du modèle…</p></section>
    } @else {
      <section class="moment stack">
        <div class="prose two-col">
          <div>
            <p>Elle a lu des milliers de petits textes sur douze animaux : où ils vivent, ce qu’ils mangent, comment ils se déplacent. Comme toujours, on ne lui a demandé qu’une chose : <strong>deviner le mot suivant</strong>.</p>
          </div>
          <div>
            <p>Elle contient tout ce qu’un vrai LLM ajoute : <strong>{{ meta()!.config.layers }} couches</strong>, <strong>{{ meta()!.config.heads }} regards par couche</strong>, et <strong>{{ meta()!.config.hidden }} neurones</strong> après chaque regard. Soit {{ big(meta()!.parameters) }} réglages.</p>
          </div>
        </div>

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

        <div class="console">
          <div class="panel">
            <span class="tiny">Temps d’entraînement · pas {{ report().step }} / {{ lastStep() }}</span>
            <div class="time">
              <button type="button" [disabled]="replay.running()" (click)="replayTraining()">{{ replay.running() ? 'Lecture…' : 'Rejouer' }}</button>
              <input type="range" min="0" [max]="meta()!.report.length - 1" [value]="index()" (input)="index.set(+$any($event.target).value)" aria-label="Instant de l’entraînement" />
            </div>
            <ul class="skills-list">
              @for (skill of skills; track skill.key) {
                <li><span>{{ skill.label }}</span><span class="skill-track"><i [style.width.%]="(report().scores[skill.key] || 0) * 100"></i></span><strong>{{ pct(report().scores[skill.key] || 0) }}</strong></li>
              }
            </ul>
            <p class="hint">Les deux dernières lignes sont mesurées uniquement sur des cas absents de l’entraînement. Glisse le curseur : toute la machine remonte le temps.</p>
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
        </div>
        <p class="aside wide">Cette machine a été entraînée à l’avance : {{ big(lastStep()) }} pas de {{ meta()!.batch }} textes, soit {{ duration() }} sur un ordinateur portable, avec le moteur de ce cours. Les instantanés de cet entraînement sont rejoués ici ; tout ce qui circule à l’écran est calculé en direct. Elle ne sait que ce qu’elle a retenu de ses lectures : lire une scène nouvelle, comme le modèle du chapitre 6, demande un entraînement qu’elle n’a pas reçu.</p>
        @if (step() === 0) { <button type="button" class="primary center" (click)="recede()">Reculer pour voir l’échelle</button> }
      </section>

      @if (step() >= 1) {
        <section class="moment stack" id="machine-scale">
          <div class="fresco zoom">
            <canvas #zoom></canvas>
            <div class="count">
              <strong>{{ big(copies()) }}</strong>
              <span>{{ copies() > 1 ? 'machines comme celle-ci' : 'machine' }} · {{ big(arrived() ? gpt3 : copies() * meta()!.parameters) }} réglages</span>
              @if (arrived()) { <em>C’est la taille de GPT-3. Sorti en 2020.</em> }
            </div>
          </div>
          @if (arrived()) {
            <div class="finale">
              <p>Un jeu de devinettes. Des boutons. Une pente. Des neurones. Des regards.</p>
              <h2>Rien d’autre. Et pourtant.</h2>
              <button type="button" (click)="recede()">Revoir le recul</button>
            </div>
          }
        </section>
      }
    }
  `,
})
export class ChMachine extends Chapter implements AfterViewInit, OnDestroy {
  readonly presets = PRESETS;
  readonly skills = SKILLS;
  readonly vocabulary = WORDS;
  readonly num = num;
  readonly pct = pct;
  readonly big = big;
  readonly gpt3 = GPT3;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('fresco');
  private readonly zoomCanvas = viewChild<ElementRef<HTMLCanvasElement>>('zoom');
  private readonly painter = new FrameLoop();
  private readonly zoomer = new FrameLoop();
  readonly replay = new FrameLoop();

  readonly meta = signal<Meta | null>(null);
  readonly failed = signal(false);
  private weights = new Float32Array(0);
  private viewer: MiniGpt | null = null;
  readonly index = signal(0);
  readonly report = computed(() => this.meta()!.report[this.index()]);
  readonly lastStep = computed(() => this.meta()!.report[this.meta()!.report.length - 1].step);
  readonly duration = computed(() => {
    const seconds = this.meta()!.seconds;
    return seconds < 100 ? `environ ${Math.round(seconds / 10) * 10} secondes` : `environ ${Math.round(seconds / 60)} minutes`;
  });
  readonly layers = computed(() => Array.from({ length: this.meta()!.config.layers }, (_, l) => l));

  readonly draft = signal(PRESETS[0].text);
  readonly prompt = signal<readonly string[]>(tokenize(PRESETS[0].text).words);
  readonly unknown = signal<readonly string[]>([]);
  readonly written = signal<readonly string[]>([]);
  readonly chosen = signal(0);
  readonly busy = signal(false);
  readonly words = computed(() => [...this.prompt(), ...this.written()]);
  readonly full = computed(() => this.words().length >= CONTEXT || !this.words().length);

  readonly off = signal<readonly number[]>([]);
  readonly temperature = signal(0);
  readonly stage = signal(-1);
  readonly paused = signal(false);

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
  private readonly view = computed(() => {
    const meta = this.meta(), ids = encode(this.words());
    if (!meta || !this.viewer || !ids.length) return null;
    const size = meta.parameters;
    this.viewer.load(this.weights.subarray(this.index() * size, (this.index() + 1) * size));
    const trace = this.viewer.trace(ids, this.off()), heat = this.temperature() || 1;
    const peak = Math.max(...trace.logits), exps = trace.logits.map((v) => Math.exp((v - peak) / heat)), sum = exps.reduce((a, b) => a + b, 0);
    const ranked = exps.map((v, id) => ({ id, value: v / sum })).sort((a, b) => b.value - a.value);
    return { ids, trace, ranked, table: this.viewer.embeddingTable() };
  });

  readonly favourite = computed(() => {
    const best = this.view()?.ranked[0];
    return { word: best ? WORDS[best.id] : '…', value: best?.value ?? 0 };
  });

  readonly copies = signal(1);
  readonly arrived = signal(false);
  private clock = 0;
  private timer = 0;
  /** Le dernier mot écrit vole de la sortie vers le texte : instant de départ et rang parmi les candidats. */
  private flight = { since: -10, slot: 0 };

  constructor() {
    super();
    Promise.all([fetch('models/mini-llm.json').then((r) => r.json() as Promise<Meta>), fetch('models/mini-llm.bin').then((r) => r.arrayBuffer())])
      .then(([meta, buffer]) => {
        this.weights = new Float32Array(buffer);
        this.viewer = new MiniGpt(meta.config);
        this.index.set(meta.report.length - 1);
        this.meta.set(meta);
        setTimeout(() => this.startPainting(), 60);
      })
      .catch(() => this.failed.set(true));
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
      const now = performance.now();
      if (!this.paused() && !still) this.clock += (now - last) / 1000;
      last = now;
      this.paint(context, this.clock);
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
    this.flight = { since: this.clock, slot: Math.min(slot, READ.slots - 1) };
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

  /** Recule : la machine devient une vignette, puis une nappe de millions de vignettes. */
  recede(): void {
    this.reveal(1, 'machine-scale');
    this.arrived.set(false);
    this.copies.set(1);
    const source = this.canvas()?.nativeElement;
    if (!source) return;
    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = 180;
    thumb.getContext('2d')!.drawImage(source, 0, 0, 320, 180);
    const most = GPT3 / this.meta()!.parameters, began = performance.now() + 500;
    setTimeout(() => {
      const canvas = this.zoomCanvas()?.nativeElement;
      if (!canvas) return;
      canvas.width = W;
      canvas.height = H;
      const context = canvas.getContext('2d')!, pattern = context.createPattern(thumb, 'repeat')!;
      this.zoomer.stop();
      this.zoomer.start(() => {
        const t = Math.min(1, Math.max(0, (performance.now() - began) / 9000));
        const eased = t * t * (3 - 2 * t), count = Math.exp(eased * Math.log(most));
        pattern.setTransform(new DOMMatrix().scale(W / Math.sqrt(count) / 320));
        context.fillStyle = NIGHT;
        context.fillRect(0, 0, W, H);
        context.fillStyle = pattern;
        context.fillRect(0, 0, W, H);
        this.copies.set(Math.round(count));
        if (t < 1) return true;
        this.arrived.set(true);
        return false;
      });
    }, 120);
  }

  private paint(c: CanvasRenderingContext2D, time: number): void {
    c.globalAlpha = 1;
    c.fillStyle = NIGHT;
    c.fillRect(0, 0, W, H);
    const view = this.view(), meta = this.meta();
    if (!view || !meta) return;
    const { ids, trace, ranked, table } = view, { width, layers, hidden } = meta.config;
    const count = ids.length, last = count - 1, stage = this.stage();
    const gap = Math.min(64, 720 / count), top = MIDDLE - (gap * last) / 2, row = (i: number) => top + i * gap;
    const thick = Math.min(26, gap - 6), cell = FLOW.width / width;
    const station = (s: number) => FLOW.first + ((FLOW.last - FLOW.first) / layers) * s;
    const shown = (column: number) => (stage < 0 || stage >= column ? 1 : 0.1);
    const flow = (phase: number) => (time * 0.32 + phase) % 1;
    const font = (size: number, weight = '') => `${weight} ${size}px Inter, system-ui, sans-serif`;
    c.textBaseline = 'middle';

    const header = (text: string, x: number, column: number, color = MUTE) => {
      c.globalAlpha = shown(column);
      c.fillStyle = color;
      c.font = font(18, '600');
      c.textAlign = 'left';
      c.fillText(text, x, 44);
    };
    header('1 · LES MOTS', CHIP.x, 0);
    header('2 · LA TABLE', TABLE.x, 1);
    header('3 · LE FLUX', station(0), 2);
    for (let l = 0; l < layers; l++) header(`COUCHE ${l + 1}`, station(l) + FLOW.width + 18, 3 + l, INK);
    header('4 · LA SUITE', READ.x, 3 + layers);

    // 1 · Les mots. Ceux que la machine a écrits elle-même sont en orange.
    const mine = count - this.written().length;
    c.globalAlpha = shown(0);
    const chipHeight = Math.min(42, gap - 4);
    ids.forEach((id, i) => {
      const y = row(i);
      c.fillStyle = '#1b2442';
      c.strokeStyle = i === last ? AMBER : LINE;
      c.lineWidth = i === last ? 2.5 : 1.5;
      c.beginPath();
      c.roundRect(CHIP.x, y - chipHeight / 2, CHIP.width, chipHeight, 9);
      c.fill();
      c.stroke();
      c.fillStyle = i >= mine ? AMBER : INK;
      c.font = font(Math.min(21, chipHeight * 0.56), '500');
      c.textAlign = 'center';
      c.fillText(WORDS[id], CHIP.x + CHIP.width / 2, y + 1);
      if (gap > 30) {
        c.fillStyle = MUTE;
        c.font = font(13);
        c.textAlign = 'left';
        c.fillText('n° ' + id, CHIP.x + CHIP.width + 6, y - chipHeight / 2 + 7);
      }
    });

    // 2 · La table : une ligne de boutons par mot du vocabulaire.
    const tableCell = TABLE.width / width, tableRight = TABLE.x + TABLE.width;
    c.globalAlpha = shown(1);
    table.forEach((line, r) => {
      const used = ids.includes(r);
      line.forEach((v, k) => {
        c.fillStyle = tone(v, used ? 0.5 : 1.6);
        c.fillRect(TABLE.x + k * tableCell, TABLE.y + r * TABLE.row, tableCell - 0.4, TABLE.row - 1.5);
      });
    });
    ids.forEach((id, i) => {
      const lineY = TABLE.y + id * TABLE.row + TABLE.row / 2 - 1;
      this.wire(c, CHIP.x + CHIP.width + 36, row(i), TABLE.x - 4, lineY, 1, MUTE, 0.45 * shown(1), flow(i * 0.13));
      this.wire(c, tableRight + 3, lineY, station(0) - 6, row(i), 1, MUTE, 0.45 * shown(2), flow(i * 0.13 + 0.4));
    });

    // 3 · Le flux : l'état de chaque mot à l'entrée, puis après chaque couche.
    trace.stream.forEach((state, s) => {
      c.globalAlpha = shown(2 + s);
      state.forEach((values, i) => {
        const x = station(s), y = row(i);
        c.fillStyle = '#131a30';
        c.fillRect(x - 3, y - thick / 2 - 3, FLOW.width + 6, thick + 6);
        values.forEach((v, k) => {
          c.fillStyle = tone(v, 2.5);
          c.fillRect(x + k * cell, y - thick / 2, cell - 0.5, thick);
        });
        if (s === layers && i === last) {
          c.strokeStyle = AMBER;
          c.lineWidth = 2;
          c.strokeRect(x - 3, y - thick / 2 - 3, FLOW.width + 6, thick + 6);
        }
      });
    });

    // Les couches : regards de chaque tête, puis neurones du dernier mot.
    trace.layers.forEach((layer, l) => {
      const from = station(l) + FLOW.width + 6, to = station(l + 1) - 6, active = !this.off().includes(l), visible = shown(3 + l);
      for (let i = 0; i < count; i++) this.wire(c, from, row(i), to, row(i), 1, LINE, visible, -1);
      if (active)
        layer.attention.forEach((head, h) => {
          const color = HEAD_COLORS[h % HEAD_COLORS.length];
          for (let i = 1; i < count; i++)
            for (let j = 0; j < i; j++) {
              const weight = head[i][j], final = i === last;
              if (weight < (final ? 0.05 : 0.14)) continue;
              this.wire(c, from, row(j), to, row(i), 1 + weight * (final ? 6 : 3), color, weight * (final ? 1 : 0.32) * visible, final || weight > 0.6 ? flow(i * 0.21 + j * 0.37 + h * 0.5) : -1, final ? Math.ceil(weight * 3) : 1);
            }
        });
      c.globalAlpha = visible;
      c.textAlign = 'left';
      if (!active) {
        c.fillStyle = '#ff8a8a';
        c.font = font(17, '600');
        c.fillText('débranchée', from + 12, 74);
        return;
      }
      const neurons = layer.neurons[last], lit = neurons.filter((v) => v > 0).length, peak = Math.max(...neurons, 1e-6), step = (to - from) / hidden;
      c.fillStyle = MUTE;
      c.font = font(16);
      c.fillText(`${lit} neurones actifs sur ${hidden}`, from, 848);
      neurons.forEach((v, k) => {
        c.fillStyle = v > 0 ? `rgba(255,255,255,${0.25 + 0.75 * (v / peak)})` : '#1b2442';
        c.fillRect(from + k * step, 862, Math.max(1, step - 0.3), 16);
      });
    });

    // 4 · La suite : les candidats les mieux notés pour le mot suivant.
    const outX = station(layers) + FLOW.width + 6, slotY = (k: number) => MIDDLE + (k - (READ.slots - 1) / 2) * READ.step;
    ranked.slice(0, READ.slots).forEach(({ id, value }, k) => {
      const y = slotY(k);
      if (value > 0.02) this.wire(c, outX, row(last), READ.x - 10, y, 1 + value * 7, AMBER, value * shown(3 + layers), flow(k * 0.17), Math.ceil(value * 4));
      c.globalAlpha = shown(3 + layers);
      c.fillStyle = k === 0 ? INK : MUTE;
      c.font = font(22, k === 0 ? '600' : '');
      c.textAlign = 'left';
      c.fillText(WORDS[id], READ.x, y - 10);
      c.fillStyle = '#1b2442';
      c.fillRect(READ.x, y + 6, READ.bar, 12);
      c.fillStyle = k === 0 ? AMBER : CYAN;
      c.fillRect(READ.x, y + 6, READ.bar * value, 12);
      c.fillStyle = INK;
      c.font = font(17);
      c.fillText(pct(value), READ.x + READ.bar + 8, y + 12);
    });

    // La boucle : le mot choisi repart de la sortie et vient s'ajouter au texte.
    const since = time - this.flight.since;
    if (since >= 0 && since < 0.7 && this.written().length) {
      const t = since / 0.7, eased = t * t * (3 - 2 * t), u = 1 - eased;
      const x0 = READ.x + 40, y0 = slotY(this.flight.slot), x1 = CHIP.x + CHIP.width / 2, y1 = row(last);
      const x = u * u * u * x0 + 3 * u * u * eased * 1100 + 3 * u * eased * eased * 400 + eased * eased * eased * x1;
      const y = u * u * u * y0 + 3 * u * u * eased * -30 + 3 * u * eased * eased * -30 + eased * eased * eased * y1;
      c.globalAlpha = 1;
      c.fillStyle = AMBER;
      c.beginPath();
      c.roundRect(x - 52, y - 17, 104, 34, 9);
      c.fill();
      c.fillStyle = '#1a1205';
      c.font = font(18, '600');
      c.textAlign = 'center';
      c.fillText(WORDS[ids[last]], x, y + 1);
    }
    c.globalAlpha = 1;
  }

  /** Un conduit entre deux points, avec des grains qui y circulent. phase < 0 : pas de grain. */
  private wire(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha: number, phase: number, grains = 1): void {
    if (alpha <= 0.01) return;
    const bend = (x1 - x0) * 0.5;
    c.globalAlpha = Math.min(1, alpha) * 0.55;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(x0 + bend, y0, x1 - bend, y1, x1, y1);
    c.stroke();
    if (phase < 0) return;
    c.globalAlpha = Math.min(1, alpha * 1.6 + 0.15);
    c.fillStyle = '#fff';
    for (let g = 0; g < grains; g++) {
      const [x, y] = along(x0, y0, x1, y1, (phase + g / grains) % 1);
      c.beginPath();
      c.arc(x, y, 1.5 + width * 0.22, 0, Math.PI * 2);
      c.fill();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.painter.stop();
    this.replay.stop();
    this.zoomer.stop();
  }
}
