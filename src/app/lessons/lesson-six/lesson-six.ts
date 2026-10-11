import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { LanguageExample, TinyAttentionModel } from '../../core/model/tiny-language-model';
import { LearningProgress } from '../../core/progress/learning-progress';

interface SavedLessonSix { readonly started: boolean; readonly step: number; readonly epoch: number }

@Component({
  selector: 'app-lesson-six',
  imports: [DecimalPipe],
  templateUrl: './lesson-six.html',
  styleUrl: './lesson-six.scss',
})
export class LessonSix {
  @Output() readonly completed = new EventEmitter<void>();
  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState<SavedLessonSix>(6, { started: false, step: 0, epoch: 0 });
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
  protected readonly testTokens = ['chat', 'après', 'promenade', 'fatigué', 'donc'] as const;
  protected readonly steps = ['Le problème', 'Construire Q/K/V', 'Comparer Q et K', 'Softmax', 'V et mélange', 'Apprendre', 'Prédire'] as const;
  protected readonly selectedPosition = signal(3);
  protected readonly selectedProjection = signal<'Wq' | 'Wk' | 'Wv'>('Wq');
  protected readonly projectionToken = computed(() => this.selectedProjection() === 'Wq' ? 'donc' : this.testTokens[this.selectedPosition()]);
  protected readonly projectionVector = computed(() => this.selectedProjection() === 'Wq' ? this.trace().query : this.selectedProjection() === 'Wk' ? this.trace().keys[this.selectedPosition()] : this.trace().values[this.selectedPosition()]);
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly revision = signal(0);
  protected readonly model = new TinyAttentionModel(this.vocabulary, this.candidates);
  protected readonly trace = computed(() => { this.revision(); return this.model.trace(this.testTokens); });
  protected readonly attentionExponentials = computed(() => { const scores = this.trace().scores; const max = Math.max(...scores); return scores.map(score => Math.exp(score - max)); });
  protected readonly attentionTotal = computed(() => this.attentionExponentials().reduce((sum, value) => sum + value, 0));
  protected readonly trainingLoss = computed(() => { this.revision(); return this.model.meanLoss(this.corpus); });
  protected readonly trainedEnough = computed(() => { this.revision(); return this.model.epoch >= 1200; });

  constructor() {
    if (this.saved.epoch > 0) this.model.train(this.corpus, this.saved.epoch, 0.12);
    effect(() => { this.revision(); this.progress.saveLessonState(6, { started: this.started(), step: this.step(), epoch: this.model.epoch }); });
  }

  protected train(epochs: number): void { this.model.train(this.corpus, epochs, 0.12); this.revision.update((value) => value + 1); }
  protected next(): void { this.step.update((value) => Math.min(this.steps.length - 1, value + 1)); }
  protected previous(): void { this.step.update((value) => Math.max(0, value - 1)); }
  protected reset(): void { this.progress.clearLessonState(6); globalThis.location?.reload(); }
}
