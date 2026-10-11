import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { EmbeddingBaseline, LanguageExample } from '../../core/model/tiny-language-model';
import { LearningProgress } from '../../core/progress/learning-progress';

interface SavedLessonFive {
  readonly contentVersion: 3 | 4;
  readonly started: boolean;
  readonly step: number;
  readonly epoch: number;
  readonly selectedToken: string;
  readonly didReorder: boolean;
  readonly answers?: Record<number, number>;
}

const INITIAL_STATE: SavedLessonFive = {
  contentVersion: 3,
  started: false,
  step: 0,
  epoch: 0,
  selectedToken: 'fatigué',
  didReorder: false,
};

@Component({
  selector: 'app-lesson-five',
  imports: [DecimalPipe],
  templateUrl: './lesson-five.html',
  styleUrl: './lesson-five.scss',
})
export class LessonFive {
  @Output() readonly completed = new EventEmitter<void>();

  private readonly progress = inject(LearningProgress);
  private readonly stored = this.progress.lessonState<Partial<SavedLessonFive>>(5, {});
  private readonly saved: SavedLessonFive =
    { ...INITIAL_STATE, ...this.stored, step: this.stored.contentVersion === 4 ? Math.min(11, this.stored.step ?? 0) : 0 };

  protected readonly candidates = ['dort', 'joue', 'mange'] as const;
  protected readonly corpus: readonly LanguageExample[] = [
    { tokens: ['chat', 'épuisé'], target: 'dort' },
    { tokens: ['chien', 'fatigué'], target: 'dort' },
    { tokens: ['souris', 'fatigué'], target: 'dort' },
    { tokens: ['chat', 'joueur'], target: 'joue' },
    { tokens: ['chien', 'joueur'], target: 'joue' },
    { tokens: ['chat', 'affamé'], target: 'mange' },
    { tokens: ['souris', 'affamé'], target: 'mange' },
  ];
  protected readonly vocabulary = [...new Set(this.corpus.flatMap((example) => example.tokens))];
  protected readonly trainingExample = this.corpus[1];
  protected readonly testTokens = ['chat', 'fatigué'] as const;
  protected readonly steps = [
    'Le problème à résoudre', 'Inventer des réglages partageables',
    'Retrouver une ligne : ID et one-hot', 'Faire coopérer les deux mots',
    'Lire le contexte avec trois neurones', 'Exprimer puis mesurer une prédiction',
    'Toucher un seul réglage', 'Retrouver la correction par le calcul',
    'Apprendre avec toutes les phrases', 'Voir ce que représente un vecteur',
    'Tester sans donner la réponse', 'Relier ce modèle à un LLM',
  ] as const;

  protected readonly started = signal(this.saved.started);
  protected readonly migrated = this.stored.started && this.stored.contentVersion !== 4;
  protected readonly step = signal(this.saved.step);
  protected readonly revision = signal(0);
  protected readonly selectedToken = signal(this.saved.selectedToken);
  protected readonly selectedCandidate = signal<(typeof this.candidates)[number]>('dort');
  protected readonly model = new EmbeddingBaseline(this.vocabulary, this.candidates);
  protected readonly studyModel = new EmbeddingBaseline(this.vocabulary, this.candidates);
  protected readonly study = this.studyModel.trace(this.trainingExample.tokens, this.trainingExample.target);
  protected readonly studyGradient = this.studyModel.gradientTrace(this.trainingExample);
  protected readonly studyExponentials = this.study.logits.map(value => Math.exp(value));
  protected readonly studyTotal = this.studyExponentials.reduce((sum, value) => sum + value, 0);
  protected readonly initialLoss = this.studyModel.meanLoss(this.corpus);
  protected readonly answers = signal<Record<number, number>>(this.saved.answers ?? {});
  protected readonly intervention = signal(0);
  protected readonly interventionTrace = computed(() => {
    const copy = this.studyModel.clone();
    copy.setEmbeddingCoordinate('fatigué', 0, this.studyModel.embedding('fatigué')[0] + this.intervention());
    return copy.trace(this.trainingExample.tokens, this.trainingExample.target);
  });
  protected readonly finiteDifference = (() => {
    const plus = this.studyModel.clone(); const minus = this.studyModel.clone();
    const x = this.studyModel.embedding('fatigué')[0];
    plus.setEmbeddingCoordinate('fatigué', 0, x + 0.001);
    minus.setEmbeddingCoordinate('fatigué', 0, x - 0.001);
    return (plus.trace(this.trainingExample.tokens, 'dort').loss! - minus.trace(this.trainingExample.tokens, 'dort').loss!) / 0.002;
  })();
  protected readonly rotated = signal(false);
  protected readonly geometryModel = computed(() => { this.revision(); return this.rotated() ? this.model.rotated() : this.model; });
  protected readonly plotLimit = computed(() => {
    this.revision();
    return Math.max(0.25, ...this.vocabulary.flatMap(token => this.model.embedding(token).map(Math.abs))) * 1.3;
  });
  protected readonly testAdjective = signal('fatigué');
  protected readonly counterTrace = computed(() => { this.revision(); return this.model.trace(['chat', this.testAdjective()]); });
  protected readonly questions = [
    { prompt: 'Pour tester une recombinaison, quelle phrase ne doit jamais servir à corriger les paramètres ?', options: ['chien fatigué → dort', 'chat fatigué → dort'], correct: 1, why: '« chien fatigué » est un exercice corrigé. « chat fatigué » reste réservé au test ; ses mots sont connus, leur association est nouvelle.' },
    { prompt: 'Avant tout entraînement, la première coordonnée signifie-t-elle « fatigue » ?', options: ['Oui, nous avons encodé ce sens', 'Non, c’est un réglage sans signification imposée'], correct: 1, why: 'Les deux coordonnées démarrent sans sens connu. Leur utilité dépend des corrections et de la façon dont les neurones les lisent.' },
    { prompt: 'Quand on écrit one-hot × table, que fait-on réellement ?', options: ['On sélectionne une ligne déjà présente', 'On apprend les valeurs de cette ligne'], correct: 0, why: 'Multiplier par 0 annule les autres lignes ; multiplier par 1 garde la ligne voulue. L’apprentissage est une autre opération, vue ensuite.' },
    { prompt: 'Que produit la moyenne si on échange « chien » et « fatigué » ?', options: ['Le même vecteur', 'Un nouveau vecteur sensible à la grammaire'], correct: 0, why: 'L’addition est commutative. Notre moyenne ne connaît pas l’ordre : c’est une limitation de ce premier modèle, pas une propriété souhaitable du langage.' },
    { prompt: 'Un poids de sortie est-il calculé à partir du sens du mot « dort » ?', options: ['Oui, il décrit une règle linguistique fournie', 'Non, il est ajusté à partir des erreurs'], correct: 1, why: 'Le neurone ne connaît pas le français. Ses poids sont des paramètres ; le produit et la somme calculent un score, pas les poids eux-mêmes.' },
    { prompt: 'Pour la cible « dort », que souhaite-t-on pendant l’apprentissage ?', options: ['Augmenter P(dort), donc réduire −ln P(dort)', 'Réduire P(dort) pour réduire la perte'], correct: 0, why: 'Une probabilité proche de 1 donne une perte proche de 0. La cible sert à évaluer la prédiction ; elle n’est pas ajoutée au contexte.' },
    { prompt: 'Pourquoi déplacer une coordonnée de ±0,001 ?', options: ['Pour lui donner un sens humain', 'Pour mesurer localement son effet sur l’erreur'], correct: 1, why: 'On ne devine pas une bonne valeur. On observe la pente de la perte autour de la valeur actuelle en gardant tout le reste identique.' },
    { prompt: 'Pourquoi soustraire le gradient ?', options: ['Parce qu’il indique le sens local de hausse de la perte', 'Parce que les bons paramètres doivent être négatifs'], correct: 0, why: 'Un gradient négatif conduit au contraire à augmenter le paramètre. La direction dépend du modèle actuel et de l’exemple.' },
    { prompt: 'Pourquoi corriger à partir de toutes les phrases ?', options: ['Pour éviter de favoriser un seul exercice au détriment des autres', 'Pour inclure secrètement la réponse du test'], correct: 0, why: 'Le même embedding est partagé entre ses occurrences. Nous moyennons les gradients du corpus, sans utiliser « chat fatigué → dort ».' },
    { prompt: 'Si les vecteurs ET les poids de lecture tournent ensemble, que devient la prédiction ?', options: ['Elle reste identique', 'Elle change car l’axe horizontal signifie toujours fatigue'], correct: 0, why: 'Le produit scalaire est préservé par une rotation commune. Les axes n’ont donc pas un sens humain imposé.' },
    { prompt: 'Réussir « chat fatigué » démontre-t-il une compréhension générale du français ?', options: ['Oui', 'Non, seulement la réussite de ce contre-test limité'], correct: 1, why: 'La combinaison est nouvelle mais le corpus minuscule et construit. Il faut d’autres tests et des données variées pour conclure davantage.' },
    { prompt: 'Que manque-t-il pour distinguer deux contextes contenant les mêmes mots dans un ordre différent ?', options: ['Entraîner plus longtemps cette moyenne', 'Changer le modèle pour représenter l’ordre et les interactions'], correct: 1, why: 'Aucun réglage ne rend cette moyenne sensible à l’ordre. La prochaine leçon étudie un mélange dépendant du contexte ; les positions doivent aussi être représentées.' },
  ];

  protected readonly testTrace = computed(() => {
    this.revision();
    return this.model.trace(this.testTokens);
  });
  protected readonly trainingLoss = computed(() => {
    this.revision();
    return this.model.meanLoss(this.corpus);
  });
  protected readonly selectedCandidateIndex = computed(() =>
    this.candidates.indexOf(this.selectedCandidate()),
  );
  protected readonly canContinue = computed(() => {
    this.revision();
    return this.answers()[this.step()] === this.questions[this.step()].correct && (this.step() !== 8 || this.model.epoch >= 300);
  });
  protected readonly canFinish = computed(() => { this.revision(); return this.canContinue() && this.model.epoch >= 300; });

  constructor() {
    if (this.saved.epoch > 0) this.model.train(this.corpus, this.saved.epoch);
    effect(() => {
      this.revision();
      this.progress.saveLessonState(5, {
        contentVersion: 4,
        started: this.started(),
        step: this.step(),
        epoch: this.model.epoch,
        selectedToken: this.selectedToken(),
        answers: this.answers(),
      });
    });
  }

  protected tokenId(token: string): number {
    return this.vocabulary.indexOf(token);
  }

  protected oneHot(token: string): readonly number[] {
    return this.vocabulary.map((candidate) => (candidate === token ? 1 : 0));
  }

  protected train(epochs: number): void {
    this.model.train(this.corpus, epochs);
    this.revision.update((value) => value + 1);
  }

  protected answer(index: number): void { this.answers.update(value => ({ ...value, [this.step()]: index })); }
  protected toggleRotation(): void { this.rotated.update(value => !value); }
  protected goTo(index: number): void {
    this.step.set(Math.max(0, Math.min(this.steps.length - 1, index)));
    document.getElementById('lesson-five-chapter')?.focus();
    document.getElementById('lesson-five-chapter')?.scrollIntoView({ block: 'start' });
  }
  protected plot(value: number): number { return 200 + value / this.plotLimit() * 155; }

  protected next(): void {
    if (!this.canContinue()) return;
    this.goTo(this.step() + 1);
  }

  protected previous(): void {
    this.goTo(this.step() - 1);
  }
}
