import { Component, effect, input, output, signal } from '@angular/core';
import { AnswerRecord, parseAnswer } from './pilot-state';

export interface Checkpoint {
  readonly id: string;
  readonly question: string;
  readonly context?: string;
  readonly options?: readonly { value: string; label: string }[];
  readonly expected: string | number;
  readonly tolerance?: number;
  readonly hint: string;
  readonly correct: string;
  readonly incorrect: string;
  readonly placeholder?: string;
}

@Component({
  selector: 'app-v3-checkpoint',
  template: `
    <section class="checkpoint" [attr.aria-label]="question().question">
      <small>À TOI · ANTICIPE, PUIS VÉRIFIE</small>
      <h3>{{ question().question }}</h3>
      @if (question().context; as context) { <p>{{ context }}</p> }
      @if (question().options; as options) {
        <div class="options" role="group" aria-label="Ta prévision">
          @for (option of options; track option.value) {
            <button type="button" [class.selected]="value() === option.value" [attr.aria-pressed]="value() === option.value" (click)="value.set(option.value)">{{ option.label }}</button>
          }
        </div>
      } @else {
        <label>Ton résultat <input type="text" inputmode="decimal" [value]="value()" (input)="value.set($any($event.target).value)" [placeholder]="question().placeholder ?? 'Virgule ou point acceptés'" /></label>
      }
      <label>Pourquoi ? Une phrase suffit.
        <textarea rows="2" [value]="explanation()" (input)="explanation.set($any($event.target).value)" placeholder="Décris l’opération ou le chemin qui justifie ta réponse."></textarea>
      </label>
      <div class="actions"><button type="button" class="primary" (click)="submit()" [disabled]="!value().trim() || explanation().trim().length < 8">Vérifier ma prévision</button><button type="button" (click)="askHint()">Un indice</button></div>
      @if (record()?.hint) { <p class="hint">Indice : {{ question().hint }}</p> }
      @if (record()?.result; as result) {
        <div class="feedback" role="status" [class.correct]="result === 'correct'">
          <strong>{{ result === 'correct' ? 'Résultat correct.' : 'À reprendre : le résultat ne correspond pas au calcul.' }}</strong>
          <p>{{ result === 'correct' ? question().correct : question().incorrect }}</p>
          <p class="qualification">Le résultat est vérifié automatiquement. Compare toi-même ta justification au raisonnement ci-dessus ; son sens n’est pas évalué automatiquement.</p>
        </div>
      }
    </section>`,
  styles: `
    :host { display:block; } .checkpoint{border:1px solid #cbdcd1;background:#f3f8f1;border-radius:16px;padding:24px;color:#21382e}
    small{font-size:10px;letter-spacing:.12em;font-weight:750;color:#557b63} h3{font-size:19px;line-height:1.4;margin:8px 0 14px} p{line-height:1.6;font-size:14px} label{display:grid;gap:7px;font-size:13px;margin:15px 0}
    input,textarea{font:inherit;padding:12px;border:1px solid #becfc1;border-radius:8px;background:white;color:#21382e;box-sizing:border-box;width:100%} textarea{resize:vertical}
    button{font:inherit;cursor:pointer;padding:10px 15px;border-radius:8px;border:1px solid #afc5b5;background:white;color:#21382e;font-size:13px} button.selected{background:#dcebdc;border-color:#385c45;box-shadow:inset 0 0 0 1px #385c45}
    .options,.actions{display:flex;gap:8px;flex-wrap:wrap} .primary{background:#244d38;color:white;border-color:#244d38} button:disabled{opacity:.5;cursor:not-allowed} .hint{background:#fff5da;padding:12px;border-radius:8px}
    .feedback{border-left:3px solid #bd763a;padding:4px 0 4px 16px;margin-top:18px} .feedback.correct{border-color:#427553} .qualification{font-size:12px;color:#667769} :focus-visible{outline:3px solid #c28938;outline-offset:3px}
    @media(max-width:600px){.checkpoint{padding:17px}}
  `,
})
export class V3Checkpoint {
  readonly question = input.required<Checkpoint>();
  readonly record = input<AnswerRecord>();
  readonly answer = output<AnswerRecord>();
  readonly value = signal('');
  readonly explanation = signal('');
  constructor() {
    effect(() => {
      this.question();
      const record = this.record();
      this.value.set(record?.value ?? '');
      this.explanation.set(record?.explanation ?? '');
    });
  }
  askHint(): void {
    const previous = this.record();
    this.answer.emit({ value: this.value(), explanation: this.explanation(), attempts: previous?.attempts ?? 0,
      hint: true, result: previous?.result, assisted: true });
  }
  submit(): void {
    if (!this.value().trim() || this.explanation().trim().length < 8) return;
    const q = this.question();
    const correct = typeof q.expected === 'number'
      ? Number.isFinite(parseAnswer(this.value())) && Math.abs(parseAnswer(this.value()) - q.expected) <= (q.tolerance ?? 0.00001)
      : this.value() === q.expected;
    const previous = this.record();
    this.answer.emit({ value: this.value(), explanation: this.explanation(), attempts: (previous?.attempts ?? 0) + 1,
      hint: previous?.hint ?? false, assisted: previous?.assisted === true || previous?.result === 'incorrect',
      result: correct ? 'correct' : 'incorrect' });
  }
}
