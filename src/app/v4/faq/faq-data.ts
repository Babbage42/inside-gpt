// Les questions fréquentes. Pour en ajouter une : un objet de plus dans la liste, c'est tout.
// chapter : numéro (à partir de 0) du chapitre qui montre la réponse en action.
// open : la réponse est débattue ou incertaine, et la page le signale.

export interface Entry {
  readonly category: string;
  readonly question: string;
  /** Un ou plusieurs paragraphes, séparés par une ligne vide. */
  readonly answer: string;
  readonly chapter?: number;
  readonly open?: boolean;
}

export const CATEGORIES = ['Les mots', 'Le mécanisme', 'Idées reçues', 'Erreurs et limites', 'Du cours aux vrais modèles', 'Suivre le cours'] as const;

export const ENTRIES: readonly Entry[] = [
  // ── Les mots ──
  {
    category: 'Les mots',
    question: 'IA, LLM, transformer, GPT : quelle différence ?',
    answer: `Ce sont des poupées russes. L’<strong>IA</strong> désigne tout programme qui accomplit une tâche qu’on croyait réservée à l’intelligence. Un <strong>LLM</strong> (grand modèle de langage) est une IA entraînée à deviner la suite d’un texte. Le <strong>transformer</strong> est le plan de construction de presque tous les LLM depuis 2017 : des couches de regards et de neurones.

<strong>GPT</strong> (« transformer génératif pré-entraîné ») est le nom d’une famille de LLM, devenu presque un nom commun.`,
    chapter: 6,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’un token ?',
    answer: `Le morceau de texte que la machine manipule. Dans ce cours, un token est un mot entier, pour rester lisible. Les vrais modèles découpent plus fin : un mot courant fait un token, un mot rare en fait plusieurs. Ils en connaissent des dizaines de milliers.

Tout ce que le modèle lit et écrit passe par ces morceaux, ponctuation comprise.`,
    chapter: 6,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’un paramètre ? Et « 175 milliards de paramètres », ça veut dire quoi ?',
    answer: `Un paramètre est un nombre que l’entraînement peut modifier : ce que le cours appelle un <strong>bouton</strong>. On dit aussi « poids ». GPT-3 en compte 175 milliards ; le mini-GPT du cours, 63 312.

Aucun bouton pris seul n’a de sens : c’est leur réglage d’ensemble qui fait le comportement du modèle. Quand on télécharge un modèle, c’est cette liste de nombres qu’on télécharge.`,
    chapter: 2,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’un embedding ?',
    answer: `La liste de nombres attachée à un token : ses boutons. Avec deux nombres, on peut la dessiner comme un point sur une carte, où les mots qui s’emploient de la même façon finissent voisins.

Les vrais modèles utilisent des centaines ou des milliers de nombres par token. Impossible à dessiner, mais le principe est le même.`,
    chapter: 2,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce que l’attention ?',
    answer: `Le mécanisme qui permet à chaque mot de consulter les mots précédents : ce que le cours appelle un <strong>regard</strong>. Chaque mot pose une question, chaque mot précédent affiche une étiquette, et le mot qui regarde recopie le contenu de ceux dont l’étiquette répond le mieux.

C’est ce qui permet d’aller chercher une information à n’importe quelle distance dans le texte.`,
    chapter: 5,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’une couche ? Et une tête ?',
    answer: `Une <strong>couche</strong> est un bloc « regards puis neurones ». Un modèle en empile des dizaines, chacune travaillant sur le résultat de la précédente. Une <strong>tête</strong> d’attention est un regard : chaque couche en lance plusieurs en parallèle, qui cherchent des choses différentes.

Le mini-GPT du cours a 3 couches de 2 têtes ; GPT-3, 96 couches de 96 têtes.`,
    chapter: 8,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’un neurone artificiel ? A-t-il un rapport avec ceux du cerveau ?',
    answer: `C’est un petit calcul : multiplier chaque entrée par un poids, additionner, puis appliquer un « pli » (se taire si le total est négatif).

Le nom vient d’une inspiration lointaine du cerveau, dans les années 1940 et 1950. La ressemblance s’arrête là : un vrai neurone est une cellule vivante, infiniment plus complexe. Mieux vaut y penser comme à une brique de calcul.`,
    chapter: 4,
  },
  {
    category: 'Les mots',
    question: 'Que veut dire « entraîner » un modèle ? Et « inférence » ?',
    answer: `<strong>Entraîner</strong>, c’est régler les boutons. On fait deviner des mots au modèle sur d’immenses quantités de texte, on mesure ses erreurs, et on tourne chaque bouton un peu dans le sens qui les réduit. Cela se fait avant la mise en service et demande des semaines ou des mois de calcul sur des milliers de machines.

L’<strong>inférence</strong>, c’est l’utilisation : les boutons ne bougent plus, le modèle calcule seulement la suite de ton texte.`,
    chapter: 3,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce que la « surprise », qu’on appelle aussi la perte ?',
    answer: `La note qu’on donne au modèle après chaque mot deviné : faible s’il avait donné une forte probabilité au bon mot, forte sinon. Les spécialistes disent « perte » (<em>loss</em>). Tout l’entraînement consiste à la faire baisser.

Elle ne tombe jamais à zéro : personne ne peut deviner à coup sûr le prochain mot d’un texte.`,
    chapter: 3,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce que le gradient ? Et la rétropropagation ?',
    answer: `Le <strong>gradient</strong> dit, pour chaque bouton, dans quel sens le tourner pour faire <em>monter</em> la surprise, et avec quelle force : c’est une pente. L’entraînement tourne chaque bouton dans le sens opposé, d’où le nom de <strong>descente de gradient</strong>.

La <strong>rétropropagation</strong> est la méthode qui calcule toutes ces pentes d’un coup, en remontant le calcul à l’envers. Sans elle, il faudrait essayer chaque bouton un par un.`,
    chapter: 3,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce que la fenêtre de contexte ?',
    answer: `Le nombre maximal de tokens que le modèle peut voir à la fois : ta question, mais aussi toute la conversation qui précède. Le mini-GPT du cours voit 24 mots ; les modèles actuels, des centaines de milliers de tokens, parfois plus d’un million.

Ce qui dépasse n’existe plus pour le modèle. Les applications coupent ou résument alors le début de la conversation, d’où l’impression qu’il « oublie ».`,
    chapter: 6,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce que la température ?',
    answer: `Un réglage qui joue sur le tirage du mot suivant. À température basse, le modèle prend presque toujours son favori : réponses stables, parfois plates. À température haute, il tire plus souvent des mots moins probables : réponses variées, parfois hasardeuses.

Elle ne change rien à ce que le modèle « sait », seulement à la façon de piocher dans ses probabilités.`,
    chapter: 9,
  },
  {
    category: 'Les mots',
    question: 'Qu’est-ce qu’un prompt ?',
    answer: `Le texte que tu donnes au modèle : le début dont il doit écrire la suite. Tout ce qu’il sait de ta demande est là.

C’est pourquoi la formulation compte : changer le prompt, c’est changer le texte à continuer, donc les probabilités de tous les mots qui suivent.`,
    chapter: 9,
  },
  {
    category: 'Les mots',
    question: 'Quelle différence entre une note (ou score) et une probabilité ?',
    answer: `La <strong>note</strong> est le résultat brut du calcul pour un candidat : un nombre quelconque, parfois négatif. La <strong>probabilité</strong> est la part de 100 % que ce candidat reçoit une fois toutes les notes comparées.

Le passage de l’une à l’autre s’appelle le <em>softmax</em>. Seul l’écart entre les notes compte : une note de −2 l’emporte largement si toutes les autres sont à −6.`,
    chapter: 2,
  },

  // ── Le mécanisme ──
  {
    category: 'Le mécanisme',
    question: 'Il devine vraiment un seul mot à la fois ?',
    answer: `Oui. Pour écrire une réponse de cent mots, le modèle fait cent passages complets. À chaque fois, il relit tout le texte, donne une probabilité à chaque token possible, on en tire un, on l’ajoute, et on recommence.

C’est pour cela que les réponses s’affichent au fil de l’eau. Rien n’est écrit d’avance.`,
    chapter: 1,
  },
  {
    category: 'Le mécanisme',
    question: 'D’où viennent les nombres au départ ? Que représentent-ils ?',
    answer: `Du hasard. Avant l’entraînement, tous les boutons sont tirés au sort et ne représentent rien. C’est l’entraînement qui, correction après correction, leur donne une utilité.

Le sens n’est pas mis dans les nombres : il s’y dépose, parce que des mots employés de la même façon subissent les mêmes corrections.`,
    chapter: 2,
  },
  {
    category: 'Le mécanisme',
    question: 'Comment le modèle sait-il dans quel sens corriger ?',
    answer: `Il ne « sait » rien : c’est un calcul. Pour chaque bouton, on peut déterminer si l’augmenter un peu ferait monter ou baisser la surprise. On le tourne alors très légèrement du bon côté, et on recommence sur le texte suivant.

Des milliards de petites corrections aveugles finissent par produire un réglage d’ensemble efficace.`,
    chapter: 3,
  },
  {
    category: 'Le mécanisme',
    question: 'Pourquoi multiplier des nombres entre eux ?',
    answer: `Parce que c’est l’opération la plus simple qui permette de comparer. Deux nombres de même signe donnent un produit positif ; de signes opposés, un produit négatif. En additionnant beaucoup de ces produits, on obtient une note qui dit à quel point deux listes de nombres vont ensemble.

Presque tout le calcul d’un LLM est fait de ces multiplications suivies d’additions.`,
    chapter: 2,
  },
  {
    category: 'Le mécanisme',
    question: 'Pourquoi parle-t-on tantôt de la « position » d’un mot, tantôt de sa « flèche » ?',
    answer: `Parce qu’un même mot possède deux listes de boutons. La première sert quand le mot est <em>lu</em> : dessinée, c’est sa position sur la carte. La seconde sert quand le mot est <em>proposé</em> comme suite : dessinée, c’est une flèche.

La note d’un candidat mesure si la position du mot lu se trouve du côté où pointe sa flèche. C’est une multiplication de boutons, vue en image.`,
    chapter: 2,
  },
  {
    category: 'Le mécanisme',
    question: 'Où sont rangées les connaissances du modèle ?',
    answer: `Nulle part sous forme de texte. Il n’y a pas de fichier « capitales » à l’intérieur. Savoir que Rome est la capitale de l’Italie, c’est avoir des boutons réglés de sorte que « Rome » reçoive une forte probabilité après « la capitale de l’Italie est ».

Ce savoir est réparti sur un très grand nombre de boutons. Les chercheurs pensent qu’une bonne part loge dans les neurones de chaque couche.`,
    chapter: 7,
  },
  {
    category: 'Le mécanisme',
    question: 'Le modèle change-t-il quand je lui parle ?',
    answer: `Non. Pendant une conversation, pas un seul bouton ne bouge. Ce qui change, c’est le texte qu’on lui donne à continuer : ta conversation entière est relue à chaque mot.

S’il semble se souvenir de ce que tu as dit plus haut, c’est qu’il l’a sous les yeux.`,
    chapter: 9,
  },
  {
    category: 'Le mécanisme',
    question: 'A-t-il une mémoire ? Se souvient-il de moi d’une conversation à l’autre ?',
    answer: `Par lui-même, non. Sa seule mémoire est le texte qu’il a sous les yeux : la conversation en cours. Quand elle se termine, rien n’en reste dans ses boutons.

Si un assistant se souvient de toi d’un jour à l’autre, c’est que l’application a gardé des notes et les réécrit au début de chaque nouvelle conversation.`,
    chapter: 9,
  },
  {
    category: 'Le mécanisme',
    question: 'Comment tient-il compte d’un mot écrit dix lignes plus haut ?',
    answer: `Grâce aux regards. Chaque mot peut consulter directement n’importe quel mot précédent, proche ou lointain, sans passer par les mots intermédiaires.

C’est la grande différence avec les systèmes d’avant 2017, qui lisaient le texte comme on déroule un fil et perdaient vite le début.`,
    chapter: 5,
  },
  {
    category: 'Le mécanisme',
    question: 'Que fait chaque couche, concrètement ?',
    answer: `Elle enrichit la liste de nombres de chaque mot. À l’entrée, cette liste ne parle que du mot lui-même. Après une couche, elle contient aussi ce que le mot est allé chercher chez les autres. Après plusieurs, elle peut contenir le résultat d’un petit raisonnement.

Dans le mini-GPT du cours, on voit la réponse se former : « baleine » à l’entrée, « savane » après la deuxième couche.`,
    chapter: 9,
  },
  {
    category: 'Le mécanisme',
    question: 'Pourquoi faut-il autant de boutons ?',
    answer: `Parce que le monde décrit par les textes est immense. Le mini-GPT du cours retient tout sur douze animaux avec 63 312 boutons. Pour retenir l’orthographe, la grammaire de dizaines de langues, des faits, des styles et des façons de raisonner, il en faut des milliards.

Plus de boutons, c’est plus de place pour que des régularités s’y déposent.`,
    chapter: 6,
  },
  {
    category: 'Le mécanisme',
    question: 'Pourquoi la même question donne-t-elle des réponses différentes ?',
    answer: `Parce que le mot suivant est <strong>tiré au sort</strong> selon les probabilités calculées, et non pris d’office parmi les favoris. Deux tirages peuvent diverger dès le troisième mot, et tout le reste de la réponse en dépend.

Avec une température de zéro, le modèle prend toujours son favori et devient, en principe, répétable.`,
    chapter: 9,
  },
  {
    category: 'Le mécanisme',
    question: 'Lit-il le texte de gauche à droite, comme nous ?',
    answer: `Pas tout à fait. Il traite tous les mots du texte en même temps, avec une règle : un mot ne peut regarder que ceux qui le précèdent.

En revanche, il <em>écrit</em> bien de gauche à droite, un mot après l’autre, sans jamais revenir corriger ce qui est déjà écrit.`,
    chapter: 5,
  },
  {
    category: 'Le mécanisme',
    question: 'Comment sait-il dans quel ordre sont les mots ?',
    answer: `Grâce à une seconde liste de boutons, qui ne dépend que de la place : premier mot, deuxième mot… On l’ajoute à celle du mot lui-même.

Sans elle, le texte serait pour lui un sac de mots. Le cours le montre : privée de cette information, la machine confond deux phrases qui se suivent.`,
    chapter: 8,
  },
  {
    category: 'Le mécanisme',
    question: 'Comment peut-il « raisonner » s’il ne fait que deviner ?',
    answer: `De deux façons. D’abord à l’intérieur d’un seul passage : au fil des couches, il peut enchaîner des étapes, comme le modèle du chapitre 6 qui range puis cherche.

Ensuite en écrivant : chaque mot produit redevient une entrée, donc il peut poser un résultat intermédiaire puis s’en servir, comme on calcule sur un brouillon. Les modèles dits « de raisonnement » sont entraînés à utiliser ce brouillon.`,
    chapter: 6,
  },
  {
    category: 'Le mécanisme',
    question: 'Comment une machine à deviner devient-elle un assistant qui répond ?',
    answer: `Par deux entraînements de plus. D’abord des <strong>exercices corrigés</strong> : des dialogues, mis à plat en un seul texte avec des marques (« utilisateur », « assistant », « fin »), où l’on ne note que les répliques de l’assistant. Il apprend la façon de répondre ; le savoir, lui, vient du premier entraînement.

Puis des <strong>exercices notés</strong> : il essaie, une note juge ses essais, et l’on rend les réussites plus probables. Le chapitre 11 fait les trois étapes pour de vrai.`,
    chapter: 10,
  },

  // ── Idées reçues ──
  {
    category: 'Idées reçues',
    question: '« C’est une base de données qui va chercher la réponse »',
    answer: `Non. Le modèle ne consulte rien : il calcule. Il n’y a ni fiches ni moteur de recherche à l’intérieur, seulement des boutons réglés.

C’est ce qui explique à la fois sa souplesse (il répond à des questions jamais posées) et ses erreurs (aucune fiche à vérifier). Certaines applications lui ajoutent une vraie recherche, mais c’est un outil extérieur.`,
    chapter: 2,
  },
  {
    category: 'Idées reçues',
    question: '« Il recopie des textes qu’il a lus »',
    answer: `En général, non. Les textes d’entraînement ne sont pas stockés, et le modèle écrit sans cesse des phrases qui n’existent nulle part. Le mini-GPT du cours répond juste à des questions qu’on ne lui a jamais posées.

Une nuance : un passage rencontré des milliers de fois, comme un poème célèbre, peut finir par être retenu mot pour mot.`,
    chapter: 9,
  },
  {
    category: 'Idées reçues',
    question: '« Ce n’est que de l’autocomplétion »',
    answer: `C’est vrai pour l’objectif, trompeur pour le résultat. Oui, on ne lui demande que de deviner la suite. Mais pour bien deviner la suite d’un problème de maths ou d’une histoire, il faut savoir compter et suivre une intrigue.

Le cours le montre à petite échelle : sans qu’on la programme, une méthode en deux étapes apparaît, parce qu’elle aide à deviner.`,
    chapter: 0,
  },
  {
    category: 'Idées reçues',
    question: '« C’est un perroquet »',
    answer: `L’image a du vrai : il produit du texte à partir de régularités, sans rien vérifier. Mais un perroquet répète. Un LLM répond juste à des questions inédites, parce qu’il a tiré de ses lectures des méthodes, et pas seulement des phrases.

Le mini-GPT du cours en donne une mesure : 89 % de réussite sur des questions qu’on ne lui a jamais posées.`,
    chapter: 9,
  },
  {
    category: 'Idées reçues',
    question: '« Il comprend ce qu’il dit » ou « Il ne comprend rien »',
    answer: `Les deux affirmations vont trop vite, et tout dépend de ce qu’on appelle comprendre. Ce qui est établi : ces modèles construisent des représentations internes et des méthodes réutilisables, ils ne se contentent pas de fréquences.

Ce qui est établi aussi : ils échouent parfois d’une façon qu’aucun humain qui comprend n’aurait. Le débat reste ouvert, y compris entre spécialistes.`,
    chapter: 7,
    open: true,
  },
  {
    category: 'Idées reçues',
    question: '« Il apprend de mes conversations en direct »',
    answer: `Pas pendant que tu lui parles : ses boutons sont figés. Deux choses peuvent donner cette impression. Certaines applications gardent des notes sur toi et les réinsèrent dans le texte au début de chaque conversation.

Et selon les réglages et les conditions du service, tes conversations peuvent servir plus tard à entraîner une future version.`,
  },
  {
    category: 'Idées reçues',
    question: '« Il est programmé avec des règles »',
    answer: `Non, et c’est le point le plus contre-intuitif. Personne n’a écrit « accorde le verbe avec le sujet » ni « la capitale de l’Italie est Rome ». Le programme, assez court, décrit seulement la forme de la machine et la façon de l’entraîner.

Tout le reste est dans les boutons. C’est aussi pourquoi on ne corrige pas une erreur en modifiant une ligne de code.`,
    chapter: 3,
  },
  {
    category: 'Idées reçues',
    question: '« Il sait quand il ne sait pas »',
    answer: `Pas de façon fiable. Rien dans le mécanisme ne distingue une suite vraie d’une suite seulement plausible. Le mini-GPT du cours répond avec aplomb à « où vit le poisson ? », alors que la question n’a pas de sens dans son monde.

Les grands modèles sont entraînés à dire plus souvent « je ne sais pas ». Cela reste une habitude apprise, pas une garantie.`,
    chapter: 9,
  },
  {
    category: 'Idées reçues',
    question: '« Il a accès à Internet »',
    answer: `Le modèle lui-même, non : il n’a que ses boutons et le texte que tu lui donnes. Ses connaissances s’arrêtent à la date où son entraînement a pris fin.

Mais une application peut lancer une recherche pour lui et glisser les résultats dans son texte : il les lit alors comme le reste. Quand un assistant cite une page récente, c’est ce qui s’est passé.`,
  },
  {
    category: 'Idées reçues',
    question: '« Plus un modèle est gros, meilleur il est »',
    answer: `Longtemps, grossir a été le principal moteur des progrès : c’est le sujet du chapitre 7. Mais la taille ne fait pas tout. La qualité des textes, la méthode d’entraînement et le temps de calcul comptent autant.

Des modèles récents font mieux que des modèles plus anciens, pourtant beaucoup plus gros.`,
    chapter: 6,
  },
  {
    category: 'Idées reçues',
    question: '« Il est conscient », « il a des intentions »',
    answer: `Rien de ce que montre ce cours ne permet de le dire. On y voit des multiplications, des additions et des tirages. Savoir si un tel calcul peut s’accompagner d’une expérience vécue est une question ouverte, que ni les ingénieurs ni les philosophes n’ont tranchée.

Quand un modèle écrit « je pense » ou « je ressens », il écrit d’abord la suite plausible d’un texte.`,
    open: true,
  },

  {
    category: 'Idées reçues',
    question: '« Quand il dit “je”, il parle de lui »',
    answer: `Il écrit la suite la plus plausible. S’il répond « je suis un assistant », c’est que ses exercices corrigés contenaient cette réplique, ou que l’application la lui rappelle au début de chaque conversation.

Le mini-assistant du chapitre 11 répond « je suis un assistant » pour exactement cette raison : la réplique figure dans ses dialogues d’entraînement. Ce n’est pas un souvenir de soi.`,
    chapter: 10,
  },

  // ── Erreurs et limites ──
  {
    category: 'Erreurs et limites',
    question: 'Pourquoi invente-t-il des choses fausses ?',
    answer: `Parce qu’il est entraîné à produire une suite plausible, pas une suite vérifiée. Quand il manque d’information, la suite la plus plausible reste une phrase fluide et assurée : une date précise, une citation, une référence, simplement fausses. On appelle cela une hallucination.

On la réduit en donnant au modèle des documents à lire. On ne sait pas la supprimer.`,
    chapter: 9,
  },
  {
    category: 'Erreurs et limites',
    question: 'Pourquoi se trompe-t-il dans un calcul, ou pour compter les lettres d’un mot ?',
    answer: `Pour les lettres : il ne voit pas des lettres mais des tokens, des morceaux de mots. Compter les « r » d’un mot lui demande de connaître par cœur l’orthographe de chaque morceau.

Pour les calculs : il ne pose pas l’opération, il devine un résultat plausible. Cela marche pour 2 + 2, moins pour de grands nombres. Il s’en sort bien mieux quand il écrit ses étapes, ou quand l’application lui fournit une calculatrice.`,
    chapter: 6,
  },
  {
    category: 'Erreurs et limites',
    question: 'Pourquoi ne connaît-il pas les événements récents ?',
    answer: `Son entraînement s’est arrêté à une date donnée, et ses boutons n’ont plus bougé depuis. Tout ce qui s’est passé ensuite lui est inconnu.

Sauf si on le lui écrit dans la conversation, ou si l’application va le chercher pour lui.`,
  },
  {
    category: 'Erreurs et limites',
    question: 'Pourquoi un petit changement de formulation change-t-il la réponse ?',
    answer: `Parce que ta question est le texte à continuer. Chaque mot que tu écris modifie les regards, donc les probabilités de tous les mots suivants.

Deux formulations qui te semblent équivalentes ne sont pas le même texte pour le modèle.`,
    chapter: 9,
  },
  {
    category: 'Erreurs et limites',
    question: 'D’où viennent ses biais ?',
    answer: `Des textes. Le modèle retient les régularités de ce qu’il a lu, stéréotypes et déséquilibres compris : si un métier est plus souvent associé à un genre dans les textes, il le sera dans ses probabilités.

Les concepteurs corrigent une partie de ces biais lors du second entraînement, sans les faire disparaître.`,
    chapter: 2,
  },
  {
    category: 'Erreurs et limites',
    question: 'Peut-on savoir pourquoi il a donné telle réponse ?',
    answer: `Rarement, et c’est un domaine de recherche à part entière : l’interprétabilité. On sait ouvrir un modèle, observer ses regards, débrancher une pièce pour voir ce qui casse. C’est ce que fait le chapitre 10 sur une petite machine. Sur un grand modèle, on n’explique aujourd’hui qu’une petite partie des calculs.

Et l’explication que le modèle donne de lui-même n’est pas fiable : c’est encore un texte plausible.`,
    chapter: 7,
  },
  {
    category: 'Erreurs et limites',
    question: 'Pourquoi le mini-GPT du cours se trompe-t-il sur les baleines ?',
    answer: `Parce qu’il n’a jamais lu de question sur la baleine, et que son monde est trop petit pour qu’il relie solidement « baleines » au féminin. Il répond « ils nagent » : le verbe est juste, le pronom est faux.

C’est une vraie erreur de vrai modèle, pas un bug. Les grands modèles évitent celle-ci grâce à des milliards d’exemples, et en commettent d’autres, du même genre, sur des sujets rares.`,
    chapter: 9,
  },

  // ── Du cours aux vrais modèles ──
  {
    category: 'Du cours aux vrais modèles',
    question: 'Quelle différence entre le mini-GPT du cours et un assistant comme ChatGPT ?',
    answer: `Le plan est le même ; presque tout le reste change d’échelle. Le mini-GPT a 63 312 boutons et a lu des phrases sur douze animaux. Un grand modèle a des centaines de milliards de boutons et a lu une bonne part de ce qui est publié en ligne.

Un assistant a en plus reçu des exercices corrigés et des exercices notés (chapitre 11), et tourne dans une application qui lui ajoute des consignes et des outils.`,
    chapter: 8,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Les modèles d’aujourd’hui sont-ils encore construits comme GPT-3 ?',
    answer: `Sur le fond, oui : deviner le token suivant, des couches de regards et de neurones, une pente à descendre. Ce sont surtout des pièces qui ont changé.

<strong>La place des mots</strong> n’est plus forcément ajoutée à la bande : beaucoup de modèles font tourner la question et l’étiquette d’un angle qui dépend de la position (RoPE). Le regard perçoit alors directement l’écart entre deux mots.

<strong>Le mélange d’experts</strong> : chaque couche a plusieurs blocs de neurones, et un aiguillage n’en active que quelques-uns par token.

S’y ajoutent des regards qui partagent leurs étiquettes et leurs contenus pour économiser la mémoire, une remise à l’échelle simplifiée, et une fenêtre passée de 2 048 tokens à souvent plus de 100 000.`,
    chapter: 8,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Qu’est-ce que le cours simplifie ?',
    answer: `Quatre choses surtout. Les tokens sont des mots entiers, pas des morceaux. Les cartes sont en deux dimensions, pour être dessinées, au lieu de milliers. Les modèles sont minuscules, et leurs mondes aussi. Et au chapitre 11, les dialogues et les notes sont produits automatiquement, alors que ceux des vrais assistants sont écrits ou jugés par des personnes.

Aucune de ces simplifications ne change le mécanisme.`,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Les animations sont-elles de vrais calculs ?',
    answer: `Oui. Tout ce qui bouge à l’écran est calculé dans ton navigateur par de vrais petits modèles, avec leurs vrais nombres. Rien n’est scénarisé : c’est pour cela que certains résultats sont imparfaits, et que le cours le dit.

Seuls les modèles des chapitres 9, 10 et 11 sont entraînés à l’avance, parce que cela demande plusieurs minutes.`,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Qu’est-ce qu’un modèle de base ?',
    answer: `Le modèle tel qu’il sort du premier entraînement, avant les dialogues. Il a lu des montagnes de textes et sait beaucoup de choses, mais il ne répond pas : il continue. Pose-lui une question, il risque d’écrire la question suivante d’un quiz, ou la suite d’un forum.

Le chapitre 11 en montre un, en miniature, avant d’en faire un assistant.`,
    chapter: 10,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Qu’est-ce que le RLHF ?',
    answer: `L’apprentissage par renforcement à partir de retours humains. Des personnes comparent des réponses du modèle ; on entraîne un <strong>juge</strong> à prédire leurs préférences ; puis on note le modèle avec ce juge, et on rend ses réponses bien notées plus probables.

C’est la méthode des exercices notés quand aucun correcteur exact n’existe. Sa faiblesse : un juge imparfait peut être trompé, si l’on optimise trop longtemps.`,
    chapter: 10,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Qu’est-ce que le réglage fin (fine-tuning) ?',
    answer: `Un entraînement supplémentaire, plus court, sur des textes choisis : des dialogues pour en faire un assistant, des documents juridiques pour le spécialiser en droit.

Le mécanisme est exactement celui du premier entraînement. On part simplement de boutons déjà réglés, au lieu de partir du hasard.`,
    chapter: 10,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Comment peut-il lire mes documents ou chercher sur le web ?',
    answer: `En les mettant dans son texte. L’application récupère les passages utiles, les colle avant ta question, et le modèle les lit grâce à ses regards, comme le modèle du chapitre 6 lit sa fiche.

Il ne les a pas appris : il les a sous les yeux le temps de la réponse. C’est aujourd’hui le moyen le plus efficace de réduire les inventions.`,
    chapter: 5,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'Et les images, la voix ?',
    answer: `Même machine, autres morceaux. Une image est découpée en petits carrés, un son en courts extraits, et chacun est transformé en liste de nombres, comme un token. Le modèle les traite ensuite avec les mêmes regards et les mêmes neurones.

Créer une image de toutes pièces repose souvent sur une autre technique, hors du sujet de ce cours.`,
  },
  {
    category: 'Du cours aux vrais modèles',
    question: 'De quoi le cours ne parle-t-il pas ?',
    answer: `Du coût en énergie, du droit d’auteur sur les textes d’entraînement, des effets sur le travail, des risques et de la sécurité. Ce sont des questions importantes, mais elles ne portent pas sur le mécanisme.

Le cours veut te donner de quoi les aborder en sachant ce qu’est réellement la machine.`,
  },

  // ── Suivre le cours ──
  {
    category: 'Suivre le cours',
    question: 'Faut-il être bon en maths ?',
    answer: `Non. Le parcours principal ne demande que des multiplications et des additions, et tu peux les laisser faire à la machine.

Les sections « Ouvrir le capot » vont plus loin, pour qui veut voir les calculs en détail. Elles sont facultatives.`,
  },
  {
    category: 'Suivre le cours',
    question: 'À quoi servent les sections « Ouvrir le capot » ?',
    answer: `À montrer le vrai calcul derrière une idée, avec les nombres du modèle que tu viens d’entraîner. Le parcours principal donne l’intuition ; le capot donne le détail.

Tu peux lire tout le cours sans en ouvrir un seul.`,
  },
  {
    category: 'Suivre le cours',
    question: 'Pourquoi des mondes aussi petits : des fiches, douze animaux ?',
    answer: `Pour pouvoir tout voir. Dans un vrai modèle, il y a trop de nombres pour suivre quoi que ce soit à l’œil. Avec douze animaux et quelques milliers de boutons, on peut regarder chaque regard, débrancher chaque pièce, et vérifier ce qu’on affirme.

Le mécanisme, lui, est le même.`,
    chapter: 8,
  },
  {
    category: 'Suivre le cours',
    question: 'Dans quel ordre lire, et en combien de temps ?',
    answer: `Dans l’ordre, la première fois : chaque chapitre répond à une question que le précédent laisse ouverte. Compte une à deux heures pour le parcours principal.

Si tu veux d’abord l’effet d’ensemble, va au grand zoom, à la fin du chapitre 10, puis remonte vers ce qui t’intrigue.`,
    chapter: 9,
  },
  {
    category: 'Suivre le cours',
    question: 'Je bloque sur un passage : que faire ?',
    answer: `Cherche d’abord ici : la plupart des blocages viennent d’un mot mal défini ou d’une étape sautée. Si le blocage porte sur les nombres d’un mot, ce qu’ils représentent ou la façon de les corriger, reprends le début du chapitre 3 : tout le reste en découle.

Et si un passage reste obscur, c’est probablement le cours qui est en faute, pas toi.`,
    chapter: 2,
  },
];

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]+>/g, ' ');

/** Un identifiant lisible pour l'adresse d'une question. */
export const slug = (question: string): string => plain(question).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Les questions qui contiennent tous les mots cherchés, sans tenir compte des accents ni des majuscules. */
export function search(query: string, entries: readonly Entry[] = ENTRIES): Entry[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const haystack = plain(entry.question + ' ' + entry.answer);
    return words.every((word) => haystack.includes(word));
  });
}
