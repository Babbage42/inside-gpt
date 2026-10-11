import { Component, computed, effect, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Animal, corpus, continuations, initialEmbedding, prefix, subjectEvidence, tokenize, trainingPairs, Verb, vocabulary } from './world';
import { V2LessonTwo } from './lesson-two';
import { V2LessonThree } from './lesson-three';
import { V2LessonFour } from './lesson-four';
import { V2LessonFiveAttention } from './lesson-five-attention';

type View = 'intuition' | 'nombres' | 'code';

const screens = [
  { title: 'Que cherche-t-on à prédire ?', short: 'Poser la question', stage: '01 · Le problème' },
  { title: 'D’où viennent ces pourcentages ?', short: 'Auditer les données', stage: '02 · Les preuves' },
  { title: 'Que perd-on en oubliant le contexte ?', short: 'Casser le témoin', stage: '03 · L’ablation' },
  { title: 'Et si la phrase était nouvelle ?', short: 'Tester l’inédit', stage: '04 · La limite' },
  { title: 'Que reçoit le programme ?', short: 'Découper le texte', stage: '05 · Les tokens' },
  { title: 'Un ID est-il une grandeur ?', short: 'Interroger les IDs', stage: '06 · Les adresses' },
  { title: 'Comment obtenir un vecteur ?', short: 'Ouvrir la table', stage: '07 · Les vecteurs' },
] as const;

@Component({
  selector: 'app-root',
  imports: [DecimalPipe, V2LessonTwo, V2LessonThree, V2LessonFour, V2LessonFiveAttention],
  templateUrl: './v2.html',
  styleUrl: './v2.scss',
})
export class V2Root {
  protected readonly screens = screens;
  protected readonly corpus = corpus;
  protected readonly vocabulary = vocabulary;
  protected readonly embeddings = initialEmbedding();
  protected readonly lesson = signal(readLesson());
  protected readonly screen = signal(readScreen());
  protected readonly finished = signal(readFinished());
  protected readonly view = signal<View>('intuition');
  protected readonly animal = signal<Animal>('chat');
  protected readonly verb = signal<Verb>('mange');
  protected readonly lastOnly = signal(false);
  protected readonly selectedRow = signal<number | null>(null);
  protected readonly selectedToken = signal<string>('chat');
  protected readonly selectedCoordinate = signal(0);
  protected readonly scrambled = signal(false);
  protected readonly selectedPair = signal(4);
  protected readonly showWhy = signal(false);
  protected readonly sentence = computed(() => prefix(this.animal(), this.verb()));
  protected readonly novelSentence = computed(() => this.sentence());
  protected readonly novelMatches = computed(() => continuations(this.novelSentence()));
  protected readonly relatedEvidence = computed(() => subjectEvidence(this.animal()));
  protected readonly evidenceRows = computed(() => this.relatedEvidence().flatMap((item) => item.rows));
  protected readonly matching = computed(() => continuations(this.sentence(), this.lastOnly()));
  protected readonly fullMatching = computed(() => continuations(this.sentence()));
  protected readonly otherAnimal: Animal = 'chien';
  protected readonly otherPrefix = computed(() => prefix(this.animal() === 'chat' ? 'chien' : 'chat', this.verb()));
  protected readonly comparison = computed(() => continuations(this.otherPrefix(), this.lastOnly()));
  protected readonly tokenized = computed(() => tokenize(corpus[this.selectedRow() ?? 0]));
  protected readonly pairs = computed(() => trainingPairs(corpus[this.selectedRow() ?? 0]));
  protected readonly tokenIndex = computed(() => vocabulary.indexOf(this.selectedToken() as typeof vocabulary[number]));
  protected readonly shownId = computed(() => this.scrambled() ? vocabulary.length - 1 - this.tokenIndex() : this.tokenIndex());
  protected readonly embedding = computed(() => this.embeddings[this.tokenIndex()]);
  protected readonly sampleRows = computed(() => this.fullMatching().flatMap((item) => item.rows));
  protected readonly traceCorpusPrefix = computed(() => this.sentence());
  protected readonly traceCorpusMatches = computed(() => this.screen() === 3 ? this.novelMatches() : this.screen() === 2 ? this.matching() : this.fullMatching());
  protected readonly traceCorpusCount = computed(() => this.traceCorpusMatches().reduce((total, item) => total + item.count, 0));
  protected readonly traceTokens = computed(() => this.sentence());
  protected readonly traceIds = computed(() => this.traceTokens().map((token) => {
    const id = vocabulary.indexOf(token as typeof vocabulary[number]);
    return this.scrambled() && this.screen() === 5 ? vocabulary.length - 1 - id : id;
  }));
  protected readonly selectedTokenInPrompt = computed(() => this.traceTokens().includes(this.selectedToken()));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem('gradient-lab-v2-scene-v2', String(this.screen()));
        localStorage.setItem('gradient-lab-v2-finished-v2', String(this.finished()));
        localStorage.setItem('gradient-lab-v2-lesson-v1', String(this.lesson()));
      } catch { /* private mode */ }
    });
  }

  protected go(index: number): void {
    const next = Math.max(0, Math.min(screens.length - 1, index));
    if (next === 4 && this.screen() !== 4) {
      this.selectedRow.set(this.evidenceRows()[0] ?? 0);
      this.selectedPair.set(4);
    }
    if (next === 6) this.scrambled.set(false);
    this.screen.set(next);
    this.finished.set(false);
    this.view.set('intuition');
    this.showWhy.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected advance(): void {
    if (this.screen() < screens.length - 1) {
      this.go(this.screen() + 1);
      return;
    }
    this.finished.set(true);
    this.openLessonTwo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openLessonTwo(): void {
    this.lesson.set(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openLessonThree(): void {
    this.lesson.set(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openLessonFour(): void {
    this.lesson.set(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openLessonFive(): void {
    this.lesson.set(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openLessonOne(): void {
    this.lesson.set(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected back(): void {
    if (this.finished()) {
      this.finished.set(false);
    } else if (this.screen() > 0) {
      this.go(this.screen() - 1);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected setAnimal(value: Animal): void {
    this.animal.set(value);
    this.selectedRow.set(this.screen() === 4 ? this.evidenceRows()[0] ?? 0 : null);
    if (this.selectedToken() === 'chat' || this.selectedToken() === 'chien') this.selectedToken.set(value);
  }
  protected setVerb(value: Verb): void {
    this.verb.set(value);
    this.selectedRow.set(this.screen() === 4 ? this.evidenceRows()[0] ?? 0 : null);
  }
  protected rowsFor(token: string): readonly number[] { return this.matching().find((item) => item.token === token)?.rows ?? []; }
  protected containsSelected(row: number): boolean { return this.selectedRow() === row; }
  protected pair(index: number): { input: string[]; target: string } { return this.pairs()[index]; }
  protected formatted(text: readonly string[]): string { return text.join(' '); }
  protected rowNumbers(rows: readonly number[]): string { return rows.map((row) => row + 1).join(', '); }
  protected pseudocode(): string {
    switch (this.screen()) {
      case 0: return 'prefixe = ["le", animal, verbe, "la"]\ncontinuations = compter(corpus, prefixe)\nP(mot | prefixe) = compte(mot) / total';
      case 1: return 'pour chaque phrase du corpus :\n  si elle commence par prefixe :\n    compter le token suivant';
      case 2: return 'temoin = compter(corpus, dernier_token_seul)\ncontexte = compter(corpus, prefixe_complet)';
      case 3: return 'prefixe_test = ["le", animal, verbe, "la"]\n# Ce prefixe exact est tenu hors du corpus.\ncompter(corpus, prefixe_test) == {}\n# Il faut reutiliser des indices partiels.';
      case 4: return 'tokens = ["<début>", ...tokeniser(phrase)]\npour i de 1 à fin :\n  exemple = (tokens[:i], tokens[i])';
      case 5: return 'id = vocabulaire.indexOf(token)\n# Renommer tous les IDs de manière cohérente\n# ne change pas les tokens ni leurs fréquences.';
      default: return 'id = vocabulaire.indexOf(token)\nvecteur = E[id]  # lecture de la ligne\none_hot(id) × E == E[id]';
    }
  }
}

function readScreen(): number {
  try {
    const saved = localStorage.getItem('gradient-lab-v2-scene-v2');
    if (saved !== null) {
      const value = Number(saved);
      return Number.isInteger(value) && value >= 0 && value < screens.length ? value : 0;
    }
    const old = Number(localStorage.getItem('gradient-lab-v2-screen'));
    return Number.isInteger(old) && old >= 0 && old <= 5 ? old >= 3 ? old + 1 : old : 0;
  } catch { return 0; }
}

function readFinished(): boolean {
  try { return localStorage.getItem('gradient-lab-v2-finished-v2') === 'true'; }
  catch { return false; }
}

function readLesson(): 1 | 2 | 3 | 4 | 5 {
  try {
    const saved = localStorage.getItem('gradient-lab-v2-lesson-v1');
    return saved === '5' ? 5 : saved === '4' ? 4 : saved === '3' ? 3 : saved === '2' ? 2 : 1;
  }
  catch { return 1; }
}
