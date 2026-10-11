import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { LanguageExample, TinyAttentionModel } from '../../core/model/tiny-language-model';
import { LearningProgress } from '../../core/progress/learning-progress';

type SoilState = 'sec' | 'humide';
interface SavedLessonEight { readonly started: boolean; readonly step: number; readonly epoch: number; readonly revealed: readonly string[]; readonly observedInitial: boolean; readonly soilState: SoilState; readonly testedCounterfactual: boolean }

@Component({ selector: 'app-lesson-eight', imports: [DecimalPipe], templateUrl: './lesson-eight.html', styleUrl: './lesson-eight.scss' })
export class LessonEight {
  @Output() readonly completed = new EventEmitter<void>();
  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState<SavedLessonEight>(8, { started: false, step: 0, epoch: 0, revealed: [], observedInitial: false, soilState: 'sec', testedCounterfactual: false });
  protected readonly candidates = ['arroser', 'attendre'] as const;
  protected readonly corpus: readonly LanguageExample[] = [
    { tokens: ['tomate', 'sol', 'sec', 'donc'], target: 'arroser' },
    { tokens: ['basilic', 'sol', 'sec', 'donc'], target: 'arroser' },
    { tokens: ['menthe', 'sol', 'aride', 'donc'], target: 'arroser' },
    { tokens: ['tomate', 'sol', 'humide', 'donc'], target: 'attendre' },
    { tokens: ['basilic', 'sol', 'humide', 'donc'], target: 'attendre' },
    { tokens: ['menthe', 'sol', 'mouillé', 'donc'], target: 'attendre' },
  ];
  protected readonly vocabulary = [...new Set([...this.corpus.flatMap((example) => example.tokens), ...this.candidates])];
  protected readonly model = new TinyAttentionModel(this.vocabulary, this.candidates, 73);
  protected readonly initialModel = new TinyAttentionModel(this.vocabulary, this.candidates, 73);
  protected readonly initialLoss = this.initialModel.meanLoss(this.corpus);
  protected readonly lastTraining = signal<{ before: number; after: number } | null>(null);
  protected readonly checks = signal<Record<number, number>>(this.progress.lessonState<{ checks?: Record<number, number> }>(8, {}).checks ?? {});
  protected readonly missions = [
    { question: 'Pourquoi réserver « menthe sol sec donc » au test ?', options: ['Pour vérifier une combinaison absente des corrections', 'Pour donner une cible supplémentaire au gradient'], correct: 0, explanation: 'Les mots sont connus séparément. Garder cette association à part permet un test limité de recombinaison.' },
    { question: 'Quand je révèle une ligne, ai-je entraîné le modèle ?', options: ['Oui, la ligne vient d’être apprise', 'Non, je lis seulement des paramètres initiaux'], correct: 1, explanation: 'L’ID donne une adresse. Révéler n’effectue aucune correction ; ces lignes sont celles de l’état initial fixe.' },
    { question: 'Le modèle initial choisit une réponse. Est-ce une preuve de connaissance ?', options: ['Non, le calcul existe avant l’apprentissage', 'Oui, puisqu’il produit une probabilité'], correct: 0, explanation: 'Une distribution peut être calculée avec n’importe quels paramètres. Son utilité doit être évaluée sur les données.' },
    { question: 'Pourquoi utiliser les six exemples pour une mise à jour ?', options: ['Pour tenir compte de leurs contraintes communes', 'Pour ajouter la cible de notre test au calcul'], correct: 0, explanation: 'Les paramètres sont partagés. On combine les gradients du corpus d’entraînement uniquement.' },
    { question: 'La perte du corpus baisse. Qu’a-t-on vérifié ?', options: ['Une amélioration sur les exemples corrigés', 'Une compréhension générale de toutes les plantes'], correct: 0, explanation: 'La perte évalue les données utilisées pour la calculer. Il faut des contre-tests séparés pour examiner la généralisation.' },
    { question: 'Pour recalculer la première contribution de « sec », que multiplier ?', options: ['Sa part d’attention par la première coordonnée de sa Value', 'Son ID par la probabilité de « arroser »'], correct: 0, explanation: 'La clé aide à obtenir la part. La Value porte l’information à multiplier et à additionner au contexte.' },
    { question: 'Le vecteur de sortie du bloc est-il déjà une distribution de tokens ?', options: ['Non : il faut les lecteurs de sortie puis softmax', 'Oui : chaque coordonnée est directement une probabilité'], correct: 0, explanation: 'Une représentation peut être signée. Les lecteurs produisent des logits ; seul le softmax final produit la distribution.' },
    { question: 'Quand on change sec en humide pour tester, qu’est-ce qui reste fixe ?', options: ['Les paramètres appris, mais pas tous les résultats calculés', 'Les probabilités finales'], correct: 0, explanation: 'Les lignes sélectionnées et les calculs changent. Aucune cible, aucun gradient et aucune mise à jour ne sont nécessaires.' },
  ];
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly furthestStep = signal(Math.min(7, this.progress.lessonState<{ furthestStep?: number }>(8, {}).furthestStep ?? this.saved.step));
  protected readonly revision = signal(0);
  protected readonly revealed = signal<readonly string[]>(this.saved.revealed);
  protected readonly observedInitial = signal(this.saved.observedInitial);
  protected readonly soilState = signal<SoilState>(this.saved.soilState);
  protected readonly testedCounterfactual = signal(this.saved.testedCounterfactual);
  protected readonly steps = ['Mission', 'Tokens → lignes', 'Avant apprentissage', 'Un vrai gradient', 'Entraîner', 'Ouvrir l’attention', 'Traverser le bloc', 'Contre-test'] as const;
  protected readonly testTokens = computed(() => ['menthe', 'sol', this.soilState(), 'donc']);
  protected readonly trace = computed(() => { this.revision(); return this.model.trace(this.testTokens()); });
  protected readonly initialTrace = computed(() => this.initialModel.trace(this.testTokens()));
  protected readonly loss = computed(() => { this.revision(); return this.model.meanLoss(this.corpus); });
  protected readonly canNext = computed(() => {
    this.revision();
    if (this.checks()[this.step()] !== this.missions[this.step()].correct) return false;
    if (this.step() === 1) return this.testTokens().every((token) => this.revealed().includes(token));
    if (this.step() === 2) return this.observedInitial();
    if (this.step() === 3) return this.model.epoch >= 1;
    if (this.step() === 4) return this.model.epoch >= 1200;
    return true;
  });
  protected readonly canFinish = computed(() => this.canNext() && this.testedCounterfactual() && this.model.epoch >= 1200);

  constructor() {
    if (this.saved.epoch > 0) this.model.train(this.corpus, this.saved.epoch, 0.12);
    effect(() => { this.revision(); this.progress.saveLessonState(8, { started: this.started(), step: this.step(), furthestStep: this.furthestStep(), epoch: this.model.epoch, revealed: this.revealed(), observedInitial: this.observedInitial(), soilState: this.soilState(), testedCounterfactual: this.testedCounterfactual(), checks: this.checks() }); });
  }
  protected id(token: string): number { return this.vocabulary.indexOf(token); }
  protected reveal(token: string): void { if (!this.revealed().includes(token)) this.revealed.update((items) => [...items, token]); }
  protected train(epochs: number): void { const before = this.model.meanLoss(this.corpus); this.model.train(this.corpus, epochs, 0.12); this.lastTraining.set({ before, after: this.model.meanLoss(this.corpus) }); this.revision.update((value) => value + 1); }
  protected check(answer: number): void { this.checks.update(value => ({ ...value, [this.step()]: answer })); }
  protected canVisit(index: number): boolean { return index >= 0 && index < this.steps.length && (index <= this.furthestStep() || (index === this.step() + 1 && this.canNext())); }
  protected visit(index: number): void { if (this.canVisit(index)) { this.step.set(index); this.furthestStep.update(value => Math.max(value, index)); } }
  protected chooseState(state: SoilState): void { this.soilState.set(state); if (state === 'humide') this.testedCounterfactual.set(true); }
  protected next(): void { if (this.canNext()) this.visit(Math.min(this.steps.length - 1, this.step() + 1)); }
  protected previous(): void { this.step.update((value) => Math.max(0, value - 1)); }
}
