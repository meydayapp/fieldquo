// content/help/fr/leads-and-quotes-3.js
//
// Partie 3 de la catégorie « leads-and-quotes » en français (voir le
// composeur, leads-and-quotes.js). Mêmes slugs, mêmes sections, mêmes blocs
// et mêmes figures que content/help/en/leads-and-quotes-3.js — le script
// scripts/check-help-centre.mjs compare la structure. Les mots à l'écran sont
// les chaînes du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "edit-a-sent-quote": {
    title: "Modifier une soumission déjà envoyée",
    summary:
      "Une soumission envoyée se modifie encore sur place — le lien que le client détient affiche la nouvelle version, et Renvoyer expédie une copie à jour — jusqu'à ce que le client accepte ou refuse.",
    updated: "2026-09-12",
    intro: [
      "Une soumission n'est pas figée au moment où elle part. Tant que le client n'y a pas répondu, une soumission envoyée se modifie exactement comme un brouillon : même générateur, mêmes lignes, même bouton Enregistrer les modifications. Ce qui change, c'est ce que le client voit — le lien dans sa boîte de réception ouvre la soumission en direct, donc une modification lui est visible dès que vous l'enregistrez, que vous renvoyiez un courriel ou non.",
      "Une fois que le client a accepté ou refusé, les lignes se verrouillent. Cet article couvre les deux états, et ce que fait Renvoyer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Ouvrez la soumission et appuyez sur **Modifier**. Le même générateur que vous avez utilisé pour la rédiger s'ouvre, en mode modification, avec les lignes enregistrées déjà en place. Les lignes enregistrées se modifient comme des lignes — elles ne sont pas recalculées à partir de votre grille de tarifs, donc une soumission envoyée le mois dernier garde les prix du mois dernier même si vous avez augmenté un tarif depuis." },
          { p: "Le statut de la soumission reste **Envoyée** après une modification. FieldQuo ne crée pas une deuxième version d'une soumission : une modification remplace ce qui s'y trouvait, et le lien d'approbation que le client a déjà affiche le remplacement. (Les factures sont différentes — une facture modifiée garde une copie de ce qui a été envoyé. Voir [[edit-an-invoice-after-sending|Modifier une facture après l'envoi]].)" },
        ],
      },
      {
        id: "how-to",
        heading: "Comment modifier une soumission envoyée",
        blocks: [
          { steps: [
            "Ouvrez la soumission depuis **Soumissions** et appuyez sur **Modifier**.",
            "Changez les lignes, le rabais, la taxe, la date **Valide jusqu'au**, les notes ou le texte **Ce qui suit**.",
            "Appuyez sur **Enregistrer les modifications**. La soumission garde son statut **Envoyée** et son lien client.",
            "Si le client doit le savoir, revenez à la soumission et appuyez sur **Renvoyer** — le courriel contient un PDF fraîchement généré des lignes actuelles.",
          ] },
          { figure: "live:app-quotes-new", caption: "Le générateur de soumission — Modifier ouvre ce même écran avec les lignes de la soumission déjà remplies." },
          { note: "**Renvoyer** remet le compteur à zéro. Une nouvelle date d'envoi est inscrite, donc l'âge affiché dans la liste des soumissions et le délai avant toute règle de relance **Soumission envoyée, sans réponse** repartent tous deux de ce moment." },
        ],
      },
      {
        id: "what-locks",
        heading: "Ce qui se verrouille, et quand",
        blocks: [
          { table: {
            head: ["Statut de la soumission", "Lignes", "Notes, échéance, ce qui suit"],
            rows: [
              ["Brouillon ou Envoyée", "Modifiables", "Modifiables"],
              ["Acceptée", "Verrouillées — le générateur affiche les lignes en lecture seule et un avertissement que le client a accepté des montants différents", "Modifiables"],
              ["Refusée", "Verrouillées", "Modifiables"],
            ],
          } },
          { p: "Sur une soumission tranchée, le générateur le dit clairement : le client s'est déjà prononcé sur cette soumission, ses lignes ne peuvent plus être modifiées; les notes, la date d'échéance et le texte « Ce qui suit » s'enregistrent toujours. Le serveur refuse un changement de ligne sur une soumission tranchée même si un écran périmé tente d'en envoyer un." },
          { warning: "Modifier les montants d'une soumission **Acceptée** n'annule pas l'acceptation. Le générateur vous avertit : modifier le prix maintenant signifie que le client a accepté des montants différents de ceux au dossier. Si quelque chose d'important change après l'acceptation, la voie honnête est une nouvelle soumission ou une facture modifiée, pas une retouche silencieuse." },
        ],
      },
      {
        id: "two-people",
        heading: "Quand deux personnes modifient la même soumission",
        blocks: [
          { p: "Le générateur se souvient de la version qu'il a ouverte. Si un collègue a enregistré la soumission pendant que votre écran était ouvert, votre enregistrement est retenu et une bannière vous le dit — rien de ce que vous avez tapé n'est perdu, et rien n'est écrasé dans le dos de qui que ce soit. Vous pouvez ouvrir la version plus récente, ou enregistrer la vôtre par-dessus, délibérément." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut modifier",
        blocks: [
          { p: "Toute personne dont la grille d'accès place Soumissions à **View, create, and edit** ou plus : les profils Estimateur, Répartiteur et Gestionnaire, et chaque propriétaire et administrateur. L'équipe de chantier n'a aucun accès aux soumissions. Réassigner une soumission à quelqu'un d'autre est une permission distincte, détenue par le Répartiteur, le Gestionnaire, le propriétaire et l'administrateur." },
        ],
      },
    ],
    faq: [
      { q: "Le client voit-il ma modification si je n'appuie pas sur Renvoyer ?", a: "Oui, s'il ouvre son lien — il affiche la soumission en direct. Renvoyer sert à lui mettre sous les yeux un PDF à jour et un nouveau courriel." },
      { q: "Puis-je récupérer l'ancienne version ?", a: "Non. Une soumission se modifie sur place et FieldQuo n'en garde aucune copie antérieure. S'il vous faut une trace de ce qui a été envoyé, téléchargez le PDF avant de modifier." },
      { q: "Pourquoi le bouton Envoyer manque-t-il sur cette soumission ?", a: "Il n'apparaît que tant que la soumission est Brouillon ou Envoyée. Sur une soumission Acceptée, l'étape suivante est la facture; sur une soumission saisie comme chantier passé, rien n'est jamais envoyé." },
    ],
  },

  "convert-a-quote-to-a-job": {
    title: "Ce qui se passe quand une soumission est acceptée",
    summary:
      "Une soumission acceptée devient un chantier en attente d'une date, une facture en brouillon, une tâche pour le planifier et un prospect Gagné — que le client ait cliqué sur le lien ou que vous l'ayez consigné à la main.",
    updated: "2026-09-12",
    intro: [
      "Il n'y a pas de bouton « Convertir en chantier », parce que vous n'avez jamais besoin d'en appuyer un. Dès qu'une soumission est acceptée — par le client sur son lien, ou par vous sur l'écran **Faire approuver cette soumission** — FieldQuo crée tout ce dont l'étape suivante a besoin, une fois, et jamais deux.",
      "Cet article énumère exactement ce qui est créé, où ça atterrit, et le seul cas où rien ne se passe, volontairement.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'acceptation voulait autrefois dire des choses différentes selon la porte par laquelle elle arrivait : un client cliquant sur le lien créait un chantier et une facture, un membre du personnel consignant une acceptation au téléphone ne créait rien. C'était un bogue, corrigé à la racine — les deux portes exécutent le même code, donc un oui au téléphone et un oui sur le lien laissent l'entreprise dans le même état." },
          { p: "Tout ce qui suit est fait au mieux et sans doublon : un double clic, un webhook réessayé ou une deuxième acceptation après que la première a déjà roulé ne produiront pas un deuxième chantier ni une deuxième facture." },
        ],
      },
      {
        id: "what-is-created",
        heading: "Ce qui est créé",
        blocks: [
          { table: {
            head: ["Créé", "Où ça atterrit", "Détails"],
            rows: [
              ["Un chantier", "**Chantiers**, statut **À planifier**", "Intitulé avec le type de soumission, le nom du client et le numéro de la soumission, lié à la soumission. Un chantier par soumission."],
              ["Une facture en brouillon", "**Factures**", "Les lignes et les photos de la soumission copiées — une facture reflète la soumission dont elle vient. Une facture principale par soumission."],
              ["Une tâche", "**À faire**, priorité élevée", "Rappelle à quelqu'un de planifier le chantier. Aucune date d'échéance n'est inventée, parce que FieldQuo ne connaît pas vos délais."],
              ["Le statut du prospect", "**Prospects**, marqué **Gagné**", "Seulement si la soumission a été convertie depuis un prospect. Une soumission rédigée de zéro n'a aucun prospect à faire avancer."],
              ["Les étapes du calendrier de paiement", "La facture", "Seulement si votre entreprise a un calendrier de paiement sous Paramètres → Profil de l'entreprise. L'étape du dépôt est demandée tout de suite; les étapes suivantes attendent les dates du chantier."],
              ["La date de la décision", "La soumission", "Inscrite une seule fois, la première fois que la soumission est acceptée, pour ne jamais bouger lors d'une modification ultérieure."],
            ],
          } },
          { figure: "live:app-jobs", caption: "Chantiers — une soumission acceptée arrive ici sous À planifier, prête à être mise à l'horaire." },
        ],
      },
      {
        id: "two-doors",
        heading: "Les deux façons d'accepter une soumission",
        blocks: [
          { bullets: [
            "**Le client, sur son lien.** Il approuve sur la page vers laquelle pointe le courriel de soumission, avec une signature si vous en demandez une. Les propriétaires et administrateurs reçoivent un courriel, le client reçoit le PDF signé, et les étapes ci-dessus s'exécutent. Voir [[online-approval-and-signature|Approbation en ligne et signature]].",
            "**Vous, sur Faire approuver.** Ouvrez la soumission, appuyez sur **Faire approuver**, puis sous **Consigner leur réponse** appuyez sur **Ils l'ont approuvée**. Aucun courriel ne part vers le client — vous lui avez déjà parlé — mais le chantier, la facture et la tâche sont créés exactement de la même manière. **Ils l'ont refusée** consigne un refus et, au choix, la raison.",
          ] },
          { tip: "Le journal d'activité nomme ce que chaque acceptation a produit — le chantier créé, prêt à planifier, et le numéro de la facture mise en brouillon. Cette entrée est rédigée en anglais." },
        ],
      },
      {
        id: "convert-to-invoice",
        heading: "Le bouton Convertir en facture",
        blocks: [
          { p: "Sur une soumission acceptée qui n'a pas encore de facture, la page de la soumission affiche **Convertir en facture**. Il existe comme solution de repli pour le cas rare où la facture automatique n'a pas pu être créée. L'appuyer alors que la facture existe déjà renvoie cette facture au lieu d'en créer une autre." },
        ],
      },
      {
        id: "nothing-happens",
        heading: "Quand rien ne se passe, volontairement",
        blocks: [
          { p: "Une soumission saisie comme **chantier passé** — depuis l'import d'historique de l'écran Chantiers — porte déjà son chantier et sa facture payée avec les vraies dates. Changer son statut ne déclenche aucune étape, n'envoie aucune demande de dépôt et ne demande à personne de planifier des travaux faits en 2024." },
          { p: "Une soumission refusée ne crée rien. Elle consigne quand, et pourquoi si quelqu'un l'a dit — la raison est la moitié qui change ce que vous faites ensuite." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut consigner une acceptation",
        blocks: [
          { p: "Consigner une décision sur l'écran Faire approuver est une modification de soumission, donc il faut Soumissions à **View, create, and edit** ou plus — Estimateur, Répartiteur, Gestionnaire, propriétaire ou administrateur. Le client n'a besoin de rien d'autre que son lien." },
        ],
      },
    ],
    faq: [
      { q: "Le chantier n'a pas de date. Est-ce un problème ?", a: "Non — c'est tout le sens de À planifier. Ouvrez-le depuis Chantiers ou depuis la tâche et réservez la première visite. Voir [[the-job-page|La page du chantier]]." },
      { q: "Puis-je accepter une soumission sans créer de facture ?", a: "Pas par la voie de l'acceptation. La facture en brouillon est créée en même temps que le chantier; vous pouvez la laisser en brouillon et la modifier avant de l'envoyer." },
      { q: "Le client a approuvé deux fois par erreur. Ai-je deux chantiers ?", a: "Non. Le chantier, la facture et la tâche sont chacun créés une seule fois par soumission, quelle que soit la porte par laquelle l'acceptation est arrivée et quel qu'en soit le nombre." },
    ],
  },

  "quotes-sent-with-no-response": {
    title: "Soumissions envoyées sans réponse",
    summary:
      "Comment la liste des soumissions fait ressortir celles que personne n'a répondues, ce qu'envoie Relancer, et comment une règle de relance les poursuit pour vous.",
    updated: "2026-09-12",
    intro: [
      "Une soumission restée à **Envoyée** est la file de relance, et FieldQuo la place en haut de la liste plutôt que de la laisser couler sous des brouillons plus récents. Cet article porte sur les trois choses que vous pouvez en faire : la lire, la relancer à la main, et laisser une règle la relancer pour vous.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Sur **Soumissions**, avec la pastille **Tous** sélectionnée, chaque soumission dont le statut est Envoyée est regroupée en haut sous l'en-tête **Soumission envoyée, sans réponse**, la plus ancienne d'abord — la soumission qui attend depuis le plus longtemps est celle que le client a le plus probablement oubliée. Tout le reste suit dans l'ordre de création." },
          { p: "Chaque rangée indique depuis combien de temps elle a été envoyée et son échéance. Une soumission dont la date **Valide jusqu'au** tombe dans les trois jours, ou est déjà passée, est mise en évidence; la phrase à côté nomme toujours la date réelle, pour que l'accent ne soit jamais la seule chose sur laquelle vous appuyer." },
          { figure: "live:app-quotes", caption: "Soumissions — les pastilles de statut, puis le groupe des envoyées sans réponse au-dessus du reste." },
          { note: "Une soumission est datée à partir du jour où elle a vraiment été envoyée par courriel. Une soumission dont le statut a été mis à Envoyée sans courriel — un prix convenu au téléphone, un document importé — n'affiche aucun âge plutôt qu'un âge inventé." },
        ],
      },
      {
        id: "follow-up-by-hand",
        heading: "Relancer à la main",
        blocks: [
          { steps: [
            "Ouvrez la soumission. Tant qu'elle est Envoyée et qu'elle a été expédiée par courriel, la barre d'actions affiche **Relancer**.",
            "Appuyez dessus et confirmez le destinataire. Le courriel de relance reprend la mise en page du courriel de soumission avec une ouverture différente, et pointe vers la même page d'approbation.",
            "La soumission enregistre la date et le nombre de relances; le journal d'activité indique qu'une relance a été envoyée.",
          ] },
          { p: "**Renvoyer** est différent : il réexpédie la soumission complète avec un PDF à jour et réinitialise la date d'envoi, donc l'âge de la soumission — et le compteur de toute règle de relance — repart de zéro." },
        ],
      },
      {
        id: "follow-up-rule",
        heading: "Laisser une règle s'en charger",
        blocks: [
          { p: "**Paramètres → Relances** envoie un gabarit un certain temps après qu'une soumission, une facture ou un chantier atteint un état. Le déclencheur pour cette file est **Soumission envoyée, sans réponse** : il se déclenche une fois que la soumission est restée à Envoyée pendant le délai sans acceptation ni refus. Le délai suggéré est de 3 jours." },
          { steps: [
            "Ouvrez **Paramètres → Relances** et appuyez sur **Nouvelle règle**.",
            "Choisissez le déclencheur **Soumission envoyée, sans réponse**, un délai en heures ou en jours, et le gabarit de courriel à envoyer (depuis **Paramètres → Modèles de courriel**).",
            "Appuyez sur **Créer la règle**. **Mettre en pause** l'arrête sans la supprimer.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Paramètres → Relances — le schéma en lecture seule tiré de vos règles, puis les règles elles-mêmes." },
          { bullets: [
            "Chaque soumission reçoit le courriel d'une règle donnée **une seule fois**.",
            "La règle s'arrête dès que le client accepte ou refuse.",
            "Les clients sans adresse courriel au dossier sont ignorés.",
            "Les soumissions saisies comme chantiers passés ne sont jamais relancées.",
            "La vérification roule chaque jour; aucune règle de relance n'envoie de texto.",
          ] },
        ],
      },
      {
        id: "who-can",
        heading: "Qui voit ceci",
        blocks: [
          { p: "La liste des soumissions est visible par quiconque a Soumissions à **View only** ou plus. Les règles de relance se créent et se mettent en pause sous Paramètres, par les propriétaires, administrateurs, Gestionnaires et Répartiteurs." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le groupe n'apparaît-il pas ?", a: "Il ne s'affiche que sur la pastille Tous, et seulement quand il y a au moins une soumission Envoyée et au moins une autre soumission. Sur la pastille Envoyée, vous regardez déjà la file." },
      { q: "L'assistant téléphonique peut-il appeler au sujet d'une soumission sans réponse ?", a: "Oui, si vous activez les rappels de soumission — une fonction distincte des courriels de relance. Voir [[quote-callbacks|Rappels de soumission]]." },
      { q: "Une relance change-t-elle le prospect ?", a: "Non. Un courriel de relance laisse le prospect derrière la soumission là où il est; seul le premier envoi fait passer un nouveau prospect à Contacté." },
    ],
  },

  "estimate-reviews": {
    title: "Révision des estimations : approuver les estimations instantanées",
    summary:
      "Chaque prix que FieldQuo a calculé pour un propriétaire attend ici qu'une personne le confirme — vous approuvez à un montant, l'ajustez, ou ouvrez la soumission — et rien ne peut être envoyé avant.",
    updated: "2026-09-12",
    intro: [
      "Une estimation instantanée est une fourchette qu'un propriétaire a vue sur votre site web ou qui a été mesurée à partir d'un appel téléphonique. Ce n'est pas une soumission tant qu'une personne responsable n'a pas regardé la propriété, les chiffres et le client, et appuyé sur **Approuver**. **Révision des estimations** est l'endroit où ça se passe, et le bouton Envoyer d'une soumission refuse de fonctionner tant que ce n'est pas fait.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'ouvre sur sa propre phrase : les estimations instantanées de votre site arrivent ici d'abord — confirmez le prix, en l'ajustant si la propriété l'exige, avant que la soumission puisse être envoyée. Dessous, une carte par estimation en attente de révision. Quand rien n'attend, il le dit." },
          { p: "C'est la barrière dont dépend toute la fonction de soumission instantanée. Le brouillon arrive avec un indicateur de révision que seul cet écran efface; une soumission qui le porte encore ne peut pas être envoyée par courriel, et l'erreur dit pourquoi : confirmez le prix dans Révision des estimations, puis envoyez." },
          { note: "**Seulement dans FieldQuo.** Un prix instantané destiné au propriétaire, avec une révision humaine obligatoire avant qu'il devienne une soumission, ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul ou ServiceTitan à aucun palier." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a sur chaque carte",
        blocks: [
          { bullets: [
            "Le nom du client (ou **Demande du site web** quand aucun n'a été donné), le numéro de la soumission et sa provenance : **Mesuré par satellite**, **Pelouse tracée sur la carte**, **Saisi par le client**, ou **Tiré d'un appel téléphonique** avec un bouton **Écouter** pour l'enregistrement.",
            "À qui elle est assignée — **Assignée à vous**, **Assignée à** un collègue, ou **Non assignée — me l'assigner**, qui la réclame en un clic.",
            "La propriété : une image satellite quand une a été capturée, la surface et la pente du toit, les carrés et les couches d'arrachage, ou la surface et le matériau saisis.",
            "**Le client a vu :** la fourchette qui lui a été montrée, et **Son budget :** s'il en a donné un — signalé **dépasse le budget** quand la fourchette le dépasse.",
            "La ventilation des lignes dont l'estimation est faite, et toute note tirée d'un appel indiquant que le client a demandé quelque chose qui n'est pas dans le montant.",
            "**Approuver à** avec la devise de l'entreprise et le total dans une case, le bouton **Approuver**, et **Ouvrir la soumission**.",
          ] },
          { figure: "live:app-estimate-reviews", caption: "Révision des estimations — une carte par estimation instantanée, avec la propriété, la fourchette que le client a vue et la case Approuver à." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment approuver une estimation",
        blocks: [
          { steps: [
            "Ouvrez **Révision des estimations** depuis la barre latérale (la rangée s'intitule **Révisions de devis**).",
            "Lisez la carte. Si le client au téléphone ou le formulaire a demandé quelque chose que le prix ne couvre pas, c'est écrit sur la carte.",
            "Laissez le total tel quel, ou tapez le montant que le chantier vaut vraiment dans **Approuver à**.",
            "Appuyez sur **Approuver**. La carte quitte la file, le total et le sous-total de la soumission deviennent le montant approuvé, et la soumission peut maintenant être envoyée.",
            "Appuyez plutôt sur **Ouvrir la soumission** si vous voulez retravailler les lignes dans le générateur d'abord — approuver ne modifie pas les lignes, seulement le total.",
          ] },
          { p: "Approuver garde une trace de ce qui a été montré au propriétaire, séparément de ce que vous avez approuvé, pour que « ce qu'il a vu » et « ce que nous avons soumissionné » ne se confondent jamais en un seul chiffre. Le journal d'activité consigne qui a approuvé et à quel montant." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut approuver",
        blocks: [
          { p: "La rangée de la barre latérale et le bouton Approuver sont réservés aux propriétaires, administrateurs, Gestionnaires et Répartiteurs — la carte le dit à tout le monde : seul un gestionnaire, un administrateur ou le propriétaire peut approuver. Approuver exige aussi Soumissions à **View, create, and edit**, parce que ça peut fixer le total. Un Estimateur bâtit des soumissions mais n'approuve pas d'estimations." },
          { p: "Une personne sans **See prices** voit la carte sans les montants et ne peut pas approuver." },
        ],
      },
    ],
    faq: [
      { q: "D'où viennent ces estimations ?", a: "De la page d'estimation instantanée de votre site web ([[instant-quotes-on-your-website|Soumissions instantanées sur votre site web]]) et des appels pris par le réceptionniste, quand l'appel contenait assez d'information pour chiffrer ([[call-to-quote|D'un appel téléphonique à une ébauche de soumission]])." },
      { q: "Puis-je changer le prix après avoir approuvé ?", a: "Oui — après l'approbation, la soumission est un brouillon ordinaire. Modifiez-la dans le générateur comme n'importe quelle autre avant de l'envoyer." },
      { q: "Le propriétaire est-il avisé quand j'approuve ?", a: "Pas par la seule approbation. Envoyez la soumission quand vous êtes prêt; si les rappels de soumission sont activés, l'assistant peut appeler à ce sujet une fois que le client a la soumission par écrit." },
    ],
  },

  "instant-quotes-on-your-website": {
    title: "Soumissions instantanées sur votre site web",
    summary:
      "Activez un métier, fixez vos tarifs et choisissez si le propriétaire voit une fourchette — chaque estimation atterrit dans Révision des estimations, et votre grille de tarifs ne quitte jamais l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Soumissions instantanées** permet à un propriétaire d'obtenir une vraie estimation de départ depuis votre site web en quelques secondes : un toit mesuré à partir de son adresse, une pelouse qu'il trace sur une carte, ou quelques chiffres qu'il tape. Le prix est calculé sur le serveur à partir des tarifs que vous fixez, montré comme une fourchette, et atterrit en brouillon dans votre file de révision avant que quoi que ce soit n'engage.",
      "Cet article est le côté réglages. Ce que voit le propriétaire est dans [[the-instant-estimate-page|La page d'estimation instantanée]], et la révision dans [[estimate-reviews|Révision des estimations]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'ouvre sur un compte en direct — **{count} en ligne sur votre lien d'estimation instantanée**, ou une note que rien n'est encore actif — et un lien **Voir ce que voient les propriétaires**. Dès qu'au moins un métier est en ligne, un extrait d'intégration apparaît sous **Ajoutez l'estimation instantanée à votre site web**; c'est un élément HTML ordinaire qui fonctionne sur Wix, Squarespace, WordPress et les pages écrites à la main." },
          { p: "Dessous, une carte par métier que FieldQuo peut chiffrer instantanément, un interrupteur **Activé** / **Désactivé** sur chacune, et une carte **Financement** à la fin. Seuls les métiers aussi activés sous **Paramètres → Services et tarifs** sont offerts; les autres sont rangés sous **Afficher {count} autres métiers que FieldQuo peut chiffrer**." },
          { note: "**Seulement dans FieldQuo.** Une estimation instantanée calculée sur le serveur à partir de votre propre grille de tarifs, avec une révision obligatoire avant qu'elle devienne une soumission, ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul ou ServiceTitan à aucun palier." },
        ],
      },
      {
        id: "trades",
        heading: "Les métiers, et comment chacun mesure",
        blocks: [
          { table: {
            head: ["Métier", "Comment le propriétaire est mesuré"],
            rows: [
              ["Toiture", "Toit mesuré automatiquement à partir de l'adresse (satellite Google) : surface en pente, pente, carrés."],
              ["Tonte de pelouse", "Le propriétaire trace la pelouse sur une carte satellite; la surface vient du contour."],
              ["Planchers époxy, crépi, revêtements de sol, peinture, comptoirs", "Le propriétaire entre la surface et choisit des options."],
              ["Refinition et resurfaçage d'armoires", "Le propriétaire entre des quantités — portes et façades de tiroirs."],
              ["Escaliers", "Le propriétaire entre le nombre de marches et choisit la construction; chiffré à la marche."],
              ["Ramassage de débris", "Le propriétaire choisit les articles à enlever; chiffré au volume avec un rabais de chargement intégré."],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Comment mettre un métier en ligne",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Soumissions instantanées** et trouvez la carte du métier.",
            "Modifiez les champs de tarif selon votre marché. Les chiffres de départ sont des valeurs typiques, pas vos prix, et rien n'est offert aux propriétaires tant que vous n'enregistrez pas.",
            "Choisissez **Ce que voit le propriétaire** (ci-dessous).",
            "Fixez **Frais minimum** et **Largeur de la fourchette (±)** — la fourchette est le prix calculé plus et moins ce pourcentage.",
            "Appuyez sur **Enregistrer et activer**. Le compte en haut augmente de un.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Paramètres → Soumissions instantanées — le compte en direct, l'extrait d'intégration, puis une carte par métier avec son interrupteur, son choix de visibilité et ses tarifs." },
          { tip: "Une carte peut être Activée sans être en ligne : s'il manque un tarif dont le calcul a besoin, la carte dit que les propriétaires ne peuvent pas encore obtenir de prix pour ce service. Cette phrase ne s'affiche que pour vous — on ne dit jamais à un propriétaire pourquoi une grille de tarifs est incomplète." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que change chaque réglage",
        blocks: [
          { bullets: [
            "**Ne pas afficher de prix** — le propriétaire soumet sa demande et on lui dit qu'une soumission s'en vient. Aucun chiffre n'est montré sur la page ni dans son courriel de confirmation. C'est le réglage par défaut.",
            "**Afficher la fourchette après l'envoi** — la fourchette se débloque en remplissant le formulaire, donc vous obtenez ses coordonnées dans tous les cas. Le choix habituel.",
            "**Afficher la fourchette immédiatement** — le chiffre apparaît avant qu'il laisse la moindre coordonnée. Attendez-vous à ce que des gens lisent le chiffre et s'en aillent.",
            "**Tranches de budget** — les quatre options montrées quand le formulaire demande son budget; fixez les trois seuils en ordre croissant, sinon les tranches standard sont utilisées.",
            "**Utiliser mes tarifs de services** — apparaît quand vos tarifs de Services et tarifs ont changé depuis l'enregistrement de la carte; il les adopte ici.",
            "**Financement** — facultatif, et FieldQuo n'offre pas de financement. Vos propres mots, ou un lien vers votre fournisseur. Si vous indiquez à la fois un taux annuel et une durée, l'estimation montre aussi une mensualité estimée selon ces conditions; laissez l'un des deux vide et aucune mensualité n'est jamais montrée.",
          ] },
          { warning: "Quelle que soit la visibilité, la page publique ne montre jamais la grille de tarifs — seulement une fourchette finale, et seulement quand vous avez choisi de la montrer. Le point d'accès public renvoie des services et des champs, jamais des tarifs. C'est une règle du produit, pas un réglage." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut le voir et le modifier",
        blocks: [
          { p: "L'écran est une grille de tarifs, donc il est montré à quiconque a **See prices** dans son accès — un Estimateur inclus; l'équipe de chantier ne le voit pas. Enregistrer les tarifs, la visibilité ou le financement est réservé aux propriétaires et administrateurs; tous les autres voient la page en lecture seule avec la note que seul un propriétaire ou un administrateur peut modifier les prix." },
        ],
      },
    ],
    faq: [
      { q: "Où va une estimation ?", a: "Une fiche client est retrouvée ou créée, une soumission en brouillon est écrite avec l'indicateur de révision activé, et elle apparaît dans Révision des estimations. Le propriétaire reçoit un courriel de confirmation en votre nom, avec la fourchette seulement si vous avez choisi de la montrer." },
      { q: "Le propriétaire peut-il réserver une visite depuis l'estimation ?", a: "Oui, quand votre page de réservation est configurée — la confirmation propose une visite selon vos vraies disponibilités." },
      { q: "L'estimation instantanée partage-t-elle son lien avec le formulaire d'autosoumission ?", a: "Non. Ce sont deux cartes sur Paramètres → Partager vos liens : Estimation instantanée donne un prix; Demander une soumission n'en donne pas. Voir [[the-self-quote-form|Le formulaire d'autosoumission]]." },
    ],
  },

  "the-self-quote-form": {
    title: "Le formulaire d'autosoumission",
    summary:
      "Un formulaire public en trois étapes où le propriétaire choisit un service, donne des chiffres approximatifs, des photos ou un plan PDF, et ses coordonnées — il arrive comme un prospect noté, sans qu'aucun prix ne soit montré à personne.",
    updated: "2026-09-12",
    intro: [
      "Le formulaire d'autosoumission est le lien **Demander une soumission** sur **Paramètres → Partager vos liens**. Il n'affiche que les services que vous avez activés, demande les quelques chiffres qui vous disent la taille du chantier, et ne montre jamais de prix. Ce qui en sort est un prospect sur votre tableau des prospects avec tout ce que le propriétaire a tapé, prêt à être converti en une soumission que vous chiffrez vous-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le formulaire compte trois étapes, dans l'ordre qu'un inconnu sur un téléphone tolérera : **Comment pouvons-nous vous aider ?** (un de vos services activés), une étape de détails avec au plus les trois premières questions numériques ou à choix de ce service plus **Quand souhaitez-vous commencer ?** et **Budget approximatif ?**, et **Où devons-nous vous répondre ?** — nom, courriel ou téléphone, adresse du chantier, et l'ajout de photos, d'une vidéo ou d'un plan PDF." },
          { p: "Il s'affiche dans la langue du propriétaire, porte votre logo et votre couleur de marque, et ne dit rien de FieldQuo. Une entreprise qui a activé plus d'une langue d'envoi affiche un sélecteur de langue; la langue choisie est celle dans laquelle le prospect — et la soumission qu'il deviendra — est créé." },
          { note: "**Seulement dans FieldQuo.** Un formulaire public qui laisse un client décrire et photographier son propre chantier, en n'offrant que les services que vous vendez et jamais un prix, ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul, QuoteIQ ou ServiceTitan à aucun palier." },
        ],
      },
      {
        id: "share",
        heading: "Comment le partager",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Partager vos liens**.",
            "Sur la carte **Demander une soumission**, appuyez sur **Copier** pour le lien, **Ouvrir** pour l'essayer, ou **Ou collez ceci dans votre propre site web** pour le code d'intégration.",
            "Mettez le lien partout où vous êtes déjà — votre site web, votre fiche Google, votre page Facebook, votre signature de courriel ou le côté de la camionnette.",
          ] },
          { figure: "live:app-settings-links", caption: "Paramètres → Partager vos liens — la carte Demander une soumission avec son lien et son code d'intégration." },
          { p: "Le formulaire n'offre que les services que vous avez activés sous **Paramètres → Services et tarifs**. Désactivez un service là et il disparaît du formulaire; il n'y a rien à configurer sur le formulaire lui-même." },
        ],
      },
      {
        id: "what-arrives",
        heading: "Ce qui arrive de votre côté",
        blocks: [
          { bullets: [
            "Un prospect sur **Prospects** avec la provenance **self_quote**, noté Chaud, Tiède ou Froid selon le budget, l'échéancier et les détails donnés — voir [[lead-scoring-hot-warm-cold|La notation des prospects]].",
            "Les réponses du propriétaire, conservées telles que tapées, plus un résumé lisible; les photos, la vidéo ou le plan PDF joints au prospect.",
            "Un courriel de confirmation au propriétaire, en votre nom et dans sa langue, reprenant ce qu'il a demandé et proposant une visite si votre page de réservation est configurée. Aucun chiffre ne s'y trouve.",
            "Son numéro de téléphone, s'il l'a donné, enregistré avec consentement pour que le réceptionniste puisse le rappeler.",
          ] },
          { figure: "live:app-leads", caption: "Prospects — là où une demande d'autosoumission atterrit, avec sa note et les propres mots du propriétaire." },
          { p: "Appuyez sur **Convertir en devis** sur le prospect et un brouillon s'ouvre avec le client, le service, les photos et les réponses déjà en place et un total à zéro — personne ne l'a encore chiffré, et un chiffre que le propriétaire pourrait voir sans que vous l'ayez accepté est exactement ce que ce formulaire existe pour éviter. Voir [[convert-a-lead-to-a-quote|Convertir un prospect en soumission]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui voit les prospects",
        blocks: [
          { p: "Quiconque a Demandes à **View only** ou plus voit le tableau des prospects; convertir un prospect exige Soumissions à **View, create, and edit**. Partager vos liens est un écran de paramètres pour les propriétaires, administrateurs, Gestionnaires et Répartiteurs." },
        ],
      },
    ],
    faq: [
      { q: "Le propriétaire voit-il jamais un prix sur ce formulaire ?", a: "Non — ni sur le formulaire, ni dans la confirmation. L'estimation instantanée est la surface qui montre une fourchette; celle-ci ne le fait délibérément pas." },
      { q: "Puis-je ajouter mes propres questions ?", a: "Les questions sont les trois premiers champs numériques ou à choix du service, tels que définis sous Paramètres → Services et tarifs. Les types de soumission personnalisés apportent leurs propres champs." },
      { q: "Que voit le propriétaire après l'envoi ?", a: "Une page de confirmation dans sa langue avec une référence, les prochaines étapes, et un bouton Réserver une visite quand la réservation est disponible. Voir [[the-self-quote-form-as-a-client|Le formulaire d'autosoumission, vu par le client]]." },
    ],
  },

  "aerial-roof-measurement": {
    title: "Mesure de toiture depuis les airs",
    summary:
      "Tapez une adresse et FieldQuo mesure le toit à partir du modèle de bâtiment de Google — surface en pente, pente, carrés et détails linéaires — et remplit le relevé de toiture, avec un Annuler et un refus quand l'épingle est sur le mauvais bâtiment.",
    updated: "2026-09-12",
    intro: [
      "Une soumission de toiture a besoin de la surface du toit, de sa pente et des longueurs d'avant-toit, de faîte, d'arête et de noue. FieldQuo les obtient du modèle Google Solar du bâtiment — la même géométrie dont l'industrie solaire se sert pour dimensionner ses panneaux — pour qu'un toit puisse être chiffré sans qu'un camion se rende sur place. La même mesure alimente l'estimation instantanée de toiture sur votre site web.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Dans le générateur de soumission, un groupe de travaux de toiture affiche un panneau intitulé **Mesurer le toit à partir d'une adresse** au-dessus du relevé. Il propose **Utiliser l'adresse du client** quand le client en a une, ou une case pour en taper une autre — le toit à refaire n'est souvent pas l'adresse où va la facture. **Mesurer par satellite** fait le reste." },
          { p: "Ce qui revient est la vraie surface en pente, pas l'empreinte au sol — le modèle de Google tient déjà compte de la pente, donc aucun multiplicateur n'est appliqué par-dessus. Le panneau le dit : **La surface en pente, pas l'empreinte au sol**. La pente alimente le supplément pour pente raide et s'affiche en élévation par 12." },
          { note: "**Seulement dans FieldQuo.** La mesure d'un toit à partir d'une adresse, dans le générateur de soumission, ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul ou ServiceTitan à aucun palier. QuoteIQ affiche un produit de mesure sur sa page de tarifs." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment mesurer un toit",
        blocks: [
          { steps: [
            "Ouvrez une soumission et ajoutez un groupe de travaux de toiture.",
            "Dans **Mesurer le toit à partir d'une adresse**, gardez l'adresse du client ou tapez celle du chantier, puis appuyez sur **Mesurer par satellite**.",
            "Lisez le résultat à côté de l'image satellite : les carrés, la pente, et ce que valent les détails linéaires à vos tarifs.",
            "Le panneau dit **{count} champs remplis** et énumère chacun avec son ancienne valeur à côté de la nouvelle. Écrivez par-dessus ce avec quoi vous n'êtes pas d'accord, ou appuyez sur **Annuler** pour remettre le relevé exactement comme il était.",
          ] },
          { p: "Six des sept détails linéaires sont dérivés de la géométrie des pans — membrane glace et eau, larmier, bande de départ, noues, faîtières et arêtiers, évent de faîte. Le **solin à gradins** est la rencontre du toit et d'un mur, et aucun modèle de toit ne contient de murs, donc il reste vide et le panneau le liste sous **Encore à vous — rien de tout ça n'est visible d'en haut :**, avec les couches existantes, le contreplaqué et les pénétrations." },
        ],
      },
      {
        id: "refusals",
        heading: "Quand il refuse, et pourquoi",
        blocks: [
          { bullets: [
            "**Ça n'a pas l'air du bon bâtiment, alors rien n'a été rempli.** — la mesure est revenue invraisemblable (un cabanon à côté de l'épingle, une imagerie trop vieille). Les chiffres restent hors du formulaire; regardez l'image et appuyez sur **L'utiliser quand même** seulement si c'est vraiment le toit.",
            "L'adresse est introuvable, ou Google n'a aucun modèle de toit pour le bâtiment — entrez la surface et la pente à la main. La couverture est large mais pas universelle.",
            "**La mesure du toit n'est pas disponible.** — la clé serveur n'est pas configurée. La saisie manuelle fonctionne toujours.",
          ] },
          { p: "Rien n'est appliqué en silence et rien n'est appliqué deux fois. La mesure est un point de départ qui appartient à l'estimateur; le panneau ne se rebiffe jamais et ne se réapplique jamais." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Où d'autre le ciel sert",
        blocks: [
          { bullets: [
            "**L'estimation instantanée** — l'estimation de toiture d'un propriétaire est mesurée à partir de son adresse de la même façon, et la carte dans Révision des estimations montre l'image satellite, la surface et la pente, marquées **Mesuré par satellite**.",
            "**Tonte de pelouse** — le propriétaire trace la pelouse sur une carte satellite; la surface est calculée à partir du contour.",
            "**Pavage** — pour un groupe de travaux de pavage, le générateur va chercher une image aérienne de l'adresse du client et vous y tracez le patio, l'allée ou l'entrée après avoir dessiné une ligne de référence pour l'échelle. Sans échelle, il n'affiche aucune mesure plutôt qu'un compte de pixels qu'on pourrait prendre pour des pieds.",
          ] },
          { p: "La clé Google n'atteint jamais le navigateur : les images passent par FieldQuo et l'appel de mesure roule sur le serveur. Voir [[google-maps-and-solar|Google Maps et Solar]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut s'en servir",
        blocks: [
          { p: "Quiconque peut bâtir une soumission — Soumissions à **View, create, and edit** ou plus. La mesure est gratuite et n'est pas comptée contre votre crédit IA." },
        ],
      },
    ],
    faq: [
      { q: "La surface, c'est l'empreinte au sol ou la surface du toit ?", a: "La surface du toit, en pente — ce pour quoi vous achetez le matériau. Un toit 12/12 rapporte beaucoup plus de surface que son empreinte, et c'est exact." },
      { q: "Puis-je mesurer un toit pour un client de passage sans adresse au dossier ?", a: "Oui. Tapez n'importe quelle adresse dans la case; la fiche client n'a pas besoin d'en avoir une." },
      { q: "Est-ce que ça fonctionne hors du Canada et des États-Unis ?", a: "Là où Google a un modèle de bâtiment. Là où il n'en a pas, le panneau le dit et vous entrez la surface à la main." },
    ],
  },

  "the-kitchen-designer": {
    title: "Le concepteur de cuisine",
    summary:
      "Dessinez la rangée, choisissez la finition, et les armoires se chiffrent d'elles-mêmes à partir de la Tarification des armoires dans la soumission; le client reçoit un lien pour déplacer les armoires sur sa propre version, et le dessin s'imprime sur la soumission et la facture.",
    updated: "2026-09-12",
    intro: [
      "Une soumission d'armoires est une page de lignes qui veulent dire peu de choses seules. Le concepteur de cuisine est le dessin derrière elles : des armoires sur des murs, un îlot, des finitions, des électroménagers, chiffrés sur le serveur à partir de vos tarifs de **Tarification des armoires**, écrits dans la soumission comme son groupe de travaux d'armoires et imprimés sur le PDF que le client signe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le bouton **Concepteur de cuisine** apparaît sur une soumission quand votre entreprise a activé **Kitchen Design & New Installs** sous **Paramètres → Services et tarifs**, ou quand cette soumission porte déjà une conception. Enregistrer dans le concepteur stocke le dessin et retarife la soumission en une seule étape — il n'y a volontairement pas de « enregistrer le dessin » et de « mettre à jour la soumission » séparés, parce que deux boutons, c'est ainsi qu'une soumission part à un prix qui ne correspond pas au dessin agrafé dessus." },
          { note: "**Seulement dans FieldQuo.** Un concepteur de cuisines et d'armoires dont les prix et le plan d'étage vont directement dans la soumission ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul, QuoteIQ ou ServiceTitan à aucun palier." },
        ],
      },
      {
        id: "rates",
        heading: "Tarification des armoires : d'où viennent les chiffres",
        blocks: [
          { p: "**Paramètres → Tarifs des armoires** est ce que le concepteur facture pour les armoires. Chaque soumission est tarifée à partir de ces valeurs sur le serveur, donc les modifier change le coût des nouveaux designs et ne touche pas les soumissions déjà envoyées. L'écran n'apparaît que pour les entreprises qui ont activé la conception de cuisine, ou qui ont déjà enregistré leurs propres tarifs." },
          { figure: "live:app-settings-cabinet-rates", caption: "Paramètres → Tarifs des armoires — comment vous tarifez une armoire, les tarifs par pied linéaire, puis les multiplicateurs de matériau et la finition." },
          { bullets: [
            "**Comment vous tarifez une armoire** — **Par pied linéaire** (largeur × le tarif du niveau, finition et installation incluses) ou **Coût majoré du matériau** (coût du caisson à partir d'une valeur de base plus un montant au pouce, majoré, installation facturée à part).",
            "**Tarifs par pied linéaire** — Base, Mural / haut, Haute / garde-manger, Îlot, un supplément tiroir, et si **L'installation est incluse dans le tarif**; désactivé, cela ajoute une ligne d'installation distincte à la soumission. Les tarifs de rangement de garde-robe et de meuble-lavabo sont facultatifs et retombent sur vos tarifs de cuisine.",
            "**Multiplicateurs de matériau** — appliqués au prix de l'armoire; 1,0 est votre base, 1,4 signifie que ce matériau coûte 40 % de plus. Une prime de coin se trouve à côté.",
            "**Finition, livraison et démolition** — à la porte, à la façade de tiroir, un frais de livraison fixe et l'enlèvement au caisson, chacun activé ou désactivé par design.",
          ] },
          { warning: "Les tarifs de départ sont les prix d'un vrai atelier d'armoires, et l'écran le dit : ce sont des tarifs de départ, pas les vôtres. Ils sont assez crédibles pour passer inaperçus — fixez les vôtres avant d'envoyer une soumission de cuisine. **Revenir aux tarifs de départ** les restaure." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment concevoir et chiffrer une cuisine",
        blocks: [
          { steps: [
            "Ouvrez la soumission et appuyez sur **Concepteur de cuisine**.",
            "Dessinez la pièce et placez les armoires, un îlot, les électroménagers; choisissez la finition et les accessoires.",
            "Appuyez sur **Enregistrer et retarifer la soumission**. Le dessin est stocké et le groupe d'armoires de la soumission est réécrit à partir de lui — les autres groupes de travaux de la soumission (une salle de bain, un plancher) sont laissés tels quels.",
            "Envoyez la soumission. Le dessin s'imprime sur le PDF de la soumission et plus tard sur la facture, à partir des mêmes formes que l'écran a dessinées.",
          ] },
          { p: "Une soumission déjà envoyée est un engagement, donc sa conception s'ouvre en lecture seule et l'écran le dit. Pour changer la disposition après l'envoi, appuyez sur **Dupliquer** à côté de cette note : un nouveau brouillon sous le numéro suivant, avec le même client, la même langue, les mêmes lignes et le même dessin — rien de l'historique d'envoi, rien des modifications du client — s'ouvre directement dans son concepteur, déverrouillé. La soumission envoyée n'est pas touchée." },
        ],
      },
      {
        id: "client-link",
        heading: "La version du client",
        blocks: [
          { p: "Une fois la soumission envoyée, le concepteur affiche un **Lien client**. Le propriétaire ouvre sa cuisine avec votre logo et votre nom, déplace les armoires et change la finition, puis enregistre. Il ne voit aucun prix et ne peut en envoyer aucun — la conception revient avec votre tarification rattachée et tout ce qui ressemble à un montant est écarté." },
          { p: "La personne qui a créé la soumission, ainsi que les propriétaires et administrateurs, reçoivent un courriel quand il enregistre, et le concepteur affiche **Votre client a enregistré sa propre version de cette disposition** avec la date et un bouton **Charger leur version**. Rien n'est retarifé tant que vous ne la chargez pas et n'enregistrez pas. La page du client est en anglais seulement aujourd'hui. Voir [[the-kitchen-design-link|Le lien de conception de cuisine]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut s'en servir",
        blocks: [
          { p: "Concevoir et retarifer une soumission exige Soumissions à **View, create, and edit**. Tarifs des armoires est un écran de paramètres pour les propriétaires, administrateurs, Gestionnaires et Répartiteurs. Le client n'a besoin de rien d'autre que son lien." },
        ],
      },
    ],
    faq: [
      { q: "Je vends de la refinition d'armoires. Ai-je besoin des Tarifs des armoires ?", a: "Non. La refinition et le resurfaçage se chiffrent à partir de leurs propres grilles sous Services et tarifs et Soumissions instantanées; les Tarifs des armoires n'alimentent que le concepteur de cuisine, et l'écran reste caché tant que la conception de cuisine n'est pas activée." },
      { q: "Un propriétaire peut-il concevoir une cuisine avant que j'aie soumissionné ?", a: "Oui. Avec **Kitchen Design & New Installs** activé sous Services, une page publique **Concevez votre cuisine** existe : une carte sur Paramètres → Partager vos liens, une ligne sur votre lien de profil, et un lien à l'étape Conception de cuisine du formulaire de soumission. Ce qu'il dessine arrive comme demande avec le plan joint et sans prix — c'est vous qui soumissionnez. Le lien client d'une soumission envoyée, c'est autre chose : il modifie la conception de cette soumission." },
      { q: "La modification du client change-t-elle ma soumission ?", a: "Jamais d'elle-même. C'est une deuxième version que vous pouvez charger; la soumission ne bouge que lorsque vous appuyez sur Enregistrer et retarifer la soumission." },
    ],
  },

  "call-to-quote": {
    title: "D'un appel téléphonique à une ébauche de soumission",
    summary:
      "Le réceptionniste prend l'appel et ne donne jamais de prix; ensuite, un seul bouton lit l'enregistrement dans le formulaire de soumission instantanée, le chiffre à partir de vos propres réglages et dépose un brouillon dans Révision des estimations — ou vous remet le générateur avec ce qui a été entendu déjà rempli.",
    updated: "2026-09-12",
    intro: [
      "Le réceptionniste téléphonique ne peut pas dire de chiffre — ni prix, ni fourchette, ni « habituellement autour de ». Ce qu'il peut faire, c'est prendre les détails. Après l'appel, sur l'écran **Réceptionniste**, **Rédiger une soumission à partir de cet appel** lit l'enregistrement comme si le client avait tapé le formulaire de soumission instantanée, et le reste est la mécanique que vous avez déjà : vos tarifs, votre file de révision, votre générateur.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran **Réceptionniste** liste les appels qu'il a pris pour vous, et ce qui en est ressorti, regroupés **Votre attention**, en attente de vous et archivés. Chaque appel affiche le numéro, l'heure, la durée et le coût, le résumé, un bouton **Écouter**, et ce qu'il a produit — **Enregistré comme prospect**, une visite réservée, **Planifier un rappel**. Sur un appel avec transcription, **Rédiger une soumission à partir de cet appel** est le bouton dont parle cet article." },
          { figure: "live:app-receptionist", caption: "Réceptionniste — le journal des appels, avec ce que chaque appel a produit et les boutons qui agissent dessus." },
          { note: "**Seulement dans FieldQuo.** Une soumission rédigée à partir de ce que l'appelant a décrit, chaque valeur retracée aux propres mots de l'appelant, ne figure sur la page de tarifs de Jobber, Housecall Pro, Projul, QuoteIQ ou ServiceTitan à aucun palier." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment rédiger une soumission à partir d'un appel",
        blocks: [
          { steps: [
            "Ouvrez **Réceptionniste** et trouvez l'appel. Appuyez sur **Écouter** si vous voulez l'entendre d'abord.",
            "Appuyez sur **Rédiger une soumission à partir de cet appel**. Cela dépense du crédit IA, ce qui explique que ce soit un bouton plutôt que quelque chose qui roule à l'ouverture de l'écran.",
            "Lisez **Ce que nous avons entendu pendant cet appel** : chaque service et chaque mesure sont montrés à côté des propres mots de l'appelant, tirés textuellement de l'enregistrement, avec la mention que l'appelant l'a dit ou l'a confirmé quand l'assistant le lui a répété.",
            "Suivez le résultat — l'un des deux ci-dessous.",
          ] },
          { p: "Le modèle ne peut choisir que des services dans votre liste activée, des matériaux parmi les libellés que vous avez configurés, des options dans votre propre grille de tarifs, et des mesures qu'il peut citer de la bouche de l'appelant. Il ne peut pas inventer un service, écrire du texte destiné au client, ni produire un prix — il n'y a aucun champ de prix dans ce qu'on lui donne, et tout ce qui ressemble à un montant qu'il inventerait est retiré." },
        ],
      },
      {
        id: "outcomes",
        heading: "Les deux résultats",
        blocks: [
          { table: {
            head: ["Résultat", "Ce que dit le panneau", "Ce qui s'est passé"],
            rows: [
              ["Chiffré", "**Chiffrée selon vos réglages de soumission instantanée et en attente d'approbation — brouillon {number}**, avec **Ouvrir la file de révision**", "L'appel contenait tout ce dont le formulaire de soumission instantanée de ce métier a besoin. Il a suivi le même chemin que le formulaire web d'un propriétaire et a déposé un brouillon dans Révision des estimations, marqué **Tiré d'un appel téléphonique** avec un bouton Écouter. Le montant s'affiche là, à côté d'Approuver, pas ici."],
              ["Non chiffré", "**Pas assez d'information pour chiffrer automatiquement — personne n'a demandé : {fields}**, avec **Ouvrir dans le générateur de soumission**", "Quelque chose sur quoi le métier fixe son prix n'a pas été mentionné. Rien n'a été calculé et rien n'a été créé; le générateur s'ouvre avec ce qui a été entendu déjà rempli, et vous chiffrez à la main."],
            ],
          } },
          { p: "Un appelant qui n'a jamais dit combien de portes il a produit un formulaire sans nombre de portes — pas zéro, pas une moyenne plausible. Une supposition multipliée par un tarif est un prix que quelqu'un envoie, alors les questions manquantes sont listées à la place : c'est ce pour quoi vous rappelez." },
          { bullets: [
            "**Ajouté** — une option de votre propre grille de tarifs, cochée sur l'ébauche et chiffrée par le générateur.",
            "**Le client a aussi parlé de … Cela ressemble à … — vérifiez si ça doit figurer sur cette soumission** — quelque chose qui ressemble à ce que vous vendez mais n'a pas pu être placé automatiquement.",
            "**Rien dans vos services, votre grille de tarifs ou vos produits n'y correspondait** — même ceci n'est pas jeté; c'est inscrit dans les notes de révision de la soumission, que le client ne voit jamais.",
          ] },
          { p: "L'appelant est rattaché à un client existant par téléphone ou courriel, ou ajouté à vos clients, et le panneau dit lequel. Son numéro de téléphone est enregistré avec consentement pour que l'assistant puisse le rappeler." },
        ],
      },
      {
        id: "after",
        heading: "Après l'ébauche",
        blocks: [
          { p: "Une ébauche chiffrée est approuvée dans [[estimate-reviews|Révision des estimations]] puis envoyée comme n'importe quelle soumission. Si les rappels de soumission sont activés, l'assistant peut appeler le client pour confirmer et planifier une fois qu'il a la soumission par écrit — il relit un montant à partir d'un document qu'on lui a envoyé par courriel, et n'en annonce jamais un. Voir [[quote-callbacks|Rappels de soumission]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut le faire",
        blocks: [
          { p: "L'écran Réceptionniste est montré à quiconque a Clients et propriétés à **View full client and property info** ou plus. Rédiger la portée est la première moitié de l'écriture d'une soumission, donc le bouton exige Soumissions à **View, create, and edit**. Le déploiement doit avoir l'IA FieldQuo configurée et l'entreprise doit avoir du crédit IA; le panneau le dit quand l'un ou l'autre manque." },
        ],
      },
    ],
    faq: [
      { q: "Le réceptionniste peut-il donner un prix au téléphone ?", a: "Non, et il n'existe aucun outil qu'il pourrait utiliser pour ça. Il prend les détails et réserve des visites; le chiffrage se fait après, derrière un bouton qu'une personne a appuyé, et il est révisé avant l'envoi." },
      { q: "Que coûte une ébauche ?", a: "Une lecture IA de l'appel, imputée à votre crédit IA. Ouvrir l'écran ou relire une ébauche existante est gratuit; Relire l'appel dépense du crédit à nouveau. Voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
      { q: "Où l'enregistrement est-il conservé ?", a: "Derrière un lien FieldQuo qui vérifie votre session et votre entreprise. Rien de ce qui est destiné au client ne porte l'enregistrement, et le lien brut du fournisseur n'est jamais montré." },
    ],
  },

  "import-a-subcontractor-quote": {
    title: "Importer la soumission d'un sous-traitant",
    summary:
      "Quand une autre entreprise FieldQuo vous envoie une soumission, intégrez-la à l'une de vos propres soumissions comme ligne de coût majorée — votre client voit un seul prix, le sous-traitant ne voit jamais votre majoration, et le coût atterrit dans les coûts du chantier quand le chantier est gagné.",
    updated: "2026-09-12",
    intro: [
      "Un entrepreneur général recueille la soumission d'un sous-traitant et soumissionne au propriétaire un prix majoré. Quand le sous-traitant utilise aussi FieldQuo, c'est une seule étape : ouvrez la soumission qu'il vous a envoyée, choisissez votre soumission et votre majoration, et la ligne de coût est écrite pour vous — côté serveur, à partir des chiffres enregistrés du sous-traitant. Le navigateur n'envoie jamais de montant d'argent.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le sous-traitant vous envoie sa soumission comme il envoie une soumission à n'importe quel client. Quand vous ouvrez le lien connecté à FieldQuo en tant qu'entreprise différente, un panneau réservé aux entrepreneurs apparaît sous le document — le propriétaire ne le voit jamais, et la soumission au-dessus reste entièrement en marque blanche. Le panneau est en anglais sur l'écran de chaque langue." },
          { p: "À partir de là, vous ajoutez la soumission à l'une de vos propres soumissions ouvertes comme groupe de travaux **Subcontractors** chiffré au montant du sous-traitant plus votre majoration. Plus tard, quand votre client approuve et que le chantier est créé, le coût du sous-traitant devient une dépense du chantier pour atterrir dans les coûts et la marge du chantier." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment importer",
        blocks: [
          { steps: [
            "Ouvrez le lien de soumission que le sous-traitant vous a envoyé, connecté à votre entreprise. Ce qui compte, c'est d'être connecté à une entreprise autre que celle de l'expéditeur — le panneau n'apparaît jamais sur vos propres soumissions.",
            "Dans le panneau sous le document, choisissez la soumission cible parmi vos soumissions ouvertes (brouillon ou envoyée). Si vous n'en avez aucune, créez d'abord une soumission.",
            "Choisissez une majoration — 0, 10, 20 ou 30 pour cent, ou un chiffre personnalisé. La majoration augmente le coût; 0 le fait passer tel quel.",
            "Choisissez comment ça s'affiche pour le client : **One line** (le métier au prix client, rien sur qui l'a fait) ou **Itemised** (les descriptions de lignes du sous-traitant, chacune ajustée pour que le groupe totalise le prix client — les prix bruts du sous-traitant ne sont jamais montrés).",
            "Donnez-lui un libellé si vous voulez (« Électricité »), et appuyez sur **Add to my quote**.",
          ] },
          { p: "Le panneau prévisualise votre prix client en direct, pour votre bénéfice; ce qui est enregistré est calculé sur le serveur à partir du total accepté ou soumissionné du sous-traitant. La majoration est bornée entre 0 et 1000 pour cent." },
        ],
      },
      {
        id: "on-your-quote",
        heading: "Sur votre soumission ensuite",
        blocks: [
          { bullets: [
            "La page de la soumission affiche un panneau **Coûts de sous-traitance** : les devis que vous avez importés d'autres entreprises, votre coût, votre majoration et le prix client. **Modifier la majoration** change le prix client; **Retirer ce coût** enlève le groupe.",
            "Dans le générateur, le groupe importé est en lecture seule — le coût est fixe et la majoration se modifie sur la page de la soumission — mais il compte dans le total et survit à un enregistrement.",
            "Les lignes d'une soumission tranchée sont verrouillées, donc un import ne peut plus être modifié ni retiré une fois que votre client a accepté ou refusé.",
          ] },
        ],
      },
      {
        id: "what-the-sub-sees",
        heading: "Ce que voit le sous-traitant",
        blocks: [
          { p: "De son côté, la soumission affiche **Utilisé dans le devis d'une autre entreprise** — un entrepreneur a ajouté ce devis à son propre projet comme coût — avec un statut dérivé de votre soumission et jamais stocké : **En attente de l'approbation de son client** tant que votre soumission est ouverte, **Confirmé** une fois votre soumission acceptée ou votre chantier ou votre facture existants, **Ne se poursuit pas** si votre soumission est refusée. Il ne voit jamais votre majoration ni ce que vous facturez au propriétaire." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut importer",
        blocks: [
          { p: "Un membre connecté d'une entreprise différente de l'expéditeur, avec Soumissions à **View, create, and edit** — ça écrit une ligne de coût sur l'une de vos soumissions, ce qui est une modification de soumission. Une session de soutien en lecture seule ne peut pas importer." },
          { p: "Garder des sous-traitants au dossier, en placer un sur un chantier à un prix convenu et suivre leurs assurances, c'est l'écran Sous-traitants — voir [[subcontractors-and-insurance|Sous-traitants et assurances]]. Importer une soumission d'un système qui n'est pas FieldQuo, c'est [[import-a-quote-from-another-system|Importer une soumission d'un autre système]]." },
        ],
      },
    ],
    faq: [
      { q: "Quel montant est importé — ce qu'il a soumissionné ou ce que j'ai négocié ?", a: "Ce que vous avez accepté sur sa soumission, si vous l'avez acceptée; sinon le total qu'il a soumissionné. Un prix renégocié est celui qui passe." },
      { q: "Le propriétaire peut-il deviner qu'un sous-traitant est impliqué ?", a: "Pas d'après le document. Une seule ligne montre le métier et un prix; le mode détaillé montre des descriptions de travaux à des montants ajustés. Ni l'un ni l'autre ne nomme le sous-traitant ni ne montre ses prix." },
      { q: "Le sous-traitant doit-il être sur FieldQuo ?", a: "Pour ce panneau, oui — il lit sa soumission enregistrée. Un PDF d'un sous-traitant sur papier se chiffre à la main dans le générateur." },
    ],
  },

  "references-and-photos-in-the-quote-email": {
    title: "Références et photos avant-après dans le courriel de soumission",
    summary:
      "Deux sections facultatives du courriel qui accompagne une soumission — d'anciens clients qui ont accepté de prendre un appel, et des paires de photos de chantiers terminés — réglées une fois sous Paramètres → Courriel de soumission et activées ou désactivées par soumission.",
    updated: "2026-09-12",
    intro: [
      "Le courriel de soumission contient toujours la description des travaux, ce qui est inclus, le déroulement des travaux et ce qui pourrait changer le prix — ça vient de la soumission elle-même et n'a pas d'interrupteur. **Paramètres → Courriel de soumission** ajoute deux sections facultatives qui vous appartiennent : **Références** et **Avant et après**. Cet article explique ce que fait chacune, comment elle s'active, et la seule règle qui empêche une section vide d'atteindre un propriétaire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'ouvre sur **Ce que le courriel contient toujours** — la description service par service avec les lignes chiffrées, ce qui est inclus dans chaque service, le déroulement étape par étape, et ce qui pourrait changer le prix pour les métiers qui en déclarent un — et vous renvoie à Services et tarifs pour ce libellé. Puis les deux sections ci-dessous, chacune avec un interrupteur **Inclure dans chaque nouvelle soumission**." },
          { figure: "live:app-settings-quote-email", caption: "Paramètres → Courriel de soumission — ce que le courriel contient toujours, puis les Références et les paires avant-après." },
        ],
      },
      {
        id: "references",
        heading: "Références",
        blocks: [
          { p: "D'anciens clients qui ont accepté de prendre un appel d'un client potentiel : un **Nom** et un **Téléphone**, imprimés exactement comme vous les tapez. Appuyez sur **Ajouter** pour chacun; **Retirer** en enlève un." },
          { warning: "L'écran le dit et ça mérite d'être répété : n'inscrivez que des personnes qui ont réellement accepté ces appels. Leur numéro est transmis à chaque client que vous soumissionnez." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Avant et après",
        blocks: [
          { p: "Des paires de photos de chantiers terminés. **Nouvelle paire — téléversez l'avant et l'après** ouvre deux cases de téléversement, **Avant** et **Après**, avec une description facultative. Les deux moitiés sont requises — la moitié d'un avant-après, c'est la même photo deux fois." },
        ],
      },
      {
        id: "per-quote",
        heading: "Par soumission : le panneau Sections du courriel",
        blocks: [
          { p: "Sur chaque soumission, un panneau **Sections du courriel** montre les deux parties facultatives avec leur état — **Défaut (activé)** ou **Défaut (désactivé)** selon le réglage de l'entreprise, ou **Activé** / **Désactivé** si vous l'avez remplacé pour cette soumission — et combien d'éléments partiraient, provenant de **cette soumission** ou de **votre liste d'entreprise**. Une soumission peut porter ses propres références et paires en plus de celles de l'entreprise." },
          { steps: [
            "Ouvrez **Paramètres → Courriel de soumission** et ajoutez au moins une référence ou une paire.",
            "Activez **Inclure dans chaque nouvelle soumission**. Les nouvelles soumissions l'incluent désormais par défaut; les soumissions existantes gardent ce qu'elles avaient.",
            "Sur une soumission où ça ne doit pas partir, ouvrez **Sections du courriel** et mettez-la à **Désactivé** pour cette soumission.",
          ] },
        ],
      },
      {
        id: "empty-rule",
        heading: "La règle de la section vide",
        blocks: [
          { p: "Une section activée mais vide ne doit jamais atteindre un propriétaire — et ne doit pas non plus être retirée en silence, parce que vous avez coché la case et croiriez qu'elle est partie. L'envoi est donc bloqué. La page de la soumission dit **Cette section est activée mais vide : la soumission ne peut pas encore être envoyée.**, et l'envoi lui-même s'arrête sur **Une section incluse est vide** avec deux issues : **Ajouter du contenu** (qui vous mène aux paramètres) ou **Retirer de cette soumission**, puis **Envoyer maintenant**." },
          { note: "La règle est appliquée deux fois — avant que le courriel soit construit et à l'intérieur du constructeur du courriel lui-même — pour qu'aucun futur chemin d'envoi ne puisse afficher un titre au-dessus d'un espace vide. Les courriels de relance de **Paramètres → Relances** ne portent aucune des deux sections et ne sont pas touchés." },
        ],
      },
      {
        id: "language",
        heading: "La langue, et qui peut le modifier",
        blocks: [
          { p: "Le courriel part dans la langue de la soumission, au nom de votre entreprise — les références et les descriptions s'impriment comme vous les avez tapées, sans traduction. L'écran de paramètres est réservé aux propriétaires, administrateurs, Gestionnaires et Répartiteurs; l'interrupteur par soumission fait partie de la modification de la soumission (Soumissions à **View, create, and edit**)." },
        ],
      },
    ],
    faq: [
      { q: "Ces sections s'impriment-elles sur le PDF ?", a: "Non. Ce sont des sections du courriel d'accompagnement. Le PDF est le document lui-même — voir [[the-quote-pdf|Le PDF de soumission]]." },
      { q: "Puis-je ajouter une référence à une seule soumission ?", a: "Oui — le panneau Sections du courriel sur la soumission compte les éléments de cette soumission en plus de ceux de votre liste d'entreprise." },
      { q: "J'ai activé l'interrupteur et plus rien ne s'envoie. Pourquoi ?", a: "La section est activée mais vide. Ajoutez une référence ou une paire sous Paramètres → Courriel de soumission, ou retirez-la de cette soumission, puis envoyez de nouveau." },
    ],
  },

  "scope-of-work-and-terms": {
    title: "Description des travaux et conditions de paiement sur chaque soumission",
    summary:
      "Deux cases sous Paramètres → Profil de l'entreprise : une description des travaux par défaut copiée sur chaque nouvelle soumission et modifiable là, et des conditions de paiement imprimées sur chaque soumission et facture — avec des modèles de métier pour partir et des blancs entre crochets que vous devez remplir.",
    updated: "2026-09-12",
    intro: [
      "Une soumission qui dit ce qui va se passer — jusqu'où va l'excavation, qui emporte l'ancienne surface, ce que coûte un changement — se lit comme celle de quelqu'un qui a déjà fait le chantier. La carte **Description des travaux et conditions** de **Paramètres → Profil de l'entreprise** est l'endroit où vous l'écrivez une fois. Chaque nouvelle soumission en part, et les conditions de paiement s'attachent à chaque document que vous envoyez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte a deux champs. **Description des travaux par défaut** est copiée sur chaque nouvelle soumission comme son texte **Ce qui suit** — modifiable sur la soumission elle-même, imprimée sur le document après les étapes des travaux. **Conditions de paiement** est un texte libre comme « 50 % de dépôt, solde à la fin des travaux » ou « Net 30 », imprimé comme section de paiement sur les soumissions et les factures; quand le texte décrit un calendrier, le document le rend en cartes avec les pourcentages en gros, et sinon imprime votre phrase telle quelle." },
          { figure: "live:app-settings-company", caption: "Paramètres → Profil de l'entreprise — la carte Description des travaux et conditions en haut, puis le calendrier de paiement et les coordonnées de l'entreprise." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment les régler",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et trouvez **Description des travaux et conditions**.",
            "Sous **Partir d'un modèle de métier :**, appuyez sur **Ajouter les conditions …** de votre métier — pavé et pavage, scellant d'entrée ou déneigement — ou écrivez la vôtre dans **Description des travaux par défaut**. Le modèle est inséré comme texte que vous modifiez ensuite; appuyer de nouveau sur le bouton le retire.",
            "Remplacez chaque valeur entre [crochets]. La carte compte ce qui reste à décider et avertit que ça s'imprimera sur la soumission exactement tel quel.",
            "Tapez vos **Conditions de paiement**, puis appuyez sur **Mettre à jour les réglages**.",
          ] },
          { warning: "Un modèle non modifié est visiblement inachevé, exprès. La durée de garantie, la répartition du dépôt, le délai et les frais de modification vous appartiennent; une garantie par défaut est une clause contractuelle, pas une attention, alors FieldQuo les laisse en blanc plutôt que d'en affirmer une à votre place." },
        ],
      },
      {
        id: "what-each-changes",
        heading: "Ce que change chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Où ça va", "Si vide"],
            rows: [
              ["Description des travaux par défaut", "La case Ce qui suit de chaque nouvelle soumission, puis la page de la soumission et le PDF", "Les soumissions ne portent aucune description par défaut; la case de chaque soumission commence vide"],
              ["Conditions de paiement", "La section paiement de chaque soumission et facture, en cartes quand un calendrier peut y être lu", "La section paiement n'apparaît pas sur les documents"],
            ],
          } },
          { p: "Changer la valeur par défaut ne réécrit pas les soumissions qui existent déjà — chaque soumission garde son propre texte, que vous pouvez modifier dans le générateur sous **Ce qui suit**." },
          { note: "Si votre entreprise utilise le **Calendrier de paiement** structuré sur le même écran, le texte des conditions de paiement est généré à partir de ce calendrier pour que le document corresponde toujours à ce qui est vraiment facturé, et la case devient en lecture seule. Désactivez le calendrier pour écrire les conditions à la main de nouveau. Voir [[deposits-and-payment-schedules|Dépôts et calendriers de paiement]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut le voir et le modifier",
        blocks: [
          { p: "Paramètres → Profil de l'entreprise est réservé aux propriétaires, administrateurs, Gestionnaires et Répartiteurs. La même carte a aussi un rendu en lecture seule pour quelqu'un qui peut ouvrir la page sans la modifier — un estimateur à qui on pose une question sur les conditions sur un pas de porte peut lire ce que disent ses propres documents, et on lui dit de demander à un propriétaire ou un administrateur de compléter les crochets non remplis." },
        ],
      },
    ],
    faq: [
      { q: "La description des travaux est-elle traduite ?", a: "Non. Elle s'imprime dans la langue où vous l'avez tapée, sur les documents de toutes les langues. Une entreprise qui soumissionne en deux langues garde deux versions en modifiant la case sur chaque soumission." },
      { q: "Quels modèles existent ?", a: "Pavé et pavage, scellant d'entrée et déneigement. Les autres métiers écrivent le leur — le libellé de ce qui est inclus par service se trouve sous Paramètres → Services et tarifs." },
      { q: "Le client peut-il voir les crochets ?", a: "Oui, si vous les laissez — ils s'impriment exactement tels quels. C'est pour ça que la carte les compte." },
    ],
  },

  "the-large-quote-alert": {
    title: "L'alerte de grande soumission",
    summary:
      "Un courriel à chaque propriétaire et administrateur quand un membre de l'équipe crée une soumission au-dessus d'un montant que vous fixez — vérifié une fois par jour, depuis Paramètres → Notifications.",
    updated: "2026-09-12",
    intro: [
      "Un propriétaire qui ne rédige pas chaque soumission veut savoir quand une grosse part. La carte **Grande soumission créée** de **Paramètres → Notifications** est exactement ça : un seuil, un interrupteur, et un courriel aux propriétaires et administrateurs pour chaque soumission créée au-dessus.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Paramètres → Notifications** définit quand FieldQuo devrait vous envoyer un courriel au sujet de quelque chose qui se passe dans votre compte : **Grande soumission créée** avec son seuil, **Facture payée**, les rappels de rendez-vous et les notifications du navigateur. Cet article porte sur la première carte." },
          { figure: "live:app-settings-notifications", caption: "Paramètres → Notifications — Grande soumission créée avec son interrupteur et son seuil, puis Facture payée et les rappels." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment la configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Notifications**.",
            "Sur **Grande soumission créée**, cochez **Envoyer cette alerte** et tapez le montant dans **M'alerter au-dessus de**.",
            "Appuyez sur **Enregistrer**. Tant qu'aucun seuil n'est enregistré, la carte dit que ce n'est pas encore configuré — aucune alerte n'est envoyée.",
          ] },
          { note: "La carte le dit sans détour : cette vérification se fait selon un horaire quotidien plutôt qu'au moment où une soumission est enregistrée, alors attendez-vous à recevoir le courriel en moins d'une journée." },
        ],
      },
      {
        id: "what-it-does",
        heading: "Ce que ça fait",
        blocks: [
          { bullets: [
            "Une fois par jour, FieldQuo cherche les soumissions créées dans la dernière journée dont le total est égal ou supérieur à votre seuil.",
            "Pour chacune, chaque membre actif ayant un rôle de propriétaire ou d'administrateur reçoit un courriel au nom de l'entreprise, nommant le client, le montant et votre seuil. Les Gestionnaires et Répartiteurs ne reçoivent pas de courriel.",
            "Les soumissions saisies comme chantiers passés sont ignorées — un chantier tapé aujourd'hui avec un total de 2024 est de la tenue de livres, pas une grosse soumission qui vient d'arriver.",
            "Décocher **Envoyer cette alerte** garde le seuil et arrête les courriels; rien d'autre ne change.",
          ] },
          { p: "Il n'existe aucune trace par soumission d'une alerte déjà envoyée : la fenêtre quotidienne est ce qui empêche les répétitions, et une soumission est signalée une fois, lors de la vérification qui suit sa création." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Paramètres → Notifications est réservé aux propriétaires et administrateurs — ce sont aussi les seules personnes que l'alerte envoie par courriel. Le courriel est rédigé en anglais." },
        ],
      },
    ],
    faq: [
      { q: "Se déclenche-t-elle sur une modification qui fait passer une soumission au-dessus du seuil ?", a: "Non. Elle regarde quand la soumission a été créée, pas quand elle a été modifiée pour la dernière fois." },
      { q: "Puis-je l'envoyer à un estimateur ou à un gestionnaire ?", a: "Pas aujourd'hui. Les destinataires sont fixés aux rôles de propriétaire et d'administrateur." },
      { q: "Le montant est-il avant ou après taxes ?", a: "Elle compare le total de la soumission — le chiffre au bas de la soumission, taxes incluses quand la taxe s'applique." },
    ],
  },
};
