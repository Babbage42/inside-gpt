# Inside GPT

Un cours interactif, en français, pour comprendre comment fonctionne un modèle de langage comme GPT : d'une simple multiplication jusqu'à la machine complète. Chaque notion se manipule, et tout ce qui s'anime est un vrai calcul exécuté dans le navigateur.

**▶ Suivre le cours : https://babbage42.github.io/inside-gpt/**

Aucun prérequis en mathématiques ou en programmation. Compter une à deux heures pour le parcours principal ; les sections « Ouvrir le capot » vont plus loin pour qui veut le détail des calculs.

## Le parcours

Chaque chapitre commence par une expérience à manipuler, et le texte tient en quelques phrases. Le cours se lit à deux niveaux : le parcours principal, pour comprendre le fonctionnement sans prérequis, et des sections « Ouvrir le capot » qui déroulent le vrai calcul pour qui veut approfondir. Onze chapitres :

1. **Le pari** — le lecteur joue lui-même à deviner le mot suivant et constate ce que ce seul jeu exige.
2. **Compter** — un modèle par comptage, la boucle de génération, puis ses deux murs (0 % pour l'inédit, explosion du nombre de contextes).
3. **La carte** — un bouton par mot et une note (leur produit), la correction essayée dans les deux sens, puis des embeddings 2D entraînés en direct ; les familles de mots se regroupent seules. *Capot : produit scalaire, softmax, température.*
4. **La pente** — le lecteur place un mot à la main, découvre le relief de la perte, puis regarde la descente de gradient. *Capot : rétropropagation, comparée à une différence finie.*
5. **Le neurone** — un neurone réglé à la main, sa limite (frontière droite), puis une couche cachée entraînée en direct et le rôle de la non-linéarité.
6. **Le regard** — un transformer à deux couches apprend en direct un jeu de fiches ; on voit l'attention se former, puis on ouvre le modèle. *Capot : questions, étiquettes, contenus, flux résiduel, et ablation des couches.*
7. **L'échelle** — la machine complète, du mini-modèle à GPT-3, et le brouillon (chaîne de raisonnement). *Capot : une fiche suivie à travers tout le mini-transformer.*
8. **L'intérieur** — ce que la recherche trouve dans les grands modèles, et ce qu'on ignore encore.
9. **L'assemblage** — on construit un GPT pièce par pièce. Six modèles réellement entraînés sur les mêmes textes, chacun avec une pièce de plus que le précédent (dernier mot seul, un regard, la place des mots, des neurones, un second regard, trois couches) : on lit sur quatre mesures et sur quatre phrases-témoins ce que chaque pièce apporte, y compris quand elle n'apporte presque rien. Chaque pièce renvoie au chapitre qui l'a introduite.
10. **La grande machine** — le modèle complet (3 couches, 2 têtes d'attention, MLP, LayerNorm, 63 312 paramètres) qui écrit mot après mot et répond à des questions sur son mini-monde. Une fresque animée montre tout son calcul en direct, avec sous chaque étage ce que le modèle répondrait si on le lisait à cet endroit. On y voit aussi ce que consulte chaque tête d'attention et ce que deviennent les mesures quand on la débranche. Le chapitre se termine par le grand zoom : huit échelles emboîtées, d'une multiplication à GPT-3, parcourues d'un seul mouvement. Des encadrés « Dans ChatGPT », tout au long du cours, relient chaque pièce à un comportement qu'on observe en s'en servant.
11. **L'assistant** — comment une machine à deviner devient ChatGPT, en trois temps calqués sur un manuel scolaire : le cours (un modèle de base, qui continue les questions au lieu d'y répondre), les exercices corrigés (des dialogues, d'où sortent la façon de répondre et le « je ne sais pas »), les exercices notés (des essais notés par un correcteur, sans corrigé). Cinq modèles réellement entraînés, et un exercice noté que le lecteur fait tourner lui-même.

Les modèles des chapitres 9 et 10 sont les seuls à ne pas être entraînés dans le navigateur : il y faudrait plusieurs minutes chacun. `npm run train:mini` les entraîne à l'avance (une dizaine de minutes, calcul réparti sur quatre cœurs, même moteur que le reste) et écrit dans `public/models` leurs réglages et leurs résultats : le modèle complet avec 17 instantanés de son entraînement, et les modèles intermédiaires de la construction. Tous n'apprennent qu'à deviner le mot suivant, sur des textes tirés d'une petite grammaire (`engine/mini-world.ts`).

De même pour le chapitre 11 : `npm run train:assistant` (une vingtaine de minutes) entraîne le modèle de base, les deux assistants affinés sur des dialogues, l'assistant entraîné par récompense et la contre-épreuve sans pluriel (`engine/assistant-world.ts`).

Quatre mesures, définies dans `engine/mini-exam.ts` : la part de phrases vraies en écriture libre (99 % pour le modèle complet), la réponse à une question posée juste après une phrase sur un autre animal (100 %), et deux épreuves sur des cas absents de l'entraînement, questions jamais posées (89 %) et accords jamais lus (80 %). Ce que la page dit du rôle de chaque tête d'attention est observé en direct sur le modèle, pas écrit à la main. Le modèle ne sait pas lire une scène nouvelle comme celui du chapitre 6 : mes essais pour le lui apprendre à cette taille ont échoué, et le chapitre le dit.

Tout ce qui s'anime est un calcul réel exécuté dans le navigateur (`src/app/v4/engine`), avec des graines fixes : aucun résultat n'est scénarisé. Les deux mesures de généralisation utilisent des données tenues hors entraînement : 28 phrases plausibles jamais lues pour la carte, et un quart des couples prénom/boisson pour le transformer. La carte est volontairement régularisée, sinon elle mémorise ses 49 phrases ; le chapitre 3 le dit.

Les tests (`engine.spec.ts`, `mini.spec.ts`, `grand-zoom.spec.ts`) vérifient les gradients par différences finies, la séparation entraînement/test, la généralisation du transformer, l'effet de l'ablation de chaque couche et le comportement des neurones avec et sans non-linéarité. Comme pour les versions précédentes, ils ne disent rien de l'efficacité pédagogique : elle reste à observer sur un vrai lecteur.

## Les questions fréquentes

Le bouton « FAQ » de la barre du cours ouvre une soixantaine de réponses courtes, rangées en six familles : les mots, le mécanisme, les idées reçues, les erreurs et limites, le passage du cours aux vrais modèles, et la façon de suivre le cours. On y cherche par mot, chaque réponse renvoie au chapitre qui la montre en action, et chaque chapitre propose en bas de page les questions qui le concernent. Une question a sa propre adresse (`#faq/…`), pour pouvoir la partager.

Pour en ajouter une : un objet de plus dans `src/app/v4/faq/faq-data.ts` (famille, question, réponse, chapitre éventuel). Les réponses débattues portent la mention « question ouverte ».

## Lancer le cours en local

```bash
npm install
npm start
```

Le cours s'ouvre sur `http://localhost:4200`.

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Le site public est reconstruit et publié sur GitHub Pages à chaque poussée sur `main` (`.github/workflows/pages.yml`).

## Où est quoi

- `src/app/v4/chapters` : les dix chapitres, les sections « capot », la fresque et le grand zoom.
- `src/app/v4/faq` : les questions fréquentes (`faq-data.ts` pour le contenu).
- `src/app/v4/engine` : le moteur de calcul (autodifférentiation sur des matrices, modèles, mini-monde, mesures). Aucune bibliothèque d'apprentissage automatique.
- `tools/train-mini.ts` : l'entraînement à l'avance des modèles des chapitres 9 et 10.
- `public/models` : leurs réglages et leurs résultats.

## Archives : les versions précédentes

Le dépôt garde les trois premières versions du cours, écrites avant celle-ci sous le nom de GradientLab. Elles ne sont pas publiées sur le site ; en local, elles s'ouvrent par `/v1`, `/v2` et `/v3`. Les notes ci-dessous et le dossier `docs/` les décrivent telles qu'elles étaient.

### Nouveau parcours V3 — pilote pédagogique

Ouvrir `http://localhost:4200/v3` après `npm start`. La V1 est sur `/v1` et la V2 sur `/v2`. Les versions sont chargées séparément et conservent des sauvegardes distinctes.

Le pilote comporte 16 scènes sur un même mini-modèle réel : corpus, préfixe/cible, tokens/IDs, lookup d'embeddings, moyenne, poids, scores, softmax, perte, interventions, différences finies, rétropropagation, gradients vers E, correction, laboratoire et quatre exercices de transfert. Les notions et les nombres sont introduits avant les formules ; les interventions attendent une anticipation ou une demande d'indice.

L'exercice accompagné utilise « un chat mange la » → souris. « le chat mange la » reste hors entraînement. Le scénario guidé ne change pas lorsque l'on entraîne le laboratoire. Progression, réponses, justifications, carnet, checkpoint et historique sont repris depuis le stockage local, sans effacer les sessions V1/V2.

Ce pilote n'est pas encore le parcours complet sur un Transformer moderne. La suite V3 sera construite après évaluation des fondations. Les bilans automatiques vérifient les calculs et les choix, pas le sens des justifications. Voir [le storyboard réalisé](docs/v3-lecon-pilote.md) et [l'audit qui le motive](docs/audit-pedagogique-v3.md).

### Première tranche fonctionnelle — ancien parcours V1

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

### Deuxième leçon

La deuxième expérience construit un détecteur de spam miniature pour introduire le neurone au moment où il devient utile :

```text
score = x₁w₁ + x₂w₂ + b
probabilité = sigmoid(score)
```

Elle explique la classification, l'encodage numérique d'indices, les poids, le biais, la différence entre score et probabilité, la fonction d'activation et le seuil de décision. Une vérification conceptuelle déverrouille ensuite la leçon 3.

### Troisième leçon

Le problème XOR de deux interrupteurs fait constater qu'un neurone unique ne peut pas représenter toutes les règles. Deux neurones cachés détectent ensuite « au moins un » et « les deux », puis un neurone de sortie recombine ces représentations pour résoudre les quatre cas.

Cette expérience explicite le rôle d'un neurone comme détecteur de condition simple, la notion de couche cachée et la nécessité des activations non linéaires.

La fin détaille les paramètres de chaque neurone caché et expose la table complète `(A, B) → (au moins un, les deux) → sortie` afin de rendre la représentation intermédiaire calculable ligne par ligne.

### Quatrième leçon

Un modèle bigramme est construit à partir de cinq phrases françaises. La leçon suit tout le pipeline : corpus, tokens, exemples entrée/cible, matrice de comptes, normalisation en probabilités, inférence et génération autorégressive.

Le laboratoire insiste sur la continuité avec les futurs LLM — prédire le token suivant reste la tâche — et fait constater la limite d'une fenêtre de contexte réduite au dernier token.

La génération distingue explicitement le choix maximal, déterministe, de l'échantillonnage pondéré. Le tirage aléatoire est affiché afin de montrer dans quelle tranche de probabilité tombe le token choisi.

### Cinquième leçon

Une enquête en douze chapitres introduit des paramètres partagés avant leur notation. L’ID sélectionne une ligne de la table ; le one-hot est une autre écriture de cette sélection, pas une étape d’apprentissage. Un état initial fixe sert aux calculs, un autre modèle à l’entraînement. Une intervention de ±0,001 est comparée au gradient analytique.

Le modèle moyenne deux embeddings et produit trois logits. Les calculs des lecteurs, du softmax, de la perte et du gradient sont explicités. Le laboratoire teste `chat fatigué`, hors des corrections, puis une rotation commune des embeddings et lecteurs montre que les axes n’ont pas un sens imposé. Une moyenne ne peut adapter ses coefficients au contexte ; la leçon suivante examine une autre règle de mélange.

### Sixième et septième leçons

Une tête d'attention miniature calcule réellement `Q`, `K` et `V` à partir des embeddings et de matrices apprises. Les poids viennent de `softmax(QKᵀ/√d)` et les Values pondérées alimentent un bloc complet : résiduels, LayerNorm, MLP et projection de sortie.

Le moteur utilise une autodifférentiation scalaire en mode inverse. La cross-entropy du prochain token entraîne de bout en bout embeddings, projections d'attention, MLP et couche de sortie. La variante post-norm choisie pour le laboratoire est explicitement distinguée des variantes pre-norm fréquentes dans les LLM modernes.

### Huitième leçon

Le laboratoire final réutilise la même architecture sur un corpus inédit consacré à l'arrosage. L'apprenant vérifie le jeu train/test, révèle les lookups, observe l'état non entraîné, exécute un vrai gradient, entraîne le modèle, inspecte l'attention et traverse le bloc avant un contre-test `sec` / `humide`.

### Mémoire de progression

Les leçons terminées, la dernière leçon ouverte, l'étape interne et les époques d'entraînement sont enregistrées dans le stockage local du navigateur. Un rechargement reconstruit le checkpoint déterministe. La refonte de la leçon 5 reprend la lecture au premier chapitre tout en conservant les époques et les leçons terminées ; un message indique cette migration.

### Périmètre et méthode

La progression, les choix didactiques, les tests et les limites exécutables sont détaillés dans [docs/pedagogy.md](docs/pedagogy.md). Le moteur d’attention ne calcule que la dernière requête, sans positions et avec un vocabulaire de sortie restreint : ce n’est pas un LLM moderne complet. Les mécanismes modernes supplémentaires sont distingués des calculs effectivement exécutés.

Pour inspecter une leçon sans modifier la progression, le serveur de développement accepte `http://localhost:4200/v1?previewLesson=5` (1 à 8). Cet aperçu ne sauvegarde rien et se réinitialise au rechargement ; le mode normal continue de sauvegarder dans le navigateur.

### Parcours cible

1. Fondations mathématiques et autodifférentiation
2. Premier réseau neuronal
3. Dynamique de l'apprentissage
4. Premiers modèles de langage
5. Embeddings réellement appris
6. Attention entraînée de bout en bout
7. Bloc Transformer inspectable
8. Laboratoire de transfert complet

### Principes pédagogiques

Chaque notion doit répondre à trois questions : d'où vient ce nombre, pourquoi le calcule-t-on maintenant et que changerait une intervention ? Les simplifications architecturales sont nommées, les exemples de test restent hors entraînement et les modèles restent minuscules afin d'exposer l'intégralité de leurs valeurs internes.
