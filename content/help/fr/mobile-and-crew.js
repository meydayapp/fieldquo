// content/help/fr/mobile-and-crew.js
//
// Articles de la catégorie « mobile-and-crew » en français. Même structure que
// l'anglais, article par article : mêmes slugs, mêmes sections dans le même
// ordre, mêmes blocs, mêmes figures — scripts/check-help-centre.mjs compare
// les deux. Les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js; les libellés que le produit n'affiche qu'en anglais
// (la grille d'accès, les étapes des photos, le bouton Withdraw) restent en
// anglais, avec une glose. Il n'y a ni application native ni mode hors ligne,
// et les articles le disent plutôt que de le laisser croire.
export const ARTICLES = {
  "using-fieldquo-on-your-phone": {
    title: "Utiliser FieldQuo sur votre téléphone",
    summary:
      "FieldQuo tourne dans le navigateur de votre téléphone — aucune application à télécharger. À quoi ressemble la disposition mobile, comment se connecter, et ce qui fonctionne depuis une entrée de garage.",
    updated: "2026-09-12",
    intro: [
      "Il n'y a pas d'application FieldQuo dans l'App Store ni sur Google Play. Le back-office que vous utilisez au bureau est le même que vous ouvrez sur un téléphone : sous environ 1 024 pixels de largeur, les pages se réorganisent, une barre d'onglets apparaît au bas de l'écran, et tout ce qu'un équipier fait dans sa journée — pointer, vérifier l'horaire, classer une photo, clavarder avec le bureau — est conçu pour se faire d'un seul pouce.",
      "Cet article est la visite guidée : à quoi ressemble la disposition mobile, comment se connecter, et quels écrans valent la peine d'être mis en favoris. Les articles qui suivent prennent un écran à la fois.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Sur un téléphone, la barre latérale que vous connaissez de l'ordinateur se replie. À sa place : une barre fixe en haut — le logo FieldQuo, qui vous ramène à l'**Accueil**, un bouton de menu, et la cloche des notifications avec son compteur de non-lus — et une barre d'onglets en bas avec les écrans que vous ouvrez le plus souvent. Tout le reste est à un tapotement derrière **Plus**." },
          { p: "Chaque tapotement va au serveur. C'est toute la conception : rien n'est stocké sur le téléphone, alors un téléphone partagé dans le camion ne montre rien à la prochaine personne qui le prend, et le bureau voit votre pointage ou votre photo dès qu'ils arrivent. Le revers, c'est qu'un tapotement sans signal ne passe pas — voir [[bad-connections-and-offline|Mauvaises connexions, et pourquoi il n'y a pas de mode hors ligne]]." },
          { note: "La disposition mobile, c'est le même produit avec les mêmes permissions. Un écran que votre niveau d'accès cache sur un ordinateur est caché sur un téléphone aussi, et une adresse que vous tapez à la main est refusée par le serveur, pas seulement par le menu." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas, sur n'importe quelle page :" },
          { bullets: [
            "**La barre du haut** — le bouton de menu à gauche ouvre le menu complet en tiroir; le logo FieldQuo au centre mène au tableau de bord; la cloche à droite indique combien de notifications vous n'avez pas lues.",
            "**La page elle-même** — les mêmes cartes que sur un ordinateur, empilées sur une colonne. Les boutons sont taillés pour un pouce, et le sélecteur de chantier de la pointeuse est le sélecteur natif de votre téléphone, pas un menu maison.",
            "**La barre d'onglets** — jusqu'à cinq onglets plus **Plus**. Les onglets que vous obtenez dépendent de votre niveau d'accès; un équipier voit **Chantiers**, **Clavardage** et **Plus**. Voir [[the-crew-tab-bar|La barre d'onglets de l'équipe]].",
            "**La zone sûre** — sur un iPhone, la barre se place au-dessus de l'indicateur d'accueil plutôt que dessous, alors l'onglet du bas n'est jamais à moitié couvert.",
          ] },
          { figure: "harness:mobile-job", caption: "Un chantier sur un téléphone — la visite avec ses boutons En route et Marquer comme terminée, la liste de vérification dessous, et la barre d'onglets Chantiers · Clavardage · Plus." },
        ],
      },
      {
        id: "sign-in",
        heading: "Comment se connecter sur votre téléphone",
        blocks: [
          { steps: [
            "Ouvrez le courriel d'invitation sur votre téléphone et acceptez-le — c'est ainsi qu'on rejoint une entreprise; il n'y a aucun moyen de s'y ajouter soi-même. Au niveau Crew, votre compte ne coûte rien à l'entreprise.",
            "Choisissez votre mot de passe. Ensuite, la page de connexion demande **Courriel** et **Mot de passe**, et le bouton s'appelle **Se connecter**.",
            "Vous arrivez sur l'**Accueil**. Tapotez le bouton de menu, ou un onglet, pour aller où vous voulez.",
            "Facultatif mais utile : ajoutez FieldQuo à votre écran d'accueil pour qu'il s'ouvre comme une application — [[install-it-like-an-app|L'installer comme une application]].",
          ] },
          { tip: "Restez connecté. FieldQuo ne vous déconnecte pas entre deux visites, alors l'icône de l'écran d'accueil s'ouvre directement sur votre journée; si jamais vous êtes déconnecté, l'icône ouvre plutôt la page de connexion." },
        ],
      },
      {
        id: "what-works-on-a-phone",
        heading: "Ce qui fonctionne depuis un téléphone",
        blocks: [
          { table: {
            head: ["Ce que vous devez faire", "Où", "Notes"],
            rows: [
              ["Pointer l'entrée et la sortie, changer de chantier", "**Pointeuse**", "Votre téléphone est interrogé sur sa position une fois, au tapotement — jamais en arrière-plan."],
              ["Voir vos quarts et vos visites", "**Attribuer les quarts**, **Calendrier**, **Chantiers**", "Seulement ce qui est publié, et seulement ce où vous êtes assigné."],
              ["Ajouter des photos à un chantier", "La page du chantier, **Photos du chantier**", "Depuis l'appareil photo ou la pellicule; ou textez-les sans rien ouvrir."],
              ["Parler au bureau", "**Clavardage**", "Un salon par chantier, #general pour tout le monde, des messages directs."],
              ["Demander un congé", "**Congés**", "Les soldes et vos demandes sur un seul écran."],
              ["Signaler un incident ou un incident évité de justesse", "**Sécurité**", "Un court formulaire; ajoutez une photo ensuite."],
              ["Lire vos bulletins de paie", "**Paie**", "Les vôtres seulement."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Toute personne qui a un compte. Ce que le menu affiche dépend du niveau d'accès que le propriétaire vous a donné — Crew, Estimator, Dispatcher, Manager ou une grille personnalisée — et la disposition mobile n'y change rien. Le reste de cette catégorie est écrit pour le niveau Crew, celui de la plupart des gens dans un camion; voir [[what-a-crew-member-sees|Ce qu'un équipier voit]]." },
        ],
      },
    ],
    faq: [
      { q: "Y a-t-il une application dans l'App Store?", a: "Non. FieldQuo tourne dans le navigateur du téléphone. Vous pouvez l'ajouter à votre écran d'accueil pour qu'il s'ouvre plein écran avec sa propre icône, ce qui est aujourd'hui ce qui se rapproche le plus d'une application." },
      { q: "Est-ce que ça fonctionne sur un iPad ou une petite tablette?", a: "Oui. Sous environ 1 024 pixels de largeur, vous obtenez la disposition mobile avec la barre d'onglets; au-delà, vous obtenez la barre latérale, exactement comme sur un ordinateur." },
      { q: "Est-ce que le bureau voit où est mon téléphone?", a: "Seulement où il était au moment où vous avez tapoté Pointer l'entrée, Pointer la sortie, En route ou Marquer comme terminée — et seulement si vous l'avez permis quand le téléphone l'a demandé. Rien ne tourne entre deux tapotements." },
    ],
  },

  "install-it-like-an-app": {
    title: "L'installer comme une application",
    summary:
      "Ajoutez FieldQuo à l'écran d'accueil de votre téléphone pour qu'il s'ouvre plein écran avec sa propre icône — et, sur un iPhone, pour que les notifications puissent vous joindre tout court.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo est une application web, et l'iPhone comme Android peuvent épingler une application web à l'écran d'accueil. Une fois que c'est fait, elle s'ouvre sans la barre d'adresse du navigateur, en mode portrait, directement sur votre tableau de bord, avec l'icône FieldQuo à côté de vos autres applications. Rien n'est téléchargé d'une boutique et il n'y a rien à mettre à jour — vous avez toujours la version courante.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le téléphone lit une courte description que FieldQuo publie sur lui-même : le nom **FieldQuo**, l'icône, le fait qu'il doit s'ouvrir sur le back-office, et qu'il doit tourner plein écran et en mode portrait. C'est ce qui fait que le navigateur propose une option d'installation." },
          { p: "Installer change la façon dont FieldQuo s'ouvre, pas ce qu'il peut faire. Ce sont les mêmes pages qui parlent au même serveur; chaque tapotement a toujours besoin d'une connexion." },
          { warning: "Sur un iPhone ou un iPad, ajoutez FieldQuo à l'écran d'accueil avant d'essayer d'activer les notifications. Safari ne livre les notifications qu'aux applications web installées — l'interrupteur de la page Notifications le dit en toutes lettres." },
        ],
      },
      {
        id: "iphone",
        heading: "Sur un iPhone ou un iPad",
        blocks: [
          { steps: [
            "Ouvrez FieldQuo dans Safari et connectez-vous.",
            "Tapotez le bouton Partager (le carré avec une flèche).",
            "Choisissez l'option Sur l'écran d'accueil de Safari et confirmez le nom.",
            "Ouvrez désormais FieldQuo depuis la nouvelle icône. Il s'ouvre plein écran, sur votre tableau de bord.",
          ] },
        ],
      },
      {
        id: "android",
        heading: "Sur un téléphone Android",
        blocks: [
          { steps: [
            "Ouvrez FieldQuo dans Chrome et connectez-vous.",
            "Ouvrez le menu de Chrome et choisissez son option d'installation ou d'ajout à l'écran d'accueil; certains téléphones la proposent aussi en bannière.",
            "Confirmez. L'icône apparaît sur l'écran d'accueil et dans le tiroir d'applications.",
          ] },
        ],
      },
      {
        id: "what-changes",
        heading: "Ce qui change une fois installé",
        blocks: [
          { bullets: [
            "**Il s'ouvre sur le back-office.** L'icône mène à votre tableau de bord, pas au site de marketing. Si vous êtes déconnecté, elle ouvre la page de connexion — comme n'importe quelle application.",
            "**Pas de barre d'adresse.** La page a tout l'écran. Les liens s'ouvrent quand même à l'intérieur.",
            "**Les notifications deviennent possibles sur un iPhone.** Avec l'icône installée et l'interrupteur activé, FieldQuo peut vous avertir — voir [[push-notifications|Notifications push]].",
            "**Rien d'autre.** Pas de mode hors ligne, pas de position en arrière-plan, pas de chargement plus rapide. Ce ne sont pas des choses que l'installation donne à une application web.",
          ] },
          { note: "Aucune option d'installation ne vous sera proposée sur le site web d'un entrepreneur ni sur une page de soumission ou de réservation. Ces pages portent la marque de l'entrepreneur, et FieldQuo n'y publie volontairement aucune description d'installation — un propriétaire de maison ne doit jamais se retrouver avec une icône FieldQuo après avoir visité le site d'un peintre." },
        ],
      },
    ],
    faq: [
      { q: "Suis-je obligé de l'installer?", a: "Non. Tout fonctionne dans l'onglet du navigateur. L'installation est une commodité — et, sur un iPhone, la seule façon de recevoir des notifications." },
      { q: "Comment le mettre à jour?", a: "Vous n'avez rien à faire. Chaque fois que vous l'ouvrez, il charge la version courante depuis le serveur." },
      { q: "Puis-je l'installer sur deux téléphones?", a: "Oui. Connectez-vous sur chacun; il n'y a pas de limite, et chaque téléphone décide de son propre interrupteur de notifications." },
    ],
  },

  "the-crew-tab-bar": {
    title: "La barre d'onglets de l'équipe",
    summary:
      "La barre au bas de la disposition mobile : quels onglets elle contient, pourquoi un équipier en voit trois, et où est passé tout le reste.",
    updated: "2026-09-12",
    intro: [
      "Sur un téléphone, la barre au bas de l'écran est votre moyen de vous déplacer. Elle contient les quatre écrans par lesquels le travail circule — **Prospects**, **Soumissions**, **Chantiers**, **Factures** — plus **Clavardage**, et un bouton **Plus** qui ouvre le menu complet. Les onglets que vous ne pouvez pas utiliser ne sont pas dessinés, alors la barre qu'un équipier voit est plus courte que celle du propriétaire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La barre apparaît dès que l'écran fait moins d'environ 1 024 pixels de largeur — tous les téléphones, la plupart des tablettes tenues à la verticale. L'onglet de l'écran courant est mis en évidence; les autres sont dans une couleur atténuée. Au-delà de cette largeur, la barre disparaît et la barre latérale prend le relais." },
          { figure: "harness:mobile-chat", caption: "Le salon de clavardage d'un chantier sur un téléphone, avec Clavardage mis en évidence dans la barre d'onglets et Plus à droite." },
        ],
      },
      {
        id: "the-tabs",
        heading: "Les onglets, et quand chacun apparaît",
        blocks: [
          { table: {
            head: ["Onglet", "Ouvre", "Affiché quand"],
            rows: [
              ["**Prospects**", "Le tableau des prospects", "Votre accès aux demandes (Requests) est au moins View only"],
              ["**Soumissions**", "La liste des soumissions", "Votre accès aux soumissions est au moins View only"],
              ["**Chantiers**", "La liste des chantiers", "Votre accès aux chantiers est au moins View only"],
              ["**Factures**", "La liste des factures", "Votre accès aux factures est au moins View only"],
              ["**Clavardage**", "Le clavardage de l'entreprise", "Toujours — tant que la fonction de clavardage d'équipe est activée pour votre entreprise"],
              ["**Plus**", "Le menu complet, en tiroir", "Toujours"],
            ],
          } },
          { p: "Les mêmes règles cachent les mêmes lignes dans le menu complet, et les pages derrière refusent au même niveau, alors la barre est un raccourci, pas la sécurité." },
        ],
      },
      {
        id: "what-a-crew-member-gets",
        heading: "Ce qu'un équipier obtient",
        blocks: [
          { p: "Le niveau Crew est réglé à No access sur les prospects, les soumissions et les factures, et à View only sur les chantiers — restreint aux chantiers où vous êtes réservé. La barre se lit donc **Chantiers · Clavardage · Plus**, et les trois se partagent la largeur également." },
          { bullets: [
            "**Chantiers** — les chantiers où vous avez une visite, avec l'adresse, les visites et la liste de vérification.",
            "**Clavardage** — #general, le salon de chaque chantier où vous êtes, et les messages directs. C'est le seul onglet que tous les niveaux gardent, parce que le clavardage est l'écran de l'équipe elle-même.",
            "**Plus** — la pointeuse, vos quarts, les congés, la sécurité, vos bulletins de paie, les paramètres.",
          ] },
        ],
      },
      {
        id: "the-more-drawer",
        heading: "Le tiroir Plus",
        blocks: [
          { p: "**Plus** n'ouvre pas un deuxième menu. Il ouvre le même tiroir que le bouton de menu du haut — le menu complet, regroupé exactement comme sur un ordinateur — pour qu'il y ait une seule liste d'écrans, et non deux qui pourraient se contredire. L'**Accueil** n'est pas un onglet : le logo FieldQuo dans la barre du haut vous y mène déjà." },
          { tip: "Si la barre ne montre rien d'autre que Plus, chacune de vos catégories de documents est réglée à No access. C'est une grille valide, pas un défaut — tout ce que vous pouvez utiliser est dans le tiroir." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je choisir quels onglets sont dans la barre?", a: "Non. Les cinq sont fixes — les quatre écrans de documents et le clavardage — et votre niveau d'accès décide lesquels sont dessinés." },
      { q: "Pourquoi n'y a-t-il pas d'onglet Pointeuse?", a: "La barre est réservée aux écrans par lesquels le travail circule et au clavardage. La pointeuse est à un tapotement sous Plus, et c'est pareil pour tout le monde, quel que soit le niveau." },
    ],
  },

  "what-a-crew-member-sees": {
    title: "Ce qu'un équipier voit",
    summary:
      "Le niveau d'accès Crew vu de l'intérieur : quelles lignes de menu apparaissent, ce qu'une page de chantier montre et cache, et pourquoi les prix ne sont nulle part.",
    updated: "2026-09-12",
    intro: [
      "**Crew** est le niveau d'accès des gens dans le camion — installateurs, aides, un deuxième peintre. Il ne coûte rien à l'entreprise et il est volontairement étroit : votre propre horaire, les chantiers où vous êtes réservé, la pointeuse, les congés, la sécurité, vos propres bulletins de paie. Aucun prix nulle part, pas de soumissions, pas de factures, pas de prospects, et pas de liste de clients.",
      "Cet article décrit ce que ça donne sur le téléphone. Il est écrit à partir de la grille de permissions du produit lui-même, alors il dit ce que le menu fait vraiment; si votre propriétaire vous a donné une grille personnalisée, certaines lignes peuvent différer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le préréglage Crew inscrit un niveau par domaine : horaire **View and complete their own schedule** (voir et compléter son propre horaire); suivi du temps **View, record, and edit their own** (voir, enregistrer et modifier le sien); paie **View their own payslips** (ses propres bulletins); notes **View notes on jobs and visits only** (les notes des chantiers et des visites seulement); clients **View client name and address only** (nom et adresse du client seulement); chantiers **View only** (restreint aux chantiers où vous êtes réservé); demandes, soumissions et factures **No access**; sécurité **Report incidents, and view their own** (signaler des incidents et voir les siens); et les trois interrupteurs d'argent fermés." },
          { note: "Crew est fixe. Choisissez-le et il n'y a pas de grille à déplacer — monter n'importe quel réglage au-dessus du plafond Crew fait de la personne un siège payant. Le propriétaire peut plutôt vous donner une grille Custom, qui est un siège." },
        ],
      },
      {
        id: "the-menu",
        heading: "Les lignes de menu que vous obtenez",
        blocks: [
          { table: {
            head: ["Ligne", "Ce qu'elle montre à un équipier"],
            rows: [
              ["**Accueil**", "Vos visites à venir et la liste des rendez-vous. La carte des soumissions et la carte de configuration ne sont pas dessinées."],
              ["**Chantiers**", "Seulement les chantiers où vous avez une visite."],
              ["**Calendrier**", "Les rendez-vous qui vous sont assignés, les rendez-vous non assignés, et les visites sur vos chantiers."],
              ["**À faire**", "Les tâches qui vous sont assignées, celles que vous avez créées, et les non assignées que n'importe qui peut prendre."],
              ["**Clavardage**", "#general, un salon par chantier où vous êtes, les messages directs."],
              ["**Attribuer les quarts**", "Vos propres quarts publiés — le titre est celui du gestionnaire; vous voyez votre semaine, en lecture seule."],
              ["**Pointeuse**", "Votre pointage, votre chantier, vos heures d'aujourd'hui."],
              ["**Congés**", "Vos soldes et vos demandes."],
              ["**Sécurité**", "Signaler un incident; voir ceux que vous avez signalés."],
              ["**Paie**", "Vos propres bulletins de paie."],
            ],
          } },
          { p: "Sous les groupes : **Aide** et **Paramètres**. Les paramètres gardent trois lignes pour vous — **Langue**, **Disponibilités** (vos propres heures réservables) et **Nouveautés**. Si votre entreprise a activé les textos d'équipe, une ligne **Boîte équipe** apparaît aussi, montrant seulement les textos que vous avez envoyés." },
        ],
      },
      {
        id: "on-a-job",
        heading: "Sur une page de chantier",
        blocks: [
          { bullets: [
            "Le **nom et l'adresse** du client, et l'adresse du site. Le numéro de téléphone et le courriel sont retenus par votre niveau — la page du chantier le dit à côté du bouton En route, et le client reçoit quand même le texto.",
            "**Visites** : la date et l'heure, qui est assigné, la liste de vérification avec ses points d'arrêt, et — sur les visites qui vous sont assignées — **En route**, **Marquer comme terminée** et **Annuler la visite**.",
            "**Matériaux à acheter**, en liste avec les quantités et sans prix.",
            "**Photos du chantier** avec un bouton de téléversement, et le **Journal de chantier** que vous pouvez rédiger et enregistrer — voir [[photos-from-the-field|Photos depuis le terrain]].",
            "Les notes de la visite elle-même. Les notes privées sur le client et le journal de rappels du prospect ne sont pas affichés.",
          ] },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "Ce qui est caché, et pourquoi",
        blocks: [
          { bullets: [
            "**Prospects, Soumissions, Factures, Forfaits, Messages** — No access veut dire que la ligne disparaît et que la page refuse. Un équipier ne lit jamais un prix facturé au client.",
            "**Clients et Équipement client** — la liste de clients est l'actif le plus facile à emporter de l'entreprise. Vous obtenez une adresse sur votre propre travail, pas le carnet.",
            "**Équipe, Calendrier de l'équipe, Feuilles de temps, Dépenses, Analyses, KPI, Marketing, Réceptionniste, Forfait, Parrainage** — des écrans de gestion et d'argent; la route serveur de chacun refuse sous le niveau qui affiche la ligne.",
            "**Ce que ce projet a coûté** et chaque carte de coût de revient — l'interrupteur du coût de revient des chantiers est fermé.",
            "**Modifier vos propres heures** — la permission existe, mais le seul écran qui modifie des entrées est Feuilles de temps, que le niveau Crew n'ouvre pas. Une sortie oubliée est corrigée par votre gestionnaire.",
          ] },
        ],
      },
      {
        id: "who-decides",
        heading: "Qui décide",
        blocks: [
          { p: "Le propriétaire ou un administrateur règle votre niveau dans **Gérer l'équipe**; un Manager ou un Dispatcher peut vous inviter au niveau Crew mais ne peut pas changer l'accès d'une personne existante. Cacher une ligne est cosmétique — la route serveur de chaque page revérifie la même grille, et c'est pourquoi un écran qu'on ne vous a pas montré répond par un refus plutôt que par la page. Le détail complet : [[role-crew|Le niveau Crew]] et [[access-levels-overview|Niveaux d'accès : qui voit quoi]]." },
          { tip: "S'il vous manque quelque chose que vous ne voyez pas — le numéro de téléphone d'un client, un prix pour un fournisseur — demandez plutôt que de contourner. Le propriétaire peut vous passer à une grille Custom d'un seul menu déroulant." },
        ],
      },
    ],
    faq: [
      { q: "Je vois un chantier mais pas le numéro de téléphone du client. Est-ce un bogue?", a: "Non. Le niveau Crew montre seulement le nom et l'adresse d'un client. Quand vous tapotez En route, le client reçoit quand même le texto; le numéro vous est caché, il n'est pas manquant." },
      { q: "Pourquoi un chantier où j'ai travaillé le mois dernier a-t-il disparu de ma liste?", a: "La liste montre les chantiers où vous avez une visite. Si la visite a été déplacée à quelqu'un d'autre, le chantier quitte votre liste. Son salon de clavardage reste sous Travaux terminés si le chantier est fini." },
      { q: "Puis-je enregistrer une dépense depuis mon téléphone?", a: "Pas aujourd'hui. Le niveau Crew permet d'enregistrer ses propres dépenses dans la grille de permissions, mais les écrans de dépenses sont des écrans de gestion que le niveau Crew n'ouvre pas. Remettez les reçus au bureau." },
    ],
  },

  "clock-in-and-out-on-your-phone": {
    title: "Pointer l'entrée et la sortie sur votre téléphone",
    summary:
      "La pointeuse : un gros bouton, le chantier où les heures atterrissent, changer de chantier en cours de journée, et ce qu'on demande à votre téléphone quand vous tapotez.",
    updated: "2026-09-12",
    intro: [
      "**Pointeuse** est l'écran qu'un travailleur à l'heure touche à chaque quart. Il est volontairement dépouillé : l'heure, un bouton, le chantier où vous êtes, et les heures d'aujourd'hui. Chaque tapotement écrit une simple entrée de temps sur le serveur; le bureau la révise dans Feuilles de temps, et c'est seulement là qu'elle atteint une paie.",
      "La seule chose à savoir avant votre premier tapotement : quand vous appuyez sur **Pointer l'entrée** ou **Pointer la sortie**, votre téléphone est interrogé sur sa position — une seule fois, avec la fenêtre de permission du téléphone lui-même — et cette position unique est conservée à côté du pointage pour que la feuille de temps puisse indiquer à quelle distance du chantier vous étiez. Rien ne tourne en arrière-plan et rien n'est suivi entre deux tapotements.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Vous ne pouvez être pointé qu'une fois : une seule entrée ouverte par travailleur. Pointer l'entrée l'ouvre sur le chantier que vous avez choisi (ou sur aucun chantier), pointer la sortie la ferme et les heures sont calculées. L'entrée est enregistrée comme en attente et va à votre gestionnaire, ce que dit la note au bas de l'écran : **Vos heures sont transmises à votre gestionnaire pour révision et approbation.** Voir [[the-time-clock|La pointeuse]] pour le côté du bureau et [[timesheets-and-approving-hours|Feuilles de temps : réviser et approuver les heures]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Le cadran** — la date du jour et l'heure en direct. Une fois pointé, il ajoute une pastille **En service**, le temps écoulé, **Depuis** votre heure d'entrée, et **Sur** le nom du chantier (ou **Rattaché à aucun chantier**). Une fois sorti, il se lit **Vous êtes hors service.**",
            "**Quel chantier?** — un sélecteur, affiché seulement quand vous êtes hors service et seulement quand votre entreprise a des chantiers en cours. **Aucun chantier — déplacement, cour, soumissions** est en haut; puis **Prévu pour vous aujourd'hui** et **Vos autres chantiers en cours**.",
            "**La ligne de position** — affichée seulement tant que le téléphone n'a pas encore répondu à la question de permission, pour que vous lisiez pourquoi avant que le téléphone demande.",
            "**Pointer l'entrée** (vert) ou **Pointer la sortie** (rouge) — le seul bouton.",
            "**Aujourd'hui** — le total de la journée et chaque entrée avec ses heures et son chantier, plus la note disant que vos heures vont à votre gestionnaire.",
          ] },
          { figure: "harness:mobile-clock", caption: "La pointeuse sur un téléphone — En service depuis 7 h 28 sur le chantier de la cuisine Dubois, la note de position, le bouton Pointer la sortie, et Vous avez changé de chantier? dessous." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment pointer l'entrée et la sortie",
        blocks: [
          { steps: [
            "Ouvrez **Plus → Pointeuse** (ou mettez-la en favoris).",
            "Vérifiez le chantier sous **Quel chantier?** Si vous avez exactement une visite aujourd'hui, il est rempli pour vous et l'écran le dit; avec plusieurs, il vous demande de choisir celle que vous commencez; sans aucune, il le dit et laisse vide.",
            "Tapotez **Pointer l'entrée**. Si votre téléphone demande si FieldQuo peut utiliser votre position, répondez une fois; un refus ne change rien au pointage.",
            "Travaillez. Le temps écoulé défile à l'écran; il continue aussi de compter sur le serveur si vous fermez l'onglet ou si la pile meurt.",
            "Tapotez **Pointer la sortie**. L'entrée passe dans **Aujourd'hui** avec ses heures.",
          ] },
          { figure: "live:app-clock", caption: "Le même écran sur un ordinateur — le cadran, la liste Aujourd'hui avec chaque entrée et son chantier, et la note de révision." },
        ],
      },
      {
        id: "switch-job",
        heading: "Vous avez changé de chantier?",
        blocks: [
          { p: "Rester pointé toute la journée met tout le quart sur le premier chantier. La carte **Vous avez changé de chantier?** règle ça : choisissez le nouveau chantier et tapotez **Changer de chantier**. L'entrée courante est fermée à cet instant et une nouvelle est ouverte sur le nouveau chantier — les heures déjà travaillées gardent le chantier où elles ont été faites, et, comme le dit la carte, une nouvelle entrée commence maintenant." },
          { note: "Changer de chantier est désactivé tant que le sélecteur montre le chantier où vous êtes déjà. Il n'y a pas d'annulation : si vous avez changé pour le mauvais chantier, changez de nouveau — la minute entre les deux atterrit sur le mauvais chantier et votre gestionnaire peut la corriger dans Feuilles de temps." },
        ],
      },
      {
        id: "location",
        heading: "Où était le téléphone, et ce que le bureau voit",
        blocks: [
          { p: "La position est stockée à côté du pointage avec la distance au site du chantier, calculée une seule fois. Dans Feuilles de temps, chaque pointage porte une puce : **Entrée · Sur place** quand le téléphone était à moins de **250 m** du site, **Entrée · à 2,1 km** en ambre quand il était plus loin, et **—** quand rien d'honnête ne peut être dit — pas de position, un chantier sans adresse de site, ou un relevé si imprécis (un cercle de précision plus large que 250 m) que le téléphone aurait pu être n'importe où." },
          { p: "Une puce « à distance » est une question pour votre gestionnaire, pas un verdict : l'approbation reste un bouton qu'une personne appuie. L'horloge du téléphone n'est pas prise pour acquise non plus — un horodatage qui s'écarte de plus de 15 minutes de l'heure du serveur est refusé plutôt qu'enregistré." },
          { note: "FieldQuo n'a aucun moyen de détecter que vous êtes arrivé. Un navigateur ne peut lire la position que pendant que sa page est ouverte et au premier plan, alors l'écran demande au tapotement au lieu de deviner, et ne stocke rien entre deux tapotements." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "Toute personne dont le compte est lié à une fiche de travailleur. Si l'écran affiche **Vous n'êtes pas encore configuré comme intervenant. Demandez à un administrateur de vous ajouter sous Équipe.**, un propriétaire ou un administrateur doit vous ajouter dans l'onglet **Travailleurs** de Gérer l'équipe — l'onglet qu'eux seuls voient. Le niveau Crew enregistre et voit son propre temps; réviser, modifier et approuver celui de tout le monde, c'est le niveau Dispatcher et au-dessus." },
        ],
      },
    ],
    faq: [
      { q: "J'ai oublié de pointer ma sortie hier.", a: "L'entrée est toujours ouverte sur le serveur. Pointez la sortie maintenant et dites-le à votre gestionnaire — il corrige l'heure dans Feuilles de temps, et l'entrée repasse en attente de révision." },
      { q: "Puis-je pointer de chez moi et conduire jusqu'au chantier?", a: "Vous pouvez, et le pointage le dira : la puce de la feuille de temps montre à quelle distance du site le téléphone était quand vous avez tapoté. Choisissez Aucun chantier pour le trajet, ou demandez à votre entreprise ce qu'elle veut." },
      { q: "Le téléphone ne m'a jamais demandé ma position.", a: "Soit vous avez déjà répondu une fois (permis ou refusé) et le téléphone s'en souvient, soit le navigateur n'a pas de position du tout. Dans les deux cas, le pointage passe; seule la puce sur la feuille de temps est touchée." },
      { q: "Puis-je corriger mes propres heures?", a: "Pas depuis le téléphone aujourd'hui. Votre gestionnaire corrige une entrée dans Feuilles de temps; une correction remet l'entrée en attente pour que quelqu'un la revérifie." },
    ],
  },

  "your-schedule-on-your-phone": {
    title: "Votre horaire sur votre téléphone",
    summary:
      "Où vit la journée d'un équipier : les quarts publiés sous Attribuer les quarts, les rendez-vous dans le Calendrier, les visites sur le chantier, et les tâches à faire.",
    updated: "2026-09-12",
    intro: [
      "Votre journée est à trois endroits, exprès, parce que ce sont trois choses différentes : un **quart**, ce sont les heures que votre gestionnaire a publiées pour vous; une **visite**, c'est un bloc de travail réservé sur un chantier; une **tâche à faire**, c'est une tâche à votre nom. Les trois ne montrent que ce qui est à vous, et aucun ne montre un brouillon que le bureau n'a pas publié.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le réglage d'horaire du niveau Crew est **View and complete their own schedule** (voir et compléter son propre horaire) : vous voyez vos propres heures et pouvez marquer vos propres visites terminées, et vous ne pouvez ni voir ni déplacer celles de quelqu'un d'autre. Le Calendrier de l'équipe — les disponibilités de tout le monde sur une page — est un écran de gestion et n'est pas dans votre menu." },
        ],
      },
      {
        id: "where-to-look",
        heading: "Où regarder",
        blocks: [
          { table: {
            head: ["Ligne", "Ce qu'elle montre", "Ce que vous pouvez faire"],
            rows: [
              ["**Attribuer les quarts**", "Vos quarts publiés, une semaine à la fois, du dimanche au samedi, aujourd'hui encadré", "Les lire. La ligne du bas dit : Voici les quarts publiés par votre gestionnaire. Revenez pour les changements."],
              ["**Calendrier**", "Les rendez-vous qui vous sont assignés, les non assignés, et les visites sur vos chantiers", "Ouvrir le chantier; sur votre propre visite, En route et Marquer comme terminée."],
              ["**Chantiers**", "Les chantiers où vous avez une visite, avec la date et l'heure de chaque visite", "Cocher la liste de vérification, ajouter des photos, rédiger le journal de chantier."],
              ["**À faire**", "Les tâches qui vous sont assignées, celles que vous avez créées, et les non assignées", "Prendre une tâche non assignée; terminer les vôtres."],
            ],
          } },
        ],
      },
      {
        id: "shifts",
        heading: "Vos quarts",
        blocks: [
          { p: "Un gestionnaire prépare la semaine sur l'écran Horaire et appuie sur **Publier la semaine**; jusque-là, un quart est un **Brouillon** que l'équipe ne peut pas voir. Une fois publié, votre quart montre son début et sa fin, le chantier, et toute note que le gestionnaire a tapée — où être, quoi apporter. Si un quart a été placé en dehors des heures où vous avez dit être disponible, le quart lui-même affiche **En dehors des disponibilités déclarées**, avec qui l'a fait et pourquoi, pour que vous l'appreniez ici plutôt que le matin même." },
          { figure: "harness:scheduler", caption: "L'horaire tel qu'un gestionnaire le voit — la semaine en cartes par jour, Ajouter un quart et Publier la semaine. Un équipier voit les mêmes cartes avec seulement ses propres quarts publiés, et aucun bouton." },
          { note: "La ligne de l'écran s'intitule **Attribuer les quarts** pour tout le monde parce que le titre est celui du gestionnaire. Vous n'attribuez rien; vous lisez ce qui vous a été attribué." },
        ],
      },
      {
        id: "visits",
        heading: "Une visite, de l'arrivée à la fin",
        blocks: [
          { steps: [
            "Ouvrez le chantier depuis **Chantiers** ou depuis le **Calendrier**. Votre visite montre son heure, qui est assigné, et le nombre d'éléments de la liste de vérification.",
            "Tapotez **En route**. Le client reçoit par texto le message « en route » de votre entreprise; la ligne sous le bouton dit où il va — ou que rien ne sera envoyé parce que le client n'a pas de cellulaire au dossier. Votre téléphone est interrogé sur sa position, une fois.",
            "Parcourez la liste de vérification. Un point d'arrêt est une étape que quelqu'un doit confirmer avant la suivante; une étape marquée **Photo expected** (photo attendue) est un rappel, pas un verrou.",
            "Tapotez **Marquer comme terminée**. La visite est terminée; le bureau le voit et les prochaines étapes du chantier suivent.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Vos propres quarts et visites : vous. Ceux de tout le monde : le niveau Dispatcher et au-dessus, qui les préparent et les publient aussi. Vos heures réservables — le motif en dehors duquel le gestionnaire est averti de ne pas planifier — sont à vous sous **Paramètres → Disponibilités**; voir [[working-hours-and-bookable-hours|Heures de travail et heures réservables]]. Le côté du gestionnaire est dans [[the-scheduler-and-crew-shifts|L'horaire : préparer et publier la semaine de l'équipe]]." },
        ],
      },
    ],
    faq: [
      { q: "Mon gestionnaire dit que le quart est là mais je ne le vois pas.", a: "Il n'a pas été publié. Un quart est un brouillon, invisible pour l'équipe, jusqu'à ce que le gestionnaire appuie sur Publier la semaine." },
      { q: "Puis-je échanger un quart avec un collègue?", a: "Pas dans FieldQuo. Demandez à votre gestionnaire de le déplacer; le niveau Crew ne peut pas modifier les quarts, les siens compris." },
      { q: "Pourquoi je vois un rendez-vous qui n'est assigné à personne?", a: "Les rendez-vous non assignés sont montrés à tout le monde, exprès — un chantier non réclamé que personne ne voit est un chantier que personne ne fait. Les visites non assignées, elles, n'apparaissent que sur les chantiers où vous êtes déjà." },
    ],
  },

  "photos-from-the-field": {
    title: "Photos depuis le terrain",
    summary:
      "Deux façons pour une photo de passer de votre téléphone au chantier : la téléverser sur la page du chantier, ou la texter. Ce que l'équipe peut en faire, et ce que le bureau fait ensuite.",
    updated: "2026-09-12",
    intro: [
      "Une photo classée sur le chantier est le document que l'entrepreneur cherche en premier — avant, pendant, terminé, et la chose qui était déjà brisée quand vous avez ouvert le mur. FieldQuo garde chaque photo sur le chantier auquel elle appartient, datée, dans l'ordre où le travail s'est fait, et le bureau choisit ensuite les bonnes pour la soumission, la facture ou le site web.",
      "Depuis le téléphone, vous avez deux portes d'entrée : le bouton de téléversement sur la page du chantier, ou un texto à la ligne d'équipe de l'entreprise sans aucune application ouverte. Cet article couvre la première; la voie par texto est [[text-a-photo-to-the-crew-inbox|Texter une photo sans application]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque photo porte une **étape** — Before / start, In progress, Finished ou Issue / snag (avant, en cours, terminé, problème) — et peut porter les **étiquettes** de votre entreprise (ponçage, apprêt, couche de finition). Le début et la fin d'un même chantier deviennent l'avant-après que montre votre site web. Une photo de problème est un dossier de bureau : elle ne peut jamais aller sur le site web, et l'écran le dit plutôt que de ne rien faire en silence." },
        ],
      },
      {
        id: "two-ways",
        heading: "Deux portes d'entrée",
        blocks: [
          { bullets: [
            "**Téléverser sur la page du chantier.** Ouvrez le chantier, descendez jusqu'à **Photos du chantier**, tapotez le bouton de téléversement et choisissez l'appareil photo ou la pellicule. Classée immédiatement comme In progress.",
            "**La texter à la ligne d'équipe.** Envoyez la photo, avec ou sans quelques mots, au numéro de votre entreprise. Elle se classe d'elle-même sur le chantier où vous êtes ce jour-là, et les mots que vous avez tapés fixent l'étape.",
          ] },
        ],
      },
      {
        id: "upload",
        heading: "Comment téléverser depuis la page du chantier",
        blocks: [
          { steps: [
            "Ouvrez le chantier depuis **Chantiers**.",
            "Descendez jusqu'à la carte **Photos du chantier**. Elle montre chaque photo classée jusqu'ici, et combien sont sur votre site web.",
            "Tapotez le bouton de téléversement sous la grille et choisissez l'appareil photo ou une photo existante. Jusqu'à 12 à la fois; une photo peut faire jusqu'à 15 Mo, alors une photo de téléphone brute convient.",
            "Attendez la fin du téléversement — le bouton indique qu'il téléverse — et les photos apparaissent dans la grille, classées comme In progress.",
            "Dites-en un mot dans le salon de clavardage du chantier si le bureau doit regarder maintenant; la photo elle-même n'avertit personne.",
          ] },
          { figure: "harness:mobile-job", caption: "La page du chantier sur un téléphone — la visite, sa liste de vérification avec une étape Photo expected, et la carte Photos du chantier plus bas." },
        ],
      },
      {
        id: "stages-and-tags",
        heading: "Étapes, étiquettes et site web",
        blocks: [
          { table: {
            head: ["Étape", "Sens", "Peut aller sur le site web"],
            rows: [
              ["Before / start", "L'état trouvé; le premier jour", "Oui — s'apparie avec une photo Finished"],
              ["In progress", "En plein chantier; l'étape par défaut d'un téléversement", "Oui"],
              ["Finished", "Terminé; l'après", "Oui — s'apparie avec une photo Before"],
              ["Issue / snag", "Un dommage, une fuite, quelque chose qui cloche", "Jamais"],
            ],
          } },
          { p: "Changer une étape, étoiler une photo pour le site web, dessiner dessus et changer ses étiquettes sont des décisions de curation, et elles exigent l'accès en modification aux chantiers — les niveaux Estimator et Crew voient les photos et l'étape mais pas ces commandes. Une photo que vous téléversez atterrit comme In progress; une photo que vous textez reçoit son étape de vos mots. Les étiquettes se créent dans **Paramètres → Étiquettes des photos de chantier**; voir [[job-photos-and-tags|Photos de chantier et étiquettes]]." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "Ce que le niveau Crew ne peut pas faire",
        blocks: [
          { bullets: [
            "Changer l'étape d'une photo, l'étoiler pour le site web, l'annoter ou l'étiqueter — ces commandes ne sont pas dessinées pour vous, parce qu'elles refuseraient.",
            "Supprimer une photo. Personne ne supprime de photos depuis la page du chantier.",
            "Téléverser sur un chantier où vous n'êtes pas réservé. Le chantier n'est pas dans votre liste, et le serveur répond introuvable.",
            "Joindre une photo à une étape de la liste de vérification. **Photo expected** sur une étape est un rappel; cocher l'étape n'en demande pas une.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut les voir",
        blocks: [
          { p: "Toute personne qui peut ouvrir le chantier voit ses photos et l'**Historique photo** avec son filtre par étiquette. Téléverser n'exige que View only sur les chantiers — niveaux Crew et Estimator compris — sur les chantiers où vous êtes. Faire la curation exige **View, create, and edit** (voir, créer et modifier) sur les chantiers : le niveau Dispatcher et au-dessus. Vous pouvez commenter une photo à n'importe quel niveau." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce que téléverser une photo avertit le bureau?", a: "Non. Ça classe la photo. Si quelqu'un doit regarder maintenant, dites-le dans le salon de clavardage du chantier — une mention avertit la personne nommée." },
      { q: "Puis-je téléverser une vidéo?", a: "La commande de téléversement accepte une vidéo, mais la carte de photos du chantier est bâtie autour des photos et de l'appariement avant-après. Utilisez des photos pour le dossier du chantier." },
      { q: "J'ai téléversé une photo avec la mauvaise étape.", a: "Demandez à quelqu'un qui a l'accès en modification aux chantiers de la reclasser — un tapotement sur l'étape de la photo. Le niveau Crew ne le peut pas." },
    ],
  },

  "text-a-photo-to-the-crew-inbox": {
    title: "Texter une photo sans application",
    summary:
      "Envoyez une photo par texto à la ligne d'équipe de votre entreprise et elle se classe d'elle-même sur le chantier où vous êtes ce jour-là. Quoi texter, ce que la ligne répond, et ce que ça coûte à l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "La ligne d'équipe est un seul numéro de téléphone pour toute l'entreprise. Un équipier lui texte une photo — un simple message photo, sans application, sans connexion, depuis n'importe quel téléphone — et FieldQuo classe la photo sur le chantier où cette personne est prévue ce jour-là. Quand il ne peut pas dire quel chantier, il demande par texto, et quand il ne peut toujours pas, la photo attend dans la **Boîte équipe** du bureau qu'une personne choisisse.",
      "Ça fonctionne parce que l'horaire est celui de FieldQuo : les candidats sont vos visites de la journée, celles de personne d'autre. Cet article est écrit pour la personne qui texte; l'écran du bureau est [[the-crew-inbox|La boîte équipe : photos et mises à jour par texto]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un texto arrive, FieldQuo trouve qui l'a envoyé grâce au numéro de cellulaire de votre fiche de travailleur, réhéberge la photo, et détermine le chantier : si vos mots nomment un client, un numéro civique ou un titre de chantier, ce chantier; si la photo porte une position qui tombe clairement sur un seul site, ce chantier; si vous avez exactement une visite ce jour-là, ce chantier, en silence; sinon, il vous texte la liste et attend un numéro." },
          { figure: "harness:crew-inbox", caption: "La boîte équipe telle que le bureau la voit — le panneau Textos de l'équipe avec le numéro et les tarifs, une photo sous Votre attention — choisissez le chantier, et la liste Classés." },
        ],
      },
      {
        id: "before-it-works",
        heading: "Avant que ça fonctionne",
        blocks: [
          { steps: [
            "Votre entreprise active les textos d'équipe et obtient un numéro — une ligne d'essai FieldQuo partagée ou la sienne — sur l'écran **Boîte équipe**. C'est une décision de propriétaire, d'administrateur ou de gestionnaire, parce que les textos sont facturés au crédit de l'entreprise.",
            "Un propriétaire ou un administrateur ajoute votre cellulaire à votre fiche de travailleur dans l'onglet **Travailleurs** de Gérer l'équipe. Tant qu'il n'y est pas, vos textos arrivent d'un numéro inconnu et ne se classent nulle part.",
            "Enregistrez le numéro d'équipe dans les contacts de votre téléphone. C'est celui du panneau **Textos de l'équipe** : **Votre équipe texte ce numéro**.",
          ] },
          { note: "Les textos d'un numéro qui n'est pas sur la liste ne reçoivent aucune réponse, sauf pendant les tout premiers messages d'une entreprise, où la ligne répond une fois pour dire que le numéro n'est pas encore dans l'équipe. Le silence ensuite est voulu — une ligne qui répond aux inconnus est une ligne que les polluposteurs gardent." },
        ],
      },
      {
        id: "how-it-files",
        heading: "Comment une photo se classe",
        blocks: [
          { bullets: [
            "**Une seule visite aujourd'hui** — classée tout de suite, sans réponse. La photo atterrit sur cette visite, et dans les photos du chantier.",
            "**Un nom dans votre texto** — le nom de famille d'un client, un numéro civique ou un mot du titre du chantier choisit ce chantier. La réponse confirme où elle est allée.",
            "**Plusieurs visites, rien de dit** — vous recevez une liste numérotée et la question. Répondez avec le numéro, ou un mot distinctif, dans les 12 heures. Une nouvelle photo avant votre réponse abandonne la question et recommence.",
            "**Aucune visite aujourd'hui** — la ligne dit qu'elle ne voit aucun chantier à votre horaire où classer ceci, et la photo attend dans la boîte du bureau sous Votre attention.",
          ] },
          { p: "Vos mots fixent aussi l'étape : quelque chose comme before ou starting la classe comme Before / start, done ou finished comme Finished, et issue, leak, damage ou broken comme Issue / snag. Les mots-clés, la question et la confirmation sont en anglais, quelle que soit votre langue." },
        ],
      },
      {
        id: "what-it-texts-back",
        heading: "Ce que la ligne répond",
        blocks: [
          { table: {
            head: ["Ce qui s'est passé", "Réponse"],
            rows: [
              ["Classée sur votre seul chantier de la journée", "Rien — elle classe, c'est tout"],
              ["Classée après votre choix, ou après avoir déduit le chantier", "Une confirmation d'une ligne qui nomme le chantier"],
              ["Plusieurs chantiers possibles", "Une liste numérotée qui se termine par Reply with the number (répondez avec le numéro)"],
            ],
          } },
        ],
      },
      {
        id: "costs",
        heading: "Ce que ça coûte",
        blocks: [
          { p: "Les textos et les photos sont comptés sur le crédit de l'entreprise — le même solde que l'agent téléphonique — aux tarifs imprimés sur le panneau Textos de l'équipe : quelques cents par texto et par photo. Quand le crédit est épuisé, les textos d'équipe se mettent en pause et le panneau le dit; une recharge les rebranche. Rien ne vous est jamais facturé." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La ligne **Boîte équipe** apparaît dès que les textos d'équipe sont activés. Les niveaux Crew et Estimator voient seulement les textos qu'ils ont envoyés; le niveau Dispatcher et au-dessus voient ceux de tout le monde, et ce sont eux qui vident la file Votre attention. Configurer la ligne ou la désactiver relève du propriétaire, de l'administrateur ou du gestionnaire." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je avoir l'application ouverte pour texter une photo?", a: "Non. C'est tout l'intérêt — un simple message photo depuis n'importe quel téléphone, et la photo est sur le chantier avant que vous soyez de retour dans le camion." },
      { q: "J'ai texté une photo et je n'ai eu aucune réponse. Est-ce que ça a marché?", a: "Si vous aviez une seule visite ce jour-là, oui — un classement silencieux est le cas normal. Si votre numéro n'est pas sur la liste, non; demandez à un propriétaire d'ajouter votre cellulaire dans l'onglet Travailleurs." },
      { q: "Puis-je texter le numéro du client à la place?", a: "Non. La ligne d'équipe est un seul numéro pour l'entreprise; il est sur le panneau Textos de l'équipe et vaut la peine d'être enregistré dans vos contacts." },
    ],
  },

  "chat-on-your-phone": {
    title: "Clavarder sur votre téléphone",
    summary:
      "Le clavardage de l'entreprise depuis le téléphone d'un équipier : #general, un salon pour chaque chantier où vous êtes, les messages directs, les mentions, et ce qu'un message peut ou non transporter.",
    updated: "2026-09-12",
    intro: [
      "**Clavardage**, c'est votre entreprise qui se parle à elle-même. #general, c'est toute l'équipe; chaque chantier au calendrier a son propre salon pour l'équipe qui y est réservée et le bureau; un message direct, c'est entre vous deux. Rien ne sort de l'entreprise, et c'est le seul onglet que tous les niveaux d'accès gardent dans la barre d'onglets du téléphone.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La liste regroupe les salons en **Non lus**, **Entreprise**, **Travaux**, **Messages directs** et **Travaux terminés**. Ouvrez-en un et vous obtenez le fil avec un séparateur **Messages non lus** là où vous vous étiez arrêté, le panneau **Membres**, un lien **Ouvrir le travail** sur un salon de chantier, et la zone de rédaction en bas. La liste se rafraîchit d'elle-même toutes les 15 secondes tant que l'écran est ouvert." },
          { figure: "harness:mobile-chat", caption: "Un salon de chantier sur un téléphone — le séparateur des non-lus, un message mis en évidence qui mentionne deux personnes, la zone de rédaction avec son compteur de caractères, et Envoyer." },
        ],
      },
      {
        id: "rooms",
        heading: "Les salons",
        blocks: [
          { table: {
            head: ["Salon", "Qui y est", "Comment on y entre"],
            rows: [
              ["**#general**", "Toute l'équipe", "Dès que votre invitation est acceptée; vous en sortez quand votre compte est désactivé"],
              ["Un salon de chantier", "Quiconque est réservé sur une des visites du chantier, plus le propriétaire, les administrateurs et les gestionnaires", "Être réservé sur une visite"],
              ["Un message direct", "Seulement vous deux — personne d'autre ne peut le lire", "**Nouveau message**, puis un nom"],
              ["**Travaux terminés**", "Les mêmes personnes, en lecture pour les archives", "Le chantier est terminé; le salon est conservé"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Comment envoyer un message",
        blocks: [
          { steps: [
            "Tapotez **Clavardage** dans la barre d'onglets.",
            "Ouvrez le salon — ou **Nouveau message** pour commencer un message direct avec quelqu'un de l'équipe.",
            "Tapez dans la zone de rédaction. Jusqu'à 4 000 caractères; le compteur s'affiche sous la boîte.",
            "Pour adresser un message à quelqu'un, tapez @ et choisissez la personne dans la liste. Seules les personnes du salon peuvent être mentionnées.",
            "Tapotez **Envoyer**. En cas d'échec, le message se lit **Non envoyé.** avec **Remettre dans la boîte** — vos mots ne sont pas perdus.",
          ] },
        ],
      },
      {
        id: "mentions-and-alerts",
        heading: "Les mentions, et qui est averti",
        blocks: [
          { p: "Un message direct avertit l'autre personne; une mention avertit les personnes nommées. Jamais l'auteur, jamais tout le salon. La cloche compte vos salons non lus, et si la personne a activé les notifications du navigateur, un message direct ou une mention lui parvient aussi en notification — **Nouveau message de …** ou **… vous a mentionné dans #general**." },
          { note: "Il n'y a ni accusé de lecture ni indicateur de saisie. Ouvrir un salon le marque lu pour vous; personne d'autre ne le voit." },
        ],
      },
      {
        id: "limits",
        heading: "Ce qu'un message ne peut pas transporter",
        blocks: [
          { bullets: [
            "**Des photos ou des fichiers.** La zone de rédaction est texte seulement. Mettez la photo sur le chantier — téléversez-la ou textez-la — et dites-le dans le salon.",
            "**Des clients.** Rien ici n'atteint un propriétaire de maison; le clavardage est interne par construction.",
            "**Des modifications ou des suppressions.** Un message envoyé reste tel qu'envoyé.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute personne sur la liste, à tous les niveaux d'accès, quand la fonction de clavardage d'équipe est activée pour l'entreprise. Une session de soutien en lecture seule de FieldQuo peut voir le clavardage et ne peut pas y écrire, et l'écran le dit. Le côté bureau d'un salon de chantier est dans [[a-chat-room-for-every-job|Un salon de clavardage pour chaque chantier]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi je ne vois pas de salon pour le chantier où je suis?", a: "Vous êtes dans le salon d'un chantier quand vous êtes réservé sur une de ses visites. Si votre nom n'est pas sur une visite, demandez au bureau de vous y réserver — c'est la seule porte d'entrée." },
      { q: "Puis-je envoyer une photo dans le clavardage?", a: "Non. Téléversez-la sur la page du chantier ou textez-la à la ligne d'équipe, puis mentionnez la personne qui doit regarder." },
      { q: "Vais-je recevoir une notification pour chaque message?", a: "Non. Seulement pour un message direct qui vous est adressé, ou un message qui vous mentionne — et seulement si les notifications sont activées dans votre navigateur." },
    ],
  },

  "time-off-on-your-phone": {
    title: "Demander un congé depuis votre téléphone",
    summary:
      "Demander une journée de congé, voir ce qu'il vous reste, retirer une demande, et savoir qui la fait attendre.",
    updated: "2026-09-12",
    intro: [
      "**Congés** est un seul écran avec deux fonctions : ce qu'il vous reste, et vos demandes. Une demande va à la personne à qui vous rendez des comptes; certains types sont approuvés automatiquement dès que vous soumettez; et tant qu'elle n'est pas prise, vous pouvez la retirer vous-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "En haut, une carte par type de congé que votre entreprise a configuré — vacances, jours de maladie, journée personnelle, peu importe comment le propriétaire l'a nommé — avec **Accumulé**, **Pris**, ce qui est en attente d'approbation, et les jours **Restant**. Dessous, **Vos demandes** avec le bouton **Demander un congé**, chaque demande avec sa pastille d'état et, tant qu'elle est en attente, une ligne disant qui la fait attendre. Si aucune politique de congé n'existe encore, l'écran le dit et nomme la page de paramètres qu'un propriétaire utilise pour en ajouter." },
          { figure: "harness:mobile-time-off", caption: "Les congés sur un téléphone — les cartes de solde Vacances et Journée personnelle, Demander un congé, et une demande en attente avec son bouton Withdraw." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment demander un congé",
        blocks: [
          { steps: [
            "Ouvrez **Plus → Congés**.",
            "Tapotez **Demander un congé**.",
            "Choisissez le **Type**. Un type non payé n'est pas limité par un solde; un type payé affiche les jours dont vous disposez.",
            "Réglez **Premier jour** et **Dernier jour**, ou cochez **Demi-journée seulement** pour une demi-journée.",
            "Ajoutez une **Note (facultatif)** — tout ce que votre gestionnaire devrait savoir.",
            "Tapotez **Envoyer la demande**. Si le type est approuvé automatiquement, l'écran vous l'a déjà dit : l'envoi le réserve.",
          ] },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Ce qui se passe ensuite",
        blocks: [
          { bullets: [
            "La demande apparaît sous **Vos demandes** comme **En attente**, avec la ligne disant qui la fait attendre — la personne à qui vous rendez des comptes, ou un propriétaire ou un administrateur si personne n'est défini ou si votre gestionnaire est absent aujourd'hui. L'acheminement est recalculé à chaque chargement de l'écran, alors il suit votre gestionnaire à son retour de ses propres vacances.",
            "Les personnes qui peuvent y répondre reçoivent une notification dans leur cloche — et sur leur téléphone si elles ont activé les notifications.",
            "Elles font **Approuver** ou **Refuser** dans leur onglet Équipe. La pastille de votre demande change, et la carte de solde déplace les jours de l'attente d'approbation vers Pris.",
            "Changé d'idée? Tapotez **Withdraw** (retirer) sur une demande en attente ou approuvée que vous n'avez pas encore prise.",
          ] },
          { note: "Le chiffre des jours restants est une information, pas une autorisation. Le serveur vérifie votre solde quand vous soumettez et de nouveau quand le gestionnaire approuve, parce que d'autres demandes peuvent être approuvées entre les deux." },
        ],
      },
      {
        id: "balances",
        heading: "Comment fonctionnent les soldes",
        blocks: [
          { p: "Les soldes se constituent d'eux-mêmes à partir de la politique que le propriétaire a fixée — un nombre de jours par année, accumulés au fil de l'année — et la carte montre les chiffres de cette année. Une demande en attente compte contre ce dont vous disposez, pour que vous ne puissiez pas demander deux fois les mêmes jours. L'indemnité de vacances, là où votre entreprise l'accumule, apparaît en montant sur la carte." },
          { tip: "Les jours de maladie sont généralement sur une politique à approbation automatique : soumettre réserve la journée et ne fait qu'en informer votre gestionnaire. Faites-le depuis le téléphone avant le début du quart pour que l'horaire le sache." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde voit ses propres soldes et demandes et peut retirer les siennes. Approuver et refuser, l'onglet **Équipe**, les soldes de tout le monde et qui est en congé prochainement sont pour quiconque peut diriger une équipe — le niveau Dispatcher et au-dessus. Les politiques elles-mêmes sont réservées au propriétaire et à l'administrateur, sous Paramètres; voir [[time-off-policies|Politiques de congés]] et, pour le côté du gestionnaire, [[time-off-requests|Demandes de congé]]." },
        ],
      },
    ],
    faq: [
      { q: "Qui approuve ma demande?", a: "La personne à qui vous rendez des comptes. Si personne n'est défini, ou si votre gestionnaire est absent aujourd'hui, elle va plutôt à un propriétaire ou à un administrateur, et la ligne sous la demande dit lequel." },
      { q: "Puis-je demander plus de jours que j'en ai?", a: "Pas pour un type payé — le serveur refuse à l'envoi. Un congé non payé n'a pas de solde et n'est pas limité." },
      { q: "Ma demande a été approuvée mais je n'en ai plus besoin.", a: "Tapotez Withdraw dessus. Ça fonctionne sur les demandes en attente et approuvées que vous n'avez pas encore prises." },
    ],
  },

  "report-a-safety-incident": {
    title: "Signaler un incident de sécurité",
    summary:
      "Déclarer une blessure, un incident évité de justesse ou un dommage matériel depuis le téléphone en moins d'une minute : ce que le formulaire demande, ce que veut dire Travaux arrêtés, et qui voit le rapport.",
    updated: "2026-09-12",
    intro: [
      "**Sécurité** est l'endroit où une blessure, un incident évité de justesse ou un dommage est consigné pendant que c'est frais. Tous les niveaux d'accès peuvent en déclarer un — la personne debout sur l'échelle est celle qui doit pouvoir signaler ce qui s'y est passé — et un incident évité de justesse mérite d'être signalé exactement comme une blessure, comme l'écran lui-même le dit.",
      "Le rapport est un dossier, pas une alarme. L'envoyer l'inscrit dans la liste d'incidents et le journal d'activité de l'entreprise; ça ne texte ni ne courrielle personne. Prévenez aussi votre superviseur.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran liste les incidents — filtrés **Tous**, **Ouvert**, **Examiné** ou **Fermé** — en cartes avec le type, un badge **Travaux arrêtés** quand le travail a été interrompu, où, qui l'a signalé et son état, et un bouton **Signaler**. Les gestionnaires ont un panneau **Suivi** sur chaque carte pour régler l'état et noter ce qui a été fait; un équipier voit les rapports qu'il a déposés." },
          { figure: "harness:mobile-safety-report", caption: "Le formulaire de signalement sur un téléphone — le type, quand, ce qui s'est passé, où, le chantier facultatif, la case Travaux arrêtés et la note sur le signalement." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment déposer un rapport",
        blocks: [
          { steps: [
            "Ouvrez **Plus → Sécurité** et tapotez **Signaler**.",
            "Choisissez **Quel type d'incident** : **Évité de justesse**, **Blessure**, **Dommage matériel** ou **Autre**.",
            "Réglez **Quand c'est arrivé** — c'est maintenant par défaut.",
            "Décrivez **Ce qui s'est passé** dans vos mots. Court, ça va; c'est le seul champ obligatoire.",
            "Dites **Où** et, sous **Chantier (optionnel)**, choisissez le chantier ou laissez **Non lié à un chantier**. La liste contient les chantiers où vous êtes.",
            "Cochez **Les travaux ont été arrêtés à cause de ça** si c'est le cas, et ajoutez une **Note sur le signalement (optionnel)** au sujet d'une déclaration à une autorité provinciale.",
            "Tapotez **Envoyer le rapport**. La confirmation vous invite à ajouter une photo des lieux — facultatif — puis **Terminé**.",
          ] },
        ],
      },
      {
        id: "each-field",
        heading: "À quoi sert chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il fait"],
            rows: [
              ["**Quel type d'incident**", "Fixe l'étiquette de la carte. Une blessure est inscrite au journal d'activité comme une blessure; un incident évité de justesse comme tel."],
              ["**Quand c'est arrivé**", "L'heure de l'incident, pas celle du dépôt."],
              ["**Ce qui s'est passé**", "Obligatoire. Le seul texte libre que la carte affiche en entier."],
              ["**Où**", "Une pièce, une cour, un étage — texte libre."],
              ["**Chantier (optionnel)**", "Lie le rapport à un chantier pour que le bureau puisse le retrouver de là."],
              ["**Les travaux ont été arrêtés à cause de ça**", "Affiche un badge rouge Travaux arrêtés sur la carte. Ça ne change rien d'autre — l'horaire n'est pas touché."],
              ["**Note sur le signalement (optionnel)**", "Votre note sur la déclaration réglementaire. FieldQuo ne connaît pas les règles ni les délais de votre province et ne décide pas ça pour vous."],
            ],
          } },
        ],
      },
      {
        id: "after-filing",
        heading: "Après le dépôt",
        blocks: [
          { p: "Le rapport est **Ouvert**. Un gestionnaire l'examine dans le panneau **Suivi** — l'état passe à **Examiné** ou **Fermé**, avec une note sur ce qui a été fait — et la carte se met à jour. Les photos que vous avez ajoutées restent sur le rapport. Le déclarant est toujours la personne connectée; un rapport ne peut pas être déposé au nom de quelqu'un d'autre." },
          { warning: "Personne n'est averti automatiquement. Si quelqu'un est blessé, appelez d'abord les secours et prévenez votre superviseur; le rapport peut être déposé depuis le chantier ensuite, ou le lendemain matin avec la vraie heure réglée sous Quand c'est arrivé." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le plancher du réglage de sécurité est **Report incidents, and view their own** (signaler des incidents et voir les siens) — les niveaux Crew et Estimator — alors vous voyez ce que vous avez déposé, et seulement ça. Voir les incidents de tout le monde est le niveau suivant, et faire le suivi est **View everyone's incidents and follow up on them** (voir les incidents de tous et y donner suite) : le niveau Dispatcher et au-dessus. Un rapport déposé à votre sujet par quelqu'un d'autre lui appartient; c'est à lui de vous le montrer. Le côté bureau est dans [[safety-incidents|Incidents de sécurité et incidents évités de justesse]]." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je signaler un incident évité de justesse qui n'a blessé personne?", a: "Oui. L'écran le dit dans ses propres mots : un incident évité de justesse, c'est ainsi qu'on apprend avant que quelqu'un soit blessé." },
      { q: "Est-ce que cocher Travaux arrêtés dit au bureau d'arrêter le chantier?", a: "Non. Ça met un badge sur le rapport. Arrêter les travaux, c'est une conversation avec votre superviseur." },
      { q: "Puis-je modifier un rapport après l'avoir déposé?", a: "Pas depuis le niveau Crew. Un gestionnaire ajoute le suivi et change l'état; l'original reste tel que vous l'avez écrit." },
    ],
  },

  "push-notifications": {
    title: "Notifications push",
    summary:
      "Comment être averti sur votre téléphone d'une mention, d'un message direct, d'une soumission approuvée ou d'une facture payée — et pourquoi l'interrupteur peut dire que le push n'est pas configuré.",
    updated: "2026-09-12",
    intro: [
      "Les notifications du navigateur ont deux moitiés. Tant qu'un onglet FieldQuo est ouvert quelque part sur le téléphone, la page elle-même peut afficher une notification système pour une nouveauté. Onglet fermé, seul le **push** peut vous joindre — et le push doit être configuré sur le déploiement par FieldQuo, alors l'interrupteur vous dit clairement laquelle des deux vous obtenez.",
      "Les deux moitiés tiennent en un seul interrupteur, par personne et par navigateur, dans **Paramètres → Notifications**, dans la carte **Notifications du navigateur**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte se lit : **Recevez les nouveautés sous forme de notification système sur cet ordinateur ou ce téléphone — quand FieldQuo est dans un autre onglet, et onglet fermé là où le push est configuré.** Dessous, l'interrupteur **M'avertir dans ce navigateur**, une ligne sur l'autorisation du navigateur, une ligne sur le push, et **Envoyer une notification test**." },
          { p: "Activer l'interrupteur demande la permission du téléphone, retient sur ce téléphone que vous voulez des alertes, et — quand le push est configuré — inscrit ce téléphone auprès du serveur pour que les mêmes événements arrivent onglet fermé. Le désactiver oublie le drapeau et retire l'inscription. La permission elle-même appartient au navigateur : si elle est bloquée, la carte le dit et indique où la changer, et l'interrupteur n'est pas offert." },
          { note: "La carte **Rappels de rendez-vous** sur la même page, c'est autre chose : des textos aux clients avant une visite, au nom de votre entreprise. Ils partent par texto seulement — il n'y a pas de rappel par courriel, et le texte du rappel n'est pas encore modifiable, seul le message « en route » l'est. Ce ne sont pas des notifications pour vous." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "Comment l'activer",
        blocks: [
          { steps: [
            "Sur un iPhone ou un iPad, ajoutez d'abord FieldQuo à l'écran d'accueil et ouvrez-le depuis l'icône — la dernière ligne de la carte dit que Safari ne livre les notifications qu'aux applications web installées.",
            "Ouvrez **Paramètres → Notifications** et descendez jusqu'à **Notifications du navigateur**.",
            "Activez **M'avertir dans ce navigateur** et autorisez les notifications quand le téléphone le demande.",
            "Lisez la confirmation : **Activé. Vous serez averti ici, et onglet fermé.** veut dire que le push fonctionne; **Activé. Vous serez averti tant qu'un onglet FieldQuo est ouvert.** veut dire que seule la moitié dans l'onglet est disponible.",
            "Tapotez **Envoyer une notification test** et cherchez-la dans le coin de l'écran.",
          ] },
          { figure: "harness:settings-notifications", caption: "Paramètres → Notifications — les alertes par courriel de l'entreprise et les rappels de rendez-vous; la carte Notifications du navigateur avec l'interrupteur est plus bas sur la même page." },
        ],
      },
      {
        id: "what-you-get",
        heading: "Ce qui déclenche une notification",
        blocks: [
          { table: {
            head: ["Événement", "Qui est averti"],
            rows: [
              ["Un message direct, ou un message qui vous mentionne, dans le Clavardage", "Vous"],
              ["Un nouveau message d'un propriétaire de maison dans la boîte Messages", "Toute personne qui peut lire la boîte"],
              ["Une soumission approuvée, une facture payée, une rétrofacturation, une soumission non livrée, une estimation en attente de validation, une nouvelle demande, une demande de congé", "Les personnes dont le niveau d'accès couvre cette chose — les mêmes à qui elle apparaît dans la cloche"],
              ["Une photo téléversée, une visite terminée, un pointage", "Personne — ce sont des dossiers, pas des alertes"],
            ],
          } },
          { p: "Une notification ne transporte jamais d'argent : un écran verrouillé est un lieu public, alors le push en dit moins que la ligne du fil, jamais plus. Pour un équipier, dont le niveau ne couvre aucun événement d'argent, les notifications sont en pratique le clavardage — un message direct ou une mention." },
        ],
      },
      {
        id: "the-status-line",
        heading: "Ce que veut dire la ligne du push",
        blocks: [
          { table: {
            head: ["La ligne se lit", "Sens"],
            rows: [
              ["Le push onglet fermé n'est pas configuré sur ce déploiement", "FieldQuo n'a pas encore activé le push. L'interrupteur fonctionne quand même pour la moitié dans l'onglet."],
              ["Ce navigateur ne peut pas recevoir de push onglet fermé", "Le navigateur du téléphone n'a pas le push — sur un iPhone, généralement parce que FieldQuo n'est pas installé sur l'écran d'accueil."],
              ["Push onglet fermé : disponible", "Configuré et prêt; activez l'interrupteur pour l'utiliser ici."],
              ["Push onglet fermé : actif dans 2 navigateur(s)", "Ça fonctionne, et c'est le nombre de vos appareils inscrits."],
              ["Autorisation du navigateur : bloquée", "Le navigateur a refusé. Autorisez les notifications pour le site dans ses réglages, puis revenez."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'interrupteur est personnel — chaque personne, chaque téléphone — mais il vit dans **Paramètres → Notifications**, et le menu Paramètres ne montre cette ligne qu'aux propriétaires et aux administrateurs. Un équipier n'a aujourd'hui aucune ligne qui mène à l'interrupteur, alors les mentions du clavardage d'équipe le rejoignent dans la cloche et à l'écran, pas sur l'écran verrouillé." },
          { warning: "Une notification est une courtoisie au sujet de quelque chose de déjà enregistré. Si un service de push est lent ou en panne, l'enregistrement est quand même dans la cloche et à l'écran; rien n'attend la notification." },
        ],
      },
    ],
    faq: [
      { q: "La carte dit que le push n'est pas configuré. Y a-t-il un problème avec mon téléphone?", a: "Non. Cette ligne concerne le déploiement de FieldQuo, pas votre téléphone. L'interrupteur vous donne quand même des notifications tant qu'un onglet FieldQuo est ouvert." },
      { q: "Je l'ai activé à mon bureau. Mon téléphone va-t-il les recevoir aussi?", a: "Non. L'interrupteur est par navigateur. Activez-le sur chaque appareil que vous voulez voir averti." },
      { q: "Les clients recevront-ils un jour un push de FieldQuo?", a: "Non. Les clients reçoivent des courriels et des textos de votre entreprise; le push est pour les personnes connectées à FieldQuo." },
    ],
  },

  "bad-connections-and-offline": {
    title: "Mauvaises connexions, et pourquoi il n'y a pas de mode hors ligne",
    summary:
      "Ce qui arrive à un pointage, une photo ou un message quand le signal tombe, quoi faire, et ce que FieldQuo ne fait volontairement pas.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo ne stocke rien sur le téléphone et ne met rien en file pour plus tard. Chaque tapotement est une requête au serveur, et une requête sans signal ne passe pas — l'écran vous le dit, et vous tapotez de nouveau quand vous avez une barre. Il n'y a pas de mode hors ligne, pas de synchronisation en arrière-plan, et cet article le dit plutôt que de vous laisser le découvrir dans un sous-sol.",
      "La raison, c'est l'honnêteté avant la commodité. Un pointage qui semble enregistré et ne l'est pas, une photo qui semble classée et attend dans une file, c'est exactement la panne que ce produit refuse de livrer. Ce que vous voyez à l'écran est ce que le serveur a.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La seule chose que FieldQuo installe dans votre navigateur est un petit travailleur dont l'unique tâche est de recevoir les notifications push. Il ne met aucune page en cache, n'intercepte aucune requête et ne sert rien quand vous êtes hors ligne — alors une icône FieldQuo installée sans signal s'ouvre sur la page « pas de connexion » du navigateur, pas sur une copie périmée de votre journée." },
          { p: "Ce qui est sur le serveur est en sécurité. Une page qui ne charge pas dit **Le chargement a échoué** et, dessous, **C'est un problème de chargement, pas des données manquantes — rien n'a été supprimé.** avec un bouton **Réessayer**. Cette phrase est vraie de chaque écran." },
        ],
      },
      {
        id: "what-happens",
        heading: "Ce qui arrive à chaque action sans signal",
        blocks: [
          { table: {
            head: ["Action", "Sans connexion", "Comment vous le savez"],
            rows: [
              ["Ouvrir un écran", "Rien ne charge", "Le panneau : Le chargement a échoué, avec Réessayer"],
              ["Pointer l'entrée ou la sortie", "Rien n'est enregistré", "L'écran ne passe pas à En service (ni à hors service); sur une requête refusée, il affiche Impossible d'enregistrer."],
              ["En route ou Marquer comme terminée", "La visite ne change pas", "Un message : Impossible de mettre à jour la visite. Vérifiez votre connexion."],
              ["Envoyer un message de clavardage", "Pas stocké", "Le message se lit Non envoyé. avec Remettre dans la boîte"],
              ["Téléverser une photo, déposer un rapport, soumettre une demande", "Rien n'est classé", "Un message d'erreur; le formulaire garde ce que vous avez tapé jusqu'à ce que vous quittiez la page"],
            ],
          } },
        ],
      },
      {
        id: "what-to-do",
        heading: "Quoi faire",
        blocks: [
          { steps: [
            "Regardez l'écran avant de ranger le téléphone. Un pointage qui est passé affiche **En service**; un message qui est passé est dans le fil; une photo qui est passée est dans la grille.",
            "S'il n'est pas passé, déplacez-vous là où vous avez du signal et tapotez de nouveau. Rien n'a été enregistré à moitié, alors tapoter deux fois ne peut rien doubler — la pointeuse refuse une deuxième entrée tant qu'une est ouverte.",
            "Pour une photo avec une connexion de données faible, textez-la plutôt à la ligne d'équipe : un message photo part sur le réseau téléphonique et se classe de lui-même à son arrivée — [[text-a-photo-to-the-crew-inbox|Texter une photo sans application]].",
            "Si le chantier est une zone morte, prévenez le bureau d'avance. Votre gestionnaire peut ajouter un pointage à la main dans Feuilles de temps, et le journal de chantier peut s'écrire le soir même.",
          ] },
        ],
      },
      {
        id: "the-clock",
        heading: "L'horloge continue de tourner sur le serveur",
        blocks: [
          { p: "Une fois une entrée enregistrée, l'entrée ouverte vit sur le serveur, pas sur votre téléphone. Perdre le signal, fermer le navigateur, une pile à plat — rien de tout ça n'arrête l'horloge. Connectez-vous sur n'importe quel téléphone ou ordinateur et **Pointer la sortie** ferme la même entrée. La position demandée au téléphone au tapotement a un délai de 8 secondes : pas de relevé à temps, et le pointage part sans position plutôt que d'attendre." },
          { tip: "Si la journée s'est terminée sans signal et sans sortie, l'entrée reste ouverte toute la nuit. Pointez la sortie à la première heure et dites la vraie heure à votre gestionnaire; il la corrige dans Feuilles de temps et l'entrée repasse en attente de révision." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "**Mettre des actions en file pour plus tard.** Un tapotement qui échoue n'est pas réessayé en arrière-plan. C'est vous qui réessayez.",
            "**Suivre votre position.** Le téléphone est interrogé une fois, au tapotement; rien ne tourne entre deux tapotements et rien ne fonctionne quand l'écran est verrouillé. C'est une limite du navigateur, et le produit ne prétend pas le contraire.",
            "**Livrer une application native.** Il n'y en a aucune dans aucune boutique; le back-office est une application web qui tourne dans le navigateur du téléphone et peut être épinglée à l'écran d'accueil — [[install-it-like-an-app|L'installer comme une application]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "J'ai tapoté Pointer l'entrée sans signal et j'ai rangé le téléphone. Suis-je pointé?", a: "Non. Rien n'a été enregistré. Ouvrez l'écran : s'il ne dit pas En service, tapotez de nouveau là où vous avez du signal, et dites la vraie heure de début à votre gestionnaire." },
      { q: "Les photos prises hors ligne vont-elles se téléverser d'elles-mêmes plus tard?", a: "Non. Téléversez-les depuis la page du chantier quand vous avez une connexion, ou textez-les à la ligne d'équipe — un message photo passe souvent là où une page web ne passe pas." },
      { q: "Un mode hors ligne s'en vient-il?", a: "Pas aujourd'hui, et cet article le dira quand ça changera. La conception actuelle, c'est que ce que l'écran montre est ce que le serveur a." },
    ],
  },
};
