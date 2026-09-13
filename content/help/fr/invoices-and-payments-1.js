// content/help/fr/invoices-and-payments-1.js
//
// Partie 1 de la catégorie « invoices-and-payments » en français (voir le
// composeur, invoices-and-payments.js) : la liste des factures, créer une
// facture, pourquoi elle ressemble à la soumission, l'envoyer, la modifier,
// enregistrer un paiement à la main, comment un client paie en ligne, et la
// connexion Stripe.
//
// Même structure que le module anglais (mêmes slugs, mêmes sections, mêmes
// blocs, mêmes figures). Les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "the-invoices-list": {
    title: "La liste des factures",
    summary:
      "Toutes les factures émises par votre entreprise, ce qui reste dû, ce qui est en retard, et comment en retrouver une rapidement.",
    updated: "2026-09-12",
    intro: [
      "**Factures** est l'écran de l'argent : trois tuiles qui disent où vous en êtes, puis chaque facture avec son statut, son client, son échéance et ce qui reste à payer. C'est la page à ouvrir quand quelqu'un demande « ont-ils payé? ».",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Ouvrez **Factures** dans la barre latérale, sous **Travail**. L'en-tête lit **Factures — Suivez les paiements et la facturation.** et le bouton **Nouvelle facture** est en haut à droite. Les tuiles additionnent les mêmes chiffres par facture que les lignes affichent : une facture payée à moitié compte son solde restant dans **Impayé**, pas sa valeur nominale." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Impayé** — le total encore dû sur toutes les factures. Quand une partie est en retard, une ligne rouge ajoute **« … de ce montant est en retard. »**",
            "**Payée** — tout ce qui a été reçu, y compris les paiements partiels sur des factures pas encore réglées.",
            "**Total facturé** — la valeur nominale de toutes les factures, payées ou non.",
            "**Rechercher une facture...** — filtre la liste par numéro de facture ou nom de client à mesure que vous tapez.",
            "Une ligne par facture : le numéro (INV-2026-0008), une pastille de statut, le client, **Échéance le …** avec la date, et à droite le solde dû — ou **Payée en totalité** en vert avec le total de la facture en dessous.",
          ] },
          { figure: "harness:invoices", caption: "Factures — les trois tuiles, la boîte de recherche, et des lignes pour une facture envoyée, une payée et une en retard de 12 jours." },
          { p: "Le retard est mesuré depuis l'échéance à chaque chargement de la liste : une facture due hier lit **1 jours de retard** en rouge ce matin sans que personne n'y touche. Un brouillon n'est jamais en retard — il n'a jamais été facturé à personne — et une facture sans échéance ne l'est pas non plus; elle n'a simplement pas d'échéance." },
        ],
      },
      {
        id: "statuses",
        heading: "Les pastilles de statut",
        blocks: [
          { table: {
            head: ["Pastille", "Ce que ça veut dire"],
            rows: [
              ["**Brouillon**", "Enregistrée, jamais envoyée par courriel. Le client ne l'a pas vue. Seuls les brouillons peuvent être supprimés."],
              ["**Envoyée**", "Envoyée au client au moins une fois, avec un solde encore dû. Reste **Envoyée** à travers les paiements partiels."],
              ["**Payée**", "Plus rien de dû et au moins un paiement reçu — en ligne ou enregistré à la main."],
              ["**En retard**", "Échéance dépassée avec un solde dû. La ligne rouge **jours de retard** sous le nom du client est mesurée depuis l'échéance à chaque chargement, peu importe la pastille."],
              ["**Remboursé** / **Remboursé en partie**", "L'argent est retourné au client par Stripe. Ambre, pas rouge — c'est vous qui l'avez fait, il n'y a rien à relancer."],
              ["**Contesté**", "La banque d'un client a ouvert une rétrofacturation. Rouge, parce que la fenêtre pour envoyer vos preuves se referme — voir [[disputes-and-chargebacks|Litiges et rétrofacturations]]."],
            ],
          } },
        ],
      },
      {
        id: "find-an-invoice",
        heading: "Comment retrouver une facture",
        blocks: [
          { steps: [
            "Tapez une partie du numéro ou du nom du client dans **Rechercher une facture...**. La liste se resserre à mesure; **Aucune facture ne correspond à votre recherche.** veut dire que rien ne correspond.",
            "Appuyez sur la ligne. La facture s'ouvre avec ses bandeaux (non envoyée, en retard, payée en partie), le document tel que le client le voit, l'**Historique des paiements** et le chantier derrière.",
            "Pour ne voir que les factures d'un client, ouvrez plutôt sa fiche — elle liste ses soumissions, ses chantiers et ses factures ensemble.",
          ] },
          { tip: "La liste montre la version actuelle d'une facture modifiée, avec un solde recalculé à partir de tous les paiements de toutes ses versions. Vous n'avez jamais à additionner la v1 et la v2 vous-même." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "Toute personne dont le niveau d'accès inclut les factures à **View only** ou plus : les profils **Estimator**, **Dispatcher** et **Manager**, les administrateurs et le propriétaire. Le profil **Crew** n'a aucun accès aux factures et reçoit un panneau « aucun accès » plutôt qu'une liste vide — une liste vide dirait « vous n'en avez aucune », ce qui est une autre affirmation, et fausse." },
          { p: "Une personne dont l'accès a l'interrupteur **See prices** (voir les prix) désactivé voit quand même les lignes, mais chaque montant sur cet écran est un tiret. FieldQuo n'imprime pas « 0,00 $ impayé » sur un carnet qu'on lui a dit de ne pas chiffrer." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une ligne affiche-t-elle moins que le total de la facture?", a: "Le chiffre de droite est ce qui reste dû, avec **Payé …** en dessous quand une partie a été reçue. La tuile Impayé additionne exactement ces chiffres, alors la colonne et la tuile concordent toujours." },
      { q: "Pourquoi n'y a-t-il pas de ligne rouge sur une facture que je sais en retard?", a: "Elle n'a pas d'échéance, ou c'est encore un brouillon. Fixez une échéance à la création ou à la modification de la facture; un brouillon n'est pas en retard parce qu'il n'a jamais été envoyé." },
      { q: "Puis-je exporter cette liste?", a: "Pas depuis cet écran. L'export comptable sous **Dépenses** produit des fichiers CSV pour une période — voir [[the-accounting-export|L'export comptable]]." },
    ],
  },

  "create-an-invoice": {
    title: "Créer une facture",
    summary:
      "Trois façons de faire naître une facture — automatiquement quand une soumission est approuvée, à la main depuis une soumission approuvée, ou seule depuis Nouvelle facture — et ce que l'écran Nouvelle facture demande.",
    updated: "2026-09-12",
    intro: [
      "La plupart des factures dans FieldQuo ne sont jamais tapées. Quand un client approuve une soumission, la facture est construite à partir de cette soumission au même moment, avec les mêmes lignes, la même décision de taxe et le même numéro. **Nouvelle facture** existe pour le reste : le dépannage que personne n'a soumissionné, la visite supplémentaire, le cas unique.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Il y a une facture par chantier. Une soumission approuvée produit exactement une facture, et une seconde approbation (ou une seconde pression sur le bouton) renvoie celle qui existe déjà plutôt que de créer un doublon que le client contesterait. Les paiements par étapes — un acompte, un solde à l'installation — sont demandés en parts sur cette seule facture, jamais en plusieurs; voir [[deposits-and-payment-schedules|Acomptes et calendriers de paiement]]." },
          { p: "Le numéro suit la soumission : **Q-2026-0008** se facture **INV-2026-0008**, alors la paire se lit d'un coup d'œil. Une facture émise seule n'a aucun numéro à emprunter et prend le prochain de la séquence." },
        ],
      },
      {
        id: "from-an-approved-quote",
        heading: "Depuis une soumission approuvée",
        blocks: [
          { steps: [
            "Quand le client approuve en ligne, rien à faire : le chantier, la facture en brouillon et la tâche de relance sont créés pour vous. Ouvrez **Soumissions**, puis la soumission — une ligne bleue lit **Déjà convertie en facture** avec le numéro de facture en lien.",
            "Si le client a plutôt dit oui au téléphone, ouvrez la soumission, appuyez sur **Faire approuver**, puis **Ils l'ont approuvée**. Les mêmes choses se mettent en marche, facture comprise, et le journal d'activité note « invoice INV-… drafted ».",
            "Une soumission acceptée qui n'a pourtant pas de facture — acceptée avant que ceci existe, ou un accroc ce jour-là — affiche **Convertir en facture** sur la page de la soumission. Le bouton construit la même facture; l'appuyer deux fois renvoie celle qui existe.",
            "La nouvelle facture arrive en **Brouillon**. Ouvrez-la, vérifiez-la et envoyez-la — voir [[send-an-invoice|Envoyer une facture]].",
          ] },
          { note: "La facture copie les lignes de la soumission (groupées par pièce ou par portée, avec les options que le client a cochées), son sous-total, son rabais, sa taxe, son total, ses photos et sa langue au moment de l'approbation. Modifier la soumission ensuite ne change pas la facture — un document signé doit continuer à dire ce qu'il disait." },
        ],
      },
      {
        id: "a-standalone-invoice",
        heading: "Une facture autonome",
        blocks: [
          { steps: [
            "Appuyez sur **Nouvelle facture** dans la liste des factures, ou **Créer → Facture** dans la barre latérale. L'en-tête lit **Nouvelle facture — Créez une facture autonome.**",
            "Sous **Client**, tapez dans **Rechercher un client...** et choisissez-en un.",
            "Sous **Articles**, remplissez **Description**, **Qté** et **Taux**; le **Montant** est calculé. **Ajouter une ligne** ajoute une rangée, le × en retire une.",
            "Fixez une **Date d'échéance**. Sans elle, la facture ne pourra jamais apparaître en retard et aucune règle de rappel ne pourra se déclencher.",
            "Ajoutez des **Notes** et, si utile, des **Photos et vidéos du client** — reprises automatiquement quand il y a une soumission.",
            "Vérifiez la case **Appliquer la taxe** et le **Taux de taxe**, puis appuyez sur **Enregistrer comme brouillon** ou **Enregistrer et envoyer**.",
          ] },
          { figure: "live:app-invoices-new", caption: "Nouvelle facture — Client, Articles, le panneau interne Coût et marge, Date d'échéance, Notes, photos et le bloc de taxe, avec Enregistrer comme brouillon et Enregistrer et envoyer ancrés au bas." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque contrôle change",
        blocks: [
          { bullets: [
            "**Appliquer la taxe** coché ou non est enregistré comme une décision. Décoché écrit « aucune taxe » sur le document; coché avec un taux la facture. Coché sans rien de calculé imprime **Non déterminée** en ambre, et l'envoi est refusé jusqu'à ce que vous corrigiez l'adresse du client ou disiez qu'il n'y a réellement pas de taxe.",
            "Le **Taux de taxe** est prérempli depuis la province ou l'État du client. Quand la fiche du client ne peut pas répondre, la page suppose votre propre province et le dit en ambre — choisissez un client avec une adresse au dossier et le vrai taux s'applique. Taper dans la case remplace la supposition.",
            "**Coût et marge (interne — jamais montré au client)** — heures de l'équipe, matériaux et frais généraux sur cette facture. Il n'apparaît que pour les personnes ayant l'interrupteur **Job costing**, et rien de ce qu'il contient n'atteint le document. Voir [[job-costing|Coûts de chantier]].",
            "**Enregistrer comme brouillon** crée la facture et s'arrête là. **Enregistrer et envoyer** la crée, puis l'envoie par courriel; si le courriel échoue (aucune adresse au dossier, pas encore de forfait), la facture reste enregistrée en brouillon et la page vous dit pourquoi.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Créer une facture demande les factures à **View, create, and edit** et l'interrupteur **See prices** : les profils **Dispatcher** et **Manager**, les administrateurs et le propriétaire. **Convertir en facture** demande en plus le même niveau sur les soumissions. Un **Estimator** voit les factures mais ne peut pas en émettre; **Crew** ne les voit jamais." },
        ],
      },
    ],
    faq: [
      { q: "La soumission est approuvée mais il n'y a pas de facture. Pourquoi?", a: "Ouvrez la soumission et cherchez **Convertir en facture** — il n'apparaît que sur une soumission acceptée sans facture, et il la construit sur-le-champ. Un chantier passé entré par l'import est la seule exception : il arrive déjà facturé et payé, et rien n'est envoyé à son sujet." },
      { q: "Puis-je facturer un chantier en deux moitiés?", a: "Pas en deux factures — FieldQuo en émet une par chantier. Configurez un calendrier de paiement dans **Profil de l'entreprise** et l'acompte et le solde sont demandés par étapes sur cette seule facture." },
      { q: "D'où vient le numéro de facture?", a: "De la soumission qu'elle facture, quand il y en a une : Q-2026-0008 devient INV-2026-0008. Une facture autonome prend le prochain numéro libre de la séquence de l'année. Une facture révisée garde son numéro et gagne une version." },
    ],
  },

  "invoices-mirror-quotes": {
    title: "Les factures reflètent les soumissions",
    summary:
      "Pourquoi la facture que reçoit un client ressemble à la soumission qu'il a approuvée — mêmes sections, même image de marque, même formulation — et ce qu'une facture laisse volontairement de côté.",
    updated: "2026-09-12",
    intro: [
      "Un propriétaire qui a approuvé une soumission devrait reconnaître la facture comme sa jumelle. Dans FieldQuo, ce n'est pas un choix de style fait deux fois; la soumission et la facture sont rendues à partir des mêmes sections partagées, avec les mêmes calculs de couleur et la même formulation de métier, alors les deux ne peuvent pas diverger.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque document destiné au client — le PDF de soumission, le PDF de facture, les courriels d'accompagnement et les copies du portail — est assemblé à partir d'une seule bibliothèque de sections : en-tête, coordonnées du client, articles groupés par portée, totaux, sommaire des paiements, modalités de paiement, déroulement des travaux, notes, bloc de signature et pied de page. Chaque section sait se dessiner en PDF et en courriel, alors le bloc des totaux d'une facture est celui de la soumission avec un autre chiffre dedans." },
          { p: "Les couleurs viennent de votre unique couleur de marque, mesurée pour le contraste plutôt que devinée — voir [[set-up-your-branding|Configurer votre image de marque]]. L'argent vient de la facture elle-même; le contenu de métier — ce qui est inclus, ce qui pourrait changer le prix, le processus — vient de la soumission dont elle est issue." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "Ce qui est repris de la soumission",
        blocks: [
          { bullets: [
            "**La portée, par métier** — une carte par service, étiquetée comme la soumission l'a groupée (« Cuisine : installation des armoires »), avec les options cochées par le client en lignes distinctes.",
            "**Ce que dit cette facture** — les phrases « ce qui est inclus » et « ce qui pourrait changer le prix » que le client a déjà lues sur la soumission, tirées du même contenu de métier.",
            "**Comment se déroulent les travaux** — les étapes du processus avec leurs délais, et les notes de processus, marquées comme écrites sur la soumission ou comme valeur par défaut de votre entreprise.",
            "**Modalités de paiement** — les modalités de votre entreprise dans **Profil de l'entreprise**, montrées en jalons quand elles se lisent comme un calendrier et mot pour mot sinon.",
            "Les **photos**, la **langue** du client et la décision de taxe — une facture issue d'une soumission émise sans taxe est une facture sans taxe.",
          ] },
          { note: "L'argent est copié, pas lié. Modifier la soumission après l'approbation ne change rien à la facture, et modifier la facture ne change rien à la soumission. Chaque document continue de dire ce qu'il disait quand le client l'a lu." },
        ],
      },
      {
        id: "what-an-invoice-leaves-out",
        heading: "Ce qu'une facture laisse volontairement de côté",
        blocks: [
          { p: "Le PDF de facture par défaut, c'est l'en-tête, les coordonnées du client, les articles, les totaux, l'**Historique des paiements**, les notes et le pied de page. Trois sections qu'une soumission porte sont retirées exprès : pas d'étapes de processus (les travaux sont faits), pas de bloc de signature (il ne reste rien à accepter) et pas de calendrier de paiement (le calendrier a déjà eu lieu — ce qui est dû maintenant, c'est le solde)." },
          { p: "À la place, la facture met le **solde** en tête, pas le total. Sur une facture dont l'acompte est déjà payé, le courriel et le portail affichent en gros ce qui reste dû et listent les paiements reçus en dessous, parce qu'un total que le client a déjà réglé en partie se lit comme une double facturation." },
        ],
      },
      {
        id: "on-the-invoice-page",
        heading: "Ce que vous voyez sur la page de la facture",
        blocks: [
          { p: "Ouvrez n'importe quelle facture : l'article encadré au centre est le document du client, dans votre couleur : en-tête, **Facture** et son numéro (avec **v2** une fois modifiée), **Préparé pour**, la date, l'échéance, **Issue du devis** avec un lien, les cartes de portée, **Ce que dit cette facture**, **Comment se déroulent les travaux**, **Termes expliqués**, notes, photos, la bande des totaux et **Modalités de paiement**. Tout ce qui est hors du cadre — les bandeaux, les boutons, le chantier, le panneau des coûts — est à vous et n'atteint jamais le client." },
          { tip: "**Paramètres → Modèles PDF** a deux cartes, **PDF de soumission** et **PDF de facture**, chacune avec ses mises en page et les sections qu'elles portent. Réordonner ou retirer une section là change ce que le client reçoit; le miroir à l'écran suit les mêmes données. Voir [[the-quote-pdf|Le PDF de soumission]]." },
        ],
      },
    ],
    faq: [
      { q: "Le client dit que la facture ne correspond pas à la soumission. Où regarder?", a: "Ouvrez la facture et comparez les cartes de portée avec celles de la soumission. La facture porte le total accepté — le chiffre de la page sur laquelle le client a appuyé Approuver, options comprises — alors une différence est presque toujours une option qu'il a cochée ou une modification faite sur la soumission après l'approbation." },
      { q: "La facture peut-elle montrer une ligne de signature?", a: "Non. Le **Signature block** est une section réservée aux soumissions — l'éditeur de modèles ne l'offre pas sur une mise en page de PDF de facture, parce que l'approbation a déjà eu lieu et qu'il ne reste rien à signer." },
    ],
  },

  "send-an-invoice": {
    title: "Envoyer une facture",
    summary:
      "Ce qui se passe quand vous appuyez sur Envoyer : le courriel que reçoit le client, le lien dedans, la tâche de relance, et pourquoi un envoi peut être refusé.",
    updated: "2026-09-12",
    intro: [
      "**Envoyer** expédie la facture par courriel à l'adresse du client au dossier, au nom de votre entreprise, dans la langue du client, avec un bouton qui ouvre la facture dans son portail et — une fois Stripe connecté — lui permet de payer. Le statut ne devient **Envoyée** qu'après que le service de courriel a accepté le message, alors **Envoyée par courriel** sur la facture est un événement, pas une intention.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Rien n'est joint. Le courriel renvoie à la page de la facture dans le portail client, qui montre ce qui est dû et ce qui a été payé, et crée un paiement tout frais au moment où le client appuie sur **Payer** — un lien Stripe brut expirerait du jour au lendemain et un PDF joint ne peut pas encaisser. Le bouton **Télécharger le PDF** sur la facture est là quand un client demande un fichier." },
        ],
      },
      {
        id: "how-to-send",
        heading: "Comment l'envoyer",
        blocks: [
          { steps: [
            "Ouvrez la facture. Sur un brouillon, le bandeau lit **Cette facture n'a pas encore été envoyée au client.** avec **L'envoyer** à côté; le bouton **Envoyer** est aussi dans la barre de commandes.",
            "Appuyez dessus. Une ligne verte confirme **Facture envoyée par courriel à** l'adresse, et la carte de suivi en dessous montre **Envoyée par courriel → adresse** avec la date.",
            "Une tâche **Follow up payment for INV-…** est créée pour vous une semaine plus tard, pour qu'une facture envoyée ne puisse pas être oubliée. Elle se ferme d'elle-même quand le solde est réglé.",
            "Plus tard, tant qu'il reste quelque chose de dû, le même bouton lit **Renvoyer** — renvoyer une copie qu'un client a égarée est courant et ne ramène pas une facture payée ou en retard à Envoyée.",
          ] },
          { figure: "live:app-invoices-new", caption: "Nouvelle facture — Enregistrer et envoyer, au bas, crée la facture et l'envoie d'un coup; l'aide lit « Envoie la facture à l’adresse e-mail enregistrée du client. »" },
        ],
      },
      {
        id: "the-email",
        heading: "Le courriel que reçoit le client",
        blocks: [
          { bullets: [
            "**Objet :** « Facture INV-2026-0008 de Votre entreprise — 2 260,00 $ à payer ». Le chiffre est le solde, pas le total : après un acompte, l'introduction le dit et remercie le client.",
            "**De :** le nom de votre entreprise. Depuis votre propre domaine une fois vérifié sous **Paramètres → Domaine d'envoi**; sinon depuis l'expéditeur de FieldQuo avec votre nom dessus. Les réponses vont au courriel de votre entreprise.",
            "**Montant dû** et **Échéance le …** — ou **Échue le …** en rouge une fois la date passée.",
            "**Payer en ligne** quand Stripe est connecté et activé; sinon **Consulter votre facture** et la ligne « Veuillez nous contacter pour organiser le paiement. » — un bouton Payer qui mène à une impasse est pire que pas de bouton.",
            "La langue est celle de la facture, fixée à sa création; un client qui a reçu une soumission en français reçoit une facture en français.",
          ] },
        ],
      },
      {
        id: "when-a-send-is-refused",
        heading: "Quand un envoi est refusé",
        blocks: [
          { bullets: [
            "**Aucun courriel au dossier** — le bandeau lit **… n'a aucune adresse courriel au dossier : cette facture ne peut être ni envoyée ni relancée.** Ajoutez-en une sur la fiche du client et réessayez.",
            "**Ce document affirme que la taxe s'applique, mais n'en facture aucune** — la facture déclare une taxe et facture 0 $. La boîte de dialogue offre **Indiquer où se trouve …** pour calculer le taux, ou **Ou : il n'y a réellement aucune taxe sur celui-ci** pour envoyer sans taxe.",
            "**Pas encore de forfait** — l'envoi est l'acte vers l'extérieur qui exige un essai ou un forfait actif. Rédiger n'en exige jamais; voir [[your-plan-and-seats|Votre forfait et vos sièges]].",
            "**Un chantier passé** entré par l'import — il a été payé avant d'être saisi, et FieldQuo n'envoie rien à son sujet.",
          ] },
          { note: "**Demander un paiement** est l'autre courriel. Il part de la même adresse avec le même lien, formulé comme un rappel (« Un rappel : le solde de la facture … est de … »), avec de la place pour une note de votre cru. Voir [[invoice-reminders-and-chasing|Rappels de facture et relances]]." },
        ],
      },
      {
        id: "who-can-send",
        heading: "Qui peut envoyer",
        blocks: [
          { p: "Les factures à **View, create, and edit** — les profils **Dispatcher** et **Manager**, les administrateurs et le propriétaire. Chaque envoi est inscrit au **Journal d'activité** comme « Sent invoice INV-… to … »." },
        ],
      },
    ],
    faq: [
      { q: "Le client dit qu'il ne l'a jamais reçue.", a: "Ouvrez la facture : la carte de suivi montre **Envoyée par courriel → adresse** et la date seulement si le service de courriel l'a acceptée. Vérifiez l'adresse sur la fiche du client, puis **Renvoyer**. Si votre propre domaine est configuré mais non vérifié, les envois échouent avec un message qui le dit." },
      { q: "Le client a-t-il besoin d'un compte?", a: "Non. Le lien dans le courriel est son portail, lié à un jeton privé — pas de mot de passe, pas d'inscription, ça marche sur un téléphone." },
      { q: "Puis-je l'envoyer par texto à la place?", a: "Pas aujourd'hui. FieldQuo envoie les factures par courriel; les textos qu'il envoie aux clients sont le rappel de rendez-vous et « En route »." },
    ],
  },

  "edit-an-invoice-after-sending": {
    title: "Modifier une facture après son envoi",
    summary:
      "Un brouillon se modifie sur place; une facture envoyée devient une nouvelle version avec une raison, et l'ancienne est conservée — personne n'a à deviner ce qui avait été convenu.",
    updated: "2026-09-12",
    intro: [
      "Une fois qu'une facture a quitté le bureau, la changer en silence réécrirait ce qu'un client a déjà lu. FieldQuo garde celle qui a été envoyée au dossier et inscrit vos changements comme **version 2**, avec la raison que vous avez tapée rangée à côté. Le client voit la version que vous lui envoyez; vous voyez les deux, et l'argent déjà payé suit la facture, pas l'instantané.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Modifier** apparaît sur une facture en **Brouillon** ou **Envoyée**. Un brouillon se modifie sur place — rien n'a été envoyé, il n'y a rien à préserver. Une facture envoyée ouvre le même éditeur avec un avertissement jaune : **Cette facture a déjà été envoyée, donc l'enregistrement crée version 2 plutôt que de l'écraser. La version actuelle est conservée.**" },
          { p: "Les factures payées, remboursées et contestées n'ont pas de bouton Modifier. Ce qui a été payé l'a été contre un document; la trace de ce document reste telle quelle." },
        ],
      },
      {
        id: "how-to-amend",
        heading: "Comment modifier une facture envoyée",
        blocks: [
          { steps: [
            "Ouvrez la facture et appuyez sur **Modifier**. L'en-tête lit **Modifier INV-2026-0008**, avec **· version 2** si elle a déjà été modifiée auparavant.",
            "Changez les **Articles**, le **Rabais**, **Appliquer la taxe** et son **Taux de taxe (%)**, la **Date d'échéance**, les notes ou les photos. Les totaux se recalculent au fur et à mesure.",
            "Remplissez **Raison de cette modification** — par exemple « Le client a ajouté une deuxième salle de bain ». C'est obligatoire sur une facture envoyée et c'est conservé avec la version, pour que quiconque lira l'historique plus tard sache ce qui s'est passé.",
            "Appuyez sur **Enregistrer comme nouvelle version**. Vous arrivez sur la nouvelle facture, même numéro, **v2** à côté.",
            "Envoyez la nouvelle version — le client a l'ancienne tant que vous ne le faites pas.",
          ] },
          { note: "Si de l'argent a déjà été reçu, l'éditeur le dit : **… $ a déjà été payé sur cette facture. Réduire le total en dessous laisse un crédit à régler avec le client.** FieldQuo ne rembourse pas automatiquement." },
        ],
      },
      {
        id: "what-the-new-version-carries",
        heading: "Ce que porte la nouvelle version",
        blocks: [
          { bullets: [
            "Le même **numéro de facture**, le même client, le même lien vers la soumission et la même langue.",
            "Chaque **paiement** de la famille. Le solde de la v2 est recalculé à partir de tous les paiements contre le total de la v2, alors un acompte de 200 $ pris sur la v1 est toujours 200 $ payés sur la v2 — et le portail client n'offre que la version actuelle.",
            "Les **photos** et le panneau **Coût et marge**, reportés plutôt qu'abandonnés.",
            "Le **journal des modifications** : qui, quand, et la raison.",
          ] },
          { p: "L'ancienne version reçoit un seul bandeau et rien d'autre : **Ceci est la version 1. La version 2 l'a remplacée — c'est celle que votre client possède.** avec **Ouvrir la version actuelle**. Chaque action — envoyer, relancer, enregistrer un paiement — y est masquée, parce que ces actions appartiennent à la facture qui l'a remplacée." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Qui peut modifier",
        blocks: [
          { p: "Modifier demande les factures à **View, create, and edit** et l'interrupteur **See prices** — **Dispatcher**, **Manager**, les administrateurs et le propriétaire. Supprimer est autre chose : seul un **Brouillon** peut être supprimé, et seulement par quelqu'un ayant **View, create, edit, and delete** (le profil **Manager**, les administrateurs, le propriétaire). L'icône de corbeille est masquée pour tous les autres plutôt que grisée." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je corriger une coquille sans créer de version?", a: "Sur un brouillon, oui — Enregistrer les modifications édite sur place. Sur une facture envoyée, non : même un changement d'un mot est la version 2 avec une raison. C'est le but; la raison peut être « Correction de l'orthographe de la rue »." },
      { q: "Quelle version la liste montre-t-elle?", a: "La version actuelle, avec un solde calculé sur tous les paiements de la famille. En l'ouvrant, **v2** apparaît dans l'en-tête du document." },
      { q: "Puis-je supprimer une facture envoyée par erreur?", a: "Non — seuls les brouillons peuvent être supprimés. Modifiez-la à un total de zéro avec la raison, ou remboursez ce qui a été payé; dans les deux cas, la trace de ce qui a été envoyé reste." },
    ],
  },

  "record-a-manual-payment": {
    title: "Enregistrer un paiement comptant, par chèque ou par virement Interac",
    summary:
      "Comment inscrire un paiement qui n'est pas passé par Stripe, ce que ça change sur la facture, et pourquoi il ne porte aucuns frais.",
    updated: "2026-09-12",
    intro: [
      "Tous les clients ne paient pas par carte. Quand l'argent est arrivé par virement Interac, par chèque ou comptant, vous l'enregistrez vous-même sur la facture pour que le solde, les tuiles, le tableau de bord et les rappels le sachent. Un paiement enregistré est un vrai paiement : la facture passe à **Payée** dès que le solde tombe à zéro et la tâche de relance se ferme d'elle-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Enregistrer un paiement** est le bouton vert sur toute facture avec un solde dû. Il enregistre contre la version actuelle de la facture, vérifie le montant par rapport à ce qui reste dû, et refuse un doublon tapé deux fois coup sur coup. Il n'envoie rien au client ni à personne de votre équipe — vous êtes sur la page en train de le faire, alors une notification serait du bruit." },
        ],
      },
      {
        id: "how-to-record",
        heading: "Comment enregistrer un paiement",
        blocks: [
          { steps: [
            "Ouvrez la facture et appuyez sur **Enregistrer un paiement**.",
            "Tapez le montant. Le texte indicatif montre le plafond : **Montant (jusqu'à 2 260,00 $)**. Un chiffre au-dessus du solde est refusé, en anglais : « That's more than the … still owing on this invoice. »",
            "Choisissez le mode : **Comptant**, **Virement Interac** ou **Chèque**.",
            "Ajoutez des **Notes (facultatif)** — le numéro du chèque, la référence du virement.",
            "Appuyez sur **Enregistrer**. Les totaux se mettent à jour, le bandeau lit **Payée en totalité — 2 260,00 $ reçus.** si ça règle tout, et la ligne apparaît sous **Historique des paiements** avec la date du jour et le mode.",
          ] },
          { note: "Un paiement partiel est possible. La facture reste **Envoyée**, le bandeau lit **500,00 $ reçus sur 2 260,00 $. 1 760,00 $ restent dus.** avec **Relancer le paiement** à côté, et la liste montre le solde avec **Payé 500,00 $** en dessous." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Ce que ça change",
        blocks: [
          { bullets: [
            "**Le solde** — recalculé à partir de chaque paiement de la famille de factures, net de tout remboursement ou litige déjà enregistré.",
            "**Le statut** — **Payée** quand plus rien n'est dû et que quelque chose a été reçu; la date de paiement est apposée à ce moment.",
            "**La tâche de relance** — « Follow up payment for INV-… » est résolue une fois le solde réglé.",
            "**Le journal d'activité** — « Recorded a cash payment of 500 on invoice INV-… ».",
            "**Aucuns frais** — un paiement manuel ne montre ni frais de traitement ni net déposé; l'export laisse ces cellules vides plutôt que d'écrire 0,00. Voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]].",
          ] },
          { warning: "Il n'y a pas d'annulation d'un paiement enregistré depuis cet écran. Tapez le montant depuis le relevé bancaire, pas de mémoire, et servez-vous du champ de notes pour la référence." },
        ],
      },
      {
        id: "who-can-record",
        heading: "Qui peut enregistrer un paiement",
        blocks: [
          { p: "Enregistrer un paiement demande l'interrupteur **Collect payments** (encaisser des paiements), pas seulement le niveau sur les factures. Dans les profils, c'est le **Manager**, les administrateurs et le propriétaire. Un **Dispatcher** peut émettre et envoyer des factures, mais le serveur refuse son paiement avec un message « collect payments » — le bouton est sur la page, l'API est le contrôle." },
        ],
      },
    ],
    faq: [
      { q: "Le client a payé des frais de visite à la réservation. Puis-je les créditer?", a: "Oui. Quand des frais de réservation ont été payés, la facture montre une carte **Crédit de frais de visite** avec **Créditer sur la facture**; le crédit apparaît dans l'historique des paiements comme crédit de frais de visite et réduit le solde. Voir [[booking-fees-and-visit-deposits|Frais de réservation et acomptes de visite]]." },
      { q: "Puis-je enregistrer un paiement par carte pris sur mon propre terminal?", a: "Pas depuis cette boîte de dialogue — elle offre comptant, virement Interac et chèque. Les paiements par carte via FieldQuo passent par Stripe et s'enregistrent d'eux-mêmes; une carte prise ailleurs est un mode que l'import des chantiers passés utilise, pas cet écran." },
      { q: "Le client reçoit-il un reçu?", a: "Pas pour un paiement manuel. S'il en veut un, **Renvoyer** expédie la facture par courriel avec le paiement listé et le solde à zéro." },
    ],
  },

  "how-clients-pay-online": {
    title: "Comment les clients paient en ligne",
    summary:
      "Le chemin du bouton Payer dans le courriel jusqu'à l'argent dans votre banque : le portail, Stripe Checkout, avec quoi le client peut payer, et ce que FieldQuo enregistre quand le paiement arrive.",
    updated: "2026-09-12",
    intro: [
      "Une fois Stripe connecté et activé, chaque courriel de facture porte **Payer en ligne**. Le client arrive sur son portail, voit le solde dans votre couleur de marque, appuie sur **Payer 2 260,00 $** — **Payer 2 260,00 $ par carte** ou **Payer 2 260,00 $ depuis un compte bancaire** quand votre compte Stripe peut accepter les paiements bancaires — et paie sur la page de paiement hébergée par Stripe. FieldQuo ne voit jamais la carte, ne détient jamais l'argent, et enregistre le paiement dès que Stripe le confirme.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le client n'a besoin ni de compte ni de mot de passe. Le lien dans le courriel est son portail, lié à un jeton privé, et la page de la facture y montre le même document que vous voyez — portée, totaux, paiements reçus, modalités — avec un seul gros chiffre : **Solde dû**, ou l'étiquette de l'étape quand un calendrier de paiement demande une part. Une facture réglée lit **Payée en totalité** et n'offre aucun bouton." },
          { p: "Le débit est créé au nom de votre entreprise, alors c'est votre nom qui figure sur le relevé de carte du client, et l'argent atterrit dans votre compte Stripe puis dans votre banque. Voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]] pour ce qui est retenu sur chaque paiement." },
        ],
      },
      {
        id: "the-clients-steps",
        heading: "Ce que fait le client",
        blocks: [
          { steps: [
            "Il ouvre le courriel de la facture et appuie sur **Payer en ligne** (ou, dans le portail, ouvre la facture depuis la liste).",
            "Il vérifie le chiffre — le solde, ou l'étape demandée (un acompte, un versement) — et appuie sur **Payer … par carte**, ou sur **Payer … depuis un compte bancaire** quand ce second bouton est là.",
            "Il paie sur Stripe Checkout : carte, plus **Affirm** en paiement échelonné quand vous l'avez activé et que le montant est entre 50 $ et 30 000 $ en CAD ou en USD. Un paiement bancaire est un débit préautorisé ponctuel (Canada) ou un débit ACH (É.-U.) sur la page de Stripe, qui vérifie le compte automatiquement quand la banque le permet.",
            "Il revient au portail. Un paiement par carte apparaît reçu tout de suite, avec le nouveau solde; un paiement bancaire lit **Paiement bancaire en attente** pendant 3 à 5 jours ouvrables, puis payé — ou **Le paiement bancaire a échoué**, avec la raison donnée par Stripe, le solde toujours dû et le bouton carte toujours offert.",
          ] },
          { note: "**Payer depuis un compte bancaire** n'apparaît qu'une fois que Stripe a activé le débit bancaire sur votre compte — FieldQuo le demande pour vous à la connexion, et **Paramètres → Paiements** dit où vous en êtes (**Les clients peuvent payer les factures par carte ou depuis un compte bancaire**). Les frais de réservation restent par carte seulement. Les plans de service gardent leur mandat permanent, signé une fois — voir [[service-plan-bank-debit-mandates|Plans de service payés par débit bancaire]]. Les modes hors ligne imprimés sur la ligne « Modes de paiement acceptés » de la facture — comptant, virement électronique, chèque — se cochent sous **Paramètres → Paiements → Modes de paiement que vous acceptez**." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "Ce que FieldQuo enregistre quand le paiement arrive",
        blocks: [
          { bullets: [
            "**Une ligne de paiement** avec la date, le mode (**Card**, ou le débit bancaire — l'historique nomme les modes en anglais), le montant, et en dessous **frais carte 68,10 $ · déposé 2 191,90 $** — pour un paiement bancaire de 5 000 $, **frais débit bancaire 5,00 $ · déposé 4 995,00 $**.",
            "**Le solde et le statut** — recalculés sur chaque paiement; **Payée** quand il ne reste rien, avec une date de paiement et « via Stripe » sur le bandeau.",
            "**Une notification** — **Facture payée** envoie un courriel à toute personne ayant un rôle de propriétaire ou d'administrateur, activée par défaut sous **Paramètres → Notifications**.",
            "**La tâche de relance** se ferme, et l'argent dû et l'échelle des comptes clients du tableau de bord laissent tomber la facture.",
            "**Idempotence** — Stripe peut livrer la même confirmation deux fois; la seconde est ignorée, alors un paiement n'est jamais enregistré en double.",
          ] },
        ],
      },
      {
        id: "when-there-is-no-pay-button",
        heading: "Quand il n'y a pas de bouton Payer",
        blocks: [
          { p: "Si Stripe n'est pas connecté, ou est connecté mais n'a pas encore activé les débits, le courriel dit plutôt **Consulter votre facture**, et le portail montre « Veuillez nous contacter pour organiser le paiement. » là où serait le bouton. La page de la facture vous prévient aussi : **Stripe n'est pas encore connecté, alors le courriel leur demande de vous contacter au lieu d'offrir un paiement par carte. Terminez la configuration dans Paramètres → Paiements.** Voir [[connect-stripe-and-get-verified|Connecter Stripe et se faire vérifier]]." },
          { p: "Un paiement est créé pour le montant dû au moment où le client appuie sur Payer, plafonné au solde réel — alors un client qui ouvre un vieux courriel après un paiement partiel se voit demander le reste, jamais le chiffre d'origine. Une facture sans rien de dû refuse carrément de démarrer un paiement." },
        ],
      },
    ],
    faq: [
      { q: "Le client peut-il payer une partie de la facture?", a: "Seulement quand un calendrier de paiement demande une étape — le bouton Payer demande alors cette part. Sinon, le bouton demande le solde complet. Un paiement partiel reçu autrement s'enregistre à la main." },
      { q: "FieldQuo prend-il une commission?", a: "Les frais de traitement sont de 3 % + 30 ¢ sur un paiement par carte et de 1 % + 40 ¢ plafonnés à 5 $ sur un débit bancaire canadien, retenus avant que l'argent atteigne votre banque et affichés sur la ligne de paiement. Rien d'autre, et aucuns frais mensuels." },
      { q: "Le client a payé mais la facture dit encore Envoyée.", a: "Stripe confirme un paiement par carte à FieldQuo quelques secondes après le paiement. Un paiement bancaire est différent : la facture montre un paiement bancaire en attente pendant 3 à 5 jours ouvrables, et c'est normal. Si un paiement par carte reste impayé, vérifiez le tableau de bord Stripe via **Gérer dans Stripe** — un paiement qui est là mais pas ici est à signaler au soutien, avec le numéro de facture." },
      { q: "Peuvent-ils payer depuis la soumission à la place?", a: "Les acomptes sur une soumission ont leur propre parcours — voir [[deposits-on-quotes|Acomptes sur les soumissions]]. La facture est ce contre quoi le solde est payé." },
    ],
  },

  "connect-stripe-and-get-verified": {
    title: "Connecter Stripe et se faire vérifier",
    summary:
      "Paramètres → Paiements, étape par étape : Connecter avec Stripe, ce que la page montre pendant que Stripe vérifie vos renseignements, et ce que Actif, Suspendu et Retenu veulent dire pour votre argent.",
    updated: "2026-09-12",
    intro: [
      "Les paiements en ligne passent par un compte Stripe au nom de votre entreprise. **Paramètres → Paiements** le crée, vous envoie sur les pages sécurisées de Stripe pour le remplir, puis vous dit — en mots clairs — si Stripe encaisse déjà les cartes pour vous et s'il verse à votre banque. FieldQuo ne voit ni ne conserve jamais vos coordonnées bancaires; cette information va directement à Stripe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'en-tête de la page lit **Paiements — Connectez Stripe pour que vos clients puissent payer les factures en ligne, directement dans votre compte bancaire.** La première carte est la connexion elle-même, dans l'un de quatre états : pas connecté, en cours, en vérification, ou **Stripe connecté · Actif**. En dessous se trouvent la carte **Frais de traitement**, la carte **Virement instantané**, **Votre compte Stripe** et l'interrupteur **Proposer le paiement échelonné (Affirm)**." },
        ],
      },
      {
        id: "how-to-connect",
        heading: "Comment connecter",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements**. La carte lit **Pas encore connecté — Stripe gère le traitement réel des paiements — vous saisirez vos coordonnées bancaires sur la page sécurisée de Stripe, pas ici.**",
            "Appuyez sur **Connecter avec Stripe**. FieldQuo crée un compte Express pour votre entreprise et vous envoie dans l'inscription de Stripe.",
            "Remplissez ce que Stripe demande — les renseignements de l'entreprise, l'identité, un compte bancaire pour les versements — et acceptez les conditions de Stripe. Voir [[what-stripe-asks-for-and-why|Ce que Stripe demande, et pourquoi]].",
            "Vous revenez sur **Paramètres → Paiements**, qui relit le compte chez Stripe. Si vous êtes parti en cours de route, la carte lit **Stripe a encore besoin de quelques éléments** et les liste, avec **Terminer la configuration** et **Je l'ai déjà fait**.",
            "Une fois tout fourni, la carte lit **Stripe examine vos renseignements** avec **Vérifier à nouveau**. Quand Stripe active les débits, elle devient **Stripe connecté · Actif** et chaque courriel de facture gagne un bouton **Payer en ligne**.",
          ] },
          { figure: "harness:settings-payments", caption: "Paramètres → Paiements une fois vérifié — Stripe connecté · Actif, Gérer dans Stripe, Déconnecter, et Votre compte Stripe avec les deux interrupteurs à Activé et rien en attente." },
        ],
      },
      {
        id: "the-two-switches",
        heading: "Encaisser et être payé sont deux interrupteurs",
        blocks: [
          { p: "**Votre compte Stripe** montre **Ce que Stripe a activé** : **Encaissement par carte : Activé/Désactivé** et **Versements à votre banque : Activé/Suspendu**. Ils sont distincts. Stripe peut continuer d'accepter les cartes de vos clients pendant que les versements sont en pause — l'argent est encaissé et retenu par Stripe, pas perdu." },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements avec les versements suspendus — l'avis ambre « Stripe vérifie votre compte », versements Suspendu, et « Ce que Stripe attend encore : Rien de votre part. »" },
          { table: {
            head: ["Ce que dit la page", "Ce qui se passe", "Quoi faire"],
            rows: [
              ["**Stripe vérifie votre compte**", "Vous avez tout envoyé; Stripe le vérifie. Les versements sont en pause, d'habitude un jour, parfois deux ou trois. Les paiements de vos clients continuent de passer.", "Rien. Renvoyer les documents n'accélérera rien."],
              ["**Stripe retient votre argent**", "Les débits sont activés mais les versements sont coupés parce que Stripe a encore besoin de quelque chose de vous. **Raison de Stripe :** est imprimée en dessous, en mots clairs.", "Appuyez sur **Gérer dans Stripe** et terminez ce qu'il demande. Voir [[payouts-held-or-under-review|Versements retenus ou en vérification]]."],
              ["**Stripe a encore besoin de quelques éléments**", "L'inscription est inachevée; les débits sont coupés, donc pas encore de bouton Payer.", "**Terminer la configuration**, ou **Je l'ai déjà fait** si vous avez terminé du côté de Stripe et que FieldQuo n'a pas suivi."],
            ],
          } },
        ],
      },
      {
        id: "the-other-controls",
        heading: "Les autres contrôles de la page",
        blocks: [
          { bullets: [
            "**Gérer dans Stripe** ouvre votre tableau de bord Express dans un nouvel onglet : versements, documents, coordonnées bancaires, soutien. Stripe envoie un code de connexion au **Courriel de connexion** affiché sur la page.",
            "**Copier** à côté de l'**Identifiant de compte Stripe** (il commence par acct_) — ce que Stripe utilise pour retrouver votre compte quand vous le contactez. Visible par le propriétaire seulement.",
            "**Déconnecter** dissocie Stripe de FieldQuo : les clients ne peuvent pas payer en ligne tant que vous ne reconnectez pas. Ça ne supprime ni ne ferme votre compte Stripe et ne change rien à votre historique de versements.",
            "**Proposer le paiement échelonné (Affirm)** laisse les clients répartir une facture au moment de payer pendant que vous êtes payé en entier, d'avance. Offert sur les factures entre 50 $ et 30 000 $ en USD ou en CAD, et vous devez d'abord activer Affirm dans votre tableau de bord Stripe — voir [[pay-over-time-financing|Financement par paiement échelonné]].",
            "**Frais de traitement** et **Virement instantané** sont expliqués dans [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]] et [[instant-payouts|Virements instantanés]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "**Paramètres → Paiements** est réservé au propriétaire et aux administrateurs — la ligne est masquée pour tous les autres et les routes derrière les refusent. L'identifiant de compte et le courriel de connexion sont encore plus restreints : le propriétaire seulement, parce que ce sont les deux valeurs qui permettent à quelqu'un de dire à Stripe « ce compte est à moi »." },
        ],
      },
    ],
    faq: [
      { q: "Combien de temps prend la vérification?", a: "D'habitude quelques minutes, parfois un jour ou deux. La page dit **Stripe examine vos renseignements** pendant ce temps; **Vérifier à nouveau** relit le compte." },
      { q: "J'ai déjà un compte Stripe. Puis-je l'utiliser?", a: "Pas aujourd'hui. FieldQuo crée un compte Express pour l'entreprise et lie celui-là; il n'y a aucun moyen de rattacher un compte existant." },
      { q: "Les clients paient mais rien n'arrive dans ma banque.", a: "Regardez **Versements à votre banque** sur cette page. **Suspendu** avec un avis de vérification veut dire attendre; **Suspendu** avec **Stripe retient votre argent** veut dire ouvrir **Gérer dans Stripe** et terminer ce qui est listé." },
    ],
  },

  "what-stripe-asks-for-and-why": {
    title: "Ce que Stripe demande, et pourquoi",
    summary:
      "Les documents et renseignements que Stripe exige avant de verser, dans les mots que FieldQuo utilise sur la page Paiements, et ce que veut dire chacune des raisons de restriction de Stripe.",
    updated: "2026-09-12",
    intro: [
      "Avant que Stripe verse de l'argent dans un compte bancaire, il doit savoir à qui appartient l'entreprise, qui la détient, et où va l'argent — les mêmes vérifications qu'une banque fait quand vous ouvrez un compte. Les noms que Stripe leur donne sont des clés machine comme « company.verification.document »; **Paramètres → Paiements** traduit chacune en une phrase, pour que **Ce que Stripe attend encore** soit une liste sur laquelle vous pouvez agir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La liste sur la page Paiements combine ce que Stripe dit **exigible maintenant** et ce qui est **en retard**. Tout ce que Stripe est encore en train de vérifier est laissé de côté exprès — vous dire de « fournir plus d'information » pendant que Stripe examine ce que vous avez déjà envoyé, c'est comme ça que les gens soumettent le même document quatre fois. Quand il y a une date limite, la page imprime **Date limite de Stripe : date**; la plupart des comptes n'en ont pas, et FieldQuo n'en invente jamais." },
          { figure: "live:app-settings-payments", caption: "Votre compte Stripe — l'identifiant de compte, le courriel de connexion, les deux interrupteurs, et « Ce que Stripe attend encore »." },
        ],
      },
      {
        id: "what-it-asks-for",
        heading: "Ce qu'il demande",
        blocks: [
          { table: {
            head: ["Ce que dit la page", "Pourquoi Stripe le veut"],
            rows: [
              ["**A bank account for payouts** — un compte bancaire pour les versements", "Là où va l'argent. Sans lui, Stripe peut encaisser et retenir, mais jamais verser."],
              ["**Accepting Stripe's terms of service** — accepter les conditions d'utilisation de Stripe", "Le compte est le vôtre, sous l'entente de Stripe, pas celle de FieldQuo."],
              ["**A photo of your ID** / **A second piece of ID** — une photo de votre pièce d'identité, puis une seconde pièce", "L'identité de la personne qui ouvre le compte — la vérification standard de connaissance du client."],
              ["**Your business number (BN)** — votre numéro d'entreprise", "L'identité fiscale de l'entreprise à qui l'argent est versé."],
              ["**A document verifying the business (incorporation papers, CRA notice, or a registry search result)** — un document qui prouve l'existence de l'entreprise", "La preuve que l'entreprise existe et correspond au nom sur le compte."],
              ["**Confirmation that you've listed every director** / **everyone owning 25% or more** / **executives** — la confirmation que tous les administrateurs, les propriétaires de 25 % ou plus et les dirigeants sont listés", "Les régulateurs exigent que les personnes derrière une entreprise soient nommées."],
              ["**Your industry** / **A description of what you sell** / **A business website or product description** — votre secteur, ce que vous vendez, un site Web ou une description", "À quoi correspondent les débits sur les cartes de vos clients. Un site Web est facultatif — une description suffit."],
              ["**A customer support phone number** — un numéro de téléphone de service à la clientèle", "Ce qui apparaît à côté de votre nom sur le relevé de carte d'un client, pour qu'un titulaire vous appelle plutôt que de contester le débit."],
            ],
          } },
          { note: "Ces libellés s'affichent en anglais, quelle que soit la langue de votre interface. Une ligne qui commence par **A director or owner:** est une exigence sur une personne précise que Stripe a au dossier — généralement sa pièce d'identité ou son adresse — plutôt que sur l'entreprise." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "Les raisons de Stripe, en mots clairs",
        blocks: [
          { p: "Quand Stripe restreint un compte, il y joint une raison. La page Paiements l'imprime sous **Raison de Stripe :** ou sous l'avis de versements retenus, traduite depuis la clé de Stripe en une phrase — en anglais, quelle que soit la langue de votre interface :" },
          { bullets: [
            "**Stripe is waiting on information that is now overdue.** — un élément de la liste a dépassé sa date limite. Terminez-le dans **Gérer dans Stripe**.",
            "**Stripe is still checking what you sent. There is nothing to do.** — la vérification de ce que vous avez envoyé est en cours; il n'y a rien à faire de votre côté pour le moment.",
            "**Stripe is reviewing the account.** / **Stripe is reviewing a possible sanctions-list match.** — un examen manuel du côté de Stripe, sur le compte ou sur une possible correspondance avec une liste de sanctions. Attendez, ou demandez à Stripe depuis votre tableau de bord.",
            "**Stripe closed the account …** pour fraude présumée (« for suspected fraud »), pour violation des conditions d'utilisation (« for a terms of service violation ») ou après une correspondance avec une liste de sanctions (« after a sanctions-list match ») — des décisions que seul Stripe peut revoir, depuis votre tableau de bord.",
            "**FieldQuo paused this account.** — rare, et le soutien vous aura contacté.",
            "**Stripe has restricted the account and hasn't said why.** — Stripe a restreint le compte sans donner de raison; demandez-lui pourquoi, en citant l'identifiant de votre compte dans la demande.",
          ] },
        ],
      },
      {
        id: "where-to-settle-it",
        heading: "Où régler ça",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements** et lisez **Ce que Stripe attend encore**.",
            "Appuyez sur **Gérer dans Stripe** (ou **Terminer la configuration** tant que l'inscription est inachevée). Le tableau de bord de Stripe rassemble les éléments en attente dans un bandeau et vous mène à chacun.",
            "Revenez et appuyez sur **Vérifier à nouveau** ou **Je l'ai déjà fait**. FieldQuo relit le compte et met à jour les interrupteurs.",
            "Si le tableau de bord ne peut vraiment pas le régler, le soutien de Stripe se joint depuis ce tableau de bord une fois connecté. Donnez-lui l'**Identifiant de compte Stripe** de la page — c'est ce qui identifie votre compte chez eux, pas le nom de votre entreprise ni votre courriel.",
          ] },
          { tip: "Le soutien FieldQuo peut voir la même page d'état en lecture seule et vous demandera aussi l'identifiant de compte. Il ne peut ni téléverser un document ni accepter des conditions à votre place — ça vous revient, sur les pages de Stripe." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Stripe veut-il ma pièce d'identité alors que l'entreprise est incorporée?", a: "Parce qu'une personne ouvre le compte. Stripe vérifie le représentant autant que l'entreprise, et peut demander séparément les administrateurs et les propriétaires de 25 % ou plus." },
      { q: "Les paiements de mes clients vont-ils s'arrêter pendant qu'un élément est en attente?", a: "Pas une fois les débits activés. **Encaissement par carte** et **Versements à votre banque** sont deux interrupteurs distincts; l'effet habituel d'un élément en attente, c'est des versements en pause, avec l'argent gardé en sécurité par Stripe jusqu'à ce que ça se règle." },
      { q: "J'ai envoyé un document et la liste le montre encore.", a: "La page ne retire un élément que lorsque Stripe le marque reçu. Appuyez sur **Vérifier à nouveau**; s'il est maintenant en vérification, l'étiquette devient **Rien de votre part. Stripe vérifie ce que vous avez déjà envoyé; le renvoyer n'accélérera rien.**" },
    ],
  },
};
