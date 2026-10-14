import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, WritableSignal, computed, signal } from '@angular/core';
import { BarRow, Bars, Capot, Chapter, FAMILY_COLOR, FrameLoop, num, pct } from '../shared';
import { CapotReadout } from './capot-readout';
import { ABSURD, Family, SENTENCES, UNSEEN, WORDS, WordMap, countProbs, familyOf, wordId } from '../engine/word-map';

export const MAP_SEED = 9;
export const MAP_DECAY = 0.3;
export const MAP_STEPS = 1000;

interface Dot {
  readonly word: string;
  readonly family: Family;
  readonly x: number;
  readonly y: number;
  /** Étiquette à gauche du point quand un voisin occupe déjà la droite. */
  readonly left: boolean;
}

const SEEN = SENTENCES.map((s) => [s[s.length - 3], s[s.length - 2]] as const);

@Component({
  selector: 'v4-ch-map',
  imports: [Bars, Capot, CapotReadout, NgTemplateOutlet],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 3 · La carte</p>
      <h1>Des boutons, puis <em>une carte</em></h1>
      <p class="lede">Pour qu’une machine sache ce qui se ressemble, on change complètement d’idée. Au lieu de compter, on donne à chaque mot des boutons de réglage, et on la laisse les tourner.</p>
    </header>

    <section class="moment">
      <div class="prose">
        <h2>Un bouton par mot</h2>
        <p>La machine doit donner une <strong>note</strong> à chaque suite possible : après « loup », que vaut « chasse » ? Et il faut pouvoir <strong>régler</strong> cette note quand elle est mauvaise.</p>
        <p>Alors on donne à chaque mot un <strong>bouton</strong> : un simple nombre. Au départ, on le tire au hasard. <strong>Il ne représente rien.</strong> Ce n’est pas une mesure du loup, c’est un réglage posé n’importe comment.</p>
        <p>La note est le produit des deux boutons. Ce choix n’a rien de profond : c’est la formule la plus simple où les deux boutons comptent.</p>
        <p class="do">Tourne les deux boutons. Quand la note est-elle positive ? négative ? nulle ?</p>
        <label class="slider">Bouton de « loup » : <strong>{{ num(knobA(), 1) }}</strong>
          <input type="range" min="-1.5" max="1.5" step="0.1" [value]="knobA()" (input)="turn(knobA, $event)" />
        </label>
        <label class="slider">Bouton de « chasse » : <strong>{{ num(knobB(), 1) }}</strong>
          <input type="range" min="-1.5" max="1.5" step="0.1" [value]="knobB()" (input)="turn(knobB, $event)" />
        </label>
        @if (turned()) {
          <p class="note">Deux boutons de <strong>même signe</strong> : note positive. De <strong>signes opposés</strong> : note négative. Un bouton à zéro : la note s’annule. Voilà tout le mécanisme.</p>
          @if (step() === 0) { <button type="button" class="primary" (click)="startFixing()">La machine lit « le loup chasse »</button> }
        }
      </div>
      <div class="stage">
        <ng-container [ngTemplateOutlet]="knobs" />
      </div>
    </section>

    <ng-template #knobs>
      <div class="knobs">
        <div class="knob"><span class="tiny">Bouton de « loup »</span><span class="dial"><i [style.left.%]="place(knobA())"></i></span><strong>{{ num(knobA()) }}</strong></div>
        <span class="times">×</span>
        <div class="knob"><span class="tiny">Bouton de « chasse »</span><span class="dial"><i [style.left.%]="place(knobB())"></i></span><strong>{{ num(knobB()) }}</strong></div>
      </div>
      <div class="note-box" [class.good]="note() > 0" [class.bad]="note() < 0">
        <span class="tiny">Note de « chasse » après « loup »</span>
        <strong>{{ num(note()) }}</strong>
        <span class="note-track"><i [style.left.%]="note() < 0 ? 50 + noteWidth() * -1 : 50" [style.width.%]="noteWidth()"></i></span>
        <small>{{ num(knobA()) }} × {{ num(knobB()) }} = {{ num(note()) }}</small>
      </div>
    </ng-template>

    @if (step() >= 1) {
      <section class="moment" id="map-fix">
        <div class="prose">
          <h2>Corriger, sans rien comprendre</h2>
          <p>La machine lit « le loup chasse ». Avec ses boutons tirés au hasard (0,3 et −0,5), elle donnait à « chasse » la note −0,15. C’est trop bas : cette phrase existe. Il faut faire <strong>monter la note</strong>.</p>
          <p>Dans quel sens tourner chaque bouton ? Elle n’en sait rien. Alors elle <strong>essaie</strong>.</p>
          <p class="do">Teste les quatre possibilités.</p>
          <table class="tries">
            <tbody>
              @for (t of tries; track t.label) {
                <tr>
                  <th>{{ t.label }}</th>
                  @if (tried().includes($index)) {
                    <td>{{ num(t.a) }} × {{ num(t.b) }} = <strong>{{ num(t.a * t.b) }}</strong></td>
                    <td [class.good]="t.a * t.b > -0.15" [class.bad]="t.a * t.b < -0.15">{{ t.a * t.b > -0.15 ? 'la note monte ✓' : 'la note baisse ✗' }}</td>
                  } @else {
                    <td colspan="2"><button type="button" (click)="tryOne($index)">Essayer</button></td>
                  }
                </tr>
              }
            </tbody>
          </table>
          @if (tried().length === tries.length) {
            <p class="note">Pour chaque bouton, un sens fait monter la note et l’autre la fait baisser. La machine garde le bon sens et tourne <strong>un tout petit peu</strong>. Puis elle recommence.</p>
            <div class="controls">
              <button type="button" [disabled]="loop.running() || note() >= goal" (click)="fixOnce()">Corriger une fois</button>
              <button type="button" class="primary" [disabled]="loop.running() || note() >= goal" (click)="fixAll()">Corriger jusqu’au bout</button>
              <button type="button" [disabled]="loop.running() || !fixes()" (click)="startFixing()">Remettre au hasard</button>
            </div>
          }
          @if (note() >= goal) {
            <p class="note">En {{ fixes() }} petites corrections, la note est passée de −0,15 à {{ num(note()) }}. La machine vient d’« apprendre » que le loup chasse. Elle n’a rien compris : <strong>elle a tourné deux boutons</strong>.</p>
            <p class="aside">En pratique, elle n’a même pas besoin d’essayer les deux sens : une formule donne directement le bon. C’est le sujet du chapitre suivant.</p>
            @if (step() === 1) { <button type="button" class="primary" (click)="reveal(2, 'map-train')">Et avec tous les mots à la fois ?</button> }
          }
        </div>
        <div class="stage">
          <ng-container [ngTemplateOutlet]="knobs" />
          <dl class="meters spaced"><div><dt>Corrections</dt><dd>{{ fixes() }}</dd></div><div><dt>Note visée</dt><dd>au moins {{ num(goal, 1) }}</dd></div></dl>
        </div>
      </section>
    }

    @if (step() >= 2) {
    <section class="moment wide" id="map-train">
      <div class="prose">
        <h2>Deux boutons par mot : une carte</h2>
        <p>Avec un seul bouton, on ne peut ranger les mots que le long d’une ligne. C’est trop étroit pour séparer des animaux, des personnes et des véhicules. On donne donc <strong>deux boutons</strong> à chaque mot, et la note devient : bouton 1 × bouton 1, plus bouton 2 × bouton 2.</p>
        <p>Deux nombres, ça se dessine : chaque mot devient un <strong>point sur une carte</strong>. La carte n’est rien d’autre que le dessin des boutons.</p>
        <p class="aside">Précision : chaque mot a en fait deux paires de boutons. L’une sert quand il est lu, c’est elle qu’on dessine. L’autre sert quand il est candidat. Le capot, plus bas, montre comment elles se rencontrent.</p>
        <p>L’entraînement fait ce que tu viens de faire, pour chaque phrase lue et pour tous les mots à la fois. Avec une différence : il ne suffit plus que « chasse » ait une bonne note, il lui faut une <strong>meilleure note que les autres candidats</strong>. Chaque correction fait donc monter le bon mot, et baisser un peu ceux qui lui prenaient sa place.</p>
        <p class="do">Lance-le et regarde les mots bouger. Personne ne leur dit où aller.</p>
        <div class="controls">
          <button type="button" class="primary" [disabled]="loop.running() || done()" (click)="train()">{{ loop.running() ? 'Entraînement…' : steps() ? 'Continuer' : 'Entraîner la machine' }}</button>
          <button type="button" [disabled]="!steps()" (click)="reset()">Recommencer</button>
        </div>
        <dl class="meters">
          <div><dt>Corrections</dt><dd>{{ steps() }} / {{ total }}</dd></div>
          <div><dt>Surprise moyenne</dt><dd>{{ num(loss()) }}</dd></div>
        </dl>
        <svg class="spark" viewBox="0 0 200 50" preserveAspectRatio="none" aria-label="Courbe de la surprise moyenne pendant l’entraînement"><polyline [attr.points]="spark()" /></svg>
        @if (done() && !colored()) {
          <p class="note">Les points se sont regroupés. Mais par quoi ?</p>
          <button type="button" class="primary" (click)="colored.set(true)">Révéler les familles</button>
        }
        @if (colored()) {
          <p class="note"><strong>Les animaux ensemble, les personnes ensemble, les véhicules ensemble.</strong> Personne n’a dit à la machine ce qu’est un animal. Mais le chat, le loup et le chien sont suivis des mêmes verbes : ils ont donc subi <strong>les mêmes corrections</strong>, et leurs boutons ont fini proches. Le sens n’a pas été mis dans les nombres : il s’y est déposé.</p>
          <p class="note">Et les verbes, tous empilés ? Dans nos phrases, un verbe est toujours suivi d’un point. Pour cette machine, ils sont donc interchangeables.</p>
          @if (step() === 2) { <button type="button" class="primary" (click)="reveal(3, 'map-lion')">Et le lion qui chasse ?</button> }
        }
      </div>
      <div class="stage">
        <svg class="map" viewBox="-110 -110 220 220" role="img" aria-label="Carte des mots">
          <line x1="-110" y1="0" x2="110" y2="0" class="axis" /><line x1="0" y1="-110" x2="0" y2="110" class="axis" />
          @for (dot of dots(); track dot.word) {
            <g class="dot" [class.on]="dot.word === selected()" [attr.transform]="'translate(' + dot.x + ',' + dot.y + ')'" (click)="selected.set(dot.word)">
              <circle r="3.4" [attr.fill]="colored() ? colorOf(dot.family) : '#c9d1ea'" />
              @if (dot.family !== 'verbe') { <text [attr.x]="dot.left ? -5 : 5" y="2.5" [attr.text-anchor]="dot.left ? 'end' : 'start'">{{ dot.word }}</text> }
            </g>
          }
          @if (steps() > 150) { <text class="group" [attr.x]="verbs().x + 6" [attr.y]="verbs().y + 2.5">les 12 verbes</text> }
        </svg>
        @if (colored()) {
          <p class="legend">@for (f of families; track f) { <span><i [style.background]="colorOf(f)"></i>{{ f }}</span> }</p>
        }
        <div class="under">
          <p class="tiny">Après « {{ selected() }} », la machine prédit · clique un mot sur la carte</p>
          <v4-bars [rows]="prediction()" [scale]="0.5" />
          <p class="hint">Les notes de tous les candidats sont converties en parts de 100 % : ce sont ces barres. Le capot, plus bas, montre comment.</p>
        </div>
      </div>
    </section>

    }

    @if (step() >= 3) {
      <section class="moment" id="map-lion">
        <div class="prose">
          <h2>La carte devine ce qu’elle n’a jamais vu</h2>
          <p>« Le lion chasse » n’est dans aucune phrase. Mais le lion a été corrigé par « dort » et « grogne », deux verbes qu’il partage avec le loup. Ces corrections l’ont tiré dans le même quartier de la carte. Sa note avec « chasse » y est donc bonne, sans que la machine l’ait jamais lue.</p>
          <p>Mesurons sur toutes les phrases que la machine n’a jamais lues : les <strong>plausibles</strong> (« le loup mange ») et les <strong>absurdes</strong> (« le bus grogne »).</p>
          <p>Le comptage leur donnait 0 % à toutes. La carte, elle, <strong>fait la différence</strong> : c’est le début de la généralisation.</p>
          <p class="aside">Honnêteté : ce modèle est minuscule, et on a bridé la taille de ses réglages pour qu’il n’apprenne pas simplement ses {{ sentenceCount }} phrases par cœur. Les grands modèles, eux, ont immensément plus de texte que de place pour tout retenir : ils sont poussés à en extraire des régularités. Ils retiennent quand même mot pour mot une partie de ce qu’ils lisent, surtout les textes très répétés.</p>
        </div>
        <div class="stage">
          <p class="tiny">Après « lion »</p>
          <v4-bars [rows]="lionRows()" [scale]="0.4" />
          <p class="tiny spaced">Probabilité moyenne donnée au verbe</p>
          <table class="compare">
            <thead><tr><th></th><th>Comptage</th><th>Carte</th></tr></thead>
            <tbody>
              @for (row of comparison(); track row.label) {
                <tr><th>{{ row.label }}</th><td>{{ pct(row.count) }}</td><td class="strong">{{ pct(row.map) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <v4-capot label="Comment une position devient une prédiction">
        <ng-template><v4-capot-readout [model]="model" [tick]="steps()" /></ng-template>
      </v4-capot>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Ces boutons, les spécialistes les appellent des <strong>embeddings</strong>. Personne ne les écrit : ils sont tirés au hasard, puis l’entraînement les tourne. Ici, deux par mot. Dans un grand modèle, des milliers : assez de place pour que s’y déposent le sens, le ton, la grammaire, le sujet…</p>
          <p>Tu as corrigé deux boutons en essayant les deux sens. Un grand modèle en a des milliards : impossible de tout essayer. Il faut un moyen de connaître le bon sens <strong>sans tâtonner</strong>.</p>
        </div>
      </section>
    }
  `,
})
export class ChMap extends Chapter implements OnDestroy {
  readonly total = MAP_STEPS;
  readonly sentenceCount = SENTENCES.length;
  readonly families: Family[] = ['animal', 'personne', 'véhicule', 'verbe', 'outil'];
  readonly loop = new FrameLoop();
  readonly num = num;
  readonly pct = pct;
  model = new WordMap(MAP_SEED, 0.05, MAP_DECAY);
  /** Incrémenté à chaque correction pour rafraîchir tout ce qui lit le modèle. */
  readonly steps = signal(0);
  readonly loss = signal(this.model.loss());
  readonly history = signal<readonly number[]>([this.model.loss()]);
  readonly selected = signal('chat');
  readonly colored = signal(false);
  readonly done = computed(() => this.steps() >= MAP_STEPS);

  // La version miniature : un seul bouton par mot, note = produit des deux.
  readonly goal = 0.8;
  readonly knobA = signal(0.3);
  readonly knobB = signal(-0.5);
  readonly note = computed(() => this.knobA() * this.knobB());
  readonly noteWidth = computed(() => Math.min(50, (Math.abs(this.note()) / 1.5) * 50));
  readonly turned = signal(false);
  readonly tried = signal<readonly number[]>([]);
  readonly fixes = signal(0);
  readonly tries = [
    { label: 'Bouton de « loup » un peu plus haut', a: 0.4, b: -0.5 },
    { label: 'Bouton de « loup » un peu plus bas', a: 0.2, b: -0.5 },
    { label: 'Bouton de « chasse » un peu plus haut', a: 0.3, b: -0.4 },
    { label: 'Bouton de « chasse » un peu plus bas', a: 0.3, b: -0.6 },
  ];

  place(value: number): number {
    return Math.max(0, Math.min(100, ((value + 1.5) / 3) * 100));
  }

  turn(knob: WritableSignal<number>, event: Event): void {
    knob.set(+(event.target as HTMLInputElement).value);
    this.turned.set(true);
  }

  startFixing(): void {
    this.knobA.set(0.3);
    this.knobB.set(-0.5);
    this.fixes.set(0);
    this.reveal(1, 'map-fix');
  }

  tryOne(index: number): void {
    this.tried.update((list) => [...list, index]);
  }

  /** Chaque bouton avance dans le sens qui fait monter la note : celui que donne l'autre bouton. */
  fixOnce(): void {
    const a = this.knobA(), b = this.knobB();
    this.knobA.set(a + 0.12 * b);
    this.knobB.set(b + 0.12 * a);
    this.fixes.update((n) => n + 1);
  }

  fixAll(): void {
    let frame = 0;
    this.loop.start(() => {
      if (frame++ % 8 === 0) this.fixOnce();
      return this.note() < this.goal;
    });
  }

  private extent = 1;
  readonly dots = computed<Dot[]>(() => {
    this.steps();
    const raw = WORDS.map((word) => ({ word, p: this.model.position(wordId(word)) }));
    const reach = Math.max(...raw.map(({ p }) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    this.extent = Math.max(this.extent, reach * 1.25, 0.6);
    const placed = raw.map(({ word, p }) => ({ word, family: familyOf(word), x: (p[0] / this.extent) * 100, y: (-p[1] / this.extent) * 100 }));
    const labelled = placed.filter((d) => d.family !== 'verbe');
    return placed.map((d) => ({
      ...d,
      left: labelled.some((o) => o !== d && Math.abs(o.y - d.y) < 7 && o.x - d.x >= 0 && o.x - d.x < 30 && (o.x > d.x || o.word > d.word)),
    }));
  });

  readonly verbs = computed(() => {
    const list = this.dots().filter((d) => d.family === 'verbe');
    return { x: Math.max(...list.map((d) => d.x)), y: list.reduce((s, d) => s + d.y, 0) / list.length };
  });

  readonly prediction = computed<BarRow[]>(() => {
    this.steps();
    return this.top(this.selected(), 6);
  });

  readonly lionRows = computed<BarRow[]>(() => {
    this.steps();
    const probs = this.model.probs(wordId('lion'));
    const seen = this.top('lion', 3);
    const extra = (verb: string, note: string): BarRow => ({ label: verb, value: probs[wordId(verb)], hit: true, color: FAMILY_COLOR.animal, note: pct(probs[wordId(verb)]) + ' · ' + note });
    return [...seen.filter((r) => r.label !== 'chasse'), extra('chasse', 'jamais vu, plausible'), extra('lit', 'jamais vu, absurde')];
  });

  readonly comparison = computed(() => {
    this.steps();
    const mean = (pairs: readonly (readonly [string, string])[], f: (noun: number, verb: number) => number) =>
      pairs.reduce((sum, [noun, verb]) => sum + f(wordId(noun), wordId(verb)), 0) / pairs.length;
    const byCount = (noun: number, verb: number) => countProbs(noun)[verb];
    const byMap = (noun: number, verb: number) => this.model.probs(noun)[verb];
    return [
      { label: 'Phrases lues', count: mean(SEEN, byCount), map: mean(SEEN, byMap) },
      { label: 'Jamais lues, plausibles', count: mean(UNSEEN, byCount), map: mean(UNSEEN, byMap) },
      { label: 'Jamais lues, absurdes', count: mean(ABSURD, byCount), map: mean(ABSURD, byMap) },
    ];
  });

  readonly spark = computed(() => {
    const h = this.history();
    const max = h[0];
    return h.map((v, i) => `${(i / (MAP_STEPS / 5)) * 200},${50 - (v / max) * 46}`).join(' ');
  });

  colorOf(family: Family): string {
    return FAMILY_COLOR[family];
  }

  private top(word: string, count: number): BarRow[] {
    return Array.from(this.model.probs(wordId(word)))
      .map((value, id) => ({ label: WORDS[id], value, color: this.colored() ? this.colorOf(familyOf(WORDS[id])) : undefined }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count);
  }

  train(): void {
    this.loop.start(() => {
      let loss = 0;
      for (let i = 0; i < 5 && this.model.steps < MAP_STEPS; i++) loss = this.model.trainStep();
      this.loss.set(loss);
      this.history.update((h) => [...h, loss]);
      this.steps.set(this.model.steps);
      return this.model.steps < MAP_STEPS;
    });
  }

  reset(): void {
    this.loop.stop();
    this.model = new WordMap(MAP_SEED, 0.05, MAP_DECAY);
    this.extent = 1;
    this.colored.set(false);
    this.loss.set(this.model.loss());
    this.history.set([this.model.loss()]);
    this.steps.set(0);
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
