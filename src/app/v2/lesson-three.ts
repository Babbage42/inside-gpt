import { DecimalPipe } from '@angular/common';
import { Component, computed, EventEmitter, Output, signal } from '@angular/core';
import { MiniLanguageModel, MiniSnapshot, promptTokens } from './mini-model';
import { probeOrder } from './order-probe';
import { vocabulary } from './world';

const titles = [
  'Pourquoi l’ordre doit-il compter ?',
  'Qu’est-ce qu’une position, avant tout calcul ?',
  'Ajouter une position suffit-il ?',
  'Comment garder le lien entre un mot et sa place ?',
  'Pourquoi le modèle doit-il choisir où regarder ?',
] as const;

const guides = [
  { question: 'Deux entrées ont les mêmes mots, mais pas le même ordre.', action: 'Clique A puis B en haut.', observe: 'Le résultat de la moyenne reste identique.' },
  { question: 'Comment désigner une place sans parler de vecteurs ?', action: 'Clique une case du ruban ci-dessous, puis échange A et B.', observe: 'La place garde son numéro ; le mot qu’elle contient change.' },
  { question: 'Une étiquette numérique de place répare-t-elle la moyenne ?', action: 'Change la place et la valeur ajoutée, puis compare A et B.', observe: 'Les deux résultats bougent ensemble et restent identiques.' },
  { question: 'Et si la place agissait sur le mot avant la somme ?', action: 'Accentue une place, puis compare A et B.', observe: 'Cette fois, le mot déplacé ne reçoit plus le même coefficient.' },
  { question: 'Qui décide quelle place compte pour cette phrase ?', action: 'Compare le réglage fixe avec le besoin d’une lecture variable.', observe: 'Notre coefficient manuel ne peut pas s’adapter au texte.' },
] as const;

function savedStage(): number {
  try {
    const value = Number(localStorage.getItem('gradient-lab-v2-lesson3-stage-v2'));
    return Number.isInteger(value) && value >= 0 && value <= titles.length ? value : 0;
  } catch { return 0; }
}

@Component({
  selector: 'app-v2-lesson-three',
  imports: [DecimalPipe],
  templateUrl: './lesson-three.html',
  styleUrl: './lesson-three.scss',
})
export class V2LessonThree {
  @Output() backToLessonTwo = new EventEmitter<void>();
  @Output() continueToLessonFour = new EventEmitter<void>();
  protected readonly titles = titles;
  protected readonly guides = guides;
  protected readonly vocabulary = vocabulary;
  protected readonly model = new MiniLanguageModel();
  protected readonly stage = signal(savedStage());
  protected readonly focus = signal(2);
  protected readonly coordinate = signal(0);
  protected readonly strength = signal(1);
  protected readonly candidate = signal('souris');
  protected readonly source = signal<'normal' | 'swapped'>('normal');
  protected readonly prompt = promptTokens('chat', 'mange');
  protected readonly swapped = [...this.prompt];
  protected readonly currentInput = computed(() => this.source() === 'normal' ? this.prompt : this.swapped);
  protected readonly base = computed(() => probeOrder(this.model.snapshot(), this.currentInput(), 'mean', this.focus()));
  protected readonly additive = computed(() => probeOrder(this.model.snapshot(), this.currentInput(), 'add-position', this.focus(), this.strength()));
  protected readonly weighted = computed(() => probeOrder(this.model.snapshot(), this.currentInput(), 'weighted', this.focus(), this.strength()));
  protected readonly baseNormal = computed(() => probeOrder(this.model.snapshot(), this.prompt, 'mean', this.focus()));
  protected readonly baseSwapped = computed(() => probeOrder(this.model.snapshot(), this.swapped, 'mean', this.focus()));
  protected readonly addNormal = computed(() => probeOrder(this.model.snapshot(), this.prompt, 'add-position', this.focus(), this.strength()));
  protected readonly addSwapped = computed(() => probeOrder(this.model.snapshot(), this.swapped, 'add-position', this.focus(), this.strength()));
  protected readonly weightedNormal = computed(() => probeOrder(this.model.snapshot(), this.prompt, 'weighted', this.focus(), this.strength()));
  protected readonly weightedSwapped = computed(() => probeOrder(this.model.snapshot(), this.swapped, 'weighted', this.focus(), this.strength()));
  protected readonly candidateId = computed(() => vocabulary.indexOf(this.candidate() as typeof vocabulary[number]));
  protected readonly divisor = computed(() => this.prompt.length + this.strength());
  protected readonly weightedNumerator = computed(() => this.currentInput().reduce((sum, _, i) =>
    sum + this.model.embedding(this.currentInput()[i])[this.coordinate()] *
      (i === this.focus() ? 1 + this.strength() : 1), 0));

  constructor() {
    [this.swapped[2], this.swapped[3]] = [this.swapped[3], this.swapped[2]];
    try {
      const saved = localStorage.getItem('gradient-lab-v2-mini-model-v2');
      if (saved) this.model.restore(JSON.parse(saved) as MiniSnapshot);
    } catch { /* Invalid or unavailable checkpoint: start with seed 23. */ }
  }

  protected move(delta: number): void {
    const next = this.stage() + delta;
    if (next < 0) this.backToLessonTwo.emit();
    else {
      this.stage.set(Math.min(titles.length, next));
      try { localStorage.setItem('gradient-lab-v2-lesson3-stage-v2', String(this.stage())); } catch { /* private mode */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected probability(trace: { probabilities: readonly number[] }): number {
    return trace.probabilities[this.candidateId()] * 100;
  }
}
