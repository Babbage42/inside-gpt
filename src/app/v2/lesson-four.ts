import { DecimalPipe } from '@angular/common';
import { Component, computed, EventEmitter, Output, signal } from '@angular/core';
import { MiniLanguageModel, MiniSnapshot, promptTokens } from './mini-model';
import { AttentionTrace, attentionProbe, initialAttentionParameters } from './attention-probe';
import { microAttention } from './micro-attention';
import { vocabulary } from './world';

const titles = [
  'Pourquoi voudrait-on choisir où regarder ?',
  'Comment garder ensemble un mot et sa place ?',
  'Comment fabriquer une question et des clés ?',
  'Comment calculer une lecture sans voir le futur ?',
  'Que fait-on des informations lues ?',
  'Que savons-nous vraiment à ce stade ?',
] as const;

const guides = [
  { question: 'La moyenne et le coefficient fixe ne choisissent pas selon la phrase.', action: 'Change « chat » ou « mange » dans le préfixe.', observe: 'Un mécanisme utile devra recalculer sa lecture à chaque entrée.' },
  { question: 'Où est passé le mot, et où est sa place ?', action: 'Choisis une place et coupe/rétablis son information de position.', observe: 'La ligne du mot et celle de la place s’additionnent, mais restent à cette place.' },
  { question: 'D’où viennent les nombres utilisés pour comparer ?', action: 'Suis une seule case de la question, puis change le mot.', observe: 'Q et K résultent de produits et d’une somme, pas d’une règle cachée.' },
  { question: 'Comment la dernière place calcule-t-elle ses parts de lecture ?', action: 'Avance dans le zoom 2D et clique une des quatre cellules.', observe: 'Un produit scalaire devient un score, puis une part ; le futur reste interdit.' },
  { question: 'Que font ces parts après la comparaison ?', action: 'Suis une coordonnée de chaque valeur V jusqu’à la somme.', observe: 'Chaque contenu contribue selon son poids, puis W produit les scores de sortie.' },
  { question: 'L’attention a-t-elle déjà appris à lire le bon mot ?', action: 'Compare les résultats et l’état des paramètres.', observe: 'Non : P et Q/K/V viennent seulement d’être initialisés.' },
] as const;

function savedStage(): number {
  try {
    const value = Number(localStorage.getItem('gradient-lab-v2-lesson4-stage-v2'));
    return Number.isInteger(value) && value >= 0 && value <= titles.length ? value : 0;
  } catch { return 0; }
}

@Component({
  selector: 'app-v2-lesson-four',
  imports: [DecimalPipe],
  templateUrl: './lesson-four.html',
  styleUrl: './lesson-four.scss',
})
export class V2LessonFour {
  @Output() backToLessonThree = new EventEmitter<void>();
  @Output() continueToLessonFive = new EventEmitter<void>();
  protected readonly titles = titles;
  protected readonly guides = guides;
  protected readonly vocabulary = vocabulary;
  protected readonly model = new MiniLanguageModel();
  protected readonly parameters = initialAttentionParameters();
  protected readonly stage = signal(savedStage());
  protected readonly animal = signal<'chat' | 'chien'>('chat');
  protected readonly verb = signal<'mange' | 'regarde'>('mange');
  protected readonly position = signal(2);
  protected readonly coordinate = signal(0);
  protected readonly showPositions = signal(true);
  protected readonly candidate = signal('souris');
  protected readonly microStep = signal(0);
  protected readonly microCell = signal(2);
  protected readonly input = computed(() => promptTokens(this.animal(), this.verb()));
  protected readonly trace = computed(() => attentionProbe(this.model.snapshot(), this.input(), this.parameters, this.showPositions()));
  protected readonly last = computed(() => this.input().length - 1);
  protected readonly candidateId = computed(() => vocabulary.indexOf(this.candidate() as typeof vocabulary[number]));
  protected readonly queryProduct = computed(() => this.trace().x[this.last()][this.coordinate()] * this.parameters.query[this.coordinate()][0]);
  protected readonly dotProducts = computed(() => this.trace().queries[this.last()].map((value, d) =>
    value * this.trace().keys[this.position()][d]));
  protected readonly valueContribution = computed(() => this.trace().weights[this.last()][this.position()] *
    this.trace().values[this.position()][this.coordinate()]);
  protected readonly baseline = computed(() => this.model.trace(this.input()));
  protected readonly micro = computed(() => microAttention(this.model.snapshot(), this.input(), this.parameters));

  constructor() {
    try {
      const saved = localStorage.getItem('gradient-lab-v2-mini-model-v2');
      if (saved) this.model.restore(JSON.parse(saved) as MiniSnapshot);
    } catch { /* Unavailable checkpoint: use reproducible seed 23. */ }
  }

  protected move(delta: number): void {
    const next = this.stage() + delta;
    if (next < 0) this.backToLessonThree.emit();
    else {
      this.stage.set(Math.min(titles.length, next));
      try { localStorage.setItem('gradient-lab-v2-lesson4-stage-v2', String(this.stage())); } catch { /* private mode */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected probability(trace: AttentionTrace): number {
    return trace.probabilities[this.candidateId()] * 100;
  }

  protected chooseAnimal(): void { this.animal.set(this.animal() === 'chat' ? 'chien' : 'chat'); }
  protected chooseVerb(): void { this.verb.set(this.verb() === 'mange' ? 'regarde' : 'mange'); }
}
