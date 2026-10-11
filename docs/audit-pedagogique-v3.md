# Audit pédagogique — V2.1 et proposition V3

Date : 2 octobre 2026. Statut : audit et proposition, pas une V3 implémentée.

## Verdict

La V2.1 est un laboratoire numérique utile, mais son parcours guidé reste trop proche d'une visite commentée des calculs. Elle montre ce que la machine exécute sans suffisamment apprendre au lecteur à reconstruire pourquoi et comment elle l'exécute.

Les directives V2 et V2.1 avaient déjà correctement identifié les principes : problème concret, expérience, formalisation, continuité, une question à la fois, nombres réels. Le défaut n'est donc pas une absence de consignes. Leur traduction en écrans et leur validation n'ont pas été assez exigeantes.

« Ajouter du texte » ou « découper davantage » ne suffira pas. Il faut changer le travail demandé au lecteur et écrire réellement les explications de chaque transition avant d'implémenter les écrans.

La V3 proposée conserve Angular, les moteurs numériques, les dix phrases, le préfixe tenu hors entraînement et la progression par problèmes. Elle refond l'accompagnement pédagogique. Elle ne revient pas à des chapitres indépendants.

## Périmètre et preuves

Audit des cinq leçons actives de `/v2`, des moteurs concernés, du contrat `docs/pedagogy.md`, du précédent storyboard V2.1 et des deux directives originales jointes par l'utilisateur. La V1 n'a pas été intégralement réauditée pendant cette passe.

Vérification ciblée dans l'interface sur `http://localhost:4200/v2`, sans modifier la progression de l'origine `127.0.0.1`. Inspection de la leçon 2 au démarrage et de son expérience de moyenne. Calculs du pilote exécutés directement avec le moteur `MiniLanguageModel`, à son état initial.

Les constats ci-dessous viennent des écrans et du code. Les effets supposés sur la compréhension sont des hypothèses de conception à tester avec des lecteurs. Aucun score pédagogique chiffré ni résultat d'étude utilisateur n'est inventé.

## Audit par leçon

| Leçon | Ce qui mérite d'être conservé | Rupture pédagogique observée | Intervention prioritaire |
| --- | --- | --- | --- |
| 1 — Entrée | Corpus intégral, témoin de comptage, préfixe absent, IDs comme adresses, one-hot facultatif. | Une table de quatre nombres arrive avant que leur rôle dans une décision soit suffisamment tangible. Expliquer la graine n'explique pas leur utilité. | Présenter un réglage comme une donnée modifiable du programme ; relier immédiatement une ligne lue à un calcul de score. Séparer origine, effet et interprétation des nombres. |
| 2 — Calcul et apprentissage | Vrais produits, vrai softmax, perturbation d'un poids, différences finies, entraînement/test séparés. | La moyenne est choisie par affirmation ; la perte apparaît avant sa définition ; la rétropropagation présente ses résultats au lieu d'enseigner leur reconstruction. | Refaire la traversée complète avec calcul accompagné, anticipation, calcul partiellement complété puis transfert. C'est le pilote prioritaire. |
| 3 — Ordre et positions | Permutation contrôlée et démonstration de la disparition du couplage mot–position après moyenne. | Le lecteur peut suivre une égalité sans avoir compris pourquoi préserver les couples est utile. Le réglage manuel suivant ne prépare pas assez le choix appris. | Faire prédire ce que la permutation change ; manipuler les couples avant/après fusion ; distinguer nettement politique manuelle et politique apprise. |
| 4 — Attention | Calculs Q/K/V réels, masque, somme pondérée, attention aléatoire explicitement non interprétée. | Les rôles Q/K sont nommés rapidement puis projetés par matrices. Un sous-modèle 2D s'insère dans un modèle 4D, avec une seconde navigation. | Une seule trace de référence. Introduire séparément comparaison, préférence de lecture et contenu transmis. Calculer une cellule du vrai modèle avant d'étendre la vue. |
| 5 — Attention entraînée | Entraînement réel, paramètres modifiés, gradients vérifiés, prudence sur l'interprétation. | Un bouton fait changer simultanément E/P/Q/K/V/W/b ; constater la baisse de perte ne suffit pas à comprendre le rôle causal de l'attention. | Rejouer une correction locale puis tester des interventions contrôlées au même checkpoint : lecture uniforme, Q/K initiaux, etc. Mesurer sans garantir un résultat spectaculaire. |

## Les ruptures les plus importantes

### 1. Utilité, fonctionnement et origine sont trois explications différentes

Dire « ces nombres sont initialisés avec la graine 23 » répond à **d'où ils viennent**, pas à **ce qu'ils font**. Dire « cette dimension n'a pas de sens prédéfini » prévient une erreur, mais ne fournit pas de représentation positive du mécanisme.

Il faut distinguer systématiquement :

- origine : une cellule stockée au checkpoint initial, puis modifiée par entraînement ;
- rôle : dans quelle opération intervient cette cellule et quel résultat une intervention change ;
- interprétation : ce que l'expérience autorise à dire, sans inventer une « dimension animalité ».

L'arbitraire de l'initialisation est acceptable lorsque le lecteur a compris ce qui contraindra ensuite ces valeurs. Cette compréhension ne peut pas reposer uniquement sur la promesse « on verra l'apprentissage plus tard ».

### 2. Les choix d'architecture sont trop souvent présentés comme des besoins

La leçon 2 dit : « Notre premier lecteur a besoin d'un seul résumé de quatre nombres » (`lesson-two-v21.html:21`). Le lecteur n'a pas vu le lecteur de sortie, ni pourquoi sa taille d'entrée est fixe.

La moyenne n'est pas la seule façon de traiter un contexte variable. Les embeddings ne sont pas la seule façon de représenter des catégories. Q/K/V ne sont pas une conséquence mathématiquement inévitable de la prédiction du prochain token.

Il faut annoncer : « Voici la solution minimale que nous choisissons d'essayer », expliquer son avantage concret, montrer au moins une alternative pertinente puis mesurer sa limite. Faire naître un mécanisme d'un problème ne doit pas fabriquer une fausse nécessité scientifique.

### 3. Des explications indispensables sont devenues facultatives

La perte est affichée à l'étape 5, mais sa définition et sa manipulation sont dans un panneau fermé (`lesson-two-v21.html:43–48`). Les règles locales de rétropropagation sont elles aussi dans les détails (`:66–72`).

Le progressive disclosure doit réduire ce qui est visible simultanément. Il ne doit pas rendre optionnel le lien nécessaire à la prochaine étape.

Définition, signification des symboles, un calcul concret et son interprétation appartiennent au parcours principal. Forme matricielle exhaustive, implémentation et variantes avancées peuvent être facultatives.

### 4. La rétropropagation n'est pas effectivement enseignée

Le passage « forward/backward » remplace les valeurs par des gradients. Le résultat `P(cible) − 1` arrive sans dérivation principale ; la contribution des douze sorties aux embeddings est seulement annoncée.

La concordance gradient analytique/différence finie est un excellent test de calcul. Elle ne prouve pas que le lecteur sait expliquer comment le gradient a été obtenu.

Il faut remonter le même graphe, une opération à la fois : petite variation, sens et amplitude de l'effet, multiplication des sensibilités le long d'un chemin, addition des effets lorsque les chemins se rejoignent. Le lecteur doit reconstruire au moins un gradient avant de lancer des centaines d'époques.

### 5. Nous posons des questions sans laisser le lecteur répondre

Les bilans des leçons 2, 4 et 5 donnent immédiatement la réponse (`lesson-two-v21.html:90`, `lesson-four.html:64`, `lesson-five-attention.html:33`). La navigation avance sans exiger de reconstruction ni d'expérience.

Le problème n'est pas de devoir bloquer tout le monde sur des QCM. Il manque un diagnostic : anticipation enregistrée avant résultat, feedback lié à l'erreur, possibilité de demander un indice, exercice de transfert. Le bouton « continuer sans exercice » doit rester disponible, mais ne pas être confondu avec une compétence validée.

### 6. Les schémas montrent surtout des états, moins les opérations

Les cartes numériques sont utiles pour inspecter les valeurs, moins pour comprendre ce qui se transforme. Une série de flèches non commentées ne fait pas connaître la relation causale entre les cartes.

Visuels prioritaires :

- adresse du token → sélection de sa ligne, sans que l'ID soit transformé en coordonnées ;
- collecte d'une colonne → somme → division, avec les étiquettes de provenance qui disparaissent à la fusion ;
- cellule de contexte × cellule de poids → contribution, puis addition des contributions ;
- compétition entre candidats : changer un score change aussi les parts des autres ;
- même graphe conservé en forward et backward, deux valeurs par nœud, révélation locale ;
- comparaison entre poids de lecture et contenu lu : deux objets visuels distincts.

Les animations doivent être arrêtables, rejouables et disponibles en pas-à-pas statique. Les images décoratives ne constituent pas la priorité. Les coordonnées négatives doivent apparaître sur un axe signé, pas comme de vagues intensités.

### 7. Le corpus ne peut pas démontrer toutes les nécessités architecturales

Dans les dix phrases actuelles, après « la », toutes les fins associées à chat sont souris et celles associées à chien sont pomme. Une information sur l'animal suffit pour cette distinction. Le test « le chat mange la » a aussi un voisin très proche « un chat mange la ».

Ce corpus convient pour voir les calculs et une généralisation limitée. Il ne suffit pas à établir que l'attention ou un Transformer complet sont nécessaires à la réussite de cette tâche.

Conserver ce fil rouge. Lorsqu'on atteint cette limite, l'annoncer et ajouter une expérience contrôlée explicitement séparée, où l'ordre ou la position variable d'un indice importe. Ne pas changer discrètement les données ; ne pas prétendre que chaque nouveau composant améliore forcément le test initial.

### 8. Le cours actuel ne couvre pas encore un LLM moderne de bout en bout

La V2.1 s'arrête à une attention entraînée. Le premier moteur est `E → moyenne → W,b → softmax` ; ce n'est pas un réseau profond avec MLP non linéaire. Le bloc Transformer complet, l'empilement, la génération et le laboratoire de transfert restent à construire dans cette version.

Il faut distinguer : mécanisme déjà compris et testé, élément du mini-modèle, élément restant à construire, variante d'architecture moderne. Le lecteur ne doit pas terminer cinq leçons avec l'impression injustifiée d'avoir déjà parcouru un GPT complet.

## Défauts d'interface confirmés ou directement observables

- **Sélection incohérente dans la leçon 2** : cliquer sur une ligne change `focusTokenIndex`, mais le nombre héros utilise `heroToken = animal()` (`lesson-two.ts:158`). Vérifié dans le navigateur : cliquer « mange » ne remplace pas le nombre suivi de « chat ». Soit supprimer cette sélection ambiguë, soit réellement suivre le token sélectionné.
- **Expérience trop basse** : à la taille de fenêtre inspectée, le bandeau permanent et le grand encart de phrase occupent l'essentiel du premier viewport. La question et les premières explications arrivent avant l'expérience, qui nécessite de descendre. Réduire l'en-tête permanent à une phrase compacte et une carte de progression.
- **Deux progressions imbriquées en attention** : étape de leçon et sous-étapes 2D (`lesson-four.html:31–42`). Unifier la progression ou présenter explicitement une expérience indépendante, avec retour clair au modèle principal.

Ces corrections sont utiles, mais ne résoudront pas seules le défaut didactique.

## Méthode V3 : un apprentissage accompagné puis autonome

Chaque difficulté suit ce cycle, avec autant de scènes que nécessaire :

1. **Rappeler l'acquis précis.** Deux phrases et le même état visible. Aucun nouveau symbole présupposé.
2. **Faire apparaître une question concrète.** Expliquer ce qui manque et pourquoi cela empêche d'avancer.
3. **Résoudre un cas accompagné.** Le texte enseigne le raisonnement ; le schéma montre l'opération ; les nombres montrent son exécution. Le lecteur n'a pas à deviner seul une notion inconnue.
4. **Faire anticiper une intervention.** Avant résultat : « Si ce poids augmente, ce score augmente-t-il ? Pourquoi ? »
5. **Rejouer avec moins d'aide.** Une addition ou une justification manque ; l'aide revient en cas d'erreur.
6. **Formaliser ce qui est déjà compris.** Introduire chaque symbole en le reliant à l'objet déjà manipulé. Ne pas repousser une définition indispensable aux détails.
7. **Transférer.** Autre coordonnée, autre signe ou autre token ; ne pas refaire seulement le même exemple avec une couleur différente.
8. **Relier au système et à sa prochaine limite.** Faire raconter la chaîne complète, puis provoquer la question suivante.

Le lecteur peut consulter librement les leçons. Son profil de compréhension distingue « vu », « réussi avec aide » et « réussi sans aide ». On sauvegarde aussi son checkpoint de laboratoire, séparé du scénario guidé de référence.

Cette méthode s'appuie sur des recommandations de pratique : alterner exemples résolus et exercices, relier représentations concrètes et abstraites, associer graphiques et explications, solliciter la restitution et les justifications. Voir le [guide de l'Institute of Education Sciences](https://ies.ed.gov/ncee/wwc/PracticeGuide/1). La réduction graduelle de l'aide a aussi été étudiée dans [Renkl et al., 2000](https://escholarship.org/content/qt81b9j9hs/qt81b9j9hs_noSplash_ef3e30a960524adc5157ece2d6fa3130.pdf?t=reckzt). Ces travaux justifient un protocole à essayer ; ils ne prouvent pas que notre futur cours sera efficace sans test utilisateur.

## Ordre de travail proposé

### Priorité 0 — Un pilote réellement écrit

Le document `v3-lecon-pilote.md` contient un spécimen allant de la lecture des réglages à une correction de poids, sur les nombres réels du moteur actuel. Ce n'est pas seulement une liste de titres.

Construire d'abord ce pilote à côté de `/v2`, sans casser les sessions existantes. Faire lire et pratiquer sa version interactive avant de décliner la méthode sur tout le cours. Le pilote peut garder ses parties dans deux leçons ; le nombre de pages n'est pas le critère.

### Priorité 1 — Corriger la continuité entre les leçons 1 et 2

Faire comprendre le contrat de prédiction, la cible, les IDs, la table, le rôle des coordonnées, le choix du résumé, une sortie pondérée, les probabilités et la perte. Toutes les dépendances du pilote doivent être enseignées, pas simplement récapitulées.

### Priorité 2 — Réécrire apprentissage, positions et attention

Conserver les calculs et les expériences valides. Refaire les explications et les tâches du lecteur. Pour attention : rôles fonctionnels → interventions → une cellule réelle → une ligne réelle → généralisation à la matrice, plutôt que miniature ajoutée au milieu d'un autre modèle.

### Priorité 3 — Construire la suite sans prétendre qu'elle existe déjà

MLP et non-linéarité, résidus, normalisation, plusieurs têtes, bloc et empilement, génération et entraînement autoregressif. Montrer les choix d'architecture comme des solutions étudiées, non une chaîne de nécessités universelles. Conserver le laboratoire final contrôlé demandé dans la V2 ; distinguer mémorisation, généralisation et adaptation en contexte.

## Critères de validation avant d'étendre le pilote

Une scène est prête seulement si le lecteur peut retrouver l'origine de chaque nombre, nommer l'opération, expliquer son rôle, prévoir une intervention et relier son résultat à la prédiction.

Test avec un lecteur développeur débutant en IA, sans explication orale compensatrice de l'auteur :

- relever les premiers endroits où il demande « pourquoi ? » ou « d'où vient ce nombre ? » ;
- demander une explication avant de laisser ouvrir la correction ;
- tester un changement de signe pour distinguer compréhension et mémorisation de « augmenter le poids aide » ;
- tester une ligne E absente du préfixe et une modification d'un score concurrent ;
- refaire une correction sur un autre exemple sans le calcul déjà rempli ;
- demander le lendemain une reconstruction sans relire tout le parcours.

Pour ce pilote, la validation minimale proposée est de réussir les quatre interventions centrales et d'expliquer leur sens sans vocabulaire de boîte noire. C'est un objectif produit à vérifier, pas une mesure actuelle. Si le lecteur échoue, corriger la scène responsable avant d'ajouter les leçons suivantes.

Les tests automatiques gardent leur rôle : formes des matrices, valeurs, gradients, données train/test, isolation des sessions, navigation et accessibilité. Ils ne seront plus présentés comme une validation de la pédagogie.

## Décision recommandée

Une V3 pédagogique est justifiée. Recommencer les moteurs ou ajouter d'abord les derniers chapitres ne l'est pas. Réussir et tester le passage « un réglage numérique modifie une prédiction, puis l'erreur indique comment le corriger » est le prochain jalon. Tant que ce passage reste magique pour le lecteur, construire un Transformer au-dessus empile des inconnues.
