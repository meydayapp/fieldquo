// content/help/fr/settings-3.js
//
// Partie 3 de la catégorie « settings » en français (voir le composeur,
// settings.js). Slugs de cette partie (lib/help/tree.js) :
// settings-job-photo-tags, settings-client-messages, settings-follow-ups,
// settings-notifications, settings-email-domain, settings-payments,
// settings-meta-ads, settings-expense-tracking, settings-ai-credit,
// settings-payroll, settings-website, settings-instant-quotes.
//
// Même structure que l'anglais, article par article : mêmes slugs, mêmes
// sections dans le même ordre, mêmes blocs, mêmes figures —
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran viennent
// du bloc `fr` de app/i18n/appMessages.js; les niveaux d'accès de
// lib/permissions/settingsAccess.js.
export const ARTICLES = {
  "settings-job-photo-tags": {
    title: "Étiquettes des photos de chantier",
    summary:
      "Vos propres mots pour décrire ce qui se passe sur une photo de chantier — ponçage, apprêt, couche de finition — et comment ils s'ajoutent aux quatre étapes fixes.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Étiquettes des photos de chantier** est l'endroit où vous écrivez le vocabulaire que votre bureau utilise pour décrire une photo venue du terrain. Une étiquette est un libellé coloré — « Ponçage », « Démolition », « Liste de retouches » — que quiconque trie les photos d'un chantier peut poser sur un cliché, et selon lequel la chronologie des photos du chantier peut filtrer. Les étiquettes se superposent aux quatre étapes intégrées (avant, en cours, terminé, problème), qui restent fixes parce qu'elles alimentent la galerie avant/après de votre site web et gardent une photo de problème hors de celle-ci.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran tient en une carte : la liste ordonnée de vos étiquettes avec une pastille de couleur chacune, un petit formulaire pour en ajouter une, et un bloc d'étiquettes de départ que vous pouvez adopter d'une seule pression. Une étiquette a un nom (60 caractères au plus), une couleur parmi huit pastilles ou aucune, et une position dans la liste — l'ordre de la liste est l'ordre dans lequel le sélecteur les propose sur une photo." },
          { p: "Une étiquette n'est jamais supprimée. Elle est **retirée** : les photos qui la portent déjà la gardent, et elle cesse simplement d'être proposée sur les nouvelles. C'est la même règle que FieldQuo applique à une personne qui quitte l'entreprise, et pour la même raison — deux cents photos étiquetées « Apprêt » ne doivent pas perdre leur étiquette parce que vous avez cessé d'employer le mot." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Étiquettes des photos de chantier** — le titre, avec la phrase qui explique que les étiquettes s'ajoutent à avant / en cours / terminé / problème.",
            "La liste des étiquettes — chaque étiquette active avec sa pastille, **Monter**, **Descendre** et **Retirer**. Les étiquettes retirées suivent en bas, grisées, avec le mot **retirée** et un bouton **Réactiver**.",
            "**Ajouter une étiquette** — une case **Nom de l'étiquette**, la rangée **Couleur** de pastilles, et **Ajouter l'étiquette**.",
            "**Étiquettes de départ** — un ensemble générique affiché en puces (Démolition, Préparation, Ponçage, Apprêt, Installation, Couche de finition, Liste de retouches, Retouche) et un seul bouton, **Ajouter les étiquettes de départ**. Rien n'est ajouté tant que vous n'appuyez pas dessus.",
            "**Aucune étiquette pour l'instant.** quand l'entreprise n'en a aucune, et **Vous avez déjà toutes les étiquettes de départ.** une fois l'ensemble de départ entièrement adopté.",
          ] },
        ],
      },
      {
        id: "add-and-arrange",
        heading: "Comment ajouter et ordonner des étiquettes",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Étiquettes des photos de chantier**.",
            "Tapez un nom sous **Ajouter une étiquette**, choisissez une couleur (ou laissez vide), puis appuyez sur **Ajouter l'étiquette**. Un nom que vous utilisez déjà est refusé — une étiquette par mot.",
            "Appuyez sur le nom d'une étiquette pour la renommer ou changer sa couleur, puis **Enregistrer**. Utilisez **Monter** et **Descendre** pour fixer l'ordre que l'équipe voit.",
            "Pour cesser de proposer une étiquette, appuyez sur **Retirer** et confirmez. Pour la proposer de nouveau plus tard, appuyez sur **Réactiver**.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Paramètres → Étiquettes des photos de chantier — la liste ordonnée avec ses pastilles, le formulaire Ajouter une étiquette et l'ensemble de départ." },
          { note: "**Ajouter les étiquettes de départ** ne crée que les noms de départ que vous n'avez pas déjà — par nom, sans tenir compte de la casse — pour qu'une étiquette que vous avez renommée ou retirée ne soit pas recréée dans votre dos." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["**Ajouter l'étiquette**", "Crée l'étiquette à la fin de la liste. Elle est proposée sur les nouvelles photos immédiatement."],
              ["**Monter** / **Descendre**", "Change l'ordre de toute la liste; le sélecteur sur une photo le suit."],
              ["**Retirer**", "Cache l'étiquette du sélecteur sur les nouvelles photos. Chaque photo déjà étiquetée la garde, et le filtre du chantier la liste encore tant qu'une photo la porte."],
              ["**Réactiver**", "Remet une étiquette retirée dans le sélecteur, à son ancienne position."],
              ["**Ajouter les étiquettes de départ**", "Ajoute ceux des huit noms de départ qui vous manquent, après vos propres étiquettes."],
            ],
          } },
        ],
      },
      {
        id: "where-tags-are-used",
        heading: "Où les étiquettes servent",
        blocks: [
          { p: "Les étiquettes se posent sur la page du chantier, dans le panneau de tri des photos, par quiconque a un accès permettant de modifier les chantiers. La chronologie des photos du chantier, au-dessus, a une liste déroulante **Filtrer par étiquette** construite à partir des étiquettes réellement portées par les photos de ce chantier, et un lien **Gérer les étiquettes** qui ramène à cet écran. Étiqueter une photo ne change jamais son étape, ne la met jamais en vedette sur le site web et ne peut pas rendre publique une photo de problème — voir [[job-photos-and-tags|Photos de chantier et étiquettes]]." },
          { tip: "Choisissez des étiquettes qui nomment une étape, pas un jugement. « Couche de finition » dit au bureau où en est un chantier; « Beau » ne dit rien à personne." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne apparaît pour les propriétaires, les administrateurs et les niveaux Répartiteur et Gestionnaire — quiconque peut gérer l'équipe. Tous les autres peuvent quand même lire la liste des étiquettes là où elle compte, sur les photos du chantier, parce que le sélecteur en a besoin; ils ne peuvent simplement pas en créer, en renommer ni en retirer une." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je supprimer une étiquette pour de bon?", a: "Non. Retirez-la. Les photos qui la portent la gardent, et elle disparaît du sélecteur sur les nouvelles photos. Il n'y a pas de bouton de suppression, et c'est voulu." },
      { q: "Une étiquette peut-elle remplacer l'étape « problème »?", a: "Non. Les étapes et les étiquettes vivent à des endroits différents. Une étiquette littéralement nommée « Problème » est décorative; seule l'étape garde une photo hors de votre galerie publique." },
      { q: "Les équipiers choisissent-ils une étiquette quand ils textent une photo?", a: "Non. Les photos arrivent avec une étape devinée à partir du texte; les étiquettes s'ajoutent ensuite sur la page du chantier, par quelqu'un qui peut modifier les chantiers." },
    ],
  },

  "settings-client-messages": {
    title: "Messages aux clients",
    summary:
      "Les deux textos que reçoivent vos clients — En route et le rappel de rendez-vous — avec les champs que vous pouvez utiliser, l'aperçu en direct et la façon dont la langue est décidée.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Messages aux clients** contient la formulation des textos que FieldQuo envoie à vos clients au nom de votre entreprise. Seuls les messages qui partent réellement sont listés, alors l'écran a aujourd'hui exactement deux éditeurs : **En route** et **Rappel de rendez-vous**. Laissez-en un tel quel et le client reçoit la formulation intégrée de FieldQuo; modifiez-le et il reçoit la vôtre, avec sous la case un aperçu qui montre exactement ce qui arrivera.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque éditeur est une carte : le nom du message, une case de trois lignes, les puces des champs que vous pouvez utiliser, un aperçu **Votre client voit :** rempli de valeurs d'exemple (le nom et le téléphone de votre entreprise remplacent les exemples), **Enregistrer**, et **Utiliser le texte par défaut** une fois que vous l'avez personnalisé. Un message contenant un champ qui n'existe pas ne peut pas être enregistré — l'écran le refuse, et le serveur le refuse encore — pour que personne ne texte jamais à un client un « {price} » brut." },
          { note: "Les rappels de rendez-vous partent par texto seulement; il n'y a pas de rappel par courriel. Le fait que les rappels partent ou non, et combien de temps avant la visite, se règle sous [[settings-notifications|Paramètres → Notifications]] — cet écran ne décide que des mots." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Messages aux clients — Les textos que reçoivent vos clients.** Le sous-titre énonce aussi la règle de langue décrite plus bas.",
            "**En route** — le texto envoyé quand un équipier appuie sur En route sur une visite. Champs : {company}, {worker}, {name}, {eta}, {phone}. Une mention **Personnalisé** apparaît une fois que vous avez enregistré votre propre formulation.",
            "**Rappel de rendez-vous** — le texto que l'horaire des rappels envoie avant un rendez-vous ou une visite de chantier. Champs : {company}, {when}, {location}.",
            "Sous chaque case : **Votre client voit :** avec l'aperçu, puis **Enregistrer** et, sur un message personnalisé, **Utiliser le texte par défaut**.",
          ] },
        ],
      },
      {
        id: "edit-a-text",
        heading: "Comment changer un texto",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Messages aux clients**.",
            "Écrivez le message dans la case du texto que vous voulez changer. Touchez une puce de champ pour l'insérer à l'endroit du curseur.",
            "Lisez **Votre client voit :** — c'est le message avec des valeurs d'exemple à la place des champs.",
            "Appuyez sur **Enregistrer**. Le bouton reste désactivé tant que la case contient un champ inconnu ou correspond à ce qui est déjà enregistré.",
            "Pour revenir à la formulation de FieldQuo, appuyez sur **Utiliser le texte par défaut**. La formulation enregistrée est retirée, pas vidée.",
          ] },
          { figure: "live:app-settings-messages", caption: "Paramètres → Messages aux clients — l'éditeur En route avec ses puces de champs et l'aperçu Votre client voit." },
          { tip: "Un champ sans valeur disparaît proprement. Écrivez « Arrivée {eta} » et une visite sans heure d'arrivée connue envoie « Arrivée » sans blanc parasite — vous n'avez pas besoin de deux versions." },
        ],
      },
      {
        id: "fields-you-can-use",
        heading: "Les champs que vous pouvez utiliser",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il devient", "Message"],
            rows: [
              ["{company}", "le nom de votre entreprise", "les deux"],
              ["{worker}", "l'équipier assigné", "En route"],
              ["{name}", "le prénom du client", "En route"],
              ["{eta}", "l'arrivée estimée, si elle est connue — calculée à partir de la position de l'équipier au moment où il appuie sur le bouton", "En route"],
              ["{phone}", "le téléphone de votre entreprise", "En route"],
              ["{when}", "l'heure du rendez-vous, dans la langue du client et le fuseau horaire de votre entreprise", "Rappel de rendez-vous"],
              ["{location}", "le lieu de la visite", "Rappel de rendez-vous"],
            ],
          } },
        ],
      },
      {
        id: "languages",
        heading: "Quelle langue le client reçoit",
        blocks: [
          { p: "Votre formulation va aux clients qui lisent la langue par défaut de votre entreprise. Un client dont la langue est différente reçoit la formulation intégrée de FieldQuo dans la sienne — les mêmes huit langues que sa soumission. Rien de ce que vous tapez n'est traduit par machine à l'envoi." },
          { warning: "Les réponses au texto En route ne sont lues par personne. La formulation intégrée renvoie le client vers le téléphone de votre entreprise pour cette raison; si vous écrivez la vôtre, gardez-y {phone}." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs et les niveaux Répartiteur et Gestionnaire. Enregistrer un message exige le même accès; la ligne est cachée à tous les autres plutôt qu'affichée avec des boutons qui seraient refusés." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je modifier le texto de confirmation de réservation?", a: "Pas d'ici. Il existe et il part, mais il n'est pas encore modifiable, alors l'écran n'affiche pas d'éditeur pour lui." },
      { q: "Changer la formulation change-t-il qui reçoit le rappel?", a: "Non. Cet écran ne touche qu'aux mots. Activez ou désactivez les rappels, et choisissez 2, 24 ou 48 heures, sous Paramètres → Notifications." },
      { q: "Pourquoi mon client a-t-il reçu le texte par défaut alors que je l'avais personnalisé?", a: "Sa langue n'est pas la langue par défaut de votre entreprise. La formulation personnalisée n'est envoyée qu'aux clients qui lisent la langue dans laquelle elle a été écrite; tous les autres reçoivent le texte intégré dans leur propre langue." },
    ],
  },

  "settings-follow-ups": {
    title: "Relances",
    summary:
      "Des règles qui envoient un gabarit par courriel un délai donné après qu'une demande, une soumission, une facture ou un chantier atteint un état — les quatre déclencheurs, le délai, et quand une règle s'arrête.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Relances** est l'endroit où vous réglez les relances automatiques : « trois jours après l'envoi d'une soumission sans réponse, envoyer ce courriel »; « cinq jours après qu'une facture est en retard, envoyer celui-là ». Chaque règle est un déclencheur, un délai et un gabarit de courriel. FieldQuo vérifie les règles une fois par jour, envoie à quiconque y répond, et s'arrête dès que le client agit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est une liste de règles sous un schéma en lecture seule appelé **Comment tout cela s’exécute**, dessiné à partir des règles elles-mêmes : Déclencheur → Attendre → Envoyer un courriel → Arrêt. Plusieurs règles peuvent partager un déclencheur — un petit rappel à trois jours et un plus ferme à sept — et le schéma les empile dans l'ordre où elles se déclenchent." },
          { p: "Une règle a besoin d'un gabarit de courriel du bon type. Seuls les gabarits de type **Relance**, **Marketing** ou **Personnalisé** sont proposés, jamais un gabarit de soumission, d'instructions ou de reçu. Sans aucun de ceux-là, l'écran le dit et vous renvoie vers [[settings-email-templates|Modèles de courriel]]; le bouton **Nouvelle règle** reste désactivé tant qu'il n'en existe pas un." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Relances — Envoyez automatiquement un gabarit un certain temps après qu'une soumission, une facture ou un chantier atteint un état donné — sans rappels manuels.** et le bouton **Nouvelle règle**.",
            "**Comment tout cela s’exécute** — le schéma, une colonne par déclencheur, qui montre l'attente de chaque règle, son gabarit et les conditions d'arrêt. Une règle en pause est dessinée comme ignorée.",
            "La liste des règles — le nom de chaque règle, **En pause** quand elle est arrêtée, une ligne comme « 3 jours après Soumission envoyée, sans réponse → Relance de soumission », les deux phrases d'arrêt, puis **Mettre en pause** ou **Activer** et un bouton de suppression.",
            "**Aucune règle de relance pour l'instant.** pour une nouvelle entreprise.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "Comment créer une règle",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Relances** et appuyez sur **Nouvelle règle**.",
            "Donnez-lui un **Nom de la règle (facultatif)** — laissé vide, elle prend le nom du déclencheur.",
            "Choisissez le **Déclencheur**. La phrase sous la liste déroulante dit exactement quand il se déclenche.",
            "Réglez le **Délai** et son **Unité** (heures ou jours). Chaque déclencheur propose une valeur par défaut raisonnable.",
            "Choisissez le **Gabarit à envoyer** parmi vos gabarits admissibles.",
            "Appuyez sur **Créer la règle**. Elle est active immédiatement et sera considérée à la prochaine exécution quotidienne.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Paramètres → Relances — le schéma Comment tout cela s’exécute au-dessus de la liste des règles, chaque règle avec Mettre en pause et la suppression." },
          { note: "Choisir **Nouvelle demande, personne n'a répondu** affiche une ligne de plus : une demande n'a pas encore de soumission, alors les champs de soumission d'un gabarit ({{quoteUrl}}, {{quoteTotal}}, {{quoteNumber}}) sortent vides. Il peut quand même remplir le nom, le téléphone et l'adresse du client, les coordonnées de votre entreprise, et le service demandé." },
        ],
      },
      {
        id: "triggers",
        heading: "Les quatre déclencheurs",
        blocks: [
          { table: {
            head: ["Déclencheur", "Se déclenche quand", "Délai par défaut", "S'arrête"],
            rows: [
              ["**Nouvelle demande, personne n'a répondu**", "une demande est restée « nouvelle » pendant le délai, sans soumission et sans que personne ne l'ait marquée contactée", "2 jours", "dès que la demande est marquée contactée, soumissionnée, gagnée ou perdue"],
              ["**Soumission envoyée, sans réponse**", "la soumission est restée « envoyée » pendant le délai, sans acceptation ni refus", "3 jours", "dès que le client accepte ou refuse la soumission"],
              ["**Facture en retard**", "une facture impayée a dépassé son échéance du délai indiqué", "5 jours", "dès que la facture est payée"],
              ["**Chantier terminé**", "un chantier est marqué terminé depuis le délai indiqué — un merci ou une demande d'avis", "2 jours", "si le chantier est rouvert"],
            ],
          } },
        ],
      },
      {
        id: "how-rules-run",
        heading: "Comment les règles s'exécutent",
        blocks: [
          { bullets: [
            "Les règles sont vérifiées **une fois par jour**, pas à l'instant où le délai est écoulé. Un courriel arrive à la première exécution après la fin du délai.",
            "Chaque soumission, facture, chantier ou demande reçoit le courriel d'une règle donnée **une seule fois**. Deux règles sur un même déclencheur font deux courriels; une règle ne se répète jamais.",
            "Les clients sans adresse courriel au dossier sont ignorés.",
            "Le courriel part de votre propre domaine si vous en avez vérifié un, sinon de l'adresse partagée de FieldQuo sous le nom de votre entreprise — voir [[settings-email-domain|Domaine d'envoi]]. Les réponses vont au courriel de votre entreprise.",
            "**Chantier terminé** est un envoi marketing : un client désabonné de vos courriels marketing est ignoré, et le courriel porte un lien de désabonnement. Les trois autres sont transactionnels et partent toujours.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs et les niveaux Répartiteur et Gestionnaire. Créer, mettre en pause et supprimer une règle exigent cet accès, alors la ligne est cachée à tous les autres. Les règles valent pour toute l'entreprise : il n'y a pas de relance par personne." },
        ],
      },
    ],
    faq: [
      { q: "Mettre une règle en pause annule-t-il les courriels déjà envoyés?", a: "Non. Cela arrête les envois futurs. Ce qui est déjà livré reste livré, et la règle se souvient de qui elle a écrit, alors la réactiver ne renvoie rien." },
      { q: "Que se passe-t-il si je supprime le gabarit qu'une règle utilise?", a: "La règle affiche (gabarit supprimé) et n'envoie rien. Supprimez la règle ou créez-en une nouvelle sur un autre gabarit." },
      { q: "Une règle peut-elle envoyer un texto plutôt qu'un courriel?", a: "Non. Les règles de relance sont par courriel seulement. Les textos que FieldQuo envoie sont les deux sous Messages aux clients." },
      { q: "Pourquoi le courriel est-il arrivé un jour après mon délai?", a: "Les règles s'exécutent selon un horaire quotidien. Un délai de 3 jours signifie que le courriel part à la première exécution quotidienne après le troisième jour, pas à l'heure exacte." },
    ],
  },

  "settings-notifications": {
    title: "Notifications",
    summary:
      "Quand FieldQuo envoie un courriel aux propriétaires pour une grande soumission ou une facture payée, combien de temps à l'avance les clients reçoivent un texto de rappel, et les notifications du navigateur pour vous.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Notifications** se compose de quatre cartes. Deux décident quand FieldQuo envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur — une grande soumission créée, une facture payée en ligne. Une décide si les clients reçoivent un texto de rappel avant une visite et combien de temps à l'avance. La dernière est personnelle : si ce navigateur, sur cet appareil, vous montre une notification système quand quelque chose se passe dans votre compte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Seules les alertes qui partent réellement sont listées. Il y a un seuil à taper (le montant de la grande soumission), un interrupteur activé par défaut (facture payée), un choix de préavis (rappels), et un interrupteur par navigateur. Une carte de pied de page, **Courriels destinés aux clients**, vous rappelle que les courriels de soumission, de reçu et de relance se configurent ailleurs : leur contenu vit dans [[settings-email-templates|Modèles de courriel]], le moment de leur envoi dans [[settings-follow-ups|Relances]]." },
        ],
      },
      {
        id: "large-quote",
        heading: "Grande soumission créée",
        blocks: [
          { p: "**Envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur lorsqu'un membre de votre équipe rédige une soumission supérieure à ce montant.** Tant que vous n'avez pas fixé de montant, la carte dit **Pas encore configuré — aucune alerte n'est envoyée.**" },
          { steps: [
            "Cochez **Envoyer cette alerte**.",
            "Tapez le seuil sous **M'alerter au-dessus de** — dans votre devise; les soumissions entières au-dessus de ce montant sont visées.",
            "Appuyez sur **Enregistrer**. Décochez la case et enregistrez pour la désactiver; le montant est conservé.",
            "Attendez-vous au courriel en moins d'une journée : la vérification suit un horaire quotidien, pas l'instant où une soumission est enregistrée.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Paramètres → Notifications — le seuil de grande soumission, l'interrupteur de facture payée, les préavis de rappel et la carte du navigateur." },
        ],
      },
      {
        id: "invoice-paid",
        heading: "Facture payée",
        blocks: [
          { p: "**Envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur lorsqu'un client paie une facture en ligne. Activé par défaut.** La seule case **Envoyer cette alerte** s'enregistre dès que vous la cochez ou la décochez. Une entreprise qui n'y a jamais touché est activée; seul un décochage explicite la désactive. Les paiements manuels que vous enregistrez vous-même ne la déclenchent pas." },
        ],
      },
      {
        id: "appointment-reminders",
        heading: "Rappels de rendez-vous",
        blocks: [
          { p: "**Envoyez au client un texto de rappel avant son rendez-vous ou sa visite de chantier. Envoyé au nom de votre entreprise; le client peut répondre STOP pour se désabonner.** Quatre pastilles, dont une est sélectionnée : **Désactivé**, **2 heures avant**, **24 heures avant**, **48 heures avant**. En appuyer une l'enregistre." },
          { bullets: [
            "Les rappels visent autant les rendez-vous que les visites de chantier, une fois chacun — jamais deux fois pour la même visite.",
            "Un client qui s'est désabonné ne reçoit jamais de texto, et une visite sans numéro de téléphone de client n'envoie simplement rien.",
            "La vérification s'exécute chaque heure, alors un rappel de 24 heures arrive dans l'heure qui précède la marque des 24 heures.",
            "Les rappels sont inclus dans votre forfait; rien n'est facturé par texto. La formulation est à vous sous [[settings-client-messages|Messages aux clients]].",
          ] },
          { note: "Les rappels partent par texto seulement. Il n'y a pas de rappel par courriel. Tous les détails : [[appointment-reminders|Rappels de rendez-vous]]." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Notifications du navigateur",
        blocks: [
          { p: "**M'avertir dans ce navigateur** est un interrupteur par personne et par appareil. L'activer demande la permission au navigateur; dès lors, toute nouvelle activité — les mêmes événements que la cloche de la barre du haut, et les nouveaux messages de votre boîte de réception — s'affiche en notification système pendant que FieldQuo est dans un autre onglet. Là où le push est configuré sur le déploiement, les mêmes événements arrivent onglet fermé." },
          { bullets: [
            "La carte énonce clairement l'autorisation du navigateur : **accordée**, **bloquée** (avec l'endroit où la changer), ou **pas encore demandée**.",
            "**Envoyer une notification test** en affiche une tout de suite, pour que vous voyiez la chose elle-même plutôt que de vous fier à un message éphémère.",
            "Sur iPhone et iPad, ajoutez d'abord FieldQuo à l'écran d'accueil — Safari ne livre les notifications qu'aux apps web installées.",
          ] },
          { tip: "Une autorisation bloquée ne se défait pas depuis une page. Autorisez les notifications pour le site dans les réglages du navigateur lui-même, puis réactivez l'interrupteur." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. Les cartes qui valent pour toute l'entreprise écrivent des règles que les routes refusent à tout autre, et la carte du navigateur est affichée sur cet écran aux mêmes personnes; la ligne est cachée à tous les autres niveaux." },
        ],
      },
    ],
    faq: [
      { q: "Qui reçoit les courriels de grande soumission et de facture payée?", a: "Chaque membre ayant un rôle de propriétaire ou d'administrateur et une adresse courriel. Il n'y a pas de désabonnement par personne sur cet écran." },
      { q: "J'ai rédigé une soumission de 15 000 $ et rien n'est arrivé. Pourquoi?", a: "La vérification des grandes soumissions s'exécute une fois par jour. Si le seuil est fixé et la case cochée, le courriel arrive à la prochaine exécution." },
      { q: "Puis-je recevoir un texto plutôt qu'un courriel pour ces alertes?", a: "Non. Les alertes qui vous sont destinées sont des courriels et, si vous l'activez, une notification du navigateur. Les textos sont pour les clients." },
    ],
  },

  "settings-email-domain": {
    title: "Domaine d'envoi",
    summary:
      "Envoyez les soumissions, les factures et tous les autres courriels aux clients depuis votre propre domaine plutôt que l'adresse partagée de FieldQuo — les enregistrements DNS, les états, l'adresse d'expéditeur et où vont les réponses.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Domaine d'envoi** est la promesse de marque blanche prise au pied de la lettre pour le courriel. Tant que vous ne l'avez pas configuré, les courriels aux clients partent de l'adresse partagée de FieldQuo sous le nom de votre entreprise. Une fois votre domaine vérifié, la ligne De se lit quotes@send.votreentreprise.com — votre nom, votre domaine, aucun « via fieldquo.com » à côté — et la délivrabilité s'améliore parce que le courrier est signé comme le vôtre.",
      "Rien ici ne crée de boîte aux lettres. C'est la vérification du domaine qui accorde la permission d'envoyer en son nom; l'adresse n'a jamais besoin d'exister comme boîte de réception. Les réponses sont traitées à part, par le courriel d'entreprise défini sous Profil de l'entreprise.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Vous connectez un **sous-domaine** — send.votreentreprise.com plutôt que votreentreprise.com — pour que cet envoi reste séparé de votre courriel quotidien et ne puisse pas interférer avec votre boîte de réception existante. FieldQuo l'inscrit chez son fournisseur de courriel, vous montre les enregistrements DNS à ajouter, et revérifie de lui-même toutes les 30 secondes tant que l'état est en attente." },
          { p: "Chaque courriel que FieldQuo envoie en votre nom utilise le domaine vérifié : soumissions, factures et reçus, règles de relance, demandes d'avis, factures de plans de service, campagnes marketing. Déconnecter renvoie tout vers l'adresse partagée; rien de ce qui est déjà envoyé ne change." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "La carte d'état — votre domaine (ou **Aucun domaine connecté**), la phrase **Les courriels seront envoyés depuis …** ou **Vos courriels sont actuellement envoyés depuis l'adresse partagée de FieldQuo, en utilisant le nom de votre entreprise.**, et une pastille d'état. Une fois connecté : **Vérifier** (jusqu'à la vérification) et **Déconnecter**.",
            "**Connecter un domaine** — affiché seulement avant la connexion : une case et le bouton **Connecter**.",
            "**Ajoutez ces enregistrements DNS** — affiché tant que la vérification est en attente ou a échoué : la marche à suivre en cinq étapes et chaque enregistrement avec son Type, son Nom, sa Valeur, sa Priorité et son TTL, chaque valeur avec un bouton de copie.",
            "**Adresse d'expéditeur** — affichée une fois connecté : la partie avant le @ (par défaut **quotes**) et **Enregistrer**.",
            "**Réponses** — où va la réponse d'un client à une soumission ou une facture : le courriel de votre entreprise, ou **le courriel du propriétaire de votre compte, car aucun courriel d'entreprise n'est défini**.",
          ] },
        ],
      },
      {
        id: "connect-your-domain",
        heading: "Comment connecter votre domaine",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Domaine d'envoi**.",
            "Sous **Connecter un domaine**, tapez un sous-domaine comme **send.votreentreprise.com** et appuyez sur **Connecter**. L'état devient **En attente du DNS** et les enregistrements apparaissent.",
            "Connectez-vous là où vous avez acheté le domaine — GoDaddy, Namecheap, Cloudflare, Google Domains. C'est votre hébergeur DNS. Trouvez **DNS**, **Enregistrements DNS** ou **Gérer le DNS**.",
            "Ajoutez un nouvel enregistrement pour chaque bloc à l'écran, en respectant exactement le Type, le Nom et la Valeur. Surveillez le champ Nom : la plupart des hébergeurs ajoutent votre domaine automatiquement, alors pour send._domainkey.exemple.com vous n'entrez habituellement que send._domainkey. Collez les valeurs sans guillemets et sans sauts de ligne.",
            "Enregistrez chez votre hébergeur, puis laissez faire. La plupart des hébergeurs appliquent les changements en une heure; certains prennent jusqu'à 24. Cette page revérifie toutes les 30 secondes d'elle-même; **Vérifier** demande tout de suite.",
            "Quand la pastille se lit **Vérifié**, réglez l'**Adresse d'expéditeur** si vous voulez autre chose que quotes@, et appuyez sur **Enregistrer**.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Paramètres → Domaine d'envoi — le domaine avec sa pastille d'état, la carte Adresse d'expéditeur et la destination des réponses." },
          { warning: "Se retrouver avec send._domainkey.exemple.com.exemple.com dans le champ Nom est l'erreur la plus fréquente. Si votre hébergeur affiche le nom complet après l'enregistrement, c'est réussi." },
        ],
      },
      {
        id: "statuses",
        heading: "Les quatre états",
        blocks: [
          { table: {
            head: ["Pastille", "Signification", "Ce qui part de votre domaine"],
            rows: [
              ["**Non configuré**", "Aucun domaine connecté.", "Rien — l'adresse partagée est utilisée."],
              ["**En attente du DNS**", "Le domaine est inscrit; les enregistrements n'ont pas encore été vus.", "Rien pour l'instant. La page continue de vérifier."],
              ["**Échec de la vérification**", "Le fournisseur a regardé et les enregistrements étaient erronés ou absents.", "Rien. Corrigez les enregistrements et appuyez sur Vérifier."],
              ["**Vérifié**", "Les enregistrements sont en place.", "Chaque courriel aux clients, à partir de maintenant."],
            ],
          } },
        ],
      },
      {
        id: "sender-and-replies",
        heading: "Adresse d'expéditeur et réponses",
        blocks: [
          { p: "L'**Adresse d'expéditeur** est l'adresse que les clients voient. Elle n'a pas besoin d'être une vraie boîte aux lettres — quotes@, bonjour@, bureau@ fonctionnent tous — parce que c'est la vérification du domaine qui permet à FieldQuo d'envoyer sous cette adresse. Changez-la et chaque courriel porte dès lors la nouvelle." },
          { p: "Les **Réponses** sont une autre chose. Quand un client répond à une soumission ou à une facture, la réponse va au courriel de votre entreprise; s'il n'y en a aucun, elle se rabat sur le courriel du propriétaire du compte pour qu'une réponse ne se perde jamais en silence. Modifiez-le sous [[settings-company|Profil de l'entreprise]] — cet écran ne fait que l'afficher, et vous en demande un à l'arrivée s'il manque." },
          { note: "Le propre domaine de FieldQuo et ses sous-domaines sont refusés ici. Un locataire ne peut pas vérifier send.fieldquo.com et envoyer en tant que FieldQuo; utilisez le domaine de votre entreprise." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs et les niveaux Répartiteur et Gestionnaire — les mêmes personnes qui peuvent gérer l'équipe. Connecter, changer l'expéditeur et déconnecter exigent tous cet accès; la lecture est aussi permise à une session de soutien en lecture seule, parce que « nos soumissions n'arrivent pas » se termine habituellement ici." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je créer quotes@send.monentreprise.com comme boîte aux lettres?", a: "Non. L'adresse n'a qu'à exister comme expéditeur, et c'est la vérification du domaine qui le permet. Les réponses vont au courriel de votre entreprise quoi qu'il arrive." },
      { q: "Puis-je utiliser mon domaine racine plutôt qu'un sous-domaine?", a: "L'écran demande un sous-domaine, et pour une raison : cela garde les enregistrements d'envoi de FieldQuo séparés de ceux dont dépend votre courriel habituel." },
      { q: "Qu'arrive-t-il à mes courriels si je déconnecte?", a: "Ils repartent immédiatement de l'adresse partagée de FieldQuo sous le nom de votre entreprise. Rien de ce qui est déjà envoyé n'est touché, et vous pouvez reconnecter plus tard." },
    ],
  },

  "settings-payments": {
    title: "Paiements",
    summary:
      "Connectez Stripe pour que les clients paient en ligne dans votre propre compte bancaire — les états de la connexion, la carte des frais, les virements instantanés, le débit bancaire, le financement, les modes hors ligne imprimés sur les factures et les renseignements de votre compte Stripe.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Paiements** est l'endroit où une entreprise connecte Stripe. Le compte Stripe est ouvert au nom de votre entreprise; le paiement par carte ou par banque d'un client est une transaction sur ce compte, et Stripe verse directement à votre banque. FieldQuo ne voit ni ne conserve jamais vos coordonnées bancaires et ne détient jamais l'argent.",
      "L'écran affiche ce que Stripe lui-même dit de votre compte, pas ce que FieldQuo a entendu en dernier, alors une pastille n'est jamais périmée. Autour de la connexion se trouvent les cartes qui comptent une fois que l'argent bouge : les frais de traitement, les virements instantanés, les modes de paiement que vous acceptez, le financement, et les identifiants que Stripe utilise pour votre compte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La connexion vous mène à la page hébergée par Stripe pour saisir vos coordonnées bancaires et votre identité; vous revenez ici quand c'est fait. Dès lors, chaque facture que vos clients reçoivent porte un bouton Payer, et le paiement est inscrit sur la facture à l'instant où Stripe le confirme. Les frais, les virements, les remboursements et les litiges sont les mêmes pour toutes les entreprises et sont expliqués dans [[payment-processing-fees-and-payouts|Frais de traitement des paiements et virements]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "La carte de connexion — l'un de quatre états (ci-dessous), avec **Connecter avec Stripe**, **Terminer la configuration**, **Je l'ai déjà fait**, **Vérifier à nouveau**, **Gérer dans Stripe** ou **Déconnecter** selon l'état.",
            "**Frais de traitement** — les taux publiés pour chaque mode que Stripe tarifie dans votre devise, les deux suppléments qui ne s'appliquent qu'à certaines cartes, et un exemple calculé sur un paiement par carte de 2 260 $.",
            "**Virement instantané** — ce qui est disponible maintenant, les frais, ce que vous recevrez, et **Virer … maintenant**; ou la seule raison pour laquelle il ne peut pas encore s'exécuter.",
            "**Modes de paiement que vous acceptez** — **Comptant**, **Virement électronique**, **Chèque**, et **Enregistrer**.",
            "**Votre compte Stripe** — propriétaire seulement : l'identifiant du compte avec **Copier**, le courriel de connexion, ce que Stripe a activé, et ce qu'il attend encore.",
            "**Proposer le paiement échelonné (Affirm)** — un interrupteur, affiché une fois la connexion active — et la ligne de clôture disant que FieldQuo ne voit jamais vos coordonnées bancaires.",
          ] },
        ],
      },
      {
        id: "connect-stripe",
        heading: "Comment connecter Stripe",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements** et appuyez sur **Connecter avec Stripe**. La page de Stripe demande les renseignements de votre entreprise, votre identité et le compte bancaire où verser.",
            "Revenez dans FieldQuo. Si Stripe a encore besoin de quelque chose, la carte liste exactement quoi sous **Stripe a encore besoin de quelques éléments**; appuyez sur **Terminer la configuration** pour retourner à la page de Stripe.",
            "Si vous avez tout complété du côté de Stripe et que la page n'a pas suivi, appuyez sur **Je l'ai déjà fait** — cela interroge Stripe directement.",
            "Quand la carte se lit **Stripe connecté · Actif**, les clients peuvent payer. Rien d'autre n'a besoin d'être activé.",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — le compte connecté, la carte Frais de traitement et les modes de paiement que vous acceptez." },
          { note: "**Déconnecter** ne fait que dissocier Stripe de FieldQuo. Cela ne supprime ni ne ferme votre compte Stripe, et rien de vos virements passés ne change — mais les clients ne peuvent pas payer en ligne tant que vous ne reconnectez pas. Marche à suivre complète : [[connect-stripe-and-get-verified|Connecter Stripe et faire vérifier son compte]]." },
        ],
      },
      {
        id: "connection-states",
        heading: "Les quatre états de la connexion",
        blocks: [
          { table: {
            head: ["La carte dit", "Ce que ça signifie", "Quoi faire"],
            rows: [
              ["**Pas encore connecté**", "Aucun compte Stripe n'existe pour votre entreprise.", "Appuyez sur Connecter avec Stripe."],
              ["**Stripe a encore besoin de quelques éléments**", "Le compte existe mais les encaissements sont désactivés; les éléments manquants sont listés, avec la raison de Stripe quand il en donne une.", "Terminer la configuration, ou Je l'ai déjà fait si c'est le cas."],
              ["**Stripe examine vos renseignements**", "Tout a été soumis et Stripe le vérifie — quelques minutes, parfois un jour ou deux.", "Rien. Vérifiez à nouveau plus tard."],
              ["**Stripe connecté · Actif**", "Les encaissements sont activés. Si les virements sont suspendus, la carte le dit — Stripe retient votre argent, ou vérifie votre compte — avec la raison.", "Gérer dans Stripe si Stripe attend quelque chose."],
            ],
          } },
        ],
      },
      {
        id: "how-clients-pay",
        heading: "Comment les clients peuvent payer, et ce que vous acceptez",
        blocks: [
          { p: "Les cartes fonctionnent partout, à **3 % + 0,30 $**. Le débit bancaire apparaît comme second bouton dans le portail client — sur une facture, sur une demande d'acompte et sur chaque versement d'un calendrier de paiement — une fois que Stripe a activé cette capacité sur votre compte : le débit préautorisé pour une entreprise qui facture en dollars canadiens (**1 % + 0,40 $, plafonné à 5,00 $**), l'ACH pour une entreprise qui facture en dollars américains. La carte **Frais de traitement** dit lequel s'applique en ce moment : **Les clients peuvent payer les factures par carte ou depuis un compte bancaire (…)**, ou que le paiement bancaire sera proposé dès que Stripe activera la capacité — rien à faire de votre côté." },
          { bullets: [
            "Un débit bancaire prend **3 à 5 jours ouvrables** à être compensé. La facture affiche **Paiement bancaire en attente** avec la date de soumission et n'est marquée payée que lorsque l'argent arrive; si la banque le retourne, le solde reste dû et le client peut payer de nouveau par carte.",
            "**Modes de paiement que vous acceptez** concerne l'argent qui ne passe jamais par Stripe : cochez **Comptant**, **Virement électronique** et **Chèque** selon ce que vous prenez, appuyez sur **Enregistrer**, et ils s'impriment sur une ligne « Modes de paiement acceptés » dans le courriel de facture, dans le portail client et sur le PDF de la facture. Ne cochez rien et la ligne est omise.",
            "**Proposer le paiement échelonné (Affirm)** permet à un client de fractionner une facture de 50 $ à 30 000 $, en USD ou en CAD, au moment de payer; vous êtes quand même payé intégralement et d'avance. Activez d'abord Affirm dans votre tableau de bord Stripe — l'interrupteur s'enregistre immédiatement, et revient en arrière s'il ne le peut pas.",
          ] },
          { note: "Les frais de carte et de débit bancaire ne sont pas des paramètres — personne ne peut les changer, et ils ne peuvent pas être refilés au client sous forme de ligne de supplément. Le débit bancaire au Canada en détail : [[bank-debit-in-canada|Débit bancaire au Canada]]." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "Virements instantanés et votre compte Stripe",
        blocks: [
          { p: "Le **Virement instantané** transfère votre solde disponible sur une carte de débit en environ 30 minutes pour **1 %** du montant — la tarification de Stripe, refacturée au coût. Il exige un compte actif d'au moins **30 jours** avec les virements activés et une carte de débit au dossier; la carte explique ce qui manque parmi ces conditions et propose **Ajouter une carte de débit dans Stripe**. Les virements standards restent gratuits et arrivent en environ 2 jours ouvrables. Voir [[instant-payouts|Virements instantanés]]." },
          { p: "**Votre compte Stripe** montre au propriétaire les quatre choses que Stripe utilise pour identifier le compte : l'**Identifiant de compte Stripe** (il commence par acct_ — ni le nom de votre entreprise, ni votre courriel), le **Courriel de connexion** auquel Stripe envoie son code de connexion, les deux interrupteurs **Encaissement par carte** et **Versements à votre banque** (les cartes peuvent continuer de fonctionner pendant que les versements sont suspendus — cet argent est retenu par Stripe, pas perdu), et **Ce que Stripe attend encore**, avec la date limite de Stripe quand il en a donné une. Presque tout se règle dans votre propre tableau de bord Stripe via **Gérer dans Stripe**; si vraiment ce n'est pas possible, l'assistance de Stripe s'atteint depuis ce tableau de bord, et l'identifiant de compte est ce qui vous identifie auprès d'eux." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement — c'est le traitement des paiements de l'entreprise, avec des boutons Gérer dans Stripe et Déconnecter bien réels, alors la ligne est cachée à tous les autres niveaux plutôt qu'affichée en lecture seule. La carte **Votre compte Stripe** va un cran plus loin et n'est montrée qu'au propriétaire." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo détient-il mon argent?", a: "Jamais. La transaction est créée sur votre propre compte Stripe et Stripe verse directement à votre banque. FieldQuo ne voit ni ne conserve jamais vos coordonnées bancaires." },
      { q: "Les clients peuvent payer par carte — pourquoi pas par compte bancaire?", a: "Stripe active le débit bancaire selon son propre calendrier et peut demander plus de renseignements. La carte Frais de traitement le dit dès que c'est activé; d'ici là seul le bouton de carte s'affiche, et il n'y a rien à configurer de votre côté." },
      { q: "Les paiements disent Payée mais rien n'a atteint ma banque.", a: "La carte de connexion, et la carte Votre compte Stripe, disent si les virements sont suspendus et pourquoi. Habituellement Stripe a encore besoin d'un document ou en vérifie un — voir Virements retenus ou en vérification." },
      { q: "Où activer les chèques pour que la facture dise que nous les acceptons?", a: "Sous Modes de paiement que vous acceptez, sur cet écran. Cochez Chèque et appuyez sur Enregistrer; le courriel de facture, le portail et le PDF l'impriment sur la ligne des modes acceptés." },
    ],
  },

  "settings-meta-ads": {
    title: "Publicités Meta",
    summary:
      "Connectez votre propre compte publicitaire Meta pour que les dépenses publicitaires entrent dans vos chiffres marketing, plus les formulaires de prospects Facebook, la publication Facebook et Instagram et les connexions WhatsApp Business qui vivent sur le même écran.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Publicités Meta** est l'endroit où une entreprise connecte son propre compte publicitaire Meta (Facebook/Instagram). FieldQuo ne fait que lire les dépenses et les performances des campagnes — il ne crée ni ne modifie jamais une publicité — et les lignes qu'il importe deviennent des dépenses marketing, pour que votre coût par prospect inclue ce que vous avez payé à Meta. Trois autres connexions Meta se trouvent sur le même écran parce qu'elles sont toutes « un compte Meta que cette entreprise connecte » : les formulaires de prospects Facebook, la publication Facebook et Instagram, et WhatsApp Business.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte de connexion a quatre états honnêtes. Si le déploiement n'a pas d'identifiants d'application Meta, ou ne peut pas stocker un jeton en toute sécurité, la carte le dit en toutes lettres et n'offre aucun bouton — c'est un réglage de déploiement, pas quelque chose dans votre compte. Sinon vous voyez **Connecter Meta Ads**, et une fois connecté : la dernière synchronisation, **Synchroniser maintenant**, **Voir vos campagnes →**, **Reconnecter** si Meta dit que le jeton a expiré, et **Déconnecter**." },
          { note: "Le coût par prospect par campagne couvre les prospects arrivés par un formulaire de prospects Meta. Tous les autres canaux — et un propriétaire qui a vu la publicité et a téléphoné — restent mélangés dans l'ensemble, parce que rien ne relie cette dépense à ce prospect. Voir [[marketing-spend|Dépenses marketing]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Publicités Meta — Connectez votre propre compte publicitaire Meta (Facebook/Instagram) pour intégrer les dépenses et les performances des campagnes à vos chiffres marketing.**",
            "La carte de connexion — **Non connecté** avec **Connecter Meta Ads**, ou le compte connecté avec **Dernière synchronisation …**, **Synchroniser maintenant**, **Voir vos campagnes →** et **Déconnecter**. Après une synchronisation : **… nouvelles lignes, … mises à jour**, plus les erreurs, les doublons possibles ou un écart de devise.",
            "**Formulaires de prospects Facebook** — les formulaires trouvés sur vos Pages, chacun avec un interrupteur **Activé** / **Désactivé**, son nombre de prospects et le dernier reçu, **Trouver mes formulaires de prospects**, et **De quelles campagnes viennent ces prospects**.",
            "**Publication Facebook et Instagram** et **WhatsApp Business** — leurs propres cartes de connexion, dont chacune dit clairement quand sa permission n'est pas encore approuvée et n'offre aucun bouton dans ce cas.",
          ] },
        ],
      },
      {
        id: "connect",
        heading: "Comment connecter votre compte publicitaire",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Publicités Meta** et appuyez sur **Connecter Meta Ads**. Vous êtes envoyé chez Meta pour vous connecter et approuver l'accès en lecture.",
            "Si votre connexion a plus d'un compte publicitaire, la carte demande **Quel compte publicitaire ?** — choisissez-en un et appuyez sur **Connecter ce compte**.",
            "De retour à l'écran, appuyez sur **Synchroniser maintenant**. La première synchronisation importe les 30 derniers jours de dépenses quotidiennes par campagne.",
            "Appuyez sur **Voir vos campagnes →** pour lire les lignes dans Marketing → Dépense, où elles sont marquées comme importées de Meta.",
            "Si la carte dit un jour que le jeton n'est plus valide, appuyez sur **Reconnecter** — rien d'autre ne change.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — le compte publicitaire connecté avec Synchroniser maintenant, le panneau Formulaires de prospects Facebook, et les cartes de publication et de WhatsApp." },
          { note: "**Déconnecter** arrête les synchronisations futures. Les lignes déjà importées restent dans votre historique de dépenses marketing; rien n'est supprimé." },
        ],
      },
      {
        id: "sync",
        heading: "Ce que fait une synchronisation",
        blocks: [
          { p: "Une synchronisation demande à Meta les dépenses de chaque campagne par jour sur la fenêtre (30 jours par défaut, au plus 90 à la fois) et écrit une ligne de dépense marketing par campagne et par jour, en mettant à jour les lignes qu'elle a déjà écrites plutôt que de les dupliquer. Le résumé après une synchronisation vous dit combien de lignes étaient nouvelles et combien ont été mises à jour. Les synchronisations sont manuelles — il n'y a pas d'importation nocturne — alors appuyez sur **Synchroniser maintenant** quand vous voulez des chiffres à jour." },
          { bullets: [
            "Les lignes dans une devise autre que celle de votre entreprise sont converties à un taux de change fixé et marquées ≈ approximatives.",
            "Un doublon possible — une ligne de dépense saisie à la main le même jour et sur le même canal — est compté et affiché, jamais fusionné en silence.",
            "Les erreurs de Meta sont affichées sur la carte avec le message de Meta lui-même.",
          ] },
        ],
      },
      {
        id: "the-other-three",
        heading: "Formulaires de prospects, publication et WhatsApp",
        blocks: [
          { p: "**Formulaires de prospects Facebook** transforme un formulaire attaché à l'une de vos publicités en prospect dans Prospects — noté comme toute autre demande, prévenant les mêmes personnes, avec vos règles de relance appliquées. Il utilise la même connexion Meta que le compte publicitaire. Tant que Meta n'a pas approuvé une autorisation de plus pour FieldQuo, le panneau dit **Les formulaires de prospects Facebook nécessitent l'approbation par Meta d'une autorisation supplémentaire ; rien n'est encore reçu.** et chaque interrupteur est désactivé avec cette raison — affiché, pas caché, pour que vous sachiez que les prospects n'arrivent pas et que ce n'est pas votre faute. Voir [[facebook-lead-forms|Formulaires de prospects Facebook]]." },
          { p: "**Publication Facebook et Instagram** publie un design du Designer marketing directement sur votre propre Page et votre compte Instagram. **WhatsApp Business** répond sur votre propre numéro WhatsApp dans Messages, à côté des conversations Facebook et Instagram, avec la règle des 24 heures expliquée sur la carte. Les deux n'affichent un bouton Connecter que lorsque leur permission est approuvée. Voir [[connect-your-facebook-page-and-instagram|Connecter votre Page Facebook et Instagram]] et [[whatsapp-business|WhatsApp Business]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. C'est sur la même tablette que Paiements — le compte externe d'une entreprise avec de vraies commandes Déconnecter — et chaque route derrière refuse quiconque d'autre, alors la ligne est cachée aux autres niveaux." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo peut-il créer ou modifier mes publicités?", a: "Non. La connexion est en lecture seule : les dépenses et les performances entrent, rien ne sort." },
      { q: "Les dépenses s'importent-elles d'elles-mêmes?", a: "Non. Appuyez sur Synchroniser maintenant. Chaque synchronisation couvre les 30 derniers jours par défaut et met à jour les lignes qu'elle a déjà écrites." },
      { q: "J'ai connecté, alors pourquoi les formulaires de prospects sont-ils encore désactivés?", a: "L'autorisation des formulaires de prospects n'est pas encore approuvée pour l'application Meta de FieldQuo. Le panneau le dit et garde les interrupteurs désactivés jusqu'à ce qu'elle le soit." },
    ],
  },

  "settings-expense-tracking": {
    title: "Suivi des dépenses",
    summary:
      "Le même écran Suivi des dépenses que Dépenses dans la barre latérale principale — les cartes du mois, la répartition des dépenses, la tendance, les reçus récents et l'export comptable — atteint depuis Paramètres.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Suivi des dépenses** ouvre exactement la même page que **Dépenses** dans la barre latérale principale. Elle est listée sous Paramètres parce que les chiffres de rythme de dépenses qu'elle porte — salaires, frais généraux, dette — sont autant des paramètres d'entreprise qu'un rapport. Tout ce qui concerne la page elle-même est dans [[expense-tracking-and-burn-rate|Suivi des dépenses et rythme de dépenses]]; cet article ne dit que ce qu'elle contient et qui la voit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Suivi des dépenses — Où va votre argent — par chantier, frais généraux et catégorie — plus votre rythme de dépenses mensuel.** La page se lit un mois à la fois, avec **Ajouter une dépense** et **Importer depuis un CSV bancaire** en haut, quatre cartes, un résumé IA du mois, la répartition et la tendance, les reçus récents, et l'**Export comptable** en bas." },
          { figure: "live:app-settings-expense-tracking", caption: "Suivi des dépenses — les quatre cartes du mois, la Répartition des dépenses mensuelles et, en bas, l'Export comptable." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Quatre cartes : **Dépenses suivies ce mois-ci**, **Rythme de dépenses mensuel** (frais généraux + salaires + dette), **Autonomie**, et **Dépenses liées aux chantiers**, réparties entre frais généraux et général.",
            "**Résumé IA** — une lecture écrite du mois que vous générez à la demande.",
            "**Répartition des dépenses mensuelles** avec **Gérer salaires et dette**, **Dépenses par catégorie**, et la **Tendance sur 6 mois**.",
            "**Dépenses récentes** — chaque reçu avec sa date, sa catégorie, son montant, le chantier auquel il est lié, et la suppression.",
            "**Export comptable** — une plage de dates et un téléchargement de fichiers CSV pour votre comptable. Voir [[the-accounting-export|L'export comptable]] et [[import-expenses-from-a-bank-csv|Importer des dépenses depuis un CSV bancaire]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne apparaît pour quiconque a, dans sa grille d'accès, le niveau **dépenses** qui couvre les dépenses de tout le monde — le niveau Gestionnaire et au-dessus, et tout Accès personnalisé réglé ainsi. Une personne qui ne peut enregistrer que ses propres reçus ne voit pas cette ligne; enregistrer sa propre dépense fonctionne quand même depuis les écrans de dépenses que la barre latérale principale lui montre." },
          { tip: "Les salaires et la dette alimentent le rythme de dépenses mais se modifient sur leurs propres écrans — appuyez sur **Gérer salaires et dette** plutôt que de les chercher ici." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce différent de Dépenses dans la barre latérale principale?", a: "Non. Même page, deux portes. Les deux menus appliquent la même règle d'accès, alors si vous voyez l'une, vous voyez l'autre." },
      { q: "Pourquoi je vois un formulaire de dépense mais pas cette ligne?", a: "Enregistrer votre propre reçu n'exige que vos propres dépenses. Cette ligne cumule les dépenses de toute l'entreprise, ce qui exige le niveau de dépenses supérieur." },
    ],
  },

  "settings-ai-credit": {
    title: "Crédit IA",
    summary:
      "Les deux soldes prépayés qui mesurent le réceptionniste téléphonique, les textos d'équipe, la génération d'images IA et la lecture photo approfondie — ce que coûte chaque chose, comment recharger, et le forfait mensuel de crédit IA.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Crédit IA** montre tout ce qui dépense du crédit, au même endroit. Deux soldes, volontairement séparés : le **Crédit téléphonique**, puisé par le réceptionniste téléphonique et les textos d'équipe, et le **Crédit image IA**, puisé par la génération d'images et la lecture photo approfondie payante sur une soumission. Poser une question à FieldQuo AI sur votre propre entreprise est inclus dans chaque forfait et ne dépense ni l'un ni l'autre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque solde est une carte avec le montant, un relevé **Où le crédit est passé** que vous pouvez déplier, et la façon d'en ajouter. La carte téléphonique renvoie à la page des paramètres du téléphone, où l'achat, le rechargement automatique et le relevé complet vivent déjà; la carte IA vend les recharges directement et, en dessous, un **Forfait crédit IA** mensuel à un prix par crédit plus bas." },
          { p: "Le crédit s'achète en dollars américains quelle que soit la devise de votre forfait, parce que c'est dans cette devise que l'IA est achetée. Une recharge ponctuelle fonctionne pour toutes les entreprises; le forfait mensuel n'est offert qu'à une entreprise dont l'abonnement FieldQuo est facturé en USD, et l'écran dit pourquoi quand ce n'est pas le cas." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Crédit téléphonique** — **Solde :** avec **bientôt épuisé** quand c'est le cas, le tarif à la minute du réceptionniste dans l'indication de la carte, la note que les textos d'équipe puisent dans ce même solde, **Ajouter du crédit téléphonique**, et **Où le crédit est passé**.",
            "**Crédit image IA** — **Solde :** avec **(environ … images, ou … lectures approfondies)**, la rangée **Ajouter du crédit** des montants de recharge, chacun avec le nombre d'images qu'il achète, et **Où le crédit est passé**.",
            "**Forfait crédit IA — payez mensuellement, économisez par crédit** — trois forfaits avec **… crédits — environ … images** et **S'abonner**; ou, une fois abonné, **Sur le forfait … — … crédits pour …/mois**, **Se renouvelle le …** et **Annuler le forfait**.",
          ] },
        ],
      },
      {
        id: "add-credit",
        heading: "Comment ajouter du crédit",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Crédit IA**.",
            "Pour les images et les lectures approfondies, appuyez sur l'un des montants sous **Ajouter du crédit** — 10 $, 30 $, 50 $ ou 100 $. Vous payez sur la page de paiement de Stripe et revenez; la carte dit **Paiement reçu — … de crédit IA ajouté.**",
            "Pour les minutes de téléphone et les textos d'équipe, appuyez sur **Ajouter du crédit téléphonique**; cela ouvre la page des paramètres du téléphone, où vivent les recharges et le rechargement automatique. Voir [[settings-phone-receptionist|Réceptionniste téléphonique]].",
            "Pour payer mensuellement plutôt, choisissez un forfait et appuyez sur **S'abonner**. Le crédit du premier mois arrive sur le solde tout de suite.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Paramètres → Crédit IA — les soldes Crédit téléphonique et Crédit image IA avec leurs recharges, et la carte du forfait mensuel." },
          { note: "Si la carte dit **Nous n'avons pas encore pu confirmer ce paiement**, l'argent est passé et le crédit arrive de lui-même en une minute ou deux. Rien n'est facturé deux fois — actualisez pour vérifier." },
        ],
      },
      {
        id: "what-things-cost",
        heading: "Ce que coûte chaque chose",
        blocks: [
          { table: {
            head: ["Action", "Solde", "Coût"],
            rows: [
              ["Une image marketing générée", "Crédit image IA", "12 ¢ chacune"],
              ["Une lecture photo approfondie sur une soumission", "Crédit image IA", "25 ¢ par lecture, jusqu'à 8 photos"],
              ["Une minute du réceptionniste téléphonique", "Crédit téléphonique", "le tarif à la minute imprimé sur la carte"],
              ["Les textos d'équipe", "Crédit téléphonique", "le même solde que les appels"],
            ],
          } },
        ],
      },
      {
        id: "the-monthly-plan",
        heading: "Le forfait mensuel",
        blocks: [
          { p: "Le forfait est une allocation récurrente sur le même solde image IA, à un prix par crédit plus bas qu'un achat à l'unité. Un crédit vaut un cent de valeur à l'unité : une image fait 12 crédits, une lecture approfondie 25. Trois tailles sont offertes : **starter** (30 $ pour 4 000 crédits), **busy** (50 $ pour 7 000) et **agency** (80 $ pour 11 500)." },
          { bullets: [
            "Le crédit se reporte. Ce que vous n'utilisez pas ce mois-ci est encore là le mois prochain — rien n'expire.",
            "**Annuler le forfait** arrête le paiement du mois suivant et le crédit du mois suivant. Le crédit déjà sur votre solde reste; il n'est jamais repris.",
            "Le forfait se renouvelle à la date indiquée sous **Se renouvelle le**, et le crédit est ajouté quand le paiement réussit.",
          ] },
          { warning: "Les forfaits sont facturés en dollars américains. Une entreprise dont l'abonnement FieldQuo est facturé dans une autre devise ne peut pas en ajouter un — Stripe ne peut pas faire tourner les deux sur un même compte — et le bouton S'abonner est désactivé avec cette raison. Les recharges ponctuelles fonctionnent quand même." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs et les niveaux Répartiteur et Gestionnaire — la même barrière que la ligne du crédit téléphonique, parce que c'est l'argent de l'entreprise. Les recharges et les forfaits exigent aussi cet accès. Voir aussi [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]] sous Facturation." },
        ],
      },
    ],
    faq: [
      { q: "Poser une question à FieldQuo AI coûte-t-il du crédit?", a: "Non. FieldQuo AI et le copilote de soumission sont inclus dans chaque forfait. Le crédit ne mesure que les minutes de téléphone, les textos d'équipe, la génération d'images et la lecture photo approfondie." },
      { q: "Pourquoi y a-t-il deux soldes?", a: "Le fournisseur téléphonique facture un plancher mensuel et le fournisseur d'IA ne facture qu'à l'usage, alors les deux sont mesurés séparément et jamais fusionnés. Acheter l'un ne finance pas l'autre." },
      { q: "Le crédit expire-t-il?", a: "Non. Les recharges et le crédit de forfait restent tous deux sur le solde jusqu'à ce qu'ils soient dépensés, et annuler un forfait ne retire jamais du crédit déjà accordé." },
    ],
  },

  "settings-payroll": {
    title: "Paramètres de paie",
    summary:
      "Quand vous payez — fréquence, jour de clôture, jour de paie — et les retenues et indemnités qui transforment le salaire brut en net : points de départ régionaux, vos propres composantes, tranches d'impôt.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Paie** est ce à partir de quoi un cycle de paie calcule. La carte du haut, **Quand vous payez**, fixe la cadence : à quelle fréquence, le jour où la période se termine, le jour de paie. Dessous viennent les composantes — des retenues comme l'impôt sur le revenu, le RPC ou l'AE, et des indemnités ou gains comme une indemnité d'outils — chacune un montant fixe, un pourcentage du brut, ou des tranches progressives. Tant que rien n'est configuré ici, les paies n'affichent que le salaire brut, et le disent.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo effectue les calculs avec les taux que vous enregistrez ici. Il ne produit ni ne remet aucune déclaration, et il ne met pas à jour les taux lorsqu'ils changent — les gabarits régionaux sont des chiffres publiés pour l'année indiquée, offerts comme point de départ, et ils deviennent vos chiffres dès que vous les importez. Révisez-les chaque année d'imposition avec votre comptable." },
          { note: "FieldQuo calcule le salaire brut, produit les bulletins de paie et exporte le cycle. Il ne paie pas les employés et ne produit pas vos déclarations de retenues — les retenues sont celles que vous ou votre comptable fournissez. L'exécution de la paie elle-même est dans [[payroll-runs|Cycles de paie]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Quand vous payez** — **À quelle fréquence** (Chaque semaine, Toutes les 2 semaines, Deux fois par mois, Une fois par mois), **La période se termine**, **Jour de paie**, les jours pour approuver les heures, puis **Période en cours** et **Dernière période close** avec leurs dates. **Défini par un propriétaire ou un administrateur.**",
            "**Partir de votre région** — Canada, États-Unis ou Royaume-Uni, chacun avec **… composantes · chiffres de …** pour l'année, et la phrase disant que ce sont des chiffres publiés à confirmer avec votre comptable.",
            "**Retenues** et **Indemnités et gains** — chaque composante avec **légal** là où ça s'applique, sa règle (**… % du brut**, **… tranches progressives**, ou un montant), **tout le monde** ou **attribué individuellement**, et **Désactiver** / **Activer** et retirer.",
            "**Ajouter une composante** — le formulaire pour une nouvelle : nom, Retenue ou Indemnité / gain, Montant fixe / Pourcentage du brut / Tranches progressives, et **Appliquer automatiquement à tout le monde**.",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "Comment le configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paie** et remplissez **Quand vous payez**. Chaque semaine ou toutes les 2 semaines s'aligne sur des semaines entières; deux fois par mois et mensuel sont des périodes de calendrier, et la carte avertit que les heures supplémentaires hebdomadaires sont alors calculées sur les semaines partielles à l'intérieur de chaque période.",
            "Appuyez sur votre région sous **Partir de votre région** pour importer les retenues légales habituelles — tranches fédérales, RPC/AE ou leurs équivalents. Les composantes que vous avez déjà sont laissées telles quelles.",
            "Ouvrez chaque composante importée, comparez les chiffres à ceux de votre comptable, et corrigez-les. Ils sont à vous maintenant; FieldQuo ne les changera pas plus tard.",
            "Appuyez sur **Ajouter une composante** pour tout le reste — cotisations syndicales, indemnité d'outils — en choisissant comment elle se calcule et si elle s'applique automatiquement à tout le monde.",
            "**Désactiver** une composante pour la garder sans l'appliquer; ne la retirez que si vous n'en voulez plus jamais. Les bulletins de paie passés conservent ce qui a déjà été retenu dans les deux cas.",
          ] },
          { figure: "live:app-settings-payroll", caption: "Paramètres → Paie — Quand vous payez, les points de départ régionaux, et les composantes de retenues et de gains." },
          { warning: "L'impôt sur le revenu provincial et d'État, les cotisations de l'employeur et les règles fines (RPC2, exemptions, dégressivité des indemnités) sont volontairement absents des gabarits. Un ensemble à moitié rempli a l'air complet et retient trop peu. Faites ajouter par votre comptable ce dont votre région a besoin." },
        ],
      },
      {
        id: "component-types",
        heading: "Les trois façons de calculer une composante",
        blocks: [
          { table: {
            head: ["Calcul", "Ce que vous saisissez", "Usage typique"],
            rows: [
              ["**Montant fixe**", "un montant par période de paie", "cotisations syndicales, une indemnité d'outils"],
              ["**Pourcentage du brut**", "un pourcentage", "RPC à 5,95 %, AE"],
              ["**Tranches progressives**", "des seuils annuels, du plus bas au plus élevé — laissez le dernier « jusqu'à » vide pour « et plus » — et un pourcentage pour chacun", "tranches d'impôt sur le revenu"],
            ],
          } },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { bullets: [
            "**Quand vous payez** décide quelles heures tombent dans quel cycle et le jour de paie imprimé sur chaque bulletin. Le changer change la prochaine période, jamais une période déjà close.",
            "**Appliquer automatiquement à tout le monde** met la composante sur le bulletin de chaque personne; désactivé, elle s'attribue par personne depuis ses paramètres de paie.",
            "**Désactiver** garde la composante et ses chiffres mais la saute au prochain cycle; **Activer** la ramène.",
            "Retirer supprime la composante des cycles futurs seulement — les bulletins passés conservent ce qui a déjà été retenu.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. La route répond par un refus à tous les autres — un Gestionnaire gère le quotidien mais ne voit jamais les taux de retenue ni les tranches d'impôt — alors la ligne est cachée à tous les autres niveaux." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo mettra-t-il à jour les taux d'impôt l'an prochain?", a: "Non. Les chiffres importés deviennent les vôtres dès que vous les importez et ne sont jamais modifiés ensuite. Révisez-les chaque année d'imposition avec votre comptable." },
      { q: "Puis-je payer une personne différemment?", a: "Oui. Décochez Appliquer automatiquement à tout le monde sur la composante et attribuez-la par personne depuis ses paramètres de paie." },
      { q: "Qu'arrive-t-il aux anciens bulletins si je retire une retenue?", a: "Rien. Les bulletins passés conservent ce qui a déjà été retenu; seuls les cycles futurs cessent de l'appliquer." },
    ],
  },

  "settings-website": {
    title: "Votre site web",
    summary:
      "Le créateur de site web — un brief dans vos mots, une conversation pour l'affiner, cinq mises en page et un ensemble de styles, Ajuster pour l'adresse, les langues et les photos, et Publier.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Votre site web** crée et modifie le site web public que FieldQuo héberge pour votre entreprise à votrenom.fieldquo.com. Vous décrivez l'allure et l'ambiance souhaitées; FieldQuo écrit les phrases. La mise en page, les services, les témoignages, votre logo, vos couleurs, vos heures et vos coordonnées viennent tous de ce que la fiche de l'entreprise contient déjà, alors le site n'est jamais inventé et ne vous demande jamais de les retaper.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La première fois, c'est une grande case — **Que devrait dire votre site web ?** — avec des puces d'exemple et **Créer mon site**. Ensuite, l'écran est une conversation à gauche et le site en direct à droite : tapez « Rendez-le plus audacieux », « mettez les avis en avant », « page plus courte » et la page est reconstruite. Rien n'est public tant que vous ne l'avez pas publié." },
          { p: "Le modèle n'écrit que des mots. Il ne choisit jamais librement une mise en page, n'invente pas de service et n'émet pas de règle de style; les listes de blocs, les noms de services et les témoignages viennent de la base de données et y sont remis après la génération. Si l'assistant de rédaction est injoignable, le site est construit à partir de vos informations enregistrées seulement et le fil dit que le texte est plus simple que d'habitude — jamais une page cassée." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "L'en-tête — l'adresse de votre site avec une pastille **En ligne** une fois publié, **Ouvrir**, **Enregistrer**, et **Publier** ou **Mettre à jour**; **Dépublier** une fois en ligne.",
            "Le volet de conversation — ce que vous avez demandé, ce qui a été construit (**Site reconstruit : …**), et ce qui manque encore, sous forme de messages avec des actions d'une touche comme **Ajouter mes photos** et **Jumelez-les**.",
            "**Mise en page** et **Style** — deux rangées de puces sous la conversation. En appliquer une est instantané, garde vos photos et vos textes, et ne dépense pas d'IA.",
            "La case de commande — **Rendez-le plus audacieux · mettez les avis en avant · page plus courte…** — et **Ajuster**, qui ouvre **Adresse web**, **Langues**, **Paires avant-après** et l'intégration des avis.",
            "Le volet de droite — **Aperçu** (ordinateur ou mobile, la vraie page dans un cadre) ou **Sections**, où vous reformulez à la main n'importe quel titre ou paragraphe.",
          ] },
        ],
      },
      {
        id: "build",
        heading: "Comment créer et modifier votre site",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Votre site web**, décrivez l'allure voulue dans la case — ou touchez une puce d'exemple — et appuyez sur **Créer mon site**.",
            "Lisez le fil. Quand il demande ce qui manque — des photos, une paire avant/après, un avis, des heures — utilisez l'action qu'il propose ou répondez dans la case.",
            "Tapez un changement et appuyez sur envoyer. Chaque message reconstruit la page; l'aperçu s'actualise de lui-même.",
            "Essayez une puce **Mise en page** ou **Style**. Vos photos et vos textes sont conservés; modifiez ce que vous voulez, puis **Enregistrer**.",
            "Appuyez sur **Publier**. Le site est en ligne à votre adresse; dès lors, le bouton se lit **Mettre à jour**.",
          ] },
          { figure: "live:app-settings-website", caption: "Paramètres → Votre site web — la conversation et les puces Mise en page / Style à gauche, l'aperçu en direct à droite." },
          { note: "Reconstruire après avoir modifié du texte à la main demande d'abord : **Ceci réécrira les mots que vous avez modifiés**. Les photos, les paires avant-après, le logo et les couleurs sont conservés; les titres et paragraphes que vous avez saisis sont remplacés. Choisissez **Garder ce que j'ai écrit** ou **Reconstruire quand même**." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Mises en page et styles",
        blocks: [
          { p: "Une mise en page est l'ordre et le choix des sections; un style est la typographie, le traitement des couleurs et l'espacement. Cinq mises en page fois les styles offerts (Moderne, Audacieux, Minimal, Classique, Chaleureux, Éditorial et d'autres) sont les vrais « gabarits » — un menu, pas une seule page générée. Votre couleur de marque et votre logo s'appliquent à chacun d'eux." },
          { table: {
            head: ["Mise en page", "Ce qui ouvre"],
            rows: [
              ["**Montrer le travail d'abord**", "vos photos de chantier et vos paires avant/après"],
              ["**Commencer par les services**", "la liste de ce que vous vendez"],
              ["**Commencer par la réputation**", "les avis et les témoignages"],
              ["**Commencer par la réservation**", "le formulaire de réservation"],
              ["**Une seule page, courte**", "une page, l'essentiel et un moyen de vous joindre"],
            ],
          } },
        ],
      },
      {
        id: "fine-tune",
        heading: "Ajuster",
        blocks: [
          { bullets: [
            "**Adresse web** — la partie avant .fieldquo.com. Les noms réservés comme app ou www sont refusés parce qu'ils sont une frontière de sécurité, pas une préférence de nommage. Voir [[your-website-address|L'adresse de votre site web]].",
            "**Langues** — votre langue principale est indiquée. En ajouter une rédige tout le site dans cette langue et donne aux visiteurs un sélecteur dans l'en-tête; ça ne traduit pas la page par machine. En retirer une l'enlève du site.",
            "**Paires avant-après** — jumelez une photo avant avec son après; les paires alimentent le curseur du site. Seules les photos aux étapes avant et terminé sont proposées, jamais une photo de problème.",
            "**Sections** — reformulez ce que vous voulez à la main, masquez une section, ajoutez ou retirez une photo. Votre logo, vos couleurs, vos services, vos heures et vos coordonnées ne se modifient pas ici; changez-les sous Profil de l'entreprise et le site se met à jour.",
          ] },
        ],
      },
      {
        id: "publish-and-unpublish",
        heading: "Publier et dépublier",
        blocks: [
          { p: "**Publier** rend le site public; **Mettre à jour** pousse en ligne les enregistrements suivants. Publier avec des photos d'archive encore sur la page est permis — une entreprise sans photos n'est pas empêchée de lancer — mais ce n'est jamais silencieux : l'écran les compte et propose **Ajouter mes photos** ou **Publier quand même**. Les photos d'archive ne sont jamais qu'en arrière-plan de l'en-tête et à des endroits similaires, jamais dans « Nos réalisations ». Sur un compte gratuit, le pied de page porte une petite ligne « Site by FieldQuo »; un forfait payant la retire. Voir [[the-site-by-fieldquo-footer|Le pied de page Site by FieldQuo]]." },
          { warning: "**Dépublier** met le site hors ligne sur-le-champ — les visiteurs voient une page « non publié », et Google le retire dans les jours qui suivent. Chaque section, photo et langue est conservée, et **Publier** remet le même site en ligne quand vous voulez." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. Enregistrer, publier, ajouter une langue et téléverser des photos refusent tous quiconque d'autre, alors la ligne est cachée à tous les autres niveaux. Le guide complet est [[the-website-builder|Le créateur de site web]]." },
        ],
      },
    ],
    faq: [
      { q: "L'IA va-t-elle inventer des services que je n'offre pas?", a: "Non. Les services, les témoignages et les photos viennent de vos propres données et y sont remis une fois les mots écrits. Le modèle choisit des phrases, pas des faits." },
      { q: "Puis-je utiliser mon propre domaine?", a: "Le site vit à votrenom.fieldquo.com; le champ Adresse web fixe la première partie. FieldQuo ne connecte pas de domaine personnalisé au site aujourd'hui." },
      { q: "Ajouter une langue traduit-il mon site?", a: "Non. Cela rédige tout le site de nouveau dans cette langue à partir de vos données et donne aux visiteurs un sélecteur. Rien n'est traduit par machine." },
    ],
  },

  "settings-instant-quotes": {
    title: "Soumissions instantanées",
    summary:
      "La grille tarifaire derrière votre lien d'estimation instantanée — activez un métier, fixez les tarifs et les suppléments, choisissez ce que voit le propriétaire, et placez l'estimateur sur votre propre site web.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Soumissions instantanées** est la grille tarifaire à partir de laquelle un inconnu obtient un prix. Un propriétaire ouvre votre lien d'estimation instantanée, entre une adresse ou trace une surface sur une carte, répond à quelques questions, et obtient une vraie fourchette de départ en quelques secondes — calculée à partir des chiffres que vous enregistrez ici et de rien d'autre. Chaque estimation arrive dans [[estimate-reviews|Révision des estimations]] avant de pouvoir être envoyée, et la page publique n'affiche jamais la grille tarifaire elle-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est une fiche par métier que FieldQuo peut chiffrer — toiture, planchers d'époxy, crépi, tonte de pelouse, restauration et resurfaçage d'armoires, revêtements de sol, peinture, escaliers, comptoirs, enlèvement de débris — avec un interrupteur **Activé** / **Désactivé**, la façon dont ce métier mesure, des prix de vente de matériaux modifiables, les suppléments que l'estimation applique, un montant minimum et une largeur de fourchette. Enregistrer un métier est ce qui le met en ligne; jusque-là il est désactivé, pour qu'il n'y ait jamais de bouton en ligne qui calcule à partir de chiffres que personne n'a choisis." },
          { p: "Les fiches partent de vos tarifs de **Services et tarifs** là où vous en avez (**Basé sur vos tarifs de Services et tarification**), ou de chiffres de départ typiques là où vous n'en avez pas (**Ce sont des chiffres de départ typiques, pas vos prix**). Dans les deux cas, rien n'est offert aux propriétaires tant que vous n'avez pas modifié et enregistré. Si vos tarifs de services changent plus tard, la fiche le dit — **Vos tarifs de Services et tarification ont changé depuis cet enregistrement** — et propose **Utiliser mes tarifs de services**; elle ne change jamais vos tarifs en ligne d'elle-même." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "La ligne d'état — **… en ligne sur votre lien d'estimation instantanée.** avec **Voir ce que voient les propriétaires**, ou **Rien n'est encore actif sur votre lien d'estimation instantanée — activez un service ci-dessous.**",
            "**Ajoutez l'estimation instantanée à votre site web** — un extrait d'intégration avec **Copier le code**, affiché seulement quand quelque chose est en ligne.",
            "**Ceux-ci sont prêts à être publiés dès que vous fixez leur prix** — les services que vous vendez qui n'ont pas encore de tarif à vous, chacun avec **Fixer le prix — …**; et une bannière si une soumission instantanée en ligne ne fait pas partie de vos services.",
            "Une fiche par métier que vous vendez : l'interrupteur, **Ce que voit le propriétaire**, **Matériaux et prix de vente**, les suppléments, **Montant minimum**, **Largeur de la fourchette (±)**, **Tranches de budget**, et **Enregistrer et activer**. **+ Afficher … autres métiers que FieldQuo peut chiffrer** liste le reste.",
            "**Financement** — facultatif, pour toute l'entreprise : vos propres mots et, si vous les précisez, un taux annuel et une durée.",
          ] },
        ],
      },
      {
        id: "switch-a-trade-on",
        heading: "Comment activer un métier",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Soumissions instantanées**. Si le métier ne fait pas partie de vos services, ajoutez-le d'abord sous [[settings-services|Services et tarifs]] — c'est la liste que lisent vos soumissions, votre site web et votre réceptionniste.",
            "Sur la fiche du métier, lisez comment il mesure — par exemple **Toit mesuré automatiquement à partir de l'adresse (satellite Google).** ou **Le propriétaire saisit la superficie et choisit les options.**",
            "Fixez le prix de vente de chaque matériau sous **Matériaux et prix de vente** (par carré, par pi², par porte, par marche… selon la façon dont le métier se tarifie), et ajoutez ou retirez des matériaux.",
            "Fixez les suppléments que ce métier applique, le **Montant minimum** et la **Largeur de la fourchette (±)**.",
            "Choisissez **Ce que voit le propriétaire** (ci-dessous), puis appuyez sur **Enregistrer et activer**. La ligne d'état en haut le compte.",
            "Appuyez sur **Voir ce que voient les propriétaires** pour ouvrir votre lien public, ou sur **Copier le code** pour l'intégrer à votre propre site.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Paramètres → Soumissions instantanées — le compte des métiers en ligne et l'extrait d'intégration, puis une fiche de métier avec son interrupteur, ses matériaux, ses suppléments et Enregistrer et activer." },
          { note: "Pour la peinture, on ne demande intérieur ou extérieur aux propriétaires que lorsque Peinture intérieure et Peinture extérieure sont toutes deux activées dans Services; avec une seule activée, chaque estimation est calculée selon cette portée, et avec aucune, la peinture n'est pas offerte du tout, quoi qu'il soit enregistré ici." },
        ],
      },
      {
        id: "what-the-homeowner-sees",
        heading: "Ce que voit le propriétaire",
        blocks: [
          { table: {
            head: ["Choix", "Ce qui se passe", "Compromis"],
            rows: [
              ["**Ne pas afficher de prix**", "Ils soumettent et la page dit qu'une soumission suivra.", "Vous obtenez les détails; ils ne voient aucun chiffre avant votre révision."],
              ["**Afficher la fourchette immédiatement**", "La fourchette apparaît avant qu'ils laissent leurs coordonnées.", "Attendez-vous à ce que certains la lisent et partent."],
              ["**Afficher la fourchette après l’envoi**", "Ils remplissent le formulaire pour débloquer leur fourchette.", "Vous obtenez leurs coordonnées dans tous les cas — le choix habituel."],
            ],
          } },
        ],
      },
      {
        id: "rates-and-controls",
        heading: "Ce que change chaque commande",
        blocks: [
          { bullets: [
            "**Activé** / **Désactivé** — si le métier est offert sur votre lien ou non. Désactivé garde chaque tarif enregistré.",
            "**Matériaux et prix de vente** — le prix de base par unité pour chaque matériau que le propriétaire peut choisir. L'unité suit le métier : par carré pour la toiture, par pi² pour les revêtements de sol et l'époxy, par porte et par tiroir pour les armoires, par marche pour les escaliers, par visite selon la taille du terrain pour la tonte.",
            "Les suppléments — ajoutés à la base seulement quand les réponses du propriétaire l'exigent : pente forte et arrachage par couche pour les toits, préparation de surface, accès et état ailleurs, la majoration de portée pour la peinture.",
            "**Montant minimum** — le plancher de toute estimation pour ce métier.",
            "**Largeur de la fourchette (±)** — à quel point la fourchette affichée est large autour du chiffre calculé.",
            "**Tranches de budget** — les trois seuils derrière les quatre options de budget proposées au propriétaire; ils doivent être croissants, sinon les tranches standards sont affichées à la place.",
          ] },
        ],
      },
      {
        id: "financing",
        heading: "Financement",
        blocks: [
          { p: "FieldQuo n'offre pas de financement. La carte **Financement** vous permet de dire aux propriétaires qu'il est disponible, dans vos mots, ou de les diriger vers votre fournisseur. Si vous remplissez aussi **Taux annuel (TAEG %)** et **Durée (mois)** sous **Vos conditions annoncées (facultatif)**, l'estimation affiche une mensualité présentée comme une estimation selon vos conditions. Laissez l'un des deux vide et aucun montant mensuel n'est jamais affiché — FieldQuo n'a ni taux ni durée par défaut." },
          { warning: "Ne promettez pas un taux ou un montant mensuel que vous ne pouvez pas respecter. Les mots et les chiffres sont les vôtres, et c'est ce que le propriétaire lit." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne apparaît pour quiconque a l'accès **Voir les prix** — les niveaux Estimateur, Répartiteur et Gestionnaire, les propriétaires et les administrateurs — parce que la grille tarifaire, ce sont des prix. Modifier et enregistrer un métier est réservé aux propriétaires et aux administrateurs; tous les autres voient les fiches en lecture seule. L'estimateur public, lui, n'affiche jamais un tarif à qui que ce soit. Voir [[instant-quotes-on-your-website|Soumissions instantanées sur votre site web]]." },
        ],
      },
    ],
    faq: [
      { q: "Un propriétaire peut-il voir mes tarifs?", a: "Non. La page publique affiche une fourchette, jamais la grille tarifaire. Publier une grille tarifaire ouvertement la donnerait à chaque concurrent en ville." },
      { q: "Une estimation instantanée est-elle contraignante?", a: "Non. C'est une fourchette que le propriétaire peut demander. Elle arrive dans Révision des estimations, et rien ne lui est envoyé comme soumission tant que quelqu'un ne l'approuve pas." },
      { q: "J'ai activé un métier mais le lien dit que rien n'est disponible.", a: "Un métier n'est en ligne que s'il est activé et chiffrable — enregistré avec des tarifs. La ligne en haut compte exactement ceux-là; la fiche d'un métier qui a besoin d'un prix le dit." },
    ],
  },
};
