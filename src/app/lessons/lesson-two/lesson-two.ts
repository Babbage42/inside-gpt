import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { createClassificationGraph, Value } from '../../core/autograd/value';
import { LearningProgress } from '../../core/progress/learning-progress';

interface ClassifierStep {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly observation: string;
}

@Component({
  selector: 'app-lesson-two',
  imports: [DecimalPipe],
  templateUrl: './lesson-two.html',
  styleUrl: './lesson-two.scss',
})
export class LessonTwo {
  @Output() readonly completed = new EventEmitter<void>();

  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState(2, { started: false, step: 0 });
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly containsFree = signal(1);
  protected readonly linkCount = signal(2);
  protected readonly wordWeight = signal(1.5);
  protected readonly linkWeight = signal(0.8);
  protected readonly bias = signal(-1.5);
  protected readonly quizAnswer = signal<'up' | 'down' | 'same' | null>(null);

  protected readonly graph = computed(() =>
    createClassificationGraph(
      this.containsFree(),
      this.linkCount(),
      this.wordWeight(),
      this.linkWeight(),
      this.bias(),
    ),
  );
  protected readonly score = computed(() => this.node('score').data);
  protected readonly probability = computed(() => this.graph().probability.data);
  protected readonly prediction = computed(() => (this.probability() >= 0.5 ? 'Spam probable' : 'Message normal'));
  protected readonly quizCorrect = computed(() => this.quizAnswer() === 'down');
  protected readonly currentStep = computed(() => this.steps[this.step()]);

  constructor() { effect(() => this.progress.saveLessonState(2, { started: this.started(), step: this.step() })); }

  protected readonly steps: readonly ClassifierStep[] = [
    { kicker: 'Étape 1 · changer de problème', title: 'Cette fois, le modèle doit choisir une catégorie', text: 'Il ne prédit plus une note mais répond à une question : ce message ressemble-t-il à un spam ?', observation: 'Une classification produit une catégorie. Ici, il n’existe que deux possibilités : spam ou message normal.' },
    { kicker: 'Étape 2 · traduire le réel', title: 'Le texte devient des nombres observables', text: 'Nous simplifions volontairement le message en deux indices : présence du mot « gratuit » et nombre de liens.', observation: 'Le modèle ne reçoit pas directement une signification. Il reçoit des nombres qui représentent certains aspects du message.' },
    { kicker: 'Étape 3 · pondérer les indices', title: 'Tous les indices n’ont pas la même importance', text: 'Chaque entrée est multipliée par un poids. Un poids positif transforme la présence d’un indice en preuve en faveur du spam.', observation: 'Compare les poids : le mot « gratuit » apporte ici plus de preuve qu’un seul lien.' },
    { kicker: 'Étape 4 · réunir les preuves', title: 'Le neurone calcule un score brut', text: 'Il additionne les indices pondérés et un biais. Le résultat z résume les preuves accumulées.', observation: 'Désactive le mot ou retire des liens : le score baisse immédiatement.' },
    { kicker: 'Étape 5 · constater une limite', title: 'Un score brut n’est pas une probabilité', text: 'z peut valoir −8, 1,6 ou 42. Or une probabilité doit toujours rester entre 0 et 1.', observation: 'La formule linéaire sait réunir des preuves, mais sa sortie n’a pas encore le format dont nous avons besoin.' },
    { kicker: 'Étape 6 · activer', title: 'Sigmoid transforme le score sans perdre son ordre', text: 'La fonction sigmoid comprime tout nombre réel entre 0 et 1. Un grand score positif se rapproche de 1, un score négatif de 0.', observation: 'C’est la fonction d’activation : elle transforme la sortie linéaire du neurone de façon non linéaire.' },
    { kicker: 'Étape 7 · décider', title: 'Une règle transforme la probabilité en catégorie', text: 'Nous choisissons un seuil de 50 %. Au-dessus, le modèle classe le message comme spam probable.', observation: 'Le seuil est une décision extérieure au neurone. On pourrait le relever pour rendre le filtre plus prudent.' },
    { kicker: 'Étape 8 · vérifier', title: 'As-tu compris le sens de l’activation ?', text: 'Réponds à la question sous le laboratoire pour valider la leçon.', observation: 'Cherche d’abord ce qui arrive au score brut, puis utilise le fait que sigmoid conserve l’ordre.' },
  ];

  protected node(id: string): Value {
    return this.graph().nodes.find((node) => node.id === id)!;
  }

  protected update(name: 'links' | 'wordWeight' | 'linkWeight' | 'bias', raw: string): void {
    const value = Number(raw);
    const signals = { links: this.linkCount, wordWeight: this.wordWeight, linkWeight: this.linkWeight, bias: this.bias };
    signals[name].set(value);
    this.quizAnswer.set(null);
  }

  protected toggleWord(): void {
    this.containsFree.update((value) => (value === 1 ? 0 : 1));
    this.quizAnswer.set(null);
  }

  protected next(): void {
    this.step.update((value) => Math.min(this.steps.length - 1, value + 1));
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected answer(value: 'up' | 'down' | 'same'): void {
    this.quizAnswer.set(value);
  }
}
