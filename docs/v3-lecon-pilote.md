# Pilote V3 — Comment des réglages numériques apprennent-ils à prédire un mot ?

Date : 2 octobre 2026. Statut : spécification pédagogique ; pilote interactif désormais implémenté sur `/v3`.

## Contrat du pilote

Ce pilote remplace pédagogiquement la jonction entre les leçons 1 et 2. Il ne suppose pas que le lecteur connaît les embeddings, les logits, le softmax, une loss ou la rétropropagation. Il suppose seulement additions, multiplications, proportions et notions de fonction.

Question continue : **comment notre machine pourra-t-elle proposer « souris » après « le chat mange la » sans avoir appris ce préfixe exact ?**

Nous allons ouvrir ses réglages, reconstruire une prédiction, puis comprendre une correction. Ce premier modèle ignore encore l'ordre. Nous ne prétendrons ni avoir construit un GPT complet ni que réussir un test proche suffit à établir une compréhension du langage.

Toutes les valeurs ci-dessous proviennent de `MiniLanguageModel`, état initial, graine 23, largeur 4. Les valeurs affichées sont arrondies ; le moteur conserve sa précision. Les interventions ne changent que le paramètre annoncé. Le scénario guidé a son état indépendant du laboratoire sauvegardé du lecteur.

## Scène 1 — Ce que les données nous permettent de demander

### Texte du parcours

« Voici les dix phrases dont notre programme pourra apprendre. Il n'a pas accès à toutes les phrases françaises. Sa réponse devra dépendre des régularités de ce petit ensemble, pas d'un savoir que nous lui aurions caché. »

1. un chat mange la souris .
2. un chat regarde la souris .
3. le chat regarde la souris .
4. le chien mange la pomme .
5. un chien mange la pomme .
6. le chien regarde la pomme .
7. le chat dort .
8. le chien dort .
9. un chat dort .
10. un chien dort .

« Notre question test est “le chat mange la …”. Aucune de ces lignes ne commence exactement ainsi. Cependant, plusieurs lignes contiennent des indices proches. Le programme réussira-t-il à les exploiter ? Nous le mesurerons, sans lui fournir cet exemple test pendant ses corrections. »

### Visuel et tâche

Le corpus est la représentation principale. Le lecteur sélectionne les fragments partagés avec le test dans les lignes 1 et 3, puis identifie ce qui diffère. Le feedback montre précisément les tokens communs et différents ; il ne conclut pas encore à une prédiction certaine.

### Transition

« Pour comprendre comment il apprend, examinons d'abord un exercice dont la réponse est présente dans les données. Nous reviendrons ensuite au test. »

## Scène 2 — Un exercice d'entraînement n'est pas une phrase donnée avec sa réponse

### Texte du parcours

« Prenons la première ligne. Nous la coupons juste avant “souris”. Le programme reçoit seulement “un chat mange la”. Il doit répartir ses chances entre les prochains tokens possibles. Nous gardons “souris” à part : c'est la réponse observée dans cette ligne, que nous utiliserons après la prédiction pour évaluer le programme. On l'appelle la **cible**. »

« À partir de la même phrase, nous pouvons aussi poser “un chat” → “mange”, ou “un chat mange” → “la”. Chaque coupure fournit un nouvel exercice : un préfixe visible, un token suivant gardé à part. »

### Visuel et tâche

Une phrase coupée par une cloison. À gauche : l'entrée. À droite : la cible, masquée pendant l'exécution puis révélée. Le lecteur place la coupure avant “la” et sélectionne la cible correspondante. Une erreur déclenche une explication de la différence entre dernier token reçu et prochain token à prédire.

### Transition

« Nous avons défini le problème. Regardons maintenant comment le programme représente les tokens qu'il reçoit. »

## Scène 3 — Un numéro pour retrouver un token, pas pour lui donner un sens

### Texte du parcours

« Ici, notre découpage est volontairement simple : chaque mot et le point constituent un token. Un vrai tokenizer peut découper autrement ; ce détail ne change pas l'opération que nous allons observer. »

« Nous rangeons les douze tokens connus dans une liste. Le numéro est leur adresse dans cette liste : “un” a l'ID 2, “chat” l'ID 3. Si nous changeons leur rangement et toutes les références correspondantes, le comportement ne doit pas changer. L'ID 3 ne signifie donc pas “trois unités de chat”. »

« Le moteur ajoute aussi le token spécial `<début>`. Il marque le début du texte ; il n'est pas un mot que tu avais écrit. Notre entrée contient ainsi cinq tokens : `<début>`, `un`, `chat`, `mange`, `la`. »

### Visuel et tâche

Cliquer “chat” relie ce mot à la case 3 de la liste. Un scénario de permutation des adresses, explicitement distinct d'une modification des paramètres, fait anticiper si le comportement doit changer. Ne pas dessiner une flèche “3 devient −0,167” : le numéro sert à **sélectionner** une cellule.

### Transition

« Une adresse permet de retrouver une entrée. Quel contenu allons-nous ranger à cette adresse pour pouvoir ajuster la prédiction ? »

## Scène 4 — Une fiche de nombres modifiables par token

### Texte du parcours

« Un développeur pourrait ranger, pour chaque token, une fiche contenant des nombres modifiables, puis écrire une fonction qui utilise ces fiches pour calculer sa réponse. C'est le choix de notre premier modèle. Il existe d'autres solutions, notamment des tables de scores directs ; nous ne prétendons pas que celle-ci soit la seule possible. »

« Pour “chat”, la fiche initiale est : `[−0,167 ; 0,111 ; −0,097 ; −0,106]`. Cette liste est ce que nous appelons un **vecteur**. Chacun de ses quatre nombres est une **coordonnée**. Pour le moment, ce ne sont pas quatre qualités du chat. Ce sont quatre réglages que le programme utilisera dans ses calculs. »

« Pourquoi quatre ? Parce que nous avons choisi un petit modèle qui manipule quatre nombres par token, assez petit pour être inspecté. Ce n'est ni une propriété du mot ni un nombre déduit du corpus. Un modèle à deux coordonnées serait un autre modèle, avec d'autres possibilités et d'autres contraintes. »

« D'où viennent les valeurs ? Avant tout apprentissage, un générateur reproductible a rempli les fiches avec de petites valeurs entre −0,2 et 0,2. La graine 23 identifie ce tirage pour que nous puissions refaire l'expérience. 23 n'est pas un score du chat et les valeurs initiales ne codent aucun sens prédéfini. L'entraînement devra ensuite rendre ces réglages utiles. »

« La table qui rassemble les douze fiches s'appelle **E**, la table d'embeddings. Douze tokens, quatre nombres par fiche : douze lignes et quatre colonnes. Lire `E[3]` signifie prendre la fiche du token d'ID 3. Nous n'avons pas calculé un vecteur à partir de la valeur 3. Nous l'avons lu dans une table. »

### Visuel et tâche

Révéler les phrases ci-dessus en trois temps sur le même visuel : fiche → nombre de cases choisi → table. Le lecteur choisit “mange”, retrouve sa fiche et distingue la cellule stockée de la copie lue pour cette exécution. Il identifie “valeur initiale” versus “valeur apprise”, sans attribuer une signification humaine à la coordonnée.

### Transition

« Nous savons ce que ces nombres sont, mais pas encore comment ils influencent une réponse. Nous allons suivre la première coordonnée jusqu'au score de “souris”. »

## Scène 5 — Pourquoi fabriquer un résumé, et pourquoi essayer une moyenne ?

### Texte du parcours

« Notre sortie devra fabriquer un score pour chaque réponse possible. Pour ce premier essai, nous choisissons une petite fonction qui reçoit exactement quatre nombres, même si la phrase a cinq ou huit tokens. Nous devons donc lui construire une entrée de taille fixe. »

« Nous pourrions mettre toutes les fiches bout à bout, mais leur longueur totale dépendrait du nombre de tokens. Nous pourrions les additionner colonne par colonne ; répéter une entrée doublerait alors sa contribution totale. Nous essayons ici une moyenne : chaque colonne fournit un nombre moyen. Elle accepte un nombre variable de fiches et conserve quatre sorties. C'est un choix simple à tester, pas la recette générale des LLM. »

« Pour la colonne 1, les cinq valeurs lues sont : »

```text
<début>   −0,102
un        −0,117
chat      −0,167
mange     −0,032
la        −0,168
          ──────
somme     −0,586
÷ 5       −0,1172
```

« Le −0,1172 n'est pas un réglage supplémentaire. Il vient d'être **calculé** pour cette entrée. Si la phrase ou une fiche change, il sera recalculé. Nous appellerons ce nombre `c₁` : première coordonnée du contexte résumé. »

### Visuel et tâche

Les cinq cartes contribuent à une addition, puis à une division. Dans le deuxième essai, masquer seulement le résultat de la somme et de la division : le lecteur les complète. Rappeler les signes en cas d'erreur, puis retirer l'aide à nouveau.

### Transition

« Nous avons quatre valeurs résumées. Comment une fonction peut-elle les utiliser différemment pour proposer “souris” ou “pomme” ? »

## Scène 6 — Un poids est un coefficient dans une fonction que l'on peut régler

### Texte du parcours

« Une première façon simple de calculer le score de “souris” est de donner à chaque coordonnée un coefficient, de multiplier, puis d'additionner les résultats. Le coefficient décide comment cette coordonnée intervient dans **ce score**. On appelle ce coefficient un **poids**. »

« Notre première coordonnée vaut −0,1172. Le poids initial qui la relie au score de “souris” vaut 0,047. Il est stocké dans une seconde table, W. Sa valeur provient du même tirage initial que les autres poids ; personne ne l'a choisi pour obtenir “souris”. »

```text
valeur calculée pour cette phrase     réglage stocké pour cette sortie
              −0,1172         ×                0,047
                                       ↓
                        contribution = −0,0055084
```

« Pourquoi multiplier ? Cela nous donne une règle ajustable très simple. Si le coefficient vaut zéro, cette coordonnée n'apporte rien à ce score. Si nous changeons le coefficient, nous changeons l'importance et éventuellement le sens de sa contribution. Mais attention : le résultat dépend **aussi du signe de l'entrée**. »

### Visuel et tâche

Avant résultat, demander : « Si le poids passe de 0,047 à 0,147, la contribution augmente-t-elle ou diminue-t-elle ? » Le lecteur choisit un sens et explique avec les signes. Puis exécuter le vrai produit. Si l'erreur est « plus grand poids = meilleur score », montrer les deux produits sur un axe signé : −0,0055084 et −0,0172284.

La formalisation arrive ensuite : `contribution = c₁ × w₁`. Chaque symbole reste relié à sa cellule d'origine.

### Transition

« Nous avons une contribution. Une contribution seule n'est pas encore le score total : les trois autres coordonnées participent elles aussi. »

## Scène 7 — Quatre contributions et un biais font un score

### Texte du parcours

« Nous répétons le même calcul pour les autres coordonnées. Il n'y a pas de nouvelle opération : seulement d'autres entrées et d'autres coefficients. »

```text
coordonnée 1 : −0,1172 ×  0,047 = −0,0055084
coordonnée 2 :  0,0292 × −0,194 = −0,0056648
coordonnée 3 :  0,0184 × −0,039 = −0,0007176
coordonnée 4 :  0,0184 × −0,184 = −0,0033856
                                     somme = −0,0152764
```

« Nous pouvons aussi ajouter un réglage indépendant de la phrase : le **biais** de cette sortie. Ici, sa valeur initiale est zéro. Un biais plus grand augmenterait le score de “souris” pour toutes les entrées, pas uniquement les phrases sur les chats. »

« Le score brut ainsi obtenu s'appelle un **logit**. “Pomme” et chacun des dix autres tokens possèdent leurs propres quatre poids et leur propre biais. Ils utilisent le même résumé mais peuvent en faire d'autres scores. »

« La table W range donc quatre coefficients pour chacune des douze sorties : quatre lignes et douze colonnes dans notre code. Sa forme correspond au calcul choisi ; elle n'est pas dictée par l'orthographe des mots. »

### Visuel et tâche

Afficher une contribution à la fois puis les rassembler. Le lecteur reconstitue la somme avant de la révéler. Ensuite il change seulement le biais dans un essai temporaire et anticipe ce qui reste identique : fiches lues et résumé.

Introduire la notation compacte seulement après : `score(souris) = c₁w₁ + c₂w₂ + c₃w₃ + c₄w₄ + b`. Le produit scalaire est le nom de la somme des produits correspondants. Une sortie affine de ce type est une brique neuronale ; une activation et un réseau plus riche seront étudiés ensuite, pas supposés déjà compris.

### Transition

« Un score peut être négatif. Comment obtenir une répartition de chances entre toutes les réponses possibles ? »

## Scène 8 — Une probabilité est une part d'un total partagé

### Texte du parcours

« Nous avons douze scores, pas douze pourcentages. Pour obtenir des parts positives qui totalisent un, notre modèle applique une fonction précise : il transforme chaque score s en `exp(s)`, puis divise chaque résultat par leur somme. Cette fonction s'appelle **softmax**. »

« L'exponentielle conserve l'ordre des scores et donne toujours un résultat positif, même pour un score négatif. Elle est un choix de modèle, pas la seule fonction positive imaginable. Ici, l'important est de suivre ce qu'elle calcule et comment les candidats se partagent le total. »

```text
score(souris)                         −0,0152764
exp(score(souris))                     0,98483969
somme des exp des onze autres scores  11,08131713
total                                12,06615682
part de souris = 0,98483969 / 12,06615682 ≈ 0,08162 = 8,162 %
```

« “Souris” reçoit donc environ 8,162 % pour notre exercice. Le modèle répartit presque uniformément ses chances entre les douze tokens : nous n'avons pas encore appris des réglages utiles. »

### Visuel et tâche

Une barre de total partagée entre les douze candidats, suivie d'un zoom sur souris. Les onze autres restent visibles comme groupe et sont dépliables ; ils ne disparaissent pas du dénominateur.

Le lecteur augmente uniquement le score de pomme et prédit l'effet sur P(souris). Feedback : même si le score de souris reste fixe, sa part diminue lorsque le total concurrent augmente. Ensuite formaliser la fraction générale.

La soustraction du score maximal, présente dans le code pour stabilité numérique, vient dans un détail **après** la fraction : factoriser `exp(−max)` au numérateur et au dénominateur montre pourquoi les parts sont identiques. Ce n'est pas une étape conceptuelle supplémentaire imposée avant la première compréhension.

### Transition

« Nous pouvons maintenant révéler la cible du corpus. Comment noter cette répartition, puis améliorer ses réglages ? »

## Scène 9 — Définir la mesure d'erreur avant d'afficher son résultat

### Texte du parcours

« La réponse observée est “souris”. Le modèle lui a donné 8,162 %. Nous voulons une mesure faible lorsqu'il lui donne une forte probabilité et forte lorsqu'il lui en donne peu. Il faut aussi pouvoir mesurer de petites améliorations : passer de 8 % à 9 % compte, même si le candidat gagnant ne change pas. »

« Le choix utilisé ici est le négatif du logarithme naturel de la probabilité donnée à la cible : `L = −ln(p)`. p désigne P(souris), un nombre entre zéro et un. L est la **perte**, aussi appelée loss. Pour une cible unique, il s'agit de la cross-entropy. »

« À p = 1, L = 0. À p = 0,5, L vaut environ 0,693. À p = 0,1, L vaut environ 2,303. Très peu de probabilité pour la cible donne donc une pénalité forte. Dans notre calcul réel : `−ln(0,081619998) ≈ 2,505681`. »

« Pourquoi cette fonction plutôt qu'une note “bon/mauvais” ? Elle donne une mesure différentiable et distingue les petites variations de confiance. Le logarithme permet aussi de convertir le produit des probabilités de plusieurs réponses observées en une somme de pertes. D'autres objectifs existent ; nous allons apprendre à optimiser celui-ci. »

### Visuel et tâche

Courbe p → L, avec le point du calcul réel. Un slider hypothétique, clairement séparé du modèle, permet de vérifier la relation. Ne pas cacher la définition de L dans un panneau facultatif.

Le lecteur associe une probabilité plus élevée à une perte plus faible puis revient au point réel. La courbe n'est pas encore celle de la perte en fonction d'un poids : ses axes sont explicitement différents.

### Transition

« Nous avons défini ce que “mieux” veut dire sur cet exercice. Essayons une intervention dont nous connaissons chaque maillon. »

## Scène 10 — Modifier un poids, reconstruire l'effet jusqu'à la perte

### Texte du parcours

« Revenons à notre poids 0,047, qui multiplie l'entrée négative −0,1172. Tous les autres paramètres restent fixes. Augmenter ce poids diminue sa contribution, donc le score de souris. Les autres scores ne changent pas. La part de souris diminue, et sa perte augmente. Nous pouvons prévoir ce résultat avant de l'exécuter. »

« Diminuer ce poids fait l'inverse pour cet exercice. Cela ne veut pas dire que diminuer tous les poids aide, ni que ce changement sera bon pour toutes les phrases. »

| Essai temporaire | Poids | Score souris | P(souris) | Perte |
| --- | ---: | ---: | ---: | ---: |
| Diminuer de 0,1 | −0,053 | −0,0035564 | 8,2503 % | 2,494923 |
| État initial | 0,047 | −0,0152764 | 8,1620 % | 2,505681 |
| Augmenter de 0,1 | 0,147 | −0,0269964 | 8,0746 % | 2,516450 |

### Visuel et tâche

Le tableau ci-dessus est la référence de l'auteur ; l'interface révèle chaque résultat **après** l'anticipation. Un graphe unique garde la chaîne `c₁ × w₁ → score → probabilité → perte`. Le lecteur fait avancer le changement de gauche à droite, puis explique quels objets n'ont pas changé.

Une seconde tentative porte sur la coordonnée 2, dont l'entrée est positive 0,0292. La réponse n'est pas affichée d'avance. Le feedback corrige le raisonnement, pas seulement le choix final.

### Transition

« Notre essai trouve une direction utile. Peut-on mesurer précisément l'effet d'un tout petit changement près du réglage actuel ? »

## Scène 11 — La dérivée nomme une sensibilité que nous pouvons mesurer

### Texte du parcours

« Nous calculons L deux fois, en faisant varier seulement ce poids de 0,0001. Pour comparer des effets avec des pas différents, nous divisons la variation de perte par la distance entre les deux poids testés. »

```text
L(w − 0,0001) = 2,5056702133
L(w + 0,0001) = 2,5056917402
distance entre les poids = 0,0002
pente mesurée ≈ (2,5056917402 − 2,5056702133) / 0,0002
              ≈ +0,107634
```

« Une pente positive signifie : près de ce point, augmenter w augmente L. Pour réduire L, nous allons donc essayer un petit déplacement négatif. La dérivée est la sensibilité locale obtenue à la limite lorsque le pas devient très petit. Les différences finies ci-dessus en donnent une approximation. »

« Pour ce paramètre, la dérivée est une composante du **gradient**. Le gradient rassemble les sensibilités de la perte à chacun des paramètres, pas un unique coefficient de réussite globale. »

### Visuel et tâche

Courbe L en fonction de **w**, avec unités et valeurs sur les axes, les deux points proches et la pente. Le lecteur reconstruit le dénominateur 0,0002 ; une erreur “0,0001” est expliquée par les deux déplacements opposés.

### Transition

« Deux exécutions pour un paramètre sont abordables. Deux exécutions pour chaque réglage deviendraient très coûteuses. Peut-on calculer les mêmes sensibilités à partir des opérations déjà exécutées ? »

## Scène 12 — Remonter les effets, une opération à la fois

### Texte du parcours

« Pour le poids étudié, il n'y a qu'un chemin : w modifie une contribution, qui modifie le score de souris, qui modifie sa probabilité, qui modifie sa perte. On peut connaître la sensibilité de chaque opération et les composer. »

« L'addition transmet une petite variation de la contribution au score sans la changer. La multiplication par c₁ = −0,1172 transforme une variation Δw en une variation −0,1172 × Δw du score. Cette règle explique déjà le signe observé. »

« La relation probabilité → perte a pour sensibilité `−1/p`. À notre point, elle vaut environ −12,251899. La relation score → probabilité, tous les autres scores fixes, a pour sensibilité `p(1−p)`, environ 0,074958. En composant les deux, l'effet score → perte vaut `−(1−p)`, soit `p−1 = −0,918380`. »

« Nous multiplions enfin par l'effet poids → score, −0,1172 : »

```text
sensibilité de L au score          −0,9183800023
sensibilité du score au poids      −0,1172
sensibilité de L au poids          +0,1076341363
```

« Nous retrouvons la pente que les deux essais avaient mesurée. La **rétropropagation** applique cette composition en remontant le graphe de calcul. Elle ne devine pas comment corriger les paramètres ; elle calcule leurs effets. »

### Enseignement nécessaire avant le calcul autonome

La formule `p(1−p)` ne doit pas arriver comme un résultat à mémoriser. La scène comporte des révélations successives sur le même graphe :

1. L'exponentielle de notre score vaut u ; la somme des exponentielles des onze autres scores vaut R, fixe pendant cette intervention.
2. On a donc `p = u / (u + R)`. Dériver cette fraction par rapport à u donne `R / (u + R)²` ; montrer l'application de la règle du quotient, avec chaque terme nommé.
3. Comme `u = exp(s)`, sa dérivée par rapport à s vaut u. Composer donne `uR / (u + R)² = p(1−p)`.
4. Dériver `−ln(p)` donne `−1/p`. Relier ce signe à la courbe vue précédemment.
5. Multiplier les effets le long du chemin, puis vérifier le résultat par différences finies.

Si la règle de dérivation du quotient ou de ln/exp n'est pas connue, offrir une explication préparatoire, pas demander de croire la formule. La lecture intuitive des sensibilités reste sur le parcours principal ; le lecteur qui veut reconstruire la dérivée doit pouvoir le faire ici, sans chercher un autre cours.

### Visuel et tâche

Conserver les valeurs forward sur les nœuds, ajouter les sensibilités backward sous les mêmes nœuds. Révéler un maillon par clic. Le lecteur complète d'abord la sensibilité de la multiplication, puis le signe du produit des sensibilités, puis un calcul avec moins d'aide.

Ne pas appeler ceci « toute la rétropropagation du modèle » : nous avons reconstruit le gradient d'un poids de sortie. Pour une coordonnée de E, plusieurs sorties dépendent de la même valeur ; leurs effets s'additionnent avant de remonter la moyenne. Montrer ensuite cette bifurcation, une sortie supplémentaire à la fois, avant de demander au lecteur de comprendre le gradient de toute E.

### Transition

« Nous savons calculer l'effet local. Il reste à décider la taille de la correction et à tenir compte des autres exercices. »

## Scène 13 — Une correction précise, puis les limites d'un seul exercice

### Texte du parcours

« Pour cet essai, nous choisissons un pas d'apprentissage η = 0,7. C'est un réglage de l'expérience, pas une constante de la théorie. Nous faisons un déplacement opposé à la sensibilité : »

```text
nouveau poids = ancien poids − pas × sensibilité
             = 0,047 − 0,7 × 0,1076341363
             ≈ −0,0283438954
```

« En recalculant la même paire et en laissant tout le reste fixe, P(souris) passe d'environ 8,1620 % à 8,2284 %, et la perte de 2,505681 à 2,497574. L'amélioration est petite, mais nous savons exactement d'où elle vient. Ce n'est pas encore la procédure d'entraînement complète. »

« Ce poids intervient aussi pour d'autres préfixes, parfois lorsque souris n'est pas la cible. Une direction bonne pour notre exercice peut être mauvaise pour un autre. Le vrai entraînement calcule les gradients sur toutes les paires du corpus, les moyenne dans ce moteur, puis corrige E, W et les biais. »

« Notre paire connue commence par “un”. Le test commence par “le”. Les réglages étant partagés, une correction peut influencer les deux prédictions, mais le test ne fournit aucun gradient. Nous mesurons son résultat séparément. »

### Visuel et tâche

Le lecteur complète la correction avant de l'appliquer. Retour possible au checkpoint de référence. Puis comparer une paire souris et une paire pomme : montrer deux gradients du même poids et leur moyenne, sans supposer le signe d'avance.

Entraîner une époque entière seulement après cette comparaison. Montrer une mise à jour réelle précise, l'évolution de la perte moyenne et le test distinct. Ne pas conclure à une amélioration garantie à chaque pas ou sur le test.

### Transition

« Nous avons appris des réglages partagés, mais notre moyenne traite les mots comme une collection sans ordre. Quelle information a-t-elle perdue ? » Cette question ouvre l'expérience de permutation déjà pertinente dans la leçon 3.

## Validation finale — Reconstruction sans les réponses affichées

Le pilote ne se termine pas par « tu as cliqué sur entraîner ». Il propose quatre interventions, avec aide à la demande et feedback après engagement :

1. Un préfixe ne contient pas chien. Modifier uniquement sa ligne E change-t-il immédiatement cette prédiction ? Expliquer quelles lignes sont lues. Préciser que, dans ce moteur, E et la projection de sortie ne partagent pas leurs paramètres.
2. Dans notre exercice, modifier le poids de la coordonnée 2 vers le haut : prévoir contribution, score, probabilité et perte. Justifier avec l'entrée positive, pas avec une règle mémorisée sur la coordonnée 1.
3. Augmenter seulement le score de pomme : expliquer pourquoi P(souris) peut changer alors que son propre score reste fixe.
4. Reconstituer une correction à partir d'une sensibilité négative fournie sur un autre paramètre, puis identifier ce qui relève des données, des paramètres et des valeurs calculées.

Ensuite, demander une explication en mots de la chaîne complète. La réponse attendue parle de lecture d'une table, moyenne choisie, produits pondérés, scores concurrents, normalisation, cible gardée à part, mesure d'erreur et correction. Ne pas valider une réponse « les vecteurs comprennent que le chat mange une souris ».

Sauvegarder les tentatives et le niveau d'aide indépendamment du checkpoint du laboratoire. Navigation libre et reprise possibles ; ne pas forcer à refaire les expériences déjà maîtrisées.

## Détail facultatif après le lookup — Où intervient le one-hot ?

« Nous avons lu la ligne 3 de E. Une autre écriture du même choix consiste à fabriquer un vecteur de douze cases : zéro partout, un à l'index 3. Ce vecteur s'appelle one-hot. »

« Multiplier cette ligne de sélection par E revient à additionner douze lignes de E : toutes sont multipliées par zéro sauf celle de chat, multipliée par un. Le résultat est exactement la fiche déjà lue. »

```text
0 × E[0] + 0 × E[1] + 0 × E[2] + 1 × E[3] + … + 0 × E[11]
= E[3]
```

« Le one-hot n'a pas été comprimé pour produire par magie les quatre nombres. E était déjà la table de réglages. Nous venons de montrer que la sélection d'une ligne peut s'écrire comme un produit matriciel. »

## Exigences de réalisation

- Garder le même modèle 4D et le même checkpoint tout le long ; zoomer sur une coordonnée n'est pas tronquer le calcul.
- Une scène peut comporter plusieurs révélations sur le même schéma ; éviter de remplacer tout le décor à chaque clic.
- Les explications ci-dessus doivent être présentes. Le storyboard n'autorise pas à les remplacer par leurs titres ou par des formules seules.
- L'écran principal montre l'opération courante ; une barre compacte conserve le préfixe, la cible éventuelle, le checkpoint et la place dans le système.
- Le schéma utilise du texte, des signes, des axes et une convention stable donnée/paramètre/calcul, pas seulement des couleurs.
- Les animations sont des traces du moteur, arrêtables et rejouables ; les résultats ne sont jamais scénarisés pour obtenir une victoire.
- Les réponses, références numériques et explications de correction ne sont visibles qu'après une tentative ou une demande explicite d'aide.
- Le transfert validé, et non le nombre d'étapes, décide si cette méthode mérite d'être étendue aux leçons suivantes.

## Réalisation du pilote

Le parcours `/v3` comporte 16 scènes : les 13 scènes décrites ci-dessus, une scène dédiée aux chemins du gradient vers E, un laboratoire indépendant et un exercice final de transfert. Le corpus, les quatre coordonnées et le moteur `MiniLanguageModel` sont conservés. La V1 et la V2 restent accessibles ; seule une entrée vers la V3 a été ajoutée à la V2.

Les visualisations HTML/SVG montrent la sélection de ligne, les valeurs signées de la moyenne, les produits de sortie, le total du softmax, deux courbes aux axes différents, le même graphe forward/backward et les contributions des douze sorties vers E. Les opérations se révèlent à la demande, sans animation automatique ni nombres scénarisés.

Les interventions sur les poids et les scores utilisent des copies ou des recalculs isolés. Le scénario de référence reste initial même après l'entraînement du laboratoire. Les réponses et justifications sont demandées avant la révélation des interventions ; les exercices finaux changent le signe de l'entrée, la présence d'un token ou le score d'un concurrent. La justification textuelle n'est pas évaluée automatiquement.

La progression, les tentatives, les indices, le carnet, le checkpoint et l'historique du laboratoire utilisent exclusivement `gradient-lab-v3-pilot-v1`. Une erreur de stockage n'empêche pas de parcourir la leçon ; elle est signalée. Les sauvegardes V1/V2 ne sont pas migrées ni écrasées.

Le parcours est techniquement testable, mais son efficacité pédagogique reste à valider auprès du lecteur. La suite V3 sur les positions, l'attention et le Transformer n'est pas annoncée comme déjà réalisée ; le dernier écran expose précisément ce périmètre et donne un accès séparé à l'ancien parcours.

### Vérification du 2 octobre 2026

- Suite complète : 119 tests réussis, dont 29 nouveaux tests de calculs, reprise, isolation, questions et navigation V3.
- Build de production réussi sans avertissement de budget après chargement à la demande de chaque version ; charge initiale commune d'environ 259 kB.
- Les 16 scènes sont accessibles dans le navigateur, y compris sur une largeur de 390 pixels, sans débordement horizontal observé.
- Prévision justifiée → révélation → feedback et reprise après rechargement vérifiés dans l'interface.
- Une époque réelle fait passer la perte moyenne de 2,486520 à 2,469970, tandis que P(souris) sur le test passe d'environ 8,171 % à 8,023 %. L'interface montre cette divergence sans annoncer une amélioration garantie du test.
- Les calculs du scénario restent initiaux ; la V2 reprend toujours son ancien écran et possède un lien explicite vers la V3.

Ces vérifications établissent le fonctionnement technique et la fidélité des traces, pas une efficacité pédagogique démontrée.
