// content/help/fr/team-and-access-3.js
//
// Partie 3 de « team-and-access » : le dossier RH — documents des employés,
// intégration des nouveaux, politiques, journal de bord du gestionnaire et
// vue de conformité. Même structure, article par article, que en/.
export const ARTICLES = {
  "employee-documents": {
    title: "Documents des employés et rappels d'expiration",
    summary:
      "Gardez les certifications, permis, pièces d'identité, contrats et formulaires fiscaux de chaque personne dans son dossier RH, marquez ce que vous avez vérifié et soyez prévenu avant qu'une carte expire.",
    updated: "2026-09-13",
    intro: [
      "Chaque personne dans **Gérer l'équipe** a un **Dossier RH** — les papiers que l'entreprise détient à son sujet. Un gestionnaire y classe un contrat ou un permis numérisé ; la personne téléverse elle-même sa carte SIMDUT ou son permis de conduire depuis **Mes documents** sur son téléphone. Rien n'est jamais supprimé : un ancien certificat est **archivé**, et « sur quel permis comptions-nous en mars » garde une réponse.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un document a un **type** (certification, permis, pièce d'identité, contrat, formulaire fiscal, accusé de politique, autre), un titre, le fichier lui-même et, au choix, une date de délivrance, une date d'expiration et le numéro imprimé dessus. Les gestionnaires peuvent ajouter une note privée — où est l'original, qui l'a vérifié — que la personne ne voit jamais." },
          { p: "Un document téléversé par la personne elle-même affiche **Pas encore vérifié** jusqu'à ce qu'un gestionnaire appuie sur **Marquer vérifié**. La différence compte sur l'écran de conformité : « elle dit avoir sa carte de chariot élévateur » et « nous l'avons regardée » sont deux faits différents." },
        ],
      },
      {
        id: "how-to-file",
        heading: "Comment classer un document",
        blocks: [
          { steps: ["Ouvrez **Gérer l'équipe** et appuyez sur **Dossier RH** sous le nom de la personne.", "Dans **Documents**, appuyez sur **Téléverser**, choisissez le fichier et son type, et ajoutez la date d'expiration si le papier en porte une.", "Appuyez sur **Classer le document**. Pour marquer comme vérifié un téléversement fait par la personne, appuyez sur **Marquer vérifié** sur la ligne."] },
          { tip: "La personne peut faire le premier téléversement elle-même : **Mes documents** sur son téléphone accepte une certification, un permis, une pièce d'identité ou un autre document à elle. Les contrats et formulaires fiscaux viennent du côté de l'entreprise." },
        ],
      },
      {
        id: "expiry",
        heading: "Rappels d'expiration",
        blocks: [
          { p: "Une certification ou un permis avec une date d'expiration est surveillé chaque matin. La personne est prévenue **30 jours** et **7 jours** avant l'échéance ; ses gestionnaires le sont à 7 jours. Chaque rappel part une seule fois — un document qui reste à douze jours pendant une semaine produit un message, pas sept." },
          { bullets: ["Un document **sans date d'expiration** est affiché comme « aucune expiration enregistrée », jamais comme expiré. Un champ vide est un trou dans les papiers, pas une carte échue.", "Changer la date d'expiration d'une ligne relance le compte à rebours.", "Archiver un document arrête ses rappels."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs et gestionnaires (quiconque peut ouvrir **Gérer l'équipe**) voient le dossier de chaque personne. Chaque personne voit ses propres documents dans **Mes documents** — y compris ce que l'entreprise a classé à son sujet — mais pas les notes privées du gestionnaire, et jamais le dossier d'une autre personne." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je supprimer un document classé par erreur ?", a: "Non. Appuyez sur **Archiver** — il quitte la liste et ses rappels s'arrêtent, et la trace de ce qui était au dossier reste." },
      { q: "Où arrivent les rappels ?", a: "Dans la cloche de notifications, et en notification push sur tout téléphone où la personne a activé les notifications." },
    ],
  },

  "new-hire-onboarding": {
    title: "Listes d'intégration des nouveaux",
    summary:
      "Une liste que le nouvel employé parcourt sur son téléphone — tâches, documents à téléverser, politiques à signer, formulaire fiscal — lancée depuis l'invitation et suivie dans Gérer l'équipe.",
    updated: "2026-09-13",
    intro: [
      "Cochez **Lancer la liste d'intégration** quand vous invitez quelqu'un et, dès qu'il accepte, il reçoit la liste d'intégration de l'entreprise sur son téléphone : confirmer ses coordonnées, téléverser une pièce d'identité, remplir le formulaire fiscal, faire la visite de sécurité. Le registre affiche **Intégration 3/7** à côté de son nom jusqu'à ce que ce soit terminé.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une liste est une suite d'éléments de quatre types. Une **tâche** se coche à la main — par la personne ou par un gestionnaire à sa place, avec le nom dessus. Un **document à téléverser**, une **politique à signer** et un **formulaire à remplir** se cochent d'eux-mêmes dès que la preuve existe au dossier de la personne. Personne ne peut cocher « téléversez votre pièce d'identité » sans pièce d'identité." },
          { p: "La première fois que vous ouvrez **Gérer l'équipe → Intégration**, la liste par défaut est créée pour votre entreprise. Ses éléments de formulaire fiscal suivent votre pays : le TD1 fédéral et provincial au Canada, le W-4 aux États-Unis." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment lancer et suivre une liste",
        blocks: [
          { steps: ["Invitez la personne depuis **Gérer l'équipe → Nouvel utilisateur** avec **Lancer la liste d'intégration** coché (c'est le réglage par défaut).", "Ou ouvrez son **Dossier RH** et appuyez sur **Lancer la liste** pour quelqu'un déjà dans l'équipe.", "Suivez la progression sur la pastille du registre, sur l'écran de conformité ou dans son dossier, où chaque élément dit qui l'a fait et quand."] },
          { note: "Quelqu'un à mi-chemin garde la liste avec laquelle il a commencé. Modifier la liste dans **Gérer l'équipe → Intégration** décrit le prochain embauché." },
        ],
      },
      {
        id: "tax-forms",
        heading: "Le formulaire fiscal",
        blocks: [
          { p: "La personne répond aux questions du TD1 ou du W-4 sur son téléphone et signe de son nom. FieldQuo garde les réponses au dossier et les imprime en PDF pour l'administrateur de la paie. **Rien n'est transmis à un gouvernement et aucune retenue n'est calculée** — l'écran le dit. Le numéro d'assurance sociale ou de sécurité sociale n'est jamais tapé dans FieldQuo ; la feuille imprimée laisse cette case à remplir à la main." },
        ],
      },
      {
        id: "notifications",
        heading: "Qui est prévenu",
        blocks: [
          { bullets: ["La personne, au lancement de la liste, puis une fois par semaine tant qu'un élément est en retard.", "Les gestionnaires, quand tous les éléments obligatoires sont faits — la liste se marque terminée d'elle-même.", "Les éléments facultatifs ne retiennent jamais une liste ouverte."] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je avoir plus d'une liste ?", a: "Oui — une par type d'embauche, dans **Gérer l'équipe → Intégration**. L'une est celle par défaut que l'invitation utilise." },
      { q: "Et si le permis d'une personne est archivé plus tard ?", a: "L'élément « téléversez votre permis » se rouvre, parce que le dossier ne contient plus ce que la liste disait qu'il contenait." },
    ],
  },

  "company-policies": {
    title: "Politiques de l'entreprise et accusés de réception",
    summary:
      "Publiez les règles que vos gens lisent et signent — sécurité, véhicules, horaires, téléphones — voyez qui a signé, rappelez les autres, et ne perdez jamais le texte que quelqu'un a signé.",
    updated: "2026-09-13",
    intro: [
      "**Paramètres → Politiques** contient les règles que votre équipe lit et signe sur son téléphone. Quatre modèles sont proposés — Sécurité et EPI, Utilisation des véhicules, Horaires et assiduité, Téléphone et réseaux sociaux sur le chantier — en anglais, français et espagnol ; vous modifiez le texte avant de publier.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une politique a un titre, un texte court, un numéro de version et une portée de publication : **Tout le monde**, ou **Seulement ces titres de poste** (les titres donnés aux personnes dans Gérer l'équipe). Une politique à signer affiche **3/8 signée(s)** dans la liste ; ouvrez-la pour voir qui a signé et qui ne l'a pas fait." },
          { warning: "Une version signée n'est jamais réécrite. Quand vous changez le texte après qu'une personne a signé, FieldQuo publie la version 2, redemande à tout le monde et garde chaque signature antérieure sur la version pour laquelle elle a été donnée. Une coquille corrigée avant toute signature est corrigée sur place." },
        ],
      },
      {
        id: "how-to-publish",
        heading: "Comment publier une politique",
        blocks: [
          { steps: ["Ouvrez **Paramètres → Politiques** et appuyez sur **Nouvelle politique**, ou **Partir d'un modèle**.", "Modifiez le titre et le texte — ## fait un titre, - fait une puce.", "Choisissez si les gens doivent la signer et à qui elle s'applique, puis appuyez sur **Publier**."] },
        ],
      },
      {
        id: "signing",
        heading: "Comment une personne signe",
        blocks: [
          { p: "Dans **Politiques** de sa propre application, la personne lit le texte, tape son nom complet et appuie sur **J'accuse réception**. FieldQuo enregistre le nom, l'heure, l'adresse et le navigateur d'origine, et une empreinte du texte exact à l'écran — la même vérification qu'une signature de soumission par un client. Un onglet resté ouvert pendant une republication ne peut pas signer l'ancien texte." },
          { bullets: ["**Rappeler** envoie une notification à toutes les personnes concernées qui n'ont pas signé la version en vigueur.", "Une personne sans identifiant ne peut pas être jointe dans l'application ; la liste le dit à côté de son nom."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs et gestionnaires publient et voient la liste des signatures. Chaque personne ne voit que les politiques qui s'appliquent à elle, et ses propres signatures." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je dépublier une politique ?", a: "Archivez-la. Elle quitte la liste de tout le monde ; les signatures déjà données restent enregistrées." },
      { q: "Un nouvel employé doit-il signer toutes les politiques ?", a: "Seulement si la liste d'intégration le demande — ajoutez un élément **Politique à signer** à la liste." },
    ],
  },

  "the-manager-log-book": {
    title: "Le journal de bord du gestionnaire",
    summary:
      "Une page pour la journée telle qu'elle a été — la météo, qui s'est absenté, un client qui a appelé, une machine en panne — pour toute l'entreprise, par jour, avec des étiquettes pour la retrouver.",
    updated: "2026-09-13",
    intro: [
      "**Journal de bord**, sous Personnes, est le carnet quotidien du gestionnaire. Ce n'est pas le journal d'un chantier — celui-là vit sur le chantier — c'est celui de l'entreprise : « la pluie a arrêté la toiture à 11 h », « Marc s'est déclaré malade », « le compresseur est à l'atelier ». Le jour le plus récent en premier, filtré par jour ou par étiquette.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une entrée, c'est un jour, quelques lignes et au choix six étiquettes : **Météo**, **Incident**, **Personnel**, **Client**, **Équipement**, **Autre**. Le compositeur en haut est prérempli avec aujourd'hui. La personne qui a écrit une entrée peut la corriger ; personne ne peut en supprimer une." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment écrire et retrouver des entrées",
        blocks: [
          { steps: ["Ouvrez **Journal de bord** dans la barre latérale (propriétaires, administrateurs et gestionnaires).", "Tapez ce qui s'est passé, touchez les étiquettes qui conviennent et appuyez sur **Enregistrer l'entrée**.", "Pour revenir en arrière, choisissez un jour ou touchez une étiquette — la liste se réduit aux entrées correspondantes."] },
        ],
      },
      {
        id: "when-to-use-which",
        heading: "Journal de bord ou journal quotidien du chantier ?",
        blocks: [
          { table: { head: ["Écrivez-le dans", "Quand"], rows: [["**Journal de bord**", "Ça concerne l'entreprise ou la journée : météo, personnel, un appel, une panne."], ["**Le journal quotidien du chantier**", "Ça concerne ce seul chantier : ce qui a été fait, ce qui reste, ce que le client a dit sur place."], ["**Un incident de sécurité**", "Quelqu'un a été blessé ou a failli l'être — l'écran sécurité pose les questions qu'un rapport exige."]] } },
        ],
      },
    ],
    faq: [
      { q: "Un membre de l'équipe peut-il lire le journal de bord ?", a: "Non. C'est un écran de gestionnaires, protégé par le même accès que Gérer l'équipe." },
    ],
  },

  "hr-and-compliance": {
    title: "Vue RH et conformité",
    summary:
      "Un tableau, une ligne par personne : documents expirés ou arrivant à expiration, intégration inachevée, politiques non signées, rapports sans accusé — avec un lien vers chaque dossier pour régler la chose.",
    updated: "2026-09-13",
    intro: [
      "**Gérer l'équipe → Conformité** répond à « qui manque de quoi » pour toute l'équipe en un écran. Les personnes ayant quelque chose à régler passent en haut ; chaque compte renvoie au dossier RH de la personne, où la chose se règle.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce que veulent dire les colonnes",
        blocks: [
          { table: { head: ["Colonne", "Ce qu'elle compte"], rows: [["**Documents**", "Certifications et permis expirés ou expirant dans les 30 jours, et téléversements de la personne pas encore vérifiés."], ["**Intégration**", "La progression de la liste, et combien d'éléments sont en retard."], ["**Politiques**", "Politiques qui s'appliquent à la personne et qu'elle n'a pas signées dans la version en vigueur."], ["**Rapports**", "Avertissements et rapports disciplinaires en attente de l'accusé de réception de la personne."]] } },
          { p: "Sur un téléphone, les mêmes lignes sont des cartes. **Seulement les personnes avec quelque chose à régler** masque les lignes où tout est en ordre." },
        ],
      },
      {
        id: "performance-file",
        heading: "Le dossier de rendement",
        blocks: [
          { p: "Le dossier RH de chaque personne porte une chronologie de **notes**, de **reconnaissances**, d'**avertissements** et de **rapports disciplinaires** écrits par les gestionnaires, à côté des retards et absences que l'horodateur a relevés contre l'horaire. Une note peut être réservée aux gestionnaires ou visible par la personne ; un avertissement ou un rapport peut exiger son accusé de réception, qu'elle donne en tapant son nom sur son propre écran. Les notes ne sont jamais modifiées ni supprimées — une erreur se corrige par une nouvelle note qui le dit." },
        ],
      },
      {
        id: "what-it-is-not",
        heading: "Ce que cet écran ne fait pas",
        blocks: [
          { warning: "Il montre ce que votre entreprise a consigné. Il ne vérifie pas le droit du travail — règles de pause, seuils d'heures supplémentaires, préavis — de votre province ou État, et il ne dit pas si une personne a légalement le droit d'être sur le chantier." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs et gestionnaires. Une personne voit ses propres éléments en attente — politiques à signer, notes à accuser, sa liste, ses documents arrivant à expiration — sur ses propres écrans, jamais ceux de quelqu'un d'autre." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une personne affiche-t-elle « — » sous Intégration ?", a: "Aucune liste n'a jamais été lancée pour elle. Lancez-en une depuis son dossier RH si vous en voulez une." },
    ],
  },
  // ── Le palier « agence » du portail des ventes (lib/sales/agency.js) ──────
  "agencies-and-call-centres": {
    title: "Agences et centres d'appels",
    summary:
      "Comment une agence de centre d'appels fonctionne dans le portail des ventes FieldQuo : ajouter ses propres représentants, chacun avec son lien d'inscription, le versement hebdomadaire regroupé avec la répartition par employé, le plateau de l'équipe, et ce que les représentants de l'agence voient et ne voient pas.",
    updated: "2026-09-16",
    intro: [
      "FieldQuo vend par ses propres représentants, par des travailleurs autonomes et par des **agences de centre d'appels**. Une agence est un compte du portail des ventes qui ajoute ses propres personnes, ne surveille que sa propre équipe, et est payée — comme une seule entreprise — pour tout ce que ses gens apportent. Cet article s'adresse à la personne qui gère ce compte, et aux représentants qui travaillent sous elle.",
      "Si vous êtes un représentant FieldQuo ou un travailleur autonome avec votre propre contrat, rien ici ne change pour vous : votre lien, votre écran de paie et votre plateau sont les vôtres.",
    ],
    sections: [
      {
        id: "what-an-agency-account-is",
        heading: "Ce qu'est un compte d'agence",
        blocks: [
          { p: "Une agence se connecte au portail des ventes comme n'importe quel représentant. Ce qui diffère, c'est une ligne dans la barre latérale nommée **Mon équipe**, et le fait que l'agence est le **bénéficiaire** : la commission gagnée par ses représentants est regroupée dans le lot hebdomadaire de l'agence et versée aux coordonnées bancaires, PayPal, Interac ou Wise de l'agence — jamais au représentant lui-même." },
          { bullets: [
            "**FieldQuo crée le compte de l'agence**, avec le plan de commission convenu. Chaque représentant ajouté par l'agence gagne selon ce plan ; l'agence ne peut pas en choisir un autre.",
            "**L'agence ajoute ses représentants** depuis Mon équipe. Elle saisit un nom, un courriel et les langues dans lesquelles la personne vend. Rien d'autre n'est demandé, parce que rien d'autre ne relève de l'agence.",
            "**FieldQuo attribue à chaque représentant un numéro de téléphone et une boîte de travail.** Tant que les deux ne sont pas en place, le représentant peut se connecter mais ni appeler ni envoyer, et la ligne dans Mon équipe indique quelle moitié manque encore.",
          ] },
        ],
      },
      {
        id: "adding-a-rep",
        heading: "Ajouter un représentant",
        blocks: [
          { steps: [
            "Ouvrez **Mon équipe** dans la barre latérale et remplissez **Ajouter un représentant** : le nom de la personne, le courriel avec lequel elle se connectera, et les langues dans lesquelles elle vend.",
            "Appuyez sur **Envoyer l'invitation**. Le représentant reçoit un lien par courriel qui fonctionne une fois et expire au bout de sept jours, et choisit son propre mot de passe. Si le courriel ne part pas, la ligne affiche **Renvoyer l'invitation**.",
            "FieldQuo est averti dès que le représentant est ajouté, et attribue le numéro de téléphone et la boîte de travail. La ligne indique **En attente de l'attribution par FieldQuo** tant que les deux ne sont pas là.",
          ] },
          { note: "Chaque représentant a son propre lien d'inscription — **Copier le lien** sur sa ligne. Une entreprise qui s'inscrit par ce lien est créditée à ce représentant, ce qui rend visibles les meilleurs vendeurs d'une équipe, même si l'argent est versé à l'agence." },
        ],
      },
      {
        id: "pay",
        heading: "Comment l'agence est payée",
        blocks: [
          { p: "Chaque lundi, FieldQuo clôture la semaine précédente en lots de paiement — un par **bénéficiaire**. Pour une agence, c'est un seul lot qui rassemble les écritures de chaque employé et celles de l'agence, sous le nom de l'agence. L'écran **Paie** de l'agence montre les totaux regroupés, chaque semaine clôturée avec la façon et la date de paiement, et un tableau **Par employé** : ce que le lien de chaque représentant a rapporté, ce qui a été payé, ce qui est clôturé et en attente, et ce qui est encore ouvert cette semaine." },
          { p: "L'agence indique où l'argent est envoyé sur ce même écran Paie. Les options sont PayPal, Virement Interac, Wise et virement bancaire." },
          { warning: "Un représentant qui travaille pour une agence n'a **pas d'écran Paie**. S'il en ouvre un, il lit : « Votre commission est versée à <l'agence> ; adressez-vous à eux pour votre paie. » Ses écritures existent toujours et portent toujours son nom — elles sont simplement payées par l'agence." },
        ],
      },
      {
        id: "the-team-floor",
        heading: "Le plateau de l'équipe",
        blocks: [
          { p: "Sous la liste de l'équipe, **Plateau de l'équipe** montre en direct les représentants de l'agence : qui est disponible, en appel, en train de consigner un appel, en pause et pourquoi, et depuis combien de temps — avec, pour chacun, les appels du jour, le taux de joignabilité déclaré, les appels non encore consignés et le temps en appel, ainsi que les résultats du jour par métier. Il s'actualise toutes les quinze secondes et ne montre personne hors de l'équipe." },
          { p: "Chaque état du plateau est déclaré par le représentant depuis son propre sélecteur de statut. Rien n'est observé depuis une ligne téléphonique." },
        ],
      },
      {
        id: "deactivating-a-rep",
        heading: "Désactiver et réactiver un représentant",
        blocks: [
          { p: "**Désactiver** sur la ligne d'un représentant ferme sa porte immédiatement — son lien cesse de créditer de nouvelles inscriptions, et ce qu'il a gagné reste au dossier. Désactivé n'est jamais supprimé." },
          { p: "Si le représentant détient encore des prospects ou des pistes ouvertes, le bouton demande d'abord ce qu'il en advient : remettre les prospects dans le bassin, ou tout transférer à un autre représentant de l'équipe. Les pistes ouvertes ne sont jamais libérées — une piste doit avoir un représentant — vous choisissez donc qui les reprend. **Réactiver** ramène un représentant avec le même lien." },
        ],
      },
      {
        id: "what-the-agency-cannot-do",
        heading: "Ce que l'agence ne peut pas faire",
        blocks: [
          { bullets: [
            "Choisir le **type** d'un représentant — chaque représentant ajouté est un employé de l'agence. Elle ne peut pas en faire un travailleur autonome ou un employé FieldQuo, ni le placer sur un autre plan de commission.",
            "Attribuer des **numéros de téléphone ou des boîtes de travail** — c'est à FieldQuo, qui est averti à chaque ajout de représentant.",
            "Voir **les autres équipes**, la ligne entrante de FieldQuo, ou la liste des personnes à ne pas contacter. Le plateau et les résultats ne concernent que les représentants de l'agence.",
            "Changer **à qui une entreprise est créditée**. L'attribution est enregistrée à l'inscription et corrigée uniquement par un superadministrateur FieldQuo.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Un représentant de mon équipe dit qu'il ne voit pas sa paie. Y a-t-il un problème ?", a: "Non. Les représentants qui travaillent pour une agence sont payés par l'agence, donc la ligne Paie n'est pas dans leur barre latérale et les routes de paie les refusent volontairement. Leurs gains apparaissent sur votre écran Paie sous Par employé." },
      { q: "J'ai ajouté un représentant il y a une heure et il ne peut toujours pas appeler.", a: "FieldQuo doit attribuer son numéro de téléphone et sa boîte de travail ; la ligne dans Mon équipe indique ce qui manque encore. FieldQuo est averti dès que vous ajoutez quelqu'un." },
      { q: "Puis-je transférer les pistes d'un représentant à un représentant FieldQuo qui n'est pas dans mon équipe ?", a: "Non. Le travail ne se transfère qu'au sein de votre équipe. Demandez à FieldQuo si une piste doit aller ailleurs." },
    ],
  },
};
