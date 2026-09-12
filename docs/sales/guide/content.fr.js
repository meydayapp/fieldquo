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
