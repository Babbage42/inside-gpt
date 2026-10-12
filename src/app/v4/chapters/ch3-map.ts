import { Component, OnDestroy, computed, signal } from '@angular/core';
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
  imports: [Bars, Capot, CapotReadout],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 3 · La carte</p>
      <h1>Donner à chaque mot <em>une place</em></h1>
      <p class="lede">Pour qu’une machine sache ce qui se ressemble, on change complètement d’idée : au lieu de compter des cases, on range les mots dans un espace.</p>
    </header>

    <section class="moment wide">
      <div class="prose">
        <h2>Deux nombres par mot</h2>
        <p>Chaque mot reçoit une <strong>position</strong> sur une carte : deux nombres. La machine calcule sa prédiction <em>à partir de cette position</em>. Deux mots voisins sur la carte prédisent donc presque la même suite.</p>
        <p>Au départ, les positions sont tirées au hasard : la carte ne veut rien dire. Puis la machine relit ses phrases, et après chaque lecture <strong>déplace un peu chaque mot</strong> pour moins se tromper.</p>
        <p class="do">Lance l’entraînement et regarde les mots bouger. Personne ne leur dit où aller.</p>
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
          <p class="note"><strong>Les animaux ensemble, les personnes ensemble, les véhicules ensemble.</strong> Personne n’a dit à la machine ce qu’est un animal. Elle a rapproché les mots qui s’utilisent de la même façon, parce que c’était le moyen de mieux deviner.</p>
          <p class="note">Et les verbes, tous empilés ? Dans nos phrases, un verbe est toujours suivi d’un point. Pour cette machine, ils sont donc interchangeables.</p>
          @if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'map-lion')">Et le lion qui chasse ?</button> }
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
        </div>
      </div>
    </section>

    @if (step() >= 1) {
      <section class="moment" id="map-lion">
        <div class="prose">
          <h2>La carte devine ce qu’elle n’a jamais vu</h2>
          <p>« Le lion chasse » n’est dans aucune phrase. Mais sur la carte, le lion habite près du renard et du chat. Il hérite un peu de leurs habitudes.</p>
          <p>Mesurons sur toutes les phrases que la machine n’a jamais lues : les <strong>plausibles</strong> (« le loup mange ») et les <strong>absurdes</strong> (« le bus grogne »).</p>
          <p>Le comptage leur donnait 0 % à toutes. La carte, elle, <strong>fait la différence</strong> : c’est le début de la généralisation.</p>
          <p class="aside">Honnêteté : ce modèle est minuscule, et on a bridé la taille de ses réglages pour qu’il n’apprenne pas simplement ses {{ sentenceCount }} phrases par cœur. Les grands modèles généralisent parce qu’ils ont immensément plus de texte que de place pour le mémoriser.</p>
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
          <p>Ces positions s’appellent des <strong>embeddings</strong>. Personne ne les écrit : elles <strong>émergent</strong> de l’entraînement. Ici, deux nombres par mot. Dans un grand modèle, des milliers : assez de place pour ranger le sens, le ton, la grammaire, le sujet…</p>
          <p>Mais qu’a fait exactement le bouton « Entraîner » ? Comment la machine sait-elle dans quelle direction déplacer chaque mot ?</p>
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
