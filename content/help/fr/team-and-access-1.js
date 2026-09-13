// content/help/fr/team-and-access-1.js
//
// Partie 1 de la catégorie « team-and-access » en français (voir le
// composeur, team-and-access.js) : Gérer l'équipe, les invitations, les cinq
// niveaux d'accès, l'éditeur personnalisé, les sièges et la désactivation.
//
// Même structure que l'anglais (mêmes slugs, mêmes sections, mêmes blocs) ;
// les mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js. Les
// noms des niveaux (Crew, Estimator, Dispatcher, Manager, Administrator), des
// domaines et des échelons sont les chaînes anglaises du produit, affichées
// telles quelles dans toutes les langues.
export const ARTICLES = {
  "manage-team": {
    title: "Gérer l'équipe",
    summary:
      "L'écran de l'effectif : qui fait partie de votre équipe, ce que chacun peut voir et faire, le panneau des sièges, les invitations en attente, et les boutons Ajouter un utilisateur, Ajouter un équipier et Ajouter un siège.",
    updated: "2026-09-12",
    intro: [
      "**Gérer l'équipe** est l'écran où vivent les gens de votre entreprise dans FieldQuo. C'est un seul écran, accessible de deux façons — **Votre équipe** dans la barre latérale principale, sous Personnes, et **Paramètres → Gérer l'équipe** sous Équipe et horaires — et il montre chaque personne qui a un identifiant, le niveau d'accès qu'elle détient, et combien de sièges et de places d'équipiers de votre forfait sont utilisés.",
      "Tout ce qui concerne l'accès d'une personne se change ici. Ses heures, son taux horaire et ses congés vivent sur d'autres écrans — Feuilles de temps, Travailleurs, Congés — vers lesquels cette page renvoie.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page a trois parties, de haut en bas : le panneau des sièges, une rangée d'onglets, et l'effectif. Le panneau des sièges compare votre forfait aux personnes qui l'occupent. L'effectif liste chaque membre avec son niveau dans la colonne **Rôle**, sa **Dernière connexion** et une case **Actif**. Une invitation que personne n'a encore acceptée se place au bas de l'effectif avec un badge **Invité** et un bouton **Annuler l'invitation**." },
          { figure: "live:app-settings-team", caption: "Gérer l'équipe sur une entreprise d'une personne — le panneau des sièges (1 / 3 sièges utilisés, 0 / 8 équipiers — inclus gratuitement), les onglets Travailleurs, Feuilles de temps et Paie, et l'effectif avec la ligne du propriétaire." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Ajouter un utilisateur**, en haut à droite, ouvre le formulaire Nouvel utilisateur — voir [[invite-a-team-member|Inviter un membre de l'équipe]].",
            "Le panneau des sièges : les **sièges utilisés** sur ceux que votre forfait comprend, les **équipiers — inclus gratuitement** sur ses places d'équipiers, et une répartition par sorte — **Administrateurs**, **Gestionnaires**, **Répartiteurs**, **Employés**, **Équipiers**, **Accès personnalisé** — qui ne liste que les sortes que vous avez vraiment.",
            "**Ajouter un équipier — gratuit** et **Ajouter un siège**. Les deux ouvrent le même formulaire Nouvel utilisateur ; le premier avec le niveau Crew déjà choisi, le second avec Dispatcher. Quand un plafond est atteint, le bouton se grise avec la raison, et la phrase à côté nomme le prochain forfait qui conviendrait.",
            "**Je travaille seul — aucune équipe pour l'instant.** — affiché seulement tant que vous êtes la seule personne de l'effectif. Cocher la case retire « Invitez votre équipe » de votre liste de configuration, et la case disparaît dès que quelqu'un d'autre est ajouté.",
            "Les onglets **Travailleurs**, **Feuilles de temps** et **Paie**. Travailleurs et Paie n'apparaissent que pour un propriétaire ou un administrateur ; Feuilles de temps pour tous ceux qui peuvent ouvrir cette page.",
            "Les colonnes de l'effectif : **Nom / Courriel**, **Rôle**, **Dernière connexion** (retirée sur les écrans étroits pour que la case Actif reste atteignable) et **Actif**.",
            "**Sur la paie, sans accès** — une section qui apparaît quand une fiche de travailleur existe sans identifiant rattaché : cette personne peut être planifiée et payée, mais ne peut pas se connecter. Gérez-la dans Travailleurs.",
          ] },
        ],
      },
      {
        id: "change-someones-access",
        heading: "Comment changer l'accès de quelqu'un",
        blocks: [
          { steps: [
            "Trouvez la personne dans l'effectif. Son niveau apparaît dans la colonne **Rôle** — sous forme de liste déroulante si vous pouvez le changer, de badge gris si vous ne le pouvez pas.",
            "Choisissez **Crew**, **Estimator**, **Dispatcher**, **Manager** ou **Administrator** dans la liste. Le changement s'applique tout de suite : le palier de la personne et toute sa grille d'autorisations sont remplacés par ceux du niveau, et elle garde le même identifiant.",
            "Choisissez plutôt **Personnalisé…** pour ouvrir l'éditeur et déplacer les réglages un par un — voir [[the-custom-access-editor|L'éditeur d'accès personnalisé]].",
          ] },
          { figure: "harness:team", caption: "Gérer l'équipe dans un atelier de six personnes — 4 / 6 sièges utilisés, 3 / 11 équipiers, une liste de niveaux sur chaque ligne que le propriétaire peut changer, et une invitation en attente avec Annuler l'invitation." },
          { note: "Faire passer quelqu'un de Crew à n'importe quel autre niveau occupe un siège. Si votre forfait n'en a plus de libre, le changement est refusé avec les chiffres de votre forfait et celui qui conviendrait ; passez d'abord au forfait supérieur depuis **Compte et facturation**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["Liste Rôle", "Remplace l'accès de la personne par le niveau choisi, immédiatement. Un badge à la place d'une liste veut dire que vous ne pouvez pas changer cette ligne : c'est la vôtre, c'est celle d'un propriétaire, ou la personne est à votre rang ou au-dessus."],
              ["Case Actif", "Décochée, la personne ne peut plus se connecter à votre entreprise et cesse de compter dans votre forfait ; ses dossiers restent. Propriétaire et administrateur seulement — voir [[deactivate-a-team-member|Désactiver un membre de l'équipe]]."],
              ["Annuler l'invitation", "Vous demande de confirmer, puis rend le lien d'invitation inutilisable et libère la place qu'il retenait. Une fiche de travailleur déjà dans vos livres est conservée."],
              ["Ajouter un équipier — gratuit / Ajouter un siège", "Ouvrent Nouvel utilisateur avec un niveau présélectionné. Le niveau reste modifiable sur le formulaire."],
              ["Je travaille seul — aucune équipe pour l'instant.", "Enregistre que vous travaillez seul et retire l'étape d'invitation de la liste de configuration. Décochez-la le jour où vous embauchez."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs, les Dispatchers et les Managers voient la ligne **Votre équipe** et l'effectif. Les Estimators et les Crew ne la voient pas — la ligne est masquée et la page les refuse. Parmi ceux qui peuvent l'ouvrir, seul un propriétaire ou un administrateur peut changer le niveau d'une personne existante ou décocher **Actif**. Un Dispatcher ou un Manager peut ajouter des gens (Crew ou Estimator seulement) et annuler des invitations, et voit le niveau de chacun comme un badge en lecture seule." },
          { note: "Le compte qui a inscrit l'entreprise est le propriétaire. FieldQuo n'a aucune commande pour transférer la propriété ni pour changer le niveau d'un propriétaire, alors la ligne du propriétaire est toujours un badge — pour tout le monde, autres propriétaires compris — et l'écran le dit au bas de la page : au moins un compte doit toujours avoir un rôle de haut niveau (propriétaire ou administrateur)." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le niveau de quelqu'un est-il un badge gris plutôt qu'une liste ?", a: "Soit vous n'êtes pas propriétaire ou administrateur, soit la personne est à votre rang ou au-dessus. Votre propre ligne est toujours un badge : personne ne change son propre accès, même un propriétaire." },
      { q: "Pourquoi la colonne Rôle dit-elle Personnalisé ?", a: "La grille de la personne ne correspond exactement à aucun préréglage — quelqu'un a déplacé un réglage après avoir choisi un niveau. Ouvrez Personnalisé… pour voir lesquels, ou choisissez un préréglage pour remplacer toute la grille." },
      { q: "Un Manager peut-il ajouter un Administrator ?", a: "Non. Un Manager ou un Dispatcher ne peut ajouter que Crew ou Estimator, avec chaque réglage au plus égal au sien. Seul le propriétaire peut nommer un administrateur." },
    ],
  },

  "invite-a-team-member": {
    title: "Inviter un membre de l'équipe",
    summary:
      "Comment ajouter quelqu'un à votre entreprise depuis le formulaire Nouvel utilisateur, ce que la personne reçoit, combien de temps l'invitation reste valide, et ce qu'une invitation en attente compte.",
    updated: "2026-09-12",
    intro: [
      "Personne ne peut s'ajouter lui-même à votre entreprise. La seule porte d'entrée est une invitation envoyée depuis **Gérer l'équipe** par quelqu'un qui est déjà dans l'équipe et qui a le droit d'inviter. C'est voulu — votre liste de clients et vos prix sont derrière cette porte.",
      "L'invitation emporte tout ce que vous réglez sur le formulaire — niveau, autorisations, téléphone, adresse, coût de main-d'œuvre — de sorte que le compte de la personne est prêt dès qu'elle accepte. Comme le dit le formulaire : tout ce qui suit est enregistré maintenant et appliqué automatiquement dès qu'elle accepte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Ajouter un utilisateur** ouvre **Nouvel utilisateur**, un formulaire en trois cartes : **Renseignements personnels**, **Autorisations** et **Communications**. Seuls **Nom complet** et **Adresse courriel** sont obligatoires. Appuyer sur **Envoyer l'invitation** crée l'invitation, l'envoie par courriel, et place la personne dans l'effectif comme **Invité** jusqu'à ce qu'elle accepte." },
          { bullets: [
            "Regardez d'abord le panneau des sièges. Un accès Crew n'occupe jamais de siège ; tous les autres niveaux en occupent un, et une invitation compte dès son envoi — voir [[seats-and-crew-logins|Sièges et accès d'équipiers]].",
            "Un courriel déjà dans votre équipe, ou qui a déjà une invitation, est refusé : « Someone with that email is already on your team. » / « That email already has an invitation waiting. »",
          ] },
        ],
      },
      {
        id: "send-the-invite",
        heading: "Comment envoyer une invitation",
        blocks: [
          { steps: [
            "Ouvrez **Gérer l'équipe** et appuyez sur **Ajouter un utilisateur** — ou sur **Ajouter un équipier — gratuit** / **Ajouter un siège**, qui ouvrent le même formulaire avec un niveau déjà choisi.",
            "Remplissez **Renseignements personnels** : **Nom complet** et **Adresse courriel** sont obligatoires ; **Numéro de téléphone mobile**, **Adresse municipale**, **Ville**, **Province**, **Code postal**, **Pays** et **Téléverser une image** sont facultatifs.",
            "**Coût de main-d'œuvre** — le véritable coût horaire de la personne pour l'entreprise (salaire + charges), utilisé pour le calcul des coûts de chantier et jamais montré aux clients. Seul un propriétaire ou un administrateur voit ce champ.",
            "Sous **Autorisations**, choisissez un niveau : **Crew**, **Estimator**, **Dispatcher**, **Manager**, ou **Personnalisé** pour régler chaque curseur vous-même. Un propriétaire peut aussi cocher **Nommer administrateur** — voir [[administrators|Administrateurs]].",
            "Sous **Communications**, choisissez la **Langue de l'invitation** — anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand ou italien. Elle s'applique au courriel d'invitation seulement et ne peut pas être changée une fois envoyée.",
            "Appuyez sur **Envoyer l'invitation**. Vous revenez à Gérer l'équipe, où la personne apparaît comme **Invité** avec son niveau à côté du badge.",
          ] },
          { figure: "create:app-settings-team-create", caption: "Nouvel utilisateur — Renseignements personnels avec le champ Coût de main-d'œuvre, puis Autorisations : Nommer administrateur, les quatre cartes de niveau, Personnalisé, et la grille d'autorisations." },
          { warning: "Si l'invitation a été créée mais que le courriel n'a pas pu partir, le formulaire reste ouvert et le dit, au lieu de revenir à l'effectif. Rien n'est arrivé à la personne. Annulez l'invitation en attente dans Gérer l'équipe et renvoyez-la une fois le courriel rétabli." },
        ],
      },
      {
        id: "what-they-receive",
        heading: "Ce que la personne reçoit",
        blocks: [
          { p: "Un courriel de FieldQuo intitulé « You're invited to join votre entreprise on FieldQuo », dans la langue que vous avez choisie, avec un lien. Le lien ouvre **Joindre votre entreprise**, qui indique le niveau auquel elle a été invitée. Une nouvelle personne tape son nom et crée un mot de passe ; quelqu'un qui a déjà un compte FieldQuo dans une autre entreprise se connecte avec son mot de passe existant et est ajouté à la vôtre." },
          { p: "Le lien est valide **48 heures**. Passé ce délai, il ouvre sur « Cette invitation est expirée » avec une note pour vous en demander une nouvelle — annulez l'ancienne invitation et envoyez-en une autre. Un lien que vous avez annulé ouvre sur « Cette invitation ne peut pas être utilisée ». Il n'y a pas de bouton pour renvoyer ; une nouvelle invitation est le renvoi." },
        ],
      },
      {
        id: "pending-invitations",
        heading: "Les invitations en attente",
        blocks: [
          { bullets: [
            "Une invitation en attente montre le niveau que vous avez choisi à côté du badge **Invité**, pour qu'une invitation Administrator ne soit jamais prise pour une invitation Crew avant d'être acceptée.",
            "Elle compte dans votre forfait dès son envoi — un siège pour tout niveau au-dessus de Crew, une place d'équipier pour Crew.",
            "**Annuler l'invitation** demande « Annuler cette invitation ? » puis rend le lien inutilisable et libère la place. Comme le dit la boîte de dialogue, la fiche employé déjà créée est conservée ; supprimez-la depuis Travailleurs si besoin.",
            "Le niveau d'une invitation en attente ne se modifie pas. Pour le changer, annulez et invitez de nouveau.",
          ] },
        ],
      },
      {
        id: "who-can-invite",
        heading: "Qui peut inviter, et ce qu'il peut accorder",
        blocks: [
          { p: "Les propriétaires, les administrateurs, les Dispatchers et les Managers peuvent inviter. Chacun ne peut accorder qu'un accès inférieur au sien : le propriétaire peut donner n'importe quel niveau, Administrator compris ; un administrateur n'importe quel niveau sauf Administrator ; un Dispatcher ou un Manager seulement **Crew** ou **Estimator**, avec chaque réglage plafonné au sien et aucun interrupteur qu'il ne détient pas lui-même. Le formulaire n'offre que ce qui sera accepté, et le serveur revérifie la même règle à la création de l'invitation." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je renvoyer une invitation ?", a: "Pas directement. Annulez l'invitation en attente et envoyez-en une nouvelle depuis Ajouter un utilisateur ; le nouveau lien est valide 48 heures de plus." },
      { q: "La personne utilise déjà FieldQuo dans une autre entreprise. Peut-elle accepter ?", a: "Oui. La page d'adhésion reconnaît le courriel, la personne se connecte avec son mot de passe existant, et elle est ajoutée à votre entreprise avec le niveau que vous avez choisi." },
      { q: "Pourquoi le champ Coût de main-d'œuvre manque-t-il sur mon formulaire ?", a: "Il n'est montré qu'à un propriétaire ou à un administrateur. Un Manager ou un Dispatcher qui invite quelqu'un ne peut pas fixer un taux horaire ; le champ est masqué plutôt qu'ignoré en silence." },
    ],
  },

  "access-levels-overview": {
    title: "Niveaux d'accès : qui voit quoi",
    summary:
      "Les cinq niveaux d'accès — Crew, Estimator, Dispatcher, Manager, Administrator — de quoi chacun est fait, ce que chacun voit dans le menu, et qui a le droit de les changer.",
    updated: "2026-09-12",
    intro: [
      "Chaque personne de votre équipe a un niveau d'accès, choisi à l'invitation et modifiable ensuite depuis **Gérer l'équipe**. Quatre des niveaux sont des préréglages — une grille remplie de onze domaines et de trois interrupteurs — **Administrator** est tout, et **Personnalisé** est n'importe quelle grille que vous réglez vous-même.",
      "La règle qui rend tout cela sûr : masquer une ligne dans le menu n'est pas la sécurité. Chaque requête que l'application envoie est revérifiée sur le serveur contre la même grille, alors une personne qui tape l'adresse d'une page qu'on ne lui a pas montrée reçoit un refus, pas la page.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Les cinq niveaux",
        blocks: [
          { table: {
            head: ["Niveau", "Pour qui", "Occupe un siège"],
            rows: [
              ["[[role-crew|Crew]]", "Les installateurs et les aides : leur propre horaire, les chantiers où ils sont, leurs heures. Aucun montant, aucun document.", "Non — gratuit"],
              ["[[role-estimator|Estimator]]", "Rédige des soumissions et gère les clients, avec les prix. Ne dirige personne.", "Oui"],
              ["[[role-dispatcher|Dispatcher]]", "Le chef d'équipe : l'horaire et les heures de tout le monde, crée et modifie les documents, ne supprime rien.", "Oui"],
              ["[[role-manager|Manager]]", "Gère le quotidien, suppression comprise, coûts de chantier et encaissement activés. Pas la paie, pas la facturation de l'entreprise.", "Oui"],
              ["[[administrators|Administrator]]", "Tout ce que le propriétaire a, sauf la propriété elle-même. Seul le propriétaire peut l'accorder.", "Oui"],
            ],
          } },
        ],
      },
      {
        id: "levels-and-tiers",
        heading: "Niveaux et paliers",
        blocks: [
          { p: "Chaque carte de niveau porte une petite pastille — **Palier Worker** sur Crew et Estimator, **Palier Manager** sur Dispatcher et Manager. Un palier est le regroupement plus grossier que certaines règles utilisent (qui peut inviter, qui peut voir la facturation) ; le niveau est ce que la personne obtient réellement. Comme le dit l'écran, deux niveaux peuvent partager le même palier, alors le palier seul n'indique pas quel niveau une personne détient. Le badge dans Gérer l'équipe nomme le niveau ; le survoler nomme le palier." },
        ],
      },
      {
        id: "what-a-level-is-made-of",
        heading: "De quoi un niveau est fait",
        blocks: [
          { p: "Onze domaines, chacun une échelle du moins au plus d'accès — **Schedule**, **Time Tracking & Timesheets**, **Payroll & Payslips**, **Notes**, **Expenses**, **Clients and Properties**, **Requests**, **Quotes**, **Jobs**, **Invoices**, **Safety Incidents** — et trois interrupteurs marche/arrêt : **Show Pricing**, **Job Costing**, **Payments**. Un préréglage est un réglage sur chaque échelle. Touchez un seul réglage et la personne devient **Personnalisé** ; voir [[the-custom-access-editor|L'éditeur d'accès personnalisé]] pour chaque échelon." },
        ],
      },
      {
        id: "what-each-level-sees",
        heading: "Ce que chaque niveau voit dans le menu",
        blocks: [
          { table: {
            head: ["Écran", "Crew", "Estimator", "Dispatcher", "Manager"],
            rows: [
              ["Prospects, Soumissions, Factures, Forfaits", "Non", "Oui", "Oui", "Oui"],
              ["Chantiers", "Les siens seulement", "Oui", "Oui", "Oui"],
              ["Clients, Équipement client, Réceptionniste, Analyses", "Non", "Oui", "Oui", "Oui"],
              ["Révisions de devis, Votre équipe, Calendrier de l'équipe, Feuilles de temps, Sous-traitants, Véhicules, Marketing, Créateur, Funnels", "Non", "Non", "Oui", "Oui"],
              ["KPI, Dépenses, Achats", "Non", "Non", "Non", "Oui"],
              ["Forfait, Parrainage, Compte et facturation, Paiements, Paie (réglages), Journal d'activité, Politiques de congés, Notifications", "Non", "Non", "Non", "Non"],
              ["Calendrier, À faire, Clavardage, Pointeuse, Congés, Sécurité, Paie (ses propres fiches de paie), Aide", "Oui", "Oui", "Oui", "Oui"],
            ],
          } },
          { p: "La dernière ligne « Non » est réservée au propriétaire et aux administrateurs. Les administrateurs et le propriétaire voient chaque ligne. Les lignes des Paramètres suivent le même motif : **Langue**, **Disponibilités** et **Nouveautés** pour tout le monde ; la liste de prix seulement avec Show Pricing ; **Frais généraux** et **Coût des matériaux** seulement avec Job Costing ; **Suivi des dépenses** seulement pour quelqu'un qui peut voir les dépenses de tout le monde." },
        ],
      },
      {
        id: "who-can-change-access",
        heading: "Qui peut changer l'accès",
        blocks: [
          { bullets: [
            "Seul un propriétaire ou un administrateur change le niveau d'une personne existante, nomme un administrateur ou désactive quelqu'un. Un Dispatcher ou un Manager peut inviter et planifier des gens, mais pas toucher à l'accès établi d'un collègue.",
            "Chacun n'accorde que ce qui est en dessous de lui : le propriétaire n'importe quel niveau ; un administrateur Manager et en dessous ; un Dispatcher ou un Manager Crew ou Estimator à l'invitation, avec chaque réglage plafonné au sien.",
            "Personne ne change son propre accès, et personne ne change le niveau d'un propriétaire — il n'existe de commande ni pour l'un ni pour l'autre.",
            "Le dernier propriétaire ne peut être ni rétrogradé ni désactivé, et le dernier propriétaire ou administrateur actif ne peut pas être désactivé. Quelqu'un doit toujours pouvoir gérer le compte.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Qu'est-ce que Personnalisé ?", a: "N'importe quelle grille qui ne correspond exactement à aucun préréglage. Choisir un préréglage remplace toute la grille ; déplacer un réglage ensuite rend la personne Personnalisé. Crew est l'exception — ses réglages sont fixes et ne bougent pas." },
      { q: "Si une ligne est masquée, la personne peut-elle quand même atteindre les données autrement ?", a: "Non. La ligne est masquée parce que la page derrière la refuserait ; la même grille est vérifiée sur le serveur pour chaque requête." },
      { q: "Puis-je donner tout à quelqu'un, sauf l'argent ?", a: "Manager est ce niveau : soumissions, chantiers, clients, horaires et dépenses, suppression comprise, mais pas la paie ni le forfait, la carte ou l'abonnement de l'entreprise." },
    ],
  },

  "role-crew": {
    title: "Le niveau Crew",
    summary:
      "Ce qu'un accès Crew peut voir et faire — son propre horaire, les chantiers qui lui sont assignés, ses heures — ce qu'il ne voit jamais, et pourquoi il est gratuit.",
    updated: "2026-09-12",
    intro: [
      "**Crew** est le niveau des gens dans le camion : installateurs, peintres, aides. C'est le seul niveau gratuit — un accès Crew n'occupe jamais de siège — et le seul dont les réglages sont fixes, de sorte que rien ne peut s'y ajouter par accident.",
      "La description du produit lui-même sur la carte du niveau, affichée en anglais : voir leur horaire, les chantiers qui leur sont assignés et quoi acheter pour ceux-ci ; marquer le travail terminé et suivre leur temps ; aucun prix, soumission, facture ni demande.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Crew appartient au **palier Worker**. Quand vous le choisissez, l'éditeur n'affiche aucun réglage et dit plutôt : « L'accès des équipiers est fixe : leur propre horaire, les contrats qui leur sont assignés, ce qu'il faut acheter pour ces contrats, et leurs propres heures. Aucun prix, devis, facture ni demande. Les équipiers n'occupent pas de siège — pour donner plus que cela, choisissez un autre niveau. » Cette phrase est tout le contrat." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Ce qu'un équipier peut faire",
        blocks: [
          { bullets: [
            "Voir son propre horaire et le marquer terminé (**Schedule** : View and complete their own schedule).",
            "Pointer ses entrées et sorties et corriger ses propres heures (**Time Tracking & Timesheets** : View, record, and edit their own). Une entrée qu'il modifie lui-même repasse en attente, pour qu'un superviseur la revérifie avant qu'elle atteigne une paie.",
            "Ouvrir les chantiers qui lui sont assignés — et seulement ceux-là — en lecture seule : l'adresse, la visite, la liste de vérification et ce qu'il faut acheter (**Jobs** : View only, limité aux siens).",
            "Noter ses propres dépenses (**Expenses** : View, record, and edit their own).",
            "Voir ses propres fiches de paie (**Payroll & Payslips** : View their own payslips).",
            "Signaler un incident de sécurité et voir ceux qu'il a déclarés (**Safety Incidents** : Report incidents, and view their own).",
            "Lire le nom et l'adresse du client sur ses chantiers, rien de plus (**Clients and Properties** : View client name and address only), et les notes des chantiers et des visites seulement.",
          ] },
        ],
      },
      {
        id: "what-they-never-see",
        heading: "Ce qu'il ne voit jamais",
        blocks: [
          { bullets: [
            "Aucun prix nulle part — **Show Pricing** est désactivé, alors les montants sont retirés de tout ce qu'il peut lire.",
            "Pas de **Prospects**, de **Soumissions**, de **Factures** ni de **Forfaits** : les quatre sont à No access, et les lignes ont disparu de son menu.",
            "Pas de liste de clients : la ligne **Clients** est masquée. L'adresse sur son chantier n'est pas une permission de feuilleter votre clientèle.",
            "Pas de **Job Costing**, pas de **Payments**, pas les heures, l'horaire ou les dépenses de quelqu'un d'autre, pas de **Votre équipe**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "Ce que son menu montre",
        blocks: [
          { p: "**Accueil**, **Chantiers** (les siens), **Calendrier**, **À faire**, **Clavardage**, **Pointeuse**, **Congés**, **Sécurité**, **Paie** (ses propres fiches de paie) et **Aide**. Sous Paramètres : **Langue**, **Disponibilités** et **Nouveautés**. Sur un téléphone, les mêmes écrans sont dans la barre d'onglets de l'équipe — voir [[what-a-crew-member-sees|Ce qu'un équipier voit]] et [[how-fieldquo-works-for-crew|Comment FieldQuo fonctionne pour l'équipe]]." },
        ],
      },
      {
        id: "free",
        heading: "Pourquoi c'est gratuit",
        blocks: [
          { p: "Un siège se lit sur la grille : quelqu'un qui peut générer de l'argent — créer ou modifier des soumissions, des chantiers, des factures ou des prospects — est un siège. Un Crew ne le peut pas, alors un accès Crew est une place d'équipier, incluse avec chaque forfait, et il peut aussi occuper un siège inutilisé. Le panneau des sièges dans Gérer l'équipe montre les deux compteurs. Le détail : [[seats-and-crew-logins|Sièges et accès d'équipiers]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je donner une chose de plus à un équipier ?", a: "Pas sur Crew — ses réglages sont fixes. Utilisez Personnalisé et déplacez le réglage voulu, ou choisissez Estimator. Dans les deux cas l'accès devient un siège : tout réglage au-dessus de celui de Crew, ou tout interrupteur activé, est un siège." },
      { q: "Un équipier peut-il voir le numéro de téléphone du client ?", a: "Non. Le nom et l'adresse seulement, et seulement sur les chantiers qui lui sont assignés." },
      { q: "Un équipier dit que sa liste de Chantiers est vide.", a: "Il ne voit que les chantiers où il est réservé sur une visite. Assignez-le à la visite du chantier et il apparaît." },
    ],
  },

  "role-estimator": {
    title: "Le niveau Estimator",
    summary:
      "Le niveau de quelqu'un qui chiffre et envoie des soumissions et gère les clients, avec les prix — mais qui ne dirige ni les gens, ni la paie, ni les coûts de chantier.",
    updated: "2026-09-12",
    intro: [
      "**Estimator** est le vendeur ou le deuxième estimateur : quelqu'un qui doit pouvoir rédiger une soumission, ajouter le client, voir à quel prix elle a été chiffrée et l'envoyer — sans diriger l'atelier.",
      "La description du produit lui-même sur la carte du niveau, affichée en anglais : rédige des soumissions et gère les clients, avec les prix ; ne gère ni les gens, ni la paie, ni les coûts de chantier.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Estimator appartient au **palier Worker**, le même que Crew, et il occupe un siège. Les deux réglages qui en font un siège sont **Requests** et **Quotes** à View, create, and edit — un prospect qui devient une soumission, c'est le même geste un écran plus tôt. **Show Pricing** est activé, parce qu'on ne rédige pas une soumission sans les prix." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Ce qu'un Estimator peut faire",
        blocks: [
          { bullets: [
            "Créer et modifier des prospects et des soumissions, avec les prix (**Requests** et **Quotes** : View, create, and edit).",
            "Ajouter et modifier des clients et leurs propriétés (**Clients and Properties** : View and edit full client and property info) — on ne peut pas soumissionner pour quelqu'un qu'on ne peut pas ajouter.",
            "Lire chaque chantier et chaque facture, sans les modifier (**Jobs** et **Invoices** : View only).",
            "Lire toutes les notes (**Notes** : View all notes).",
            "Son propre horaire, ses heures, ses dépenses et ses fiches de paie seulement ; signaler un incident de sécurité et voir les siens.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Ce qu'il ne peut pas faire",
        blocks: [
          { bullets: [
            "Transformer une soumission en chantier, approuver une estimation instantanée dans **Révisions de devis**, ou assigner une soumission, un chantier ou un rendez-vous à quelqu'un d'autre — cela commence à Dispatcher.",
            "Supprimer quoi que ce soit, ou modifier un chantier ou une facture une fois qu'ils existent — un estimateur qui pourrait modifier la facture pourrait discrètement changer un prix déjà convenu.",
            "Voir les coûts ou la marge : **Job Costing** est désactivé, donc pas de KPI, pas de Frais généraux, pas de Coût des matériaux.",
            "Encaisser des paiements (**Payments** est désactivé), lancer la paie ou voir celle des autres, inviter des gens, ou ouvrir **Votre équipe**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "Ce que son menu montre",
        blocks: [
          { p: "**Prospects**, **Soumissions**, **Chantiers**, **Factures**, **Forfaits**, **Calendrier**, **À faire**, **Clients**, **Équipement client**, **Clavardage**, **Pointeuse**, **Congés**, **Sécurité**, **Paie** (ses propres fiches de paie), **Analyses**, **Réceptionniste** et **Aide**. Sous Paramètres, en plus de Langue, Disponibilités et Nouveautés : **Produits et services**, **Services et tarifs** et **Soumissions instantanées**, parce que Show Pricing est activé. Masqués : Révisions de devis, Votre équipe, Calendrier de l'équipe, Feuilles de temps, Dépenses, Achats, Véhicules, Sous-traitants, KPI, Marketing, Forfait." },
        ],
      },
    ],
    faq: [
      { q: "Un Estimator peut-il voir la grille de tarifs ?", a: "Oui — Show Pricing est activé, et Services et tarifs ainsi que Produits et services sont dans ses Paramètres. C'est pour cela que ce niveau est un siège et non un accès gratuit." },
      { q: "Pourquoi mon estimateur ne peut-il pas approuver une estimation instantanée ?", a: "Approuver un prix qu'un client a vu est une signature de superviseur dans FieldQuo : Dispatcher, Manager, un administrateur ou le propriétaire. Passez-le à Dispatcher si c'est son travail." },
    ],
  },

  "role-dispatcher": {
    title: "Le niveau Dispatcher",
    summary:
      "Le niveau du chef d'équipe : l'horaire et les heures de tout le monde, des documents créés et modifiés mais jamais supprimés, des invitations pour l'équipe — sans les coûts, la marge ni l'encaissement.",
    updated: "2026-09-12",
    intro: [
      "**Dispatcher** gère la semaine. L'horaire de tout le monde et le temps de tout le monde sont modifiables ; soumissions, chantiers, factures et prospects peuvent être créés et modifiés — mais pas supprimés. C'est le niveau du chef d'équipe qui réserve les gars, déplace les visites et tient la semaine à jour, sans le pouvoir de rien effacer.",
      "La description du produit lui-même sur la carte du niveau, affichée en anglais : modifie les détails des chantiers, de l'équipe et des clients ; recommandé pour les chefs d'équipe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Dispatcher appartient au **palier Manager**, partagé avec Manager — c'est pourquoi les deux se ressemblent à certains endroits, et pourquoi le badge dans Gérer l'équipe nomme le niveau plutôt que le palier. Le palier est ce qui permet à un Dispatcher d'inviter des gens, d'approuver des heures et des congés, de publier des quarts et de modifier la page de rendez-vous. Il occupe un siège." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Ce qu'un Dispatcher peut faire",
        blocks: [
          { bullets: [
            "Modifier l'horaire de tout le monde (**Schedule** : Edit everyone's schedule) et préparer puis publier la semaine de l'équipe dans **Attribuer les quarts**.",
            "Voir, enregistrer, modifier et supprimer les heures de tout le monde (**Time Tracking & Timesheets**) et les approuver dans **Feuilles de temps** avant qu'elles atteignent une paie.",
            "Créer et modifier des prospects, des soumissions, des chantiers et des factures (les quatre à View, create, and edit), transformer une soumission en chantier, approuver des estimations instantanées dans **Révisions de devis**, et assigner du travail aux gens.",
            "Les fiches clients complètes (**Clients and Properties** : View and edit full client and property info) ; voir et modifier toutes les notes ; voir les incidents de sécurité de tout le monde et y donner suite.",
            "Inviter des gens — **Crew** ou **Estimator** seulement — approuver des congés, et ouvrir **Votre équipe**, **Calendrier de l'équipe**, **Sous-traitants**, **Véhicules**, **Marketing**, **Créateur** et **Funnels**.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Ce qu'il ne peut pas faire",
        blocks: [
          { bullets: [
            "Supprimer une soumission, un chantier, une facture, un prospect ou un client — chaque réglage de document s'arrête un échelon avant la suppression.",
            "Voir les coûts ou la marge : **Job Costing** est désactivé, donc pas de KPI, de Frais généraux ni de Coût des matériaux, et l'écran Véhicules montre le camion sans ce qu'il a coûté.",
            "Voir les dépenses de quelqu'un d'autre (**Expenses** : les siennes), donc pas de cumul des Dépenses et pas d'Achats.",
            "Encaisser des paiements (**Payments** est désactivé), voir les fiches de paie des autres ou lancer la paie, ou ouvrir la facturation de l'entreprise.",
            "Changer le niveau d'une personne existante, nommer un administrateur ou désactiver qui que ce soit — dans Gérer l'équipe, les listes sont des badges pour un Dispatcher.",
          ] },
        ],
      },
      {
        id: "settings-they-see",
        heading: "Les lignes des Paramètres qu'il voit",
        blocks: [
          { p: "Tout ce qui relève de la gestion d'une équipe : **Profil de l'entreprise**, **Image de marque**, **Gérer l'équipe**, **Page de rendez-vous**, **Zones desservies**, **Champs personnalisés**, **Modèles de courriel**, **Modèles PDF**, **Courriel de soumission**, **Relances**, **Traductions**, **Messages aux clients**, **Listes de vérification**, **Étiquettes des photos de chantier**, **Domaine d'envoi**, **Votre site web**, **Réceptionniste téléphonique**, **Crédit IA**, **Employé IA**, **Partager vos liens**, **Lien de profil**, **Avis**, plus la liste de prix. Masqués : **Compte et facturation**, **Paiements**, **Paie**, **Journal d'activité**, **Politiques de congés**, **Notifications**, **Publicités Meta**, **Parrainage**, **Migration de données**, **Frais généraux**, **Coût des matériaux**, **Suivi des dépenses**." },
        ],
      },
    ],
    faq: [
      { q: "Mon répartiteur doit supprimer un chantier annulé. Que faire ?", a: "La suppression est ce qui sépare Manager de Dispatcher. Passez-le à Manager, ou ouvrez Personnalisé… et montez seulement le réglage Jobs à View, create, edit, and delete." },
      { q: "Un Dispatcher peut-il faire de quelqu'un un Manager ?", a: "Non. Un Dispatcher ne peut inviter que Crew ou Estimator, et ne peut changer personne qui est déjà dans l'effectif. Seul un propriétaire ou un administrateur change le niveau des gens." },
    ],
  },

  "role-manager": {
    title: "Le niveau Manager",
    summary:
      "Le niveau qui gère le quotidien — soumissions, chantiers, clients, horaires et dépenses, suppression comprise, avec les coûts de chantier et l'encaissement activés — mais pas la paie ni la facturation de l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "**Manager** est le gérant de bureau ou l'associé qui dirige les opérations. Si la question est « puis-je donner tout à quelqu'un, sauf l'argent ? », voici la réponse : tout ce que Dispatcher a, plus la suppression, plus les dépenses de tout le monde, plus les coûts de chantier et l'encaissement.",
      "La description du produit lui-même sur la carte du niveau, affichée en anglais : gère le quotidien — soumissions, chantiers, clients, horaires et dépenses ; pas la paie, ni la facturation de l'entreprise ; recommandé pour la direction.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Manager appartient au **palier Manager** avec Dispatcher, alors les deux partagent les mêmes limites sur le personnel : inviter Crew ou Estimator seulement, jamais changer le niveau de quelqu'un ni le désactiver. Ce que Manager ajoute est sur la grille — chaque réglage de document à son échelon le plus haut, et les trois interrupteurs activés. Il occupe un siège." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Ce qu'un Manager peut faire",
        blocks: [
          { bullets: [
            "Créer, modifier et supprimer des prospects, des soumissions, des chantiers et des factures, ainsi que des clients (**Clients and Properties** : View, edit, and delete full client and property info).",
            "Modifier et supprimer l'horaire de tout le monde ; voir, enregistrer, modifier et supprimer les heures de tout le monde et les approuver ; voir, modifier et supprimer toutes les notes.",
            "Voir, enregistrer et modifier les dépenses de tout le monde (**Expenses** : View, record, and edit everyone's) — ce qui ouvre **Dépenses**, **Achats** et **Suivi des dépenses**.",
            "**Job Costing** activé : le coût par chantier, les marges, les **KPI**, et la base de coûts dans **Frais généraux** et **Coût des matériaux**.",
            "**Payments** activé : encaisser des paiements sur les soumissions et les factures.",
            "Tout ce qu'un Dispatcher peut faire : inviter Crew ou Estimator, publier des quarts, approuver congés et heures, approuver des estimations instantanées, et chaque ligne des Paramètres qui relève de la gestion d'une équipe.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Ce qu'il ne peut pas faire",
        blocks: [
          { bullets: [
            "La paie : le préréglage dit **View their own payslips**, alors un Manager voit ses propres fiches de paie et rien de la paie des autres, et il ne peut pas lancer une paie. Un propriétaire qui veut qu'un gérant lance la paie l'accorde délibérément, dans Personnalisé, avec **View everyone's and run payroll**.",
            "La facturation de l'entreprise : **Forfait**, **Compte et facturation**, **Paiements** (la connexion Stripe), **Publicités Meta**, **Parrainage** et **Migration de données** restent au propriétaire et aux administrateurs.",
            "**Journal d'activité**, **Politiques de congés** et **Notifications** — propriétaire et administrateur seulement.",
            "Changer le niveau d'une personne existante, nommer un administrateur ou désactiver qui que ce soit.",
          ] },
        ],
      },
      {
        id: "manager-or-administrator",
        heading: "Manager ou Administrator ?",
        blocks: [
          { p: "Manager est le niveau du personnel. **Administrator** est autre chose : tout ce que le propriétaire a, facturation et paie de tout le monde comprises, sans grille à consulter — pensé pour un associé ou un comptable. Si quelqu'un doit voir le forfait et la carte, c'est un administrateur ; s'il doit faire tourner l'atelier, c'est un Manager. Voir [[administrators|Administrateurs]]." },
        ],
      },
    ],
    faq: [
      { q: "Mon Manager peut-il lancer la paie ?", a: "Pas avec le préréglage. Ouvrez Personnalisé… pour lui et réglez Payroll & Payslips à View everyone's and run payroll. Il reste un Manager pour tout le reste." },
      { q: "Pourquoi mon Manager ne voit-il ni le compte à rebours de l'essai ni le forfait ?", a: "La facturation est réservée au propriétaire et aux administrateurs. Les lignes Forfait et Compte et facturation sont masquées pour un Manager, et le compte à rebours de l'essai dans la barre latérale n'est montré qu'au propriétaire." },
    ],
  },

  "administrators": {
    title: "Administrateurs",
    summary:
      "Ce que Nommer administrateur accorde — tout ce que le propriétaire a, sauf la propriété — qui peut l'accorder, ce qu'un administrateur ne peut toujours pas faire, et les règles du dernier propriétaire qui protègent le compte.",
    updated: "2026-09-12",
    intro: [
      "Un **administrateur** détient tout ce que le propriétaire détient, sans grille d'autorisations à consulter : la facturation, la paie, le journal d'activité, chaque réglage, chaque document, et le pouvoir de changer l'accès de n'importe qui d'autre. Il existe pour un associé ou un comptable qui doit voir le forfait et la carte. Ce n'est pas un niveau pour le personnel — cela, c'est Manager.",
      "La case du formulaire le dit clairement : « Cela lui donne accès à tout dans le compte — y compris la facturation, les rapports, la modification de la liste des clients et toutes les autorisations des utilisateurs. »",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Dans **Nouvel utilisateur** et dans l'éditeur d'accès, **Nommer administrateur** est une case au-dessus des cartes de niveau. Cochez-la et les cartes et la grille disparaissent — le palier est toute la réponse, il n'y a rien à régler. Dans Gérer l'équipe, un administrateur apparaît comme **Administrator** dans la colonne Rôle, et le panneau des sièges le compte sous **Administrateurs**. Un administrateur occupe toujours un siège." },
        ],
      },
      {
        id: "make-an-administrator",
        heading: "Comment nommer un administrateur",
        blocks: [
          { steps: [
            "Ouvrez **Gérer l'équipe**. Vous devez être le propriétaire : **Nommer administrateur** n'est offert qu'à quelqu'un qui peut accorder le niveau Administrator, et c'est le propriétaire seul.",
            "Dans la liste **Rôle** de la personne, choisissez **Administrator** — ou choisissez **Personnalisé…**, cochez **Nommer administrateur** et appuyez sur **Enregistrer**.",
            "Pour le retirer, choisissez n'importe quel autre niveau dans la même liste. Sa grille est remplacée par celle de ce niveau ; il garde son identifiant.",
          ] },
          { note: "À l'invitation, la même case se trouve sous **Autorisations** dans Nouvel utilisateur. Une invitation Administrator en attente montre son niveau à côté du badge **Invité**, pour qu'on puisse l'annuler avant qu'elle soit acceptée." },
        ],
      },
      {
        id: "what-they-get",
        heading: "Ce qu'un administrateur obtient",
        blocks: [
          { bullets: [
            "Chaque ligne du menu et chaque ligne des Paramètres, y compris **Compte et facturation**, **Paiements**, **Publicités Meta**, **Parrainage**, **Migration de données**, **Journal d'activité**, **Politiques de congés** et **Notifications**.",
            "La facturation : changer le forfait, la carte et l'abonnement. La paie : lancer des paies et modifier les retenues et les composantes de fiche de paie.",
            "L'équipe : inviter n'importe qui en dessous de lui (Crew, Estimator, Dispatcher, Manager), changer le niveau de ces personnes, et les activer ou les désactiver.",
            "La grille d'autorisations ne s'applique pas à lui — chaque réglage se lit à son échelon le plus haut et chaque interrupteur comme activé.",
          ] },
        ],
      },
      {
        id: "what-stays-with-the-owner",
        heading: "Ce qui reste au propriétaire",
        blocks: [
          { bullets: [
            "La propriété elle-même. Le propriétaire est le compte qui a inscrit l'entreprise ; FieldQuo n'a aucune commande pour la transférer, et personne — administrateurs compris — ne peut changer le niveau d'un propriétaire ni le désactiver depuis l'effectif.",
            "Nommer un autre administrateur. Chacun ne peut accorder qu'un accès strictement inférieur au sien, alors un administrateur peut accorder Manager et en dessous, jamais Administrator.",
            "Modifier un autre administrateur : même rang, pas de liste.",
            "Le compte à rebours de l'essai dans la barre latérale n'est montré qu'au propriétaire, même si un administrateur peut ouvrir Compte et facturation et agir.",
          ] },
          { warning: "Le dernier propriétaire ou administrateur actif ne peut pas être désactivé, et le dernier propriétaire ne peut pas être rétrogradé. L'écran refuse avec « That's the last active owner or admin. Someone has to be able to manage the account — promote or reactivate somebody first. »" },
        ],
      },
    ],
    faq: [
      { q: "Mon gérant de bureau devrait-il être administrateur ?", a: "Généralement non. Manager lui donne tout le quotidien sans votre facturation ni la paie de tout le monde. Réservez Administrator à un associé ou à un comptable." },
      { q: "Je suis administrateur et je ne peux pas nommer mon collègue. Pourquoi ?", a: "Seul le propriétaire le peut. Un administrateur accorde Manager et en dessous." },
      { q: "Un administrateur peut-il bloquer le propriétaire ?", a: "Non. La ligne du propriétaire est en lecture seule pour tout le monde, et le dernier propriétaire ne peut jamais être désactivé." },
    ],
  },

  "the-custom-access-editor": {
    title: "L'éditeur d'accès personnalisé",
    summary:
      "La grille derrière chaque niveau — onze domaines, trois interrupteurs — comment l'ouvrir pour une personne nouvelle ou existante, ce que chaque réglage fait, et ce que vous avez le droit d'accorder.",
    updated: "2026-09-12",
    intro: [
      "Chaque niveau sauf Administrator est une grille : onze domaines, chacun une échelle du moins au plus d'accès, et trois interrupteurs marche/arrêt. Les quatre préréglages sont des grilles remplies. **Personnalisé** est la même grille avec vos propres réglages.",
      "Le même éditeur sert dans **Nouvel utilisateur** et, pour quelqu'un déjà dans l'équipe, depuis l'entrée **Personnalisé…** de sa liste Rôle dans **Gérer l'équipe** — ce que vous pouvez régler à l'invitation, vous pouvez donc aussi le changer plus tard.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'éditeur s'ouvre sous le titre **Accès de …** avec une ligne de consigne : « Choisissez un point de départ, puis ajustez ce que vous voulez. Leur connexion ne change pas. » De haut en bas : **Nommer administrateur** (propriétaire seulement), les quatre cartes de niveau avec leur pastille de palier, la carte **Personnalisé**, les onze listes déroulantes et les trois cases à cocher. **Annuler** ferme sans enregistrer ; **Enregistrer** applique la grille tout de suite." },
          { figure: "harness:access-editor", caption: "Gérer l'équipe — l'éditeur d'accès personnalisé ouvert sur un Estimator : Nommer administrateur, les quatre cartes de niveau avec leur pastille de palier, Personnalisé, et les premiers réglages." },
        ],
      },
      {
        id: "open-the-editor",
        heading: "Comment l'ouvrir",
        blocks: [
          { steps: [
            "Pour quelqu'un dans l'équipe : **Gérer l'équipe** → sa liste **Rôle** → **Personnalisé…**. Le panneau s'ouvre en montrant le niveau qu'il a maintenant, ou Personnalisé si sa grille ne correspond à aucun.",
            "Pour quelqu'un de nouveau : **Ajouter un utilisateur** → sous **Autorisations**, appuyez sur la carte **Personnalisé** (« Définissez chaque autorisation ci-dessous individuellement. »).",
            "Appuyez sur une carte de niveau pour charger sa grille, puis déplacez n'importe quel réglage. Dès que vous touchez un réglage, la carte se désélectionne : la personne est maintenant Personnalisé.",
            "Appuyez sur **Enregistrer**. Une grille personnalisée au-dessus de Crew sur un seul réglage occupe un siège, et l'enregistrement est refusé si votre forfait n'en a plus de libre.",
          ] },
        ],
      },
      {
        id: "the-eleven-areas",
        heading: "Les onze domaines",
        blocks: [
          { table: {
            head: ["Domaine","Échelon 1 (le plus bas)","Échelon 2","Échelon 3","Échelon 4","Échelon 5"],
            rows: [
              ["Schedule","View their own schedule","View and complete their own schedule","Edit their own schedule","Edit everyone's schedule","Edit and delete everyone's schedule"],
              ["Time Tracking & Timesheets","View and record their own","View, record, and edit their own","View, record, edit, and delete everyone's","—","—"],
              ["Payroll & Payslips","No access","View their own payslips","View everyone's payslips","View everyone's and run payroll","—"],
              ["Notes","View notes on jobs and visits only","View all notes","View and edit all","View, edit, and delete all","—"],
              ["Expenses","View, record, and edit their own","View, record, and edit everyone's","—","—","—"],
              ["Clients and Properties","View client name and address only","View full client and property info","View and edit full client and property info","View, edit, and delete full client and property info","—"],
              ["Requests","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Quotes","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Jobs","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Invoices","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Safety Incidents","No access","Report incidents, and view their own","View everyone's incidents","View everyone's incidents and follow up on them","—"],
            ],
          } },
          { p: "Un tiret veut dire que l'échelle s'arrête là ; la dernière case remplie est l'échelon le plus haut. **Requests**, c'est l'écran Prospects. **Jobs** à No access retient la fiche du chantier, pas le travail : l'horaire, la liste de vérification de la visite et la pointeuse sont leurs propres domaines, alors un équipier voit quand même sa journée. L'échelon le plus haut de Time Tracking est celui qui supprime une entrée, et l'échelle de la paie commence volontairement à « leurs propres » : un employé qui voit la paie d'un autre, c'est un incident, pas un réglage." },
          { warning: "Le réglage **Notes** est enregistré et réaffiché, mais aujourd'hui il ne restreint rien : une personne réglée à « View notes on jobs and visits only » lit et écrit les notes des prospects, des clients et des soumissions exactement comme quelqu'un à « View all notes ». Ne fondez pas une décision de personnel dessus." },
        ],
      },
      {
        id: "the-three-switches",
        heading: "Les trois interrupteurs",
        blocks: [
          { bullets: [
            "**Show Pricing** — voir les prix sur les soumissions, les factures et les chantiers, et les modifier ; sans lui, les montants sont retirés de ce que la personne peut lire autant que de ce qu'elle peut écrire (la description est en anglais à l'écran). Désactivé, il masque aussi la liste de prix, les Analyses et chaque PDF avec prix.",
            "**Job Costing** — montrer le profit du chantier en suivant les revenus et les coûts à partir des lignes, de la main-d'œuvre et des dépenses. Exige Show Pricing, le suivi du temps, les dépenses et l'accès aux chantiers. Il garde aussi la base de coûts : Frais généraux, Coût des matériaux, KPI.",
            "**Payments** — permettre l'encaissement des paiements sur les soumissions et les factures. Exige Show Pricing, la modification de Clients and Properties, et la modification de Quotes et/ou Invoices.",
          ] },
          { p: "Deux lignes d'information se trouvent sous la grille dans Nouvel utilisateur et ne sont pas des réglages : les communications avec les clients et les rapports découlent des autres autorisations que la personne détient." },
        ],
      },
      {
        id: "what-you-can-hand-out",
        heading: "Ce que vous pouvez accorder",
        blocks: [
          { p: "Un propriétaire ou un administrateur voit chaque échelon et chaque interrupteur. Un Dispatcher ou un Manager ne voit chaque échelle que jusqu'à son propre échelon, et seulement les interrupteurs qu'il détient lui-même — un niveau que vous n'avez pas n'est pas à vous à déléguer. Le serveur applique le même plafond à l'enregistrement, alors une grille arrivée par un autre chemin est ramenée à la même ligne. Changer la grille d'une personne existante est réservé au propriétaire et aux administrateurs ; un Dispatcher ou un Manager ne rencontre cet éditeur que dans Nouvel utilisateur." },
          { note: "**Crew** n'affiche aucun réglage. Le choisir verrouille la grille au niveau gratuit ; pour donner plus que Crew à quelqu'un, partez d'une autre carte ou de Personnalisé — et cela en fait un siège." },
        ],
      },
    ],
    faq: [
      { q: "Une grille personnalisée occupe-t-elle un siège ?", a: "Oui, sauf si chaque réglage est au niveau de Crew ou en dessous et qu'aucun interrupteur n'est activé. Un seul réglage au-dessus de celui de Crew fait de l'accès un siège, quoi que dise le reste." },
      { q: "J'ai choisi un préréglage et le badge dit Personnalisé.", a: "Un réglage a été déplacé après le chargement du préréglage — par vous, ou par quelqu'un avant. Choisissez de nouveau le préréglage dans la liste Rôle pour remplacer toute la grille." },
      { q: "Le réglage que j'ai choisi est revenu plus bas.", a: "Vous ne pouvez pas accorder plus que ce que vous détenez. Le serveur a ramené la grille à votre propre échelon sur ce domaine ; demandez à un propriétaire ou à un administrateur de le régler." },
    ],
  },

  "seats-and-crew-logins": {
    title: "Sièges et accès d'équipiers",
    summary:
      "Ce qui compte comme un siège, pourquoi un accès Crew est gratuit, comment le panneau des sièges dans Gérer l'équipe compte les gens dans votre forfait, et ce qui se passe quand c'est plein.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo facture par **sièges**, et un siège se lit sur l'accès d'une personne — pas sur son titre. Quelqu'un qui peut générer de l'argent est un siège ; quelqu'un qui ne le peut pas est un accès d'équipier, et les accès d'équipiers sont inclus gratuitement avec chaque forfait.",
      "C'est pourquoi une entreprise de peinture de douze personnes avec deux personnes au bureau est une entreprise à deux sièges. Le panneau en haut de **Gérer l'équipe** montre les deux nombres côte à côte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le panneau des sièges se lit, par exemple, **4 / 6 sièges utilisés** et **3 / 11 équipiers — inclus gratuitement**, avec une répartition dessous (**1 Administrateurs · 1 Gestionnaires · 1 Répartiteurs · 1 Employés · 3 Équipiers**). Les sièges et les équipiers ont des plafonds séparés et des boutons séparés — **Ajouter un siège** et **Ajouter un équipier — gratuit** — et chacun se ferme indépendamment : un plafond de sièges atteint ne vous empêche pas d'ajouter des équipiers, et inversement." },
        ],
      },
      {
        id: "what-counts-as-a-seat",
        heading: "Ce qui compte comme un siège",
        blocks: [
          { bullets: [
            "Le propriétaire et chaque administrateur, toujours.",
            "Chaque Estimator, Dispatcher et Manager — chacun détient au moins un réglage de document à View, create, and edit.",
            "Toute grille personnalisée qui dépasse le niveau Crew sur un seul réglage, ou qui a un interrupteur activé. Le gratuit est défini par un plafond — le préréglage Crew, réglage par réglage — et non par une courte liste de domaines, alors un seul réglage relevé est un siège, peu importe comment il est arrivé là.",
            "Une invitation en attente, dès son envoi, au niveau qu'elle porte.",
          ] },
          { p: "Une personne désactivée ne compte dans aucune colonne. Un accès d'équipier, c'est quiconque est au plafond Crew ou en dessous ; le compteur **Équipiers** du panneau, c'est exactement ces personnes." },
        ],
      },
      {
        id: "the-plans",
        heading: "Sièges et places d'équipiers sur chaque forfait",
        blocks: [
          { table: {
            head: ["Forfait", "Sièges", "Accès d'équipiers inclus gratuitement", "Personnes au total"],
            rows: [
              ["Solo", "1", "5", "6"],
              ["Crew", "3", "8", "11"],
              ["Shop", "6", "11", "17"],
              ["Scale", "10", "15", "25"],
            ],
          } },
          { p: "Un équipier peut occuper un siège inutilisé, parce qu'un siège contient strictement plus d'accès qu'une place d'équipier : la règle est les sièges dans le plafond de sièges, et tout le monde dans sièges plus équipiers. Vingt techniciens et deux personnes au bureau entrent dans Scale. Les prix et le choix entre mensuel et engagement d'un an sont dans [[the-four-plans|Les quatre forfaits]]." },
        ],
      },
      {
        id: "when-you-are-full",
        heading: "Quand c'est plein",
        blocks: [
          { bullets: [
            "Le bouton de la sorte pleine se grise — « Vous utilisez tous les sièges de votre forfait. » ou « Vous utilisez toutes les places d'équipiers de votre forfait. » — et la phrase à côté nomme le prochain forfait qui conviendrait : « Vous avez utilisé tous vos sièges. Shop couvre 6 sièges et 11 équipiers. » Un propriétaire ou un administrateur a aussi un lien **Passer au forfait supérieur** vers Compte et facturation.",
            "Envoyer une invitation ou monter quelqu'un d'un niveau est refusé côté serveur avec les mêmes chiffres, même si un deuxième onglet montrait encore de la place.",
            "Pour libérer un siège : désactivez quelqu'un qui est parti, annulez une invitation en attente, ou descendez une personne à **Crew**. Le panneau se met à jour au prochain chargement.",
            "Au-delà de Scale, la phrase devient « Vous dépassez les forfaits vendus en ligne — parlons-en. »",
          ] },
          { tip: "Le formulaire d'invitation est le guide honnête : **Ajouter un équipier — gratuit** l'ouvre sur Crew, **Ajouter un siège** sur Dispatcher, et la carte de niveau sur laquelle vous arrivez vous dit quelle sorte de place vous êtes sur le point d'utiliser. Le détail sur l'achat : [[add-a-seat-or-a-crew-login|Ajouter un siège, ou un accès d'équipier gratuit]] et [[your-plan-and-seats|Votre forfait et vos sièges]]." },
        ],
      },
    ],
    faq: [
      { q: "Un accès d'équipier est-il vraiment gratuit ?", a: "Oui. Chaque forfait comprend un nombre de places d'équipiers sans frais, et un accès Crew peut aussi occuper un siège inutilisé. Le panneau des sièges dit combien vous en avez de chaque sorte." },
      { q: "Pourquoi ajouter un réglage à un équipier a-t-il utilisé un siège ?", a: "Le gratuit est un plafond, pas une catégorie. Tout réglage au-dessus de celui du préréglage Crew — ou tout interrupteur activé — est un siège, parce que c'est ce qui permet à une personne de créer ou de modifier des soumissions, des chantiers, des factures ou des prospects." },
      { q: "Une invitation en attente occupe-t-elle un siège ?", a: "Oui, au niveau qu'elle porte, dès son envoi. Annulez-la pour récupérer la place." },
    ],
  },

  "deactivate-a-team-member": {
    title: "Désactiver un membre de l'équipe",
    summary:
      "Comment couper l'accès de quelqu'un avec la case Actif, ce qui change et ce qui reste, qui a le droit de le faire, et les règles qui empêchent un compte de se bloquer lui-même.",
    updated: "2026-09-12",
    intro: [
      "Quand quelqu'un part, vous le désactivez : décochez **Actif** sur sa ligne dans **Gérer l'équipe**. Son identifiant cesse de fonctionner pour votre entreprise, son siège ou sa place d'équipier est libéré, et tout ce qu'il a fait reste dans les livres.",
      "Désactiver n'est pas supprimer. FieldQuo n'a sur cet écran aucune commande qui efface une personne, parce que ses soumissions, ses heures et son historique de paie sont vos dossiers, pas les siens.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque ligne de l'effectif se termine par une case **Actif**. Cochée, la personne peut se connecter ; décochée, elle ne le peut pas. La case n'est active que pour un propriétaire ou un administrateur et seulement sur les lignes d'un rang inférieur au sien ; sinon elle est grisée et son infobulle dit pourquoi — « Seul un propriétaire ou un administrateur peut activer ou désactiver un membre de l'équipe » ou « Vous ne pouvez désactiver que les membres dont le rôle est inférieur au vôtre »." },
          { figure: "harness:team", caption: "Gérer l'équipe — la colonne Actif à droite ; la propre ligne du propriétaire est grisée, chaque ligne en dessous est active." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment désactiver quelqu'un",
        blocks: [
          { steps: [
            "Ouvrez **Gérer l'équipe** — **Votre équipe** dans la barre latérale, ou **Paramètres → Gérer l'équipe**.",
            "Trouvez la personne et décochez **Actif**. Le changement s'enregistre immédiatement ; il n'y a pas d'étape de confirmation.",
            "Vérifiez le panneau des sièges : son siège ou sa place d'équipier est de nouveau libre au prochain chargement.",
          ] },
          { note: "Pour ramener quelqu'un, cochez de nouveau **Actif**. Il garde son identifiant, son niveau et sa grille, et il compte de nouveau dans votre forfait." },
        ],
      },
      {
        id: "what-changes",
        heading: "Ce qui change, et ce qui reste",
        blocks: [
          { bullets: [
            "La personne ne peut plus se connecter à votre entreprise : chaque écran et chaque requête refusent un membre désactivé. Si elle appartient aussi à une autre entreprise sur FieldQuo, cette entreprise n'est pas touchée.",
            "Elle cesse de compter dans votre forfait — siège ou place d'équipier — immédiatement.",
            "Tout reste : soumissions, chantiers, factures, entrées de temps, paies, rapports de sécurité, et sa fiche de travailleur dans **Travailleurs**, qui peut encore recevoir ce qui lui est dû.",
            "Le changement est inscrit au **Journal d'activité** comme « Deactivated … », avec qui l'a fait et quand ; la réactivation est inscrite de la même façon.",
          ] },
        ],
      },
      {
        id: "the-rules",
        heading: "Les règles",
        blocks: [
          { bullets: [
            "Propriétaire et administrateur seulement. Un Dispatcher ou un Manager peut inviter des gens et les planifier, mais ne peut couper l'accès de personne — c'est la décision du propriétaire, pas de celui qui édite l'effectif.",
            "Seulement quelqu'un d'un rang inférieur au vôtre : un administrateur ne peut pas désactiver un autre administrateur ni le propriétaire.",
            "Jamais vous-même — « You can't deactivate your own account — you'd lock yourself out. »",
            "Jamais le dernier propriétaire, et jamais le dernier propriétaire ou administrateur actif : quelqu'un doit toujours pouvoir gérer le compte.",
          ] },
        ],
      },
      {
        id: "invitations",
        heading: "Quelqu'un qui n'a jamais accepté",
        blocks: [
          { p: "Une personne invitée qui n'a jamais rejoint l'équipe n'a pas d'identifiant à désactiver. Sa ligne montre **Invité** ; appuyez sur **Annuler l'invitation** et confirmez. Le lien cesse de fonctionner et la place est libérée. N'importe quel Dispatcher, Manager, administrateur ou propriétaire peut annuler une invitation." },
        ],
      },
    ],
    faq: [
      { q: "Désactiver supprime-t-il ses heures ou ses fiches de paie ?", a: "Non. Rien n'est supprimé. Ses entrées de temps, ses paies et ses documents restent exactement tels qu'ils étaient." },
      { q: "Un Manager peut-il désactiver un équipier qui est parti ?", a: "Non. Seul un propriétaire ou un administrateur peut décocher Actif. Le Manager voit la case grisée avec la raison." },
      { q: "J'ai désactivé quelqu'un par erreur.", a: "Cochez de nouveau Actif. Rien n'a été perdu ; la personne se connecte comme avant avec le même niveau." },
    ],
  },
};
