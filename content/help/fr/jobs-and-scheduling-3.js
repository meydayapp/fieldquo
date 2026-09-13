// content/help/fr/jobs-and-scheduling-3.js
//
// Partie 3 de la catégorie « jobs-and-scheduling » en français (voir le
// composeur, jobs-and-scheduling.js). Slugs de cette partie (lib/help/tree.js) :
// timesheets-and-approving-hours, time-off-requests, safety-incidents,
// job-costing, materials-on-a-job, cancel-or-archive-a-job,
// when-a-job-is-completed, a-chat-room-for-every-job,
// supervisor-required-visits.
//
// Même structure que l'anglais, section pour section, bloc pour bloc. Les
// mots à l'écran sont les chaînes du bloc `fr` de app/i18n/appMessages.js;
// là où un écran affiche encore une étiquette anglaise codée en dur, elle
// est citée telle quelle. Les noms des niveaux d'accès (Crew, Estimator,
// Dispatcher, Manager) et les libellés de la grille de permissions sont en
// anglais sur tous les écrans, et donc ici aussi.
export const ARTICLES = {
  "timesheets-and-approving-hours": {
    title: "Feuilles de temps : réviser et approuver les heures",
    summary:
      "L'écran où le bureau révise chaque pointage, voit où était le téléphone à ce moment-là, approuve les heures qu'une paie peut utiliser et enregistre un pointage oublié.",
    updated: "2026-09-12",
    intro: [
      "L'équipe pointe l'entrée et la sortie sur la **Pointeuse**; le bureau révise le résultat sur **Feuilles de temps**. Rien n'atteint une paie tant que quelqu'un n'a pas appuyé sur **Approuver**, et rien sur cet écran n'est caché à la personne qui a fait les heures — l'entrée qu'elle voit sur son téléphone est la ligne que vous voyez ici.",
      "Cet article décrit ce que montre chaque ligne, ce que les puces de position veulent dire et ne veulent pas dire, comment ajouter un pointage oublié, et qui a le droit d'approuver, de modifier ou de supprimer une entrée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Feuilles de temps se trouve dans la barre latérale sous **Personnel**, à côté de **Pointeuse** et **Congés**. L'en-tête dit **Feuilles de temps — Enregistrez, révisez et approuvez les heures.** En dessous, une ligne par pointage, du plus récent au plus ancien, pour toute l'entreprise — pas une vue par semaine, et pas de filtre par personne." },
          { p: "Une entrée est en attente — « pending » à l'écran — dès que la sortie est pointée, jusqu'à ce que quelqu'un l'approuve; une ligne encore en service affiche **En cours** au lieu d'un nombre d'heures. Seules les heures approuvées sont comptées par [[payroll-runs|une paie]] et par [[job-costing|le coût de revient du chantier]]; les heures en attente sont indiquées à côté comme non comptées, jamais ajoutées en silence." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Ajouter une entrée**, en haut à droite — ouvre le formulaire **Nouvelle entrée de temps**. Il n'apparaît qu'une fois qu'au moins un intervenant existe; sinon la page dit **Ajoutez d'abord un intervenant sous Intervenants, puis enregistrez ses heures ici.**",
            "Chaque ligne : le nom de l'intervenant, la date, puis soit les heures (**7.5h**), soit **En cours**.",
            "Deux puces sous le nom : **Entrée · Sur place**, **Entrée · à 2,1 km** ou **Entrée · —**, et la même chose pour **Sortie** une fois la sortie pointée.",
            "À droite : **Pointer la sortie** sur une ligne encore ouverte, **Approuver** sur une ligne en attente avec des heures, le mot de statut sur tout le reste, et un ✕ pour supprimer une ligne pas encore approuvée.",
            "Une ligne approuvée par la personne même qui a fait les heures porte **· auto-approuvé** en ambre.",
            "La légende en bas : **La position n'est saisie qu'au moment où ils appuient sur Pointer l'entrée ou la sortie, avec leur permission. Rien n'est suivi entre-temps. Un drapeau est une question pour vous, pas un verdict.**",
          ] },
          { figure: "harness:timesheets", caption: "Feuilles de temps — une ligne par pointage, les puces Entrée et Sortie, un bouton Approuver sur les lignes en attente, et la légende de position en dessous." },
        ],
      },
      {
        id: "approve-hours",
        heading: "Comment approuver des heures",
        blocks: [
          { steps: [
            "Ouvrez **Feuilles de temps** depuis la barre latérale.",
            "Lisez la ligne : la date, les heures et les deux puces. Une puce ambre veut dire que le pointage a eu lieu à plus de 250 m de l'adresse du chantier — regardez, puis décidez.",
            "Appuyez sur **Approuver**. La ligne passe à « approved » et les heures deviennent disponibles pour la prochaine paie et pour le coût du chantier.",
            "Une ligne encore **En cours** ne peut pas être approuvée. Appuyez d'abord sur **Pointer la sortie** (l'heure de fin est maintenant), ou attendez que la personne pointe elle-même sa sortie.",
          ] },
          { note: "Approuver ses propres heures est permis — un travailleur autonome n'a personne d'autre à qui demander — mais c'est nommé : la ligne dit **· auto-approuvé**, la paie le dit aussi, et le [[the-activity-log|journal d'activité]] l'enregistre comme une action distincte." },
          { warning: "Une entrée approuvée est fermée. Seuls un propriétaire, un administrateur, un Dispatcher ou un Manager peuvent la modifier ou la rouvrir, parce que ces heures sont peut-être déjà sur un bulletin de paie. Un équipier qui corrige ses propres heures — la sortie oubliée est le cas classique — renvoie l'entrée à « pending » pour qu'elle soit regardée de nouveau." },
        ],
      },
      {
        id: "add-an-entry",
        heading: "Comment enregistrer à la main un pointage oublié",
        blocks: [
          { steps: [
            "Appuyez sur **Ajouter une entrée**. Le formulaire **Nouvelle entrée de temps** s'ouvre.",
            "Choisissez l'**Intervenant**, la **Date** (aujourd'hui est prérempli), l'heure de **Début** et, si le quart est terminé, l'heure de **Fin (facultatif)**.",
            "Appuyez sur **Enregistrer**. Les heures sont calculées sur le serveur dans le fuseau horaire de votre entreprise, donc une entrée 9 h–17 h fait 8 heures, où que se trouve la personne qui l'enregistre.",
          ] },
          { p: "Laissez **Fin (facultatif)** vide et l'entrée reste **En cours** jusqu'à ce que quelqu'un appuie sur **Pointer la sortie**. Une entrée manuelle n'a pas de puces de position à montrer — personne n'a touché un téléphone — alors les deux puces affichent **—**." },
        ],
      },
      {
        id: "the-position-chips",
        heading: "Ce que veulent dire les puces de position",
        blocks: [
          { table: {
            head: ["Puce", "Ce que ça veut dire"],
            rows: [
              ["**Entrée · Sur place**", "Le téléphone a répondu au moment du pointage et se trouvait à moins de 250 m de l'adresse géolocalisée du chantier."],
              ["**Entrée · à 2,1 km**", "Le téléphone a répondu et se trouvait à plus de 250 m de l'adresse. En ambre, parce que c'est une question — la personne s'est peut-être stationnée plus loin dans la rue, ou n'était peut-être pas là."],
              ["**Entrée · —**", "Aucune affirmation possible : le téléphone n'a pas répondu, le chantier n'a pas d'adresse localisable sur une carte, l'entrée a été saisie à la main, ou la lecture était trop imprécise pour être fiable (un cercle de précision plus large que la zone)."],
            ],
          } },
          { p: "La zone de 250 m est fixe; ce n'est pas un réglage. La position est demandée une fois par pointage et seulement avec la permission de la personne; FieldQuo n'enregistre jamais un trajet, une trace ni une position entre deux pointages, et ne place jamais personne sur une carte — la feuille de temps montre la distance au chantier et rien d'autre. La puce ne désactive jamais **Approuver** — la décision reste la vôtre." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La page s'ouvre pour quiconque peut gérer le personnel — le propriétaire, les administrateurs, et les niveaux **Dispatcher** et **Manager**. La ligne de la barre latérale apparaît au niveau **Time Tracking & Timesheets** « View, record, edit, and delete everyone's », que ces mêmes préréglages détiennent. **Crew** et **Estimator** sont à « View, record, and edit their own » : ils ne voient pas cette ligne, et leurs propres entrées se trouvent sur la [[the-time-clock|Pointeuse]]." },
          { bullets: [
            "**Approuver** : propriétaire, administrateur, Dispatcher, Manager.",
            "**Pointer la sortie** de quelqu'un d'autre, ou modifier ses heures : le même niveau « everyone's ».",
            "**✕ Supprimer** : le niveau « everyone's », et jamais sur une ligne approuvée — le serveur le refuse, alors le bouton n'est pas affiché. La suppression demande d'abord : **Supprimer cette entrée de temps ?**",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi n'y a-t-il pas de bouton Approuver sur une ligne?", a: "Soit elle est encore En cours (pointez d'abord la sortie), soit elle est déjà approuvée. Une ligne approuvée n'a ni bouton ni ✕." },
      { q: "Une ligne signalée empêche-t-elle la personne d'être payée?", a: "Non. La puce ne change rien par elle-même; les heures atteignent la paie seulement quand vous les approuvez, signalées ou non." },
      { q: "Puis-je voir sur quel chantier les heures ont été faites?", a: "Pas dans cette liste — elle montre l'intervenant, la date et les heures. Le chantier apparaît sur l'entrée de la Pointeuse de la personne et dans le volet de coûts du chantier une fois les heures approuvées." },
      { q: "D'où vient le taux horaire?", a: "De la fiche de l'intervenant sous Paramètres → Travailleurs. Un intervenant sans taux voit quand même ses heures approuvées comptées, mais elles n'ajoutent aucun coût de main-d'œuvre au chantier, et le volet de coûts le dit plutôt que d'afficher un chantier moins cher." },
    ],
  },

  "time-off-requests": {
    title: "Demandes de congé",
    summary:
      "Comment n'importe qui dans l'équipe demande un congé, comment la demande trouve le bon gestionnaire, ce que l'approbation change au calendrier et au solde, et qui peut faire quoi.",
    updated: "2026-09-12",
    intro: [
      "**Congés** est un seul écran pour deux publics. Tout le monde voit ses propres soldes et demandes et peut demander des jours de congé; un gestionnaire a en plus un onglet **Équipe** avec les demandes qui l'attendent, qui est en congé bientôt, et les soldes de tout le monde.",
      "Les soldes viennent des politiques qu'un propriétaire configure sous **Paramètres → Politiques de congés** — voir [[time-off-policies|Politiques de congés]]. Sans politique, il n'y a rien contre quoi faire une demande, et l'écran le dit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'en-tête dit **Congés — Demandez des congés et voyez ce qu'il vous reste.** Pour un gestionnaire, deux boutons à droite passent de **Les miens** à **Équipe**; le bouton **Équipe** porte le nombre de demandes encore en attente." },
          { p: "Une demande a quatre états, affichés en pastille sur sa ligne : **En attente**, **Acceptée**, **Refusée** et **Annulé**. Un congé approuvé est ce que le reste du produit lit : le [[the-scheduler-and-crew-shifts|planificateur]] refuse de placer un quart sur une journée de congé approuvée, et la page de réservation publique cesse d'offrir les plages de cette personne ces jours-là. Une demande en attente ne change ni l'un ni l'autre." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Les miens** — une carte de solde par politique (par exemple **Vacances**, **Maladie**, **Personnel**) avec les jours restants, puis **Accumulé**, **Pris** et, quand quelque chose est en attente, **En attente d'approbation**. Une politique d'indemnité de vacances montre un montant accumulé plutôt que des jours.",
            "**Vos demandes** avec le bouton **Demander un congé**, puis chaque demande : la politique, la pastille, les dates, le nombre de jours, votre note, et **Withdraw** sur une demande que vous pouvez encore retirer.",
            "**Équipe** — **En attente d'approbation** avec **Approuver** et **Refuser** sur chaque demande, **Qui est en congé prochainement**, **Soldes de l'année** en tableau (**Personne**, **Politique**, **Accumulé**, **Pris**, **Restant**), et **Plus tôt**.",
          ] },
          { figure: "harness:time-off", caption: "Congés — les cartes de solde, Vos demandes, et une demande en attente avec son bouton Withdraw." },
        ],
      },
      {
        id: "request-time-off",
        heading: "Comment demander un congé",
        blocks: [
          { steps: [
            "Ouvrez **Congés** et appuyez sur **Demander un congé**.",
            "Choisissez le **Type** — la politique. À côté, le formulaire dit combien de jours il vous reste, ou que le congé non payé n'est pas limité par un solde.",
            "Réglez **Premier jour** et **Dernier jour**. Pour une seule journée, cochez **Demi-journée seulement** pour demander 0,5.",
            "Ajoutez une **Note (facultatif)** — *Ce que votre gestionnaire devrait savoir* — et appuyez sur **Envoyer la demande**.",
          ] },
          { p: "Les jours sont comptés sur vos propres jours de travail (d'après [[working-hours-and-bookable-hours|vos heures de travail]]; du lundi au vendredi si rien n'est réglé), donc une demande du vendredi au lundi compte deux jours, pas quatre. La demande est refusée si elle chevauche une demande déjà en attente ou acceptée, ou si elle exige plus de jours qu'il ne vous en reste une fois les demandes en attente déduites." },
          { note: "Une politique qui n'exige pas d'approbation se réserve d'elle-même : le formulaire dit **Ce type est approuvé automatiquement — l'envoi le réserve.** Sinon, la ligne dit sur qui la demande attend — « Waiting on Marie. »" },
        ],
      },
      {
        id: "where-a-request-goes",
        heading: "Où va une demande",
        blocks: [
          { p: "Chaque travailleur a un champ « Reports to » sous **Paramètres → Travailleurs**. Une demande va d'abord à ce gestionnaire. Si le gestionnaire est lui-même en congé approuvé ce jour-là, elle remonte à son propre gestionnaire, et la ligne le dit — « escalated because Marie is away ». Sans personne de réglé, ou si tout le monde au-dessus est en congé, elle attend un propriétaire ou un administrateur." },
          { p: "Tous ceux qui peuvent gérer le personnel reçoivent une notification « Congé demandé » dans leur fil. Personne ne peut approuver sa propre demande; le serveur répond que votre congé va à votre gestionnaire. Une personne peut approuver les demandes de quiconque se trouve sous elle dans la ligne hiérarchique; un propriétaire, un administrateur, un Dispatcher ou un Manager peut approuver celles de tout le monde." },
        ],
      },
      {
        id: "what-each-action-changes",
        heading: "Ce que change chaque action",
        blocks: [
          { table: {
            head: ["Action", "Ce qui se passe"],
            rows: [
              ["**Approuver**", "Le solde est revérifié à ce moment précis — d'autres demandes ont pu être approuvées entre-temps — puis les jours sont retirés du solde, la pastille passe à **Acceptée**, et les jours vont au calendrier pour la planification et la réservation."],
              ["**Refuser**", "La pastille passe à **Refusée**. Rien n'est retiré du solde."],
              ["**Withdraw**", "Offert au demandeur sur une demande en attente ou acceptée qui n'a pas encore commencé. Une demande acceptée rend ses jours au solde. Une fois le premier jour passé, seul un gestionnaire peut l'annuler."],
            ],
          } },
          { p: "Chaque approbation, refus et annulation est inscrit au [[the-activity-log|journal d'activité]] avec la politique et le nombre de jours." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tous les niveaux d'accès voient **Congés** et l'onglet **Les miens**. L'onglet **Équipe** n'apparaît que si le serveur le permet — le propriétaire, les administrateurs, **Dispatcher** et **Manager**. Une personne qui peut voir les demandes de l'équipe mais n'est dans la ligne hiérarchique de personne et ne peut pas gérer le personnel les voit en lecture seule : **Vous pouvez consulter les demandes, mais pas les approuver.**" },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi ma demande dit-elle qu'elle attend un propriétaire?", a: "Aucun gestionnaire n'est réglé sur votre fiche de travailleur, ou tout le monde au-dessus de vous est en congé aujourd'hui. Un propriétaire ou un administrateur règle « Reports to » sous Paramètres → Travailleurs." },
      { q: "Un gestionnaire peut-il réserver un congé pour quelqu'un d'autre?", a: "Non. Une demande est toujours faite par la personne qui prend le congé; un gestionnaire l'approuve, la refuse ou l'annule." },
      { q: "Une demande en attente bloque-t-elle l'horaire?", a: "Non. Seuls les congés approuvés sont lus par le planificateur et la page de réservation. Une demande à laquelle personne n'a répondu ne change rien." },
    ],
  },

  "safety-incidents": {
    title: "Incidents de sécurité et incidents évités de justesse",
    summary:
      "Un équipier signale une blessure, un incident évité de justesse ou un dommage matériel depuis le chantier en moins d'une minute; un gestionnaire fait le suivi, fixe le statut et note ce qui a été fait.",
    updated: "2026-09-12",
    intro: [
      "**Sécurité** est l'endroit où un incident s'écrit pendant qu'il est encore frais — par la personne qui était là, depuis son téléphone, sans demander la permission à qui que ce soit. L'en-tête dit pourquoi : **Blessures et incidents évités de justesse. Un incident évité de justesse mérite d'être signalé exactement comme une blessure — c'est ainsi qu'on apprend avant que quelqu'un soit blessé.**",
      "Le signalement est ouvert à tous les niveaux d'accès. Lire les rapports de tout le monde et en faire le suivi est un droit distinct, plus élevé, parce qu'un rapport qui nomme un employé blessé est sensible.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran, c'est un bouton **Signaler**, les filtres **Tous / Ouvert / Examiné / Fermé**, et une fiche par incident. Chaque fiche montre le type — **Évité de justesse**, **Blessure**, **Dommage matériel** ou **Autre** — un badge rouge **Travaux arrêtés** quand les travaux ont été arrêtés, quand c'est arrivé, la description, où, sur quel chantier, **Signalé par** qui, la note de signalement s'il y en a une, jusqu'à six photos, et le statut à droite. Quand rien n'a été déposé, la liste dit **Rien de signalé — C'est une bonne chose.**" },
          { figure: "harness:safety", caption: "Sécurité — le bouton Signaler, les filtres de statut, et deux fiches d'incident avec leur volet Suivi." },
        ],
      },
      {
        id: "report-an-incident",
        heading: "Comment signaler un incident",
        blocks: [
          { steps: [
            "Ouvrez **Sécurité** et appuyez sur **Signaler**.",
            "Choisissez **Quel type d'incident** et **Quand c'est arrivé** (maintenant est prérempli).",
            "Écrivez **Ce qui s'est passé** — *Dans vos propres mots — court, c'est bien.* C'est le seul texte obligatoire.",
            "Ajoutez **Où**, et choisissez le **Chantier (optionnel)** concerné, ou laissez **Non lié à un chantier**.",
            "Cochez **Les travaux ont été arrêtés à cause de ça** si c'est le cas, et ajoutez une **Note sur le signalement (optionnel)** pour tout ce qui touche au signalement à une autorité provinciale.",
            "Appuyez sur **Envoyer le rapport**. L'écran propose ensuite **Ajoutez une photo des lieux si vous en avez une — optionnel**; ajoutez-en jusqu'à six et appuyez sur **Terminé**.",
          ] },
          { warning: "Si votre liste de chantiers n'a pas pu être chargée, le formulaire le dit en ambre et le rapport serait consigné sans chantier. Rechargez la page avant de l'envoyer s'il concerne un chantier — personne ne revient corriger ça après coup." },
        ],
      },
      {
        id: "follow-up",
        heading: "Comment un gestionnaire fait le suivi",
        blocks: [
          { p: "Chaque fiche a un volet **Suivi** pour quiconque a le niveau de suivi. Ouvrez-le, fixez le statut — **Ouvert**, **Examiné** ou **Fermé** —, écrivez **Ce qui a été fait à ce sujet**, et appuyez sur **Enregistrer**. FieldQuo note qui a examiné l'incident et quand. Les filtres de statut en haut lisent ce même statut." },
          { p: "La note de signalement est volontairement une note, pas un processus. FieldQuo ne connaît pas les règles ni les délais de signalement de votre province et ne dépose rien auprès d'une autorité pour vous; le champ sert à écrire ce que vous avez décidé." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "Il n'envoie de message à personne quand un rapport est déposé. Le rapport apparaît sur cet écran et dans le [[the-activity-log|journal d'activité]]; si vous voulez qu'un gestionnaire le sache tout de suite, dites-le-lui.",
            "Il n'arrête pas la pointeuse, n'annule pas la visite et ne change pas le statut du chantier quand **Travaux arrêtés** est coché. Le badge consigne le fait; l'horaire, c'est à vous de le changer.",
            "Il ne nomme pas la personne blessée séparément de celle qui signale. Le rapport dit qui l'a déposé; qui a été blessé va dans la description.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "Un registre de sécurité qu'un équipier peut remplir depuis un téléphone, avec le suivi du gestionnaire sur la même fiche, n'apparaît sur la page de tarifs de Jobber, Housecall Pro, ServiceTitan, QuoteIQ ni Projul, à aucun palier — c'est le test qu'appliquent les pages de comparaison de FieldQuo. Les autres outils mettent ça dans une application de sécurité à part; ici, c'est à côté du chantier et de la pointeuse que la même équipe utilise déjà." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { table: {
            head: ["Niveau Safety Incidents", "Ce qu'il permet", "Qui l'a par défaut"],
            rows: [
              ["« Report incidents, and view their own »", "Déposer un rapport; voir les rapports que vous avez déposés.", "Crew, Estimator"],
              ["« View everyone's incidents »", "Voir tous les rapports de l'entreprise et utiliser les filtres de statut.", "Personne par défaut — accordé dans l'éditeur d'accès personnalisé"],
              ["« View everyone's incidents and follow up on them »", "Tout ce qui précède, plus **Suivi**.", "Dispatcher, Manager, les administrateurs, le propriétaire"],
            ],
          } },
          { p: "La ligne de la barre latérale ne disparaît que pour quelqu'un réglé explicitement à « No access ». Le serveur vérifie le même niveau à chaque requête; masquer la ligne n'est donc pas ce qui protège un rapport." },
        ],
      },
    ],
    faq: [
      { q: "Un équipier peut-il voir le rapport d'un collègue?", a: "Pas au niveau par défaut. « Report incidents, and view their own » veut dire les rapports qu'il a déposés, et rien d'autre — même un rapport sur un incident où il était impliqué mais qu'il n'a pas déposé." },
      { q: "Un rapport peut-il être modifié ou supprimé après le dépôt?", a: "Pas supprimé, et la description n'est jamais réécrite. Un gestionnaire peut changer le statut, les notes de suivi, la note de signalement et la mention Travaux arrêtés; ce qui s'est passé reste tel que la personne l'a écrit." },
      { q: "Un incident apparaît-il sur le chantier?", a: "La fiche nomme le chantier, et un chantier peut être choisi au dépôt. La page du chantier elle-même ne liste pas les incidents." },
    ],
  },

  "job-costing": {
    title: "Coût de revient : soumissionné contre réel",
    summary:
      "Ce qu'un chantier a réellement coûté — heures approuvées, reçus, sous-traitants, frais généraux — à côté de ce que vous aviez soumissionné, et la clôture qui demande si vos taux doivent changer.",
    updated: "2026-09-12",
    intro: [
      "Une soumission porte un coût estimé : matériaux, heures de main-d'œuvre, une part de frais généraux, une marge visée (voir [[cost-and-margin-on-a-quote|Coût et marge sur une soumission]]). Puis le chantier a lieu. Le coût de revient, c'est l'autre moitié — ce que ça a vraiment coûté —, affichée sur la page du chantier sous **Ce que ce projet a coûté**, et comparée ligne par ligne à l'estimation quand le chantier est terminé.",
      "Rien là-dedans n'est deviné. C'est la somme de choses qui ont été enregistrées : des heures que quelqu'un a approuvées, des dépenses que quelqu'un a rattachées, le prix convenu avec un sous-traitant, les frais généraux que vous avez indiqués à FieldQuo. Quand un chiffre manque, le volet le dit plutôt que d'afficher un chantier moins cher.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le volet n'apparaît sur la page du chantier qu'une fois quelque chose enregistré contre le chantier, et seulement pour une personne dont l'interrupteur **Job costing** est activé. Il montre **Dépenses**, **Main-d'œuvre** (avec **{hours} h approuvées sur ce chantier**), **Sous-traitants**, **Frais généraux** et **Coût total**; puis **Soumissionné**, **Avenants acceptés** et **Valeur du contrat** quand il y a des avenants; puis **Reste après les coûts** et **Marge**; et **Dépenses par catégorie** en dessous." },
          { p: "Les mêmes chiffres alimentent les tuiles de profit et de précision des estimations du tableau de bord des indicateurs, et c'est pourquoi cet écran exige lui aussi l'interrupteur." },
        ],
      },
      {
        id: "what-counts-as-cost",
        heading: "Ce qui compte comme coût",
        blocks: [
          { table: {
            head: ["Ligne", "D'où ça vient", "Règle"],
            rows: [
              ["**Main-d'œuvre**", "Les entrées de temps approuvées sur ce chantier × le taux horaire du travailleur (Paramètres → Travailleurs).", "Les heures en attente sont montrées mais pas chiffrées. Un travailleur sans taux ajoute des heures et aucun montant, et le volet dit combien d'heures sont sans taux."],
              ["**Dépenses**", "Les dépenses rattachées à ce chantier dans le [[expense-tracking-and-burn-rate|suivi des dépenses]], par catégorie.", "Les paiements aux sous-traitants sont ignorés ici pour ne pas être comptés deux fois."],
              ["**Sous-traitants**", "Le montant convenu avec chaque sous-traitant du chantier (convenu, terminé ou payé).", "Une offre soumissionnée mais non convenue s'affiche comme **+{amount} soumissionné, non convenu** et reste hors du total."],
              ["**Frais généraux**", "Votre coût par chantier venant de [[overhead-and-your-minimum-price|Paramètres → Frais généraux]].", "Absent, pas zéro, tant que vous n'avez pas rempli cet écran — un chantier ne peut pas être chiffré contre des frais généraux que personne n'a indiqués."],
              ["**Équipement**", "Vos propres actifs consignés sur le chantier.", "Indiqué à titre d'information, et ajouté au total seulement quand aucun frais général n'est réglé — sinon la part de frais généraux porte déjà l'amortissement."],
            ],
          } },
        ],
      },
      {
        id: "the-comparison",
        heading: "Soumissionné contre réel",
        blocks: [
          { p: "**Soumissionné** est le total de la soumission. **Valeur du contrat** y ajoute les avenants acceptés. **Reste après les coûts** est cette valeur du contrat moins le **Coût total**, et **Marge** est la même chose en pourcentage. L'écart par rapport au coût *estimé* est calculé à part : si un des deux côtés manque — pas de soumission chiffrée, ou rien d'enregistré encore —, il n'y a pas de pourcentage, parce qu'un chantier où rien n'est enregistré n'est pas « dans le budget »." },
          { p: "Les entrées de temps pointées pendant les dates du chantier mais jamais rattachées à un chantier sont listées comme non rattachées, avec la note **Rattachez ces entrées à un chantier dans la feuille de temps et elles apparaîtront ici.**" },
          { note: "Les prix cochés sur la liste **Materials to buy** du chantier ne sont pas dans le **Coût total**. Ils vont dans votre historique de prix; un reçu qui doit compter contre ce chantier s'enregistre comme dépense — la clôture propose **Ajouter un matériau ou un reçu à ce travail** exactement pour ça." },
        ],
      },
      {
        id: "the-close-out",
        heading: "La clôture quand un chantier est terminé",
        blocks: [
          { p: "Marquer un chantier **Terminé** ouvre la révision une fois : **Ce travail est terminé — et son coût?** avec un bouton **Réviser les coûts réels**, et une tâche « Review what \"…\" actually cost » due dans trois jours. La révision se lit de haut en bas :" },
          { steps: [
            "**Main-d'œuvre : heures estimées vs approuvées** — les heures de la soumission contre les heures approuvées, avec les heures en attente et sans taux signalées et un lien **Approuver les heures** vers les feuilles de temps.",
            "**Matériaux : ce que l'estimation prévoyait vs ce que vous avez utilisé** — chaque ligne du chantier avec une case pour ce que vous avez réellement utilisé; **Ajouter un matériau ou un reçu à ce travail** enregistre comme dépense un reçu qui n'avait jamais été saisi.",
            "Le verdict — estimé, réel, l'écart, la marge. Si le chantier a dépassé votre seuil, une seule question : **Ce travail a coûté {pct} % de plus que votre soumission. Mettre à jour vos coûts d'après ce qu'il a réellement coûté?** avec **Mettre à jour** et **Laisser tel quel**.",
            "**Le coût est complet** signe la clôture et règle la tâche. **Pas maintenant** laisse tout ouvert.",
          ] },
          { figure: "live:app-settings-material-costs", caption: "Paramètres → Coût des matériaux — le seuil en haut décide quand la clôture demande s'il faut réviser vos coûts." },
          { p: "**Mettre à jour** ouvre des suggestions ligne par ligne, chacune avec un bouton seulement là où un taux enregistré peut bouger. Rien n'est appliqué sans une pression, et la réponse est consignée une fois — un chantier n'est jamais redemandé. Le seuil se trouve sous **Paramètres → Coût des matériaux**, par défaut **15 %**; un chantier qui a coûté moins que prévu ne demande jamais." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'interrupteur **Job costing** est activé pour le propriétaire, les administrateurs et le préréglage **Manager**, et désactivé pour **Dispatcher**, **Estimator** et **Crew**. Sans lui, le volet n'est pas affiché, la route de coûts refuse, et les colonnes de coût de la liste de matériaux sont vidées. L'interrupteur exige « See prices », le suivi du temps, les dépenses et l'accès aux chantiers, et un propriétaire peut l'accorder à n'importe qui dans l'[[the-custom-access-editor|éditeur d'accès personnalisé]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le volet manque-t-il sur un chantier neuf?", a: "Rien n'a encore été enregistré. Il apparaît dès qu'une heure approuvée, une dépense, un sous-traitant ou une utilisation d'équipement existe sur le chantier." },
      { q: "Pourquoi ma marge est-elle plus élevée que prévu?", a: "Cherchez des heures en attente, des travailleurs sans taux et un écran Frais généraux vide. Chacun est nommé sur le volet; chacun rend le réel plus petit que la réalité tant qu'il n'est pas rempli." },
      { q: "Le client voit-il quelque chose de tout ça?", a: "Non. Le coût, la marge et la comparaison sont internes. La soumission et la facture que reçoit le client ne portent que des prix." },
    ],
  },

  "materials-on-a-job": {
    title: "Matériaux sur un chantier",
    summary:
      "La liste d'achats du chantier : quoi acheter, dérivé de la soumission, coché dans la cour, avec le reçu et la quantité réellement utilisée notés sur chaque ligne.",
    updated: "2026-09-12",
    intro: [
      "Chaque page de chantier a un volet **Materials to buy**. Pour les métiers que FieldQuo mesure — toiture, peinture à la surface, revêtement, isolation, pavage, et les métiers à recette comme la refinition d'armoires —, les lignes sont dérivées de la soumission : des carrés en paquets, une surface et une profondeur de base en verges cubes. Pour tout le reste, vous ajoutez des lignes à la main.",
      "La liste est interne. Rien de ce qu'elle contient n'atteint le client; c'est la liste de la cour, pas la soumission.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'en-tête du volet dit **Materials to buy**, suivi de « 3 of 10 bought » dès qu'il y a des lignes. Chaque ligne montre une case à cocher, le nom, la quantité et l'unité, et à droite soit le coût estimé, soit ce que ça a réellement coûté une fois acheté, soit « no price set », soit **—** pour quelqu'un qui ne peut pas voir les coûts. Une ligne achetée est barrée, avec son fournisseur en dessous et, quand c'est noté, la quantité réellement utilisée." },
          { p: "Tant qu'il reste quelque chose à acheter, la liste À faire porte une seule tâche — « Buy materials — 204 Avro Cir · 3 of 10 bought » — qui se met à jour à chaque coche et se ferme d'elle-même quand tout est acheté." },
        ],
      },
      {
        id: "rebuild-from-the-quote",
        heading: "Comment bâtir la liste à partir de la soumission",
        blocks: [
          { steps: [
            "Ouvrez le chantier et trouvez **Materials to buy**.",
            "Appuyez sur **Rebuild from the quote**. FieldQuo lit le relevé ou les réponses d'admission de la soumission avec vos taux tels qu'ils sont aujourd'hui et écrit une ligne par matériau.",
            "Appuyez de nouveau après une révision de la soumission. Les lignes déjà cochées comme achetées et les lignes ajoutées à la main sont conservées; seules les lignes dérivées non achetées sont remplacées.",
          ] },
          { note: "Un chantier sans soumission derrière lui répond qu'il n'y a pas de soumission d'où dériver des matériaux. Ajoutez plutôt des lignes à la main." },
        ],
      },
      {
        id: "tick-a-line",
        heading: "Comment cocher une ligne",
        blocks: [
          { steps: [
            "Touchez la case à côté de la ligne. Elle ouvre « What it cost » (*total on the receipt*), **Combien en avez-vous réellement utilisé?** (prérempli d'après l'estimation) et « Supplier ».",
            "Remplissez ce que vous avez — rien n'est obligatoire — ou appuyez sur « Scan the receipt » pour photographier le reçu de caisse et en faire lire le total, que vous confirmez.",
            "Appuyez sur « Bought ». La ligne est barrée et le compte monte.",
          ] },
          { p: "Un prix saisi à la coche n'est pas de la décoration : il s'écrit dans l'historique de prix des matériaux de votre entreprise, et c'est ainsi que les coûts unitaires que les livres de prix livrent vides se remplissent avec ce que vous avez réellement payé. Décocher une ligne efface son reçu et son fournisseur de la ligne, mais l'entrée d'historique de prix reste — l'achat a bel et bien eu lieu." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["« Add a line »", "Ajoute une ligne saisie à la main (*What else does this job need?*) avec une quantité et une unité. Les lignes ajoutées à la main survivent à une reconstruction et leur quantité reste modifiable."],
              ["« Rebuild from the quote »", "Remplace les lignes dérivées non achetées par une nouvelle dérivation. Ne retire jamais une ligne achetée ou ajoutée à la main."],
              ["« Bought »", "Note qui a acheté et quand; enregistre le coût, le fournisseur et la quantité utilisée; écrit le prix dans votre historique."],
              ["« Remove »", "Supprime la ligne de ce chantier. Son entrée d'historique de prix, s'il y en a une, reste."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Quiconque peut ouvrir le chantier peut lire la liste — un équipier au comptoir du fournisseur en a besoin, et un accès **Crew** voit les chantiers où il est affecté. Cocher, ajouter, reconstruire et retirer exigent « Jobs: View, create, and edit » (**Dispatcher**, **Manager**, les administrateurs, le propriétaire); sans ce niveau, les cases sont affichées mais pas cliquables. Les cases de coût et « Scan the receipt » n'apparaissent qu'avec l'interrupteur **Job costing**; la quantité et le fournisseur sont offerts à tous ceux qui peuvent cocher." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une ligne dit-elle « no price set »?", a: "Le livre de prix n'a pas encore de coût unitaire pour elle. Saisissez ce que vous avez payé en la cochant et ça devient le prix que FieldQuo connaît." },
      { q: "Pourquoi ne puis-je pas changer la quantité d'une ligne dérivée?", a: "Cette quantité est l'estimation, et la clôture compare ce que vous avez utilisé à celle-ci. Notez plutôt le vrai chiffre dans « Combien en avez-vous réellement utilisé? »." },
      { q: "Cocher une ligne crée-t-il une dépense?", a: "Non. Ça enregistre le coût sur la ligne et dans votre historique de prix, et c'est tout. Le volet de coûts du chantier additionne les dépenses, les heures approuvées, les sous-traitants et les frais généraux — pas les prix de cette liste —, alors un reçu qui doit compter contre le chantier s'ajoute comme dépense, ce que la clôture vous propose de faire." },
    ],
  },

  "cancel-or-archive-a-job": {
    title: "Annuler ou archiver un chantier",
    summary:
      "Annulé dit que le travail n'a pas eu lieu; Archivé dit que vous avez fini de le regarder. Ce sont deux faits différents, sur deux commandes différentes, et l'un des deux est réversible.",
    updated: "2026-09-12",
    intro: [
      "Un chantier a un statut — **À planifier**, **Planifié**, **En cours**, **Terminé**, **Annulé** — et, à part, il peut être **Archivé**. Un chantier peut être Terminé *et* archivé; il peut être Annulé et toujours dans la liste. Cet article dit ce que chacun change et lequel utiliser.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Ce qui change", "Annuler", "Archiver"],
            rows: [
              ["Ce que ça dit", "Le travail n'a pas eu lieu, ou n'aura pas lieu.", "Classé. Ne dit rien sur le travail."],
              ["Où", "La liste déroulante de statut sur la page du chantier.", "Le bouton **Archiver** sur la page du chantier."],
              ["La liste des chantiers", "Affiché sous la puce **Annulé**.", "Masqué tant que vous n'appuyez pas sur l'interrupteur **Archivés**."],
              ["Le calendrier", "Ses visites restent tant que vous n'annulez pas chacune d'elles.", "Ses visites quittent le calendrier et les compteurs du tableau de bord avec lui."],
              ["Réversible", "Oui — remettez le statut.", "Oui — **Restaurer**."],
            ],
          } },
        ],
      },
      {
        id: "cancel-a-job",
        heading: "Comment annuler un chantier",
        blocks: [
          { steps: [
            "Ouvrez le chantier et choisissez **Annulé** dans la liste déroulante de statut à côté du titre.",
            "Si le chantier vient d'une soumission, la tâche *planifier ce chantier* de votre liste À faire se ferme d'elle-même.",
            "Appuyez sur **Annuler la visite** sur chacune de ses visites — sur la page du chantier ou au calendrier. Un motif facultatif est demandé et, sauf si vous décochez la case, le client reçoit un courriel dans sa langue disant que le bureau a annulé. Annuler le chantier n'annule pas ses visites; elles restent au calendrier et recevraient encore un texto de rappel.",
          ] },
          { p: "Un chantier annulé garde tout ce qu'il porte — heures, dépenses, photos, notes. Il ne reçoit jamais de demande d'avis, sa récurrence cesse d'avancer, et son salon de clavardage passe sous **Travaux terminés**." },
        ],
      },
      {
        id: "archive-a-job",
        heading: "Comment archiver un chantier",
        blocks: [
          { steps: [
            "Ouvrez le chantier et appuyez sur **Archiver**. Le badge **Archivés** apparaît à côté du statut; le bouton devient **Restaurer**.",
            "Dans la liste des chantiers, appuyez sur l'interrupteur **Archivés** au bout de la rangée de puces pour voir le tiroir. Il ne montre que les chantiers archivés — jamais les deux à la fois.",
            "Appuyez sur **Restaurer** sur le chantier pour le ramener.",
          ] },
          { figure: "live:app-jobs", caption: "Chantiers — les puces de statut, et l'interrupteur Archivés après le séparateur, qui ouvre le tiroir." },
          { p: "Archiver un chantier ferme aussi la tâche *planifier ce chantier* et inscrit « Archived job … » au [[the-activity-log|journal d'activité]]. Son salon de clavardage passe sous **Travaux terminés**." },
        ],
      },
      {
        id: "delete",
        heading: "Quand supprimer plutôt",
        blocks: [
          { p: "**Supprimer** existe pour un chantier créé par erreur et qui ne porte rien. Il demande d'abord — **Supprimer ce projet ?** *Le projet et ses visites sont supprimés définitivement. La soumission et toute facture restent en place. Si des heures y sont déjà associées, annulez-le plutôt.* Un chantier qui porte des entrées de temps ou des tâches est refusé : ce sont des traces de travail, et l'historique s'annule, il ne s'efface pas." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { bullets: [
            "**Annuler** et **Archiver / Restaurer** : « Jobs: View, create, and edit » — Dispatcher, Manager, les administrateurs, le propriétaire.",
            "**Supprimer** : « Jobs: View, create, edit, and delete » — Manager, les administrateurs, le propriétaire.",
            "**Crew** et **Estimator** voient le badge de statut et le badge Archivés, et aucune des trois commandes.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Dois-je annuler ou archiver un chantier qui est tombé à l'eau?", a: "Annulez-le. Annulé est le statut honnête, et le chantier reste visible sous sa propre puce. Archivez-le en plus si vous ne voulez plus jamais le voir." },
      { q: "J'ai archivé un chantier et ses visites ont disparu du calendrier. Est-ce un bogue?", a: "Non — c'est ce que fait l'archivage. Restaurez le chantier et les visites reviennent." },
      { q: "Puis-je archiver un chantier encore en cours?", a: "Oui; archivé n'est pas un statut. Il n'apparaîtra ni dans la liste ni au calendrier tant qu'il n'est pas restauré, alors faites-le seulement quand vous en avez fini." },
    ],
  },

  "when-a-job-is-completed": {
    title: "Quand un chantier est terminé",
    summary:
      "Marquer un chantier Terminé fixe l'heure de fin, crée deux tâches, démarre le compte à rebours de la demande d'avis et de toute règle de relance, et ouvre la révision des coûts — sans créer de facture.",
    updated: "2026-09-12",
    intro: [
      "**Terminé** n'est qu'une option de la liste déroulante de statut sur la page du chantier, mais le moment où on la choisit est celui dont dépend une bonne partie du produit. Cet article liste exactement ce qui se déclenche, ce qui ne se déclenche pas, et ce qui arrive si vous rouvrez le chantier ensuite.",
    ],
    sections: [
      {
        id: "mark-it-completed",
        heading: "Comment marquer un chantier terminé",
        blocks: [
          { steps: [
            "Ouvrez le chantier et choisissez **Terminé** dans la liste déroulante de statut.",
            "FieldQuo fixe l'heure de fin — une fois, au premier passage, et ne la déplace plus jamais.",
            "Si le coût de revient est activé pour vous, la révision des coûts s'ouvre : **Ce travail est terminé — et son coût?** — voir [[job-costing|Coût de revient]].",
          ] },
          { p: "Marquer chaque visite terminée ne termine pas le chantier, et terminer le chantier ne termine pas ses visites. Ce sont des faits distincts sur des fiches distinctes." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Ce qui se passe ensuite",
        blocks: [
          { bullets: [
            "Une tâche « Ask {client} for a review » apparaît dans votre liste À faire, due dans deux jours.",
            "Une tâche « Review what \"{job}\" actually cost » apparaît, due dans trois jours.",
            "Si le chantier vient d'une soumission, la tâche *planifier ce chantier* se ferme.",
            "Le salon de clavardage du chantier est conservé avec son historique et passe sous **Travaux terminés**.",
            "Un chantier récurrent cesse de générer l'occurrence suivante.",
            "Le compte à rebours de la demande d'avis démarre, ainsi que toute règle de relance « Job completed » que vous avez configurée sous [[follow-up-rules|Règles de relance]].",
          ] },
          { figure: "live:app-tasks", caption: "À faire — les tâches que le produit crée pour vous, chacune liée à son chantier et à son client." },
        ],
      },
      {
        id: "the-review-request",
        heading: "La demande d'avis",
        blocks: [
          { p: "Avec **Demander automatiquement** activé sous **Paramètres → Avis** et un lien d'avis enregistré, chaque client ayant une adresse courriel reçoit un seul message après que son chantier est marqué terminé — jamais plus d'un. **Quand demander** règle le délai, de **2 heures plus tard** à **Une semaine plus tard**; par défaut, le lendemain. Voir [[review-requests|Demandes d'avis après un chantier]]." },
          { figure: "live:app-settings-reviews", caption: "Paramètres → Avis — le lien d'avis, Demander automatiquement, et Quand demander." },
          { bullets: [
            "Le courriel porte le nom et l'image de marque de votre entreprise et mène à votre page d'avis.",
            "Un client désabonné est sauté. Un chantier terminé depuis plus de 30 jours n'est jamais sollicité.",
            "Un ancien chantier saisi sous **Anciens chantiers** n'est jamais sollicité — le client a été servi il y a des années, et la page du chantier dit **aucun message n'a été envoyé**.",
          ] },
        ],
      },
      {
        id: "what-does-not-happen",
        heading: "Ce qui ne se passe pas",
        blocks: [
          { bullets: [
            "**Aucune facture n'est créée.** Vous la créez depuis le chantier ou la soumission — voir [[create-an-invoice|Créer une facture]]. Une étape d'échéancier de paiement due « On completion » se base sur la *date de fin* du chantier, pas sur le moment où vous appuyez sur Terminé.",
            "**Le client n'est pas averti** que le chantier est terminé. Le seul message côté client est la demande d'avis, avec son propre délai.",
            "**Les heures ne sont pas approuvées** et **les matériaux ne sont pas chiffrés** tout seuls. La révision des coûts vous demande de faire les deux.",
          ] },
        ],
      },
      {
        id: "reopening",
        heading: "Rouvrir un chantier terminé",
        blocks: [
          { p: "Remettez le statut à **En cours** ou **Planifié** et l'heure de fin est effacée : un chantier qui n'est pas fini n'a pas d'heure de fin. Une demande d'avis pas encore envoyée ne part pas; une demande déjà envoyée n'est pas renvoyée. Les deux tâches ne sont pas créées une seconde fois quand vous le terminez de nouveau." },
        ],
      },
    ],
    faq: [
      { q: "Où est-ce que je règle le délai de la demande d'avis?", a: "Paramètres → Avis, sous Quand demander. Il s'applique à tous les chantiers de l'entreprise." },
      { q: "Le client n'a jamais reçu de demande d'avis. Pourquoi?", a: "L'une de ces raisons : Demander automatiquement est désactivé, aucun lien d'avis n'est enregistré, le client n'a pas d'adresse courriel ou s'est désabonné, le délai n'est pas écoulé, ou le chantier a été terminé il y a plus de 30 jours." },
      { q: "Puis-je envoyer moi-même la demande d'avis, plus tôt?", a: "Pas depuis la page du chantier. La demande part selon le délai de l'entreprise; la tâche « Ask … for a review » est là pour que vous fassiez la demande en personne si vous préférez." },
    ],
  },

  "a-chat-room-for-every-job": {
    title: "Un salon de clavardage pour chaque chantier",
    summary:
      "Chaque chantier planifié a son propre salon dans Clavardage, avec l'équipe affectée à ses visites et le bureau déjà dedans — personne n'ajoute personne à la main.",
    updated: "2026-09-12",
    intro: [
      "**Clavardage**, c'est votre entreprise qui se parle. **#general** réunit toute l'équipe; un **message direct** est entre deux personnes; et chaque chantier au calendrier a son propre salon. Cet article porte sur les salons de chantier : qui s'y trouve, pourquoi, et ce qu'il advient du salon quand le chantier finit. Le reste de l'écran est décrit dans [[team-chat|Clavardage d'équipe]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un salon de chantier porte le nom du chantier et existe pour chaque chantier **Planifié** ou **En cours** qui n'est pas archivé. Ses membres sont calculés, jamais choisis : quiconque est affecté à une des visites du chantier, plus le bureau — le propriétaire, les administrateurs et les gestionnaires, qui sont dans tous les salons de chantier. Retirez quelqu'un des visites et il quitte le salon; remettez-le et il y est de nouveau, ses messages précédents toujours à son nom." },
          { p: "La liste des salons les groupe en **Non lus**, **Entreprise**, **Travaux**, **Messages directs** et **Travaux terminés**. Les salons non lus viennent en premier, parce que la liste existe pour répondre à « qui m'attend »." },
          { figure: "harness:chat", caption: "Clavardage — la liste des salons groupée par type à gauche, un salon de chantier ouvert à droite avec son séparateur des non-lus, une mention, et Ouvrir le travail." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a dans un salon de chantier",
        blocks: [
          { bullets: [
            "L'en-tête : le nom du chantier, **L'équipe affectée à ce travail, et le bureau**, un bouton **Ouvrir le travail**, et **{count} personnes**, qui ouvre la barre **Membres**.",
            "La barre des membres s'explique elle-même : **Toute personne affectée à une visite de ce travail, plus le propriétaire, les admins et les gestionnaires. Pour ajouter quelqu'un, affectez-le à une visite.** Il n'y a aucune commande d'ajout ni de retrait, parce que la barre ne pourrait pas la respecter.",
            "Le fil, avec des séparateurs « Today » et « Yesterday » et une ligne rouge « Unread messages » là où vous en étiez.",
            "Le composeur — **Message à {name}** — avec *Enter to send · Shift+Enter for a new line*. Les messages sont du texte, jusqu'à 4 000 caractères; les photos vont sur le chantier, pas dans le clavardage.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Comment faire entrer quelqu'un dans le salon d'un chantier",
        blocks: [
          { steps: [
            "Ouvrez le chantier et affectez la personne à une visite — voir [[book-a-visit-for-a-client|Réserver une visite pour un client]].",
            "Ouvrez **Clavardage**. Le salon est sous **Travaux**, et la personne y est; la prochaine fois que quelqu'un ouvre le clavardage, la liste des membres est mise à jour.",
            "Tapez **@** dans le composeur pour mentionner quelqu'un du salon — *↑↓ pour choisir · Tab pour insérer · Échap pour fermer*.",
          ] },
          { note: "Un chantier sans visite n'a pas d'équipe et n'a pas de salon. Donnez-lui une visite et le salon apparaît." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Mentions et notifications",
        blocks: [
          { p: "Un message dans un salon de chantier n'avertit personne par lui-même — le compte de non-lus du salon monte, et c'est tout. Une **mention @** envoie une [[push-notifications|notification poussée]] à la personne nommée, sur chaque appareil où elle l'a permise, et la toucher mène droit au salon. Un message direct avertit l'autre personne de la même façon. Le message est enregistré dans tous les cas; une notification qui n'a pas pu être livrée n'est pas un message perdu." },
        ],
      },
      {
        id: "when-the-job-ends",
        heading: "Quand le chantier finit",
        blocks: [
          { p: "Un chantier terminé, annulé ou archivé garde son salon, avec chaque message, sous **Travaux terminés**, et l'en-tête dit **Ce travail est terminé. La salle est conservée pour mémoire.** Aucun nouveau salon n'est créé pour un chantier fini. C'est voulu : « qu'est-ce qu'on avait convenu pour la cuisine des Nguyen » a encore une réponse en mars." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Seulement dans FieldQuo",
        blocks: [
          { p: "Un clavardage d'équipe dont les salons de chantier suivent l'horaire n'apparaît sur la page de tarifs de Jobber, Housecall Pro, ServiceTitan, QuoteIQ ni Projul, à aucun palier — le test qu'appliquent les pages de comparaison de FieldQuo. Rien n'en sort de l'entreprise : le personnel de FieldQuo ne voit jamais le clavardage d'un client, et une session de soutien qui consulte votre compte en lecture seule peut le lire sans y écrire." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tous les niveaux d'accès ont la ligne **Clavardage** et **#general**. Un salon de chantier n'est visible que par ses membres — l'équipe affectée aux visites du chantier, et le propriétaire, les administrateurs, les Dispatchers et les Managers. Un membre **Crew** voit les salons des chantiers où il est affecté, ce qui est la même règle qui décide quels chantiers il voit." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je ajouter l'électricien à un salon de chantier?", a: "Seulement s'il fait partie de votre équipe et qu'il est affecté à une visite. Il n'y a pas d'accès invité, et les sous-traitants ne sont pas membres de votre entreprise." },
      { q: "Pourquoi n'y a-t-il pas de salon pour ce chantier?", a: "Il est À planifier, ou il n'a pas de visite, ou il est archivé. Les salons existent pour les chantiers planifiés et en cours qui ont au moins une visite." },
      { q: "Puis-je supprimer un salon ou un message?", a: "Non. Les salons suivent le chantier, et les messages restent comme trace." },
    ],
  },

  "supervisor-required-visits": {
    title: "Visites qui exigent un superviseur",
    summary:
      "Une case sur un rendez-vous qui dit qu'une personne d'expérience doit être sur place — et qui refuse qu'il soit assigné à quelqu'un d'autre tant que ce n'est pas le cas.",
    updated: "2026-09-12",
    intro: [
      "Certaines visites ne devraient pas être faites par un aide tout seul : la première évaluation d'un gros chantier, la visite finale, un client qui a demandé le patron. Quand vous réservez un rendez-vous dans le **Calendrier**, une seule case — **Exige la présence d'un superviseur sur place** — transforme ça en règle que le produit applique, plutôt qu'en note que quelqu'un lira peut-être.",
      "C'est un réglage sur un rendez-vous réservé depuis le Calendrier. Une visite réservée depuis la page d'un chantier ne porte pas ce drapeau.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un rendez-vous avec le drapeau affiche un badge ambre **Superviseur requis** sur sa ligne, peu importe à qui il est assigné. Tant que personne n'est assigné, son statut est **Superviseur requis** plutôt que **Planifié**, et la puce **Superviseur requis** en haut du Calendrier le compte. Assignez un superviseur et le statut passe à **Planifié** tout seul." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment en réserver un",
        blocks: [
          { steps: [
            "Ouvrez **Calendrier** et appuyez sur **Nouveau rendez-vous**.",
            "Remplissez le client, l'heure et le **Lieu**.",
            "Cochez **Exige la présence d'un superviseur sur place**.",
            "Sous **Assigner à**, choisissez une personne. Quiconque n'est pas superviseur apparaît avec « (not a supervisor) » après son nom, et le serveur le refuse : ce rendez-vous exige qu'un superviseur ou un administrateur soit assigné. Ou laissez **Non assigné** et assignez plus tard.",
          ] },
          { figure: "live:app-appointments", caption: "Calendrier — les puces de statut avec leur compte, la grille du mois, et les lignes de rendez-vous avec la personne assignée." },
        ],
      },
      {
        id: "what-the-flag-changes",
        heading: "Ce que change le drapeau",
        blocks: [
          { table: {
            head: ["Ce qui change", "Rendez-vous ordinaire", "Superviseur requis"],
            rows: [
              ["Qui peut être assigné", "N'importe qui dans l'équipe.", "Seulement le propriétaire, un administrateur, ou quelqu'un au niveau Dispatcher ou Manager."],
              ["Statut tant que non assigné", "**Planifié**", "**Superviseur requis**, en ambre, jusqu'à ce qu'un superviseur soit assigné."],
              ["**Me l'assigner**", "Offert à un équipier sur une ligne non assignée.", "Pas offert — le serveur refuserait la réclamation, alors le bouton n'est pas proposé."],
              ["Rappels de rendez-vous", "Envoyés selon le préavis de l'entreprise.", "Pas envoyés tant que le statut est encore **Superviseur requis** — voir [[appointment-reminders|Rappels de rendez-vous]]."],
              ["Disponibilité sur la page de réservation", "Compté comme du temps réservé.", "Compté comme du temps réservé aussi."],
            ],
          } },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Quiconque peut créer un rendez-vous peut cocher la case. Assigner un rendez-vous à quelqu'un d'autre — avec ou sans drapeau — exige le propriétaire, un administrateur, ou le niveau **Dispatcher** ou **Manager**; un équipier peut créer un rendez-vous non assigné ou se réclamer un rendez-vous ordinaire. La règle de réassignation et la règle du superviseur sont toutes deux revérifiées sur le serveur; l'indication « (not a supervisor) » de la liste déroulante est une courtoisie, pas la frontière." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je régler ça sur une visite de chantier?", a: "Non. La case se trouve sur les rendez-vous réservés depuis le Calendrier. Une visite réservée depuis la page du chantier n'a pas de drapeau de superviseur; assignez la visite à la personne que vous voulez sur place." },
      { q: "Pourquoi le client n'a-t-il pas reçu de rappel?", a: "Les rappels ne partent que pour les rendez-vous au statut Planifié. Un rendez-vous qui attend encore un superviseur reste Superviseur requis tant que personne n'est assigné." },
      { q: "Puis-je retirer le drapeau après coup?", a: "La case est sur le formulaire de réservation; la ligne elle-même n'offre pas d'interrupteur. C'est l'assignation d'un superviseur qui efface le statut ambre." },
    ],
  },
};
