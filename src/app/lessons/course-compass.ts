import { Component, computed, input } from '@angular/core';

/** A persistent statement of purpose, not an extra mandatory lesson screen. */
@Component({
  selector: 'app-course-compass',
  template: `
    <details class="compass">
      <summary>Pourquoi cette leçon ? · {{ current().question }}</summary>
      <div class="grid">
        <section><h2>Point de départ</h2><p>{{ current().before }}</p></section>
        <section><h2>L’expérience à mener</h2><p>{{ current().experiment }}</p></section>
        <section><h2>Ce qu’elle ne démontre pas</h2><p>{{ current().limit }}</p></section>
      </div>
      <p class="method">Méthode de lecture : avant une manipulation, prévoir son effet ; après, identifier ce qui a changé et pourquoi. Pour chaque nombre, demander : donnée, choix de conception, paramètre appris ou résultat calculé ? Une formule doit pouvoir se relire comme une suite d’opérations sur notre exemple.</p>
      <p><b>Le parcours :</b> corriger un réglage → comprendre un neurone → composer des représentations → définir la prédiction de texte → apprendre des embeddings → mélanger le contexte → transformer ce mélange → refaire l’expérience sur d’autres données.</p>
    </details>`,
  styles: [`:host{display:block;margin-bottom:24px;color:#173f35}.compass{border:1px solid #bacbbf;border-radius:12px;padding:16px 20px;background:#edf2e9}summary{cursor:pointer;font-weight:600;line-height:1.6}summary:focus-visible{outline:3px solid #ab741d}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}h2{font-size:15px;margin-top:20px}p{font-size:14px;line-height:1.8}.method{border-top:1px solid #cbd6ce;padding-top:15px}@media(max-width:900px){.grid{grid-template-columns:1fr;gap:0}}`],
})
export class CourseCompass {
  readonly lesson = input.required<number>();
  readonly current = computed(() => this.chapters[this.lesson() - 1] ?? this.chapters[0]);
  private readonly chapters = [
    { question: 'Comment une erreur indique-t-elle une correction ?', before: 'On choisit une fonction réglable, une entrée et une réponse attendue. Le modèle ne connaît pas la bonne valeur de ses paramètres.', experiment: 'Suivre la prédiction jusqu’à son erreur, déplacer un poids, puis comparer avec la direction indiquée par le gradient.', limit: 'Ajuster une seule observation ne prouve pas qu’une règle générale est apprise. Plusieurs couples poids/biais peuvent donner la même réponse.' },
    { question: 'À quoi sert un neurone ?', before: 'La leçon 1 a montré comment corriger des paramètres. Ici, on ouvre une fonction qui combine plusieurs entrées.', experiment: 'Modifier un indice et son poids séparément. Distinguer le score calculé, le biais choisi et la sortie de l’activation.', limit: 'Les réglages de cette démonstration sont manipulés à la main : ils ne sont pas le résultat d’un apprentissage sur un corpus.' },
    { question: 'Pourquoi plusieurs neurones et une activation ?', before: 'Un score pondéré suivi d’un seuil sépare les entrées avec une frontière droite. La règle XOR demande une séparation différente.', experiment: 'Essayer les quatre entrées, constater la limite, puis examiner les deux descriptions intermédiaires fabriquées par un petit réseau.', limit: 'Les poids du réseau proposé sont construits à la main pour prouver qu’une solution existe. Une activation seuil n’est pas celle utilisée pour entraîner nos modèles par gradient.' },
    { question: 'Que signifie prédire le prochain token ?', before: 'On met provisoirement les neurones de côté pour comprendre les données et la forme de la réponse.', experiment: 'Transformer les phrases en couples entrée/cible, compter les transitions, puis comparer choix maximal et tirage pondéré.', limit: 'Ce modèle compte : il ne fait ni rétropropagation ni apprentissage d’embeddings. Il ne lit que le token précédent, même si tout le texte reste affiché.' },
    { question: 'Comment les erreurs donnent-elles un rôle aux vecteurs ?', before: 'Le modèle de comptage savait produire des probabilités. Nous construisons maintenant une fonction paramétrée et partagée entre plusieurs contextes.', experiment: 'Suivre chien fatigué jusqu’à la perte ; déplacer une coordonnée ; retrouver sa pente ; entraîner ; tester chat fatigué, absent des corrections.', limit: 'Deux coordonnées, une moyenne et trois sorties : c’est un modèle de transition vers les LLM, sans attention ni représentation de l’ordre.' },
    { question: 'Peut-on calculer comment mélanger le contexte ?', before: 'Une moyenne utilise des coefficients fixes. L’attention calcule des coefficients à partir des représentations et de paramètres appris.', experiment: 'Suivre la dernière position de chat après promenade fatigué donc : produire Q/K/V, comparer Q et K, normaliser les scores, additionner les valeurs pondérées.', limit: 'Nouveau modèle et nouveau corpus, pas les poids de la leçon 5. Une tête, dernière requête seulement, sans positions. Le bloc résiduel/MLP est déjà dans le moteur ; la leçon 7 l’ouvre.' },
    { question: 'Que devient le mélange produit par l’attention ?', before: 'Nous reprenons le modèle de la leçon 6 à son nombre d’époques sauvegardé. Le mélange de valeurs est une représentation, pas encore un mot.', experiment: 'Calculer les additions résiduelles, la normalisation, les neurones cachés puis les scores finaux. Séparer mélange entre positions et transformation dans une position.', limit: 'Un bloc pédagogique post-norm ne couvre pas toutes les architectures modernes. Positions, masque causal complet, plusieurs têtes et génération sont distingués en fin de leçon.' },
    { question: 'Puis-je refaire le raisonnement sur de nouvelles données ?', before: 'Même architecture que les leçons 6–7, mais nouveau corpus et paramètres réinitialisés. Rien n’est transféré depuis les phrases d’animaux.', experiment: 'Expliquer les prédictions avant et après entraînement, puis changer sec en humide à paramètres fixes. Identifier les opérations qui changent et celles qui ne changent pas.', limit: 'Réussir deux contre-tests ne prouve pas une compréhension générale. Les réponses restent limitées à arroser/attendre et le modèle ne représente pas l’ordre du préfixe.' },
  ];
}
