// app/i18n/productPages/fr.js
//
// Français québécois, vouvoiement, comme le reste du catalogue.
//
// Le vocabulaire suit ce qui est déjà en production dans messages.js et dans
// app/i18n/featurePages/fr.js : « soumission » et non « devis », « chantier »
// et non « projet », « courriel », « texto », « seuil de rentabilité »,
// « sous-traitant », « quart » pour un shift, « pointage » pour le time clock,
// « feuille de temps », « fiche de paie », « frais généraux ».
//
// À faire relire : « prix plancher » pour "minimum price" — la grille de prix
// dit « tarifs », et un entrepreneur dirait peut-être « prix minimum » ;
// « tableau de la journée » pour "day board" ; « remplacement » pour "cover"
// (un collègue qui prend votre quart) et « échange » pour "trade".

const fr = {

  // /product/quoting
  "productPage.quoting.headline": "Envoyez une soumission professionnelle en quelques minutes",
  "productPage.quoting.description":
    "Montez vos soumissions à partir de vos propres prix pour chaque service que vous offrez, ajoutez des photos, et laissez le client approuver en ligne — sans impression ni parties de téléphone.",
  "productPage.quoting.bullet.1":
    "Vos propres prix par catégorie de service, pas un gabarit générique",
  "productPage.quoting.bullet.2": "Le client approuve et signe électroniquement en ligne",
  "productPage.quoting.bullet.3": "Un clic transforme une soumission acceptée en facture",
  "productPage.quoting.bullet.4":
    "Modifiez une facture envoyée : l'ancienne est conservée — jamais de doute sur ce qui a été entendu",
  "productPage.quoting.section.pricebook.heading": "Vos services et vos tarifs, réglés une fois",
  "productPage.quoting.section.pricebook.body":
    "Chaque service que vous offrez a sa propre grille de tarifs — au carré, au pied linéaire, à l'heure, selon ce que le métier facture. Réglez-la une fois et elle remplit chaque soumission. Votre liste de produits s'importe d'un chiffrier, sans rien retaper.",
  "productPage.quoting.section.pricebook.bullet.1": "Une grille de tarifs par service, dans les unités que votre métier utilise vraiment",
  "productPage.quoting.section.pricebook.bullet.2": "Produits et services importés d'un CSV, sans rien retaper",
  "productPage.quoting.section.pricebook.bullet.3": "Coûts des matériaux et recettes derrière le prix, jamais montrés au client",
  "productPage.quoting.section.pricebook.alt":
    "L'écran Services et tarifs : toiture, revêtement et gouttières, chacun avec sa grille de tarifs et les matériaux qui servent à le tarifer",
  "productPage.quoting.section.builder.heading": "Montez la soumission chez le client",
  "productPage.quoting.section.builder.body":
    "Touchez un service et vos propres prix se remplissent. Regroupez les lignes par pièce ou par portée, joignez les photos que le client a envoyées, et gardez votre coût et votre marge dans un panneau que le client ne voit jamais.",
  "productPage.quoting.section.builder.bullet.1": "Regroupez les lignes par pièce ou par portée pour que la soumission se lise comme le chantier se déroule",
  "productPage.quoting.section.builder.bullet.2": "Les photos et vidéos du client restent sur la soumission et passent à la facture",
  "productPage.quoting.section.builder.bullet.3": "Coût et marge calculés à côté du prix — heures d'équipe, matériaux, frais généraux",
  "productPage.quoting.section.builder.alt":
    "Le monteur de soumissions : le client, la personne assignée, les services à ajouter d'une touche, et le panneau interne de coût et de marge",
  "productPage.quoting.section.review.heading": "Une révision avant l'envoi, et des extras que le client peut cocher",
  "productPage.quoting.section.review.body":
    "Avant qu'une soumission parte, FieldQuo AI la relit : ce que vous avez oublié de mentionner, où se situe le prix par rapport aux soumissions que vous avez déjà gagnées, et une formulation plus claire. Les extras suggérés sont tarifés à partir de votre propre historique et apparaissent comme options que le client coche sur la page d'approbation.",
  "productPage.quoting.section.review.bullet.1": "Ce qui manque, comment le prix se compare, quoi reformuler",
  "productPage.quoting.section.review.bullet.2": "Comparé à vos propres soumissions acceptées seulement — jamais à celles d'une autre entreprise",
  "productPage.quoting.section.review.bullet.3": "Les extras sont tarifés de votre côté ; le client choisit seulement lesquels accepter",
  "productPage.quoting.section.review.alt":
    "Le panneau de révision par l'IA qui note une soumission 76 sur 100, avec trois points à corriger avant l'envoi",
  "productPage.quoting.section.approval.heading": "Le client approuve et signe depuis son téléphone",
  "productPage.quoting.section.approval.body":
    "La soumission arrive dans un courriel envoyé de votre adresse, avec votre logo et votre couleur, et s'ouvre sur une page qui porte votre nom. Le client choisit ses extras, signe, et le chantier est lancé. Ce qu'il a vu au moment de signer est conservé avec la signature.",
  "productPage.quoting.section.approval.bullet.1": "Votre logo, votre couleur, votre nom — rien ne dit FieldQuo",
  "productPage.quoting.section.approval.bullet.2": "Signature enregistrée avec le document exact que le client a vu",
  "productPage.quoting.section.approval.bullet.3": "Une soumission garde la langue dans laquelle elle a été rédigée ; un document signé ne change jamais de mots",
  "productPage.quoting.section.invoice.heading": "Un clic pour facturer, payé depuis le téléphone",
  "productPage.quoting.section.invoice.body":
    "Une soumission approuvée devient une facture qui ressemble à la soumission, parce qu'elle est bâtie à partir d'elle. Demandez un acompte, divisez un gros chantier en étapes, et laissez le client payer par carte ou par prélèvement bancaire — l'argent se dépose dans votre propre compte, jamais le nôtre.",
  "productPage.quoting.section.invoice.bullet.1": "Modifiez une facture émise : la version précédente est conservée",
  "productPage.quoting.section.invoice.bullet.2": "Acomptes et paiements par étape, demandés selon l'échéancier que vous fixez",
  "productPage.quoting.section.invoice.bullet.3": "Carte, ou prélèvement bancaire au Canada et aux États-Unis, versé directement dans votre compte",
  "productPage.quoting.section.invoice.alt":
    "L'écran de nouvelle facture avec les lignes et le panneau interne de coût et de marge",
  "productPage.quoting.section.instant.heading": "Une estimation instantanée sur votre site web",
  "productPage.quoting.section.instant.body":
    "Un visiteur répond à quelques questions — ou trace le toit à partir de l'adresse — et obtient une fourchette de prix calculée à partir des tarifs que vous fixez. Elle arrive dans votre file de révision avant que quoi que ce soit n'engage, et votre grille de tarifs elle-même n'est jamais publiée.",
  "productPage.quoting.section.instant.bullet.1": "Montrez une fourchette tout de suite, après l'envoi, ou pas du tout — à vous de choisir par service",
  "productPage.quoting.section.instant.bullet.2": "Chaque estimation attend dans Révisions d'estimations que vous la confirmiez ou l'ajustiez",
  "productPage.quoting.section.instant.bullet.3": "Un formulaire d'auto-soumission où le propriétaire décrit les travaux et téléverse des photos",
  "productPage.quoting.section.instant.alt":
    "Les réglages des soumissions instantanées : toiture mesurée à partir de l'adresse, ce que voit le propriétaire, et les tranches de budget",
  "productPage.quoting.faq.white-label.q": "Mes clients voient-ils FieldQuo quelque part ?",
  "productPage.quoting.faq.white-label.a":
    "Non. La soumission, la facture, la page d'approbation, les courriels et le PDF portent votre logo, votre couleur et votre nom comme expéditeur. Notre nom n'apparaît qu'à deux petits endroits : une mention « Site par FieldQuo » dans le pied de votre site web tant que votre entreprise n'est pas sur un forfait payant — elle disparaît dès que c'est le cas — et une mention « Fait par FieldQuo » au bas de la page de lien bio.",
  "productPage.quoting.faq.own-prices.q": "Puis-je utiliser mes propres prix ?",
  "productPage.quoting.faq.own-prices.a":
    "C'est la seule façon dont ça fonctionne. Chaque service part de tarifs typiques pour votre métier, indiqués comme points de départ, et vous les ajustez à votre marché ; le monteur de soumissions se remplit à partir de vos chiffres, jamais des nôtres. Une liste de prix s'importe aussi d'un chiffrier, pour partir de celle que vous tenez déjà.",
  "productPage.quoting.faq.after-approval.q": "Que se passe-t-il quand le client approuve ?",
  "productPage.quoting.faq.after-approval.a":
    "La soumission devient un chantier avec la portée, l'adresse et la paperasse déjà dessus, et un clic la transforme en facture qui reflète la soumission. Si vous aviez demandé un acompte, il est réclamé à l'approbation.",
  "productPage.quoting.faq.instalments.q": "Les clients peuvent-ils payer en versements ?",
  "productPage.quoting.faq.instalments.a":
    "Vous pouvez diviser une facture en étapes et chacune est demandée selon votre échéancier. Le paiement échelonné à la caisse est offert par Stripe, où c'est le prêteur qui décide — FieldQuo ne prête pas et n'approuve personne.",

  // /product/scheduling
  "productPage.scheduling.headline": "Chaque personne, chaque heure, sur un seul tableau",
  "productPage.scheduling.description":
    "Préparez la journée et la semaine de l'équipe, publiez une fois, et chacun voit ses propres quarts sur son téléphone. Les clients réservent des visites selon vos vraies disponibilités pendant que vous êtes sur le chantier.",
  "productPage.scheduling.bullet.1": "Un tableau de la journée avec une rangée par personne et une colonne par heure",
  "productPage.scheduling.bullet.2": "Les quarts restent invisibles pour l'équipe tant que vous ne publiez pas",
  "productPage.scheduling.bullet.3": "Page de réservation publique, à votre logo et à vos couleurs",
  "productPage.scheduling.bullet.4":
    "Temps tampons et disponibilités par personne, pas un calendrier générique",
  "productPage.scheduling.hero.alt":
    "Le tableau de la journée : cinq personnes en rangées, les heures en colonnes, une en vacances, une pointée, et la bande de couverture en haut",
  "productPage.scheduling.section.board.heading": "Le tableau de la journée : qui est où, heure par heure",
  "productPage.scheduling.section.board.body":
    "Une rangée par personne, une colonne par heure. Un quart est un bloc avec son dîner et ses pauses dessinés ; le pointage fait passer les points au vert et à l'ambre à mesure que les gens pointent ; quelqu'un en vacances approuvées apparaît comme une rangée ABSENT pour que personne ne le planifie par erreur.",
  "productPage.scheduling.section.board.bullet.1": "La bande de couverture dit combien de personnes restent sur le chantier chaque heure — en rouge là où il en manque pendant les heures d'ouverture",
  "productPage.scheduling.section.board.bullet.2": "Un brouillon hors des disponibilités déclarées de quelqu'un est pointillé et signalé, pas accepté en silence",
  "productPage.scheduling.section.board.bullet.3": "Pastilles En retard et À l'heure, calculées du pointage par rapport au quart, sur le bloc lui-même",
  "productPage.scheduling.section.board.alt":
    "Le tableau de la journée vu par le propriétaire : la ligne de main-d'œuvre du jour et de la semaine, les heures supplémentaires, et les pastilles En retard et À l'heure sur les quarts",
  "productPage.scheduling.section.week.heading": "Planifiez la semaine, publiez une seule fois",
  "productPage.scheduling.section.week.body":
    "La grille de la semaine, ce sont les mêmes quarts par jour. Appliquez un quart à plusieurs jours d'un coup, affichez un quart ouvert que n'importe qui peut réclamer, et lisez les heures et les salaires dans le pied de page avant de publier. Tant que vous ne publiez pas, l'équipe ne voit rien.",
  "productPage.scheduling.section.week.bullet.1": "Bascules « appliquer à » par jour : réglez lundi une fois, cochez les quatre autres",
  "productPage.scheduling.section.week.bullet.2": "Les quarts ouverts ont leur propre rangée jusqu'à ce que quelqu'un les réclame",
  "productPage.scheduling.section.week.bullet.3": "Heures, heures supplémentaires et — avec l'accès à la paie — la masse salariale, par jour et par semaine",
  "productPage.scheduling.section.week.alt":
    "La grille de la semaine : les rangées Événements et Quarts ouverts, un quart par personne par jour, et le pied de page des salaires et des heures",
  "productPage.scheduling.section.phone.heading": "Publié, et sur chaque téléphone",
  "productPage.scheduling.section.phone.body":
    "Quand vous publiez, chaque personne est avertie sur son téléphone, et avertie de nouveau si son quart bouge. Son horaire est une carte par jour : le chantier, l'adresse, qui d'autre y est, la note que vous avez laissée, et un bouton Pointer sur la carte du jour.",
  "productPage.scheduling.section.phone.bullet.1": "Averti quand un quart est publié, déplacé ou retiré — un brouillon n'atteint jamais un téléphone",
  "productPage.scheduling.section.phone.bullet.2": "Les collègues du même quart, la note du chantier et la ligne des jours fériés",
  "productPage.scheduling.section.phone.bullet.3": "Pointer depuis la carte du jour ; ajouter l'horaire au calendrier du téléphone",
  "productPage.scheduling.section.phone.alt":
    "Mon horaire sur un téléphone : une carte par jour avec le chantier, l'adresse, l'équipe qui y est et un bouton Pointer",
  "productPage.scheduling.section.requests.heading": "Échanges, remplacements et congés, approuvés par le bon gestionnaire",
  "productPage.scheduling.section.requests.body":
    "Un membre de l'équipe demande un remplacement depuis son téléphone ; un collègue accepte d'abord, puis le gestionnaire approuve, et tout le monde est averti à chaque étape. Les congés suivent les politiques que vous fixez, avec des soldes qui s'accumulent d'eux-mêmes, des dates bloquées et les jours fériés de votre province ou de votre État.",
  "productPage.scheduling.section.requests.bullet.1": "Échanger un quart, demander un remplacement, réclamer un quart ouvert — tout depuis le centre des demandes",
  "productPage.scheduling.section.requests.bullet.2": "Politiques de congés avec soldes, un plafond de personnes absentes en même temps et des dates bloquées",
  "productPage.scheduling.section.requests.bullet.3": "Les changements de disponibilités prennent effet à une date, pour que le tableau le sache d'avance",
  "productPage.scheduling.section.requests.alt":
    "Le centre des demandes : congé, échange, remplacement et disponibilités, avec les demandes du membre de l'équipe listées dessous",
  "productPage.scheduling.section.booking.heading": "Une page de réservation qui remplit le calendrier pendant que vous travaillez",
  "productPage.scheduling.section.booking.body":
    "Les clients choisissent un créneau selon les vraies disponibilités de la personne qui ira, avec le temps de route entre les chantiers et une fenêtre d'arrivée que vous promettez, sur une page qui porte votre nom. Un texto avant la visite, et un lien qui leur permet de la déplacer eux-mêmes.",
  "productPage.scheduling.section.booking.bullet.1": "Temps tampon de route entre les chantiers et une fenêtre d'arrivée — exacte, ±15, ±30 ou ±60 minutes",
  "productPage.scheduling.section.booking.bullet.2": "Prenez des frais de visite à la réservation et créditez-les sur la facture",
  "productPage.scheduling.section.booking.bullet.3": "Rappel par texto avant la visite ; le client la déplace depuis le lien, sans vous appeler",
  "productPage.scheduling.section.booking.alt":
    "Les réglages de la page de réservation : le code à intégrer, la durée d'une visite, le temps tampon de route et la fenêtre d'arrivée promise au client",
  "productPage.scheduling.section.clock.heading": "Pointer sur le chantier, pauses comprises",
  "productPage.scheduling.section.clock.body":
    "L'équipe pointe depuis n'importe quel téléphone, sur le chantier où elle se trouve — ou sur aucun, parce que la route et la cour sont de vraies heures. Le dîner et les pauses se pointent aussi. Au moment de toucher, le téléphone demande une seule fois sa position ; la feuille de temps montre ensuite à quelle distance du chantier c'était. Rien ne suit personne entre deux pointages.",
  "productPage.scheduling.section.clock.bullet.1": "Deux visites aujourd'hui ? Le pointage demande laquelle ; « aucun chantier » est toujours une option honnête",
  "productPage.scheduling.section.clock.bullet.2": "Pauses payées et non payées, depuis le téléphone",
  "productPage.scheduling.section.clock.bullet.3": "Une position au moment de pointer, jamais entre deux — la refuser ne change rien au pointage",
  "productPage.scheduling.section.clock.alt":
    "Le pointage : l'heure actuelle, le chantier, et le bouton Pointer",
  "productPage.scheduling.faq.phone.q": "Mon équipe doit-elle installer quelque chose ?",
  "productPage.scheduling.faq.phone.a":
    "Non. FieldQuo fonctionne dans le navigateur du téléphone et peut être épinglé à l'écran d'accueil pour s'ouvrir comme n'importe quelle icône. Rien à installer et rien à mettre à jour.",
  "productPage.scheduling.faq.reminders.q": "Comment les clients sont-ils rappelés ?",
  "productPage.scheduling.faq.reminders.a":
    "Par texto avant la visite, avec un lien pour la déplacer ou l'annuler. Il n'y a pas encore de rappel par courriel, et le texte du rappel est fixe — le texto « en route » est celui que vous pouvez modifier.",
  "productPage.scheduling.faq.crew-sees.q": "Que voit un membre de l'équipe ?",
  "productPage.scheduling.faq.crew-sees.a":
    "Ses propres quarts, les chantiers qui lui sont assignés, quoi acheter pour ceux-ci, et ses propres heures. Pas de prix, pas de soumissions, pas de factures, pas les demandes des autres — à moins que vous ne tourniez une molette pour lui.",
  "productPage.scheduling.faq.book-account.q": "Les clients ont-ils besoin d'un compte pour réserver ?",
  "productPage.scheduling.faq.book-account.a":
    "Non. La page de réservation demande un nom, un numéro de téléphone et une adresse, et la confirmation contient le lien qui sert à gérer la visite.",

  // /product/team
  "productPage.team.headline": "Donnez accès à votre équipe sans perdre le contrôle",
  "productPage.team.description":
    "Des niveaux d'accès prédéfinis pour l'équipe, les estimateurs, les répartiteurs et les gestionnaires, une molette par domaine pour quiconque a besoin d'autre chose, et un dossier par personne : documents, intégration, politiques, heures et paie.",
  "productPage.team.bullet.1": "Préréglages Équipe, Estimateur, Répartiteur et Gestionnaire, puis une molette par domaine et par personne",
  "productPage.team.bullet.2": "Des feuilles de temps rattachées à de vrais chantiers, pas à des estimations",
  "productPage.team.bullet.3": "Cycles de paie et fiches de paie à partir des heures approuvées",
  "productPage.team.bullet.4": "Documents des employés, intégration et politiques dans un seul dossier",
  "productPage.team.hero.alt":
    "L'écran d'accueil du gestionnaire : heures payées et salaires du jour, deux visites à répartir, l'état de l'équipe et les demandes à réviser",
  "productPage.team.section.access.heading": "Un titre de poste, ce sont des mots ; l'accès, c'est une molette",
  "productPage.team.section.access.body":
    "Partez d'un préréglage — Équipe, Estimateur, Répartiteur, Gestionnaire — puis changez n'importe quelle molette pour cette personne : ce qu'elle voit de l'horaire, des feuilles de temps, de la paie, des clients, des soumissions, des chantiers, des factures. C'est appliqué sur le serveur, pas seulement à l'écran, alors un bouton caché n'est jamais le seul obstacle.",
  "productPage.team.section.access.bullet.1": "Quatre préréglages et un éditeur personnalisé, une molette par domaine",
  "productPage.team.section.access.bullet.2": "Afficher les prix, Coût des chantiers et Paiements sont des interrupteurs distincts",
  "productPage.team.section.access.bullet.3": "Les accès d'équipe sont gratuits ; les sièges sont pour ceux qui rédigent soumissions et factures",
  "productPage.team.section.access.alt":
    "Le panneau des permissions d'un nouveau membre : les préréglages Équipe, Estimateur, Répartiteur et Gestionnaire, et une molette par domaine dessous",
  "productPage.team.section.home.heading": "L'écran d'accueil de chacun, sur son téléphone",
  "productPage.team.section.home.body":
    "Un membre de l'équipe ouvre FieldQuo sur son prochain quart, la note que vous avez laissée, ce qu'il a gagné aujourd'hui, et les boutons qu'il utilise vraiment : pointer, trouver un remplaçant, échanger, écrire. Un gestionnaire l'ouvre sur les heures payées du jour, les visites encore à répartir, qui est sur le chantier, et les demandes qui attendent une décision.",
  "productPage.team.section.home.bullet.1": "Le prochain quart avec le chantier, l'adresse et qui d'autre y est",
  "productPage.team.section.home.bullet.2": "Trouver un remplaçant, échanger un quart, demander un congé — depuis le même écran",
  "productPage.team.section.home.bullet.3": "La vue du gestionnaire : répartition, état de l'équipe, et ce qui est à réviser",
  "productPage.team.section.home.alt":
    "L'accueil de l'employé sur un téléphone : bon après-midi, le prochain quart, une note pour celui-ci, Trouver un remplaçant et Échanger, et Dépointer",
  "productPage.team.section.hr.heading": "Un dossier RH par personne",
  "productPage.team.section.hr.body":
    "Permis, cartes et certifications avec rappels d'expiration. Une liste d'intégration pour les nouveaux, avec le TD1 ou le W-4 rempli sur un téléphone et gardé au dossier — FieldQuo ne transmet rien à aucune autorité fiscale et ne demande jamais de numéro d'assurance sociale. Les politiques sont versionnées et reconnues par nom tapé, et une vue de conformité montre à qui il manque quoi.",
  "productPage.team.section.hr.bullet.1": "Des documents avec une date d'expiration et un rappel avant",
  "productPage.team.section.hr.bullet.2": "Liste d'intégration : formulaires à remplir, documents à téléverser, politiques à signer",
  "productPage.team.section.hr.bullet.3": "Le journal du gestionnaire pour les notes et les avis disciplinaires, conservé avec la personne",
  "productPage.team.section.hr.alt":
    "RH et conformité : une rangée par personne avec les documents à vérifier, l'avancement de l'intégration, les politiques non signées et les avis disciplinaires",
  "productPage.team.section.chat.heading": "Un salon de clavardage par chantier, et un pour l'entreprise",
  "productPage.team.section.chat.body":
    "Chaque chantier a un salon que l'équipe qui y travaille et le bureau partagent, pour que la photo de la façade de tiroir égratignée soit à côté du chantier et non dans les textos de quelqu'un. Les groupes et les messages directs sont juste à côté, avec les @mentions, sur le téléphone comme au bureau.",
  "productPage.team.section.chat.bullet.1": "Un salon par chantier, ouvert depuis le chantier et qui y ramène",
  "productPage.team.section.chat.bullet.2": "Groupes, messages directs et @mentions",
  "productPage.team.section.chat.bullet.3": "Compteurs de non-lus par salon, sur le téléphone",
  "productPage.team.section.chat.alt":
    "Le clavardage d'équipe : un salon de chantier avec les messages de l'équipe sur le gabarit du comptoir et la visite préalable, une @mention surlignée",
  "productPage.team.section.timesheets.heading": "Des feuilles de temps à partir de vrais pointages, avec les signaux",
  "productPage.team.section.timesheets.body":
    "Les heures arrivent rattachées au chantier et au quart sur lesquels elles ont été pointées. Le tableau montre qui était en retard et de combien, qui dépasse quarante heures cette semaine, et — pour quiconque a l'accès à la paie — ce que la journée et la semaine coûtent en salaires. Vous approuvez les heures avant qu'elles puissent devenir de la paie.",
  "productPage.team.section.timesheets.bullet.1": "En retard ou à l'heure d'après le pointage par rapport au quart, pas de mémoire",
  "productPage.team.section.timesheets.bullet.2": "Heures supplémentaires signalées par personne à mesure que la semaine avance",
  "productPage.team.section.timesheets.bullet.3": "La masse salariale du jour et de la semaine, cachée à quiconque n'a pas l'accès à la paie",
  "productPage.team.section.timesheets.alt":
    "Le tableau de la journée vu par un répartiteur : heures planifiées, heures supplémentaires au-delà de quarante, pastilles En retard et À l'heure, et une note disant que le coût de main-d'œuvre n'est montré qu'à ceux qui voient les taux de paie",
  "productPage.team.section.payroll.heading": "Cycles de paie et fiches de paie à partir des heures approuvées",
  "productPage.team.section.payroll.body":
    "Les heures approuvées et le taux de chaque personne deviennent un cycle de paie pour la période que vous choisissez, avec une fiche de paie PDF par personne. FieldQuo calcule le salaire brut ; il ne paie pas les employés et ne produit pas les déclarations de retenues. Quelqu'un de votre effectif marqué comme contractuel peut être payé pour ses heures pointées par un vrai virement à sa banque.",
  "productPage.team.section.payroll.bullet.1": "Périodes de paie selon votre cycle, une fiche de paie PDF par personne",
  "productPage.team.section.payroll.bullet.2": "Les contractuels de votre effectif payés pour leurs heures pointées au taux que vous fixez",
  "productPage.team.section.payroll.bullet.3": "Les entreprises sous-traitantes au dossier avec leurs assurances, leurs attestations et ce que vous leur avez payé cette année",
  "productPage.team.section.payroll.alt":
    "Paie : les heures approuvées de la période, brut, retenues et net, et un nouveau cycle de paie en préparation",
  "productPage.team.faq.taxes.q": "FieldQuo produit-il les déclarations de retenues à la source ?",
  "productPage.team.faq.taxes.a":
    "Non. Il calcule le salaire brut à partir des heures approuvées et produit les fiches de paie. Les retenues sont celles que vous ou votre comptable fournissez, et rien n'est transmis à une autorité fiscale.",
  "productPage.team.faq.crew-free.q": "Les accès d'équipe sont-ils gratuits ?",
  "productPage.team.faq.crew-free.a":
    "Oui. Un accès Équipe voit son propre horaire, pointe et dépointe, et classe des photos — il ne compte pas dans vos sièges. Les sièges sont pour les personnes qui créent et modifient soumissions, chantiers et factures.",
  "productPage.team.faq.see-pay.q": "Un répartiteur peut-il voir ce que je paie les gens ?",
  "productPage.team.faq.see-pay.a":
    "Seulement si vous lui donnez l'accès à la paie. Sans cet accès, le tableau montre les heures et les heures supplémentaires et dit pourquoi l'argent n'y est pas. Chaque taux et chaque montant de salaire est caché sur le serveur, pas seulement à l'écran.",
  "productPage.team.faq.leaves.q": "Que se passe-t-il quand quelqu'un part ?",
  "productPage.team.faq.leaves.a":
    "Vous le désactivez. Ses heures, ses documents et son historique restent au dossier ; il ne peut plus se connecter, et son siège est libre pour la prochaine personne.",

  // /product/analytics
  "productPage.analytics.headline": "Connaissez vos chiffres avant de deviner",
  "productPage.analytics.description":
    "Voyez vos vrais frais généraux, votre seuil de rentabilité par chantier, et comment vos prix se comparent à ceux d'autres entreprises de votre métier — plus un assistant IA qui répond à des questions sur votre propre entreprise.",
  "productPage.analytics.bullet.1":
    "Taux de dépense et prix plancher, calculés à partir de vos vraies dépenses",
  "productPage.analytics.bullet.2":
    "Dépenses marketing ventilées par canal — Facebook, Google, TikTok et plus",
  "productPage.analytics.bullet.3":
    "Voyez comment vos prix se comparent, anonymement, à ceux d'autres entreprises de votre métier",
  "productPage.analytics.bullet.4":
    "Posez à FieldQuo AI des questions comme « mon taux de conversion est-il normal ? »",
  "productPage.analytics.section.kpis.heading": "Le tableau des indicateurs : ventes, argent, coûts, profit, exécution",
  "productPage.analytics.section.kpis.body":
    "Taux de réussite, valeur moyenne d'un chantier, conversion des prospects en soumissions, revenus contre dépenses par jour, main-d'œuvre en part des revenus, achèvement à temps. Chaque chiffre vient de ce qui est déjà dans FieldQuo — pas de connexion bancaire, pas de chiffrier. Une carte sans données dit pourquoi, au lieu d'afficher un zéro.",
  "productPage.analytics.section.kpis.bullet.1": "Ce mois-ci, le mois dernier, ce trimestre, depuis le début de l'année ou l'an dernier",
  "productPage.analytics.section.kpis.bullet.2": "États financiers, gagnés et perdus, et précision des estimations comme rapports à part",
  "productPage.analytics.section.kpis.bullet.3": "Un résumé hebdomadaire, et un bilan mensuel en phrases plutôt qu'en graphiques",
  "productPage.analytics.section.kpis.alt":
    "Le tableau des indicateurs : les cartes de ventes, les flux d'argent avec revenus contre dépenses par jour, et les coûts de l'entreprise",
  "productPage.analytics.section.overhead.heading": "Les frais généraux, et le prix plancher qu'ils impliquent",
  "productPage.analytics.section.overhead.body":
    "Loyer, assurances, téléphones, salaires de bureau, le prêt du camion et ce que le camion perd en valeur chaque mois — entrés une fois. Dites à FieldQuo combien de chantiers l'équipe prend dans une semaine normale et il vous dit le prix le plus bas qu'un chantier peut porter tout en couvrant l'entreprise.",
  "productPage.analytics.section.overhead.bullet.1": "Coûts fixes, salaires, dettes, actifs et amortissement, factures à venir",
  "productPage.analytics.section.overhead.bullet.2": "Les heures payées qui n'ont jamais atteint un chantier comptées comme frais généraux, pas cachées",
  "productPage.analytics.section.overhead.bullet.3": "Le prix plancher s'affiche à côté du total de la soumission pendant que vous la montez",
  "productPage.analytics.section.overhead.alt":
    "L'écran des frais généraux : chantiers par semaine, heures payées qui n'ont jamais atteint un chantier, et les sections coûts fixes, salaires et dettes",
  "productPage.analytics.section.expenses.heading": "Dépenses, taux de dépense et marge de manœuvre",
  "productPage.analytics.section.expenses.body":
    "Notez ce que vous dépensez, ou importez un mois entier d'un relevé bancaire CSV, et séparez ce qui appartient à un chantier de ce qui appartient à l'entreprise. Le taux de dépense mensuel et la marge de manœuvre sur l'argent que vous avez en découlent.",
  "productPage.analytics.section.expenses.bullet.1": "Import d'un CSV bancaire ; jamais de connexion à votre banque",
  "productPage.analytics.section.expenses.bullet.2": "Dépenses de chantier contre dépenses d'entreprise, par catégorie, sur six mois",
  "productPage.analytics.section.expenses.bullet.3": "Dépenses marketing par canal, avec un import automatique depuis Meta Ads",
  "productPage.analytics.section.expenses.alt":
    "Suivi des dépenses : dépenses suivies ce mois-ci, taux de dépense mensuel, marge de manœuvre, la ventilation et la tendance sur six mois",
  "productPage.analytics.section.costing.heading": "Coût des chantiers : ce que vous avez soumis contre ce que ça a coûté",
  "productPage.analytics.section.costing.body":
    "La soumission porte un coût estimé — heures d'équipe, matériaux d'après la recette, une part de frais généraux — que le client ne voit jamais. Une fois le chantier terminé, les heures pointées, les matériaux achetés et les dépenses notées se placent face au prix, pour que vous sachiez ce que vous avez vraiment fait et quelles estimations dépassent.",
  "productPage.analytics.section.costing.bullet.1": "Main-d'œuvre, matériaux et dépenses face au prix soumis, par chantier",
  "productPage.analytics.section.costing.bullet.2": "Précision des estimations : l'écart médian sur vos chantiers terminés",
  "productPage.analytics.section.costing.bullet.3": "Un rappel de réviser vos coûts quand un chantier dépasse le seuil que vous fixez",
  "productPage.analytics.section.costing.alt":
    "Le panneau Coût et marge d'une soumission : heures d'équipe, frais généraux en part du prix, matériaux et main-d'œuvre, et le coût estimé face au prix soumis",
  "productPage.analytics.section.benchmark.heading": "Comment vos prix se comparent, sans nommer personne",
  "productPage.analytics.section.benchmark.body":
    "Adhérez, et votre soumission moyenne par catégorie de service est mise en regard de la moyenne anonymisée des autres entreprises de votre métier sur la plateforme. Vos soumissions individuelles ne sont jamais partagées et aucune entreprise n'est nommée — la vôtre comprise.",
  "productPage.analytics.section.benchmark.bullet.1": "Adhésion depuis les réglages ; rien n'est comparé tant que vous ne le dites pas",
  "productPage.analytics.section.benchmark.bullet.2": "Prix moyen et taux de réussite par catégorie de service",
  "productPage.analytics.section.benchmark.bullet.3": "Des moyennes agrégées seulement — une catégorie avec trop peu d'entreprises n'affiche rien",
  "productPage.analytics.section.benchmark.alt":
    "Votre position, avant d'adhérer : l'explication que la comparaison se fait sur adhésion et le lien vers les réglages",
  "productPage.analytics.section.ai.heading": "Demandez à FieldQuo AI, à propos de votre propre entreprise",
  "productPage.analytics.section.ai.body":
    "Quels clients n'ont pas encore été facturés ? Quelle est ma soumission moyenne ce mois-ci ? Quels coûts de matériaux ont le plus monté ? FieldQuo AI cherche la réponse dans vos propres soumissions, factures, clients et coûts plutôt que de deviner. Il répond sur votre entreprise seulement : il décline les questions générales, et il ne voit jamais les données d'une autre entreprise.",
  "productPage.analytics.section.ai.bullet.1": "Des réponses tirées de vos propres chiffres, avec les montants utilisés",
  "productPage.analytics.section.ai.bullet.2": "Décline tout ce qui ne concerne pas votre entreprise",
  "productPage.analytics.section.ai.bullet.3": "Mesuré en crédit IA, avec une allocation dans chaque forfait",
  "productPage.analytics.section.ai.alt":
    "FieldQuo AI : quatre questions à essayer, sur les clients non facturés, la valeur moyenne des soumissions, les coûts de matériaux et les soumissions sans réponse",
  "productPage.analytics.faq.other-data.q": "L'IA voit-elle les données d'autres entreprises ?",
  "productPage.analytics.faq.other-data.a":
    "Non. FieldQuo AI lit les dossiers de votre entreprise et rien d'autre. La comparaison des prix utilise des moyennes anonymisées auxquelles vous adhérez ; vos soumissions ne sont jamais montrées à personne.",
  "productPage.analytics.faq.general.q": "Puis-je lui poser des questions générales ?",
  "productPage.analytics.faq.general.a":
    "Non. Il répond aux questions sur votre propre entreprise — vos soumissions, chantiers, factures, clients, coûts et heures — et décline tout le reste. Ce n'est pas un assistant généraliste.",
  "productPage.analytics.faq.bank.q": "Dois-je connecter ma banque ?",
  "productPage.analytics.faq.bank.a":
    "Non, et vous ne pouvez pas. Les revenus viennent des paiements enregistrés dans FieldQuo ; les dépenses sont celles que vous notez ou importez d'un relevé bancaire CSV que vous téléchargez vous-même.",
  "productPage.analytics.faq.benchmark-source.q": "D'où viennent les chiffres de comparaison ?",
  "productPage.analytics.faq.benchmark-source.a":
    "D'autres entreprises de votre métier sur FieldQuo qui ont aussi adhéré, en moyenne par catégorie de service sans nommer personne. Une catégorie avec trop peu d'entreprises derrière n'affiche rien plutôt qu'un chiffre trompeur.",

  // Page furniture shared by all four
  "productPage.chrome.readHow": "Lire comment ça fonctionne",
  "productPage.chrome.inEnglish": "en anglais",
  "productPage.chrome.everythingTitle": "Tout ce que comprend {label}",
  "productPage.chrome.everythingBody":
    "Chaque capacité listée ici est dans le produit aujourd'hui. Là où l'une s'arrête, c'est écrit.",
  "productPage.chrome.faqTitle": "Questions courantes",
};

export default fr;
