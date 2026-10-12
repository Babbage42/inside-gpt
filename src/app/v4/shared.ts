import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input, signal } from '@angular/core';
import { Family } from './engine/word-map';

export const FAMILY_COLOR: Record<Family, string> = {
  animal: '#ffb454',
  personne: '#ff7eb6',
  véhicule: '#5ad1e6',
  verbe: '#b39dff',
  outil: '#8b95b5',
};

export function pct(value: number): string {
  const p = value * 100;
  if (p > 0 && p < 0.1) return '< 0,1 %';
  return p.toLocaleString('fr-FR', { maximumFractionDigits: p < 10 ? 1 : 0 }) + ' %';
}

export function num(value: number, digits = 2): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function big(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

/** Chaque chapitre dévoile ses moments un par un. */
export abstract class Chapter {
  readonly step = signal(0);

  reveal(step: number, anchor: string): void {
    if (step > this.step()) this.step.set(step);
    setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
}

/** Boucle d'animation : appelle tick à chaque image tant qu'il renvoie true. */
export class FrameLoop {
  readonly running = signal(false);
  private handle = 0;

  start(tick: () => boolean): void {
    if (this.running()) return;
    this.running.set(true);
    const frame = () => {
      if (!this.running()) return;
      if (tick()) this.handle = requestAnimationFrame(frame);
      else this.running.set(false);
    };
    this.handle = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.handle);
    this.running.set(false);
  }
}

export interface BarRow {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
  readonly hit?: boolean;
  readonly note?: string;
}

@Component({
  selector: 'v4-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bars">
      @for (row of rows(); track row.label) {
        <div class="bar-row" [class.hit]="row.hit">
          <span class="bar-label">{{ row.label }}</span>
          <span class="bar-track"><span class="bar-fill" [style.width.%]="(row.value / scale()) * 100" [style.background]="row.color ?? null"></span></span>
          <span class="bar-value">{{ row.note ?? pct(row.value) }}</span>
        </div>
      }
    </div>
  `,
})
export class Bars {
  readonly rows = input.required<readonly BarRow[]>();
  readonly scale = input(1);
  readonly pct = pct;
}

/** Section facultative « pour aller plus loin ». Son contenu n'est construit qu'à l'ouverture. */
@Component({
  selector: 'v4-capot',
  imports: [NgTemplateOutlet],
  template: `
    <section class="capot" [class.open]="open()">
      <button type="button" class="capot-toggle" [attr.aria-expanded]="open()" (click)="open.set(!open())">
        <span class="capot-icon" aria-hidden="true">⚙</span>
        <span class="capot-title"><small>{{ open() ? 'Capot ouvert' : 'Ouvrir le capot' }} · pour aller plus loin</small><strong>{{ label() }}</strong></span>
        <span class="capot-chev" aria-hidden="true">{{ open() ? '−' : '+' }}</span>
      </button>
      @if (open()) { <div class="capot-body"><ng-container [ngTemplateOutlet]="body()" /></div> }
    </section>
  `,
})
export class Capot {
  readonly label = input.required<string>();
  readonly body = contentChild.required(TemplateRef);
  readonly open = signal(false);
}

/** Un vecteur montré comme une bande de cases : orange si positif, bleu si négatif, vif si grand. */
@Component({
  selector: 'v4-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="strip">@for (v of values(); track $index) { <i [style.background]="tone(v)" [title]="v.toFixed(2)"></i> }</span>`,
})
export class Strip {
  readonly values = input.required<readonly number[]>();
  readonly scale = input(2);

  tone(value: number): string {
    const strength = Math.min(1, Math.abs(value) / this.scale());
    return value >= 0 ? `rgba(255, 180, 84, ${strength})` : `rgba(90, 209, 230, ${strength})`;
  }
}
