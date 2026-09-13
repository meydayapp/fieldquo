// content/help/fr/getting-started-1.js
//
// Partie 1 de la catégorie « getting-started » en français (voir le
// composeur, getting-started.js). Même structure que l'anglais — mêmes slugs,
// mêmes sections, mêmes blocs, mêmes figures — écrite pour l'entrepreneur
// québécois. Les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js; les libellés que l'application n'a pas traduits
// (le formulaire d'inscription, la première carte de configuration) sont
// cités tels qu'ils s'affichent.
export const ARTICLES = {
  "what-fieldquo-is": {
    title: "Ce qu'est FieldQuo, et la chaîne qu'il fait tourner",
    summary:
      "FieldQuo suit une seule chaîne — prospect, soumission, chantier, facture, paiement — et chaque document que votre client voit porte votre nom, pas le nôtre.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo est le bureau d'un entrepreneur de services à domicile : peintre, ébéniste, poseur de plancher, plombier, paysagiste. Il existe pour que vous puissiez décrocher un contrat, faire le travail et être payé sans changer d'outil — et pour qu'un propriétaire qui compare trois entrepreneurs ne puisse pas deviner lesquels utilisent le même logiciel.",
      "Cet article est la carte. Il nomme la chaîne, les deux faces du produit, la promesse au sujet de votre nom, et par où commencer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Tout dans FieldQuo est une étape sur une même ligne : un **prospect** devient une **soumission**, une soumission approuvée devient un **chantier**, un chantier terminé est facturé sur une **facture**, et la facture est payée en ligne par votre propre compte Stripe. Autour de cette ligne se trouve ce dont un atelier a besoin pour la faire tourner : l'horaire, le temps des équipes, les matériaux, les dépenses, le coût de revient, votre site web, votre page de rendez-vous, vos avis." },
          { p: "Le menu suit le même ordre. Sous **Travail**, vous trouverez **Prospects**, **Soumissions**, **Chantiers** et **Factures**, dans cet ordre, parce que c'est l'ordre dans lequel l'argent circule." },
        ],
      },
      {
        id: "the-pipeline",
        heading: "La chaîne, étape par étape",
        blocks: [
          { bullets: [
            "**Prospect** — une demande venue du formulaire de votre site, de votre lien de rendez-vous, d'une estimation instantanée, de la réceptionniste téléphonique ou d'une recommandation. Elle arrive sur le tableau des prospects, cotée Chaud, Tiède ou Froid.",
            "**Soumission** — bâtie à partir de votre liste de prix, dans la langue où elle a été créée, relue par l'IA si vous le demandez, et envoyée comme page et comme PDF avec votre logo. Le client l'approuve et la signe en ligne.",
            "**Chantier** — créé quand la soumission est approuvée. Les visites vont au calendrier, l'équipe pointe, les photos et les listes de vérification reviennent du terrain.",
            "**Facture** — le miroir de la soumission : mêmes sections, même image de marque. Un acompte peut être facturé d'abord si votre échéancier le prévoit.",
            "**Paiement** — le client paie par carte ou, au Canada, par débit bancaire, directement dans votre compte. FieldQuo ne garde jamais l'argent.",
          ] },
          { p: "Chaque étape a sa propre catégorie dans ce centre d'aide : [[the-leads-board|Prospects]], [[build-a-quote|Soumissions]], [[the-jobs-list|Chantiers]], [[create-an-invoice|Factures]] et [[how-clients-pay-online|Paiements]]." },
        ],
      },
      {
        id: "two-surfaces",
        heading: "Deux faces : votre bureau, et ce que vos clients voient",
        blocks: [
          { p: "Votre équipe travaille dans le **bureau** — les écrans derrière le menu, où le personnel passe la journée. Vos clients n'y ouvrent jamais de session. Ils voient un second jeu de pages : la page d'approbation de la soumission, la facture et son bouton de paiement, la page de rendez-vous, le portail client, votre site web, les courriels et les textos. Ces pages sont faites pour un inconnu sur un téléphone, avec une mauvaise connexion, dans une entrée de garage." },
          { figure: "live:app", caption: "Accueil — le tableau de bord, avec les cinq groupes du menu à gauche." },
          { p: "La catégorie [[nothing-says-fieldquo|Ce que vos clients voient]] parcourt chaque page côté client exactement comme le client la reçoit." },
        ],
      },
      {
        id: "your-name-not-ours",
        heading: "Tout porte votre nom",
        blocks: [
          { p: "Votre logo, votre couleur de marque et le nom de votre entreprise vont sur chaque soumission, facture, PDF, courriel, page de rendez-vous et page de site web. Une fois votre domaine vérifié, la ligne « De » dans la boîte de réception de votre client est votre adresse, pas la nôtre. Cela se règle une fois, sur [[set-up-your-branding|Image de marque]] et [[send-from-your-own-domain|Domaine d'envoi]]." },
          { note: "Il y a une exception voulue : une petite mention **Site by FieldQuo** au pied d'un site web dont l'entreprise n'est pas sur un forfait payant. Le site d'une entreprise qui paie ne mentionne FieldQuo nulle part." },
        ],
      },
      {
        id: "what-it-does-not-do",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "Il ne garde pas votre argent. Les paiements des clients sont des transactions Stripe au nom de votre entreprise, versées dans votre compte — voir [[payment-processing-fees-and-payouts|frais et versements]].",
            "Il n'a pas d'API publique ni de connecteur Zapier — voir [[no-public-api-or-zapier|Intégrations]].",
            "FieldQuo IA répond aux questions sur vos propres soumissions, factures, clients et coûts. Il refuse les demandes générales et ne voit jamais les données d'une autre entreprise.",
          ] },
        ],
      },
      {
        id: "where-to-start",
        heading: "Par où commencer",
        blocks: [
          { bullets: [
            "[[start-your-free-trial|Commencer votre essai gratuit]] — les quatre étapes d'inscription et à quoi sert la carte.",
            "[[your-first-day-setup-checklist|Votre première journée]] — la liste que le tableau de bord affiche tant qu'elle n'est pas terminée.",
            "[[the-sidebar-and-where-everything-is|Le menu]] — où se trouve chaque écran.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo est-il pour une personne seule ou pour une équipe?", a: "Les deux. Le forfait Solo comprend un siège et cinq accès équipe gratuits; Scale, dix sièges et quinze accès équipe. Les accès équipe ne coûtent rien." },
      { q: "Mes clients ont-ils besoin d'un compte?", a: "Non. Une soumission, une facture, un rendez-vous et le portail s'ouvrent tous à partir d'un lien. Personne du côté du client ne s'inscrit à quoi que ce soit." },
      { q: "Mes clients verront-ils le nom FieldQuo quelque part?", a: "Pas sur une soumission, une facture, un courriel ni une page de rendez-vous. Le seul endroit où il apparaît est le pied d'un site web dont l'entreprise n'est pas sur un forfait payant." },
    ],
  },

  "start-your-free-trial": {
    title: "Commencer votre essai gratuit",
    summary:
      "Quatre étapes sur le formulaire d'inscription public, une carte au paiement, et rien de facturé le premier mois.",
    updated: "2026-09-12",
    intro: [
      "L'inscription d'une entreprise se fait en libre-service : n'importe qui peut ouvrir la page d'inscription, créer son entreprise, choisir un forfait et commencer. Le premier mois est gratuit, et une carte est prise au paiement pour que le deuxième mois puisse être facturé sans nouvelle conversation.",
      "Rejoindre une entreprise qui existe déjà, c'est autre chose : ça se fait sur invitation seulement. Si un collègue utilise déjà FieldQuo, demandez-lui de vous inviter depuis Gérer l'équipe; voir [[invite-a-team-member|Inviter un membre de l'équipe]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Le formulaire affiche **Commencez votre mois gratuit** en haut et parcourt quatre étapes : Account, Trades, Services, Plan. Un identifiant possède une seule entreprise; si vous êtes déjà connecté avec une entreprise, la page vous le dit et vous propose d'aller à votre tableau de bord ou d'inviter quelqu'un à la place." },
        ],
      },
      {
        id: "the-four-steps",
        heading: "Les quatre étapes",
        blocks: [
          { steps: [
            "**Account** — votre prénom et votre nom, votre courriel et un mot de passe de 8 à 128 caractères, plus le nom de l'entreprise, le téléphone et l'adresse. L'adresse compte : elle détermine le pays, et le pays détermine si vous payez en dollars canadiens ou américains.",
            "**Trades** — « What trades does your company work in? » Cochez tous les métiers qui s'appliquent; cela réduit les types de soumission que vous verrez.",
            "**Services** — « Which services do you offer? » Les types de soumission habituels de vos métiers sont présélectionnés. Activez ceux que vous offrez; vous pourrez changer cela n'importe quand sous Paramètres → Services et tarifs.",
            "**Plan** — « Choose your plan » : les quatre forfaits dans votre devise, puis la façon dont vous voulez être facturé. Appuyez sur **Continue to Payment** pour passer au paiement.",
          ] },
          { note: "Le formulaire d'inscription lui-même est en anglais. L'application, une fois entré, suit la langue que vous choisissez — voir [[choose-your-language|Choisir votre langue]]." },
        ],
      },
      {
        id: "choosing-a-plan",
        heading: "Choisir un forfait",
        blocks: [
          { table: {
            head: ["Forfait", "Par mois", "Sièges", "Accès équipe"],
            rows: [
              ["Solo", "99", "1", "5, gratuits"],
              ["Crew", "169", "3", "8, gratuits"],
              ["Shop", "269", "6", "11, gratuits"],
              ["Scale", "369", "10", "15, gratuits"],
            ],
          } },
          { p: "Le chiffre est le même dans les deux devises : une entreprise canadienne paie 99 dollars canadiens, une américaine 99 dollars américains. Un **siège** est quelqu'un qui peut créer ou modifier une soumission, un chantier ou une facture; un **accès équipe** est quelqu'un qui voit son horaire, pointe et envoie des photos, et il ne coûte rien. Le détail complet : [[your-plan-and-seats|Votre forfait et vos sièges]]." },
          { p: "Sous les cartes de forfaits, **No commitment** facture au mois et s'annule n'importe quand; **1 year commitment** facture une fois par année au prix de dix mois — deux mois gratuits. Une équipe plus grande que Scale est tarifée à la main : la carte **Need more than Scale?** mène à la page de contact." },
        ],
      },
      {
        id: "the-card-and-the-free-month",
        heading: "La carte, et le mois gratuit",
        blocks: [
          { p: "**Continue to Payment** crée l'entreprise et ouvre Stripe Checkout. Stripe prend la carte; FieldQuo ne voit jamais le numéro. La ligne au-dessus du bouton le dit clairement : **Free first month**, puis le prix du forfait. Rien n'est facturé aujourd'hui — le mois gratuit dure 30 jours à partir de la création de l'entreprise, et le premier prélèvement tombe à la fin. Voir [[free-first-month|Le premier mois gratuit]]." },
          { warning: "Si vous fermez l'onglet du paiement, l'entreprise existe mais n'a pas de carte, et chaque écran de l'application reste fermé tant qu'elle n'en a pas. En vous reconnectant, vous arrivez sur **Une dernière étape** — « {company} est configurée — il ne manque qu'une carte pour pouvoir l'utiliser » — avec l'étape du forfait prête à terminer." },
          { tip: "Arrivé par le lien de parrainage d'un autre entrepreneur? La bannière du formulaire le dit, et un mois gratuit de plus s'ajoute à votre essai. La personne qui vous a recommandé gagne un mois une fois que vous êtes client payant. Voir [[referral-months|Les mois de parrainage]]." },
        ],
      },
      {
        id: "after-checkout",
        heading: "Après le paiement",
        blocks: [
          { p: "Stripe vous renvoie au tableau de bord. Une courte visite guidée pointe le menu la première fois; vous pourrez la rejouer plus tard depuis Aide — voir [[replay-the-setup-walkthrough|Rejouer la visite guidée]]. La carte **Terminer la configuration de FieldQuo** liste ce qui manque encore et, pour les propriétaires et administrateurs, le menu affiche **Trial started · N days left** jusqu'au premier paiement." },
          { bullets: [
            "[[your-first-day-setup-checklist|Votre première journée : la liste de configuration]] — quoi faire, dans quel ordre.",
            "[[company-settings-basics|Les bases du profil de l'entreprise]] — l'adresse, les taxes et les heures que le formulaire d'inscription n'a pas demandées.",
            "[[connect-stripe-and-get-verified|Connecter Stripe]] — pour que la première facture puisse être payée en ligne.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Dois-je donner une carte pour essayer?", a: "Oui — au paiement, par Stripe. Rien n'est facturé pendant le mois gratuit, et vous pouvez annuler avant la fin depuis Compte et facturation." },
      { q: "Puis-je choisir la devise?", a: "Non. Elle est lue dans l'adresse que vous avez donnée. Les deux listes de prix portent les mêmes chiffres, il n'y a donc rien à choisir." },
      { q: "J'utilise déjà FieldQuo au travail. Puis-je inscrire ma propre entreprise aussi?", a: "Un identifiant possède une seule entreprise. Inscrivez votre propre entreprise avec une autre adresse courriel." },
      { q: "Puis-je changer de forfait plus tard?", a: "Oui, depuis Compte et facturation — voir [[change-your-plan|Changer de forfait]]. Passer à un forfait supérieur prend effet tout de suite." },
    ],
  },

  "your-first-day-setup-checklist": {
    title: "Votre première journée : la liste de configuration",
    summary:
      "Les deux cartes du tableau de bord qui listent ce qui manque encore, ce que chaque élément débloque, et un ordre sensé pour les faire.",
    updated: "2026-09-12",
    intro: [
      "Après l'inscription, le tableau de bord porte deux cartes qui n'existent que tant que le travail n'est pas fait : **Terminer la configuration de FieldQuo**, la courte liste de ce qu'une entreprise doit avoir avant que sa première soumission parte, et **Étapes de configuration supplémentaires**, la liste plus longue de ce qui vaut la peine d'être fait la première semaine. Aucune des deux n'est décorative : chaque ligne est mesurée contre la base de données et disparaît dès qu'elle est vraie.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "La première carte sert à pouvoir envoyer une soumission et être payé. La seconde sert à ce que la soumission soit bonne — les bonnes conditions, les bons coûts, vos propres courriels. Faites la première carte aujourd'hui; étalez la seconde sur la semaine." },
        ],
      },
      {
        id: "finish-setting-up",
        heading: "La carte « Terminer la configuration de FieldQuo »",
        blocks: [
          { p: "Chaque ligne est un lien vers l'écran qui la complète, cochée automatiquement une fois faite. Ses lignes s'affichent en anglais, quelle que soit votre langue. La carte dit **Encore quelques étapes avant que tout soit prêt** tant que toutes les lignes ne sont pas cochées, puis elle disparaît pour de bon." },
          { bullets: [
            "**Add your logo and brand color** → Paramètres → Image de marque. Faite dès qu'un logo est téléversé. Voir [[set-up-your-branding|Configurer votre image de marque]].",
            "**Complete your business address and phone** → Profil de l'entreprise. Faite quand le téléphone, l'adresse, la ville et la province sont tous remplis.",
            "**Choose the services you offer** → Services et tarifs. Faite quand au moins un type de soumission est activé.",
            "**Set your pricing for at least one service** → Services et tarifs. Faite quand un type de soumission activé a un tarif.",
            "**Connect Stripe to accept client payments** → Paiements. Faite quand Stripe confirme que les paiements sont activés. Voir [[connect-stripe-and-get-verified|Connecter Stripe et faire vérifier votre compte]].",
            "**Invite your team** → Gérer l'équipe. Faite quand quelqu'un d'autre que vous a été ajouté. Cette ligne est absente si vous avez dit à Gérer l'équipe que vous travaillez seul.",
            "**Add your tax registration number** → Profil de l'entreprise. Faite quand le numéro est saisi, ou quand vous avez indiqué que votre entreprise n'est pas inscrite.",
          ] },
          { note: "Les lignes ne sont jamais masquées, seulement retirées. Si vous ne pouvez pas en terminer une — un atelier solo avec la ligne de l'équipe — dites-le sur l'écran vers lequel la ligne pointe, et la ligne cesse de s'appliquer." },
        ],
      },
      {
        id: "additional-set-up-steps",
        heading: "La carte « Étapes de configuration supplémentaires »",
        blocks: [
          { p: "Dix lignes de plus, montrées aux propriétaires, administrateurs, répartiteurs et gestionnaires, chacune avec un bouton **Fait, masquer**. Une ligne disparaît aussi d'elle-même dès que la base de données dit qu'elle est faite. La carte s'ouvre seule tant qu'il reste trois lignes ou plus, et se replie quand il en reste moins." },
          { bullets: [
            "**Saisissez vos frais généraux** — coûts fixes, salaires, dettes et actifs, pour que le prix plancher d'un chantier puisse être calculé. [[overhead-and-your-minimum-price|Frais généraux]].",
            "**Configurez votre échéancier de paiement** — un acompte et des étapes de paiement sur le Profil de l'entreprise. [[deposits-and-payment-schedules|Échéanciers de paiement]].",
            "**Vérifiez le déroulement des travaux sur vos soumissions** — le texte sous chaque type de soumission dans Services et tarifs.",
            "**Ajoutez des crédits IA** — pour la réceptionniste téléphonique et les images IA; FieldQuo IA lui-même est inclus. [[ai-credit-and-phone-credit|Crédit IA]].",
            "**Activez les soumissions instantanées** — les propriétaires obtiennent une estimation de départ depuis votre site. [[instant-quotes-on-your-website|Soumissions instantanées]].",
            "**Vérifiez vos disponibilités pour les réservations** — les heures réservables sur votre page de rendez-vous. [[working-hours-and-bookable-hours|Vos heures]].",
            "**Vérifiez les coûts et les recettes de matériaux** — ce qu'un chantier vous coûte en matériaux. [[cost-and-margin-on-a-quote|Coût et marge]].",
            "**Vérifiez vos options** — les extras qu'un client peut accepter sur une soumission. [[upsell-add-ons|Options]].",
            "**Vérifiez vos courriels** — votre propre domaine, un modèle modifié, ou la section des références du courriel de soumission. [[email-templates|Modèles de courriel]].",
            "**Importez vos anciens travaux** — les chantiers faits et payés avant FieldQuo, pour que les chiffres de l'année soient complets. [[import-past-jobs|Importer les anciens chantiers]].",
          ] },
        ],
      },
      {
        id: "a-sensible-order",
        heading: "Un ordre sensé pour la première journée",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et terminez l'adresse, le téléphone, les heures d'ouverture et les paramètres de taxes. [[company-settings-basics|Les bases du profil de l'entreprise]].",
            "Ouvrez **Image de marque**, téléversez le logo et choisissez la couleur de marque. Chaque document la portera désormais.",
            "Ouvrez **Services et tarifs**, activez ce que vous vendez et mettez un tarif sur au moins un service.",
            "Ouvrez **Paiements** et connectez Stripe, puis complétez ce que Stripe demande.",
            "Importez vos clients à partir d'un CSV, pour que la première soumission aille à un client qui existe déjà. [[import-clients-from-a-csv|Importer des clients]].",
            "Envoyez-vous une soumission d'essai. Ce qui arrive est exactement ce qu'un client reçoit.",
          ] },
        ],
      },
      {
        id: "who-sees-the-cards",
        heading: "Qui voit les cartes",
        blocks: [
          { p: "La carte **Terminer la configuration de FieldQuo** apparaît sur le tableau de bord de tout le monde tant qu'elle n'est pas terminée, parce que ses lignes sont des faits sur l'entreprise. La carte **Étapes de configuration supplémentaires** n'est montrée qu'aux personnes qui peuvent gérer l'entreprise — propriétaires, administrateurs, répartiteurs et gestionnaires — parce que chacune de ses lignes ouvre un écran de paramètres qu'un membre d'équipe ou un estimateur ne peut pas modifier." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je masquer la première carte?", a: "Non. Ses lignes sont retirées quand elles sont faites, ou quand vous indiquez sur l'écran visé que l'élément ne s'applique pas — par exemple, que vous travaillez seul." },
      { q: "J'ai masqué une étape par erreur.", a: "Le masquage vaut pour l'entreprise et il n'y a pas de bouton pour revenir en arrière. L'écran visé par l'étape est toujours dans le menu Paramètres; le travail est le même." },
      { q: "Pourquoi n'ai-je pas de ligne « invitez votre équipe »?", a: "Parce que vous avez dit à Gérer l'équipe que vous travaillez seul. La ligne revient, déjà cochée, le jour où quelqu'un est invité." },
    ],
  },

  "the-sidebar-and-where-everything-is": {
    title: "Le menu, et où tout se trouve",
    summary:
      "Accueil, cinq groupes, FieldQuo IA, Aide, Forfait et Paramètres — chaque ligne du menu principal et du menu Paramètres, et pourquoi certaines lignes manquent pour certaines personnes.",
    updated: "2026-09-12",
    intro: [
      "Le bureau tient dans un seul menu. Apprenez sa forme une fois et vous savez où tout se trouve : Accueil en haut, cinq groupes dans l'ordre où le travail avance, et les outils — FieldQuo IA, Aide, Forfait, Paramètres — sous un trait en bas.",
      "Sur un téléphone, le même menu est un tiroir derrière le bouton de menu, et les quatre écrans de la chaîne plus le clavardage sont dans une barre au bas de l'écran.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Au-dessus du menu se trouvent un bouton **Créer** — un raccourci pour démarrer un Client, un Prospect, une Soumission, un Chantier ou une Facture — et une boîte **Rechercher dans le menu** qui trouve n'importe quelle ligne en tapant son nom, y compris celles du bas. Puis **Accueil**, le tableau de bord. Chaque en-tête de groupe sauf **Travail** se replie et se déplie — Travail reste ouvert parce que c'est la chaîne; les cinq sont ouverts à votre première connexion, et FieldQuo se souvient de ce que vous repliez." },
        ],
      },
      {
        id: "the-five-groups",
        heading: "Les cinq groupes, de haut en bas",
        blocks: [
          { table: {
            head: ["Groupe", "Lignes"],
            rows: [
              ["**Travail**", "Prospects · Soumissions · Révisions de devis · Chantiers · Factures · Forfaits · Calendrier · À faire"],
              ["**Personnel**", "Clients · Équipement client · Clavardage · Votre équipe · Sous-traitants · Attribuer les quarts · Calendrier de l'équipe · Pointeuse · Feuilles de temps · Congés · Sécurité"],
              ["**Finances**", "Paie · Dépenses · Achats · Véhicules"],
              ["**Analyses**", "Analyses · KPI"],
              ["**Croissance**", "Marketing · Créateur · Funnels · Réceptionniste · Boîte équipe · Messages · Parrainage"],
            ],
          } },
          { figure: "live:app", caption: "Accueil — le menu avec Créer, Rechercher dans le menu, Accueil et les cinq groupes, le tableau de bord à côté." },
          { p: "Sous le trait : **FieldQuo IA**, puis **Aide**, **Forfait** et **Paramètres**, et un sélecteur **Apparence** pour le mode clair, sombre ou système. Le pied du menu porte votre nom — qui ouvre Compte et facturation si vous êtes propriétaire ou administrateur —, l'insigne **Trial started · N days left** pendant le mois gratuit, **Déconnexion**, et le bouton qui réduit le menu à ses icônes." },
        ],
      },
      {
        id: "the-settings-menu",
        heading: "Le menu Paramètres",
        blocks: [
          { p: "**Paramètres** ouvre un second menu et atterrit sur le Profil de l'entreprise. Il compte huit groupes, fermés par défaut pour se lire comme un index, avec le groupe où vous êtes ouvert, et une boîte **Rechercher un réglage** en haut." },
          { bullets: [
            "**Compte** — Compte et facturation · Parrainage · Migration de données · Nouveautés",
            "**Entreprise** — Profil de l'entreprise · Image de marque · Langue · Journal d'activité",
            "**Équipe et horaires** — Gérer l'équipe · Disponibilités · Politiques de congés · Page de rendez-vous · Zones desservies",
            "**Services et tarifs** — Produits et services · Services et tarifs · Coût des matériaux · Tarifs des armoires · Frais généraux · Champs personnalisés",
            "**Documents et modèles** — Courriel de soumission · Modèles de courriel · Modèles PDF · Traductions · Listes de vérification · Étiquettes des photos de chantier",
            "**Messagerie et alertes** — Messages aux clients · Relances · Notifications · Domaine d'envoi",
            "**Encaissement** — Paiements · Publicités Meta · Suivi des dépenses · Crédit IA · Paie",
            "**Côté client** — Votre site web · Soumissions instantanées · Partager vos liens · Lien de profil · Réceptionniste téléphonique · Employé IA · Avis",
          ] },
          { figure: "live:app-settings", caption: "Paramètres — les huit groupes à gauche, le Profil de l'entreprise ouvert." },
        ],
      },
      {
        id: "on-a-phone",
        heading: "Sur un téléphone",
        blocks: [
          { p: "Sous la largeur d'un portable, le menu devient un tiroir : le bouton de menu en haut l'ouvre, le logo en haut ramène à l'Accueil. Une barre au bas de l'écran porte **Prospects**, **Soumissions**, **Chantiers**, **Factures** et **Clavardage**, et un onglet **Plus** qui ouvre le même tiroir — pas un second menu. Voir [[using-fieldquo-on-your-phone|Utiliser FieldQuo sur votre téléphone]]." },
        ],
      },
      {
        id: "rows-you-may-not-see",
        heading: "Les lignes que vous ne voyez peut-être pas",
        blocks: [
          { p: "Une ligne manquante n'est pas un défaut. Le menu cache ce que le niveau d'accès de la personne connectée ne permet pas, et la page derrière une ligne cachée la refuse aussi — cacher est une courtoisie, le refus est la sécurité." },
          { bullets: [
            "**Soumissions, Chantiers, Factures, Prospects** exigent au moins la consultation de ce domaine. L'équipe ne peut que consulter les chantiers, alors le groupe Travail d'un membre d'équipe se limite à Chantiers, Calendrier et À faire.",
            "**Clients, Équipement client, Réceptionniste** exigent la consultation complète des dossiers clients. **Analyses** exige l'interrupteur des prix; **KPI** exige le coût de revient.",
            "**Votre équipe, Calendrier de l'équipe, Révisions de devis, Sous-traitants, Véhicules, Marketing, Créateur, Funnels** sont réservés aux propriétaires, administrateurs, répartiteurs et gestionnaires. **Forfait** et **Parrainage** sont réservés aux propriétaires et administrateurs.",
            "**Tarifs des armoires** et **Coût des matériaux** n'apparaissent que pour les métiers qui tarifent ainsi. Toutes les règles sont dans [[access-levels-overview|Les niveaux d'accès]] et [[the-settings-menu|Le menu Paramètres]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Où sont les textos et les messages Facebook de mes clients?", a: "Sous Croissance → Messages. Boîte équipe, juste à côté, est l'endroit où arrivent les photos textées par votre propre équipe." },
      { q: "Pourquoi une ligne que je cherche n'est-elle pas dans cette liste?", a: "Tapez-la dans Rechercher dans le menu. Si rien ne correspond, elle est cachée pour votre niveau d'accès — demandez à un propriétaire ou à un administrateur." },
      { q: "Où est-ce que je change de forfait?", a: "Forfait, au bas du menu — le même écran que Paramètres → Compte et facturation. Propriétaires et administrateurs seulement." },
    ],
  },

  "the-dashboard": {
    title: "Le tableau de bord : ce qui vous attend",
    summary:
      "L'Accueil s'ouvre sur ce qui a besoin de quelqu'un aujourd'hui, puis les revenus du mois, quatre tuiles et le détail en dessous — chaque chiffre affiché seulement quand il est connu.",
    updated: "2026-09-12",
    intro: [
      "**Tableau de bord — Voici où en est votre entreprise.** La page répond d'abord à une question — qu'est-ce qui vous attend aujourd'hui —, puis montre le chiffre d'argent, quatre tuiles de soutien, et tout le reste sous un trait nommé **Le détail**.",
      "Un chiffre inconnu n'est pas affiché. Un membre sans l'interrupteur des prix n'a pas de tuile de revenus plutôt qu'une tuile à zéro, parce que « 0 $ ce mois-ci » est une affirmation sur l'entreprise, pas une case vide.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Chaque nombre de la page vient des mêmes sources que les listes Factures et Soumissions — rien n'est calculé deux fois. Les trois boutons sous les tuiles sont **+ Nouvelle soumission**, **Voir les clients** et **Planifier un rendez-vous**; le premier n'apparaît que pour quelqu'un qui peut créer des soumissions." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "En attente de vous",
        blocks: [
          { p: "Le premier bloc, au-dessus de tout, contient le seul contenu de la page qui attend le lecteur. Il disparaît de lui-même quand il n'y a rien, pour qu'une entreprise tranquille ne soit pas accusée d'un retard qu'elle n'a pas." },
          { bullets: [
            "**Les factures en retard**, par client et par montant, jusqu'à cinq, chacune avec **N jours de retard** et un bouton **Relancer le paiement** qui envoie au client une demande de paiement par courriel sur-le-champ. Au-delà de cinq, **N autres en retard** mène aux Factures.",
            "**N en attente de votre approbation du prix** — des estimations instantanées qui ont besoin d'une personne avant de pouvoir partir. Ouvre Révisions de devis.",
            "**N de votre réceptionniste — rien de fait pour l'instant** — des appels pris par la réceptionniste téléphonique dont personne ne s'est occupé. Ouvre Réceptionniste.",
            "Le prochain rendez-vous réservé par la réceptionniste, s'il y en a un. Ouvre Calendrier.",
          ] },
          { note: "Une facture sans date d'échéance n'est pas en retard et n'apparaît jamais ici. Le bloc dit ce qui est en retard, pas ce qui est dû." },
        ],
      },
      {
        id: "the-figures",
        heading: "Revenus ce mois-ci, et les quatre tuiles",
        blocks: [
          { figure: "live:app", caption: "Accueil — En attente de vous, puis Revenus ce mois-ci avec sa courbe, puis les quatre tuiles." },
          { p: "**Revenus ce mois-ci** est **le total des factures marquées payées ce mois-ci**; la petite courbe à côté trace l'argent réellement reçu, mois par mois, et le lien **Tendance** ouvre ce graphique. Une phrase en dessous compare les deux derniers mois complets — jamais un mois entamé contre un mois entier." },
          { table: {
            head: ["Tuile", "Ce qu'elle compte"],
            rows: [
              ["**Soumissions envoyées ce mois-ci**", "Les soumissions créées ce mois-ci qui sont parties — envoyées, puis acceptées ou refusées —, avec combien de plus ou de moins que le mois dernier."],
              ["**Taux de conversion**", "Le % de soumissions envoyées acceptées par les clients, affiché « acceptées sur envoyées »."],
              ["**Argent dû**", "Le solde de chaque facture impayée, et la part de ce montant qui est en retard."],
              ["**Visites à venir**", "Les visites à venir au calendrier."],
            ],
          } },
          { note: "Un taux de conversion exige **10 soumissions envoyées dans le mois** avant d'être imprimé. En dessous, la tuile ne montre que les nombres — 50 % sur deux soumissions est un chiffre sur lequel vous agiriez et vous ne devriez pas." },
        ],
      },
      {
        id: "the-detail",
        heading: "Le détail",
        blocks: [
          { bullets: [
            "**Argent reçu** — un graphique à barres des paiements selon le mois où ils ont été reçus, sur 3, 6 ou 12 mois. La légende précise que c'est une autre mesure que la tuile des revenus.",
            "**Argent dû** — l'échelle des comptes à recevoir : pas encore dû, 1 à 30, 31 à 60, 61 à 90 et 90 jours et plus, puis chaque facture due avec son contact, sa dernière relance et un bouton Relancer le paiement. Une ligne dit si un rappel automatique de retard est configuré, avec **En configurer un** ou **Le modifier**.",
            "**Revenue goal** — un objectif annuel et si vous êtes en avance ou en retard sur le rythme. Les propriétaires et administrateurs le fixent. [[the-revenue-goal|L'objectif de revenus]].",
            "Les réservations retenues pour des frais de visite qui ne sont pas encore arrivés, et un avis **Migration de données** quand FieldQuo vous a fait un devis de migration.",
            "**Soumissions récentes** et **Prochains rendez-vous**, chacun avec **Tout voir**.",
          ] },
          { p: "Les deux cartes de configuration — **Terminer la configuration de FieldQuo** et **Étapes de configuration supplémentaires** — se placent entre le premier bloc et le chiffre des revenus tant qu'elles ne sont pas terminées. Voir [[your-first-day-setup-checklist|Votre première journée]]." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Qui voit quoi",
        blocks: [
          { p: "Les revenus, les soumissions envoyées, la conversion et l'argent dû exigent l'interrupteur **Voir les prix**; un membre d'équipe voit les Visites à venir et ses propres rendez-vous. Relancer le paiement exige le droit de modifier les factures. L'objectif de revenus peut être fixé par les propriétaires et administrateurs; tous les autres qui voient les prix le consultent. Tout le reste de la page suit les mêmes règles que la liste vers laquelle il mène. Voir [[the-dashboard-in-detail|Le tableau de bord en détail]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Revenus ce mois-ci ne correspond-il pas à Argent reçu?", a: "Ils répondent à deux questions différentes. La tuile additionne les factures marquées payées ce mois-ci; le graphique compte les paiements selon le mois où ils sont arrivés. Une facture de décembre payée en janvier est dans la barre de janvier." },
      { q: "Pourquoi n'y a-t-il pas de pourcentage sur ma tuile de conversion?", a: "Moins de 10 soumissions ont été envoyées ce mois-ci. Les nombres sont affichés à la place; le pourcentage apparaît dès que l'échantillon est assez grand pour vouloir dire quelque chose." },
      { q: "Pourquoi une tuile manque-t-elle complètement?", a: "Le chiffre n'est pas connu — soit votre niveau d'accès n'inclut pas les prix, soit la requête a échoué et un bouton Réessayer est offert au-dessus des tuiles. Rien n'est jamais affiché à zéro à sa place." },
    ],
  },

  "company-settings-basics": {
    title: "Les bases du profil de l'entreprise",
    summary:
      "Le premier écran après l'inscription : vos coordonnées, vos heures d'ouverture, vos taxes, vos conditions de paiement et vos préférences régionales, et ce que chacun change sur vos documents.",
    updated: "2026-09-12",
    intro: [
      "**Profil de l'entreprise — Les coordonnées de votre entreprise, vos heures, vos taxes et vos préférences régionales.** C'est là que la ligne Paramètres atterrit, et l'écran contient tout ce que le formulaire d'inscription n'a pas demandé : l'adresse telle qu'elle s'imprime sur une soumission, le numéro de taxe au bas, les heures que votre site affiche, et les conditions par lesquelles chaque nouvelle soumission commence.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "La page est une colonne de cartes. La plupart s'enregistrent ensemble avec le bouton **Mettre à jour les réglages** au bas; trois — l'échéancier de paiement, les heures d'ouverture et les disponibilités pour la prise de rendez-vous — ont leur propre enregistrement, parce que chacune écrit une chose différente." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { table: {
            head: ["Carte", "Ce qu'elle contient"],
            rows: [
              ["**Description des travaux et conditions**", "La **Description des travaux par défaut** copiée sur chaque nouvelle soumission, avec des modèles de métier pour partir, et la ligne **Conditions de paiement**."],
              ["**Échéancier de paiement**", "Des étapes liées au chantier — un acompte à l'envoi de la facture, une part au début, à mi-parcours ou à la fin. Désactivé tant que vous n'ajoutez pas d'étape."],
              ["**Secteur et types de soumission**", "Les métiers que vous avez déclarés et les types de soumission que cela a débloqués, avec **Gérer** pour les changer dans Services et tarifs."],
              ["**Coordonnées de l'entreprise**", "Nom de l'entreprise, numéro de téléphone, adresse courriel, adresse du site Web, votre sous-domaine, adresse municipale, code postal et pays."],
              ["**Heures d'ouverture**", "Quand l'entreprise est ouverte — affichées sur votre site et utilisées pour les heures dans les résultats de recherche Google."],
              ["**Disponibilités pour la prise de rendez-vous**", "Les plages qui peuvent être réservées en ligne, par jour. Distinctes des heures d'ouverture, exprès."],
              ["**Paramètres de taxes**", "Le nom et le numéro de taxe, les **Taux de taxe** avec un taux par défaut, et l'application automatique du taux local du client."],
              ["**Comparatif sectoriel**", "Un interrupteur pour partager vos chiffres anonymisés et débloquer la comparaison dans Analyses."],
              ["**Paramètres régionaux**", "Devise de facturation, fuseau horaire, format de date et premier jour de la semaine."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — les cartes de haut en bas, Mettre à jour les réglages à la fin." },
        ],
      },
      {
        id: "how-to-save",
        heading: "Comment le remplir",
        blocks: [
          { steps: [
            "Saisissez les coordonnées, les conditions, les taxes et les préférences régionales, puis appuyez sur **Mettre à jour les réglages** au bas. **Enregistré** apparaît à côté du bouton.",
            "Dans **Heures d'ouverture**, réglez chaque jour ou marquez-le **Fermé**, utilisez **Appliquer les heures du {day} à tous les jours ouverts** pour copier une journée, et appuyez sur **Enregistrer les heures d'ouverture** — cette carte s'enregistre seule.",
            "Dans **Disponibilités pour la prise de rendez-vous**, appuyez sur **Modifier** pour régler les heures réservables; la carte montre la plage de chaque jour ou **Fermé**.",
            "Dans **Échéancier de paiement**, appuyez sur **Ajouter une étape**, nommez-la, choisissez quand elle tombe due et son pourcentage; les étapes doivent totaliser exactement 100 % avant que **Enregistrer l'échéancier** fonctionne.",
          ] },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que chaque réglage change",
        blocks: [
          { bullets: [
            "Le **Pays** est rempli automatiquement à partir de l'adresse, et il fixe la **Devise de facturation** et la juridiction fiscale de repli d'une soumission. Cochez **Je sers des clients à l'extérieur de mon pays** pour facturer dans d'autres devises.",
            "Le **Nom du numéro de taxe** et le **Numéro de taxe** s'impriment au bas de chaque soumission et facture. FieldQuo imprime ce que vous saisissez; il ne vous inscrit nulle part et ne produit aucune déclaration.",
            "**Appliquer automatiquement le taux de taxe local du client** compare la province du client à vos taux; sans correspondance, votre taux par défaut est utilisé et la soumission l'indique.",
            "Le **Format de date** ne s'applique qu'à vos propres écrans — les documents des clients suivent la langue du client. Le **Premier jour de la semaine** change le début des calendriers et des grilles d'heures.",
            "Un **Échéancier de paiement** enregistré génère le texte des conditions de paiement, pour que le document corresponde toujours à ce qui est réellement facturé; **Désactiver — revenir au texte libre** efface toutes les étapes.",
            "Les **Heures d'ouverture** sont un fait au niveau de l'entreprise; les **Disponibilités** sont par personne. Le bureau peut être ouvert un jour où personne n'est libre pour une visite.",
            "L'interrupteur du **Comparatif sectoriel** regroupe vos chiffres avec ceux d'autres entreprises, jamais affichés individuellement, et se désactive n'importe quand.",
          ] },
          { warning: "**Tous les jours marqués fermés** signifie qu'aucune heure n'apparaît sur votre site ni dans les résultats de recherche. Une semaine partielle est publiée comme une semaine partielle — FieldQuo n'invente jamais un lundi-au-vendredi à votre place." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Les propriétaires, administrateurs, répartiteurs et gestionnaires peuvent changer chaque carte. Les estimateurs et les membres d'équipe ouvrent la même page en lecture seule, sous le titre **Voici les coordonnées de votre entreprise telles que les clients les voient**. Voir [[settings-company|Profil de l'entreprise]] pour la référence complète, et [[opening-hours|Heures d'ouverture]] et [[tax-settings|Paramètres de taxes]] pour les deux cartes qui ont le plus de conséquences." },
        ],
      },
    ],
    faq: [
      { q: "J'ai changé l'adresse. Pourquoi la devise n'a-t-elle pas changé?", a: "La devise suit le pays, et le pays est lu dans l'adresse. Si le pays a changé, la devise a changé avec lui; si seule la rue a changé, rien ne bouge côté argent." },
      { q: "Où est-ce que je règle mes propres heures de travail?", a: "Sous Paramètres → Disponibilités, par personne. Le Profil de l'entreprise contient les heures d'ouverture que le public voit." },
      { q: "Pourquoi la case des conditions de paiement refuse-t-elle que j'écrive?", a: "Un échéancier de paiement est activé, et les conditions sont générées à partir de lui. Désactivez l'échéancier pour écrire du texte libre à nouveau." },
    ],
  },

  "set-up-your-branding": {
    title: "Configurer votre image de marque",
    summary:
      "Téléversez le logo, choisissez une couleur principale, et chaque soumission, facture, courriel, page de rendez-vous et page de site la porte — au contraste mesuré, jamais à l'intérieur de l'application.",
    updated: "2026-09-12",
    intro: [
      "**Image de marque — Votre logo et votre couleur de marque apparaissent sur chaque soumission, facture et courriel que vos clients voient.** Un écran, un enregistrement, et dès lors un propriétaire qui lit votre soumission voit votre entreprise, pas un logiciel.",
      "La couleur n'est pas appliquée à l'aveugle. Chaque paire texte-fond d'une page côté client est calculée à partir de votre seul code de couleur et mesurée pour le contraste, pour qu'un jaune, un blanc ou un gris moyen s'imprime encore lisiblement.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Trois cartes et un aperçu. Seule la couleur principale est requise; les autres suivent des valeurs par défaut raisonnables tirées d'elle. Rien ici ne change les écrans de votre équipe — le bureau reste neutre pour qu'une couleur vive ne le rende jamais difficile à utiliser." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Logo** — le logo actuel ou **Aucun logo**, et **Téléverser un logo** / **Remplacer le logo**. PNG, JPG, WebP ou SVG, jusqu'à 8 Mo.",
            "**Couleurs de marque** — **Principale** et **Secondaire**, chacune avec six pastilles prédéfinies, un sélecteur de couleur personnalisée et un lien **Réinitialiser** une fois réglée.",
            "**L'apparence de vos documents** — l'en-tête d'une soumission prévisualisé en **Clair** et en **Sombre**.",
            "**Neutre** — la couleur de la barre d'en-tête des courriels, et un **Aperçu** d'à peu près à quoi ressemblera le haut de vos courriels avec votre logo et le nom de votre entreprise.",
          ] },
          { figure: "live:app-settings-branding", caption: "Image de marque — la carte Logo, les Couleurs de marque, l'aperçu des documents en clair et en sombre." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment la configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Image de marque**.",
            "Appuyez sur **Téléverser un logo** et choisissez le fichier. Il est téléversé tout de suite et affiché dans la carte; rien n'est encore enregistré sur vos documents.",
            "Choisissez une couleur **Principale** — une pastille, ou le sélecteur pour votre code exact.",
            "Au besoin, choisissez une **Secondaire** et une **Neutre**. Laissez-les vides pour hériter de la principale et de l'en-tête foncé par défaut.",
            "Appuyez sur **Enregistrer la marque**. **Enregistré ✓** le confirme, et la prochaine soumission que vous ouvrez la porte déjà.",
          ] },
          { warning: "Si la page ne peut pas charger votre image de marque actuelle, elle refuse d'afficher le formulaire, avec un bouton **Réessayer** — un chargement raté ne peut donc jamais enregistrer des couleurs par défaut par-dessus les vôtres." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que chaque réglage change",
        blocks: [
          { table: {
            head: ["Réglage", "Où il apparaît"],
            rows: [
              ["**Logo**", "L'en-tête de chaque soumission, facture et PDF; l'en-tête des courriels; la page de rendez-vous; votre site web; le portail client."],
              ["**Principale**", "Les boutons, les barres de progression et votre nom dans l'en-tête des courriels; l'accent de chaque page côté client."],
              ["**Secondaire**", "Les accents de soutien, comme les titres de section des listes détaillées. Reprend la principale par défaut."],
              ["**Neutre**", "La barre d'en-tête des courriels. Un ton foncé par défaut, qui paraît plus haut de gamme qu'une couleur saturée."],
            ],
          } },
          { note: "Les couleurs n'apparaissent jamais dans l'application. Les écrans de votre équipe restent les mêmes, quoi que vous choisissiez." },
        ],
      },
      {
        id: "contrast",
        heading: "Pourquoi un logo jaune s'imprime encore lisiblement",
        blocks: [
          { p: "Les entrepreneurs choisissent du jaune, du blanc, du noir et du gris moyen, et la règle naïve — « couleur foncée, texte blanc » — échoue sur chacun. FieldQuo ne devine pas : il mesure chaque paire texte-fond dérivée de votre code et choisit des couleurs d'encre et de fond qui passent un contraste de 4,5:1. Les aperçus Clair et Sombre de cette page sont le même calcul, alors ce que vous voyez est ce que le client reçoit. Le détail complet : [[settings-branding|Image de marque]] et [[nothing-says-fieldquo|Rien ne dit FieldQuo]]." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Qui peut la modifier",
        blocks: [
          { p: "Les propriétaires, administrateurs, répartiteurs et gestionnaires. L'enregistrement est refusé par le serveur pour tous les autres, quoi que montre l'écran." },
        ],
      },
    ],
    faq: [
      { q: "Le téléversement de mon logo échoue.", a: "Vérifiez le format — PNG, JPG, WebP ou SVG — et la taille, 8 Mo au plus. Un fichier plus gros est refusé avant d'être stocké." },
      { q: "La couleur de marque change-t-elle la ligne « De » des courriels?", a: "Non. La ligne « De » est le nom de votre entreprise, et votre propre adresse une fois un domaine vérifié — voir [[send-from-your-own-domain|Envoyer depuis votre propre domaine]]." },
      { q: "Puis-je prévisualiser une vraie soumission avec les nouvelles couleurs?", a: "Oui — enregistrez, puis ouvrez la page client de n'importe quelle soumission. L'aperçu de cet écran est le même calcul, mais un vrai document est le test honnête." },
    ],
  },

  "choose-your-language": {
    title: "Choisir votre langue, et celle de votre entreprise",
    summary:
      "Votre langue est celle dans laquelle vous lisez l'application; la valeur par défaut de l'entreprise est celle dont héritent vos collègues et vos clients. Un document garde la langue dans laquelle il a été créé.",
    updated: "2026-09-12",
    intro: [
      "Il y a deux réglages sur l'écran **Langue**, et ils ne veulent pas dire la même chose. **Votre langue** est personnelle — celle dans laquelle vous lisez le bureau. La **Valeur par défaut de l'entreprise** est celle dont hérite quiconque n'a pas choisi, et la langue dans laquelle une soumission ou une facture part quand le client n'en a pas.",
      "Ni l'un ni l'autre ne touche un document qui existe déjà. Une soumission garde la langue dans laquelle elle a été créée, pour toujours — un PDF signé doit continuer à dire ce qu'il disait.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Huit langues sont offertes : anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien. Chaque ligne indique la part de l'interface traduite; le reste s'affiche en anglais. Un document, un PDF ou un courriel destiné à un client est traduit par document, alors chacune des huit y est complète." },
        ],
      },
      {
        id: "your-language",
        heading: "Votre langue",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Langue**.",
            "Sous **Votre langue**, appuyez sur une langue — ou sur **Suivre la valeur par défaut de l'entreprise** pour suivre ce que l'entreprise utilise.",
            "C'est enregistré dès que vous appuyez; l'interface change, et **Affichage actuel :** nomme la langue en vigueur.",
          ] },
          { figure: "live:app-settings-language", caption: "Langue — Votre langue avec la couverture sur chaque ligne, et la carte Valeur par défaut de l'entreprise en dessous." },
        ],
      },
      {
        id: "company-default",
        heading: "Valeur par défaut de l'entreprise",
        blocks: [
          { p: "La seconde carte, **Valeur par défaut de l'entreprise**, est **utilisée pour les membres de l'équipe qui n'ont pas choisi de langue, et pour les devis et factures des clients qui n'en ont pas**. Les propriétaires, administrateurs, répartiteurs et gestionnaires peuvent y appuyer sur une langue; tous les autres la voient comme un fait, sous le titre **C'est la langue que reçoivent les nouveaux membres de l'équipe et les clients qui n'en ont pas une à eux**." },
          { note: "**Ce changement s'applique à tous ceux qui n'ont pas défini leur propre langue. Il ne modifie pas les devis déjà envoyés — ils conservent la langue d'envoi.**" },
        ],
      },
      {
        id: "what-the-labels-mean",
        heading: "Ce que veulent dire les étiquettes de couverture",
        blocks: [
          { table: {
            head: ["Étiquette", "Signification"],
            rows: [
              ["**Interface 100 %**", "Chaque écran est traduit et une personne qui parle la langue l'a vérifié. L'anglais et le français aujourd'hui."],
              ["**Interface 100 % · à vérifier**", "Chaque texte est traduit mais aucun locuteur natif ne l'a encore vérifié. L'espagnol, l'allemand et l'italien aujourd'hui."],
              ["**Interface N %**", "Une partie de l'interface est traduite; le reste s'affiche en anglais. L'ukrainien, le pendjabi et le tagalog aujourd'hui."],
            ],
          } },
        ],
      },
      {
        id: "your-clients",
        heading: "Ce que vos clients reçoivent",
        blocks: [
          { p: "La langue d'un client vit sur sa fiche et commande tout ce qu'il reçoit : la soumission, la facture, le PDF, le courriel d'accompagnement, les textos. Quand un client n'en a pas, la valeur par défaut de l'entreprise s'applique. Réglez-la une fois sur le client — voir [[a-clients-language|La langue d'un client]] — et lisez [[quote-language|Une soumission garde sa langue]] pour ce qui arrive à un document après son envoi. Le libellé de vos propres services dans une autre langue se rédige et se vérifie sur [[settings-translations|Traductions]]." },
        ],
      },
    ],
    faq: [
      { q: "Je suis passé à l'espagnol et certains écrans sont encore en anglais.", a: "L'espagnol est entièrement traduit mais marqué à vérifier; un texte manquant s'affiche en anglais plutôt que de laisser un vide. L'étiquette de la ligne est la couverture honnête." },
      { q: "Si je change la valeur par défaut de l'entreprise, les anciennes soumissions changeront-elles?", a: "Non. Un document garde la langue dans laquelle il a été créé. Seuls les nouveaux documents, et les collègues qui n'ont jamais choisi, suivent la nouvelle valeur par défaut." },
      { q: "Un membre de l'équipe peut-il changer sa propre langue?", a: "Oui. Votre langue est personnelle et ouverte à chaque membre; seule la valeur par défaut de l'entreprise est restreinte." },
    ],
  },

  "import-clients-from-a-csv": {
    title: "Importer des clients à partir d'un CSV",
    summary:
      "Chargez la liste de clients de votre ancien système d'un coup — les colonnes que FieldQuo lit, ce qu'il ignore, et ce qu'il ne dédoublonne jamais.",
    updated: "2026-09-12",
    intro: [
      "**Importer des clients — Téléversez un fichier CSV exporté d'un autre système.** Le fichier est lu dans votre navigateur, les trois premières lignes vous sont montrées, et une seule pression les écrit toutes. Chaque ligne devient une fiche client exactement comme si vous l'aviez saisie.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "L'importateur prend les noms et les coordonnées seulement — pas de chantiers, pas de factures, pas d'historique. Pour les travaux déjà faits et payés, utilisez [[import-past-jobs|Importer les anciens chantiers]]; pour des archives complètes, [[the-data-migration-service|Le service de migration de données]]." },
        ],
      },
      {
        id: "prepare-the-file",
        heading: "Préparer le fichier",
        blocks: [
          { p: "Exportez un CSV de l'endroit où la liste se trouve aujourd'hui. FieldQuo reconnaît les noms de colonnes sans se soucier des majuscules, et accepte les variantes courantes." },
          { table: {
            head: ["Colonne", "En-têtes acceptés", "Obligatoire"],
            rows: [
              ["Nom", "name, Name, Full Name", "Oui — une ligne sans nom est ignorée"],
              ["Courriel", "email, Email", "Non, mais une ligne dont l'adresse n'est pas livrable est ignorée"],
              ["Téléphone", "phone, Phone, Phone Number", "Non"],
              ["Adresse", "address, Address", "Non"],
              ["Ville", "city, City", "Non"],
              ["Province", "province, Province, State", "Non"],
              ["Pays", "country, Country", "Non — normalisé en code, ou laissé vide"],
            ],
          } },
          { tip: "Un client entreprise avec une personne-ressource : mettez l'entreprise dans **name** et ajoutez la personne sur la fiche ensuite — voir [[business-clients-and-contacts|Clients entreprises et personnes-ressources]]." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment importer",
        blocks: [
          { steps: [
            "Ouvrez **Clients** et appuyez sur **Importer**, à côté de **Nouveau client**.",
            "Appuyez sur **Cliquez pour choisir un fichier CSV** et choisissez le fichier.",
            "Lisez **{count} lignes trouvées. Aperçu des 3 premières :** — chaque ligne montre le nom et le courriel ou le téléphone, ou **aucune coordonnée**.",
            "Appuyez sur **Importer {count} clients**.",
            "Le résultat se lit **{count} clients importés**, avec **({count} ignorés — nom manquant)** et **({count} ignorés — adresse e-mail non livrable)** quand cela s'applique. **Voir les clients** ouvre la liste.",
          ] },
          { figure: "live:app-clients", caption: "Clients — chaque client en fiche, avec Importer et Nouveau client en haut." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "Ce qui arrive à chaque ligne",
        blocks: [
          { bullets: [
            "Une ligne sans nom n'a rien à importer et est comptée comme ignorée.",
            "Une ligne dont l'adresse courriel n'est pas livrable est laissée de côté et comptée à part, plutôt qu'importée avec l'adresse discrètement retirée — un client qui semble joignable et ne l'est pas, c'est ainsi qu'une soumission part vers nulle part. Un courriel vide, c'est correct.",
            "Un pays écrit en toutes lettres (« Canada », « CAN ») est normalisé en son code, ou laissé vide quand il ne peut pas être lu. Il n'est jamais stocké en texte libre.",
            "**Rien n'est dédoublonné.** Importer le même fichier deux fois crée chaque client deux fois. Voir [[duplicate-clients|Clients en double]] pour faire le ménage.",
          ] },
        ],
      },
      {
        id: "who-can-import",
        heading: "Qui peut importer",
        blocks: [
          { p: "Quiconque a un accès qui permet d'ajouter des clients — **View and edit full client and property info** ou plus : estimateurs, répartiteurs, gestionnaires, administrateurs et le propriétaire. Le bouton Importer ne leur est offert qu'à eux, et la page refuse tous les autres avant même qu'un fichier soit choisi." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je importer une feuille de calcul directement?", a: "Enregistrez-la d'abord en CSV. Excel et Google Sheets en exportent tous les deux; gardez la ligne d'en-tête." },
      { q: "Est-ce que ça importe les notes, les chantiers ou les factures?", a: "Non — le nom, le courriel, le téléphone et l'adresse seulement. Les anciens chantiers ont leur propre importateur, et un historique complet relève du service de migration." },
      { q: "La moitié de mes lignes ont été ignorées pour cause de mauvais courriels. Et maintenant?", a: "Corrigez ou videz les cases de courriel de ces lignes, supprimez les autres du fichier, et importez les lignes corrigées à nouveau. Les lignes déjà importées ne sont pas touchées." },
    ],
  },

  "import-past-jobs": {
    title: "Importer les anciens chantiers de votre ancien système",
    summary:
      "Enregistrez les travaux décrochés, faits et payés avant FieldQuo — un à la fois ou une année dans un seul CSV — pour que les chiffres de l'année soient complets, sans rien envoyer au client.",
    updated: "2026-09-12",
    intro: [
      "**Travaux passés — Enregistrez les travaux réalisés et payés avant d'utiliser FieldQuo, pour que les chiffres de l'année soient complets.** La page dit l'essentiel dans ses propres mots : **C'est de la saisie : rien n'est envoyé au client par courriel, texto ou appel, ni maintenant ni plus tard.**",
      "Chaque ancien chantier devient une soumission, un chantier terminé et une facture payée, datés comme vous les saisissez, pour que les revenus, la précision des estimations et l'historique du client se lisent correctement dès le jour où vous avez changé d'outil.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Deux façons d'entrer : **Saisir un travail passé**, un formulaire, ou **Ou téléversez une année d'un coup**, un CSV vérifié ligne par ligne avant que quoi que ce soit soit écrit. Les deux se trouvent sur la page ouverte par **Anciens chantiers** dans la liste des Chantiers, et par la ligne **Importez vos anciens travaux** de la carte de configuration du tableau de bord." },
        ],
      },
      {
        id: "what-is-created",
        heading: "Ce qui est créé",
        blocks: [
          { p: "Pour chaque ancien chantier : le client, s'il est nouveau; une soumission marquée acceptée; un chantier marqué terminé; une facture marquée payée, avec un paiement à la date que vous avez donnée, comptant, par chèque, par virement Interac ou par carte prise ailleurs; et, si vous avez donné des coûts de main-d'œuvre ou de matériaux, une dépense pour chacun. Chaque dossier porte la note **Entered as a past job**, et chaque tâche automatique et chaque bouton d'envoi les saute." },
        ],
      },
      {
        id: "one-at-a-time",
        heading: "Saisir un travail passé",
        blocks: [
          { steps: [
            "Ouvrez **Chantiers → Anciens chantiers**.",
            "Sous **Client**, **Choisir un client existant** ou choisissez **Nouveau client** et saisissez le nom, le courriel, le téléphone et l'adresse.",
            "Remplissez le service, ce qui a été fait, les dates de début et de fin, le montant avant taxes, si **Des taxes ont été facturées sur ce travail** (calculées selon votre taux à la date du travail), la date de paiement et **Payé par**. Le coût de la main-d'œuvre, le coût des matériaux, la référence de soumission et le numéro de facture sont facultatifs.",
            "Appuyez sur **Saisir ce travail passé**.",
            "La confirmation se lit **Saisi : {title} — {total} payé le {date}**, avec **Ouvrir le travail** et, s'il en a été créé un, **Nouveau client ajouté : {name}**.",
          ] },
          { figure: "live:app-jobs", caption: "Chantiers — la liste avec ses pastilles d'état; Anciens chantiers se trouve à côté de Nouveau chantier en haut." },
        ],
      },
      {
        id: "a-year-at-once",
        heading: "Téléverser une année d'un coup",
        blocks: [
          { p: "**Télécharger le modèle** vous donne les en-têtes exacts. Une ligne par chantier, jusqu'à **500** lignes par fichier; la page explique chaque colonne sous **Signification de chaque colonne**." },
          { table: {
            head: ["Colonne obligatoire", "Ce qu'on y met"],
            rows: [
              ["client_name", "Le client, apparié à une fiche existante par ses coordonnées, ou créé."],
              ["description", "Ce qu'était le travail."],
              ["job_start", "Une date écrite AAAA-MM-JJ."],
              ["amount_before_tax", "Le prix, supérieur à zéro."],
              ["paid_date", "Quand vous avez été payé — jamais dans le futur, jamais avant le début du travail."],
              ["payment_method", "cash, cheque, e_transfer ou card_elsewhere."],
            ],
          } },
          { p: "Facultatives : client_email, client_phone, client_address, service, job_end, tax_applied (yes/no), labour_cost, materials_cost, quote_number, invoice_number." },
          { steps: [
            "Appuyez sur **Choisir un fichier CSV**. Chaque ligne est vérifiée par le serveur et affichée avec un **État** : **Prêt**, **Déjà au dossier**, ou les champs à corriger.",
            "Lisez le résumé — **prêts à saisir**, **déjà au dossier**, **à corriger**, **nouveaux clients** — et corrigez dans le fichier ce qui est signalé.",
            "Appuyez sur **Saisir {n} travaux passés**. Le résultat se lit **{n} travaux passés saisis.** et, quand cela s'applique, **{n} étaient déjà au dossier et ont été laissés tels quels.**",
          ] },
        ],
      },
      {
        id: "duplicates-and-errors",
        heading: "Doublons et erreurs",
        blocks: [
          { bullets: [
            "Un chantier est **Déjà au dossier** quand le nom du client, le début du travail, le montant et la date de paiement correspondent tous à un chantier saisi auparavant. Il n'est jamais saisi deux fois — un fichier téléversé deux fois, ou deux onglets, ne peuvent pas doubler vos revenus.",
            "**Les lignes à corriger sont laissées de côté.** Corrigez-les dans le fichier et téléversez-le à nouveau; les lignes qui étaient prêtes entrent sans elles.",
            "Un fichier de plus de 500 lignes est coupé : **Seules les 500 premières lignes ont été lues. Mettez le reste dans un second fichier.**",
            "Une référence de soumission ou un numéro de facture que vous fournissez ne doit pas déjà exister, et ne doit pas ressembler à un numéro FieldQuo en vigueur.",
          ] },
        ],
      },
      {
        id: "who-can-enter",
        heading: "Qui peut saisir des anciens chantiers",
        blocks: [
          { p: "Quelqu'un qui peut créer des soumissions, des chantiers et des factures et qui voit les prix : les répartiteurs, gestionnaires, administrateurs et le propriétaire. Les lignes qui créent un nouveau client exigent aussi le niveau qui ajoute des clients. Un estimateur peut écrire des soumissions mais pas des chantiers ni des factures, alors cet écran le refuse." },
        ],
      },
    ],
    faq: [
      { q: "Le client recevra-t-il un courriel?", a: "Non. Ni à la saisie, ni par une règle de relance, ni par une demande d'avis. La page le dit et le serveur le respecte." },
      { q: "Les anciens chantiers comptent-ils dans mon tableau de bord et mes rapports?", a: "Oui — c'est le but. Les revenus, l'argent reçu, le taux de succès et l'historique du client les incluent tous, datés au moment où ils ont eu lieu." },
      { q: "J'en ai saisi un avec le mauvais montant.", a: "Ouvrez le chantier et sa facture depuis **Ouvrir le travail** et corrigez-les comme n'importe quel dossier. La clé de doublon utilise le montant, alors ressaisir la ligne corrigée créerait un second chantier — modifiez, ne réimportez pas." },
    ],
  },

  "import-a-quote-from-another-system": {
    title: "Importer une soumission d'un autre système",
    summary:
      "FieldQuo ne lit pas un fichier de soumission venu d'un autre logiciel. Voici les quatre vraies façons dont une soumission faite ailleurs se retrouve dans votre compte, et laquelle convient.",
    updated: "2026-09-12",
    intro: [
      "Il n'y a pas de bouton qui prend une soumission Jobber, Housecall Pro ou QuickBooks et la transforme en soumission FieldQuo. C'est voulu, pas oublié : une soumission dans FieldQuo est tarifée à partir de votre propre liste de prix sur le serveur, et un fichier venu d'ailleurs ne porte rien de tout cela.",
      "Ce que vous pouvez faire dépend de ce qu'est la soumission : un chantier déjà fait et payé, une soumission en cours que vous devez encore envoyer, des archives complètes, ou une soumission qu'une autre entreprise FieldQuo vous a envoyée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { table: {
            head: ["Ce que vous avez", "Quoi faire"],
            rows: [
              ["Une soumission pour un chantier fait et payé avant FieldQuo", "Saisissez-la comme ancien chantier — un formulaire, ou un CSV pour toute l'année. [[import-past-jobs|Importer les anciens chantiers]]."],
              ["Une soumission en cours que vous devez encore envoyer", "Refaites-la dans le constructeur de soumissions à partir de votre liste de prix. Dix minutes, et c'est une vraie soumission FieldQuo que le client peut approuver en ligne."],
              ["Tout un historique — des années de soumissions, de factures et de clients", "Le service payant de migration de données : le personnel de FieldQuo l'importe. [[the-data-migration-service|Le service de migration de données]]."],
              ["Une soumission qu'une autre entreprise FieldQuo vous a envoyée, comme sous-traitant", "Intégrez-la à votre propre soumission comme ligne de coût majorée, depuis la page de soumission que vous avez reçue. [[import-a-subcontractor-quote|Importer la soumission d'un sous-traitant]]."],
            ],
          } },
        ],
      },
      {
        id: "rebuild-a-live-quote",
        heading: "Refaire une soumission en cours",
        blocks: [
          { steps: [
            "Importez d'abord le client s'il n'est pas au dossier — [[import-clients-from-a-csv|Importer des clients à partir d'un CSV]] — pour que la soumission soit adressée à une fiche existante.",
            "Ouvrez **Soumissions → Nouvelle soumission**, choisissez le client et le type de soumission.",
            "Ajoutez les lignes depuis votre liste de prix, ou saisissez-les; regroupez par pièce ou par portée si l'ancienne soumission le faisait.",
            "Vérifiez la langue avant d'enregistrer — une soumission garde la langue dans laquelle elle est créée —, puis envoyez-la. Le client reçoit une page et un PDF à votre image et peut approuver en ligne.",
          ] },
          { figure: "live:app-quotes", caption: "Soumissions — la liste avec ses pastilles d'état et Nouvelle soumission." },
          { tip: "Si l'ancienne soumission était déjà approuvée et que le chantier est en cours, créez la soumission et marquez-la approuvée, puis le chantier est créé à partir d'elle — voir [[convert-a-quote-to-a-job|Ce qui se passe quand une soumission est approuvée]]." },
        ],
      },
      {
        id: "a-quote-from-another-fieldquo-company",
        heading: "Une soumission d'une autre entreprise FieldQuo",
        blocks: [
          { p: "Quand un sous-traitant qui utilise FieldQuo vous envoie sa soumission, la page que vous recevez porte une carte intitulée **Add this to one of your quotes** — montrée seulement à un entrepreneur connecté d'une autre entreprise, jamais à un propriétaire. Vous choisissez à laquelle de vos soumissions ouvertes l'ajouter, une majoration de 0, 10, 20 ou 30 pour cent ou une majoration personnalisée, et si votre client voit **One line** ou **Itemised**. Votre client ne voit jamais le sous-traitant ni votre majoration. Sur votre soumission, elle apparaît sous **Coûts de sous-traitance**, où vous pouvez modifier la majoration ou la retirer tant que la soumission est ouverte." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "Il ne convertit pas un PDF, un fichier Word ni l'export d'un autre produit en soumission.",
            "Il n'accepte pas de prix venant du navigateur — chaque ligne d'une soumission est tarifée sur le serveur à partir de vos propres données, ce qui explique pourquoi un fichier externe ne peut pas devenir une soumission directement.",
            "Il n'importe pas de soumission par une API publique; il n'y en a pas. [[no-public-api-or-zapier|Intégrations]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Le personnel de FieldQuo peut-il saisir mes soumissions en cours à ma place?", a: "Oui, dans le cadre du service payant de migration. Les soumissions qu'il crée sont des brouillons que vous terminez et envoyez vous-même; il ne modifie jamais une soumission qui existe déjà." },
      { q: "J'ai une feuille de calcul de soumissions. Y a-t-il un import CSV?", a: "Pas pour les soumissions. Pour les clients, oui; pour les chantiers déjà faits et payés, oui. Une soumission en cours se refait dans le constructeur." },
      { q: "La soumission d'un ancien chantier importé apparaîtra-t-elle comme envoyée au client?", a: "Elle est marquée acceptée et datée comme vous l'avez saisie, et rien n'est jamais envoyé au client à son sujet." },
    ],
  },

  "the-data-migration-service": {
    title: "Le service de migration de données",
    summary:
      "Demandez à FieldQuo d'importer vos anciens dossiers : une demande, un appel, un prix que vous acceptez ou refusez, un paiement par la facturation FieldQuo, et un journal de chaque dossier créé.",
    updated: "2026-09-12",
    intro: [
      "**Migration de données — Importez vos anciennes soumissions, factures et chantiers dans FieldQuo — depuis QuickBooks, Jobber, un tableur ou une boîte à chaussures.** C'est un service payant fait par le personnel de FieldQuo, pas un importateur en libre-service, et c'est le seul cas autorisé où FieldQuo écrit dans votre compte.",
      "Les règles sont strictes et valent la peine d'être connues avant de demander : le personnel ne peut que créer de nouveaux dossiers, jamais modifier ni supprimer ce qui existe déjà, seulement après que vous avez accepté un prix et payé, et chaque dossier créé est consigné là où vous pouvez le voir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Vous décrivez ce que vous apportez, réservez un appel, recevez un prix, l'acceptez et payez. Ensuite, FieldQuo crée les clients et les soumissions dans votre compte et vous les voyez apparaître sous **Ce qui a été importé**. Le paiement passe par la facturation FieldQuo — la même carte que votre abonnement —, jamais par votre propre compte Stripe, qui sert à vos clients pour vous payer." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Demander une migration** — **Où se trouvent vos données actuellement?** et **Autre chose à savoir** (combien d'années, environ combien de dossiers), puis **Demander une migration**.",
            "La carte de la demande, avec son état : **Demandée**, **Appel réservé**, **Devis prêt**, **Acceptée — paiement dû**, **Payée**, **En cours**, **Terminée**, **Refusée** ou **Annulée**.",
            "**Réservez un appel avec FieldQuo** — des plages ouvertes à choisir, ou **Aucune plage n'est disponible pour le moment — nous vous contacterons pour en fixer une.**",
            "**Documents** — **Téléverser un fichier** : un export QuickBooks ou Jobber, un tableur, ou un ZIP de vos anciens dossiers. CSV, XLS, XLSX, TXT, PDF, ZIP et les formats QuickBooks sont acceptés.",
            "**Ce qui a été importé** — chaque dossier que FieldQuo a créé pour vous — et **Demandes précédentes**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Migration de données — la carte de la demande avec son état et son prix, les Documents en dessous." },
        ],
      },
      {
        id: "how-it-goes",
        heading: "Comment ça se passe, étape par étape",
        blocks: [
          { steps: [
            "Remplissez **Demander une migration**. L'état se lit **Demandée**.",
            "Réservez un appel parmi les plages ouvertes, ou attendez que FieldQuo en fixe un. Vous pouvez choisir une autre plage tant qu'un prix n'existe pas.",
            "FieldQuo tarife le travail. L'état passe à **Devis prêt**, le tableau de bord dit **FieldQuo a établi un devis de {amount} pour votre migration de données. Consultez-le et répondez.**, et la carte montre **Accepter** et **Refuser**.",
            "Appuyez sur **Accepter**. La carte se lit **Devis accepté — payez quand vous serez prêt à commencer.**",
            "Appuyez sur **Payer et commencer la migration**. Vous êtes redirigé vers Stripe pour payer; l'état passe à **Payée** et la carte se lit **Paiement reçu — merci. FieldQuo vous contactera pour commencer la migration.**",
            "Pendant que le personnel travaille, l'état est **En cours** et les dossiers apparaissent sous **Ce qui a été importé** au fur et à mesure.",
            "**Terminée** — **Migration terminée.**",
          ] },
          { note: "Le téléversement de documents est possible à chaque étape tant que la demande n'est pas refusée ou annulée — un export est utile avant même qu'un prix existe." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "Ce que FieldQuo écrit, et ce qu'il ne touche jamais",
        blocks: [
          { bullets: [
            "Il **crée** des fiches clients et des soumissions dans votre compte. Aujourd'hui, ce sont les deux types de dossiers que le service écrit; une soumission migrée est un brouillon, marqué historique, sans taxe appliquée.",
            "Il ne modifie ni ne supprime **jamais** un client, une soumission, une facture ou un chantier qui existait avant — le code n'a aucun chemin qui le permette.",
            "Il n'écrit **que** pendant que la demande est Payée ou En cours, vérifié à neuf à chaque écriture. Annulez la migration et l'écriture s'arrête à l'instant.",
            "Chaque écriture est consignée avec ce qui a été créé et quand, et vous lisez ce journal sous **Ce qui a été importé**.",
          ] },
          { p: "C'est un mécanisme différent d'une session d'assistance. Quand l'assistance FieldQuo regarde votre compte pour vous aider, cette session est en lecture seule, sans exception; la migration est la seule porte pour écrire, et vous seul pouvez l'ouvrir en payant." },
        ],
      },
      {
        id: "cancelling-and-who-can-see-it",
        heading: "Annuler, et qui peut le voir",
        blocks: [
          { p: "**Annuler cette demande** est disponible tant que vous n'avez pas payé. Après le paiement, annuler est une conversation avec l'assistance plutôt qu'un bouton. L'écran se trouve sous Paramètres → Compte, pour les propriétaires et administrateurs seulement — les mêmes personnes qui voient la facturation de l'entreprise. Le prix et le reçu sont expliqués dans [[paying-for-the-migration-service|Payer le service de migration]]." },
        ],
      },
    ],
    faq: [
      { q: "Combien ça coûte?", a: "Il n'y a pas de prix affiché. FieldQuo tarife chaque migration après l'appel, selon ce que vous apportez, et vous acceptez ou refusez le montant sur cet écran." },
      { q: "FieldQuo peut-il corriger une de mes soumissions pendant qu'il y est?", a: "Non. Le personnel ne peut que créer de nouveaux dossiers. Tout ce qui existait avant la migration est hors de sa portée, par conception." },
      { q: "Les soumissions migrées partent-elles chez mes clients?", a: "Non. Ce sont des brouillons marqués historiques. Rien n'est envoyé à personne." },
    ],
  },
};
