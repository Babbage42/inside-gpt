import { DecimalPipe } from '@angular/common';
import { Component, computed, EventEmitter, Output, signal } from '@angular/core';
import { MiniLanguageModel, MiniSnapshot, promptTokens } from './mini-model';
import { AttentionCheckpoint, TrainableAttentionModel } from './trainable-attention';
import { examples } from './mini-model';
import { vocabulary } from './world';

const checkpointKey = 'gradient-lab-v2-attention-checkpoint-v1';
const sourceKey = 'gradient-lab-v2-attention-source-v1';
const historyKey = 'gradient-lab-v2-attention-history-v1';
const stageKey = 'gradient-lab-v2-lesson5-stage-v1';

function readStage(): number {
  try { const value = Number(localStorage.getItem(stageKey)); return Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0; }
  catch { return 0; }
}

@Component({
  selector: 'app-v2-lesson-five-attention',
  imports: [DecimalPipe],
  templateUrl: './lesson-five-attention.html',
  styleUrl: './lesson-five-attention.scss',
})
export class V2LessonFiveAttention {
  @Output() backToLessonFour = new EventEmitter<void>();
  protected readonly Math = Math;
  protected readonly examples = examples;
  protected readonly vocabulary = vocabulary;
  protected readonly stage = signal(readStage());
  protected readonly busy = signal(false);
  protected readonly revision = signal(0);
  protected readonly history = signal<{ epoch: number; loss: number }[]>([]);
  protected readonly initial: TrainableAttentionModel;
  protected readonly learner: TrainableAttentionModel;
  protected readonly testInput = promptTokens('chat', 'mange');
  protected readonly targetId = vocabulary.indexOf('souris');
  protected readonly initialTrace = computed(() => this.initial.trace(this.testInput));
  protected readonly currentTrace = computed(() => { this.revision(); return this.learner.trace(this.testInput); });
  protected readonly initialPredicted = computed(() => this.predicted(this.initialTrace().probabilities));
  protected readonly currentPredicted = computed(() => this.predicted(this.currentTrace().probabilities));
  protected readonly currentLoss = computed(() => { this.revision(); return this.learner.meanLoss(); });
  protected readonly initialLoss: number;
  protected readonly qCheck = computed(() => { this.revision(); return this.learner.gradientCheck(examples[4], 'query', 0, 0); });
  protected readonly kCheck = computed(() => { this.revision(); return this.learner.gradientCheck(examples[4], 'key', 0, 0); });
  protected readonly vCheck = computed(() => { this.revision(); return this.learner.gradientCheck(examples[4], 'value', 0, 0); });
  protected readonly maxWeightShift = computed(() => {
    const before = this.initialTrace().weights.at(-1)!;
    const after = this.currentTrace().weights.at(-1)!;
    return Math.max(...before.map((weight, i) => Math.abs(weight - after[i])));
  });

  constructor() {
    const base = new MiniLanguageModel();
    let source: MiniSnapshot | null = null;
    try {
      const saved = localStorage.getItem(checkpointKey) ? localStorage.getItem(sourceKey) : null;
      if (saved) source = JSON.parse(saved) as MiniSnapshot;
    } catch { /* Use current E/W checkpoint. */ }
    try {
      const saved = source ? null : localStorage.getItem('gradient-lab-v2-mini-model-v2');
      if (saved) base.restore(JSON.parse(saved) as MiniSnapshot);
    } catch { /* Start from the deterministic base model. */ }
    if (source) {
      try { base.restore(source); }
      catch { source = null; }
    }
    const snapshot = base.snapshot();
    try { localStorage.setItem(sourceKey, JSON.stringify(snapshot)); } catch { /* private mode */ }
    this.initial = new TrainableAttentionModel(snapshot);
    this.learner = new TrainableAttentionModel(snapshot);
    this.initialLoss = this.initial.meanLoss();
    try {
      const saved = localStorage.getItem(checkpointKey);
      if (saved) this.learner.restore(JSON.parse(saved) as AttentionCheckpoint);
    } catch { /* Invalid checkpoint: keep initial parameters. */ }
    let savedHistory: { epoch: number; loss: number }[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
      if (Array.isArray(parsed) && parsed.every((point) => Number.isInteger(point.epoch) && point.epoch >= 0 && Number.isFinite(point.loss)))
        savedHistory = parsed;
    } catch { /* Keep the compact fallback. */ }
    this.history.set(savedHistory.at(-1)?.epoch === this.learner.epoch && savedHistory[0]?.epoch === 0
      ? savedHistory : [{ epoch: 0, loss: this.initialLoss },
        ...(this.learner.epoch > 0 ? [{ epoch: this.learner.epoch, loss: this.learner.meanLoss() }] : [])]);
  }

  protected train(epochs: number): void {
    const losses = this.learner.train(epochs);
    const start = this.learner.epoch - losses.length;
    this.history.update((points) => [...points, ...losses.map((loss, i) => ({ epoch: start + i + 1, loss }))]);
    this.persist();
  }

  protected async trainUntilPlateau(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      let previous = this.learner.meanLoss();
      for (let batch = 0; batch < 10; batch++) {
        this.train(100);
        const current = this.learner.meanLoss();
        if (previous - current < 0.001) break;
        previous = current;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } finally { this.busy.set(false); }
  }

  protected reset(): void {
    this.learner.restore(this.initial.snapshot());
    this.history.set([{ epoch: 0, loss: this.initialLoss }]);
    this.persist();
  }

  protected move(delta: number): void {
    const next = this.stage() + delta;
    if (next < 0) this.backToLessonFour.emit();
    else {
      this.stage.set(Math.min(4, next));
      try { localStorage.setItem(stageKey, String(this.stage())); } catch { /* private mode */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected weight(initial: boolean, position: number): number {
    return (initial ? this.initialTrace() : this.currentTrace()).weights.at(-1)![position] * 100;
  }

  protected parameter(kind: 'query' | 'key' | 'value', initial: boolean): number {
    this.revision();
    return (initial ? this.initial : this.learner).parameter(kind, 0, 0);
  }

  protected testProbability(initial: boolean): number {
    return (initial ? this.initialTrace() : this.currentTrace()).probabilities[this.targetId] * 100;
  }

  protected maxBar(loss: number): number { return Math.max(5, Math.min(100, 100 * loss / Math.max(this.initialLoss, 0.01))); }

  private predicted(probabilities: readonly number[]): string {
    const best = probabilities.reduce((index, value, i) => value > probabilities[index] ? i : index, 0);
    return vocabulary[best];
  }

  private persist(): void {
    this.revision.update((value) => value + 1);
    try {
      localStorage.setItem(checkpointKey, JSON.stringify(this.learner.snapshot()));
      localStorage.setItem(historyKey, JSON.stringify(this.history()));
    }
    catch { /* private mode */ }
  }
}
