# GradientLab

Un laboratoire Angular interactif pour comprendre les réseaux de neurones et les LLM depuis les opérations élémentaires jusqu'au Transformer.

## Parcours V4 — voir d'abord, comprendre ensuite

Ouvrir [la V4](http://127.0.0.1:4200/v4) après `npm start`. Les versions précédentes restent accessibles (`/`, `/v2`, `/v3`) et gardent leurs sauvegardes.

La V4 repart de zéro avec un autre parti pris : chaque chapitre commence par une expérience visuelle et le texte tient en quelques phrases. Elle se lit à deux niveaux : le parcours principal, pour comprendre le fonctionnement sans prérequis, et des sections « Ouvrir le capot » qui déroulent le vrai calcul pour qui veut approfondir. Neuf chapitres :

1. **Le pari** — le lecteur joue lui-même à deviner le mot suivant et constate ce que ce seul jeu exige.
2. **Compter** — un modèle par comptage, la boucle de génération, puis ses deux murs (0 % pour l'inédit, explosion du nombre de contextes).
3. **La carte** — un bouton par mot et une note (leur produit), la correction essayée dans les deux sens, puis des embeddings 2D entraînés en direct ; les familles de mots se regroupent seules. *Capot : produit scalaire, softmax, température.*
4. **La pente** — le lecteur place un mot à la main, découvre le relief de la perte, puis regarde la descente de gradient. *Capot : rétropropagation, comparée à une différence finie.*
5. **Le neurone** — un neurone réglé à la main, sa limite (frontière droite), puis une couche cachée entraînée en direct et le rôle de la non-linéarité.
6. **Le regard** — un transformer à deux couches apprend en direct un jeu de fiches ; on voit l'attention se former, puis on ouvre le modèle. *Capot : questions, étiquettes, contenus, flux résiduel, et ablation des couches.*
7. **L'échelle** — la machine complète, du mini-modèle à GPT-3, et le brouillon (chaîne de raisonnement). *Capot : une fiche suivie à travers tout le mini-transformer.*
8. **L'intérieur** — ce que la recherche trouve dans les grands modèles, et ce qu'on ignore encore.
9. **La grande machine** — une fresque animée du mini-transformer complet, de la fiche aux probabilités, calculée en direct. On y règle l'instant de l'entraînement (instantanés tous les 50 pas), les couches actives, la température et la fiche, puis un recul final montre combien de machines de cette taille il faudrait pour égaler GPT-3.

Tout ce qui s'anime est un calcul réel exécuté dans le navigateur (`src/app/v4/engine`), avec des graines fixes : aucun résultat n'est scénarisé. Les deux mesures de généralisation utilisent des données tenues hors entraînement : 28 phrases plausibles jamais lues pour la carte, et un quart des couples prénom/boisson pour le transformer. La carte est volontairement régularisée, sinon elle mémorise ses 49 phrases ; le chapitre 3 le dit.

Les tests de `engine.spec.ts` vérifient les gradients par différences finies, la séparation entraînement/test, la généralisation du transformer, l'effet de l'ablation de chaque couche et le comportement des neurones avec et sans non-linéarité. Comme pour les versions précédentes, ils ne disent rien de l'efficacité pédagogique : elle reste à observer sur un vrai lecteur.

## Nouveau parcours V3 — pilote pédagogique

Ouvrir [le pilote V3](http://127.0.0.1:4200/v3) après `npm start`. La V1 reste sur `/` et la V2 sur `/v2`. Les versions sont chargées séparément et conservent des sauvegardes distinctes.

Le pilote comporte 16 scènes sur un même mini-modèle réel : corpus, préfixe/cible, tokens/IDs, lookup d'embeddings, moyenne, poids, scores, softmax, perte, interventions, différences finies, rétropropagation, gradients vers E, correction, laboratoire et quatre exercices de transfert. Les notions et les nombres sont introduits avant les formules ; les interventions attendent une anticipation ou une demande d'indice.

L'exercice accompagné utilise « un chat mange la » → souris. « le chat mange la » reste hors entraînement. Le scénario guidé ne change pas lorsque l'on entraîne le laboratoire. Progression, réponses, justifications, carnet, checkpoint et historique sont repris depuis le stockage local, sans effacer les sessions V1/V2.

Ce pilote n'est pas encore le parcours complet sur un Transformer moderne. La suite V3 sera construite après évaluation des fondations. Les bilans automatiques vérifient les calculs et les choix, pas le sens des justifications. Voir [le storyboard réalisé](docs/v3-lecon-pilote.md) et [l'audit qui le motive](docs/audit-pedagogique-v3.md).

## Première tranche fonctionnelle — ancien parcours V1

Le premier laboratoire répond d'abord à la question « comment une machine apprend-elle ? » avec une situation concrète : prédire une note à partir du temps d'étude.

```text
note prédite = heures × points par heure + niveau de départ
loss = (note prédite - note réelle)²
```

L'interface permet de :

- distinguer les données fournies des paramètres appris ;
- modifier les heures, les points par heure, le niveau de départ et la note réelle ;
- parcourir le forward puis le backward étape par étape ;
- inspecter la valeur et le gradient de chaque nœud ;
- appliquer un véritable pas de descente de gradient ;
- observer immédiatement l'effet du pas sur la loss.

Le moteur dans `src/app/core/autograd/value.ts` est écrit en TypeScript pur. Il ne dépend d'aucune bibliothèque de machine learning afin que toutes les opérations pédagogiques restent inspectables.

## Deuxième leçon

La deuxième expérience construit un détecteur de spam miniature pour introduire le neurone au moment où il devient utile :

```text
score = x₁w₁ + x₂w₂ + b
probabilité = sigmoid(score)
```

Elle explique la classification, l'encodage numérique d'indices, les poids, le biais, la différence entre score et probabilité, la fonction d'activation et le seuil de décision. Une vérification conceptuelle déverrouille ensuite la leçon 3.

## Troisième leçon

Le problème XOR de deux interrupteurs fait constater qu'un neurone unique ne peut pas représenter toutes les règles. Deux neurones cachés détectent ensuite « au moins un » et « les deux », puis un neurone de sortie recombine ces représentations pour résoudre les quatre cas.

Cette expérience explicite le rôle d'un neurone comme détecteur de condition simple, la notion de couche cachée et la nécessité des activations non linéaires.

La fin détaille les paramètres de chaque neurone caché et expose la table complète `(A, B) → (au moins un, les deux) → sortie` afin de rendre la représentation intermédiaire calculable ligne par ligne.

## Quatrième leçon

Un modèle bigramme est construit à partir de cinq phrases françaises. La leçon suit tout le pipeline : corpus, tokens, exemples entrée/cible, matrice de comptes, normalisation en probabilités, inférence et génération autorégressive.

Le laboratoire insiste sur la continuité avec les futurs LLM — prédire le token suivant reste la tâche — et fait constater la limite d'une fenêtre de contexte réduite au dernier token.

La génération distingue explicitement le choix maximal, déterministe, de l'échantillonnage pondéré. Le tirage aléatoire est affiché afin de montrer dans quelle tranche de probabilité tombe le token choisi.

## Cinquième leçon

Une enquête en douze chapitres introduit des paramètres partagés avant leur notation. L’ID sélectionne une ligne de la table ; le one-hot est une autre écriture de cette sélection, pas une étape d’apprentissage. Un état initial fixe sert aux calculs, un autre modèle à l’entraînement. Une intervention de ±0,001 est comparée au gradient analytique.

Le modèle moyenne deux embeddings et produit trois logits. Les calculs des lecteurs, du softmax, de la perte et du gradient sont explicités. Le laboratoire teste `chat fatigué`, hors des corrections, puis une rotation commune des embeddings et lecteurs montre que les axes n’ont pas un sens imposé. Une moyenne ne peut adapter ses coefficients au contexte ; la leçon suivante examine une autre règle de mélange.

## Sixième et septième leçons

Une tête d'attention miniature calcule réellement `Q`, `K` et `V` à partir des embeddings et de matrices apprises. Les poids viennent de `softmax(QKᵀ/√d)` et les Values pondérées alimentent un bloc complet : résiduels, LayerNorm, MLP et projection de sortie.

Le moteur utilise une autodifférentiation scalaire en mode inverse. La cross-entropy du prochain token entraîne de bout en bout embeddings, projections d'attention, MLP et couche de sortie. La variante post-norm choisie pour le laboratoire est explicitement distinguée des variantes pre-norm fréquentes dans les LLM modernes.

## Huitième leçon

Le laboratoire final réutilise la même architecture sur un corpus inédit consacré à l'arrosage. L'apprenant vérifie le jeu train/test, révèle les lookups, observe l'état non entraîné, exécute un vrai gradient, entraîne le modèle, inspecte l'attention et traverse le bloc avant un contre-test `sec` / `humide`.

## Mémoire de progression

Les leçons terminées, la dernière leçon ouverte, l'étape interne et les époques d'entraînement sont enregistrées dans le stockage local du navigateur. Un rechargement reconstruit le checkpoint déterministe. La refonte de la leçon 5 reprend la lecture au premier chapitre tout en conservant les époques et les leçons terminées ; un message indique cette migration.

## Lancer le projet

```bash
npm install
npm start
```

L'application est ensuite disponible sur `http://localhost:4200`.

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

## Périmètre et méthode

La progression, les choix didactiques, les tests et les limites exécutables sont détaillés dans [docs/pedagogy.md](docs/pedagogy.md). Le moteur d’attention ne calcule que la dernière requête, sans positions et avec un vocabulaire de sortie restreint : ce n’est pas un LLM moderne complet. Les mécanismes modernes supplémentaires sont distingués des calculs effectivement exécutés.

Pour inspecter une leçon sans modifier la progression, le serveur de développement accepte `http://localhost:4200/?previewLesson=5` (1 à 8). Cet aperçu ne sauvegarde rien et se réinitialise au rechargement ; le mode normal continue de sauvegarder dans le navigateur.

## Parcours cible

1. Fondations mathématiques et autodifférentiation
2. Premier réseau neuronal
3. Dynamique de l'apprentissage
4. Premiers modèles de langage
5. Embeddings réellement appris
6. Attention entraînée de bout en bout
7. Bloc Transformer inspectable
8. Laboratoire de transfert complet

## Principes pédagogiques

Chaque notion doit répondre à trois questions : d'où vient ce nombre, pourquoi le calcule-t-on maintenant et que changerait une intervention ? Les simplifications architecturales sont nommées, les exemples de test restent hors entraînement et les modèles restent minuscules afin d'exposer l'intégralité de leurs valeurs internes.
