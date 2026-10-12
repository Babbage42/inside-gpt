import { Component, computed, input, signal } from '@angular/core';
import { Strip, num, pct } from '../shared';
import { LAST, LookupModel, Puzzle, VOCAB, fixedPuzzles } from '../engine/lookup';

const UNSEEN = fixedPuzzles('test', 100, 99);
const MODES = [
  { skip: -1, label: 'Modèle complet' },
  { skip: 0, label: 'Sans la couche 1' },
  { skip: 1, label: 'Sans la couche 2' },
];

/** Capot du chapitre « Le regard » : l'intérieur d'un arc, puis la preuve par ablation. */
@Component({
  selector: 'v4-capot-arc',
  imports: [Strip],
  template: `
    <div class="moment">
      <div class="prose">
        <h3>1 · Un mot, c’est {{ width() }} nombres</h3>
        <p>Dans ce modèle, chaque mot est une liste de {{ width() }} nombres, comme une position sur une carte à {{ width() }} dimensions. On la dessine en bande : <span class="pos-chip">orange</span> pour positif, <span class="neg-chip">bleu</span> pour négatif.</p>
        <h3>2 · La question et les étiquettes</h3>
        <p>À partir de sa bande, la question « ? {{ vocab[puzzle().ids[last]] }} » fabrique une <strong>bande-question</strong> (en la multipliant par une table de réglages). Chaque mot précédent fabrique de même une <strong>bande-étiquette</strong>.</p>
        <p>La ressemblance entre les deux se calcule case par case : on multiplie, puis on additionne tout. Deux cases de même couleur ajoutent des points, deux cases de couleurs opposées en retirent. C’est le même <strong>produit scalaire</strong> que pour la carte.</p>
        <p class="do">Clique sur un mot pour comparer son étiquette à la question.</p>
        <p class="formula">ressemblance = somme des produits ÷ √{{ width() }} = <strong>{{ num(view().score[picked()]) }}</strong></p>
        <h3>3 · Des ressemblances aux regards</h3>
        <p>Les ressemblances passent par un <strong>softmax</strong>, comme les scores de la carte : elles deviennent des parts de 100 %. Ce sont exactement les épaisseurs des arcs.</p>
      </div>
      <div class="stage">
        <div class="keys">
          @for (id of puzzle().ids.slice(0, last); track $index) {
            <button type="button" [class.on]="picked() === $index" (click)="picked.set($index)">
              <b>{{ vocab[id] }}</b><small>{{ num(view().score[$index], 1) }}</small>
              <span class="mini"><i [style.height.%]="view().weight[$index] * 100"></i></span><small>{{ pct(view().weight[$index]) }}</small>
            </button>
          }
        </div>
        <p class="hint">Sous chaque mot : sa ressemblance avec la question, puis la part de regard qu’il reçoit.</p>
        <dl class="strips">
          <dt>Question de « ? {{ vocab[puzzle().ids[last]] }} »</dt><dd><v4-strip [values]="view().query" [scale]="scale()" /></dd>
          <dt>Étiquette de « {{ vocab[puzzle().ids[picked()]] }} »</dt><dd><v4-strip [values]="view().keys[picked()]" [scale]="scale()" /></dd>
          <dt>Produits, case par case</dt><dd><v4-strip [values]="products()" [scale]="productScale()" /></dd>
        </dl>
      </div>
    </div>

    <div class="moment">
      <div class="prose">
        <h3>4 · Ce que la question reçoit</h3>
        <p>Chaque mot regardé offre une troisième bande, son <strong>contenu</strong>. La question reçoit le mélange des contenus, dosé par les regards, et l’<strong>ajoute</strong> à sa propre bande. Elle n’est pas remplacée : elle s’enrichit.</p>
        <p>Cette bande que chaque couche vient compléter porte un nom : le <strong>flux résiduel</strong>. C’est la mémoire de travail du modèle.</p>
        <h3>5 · La preuve : débrancher une couche</h3>
        <p>Dire « la couche 1 range, la couche 2 cherche » est une interprétation. Pour la vérifier, on <strong>débranche</strong> une couche et on mesure.</p>
        <div class="controls">
          @for (mode of modes; track mode.skip) { <button type="button" [class.primary]="skip() === mode.skip" (click)="skip.set(mode.skip)">{{ mode.label }}</button> }
        </div>
        <p class="note">Sans l’une ou l’autre, le modèle s’effondre. Les deux étapes sont bien <strong>toutes les deux nécessaires</strong> : c’est ce qu’on appelle un circuit.</p>
      </div>
      <div class="stage">
        <dl class="strips">
          <dt>La question avant la couche 2</dt><dd><v4-strip [values]="view().before" [scale]="scale()" /></dd>
          <dt>+ mélange des contenus reçus</dt><dd><v4-strip [values]="view().added" [scale]="scale()" /></dd>
          <dt>= la question après la couche 2</dt><dd><v4-strip [values]="view().after" [scale]="scale()" /></dd>
        </dl>
        <table class="compare spaced">
          <thead><tr><th></th><th>Couples jamais vus</th><th>Cette fiche</th></tr></thead>
          <tbody>
            @for (row of ablation(); track row.label) {
              <tr [class.on]="row.skip === skip()"><th>{{ row.label }}</th><td class="strong">{{ pct(row.accuracy) }}</td><td>{{ row.answer }} · {{ pct(row.confidence) }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CapotArc {
  readonly model = input.required<LookupModel>();
  readonly puzzle = input.required<Puzzle>();
  readonly tick = input(0);
  readonly num = num;
  readonly pct = pct;
  readonly vocab = VOCAB;
  readonly last = LAST;
  readonly modes = MODES;
  readonly picked = signal(3);
  readonly skip = signal(-1);
  readonly width = computed(() => this.model().width);

  readonly view = computed(() => {
    this.tick();
    const inspection = this.model().inspect(this.puzzle()), layer = inspection.layers[1];
    return {
      query: layer.query[LAST],
      keys: layer.key,
      score: layer.score[LAST],
      weight: layer.weight[LAST],
      before: inspection.stream[1][LAST],
      added: layer.added[LAST],
      after: inspection.stream[2][LAST],
    };
  });

  readonly products = computed(() => this.view().query.map((q, i) => (q * this.view().keys[this.picked()][i]) / Math.sqrt(this.width())));
  readonly scale = computed(() => Math.max(...this.view().query.map(Math.abs)) * 0.8);
  readonly productScale = computed(() => Math.max(...this.products().map(Math.abs), 1e-6));

  readonly ablation = computed(() => {
    this.tick();
    return MODES.map(({ skip, label }) => {
      const answer = this.model().answer(this.puzzle(), skip);
      return { skip, label, accuracy: this.model().accuracy(UNSEEN, skip), answer: VOCAB[answer], confidence: this.model().run(this.puzzle(), skip).probs[answer] };
    });
  });
}
