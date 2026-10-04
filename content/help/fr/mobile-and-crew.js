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
            "**La barre du haut** — le bouton de menu à gauche ouvre le menu complet en tiroir (l'équipe n'a pas de bouton de menu : sa page Plus contient tout); le logo FieldQuo mène au tableau de bord; la cloche à droite indique combien de notifications vous n'avez pas lues.",
            "**La page elle-même** — les mêmes cartes que sur un ordinateur, empilées sur une colonne. Les boutons sont taillés pour un pouce, et le sélecteur de chantier de la pointeuse est le sélecteur natif de votre téléphone, pas un menu maison.",
            "**La barre d'onglets** — **Pointage** en premier pour tout le monde, puis les écrans que votre rôle utilise le plus, puis **Plus**. Un équipier voit **Pointage**, **Aujourd'hui**, **Clavardage** et **Plus**. Voir [[the-crew-tab-bar|La barre d'onglets de l'équipe]].",
            "**La zone sûre** — sur un iPhone, la barre se place au-dessus de l'indicateur d'accueil plutôt que dessous, alors l'onglet du bas n'est jamais à moitié couvert.",
          ] },
          { figure: "harness:mobile-job", caption: "Un chantier sur un téléphone — la visite avec ses boutons En route et Marquer comme terminée, la liste de vérification dessous, et la barre d'onglets en bas." },
        ],
      },
      {
        id: "sign-in",
        heading: "Comment se connecter sur votre téléphone",
        blocks: [
          { steps: [
            "Ouvrez le courriel d'invitation sur votre téléphone et acceptez-le — c'est ainsi qu'on rejoint une entreprise; il n'y a aucun moyen de s'y ajouter soi-même. Au niveau Crew, votre compte ne coûte rien à l'entreprise.",
            "Choisissez votre mot de passe. Ensuite, la page de connexion demande **Courriel** et **Mot de passe**, et le bouton s'appelle **Se connecter**.",
            "Vous arrivez sur l'**Accueil**. Tapotez un onglet — ou le bouton de menu, ou **Plus** si vous êtes au niveau équipe — pour aller où vous voulez.",
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
      { q: "Est-ce que ça fonctionne sur un iPad ou une petite tablette?", a: "Oui. Sous environ 1 024 pixels de largeur, vous obtenez la disposition mobile avec la barre d'onglets; au-delà, la disposition d'ordinateur — la barre latérale pour le bureau, et pour l'équipe un en-tête mince avec un grand bouton de pointage et de grands boutons pour leurs écrans." },
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
      "La barre au bas de la disposition mobile : la pointeuse en premier dans la barre de tout le monde, ce que chaque rôle obtient d'autre, et la disposition simple de l'équipe sur un ordinateur.",
    updated: "2026-10-03",
    intro: [
      "Sur un téléphone, la barre au bas de l'écran est votre moyen de vous déplacer. La barre de tout le monde commence par **Pointage** — celle du propriétaire aussi — et le reste dépend de ce que vous faites toute la journée : un équipier a **Aujourd'hui** et **Clavardage**, quelqu'un qui rédige les soumissions a **Soumissions** et **Calendrier**, quelqu'un qui gère l'horaire a **Horaire** et **Équipe**. **Plus**, à droite, contient tout le reste.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La barre apparaît dès que l'écran fait moins d'environ 1 024 pixels de largeur — tous les téléphones, la plupart des tablettes tenues à la verticale. L'onglet de l'écran courant est mis en évidence; les autres sont dans une couleur atténuée. Au-delà de cette largeur, la barre disparaît : le bureau a la barre latérale, et un équipier a la disposition simple décrite plus bas." },
          { figure: "harness:mobile-chat", caption: "Le salon de clavardage d'un chantier sur un téléphone, avec Clavardage mis en évidence dans la barre d'onglets et Plus à droite." },
        ],
      },
      {
        id: "the-tabs",
        heading: "Les onglets, par rôle",
        blocks: [
          { table: {
            head: ["Qui", "La barre", "Passé sous Plus"],
            rows: [
              ["Propriétaire et administrateurs", "**Pointage** · **Prospects** · **Soumissions** · **Chantiers** · **Clavardage** · **Plus**", "**Factures** — on arrive d'habitude à une facture par son chantier, par le bouton **+** ou par la notification de paiement."],
              ["Équipe (Crew)", "**Pointage** · **Aujourd'hui** · **Clavardage** · **Plus**", "Rien — la pointeuse était déjà en premier."],
              ["Estimateur", "**Pointage** · **Soumissions** · **Calendrier** · **Clavardage** · **Plus**", "**Prospects** — un nouveau prospect arrive comme une notification qui l'ouvre, et la visite que vous réservez tombe dans le Calendrier."],
              ["Répartiteur et gestionnaire", "**Pointage** · **Horaire** · **Équipe** · **Clavardage** · **Plus**", "**Chantiers** — chaque réservation de l'horaire ouvre son chantier."],
            ],
          } },
          { p: "Un onglet que vous ne pouvez pas utiliser n'est pas dessiné : les mêmes règles d'accès cachent les mêmes lignes dans le menu complet, et les pages derrière refusent au même niveau, alors la barre est un raccourci, pas la sécurité. **Équipe** demande à la fois un accès à Time Tracking sur tout le monde et la permission de gérer les gens; **Clavardage** demande que le clavardage d'équipe soit activé pour votre entreprise." },
        ],
      },
      {
        id: "the-clock-tab",
        heading: "L'onglet Pointage",
        blocks: [
          { p: "**Pointage** ouvre la pointeuse. Il est dans toutes les barres, propriétaires et administrateurs compris. Un propriétaire ou un administrateur qui n'est pas encore sur la liste y voit **Me configurer pour pointer** — ça ne coûte aucun siège et ça ne vous met dans aucune paie : les propriétaires restent hors paie tant que **Me payer par la paie** n'est pas activé sous Équipe → Votre propre taux." },
          { p: "Si un propriétaire règle **Time Tracking & Timesheets** à **No access** pour quelqu'un (Gérer l'équipe → Rôle → Custom…), l'onglet Pointage quitte la barre de cette personne et l'onglet qu'il remplaçait revient — un estimateur retrouve **Prospects**, un répartiteur **Chantiers**. La pointeuse d'un propriétaire ou d'un administrateur ne peut pas être désactivée." },
        ],
      },
      {
        id: "what-a-crew-member-gets",
        heading: "Ce qu'un équipier obtient",
        blocks: [
          { bullets: [
            "**Pointage** — pointer l'arrivée et le départ, commencer une pause, changer de chantier; l'onglet **Journal** est l'endroit où **Demander une correction** si une heure est fausse.",
            "**Aujourd'hui** — les visites du jour avec l'adresse et l'itinéraire, les photos et la liste de contrôle du chantier, puis le reste de la semaine.",
            "**Clavardage** — #general, le salon de chaque chantier où vous êtes, et les messages directs.",
            "**Plus** — une page, pas un menu : vos demandes, vos congés, vos disponibilités, les fournitures, l'équipe, vos gains, vos chantiers, puis **Tout le reste** — chaque autre écran que votre accès permet, une grande ligne chacun.",
          ] },
          { p: "Il n'y a pas de bouton de menu pour l'équipe. Le menu repliable du bureau n'est pas dessiné pour eux, ni sur un téléphone ni sur un ordinateur : tout ce qu'il contenait pour eux est sur la page Plus." },
        ],
      },
      {
        id: "crew-on-a-computer",
        heading: "L'équipe sur un ordinateur ou une tablette à l'horizontale",
        blocks: [
          { p: "Au-delà d'environ 1 024 pixels, un équipier n'a pas de barre latérale. À la place, en haut de chaque page :" },
          { bullets: [
            "**Un en-tête mince** — le logo et le nom de votre entreprise, votre nom, la cloche des notifications et **Se déconnecter**.",
            "**Un grand bouton de pointage** juste en dessous. Il dit **Pointer l'arrivée** quand vous n'êtes pas pointé (vert), **Pointer le départ** avec l'heure de début quand vous l'êtes (rouge), et **Terminer la pause** pendant une pause. Il ouvre la pointeuse, où vous tapez une fois de plus pour pointer — comme la carte de pointage d'Aujourd'hui.",
            "**De grands boutons** pour **Aujourd'hui**, **Mon horaire**, **Clavardage**, **Chantiers** et **Plus**. Celui où vous êtes est rempli en foncé.",
          ] },
          { note: "Les lettres et les boutons plus gros sont voulus : un écran d'équipe se lit dans un camion, avec des gants, par des gens qui ne veulent pas de menu. Rien n'est caché derrière un survol ou un repli." },
        ],
      },
      {
        id: "the-more-drawer",
        heading: "Plus, pour les autres rôles",
        blocks: [
          { p: "Pour les rôles du bureau, **Plus** ouvre un panneau par-dessus la barre : la recherche d'abord, puis chaque écran qui n'est pas déjà un de vos onglets, puis les lignes de votre compte. Un écran est à un seul endroit, jamais deux — quand **Factures** a quitté la barre du propriétaire, elle est apparue dans le panneau. L'**Accueil** n'est pas un onglet : le logo FieldQuo dans la barre du haut vous y mène." },
          { tip: "Si votre barre ne montre que Pointage, Clavardage et Plus, chaque document de votre rôle est réglé à No access. C'est une grille valide, pas un défaut — tout ce que vous pouvez utiliser est sous Plus." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je choisir quels onglets sont dans la barre?", a: "Non. La barre de chaque rôle est fixe, et votre niveau d'accès décide laquelle vous obtenez. Sous Plus, tout le reste est à un tapotement." },
      { q: "Je suis propriétaire et je ne pointe jamais. Pourquoi un onglet Pointage?", a: "Parce que certains propriétaires travaillent sur les chantiers, et la pointeuse doit être à un tapotement pour eux comme pour tout le monde. Ça ne change rien tant que vous ne l'utilisez pas : ça ne vous met pas dans la paie." },
      { q: "Où sont passées les Factures?", a: "Sous Plus, dans le même panneau que tous les autres écrans. Vous arrivez aussi à une facture par la page de son chantier, par le bouton + et par la notification quand elle est payée." },
      { q: "Un équipier veut retrouver l'ancienne barre latérale.", a: "Il n'y a pas d'interrupteur pour ça. Tout ce que la barre latérale lui montrait est sur sa page Plus, sous Tout le reste." },
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
            "**Pointer** et **Journal** — deux onglets. Pointer, c'est ce que vous faites maintenant ; Journal, c'est une journée en ligne du temps, avec des flèches pour remonter les jours.",
            "**Le chronomètre** — en service, l'activité en cours, depuis combien de temps, **Depuis** quelle heure, et **Sur** le nom du chantier (ou **Rattaché à aucun chantier**). Hors service, la date, l'heure en direct et **Vous êtes hors service.** Dessous, **Total aujourd'hui**.",
            "**Les tuiles** — les activités qu'utilise votre entreprise, en grille ; celle en cours est allumée. **Non payé** sous une tuile veut dire que votre entreprise ne paie pas ce temps. **Pointer la sortie** (rouge) est sur la dernière rangée quand vous êtes en service.",
            "**La ligne de localisation** — affichée seulement tant que le téléphone n'a pas répondu à la demande d'autorisation, pour que vous lisiez pourquoi avant qu'il ne demande.",
            "**Aujourd'hui** — chaque période avec son activité, ses heures et son chantier, et la note indiquant que vos heures vont à votre gestionnaire.",
          ] },
          { figure: "harness:mobile-clock", caption: "La pointeuse sur un téléphone — l'activité en cours et son chronomètre, les tuiles, et Pointer la sortie sur la dernière rangée." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment pointer l'entrée et la sortie",
        blocks: [
          { steps: [
            "Touchez **Pointage** dans la barre au bas de votre téléphone (sur un ordinateur, **Plus → Pointeuse**).",
            "Touchez ce que vous commencez. **Sur le chantier** ouvre une petite fenêtre avec le chantier : si vous avez exactement une visite aujourd'hui, elle est déjà remplie ; s'il y en a plusieurs, choisissez celle que vous commencez ; puis touchez **Commencer**.",
            "Si votre téléphone demande si FieldQuo peut utiliser votre position, répondez une fois ; un refus ne change rien au pointage.",
            "Travaillez. Le chronomètre avance à l'écran ; le temps continue aussi de compter sur le serveur si vous fermez l'onglet ou si la batterie meurt.",
            "Touchez **Pointer la sortie**. Chaque période de la journée est sous **Aujourd'hui**, et dans l'onglet **Journal** en ligne du temps.",
          ] },
          { figure: "live:app-clock", caption: "Le même écran sur un ordinateur — le chronomètre, les tuiles et la liste Aujourd'hui avec chaque période et son chantier." },
        ],
      },
      {
        id: "switch-job",
        heading: "Passer d'une activité à l'autre",
        blocks: [
          { p: "Rester sur une seule activité toute la journée met tout le quart au même endroit. Touchez plutôt la tuile suivante — **Route** vers le prochain chantier, **Sur le chantier** à l'arrivée (choisissez le chantier), **Matériel** pour un aller au magasin. La période en cours se ferme à cet instant et la nouvelle s'ouvre ; le temps déjà fait garde l'activité et le chantier où il a été fait. En pause, touchez la tuile où vous étiez, ou **Fin de la pause — retour à …**, pour reprendre." },
          { note: "Toucher la tuile déjà en cours ne fait rien. Une erreur corrigée dans la minute remplace la première plutôt que de laisser une entrée de trop ; après, touchez la bonne tuile — les minutes entre les deux restent où elles sont, et votre gestionnaire peut les corriger sur les feuilles de temps." },
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
    updated: "2026-10-04",
    intro: [
      "Votre journée est à trois endroits, exprès, parce que ce sont trois choses différentes : un **quart**, ce sont les heures que votre gestionnaire a publiées pour vous; une **visite**, c'est un bloc de travail réservé sur un chantier; une **tâche à faire**, c'est une tâche à votre nom. Les trois ne montrent que ce qui est à vous, et aucun ne montre un brouillon que le bureau n'a pas publié.",
    ],
    sections: [
      {
        id: "my-schedule",
        heading: 'Mon horaire',
        blocks: [
          { p: "**Mon horaire** dans le menu (et l'onglet Horaire de la barre du bas sur le téléphone) est vos deux prochaines semaines, une carte par jour, faite pour le pouce : **Demain, mardi 15 sept.**, puis les heures en grand — **8:00 – 16:00** — le client et l'adresse du chantier, qui d'autre est sur ce travail ce jour-là en initiales, votre dîner et vos pauses, et la note du gestionnaire citée. Sur la carte d'aujourd'hui, un bouton vert **Pointer** ouvre l'horodateur. Un quart placé hors des heures où vous vous êtes dit disponible le dit, avec qui l'a fait." },
          { p: "Vos **visites de chantier** sont sur les mêmes cartes, dans l'ordre de la journée avec vos quarts et marquées **Visite** : l'heure, le client et le chantier, l'adresse du chantier et la note de la visite — les mêmes visites que **Ma journée**. Une visite, et un quart que le bureau a placé sur un chantier, portent chacun les boutons **Ouvrir le chantier** et **Bon de travail** ; les deux s'ouvrent pour vous, puisque c'est d'être affecté au chantier qui vous l'ouvre." },
          { p: "**Ajouter au calendrier** télécharge vos quarts publiés en fichier .ics que le calendrier du téléphone ouvre ; retéléchargez-le la semaine suivante et les événements se mettent à jour au lieu de se dédoubler. **Demander un congé** mène à l'écran Congés. Seuls les quarts publiés apparaissent — un brouillon que votre gestionnaire n'a pas validé n'atteint jamais votre téléphone." },
          { note: "Quand un gestionnaire publie, déplace, change le travail ou annule l'un de vos quarts, vous recevez une notification dans la cloche et, si vous les avez activées, une notification push : **Votre horaire est publié : lun. 14 sept., 8:00 – 16:00 chez Sophie Dubois, 12 rue Principale, et 4 de plus**. La toucher ouvre cet écran." },
        ],
      },
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

  "your-home-screen": {
    title: "Votre écran d'accueil",
    summary:
      "Le premier écran sur votre téléphone : votre prochain quart ou visite, Pointer, Message et Trouver un remplaçant en un geste, les heures du jour et les coups de chapeau. Où mènent les cinq onglets.",
    updated: "2026-09-13",
    intro: [
      "**Mon espace** est l'écran où votre journée commence. Il montre la prochaine chose que FieldQuo a pour vous — un quart, une visite qui vous a été assignée, un rendez-vous si vous en prenez, une tâche à échéance — avec le chantier, qui d'autre y est et les notes laissées par votre gestionnaire. Dessous, les trois boutons que vous utilisez le plus, puis les heures du jour, puis ce que les collègues ont dit les uns des autres cette semaine.",
      "C'est le même écran sur un téléphone et sur un ordinateur. Sur un téléphone, les cinq onglets sont en bas ; sur un ordinateur, ils traversent le haut de la page, dans la mise en page habituelle avec la barre latérale.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Ouvrez **Mon espace** sous **Plus** (sur un ordinateur, le Plus de la barre latérale; sur un téléphone, le panneau Plus). Sur un téléphone, ses écrans ont leurs propres cinq onglets : **Accueil · Pointage · Horaire · Messages · Plus**. Si vous gérez l'horaire — votre accès à Horaire est *Modifier l'horaire de tous* ou plus — ce sont **Accueil · Horaire · Équipe · Messages · Plus**, et l'accueil montre la couverture du jour plutôt que votre propre journée. L'équipe garde sa propre barre — **Pointage · Aujourd'hui · Clavardage · Plus** — et atteint Mon espace depuis sa page Plus." },
          { figure: "harness:my-home", caption: "Mon espace sur un téléphone — la carte du prochain quart avec Trouver un remplaçant et Échanger, les trois actions rapides, les heures du jour et le fil des coups de chapeau, avec la barre d'onglets en bas." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**La salutation** — bonjour, bon après-midi ou bonsoir selon l'heure de votre téléphone, votre titre de poste sous votre nom.",
            "**Événements du jour** — ce que votre gestionnaire a mis dans la ligne Événements de la semaine pour aujourd'hui : une réunion sécurité, une cour fermée.",
            "**À venir** — la prochaine chose pas encore terminée : **Demain, 9 h – 16 h**, le client et le chantier, votre rôle si le gestionnaire l'a saisi, les collègues sur le même projet ce jour-là, et **Notes pour ce quart**. Un quart que vous pouvez échanger ou céder porte **Trouver un remplaçant** et **Échanger** ; une visite porte **Ouvrir la visite** ; un quart ouvert que personne n'a encore porte **Quart ouvert — le prendre**.",
            "**Gains estimés** — sous un quart, les heures nettes des pauses non payées à votre taux horaire. Seulement si votre accès vous permet de voir vos propres bulletins ; sinon la ligne n'existe simplement pas.",
            "**Pointer · Message · Trouver un remplaçant** — la pointeuse, le clavardage d'équipe, et une demande de remplacement sur votre prochain quart.",
            "**Aujourd'hui** — une fois pointé : *Vous avez gagné 140,00 $ en travaillant 8 h* (ou seulement les heures), une barre de votre premier pointage à maintenant, et **Voir la feuille de temps**.",
            "**À venir** — le reste de la quinzaine, chaque ligne avec une pastille disant s'il s'agit d'un Quart, d'une Visite, d'un Rendez-vous, d'une Tâche ou d'un Quart ouvert.",
            "**Coups de chapeau** — les vingt derniers de l'entreprise, les vôtres surlignés. **Envoyer un coup de chapeau** choisit un collègue et prend jusqu'à 240 caractères.",
          ] },
          { note: "Les rendez-vous et les appels n'apparaissent que pour les personnes dont le rôle peut faire des soumissions — la même règle qui décide qui les clients peuvent réserver. Un membre d'équipe terrain ne voit jamais de section rendez-vous, même vide." },
        ],
      },
      {
        id: "the-other-tabs",
        heading: "Les autres onglets",
        blocks: [
          { table: {
            head: ["Onglet", "Ce qu'il contient"],
            rows: [
              ["**Horaire**", "Vos quarts, visites, rendez-vous et tâches par jour, avec les événements de l'entreprise, et le lien calendrier."],
              ["**Gains**", "Les heures par période de paie, les minutes de pause non payées, la liste jour par jour, une estimation brute à votre taux quand vous pouvez voir la paie, et le bulletin une fois la paie approuvée."],
              ["**Messages**", "Le clavardage de l'entreprise — #general, une salle par projet où vous êtes, les messages directs."],
              ["**Plus**", "Profil, Demandes (congés, échange, remplacement, disponibilités), Équipe, Notifications, Synchronisation du calendrier, Paramètres, Aide, Se déconnecter."],
            ],
          } },
          { p: "Il n'y a pas de NIP de pointage et pas de carte pour un tel NIP : la pointeuse de FieldQuo, c'est votre propre compte sur votre propre téléphone." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute personne ayant un compte. Ce qui change selon le niveau, c'est l'argent : la ligne de gains et les montants de l'onglet Gains exigent Paie à *Voir ses propres bulletins* ou plus, ce que les profils Équipe, Estimateur, Répartiteur et Gestionnaire détiennent tous et qu'un propriétaire peut retirer. Une personne du registre sans compte — un aide de cour ajouté sans courriel — n'a pas d'écran d'accueil, et ses quarts restent sur le tableau." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon accueil montre-t-il une bande de couverture et un rapport au lieu de mon quart ?", a: "Parce que votre accès à Horaire est à Modifier l'horaire de tous ou plus, donc FieldQuo vous montre l'accueil du gestionnaire : qui est pointé, ce qui attend une révision, ce qui n'est pas encore publié aujourd'hui. La vue employé est celle que voit votre équipe." },
      { q: "La ligne de gains ne dit rien — mon taux manque-t-il ?", a: "Soit votre accès n'inclut pas votre propre paie, auquel cas rien sur l'argent n'est affiché nulle part, soit personne n'a saisi de taux horaire pour vous. Demandez à la personne qui gère l'équipe ; un taux manquant n'est jamais affiché comme 0 $." },
      { q: "Puis-je modifier mon nom ou mon téléphone ici ?", a: "Pas encore. La carte de profil est en lecture seule — la personne qui gère l'équipe modifie votre nom, votre titre et votre téléphone depuis Gérer l'équipe — et elle le dit plutôt que d'offrir des champs qui ne s'enregistreraient pas." },
    ],
  },

  "trading-and-covering-shifts": {
    title: "Échanger et faire remplacer des quarts",
    summary:
      "Céder un quart, l'échanger avec un collègue ou prendre un quart ouvert — qui doit dire oui, ce que voit votre gestionnaire, et pourquoi un échange peut être refusé.",
    updated: "2026-09-13",
    intro: [
      "Un quart publié que vous ne pouvez pas faire a trois portes de sortie, toutes depuis votre téléphone : **Trouver un remplaçant** demande à quelqu'un de le prendre, **Échanger** le troque contre un des siens, et un **quart ouvert** — des heures publiées par votre gestionnaire sans personne dessus — peut être pris. Chacune est une demande à laquelle l'autre personne répond d'abord et que votre gestionnaire approuve ensuite, et vous êtes averti à chaque étape.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les demandes vivent sous **Plus → Demandes** et sur le quart lui-même. Une demande porte toujours sur un quart publié qui n'a pas commencé. Une fois le quart commencé, ce qui était en attente expire de lui-même — personne ne peut approuver un échange pour un quart déjà en cours." },
          { table: {
            head: ["Type", "Qui prend le quart", "Qui répond en premier"],
            rows: [
              ["**Remplacement**", "Le collègue que vous nommez, ou quiconque est admissible si vous ne nommez personne", "Ce collègue — pour un remplacement ouvert, la première personne admissible à accepter"],
              ["**Échange**", "Le collègue que vous nommez ; vous prenez un des siens en retour, ou rien", "Ce collègue"],
              ["**Prise**", "Vous, sur un quart ouvert", "Personne — ça va directement au gestionnaire"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Comment demander",
        blocks: [
          { steps: [
            "Sur **Accueil**, touchez **Trouver un remplaçant** ou **Échanger** sur votre prochain quart — ou ouvrez **Plus → Demandes**, touchez **Remplacement** ou **Échange**, et choisissez lequel de vos quarts à venir est concerné.",
            "Pour un remplacement, choisissez un collègue ou laissez **Quiconque le peut** : un remplacement ouvert va d'abord aux collègues ayant votre titre de poste, et à tous les actifs si personne ne le partage.",
            "Pour un échange, choisissez le collègue et, si vous voulez un de ses quarts en retour, lequel. **Rien — je donne simplement le mien** est un choix valide.",
            "Ajoutez une note si utile (*Dentiste à 9 h, de retour à midi*) et touchez **Envoyer la demande**.",
            "Surveillez **Les miennes** sous Demandes : **En attente du collègue**, puis **En attente du gestionnaire**, puis **Approuvée** ou **Refusée**. Vous pouvez la **Retirer** à tout moment avant la décision.",
          ] },
          { tip: "Pour prendre un quart ouvert, touchez **Quart ouvert — le prendre** sur l'accueil ou dans À venir. Cela saute l'étape du collègue et arrive chez votre gestionnaire." },
        ],
      },
      {
        id: "what-happens",
        heading: "Ce qui se passe à l'approbation",
        blocks: [
          { p: "Le quart passe à la personne qui le prend — sur le tableau, sur les deux téléphones, au moment même où l'approbation est enregistrée. Un échange avec un quart offert en retour déplace les deux. Avant cette écriture, FieldQuo refait la vérification que l'horaire fait quand un gestionnaire ébauche un quart : les disponibilités déclarées de la nouvelle personne et tout congé approuvé. Un échange qui mettrait quelqu'un un jour où il est en congé est **refusé avec cette raison** plutôt qu'approuvé et découvert le matin." },
          { bullets: [
            "**Réglage d'entreprise** — *Les échanges de quarts exigent une approbation* est activé par défaut. Désactivé, l'acceptation d'un collègue conclut l'échange et le gestionnaire est informé plutôt que sollicité.",
            "**Notifications** — le collègue est averti quand on lui demande, le gestionnaire quand une approbation est requise, les deux travailleurs quand c'est décidé.",
            "**Expiration** — une demande dont le quart a commencé affiche **Expirée** la prochaine fois que quelqu'un ouvre la liste.",
          ] },
        ],
      },
      {
        id: "for-managers",
        heading: "Pour les gestionnaires",
        blocks: [
          { p: "Les demandes qui vous attendent apparaissent à trois endroits qui lisent les mêmes lignes : le panneau **Demandes** au-dessus de l'horaire (avec un compteur), l'onglet **À approuver** sous Plus → Demandes sur votre téléphone, et la carte **À réviser** sur votre accueil. **Approuver** ou **Refuser** avec une note facultative. Quiconque est au-dessus de l'employé dans la ligne hiérarchique peut agir, de même que quiconque a l'accès Horaire à *Modifier l'horaire de tous*." },
        ],
      },
    ],
    faq: [
      { q: "Mon gestionnaire peut-il accepter un remplacement au nom de mon collègue ?", a: "Non. Accepter est la réponse du collègue et approuver celle du gestionnaire ; un gestionnaire qui veut déplacer un quart sans l'accord du collègue utilise l'horaire, où c'est consigné comme sa décision." },
      { q: "Pourquoi mon échange approuvé a-t-il été refusé ?", a: "La personne qui prend le quart n'est pas disponible à ce moment ou a un congé approuvé ce jour-là, et la vérification se fait au moment de l'approbation. La raison est sur la demande." },
      { q: "Quelqu'un sans compte peut-il prendre mon quart ?", a: "Le gestionnaire peut l'y placer, mais cette personne ne peut pas accepter une demande — il n'y a pas de téléphone pour la joindre. Les échanges ne listent que les collègues ayant un compte." },
    ],
  },

  "changing-your-availability": {
    title: "Changer vos disponibilités",
    summary:
      "Proposez de nouvelles heures à partir d'une date de votre choix, copiez votre semaine actuelle pour commencer, ajoutez plusieurs plages par jour, et voyez ce que votre gestionnaire a approuvé et quand ça prend effet.",
    updated: "2026-09-13",
    intro: [
      "Vos disponibilités sont la semaine dans laquelle l'horaire est bâti : un quart en dehors est refusé sauf si votre gestionnaire passe outre, et si votre rôle peut faire des soumissions, les clients peuvent aussi vous réserver à l'intérieur — un seul jeu d'heures, lu par les deux. Le changer est une demande avec une date d'entrée en vigueur, pour que l'horaire de cette semaine reste tel que publié et que la nouvelle semaine commence quand vous l'avez dit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Ouvrez **Plus → Mes disponibilités**. La carte du haut est votre semaine actuelle, une ligne par jour avec ses plages — ou **Indisponible**. Dessous, **Demander de nouvelles disponibilités** ; dessous encore, **Vos demandes** avec leur état, et pour un gestionnaire, les demandes en attente avec un comparatif jour par jour." },
          { note: "Il y a une seule disponibilité par personne. L'en-tête d'un membre d'équipe terrain lit *Heures où vous pouvez travailler* ; celui de quelqu'un qui peut faire des soumissions lit *Heures où vous pouvez travailler et recevoir des rendez-vous*, avec un lien vers sa page de réservation. Mêmes lignes, même demande — l'étiquette dit honnêtement ce que font les lignes." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment demander de nouvelles heures",
        blocks: [
          { steps: [
            "Touchez **Demander de nouvelles disponibilités**. Le formulaire s'ouvre avec votre semaine actuelle déjà remplie (**Copier les heures actuelles** la ramène si vous l'effacez).",
            "Réglez **Mes disponibilités entrent en vigueur le** — la date où la nouvelle semaine commence. Vos heures actuelles restent jusque-là.",
            "Pour chaque jour sous **Jours et heures**, touchez **+** pour ajouter une plage de–à ; ajoutez-en une deuxième pour une journée coupée. **Toute la journée** et **Indisponible** se font en un geste.",
            "Au besoin, saisissez **Heures souhaitées par semaine** et une note, puis touchez **Soumettre** en bas.",
            "La demande apparaît **En attente**. Vous pouvez la **Retirer** jusqu'à la décision.",
          ] },
        ],
      },
      {
        id: "what-happens",
        heading: "Ce qui se passe ensuite",
        blocks: [
          { bullets: [
            "**Approuvée avec une date passée ou d'aujourd'hui** — appliquée immédiatement ; votre semaine change maintenant.",
            "**Approuvée avec une date future** — la demande lit *approuvée, s'applique le …* et le changement arrive ce matin-là, pas avant.",
            "**Refusée** — votre semaine actuelle demeure ; la note du gestionnaire, s'il y en a une, est sur la demande.",
            "**Réglage d'entreprise désactivé** — *Les disponibilités exigent une approbation* est activé par défaut ; désactivé, la demande est approuvée à l'arrivée et attend quand même sa date. Paramètres → Disponibilités continue d'écrire directement, comme avant.",
          ] },
          { p: "Une plage doit commencer avant de finir, deux plages d'un même jour ne peuvent pas se chevaucher, et une demande sans aucune heure est refusée — une semaine où vous n'êtes jamais disponible est une démission tapée dans le mauvais formulaire." },
        ],
      },
      {
        id: "for-managers",
        heading: "Pour les gestionnaires",
        blocks: [
          { p: "Sous **À réviser** sur votre accueil, le panneau Demandes de l'horaire, et **Mes disponibilités** même, chaque demande en attente montre la personne, la date d'entrée en vigueur, le total d'heures par semaine, et un tableau des jours qui changent : ce qu'elle a maintenant, ce qu'elle demande. **Approuver** ou **Refuser** ; vous ne pouvez pas approuver la vôtre." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce que ça change aussi mes heures de réservation ?", a: "Si votre rôle peut faire des soumissions, oui — le calendrier de réservation lit les mêmes lignes. Sinon, les clients n'ont jamais pu vous réserver et ne le peuvent toujours pas." },
      { q: "Puis-je avoir deux demandes en attente ?", a: "Non. Retirez la première ou attendez sa réponse. Deux demandes approuvées pour la même personne sont appliquées dans l'ordre des dates et la plus récente demeure." },
      { q: "Et les heures de travail dans Paramètres → Disponibilités ?", a: "Cet écran contient aussi votre horaire habituel (Heures de travail), pour lequel l'horaire ne fait qu'avertir. La demande ici change la moitié disponibilités — celle qui refuse un quart." },
    ],
  },
  "working-without-signal": {
    "title": "Travailler sans réseau : factures et pointages qui attendent la synchronisation",
    "summary": "Ce que fait l'application dans un sous-sol : les écrans de terrain s'ouvrent depuis le téléphone, une facture ou un pointage que vous faites est gardé sur le téléphone, et tout est envoyé — dans l'ordre, une seule fois — au retour du réseau.",
    "intro": [
      "Un téléphone perd le réseau exactement là où le travail se fait. Avec le **mode hors ligne** activé (le défaut, dans Réglages → Terrain), l'éditeur de facture, les pages de chantier, l'horloge de pointage, les feuilles de temps et les feuilles de journée s'ouvrent depuis une copie sur le téléphone, avec les derniers clients, coordonnées de l'entreprise et pointages que chacun a chargés.",
      "Tout ce que vous *écrivez* sans réseau est mis en file sur le téléphone, ni perdu ni prétendu envoyé. La barre ambre en haut dit **Hors ligne — 2 factures et 3 pointages en attente de synchronisation**, et **Détails** les liste."
    ],
    "sections": [
      {
        "id": "an-invoice-without-signal",
        "heading": "Une facture sans réseau",
        "blocks": [
          {
            "p": "Ouvrez **Nouvelle facture** depuis le chantier. Le client et le chantier sont remplis ; si l'équipe a pointé sur le chantier, l'encadré vert propose **Main-d'œuvre — 6,5 h × 85 $** à partir de ces pointages. Ajoutez vos lignes et vos photos comme d'habitude. Les boutons disent **Enregistrer sur le téléphone** et **Mettre en file pour envoi** : le premier garde un brouillon, le second l'envoie par courriel dès que le téléphone retrouve le réseau."
          },
          {
            "note": "La taxe est ajoutée à la synchronisation — le taux vient de vos réglages, pas du téléphone. Le numéro de facture est attribué par le serveur au même moment, pour que deux téléphones ne donnent jamais le même numéro."
          }
        ]
      },
      {
        "id": "a-punch-without-signal",
        "heading": "Un pointage d'entrée ou de sortie sans réseau",
        "blocks": [
          {
            "p": "Appuyez sur **Pointer l'entrée** ou **Pointer la sortie** comme d'habitude. L'horloge montre le pointage avec **en attente de synchronisation** à côté de l'heure, et il est enregistré au moment où vous avez appuyé, pas au moment où le téléphone s'est reconnecté. Les pauses attendent que le pointage soit synchronisé."
          }
        ]
      },
      {
        "id": "what-happens-when-the-signal-returns",
        "heading": "Ce qui se passe au retour du réseau",
        "blocks": [
          {
            "bullets": [
              "**Les pointages d'abord**, dans l'ordre où ils ont été faits, puis les photos, puis les factures — pour que les photos d'une facture existent avant la facture qui les porte.",
              "**Une seule fois.** Chaque élément en file a sa propre clé ; si le téléphone l'envoie deux fois (réponse perdue, deux onglets), le serveur répond avec la première copie et ne crée rien de nouveau.",
              "**Synchronisé ✓** apparaît quand c'est fait, avec un lien vers la facture. **À vérifier** apparaît si le serveur a refusé quelque chose — le client a été retiré, une sortie est arrivée avant son entrée — avec la raison et un bouton **Réessayer**.",
              "Application fermée, la file part à la prochaine ouverture. Les téléphones qui le permettent réveillent aussi l'application au retour du réseau."
            ]
          },
          {
            "warning": "Un élément en file reste sur le téléphone jusqu'à sa synchronisation. N'effacez pas les données du site dans le navigateur pendant que la barre montre des éléments en attente — c'est la seule copie."
          }
        ]
      }
    ],
    "faq": [
      {
        "q": "Pourquoi l'offre dit-elle qu'un pointage est encore ouvert ?",
        "a": "Une heure encore en cours n'a pas de total, donc elle ne peut pas être facturée. Pointez la sortie d'abord, ou facturez-la sur la prochaine facture."
      },
      {
        "q": "Et s'il n'y a pas de taux horaire ?",
        "a": "L'encadré propose un lien vers Réglages → Terrain plutôt qu'un prix. Rien n'est facturé à un taux que personne n'a choisi."
      }
    ],
    "updated": "2026-09-21"
  },
};
