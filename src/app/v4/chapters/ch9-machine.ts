import { AfterViewInit, Component, ElementRef, OnDestroy, WritableSignal, computed, signal, viewChild } from '@angular/core';
import { Chapter, FrameLoop, big, num, pct } from '../shared';
import { DRINKS, LAST, LENGTH, LookupModel, NAMES, VOCAB, fixedPuzzles, isHeldOut, makePuzzle } from '../engine/lookup';

const W = 1600;
const H = 900;
const TOTAL = 2000;
const EVERY = 50;
const GPT3 = 175e9;
const UNSEEN = fixedPuzzles('test', 60, 99);

// Géométrie de la fresque, en pixels logiques.
const ROW = (i: number) => 122 + i * 92;
const CELL = 6.5;
const BAND = 24 * CELL;
const STATION = [400, 760, 1120];
const TABLE = { x: 196, y: 318, cell: 6, row: 14 };
const BAR = { x: 1340, y: 74, step: 47, width: 140 };
const INK = '#eef1fb', MUTE = '#9aa5c4', LINE = '#2a3558', AMBER = '#ffb454', CYAN = '#5ad1e6', PINK = '#ff7eb6';

interface Stage {
  readonly title: string;
  readonly text: string;
}

const STAGES: readonly Stage[] = [
  { title: 'Les mots', text: 'La fiche entre dans la machine. Chaque mot est remplacé par son numéro : une simple adresse.' },
  { title: 'La table des boutons', text: 'Chaque numéro désigne une ligne de la table. Ces lignes sont les boutons du chapitre 3, tournés par l’entraînement.' },
  { title: 'Le flux', text: 'Chaque mot voyage sous forme de bande de 24 nombres, à laquelle s’ajoute sa place dans la phrase. Huit rails parallèles.' },
  { title: 'Couche 1 · ranger', text: 'Les mots se regardent. Plus un regard est appuyé, plus le débit est épais. Chaque boisson reçoit la marque du prénom qui la précède.' },
  { title: 'Couche 2 · chercher', text: 'Second tour, sur des bandes enrichies. La question trouve la boisson qui porte la bonne marque et recopie son contenu.' },
  { title: 'La lecture', text: 'La dernière bande est comparée aux 17 candidats. Les notes deviennent des parts de 100 % : la réponse.' },
];

function tone(value: number, scale = 2): string {
  const strength = Math.min(1, Math.abs(value) / scale);
  return value >= 0 ? `rgba(255,180,84,${strength})` : `rgba(90,209,230,${strength})`;
}

/** Point d'une courbe de Bézier horizontale entre (x0, y0) et (x1, y1). */
function along(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  const bend = (x1 - x0) * 0.5, u = 1 - t;
  const x = u * u * u * x0 + 3 * u * u * t * (x0 + bend) + 3 * u * t * t * (x1 - bend) + t * t * t * x1;
  const y = u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
  return [x, y];
}

@Component({
  selector: 'v4-ch-machine',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 9 · La grande machine</p>
      <h1>Tout, <em>d’un seul tenant</em></h1>
      <p class="lede">Tu as démonté la machine pièce par pièce. La voici remontée, en marche. Rien n’est simulé : ce que tu vois circuler, ce sont les vrais nombres du modèle.</p>
    </header>

    <section class="moment stack">
      <div class="fresco">
        <canvas #fresco [attr.aria-label]="'La machine complète : ' + answer().label + ' à ' + pct(answer().value)"></canvas>
      </div>

      <div class="console">
        <div class="panel wide">
          <span class="tiny">Temps d’entraînement · pas {{ trainedSteps() }} / {{ total }}</span>
          <div class="time">
            <button type="button" class="primary" [disabled]="trainer.running()" (click)="ignite()">{{ trainer.running() ? 'Entraînement…' : trained() ? 'Rejouer l’entraînement' : 'Allumer la machine' }}</button>
            <input type="range" min="0" [max]="snapshots().length - 1" [value]="index()" [disabled]="!trained() || trainer.running()" (input)="index.set(+$any($event.target).value)" aria-label="Instant de l’entraînement" />
          </div>
          <svg class="curves short" viewBox="0 0 300 60" preserveAspectRatio="none">
            <polyline class="unseen" [attr.points]="curve()" />
            <line class="cursor" [attr.x1]="cursor()" y1="0" [attr.x2]="cursor()" y2="60" />
          </svg>
          <p class="hint">{{ trained() ? 'Glisse le curseur : toute la machine remonte ou descend le temps. Courbe : réussite sur des couples jamais vus (' + pct(score()) + ' à cet instant).' : 'Pour l’instant, ses réglages sont tirés au hasard : les regards partent dans tous les sens.' }}</p>
        </div>

        <div class="panel">
          <span class="tiny">La fiche</span>
          <div class="builder">
            @for (name of names(); track $index) {
              <span class="pair">
                <button type="button" class="name" (click)="cycle(names, $index, namesList.length)">{{ namesList[name] }}</button>
                <button type="button" class="drink" (click)="cycle(drinks, $index, drinksList.length)">{{ drinksList[drinks()[$index]] }}</button>
                <button type="button" class="ask" [class.on]="asked() === $index" (click)="asked.set($index)">?</button>
                @if (held(name, drinks()[$index])) { <small>jamais vus ensemble</small> }
              </span>
            }
          </div>
        </div>

        <div class="panel">
          <span class="tiny">Les couches</span>
          <div class="controls">
            <button type="button" [class.primary]="!off().includes(0)" (click)="toggle(0)">Couche 1 {{ off().includes(0) ? 'débranchée' : 'active' }}</button>
            <button type="button" [class.primary]="!off().includes(1)" (click)="toggle(1)">Couche 2 {{ off().includes(1) ? 'débranchée' : 'active' }}</button>
          </div>
          <label class="slider">Température : <strong>{{ num(temperature(), 1) }}</strong>
            <input type="range" min="0.2" max="3" step="0.1" [value]="temperature()" (input)="temperature.set(+$any($event.target).value)" />
          </label>
        </div>

        <div class="panel wide">
          <span class="tiny">Suivre le trajet</span>
          <div class="controls">
            <button type="button" [class.primary]="stage() < 0" (click)="stage.set(-1)">Tout en marche</button>
            @for (s of stages; track s.title) { <button type="button" [class.primary]="stage() === $index" (click)="stage.set($index)">{{ $index + 1 }}</button> }
            <button type="button" (click)="paused.set(!paused())">{{ paused() ? 'Reprendre' : 'Pause' }}</button>
          </div>
          <p class="phase">@if (stage() >= 0) { <strong>{{ stages[stage()].title }}.</strong> {{ stages[stage()].text }} } @else { La machine répond <strong>« {{ answer().label }} »</strong> avec {{ pct(answer().value) }} de confiance. {{ answer().right ? 'C’est la bonne réponse.' : 'La bonne réponse était « ' + target() + ' ».' }} }</p>
        </div>
      </div>
      @if (trained() && step() === 0) { <button type="button" class="primary center" (click)="recede()">Reculer pour voir l’échelle</button> }
    </section>

    @if (step() >= 1) {
      <section class="moment stack" id="machine-scale">
        <div class="fresco zoom">
          <canvas #zoom></canvas>
          <div class="count">
            <strong>{{ big(copies()) }}</strong>
            <span>{{ copies() > 1 ? 'machines comme celle-ci' : 'machine' }} · {{ big(arrived() ? gpt3 : copies() * parameters) }} réglages</span>
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
  `,
})
export class ChMachine extends Chapter implements AfterViewInit, OnDestroy {
  readonly total = TOTAL;
  readonly stages = STAGES;
  readonly namesList = NAMES;
  readonly drinksList = DRINKS;
  readonly num = num;
  readonly pct = pct;
  readonly big = big;
  readonly gpt3 = GPT3;

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('fresco');
  private readonly zoomCanvas = viewChild<ElementRef<HTMLCanvasElement>>('zoom');
  private readonly painter = new FrameLoop();
  private readonly zoomer = new FrameLoop();
  readonly trainer = new FrameLoop();

  /** Le modèle qu'on entraîne, et celui qu'on regarde : le second rejoue les instantanés du premier. */
  private learner = new LookupModel(7, 24, 2, 0.004, 0.2);
  private readonly viewer = new LookupModel(7, 24, 2, 0.004, 0.2);
  readonly parameters = this.viewer.parameterCount;
  readonly snapshots = signal<readonly Float32Array[][]>([this.learner.snapshot()]);
  readonly scores = signal<readonly number[]>([this.learner.accuracy(UNSEEN)]);
  readonly index = signal(0);
  readonly trained = signal(false);
  readonly trainedSteps = computed(() => this.index() * EVERY);
  readonly score = computed(() => this.scores()[this.index()] ?? 0);

  readonly names = signal<readonly number[]>([0, 1, 2]);
  readonly drinks = signal<readonly number[]>([1, 3, 0]);
  readonly asked = signal(1);
  readonly off = signal<readonly number[]>([]);
  readonly temperature = signal(1);
  readonly stage = signal(-1);
  readonly paused = signal(false);
  readonly puzzle = computed(() => makePuzzle(this.names(), this.drinks(), this.asked()));
  readonly target = computed(() => VOCAB[this.puzzle().target]);

  private readonly view = computed(() => {
    this.viewer.load(this.snapshots()[this.index()]);
    const inspection = this.viewer.inspect(this.puzzle(), this.off());
    const scaled = inspection.logits.map((v) => v / this.temperature());
    const peak = Math.max(...scaled), exps = scaled.map((v) => Math.exp(v - peak)), sum = exps.reduce((a, b) => a + b, 0);
    return { inspection, probs: exps.map((v) => v / sum), table: this.viewer.embeddingTable() };
  });

  readonly answer = computed(() => {
    const probs = this.view().probs, best = probs.indexOf(Math.max(...probs));
    return { label: VOCAB[best], value: probs[best], right: best === this.puzzle().target };
  });

  readonly curve = computed(() => this.scores().map((s, i) => `${(i / (TOTAL / EVERY)) * 300},${56 - s * 52}`).join(' '));
  readonly cursor = computed(() => (this.index() / (TOTAL / EVERY)) * 300);

  readonly copies = signal(1);
  readonly arrived = signal(false);
  private clock = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvas().nativeElement, ratio = Math.min(window.devicePixelRatio || 1, 2);
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

  held(name: number, drink: number): boolean {
    return isHeldOut(name, drink);
  }

  toggle(layer: number): void {
    this.off.update((list) => (list.includes(layer) ? list.filter((l) => l !== layer) : [...list, layer]));
  }

  cycle(target: WritableSignal<readonly number[]>, slot: number, size: number): void {
    target.update((list) => {
      let value = list[slot];
      do value = (value + 1) % size;
      while (list.some((other, i) => i !== slot && other === value));
      return list.map((v, i) => (i === slot ? value : v));
    });
  }

  /** Entraîne pour de bon, en gardant un instantané tous les 50 pas ; la fresque suit en direct. */
  ignite(): void {
    this.learner = new LookupModel(7, 24, 2, 0.004, 0.2);
    this.snapshots.set([this.learner.snapshot()]);
    this.scores.set([this.learner.accuracy(UNSEEN)]);
    this.index.set(0);
    this.trainer.start(() => {
      const start = performance.now();
      while (performance.now() - start < 7 && this.learner.steps < TOTAL) {
        this.learner.trainStep(16);
        if (this.learner.steps % EVERY === 0) {
          this.snapshots.update((list) => [...list, this.learner.snapshot()]);
          this.scores.update((list) => [...list, this.learner.accuracy(UNSEEN)]);
          this.index.set(this.snapshots().length - 1);
        }
      }
      if (this.learner.steps < TOTAL) return true;
      this.trained.set(true);
      return false;
    });
  }

  /** Recule : la machine devient une vignette, puis une nappe de 39 millions de vignettes. */
  recede(): void {
    this.reveal(1, 'machine-scale');
    this.arrived.set(false);
    this.copies.set(1);
    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = 180;
    thumb.getContext('2d')!.drawImage(this.canvas().nativeElement, 0, 0, 320, 180);
    const most = GPT3 / this.parameters, began = performance.now() + 500;
    setTimeout(() => {
      const canvas = this.zoomCanvas()?.nativeElement;
      if (!canvas) return;
      canvas.width = W;
      canvas.height = H;
      const context = canvas.getContext('2d')!, pattern = context.createPattern(thumb, 'repeat')!;
      this.zoomer.stop();
      this.zoomer.start(() => {
        const t = Math.min(1, Math.max(0, (performance.now() - began) / 9000));
        const eased = t * t * (3 - 2 * t), count = Math.exp(eased * Math.log(most)), perSide = Math.sqrt(count);
        pattern.setTransform(new DOMMatrix().scale(W / perSide / 320));
        context.fillStyle = '#0d1326';
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
    const { inspection, probs, table } = this.view(), ids = this.puzzle().ids, stage = this.stage();
    const shown = (column: number) => (stage < 0 || stage >= column ? 1 : 0.1);
    const flow = (phase: number) => (time * 0.32 + phase) % 1;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#0d1326';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';

    const header = (text: string, x: number, column: number, color = MUTE) => {
      c.globalAlpha = shown(column);
      c.fillStyle = color;
      c.font = '600 18px Inter, system-ui, sans-serif';
      c.textAlign = 'left';
      c.fillText(text, x, 44);
    };
    header('1 · LES MOTS', 30, 0);
    header('2 · LA TABLE', TABLE.x, 1);
    header('3 · LE FLUX', STATION[0], 2);
    header('COUCHE 1 · RANGER', STATION[0] + BAND + 26, 3, CYAN);
    header('COUCHE 2 · CHERCHER', STATION[1] + BAND + 26, 4, AMBER);
    header('4 · LA LECTURE', BAR.x, 5);

    // 1 · Les mots et leur numéro.
    c.globalAlpha = shown(0);
    ids.forEach((id, i) => {
      const y = ROW(i), isName = id < NAMES.length, isDrink = !isName && id < NAMES.length + DRINKS.length;
      c.fillStyle = '#1b2442';
      c.strokeStyle = i === LAST ? AMBER : LINE;
      c.lineWidth = i === LAST ? 2.5 : 1.5;
      c.beginPath();
      c.roundRect(30, y - 22, 108, 44, 10);
      c.fill();
      c.stroke();
      c.fillStyle = isName ? PINK : isDrink ? AMBER : INK;
      c.font = '500 22px Inter, system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(VOCAB[id], 84, y);
      c.fillStyle = MUTE;
      c.font = '15px Inter, system-ui, sans-serif';
      c.fillText('n° ' + id, 164, y - 14);
    });

    // 2 · La table des boutons : une ligne par token du vocabulaire.
    c.globalAlpha = shown(1);
    table.forEach((row, r) => {
      const used = ids.includes(r);
      row.forEach((v, k) => {
        c.fillStyle = tone(v, used ? 1.4 : 3.5);
        c.fillRect(TABLE.x + k * TABLE.cell, TABLE.y + r * TABLE.row, TABLE.cell - 1, TABLE.row - 2);
      });
    });
    ids.forEach((id, i) => {
      const y = ROW(i), rowY = TABLE.y + id * TABLE.row + TABLE.row / 2 - 1, right = TABLE.x + 24 * TABLE.cell;
      this.wire(c, 176, y, TABLE.x - 4, rowY, 1, MUTE, 0.5 * shown(1), flow(i * 0.13));
      this.wire(c, right + 2, rowY, STATION[0] - 6, y, 1, MUTE, 0.5 * shown(2), flow(i * 0.13 + 0.4));
    });

    // 3 · Le flux : trois états successifs de chaque bande.
    inspection.stream.forEach((state, s) => {
      c.globalAlpha = shown(2 + s);
      state.forEach((row, i) => this.band(c, STATION[s], ROW(i), row, s === 2 && i === LAST));
    });
    c.globalAlpha = shown(2);
    c.fillStyle = MUTE;
    c.font = '16px Inter, system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('boutons du mot + boutons de sa place', STATION[0], ROW(LENGTH - 1) + 44);

    // Couches 1 et 2 : les regards, et le rail qui prolonge chaque bande.
    inspection.layers.forEach((layer, l) => {
      const from = STATION[l] + BAND + 6, to = STATION[l + 1] - 6, color = l ? AMBER : CYAN, active = !this.off().includes(l);
      for (let i = 0; i < LENGTH; i++) {
        this.wire(c, from, ROW(i), to, ROW(i), 1, LINE, shown(3 + l), -1);
        if (!active) continue;
        // En couche 2, seul le regard de la question mène à la réponse : les autres sont estompés.
        const matters = l === 0 || i === LAST ? 1 : 0.3;
        for (let j = 0; j < i; j++) {
          const weight = layer.weight[i][j];
          if (weight < 0.05) continue;
          this.wire(c, from, ROW(j), to, ROW(i), 1 + weight * 7, color, weight * matters * shown(3 + l), flow(i * 0.21 + j * 0.37), Math.ceil(weight * 4));
        }
      }
      if (!active) {
        c.globalAlpha = shown(3 + l);
        c.fillStyle = '#ff8a8a';
        c.font = '600 19px Inter, system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText('débranchée', (from + to) / 2, ROW(0) - 44);
      }
    });

    // 4 · La lecture : de la dernière bande aux probabilités.
    const best = probs.indexOf(Math.max(...probs));
    probs.forEach((p, j) => {
      const y = BAR.y + j * BAR.step, right = j === this.puzzle().target;
      if (p > 0.03) this.wire(c, STATION[2] + BAND + 6, ROW(LAST), BAR.x - 8, y, 1 + p * 7, AMBER, p * shown(5), flow(j * 0.17), Math.ceil(p * 4));
      c.globalAlpha = shown(5);
      c.fillStyle = j === best ? INK : MUTE;
      c.font = (j === best ? '600 ' : '') + '18px Inter, system-ui, sans-serif';
      c.textAlign = 'left';
      c.fillText(VOCAB[j], BAR.x, y);
      c.fillStyle = '#1b2442';
      c.fillRect(BAR.x + 70, y - 9, BAR.width, 18);
      c.fillStyle = right ? AMBER : CYAN;
      c.fillRect(BAR.x + 70, y - 9, BAR.width * p, 18);
      if (p >= 0.05) {
        c.fillStyle = INK;
        c.font = '16px Inter, system-ui, sans-serif';
        c.fillText(pct(p), BAR.x + 76 + BAR.width * p, y);
      }
    });
    c.globalAlpha = 1;
  }

  private band(c: CanvasRenderingContext2D, x: number, y: number, values: readonly number[], framed: boolean): void {
    c.fillStyle = '#131a30';
    c.fillRect(x - 3, y - 16, BAND + 5, 32);
    values.forEach((v, k) => {
      c.fillStyle = tone(v);
      c.fillRect(x + k * CELL, y - 13, CELL - 1, 26);
    });
    if (framed) {
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.strokeRect(x - 3, y - 16, BAND + 5, 32);
    }
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
    c.fillStyle = color === MUTE ? INK : '#fff';
    for (let g = 0; g < grains; g++) {
      const [x, y] = along(x0, y0, x1, y1, (phase + g / grains) % 1);
      c.beginPath();
      c.arc(x, y, 1.6 + width * 0.22, 0, Math.PI * 2);
      c.fill();
    }
  }

  ngOnDestroy(): void {
    this.painter.stop();
    this.trainer.stop();
    this.zoomer.stop();
  }
}
