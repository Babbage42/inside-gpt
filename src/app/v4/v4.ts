import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { ChGame } from './chapters/ch1-game';
import { ChCount } from './chapters/ch2-count';
import { ChMap } from './chapters/ch3-map';
import { ChDescent } from './chapters/ch4-descent';
import { ChNeuron } from './chapters/ch5-neuron';
import { ChAttention } from './chapters/ch6-attention';
import { ChScale } from './chapters/ch7-scale';
import { ChInside } from './chapters/ch8-inside';
import { ChMachine } from './chapters/ch9-machine';

const STORAGE_KEY = 'gradient-lab-v4';
const CHAPTERS = ['Le pari', 'Compter', 'La carte', 'La pente', 'Le neurone', 'Le regard', 'L’échelle', 'L’intérieur', 'La machine'];

@Component({
  selector: 'app-root',
  imports: [ChGame, ChCount, ChMap, ChDescent, ChNeuron, ChAttention, ChScale, ChInside, ChMachine],
  templateUrl: './v4.html',
  styleUrls: ['./v4.scss', './v4-deep.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class V4Root {
  readonly chapters = CHAPTERS;
  readonly chapter = signal(this.restore());
  readonly next = computed(() => CHAPTERS[this.chapter() + 1]);

  constructor() {
    document.body.classList.add('v4-body');
    document.title = 'GradientLab — Comprendre les LLM';
  }

  go(index: number): void {
    this.chapter.set(Math.max(0, Math.min(CHAPTERS.length - 1, index)));
    try {
      localStorage.setItem(STORAGE_KEY, String(this.chapter()));
    } catch {
      // Sans stockage, le parcours fonctionne ; seule la reprise est perdue.
    }
    window.scrollTo({ top: 0 });
  }

  private restore(): number {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isInteger(saved) && saved >= 0 && saved < CHAPTERS.length ? saved : 0;
    } catch {
      return 0;
    }
  }
}
