import { Component, computed, input, signal } from '@angular/core';
import { FAMILY_COLOR, num, pct } from '../shared';
import { WORDS, WordMap, familyOf, wordId } from '../engine/word-map';

const VERBS = WORDS.filter((word) => familyOf(word) === 'verbe');

/** Capot du chapitre « La carte » : de la position aux pourcentages. */
@Component({
  selector: 'v4-capot-readout',
  template: `
    <div class="moment">
      <div class="prose">
        <h3>1 · Le vrai calcul, avec deux boutons</h3>
        <p>Dans le modèle entraîné, le mot lu a deux boutons et chaque candidat aussi. La note s’obtient comme avec un seul : on multiplie bouton par bouton, et on additionne. S’y ajoute un <strong>bonus</strong> propre au candidat (son « biais »), qui traduit simplement qu’il est fréquent ou rare.</p>
        <p class="do">Choisis un mot lu, puis un candidat.</p>
        <div class="chips">
          @for (w of readable; track w) { <button type="button" [class.on]="w === word()" [style.--tone]="tone(w)" (click)="word.set(w)">{{ w }}</button> }
        </div>
        <div class="chips">
          @for (v of verbs; track v) { <button type="button" [class.on]="v === candidate()" style="--tone: #b39dff" (click)="candidate.set(v)">{{ v }}</button> }
        </div>
        <p class="formula">
          note(« {{ candidate() }} ») = <span class="pos">{{ num(point()[0]) }}</span> × <span class="arr">{{ num(arrow()[0]) }}</span> + <span class="pos">{{ num(point()[1]) }}</span> × <span class="arr">{{ num(arrow()[1]) }}</span> + {{ num(bias()) }} = <strong>{{ num(score()) }}</strong>
        </p>
        <p class="aside">En <span class="pos">orange</span>, les deux boutons de « {{ word() }} ». En <span class="arr">violet</span>, les deux boutons de « {{ candidate() }} ». Même signe dans une case : la note monte. Signes opposés : elle baisse. Ce calcul s’appelle un <strong>produit scalaire</strong>.</p>
        <p class="aside">Un même mot possède en réalité deux paires de boutons : une quand on le <em>lit</em>, une autre quand on le <em>propose</em>.</p>
        <h3>2 · Le même calcul, dessiné</h3>
        <p>Les deux boutons du mot lu sont un <strong>point</strong> sur la carte. Les deux boutons du candidat se dessinent en <strong>flèche</strong> partant du centre.</p>
        <p>La note répond alors à une question visuelle : le point est-il loin <strong>dans le sens de la flèche</strong> ? Le trait épais le mesure : c’est jusqu’où le point arrive le long de la flèche. Vert, la note monte. Rouge, le point est derrière la flèche, et la note est négative.</p>
        <p class="aside">Ce n’est pas un second calcul : c’est exactement la ligne ci-dessus, vue autrement.</p>
      </div>
      <div class="stage">
        <svg class="map" viewBox="-110 -110 220 220" role="img" aria-label="Position du mot lu et flèches des candidats">
          <line x1="-110" y1="0" x2="110" y2="0" class="axis" /><line x1="0" y1="-110" x2="0" y2="110" class="axis" />
          @for (a of arrows(); track a.verb) {
            <line x1="0" y1="0" [attr.x2]="a.x" [attr.y2]="a.y" class="cand" [class.on]="a.verb === candidate()" (click)="candidate.set(a.verb)" />
            @if (a.verb === candidate()) { <text [attr.x]="a.x * 1.08" [attr.y]="a.y * 1.08" class="cand-label">{{ a.verb }}</text> }
          }
          <line [attr.x1]="view().x" [attr.y1]="view().y" [attr.x2]="shadow().x" [attr.y2]="shadow().y" class="drop" />
          <line x1="0" y1="0" [attr.x2]="shadow().x" [attr.y2]="shadow().y" class="shadow" [class.neg]="score() - bias() < 0" />
          <circle [attr.cx]="view().x" [attr.cy]="view().y" r="4.5" [attr.fill]="tone(word())" stroke="#0d1326" />
          <text [attr.x]="view().x + 6" [attr.y]="view().y - 5" class="point-label">{{ word() }}</text>
        </svg>
        <p class="legend"><span><i style="background:#b39dff"></i>flèches des 12 verbes</span><span><i style="background:#6ee7a8"></i>le point est dans le sens de la flèche</span><span><i style="background:#ff8a8a"></i>il est derrière</span></p>
      </div>
    </div>

    <div class="moment">
      <div class="prose">
        <h3>3 · Des scores aux pourcentages</h3>
        <p>Les notes (les spécialistes disent « scores ») sont des nombres quelconques, parfois négatifs. Pour en faire des parts de 100 %, le modèle applique la fonction <strong>softmax</strong>, en deux temps :</p>
        <p><strong>e<sup>score</sup></strong> rend tout positif et creuse les écarts ; puis on <strong>divise par le total</strong>.</p>
        <label class="slider">Température : <strong>{{ num(temperature(), 1) }}</strong>
          <input type="range" min="0.2" max="3" step="0.1" [value]="temperature()" (input)="temperature.set(+$any($event.target).value)" />
        </label>
        <p>La <strong>température</strong> divise les scores avant le calcul. C’est le vrai réglage que proposent les LLM : basse, le modèle joue presque toujours son favori ; haute, il ose des suites improbables.</p>
        <p class="note">Une somme pondérée, puis une mise en forme du résultat : retiens ce motif. C’est exactement ce qu’on appelle un <strong>neurone</strong>, et il arrive au chapitre 5.</p>
      </div>
      <div class="stage">
        <p class="tiny">Après « {{ word() }} » · les six meilleurs candidats</p>
        <table class="calc">
          <thead><tr><th>candidat</th><th>score ÷ T</th><th>e<sup>score</sup></th><th colspan="2">part du total</th></tr></thead>
          <tbody>
            @for (row of table(); track row.label) {
              <tr [class.on]="row.label === candidate()">
                <th>{{ row.label }}</th><td>{{ num(row.score) }}</td><td>{{ num(row.exp) }}</td>
                <td class="bar"><span [style.width.%]="row.part * 100"></span></td><td>{{ pct(row.part) }}</td>
              </tr>
            }
            <tr class="rest"><th>21 autres mots</th><td></td><td>{{ num(rest().exp) }}</td><td class="bar"><span [style.width.%]="rest().part * 100"></span></td><td>{{ pct(rest().part) }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CapotReadout {
  readonly model = input.required<WordMap>();
  readonly tick = input(0);
  readonly num = num;
  readonly pct = pct;
  readonly readable = ['lion', 'chat', 'Marie', 'Nina', 'train'];
  readonly verbs = VERBS;
  readonly word = signal('lion');
  readonly candidate = signal('chasse');
  readonly temperature = signal(1);

  private readonly extent = computed(() => {
    this.tick();
    return Math.max(...WORDS.flatMap((w) => this.model().position(wordId(w)).map(Math.abs))) * 1.25;
  });
  private readonly reach = computed(() => {
    this.tick();
    return Math.max(...VERBS.map((v) => Math.hypot(...this.arrowOf(v))));
  });

  readonly point = computed(() => (this.tick(), this.model().position(wordId(this.word()))));
  readonly arrow = computed(() => (this.tick(), this.arrowOf(this.candidate())));
  readonly bias = computed(() => (this.tick(), this.model().bias.data[wordId(this.candidate())]));
  readonly score = computed(() => this.point()[0] * this.arrow()[0] + this.point()[1] * this.arrow()[1] + this.bias());
  readonly view = computed(() => ({ x: (this.point()[0] / this.extent()) * 100, y: (-this.point()[1] / this.extent()) * 100 }));
  readonly arrows = computed(() => VERBS.map((verb) => ({ verb, x: (this.arrowOf(verb)[0] / this.reach()) * 92, y: (-this.arrowOf(verb)[1] / this.reach()) * 92 })));

  /** Pied de la perpendiculaire : la projection du point sur la droite qui porte la flèche. */
  readonly shadow = computed(() => {
    const [ax, ay] = this.arrow(), [px, py] = this.point();
    const along = (px * ax + py * ay) / (ax * ax + ay * ay || 1);
    return { x: ((along * ax) / this.extent()) * 100, y: ((-along * ay) / this.extent()) * 100 };
  });

  private readonly all = computed(() => {
    this.tick();
    const [x, y] = this.point(), model = this.model(), t = this.temperature();
    const rows = WORDS.map((label, j) => ({ label, score: (x * model.readout.at(0, j) + y * model.readout.at(1, j) + model.bias.data[j]) / t }));
    const total = rows.reduce((sum, row) => sum + Math.exp(row.score), 0);
    return rows.map((row) => ({ ...row, exp: Math.exp(row.score), part: Math.exp(row.score) / total })).sort((a, b) => b.part - a.part);
  });
  readonly table = computed(() => this.all().slice(0, 6));
  readonly rest = computed(() => this.all().slice(6).reduce((sum, row) => ({ exp: sum.exp + row.exp, part: sum.part + row.part }), { exp: 0, part: 0 }));

  private arrowOf(verb: string): [number, number] {
    const j = wordId(verb);
    return [this.model().readout.at(0, j), this.model().readout.at(1, j)];
  }

  tone(word: string): string {
    return FAMILY_COLOR[familyOf(word)];
  }
}
