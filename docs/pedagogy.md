# Contrat pédagogique et périmètre réel

## Méthode

Une transition ne se justifie pas par « c’est ce que font les LLM ». Elle doit établir :

1. Le résultat déjà obtenu et la question encore sans réponse.
2. Le choix de modèle proposé, et au moins une alternative ou une limite.
3. L’origine des nombres : donnée, choix d’architecture/initialisation, paramètre appris, résultat calculé.
4. L’opération en mots avant sa notation, puis une substitution numérique sur le même exemple.
5. Une anticipation ou une intervention qui permet de vérifier un lien causal.
6. Ce que l’expérience établit, et ce qu’elle n’établit pas.

Les questions fermées et les tests techniques ne prouvent pas la compréhension de l’apprenant. Le critère pédagogique reste sa capacité à refaire et expliquer une opération sur un autre exemple. Ne pas annoncer une pédagogie « validée » parce que les tests automatisés passent.

## Leçon 5 : une enquête continue

Le corpus comporte sept contextes de deux mots, trois sorties et une combinaison réservée : `chat fatigué`. L’exemple de calcul est toujours `chien fatigué → dort`. Le corpus reste accessible dans le carnet.

Les douze chapitres suivent : problème → paramètres partagés → sélection d’une ligne → mélange → lecteurs → probabilités/perte → intervention locale → dérivation du gradient → entraînement collectif → géométrie → test → limites/attention.

- L’embedding est un dictionnaire de vecteurs paramétrés avant d’être présenté comme une matrice.
- Le one-hot est une écriture alternative de la sélection de ligne. Ce n’est ni une étape obligatoire exécutée par le moteur, ni une opération qui apprend ou invente les coordonnées.
- Deux dimensions sont un choix d’inspectabilité. Aucune dimension n’est nommée fatigue/faim et aucune valeur n’est déduite du sens d’un mot.
- Les chapitres de calcul utilisent un modèle initial immuable. Entraîner ne réécrit pas les exemples explicatifs déjà lus.
- Une intervention de ±0,001 sur une coordonnée expose ses effets successifs. Une différence finie est comparée à la dérivée analytique.
- La dérivation explique `p − cible`, les trois chemins vers le contexte, la division par deux et le signe du pas.
- L’entraînement réel utilise un lot de sept exemples. Le pas d’un exemple seul n’est pas présenté comme celui du lot.
- La rotation commune des embeddings et des lecteurs conserve les probabilités. Les axes ne sont pas des propriétés humaines imposées.
- Une simple statistique sur le dernier mot peut aussi résoudre cet exemple : aucun argument artificiel de nécessité des réseaux n’est utilisé.

Le sommaire de la leçon 5 permet une révision libre. Le parcours séquentiel demande une réponse explicative ; l’expérience d’entraînement et la fin nécessitent 300 époques. Ce seuil sert à organiser la démo, pas à garantir une propriété générale.

## Continuité des autres leçons

- 1 : mécanisme de correction sur un seul point, pas démonstration de généralisation.
- 2 : calcul d’un neurone avec réglages manuels, pas apprentissage supervisé exécuté ici.
- 3 : les biais −0,5 et −1,5 sont dérivés des sommes possibles 0/1/2. Réseau XOR construit à la main ; activation seuil, pas entraînement différentiable.
- 4 : modèle de comptage des bigrammes, sans softmax ni gradients. La tâche est celle du prochain token ; la réalisation change en leçon 5.
- 6 : nouveau corpus et nouveau modèle, pas conservation des poids de la leçon 5. Les projections Q/K/V sont ouvertes avec leurs paramètres réels. Deux softmax aux rôles distincts. Le bloc résiduel/MLP fait déjà partie du calcul.
- 7 : reconstruction déterministe au nombre d’époques sauvegardé en leçon 6, pas checkpoint fixe indépendant. Sommes résiduelles, deux normalisations, quatre activations cachées et projection finale détaillées. Contre-test de permutation et schéma interactif du masque causal.
- 8 : nouveau corpus et nouvelle initialisation. Contrôles de compréhension, mesures de perte avant/après, état initial stable, contre-test sec/humide à paramètres fixes. Le stepper ne saute plus de la première à la dernière mission ; les missions déjà atteintes restent revisitable.

## Limites d’architecture à garder visibles

`EmbeddingBaseline` : deux coordonnées, moyenne non ordonnée, lecteurs affines, trois sorties, aucune couche cachée non linéaire.

`TinyAttentionModel` : une tête, Q uniquement à la dernière position, pas d’encodage de position, pas de masque triangulaire complet, pas de projection de sortie de tête distincte. Un bloc post-norm pédagogique, tanh dans le MLP, LayerNorm sans gain/décalage appris, vocabulaire de sortie restreint. Les sommes de gradients sont bornées individuellement entre −4 et +4 avant multiplication par taux/nombre d’exemples.

Les positions, le masque complet, plusieurs têtes/blocs, la génération dans un grand vocabulaire et certaines variantes modernes sont situés conceptuellement, pas exécutés par ce moteur. Le cours n’est donc pas encore un simulateur complet de LLM moderne. Ne pas rebaptiser la dernière requête seule « Transformer complet ».

Références primaires : [Transformer, sections 3.1–3.5](https://arxiv.org/html/1706.03762v7), [LLaMA, section 2.2](https://arxiv.org/html/2302.13971v1).

## État et validation technique

La migration de la leçon 5 conserve les époques et la progression du cours ; son ancienne numérotation d’écrans est remplacée par une reprise au chapitre 1 avec une notification. Les nouvelles réponses et le chapitre sont enregistrés. Les checkpoints sont reconstruits avec graine, corpus, hyperparamètres et nombre d’époques identiques.

En développement seulement, `/?previewLesson=5` (1 à 8) ouvre un aperçu isolé. Il n’écrit pas dans le stockage de progression et se réinitialise au rechargement. Les URL normales conservent la sauvegarde habituelle. Ne pas distribuer le lien d’aperçu comme le lien normal d’apprentissage.

Tests ajoutés : gradient analytique contre différences finies, cohérence du pas réel, invariance par rotation, calcul des projections/activations, limitation liée à l’ordre, migration et reprise de session, réactivité des portes de progression, impossibilité de sauter les missions, reconstruction exacte 6 → 7 et rendu des chapitres.

## Pilote V3 — parcours accompagné sur un calcul réel

`/v3` est une version parallèle : 16 scènes de fondations, de la définition des données à la correction des embeddings et des poids de sortie. Le moteur est celui de la V2 (`MiniLanguageModel`), quatre coordonnées, douze tokens, moyenne non ordonnée puis projection affine et softmax. Ce n'est pas encore un Transformer.

Le scénario guidé reste à l'état initial, graine 23. La paire accompagnée « un chat mange la » → souris est réellement dans le corpus. « le chat mange la » reste un test exclu du calcul des gradients. Le laboratoire possède son propre checkpoint et son historique, sauvegardés séparément des explications et sans toucher les clés V1/V2.

Chaque exercice demande une prévision et une justification avant le résultat de l'intervention. Les indices et les tentatives sont enregistrés. Un calcul correct sans indice n'est pas une preuve que la justification est comprise ; son sens n'est pas évalué automatiquement. La navigation reste libre, avec une distinction explicite entre étape consultée et résultat réussi.

Les dérivations essentielles sont dans le parcours principal : softmax comme partage du total, −ln de la cible, différence finie, produit des sensibilités le long du graphe et somme des chemins vers E. Le one-hot est un détail introduit après le lookup, jamais une transformation magique d'ID en coordonnées.

Le dernier écran comporte quatre problèmes de transfert et un carnet sauvegardé. La suite positions/attention/Transformer reste à construire en V3 après évaluation de ce pilote. L'ancien parcours V2 est accessible via un lien nommé comme tel. Références et storyboard : `audit-pedagogique-v3.md` et `v3-lecon-pilote.md`.
