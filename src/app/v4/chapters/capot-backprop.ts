import { Component, computed, input, signal } from '@angular/core';
import { num, pct } from '../shared';
import { WORDS, WordMap, wordId } from '../engine/word-map';

const SHOWN = ['dort', 'grogne', 'mange', 'chasse'];
const TARGET = wordId('dort');
const PUSH = 0.001;

/** Capot du chapitre « La pente » : calculer la pente sans tâtonner. */
@Component({
  selector: 'v4-capot-backprop',
  template: `
    <div class="moment stack">
      <div class="prose two-col">
        <div>
          <h3>1 · La méthode naïve : pousser pour voir</h3>
          <p>Prenons une seule phrase, « le lion <strong>dort</strong> », et posons le lion en x = −1,5 et y = 1. Pour connaître la pente, on peut pousser sa coordonnée x d’un cheveu et regarder la surprise bouger.</p>
          <p class="formula">({{ num(pushed().after, 5) }} − {{ num(loss(), 5) }}) ÷ {{ push }} = <strong>{{ num(pushed().slope, 3) }}</strong></p>
          <p>Ça marche, mais il faut <strong>refaire tout le calcul pour chaque réglage</strong>. Avec 175 milliards de réglages, un seul pas d’apprentissage prendrait des siècles.</p>
        </div>
        <div>
          <h3>2 · La bonne méthode : remonter le calcul</h3>
          <p>La prédiction est une chaîne d’opérations simples. Chacune sait comment sa sortie réagit à ses entrées. On part donc de la fin, et on remonte en <strong>multipliant ces réactions</strong> : c’est la règle de la chaîne.</p>
          <p class="do">Remonte cran par cran et lis les nombres orange : ce sont les pentes.</p>
          <div class="controls">
            <button type="button" class="primary" [disabled]="level() >= 3" (click)="level.set(level() + 1)">Remonter d’un cran</button>
            <button type="button" [disabled]="!level()" (click)="level.set(0)">Revenir au départ</button>
          </div>
        </div>
      </div>
      <div class="stage">
        <div class="chain">
          <div class="link" [class.lit]="level() >= 3">
            <span class="tiny">Position du lion</span>
            <p class="cell"><b>x</b> {{ num(spot()[0]) }} @if (level() >= 3) { <em>{{ num(slope()[0], 3) }}</em> }</p>
            <p class="cell"><b>y</b> {{ num(spot()[1]) }} @if (level() >= 3) { <em>{{ num(slope()[1], 3) }}</em> }</p>
          </div>
          <span class="op">× flèches<br />+ biais</span>
          <div class="link" [class.lit]="level() >= 2">
            <span class="tiny">Scores</span>
            @for (row of rows(); track row.label) { <p class="cell"><b>{{ row.label }}</b> {{ num(row.score) }} @if (level() >= 2) { <em>{{ num(row.blame, 3) }}</em> }</p> }
            <p class="cell faint"><b>23 autres</b> … @if (level() >= 2) { <em>{{ num(otherBlame(), 3) }}</em> }</p>
          </div>
          <span class="op">softmax</span>
          <div class="link" [class.lit]="level() >= 1">
            <span class="tiny">Part donnée à « dort »</span>
            <p class="cell big">{{ pct(part()) }} @if (level() >= 1) { <em>{{ num(-1 / part(), 2) }}</em> }</p>
          </div>
          <span class="op">− ln</span>
          <div class="link lit">
            <span class="tiny">Surprise</span>
            <p class="cell big">{{ num(loss()) }} <em>1</em></p>
          </div>
        </div>
        <p class="explain" aria-live="polite">{{ explain() }}</p>
        @if (level() >= 3) {
          <p class="verdict">Pente par remontée : <strong>{{ num(slope()[0], 3) }}</strong> · pente par poussée : <strong>{{ num(pushed().slope, 3) }}</strong>. Le même nombre, obtenu en un seul passage, pour x <em>et</em> y à la fois. Et ce serait vrai pour 175 milliards de réglages.</p>
        }
      </div>
      <p class="aside wide">Voilà la <strong>rétropropagation</strong> : un passage dans le sens du calcul pour prédire, un passage à rebours pour distribuer les responsabilités. Le coût des deux est du même ordre. C’est cette économie qui rend possible l’entraînement de modèles géants.</p>
    </div>
  `,
})
export class CapotBackprop {
  readonly model = input.required<WordMap>();
  /** Un point fixe, ni bon ni catastrophique, pour que les nombres restent lisibles. */
  readonly spot = signal<readonly [number, number]>([-1.5, 1]).asReadonly();
  readonly num = num;
  readonly pct = pct;
  readonly push = PUSH.toLocaleString('fr-FR');
  readonly level = signal(0);

  private readonly probs = computed(() => this.model().probsAt(...this.spot()));
  readonly part = computed(() => this.probs()[TARGET]);
  readonly loss = computed(() => -Math.log(this.part()));

  readonly rows = computed(() => {
    const [x, y] = this.spot(), model = this.model();
    return SHOWN.map((label) => {
      const j = wordId(label);
      return { label, score: x * model.readout.at(0, j) + y * model.readout.at(1, j) + model.bias.data[j], blame: this.probs()[j] - (j === TARGET ? 1 : 0) };
    });
  });
  readonly otherBlame = computed(() => WORDS.reduce((sum, word, j) => (SHOWN.includes(word) ? sum : sum + this.probs()[j]), 0));

  /** Pente de la surprise par rapport à x et y : somme, sur tous les candidats, de (part − cible) × flèche. */
  readonly slope = computed<[number, number]>(() => {
    const model = this.model();
    let gx = 0, gy = 0;
    WORDS.forEach((_, j) => {
      const blame = this.probs()[j] - (j === TARGET ? 1 : 0);
      gx += blame * model.readout.at(0, j);
      gy += blame * model.readout.at(1, j);
    });
    return [gx, gy];
  });

  readonly pushed = computed(() => {
    const [x, y] = this.spot();
    const after = -Math.log(this.model().probsAt(x + PUSH, y)[TARGET]);
    return { after, slope: (after - this.loss()) / PUSH };
  });

  readonly explain = computed(() => {
    switch (this.level()) {
      case 0: return 'Point de départ : la surprise réagit à elle-même avec une pente de 1.';
      case 1: return 'Surprise = −ln(part). Sa pente vaut −1 ÷ part : plus la part de « dort » est petite, plus l’augmenter fait baisser la surprise.';
      case 2: return 'À travers le softmax, la pente de chaque score devient simplement : part donnée − part attendue. Négatif pour « dort » (il faut monter son score), positif pour tous les autres (il faut les baisser).';
      default: return 'Chaque score dépend de x à travers sa flèche. Pente de x = somme, sur tous les candidats, de (pente du score × composante x de sa flèche).';
    }
  });
}
