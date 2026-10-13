import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { CHAPTERS } from '../chapters';
import { CATEGORIES, ENTRIES, Entry, search, slug } from './faq-data';

/** Les questions fréquentes : une recherche, des familles de questions, et un renvoi vers le chapitre qui montre la réponse. */
@Component({
  selector: 'v4-faq',
  template: `
    <header class="hero">
      <p class="kicker">Questions fréquentes</p>
      <h1>Tes questions, <em>sans détour</em></h1>
      <p class="lede">Un mot mal défini, une idée reçue, une étape qui résiste : {{ total }} réponses courtes. Chacune renvoie, quand c’est possible, au chapitre où on la voit en action.</p>
    </header>

    <section class="moment solo faq-tools">
      <input type="search" class="faq-search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Cherche un mot : token, mémoire, hallucination, température…" aria-label="Chercher dans les questions" />
      <div class="chips">
        <button type="button" [class.on]="!category()" style="--tone: #ffb454" (click)="category.set(null)">Toutes · {{ count(null) }}</button>
        @for (name of categories; track name) { <button type="button" [class.on]="category() === name" style="--tone: #ffb454" (click)="category.set(name)">{{ name }} · {{ count(name) }}</button> }
        @if (chapter() !== null) { <button type="button" class="on" style="--tone: #5ad1e6" (click)="everyChapter.emit()">Chapitre {{ chapter()! + 1 }} · {{ chapters[chapter()!] }} ✕</button> }
      </div>
    </section>

    @for (group of groups(); track group.name) {
      <section class="moment solo faq-group">
        <h2>{{ group.name }}</h2>
        @for (entry of group.entries; track entry.question) {
          <details class="faq-item" [id]="'faq-' + id(entry)" [open]="id(entry) === target()" (toggle)="remember(entry, $any($event.target).open)">
            <summary>{{ entry.question }}</summary>
            <div class="faq-body">
              @for (paragraph of paragraphs(entry); track $index) { <p [innerHTML]="paragraph"></p> }
              <p class="faq-foot">
                @if (entry.open) { <span class="badge">Question ouverte</span> }
                @if (entry.chapter !== undefined) { <button type="button" class="link" (click)="jump.emit(entry.chapter)">Voir le chapitre {{ entry.chapter + 1 }} · {{ chapters[entry.chapter] }} ↗</button> }
              </p>
            </div>
          </details>
        }
      </section>
    } @empty {
      <section class="moment solo"><div class="takeaway"><p>Aucune question ne correspond. Essaie un autre mot, ou reviens à toutes les questions.</p></div></section>
    }
  `,
})
export class Faq implements OnDestroy {
  /** Quand il est fourni, on ne montre que les questions rattachées à ce chapitre. */
  readonly chapter = input<number | null>(null);
  readonly jump = output<number>();
  readonly everyChapter = output<void>();

  readonly categories = CATEGORIES;
  readonly chapters = CHAPTERS;
  readonly total = ENTRIES.length;
  readonly query = signal('');
  readonly category = signal<string | null>(null);
  /** La question désignée par l'adresse de la page : elle s'ouvre et vient à l'écran. */
  readonly target = signal('');
  private readonly follow = () => {
    const hash = globalThis.location?.hash ?? '';
    if (!hash.startsWith('#faq/')) return;
    this.target.set(hash.slice(5));
    setTimeout(() => document.getElementById('faq-' + this.target())?.scrollIntoView({ block: 'center' }), 120);
  };

  private readonly found = computed(() => search(this.query()).filter((entry) => this.chapter() === null || entry.chapter === this.chapter()));
  readonly groups = computed(() =>
    CATEGORIES.filter((name) => !this.category() || this.category() === name)
      .map((name) => ({ name, entries: this.found().filter((entry) => entry.category === name) }))
      .filter((group) => group.entries.length),
  );

  constructor() {
    this.follow();
    globalThis.addEventListener?.('hashchange', this.follow);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('hashchange', this.follow);
  }

  count(category: string | null): number {
    return this.found().filter((entry) => !category || entry.category === category).length;
  }

  id(entry: Entry): string {
    return slug(entry.question);
  }

  paragraphs(entry: Entry): string[] {
    return entry.answer.split(/\n\s*\n/);
  }

  /** L'adresse de la page suit la dernière question ouverte, pour pouvoir la partager. */
  remember(entry: Entry, open: boolean): void {
    if (open) history.replaceState(null, '', '#faq/' + this.id(entry));
  }
}
