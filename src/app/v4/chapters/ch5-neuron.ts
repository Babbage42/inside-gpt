import { Component, ElementRef, OnDestroy, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { Chapter, FrameLoop, big, num, pct } from '../shared';
import { Point, TinyNet, points } from '../engine/neural';

const SIZE = 90;
const STEPS = 300;

interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Droite a·x + b·y + c = 0, tracée assez longue pour traverser le plan. */
function lineOf(a: number, b: number, c: number): Segment {
  const norm = a * a + b * b || 1e-9, length = Math.sqrt(norm);
  const px = (-c * a) / norm, py = (-c * b) / norm, dx = (-b / length) * 4, dy = (a / length) * 4;
  return { x1: px - dx, y1: -(py - dy), x2: px + dx, y2: -(py + dy) };
}

/** Le plan des points, coloré par la sortie du réseau. */
@Component({
  selector: 'v4-plane',
  template: `
    <div class="plane">
      <canvas #heat width="90" height="90"></canvas>
      <svg viewBox="-1.1 -1.1 2.2 2.2" (pointermove)="move($event)" (pointerdown)="move($event)">
        @for (s of lines(); track $index) { <line class="fold" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" /> }
        @for (p of data(); track $index) { <circle [attr.cx]="p.x" [attr.cy]="-p.y" r="0.04" [class.one]="p.label" [class.miss]="missed(p)" /> }
        @if (probe(); as at) { <circle class="probe" [attr.cx]="at[0]" [attr.cy]="-at[1]" r="0.06" /> }
      </svg>
    </div>
  `,
})
export class Plane {
  readonly net = input.required<TinyNet>();
  readonly data = input.required<readonly Point[]>();
  readonly tick = input(0);
  readonly probe = input<readonly [number, number] | null>(null);
  readonly probed = output<[number, number]>();
  private readonly heat = viewChild.required<ElementRef<HTMLCanvasElement>>('heat');

  readonly lines = computed<Segment[]>(() => {
    this.tick();
    const net = this.net();
    if (!net.hidden) return [lineOf(net.w2.data[0], net.w2.data[1], net.b2.data[0])];
    return Array.from({ length: net.hidden }, (_, h) => lineOf(net.w1.data[h * 2], net.w1.data[h * 2 + 1], net.b1.data[h]));
  });

  constructor() {
    effect(() => {
      this.tick();
      const net = this.net(), context = this.heat().nativeElement.getContext('2d')!;
      const image = context.createImageData(SIZE, SIZE);
      for (let row = 0; row < SIZE; row++)
        for (let col = 0; col < SIZE; col++) {
          const out = net.pass(((col + 0.5) / SIZE) * 2.2 - 1.1, 1.1 - ((row + 0.5) / SIZE) * 2.2).output;
          const i = (row * SIZE + col) * 4;
          image.data[i] = 24 + out * 150;
          image.data[i + 1] = 84 + out * 14;
          image.data[i + 2] = 112 - out * 78;
          image.data[i + 3] = 255;
        }
      context.putImageData(image, 0, 0);
    });
  }

  missed(p: Point): boolean {
    this.tick();
    return this.net().pass(p.x, p.y).output > 0.5 !== (p.label === 1);
  }

  move(event: PointerEvent): void {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    this.probed.emit([((event.clientX - box.left) / box.width) * 2.2 - 1.1, 1.1 - ((event.clientY - box.top) / box.height) * 2.2]);
  }
}

@Component({
  selector: 'v4-ch-neuron',
  imports: [Plane],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 5 · Le neurone</p>
      <h1>La brique de base : <em>le neurone</em></h1>
      <p class="lede">On parle de « réseau de neurones » depuis le début. Ouvrons-en un. Un neurone est une chose très simple ; toute la puissance vient de leur assemblage.</p>
    </header>

    <section class="moment wide">
      <div class="prose">
        <h2>Une somme pondérée, puis une mise en forme</h2>
        <p>Un neurone reçoit des nombres. Il multiplie chacun par un <strong>poids</strong>, additionne le tout avec un <strong>biais</strong> : cela donne un score. Puis il écrase ce score entre 0 et 1.</p>
        <p>Ici, ses deux entrées sont la position d’un point (x, y). Sa sortie répond à une question : <em>ce point est-il orange ?</em> Le fond du plan montre sa réponse partout.</p>
        <p class="do">Règle ses trois curseurs pour que le fond orange recouvre les points orange.</p>
        @for (knob of knobs; track knob.label) {
          <label class="slider">{{ knob.label }} : <strong>{{ num(knob.read(solo), 1) }}</strong>
            <input type="range" min="-8" max="8" step="0.1" [value]="knob.read(solo)" (input)="set(solo, knob.index, +$any($event.target).value)" />
          </label>
        }
        <dl class="meters"><div><dt>Points bien classés</dt><dd>{{ right(solo, line) }} / {{ line.length }}</dd></div><div><dt>Réglages</dt><dd>3</dd></div></dl>
        <div class="controls"><button type="button" [disabled]="loop.running()" (click)="train(solo, line)">Laisser la pente régler</button></div>
        <p class="note">Géométriquement, un neurone trace une <strong>frontière droite</strong> (le pointillé). Les poids l’orientent, le biais la déplace.</p>
        @if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'neuron-wall')">Continuer</button> }
      </div>
      <div class="stage">
        <v4-plane [net]="solo" [data]="line" [tick]="tick()" [probe]="probe()" (probed)="probe.set($event)" />
        <p class="tiny spaced">Le calcul pour le point survolé</p>
        <svg class="neuron" viewBox="0 0 440 150" role="img" aria-label="Schéma du neurone">
          <line x1="70" y1="38" x2="212" y2="72" class="wire" [attr.stroke-width]="thick(solo.w2.data[0])" [class.neg]="solo.w2.data[0] < 0" />
          <line x1="70" y1="112" x2="212" y2="78" class="wire" [attr.stroke-width]="thick(solo.w2.data[1])" [class.neg]="solo.w2.data[1] < 0" />
          <line x1="262" y1="75" x2="352" y2="75" class="wire thin" />
          <g class="node"><rect x="14" y="20" width="56" height="36" rx="8" /><text x="42" y="43">x {{ num(probe()[0], 1) }}</text></g>
          <g class="node"><rect x="14" y="94" width="56" height="36" rx="8" /><text x="42" y="117">y {{ num(probe()[1], 1) }}</text></g>
          <text x="138" y="40" class="weight">× {{ num(solo.w2.data[0], 1) }}</text>
          <text x="138" y="122" class="weight">× {{ num(solo.w2.data[1], 1) }}</text>
          <g class="node sum"><circle cx="237" cy="75" r="27" /><text x="237" y="72" class="small">score</text><text x="237" y="89">{{ num(soloPass().score, 1) }}</text></g>
          <text x="237" y="22" class="weight">+ biais {{ num(solo.b2.data[0], 1) }}</text>
          <text x="307" y="66" class="weight">écrase</text>
          <g class="node out"><rect x="352" y="52" width="74" height="46" rx="10" [attr.fill]="shade(soloPass().output)" /><text x="389" y="80">{{ pct(soloPass().output) }}</text></g>
          <text x="389" y="118" class="weight">chance d’être orange</text>
        </svg>
      </div>
    </section>

    @if (step() >= 1) {
      <section class="moment wide" id="neuron-wall">
        <div class="prose">
          <h2>Le mur : une droite ne suffit pas toujours</h2>
          <p>Nouveaux points : les orange sont <strong>encerclés</strong> par les bleus. Même neurone, mêmes curseurs.</p>
          <p class="do">Essaie. Puis laisse la pente essayer à ta place.</p>
          @for (knob of knobs; track knob.label) {
            <label class="slider">{{ knob.label }} : <strong>{{ num(knob.read(alone), 1) }}</strong>
              <input type="range" min="-8" max="8" step="0.1" [value]="knob.read(alone)" (input)="set(alone, knob.index, +$any($event.target).value)" />
            </label>
          }
          <dl class="meters"><div><dt>Points bien classés</dt><dd>{{ right(alone, ring) }} / {{ ring.length }}</dd></div><div><dt>Réglages</dt><dd>3</dd></div></dl>
          <div class="controls"><button type="button" [disabled]="loop.running()" (click)="train(alone, ring)">Laisser la pente essayer</button></div>
          <p class="note">Rien à faire. Ce n’est pas un mauvais réglage : c’est une <strong>limite du neurone seul</strong>. Aucune droite ne sépare un cercle de ce qui l’entoure.</p>
          @if (step() === 1) { <button type="button" class="primary" (click)="reveal(2, 'neuron-net')">Et avec plusieurs neurones ?</button> }
        </div>
        <div class="stage"><v4-plane [net]="alone" [data]="ring" [tick]="tick()" /></div>
      </section>
    }

    @if (step() >= 2) {
      <section class="moment wide" id="neuron-net">
        <div class="prose">
          <h2>Plusieurs neurones, et un dernier qui les écoute</h2>
          <p>On place plusieurs neurones côte à côte : une <strong>couche</strong>. Chacun trace sa propre droite. Un dernier neurone additionne leurs réponses pour décider.</p>
          <p>Un détail change tout. Avant de répondre, chaque neurone de la couche applique un <strong>pli</strong> : si sa somme est négative, il se tait (0) ; sinon il la transmet telle quelle.</p>
          <svg class="relu" viewBox="0 0 200 70" aria-label="Le pli : zéro pour une somme négative, la somme elle-même sinon">
            <line x1="10" y1="52" x2="190" y2="52" class="axis" /><line x1="100" y1="6" x2="100" y2="64" class="axis" />
            <polyline points="10,52 100,52 148,6" /><text x="14" y="46">se tait</text><text x="154" y="20">transmet</text>
          </svg>
          <p class="do">Choisis le nombre de neurones, puis entraîne. Regarde les droites se placer.</p>
          <div class="chips">
            @for (n of sizes; track n) { <button type="button" [class.on]="hidden() === n" style="--tone: #ffb454" (click)="resize(n)">{{ n }} neurone{{ n > 1 ? 's' : '' }}</button> }
          </div>
          <div class="controls">
            <button type="button" class="primary" [disabled]="loop.running() || team().steps >= total" (click)="train(team(), ring)">{{ loop.running() ? 'Entraînement…' : 'Entraîner' }}</button>
            <button type="button" [disabled]="loop.running()" (click)="resize(hidden())">Recommencer</button>
          </div>
          <dl class="meters"><div><dt>Points bien classés</dt><dd>{{ right(team(), ring) }} / {{ ring.length }}</dd></div><div><dt>Réglages</dt><dd>{{ team().parameterCount }}</dd></div></dl>
          <p class="note">Un neurone : une droite. Deux : un coin. À partir de trois, les droites peuvent former un <strong>enclos</strong>. Plus il y a de neurones, plus la frontière peut épouser une forme compliquée.</p>

          <h2>Sans le pli, tout s’effondre</h2>
          <p>Retire le pli et réentraîne, avec autant de neurones que tu veux. Une somme de sommes reste une somme : tout le réseau se réduit à <strong>une seule droite</strong>.</p>
          <div class="controls"><button type="button" [disabled]="loop.running()" (click)="toggleFold()">{{ fold() ? 'Retirer le pli' : 'Remettre le pli' }}</button></div>
          <p>C’est ce minuscule pli, que les spécialistes appellent une <strong>non-linéarité</strong> (celui-ci se nomme ReLU), qui donne aux réseaux leur pouvoir.</p>
        </div>
        <div class="stage">
          <v4-plane [net]="team()" [data]="ring" [tick]="tick()" [probe]="probe()" (probed)="probe.set($event)" />
          <p class="tiny spaced">Le réseau · trait épais : poids fort · orange : positif · bleu : négatif</p>
          <svg class="neuron" [attr.viewBox]="'0 0 440 ' + diagram().height" role="img" aria-label="Schéma du réseau">
            @for (w of diagram().wires; track $index) { <line class="wire" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" [attr.stroke-width]="thick(w.weight)" [class.neg]="w.weight < 0" /> }
            <g class="node"><rect x="14" [attr.y]="diagram().inputs[0] - 18" width="56" height="36" rx="8" /><text x="42" [attr.y]="diagram().inputs[0] + 5">x</text></g>
            <g class="node"><rect x="14" [attr.y]="diagram().inputs[1] - 18" width="56" height="36" rx="8" /><text x="42" [attr.y]="diagram().inputs[1] + 5">y</text></g>
            @for (n of diagram().nodes; track $index) { <g class="node sum"><circle cx="220" [attr.cy]="n.y" r="13" [attr.fill-opacity]="0.15 + n.glow * 0.85" class="glow" /></g> }
            <g class="node out"><rect x="352" [attr.y]="diagram().height / 2 - 23" width="74" height="46" rx="10" [attr.fill]="shade(teamPass().output)" /><text x="389" [attr.y]="diagram().height / 2 + 5">{{ pct(teamPass().output) }}</text></g>
          </svg>
          <p class="hint">Survole le plan : les neurones allumés sont ceux qui « parlent » pour ce point.</p>
        </div>
      </section>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p><strong>Un neurone</strong> : une somme pondérée, puis un pli. <strong>Une couche</strong> : des neurones côte à côte. <strong>Un réseau</strong> : des couches à la suite. Il n’y a rien d’autre, et c’est la descente de pente qui règle tous les poids.</p>
          <p>Tu en avais déjà croisé sans le savoir : au chapitre 3, chaque barre de prédiction était la sortie d’un neurone. Et dans un grand modèle, chaque mot traverse à chaque couche un réseau de ce type, large de {{ big(49152) }} neurones dans GPT-3.</p>
          <p>Reste la pièce maîtresse. Jusqu’ici, notre machine ne regarde qu’<strong>un seul mot</strong> en arrière. Pour comprendre une phrase, il faut aller chercher la bonne information au bon endroit.</p>
        </div>
      </section>
    }
  `,
})
export class ChNeuron extends Chapter implements OnDestroy {
  readonly num = num;
  readonly pct = pct;
  readonly big = big;
  readonly total = STEPS;
  readonly sizes = [1, 2, 3, 4, 8];
  readonly loop = new FrameLoop();
  readonly line = points('ligne');
  readonly ring = points('anneau');
  readonly tick = signal(0);
  readonly probe = signal<readonly [number, number]>([0.3, 0.4]);

  readonly solo = this.fresh();
  readonly alone = this.fresh();
  readonly hidden = signal(3);
  readonly fold = signal(true);
  readonly team = signal(new TinyNet(3, true, 1));

  readonly knobs = [
    { label: 'Poids de x', index: 0, read: (net: TinyNet) => (this.tick(), net.w2.data[0]) },
    { label: 'Poids de y', index: 1, read: (net: TinyNet) => (this.tick(), net.w2.data[1]) },
    { label: 'Biais', index: 2, read: (net: TinyNet) => (this.tick(), net.b2.data[0]) },
  ];

  readonly soloPass = computed(() => (this.tick(), this.solo.pass(...this.probe())));
  readonly teamPass = computed(() => (this.tick(), this.team().pass(...this.probe())));

  readonly diagram = computed(() => {
    this.tick();
    const net = this.team(), count = net.hidden, height = Math.max(150, count * 34 + 20);
    const inputs = [height / 2 - 40, height / 2 + 40];
    const pass = this.teamPass(), peak = Math.max(...pass.folded.map(Math.abs), 1e-6);
    const nodes = Array.from({ length: count }, (_, h) => ({ y: (height / (count + 1)) * (h + 1), glow: Math.min(1, Math.abs(pass.folded[h]) / peak) }));
    const wires = nodes.flatMap((node, h) => [
      { x1: 70, y1: inputs[0], x2: 207, y2: node.y, weight: net.w1.data[h * 2] },
      { x1: 70, y1: inputs[1], x2: 207, y2: node.y, weight: net.w1.data[h * 2 + 1] },
      { x1: 233, y1: node.y, x2: 352, y2: height / 2, weight: net.w2.data[h] },
    ]);
    return { height, inputs, nodes, wires };
  });

  /** Un neurone seul, volontairement mal réglé au départ. */
  private fresh(): TinyNet {
    const net = new TinyNet(0, true, 3);
    net.w2.data.set([2, 1.5]);
    net.b2.data[0] = -0.5;
    return net;
  }

  set(net: TinyNet, index: number, value: number): void {
    if (index < 2) net.w2.data[index] = value;
    else net.b2.data[0] = value;
    this.tick.update((t) => t + 1);
  }

  right(net: TinyNet, data: readonly Point[]): number {
    this.tick();
    return Math.round(net.accuracy(data) * data.length);
  }

  train(net: TinyNet, data: readonly Point[]): void {
    const goal = net.steps + STEPS;
    this.loop.start(() => {
      net.trainStep(data);
      net.trainStep(data);
      this.tick.update((t) => t + 1);
      return net.steps < goal;
    });
  }

  resize(count: number): void {
    this.loop.stop();
    this.hidden.set(count);
    this.team.set(new TinyNet(count, this.fold(), 1));
    this.tick.update((t) => t + 1);
  }

  toggleFold(): void {
    this.fold.update((f) => !f);
    this.resize(this.hidden());
    this.train(this.team(), this.ring);
  }

  thick(weight: number): number {
    return 0.6 + Math.min(5, Math.abs(weight) * 1.1);
  }

  shade(output: number): string {
    return `rgb(${24 + output * 150}, ${84 + output * 14}, ${112 - output * 78})`;
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
