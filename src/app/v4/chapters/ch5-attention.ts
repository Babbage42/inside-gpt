import { ChangeDetectionStrategy, Component, OnDestroy, computed, input, signal } from '@angular/core';
import { BarRow, Bars, Chapter, FrameLoop, big, pct } from '../shared';
import { DRINKS, LAST, LookupModel, NAMES, Puzzle, Trace, VOCAB, fixedPuzzles, isHeldOut, makePuzzle } from '../engine/lookup';

const TOTAL = 2000;
const X = (i: number) => 62 + i * 96.5;

interface Arc {
  readonly path: string;
  readonly weight: number;
  readonly tx: number;
}

function arc(from: number, to: number, above: boolean, weight: number): Arc {
  const y = above ? 96 : 144, bend = (26 + Math.abs(X(from) - X(to)) * 0.3) * (above ? -1 : 1);
  return { path: `M${X(from)} ${y} Q${(X(from) + X(to)) / 2} ${y + bend} ${X(to)} ${y}`, weight, tx: X(to) };
}

/** Une fiche et les regards du modèle : couche 2 au-dessus, couche 1 en dessous. */
@Component({
  selector: 'v4-fiche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="fiche" viewBox="0 0 800 240" role="img" aria-label="Fiche et regards du modèle">
      <text class="layer-label" x="8" y="22">Couche 2 · ce que regarde la question</text>
      <text class="layer-label" x="8" y="232">Couche 1 · ce que regarde chaque mot</text>
      @for (a of upper(); track $index) {
        <path [attr.d]="a.path" class="look two" [attr.stroke-opacity]="a.weight" [attr.stroke-width]="1 + a.weight * 6" />
        <circle [attr.cx]="a.tx" cy="96" r="3.5" class="two-dot" [attr.opacity]="a.weight" />
      }
      @for (a of lower(); track $index) {
        <path [attr.d]="a.path" class="look one" [attr.stroke-opacity]="a.weight" [attr.stroke-width]="1 + a.weight * 4" />
        <circle [attr.cx]="a.tx" cy="144" r="3" class="one-dot" [attr.opacity]="a.weight" />
      }
      @for (id of puzzle().ids; track $index) {
        <g [attr.transform]="'translate(' + x($index) + ',120)'" [class]="kind(id)" class="tok" [class.asked]="$index === last">
          <rect x="-42" y="-20" width="84" height="40" rx="10" />
          <text y="6">{{ vocab[id] }}</text>
        </g>
      }
    </svg>
  `,
})
export class Fiche {
  readonly puzzle = input.required<Puzzle>();
  readonly trace = input.required<Trace>();
  readonly vocab = VOCAB;
  readonly last = LAST;
  readonly x = X;

  readonly upper = computed(() =>
    this.trace().attention[1][LAST].slice(0, LAST).map((w, j) => arc(LAST, j, true, w)).filter((a) => a.weight > 0.04),
  );

  readonly lower = computed(() =>
    this.trace().attention[0].flatMap((row, i) => row.slice(0, i).map((w, j) => arc(i, j, false, w))).filter((a) => a.weight > 0.15),
  );

  kind(id: number): string {
    return id < NAMES.length ? 'name' : id < NAMES.length + DRINKS.length ? 'drink' : 'mark';
  }
}

@Component({
  selector: 'v4-ch-attention',
  imports: [Bars, Fiche],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 5 · Le regard</p>
      <h1>Les mots apprennent à <em>se regarder</em></h1>
      <p class="lede">Voici la pièce qui a tout changé en 2017 : l’attention. Tu vas la voir naître, puis ouvrir le modèle pour lire la méthode qu’il a trouvée seul.</p>
    </header>

    <section class="moment">
      <div class="prose">
        <h2>Un jeu que la carte ne peut pas gagner</h2>
        <p>Trois fiches, une question. La bonne réponse change à chaque fois : impossible de l’apprendre par cœur, il faut <strong>lire la fiche</strong>.</p>
        <p class="do">Joue d’abord toi-même.</p>
        @if (played()) {
          <p class="note"><strong>{{ played() === 'jus' ? 'Évidemment.' : 'C’était « jus ».' }}</strong> Mais comment as-tu fait ? Tu as <strong>retrouvé « Paul »</strong> dans la liste, puis <strong>lu le mot juste après</strong>. Deux gestes enchaînés.</p>
          <p>Personne ne va programmer ces deux gestes. On va seulement donner au modèle la possibilité de regarder en arrière, et le laisser s’entraîner.</p>
          @if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'att-how')">Que veut dire « regarder » ?</button> }
        }
      </div>
      <div class="stage">
        <p class="cards">
          @for (pair of examplePairs; track pair[0]) { <span class="card"><b>{{ pair[0] }}</b> boit du <i>{{ pair[1] }}</i></span> }
        </p>
        <p class="prompt small">Que boit Paul ? <span class="blank" [class.filled]="played()">{{ played() ? 'jus' : '?' }}</span></p>
        <div class="options">
          @for (pair of examplePairs; track pair[0]) {
            <button type="button" [disabled]="!!played()" [class.right]="played() && pair[1] === 'jus'" [class.wrong]="played() === pair[1] && pair[1] !== 'jus'" (click)="played.set(pair[1])">{{ pair[1] }}</button>
          }
        </div>
      </div>
    </section>

    @if (step() >= 1) {
      <section class="moment" id="att-how">
        <div class="prose">
          <h2>L’attention, en trois idées</h2>
          <p>Dans un transformer, chaque mot peut <strong>consulter les mots qui le précèdent</strong> et recopier une partie de ce qu’ils contiennent.</p>
          <p>Qui regarde qui ? Rien n’est écrit d’avance. Ce sont, encore une fois, des <strong>réglages</strong>, ajustés par la même descente de pente qu’au chapitre précédent.</p>
          <p>Notre modèle a <strong>deux couches</strong> : les mots se regardent une première fois, puis une seconde, en profitant de ce qu’ils ont appris au premier tour.</p>
          @if (step() === 1) { <button type="button" class="primary" (click)="reveal(2, 'att-train')">Entraînons-le</button> }
        </div>
        <div class="stage trio">
          <div><span class="tiny">1 · La question</span><p>Chaque mot émet une demande : « je cherche tel genre d’information ».</p><small>en anglais : query</small></div>
          <div><span class="tiny">2 · L’étiquette</span><p>Chaque mot affiche ce qu’il a à offrir. Plus une étiquette répond à la question, plus le mot est regardé.</p><small>key</small></div>
          <div><span class="tiny">3 · Le contenu</span><p>Le mot qui regarde reçoit un mélange des contenus, dosé par ces regards, et l’ajoute à ce qu’il sait déjà.</p><small>value</small></div>
        </div>
      </section>
    }

    @if (step() >= 2) {
      <section class="moment stack" id="att-train">
        <div class="prose two-col">
          <div>
            <h2>Regarde-le chercher</h2>
            <p>Le modèle part de {{ big(parameters) }} réglages tirés au hasard. À chaque pas, il lit 16 fiches nouvelles, mesure sa surprise et corrige tous ses réglages.</p>
            <p>Un piège est tendu : certains couples, comme <strong>Paul + jus</strong>, n’apparaissent dans <strong>aucune</strong> fiche d’entraînement. S’il réussit quand même sur eux, c’est qu’il lit vraiment la fiche.</p>
          </div>
          <div>
            <p><strong>Ce qu’il faut regarder.</strong> Les arcs montrent qui regarde qui : plus un arc est épais, plus le regard est appuyé. En haut, la question. En bas, tous les autres mots.</p>
            <p>Surveille aussi les deux courbes : la grise (fiches d’entraînement) et l’orange (couples jamais vus).</p>
          </div>
        </div>
        <div class="stage" id="att-stage">
          <div class="train-bar">
            <div class="controls">
              <button type="button" class="primary" [disabled]="loop.running() || done()" (click)="train()">{{ loop.running() ? 'Entraînement…' : steps() ? 'Continuer' : 'Entraîner le modèle' }}</button>
              <button type="button" [disabled]="!loop.running()" (click)="loop.stop()">Pause</button>
              <button type="button" [disabled]="!steps() || loop.running()" (click)="reset()">Recommencer</button>
            </div>
            <p class="phase" aria-live="polite">{{ phase() }}</p>
          </div>
          <v4-fiche [puzzle]="example" [trace]="exampleTrace()" />
          <div class="readout">
            <div>
              <p class="tiny">Sa réponse à « ? Paul » · la bonne est « jus »</p>
              <v4-bars [rows]="answerRows(exampleTrace(), example)" [scale]="1" />
            </div>
            <div>
              <p class="tiny">Réussite · pas {{ steps() }} / {{ total }}</p>
              <svg class="curves" viewBox="0 0 300 110" preserveAspectRatio="none">
                <line x1="0" y1="105" x2="300" y2="105" class="axis" /><line x1="0" y1="5" x2="300" y2="5" class="axis" />
                <polyline class="seen" [attr.points]="curve(0)" /><polyline class="unseen" [attr.points]="curve(1)" />
              </svg>
              <p class="legend"><span><i class="seen"></i>fiches d’entraînement {{ pct(last()[0]) }}</span><span><i class="unseen"></i>couples jamais vus {{ pct(last()[1]) }}</span></p>
            </div>
          </div>
        </div>
        @if (done() && step() === 2) { <button type="button" class="primary center" (click)="reveal(3, 'att-open')">Ouvrir le modèle : qu’a-t-il trouvé ?</button> }
      </section>
    }

    @if (step() >= 3) {
      <section class="moment stack" id="att-open">
        <div class="prose two-col">
          <div>
            <h2>La méthode qu’il a inventée</h2>
            <p><strong>Couche 1 · ranger.</strong> Chaque boisson regarde le prénom placé juste avant elle (en moyenne {{ pct(habits().first) }} de son regard). Elle en garde la trace : « j’appartiens à Paul ».</p>
            <p><strong>Couche 2 · chercher.</strong> La question « ? Paul » regarde la boisson qui porte la trace de Paul ({{ pct(habits().second) }} de son regard), et recopie son contenu : « jus ».</p>
          </div>
          <div>
            <p>Ranger, puis chercher. <strong>Deux étapes enchaînées, que personne n’a programmées.</strong> Elles sont apparues parce qu’elles faisaient baisser la surprise.</p>
            <p class="do">Vérifie par toi-même : clique sur un prénom ou une boisson pour le changer, ou sur « ? » pour changer la question.</p>
          </div>
        </div>
        <div class="stage">
          <div class="builder">
            @for (name of customNames(); track $index) {
              <span class="pair">
                <button type="button" class="name" (click)="cycleName($index)">{{ names[name] }}</button>
                <button type="button" class="drink" (click)="cycleDrink($index)">{{ drinks[customDrinks()[$index]] }}</button>
                <button type="button" class="ask" [class.on]="asked() === $index" (click)="asked.set($index)">?</button>
                @if (held(name, customDrinks()[$index])) { <small>jamais vus ensemble</small> }
              </span>
            }
          </div>
          <v4-fiche [puzzle]="custom()" [trace]="customTrace()" />
          <div class="readout single">
            <div>
              <p class="tiny">Sa réponse à « ? {{ names[customNames()[asked()]] }} »</p>
              <v4-bars [rows]="answerRows(customTrace(), custom())" [scale]="1" />
            </div>
          </div>
        </div>
      </section>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Tu viens d’assister à l’essentiel. On n’a donné au modèle <strong>ni règle ni méthode</strong> : seulement un objectif (deviner la suite), la capacité de regarder en arrière, et une pente à descendre. Il en est sorti un <strong>algorithme</strong>, qui fonctionne sur des cas jamais vus.</p>
          <p>C’est un tout petit raisonnement. Que se passe-t-il quand on empile non pas 2 couches, mais 100, sur presque tout ce que l’humanité a écrit ?</p>
        </div>
      </section>
    }
  `,
})
export class ChAttention extends Chapter implements OnDestroy {
  readonly total = TOTAL;
  readonly names = NAMES;
  readonly drinks = DRINKS;
  readonly big = big;
  readonly pct = pct;
  readonly loop = new FrameLoop();
  readonly played = signal('');
  readonly examplePairs = [['Léa', 'café'], ['Paul', 'jus'], ['Hugo', 'thé']];
  /** Léa café · Paul jus · Hugo thé · ? Paul. Le couple Paul + jus est réservé au test. */
  readonly example = makePuzzle([0, 1, 2], [1, 3, 0], 1);

  private model = new LookupModel(7, 24, 2, 0.004, 0.2);
  readonly parameters = this.model.parameterCount;
  private readonly seen = fixedPuzzles('train', 50, 98);
  private readonly unseen = fixedPuzzles('test', 50, 99);
  readonly steps = signal(0);
  readonly scores = signal<readonly (readonly [number, number])[]>([[this.model.accuracy(this.seen), this.model.accuracy(this.unseen)]]);
  readonly last = computed(() => this.scores()[this.scores().length - 1]);
  readonly done = computed(() => this.steps() >= TOTAL);

  readonly exampleTrace = computed(() => {
    this.steps();
    return this.model.run(this.example);
  });

  readonly phase = computed(() => {
    const [seen, unseen] = this.last();
    if (!this.steps()) return 'Avant tout entraînement : ses regards partent dans tous les sens, sa réponse est un tirage au sort.';
    if (unseen >= 0.9) return 'Il réussit sur des couples qu’il n’a jamais vus. Il n’a pas retenu des réponses : il a trouvé une méthode.';
    if (seen >= 0.9) return 'Il réussit ses fiches d’entraînement, mais pas encore les couples jamais vus : il s’appuie en partie sur ses habitudes.';
    return 'Il tâtonne : ses regards restent flous, il devine encore.';
  });

  readonly customNames = signal<readonly number[]>([3, 6, 4]);
  readonly customDrinks = signal<readonly number[]>([5, 6, 2]);
  readonly asked = signal(1);
  readonly custom = computed(() => makePuzzle(this.customNames(), this.customDrinks(), this.asked()));
  readonly customTrace = computed(() => {
    this.steps();
    return this.model.run(this.custom());
  });

  /** Habitudes mesurées sur les fiches de test : où va réellement le regard. */
  readonly habits = computed(() => {
    this.steps();
    let first = 0, second = 0;
    for (const puzzle of this.unseen) {
      const { attention } = this.model.run(puzzle);
      const asked = puzzle.ids.indexOf(puzzle.ids[LAST]);
      second += attention[1][LAST][asked + 1];
      first += (attention[0][1][0] + attention[0][3][2] + attention[0][5][4]) / 3;
    }
    return { first: first / this.unseen.length, second: second / this.unseen.length };
  });

  held(name: number, drink: number): boolean {
    return isHeldOut(name, drink);
  }

  answerRows(trace: Trace, puzzle: Puzzle): BarRow[] {
    return Array.from(trace.probs)
      .map((value, id) => ({ label: VOCAB[id], value, hit: id === puzzle.target, color: id === puzzle.target ? '#ffb454' : undefined }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }

  curve(which: 0 | 1): string {
    return this.scores().map((s, i) => `${((i * 20) / TOTAL) * 300},${105 - s[which] * 100}`).join(' ');
  }

  train(): void {
    document.getElementById('att-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.loop.start(() => {
      const start = performance.now();
      while (performance.now() - start < 5 && this.model.steps < TOTAL) {
        this.model.trainStep(16);
        if (this.model.steps % 20 === 0)
          this.scores.update((s) => [...s, [this.model.accuracy(this.seen), this.model.accuracy(this.unseen)]]);
      }
      this.steps.set(this.model.steps);
      return this.model.steps < TOTAL;
    });
  }

  reset(): void {
    this.model = new LookupModel(7, 24, 2, 0.004, 0.2);
    this.scores.set([[this.model.accuracy(this.seen), this.model.accuracy(this.unseen)]]);
    this.steps.set(0);
  }

  cycleName(slot: number): void {
    this.customNames.update((list) => this.cycle(list, slot, NAMES.length));
  }

  cycleDrink(slot: number): void {
    this.customDrinks.update((list) => this.cycle(list, slot, DRINKS.length));
  }

  /** Passe à la valeur suivante qui n'est pas déjà utilisée dans une autre fiche. */
  private cycle(list: readonly number[], slot: number, size: number): number[] {
    let value = list[slot];
    do value = (value + 1) % size;
    while (list.some((other, i) => i !== slot && other === value));
    return list.map((v, i) => (i === slot ? value : v));
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
