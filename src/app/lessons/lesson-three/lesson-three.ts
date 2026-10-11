import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { LearningProgress } from '../../core/progress/learning-progress';

interface SwitchCase {
  readonly a: number;
  readonly b: number;
  readonly target: number;
  readonly label: string;
}

interface NetworkStep {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly takeaway: string;
}

@Component({
  selector: 'app-lesson-three',
  imports: [DecimalPipe],
  templateUrl: './lesson-three.html',
  styleUrl: './lesson-three.scss',
})
export class LessonThree {
  @Output() readonly completed = new EventEmitter<void>();

  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState(3, { started: false, step: 0 });
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly selectedCaseIndex = signal(1);
  protected readonly weightA = signal(1);
  protected readonly weightB = signal(1);
  protected readonly bias = signal(-0.5);
  protected readonly quizAnswer = signal<'more' | 'same' | 'random' | null>(null);

  protected readonly cases: readonly SwitchCase[] = [
    { a: 0, b: 0, target: 0, label: 'Aucun actif' },
    { a: 1, b: 0, target: 1, label: 'A seulement' },
    { a: 0, b: 1, target: 1, label: 'B seulement' },
    { a: 1, b: 1, target: 0, label: 'Les deux actifs' },
  ];

  protected readonly selectedCase = computed(() => this.cases[this.selectedCaseIndex()]);
  protected readonly singleScore = computed(() => this.score(this.selectedCase()));
  protected readonly singlePrediction = computed(() => this.activate(this.singleScore()));
  protected readonly singleResults = computed(() =>
    this.cases.map((item) => ({ ...item, prediction: this.activate(this.score(item)) })),
  );
  protected readonly singleAccuracy = computed(
    () => this.singleResults().filter((item) => item.prediction === item.target).length,
  );

  protected readonly anyActive = computed(() =>
    this.activate(this.selectedCase().a + this.selectedCase().b - 0.5),
  );
  protected readonly bothActive = computed(() =>
    this.activate(this.selectedCase().a + this.selectedCase().b - 1.5),
  );
  protected readonly networkScore = computed(() => this.anyActive() - this.bothActive() - 0.5);
  protected readonly networkPrediction = computed(() => this.activate(this.networkScore()));
  protected readonly networkRows = computed(() =>
    this.cases.map((item) => {
      const any = this.activate(item.a + item.b - 0.5);
      const both = this.activate(item.a + item.b - 1.5);
      return { ...item, any, both, output: this.activate(any - both - 0.5) };
    }),
  );
  protected readonly currentStep = computed(() => this.steps[this.step()]);
  protected readonly quizCorrect = computed(() => this.quizAnswer() === 'same');

  constructor() { effect(() => this.progress.saveLessonState(3, { started: this.started(), step: this.step() })); }

  protected readonly steps: readonly NetworkStep[] = [
    { kicker: 'Étape 1 · la nouvelle règle', title: 'La lampe obéit à quatre situations', text: 'Elle doit être allumée si un seul interrupteur est actif, mais éteinte si les deux sont identiques.', takeaway: 'Ce tableau de quatre exemples est notre minuscule dataset. Les entrées sont A et B ; la cible est l’état attendu de la lampe.' },
    { kicker: 'Étape 2 · essayer un neurone', title: 'Un neurone tente une seule décision', text: 'Il additionne A×w₁, B×w₂ et un biais, puis applique un seuil pour répondre 0 ou 1.', takeaway: 'Manipule les trois paramètres. Tu peux corriger certains cas, mais jamais obtenir quatre réponses justes simultanément.' },
    { kicker: 'Étape 3 · voir la frontière', title: 'Une somme pondérée sépare l’espace en deux', text: 'Le neurone place tous les cas d’un côté ou de l’autre d’une unique frontière droite.', takeaway: 'Les deux cas « allumé » occupent des coins opposés. Une seule droite ne peut pas les isoler des deux autres coins.' },
    { kicker: 'Étape 4 · comprendre l’échec', title: 'Ce n’est pas un mauvais réglage', text: 'Même un entraînement parfait ne trouverait aucune solution : l’architecture du modèle est trop limitée pour représenter cette règle.', takeaway: 'Quand un modèle échoue, davantage d’entraînement ne suffit pas toujours. Il peut manquer de capacité.' },
    { kicker: 'Étape 5 · premier détecteur', title: 'Le neurone 1 demande « au moins un ? »', text: 'Ses poids valent 1 et 1, son biais −0,5. Dès que A ou B vaut 1, la somme franchit le seuil et sa sortie devient 1.', takeaway: 'Ce neurone remplace deux entrées brutes par une information nouvelle : la présence d’au moins un interrupteur actif.' },
    { kicker: 'Étape 6 · second détecteur', title: 'Le neurone 2 demande « les deux ? »', text: 'Les poids restent 1 et 1, mais le biais passe à −1,5. Cette fois, il faut que A et B valent tous les deux 1 pour franchir le seuil.', takeaway: 'Deux neurones peuvent recevoir les mêmes entrées tout en détectant des conditions différentes grâce à leurs paramètres.' },
    { kicker: 'Étape 7 · représentation cachée', title: 'Le réseau change la façon de décrire chaque cas', text: 'Les quatre couples (A,B) deviennent quatre couples (au moins un, les deux). Dans ce nouvel espace, la réponse devient facile à calculer.', takeaway: 'On dit « couche cachée » car ces valeurs ne sont ni les données fournies ni la réponse demandée : ce sont des représentations internes.' },
    { kicker: 'Étape 8 · neurone de sortie', title: 'Le troisième neurone combine les détecteurs', text: 'Il donne un poids +1 à « au moins un », un poids −1 à « les deux », puis applique son seuil. Autrement dit : au moins un, sauf les deux.', takeaway: 'Un réseau construit une règle complexe en composant plusieurs réponses simples.' },
    { kicker: 'Étape 9 · rôle de l’activation', title: 'Sans activation, tout le réseau se réduirait à une seule formule', text: 'Additionner et multiplier sur plusieurs couches peut toujours se développer puis se regrouper en une somme pondérée unique.', takeaway: 'Le seuil entre les couches empêche cette simplification. C’est lui qui permet aux détecteurs intermédiaires de devenir de nouvelles informations discrètes.' },
    { kicker: 'Étape 10 · relier aux grands réseaux', title: 'Les réseaux apprennent eux-mêmes leurs représentations', text: 'Ici, nous avons choisi les détecteurs à la main. Pendant un véritable entraînement, les gradients ajustent les poids pour faire émerger des représentations utiles.', takeaway: 'Dans un LLM, une idée est généralement distribuée entre de nombreuses unités : il ne faut pas imaginer un unique « neurone du concept X ».' },
  ];

  protected score(item: SwitchCase): number {
    return item.a * this.weightA() + item.b * this.weightB() + this.bias();
  }

  protected activate(value: number): number {
    return value >= 0 ? 1 : 0;
  }

  protected update(name: 'weightA' | 'weightB' | 'bias', raw: string): void {
    const signals = { weightA: this.weightA, weightB: this.weightB, bias: this.bias };
    signals[name].set(Number(raw));
  }

  protected next(): void {
    this.step.update((value) => Math.min(this.steps.length - 1, value + 1));
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected answer(value: 'more' | 'same' | 'random'): void {
    this.quizAnswer.set(value);
  }
}
