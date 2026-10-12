import { Component, OnDestroy, computed, signal } from '@angular/core';
import { BarRow, Bars, FrameLoop, Strip, num, pct } from '../shared';
import { LAST, LookupModel, VOCAB, makePuzzle, trainedLookup } from '../engine/lookup';

const TOTAL = 2000;
const PUZZLE = makePuzzle([0, 1, 2], [1, 3, 0], 1);

interface Stage {
  readonly title: string;
  readonly text: string;
}

const STAGES: readonly Stage[] = [
  { title: 'Des mots aux numéros', text: 'La machine ne manipule pas de lettres. Chaque token est remplacé par son numéro dans le vocabulaire : ici 17 tokens possibles, donc un numéro de 0 à 16. Ce numéro ne veut rien dire, c’est une adresse.' },
  { title: 'Du numéro à la bande', text: 'Le numéro sert à lire une ligne dans une grande table de réglages : la table des embeddings. Chaque token devient une bande de 24 nombres, sa position sur la carte. Remarque : les deux « Paul » ont exactement la même bande.' },
  { title: 'Ajouter la place dans la phrase', text: 'On additionne une seconde bande qui dépend seulement de la place (1er mot, 2e mot…). Sans elle, le modèle ne saurait pas dans quel ordre sont les mots. Les deux « Paul » sont maintenant différents.' },
  { title: 'Couche 1 : chacun regarde derrière lui', text: 'Chaque mot fabrique sa question, compare avec les étiquettes des mots précédents, et ajoute à sa bande un mélange de leurs contenus. La colonne de droite montre qui a regardé qui. Les boissons viennent de noter à qui elles appartiennent.' },
  { title: 'Couche 2 : même opération, sur des bandes enrichies', text: 'Mêmes calculs, autres réglages. Mais les bandes contiennent désormais ce que la couche 1 y a écrit. La question « ? Paul » peut donc trouver la boisson qui porte la marque de Paul, et recopier son contenu.' },
  { title: 'Lire la réponse', text: 'On ne regarde plus que la dernière bande. On calcule son alignement avec la flèche de chacun des 17 tokens (un produit scalaire par candidat), puis un softmax donne les probabilités. C’est la même lecture qu’au chapitre 3.' },
];

/** Capot du chapitre « L'échelle » : suivre une fiche à travers tout le mini-transformer. */
@Component({
  selector: 'v4-capot-trace',
  imports: [Bars, Strip],
  template: `
    @if (!model()) {
      <div class="moment solo">
        <div class="prose">
          <p>Pour suivre un vrai calcul, il faut un modèle entraîné. Celui du chapitre 6 n’est pas en mémoire : entraînons-en un, cela prend quelques secondes.</p>
          <div class="controls"><button type="button" class="primary" [disabled]="loop.running()" (click)="prepare()">{{ loop.running() ? 'Entraînement… ' + pct(progress()) : 'Entraîner le modèle' }}</button></div>
        </div>
      </div>
    } @else {
      <div class="moment wide">
        <div class="prose">
          <p class="tiny">Étape {{ stage() + 1 }} / {{ stages.length }}</p>
          <h3>{{ stages[stage()].title }}</h3>
          <p>{{ stages[stage()].text }}</p>
          <div class="controls">
            <button type="button" [disabled]="stage() === 0" (click)="stage.set(stage() - 1)">← Étape précédente</button>
            <button type="button" class="primary" [disabled]="stage() === stages.length - 1" (click)="stage.set(stage() + 1)">Étape suivante →</button>
          </div>
          @if (stage() === stages.length - 1) {
            <h3>Ce qu’un vrai LLM ajoute à ce trajet</h3>
            <ul class="plain">
              <li><strong>Un réseau de neurones après chaque regard</strong> (le MLP), qui retravaille la bande de chaque mot. Notre mini-modèle n’en a pas.</li>
              <li><strong>Plusieurs regards en parallèle</strong> par couche (les « têtes »), chacun avec ses propres questions et étiquettes.</li>
              <li><strong>Une remise à l’échelle</strong> des bandes avant chaque opération (la normalisation), pour que l’entraînement reste stable.</li>
              <li><strong>Des dizaines de couches</strong> et des bandes de plusieurs milliers de nombres.</li>
            </ul>
            <p class="aside">Aucune de ces additions ne change le trajet : des bandes, enrichies couche après couche, puis lues à la fin.</p>
          }
        </div>
        <div class="stage">
          <table class="trace">
            <thead><tr><th>Token</th><th>N°</th><th>{{ stage() ? 'Sa bande de 24 nombres' : '' }}</th><th>{{ stage() >= 3 && stage() <= 4 ? 'A surtout regardé' : '' }}</th></tr></thead>
            <tbody>
              @for (row of rows(); track $index) {
                <tr [class.changed]="row.changed" [class.asked]="$index === last">
                  <th>{{ row.token }}</th><td>{{ row.id }}</td>
                  <td>@if (row.strip) { <v4-strip [values]="row.strip" [scale]="2" /> }</td>
                  <td class="looked">{{ row.looked }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (stage() === 4) { <p class="hint">Ligne surlignée : la question, que cette couche vient d’enrichir avec le contenu de « jus ».</p> }
          @if (stage() === stages.length - 1) {
            <div class="under">
              <p class="tiny">Probabilités lues sur la dernière bande</p>
              <v4-bars [rows]="answer()" [scale]="1" />
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class CapotTrace implements OnDestroy {
  readonly stages = STAGES;
  readonly last = LAST;
  readonly pct = pct;
  readonly num = num;
  readonly loop = new FrameLoop();
  readonly model = signal<LookupModel | null>(trainedLookup.model);
  readonly progress = signal(0);
  readonly stage = signal(0);

  private readonly inspection = computed(() => this.model()!.inspect(PUZZLE));

  readonly rows = computed(() => {
    const inspection = this.inspection(), stage = this.stage();
    const state = stage === 0 ? null : stage === 1 ? inspection.token : inspection.stream[Math.min(stage, 4) - 2];
    const layer = stage === 3 || stage === 4 ? inspection.layers[stage - 3] : null;
    return PUZZLE.ids.map((id, i) => {
      let looked = '';
      if (layer && i > 0) {
        const weights = layer.weight[i].slice(0, i + 1), best = weights.indexOf(Math.max(...weights));
        looked = best === i ? 'lui-même' : `${VOCAB[PUZZLE.ids[best]]} · ${pct(weights[best])}`;
      }
      return { token: VOCAB[id], id, strip: state?.[i] ?? null, looked, changed: stage === 4 && i === LAST };
    });
  });

  readonly answer = computed<BarRow[]>(() =>
    this.inspection()
      .probs.map((value, id) => ({ label: VOCAB[id], value, hit: id === PUZZLE.target, color: id === PUZZLE.target ? '#ffb454' : undefined }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4),
  );

  prepare(): void {
    const model = new LookupModel(7, 24, 2, 0.004, 0.2);
    this.loop.start(() => {
      const start = performance.now();
      while (performance.now() - start < 14 && model.steps < TOTAL) model.trainStep(16);
      this.progress.set(model.steps / TOTAL);
      if (model.steps < TOTAL) return true;
      trainedLookup.model = model;
      this.model.set(model);
      return false;
    });
  }

  ngOnDestroy(): void {
    this.loop.stop();
  }
}
