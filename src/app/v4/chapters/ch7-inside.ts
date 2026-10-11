import { Component, output } from '@angular/core';
import { Chapter } from '../shared';

@Component({
  selector: 'v4-ch-inside',
  template: `
    <header class="hero">
      <p class="kicker">Chapitre 7 · L’intérieur</p>
      <h1>Ce qu’on découvre <em>en ouvrant les grands modèles</em></h1>
      <p class="lede">Dans ton mini-modèle, une méthode est née sans que personne ne l’écrive. Voici ce que des chercheurs ont trouvé, par la même démarche, dans des modèles bien plus grands.</p>
    </header>

    <section class="moment solo">
      <div class="findings">
        <article>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            @for (i of eight; track i) { <line [attr.x1]="12 + i * 12" y1="12" [attr.x2]="12 + i * 12" y2="108" /><line x1="12" [attr.y1]="12 + i * 12" x2="108" [attr.y2]="12 + i * 12" /> }
            <line x1="108" y1="12" x2="108" y2="108" /><line x1="12" y1="108" x2="108" y2="108" />
            <circle cx="54" cy="54" r="4.5" class="a" /><circle cx="66" cy="66" r="4.5" class="a" /><circle cx="66" cy="54" r="4.5" class="b" /><circle cx="54" cy="66" r="4.5" class="b" /><circle cx="78" cy="54" r="4.5" class="b" />
          </svg>
          <p class="tiny">Un plateau que personne ne lui a montré</p>
          <h3>Othello-GPT</h3>
          <p>Un transformer entraîné uniquement sur des listes de coups, sans jamais voir de plateau ni connaître les règles. En l’ouvrant, on y trouve une <strong>représentation du plateau</strong>. Si on la modifie à la main, ses coups changent en conséquence.</p>
          <a href="https://arxiv.org/abs/2210.13382" target="_blank" rel="noopener">Li et al., 2023 ↗</a>
        </article>
        <article>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="42" class="ring" />
            @for (i of twelve; track i) { <circle [attr.cx]="60 + 42 * cos(i)" [attr.cy]="60 + 42 * sin(i)" r="3.2" class="a" /> }
            <line x1="60" y1="60" [attr.x2]="60 + 34 * cos(2)" [attr.y2]="60 + 34 * sin(2)" class="hand" /><line x1="60" y1="60" [attr.x2]="60 + 26 * cos(7)" [attr.y2]="60 + 26 * sin(7)" class="hand" />
          </svg>
          <p class="tiny">Une horloge pour additionner</p>
          <h3>L’addition en cercle</h3>
          <p>Un petit réseau entraîné à additionner « comme sur une horloge ». Il finit par <strong>placer les nombres sur des cercles</strong> et additionner en les faisant tourner. Une méthode de trigonométrie, redécouverte seule.</p>
          <a href="https://arxiv.org/abs/2301.05217" target="_blank" rel="noopener">Nanda et al., 2023 ↗</a>
        </article>
        <article>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <rect x="8" y="50" width="22" height="20" rx="5" class="box a" /><rect x="34" y="50" width="22" height="20" rx="5" class="box b" /><rect x="86" y="50" width="22" height="20" rx="5" class="box a" />
            <text x="19" y="64">A</text><text x="45" y="64">B</text><text x="71" y="64">…</text><text x="97" y="64">A</text>
            <path d="M97 48 Q71 8 45 48" class="look" /><text x="97" y="96" class="out">→ B</text>
          </svg>
          <p class="tiny">Le cousin de ton modèle</p>
          <h3>Les têtes d’induction</h3>
          <p>« Si A était suivi de B plus haut, alors après A, propose B. » Ce circuit en deux regards, proche de celui que tu as vu naître, se retrouve dans les vrais modèles. Il <strong>apparaît brusquement</strong> pendant l’entraînement et leur permet d’apprendre à partir d’exemples donnés dans la conversation.</p>
          <a href="https://arxiv.org/abs/2209.11895" target="_blank" rel="noopener">Olsson et al., 2022 ↗</a>
        </article>
        <article>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <rect x="6" y="80" width="34" height="20" rx="5" class="box b" /><rect x="43" y="22" width="34" height="20" rx="5" class="box a" /><rect x="80" y="80" width="34" height="20" rx="5" class="box b" />
            <text x="23" y="94">Dallas</text><text x="60" y="36">Texas</text><text x="97" y="94">Austin</text>
            <path d="M23 78 Q30 40 44 36" class="look" /><path d="M76 36 Q90 40 97 78" class="look" />
          </svg>
          <p class="tiny">Une étape qu’il n’écrit pas</p>
          <h3>Le raisonnement en deux sauts</h3>
          <p>« La capitale de l’État où se trouve Dallas ? » Le modèle répond « Austin ». En observant ses calculs, on voit s’activer en interne le concept <strong>« Texas »</strong>, qu’il n’écrit jamais. Il enchaîne deux faits, comme toi au chapitre 1.</p>
          <a href="https://www.anthropic.com/research/tracing-thoughts-language-model" target="_blank" rel="noopener">Anthropic, 2025 ↗</a>
        </article>
      </div>
    </section>

    <section class="moment">
      <div class="prose">
        <h2>Ce qu’on ne sait pas encore</h2>
        <p>On ne comprend aujourd’hui qu’une <strong>petite partie</strong> de ce qui se passe dans un grand modèle. Les exemples ci-contre sont des îlots éclairés dans un territoire encore sombre.</p>
        <p>Ces modèles se trompent, et peuvent affirmer des choses fausses avec aplomb. Deviner une suite plausible n’est pas vérifier qu’elle est vraie.</p>
        <p>Enfin, savoir s’il faut appeler cela « raisonner » ou « comprendre » reste un débat ouvert. Ce qui est établi : ce ne sont <strong>ni de simples tables de fréquences, ni des programmes écrits à la main</strong>.</p>
      </div>
      <div class="stage recap">
        <p class="tiny">Tu peux maintenant le dire avec tes mots</p>
        <p class="sentence">Un LLM joue à <button type="button" (click)="jump.emit(0)">deviner la suite</button>. Comme <button type="button" (click)="jump.emit(1)">compter ne suffit pas</button>, il range les mots sur <button type="button" (click)="jump.emit(2)">une carte</button> qu’il règle en <button type="button" (click)="jump.emit(3)">descendant une pente</button>. Ses mots <button type="button" (click)="jump.emit(4)">se regardent</button> pour aller chercher l’information, couche après couche, <button type="button" (click)="jump.emit(5)">à très grande échelle</button>. Et de ce seul jeu émergent des méthodes que personne n’a écrites.</p>
      </div>
    </section>

    <section class="moment solo">
      <div class="finale">
        <p>Un jeu de devinettes. Une carte. Une pente. Des regards.</p>
        <h2>Rien d’autre. Et pourtant.</h2>
      </div>
    </section>
  `,
})
export class ChInside extends Chapter {
  readonly jump = output<number>();
  readonly eight = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  cos = (i: number) => Math.cos((i / 12) * 2 * Math.PI - Math.PI / 2);
  sin = (i: number) => Math.sin((i / 12) * 2 * Math.PI - Math.PI / 2);
}
