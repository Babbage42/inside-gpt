import { AfterViewInit, Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { BarRow, Bars, Capot, Chapter, FAMILY_COLOR, FrameLoop, big, num } from '../shared';
import { CapotBackprop } from './capot-backprop';
import { PAIRS, WORDS, WordMap, familyOf, wordId } from '../engine/word-map';
import { MAP_DECAY, MAP_SEED, MAP_STEPS } from './ch3-map';

const LION = wordId('lion');
const GRID = 110;

@Component({
  selector: 'v4-ch-descent',
  imports: [Bars, Capot, CapotBackprop],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 4 · La pente</p>
      <h1>Apprendre, c’est <em>descendre</em></h1>
      <p class="lede">Le bouton « Entraîner » n’a rien de magique. Pour le comprendre, tu vas faire son travail à la main, sur un seul mot.</p>
    </header>

    <section class="moment wide">
      <div class="prose">
        <h2>À toi de placer le lion</h2>
        <p>Voici la carte entraînée. On a décroché le <strong>lion</strong> : il est posé n’importe où.</p>
        <p>À chaque phrase lue, on mesure la <strong>surprise</strong> de la machine : faible si elle donnait une bonne probabilité au vrai mot, forte sinon. Les spécialistes l’appellent la <em>perte</em>. Apprendre, c’est la faire baisser.</p>
        <p class="do">Fais glisser le lion. Cherche l’endroit où la surprise est la plus basse.</p>
        <div class="gauge">
          <span class="tiny">Surprise sur les phrases du lion</span>
          <strong>{{ num(loss()) }}</strong>
          <span class="gauge-track"><span [style.width.%]="gaugeWidth()"></span></span>
          <small>Ton meilleur essai : {{ num(best()) }}@if (step() >= 1) { · fond de la vallée : {{ num(floor) }} }</small>
        </div>

        @if (step() === 0 && moved()) { <button type="button" class="primary" (click)="reveal(1, 'descent-relief')">Révéler le relief</button> }

        @if (step() >= 1) {
          <h2 id="descent-relief">Le paysage caché</h2>
          <p>Chaque endroit de la carte a sa surprise. Ensemble, elles dessinent un <strong>relief</strong> : sombre dans la vallée, clair sur les sommets. Tu cherchais à tâtons dans ce paysage.</p>
          @if (step() === 1) { <button type="button" class="primary" (click)="reveal(2, 'descent-machine')">Et la machine, comment fait-elle ?</button> }
        }

        @if (step() >= 2) {
          <h2 id="descent-machine">La machine ne voit pas le paysage</h2>
          <p>Calculer tout le relief serait bien trop long. Elle connaît seulement <strong>la pente sous ses pieds</strong> : la flèche. Sa méthode tient en une ligne : faire un petit pas dans le sens de la descente, puis recommencer.</p>
          <p>Cette pente s’appelle le <strong>gradient</strong>, et la méthode, la <strong>descente de gradient</strong>.</p>
          <label class="slider">Taille du pas : <strong>{{ paceLabel() }}</strong>
            <input type="range" min="0.2" max="8" step="0.1" [value]="pace()" (input)="pace.set(+$any($event.target).value)" />
          </label>
          <div class="controls">
            <button type="button" (click)="stepOnce()" [disabled]="loop.running()">Un pas</button>
            <button type="button" class="primary" (click)="descend()" [disabled]="loop.running()">Laisser descendre</button>
            <button type="button" (click)="scatter()" [disabled]="loop.running()">Reposer le lion ailleurs</button>
          </div>
          <p class="note">Essaie un pas minuscule, puis un pas énorme. Trop petit, c’est lent. Trop grand, on saute par-dessus la vallée.</p>
          @if (step() === 2 && descents() >= 1) { <button type="button" class="primary" (click)="reveal(3, 'descent-scale')">Et pour tous les mots à la fois ?</button> }
        }
      </div>
      <div class="stage" id="descent-map">
        <div class="terrain">
          <canvas #relief width="110" height="110" [class.shown]="step() >= 1"></canvas>
          <svg #board viewBox="-110 -110 220 220" (pointermove)="drag($event)" (pointerup)="release()" (pointerleave)="release()">
            @for (dot of others; track dot.word) {
              <g class="ghost" [attr.transform]="'translate(' + dot.x + ',' + dot.y + ')'">
                <circle r="2.4" [attr.fill]="dot.color" />
                @if (dot.label) { <text x="4.5" y="2.5">{{ dot.word }}</text> }
              </g>
            }
            @if (trail().length > 1) { <polyline class="trail" [attr.points]="trailPoints()" /> }
            @if (step() >= 2) { <line class="arrow" [attr.x1]="lion().x" [attr.y1]="lion().y" [attr.x2]="arrow().x" [attr.y2]="arrow().y" marker-end="url(#tip)" /> }
            <defs><marker id="tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#fff" /></marker></defs>
            <g class="handle" [class.held]="held()" [attr.transform]="'translate(' + lion().x + ',' + lion().y + ')'" (pointerdown)="grab($event)">
              <circle r="9" class="halo" /><circle r="5" />
              <text x="9" y="-7">lion</text>
            </g>
          </svg>
        </div>
        <div class="under">
          <p class="tiny">Placé ici, après « lion », la machine prédirait</p>
          <v4-bars [rows]="prediction()" [scale]="0.6" />
        </div>
      </div>
    </section>

    @if (step() >= 3) {
      <section class="moment" id="descent-scale">
        <div class="prose">
          <h2>Tous les réglages, en même temps</h2>
          <p>Tu viens de régler <strong>2 nombres</strong> : la position d’un mot. La carte complète en compte {{ mapCount }}, et l’entraînement les corrige tous à la fois, chacun selon sa propre pente.</p>
          <p>Un grand modèle de langage fait exactement la même chose, avec des <strong>centaines de milliards</strong> de réglages. Les calculs sont identiques ; seule l’échelle change.</p>
          <p class="aside">Calculer d’un coup la pente de tous les réglages s’appelle la <strong>rétropropagation</strong>. L’idée : remonter le calcul de la prédiction à l’envers, en notant à chaque étape combien elle a pesé sur l’erreur. Le capot ci-dessous la déroule sur ton lion.</p>
        </div>
        <div class="stage">
          <p class="tiny">Nombre de réglages corrigés à chaque pas</p>
          <ul class="scale-list">
            <li><span>Ton lion</span><strong>2</strong></li>
            <li><span>Notre carte des mots</span><strong>{{ mapCount }}</strong></li>
            <li><span>GPT-2 (2019)</span><strong>{{ big(1.5e9) }}</strong></li>
            <li><span>GPT-3 (2020)</span><strong>{{ big(175e9) }}</strong></li>
          </ul>
        </div>
      </section>
      <v4-capot label="La rétropropagation : calculer toutes les pentes d’un coup">
        <ng-template><v4-capot-backprop [model]="model" /></ng-template>
      </v4-capot>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Un réseau de neurones n’est pas programmé : il est <strong>réglé</strong>. On mesure son erreur, on calcule dans quel sens bouger chaque réglage pour la réduire, on fait un petit pas. Des milliards de fois.</p>
          <p>Mais que règle-t-on, au juste ? On répète « réseau de neurones » sans en avoir vu un seul. Ouvrons-en un.</p>
        </div>
      </section>
    }
  `,
})
export class ChDescent extends Chapter implements AfterViewInit, OnDestroy {
  readonly num = num;
  readonly big = big;
  readonly loop = new FrameLoop();
  readonly model = this.trained();
  private readonly extent = this.reach() * 1.25;
  readonly mapCount = WORDS.length * 5;
  readonly floor = this.valley();

  private readonly reliefRef = viewChild.required<ElementRef<HTMLCanvasElement>>('relief');
  private readonly boardRef = viewChild.required<ElementRef<SVGSVGElement>>('board');

  /** Position du lion, dans les unités du modèle. */
  readonly spot = signal<[number, number]>([this.extent * 0.55, this.extent * 0.5]);
  readonly held = signal(false);
  readonly moved = signal(false);
  readonly pace = signal(1);
  readonly descents = signal(0);
  readonly trail = signal<readonly [number, number][]>([]);
  readonly loss = computed(() => Math.min(this.model.lossAt(LION, ...this.spot()), 60));
  readonly best = signal(this.loss());
  readonly gaugeWidth = computed(() => Math.min(100, (Math.log(1 + this.loss() - this.floor) / Math.log(40)) * 100));
  readonly lion = computed(() => this.toView(this.spot()));
  readonly trailPoints = computed(() => this.trail().map((p) => this.toView(p)).map((p) => `${p.x},${p.y}`).join(' '));
  readonly paceLabel = computed(() => (this.pace() < 0.6 ? 'minuscule' : this.pace() < 2.5 ? 'raisonnable' : this.pace() < 5 ? 'grand' : 'énorme'));

  readonly arrow = computed(() => {
    const [gx, gy] = this.model.slopeAt(LION, ...this.spot());
    const length = Math.hypot(gx, gy) || 1;
    const reach = Math.min(24, 8 + length * 10);
    const from = this.lion();
    return { x: from.x - (gx / length) * reach, y: from.y + (gy / length) * reach };
  });

  readonly prediction = computed<BarRow[]>(() =>
    Array.from(this.model.probsAt(...this.spot()))
      .map((value, id) => ({ label: WORDS[id], value, color: FAMILY_COLOR[familyOf(WORDS[id])], hit: this.lionVerbs.includes(id) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
  );

  private readonly lionVerbs = PAIRS.filter(([word]) => word === LION).map(([, next]) => next);

  readonly others = WORDS.filter((word) => word !== 'lion').map((word) => {
    const family = familyOf(word);
    return { word, ...this.toView(this.model.position(wordId(word))), color: FAMILY_COLOR[family], label: family !== 'verbe' };
  });

  private trained(): WordMap {
    const model = new WordMap(MAP_SEED, 0.05, MAP_DECAY);
    for (let i = 0; i < MAP_STEPS; i++) model.trainStep();
    return model;
  }

  private reach(): number {
    return Math.max(...WORDS.flatMap((word) => this.model.position(wordId(word)).map(Math.abs)));
  }

  private valley(): number {
    let floor = Infinity;
    for (let i = 0; i <= 80; i++)
      for (let j = 0; j <= 80; j++)
        floor = Math.min(floor, this.model.lossAt(LION, -this.extent + (2 * this.extent * i) / 80, -this.extent + (2 * this.extent * j) / 80));
    return floor;
  }

  private toView([x, y]: readonly [number, number] | readonly number[]): { x: number; y: number } {
    return { x: (x / this.extent) * 100, y: (-y / this.extent) * 100 };
  }

  private place(x: number, y: number): void {
    const limit = this.extent * 1.05;
    const clamp = (v: number) => Math.max(-limit, Math.min(limit, v));
    this.spot.set([clamp(x), clamp(y)]);
    this.best.update((b) => Math.min(b, this.loss()));
  }

  ngAfterViewInit(): void {
    const context = this.reliefRef().nativeElement.getContext('2d')!;
    const image = context.createImageData(GRID, GRID);
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++) {
        const x = (((col + 0.5) / GRID) * 2.2 - 1.1) * this.extent;
        const y = (1.1 - ((row + 0.5) / GRID) * 2.2) * this.extent;
        const height = Math.min(1, Math.pow(Math.log(1 + this.model.lossAt(LION, x, y) - this.floor) / Math.log(40), 0.8));
        // Vallée sombre et froide, sommets clairs et chauds ; lignes de niveau légères.
        const band = Math.floor(height * 14) % 2 ? 0.06 : 0;
        const i = (row * GRID + col) * 4;
        image.data[i] = 22 + (255 - 22) * Math.min(1, height + band) * 0.92;
        image.data[i + 1] = 30 + (170 - 30) * Math.min(1, height + band) * 0.85;
        image.data[i + 2] = 72 + (90 - 72) * height;
        image.data[i + 3] = 255;
      }
    context.putImageData(image, 0, 0);
  }

  grab(event: PointerEvent): void {
    if (this.loop.running()) return;
    this.held.set(true);
    this.trail.set([]);
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  drag(event: PointerEvent): void {
    if (!this.held()) return;
    const box = this.boardRef().nativeElement.getBoundingClientRect();
    const x = (((event.clientX - box.left) / box.width) * 2.2 - 1.1) * this.extent;
    const y = (1.1 - ((event.clientY - box.top) / box.height) * 2.2) * this.extent;
    this.place(x, y);
    this.moved.set(true);
  }

  release(): void {
    this.held.set(false);
  }

  stepOnce(): boolean {
    const [x, y] = this.spot();
    const [gx, gy] = this.model.slopeAt(LION, x, y);
    if (!this.trail().length) this.trail.set([[x, y]]);
    this.place(x - this.pace() * gx, y - this.pace() * gy);
    this.trail.update((t) => [...t, this.spot()]);
    return Math.hypot(gx, gy) > 0.004;
  }

  descend(): void {
    this.trail.set([]);
    let frame = 0, count = 0;
    this.loop.start(() => {
      if (frame++ % 4) return true;
      const moving = this.stepOnce();
      if (moving && ++count < 70) return true;
      this.descents.update((d) => d + 1);
      return false;
    });
  }

  scatter(): void {
    const angle = Math.random() * Math.PI * 2;
    this.trail.set([]);
    this.place(Math.cos(angle) * this.extent * 0.75, Math.sin(angle) * this.extent * 0.75);
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
