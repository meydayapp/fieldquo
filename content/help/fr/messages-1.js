// content/help/fr/messages-1.js
//
// Partie 1 de la catégorie « messages » en français (voir le composeur,
// messages.js). Slugs de cette partie (lib/help/tree.js) :
// the-messages-inbox, connect-your-facebook-page-and-instagram,
// whatsapp-business, conversation-status-and-who-looks-after-it,
// private-notes-and-temperature, the-ai-employee, the-monthly-review,
// client-texts-on-my-way-and-reminders, email-templates.
//
// Même structure que l'anglais (mêmes sections, mêmes blocs, mêmes figures) ;
// les mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "the-messages-inbox": {
    title: "La boîte de réception Messages",
    summary:
      "Où arrivent vos conversations Facebook, Instagram et WhatsApp Business, comment elles sont regroupées, et ce que fait chaque bouton de l'écran.",
    updated: "2026-09-12",
    intro: [
      "**Messages** est une seule boîte de réception pour les inconnus qui écrivent à votre entreprise sur Facebook, Instagram et WhatsApp. Chaque conversation est conservée dans FieldQuo, regroupée selon que c'est à vous de répondre ou non, et porte les deux choses qui comptent pour le reste du produit : est-elle devenue un chantier, et combien de temps la personne a attendu. C'est ce qui rend possible le bilan de fin de mois — voir [[the-monthly-review|Le bilan mensuel de votre boîte de réception]].",
      "La ligne du menu porte une étiquette **Aperçu**, et l'écran s'ouvre sous une bannière **Aperçu anticipé**. La boîte elle-même est terminée ; ce que FieldQuo attend, c'est l'autorisation de Meta pour la messagerie des pages. Tant qu'elle n'est pas accordée pour votre entreprise, l'écran le dit en une phrase et la zone de réponse est désactivée avec cette même raison imprimée dessus. Rien n'est inventé entre-temps : une boîte vide affiche **Aucune conversation**, jamais un exemple.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Comptes professionnels seulement. FieldQuo lit les conversations de la page Facebook et du compte Instagram professionnel que vous connectez, et d'un numéro WhatsApp Business — jamais les messages personnels de qui que ce soit, et aucun chemin dans le code n'y mène. La connexion se fait une fois, dans **Paramètres → Publicités Meta** ; voir [[connect-your-facebook-page-and-instagram|Connecter votre page Facebook et Instagram]] et [[whatsapp-business|Les messages WhatsApp Business]]." },
          { p: "Une conversation n'est jamais supprimée de la boîte. Elle est répondue, mise de côté, marquée terminée et évaluée — **Gagné**, **Perdu**, **Sans réponse** ou **Pas un chantier** — pour que le bilan de fin de mois ait quelque chose de vrai à compter." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Messages — Les messages de votre page Facebook et de votre compte Instagram professionnel, traités ici.** Le bouton **Bilan mensuel** est en haut à droite.",
            "Le volet de gauche : **Rechercher une conversation**, puis les pastilles de canal **Toutes**, **Facebook**, **Instagram**, **WhatsApp**. La recherche comme les pastilles interrogent le serveur : une recherche trouve des mots à l'intérieur de messages que la liste n'a pas encore chargés.",
            "**Actualiser depuis Facebook** — récupère les conversations que votre Page avait déjà avant la connexion (les 30 derniers jours). Affiché seulement quand Meta a accordé l'autorisation nécessaire et que vous pouvez écrire dans la boîte.",
            "Quatre groupes, dans cet ordre : **À répondre**, **En attente de leur réponse**, **Mises de côté**, **Terminées**. Le dernier est replié au départ.",
            "Chaque ligne : le nom de la personne, le pictogramme du canal, le dernier message (**Vous : …** quand il est de vous), l'heure, un compteur de non-lus, une étiquette **Attend depuis 3 jours** tant qu'elle attend après vous, et la pastille de température — **Tiède 35**, **Chaud 72**, **Froid 0**. Un triangle rouge signifie que votre dernière réponse est **Non remis**.",
            "La conversation ouverte au centre, avec **Conversation 41** (son numéro), le canal, la pastille de résultat, et une rangée d'actions : **Ouvrir le client**, **Ouvrir le prospect**, **Ouvrir le contrat**, **Ouvrir la soumission** quand l'un d'eux est lié, **Marquer terminée** ou **Rouvrir**, et **Détails**.",
            "Le volet de droite, **Détails** · **Résultat** · **Historique** : nom, canal, premier contact, numéro, ce à quoi elle est liée, **Où en est cette conversation ?** et **S'en occupe**.",
          ] },
        ],
      },
      {
        id: "read-and-reply",
        heading: "Lire et répondre à une conversation",
        blocks: [
          { steps: [
            "Ouvrez **Messages** et choisissez une ligne sous **À répondre**. Sur un téléphone, la liste, la conversation et les détails sont trois écrans avec une flèche de retour ; sur un grand écran, ce sont trois volets.",
            "Lisez le fil. Les séparateurs de jour et une ligne rouge de non-lus montrent où vous en étiez ; les lignes grises consignent ce que votre équipe a fait (**Résultat « Gagné » indiqué par Dave**, **Rouverte**).",
            "Écrivez dans **Écrire une réponse** et appuyez sur **Envoyer**. Les onglets **Répondre** et **Note** au-dessus de la zone décident où vont les mots — une note reste à l'intérieur de votre entreprise.",
            "Évaluez-la quand vous le savez : la pastille de résultat dans l'en-tête, ou l'onglet **Résultat**, enregistre **Gagné**, **Perdu**, **Sans réponse** ou **Pas un chantier**. Dès que vous en choisissez un, la conversation passe dans **Terminées**.",
          ] },
          { figure: "live:app-messages", caption: "Messages — la liste regroupée À répondre et En attente de leur réponse, chaque ligne avec son délai d'attente et sa pastille de température, et les pastilles de canal au-dessus." },
          { note: "La barre d'adresse porte la conversation ouverte (**?conversation=…**) : un lien depuis le bilan, ou un rechargement, atterrit sur le fil et non sur la liste." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["Onglet **Répondre**", "Envoie par Meta vers le Facebook, l'Instagram ou le WhatsApp de la personne. Désactivé, avec la raison imprimée dessus, quand aucune page n'est connectée, que la connexion doit être refaite, ou que FieldQuo attend encore l'autorisation de Meta."],
              ["Onglet **Note**", "Enregistre une note privée dans le fil. **Seule votre équipe voit ceci. Ce n'est jamais envoyé.** Jamais bloqué par la connexion."],
              ["**Marquer terminée** / **Rouvrir**", "Passe l'état à **Résolue** (la ligne va dans Terminées) ou le ramène à **Ouverte**."],
              ["Pastille de résultat", "**Gagné**, **Perdu**, **Sans réponse**, **Pas un chantier**, ou retour à **Ouverte**, ce qui efface l'évaluation. Le bilan compte une évaluation effacée comme non faite."],
              ["**Où en est cette conversation ?**", "**Ouverte**, **En attente de leur réponse**, **Mise de côté** (demande une date), **Résolue** — voir [[conversation-status-and-who-looks-after-it|L'état d'une conversation et qui s'en occupe]]."],
              ["**S'en occupe**", "Confie la conversation à une personne de votre équipe, ou **Personne pour l'instant**."],
              ["**Ouvrir le client** et les autres liens", "Ouvrent le client, le prospect, le contrat ou la soumission liés à la conversation. Une fiche contact envoyée par la personne peut devenir un client avec **Ajouter comme client**."],
            ],
          } },
        ],
      },
      {
        id: "staying-on-top",
        heading: "Savoir quand quelqu'un répond",
        blocks: [
          { p: "Tant que l'onglet est ouvert, la liste se relit une fois par minute. Une réponse qui arrive s'affiche en toast dans l'onglet où vous êtes, ou en notification système quand la boîte est dans un onglet en arrière-plan — **Nouveau message de Maria Lopez** avec la première ligne de ce qu'elle a écrit. FieldQuo pousse aussi le même avis vers les téléphones de tous ceux qui peuvent lire la boîte, une fois les notifications du navigateur activées dans **Paramètres → Notifications** ; voir [[notifications-for-you|Vos notifications : courriel et navigateur]]." },
          { tip: "L'étiquette **Attend depuis 3 jours** se mesure depuis le dernier message de la personne et s'efface dès que quelqu'un de l'entreprise répond — depuis FieldQuo, depuis la boîte de Meta ou depuis un téléphone. Écrire une note ne l'efface pas : une note n'est pas une réponse." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres outils ne font pas",
        blocks: [
          { p: "Les pages de comparaison de FieldQuo consignent ce que chaque concurrent imprime sur sa propre page de tarifs, à chaque palier. Aucune des pages consignées ne nomme une boîte de réception Facebook, Instagram ou WhatsApp ; le palier Core+ de Projul indique « messaging » sans préciser le canal. Ce que FieldQuo ajoute à une boîte de réception, c'est le résultat sur chaque conversation et le bilan mensuel construit à partir de lui — quelles conversations sont devenues des chantiers, et à quelle vitesse les gagnées ont reçu une réponse." },
          { p: "Les pages de comparaison de FieldQuo ne listent pas encore cette fonction, volontairement : tant que Meta n'a pas approuvé la messagerie des pages pour l'application, une page publique vendrait quelque chose qu'une nouvelle entreprise ne peut pas activer. Cet article dit la même chose." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "Lire la boîte exige **Requests** (les demandes) en lecture seule ou plus dans la grille d'accès — un message entrant est une demande d'un inconnu. Les profils Estimateur, Répartiteur et Gestionnaire ainsi que le propriétaire et les administrateurs l'ont tous ; le profil Équipe (**Requests: none**) est refusé. Répondre, écrire une note, changer l'état, le résultat ou la personne qui s'en occupe exige **Requests** en voir, créer et modifier — Estimateur et plus. Une personne en lecture seule voit **Vous pouvez lire cette conversation mais pas y répondre : votre accès aux demandes est en lecture seule.** Voir [[access-levels-overview|Les niveaux d'accès]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la zone de réponse est-elle grisée ?", a: "Lisez la phrase qui s'y trouve. C'est l'une de quatre : aucune page n'est encore connectée, la page doit être reconnectée, FieldQuo attend l'autorisation de Meta pour la messagerie des pages, ou c'est une conversation d'exemple. L'onglet Note fonctionne dans tous les cas." },
      { q: "Puis-je supprimer une conversation ?", a: "Non. Marquez-la terminée, ou évaluez-la Pas un chantier, et elle quitte la liste de travail. Rien de ce qu'un client a écrit n'est retiré." },
      { q: "FieldQuo lit-il mon Messenger ou mon Instagram personnel ?", a: "Non. Seulement la page et le compte professionnel que vous avez connectés, et seulement leurs conversations d'affaires." },
      { q: "Où vont ces conversations dans le reste de FieldQuo ?", a: "Nulle part par elles-mêmes. Liez-en une à un client, un prospect, un contrat ou une soumission depuis l'onglet Détails et le fil porte le lien ; le bilan mensuel classe la conversation dans le mois où elle a commencé." },
    ],
  },

  "connect-your-facebook-page-and-instagram": {
    title: "Connecter votre page Facebook et Instagram",
    summary:
      "La seule connexion, dans Paramètres → Publicités Meta, qui permet à FieldQuo de publier sur votre page et votre Instagram et, dès que Meta l'approuve, de répondre à leurs messages dans votre boîte de réception.",
    updated: "2026-09-12",
    intro: [
      "Votre page Facebook et le compte Instagram professionnel qui y est lié se connectent une seule fois, depuis la carte **Publication Facebook et Instagram** de **Paramètres → Publicités Meta**. Un écran de consentement, une connexion enregistrée, et elle alimente deux choses : la publication d'un visuel du Créateur marketing, et la [[the-messages-inbox|boîte de réception Messages]]. Un entrepreneur se dit « j'ai connecté ma page », pas « je l'ai connectée deux fois », alors FieldQuo ne demande pas deux fois.",
      "La carte est honnête sur ce que Meta a approuvé ou non pour l'application FieldQuo. Tant qu'une autorisation est en attente, elle le dit et n'affiche aucun bouton ; une connexion enregistrée mais incapable de livrer les messages nomme l'autorisation manquante plutôt que d'avoir l'air en santé.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Paramètres → Publicités Meta** regroupe toutes les connexions Meta d'une entreprise : le compte publicitaire (les dépenses dans vos chiffres marketing), les **Formulaires de prospects Facebook** (vers Prospects), **Publication Facebook et Instagram**, et **WhatsApp Business**. Ce sont des connexions distinctes avec des autorisations distinctes — connecter le compte publicitaire ne connecte pas la page. Voir [[connect-meta-ads|Connecter votre compte publicitaire Meta]] et [[facebook-lead-forms|Les formulaires de prospects Facebook]] pour les deux premières." },
          { p: "La connexion de la page enregistre un jeton d'accès, chiffré, ainsi que l'identifiant et le nom de la page. Le jeton n'est jamais affiché à l'écran et ne quitte jamais le serveur." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a sur la carte",
        blocks: [
          { bullets: [
            "**En attente de l'approbation de Meta** — la publication ou la messagerie exige des autorisations que Meta doit d'abord accorder à FieldQuo. Aucun bouton ; **Rien ne manque de votre côté.**",
            "**Aucune page connectée** avec **Connecter Facebook et Instagram** — le parcours est ouvert et rien n'est encore enregistré.",
            "**Quelle page ?** — Meta a renvoyé plus d'une page pour votre connexion ; choisissez-en une et appuyez sur **Connecter cette page**.",
            "Connectée : le nom de la page, puis le **@nom** du compte Instagram lié, ou **Aucun compte Instagram lié à cette page — Facebook uniquement.**",
            "Une ligne sur les messages : **Meta transmet les messages de cette Page à FieldQuo — activé le …**, ou **Les messages de cette Page n'arrivent pas jusqu'à FieldQuo** avec **Réessayer l'abonnement**, ou une phrase nommant les autorisations que Meta n'a pas encore accordées.",
            "**Votre boîte de réception n'est pas encore activée pour cette Page** avec **Activer la boîte de réception** — seulement pour une page connectée avant que la boîte existe.",
            "**Importer les conversations passées** avec **Dernier import le …**, puis **Connecté par Jon Smith le …**, **Reconnecter ou changer de page** et **Déconnecter**.",
          ] },
        ],
      },
      {
        id: "how-to-connect",
        heading: "Comment connecter",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Publicités Meta** (sous **Encaissement**) et descendez jusqu'à **Publication Facebook et Instagram**.",
            "Si la carte affiche **En attente de l'approbation de Meta**, arrêtez-vous ici — il n'y a rien à faire tant que cela ne change pas. Sinon, appuyez sur **Connecter Facebook et Instagram**.",
            "Connectez-vous à Facebook et cochez chaque autorisation que Meta présente. En décocher une vous laisse une connexion qui semble correcte et échoue au moment de publier ou de recevoir un message ; la carte nomme ensuite l'autorisation manquante.",
            "Si vous administrez plusieurs pages, choisissez celle depuis laquelle votre entreprise publie sous **Quelle page ?** et appuyez sur **Connecter cette page**.",
            "De retour sur la carte, vérifiez la ligne des messages. Quand elle affiche **Meta transmet les messages de cette Page à FieldQuo**, les nouvelles conversations arrivent d'elles-mêmes dans Messages.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — la carte du compte publicitaire, les formulaires de prospects Facebook, une page connectée avec son compte Instagram et la ligne des messages, et la carte WhatsApp Business." },
        ],
      },
      {
        id: "after-connecting",
        heading: "Après la connexion",
        blocks: [
          { bullets: [
            "**Importer les conversations passées** récupère ce que la page avait déjà, jusqu'à 30 jours en arrière, et rapporte **12 conversations importées · 3 nouvelles**. C'est la même récupération que le bouton **Actualiser depuis Facebook** de la boîte. Elle peut s'exécuter une fois toutes les dix minutes ; plus tôt, on lit **Actualisé il y a un instant — réessayez dans quelques minutes.**",
            "**Activer la boîte de réception** n'apparaît que lorsque Meta a accordé la messagerie pour cette page mais que la boîte n'a jamais été configurée pour la recevoir ; un seul clic suffit.",
            "**Réessayer l'abonnement** redemande à Meta d'envoyer les messages de cette page, sans toucher au reste de la connexion. La publication sur la page continue de fonctionner pendant que les messages n'arrivent pas.",
            "Une connexion dont le jeton cesse de fonctionner affiche **La connexion à votre page ne fonctionne plus. Reconnectez-la pour continuer à recevoir les messages.** en haut de Messages, avec un lien vers cette carte.",
          ] },
        ],
      },
      {
        id: "disconnecting",
        heading: "Déconnecter",
        blocks: [
          { p: "**Déconnecter** demande **Déconnecter Facebook et Instagram ?** puis supprime immédiatement le jeton d'accès enregistré. FieldQuo ne peut plus publier ni déclencher les publications programmées pour la page ; les publications déjà en ligne restent sur Facebook et Instagram, et les conversations déjà dans votre boîte restent dans FieldQuo." },
          { warning: "Si Meta ne confirme pas avoir cessé d'envoyer les messages de la page, la carte le dit : retirez FieldQuo des intégrations d'entreprise de la page dans les paramètres de Meta pour en être certain." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "**Paramètres → Publicités Meta** est sur la même tablette que Paiements : le propriétaire et les administrateurs seulement. Un Gestionnaire ou un Répartiteur ne voit pas la ligne, et chaque route derrière elle les refuse. Une fois la page connectée, quiconque a **Requests** en lecture seule lit la boîte — voir [[the-messages-inbox|La boîte de réception Messages]]." },
        ],
      },
    ],
    faq: [
      { q: "Faut-il un compte publicitaire Meta pour connecter ma page ?", a: "Non. Le compte publicitaire et la page sont deux cartes distinctes avec deux écrans de consentement distincts." },
      { q: "Mon compte Instagram n'apparaît pas.", a: "La carte affiche Facebook uniquement quand aucun compte Instagram professionnel n'est lié à la page dans les paramètres de Meta. Liez-le là-bas, puis appuyez sur Reconnecter ou changer de page." },
      { q: "Un Gestionnaire peut-il connecter la page ?", a: "Non. Publicités Meta est réservé au propriétaire et aux administrateurs, comme Paiements." },
    ],
  },

  "whatsapp-business": {
    title: "Les messages WhatsApp Business",
    summary:
      "Votre propre numéro WhatsApp Business traité dans la même boîte que Facebook et Instagram, avec la règle des 24 heures que WhatsApp impose lui-même et les modèles approuvés qui permettent de la contourner.",
    updated: "2026-09-12",
    intro: [
      "Le numéro WhatsApp Business d'un entrepreneur se connecte depuis la carte **WhatsApp Business** de **Paramètres → Publicités Meta**, par l'inscription de Meta, et dès lors chaque message qu'un client envoie à ce numéro arrive dans [[the-messages-inbox|Messages]] sous la pastille **WhatsApp**, à côté de Facebook et Instagram. Photos, vidéos, messages vocaux, documents, autocollants, fiches contact et positions arrivent tous ; photos, vidéos, documents et votre propre adresse peuvent repartir.",
      "Une règle surprendra quiconque n'a utilisé WhatsApp que sur un téléphone : sur un numéro d'entreprise, WhatsApp refuse un message écrit plus de **24 heures** après le dernier message du client. FieldQuo indique dans quel cas vous êtes sur chaque conversation et offre la porte de sortie — un modèle approuvé à l'avance par Meta — plutôt que de laisser l'envoi échouer après que vous avez appuyé sur le bouton.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La connexion exige une autorisation que Meta approuve par application. Tant qu'elle est en attente, la carte affiche **En attente de l'approbation de Meta** sans bouton, et une adresse tapée à la main ne peut pas non plus démarrer le parcours — le serveur la refuse avec la même phrase. Quand le parcours est ouvert, la carte affiche **Aucun numéro WhatsApp connecté** avec **Connecter WhatsApp**." },
          { p: "Sous le bouton se trouve une section repliée **Connecter avec des identifiants Cloud API (avancé)**. Elle existe pour les personnes qui administrent l'application Meta de FieldQuo elle-même et c'est la mauvaise porte pour tous les autres ; le bouton d'inscription est celui que Meta veut voir une entreprise emprunter." },
        ],
      },
      {
        id: "connect-your-number",
        heading: "Connecter votre numéro",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Publicités Meta** et descendez jusqu'à **WhatsApp Business**.",
            "Appuyez sur **Connecter WhatsApp**. Meta vous guide pour vous connecter, choisir ou créer un compte WhatsApp Business, et choisir le numéro de téléphone auquel vos clients écrivent.",
            "De retour sur la carte, le numéro apparaît avec son nom vérifié, **Connecté via l'inscription Meta**, et le numéro tel que Meta l'imprime. Les messages arrivent dans la boîte tout de suite après.",
            "Appuyez sur **Actualiser les modèles** pour lire vos modèles de message chez Meta. La carte liste chacun avec sa langue et le statut donné par Meta — **APPROVED**, ou ce que Meta indique.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — la carte WhatsApp Business au bas, avec Connecter WhatsApp et la section avancée repliée." },
          { note: "Un numéro qui ne reçoit rien est pire que pas de numéro : si FieldQuo ne peut pas s'abonner aux messages du numéro, rien n'est connecté et la carte le dit — **FieldQuo n'a pas pu s'abonner à vos messages : rien n'a été connecté, car un numéro qui ne reçoit rien est pire que pas de numéro. Réessayez.**" },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "La règle des 24 heures",
        blocks: [
          { p: "La carte l'énonce là où vous connectez : **WhatsApp ne transmet un message écrit que pendant 24 heures après le dernier message du client. Passé ce délai, vous pouvez encore le joindre, mais seulement avec un modèle approuvé à l'avance par Meta.** La fenêtre redémarre chaque fois que le client écrit de nouveau. FieldQuo la calcule avant que vous écriviez, alors la zone de rédaction change de forme au lieu d'échouer après Envoyer." },
          { table: {
            head: ["Ce que la conversation affiche", "Ce que vous pouvez envoyer"],
            rows: [
              ["Rien — la fenêtre est ouverte", "N'importe quoi : du texte, une photo, une vidéo, un document, votre adresse"],
              ["**Moins d'une heure pour répondre.**", "N'importe quoi, pour l'instant — répondez avant la fermeture"],
              ["**Plus de 24 heures se sont écoulées depuis leur dernier message : WhatsApp n'acceptera pas de message écrit.**", "Un **Modèle approuvé** dans le sélecteur qui remplace la zone de texte, avec ses valeurs à remplir"],
              ["**Cette personne ne vous a jamais écrit sur WhatsApp…**", "Seul un modèle approuvé peut démarrer la conversation"],
            ],
          } },
          { p: "Un envoi qui enfreint la règle malgré tout — un désaccord d'horloge, un message que FieldQuo n'a jamais reçu — est refusé par WhatsApp et apparaît dans le fil comme une réponse échouée avec la raison, et la ligne affiche **Non remis**." },
        ],
      },
      {
        id: "templates",
        heading: "Les modèles",
        blocks: [
          { p: "Les modèles s'écrivent et se soumettent dans le gestionnaire WhatsApp de Meta, pas dans FieldQuo. FieldQuo les lit avec **Actualiser les modèles**, n'offre que ceux que Meta a marqués **APPROVED**, et envoie par identifiant de modèle avec vos valeurs à remplir — jamais les mots du modèle retapés, pour qu'un modèle approuvé ne puisse pas servir d'enveloppe à autre chose. Un modèle rejeté reste dans la liste avec son statut, parce que « rejeté » est le fait dont vous avez besoin." },
          { tip: "Sans modèle approuvé, le sélecteur affiche **Vous n'avez encore aucun modèle WhatsApp approuvé. Créez-en un dans le gestionnaire WhatsApp de Meta, puis actualisez la liste dans les réglages.** Écrivez-en un avant d'en avoir besoin — un client qui a écrit le vendredi et reçoit une réponse le lundi est hors fenêtre." },
        ],
      },
      {
        id: "photos-files-and-your-address",
        heading: "Photos, fichiers et votre adresse",
        blocks: [
          { bullets: [
            "**Joindre un fichier** — WhatsApp seulement, du côté Répondre. Photos JPEG ou PNG jusqu'à 5 Mo (une photo de téléphone plus grosse, jusqu'à 25 Mo, est réduite pour entrer), vidéo MP4 ou 3GP jusqu'à 16 Mo, et documents PDF, Word, Excel, PowerPoint ou texte brut jusqu'à 100 Mo. La zone de texte devient **Ajouter une légende (facultatif)**.",
            "**Envoyer notre adresse** — la position de votre propre entreprise, affichée seulement quand l'adresse de l'entreprise a été choisie sur la carte et possède donc des coordonnées. Une position part seule ; WhatsApp n'y joint aucun texte, et la zone le dit.",
            "**Les messages vocaux, autocollants et fiches contact arrivent ici mais ne peuvent pas encore être envoyés.** Une fiche contact partagée par un client offre **Ajouter comme client** ; une position offre **Enregistrer comme adresse de Sam** sur un client lié.",
            "Les réponses Facebook et Instagram ne portent que du texte ; le trombone n'y est pas dessiné.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres outils ne font pas",
        blocks: [
          { p: "Aucune des pages de tarifs concurrentes consignées par les pages de comparaison de FieldQuo ne liste WhatsApp, à quelque palier que ce soit. Les pages de FieldQuo ne le listent pas encore non plus, volontairement, tant que Meta n'a pas approuvé l'autorisation — et le texte qui en sortira portera la phrase des 24 heures ci-dessus, parce qu'une page qui promet « écrivez à vos clients sur WhatsApp » sans elle promet quelque chose que WhatsApp ne permet pas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "Connecter et déconnecter un numéro, et actualiser les modèles, se fait dans **Paramètres → Publicités Meta** — propriétaire et administrateurs seulement. Lire et répondre aux conversations suit la règle de la boîte : **Requests** en lecture seule pour lire, en voir, créer et modifier pour répondre. Voir [[the-messages-inbox|La boîte de réception Messages]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je utiliser mon numéro WhatsApp personnel ?", a: "Seulement comme numéro WhatsApp Business choisi ou créé dans l'inscription de Meta. FieldQuo ne lit jamais un compte personnel." },
      { q: "Pourquoi ne puis-je envoyer qu'un modèle ?", a: "Plus de 24 heures se sont écoulées depuis le dernier message du client, ou cette personne ne vous a jamais écrit sur WhatsApp. WhatsApp refuse le texte écrit dans les deux cas ; le sélecteur de modèles est la porte de sortie." },
      { q: "Déconnecter supprime-t-il les conversations ?", a: "Non. Le numéro est marqué déconnecté et cesse de recevoir ; ce qui est déjà dans la boîte y reste." },
    ],
  },

  "conversation-status-and-who-looks-after-it": {
    title: "L'état d'une conversation et qui s'en occupe",
    summary:
      "Les quatre états d'une conversation, ce que fait la mise de côté et quand elle revient, la différence entre le résultat et l'état, et comment confier un fil à une personne.",
    updated: "2026-09-12",
    intro: [
      "Chaque conversation de [[the-messages-inbox|Messages]] répond à deux questions dans son onglet **Détails** : **Où en est cette conversation ?** — son état — et **S'en occupe** — la personne de votre équipe à qui elle appartient. L'état décide dans quel groupe la ligne se trouve ; la personne est celle que le bureau consulte quand un client rappelle pour faire un suivi.",
      "Une troisième question, **Est-ce devenu un chantier ?**, est le résultat, et elle est volontairement séparée : un état, c'est ce qui se passe maintenant ; un résultat, c'est ce que la conversation est finalement devenue. Les deux sont inscrits dans l'historique du fil avec un nom et une heure.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une nouvelle conversation est **Ouverte** et reste sous **À répondre** tant que le dernier mot est celui du client. Dès que vous répondez, elle passe dans **En attente de leur réponse**. De là, vous pouvez la mettre de côté jusqu'à une date (**Mise de côté**) ou la fermer (**Résolue**, le groupe **Terminées**). Un client qui réécrit rouvre de lui-même une conversation résolue, en attente ou mise de côté — sans tâche planifiée, sans bouton." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "Les quatre états",
        blocks: [
          { table: {
            head: ["État", "Quel groupe", "Ce que ça veut dire"],
            rows: [
              ["**Ouverte**", "À répondre, ou En attente de leur réponse une fois que vous avez répondu", "En cours. L'étiquette d'attente compte depuis le dernier message du client."],
              ["**En attente de leur réponse**", "En attente de leur réponse", "Vous avez posé une question et la balle est dans le camp du client. Réglé à la main quand vous voulez la sortir d'À répondre sans avoir répondu."],
              ["**Mise de côté**", "Mises de côté", "Stationnée jusqu'à une date et une heure que vous choisissez. **De retour le 14 sept.** s'affiche sur le sélecteur."],
              ["**Résolue**", "Terminées (replié par défaut)", "Finie. **Marquer terminée** dans l'en-tête la règle ; **Rouvrir** l'annule."],
            ],
          } },
        ],
      },
      {
        id: "snoozing",
        heading: "Mettre une conversation de côté",
        blocks: [
          { steps: [
            "Ouvrez la conversation et appuyez sur **Détails**.",
            "Sous **Où en est cette conversation ?**, choisissez **Mise de côté**. Le sélecteur révèle **La ramener quand ?** avec une date et une heure — l'état n'est pas enregistré tant qu'il n'y en a pas, parce que « stationnée jusqu'à un moment donné », c'est ainsi qu'un prospect disparaît.",
            "Appuyez sur **La mettre de côté**. Le fil consigne **Mise de côté jusqu'à une date par Dave** et la ligne passe dans **Mises de côté**.",
            "Elle revient d'elle-même. Une tâche planifiée passe toutes les quinze minutes ; quand l'heure est dépassée, l'état redevient **Ouverte**, la ligne retourne dans la liste de travail et l'historique indique **Revenue à la date prévue**. **La ramener maintenant** la réveille plus tôt.",
          ] },
          { note: "Si le client écrit pendant que la conversation est mise de côté, elle se réveille immédiatement et l'échéance est effacée, pour qu'elle ne puisse pas revenir une deuxième fois." },
        ],
      },
      {
        id: "outcomes",
        heading: "Marquer terminée, et le résultat",
        blocks: [
          { bullets: [
            "**Marquer terminée** règle l'état à **Résolue**. Cela ne dit rien sur le fait d'avoir gagné le contrat ou non.",
            "La pastille de résultat dans l'en-tête — et le sélecteur sous **Est-ce devenu un chantier ?** dans l'onglet **Résultat** — enregistre **Gagné** (c'est devenu un contrat), **Perdu** (ils sont allés ailleurs ou ont dit non), **Sans réponse** (personne dans l'entreprise n'a répondu, ou ils ne se sont plus manifestés après votre réponse) ou **Pas un chantier** (un fournisseur, une candidature, du spam — exclu du taux de conversion).",
            "Choisir un résultat, quel qu'il soit, fait passer la ligne dans **Terminées**, peu importe son état. Choisir **Ouverte** efface le résultat ; le bilan mensuel compte alors la conversation comme non évaluée, jamais comme perdue.",
            "Chaque changement est une ligne dans le fil et dans l'onglet **Historique** : **Résultat « Gagné » indiqué par Dave**, **Résultat effacé par Ana**, **Marquée résolue**.",
          ] },
        ],
      },
      {
        id: "looking-after-this",
        heading: "S'en occupe",
        blocks: [
          { p: "**S'en occupe** liste les personnes de votre équipe à qui un prospect peut être assigné — la même liste que le tableau des prospects — avec **Personne pour l'instant** par défaut. Choisir un nom inscrit **Assignée à Marc par Dave** dans l'historique ; choisir personne inscrit **Désassignée par Dave**. C'est une étiquette que le bureau lit, pas un filtre : la conversation reste dans le même groupe, et tous ceux qui peuvent lire la boîte la voient encore." },
          { tip: "L'assignation répond à « qui lui a parlé en dernier ? » quand le client appelle. Inscrivez-le ici plutôt que dans une note, pour que ça apparaisse dans l'onglet Détails et dans l'historique." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "Changer l'état, le résultat ou la personne assignée exige **Requests** en voir, créer et modifier — Estimateur, Répartiteur, Gestionnaire, propriétaire et administrateurs. Une personne en lecture seule voit l'état et le résultat actuels en toutes lettres, sans sélecteur ; le serveur refuse aussi le changement, alors ce n'est pas la commande cachée qui assure la sécurité." },
        ],
      },
    ],
    faq: [
      { q: "Quelle est la différence entre Résolue et Gagné ?", a: "Résolue est un état — la conversation est finie pour l'instant. Gagné est un résultat — c'est devenu un chantier. Une conversation résolue sans résultat apparaît comme Pas encore évaluée dans le bilan." },
      { q: "Puis-je mettre de côté sans date ?", a: "Non. La mettre de côté reste désactivé tant que vous n'avez pas choisi une date et une heure, et le serveur refuse une mise de côté sans échéance." },
      { q: "Assigner quelqu'un l'avertit-il ?", a: "Non. Cela inscrit son nom sur la conversation et dans son historique ; rien n'est envoyé." },
    ],
  },

  "private-notes-and-temperature": {
    title: "Les notes privées et la pastille de température",
    summary:
      "Comment laisser une note que seule votre équipe peut lire, pourquoi une note n'est pas une réponse, et comment la pastille Tiède 35 de chaque conversation est calculée à partir de ce que la personne a réellement fait.",
    updated: "2026-09-12",
    intro: [
      "Deux choses accompagnent une conversation sans jamais atteindre le client. Une **Note**, c'est ce que vous écrivez pour la prochaine personne qui ouvrira le fil — « exigeant sur la couleur des moulures, soumission élevée, magasine ailleurs ». La **pastille de température** — **Tiède 35**, **Chaud 72**, **Froid 0** — c'est ce que FieldQuo lit dans la conversation elle-même, avec les raisons listées, pour que vous sachiez avant de passer une soirée sur une soumission si cette personne décide ou magasine.",
      "La pastille annote ; elle ne filtre jamais. Une conversation froide reste dans la liste exactement là où elle serait sans score.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une note est conservée dans le fil comme une ligne d'un genre à part, peinte dans une teinte distincte pour qu'on ne puisse jamais la confondre avec un message, et elle passe par une route différente de celle d'une réponse — une route qui n'importe pas du tout le chemin d'envoi. C'est voulu : l'opinion d'un collègue sur un client ne doit jamais être à un réglage inversé de la boîte de réception de ce client." },
        ],
      },
      {
        id: "write-a-note",
        heading: "Écrire une note",
        blocks: [
          { steps: [
            "Ouvrez la conversation et appuyez sur l'onglet **Note** au-dessus de la zone. La zone change de couleur et l'exemple affiché est **Exigeant sur la couleur des moulures. Soumission élevée — magasine ailleurs.**",
            "Écrivez-la et appuyez sur **Enregistrer la note**. Sous la zone, on lit **Seule votre équipe voit ceci. Ce n'est jamais envoyé.**",
            "La note apparaît dans le fil à l'heure où vous l'avez enregistrée, avec votre nom, pour tous ceux qui peuvent lire la boîte.",
          ] },
          { note: "L'onglet Note n'est jamais bloqué par la connexion. Même pendant que FieldQuo attend l'autorisation de Meta et que l'onglet Répondre est désactivé, une note peut être enregistrée." },
        ],
      },
      {
        id: "what-a-note-does-not-do",
        heading: "Ce qu'une note fait et ne fait pas",
        blocks: [
          { bullets: [
            "Elle n'efface pas l'étiquette **Attend depuis** et ne sort pas la ligne d'**À répondre**. Écrire « elle est exigeante », ce n'est pas lui répondre.",
            "Elle n'est pas comptée comme une réponse dans le délai de première réponse du bilan mensuel.",
            "Elle ne porte aucune pièce jointe : une note ne sort jamais de l'entreprise, alors une photo dessus n'irait nulle part.",
            "Elle est exclue du score de température, qui ne lit que ce que vous et le client vous êtes réellement dit.",
          ] },
        ],
      },
      {
        id: "the-temperature-chip",
        heading: "La pastille de température",
        blocks: [
          { p: "Chaque conversation commence à **35**, le bas de tiède — quelqu'un a écrit à un entrepreneur, ce qui est plus que ce que la plupart des gens font, alors le froid doit être mérité par quelque chose qui a été dit. **Chaud**, c'est 60 et plus, **Tiède** de 30 à 59, **Froid** sous 30 : les mêmes tranches que le score d'un prospect sur le tableau des prospects, pour qu'une même personne ne porte jamais deux mots différents pour une même idée. Ce qui diffère, c'est la pondération. Un formulaire mesure l'effort — budget, photos, longueur du texte. Une conversation mesure ce que la personne a **fait**." },
          { table: {
            head: ["Ce que la personne a fait", "Points"],
            rows: [
              ["**Ils ont demandé comment ça se passe — payer, commencer ou entrer**", "+30, plus 6 à chaque fois de plus, jusqu'à 12 de plus"],
              ["**Ils ont ajouté des travaux que personne ne leur avait proposés**", "+20"],
              ["**Ils ont déplacé leurs propres dates pour s'adapter aux vôtres**", "+18"],
              ["**Ils ont contesté une ligne, pas vos prix**", "+12"],
              ["**Ils ont dit qu'ils demandaient d'autres soumissions**", "−30"],
              ["**Ils ont dit non à l'avance, poliment**", "−22"],
              ["**Soumission envoyée, relance faite, aucune réponse**", "−25"],
              ["**Ils ont annoncé un budget** · **Ils ont posé des questions sur les matériaux et les finis**", "0 — remarqué, volontairement sans valeur"],
            ],
          } },
          { p: "Quatre choses closent la discussion quoi qu'il ait été dit d'autre — **Ils ont dit être dans un secteur où vous ne travaillez pas**, **Leur budget est inférieur à ce que ce chantier coûte**, **Ils veulent une gamme de travaux moins chère que la vôtre**, **Ils ont dit qu'ils ne voulaient pas de ça** — et font tomber le score au froid, avec la phrase citée dessous : **À tirer au clair avant de passer une soirée sur une soumission. Vous connaissez le métier — si c'est faux, ignorez-le.**" },
          { p: "Sous cinq messages, le verdict est plafonné à tiède et la pastille affiche **incertain** : **Trop peu a été dit ici pour en être sûr. C'est une première lecture, pas un verdict.** Le panneau de l'onglet **Résultat** liste chaque raison avec le fragment qui l'a déclenchée, dans la langue du lecteur." },
        ],
      },
      {
        id: "read-it-with-fieldquo-ai",
        heading: "La lire avec FieldQuo AI",
        blocks: [
          { p: "Les règles ne voient pas deux choses que les conversations gagnantes partagent : la personne a-t-elle écrit comme quelqu'un qui décide (« allez-y ») ou comme quelqu'un qui hésite (« si le prix est bon »), et vous a-t-elle confié quelque chose de personnel sans rapport avec le chantier. **Lire cette conversation**, dans l'onglet Résultat, envoie le fil à FieldQuo AI pour exactement ces deux choses, avec vos propres conversations récentes gagnées et perdues comme exemples. Il peut déplacer le score d'une tranche au plus, vers le haut ou vers le bas, et ne peut jamais renverser l'un des quatre motifs d'exclusion — ce refus est dans le code, pas dans la consigne." },
          { note: "C'est payé à même votre quota IA mensuel et il le dit d'abord : **Utilise environ … de votre quota IA mensuel. Il vous reste … ce mois-ci.** Il faut au moins 4 messages, il refuse de relire un fil auquel rien n'a été ajouté, et rien n'est conservé quand le quota est épuisé — le score des règles demeure. Voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "Quiconque peut lire la boîte (**Requests** en lecture seule) lit les notes et la pastille. Écrire une note, et demander à FieldQuo AI de lire une conversation, exigent **Requests** en voir, créer et modifier — Estimateur et plus." },
        ],
      },
    ],
    faq: [
      { q: "Un client peut-il voir une note ?", a: "Non. Les notes sont enregistrées par une route qui ne peut pas envoyer, et elles sont dessinées dans leur propre couleur pour que personne ne les confonde avec une réponse." },
      { q: "Pourquoi une conversation est-elle Tiède 35 alors que rien n'a été dit ?", a: "35 est le score de départ. Rien de décisif n'a été dit dans un sens ou dans l'autre ; la pastille bougera quand la personne fera quelque chose que les règles reconnaissent." },
      { q: "Pourquoi la lecture IA ne change-t-elle rien ?", a: "Elle ne peut ajuster que d'une tranche et jamais au-delà d'un motif d'exclusion ; quand elle ne trouve ni engagement ni confidence personnelle, elle affiche N'a rien trouvé à changer." },
    ],
  },

  "the-ai-employee": {
    title: "L'employé IA : des brouillons que vous approuvez",
    summary:
      "Embauchez un assistant pour un poste — chargé de vente, réceptionniste ou soutien technique — qui répond au message d'un client à partir de vos tarifs et de vos documents, rédige un brouillon, et attend que vous l'envoyiez.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Employé IA** est l'endroit où vous embauchez un assistant qui répond aux messages qui arrivent dans [[the-messages-inbox|Messages]]. Vous choisissez le poste qu'il occupe, comment il écrit, ce qu'il peut lire, et s'il rédige ou envoie. Par défaut, il rédige : **Il rédige la réponse et attend. Rien n'atteint le client tant que vous n'appuyez pas sur envoyer.**",
      "La ligne du menu porte une étiquette **Aperçu**, et l'écran s'ouvre sur la seule chose qu'il ne peut pas encore faire : **Les réponses ne peuvent pas encore sortir. L'employé IA répond à vos messages Facebook et Instagram, et Meta n'a pas approuvé la messagerie pour FieldQuo. Tout fonctionne ici — il rédige, et les brouillons attendent ci-dessous que vous les envoyiez.** Configurez-le, alimentez-le, testez-le avec le vrai code ; l'envoi attend Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le poste est un ensemble de capacités, pas une personnalité. Une **Réceptionniste** n'a aucun moyen de consulter un prix — pas « on lui a dit de ne pas le faire », mais on ne lui a pas donné l'outil — alors un propriétaire qui demande trois fois ne peut pas lui en soutirer un. Chaque poste partage les mêmes règles absolues : il ne peut jamais inventer un prix, une date ni une politique ; si ce n'est pas dans vos propres données ou vos propres documents, il confie la conversation à une personne. Il ne prétend jamais être une personne nommée et, si on lui pose la question franchement, il dit que la réponse est automatique et qu'un membre de l'équipe fera un suivi." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Quel poste occupe-t-il ?** — quatre cartes : **Chargé de vente**, **Réceptionniste**, **Soutien technique**, **Autre chose**, chacune avec **It can:** et **It cannot:** dessous.",
            "**Comment il écrit** — **Comment vous l'appelez** (pour vous, jamais dit aux clients), **Ton** (professional, warm ou brief), **Phrase d'ouverture (facultatif)**, **Vos instructions**, **Quand il doit aller chercher quelqu'un**.",
            "**Brouillon, ou envoi ?** — **Rédige-moi un brouillon (recommandé)** ou **L'envoyer automatiquement**.",
            "**Limites** — **Répondre uniquement pendant les heures d'ouverture**, **Nombre maximal de réponses dans une conversation**, **Activer l'employé IA**, puis **Enregistrer**.",
            "**Ce qu'il lit** — **Téléverser un fichier** ou **Coller du texte à la place**, et la liste de ce qu'il a lu.",
            "**Essayez-le** — une zone de test qui exécute le vrai chemin de réponse, puis **En attente de vous** (les brouillons) et **Il s'est arrêté sur celles-ci**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "L'embaucher",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Employé IA** et choisissez un poste. **Chargé de vente** est le seul poste autorisé à s'approcher d'un chiffre : il lit vos tarifs et peut monter une estimation instantanée à partir de vos propres taux. **Réceptionniste** prend les coordonnées et fixe un rappel. **Soutien technique** répond à partir des documents que vous téléversez et nomme le document.",
            "Remplissez **Vos instructions** — les secteurs que vous couvrez, ce que vous ne faites pas, la façon dont vous aimez que les choses soient formulées — et **Quand il doit aller chercher quelqu'un** (« tout ce qui touche à une fuite, toute personne qui demande le propriétaire »).",
            "Laissez **Rédige-moi un brouillon (recommandé)** sélectionné. Réglez **Nombre maximal de réponses dans une conversation** — 3 par défaut ; après cela, il s'arrête et vous laisse le fil, et zéro le met en pause sans perdre votre configuration.",
            "Sous **Ce qu'il lit**, téléversez votre politique, vos notes de dépannage ou un manuel, ou collez le texte.",
            "Cochez **Activer l'employé IA** et appuyez sur **Enregistrer**. Puis tapez le message d'un client sous **Essayez-le** et appuyez sur **Voir la réponse** — il nomme les documents et les outils qu'il a utilisés, et ce que le test a coûté.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Paramètres → Employé IA — les quatre postes avec ce que chacun peut et ne peut pas faire, Comment il écrit, Brouillon ou envoi, et Limites." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que change chaque réglage",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il fait"],
            rows: [
              ["Le poste", "Fixe les outils qu'il peut appeler. Chargé de vente : consulter les prix de vos services, créer une estimation instantanée, fixer un rappel, confier à une personne. Réceptionniste, Soutien technique et Autre chose : fixer un rappel et confier seulement."],
              ["**Ton**", "Professional (simple, sans point d'exclamation ni émoji), warm (un émoji au plus, et seulement s'ils en ont utilisé un d'abord), ou brief (deux phrases)."],
              ["**Rédige-moi un brouillon**", "La réponse attend sous **En attente de vous** avec **L'envoyer** et **Pas celle-ci**. En envoyer une l'envoie dans la conversation exactement comme si vous l'aviez écrite."],
              ["**L'envoyer automatiquement**", "La réponse part directement au client sans que personne ne la lise d'abord. Il refuse toujours d'annoncer un prix qui ne vient pas de vos tarifs, s'arrête toujours quand il n'est pas sûr, et s'arrête toujours quand votre crédit IA est épuisé. Aujourd'hui le canal est bloqué, alors il rédige dans les deux cas."],
              ["**Répondre uniquement pendant les heures d'ouverture**", "Utilise les heures d'ouverture enregistrées dans le Profil de l'entreprise ; en dehors, le message vous attend. Sans heures enregistrées, cela ne fait rien — il ne devinera pas un lundi-vendredi. Voir [[opening-hours|Les heures d'ouverture]]."],
              ["**Nombre maximal de réponses dans une conversation**", "Le plafond par fil. Une fois atteint, le fil apparaît sous **Il s'est arrêté sur celles-ci** avec **Le laisser répondre à nouveau**."],
            ],
          } },
          { p: "Un brouillon rédigé avant que vous changiez un réglage porte la mention **rédigée avant votre dernière modification**, pour que vous sachiez qu'il reflète les anciennes instructions." },
        ],
      },
      {
        id: "what-it-reads",
        heading: "Ce qu'il lit",
        blocks: [
          { p: "L'écran le dit avant le clic : **Nous pouvons lire du texte brut : .txt, .md et .csv, ou du texte que vous collez. Nous ne pouvons pas encore lire un PDF ni un fichier Word — si vous en téléversez un, il apparaîtra ci-dessous marqué non lu, et la solution est de coller le texte ou de l'exporter en .txt.** Un fichier lu affiche **lu, environ 1 400 jetons**. Les documents sont clôturés comme des preuves : une consigne cachée dans un manuel n'est que du texte, jamais un ordre." },
          { note: "Chaque réponse et chaque test consomment du crédit IA, mesuré comme tout le reste dans FieldQuo AI. Quand le quota est épuisé, l'écran le dit avec un lien **Recharger le crédit IA**, et l'employé s'arrête au lieu de deviner. Voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres outils ne font pas",
        blocks: [
          { p: "Les pages de tarifs concurrentes que FieldQuo consigne offrent des réceptionnistes téléphoniques IA et des allocations de crédits IA ; aucune ne liste un assistant qui répond à un message Facebook, Instagram ou WhatsApp à partir des tarifs de l'entreprise et des documents qu'elle a téléversés. Les pages de comparaison de FieldQuo l'omettent aussi, volontairement, tant que Meta n'a pas approuvé le canal — vendre aujourd'hui « une IA qui répond à vos messages Facebook » serait vendre la moitié qui est bloquée." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "**Paramètres → Employé IA** est réservé au propriétaire, aux administrateurs et aux profils Gestionnaire et Répartiteur — le même échelon que la réceptionniste téléphonique, parce qu'il décide de ce qui est dit aux clients au nom de l'entreprise et dépense le quota IA de l'entreprise. Équipe et Estimateur ne voient pas la ligne. Envoyer ou écarter un brouillon depuis cet écran exige le même accès que l'écran lui-même." },
        ],
      },
    ],
    faq: [
      { q: "Les clients sauront-ils qu'ils parlent à un logiciel ?", a: "Il ne dit jamais qu'il est un logiciel ni une personne nommée, sauf si quelqu'un le demande directement ; il dit alors clairement que la réponse est automatique et qu'une personne fera un suivi. Le nom que vous lui donnez est pour vous." },
      { q: "Peut-il annoncer un prix ?", a: "Seulement le Chargé de vente, et seulement un chiffre qu'un outil FieldQuo a calculé à partir de vos propres taux, qu'il répète en citant sa source. Il ne peut ni additionner, ni rabaisser, ni arrondir, ni « partir de » quoi que ce soit." },
      { q: "Pourquoi n'y a-t-il rien sous En attente de vous ?", a: "Aucun message auquel il pourrait répondre n'est arrivé — le plus souvent parce qu'aucune page n'est connectée ou que Meta n'a pas encore approuvé la messagerie — ou bien il est désactivé, hors des heures d'ouverture, ou au-dessus de son plafond." },
      { q: "Répond-il sur WhatsApp ?", a: "À l'intérieur de la fenêtre de 24 heures de WhatsApp, oui, de la même façon. En dehors, il n'envoie pas de modèle à votre place." },
    ],
  },

  "the-monthly-review": {
    title: "Le bilan mensuel de votre boîte de réception",
    summary:
      "Quelles conversations sont devenues des chantiers, en combien de temps chacune a reçu une réponse, et qui n'a jamais eu de réponse du tout — un mois à la fois, avec une lecture facultative par FieldQuo AI de ce que les gagnantes ont fait.",
    updated: "2026-09-12",
    intro: [
      "Le bouton **Bilan mensuel** en haut de [[the-messages-inbox|Messages]] ouvre la raison pour laquelle les conversations sont conservées : une fois par mois, voir lesquelles ont conclu le contrat et lesquelles non, et à quelle vitesse chacune a reçu une réponse. Une conversation est classée dans le mois où elle a **commencé** — l'onglet **Historique** de chaque fil le dit — alors une demande de juillet évaluée en septembre compte toujours en juillet.",
      "Il n'imprime jamais un zéro pour ce qu'il ne sait pas. Un mois sans rien d'évalué n'a pas de taux de conversion et le dit ; une conversation à laquelle personne n'a répondu affiche **Sans réponse**, pas 0 min.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran place les conversations sans réponse en premier. Gagné et perdu, c'est de l'histoire ; **Quelqu'un a écrit et aucune réponse n'est partie**, c'est la seule ligne encore réparable, et elle se trouve dans un encadré ambre au-dessus du taux. Chaque nom de la page est un lien vers le fil." },
        ],
      },
      {
        id: "open-it",
        heading: "Lire un mois",
        blocks: [
          { steps: [
            "Ouvrez **Messages → Bilan mensuel**. Il s'ouvre sur le mois courant ; les flèches passent au **Mois précédent** et au **Mois suivant**.",
            "Lisez les trois tuiles : **Conversations commencées**, **Gagnées** (avec **3 sur 9 évaluées** dessous), **Première réponse habituelle**.",
            "Parcourez **Jamais répondu** — chaque ligne est un nom, la date et **2 de sa part** — et répondez ou évaluez chacune.",
            "Vérifiez **Ce qu'elles sont devenues** et **Délai de première réponse, par résultat**, puis évaluez ce qui est encore **Pas encore évaluée**.",
          ] },
          { figure: "harness:messages-review", caption: "Bilan mensuel — les trois tuiles, l'encadré Jamais répondu, Ce qu'elles sont devenues, et le délai de première réponse par résultat." },
        ],
      },
      {
        id: "what-the-numbers-mean",
        heading: "Ce que veulent dire les chiffres",
        blocks: [
          { table: {
            head: ["Ligne", "Comment c'est compté"],
            rows: [
              ["**Conversations commencées**", "Les fils dont le premier message du client tombe dans le mois."],
              ["**Gagnées**", "Gagnées divisées par évaluées, où évaluées = Gagné + Perdu + Sans réponse. **Pas un chantier** est exclu — un fournisseur n'est pas une vente perdue. Sans rien d'évalué : **Rien n'a encore été marqué gagné ou perdu : aucun taux à afficher.**"],
              ["**Première réponse habituelle**", "La médiane du délai entre le premier message du client et la première réponse de quelqu'un de l'entreprise, sur les fils qui en ont reçu une. Les notes ne comptent pas."],
              ["**Jamais répondu (2)**", "Les fils avec un message entrant et aucune réponse, jamais."],
              ["**Ce qu'elles sont devenues**", "Un compte par résultat, plus **Pas encore évaluée**."],
              ["**Délai de première réponse, par résultat**", "La médiane par résultat, avec **3 avec réponse** et **1 sans réponse** à côté de chacun. **Ce sont de petits nombres. À lire comme une comparaison, pas comme une statistique.**"],
              ["**Classé selon ce qu'ils ont dit**", "Toutes les conversations du mois, les froides comprises, classées par score de température avec la raison la plus forte citée."],
            ],
          } },
        ],
      },
      {
        id: "what-the-winning-conversations-did",
        heading: "Ce que les conversations gagnantes ont fait",
        blocks: [
          { p: "Sous les chiffres, **Analyser ce mois-ci** demande à FieldQuo AI de lire les conversations du mois devenues des contrats à côté de celles qui ne l'ont pas été, et de nommer la différence. Le résultat revient sous **Ce que les conversations gagnantes ont fait**, **Trois choses à changer**, **À relancer** (avec **Ouvrir la conversation** sur chacune), et **Qui a rédigé les 6 soumissions issues de ces conversations**. Les montants sont retirés des transcriptions avant que le modèle les lise, et l'analyse d'un mois est conservée pour être relue sans payer de nouveau ; **Analyser de nouveau** la refait à neuf." },
          { note: "Il lui faut assez de matière pour trouver une tendance plutôt que deux anecdotes : au moins **8** conversations associées à un client et au moins **3** d'entre elles gagnées, sinon il le dit — **Seulement 2 des conversations de ce mois-ci sont devenues des contrats. Il en faut 3 pour que « ce qu'ont fait les gagnantes » veuille dire quelque chose.** Il utilise votre allocation IA mensuelle et affiche d'abord l'estimation. Quand les éléments sont minces, le résultat est présenté comme un point de départ, pas comme un constat." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La même règle que la boîte : **Requests** en lecture seule lit le bilan — Estimateur, Répartiteur, Gestionnaire, propriétaire et administrateurs. Lancer l'analyse IA exige l'accès voir, créer et modifier aux demandes, parce qu'elle dépense l'allocation de l'entreprise." },
        ],
      },
    ],
    faq: [
      { q: "Une conversation du mois dernier a été évaluée cette semaine. Dans quel mois compte-t-elle ?", a: "Dans le mois où elle a commencé. L'onglet Historique du fil le nomme : Comptée dans le bilan d'août, le mois où elle a commencé." },
      { q: "Pourquoi le taux de conversion est-il vide ?", a: "Rien dans ce mois n'a encore été marqué Gagné, Perdu ou Sans réponse. Évaluez les conversations et le taux apparaît." },
      { q: "Le bilan m'envoie-t-il un courriel ?", a: "Non. C'est un écran que vous ouvrez ; rien n'est envoyé." },
    ],
  },

  "client-texts-on-my-way-and-reminders": {
    title: "Les deux textos que reçoivent vos clients",
    summary:
      "Le texto « en route » et le rappel de rendez-vous — quand chacun est envoyé, les champs que vous pouvez utiliser, comment la formulation suit la langue du client, et ce que FieldQuo n'envoie pas par texto.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo envoie un texto à un client en exactement deux occasions : quand un membre de l'équipe appuie sur **On my way** sur une visite, et, si vous l'activez, un rappel **2 heures avant**, **24 heures avant** ou **48 heures avant** un rendez-vous. **Paramètres → Messages aux clients** est l'endroit où vous changez la formulation des deux, avec un aperçu **Votre client voit :** en direct pour que personne n'envoie jamais un **{price}** brut à un client.",
      "Il n'y a pas de troisième texto. La page le dit — deux sortes de textos et pas plus — et elle ne peut pas faire apparaître un éditeur pour un message qui ne part jamais, parce que la liste vient des messages qui sont réellement envoyés.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les deux textos partent du numéro de texto partagé de FieldQuo et commencent par le nom de votre entreprise — **Northside Painting : Dave est en route, arrivée dans 20 min.** — pour que le client sache de qui ça vient. Chaque rappel se termine par **Répondez STOP pour ne plus recevoir**, et un client qui répond STOP ne reçoit plus jamais ni l'un ni l'autre ; la même vérification de désabonnement s'exécute avant le texto « en route ». Les rappels partent par texto seulement : il n'y a pas de rappel par courriel." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "Les deux textos",
        blocks: [
          { table: {
            head: ["Texto", "Quand il est envoyé", "Champs"],
            rows: [
              ["**On my way**", "Au moment où l'état d'une visite passe à **En route** sur la page du chantier — par le membre d'équipe assigné, n'importe qui sur une visite non assignée, ou quelqu'un qui peut modifier l'horaire de tout le monde. Le bouton nomme le numéro qu'il va texter, ou dit clairement que le client n'a pas de téléphone au dossier et que rien ne partira.", "**{company}**, **{worker}**, **{name}**, **{eta}**"],
              ["**Appointment reminder**", "Une fois par rendez-vous, dans l'heure du délai choisi dans **Paramètres → Notifications → Rappels de rendez-vous** (**Désactivé**, **2 heures avant**, **24 heures avant**, **48 heures avant**). Désactivé par défaut ; une entreprise qui n'a jamais choisi de délai n'en envoie aucun.", "**{company}**, **{when}**, **{location}**"],
            ],
          } },
          { p: "La formulation par défaut, telle que le client la reçoit : **Northside Painting : Dave est en route, arrivée dans 20 min. Répondez si vous devez reporter.** et **Northside Painting : Rappel — votre rendez-vous est mar. 12 août à 14 h au 123 Oak St. Répondez STOP pour ne plus recevoir.** Un champ sans valeur disparaît tout simplement — pas d'heure d'arrivée, pas de « arrivée dans , »." },
        ],
      },
      {
        id: "edit-the-wording",
        heading: "Changer la formulation",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Messages aux clients** (sous **Messagerie et alertes**).",
            "Écrivez dans la zone **On my way** ou **Appointment reminder**. Touchez une pastille — **{company}**, **{worker}**, **{name}**, **{eta}** — pour insérer un champ à la fin.",
            "Regardez **Votre client voit :** se remplir avec des valeurs d'exemple. Un champ inconnu est signalé — **Champ inconnu : {price}. Seuls les champs ci-dessus fonctionnent.** — et **Enregistrer** reste désactivé tant qu'il n'a pas disparu. Le serveur vérifie la même chose.",
            "Appuyez sur **Enregistrer**. La carte reçoit l'étiquette **Personnalisé** et un bouton **Utiliser le texte par défaut**, qui remet la formulation intégrée.",
          ] },
          { figure: "live:app-settings-messages", caption: "Paramètres → Messages aux clients — un éditeur par texto avec ses pastilles de champs, l'aperçu Votre client voit, et Enregistrer." },
          { tip: "Passé 160 caractères, un texto se divise en segments et coûte plus cher ; la phrase de désabonnement du rappel fait partie du compte. Tenez-vous-en à un écran." },
        ],
      },
      {
        id: "languages",
        heading: "Dans quelle langue le client le reçoit",
        blocks: [
          { p: "Le texto suit le client comme sa soumission le fait. **Votre formulation va aux clients qui lisent la langue de votre entreprise. Un client d'une autre langue reçoit la nôtre, dans la sienne — les mêmes huit langues que sa soumission.** Ainsi, un atelier québécois qui personnalise le texto français l'envoie à ses clients francophones, et un client anglophone reçoit la formulation anglaise de FieldQuo — jamais une traduction automatique de la vôtre. L'heure du rendez-vous est écrite dans la langue du client et le fuseau horaire de votre entreprise. Voir [[a-clients-language|La langue d'un client]]." },
        ],
      },
      {
        id: "what-is-not-automated",
        heading: "Ce que FieldQuo n'envoie pas par texto",
        blocks: [
          { bullets: [
            "Pas de texto de confirmation de réservation. Une visite réservée depuis votre page de réservation est confirmée par courriel, pas par texto.",
            "Pas de textos « votre soumission est prête », « votre facture est en retard » ni « chantier terminé ». Ceux-là partent par courriel.",
            "Pas de textos bidirectionnels avec les clients depuis la boîte de réception. Un client qui répond à un rappel n'écrit pas à votre équipe ; seul STOP est écouté.",
            "La formulation du rappel se modifie ici, mais le délai se règle dans Notifications, et les rappels ne partent jamais par courriel.",
          ] },
          { p: "La liste complète, avec ce que chaque canal transporte, se trouve dans [[texting-clients-what-is-and-is-not-automated|Texter les clients : ce qui est automatisé et ce qui ne l'est pas]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "**Paramètres → Messages aux clients** est réservé au propriétaire, aux administrateurs, aux Gestionnaires et aux Répartiteurs. Le délai de rappel dans **Paramètres → Notifications** est réservé au propriétaire et aux administrateurs. Appuyer sur **On my way** sur une visite suit la règle de l'horaire : le membre d'équipe assigné, n'importe qui sur une visite non assignée, ou quelqu'un qui peut modifier l'horaire de tout le monde." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le rappel est-il parti en anglais à un client francophone ?", a: "Votre formulation personnalisée ne va qu'aux clients qui lisent la langue de votre entreprise. Un client d'une autre langue reçoit la formulation intégrée de FieldQuo dans la sienne — vérifiez la langue du client dans sa fiche." },
      { q: "Puis-je mettre un lien vers la soumission dans un texto ?", a: "Non. Seuls les champs des pastilles fonctionnent, et le serveur refuse tout autre champ." },
      { q: "L'état est passé à En route mais aucun texto n'est arrivé.", a: "Le client n'a pas de numéro de téléphone au dossier, a répondu STOP à un moment donné, ou son numéro n'a pas pu être lu comme un numéro nord-américain. L'état est quand même enregistré ; le bouton dit à l'avance si un texto partira." },
    ],
  },

  "email-templates": {
    title: "Les modèles de courriel",
    summary:
      "L'éditeur par blocs derrière les courriels qu'envoient vos règles de relance et vos campagnes courriel, les champs de fusion qu'il comprend, et ce que l'étiquette Actif décide et ne décide pas.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Modèles de courriel** liste chaque modèle de courriel de votre entreprise, regroupés **Automatisé**, **Marketing** et **Personnalisé**, une ligne par modèle avec une étiquette **Actif**, et les icônes modifier, dupliquer et supprimer. **Ajouter les modèles par défaut** crée un jeu de départ — un par type automatisé — pour qu'une règle de relance ait quelque chose à envoyer sans rien construire à la main.",
      "Chaque modèle s'ouvre dans un éditeur par blocs conçu pour le téléphone : titres, texte, images, boutons, séparateurs, un résumé de soumission ou de facture, une liste détaillée et un suivi d'étapes, réordonnés par glisser-déposer, avec des jetons **{{mergeField}}** et un aperçu téléphone ou bureau. Votre logo et votre couleur de marque viennent d'Image de marque, sauf si vous les remplacez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Six types : **Quote email**, **Instructions email**, **Receipt / invoice email** et **Follow-up email** sous Automatisé ; **Marketing email** ; et **Custom**. Un type sans modèle affiche **Aucun modèle pour l'instant — utilisation de la valeur par défaut intégrée.** Vous pouvez créer autant de brouillons et de variantes d'un type que vous voulez ; celui marqué **Actif** est le modèle par défaut de l'entreprise pour ce type." },
          { figure: "live:app-settings-email-templates", caption: "Paramètres → Modèles de courriel — les groupes Automatisé, Marketing et Personnalisé, une ligne par modèle avec son étiquette Actif, et Ajouter les modèles par défaut." },
        ],
      },
      {
        id: "where-a-template-is-used",
        heading: "Où un modèle est réellement utilisé",
        blocks: [
          { p: "Lisez ceci avant de passer une soirée sur un modèle. Un modèle de cet écran est envoyé quand une **règle de relance** ou une **campagne courriel** le nomme : une règle dans **Paramètres → Relances** choisit l'un de vos modèles Follow-up, Marketing ou Custom et l'envoie un délai donné après qu'une soumission, une facture ou un chantier atteint un état ; une campagne courriel dans Marketing choisit un modèle Marketing ou Custom et l'envoie à vos abonnés. Voir [[follow-up-rules|Les règles de relance]] et [[email-campaigns-and-subscribers|Les campagnes courriel et les abonnés]]." },
          { warning: "Le courriel de soumission et les courriels de facture et de reçu qu'un client reçoit sont construits par FieldQuo à partir du document lui-même — les mêmes sections que le PDF, votre image de marque, et les références et photos que vous réglez dans **Paramètres → Courriel de soumission**. Aujourd'hui, aucun envoi ne lit les modèles **Quote email**, **Receipt / invoice email** ni **Instructions email** de cet écran, alors en modifier un ne change rien à ce qu'un client reçoit. Pour changer ce que transporte le courriel de soumission, voir [[settings-quote-email|Les réglages du courriel de soumission]]." },
        ],
      },
      {
        id: "the-editor",
        heading: "Construire un modèle",
        blocks: [
          { steps: [
            "Appuyez sur **Nouveau modèle** sur le type voulu, nommez-le, et appuyez sur **Créer et modifier**.",
            "Réglez l'**Objet**. **Les champs de fusion fonctionnent ici aussi. Laissé vide, l'objet intégré pour ce type de modèle est utilisé.**",
            "Appuyez sur **Ajouter un bloc** et choisissez **Heading**, **Text**, **Image**, **Button**, **Divider**, **Spacer**, **Quote/Invoice summary**, **Itemized list** ou le suivi d'étapes. Glissez la poignée pour réordonner ; chaque bloc a ses propres commandes d'alignement, de taille, de largeur ou de couleur.",
            "Cliquez dans un champ de texte et appuyez sur **Insérer un champ de fusion** pour y déposer un jeton comme **{{clientName}}** ; tant qu'aucun champ n'a le focus, le bouton affiche **Cliquez d'abord dans un champ de texte**.",
            "Vérifiez **Apparence** : **Selon votre image de marque** reprend votre logo et votre couleur de marque ; remplacez les couleurs d'en-tête, de fond, de texte, d'accent et de bouton et il affiche **Personnalisé**, avec **Réinitialiser à l'image de marque de mon entreprise** pour annuler. Sans logo téléversé, l'en-tête affiche plutôt le nom de votre entreprise.",
            "Utilisez **Aperçu mobile** et **Aperçu bureau** (**Aperçu (données d'exemple)**), tapez votre adresse sous **Envoyer un test**, et appuyez sur **Enregistrer**. **Rendre actif** en fait le modèle par défaut du type.",
          ] },
        ],
      },
      {
        id: "merge-fields",
        heading: "Les champs de fusion",
        blocks: [
          { table: {
            head: ["Champ", "Rempli avec"],
            rows: [
              ["**{{clientName}}**, **{{clientAddress}}**, **{{clientPhone}}**", "Le nom du client, l'adresse du client ou du chantier, son téléphone"],
              ["**{{companyName}}**, **{{companyPhone}}**, **{{companyEmail}}**", "Les coordonnées de votre entreprise, du Profil de l'entreprise"],
              ["**{{quoteNumber}}**, **{{quoteTotal}}**, **{{quoteUrl}}**", "La soumission pour laquelle une règle de relance s'est déclenchée, et le lien pour l'approuver"],
              ["**{{invoiceNumber}}**, **{{invoiceTotal}}**, **{{invoiceUrl}}**, **{{dueDate}}**, **{{balanceDue}}**, **{{amountPaid}}**", "La facture, son lien de paiement, son échéance et ce qu'il reste à payer"],
              ["**{{projectStartDate}}**, **{{projectEndDate}}**, **{{jobTitle}}**", "Les dates et le titre du chantier"],
            ],
          } },
          { p: "Un champ que le dossier n'a pas est laissé vide à l'envoi ; le courriel de test les remplit avec des valeurs d'exemple (**Jane Doe**, **Q-1042**, **$4,250.00**) et les vraies coordonnées de votre entreprise." },
        ],
      },
      {
        id: "deleting",
        heading: "Dupliquer et supprimer",
        blocks: [
          { p: "L'icône dupliquer copie un modèle, sections comprises, pour que vous puissiez essayer une variante sans toucher à celui qu'une règle utilise. L'icône corbeille demande d'abord : la suppression est définitive, et une règle de relance qui pointait vers le modèle supprimé est sautée à l'envoi plutôt que d'envoyer autre chose. Supprimer celui marqué **Actif** laisse le type sans modèle par défaut jusqu'à ce que vous en marquiez un autre." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut les voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs voient **Paramètres → Modèles de courriel** et peuvent créer, modifier, activer, dupliquer, supprimer et générer des modèles. Équipe et Estimateur ne voient pas la ligne." },
        ],
      },
    ],
    faq: [
      { q: "J'ai modifié le modèle Quote email et la soumission reçue par mon client n'a pas changé. Pourquoi ?", a: "Le courriel de soumission est construit à partir de la soumission elle-même et de vos réglages de Courriel de soumission, pas de ce modèle. Changez les références et les photos dans Paramètres → Courriel de soumission ; la formulation du courriel d'accompagnement est celle de FieldQuo, dans la langue de la soumission." },
      { q: "À quoi sert Actif, alors ?", a: "Il marque le modèle par défaut de l'entreprise pour ce type. Une règle de relance ou une campagne nomme quand même le modèle exact qu'elle envoie." },
      { q: "Puis-je envoyer un modèle à un client d'ici ?", a: "Seulement un test à votre propre adresse avec Envoyer un test. Les envois aux clients passent par les règles de relance et les campagnes courriel." },
    ],
  },
};
