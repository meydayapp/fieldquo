// content/help/fr/getting-started-2.js
//
// Partie 2 de la catégorie « getting-started » en français (voir le
// composeur, getting-started.js). Mêmes slugs, mêmes sections et mêmes blocs
// que la version anglaise, dans le même ordre — le script de vérification
// compare la structure. Les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js ; ce qui est affiché en anglais dans le produit
// (les libellés de la grille d'accès, le bouton de relecture de la visite
// guidée) est cité en anglais et signalé comme tel.
export const ARTICLES = {
  "how-fieldquo-works-for-owners-and-admins": {
    title: "Comment FieldQuo fonctionne pour les propriétaires et les administrateurs",
    summary:
      "Ce que le compte du propriétaire peut faire et que personne d'autre ne peut, comment ajouter des gens et décider ce qu'ils voient, et ce que « Nommer administrateur » donne.",
    updated: "2026-09-12",
    intro: [
      "Le propriétaire, c'est la personne qui a inscrit l'entreprise. Son compte n'a aucune grille d'accès à consulter : chaque écran, chaque réglage, chaque bouton. Cet article porte sur les quelques choses qui vous appartiennent en propre, et sur l'écran — **Gérer l'équipe** — où vous décidez ce que tous les autres reçoivent.",
      "Si vous êtes un associé ou un comptable qui a été nommé administrateur, tout ce qui suit s'applique aussi à vous, à une exception près : la propriété elle-même ne se transfère pas depuis l'application.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Tous les autres membres de votre équipe sont sur l'un des quatre niveaux d'accès — Crew, Estimator, Dispatcher ou Manager — et leur barre latérale ne montre que les lignes permises par ce niveau. La vôtre les montre toutes. La liste ci-dessous, c'est ce qui est caché à tous les niveaux sous le vôtre, Manager compris ; un écran qui n'y figure pas, un Manager le voit aussi." },
          { p: "Masquer une ligne, ce n'est pas la sécurité. Chaque écran et chaque enregistrement sont revérifiés côté serveur avec les mêmes règles ; une personne qui tape une adresse qu'on ne lui a jamais montrée reçoit un refus, pas la page." },
        ],
      },
      {
        id: "only-you",
        heading: "Ce que seul un propriétaire ou un administrateur peut ouvrir",
        blocks: [
          { table: {
            head: ["Écran", "Ce qu'il contient"],
            rows: [
              ["**Forfait** (aussi **Paramètres → Compte et facturation**)", "Votre forfait, son prix, les sièges et les équipiers utilisés, la prochaine date de facturation, **Gérer la facturation et le mode de paiement** et **Annuler le forfait**."],
              ["**Paramètres → Paiements**", "La connexion Stripe par laquelle vos clients paient, avec **Gérer dans Stripe** et **Déconnecter**."],
              ["**Paramètres → Publicités Meta**", "Votre compte publicitaire Facebook et Instagram, les formulaires de prospects et la connexion WhatsApp."],
              ["**Paramètres → Journal d'activité**", "Qui a fait quoi et quand — soumissions envoyées, factures relancées, membres invités, taux de paie modifiés. En lecture seule."],
              ["**Paramètres → Paie**", "La fréquence de paie, les retenues et les composantes obligatoires. Lancer une période de paie vous est aussi réservé."],
              ["**Paramètres → Politiques de congés**", "Les politiques de vacances et de jours de maladie, et le report de fin d'année."],
              ["**Paramètres → Notifications**", "Quand FieldQuo vous envoie un courriel — une grosse soumission, une facture payée, les rappels de rendez-vous."],
              ["**Paramètres → Migration de données**", "Le service payant où FieldQuo importe vos anciennes données — voir [[the-data-migration-service|Le service de migration de données]]."],
              ["**Parrainage**", "Votre lien de parrainage, les entreprises que vous avez recommandées et les mois gratuits gagnés."],
            ],
          } },
          { p: "Trois gestes sont réservés au propriétaire et aux administrateurs, quel que soit l'écran : changer le niveau d'accès d'une personne déjà en place, nommer quelqu'un administrateur, et désactiver quelqu'un. Un Dispatcher ou un Manager peut inviter des gens, mais seulement comme Crew ou Estimator, et seulement avec des réglages qui ne dépassent pas les siens." },
        ],
      },
      {
        id: "manage-team",
        heading: "Comment ajouter quelqu'un et choisir ce qu'il voit",
        blocks: [
          { steps: [
            "Ouvrez **Votre équipe** dans la barre latérale (le même écran que **Paramètres → Gérer l'équipe**). Le panneau du haut montre les **sièges utilisés** par rapport à votre forfait et les **équipiers — inclus gratuitement**.",
            "Appuyez sur **Ajouter un utilisateur** et entrez le nom et le courriel. Choisissez un niveau d'accès : Crew, Estimator, Dispatcher, Manager, ou **Nommer administrateur**. Appuyez sur **Personnalisé…** pour ouvrir la grille et changer un seul réglage.",
            "L'invitation part par courriel. Tant qu'elle n'est pas acceptée, la ligne indique **Invité**, avec **Annuler l’invitation** à côté. Personne ne peut se joindre à votre entreprise sans une de ces invitations.",
            "Pour changer quelqu'un plus tard, changez la liste déroulante sur sa ligne. Choisir un préréglage fixe son palier et toutes ses permissions d'un coup ; la grille s'ouvre si vous voulez ajuster une seule chose, et la ligne indique alors **Personnalisé**.",
          ] },
          { figure: "live:app-settings-team", caption: "Votre équipe — le panneau des sièges, puis une ligne par personne avec son niveau d'accès en liste déroulante." },
          { note: "Une personne au niveau Crew ne coûte rien et n'utilise pas de siège. Estimator, Dispatcher, Manager et les administrateurs sont des sièges complets. **Ajouter un siège** et **Ajouter un équipier — gratuit** se trouvent dans le même panneau." },
          { figure: "harness:access-editor", caption: "L'éditeur d'accès personnalisé — les onze domaines en listes déroulantes et les trois interrupteurs en cases à cocher." },
        ],
      },
      {
        id: "make-administrator",
        heading: "Ce que fait « Nommer administrateur »",
        blocks: [
          { p: "Un administrateur reçoit tout ce que vous avez, sauf la propriété : le forfait et la carte, Stripe, la paie, le journal d'activité, et le pouvoir de changer l'accès de n'importe qui d'autre. Ça existe pour un associé ou un comptable qui a vraiment besoin des écrans d'argent." },
          { warning: "Ne l'utilisez pas pour du personnel qui doit seulement faire rouler la journée. Le niveau Manager crée, modifie et supprime déjà les soumissions, les chantiers, les factures et les clients, publie l'horaire, approuve les heures et encaisse les paiements — tout sauf la paie et la facturation de l'entreprise." },
        ],
      },
      {
        id: "your-week",
        heading: "Les écrans où un propriétaire passe vraiment son temps",
        blocks: [
          { bullets: [
            "**Accueil** — la liste **En attente de vous** : la facture en retard avec **Relancer le paiement**, les estimations instantanées qui attendent qu'un prix soit approuvé, le prochain rendez-vous. Voir [[the-dashboard|Le tableau de bord]].",
            "**Révisions de devis** — rien de ce qu'un algorithme a chiffré n'atteint un client tant que vous ou un gestionnaire n'avez pas appuyé sur **Approuver**.",
            "**Feuilles de temps**, **Congés** et **Attribuer les quarts** — approuver les heures, approuver les congés, publier la semaine. Un Dispatcher ou un Manager peut faire les trois à votre place.",
            "**Paramètres → Journal d'activité** — la réponse à « qui a changé ça ? ».",
            "**Forfait** — une fois par mois, pour vérifier les sièges avant d'inviter quelqu'un.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Je peux donner tout sauf l'argent à mon gérant de bureau ?", a: "Oui — c'est le niveau Manager. Il gère les soumissions, les chantiers, les factures, les clients, l'horaire et les dépenses, et vous laisse la paie et la facturation de l'entreprise." },
      { q: "Quelqu'un peut-il se joindre à mon entreprise par lui-même ?", a: "Non. Une nouvelle personne n'entre que par une invitation depuis Votre équipe. S'inscrire sur le site public crée une entreprise distincte, jamais un siège dans la vôtre." },
      { q: "Je peux céder la propriété à quelqu'un d'autre ?", a: "Pas depuis l'application. Nommez la personne administrateur, ce qui lui donne tout sauf la propriété, et écrivez-nous si la propriété elle-même doit changer de mains." },
      { q: "Un accès Crew coûte-t-il quelque chose ?", a: "Non. Les équipiers sont inclus gratuitement dans chaque forfait — cinq sur Solo, huit sur Crew, onze sur Shop, quinze sur Scale — et n'utilisent jamais de siège." },
    ],
  },

  "how-fieldquo-works-for-dispatchers": {
    title: "Comment FieldQuo fonctionne pour les répartiteurs et les gestionnaires",
    summary:
      "Les deux niveaux qui font rouler la semaine de l'équipe — ce qu'un Dispatcher peut et ne peut pas faire, ce qu'un Manager ajoute, et les écrans où la semaine se passe vraiment.",
    updated: "2026-09-12",
    intro: [
      "Dispatcher et Manager sont les deux niveaux d'accès pour les gens qui dirigent d'autres gens. Les deux voient l'horaire et les heures de tout le monde, les deux peuvent inviter des équipiers, et les deux ont tous les réglages dont un atelier a besoin au quotidien. La différence, c'est la suppression et l'argent : un Manager peut supprimer des fiches, voir les coûts de chantier et encaisser des paiements ; un Dispatcher ne peut faire aucun des trois.",
      "Si votre ligne dans **Votre équipe** indique Dispatcher ou Manager, cet article explique ce que votre barre latérale vous montre, et pourquoi.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le niveau Dispatcher est fait pour le chef d'équipe qui réserve les gars, déplace les visites et tient la semaine à jour, sans le pouvoir de rien effacer. Le niveau Manager, c'est le gérant de bureau ou l'associé qui dirige les opérations — tout sauf la paie et la facturation de l'entreprise, qui restent au propriétaire." },
          { p: "Les deux niveaux partagent le même palier, donc les mêmes écrans apparaissent dans la barre latérale pour les deux. La différence est à l'intérieur de ces écrans : ce qu'un bouton fait quand on appuie dessus, et si un contrôle de suppression est là ou non." },
        ],
      },
      {
        id: "dispatcher-vs-manager",
        heading: "Dispatcher contre Manager, domaine par domaine",
        blocks: [
          { table: {
            head: ["Domaine", "Dispatcher", "Manager"],
            rows: [
              ["Horaire", "Modifier l'horaire de tout le monde", "Modifier et supprimer l'horaire de tout le monde"],
              ["Temps et feuilles de temps", "Voir, enregistrer, modifier et supprimer celles de tout le monde", "Voir, enregistrer, modifier et supprimer celles de tout le monde"],
              ["Soumissions, chantiers, factures, prospects", "Voir, créer et modifier", "Voir, créer, modifier et supprimer"],
              ["Clients", "Voir et modifier la fiche complète", "Voir, modifier et supprimer la fiche complète"],
              ["Notes", "Voir et modifier toutes les notes", "Voir, modifier et supprimer toutes les notes"],
              ["Dépenses", "Les siennes seulement", "Celles de tout le monde — et les écrans **Dépenses** et **Achats**"],
              ["Incidents de sécurité", "Voir ceux de tout le monde et faire le suivi", "Voir ceux de tout le monde et faire le suivi"],
              ["Voir les prix", "Oui", "Oui"],
              ["Coûts de chantier", "Non", "Oui — le chiffré contre le réel, **KPI**, **Frais généraux**, **Coût des matériaux**"],
              ["Encaisser des paiements", "Non", "Oui"],
              ["Paie", "Ses propres fiches de paie", "Ses propres fiches de paie"],
            ],
          } },
          { p: "Chaque ligne est un réglage que le propriétaire peut changer après coup. Si votre ligne indique **Personnalisé**, l'un d'eux a été ajusté, et le tableau est un point de départ plutôt que votre grille exacte." },
        ],
      },
      {
        id: "the-week",
        heading: "Comment la semaine se déroule depuis ces deux niveaux",
        blocks: [
          { steps: [
            "**Attribuer les quarts** — la semaine de l'équipe en sept cartes-jours. **Ajouter un quart** place une personne sur un chantier avec des heures et une note. Les quarts restent en brouillon, invisibles pour l'équipe, jusqu'à ce que vous appuyiez sur **Publier la semaine**.",
            "**Feuilles de temps** — une ligne par pointage. Un pointage fait loin du chantier est signalé en ambre. Appuyez sur **Approuver** sur les heures avant qu'elles n'atteignent une période de paie ; **Ajouter une entrée** enregistre un pointage oublié.",
            "**Congés** — l'onglet **Équipe** liste les demandes en attente d'approbation avec **Approuver** et **Refuser**, qui est en congé prochainement, et les soldes de tout le monde.",
            "**Révisions de devis** — les estimations instantanées de votre site web atterrissent ici ; un Dispatcher ou un Manager est le niveau le plus bas autorisé à appuyer sur **Approuver** et à laisser partir le prix.",
            "**Votre équipe** — appuyez sur **Ajouter un utilisateur** pour inviter quelqu'un. On ne peut donner que ce qu'on détient : Crew ou Estimator, avec des réglages qui ne dépassent pas les vôtres.",
          ] },
          { figure: "live:app-scheduler", caption: "Attribuer les quarts — la semaine en cartes-jours, Ajouter un quart et Publier la semaine." },
          { figure: "live:app-settings-team-timesheets", caption: "Feuilles de temps — chaque pointage avec ses heures et un bouton Approuver." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "Ce qu'aucun des deux niveaux ne peut faire",
        blocks: [
          { bullets: [
            "Ouvrir **Forfait** ou **Paramètres → Compte et facturation**, **Parrainage**, **Migration de données**, **Journal d'activité**, **Politiques de congés**, **Notifications**, **Paiements**, **Publicités Meta** ou **Paramètres → Paie**. Ces lignes ne sont pas dans votre barre latérale, et les pages vous refusent si vous tapez l'adresse.",
            "Lancer une période de paie ou voir la fiche de paie de quelqu'un d'autre. **Paie** dans la barre latérale montre vos propres fiches seulement.",
            "Changer l'accès d'une personne déjà en place, nommer quelqu'un administrateur, ou désactiver quelqu'un.",
            "Inviter un Dispatcher ou un Manager. **Ajouter un utilisateur** propose Crew et Estimator seulement.",
          ] },
          { tip: "Si vous êtes Dispatcher et que vous butez sans cesse sur un bouton de suppression absent ou un bloc **Coût et marge** caché, la solution tient en une liste déroulante : demandez au propriétaire de passer votre ligne à Manager." },
        ],
      },
      {
        id: "settings-you-can-reach",
        heading: "Les réglages que vous pouvez changer",
        blocks: [
          { p: "Les deux niveaux peuvent ouvrir et modifier **Profil de l'entreprise**, **Image de marque**, **Page de rendez-vous**, **Zones desservies**, **Champs personnalisés**, **Tarifs des armoires**, les modèles (**Courriel de soumission**, **Modèles de courriel**, **Modèles PDF**, **Traductions**, **Listes de vérification**, **Étiquettes des photos de chantier**), **Messages aux clients**, **Relances**, **Domaine d'envoi**, **Crédit IA**, et chaque ligne côté client — **Votre site web**, **Soumissions instantanées**, **Partager vos liens**, **Lien de profil**, **Réceptionniste téléphonique**, **Employé IA**, **Avis**. Un Manager voit en plus **Coût des matériaux** et **Frais généraux**, parce que les deux exigent les coûts de chantier. Les deux niveaux peuvent lire **Produits et services**, **Services et tarifs** et **Soumissions instantanées**, mais y changer un tarif est réservé au propriétaire ou à un administrateur." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi je peux modifier une facture mais pas la supprimer ?", a: "Vous êtes Dispatcher. La suppression des soumissions, chantiers, factures, prospects et clients, c'est le niveau Manager. Annuler ou archiver un chantier est un changement de statut, pas une suppression, et vous y avez droit." },
      { q: "Pourquoi l'équipe ne voit pas les quarts que j'ai ajoutés ?", a: "Les quarts sont des brouillons tant que vous n'avez pas appuyé sur Publier la semaine. L'équipe ne voit jamais que les quarts publiés." },
      { q: "Je peux voir ce qu'un chantier a rapporté ?", a: "Seulement au niveau Manager, où les coûts de chantier sont activés. Un Dispatcher voit la soumission et les heures, jamais le coût de main-d'œuvre ni la marge." },
      { q: "Je peux ajouter un deuxième répartiteur ?", a: "Pas vous-même — Ajouter un utilisateur vous propose Crew et Estimator. Demandez au propriétaire ou à un administrateur." },
    ],
  },

  "how-fieldquo-works-for-estimators": {
    title: "Comment FieldQuo fonctionne pour les estimateurs et les vendeurs",
    summary:
      "Le niveau Estimator : rédiger et envoyer des soumissions avec les prix, gérer les clients, consulter les chantiers et les factures — et ce qui reste au bureau.",
    updated: "2026-09-12",
    intro: [
      "Le niveau Estimator est pour la personne qui chiffre et envoie le travail sans diriger l'atelier : un vendeur, un deuxième estimateur, l'associé du propriétaire qui fait les visites de chantier. C'est le niveau qui transforme un prospect en soumission et la fait signer.",
      "C'est un siège payant, parce qu'il peut créer des soumissions et voir tous les prix. Ce n'est volontairement pas un niveau de gestion : pas de personnel, pas de paie au-delà de vos propres fiches, pas de coûts de chantier.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un Estimator peut créer et modifier des prospects et des soumissions, ajouter et modifier des clients, lire toutes les notes, et voir — sans les changer — les chantiers et les factures. Les prix sont visibles. Le coût et la marge ne le sont pas, exprès : un estimateur qui voit le plancher peut escompter jusqu'au plancher." },
          { p: "Votre propre horaire, votre propre temps, vos propres dépenses. Vous pouvez signaler un incident de sécurité et voir ceux que vous avez signalés." },
        ],
      },
      {
        id: "what-you-can-do",
        heading: "Ce que vous pouvez faire",
        blocks: [
          { bullets: [
            "**Prospects** — le tableau des demandes venues de votre site web, de votre lien de réservation, de la réceptionniste et des recommandations. Déplacez une carte, notez-la, et transformez-la en soumission.",
            "**Soumissions** — **Nouvelle soumission** ouvre le constructeur. Les lignes viennent du catalogue de prix, les photos s'attachent, la soumission garde la langue dans laquelle elle a été créée, et **Envoyer** l'expédie par courriel au nom de votre entreprise.",
            "**Clients** et **Équipement client** — les fiches complètes, et la liste d'appels des garanties.",
            "**Réceptionniste** — les appels pris par l'agent téléphonique, avec **Rédiger une soumission à partir de cet appel**.",
            "**Analyses** et **Paramètres → Produits et services**, **Services et tarifs**, **Soumissions instantanées** — le catalogue de prix, les types de soumission et leurs tarifs. Vous pouvez les lire ; changer un tarif est réservé au propriétaire ou à un administrateur.",
            "**Calendrier**, **À faire**, **Clavardage**, **Pointeuse**, **Congés**, **Sécurité**, et vos propres fiches de paie sous **Paie**.",
          ] },
        ],
      },
      {
        id: "your-day",
        heading: "D'un prospect à une soumission signée",
        blocks: [
          { steps: [
            "Ouvrez **Prospects**. Une nouvelle demande se trouve dans la colonne des nouveaux avec une note Chaud, Tiède ou Froid. Ouvrez la carte.",
            "Convertissez-la — le client et l'adresse passent dans une nouvelle soumission.",
            "Bâtissez la soumission à partir du catalogue de prix, groupez-la par pièce ou par portée si le chantier est gros, attachez des photos, et ajoutez les extras optionnels que le client pourra cocher.",
            "Appuyez sur **Envoyer**. Le client reçoit un courriel dans sa langue, ouvre la page d'approbation, coche les extras qu'il veut, signe, et paie l'acompte si vous en avez demandé un.",
            "La soumission passe à **Acceptée**. La transformer en chantier planifié est la prochaine étape du répartiteur ou du gestionnaire — voir [[convert-a-quote-to-a-job|Ce qui se passe quand une soumission est approuvée]].",
          ] },
          { figure: "live:app-quotes", caption: "Soumissions — les puces de statut, la recherche, et la liste avec numéro, statut, client, montant et âge." },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "Ce qui reste au bureau",
        blocks: [
          { bullets: [
            "**Chantiers** et **Factures** sont en lecture seule. L'écran le dit quand vous essayez : « Votre niveau d'accès vous permet de consulter les chantiers, pas d'en créer. Demandez à un propriétaire ou à un administrateur s'il vous en faut un. »",
            "Vous ne pouvez pas transformer une soumission en chantier, assigner une soumission à quelqu'un d'autre, ni approuver une estimation instantanée — **Révisions de devis** n'est pas dans votre barre latérale.",
            "Pas de bloc **Coût et marge** sur une soumission, pas de **Dépenses**, **Achats**, **KPI**, **Frais généraux** ni **Coût des matériaux**.",
            "Pas de **Votre équipe**, **Calendrier de l'équipe**, **Feuilles de temps**, **Sous-traitants**, **Véhicules**, **Marketing**, **Créateur** ni **Funnels** — c'est le palier Dispatcher et plus.",
            "Pas d'encaissement : enregistrer un paiement sur une facture revient à un Manager, à un administrateur ou au propriétaire.",
          ] },
          { note: "Tout ce qui précède est un réglage que le propriétaire peut changer. Si votre ligne dans Votre équipe indique Personnalisé, votre grille diffère de cet article quelque part." },
        ],
      },
      {
        id: "who-sets-it",
        heading: "Qui décide de ça",
        blocks: [
          { p: "Le propriétaire ou un administrateur choisit le niveau dans **Votre équipe** — Estimator est l'un des cinq choix de la liste déroulante — et peut ouvrir **Personnalisé…** pour vous donner une chose de plus sans vous promouvoir Dispatcher. Un Dispatcher ou un Manager peut aussi inviter un Estimator, mais ne peut pas en changer un après coup." },
        ],
      },
    ],
    faq: [
      { q: "Je peux voir ce que l'entreprise a chargé l'an dernier pour le même travail ?", a: "Oui — chaque ancienne soumission est dans Soumissions avec ses prix, et FieldQuo IA répond à des questions comme « quelle est la valeur moyenne de mes soumissions ce mois-ci ? » à partir des mêmes fiches." },
      { q: "Pourquoi il n'y a pas de marge sur ma soumission ?", a: "Les coûts de chantier sont désactivés au niveau Estimator, par conception. Le propriétaire peut les activer pour vous dans l'éditeur d'accès personnalisé." },
      { q: "Je peux réserver la visite de chantier moi-même ?", a: "Oui. Calendrier et Nouveau rendez-vous vous sont ouverts, tout comme votre propre horaire. Assigner une visite à quelqu'un d'autre est un geste de répartiteur." },
    ],
  },

  "how-fieldquo-works-for-crew": {
    title: "Comment FieldQuo fonctionne pour l'équipe",
    summary:
      "Un accès Crew est gratuit et montre à la personne dans le camion sa journée — chantiers, quarts, pointeuse, clavardage, congés — et aucun prix, aucune soumission, aucune facture.",
    updated: "2026-09-12",
    intro: [
      "Crew, c'est le niveau d'accès des installateurs et des aides : les gens qui roulent jusqu'à l'adresse, font le travail et pointent leur sortie. Il ne coûte rien, n'utilise pas de siège, et ne montre que ce dont la journée a besoin. Rien là-dedans ne porte de prix.",
      "Cet article décrit ce qu'un accès Crew voit, sur le téléphone comme sur un portable, et ce qu'il ne verra jamais, même en cherchant.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La description du niveau par le produit lui-même : voir son horaire, les chantiers qui lui sont assignés et quoi acheter pour eux ; marquer le travail terminé et suivre son temps ; aucun prix, aucune soumission, aucune facture, aucune demande. Chaque partie de cette phrase est appliquée côté serveur, pas seulement dans le menu." },
          { p: "Les chantiers sont en lecture seule et limités à ceux où vous avez une visite. Le nom et l'adresse du client sont là parce que vous devez vous y rendre ; le reste de la fiche client n'y est pas." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Ce qu'il y a dans votre barre latérale, et ce que vous pouvez y faire",
        blocks: [
          { table: {
            head: ["Écran", "Ce que vous pouvez faire"],
            rows: [
              ["**Chantiers**", "Ouvrir les chantiers où vous êtes réservé : adresse, visites, notes, la liste de vérification, la liste de quoi acheter. Marquer le travail terminé."],
              ["**Calendrier** et **À faire**", "Vos visites et les tâches qui vous sont assignées, y compris celles qui exigent des photos."],
              ["**Attribuer les quarts**", "Vos propres quarts publiés — rien n'apparaît tant que le bureau n'a pas appuyé sur Publier la semaine."],
              ["**Pointeuse**", "**Pointer l'entrée** sur un chantier, **Pointer la sortie**, changer de chantier en cours de journée. Le total de vos heures du jour en dessous."],
              ["**Congés**", "Vos soldes, **Demander un congé**, et retirer une demande en attente."],
              ["**Sécurité**", "**Signaler** une blessure ou un quasi-accident, et voir ceux que vous avez signalés."],
              ["**Clavardage**", "#general avec toute l'équipe, une salle pour chaque chantier où vous êtes, des messages directs."],
              ["**Paie**", "Vos propres fiches de paie. Celles de personne d'autre."],
              ["**FieldQuo IA**", "Des questions sur votre horaire — « quels travaux sont prévus cette semaine ? » — et rien qui touche à l'argent."],
              ["**Paramètres**", "Trois lignes : **Langue**, **Disponibilités** (vos propres heures) et **Nouveautés**."],
            ],
          } },
        ],
      },
      {
        id: "a-day",
        heading: "Une journée sur un accès Crew",
        blocks: [
          { steps: [
            "Ouvrez FieldQuo sur votre téléphone. La barre d'onglets montre **Chantiers**, **Clavardage** et **Plus** ; les onglets de pipeline que le bureau utilise n'y sont pas pour vous.",
            "Ouvrez **Chantiers**, touchez le chantier du jour, et lisez les notes de visite et la liste de vérification.",
            "Ouvrez **Pointeuse** et appuyez sur **Pointer l'entrée**. La pastille indique **En service** et le chronomètre tourne sur ce chantier.",
            "Les photos : prenez-les depuis la page du chantier, ou textez-les au numéro de l'équipe et elles se classent toutes seules — voir [[text-a-photo-to-the-crew-inbox|Texter une photo sans application]].",
            "Appuyez sur **Pointer la sortie**. Si vous avez oublié, vous pouvez corriger vos propres heures sur l'entrée ; une entrée que vous modifiez vous-même repasse en attente pour que le bureau la revérifie.",
          ] },
          { figure: "live:app-clock", caption: "Pointeuse — l'heure en direct, En service, le temps écoulé, le chantier, et Pointer la sortie." },
        ],
      },
      {
        id: "what-you-never-see",
        heading: "Ce qu'un accès Crew ne montre jamais",
        blocks: [
          { bullets: [
            "Pas de **Prospects**, **Soumissions** ni **Factures** — les lignes sont absentes et les pages refusent.",
            "Pas de liste **Clients**. Un nom et une adresse sur votre propre chantier, ce n'est pas le carnet de clients de l'entreprise.",
            "Aucun prix nulle part : ni sur un chantier, ni dans le clavardage, ni de la part de FieldQuo IA.",
            "Pas de **Votre équipe**, de **Feuilles de temps** (le bureau y révise vos heures), de **Dépenses** au-delà des vôtres, d'**Analyses**, de **Marketing**.",
            "Aucun réglage sauf votre langue, vos heures et les nouveautés.",
          ] },
          { note: "Le propriétaire peut monter n'importe quel réglage pour une seule personne dans l'éditeur d'accès personnalisé sans la sortir du niveau gratuit — jusqu'à ce que la grille accorde quelque chose qui en fait un siège, comme créer des soumissions." },
        ],
      },
    ],
    faq: [
      { q: "Je dois installer une application ?", a: "Non. FieldQuo tourne dans le navigateur du téléphone ; ajoutez-le à l'écran d'accueil et il s'ouvre comme une application. Voir [[install-it-like-an-app|L'installer comme une application]]." },
      { q: "Pourquoi je ne vois pas le quart de demain ?", a: "Le bureau n'a pas encore publié la semaine. Les quarts sont des brouillons tant que Publier la semaine n'a pas été pressé." },
      { q: "Je peux voir à combien le chantier a été soumissionné ?", a: "Non. Un accès Crew ne porte aucun prix, et une fiche de chantier n'a pas d'argent dessus à ce niveau." },
    ],
  },

  "fieldquo-ai-ask-about-your-business": {
    title: "FieldQuo IA : posez des questions sur votre propre entreprise",
    summary:
      "Un assistant qui répond à partir des soumissions, factures, clients et horaires de votre propre entreprise, refuse tout le reste, et fonctionne à l'intérieur d'un quota mensuel.",
    updated: "2026-09-12",
    intro: [
      "**FieldQuo IA** est la deuxième ligne de la barre latérale. Vous tapez une question — « quels clients n'ont pas encore été facturés ? » — et il cherche la réponse dans les fiches de votre entreprise au lieu de deviner. Il peut aussi rédiger un message client avec les vrais chiffres dedans.",
      "Il ne répond qu'à propos de votre entreprise. Si on lui demande une recette ou une dissertation, il refuse en une phrase et dit ce qu'il peut faire à la place. Il ne voit jamais les données d'une autre entreprise, et jamais plus des vôtres que votre niveau d'accès ne le permet.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Sous le titre, l'écran dit : « Posez des questions sur vos propres soumissions, factures, clients et coûts de matériaux. Il consulte des chiffres réels au lieu de deviner. » Une nouvelle conversation affiche **Essayez de demander** avec quatre questions à toucher, et une boîte qui indique **Posez une question sur votre entreprise…** avec un bouton **Envoyer**." },
          { figure: "live:app-copilot", caption: "FieldQuo IA — une conversation vide avec les suggestions Essayez de demander et la boîte de question." },
          { p: "Chaque réponse vient d'une consultation de votre propre base de données — jamais de ce que le modèle retient des entrepreneurs en général. Si une consultation ne retourne rien, il dit qu'il n'y a pas encore assez de données plutôt que de combler le vide." },
        ],
      },
      {
        id: "what-it-can-look-up",
        heading: "Ce qu'il peut consulter",
        blocks: [
          { table: {
            head: ["Demandez sur", "Ce qu'il lit"],
            rows: [
              ["Le taux de conversion", "Le taux soumission-acceptation sur une période récente."],
              ["Les meilleurs clients", "Qui a payé le plus, d'après les factures payées."],
              ["Les flux de trésorerie", "L'argent entré contre les dépenses sur les derniers mois."],
              ["Le revenu par catégorie", "Le revenu des soumissions acceptées par catégorie de service."],
              ["Les clients fidèles", "Combien de clients sont revenus."],
              ["Le travail à venir", "Les chantiers planifiés dans les N prochains jours, avec les notes de visite et les notes de la soumission liée."],
              ["Une soumission ou une facture", "Trouvée par numéro ou par nom de client : notes, lignes, et si des photos sont attachées."],
              ["Un chantier", "Les notes et le nombre de photos de chaque visite, les heures pointées, la soumission et les factures — et, avec les coûts de chantier, la main-d'œuvre à date contre le total soumissionné."],
              ["Un brouillon de message", "Une relance de soumission, un rappel de paiement, une mise à jour de chantier, rédigés prêts à envoyer, avec le vrai numéro de facture et le vrai montant."],
            ],
          } },
          { note: "Il n'existe pas aujourd'hui de consultation des coûts de matériaux, même si le sous-titre de l'écran les nomme. Une question sur les coûts de matériaux reçoit un simple « je ne peux pas consulter ça ici »." },
        ],
      },
      {
        id: "what-it-declines",
        heading: "Ce qu'il refuse",
        blocks: [
          { bullets: [
            "Les demandes générales — programmation, recettes, devoirs, culture générale. Une phrase, pas de sermon.",
            "Tout ce pour quoi il n'a pas de consultation. Il le dit et nomme qui peut aider ; il n'estime pas la réponse à partir d'autre chose.",
            "Tout chiffre que votre niveau d'accès cache. Les consultations sont filtrées par votre grille avant que la conversation commence ; une personne sans **See prices** n'apprend jamais le total d'une facture — ni même qu'elle existe.",
          ] },
        ],
      },
      {
        id: "the-monthly-allowance",
        heading: "Le quota mensuel",
        blocks: [
          { p: "FieldQuo IA est inclus dans chaque forfait ; il n'y a rien à acheter. Chaque entreprise a un quota mensuel partagé par tout ce que l'IA fait pour vous — cet assistant, la révision de soumission, les textes du constructeur de site, les brouillons de l'employé IA. À 80 %, l'écran affiche un avertissement : « Vous avez utilisé {pct} % de votre quota FieldQuo AI de ce mois-ci. »" },
          { p: "Quand il est épuisé, la boîte de question est désactivée et l'écran indique **Le quota FieldQuo AI de ce mois-ci est épuisé.** Il est remis à zéro au début du mois prochain, et tout le reste de FieldQuo continue de fonctionner normalement. Acheter du crédit IA dans **Paramètres → Crédit IA** ne l'augmente pas — ce crédit sert aux minutes téléphoniques et aux images IA ; écrivez-nous s'il vous faut un quota plus élevé." },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Tout le monde dans l'équipe a la ligne. Ce que chacun peut demander suit son niveau d'accès : un accès Crew n'a que les consultations d'horaire, donc ses suggestions **Essayez de demander** sont « Quels travaux sont prévus cette semaine ? » et « À quels projets suis-je assigné ? ». Les flux de trésorerie exigent le niveau « dépenses de tout le monde » ; la main-d'œuvre d'un chantier exige les coûts de chantier. Il répond dans la langue dans laquelle vous utilisez l'application." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Pourquoi cet article est classé sous « Seulement dans FieldQuo »",
        blocks: [
          { p: "Des cinq pages de tarifs auxquelles FieldQuo se compare — Jobber, Housecall Pro, ServiceTitan, Projul et QuoteIQ — quatre ne listent, à aucun palier, aucun assistant qui répond à partir de vos propres chiffres. Housecall Pro liste « AI team members » sur chaque forfait, une formule qui couvre aussi son IA de réponse aux appels. C'est toute la prétention : absent de leur page de tarifs, jamais « ils ne peuvent pas le faire »." },
        ],
      },
    ],
    faq: [
      { q: "Voit-il les données d'autres entreprises ?", a: "Jamais. L'entreprise est fixée côté serveur avant qu'une consultation ne s'exécute, et le modèle ne peut pas la changer, peu importe comment la question est formulée." },
      { q: "Peut-il modifier une soumission ou envoyer un courriel ?", a: "Non. Chaque consultation est en lecture seule. Il rédige un brouillon de message pour vous ; l'envoyer, c'est votre clic." },
      { q: "Est-ce la même chose que l'employé IA ou la réceptionniste téléphonique ?", a: "Non. Ceux-là parlent à vos clients et se configurent dans Paramètres. FieldQuo IA vous parle à vous, de vos propres fiches. Ils partagent le même quota mensuel." },
      { q: "Va-t-il inventer un chiffre ?", a: "Il a l'instruction de ne pas le faire, et il n'en a pas le moyen : il n'a aucun chiffre sauf ceux que les consultations retournent. Si un chiffre n'est pas là, il le dit." },
    ],
  },

  "replay-the-setup-walkthrough": {
    title: "Rejouer la visite guidée de configuration",
    summary:
      "La visite guidée en cinq étapes qui accueille un nouveau compte, ce qu'elle pointe, et comment la rejouer depuis l'écran Aide.",
    updated: "2026-09-12",
    intro: [
      "La première fois que vous arrivez sur **Accueil**, FieldQuo lance une courte visite guidée : cinq cartes, chacune pointant une ligne de la barre latérale. Elle s'affiche une fois par personne et ne revient jamais d'elle-même. Si vous l'avez passée, ou si vous voulez la montrer à quelqu'un qui regarde par-dessus votre épaule, vous pouvez la rejouer depuis **Aide**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La visite guidée est dans la langue dans laquelle vous utilisez l'application, et chaque carte porte **Passer**, un compteur d'étapes (« 2 sur 5 ») et **Suivant** — **Terminé** sur la dernière. Sur un téléphone, elle ouvre elle-même le tiroir de la barre latérale pour pointer la ligne." },
        ],
      },
      {
        id: "the-five-steps",
        heading: "Les cinq étapes",
        blocks: [
          { table: {
            head: ["Étape", "Pointe", "Ce qu'elle dit"],
            rows: [
              ["1", "**Prospects**", "Les prospects arrivent ici — chaque demande venant de votre site, de votre page de réservation ou d'une estimation instantanée. Le début du pipeline."],
              ["2", "**Soumissions**", "Transformez-les en soumissions — préparez une soumission à votre image, envoyez-la, faites-vous approuver et payer."],
              ["3", "**Révisions de devis**", "Estimations instantanées à approuver — le prix instantané obtenu par un client atterrit ici pour que vous le confirmiez avant qu'il devienne officiel."],
              ["4", "**FieldQuo IA**", "Posez vos questions à FieldQuo IA — des questions sur vos propres chiffres, avec une réponse tirée de vos données."],
              ["5", "**Paramètres**", "Configurez votre entreprise — l'image de marque, les services, les prix, les paiements et vos tarifs d'estimation instantanée. Ça vaut dix minutes au départ."],
            ],
          } },
        ],
      },
      {
        id: "how-to-replay",
        heading: "Comment la rejouer",
        blocks: [
          { steps: [
            "Ouvrez **Aide** au bas de la barre latérale.",
            "Appuyez sur **Replay the setup walkthrough** — la carte sous la boîte de recherche, affichée en anglais ; sa deuxième ligne annonce la visite guidée rapide de l'application, depuis le début.",
            "FieldQuo oublie que vous avez vu la visite de bienvenue et vous amène à **Accueil**, où elle recommence à l'étape 1.",
          ] },
          { figure: "live:app-help", caption: "Aide — la boîte de recherche, la carte de relecture de la visite guidée, et les articles par sujet." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Ce que la relecture change",
        blocks: [
          { bullets: [
            "Elle remet à zéro la visite de bienvenue pour **vous seulement**. Celle d'un collègue n'est pas touchée.",
            "Seule la visite de bienvenue est remise à zéro. Les courtes visites des autres écrans — Prospects, Soumissions, Chantiers, Factures, Horaire et le reste — se jouent chacune une fois, d'elles-mêmes, la première fois que vous ouvrez la page, et restent vues.",
            "Rien ne change dans votre entreprise. C'est une note par personne qui dit « pas encore vue »." ,
          ] },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la visite guidée n'est pas apparue pour un nouveau membre de l'équipe ?", a: "Elle se lance la première fois que chaque personne arrive sur Accueil. Si elle est allée directement à une autre page depuis l'invitation, la visite attend sa première venue sur Accueil." },
      { q: "Je peux désactiver les visites pour tout le monde ?", a: "Non. Chaque visite s'affiche une fois par personne et s'enregistre comme vue ; il n'y a pas d'interrupteur pour toute l'entreprise." },
    ],
  },

  "how-to-get-help": {
    title: "Comment obtenir de l'aide",
    summary:
      "Où sont les réponses — l'écran Aide dans l'application, le centre d'aide public en trois langues, et comment joindre une personne chez FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "La plupart des questions trouvent réponse sur l'écran où vous êtes : chaque ligne de la barre latérale et chaque ligne des Paramètres a son article, dans votre langue, avec l'écran réel dedans. Quand ça ne suffit pas, il y a une adresse qui joint une personne, et une façon en lecture seule pour cette personne de regarder votre compte avec vous.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Trois couches. **Aide** dans la barre latérale est le centre d'aide intégré. Le centre d'aide public, ce sont les mêmes articles, en anglais, en français et en espagnol, accessibles sans se connecter — c'est pourquoi vous pouvez envoyer un lien à un collègue dès sa première journée. Et le soutien de FieldQuo se fait par courriel ; il n'y a ni ligne téléphonique, ni clavardage en direct, ni formulaire de billet dans l'application." },
        ],
      },
      {
        id: "help-in-the-app",
        heading: "L'écran Aide dans l'application",
        blocks: [
          { steps: [
            "Ouvrez **Aide** au bas de la barre latérale. Le titre indique **Centre d'aide**, avec une boîte de recherche en dessous.",
            "**Le guide de chaque écran** — le panneau du haut — liste chaque ligne de la barre latérale et des Paramètres que vous pouvez voir. Chaque nom ouvre l'article de cet écran dans le centre d'aide public, dans votre langue, dans un nouvel onglet. **Ouvrir le centre d'aide** vous amène à sa page d'accueil.",
            "En dessous, la carte de relecture de la visite guidée relance la visite de bienvenue — voir [[replay-the-setup-walkthrough|Rejouer la visite guidée de configuration]].",
            "Plus bas, les articles intégrés par sujet — démarrage, soumissions et facturation, chantiers et clients, dépannage, et ainsi de suite. Ils s'ouvrent sur place.",
          ] },
          { figure: "live:app-help", caption: "Aide — Le guide de chaque écran, puis la carte de la visite guidée et les articles intégrés." },
          { note: "Les articles intégrés sont en anglais seulement aujourd'hui. Les articles derrière Le guide de chaque écran — ce centre d'aide — sont ceux qui sont écrits en français et en espagnol." },
        ],
      },
      {
        id: "the-public-help-centre",
        heading: "Le centre d'aide public",
        blocks: [
          { p: "Ce site. Des articles en anglais, en français et en espagnol, groupés par catégorie, avec une boîte de recherche et une image de l'écran réel partout où il en existe une. Si vous utilisez l'application dans une autre langue, vous obtenez l'article en anglais avec un avis en haut qui le dit." },
          { p: "Au bas de chaque article, un vote « Cet article vous a-t-il aidé ? ». Il enregistre l'article et la réponse, rien d'autre — pas de nom, pas de courriel, pas de texte libre — alors servez-vous-en librement." },
        ],
      },
      {
        id: "reach-a-person",
        heading: "Comment joindre une personne chez FieldQuo",
        blocks: [
          { bullets: [
            "Écrivez à **hello@fieldquo.com**. Mettez le nom de votre entreprise dans l'objet et, si ça concerne un numéro ou un domaine, le numéro ou le domaine — un message qu'on peut situer à la première lecture reçoit sa réponse à la première lecture.",
            "La page **Contact Us** du site public — nom, courriel, message — joint les mêmes personnes. Elle est en anglais et confirme par « Thanks for reaching out — we'll get back to you shortly. »",
            "L'écran des réglages **Réceptionniste téléphonique** mène directement à cette adresse, objet déjà rempli, quand un numéro est bloqué ; les autres écrans qui disent « écrivez-nous » parlent de la même adresse.",
          ] },
          { p: "Dites ce que vous faisiez, ce que l'écran affichait (la phrase exacte), et le numéro de soumission ou de facture s'il y en a un. Une capture d'écran d'un message rouge épargne un aller-retour." },
        ],
      },
      {
        id: "what-support-can-see",
        heading: "Ce que le soutien peut voir quand il regarde votre compte",
        blocks: [
          { p: "Une personne du soutien FieldQuo peut ouvrir une vue en lecture seule de votre compte pour examiner un problème avec vous. La lecture seule est appliquée deux fois côté serveur : rien ne peut être créé, modifié, envoyé ou supprimé depuis cette session, et elle ne peut pas écrire dans votre clavardage. Chaque session de ce genre est journalisée, et tout ce qu'elle touche apparaît dans **Paramètres → Journal d'activité** avec la mention **session d'assistance**." },
          { p: "Le soutien vous guide dans un changement ou vous demande de le faire ; il ne le fera jamais à votre place. La seule exception sanctionnée est le service de migration payant, où FieldQuo crée les nouvelles fiches que vous avez demandées — voir [[the-data-migration-service|Le service de migration de données]]." },
        ],
      },
    ],
    faq: [
      { q: "Y a-t-il un numéro de téléphone pour le soutien ?", a: "Non. Le soutien se fait par courriel à hello@fieldquo.com, ou par la page Contact Us." },
      { q: "Le soutien peut-il changer quelque chose dans mon compte pour moi ?", a: "Non. L'accès du soutien est en lecture seule et le reste. On vous guidera pas à pas." },
      { q: "Où est-ce que je vois les nouveautés de FieldQuo ?", a: "Paramètres → Nouveautés est un journal des changements daté. Chaque niveau d'accès peut l'ouvrir." },
    ],
  },

  "troubleshooting": {
    title: "Dépannage : les cinq choses qui accrochent en premier",
    summary:
      "Des courriels qui n'arrivent jamais, une facture sans bouton Payer, un écran introuvable, un logo qui refuse de se téléverser, et une adresse de site web qui ne charge pas — ce que chacun signifie et où regarder.",
    updated: "2026-09-12",
    intro: [
      "Cinq problèmes expliquent la plupart des questions de la première semaine, et quatre d'entre eux sont des réglages plutôt que des pannes. Chaque section ci-dessous dit ce que vous verrez, ce que ça veut habituellement dire, et l'écran qui règle ça. Si vous arrivez au bout d'une section et que c'est toujours cassé, c'est le moment d'écrire au soutien avec la phrase exacte à l'écran — voir [[how-to-get-help|Comment obtenir de l'aide]].",
    ],
    sections: [
      {
        id: "emails",
        heading: "Un client dit que le courriel n'est jamais arrivé",
        blocks: [
          { p: "Un courriel de soumission ou de facture part au nom de votre entreprise. L'adresse d'envoi dépend de **Paramètres → Domaine d'envoi** : votre propre domaine une fois vérifié, le domaine d'envoi de FieldQuo d'ici là. Un domaine non vérifié est la raison habituelle pour laquelle un courriel tombe dans les indésirables ou affiche « via fieldquo.com »." },
          { steps: [
            "Ouvrez **Paramètres → Domaine d'envoi**. Le statut indique **Vérifié**, **En attente du DNS**, **Échec de la vérification** ou **Non configuré**.",
            "**En attente du DNS** ou **Échec de la vérification** — les enregistrements listés sur la page ne sont pas encore chez votre registraire de domaine, ou pas exactement comme indiqué. Ajoutez-les et revérifiez ; le DNS peut prendre une heure.",
            "**Non configuré** — vous envoyez depuis le domaine de FieldQuo, ce qui fonctionne, mais la délivrabilité n'est plus entre vos mains. Voir [[send-from-your-own-domain|Envoyer des courriels depuis votre propre domaine]].",
            "**Vérifié** et toujours rien — demandez au client de vérifier ses indésirables, et vérifiez qu'il n'y a pas de faute dans l'adresse courriel de sa fiche. La page de la soumission montre quand elle a été envoyée.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Paramètres → Domaine d'envoi — le domaine avec son statut, l'adresse d'expédition, et où vont les réponses." },
        ],
      },
      {
        id: "pay-button",
        heading: "Il n'y a pas de bouton Payer sur la facture",
        blocks: [
          { p: "Le bouton Payer apparaît sur une facture seulement une fois que Stripe a activé les paiements pour votre compte. D'ici là, la page de facture du client montre comment vous payer autrement à la place du bouton, et jamais un bouton mort." },
          { steps: [
            "Ouvrez **Paramètres → Paiements**. Si Stripe n'est pas connecté, appuyez sur **Connecter avec Stripe** — voir [[connect-stripe-and-get-verified|Connecter Stripe et faire vérifier votre compte]].",
            "S'il est connecté, la carte nomme ce que Stripe a activé et ce qu'il attend encore — habituellement un document, un compte bancaire ou le nom d'un dirigeant. Appuyez sur **Gérer dans Stripe** et terminez.",
            "Si la page dit que Stripe retient votre argent ou examine votre compte, les paiements passent quand même ; seul le versement attend. Voir [[payouts-held-or-under-review|Versements retenus ou en examen]].",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — le statut Stripe, ce qui est activé, et ce que Stripe attend encore." },
        ],
      },
      {
        id: "missing-screen",
        heading: "Un écran ou un bouton attendu n'est pas là",
        blocks: [
          { p: "La barre latérale masque les lignes que votre niveau d'accès ne permet pas, et certains contrôles sont masqués de la même façon. Une ligne absente, c'est le produit qui fonctionne, pas le produit qui est cassé." },
          { steps: [
            "Vérifiez votre niveau : le propriétaire ou un administrateur peut le lire dans **Votre équipe**. Crew ne voit ni Prospects, ni Soumissions, ni Factures, ni Clients ; Estimator ne voit ni Votre équipe, ni Feuilles de temps, ni Révisions de devis ; Dispatcher ne voit ni Dépenses, ni KPI, ni boutons de suppression. Voir [[access-levels-overview|Niveaux d'accès : qui voit quoi]].",
            "Un bloc qui indique **Masqué par votre niveau d'accès** ou « Les prix sont masqués par votre niveau d'accès. » est la même règle à l'intérieur d'un écran — demandez au propriétaire de monter ce réglage-là dans l'éditeur d'accès personnalisé.",
            "**Tarifs des armoires** et **Coût des matériaux** n'apparaissent que pour les métiers qui chiffrent de cette façon ; le secteur se règle dans **Paramètres → Profil de l'entreprise**.",
            "Sur un téléphone, **Plus** ouvre tout ce que la barre d'onglets ne montre pas.",
          ] },
        ],
      },
      {
        id: "logo-upload",
        heading: "Le logo refuse de se téléverser",
        blocks: [
          { p: "**Paramètres → Image de marque** accepte **PNG, JPG, WebP ou SVG, jusqu'à 8 Mo**. Un fichier hors de ça est refusé ; un fichier conforme qui échoue affiche **Échec du téléversement** ou **Impossible de téléverser le logo**." },
          { steps: [
            "Vérifiez le format et la taille. Une photo prise directement avec un téléphone peut dépasser 8 Mo — exportez-la plus petite.",
            "Réessayez une fois. Un échec isolé sur une mauvaise connexion est courant ; le téléversement est signé par le serveur et il aboutit ou échoue, il ne s'enregistre jamais à moitié.",
            "Si chaque téléversement échoue avec le même message, la faute est du côté de FieldQuo (le service d'images qui refuse l'envoi), pas de votre fichier. Écrivez au soutien avec le message.",
          ] },
        ],
      },
      {
        id: "website-address",
        heading: "L'adresse de votre site web ne charge pas",
        blocks: [
          { p: "Votre site vit à votre sous-domaine de fieldquo.com, choisi dans **Paramètres → Votre site web**. « Safari ne trouve pas le serveur » ou « ce site est inaccessible » veut dire que le nom ne se résout pas — un problème de service de noms du côté de FieldQuo, pas quelque chose dans le contenu de votre site." },
          { steps: [
            "Ouvrez **Paramètres → Votre site web** et vérifiez que la pastille à côté de l'adresse indique **En ligne**. Un site jamais publié ne répond pas du tout — le bouton à côté de l'adresse indique **Publier** tant qu'il ne l'est pas, et **Mettre à jour** ensuite.",
            "Appuyez sur **Ouvrir** sur cette page plutôt que de taper l'adresse ; une faute dans le sous-domaine est la cause la plus fréquente.",
            "S'il est En ligne et qu'il ne charge toujours pas depuis un deuxième appareil, écrivez au soutien avec l'adresse. C'est une panne de service de noms générique que FieldQuo doit corriger.",
          ] },
          { note: "Il n'y a pas d'option de domaine personnalisé aujourd'hui : l'adresse est toujours votresousdomaine.fieldquo.com. Voir [[your-website-address|L'adresse de votre site web]]." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo IA a cessé de répondre.", a: "Le quota du mois est épuisé ; l'écran le dit au-dessus de la boîte de question. Il est remis à zéro au début du mois prochain. Tout le reste continue de fonctionner." },
      { q: "La première page après une période d'inactivité a été lente ou a échoué.", a: "Rechargez une fois. La base de données s'endort quand personne ne l'a utilisée depuis un moment, et la première connexion la réveille." },
      { q: "Le texto de rappel d'un client n'est pas parti.", a: "Les rappels partent par texto seulement, et seulement à un client qui a un numéro de cellulaire dans sa fiche et qui ne s'est pas désabonné. Voir [[appointment-reminders|Rappels de rendez-vous]]." },
    ],
  },

  "faq": {
    title: "Foire aux questions",
    summary:
      "Des réponses courtes aux questions que chaque nouvelle entreprise pose — forfaits et sièges, l'équipe, vos clients, vos données, les téléphones et les autres outils.",
    updated: "2026-09-12",
    intro: [
      "Les questions qui reviennent le premier mois, répondues en une phrase ou deux avec un lien vers l'article complet. Chaque réponse ici est vraie du produit aujourd'hui ; là où FieldQuo ne fait pas quelque chose, c'est dit.",
    ],
    sections: [
      {
        id: "plans-and-billing",
        heading: "Les forfaits et le paiement de FieldQuo",
        blocks: [
          { bullets: [
            "**Y a-t-il un essai gratuit ?** Le premier mois est gratuit. Une carte est prise à l'inscription et rien n'est facturé avant le deuxième mois. Voir [[free-first-month|Votre premier mois est gratuit]].",
            "**En quoi les forfaits diffèrent-ils ?** Par les sièges et les équipiers, rien d'autre — chaque fonction est dans chaque forfait. Solo coûte 99 $ par mois pour 1 siège et 5 équipiers ; Crew 169 $ pour 3 et 8 ; Shop 269 $ pour 6 et 11 ; Scale 369 $ pour 10 et 15. Voir [[the-four-plans|Les quatre forfaits]].",
            "**C'est quoi un siège, et c'est quoi un équipier ?** Un siège, c'est quelqu'un qui crée et modifie des soumissions, des chantiers et des factures. Un équipier pointe ses heures, lit son horaire et ajoute des photos, et c'est gratuit. Voir [[seats-and-crew-logins|Sièges et accès équipiers]].",
            "**Une année, c'est moins cher ?** Oui — un engagement d'un an, c'est deux mois gratuits, facturé une fois par année. Voir [[monthly-or-a-year-commitment|Mensuel, ou un engagement d'un an]].",
            "**Comment j'annule ?** **Forfait → Annuler le forfait**. Le compte passe en lecture seule immédiatement ; vos clients peuvent encore payer leurs factures. Voir [[cancel-your-subscription|Annuler votre abonnement]].",
            "**Le parrainage ?** Recommandez une autre entreprise et vous recevez chacun un mois gratuit une fois qu'elle paie. Voir [[refer-another-business|Recommander une autre entreprise]].",
          ] },
        ],
      },
      {
        id: "your-team",
        heading: "Votre équipe",
        blocks: [
          { bullets: [
            "**Quelqu'un peut-il se joindre sans invitation ?** Non. S'inscrire sur le site public crée une nouvelle entreprise. Se joindre à la vôtre passe uniquement par une invitation depuis **Votre équipe**.",
            "**Qu'est-ce que chaque personne peut voir ?** Cinq niveaux : Crew, Estimator, Dispatcher, Manager, administrateur. Le propriétaire peut changer n'importe quel réglage. Voir [[access-levels-overview|Niveaux d'accès : qui voit quoi]].",
            "**FieldQuo paie-t-il mon équipe ?** Non. La paie calcule le salaire à partir des heures approuvées et de vos taux et produit les fiches de paie ; vous payez par votre propre banque ou votre fournisseur de paie. Voir [[payroll-runs|Les périodes de paie]].",
            "**Les équipiers qui refusent une application peuvent-ils quand même envoyer des photos ?** Oui — ils textent une photo au numéro de l'équipe et elle se classe toute seule sur le chantier. Voir [[the-crew-inbox|La boîte équipe]].",
          ] },
        ],
      },
      {
        id: "your-clients",
        heading: "Vos clients et votre image de marque",
        blocks: [
          { bullets: [
            "**Mes clients verront-ils le nom de FieldQuo ?** Pas sur une soumission, une facture, un courriel, la page de réservation ni le portail client — ils portent votre logo, votre couleur et votre nom. La seule exception est un petit pied de page « Site by FieldQuo » sur un site web gratuit. Voir [[nothing-says-fieldquo|Rien ne dit FieldQuo]].",
            "**Je peux soumissionner en français et en anglais ?** Oui. Une soumission garde la langue dans laquelle elle a été créée, et le courriel qui l'accompagne suit. Voir [[quote-language|Une soumission garde sa langue]].",
            "**Combien coûte un paiement par carte ?** 3 % + 30 ¢ par paiement par carte ; le débit bancaire au Canada est à 1 % + 40 ¢, plafonné à 5 $. Aucuns frais mensuels. Voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]].",
            "**FieldQuo garde-t-il mon argent ?** Jamais. Les paiements passent par votre propre compte Stripe jusqu'à votre banque.",
            "**Comment un client voit-il ce qu'il doit ?** Par le lien du courriel de facture — le portail client montre son solde, ses factures et ses soumissions, sans connexion. Voir [[what-your-clients-get|Ce que vos clients en retirent]].",
          ] },
        ],
      },
      {
        id: "your-data",
        heading: "Vos données",
        blocks: [
          { bullets: [
            "**Je peux importer mes anciens clients et chantiers ?** Oui — des imports CSV pour les clients, les anciens chantiers et les soumissions, ou le service de migration payant où FieldQuo s'en charge. Voir [[import-clients-from-a-csv|Importer des clients depuis un CSV]] et [[the-data-migration-service|Le service de migration de données]].",
            "**Est-ce synchronisé avec QuickBooks ou Xero ?** Non. Il y a un export comptable CSV conçu pour être importé dans les deux. Voir [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero et votre comptable]].",
            "**Y a-t-il une API, ou Zapier ?** Pas encore. Voir [[no-public-api-or-zapier|Pas d'API publique ni de Zapier, pour l'instant]].",
            "**Je peux récupérer mes données, ou les faire supprimer ?** Oui. Voir [[data-and-privacy|Vos données, celles de vos clients, et la suppression]].",
          ] },
        ],
      },
      {
        id: "phones-and-other-tools",
        heading: "Téléphones et autres outils",
        blocks: [
          { bullets: [
            "**Y a-t-il une application dans les boutiques d'applications ?** Non. FieldQuo tourne dans le navigateur et s'installe sur l'écran d'accueil comme une application. Voir [[install-it-like-an-app|L'installer comme une application]].",
            "**Ça fonctionne hors ligne ?** Non, volontairement. Voir [[bad-connections-and-offline|Mauvaises connexions, et pourquoi il n'y a pas de mode hors ligne]].",
            "**Quelles langues ?** L'application tourne en huit langues — anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien ; **Paramètres → Langue** montre à quel point chacune est complète. Ce centre d'aide est en anglais, en français et en espagnol.",
            "**Il peut répondre à mon téléphone ?** Oui, la réceptionniste téléphonique, sur un numéro local, payée avec du crédit téléphonique. Voir [[the-phone-receptionist|La réceptionniste téléphonique]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Où est-ce que je pose une question qui n'est pas ici ?", a: "Écrivez à hello@fieldquo.com, ou utilisez la page Contact Us du site public. Voir [[how-to-get-help|Comment obtenir de l'aide]]." },
      { q: "Y a-t-il ici une promesse sur une fonction à venir ?", a: "Non. Chaque réponse décrit le produit tel qu'il est aujourd'hui. Là où la réponse honnête est « pas encore », l'article lié le dit." },
    ],
  },

  "glossary": {
    title: "Glossaire",
    summary:
      "Les mots propres à FieldQuo — siège, équipier, estimation instantanée, extra, relevé de quantités, catalogue de prix, marque blanche, forfait de service, zone desservie, débit bancaire et les autres — au sens où les écrans les emploient.",
    updated: "2026-09-12",
    intro: [
      "Un court dictionnaire des mots que FieldQuo utilise et qu'un autre outil emploie autrement, ou pas du tout. Chaque définition est le sens que l'écran lui donne ; quand un mot a sa ligne dans les Paramètres, la ligne est nommée.",
    ],
    sections: [
      {
        id: "selling-the-work",
        heading: "Vendre le travail",
        blocks: [
          { table: {
            head: ["Terme", "Ce que ça veut dire dans FieldQuo"],
            rows: [
              ["Prospect", "Une demande — venue de votre formulaire web, de votre lien de réservation, d'une estimation instantanée, de la réceptionniste ou d'une recommandation — sur le tableau **Prospects**, notée Chaud, Tiède ou Froid."],
              ["Soumission", "L'offre chiffrée que vous envoyez. Elle garde la langue dans laquelle elle a été créée et porte votre image de marque, comme page et comme PDF."],
              ["Type de soumission", "Un genre de travail que vous vendez, avec ses questions d'admission et ses tarifs, dans **Paramètres → Services et tarifs**. Les types intégrés de votre métier plus les vôtres."],
              ["Relevé de quantités (takeoff)", "Le formulaire propre au métier qui transforme des mesures en lignes chiffrées — carrés de toiture, portes et façades de tiroir, pieds linéaires."],
              ["Catalogue de prix", "**Paramètres → Produits et services** : vos propres services et produits avec leurs tarifs. Une ligne de soumission se choisit ici."],
              ["Estimation instantanée", "Une fourchette de prix qu'un client produit lui-même sur votre site web, à partir de vos tarifs, jamais des nôtres. Elle atterrit dans **Révisions de devis** avant de pouvoir partir."],
              ["Révision de devis", "L'étape où une personne confirme le prix d'une estimation instantanée et appuie sur **Approuver**. Rien de ce qu'un algorithme a chiffré n'atteint un client sans elle."],
              ["Extra (add-on)", "Un supplément optionnel au bas d'une soumission que le client peut cocher sur la page d'approbation. Le serveur le chiffre ; le navigateur n'envoie jamais de montant."],
              ["Bon, mieux, meilleur", "Trois options chiffrées sur une seule soumission. Le calcul existe en coulisses, mais il n'y a pas encore d'écran pour ça."],
              ["Prix de seuil de rentabilité", "Le minimum qu'un chantier doit rapporter pour couvrir vos frais généraux, calculé dans **Paramètres → Frais généraux** à partir de vos vrais coûts fixes."],
            ],
          } },
        ],
      },
      {
        id: "doing-the-work",
        heading: "Faire le travail",
        blocks: [
          { table: {
            head: ["Terme", "Ce que ça veut dire dans FieldQuo"],
            rows: [
              ["Chantier", "Le travail une fois la soumission approuvée : visites, équipe, matériaux, photos, listes de vérification. La plupart des chantiers naissent d'une soumission acceptée."],
              ["Visite", "Un déplacement planifié à l'adresse, dans le **Calendrier**. Un chantier peut en avoir plusieurs."],
              ["Fenêtre d'arrivée", "La plage que vous promettez au client (« entre 8 h et 10 h ») plutôt qu'une minute précise, réglée dans **Paramètres → Page de rendez-vous** avec le temps de déplacement."],
              ["Quart", "Une personne sur un chantier pour une plage d'heures dans **Attribuer les quarts**. Un brouillon jusqu'à la publication de la semaine ; l'équipe ne voit que les quarts publiés."],
              ["Zone desservie", "Un territoire ou un projet nommé dans **Paramètres → Zones desservies**, avec les membres de l'équipe qui y sont assignés, pour grouper chantiers et tâches."],
              ["Liste de vérification", "Les étapes standard que l'équipe suit sur place, par phase, depuis **Paramètres → Listes de vérification**."],
              ["Pointeuse", "Le pointage de l'équipier lui-même — **Pointer l'entrée**, **Pointer la sortie** — révisé par le bureau dans **Feuilles de temps** avant une période de paie."],
              ["Boîte équipe", "Le numéro auquel votre équipe texte photos et nouvelles ; elles se classent toutes seules sur le bon chantier, et celles qui ne peuvent pas attendent sous « Votre attention »."],
              ["Coûts de chantier", "Le chiffré contre le réel — la main-d'œuvre d'après les heures pointées, les matériaux et les dépenses — pour savoir ce qu'un chantier a rapporté. Un interrupteur dans la grille d'accès d'une personne."],
              ["Forfait de service", "Du travail récurrent vendu en paquet dans **Forfaits** : une instruction permanente de créer une visite et une facture à une cadence donnée."],
            ],
          } },
        ],
      },
      {
        id: "getting-paid",
        heading: "Se faire payer",
        blocks: [
          { table: {
            head: ["Terme", "Ce que ça veut dire dans FieldQuo"],
            rows: [
              ["Facture", "Le compte à payer, qui reprend les sections et l'image de marque de la soumission, envoyé par courriel avec un lien de paiement."],
              ["Acompte", "La part de la soumission due pour réserver le chantier, fixée par la carte **Échéancier de paiement** dans **Paramètres → Profil de l'entreprise** — par exemple 50 % à la réservation et 50 % à l'installation."],
              ["Frais de réservation", "Un montant prélevé quand une visite est réservée en ligne, crédité sur la facture quand le travail se fait."],
              ["Frais de traitement", "Ce qu'un paiement par carte ou par débit bancaire vous coûte, retenu sur le paiement avant qu'il n'atteigne votre banque : 3 % + 30 ¢ sur une carte."],
              ["Débit bancaire (Canada)", "Le débit préautorisé pour les clients canadiens facturés en dollars canadiens : 1 % + 40 ¢, plafonné à 5 $ par paiement."],
              ["Portail client", "La page que le client atteint depuis le courriel de facture : son solde, ses factures avec un bouton Payer, et ses soumissions. Sans connexion."],
              ["Versement", "Stripe qui transfère votre solde à votre banque, selon son calendrier. Un versement instantané sur une carte de débit coûte 1 %."],
              ["Règle de relance", "Un courriel automatique un certain temps après qu'une soumission, une facture ou un chantier atteint un état — dans **Paramètres → Relances**."],
            ],
          } },
        ],
      },
      {
        id: "your-team-and-your-plan",
        heading: "Votre équipe et votre forfait",
        blocks: [
          { table: {
            head: ["Terme", "Ce que ça veut dire dans FieldQuo"],
            rows: [
              ["Siège", "Quelqu'un qui crée et modifie des soumissions, des chantiers et des factures. Les sièges sont la seule chose par laquelle les quatre forfaits diffèrent."],
              ["Équipier", "Quelqu'un qui pointe ses heures, lit son horaire et ajoute des photos. Gratuit, et jamais compté comme un siège."],
              ["Niveau d'accès", "L'un des cinq préréglages dans **Votre équipe** — Crew, Estimator, Dispatcher, Manager, administrateur — chacun une grille remplie de onze domaines et trois interrupteurs."],
              ["Personnalisé", "Ce qu'une ligne indique une fois que le propriétaire a changé un seul réglage par rapport à son préréglage."],
              ["Administrateur", "Tout ce que le propriétaire a, sauf la propriété elle-même. Pour un associé ou un comptable."],
              ["Période de paie", "La paie d'une période calculée à partir des heures approuvées et de vos taux, avec les fiches de paie. FieldQuo ne déplace pas l'argent."],
              ["Quota IA", "La quantité mensuelle de travail IA incluse dans votre forfait, partagée par tout ce que l'IA fait pour vous."],
              ["Crédit IA et crédit téléphonique", "Du crédit que vous achetez dans **Paramètres → Crédit IA** pour les minutes téléphoniques et les images IA. Distinct du quota."],
              ["Mois de parrainage", "Un mois gratuit pour vous et pour l'entreprise que vous avez recommandée, une fois qu'elle paie."],
              ["Session d'assistance", "Un membre du personnel de FieldQuo qui regarde votre compte en lecture seule. Journalisée, et signalée dans le Journal d'activité."],
            ],
          } },
        ],
      },
      {
        id: "your-brand-and-your-clients",
        heading: "Votre image de marque et vos clients",
        blocks: [
          { table: {
            head: ["Terme", "Ce que ça veut dire dans FieldQuo"],
            rows: [
              ["Marque blanche", "Chaque document qu'un client voit porte votre nom, votre logo et votre couleur, pas ceux de FieldQuo. C'est le réglage par défaut, pas une option payante."],
              ["Couleur de marque", "La couleur unique de **Paramètres → Image de marque** dont découle chaque surface côté client ; le contraste est calculé pour rester lisible."],
              ["Domaine d'envoi", "Votre propre domaine dans **Paramètres → Domaine d'envoi**, pour que la ligne De soit la vôtre et que rien n'affiche « via fieldquo.com »."],
              ["Page de rendez-vous", "La page publique où un client choisit un créneau dans vos vraies disponibilités."],
              ["Funnel", "Une page à parcourir du pouce pour une publicité ou un dépliant, qui qualifie un visiteur et dépose un prospect noté dans **Prospects**."],
              ["Lien de profil", "Une page à votre image pour le seul lien qu'Instagram et TikTok permettent."],
              ["Texto « En route »", "Le seul texto que votre client reçoit quand l'équipe part vers son adresse ; les mots sont les vôtres dans **Paramètres → Messages aux clients**."],
              ["Demande d'avis", "La seule demande polie d'avis qu'un client reçoit une fois le chantier terminé et payé, depuis **Paramètres → Avis**."],
            ],
          } },
        ],
      },
    ],
  },

  "what-your-clients-get": {
    title: "Ce que vos clients en retirent",
    summary:
      "Le côté client de FieldQuo — la soumission qu'ils signent, la facture qu'ils paient, le portail qui montre ce qu'ils doivent, les textos avant une visite — tous à votre nom.",
    updated: "2026-09-12",
    intro: [
      "Vos clients ne s'inscrivent à rien. Ils reçoivent un courriel, un texto ou un lien, l'ouvrent sur leur téléphone, et voient une page avec votre logo dessus. Cet article décrit ce côté-là du produit : ce que chaque surface leur montre, et où vous la contrôlez. Le parcours complet de chaque page est la catégorie [[nothing-says-fieldquo|Ce que vos clients voient]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque surface qu'un client touche est bâtie sur la même marque : votre logo et votre couleur de **Paramètres → Image de marque**, votre nom dans la ligne De, vos règles de langue. Un client qui compare trois entrepreneurs ne peut pas savoir que deux d'entre eux utilisent FieldQuo. La seule exception est le petit pied de page « Site by FieldQuo » sur un site web gratuit." },
          { p: "Rien de tout ça n'exige de connexion. Un lien de soumission, un lien de facture et le lien du portail sont chacun impossibles à deviner, et c'est ce qui sépare un inconnu de l'historique de facturation d'un client." },
        ],
      },
      {
        id: "the-documents",
        heading: "Les documents",
        blocks: [
          { table: {
            head: ["Ce qu'ils reçoivent", "Ce que ça montre", "Où vous le contrôlez"],
            rows: [
              ["Le courriel de soumission", "Votre nom et votre logo, le PDF en pièce jointe, dans la langue de la soumission, avec les références et les photos avant-après que vous avez choisi d'inclure.", "**Paramètres → Courriel de soumission**, **Paramètres → Domaine d'envoi**"],
              ["La page d'approbation", "La soumission en page web : les lignes, la description des travaux et les conditions, des extras optionnels à cocher, une case de signature, et l'acompte à payer si vous en avez demandé un.", "Le constructeur de soumission ; **Paramètres → Profil de l'entreprise** pour l'échéancier de paiement"],
              ["Le courriel de facture", "Les mêmes sections et la même image de marque que la soumission, avec un lien de paiement.", "**Paramètres → Modèles PDF**, **Paramètres → Paiements**"],
              ["La page de paiement", "La facture avec un bouton **Payer** par carte — et par débit bancaire pour les clients canadiens — une fois Stripe actif. Sans Stripe, comment vous payer autrement à la place.", "**Paramètres → Paiements**"],
              ["Payer en plusieurs fois", "Une option mensuelle à la caisse, décidée par le prêteur, si vous l'avez activée. FieldQuo ne prête pas et n'approuve personne.", "**Paramètres → Paiements**"],
            ],
          } },
        ],
      },
      {
        id: "the-portal",
        heading: "Le portail client",
        blocks: [
          { p: "Le lien d'un courriel de facture ouvre le compte du client chez vous : votre logo, **Compte de** suivi de son nom, puis **Solde dû** en un gros chiffre — ou **Rien en souffrance. Merci.** En dessous, **Factures**, chacune avec son total, ce qui est payé, la date d'échéance et un bouton **Payer** ou la mention **Payé** ; puis **Soumissions**, chacune marquée **En attente de votre réponse**, **Approuvée** ou **Refusée**, avec **Consulter** sur celle qui attend encore. Le pied de page nomme votre entreprise, votre téléphone et votre courriel pour les questions." },
          { p: "Il est dans la langue du client, et le bouton de paiement est le même prélèvement Stripe que celui du courriel de facture — voir [[the-client-portal|Le portail client]]." },
        ],
      },
      {
        id: "before-and-after-a-visit",
        heading: "Avant et après une visite",
        blocks: [
          { bullets: [
            "**La page de rendez-vous** — un client choisit un créneau dans vos vraies disponibilités, temps de déplacement et fenêtres d'arrivée compris, et paie des frais de réservation si vous en avez fixé.",
            "**Le rappel de rendez-vous** — un texto avant votre arrivée. Texto seulement, pas de courriel, et le libellé n'est pas encore modifiable.",
            "**Le texto « En route »** — envoyé quand l'équipe part, dans vos propres mots depuis **Paramètres → Messages aux clients**.",
            "**La demande d'avis** — une fois le chantier terminé et payé, une seule demande polie d'avis, avec votre lien d'avis.",
          ] },
          { note: "Ce sont les seuls textos automatiques qu'un client reçoit. FieldQuo ne texte pas les clients à propos d'autre chose de son propre chef — voir [[texting-clients-what-is-and-is-not-automated|Texter les clients : ce qui est automatisé et ce qui ne l'est pas]]." },
        ],
      },
      {
        id: "before-they-are-a-client",
        heading: "Avant qu'ils soient clients",
        blocks: [
          { p: "Un inconnu vous rencontre par votre site web, l'estimation instantanée, le formulaire d'auto-soumission, un funnel ou le lien de profil — chacun à votre image et chacun atterrissant dans **Prospects**. L'estimation instantanée montre une fourchette tirée de vos tarifs et ne montre jamais la grille tarifaire ; elle arrive dans **Révisions de devis** pour qu'une personne la confirme avant qu'elle devienne officielle. Voir [[instant-quotes-on-your-website|Soumissions instantanées sur votre site web]]." },
        ],
      },
    ],
    faq: [
      { q: "Mes clients ont-ils besoin d'un compte ou d'un mot de passe ?", a: "Non. Chaque page qu'ils ouvrent vient d'un lien dans un courriel ou un texto." },
      { q: "Un client peut-il voir la soumission d'un autre client ?", a: "Non. Chaque lien ouvre les documents d'un seul client, et les liens sont impossibles à deviner." },
      { q: "Et si la langue d'un client n'est pas la mienne ?", a: "Réglez-la dans sa fiche client. Les courriels et le portail suivent la langue du client ; une soumission garde la langue dans laquelle elle a été créée." },
      { q: "Un client voit-il un jour le mot FieldQuo ?", a: "Seulement le pied de page « Site by FieldQuo » sur un site web gratuit. Pas sur une soumission, une facture, un courriel, un texto, la page de rendez-vous ni le portail." },
    ],
  },
};
