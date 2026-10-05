// content/help/fr/messages-3.js
//
// Partie 3 de la catégorie « messages » en français (voir le compositeur,
// messages.js). Même structure que content/help/en/messages-3.js — sections,
// blocs et FAQ dans le même ordre, vérifiés par scripts/check-help-centre.mjs.
export const ARTICLES = {
  // 2026-10-04 — phases 3 et 4 du clavardage d'équipe (voir la version anglaise).
  "photos-and-files-in-team-chat": {
    title: "Photos, fichiers et chantiers partagés dans le clavardage",
    summary: "Envoyez des photos prises avec votre téléphone, des PDF et des documents dans toute conversation. Ils restent privés à la conversation, et une photo peut être enregistrée dans les photos d'un chantier.",
    updated: "2026-10-04",
    intro: [
      "Dans Clavardage, les boutons sous la zone de texte envoient plus que des mots : l'**appareil photo** prend ou choisit une photo, le **trombone** joint des photos ou des documents, et la **mallette** partage un de vos chantiers sous forme de carte.",
    ],
    sections: [
      {
        id: "what-you-can-send",
        heading: "Ce que vous pouvez envoyer",
        blocks: [
          {
            bullets: [
              "Des photos (JPEG, PNG, HEIC et les autres formats courants des téléphones). Une photo est réduite sur votre téléphone avant l'envoi, et sa position est retirée.",
              "Des PDF et des documents Word, Excel, PowerPoint et texte, jusqu'à 25 Mo chacun.",
              "Jusqu'à 10 fichiers par message, avec ou sans texte.",
              "Les vidéos ne peuvent pas être envoyées dans le clavardage.",
            ],
          },
        ],
      },
      {
        id: "who-can-open-them",
        heading: "Qui peut les ouvrir",
        blocks: [
          {
            p: "Seulement les personnes de la conversation. Les fichiers sont stockés de façon privée, pas à une adresse web publique. Chaque photo ou fichier à l'écran s'ouvre par un lien qui ne fonctionne que pour vous et cesse de fonctionner après une heure; rouvrir la conversation donne de nouveaux liens. Une personne qui quitte la conversation, ou qui en est retirée, ne peut plus ouvrir ses fichiers. Le fichier d'un message retiré ne peut être ouvert par personne.",
          },
        ],
      },
      {
        id: "save-to-job-photos",
        heading: "Enregistrer une photo dans un chantier",
        blocks: [
          {
            p: "Touchez une photo pour la voir en grand, puis **Enregistrer dans les photos du chantier**. Dans le salon d'un chantier, elle va dans ce chantier; ailleurs, vous choisissez le chantier parmi ceux que vous voyez. L'équipe peut enregistrer dans les chantiers où elle travaille.",
          },
          {
            p: "La photo est copiée dans les photos du chantier comme photo d'avancement. Elle n'est pas mise sur votre site web : la mise en vedette reste aux personnes qui gèrent les photos des chantiers. La copie dans le clavardage reste privée.",
          },
        ],
      },
      {
        id: "shared-jobs",
        heading: "Chantiers, bons de travail et soumissions partagés",
        blocks: [
          {
            p: "Un chantier, un bon de travail ou une soumission partagé s'affiche comme une carte. Chacun voit ce que son propre accès permet : une personne sur le chantier peut l'ouvrir ainsi que son bon de travail, une personne qui ouvre les soumissions voit le numéro et le client, et les autres voient **Réservé au bureau** ou **Pour les personnes sur ce chantier**. Une carte n'affiche jamais de prix. **Partager avec l'équipe** sur une soumission publie une carte de la même façon.",
          },
        ],
      },
      {
        id: "no-signal",
        heading: "Sans réseau",
        blocks: [
          {
            p: "Le texte envoyé sans réseau attend dans la conversation avec **Envoi…** et part tout seul quand votre téléphone retrouve le réseau. Il est envoyé une seule fois, même si la connexion coupe en route. Les photos et fichiers ont besoin d'une connexion; votre texte reste dans la zone.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Le propriétaire peut-il ouvrir les photos d'un canal privé dont il ne fait pas partie?",
        a: "Non. Les fichiers suivent la conversation : seuls ses membres peuvent les ouvrir.",
      },
      {
        q: "Pourquoi une photo est-elle devenue grise?",
        a: "Son lien a expiré après une heure. La conversation recharge de nouveaux liens d'elle-même; sinon, rouvrez la conversation.",
      },
    ],
  },
  "reply-pin-edit-and-search-in-team-chat": {
    title: "Répondre, épingler, modifier, retirer et rechercher dans le clavardage",
    summary: "Répondez à un message, épinglez ceux dont l'équipe a besoin, corrigez un message pendant 15 minutes, retirez-le pour tout le monde et cherchez dans toutes vos conversations.",
    updated: "2026-10-04",
    intro: [
      "Pointez un message à l'ordinateur, ou touchez **⋯** dessous sur un téléphone, pour voir ce que vous pouvez en faire.",
    ],
    sections: [
      {
        id: "reply",
        heading: "Répondre",
        blocks: [
          {
            p: "**Répondre** place une petite citation du message au-dessus du vôtre. Touchez la citation pour aller à l'original. Les réponses sont sur un seul niveau — pas de fils parallèles à manquer.",
          },
        ],
      },
      {
        id: "pins",
        heading: "Épingler",
        blocks: [
          {
            p: "Un message épinglé apparaît dans la barre sous le nom de la conversation, le plus récent d'abord; touchez la barre pour la liste. Le bureau peut épingler dans toute conversation dont il fait partie, le gestionnaire d'un canal ou d'un groupe dans le sien, et tout le monde dans un message direct ou un groupe. Une ligne dans la conversation indique qui a épinglé.",
          },
        ],
      },
      {
        id: "edit-and-remove",
        heading: "Modifier et retirer",
        blocks: [
          {
            bullets: [
              "**Modifiez** votre propre message pendant 15 minutes après l'envoi. Il affiche ensuite **(modifié)**.",
              "**Retirez** votre propre message en tout temps. Tout le monde dans la conversation voit **Message retiré** à sa place — personne ne peut plus le lire, le propriétaire compris.",
              "Le propriétaire et les administrateurs, ainsi que le gestionnaire d'un canal, peuvent retirer le message de quelqu'un d'autre dans un canal. Le journal d'activité indique qui l'a retiré, pas ce qu'il disait.",
              "Dans les messages directs, les groupes, #general et les salons de chantier, personne ne peut retirer le message d'une autre personne.",
            ],
          },
        ],
      },
      {
        id: "search",
        heading: "Rechercher",
        blocks: [
          {
            p: "La loupe en haut de la liste cherche dans toutes vos conversations; celle d'une conversation cherche dans celle-ci, avec un choix pour chercher partout. Tapez au moins deux lettres. Touchez un résultat pour ouvrir la conversation à ce message. Les canaux privés dont vous ne faites pas partie et les messages retirés ne sont jamais parcourus.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Puis-je modifier un message après 15 minutes?",
        a: "Non. Retirez-le et envoyez-le de nouveau.",
      },
      {
        q: "Retirer un message le supprime-t-il?",
        a: "Il est retiré de tous les écrans pour tout le monde. FieldQuo en garde la trace, mais personne ne peut en lire le texte.",
      },
    ],
  },

  "fetch-older-facebook-and-instagram-history": {
    title: "Récupérer l'historique Facebook et Instagram plus ancien",
    summary:
      "Faites entrer les conversations et les réponses de formulaires antérieures à la connexion — discrètement, sans alertes ni réponses automatiques, et sans doublons.",
    updated: "2026-10-03",
    intro: [
      "Quand vous connectez votre Page Facebook, FieldQuo importe tout de suite les conversations récentes. **Historique plus ancien** va plus loin : chaque conversation Messenger et Instagram que Facebook renvoie encore, et les 90 derniers jours de réponses aux formulaires que Facebook conserve.",
    ],
    sections: [
      {
        id: "where",
        heading: "Où le trouver",
        blocks: [
          {
            bullets: [
              "**Conversations :** Paramètres › Publicités Meta, sur la carte Facebook et Instagram, sous la ligne d'importation — **Historique plus ancien**.",
              "**Formulaires :** Paramètres › Publicités Meta, dans le panneau des formulaires, dès qu'au moins un formulaire est activé.",
            ],
          },
          { p: "Chaque ligne indique combien de conversations, de messages ou de prospects sont arrivés, jusqu'à quelle date, la dernière exécution, et si Facebook a demandé une pause." },
        ],
      },
      {
        id: "what-happens",
        heading: "Ce qui se passe pendant la récupération",
        blocks: [
          {
            steps: [
              "Elle démarre seule après la connexion de la Page, et quand vous activez un formulaire. **Récupérer plus ancien** la relance depuis le début quand vous le voulez.",
              "Elle avance par tranches, plusieurs fois par heure, et reprend exactement là où elle s'était arrêtée. Si Facebook demande de ralentir, la ligne indique **En pause** et l'heure de reprise.",
              "Chaque conversation est enregistrée avec tous les messages que Facebook renvoie, y compris ceux au-delà des cinquante plus récents.",
              "Chaque réponse de formulaire devient un prospect, sauf si la personne est déjà dans votre tableau (voir [[facebook-leads-checked-against-your-records|Prospects Facebook vérifiés contre vos dossiers]]).",
            ],
          },
        ],
      },
      {
        id: "quiet",
        heading: "L'historique ne réveille personne",
        blocks: [
          {
            bullets: [
              "Les conversations antérieures au point de départ de votre boîte arrivent **marquées terminées**, sans badge non lu ni compteur d'attente. Un message récent dans la même conversation l'ouvre comme d'habitude.",
              "Aucune réponse automatique ni brouillon de l'employé IA n'est écrit pour l'historique.",
              "Les prospects de plus d'un jour sont ajoutés sans alerte **nouveau prospect**, et le prospect indique **Importé de l'historique Facebook**. Un formulaire rempli ce matin n'est pas de l'historique — il est annoncé comme tout autre prospect.",
            ],
          },
          { note: "Lancer la récupération deux fois ne crée jamais de doublon : chaque message et chaque prospect est reconnu par l'identifiant de Facebook." },
        ],
      },
    ],
    faq: [
      {
        q: "Pourquoi seulement 90 jours de formulaires ?",
        a: "Facebook conserve les réponses aux formulaires pendant 90 jours. Au-delà, elles ne sont plus disponibles pour aucune application.",
      },
      {
        q: "L'analyse des anciennes conversations utilise-t-elle mon crédit IA ?",
        a: "Seulement pour les conversations où le client a écrit pour la dernière fois dans les 90 derniers jours, et au plus 25 par exécution. Les plus anciennes sont vérifiées contre vos dossiers sans IA, gratuitement.",
      },
    ],
  },

  "photos-and-videos-from-facebook-and-instagram": {
    title: "Photos et vidéos de Facebook et Instagram",
    summary:
      "Les photos, vidéos, messages vocaux et fichiers envoyés sur Messenger et Instagram sont copiés dans FieldQuo pour ne jamais expirer — et un échec dit pourquoi.",
    updated: "2026-10-03",
    intro: [
      "Le lien que Facebook donne pour une pièce jointe expire au bout d'un moment. FieldQuo copie donc chaque photo, vidéo, message vocal et fichier dans son propre stockage en une minute environ, et la conversation affiche la copie, pas le lien de Facebook.",
    ],
    sections: [
      {
        id: "states",
        heading: "Ce que vous voyez dans la conversation",
        blocks: [
          {
            bullets: [
              "**En cours d'arrivée :** la copie n'est pas encore terminée.",
              "**La photo, la vidéo, le lecteur ou le fichier :** la copie est faite et reste.",
              "**Impossible à récupérer, avec la raison et un bouton Réessayer :** par exemple un fichier trop lourd, ou un lien que Facebook avait déjà fait expirer.",
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "Limites de taille",
        blocks: [
          { p: "Messenger et Instagram transportent des pièces jointes jusqu'à 25 Mo, et FieldQuo accepte la même chose. WhatsApp a ses propres limites, plus petites, par type." },
          { tip: "Une pièce jointe dont le lien avait expiré est récupérée de nouveau automatiquement à la prochaine actualisation de la conversation depuis Facebook, car Facebook fournit alors un lien neuf." },
        ],
      },
      {
        id: "history",
        heading: "Conversations plus anciennes",
        blocks: [
          { p: "Les pièces jointes de l'historique récupéré avec **Historique plus ancien** sont copiées de la même façon. Une photo déjà copiée n'est jamais téléchargée de nouveau quand la même conversation est récupérée une deuxième fois." },
        ],
      },
    ],
  },

  "facebook-leads-checked-against-your-records": {
    title: "Prospects Facebook vérifiés contre vos dossiers",
    summary:
      "Comment FieldQuo repère un prospect Facebook que vous avez déjà, l'intègre au lieu de créer une copie, et vous permet d'annuler.",
    updated: "2026-10-03",
    intro: [
      "La même personne remplit souvent votre formulaire Facebook et écrit aussi à votre Page. FieldQuo vérifie chaque prospect Facebook contre vos prospects ouverts, vos conversations Messenger et Instagram et vos clients avant de l'ajouter.",
    ],
    sections: [
      {
        id: "same-person",
        heading: "Quand c'est la même personne",
        blocks: [
          {
            bullets: [
              "**Lié :** le même courriel, le même numéro de téléphone (si les noms ne se contredisent pas), le même identifiant Facebook ou Instagram, ou le même nom complet **et** la même adresse.",
              "**Seulement affiché, jamais lié :** un nom seul, un téléphone familial partagé avec des noms différents, ou le même nom à une autre adresse.",
            ],
          },
          { p: "Une réponse de formulaire qui correspond à un prospect ouvert est intégrée à ce prospect au lieu d'en créer un deuxième. Le prospect ne reçoit que ce qui lui manquait — un téléphone ou un courriel vide, la campagne — et le panneau l'affiche sous **Même personne**, avec ce que disait le formulaire." },
        ],
      },
      {
        id: "undo",
        heading: "Pas la même personne ? Annulez",
        blocks: [
          {
            steps: [
              "Ouvrez le prospect et trouvez **Même personne** dans le panneau.",
              "Appuyez sur **Pas la même personne** sur le lien erroné, puis confirmez.",
            ],
          },
          { p: "Rien n'est supprimé. Une réponse de formulaire intégrée redevient un prospect distinct, ce que le lien avait rempli est remis tel quel si personne ne l'a modifié depuis, et ces deux ne seront plus jamais liés." },
        ],
      },
      {
        id: "review",
        heading: "L'analyse des messages",
        blocks: [
          { p: "Pour une conversation Messenger, Instagram ou WhatsApp, le panneau du prospect et la conversation affichent un verdict avec ses preuves :" },
          {
            table: {
              head: ["Verdict", "Ce que cela veut dire"],
              rows: [
                ["Vrai prospect", "La personne veut des travaux. Un prospect est créé."],
                ["Pas un prospect", "Spam, mauvais numéro, quelqu'un qui cherche un emploi, ou un fournisseur qui vend quelque chose. Aucun prospect."],
                ["Client existant", "Un client déjà au dossier. Un prospect n'est créé que s'il demande de nouveaux travaux, et il est rattaché à ce client."],
                ["Déjà converti", "Un devis, un chantier ou une facture existe déjà pour cette personne. Aucun nouveau prospect — les documents sont listés."],
              ],
            },
          },
          { p: "Qui est la personne vient de vos dossiers, gratuitement. Si elle veut des travaux vient de l'IA, payée par votre crédit IA. Sans crédit IA, l'analyse le dit et seuls les verdicts fondés sur les dossiers apparaissent." },
          { tip: "Si l'analyse a relié une conversation au mauvais client, appuyez sur **Pas ce client** dans la conversation." },
        ],
      },
      {
        id: "scoring",
        heading: "Une note juste pour les prospects Facebook",
        blocks: [
          { p: "Un budget ou un délai manquant ne compte contre un prospect que si le formulaire posait vraiment la question. Les formulaires Facebook, les conversations et les prospects saisis à la main sont notés sur ce qu'ils peuvent recueillir, et les raisons indiquent **Budget inconnu** ou **Délai inconnu — non compté**." },
        ],
      },
    ],
  },

  "channels-and-group-chats": {
    title: "Canaux et discussions de groupe",
    summary: "Les canaux sont des lieux que le bureau crée — #estimation, #equipe-nord, #annonces; les discussions de groupe sont des conversations que n'importe qui lance. Qui peut créer, modifier, rejoindre et quitter chacun.",
    updated: "2026-10-04",
    intro: [
      "En plus de **#general**, des salons de chantier et des messages directs, le clavardage a deux sortes de salons que les gens créent eux-mêmes. Un **canal** est un lieu : il a un nom comme **#estimation**, un sujet facultatif, et il survit aux personnes qui y sont. Une **discussion de groupe** est une conversation entre les personnes choisies — trois personnes qui règlent le camion de demain. #general et les salons de chantier restent tenus par FieldQuo à partir de votre liste d'équipe et de votre horaire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          {
            p: "Les canaux sont sous **Canaux** dans la liste, après **#general**; les discussions de groupe sont avec vos messages directs. Un canal **public** peut être trouvé et rejoint par tout le monde dans l'entreprise depuis **Parcourir les canaux**; un canal **privé** est caché pour quiconque n'y a pas été ajouté — le propriétaire compris — et ouvrir son lien répond comme s'il n'existait pas. Un canal peut être réglé pour que **Seul le bureau peut publier** : les propriétaires, administrateurs et superviseurs publient, tout le monde lit. C'est ainsi que fonctionne un canal **#annonces**.",
          },
        ],
      },
      {
        id: "who-can-do-what",
        heading: "Qui peut faire quoi",
        blocks: [
          {
            table: {
              head: [
                "Action",
                "Propriétaire et administrateur",
                "Gestionnaire et répartiteur",
                "Estimateur et équipe terrain",
              ],
              rows: [
                [
                  "Créer un canal",
                  "Oui",
                  "Oui",
                  "Non",
                ],
                [
                  "Lancer une discussion de groupe",
                  "Oui",
                  "Oui",
                  "Oui",
                ],
                [
                  "Rejoindre un canal public",
                  "Oui",
                  "Oui",
                  "Oui",
                ],
                [
                  "Renommer un canal, définir son sujet, le rendre privé, réserver les publications au bureau, l'archiver",
                  "Tout canal où ils sont",
                  "Les canaux qu'ils gèrent (ceux qu'ils ont créés)",
                  "Non",
                ],
                [
                  "Ajouter ou retirer des personnes dans un canal",
                  "Tout canal où ils sont",
                  "Les canaux qu'ils gèrent",
                  "Non",
                ],
                [
                  "Renommer une discussion de groupe ou y ajouter des gens",
                  "Toute personne du groupe",
                  "Toute personne du groupe",
                  "Toute personne du groupe",
                ],
                [
                  "Retirer des personnes d'une discussion de groupe",
                  "Oui, quand ils en font partie",
                  "S'ils l'ont lancée",
                  "S'ils l'ont lancée",
                ],
              ],
            },
          },
          {
            note: "Le serveur vérifie ces règles à chaque modification; elles ne sont pas seulement cachées à l'écran. Une session de soutien en lecture seule peut ouvrir tous les salons et n'en modifier aucun.",
          },
        ],
      },
      {
        id: "make-a-channel",
        heading: "Créer un canal",
        blocks: [
          {
            steps: [
              "Dans **Clavardage**, appuyez sur **+** à côté de **Canaux** (ou **Parcourir les canaux**, puis **Nouveau canal**).",
              "Tapez un nom. Il est enregistré en minuscules avec des tirets — **Ce sera #equipe-nord** montre ce que vous obtiendrez.",
              "Ajoutez un **Sujet** si cela aide les gens à savoir à quoi sert le canal.",
              "Choisissez **Public** ou **Privé**. Un canal privé a besoin des personnes que vous voulez y voir.",
              "Activez **Seul le bureau peut publier** pour les annonces, et **Inclure tout le monde** pour ajouter toute l'équipe maintenant et chaque nouvelle personne à son arrivée.",
              "Appuyez sur **Créer le canal**.",
            ],
          },
          {
            note: "Tout le monde dans l'entreprise peut lire un canal public, l'équipe terrain comprise. Gardez les détails des clients dans le salon du chantier.",
          },
        ],
      },
      {
        id: "start-a-group",
        heading: "Lancer une discussion de groupe",
        blocks: [
          {
            steps: [
              "Appuyez sur **Nouveau message**.",
              "Choisissez deux personnes ou plus. Choisir une seule personne ouvre plutôt votre message direct avec elle.",
              "Donnez un nom au groupe si vous voulez — sinon il porte le nom des personnes qui en font partie.",
              "Appuyez sur **Créer le groupe**.",
            ],
          },
        ],
      },
      {
        id: "archive-and-leave",
        heading: "Archiver, quitter et retirer",
        blocks: [
          {
            bullets: [
              "**Archiver le canal** conserve chaque message et met le canal en lecture seule; il passe sous **Archivés**. **Désarchiver le canal** le ramène. Rien n'est supprimé.",
              "**Quitter le canal** ou **Quitter le groupe** vous en fait sortir; vos messages restent, et quelqu'un peut vous rajouter.",
              "Vous ne pouvez pas quitter #general, un salon de chantier, un message direct, ou un canal réglé sur **Inclure tout le monde** — mettez-le en sourdine à la place.",
              "**Retirer** fait sortir quelqu'un d'un canal ou d'un groupe. Ses messages restent où ils étaient.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Le propriétaire peut-il lire un canal privé?",
        a: "Seulement s'il en fait partie. Un canal privé est caché pour quiconque n'y a pas été ajouté, propriétaires et administrateurs compris.",
      },
      {
        q: "Quelle taille peut avoir une discussion de groupe?",
        a: "Il n'y a pas de limite. La liste des personnes se charge cinquante à la fois, et taper @ cherche parmi tout le groupe.",
      },
      {
        q: "L'équipe terrain peut-elle créer un canal?",
        a: "Non. L'équipe terrain et les estimateurs lancent des discussions de groupe; les canaux sont créés par les propriétaires, administrateurs, gestionnaires et répartiteurs.",
      },
    ],
  },

  "chat-notifications-and-mute": {
    title: "Notifications du clavardage et sourdine",
    summary: "Ce que chaque sorte de salon vous signale par défaut, comment le changer ou mettre un salon en sourdine un moment, et pourquoi une mention arrive aussi dans la cloche.",
    updated: "2026-10-04",
    intro: [
      "Chaque salon du clavardage a votre propre réglage de notifications. Personne d'autre ne le voit, et le réglage de quelqu'un d'autre ne change rien à ce que vous recevez. Ouvrez un salon et appuyez sur l'engrenage (ou sur le nombre de personnes) pour trouver **Vos notifications**.",
    ],
    sections: [
      {
        id: "defaults",
        heading: "Ce qui vous est signalé par défaut",
        blocks: [
          {
            table: {
              head: [
                "Salon",
                "On vous signale",
              ],
              rows: [
                [
                  "Un message direct",
                  "Chaque message",
                ],
                [
                  "Une discussion de groupe",
                  "Chaque message",
                ],
                [
                  "#general, un canal, un salon de chantier",
                  "Seulement quand on vous mentionne",
                ],
              ],
            },
          },
          {
            p: "On ne vous signale jamais vos propres messages, et vous ne recevez pas de notification pour un message pendant que ce salon est ouvert à votre écran.",
          },
        ],
      },
      {
        id: "change-it",
        heading: "Le changer pour un salon",
        blocks: [
          {
            steps: [
              "Ouvrez le salon et appuyez sur l'engrenage.",
              "Sous **Vos notifications**, choisissez **Chaque message**, **Seulement quand on me mentionne** ou **Rien (sourdine jusqu'à ce que je la retire)**. **Par défaut** revient au tableau ci-dessus.",
              "Pour une sourdine temporaire, appuyez sur **1 heure** ou **Jusqu'à demain 7 h**. **Réactiver** y met fin plus tôt.",
            ],
          },
        ],
      },
      {
        id: "what-mute-does",
        heading: "Ce que fait la sourdine",
        blocks: [
          {
            bullets: [
              "Un salon en sourdine est affiché en gris avec une cloche barrée, et son compte est gris. Les messages sont toujours là; rien n'est caché.",
              "Pendant une sourdine temporaire, une mention vous parvient quand même, et seules les mentions comptent dans l'onglet **Clavardage**.",
              "**Rien** rend le salon complètement silencieux — mentions comprises — et le retire du nombre de l'onglet **Clavardage**.",
              "**Masquer de ma liste** (messages directs et discussions de groupe) retire une conversation de votre liste jusqu'à ce que quelqu'un y écrive de nouveau.",
            ],
          },
        ],
      },
      {
        id: "mentions-in-the-bell",
        heading: "Les mentions dans la cloche",
        blocks: [
          {
            p: "Quand quelqu'un vous mentionne avec @ dans une discussion de groupe, un canal, #general ou un salon de chantier, la mention arrive aussi dans la cloche des notifications — **Ana vous a mentionné dans #estimation** — et la toucher ouvre le clavardage à ce message. La ligne de la cloche garde qui et où, pas le texte du message. Un message direct n'ajoute pas de ligne dans la cloche (il vous avertit déjà), et un salon réglé sur **Rien** n'en ajoute aucune.",
          },
          {
            note: "Seul le **@everyone** du bureau avertit tout le salon. Le @everyone de quelqu'un d'autre est envoyé comme simple texte, et la zone de rédaction le dit avant l'envoi.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Pourquoi n'ai-je pas eu de notification pendant que j'étais dans le salon?",
        a: "Parce que vous le regardiez. FieldQuo n'envoie pas de notification pour un message déjà à votre écran.",
      },
      {
        q: "La sourdine avertit-elle quelqu'un?",
        a: "Non. Vos réglages de notifications ne regardent que vous.",
      },
    ],
  },

  "seen-by-in-team-chat": {
    title: "Vu par dans le clavardage",
    summary: "Sous votre dernier message, Vu par 3 indique combien de personnes de la conversation l'ont eu à l'écran — touchez-le pour les noms. Seuls les membres de la conversation le voient.",
    updated: "2026-10-04",
    intro: [
      "Dans le clavardage, la ligne sous votre propre dernier message indique qui l'a vu : **Vu par 3** dans un groupe, un canal ou un salon de chantier, et **Vu** dans un message direct. Touchez-la pour la liste des noms. Sur un de vos messages plus anciens, **Vu par** se trouve dans la barre qui apparaît quand vous pointez le message.",
    ],
    sections: [
      {
        id: "what-it-means",
        heading: "Ce que cela veut dire",
        blocks: [
          {
            bullets: [
              "**Vu** signifie que le message était à l'écran de cette personne dans cette conversation — elle a ouvert le salon, ou le message est arrivé pendant qu'il était ouvert.",
              "Cela ne veut pas dire qu'elle l'a lu attentivement, et il n'y a pas d'indicateur de saisie.",
              "Le compte porte sur les personnes de la conversation maintenant. Quelqu'un ajouté plus tard compte dès qu'il l'ouvre.",
            ],
          },
        ],
      },
      {
        id: "who-sees-it",
        heading: "Qui peut le voir",
        blocks: [
          {
            p: "Seulement les personnes de la conversation. L'écran l'offre sur vos propres messages. Quelqu'un hors d'un canal privé ne peut pas le voir, et la session de soutien de FieldQuo en lecture seule ne le voit pas non plus.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Puis-je le désactiver?",
        a: "Non. Vu par fait partie du clavardage d'équipe pour tous les membres d'une conversation, comme la ligne des non-lus.",
      },
      {
        q: "Le propriétaire voit-il qui a lu quoi?",
        a: "Seulement dans les conversations dont il fait partie, comme tout le monde.",
      },
    ],
  },
};
