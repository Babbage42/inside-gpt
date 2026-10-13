import { AfterViewInit, Component, ElementRef, OnDestroy, computed, input, output, signal, viewChild } from '@angular/core';
import { FrameLoop, big, num, pct } from '../shared';
import { MiniGpt } from '../engine/mini-gpt';
import { WORDS, encode } from '../engine/mini-world';
import type { Meta } from './ch10-machine';
import { AMBER, CYAN, H, HEAD_COLORS, HEAD_NAMES, INK, LINE, MUTE, MachineScene, NIGHT, PINK, RAISE, W, font, layout, paintMachine, rank, strip, tone, wire } from './machine-paint';

const GPT3 = 175e9;
const QUESTION = ['où', 'vit', 'le', 'zèbre', '?'];
const HOLD = 2.8;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

interface Level {
  readonly title: string;
  readonly text: string;
  /** Le chapitre où cette échelle a été expliquée, et son numéro dans le sommaire. */
  readonly chapter: string;
  readonly index: number;
}

/**
 * La lecture du zoom : une pause sur chaque palier, puis le recul vers le suivant.
 * Le dernier recul traverse beaucoup plus d'échelles que les autres : on lui laisse plus de temps.
 */
export function play(state: { position: number; held: number }, dt: number, end: number): { position: number; held: number; done: boolean } {
  const { position, held } = state, from = Math.floor(position + 1e-6);
  if (position >= end) return { position: end, held, done: true };
  if (position - from < 1e-6 && held < HOLD) return { position, held: held + dt, done: false };
  const reached = position + dt / (from === end - 1 ? 6 : 2.6) >= from + 1 - 1e-6;
  return reached ? { position: from + 1, held: 0, done: false } : { position: position + dt / (from === end - 1 ? 6 : 2.6), held, done: false };
}

/** Un cadre 16:9 de largeur w centré en (cx, cy). */
const frame = (cx: number, cy: number, w: number): Rect => ({ x: cx - w / 2, y: cy - (w * 9) / 32, w });
const smooth = (a: number, b: number, t: number) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * Le grand zoom : huit échelles emboîtées, d'une multiplication à GPT-3, parcourues d'un seul mouvement.
 * Chaque échelle est dessinée dans un cadre de 1600 × 900 ; quand on recule, ce cadre se réduit
 * jusqu'à n'être plus qu'un détail de l'échelle suivante.
 */
@Component({
  selector: 'v4-grand-zoom',
  template: `
    <div class="fresco zoom"><canvas #stage [attr.aria-label]="'Grand zoom, palier ' + (palier() + 1) + ' sur ' + levels().length + ' : ' + levels()[palier()].title"></canvas></div>
    <div class="panel wide zoom-console">
      <div class="time">
        <button type="button" class="primary" (click)="toggle()">{{ playing() ? 'Pause' : position() >= levels().length - 1 ? 'Rejouer depuis le début' : 'Lancer le zoom' }}</button>
        <input type="range" min="0" [max]="levels().length - 1" step="0.01" [value]="position()" (input)="scrub(+$any($event.target).value)" aria-label="Échelle du zoom" />
      </div>
      <div class="controls">
        @for (level of levels(); track level.title) { <button type="button" [class.primary]="palier() === $index" (click)="scrub($index)">{{ $index + 1 }} · {{ level.title }}</button> }
      </div>
      <p class="phase"><strong>{{ levels()[palier()].title }}.</strong> {{ levels()[palier()].text }} <button type="button" class="link" (click)="jump.emit(levels()[palier()].index)">{{ levels()[palier()].chapter }} ↗</button></p>
    </div>
  `,
})
export class GrandZoom implements AfterViewInit, OnDestroy {
  readonly model = input.required<MiniGpt>();
  readonly meta = input.required<Meta>();
  readonly jump = output<number>();
  readonly finished = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('stage');
  private readonly loop = new FrameLoop();
  readonly position = signal(0);
  readonly playing = signal(false);
  readonly palier = computed(() => Math.round(this.position()));
  private held = 0;
  private clock = 0;

  /** Tous les nombres du zoom, tirés de la machine pour la phrase « où vit le zèbre ? dans la… ». */
  private readonly data = computed(() => {
    const model = this.model(), config = model.config, steps: MachineScene[] = [];
    const words = [...QUESTION];
    // La machine écrit sa réponse mot à mot : un passage complet par mot.
    for (let n = 0; n < 4; n++) {
      const ids = encode(words), trace = model.trace(ids), ranked = rank(trace.logits);
      steps.push({ config, ids, trace, ranked, table: model.embeddingTable(), written: n, offLayers: [], offHeads: [], glimpses: trace.lens.map((l) => rank(l)[0]) });
      words.push(WORDS[ranked[0].id]);
    }
    const scene = steps[2], last = scene.ids.length - 1, animal = 3;
    // Le regard qui va chercher l'animal : celui qui consulte le plus « zèbre » depuis le dernier mot.
    let layer = 0, head = 0;
    scene.trace.layers.forEach((l, li) => l.heads.forEach((h, hi) => {
      if (h.attention[last][animal] > scene.trace.layers[layer].heads[head].attention[last][animal]) [layer, head] = [li, hi];
    }));
    const look = scene.trace.layers[layer].heads[head], query = look.query[last], key = look.key[animal];
    const products = query.map((q, i) => q * key[i]);
    // On montre le produit qui pèse le plus en faveur de ce regard.
    const best = products.reduce((b, p, i) => (p > products[b] ? i : b), 0);
    const mixed = look.value[0].map((_, i) => look.value.slice(0, last + 1).reduce((sum, v, j) => sum + look.attention[last][j] * v[i], 0));
    return { config, steps, scene, last, animal, layer, head, look, query, key, products, best, mixed, sentence: words.slice(QUESTION.length), answer: scene.ranked[0], copies: Math.round(GPT3 / this.meta().parameters) };
  });

  readonly levels = computed<Level[]>(() => {
    const d = this.data(), meta = this.meta(), steps = meta.report[meta.report.length - 1].step;
    return [
      { title: 'Une multiplication', text: `Deux nombres, un produit : ${num(d.query[d.best])} × ${num(d.key[d.best])} = ${num(d.products[d.best])}. C’est le geste du chapitre 3 : deux boutons qu’on multiplie. Même signe, le produit est positif.`, chapter: 'Chapitre 3', index: 2 },
      { title: 'Une comparaison', text: `${d.query.length} multiplications, puis une addition. Le total dit à quel point la question que pose « la » ressemble à l’étiquette de « zèbre ».`, chapter: 'Chapitre 6, le capot', index: 5 },
      { title: 'Un regard', text: `La même comparaison avec chaque mot précédent. Seul l’écart entre les notes compte : « zèbre » a la plus haute, de loin, et reçoit ${pct(d.look.attention[d.last][d.animal])} du regard. « la » reçoit alors un mélange des contenus, dosé par ces parts.`, chapter: 'Chapitre 6', index: 5 },
      { title: 'Une couche', text: `${d.config.heads} regards en parallèle, puis ${d.config.hidden} neurones : chacun fait une somme pondérée et applique son pli. Le résultat s’ajoute à la bande du mot.`, chapter: 'Chapitre 5', index: 4 },
      { title: 'La machine', text: `${d.config.layers} couches, pour chacun des ${d.scene.ids.length} mots. Un seul passage : ${big(this.model().multiplications(d.scene.ids.length))} multiplications. À la sortie : « ${WORDS[d.answer.id]} », à ${pct(d.answer.value)}.`, chapter: 'Chapitre 9', index: 8 },
      { title: 'Une phrase', text: `Un passage complet par mot écrit. Chaque mot produit rejoint le texte, et la machine repart : c’est la boucle du chapitre 2.`, chapter: 'Chapitre 2', index: 1 },
      { title: 'Un entraînement', text: `Pour en arriver là : ${big(steps)} pas. À chaque pas, ${meta.batch} textes lus, et les ${big(meta.parameters)} boutons tournés un peu, dans le sens qui réduit la surprise.`, chapter: 'Chapitre 4', index: 3 },
      { title: 'GPT-3', text: `Le même plan, avec ${big(d.copies)} fois plus de boutons : ${big(GPT3)}. Entraîné non sur douze animaux, mais sur une bonne part de ce que l’humanité a écrit.`, chapter: 'Chapitre 7', index: 6 },
    ];
  });

  /** Où se loge chaque échelle dans la suivante. */
  private readonly anchors = computed<Rect[]>(() => {
    const d = this.data(), place = layout(d.config, d.scene.ids.length);
    const zone = place.station(d.layer + 1) + place.band - place.station(d.layer);
    return [
      frame(200 + d.best * 50 + 25, 560, 150),
      frame(this.wordX(d.animal), 470, 170),
      frame(610, d.head === 0 ? 315 : 585, 280),
      frame(place.station(d.layer) + zone / 2, place.row(d.last), zone + 30),
      { x: 60 + 2 * 380, y: 330, w: 340 },
      frame(1438, 692, 150),
      frame(W / 2, H / 2, W / Math.sqrt(d.copies)),
    ];
  });

  private thumbs: HTMLCanvasElement[] = [];
  private pattern: CanvasPattern | null = null;

  ngAfterViewInit(): void {
    const canvas = this.canvas().nativeElement, ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    const context = canvas.getContext('2d')!;
    // Une vignette de la machine par mot écrit, puis le motif qui pave la dernière échelle.
    this.thumbs = this.data().steps.map((scene) => {
      const thumb = document.createElement('canvas');
      thumb.width = 680;
      thumb.height = 382;
      const c = thumb.getContext('2d')!;
      c.scale(680 / W, 680 / W);
      paintMachine(c, scene, 0.4);
      return thumb;
    });
    this.pattern = context.createPattern(this.thumbs[2], 'repeat');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    this.loop.start(() => {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.clock += dt;
      if (this.playing()) this.advance(still ? 1 : dt);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.paint(context);
      return true;
    });
  }

  toggle(): void {
    if (this.playing()) return this.playing.set(false);
    if (this.position() >= this.levels().length - 1) this.position.set(0);
    this.held = HOLD * 0.6;
    this.playing.set(true);
  }

  scrub(position: number): void {
    this.playing.set(false);
    this.position.set(position);
    if (position >= this.levels().length - 1) this.finished.emit();
  }

  /** Avance la lecture d'une image, et signale la fin du parcours. */
  private advance(dt: number): void {
    const next = play({ position: this.position(), held: this.held }, dt, this.levels().length - 1);
    this.held = next.held;
    this.position.set(next.position);
    if (!next.done) return;
    this.playing.set(false);
    this.finished.emit();
  }

  private paint(c: CanvasRenderingContext2D): void {
    const p = this.position(), end = this.levels().length - 1, k = Math.min(end, Math.floor(p + 1e-6)), t = p - k;
    c.globalAlpha = 1;
    c.fillStyle = NIGHT;
    c.fillRect(0, 0, W, H);
    if (t < 1e-4 || k >= end) {
      this.draw(c, k, 1);
      if (k >= end) this.census(c, 1);
      return;
    }
    // On recule : l'échelle k se réduit autour d'un point fixe jusqu'à tenir dans son cadre de l'échelle k + 1.
    const anchor = this.anchors()[k], ratio = anchor.w / W, u = smooth(0, 1, t);
    const px = anchor.x / (1 - ratio), py = anchor.y / (1 - ratio), outer = Math.pow(1 / ratio, 1 - u);
    c.save();
    c.translate(px, py);
    c.scale(outer, outer);
    c.translate(-px, -py);
    this.draw(c, k + 1, smooth(0.05, 0.5, u));
    c.translate(anchor.x, anchor.y);
    c.scale(ratio, ratio);
    this.draw(c, k, 1 - smooth(0.5, 0.92, u));
    c.restore();
    if (k === end - 1) this.census(c, u);
  }

  /** Pendant le dernier recul : le nombre de machines visibles à l'écran, qui grimpe jusqu'à la taille de GPT-3. */
  private census(c: CanvasRenderingContext2D, u: number): void {
    const copies = this.data().copies, visible = Math.round(Math.pow(copies, u)), alpha = smooth(0.12, 0.3, u);
    if (alpha <= 0) return;
    const shade = c.createLinearGradient(0, 560, 0, H);
    shade.addColorStop(0, 'rgba(11,16,32,0)');
    shade.addColorStop(0.45, 'rgba(11,16,32,0.92)');
    c.globalAlpha = alpha;
    c.fillStyle = shade;
    c.fillRect(0, 560, W, H - 560);
    c.textBaseline = 'middle';
    this.label(c, big(visible), 70, 760, 120, AMBER, 'left', '600');
    this.label(c, visible > 1 ? 'machines comme la tienne à l’écran' : 'machine', 76, 846, 30, INK, 'left');
    if (u >= 1) this.label(c, `= ${big(GPT3)} boutons : GPT-3`, W - 70, 846, 34, '#6ee7a8', 'right', '600');
    c.globalAlpha = 1;
  }

  private draw(c: CanvasRenderingContext2D, level: number, alpha: number): void {
    if (alpha <= 0.004) return;
    c.save();
    c.globalAlpha = alpha;
    c.textBaseline = 'middle';
    if (level !== 7) {
      c.fillStyle = NIGHT;
      c.fillRect(0, 0, W, H);
    }
    [this.multiplication, this.comparison, this.look, this.layer, this.machine, this.sentence, this.training, this.giant][level].call(this, c);
    c.restore();
  }

  private wordX(i: number): number {
    return 250 + i * 195;
  }

  private label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size = 26, color = MUTE, align: CanvasTextAlign = 'center', weight = ''): void {
    c.fillStyle = color;
    c.font = font(size, weight);
    c.textAlign = align;
    c.fillText(text, x, y);
  }

  private box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke = LINE, line = 2): void {
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = line;
    c.beginPath();
    c.roundRect(x, y, w, h, 18);
    c.fill();
    c.stroke();
  }

  // 1 · Deux nombres, un produit.
  private multiplication(c: CanvasRenderingContext2D): void {
    const d = this.data(), values = [d.query[d.best], d.key[d.best], d.products[d.best]];
    const labels = ['un nombre de la question de « la »', 'un nombre de l’étiquette de « zèbre »', 'leur produit'];
    values.forEach((value, i) => {
      const x = 140 + i * 500;
      this.box(c, x, 300, 320, 260, RAISE);
      c.fillStyle = tone(value, 1.6);
      c.beginPath();
      c.roundRect(x + 10, 310, 300, 240, 12);
      c.fill();
      this.label(c, num(value), x + 160, 432, 96, '#fff', 'center', '600');
      this.label(c, labels[i], x + 160, 610, 25);
      if (i < 2) this.label(c, i === 0 ? '×' : '=', x + 410, 430, 110, INK);
    });
    this.label(c, 'Même signe : produit positif. Signes opposés : négatif.', W / 2, 740, 28, INK);
  }

  // 2 · Vingt-quatre produits, une somme.
  private comparison(c: CanvasRenderingContext2D): void {
    const d = this.data(), rows: [string, readonly number[], number, number][] = [
      ['la question que pose « la »', d.query, 250, 1.6],
      ['l’étiquette de « zèbre »', d.key, 405, 1.6],
      ['les produits, case par case', d.products, 560, Math.max(...d.products.map(Math.abs)) * 0.9],
    ];
    for (const [name, values, y, scale] of rows) {
      this.label(c, name, 200, y - 62, 26, MUTE, 'left');
      values.forEach((v, i) => {
        c.fillStyle = RAISE;
        c.fillRect(200 + i * 50, y - 38, 46, 76);
        c.fillStyle = tone(v, scale);
        c.fillRect(200 + i * 50, y - 38, 46, 76);
      });
    }
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.strokeRect(198 + d.best * 50, 208, 50, 394);
    const score = d.look.score[d.last][d.animal];
    this.label(c, `somme des ${d.products.length} produits ÷ √${d.products.length}  =`, W / 2 - 60, 742, 34, INK, 'right');
    this.label(c, num(score), W / 2 - 30, 742, 72, AMBER, 'left', '600');
    this.label(c, 'la ressemblance entre « la » et « zèbre »', W / 2, 826, 26);
  }

  // 3 · Un regard : comparer à chaque mot précédent, puis mélanger.
  private look(c: CanvasRenderingContext2D): void {
    const d = this.data(), words = d.scene.ids.map((id) => WORDS[id]), color = HEAD_COLORS[d.head], weights = d.look.attention[d.last];
    words.forEach((word, i) => {
      const x = this.wordX(i), weight = weights[i];
      if (i < d.last) {
        c.globalAlpha *= 0.15 + weight * 0.85;
        c.strokeStyle = color;
        c.lineWidth = 2 + weight * 16;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(this.wordX(d.last), 262);
        c.quadraticCurveTo((x + this.wordX(d.last)) / 2, 262 - 60 - (this.wordX(d.last) - x) * 0.16, x, 262);
        c.stroke();
        c.globalAlpha /= 0.15 + weight * 0.85;
      }
      this.box(c, x - 82, 268, 164, 70, RAISE, i === d.last ? AMBER : i === d.animal ? color : LINE, i === d.last || i === d.animal ? 4 : 2);
      this.label(c, word, x, 304, 34, INK, 'center', '500');
      if (i === d.last) return this.label(c, 'le mot qui regarde', x, 380, 22);
      this.label(c, num(d.look.score[d.last][i], 1), x, 470, 40, i === d.animal ? '#fff' : MUTE, 'center', i === d.animal ? '600' : '');
      c.fillStyle = RAISE;
      c.fillRect(x - 24, 520, 48, 170);
      c.fillStyle = color;
      c.fillRect(x - 24, 690 - 170 * weight, 48, 170 * weight);
      this.label(c, pct(weight), x, 722, 28, i === d.animal ? color : MUTE);
    });
    this.label(c, 'ressemblance', 40, 470, 22, MUTE, 'left');
    this.label(c, 'part du regard', 40, 606, 22, MUTE, 'left');
    this.label(c, 'ce que « la » reçoit : le mélange des contenus, dosé par ces parts', 200, 800, 24, MUTE, 'left');
    strip(c, 200, 850, 1200, 40, d.mixed, 1.6);
  }

  // 4 · Une couche, vue depuis le dernier mot : deux regards, puis les neurones.
  private layer(c: CanvasRenderingContext2D): void {
    const d = this.data(), trace = d.scene.trace, layer = trace.layers[d.layer], words = d.scene.ids.map((id) => WORDS[id]), flow = (phase: number) => (this.clock * 0.35 + phase) % 1;
    this.label(c, 'la bande de « la », avant', 60, 388, 23, MUTE, 'left');
    strip(c, 60, 450, 280, 50, trace.stream[d.layer][d.last]);
    layer.heads.forEach((head, h) => {
      const y = h === 0 ? 315 : 585, weights = head.attention[d.last], top = weights.indexOf(Math.max(...weights));
      wire(c, 346, 450, 470, y, 4, HEAD_COLORS[h], 0.8, flow(h * 0.4), 2);
      this.box(c, 470, y - 79, 280, 158, RAISE, HEAD_COLORS[h], 3);
      this.label(c, `regard ${HEAD_NAMES[h]}`, 610, y - 38, 28, HEAD_COLORS[h], 'center', '600');
      this.label(c, top === d.last ? 'se regarde lui-même' : `consulte « ${words[top]} »`, 610, y + 6, 25, INK);
      this.label(c, pct(weights[top]) + ' de son attention', 610, y + 42, 22);
      wire(c, 756, y, 838, 450, 4, HEAD_COLORS[h], 0.8, flow(h * 0.4 + 0.5), 2);
    });
    this.label(c, '+', 860, 448, 60, INK);
    wire(c, 346, 450, 838, 450, 2, LINE, 1, -1);
    wire(c, 884, 450, 940, 450, 4, MUTE, 0.9, flow(0.2), 1);
    const neurons = layer.neurons[d.last], peak = Math.max(...neurons, 1e-6);
    this.box(c, 940, 290, 290, 320, RAISE);
    this.label(c, `${neurons.length} neurones`, 1085, 322, 26, INK, 'center', '600');
    neurons.forEach((v, i) => {
      c.fillStyle = v > 0 ? `rgba(255,255,255,${0.2 + 0.8 * (v / peak)})` : '#0d1326';
      c.fillRect(962 + (i % 12) * 21, 352 + Math.floor(i / 12) * 28, 17, 22);
    });
    this.label(c, `${neurons.filter((v) => v > 0).length} allumés : somme pondérée, puis pli`, 1085, 590, 20);
    wire(c, 1236, 450, 1290, 450, 4, MUTE, 0.9, flow(0.7), 1);
    this.label(c, 'après', 1300, 388, 23, MUTE, 'left');
    strip(c, 1300, 450, 270, 50, trace.stream[d.layer + 1][d.last]);
    this.label(c, `Couche ${d.layer + 1} : chaque pièce ajoute quelque chose à la bande, sans rien effacer.`, W / 2, 760, 28, INK);
  }

  // 5 · La machine entière.
  private machine(c: CanvasRenderingContext2D): void {
    paintMachine(c, this.data().scene, this.clock);
  }

  // 6 · Une phrase : un passage par mot écrit.
  private sentence(c: CanvasRenderingContext2D): void {
    const d = this.data();
    this.label(c, 'où vit le zèbre ?', W / 2, 150, 52, INK, 'center', '500');
    this.thumbs.forEach((thumb, i) => {
      const x = 60 + i * 380;
      c.drawImage(thumb, x, 330, 340, 191);
      c.strokeStyle = i === 2 ? AMBER : LINE;
      c.lineWidth = i === 2 ? 4 : 2;
      c.strokeRect(x, 330, 340, 191);
      this.label(c, `passage ${i + 1}`, x + 170, 300, 22);
      this.label(c, d.sentence[i], x + 170, 590, 54, AMBER, 'center', '600');
      if (i < 3) wire(c, x + 250, 600, x + 380 + 60, 325, 3, AMBER, 0.8, (this.clock * 0.4 + i * 0.3) % 1, 2);
    });
    this.label(c, 'Chaque mot écrit rejoint le texte lu au passage suivant.', W / 2, 730, 28, INK);
  }

  // 7 · L'entraînement : la surprise descend, pas après pas.
  private training(c: CanvasRenderingContext2D): void {
    const report = this.meta().report, steps = report[report.length - 1].step, top = report[0].loss;
    const x = (step: number) => 150 + (step / steps) * 1290, y = (value: number, max: number) => 700 - (value / max) * 520;
    c.strokeStyle = LINE;
    c.lineWidth = 2;
    c.strokeRect(150, 180, 1290, 520);
    const curve = (values: readonly number[], max: number, color: string, width: number) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineJoin = 'round';
      c.beginPath();
      values.forEach((v, i) => (i ? c.lineTo(x(report[i].step), y(v, max)) : c.moveTo(x(report[i].step), y(v, max))));
      c.stroke();
    };
    curve(report.map((r) => r.scores['vérité']), 1, CYAN, 4);
    curve(report.map((r) => r.scores['question']), 1, PINK, 4);
    curve(report.map((r) => r.loss), top, AMBER, 7);
    this.label(c, 'la surprise descend', 190, 235, 28, AMBER, 'left', '600');
    this.label(c, 'phrases vraies', 1420, 215, 24, CYAN, 'right');
    this.label(c, 'questions jamais posées', 1420, 300, 24, PINK, 'right');
    this.label(c, '0', 150, 740, 24);
    this.label(c, `${big(steps)} pas`, 1440, 740, 24, MUTE, 'right');
    this.label(c, 'pas d’entraînement →', W / 2, 740, 24);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(1438, 692, 9, 0, Math.PI * 2);
    c.fill();
    this.label(c, 'la machine que tu viens de voir', 1410, 660, 22, INK, 'right');
  }

  // 8 · La même machine, des millions de fois : la taille de GPT-3.
  private giant(c: CanvasRenderingContext2D): void {
    if (!this.pattern) return;
    const tile = W / Math.sqrt(this.data().copies);
    c.fillStyle = '#141c38';
    c.fillRect(0, 0, W, H);
    this.pattern.setTransform(new DOMMatrix().scale(tile / 680));
    c.fillStyle = this.pattern;
    c.fillRect(0, 0, W, H);
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
