import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, Output, signal } from '@angular/core';
import { MiniLanguageModel, MiniSnapshot, examples, promptTokens, sentencePairs } from './mini-model';
import { Animal, corpus, initialEmbedding, Verb, vocabulary } from './world';

interface TrainingEvent {
  readonly beforeLoss: number;
  readonly afterLoss: number;
  readonly oldWeight: number;
  readonly newWeight: number;
  readonly oldEmbedding: number;
  readonly newEmbedding: number;
  readonly epochs: number;
  readonly meanWeightGradient: number | null;
}

const stageTitles = [
  'Que prédit vraiment notre modèle ?',
  'Comment cinq mots deviennent-ils un résumé numérique ?',
  'Comment un poids agit-il sur le score de « souris » ?',
  'Comment des scores deviennent-ils des probabilités ?',
  'Comment mesurer une mauvaise réponse ?',
  'Peut-on améliorer la réponse en bougeant un seul poids ?',
  'Comment mesurer la direction à suivre ?',
  'Comment obtenir les pentes sans tout recalculer ?',
  'Que change une vraie correction des paramètres ?',
  'Le modèle aide-t-il sur notre phrase jamais entraînée ?',
] as const;

const stageBridge = [
  { have: 'Des mots connus et des paramètres stockés.', obstacle: 'Le préfixe test n’a jamais été appris directement.', move: 'Observer sa probabilité réelle avant toute explication technique.' },
  { have: 'Une prédiction encore faible.', obstacle: 'Chaque mot n’apporte pour l’instant que sa propre ligne E.', move: 'Suivre une case de E dans le résumé par moyenne.' },
  { have: 'Un résumé de quatre nombres.', obstacle: 'Il ne donne pas encore un score à chaque réponse possible.', move: 'Suivre une seule multiplication par un poids de W.' },
  { have: 'Un score brut par candidat.', obstacle: 'Un score n’est pas une part d’un total.', move: 'Observer la conversion en trois gestes.' },
  { have: 'Une probabilité pour chaque token.', obstacle: 'Il faut juger la part donnée à la vraie cible.', move: 'Mesurer une erreur sur une paire du corpus.' },
  { have: 'Une perte à réduire.', obstacle: 'Nous ne savons pas encore quel sens de variation aide.', move: 'Essayer un poids dans les deux directions.' },
  { have: 'Une perte qui varie avec un poids.', obstacle: 'Nous avons besoin d’une mesure locale de sa direction.', move: 'Comparer deux essais très proches.' },
  { have: 'Une pente obtenue par deux essais.', obstacle: 'Répéter ces essais pour chaque paramètre coûterait très cher.', move: 'Remonter le trajet des opérations une fois.' },
  { have: 'Des gradients pour E, W et les biais.', obstacle: 'Aucun paramètre n’a encore été corrigé par cette explication.', move: 'Exécuter une vraie époque et vérifier une valeur.' },
  { have: 'Un modèle qui peut maintenant être entraîné.', obstacle: 'Une baisse sur le corpus ne garantit rien pour le préfixe inédit.', move: 'Mesurer la perte et la réponse sur le test tenu à l’écart.' },
] as const;

function readStage(): number {
  try {
    const current = localStorage.getItem('gradient-lab-v2-lesson2-stage-v3');
    if (current !== null) return readNumber('gradient-lab-v2-lesson2-stage-v3', stageTitles.length);
    const old = readNumber('gradient-lab-v2-lesson2-stage-v2', 7);
    return [0, 1, 2, 3, 4, 6, 9, 10][old];
  } catch { return 0; }
}

function readNumber(key: string, max: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
  } catch { return 0; }
}

function restoreModel(model: MiniLanguageModel): void {
  try {
    const saved = localStorage.getItem('gradient-lab-v2-mini-model-v2');
    if (saved) model.restore(JSON.parse(saved) as MiniSnapshot);
  } catch { /* Keep a reproducible initial model if storage is unavailable or invalid. */ }
}

@Component({
  selector: 'app-v2-lesson-two',
  imports: [DecimalPipe],
  templateUrl: './lesson-two-v21.html',
  styleUrl: './lesson-two.scss',
})
export class V2LessonTwo {
  @Output() backToLessonOne = new EventEmitter<void>();
  @Output() continueToLessonThree = new EventEmitter<void>();

  protected readonly titles = stageTitles;
  protected readonly bridges = stageBridge;
  protected readonly corpus = corpus;
  protected readonly vocabulary = vocabulary;
  protected readonly sentencePairs = sentencePairs;
  protected readonly Math = Math;
  protected readonly examplesCount = examples.length;
  protected readonly initialRows = initialEmbedding();
  protected readonly model = new MiniLanguageModel();
  protected readonly stage = signal(readStage());
  protected readonly revision = signal(0);
  protected readonly animal = signal<Animal>('chat');
  protected readonly verb = signal<Verb>('mange');
  protected readonly article = signal<'le' | 'un'>('le');
  protected readonly token = signal('chat');
  protected readonly candidate = signal('souris');
  protected readonly coordinate = signal(0);
  protected readonly focusTokenIndex = signal(2);
  protected readonly weightDelta = signal(0);
  protected readonly learningDelta = signal(0);
  protected readonly softmaxStep = signal(0);
  protected readonly backpropView = signal<'forward' | 'backward'>('forward');
  protected readonly lossDemoProbability = signal(0.8);
  protected readonly lossDemoChoices = [1, 0.8, 0.5, 0.2, 0.05] as const;
  protected readonly rowIndex = signal(0);
  protected readonly pairIndex = signal(4);
  protected readonly history = signal<readonly { epoch: number; loss: number }[]>([]);
  protected readonly lastTraining = signal<TrainingEvent | null>(null);
  protected readonly prompt = computed(() => promptTokens(this.animal(), this.verb(), this.article()));
  protected readonly trace = computed(() => { this.revision(); return this.model.trace(this.prompt()); });
  protected readonly permutedPrompt = computed(() => [...this.prompt()].reverse());
  protected readonly permutedTrace = computed(() => { this.revision(); return this.model.trace(this.permutedPrompt()); });
  protected readonly candidateIndex = computed(() => vocabulary.indexOf(this.candidate() as typeof vocabulary[number]));
  protected readonly example = computed(() => sentencePairs(this.rowIndex())[this.pairIndex()]);
  protected readonly exampleTrace = computed(() => {
    this.revision();
    const item = this.example();
    return this.model.trace(item.input, item.target);
  });
  protected readonly gradient = computed(() => {
    this.revision();
    return this.model.gradientCheck(this.example(), this.coordinate());
  });
  protected readonly gradientToken = computed(() =>
    this.example().input[2] ?? this.example().input[1] ?? this.example().input[0]);
  protected readonly embeddingGradient = computed(() => {
    this.revision();
    return this.model.gradientCheckEmbedding(this.example(), this.gradientToken(), this.coordinate());
  });
  protected readonly exampleProbability = computed(() =>
    this.exampleTrace().probabilities[this.tokenId(this.example().target)]);
  protected readonly row = computed(() => { this.revision(); return this.model.embedding(this.token()); });
  protected readonly currentWeight = computed(() => {
    this.revision();
    return this.model.outputWeight(this.coordinate(), this.candidate());
  });
  protected readonly distribution = computed(() => vocabulary.map((token, index) => ({
    token, score: this.trace().logits[index], probability: this.trace().probabilities[index],
  })).sort((a, b) => b.probability - a.probability));
  protected readonly novelTrace = computed(() => {
    this.revision();
    return this.model.trace(promptTokens(this.animal(), this.verb(), 'un'));
  });
  protected readonly initialLoss = new MiniLanguageModel().meanLoss();
  protected readonly maxLogit = computed(() => Math.max(...this.trace().logits));
  protected readonly softmaxDenominator = computed(() => this.trace().logits.reduce(
    (total, score) => total + Math.exp(score - this.maxLogit()), 0,
  ));
  protected readonly coordinateSum = computed(() => this.trace().rows.reduce(
    (total, row) => total + row[this.coordinate()], 0,
  ));
  protected readonly visualScale = computed(() => Math.max(
    0.2,
    ...this.trace().rows.map((row) => Math.abs(row[this.coordinate()])),
    Math.abs(this.trace().context[this.coordinate()]),
  ));
  protected readonly previewScore = computed(() => this.trace().logits[this.candidateIndex()] +
    this.trace().context[this.coordinate()] * this.weightDelta());
  protected readonly previewWeight = computed(() => this.currentWeight() + this.weightDelta());
  protected readonly candidateExp = computed(() => Math.exp(
    this.trace().logits[this.candidateIndex()] - this.maxLogit(),
  ));
  protected readonly heroToken = computed(() => this.animal());
  protected readonly heroValue = computed(() => { this.revision(); return this.model.embedding(this.heroToken())[this.coordinate()]; });
  protected readonly heroShare = computed(() => this.heroValue() / this.prompt().length);
  protected readonly heroLogitShare = computed(() => this.heroShare() * this.currentWeight());
  protected readonly trial = computed(() => {
    const trace = this.exampleTrace();
    const target = this.tokenId(this.example().target);
    const logits = trace.logits.map((value, index) => index === target
      ? value + trace.context[this.coordinate()] * this.learningDelta() : value);
    const maximum = Math.max(...logits);
    const exp = logits.map((value) => Math.exp(value - maximum));
    const sum = exp.reduce((total, value) => total + value, 0);
    const probability = exp[target] / sum;
    return { probability, loss: -Math.log(probability), logit: logits[target] };
  });
  protected readonly curve = computed(() => {
    const target = this.tokenId(this.example().target);
    const trace = this.exampleTrace();
    return Array.from({ length: 41 }, (_, index) => {
      const delta = (index - 20) * 0.1;
      const logits = trace.logits.map((value, j) => j === target
        ? value + trace.context[this.coordinate()] * delta : value);
      const maximum = Math.max(...logits);
      const sum = logits.reduce((total, value) => total + Math.exp(value - maximum), 0);
      const probability = Math.exp(logits[target] - maximum) / sum;
      return { delta, loss: -Math.log(probability) };
    });
  });
  protected readonly curvePolyline = computed(() => {
    const points = this.curve();
    const losses = points.map((point) => point.loss);
    const minimum = Math.min(...losses);
    const maximum = Math.max(...losses);
    const range = Math.max(0.0001, maximum - minimum);
    return points.map((point, index) => `${24 + index * 10.8},${138 - (point.loss - minimum) / range * 112}`).join(' ');
  });
  protected readonly curveMarkerY = computed(() => {
    const losses = this.curve().map((point) => point.loss);
    const minimum = Math.min(...losses);
    const maximum = Math.max(...losses);
    return 138 - (this.trial().loss - minimum) / Math.max(0.0001, maximum - minimum) * 112;
  });

  constructor() {
    restoreModel(this.model);
    try {
      const saved = localStorage.getItem('gradient-lab-v2-mini-history-v2');
      const parsed = saved ? JSON.parse(saved) as { epoch: number; loss: number }[] : [];
      this.history.set(Array.isArray(parsed) && parsed.length ? parsed : [{ epoch: this.model.epoch, loss: this.model.meanLoss() }]);
    } catch { this.history.set([{ epoch: this.model.epoch, loss: this.model.meanLoss() }]); }
    effect(() => {
      try { localStorage.setItem('gradient-lab-v2-lesson2-stage-v3', String(this.stage())); } catch { /* private mode */ }
    });
  }

  protected move(delta: number): void {
    const next = this.stage() + delta;
    if (next < 0) this.backToLessonOne.emit();
    else this.stage.set(Math.min(stageTitles.length, next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected chooseAnimal(value: Animal): void {
    this.animal.set(value);
    if (this.token() === 'chat' || this.token() === 'chien') this.token.set(value);
  }

  protected chooseRow(index: number): void {
    this.rowIndex.set(index);
    this.pairIndex.set(Math.min(4, sentencePairs(index).length - 1));
  }

  protected train(epochs: number): void {
    const beforeLoss = this.model.meanLoss();
    const oldWeight = this.model.outputWeight(0, 'souris');
    const oldEmbedding = this.model.embedding('chat')[0];
    const meanWeightGradient = epochs === 1 ? this.model.batchGradientOutputWeight(0, 'souris') : null;
    const losses = this.model.train(epochs);
    const newHistory = [...this.history(), ...losses.map((loss, index) => ({ epoch: this.model.epoch - epochs + index + 1, loss }))];
    this.history.set(newHistory);
    this.lastTraining.set({
      beforeLoss, afterLoss: this.model.meanLoss(), oldWeight,
      newWeight: this.model.outputWeight(0, 'souris'), oldEmbedding,
      newEmbedding: this.model.embedding('chat')[0], epochs,
      meanWeightGradient,
    });
    this.revision.update((value) => value + 1);
    this.save();
  }

  protected resetModel(): void {
    this.model.restore(new MiniLanguageModel().snapshot());
    this.history.set([{ epoch: 0, loss: this.model.meanLoss() }]);
    this.lastTraining.set(null);
    this.revision.update((value) => value + 1);
    this.save();
  }

  protected barHeight(loss: number): number {
    return Math.max(4, Math.min(100, loss / this.initialLoss * 100));
  }

  protected fullHistory(): readonly { epoch: number; loss: number }[] {
    const points = this.history();
    const stride = Math.max(1, Math.ceil(points.length / 40));
    return points.filter((_, index) => index % stride === 0 || index === points.length - 1);
  }

  protected tokenId(token: string): number {
    return vocabulary.indexOf(token as typeof vocabulary[number]);
  }

  protected barLeft(value: number): number {
    return 50 + Math.min(0, value / this.visualScale()) * 43;
  }

  protected barWidth(value: number): number {
    return Math.abs(value / this.visualScale()) * 43;
  }

  protected lossFor(probability: number): number {
    return -Math.log(probability);
  }

  private save(): void {
    try {
      localStorage.setItem('gradient-lab-v2-mini-model-v2', JSON.stringify(this.model.snapshot()));
      localStorage.setItem('gradient-lab-v2-mini-history-v2', JSON.stringify(this.history()));
    } catch { /* private mode */ }
  }
}
