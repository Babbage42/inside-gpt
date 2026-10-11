import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { LanguageExample, TinyAttentionModel } from '../../core/model/tiny-language-model';
import { LearningProgress } from '../../core/progress/learning-progress';

interface SavedLessonSeven { readonly started: boolean; readonly step: number }

@Component({ selector: 'app-lesson-seven', imports: [DecimalPipe], templateUrl: './lesson-seven.html', styleUrl: './lesson-seven.scss' })
export class LessonSeven {
  @Output() readonly completed = new EventEmitter<void>();
  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState<SavedLessonSeven>(7, { started: false, step: 0 });
  protected readonly candidates = ['dort', 'joue', 'mange'] as const;
  protected readonly corpus: readonly LanguageExample[] = [
    { tokens: ['chat', 'semble', 'épuisé', 'donc'], target: 'dort' },
    { tokens: ['chien', 'après', 'promenade', 'fatigué', 'donc'], target: 'dort' },
    { tokens: ['souris', 'très', 'fatigué', 'donc'], target: 'dort' },
    { tokens: ['chat', 'encore', 'joueur', 'donc'], target: 'joue' },
    { tokens: ['chien', 'très', 'joueur', 'donc'], target: 'joue' },
    { tokens: ['souris', 'après', 'promenade', 'joueur', 'donc'], target: 'joue' },
    { tokens: ['chat', 'semble', 'affamé', 'donc'], target: 'mange' },
    { tokens: ['chien', 'encore', 'affamé', 'donc'], target: 'mange' },
    { tokens: ['souris', 'très', 'affamé', 'donc'], target: 'mange' },
  ];
  protected readonly vocabulary = [...new Set(this.corpus.flatMap((example) => example.tokens))];
  protected readonly tokens = ['chat', 'après', 'promenade', 'fatigué', 'donc'] as const;
  protected readonly model = new TinyAttentionModel(this.vocabulary, this.candidates);
  protected readonly checkpointEpoch = this.progress.lessonState<{ epoch: number }>(6, { epoch: 0 }).epoch;
  protected readonly trace = this.prepareTrace();
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly steps = ['Situer le bloc', 'Résiduel 1', 'Normaliser', 'Ouvrir le MLP', 'Résiduel 2', 'Sortie', 'Ordre et masque', 'Décodeur moderne'] as const;
  protected readonly hiddenIndex = signal(0);
  protected readonly hiddenPreactivation = computed(() => this.trace.normalized.reduce((sum, value, input) => sum + value * this.model.parameterValue(`W1:${input}:${this.hiddenIndex()}`), this.model.parameterValue(`b1:${this.hiddenIndex()}`)));
  protected readonly secondResidual = this.trace.normalized.map((value, d) => value + this.trace.mlp[d]);
  protected readonly secondMean = this.secondResidual.reduce((sum, value) => sum + value, 0) / 3;
  protected readonly secondDeviation = Math.sqrt(this.secondResidual.reduce((sum, value) => sum + (value - this.secondMean) ** 2, 0) / 3 + 1e-5);
  protected readonly causalPosition = signal(1);
  protected readonly reversedTokens = [...this.tokens.slice(0, -1)].reverse().concat('donc');
  protected readonly reversedTrace = this.model.trace(this.reversedTokens);
  protected readonly residualMean = computed(() => this.trace.residual.reduce((sum, value) => sum + value, 0) / this.trace.residual.length);
  protected readonly residualDeviation = computed(() => Math.sqrt(this.trace.residual.reduce((sum, value) => sum + (value - this.residualMean()) ** 2, 0) / this.trace.residual.length + 1e-5));

  constructor() { effect(() => this.progress.saveLessonState(7, { started: this.started(), step: this.step() })); }
  protected next(): void { this.step.update((value) => Math.min(this.steps.length - 1, value + 1)); }
  protected previous(): void { this.step.update((value) => Math.max(0, value - 1)); }
  private prepareTrace() { this.model.train(this.corpus, this.checkpointEpoch, 0.12); return this.model.trace(this.tokens); }
}
