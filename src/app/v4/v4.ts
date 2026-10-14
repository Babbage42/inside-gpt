import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation, computed, effect, signal, viewChild } from '@angular/core';
import { ChGame } from './chapters/ch1-game';
import { ChCount } from './chapters/ch2-count';
import { ChMap } from './chapters/ch3-map';
import { ChDescent } from './chapters/ch4-descent';
import { ChNeuron } from './chapters/ch5-neuron';
import { ChAttention } from './chapters/ch6-attention';
import { ChScale } from './chapters/ch7-scale';
import { ChInside } from './chapters/ch8-inside';
import { ChBuild } from './chapters/ch9-build';
import { ChMachine } from './chapters/ch10-machine';
import { CHAPTERS } from './chapters';
import { Faq } from './faq/faq';
import { ENTRIES } from './faq/faq-data';

const STORAGE_KEY = 'inside-gpt';

@Component({
  selector: 'app-root',
  imports: [ChGame, ChCount, ChMap, ChDescent, ChNeuron, ChAttention, ChScale, ChInside, ChBuild, ChMachine, Faq],
  templateUrl: './v4.html',
  styleUrls: ['./v4.scss', './v4-deep.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class V4Root implements AfterViewInit, OnDestroy {
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');
  private watcher?: ResizeObserver;
  private width = 0;
  readonly chapters = CHAPTERS;
  readonly chapter = signal(this.restore());
  readonly next = computed(() => CHAPTERS[this.chapter() + 1]);
  /** La page affichée : le cours, ou les questions fréquentes (éventuellement celles d'un seul chapitre). */
  readonly asking = signal(globalThis.location?.hash.startsWith('#faq') ?? false);
  readonly askedAbout = signal<number | null>(null);
  readonly questionsHere = computed(() => ENTRIES.filter((entry) => entry.chapter === this.chapter()).length);
  /**
   * Les chapitres ouverts pendant la visite restent en vie, cachés : en revenant, on retrouve ses étapes et ses expériences.
   * Sauf le dernier, dont la fresque se redessine sans arrêt : il ne vit que lorsqu'on le regarde.
   */
  private readonly visited = signal(new Set([this.chapter()]));
  readonly alive = computed(() => [...this.visited()].filter((index) => index !== CHAPTERS.length - 1 || (index === this.chapter() && !this.asking())).sort((a, b) => a - b));

  constructor() {
    // Un lien vers une question précise ouvre les questions fréquentes, même depuis un chapitre.
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#faq')) this.asking.set(true);
    });
    document.body.classList.add('v4-body');
    document.title = 'Inside GPT · Comprendre les LLM, d’une multiplication à GPT';
    // Quand on change de chapitre, le nom affiché change de largeur : on réajuste la barre.
    effect(() => {
      this.chapter();
      this.asking();
      setTimeout(() => this.fit());
    });
  }

  ngAfterViewInit(): void {
    this.fit();
    // Réajuster change la hauteur de la barre : on ne réagit qu'à la largeur, et hors du passage de l'observateur.
    this.watcher = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === this.width) return;
      this.width = entry.contentRect.width;
      requestAnimationFrame(() => this.fit());
    });
    this.watcher.observe(this.bar().nativeElement);
    document.fonts?.ready.then(() => this.fit());
  }

  ngOnDestroy(): void {
    this.watcher?.disconnect();
  }

  /**
   * Donne à la barre la présentation la plus généreuse qui tienne dans la largeur disponible :
   * normale, resserrée, puis réduite aux numéros. On mesure la place réellement occupée par les chapitres,
   * plutôt que de parier sur une largeur d'écran.
   */
  private fit(): void {
    const bar = this.bar().nativeElement, nav = bar.querySelector('nav')!, items = nav.children;
    const needed = () => items[items.length - 1].getBoundingClientRect().right - items[0].getBoundingClientRect().left;
    for (const classes of [[], ['compact'], ['compact', 'numbers']]) {
      bar.classList.remove('compact', 'numbers');
      bar.classList.add(...classes);
      if (needed() <= nav.clientWidth + 0.5) break;
    }
    // Sur un écran étroit, la liste défile : on garde le chapitre courant en vue.
    if (bar.classList.contains('numbers')) nav.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /** Ouvre les questions fréquentes ; about limite la liste à celles d'un chapitre. */
  ask(about: number | null = null): void {
    this.askedAbout.set(about);
    this.asking.set(true);
    history.replaceState(null, '', '#faq');
    window.scrollTo({ top: 0 });
  }

  go(index: number): void {
    this.asking.set(false);
    history.replaceState(null, '', location.pathname + location.search);
    this.chapter.set(Math.max(0, Math.min(CHAPTERS.length - 1, index)));
    this.visited.update((visited) => new Set(visited).add(this.chapter()));
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
