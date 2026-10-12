import { Component, OnDestroy, computed, signal } from '@angular/core';
import { Capot, Chapter, big } from '../shared';
import { CapotTrace } from './capot-trace';

interface Part {
  readonly name: string;
  readonly text: string;
  readonly seen: string;
}

const PARTS: readonly Part[] = [
  { name: 'Découper', text: 'Le texte est coupé en morceaux appelés tokens : les mots courants entiers, les mots rares en plusieurs pièces. Un modèle en connaît des dizaines de milliers.', seen: 'Nouveau' },
  { name: 'Placer', text: 'Chaque token est remplacé par sa position dans un espace à des milliers de dimensions, à laquelle on ajoute sa place dans la phrase.', seen: 'Chapitre 3 · la carte' },
  { name: 'Regarder', text: 'Chaque token consulte les précédents et recopie ce qui l’intéresse. Les grands modèles lancent des dizaines de regards différents en parallèle.', seen: 'Chapitre 6 · le regard' },
  { name: 'Transformer', text: 'Chaque token retravaille ensuite ce qu’il a recueilli dans un réseau de neurones comme celui du chapitre 5, en bien plus large. On pense qu’une bonne part des connaissances du modèle est rangée là.', seen: 'Chapitre 5 · le neurone' },
  { name: 'Parier', text: 'La position finale du dernier token est convertie en une probabilité pour chaque token possible.', seen: 'Chapitres 1 et 2' },
  { name: 'Tirer', text: 'Un token est tiré selon ces probabilités, ajouté au texte, et tout recommence avec un token de plus.', seen: 'Chapitre 2 · la boucle' },
];

interface Model {
  readonly name: string;
  readonly parameters: number;
  readonly layers: number;
  readonly context: number;
  readonly span: string;
}

const MODELS: readonly Model[] = [
  { name: 'Ton modèle du chapitre 6', parameters: 4464, layers: 2, context: 8, span: '1 h 14' },
  { name: 'GPT-1 · 2018', parameters: 117e6, layers: 12, context: 512, span: '3,7 ans' },
  { name: 'GPT-2 · 2019', parameters: 1.5e9, layers: 48, context: 1024, span: '48 ans' },
  { name: 'GPT-3 · 2020', parameters: 175e9, layers: 96, context: 2048, span: '5 500 ans' },
];

const DRAFT = ['4 places à 12 € : 4 × 12 = 48 €.', 'Avec le bon : 48 − 10 = 38 €.', 'On paie donc 38 €.'];

@Component({
  selector: 'v4-ch-scale',
  imports: [Capot, CapotTrace],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 7 · L’échelle</p>
      <h1>Le même mécanisme, <em>des milliards de fois</em></h1>
      <p class="lede">Tu connais maintenant toutes les pièces. Un grand modèle de langage ne contient presque rien d’autre : il en contient simplement beaucoup plus.</p>
    </header>

    <section class="moment stack">
      <div class="prose">
        <h2>La machine complète</h2>
        <p>Voici le trajet d’un texte dans un transformer. Clique sur chaque étape : tu les as presque toutes déjà construites.</p>
      </div>
      <div class="stage">
        <div class="pipeline">
          @for (part of parts; track part.name) {
            <button type="button" [class.on]="chosen() === $index" [class.block]="$index === 2 || $index === 3" (click)="chosen.set($index)"><small>{{ $index + 1 }}</small>{{ part.name }}</button>
          }
          <span class="repeat">bloc répété couche après couche</span>
          <span class="loopback">↺ le token tiré rejoint le texte, et on recommence</span>
        </div>
        <div class="part-detail">
          <span class="tiny">{{ parts[chosen()].seen }}</span>
          <p>{{ parts[chosen()].text }}</p>
        </div>
      </div>
      @if (step() === 0) { <button type="button" class="primary center" (click)="reveal(1, 'scale-ladder')">Et la taille ?</button> }
    </section>

    <v4-capot label="Suivre une fiche à travers toute la machine, nombre par nombre">
      <ng-template><v4-capot-trace /></ng-template>
    </v4-capot>

    @if (step() >= 1) {
      <section class="moment" id="scale-ladder">
        <div class="prose">
          <h2>Changer d’échelle</h2>
          <p>Ton modèle du chapitre 6 a trouvé une méthode en deux étapes avec 2 couches et quelques milliers de réglages.</p>
          <p>Entre lui et GPT-3, <strong>aucune idée fondamentalement nouvelle</strong> : plus de couches, plus de réglages, plus de texte. Chaque couche travaille sur le résultat de la précédente : des regards sur des regards, cent fois de suite.</p>
          <p class="do">Choisis un modèle pour mesurer l’écart.</p>
          <p class="aside">Les modèles actuels sont plus grands encore, mais leurs tailles ne sont plus toujours publiées.</p>
          @if (step() === 1) { <button type="button" class="primary" (click)="reveal(2, 'scale-draft')">Une dernière conséquence de la boucle</button> }
        </div>
        <div class="stage">
          <ul class="ladder">
            @for (model of models; track model.name) {
              <li [class.on]="picked() === $index" (click)="picked.set($index)">
                <span>{{ model.name }}</span>
                <span class="ladder-track"><span [style.width.%]="width(model)"></span></span>
                <strong>{{ big(model.parameters) }}</strong>
              </li>
            }
          </ul>
          <p class="hint">La barre grandit d’un cran chaque fois que le nombre est multiplié par 10.</p>
          <dl class="meters three">
            <div><dt>Couches</dt><dd>{{ model().layers }}</dd></div>
            <div><dt>Tokens visibles à la fois</dt><dd>{{ big(model().context) }}</dd></div>
            <div><dt>À un réglage par seconde</dt><dd>{{ model().span }}</dd></div>
          </dl>
        </div>
      </section>
    }

    @if (step() >= 2) {
      <section class="moment" id="scale-draft">
        <div class="prose">
          <h2>Réfléchir en écrivant</h2>
          <p>Rappelle-toi la boucle : chaque mot écrit <strong>redevient une entrée</strong>. Le modèle relit tout ce qu’il vient d’écrire avant de choisir le mot suivant.</p>
          <p>Il peut donc poser un résultat intermédiaire, puis le regarder, exactement comme la question regardait la bonne fiche. Le texte devient son <strong>brouillon</strong>.</p>
          <p>C’est le principe des modèles dits « de raisonnement » : on les entraîne à dérouler leurs étapes avant de répondre.</p>
          <button type="button" class="primary" [disabled]="drafting()" (click)="draft()">Dérouler le brouillon</button>
        </div>
        <div class="stage">
          <p class="tiny">Schéma de principe, pas une sortie de modèle</p>
          <p class="problem">Une place coûte 12 €. On est 4, et on a un bon de 10 €. Combien paie-t-on ?</p>
          <ol class="draft">
            @for (line of lines(); track $index) { <li>{{ line }}<small>relu avant d’écrire la suite</small></li> }
          </ol>
        </div>
      </section>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Un LLM, c’est : des positions pour les mots, des regards entre eux, un pari sur la suite, le tout réglé par descente de pente, puis répété à une échelle vertigineuse.</p>
          <p>Mais que se passe-t-il vraiment à l’intérieur, à cette échelle ? Des chercheurs ouvrent ces modèles comme tu as ouvert le tien.</p>
        </div>
      </section>
    }
  `,
})
export class ChScale extends Chapter implements OnDestroy {
  readonly parts = PARTS;
  readonly models = MODELS;
  readonly big = big;
  readonly chosen = signal(0);
  readonly picked = signal(0);
  readonly model = computed(() => MODELS[this.picked()]);
  readonly lines = signal<readonly string[]>([]);
  readonly drafting = signal(false);
  private timer = 0;

  width(model: Model): number {
    return (Math.log10(model.parameters) / 11.5) * 100;
  }

  draft(): void {
    this.lines.set([]);
    this.drafting.set(true);
    const next = () => {
      this.lines.update((lines) => [...lines, DRAFT[lines.length]]);
      if (this.lines().length < DRAFT.length) this.timer = window.setTimeout(next, 1100);
      else this.drafting.set(false);
    };
    next();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
