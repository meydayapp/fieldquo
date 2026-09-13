// content/help/fr/jobs-and-scheduling-2.js
//
// Partie 2 de la catégorie « jobs-and-scheduling » en français (voir le
// composeur, jobs-and-scheduling.js). Slugs de cette partie
// (lib/help/tree.js) : recurring-jobs, tasks, suggested-tasks,
// checklists-on-site, job-photos-and-tags, job-notes, work-areas,
// the-scheduler-and-crew-shifts, the-team-schedule, the-time-clock.
//
// Même structure que le module anglais (sections, blocs, figures, nombre
// d'étapes, de puces, de lignes et de questions) — le check la compare. Les
// mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js ; les
// libellés que le produit affiche en anglais sur tous les écrans (les
// préréglages Crew / Estimator / Dispatcher / Manager, la grille d'accès, les
// boutons d'une visite, le panneau des tâches suggérées) sont cités tels
// quels et signalés comme tels.
export const ARTICLES = {
  "recurring-jobs": {
    title: "Chantiers récurrents",
    summary:
      "Cochez « chantier récurrent », choisissez hebdomadaire, toutes les 2 semaines ou mensuel, et FieldQuo place la prochaine visite au calendrier lui-même — une seule visite à venir à la fois, jusqu'à ce que le chantier soit terminé ou annulé.",
    updated: "2026-09-12",
    intro: [
      "Un ménage aux deux semaines, une tonte mensuelle, un changement de filtre saisonnier : le même chantier à la même adresse, encore et encore. Un chantier récurrent est un chantier ordinaire avec une case cochée et une fréquence. Dès que sa première visite est au calendrier, FieldQuo planifie toutes les suivantes pour vous, en reportant la même personne et la même liste de vérification.",
      "La règle est petite exprès : trois fréquences, une seule visite à venir à la fois, et rien d'inventé. La première visite est toujours la vôtre à réserver — FieldQuo continue une série, il ne devine jamais quand elle devrait commencer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un chantier porte deux choses pour la récurrence : la case **Il s'agit d'un chantier récurrent** et une **Récurrence** parmi **Hebdomadaire**, **Toutes les 2 semaines** ou **Mensuel**. Les deux sont sur le formulaire Nouveau chantier et sur l'écran Modifier du chantier. La liste des chantiers affiche une étiquette **Récurrent** sur chaque chantier dont la case est cochée." },
          { p: "La récurrence crée des visites, rien d'autre. Elle n'émet pas de facture, n'envoie rien au client et ne change pas le prix du chantier. Si vous voulez facturer un client selon un calendrier, c'est un plan de service — voir [[service-plans|Plans de service (facturation récurrente)]]." },
        ],
      },
      {
        id: "set-up-a-recurring-job",
        heading: "Comment créer un chantier récurrent",
        blocks: [
          { steps: [
            "Ouvrez **Chantiers → Nouveau chantier** (ou **Modifier** sur un chantier existant).",
            "Cochez **Il s'agit d'un chantier récurrent**. Un sélecteur **Récurrence** apparaît — choisissez **Hebdomadaire**, **Toutes les 2 semaines** ou **Mensuel**. Le formulaire refuse d'enregistrer la case sans fréquence, pour qu'un chantier ne puisse jamais se lire comme répétitif pendant que rien n'est planifié.",
            "Appuyez sur **Créer le chantier**, puis réservez la première visite avec **Ajouter une visite** sur la page du chantier. Cette première date est le point d'ancrage à partir duquel toutes les visites suivantes sont comptées.",
          ] },
          { figure: "create:app-jobs-create", caption: "Chantiers → Nouveau chantier — le client, le titre, l'adresse du chantier et la case « Il s'agit d'un chantier récurrent »." },
          { note: "Tant que la première visite n'existe pas, rien n'est planifié. FieldQuo continue une série à partir de sa dernière visite ; il ne choisit pas de date de départ à votre place." },
        ],
      },
      {
        id: "when-the-next-visit-appears",
        heading: "Quand la prochaine visite apparaît",
        blocks: [
          { p: "Un chantier récurrent a toujours exactement une visite à venir. La suivante est créée à deux moments :" },
          { bullets: [
            "**Au moment où une visite est marquée terminée.** L'équipe qui clôt la visite d'aujourd'hui voit déjà celle de la semaine prochaine au calendrier.",
            "**Une fois par nuit**, en filet de sécurité, pour tout chantier récurrent dont la dernière visite est passée sans avoir été marquée terminée.",
          ] },
          { p: "La prochaine date est comptée à partir de la visite la plus récente et tombe toujours dans le futur. Un chantier laissé inactif pendant des mois reçoit sa prochaine plage à venir, pas une pile de visites antidatées où personne n'ira. Le mensuel garde le même jour du mois ; une visite le 31 tombe le dernier jour d'un mois plus court plutôt que d'être sautée." },
          { p: "La nouvelle visite reprend la personne assignée à la précédente et sa liste de vérification, pour que le ménage de la semaine prochaine soit le même ménage, par la même personne, sur la même liste — jusqu'à ce que quelqu'un change quelque chose." },
        ],
      },
      {
        id: "stopping-a-series",
        heading: "Arrêter une série",
        blocks: [
          { bullets: [
            "Passez le statut du chantier à **Terminé** ou **Annulé** — un chantier terminé ou annulé ne se reconduit jamais.",
            "Ou ouvrez **Modifier** et décochez **Il s'agit d'un chantier récurrent**. Les visites déjà au calendrier restent ; aucune nouvelle n'est créée.",
          ] },
          { tip: "Pour sauter une seule visite, appuyez sur **Cancel visit** sur celle-ci et laissez le chantier actif. Une visite annulée garde sa place — rien de nouveau n'est créé tant que sa date n'est pas passée — et la vérification de nuit compte ensuite la date suivante à partir d'elle, de sorte que la série continue sans la visite sautée." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le régler",
        blocks: [
          { p: "Créer un chantier et modifier sa récurrence demande le domaine Jobs de la grille d'accès au niveau **View, create, and edit** — les préréglages Dispatcher et Manager, le propriétaire et les administrateurs. Les Estimator et les Crew voient le chantier et son étiquette **Récurrent** mais ne peuvent pas la changer. Les visites créées par la série obéissent aux mêmes règles que n'importe quelle visite." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je régler un chantier récurrent aux trois semaines, ou deux fois par semaine ?", a: "Non. Les trois fréquences sont Hebdomadaire, Toutes les 2 semaines et Mensuel. Pour tout le reste, réservez les visites à la main." },
      { q: "Le client reçoit-il quelque chose quand une nouvelle visite est créée ?", a: "Pas de la récurrence elle-même. Chaque nouvelle visite est une visite ordinaire — le texto « En route », la liste de vérification et les positions au pointage fonctionnent exactement comme sur une visite réservée à la main." },
      { q: "Pourquoi mon chantier récurrent n'a-t-il pas de prochaine visite ?", a: "Soit il n'a encore aucune visite (réservez la première), soit une visite future existe déjà (il n'y en a jamais qu'une), soit le chantier est Terminé ou Annulé." },
    ],
  },

  tasks: {
    title: "Tâches",
    summary:
      "La liste de choses à faire interne — relancer un acompte, commander du matériel, rappeler un client — triée selon ce qui fera le plus mal si vous le laissez traîner, avec les tâches que FieldQuo crée pour vous au moment où quelque chose est dû.",
    updated: "2026-09-12",
    intro: [
      "Les tâches sont des rappels internes pour vous et votre équipe. Un chantier est du travail planifié à l'adresse d'un client ; une tâche est l'administration autour — l'appel de suivi, la commande à passer, l'avis à demander. La ligne **À faire** de la barre latérale ouvre la liste.",
      "La liste est triée par urgence plutôt que regroupée par statut, parce que la question avec laquelle on l'ouvre est « qu'est-ce que j'ai laissé traîner ». Les tâches en retard sont en haut quelle que soit leur priorité ; une tâche de faible priorité en retard de deux semaines demande quand même une décision.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Le titre **Tâches**, une ligne en anglais qui dit ce qu'est une tâche, et le nombre de tâches ouvertes. Puis une ligne par tâche : une coche, le titre, une pastille de priorité (**Élevée**, **Urgente** ou **Faible** — **Normale** n'affiche pas de pastille), un badge rouge **en retard** quand l'échéance est passée, la description, la date d'**Échéance**, la personne assignée, le client et un lien vers le chantier. Une tâche qui exige des photos affiche **0/3 photos** ; une tâche qui exige un commentaire affiche **Commentaire requis**." },
          { figure: "live:app-tasks", caption: "Tâches — le nombre de tâches ouvertes, une tâche créée par FieldQuo à l'approbation d'une soumission, et « Afficher les terminées » dessous." },
          { p: "**Afficher les terminées**, en bas, révèle les tâches terminées et annulées ; **Masquer les terminées** les range à nouveau. Cocher une tâche terminée la rouvre." },
        ],
      },
      {
        id: "add-a-task",
        heading: "Comment ajouter une tâche",
        blocks: [
          { steps: [
            "Appuyez sur **Nouvelle tâche**.",
            "Répondez à **Qu'y a-t-il à faire ?** et, au besoin, ajoutez des **Détails à retenir (facultatif)**.",
            "Réglez l'**Échéance**, la **Priorité** (**Faible**, **Normale**, **Élevée**, **Urgente**) et **Assigner à** — **Personne** la laisse à qui voudra la prendre.",
            "**Associer à un chantier (facultatif)**. Une fois un chantier choisi, deux contrôles de plus apparaissent : **Photos requises** (un nombre, jusqu'à 20) et **Commentaire requis**.",
            "Appuyez sur **Ajouter la tâche**.",
          ] },
          { figure: "create:app-tasks-create", caption: "Tâches → Nouvelle tâche — le titre, les détails, l'échéance, la priorité, l'assignation et le lien facultatif vers un chantier." },
          { note: "L'exigence de photos n'est offerte qu'une fois un chantier associé, parce que les photos sont versées à ce chantier. La coche d'une telle tâche refuse tant que les photos et le commentaire n'existent pas ; vous les ajoutez depuis le panneau **Tâches pour ce contrat** de la page du chantier (**Ajouter une photo**, **Commentaire**, **Marquer comme terminée**), pas depuis cette liste." },
        ],
      },
      {
        id: "tasks-fieldquo-creates",
        heading: "Les tâches que FieldQuo crée pour vous",
        blocks: [
          { p: "Quatre moments du parcours laissent quelqu'un redevable d'une action, et FieldQuo écrit la tâche lui-même — une fois par événement, jamais deux. Les titres sont en anglais sur tous les écrans :" },
          { table: {
            head: ["Quand", "La tâche", "Priorité et échéance"],
            rows: [
              ["Un client approuve une soumission", "Schedule the job for {client}", "Élevée, sans échéance"],
              ["Une facture est envoyée", "Follow up payment for {numéro de facture}", "Échéance dans 7 jours ; se résout d'elle-même quand la facture est payée"],
              ["Un chantier a des matériaux à acheter", "Buy materials — {chantier} · 3 of 10 bought", "Élevée ; le compte se met à jour à mesure que vous cochez, et la tâche se ferme quand tout est acheté"],
              ["Un chantier est marqué Terminé", "« Ask {client} for a review » et « Review what “{chantier}” actually cost », les deux en anglais sur l'écran", "Échéance dans 2 jours et dans 3 jours"],
            ],
          } },
          { p: "Chacune est liée à son chantier et à son client. Un chantier saisi comme chantier passé ne crée aucune des deux tâches de fin de chantier." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui voit quoi",
        blocks: [
          { bullets: [
            "**Nouvelle tâche** apparaît pour le propriétaire, les administrateurs et les préréglages Dispatcher et Manager. Assigner une tâche à quelqu'un d'autre demande le même niveau.",
            "Les Crew et les Estimator voient les tâches qui leur sont assignées, celles qu'ils ont créées et celles sans personne — et peuvent cocher celles-là. Ils ne peuvent pas créer de tâche depuis cet écran.",
            "Il n'y a pas de contrôle de suppression sur cet écran. Une tâche est cochée comme terminée ou laissée ouverte.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Où les tâches apparaissent-elles sur le chantier ?", a: "Sous **Tâches pour ce contrat** sur la page du chantier, avec le bouton Marquer comme terminée, le téléversement de photo et la boîte de commentaire quand la tâche les exige." },
      { q: "Les notes du chantier peuvent-elles suggérer des tâches ?", a: "Oui — le panneau « Tasks from the notes » de la page du chantier lit les notes du client, de la soumission et des visites et propose des tâches parmi lesquelles vous choisissez. Voir [[suggested-tasks|Tâches suggérées]]." },
      { q: "Pourquoi une tâche que j'ai cochée est-elle encore ouverte ?", a: "Elle exige des photos ou un commentaire qui n'y sont pas encore. Le badge sur la ligne dit lequel ; ajoutez-les sur la page du chantier." },
    ],
  },

  "suggested-tasks": {
    title: "Tâches suggérées",
    summary:
      "La page du chantier lit les notes du client, de la soumission et des visites et propose les tâches de bureau qu'elles impliquent — chacune citant la phrase d'où elle vient, et rien n'est ajouté tant que vous ne l'avez pas choisie.",
    updated: "2026-09-12",
    intro: [
      "« La barrière arrière est verrouillée, appeler Mme Alvarez la veille. » Quelqu'un l'a écrit dans les notes, et quelqu'un va l'oublier. Le panneau **Tasks from the notes** de la page du chantier transforme des phrases comme celle-là en tâches — et vous montre la phrase, pour que vous voyiez pourquoi chacune est proposée sans fouiller la fiche client et la soumission.",
      "C'est un bouton, pas une automatisation. Il ne dépense rien tant que vous n'appuyez pas et n'écrit rien tant que vous ne cochez pas une suggestion, parce qu'une liste de tâches qui gagne cinq lignes écrites par une machine à chaque chantier est une liste qu'on cesse de lire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il lit, et ce qu'il n'inventera pas",
        blocks: [
          { p: "Le panneau lit trois choses qu'une personne a écrites : les notes du client, les notes de la soumission et les **Notes for the crew** des visites du chantier. Les lignes de la soumission ne servent que de contexte — un nom de service sur la soumission ne devient jamais une tâche." },
          { p: "Chaque suggestion doit citer une phrase réellement présente dans ces notes. Une suggestion dont la citation n'y est pas est écartée avant que vous la voyiez. L'IA a pour consigne de ne pas ajouter de savoir de métier — les étapes de métier vivent dans les [[checklists-on-site|listes de vérification]] — et de ne pas proposer « planifier les travaux » ou « commander les matériaux » à moins que les notes ne le soulèvent. Un résultat vide est un résultat normal." },
        ],
      },
      {
        id: "use-it",
        heading: "Comment l'utiliser",
        blocks: [
          { steps: [
            "Ouvrez le chantier. Le panneau **Tasks from the notes** se trouve sous les visites.",
            "Appuyez sur **Read the notes**. Jusqu'à cinq suggestions apparaissent, chacune avec un titre, la phrase citée, une pastille de priorité et, quand les notes impliquent un délai, **due in N days**.",
            "Cochez celles que vous voulez. Rien n'est coché d'avance.",
            "Appuyez sur **Add … to tasks**. Chacune devient une tâche ordinaire liée à ce chantier et à ce client, avec la phrase d'origine conservée dans sa description. **Dismiss** efface le reste ; **Read again** relance la lecture.",
          ] },
          { note: "Les mots du panneau sont en anglais sur l'écran de toutes les langues aujourd'hui." },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "Ce que veulent dire les messages",
        blocks: [
          { table: {
            head: ["Message", "Ce que ça veut dire"],
            rows: [
              ["Nothing to read yet — this job has no client notes, quote notes or visit notes.", "Écrivez d'abord une note sur le client, la soumission ou une visite."],
              ["Read the notes on this job. Nothing in them needs a task.", "Les notes ont été lues ; elles n'impliquent aucune action. Un constat, pas une panne."],
              ["Nothing reliable to suggest from these notes. Nothing was added.", "Toutes les suggestions ont échoué à la vérification de citation et ont été écartées."],
              ["FieldQuo AI isn't switched on for this deployment.", "L'IA n'est pas configurée ; le reste de la page du chantier fonctionne normalement."],
            ],
          } },
          { p: "Chaque pression consomme l'allocation IA de l'entreprise. Quand elle est épuisée, le bouton le dit et rien n'est lu — voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Suggérer des tâches demande le même niveau que d'en créer une : le propriétaire, les administrateurs, les Dispatcher et les Manager. Il faut aussi que le chantier lui-même vous soit visible. Un membre Crew sur le chantier voit le panneau, mais le bouton refuse." },
        ],
      },
    ],
    faq: [
      { q: "Lit-il tout le dossier du client ?", a: "Non. Seulement le champ de notes du client, les notes de la soumission et les notes pour l'équipe des visites de ce seul chantier — jamais celles d'un autre chantier, jamais celles d'une autre entreprise." },
      { q: "Puis-je modifier une suggestion avant de l'ajouter ?", a: "Pas dans le panneau. Ajoutez-la, puis changez le titre, l'échéance ou la personne assignée sur l'écran des tâches comme pour n'importe quelle tâche." },
    ],
  },

  "checklists-on-site": {
    title: "Listes de vérification sur le chantier",
    summary:
      "Écrivez une fois les étapes que votre équipe répète sous Paramètres → Listes de vérification, mettez-en une copie sur une visite, et l'équipe la coche sur la page du chantier — regroupée en Avant les travaux, Sur le chantier et Avant de partir.",
    updated: "2026-09-12",
    intro: [
      "Masquer les comptoirs, photographier avant, photographier après, faire le tour avec le client. Une liste de vérification, c'est cette liste écrite une fois et apposée sur une visite comme une copie neuve à cocher, pour que personne ne compte sur sa mémoire. L'équipe coche sur son téléphone ; le bureau voit **3/8 checklist items** sur la visite.",
      "Rien ne s'applique à un chantier tout seul. Vous choisissez une liste quand vous planifiez la visite ou vous en ajoutez une après, et les listes de départ de FieldQuo pour vos métiers sont offertes comme suggestions, jamais apposées sur un bon de travail à votre nom.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "**Paramètres → Listes de vérification** s'ouvre sur la ligne « Les étapes standards que votre équipe suit sur le chantier. Attachez-en une à une visite et elle apparaît comme une copie neuve à cocher. » et un bouton **Nouvelle liste de vérification**. Vos propres listes suivent, chacune avec son badge de moment (**Avant les travaux**, **Sur le chantier** ou **Avant de partir**), son nombre d'étapes et son service, avec **Modifier** et **Supprimer la liste**." },
          { figure: "live:app-settings-checklists", caption: "Paramètres → Listes de vérification — « Aucune liste de vérification pour l'instant » au-dessus des listes de départ rédigées pour les métiers que vous avez activés." },
          { p: "Sous **Listes de départ pour vos métiers**, FieldQuo présente des listes toutes faites pour les services que vous avez activés. **Utiliser celle-ci** en copie une dans vos propres listes — une copie, de sorte que la première ligne que vous changez est la vôtre et que rien de partagé n'est réécrit." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "Comment rédiger une liste",
        blocks: [
          { steps: [
            "Appuyez sur **Nouvelle liste de vérification**.",
            "Donnez-lui un **Nom** (l'exemple proposé est « Rénovation de cuisine — jour un ») et choisissez **Pour quel service**, ou laissez **Tout service**.",
            "Choisissez **À quel moment de la visite** : **Avant les travaux** (préparation du chantier et matériaux), **Sur le chantier** (le travail lui-même) ou **Avant de partir** (nettoyage et visite avec le client). Une visite regroupe sa liste sous ces trois titres.",
            "Tapez les **Étapes**, une par ligne, avec **Ajouter une étape** pour en mettre d'autres. Appuyez sur **Créer**.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "Paramètres → Listes de vérification → Nouvelle liste de vérification — le nom, le service, le moment de la visite et les étapes." },
        ],
      },
      {
        id: "put-it-on-a-visit",
        heading: "Comment elle arrive sur une visite",
        blocks: [
          { bullets: [
            "**À la planification.** Le formulaire **Ajouter une visite** a une section **Checklist** : choisissez une ou plusieurs de vos listes ou listes de départ, et la visite reçoit sa propre copie à cocher.",
            "**Après coup.** Sur la page du chantier, sous la visite, **Add a checklist** ouvre le même sélecteur — **Your checklists**, puis **Starter lists for your trades**, avec une recherche dans toute la bibliothèque. Une liste ajoutée ainsi s'ajoute à ce qui est déjà là, et une étape au même libellé n'est pas ajoutée deux fois.",
            "**Sur un chantier récurrent**, la visite suivante reprend la liste de la visite précédente.",
          ] },
          { p: "L'équipe coche les éléments sur la page du chantier, regroupés par moment ; chaque coche s'enregistre d'elle-même et le compte **3/8 checklist items** de la visite bouge avec elle." },
          { note: "Le sélecteur de listes sur la page du chantier et sur le formulaire Ajouter une visite est en anglais sur l'écran de toutes les langues aujourd'hui." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que modifier et supprimer changent",
        blocks: [
          { bullets: [
            "**Modifier** ne change que le modèle. Les visites qui en portent déjà une copie gardent la copie qu'elles ont.",
            "**Supprimer la liste** retire le modèle et ne retire jamais de travail d'une visite déjà planifiée.",
            "**Utiliser celle-ci** sur une liste de départ l'ajoute à vos propres listes ; la liste de départ reste offerte.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Rédiger, modifier et supprimer des modèles est réservé au propriétaire, aux administrateurs et aux préréglages Dispatcher et Manager ; la ligne **Listes de vérification** est masquée pour tous les autres. Cocher sur une visite revient à la personne qui y est assignée — ou à quiconque a le domaine Schedule au niveau **Edit everyone's schedule** — et une visite sans personne assignée peut être cochée par quiconque voit le chantier." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une nouvelle visite n'a-t-elle pas de liste ?", a: "Parce qu'aucune n'a été choisie. Appliquer une liste est un choix, pas un défaut — ajoutez-en une depuis le formulaire Ajouter une visite ou avec Add a checklist sur la page du chantier." },
      { q: "D'où viennent les listes de départ ?", a: "FieldQuo les rédige par métier et ne montre que celles des services que vous avez activés. Prenez-en une copie et retirez ce qui ne vous convient pas." },
      { q: "Un élément peut-il exiger une photo ou une mesure ?", a: "Une étape est une coche. Les listes de type inspection de la bibliothèque affichent le critère d'acceptation, la norme citée et « Photo expected » à côté d'une étape, mais il n'y a pas de case pour une lecture aujourd'hui — la photo va sur la visite." },
    ],
  },

  "job-photos-and-tags": {
    title: "Photos de chantier et étiquettes",
    summary:
      "Chaque photo d'un chantier est classée par étape — avant, en cours, terminé, problème — avec vos propres étiquettes par-dessus ; une étoile la met sur votre site web, et les photos de problème ne deviennent jamais publiques.",
    updated: "2026-09-12",
    intro: [
      "Un mur de photos sans date, c'est une boîte à chaussures. Regroupées par étape, les mêmes photos deviennent le dossier d'un chantier — à quoi ça ressemblait à l'arrivée de l'équipe, le travail en cours, le résultat fini — et l'avant-après d'un chantier est ce qui fait gagner le suivant à un peintre.",
      "Deux choses décrivent une photo. Son **étape** est une logique fixe du produit : **Before / start**, **In progress**, **Finished** et **Issue / snag** (avant, en cours, terminé, problème) pilotent la paire avant-après de votre site web et gardent une photo de problème hors de celui-ci. Les **étiquettes** sont vos propres mots — ponçage, apprêt, finition, démolition — posés par-dessus, sans toucher à rien de cela.",
    ],
    sections: [
      {
        id: "overview",
        heading: "D'où viennent les photos",
        blocks: [
          { bullets: [
            "**Téléversées sur la page du chantier.** Le panneau **Job photos** en prend jusqu'à 12 à la fois. Elles sont classées **In progress** — changez l'étape de n'importe quelle photo une fois arrivée.",
            "**Envoyées par texto à votre ligne d'équipe.** Une photo envoyée par texto arrive sur le chantier avec une étape devinée d'après les mots du message : « all done » la classe comme terminée, « before we start » comme avant, « leak » ou « damage » comme problème, tout ce qui est flou comme en cours. C'est une suggestion que vous pouvez changer, et une photo textée arrive sans étiquette. Voir [[the-crew-inbox|La boîte de l'équipe]].",
          ] },
          { p: "Quiconque voit le chantier peut y ajouter des photos, les Crew compris." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "Ce que vous pouvez faire sur la page du chantier",
        blocks: [
          { bullets: [
            "**Étoiler** une photo pour l'afficher sur votre site web ; le panneau compte combien sont **on your website**. Une photo **Before / start** et une photo **Finished** du même chantier deviennent un avant-après. Une photo **Issue / snag** ne peut pas être étoilée — le bouton le dit au lieu de ne rien faire en silence.",
            "**Changer l'étape** avec la liste déroulante sous la photo.",
            "**Cocher des étiquettes** sous la photo. Une étiquette retirée s'affiche encore, déjà cochée, sur une photo qui la portait — elle n'est simplement plus proposée sur les nouvelles.",
            "**Comments** et **Add markup** (dessiner sur la photo) sont aussi sur chaque photo.",
            "**Photo record** liste chaque photo datée et regroupée par étape, photos de problème comprises, avec **Filtrer par étiquette** et **Download photo report** — un PDF pour un client, un assureur ou un litige.",
          ] },
          { note: "Étoiler, changer l'étape, étiqueter et annoter demandent le domaine Jobs au niveau **View, create, and edit**. Téléverser et commenter fonctionnent au niveau **View only**, de sorte qu'un membre Crew verse des photos et laisse des commentaires, mais ne fait pas le tri." },
        ],
      },
      {
        id: "manage-tags",
        heading: "Comment créer vos étiquettes",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Étiquettes des photos de chantier** (ou **Gérer les étiquettes** depuis la page du chantier).",
            "Sous **Ajouter une étiquette**, tapez un **Nom de l'étiquette**, choisissez une **Couleur** et appuyez sur **Ajouter l'étiquette**.",
            "Ou appuyez sur **Ajouter les étiquettes de départ** pour prendre l'ensemble générique — Demo, Prep, Sanding, Priming, Installing, Top coat, Punch list, Touch-up, en anglais. Rien n'est ajouté tant que vous n'appuyez pas.",
            "Ordonnez la liste avec **Monter** et **Descendre** ; c'est l'ordre dans lequel la page du chantier les propose.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Paramètres → Étiquettes des photos de chantier — le formulaire Ajouter une étiquette avec ses pastilles de couleur, et les étiquettes de départ dessous." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Retirer une étiquette",
        blocks: [
          { p: "Il n'y a pas de suppression sur cet écran, exprès. **Retirer** masque une étiquette du sélecteur sur les nouvelles photos ; chaque photo qui la porte déjà la garde, inchangée. **Réactiver** la remet dans le sélecteur. Une étiquette nommée « Issue » se comporte exactement comme une étiquette nommée « Sanding » — la règle de confidentialité appartient à l'étape, et une étiquette n'a aucun moyen de l'atteindre." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne de réglages **Étiquettes des photos de chantier** est réservée au propriétaire, aux administrateurs et aux préréglages Dispatcher et Manager. Les photos d'un chantier suivent le chantier : un membre Crew voit les photos des chantiers qui lui sont assignés." },
        ],
      },
    ],
    faq: [
      { q: "Une photo peut-elle se retrouver sur mon site web par accident ?", a: "Seule une photo étoilée y apparaît, et une photo Issue / snag ne peut pas être étoilée. Le site web revérifie l'étape quand il construit la galerie." },
      { q: "Une étiquette change-t-elle ce que le site web affiche ?", a: "Non. Les étiquettes servent à filtrer, et à vous ; le site web ne lit que l'étape et l'étoile." },
      { q: "Puis-je supprimer une photo ?", a: "Il n'y a pas de contrôle de suppression pour une photo de chantier aujourd'hui. Reclassez-la Issue / snag pour la garder hors du site web." },
    ],
  },

  "job-notes": {
    title: "Notes sur un chantier",
    summary:
      "Trois endroits où des mots vivent sur un chantier — les notes pour l'équipe sur chaque visite, le journal de chantier pour chaque journée sur place, et les notes du client et de la soumission que le chantier lit — et qui peut écrire chacun.",
    updated: "2026-09-12",
    intro: [
      "La fiche du chantier elle-même n'a pas de boîte de notes libres. Ce qu'un chantier porte est écrit là où ça appartient : un mot sur la visite pour la personne qui s'y rend, un journal pour chaque journée où l'équipe était sur place, et les notes déjà sur le client et la soumission, que le chantier lit quand il suggère des tâches.",
      "Cet article dit où se trouve chacune, qui peut l'écrire, et ce qui la lit ensuite.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Les trois sortes",
        blocks: [
          { table: {
            head: ["Où", "À quoi ça sert", "Ce qui la lit"],
            rows: [
              ["Notes pour l'équipe, sur une visite", "Le mot avant le déplacement : code de barrière, où stationner, qui demander", "Affichées sous la visite sur la page du chantier ; lues par Tasks from the notes"],
              ["Journal de chantier, un par jour sur le chantier", "Ce qui s'est passé, qui était là, combien de temps, la météo, les retards", "Les Journées récentes de la page du chantier ; consultable par le bureau"],
              ["Les notes du client et les notes de la soumission", "Ce que le bureau sait du client et de la vente", "Lues par Tasks from the notes"],
            ],
          } },
        ],
      },
      {
        id: "notes-for-the-crew",
        heading: "Les notes pour l'équipe sur une visite",
        blocks: [
          { p: "Le formulaire **Ajouter une visite** a une boîte **Notes for the crew** (en anglais sur tous les écrans aujourd'hui) — l'exemple proposé est « Gate code, where to park, who to ask for ». La note apparaît sous la date et le statut de la visite sur la page du chantier, où la personne qui s'y rend la lit avant de partir." },
          { p: "Une fois la visite créée, la note peut être changée par la personne à qui la visite est assignée, ou par quiconque a le domaine Schedule au niveau **Edit everyone's schedule**. Une visite sans personne assignée peut être modifiée par quiconque voit le chantier." },
        ],
      },
      {
        id: "the-daily-log",
        heading: "Le journal de chantier",
        blocks: [
          { p: "Le panneau **Journal de chantier** de la page du chantier tient une entrée par jour : **Ce qui s'est passé aujourd'hui**, puis, en option, **Personnes sur place**, **Heures sur place**, **Météo** et **Retards ou blocages**. Il s'enregistre tout seul pendant que vous écrivez, et **Journées récentes** liste les entrées précédentes." },
          { steps: [
            "Sur la page du chantier, ouvrez **Journal de chantier**. **Aujourd'hui** est sélectionné ; choisissez **Hier** ou **Choisir une journée** pour rédiger une journée après coup — remplir le journal d'hier à six heures du matin est normal et ne crée pas un deuxième mardi.",
            "La boîte commence avec ce que FieldQuo sait déjà de la journée — les photos versées et les tâches terminées — pour que vous complétiez au lieu de retaper.",
            "Écrivez. **Enregistré** apparaît quand c'est sauvegardé ; **Pas encore enregistré** tant que ça ne l'est pas.",
          ] },
          { warning: "Si deux personnes ont la même journée ouverte, le deuxième enregistrement est refusé plutôt que d'écraser le premier. Les mots restent à l'écran, non enregistrés, et la personne décide. Rien n'est fusionné ni perdu en silence." },
          { p: "Quiconque voit le chantier peut écrire son journal, les Crew compris — ce sont eux qui sont sur place." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut les lire",
        blocks: [
          { p: "La lecture suit le domaine Jobs : un membre Crew lit les notes de visite et les journaux des chantiers qui lui sont assignés et rien d'autre. Les notes du client sont sur la fiche client, qu'un membre Crew n'ouvre pas. Le réglage **Notes** de la grille d'accès ne restreint aucune de ces notes aujourd'hui — qui lit les notes d'un chantier est décidé par le niveau Jobs." },
        ],
      },
    ],
    faq: [
      { q: "Où est-ce que j'écris une note sur le chantier dans son ensemble ?", a: "Sur la visite si c'est pour l'équipe, dans le journal si c'est au sujet d'une journée, sur la fiche client si c'est au sujet du client. La fiche du chantier n'a pas de champ de notes à elle." },
      { q: "Le client peut-il voir quelque chose de tout cela ?", a: "Non. Les notes de visite, les journaux et les notes du client sont internes ; rien de cette page n'atteint une soumission, une facture ou le portail." },
    ],
  },

  "work-areas": {
    title: "Zones de travail",
    summary:
      "Des zones nommées — Laval, l'île de Montréal, la Rive-Nord — avec une pastille par membre de l'équipe ; les noms disent aussi à votre site web et à votre réceptionniste IA où vous travaillez.",
    updated: "2026-09-12",
    intro: [
      "Une zone de travail est un territoire ou un projet nommé avec les personnes qui y sont assignées. Elle répond à « c'est le secteur de qui », et son nom est réutilisé là où l'extérieur demande où vous travaillez : le bloc **Areas we serve** de votre site web et ce que le réceptionniste téléphonique dit aux gens qui appellent.",
      "Cet article dit ce qu'une zone de travail fait aujourd'hui et, tout aussi clairement, ce qu'elle ne fait pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "**Paramètres → Zones desservies** s'ouvre sur le titre **Zones de travail**, la ligne « Regroupez les tâches par projet ou par zone. Les noms que vous inscrivez ici servent aussi à dire où vous travaillez sur votre site web public et dans ce que votre réceptionniste IA répond aux appels. », une boîte **Nom de la nouvelle zone de travail** avec un bouton plus, puis une carte par zone avec une pastille pour chaque membre de l'équipe. Une pastille pleine veut dire que la personne est assignée." },
          { figure: "live:app-settings-work-areas", caption: "Paramètres → Zones de travail — la boîte Nom de la nouvelle zone de travail, avant qu'aucune zone n'existe." },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "Comment en ajouter une et y assigner des gens",
        blocks: [
          { steps: [
            "Tapez un nom dans **Nom de la nouvelle zone de travail** et appuyez sur le plus.",
            "Sur la carte de la zone, touchez la pastille d'une personne pour l'assigner ; touchez-la à nouveau pour la retirer. Chaque touche s'enregistre.",
          ] },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Ce qu'une zone de travail change",
        blocks: [
          { bullets: [
            "**Votre site web.** Le bloc **Areas we serve** liste les noms de vos zones, en ordre alphabétique, jamais une liste de villes tapée à la main qui finit périmée. Voir [[website-pages-and-blocks|Pages et blocs du site web]].",
            "**Le réceptionniste téléphonique.** Les noms font partie de ce qu'il sait, pour qu'il puisse dire à quelqu'un qui appelle si vous couvrez sa ville. Voir [[the-phone-receptionist|Le réceptionniste téléphonique]].",
            "**Les pastilles d'assignation** sont un registre de qui est sur quelle zone. Aujourd'hui, aucun autre écran ne les lit — rien ne filtre les chantiers, les tâches ou le calendrier par zone de travail, et un chantier n'en porte pas.",
          ] },
          { note: "Une zone ne peut pas être renommée ni retirée depuis cet écran aujourd'hui. Choisissez le nom tel que vous voulez le publier." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Créer une zone et changer qui y est assigné est réservé au propriétaire, aux administrateurs et aux préréglages Dispatcher et Manager, et la ligne de réglages n'apparaît que pour eux. Quiconque d'autre ouvre la page voit une liste en lecture seule — « Voici les zones auxquelles vous pouvez être assigné. » — avec des noms au lieu de boutons." },
        ],
      },
    ],
    faq: [
      { q: "Une zone de travail change-t-elle qui se fait réserver ?", a: "Non. La réservation suit les heures réservables de chaque personne et la page de réservation, pas ses zones de travail." },
      { q: "Dois-je ajouter des zones pour que le site web montre où je travaille ?", a: "Oui — le bloc Areas we serve est construit uniquement à partir de ces noms. Sans zone, le bloc n'a rien à montrer." },
    ],
  },

  "the-scheduler-and-crew-shifts": {
    title: "L'horaire : préparer et publier la semaine de l'équipe",
    summary:
      "Attribuer les quarts place une personne sur une journée avec un début, une fin et une note ; les quarts restent en brouillon, invisibles pour l'équipe, jusqu'à ce que vous appuyiez sur Publier la semaine, et FieldQuo vous avertit quand un quart tombe hors des heures de quelqu'un ou sur un congé approuvé.",
    updated: "2026-09-12",
    intro: [
      "**Attribuer les quarts** dans la barre latérale ouvre **Horaire** : la semaine de l'équipe en sept cartes, du dimanche au samedi. Vous préparez les quarts, passez d'une semaine à l'autre et publiez une fois. Tant que vous n'avez pas publié, l'équipe ne voit rien — une semaine à moitié faite n'atterrit jamais sur le téléphone de quelqu'un.",
      "Un quart, ce sont les heures d'une personne, pas un déplacement à une adresse. Les visites vivent sur le chantier et le calendrier ; les quarts disent qui travaille quand.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Le titre **Horaire** et la ligne « Ajoutez les quarts de la semaine, puis cliquez sur Publier pour que votre équipe les voie — les quarts restent masqués jusqu'à la publication. » Puis **Semaine précédente**, **Cette semaine**, **Semaine suivante** et la plage de dates ; **Ajouter un quart** ; **Publier la semaine** dès qu'un brouillon existe ; et sept cartes de journée, chacune avec un plus, **Aujourd'hui** sur la journée courante et **Aucun quart planifié.** quand elle est vide. Une ligne de quart montre la personne, les heures, la note, un badge **Brouillon** tant qu'il n'est pas publié, et un ✕ pour ceux qui peuvent supprimer." },
          { figure: "live:app-scheduler", caption: "Horaire — les sept cartes de la semaine, Ajouter un quart, et l'avis ambre indiquant qu'un membre de l'équipe n'a pas d'heures de travail définies." },
          { p: "Une bannière ambre nomme quiconque n'a pas d'heures de travail : « Aucune heure de travail définie pour … Tant qu'il n'y en a pas, rien ne signale un quart à une heure inhabituelle pour ces personnes et la paie n'a rien pour vérifier les heures qu'elles inscrivent. » **Définir leurs heures** mène directement à leurs Disponibilités." },
        ],
      },
      {
        id: "add-and-publish",
        heading: "Comment préparer et publier une semaine",
        blocks: [
          { steps: [
            "Appuyez sur **Ajouter un quart** (ou sur le plus d'une carte de journée).",
            "Dans **Nouveau quart**, choisissez l'**Intervenant**, la **Date**, le **Début** et la **Fin**, et une **Note (facultatif)** — l'exemple proposé est « ex. adresse du chantier, quoi apporter ». Il n'y a pas de sélecteur de chantier sur un quart ; mettez le chantier dans la note.",
            "Appuyez sur **Ajouter au brouillon**. Le quart apparaît sur sa journée avec un badge **Brouillon**.",
            "Répétez pour la semaine, puis appuyez sur **Publier la semaine**. Chaque quart en brouillon de la semaine devient visible pour les personnes concernées.",
          ] },
          { note: "Publier affiche les quarts sur l'écran Attribuer les quarts de chaque personne — « Voici les quarts publiés par votre gestionnaire. Revenez pour les changements. » Rien n'est envoyé par courriel ni par texto." },
        ],
      },
      {
        id: "what-fieldquo-checks",
        heading: "Ce que FieldQuo vérifie quand vous ajoutez un quart",
        blocks: [
          { table: {
            head: ["Le quart tombe…", "Ce qui se passe"],
            rows: [
              ["Hors des heures où la personne s'est dite disponible", "Le formulaire s'arrête : « Vérifiez avec la personne avant de poursuivre — elle n'a pas encore accepté. » Vous pouvez donner une raison sous **Pourquoi ?** et appuyer sur **Planifier quand même** ; le quart est alors marqué **En dehors des disponibilités déclarées**, et la personne le voit à la publication."],
              ["Sur un congé approuvé", "Bloqué. « Changez la date, ou modifiez d'abord leur congé. » Un congé approuvé est une décision déjà prise, et il n'y a pas de contournement."],
              ["Hors de ses heures de travail habituelles", "Enregistré, avec un avertissement après **Quart ajouté.** Les heures supplémentaires ne sont pas une erreur."],
              ["Sur quelqu'un sans aucune heure définie", "Enregistré. Le silence n'est pas un refus — la bannière vous invite à définir ses heures."],
            ],
          } },
          { p: "Disponibilités, heures de travail et congés sont trois choses différentes — voir [[working-hours-and-bookable-hours|Heures de travail et heures réservables]] et [[time-off-requests|Demandes de congé]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut faire quoi",
        blocks: [
          { bullets: [
            "**Ajouter un quart** et **Publier la semaine** demandent le domaine Schedule au niveau **Edit everyone's schedule** — les Dispatcher, les Manager, le propriétaire et les administrateurs.",
            "**Supprimer un quart** (le ✕) demande **Edit and delete everyone's schedule** — les Manager, le propriétaire et les administrateurs. Un Dispatcher prépare et publie, mais ne supprime pas.",
            "**Les Crew et les Estimator** ouvrent la même ligne et ne voient que leurs propres quarts publiés, avec la note que leur gestionnaire les publie.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je dépublier une semaine ?", a: "Pas depuis l'écran. Supprimez le quart erroné et ajoutez le bon ; le nouveau est en brouillon jusqu'à ce que vous publiiez de nouveau." },
      { q: "Un quart met-il quelque chose au calendrier du client ?", a: "Non. Les quarts sont internes. Le client est informé des visites, jamais des quarts." },
      { q: "Pourquoi puis-je ajouter un quart un dimanche ?", a: "Les heures de travail ne font qu'avertir ; elles ne bloquent pas. Seul un congé approuvé bloque." },
    ],
  },

  "the-team-schedule": {
    title: "L'horaire de l'équipe",
    summary:
      "Une page pour toute l'équipe : une carte par personne avec ses heures réservables du lundi au dimanche et ce qui est réservé sur elle dans les deux prochaines semaines, avec un bouton Modifier les heures pour les gestionnaires.",
    updated: "2026-09-12",
    intro: [
      "**Calendrier de l'équipe** dans la barre latérale ouvre **Horaire de l'équipe** — la réponse du propriétaire à « qui est réservable quand ». Tout le monde est sur une seule page, alors un gestionnaire corrige les heures de n'importe qui d'ici au lieu de le demander à chacun.",
      "C'est une vue d'ensemble en lecture seule. Les heures se modifient sur les Disponibilités de chaque personne ; les visites, les rendez-vous et les quarts se créent ailleurs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Le titre **Horaire de l'équipe** et la ligne « Les disponibilités hebdomadaires de chacun et ce qui est réservé dans les deux prochaines semaines. Chacun peut fixer ses propres heures sous Réglages → Disponibilités, et vous pouvez fixer celles de n'importe qui d'ici. » Puis une carte par personne : ses initiales, son nom et son palier (Owner, Administrator, Manager ou Worker — en anglais sur tous les écrans), une bande de sept jours avec des heures comme **08:00–17:00** et **—** les jours de congé, **Aucune disponibilité définie** quand rien n'a été saisi, et **Modifier les heures** ou **Fixer les heures**. Sous la bande, **Prochaines 2 semaines** liste ce sur quoi la personne est réservée, par date, heure et client." },
          { figure: "harness:team-schedule", caption: "Horaire de l'équipe — une carte par personne, la bande lundi-dimanche des heures réservables, Modifier les heures, et les deux prochaines semaines de réservations." },
          { p: "Les personnes qui ont des heures définies viennent en premier, puis les autres par nom. La semaine commence le jour choisi dans les préférences de votre entreprise." },
        ],
      },
      {
        id: "what-the-strip-shows",
        heading: "Ce que la bande et la liste montrent vraiment",
        blocks: [
          { bullets: [
            "**La bande, ce sont les heures réservables** — la plage dans laquelle les clients peuvent réserver cette personne, depuis **Paramètres → Disponibilités → Heures réservables**. Ce ne sont ni ses heures de travail, ni ses quarts.",
            "**Prochaines 2 semaines** liste les rendez-vous assignés à cette personne et les réservations faites par la page de réservation, pour les 14 prochains jours. Les visites de chantier et les quarts publiés n'y sont pas.",
          ] },
          { note: "Un estimateur qui travaille de 8 h à 16 h mais ne prend des consultations que de 14 h à 16 h affiche **14:00–16:00** ici. C'est juste : la page répond à quand les clients peuvent le réserver. Voir [[working-hours-and-bookable-hours|Heures de travail et heures réservables]]." },
        ],
      },
      {
        id: "edit-someones-hours",
        heading: "Comment fixer les heures de quelqu'un d'ici",
        blocks: [
          { steps: [
            "Appuyez sur **Modifier les heures** (ou **Fixer les heures**) sur sa carte.",
            "Sa page Disponibilités s'ouvre avec cette personne sélectionnée. Changez les **Heures de travail** et les **Heures réservables** et enregistrez.",
            "Revenez : la bande reflète les nouvelles heures réservables.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Calendrier de l'équipe** apparaît pour le propriétaire, les administrateurs et les préréglages Dispatcher et Manager — les personnes qui peuvent voir toute la liste du personnel. **Modifier les heures** apparaît pour les mêmes personnes. Les Crew et les Estimator n'ont pas la ligne ; ils fixent leurs propres heures sous **Paramètres → Disponibilités**." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une visite que j'ai planifiée n'est-elle pas sous Prochaines 2 semaines ?", a: "La liste montre les rendez-vous et les réservations de la page de réservation. Les visites de chantier sont sur le chantier et sur le Calendrier." },
      { q: "Quelqu'un affiche Aucune disponibilité définie — les clients peuvent-ils le réserver ?", a: "Non. Les heures réservables sont ce que la page de réservation offre ; sans elles, la personne n'est pas proposée. Appuyez sur Fixer les heures." },
    ],
  },

  "the-time-clock": {
    title: "La pointeuse",
    summary:
      "Le pointage de l'équipe : pointer l'entrée sur le chantier où l'on est, changer de chantier en cours de journée, pointer la sortie et voir les heures du jour — avec une position saisie au moment du pointage pour que la feuille de temps puisse montrer à quelle distance du chantier il a été fait.",
    updated: "2026-09-12",
    intro: [
      "**Pointeuse** est le seul écran qu'un travailleur à l'heure touche à chaque quart, alors il reste dépouillé : la date, une horloge en direct, un gros bouton, le total du jour. Chaque touche écrit une simple entrée de temps qui va au gestionnaire pour révision sur les feuilles de temps — aucun calcul de paie ne se fait ici.",
      "Chaque entrée peut nommer le chantier sur lequel elle a été travaillée, ce qui permet aux coûts de chantier de savoir ce que la main-d'œuvre d'un chantier a vraiment coûté. Une heure sans chantier — déplacement, cour, une matinée de soumissions — est une vraie heure et est enregistrée exactement comme telle.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Le jour et l'horloge en direct. Dessous, soit **Vous êtes hors service.** avec un sélecteur **Quel chantier?** et un bouton vert **Pointer l'entrée**, soit une pastille **En service** avec **Depuis {heure}**, le temps écoulé, **Sur {chantier}** et un bouton rouge **Pointer la sortie**. Pendant que vous êtes en service, **Vous avez changé de chantier?** offre un second sélecteur et **Changer de chantier**. Dessous, **Aujourd'hui** totalise les heures du jour et liste chaque entrée, celle en cours marquée **En cours**, avec la ligne « Vos heures sont transmises à votre gestionnaire pour révision et approbation. »" },
          { figure: "live:app-clock", caption: "Pointeuse — hors service, le sélecteur Quel chantier? sur « Aucun chantier — déplacement, cour, soumissions », et le bouton Pointer l'entrée." },
        ],
      },
      {
        id: "clock-in-and-out",
        heading: "Comment pointer l'entrée, changer de chantier et pointer la sortie",
        blocks: [
          { steps: [
            "Choisissez le chantier sous **Quel chantier?**. Si vous avez une visite prévue aujourd'hui, elle est déjà sélectionnée (« Vous êtes prévu ici aujourd'hui — changez-le si vous êtes ailleurs. ») ; s'il y en a plusieurs, choisissez celle que vous commencez ; s'il n'y en a aucune, choisissez un chantier sous **Vos autres chantiers en cours** ou laissez **Aucun chantier — déplacement, cour, soumissions**.",
            "Appuyez sur **Pointer l'entrée**. Si le navigateur demande où est votre téléphone, c'est la position unique conservée à côté de ce pointage — dites oui ou non ; le pointage est enregistré dans les deux cas.",
            "Changé de chantier ? Sous **Vous avez changé de chantier?**, choisissez le nouveau chantier et appuyez sur **Changer de chantier**. Les heures faites jusque-là restent sur le premier chantier et une nouvelle entrée commence maintenant.",
            "Appuyez sur **Pointer la sortie** à la fin. L'entrée se ferme et apparaît sous **Aujourd'hui**.",
          ] },
          { note: "Une seule entrée ouverte à la fois. Pointer l'entrée quand on est déjà en service est refusé avec « You're already clocked in — clock out first. » Une sortie oubliée se corrige sur les feuilles de temps — voir [[timesheets-and-approving-hours|Feuilles de temps : réviser et approuver les heures]]." },
        ],
      },
      {
        id: "location",
        heading: "Ce qu'est la position au pointage, et ce qu'elle n'est pas",
        blocks: [
          { p: "Quand vous appuyez sur **Pointer l'entrée** ou **Pointer la sortie**, le téléphone est interrogé sur sa position — une seule fois, avec votre permission par l'invite du téléphone lui-même — et cette position est conservée à côté du pointage. Rien ne tourne en arrière-plan et rien n'est suivi entre deux pointages ; un navigateur ne peut pas le faire, et FieldQuo ne prétend pas le faire." },
          { bullets: [
            "Sur les feuilles de temps, le pointage affiche **Sur place** quand il a été fait à moins d'environ 250 m de l'adresse du chantier, ou **à 2,1 km** quand ce n'était pas le cas — une question pour le gestionnaire, pas un verdict.",
            "Aucune position n'est affichée quand le téléphone n'a pas répondu, que le chantier n'a pas d'adresse ou que la lecture était trop imprécise pour être fiable.",
            "Refuser la permission ne change rien au pointage. La réponse est retenue pour la session ; on ne vous redemande pas au pointage suivant.",
          ] },
        ],
      },
      {
        id: "what-happens-to-the-hours",
        heading: "Où vont les heures",
        blocks: [
          { bullets: [
            "Chaque entrée est **en attente** jusqu'à ce qu'un gestionnaire l'approuve sur les **Feuilles de temps** ; les heures approuvées alimentent la paie.",
            "Les heures sur un chantier alimentent les coûts de ce chantier comme main-d'œuvre. Les heures sans chantier sont comptées et nommées comme non attribuées sur le panneau des coûts plutôt que perdues. Voir [[job-costing|Coûts de chantier : soumis contre réel]].",
            "Corriger votre propre entrée la renvoie en attente pour qu'elle soit révisée à nouveau.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Quiconque a une fiche d'intervenant, à tous les niveaux d'accès — la pointeuse est limitée à la personne connectée et personne ne peut pointer pour quelqu'un d'autre. Sans fiche d'intervenant, l'écran dit « Vous n'êtes pas encore configuré comme intervenant. Demandez à un administrateur de vous ajouter sous Équipe. »" },
        ],
      },
    ],
    faq: [
      { q: "Ai-je besoin de l'application ?", a: "Non. La pointeuse est une page web qui fonctionne sur n'importe quel téléphone. Voir [[clock-in-and-out-on-your-phone|Pointer l'entrée et la sortie sur votre téléphone]]." },
      { q: "FieldQuo suit-il où je suis pendant la journée ?", a: "Non. Il demande une position au moment où vous appuyez, si vous le permettez, et rien entre les deux." },
      { q: "J'ai oublié de pointer la sortie hier.", a: "L'entrée est encore ouverte. Pointez la sortie maintenant, puis prévenez votre gestionnaire — les heures se corrigent sur les feuilles de temps avant d'être approuvées." },
    ],
  },
};
