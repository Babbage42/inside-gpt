import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, EventEmitter, inject, Output, signal } from '@angular/core';
import { LearningProgress } from '../../core/progress/learning-progress';

interface Transition {
  readonly from: string;
  readonly to: string;
}

interface TokenProbability {
  readonly token: string;
  readonly count: number;
  readonly probability: number;
}

interface LanguageStep {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly takeaway: string;
}

interface GenerationChoice {
  readonly strategy: 'greedy' | 'sample';
  readonly token: string;
  readonly probability: number;
  readonly draw?: number;
}

@Component({
  selector: 'app-lesson-four',
  imports: [DecimalPipe],
  templateUrl: './lesson-four.html',
  styleUrl: './lesson-four.scss',
})
export class LessonFour {
  @Output() readonly completed = new EventEmitter<void>();

  private readonly progress = inject(LearningProgress);
  private readonly saved = this.progress.lessonState(4, { started: false, step: 0 });
  protected readonly started = signal(this.saved.started);
  protected readonly step = signal(this.saved.step);
  protected readonly selectedToken = signal('le');
  protected readonly generated = signal<string[]>(['<début>', 'le']);
  protected readonly randomState = signal(999);
  protected readonly lastChoice = signal<GenerationChoice | null>(null);
  protected readonly quizAnswer = signal<'all' | 'last' | 'first' | null>(null);

  protected readonly sentences: readonly (readonly string[])[] = [
    ['le', 'chat', 'dort'],
    ['le', 'chat', 'mange'],
    ['le', 'chien', 'dort'],
    ['le', 'chien', 'mange'],
    ['le', 'chat', 'joue'],
  ];
  protected readonly vocabulary = ['<début>', 'le', 'chat', 'chien', 'dort', 'mange', 'joue', '<fin>'];
  protected readonly transitions: readonly Transition[] = this.sentences.flatMap((sentence) => {
    const tokens = ['<début>', ...sentence, '<fin>'];
    return tokens.slice(0, -1).map((from, index) => ({ from, to: tokens[index + 1] }));
  });

  protected readonly counts = computed(() => {
    const result = new Map<string, Map<string, number>>();
    for (const { from, to } of this.transitions) {
      if (!result.has(from)) result.set(from, new Map());
      const row = result.get(from)!;
      row.set(to, (row.get(to) ?? 0) + 1);
    }
    return result;
  });
  protected readonly distribution = computed(() => this.distributionFor(this.selectedToken()));
  protected readonly currentGeneratedToken = computed(() => this.generated().at(-1) ?? '<début>');
  protected readonly generatedDistribution = computed(() => this.distributionFor(this.currentGeneratedToken()));
  protected readonly currentStep = computed(() => this.steps[this.step()]);
  protected readonly quizCorrect = computed(() => this.quizAnswer() === 'last');

  constructor() { effect(() => this.progress.saveLessonState(4, { started: this.started(), step: this.step() })); }

  protected readonly steps: readonly LanguageStep[] = [
    { kicker: 'Étape 1 · la tâche', title: 'Un modèle de langage prédit le token suivant', text: 'On lui montre un début de séquence et on lui demande quels tokens pourraient raisonnablement venir ensuite.', takeaway: 'Un LLM ne rédige pas une réponse entière d’un seul coup. Il répète cette prédiction token après token.' },
    { kicker: 'Étape 2 · les données', title: 'Le modèle apprend à partir d’un corpus', text: 'Notre corpus contient seulement cinq phrases. Dans un grand modèle, il en contiendrait une quantité immense.', takeaway: 'Le corpus n’est pas une liste de règles grammaticales : ce sont des exemples de langage réellement observés.' },
    { kicker: 'Étape 3 · tokeniser', title: 'Le texte est découpé en unités manipulables', text: 'Pour commencer, chaque mot devient un token. Nous ajoutons aussi des marqueurs de début et de fin.', takeaway: 'Un token est un identifiant discret, pas nécessairement un mot. Les vrais LLM utilisent souvent des morceaux de mots.' },
    { kicker: 'Étape 4 · fabriquer les exemples', title: 'Chaque paire voisine devient une question et sa réponse', text: 'Dans « le chat dort », les exemples sont début→le, le→chat, chat→dort et dort→fin.', takeaway: 'Le token de gauche est l’entrée ; le token de droite est la cible que le modèle doit prédire.' },
    { kicker: 'Étape 5 · compter', title: 'Le bigramme mémorise les transitions observées', text: 'Après « le », notre corpus contient trois fois « chat » et deux fois « chien ». Le tableau rassemble ces comptes.', takeaway: 'Ce premier modèle n’utilise pas encore de neurones. Il isole la tâche de prédiction avant d’introduire une architecture plus complexe.' },
    { kicker: 'Étape 6 · normaliser', title: 'Les comptes deviennent une distribution de probabilités', text: 'On divise chaque compte par le total de sa ligne. Après « le », chat reçoit 3/5 = 60 % et chien 2/5 = 40 %.', takeaway: 'Une distribution attribue une probabilité à chaque possibilité et la somme de toutes les probabilités vaut 100 %.' },
    { kicker: 'Étape 7 · effectuer une prédiction', title: 'Le contexte sélectionne une ligne du modèle', text: 'Choisis un token dans le panneau. Le modèle retourne immédiatement sa distribution pour le suivant.', takeaway: 'Faire tourner le modèle sans modifier ses paramètres s’appelle l’inférence.' },
    { kicker: 'Étape 8 · générer', title: 'Échantillonner puis recommencer produit une séquence', text: 'On tire un token selon la distribution, on l’ajoute au texte, puis il devient le nouveau contexte.', takeaway: 'Choisir toujours le maximum rend la génération déterministe. Échantillonner conserve plusieurs continuations possibles.' },
    { kicker: 'Étape 9 · rencontrer la limite', title: 'Ce modèle ne regarde qu’un seul token en arrière', text: 'Après « le chat », il consulte uniquement la ligne « chat ». Il ne sait plus si la phrase contenait « le » auparavant.', takeaway: 'Un bigramme a une fenêtre de contexte de longueur 1. Les Transformers apprendront à utiliser un contexte beaucoup plus long.' },
    { kicker: 'Étape 10 · préparer le réseau neuronal', title: 'Les comptes seront remplacés par des paramètres appris', text: 'Un réseau recevra un token, construira une représentation numérique et produira un score pour chaque token possible.', takeaway: 'La tâche reste identique : prédire le suivant. Ce sont la représentation du contexte et la manière d’apprendre les scores qui deviennent plus puissantes.' },
  ];

  protected distributionFor(token: string): TokenProbability[] {
    const row = this.counts().get(token);
    if (!row) return [];
    const total = [...row.values()].reduce((sum, value) => sum + value, 0);
    return [...row.entries()]
      .map(([next, count]) => ({ token: next, count, probability: count / total }))
      .sort((a, b) => b.probability - a.probability || a.token.localeCompare(b.token));
  }

  protected count(from: string, to: string): number {
    return this.counts().get(from)?.get(to) ?? 0;
  }

  protected selectToken(token: string): void {
    this.selectedToken.set(token);
  }

  protected generate(strategy: 'greedy' | 'sample'): void {
    const options = this.generatedDistribution();
    if (options.length === 0 || this.currentGeneratedToken() === '<fin>') return;
    let next: string;
    let draw: number | undefined;
    if (strategy === 'greedy') {
      next = options[0].token;
    } else {
      const random = this.nextRandom();
      draw = random;
      let cumulative = 0;
      next = options.at(-1)!.token;
      for (const option of options) {
        cumulative += option.probability;
        if (random <= cumulative) {
          next = option.token;
          break;
        }
      }
    }
    const selected = options.find((option) => option.token === next)!;
    this.lastChoice.set({ strategy, token: next, probability: selected.probability, draw });
    this.generated.update((tokens) => [...tokens, next]);
  }

  protected resetGeneration(): void {
    this.generated.set(['<début>', 'le']);
    this.randomState.set(999);
    this.lastChoice.set(null);
  }

  protected next(): void {
    this.step.update((value) => Math.min(this.steps.length - 1, value + 1));
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected answer(value: 'all' | 'last' | 'first'): void {
    this.quizAnswer.set(value);
  }

  private nextRandom(): number {
    const state = (this.randomState() * 1664525 + 1013904223) % 4294967296;
    this.randomState.set(state);
    return state / 4294967296;
  }
}
