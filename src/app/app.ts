import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { createLinearGraph, Value } from './core/autograd/value';
import { LearningProgress } from './core/progress/learning-progress';
import { LessonTwo } from './lessons/lesson-two/lesson-two';
import { LessonThree } from './lessons/lesson-three/lesson-three';
import { LessonFour } from './lessons/lesson-four/lesson-four';
import { LessonFive } from './lessons/lesson-five/lesson-five';
import { LessonSix } from './lessons/lesson-six/lesson-six';
import { LessonSeven } from './lessons/lesson-seven/lesson-seven';
import { LessonEight } from './lessons/lesson-eight/lesson-eight';
import { CourseCompass } from './lessons/course-compass';

interface GraphNodeView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly revealAt: number;
  readonly gradientAt: number;
}

interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly revealAt: number;
}

interface LessonStep {
  readonly eyebrow: string;
  readonly title: string;
  readonly explanation: string;
  readonly formula: string;
  readonly observation: string;
}

interface TrainingUpdate {
  readonly before: number;
  readonly after: number;
  readonly oldWeight: number;
  readonly newWeight: number;
}

interface SavedLessonOne {
  readonly started: boolean;
  readonly reviewing: boolean;
  readonly step: number;
  readonly input: number;
  readonly weight: number;
  readonly bias: number;
  readonly target: number;
  readonly learningRate: number;
}

@Component({
  selector: 'app-root',
  imports: [
    CourseCompass,
    DecimalPipe,
    LessonTwo,
    LessonThree,
    LessonFour,
    LessonFive,
    LessonSix,
    LessonSeven,
    LessonEight,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly learningProgress = inject(LearningProgress);
  protected readonly previewMode = this.learningProgress.previewMode;
  private readonly savedLessonOne = this.learningProgress.lessonState<SavedLessonOne>(1, {
    started: false, reviewing: false, step: 0, input: 2, weight: 10, bias: 20, target: 60, learningRate: 0.01,
  });
  protected readonly lessonStarted = signal(this.savedLessonOne.started);
  protected readonly reviewingLessonOne = signal(this.savedLessonOne.reviewing);
  protected readonly lessonFinished = signal(this.learningProgress.isCompleted(1));
  protected readonly nextLessonPreview = signal(this.learningProgress.currentLesson() >= 2);
  protected readonly lessonTwoFinished = signal(this.learningProgress.isCompleted(2));
  protected readonly lessonThreePreview = signal(this.learningProgress.currentLesson() >= 3);
  protected readonly lessonThreeFinished = signal(this.learningProgress.isCompleted(3));
  protected readonly lessonFourPreview = signal(this.learningProgress.currentLesson() >= 4);
  protected readonly lessonFourFinished = signal(this.learningProgress.isCompleted(4));
  protected readonly lessonFivePreview = signal(this.learningProgress.currentLesson() >= 5);
  protected readonly lessonFiveFinished = signal(this.learningProgress.isCompleted(5));
  protected readonly lessonSixPreview = signal(this.learningProgress.currentLesson() >= 6);
  protected readonly lessonSixFinished = signal(this.learningProgress.isCompleted(6));
  protected readonly lessonSevenPreview = signal(this.learningProgress.currentLesson() >= 7);
  protected readonly lessonSevenFinished = signal(this.learningProgress.isCompleted(7));
  protected readonly lessonEightPreview = signal(this.learningProgress.currentLesson() >= 8);
  protected readonly lessonEightFinished = signal(this.learningProgress.isCompleted(8));
  protected readonly input = signal(this.savedLessonOne.input);
  protected readonly weight = signal(this.savedLessonOne.weight);
  protected readonly bias = signal(this.savedLessonOne.bias);
  protected readonly target = signal(this.savedLessonOne.target);
  protected readonly learningRate = signal(this.savedLessonOne.learningRate);
  protected readonly step = signal(this.savedLessonOne.step);
  protected readonly selectedNodeId = signal('prediction');
  protected readonly lastUpdate = signal<TrainingUpdate | null>(null);

  protected readonly graph = computed(() =>
    createLinearGraph(this.input(), this.weight(), this.bias(), this.target()),
  );
  protected readonly loss = computed(() => this.graph().loss.data);
  protected readonly lessonComplete = computed(() => this.loss() < 0.01);
  protected readonly prediction = computed(() => this.node('prediction').data);
  protected readonly selectedNode = computed(() => this.node(this.selectedNodeId()));
  protected readonly currentStep = computed(() => this.steps[this.step()]);

  protected readonly nodeViews: readonly GraphNodeView[] = [
    { id: 'x', x: 44, y: 40, revealAt: 0, gradientAt: 9 },
    { id: 'w', x: 44, y: 160, revealAt: 0, gradientAt: 9 },
    { id: 'product', x: 250, y: 100, revealAt: 1, gradientAt: 8 },
    { id: 'b', x: 250, y: 260, revealAt: 0, gradientAt: 9 },
    { id: 'prediction', x: 456, y: 170, revealAt: 2, gradientAt: 7 },
    { id: 'target', x: 662, y: 300, revealAt: 0, gradientAt: 9 },
    { id: 'error', x: 662, y: 170, revealAt: 3, gradientAt: 6 },
    { id: 'loss', x: 868, y: 170, revealAt: 4, gradientAt: 5 },
  ];

  protected readonly edges: readonly GraphEdge[] = [
    { from: 'x', to: 'product', revealAt: 1 },
    { from: 'w', to: 'product', revealAt: 1 },
    { from: 'product', to: 'prediction', revealAt: 2 },
    { from: 'b', to: 'prediction', revealAt: 2 },
    { from: 'prediction', to: 'error', revealAt: 3 },
    { from: 'target', to: 'error', revealAt: 3 },
    { from: 'error', to: 'loss', revealAt: 4 },
  ];

  protected readonly steps: readonly LessonStep[] = [
    {
      eyebrow: 'Étape 1 · ce que le modèle reçoit',
      title: 'Des données et deux réglages',
      explanation:
        'Les heures et la note réelle viennent de l’exemple. Le poids et le biais sont les réglages internes du modèle.',
      formula: 'x = 2 h   ·   cible = 60 points',
      observation:
        'Repère les deux paramètres en vert : w et b. Ce sont eux, et non les données, que l’apprentissage modifiera.',
    },
    {
      eyebrow: 'Étape 2 · contribution des heures',
      title: 'Chaque heure rapporte des points selon le modèle',
      explanation:
        'Avec w = 10, le modèle suppose qu’une heure d’étude apporte 10 points. Pour 2 heures, cela fait 20 points.',
      formula: '2 heures × 10 points/heure = 20 points',
      observation:
        'Change temporairement le nombre d’heures : les points gagnés varient, mais w reste le même réglage.',
    },
    {
      eyebrow: 'Étape 3 · prédiction',
      title: 'Le modèle propose une note',
      explanation:
        'Il additionne les points gagnés au niveau de départ. Sa prédiction est donc 20 + 20 = 40.',
      formula: 'note prédite = x × w + b = 40',
      observation:
        'La prédiction n’est ni vraie ni fausse par nature : elle dépend des réglages w et b actuels.',
    },
    {
      eyebrow: 'Étape 4 · comparaison',
      title: 'On mesure le sens de l’erreur',
      explanation:
        'La note réelle était 60. Le modèle prédit 40 : son écart vaut −20, il prédit donc trop bas.',
      formula: 'écart = prédiction − réalité = 40 − 60 = −20',
      observation:
        'Le signe est informatif : négatif signifie « trop bas », positif signifierait « trop haut ».',
    },
    {
      eyebrow: 'Étape 5 · score d’erreur',
      title: 'La loss dit à quel point le modèle se trompe',
      explanation:
        'On élève l’écart au carré pour obtenir un score positif. Apprendre consistera à faire diminuer ce nombre.',
      formula: 'loss = écart² = (−20)² = 400',
      observation:
        'La loss n’est pas une note de réussite. Ici, 0 serait parfait et une grande valeur est mauvaise.',
    },
    {
      eyebrow: 'Étape 6 · point de départ du retour',
      title: 'Comment savoir quel réglage corriger ?',
      explanation:
        'On repart de la loss et on mesure sa sensibilité à chaque valeur intermédiaire. C’est le gradient.',
      formula: 'gradient = effet d’une petite variation sur la loss',
      observation:
        'Les nombres orange apparaissent. Ils ne sont pas de nouvelles valeurs : ce sont des sensibilités.',
    },
    {
      eyebrow: 'Étape 7 · remonter l’erreur',
      title: 'Le signal indique une prédiction trop basse',
      explanation:
        'La dérivée du carré vaut 2 × écart. Ici le gradient est négatif, donc augmenter la prédiction réduirait la loss.',
      formula: '∂loss/∂écart = 2 × (−20) = −40',
      observation:
        'Lis le signe du gradient comme une direction locale, pas comme la valeur de l’erreur elle-même.',
    },
    {
      eyebrow: 'Étape 8 · atteindre la prédiction',
      title: 'Le même signal arrive à la note prédite',
      explanation:
        'Ajouter le niveau de départ ne déforme pas le signal. La prédiction doit augmenter pour se rapprocher de 60.',
      formula: '∂loss/∂prédiction = −40',
      observation:
        'Si on augmentait très légèrement la prédiction, la loss diminuerait : le gradient négatif nous le dit.',
    },
    {
      eyebrow: 'Étape 9 · traverser la multiplication',
      title: 'L’influence du poids dépend de l’entrée',
      explanation:
        'Comme la prédiction contient x × w, modifier w a un effet multiplié par x. Avec x = 2, son gradient vaut −80.',
      formula: '∂loss/∂w = −40 × x = −80',
      observation:
        'Un même poids reçoit un signal plus fort lorsque la valeur d’entrée est grande.',
    },
    {
      eyebrow: 'Étape 10 · apprendre',
      title: 'Le modèle corrige ses paramètres',
      explanation:
        'On déplace w et b dans la direction opposée à leur gradient. Un petit pas suffit pour tester si la loss baisse.',
      formula: 'paramètre ← paramètre − pas × gradient',
      observation:
        'Clique sur « Faire apprendre le modèle », puis compare l’ancienne et la nouvelle loss.',
    },
  ];

  constructor() {
    effect(() => this.learningProgress.saveLessonState(1, {
      started: this.lessonStarted(), reviewing: this.reviewingLessonOne(), step: this.step(),
      input: this.input(), weight: this.weight(), bias: this.bias(), target: this.target(),
      learningRate: this.learningRate(),
    }));
  }

  protected node(id: string): Value {
    return this.graph().nodes.find((node) => node.id === id)!;
  }

  protected view(id: string): GraphNodeView {
    return this.nodeViews.find((node) => node.id === id)!;
  }

  protected update(
    signalName: 'input' | 'weight' | 'bias' | 'target' | 'learningRate',
    raw: string,
  ): void {
    const value = Number(raw);
    const signals = {
      input: this.input,
      weight: this.weight,
      bias: this.bias,
      target: this.target,
      learningRate: this.learningRate,
    };
    signals[signalName].set(value);
    this.lastUpdate.set(null);
  }

  protected startLesson(): void {
    this.lessonStarted.set(true);
    this.step.set(0);
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected next(): void {
    this.step.update((value) => Math.min(this.steps.length - 1, value + 1));
  }

  protected trainOnce(): void {
    this.trainSteps(1);
  }

  protected trainMany(): void {
    this.trainSteps(10);
  }

  private trainSteps(count: number): void {
    const before = this.loss();
    const oldWeight = this.weight();
    const rate = this.learningRate();
    for (let index = 0; index < count; index++) {
      const weightGradient = this.node('w').grad;
      const biasGradient = this.node('b').grad;
      this.weight.update((value) => value - rate * weightGradient);
      this.bias.update((value) => value - rate * biasGradient);
    }
    this.lastUpdate.set({ before, after: this.loss(), oldWeight, newWeight: this.weight() });
    this.step.set(9);
  }

  protected finishLesson(): void {
    if (!this.lessonComplete()) return;
    this.learningProgress.complete(1);
    this.lessonFinished.set(true);
    this.lessonStarted.set(false);
  }

  protected continueToNextLesson(): void {
    this.navigateToLesson(2);
  }

  protected completeLessonTwo(): void {
    this.learningProgress.complete(2);
    this.lessonTwoFinished.set(true);
    this.navigateToLesson(3);
  }

  protected completeLessonThree(): void {
    this.learningProgress.complete(3);
    this.lessonThreeFinished.set(true);
    this.navigateToLesson(4);
  }

  protected completeLessonFour(): void {
    this.learningProgress.complete(4);
    this.lessonFourFinished.set(true);
    this.navigateToLesson(5);
  }

  protected completeLessonFive(): void {
    this.learningProgress.complete(5);
    this.lessonFiveFinished.set(true);
    this.navigateToLesson(6);
  }

  protected completeLessonSix(): void {
    this.learningProgress.complete(6);
    this.lessonSixFinished.set(true);
    this.navigateToLesson(7);
  }

  protected completeLessonSeven(): void {
    this.learningProgress.complete(7);
    this.lessonSevenFinished.set(true);
    this.navigateToLesson(8);
  }

  protected completeLessonEight(): void {
    this.learningProgress.complete(8);
    this.lessonEightFinished.set(true);
  }

  protected navigateToLesson(lesson: number): void {
    if (!this.learningProgress.navigateTo(lesson)) return;
    if (lesson === 1) this.reviewingLessonOne.set(false);
    this.nextLessonPreview.set(lesson >= 2);
    this.lessonThreePreview.set(lesson >= 3);
    this.lessonFourPreview.set(lesson >= 4);
    this.lessonFivePreview.set(lesson >= 5);
    this.lessonSixPreview.set(lesson >= 6);
    this.lessonSevenPreview.set(lesson >= 7);
    this.lessonEightPreview.set(lesson >= 8);
  }

  protected reset(): void {
    this.input.set(2);
    this.weight.set(10);
    this.bias.set(20);
    this.target.set(60);
    this.learningRate.set(0.01);
    this.step.set(0);
    this.selectedNodeId.set('prediction');
    this.lastUpdate.set(null);
  }

  protected replayLessonOne(): void {
    this.reviewingLessonOne.set(true);
    this.lessonStarted.set(false);
    this.reset();
  }
}
