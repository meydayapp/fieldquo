// docs/sales/guide/content.fr.js
//
// The words of the FieldQuo sales reference guide, in Québec French.
//
// ══ Which French, and why it matters more than usual ══════════════════════
//
// The reader is a rep on the phone to a contractor in Laval, and the fastest
// way to lose that call in the first minute is the wrong trade word. So this is
// Québec French in the trade register, not International French:
//
//   soumission     not devis      — a Québec contractor has never said "devis"
//   chantier       not projet
//   poinçonner     not pointer    — what a crew member calls clocking in
//   carré          not 100 pi²    — the roofing unit, said out loud
//   égout / rive / faîte / arêtier / noue — the five linear details on a roof
//   magasiner      — what a tyre-kicker is doing, in one verb
//   chicane        — a dispute with a homeowner, in the word both would use
//   lead           not prospect   — the portal's own tab is "Mes leads", and the
//                                   owner's rule for the guide is the rep's word
//   cellulaire     not portable/mobile — the phone in a contractor's pocket
//   texto          not SMS in prose — the tab is labelled "SMS" and is quoted
//                                   as such; the verb a rep uses is "texter"
//
// The trades the guide does not happen to name have the same rule waiting for
// them if a section is ever added: gypse (not plaque de plâtre), CVAC (not the
// France acronym CVC), revêtement extérieur for siding.
//
// The same choices are already shipping in app/i18n/messages.js and
// app/i18n/featurePages/fr.js; this file follows them rather than inventing a
// second vocabulary, because a rep reading "soumission" here and seeing
// "soumission" on the demo screen is the whole point.
//
// ══ Not translated, deliberately ══════════════════════════════════════════
//
// FieldQuo, Stripe, Jobber, Housecall Pro, Marketing Designer (a screen that
// ships in English), and e-transfer — which is a proper noun in Canada and
// which a Québec contractor says in English inside a French sentence.
//
// ══ What this file cannot reach ═══════════════════════════════════════════
//
// The builder takes feature names, summaries, group headings and every PARTIAL
// feature's "what it does not do" sentence from lib/marketing/featureMatrix.js,
// which is English-only. Those render in English in this edition. That is not
// an oversight to fix here: the limits sentences are legally load-bearing, and
// a mistranslated limit is worse than an English one. French versions of all
// ten already exist in app/i18n/featurePages/fr.js if the builder is ever
// taught to read them.
//
// ══ The one rule for whoever edits this ═══════════════════════════════════
//
// The `key` fields in `glossary` and the `keys` arrays in DEEP_DIVES are
// featureMatrix keys, not words. Translating one does not break the build — it
// silently drops a chip or a cross-reference. Leave them exactly as they are.
export const GUIDE = {
  lang: "fr",
  dir: "ltr",
  title: "FieldQuo — la référence de vente",
  subtitle: "Ce qu'on vend, ce que ça fait, et où sont les limites.",
  generated: "Généré",
  // Gabarit plutôt qu'une concaténation dans le générateur : le compte ne
  // tombe pas au même endroit dans la phrase d'une langue à l'autre.
  coverMeta: "Généré le {date} · {features} fonctions",
  intro: {
    heading: "Comment se servir de ce document",
    body: [
      "C'est la référence derrière le script. Le guide d'appel vous dit quoi dire; celui-ci vous dit ce qui est vrai, pour que la question à laquelle vous ne vous attendiez pas trouve une réponse plutôt qu'une supposition.",
      "Chaque fonction listée ici vient de la matrice des fonctions du produit, qui nomme les fichiers qui doivent exister pour chacune d'elles. Si une fonction est dans ce document, elle est dans le produit. Si quelque chose ne s'y trouve pas, ne le promettez pas.",
      "Chaque fonction est décrite telle qu'elle fonctionne aujourd'hui. Quand quelque chose est plus récent que le reste, la section détaillée le dit. Si un entrepreneur demande une chose que vous ne trouvez pas dans ce document, dites que vous allez vérifier plutôt que de deviner — l'entrepreneur qui achète sur une promesse que vous ne pouvez pas tenir annule au deuxième mois, et il dit à tout le monde pourquoi.",
      "Une règle sur ce qu'on vous confie : les leads du Québec ne vont qu'aux représentants qui ont coché le français sous « Langues dans lesquelles je peux vendre » dans l'onglet Paie. Si un entrepreneur du Québec est à votre écran, c'est pour cette raison — prenez l'appel en français.",
      "La première moitié de ce document, c'est le produit — ce que vous vendez. La deuxième, « Votre console », c'est la pièce d'où vous le vendez : le composeur, le lot, les textos, le clavardage d'équipe et votre paie. Lisez cette moitié-là dès le premier jour; c'est ce que fait l'écran devant vous.",
    ],
  },
  pitchHeading: "Le seul argument à mettre en avant",
  pitch: [
    "Toutes les fonctions de ce document sont dans tous les forfaits. Toutes. Les forfaits se distinguent par le nombre de personnes qui peuvent s'en servir, et par rien d'autre.",
    "C'est ça, l'argument de vente. L'entrepreneur qui nous compare à Jobber ou à Housecall Pro est habitué à une grille où ce dont il a vraiment besoin se trouve deux paliers plus haut. Ici, il n'y a pas de palier à gravir : le forfait le moins cher, c'est le produit au complet pour une personne, et payer plus n'ajoute que des postes.",
  ],
  plansHeading: "Les forfaits, et ce qui change vraiment",
  plansIntro: "Quatre forfaits. Les seules différences sont les postes, les accès équipe et le prix.",
  planCols: { plan: "Forfait", price: "Par mois", seats: "Postes complets", crew: "Accès équipe" },
  planNote:
    "Un poste complet, c'est quelqu'un qui crée et modifie des soumissions, des chantiers et des factures. Un accès équipe, c'est quelqu'un qui poinçonne, consulte son horaire et ajoute des photos — ça ne coûte rien et ça ne compte pas comme un poste.",
  deepHeading: "Les parties sur lesquelles on va vous questionner",
  deepIntro:
    "Dans l'ordre de la journée d'un entrepreneur, pas dans l'ordre où le logiciel est bâti. Chaque section nomme les fonctions qu'il y a derrière, pour que vous puissiez les retrouver dans le tableau de référence.",
  consoleHeading: "Votre console — la pièce d'où vous vendez",
  consoleIntro: [
    "Tout ce qui précède, c'est ce qu'un entrepreneur achète. Ceci, c'est ce dans quoi vous travaillez. Chaque section dit ce que l'écran montre et ce que vous y faites, rien de plus — chaque phrase a été vérifiée contre le code en marche et contre les écrans rendus dans docs/screens le jour où ce document a été bâti. Si l'écran devant vous contredit une phrase d'ici, c'est l'écran qui est plus récent; dites-le à l'équipe dans #sales.",
  ],
  referenceHeading: "Toutes les fonctions, par partie de l'entreprise",
  referenceIntro:
    "Tout, regroupé par le volet de l'entreprise que ça sert. Chaque ligne porte le nom de la fonction et sa description en une phrase — les mêmes mots que le site public.",
  partialHeading: "Où sont les limites — à lire avant votre premier appel",
  partialIntro:
    "Dix fonctions font moins que ce que leur nom laisse croire. La formulation ci-dessous est celle du produit, pas une version adoucie. Dites-la telle quelle pendant l'appel et vous ne vous ferez jamais prendre; nommez seulement la fonction et vous allez vous faire prendre.",
  gapsHeading: "Deux choses qu'on livre et qu'on n'annonce pas",
  gapsIntro:
    "Trouvées en écrivant ce guide : les deux sont dans le produit et ni l'une ni l'autre n'est dans la matrice des fonctions, donc aucune n'apparaît sur les pages de comparaison publiques. Parlez-en, mais dites clairement qu'elles sont plus récentes que le reste de ce document.",
  glossaryHeading: "Lexique",
  glossaryIntro: "Les mots qu'un entrepreneur ne connaît peut-être pas, et ceux qu'on emploie autrement que nos concurrents.",
  contentsHeading: "Table des matières",
  backToContents: "Retour à la table des matières",
  limitLabel: "Ce que ça ne fait pas",
  limitInEnglish: "original anglais",
  seeAlso: "Voir",
  partialBadge: "PARTIEL",
  shippedBadge: "LIVRÉ",
  gaps: [
    {
      title: "La lecture des photos par l'IA",
      body:
        "Une lecture approfondie des photos jointes à une soumission, facturée à l'utilisation sur les crédits IA de l'entreprise. C'est pour ça qu'un entrepreneur peut envoyer cinq photos d'une toiture et recevoir quelque chose d'utile sur la toiture, plutôt que la description d'une image. Ce n'est pas dans la matrice des fonctions, donc ça n'apparaît pas sur les pages de comparaison publiques.",
    },
    {
      title: "Le Marketing Designer",
      body:
        "Les visuels de publicité et de réseaux sociaux faits à l'intérieur de FieldQuo, organisés par campagne, avec les couleurs de l'entreprise et ses propres photos de chantier. L'entrepreneur qui paie quelqu'un depuis un bout de temps pour faire ses publications Facebook va s'y intéresser tout de suite. Absent de la matrice, lui aussi.",
    },
  ],
  glossary: [
    { term: "Accès équipe", def: "Quelqu'un qui poinçonne, consulte son horaire et ajoute des photos. Gratuit, et n'utilise pas de poste.", key: "crew_shifts" },
    { term: "Activée · Renouvelée · Paie toujours", def: "Les trois étapes de votre paie pour un client — 20 $ CA quand son compte Stripe peut encaisser, 40 $ CA quand il atteint son cycle de facturation suivant, 65 $ CA quand il est encore abonné soixante jours après son inscription." },
    { term: "Boîte de réception équipe", def: "Les textos avec les gars qui n'ont pas d'accès et qui n'installeront pas d'application. Ils textent un numéro; ça arrive au bureau, classé à leur nom.", key: "crew_inbox" },
    { term: "Brouillon de suivi", def: "Un texto que FieldQuo rédige pour vous et dépose dans la conversation — au jour 1 et au jour 7 après l'inscription d'une entreprise, puis à l'approche du cap des 60 jours. Vous le modifiez et vous appuyez sur Envoyer. Rien ne l'envoie à votre place." },
    { term: "Carnet de prix", def: "Les taux de l'entrepreneur pour la main-d'œuvre, les matériaux et les services. Tout ce qui est chiffré dans FieldQuo vient de là.", key: "price_book" },
    { term: "Cellulaire", def: "Le téléphone dans la poche de l'entrepreneur. C'est là que le propriétaire ouvre la soumission, et là que l'entrepreneur reçoit votre texto." },
    { term: "Coût de revient du chantier", def: "Le soumissionné comparé au réel, une fois les travaux finis — pour que les prix de l'an prochain soient bâtis sur ce qui s'est vraiment passé.", key: "job_costing" },
    { term: "Estimation instantanée", def: "Un prix que le propriétaire produit lui-même sur le site web de l'entrepreneur, à partir des taux de l'entrepreneur. Jamais des nôtres.", key: "instant_quotes" },
    { term: "Lead", def: "Un entrepreneur qu'on veut comme client. Ceux que la file vous confie et ceux que vous avez entrés vous-même sont tous des leads; on ne dit pas « prospect ».", },
    { term: "Lecture IA approfondie", def: "La lecture de photos payante. À distinguer de la révision gratuite, qui regarde aussi les photos mais ne facture rien." },
    { term: "Lot", def: "Les 25 leads que le serveur vous remet en une pression sur Réserver les 25 suivants — seulement des leads dont la plage d'appel est ouverte à cette minute-là. Il se recomplète tout seul quand il en reste moins de 5 à appeler." },
    { term: "Marque blanche", def: "Chaque document que le propriétaire voit porte le nom et les couleurs de l'entrepreneur, pas les nôtres. C'est le comportement par défaut, pas une option payante.", key: "white_label" },
    { term: "Métré", def: "Le formulaire propre au métier qui transforme des mesures en soumission chiffrée — des carrés de toiture, des pieds linéaires de gouttière, des portes et des tiroirs.", key: "quotes" },
    { term: "Pastilles de fuseau", def: "Tous · ET · CT · MT · PT au-dessus de votre liste. Choisissez-en une et la liste, Suivant et l'appel automatique restent dans ce fuseau-là." },
    { term: "Plage d'appel", def: "Les heures où une entreprise peut légalement être appelée, dans son propre fuseau, selon la règle de son État ou de sa province. La console n'affiche jamais de bouton Appeler en dehors." },
    { term: "Poste", def: "Quelqu'un qui crée et modifie des soumissions, des chantiers et des factures. Les postes sont la seule chose qui distingue les forfaits.", key: "team_access" },
    { term: "Résultat", def: "Ce qui s'est passé pendant l'appel, choisi parmi dix issues, avec la prochaine étape. L'enregistrer met fin à « Rédaction du compte rendu » et, si l'appel automatique est activé, fait sonner le lead suivant." },
    { term: "Seuil de rentabilité", def: "Le prix sous lequel un chantier fait perdre de l'argent à l'entrepreneur, calculé à partir de ses propres frais généraux et de sa propre main-d'œuvre plutôt qu'avec une règle du pouce.", key: "break_even" },
    { term: "Statut", def: "Ce que vous avez dit au portail que vous faisiez — Disponible, Pause, Souper, Réunion, Formation ou Hors ligne. Un appel entrant ne sonne que chez les représentants Disponibles; les deux états que le système règle lui-même sont En appel et Rédaction du compte rendu." },
    { term: "Supplément", def: "Un extra que le client peut accepter directement sur la soumission, dont le prix est calculé par le serveur et jamais par le navigateur. Le propriétaire le coche; le total se met à jour.", key: "add_on_upsell" },
  ],
};


/**
 * Les sections de fond, dans l'ordre de la journée d'un entrepreneur.
 *
 * `keys` sont des clés de featureMatrix — pas des mots. Le builder résout
 * chacune vers son vrai nom, son résumé et ses limites, donc un paragraphe
 * d'ici ne peut jamais affirmer quelque chose que la matrice ne porte pas.
 * Traduire une clé ne casse rien : ça fait disparaître une pastille en
 * silence. Ne pas y toucher.
 */
export const DEEP_DIVES = [
  {
    id: "quoting",
    title: "La soumission, et la version en soixante secondes",
    keys: ["quotes", "quote_pdf", "quote_send", "instant_quotes", "self_quote", "call_to_quote", "aerial_measure"],
    body: [
      "La soumission, c'est le produit. Tout le reste existe parce que l'entrepreneur qui soumissionne plus vite décroche plus de contrats, et la plupart d'entre eux préparent leurs soumissions à neuf heures le soir, sur un portable, après une journée complète sur le chantier.",
      "Il y a trois façons de faire un prix. L'estimateur en bâtit une à partir du carnet de prix, sur la tablette, dans l'entrée de cour. Le propriétaire s'en fait une lui-même avec l'estimation instantanée sur le site web de l'entrepreneur. Ou la réceptionniste IA prend l'appel et en rédige une à partir de ce qui s'est dit.",
      "La promesse des soixante secondes, c'est la deuxième, et ça vaut la peine d'être précis sur ce qui fait le travail : le formulaire de métré du métier fait les calculs, le carnet de prix fournit les taux, et en toiture le toit est mesuré du ciel plutôt que saisi à la main. L'entrepreneur choisit des options; il ne calcule pas.",
      "La toiture, c'est celle à démontrer. Tapez l'adresse, et la superficie, la pente et les détails linéaires — égouts, rives, faîtes, arêtiers, noues — reviennent d'une mesure par satellite. Personne ne monte dans une échelle pour sortir le premier chiffre.",
    ],
  },
  {
    id: "getting-paid-to-quote",
    title: "Se faire payer pour se déplacer",
    keys: ["booking_page", "booking_deposit"],
    body: [
      "Les entrepreneurs qui facturent l'estimation le font en général parce qu'ils se sont fait avoir par des curieux qui magasinent des prix. Ils vont demander si le logiciel peut encaisser ce montant-là avant la visite. Il le peut.",
      "La page de réservation prend le rendez-vous et le dépôt dans la même étape, donc la plage horaire n'est retenue qu'une fois la carte passée. Pour une entreprise qui a des frais de déplacement ou d'évaluation, ces frais-là sont le dépôt.",
      "À dire pendant l'appel : c'est la même page de réservation que le propriétaire utilise pour prendre n'importe quel rendez-vous, donc l'entrepreneur qui ne facture rien laisse simplement le dépôt de côté. C'est un seul écran avec l'argent activé ou non, pas un produit à part.",
    ],
  },
  {
    id: "cost-and-margin",
    title: "Le coût, la main-d'œuvre, et la marge que l'entrepreneur garde vraiment",
    keys: ["job_costing", "break_even", "price_book", "material_costs", "benchmark", "expenses"],
    body: [
      "C'est la partie qui nous sépare d'une application de soumission, et c'est celle que la plupart des entrepreneurs n'ont jamais eue. Un écran de soumission montre le prix. Ici, on montre ce que le chantier coûte à faire et ce qu'il en reste.",
      "Les matériaux viennent des recettes, la main-d'œuvre des heures au taux qu'ils paient vraiment, et les frais généraux de ce qu'ils nous ont dit dépenser. La marge à l'écran est la leur, pas un pourcentage que quelqu'un a deviné.",
      "Le seuil de rentabilité, c'est celui qui frappe. Il répond à la question à laquelle un entrepreneur n'a jamais été capable de répondre : en dessous de quel prix ce chantier-là me fait perdre de l'argent. Le représentant capable de sortir ce chiffre-là ne vend plus un logiciel.",
      "Le coût de revient boucle ensuite la boucle après les travaux — le soumissionné contre le réel — pour que le carnet de prix de l'an prochain soit bâti sur ce qui s'est passé plutôt que sur ce qu'on espérait.",
    ],
  },
  {
    id: "ai-review",
    title: "La révision par l'IA, et la lecture des photos",
    keys: ["ai_quote_review", "add_on_upsell", "ai_copilot"],
    body: [
      "Avant qu'une soumission parte, l'IA la lit et dit ce qui manque, ce qui est chiffré bizarrement par rapport à l'historique de l'entrepreneur lui-même, et quels suppléments ce genre de chantier demande habituellement.",
      "Deux choses à surveiller ici, parce que c'est là-dessus qu'un entrepreneur sceptique va appuyer. La comparaison se fait avec SON historique, jamais avec celui d'une autre entreprise — ses chiffres ne sortent jamais de son compte. Et elle suggère : elle ne modifie jamais la soumission et n'envoie rien.",
      "Il y a aussi une lecture de photos payante, plus approfondie, sur les photos jointes à une soumission. Elle consomme des crédits IA à chaque passage, et c'est pour ça que c'est un bouton plutôt que quelque chose qui se déclenche tout seul sur chaque photo.",
    ],
  },
  {
    id: "approval-to-invoice",
    title: "L'acceptation, la signature, et la facture qui se fait toute seule",
    keys: ["online_approval", "invoices", "invoice_send", "invoice_changes", "client_portal"],
    body: [
      "Le propriétaire ouvre la soumission sur son téléphone, l'accepte et la signe là, tout de suite. Pas d'impression, pas de numérisation, pas de rendez-vous pour aller chercher une signature.",
      "La facture reprend ensuite la soumission au lieu d'être refaite : mêmes lignes, même mise en page, même image de marque. Ce miroir est voulu et ça vaut la peine de le nommer, parce que le défaut classique dans cette catégorie, c'est une facture qui contredit discrètement la soumission que le client a signée.",
      "Une facture modifiée garde son historique, donc l'entrepreneur peut montrer ce qui a changé et quand. Sur un chantier contesté, cet historique-là, c'est toute la preuve.",
    ],
  },
  {
    id: "payments",
    title: "Aller chercher l'argent",
    keys: ["card_payments", "stripe_connect", "financing", "sales_tax", "service_plans"],
    body: [
      "Le paiement par carte passe par Stripe et s'en va dans le compte de versement de l'entrepreneur LUI-MÊME. FieldQuo ne détient jamais son argent — ça vaut la peine de le dire tôt, parce que des entrepreneurs se sont déjà fait avoir par des plateformes qui se placent entre eux et leur argent.",
      "L'argent comptant, les chèques et les e-transfer sont inscrits à la main sur la facture, pour que le montant payé colle à la réalité, peu importe ce que le propriétaire a fait.",
      "Les taxes de vente sont calculées à partir de l'adresse du chantier plutôt que de celle de l'entreprise, ce qui compte pour quiconque travaille de part et d'autre d'une frontière.",
      "Le financement est celui à formuler avec soin — lisez ses limites dans la dernière section avant de l'offrir pendant un appel.",
    ],
  },
  {
    id: "doing-the-work",
    title: "De la facture à l'équipe : horaire, répartition et la journée elle-même",
    keys: ["jobs", "scheduling", "crew_shifts", "time_clock", "timesheets", "job_photos", "crew_inbox", "recurring_jobs"],
    body: [
      "Une soumission acceptée devient un chantier, le chantier est mis à l'horaire et réparti, et l'équipe voit où aller et quoi faire.",
      "Les gars poinçonnent en arrivant et en partant, et ces heures-là sont celles qui alimentent les feuilles de temps, le coût de revient et la paie — une seule saisie d'heures, pas trois.",
      "La boîte de réception équipe, c'est le texto pour les gens qui n'ont pas d'accès et qui n'installeront pas d'application. Un employé texte un numéro et ça arrive au bureau, classé à son nom. Les entrepreneurs qui travaillent avec des sous-traitants ou des équipes saisonnières comprennent tout de suite.",
      "Les photos avant-après sont jointes au chantier, et c'est généralement là qu'une chicane avec un propriétaire se termine.",
    ],
  },
  {
    id: "the-phone",
    title: "Le téléphone : la réceptionniste IA",
    keys: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    body: [
      "Un entrepreneur sur un toit ne répond pas au téléphone, et un appel manqué, c'est un contrat qui s'en va à celui qui a répondu.",
      "La réceptionniste répond, prend les détails et fixe la visite. Elle peut aussi rappeler pour confirmer un rendez-vous.",
      "La démonstration la plus forte, c'est l'appel qui se transforme en soumission rédigée — la demande arrive déjà assez chiffrée pour que l'entrepreneur la regarde, au lieu d'arriver comme un message vocal à retourner.",
      "Deux faits qui reviennent tout le temps : l'entrepreneur peut garder le numéro qui est écrit sur son camion et y transférer ses appels manqués, ou prendre un nouveau numéro. Et c'est facturé à la minute sur un solde de crédits, donc un mois tranquille ne coûte presque rien.",
    ],
  },
  {
    id: "marketing",
    title: "Se faire trouver : le site web, les entonnoirs et les campagnes",
    keys: ["website_builder", "lead_form", "funnels", "email_campaigns", "review_requests", "testimonials", "bio_link", "embeds", "referrals"],
    body: [
      "La plupart des entrepreneurs n'ont pas de site web, ou en ont un qu'ils ne sont pas capables de modifier. FieldQuo en construit un à partir de ce qu'ils nous ont déjà dit — leurs métiers, leurs services, leurs photos — et il porte leur nom, pas le nôtre.",
      "Les entonnoirs de demandes, c'est la version pensée pour le téléphone, faite pour la publicité : quelques touches, une demande notée qui entre dans le pipeline, aucun formulaire à abandonner en chemin.",
      "Les demandes d'avis partent après les travaux, c'est-à-dire au moment où un client content va vraiment en écrire un.",
      "Il y a aussi un Marketing Designer pour les visuels de publicité et de réseaux sociaux : des visuels faits dans FieldQuo, classés par campagne, aux couleurs de l'entreprise et avec ses propres photos de chantier. L'entrepreneur qui paie quelqu'un pour faire ses publications Facebook va s'y intéresser. C'est plus récent que la plupart de ce document.",
    ],
  },
  {
    id: "languages",
    title: "Travailler dans plus d'une langue",
    keys: ["languages", "white_label", "quote_email_wording", "contract_terms"],
    body: [
      "Deux choses distinctes, et les représentants les mélangent. La première, c'est la langue dans laquelle l'ENTREPRENEUR travaille — l'application elle-même. La deuxième, c'est la langue que le PROPRIÉTAIRE lit — la soumission, la facture, les courriels.",
      "C'est la deuxième qui fait vendre. Un entrepreneur dont les clients sont hispanophones peut envoyer une soumission en espagnol tout en travaillant en anglais lui-même.",
      "Une règle à énoncer clairement, parce qu'elle sonne comme une limite alors que c'est justement la partie rassurante : un document garde la langue dans laquelle il a été créé. Une soumission signée dira toujours ce qu'elle disait au moment de la signature. Rien n'est retraduit dans le dos du client.",
      "Huit langues pour le client : anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien. La soumission en PDF, la facture, le courriel d'accompagnement et le portail client suivent tous la langue du client. L'entrepreneur la choisit une fois dans la fiche du client, et chaque document qui suit s'y conforme.",
    ],
  },
];


/**
 * Les outils du représentant, dans l'ordre d'un quart de travail : la console
 * où l'on se connecte, le lot qu'elle remet, l'appel qui revient, le fil de
 * textos, l'équipe derrière soi, la règle de langue, la messagerie vocale et
 * la paie.
 *
 * Pas de `keys` — rien de tout ça n'est dans la matrice des fonctions, parce
 * que rien de tout ça ne se vend. La preuve, c'est l'écran rendu : `shot`
 * nomme une image sous docs/screens, le vrai composant dessiné contre des
 * données de test, et le générateur l'insère sous la section. Les captures
 * sont en anglais — c'est le portail tel qu'il a été rendu — et les mots à
 * l'écran sont cités ici dans la langue du catalogue livré (app/i18n), pour
 * qu'un représentant francophone lise « Réserver les 25 suivants » ici et
 * sur son écran.
 */
export const CONSOLE_SECTIONS = [
  {
    id: "queue-screen",
    title: "La console : la liste à gauche, le lead au centre, le téléphone sous la main",
    shot: "docs/screens/sales-console/desktop-idle.png",
    shotCaption: "L'écran File d'appels : la barre latérale, le menu de statut, le Composeur à gauche, la carte à onglets avec Script ouvert.",
    body: [
      "Chaque écran de /sales a la même barre latérale verticale à gauche : Aujourd'hui · File d'appels · Argumentaire · Mes leads · Conversations · SMS · Équipe · Notes · Agenda · Mes entreprises · Démo · Assistance · Messagerie · Paie. SMS, Équipe et Messagerie portent une pastille quand quelque chose vous attend. Au pied : « Appels aujourd'hui N / 250 » — les appels que vous avez composés depuis le début de votre journée, contre le plafond du jour. Elle se replie en icônes si vous voulez la largeur.",
      "La barre du haut tient la boîte de recherche et votre statut. La pastille de statut dit ce que vous faites et depuis combien de temps — Disponible, En appel, Rédaction du compte rendu, Pause… — et ouvre un menu de six choix : Disponible · Pause · Souper · Réunion · Formation · Hors ligne. En appel et Rédaction du compte rendu ne sont pas dans le menu : appuyer sur Appeler règle le premier, raccrocher règle le deuxième, jusqu'à ce que vous enregistriez l'issue. Mettez-vous Hors ligne en partant, parce qu'un rappel ne sonne que chez les représentants Disponibles, et qu'un portable laissé sur Disponible sonne vingt secondes avant que l'appelant passe au suivant.",
      "Le Composeur est à gauche de l'écran File d'appels et il est bâti comme un téléphone : le numéro en gros caractères, un clavier 3 × 4, et Appeler en dessous. La petite ligne au-dessus de l'afficheur, c'est la plage d'appel du lead et la règle qui s'applique — « Plage fermée à 21 h · Règle de Oklahoma », ou « Règle FieldQuo » quand l'État n'en impose aucune. Sous le bouton Appeler, quand un État limite le nombre d'appels à la même entreprise sur le même sujet, une deuxième ligne fait le compte : « 1 appel sur 3 en 24 h · Oklahoma ». Hors de la plage, il n'y a pas de bouton Appeler du tout, seulement la raison et l'heure d'ouverture; un bouton grisé qui ne fait rien, c'est la seule chose que cet écran refuse de dessiner.",
      "Si le propriétaire vous donne un autre numéro — son cellulaire, souvent — tapez-le sur le clavier. Appeler l'enregistre d'abord sur ce lead, puis le compose avec les mêmes vérifications qu'un numéro déjà en fiche — jamais un numéro flottant, et un numéro sur la liste de ne-pas-contacter est refusé avec la phrase sous l'afficheur. Pendant l'appel, les mêmes touches envoient des tonalités, pour un menu téléphonique. L'appel automatique, c'est l'interrupteur sous le bouton : activé, le lead suivant sonne cinq secondes après que vous avez enregistré l'issue, et la carte s'ouvre sur Résultat au lieu de Script.",
      "À droite, une seule grande carte à huit onglets : Entreprise · Contact · Script · Recherche · Notes · Résultat · Tâches · Leads. Chaque numéro sous Entreprise et Contact a un bouton Appeler à côté. Script, c'est l'appel en étapes numérotées, puis les Points clés et l'Objectif — la demande pour laquelle cet appel existe. Recherche, c'est trois couches dans le même ordre chaque fois : les faits, puis ce qu'on pense (toujours avec un niveau de confiance), puis ce qu'on recommande. Résultat, c'est les dix issues et la prochaine étape. Tâches tient les rappels et les brouillons de suivi. Leads, c'est votre lot, regroupé par plage d'appel. Précédent · Suivant parcourent le lot; Suivant dans la file saute au premier lead que vous pouvez appeler maintenant.",
    ],
  },
  {
    id: "batch",
    title: "Votre lot : 25 à la fois, seulement des leads que vous pouvez appeler à cette minute",
    shot: "docs/screens/sales-console/desktop-top-up.png",
    shotCaption: "Le lot qui se recomplète tout seul : moins de 5 ouverts, trois leads du Pacifique ajoutés, deux leads de l'Est fermés libérés.",
    body: [
      "Choisissez un métier et appuyez sur Réserver les 25 suivants. C'est le serveur qui choisit — vous ne pouvez pas fouiller le bassin, et c'est voulu — et il ne vous remet que des leads dont la plage d'appel est ouverte à cette minute-là, celui qui ferme le plus tôt d'abord, les recherchés devant les autres. À huit heures du matin heure de l'Est, ça donne des leads de l'Est et de l'Atlantique; à neuf heures le soir, des leads du Pacifique. Un lot court dit pourquoi : « 12 ouverts maintenant — d'autres ouvrent à 11 h PT ».",
      "Vous n'appuyez pas une deuxième fois. Quand il vous reste moins de 5 leads encore appelables, la console ajoute le lot suivant toute seule, au plus une fois par minute, et le dit sans faire de bruit : « 25 leads ouverts maintenant ajoutés (PT). 3 leads fermés libérés. » Au même moment, les leads que vous n'avez jamais touchés et dont la plage est fermée pour le reste de votre quart retournent au bassin. Un lead que vous avez appelé, ou sur lequel vous avez fixé un rappel, ne vous est jamais retiré. Le plafond du jour est de 250 réservations, et la barre latérale les compte.",
      "Les pastilles de fuseau au-dessus de la liste — Tous · ET · CT · MT · PT, et AT · NT si vous en tenez — la filtrent, et la pastille choisie dit le prochain fait du fuseau : « ouvert jusqu'à 21 h PT », ou « fermé — ouvre à 8 h ». Suivant et l'appel automatique suivent le filtre : choisissez PT en fin de journée et la tournée reste sur la côte Ouest.",
      "S'il arrive moins de leads que demandé et que la note dit « N leads du Québec non proposés — ajoutez le français à vos langues dans l'onglet Paie », c'est la règle de langue deux sections plus bas, pas un bogue.",
    ],
  },
  {
    id: "incoming",
    title: "Quand un entrepreneur vous rappelle",
    shot: "docs/screens/sales-console/desktop-ring.png",
    shotCaption: "Le tiroir d'appel entrant, descendu sous la barre du haut : l'entreprise, le numéro, à qui est le lead, Décrocher, Refuser.",
    body: [
      "Un appel sur votre numéro sonne dans le portail, peu importe l'écran de /sales où vous êtes. Un tiroir descend sous la barre du haut avec le nom de l'entreprise, le numéro et à qui est le lead, et deux boutons : Décrocher et Refuser. Décrocher place l'appel en cours dans la case du Composeur, exactement là où un appel sortant se trouve, avec Couper le micro, Raccrocher et Transférer. Refuser redonne l'appel pour que le représentant suivant du plan de sonnerie le reçoive — ça n'envoie pas l'appelant dans la messagerie vocale. C'est seulement quand personne ne décroche que l'appelant patiente pendant que le système regarde encore, et qu'il atteint la messagerie vocale après.",
      "Qui sonne : d'abord le représentant à qui appartient le numéro composé; ensuite celui qui a appelé cet entrepreneur en dernier; puis les représentants Disponibles dont on a eu des nouvelles récemment — au plus trois, vingt secondes chacun. En pause, Hors ligne et les portables endormis sont sautés, et c'est pour ça que votre statut compte. Un appelant avec un indicatif du Québec, ou un lead que l'appariement place au Québec, ne sonne que chez les représentants qui ont le français.",
    ],
  },
  {
    id: "texts",
    title: "SMS : un client de clavardage, et rien ne s'envoie tout seul",
    shot: "docs/screens/sales-messages/desktop-thread-bottom.png",
    shotCaption: "SMS : les quatre groupes, une conversation avec un brouillon de suivi dedans, le composeur avec la ligne de plage, la barre de contact.",
    body: [
      "SMS, c'est un client de clavardage, pas une liste avec une boîte de rédaction. Les conversations à gauche sont en quatre groupes — À répondre · En attente de leur réponse · Brouillons à envoyer · Terminées —, la conversation est au centre avec les séparateurs de jour et la ligne rouge des non-lus, et le contact est dans une barre à droite (Détails · Canaux · Historique). Chaque texto part du numéro de vente de FieldQuo, et la réponse atterrit dans la même conversation.",
      "La ligne au-dessus du composeur, c'est la plage de texto du lead dans SON fuseau — « Ouvert jusqu'à 21 h CDT », ou « Fermé — ouvre à 8 h ». Le fuseau vient de sa province, ou du fuseau que vous avez indiqué après lui avoir parlé; un État à cheval sur deux fuseaux (Floride, Texas, C.-B.) fait l'objet d'une question plutôt que d'une supposition, et il n'est jamais déduit de l'indicatif. Le serveur juge la plage une deuxième fois à l'instant où vous appuyez sur Envoyer.",
      "STOP veut dire STOP. Une conversation où ils ont répondu STOP montre une étiquette STOP rouge et pas de composeur — rien ne peut être envoyé à ce numéro, sur aucun canal, et seule une demande écrite d'un superadministrateur la rouvre. Ne contournez pas ça avec votre propre cellulaire.",
      "Les suivis sont des brouillons. Au jour 1 après l'inscription d'une entreprise (la configuration a-t-elle passé?) et au jour 7 (est-ce que ça marche sur un vrai chantier?), plus un à l'approche du cap des 60 jours quand il est dû, le brouillon apparaît dans la conversation et sous Brouillons à envoyer avec l'indice « Tab pour le charger ». Vous le lisez, vous le changez, vous appuyez sur Envoyer. Rien ne part tout seul, jamais. Tapez ! dans le composeur pour les formulations toutes prêtes — les groupes Suivi et Vente, et le lien d'inscription.",
      "Nouveau message ouvre une conversation avec un de vos propres leads. Nouveau texto à un numéro prend un numéro que vous tapez — canadien ou américain seulement; un +1 des Caraïbes ou n'importe quoi d'outre-mer est refusé avec la raison, et un numéro qu'un autre représentant tient aussi. Un numéro que personne ne tient devient un lead avec seulement le numéro dessus, et le premier message est la présentation avec le lien d'inscription, envoyée par vous.",
    ],
  },
  {
    id: "team",
    title: "Équipe : tout le monde chez FieldQuo, d'un seul écran",
    body: [
      "Équipe, c'est le clavardage de FieldQuo — les représentants et ceux qui les appuient, dans les mêmes salons, sur le même écran qu'un administrateur de la plateforme voit. Trois canaux où tout le monde est : #fieldquo, tout FieldQuo et le seul que personne ne peut quitter; #sales, les représentants au téléphone et les gens derrière eux; et #support, où vous passez le problème d'un client à quelqu'un qui peut le régler. Nouveau groupe crée un salon privé avec les représentants et le personnel FieldQuo que vous choisissez; Nouveau message ouvre un message direct avec une personne; @ dans le composeur liste les membres du salon, et une mention ne peut nommer que quelqu'un qui y est. Une question posée ici est lue par quelqu'un qui peut agir.",
    ],
  },
  {
    id: "sells-in",
    title: "Langues dans lesquelles je peux vendre — et pourquoi le Québec peut ne pas vous parvenir",
    body: [
      "Dans Paie, sous la langue du portail, il y a Langues dans lesquelles je peux vendre. Cochez chaque langue dans laquelle vous pouvez prendre un appel de vente. Laissée sans réponse, elle compte comme anglais seulement. Les leads du Québec ne vont qu'aux représentants qui ont le français — à la réservation à l'unité, dans le lot, quand un lead vous est transféré, et quand un numéro du Québec appelle — et la file vous dit combien ont été retenus : « N leads du Québec non proposés — ajoutez le français à vos langues dans l'onglet Paie pour les recevoir. » Le Nouveau-Brunswick n'a pas cette règle. Si vous parlez français, cochez-le avant votre premier quart; un superadministrateur peut aussi le régler sur votre fiche de représentant.",
    ],
  },
  {
    id: "voicemail",
    title: "Messagerie vocale",
    body: [
      "Un entrepreneur qui appelle votre numéro quand personne ne peut décrocher patiente un moment pendant que le système cherche quelqu'un de libre, et laisse un message après. Messagerie, c'est là que vous l'écoutez : chaque message avec le numéro, l'heure, le nombre de secondes parlées, un lecteur, et le lead à ouvrir. Un message de zéro seconde est affiché exprès — c'est quelqu'un qui a rappelé, entendu le bip et raccroché, et ça vaut un rappel. La pastille sur l'onglet compte les messages laissés depuis le début de votre journée.",
    ],
  },
  {
    id: "pay",
    title: "Votre paie : un client, trois étapes, 125 $ CA",
    body: [
      "Tout ce que FieldQuo verse à un représentant est en dollars canadiens. Un client rapporte 125 $ CA, en trois étapes qui suivent le client à mesure qu'il fait ses preuves : 20 $ CA quand l'entreprise est Activée — Stripe l'a vérifiée et a activé les paiements, donc elle peut encaisser; 40 $ CA quand elle est Renouvelée — elle atteint son cycle de facturation suivant après le mois gratuit, que Stripe ait prélevé ou qu'un crédit de parrainage ait couvert; 65 $ CA quand elle Paie toujours — encore abonnée soixante jours après le jour de son inscription, essai compris. Le plan est une ligne sur votre fiche de représentant, donc un représentant embauché à d'autres conditions garde les siennes; et si vous partez, ce que vos entreprises continuent de rapporter reste à vous.",
      "Paie le montre : Gagné depuis le début, Versé, Clôturé pas encore versé, Cette semaine jusqu'ici; chaque entreprise que vous avez amenée avec l'étape qu'elle a atteinte; et les semaines, chacune avec sa date de versement une fois le paiement passé. Les semaines se ferment du lundi au lundi et le paiement règle la semaine d'avant. Rien sur l'écran ne se modifie — c'est le registre à partir duquel le versement est payé. En dessous, où FieldQuo envoie l'argent (Virement Interac pour un compte canadien, Wise pour un représentant hors du Canada, PayPal, ou un virement bancaire), puis la langue du portail, puis Langues dans lesquelles je peux vendre.",
    ],
  },
];

// ══ Chaque écran ══════════════════════════════════════════════════════════
//
// Une entrée par ligne des deux menus latéraux, indexée par le slug de
// docs/screens/app-guide/harness/screens.js. Le TITRE n'est pas ici : le
// générateur imprime le libellé du menu tel que app/i18n/appMessages.js le
// donne en français, pour que le titre du guide soit le mot à l'écran. La
// figure est une capture du vrai écran. Deux ou trois phrases chacune : ce
// que l'écran montre, ce que l'entrepreneur y fait. Rien ici que la figure
// ne montre pas.
export const SCREENS_CHAPTER = {
  heading: "Chaque écran, dans l'ordre du menu",
  intro: [
    "Le back-office, c'est un seul menu latéral. Ce chapitre le parcourt de haut en bas — Accueil, FieldQuo IA, puis les cinq groupes Travail, Personnel, Finances, Analyses et Croissance, puis Aide, Forfait et Paramètres — et parcourt ensuite le menu Paramètres de la même façon. Chaque entrée est le vrai écran, capturé depuis le compte d'un propriétaire connecté le jour où ce guide a été généré — et, quand l'écran a un bouton Nouveau ou Ajouter, une deuxième figure montre ce qui s'ouvre quand on appuie dessus (capturée en anglais).",
    "Servez-vous-en de deux façons. En démo, c'est l'itinéraire : ouvrez les écrans dans cet ordre et vous avez montré tout le produit en vingt minutes. En appel, c'est la réponse à « où est-ce que je fais X ? » — trouvez la ligne, lisez la phrase, dites les mots qui sont à l'écran.",
    "Un écran peut manquer dans le menu d'un client. Ce n'est pas une panne : le menu masque les lignes que le niveau d'accès de la personne connectée n'autorise pas (voir « Rôles et accès »), et Tarifs des armoires et Coût des matériaux n'apparaissent que pour les métiers qui tarifent ainsi.",
  ],
  railHeading: "Le menu principal",
  settingsHeading: "Le menu Paramètres",
  createCaption: "{title} — ce qui s'ouvre quand on appuie sur « {button} »",
  items: {
    // ── Accueil, IA ───────────────────────────────────────────────────────
    home: { body: [
      "« Tableau de bord » — ce qui se passe dans l'entreprise. Il s'ouvre sur « En attente de vous » : la facture en retard avec un bouton « Relancer le paiement », les soumissions dont le prix attend d'être approuvé, et le prochain rendez-vous que la réceptionniste a réservé. Puis « Revenus ce mois-ci » avec une courbe de l'argent reçu, et quatre tuiles — « Soumissions envoyées ce mois-ci », « Taux de conversion », « Argent dû », « Visites à venir ».",
      "« Le détail » en dessous : le graphique mensuel en barres (3, 6 ou 12 mois), l'échelle d'âge des comptes clients avec chaque facture due et son contact, la barre de rythme de l'objectif de revenus, « Soumissions récentes » et « Prochains rendez-vous ». Une nouvelle soumission, « Voir les clients » et « Planifier un rendez-vous » sont les trois boutons.",
    ] },
    ai: { body: [
      "« FieldQuo IA » — poser des questions sur ses propres soumissions, factures, clients et coûts de matériaux ; il cherche les vrais chiffres au lieu de deviner. Une conversation vide avec des suggestions « Essayez de demander » (quels clients n'ont pas encore été facturés, la valeur moyenne des soumissions du mois) et une boîte pour poser sa question.",
      "Il ne répond qu'à propos des données de cette entreprise et refuse les demandes générales — c'est l'argument honnête, et la raison pour laquelle on peut lui confier les chiffres d'un entrepreneur.",
    ] },
    // ── Travail ───────────────────────────────────────────────────────────
    requests: { body: [
      "« Prospects » — les demandes venues de la page de réservation et des formulaires. Un tableau à quatre colonnes — « Nouveau », « Contacté », « Gagné », « Perdu » — où les cartes se glissent d'une colonne à l'autre. Chaque carte porte un score chaud / tiède / froid, des puces de délai et de budget, la catégorie, le nombre de photos, le numéro de soumission lié et le responsable.",
      "Des filtres par température, un tri « Plus chauds », une recherche et un bouton « Importer ». C'est ici qu'atterrissent le formulaire du site, le lien de réservation, la réceptionniste et une recommandation.",
    ] },
    quotes: { body: [
      "« Soumissions » — des puces de statut avec leur compte (toutes, « Brouillon », « Envoyée », « Acceptée », « Refusée »), une recherche, et la liste : numéro, statut, client, montant, âge. Une soumission envoyée sans réponse remonte en tête avec sa date de validité ; une estimation instantanée porte « À réviser ».",
      "« Nouvelle soumission » ouvre l'éditeur. La soumission garde la langue dans laquelle elle a été créée ; le client la voit en page web et en PDF avec l'image de marque de l'entreprise.",
    ] },
    "estimate-reviews": { body: [
      "« Révision des estimations » — les estimations instantanées du site web arrivent ici d'abord ; on confirme le prix, en l'ajustant si la propriété l'exige, avant que la soumission puisse partir. Chaque carte nomme le client et la source (« Saisi par le client » ou « Tiré d'un appel téléphonique », avec un bouton « Écouter »), le responsable, la taille et le matériau, la fourchette que le client a vue et son budget déclaré, et le détail des lignes.",
      "Un bouton « Approuver » au montant proposé, et « Ouvrir la soumission ». Rien de ce qu'un algorithme a chiffré n'atteint un client sans qu'une personne appuie ici.",
    ] },
    jobs: { body: [
      "« Chantiers » — le travail planifié et en cours. Des puces « À planifier / Planifié / En cours / Terminé », un interrupteur « Archivés », une recherche, et la liste avec titre, badge de statut, client et nombre de visites.",
      "« Nouveau chantier » en crée un à la main ; la plupart naissent d'une soumission acceptée. « Travaux passés » importe l'historique d'un ancien système.",
    ] },
    invoices: { body: [
      "« Factures » — trois tuiles — « Impayé » (avec la part en retard), « Payée », « Total facturé » — puis la liste : numéro, statut (« Envoyée », « Payée », « En retard »), client, échéance, le nombre de jours de retard en rouge, et le solde ou « Payée en totalité ».",
      "« Nouvelle facture » en émet une ; une facture d'acompte se crée d'habitude depuis le calendrier de paiement de la soumission. Les factures reflètent les soumissions — mêmes sections, même image de marque — et se paient en ligne par le compte Stripe de l'entreprise.",
    ] },
    plans: { body: [
      "« Forfaits de service » — du travail récurrent vendu en forfait, facturé à la cadence choisie. Chaque forfait : nom, « Actif », client, cadence (« Une fois par an », « Tous les trois mois »), prix par visite, mode de perception, et soit le total du terme avec sa remise, soit « Jusqu’à annulation ».",
      "« Nouveau forfait » en vend un. Un forfait est une consigne permanente de créer une visite et une facture — c'est pourquoi la ligne suit Factures.",
    ] },
    calendar: { body: [
      "« Rendez-vous » — les visites en personne et les affectations sur site. Des puces « Planifié / Superviseur requis / Terminé » avec leur compte, une grille mensuelle (semaine du lundi, aujourd'hui entouré, les entrées sur leur jour), et en dessous les lignes : client, statut, un badge « Visite de chantier », heure, téléphone et adresse, responsable, « Ouvrir le contrat ».",
      "« Nouveau rendez-vous » en réserve un. Les visites créées depuis un chantier, les réservations de la page publique et les rappels réservés par la réceptionniste apparaissent tous ici.",
    ] },
    tasks: { body: [
      "« Tâches » — des rappels internes pour l'équipe, distincts des chantiers qui sont du travail planifié chez un client. Le compte des tâches ouvertes ; les en retard d'abord, puis par priorité ; chaque ligne avec une case, une puce de priorité, l'échéance, le responsable, le client et un lien vers son chantier ; une tâche qui exige des photos affiche le compte de photos.",
      "« Nouvelle tâche » en ajoute une ; « Afficher les terminées » révèle celles qui sont faites.",
    ] },
    chat: { body: [
      "« Clavardage » — l'entreprise qui se parle, sur le même kit de clavardage que Messages. Le salon général est toute l'équipe ; chaque chantier du calendrier a son propre salon pour l'équipe qui y est réservée et le bureau ; un message direct est entre deux personnes. Les salons se groupent en « Non lus », « Entreprise », chantiers, « Messages directs » et « Travaux terminés ».",
      "Dans un salon : le fil avec un séparateur des non-lus, les mentions @ qui avertissent la personne nommée, la liste des membres et le compositeur. « Nouveau message » ouvre un message direct avec n'importe qui de l'équipe.",
    ] },
    // ── Équipe ────────────────────────────────────────────────────────────
    clients: { body: [
      "Chaque client, en fiche : nom, courriel, téléphone, ville, et un pied de fiche qui compte ses soumissions et ses factures. Une entreprise affiche sa personne-ressource sous le nom de la compagnie.",
      "« Nouveau client » en ajoute un ; « Importer » charge un CSV depuis l'outil que l'entrepreneur utilisait avant. Ouvrir une fiche donne accès aux soumissions, chantiers, factures et équipements de ce client au même endroit.",
    ] },
    "client-equipment": { body: [
      "« Garanties qui se terminent » — les fournaises, panneaux et armoires que l'entreprise a installés et dont la couverture est terminée ou sur le point de l'être. C'est une liste d'appels, et la page le dit en toutes lettres.",
      "Un sélecteur de fenêtre (« 30 prochains jours » jusqu'à « 365 prochains jours ») et un décompte — hors garantie, bientôt terminée, sans date — puis une fiche par pièce avec un numéro à composer d'un tap et un bouton « Courriel », pour réserver une visite de renouvellement depuis la fiche.",
    ] },
    team: { body: [
      "« Gérer l'équipe » : d'abord le panneau des postes — 4 / 6 sièges utilisés, 3 / 11 équipiers inclus gratuitement, avec « Ajouter un équipier — gratuit » et « Ajouter un siège » — puis la liste avec le niveau d'accès de chacun en liste déroulante : Manager, Estimator, Dispatcher, Crew ou « Personnalisé… ».",
      "Changer la liste déroulante reclasse le palier et les permissions de la personne en une étape ; « Ajouter un utilisateur » invite quelqu'un ; une invitation en attente s'affiche « Invité » avec « Annuler l’invitation ». C'est l'écran dont parle le chapitre Rôles.",
    ] },
    subcontractors: { body: [
      "Les entreprises embauchées par chantier — l'électricien, le fabricant de comptoirs — avec le métier, le contact, et si leur assurance ou leur attestation est à jour, bientôt due ou expirée ; celles qui expirent remontent dans un panneau en haut pour que personne ne mette le pied sur le chantier sans couverture.",
      "Un sélecteur d'année « Payé en » totalise ce que chaque sous-traitant a reçu, et « Liste de fin d'année (CSV) » exporte la liste T5018.",
    ] },
    scheduler: { body: [
      "« Horaire » — la semaine de l'équipe en sept cartes-jours. « Ajouter un quart » place une personne sur un chantier avec des heures et une note (« Charger le camion, livrer les armoires ») ; les quarts restent en brouillon, invisibles pour l'équipe, jusqu'à « Publier la semaine ».",
      "L'écran du répartiteur : bâtir la semaine, déplacer, publier une fois.",
    ] },
    "team-schedule": { body: [
      "« Horaire de l'équipe » — tout le monde sur une page : une carte par personne avec son palier, une bande lundi–dimanche de disponibilités (« 08:00–17:00 », « — » les jours de congé), un bouton « Modifier les heures », et « 2 prochaines semaines » de ce qui est réservé, par client.",
      "Le propriétaire voit d'un coup d'œil qui est réservable quand, et corrige les heures de n'importe qui d'ici.",
    ] },
    clock: { body: [
      "« Pointeuse » — le pointage de la personne connectée : l'heure en direct, une pastille « En service », le temps écoulé depuis le pointage, le chantier en cours, et un bouton rouge « Pointer la sortie ». Un sélecteur de chantier bascule l'entrée en cours sur un autre chantier.",
      "En dessous, le bloc du jour totalise les heures de la journée et liste chaque entrée. C'est ce que l'équipe ouvre sur son téléphone ; le bureau révise le résultat dans Feuilles de temps.",
    ] },
    timesheets: { body: [
      "« Feuilles de temps » — une ligne par pointage : l'équipe d'aujourd'hui en cours avec une puce « sur place », les lignes de la semaine dernière avec les heures et un bouton « Approuver », les plus anciennes approuvées. Un pointage pris loin du chantier est signalé en ambre avec la distance.",
      "Un gestionnaire approuve les heures ici avant qu'elles n'entrent dans une paie ; « Ajouter une entrée » enregistre à la main un pointage oublié.",
    ] },
    "time-off": { body: [
      "« Congés » — des cartes de solde (Vacances, Jours de maladie, Journée personnelle) avec l'accumulé et le pris, la liste de vos demandes avec « Demander un congé », et un bouton pour retirer une demande en attente.",
      "L'onglet « Équipe », pour un gestionnaire, liste les demandes en attente avec « Approuver » et « Refuser », qui est en congé bientôt, et les soldes de tout le monde.",
    ] },
    safety: { body: [
      "« Sécurité » — blessures et quasi-accidents. Un bouton « Signaler », des filtres ouverts / révisés / fermés, et une fiche par incident avec son type (quasi-accident, dommage matériel), si le travail a été arrêté, où, qui l'a signalé et son statut.",
      "Chaque fiche a un volet « Suivi » où un gestionnaire fixe le statut et note ce qui a été fait. L'équipe peut signaler ; seuls les gestionnaires font le suivi.",
    ] },
    // ── Croissance ────────────────────────────────────────────────────────
    marketing: { body: [
      "« Marketing » — une carte par campagne avec son statut (active, brouillon), son type (distribution de dépliants, Meta / publicités payantes, envoi de courriels), sa progression (une tournée de dépliants affiche 26/40 arrêts et 9 rencontrés ; une publicité affiche son budget) et son responsable.",
      "« Nouvelle campagne » en démarre une ; « Abonnés » et « Dépenses marketing » sont à côté. Une campagne de dépliants se travaille arrêt par arrêt depuis le téléphone.",
    ] },
    "marketing-designer": { body: [
      "« Créateur marketing » — concevoir une publicité une fois et l'exporter dans tous les formats que demandent les réseaux sociaux (Instagram, TikTok, Facebook et YouTube) sans refaire la mise en page à la main.",
      "Les designs sont listés sous leur campagne avec approuvé / non approuvé, des puces pour les cinq formats (publication Instagram, story Instagram, TikTok, fil Facebook, vignette YouTube) et le nombre de formats prêts. « Créer une publication à partir d'un chantier » transforme les photos avant-après d'un chantier en publication ; « Nouveau visuel » ouvre une toile vide.",
    ] },
    funnels: { body: [
      "« Entonnoirs » — des entonnoirs de prospects pensés pour le mobile, en quelques taps, pour les publicités et le lien en bio ; chacun qualifie le visiteur et dépose un prospect noté dans le pipeline. Chaque ligne : nom, publié ou brouillon, son canal (Web, Instagram, TikTok, YouTube) et le nombre de prospects produits.",
      "« Nouvel entonnoir » ouvre le générateur IA (décrire l'entonnoir, « Générer ») et les modèles par canal ; une ligne ouvre l'éditeur et son rapport d'abandon.",
    ] },
    receptionist: { body: [
      "« Réceptionniste » — les appels que l'agent a pris pour vous, et ce qui en est sorti. Le journal de l'agent téléphonique IA, groupé en à traiter, en attente de vous et archivés, chaque appel avec le numéro, l'heure, la durée et le coût, le résumé, et ce qu'il a produit : enregistré comme prospect, visite réservée, un bouton pour écouter l'enregistrement, rédiger une soumission à partir de l'appel, planifier un rappel.",
      "Une ligne en haut compte les rendez-vous que les appels ont réservés. « Récupérer les appels manqués » et « Réglages du réceptionniste » sont les deux boutons.",
    ] },
    "crew-inbox": { body: [
      "« Boîte équipe » — les photos et nouvelles que l'équipe a envoyées par texto ; celles qui sont classées sont sur leurs chantiers. Le panneau vert « Textos de l'équipe » affiche le numéro que l'équipe texte, le solde de crédit et les tarifs (2 ¢ le texto, 5 ¢ la photo).",
      "Un bloc à traiter retient une photo que le système n'a pas pu classer, avec la question « pour quel chantier ? » et une puce par chantier candidat ; le bloc des classées liste le reste avec le chantier où elles ont atterri.",
    ] },
    messages: { body: [
      "« Messages » — les messages de la page Facebook et du compte Instagram professionnel, répondus ici. Les conversations à gauche, groupées entre celles qui attendent une réponse et celles où l'on attend le client, chacune avec le pictogramme du canal, le temps d'attente et une puce de température ; les puces de canal filtrent Tous / Facebook / Instagram / WhatsApp.",
      "La conversation ouverte est au centre avec « Répondre » et une « Note » privée ; le volet de droite tient les détails de la personne, le statut (ouvert, en attente, en veille, résolu), qui s'en occupe, et « Ouvrir le prospect ». « Bilan mensuel » est le bouton en haut à droite.",
    ] },
    refer: { body: [
      "Recommander une autre entreprise donne un autre mois de FieldQuo gratuit une fois qu'elle est cliente payante. Le lien de l'entreprise avec « Copier » — assez court pour le dire à voix haute, sur une carte d'affaires, un pied de facture ou un camion — un bouton de partage WhatsApp, et « Envoyer l'invitation » par courriel ou texto.",
      "En dessous, les mois gagnés, les entreprises recommandées (créditée ou pas encore payante) et les invitations envoyées.",
    ] },
    help: { body: [
      "« Centre d'aide » — des guides pas à pas pour tout dans FieldQuo : soumissions, chantiers, factures, encaissement, réservation, site web, équipe, et l'utilisation sur le téléphone. Une boîte de recherche, un bouton pour rejouer la visite guidée, et des articles groupés par sujet.",
      "Les articles s'ouvrent sur place. Envoyez-y l'entrepreneur avant qu'il n'appelle le soutien.",
    ] },
    plan: { body: [
      "« Compte et facturation » — le forfait, les sièges et les informations de paiement. La carte du forfait indique le nom du forfait, son statut, le prix mensuel, les sièges, les équipiers inclus gratuitement et la prochaine date de facturation, avec « Gérer la facturation et le mode de paiement », un lien vers ce que les clients ont payé et « Annuler le forfait ».",
      "Sous « Forfaits », un interrupteur « Mensuel » / « Engagement d'un an » et les quatre paliers — Solo, Crew, Shop, Scale — chacun avec ses sièges et ses accès équipe et « Choisir ce forfait » ; le forfait actuel indique « Forfait actuel ». Propriétaire et administrateurs seulement.",
    ] },
    // ── Finances ──────────────────────────────────────────────────────────
    payroll: { body: [
      "« Paie » — FieldQuo calcule ce que chaque personne doit recevoir à partir de ses heures approuvées et des taux enregistrés, et produit les fiches de paie ; l'entrepreneur paie par sa propre banque ou son fournisseur de paie — FieldQuo ne déplace pas l'argent. Dites cette dernière phrase à chaque appel : c'est la question qu'on vous pose.",
      "« Nouvelle période de paie » est pré-remplie avec la dernière période close du cycle de paie de l'entreprise (« Toutes les 2 semaines ») ; « Calculer » prévisualise le brut, les retenues et le net par personne, puis « Enregistrer comme brouillon ». « Périodes de paie » liste chaque période avec ses dates, l'effectif, le net total et son statut.",
    ] },
    expenses: { body: [
      "« Suivi des dépenses » — où va l'argent, par chantier, frais généraux et catégorie, plus le taux de dépense mensuel. Un sélecteur de mois au-dessus de quatre cartes : les dépenses suivies du mois, le taux de dépense mensuel (frais généraux + salaires + dettes), la marge de manœuvre et les dépenses liées aux chantiers.",
      "En dessous : une carte « Résumé IA », la répartition mensuelle et les dépenses par catégorie en barres, la tendance sur 6 mois, et les dépenses récentes avec chaque reçu étiqueté frais généraux ou lié à un chantier. « Ajouter une dépense », « Importer depuis un CSV bancaire », et une carte « Export comptable » qui télécharge une plage de dates en CSV pour le comptable.",
    ] },
    purchasing: { body: [
      "« Achats » — chez qui on achète, ce qui est en commande, et ce qu'il y a sur l'étagère. Trois onglets : « Commandes », « Stock », « Fournisseurs ». Commandes liste chaque bon de commande avec son fournisseur, combien de lignes sont reçues, son statut et son total ; « Nouvelle commande » en crée un.",
      "Ouvrir une commande permet d'enregistrer une livraison ligne par ligne ; le stock reçu atterrit dans l'onglet Stock, qui montre ce qui est sur l'étagère et signale tout ce qui passe sous son seuil de réapprovisionnement.",
    ] },
    fleet: { body: [
      "« Véhicules » — ce qui est dû, ce qui expire, et qui a le camion ; ce que chacun a coûté vit dans le registre des actifs. Un panneau « Échu ou à venir » d'abord — assurance, immatriculation, entretien par date ou par kilométrage — puis une carte par camion avec sa plaque, son modèle, son année et qui l'a.",
      "Une carte se déplie sur les quatre échéances, l'odomètre, le NIV, le coût et la valeur comptable, un bouton de modification, le journal « Entretien » et les « Documents ».",
    ] },
    // ── Analyses ──────────────────────────────────────────────────────────
    insights: { body: [
      "« Comment vous vous comparez » — le prix moyen des soumissions de l'entreprise contre la moyenne anonymisée de la plateforme, par catégorie de service. Une ligne par catégorie avec le nombre de soumissions dans la région ce trimestre, « Votre moyenne », « Moyenne de la plateforme » et l'écart en pourcentage. Sur adhésion, agrégats seulement — un concurrent ne voit jamais les prix d'une entreprise.",
      "Cette page est aussi le carrefour du reste du groupe : « Résumés hebdomadaires », « États financiers », « Gagnées et perdues », « Justesse des estimations » et « Tableau de bord des indicateurs clés » sont les liens sous le titre.",
    ] },
    kpis: { body: [
      "« Tableau de bord des indicateurs clés » — ventes, profit, exécution et trésorerie, au même endroit. Des boutons de période (ce mois-ci, le mois dernier, « Ce trimestre », depuis le début de l'année, l'an dernier), puis les sections : ventes (taux de conversion, valeur moyenne d'un chantier, prospects convertis en soumissions, carnet en semaines), flux d'argent (revenus, dépenses, reste, par jour), coûts d'exploitation, profit (marge brute et nette, coût de main-d'œuvre), exécution (livraison à temps, utilisation de la main-d'œuvre, justesse des estimations), qualité, trésorerie (comptes clients par âge, en retard) et clientèle.",
      "Une carte sans données dit pourquoi au lieu d'afficher un zéro, et une section finale « Non suivi » nomme les deux indicateurs que FieldQuo refuse d'inventer. Exige que les coûts de chantier soient activés pour la personne qui regarde.",
    ] },
    settings: { body: [
      "« Paramètres » ouvre le menu des paramètres et atterrit sur le Profil de l'entreprise. Le menu compte huit groupes — Compte, Entreprise, Équipe et horaires, Services et tarifs, Documents et modèles, Messagerie et alertes, Encaissement, Côté client — fermés par défaut pour se lire comme un index, le groupe où l'on se trouve étant ouvert.",
      "Chaque ligne est parcourue ci-dessous. Une boîte de recherche en haut du menu trouve une ligne en tapant son nom.",
    ] },
    // ── Paramètres : Compte ───────────────────────────────────────────────
    "settings-account-billing": { body: [
      "Le même écran que « Forfait » dans le menu principal, atteint depuis le menu Paramètres : la carte du forfait avec le statut, le prix, les sièges, les accès équipe et la prochaine date de facturation ; « Gérer la facturation et le mode de paiement », « Annuler le forfait » ; et les quatre forfaits avec « Choisir ce forfait ».",
      "Propriétaire et administrateurs seulement — un Manager ne voit pas cette ligne.",
    ] },
    "settings-refer": { body: [
      "La même page « Parrainage » que dans le menu principal : le lien de parrainage de l'entreprise, le partage et l'invitation, les mois gagnés et les entreprises recommandées.",
      "Un mois gratuit chacun, pour celui qui recommande et pour celui qui est recommandé, une fois que l'entreprise recommandée paie.",
    ] },
    "settings-migration": { body: [
      "« Migration de données » — le service payant où FieldQuo importe les anciennes données d'une entreprise. La carte de la demande montre ce qu'elle a dit apporter (QuickBooks, Jobber…), son statut (« Devis prêt »), le prix de FieldQuo avec sa note, et « Accepter » / « Refuser » ; en dessous, « Documents » avec « Téléverser un fichier » pour les exports.",
      "Le personnel de FieldQuo crée de nouveaux clients et de nouvelles soumissions dans le compte, ne touche jamais à ce qui existe déjà, et chaque écriture est journalisée. Le prix se paie par la facturation FieldQuo, pas par le Stripe de l'entrepreneur.",
    ] },
    "settings-product-updates": { body: [
      "« Nouveautés du produit » — un journal daté des changements, chaque entrée avec « Lire la nouveauté complète ». Rien à configurer ; c'est là qu'un entrepreneur voit ce qui a changé depuis le mois dernier.",
    ] },
    // ── Paramètres : Entreprise ───────────────────────────────────────────
    "settings-company": { body: [
      "« Profil de l'entreprise » — les coordonnées, les heures, les taxes et les préférences régionales. Les cartes de haut en bas : « Description des travaux et conditions » (le texte de procédé par défaut de chaque nouvelle soumission, et « Conditions de paiement »), « Échéancier de paiement » (50 % d'acompte à la réservation, 50 % à l'installation, « Enregistrer l'échéancier »), l'industrie et les types de soumission, les coordonnées avec l'adresse, « Heures d'ouverture », « Disponibilités pour la prise de rendez-vous » et « Paramètres de taxes » (TPS, TVQ, TPS + TVQ, « Créer un taux de taxe »).",
      "C'est le premier écran après l'inscription, et celui sur lequel atterrit la ligne Paramètres du menu.",
    ] },
    "settings-branding": { body: [
      "« Image de marque » — le logo et la couleur de marque apparaissent sur chaque soumission, facture et courriel que voient les clients. Une carte « Logo » avec « Téléverser un logo », « Couleurs de marque » avec « Principale » et « Secondaire », et un aperçu d'une soumission en mode clair et sombre.",
      "Une seule couleur pilote toutes les surfaces côté client ; le contraste est calculé, donc un jaune ou un gris moyen reste lisible à l'impression.",
    ] },
    "settings-language": { body: [
      "« Langue » — « Votre langue », une ligne par langue avec sa couverture de l'interface, sous une option « Suivre la valeur par défaut de l'entreprise » ; et une carte « Valeur par défaut de l'entreprise » en dessous.",
      "Le propriétaire choisit la langue dans laquelle il lit l'application ; la valeur par défaut de l'entreprise couvre les coéquipiers et les clients qui n'ont jamais choisi. Un document garde la langue dans laquelle il a été créé.",
    ] },
    "settings-activity": { body: [
      "« Journal d'activité » — la piste d'audit de l'entreprise : soumission créée, envoyée, relancée, acceptée ; facture envoyée et relancée ; chantier planifié ; membre invité ; tarifs mis à jour ; client ajouté — chacun avec qui l'a fait, son rôle et quand.",
      "Lecture seule, propriétaire et administrateurs seulement. C'est la réponse à « qui a changé ça ? ».",
    ] },
    // ── Paramètres : Équipe et horaires ───────────────────────────────────
    "settings-team": { body: [
      "Le même écran « Gérer l'équipe » que « Votre équipe » dans le menu principal : le panneau des sièges, la liste avec le niveau d'accès de chacun, « Ajouter un utilisateur », et les invitations en attente.",
      "Voir « Rôles et accès » pour ce que signifie chaque niveau de la liste déroulante.",
    ] },
    "settings-availability": { body: [
      "« Vos heures » — un sélecteur « Heures de qui », puis « Heures de travail » (le quart, pour les horaires et les feuilles de temps) et « Heures réservables » (la fenêtre qu'offre la page de rendez-vous publique), avec un « Enregistrer les heures » fixé au bas.",
      "Les deux sont volontairement séparées, et toutes deux par personne : les heures d'ouverture de l'entreprise vivent dans le Profil de l'entreprise, pour qu'un jour de congé d'estimateur ne soit jamais publié comme une fermeture de l'atelier.",
    ] },
    "settings-leave": { body: [
      "« Politiques de congés » — « Politiques » avec « Ajouter une politique » : par exemple des vacances à nombre de jours fixe par an avec report, et des congés de maladie approuvés automatiquement, chacune avec « Modifier » ; et une carte « Fin d'année » qui reporte les soldes de l'an dernier sur celui-ci.",
      "Propriétaire et administrateurs seulement ; les soldes s'affichent sur l'écran Congés de chaque personne.",
    ] },
    "settings-booking-page": { body: [
      "« Page de rendez-vous » — le code à intégrer au site (« Copier le code »), « Combien de temps dure une visite? » avec les modes de rencontre (chez le client, appel téléphonique), le tampon de déplacement, la fenêtre d'arrivée et la durée par défaut, les règles de changement et d'annulation (délai de préavis, remboursement des frais), puis une carte par type de rendez-vous — une consultation de design de 60 minutes gratuite, une visite de mesure de 45 minutes avec des frais et un prix promotionnel.",
      "« Nouveau type de rendez-vous » ajoute un type de rendez-vous qu'un client peut réserver lui-même.",
    ] },
    "settings-work-areas": { body: [
      "« Zones de travail » — des zones ou projets nommés (Laval, île de Montréal, Rive-Nord), chacun avec une puce par membre de l'équipe ; une puce pleine veut dire que la personne y est affectée. Un champ en haut en ajoute une.",
      "Sert à grouper chantiers et tâches par territoire ; l'affectation est réservée au propriétaire, aux administrateurs et aux superviseurs.",
    ] },
    // ── Paramètres : Services et tarifs ───────────────────────────────────
    "settings-products": { body: [
      "« Produits et services » — le catalogue de prix : un tableau avec nom, description et type (service ou produit), chaque article étiqueté des types de soumission où il peut apparaître, avec modification et suppression, une recherche, « Ajouter un article » et un import CSV.",
      "Une ligne de soumission se choisit ici, donc le prix que voit le client est celui que le propriétaire a fixé.",
    ] },
    "settings-services": { body: [
      "« Services et tarifs » — une carte par type de soumission avec une case marche/arrêt : les types propres à l'entreprise (personnalisés) avec leurs champs d'admission et leurs tarifs à l'unité, et ceux du métier fournis d'office (le refinissage d'armoires, tarifé à la porte ou à la façade de tiroir, avec l'option d'un prix instantané pour les clients et une carte de tarifs repliable). « Ce que dit la soumission » sous chacun est le texte que le client lit.",
      "« Ajouter un type de soumission personnalisé » et l'affichage des services des autres métiers sont les deux boutons. Les tarifs ne quittent jamais cet écran — les points d'accès publics renvoient les services et les champs, pas les prix.",
    ] },
    "settings-material-costs": { body: [
      "« Coût des matériaux » — quand demander une révision du coûtage (un seuil, « Enregistrer »), puis une recette par service (le refinissage d'armoires, marqué personnalisé avec « Rétablir les valeurs par défaut ») : apprêt et couches de finition, couverture, prix au gallon, durcisseur, heures de préparation et consommables.",
      "Ces valeurs alimentent l'estimation interne de coût et de marge d'une soumission ; elles ne sont jamais montrées au client. Affiché seulement pour les métiers qui tarifent ainsi.",
    ] },
    "settings-cabinet-rates": { body: [
      "« Tarification des armoires » — « Comment vous tarifez une armoire » (« Par pied linéaire » ou « Coût majoré du matériau »), « Tarifs par pied linéaire » (base, haut, garde-manger, îlot, supplément tiroir, aménagement de placard, vanité, et si l'installation est comprise), puis « Multiplicateurs de matériau ».",
      "Le concepteur de cuisine tarife à partir de ces valeurs côté serveur. Affiché seulement pour les métiers de l'armoire.",
    ] },
    "settings-overhead": { body: [
      "« Frais généraux » — « Votre prix minimum » : chantiers par semaine, et des tuiles pour les coûts fixes mensuels, les chantiers par mois, le coût par chantier et le prix minimum qu'un chantier doit rapporter pour couvrir l'atelier ; les heures payées qui n'ont jamais atteint un chantier (main-d'œuvre non absorbée par travailleur) ; puis les registres — « Coûts fixes », « Salaires », « Dette », actifs et amortissement, et « Factures à payer » avec l'en cours, ce qui sort ce mois-ci et le retard.",
      "Le chiffre qu'un entrepreneur veut le plus et a le moins souvent. Exige les coûts de chantier.",
    ] },
    "settings-custom-fields": { body: [
      "« Champs personnalisés » — des champs définis par type de dossier (des champs de soumission comme le style de porte, le fini, le fini de la quincaillerie, avec leur type et leur caractère obligatoire).",
      "La page elle-même dit « À venir » pour leur affichage sur les dossiers : les champs se définissent ici mais n'apparaissent pas encore sur une soumission. Ne promettez pas qu'ils le font.",
    ] },
    // ── Paramètres : Documents et modèles ─────────────────────────────────
    "settings-quote-email": { body: [
      "« Courriel de soumission » — ce que contient le courriel qui porte les soumissions, au-delà de la soumission elle-même. Une carte liste ce que le courriel porte toujours, puis « Références » — d'anciens clients qui ont accepté de prendre un appel, avec l'option de les inclure sur chaque nouvelle soumission — et une section de photos avant-après.",
      "L'entrepreneur ajoute des noms et des numéros, téléverse des paires de photos et choisit ce qui part. Le courriel lui-même est envoyé dans la langue de la soumission, au nom de l'entreprise.",
    ] },
    "settings-email-templates": { body: [
      "« Modèles de courriel » — personnaliser les courriels que reçoivent les clients. Groupés en automatisés, marketing et personnalisés, une ligne par modèle avec un badge actif, un bouton pour le rendre actif, modifier, dupliquer et supprimer ; « Nouveau modèle » et « Ajouter les modèles par défaut » pour partir d'un jeu de départ.",
    ] },
    "settings-pdf-templates": { body: [
      "« Modèles PDF » — la mise en page des PDF de soumission et de facture que reçoivent les clients. Deux cartes, PDF de soumission et PDF de facture, chacune listant ses mises en page avec le nombre de sections et un badge actif ; un bouton crée une autre mise en page à modifier.",
      "Les factures reflètent les soumissions à dessein : les mêmes sections, dans le même ordre, pour que le client reconnaisse le second document comme le jumeau du premier.",
    ] },
    "settings-translations": { body: [
      "« Traductions » — le libellé que voient les clients sur les soumissions et factures rédigées dans une autre langue. Un sélecteur de langue, un compteur de ce qui manque encore, et par service des colonnes anglais / français avec « Marquer comme révisé » ; « Rédiger les ébauches manquantes » comble les trous avec des ébauches IA qu'une personne révise.",
      "C'est ainsi qu'un atelier québécois soumissionne en français et en anglais à partir d'un seul catalogue de prix. Rien n'est traduit automatiquement au moment de l'envoi.",
    ] },
    "settings-checklists": { body: [
      "« Listes de vérification » — les étapes standard que l'équipe suit sur place. Les listes propres à l'entreprise avec leur badge de phase (sur le chantier / avant de partir), le nombre d'étapes et le service, avec modification ; des listes de départ par métier avec « Utiliser celle-ci ».",
    ] },
    "settings-job-photo-tags": { body: [
      "« Étiquettes des photos de chantier » — les propres mots de l'entreprise pour dire ce qui se passe sur une photo. Une liste ordonnée d'étiquettes avec pastilles de couleur, monter / descendre et « Retirer », un formulaire « Ajouter une étiquette » avec un sélecteur de couleur, et un bloc d'étiquettes de départ.",
      "L'équipe choisit une étiquette en textant une photo ; c'est par cette étiquette que le bureau filtre ensuite.",
    ] },
    // ── Paramètres : Messagerie et alertes ────────────────────────────────
    "settings-messages": { body: [
      "« Messages aux clients » — les textos que reçoivent les clients. Un éditeur par type de texto — en route, rappel de rendez-vous — avec des jetons, un aperçu de ce que voit le client, « Enregistrer » et « Utiliser le texte par défaut ».",
      "Deux types de textos et pas plus ; ne promettez pas d'autres textos automatiques depuis cet écran.",
    ] },
    "settings-follow-ups": { body: [
      "« Relances » — envoyer automatiquement un modèle un certain temps après qu'une soumission, une facture ou un chantier atteint un état donné. Un schéma en lecture seule du fonctionnement (déclencheur → attente → envoi du courriel → arrêt) tiré des règles en dessous, où chaque règle a « Mettre en pause » et supprimer ; « Nouvelle règle » ouvre le formulaire déclencheur / délai / modèle.",
      "Une soumission sans réponse après trois jours, une facture en retard de sept jours : les deux règles que chaque atelier devrait activer.",
    ] },
    "settings-notifications": { body: [
      "« Notifications » — quand FieldQuo doit envoyer un courriel au propriétaire à propos de ce qui se passe dans le compte. Des cartes pour une grosse soumission créée (avec le seuil), une facture payée, les rappels de rendez-vous (désactivés, ou 2 / 24 / 48 heures avant) et les notifications du navigateur.",
      "Propriétaire et administrateurs seulement.",
    ] },
    "settings-email-domain": { body: [
      "« Domaine d'envoi » — envoyer les courriels aux clients depuis le domaine de l'entreprise plutôt que le nôtre. Le domaine avec son statut « Vérifié » et « Déconnecter », l'éditeur d'« Adresse d'expéditeur » (soumissions@…), et où vont les réponses.",
      "C'est la promesse de marque blanche rendue littérale : la boîte de réception du client montre le domaine de l'entrepreneur dans l'expéditeur, pas celui de FieldQuo.",
    ] },
    // ── Paramètres : Encaissement ─────────────────────────────────────────
    "settings-payments": { body: [
      "« Paiements » — connecter Stripe pour que les clients paient les factures en ligne, directement dans le compte bancaire de l'entreprise. Stripe connecté et actif avec « Gérer dans Stripe » et « Déconnecter », puis le compte : son identifiant avec copie, le courriel de connexion, ce que Stripe a activé (encaissements, virements) et ce qu'il attend encore.",
      "Stripe Connect, au nom de l'entrepreneur : l'argent va dans sa banque, et FieldQuo ne le détient jamais. Propriétaire et administrateurs seulement.",
    ] },
    "settings-meta-ads": { body: [
      "« Publicités Meta » — le compte publicitaire connecté avec « Synchroniser maintenant », « Déconnecter » et un lien vers les campagnes ; les formulaires de prospects Facebook avec un interrupteur par formulaire, le nombre de prospects et les campagnes ; la publication Facebook et Instagram et la carte WhatsApp Business avec son numéro et ses modèles.",
      "Une seule connexion alimente trois choses : les dépenses publicitaires dans les indicateurs, les formulaires dans Prospects, et les messages de la page, d'Instagram et de WhatsApp dans Messages.",
    ] },
    "settings-expense-tracking": { body: [
      "Le même écran « Suivi des dépenses » que « Dépenses » dans le menu principal : les cartes du mois, la répartition, la tendance, les reçus récents et l'export comptable.",
    ] },
    "settings-ai-credit": { body: [
      "« Crédit IA » — tout ce qui dépense du crédit IA, au même endroit. Le solde de crédit téléphonique avec « Ajouter du crédit téléphonique » et où le crédit est allé ; le solde de crédit d'images IA avec des recharges ; et la carte du plan de crédit IA mensuel.",
      "Les minutes téléphoniques et les images IA sont mesurées contre du crédit que l'entreprise achète ; FieldQuo IA et le copilote sont inclus dans tous les forfaits.",
    ] },
    "settings-payroll": { body: [
      "« Paramètres de paie » — « Quand vous payez » (fréquence, jour de clôture de la période, jour de paie, période courante et précédente), puis les composantes de retenues et de gains : tranches d'impôt statutaires, pourcentages et allocations fixes, chacune avec désactivation et suppression, plus des modèles statutaires régionaux pour démarrer.",
      "Propriétaire et administrateurs seulement ; c'est à partir de ceci que Paie calcule.",
    ] },
    // ── Paramètres : Côté client ──────────────────────────────────────────
    "settings-website": { body: [
      "« Votre site web » — l'éditeur : l'adresse du site avec un badge « En ligne », « Ouvrir », « Enregistrer » et « Mettre à jour » ; un volet de conversation où l'entrepreneur tape une consigne (plus audacieux, commencer par les avis, page plus courte), des sélecteurs de mise en page et de style, « Ajuster », et un volet aperçu / sections avec bascule bureau et mobile.",
      "Le modèle n'écrit que des phrases ; la mise en page, les services et les témoignages viennent des données de l'entreprise, donc un site n'est jamais inventé. Les sites gratuits portent un petit pied de page « Site par FieldQuo ».",
    ] },
    "settings-instant-quotes": { body: [
      "« Soumissions instantanées » — laisser les propriétaires obtenir une vraie estimation de départ depuis le site web en quelques secondes. Un compte de ce qui est en ligne avec « Voir ce que voient les propriétaires », un code à intégrer avec « Copier le code », puis une carte par métier avec un interrupteur, le choix de ce que voit le propriétaire, et les champs de tarifs.",
      "Chaque estimation instantanée atterrit dans Révision des estimations avant de pouvoir être envoyée ; la page publique ne montre jamais la carte de tarifs.",
    ] },
    "settings-lead-form": { body: [
      "« Partager vos liens » — à mettre partout où l'entreprise est déjà. Des cartes pour demander une soumission, réserver une visite, l'estimation instantanée et chaque entonnoir publié, chacune avec le lien, « Copier le lien », « Ouvrir » et un code à intégrer.",
    ] },
    "settings-bio-link": { body: [
      "« Lien de profil » — une page pour le seul lien qu'Instagram et TikTok permettent. « Votre lien » avec copier / ouvrir et l'état en ligne, un titre et une ligne dessous, les identifiants à suivre, les interrupteurs de liens ordonnés, et un « Aperçu » dans un cadre de téléphone avec bascule clair / sombre et « Enregistrer ».",
    ] },
    "settings-voice": { body: [
      "« Réceptionniste téléphonique » — répond aux appels manqués, prend les coordonnées et réserve des visites contre les vraies disponibilités. Le numéro avec son état de réponse ; le crédit (solde, minutes, recharges, recharge automatique) ; « Votre numéro » ; les cartes d'accueil, de connaissances, de voix et de réglage fin ; les rappels de soumission ; l'interrupteur de la boîte équipe ; et « Vérifier de bout en bout ».",
      "Un numéro local dans la région de l'entrepreneur, qui répond dans la langue de l'appelant et réserve dans le calendrier que voit le bureau. Le journal des appels est l'écran Réceptionniste du menu principal.",
    ] },
    "settings-ai-employee": { body: [
      "« Employé IA » — un assistant qui répond aux messages des clients pour l'entreprise. « Quel poste occupe-t-il ? » (closer, réceptionniste, soutien technique, ou autre, avec ce qu'il peut et ne peut pas faire), « Comment il écrit » (nom, ton, phrase d'ouverture, consignes), la matière qu'il lit, et les brouillons en attente de révision.",
      "Il rédige ; une personne envoie. Les brouillons apparaissent dans Messages.",
    ] },
    "settings-reviews": { body: [
      "« Avis » — demander automatiquement un avis aux clients une fois le chantier terminé. « Votre lien d'avis » avec enregistrement, un interrupteur « Demander automatiquement », des puces « Quand demander » pour le délai, un résumé de la file, et « Avis sur votre site web » qui liste les témoignages avec des interrupteurs afficher / masquer et un import par collage.",
    ] },
  },
};

// ══ Rôles et accès ════════════════════════════════════════════════════════
//
// Les cinq personnes qu'un entrepreneur peut créer, et ce que chacune voit.
// Les deux tableaux de ce chapitre ne sont PAS écrits ici — le générateur
// exécute lib/permissions/nav.js et lib/permissions/settingsAccess.js contre
// la vraie grille de chaque préréglage, le code même qui masque une ligne du
// menu à cette personne.
export const ROLES_CHAPTER = {
  heading: "Rôles et accès — qui voit quoi",
  intro: [
    "L'entrepreneur ajoute une personne depuis Gérer l'équipe et choisit un niveau d'accès parmi cinq : Crew, Estimator, Dispatcher, Manager, ou son propre niveau de propriétaire. Les quatre premiers sont des préréglages — une grille remplie de onze domaines de permission et trois interrupteurs — et le propriétaire peut ensuite modifier n'importe quel réglage, ce qui transforme le préréglage en « Personnalisé ». Les tableaux ci-dessous sont calculés à partir du code de permissions du produit lui-même, le jour où ce guide a été généré ; ils disent donc ce que le menu fait réellement.",
    "Deux choses à bien dire en appel. D'abord, un accès Crew n'est pas un poste : une personne dont l'accès est au niveau Crew ou en dessous ne coûte rien et ne compte pas dans les postes complets du forfait — c'est le sens de la colonne « accès équipe » du tableau des forfaits. Estimator, Dispatcher, Manager et le propriétaire sont des postes complets. Ensuite, masquer une ligne n'est pas la sécurité : chaque API du produit revérifie la même grille côté serveur, et une personne qui tape une adresse qu'on ne lui a pas montrée reçoit un refus, pas la page.",
    "Il y a un sixième choix dans la liste, « Nommer administrateur », qui donne tout ce que le propriétaire a, sauf la propriété elle-même. Il existe pour un associé ou un comptable qui doit voir la facturation. Ne le proposez pas pour le personnel.",
  ],
  tierNote: "palier {tier}",
  productSays: "La description du produit lui-même :",
  roles: [
    {
      key: "worker",
      body: [
        "La personne dans le camion. Elle voit son propre horaire et le marque terminé, pointe ses heures, note ses propres dépenses et son temps, signale un incident de sécurité et lit les notes des chantiers qui lui sont assignés — nom et adresse du client, rien de plus. Aucun prix nulle part, pas de soumissions, pas de factures, pas de demandes. Les chantiers sont en lecture seule, et seulement ceux où elle est assignée.",
        "C'est le niveau des installateurs et des aides. Il est gratuit, et c'est ce qui permet à l'équipe d'utiliser le même produit que le bureau sans que le bureau s'inquiète de ce que l'équipe peut voir.",
      ],
    },
    {
      key: "estimator",
      body: [
        "Rédige des soumissions et gère les clients, avec les prix. Il peut créer et modifier des demandes et des soumissions, voir et modifier les fiches clients complètes, lire toutes les notes, et voir (sans modifier) les chantiers et les factures. Son propre horaire, son temps et ses dépenses seulement. Pas de gestion du personnel, pas de paie au-delà de ses propres fiches, pas de coûts de chantier.",
        "Pour un vendeur ou un deuxième estimateur qui doit pouvoir chiffrer et envoyer, sans diriger l'atelier.",
      ],
    },
    {
      key: "dispatcher",
      body: [
        "Gère l'horaire. L'horaire de tout le monde est modifiable, le temps de tout le monde aussi, et les chantiers, soumissions, factures et demandes peuvent être créés et modifiés — mais pas supprimés. Fiches clients complètes, toutes les notes, les incidents de sécurité de tout le monde. Toujours ses propres dépenses seulement, toujours pas de coûts de chantier ni d'encaissement.",
        "Le chef d'équipe qui réserve les gars, déplace les visites et tient la semaine à jour, sans le pouvoir de rien effacer.",
      ],
    },
    {
      key: "manager",
      body: [
        "Gère le quotidien, suppression comprise : soumissions, chantiers, factures, demandes et clients peuvent tous être créés, modifiés et supprimés ; l'horaire, le temps et les dépenses de tout le monde ; coûts de chantier activés ; encaissement activé. Ce qu'un Manager n'a pas, c'est la paie (ses propres fiches seulement) et la facturation de l'entreprise — le forfait, la carte, l'abonnement — qui restent au propriétaire.",
        "C'est le gérant de bureau ou l'associé qui dirige les opérations. Si un entrepreneur demande « je peux donner tout sauf l'argent à quelqu'un ? », c'est la réponse.",
      ],
    },
    {
      key: "owner",
      body: [
        "Tout, sans grille à consulter : la personne qui a inscrit l'entreprise. Seul un propriétaire ou un administrateur peut ouvrir Compte et facturation, Migration de données, Parrainage, Journal d'activité, Notifications, Politiques de congés, Paiements et Publicités Meta, lancer la paie, changer l'accès d'une personne existante ou la désactiver. (Un Manager ou un Dispatcher peut inviter des gens, mais seulement au palier Worker — Crew ou Estimator — et seulement avec des réglages qui ne dépassent pas les siens.) Le propriétaire est toujours un poste complet.",
      ],
    },
  ],
  seesHeading: "Ce que chaque niveau voit dans le menu",
  seesIntro: [
    "Un Oui en vert veut dire que la ligne est dans le menu de cette personne ; un Non en rouge veut dire qu'elle est masquée et que la page derrière la refuse. Calculé en passant chaque préréglage dans le filtre même du menu. Les lignes des Paramètres sont filtrées deux fois — par la règle du menu principal quand la ligne s'y trouve aussi, et par celle du menu Paramètres — et les deux doivent passer.",
  ],
  screenCol: "Écran",
  gridHeading: "La grille de permissions derrière chaque préréglage",
  gridIntro: [
    "Les onze domaines et les trois interrupteurs qu'un propriétaire voit dans l'éditeur d'accès personnalisé, avec le niveau que chaque préréglage inscrit. Les mots sont ceux du produit, en anglais à l'écran quelle que soit la langue.",
  ],
  areaCol: "Domaine",
  toggleNames: {
    showPricing: "Voir les prix (showPricing)",
    jobCosting: "Coûts de chantier",
    payments: "Encaisser des paiements",
  },
  yes: "Oui",
  no: "Non",
  editorHeading: "L'éditeur d'accès personnalisé",
  editorBody: [
    "Dans Gérer l'équipe, chaque personne a une liste déroulante avec les mêmes cinq choix que l'écran d'invitation — Crew, Estimator, Dispatcher, Manager, Administrateur — plus « Personnalisé », qui ouvre la grille. Choisir un préréglage applique son palier et ses permissions d'un coup. Personnalisé affiche les onze domaines en listes déroulantes et les trois interrupteurs en cases à cocher, en partant de ce que la personne a maintenant, et une puce « Palier Worker » / « Palier Manager » sur chaque préréglage dit quel palier il produit (Dispatcher et Manager partagent le palier Manager ; Crew et Estimator partagent le palier Worker).",
    "On ne peut donner que ce qu'on détient : quand un Manager invite quelqu'un, le serveur ramène chaque réglage au niveau du Manager et retire tout interrupteur qu'il n'a pas. Changer l'accès d'une personne existante, nommer un administrateur et révoquer un accès sont réservés au propriétaire et aux administrateurs.",
  ],
  editorCaption: "Gérer l'équipe — l'éditeur d'accès personnalisé ouvert sur un Estimator.",
};
