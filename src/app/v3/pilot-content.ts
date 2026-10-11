import { Checkpoint } from './checkpoint';

export interface PilotScene {
  readonly title: string;
  readonly short: string;
  readonly phase: string;
  readonly recap: string;
  readonly question: string;
  readonly paragraphs: readonly string[];
  readonly transition: string;
}

export const scenes: readonly PilotScene[] = [
  {
    title: 'Ce que la machine a vu — et ce qu’elle n’a pas vu', short: 'Nos données', phase: 'Poser le problème',
    recap: 'Nous voulons compléter « le chat mange la … ». Nous allons construire puis ouvrir un modèle minuscule.',
    question: 'Quels indices peut-il exploiter sans retrouver la phrase exacte ?',
    paragraphs: [
      'Voici toutes les données de notre expérience : dix phrases différentes. Notre programme n’a pas accès au reste du français. Sa réponse devra dépendre des régularités de ces phrases, pas d’un savoir que nous aurions caché dans une animation.',
      'Aucune ligne ne commence par « le chat mange la ». La première commence par « un » ; la troisième contient « regarde ». Clique une ligne pour voir exactement ce qu’elle partage avec notre question et ce qui diffère.',
      'Nous gardons « le chat mange la » hors de l’entraînement et mesurerons la place donnée à « souris ». C’est un test proche des données connues, pas une preuve de compréhension du langage. Dans ce petit corpus, les chats sont associés à souris et les chiens à pomme : c’est une régularité fabriquée pour l’expérience, pas une loi du monde.',
    ],
    transition: 'Pour comprendre une correction, prenons maintenant une phrase connue dont nous pouvons garder la réponse à part.',
  },
  {
    title: 'Recevoir un préfixe, puis être évalué sur le token suivant', short: 'Entrée et cible', phase: 'Poser le problème',
    recap: 'Le corpus est visible. Notre phrase test n’y figure pas exactement.',
    question: 'Que reçoit réellement le programme pendant un exercice d’entraînement ?',
    paragraphs: [
      'Prenons « un chat mange la souris . ». Nous coupons juste avant souris. Le modèle reçoit seulement « un chat mange la ». Il doit répartir ses chances entre les tokens possibles. La réponse observée, souris, est gardée à part pour l’évaluer après son calcul : c’est la cible.',
      'La cible n’est pas transmise au modèle pour produire cette prédiction. L’algorithme d’entraînement la reçoit ensuite pour noter et corriger les paramètres. Cette distinction évite de confondre apprendre d’une réponse et recevoir la réponse comme entrée.',
      'Déplace la coupure : « un chat » a pour cible mange ; « un chat mange » a pour cible la. La même phrase fournit plusieurs exercices. Pour le calcul accompagné qui suit, nous fixerons la coupure juste avant souris.',
    ],
    transition: 'Nous avons défini entrée et cible. Comment le programme retrouve-t-il les tokens de cette entrée ?',
  },
  {
    title: 'Un ID est une adresse, pas une quantité de sens', short: 'Tokens et adresses', phase: 'Poser le problème',
    recap: 'Notre exercice accompagné sera « un chat mange la » → cible souris.',
    question: 'Pourquoi « chat = 3 » ne signifie-t-il pas « trois unités de chat » ?',
    paragraphs: [
      'Notre découpage est volontairement simple : un mot ou un point constitue un token. Un tokenizer réel peut produire des fragments de mots. Nous reviendrons à cette différence ; elle ne change pas le mécanisme de sélection que nous ouvrons ici.',
      'Nous rangeons les douze tokens connus dans une liste. Leur ID est l’indice dans cette liste, compté à partir de zéro. Chat a l’ID 3 parce qu’il occupe cette case. Le programme ajoute aussi <début>, un marqueur spécial de début du texte. L’entrée du moteur contient donc cinq tokens, pas seulement les quatre mots écrits.',
      'Si nous changeons la numérotation des adresses et réorganisons les fiches correspondantes de façon cohérente, nous retrouvons les mêmes valeurs. L’ID sert à retrouver une entrée ; sa grandeur ne décrit ni le sens du token ni sa proximité avec un autre.',
    ],
    transition: 'Nous savons retrouver une adresse. Quel contenu modifiable allons-nous ranger à cette adresse ?',
  },
  {
    title: 'Une fiche de réglages numériques pour chaque token', short: 'Lire un embedding', phase: 'Suivre une prédiction',
    recap: 'L’ID sélectionne une entrée. Nous revenons au rangement initial du modèle de référence pour lire ses fiches.',
    question: 'Que sont ces nombres, pourquoi quatre, et d’où viennent-ils ?',
    paragraphs: [
      'Nous choisissons de ranger une petite liste de nombres modifiables pour chaque token, puis d’écrire une fonction qui les utilise pour fabriquer des scores. D’autres solutions sont possibles, comme une table de scores directs : les embeddings ne sont pas une obligation mathématique pour représenter des catégories.',
      'Cette liste est un vecteur ; ses cases sont ses coordonnées. Les quatre coordonnées de chat ne sont pas quatre qualités du chat. Ce sont des réglages dont nous allons observer l’effet. Quatre est notre choix de taille pour garder les opérations inspectables, pas un nombre déduit du mot ou du corpus.',
      'Avant l’apprentissage, un générateur reproductible remplit les fiches avec de petites valeurs entre −0,2 et 0,2. La graine 23 identifie ce tirage ; elle ne décrit pas le chat. Ces valeurs n’ont pas encore été apprises. Ce sont les corrections guidées par l’erreur qui devront les rendre utiles.',
      'La table E rassemble les douze fiches : douze lignes de quatre nombres. Une table rectangulaire de nombres s’appelle aussi une matrice. Ici, c’est la table d’embeddings. Lire E[3] veut dire lire la ligne de chat. Nous n’avons pas transformé le nombre 3 en quatre coordonnées : nous avons sélectionné des paramètres déjà stockés.',
    ],
    transition: 'Leur origine est claire. Suivons maintenant leur rôle : comment plusieurs fiches peuvent-elles alimenter une sortie ?',
  },
  {
    title: 'Un résumé de taille fixe : essayons une moyenne', short: 'Construire le contexte', phase: 'Suivre une prédiction',
    recap: 'Chaque token fournit quatre nombres lus dans E. Ces fiches sont encore non entraînées.',
    question: 'Pourquoi choisir un résumé, et que fait exactement la moyenne ?',
    paragraphs: [
      'Notre premier lecteur de sortie sera une petite fonction qui reçoit toujours quatre nombres. Pourtant une phrase peut avoir cinq ou huit tokens. Il faut donc lui construire une entrée de taille fixe : c’est le contexte résumé de ce premier modèle.',
      'Mettre toutes les fiches bout à bout ferait varier la taille de l’entrée. Les additionner donnerait quatre nombres, mais répéter toute la séquence doublerait leur amplitude. Nous essayons une moyenne colonne par colonne : elle accepte un nombre variable de tokens et conserve quatre sorties. C’est un choix provisoire, pas une loi des LLM.',
      'Pour la première colonne, additionnons les cinq valeurs, puis divisons par cinq. Le nombre obtenu, c₁, est calculé pour cette entrée. Il n’est pas un nouveau paramètre. Une autre phrase ou d’autres fiches donnent un autre résultat.',
      'La moyenne perd la provenance individuelle des morceaux. Elle sera notamment insensible à une permutation des mêmes tokens. Nous mesurerons cette limite après avoir appris à lire et corriger la sortie.',
    ],
    transition: 'Nous disposons de quatre entrées calculées. Comment les utiliser différemment pour souris et pour pomme ?',
  },
  {
    title: 'Un poids change la contribution d’une entrée au score', short: 'Comprendre un poids', phase: 'Suivre une prédiction',
    recap: 'La première coordonnée du résumé vaut −0,1172. C’est un résultat calculé, pas un mot caché.',
    question: 'Si nous augmentons son coefficient, le score monte-t-il forcément ?',
    paragraphs: [
      'Pour fabriquer un score de souris, nous choisissons une fonction simple : multiplier chaque entrée du résumé par un coefficient, puis additionner les contributions. Un coefficient ajustable s’appelle un poids. Le poids étudié vaut initialement 0,047 ; lui aussi vient du tirage reproductible, pas d’une décision de favoriser souris.',
      'La multiplication rend la règle réglable. Un poids nul annule cette contribution. Changer son amplitude change l’effet de cette entrée ; changer son signe peut en inverser le sens. Mais le produit dépend aussi du signe de l’entrée : ici elle est négative.',
      'Le poids est stocké dans W, la table de sortie. Cette cellule relie une coordonnée du résumé à une réponse candidate. Ce n’est ni une probabilité ni une étiquette « chat ». Anticipe le changement avant de révéler le nouveau produit.',
    ],
    transition: 'Une contribution n’est pas le score entier. Rassemblons les quatre produits et le biais.',
  },
  {
    title: 'Des produits pondérés à un score par réponse', short: 'Produire les logits', phase: 'Suivre une prédiction',
    recap: 'Une entrée calculée multipliée par un poids stocké donne une contribution calculée.',
    question: 'Comment obtenir le score complet, et pourquoi existe-t-il une matrice W ?',
    paragraphs: [
      'Nous répétons le produit sur les quatre coordonnées. Il n’y a pas de nouvelle opération : chaque entrée possède son coefficient pour cette sortie. Nous additionnons les quatre contributions.',
      'Nous ajoutons un biais : un réglage propre à cette sortie, indépendant du contexte. Son état initial est zéro. Augmenter le biais de souris augmenterait son score pour toutes les entrées, pas seulement les phrases sur les chats.',
      'Le résultat est un score brut, aussi nommé logit. Pomme et chacun des autres tokens possèdent leurs propres coefficients et biais, tout en lisant le même résumé. Quatre entrées × douze sorties donnent la table W de quatre lignes et douze colonnes dans notre code.',
      'La somme des produits correspondants s’appelle un produit scalaire. Cette fonction affine est une brique neuronale de sortie. Notre modèle n’a pas encore de couche cachée avec activation non linéaire : nous ne confondons pas cette première brique avec un réseau profond ou un Transformer complet.',
    ],
    transition: 'Ces douze scores peuvent être négatifs. Comment en faire des parts positives d’un même total ?',
  },
  {
    title: 'Une probabilité est une part, pas un score isolé', short: 'Partager les probabilités', phase: 'Suivre une prédiction',
    recap: 'Le lecteur produit un logit pour chaque token du vocabulaire. Aucun n’est encore un pourcentage.',
    question: 'Pourquoi les scores des autres candidats influencent-ils P(souris) ?',
    paragraphs: [
      'Il nous faut des parts positives qui totalisent un. Le modèle applique une fonction précise : transformer chaque score s en exp(s), puis diviser chaque résultat par leur somme. Ce calcul s’appelle softmax.',
      'Exp est la fonction exponentielle : exp(0) = 1, elle est toujours positive, et un score plus grand donne une valeur plus grande. C’est un choix de transformation, pas la seule fonction positive imaginable. Ne commence pas par la formule globale : suis le score de souris, son exponentielle et sa part du total.',
      'Les onze autres candidats contribuent au dénominateur. Le score de souris peut rester identique alors que sa probabilité baisse, si un concurrent prend plus de place. Les scores sont des calculs individuels ; les probabilités sont des parts concurrentes.',
    ],
    transition: 'Nous avons une distribution. Révélons la cible gardée à part et définissons précisément comment noter cette prédiction.',
  },
  {
    title: 'Définir la mesure d’erreur avant de vouloir la réduire', short: 'Comprendre la perte', phase: 'Suivre une prédiction',
    recap: 'Le modèle a calculé P(souris) sans recevoir souris comme entrée. Nous révélons maintenant cette cible.',
    question: 'Pourquoi mesurer la probabilité de la cible plutôt que seulement le gagnant ?',
    paragraphs: [
      'Le corpus indique souris. Nous voulons une pénalité faible lorsqu’il lui donne beaucoup de probabilité et forte lorsqu’il lui en donne peu. Passer de 8 % à 9 % doit compter, même si le candidat gagnant n’a pas changé.',
      'Nous choisissons L = −ln(p). p est la probabilité de la cible, entre zéro et un ; ln est le logarithme naturel ; L est la perte, ou loss. Pour une cible unique, c’est la cross-entropy. À p = 1, L = 0 ; à p = 0,5, L ≈ 0,693 ; à p = 0,1, L ≈ 2,303. Très peu de place pour la cible coûte donc beaucoup.',
      'Pourquoi cette fonction ? Elle distingue de petites variations de confiance et se dérive pour guider les corrections. Le logarithme transforme aussi le produit des probabilités de plusieurs réponses observées en une somme de pertes. D’autres objectifs existent ; nous allons comprendre celui-ci.',
      'Le curseur ici change une probabilité hypothétique pour comprendre la fonction, pas les paramètres du modèle. Son graphique a p en abscisse. Plus tard, nous tracerons une autre courbe, avec un poids en abscisse : ne les confonds pas.',
    ],
    transition: 'Nous savons ce que mieux veut dire sur cet exercice. Touchons un seul réglage et suivons les conséquences.',
  },
  {
    title: 'Un seul changement, une chaîne de conséquences', short: 'Intervenir sur un poids', phase: 'Apprendre des données',
    recap: 'Nous connaissons le chemin : produit → score → probabilité → perte.',
    question: 'Dans quel sens changer ce poids réduit-il la perte sur notre paire ?',
    paragraphs: [
      'Reprenons le poids de la première coordonnée pour souris. Tous les autres paramètres restent gelés. Avant le curseur, prévois ce que fait une diminution de ce poids à la perte sur « un chat mange la » → souris.',
      'Après ta prévision, le moteur calcule réellement l’essai. Le résumé est inchangé ; seul un produit change. Le score de souris change donc, puis sa part du total, puis la perte qui utilise cette part. Chaque maillon doit pouvoir être expliqué.',
      'Un changement bon sur cette paire peut être mauvais ailleurs. Nous n’avons ni appris sur le test « le chat mange la », ni démontré que diminuer tous les poids est une bonne stratégie. Le signe de l’entrée et la cible de l’exercice comptent.',
    ],
    transition: 'Le curseur donne une direction. Mesurons maintenant la sensibilité près du réglage courant.',
  },
  {
    title: 'Mesurer une pente : la dérivée cesse d’être abstraite', short: 'Mesurer le gradient', phase: 'Apprendre des données',
    recap: 'Modifier un poids modifie une perte. Les autres paramètres restent fixes dans cette expérience.',
    question: 'Comment comparer les effets de petits déplacements de tailles différentes ?',
    paragraphs: [
      'Calculons la perte avec w − ε puis w + ε, avec ε = 0,0001. La variation de perte divisée par la distance entre les deux poids donne une pente moyenne sur ce très petit intervalle. La distance vaut 2ε : nous avons déplacé le poids des deux côtés.',
      'C’est une différence finie, une approximation de la dérivée. La dérivée décrit la sensibilité locale à la limite lorsque le déplacement devient très petit. Ici une pente positive veut dire : augmenter ce poids augmente la perte, au voisinage du point courant.',
      'Une telle sensibilité est une composante du gradient. Le gradient rassemble les dérivées par rapport à tous les paramètres. Pour descendre, nous essayons un petit déplacement dans le sens opposé, sans supposer que la pente reste la même loin du point.',
    ],
    transition: 'Deux calculs par poids sont abordables ici. Pour beaucoup de paramètres, comment éviter de tout réexécuter pour chaque case ?',
  },
  {
    title: 'La rétropropagation compose des effets locaux', short: 'Remonter le calcul', phase: 'Apprendre des données',
    recap: 'Nous avons mesuré une sensibilité par deux essais. Cherchons la même valeur à partir des opérations.',
    question: 'Comment un petit effet se transmet-il du poids jusqu’à la perte ?',
    paragraphs: [
      'Conservons le graphe utilisé en avant. Le poids change un produit ; l’addition transmet ce changement au score ; le score change la probabilité ; la probabilité change la perte. Chaque opération possède une sensibilité locale.',
      'Si une opération multiplie une petite variation par a, puis la suivante par b, l’effet total est multiplié par a × b. C’est la règle de chaîne. Nous remontons le chemin en composant ces effets, avec leurs signes, pas en inventant un signal de correction.',
      'La multiplication par c₁ transmet Δw sous la forme c₁ × Δw. L’addition au reste du score transmet la variation sans la changer. Pour la probabilité et le logarithme, construisons les dérivées ci-dessous avant de les utiliser.',
      'La rétropropagation remonte ce graphe pour calculer efficacement les gradients. Ici nous expliquons un poids de sortie, pas encore tous les paramètres : si plusieurs chemins partent d’une même valeur, il faudra aussi additionner leurs effets.',
    ],
    transition: 'Pourquoi les nombres de la table E peuvent-ils apprendre eux aussi ? Regardons le cas où plusieurs chemins se rejoignent.',
  },
  {
    title: 'Une coordonnée d’embedding influence plusieurs sorties', short: 'Faire apprendre E', phase: 'Apprendre des données',
    recap: 'Nous savons multiplier les sensibilités le long d’un chemin. Les chemins peuvent aussi se ramifier.',
    question: 'Pourquoi le gradient de E n’est-il pas seulement celui du score souris ?',
    paragraphs: [
      'La première coordonnée du résumé alimente les douze scores, pas uniquement souris. Modifier la case de chat qui participe à ce résumé change donc plusieurs chemins vers la même perte. Leurs effets doivent s’additionner.',
      'Pour la cible, la sensibilité de la perte au score vaut P(souris) − 1 ; pour un autre candidat j, elle vaut P(j). Augmenter un concurrent fait grandir le total du softmax sans augmenter son numérateur cible, ce qui accroît la perte. La dérivation est accessible dans cette scène.',
      'Chaque chemin vers le résumé multiplie cette sensibilité par le poids W de sa sortie. Leur somme donne l’effet du résumé sur la perte. Enfin, chat apparaît une fois parmi cinq tokens : changer sa case de Δ change la moyenne de Δ/5. Son gradient est donc cette somme divisée par cinq.',
      'Une ligne E absente de l’entrée n’est pas lue pour cette prédiction. Dans notre moteur E et W sont des tables indépendantes : modifier uniquement E[chien] ne change pas immédiatement ce préfixe sans chien. Certains modèles partagent des poids entre entrée et sortie ; nous ne le faisons pas ici.',
    ],
    transition: 'Les nombres de E et W sont donc des réglages avec des effets calculables. Appliquons une correction précise à un poids.',
  },
  {
    title: 'Du gradient à une correction vérifiable', short: 'Corriger un réglage', phase: 'Apprendre des données',
    recap: 'Le gradient donne l’effet local d’une augmentation du paramètre sur la perte.',
    question: 'Comment choisir un déplacement qui va dans le sens opposé ?',
    paragraphs: [
      'Nous choisissons un pas d’apprentissage η, ici 0,7. C’est un réglage de l’expérience, pas une constante de la théorie. La règle est : nouvelle valeur = ancienne valeur − η × gradient. Le signe moins inverse la direction d’augmentation de la perte.',
      'La correction visible ne touche qu’un poids et utilise une seule paire connue. Nous recalculons cette paire avec les autres paramètres fixes. L’amélioration est modeste, mais nous pouvons reconstruire son origine. Un pas trop grand n’a pas de garantie d’amélioration générale.',
      'Ce poids est partagé par tous les contextes. Une paire dont la cible est pomme peut pousser ce même poids dans une autre direction. Le vrai entraînement du moteur combine les gradients de toutes les paires, puis corrige E, W et les biais.',
    ],
    transition: 'Nous comprenons une correction locale. Comparons maintenant cette opération à une époque complète sur le corpus.',
  },
  {
    title: 'Entraîner les réglages partagés, mesurer le test à part', short: 'Laboratoire réel', phase: 'Apprendre des données',
    recap: 'Le scénario expliqué reste au checkpoint initial. Ce laboratoire possède son propre état sauvegardé.',
    question: 'Une baisse d’erreur sur le corpus aide-t-elle le préfixe jamais entraîné ?',
    paragraphs: [
      'Une époque dans ce moteur parcourt toutes les paires issues des dix phrases. Il calcule leurs gradients à partir du même checkpoint, les moyenne et applique une mise à jour à E, W et aux biais. Ce choix correspond ici à un entraînement en lot complet.',
      'Le préfixe test commence par le ; notre paire accompagnée commençait par un. Les paramètres partagés permettent une influence indirecte sur les deux, mais le test ne fournit aucun gradient. Mesurons séparément la perte moyenne d’entraînement et P(souris) sur le test.',
      'Une réussite reste une généralisation proche : « un chat mange la souris » est présent. Les données ne suffisent pas à démontrer que l’attention serait nécessaire. Notre moyenne ignore toujours l’ordre ; cette limite est le prochain problème, pas un détail que le nombre d’époques ferait disparaître.',
    ],
    transition: 'Avant d’ajouter positions et attention, vérifions que tu peux refaire les raisonnements sur des interventions différentes.',
  },
  {
    title: 'Reconstruire la machine, sans la réponse sous les yeux', short: 'Exercice de transfert', phase: 'Transférer',
    recap: 'Tu as suivi une prédiction, mesuré des gradients et appliqué des corrections réelles.',
    question: 'Peux-tu prévoir un changement nouveau et justifier tous les maillons ?',
    paragraphs: [
      'Ces quatre problèmes repartent de l’état de référence, pas du laboratoire entraîné. Réponds avant de révéler le résultat ; une erreur est une occasion de retrouver le maillon manquant. Les indices restent disponibles.',
      'Le résultat numérique ou le choix est vérifié. Ta justification est conservée mais son sens n’est pas évalué automatiquement : compare-la au raisonnement donné après ta tentative. Réussir sans indice n’est pas une preuve complète de compréhension.',
      'Ce pilote couvre les fondations numériques. Il ne constitue pas encore tout le cours sur un LLM moderne. La suite V3 doit traiter l’ordre, l’attention, le MLP et le bloc complet avec la même exigence. Les leçons V2 restent accessibles, explicitement comme ancien parcours.',
    ],
    transition: 'Garde ta reconstruction dans le carnet. Elle servira de point de comparaison lorsque nous ajouterons la lecture du contexte.',
  },
];

const directions = [{ value: 'up', label: 'Augmente' }, { value: 'down', label: 'Diminue' }, { value: 'same', label: 'Reste identique' }];
export const checkpoints: Readonly<Record<number, Checkpoint>> = {
  4: {
    id: 'mean', question: 'À toi sur une autre colonne : la somme vaut 0,146 pour cinq tokens. Quelle est la moyenne ?',
    expected: 0.0292, tolerance: 0.000001, hint: 'La moyenne divise la somme par le nombre de valeurs, pas par le nombre de colonnes.',
    correct: '0,146 ÷ 5 = 0,0292. C’est une valeur calculée pour la deuxième colonne, pas une nouvelle cellule stockée.',
    incorrect: 'Nous avons cinq tokens, chacun apportant une valeur à cette colonne : divise 0,146 par cinq. Quatre est le nombre de colonnes, pas le nombre de valeurs moyennées.',
  },
  5: {
    id: 'weight-direction', question: 'Le poids passe de 0,047 à 0,147. Que devient sa contribution, avec l’entrée −0,1172 ?',
    options: directions, expected: 'down', hint: 'Une quantité négative multipliée par un coefficient positif plus grand devient plus négative.',
    correct: '−0,1172 × 0,047 = −0,0055084 ; avec 0,147, le produit vaut −0,0172284. Il diminue. Le signe de l’entrée est décisif.',
    incorrect: 'Ne raisonne pas sur le poids seul : sa variation est multipliée par −0,1172. Une hausse de 0,1 apporte −0,01172 au produit.',
  },
  7: {
    id: 'competition', question: 'On augmente uniquement le score de pomme. Que devient P(souris) ?',
    options: directions, expected: 'down', hint: 'Le numérateur de souris reste fixe ; le dénominateur contient aussi pomme.',
    correct: 'La part de souris diminue : exp(score pomme) augmente le total partagé, sans changer exp(score souris). Un score fixe ne garantit pas une probabilité fixe.',
    incorrect: 'Le softmax normalise tous les candidats ensemble. Le score de souris reste fixe, mais son dénominateur augmente : sa part diminue.',
  },
  9: {
    id: 'loss-direction', question: 'On diminue de 0,1 le poids de la colonne 1 pour souris. Que devient la perte sur la paire souris ?',
    options: directions, expected: 'down', hint: 'Entrée négative × diminution du poids = augmentation du score de souris ; puis suis softmax et −ln.',
    correct: 'Le score augmente, P(souris) augmente, puis −ln(P(souris)) diminue. Tous les autres paramètres restent fixes. Cette conclusion concerne cette paire.',
    incorrect: 'Reconstitue les signes : c₁ = −0,1172 et Δw = −0,1, donc Δscore = +0,01172. Davantage de probabilité pour la cible réduit la perte.',
  },
  10: {
    id: 'epsilon', question: 'Entre w − 0,0001 et w + 0,0001, quelle distance sépare les deux poids ?',
    expected: 0.0002, tolerance: 0.00000001, hint: 'Un déplacement vers la gauche, un vers la droite : les deux distances s’ajoutent.',
    correct: '(w + ε) − (w − ε) = 2ε = 0,0002. Diviser par ε seul doublerait artificiellement la pente mesurée.',
    incorrect: 'Tu compares deux points opposés, pas le point courant à un seul essai. Leur distance est 0,0001 + 0,0001.',
  },
  13: {
    id: 'update', question: 'w = 0,047, gradient = +0,1076341363, pas = 0,7. Quelle est la nouvelle valeur ?',
    expected: -0.0283438954, tolerance: 0.00001, hint: 'Calcule d’abord 0,7 × gradient, puis soustrais ce déplacement à 0,047.',
    correct: '0,047 − 0,7 × 0,1076341363 ≈ −0,0283439. Le gradient positif nous fait essayer un poids plus petit.',
    incorrect: 'La correction est soustraite, pas ajoutée. Le pas multiplie le gradient entier. Une valeur négative du nouveau poids est possible.',
  },
};
export const transferChecks: readonly Checkpoint[] = [
  { id: 'transfer-absent', question: 'On change uniquement E[chien, 1] de +0,1. Que devient la prédiction sur « un chat mange la » ?',
    options: [{ value: 'changes', label: 'Elle change' }, { value: 'same', label: 'Elle reste identique' }], expected: 'same',
    hint: 'Liste les lignes E effectivement lues. E et W sont indépendantes ici.',
    correct: 'Chien n’est pas dans l’entrée. Sa ligne E n’est pas lue, donc le résumé, les scores et les probabilités restent identiques. Cela suppose ici des poids d’entrée et de sortie non partagés.',
    incorrect: 'Changer n’importe quel paramètre ne change pas forcément cette exécution. Il faut un chemin entre la cellule modifiée et la sortie. Ici, la ligne chien n’est pas utilisée.' },
  { id: 'transfer-sign', question: 'Cette fois, on augmente W[2, souris] de 0,1. L’entrée c₂ vaut +0,0292. Que devient la perte cible ?',
    options: directions, expected: 'down', hint: 'Ici l’entrée est positive. Recalcule le signe de Δscore avant de suivre la probabilité.',
    correct: 'Δscore = +0,0292 × 0,1 = +0,00292. P(souris) augmente et la perte diminue. La hausse du poids n’a pas le même effet que dans la colonne 1 négative.',
    incorrect: 'N’applique pas « augmenter le poids aggrave » appris sur une autre entrée. Ici c₂ est positif, donc une hausse du poids augmente le score de la cible et réduit sa perte.' },
  { id: 'transfer-other', question: 'On diminue seulement le score de pomme de 1. Le score de souris ne bouge pas. Que devient P(souris) ?',
    options: directions, expected: 'up', hint: 'Le candidat concurrent prend moins de place dans le total du softmax.',
    correct: 'La part de souris augmente. Son numérateur est inchangé, mais le dénominateur diminue. La somme des probabilités reste un : certaines autres parts augmentent aussi.',
    incorrect: 'Le score de souris n’est pas sa probabilité. Pomme diminue le total exponentiel ; diviser le numérateur fixe de souris par un total plus petit augmente sa part.' },
  { id: 'transfer-update', question: 'Autre réglage : w = 0,2, gradient = −0,3 et pas = 0,1. Quel nouveau poids essaie-t-on ?',
    context: 'Exercice pédagogique de transfert : ces trois nombres ne proviennent pas du checkpoint du mini-modèle.',
    expected: 0.23, tolerance: 0.000001, hint: 'Soustraire un déplacement négatif revient à l’ajouter.',
    correct: '0,2 − 0,1 × (−0,3) = 0,23. Une dérivée négative signifie qu’une petite augmentation du réglage réduit localement la perte. Le pas choisi ne garantit pas toute amélioration loin du point.',
    incorrect: 'Le gradient vaut −0,3 : le déplacement soustrait vaut −0,03. Il faut donc calculer 0,2 + 0,03, et non 0,2 − 0,03.' },
];
