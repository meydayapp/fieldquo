// content/help/fr/jobs-and-scheduling-1.js
//
// Partie 1 de la catégorie « jobs-and-scheduling » en français (voir le
// composeur, jobs-and-scheduling.js). Slugs de cette partie (lib/help/tree.js) :
// the-jobs-list, create-a-job, the-job-page, visits-and-appointments,
// the-appointments-calendar, book-a-visit-for-a-client,
// arrival-windows-and-travel-buffer, appointment-reminders,
// the-on-my-way-text, clients-rescheduling-and-cancelling.
//
// Même structure que le module anglais (mêmes sections, mêmes blocs, mêmes
// figures). Les mots de l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js ; les quelques libellés encore en anglais dans le
// code (le formulaire de visite, les boutons de statut d'une visite, quatre
// titres de cartes, les deux éditeurs de textos) sont cités tels que l'écran
// les affiche.
export const ARTICLES = {
  "the-jobs-list": {
    title: "La liste des chantiers",
    summary:
      "Tous les chantiers de votre entreprise sur un seul écran — filtrés par statut, cherchés par titre ou par client, avec les archives derrière leur propre bouton.",
    updated: "2026-09-12",
    intro: [
      "**Chantiers** est la liste des travaux que votre entreprise s'est engagée à faire : chaque chantier, du plus récent au plus ancien, avec son statut, son client et le nombre de visites qui y sont rattachées. La plupart des chantiers arrivent ici d'eux-mêmes dès qu'un client approuve une soumission ; les autres, vous les créez à la main avec **Nouveau chantier**.",
      "C'est sur cette liste que le bureau répond à « qu'est-ce qui attend encore une date? » et que l'équipe trouve l'adresse où elle s'en va. Ce que chacun y voit dépend de son niveau d'accès — la même liste, réduite.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un chantier, c'est du travail planifié à l'adresse d'un client. Il se place entre la soumission (ce qui a été convenu) et la facture (ce qui sera facturé) : une soumission approuvée fait apparaître un chantier dans **À planifier** ; vous le planifiez, vous le faites, vous le passez à **Terminé**, et la facture et la demande d'avis suivent — voir [[when-a-job-is-completed|Quand un chantier est terminé]]." },
          { p: "La liste elle-même ne contient aucun détail. Chaque ligne ouvre [[the-job-page|la page du chantier]], où vivent les visites, les matériaux, les photos, les notes et le calcul des coûts." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Chantiers — Travaux planifiés et en cours.** En haut à droite, **Anciens chantiers** (l'historique de votre ancien système — voir [[import-past-jobs|Importer les anciens chantiers]]) et **Nouveau chantier**.",
            "Les puces de statut : **Tous**, **À planifier**, **Planifié**, **En cours**, **Terminé**, **Annulé**. Une seule est active à la fois.",
            "Après un séparateur, le bouton **Archivés**. Ce n'est pas un statut : il remplace la liste par les chantiers que vous avez classés.",
            "**Rechercher un chantier...** — filtre sur le titre du chantier ou le nom du client à mesure que vous tapez.",
            "Une ligne par chantier : le titre, un badge de statut, un badge **Récurrent** sur un chantier qui se répète, le nom du client, et « 3 visits » dès que des visites y sont planifiées.",
            "Une liste vide dit pourquoi elle est vide. Un filtre ou une recherche sans résultat affiche **Aucun chantier dans cette vue.** ; une entreprise toute neuve apprend que les chantiers sont créés automatiquement lorsqu'une soumission est acceptée ; un membre de l'équipe sans affectation lit **Vous n'êtes affecté à aucun chantier pour l'instant.**",
          ] },
          { figure: "live:app-jobs", caption: "Chantiers — les puces de statut, le bouton Archivés, la recherche, et un chantier tout juste sorti d'une soumission acceptée dans À planifier." },
        ],
      },
      {
        id: "find-a-job",
        heading: "Comment trouver un chantier",
        blocks: [
          { steps: [
            "Ouvrez **Chantiers** dans la barre latérale, sous Travail.",
            "Appuyez sur une puce de statut pour réduire la liste. **À planifier** est celle à vider chaque matin : un chantier qui s'y trouve n'a encore ni visite ni dates de travaux.",
            "Tapez une partie du titre ou du nom du client dans **Rechercher un chantier...** ; la liste se filtre à mesure, à l'intérieur de la puce choisie.",
            "Appuyez sur la ligne. La page du chantier s'ouvre ; **Retour aux chantiers** vous ramène ici.",
          ] },
          { tip: "Un chantier introuvable sous toutes les puces est probablement archivé. Appuyez sur **Archivés** : ce tiroir est distinct des puces de statut, si bien qu'un chantier peut être Terminé et archivé en même temps." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["Puces de statut", "Filtrent la liste chargée par statut. Elles ne changent rien au chantier lui-même — le statut se change sur la page du chantier."],
              ["Archivés", "Charge les chantiers archivés à la place des chantiers actifs. Les deux tiroirs ne s'affichent jamais ensemble. Un chantier s'archive ou se restaure depuis sa propre page."],
              ["Rechercher un chantier...", "Réduit la liste par titre ou nom de client. Effacez le texte pour tout revoir."],
              ["Nouveau chantier", "Ouvre le formulaire de chantier — voir [[create-a-job|Créer un chantier]]. Affiché seulement aux personnes dont l'accès permet de créer des chantiers."],
              ["Anciens chantiers", "Ouvre l'importation des anciens chantiers. Même règle d'accès que Nouveau chantier."],
              ["Une ligne", "Ouvre la page du chantier. Les lignes sont classées du chantier le plus récent au plus ancien, quel que soit le statut."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La ligne **Chantiers** apparaît pour quiconque a au moins l'accès Chantiers « View only » ; une personne réglée à « No access » n'a pas la ligne et la page la refuse. Le profil Équipe (Crew) est à « View only », mais restreint : un membre de l'équipe ne voit que les chantiers où une visite lui est assignée, et un chantier sans visite n'est à personne et n'apparaît pas. Les estimateurs voient tous les chantiers mais ne peuvent ni en créer ni en modifier. Les répartiteurs créent et modifient ; les gestionnaires, les administrateurs et le propriétaire peuvent aussi supprimer. Les profils sont décrits dans [[access-levels-overview|Niveaux d'accès : qui voit quoi]]." },
          { note: "Cacher le bouton n'est pas la règle — le serveur vérifie le même accès à chaque requête. Une personne qui atteint le formulaire Nouveau chantier par un vieux signet sans le bon niveau lit **Votre niveau d'accès vous permet de consulter les chantiers, pas d'en créer.**" },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi un chantier manque-t-il à mon employé?", a: "Un membre de l'équipe ne voit que les chantiers où une visite lui est assignée. Planifiez une visite sur le chantier avec son nom et il apparaît aussitôt dans sa liste." },
      { q: "Le bouton Archivés veut-il dire annulé?", a: "Non. Annulé est un statut ; archivé, c'est si vous voulez encore voir le chantier. Un chantier fini que vous classez reste Terminé, et Restaurer sur sa page le ramène dans la liste active." },
      { q: "Puis-je trier ou exporter la liste?", a: "Pas depuis cet écran. L'ordre est fixe, du plus récent au plus ancien, et il n'y a pas d'exportation ici — l'historique des anciens chantiers voyage dans l'autre sens, vers FieldQuo, par Anciens chantiers." },
    ],
  },

  "create-a-job": {
    title: "Créer un chantier",
    summary:
      "D'où viennent les chantiers — une soumission approuvée, une facture ou le formulaire Nouveau chantier — et ce que fait chaque champ du formulaire.",
    updated: "2026-09-12",
    intro: [
      "Vous avez rarement besoin de créer un chantier à la main. Dès qu'un client approuve une soumission, FieldQuo crée le chantier pour vous dans **À planifier**, un chantier par soumission, avec le client et la soumission déjà rattachés. Le formulaire **Nouveau chantier** sert au reste : des travaux convenus au téléphone, un retour sous garantie, un client qui n'a jamais eu de soumission.",
      "Cet article couvre les trois portes d'entrée et chaque champ du formulaire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un chantier a besoin de deux choses pour exister : un client et un titre. Tout le reste — l'adresse du chantier, s'il se répète, s'il s'agit d'un rappel — est facultatif, et la date n'est volontairement pas sur ce formulaire. Un nouveau chantier atterrit dans **À planifier** et reçoit sa date sur la page du chantier, soit en planifiant une visite, soit en fixant le début et la fin des travaux. Voir [[the-job-page|La page du chantier]]." },
          { p: "Les trois façons de créer un chantier : automatiquement à partir d'une soumission approuvée ([[convert-a-quote-to-a-job|Ce qui se passe quand une soumission est approuvée]]) ; à partir d'une facture qui n'a pas encore de chantier derrière elle, avec **Créer le travail** dans le panneau **Le travail** de la facture ; et à la main avec **Nouveau chantier**." },
        ],
      },
      {
        id: "by-hand",
        heading: "Comment créer un chantier à la main",
        blocks: [
          { steps: [
            "Ouvrez **Chantiers** et appuyez sur **Nouveau chantier**.",
            "Sous **Client**, cherchez et choisissez le client. S'il n'existe pas encore, **En ajouter un** ouvre la fiche client ; un chantier ne peut pas être enregistré sans client.",
            "Tapez un **Titre du chantier** — l'exemple proposé est « p. ex. Refinition des armoires de cuisine ».",
            "Remplissez **Adresse du chantier** seulement si les travaux se font ailleurs qu'à l'adresse du client. Vide veut dire l'adresse du client, et cette adresse sert à indiquer à quelle distance du chantier l'équipe était au pointage.",
            "Cochez **Il s'agit d'un chantier récurrent** si les travaux se répètent et choisissez **Hebdomadaire**, **Toutes les 2 semaines** ou **Mensuel** sous **Récurrence**. La case ne s'enregistre pas sans fréquence.",
            "Appuyez sur **Créer le chantier**. La page du chantier s'ouvre, dans **À planifier**.",
          ] },
          { figure: "create:app-jobs-create", caption: "Nouveau chantier — le sélecteur de client, le titre, l'adresse du chantier facultative et la case de récurrence." },
          { note: "Un chantier démarré depuis la fiche d'un client arrive avec le client déjà choisi. Un chantier démarré avec **Enregistrer un chantier de rappel** depuis un autre chantier arrive intitulé « Rappel : … » et demande **Pourquoi y retournez-vous ?** avant de s'enregistrer." },
        ],
      },
      {
        id: "the-fields",
        heading: "Ce que fait chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il change"],
            rows: [
              ["Client", "Obligatoire. Le chantier reprend le nom, le téléphone, le courriel et l'adresse du client sur sa page et sur chaque visite."],
              ["Titre du chantier", "Obligatoire. C'est ce qu'affichent la liste, le calendrier et le salon de clavardage du chantier."],
              ["Adresse du chantier", "Facultatif. Une fois renseignée, FieldQuo la place sur une carte pour que les pointages et les boutons En route / Marquer comme terminée puissent dire à quelle distance du chantier la personne se trouvait. Si l'adresse ne peut pas être placée, la page du chantier le dit et vous demande de la vérifier."],
              ["Il s'agit d'un chantier récurrent + Récurrence", "Marque le chantier **Récurrent** et, dès qu'une première visite existe, garde exactement une visite à venir au calendrier à ce rythme — voir [[recurring-jobs|Chantiers récurrents]]."],
              ["Pourquoi y retournez-vous ?", "Seulement sur un chantier de rappel. Obligatoire, parmi une liste fixe de raisons ; le rappel compte dans le taux de reprises/rappels du tableau de bord des indicateurs et est lié depuis le chantier d'origine."],
            ],
          } },
        ],
      },
      {
        id: "who-can-create",
        heading: "Qui peut créer un chantier",
        blocks: [
          { p: "Créer un chantier exige l'accès Chantiers « View, create, and edit » ou plus — les profils Répartiteur et Gestionnaire, les administrateurs et le propriétaire. Les estimateurs et l'équipe voient la liste mais pas le bouton **Nouveau chantier**, et le formulaire lui-même les refuse avec **Votre niveau d'accès vous permet de consulter les chantiers, pas d'en créer.** Le même niveau régit **Créer le travail** sur une facture." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je créer un chantier quand une soumission est approuvée?", a: "Non. FieldQuo le fait pour vous, une fois par soumission, et il apparaît dans À planifier. En créer un autre à la main vous donnerait deux chantiers pour une soumission." },
      { q: "Où est-ce que je mets la date?", a: "Sur la page du chantier. Soit Planifier une visite (un déplacement au chantier avec une personne), soit Définir les dates (le début et la fin des travaux). L'un ou l'autre fait passer le chantier d'À planifier à Planifié." },
      { q: "Puis-je rattacher une soumission à un chantier créé à la main?", a: "Pas depuis le formulaire — le lien vers la soumission se crée quand le chantier naît de la soumission. Partez de la soumission si vous avez besoin du lien." },
    ],
  },

  "the-job-page": {
    title: "La page du chantier",
    summary:
      "Tout ce qui concerne un chantier sur une seule page : statut, dates, client, coûts, matériaux, tâches, documents, journal de chantier, visites et dossier photo.",
    updated: "2026-09-12",
    intro: [
      "La page du chantier est faite pour la personne debout dans l'entrée de garage : qui, où, quand, et ce qu'il reste à faire. C'est aussi là que le bureau change le statut du chantier, planifie les visites et lit ce que le chantier a coûté. L'ordre des cartes est voulu — ce qu'il faut avant de partir vient en premier, le travail lui-même au milieu, les preuves à la fin.",
      "Toutes les cartes ne s'affichent pas pour tout le monde. Plusieurs se cachent quand elles sont vides, et la carte des coûts n'apparaît qu'aux personnes qui ont l'interrupteur Job costing.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Ouvrez n'importe quelle ligne de **Chantiers** et vous arrivez ici. Le titre et un badge de statut sont en haut, avec « From quote Q-2026-0003 » en dessous quand le chantier vient d'une soumission, un badge **Archivés** quand il est classé, et **Saisi comme travail passé le … — aucun message n'a été envoyé.** sur un chantier importé de votre ancien système." },
        ],
      },
      {
        id: "top-of-the-page",
        heading: "Les commandes du haut",
        blocks: [
          { bullets: [
            "La liste déroulante **Statut** — **À planifier**, **Planifié**, **En cours**, **Terminé**, **Annulé**. Passer à Terminé horodate la fin, crée deux tâches (« Ask … for a review » et « Review what … actually cost ») et, si les demandes d'avis sont activées, lance le compte à rebours de la demande d'avis automatique — voir [[when-a-job-is-completed|Quand un chantier est terminé]]. Quitter Terminé efface l'horodatage.",
            "**Modifier** — le **Titre**, le **Statut**, les **Dates des travaux** (**Date de début** et **Date de fin**), l'**Adresse du chantier** et **Ce chantier se répète** avec **À quelle fréquence**.",
            "**Archiver** / **Restaurer** — classe le chantier sans changer son statut ; le même bouton annule l'opération. Voir [[cancel-or-archive-a-job|Annuler ou archiver un chantier]].",
            "**Supprimer** — retire le chantier et ses visites pour de bon ; la soumission et toute facture restent. Un chantier qui porte déjà des heures ou des tâches ne peut pas être supprimé : la page dit ce qui y est rattaché et suggère de l'annuler plutôt.",
            "La bannière mauve **Ce chantier a besoin d'une date — planifiez une visite, ou définissez les dates de début et de fin des travaux.**, avec **Définir les dates** et **Planifier une visite**, jusqu'à ce que le chantier ait l'un ou l'autre.",
          ] },
        ],
      },
      {
        id: "needs-a-date",
        heading: "Donner une date au chantier",
        blocks: [
          { p: "Un chantier tout juste sorti d'une soumission n'a pas de date. Il y a deux façons honnêtes de lui en donner une, et les deux passent le statut à **Planifié** d'elles-mêmes : une visite, c'est-à-dire un déplacement à l'adresse avec une date et une personne ; ou les propres **Date de début** et **Date de fin** des travaux, pour un repeinturage de deux semaines qui n'a aucun déplacement précis auquel accrocher une date." },
          { steps: [
            "Appuyez sur **Planifier une visite** pour réserver un déplacement — voir [[book-a-visit-for-a-client|Réserver une visite pour un client]].",
            "Ou appuyez sur **Définir les dates**, remplissez **Date de début** et, si vous la connaissez, **Date de fin**, puis **Enregistrer les modifications**. La page affiche alors **Travaux planifiés : Sep 14, 2026 – Sep 25, 2026**, ou « pas encore de date de fin ».",
            "Une visite planifiée hors de ces dates reçoit le badge **Hors des dates du chantier** — un rappel, jamais un blocage, parce qu'un repérage avant les travaux ou un retour sous garantie est souvent voulu en dehors.",
          ] },
        ],
      },
      {
        id: "the-cards",
        heading: "Les cartes, de haut en bas",
        blocks: [
          { table: {
            head: ["Carte", "Ce qu'elle contient"],
            rows: [
              ["Bannières de rappel", "**Ce chantier est un rappel** avec la raison et un lien vers l'original ; ou **Chantiers de rappel liés à celui-ci**, qui liste les retours planifiés à partir de lui."],
              ["Échéancier de paiement", "Les étapes convenues sur la soumission et ce que chacune a encaissé. Seulement si votre entreprise utilise un échéancier de paiement."],
              ["Client", "**Nom**, **Téléphone** (touchez pour appeler), **Adresse** (touchez pour ouvrir la carte), **Courriel**, et **Adresse du chantier** quand elle diffère. Un membre de l'équipe limité au nom et à l'adresse lit **Masqué par votre niveau d'accès** à la place du téléphone et du courriel."],
              ["Ce que ce projet a coûté", "Le soumissionné contre le réel — main-d'œuvre, matériaux, dépenses, sous-traitants. Seulement pour les personnes qui ont l'interrupteur Job costing. Voir [[job-costing|Coûts de chantier : soumissionné contre réel]]."],
              ["Sous-traitants sur ce chantier", "Les sous-traitants engagés à prix fixe sur ce chantier, leurs montants convenus et leurs paiements."],
              ["Avenants", "Les changements de portée convenus après l'acceptation de la soumission, consignés délibérément plutôt que déduits d'une modification."],
              ["Materials to buy", "La liste d'achats et ce qui a été acheté — voir [[materials-on-a-job|Les matériaux d'un chantier]]."],
              ["Équipement utilisé", "Lequel de vos propres équipements a été du voyage."],
              ["Tâches pour ce contrat", "Les tâches liées au chantier — voir [[tasks|Les tâches]]."],
              ["Documents", "Plans, permis, garanties ; une nouvelle révision n'écrase jamais l'ancienne."],
              ["Journal de chantier", "Ce qui s'est réellement passé, une ligne par jour — la visite, c'est ce qui était prévu ; ici, c'est ce qui en est sorti. Voir [[job-notes|Les notes d'un chantier]]."],
              ["Visites", "Chaque visite avec sa date, son badge, la personne assignée, le compte de la liste de vérification et des photos, les boutons de statut et la liste — voir plus bas."],
              ["Tasks from the notes", "Lit les notes du client, de la soumission et des visites et propose des tâches ; rien n'est ajouté sans votre accord. Voir [[suggested-tasks|Les tâches suggérées]]."],
              ["Photo record et Job photos", "Chaque photo classée et datée par étape, puis le sous-ensemble choisi pour votre site web. Voir [[job-photos-and-tags|Photos de chantier et étiquettes]]."],
            ],
          } },
        ],
      },
      {
        id: "visits-on-the-job",
        heading: "Les visites du chantier",
        blocks: [
          { p: "La carte **Visites** indique « 2 of 3 complete » et offre **Ajouter une visite** et **Enregistrer un chantier de rappel**. Chaque visite affiche sa date et son heure, un badge (**Planifié**, **En route**, **Terminé**, **Annulé**), « Assigned to Dave » ou « Unassigned », l'avancement de la liste de vérification, le nombre de photos, et où était le téléphone au moment du toucher — **Arrivé à 12 m du chantier**." },
          { bullets: [
            "**En route** — passe la visite à En route et envoie un texto au client ; la ligne sous les boutons dit à quel numéro il part. Voir [[the-on-my-way-text|Le texto « En route »]].",
            "**Marquer comme terminée** — marque la visite terminée. Sur un chantier récurrent, la visite suivante est mise au calendrier sur-le-champ.",
            "**Annuler la visite** — annule cette visite seulement ; le statut du chantier ne change pas.",
            "**Reopen** sur une visite terminée, et **Put it back on** sur une visite annulée, la ramènent à Planifié — une fausse manœuvre sur un téléphone ne doit pas être définitive.",
            "La liste de vérification sous chaque visite est la copie à cocher de l'équipe — voir [[checklists-on-site|Les listes de vérification sur le chantier]].",
          ] },
          { note: "Les boutons de statut n'apparaissent que pour la personne à qui la visite est assignée, pour n'importe qui sur une visite non assignée, et pour les personnes dont l'accès Horaire est « Edit everyone's schedule ». Les autres voient le badge et aucun bouton — le serveur refuse le changement de toute façon." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut voir quoi",
        blocks: [
          { p: "Quiconque a l'accès Chantiers « View only » ou plus ouvre la page ; l'équipe n'ouvre que les chantiers où elle a une visite. La liste **Statut**, **Modifier** et **Archiver** apparaissent à « View, create, and edit » ; **Supprimer** à « View, create, edit, and delete ». La carte des coûts exige l'interrupteur **Job costing**, que le profil Gestionnaire a et que le profil Répartiteur n'a pas." },
          { p: "Planifier une visite relève de l'horaire, pas des chantiers : un membre de l'équipe peut ajouter une visite à son propre chantier, mais y mettre le nom de quelqu'un d'autre exige un propriétaire, un administrateur ou un superviseur." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon équipe ne peut-elle pas changer le statut?", a: "Le profil Équipe consulte les chantiers ; il ne les modifie pas. La liste de statut, Modifier et Archiver sont cachés à ce niveau parce que le serveur les refuserait. L'équipe fait avancer ses visites — En route, Marquer comme terminée — et c'est à ça que sert la page sur le terrain." },
      { q: "La carte des coûts est absente.", a: "Elle ne s'affiche qu'aux personnes qui ont l'interrupteur Job costing, et elle se cache tant que rien n'a été enregistré contre le chantier. Le propriétaire, les administrateurs et le profil Gestionnaire ont l'interrupteur." },
      { q: "Que se passe-t-il quand je passe le chantier à Terminé?", a: "Deux tâches sont créées — demander un avis au client, et revoir ce que le chantier a réellement coûté — la revue des coûts s'ouvre d'elle-même une fois, et la demande d'avis automatique part selon son horaire si vous l'avez activée." },
    ],
  },

  "visits-and-appointments": {
    title: "Visites et rendez-vous",
    summary:
      "Les trois sortes d'entrées de votre calendrier — visites de chantier, rendez-vous et réservations client — à quoi sert chacune, et ce que vous pouvez faire avec.",
    updated: "2026-09-12",
    intro: [
      "Le calendrier fusionne trois choses différentes et étiquette chacune : une **Visite de chantier** est un déplacement à l'adresse d'un chantier, un rendez-vous est une réservation autonome avec un client, et une **Réservation client** est une plage choisie par un client sur votre page de rendez-vous publique qui n'est pas encore devenue un rendez-vous. Le jour même, elles se ressemblent ; elles se comportent différemment, et savoir laquelle est laquelle épargne un appel.",
      "Cet article est la carte. [[the-appointments-calendar|Le calendrier des rendez-vous]] parcourt l'écran lui-même, et [[book-a-visit-for-a-client|Réserver une visite pour un client]] les deux formulaires.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo garde une ligne par chose réelle et lit les trois en même temps, si bien qu'une visite planifiée sur un chantier apparaît au calendrier sans copie qui pourrait diverger. Les commandes varient un peu selon la sorte : un rendez-vous et une visite de chantier se réassignent, se déplacent, s'annulent et se terminent depuis le calendrier (une visite aussi depuis la page de son chantier); une réservation qui n'est pas encore devenue un rendez-vous se déplace par le client, avec son propre lien." },
        ],
      },
      {
        id: "three-kinds",
        heading: "Les trois sortes",
        blocks: [
          { table: {
            head: ["Sorte", "D'où elle vient", "À quoi elle appartient"],
            rows: [
              ["Visite de chantier", "**Ajouter une visite** ou **Planifier une visite** sur la page d'un chantier ; la visite suivante d'un chantier récurrent.", "Un chantier. Elle porte la liste de vérification de l'équipe, les photos, les notes et les boutons En route / Marquer comme terminée."],
              ["Rendez-vous", "**Nouveau rendez-vous** sur le calendrier ; une réservation confirmée depuis votre page de rendez-vous ; un rappel ou une visite réservés par le réceptionniste IA.", "Un client, sans chantier derrière. Il reçoit le texto de rappel, comme une visite."],
              ["Réservation client", "Une réservation confirmée depuis la page de rendez-vous qui n'a pas encore été transformée en rendez-vous.", "Le type de rendez-vous choisi par le client. Le client peut la déplacer ou l'annuler avec le lien de son courriel de confirmation."],
            ],
          } },
        ],
      },
      {
        id: "what-the-calendar-shows",
        heading: "Ce que montre le calendrier",
        blocks: [
          { p: "Chaque sorte atterrit sur son jour dans la grille du mois et dans la liste en dessous, triée par heure, avec son propre badge pour que rien ne se fasse passer pour autre chose." },
          { bullets: [
            "Un badge **Visite de chantier**, le titre du chantier sous le nom du client, le nom de la personne assignée et **Ouvrir le projet**.",
            "Un rendez-vous : le badge de statut, un badge **Visite réservée** / **Rappel programmé** / **Appel vidéo réservé** quand il est passé par la page de rendez-vous ou le réceptionniste, **Réservé par le réceptionniste IA** quand personne de l'entreprise n'a parlé au client, et la liste déroulante d'assignation.",
            "Un badge **Réservation client**, le nom du type de rendez-vous et la personne assignée.",
            "Sur n'importe quelle ligne, le numéro de téléphone compose et l'adresse ouvre la carte sans rien ouvrir d'abord.",
          ] },
          { figure: "live:app-appointments", caption: "Rendez-vous — les puces de statut avec leur compte, la grille du mois, et la liste des lignes du mois ou du jour choisi." },
        ],
      },
      {
        id: "which-one-to-use",
        heading: "Laquelle utiliser",
        blocks: [
          { bullets: [
            "Du travail à l'adresse d'un chantier — une prise de mesures, une journée de pose, un retour sous garantie — est une visite sur ce chantier. Elle garde le statut du chantier honnête et donne à l'équipe la liste de vérification et le dossier photo.",
            "Un premier coup d'œil avant qu'il y ait un chantier — une visite d'estimation, un rappel — est un rendez-vous. Il peut recevoir un texto de rappel et se réassigner depuis le calendrier.",
            "Un client qui réserve depuis votre site web ou par le réceptionniste n'est ni l'un ni l'autre — il a fait une réservation, qui devient un rendez-vous d'elle-même (tout de suite si la visite est gratuite, une fois les frais de visite payés sinon).",
          ] },
          { tip: "Si un chantier existe déjà, réservez la visite depuis le chantier, pas depuis **Nouveau rendez-vous**. Un rendez-vous ne se lie pas à un chantier, et c'est une visite qui fait apparaître le chantier dans la liste de l'employé." },
        ],
      },
      {
        id: "what-each-can-and-cannot-do",
        heading: "Ce que chaque sorte peut et ne peut pas faire",
        blocks: [
          { p: "Un rendez-vous sur le calendrier et une visite de chantier — sur le calendrier ou sur la page de son chantier — partagent un même jeu de boutons : **Reporter**, **Marquer comme terminée**, **Annuler la visite**, puis **Rouvrir** ou **Remettre au calendrier**. Reporter est tenu au même calcul de marge de déplacement que le lien du client et explique un trou trop court avant d'offrir **Déplacer quand même**; Annuler la visite demande un motif qui reste sur la ligne, et c'est un statut, jamais une suppression. Les deux boîtes de dialogue proposent d'envoyer un courriel au client, dans la langue du client, disant que le bureau l'a déplacée ou annulée. Une réservation passée par la page de rendez-vous se déplace et s'annule avec son rendez-vous; celle qui n'est pas encore devenue un rendez-vous se déplace par le client, avec son propre lien — voir [[clients-rescheduling-and-cancelling|Quand un client déplace ou annule]]." },
          { note: "Les rappels de rendez-vous partent pour les rendez-vous et les visites de chantier pareillement, une fois chacun, au délai réglé sous Paramètres → Notifications. Le bouton **En route** de l'équipe est le second avertissement de la visite, au moment du départ." },
        ],
      },
    ],
    faq: [
      { q: "Une visite de chantier reçoit-elle un texto de rappel?", a: "Oui — le rappel lit les visites de chantier comme les rendez-vous : même formulation, même délai, même vérification STOP, jamais deux fois. Une visite déjà terminée ou annulée n'en reçoit pas. Le toucher En route de l'équipe est un second texto, au moment où ça compte." },
      { q: "Puis-je transformer un rendez-vous en chantier?", a: "Pas avec un bouton. Créez le chantier (ou laissez la soumission approuvée le créer) et planifiez une visite dessus ; le rendez-vous reste au calendrier sur sa propre ligne." },
      { q: "Une ligne Réservation client n'a pas de lien Ouvrir le projet.", a: "Exact — une réservation appartient à un type de rendez-vous et à un client, pas à un chantier. Elle devient un rendez-vous d'elle-même ; elle ne devient jamais une visite de chantier." },
    ],
  },

  "the-appointments-calendar": {
    title: "Le calendrier des rendez-vous",
    summary:
      "L'écran Calendrier : les puces de statut avec leur compte, la grille du mois, chaque ligne avec ses badges, le trajet entre deux arrêts, qui est assigné, et les deux prochaines semaines de votre équipe.",
    updated: "2026-09-12",
    intro: [
      "**Calendrier** dans la barre latérale ouvre **Rendez-vous — Visites sur place et affectations de chantier.** C'est l'endroit où demander « qu'est-ce qui se passe cette semaine? » : visites de chantier, rendez-vous et réservations client y apparaissent tous, chacun sur son jour, chacun étiqueté.",
      "L'écran a trois parties — les puces, la grille, la liste — et une quatrième, **Votre équipe**, pour ceux qui dirigent une équipe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Rien ne se réserve depuis la grille elle-même. Vous la lisez, vous choisissez un jour pour réduire la liste, puis vous agissez sur les lignes : appeler, naviguer, assigner, déplacer, annuler ou terminer, ouvrir le chantier. La réservation se fait par **Nouveau rendez-vous** ou depuis la page d'un chantier — voir [[book-a-visit-for-a-client|Réserver une visite pour un client]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Nouveau rendez-vous** en haut à droite.",
            "Les puces **Tous**, **Planifié**, **Superviseur requis**, **Terminé**, **Annulé**, chacune avec le compte des lignes qu'elle afficherait. Le compte n'apparaît qu'une fois la liste chargée — une puce ne dit jamais 0 au-dessus d'une requête restée sans réponse.",
            "L'en-tête du mois avec **Précédent**, **Aujourd'hui** et **Suivant**. La semaine commence le jour réglé sous **Profil de l'entreprise → Premier jour de la semaine** — le dimanche, sauf si vous l'avez changé.",
            "Sept colonnes à toutes les largeurs. Aujourd'hui est entouré. Au-dessus de la largeur d'un téléphone, un jour affiche jusqu'à deux puces (heure et client) et « +1 » pour le reste ; sur un téléphone, il affiche des points.",
            "Appuyez sur un jour pour n'afficher que ses lignes ; la date et **Effacer** apparaissent au-dessus de la liste. Appuyez de nouveau sur le jour pour l'effacer.",
            "La liste : une carte par entrée, dépliable, puis **Votre équipe** en dessous.",
          ] },
          { figure: "live:app-appointments", caption: "Rendez-vous — les puces avec leur compte, la grille du mois qui entoure aujourd'hui, et en dessous les lignes du mois." },
        ],
      },
      {
        id: "reading-a-row",
        heading: "Lire une ligne",
        blocks: [
          { p: "Chaque carte commence par le nom du client et un badge de statut — **Planifié**, **Superviseur requis**, **Terminé**, **Annulé**, et pour les autres sortes **Confirmé**, **En attente de paiement**, **En route**. Puis le badge de sorte, l'heure (et l'heure de fin quand une réservation en porte une), et un numéro de téléphone et une adresse qui fonctionnent comme des liens. Appuyez sur la carte pour ouvrir les détails." },
          { bullets: [
            "**Visite de chantier** — le titre du chantier, le nom de la personne assignée et **Ouvrir le projet**. Ses notes et sa liste de vérification se modifient sur le chantier; la déplacer, l'annuler et la terminer se fait aussi d'ici.",
            "**Réservation client** — le type de rendez-vous et la personne assignée. Déplacée par le client, avec son propre lien.",
            "**Superviseur requis** — ce rendez-vous doit être assigné à un propriétaire, un administrateur ou un superviseur.",
            "**Réservé par le réceptionniste IA** — personne de l'entreprise n'a parlé à ce client ; les mots de l'appelant sont dans les notes.",
            "**Visite réservée** / **Rappel programmé** / **Appel vidéo réservé** — comment le client a demandé à vous rencontrer. Un rappel n'a pas d'adresse, par conception.",
            "Les détails : **Téléphone**, **Courriel**, **Lieu**, **Adresse** (quand l'adresse du client diffère du lieu), **Notes**, et **Ouvrir la fiche client**. Un champ masqué par votre niveau d'accès le dit plutôt que de paraître vide.",
          ] },
        ],
      },
      {
        id: "drives-between-stops",
        heading: "Le trajet entre deux arrêts",
        blocks: [
          { p: "Au-dessus d'une ligne, vous pouvez voir « about 25 min drive · 40 min gap », ou en ambre « about 25 min drive · 20 min gap · 5 min short ». C'est l'estimation à vol d'oiseau entre deux arrêts consécutifs d'une même personne le même jour, affichée seulement quand les deux arrêts ont des coordonnées. Le verdict — serré ou non — n'est donné que si l'arrêt précédent a une heure de fin, ce qu'une réservation a et qu'un rendez-vous créé à la main n'a pas." },
          { note: "C'est une estimation, et elle le dit — un facteur de route appliqué à la distance à vol d'oiseau, pas un itinéraire en direct. La vraie vérification de trajet sur les plages que les clients peuvent réserver utilise le même calcul avec le temps de conduite de Google par-dessus ; voir [[arrival-windows-and-travel-buffer|Fenêtres d'arrivée et marge de déplacement]]." },
        ],
      },
      {
        id: "assign-someone",
        heading: "Comment assigner un rendez-vous",
        blocks: [
          { steps: [
            "Trouvez la ligne. Sur un rendez-vous, la liste déroulante à droite indique **Non assigné** ou un nom.",
            "Choisissez la personne. Sur un rendez-vous **Superviseur requis**, les noms qui ne sont pas des superviseurs sont marqués « (not a supervisor) » et le serveur les refuse.",
            "La ligne se met à jour aussitôt, et un rendez-vous Superviseur requis qui vient de recevoir un superviseur passe à **Planifié**.",
          ] },
          { warning: "Seuls le propriétaire, les administrateurs et les superviseurs (les profils Répartiteur et Gestionnaire) ont la liste déroulante. Les autres voient le nom, plus **Me l'assigner** sur un rendez-vous non assigné qui n'exige pas de superviseur — la seule assignation qui leur est permise." },
        ],
      },
      {
        id: "move-cancel-or-complete",
        heading: "Déplacer, annuler ou terminer une entrée",
        blocks: [
          { p: "Sous un rendez-vous ou une visite de chantier sur lesquels vous pouvez agir, la ligne porte **Reporter**, **Marquer comme terminée** et **Annuler la visite** — et sur une entrée terminée ou annulée, **Rouvrir** ou **Remettre au calendrier**. Une **Réservation client** pas encore devenue un rendez-vous n'a rien de tout ça; le client la déplace avec son lien." },
          { steps: [
            "Appuyez sur **Reporter**. Sous **Nouvelle date et heure**, choisissez le moment. La case **Prévenir … du changement par courriel** est cochée quand le client a une adresse au dossier — la boîte de dialogue dit clairement quand il n'y en a pas — et la lettre part dans la langue du client, en disant que le bureau l'a déplacée.",
            "Appuyez sur **Déplacer**. Une heure déjà passée, ou qui laisse trop peu pour le trajet depuis l'arrêt précédent ou vers le suivant — la même vérification de marge de déplacement que la page de rendez-vous applique — est refusée avec le motif, et **Déplacer quand même** la renvoie quand vous en savez plus que l'estimation.",
            "Appuyez sur **Annuler la visite** pour l'annuler. Le **Motif (conservé sur la visite, non envoyé au client)** est facultatif; écrit, il s'affiche ensuite sous la ligne et s'efface si vous la remettez au calendrier. La même case de courriel s'applique, et la lettre du client dit que le bureau a annulé.",
            "Appuyez sur **Marquer comme terminée** quand c'est fait, **Rouvrir** pour revenir en arrière, ou **Remettre au calendrier** pour rétablir une visite annulée. Annuler est un statut, jamais une suppression — la ligne reste.",
          ] },
          { note: "Les boutons apparaissent aux mêmes conditions que les routes imposent : un rendez-vous à la personne assignée ou à Horaire à « Edit everyone's schedule »; une visite à la personne assignée, à n'importe qui quand elle n'est pas assignée, ou à ce même niveau. Une réservation derrière un rendez-vous se déplace et s'annule avec lui, donc la plage sur votre page de rendez-vous suit." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Qui voit quoi",
        blocks: [
          { table: {
            head: ["Accès", "Ce que montre le calendrier"],
            rows: [
              ["Horaire à « Edit everyone's schedule » ou plus — Répartiteur, Gestionnaire, administrateur, propriétaire", "Tous les rendez-vous, toutes les visites et toutes les réservations de l'entreprise, plus **Votre équipe** en dessous."],
              ["Estimateur", "Ses propres rendez-vous et les rendez-vous non assignés ; ses propres visites et les visites non assignées ; les réservations sur ses propres types de rendez-vous. Pas de section **Votre équipe**."],
              ["Équipe", "Ses propres rendez-vous et les rendez-vous non assignés ; ses propres visites, et les visites non assignées des chantiers où elle est ; les réservations sur ses propres types de rendez-vous."],
              ["Tout le monde", "Le bouton **Nouveau rendez-vous** — créer un rendez-vous pour soi-même ou non assigné est permis à tous les niveaux ; l'assigner à quelqu'un d'autre ne l'est pas."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la grille commence-t-elle le dimanche?", a: "Le premier jour de la semaine est un réglage d'entreprise dans Profil de l'entreprise. Changez-le là et la grille suit." },
      { q: "Puis-je déplacer un rendez-vous en le glissant?", a: "Pas en le glissant. Appuyez sur **Reporter** sur la ligne — un rendez-vous ou une visite de chantier — et choisissez la nouvelle heure; la vérification du trajet dit si c'est trop serré. Une réservation client pas encore devenue un rendez-vous se déplace par le client, avec son lien." },
      { q: "Où est Votre équipe?", a: "Elle s'affiche sous la liste pour les personnes qui voient l'horaire de toute l'équipe — Répartiteur, Gestionnaire, administrateur et propriétaire — et liste ce que chaque personne a au calendrier pour les deux prochaines semaines. Voir [[the-team-schedule|L'horaire de l'équipe]]." },
    ],
  },

  "book-a-visit-for-a-client": {
    title: "Réserver une visite pour un client",
    summary:
      "Les deux formulaires — Ajouter une visite sur un chantier, et Nouveau rendez-vous sur le calendrier — étape par étape, avec ce que fait chaque champ et qui peut le remplir.",
    updated: "2026-09-12",
    intro: [
      "Il y a deux façons de mettre vous-même un client au calendrier, et la différence, c'est s'il existe un chantier. S'il en existe un, réservez une **visite** sur le chantier : elle porte la liste de vérification et les photos de l'équipe, et c'est elle qui fait apparaître le chantier dans la liste de l'employé. S'il n'y a pas encore de chantier — un premier coup d'œil, un rappel — réservez un **rendez-vous** depuis le calendrier.",
      "Une troisième façon ne demande rien de vous : le client réserve une plage sur votre page de rendez-vous, et elle atterrit au calendrier toute seule.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les deux formulaires demandent le même noyau — quand, et qui y va — et diffèrent par ce qui l'entoure. Le formulaire de visite ajoute des notes pour l'équipe et une liste de vérification ; le formulaire de rendez-vous ajoute l'adresse du lieu et la case de superviseur. Ni l'un ni l'autre ne demande de prix : rien qui touche à l'argent ne se décide quand on réserve une visite." },
        ],
      },
      {
        id: "a-visit-on-a-job",
        heading: "Comment réserver une visite sur un chantier",
        blocks: [
          { steps: [
            "Ouvrez le chantier et appuyez sur **Ajouter une visite** dans la carte **Visites**, ou sur **Planifier une visite** dans la bannière mauve d'un chantier qui attend encore une date.",
            "Sous « When », choisissez la date et l'heure. C'est obligatoire.",
            "Sous « Who is going », choisissez un membre de l'équipe ou laissez « Not assigned yet ». Une visite non assignée peut être réclamée et terminée par n'importe qui.",
            "Ajoutez des « Notes for the crew » — code de barrière, où stationner, qui demander. Elles s'affichent sur la visite, sur la page du chantier.",
            "Cochez **This is a return to fix or check something from earlier on this job** si c'est le cas ; le formulaire demande alors **Pourquoi y retournez-vous ?** et la visite compte dans votre taux de reprises/rappels, sauf si la raison est « pas de notre faute ».",
            "Sous « Checklist », cochez une ou plusieurs de « Your checklists » ou des « Starter lists for your trades » — l'équipe reçoit sa propre copie à cocher — puis appuyez sur « Schedule visit ».",
          ] },
          { note: "Réserver une visite sur un chantier **À planifier** le passe à **Planifié** de lui-même, et met la personne assignée dans le salon de clavardage du chantier — voir [[a-chat-room-for-every-job|Un salon de clavardage pour chaque chantier]]." },
        ],
      },
      {
        id: "a-standalone-appointment",
        heading: "Comment réserver un rendez-vous",
        blocks: [
          { steps: [
            "Ouvrez **Calendrier** et appuyez sur **Nouveau rendez-vous**.",
            "Tapez le **Nom du client**. FieldQuo cherche un client existant portant exactement ce nom et l'utilise ; sinon, il crée un nouveau client à ce nom, ce qui exige l'accès en modification aux clients.",
            "Choisissez **Date et heure**.",
            "Tapez le **Lieu** — l'adresse du chantier. Un rappel n'en a pas.",
            "Cochez **Exige la présence d'un superviseur sur place** quand seuls un propriétaire, un administrateur ou un superviseur peuvent s'en charger. Laissé non assigné, le rendez-vous s'affiche **Superviseur requis** jusqu'à ce qu'un superviseur y soit mis.",
            "Sous **Assigner à**, choisissez une personne ou laissez **Non assigné**, puis appuyez sur « Create Appointment ».",
          ] },
          { figure: "create:app-appointments-create", caption: "Nouveau rendez-vous — nom du client, date et heure, lieu, la case de superviseur et Assigner à." },
          { note: "Ce formulaire crée un rendez-vous, pas un chantier. Il n'envoie rien au client au moment de la réservation ; le texto de rappel de rendez-vous, si vous l'avez activé, part avant l'heure — voir [[appointment-reminders|Rappels de rendez-vous]]." },
        ],
      },
      {
        id: "let-the-client-book",
        heading: "Ou laissez le client réserver",
        blocks: [
          { p: "Votre page de rendez-vous offre les types de rendez-vous que vous avez créés sous **Paramètres → Page de rendez-vous**, seulement aux heures que vous pouvez vraiment atteindre, et perçoit des frais de visite quand le type en a. Une réservation confirmée devient un rendez-vous au calendrier, assigné à la personne dont c'est l'agenda ; le client reçoit un courriel de confirmation avec un lien pour la déplacer ou l'annuler lui-même." },
          { tip: "Partagez le lien de réservation ou intégrez le calendrier à votre propre site — voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission à n'importe quel site]] et [[booking-fees-and-visit-deposits|Frais de réservation et dépôts de visite]]." },
        ],
      },
      {
        id: "who-can-book",
        heading: "Qui peut réserver quoi",
        blocks: [
          { bullets: [
            "Une visite sur un chantier : quiconque peut ouvrir le chantier — y compris l'équipe sur ses propres chantiers — pour soi-même ou non assignée. Y mettre le nom de quelqu'un d'autre exige un propriétaire, un administrateur ou un superviseur.",
            "Un rendez-vous : tous les niveaux peuvent en créer un pour eux-mêmes ou non assigné ; l'assigner à une autre personne exige un propriétaire, un administrateur ou un superviseur.",
            "Un nouveau client depuis le formulaire de rendez-vous : Estimateur et plus. L'équipe lit « No client named … is on file, and your access level doesn't allow you to add one. »",
            "Un rendez-vous qui exige un superviseur ne peut être assigné qu'à un propriétaire, un administrateur ou un superviseur — voir [[supervisor-required-visits|Les visites qui exigent un superviseur]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je réserver deux visites sur un même chantier?", a: "Oui — autant que le chantier en demande. La carte Visites les compte (« 1 of 3 complete ») et chacune a sa date, sa personne et sa liste de vérification." },
      { q: "Réserver une visite avertit-il le client?", a: "Non. Rien n'est envoyé quand une visite est réservée. Le client a de vos nouvelles quand l'équipe appuie sur En route, et l'une comme l'autre peut recevoir un texto de rappel si les rappels sont activés. La déplacer ou l'annuler plus tard propose bien d'envoyer un courriel au client." },
      { q: "Pourquoi la visite n'a-t-elle pas de durée?", a: "Une visite a un début et pas de fin. Seule une réservation faite par la page de rendez-vous porte une heure de fin, et c'est pourquoi le verdict de trajet entre deux arrêts, sur le calendrier, n'est donné qu'après une réservation." },
    ],
  },

  "arrival-windows-and-travel-buffer": {
    title: "Fenêtres d'arrivée et marge de déplacement",
    summary:
      "Trois réglages de la Page de rendez-vous qui décident des heures qu'un client peut réserver et de ce qu'on lui dit : la vérification de trajet, la marge entre les chantiers et la fenêtre d'arrivée.",
    updated: "2026-09-12",
    intro: [
      "Une page de rendez-vous qui vend 17 h à un bout de la ville et 17 h 30 à l'autre est le pire échec qu'un entrepreneur puisse subir, parce que le client debout dans son entrée à 17 h 45 a déjà décidé de quel genre de boîte vous êtes. Deux des réglages de cet article l'empêchent : la vérification de trajet cache les heures que vous ne pouvez pas atteindre, et la marge ajoute les minutes que le trajet ne comprend pas.",
      "Le troisième ne change que ce qu'on dit au client. Une heure exacte est une promesse que la route brise ; une fenêtre — « entre 1:45 et 2:15 PM » — en est une que vous pouvez tenir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les trois vivent sous **Paramètres → Page de rendez-vous**, et les trois ne s'appliquent qu'aux visites chez le client — ils sont entièrement cachés quand **Se rendre chez eux** ne fait pas partie de vos modes de rencontre. Ils agissent sur la page de rendez-vous publique, la confirmation du client et le lien de gestion de visite du client. Votre propre calendrier garde toujours l'heure exacte." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Sous **Combien de temps dure une visite?** se trouvent **Comment les clients peuvent-ils vous rencontrer?** (**Se rendre chez eux**, **Appel téléphonique**, **Appel vidéo**), puis **N'offrez pas d'heures où vous ne pouvez pas vous rendre** avec son interrupteur, **Temps supplémentaire entre les chantiers** (**Aucun**, **10 min** à **60 min**), **Que promettez-vous au client?** (**Heure exacte**, **± 15 min**, **± 30 min**, **± 60 min**) avec un aperçu d'une ligne, et la durée de visite par défaut." },
          { figure: "live:app-settings-booking-page", caption: "Paramètres → Page de rendez-vous — les modes de rencontre, l'interrupteur de trajet, les puces de marge et les puces de fenêtre d'arrivée avec leur aperçu." },
        ],
      },
      {
        id: "travel-check",
        heading: "La vérification de trajet",
        blocks: [
          { p: "Avec **N'offrez pas d'heures où vous ne pouvez pas vous rendre** activé, un client qui tape une adresse ne voit que les plages que vous pourriez atteindre depuis votre rendez-vous précédent : la fin du rendez-vous précédent, plus le trajet, plus la marge, doivent tenir avant le début de la plage. Le trajet, c'est le temps de conduite de Google quand FieldQuo a les coordonnées des deux bouts et une clé, et une estimation à vol d'oiseau sinon." },
          { steps: [
            "Ouvrez **Paramètres → Page de rendez-vous** et assurez-vous que **Se rendre chez eux** est sélectionné.",
            "Activez **N'offrez pas d'heures où vous ne pouvez pas vous rendre**. Il est activé tant que vous ne l'avez pas éteint.",
            "Choisissez une puce sous **Temps supplémentaire entre les chantiers** si le trajet seul ne suffit jamais.",
          ] },
          { note: "La vérification refuse de deviner. Quand elle ne connaît pas le trajet — pas de coordonnées à un bout, le service de cartes en panne — elle ne cache rien plutôt que d'inventer un temps de route, parce qu'une plage disparue en silence est pire qu'une plage qui demande un appel. Éteinte, chaque plage libre est offerte." },
        ],
      },
      {
        id: "the-buffer",
        heading: "Le temps supplémentaire entre les chantiers",
        blocks: [
          { p: "La marge s'ajoute au trajet — stationnement, déchargement, rédaction du dernier chantier. Elle commence à **Aucun**, parce qu'un chiffre deviné à votre place retire des plages réservables que vous n'avez jamais accepté d'abandonner. Elle n'existe que tant que la vérification de trajet est activée ; éteignez-la et les puces de marge disparaissent avec elle." },
        ],
      },
      {
        id: "the-arrival-window",
        heading: "La fenêtre d'arrivée",
        blocks: [
          { p: "Sous **Que promettez-vous au client?**, **Heure exacte** lui dit « 2:00 PM » ; les puces ± l'élargissent de chaque côté. La fenêtre est plafonnée à deux heures au total, et l'aperçu sous les puces montre la phrase exacte que le client lirait." },
          { table: {
            head: ["Puce", "Ce qu'on dit au client pour une plage à 2:00 PM"],
            rows: [
              ["Heure exacte", "On leur dira 2:00 PM."],
              ["± 15 min", "entre 1:45 et 2:15 PM"],
              ["± 30 min", "entre 1:30 et 2:30 PM"],
              ["± 60 min", "entre 1:00 et 3:00 PM"],
            ],
          } },
          { warning: "Seul le client voit la fenêtre. Le calendrier de l'équipe, l'horaire de l'équipe et la copie du bureau de chaque courriel gardent l'heure exacte — un estimateur à qui on dit « entre 1:45 et 2:15 » ne peut pas planifier sa journée. La fenêtre ne s'applique jamais à un appel téléphonique ou vidéo." },
        ],
      },
      {
        id: "where-it-shows",
        heading: "Où chaque réglage se voit",
        blocks: [
          { bullets: [
            "La vérification de trajet et la marge : les plages offertes sur votre page de rendez-vous, et les plages offertes quand un client déplace une visite avec son propre lien.",
            "La fenêtre d'arrivée : le courriel de confirmation de réservation du client, la page de gestion de visite du client, et la copie du client du courriel « votre visite a été déplacée ».",
            "Pas dans le texto de rappel de rendez-vous, qui donne l'heure exacte.",
            "Pas sur le calendrier, la page du chantier ni l'horaire de l'équipe.",
          ] },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "L'écran Page de rendez-vous s'ouvre pour le propriétaire, les administrateurs et les superviseurs — les profils Répartiteur et Gestionnaire. L'équipe et les estimateurs ne le voient pas ; leurs propres heures réservables sont sous **Disponibilités**, qui reste visible pour tous. Voir [[working-hours-and-bookable-hours|Heures de travail et heures réservables]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une plage que je sais libre n'est-elle pas offerte?", a: "Habituellement la vérification de trajet : depuis la fin du rendez-vous précédent, le trajet plus la marge ne tiennent pas avant cette plage. Soit le chantier d'avant finit tard au calendrier, soit la marge est généreuse. Éteindre la vérification montre chaque plage libre." },
      { q: "La fenêtre change-t-elle mon calendrier?", a: "Non. Votre calendrier garde l'heure exacte ; seules la confirmation et la page de gestion du client montrent la fenêtre." },
      { q: "Le temps de route est-il exact?", a: "Avec des coordonnées aux deux bouts et Google disponible, c'est le temps de conduite de Google. Sinon, c'est une estimation à vol d'oiseau avec un facteur de route, et FieldQuo dit « environ » quand c'est tout ce qu'il a." },
    ],
  },

  "appointment-reminders": {
    title: "Rappels de rendez-vous",
    summary:
      "Un texto au client 2, 24 ou 48 heures avant un rendez-vous ou une visite de chantier : comment l'activer, ce qu'il dit, quelles entrées en reçoivent un, et ce que ça coûte.",
    updated: "2026-09-12",
    intro: [
      "Moins de portes closes : avec les rappels activés, chaque client qui a un numéro de cellulaire reçoit un texto avant son rendez-vous ou sa visite de chantier, dans sa langue, qui commence par le nom de votre entreprise. C'est désactivé tant qu'un propriétaire ou un administrateur ne l'active pas; les textos eux-mêmes sont inclus dans votre forfait, rien n'est facturé par message.",
      "Les rappels partent par texto seulement. Il n'y a pas de rappel par courriel.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le réglage est un seul choix sous **Paramètres → Notifications** : **Désactivé**, **2 heures avant**, **24 heures avant** ou **48 heures avant**. FieldQuo vérifie chaque heure, si bien qu'un rappel part dans l'heure qui suit l'atteinte de son délai — un rappel de 24 heures pour un rendez-vous le mardi à 14 h part le lundi entre 14 h et 15 h." },
          { note: "Les rappels de rendez-vous sont marqués partiels dans la liste des fonctions de FieldQuo : texto seulement, pas de rappel par courriel. La formulation se modifie sous **Paramètres → Messages aux clients**, à côté du texto « En route »." },
        ],
      },
      {
        id: "turn-them-on",
        heading: "Comment les activer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Notifications**.",
            "Trouvez la carte **Rappels de rendez-vous** — « Envoyez au client un texto de rappel avant son rendez-vous ou sa visite de chantier. Envoyé au nom de votre entreprise; le client peut répondre STOP pour se désabonner. »",
            "Appuyez sur **2 heures avant**, **24 heures avant** ou **48 heures avant**. Ça s'enregistre au moment où vous appuyez.",
            "Pour arrêter, appuyez sur **Désactivé**. Les rappels déjà envoyés ne sont pas touchés ; plus aucun ne part ensuite.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Paramètres → Notifications — la carte Rappels de rendez-vous avec Désactivé, 2, 24 et 48 heures avant." },
        ],
      },
      {
        id: "when-it-goes",
        heading: "Quand un rappel part, et quand il ne part pas",
        blocks: [
          { p: "Chaque rendez-vous et chaque visite de chantier est considéré une fois, et un texto ne part que si toutes les conditions suivantes sont vraies :" },
          { bullets: [
            "C'est un **rendez-vous** au statut **Planifié** — créé avec **Nouveau rendez-vous**, issu d'une réservation sur votre page de rendez-vous, ou réservé par le réceptionniste IA — ou une **visite de chantier** sur un chantier non archivé. Une entrée **Superviseur requis**, terminée ou annulée n'en reçoit pas.",
            "Il tombe dans les sept prochains jours et son délai est atteint.",
            "Le client a un numéro de téléphone auquel FieldQuo peut texter.",
            "Le client ne s'est pas désabonné des textos ni des appels — voir [[client-consent-and-unsubscribes|Consentement des clients et désabonnements]].",
            "Aucun rappel n'a encore été envoyé pour cette entrée. Jamais plus d'un par rendez-vous ou visite, même si vous changez le délai ou si l'entrée est déplacée.",
          ] },
        ],
      },
      {
        id: "what-it-says",
        heading: "Ce qu'il dit",
        blocks: [
          { p: "La formulation intégrée est « Northside Painting : Rappel — votre rendez-vous est mar. 12 août, 14 h 00 au 123 Oak St. Répondez STOP pour ne plus recevoir. », avec l'heure dans la langue du client et le fuseau horaire de votre entreprise, et le lieu seulement quand le rendez-vous en a un. Elle existe en huit langues ; un client lit celle que dit sa fiche, ou la langue par défaut de votre entreprise." },
          { tip: "Personnalisez-la à votre image sous **Paramètres → Messages aux clients**, avec les champs **{company}**, **{when}** et **{location}**. Votre formulation va aux clients qui lisent la langue de votre entreprise ; les autres reçoivent la formulation intégrée dans la leur. Voir [[the-on-my-way-text|Le texto « En route »]] pour le fonctionnement de cet éditeur." },
        ],
      },
      {
        id: "which-appointments",
        heading: "Quelles entrées reçoivent un rappel",
        blocks: [
          { p: "Les rendez-vous et les visites de chantier. Une **Visite de chantier** planifiée sur un chantier reçoit le même texto au même délai, avec l'adresse du chantier (ou celle du client) comme lieu; le toucher **En route** de l'équipe est un second avertissement, au moment du départ. Une **Réservation client** qui n'est pas encore devenue un rendez-vous n'en déclenche pas non plus — elle en devient un dès qu'elle est confirmée et, s'il y a des frais de visite, payée." },
          { warning: "Les rappels sont par entreprise, pas par personne : le délai s'applique à chaque rendez-vous et à chaque visite planifiés du compte, peu importe à qui ils sont assignés." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "**Notifications** est un écran réservé au propriétaire et aux administrateurs. Un gestionnaire ou un répartiteur ne le voit pas, et le serveur refuse le changement avec « Only owners and admins can change reminder settings. »" },
        ],
      },
    ],
    faq: [
      { q: "Combien coûte un rappel?", a: "Rien par message — les rappels sont inclus dans votre forfait, et la carte Notifications le dit. Ils sont désactivés tant que vous n'avez pas choisi de délai, alors rien n'est envoyé à une entreprise qui n'a jamais ouvert le réglage." },
      { q: "Puis-je rappeler par courriel plutôt?", a: "Non. Les rappels sont des textos seulement, pour l'instant." },
      { q: "Le client n'a pas reçu de rappel.", a: "Vérifiez que l'entrée est Planifiée (pas Superviseur requis, terminée ou annulée), que le client a un numéro de téléphone, qu'il ne s'est pas désabonné, et que le rendez-vous était encore à venir au passage horaire — un rendez-vous déjà à l'intérieur de son délai est texté au passage suivant, un rendez-vous passé ne l'est pas." },
    ],
  },

  "the-on-my-way-text": {
    title: "Le texto « En route »",
    summary:
      "Le texto que reçoit un client quand l'équipe appuie sur En route sur une visite : comment il part, ce qu'il dit, comment changer la formulation, et qui peut le faire.",
    updated: "2026-09-12",
    intro: [
      "Au moment où un membre de l'équipe se met en route, le téléphone du client vibre : « Northside Painting : Dave est en route, arrivée dans 20 min. Pour reporter, appelez le 555-0100. » Il part d'un seul toucher sur la visite, il porte le nom de votre entreprise, et c'est le seul texto automatique qu'une visite de chantier envoie.",
      "Avec le rappel de rendez-vous, c'est l'un des deux textos que vos clients reçoivent de FieldQuo, et les deux se modifient sur le même écran.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le texto est l'effet secondaire d'un changement de statut. Sur la page du chantier, chaque visite a un bouton **En route** ; l'appuyer passe la visite à **En route**, note où était le téléphone, et texte le client s'il a un numéro de cellulaire et ne s'est pas désabonné. Le statut s'enregistre que le texto puisse être livré ou non — une panne de messagerie ne bloque jamais l'équipe." },
        ],
      },
      {
        id: "send-it",
        heading: "Comment l'envoyer",
        blocks: [
          { steps: [
            "Ouvrez le chantier sur votre téléphone et trouvez la visite du jour dans la carte **Visites**.",
            "Lisez la ligne sous les boutons. Elle dit « Texts your “on my way” wording to 514-555-0123 », ou que le numéro du client est masqué par votre niveau d'accès (ça part quand même), ou « No mobile on file for this client, so nothing will be sent — the visit just moves. »",
            "Appuyez sur **En route**. Votre téléphone peut demander votre position une fois ; la refuser n'empêche pas le toucher.",
            "Le badge de la visite indique **En route** et le texto part en arrière-plan. Appuyez sur **Marquer comme terminée** quand vous avez fini.",
          ] },
          { note: "Le bouton dit ce qu'il fait parce que le téléphone d'un inconnu vibre quand vous appuyez. Une visite **En route** offre **Marquer comme terminée** et **Annuler la visite**, pas un second **En route** — un texto par départ." },
        ],
      },
      {
        id: "the-wording",
        heading: "La formulation",
        blocks: [
          { p: "**Paramètres → Messages aux clients** — « Les textos que reçoivent vos clients. Laissez-en un tel quel pour utiliser notre formulation, ou personnalisez-le à votre image. » — a un éditeur par texto qui part vraiment : « En route » et « Rappel de rendez-vous ». Rien d'autre n'est offert, parce qu'aucun autre texto automatique ne part." },
          { figure: "live:app-settings-messages", caption: "Paramètres → Messages aux clients — l'éditeur En route avec ses jetons de champs, l'aperçu « Votre client voit : », Enregistrer et Utiliser le texte par défaut." },
          { steps: [
            "Ouvrez **Paramètres → Messages aux clients** et trouvez « En route ».",
            "Écrivez votre message dans la case, ou appuyez sur un jeton de champ pour l'ajouter à la fin. L'aperçu **Votre client voit :** remplit les champs avec des valeurs d'exemple à mesure que vous tapez.",
            "Appuyez sur **Enregistrer**. Un message avec un champ que FieldQuo ne connaît pas — « Champ inconnu : {price}. Seuls les champs ci-dessus fonctionnent. » — ne peut pas être enregistré.",
            "Pour revenir à la formulation intégrée, appuyez sur **Utiliser le texte par défaut**.",
          ] },
          { table: {
            head: ["Champ", "Ce qu'il devient"],
            rows: [
              ["{company}", "Le nom de votre entreprise."],
              ["{worker}", "Le nom du membre de l'équipe assigné — « Your technician » quand la visite n'est pas assignée."],
              ["{name}", "Le prénom du client."],
              ["{eta}", "L'heure d'arrivée estimée, calculée de l'endroit où était votre téléphone au moment du toucher jusqu'à l'adresse du chantier, avec la même estimation de trajet que la page de rendez-vous. Sans position, ou pour un chantier jamais placé sur la carte, le champ ressort vide et les espaces autour sont nettoyées."],
              ["{phone}", "Le téléphone de votre entreprise, des Paramètres de l'entreprise — le numéro que la formulation intégrée dit au client d'appeler, puisqu'une réponse n'est jamais lue. Vide, et cette phrase disparaît."],
            ],
          } },
        ],
      },
      {
        id: "language",
        heading: "Dans quelle langue le client le reçoit",
        blocks: [
          { p: "Le texto suit la langue du client, comme sa soumission : la langue du client, ou la langue par défaut de votre entreprise. Votre formulation personnalisée va aux clients qui lisent la langue de votre entreprise ; un client d'une autre langue reçoit la formulation intégrée de FieldQuo dans la sienne — les mêmes huit langues que ses documents. Rien n'est traduit automatiquement." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut l'envoyer, qui peut le changer",
        blocks: [
          { bullets: [
            "**En route** apparaît pour la personne à qui la visite est assignée, pour n'importe qui sur une visite non assignée, et pour les personnes dont l'accès Horaire est « Edit everyone's schedule ». Un membre de l'équipe sur la visite d'un autre voit le badge et aucun bouton.",
            "Le numéro du client est masqué pour l'équipe sur la page du chantier, mais le texto y part quand même — la ligne sous le bouton le dit.",
            "**Messages aux clients** se modifie par le propriétaire, les administrateurs et les superviseurs — les profils Répartiteur et Gestionnaire.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Le client peut-il répondre?", a: "Pas utilement : FieldQuo n'a pas de boîte de réception pour les textos des clients, et seul STOP est lu. C'est pourquoi la formulation intégrée dit d'appeler le téléphone de votre entreprise plutôt que d'inviter une réponse — gardez **{phone}** dans la vôtre aussi." },
      { q: "Est-il envoyé depuis mon propre numéro?", a: "Il part du numéro depuis lequel FieldQuo texte et commence par le nom de votre entreprise, pour que le client sache qui s'en vient." },
      { q: "Pourquoi le client a-t-il reçu de l'anglais alors que nous travaillons en français?", a: "La fiche du client dit anglais, ou n'a pas de langue et la langue par défaut de votre entreprise est l'anglais. Réglez la langue sur la fiche du client ; votre formulation française ne s'applique qu'aux clients qui lisent le français." },
    ],
  },

  "clients-rescheduling-and-cancelling": {
    title: "Quand un client déplace ou annule",
    summary:
      "Le lien du courriel de confirmation permet au client de déplacer ou d'annuler sa visite lui-même — dans le préavis que vous fixez, avec les frais de visite remboursés seulement si votre politique le dit — et vous en avertit par courriel.",
    updated: "2026-09-12",
    intro: [
      "Chaque réservation faite par votre page de rendez-vous, ou par le réceptionniste IA, s'accompagne d'un courriel de confirmation qui porte un lien « Change or cancel this visit ». Sur cette page, le client voit quand et où, ce qu'il peut encore faire, et exactement ce qu'il advient des frais de visite qu'il a payés — tout est calculé d'après vos réglages, jamais d'après ce que le navigateur envoie.",
      "Vous fixez deux délais et un interrupteur sous **Paramètres → Page de rendez-vous**, dans **Modifications et annulations**. Cet article explique ce que fait chacun et ce que vous recevez quand un client utilise le lien.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Deux délais, parce qu'ils répondent à deux questions différentes. **Préavis nécessaire pour modifier ou annuler**, c'est le préavis dont l'équipe a besoin : à l'intérieur, la journée est planifiée et le camion est chargé, alors le lien cesse d'offrir des changements et dit au client de vous appeler. **Préavis nécessaire pour être remboursé**, c'est le préavis dont l'argent a besoin, et il peut être plus long — « déplaçable jusqu'à la veille, mais remboursé seulement avec deux jours de préavis ». Les remboursements sont désactivés tant que vous ne les activez pas." },
        ],
      },
      {
        id: "the-link",
        heading: "Le lien du client",
        blocks: [
          { p: "Le lien est créé quand la réservation est confirmée et vit dans le courriel de confirmation et dans chaque courriel « votre visite a été déplacée » qui suit. La page, dans la langue du client, montre **Votre rendez-vous** — **Quand** (avec votre fenêtre d'arrivée, si vous en avez réglé une), **Où**, le dépôt payé — et, sous **Besoin de changer quelque chose ?**, **Changer l'heure** et **Annuler ce rendez-vous**. Quand ni l'un ni l'autre n'est plus permis, elle dit pourquoi : « Northside Painting demande un préavis d'au moins 24 heures; ce rendez-vous ne peut donc plus être modifié ici. Appelez Northside Painting au … — ils peuvent encore le déplacer pour vous. »" },
          { note: "Seules les réservations ont ce lien. Un rendez-vous que vous avez réservé à la main avec **Nouveau rendez-vous** et une visite planifiée sur un chantier n'envoient rien au client à la réservation et n'ont pas de lien libre-service; quand le bureau en déplace ou en annule un, le client peut recevoir un courriel depuis cette boîte de dialogue. Les courriels autour d'une réservation — confirmée, déplacée, annulée — et la page de gestion sont tous dans la langue du client, et une lettre de déplacement ou d'annulation dit si c'était à sa demande ou un changement du bureau." },
        ],
      },
      {
        id: "the-rules",
        heading: "Les trois réglages",
        blocks: [
          { table: {
            head: ["Réglage", "Par défaut", "Ce qu'il change"],
            rows: [
              ["Préavis nécessaire pour modifier ou annuler", "24 heures", "À l'intérieur de ce nombre d'heures avant la visite, le lien du client n'offre plus Changer l'heure ni Annuler ce rendez-vous. Vide ou illisible se lit 24, jamais 0."],
              ["Rembourser les frais de visite en cas d'annulation à temps", "Désactivé", "Activé, des frais de visite payés par FieldQuo sont remboursés automatiquement sur la carte du client quand il annule avec assez de préavis. Désactivé, l'annulation a lieu quand même et l'argent vous reste."],
              ["Préavis nécessaire pour être remboursé", "Le même préavis que ci-dessus", "Affiché seulement quand l'interrupteur de remboursement est activé. Réglez-le plus long que le préavis de modification pour garder une plage où le client peut encore annuler sans récupérer les frais ; la page vous avertit quand il est plus court."],
            ],
          } },
          { p: "Sous les champs, la page imprime votre politique telle que le client la vivra — « Les clients peuvent annuler ou déplacer une visite jusqu'à 24 heures avant son début. Passé ce délai, ils doivent vous téléphoner. » et « Les frais de visite déjà payés ne sont pas remboursés automatiquement — l'annulation a lieu quand même et l'argent vous reste. » — et vous rappelle quand aucun de vos types de rendez-vous ne facture encore de frais." },
        ],
      },
      {
        id: "when-they-cancel",
        heading: "Quand un client annule",
        blocks: [
          { bullets: [
            "La réservation et le rendez-vous qu'elle est devenue passent tous deux à **Annulé**, et la plage redevient libre sur votre page de rendez-vous et votre calendrier.",
            "Si l'interrupteur de remboursement est activé et que le préavis a été respecté, les frais sont remboursés par Stripe sur la carte utilisée ; la page et les courriels le disent. Si les frais n'ont pas été perçus par FieldQuo, rien ne peut être remboursé automatiquement et les deux courriels disent de régler ça ensemble.",
            "Le client reçoit un courriel « Your visit is cancelled ». Vous recevez « A booking was cancelled » à l'adresse courriel de l'entreprise, avec le nom et le courriel du client, l'heure, le lieu, et si les frais ont été remboursés.",
            "La page du client indique ensuite **Rendez-vous annulé** — l'entreprise a été avertie. Une visite annulée ne peut plus être déplacée ; le client réserve de nouveau.",
          ] },
        ],
      },
      {
        id: "when-they-move",
        heading: "Quand un client déplace la visite",
        blocks: [
          { bullets: [
            "**Changer l'heure** montre les mêmes plages que votre page de rendez-vous offrirait — vos disponibilités, la durée du type de rendez-vous, et la vérification de trajet avec sa marge — pour que la nouvelle heure soit une heure que vous pouvez atteindre. Une heure à l'intérieur de votre préavis de modification est refusée : cette heure ne donne pas assez de préavis, choisissez-en une plus tard.",
            "La réservation et son rendez-vous passent à la nouvelle heure. L'ancienne plage redevient libre.",
            "Le courriel du client donne la nouvelle heure (avec votre fenêtre d'arrivée) et l'ancienne ; le vôtre donne la nouvelle heure exacte et l'ancienne, et précise que rien n'a été facturé ni remboursé.",
            "Les frais de visite, s'il y en a, suivent à la nouvelle heure. Un texto de rappel déjà envoyé pour l'ancienne heure n'est pas renvoyé.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Comment régler votre politique",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Page de rendez-vous** et descendez jusqu'à **Modifications et annulations**.",
            "Tapez les heures sous **Préavis nécessaire pour modifier ou annuler**. Ça s'enregistre quand vous quittez le champ.",
            "Activez **Rembourser les frais de visite en cas d'annulation à temps** si vous voulez que les remboursements se fassent d'eux-mêmes ; remplissez ensuite **Préavis nécessaire pour être remboursé**, ou laissez-le vide pour utiliser le même préavis.",
            "Lisez les deux phrases sous la carte — c'est la politique que la page du client appliquera.",
          ] },
          { figure: "live:app-settings-booking-page", caption: "Paramètres → Page de rendez-vous — la carte Modifications et annulations : le préavis en heures, l'interrupteur de remboursement, et la politique imprimée telle que le client la lira." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut la changer",
        blocks: [
          { p: "Le propriétaire, les administrateurs et les superviseurs — les profils Répartiteur et Gestionnaire — ouvrent l'écran Page de rendez-vous ; l'équipe et les estimateurs, non. La politique est celle de l'entreprise, pas de la personne : peu importe à qui la visite est assignée, le même préavis et la même règle de remboursement s'appliquent." },
        ],
      },
    ],
    faq: [
      { q: "Le client dit que le lien ne le laisse pas annuler.", a: "Il est à l'intérieur de votre préavis de modification. La page nomme le préavis et votre numéro de téléphone. Convenez du changement au téléphone, puis appuyez sur **Reporter** ou **Annuler la visite** sur la ligne du rendez-vous dans le calendrier : la réservation derrière se déplace ou s'annule avec lui, et, si la case de courriel reste cochée, le client est prévenu que le bureau a fait le changement." },
      { q: "Pourquoi les frais n'ont-ils pas été remboursés?", a: "Les remboursements sont désactivés tant que vous n'avez pas activé Rembourser les frais de visite en cas d'annulation à temps, et même alors seulement avec le préavis que vous avez fixé. La page du client et les deux courriels disent ce qui s'est appliqué." },
      { q: "Le client reçoit-il le lien si je réserve le rendez-vous moi-même?", a: "Non. Le lien n'existe que pour les réservations faites par la page de rendez-vous ou par le réceptionniste IA. Un rendez-vous que vous créez depuis le calendrier n'envoie rien au client." },
    ],
  },
};
