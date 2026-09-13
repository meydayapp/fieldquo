// content/help/fr/integrations.js
//
// Articles of the “integrations” category in fr. Keyed by slug; the slugs are
// listed in lib/help/tree.js and scripts/check-help-centre.mjs refuses a
// module that is missing one or carries one the tree does not.
//
// Même structure que l'anglais (mêmes slugs, mêmes sections, mêmes blocs,
// mêmes figures) ; les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js. Registre québécois, vous.
export const ARTICLES = {
  "stripe": {
    title: "Stripe",
    summary:
      "Comment Stripe sert deux fois — une fois pour que vos clients vous paient, une fois pour que FieldQuo vous facture — ce que vous connectez, ce que Stripe voit, et ce que Déconnecter fait vraiment.",
    updated: "2026-09-12",
    intro: [
      "Stripe fait deux choses différentes dans FieldQuo, et ce n'est jamais le même compte. **Stripe Connect** est à vous : un compte Express créé au nom de votre entreprise quand vous appuyez sur **Connecter avec Stripe**, dans lequel chaque paiement en ligne d'un client est déposé. **Stripe Billing** est celui de FieldQuo : la carte donnée à l'inscription, prélevée pour votre forfait, votre crédit téléphonique et le service de migration. Cet article porte sur le premier, et dit où vit le second pour que les deux ne soient jamais confondus.",
      "En bref : connectez une fois dans **Paramètres → Paiements**, terminez ce que Stripe demande sur sa propre page, et dès lors chaque facture, dépôt et versement porte un bouton Payer. FieldQuo ne détient jamais l'argent et ne voit jamais vos coordonnées bancaires.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un client qui paie en ligne, c'est un débit Stripe créé au nom de votre entreprise — c'est votre nom qui apparaît sur son relevé de carte — et versé à votre banque par Stripe selon son calendrier habituel, environ 2 jours ouvrables pour un compte canadien ou américain. Des frais de traitement sont retenus sur chaque paiement avant qu'il vous parvienne : **3 % + 0,30 $** sur une carte, **1 % + 0,40 $ plafonné à 5,00 $** sur un débit bancaire canadien, **0,8 % plafonné à 5,00 $** sur un débit américain. Rien n'est facturé à part et il n'y a aucuns frais mensuels pour encaisser. Tout le calcul est dans [[payment-processing-fees-and-payouts|Frais de traitement et versements]]." },
          { p: "Votre abonnement, c'est l'autre Stripe. Il est prélevé sur la carte inscrite dans **Compte et facturation**, et **Gérer la facturation et le mode de paiement** y ouvre le portail de facturation Stripe pour cette carte — pas votre compte de versements. Les deux ne se touchent jamais : le paiement d'un client ne peut jamais servir à votre facture FieldQuo, et votre facture FieldQuo n'est jamais retenue sur vos versements." },
          { note: "FieldQuo transmet à Stripe le numéro de la facture et le montant. Le client tape sa carte ou ses coordonnées bancaires sur la page de Stripe, jamais sur une page FieldQuo, et la ligne au bas de Paramètres → Paiements est vraie au mot près : FieldQuo ne voit ni ne conserve jamais vos coordonnées bancaires." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a dans Paramètres → Paiements",
        blocks: [
          { p: "La page se lit de haut en bas : la carte de connexion Stripe, **Frais de traitement**, **Virement instantané**, **Modes de paiement que vous acceptez**, **Votre compte Stripe** (propriétaire seulement), et — une fois la connexion active — **Proposer le paiement échelonné (Affirm)**. La carte de connexion est dans l'un de quatre états, et chacun dit quoi faire ensuite." },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — la carte de connexion affichant Stripe connecté · Actif, avec Gérer dans Stripe et Déconnecter, puis les cartes des frais et des versements." },
          { table: {
            head: ["La carte affiche", "Ce que ça veut dire", "Quoi appuyer"],
            rows: [
              ["**Pas encore connecté**", "Aucun compte Stripe n'existe encore pour cette entreprise.", "**Connecter avec Stripe** — vous partez vers la configuration hébergée de Stripe et revenez ici."],
              ["**Stripe a encore besoin de quelques éléments**", "Stripe n'a pas activé les paiements ; les éléments manquants sont listés sous le titre.", "**Terminer la configuration** pour retourner chez Stripe, ou **Je l'ai déjà fait** pour que FieldQuo redemande à Stripe."],
              ["**Stripe examine vos renseignements**", "Tout est soumis ; Stripe vérifie. Des minutes en général, parfois un jour ou deux.", "**Vérifier à nouveau**. Envoyer deux fois le même document n'accélère rien."],
              ["**Stripe connecté · Actif**", "L'encaissement est activé. Chaque facture que vos clients reçoivent porte maintenant un bouton Payer.", "**Gérer dans Stripe** ouvre votre tableau de bord Express dans un nouvel onglet ; **Déconnecter** délie le compte."],
            ],
          } },
          { p: "La page interroge Stripe directement à chaque chargement plutôt que de se fier à ce qu'elle a entendu la dernière fois, alors la pastille est la réponse de Stripe, pas une colonne périmée. Ça compte quand vous revenez de la page de Stripe : le compte a été mis à jour il y a quelques secondes et la page vérifie avant de s'afficher." },
        ],
      },
      {
        id: "connect",
        heading: "Comment connecter",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements** et appuyez sur **Connecter avec Stripe**.",
            "Sur la page de Stripe, entrez ce qui est demandé — les renseignements de l'entreprise, l'identité d'un dirigeant, un compte bancaire. [[what-stripe-asks-for-and-why|Ce que Stripe demande et pourquoi]] passe tout en revue.",
            "Vous revenez dans Paramètres → Paiements. Si la carte affiche **Stripe connecté · Actif**, c'est fait ; si elle liste des éléments que Stripe attend encore, appuyez sur **Terminer la configuration**.",
            "Envoyez une facture. Son courriel et le portail client portent maintenant **Payer** par carte, et — une fois que Stripe a activé le débit bancaire sur votre compte — **Payer … depuis un compte bancaire** à côté.",
          ] },
          { p: "Le débit bancaire n'est pas un réglage. FieldQuo demande la capacité pour votre pays quand vous connectez, Stripe l'active selon son propre calendrier, et la carte **Frais de traitement** vous dit où vous en êtes : **Les clients peuvent payer les factures par carte ou depuis un compte bancaire (débit préautorisé, Canada)** — ou ACH pour une entreprise américaine — ou que le paiement bancaire sera proposé dès que Stripe l'activera. Rien à faire de votre côté. Le débit bancaire est ensuite offert sur les factures, les dépôts et les versements d'un échéancier depuis le portail client, et sur les forfaits d'entretien à prélèvement automatique ; voir [[bank-debit-in-canada|Le débit bancaire au Canada]]." },
          { tip: "Sous Votre compte Stripe, deux interrupteurs sont affichés séparément : **Encaissement par carte** et **Versements à votre banque**. Les cartes peuvent continuer de fonctionner pendant que les versements sont en pause — l'argent est encaissé et retenu par Stripe, pas perdu. Quand ça arrive, la carte de connexion affiche **Stripe retient votre argent** ou **Stripe vérifie votre compte**, et [[payouts-held-or-under-review|Versements retenus ou en vérification]] dit ce que chacun exige." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { bullets: [
            "**Gérer dans Stripe** — ouvre un lien de connexion à votre tableau de bord Stripe Express dans un nouvel onglet. Les versements, les pièces d'identité, votre compte bancaire et le soutien de Stripe vivent tous là.",
            "**Déconnecter** — délie le compte de FieldQuo. Les clients ne peuvent plus payer en ligne tant que vous ne reconnectez pas. Ça ne ferme **pas** et ne supprime pas votre compte Stripe, et rien ne change à l'historique de vos versements — mais appuyer ensuite sur **Connecter avec Stripe** crée un compte Express **tout neuf**, avec la configuration de Stripe à refaire. Déconnecter sert à partir, pas à régler un problème.",
            "**Modes de paiement que vous acceptez** — cochez **Comptant**, **Virement électronique** et **Chèque**. Ce que vous cochez apparaît comme une ligne **Modes de paiement acceptés :** dans le courriel de facture, dans le portail client et sur le PDF de la facture ; décochez tout et la ligne disparaît. Ces paiements sont enregistrés à la main et ne portent aucuns frais.",
            "**Proposer le paiement échelonné (Affirm)** — laisse un client fractionner une facture de 50 $ à 30 000 $, en USD ou en CAD, avec Affirm à la caisse, en plus du paiement par carte. Vous êtes quand même payé au complet, d'avance. Vous devez d'abord activer Affirm dans votre tableau de bord Stripe ; les frais d'Affirm sur ces paiements sont refilés de la même façon que les frais de carte.",
            "**Virement instantané** — envoie votre solde disponible à une carte de débit en environ 30 minutes pour 1 % du montant ; voir [[instant-payouts|Virements instantanés]].",
            "**Rembourser** sur la ligne d'un paiement de la facture — la seule façon de rembourser un client. Votre tableau de bord Express ne peut pas rembourser un débit créé par FieldQuo ; le bouton dans FieldQuo le fait, en tout ou en partie, avec une raison, et les frais de traitement ne sont pas remis. Voir [[refunds|Remboursements]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Paramètres → Paiements est réservé au **propriétaire et aux administrateurs**. Un gestionnaire ou un répartiteur ne voit pas la ligne, et les routes derrière Connecter, Déconnecter et Gérer dans Stripe refusent tout le monde d'autre côté serveur, alors une personne qui tape l'adresse obtient un refus plutôt que la page. La carte **Votre compte Stripe** — l'identifiant acct_, le courriel de connexion, ce que Stripe attend — n'est montrée qu'au propriétaire." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Ce qui n'est pas intégré",
        blocks: [
          { bullets: [
            "Pas de lecteur de carte ni de terminal en personne. Un client qui vous paie dans l'entrée de garage paie depuis le courriel de facture sur son téléphone, ou comptant, par virement électronique ou par chèque, enregistré à la main.",
            "Pas de pourboire, et aucun produit de prêt ou de financement d'entreprise. Un client paie exactement la facture.",
            "Les litiges se répondent dans votre tableau de bord Stripe avec vos preuves, pas dans FieldQuo ; FieldQuo inscrit les frais de 15 $ et le montant retenu sur la facture. Voir [[disputes-and-chargebacks|Litiges et rétrofacturations]].",
            "Les frais de compte de Stripe — de petits frais mensuels les mois où vous encaissez, et 0,25 % + 25 ¢ par versement à votre banque — sont refilés au coût comme leur propre ligne sur votre prochain paiement, jamais cachés dans les frais de traitement.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Le compte Stripe est-il à moi ou à FieldQuo ?", a: "À vous. C'est un compte Express au nom de votre entreprise, avec son propre identifiant acct_ affiché dans Paramètres → Paiements. FieldQuo ne détient que l'identifiant qui pointe vers lui." },
      { q: "J'ai déjà un compte Stripe. Puis-je l'utiliser ?", a: "Non. Connecter avec Stripe crée un nouveau compte Express dans lequel FieldQuo verse ; un compte Stripe standard existant ne peut pas être lié. Les deux peuvent coexister." },
      { q: "Mon client a-t-il besoin d'un compte Stripe ?", a: "Non. Il appuie sur Payer, tape une carte ou ses coordonnées bancaires sur la page de Stripe, et c'est réglé. Il ne voit jamais le mot Stripe dans les courriels de FieldQuo." },
      { q: "Pourquoi Compte et facturation ouvre-t-il une autre page Stripe ?", a: "Parce que c'est Stripe Billing — la carte sur laquelle FieldQuo vous facture. Votre compte de versements est sous Paramètres → Paiements → Gérer dans Stripe." },
    ],
  },

  "facebook-and-instagram": {
    title: "Facebook et Instagram (Meta)",
    summary:
      "Une seule connexion Meta peut alimenter quatre choses — dépenses publicitaires, formulaires de prospects, messages de page et d'Instagram, et publication — et seule la première fonctionne pour toutes les entreprises aujourd'hui ; l'écran dit laquelle.",
    updated: "2026-09-12",
    intro: [
      "Tout ce qui touche Meta vit sur un seul écran, **Paramètres → Publicités Meta**, parce qu'un entrepreneur se dit « j'ai connecté mon Facebook » et ne devrait pas avoir à apprendre lequel de plusieurs endroits tient quelle moitié. L'écran a quatre panneaux, chacun une autorisation distincte de Meta : le compte publicitaire (dépenses et performance des campagnes), **Formulaires de prospects Facebook**, **Publication Facebook et Instagram**, et **WhatsApp Business** (son propre article, [[whatsapp|WhatsApp Business]]).",
      "L'état honnête aujourd'hui : la connexion du compte publicitaire fonctionne, et ne fait que lire les dépenses. Les trois autres sont construits de bout en bout et sont **en attente de l'approbation de Meta** pour l'autorisation qui les sous-tend ; chaque panneau le dit en une phrase et n'offre aucun bouton qui échouerait. Rien ne manque de votre côté.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le sous-titre de l'écran est la promesse : **Connectez votre propre compte publicitaire Meta (Facebook/Instagram) pour intégrer les dépenses et les performances des campagnes à vos chiffres marketing.** FieldQuo demande à Meta un accès en lecture à votre compte publicitaire et rien de plus — la carte non connectée le dit clairement : **FieldQuo ne fait que lire les dépenses et les performances — il ne crée ni ne modifie jamais une publicité.**" },
          { p: "Une fois connecté, **Synchroniser maintenant** lit les dépenses et les résultats quotidiens de vos campagnes dans **Marketing → Dépenses marketing**, d'où ils entrent dans le coût par prospect du tableau de bord des indicateurs. Une ligne synchronisée depuis Meta est marquée comme telle, n'écrase jamais un chiffre que vous avez tapé à la main, et est signalée comme doublon possible quand elle ressemble à une ligne que vous aviez déjà entrée." },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — la connexion du compte publicitaire en haut, puis les panneaux des formulaires de prospects, de la publication et de WhatsApp, chacun indiquant son propre état." },
        ],
      },
      {
        id: "connect-the-ad-account",
        heading: "Comment connecter le compte publicitaire",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Publicités Meta** et appuyez sur **Connecter Meta Ads**. Vous partez vers la connexion et l'écran de consentement de Facebook.",
            "Si votre connexion gère plus d'un compte publicitaire, la page demande **Quel compte publicitaire ?** — choisissez-en un et appuyez sur **Connecter ce compte**.",
            "La carte affiche maintenant le nom, l'identifiant et la devise du compte avec la pastille **Connecté**. Appuyez sur **Synchroniser maintenant**. La première synchronisation lit les 30 derniers jours ; une synchronisation couvre au plus 90 jours à la fois.",
            "Ouvrez **Voir vos campagnes →** pour trouver les lignes sous Dépenses marketing.",
          ] },
          { note: "La synchronisation est manuelle. Il n'y a pas de synchronisation Meta nocturne : appuyez sur **Synchroniser maintenant** quand vous voulez des chiffres frais. Si votre compte publicitaire est facturé dans une autre devise que votre entreprise, les lignes sont importées telles que déclarées et converties seulement à l'affichage des totaux, marquées ≈ approximatif." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["**Synchroniser maintenant**", "Lit chez Meta les dépenses et les résultats par campagne et par jour, et crée ou met à jour les lignes qu'elle avait créées auparavant. Indique combien ont été créées, mises à jour, en erreur ou qui ressemblent à des doublons."],
              ["**Reconnecter**", "Apparaît quand la carte affiche **Reconnexion nécessaire** — Meta dit que le jeton conservé ne fonctionne plus. Même connexion qu'au départ ; rien de déjà importé n'est perdu."],
              ["**Déconnecter**", "Arrête la synchronisation. Les lignes déjà importées restent dans votre historique de dépenses marketing."],
              ["Formulaire de prospects **Activé / Désactivé**", "Lesquels de vos formulaires de prospects Facebook deviennent des prospects dans FieldQuo. Désactivé aujourd'hui, avec la raison sur l'interrupteur : l'autorisation n'est pas encore approuvée."],
              ["**Trouver mes formulaires de prospects**", "Demande à Meta les formulaires de vos pages. Désactivé pour la même raison."],
              ["**Connecter Facebook et Instagram** (publication)", "Pas offert aujourd'hui ; le panneau affiche **En attente de l'approbation de Meta**. Quand elle arrivera, la même connexion de page portera à la fois la publication et la messagerie de page."],
            ],
          } },
          { p: "Quand un formulaire de prospects est activé, un prospect qui en vient atterrit sur le tableau des prospects comme toute autre demande — noté de la même façon, prévenant les mêmes personnes, avec vos règles de relance qui s'appliquent — et porte la campagne d'où il vient, ce qui est le seul cas où un dollar de dépense publicitaire est relié à un prospect précis. Tous les autres canaux restent mélangés : un propriétaire qui a vu la publicité et a téléphoné n'est pas attribué. Voir [[facebook-lead-forms|Formulaires de prospects Facebook]] et [[marketing-spend|Dépenses marketing]]." },
        ],
      },
      {
        id: "messages",
        heading: "Messages de page et d'Instagram",
        blocks: [
          { p: "L'écran **Messages** est construit pour répondre aux conversations de votre page Facebook et de votre compte professionnel Instagram — regroupées **À répondre** et **En attente de leur réponse**, avec une note privée, un statut et un bilan mensuel des conversations devenues des chantiers. Aujourd'hui il affiche **FieldQuo attend l'autorisation de Meta pour la messagerie des pages. La boîte de réception est prête — vous n'avez rien à faire d'ici là.** La connexion s'allumera sous Paramètres → Publicités Meta quand Meta l'approuvera. Voir [[connect-your-facebook-page-and-instagram|Connecter votre page Facebook et Instagram]]." },
          { warning: "N'achetez pas FieldQuo pour la boîte de réception Facebook ce mois-ci. La synchronisation des dépenses publicitaires est la partie qui fonctionne pour toutes les entreprises aujourd'hui ; la boîte de réception, les formulaires de prospects et la publication dépendent d'un examen qui est chez Meta, pas chez vous ni chez FieldQuo." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Ce que Meta voit, et ce que FieldQuo conserve",
        blocks: [
          { bullets: [
            "FieldQuo conserve le jeton d'accès que Meta émet pour votre compte publicitaire, chiffré ; c'est ce jeton que Synchroniser maintenant utilise. Déconnecter supprime la connexion.",
            "Aucune donnée client n'est envoyée à Meta par la connexion du compte publicitaire — c'est une lecture dans un seul sens.",
            "Un entonnoir est la seule page côté client où un pixel Meta peut se déclencher. Si vous collez un identifiant de pixel dans le panneau **Pixels de suivi publicitaire** d'un entonnoir, le pixel enregistre une vue de page et un événement **Lead** quand un visiteur envoie le formulaire de contact, sans aucune donnée personnelle. FieldQuo n'ajoute aucune bannière de consentement aux témoins, nulle part ; si vos visiteurs se trouvent là où elle est obligatoire, elle est à votre charge. Voir [[funnels|Entonnoirs]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Paramètres → Publicités Meta est réservé au **propriétaire et aux administrateurs**, la même tablette que Paiements : connecter le compte publicitaire d'une entreprise est un geste au niveau de l'entreprise, et chaque route en dessous refuse tout le monde d'autre. Les dépenses importées sont ensuite visibles partout où les Dépenses marketing le sont." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo peut-il créer ou mettre en pause mes publicités ?", a: "Non, et il ne demande pas à Meta l'autorisation de le faire. Il lit les dépenses et la performance, rien d'autre." },
      { q: "Pourquoi mes formulaires de prospects sont-ils listés mais grisés ?", a: "Recevoir un prospect exige une autorisation de plus que Meta n'a pas encore approuvée pour FieldQuo. Les interrupteurs sont désactivés avec cette raison dessus plutôt que cachés, pour que vous voyiez qu'aucun prospect n'arrive et que ce n'est pas de votre faute." },
      { q: "J'ai déconnecté — mon historique de dépenses est-il perdu ?", a: "Non. Les lignes déjà importées restent dans les Dépenses marketing ; seule la synchronisation future s'arrête." },
    ],
  },

  "whatsapp": {
    title: "WhatsApp Business",
    summary:
      "Votre propre numéro WhatsApp Business répondu dans la boîte Messages, la règle des 24 heures que WhatsApp impose aux réponses, et pourquoi le bouton Connecter n'est pas encore offert.",
    updated: "2026-09-12",
    intro: [
      "Le panneau **WhatsApp Business** de **Paramètres → Publicités Meta** connecte le numéro WhatsApp Business auquel vos clients écrivent, pour que leurs messages arrivent dans **Messages** à côté de vos conversations Facebook et Instagram et y soient répondus. C'est un numéro d'entreprise, pas le WhatsApp personnel de quelqu'un.",
      "Aujourd'hui le panneau affiche **En attente de l'approbation de Meta** : répondre aux messages WhatsApp exige une autorisation que Meta doit accorder à FieldQuo avant qu'un numéro puisse être connecté. Cet examen dépend de Meta. Rien ne manque de votre côté, et cet article dit ce que la fonction fait le jour où elle s'allume — y compris la seule règle qui surprend tout le monde.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Quand la connexion est offerte, **Connecter WhatsApp** vous envoie dans l'inscription de Meta, où vous choisissez ou créez un compte WhatsApp Business et un numéro de téléphone ; FieldQuo s'abonne aux messages de ce numéro, et une conversation apparaît dans Messages dès qu'un client écrit. Les réponses partent de votre numéro. Le panneau affiche ensuite le numéro avec son nom vérifié, les modèles lus chez Meta, et un bouton **Déconnecter**." },
          { p: "Une deuxième porte, repliée, existe pour une entreprise qui utilise déjà l'API Cloud de Meta : collez l'identifiant du compte WhatsApp Business, l'identifiant du numéro et un jeton permanent, et FieldQuo prouve le jeton auprès de Meta avant de conserver quoi que ce soit. Le jeton est conservé chiffré et n'est jamais réaffiché. Pour presque toutes les entreprises, le bouton d'inscription est la bonne porte." },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — le panneau WhatsApp Business se trouve au bas et indique si un numéro peut déjà être connecté." },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "La règle des 24 heures",
        blocks: [
          { p: "Le panneau la porte dans une carte à part, parce que c'est la chose qu'un peintre qui utilise WhatsApp personnellement depuis dix ans n'a jamais rencontrée : **WhatsApp ne transmet un message écrit que pendant 24 heures après le dernier message du client. Passé ce délai, vous pouvez encore le joindre, mais seulement avec un modèle approuvé à l'avance par Meta.** FieldQuo indique lequel des deux s'applique sur chaque conversation, et refuse par son nom un message libre hors de la fenêtre plutôt que de laisser WhatsApp le rejeter en silence." },
          { steps: [
            "Créez vos modèles dans le gestionnaire WhatsApp de Meta — un « votre soumission est prête » ou un « confirmation de la visite de demain », par exemple — et attendez que Meta les approuve.",
            "Sur le panneau, appuyez sur **Actualiser les modèles**. Il affiche **{count} modèles lus chez Meta**, ou **Aucun modèle pour l'instant. Créez-les dans le gestionnaire WhatsApp de Meta, puis actualisez.**",
            "Dans une conversation de plus de 24 heures, le composeur propose ces modèles au lieu d'une zone de texte.",
          ] },
          { note: "L'employé IA suit la même règle : hors de la fenêtre, il ne rédige aucune réponse, parce qu'il n'y a aucun texte libre qu'il pourrait envoyer." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { bullets: [
            "**Connecter WhatsApp** — lance l'inscription de Meta. Si vous annulez en cours de route, rien n'est connecté ; si le compte n'a pas encore de numéro de téléphone, le panneau le dit et vous demande d'en ajouter un chez Meta.",
            "**Actualiser les modèles** — relit vos modèles approuvés chez Meta. Les nouveaux modèles n'apparaissent pas tant que vous n'appuyez pas.",
            "**Déconnecter** — retire le numéro de FieldQuo et supprime le jeton conservé. Les conversations déjà dans Messages restent.",
            "La pastille du panneau — **Connecté via l'inscription Meta** ou **Connecté via identifiants API** — note quelle porte a servi.",
          ] },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Ce qui sort de la maison",
        blocks: [
          { p: "Les messages de votre client viennent de Meta vers FieldQuo et sont conservés comme conversations ; vos réponses vont de FieldQuo vers Meta puis au client. Meta détient le numéro et les modèles, alors le texte d'un modèle est ce que Meta a approuvé, pas ce que FieldQuo aimerait envoyer. Les médias envoyés par un client sont récupérés chez Meta et gardés avec la conversation." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Connecter ou déconnecter un numéro est réservé au **propriétaire et aux administrateurs** — la même règle que le reste de Paramètres → Publicités Meta, appliquée par les routes autant que par le menu. Répondre aux conversations suit l'accès propre à la boîte Messages ; voir [[the-messages-inbox|La boîte Messages]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je utiliser mon WhatsApp personnel ?", a: "Non. La connexion se fait à un compte WhatsApp Business et à son numéro, par Meta. Un numéro personnel n'a pas ce compte." },
      { q: "Pourquoi ne puis-je pas répondre à un message de la semaine dernière ?", a: "La règle de WhatsApp, pas celle de FieldQuo : plus de 24 heures après le dernier message du client, seul un modèle approuvé à l'avance par Meta peut être envoyé. Créez des modèles dans le gestionnaire WhatsApp et appuyez sur Actualiser les modèles." },
      { q: "Quand le bouton Connecter apparaîtra-t-il ?", a: "Quand Meta approuvera l'autorisation pour FieldQuo. Le panneau changera de lui-même ; il n'y a rien à demander de votre côté." },
    ],
  },

  "phone-and-texts": {
    title: "Numéros de téléphone et textos (Twilio)",
    summary:
      "Les trois choses téléphoniques que fait FieldQuo — les textos aux clients, le numéro de la réceptionniste IA et la ligne texto de l'équipe — quel numéro chacune utilise, ce que chacune coûte, et ce qui n'est délibérément pas un texto.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo touche au réseau téléphonique à trois endroits distincts, avec trois numéros différents. Les **textos aux clients** — le texto En route et les rappels de rendez-vous — partent du numéro texto partagé de FieldQuo, avec le nom de votre entreprise en tête. La **réceptionniste téléphonique** répond sur un numéro que vous louez dans **Paramètres → Réceptionniste téléphonique**. Les **textos de l'équipe** passent par un troisième numéro, configuré sur la page **Boîte équipe**, auquel votre équipe texte ses photos.",
      "Twilio transporte les textos et fournit les numéros ; Retell fait la voix de la réceptionniste. Cet article dit ce que chacune des trois fait, ce qui sort de la maison, ce qui est prélevé sur votre crédit téléphonique, et ce que FieldQuo ne texte délibérément pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Quoi", "Depuis quel numéro", "Ce que ça vous coûte"],
            rows: [
              ["Texto En route, rappel de rendez-vous", "Le numéro texto partagé de FieldQuo, avec le nom de votre entreprise en tête", "Rien — les textos aux clients ne sont pas facturés"],
              ["Réceptionniste téléphonique", "Un numéro local ou sans frais que vous louez, ou votre propre numéro renvoyé vers lui", "4 $/mois local, 9 $/mois sans frais, plus 35 ¢ la minute (40 ¢ sans frais), pris sur le crédit téléphonique"],
              ["Ligne texto de l'équipe", "Un numéro à elle, acheté pour l'entreprise, ou la ligne d'essai partagée de FieldQuo prêtée 7 jours", "4 $/mois pour votre propre ligne, 2 ¢ le texto et 5 ¢ la photo, sur le même crédit"],
            ],
          } },
          { p: "Le crédit téléphonique est un seul solde prépayé, affiché dans **Paramètres → Crédit IA** comme **Crédit téléphonique** et sur la page de la réceptionniste comme **Crédit**. Rechargez de 10 $, 30 $, 50 $ ou 100 $ — ou n'importe quel montant de 5 $ à 1 000 $ — par carte, ou activez la **recharge automatique** pour prélever la carte enregistrée quand le solde passe sous 5 $, 10 $ ou 20 $. Voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
        ],
      },
      {
        id: "texts-to-clients",
        heading: "Les textos aux clients",
        blocks: [
          { p: "Exactement deux textos vont aux clients, et les deux sont à votre formulation dans **Paramètres → Messages aux clients** : **En route**, envoyé quand une visite est marquée en route, et **Rappel de rendez-vous**, envoyé 2, 24 ou 48 heures avant une visite une fois que vous avez choisi un délai dans Paramètres → Notifications. Chacun part dans la langue du client. Le rappel se termine par **Répondez STOP pour ne plus recevoir** ; un client qui répond STOP n'est plus jamais texté par votre entreprise, et START lève le blocage." },
          { warning: "Ces textos viennent du numéro partagé de FieldQuo, pas d'un numéro à vous — le numéro de la réceptionniste ne peut pas texter, et il n'existe aujourd'hui aucun réglage pour donner aux textos clients un numéro d'entreprise. Le message commence par le nom de votre entreprise, mais le numéro que le client voit est partagé. C'est la seule surface côté client où la tuyauterie de FieldQuo paraît ; voir [[client-texts-on-my-way-and-reminders|Textos aux clients : En route et rappels]]." },
          { p: "Il n'y a pas de boîte de réception pour les textos des clients. Un propriétaire qui répond à un rappel avec une question n'est pas lu — le texto le renvoie à votre numéro de téléphone. FieldQuo ne texte ni les factures, ni les soumissions, ni les demandes d'avis, ni les confirmations de rendez-vous ; ce sont des courriels. Voir [[texting-clients-what-is-and-is-not-automated|Texter les clients : ce qui est automatisé et ce qui ne l'est pas]]." },
        ],
      },
      {
        id: "the-receptionists-number",
        heading: "Le numéro de la réceptionniste",
        blocks: [
          { figure: "live:app-settings-voice", caption: "Paramètres → Réceptionniste téléphonique — le numéro avec Elle répond — désactiver, la carte Crédit avec les recharges, puis Votre numéro et les cartes d'accueil, de connaissances et de voix." },
          { steps: [
            "Ouvrez **Paramètres → Réceptionniste téléphonique** et trouvez **Votre numéro**. Choisissez un numéro local par indicatif régional parmi ceux que Twilio a de libres, ou un numéro sans frais, ou gardez votre propre numéro et renvoyez-le — la façon recommandée, parce que le numéro sur votre camion reste le même.",
            "La location du premier mois sort de votre crédit dès que vous en choisissez un. Votre premier numéro ajoute aussi **10,50 $** de crédit — 30 minutes gratuites — pour commencer.",
            "Appuyez sur **Commencer à répondre aux appels**. Dès lors, la réceptionniste répond dans la langue de l'appelant (anglais, français ou espagnol), note les détails, fixe une visite selon vos vraies disponibilités, et ne donne jamais de prix. Chaque appel atterrit sur l'écran **Réceptionniste** avec son enregistrement, sa transcription et son résumé.",
            "Pour arrêter, appuyez sur **Elle répond — désactiver** : le numéro cesse de répondre mais reste à vous et continue d'être loué. Pour abandonner le numéro, utilisez **Rendre le numéro** et tapez le numéro pour confirmer — c'est irréversible et le reste du mois n'est pas remboursé.",
          ] },
          { note: "La location est prélevée tous les 30 jours sur le crédit. Si le crédit s'épuise, le numéro continue de fonctionner 7 jours pendant que FieldQuo vous écrit par courriel, puis il est rendu et perdu. La recharge automatique est la protection. Faire transférer un numéro chez FieldQuo est une demande traitée à la main, pas un bouton ; rien n'est prélevé tant que le transfert n'est pas en service." },
        ],
      },
      {
        id: "crew-texting",
        heading: "La ligne texto de l'équipe",
        blocks: [
          { p: "Votre équipe texte ses photos à un seul numéro et elles sont classées sur le bon chantier — par le chantier nommé dans le texto, par le GPS quand le téléphone l'envoie, ou par le seul chantier où cette personne est ce jour-là ; quand rien de tout ça ne tranche, le bureau choisit le chantier sous **Votre attention — choisissez le chantier**. La personne est reconnue par le cellulaire inscrit sur sa fiche de travailleur. La configuration se fait sur la page **Boîte équipe**, pas sous la réceptionniste : **Acheter un numéro à votre équipe** à 4 $ par mois, ou **Utiliser la ligne d'essai FieldQuo** pendant 7 jours d'abord." },
          { p: "Chaque texto entrant ou sortant coûte **2 ¢** par 160 caractères et une photo **5 ¢**, sur le même crédit téléphonique. Une photo entrante est toujours reçue et facturée ; si le crédit est à découvert de 2 $, la ligne est débranchée et la page affiche **Les textos de l'équipe sont en pause car votre crédit est épuisé. Rechargez et la ligne se reconnecte.** Voir [[the-crew-inbox|La boîte équipe]]." },
          { note: "La ligne d'essai partagée est le même numéro d'où partent les textos aux clients. Pendant qu'elle est prêtée à votre équipe, un STOP qu'un client lui envoie tombe dans la boîte équipe et n'est pas lu comme un désabonnement — une raison de plus d'acheter à l'équipe son propre numéro." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Ce qui sort de la maison",
        blocks: [
          { bullets: [
            "Twilio reçoit le numéro de téléphone d'un client et le texte d'un rappel ou d'un message En route, et les photos textées par l'équipe avant que FieldQuo les réhéberge.",
            "Retell reçoit l'audio en direct, l'enregistrement et la transcription de chaque appel que prend la réceptionniste. L'enregistrement se réécoute depuis l'écran Réceptionniste.",
            "Un numéro que vous louez pour la réceptionniste est acheté sur le compte Twilio de Retell ; une ligne d'équipe est achetée sur celui de FieldQuo. Ni l'un ni l'autre n'est un numéro que vous pouvez emporter en partant, et c'est pourquoi renvoyer votre propre numéro est le choix recommandé.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "**Paramètres → Réceptionniste téléphonique** et ses commandes de numéro, de crédit et de recharge sont réservés au propriétaire, aux administrateurs et aux niveaux Gestionnaire et Répartiteur. Le journal d'appels **Réceptionniste** exige la vue complète des clients dans la grille d'accès. La ligne **Boîte équipe** s'affiche pour tout le monde, mais un accès Équipe ou Estimateur ne voit que les photos qu'il a lui-même envoyées, et configurer, acheter ou désactiver la ligne d'équipe est réservé au propriétaire, aux administrateurs et à un gestionnaire avec le coût de revient — ça dépense le crédit de l'entreprise." },
        ],
      },
    ],
    faq: [
      { q: "Mes clients peuvent-ils me répondre par texto ?", a: "Pas dans FieldQuo. Les réponses au numéro partagé ne sont lues que pour STOP et START ; tout le reste est accusé de réception puis ignoré, et le texto En route donne au client votre numéro de téléphone à appeler." },
      { q: "Les rappels coûtent-ils du crédit ?", a: "Non. Les textos En route et les rappels de rendez-vous sont gratuits ; le crédit paie les minutes et la location de la réceptionniste et les textos de l'équipe." },
      { q: "Puis-je avoir un numéro à mon nom pour texter les clients ?", a: "Pas aujourd'hui. Les textos aux clients partent du numéro partagé de FieldQuo avec le nom de votre entreprise en tête ; le numéro de la réceptionniste répond aux appels mais ne peut pas texter." },
    ],
  },

  "google-maps-and-solar": {
    title: "Google Maps et Google Solar",
    summary:
      "Où une adresse se complète toute seule, comment un toit se mesure depuis le ciel, sur quoi repose le temps de déplacement, et la chose à savoir — les adresses des propriétaires sont envoyées à Google pour le faire.",
    updated: "2026-09-12",
    intro: [
      "Google est derrière trois choses ordinaires dans FieldQuo : l'adresse qui se complète pendant que vous tapez, la surface et la pente du toit qui apparaissent quand vous appuyez sur **Mesurer par satellite**, et le temps de route qui façonne les plages de rendez-vous. Chacune envoie à Google l'adresse d'un propriétaire, ou les coordonnées derrière. C'est tout le coût — aucun crédit n'est compté et rien à acheter en plus — et ça vaut la peine de le dire clairement.",
      "Cet article dit où chacune des trois est utilisée, ce que la mesure du toit retourne et quand elle ne le peut pas, et ce pour quoi FieldQuo n'utilise pas Google.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { bullets: [
            "**Complétion d'adresse** — sur un client nouveau ou modifié, dans le sélecteur de client du constructeur de soumission, dans le Profil de l'entreprise, à l'ajout d'un employé, sur la page de rendez-vous publique, le formulaire d'autosoumission et la page d'estimation instantanée. Une adresse tapée sans choisir de suggestion est acceptée telle quelle.",
            "**Géocodage** — quand l'adresse du chantier est inscrite, FieldQuo demande une fois ses coordonnées à Google et les garde. Ce sont ces coordonnées que l'horloge de pointage compare à un poinçon (à moins de 250 m, la personne est sur place) et que la petite carte du Profil de l'entreprise et le bloc contact du site web affichent.",
            "**Google Solar** — le modèle de toit derrière **Mesurer par satellite** sur une soumission de toiture, et derrière l'estimation instantanée de toiture sur votre site web.",
            "**Temps de route** — la matrice de distances de Google entre deux adresses, utilisée pour espacer les plages de rendez-vous et les visites selon le vrai déplacement. Quand Google n'a pas de réponse, FieldQuo estime à partir de la distance à vol d'oiseau et l'étiquette comme estimation.",
          ] },
        ],
      },
      {
        id: "measure-a-roof",
        heading: "Comment mesurer un toit à partir d'une adresse",
        blocks: [
          { steps: [
            "Dans le constructeur de soumission, sur un type de soumission **toiture**, ouvrez le relevé et appuyez sur **Mesurer par satellite** — ou **Utiliser l'adresse du client** pour mesurer l'adresse déjà sur la soumission.",
            "FieldQuo géocode l'adresse, demande à Google Solar le modèle de toit du bâtiment le plus proche, et remplit la surface du toit en pieds carrés et en carrés, la pente dominante en hauteur sur 12 avec son degré de raideur, le nombre de pans, et les longueurs de corniche, de rive, de faîte, d'arête et de noue. Une image satellite montre ce qui a été mesuré.",
            "Vérifiez l'image contre la maison. Quand l'épingle est tombée sur le voisin, ou que l'imagerie est vieille, le panneau le dit ; les chiffres restent modifiables et vous pouvez taper la surface et la pente à la main.",
          ] },
          { note: "Deux refus sont normaux et les deux disent quoi faire : l'adresse est introuvable, ou Google n'a aucun modèle de toit pour ce bâtiment — dans les deux cas, entrez la surface et la pente à la main. La couverture est celle de Google, pas celle de FieldQuo — les maisons rurales et neuves sont les trous habituels. Sur l'estimation instantanée publique, un propriétaire voit une phrase plus douce et est invité à demander une soumission à la place." },
          { p: "La surface du toit est la surface inclinée de Google, alors aucun multiplicateur de pente n'est appliqué par-dessus — en appliquer un compterait la pente deux fois. Tous les détails dans [[aerial-roof-measurement|Mesure aérienne du toit]]." },
        ],
      },
      {
        id: "tracing-by-hand",
        heading: "Tracer à la main",
        blocks: [
          { p: "Deux surfaces se tracent plutôt que de se modéliser. Sur une soumission de **pavage**, le concepteur affiche une photo satellite de l'adresse et vous tracez l'entrée ou le patio et fixez l'échelle à partir d'une ligne dont vous connaissez la longueur. Sur l'estimation instantanée d'**entretien de pelouse**, un propriétaire dessine sa pelouse sur une carte Google et le serveur recalcule la surface. Il n'y a pas de tracé manuel de toit : quand Solar n'a pas de modèle, le toit se tape à la main." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Ce qui sort de la maison",
        blocks: [
          { p: "L'adresse telle qu'elle est tapée, pour la complétion et le géocodage ; les coordonnées d'un chantier, pour le modèle de toit, l'image de carte et la question du temps de route. C'est ce que la page de confidentialité de FieldQuo liste pour Google Maps et Google Solar, et rien de plus — aucun nom de client, aucun numéro de téléphone, aucune soumission. Le navigateur d'un visiteur parle aussi directement à Google sur la page de rendez-vous et la page d'estimation instantanée, parce que la complétion tourne dans le navigateur." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Ce qui n'est pas intégré",
        blocks: [
          { bullets: [
            "Pas d'itinéraire virage par virage ni d'optimisation de tournée. FieldQuo place les visites et vérifie le déplacement entre elles ; il ne planifie pas la route d'une journée.",
            "Pas de carte en direct de l'équipe. L'horloge de pointage prend une seule position quand une personne pointe l'entrée ou la sortie, et rien entre les deux.",
            "Pas de suggestions d'adresse sur le formulaire de création de chantier ni sur le formulaire de prospect du site web — ceux-là prennent une adresse tapée.",
            "Aucun coût pour vous et aucun comptage. La mesure de toit est incluse dans tous les forfaits.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Toute personne connectée peut mesurer un toit ou une entrée — les routes n'exigent qu'une session, et c'est dans le constructeur de soumission que ça vit, donc en pratique quiconque rédige des soumissions : le propriétaire, les administrateurs, les gestionnaires, les répartiteurs et les estimateurs. Les propriétaires de maison l'utilisent sans compte sur les estimations instantanées de toiture et de pelouse que vous publiez." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la mesure est-elle tombée sur la mauvaise maison ?", a: "L'épingle est là où Google a géocodé l'adresse, et Solar retourne le bâtiment le plus proche. Le panneau dit à quelle distance l'épingle était du bâtiment mesuré ; vérifiez l'image, et tapez la surface à la main quand c'est le voisin." },
      { q: "La mesure coûte-t-elle du crédit ?", a: "Non. Rien de Google Maps ni de Solar n'est compté sur votre crédit." },
      { q: "La position de l'équipe va-t-elle chez Google ?", a: "Non. Un poinçon est comparé aux coordonnées enregistrées du chantier du côté de FieldQuo ; seule l'adresse du chantier a été géocodée, une fois, à sa création." },
    ],
  },

  "photos-and-files": {
    title: "Photos et fichiers (Cloudinary)",
    summary:
      "Où chaque photo et document téléversé est conservé, les limites de taille et de type, quelles photos peuvent atteindre votre site web et vos soumissions, et la réponse honnête sur la suppression.",
    updated: "2026-09-12",
    intro: [
      "Chaque photo, vidéo et PDF qui entre dans FieldQuo — une photo de chantier, votre logo, les photos d'un propriétaire sur une demande de soumission, un permis sur un chantier, un reçu — est conservé chez Cloudinary, dans un dossier qui appartient à votre entreprise. Les téléversements sont signés par le serveur de FieldQuo pour chaque fichier, alors il n'existe aucun jeton public de téléversement que quelqu'un pourrait réutiliser, et un client qui téléverse sur votre formulaire d'autosoumission passe par la même porte vers un dossier **leads** à vous.",
      "Cet article donne les limites, les endroits où les photos s'affichent, les étapes fixes qui décident de ce qui peut devenir public, et ce que FieldQuo ne fait pas avec les fichiers.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Type", "Accepté", "Limite"],
            rows: [
              ["Photo", "JPEG, PNG, WebP, GIF, HEIC et HEIF — une photo d'iPhone monte telle quelle", "15 Mo"],
              ["Vidéo", "MP4, MOV, WebM, Ogg et 3GP", "100 Mo"],
              ["Document", "PDF seulement", "25 Mo"],
              ["Logo", "Les types de photo plus SVG", "15 Mo"],
            ],
          } },
          { p: "Un fichier refusé reçoit une phrase, pas une roue qui tourne : le message dit de téléverser une photo (JPEG, PNG, HEIC…), une vidéo (MP4, MOV, WebM) ou un PDF, ou qu'une photo dépasse 15 Mo et d'en essayer une plus petite. Un PDF est conservé octet pour octet sous un nom aléatoire ; le nom du fichier que vous avez téléversé ne fait jamais partie de l'adresse." },
        ],
      },
      {
        id: "where-photos-live",
        heading: "Où vivent les photos et les fichiers",
        blocks: [
          { bullets: [
            "**Photos du chantier** — sur la page du chantier sous **Photos du chantier**, téléversées là ou textées par l'équipe, classées sous l'une de quatre étapes fixes : **Before / start**, **In progress**, **Finished**, **Issue / snag**. Vos propres étiquettes de **Paramètres → Étiquettes des photos de chantier** viennent par-dessus. Voir [[job-photos-and-tags|Photos et étiquettes de chantier]].",
            "**Photos du client** — ce qu'un propriétaire a joint à une demande d'autosoumission ou d'estimation instantanée, ou ce que vous avez ajouté dans le constructeur de soumission avec **Ajouter des photos ou une vidéo**. Montrées à votre personnel sur la soumission, le prospect et la facture ; ni imprimées sur le PDF de la soumission ni montrées sur la page d'approbation du client.",
            "**Paires Avant et après** dans **Paramètres → Courriel de soumission** — jusqu'à 4 paires qui entrent dans chaque courriel de soumission.",
            "**Votre site web** — les images d'en-tête, d'à-propos, d'appel à l'action et de services, la galerie, et les photos de chantier que vous étoilez pour les montrer sur le site.",
            "**Documents** — plans, permis et contrats sur un chantier, assurance et attestations sur un sous-traitant, immatriculation et assurance sur un véhicule, et reçus numérisés dans une dépense (photos seulement — un reçu en PDF est refusé).",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Paramètres → Étiquettes des photos de chantier — vos propres mots par-dessus les quatre étapes fixes, avec les étiquettes de départ et un bouton Retirer." },
        ],
      },
      {
        id: "what-goes-public",
        heading: "Ce qui peut devenir public",
        blocks: [
          { p: "Les étapes sont fixes parce qu'elles sont la règle. Seule une photo de chantier que vous avez étoilée comme vedette atteint votre site web, et une photo **Issue / snag** ne peut jamais être mise en vedette — le serveur refuse en disant qu'une photo de problème ne peut pas aller sur votre site et de changer d'abord son étape. L'onglet des photos de chantier du Créateur marketing et le parcours « faire une publication à partir d'un chantier » ne voient jamais une photo de problème non plus. Tout le reste reste dans le bureau." },
          { steps: [
            "Ouvrez le chantier et ses **Photos du chantier**.",
            "Réglez l'étape sur chaque photo — le texto de l'équipe est lu pour des mots comme « avant » et « fini » afin de la deviner, et vous pouvez corriger.",
            "Étoilez celles à montrer sur votre site web. Elles apparaissent dans la galerie de réalisations du site ; retirez l'étoile pour les enlever.",
          ] },
        ],
      },
      {
        id: "deleting",
        heading: "Supprimer",
        blocks: [
          { warning: "Il n'y a pas de bouton de suppression sur une photo de chantier, un document de chantier ou les photos d'un client, et FieldQuo ne retire pas les fichiers du stockage quand un chantier est supprimé ou qu'une photo du site est retirée de la bibliothèque. Remplacer votre logo retire l'ancien ; c'est l'exception. Si une photo ne doit pas exister — un propriétaire le demande, ou elle a été prise par erreur — changez son étape pour Issue / snag afin qu'elle ne puisse jamais devenir publique, puis envoyez une demande de suppression ; voir [[data-and-privacy|Vos données, celles de vos clients, et la suppression]]. Les données de position dans une image (EXIF) ne sont ni lues ni retirées." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute personne connectée peut téléverser. Classer une photo sur un chantier n'exige que l'accès en lecture à ce chantier, alors un accès Équipe peut ajouter des photos aux chantiers où il est. Régler l'étape, étoiler pour le site web, les légendes et les étiquettes exigent l'accès en modification aux chantiers. Les étiquettes des photos de chantier sont gérées par le propriétaire, les administrateurs et les niveaux Gestionnaire et Répartiteur. Les photos du site web sont au propriétaire et aux administrateurs ; le logo, à quiconque peut gérer les gens." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je joindre un fichier à un client ?", a: "Non. Les fichiers se joignent à un chantier, une soumission, un sous-traitant, un véhicule ou une dépense — pas à la fiche client elle-même." },
      { q: "Les photos HEIC d'un iPhone fonctionnent-elles ?", a: "Oui. HEIC et HEIF sont acceptés et convertis pour l'affichage ; les vidéos MOV aussi." },
      { q: "Y a-t-il une limite de stockage ?", a: "FieldQuo n'affiche aucun quota et n'impose aucun plafond par entreprise ; les limites sont par fichier. Si le stockage refuse un jour un fichier, le message le dit plutôt que d'échouer en silence." },
    ],
  },

  "email-delivery": {
    title: "Livraison des courriels (Resend) et votre propre domaine",
    summary:
      "De qui vos soumissions et vos factures semblent venir, comment les envoyer depuis votre propre domaine plutôt que l'adresse partagée de FieldQuo, où atterrissent les réponses, et ce que FieldQuo ne peut pas vous dire d'un rebond.",
    updated: "2026-09-12",
    intro: [
      "Chaque soumission, facture, reçu, rappel et demande d'avis part sous **le nom de votre entreprise** comme expéditeur. Tant que vous n'avez pas connecté de domaine, l'adresse derrière ce nom est l'adresse d'envoi partagée de FieldQuo ; après en avoir vérifié un dans **Paramètres → Domaine d'envoi**, l'adresse est à vous — **quotes@send.votreentreprise.com**, par exemple — et aucun « via fieldquo.com » n'apparaît à côté de votre nom dans la boîte du client.",
      "La livraison elle-même est faite par Resend, un service de courriel que le client ne voit jamais. Cet article couvre l'expéditeur, le domaine, les réponses, et les limites honnêtes : FieldQuo n'apprend rien d'un message une fois que Resend l'a accepté.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La ligne De se construit de la même façon pour chaque courriel client : le nom de votre entreprise, puis une adresse. Sans domaine à vous, l'adresse est sur le domaine d'envoi partagé de FieldQuo et le nom reste le vôtre. Avec un domaine vérifié, l'adresse est l'**Adresse d'expéditeur** que vous avez choisie, sur votre domaine. Les réponses vont toujours au courriel d'entreprise du Profil de l'entreprise — ou, s'il est vide, au courriel de connexion du propriétaire du compte — jamais à l'adresse partagée." },
          { p: "Les courriels aux clients partent aussi dans la langue du client, et le courriel d'accompagnement d'une soumission dans la langue de la soumission ; voir [[a-clients-language|La langue d'un client]]." },
          { figure: "live:app-settings-email-domain", caption: "Paramètres → Domaine d'envoi — le domaine avec son statut, les enregistrements DNS à ajouter, l'éditeur d'Adresse d'expéditeur et où vont les réponses." },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "Comment envoyer depuis votre propre domaine",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Domaine d'envoi**. Sous **Connecter un domaine**, tapez un sous-domaine comme **send.votreentreprise.com** — un sous-domaine plutôt que votre domaine racine, pour qu'il ne puisse pas nuire à votre boîte existante — et appuyez sur **Connecter**.",
            "La page affiche **Ajoutez ces enregistrements DNS** : le type, le nom et la valeur de chacun, avec **Copier la valeur** à côté. Ajoutez-les chez l'hébergeur du DNS de votre domaine, en gardant le nom exactement tel qu'affiché.",
            "Enregistrez chez votre hébergeur et laissez faire. La plupart appliquent les changements en moins d'une heure, certains prennent jusqu'à 24. La page revérifie d'elle-même toutes les 30 secondes tant que le statut affiche **En attente du DNS** ; **Vérifier** demande tout de suite.",
            "Quand le statut affiche **Vérifié**, la carte dit **Les courriels seront envoyés depuis quotes@send.votreentreprise.com**. Changez la partie avant le @ sous **Adresse d'expéditeur** et appuyez sur **Enregistrer** — lettres, chiffres, points, tirets ou traits de soulignement. Ce n'a pas besoin d'être une vraie boîte.",
          ] },
          { note: "Les enregistrements prouvent que le domaine est à vous, et c'est ce qui permet à FieldQuo d'envoyer en votre nom. Rien ne part de votre domaine tant qu'il n'est pas vérifié ; d'ici là, la carte de statut affiche **Vos courriels sont actuellement envoyés depuis l'adresse partagée de FieldQuo, en utilisant le nom de votre entreprise.** Un domaine se terminant par fieldquo.com est refusé, et un domaine déjà connecté à une autre entreprise sur FieldQuo est refusé avec une phrase qui le dit." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["**Connecter**", "Inscrit le domaine pour l'envoi et affiche les enregistrements DNS. Remplace tout domaine connecté auparavant."],
              ["**Vérifier**", "Demande si les enregistrements DNS sont maintenant en place. Le statut devient Vérifié, En attente du DNS ou Échec de la vérification."],
              ["**Adresse d'expéditeur → Enregistrer**", "La partie avant le @ sur chaque courriel client une fois vérifié. Par défaut : quotes."],
              ["**Déconnecter**", "Retire le domaine. Les courriels repartent de l'adresse partagée de FieldQuo, toujours sous le nom de votre entreprise. Rien de déjà envoyé ne change."],
              ["**Réponses**", "Pas une commande — ça montre où atterrit une réponse : votre courriel d'entreprise, ou celui du propriétaire quand aucun n'est inscrit. Changez-le dans le Profil de l'entreprise."],
            ],
          } },
        ],
      },
      {
        id: "which-emails",
        heading: "Quels courriels l'utilisent",
        blocks: [
          { p: "Tout ce qu'un **client** reçoit : soumissions, factures et demandes de paiement, courriels de dépôt et de versement, factures de forfait d'entretien, relances et rappels, demandes d'avis, confirmations et changements de rendez-vous, confirmations d'autosoumission et d'estimation instantanée, et campagnes marketing. Les campagnes marketing, les demandes d'avis et les relances de chantier terminé portent aussi un lien de désabonnement en un clic ; les courriels transactionnels comme une soumission ou une facture n'en portent délibérément pas." },
          { p: "Les courriels que FieldQuo **vous** envoie — invitations d'équipe, réinitialisations de mot de passe, avis de facturation, alertes de crédit téléphonique, le bilan mensuel — viennent des propres adresses de FieldQuo quel que soit le domaine connecté, parce qu'ils viennent de FieldQuo." },
        ],
      },
      {
        id: "limits",
        heading: "Ce que FieldQuo ne peut pas vous dire",
        blocks: [
          { bullets: [
            "**Les rebonds.** Une fois que Resend accepte un message, FieldQuo n'entend plus rien. Il n'y a pas de rapport de rebond ni d'indicateur « mauvaise adresse » sur un client. Ce qu'il vérifie, c'est l'adresse elle-même avant l'envoi, et il vous le dit sur-le-champ quand Resend refuse un envoi.",
            "**Les réponses.** La réponse d'un client va à votre boîte, par l'adresse de réponse. Elle n'apparaît pas dans FieldQuo.",
            "**Les ouvertures et les clics.** Non suivis.",
            "**Les limites d'envoi.** FieldQuo n'en impose aucune ; un message de « limitation » sur un envoi vient de Resend, et passe en un instant.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Paramètres → Domaine d'envoi est réservé au **propriétaire, aux administrateurs et aux niveaux Gestionnaire et Répartiteur** — quiconque peut gérer les gens. Les accès Équipe et Estimateur ne voient pas la ligne, et la route les refuse. Tous les forfaits l'incluent ; il n'y a pas d'option payante pour votre propre domaine." },
        ],
      },
    ],
    faq: [
      { q: "Ai-je besoin de mon propre domaine ?", a: "Non. Sans domaine, les courriels partent sous le nom de votre entreprise depuis l'adresse partagée de FieldQuo, et les réponses atteignent quand même votre propre boîte. Un domaine vérifié enlève la mention « via » que certaines boîtes affichent et améliore la délivrabilité." },
      { q: "Quels enregistrements DNS dois-je ajouter ?", a: "Exactement ceux que la page liste pour votre domaine — copiez chaque valeur avec le bouton. La page n'invente pas de liste générique ; les enregistrements sont lus du service d'envoi pour votre domaine." },
      { q: "Où vont les réponses de mes clients ?", a: "Au courriel d'entreprise du Profil de l'entreprise. S'il est vide, au courriel de connexion du propriétaire du compte, et la page le dit en orange tant que vous n'en inscrivez pas un." },
    ],
  },

  "quickbooks-xero-and-your-bookkeeper": {
    title: "QuickBooks, Xero et votre comptable",
    summary:
      "Il n'y a pas de synchronisation en direct avec QuickBooks ni Xero. Ce qui existe est un export comptable — quatre fichiers CSV pour une période — et cet article dit exactement ce qu'il contient et ce qu'il ne contient pas.",
    updated: "2026-09-12",
    intro: [
      "« Est-ce que ça marche avec QuickBooks ? » La réponse honnête : vos chiffres peuvent sortir de FieldQuo sous forme de fichiers propres que votre comptable importe, et rien n'est synchronisé en direct. L'**Export comptable** dans **Dépenses** produit un ZIP de quatre fichiers CSV pour n'importe quelle période — une feuille de synthèse, les factures, les paiements et les dépenses — et tous les comptables de la terre importent un CSV.",
      "Cet article, c'est cet export : comment le lancer, ce que chaque fichier contient, comment les frais de traitement et les remboursements y paraissent, et les sept choses qu'il ne contient pas, imprimées devant le bouton et encore dans le ZIP pour qu'elles voyagent avec les chiffres.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une synchronisation bidirectionnelle avec QuickBooks en ligne ou Xero n'est pas construite. Les propres pages de comparaison de FieldQuo le concèdent : les mots quickbooks, zapier et xero n'apparaissent dans aucun code d'intégration. QuickBooks Desktop est refusé d'emblée, parce qu'il exige un connecteur Windows. Ce qui est construit, c'est l'export, et c'est le même que décrivent l'article sur les frais et les pages sur les comptes à recevoir." },
          { p: "La carte se trouve au bas de **Dépenses** (le même écran que **Paramètres → Suivi des dépenses**) : **Export comptable — Une période de factures, paiements et dépenses en quatre fichiers CSV dans un seul ZIP — une feuille de synthèse plus un fichier chacun — à remettre à un comptable ou à importer dans son logiciel.** Les montants sont dans la devise de facturation de votre entreprise, définie dans le Profil de l'entreprise ; sans devise, l'export refuse plutôt que de deviner." },
          { figure: "live:app-settings-expense-tracking", caption: "Suivi des dépenses — les cartes du mois et la carte Export comptable au bas, avec Du, Au et Télécharger la période." },
        ],
      },
      {
        id: "how-to-run-it",
        heading: "Comment le lancer",
        blocks: [
          { steps: [
            "Ouvrez **Dépenses** et descendez jusqu'à **Export comptable**. La période proposée par défaut est le mois dernier.",
            "Réglez **Du** et **Au**, puis lisez **Ce que ce fichier ne contient pas** en dessous — c'est la liste dont votre comptable a besoin avant d'importer.",
            "Appuyez sur **Télécharger la période**. Le ZIP s'appelle bookkeeping-… et contient les CSV summary, invoices, payments et expenses.",
            "Remettez le ZIP à votre comptable, ou importez chaque fichier dans QuickBooks en ligne ou Xero avec leur import CSV, en associant les colonnes une seule fois.",
          ] },
        ],
      },
      {
        id: "what-each-file-carries",
        heading: "Ce que chaque fichier contient",
        blocks: [
          { table: {
            head: ["Fichier", "Une ligne par", "Colonnes d'argent"],
            rows: [
              ["summary", "export — entreprise, période, puis une ligne par devise", "Facturé, dont taxe, Paiements reçus, Remboursements, Frais de traitement, Frais de compte Stripe, Dépenses"],
              ["invoices", "facture — la dernière version d'une facture modifiée, datée de l'originale", "Sous-total, Rabais, Taxe, si la taxe était activée, Total, Payé, Reçu dans la période, Dû"],
              ["payments", "paiement — à la date propre du paiement, pas celle de la facture", "Montant (brut), Frais de traitement, Net déposé, Taux des frais, Frais de compte Stripe"],
              ["expenses", "dépense", "Montant, avec Catégorie, Frais généraux oui/non, Récurrent, Fréquence et Chantier"],
            ],
          } },
          { p: "Passez le brut aux revenus et les frais de traitement à une dépense de frais bancaires à partir de la même ligne de paiement ; le relevé bancaire correspond alors au **net déposé**. Un remboursement émis depuis FieldQuo est sa propre ligne négative dans le fichier des paiements, avec la méthode refund et la raison dans les notes, et il est totalisé sous Remboursements dans la synthèse. Un remboursement fait directement dans Stripe figure dans le montant remboursé du paiement d'origine, pas comme une ligne." },
          { p: "Chaque cellule de texte qu'une personne a tapée — un nom de client, une catégorie, une note — est protégée pour ne pas s'exécuter comme une formule quand le fichier s'ouvre dans Excel ou Sheets." },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "Ce qu'il ne contient pas",
        blocks: [
          { bullets: [
            "C'est un export, pas une déclaration. Rien n'a été transmis à une administration fiscale.",
            "Il ne peut pas produire de déclaration de taxes. La taxe est un montant unique par facture, sans codes ni détail par ligne — une facture québécoise avec TPS et TVQ a deux taux et un seul chiffre.",
            "Les dépenses ne portent ni taxe ni fournisseur : les crédits de taxe sur intrants n'y sont pas.",
            "Les notes de crédit n'existent pas. Les remboursements apparaissent comme leurs propres lignes négatives.",
            "Il n'y a pas de plan comptable. Rien n'est associé à un compte — votre comptable le fait une fois, à l'import.",
            "Les colonnes de frais ne sont remplies que pour les paiements en ligne encaissés après que les frais ont commencé à être inscrits sur le paiement (septembre 2026) ; les paiements par carte plus anciens et tous les paiements manuels les laissent vides plutôt que d'écrire 0,00.",
            "Les jours sont regroupés en UTC, et il n'y a pas de date d'émission de facture — chaque facture indique de quelle colonne vient sa date.",
          ] },
          { warning: "Dites à votre comptable que c'est un jeu de relevés propre, pas un grand livre ni une synchronisation QuickBooks. Un comptable qui l'importe en s'attendant à un grand livre et découvre que ce n'en est pas un blâme le logiciel ; la liste ci-dessus est imprimée devant le bouton pour l'éviter." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'écran Dépenses lui-même exige l'accès aux dépenses de **tout le monde** dans la grille d'accès — le propriétaire, les administrateurs et le niveau Gestionnaire ; un estimateur ou un répartiteur inscrit ses propres reçus mais ne voit pas le cumul de l'entreprise. Sur cet écran, la carte n'apparaît que pour une personne dont l'accès a aussi **Voir les prix** activé et les factures en **lecture seule** ou mieux. La route pose les mêmes questions à la même grille, alors une personne sans ces droits n'a pas de carte plutôt qu'une carte qui échoue." },
        ],
      },
    ],
    faq: [
      { q: "Y aura-t-il une synchronisation QuickBooks ?", a: "Pas aujourd'hui, et FieldQuo ne l'inscrit pas sur ses pages de comparaison. L'export est la porte qui existe ; une synchronisation en direct serait une application approuvée par Intuit avec son propre examen de sécurité, et c'est pourquoi ce n'est pas un ajout rapide." },
      { q: "Mon comptable peut-il se connecter à la place ?", a: "Oui — invitez-le depuis Gérer l'équipe. Nommez-le administrateur s'il doit voir la facturation ; sinon, un niveau Gestionnaire voit les factures, les paiements et les dépenses et peut lancer l'export." },
      { q: "Pourquoi les colonnes de frais sont-elles vides sur certains paiements ?", a: "Un paiement manuel ne porte aucuns frais, et un paiement en ligne encaissé avant que les frais soient inscrits sur le paiement n'a pas de frais connus. Une cellule vide dit « aucuns frais connus » ; un 0,00 dirait « aucuns frais », ce qui est une autre affirmation." },
    ],
  },

  "stock-photos-on-your-website": {
    title: "Photos d'archive sur votre site web (Unsplash)",
    summary:
      "Pourquoi un nouveau site web démarre avec des photos d'archive dans ses emplacements décoratifs, quels emplacements n'en reçoivent jamais, comment les remplacer, et ce que le navigateur d'un visiteur envoie à Unsplash.",
    updated: "2026-09-12",
    intro: [
      "Un site web rédigé à partir de vos données le premier jour n'a encore aucune photo de vos réalisations, alors le constructeur remplit les emplacements **décoratifs** — l'arrière-plan de l'en-tête, l'image d'à-propos, l'arrière-plan de l'appel à l'action et jusqu'à quatre images de services — avec des photos d'archive choisies pour votre métier. Il ne met jamais une photo d'archive dans **Nos réalisations**, la galerie ou une paire avant-après, parce que ces sections disent que les photos sont des chantiers que vous avez faits, et une photo d'archive là serait une fausse déclaration à un propriétaire.",
      "Les photos sont chargées depuis les propres serveurs d'Unsplash, pas copiées. C'est le seul fait de confidentialité de cet article, et la raison de les remplacer : vos propres réalisations vendent toujours mieux qu'une banque d'images.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le constructeur garde un petit jeu de photos par métier — toiture, extérieur, peinture, cuisine, plancher, aménagement paysager, béton, plomberie, électricité, nettoyage et un jeu général — chacune regardée par une personne avant d'être retenue. Un emplacement qui contient déjà une image à vous n'est jamais écrasé, et un emplacement ne reçoit une photo d'archive que tant qu'il est vide. Rien dans le texte de votre site n'est d'archive : chaque phrase est rédigée à partir de ce que vous avez dit à FieldQuo." },
          { figure: "live:app-settings-website", caption: "Paramètres → Votre site web — le constructeur avec sa consigne, les sélecteurs de mise en page et de style, et l'aperçu où les photos d'archive apparaissent dans les emplacements décoratifs." },
        ],
      },
      {
        id: "replace-them",
        heading: "Comment les remplacer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Votre site web** et appuyez sur **Ajouter mes photos** pour téléverser les vôtres ; elles vont dans votre bibliothèque de photos et la galerie.",
            "Dans **Ajuster**, ouvrez la section d'en-tête, d'à-propos ou d'appel à l'action et utilisez **Ajouter une photo** sur son image — ou **Retirer l'image** pour laisser l'emplacement vide, sans photo d'archive.",
            "Étoilez des photos sur un chantier terminé pour les montrer sur le site ; voir [[photos-and-files|Photos et fichiers]].",
            "Appuyez sur **Publier**. S'il reste une photo d'archive, une boîte de dialogue dit **{count} photos d'archive encore sur votre site** et explique où elles sont, avec **Ajouter mes photos** juste là. Vous pouvez publier quand même et les remplacer plus tard.",
          ] },
          { note: "Régénérer le site conserve les images d'en-tête et d'à-propos, la galerie et les paires avant-après que vous avez réglées — c'est le correctif d'une version antérieure qui détruisait les photos téléversées à la régénération. Il ne conserve pas une image d'appel à l'action ou de service réglée à la main ; ces deux emplacements sont reconstruits, alors réglez-les en dernier." },
        ],
      },
      {
        id: "what-a-visitor-sends",
        heading: "Ce que le navigateur d'un visiteur envoie à Unsplash",
        blocks: [
          { p: "FieldQuo n'envoie rien sur personne à Unsplash. Mais comme une photo d'archive est un lien vers images.unsplash.com plutôt qu'une copie, un propriétaire qui ouvre votre site va chercher cette image directement chez Unsplash, et les serveurs d'Unsplash voient son adresse IP et son navigateur — comme pour toute image liée sur le web. Dès que vous remplacez une photo d'archive par la vôtre, cette requête cesse ; vos photos sont servies depuis votre propre stockage. Aucune mention d'auteur n'est imprimée sur le site ; la licence n'en exige pas." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Où d'autre les photos d'archive apparaissent",
        blocks: [
          { p: "Le **Créateur marketing** a un onglet d'archive qui montre des photos Unsplash avec le nom du photographe au survol ; quand vous publiez un visuel, tout le canevas est rendu en une seule image et conservé avec vos fichiers, alors la publicité publiée n'est pas un lien externe. Les photos d'archive ne servent ni dans les entonnoirs, ni sur le lien bio, ni dans les PDF, ni dans les courriels de soumission." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "Le constructeur de site web — y compris téléverser et retirer des photos — est réservé au **propriétaire et aux administrateurs**. Quiconque a le lien voit le site publié." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je désactiver complètement les photos d'archive ?", a: "Retirez l'image d'une section et l'emplacement reste vide ; une photo d'archive n'est placée que là où un emplacement est vide à la génération. Remplissez les emplacements avec vos propres photos et il ne reste aucune photo d'archive." },
      { q: "Mes clients sauront-ils que ce sont des photos d'archive ?", a: "Elles n'apparaissent que dans les emplacements décoratifs, jamais présentées comme vos réalisations. La boîte de dialogue de publication compte ce qui reste pour que vous décidiez en connaissance de cause." },
    ],
  },

  "data-and-privacy": {
    title: "Vos données, celles de vos clients, et la suppression",
    summary:
      "Qui contrôle quoi, quels services externes voient quelles données, ce que l'IA reçoit et ne reçoit pas, ce que vous pouvez exporter, et le fait tout simple que rien n'est supprimé selon un calendrier — votre compte compris.",
    updated: "2026-09-12",
    intro: [
      "Deux sortes de données vivent dans votre compte FieldQuo. Les données de votre **entreprise** — vos comptes de personnel, votre forfait, votre carte — c'est à FieldQuo d'en prendre soin. Les données de vos **clients** — leurs noms, adresses, soumissions, photos, appels — sont à vous : vous êtes le responsable du traitement et FieldQuo est votre sous-traitant, et c'est pourquoi un propriétaire qui veut faire changer ou retirer ses données est invité à s'adresser à vous d'abord.",
      "Cet article est l'état honnête de tout ça, lu dans le code et dans la propre page de confidentialité de FieldQuo : quels services externes reçoivent quoi, ce que l'IA reçoit, ce que vous pouvez sortir, et ce que la suppression veut dire aujourd'hui — une demande traitée par une personne, pas un bouton.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { bullets: [
            "**Où ça vit.** Une seule base de données Postgres hébergée chez Neon, le produit hébergé chez Vercel, les photos et les documents conservés chez Cloudinary, dans un dossier par entreprise. Chiffrement en transit partout, et au repos par ces fournisseurs. FieldQuo ne prétend rien sur le pays où les données sont conservées, parce que rien dans le produit n'en fixe un.",
            "**Qui chez FieldQuo peut les voir.** Le soutien regarde le compte d'un client par une session en lecture seule, journalisée, de 30 minutes, qui peut tout voir et ne rien changer. La seule exception est le service de migration payant, qui crée les nouvelles fiches que vous avez demandées et ne modifie jamais celles qui existent ; voir [[the-data-migration-service|Le service de migration des données]].",
            "**Jamais vendues, jamais partagées entre entreprises.** L'IA FieldQuo répond sur vos données seulement, et le comparatif de prix anonymisé est facultatif, mis en commun avec les autres entreprises qui y participent, publié seulement quand au moins cinq soumissions se cachent derrière un chiffre, et ne montre jamais les prix d'une seule.",
          ] },
        ],
      },
      {
        id: "who-else-sees-it",
        heading: "Quels services voient quelles données",
        blocks: [
          { p: "La page de confidentialité de FieldQuo liste chaque service externe auquel le produit est branché, et la compilation échoue si la liste cesse de correspondre au code. Voici cette liste, dans les mots qui comptent pour un entrepreneur." },
          { table: {
            head: ["Service", "Ce qu'il reçoit"],
            rows: [
              ["Stripe", "La carte ou les coordonnées bancaires d'un client quand il vous paie — tapées sur la page de Stripe, jamais conservées par FieldQuo — et, à part, votre propre carte pour votre abonnement. Voir [[stripe|Stripe]]."],
              ["Resend", "Chaque courriel envoyé en votre nom : le destinataire et tout son contenu. Voir [[email-delivery|Livraison des courriels]]."],
              ["Twilio et Retell", "Le numéro de téléphone d'un client et le texte d'un rappel ; pour la réceptionniste, l'audio en direct, l'enregistrement et la transcription de chaque appel. Voir [[phone-and-texts|Numéros de téléphone et textos]]."],
              ["Cloudinary", "Chaque photo et document téléversé, y compris les photos d'un propriétaire sur une demande de soumission. Voir [[photos-and-files|Photos et fichiers]]."],
              ["OpenAI", "Les photos d'une propriété pour la révision d'une soumission, les transcriptions d'appels pour un brouillon ou le bilan mensuel, et — pour l'IA FieldQuo — le nom d'un client seulement, jamais ses coordonnées, son adresse ni son historique financier."],
              ["Google Maps et Solar", "Une adresse telle que tapée, et les coordonnées d'un chantier. Voir [[google-maps-and-solar|Google Maps et Google Solar]]."],
              ["Meta", "Le jeton d'accès de votre compte publicitaire, et en retour vos propres chiffres de dépenses et de campagnes. Aucune donnée client ne va chez Meta. Voir [[facebook-and-instagram|Facebook et Instagram]]."],
              ["Unsplash", "Rien de la part de FieldQuo — mais un visiteur d'un site avec des photos d'archive les va chercher directement chez Unsplash. Voir [[stock-photos-on-your-website|Photos d'archive sur votre site web]]."],
            ],
          } },
          { note: "L'IA ne reçoit jamais votre base de données. On lui tend une liste de recherches, elle en choisit une, et reçoit en retour un petit jeu de chiffres déjà calculés par FieldQuo ; l'entreprise est fixée dans le code, alors aucune question ne peut atteindre les données d'une autre entreprise, et une personne dont l'accès cache les prix n'obtient aucune recherche d'argent. Voir [[fieldquo-ai-ask-about-your-business|L'IA FieldQuo]]." },
        ],
      },
      {
        id: "what-your-clients-can-do",
        heading: "Ce que vos clients peuvent faire, et ce qu'ils ne peuvent pas",
        blocks: [
          { p: "Le portail d'un client montre ses soumissions et ses factures avec vous et lui permet de payer ; ce n'est pas un outil d'accès aux données. Un client peut se désabonner des courriels marketing en un clic — l'enregistrement est gardé pour toujours, volontairement — et répondre STOP à un texto. Rien ne permet à un propriétaire de voir, corriger, exporter ou supprimer lui-même ses renseignements ; il vous le demande, et vous agissez dans FieldQuo ou transmettez la demande à FieldQuo. Voir [[client-consent-and-unsubscribes|Consentement des clients et désabonnements]]." },
        ],
      },
      {
        id: "what-you-can-take-out",
        heading: "Ce que vous pouvez sortir",
        blocks: [
          { bullets: [
            "**Export comptable** — un ZIP de quatre CSV (synthèse, factures, paiements, dépenses) pour n'importe quelle période, depuis Dépenses. Voir [[the-accounting-export|L'export comptable]].",
            "**Liste de prix** — Exporter un CSV dans Paramètres → Produits et services, prix coûtants compris.",
            "**Liste de fin d'année (CSV)** des sous-traitants et le **CSV de chaque cycle de paie**.",
            "**PDF** — chaque soumission, facture, bulletin de paie et rapport photo de chantier.",
          ] },
          { warning: "Il n'y a pas d'export des clients, des chantiers, des prospects ni des photos, et pas de « tout télécharger ». Avant de demander la suppression d'un compte, prenez les exports ci-dessus et sauvegardez les PDF que vous voulez ; la suppression n'est pas réversible et FieldQuo n'en garde aucune copie pour vous ensuite." },
        ],
      },
      {
        id: "deleting",
        heading: "Supprimer, dans le produit et sur demande",
        blocks: [
          { p: "Dans le produit, une soumission, un chantier, une facture ou une dépense peut être supprimé depuis son propre écran par une personne dont l'accès le permet — le niveau Gestionnaire et plus. Une fiche client n'a pas de bouton de suppression aujourd'hui. Déconnecter les Publicités Meta supprime le jeton conservé sur-le-champ ; les dépenses importées restent. Les photos et les documents ne sont jamais retirés du stockage par aucun écran ; voir [[photos-and-files|Photos et fichiers]]." },
          { p: "Rien n'expire selon un calendrier. **Annuler votre forfait ne supprime rien** : le compte passe en lecture seule pendant 30 jours puis se verrouille, et reprendre le forfait ramène tout, exactement comme le dit l'écran d'annulation — **Rien n'est supprimé. Vos soumissions, clients, chantiers, factures et photos restent exactement où ils sont.** Voir [[cancel-your-subscription|Annuler votre abonnement]] et [[closing-your-account|Fermer votre compte]]." },
          { steps: [
            "Pour faire supprimer des données — celles d'un client, ou tout le compte — envoyez une demande depuis l'adresse courriel du propriétaire du compte à l'adresse de soutien de FieldQuo, ou utilisez le formulaire de suppression sur le propre site web de FieldQuo. FieldQuo confirme d'abord qui vous êtes.",
            "Vous recevez un code de référence et un courriel de confirmation. La suppression est faite à la main par le propriétaire de FieldQuo dans les **30 jours ouvrables** ; la référence vous permet d'en vérifier l'état sur la même page.",
            "Un courriel de fin clôt la demande. Les enregistrements de désabonnement et de STOP, les registres financiers et fiscaux, et la trace de la demande elle-même sont conservés, volontairement.",
          ] },
          { p: "Si un propriétaire retire FieldQuo de ses réglages Facebook, Meta envoie à FieldQuo une demande de suppression de la même façon, avec un code de référence qu'il peut vérifier. Voir [[how-to-get-help|Comment obtenir de l'aide]] pour l'adresse de soutien." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut agir là-dessus",
        blocks: [
          { p: "Annuler le forfait et demander une migration sont réservés au **propriétaire et aux administrateurs**. Une demande de suppression de tout le compte doit venir de l'adresse du propriétaire. Les exports suivent l'accès de leurs propres écrans : l'export comptable exige Voir les prix et l'accès en lecture aux factures, l'export de la liste de prix exige Voir les prix, et la liste des sous-traitants exige le coût de revient." },
        ],
      },
    ],
    faq: [
      { q: "Les données de mes clients servent-elles à entraîner une IA ?", a: "Le code de FieldQuo n'envoie à l'IA que ce que le tableau ci-dessus liste, et l'assistant ne reçoit que le nom d'un client. Ce que le fournisseur fait d'une requête ensuite relève de l'entente de FieldQuo avec lui, que la page de confidentialité nomme ; le produit lui-même ne prétend rien dans un sens ni dans l'autre." },
      { q: "Un autre entrepreneur sur FieldQuo peut-il voir mes prix ?", a: "Non. Le comparatif Comment vous vous comparez est facultatif, mis en commun avec les autres entreprises qui y participent, publié seulement quand au moins cinq soumissions se cachent derrière un chiffre, et ne montre jamais les prix d'une seule. L'IA FieldQuo est liée à votre entreprise dans le code." },
      { q: "Si j'arrête de payer, mes données disparaissent-elles ?", a: "Non. Le compte passe en lecture seule, puis se verrouille ; rien n'est effacé, et payer le rétablit. Effacer est une demande écrite à part." },
      { q: "Où les données sont-elles hébergées ?", a: "Neon (base de données), Vercel (le produit) et Cloudinary (fichiers). FieldQuo ne prétend pas à un pays en particulier, parce qu'il n'en a pas fixé un." },
    ],
  },

  "no-public-api-or-zapier": {
    title: "Pas d'API publique ni de Zapier, pour l'instant",
    summary:
      "FieldQuo n'a ni clés d'API, ni application Zapier, ni webhooks sortants, ni flux de calendrier. Cet article le dit clairement et liste les portes qui existent — intégrations, liens publics, CSV entrants et sortants, l'import Meta et le service de migration.",
    updated: "2026-09-12",
    intro: [
      "Si vous cherchez une clé d'API à coller quelque part, il n'y en a pas. FieldQuo n'a **pas d'API publique**, **pas d'application Zapier ni Make**, **pas de webhooks à pointer vers votre propre système**, et **pas de flux de calendrier** pour Google ni Outlook. Chaque route du produit authentifie une personne connectée, et les webhooks qui existent sont des fournisseurs — Stripe, Meta, Twilio, Retell — qui appellent FieldQuo, pas FieldQuo qui vous appelle.",
      "C'est toute la première moitié. La seconde, c'est ce qui existe, parce que « comment je fais entrer et sortir des données » a de vraies réponses même sans API.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les propres pages de comparaison de FieldQuo concèdent ces points à la concurrence plutôt que de les laisser entendre : les mots QuickBooks, Zapier et Xero n'apparaissent dans aucun code d'intégration, seulement dans du texte. Le plan inscrit, dans l'ordre, est l'export comptable (construit), puis un webhook sortant signé par événement (pas construit), puis un envoi QuickBooks à sens unique (reporté) ; une application Zapier publiée et une synchronisation comptable bidirectionnelle sont refusées pour l'instant. Rien sur cette page ne doit se lire comme une date." },
        ],
      },
      {
        id: "doors-out",
        heading: "Les portes de sortie",
        blocks: [
          { table: {
            head: ["Porte", "Ce qui en sort", "Où"],
            rows: [
              ["**Export comptable**", "Quatre CSV — synthèse, factures, paiements, dépenses — pour une période, dans un seul ZIP", "Dépenses → Télécharger la période. Voir [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero et votre comptable]]."],
              ["**Exporter un CSV**", "Votre liste de prix, prix coûtants compris", "Paramètres → Produits et services"],
              ["**Liste de fin d'année (CSV)**", "Ce que chaque sous-traitant a reçu dans l'année", "Sous-traitants"],
              ["**Exporter CSV** sur un cycle de paie", "Les lignes d'un cycle de paie", "Paie"],
              ["PDF", "Chaque soumission, facture, bulletin de paie et rapport photo de chantier", "Leurs propres écrans, et le courriel du client"],
            ],
          } },
          { p: "Il n'y a pas d'export des clients, des chantiers, des prospects, des rendez-vous ni des photos. Si vous partez, prenez ces fichiers et les PDF ; voir [[data-and-privacy|Vos données, celles de vos clients, et la suppression]]." },
        ],
      },
      {
        id: "doors-in",
        heading: "Les portes d'entrée",
        blocks: [
          { bullets: [
            "**Importer** dans Clients — un CSV avec nom, courriel, téléphone, adresse, ville, province. Voir [[import-clients-from-a-csv|Importer des clients depuis un CSV]].",
            "**Travaux passés** dans Chantiers — une ligne devient une soumission, un chantier, une facture et son paiement, pour que votre historique ait des chiffres derrière. Voir [[import-past-jobs|Importer les chantiers passés]].",
            "**Importer** dans Prospects, et **Importer un CSV** dans Paramètres → Produits et services.",
            "**Importer depuis un CSV bancaire** dans Dépenses — association des colonnes, votre format de date, détection des doublons. Voir [[import-expenses-from-a-bank-csv|Importer des dépenses depuis un CSV bancaire]].",
            "**Formulaires de prospects Facebook** — un prospect soumis sur une publicité Meta devient un prospect dans FieldQuo, dès que Meta approuve l'autorisation. Voir [[facebook-lead-forms|Formulaires de prospects Facebook]].",
            "**Le service de migration des données** — le personnel de FieldQuo fait entrer les clients et les soumissions de votre ancien système pour un prix soumis, en créant seulement de nouvelles fiches. Voir [[the-data-migration-service|Le service de migration des données]].",
          ] },
        ],
      },
      {
        id: "doors-on-your-website",
        heading: "Les portes sur votre propre site web",
        blocks: [
          { p: "Ce qu'on demanderait le plus souvent à une API — « mettre FieldQuo sur mon site » — c'est une intégration. **Paramètres → Partager vos liens** donne à chaque page publique un lien et un extrait **Copier le code** : le calendrier de rendez-vous, le formulaire de demande de soumission, l'estimation instantanée, vos avis et chaque entonnoir publié. Collez l'extrait dans n'importe quel site web et le formulaire y fonctionne, à la bonne taille. Les mêmes extraits se trouvent dans Paramètres → Page de rendez-vous et Paramètres → Soumissions instantanées. Voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission]]." },
          { p: "Chaque page publique existe aussi seule comme lien : la page de rendez-vous, la demande de soumission, l'estimation instantanée, un entonnoir, votre site web généré, le portail client, la page d'approbation d'une soumission et la page de paiement d'une facture. Un lien est une porte qu'un propriétaire peut franchir sans compte ; voir [[share-your-links|Partager vos liens]]." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Ce qui n'existe pas, en une liste",
        blocks: [
          { bullets: [
            "Aucune clé d'API, aucun jeton, aucun réglage de développeur nulle part dans le produit.",
            "Aucune application Zapier, Make ou d'automatisation semblable.",
            "Aucun webhook sortant — rien n'appelle votre serveur quand une soumission est approuvée ou une facture payée.",
            "Aucun flux de calendrier ni synchronisation avec l'agenda Google / Outlook ; le calendrier des rendez-vous vit dans FieldQuo.",
            "Aucune synchronisation comptable en direct avec QuickBooks en ligne, Xero ni QuickBooks Desktop.",
            "Aucun courriel entrant dans FieldQuo ; la réponse d'un client atterrit dans votre propre boîte.",
          ] },
          { tip: "S'il vous faut l'un de ces éléments pour choisir FieldQuo, dites lequel au soutien. L'ordre ci-dessus est l'ordre dans lequel ils sont pesés, et un client qui le demande est ce qui fait avancer un élément." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je relier FieldQuo à mon CRM ou à mon tableur ?", a: "Seulement par fichier : les exports CSV vers la sortie et les imports CSV vers l'entrée. Il n'y a pas de lien en direct." },
      { q: "Mon site web peut-il envoyer son propre formulaire dans FieldQuo ?", a: "Utilisez l'extrait d'intégration ou un lien vers la page publique de demande de soumission — c'est la façon prise en charge pour qu'un formulaire sur votre site crée un prospect. Il n'y a pas de point d'entrée pour un formulaire que vous avez construit vous-même." },
      { q: "Serai-je averti quand une API arrivera ?", a: "Paramètres → Nouveautés porte chaque changement ; rien n'est promis ici." },
    ],
  },
};
