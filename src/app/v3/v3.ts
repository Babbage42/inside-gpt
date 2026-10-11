import { Component, computed, effect, signal } from '@angular/core';
import { MiniSnapshot, promptTokens } from '../v2/mini-model';
import { corpus, tokenize, trainingPairs, vocabulary } from '../v2/world';
import { Checkpoint, V3Checkpoint } from './checkpoint';
import { checkpoints, scenes, transferChecks } from './pilot-content';
import { PilotModel } from './pilot-model';
import { AnswerRecord, HistoryPoint, readPilotState, writePilotState } from './pilot-state';

interface LabReport { readonly epochs: number; readonly before: number; readonly after: number; readonly oldWeight: number; readonly newWeight: number; readonly gradient: number; }

@Component({
  selector: 'app-root',
  imports: [V3Checkpoint],
  templateUrl: './v3.html',
  styleUrl: './v3.scss',
})
export class V3Root {
  private readonly storage = this.getStorage();
  private readonly saved = readPilotState(this.storage);
  readonly pilot = new PilotModel();
  readonly scenes = scenes;
  readonly corpus = corpus;
  readonly vocabulary = vocabulary;
  readonly transferChecks = transferChecks;
  readonly scene = signal(this.saved.scene);
  readonly current = computed(() => scenes[this.scene()]);
  readonly seen = signal<readonly number[]>(this.saved.seen);
  readonly answers = signal<Readonly<Record<string, AnswerRecord>>>(this.saved.answers);
  readonly notes = signal(this.saved.notes);
  readonly saving = signal(true);
  readonly checkpoint = computed<Checkpoint | undefined>(() => checkpoints[this.scene()]);
  readonly corpusRow = signal(0);
  readonly heldoutTokens = ['le', 'chat', 'mange', 'la'];
  readonly lineTokens = computed(() => tokenize(corpus[this.corpusRow()]));
  readonly cut = signal(3);
  readonly pair = computed(() => trainingPairs(corpus[0])[this.cut()]);
  readonly targetRevealed = signal(false);
  readonly selectedToken = signal<string>('chat');
  readonly reversedIds = signal(false);
  readonly dictionary = computed(() => this.reversedIds() ? [...vocabulary].reverse() : [...vocabulary]);
  readonly tokenId = computed(() => this.dictionary().indexOf(this.selectedToken() as typeof vocabulary[number]));
  readonly originalId = computed(() => vocabulary.indexOf(this.selectedToken() as typeof vocabulary[number]));
  readonly tokenEmbedding = computed(() => this.pilot.embedding(this.selectedToken()));
  readonly coordinate = signal(0);
  readonly coordinateRows = computed(() => this.pilot.trace.rows.map((row) => row[this.coordinate()]));
  readonly coordinateSum = computed(() => this.coordinateRows().reduce((a, b) => a + b, 0));
  readonly productCount = signal(1);
  readonly products = this.pilot.contributions();
  readonly productsSum = computed(() => this.products.slice(0, this.productCount()).reduce((a, b) => a + b, 0));
  readonly competitorDelta = signal(0);
  readonly softmaxTrial = computed(() => this.pilot.interveneScore('pomme', this.competitorDelta()));
  readonly expTarget = Math.exp(this.pilot.trace.logits[this.pilot.targetIndex]);
  readonly expOthers = this.pilot.trace.logits.reduce((a, s, j) => a + (j === this.pilot.targetIndex ? 0 : Math.exp(s)), 0);
  readonly lossProbability = signal(0.1);
  readonly demoLoss = computed(() => -Math.log(this.lossProbability()));
  readonly lossPoints = Array.from({ length: 100 }, (_, i) => {
    const p = (i + 1) / 100;
    return `${this.lossX(p)},${this.lossY(-Math.log(p))}`;
  }).join(' ');
  readonly weightDelta = signal(0);
  readonly trial = computed(() => this.pilot.interveneWeight(this.weightDelta()));
  readonly curve = Array.from({ length: 61 }, (_, i) => {
    const delta = (i - 30) / 100;
    return { delta, loss: this.pilot.interveneWeight(delta).loss! };
  });
  readonly lossMinimum = Math.min(...this.curve.map((p) => p.loss));
  readonly lossMaximum = Math.max(...this.curve.map((p) => p.loss));
  readonly weightCurvePoints = this.curve.map((p) => `${this.weightX(p.delta)},${this.weightY(p.loss)}`).join(' ');
  readonly gradient = this.pilot.gradient();
  readonly backwardStep = signal(0);
  readonly branchCount = signal(1);
  readonly branches = [this.pilot.targetIndex, ...vocabulary.map((_, j) => j).filter((j) => j !== this.pilot.targetIndex)]
    .map((j) => ({ token: vocabulary[j], probability: this.pilot.trace.probabilities[j],
      scoreGradient: this.pilot.trace.probabilities[j] - (j === this.pilot.targetIndex ? 1 : 0),
      weight: this.pilot.snapshot.output[0][j],
      contribution: this.pilot.snapshot.output[0][j] * (this.pilot.trace.probabilities[j] - (j === this.pilot.targetIndex ? 1 : 0)),
    }));
  readonly branchSum = computed(() => this.branches.slice(0, this.branchCount()).reduce((a, row) => a + row.contribution, 0));
  readonly embeddingGradient = this.pilot.embeddingGradient();
  readonly updateRate = signal(0.7);
  readonly singleUpdate = computed(() => this.pilot.singleUpdate(this.updateRate()));
  readonly singleApplied = signal(false);
  readonly catGradient = this.gradient.analytic;
  readonly dogGradient = this.pilot.outputGradientFor(promptTokens('chien', 'mange'), 'pomme');
  private readonly lab = this.pilot.clone(this.saved.lab ?? this.pilot.snapshot);
  readonly revision = signal(0);
  readonly labHistory = signal<readonly HistoryPoint[]>(this.saved.history);
  readonly labAnimal = signal<'chat' | 'chien'>('chat');
  readonly labTrace = computed(() => { this.revision(); return this.lab.trace(promptTokens(this.labAnimal(), 'mange'), this.labAnimal() === 'chat' ? 'souris' : 'pomme'); });
  readonly testTrace = computed(() => { this.revision(); return this.lab.trace(promptTokens('chat', 'mange'), 'souris'); });
  readonly labLoss = computed(() => { this.revision(); return this.lab.meanLoss(); });
  readonly labEpoch = computed(() => { this.revision(); return this.lab.epoch; });
  readonly report = signal<LabReport | null>(null);
  readonly labUndo = signal<{ checkpoint: MiniSnapshot; history: readonly HistoryPoint[]; report: LabReport | null } | null>(null);
  readonly reportError = signal('');
  readonly transferSucceeded = computed(() => transferChecks.filter((q) => this.answers()[q.id]?.result === 'correct').length);
  readonly transferIndependent = computed(() => transferChecks.filter((q) => {
    const answer = this.answers()[q.id];
    return answer?.result === 'correct' && !answer.assisted;
  }).length);

  constructor() {
    effect(() => {
      this.revision();
      this.saving.set(writePilotState(this.storage, {
        version: 1, scene: this.scene(), seen: this.seen(), answers: this.answers(), notes: this.notes(),
        lab: this.lab.snapshot(), history: this.labHistory(),
      }));
    });
  }
  private getStorage(): Storage | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  }
  go(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= scenes.length) return;
    this.scene.set(index);
    this.seen.update((seen) => seen.includes(index) ? seen : [...seen, index]);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      // Move reading focus as well as the viewport; do not steal focus on initial load.
      setTimeout(() => document.getElementById('scene-title')?.focus({ preventScroll: true }), 0);
    }
  }
  saveAnswer(id: string, answer: AnswerRecord): void { this.answers.update((current) => ({ ...current, [id]: answer })); }
  canObserve(id: string): boolean { return (this.answers()[id]?.attempts ?? 0) > 0 || this.answers()[id]?.hint === true; }
  status(index: number): string {
    const q = checkpoints[index];
    if (q && this.answers()[q.id]?.result === 'correct') return this.answers()[q.id].assisted ? 'Réussi avec aide' : 'Réussi sans indice';
    return this.seen().includes(index) ? 'Consulté' : 'À découvrir';
  }
  changeCut(value: string): void { this.cut.set(Number(value)); this.targetRevealed.set(false); }
  setDelta(value: string): void { const number = Number(value); if (Number.isFinite(number)) this.weightDelta.set(number); }
  addProduct(): void { this.productCount.update((n) => Math.min(4, n + 1)); }
  backpropagateOne(): void { this.backwardStep.update((n) => Math.min(4, n + 1)); }
  addBranch(): void { this.branchCount.update((n) => Math.min(12, n + 1)); }
  probability(trace = this.pilot.trace): number { return trace.probabilities[this.pilot.targetIndex]; }
  lossX(p: number): number { return 42 + p * 370; }
  lossY(loss: number): number { return 188 - loss / 4.7 * 150; }
  weightX(delta: number): number { return 42 + (delta + 0.3) / 0.6 * 370; }
  weightY(loss: number): number { return 188 - (loss - this.lossMinimum) / (this.lossMaximum - this.lossMinimum) * 150; }
  barLeft(value: number): number { return value < 0 ? 50 + value / 0.2 * 45 : 50; }
  barWidth(value: number): number { return Math.abs(value) / 0.2 * 45; }
  trainLab(epochs: number): void {
    if (!Number.isInteger(epochs) || epochs < 1 || epochs > 100 || this.lab.epoch + epochs > 2000) return;
    const before = this.lab.meanLoss();
    const oldWeight = this.lab.outputWeight(0, 'souris');
    const gradient = this.lab.batchGradientOutputWeight(0, 'souris');
    const snapshot = this.lab.snapshot();
    try {
      const history = [...this.labHistory()];
      if (!history.length) history.push({ epoch: this.lab.epoch, loss: before, testProbability: this.testTrace().probabilities[this.pilot.targetIndex] });
      for (let i = 0; i < epochs; i++) {
        this.lab.train(1);
        const loss = this.lab.meanLoss();
        if (!Number.isFinite(loss)) throw new Error('Entraînement non fini.');
        history.push({ epoch: this.lab.epoch, loss, testProbability: this.lab.trace(promptTokens('chat', 'mange')).probabilities[this.pilot.targetIndex] });
      }
      this.labHistory.set(history);
      this.report.set({ epochs, before, after: this.lab.meanLoss(), oldWeight, newWeight: this.lab.outputWeight(0, 'souris'), gradient });
      this.reportError.set('');
    } catch {
      this.lab.restore(snapshot);
      this.reportError.set('Le calcul a été interrompu ; le dernier checkpoint valide est conservé.');
    }
    this.revision.update((n) => n + 1);
  }
  resetLab(): void {
    if (this.lab.epoch === 0) return;
    this.labUndo.set({ checkpoint: this.lab.snapshot(), history: this.labHistory(), report: this.report() });
    this.lab.restore(this.pilot.snapshot);
    this.labHistory.set([]); this.report.set(null); this.revision.update((n) => n + 1);
  }
  undoReset(): void {
    const saved = this.labUndo();
    if (saved) { this.lab.restore(saved.checkpoint); this.labHistory.set(saved.history); this.report.set(saved.report); this.labUndo.set(null); this.revision.update((n) => n + 1); }
  }
  historyPoints(metric: 'loss' | 'testProbability'): string {
    const points = this.labHistory();
    const first = points[0]?.epoch ?? 0;
    const last = points[points.length - 1]?.epoch ?? 1;
    const scale = metric === 'loss' ? Math.max(3, ...points.map((p) => p.loss)) : 1;
    return points.map((p) => `${42 + (p.epoch - first) / Math.max(1, last - first) * 370},${188 - p[metric] / scale * 150}`).join(' ');
  }
  readonly format = (value: number, digits = 5): string => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}
