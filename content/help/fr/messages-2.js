// content/help/fr/messages-2.js
//
// Partie 2 de la catégorie « messages » en français (voir le composeur,
// messages.js). Slugs de cette partie (lib/help/tree.js) :
// follow-up-rules, notifications-for-you, send-from-your-own-domain,
// the-phone-receptionist, the-receptionist-call-log, quote-callbacks,
// the-crew-inbox, team-chat, texting-clients-what-is-and-is-not-automated.
//
// Même structure que l'anglais (mêmes sections, mêmes blocs, mêmes figures);
// les mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js. Les
// chiffres sont les constantes du code (35 ¢ la minute, 4 $ et 9 $ de
// location, 2 ¢ le texto, 5 ¢ la photo, 30 minutes gratuites).
export const ARTICLES = {
  "follow-up-rules": {
    title: "Règles de relance",
    summary:
      "Relancer par courriel une soumission restée sans réponse, une facture en retard ou un chantier terminé, automatiquement, après le délai de votre choix — et ce qui arrête chaque règle.",
    updated: "2026-09-12",
    intro: [
      "Une règle de relance tient en une phrase : un certain temps après qu'une soumission, une facture ou un chantier atteint un état donné, envoyer ce gabarit de courriel. FieldQuo vérifie chaque règle active une fois par jour et envoie le gabarit au client de tout ce qui a franchi la ligne — une soumission envoyée depuis trois jours, une facture en retard de cinq jours, un chantier terminé depuis deux jours — sans que personne ait à y penser.",
      "Cet article couvre l'écran **Paramètres → Relances** : les trois déclencheurs, le délai, les gabarits qu'une règle peut envoyer, ce qui la met en pause et l'arrête, et qui ne reçoit rien.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque règle envoie exactement une chose, par un seul canal : un gabarit de courriel. Il n'y a ni relance par texto ni tâche dans l'application — l'écran dessine une seule étape **Envoyer un courriel** parce que c'est la seule qui existe. Deux règles peuvent partager un déclencheur (un rappel doux à 3 jours, un plus ferme à 7), chacune pointant vers un gabarit différent, et chaque soumission, facture ou chantier reçoit le courriel de chaque règle une fois, pas plus." },
          { p: "Le courriel part au nom de votre entreprise — depuis votre propre domaine vérifié si vous en avez un (voir [[send-from-your-own-domain|Envoyer les courriels depuis votre propre domaine]]), sinon depuis l'adresse partagée de FieldQuo — et les réponses vont au courriel de votre entreprise, ou à défaut à l'adresse du propriétaire du compte, pour qu'aucune réponse ne se perde." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "La page s'intitule **Relances** — « Envoyez automatiquement un gabarit un certain temps après qu'une soumission, une facture ou un chantier atteint un état donné — sans rappels manuels. » De haut en bas :" },
          { bullets: [
            "**Comment tout cela s’exécute** — un schéma en lecture seule tiré de vos règles : **Déclencheur** → **Attendre …** → **Envoyer un courriel** → **Arrêt**. Il est généré à partir de la liste, pas dessiné à la main, donc il ne peut pas contredire ce que font les règles. Il n'apparaît qu'une fois que vous avez au moins une règle.",
            "La liste des règles — une ligne par règle : son nom, puis « 3 jours **après** Soumission envoyée, sans réponse → Follow-up email (default) », puis les deux phrases de sortie (« S’arrête dès que le client accepte ou refuse la soumission. » « Chaque soumission reçoit ce courriel une seule fois. »). Une règle en pause porte la pastille **En pause**.",
            "**Mettre en pause** / **Activer** et l'icône de corbeille sur chaque ligne. Mettre en pause garde la règle et la saute; supprimer l'enlève.",
            "**Nouvelle règle** en haut à droite — grisé, avec une explication, tant que vous n'avez pas au moins un gabarit de courriel de relance, de marketing ou personnalisé à envoyer.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "Créer une règle",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Relances** et appuyez sur **Nouvelle règle**. Si le bouton est désactivé, la ligne jaune au-dessus dit pourquoi : il vous faut d'abord un gabarit de relance, de marketing ou personnalisé sous **Modèles de courriel**. Chaque nouvelle entreprise a déjà un gabarit « Follow-up email (default) », donc c'est rare.",
            "Donnez-lui un **Nom de la règle (facultatif)** — laissé vide, la règle prend le nom du déclencheur.",
            "Choisissez le **Déclencheur** : **Soumission envoyée, sans réponse**, **Facture en retard** ou **Chantier terminé**. La phrase sous la liste dit exactement quand chacun se déclenche.",
            "Réglez le **Délai** et son **Unité** (heures ou jours). Choisir un déclencheur remplit sa valeur par défaut — 3 jours pour une soumission, 5 jours pour une facture, 2 jours pour un chantier terminé — et vous pouvez la changer.",
            "Choisissez le **Gabarit à envoyer** et appuyez sur **Créer la règle**. La règle est active tout de suite et le schéma au-dessus de la liste se redessine.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Paramètres → Relances — le schéma Comment tout cela s’exécute tiré des règles, puis la liste des règles avec Mettre en pause et la corbeille sur chaque ligne." },
          { note: "Les noms des déclencheurs dans la liste déroulante — Quote sent, no response; Invoice overdue; Job completed — s'affichent en anglais quelle que soit votre langue de travail. Le schéma et la liste des règles, eux, les traduisent." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que change chaque réglage",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il change"],
            rows: [
              ["**Déclencheur**", "Quels dossiers la règle surveille et ce qui compte comme franchir la ligne : une soumission encore à l'état envoyé, une facture impayée passée sa date d'échéance, ou un chantier marqué terminé (à compter du moment où il a été terminé, pas de sa dernière modification)."],
              ["**Délai** et **Unité**", "Combien de temps le dossier doit être resté dans cet état avant que le courriel parte. Tout ce qui n'est pas en heures est traité en jours."],
              ["**Gabarit à envoyer**", "Le courriel que reçoit le client. Seuls les gabarits de relance, de marketing et personnalisés sont proposés — jamais ceux de soumission, d'instructions ou de reçu, qui sont des envois ponctuels. Si le gabarit est supprimé plus tard, la ligne affiche **(gabarit supprimé)** et la règle n'envoie rien."],
              ["**Mettre en pause**", "La règle est gardée et sautée. Le schéma marque l'étape « En pause — cette étape est ignorée. » **Activer** la remet en marche; tout ce qui a franchi la ligne entre-temps est rattrapé à la prochaine exécution."],
              ["Supprimer (corbeille)", "Enlève la règle. Les courriels déjà envoyés restent envoyés, mais une règle recréée est une nouvelle règle et ne se souvient pas de qui l'ancienne a écrit — une soumission encore à l'état envoyé serait relancée de nouveau. Mettez en pause si vous pourriez vouloir la reprendre."],
            ],
          } },
        ],
      },
      {
        id: "how-they-run",
        heading: "Quand elles s'exécutent, et ce qui les arrête",
        blocks: [
          { p: "La vérification se fait une fois par jour : une règle réglée à 3 jours envoie donc à la première exécution après le troisième jour, pas à l'heure exacte. À chaque exécution, pour chaque règle active, FieldQuo trouve tous les dossiers qui correspondent et n'ont pas encore reçu le courriel de cette règle, l'envoie et le note — une règle ne peut donc jamais envoyer deux fois pour la même soumission, facture ou chantier, même si deux exécutions se chevauchent." },
          { bullets: [
            "**Soumission envoyée, sans réponse** s'arrête dès que le client accepte ou refuse la soumission. Chaque soumission reçoit le courriel une seule fois.",
            "**Facture en retard** s'arrête dès que la facture est payée. Chaque facture reçoit le courriel une seule fois.",
            "**Chantier terminé** s'arrête si le chantier est rouvert. Chaque chantier reçoit le courriel une seule fois.",
          ] },
          { note: "Les clients sans adresse courriel au dossier sont ignorés. Les chantiers, soumissions et factures importés comme historique ne sont jamais relancés — une règle créée aujourd'hui rattrape bien les vraies soumissions du mois dernier, mais pas un chantier de 2024 saisi pour la comptabilité." },
          { tip: "Une relance **Chantier terminé** est du marketing au sens de la loi (un merci, une demande d'avis) : elle porte un lien de désabonnement et n'est pas envoyée à qui s'est désabonné de vos courriels de marketing. Les relances de soumission et de facture concernent une transaction déjà en cours avec le client et ne portent pas de lien de désabonnement." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et toute personne au niveau Répartiteur ou Gestionnaire peuvent ouvrir **Paramètres → Relances** et créer, mettre en pause ou supprimer des règles. Les accès Équipe et Estimateur ne voient pas la ligne. Voir [[team-and-access|Équipe et accès]] pour la façon dont les niveaux sont définis." },
        ],
      },
    ],
    faq: [
      { q: "J'ai créé une règle il y a une heure et rien n'est parti. Est-ce brisé?", a: "Probablement pas — la vérification se fait une fois par jour. Une soumission qui a franchi le délai cet après-midi reçoit son courriel à l'exécution du lendemain." },
      { q: "Une règle peut-elle envoyer un texto plutôt qu'un courriel?", a: "Non. Chaque règle envoie un gabarit de courriel et rien d'autre. Les deux textos que vos clients peuvent recevoir sont le texto « en route » et le rappel de rendez-vous — voir [[texting-clients-what-is-and-is-not-automated|Textos aux clients : ce qui est automatisé et ce qui ne l'est pas]]." },
      { q: "Un client recevra-t-il la même relance deux fois si je mets la règle en pause puis la réactive?", a: "Non. FieldQuo note chaque paire (règle, dossier) déjà écrite, et un dossier sur cette liste n'est plus jamais relancé par cette règle, peu importe combien de fois vous la mettez en pause et la réactivez. Supprimer puis recréer la règle, c'est différent : la nouvelle règle part avec une liste vide." },
    ],
  },

  "notifications-for-you": {
    title: "Vos notifications : courriel et navigateur",
    summary:
      "Les trois alertes que FieldQuo peut envoyer par courriel au propriétaire, le réglage du texto de rappel de rendez-vous qui vit sur le même écran, et les notifications du navigateur, par personne et par navigateur.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Notifications** concerne ce que FieldQuo *vous* dit — par opposition aux courriels de soumission, de reçu et de relance que reçoivent vos clients, réglés sous Modèles de courriel et Relances. On y trouve deux alertes par courriel pour le propriétaire et les administrateurs, le délai du texto de rappel que vos clients reçoivent avant un rendez-vous, et un interrupteur pour les notifications système dans votre propre navigateur.",
      "Chaque carte de la page dit honnêtement où elle en est : une alerte jamais configurée le dit, et la carte du navigateur précise si les notifications peuvent vous rejoindre onglet fermé ou seulement pendant qu'un onglet FieldQuo est ouvert.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Deux sortes de choses vivent ici. Les trois premières cartes sont des règles à l'échelle de l'entreprise — un réglage pour tout le monde, modifié par un propriétaire ou un administrateur. La carte **Notifications du navigateur** est personnelle : elle décide si *ce* navigateur, sur *cet* ordinateur ou ce téléphone, sonne pour vous, et chaque membre la règle pour lui-même." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Grande soumission créée** — « Envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur lorsqu'un membre de votre équipe rédige une soumission supérieure à ce montant. » Une case **Envoyer cette alerte**, un montant **M'alerter au-dessus de**, et **Enregistrer**. Tant qu'elle n'a pas été enregistrée une fois, elle affiche « Pas encore configuré — aucune alerte n'est envoyée. »",
            "**Facture payée** — « Envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur lorsqu'un client paie une facture en ligne. Activé par défaut. » Une seule case, enregistrée dès que vous la cochez.",
            "**Rappels de rendez-vous** — « Envoyez au client un rappel par texto avant son rendez-vous. » Quatre pastilles : **Désactivé**, **2 heures avant**, **24 heures avant**, **48 heures avant**. Celui-ci est un texto à votre *client*, pas un courriel pour vous; il est ici parce que c'est le seul réglage de rappel de l'entreprise.",
            "**Notifications du navigateur** — « M'avertir dans ce navigateur », l'état de l'autorisation du navigateur, si le push onglet fermé est disponible, et **Envoyer une notification test**.",
            "**Courriels destinés aux clients** — un renvoi : ce que disent ces courriels se trouve dans **Modèles de courriel**, et le moment de leur envoi dans **Relances**.",
          ] },
        ],
      },
      {
        id: "email-alerts",
        heading: "Configurer les alertes par courriel",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Notifications**.",
            "Sous **Grande soumission créée**, cochez **Envoyer cette alerte**, tapez le montant sous **M'alerter au-dessus de** (la case suggère 10000) et appuyez sur **Enregistrer**. Le montant doit être supérieur à zéro.",
            "Sous **Facture payée**, laissez la case cochée pour garder l'alerte, ou décochez-la pour arrêter les courriels. Elle s'enregistre d'elle-même.",
            "Sous **Rappels de rendez-vous**, appuyez sur le délai voulu. Il s'enregistre dès que vous appuyez, et la pastille devient pleine.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Paramètres → Notifications — Grande soumission créée avec son seuil, Facture payée, les quatre pastilles de Rappels de rendez-vous, et la carte du navigateur." },
          { table: {
            head: ["Alerte", "Qui la reçoit", "Quand"],
            rows: [
              ["Grande soumission créée", "Toute personne ayant un rôle de propriétaire ou d'administrateur, par courriel", "Vérifiée selon un horaire quotidien, pas à l'instant où la soumission est enregistrée — attendez-vous au courriel en moins d'une journée. Une soumission sous le montant n'envoie rien."],
              ["Facture payée", "Toute personne ayant un rôle de propriétaire ou d'administrateur, par courriel", "Quand un client paie une facture en ligne par le bouton Payer ou par le portail. Un paiement que vous enregistrez à la main (comptant, chèque, virement) ne la déclenche pas."],
              ["Rappels de rendez-vous", "Votre client, par texto, au nom de votre entreprise", "Vérifié chaque heure; le texto part dès que le rendez-vous entre dans le délai choisi — une fois par rendez-vous, jamais à un client qui s'est désabonné, et seulement à un client qui a un numéro de téléphone."],
            ],
          } },
          { note: "Le texto de rappel vise les rendez-vous de votre Calendrier — une réservation faite sur votre page de rendez-vous, une prise par le réceptionniste, ou une que vous avez ajoutée avec **Nouveau rendez-vous**. Une visite planifiée sur un chantier est un dossier différent et ne reçoit pas de rappel par texto. La formulation du texto se modifie sous **Paramètres → Messages aux clients**." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Notifications du navigateur",
        blocks: [
          { p: "Activez **M'avertir dans ce navigateur** et le navigateur demande l'autorisation une seule fois. Dès lors, pendant qu'un onglet FieldQuo est ouvert en arrière-plan, la nouvelle activité arrive comme notification système dans le coin de votre écran; onglet au premier plan, c'est plutôt une petite bulle. Là où le push est configuré sur le déploiement, la carte affiche « Activé. Vous serez averti ici, et onglet fermé. » — sinon « Activé. Vous serez averti tant qu'un onglet FieldQuo est ouvert. » La carte vous dit lequel, et ne promet jamais plus qu'elle ne peut." },
          { bullets: [
            "Le fil d'activité derrière l'icône de cloche — une soumission acceptée, une facture payée, un nouveau prospect, un paiement contesté, une soumission qui n'a pas pu être livrée, une demande de congé.",
            "Un nouveau message d'un client dans la boîte **Messages** (Facebook, Instagram, WhatsApp), pour quiconque a le droit de lire cette boîte.",
            "Dans **Clavardage** : un message direct qui vous est adressé, et tout message qui vous @mentionne.",
          ] },
          { note: "Sur iPhone et iPad, ajoutez d'abord FieldQuo à l'écran d'accueil — Safari ne livre les notifications qu'aux apps web installées. Si le navigateur a bloqué les notifications pour le site, la carte le dit et rien n'est activé tant que vous ne les autorisez pas dans les réglages du navigateur." },
          { tip: "Appuyez sur **Envoyer une notification test** après l'activation. Une notification « Test FieldQuo » s'affiche dans ce navigateur et, là où le push est actif, part vers chaque navigateur où vous l'avez activé — la preuve la plus rapide que votre téléphone vibrera." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire et les administrateurs seulement — les trois règles d'entreprise leur appartiennent, et la ligne est cachée à tous les autres. L'interrupteur du navigateur est personnel : un propriétaire qui l'active ne fait rien pour le téléphone d'un collègue; chaque membre l'active dans son propre navigateur." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi personne n'a reçu le courriel de grande soumission quand j'ai rédigé une soumission de 40 000 $ ce matin?", a: "La vérification suit un horaire quotidien : le courriel arrive en moins d'une journée, pas sur-le-champ. Vérifiez aussi que l'alerte affiche un montant enregistré plutôt que « Pas encore configuré »." },
      { q: "Puis-je être averti par courriel quand un nouveau prospect arrive, ou quand une soumission est acceptée?", a: "Pas par courriel depuis cet écran. Ces événements arrivent dans le fil d'activité derrière la cloche, et comme notification du navigateur si vous l'activez." },
      { q: "Le texto de rappel coûte-t-il quelque chose?", a: "La carte dit que chaque rappel est un texto facturé à votre compte, envoyé au nom de votre entreprise, jamais plus d'une fois par rendez-vous et jamais à un client qui s'est désabonné." },
    ],
  },

  "send-from-your-own-domain": {
    title: "Envoyer les courriels depuis votre propre domaine",
    summary:
      "Vérifiez un sous-domaine une fois et chaque soumission, facture, reçu et relance part de quotes@votre-domaine plutôt que de l'adresse partagée de FieldQuo — et où atterrissent les réponses.",
    updated: "2026-09-12",
    intro: [
      "Tant que vous n'avez pas connecté de domaine, les courriels que reçoivent vos clients partent de l'adresse partagée de FieldQuo, sous le nom de votre entreprise. Ça fonctionne, mais l'application de courriel du client peut afficher « via fieldquo.com » à côté de votre nom. **Paramètres → Domaine d'envoi** vous permet de prouver que vous possédez un domaine en ajoutant quelques enregistrements DNS; dès lors, chaque courriel client part d'une adresse sur ce domaine, et rien sur l'enveloppe ne dit FieldQuo.",
      "Rien ici ne crée de boîte aux lettres. L'adresse d'expéditeur n'a pas besoin d'exister comme boîte de réception — c'est la vérification du domaine qui donne la permission d'envoyer en son nom. Les réponses, elles, passent par le courriel de votre entreprise.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'intitule **Domaine d'envoi** — « Envoyez les courriels aux clients depuis votre propre domaine plutôt que le nôtre. Meilleure délivrabilité, et aucun « via fieldquo.com » à côté de votre nom. » Il enregistre le domaine auprès du fournisseur de courriel de FieldQuo, vous montre les enregistrements DNS à ajouter chez votre registraire, et revérifie la validation de lui-même toutes les 30 secondes. Une fois le statut à **Vérifié**, chaque envoi du produit — soumissions, factures, reçus, règles de relance, demandes d'avis, campagnes de marketing — utilise la nouvelle adresse sans autre réglage." },
          { note: "Utilisez un sous-domaine comme **send.votreentreprise.com** plutôt que votre domaine racine. Cela le garde séparé de votre courriel habituel, pour qu'il n'interfère pas avec la boîte de réception que vous avez déjà." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "L'état actuel : **Aucun domaine connecté** avec « Vos courriels sont actuellement envoyés depuis l'adresse partagée de FieldQuo, en utilisant le nom de votre entreprise. » — ou le domaine avec sa pastille de statut (**Vérifié**, **En attente du DNS**, **Échec de la vérification**, **Non configuré**), **Vérifier** et **Déconnecter**.",
            "**Connecter un domaine** — une case pour le sous-domaine et un bouton **Connecter**.",
            "**Ajoutez ces enregistrements DNS** — un tableau Type, Nom, Valeur (avec Priorité et TTL là où ça s'applique), chacun avec **Copier la valeur**, plus cinq consignes numérotées sur l'endroit où les mettre.",
            "**Adresse d'expéditeur** — la partie avant le @ de l'adresse que voient les clients (quotes par défaut), avec « Les courriels seront envoyés depuis quotes@send.votreentreprise.com » en dessous et **Enregistrer**.",
            "**Réponses** — une phrase qui dit où va la réponse d'un client à une soumission ou une facture.",
          ] },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "Connecter un domaine",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Domaine d'envoi**, tapez un sous-domaine comme send.votreentreprise.com sous **Connecter un domaine**, et appuyez sur **Connecter**.",
            "Connectez-vous là où vous avez acheté le domaine — GoDaddy, Namecheap, Cloudflare, Google Domains. C'est votre hébergeur DNS; si vous n'êtes pas certain, c'est habituellement celui qui vous facture annuellement pour le nom de domaine.",
            "Trouvez **DNS**, **Enregistrements DNS** ou **Gérer le DNS**, et ajoutez un nouvel enregistrement pour chaque bloc à l'écran, en respectant exactement le Type, le Nom et la Valeur. Utilisez **Copier la valeur** — les valeurs TXT sont longues.",
            "Enregistrez chez l'hébergeur, puis laissez faire. La plupart appliquent les changements en une heure; certains prennent jusqu'à 24. La page revérifie toutes les 30 secondes d'elle-même, et **Vérifier** demande tout de suite.",
            "Quand la pastille affiche **Vérifié**, réglez l'**Adresse d'expéditeur** si vous voulez autre chose que quotes (factures, bonjour, bureau) et appuyez sur **Enregistrer**.",
            "Envoyez-vous une soumission et regardez la ligne De : le nom de votre entreprise, votre adresse, aucun « via ».",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Paramètres → Domaine d'envoi — le domaine connecté avec son statut Vérifié et Déconnecter, l'adresse d'expéditeur, et où vont les réponses." },
          { warning: "Surveillez le champ **Nom**. La plupart des hébergeurs ajoutent votre domaine automatiquement : si le Nom affiché est send._domainkey.example.com, vous n'entrez habituellement que send._domainkey. Se retrouver avec send._domainkey.example.com.example.com est l'erreur la plus fréquente, et elle reste à **En attente du DNS** pour toujours." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que signifie chaque statut et chaque commande",
        blocks: [
          { table: {
            head: ["À l'écran", "Ce que ça signifie"],
            rows: [
              ["**Vérifié**", "Vos courriels aux clients partent de l'adresse d'expéditeur sur votre domaine, au nom de votre entreprise. Rien d'autre n'a besoin d'être activé."],
              ["**En attente du DNS** / **Échec de la vérification**", "Rien ne part encore de votre domaine; les courriels continuent de partir de l'adresse partagée de FieldQuo sous votre nom. Revérifiez les enregistrements — le champ Nom, le plus souvent — et attendez que l'hébergeur les applique."],
              ["**Adresse d'expéditeur**", "Seulement la partie avant le @. Elle change ce que les clients voient dans la ligne De et rien d'autre; ce n'a pas besoin d'être une vraie boîte aux lettres."],
              ["**Déconnecter**", "Vos courriels recommencent à partir de l'adresse partagée de FieldQuo sous le nom de votre entreprise. L'écran demande d'abord confirmation."],
            ],
          } },
        ],
      },
      {
        id: "replies",
        heading: "Où vont les réponses",
        blocks: [
          { p: "Quand un client répond à une soumission ou à une facture, la réponse va au **courriel de l'entreprise** défini dans **Profil de l'entreprise**. Si aucun courriel d'entreprise n'est défini, elle va plutôt au courriel de connexion du propriétaire du compte — pour que la réponse d'un client ne se perde jamais dans une boîte que personne ne lit. La ligne **Réponses** de cet écran vous dit lequel des deux est en vigueur." },
          { tip: "Mettez comme courriel d'entreprise la boîte que votre bureau surveille vraiment. L'adresse d'expéditeur sur votre domaine n'est jamais l'adresse de réponse — elle n'a pas besoin d'exister — donc une réponse qui y arriverait s'évaporerait." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et toute personne au niveau Répartiteur ou Gestionnaire peuvent ouvrir **Paramètres → Domaine d'envoi** et connecter, vérifier ou déconnecter un domaine. Les accès Équipe et Estimateur ne voient pas la ligne." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je créer quotes@send.monentreprise.com comme boîte aux lettres?", a: "Non. C'est la vérification du domaine qui permet à FieldQuo d'envoyer sous cette adresse. Les réponses vont au courriel de votre entreprise, pas à l'adresse d'expéditeur." },
      { q: "Ça affiche En attente du DNS depuis une journée. Que faire?", a: "Ouvrez les enregistrements chez votre hébergeur DNS et comparez Type, Nom et Valeur avec l'écran, caractère par caractère. Neuf fois sur dix, l'hébergeur a doublé votre domaine dans le champ Nom. Corrigez, enregistrez, et la page capte le changement à sa prochaine vérification de 30 secondes." },
      { q: "Quelque chose d'autre change-t-il une fois le domaine vérifié?", a: "Seulement la ligne De. Le contenu, l'image de marque, la langue et le moment d'envoi de chaque courriel restent exactement les mêmes." },
    ],
  },

  "the-phone-receptionist": {
    title: "La réceptionniste téléphonique",
    summary:
      "Une réceptionniste IA sur un numéro local : ce qu'elle fait pendant un appel, la configuration en sept cartes, ce que change chaque commande, ce que coûte une minute, et ce qu'aucune autre page de prix n'affiche.",
    updated: "2026-09-12",
    intro: [
      "La réceptionniste téléphonique répond aux appels que vous ne pouvez pas prendre, note les coordonnées de l'appelant, fixe une visite selon vos vraies disponibilités et vous laisse l'enregistrement, la transcription et — quand l'appelant en a dit assez — une ébauche de soumission. Elle parle la langue de votre entreprise (anglais, français ou espagnol) et passe à celle de l'appelant s'il en parle une autre. Elle ne donne jamais de prix, ne promet jamais une heure qu'elle n'a pas vérifiée et ne prétend jamais être une personne.",
      "Cet article porte sur l'écran **Paramètres → Réceptionniste téléphonique** : le numéro, le crédit, les mots, l'interrupteur et la vérification de bout en bout. Ce qu'elle a fait de chaque appel se trouve à l'écran Réceptionniste de la barre latérale principale — voir [[the-receptionist-call-log|Le journal d'appels de la réceptionniste]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'intitule **Réceptionniste téléphonique** — « Répond aux appels que vous ne pouvez pas prendre, note les détails et fixe des visites selon vos vraies disponibilités. Il ne donne jamais de prix. » Il suit l'ordre des décisions : le crédit, puis un numéro, puis ce qu'elle dit, puis l'interrupteur. Une nouvelle entreprise voit les cartes numérotées de 1 à 7; une fois la configuration terminée, les numéros disparaissent et les mêmes cartes restent." },
          { p: "Pendant un appel, la réceptionniste lit vos heures d'ouverture, vos services activés et vos zones de service dans vos paramètres, plus la note que vous rédigez pour elle. Pour réserver, elle propose de vraies plages libres tirées de vos disponibilités; si vos visites sont payantes, ou si votre ligne est réglée sur les rappels, elle le dit et prend plutôt des heures préférées ou lit le lien de réservation à voix haute — elle ne peut pas le texter." },
          { note: "Tout ce que la réceptionniste peut dépenser est chiffré par le serveur et affiché sur cet écran avant que vous vous engagiez. Le navigateur n'envoie jamais de montant." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Crédit** — le solde, « 35 ¢ la minute, arrondi à la minute supérieure, minimum d'une minute », **Ajouter du crédit**, le relevé de où est allé le crédit, et la carte **Recharger automatiquement** avec une carte enregistrée et un seuil.",
            "**Votre numéro** — trois façons d'en avoir un : **Garder mon numéro, renvoyer les appels manqués** (recommandé, deux minutes), **Obtenir un nouveau numéro**, ou **Transférer mon numéro** (deux à quatre semaines, au rythme de votre ancien fournisseur). Un numéro acheté affiche **Renvoyé vers** et un lien **Rendre le …**.",
            "**Ce qu'elle dit** — la **Salutation**, la note de connaissances avec **Répondez à ceci dans vos propres mots** et **Préparer à partir de mon profil d'entreprise**, la **Voix** avec les aperçus **Écouter …**, et les réglages **Comment il parle**.",
            "**Répondre à mes appels** — le seul interrupteur : **Commencer à répondre aux appels** / **Elle répond — désactiver**. Il refuse de s'activer sans numéro et sans crédit pour au moins une minute.",
            "**Rappeler les clients automatiquement** — la moitié sortante : **Activer les rappels de soumission**, puis **Quelles soumissions déclenchent un appel**. Détaillé dans [[quote-callbacks|Rappels de soumission]].",
            "**Permettre à l'équipe d'envoyer photos et mises à jour par texto** — un lien vers la boîte équipe, qui utilise une ligne texto distincte. Détaillé dans [[the-crew-inbox|La boîte équipe]].",
            "**Vérifier de bout en bout** — interroge le service téléphonique lui-même sur chaque maillon entre l'appel de quelqu'un et l'arrivée d'un prospect dans FieldQuo.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "La configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Réceptionniste téléphonique**. Sous **Crédit**, appuyez sur **Ajouter du crédit** si le solde est vide — votre premier numéro vient avec 30 minutes de crédit gratuites, et le premier mois de location du numéro en est prélevé.",
            "Sous **Votre numéro**, choisissez **Garder mon numéro, renvoyer les appels manqués** à moins d'avoir une raison de faire autrement. FieldQuo loue une ligne sur laquelle la réceptionniste répond et vous montre le code de renvoi à composer depuis votre propre téléphone; vos clients continuent de composer le numéro du camion, et les appels que vous ne prenez pas sonnent chez la réceptionniste plutôt que sur la boîte vocale.",
            "Sous **Ce qu'elle dit**, rédigez la **Salutation** (l'exemple est « Thanks for calling, how can I help? »), puis appuyez sur **Préparer à partir de mon profil d'entreprise** — elle lit votre profil et liste les questions auxquelles elle ne peut pas répondre seule (ce que vous refusez, ce qui compte comme urgent, quoi dire quand vous êtes fermé). Écrivez par-dessus chaque crochet; une ligne laissée entre crochets est sautée.",
            "Choisissez une **Voix** et écoutez-la avec **Écouter …**. Laissez **Comment il parle** aux valeurs par défaut à moins que les appelants se fassent couper la parole.",
            "Appuyez sur **Commencer à répondre aux appels**. La barre d'état en haut affiche votre numéro avec un point vert, et l'interrupteur indique maintenant **Elle répond — désactiver**.",
            "Appuyez sur **Vérifier de bout en bout**, puis appelez votre propre numéro. Chaque maillon doit passer; un appel peut être parfaitement pris et ne jamais parvenir à FieldQuo, et c'est cette carte qui le dit.",
          ] },
          { figure: "live:app-settings-voice", caption: "Paramètres → Réceptionniste téléphonique — le numéro avec son interrupteur de réponse, la carte de crédit avec les recharges, et les cartes salutation, connaissances, voix et réglages." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["**Garder mon numéro, renvoyer les appels manqués**", "Loue une seconde ligne sur laquelle la réceptionniste répond. Votre propre numéro n'est pas touché; vous réglez le renvoi conditionnel sur votre téléphone avec le code affiché, et vous pouvez l'annuler de la même façon — composez ##002# — en moins d'une minute."],
              ["**Obtenir un nouveau numéro** / **Choisir le numéro vous-même**", "Achète une ligne distincte dans l'indicatif de votre choix. Utile pour la publicité ou un second métier; elle n'attrapera pas les appels au numéro que vous affichez déjà. En choisir un l'achète sur-le-champ et le premier mois est pris sur votre crédit."],
              ["**Transférer mon numéro**", "Lance un transfert. Rien n'est facturé au départ et votre numéro continue de fonctionner chez votre ancien fournisseur jusqu'à la fin du transfert; la réceptionniste ne peut pas y répondre avant."],
              ["**Salutation** et la note de connaissances", "La première chose qu'entend chaque appelant, et les faits que la réceptionniste peut utiliser au-delà de vos paramètres. Les heures d'ouverture, les services et les zones sont lus dans vos paramètres à chaque appel et c'est là qu'ils vont, pas dans la note."],
              ["**Voix** et **Comment il parle**", "Quelle voix parle, et quatre réglages : ce qu'elle fait si un appelant parle par-dessus elle, d'où appellent habituellement vos clients, à quelle vitesse elle répond, comment elle se présente."],
              ["**Répondre à mes appels**", "Si le numéro est pris ou non. Désactiver arrête la réponse sur-le-champ — si le numéro est sur votre camion, redirigez-le d'abord, car l'appelant pourrait entendre une tonalité d'occupation plutôt qu'une sonnerie."],
              ["**Recharger automatiquement**", "Désactivé tant que vous ne l'activez pas. Enregistre une carte et, quand le solde passe sous le seuil, facture le montant affiché et ajoute le crédit — au plus un nombre fixé de fois par jour. Il se désactive de lui-même et vous le dit si la carte est refusée."],
              ["**Rendre le …**", "Rend un numéro acheté pour de bon. Il est supprimé chez la compagnie de téléphone et ne peut pas être récupéré; la location mensuelle cesse et le reste du mois déjà payé n'est pas remboursé."],
            ],
          } },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Ce que ça coûte",
        blocks: [
          { p: "La réceptionniste fonctionne avec un crédit prépayé, en dollars américains, et chaque frais figure au relevé sous **Crédit**. Les appels sont comptés à la minute; les numéros sont loués au mois; les deux sortent du même solde, tout comme la ligne texto de l'équipe." },
          { bullets: [
            "**35 ¢ la minute**, arrondi à la minute supérieure, minimum d'une minute — entrant comme sortant. Un numéro sans frais ajoute 5 ¢ la minute.",
            "**4 $ par mois** pour un numéro local, **9 $ par mois** pour un numéro sans frais (800/833/844). Le premier mois est facturé à l'achat du numéro.",
            "**30 minutes de crédit gratuites** avec votre premier numéro, pour que la réceptionniste puisse commencer à répondre avant votre première recharge.",
          ] },
          { note: "Quand le crédit baisse, l'écran le dit, et quand il est épuisé la réceptionniste cesse de répondre — c'est exactement ce que **Recharger automatiquement** existe pour éviter." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce qui est différent ici",
        blocks: [
          { p: "D'autres outils pour entrepreneurs vendent aussi une réceptionniste IA; répondre au téléphone n'est donc pas la différence. Sur les pages de prix auxquelles FieldQuo se compare — Jobber, Housecall Pro, QuoteIQ, ServiceTitan et Projul — deux choses que fait la réceptionniste ici ne figurent à aucun palier :" },
          { bullets: [
            "**Un appel qui revient en ébauche de soumission.** Ce que l'appelant a décrit est lu dans la transcription et, quand c'est suffisant pour votre formulaire de soumission instantanée, chiffré selon vos propres réglages et déposé dans votre file de révision — jamais un chiffre inventé pendant l'appel.",
            "**L'assistant qui rappelle vos clients** — après l'envoi d'une soumission, la veille d'une visite et sur une nouvelle demande — pendant les heures d'appel et seulement là où le client a demandé à être contacté.",
          ] },
          { p: "Et elle est facturée à la minute sur un crédit que vous voyez, avec le coût de chaque appel imprimé à côté de l'appel, plutôt que comme un supplément mensuel fixe." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et toute personne au niveau Répartiteur ou Gestionnaire peuvent ouvrir **Paramètres → Réceptionniste téléphonique** et le modifier — acheter un numéro et recharger dépensent l'argent de l'entreprise. Les accès Équipe et Estimateur ne voient pas la ligne. Le journal d'appels a sa propre règle : voir [[the-receptionist-call-log|Le journal d'appels de la réceptionniste]]." },
        ],
      },
    ],
    faq: [
      { q: "Répond-elle en français ou en espagnol?", a: "Elle mène tout l'appel dans la langue de votre entreprise — anglais, français ou espagnol — et passe à la langue de l'appelant s'il en parle une autre. Les entreprises réglées sur toute autre langue ont pour l'instant une réceptionniste qui parle anglais." },
      { q: "Va-t-elle donner un prix au téléphone?", a: "Jamais. Elle peut lire les frais de réservation que vous avez publiés sur votre page de rendez-vous, parce que c'est votre propre chiffre, mais elle ne chiffre jamais les travaux. Une ébauche de soumission atterrit dans votre file de révision pour qu'une personne l'approuve." },
      { q: "J'ai appelé mon propre numéro et rien n'est apparu dans FieldQuo.", a: "Lancez **Vérifier de bout en bout** sur l'écran de réglages — il interroge le service téléphonique sur chaque maillon et nomme celui qui est brisé. Sur l'écran Réceptionniste, **Récupérer les appels manqués** ramène tout appel de la dernière semaine qui ne nous est jamais parvenu." },
    ],
  },

  "the-receptionist-call-log": {
    title: "Le journal d'appels de la réceptionniste",
    summary:
      "Chaque appel que la réceptionniste a pris ou passé : ce qui a été dit, ce qui en est ressorti, ce que ça a coûté — regroupés en Votre attention, En attente de vous et Archivés, avec l'enregistrement, une ébauche de soumission et un rappel à un clic.",
    updated: "2026-09-12",
    intro: [
      "L'écran **Réceptionniste** de la barre latérale principale est le journal — « Les appels qu'il a pris pour vous, et ce qui en est ressorti. » Chaque appel montre le numéro, l'heure, la durée, le coût, un résumé et ce qu'il a produit : un prospect enregistré, une visite réservée, un rappel programmé. L'enregistrement est à un clic, tout comme une ébauche de soumission construite à partir de ce que l'appelant a dit.",
      "Les appels ne se classent pas tout seuls. Un appel que la réceptionniste a signalé comme urgent reste en haut jusqu'à ce qu'une personne dise s'en être occupée, et un appel qui n'est pas devenu une soumission reste dans la liste de travail jusqu'à ce que quelqu'un l'archive.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Au-dessus de la liste, quand il y a quelque chose à dire, une ligne compte ce que vos appels ont réservé : « Vous avez 3 à venir depuis vos appels — le prochain est mardi à 14 h. » Deux boutons sont en haut : **Récupérer les appels manqués** et **Réglages du réceptionniste**. Si la réceptionniste est configurée mais désactivée, l'écran le dit et propose **Activer le réceptionniste**; si elle est active et que personne n'a encore appelé, il vous renvoie à **Vérifier de bout en bout**." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre attention** — les appels que la réceptionniste a signalés : quelqu'un a parlé d'inondation, de gaz, d'un plafond qui s'effondre. En ambre, en haut, jusqu'à ce que vous appuyiez sur **Je m'en suis occupé**.",
            "**En attente de vous** — « Ces appels ne sont pas encore devenus une soumission. Archivez-en un dès que vous vous en êtes occupé. » La liste de travail.",
            "**Archivés** — le journal en dessous, avec **Remettre** sur chaque appel.",
          ] },
          { p: "Sur chaque appel : une pastille **Nous avons appelé** quand l'assistant a passé l'appel plutôt que d'y répondre, une pastille **Récupéré** quand l'appel a été ramené du fournisseur téléphonique après coup, le numéro de l'appelant ou **Numéro inconnu**, l'heure, la durée et le coût en dollars américains, le résumé, et ce qui en est ressorti — **Enregistré comme prospect**, **Visite réservée — mardi …**, **Rappel programmé — …**, **Appel vidéo réservé — …**, ou **Soumission 1042** dès qu'une soumission existe. Puis **Écouter**, **Lire tout l'appel**, **Rédiger une soumission à partir de cet appel** et **Planifier un rappel**." },
        ],
      },
      {
        id: "working-a-call",
        heading: "Traiter un appel",
        blocks: [
          { steps: [
            "Ouvrez **Réceptionniste**. Commencez par **Votre attention**; appuyez sur **Écouter** pour entendre l'enregistrement, ou sur **Lire tout l'appel** pour la transcription, chaque ligne étant marquée comme venant de l'appelant ou de la réceptionniste.",
            "Appuyez sur **Rédiger une soumission à partir de cet appel**. Le panneau **Ce que nous avons entendu pendant cet appel** liste chaque service et chaque mesure à côté des mots mêmes de l'appelant — rien n'est affirmé qui ne remonte à quelque chose de dit. Si l'appelant en a donné assez pour votre formulaire de soumission instantanée, l'ébauche est déjà chiffrée selon vos réglages et attend dans la file de révision (**Ouvrir la file de révision**); sinon, **Ouvrir dans le générateur de soumission** démarre une soumission avec ce qui a été entendu déjà rempli, sans prix.",
            "Si l'appelant veut être rappelé, appuyez sur **Planifier un rappel** : FieldQuo réserve la prochaine plage libre de 15 minutes dans vos disponibilités, pendant vos heures d'ouverture, et la met à votre calendrier — « Rappel planifié — mardi à 10 h 15. Il est dans votre calendrier. »",
            "Quand vous avez agi sur un appel urgent, appuyez sur **Je m'en suis occupé**. Quand un appel ordinaire est réglé, appuyez sur **Archiver**; **Remettre** l'annule.",
            "Si un appel dont vous savez qu'il a eu lieu manque, appuyez sur **Récupérer les appels manqués**. FieldQuo demande la dernière semaine au fournisseur téléphonique, ramène tout ce qui ne lui est jamais parvenu et reconstitue le prospect à partir de l'enregistrement — marqué **Récupéré**, avec « vérifiez les détails avant de rappeler ».",
          ] },
          { figure: "live:app-receptionist", caption: "Réceptionniste — le compte des réservations à venir, puis les appels regroupés en Votre attention, En attente de vous et Archivés, chacun avec son coût, son résumé et son résultat." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Ce que fait chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["**Écouter**", "Lit l'enregistrement de l'appel dans la page."],
              ["**Rédiger une soumission à partir de cet appel**", "Lit la transcription avec FieldQuo IA. Chiffrée seulement quand votre formulaire de soumission instantanée a tout ce qu'il lui faut — c'est alors une ébauche dans la file de révision, jamais un chiffre sur cet écran. Consomme votre quota d'IA; s'il est épuisé, ou si l'IA est désactivée, le panneau le dit et l'enregistrement et la transcription restent."],
              ["**Planifier un rappel**", "Réserve un rappel de 15 minutes à votre calendrier selon vos vraies disponibilités. Refusé avec une raison quand il n'y a aucun numéro à appeler, quand votre ligne est réglée sur les visites sur place seulement, quand vos heures d'ouverture n'ont jamais été renseignées, ou quand le type de rendez-vous exige des frais à l'avance (ça doit passer par votre page de rendez-vous)."],
              ["**Je m'en suis occupé**", "Sort un appel urgent de Votre attention. Rien d'autre n'est changé."],
              ["**Archiver** / **Remettre**", "Sort un appel de la liste de travail, ou l'y remet. L'appel, son enregistrement et son coût restent au journal."],
              ["**Récupérer les appels manqués**", "Demande au fournisseur téléphonique chaque appel de la dernière semaine, ajoute ceux que FieldQuo n'a jamais reçus et reconstitue leurs prospects à partir des enregistrements. Indique combien ont été vérifiés, récupérés et reconstitués, ou que rien ne manquait."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le journal contient des coordonnées de clients — numéros et enregistrements — donc il suit le cadran **Clients et propriétés** : quiconque peut voir l'information complète des clients voit la ligne, soit les profils Estimateur, Répartiteur et Gestionnaire ainsi que le propriétaire et les administrateurs. Le profil Équipe, qui ne voit que le nom et l'adresse d'un client, ne la voit pas. **Planifier un rappel** exige en plus le droit de créer des demandes, que chacun de ces profils possède." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi un appel de mardi n'apparaît-il qu'aujourd'hui, avec une pastille Récupéré?", a: "Il n'est jamais parvenu à FieldQuo pendant qu'il avait lieu et a été ramené du fournisseur téléphonique après coup. La ligne n'est pas en retard — elle avait été perdue, et la pastille dit quand on l'a récupérée." },
      { q: "Rédiger une soumission à partir d'un appel met-il un prix sous les yeux du client?", a: "Non. Une ébauche chiffrée reste dans votre file de révision jusqu'à ce qu'une personne l'approuve; une ébauche non chiffrée s'ouvre dans le générateur de soumission sans prix. Le client ne voit rien tant que vous n'envoyez pas." },
      { q: "Où est-ce que je change ce que dit la réceptionniste?", a: "**Réglages du réceptionniste**, en haut de cet écran, ouvre Paramètres → Réceptionniste téléphonique — voir [[the-phone-receptionist|La réceptionniste téléphonique]]." },
    ],
  },

  "quote-callbacks": {
    title: "Rappels de soumission",
    summary:
      "L'assistant appelle un client après l'envoi de sa soumission, la veille d'une visite et sur une nouvelle demande — quelles soumissions, les huit vérifications avant de composer, le consentement requis, et la carte qui dit pourquoi une soumission n'a pas été appelée.",
    updated: "2026-09-12",
    intro: [
      "Activez **Rappeler les clients automatiquement** et la réceptionniste téléphonique se met à passer des appels en plus d'en prendre : après l'envoi d'une soumission, pour répondre aux questions et demander si le client veut aller de l'avant; la veille d'une visite réservée, pour la confirmer; et pour faire le suivi d'une nouvelle demande. Toujours pendant les heures d'appel, seulement aux personnes qui ont demandé à être contactées, et quiconque dit d'arrêter est retiré pour de bon.",
      "Cet article est la moitié sortante de **Paramètres → Réceptionniste téléphonique** : l'interrupteur, le choix **Quelles soumissions déclenchent un appel**, les règles que l'assistant vérifie avant de composer, le bouton manuel **Appeler au sujet de cette soumission** sur une soumission, et le rapport sur la carte qui nomme les soumissions laissées de côté et pourquoi.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un appel est mis en file au moment où un déclencheur se produit et passé plus tard, par une vérification qui tourne toutes les 15 minutes — une soumission approuvée à neuf heures du soir est donc appelée le lendemain matin, pas à neuf heures. Chaque règle est revérifiée au moment de composer, pas au moment de la mise en file : un client qui retire son consentement, un numéro qui change ou un crédit épuisé entre-temps s'appliquent à un appel déjà en attente." },
          { note: "L'assistant peut énoncer le total de la soumission pendant un appel de soumission, parce qu'une personne a approuvé ce chiffre et que le client l'a déjà par écrit. Il ne le change jamais, et si le total de la soumission ne correspond plus à ce qui a été mis en file, le chiffre est retiré de l'appel plutôt que prononcé." },
        ],
      },
      {
        id: "which-quotes",
        heading: "Quelles soumissions déclenchent un appel",
        blocks: [
          { table: {
            head: ["Choix sur la carte", "Ce qu'il fait"],
            rows: [
              ["**Estimations instantanées seulement**", "Seulement les soumissions chiffrées par le logiciel et approuvées par quelqu'un — une estimation instantanée venue de votre site web ou de la réceptionniste, après révision. C'est la valeur par défaut et ce que la fonction a toujours fait."],
              ["**Toutes les soumissions que j'envoie**", "Y compris les soumissions que vous rédigez vous-même : l'assistant appelle une fois après l'envoi, pour répondre aux questions et demander s'ils veulent aller de l'avant."],
              ["**Aucun rappel de soumission**", "Aucun appel au sujet des soumissions. Les rappels de rendez-vous et les suivis de nouvelles demandes continuent, parce que l'interrupteur au-dessus régit les trois."],
            ],
          } },
        ],
      },
      {
        id: "before-it-dials",
        heading: "Ce qui est vérifié avant de composer",
        blocks: [
          { p: "Un appel de soumission n'est passé que si chacune de ces conditions tient. La carte de l'écran de réglages nomme celles qui échouent, dans les mêmes mots :" },
          { bullets: [
            "**Les appels automatiques sont activés** — l'interrupteur principal de la carte.",
            "**La soumission est dans la portée** — une estimation instantanée, ou toute soumission si vous avez choisi « toutes les soumissions que j'envoie ».",
            "**Le client ne l'a pas refusée** — un « non » déjà donné ne reçoit pas d'appel de conclusion.",
            "**L'estimation est approuvée** — un brouillon qui attend encore l'approbation de quelqu'un n'est jamais appelé.",
            "**La soumission a été envoyée par courriel** — l'appel porte sur un document que le client peut lire, donc il vient après le courriel, jamais avant. Un chantier passé importé pour la comptabilité n'est jamais appelé.",
            "**Le client a un numéro de téléphone.**",
            "**Quelqu'un à ce numéro a demandé à être contacté** — le consentement est noté quand un client envoie votre formulaire web, votre estimation instantanée, votre formulaire d'auto-soumission ou une demande du portail qui dit que vous pouvez appeler, ou réserve une visite; il dure un an (trois mois après un chantier terminé), et « ne m'appelez pas » l'emporte sur tout et n'est jamais effacé.",
            "**Il est entre 9 h et 20 h là où se trouve le client.** En dehors de cette fenêtre, l'appel attend simplement.",
          ] },
          { p: "Un seul appel par soumission, à jamais. Renvoyer une soumission une semaine plus tard ne met pas un second appel en file. Une visite déplacée reçoit bien un second appel de rappel, parce que le premier portait sur un autre jour." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "L'activer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Réceptionniste téléphonique** et descendez jusqu'à **Rappeler les clients automatiquement**. Le bouton est désactivé tant que vous n'avez pas un numéro actif et du crédit pour au moins une minute; la ligne en dessous dit ce qui manque.",
            "Appuyez sur **Activer les rappels de soumission**. Le bouton devient vert et affiche **Elle appelle les clients — désactiver**.",
            "Sous **Quelles soumissions déclenchent un appel**, laissez **Estimations instantanées seulement** ou choisissez **Toutes les soumissions que j'envoie**.",
            "Lisez le rapport sous le choix. Il liste les soumissions envoyées dans les 30 derniers jours qui n'ont pas été appelées et la raison la plus fréquente — « Pas une estimation instantanée — quelqu'un a rédigé cette soumission », « Aucun numéro de téléphone pour ce client », « Personne à ce numéro n'a demandé à être contacté » — pour qu'une fonction armée qui ne se déclenchera jamais soit visible ici plutôt que silencieuse.",
          ] },
          { figure: "live:app-settings-voice", caption: "Paramètres → Réceptionniste téléphonique — la carte Rappeler les clients automatiquement contient l'interrupteur, le choix Quelles soumissions déclenchent un appel et le rapport." },
        ],
      },
      {
        id: "call-about-this-quote",
        heading: "Appeler un client à la main",
        blocks: [
          { p: "Sur n'importe quelle soumission, **Appeler au sujet de cette soumission** met le même appel en file pour ce seul client — « En file — nous appellerons Maria d'ici une quinzaine de minutes. » Une personne qui appuie a pris elle-même la décision de portée, donc le choix de portée ne l'arrête pas; ce qui l'arrête encore, c'est l'interrupteur principal désactivé, un brouillon que personne n'a approuvé, une soumission que le client n'a pas reçue par courriel, et un client sans numéro de téléphone. Le consentement et les heures d'appel sont vérifiés au moment de composer, exactement comme pour un appel automatique." },
          { tip: "Chaque appel que l'assistant passe apparaît à l'écran Réceptionniste avec une pastille **Nous avons appelé**, son enregistrement, son résumé et son coût — les mêmes 35 ¢ la minute qu'un appel reçu." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce qui est différent ici",
        blocks: [
          { p: "Sur les pages de prix auxquelles FieldQuo se compare — Jobber, Housecall Pro, QuoteIQ, ServiceTitan et Projul — un assistant qui appelle vos clients pour confirmer la visite de demain ou conclure une soumission que vous avez envoyée ne figure à aucun palier. Ce qui le rend utilisable plutôt que dangereux, c'est la partie invisible : aucun appel ne part jamais vers un numéro sans demande de contact enregistrée, et le rapport sur la carte vous dit quelles soumissions ont été laissées de côté et pourquoi." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'interrupteur et la portée vivent dans Paramètres → Réceptionniste téléphonique, que le propriétaire, les administrateurs et les niveaux Répartiteur et Gestionnaire peuvent ouvrir. **Appeler au sujet de cette soumission** se trouve sur la soumission elle-même, pour quiconque peut l'ouvrir — si les appels sortants sont désactivés pour l'entreprise, le bouton le dit et nomme qui peut les réactiver." },
        ],
      },
    ],
    faq: [
      { q: "J'ai activé la fonction et rédigé trois soumissions. Pourquoi personne n'a été appelé?", a: "Lisez le rapport sur la carte. Le plus souvent, les soumissions ont été rédigées à la main alors que la portée est Estimations instantanées seulement, ou les clients ont été saisis à partir d'un appel et personne à leur numéro n'a demandé à être contacté." },
      { q: "Peut-il appeler quelqu'un qui est dans ma liste de clients mais n'a jamais rien demandé?", a: "Non. Être dans votre base de données n'est pas un consentement. L'assistant n'appelle qu'un numéro avec une demande enregistrée — un formulaire, une réservation, une soumission demandée — et un client qui dit d'arrêter n'est plus jamais appelé." },
      { q: "Quand exactement part l'appel de rappel de rendez-vous?", a: "Environ 24 heures avant la visite, pendant les heures d'appel, et seulement si la visite est à plus de trois heures au moment de la réservation — un rappel quelques minutes après la réservation serait une nuisance." },
    ],
  },

  "the-crew-inbox": {
    title: "La boîte équipe : photos et mises à jour par texto",
    summary:
      "Votre équipe texte photos et notes à un seul numéro et elles se classent d'elles-mêmes au bon chantier — sans app, sans compte. Le panneau de configuration, la file des photos qui ont besoin d'une personne, ce que coûte chaque texto, et qui voit quoi.",
    updated: "2026-09-12",
    intro: [
      "Un membre d'équipe sur une échelle n'installera pas d'app. Avec la boîte équipe, il texte une photo, ou une mise à jour d'une ligne, à un numéro, et FieldQuo la classe au chantier où il est ce jour-là. Quand la journée compte plus d'un chantier, il demande lequel — par texto, sous forme de liste numérotée — plutôt que de deviner. Une photo classée au mauvais client est la seule erreur que cette fonction est construite pour ne jamais faire.",
      "L'écran **Boîte équipe** de la barre latérale principale est l'endroit où vous configurez le numéro et où atterrissent les exceptions : une photo dont personne n'a répondu à la question, et les textos de numéros qui ne sont pas dans votre équipe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La ligne texto de l'équipe est un numéro à part — une ligne texto, distincte de celle sur laquelle la réceptionniste répond aux appels, parce que le numéro de la réceptionniste ne peut pas recevoir de texto. Elle est louée au mois et ses textos sont comptés sur le même crédit que la réceptionniste. L'équipe est reconnue par le numéro de téléphone de son profil sous **Équipe → Employés**; un texto d'un numéro inconnu est enregistré mais non classé, et — pendant vos premiers textos — reçoit une réponse qui dit quel numéro ajouter." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Textos de l'équipe** — le panneau vert de configuration : **Votre équipe texte ce numéro**, le numéro, s'il est vraiment branché (demandé au fournisseur téléphonique, pas supposé), **Crédit : 12,40 $**, la ligne des tarifs « 2 ¢ par texto (par tranche de 160 caractères), 5 ¢ par photo — pris sur le même crédit que votre agent téléphonique », et **M'envoyer un texto d'essai**, **Ajouter du crédit**, **Voir chaque frais**, **Désactiver les textos de l'équipe**.",
            "**Votre attention — choisissez le chantier (2)** — une photo que le système n'a pas pu classer : l'image, qui l'a envoyée, quand, **Où elle a été prise** quand le téléphone a transmis des coordonnées, puis **Pour quel chantier est-ce ?** avec une pastille par chantier candidat et **Classer ici**.",
            "**De numéros absents de votre équipe (1)** — les textos d'inconnus, avec « Ajoutez ce numéro à un membre de l'équipe dans **Équipe** et leurs textos seront classés automatiquement. »",
            "**Classés** — tout ce qui a atterri, chacun affichant **Classé à Cuisine Nguyen**. La photo elle-même vit sur le chantier.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "La configurer",
        blocks: [
          { steps: [
            "Ouvrez **Boîte équipe**. Si le panneau affiche « Votre équipe n'a pas encore de numéro où texter », appuyez sur **Acheter un numéro à votre équipe**, choisissez un **Indicatif régional** (par défaut celui de votre profil d'entreprise), appuyez sur **Montrez-moi des numéros** et choisissez-en un. Ça coûte 4 $ par mois sur votre crédit, le premier mois d'avance, et le panneau confirme « C'est fait — le numéro de votre équipe est … ».",
            "Ou, pour l'essayer d'abord, appuyez sur **Utiliser la ligne d'essai FieldQuo** — une ligne partagée prêtée à votre entreprise jusqu'à la date affichée.",
            "Ajoutez votre propre cellulaire à votre profil d'employé sous **Équipe → Employés**, pour que la boîte reconnaisse vos textos, et faites de même pour chaque membre de l'équipe.",
            "Appuyez sur **M'envoyer un texto d'essai**, puis répondez-y depuis votre téléphone avec une photo. Elle devrait atterrir sous **Classés** contre un chantier à votre horaire d'aujourd'hui — ou sous **Votre attention** si vous n'en avez aucun, ce qui est aussi une réussite.",
            "Donnez le numéro à l'équipe. C'est tout le déploiement : rien à installer et personne à inviter.",
          ] },
          { figure: "live:app-crew-inbox", caption: "Boîte équipe — le panneau Textos de l'équipe avec le numéro, le crédit et les tarifs, puis Votre attention — choisissez le chantier avec les pastilles candidates, et Classés." },
          { note: "Le panneau ne rapporte jamais une réussite qu'il n'a pas vérifiée : il demande au fournisseur téléphonique si le numéro est activé et peut recevoir des photos. S'il affiche « Ce numéro reçoit les textos mais pas les photos », dites-le à FieldQuo et le numéro est remplacé." },
        ],
      },
      {
        id: "how-a-photo-is-filed",
        heading: "Comment une photo trouve son chantier",
        blocks: [
          { p: "Les candidats sont les visites planifiées de l'expéditeur ce jour-là. Parmi elles, FieldQuo classe sans demander seulement quand il est sûr, de l'une de trois façons; tout le reste devient une question." },
          { bullets: [
            "**Nommé** — le texto mentionne le client, le titre ou le numéro civique d'un chantier (« 123 Oak terminé »).",
            "**Sur place** — les coordonnées de la photo sont à moins de 250 m d'un chantier et nettement plus près de lui que de tout autre.",
            "**Un seul** — la personne a exactement un chantier ce jour-là. Classé en silence.",
            "**Demander** — tout le reste. Le membre d'équipe reçoit « Which job is this for? 1. Nguyen 2. Patel — Reply with the number. » et la photo attend sous Votre attention jusqu'à ce que lui, ou vous, réponde.",
          ] },
          { p: "Une photo classée atterrit sur la visite du chantier avec le texto en légende et une étape (avant, pendant, après) déduite des mots; le membre d'équipe reçoit un court « Filed to Nguyen. 👍 » quand il y avait un choix, et rien quand il n'y en avait pas — une ligne qui piaille à chaque photo finit en sourdine. Si rien n'a atterri, elle dit que la photo attend dans la boîte du bureau plutôt que de faire semblant." },
          { tip: "Apprenez une seule habitude à l'équipe : mettre le nom du client ou le numéro civique dans le texto. Une photo nommée se classe d'elle-même à tout coup." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Ce que ça coûte",
        blocks: [
          { table: {
            head: ["Élément", "Coût"],
            rows: [
              ["Un texto de l'équipe", "2 ¢ par tranche de 160 caractères — un long texto compte pour deux."],
              ["Une photo de l'équipe", "5 ¢, quelle que soit la quantité de texte qui l'accompagne."],
              ["Une réponse de FieldQuo (la question, la confirmation, un avis de @mention)", "Les mêmes tarifs, et envoyée seulement quand le solde la couvre."],
              ["Le numéro", "4 $ par mois sur votre crédit, le premier mois d'avance. La ligne reste branchée jusqu'à 2 $ dans le rouge pour qu'une équipe en plein chantier ne soit pas coupée; au-delà, elle est mise en pause chez le fournisseur jusqu'à votre recharge."],
            ],
          } },
          { p: "Le solde est celui de la réceptionniste, en dollars américains; **Voir chaque frais** ouvre le relevé, et le panneau avertit quand il reste l'équivalent d'une vingtaine de photos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde dans l'équipe voit la ligne **Boîte équipe**, mais deux règles la restreignent. Configurer la ligne — acheter, tester, désactiver — revient au propriétaire, aux administrateurs et au niveau Gestionnaire, parce que ça dépense le crédit de l'entreprise; un Répartiteur est refusé avec cette raison. La lecture suit le cadran **Horaire** : les accès Équipe et Estimateur ne voient que leurs propres textos; Répartiteur, Gestionnaire, propriétaire et administrateurs voient ceux de tout le monde, y compris la file des numéros inconnus." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce qui est différent ici",
        blocks: [
          { p: "Sur les pages de prix auxquelles FieldQuo se compare, les points les plus proches sont les textos bidirectionnels avec les clients et les appels et textos dans l'app entre des gens qui ont l'app. Aucune ne nomme un numéro auquel votre équipe texte une photo qui se classe au chantier sans app ni compte, qui demande par texto quand elle ne peut pas trancher, et qui garde la photo pour une personne plutôt que de deviner." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je simplement utiliser le numéro de la réceptionniste?", a: "Non — il répond aux appels et ne peut pas recevoir de texto, et un numéro renvoyé renvoie les appels, jamais les textos. La ligne de l'équipe est un numéro texto distinct, et c'est pourquoi la configuration vit sur cette page et non sur l'écran du téléphone." },
      { q: "Un sous-traitant travaille pour deux entreprises. Où vont ses photos?", a: "À l'entreprise dont il a texté le numéro. Le numéro texté décide de l'entreprise; le numéro de l'expéditeur décide seulement de qui, à l'intérieur de celle-ci. Son téléphone peut être sur les deux listes." },
      { q: "Les photos reçoivent-elles des étiquettes?", a: "Une photo textée atterrit avec une étape déduite des mots (avant, pendant, après) et sans étiquette d'entreprise; ajoutez les étiquettes sur le chantier ensuite. Une mauvaise étiquette est une erreur qui revient à une personne, pas au système." },
    ],
  },

  "team-chat": {
    title: "Clavardage d'équipe",
    summary:
      "L'entreprise qui se parle : #general pour tout le monde, une salle par chantier actif pour l'équipe qui y est affectée et le bureau, des messages directs, des @mentions qui rejoignent un téléphone — et rien qui sort de l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "**Clavardage**, c'est la conversation de l'entreprise avec elle-même, dans FieldQuo. Tout le monde sur la liste est dans **#general**; chaque chantier au calendrier a une salle pour l'équipe qui y est affectée et le bureau; et deux personnes peuvent s'écrire directement. Les mentions avertissent la personne nommée, et sur un téléphone, Clavardage est l'onglet de l'équipe au bas de l'écran.",
      "Rien ici ne rejoint un client, et rien ne rejoint FieldQuo — la session en lecture seule de l'équipe de soutien peut voir les salles et ne peut pas y écrire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est le même outil de clavardage que **Messages** : la liste des conversations à gauche, le fil au centre avec les séparateurs de jour et la ligne des non-lus, les **Membres** de la salle à droite, et la zone de rédaction en bas. Les salles non lues montent en haut de la liste, parce que la liste existe pour répondre à « qui attend après moi ». Les salles sont créées et tenues à jour par FieldQuo à partir de votre liste d'équipe et de votre horaire — personne n'ajoute ni ne retire qui que ce soit à la main, et c'est pourquoi la liste ne peut jamais dériver de qui est vraiment sur un chantier." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Non lus** — toute salle contenant quelque chose que vous n'avez pas vu, les mentions comptées à part.",
            "**Entreprise** — **#general**, « Toute l'équipe ».",
            "**Travaux** — une salle par chantier planifié ou en cours, nommée d'après lui, « L'équipe affectée à ce travail, et le bureau », avec **Ouvrir le travail** dans son en-tête.",
            "**Messages directs** — « Juste vous deux. Personne d'autre ne peut lire ceci. »",
            "**Travaux terminés** — les salles des chantiers terminés ou annulés, gardées avec leur historique : « Ce travail est terminé. La salle est conservée pour mémoire. »",
          ] },
          { p: "**Nouveau message** en haut ouvre un message direct : cherchez dans l'équipe par nom ou courriel et choisissez une personne. La zone de rédaction affiche **Message à #general** ou **Message à Ana**; taper **@** ouvre **Mentionner quelqu'un** avec les gens de cette salle — ↑↓ pour choisir, Tab pour insérer." },
        ],
      },
      {
        id: "rooms",
        heading: "Les trois sortes de salles",
        blocks: [
          { table: {
            head: ["Salle", "Qui y est", "Comment elle est tenue"],
            rows: [
              ["**#general**", "Tous ceux qui peuvent se connecter à l'entreprise.", "On y entre dès que l'invitation est acceptée et on en sort quand le compte est désactivé. Personne ne peut la quitter."],
              ["Une salle de chantier", "Toute personne affectée à une visite du chantier, plus le propriétaire, les administrateurs et les gestionnaires, qui dirigent chaque chantier.", "Créée pour un chantier dès qu'il est planifié; les membres suivent les visites — affectez quelqu'un à une visite et il y est, retirez-le et il en sort. Conservée, sous Travaux terminés, quand le chantier se termine."],
              ["Un message direct", "Deux personnes.", "Ouvert depuis Nouveau message par l'une ou l'autre; il n'existe jamais qu'une salle pour une paire."],
            ],
          } },
          { note: "Aucune salle n'est créée pour un chantier non planifié — elle contiendrait le bureau qui se parle à lui-même d'un travail que personne n'a reçu. Planifiez une visite et la salle apparaît." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Mentions et notifications",
        blocks: [
          { p: "Un message ne peut mentionner que quelqu'un qui est dans la salle. La personne nommée voit le message teinté dans le fil, un compte de mentions sur la salle dans la liste et — si elle a activé les notifications du navigateur — « Ana vous a mentionné dans #Cuisine Nguyen » sur son téléphone ou son ordinateur, qui ouvre directement la salle. Un message direct avertit l'autre personne de la même façon. Ni l'auteur ni personne d'autre n'est averti." },
          { bullets: [
            "Activez les notifications par navigateur sous **Paramètres → Notifications** — voir [[notifications-for-you|Vos notifications : courriel et navigateur]].",
            "Un message qui n'a pas pu être poussé est quand même enregistré et compté; la notification est une courtoisie au sujet d'un message qui existe déjà.",
          ] },
          { note: "Une session de soutien en lecture seule voit « Vous consultez ce compte en lecture seule. L'accès support peut voir le clavardage sans y écrire. » Elle ne peut ni envoyer, ni mentionner, ni ouvrir un message direct." },
        ],
      },
      {
        id: "how-to",
        heading: "L'utiliser sur le chantier",
        blocks: [
          { steps: [
            "Sur un téléphone, touchez **Clavardage** dans la barre d'onglets au bas de l'écran; sur un ordinateur, ouvrez **Clavardage** dans la barre latérale.",
            "Ouvrez la salle du chantier sous **Travaux** et écrivez. Mettez **@** devant un nom pour être sûr que le bureau voie une question.",
            "Pour joindre une personne en privé, appuyez sur **Nouveau message**, cherchez son nom et envoyez.",
            "Quand le chantier est terminé, sa salle passe sous **Travaux terminés** — « qu'est-ce qu'on avait convenu pour la cuisine Nguyen » a encore une réponse en mars.",
          ] },
          { figure: "harness:chat", caption: "Clavardage — les salles regroupées en Non lus, Entreprise, Travaux, Messages directs et Travaux terminés, le fil d'une salle de chantier, et ses Membres." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde sur la liste, y compris les accès Équipe — le clavardage est l'écran de l'équipe et n'a pas de niveau d'accès propre. Ce qu'une personne voit, ce sont les salles où elle est : #general, les chantiers où elle est affectée, et ses messages directs. Le propriétaire, les administrateurs et les gestionnaires sont dans chaque salle de chantier." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce qui est différent ici",
        blocks: [
          { p: "Aucune des pages de prix auxquelles FieldQuo se compare — Jobber, Housecall Pro, QuoteIQ, ServiceTitan, Projul — n'affiche un clavardage d'équipe à quelque palier que ce soit. Ici, il est dans chaque forfait, pour chaque accès, y compris les accès équipe gratuits, avec des salles de chantier tirées de l'horaire plutôt que tenues à la main." },
        ],
      },
    ],
    faq: [
      { q: "Un client peut-il voir quoi que ce soit ici?", a: "Non. Le clavardage est réservé aux membres de votre entreprise. Les conversations avec les clients vivent dans Messages, et les textos aux clients sont les deux décrits dans [[texting-clients-what-is-and-is-not-automated|Textos aux clients : ce qui est automatisé et ce qui ne l'est pas]]." },
      { q: "Comment ajouter quelqu'un à la salle d'un chantier?", a: "Affectez-le à une visite du chantier. Les membres découlent de l'horaire, donc il n'y a pas de bouton d'ajout — et le retirer des visites le retire de la salle." },
      { q: "Puis-je supprimer un message ou une salle?", a: "Non. La salle d'un chantier terminé est conservée pour mémoire, et les messages d'un membre parti restent attribués à « Quelqu'un qui est parti »." },
    ],
  },

  "texting-clients-what-is-and-is-not-automated": {
    title: "Textos aux clients : ce qui est automatisé et ce qui ne l'est pas",
    summary:
      "Exactement deux textos rejoignent vos clients — « en route » et le rappel de rendez-vous — dans la langue du client, avec votre formulation si vous l'avez réglée. Ce qui déclenche chacun, ce qui n'est pas texté, et ce qui arrive quand un client répond.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo texte vos clients dans deux situations et aucune autre : quand un membre d'équipe marque une visite **En route**, et avant un rendez-vous, au délai que vous avez choisi. Les deux partent au nom de votre entreprise, dans la langue du client, avec la formulation que vous avez réglée sous **Paramètres → Messages aux clients** ou la formulation intégrée si vous n'y avez pas touché.",
      "Tout le reste — une soumission, une facture, une confirmation de réservation, une relance — passe par courriel, et il n'y a pas de textos bidirectionnels avec les clients. Cet article trace cette ligne précisément pour que personne ne promette un texto que le produit n'envoie pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les textos sont la dernière chose qu'un client lit avant l'arrivée du camion, alors FieldQuo les garde courts, dans la langue du client, et peu nombreux. Les deux qui existent sont branchés de bout en bout — un vrai déclencheur, un vrai envoi, une vérification de désabonnement avant chacun. Plusieurs autres existent seulement comme formulation et ne sont volontairement pas offerts à la modification tant qu'ils n'envoient rien, parce qu'un éditeur pour un message qui ne part jamais serait une commande morte." },
        ],
      },
      {
        id: "what-is-automated",
        heading: "Les deux textos qui partent",
        blocks: [
          { table: {
            head: ["Texto", "Quand il part", "Formulation intégrée (en français)"],
            rows: [
              ["**En route**", "Au moment où le statut d'une visite passe à **En route** — habituellement le membre d'équipe qui appuie sur son téléphone. Seulement si le client du chantier a un numéro de téléphone.", "« Northside Painting : Dave est en route, arrivée dans 20 min. Répondez si vous devez reporter. »"],
              ["**Rappel de rendez-vous**", "Dès qu'un rendez-vous de votre Calendrier entre dans le délai choisi sous **Paramètres → Notifications** — 2, 24 ou 48 heures avant. Vérifié chaque heure; envoyé une fois par rendez-vous.", "« Northside Painting : Rappel — votre rendez-vous est mar. 15 sept., 14 h au 123 Oak St. Répondez STOP pour ne plus recevoir. »"],
            ],
          } },
          { p: "Les rappels de rendez-vous sont à **Désactivé** tant qu'un propriétaire ou un administrateur ne choisit pas un délai — chaque rappel est un texto que l'entreprise paie, donc rien ne part que personne n'a activé. Ils visent les rendez-vous du Calendrier (réservations sur votre page de rendez-vous, appels réservés par la réceptionniste, rendez-vous que vous ajoutez); une visite sur un chantier est un dossier différent et ne reçoit pas de rappel par texto." },
          { figure: "live:app-settings-messages", caption: "Paramètres → Messages aux clients — un éditeur par texto, En route et Rappel de rendez-vous, avec les jetons, l'aperçu « Votre client voit : », Enregistrer et Utiliser le texte par défaut." },
        ],
      },
      {
        id: "what-is-not",
        heading: "Ce qui n'est pas texté",
        blocks: [
          { bullets: [
            "**Pas de textos bidirectionnels.** La réponse d'un client à un texto n'est livrée sur aucun écran de FieldQuo. La boîte Messages, c'est Facebook, Instagram et WhatsApp; ce n'est pas le SMS.",
            "**Pas de texto de confirmation de réservation.** Une réservation faite sur votre page de rendez-vous est confirmée par courriel. La formulation d'un texto de confirmation existe mais n'est pas branchée pour l'envoi, donc elle n'est pas offerte à la modification.",
            "**Pas de textos de soumission, de facture ou de fin de chantier.** « Votre soumission est prête », « Facture en retard » et « Vos travaux sont terminés » passent uniquement par courriel — les règles de relance envoient des gabarits de courriel et rien d'autre.",
            "**La réceptionniste ne peut pas texter.** Quand elle doit diriger un appelant vers votre page de rendez-vous, elle lit le lien à voix haute et dit clairement qu'elle ne peut pas le texter.",
            "**Pas de textos de marketing.** Les campagnes sont par courriel; il n'y a pas de fonction d'envoi massif de textos.",
          ] },
          { warning: "La formulation intégrée du texto « en route » se termine par « Répondez si vous devez reporter », mais une réponse n'est pas lue par FieldQuo. Si vous voulez que les clients puissent répondre à ce texto, mettez le numéro de votre bureau dans votre formulation personnalisée — ou retirez l'invitation." },
        ],
      },
      {
        id: "language-and-wording",
        heading: "Langue et formulation",
        blocks: [
          { p: "La formulation intégrée existe en anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien, et chaque client reçoit la sienne — la même règle que pour sa soumission et son courriel d'accompagnement. La date et l'heure d'un rappel sont écrites dans le format du client et dans le fuseau horaire de votre entreprise, pour qu'une visite à 14 h à Toronto ne soit jamais textée comme 18 h. Votre formulation personnalisée est rédigée une fois, dans votre langue de travail, et n'est utilisée que pour les clients qui lisent cette langue; tous les autres reçoivent la traduction intégrée. Rien n'est traduit automatiquement au moment de l'envoi." },
          { note: "Le détail de l'éditeur, des jetons et de **Utiliser le texte par défaut** se trouve dans [[client-texts-on-my-way-and-reminders|Les deux textos que reçoivent vos clients]]. Passé 160 caractères, un texto se divise en deux." },
        ],
      },
      {
        id: "opting-out",
        heading: "Se désabonner",
        blocks: [
          { p: "Avant chaque texto, FieldQuo vérifie le numéro du client contre la liste de désabonnement de votre entreprise : un numéro qui a demandé de ne plus recevoir de textos, ou de ne pas être appelé, est ignoré — le texto « en route » comme le rappel. Le rappel se termine par « Répondez STOP pour ne plus recevoir » dans toutes les langues, et STOP est gardé en anglais exprès parce que les opérateurs le traitent comme universel." },
          { p: "Aucun consentement marketing n'entre en jeu : les deux textos concernent une visite que le client a réservée. Ni l'un ni l'autre ne porte de lien de désabonnement, et ni l'un ni l'autre n'est envoyé à un client sans numéro de téléphone au dossier." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je texter un client depuis FieldQuo?", a: "Non. Il n'y a pas de zone de rédaction pour les textos aux clients ni de boîte SMS client. Les conversations avec les clients vivent dans Messages (Facebook, Instagram, WhatsApp); tout le reste passe par courriel." },
      { q: "Une réservation sur ma page de rendez-vous déclenche-t-elle un texto?", a: "Non — la confirmation passe par courriel. Le texto de rappel part plus tard, au délai que vous avez réglé, si les rappels sont activés." },
      { q: "Pourquoi un client a-t-il reçu le rappel en anglais alors que sa soumission était en français?", a: "Le texto suit la langue inscrite au dossier du client, comme la soumission. Vérifiez la langue du client; un client sans langue définie reçoit celle par défaut de votre entreprise." },
    ],
  },
};
