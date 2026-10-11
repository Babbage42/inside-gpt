import { Component, computed, signal } from '@angular/core';
import { Chapter } from '../shared';

interface Round {
  readonly text: string;
  readonly options: readonly string[];
  readonly answer: string;
  readonly skill: string;
  readonly why: string;
}

const ROUNDS: readonly Round[] = [
  {
    text: 'Les enfants de ma voisine',
    options: ['joue', 'jouent', 'jouer', 'jouons'],
    answer: 'jouent',
    skill: 'de la grammaire',
    why: 'Il fallait accorder le verbe avec « les enfants », quatre mots plus tôt, sans se laisser piéger par « voisine ».',
  },
  {
    text: 'La capitale de l’Italie est',
    options: ['Milan', 'Paris', 'Rome', 'pizza'],
    answer: 'Rome',
    skill: 'des connaissances sur le monde',
    why: 'Aucune règle de français ne donne ce mot. Il fallait connaître un fait.',
  },
  {
    text: 'Le panier contient 17 pommes. J’en ajoute 25. Il y en a maintenant',
    options: ['32', '1725', '43', '42'],
    answer: '42',
    skill: 'du calcul',
    why: 'Pour deviner ce mot-là, il n’y a pas d’autre moyen que de faire l’addition.',
  },
  {
    text: 'Léa est plus grande que Paul. Paul est plus grand que Hugo. Le plus petit des trois est',
    options: ['Léa', 'Paul', 'Hugo', 'grand'],
    answer: 'Hugo',
    skill: 'de la logique',
    why: 'La réponse n’est écrite nulle part. Il fallait enchaîner deux informations.',
  },
  {
    text: 'Tom range le chocolat dans le tiroir et sort. Zoé le déplace dans le placard. À son retour, Tom le cherche dans le',
    options: ['placard', 'tiroir', 'jardin', 'frigo'],
    answer: 'tiroir',
    skill: 'de se mettre à la place de quelqu’un',
    why: 'Le chocolat est dans le placard, mais Tom l’ignore. Il fallait raisonner sur ce que Tom croit.',
  },
];

@Component({
  selector: 'v4-ch-game',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 1 · Le pari</p>
      <h1>Un seul jeu : <em>deviner la suite</em></h1>
      <p class="lede">ChatGPT, Claude, Gemini : tous ces systèmes reposent sur un jeu d’enfant. Avant de regarder la machine, joue-le toi-même.</p>
    </header>

    <section class="moment play">
      <div class="stage game">
        <div class="game-progress">
          @for (r of rounds; track $index) { <span [class.done]="$index < index()" [class.now]="$index === index()"></span> }
        </div>
        <p class="tiny">Quel mot vient ensuite ?</p>
        <p class="prompt">{{ round().text }} <span class="blank" [class.filled]="picked()">{{ picked() ? round().answer : '?' }}</span></p>
        <div class="options">
          @for (option of round().options; track option) {
            <button type="button" [disabled]="!!picked()" [class.right]="picked() && option === round().answer" [class.wrong]="picked() === option && option !== round().answer" (click)="pick(option)">{{ option }}</button>
          }
        </div>
        @if (picked()) {
          <div class="reveal">
            <p><strong>{{ picked() === round().answer ? 'Oui.' : 'C’était « ' + round().answer + ' ».' }}</strong> {{ round().why }}</p>
            @if (index() < rounds.length - 1) { <button type="button" class="primary" (click)="next()">Phrase suivante →</button> }
            @else if (step() === 0) { <button type="button" class="primary" (click)="reveal(1, 'game-insight')">Qu’est-ce que ça prouve ?</button> }
          </div>
        }
      </div>
      <aside class="skills">
        <p class="tiny">Pour bien deviner, il t’a fallu…</p>
        <ul>
          @for (r of rounds; track $index) {
            <li [class.on]="$index < unlocked()">{{ $index < unlocked() ? r.skill : '…' }}</li>
          }
        </ul>
      </aside>
    </section>

    @if (step() >= 1) {
      <section class="moment solo" id="game-insight">
        <div class="insight">
          <p class="tiny">Ce que tu viens de vivre</p>
          <h2>Tu n’as joué qu’à un seul jeu.</h2>
          <p>Et pourtant, pour y gagner, il t’a fallu de la grammaire, des connaissances, du calcul, de la logique et de l’empathie.</p>
          <p>C’est exactement le pari des LLM. On entraîne une machine à une seule chose, <strong>deviner le mot suivant</strong>, sur une quantité immense de textes. Pour progresser à ce jeu, elle n’a pas le choix : elle doit construire en elle de quoi faire tout le reste.</p>
          <p class="aside">Une précision, qui comptera : la machine ne répond pas un mot. Elle donne une <strong>probabilité à chaque mot possible</strong>. Par exemple : « Rome, très probable ; Milan, peu ; pizza, presque pas ». Deviner, pour elle, c’est répartir des chances.</p>
        </div>
        <div class="takeaway">
          <p>Reste la vraie question : comment une machine peut-elle jouer à ce jeu, et y devenir bonne ? Construisons-en une, la plus simple possible.</p>
        </div>
      </section>
    }
  `,
})
export class ChGame extends Chapter {
  readonly rounds = ROUNDS;
  readonly index = signal(0);
  readonly picks = signal<readonly string[]>([]);
  readonly round = computed(() => ROUNDS[this.index()]);
  readonly picked = computed(() => this.picks()[this.index()]);
  readonly unlocked = computed(() => this.picks().length);

  pick(option: string): void {
    this.picks.update((p) => [...p, option]);
  }

  next(): void {
    this.index.update((i) => i + 1);
  }
}
