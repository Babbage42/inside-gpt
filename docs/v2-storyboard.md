# GradientLab V2 — storyboard avant implémentation

## Diagnostic de la V1

La V1 a des calculs exécutables et de bonnes briques locales : autodifférentiation scalaire, embeddings entraînés, inspection Q/K/V, visualisations de probabilités, progression locale. Elle permet de vérifier plusieurs équations. Son architecture pédagogique ne fournit cependant pas une seule trace continue. L'exemple passe des notes au spam, à XOR, aux bigrammes, aux animaux puis aux plantes. Le modèle de la leçon 5 ne partage aucun poids avec celui de la leçon 6. Le moteur d'attention de la V1 n'a ni information de position ni calcul à toutes les positions ; son masque causal n'est qu'expliqué. La V1 ne peut donc pas servir de démonstration numérique complète du trajet d'un mini-GPT. Ajouter du texte à ses leçons ne résoudrait pas cette rupture.

## État du prototype testable

L'entrée `/v2` réalise quatre leçons guidées. La leçon 1 comporte sept étapes substantielles : question et comptage, audit des dix phrases, ablation du contexte, échec sur une combinaison de tokens connus mais inédite, tokenisation et paires d'entraînement, invariance au renommage des IDs, lecture d'une table d'embeddings et calcul one-hot. La leçon 2 reprend **exactement la même table E initiale** et les mêmes dix phrases : elle calcule un contexte par moyenne, une projection W + biais, les logits, softmax, la perte et les gradients, puis entraîne réellement E, W et les biais sur les 52 paires préfixe/cible. Les dix phrases sont distinctes ; le préfixe test `le chat mange la` et la phrase `le chat mange la souris .` sont tenus hors entraînement. La trace, la perte et les paramètres affichés proviennent du moteur, pas d'un scénario. La navigation entre leçons et la reprise locale sont accessibles, y compris sur mobile.

Ce deuxième état du modèle reste délibérément aveugle à l'ordre : la moyenne est une marche pédagogique intermédiaire, **pas** un mini-GPT. La leçon 3 introduit d'abord la place indépendamment du mot qui l'occupe, sans formule, puis effectue trois expériences contrôlées sur le même E/W/biais : permutation, ajout d'un vecteur de position puis moyenne (qui échoue encore), et pondération positionnelle manuelle (qui rend l'ordre visible sans apprentissage). La notation générale et le calcul complet sont à dévoiler après l'observation, non au début de l'écran. La leçon 4 repart du besoin de choisir où lire ; elle sépare E + P, la fabrication de Q/K, la comparaison et le masque, puis seulement V et la sortie. Une seule tête d'attention causale de largeur 4 est réellement exécutée avec le W/biais existant. P et les trois matrices de projection poursuivent la graine 23, mais **ne sont pas entraînés** ; leurs poids presque uniformes ne démontrent aucune sélection sémantique. Les blocs complets, l'entraînement de ces nouvelles matrices et le laboratoire final restent à construire. Tester avec un lecteur que ces transitions sont réellement compréhensibles.

La leçon 2 met maintenant chaque transition sous la forme **nous avons → ce qui manque → l'essai que nous allons mesurer**. Le passage de cinq lignes E à un contexte de quatre nombres utilise des barres signées sur une échelle commune, le choix d'une coordonnée et d'un token, puis la somme et la division réellement calculées. La moyenne est justifiée par comparaison avec « ne garder que le dernier token » et « sommer sans normaliser », et explicitement présentée comme un choix provisoire aveugle à l'ordre. Le passage aux scores compare deux colonnes de W avec le même contexte et propose une variation temporaire d'un seul poids ; le score essayé est calculé sans modifier le checkpoint. La transition score → probabilité est montrée en trois opérations numériques avant la formule compacte.

Audit pédagogique complémentaire : distinguer au départ **donnée/cible**, **paramètre stocké** et **valeur calculée** ; prouver la perte de l'ordre par une permutation réellement passée dans le modèle ; motiver `−ln(P(cible))` avec des probabilités d'essai explicitement séparées du checkpoint ; découvrir le gradient par deux pertes recalculées à `±ε` avant de dériver `contexte × (P(cible) − 1)` ; suivre ensuite la rétropropagation jusqu'à une case de E, vérifiée elle aussi par différences finies. Une époque montre pour un poids de W le gradient moyen du corpus et l'égalité numérique `ancien − 0,7 × gradient = nouveau`. Ne jamais présenter la formule d'un seul exemple comme si elle suffisait à justifier la correction simultanée de tous les paramètres.

## Décision de produit

- Une entrée V2 séparée de la V1, avec stockage indépendant. Aucun état V1 n'est migré ou effacé.
- Un seul mini-décodeur et un seul corpus principal de l'acte 1 à l'acte 8. Un état initial, des checkpoints explicites après entraînement, des ablations calculées avec les mêmes poids.
- La phrase centrale est `le chat mange la …`. L'interface montre d'où viennent les chiffres : comptes du corpus pour le premier modèle témoin ; logits du mini-décodeur pour le modèle entraîné. Elle n'invente pas un 72 % prédéfini.
- Chaque écran offre une couche intuitive toujours visible ; maths, nombres et code sont des vues liées à la même opération. On peut les révéler sans perdre sa place.
- Les actes 9 à 11 présentent des résultats de recherche sourcés avec un statut explicite : observation, interprétation, hypothèse, question ouverte. Une simulation illustrative doit être nommée comme telle.
- Le laboratoire final emploie la **même architecture réinitialisée** sur un micromonde. Les résultats entraînés et les échecs sont affichés tels quels, sans réponse scénarisée.

## Les trois repères persistants

1. **Question** : que doit produire la machine maintenant ?
2. **Tracé** : quel objet circule (`token`, vecteur, matrice, logit, probabilité) et quelle est sa provenance ?
3. **État** : paramètres initiaux, checkpoint entraîné, ablation temporaire ou simple variation du prompt.

Un ruban fixe représente `texte → tokens → embeddings/positions → blocs → logits → probabilités → choix`. Le mot « appris » n'est attaché qu'à des paramètres effectivement mis à jour. Les objets calculés au passage avant sont marqués « calculés ».

## Storyboard écran par écran

Chaque écran suit : **avant → question → expérience → découverte → formalisation → validation → transition**. Les titres sont des questions de l'enquête, pas des disciplines séparées.

| # | Acte / écran | Question et expérience principale | Ce qui devient possible ensuite |
|---|---|---|---|
| 01 | Machine qui devine · boîte ouverte | Dans le prototype, modifier `chat ↔ chien` dans `le … mange la` et comparer les fréquences du témoin par comptage. Quand le moteur entraîné existera, ajouter côte à côte ses distributions sans remplacer la source des comptes. | Demander ce que signifie une probabilité de prochain token. |
| 02 | Distribution témoin | Compter les continuations de `la` dans toutes les phrases. Cliquer un compte pour retrouver ses phrases. | Découvrir que compter le dernier token ne suffit pas à distinguer les contextes. |
| 03 | Deux contextes, mêmes comptes | Comparer `le chat mange la` à `le chien mange la` avec le témoin qui ne lit que `la`. Les deux distributions sont identiques. | Besoin d'une représentation du préfixe entier. |
| 04 | Texte découpé | Cliquer sur les mots et la ponctuation pour voir les tokens, l'ID et les paires préfixe/cible créées par une phrase. | Demander comment un calcul numérique reçoit ces IDs. |
| 05 | Adresse ou grandeur ? | Permuter les IDs tout en gardant la table cohérente. La sortie ne bouge pas. | Distinguer adresse et vecteur paramétré. |
| 06 | Lire une ligne | Ouvrir la table E, cliquer `chat`, afficher lookup direct et produit one-hot × E, même résultat. | Obtenir un vecteur de nombres par token. |
| 07 | Géométrie avant/après | Afficher les vecteurs initiaux et entraînés ; faire une rotation commune de E et des lecteurs, vérifier les logits. | Ne pas attribuer un sens humain fixe aux axes. |
| 08 | Pourquoi l'ordre ? | Permuter `chat` et `chien` dans une courte suite ; couper/rétablir les vecteurs de position sur la même architecture. | L'entrée devient token + position. |
| 09 | Un lecteur numérique | Cliquer une coordonnée : entrée × poids → contribution ; sommer et ajouter le biais. Modifier un poids temporairement. | Le neurone produit un score calculé. |
| 10 | Pourquoi une activation ? | Désactiver tanh dans un petit MLP ; comparer une transformation composée et sa réduction linéaire. | Plusieurs neurones peuvent transformer les représentations. |
| 11 | Plusieurs neurones | Ouvrir deux neurones cachés et leurs quatre entrées, puis leur combinaison en sortie. | Demander d'où viennent les poids utiles. |
| 12 | Une mauvaise prédiction | Geler le modèle initial sur une paire du corpus. Montrer logits, softmax, cible et cross-entropy. | La perte donne un critère de correction. |
| 13 | Toucher un poids | Perturber un seul paramètre de ±ε ; afficher la perte de chaque branche et la pente mesurée. | Le signe du gradient acquiert un sens observable. |
| 14 | Retour par le graphe | Ouvrir un sous-graphe minuscule complet (produit, somme, softmax à 2 sorties, perte) ; multiplier les dérivées locales. Comparer au gradient numérique. | La rétropropagation n'est plus une boîte noire. |
| 15 | Une mise à jour | Exécuter une étape réelle, montrer ancien poids, gradient, taux, nouveau poids, perte avant/après. | Répéter sur le corpus. |
| 16 | Une courbe d'entraînement | Lancer 1, 10 ou 100 époques ; courbe de perte et prédictions du même préfixe. Afficher aussi les échecs éventuels. | Les embeddings et matrices ont acquis une utilité par correction. |
| 17 | Le contexte qui manque | Désactiver le mélange avec les positions précédentes. Comparer les logits de `chat` et `chien`. | Chercher une lecture dépendante de la position. |
| 18 | Inventer la recherche | La position finale doit comparer son besoin avec les autres positions, puis récupérer une information. Cliquer trois rôles avant de nommer Q/K/V. | Les trois projections deviennent motivées. |
| 19 | Q, K, V en nombres | Cliquer un produit dans XWq, XWk ou XWv ; afficher les entrées, poids et somme. | Obtenir les trois matrices de la même trace. |
| 20 | Matrice d'attention | Inspecter QKᵀ, division par √d, masque triangulaire, softmax par ligne, puis somme pondérée des V. | Une tête a une sortie par position. |
| 21 | Deux têtes | Montrer les deux cartes et contributions du modèle ; masquer une tête avec les poids figés. | Comprendre la concaténation et la projection de sortie. Ne pas prêter une fonction linguistique stable à une tête sans preuve. |
| 22 | Une couche | Suivre résidu, normalisation, MLP, second résidu et normalisation à une position. | Obtenir une représentation transformée. |
| 23 | Deux couches | Envoyer la sortie du premier bloc dans le second. Désactiver le second et comparer les distributions. | Voir que les blocs se composent réellement. |
| 24 | Un tour complet | Animer le préfixe exact jusqu'aux logits, softmax et token choisi ; tout nombre renvoie à son écran de calcul. | Générer encore un token. |
| 25 | Génération | Ajouter le token choisi au préfixe, recommencer avec le masque causal ; tester argmax, température, échantillonnage. | Expliquer la séquentialité de la génération. |
| 26 | Entraîner toutes les positions | Cliquer chaque paire `préfixe → token suivant` d'une phrase ; afficher la perte moyenne du lot, puis l'étape de l'optimiseur. | Comprendre teacher forcing et préentraînement. |
| 27 | Changer d'échelle | Faire varier données, paramètres et budget dans un graphique de mesures réelles/sources, distinct de nos quelques entraînements jouets. | Distinguer une tendance empirique d'une loi absolue. |
| 28 | Adapter sans mise à jour | Introduire une règle nouvelle dans le prompt, constater que la distribution peut changer pendant que le hash des paramètres reste identique. | Distinguer contexte, apprentissage des poids et mémoire persistante. |
| 29 | Peut-on appeler cela raisonnement ? | Confronter des observations, interprétations et hypothèses sourcées. Changer de métrique pour voir une « émergence » apparente. | Formuler ce qui reste inconnu sans explication magique. |
| 30 | Micromonde final · générateur | Choisir objets, propriétés, relations et règles ; générer un jeu de données contrôlé avec graine et partitions explicites. | Savoir précisément ce qui a été vu. |
| 31 | Micromonde final · expériences | Lancer recombinaison, règle en contexte, négation, changement de règle et décalage de distribution. Comparer réponses, perte et exactitude des partitions. | Examiner mémorisation, généralisation et adaptation. |
| 32 | Synthèse active | Suivre un token du texte jusqu'au score et refaire le trajet inverse vers le gradient. Expliquer un succès et un échec du micromonde. | Répondre à la question initiale avec les opérations réelles. |

Les quatre premiers jalons testables regroupent les briques d'entrée, de score et d'entraînement du modèle moyen, puis une enquête sur l'ordre et une exécution avant de l'attention dans **quatre leçons guidées** ; le tableau de 32 écrans ci-dessus reste le storyboard global du cours, pas un inventaire de leçons actuellement accessibles. Certaines expériences plus avancées du tableau (rotation des bases, dérivation complète du bloc causal, entraînement de l'attention) ne sont pas encore implémentées.

## Mini-modèle principal : contrat vérifiable

Vocabulaire contrôlé de 12 tokens : `<début>`, `le`, `un`, `chat`, `chien`, `mange`, `regarde`, `la`, `souris`, `pomme`, `dort`, `.`. Tout token hors vocabulaire est refusé explicitement ; le tokenizer de démonstration met en minuscules, sépare espaces et ponctuation. Une unité n'est ici pas un sous-mot : cette simplification est visible.

Corpus actuel : dix phrases **uniques** : `un chat mange la souris .`, `un chat regarde la souris .`, `le chat regarde la souris .`, `le chien mange la pomme .`, `un chien mange la pomme .`, `le chien regarde la pomme .`, puis quatre phrases `le/un chat/chien dort .`. Le préfixe test `le chat mange la` n'apparaît jamais ; le témoin par comptage exact doit donc répondre « aucune donnée », pas « souris : 0 % ». Un second comptage transparent utilise seulement le sujet et le mot `la` : il montre des indices partiels, mais n'est pas présenté comme la probabilité du préfixe complet. Après 100 époques, le modèle moyen reste susceptible d'échouer ; après 500 époques sur la graine fixée, le test vérifie qu'il choisit `souris` sur le préfixe absent. Cette réussite locale ne prouve ni une compréhension du langage ni une généralisation robuste.

Architecture **actuelle** : E de largeur 4 → moyenne des lignes du préfixe → W de taille 4×12 et biais de 12 valeurs → softmax. La moyenne ne voit pas l'ordre. Architecture **cible, non implémentée** : conserver E et le lecteur de sortie tout en ajoutant positions et blocs causaux ; largeur 4, longueur maximale 8, deux blocs post-norm, chacun avec deux têtes de dimension 2 pour Q/K/V, projection de concaténation, chemin résiduel, normalisation et MLP 4→6→4. Les ablations devront figer les mêmes paramètres. Ces choix sont pédagogiques et ne prétendent pas reproduire tous les GPT.

Initialisation : graine fixe 23, petite plage symétrique, biais de sortie nuls ; le moteur expose le nombre exact derrière chaque cellule. Un checkpoint désigne la graine, le corpus, l'architecture, les hyperparamètres et le nombre d'étapes. Les valeurs initiales et entraînées sont présentées séparément. Avant d'ajouter un nombre au storyboard, un test doit vérifier qu'il est celui que calcule le moteur. Un exemple de référence sera gelé après la première implémentation du moteur, pas inventé dans ce document.

Entraînement : toutes les positions d'une phrase fournissent une cible de prochain token. Perte cross-entropy moyenne, rétropropagation et pas d'optimiseur exécutés dans le navigateur. Le choix de lots, la correction et les éventuelles limites de calcul sont visibles. À l'inférence, le même moteur ne reçoit aucune cible et ne met aucun poids à jour. Les courbes et distributions sont des mesures des vrais checkpoints.

## Micromonde final

Générateur déterministe, indépendant du texte animalier mais utilisant la même architecture de mini-décodeur réinitialisée. Dans une première version mesurable : créatures artificielles (`dax`, `mip`, `lor`), couleurs (`rouge`, `bleu`), formes (`rond`, `carré`), relation `possède`, règle `rouge → ouvre porte`. Chaque échantillon possède faits, question, réponse logique calculée par un évaluateur symbolique **séparé** et partition d'entraînement ou de test. Les mots inconnus doivent être intégrés à un vocabulaire explicite avant l'entraînement.

Partitions : A recombinaison d'objet/propriété absent comme paire ; B règle donnée seulement dans le prompt ; C renommage systématique du mini-langage ; D règle inversée ; E décalage de fréquence. Afficher nombre exact d'exemples, taux de réussite par partition et exemples d'erreurs. Le modèle-jouet peut échouer ; on cherche les limites mesurées. La réussite à une règle uniquement dans le prompt ne doit pas être annoncée avant d'avoir testé ce comportement sur le moteur, dont la taille risque d'être insuffisante.

## Composants réutilisables

- `MachineMap` : trajet visible, mêmes objets sur tous les écrans.
- `TraceCell` / `MatrixInspector` : provenance numérique sur clic, dimensions, statut paramètre ou activation.
- `TriView` : intuition, nombres/formule et code synchronisés par la même sélection.
- `WhySwitch` : ablation des positions, tête, bloc ou MLP avec mêmes poids.
- `PredictionBars` : scores, probabilités et décisions ; distinction compte/témoin et modèle entraîné.
- `TrainingTimeline` : pertes mesurées, checkpoints, curseur avant/après.
- `EvidenceCard` : observation, interprétation, hypothèse, question ouverte, source primaire.
- `WorldGenerator` : générateur, oracle logique, partitions et résultats réels.

Conserver de la V1 : Angular et son style général, la structure de progression locale, certaines visualisations de distribution, l'idée d'une cellule cliquable et les principes de test numérique. Refaire : navigation, narration, moteur et tracé, statut des valeurs, laboratoire final. Supprimer de la V2 : exemples notes/spam/XOR, enchaînement de modèles indépendants, questions de validation triviales et affirmations qu'un schéma conceptuel est un calcul exécuté. La V1 reste intacte comme parcours alternatif.

## Garde-fous scientifiques

- Le [Transformer original](https://arxiv.org/html/1706.03762v7) décrit attention multi-têtes, masquage du décodeur, positions et blocs ; notre mini-décodeur est une variante pédagogique et doit être nommé ainsi.
- Les [lois d'échelle de Kaplan et al.](https://arxiv.org/abs/2001.08361) et l'étude [Chinchilla](https://arxiv.org/abs/2203.15556) portent sur des mesures empiriques et l'allocation du calcul. Nos 10 phrases ne peuvent pas les démontrer.
- [Wei et al.](https://arxiv.org/abs/2206.07682) décrivent des capacités dites émergentes ; [Schaeffer et al.](https://arxiv.org/abs/2304.15004) montrent qu'une métrique discontinue peut créer une apparence de seuil. Présenter le débat et les métriques.
- [Olsson et al.](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/) étudient des circuits d'induction dans des modèles précis. Ce résultat ne suffit pas à expliquer tout l'apprentissage en contexte des LLM.
- Les performances de [chain-of-thought prompting](https://arxiv.org/abs/2201.11903) sont observées sur certaines tâches. Elles ne prouvent pas, à elles seules, une théorie unique du raisonnement interne.
