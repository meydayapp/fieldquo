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
  intro: {
    heading: "Comment se servir de ce document",
    body: [
      "C'est la référence derrière le script. Le guide d'appel vous dit quoi dire; celui-ci vous dit ce qui est vrai, pour que la question à laquelle vous ne vous attendiez pas trouve une réponse plutôt qu'une supposition.",
      "Chaque fonction listée ici vient de la matrice des fonctions du produit, qui nomme les fichiers qui doivent exister pour chacune d'elles. Si une fonction est dans ce document, elle est dans le produit. Si quelque chose ne s'y trouve pas, ne le promettez pas.",
      "La section la plus importante est la dernière. Dix fonctions sont marquées PARTIEL, et chacune porte la phrase exacte qui dit ce qu'elle ne fait pas. Lisez-les avant votre premier appel. L'entrepreneur qui achète sur une promesse que vous ne pouvez pas tenir annule au deuxième mois — et il dit à tout le monde pourquoi.",
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
  referenceHeading: "Toutes les fonctions, par partie de l'entreprise",
  referenceIntro:
    "Tout, regroupé. L'étiquette PARTIEL signale une fonction qui a des limites — la formulation exacte est dans la dernière section.",
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
    { term: "Boîte de réception équipe", def: "Les textos avec les gars qui n'ont pas d'accès et qui n'installeront pas d'application. Ils textent un numéro; ça arrive au bureau, classé à leur nom.", key: "crew_inbox" },
    { term: "Carnet de prix", def: "Les taux de l'entrepreneur pour la main-d'œuvre, les matériaux et les services. Tout ce qui est chiffré dans FieldQuo vient de là.", key: "price_book" },
    { term: "Coût de revient du chantier", def: "Le soumissionné comparé au réel, une fois les travaux finis — pour que les prix de l'an prochain soient bâtis sur ce qui s'est vraiment passé.", key: "job_costing" },
    { term: "Estimation instantanée", def: "Un prix que le propriétaire produit lui-même sur le site web de l'entrepreneur, à partir des taux de l'entrepreneur. Jamais des nôtres.", key: "instant_quotes" },
    { term: "Lecture IA approfondie", def: "La lecture de photos payante. À distinguer de la révision gratuite, qui regarde aussi les photos mais ne facture rien." },
    { term: "Marque blanche", def: "Chaque document que le propriétaire voit porte le nom et les couleurs de l'entrepreneur, pas les nôtres. C'est le comportement par défaut, pas une option payante.", key: "white_label" },
    { term: "Métré", def: "Le formulaire propre au métier qui transforme des mesures en soumission chiffrée — des carrés de toiture, des pieds linéaires de gouttière, des portes et des tiroirs.", key: "quotes" },
    { term: "Poste", def: "Quelqu'un qui crée et modifie des soumissions, des chantiers et des factures. Les postes sont la seule chose qui distingue les forfaits.", key: "team_access" },
    { term: "Seuil de rentabilité", def: "Le prix sous lequel un chantier fait perdre de l'argent à l'entrepreneur, calculé à partir de ses propres frais généraux et de sa propre main-d'œuvre plutôt qu'avec une règle du pouce.", key: "break_even" },
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
      "Il y a aussi un Marketing Designer pour les visuels de publicité et de réseaux sociaux — voyez la section sur ce qu'on livre et qu'on n'annonce pas.",
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
      "Vérifiez dans la section des limites quelles langues sont vraiment terminées — c'est l'entrée la plus susceptible d'être périmée, et la réponse honnête vaut mieux que la réponse assurée.",
    ],
  },
];
