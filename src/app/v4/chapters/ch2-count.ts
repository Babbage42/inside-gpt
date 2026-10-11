import { Component, OnDestroy, computed, signal } from '@angular/core';
import { BarRow, Bars, Chapter, FAMILY_COLOR, pct } from '../shared';
import { Rng } from '../engine/tensor';
import { SENTENCES, WORDS, countProbs, familyOf, wordId } from '../engine/word-map';

const TOKENS_IN_VOCABULARY = 50_000;

interface Written {
  readonly words: readonly string[];
  readonly known: boolean;
}

@Component({
  selector: 'v4-ch-count',
  imports: [Bars],
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 2 · Première machine</p>
      <h1>La machine la plus simple : <em>compter</em></h1>
      <p class="lede">Pour deviner le mot suivant, l’idée la plus naïve fonctionne déjà un peu. Elle va surtout nous montrer où se trouve la vraie difficulté.</p>
    </header>

    <section class="moment">
      <div class="prose">
        <h2>Lire, puis compter</h2>
        <p>Voici tout ce que notre machine lira : {{ sentences.length }} petites phrases. Des animaux, des personnes, des véhicules, et ce qu’ils font.</p>
        <p>Pour chaque mot, elle note <strong>quel mot le suit, et combien de fois</strong>. C’est tout.</p>
        <p class="do">Choisis un mot : les barres montrent ce qu’elle a compté après lui.</p>
        <div class="chips">
          @for (word of pickable; track word) {
            <button type="button" [class.on]="word === selected()" [style.--tone]="color(word)" (click)="selected.set(word)">{{ word }}</button>
          }
        </div>
        @if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'count-write')">Continuer</button> }
      </div>
      <div class="stage">
        <p class="tiny">Après « {{ selected() }} », la machine a vu…</p>
        <v4-bars [rows]="bars()" [scale]="barScale()" />
        <div class="corpus">
          @for (s of sentences; track $index) { <span [class.lit]="s.includes(selected())">{{ s.join(' ') }}</span> }
        </div>
      </div>
    </section>

    @if (step() >= 1) {
      <section class="moment" id="count-write">
        <div class="prose">
          <h2>Deviner, tirer, recommencer</h2>
          <p>Une machine qui devine le mot suivant sait aussi <strong>écrire</strong>. Elle tire un mot au hasard selon ses probabilités, l’ajoute, puis recommence à partir de ce nouveau mot.</p>
          <p>Retiens cette boucle : c’est exactement celle qui fait écrire un LLM, mot après mot.</p>
          <button type="button" class="primary" [disabled]="writing()" (click)="write()">Écrire une phrase</button>
          @if (written().length >= 3 && step() === 1) {
            <p class="note">Regarde bien : toutes ses phrases existent déjà dans le corpus. Elle ne peut que <strong>répéter</strong>.</p>
            <button type="button" class="primary" (click)="reveal(2, 'count-wall')">Pourquoi est-ce un problème ?</button>
          }
        </div>
        <div class="stage">
          <p class="tiny">La phrase en cours</p>
          <p class="typing">@for (word of current(); track $index) { <span>{{ word }}</span> } @if (writing()) { <span class="caret"></span> }</p>
          @if (roulette().length) {
            <p class="tiny">Tirage parmi les suites comptées</p>
            <v4-bars [rows]="roulette()" [scale]="1" />
          }
          <ul class="written">
            @for (item of written(); track $index) {
              <li><span>{{ item.words.join(' ') }}</span><small>{{ item.known ? 'déjà dans le corpus' : 'phrase nouvelle' }}</small></li>
            }
          </ul>
        </div>
      </section>
    }

    @if (step() >= 2) {
      <section class="moment" id="count-wall">
        <div class="prose">
          <h2>Premier mur : l’inattendu vaut l’absurde</h2>
          <p>« Le lion chasse » ne figure pas dans nos {{ sentences.length }} phrases. Pour la machine qui compte, c’est donc <strong>impossible</strong> : 0 %.</p>
          <p>« Le lion lit » ? 0 % aussi. Elle ne fait aucune différence entre une phrase qu’elle n’a pas encore croisée et une phrase absurde.</p>
          <p>Toi, tu fais la différence, parce que tu sais qu’un lion <em>ressemble</em> à un renard. La machine qui compte ne sait pas ce qui se ressemble.</p>
          @if (step() === 2) { <button type="button" class="primary" (click)="reveal(3, 'count-explosion')">Et si on lui donnait plus de texte ?</button> }
        </div>
        <div class="stage">
          <p class="tiny">Après « lion », selon le comptage</p>
          <v4-bars [rows]="lionBars" [scale]="0.4" />
        </div>
      </section>
    }

    @if (step() >= 3) {
      <section class="moment" id="count-explosion">
        <div class="prose">
          <h2>Second mur : on ne peut pas tout avoir vu</h2>
          <p>Pour mieux deviner, il faut regarder plus d’un mot en arrière. Mais le nombre de situations à compter explose.</p>
          <p>Un vrai modèle manipule environ 50 000 morceaux de mots différents. Déplace le curseur pour choisir combien de mots de contexte on regarde.</p>
          <label class="slider">Contexte : <strong>{{ context() }} mot{{ context() > 1 ? 's' : '' }}</strong>
            <input type="range" min="1" max="20" [value]="context()" (input)="context.set(+$any($event.target).value)" />
          </label>
          <p class="note">Avec seulement 20 mots de contexte, il y a plus de situations possibles que d’atomes dans l’univers. Aucun texte ne les contiendra jamais toutes.</p>
        </div>
        <div class="stage">
          <p class="tiny">Nombre de contextes possibles</p>
          <p class="huge">10<sup>{{ exponent() }}</sup></p>
          <div class="logbar">
            <span class="logfill" [style.width.%]="exponent()"></span>
            @for (mark of marks; track mark.label) {
              <span class="logmark" [style.left.%]="mark.at" [class.passed]="exponent() >= mark.at"><i></i>{{ mark.label }}</span>
            }
          </div>
        </div>
      </section>
      <section class="moment solo">
        <div class="takeaway">
          <p class="tiny">À retenir</p>
          <p>Compter ne suffira jamais : presque tout ce qu’on demandera à la machine sera <strong>inédit</strong>. Il lui faut un moyen de bien deviner dans des situations qu’elle n’a jamais vues. Autrement dit, il lui faut une notion de <strong>ressemblance</strong>.</p>
        </div>
      </section>
    }
  `,
})
export class ChCount extends Chapter implements OnDestroy {
  readonly sentences = SENTENCES;
  readonly pickable = ['chat', 'lion', 'renard', 'Marie', 'Nina', 'train', 'le', '.'];
  readonly selected = signal('chat');
  readonly bars = computed<BarRow[]>(() => this.rowsFor(this.selected()));
  readonly barScale = computed(() => Math.max(...this.bars().map((b) => b.value)));

  readonly current = signal<readonly string[]>([]);
  readonly roulette = signal<readonly BarRow[]>([]);
  readonly written = signal<readonly Written[]>([]);
  readonly writing = signal(false);
  private readonly rng = new Rng(21);
  private timer = 0;

  readonly lionBars: BarRow[] = [
    ...this.rowsFor('lion'),
    { label: 'chasse', value: 0, note: '0 % · jamais vu', hit: true },
    { label: 'lit', value: 0, note: '0 % · jamais vu', hit: true },
  ];

  readonly context = signal(1);
  readonly exponent = computed(() => Math.round(this.context() * Math.log10(TOKENS_IN_VOCABULARY)));
  readonly marks = [
    { at: 13, label: 'tout le texte lu par un grand modèle' },
    { at: 19, label: 'grains de sable sur Terre' },
    { at: 80, label: 'atomes dans l’univers observable' },
  ];

  color(word: string): string {
    return FAMILY_COLOR[familyOf(word)];
  }

  private rowsFor(word: string, chosen?: string): BarRow[] {
    return countProbs(wordId(word))
      .map((value, id) => ({ label: WORDS[id], value, color: this.color(WORDS[id]), hit: WORDS[id] === chosen, note: undefined as string | undefined }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((row) => ({ ...row, note: row.hit ? pct(row.value) + ' · tiré' : undefined }));
  }

  write(): void {
    this.writing.set(true);
    this.current.set([]);
    let previous = '.';
    const tick = () => {
      const probs = countProbs(wordId(previous));
      let draw = this.rng.next(), next = 0;
      while (draw > probs[next]) draw -= probs[next++];
      const word = WORDS[next];
      this.roulette.set(this.rowsFor(previous, word).slice(0, 8));
      this.current.update((words) => [...words, word]);
      previous = word;
      if (word !== '.') {
        this.timer = window.setTimeout(tick, 650);
        return;
      }
      const words = this.current();
      const known = SENTENCES.some((s) => s.join(' ') === words.join(' '));
      this.written.update((list) => [{ words, known }, ...list].slice(0, 4));
      this.writing.set(false);
    };
    tick();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
