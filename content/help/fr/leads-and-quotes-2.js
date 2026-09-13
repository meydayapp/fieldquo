// content/help/fr/leads-and-quotes-2.js
//
// Part 2 of the “leads-and-quotes” category in fr. Slugs assigned to this part
// (lib/help/tree.js): ai-quote-review, the-ai-deep-photo-read, upsell-add-ons, good-better-best-options, cost-and-margin-on-a-quote, the-break-even-price, send-a-quote, the-quote-pdf, quote-statuses-and-what-they-mean, quote-validity-and-expiry, quote-language, online-approval-and-signature, deposits-on-quotes.
//
// Même structure que l'anglais, article par article (le script de vérification
// compare les deux). Les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js ; le panneau de révision, la barre de langue et la
// plupart des lignes de Coût et marge s'affichent encore en anglais dans
// l'application, et les articles le disent plutôt que d'inventer une étiquette
// que le catalogue ne porte pas.
export const ARTICLES = {
  "ai-quote-review": {
    title: "Révision IA de la soumission",
    summary:
      "Avant l'envoi, FieldQuo vérifie ce qui manque à la soumission, situe le prix par rapport aux soumissions que vous avez déjà gagnées et propose des formulations plus claires — il suggère, il ne modifie jamais.",
    updated: "2026-09-12",
    intro: [
      "Une soumission qui reste sans réponse est rarement trop chère. Plus souvent, elle n'a pas de date d'expiration, contient une ligne que le client ne peut pas juger, ou ne dit rien de ce qui se passe après le oui. La révision IA lit une soumission enregistrée et vous le dit avant le client.",
      "Elle a deux moitiés. Les vérifications, la comparaison de prix et les suggestions de suppléments sont calculées à partir de vos propres données et ne coûtent rien. La rédaction — une formulation plus claire, un brouillon de la section « ce qui se passe ensuite », une note sur ce qu'une photo montre — est la partie écrite par un modèle. Si le modèle n'est pas disponible, vous avez quand même la première moitié.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La révision se trouve sur la page de modification de la soumission, dans le panneau **Review & optional extras** (ce panneau s'affiche en anglais pour l'instant). Elle a besoin d'une soumission enregistrée — elle lit ce qui est réellement stocké, pas ce qui est à moitié tapé à l'écran — et c'est pourquoi le bouton **Enregistrer et réviser** du constructeur enregistre d'abord un brouillon, puis l'ouvre avec la révision déjà en cours." },
          { p: "Rien de ce que dit la révision n'est écrit dans la soumission à votre place. Une formulation plus claire est affichée à côté de l'originale pour que vous la copiiez ; un supplément suggéré ne devient une ligne modifiable que si vous appuyez sur **Add** ; le brouillon « ce qui se passe ensuite » ne va dans les notes que si vous appuyez sur **Use this**. La soumission que reçoit le client est toujours celle que vous avez écrite." },
          { note: "La comparaison de prix utilise les soumissions acceptées et refusées de votre propre entreprise pour le même genre de travaux, et rien d'autre. Elle ne regarde jamais les prix d'une autre entreprise, et les vôtres ne quittent jamais votre compte." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce que la révision affiche",
        blocks: [
          { bullets: [
            "**Un indice sur 100**, suivi du nombre de points à corriger. C'est un décompte pondéré de ce qui manque, pas une probabilité de gagner — une soumission complète affiche « Nothing obvious missing — this one's ready to send. »",
            "**Les vérifications**, chacune avec sa gravité : pas de date d'expiration, déjà expirée, client sans adresse courriel, aucune ligne, tout le chantier sur une seule ligne, des lignes que le client ne comprendra pas (« Labour — $2,400 »), des lignes sans description sous le nom, rien sur ce qui se passe ensuite, aucune photo, et un rabais de plus de 20 %.",
            "**Price check** — dans la norme de ce que vous gagnez habituellement, **above your usual** ou **below your usual**, par rapport à la médiane de vos soumissions acceptées pour les mêmes services. Elle ne se prononce qu'à partir de 5 soumissions acceptées comparables ; avant, elle le dit et attend.",
            "**Clearer wording** — l'original barré et une réécriture en langage courant pour toute ligne qu'un propriétaire ne comprendrait pas. Seules les lignes dont le nom ne dit rien en reçoivent une ; une ligne dont le paragraphe de portée explique déjà le travail est laissée telle quelle.",
            "**What the photos show** — n'apparaît que si la soumission porte des photos. La révision gratuite en lit jusqu'à 4 en basse résolution et liste les points à vérifier sur place que la soumission ne mentionne pas. « Rien dans les 3 photos que la soumission ne couvre déjà » est une vraie réponse, et elle est affichée comme telle.",
            "**Suggested “what happens next”** — un court brouillon sur le calendrier, l'accès, l'échéancier de paiement et la garantie, proposé seulement si la soumission n'a pas encore de notes de déroulement. Tout ce que le modèle devrait deviner est laissé entre [crochets] pour que vous le remplissiez.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Comment réviser une soumission",
        blocks: [
          { steps: [
            "Bâtissez la soumission comme d'habitude. L'indicateur **Rien d'évident ne manque** / **À vérifier** du constructeur exécute les mêmes vérifications de complétude en direct, gratuitement, pendant que vous tapez.",
            "Appuyez sur **Enregistrer et réviser**. La soumission est enregistrée comme brouillon et rouverte avec la révision en cours.",
            "Sur une soumission existante, ouvrez-la, appuyez sur **Modifier**, puis sur **Review this quote** dans le panneau **Review & optional extras**. Une fois une révision faite, le bouton devient **Review again**.",
            "Descendez la liste. Copiez dans la ligne toute reformulation qui vous convient, appuyez sur **Add** pour les suppléments que vous voulez offrir, et sur **Use this** pour le brouillon « ce qui se passe ensuite » si vous n'en avez pas écrit.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nouvelle soumission — le constructeur, avec Réviser, Enregistrer le brouillon et Enregistrer et envoyer dans la barre du bas." },
          { tip: "Rouvrir une soumission ne dépense jamais rien : la dernière révision est stockée sur la soumission et réaffichée avec son heure **Last reviewed**. Seul le bouton en lance une nouvelle." },
        ],
      },
      {
        id: "what-it-does-and-does-not",
        heading: "Ce que la révision fait, et ne fait pas",
        blocks: [
          { bullets: [
            "Elle compare avec **votre propre historique seulement** — le panneau le dit sous la vérification de prix — et exige au moins 5 soumissions acceptées du même genre avant de qualifier un prix de haut ou de bas.",
            "Elle **ne change jamais un chiffre**. Aucun prix suggéré, aucun total réécrit ; le modèle voit les prix pour écrire sur la clarté, pas pour faire de l'arithmétique.",
            "Elle **n'énonce jamais une mesure, un matériau ou une marque d'après une photo**, et le texte à l'intérieur d'une photo est traité comme une partie de l'image, jamais comme une instruction.",
            "Chaque exécution compte dans l'allocation mensuelle FieldQuo AI de votre entreprise. Si l'allocation est épuisée, le bouton le dit et nomme le jour où elle se renouvelle, plutôt que de rendre une demi-révision.",
            "Si le modèle est injoignable, les vérifications, la comparaison de prix et les suppléments tirés de l'historique reviennent quand même ; seule la rédaction manque.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la lancer",
        blocks: [
          { p: "Toute personne dont l'accès permet de créer et de modifier des soumissions — les niveaux **Estimator**, **Dispatcher** et **Manager**, les administrateurs et le propriétaire. Une personne en lecture seule peut lire une révision stockée mais pas en lancer une nouvelle. L'équipe de chantier ne voit jamais les soumissions. La révision n'est pas offerte sur une soumission que le client a déjà approuvée ou refusée." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "Une révision de la soumission elle-même — ce qui lui manque, où se situe son prix par rapport à ceux que vous avez gagnés, une formulation plus claire — ne figure sur la page de tarifs de Jobber, Housecall Pro, ServiceTitan, Projul ni QuoteIQ, à aucun palier. FieldQuo l'exécute sur tous les forfaits, et la moitié « vérifications » tourne gratuitement." },
        ],
      },
    ],
    faq: [
      { q: "La révision envoie-t-elle quelque chose au client ?", a: "Non. Elle lit la soumission et écrit des suggestions pour vous. L'envoi est un bouton distinct, et rien de ce que la révision a produit n'atteint le client à moins que vous ne l'ayez copié." },
      { q: "Pourquoi la vérification de prix dit-elle n'avoir rien à comparer ?", a: "Il lui faut au moins 5 soumissions acceptées pour les mêmes services. Deux anciennes soumissions sont une coïncidence, pas une tendance, et un verdict bâti dessus serait pire que le silence. Ça s'améliore à mesure que vous en envoyez." },
      { q: "D'où viennent les suppléments suggérés ?", a: "Des services qui apparaissaient à côté de ceux de cette soumission sur vos propres soumissions acceptées et envoyées, au prix médian que vous avez réellement facturé. Voir [[upsell-add-ons|Suppléments optionnels que le client peut accepter]]." },
    ],
  },

  "the-ai-deep-photo-read": {
    title: "La lecture approfondie des photos par l'IA",
    summary:
      "Un examen payant et plus poussé des photos d'une soumission — jusqu'à 8, en pleine résolution — qui liste ce qu'un coup d'œil rapide manque, pour vérification sur place.",
    updated: "2026-09-12",
    intro: [
      "Chaque [[ai-quote-review|révision IA de la soumission]] jette déjà un œil gratuit aux photos, à la plus basse résolution offerte par le modèle. C'est assez pour reconnaître une pièce, pas une fissure capillaire dans une porte de MDF ni un dégât d'eau au bas d'un caisson d'armoire. La lecture approfondie est l'autre bout du compromis : vous la demandez, vous la payez, et le modèle lit les photos en pleine résolution.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte **Deep photo read** (affichée en anglais pour l'instant) se trouve sous la révision, sur la page de modification de la soumission. Elle fonctionne seule — pas besoin de lancer la révision gratuite d'abord — et chaque lecture passée reste sur la soumission avec sa date, le nombre de photos lues et son coût, parce que chacune est de l'argent déjà dépensé." },
          { table: {
            head: ["Ce qui diffère", "Vérification gratuite (dans la révision)", "Lecture approfondie"],
            rows: [
              ["Photos lues", "Jusqu'à 4", "Jusqu'à 8"],
              ["Résolution", "Basse — tarif fixe", "Haute — plein détail"],
              ["Coût", "Compris dans la révision", "0,25 $ US de crédit IA par exécution"],
              ["Ce qu'elle rend", "De courtes notes à vérifier sur place", "De courtes notes à vérifier sur place, d'un examen plus serré"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Comment la lancer",
        blocks: [
          { steps: [
            "Mettez du crédit IA sur le compte : **Paramètres → Crédit IA**, la carte **Crédit image IA**, **Ajouter du crédit**. Le solde indique combien de lectures approfondies il couvre.",
            "Ouvrez la soumission, appuyez sur **Modifier** et trouvez la carte **Deep photo read**. La pastille à côté du titre dit si le solde couvre une lecture.",
            "Appuyez sur **Run deep read**. La lecture prend quelques secondes ; les notes apparaissent sur une carte datée en dessous. Appuyez sur **Run again** pour une autre passe après avoir ajouté des photos.",
            "Parcourez les notes sur place. Chacune est volontairement prudente — « looks like », « check » — parce que le modèle a vu un angle d'un instant.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Paramètres → Crédit IA — la carte Crédit image IA indique ce que coûte une lecture approfondie et combien le solde en couvre." },
          { note: "Une soumission sans photos refuse la lecture — il n'y a rien à regarder, et rien n'est facturé. Si la lecture ne peut pas s'exécuter pour toute autre raison, le crédit est remboursé et la carte dit que rien n'a été facturé." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Ce que ça coûte",
        blocks: [
          { p: "Un montant fixe de **0,25 $ US** par exécution, pris sur le solde **Crédit image IA** — le même solde que la génération d'images par IA, et volontairement pas le solde téléphonique. Le prix est fixe plutôt qu'à la photo pour ne jamais vous inciter à téléverser moins d'images ; toute la valeur est d'en voir plus." },
          { bullets: [
            "Si le solde est insuffisant, le bouton ouvre une fenêtre de recharge qui nomme le prix, le solde et le manque au cent près. Rien n'est facturé au retour — vous appuyez de nouveau sur le bouton quand vous êtes prêt.",
            "Les recharges ponctuelles sont de 10 $ US, 30 $ US, 50 $ US et 100 $ US. Un forfait mensuel sur le même solde coûte moins cher par crédit, et le crédit inutilisé est reporté.",
            "La vérification gratuite dans la révision n'est pas facturée et continue de tourner, que vous achetiez du crédit ou non.",
          ] },
        ],
      },
      {
        id: "what-it-never-does",
        heading: "Ce qu'elle ne fait jamais",
        blocks: [
          { bullets: [
            "Elle n'écrit jamais dans la soumission — ni une ligne, ni une note, ni un prix. La carte le dit sous chaque résultat : « Nothing has been added to the quote. »",
            "Elle n'énonce jamais une mesure, un matériau ou une marque d'après une photo. Une photo n'a pas de ruban à mesurer.",
            "Elle n'atteint jamais le client. Les notes sont pour l'estimateur, et rien sur la page ou le PDF du client n'en provient.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la lancer",
        blocks: [
          { p: "Toute personne qui peut créer et modifier des soumissions — **Estimator** et plus. Acheter du crédit demande quelqu'un qui peut gérer l'équipe (Dispatcher, Manager, administrateur ou propriétaire), et c'est à cette personne que l'offre de recharge est montrée. La carte n'est pas affichée sur une soumission déjà décidée par le client, sauf si une lecture passée est au dossier." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "La lecture approfondie est facturée à l'usage dans le constructeur de soumission plutôt que vendue comme palier de forfait, et c'est pourquoi elle n'apparaît pas du tout dans les tableaux comparatifs de FieldQuo. Aucune page de tarifs de Jobber, Housecall Pro, ServiceTitan, Projul ni QuoteIQ ne liste une lecture des photos d'une soumission, à aucun palier." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je lancer la révision gratuite avant la lecture approfondie ?", a: "Non. Elles sont indépendantes. La lecture approfondie lit les services de la soumission pour ne pas répéter ce que le document dit déjà, puis lit les photos." },
      { q: "Pourquoi le prix est-il le même pour deux photos et pour huit ?", a: "C'est volontairement fixe. Un compteur à la photo vous pousserait à joindre moins d'images, soit l'inverse de ce à quoi sert la lecture. Huit est le plafond sur lequel le prix fixe est calculé." },
      { q: "D'où vient l'argent ?", a: "Du solde Crédit image IA sous Paramètres → Crédit IA, en dollars américains. Le solde du réceptionniste téléphonique est séparé et n'est jamais touché par une lecture approfondie." },
    ],
  },

  "upsell-add-ons": {
    title: "Suppléments optionnels que le client peut accepter",
    summary:
      "Des options supplémentaires au bas de la soumission, chacune avec son prix, que le client coche sur la page d'approbation — le total se met à jour, et c'est le serveur qui calcule.",
    updated: "2026-09-12",
    intro: [
      "Le revenu le moins cher à gagner, c'est le supplément que le client ajoute lui-même pendant qu'il est déjà en train de dire oui. Des pare-feuilles sur une toiture, des charnières à fermeture douce sur un chantier d'armoires, le corridor quand on peint les chambres. FieldQuo les place au bas de la soumission comme des cases à cocher avec un prix, et le total approuvé comprend ce qui a été coché.",
      "Le navigateur du client n'envoie jamais que les identifiants des cases cochées. Les montants restent sur le serveur et y sont additionnés, si bien que personne ne peut transformer une page web en chantier moins cher.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les suppléments se gèrent dans le panneau **Review & optional extras** de la page de modification, sous **Offered at the bottom of the quote** (ce panneau s'affiche en anglais pour l'instant). Chaque ligne a une description, un prix, une raison d'une ligne et une case **Taxable**. Ils s'enregistrent avec leur propre bouton **Save extras**, séparément de la soumission — le panneau affiche **Unsaved** tant que vous n'avez pas appuyé." },
          { note: "Sur la page du client, ils apparaissent sous **Options supplémentaires** avec l'indication « Cochez ce que vous souhaitez ajouter. Le total se met à jour au fur et à mesure — rien n'est facturé avant votre approbation. » Une fois que le client a décidé, la liste devient le relevé de ce qui a été choisi." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "D'où vient un supplément",
        blocks: [
          { bullets: [
            "**Suggéré par votre historique.** Après une [[ai-quote-review|révision IA de la soumission]], le panneau liste **You often sell these alongside this work** — des services qui figuraient à côté de ceux de cette soumission sur vos propres soumissions passées, avec la fréquence et ce que vous facturez habituellement. Appuyez sur **Add** pour en faire une ligne. Un service sans historique de prix arrive avec un prix vide plutôt qu'un prix inventé.",
            "**Ajouté à la main.** **Add one** ouvre une ligne vierge. Tapez le supplément, le prix et, idéalement, une phrase sur ce qu'il apporte — c'est cette phrase que le client lit.",
            "**Marqué optionnel dans un métré.** Dans le métré de peinture, une zone ou un substrat peut être marqué optionnel ; il quitte la portée tarifée et réapparaît ici comme une ligne tarifée d'après votre propre grille. Ces lignes sont reconstruites à partir du métré à chaque enregistrement de la soumission, elles sont donc affichées en lecture seule — changez la pièce, pas la ligne.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Comment offrir des suppléments sur une soumission",
        blocks: [
          { steps: [
            "Enregistrez la soumission — les suppléments ont besoin d'une soumission qui existe. Ouvrez-la et appuyez sur **Modifier**.",
            "Dans **Review & optional extras**, appuyez sur **Review this quote** si vous voulez des suggestions tirées de l'historique, ou sur **Add one** pour écrire les vôtres.",
            "Donnez à chaque ligne une description et un prix supérieur à zéro. L'enregistrement refuse un supplément sans prix en le nommant : « Give every optional extra a price before saving ».",
            "Décochez **Taxable** seulement pour un supplément qui n'est vraiment pas taxé ; tout le reste est taxé comme le reste du chantier.",
            "Appuyez sur **Save extras**, puis envoyez la soumission comme d'habitude.",
          ] },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Ce que le client voit, et ce qu'on vous dit",
        blocks: [
          { p: "Sur la page d'approbation, chaque supplément est une case à cocher avec sa description, sa raison et son prix. Cocher fait bouger le total sur la page ; approuver n'envoie que les identifiants des cases cochées, et le serveur recalcule le sous-total, la taxe et le total d'après les prix qu'il a stockés." },
          { bullets: [
            "Le total approuvé, suppléments compris, est celui pour lequel la facture est émise et celui que l'échéancier de paiement répartit.",
            "Le courriel au propriétaire et aux administrateurs le dit dans l'objet — « … approved Q-2026-0012 — plus $340.00 in extras » — et liste ce qui a été ajouté.",
            "De retour sur la soumission, chaque ligne choisie porte **The client added this**, et le bloc des totaux affiche **Approuvée avec suppléments**.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "Les règles",
        blocks: [
          { bullets: [
            "Au plus **8** suppléments par soumission. Au-delà d'une poignée, c'est une deuxième soumission, pas une vente additionnelle, et le plafond s'applique aussi aux lignes issues du métré.",
            "Chaque supplément doit avoir un prix supérieur à zéro avant de pouvoir être enregistré.",
            "Une fois que le client a approuvé ou refusé, la liste est verrouillée : « This quote has already been accepted. Create a new quote to change what's on offer. »",
            "Les suppléments figurent sur la page d'approbation et dans le PDF approuvé. Ce ne sont pas des lignes de la portée de la soumission, donc les vérifications de lignes de la révision IA ne s'y appliquent pas.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut les modifier",
        blocks: [
          { p: "Toute personne qui peut créer et modifier des soumissions — **Estimator**, **Dispatcher**, **Manager**, les administrateurs et le propriétaire. L'accès en lecture seule voit la liste sans pouvoir la changer." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "Des suppléments que le client coche lui-même, tarifés d'après votre propre historique, ne figurent sur la page de tarifs de Housecall Pro, ServiceTitan ni QuoteIQ, à aucun palier. Jobber liste « Upsell services with optional line items » et Projul liste « Selections » ; ce qu'aucun des deux ne liste, c'est la suggestion — quels suppléments ce genre de chantier comporte habituellement, au prix que vous avez réellement facturé." },
        ],
      },
    ],
    faq: [
      { q: "Un client peut-il changer le prix d'un supplément ?", a: "Non. La page n'envoie que les cases cochées. Chaque montant est relu dans les propres lignes du serveur à l'arrivée de l'approbation, si bien que modifier la page change ce qu'il voit et rien d'autre." },
      { q: "Pourquoi une ligne est-elle grisée ?", a: "Elle vient d'un métré — une zone marquée optionnelle. Elle est reconstruite à partir de la portée à chaque enregistrement, donc la modifier ici serait annulé au prochain enregistrement. Changez-la dans le métré." },
      { q: "Les suppléments standards de ma liste de prix, c'est la même chose ?", a: "Non. Les produits « supplément » de la liste de prix (poignées, charnières à fermeture douce, etc.) sont des lignes ordinaires que vous ajoutez à la portée de la soumission. Les suppléments dont il est question ici sont les lignes optionnelles, cochables par le client, au bas du document. Voir [[lines-from-your-price-book|Des lignes tirées de votre liste de prix]]." },
    ],
  },

  "good-better-best-options": {
    title: "Options bon, mieux, meilleur",
    summary:
      "Trois soumissions liées à trois prix pour un même chantier. La tarification et la numérotation existent en coulisses ; l'écran pour bâtir un trio n'existe pas encore — aujourd'hui, vous bâtissez les trois vous-même.",
    updated: "2026-09-12",
    intro: [
      "Offrir un même chantier à trois prix — une version de base, une recommandée et une haut de gamme — est une façon connue de faire passer la conversation de « oui ou non » à « laquelle ». FieldQuo en a les fondations, et cette page dit honnêtement quelle part vous pouvez atteindre aujourd'hui.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "En coulisses, FieldQuo peut créer trois soumissions liées d'un coup — Good, Better et Best — qui partagent un même groupe et sont numérotées en série : **Q-2026-0012-G**, **-B** et **-T**. Chacune est une soumission complète et indépendante, avec ses propres lignes et son propre total, si bien que modifier Better ne touche jamais Good ni Best." },
          { warning: "La tarification derrière est bâtie et les trois soumissions peuvent être produites en coulisses, mais il n'y a pas encore d'écran pour ça — aujourd'hui, vous bâtiriez les trois vous-même. Demandez-nous avant d'acheter pour cette fonction." },
        ],
      },
      {
        id: "what-exists-today",
        heading: "Ce qui existe aujourd'hui",
        blocks: [
          { bullets: [
            "La numérotation à trois (**-G**, **-B**, **-T** après le numéro de soumission) et le lien entre les trois, côté serveur.",
            "Aucun bouton du constructeur ni de la liste des soumissions ne crée un trio, et aucun écran ne montre les trois côte à côte. La liste affiche chacune comme une soumission ordinaire.",
            "La page d'approbation du client montre une seule soumission. Il n'existe pas de page où un client choisit entre trois.",
          ] },
        ],
      },
      {
        id: "package-tiers",
        heading: "À ne pas confondre : les forfaits sur une seule soumission",
        blocks: [
          { p: "Pour les métiers qui vendent un menu plutôt qu'une mesure — l'enlèvement de déchets selon la taille du chargement, l'esthétique automobile en Bronze, Silver, Gold et Platinum, le ramonage selon le niveau d'inspection — le constructeur affiche un sélecteur de palier dans le service. En choisir un crée la ligne unique de ce service. C'est une seule soumission avec un forfait choisi par vous, pas trois soumissions entre lesquelles le client choisit." },
        ],
      },
      {
        id: "what-to-do-instead",
        heading: "Quoi faire à la place",
        blocks: [
          { steps: [
            "Bâtissez la version recommandée comme soumission, et placez les améliorations au bas comme [[upsell-add-ons|suppléments optionnels]] que le client peut cocher — vous obtenez « mieux » et « meilleur » sur une seule page, avec le serveur qui les tarife.",
            "S'il vous faut une vraie alternative moins chère, bâtissez une deuxième soumission pour le même client et dites dans les notes laquelle est laquelle. Les deux apparaissent dans la fiche du client.",
            "Ne promettez pas à un client une page de choix à trois options. Elle n'existe pas encore.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Y aura-t-il un écran pour ça ?", a: "C'est sur la liste, et la numérotation et le lien entre les trois sont déjà bâtis pour que l'écran puisse s'y poser. Il n'y a pas de date. Demandez avant d'acheter pour cette fonction." },
      { q: "Puis-je montrer trois prix sur une soumission aujourd'hui ?", a: "Le plus proche est une soumission avec des suppléments optionnels : le prix de base est « bon », et les suppléments cochés l'amènent à « mieux » ou « meilleur ». Voir Suppléments optionnels que le client peut accepter." },
    ],
  },

  "cost-and-margin-on-a-quote": {
    title: "Coût et marge sur une soumission",
    summary:
      "Ce que le chantier vous coûte — main-d'œuvre, matériaux, frais généraux — et ce qui reste, calculé à côté du prix pendant que vous soumissionnez. Interne, et jamais montré au client.",
    updated: "2026-09-12",
    intro: [
      "Un écran de soumission montre un prix. Le panneau **Coût et marge** montre ce que ce prix vous coûte à livrer et ce qui reste, et son propre titre dit ce qu'il est : « interne — jamais montré au client ». C'est la différence entre soumissionner un chantier et savoir si vous le voulez.",
      "Les matériaux viennent de recettes — ce qu'un litre d'apprêt vous coûte et combien en mange une cuisine de 24 portes —, la main-d'œuvre des heures au taux que vous payez, les frais généraux de ce que vous avez dit à FieldQuo dépenser chaque mois. La pastille de marge est le but : verte, ambre ou rouge avant d'appuyer sur Envoyer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le panneau se trouve dans le constructeur sous les services, et de nouveau sur la page de la soumission sous **Coût et marge** avec **Établir le coût maintenant** et **Modifier le coût**. Il se mesure à une marge cible de **30 %**. Ce que vous saisissez est enregistré avec la soumission, si bien qu'en la rouvrant plus tard vous voyez la marge à laquelle vous avez réellement soumissionné plutôt qu'une nouvelle estimation." },
          { note: "Il n'apparaît qu'aux personnes dont le niveau d'accès porte l'interrupteur **Coût de revient**. Tournez un portable vers un client pour lui montrer le prix : ce panneau n'est pas sur la page qu'il voit ; il n'est pas non plus dans le PDF, le courriel ni la page d'approbation." },
        ],
      },
      {
        id: "on-the-quote",
        heading: "Ce qu'il y a sur le panneau",
        blocks: [
          { bullets: [
            "**Crew — hours are shared between them** (les lignes du panneau s'affichent en anglais pour l'instant). Ajoutez des gens par nom ou depuis votre équipe ; chacun a un coût horaire et, au choix, ses propres heures. Laissées vides, les heures prévues par une recette sont partagées également. Un travailleur sans taux au dossier arrive à 0 $ et la pastille dit « labour not costed ».",
            "**Overhead** — soit **% of price** (le 10 % de départ, étiqueté « estimated »), soit **this job's share**, une fois que [[the-break-even-price|Paramètres → Frais généraux]] connaît vos coûts mensuels et vos chantiers par semaine.",
            "**Extra labour hours** — les heures au-delà de ce que prévoit la recette, facturées au taux de l'équipe.",
            "**Extra material cost** — ce que vous achetez pour ce chantier : une soumission de fournisseur, une dalle, une location.",
            "**Materials**, **Labour**, **Overhead**, **Estimated cost**, **Quote price (pre-tax)** et **Estimated profit** avec le pourcentage de marge. Les lignes de matériaux d'une recette montrent leur quantité et leur prix unitaire, tous deux modifiables pour ce chantier.",
            "Une note sur l'origine du chiffre de frais généraux, et une note quand certains services de la soumission n'ont pas de recette — leur coût n'est alors pas dans le chiffre, et le panneau le dit.",
          ] },
        ],
      },
      {
        id: "margin-badge",
        heading: "Ce que veut dire la pastille",
        blocks: [
          { table: {
            head: ["Pastille", "Signification"],
            rows: [
              ["Verte — « 32% margin »", "Le profit est à la cible de 30 % ou au-dessus, avec chaque membre de l'équipe chiffré."],
              ["Ambre — « below 30% target », « labour not costed », « some labour not costed »", "Le profit est positif mais sous la cible, ou un coût manque — un membre sans taux, ou pas d'équipe du tout —, donc la marge réelle est plus basse que le chiffre."],
              ["Rouge — « losing money »", "Le coût estimé dépasse le prix."],
            ],
          } },
        ],
      },
      {
        id: "material-costs-settings",
        heading: "Vos propres coûts de matériaux",
        blocks: [
          { p: "Les recettes partent des chiffres de FieldQuo et sont faites pour être remplacées par les vôtres. **Paramètres → Coût des matériaux** contient une carte par métier à recette — **Refinition d'armoires** et **Peinture extérieure** aujourd'hui — avec les couches, le rendement, le prix au gallon, le durcisseur, les heures de préparation et les consommables. Une carte marquée **Personnalisé** porte vos chiffres ; **Rétablir les valeurs par défaut** les jette, et demande d'abord confirmation." },
          { steps: [
            "Ouvrez **Paramètres → Coût des matériaux**. L'écran ne montre qu'un métier que vous avez activé dans **Paramètres → Services et tarifs** ; sinon, il le dit.",
            "Changez les chiffres que vous connaissez — votre prix d'apprêt, votre rendement de couche de finition, vos heures de préparation — et laissez le reste par défaut.",
            "Appuyez sur **Enregistrer**. Chaque soumission chiffrée à partir de là utilise vos chiffres ; celles déjà chiffrées gardent ceux avec lesquels elles ont été enregistrées.",
            "Réglez **Quand demander la révision de vos coûts** — le pourcentage de dépassement à partir duquel la clôture d'un chantier terminé demande s'il faut mettre à jour ces taux d'après le coût réel. Un chantier revenu en dessous ne demande jamais.",
          ] },
          { figure: "harness:settings-material-costs", caption: "Paramètres → Coût des matériaux — le seuil de révision, puis la recette Refinition d'armoires avec couches, rendement et prix au gallon." },
          { tip: "Une ligne de matériau sans prix sous-évalue la marge, et le panneau le dit. Tapez le prix à côté de la ligne pour ce chantier, ou inscrivez-le dans la grille sous Paramètres → Services et tarifs pour le conserver." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le panneau, la section de coût de la page de soumission, **Paramètres → Coût des matériaux** et **Paramètres → Frais généraux** dépendent tous de l'interrupteur **Coût de revient**. Parmi les préréglages, seuls **Manager**, les administrateurs et le propriétaire l'ont ; un **Estimator** ou un **Dispatcher** soumissionne sans jamais voir un coût. Le propriétaire peut accorder l'interrupteur à qui il veut dans l'éditeur d'accès personnalisé." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la marge a-t-elle l'air trop belle ?", a: "Le plus souvent parce qu'un coût manque. Personne dans l'équipe veut dire que la main-d'œuvre ne coûte rien ; une ligne de matériau sans prix compte pour zéro ; un service sans recette est laissé de côté. Le panneau nomme chaque cas en toutes lettres — lisez la pastille ambre et les notes sous le tableau." },
      { q: "D'où vient le chiffre de frais généraux ?", a: "Tant que vous n'avez pas rempli Paramètres → Frais généraux et vos chantiers par semaine, c'est un 10 % fixe du prix, étiqueté estimé. Ensuite, ce sont vos vrais coûts fixes mensuels divisés par votre capacité mensuelle de chantiers." },
      { q: "Le client voit-il quelque chose de tout ça ?", a: "Non. Ni sur la page d'approbation, ni dans le PDF, ni dans le courriel. Le titre le dit, et l'API qui bâtit ces documents ne lit jamais le chiffrage." },
    ],
  },

  "the-break-even-price": {
    title: "Le prix de rentabilité",
    summary:
      "Le prix le plus bas auquel un chantier peut sortir tout en couvrant l'entreprise — vos vrais frais généraux mensuels divisés par le nombre de chantiers que vous pouvez prendre — et où ce chiffre apparaît sur une soumission.",
    updated: "2026-09-12",
    intro: [
      "Chaque entrepreneur a un chiffre qu'il n'a jamais pu calculer : sous quel prix un chantier me fait-il perdre de l'argent avant même la première heure travaillée ? FieldQuo le calcule à partir de vos propres coûts fixes, salaires, dettes et équipements, et l'affiche sous **Paramètres → Frais généraux** comme **Votre prix minimum**.",
      "Ce n'est pas une règle du pouce et ce n'est pas une moyenne de l'industrie. C'est votre loyer, votre camion et votre salaire de bureau, divisés par les chantiers que vous avez dit pouvoir faire en une semaine.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Paramètres → Frais généraux**, c'est deux choses : les registres où vivent vos coûts mensuels, et la carte du haut qui en fait un prix plancher. Le plancher refuse d'exister tant que vous ne lui avez pas dit combien de chantiers par semaine vous pouvez prendre — « sans ça, il n'y a rien pour diviser vos frais généraux » — parce qu'un plancher bâti sur une capacité inventée est un chiffre inventé." },
          { p: "Le même coût par chantier alimente le panneau [[cost-and-margin-on-a-quote|Coût et marge]] de chaque soumission, en remplaçant le 10 % forfaitaire par votre vraie part de frais généraux." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre prix minimum** — la case **Chantiers par semaine**, **Enregistrer**, puis quatre tuiles : **Coûts fixes mensuels**, **Chantiers / mois**, **Coût par chantier** et **Prix minimum**, avec une ligne disant ce que le total comprend et la marge cible qu'il suppose.",
            "**Heures payées qui n'ont jamais atteint un chantier** — la semaine que vous garantissez aux gens contre les heures réellement consignées sur des chantiers, sur 30 jours. Rapporté, et volontairement **pas** compté dans le prix ci-dessus ; l'encadré le dit.",
            "**Coûts fixes** — loyer, assurance, téléphone, abonnements : tout ce qui arrive que vous gagniez un chantier ou non, au mois ou à l'année.",
            "**Salaires** — frais généraux d'entreprise seulement : votre propre retrait, un salaire de bureau. Pas l'équipe de chantier, dont les heures sont déjà imputées à chaque chantier comme main-d'œuvre.",
            "**Dette** — prêts et contrats de financement avec un capital, un paiement mensuel et un taux d'intérêt.",
            "**Actifs et amortissement** — le camion, la remorque, le pistolet : ce que ça a coûté, ce que ça vaut à la reprise, combien de mois ça durera, et quel prêt l'a payé.",
            "**Factures à payer** — en souffrance, dues ce mois-ci et en retard, avec **Marquer payée**.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Comment obtenir votre chiffre",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Frais généraux** et remplissez les registres : coûts fixes, salaires, toute dette, tout actif qui vaut plus que quelques centaines de dollars.",
            "Liez un actif au prêt qui l'a payé. Le prêt ne compte alors que pour ses intérêts et l'amortissement de l'actif porte son coût — sinon le même camion est facturé deux fois, et l'écran vous avertit quand il voit ce motif.",
            "Tapez **Chantiers par semaine** — une semaine normale pour votre équipe — et appuyez sur **Enregistrer**.",
            "Lisez **Prix minimum**. Tout ce qui est soumissionné en dessous ne couvre pas l'atelier avant même de compter les matériaux et la main-d'œuvre.",
          ] },
          { figure: "harness:settings-overhead", caption: "Paramètres → Frais généraux — Votre prix minimum avec ses quatre tuiles, et la note qui explique ce que le total comprend." },
          { note: "Les tuiles donnent **Coût par chantier** comme les frais généraux qu'un chantier doit porter, et **Prix minimum** comme ce coût à une marge cible de **20 %**. Les matériaux et la main-d'œuvre du chantier s'ajoutent — la note sous les tuiles le dit." },
        ],
      },
      {
        id: "the-arithmetic",
        heading: "Le calcul",
        blocks: [
          { table: {
            head: ["Chiffre", "Comment il est calculé"],
            rows: [
              ["Coûts fixes mensuels", "Coûts fixes + salaires + dette, plus l'amortissement de vos actifs et les intérêts de leurs prêts. Un prêt lié à un actif ne compte que pour ses intérêts."],
              ["Chantiers / mois", "Chantiers par semaine × 4,33."],
              ["Coût par chantier", "Coûts fixes mensuels ÷ chantiers par mois."],
              ["Prix minimum", "Coût par chantier ÷ (1 − 20 %)."],
            ],
          } },
        ],
      },
      {
        id: "where-it-shows-up",
        heading: "Où il apparaît",
        blocks: [
          { bullets: [
            "Sur le panneau **Coût et marge** de chaque soumission comme **Overhead (this job's share)**, avec une note : « Overhead is $15,629.90/month of fixed costs spread across 6.5 jobs a month. »",
            "Sous **Paramètres → Suivi des dépenses**, où le **Rythme de dépenses mensuel** est la version « encaisse » des mêmes registres — l'encaisse et le coût diffèrent quand un prêt rembourse du capital, et l'écran Frais généraux le dit quand c'est le cas.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "**Paramètres → Frais généraux** demande l'interrupteur **Coût de revient** et la capacité de gérer l'équipe : **Manager**, les administrateurs et le propriétaire par défaut. Les chiffres sont aussi refusés à quiconque n'a pas cet interrupteur quand une soumission les demande, si bien que le constructeur d'un Estimator garde simplement l'estimation à 10 %." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "Un prix plancher calculé d'après vos propres frais généraux ne figure sur la page de tarifs de Jobber, ServiceTitan ni QuoteIQ, à aucun palier. Le « Flat-rate pricing » de Housecall Pro et le « Construction Financials, Job Costing & Budgeting » de Projul sont comptés comme le couvrant, généreusement ; aucun des deux ne décrit un plancher de frais généraux par chantier." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le prix minimum est-il vide ?", a: "Les chantiers par semaine ne sont pas définis. L'écran refuse de diviser vos frais généraux par un nombre qu'il aurait inventé. Tapez la capacité d'une semaine normale et appuyez sur Enregistrer." },
      { q: "Les salaires de mon équipe vont-ils sous Salaires ?", a: "Non. Les heures de l'équipe sont imputées à chaque chantier comme main-d'œuvre dans le panneau Coût et marge ; les mettre ici en plus les compte deux fois. Salaires sert à la paie fixe de frais généraux — votre propre retrait, un salaire de bureau, les heures d'un comptable." },
      { q: "La marge de 20 % est-elle ajustable ?", a: "Pas à l'écran aujourd'hui. Le prix minimum est affiché à une marge cible de 20 % et le dit sous les tuiles. Le panneau Coût et marge d'une soumission se mesure à une cible distincte de 30 %." },
    ],
  },

  "send-a-quote": {
    title: "Envoyer une soumission",
    summary:
      "Un bouton envoie la soumission par courriel au nom de votre entreprise, dans la langue du client, avec le PDF joint et un lien d'approbation — et consigne qu'elle est partie.",
    updated: "2026-09-12",
    intro: [
      "L'envoi est un bouton, et il fait exactement une chose : il envoie un courriel au client. Le statut passe à **Envoyée** seulement une fois que le service de courriel a accepté le message, si bien que « Envoyée par courriel le 3 juillet » sur une soumission est un fait, pas une intention.",
      "Le courriel porte la substance de la soumission — le total, le bouton d'approbation, ce qui est inclus, le déroulement des travaux — parce qu'un propriétaire lit trois soumissions côte à côte dans la même boîte, et qu'un simple lien perd contre une lettre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une soumission s'envoie de deux endroits : **Enregistrer et envoyer** au bas du constructeur, qui enregistre et envoie d'un coup, et **Envoyer** sur la page de la soumission, qui devient **Renvoyer** une fois qu'elle est partie. Les deux demandent d'abord **Envoyer cette soumission ?** — « Ils la recevront par courriel immédiatement. L'envoi est irréversible. » Les deux passent par la même route, donc ils ne peuvent pas diverger." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment envoyer",
        blocks: [
          { steps: [
            "Assurez-vous que le client a une adresse courriel dans sa fiche. Sans elle, l'envoi refuse et dit à qui il manque une adresse.",
            "Ouvrez la soumission et appuyez sur **Envoyer** — ou, dans le constructeur, sur **Enregistrer et envoyer**.",
            "Confirmez dans la fenêtre **Envoyer cette soumission ?**. Le destinataire y est nommé.",
            "Lisez la bannière verte : **Envoyée à** et l'adresse. La ligne **Envoyée par courriel** en dessous garde la date et l'adresse à partir de là.",
            "Si le client dit ne jamais l'avoir reçue, appuyez sur **Renvoyer**. Pour le relancer plus tard, appuyez sur **Relancer** — un courriel plus court avec le même lien, compté à part.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nouvelle soumission — Enregistrer et envoyer dans la barre du bas enregistre le brouillon et l'envoie en une étape." },
          { note: "L'envoi demande un forfait sur le compte. Pendant l'essai gratuit, vous pouvez bâtir et tarifer des soumissions librement ; c'est l'acte de l'envoyer par courriel qui vous demande de terminer l'inscription, et le message le dit." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Ce que le client reçoit",
        blocks: [
          { bullets: [
            "Un courriel au nom de votre entreprise — depuis votre propre domaine une fois vérifié sous **Paramètres → Domaine d'envoi**, sinon depuis l'expéditeur de FieldQuo portant votre nom — avec les réponses dirigées vers le courriel de votre entreprise.",
            "L'objet **« Votre soumission de Easy Roofers Inc. — Q-2026-0012 »**, le total, un bouton d'approbation juste en dessous, puis ce qui est inclus, le déroulement des travaux et la date d'expiration. Le bouton d'approbation se répète au bas. Voir [[the-quote-email|Le courriel de soumission]].",
            "Le PDF de la soumission en pièce jointe, à vos couleurs — voir [[the-quote-pdf|Le PDF de soumission]].",
            "Un lien vers la page d'approbation, où il lit, coche les suppléments, signe et approuve — voir [[the-quote-approval-page|La page d'approbation de la soumission]] et [[online-approval-and-signature|Approbation et signature en ligne]].",
          ] },
        ],
      },
      {
        id: "before-it-will-send",
        heading: "Pourquoi un envoi est refusé",
        blocks: [
          { bullets: [
            "**Le client n'a pas d'adresse courriel.** Ajoutez-en une dans sa fiche, puis envoyez.",
            "**Une estimation instantanée n'a pas été approuvée.** Confirmez d'abord le prix dans Révision des estimations — rien de ce qu'un algorithme a tarifé n'atteint un propriétaire sans qu'une personne appuie sur Approuver.",
            "**La soumission a été saisie comme chantier passé.** Rien n'est jamais envoyé pour un historique importé, et le bouton Envoyer n'apparaît pas sur celles-là.",
            "**Une section du courriel est activée sans contenu** — références ou photos avant-après sous **Paramètres → Courriel de soumission**. Ajoutez le contenu ou retirez la section de cette soumission.",
            "**La ligne de taxe n'est pas résolue.** Une soumission qui facture une taxe sans pouvoir dire laquelle est retenue jusqu'à ce que vous choisissiez un taux, définissiez la province du client ou désactiviez la taxe pour cette soumission.",
            "**Le compte n'a pas encore de forfait.** Terminez l'inscription ; l'invite vous y mène.",
          ] },
        ],
      },
      {
        id: "after-sending",
        heading: "Ce qui change après un envoi",
        blocks: [
          { bullets: [
            "Un brouillon devient **Envoyée**. Une soumission déjà envoyée garde son statut et gagne une nouvelle date **Envoyée par courriel**.",
            "Le lead lié, s'il y en a un, passe de **Nouveau** à **Contacté** sur le tableau des leads.",
            "**Faire approuver**, à côté d'Envoyer, montre désormais un lien client fonctionnel — celui d'un brouillon reste fermé — avec son état et un endroit pour consigner une réponse donnée au téléphone.",
            "Le journal d'activité note qui a envoyé quoi à quelle adresse, et la soumission commence à compter dans le groupe **Soumission envoyée, sans réponse** de la liste jusqu'à ce que le client réponde.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut envoyer",
        blocks: [
          { p: "Toute personne dont l'accès permet de créer et de modifier des soumissions — **Estimator**, **Dispatcher**, **Manager**, les administrateurs et le propriétaire. L'accès en lecture seule ne peut pas envoyer." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je annuler l'envoi d'une soumission ?", a: "Non — la fenêtre le dit avant que vous confirmiez. Vous pouvez remplacer le lien client depuis Faire approuver, ce qui désactive l'ancien ; tout courriel déjà envoyé cessera alors d'ouvrir la soumission." },
      { q: "Le statut dit Envoyée mais le client n'a rien reçu.", a: "Appuyez sur Renvoyer sur la page de la soumission. Si l'envoi échoue, FieldQuo dit pourquoi — adresse manquante, domaine non vérifié — et ne marque pas la soumission comme envoyée." },
      { q: "Dans quelle langue part le courriel ?", a: "Dans la langue propre de la soumission, fixée à sa création ; la langue enregistrée du client sert à tout ce qui n'est pas lié à un document. Voir [[quote-language|Une soumission garde sa langue]]." },
    ],
  },

  "the-quote-pdf": {
    title: "Le PDF de soumission",
    summary:
      "Le PDF joint à chaque courriel de soumission porte votre logo, votre couleur de marque et votre nom — rien n'y dit FieldQuo — et ses sections se réordonnent ou se retirent sous Paramètres → Modèles PDF.",
    updated: "2026-09-12",
    intro: [
      "Chaque soumission part deux fois : comme page web sur laquelle le client approuve, et comme PDF qu'il peut enregistrer, imprimer et tendre à son conjoint. Les deux sont bâtis des mêmes sections et des mêmes couleurs mesurées, si bien que le PDF ressemble à la page et que les deux ont l'air de venir de vous.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le PDF est rendu à partir de votre couleur de marque, transformée en palette mesurée pour qu'une marque blanche, jaune ou gris moyen produise quand même des titres lisibles et une bande de totaux visible. Il utilise la langue propre de la soumission pour chaque étiquette et chaque format de date, et la mise en page standard ci-dessous à moins que vous n'ayez marqué une mise en page à vous comme utilisée." },
          { p: "Les factures reflètent les soumissions à dessein : le PDF de facture a les mêmes sections dans le même ordre, moins le bloc de signature, pour que le propriétaire reconnaisse le second document comme le jumeau du premier." },
        ],
      },
      {
        id: "sections",
        heading: "Les sections, de haut en bas",
        blocks: [
          { table: {
            head: ["Section", "Ce qu'elle imprime"],
            rows: [
              ["Header", "Votre logo et le nom de l'entreprise en haut."],
              ["Client details", "À qui s'adresse le document, et l'adresse du chantier."],
              ["Line items", "Les travaux eux-mêmes, regroupés par service, avec le paragraphe de portée de chaque service et ce qui est inclus."],
              ["Totals", "Sous-total, rabais, taxe et montant dû."],
              ["How the work runs", "Des étapes numérotées expliquant ce qui se passe après l'approbation, rédigées par métier."],
              ["Payment terms", "Vos conditions de paiement en cartes de pourcentage ; entièrement masquée si vous n'en avez pas défini."],
              ["Notes", "Ce qui a été tapé dans les notes de la soumission."],
              ["Signature block", "Des lignes pour une signature manuscrite, pour les clients qui préfèrent signer que cliquer. Soumissions seulement."],
              ["Footer", "Coordonnées et conditions au bas."],
            ],
          } },
        ],
      },
      {
        id: "how-to-change-the-layout",
        heading: "Comment changer la mise en page",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Modèles PDF**. Deux cartes : **PDF de soumission** et **PDF de facture**. Une carte vide veut dire que la mise en page standard est utilisée — vos PDF fonctionnent déjà.",
            "Appuyez sur **Nouveau** sur la carte PDF de soumission, nommez la mise en page (pour vous seulement — les clients ne voient jamais le nom) et choisissez **Partir de la mise en page standard** ou **Copier celle en cours**.",
            "Dans **Modifier la mise en page**, réordonnez avec **Déplacer vers le haut** et **Déplacer vers le bas**, **Retirer la section**, ou **Ajouter une section**. **Aperçu avec des données d'exemple** la rend avant que vous vous engagiez.",
            "Enregistrez, puis appuyez sur **Use this** sur la mise en page. L'insigne **Actif** marque celle que chaque PDF utilise désormais.",
            "Si aucune de vos mises en page n'est marquée active, l'écran avertit que les PDF sortent encore avec la mise en page standard.",
          ] },
          { figure: "live:app-settings-templates", caption: "Paramètres → Modèles PDF — les cartes PDF de soumission et PDF de facture, chacune sur la mise en page standard." },
          { note: "Retirer Header, Line items ou Totals est permis, et l'éditeur vous dit que le PDF n'aura pas l'air d'un document fini. Une mise en page sans aucune section produit une page blanche, et l'éditeur le dit aussi." },
        ],
      },
      {
        id: "where-the-pdf-goes",
        heading: "Où va le PDF",
        blocks: [
          { bullets: [
            "Joint au courriel de soumission sous le nom **Quote-Q-2026-0012.pdf** chaque fois que vous appuyez sur Envoyer ou Renvoyer. Si le PDF ne se génère pas, le courriel part quand même et l'échec est consigné pour le soutien — le client n'attend jamais après une erreur de génération.",
            "Régénéré après l'approbation du client, avec sa signature, et envoyé par courriel à lui et aux propriétaires comme copie signée.",
            "Pas téléchargeable depuis le bureau aujourd'hui — la page de la soumission n'a pas de bouton PDF. Votre copie est la pièce jointe du courriel d'approbation ; avant l'approbation, la copie du client est celle du courriel de soumission.",
            "Jamais envoyé pour une soumission saisie comme chantier passé.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "**Paramètres → Modèles PDF** est ouvert à quiconque peut gérer l'équipe : **Dispatcher**, **Manager**, les administrateurs et le propriétaire. Un **Estimator** peut envoyer la soumission et donc mettre le PDF dans la boîte d'un client, mais ne peut pas en changer la mise en page." },
        ],
      },
    ],
    faq: [
      { q: "Le PDF dit-il FieldQuo quelque part ?", a: "Non. L'en-tête, le pied de page et chaque section sont ceux de votre entreprise. La seule marque FieldQuo sur une surface destinée au client est le petit pied de page d'un site web gratuit, et le PDF n'en est pas un." },
      { q: "Puis-je changer le texte d'une section ?", a: "Pas dans l'éditeur de PDF — il ordonne et retire des sections. Les paragraphes de portée viennent de Paramètres → Services et tarifs (« Ce que dit la soumission »), les étapes de déroulement et les conditions de Paramètres → Profil de l'entreprise, et les étiquettes de la langue de la soumission." },
      { q: "Pourquoi la section des conditions de paiement manque-t-elle dans mon PDF ?", a: "Vous n'avez pas défini de conditions de paiement sous Paramètres → Profil de l'entreprise. La section n'apparaît pas du tout plutôt que d'inventer un échéancier pour vous. Voir [[deposits-on-quotes|Les acomptes sur les soumissions]]." },
    ],
  },

  "quote-statuses-and-what-they-mean": {
    title: "Les statuts d'une soumission, et ce que chacun veut dire",
    summary:
      "Brouillon, Envoyée, Acceptée et Refusée — ce qui met une soumission dans chacun, ce que chacun débloque, et les insignes qui accompagnent le statut dans la liste des soumissions.",
    updated: "2026-09-12",
    intro: [
      "Une soumission a exactement quatre statuts, et les pastilles en haut de la liste les comptent. L'insigne à côté d'une soumission est une promesse sur ce qui lui est arrivé — **Envoyée** veut dire qu'un courriel a été accepté, **Acceptée** que le client a signé ou que vous avez consigné son oui —, donc rien ici ne change tout seul.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La liste des soumissions s'ouvre sur **Tous**, **Brouillon**, **Envoyée**, **Acceptée** et **Refusée**, chacun avec son compte, puis une boîte de recherche et la liste : numéro, statut, client, montant et âge. Les soumissions envoyées sans réponse sont promues en haut sous **Soumission envoyée, sans réponse**, la plus ancienne d'abord, pour que celle qui attend depuis le plus longtemps soit celle que vous voyez en premier." },
          { figure: "live:app-quotes", caption: "Soumissions — les pastilles de statut avec leur compte, puis chaque soumission avec son insigne, son client, son âge et son montant." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "Les quatre statuts",
        blocks: [
          { table: {
            head: ["Statut", "Ce qu'il veut dire", "Comment une soumission y arrive"],
            rows: [
              ["Brouillon", "En rédaction. Le lien client est fermé — un client ne peut pas ouvrir une soumission sur laquelle vous travaillez encore.", "Toute nouvelle soumission. Une estimation instantanée reste un brouillon pendant qu'elle attend dans Révision des estimations et après y avoir été approuvée, jusqu'à ce que vous l'envoyiez."],
              ["Envoyée", "Envoyée par courriel au client et en attente d'une réponse. La page d'approbation est ouverte.", "Appuyer sur Envoyer, une fois que le service de courriel accepte le message. Aussi consignée à la main quand une soumission est partie autrement."],
              ["Acceptée", "Le client a accepté, au total approuvé, suppléments compris. Un chantier et une facture brouillon existent.", "Le client signe sur la page d'approbation, ou vous appuyez sur Ils l'ont approuvée sous Faire approuver."],
              ["Refusée", "Le client a dit non, avec sa raison s'il l'a donnée.", "Le client appuie sur Refuser sur la page d'approbation, ou vous appuyez sur Ils l'ont refusée et notez pourquoi."],
            ],
          } },
        ],
      },
      {
        id: "badges-beside-the-status",
        heading: "Les insignes qui accompagnent le statut",
        blocks: [
          { bullets: [
            "**À réviser** — une estimation instantanée qu'un propriétaire a tarifée sur votre site, en attente dans Révision des estimations. Elle ne peut pas être envoyée tant que quelqu'un n'a pas confirmé le prix.",
            "**Approuvée — prête à envoyer** — cette estimation une fois le prix confirmé. Toujours un brouillon ; l'approbation là-bas, c'est votre entreprise qui confirme le prix, pas le client qui accepte.",
            "**Soumission envoyée, sans réponse** — l'en-tête de groupe au-dessus des soumissions envoyées sans réponse, avec l'âge de chacune et sa date **Valide jusqu'au**.",
            "**Expirée** en rouge, ou **Valide jusqu'au** en ambre dans les 3 jours avant la date — seulement sur les soumissions envoyées, parce qu'une expiration sur une soumission acceptée relève de l'histoire.",
          ] },
        ],
      },
      {
        id: "changing-a-status-by-hand",
        heading: "Consigner une réponse à la main",
        blocks: [
          { p: "La plupart des soumissions du métier sont approuvées au téléphone ou dans une cuisine, pas par un clic. Si le seul chemin vers Acceptée passait par la page du client, vos chiffres de pipeline seraient faux." },
          { steps: [
            "Ouvrez la soumission et appuyez sur **Faire approuver**.",
            "Sous **Consigner leur réponse**, appuyez sur **Ils l'ont approuvée** ou **Ils l'ont refusée** — ce dernier demande « Ont-ils dit pourquoi ? (facultatif) » et note la raison pour vos rapports gagné/perdu.",
            "Une approbation consignée à la main fait tout ce qu'une approbation signée fait — chantier, facture brouillon, échéancier, lead marqué gagné — sauf conserver une signature.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut changer un statut",
        blocks: [
          { p: "Envoyer et consigner une réponse demandent l'accès création-modification aux soumissions : **Estimator** et plus. Supprimer une soumission demande le niveau suppression — **Manager**, les administrateurs et le propriétaire — et une soumission devenue facture ne peut pas être supprimée du tout ; annulez la facture ou marquez la soumission refusée à la place." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi n'y a-t-il pas de statut Expirée ?", a: "L'expiration est une date sur la soumission, pas un statut. Une soumission envoyée dont la date est passée affiche Expirée en rouge dans la liste et refuse l'approbation sur la page du client, mais elle reste Envoyée pour que vous puissiez repousser la date et qu'elle s'ouvre de nouveau. Voir [[quote-validity-and-expiry|Combien de temps une soumission reste valide]]." },
      { q: "Puis-je modifier une soumission Acceptée ?", a: "Ses lignes ne peuvent pas être changées — ce serait réécrire ce qui a été signé. Créez une nouvelle soumission, ou voyez [[edit-a-sent-quote|Modifier une soumission déjà envoyée]] pour une soumission qui n'est qu'Envoyée." },
      { q: "Pourquoi ma soumission dit-elle Envoyée sans date ?", a: "Elle a été marquée envoyée à la main, ou importée. La date sous un insigne Envoyée n'est écrite que lorsqu'un courriel est réellement accepté, si bien qu'une acceptation au téléphone ne porte pas de date d'envoi plutôt qu'une date inventée." },
    ],
  },

  "quote-validity-and-expiry": {
    title: "Combien de temps une soumission reste valide",
    summary:
      "Chaque nouvelle soumission part avec une date Valide jusqu'au fixée à 30 jours ; vous pouvez la déplacer ou l'effacer. Passé la date, le client ne peut plus approuver en ligne, la liste la signale en rouge, et rien d'autre ne change tout seul.",
    updated: "2026-09-12",
    intro: [
      "Une soumission qui n'expire jamais est une soumission sans raison de répondre aujourd'hui. Elle vous laisse aussi tenir un prix quand le coût des matériaux bouge. Le constructeur s'ouvre donc avec une date d'expiration déjà remplie — 30 jours à partir d'aujourd'hui — et la révision se plaint si vous l'effacez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Valide jusqu'au** se trouve en haut de la carte des montants dans le constructeur. La date est une suggestion que vous voyez et pouvez changer avant tout enregistrement, pas une valeur écrite à votre place : la ligne en dessous dit « Fixée à 30 jours à partir d'aujourd'hui. Modifiez-la, ou effacez-la si cette soumission ne doit jamais expirer. » L'effacer est respecté — la soumission s'enregistre sans expiration — et la ligne change pour dire que le client n'a aucune raison de répondre aujourd'hui." },
        ],
      },
      {
        id: "setting-the-date",
        heading: "Régler la date",
        blocks: [
          { steps: [
            "Dans le constructeur, trouvez **Valide jusqu'au** au-dessus de **Rabais** et **Taux de taxe (%)**. Changez la date, ou videz la case pour aucune expiration.",
            "Sur une soumission existante, appuyez sur **Modifier** — la case affiche « La date déjà inscrite sur cette soumission » — et déplacez-la.",
            "Enregistrez. La date s'imprime sur la page du client et dans le courriel comme expiration, et dans la liste des soumissions comme **Valide jusqu'au** à côté de l'âge de la soumission.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nouvelle soumission — Valide jusqu'au, prérempli à 30 jours, au-dessus de Rabais et Taux de taxe." },
          { note: "La date est stockée comme jour de calendrier. Une soumission écrite à 20 h à Montréal reçoit le jour que vous voyez à l'écran, pas celui qu'il est déjà à Londres." },
        ],
      },
      {
        id: "what-happens-when-it-passes",
        heading: "Ce qui se passe quand la date passe",
        blocks: [
          { bullets: [
            "La page d'approbation du client affiche **Cette soumission est expirée** et « Contactez Easy Roofers Inc. pour obtenir un prix à jour. » Approuver et Refuser ont disparu. S'il appuie sur Approuver à la minute même où la date passe, le serveur refuse aussi.",
            "Dans la liste des soumissions, la soumission affiche **Expirée** et la date en rouge, avec une barre rouge sur la ligne. La barre apparaît aussi dans les 3 jours avant, quand **Valide jusqu'au** s'affiche en ambre.",
            "La révision IA signale **Already expired** comme vérification de gravité élevée : repoussez la date avant d'envoyer.",
            "Le statut reste **Envoyée**. Avancez la date et la page d'approbation s'ouvre de nouveau, sans rien d'autre à refaire.",
            "Le courriel et le PDF continuent d'imprimer la date avec laquelle ils ont été envoyés ; un nouvel envoi imprime la nouvelle.",
          ] },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "Il ne change pas le statut en Expirée ni en Refusée. L'expiration est une date, pas une décision.",
            "Il n'envoie de courriel ni au client ni à vous quand une soumission expire. Les relances automatiques se déclenchent selon le temps écoulé depuis l'envoi, pas selon la date d'expiration — voir [[quotes-sent-with-no-response|Les soumissions envoyées sans réponse]].",
            "Il ne retarife rien. Le prix d'une soumission expirée est celui que vous avez écrit ; déplacer la date, c'est votre décision de le maintenir.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer le 30 jours par défaut ?", a: "Pas comme réglage d'entreprise aujourd'hui. Le constructeur préremplit 30 jours sur chaque nouvelle soumission ; changez la date sur la soumission elle-même." },
      { q: "Un client veut approuver une soumission expirée hier.", a: "Ouvrez la soumission, appuyez sur Modifier, avancez Valide jusqu'au et enregistrez. Le même lien s'ouvre de nouveau et il peut signer. Rien d'autre ne change dans la soumission." },
    ],
  },

  "quote-language": {
    title: "Une soumission garde sa langue",
    summary:
      "Vous choisissez la langue de rédaction d'une soumission à sa création, et elle la garde pour la vie — le PDF, la page d'approbation et le courriel d'accompagnement la suivent, et rien n'est traduit automatiquement au moment de l'envoi.",
    updated: "2026-09-12",
    intro: [
      "Deux langues sont en jeu, et elles sont distinctes. La première est celle dans laquelle vous travaillez — l'application elle-même, réglée sous **Paramètres → Langue**. La seconde est celle que le client lit : la soumission, la facture, les courriels. Un atelier de Gatineau peut travailler en anglais et soumissionner en français ; une équipe hispanophone peut envoyer une soumission en anglais à un client anglophone.",
      "Une règle mérite d'être dite clairement, parce qu'elle sonne comme une limite alors qu'elle est la partie rassurante : une soumission garde la langue dans laquelle elle a été créée. Un document signé dira toujours ce qu'il disait au moment de la signature. Rien n'est retraduit dans le dos du client.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Huit langues sont offertes au client : anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien. Chacune a un jeu d'étiquettes de document rédigé à la main, un texte de courriel d'accompagnement et une police PDF capable de la composer. La langue se choisit une fois par soumission, dans le constructeur, et la page de modification dit ensuite : « Rédigée en Français. Une soumission conserve la langue dans laquelle elle a été créée — la copie signée doit continuer de dire la même chose. »" },
          { note: "Le texte de vos propres services est à vous de le traduire. **Paramètres → Traductions** montre le texte de portée de chaque service par langue, un compte de ce qui manque encore, et **Rédiger les ébauches manquantes**, qui écrit des ébauches par IA pour qu'une personne les révise — rien n'est traduit automatiquement au moment où une soumission part." },
        ],
      },
      {
        id: "choosing-the-language",
        heading: "Choisir la langue d'une soumission",
        blocks: [
          { steps: [
            "Dans le constructeur, choisissez le client. La barre **Write this quote in** (affichée en anglais pour l'instant) apparaît avec sa langue enregistrée présélectionnée — ou la langue par défaut de l'entreprise s'il n'en a pas.",
            "Changez-la si cette soumission doit différer. La préférence du client est une suggestion, pas un verrou — vous soumissionnez peut-être pour le fils anglophone d'un propriétaire pendjabophone —, mais la barre montre l'écart et offre **Use that instead**.",
            "Lisez tout avertissement : « 3 of your 12 services don't have Français wording yet — those line items will come out in English. » Corrigez-le sous **Paramètres → Traductions** avant d'envoyer, ou acceptez-le.",
            "Enregistrez. À partir de là, la langue est fixée ; la page de modification l'indique et n'offre aucun moyen de la changer.",
          ] },
          { figure: "live:app-settings-translations", caption: "Paramètres → Traductions — le sélecteur de langue, le compte des manques et les colonnes par service avec Marquer comme révisé." },
          { tip: "Réglez la langue de chaque client une fois dans sa fiche et chaque soumission pour lui démarre dans cette langue. Voir [[a-clients-language|La langue d'un client]]." },
        ],
      },
      {
        id: "what-follows-the-language",
        heading: "Ce qui suit la langue de la soumission",
        blocks: [
          { bullets: [
            "**La page d'approbation** — chaque étiquette, les formats de date et de montant (« 9,9 % » en français), les boutons d'approbation et de refus, la ligne de consentement à la signature.",
            "**Le PDF** — étiquettes, dates, format monétaire et le texte de portée par métier dans cette langue là où vous l'avez rédigé.",
            "**Le courriel d'accompagnement** et chaque relance de cette soumission — objet, salutation et corps. Une soumission en français n'arrive jamais enveloppée d'une note en anglais, parce que cela laisserait croire à une traduction qui n'existe pas.",
            "**La facture qui la reflète** et ses propres courriels, qui héritent de la langue de la soumission.",
            "**Les lignes dérivées à l'enregistrement** — une amélioration d'armoires ajoutée par le métré est écrite dans la langue de la soumission, pas dans celle de l'estimateur.",
          ] },
        ],
      },
      {
        id: "the-order-of-precedence",
        heading: "Quelle langue l'emporte",
        blocks: [
          { table: {
            head: ["Priorité", "Source", "Sert pour"],
            rows: [
              ["1", "La langue propre du document, fixée à la création", "La soumission, son PDF, sa page d'approbation, son courriel d'accompagnement et ses relances"],
              ["2", "La langue enregistrée du client", "Tout ce qui n'est pas lié à un document — une confirmation de rendez-vous, un rappel de paiement"],
              ["3", "La valeur par défaut de l'entreprise sous Paramètres → Langue", "Un client sans langue enregistrée"],
              ["4", "L'anglais", "Quand rien de ce qui précède n'est défini"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la régler",
        blocks: [
          { p: "Toute personne qui peut créer une soumission en choisit la langue. **Paramètres → Traductions** et la valeur par défaut de l'entreprise sous **Paramètres → Langue** demandent quelqu'un qui peut gérer l'équipe : **Dispatcher**, **Manager**, les administrateurs et le propriétaire." },
        ],
      },
    ],
    faq: [
      { q: "Le client a changé d'idée — puis-je passer une soumission en français ?", a: "Pas la même soumission : sa langue est fixée pour que la copie signée ne dérive pas. Créez-lui une nouvelle soumission en français. La langue de sa fiche client peut être changée à tout moment et s'appliquera à la prochaine soumission." },
      { q: "Et si un service n'a pas de texte en français ?", a: "La barre vous avertit avant l'enregistrement. La ligne sort dans la langue par défaut de votre entreprise jusqu'à ce que vous ajoutiez le français sous Paramètres → Traductions. Rien n'est traduit automatiquement à l'envoi." },
      { q: "L'application change-t-elle de langue aussi ?", a: "Non. La langue de la soumission est pour le client. Votre propre écran suit Paramètres → Langue pour vous, et chaque membre de l'équipe peut avoir la sienne." },
    ],
  },

  "online-approval-and-signature": {
    title: "Approbation et signature en ligne",
    summary:
      "Le client ouvre le lien sur son téléphone, lit, coche les suppléments, tape son nom, trace une signature et approuve — et FieldQuo conserve la signature avec une empreinte exacte de ce qu'il a accepté.",
    updated: "2026-09-12",
    intro: [
      "Pas d'impression, pas de numérisation, pas de trajet à l'autre bout de la ville pour cueillir une signature. Le courriel de soumission porte un lien ; le client lit la soumission sur son téléphone et dit oui là. L'approbation est une confirmation en deux étapes avec signature, pas un simple bouton — une tape accidentelle en plein soleil ne devrait pas créer un contrat.",
      "La signature n'est pas décorative. Elle est conservée avec le nom du client, l'heure, son adresse sur le réseau, le navigateur utilisé et une empreinte du contenu tarifé qu'il a signé, si bien que « ils ont signé » et « on l'a modifiée après » ne peuvent jamais se confondre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page d'approbation est publique — toute personne disposant du lien peut voir la soumission et l'approuver, et c'est pourquoi l'écran **Faire approuver** dit de ne l'envoyer qu'au client. Elle ne s'ouvre qu'une fois la soumission **Envoyée** ; le lien d'un brouillon reste fermé. Elle est rendue dans la langue propre de la soumission et dans les couleurs mesurées de votre marque, donc c'est le même document que le PDF." },
          { p: "Le lien lui-même est créé au premier envoi de la soumission et affiché sous **Faire approuver** comme **Lien client**, avec **Copier**, **Aperçu de ce qu'ils voient** et **Remplacer le lien**. Remplacer désactive l'ancien lien — servez-vous-en si la mauvaise personne a reçu une copie, en sachant que tout courriel déjà envoyé cessera de fonctionner." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Ce que le client voit",
        blocks: [
          { bullets: [
            "Votre logo et votre nom, le numéro de soumission, la date **Valide jusqu'au**, et le nom du client.",
            "Chaque service avec son paragraphe de portée, **Ce qui est inclus**, les lignes et le sous-total, puis **Ce qui pourrait modifier ce prix**.",
            "**Options supplémentaires** en cases à cocher, si vous en avez offert — le total se met à jour à mesure qu'il coche. Voir [[upsell-add-ons|Suppléments optionnels que le client peut accepter]].",
            "**Déroulement des travaux**, vos notes, et **Modalités de paiement** en cartes de pourcentage quand vous avez défini un échéancier.",
            "Un panneau de financement, si votre entreprise a le financement activé.",
            "**Approuver cette soumission** en vert et **Refuser** — puis, sur Approuver, **Votre nom complet**, une case **Signature** où tracer, la ligne de consentement « J'accepte que ma signature ici constitue ma signature électronique et approuve cette soumission pour 12 450,00 $ », et **Oui, approuver**.",
          ] },
        ],
      },
      {
        id: "how-approval-works",
        heading: "Comment une approbation passe",
        blocks: [
          { steps: [
            "Le client appuie sur **Approuver cette soumission**. La page demande **Approuver cette soumission pour 12 450,00 $ ?** et, si des suppléments sont cochés, dit quelle part en est.",
            "Il tape son nom, trace dans la case de signature et coche la ligne de consentement. **Oui, approuver** reste désactivé tant que les trois n'y sont pas.",
            "Le serveur vérifie que la soumission est encore Envoyée et non expirée, retarife les suppléments cochés d'après ses propres lignes, et refuse une approbation sans nom, sans trace ou sans consentement — une signature vide ne peut jamais en tenir lieu.",
            "L'enregistrement de signature est conservé sur la soumission et le statut devient **Acceptée**, avec le sous-total, la taxe et le total approuvés figés dessus.",
            "Le client voit **Approuvée — merci** et reçoit le PDF signé par courriel ; vous recevez le courriel décrit ci-dessous.",
          ] },
        ],
      },
      {
        id: "what-happens-after",
        heading: "Ce qui se passe ensuite",
        blocks: [
          { bullets: [
            "Un **chantier** est créé, prêt à planifier, et une **facture brouillon** pour le total approuvé. Si un échéancier de paiement est actif, l'acompte est demandé aussitôt — voir [[deposits-on-quotes|Les acomptes sur les soumissions]] et [[convert-a-quote-to-a-job|Ce qui se passe quand une soumission est approuvée]].",
            "Le propriétaire et les administrateurs reçoivent un courriel : « Jane Doe approved Q-2026-0012 » — « plus $340.00 in extras » si des suppléments ont été cochés — avec le PDF signé joint et un lien vers la soumission.",
            "Le client reçoit le PDF signé avec une courte note dans la langue de la soumission : « Merci d'avoir approuvé votre soumission avec Easy Roofers Inc. Une copie est jointe pour vos dossiers. »",
            "Le lead lié passe à **Gagnée**, le journal d'activité note « accepted by the client — job created, ready to schedule », et une notification part.",
            "Un **Refuser** consigne le moment et la raison s'il en a tapé une, passe le lead à **Perdue**, et envoie un courriel au propriétaire et aux administrateurs. La page du client dit que vous avez été avisé et d'appeler si c'était une erreur.",
          ] },
        ],
      },
      {
        id: "the-signature-record",
        heading: "Ce que contient l'enregistrement de signature",
        blocks: [
          { p: "La même preuve qu'un fournisseur de signature électronique payant vend, sans le fournisseur : un condensé du contenu tarifé exact au moment de la signature, plus qui, quand et d'où." },
          { bullets: [
            "Le nom tapé, la signature tracée en image, et la coche de consentement.",
            "L'heure de la signature, l'adresse réseau et le navigateur du client — fournis par le serveur, jamais par la page.",
            "Une empreinte du numéro de soumission, des lignes, des groupes de portée, des suppléments choisis et des totaux. Tout changement ultérieur à ceux-ci fait cesser la correspondance de l'empreinte, et c'est ainsi qu'une altération est détectable.",
            "Le PDF signé, régénéré avec la signature et envoyé aux deux parties, est la copie pour le dossier.",
          ] },
        ],
      },
      {
        id: "recording-an-answer-by-hand",
        heading: "Quand ils ont approuvé au téléphone",
        blocks: [
          { p: "Un oui donné dans une cuisine reste un oui. **Faire approuver** offre **Consigner leur réponse** — « S'ils vous l'ont dit au téléphone ou en personne, notez-le ici pour que le pipeline reste exact. »" },
          { steps: [
            "Ouvrez la soumission et appuyez sur **Faire approuver**.",
            "Appuyez sur **Ils l'ont approuvée**, ou sur **Ils l'ont refusée** et notez pourquoi.",
            "Tout ce qu'une approbation signée déclenche se produit — chantier, facture brouillon, échéancier, lead —, mais aucune signature n'est conservée, et la soumission ne montre aucun enregistrement de signature.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Une signature en ligne a-t-elle valeur légale ?", a: "FieldQuo conserve ce dont une signature a besoin pour tenir — le nom, la trace, la ligne de consentement cochée par le client, l'heure, l'adresse réseau et une empreinte de ce qu'il a signé. Savoir si cela satisfait un contrat donné dans une province donnée est une question pour votre avocat, pas pour une page d'aide." },
      { q: "Le client peut-il approuver sans signer ?", a: "Non. Oui, approuver reste désactivé tant que le nom, la trace et la coche de consentement n'y sont pas tous, et le serveur refuse une approbation qui arrive sans eux." },
      { q: "Et si la soumission a changé après la signature ?", a: "Elle ne peut pas être modifiée — les lignes d'une soumission acceptée sont verrouillées. Si elle était altérée dans la base de données, l'empreinte conservée ne correspondrait plus, et c'est tout l'intérêt d'en conserver une." },
    ],
  },

  "deposits-on-quotes": {
    title: "Les acomptes sur les soumissions",
    summary:
      "Un acompte, c'est une ligne de vos conditions de paiement qui s'imprime sur chaque soumission en carte de pourcentage — et, avec un échéancier de paiement activé, une demande de facture qui part toute seule dès que le client approuve.",
    updated: "2026-09-12",
    intro: [
      "Un propriétaire qui vient d'approuver un chantier s'attend à ce qu'on lui demande un acompte ; un entrepreneur qui doit penser à le demander l'oublie souvent. FieldQuo imprime votre acompte sur la soumission pour que le client y consente en signant, et — si vous activez l'échéancier de paiement — le demande automatiquement à l'approbation.",
      "Deux réglages font cela, et ils vivent l'un au-dessus de l'autre sous **Paramètres → Profil de l'entreprise**. Le premier ne fait qu'imprimer. Le second imprime et facture.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Sous **Description des travaux et conditions**, la case **Conditions de paiement** est un texte libre lu tel quel sur le document : « 50 % de dépôt, solde à la fin — ou Net 30 ». Un texte que FieldQuo peut lire comme un échéancier — deux pourcentages ou plus totalisant environ 100 — s'imprime en cartes sur la page d'approbation et le PDF ; tout autre texte s'imprime comme vous l'avez écrit ; laissé vide, la section n'apparaît pas du tout plutôt que d'inventer un échéancier pour vous." },
          { note: "Un acompte sur une soumission n'est pas les frais de visite qu'un client paie en réservant un rendez-vous. Ces frais sont perçus sur la page de réservation et crédités sur la facture plus tard — voir [[booking-fees-and-visit-deposits|Frais de réservation et dépôts de visite]]." },
        ],
      },
      {
        id: "two-ways",
        heading: "Les deux façons de le régler",
        blocks: [
          { table: {
            head: ["Réglage", "Ce que le client voit", "Ce qui se passe à l'approbation"],
            rows: [
              ["Conditions de paiement (texte libre)", "Vos mots, ou des cartes de pourcentage si le texte se lit comme un échéancier, sur la page d'approbation et le PDF.", "Un chantier et une seule facture brouillon pour le total approuvé complet. Rien n'est demandé tant que vous n'envoyez pas la facture."],
              ["Échéancier de paiement (étapes)", "Les mêmes cartes de pourcentage, générées à partir des étapes pour que le document corresponde toujours à ce qui est facturé.", "L'étape Acompte est envoyée au client aussitôt comme demande de sa part exacte, avec un lien de paiement plafonné à ce montant. Les étapes suivantes se déclenchent selon les dates du chantier."],
            ],
          } },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "Comment régler un acompte qui se facture tout seul",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et trouvez **Échéancier de paiement** — désactivé par défaut ; il s'active en ajoutant une étape.",
            "Appuyez sur **Ajouter une étape**. Réglez **Quand** sur **Acompte — à la création et à l'envoi de la facture**, nommez-la, et donnez-lui son **Pourcentage**.",
            "Ajoutez le reste — **Début du chantier**, **À mi-parcours du chantier**, **Fin du chantier (achèvement)** — jusqu'à ce que **Total** affiche 100 %. L'enregistrement refuse tout le reste : « Les étapes doivent totaliser exactement 100 % avant de pouvoir être enregistrées. »",
            "Appuyez sur **Enregistrer l'échéancier**. Le texte **Conditions de paiement** au-dessus est réécrit à partir des étapes et se verrouille, pour que le document et la facturation ne puissent jamais se contredire.",
            "Pour revenir au texte libre, appuyez sur **Désactiver — revenir au texte libre**. Les chantiers déjà en cours gardent les étapes qu'on leur a données.",
          ] },
          { figure: "live:app-settings-company", caption: "Paramètres → Profil de l'entreprise — Description des travaux et conditions avec la case Conditions de paiement, puis la carte Échéancier de paiement avec Ajouter une étape." },
          { warning: "La part d'une étape est calculée sur le total approuvé, suppléments compris, et le courriel d'acompte ne porte un lien de paiement que si Stripe est connecté avec les encaissements activés. Sans Stripe, la demande part quand même ; le client paie par le moyen que vous consignez à la main." },
        ],
      },
      {
        id: "on-approval",
        heading: "Ce qui se passe à l'approbation",
        blocks: [
          { bullets: [
            "Le chantier est créé et une seule facture brouillon est émise pour le total approuvé — une facture par chantier, demandée par étapes, jamais une facture par étape.",
            "Chaque étape devient une ligne sur le chantier avec son pourcentage, son montant et son déclencheur. L'acompte n'a pas besoin de date, il part donc immédiatement : un courriel au client, dans la langue de la soumission, demandant le montant de cette étape et menant à son portail.",
            "La facture est marquée **Envoyée** par cette première demande. Les étapes liées au début, à la mi-parcours et à la fin attendent les dates du chantier et sont recalculées quand ces dates bougent.",
            "Une étape à 0 % est renoncée plutôt qu'envoyée par courriel — une demande de 0 $ est pire que rien.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le régler",
        blocks: [
          { p: "**Paramètres → Profil de l'entreprise**, y compris les conditions de paiement et l'échéancier, demande quelqu'un qui peut gérer l'équipe : **Dispatcher**, **Manager**, les administrateurs et le propriétaire. Les lignes d'étapes d'un chantier sont visibles par quiconque peut voir la facture de ce chantier." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je demander un acompte avant que le client approuve ?", a: "Pas depuis la soumission. La demande d'acompte est déclenchée par l'approbation, parce que c'est le moment où le client a accepté le montant. Pour retenir une plage de visite avec de l'argent d'avance, utilisez plutôt les frais de visite de la page de réservation." },
      { q: "Pourquoi ma soumission n'affiche-t-elle aucune section de paiement ?", a: "Les conditions de paiement sont vides. FieldQuo n'imprime rien plutôt que d'inventer un échéancier. Tapez vos conditions — ou ajoutez une étape — sous Paramètres → Profil de l'entreprise." },
      { q: "Le client a approuvé et aucun courriel d'acompte n'est parti.", a: "Vérifiez trois choses : l'échéancier est actif avec une étape Acompte ; le client a une adresse courriel ; et la facture a été émise (une soumission saisie comme chantier passé n'en émet aucune). La ligne d'étape sur le chantier dit si elle est en attente ou demandée, et un acompte en attente est retenté." },
    ],
  },
};
