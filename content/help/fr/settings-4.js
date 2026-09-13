// content/help/fr/settings-4.js
//
// Partie 4 de la catégorie « settings » en français (voir le composeur,
// settings.js) : les lignes Côté client qui font face à un inconnu — Partager
// vos liens, Lien de profil, Réceptionniste téléphonique, Employé IA, Avis — et
// les quatre lignes Compte — Migration de données, Nouveautés, Compte et
// facturation, Parrainage.
//
// Même structure que l'anglais, article par article : mêmes slugs, mêmes
// sections dans le même ordre, mêmes blocs, mêmes figures —
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran viennent
// du bloc `fr` de app/i18n/appMessages.js (et, pour les boutons par défaut de
// la page de liens, de lib/links/labels.js et lib/site/siteCopy.js).
export const ARTICLES = {
  "settings-share-your-links": {
    title: "Partager vos liens",
    summary:
      "La ligne des Paramètres qui liste chaque lien public qu'un inconnu peut utiliser pour devenir un prospect — Demander une soumission, Réserver une visite, Estimation instantanée, chaque entonnoir publié — avec Copier le lien, Ouvrir et un extrait d'intégration sur chaque carte.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Côté client → Partager vos liens** est le seul écran qui répond à « qu'est-ce que je peux mettre sur ma page Facebook, ma fiche Google, ma signature de courriel ou le côté de la camionnette? ». Son sous-titre le dit tel quel : « Mettez-les partout où vous êtes déjà — votre site web, votre fiche Google, votre page Facebook, votre signature de courriel ou le côté de la camionnette. »",
      "Chaque lien qu'il contient est public — pas de connexion, pas d'application, ça marche sur un téléphone dans une entrée de garage — et chaque visiteur qui en utilise un atterrit sur votre tableau Prospects ou votre calendrier, sur une page qui porte votre logo et votre couleur. Rien sur cet écran n'est un paramètre; c'est une liste d'adresses que vous copiez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le lien simple vient en premier sur chaque carte et le code d'intégration en second, parce que la plupart des entrepreneurs ont une page Facebook et un téléphone plutôt qu'un site web où coller du code. Chaque carte a la même forme : un titre, une phrase qui dit à qui le lien s'adresse, l'adresse elle-même, **Copier le lien**, **Ouvrir**, et dessous **Ou collez ceci dans votre propre site web** avec un bouton **Copier** pour l'extrait." },
          { p: "L'extrait pointe vers un cadre de la même page sans habillage FieldQuo; il communique sa propre hauteur pour s'insérer proprement dans le site où vous le collez. Voir [[embed-booking-and-quote-forms|Intégrer les formulaires de réservation et de soumission sur n'importe quel site]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Demander une soumission** — « Ils décrivent le travail et laissent leurs coordonnées. Cela arrive dans votre liste de prospects. Idéal pour ceux qui comparent encore les prix. »",
            "**Réserver une visite** — « Ils choisissent une heure selon vos réelles disponibilités. Idéal pour ceux qui ont déjà décidé et veulent simplement votre présence. »",
            "**Estimation instantanée** — « Ils saisissent leur adresse et obtiennent un vrai prix de départ en quelques secondes — toit mesuré par satellite ou zone tracée sur une carte. Chaque estimation arrive dans votre file de révision avant d'être contraignante. » Les métiers et les tarifs vivent sous **Paramètres → Soumissions instantanées**.",
            "**Concevez votre cuisine** — affiché seulement quand le service **Conception de cuisine et installations neuves** est activé sous Services. Un propriétaire dessine lui-même sa cuisine et vous l'envoie comme demande avec le plan joint. Cette carte a un lien et pas d'intégration, parce qu'il n'existe pas de module de cuisine intégrable.",
            "**Une carte par entonnoir publié**, nommée comme vous l'avez nommé — « Un entonnoir de prospects à parcourir — partagez le lien dans une annonce ou placez-le sur votre site. » Un entonnoir en brouillon n'est pas listé, parce que son lien ne fonctionnerait pas encore.",
            "La ligne de clôture : le formulaire de soumission n'offre que les services que vous avez activés sous **Paramètres → Services**, et n'affiche jamais vos prix.",
          ] },
        ],
      },
      {
        id: "copy-a-link",
        heading: "Comment copier un lien",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Partager vos liens**.",
            "Sur la carte voulue, appuyez sur **Copier le lien**. Le bouton se lit **Copié** pendant deux secondes.",
            "Appuyez d'abord sur **Ouvrir** si vous voulez voir la page exactement comme un inconnu la verra.",
            "Collez le lien là où les gens vous trouvent déjà. Pour un site web que vous gérez, appuyez plutôt sur **Copier** sous **Ou collez ceci dans votre propre site web** et remettez le code à la personne qui modifie le site.",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Paramètres → Partager vos liens — les cartes Demander une soumission, Réserver une visite et Estimation instantanée, chacune avec son lien, Copier le lien, Ouvrir et l'extrait d'intégration." },
          { note: "Il n'y a pas de code QR sur cet écran. Le lien ne change pas, alors n'importe quel générateur de codes QR le transformera en carré pour la camionnette, et le carré continuera de fonctionner." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Où mène chaque lien",
        blocks: [
          { table: {
            head: ["Lien", "Ce que fait le visiteur", "Ce que vous obtenez"],
            rows: [
              ["Demander une soumission", "Choisit un service, décrit le travail, ajoute des photos, laisse ses coordonnées", "Un prospect noté sur le tableau Prospects — voir [[the-lead-form-on-your-website|Le formulaire de demande sur votre site web]]"],
              ["Réserver une visite", "Choisit un type de visite et une plage selon vos vraies disponibilités, paie des frais de visite si vous en facturez", "Un rendez-vous dans votre calendrier et un prospect — voir [[settings-booking-page|Page de rendez-vous]]"],
              ["Estimation instantanée", "Saisit une adresse ou trace une surface et voit un prix de départ", "Une estimation dans votre file de révision, confirmée par vous avant tout envoi — voir [[settings-instant-quotes|Soumissions instantanées]]"],
              ["Un entonnoir", "Parcourt un court questionnaire et laisse ses coordonnées", "Un prospect noté, étiqueté du canal de l'entonnoir — voir [[funnels|Entonnoirs de prospects]]"],
            ],
          } },
          { p: "Aucun des quatre n'affiche un tarif. L'estimation instantanée n'affiche un prix de départ que pour les métiers que vous avez activés, et seulement ce que vous avez choisi sous **Ce que voit le propriétaire** sur l'écran Soumissions instantanées." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et quiconque est au niveau Répartiteur ou Gestionnaire voient la ligne et chaque carte. Les connexions Équipier et Estimateur ne la voient pas. Les cartes d'entonnoir lisent la liste des entonnoirs, qui est réservée aux propriétaires et administrateurs sur le serveur; un Répartiteur ou un Gestionnaire voit la ligne **Les entonnoirs de prospects sont gérés par un propriétaire ou un administrateur — demandez-leur le lien** à la place des cartes d'entonnoir, et les trois cartes fixes comme d'habitude." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon entonnoir n'est-il pas listé?", a: "Seuls les entonnoirs publiés avec une adresse apparaissent. Ouvrez Entonnoirs, ouvrez l'entonnoir et publiez-le; un entonnoir a besoin d'une étape de coordonnées avant de pouvoir être publié." },
      { q: "Ces liens affichent-ils mes prix?", a: "Non. Le formulaire de soumission recueille assez de détails pour soumissionner avec précision sans publier un tarif, et l'estimation instantanée n'affiche que ce que vous avez choisi d'afficher pour les métiers que vous avez activés." },
      { q: "Puis-je changer l'adresse d'un lien?", a: "Les liens sont construits à partir de l'identifiant de réservation de votre entreprise, qui se règle sous Paramètres → Page de rendez-vous. Le changer là change chaque lien de cet écran, et tout ce qui est déjà imprimé cesse de fonctionner." },
    ],
  },

  "settings-bio-link": {
    title: "Lien de profil",
    summary:
      "La ligne des Paramètres qui construit la seule page vers laquelle Instagram et TikTok vous laissent pointer — votre titre, une ligne dessous, vos identifiants sociaux et les boutons qui comptent — avec un aperçu téléphone en direct et un bouton Enregistrer.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Côté client → Lien de profil** transforme en page le lien unique qu'un profil social autorise : « Une page pour le lien unique qu'Instagram et TikTok autorisent dans votre profil. Elle porte votre logo et votre couleur, avec une petite mention « Made by FieldQuo » tout en bas. » L'adresse se trouve en haut de l'écran, en gros, avec **Copier le lien**, parce que mettre cette chaîne dans le presse-papiers d'un téléphone est la raison pour laquelle quelqu'un ouvre cette ligne.",
      "Rien sur la page n'est inventé. Un bouton apparaît parce que la chose derrière existe — un estimateur instantané, un type de visite réservable, un entonnoir publié, votre site web, votre lien d'avis, votre téléphone — et un bouton que vous désactivez reste désactivé.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est dérivée de la fiche de votre entreprise. Le formulaire de soumission est toujours là, parce que chaque entreprise en a un; **Prendre rendez-vous** apparaît dès que vous avez un type de visite actif; un prix instantané dès qu'un estimateur instantané est activé; chaque entonnoir publié comme son propre bouton; votre site web dès qu'il est publié ou qu'un domaine est saisi dans Profil de l'entreprise; **Laisser un avis** dès qu'un lien est enregistré sous Avis; **Appeler** et **Nous écrire** à partir du téléphone et du courriel du Profil de l'entreprise. Chaque ligne que vous avez est activée par défaut, sauf **Écrire sur WhatsApp**, qui reste désactivée tant que vous ne dites pas que le numéro est sur WhatsApp." },
          { p: "La page publique suit d'elle-même le téléphone du visiteur entre clair et sombre. Le sélecteur clair / sombre de cet écran ne change que le cadre d'aperçu. La formulation des boutons vient de la langue de votre entreprise, pas de la langue dans laquelle vous lisez les paramètres." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre lien** — l'adresse, **Copier le lien**, **Ouvrir**, et la case **La page est en ligne**. Dessous : « Collez ceci dans votre bio Instagram ou TikTok. »",
            "**Titre** — « Laissez vide pour utiliser le nom de votre entreprise. » — et **Une ligne en dessous** — « Facultatif. Vide signifie que rien ne s'affiche — nous n'en rédigeons pas à votre place. »",
            "**Suivez-nous** — Instagram, Facebook, TikTok, YouTube, LinkedIn et X. « Tapez un identifiant ou collez le lien du profil ; laissez vide pour masquer. »",
            "**Ce qui figure sur la page** — chaque ligne avec une case **Afficher sur la page**, son **Texte du bouton**, une poignée à glisser, **Monter** / **Descendre**, et son groupe : **Obtenir un prix**, **Rendez-vous**, **Contact** ou **Plus**. « Le premier est le grand bouton. »",
            "**Ajouter votre propre lien** — jusqu'à dix lignes que vous écrivez vous-même, chacune avec un texte, une adresse et une **Icône**.",
            "**Pas encore disponible** — les lignes que vous ne pouvez pas encore avoir, chacune avec l'écran qui la créerait.",
            "**Aperçu** — un cadre de téléphone mis à jour au fur et à mesure, avec un sélecteur **Clair** / **Sombre**, et **Enregistrer** en bas.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Comment le configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Lien de profil**.",
            "Écrivez le **Titre**, ou laissez-le vide pour utiliser le nom de votre entreprise, et **Une ligne en dessous** si vous en voulez une.",
            "Sous **Suivez-nous**, tapez vos identifiants. Un champ qui ne ressemble ni à un identifiant ni à un lien de profil n'est pas enregistré, et l'écran le dit avant que vous enregistriez.",
            "Sous **Ce qui figure sur la page**, cochez les lignes voulues, renommez un bouton dont la formulation par défaut n'est pas la vôtre, et glissez ou utilisez les flèches pour mettre la plus importante en premier — elle devient le grand bouton.",
            "Appuyez sur **Ajouter votre propre lien** pour tout le reste, comme une fiche Google ou une galerie ailleurs. Vos propres liens ont besoin d'un texte et d'une adresse.",
            "Appuyez sur **Enregistrer**, puis sur **Copier le lien**, et collez-le dans votre profil Instagram ou TikTok.",
          ] },
          { figure: "live:app-settings-links", caption: "Paramètres → Lien de profil — Votre lien avec Copier le lien et Ouvrir, les cartes Titre et Suivez-nous, les lignes ordonnées sous Ce qui figure sur la page, et l'aperçu téléphone." },
          { note: "Rien n'est enregistré tant que vous n'appuyez pas sur **Enregistrer**. Réordonner, renommer et désactiver est une modification en plusieurs étapes d'une seule page publique, et enregistrer chaque frappe mettrait des états à moitié finis devant quiconque touche le lien entre-temps." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { bullets: [
            "**La page est en ligne** — décochez-la et enregistrez, et l'adresse affiche une page introuvable jusqu'à ce que vous la recochiez. L'écran se lit alors « La page est désactivée — ce lien affiche une page introuvable. » La page est en ligne dès le départ.",
            "**Afficher sur la page** — cache ou affiche une ligne. Une ligne cachée garde sa place et sa formulation pour quand vous la ramènerez.",
            "**Texte du bouton** — remplace la formulation par défaut de cette ligne seulement. Vide signifie la valeur par défaut, jamais un bouton vide.",
            "**L'ordre** — la première ligne est le grand bouton. La page regroupe les lignes sous des titres, et les titres sont ordonnés selon la position de la première ligne de chaque groupe, alors mettre votre site web en premier met **Plus** en premier.",
            "**Clair** / **Sombre** — le cadre d'aperçu seulement. Les visiteurs obtiennent ce que leur téléphone demande.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et quiconque est au niveau Répartiteur ou Gestionnaire peuvent ouvrir et enregistrer cet écran; les connexions Équipier et Estimateur ne voient pas la ligne. La page publique n'exige rien — ni compte, ni application. Pour la page elle-même et ce qu'ouvre chaque bouton, voir [[the-bio-link|Le lien de profil]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Prendre rendez-vous est-il grisé?", a: "Vous n'avez aucun type de visite actif. La liste Pas encore disponible dit quel écran en crée un — Paramètres → Page de rendez-vous." },
      { q: "Pourquoi WhatsApp est-il désactivé alors que j'ai un numéro de téléphone?", a: "Avoir un numéro ne veut pas dire que WhatsApp y est, et un lien WhatsApp vers un numéro qui ne l'a pas ouvre une conversation avec personne. Cochez Afficher sur la page quand c'est le cas." },
      { q: "Y a-t-il un code QR?", a: "Pas sur cet écran. L'adresse est assez courte pour être dite à voix haute, et n'importe quel générateur de codes QR la transformera en carré pour la camionnette." },
    ],
  },

  "settings-phone-receptionist": {
    title: "Réceptionniste téléphonique",
    summary:
      "La ligne des Paramètres qui configure la réceptionniste IA : crédit, un numéro, ce qu'elle dit, l'interrupteur de réponse, les rappels, les textos d'équipe et la vérification de bout en bout — ce que change chaque carte et qui peut l'ouvrir.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Côté client → Réceptionniste téléphonique** s'intitule « Répond aux appels que vous ne pouvez pas prendre, note les détails et fixe des visites selon vos vraies disponibilités. Il ne donne jamais de prix. » L'écran suit l'ordre des décisions — le crédit, puis un numéro, puis les mots, puis l'interrupteur — et une nouvelle entreprise voit les cartes numérotées de 1 à 7. Une fois la configuration faite, les numéros disparaissent et les mêmes cartes restent.",
      "Cet article parcourt l'écran carte par carte. Ce que fait la réceptionniste lors d'un appel, ce que coûte une minute et ce que la page de tarifs d'aucun autre outil ne liste se trouve dans [[the-phone-receptionist|La réceptionniste téléphonique]]; ce qu'elle a fait de chaque appel est l'écran Réceptionniste de la barre latérale principale, voir [[the-receptionist-call-log|Le journal d'appels de la réceptionniste]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une barre d'état en haut montre votre numéro et s'il répond. Tout ce que la réceptionniste peut dépenser est tarifé par le serveur et imprimé à l'écran avant que vous vous engagiez : le tarif à la minute sur la carte **Crédit**, la location mensuelle à côté de chaque type de numéro, les montants de recharge. Le navigateur n'envoie jamais un montant." },
          { note: "La réceptionniste fonctionne avec du crédit prépayé en dollars américains. Les appels sont mesurés à la minute, les numéros sont loués au mois, et les deux sortent du même solde." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Les sept cartes",
        blocks: [
          { bullets: [
            "**Crédit** — le **Solde :**, le tarif (« 35 ¢ la minute, arrondi à la minute supérieure, minimum d'une minute. La location mensuelle de votre numéro est prélevée sur ce même crédit. »), **Ajouter du crédit**, **Où le crédit est passé**, et la carte **Recharger automatiquement**.",
            "**Votre numéro** — « Le numéro sur lequel la réceptionniste répond. » Trois façons d'en obtenir un : **Garder mon numéro, renvoyer les appels manqués** (marqué **Recommandé**), **Obtenir un nouveau numéro** avec **Choisir le numéro vous-même**, ou **Transférer mon numéro**. Un numéro actif affiche ses codes de renvoi, sa prochaine date de location et un lien **Rendre**.",
            "**Ce qu'elle dit** — « Elle ne donnera jamais de prix, ne promettra jamais une heure qu'elle n'a pas vérifiée et ne prétendra jamais être une personne. » La **Salutation**, **Ce qu'elle devrait savoir** avec **Préparer à partir de mon profil d'entreprise**, **Ce qu’il demande aux appelants**, la **Voix** avec les aperçus **Écouter …**, et **Comment il parle**.",
            "**Répondre à mes appels** — le seul interrupteur : **Commencer à répondre aux appels** / **Elle répond — désactiver**.",
            "**Rappeler les clients automatiquement** — **Activer les rappels de soumission** et **Quelles soumissions déclenchent un appel**. Traité dans [[quote-callbacks|Rappels de soumission]].",
            "**Permettre à l'équipe d'envoyer photos et mises à jour par texto** — un lien **Configurer les textos de l'équipe**. Les textos d'équipe utilisent leur propre numéro, distinct de celui qui répond à vos appels, et se configurent sur la page de la boîte de réception d'équipe : [[the-crew-inbox|La boîte de réception d'équipe : photos et mises à jour par texto]].",
            "**Vérifier de bout en bout** — **Lancer la vérification** interroge le service téléphonique lui-même sur chaque maillon entre quelqu'un qui compose et un prospect qui atterrit dans FieldQuo. Affiché dès que vous avez un numéro.",
          ] },
          { figure: "live:app-settings-voice", caption: "Paramètres → Réceptionniste téléphonique — la barre d'état, la carte Crédit avec son solde et ses recharges, Votre numéro, et les cartes de salutation, de voix et de réglage dessous." },
        ],
      },
      {
        id: "set-it-up",
        heading: "Comment la configurer",
        blocks: [
          { steps: [
            "Sous **Crédit**, appuyez sur **Ajouter du crédit** si le solde est vide — 10 $, 30 $, 50 $, 100 $, ou tout montant entre 5 $ et 1 000 $. Votre premier numéro vient avec 30 minutes de crédit gratuites, et le premier mois de location du numéro en est prélevé.",
            "Sous **Votre numéro**, choisissez **Garder mon numéro, renvoyer les appels manqués** à moins d'avoir une raison de ne pas le faire. FieldQuo loue une ligne pour la réceptionniste et affiche le code à composer depuis votre propre téléphone; vos clients continuent de composer le numéro sur la camionnette, et seuls les appels que vous manquez atteignent la réceptionniste.",
            "Sous **Ce qu'elle dit**, écrivez la **Salutation** et appuyez sur **Préparer à partir de mon profil d'entreprise**. Il liste les questions auxquelles il ne peut pas répondre à partir de vos paramètres — ce que vous refusez, ce qui compte comme urgent, quoi dire quand vous êtes fermé — sous **Répondez à ceci dans vos propres mots**. Tapez par-dessus chaque crochet; une ligne laissée entre crochets est sautée.",
            "Choisissez une **Voix** et écoutez avec **Écouter …**. Laissez **Comment il parle** à ses valeurs par défaut à moins que les appelants ne soient sans cesse coupés.",
            "Appuyez sur **Commencer à répondre aux appels**, puis sur **Lancer la vérification** sous **Vérifier de bout en bout** et appelez votre propre numéro.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["**Garder mon numéro, renvoyer les appels manqués**", "Loue une ligne locale à 4 $ par mois sur laquelle la réceptionniste répond. Votre propre numéro n'est pas touché; vous réglez le renvoi conditionnel sur votre téléphone avec le code affiché, et l'annulez en composant ##002#."],
              ["**Obtenir un nouveau numéro** / **Choisir le numéro vous-même**", "Achète une ligne distincte — locale à 4 $ par mois, sans frais à 9 $ par mois plus 5 ¢ la minute — dans l'indicatif régional de votre choix. En choisir un l'achète sur-le-champ et le premier mois sort de votre crédit."],
              ["**Transférer mon numéro**", "Lance un transfert. Rien n'est facturé pour commencer; votre numéro continue de fonctionner chez votre ancien fournisseur pendant les deux à quatre semaines que prend le transfert, et la réceptionniste ne peut pas y répondre tant qu'il n'est pas arrivé."],
              ["**Salutation**, **Ce qu'elle devrait savoir**", "La première chose que chaque appelant entend, et les faits qu'elle peut utiliser au-delà de vos paramètres. Les heures d'ouverture, les services et les secteurs sont lus dans vos paramètres à chaque appel et vont là, pas dans la note."],
              ["**Voix**, **Comment il parle**", "Quelle voix parle, et quatre choix de réglage — ce qu'elle fait quand un appelant lui coupe la parole, d'où les appelants appellent habituellement, à quelle vitesse elle répond, quelle impression elle donne. Aucun d'eux ne change ce qu'elle a le droit de dire."],
              ["**Répondre à mes appels**", "Si le numéro est répondu ou non. Il refuse de s'activer sans numéro et sans crédit pour au moins une minute. Le désactiver arrête la réponse sur-le-champ — « Si ce numéro est sur votre camion, redirigez-le avant de désactiver. »"],
              ["**Recharger automatiquement**", "Désactivé tant que vous ne l'activez pas. Enregistre une carte et, quand le solde tombe sous 5 $, 10 $ ou 20 $, facture le montant choisi — au plus 3 fois par jour. Il se désactive de lui-même et vous prévient si la carte est refusée."],
              ["**Rendre …**", "Rend définitivement un numéro acheté. Il est supprimé chez la compagnie de téléphone, ne peut pas être récupéré, et le reste du mois payé n'est pas remboursé."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et quiconque est au niveau Répartiteur ou Gestionnaire voient la ligne et peuvent tout y changer — acheter un numéro et recharger dépensent l'argent de l'entreprise. Les connexions Équipier et Estimateur ne la voient pas. Le journal d'appels de la barre latérale principale a sa propre règle." },
        ],
      },
    ],
    faq: [
      { q: "L'interrupteur refuse de s'activer.", a: "Il lui faut un numéro actif et assez de crédit pour une minute. La ligne sous Répondre à mes appels dit lequel manque — « Mettez d'abord un numéro en place ci-dessus » ou « Ajoutez d'abord du crédit »." },
      { q: "Peut-elle donner un prix au téléphone?", a: "Jamais. Elle peut relire des frais de visite que vous avez publiés sur votre page de rendez-vous, parce que c'est votre propre chiffre, mais elle ne chiffre jamais le travail." },
      { q: "J'ai appelé et rien n'est apparu dans FieldQuo.", a: "Appuyez sur Lancer la vérification sous Vérifier de bout en bout. Il interroge le service téléphonique sur chaque maillon et nomme celui qui est brisé, et peut renvoyer vos paramètres au fournisseur d'un seul bouton." },
    ],
  },

  "settings-ai-employee": {
    title: "Employé IA",
    summary:
      "La ligne des Paramètres où vous embauchez un assistant qui répond au message d'un client — son poste, comment il écrit, ce qu'il lit, brouillon ou envoi — et pourquoi, aujourd'hui, chaque réponse est un brouillon qui vous attend.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Côté client → Employé IA** — « Un assistant qui répond au message d'un client à votre place — à partir de vos tarifs et des documents que vous lui donnez. » Vous choisissez le poste qu'il occupe, comment il écrit, ce qu'il peut lire, jusqu'où il peut aller, et s'il rédige un brouillon ou envoie. La ligne porte une pastille **Aperçu**.",
      "L'écran s'ouvre sur la seule chose qu'il ne peut pas encore faire : « Les réponses ne peuvent pas encore sortir. L'employé IA répond à vos messages Facebook et Instagram, et Meta n'a pas approuvé la messagerie pour FieldQuo. Tout fonctionne ici — il rédige, et les brouillons attendent ci-dessous que vous les envoyiez. » Tout ce qui suit est réel et fait tourner le vrai code; l'envoi attend Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le poste est un ensemble de capacités, pas une personnalité : « Le poste décide de ce qu'il a le droit de faire, pas seulement du ton. Une réceptionniste n'a aucun moyen de consulter un prix — c'est tout l'intérêt d'en choisir un. » Chaque poste partage la même règle, imprimée à l'écran : il ne peut jamais inventer un prix, une date ni une politique, et si la réponse n'est pas dans vos propres données ou vos propres documents, il confie la conversation à une personne." },
          { p: "Chaque réponse et chaque test dépensent du crédit IA, mesuré comme le reste de FieldQuo AI. Quand l'allocation est épuisée, l'écran le dit avec un lien **Recharger le crédit IA** et l'employé s'arrête plutôt que de deviner. Voir [[settings-ai-credit|Crédit IA]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Quel poste occupe-t-il ?** — quatre cartes : **Chargé de vente**, **Réceptionniste**, **Soutien technique**, **Autre chose**, chacune avec **Il peut :** et **Il ne peut pas :** dessous.",
            "**Comment il écrit** — **Comment vous l'appelez** (pour vous, jamais dit aux clients), **Ton**, **Phrase d'ouverture (facultatif)**, **Vos instructions**, **Quand il doit aller chercher quelqu'un**.",
            "**Brouillon, ou envoi ?** — **Rédige-moi un brouillon (recommandé)** ou **L'envoyer automatiquement**.",
            "**Limites** — **Répondre uniquement pendant les heures d'ouverture**, **Nombre maximal de réponses dans une conversation**, **Activer l'employé IA**, puis **Enregistrer**.",
            "**Ce qu'il lit** — **Téléverser un fichier** ou **Coller du texte à la place**, et la liste de ce qu'il a lu, avec une raison sur tout ce qu'il n'a pas pu lire.",
            "**Essayez-le** — une case de test et **Voir la réponse**; puis **En attente de vous**, les brouillons avec **L'envoyer** / **Pas celle-ci**, et **Il s'est arrêté sur celles-ci** avec **Le laisser répondre à nouveau**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "Comment l'embaucher",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Employé IA** et choisissez un poste. **Chargé de vente** est le seul autorisé à s'approcher d'un chiffre : il lit vos tarifs et peut monter une estimation instantanée à partir de vos propres taux. **Réceptionniste** prend les coordonnées et fixe un rappel. **Soutien technique** répond à partir des documents que vous téléversez et nomme le document d'où vient la réponse.",
            "Remplissez **Vos instructions** — les secteurs que vous couvrez, ce que vous ne faites pas, la façon dont vous aimez que les choses soient formulées — et **Quand il doit aller chercher quelqu'un**.",
            "Laissez **Rédige-moi un brouillon (recommandé)** sélectionné. Réglez **Nombre maximal de réponses dans une conversation**; zéro le met en pause sans perdre votre configuration.",
            "Sous **Ce qu'il lit**, téléversez votre politique, vos notes de dépannage ou un manuel, ou collez le texte.",
            "Cochez **Activer l'employé IA** et appuyez sur **Enregistrer**. Puis tapez un message de client sous **Essayez-le** et appuyez sur **Voir la réponse** — il montre ce qu'il a utilisé et ce que le test a coûté.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Paramètres → Employé IA — l'avis que les réponses ne peuvent pas encore sortir, les quatre cartes de poste, et Comment il écrit dessous." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que change chaque réglage",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il fait"],
            rows: [
              ["Le poste", "Fixe les outils qu'il peut appeler. Chargé de vente : consulter les prix des services, monter une estimation instantanée, fixer un rappel, confier à une personne. Les trois autres : fixer un rappel et confier seulement."],
              ["**Ton**", "Professionnel, chaleureux ou bref — comment les mêmes faits sont formulés."],
              ["**Rédige-moi un brouillon**", "La réponse attend sous **En attente de vous** avec **L'envoyer** et **Pas celle-ci**. « En envoyer une l'envoie dans la conversation, exactement comme si vous l'aviez écrite. »"],
              ["**L'envoyer automatiquement**", "« La réponse part directement au client sans que personne ne la lise d'abord. » Il refuse toujours d'annoncer un prix qui ne vient pas de vos tarifs et s'arrête toujours quand il n'est pas sûr. Aujourd'hui le canal est bloqué, alors il rédige un brouillon dans les deux cas."],
              ["**Répondre uniquement pendant les heures d'ouverture**", "Utilise les heures d'ouverture enregistrées sous Profil de l'entreprise; en dehors, le message vous attend. Sans heures enregistrées, cela ne fait rien — « il ne devinera pas un lundi-vendredi à votre place. »"],
              ["**Nombre maximal de réponses dans une conversation**", "Le plafond par fil. Quand il est atteint, le fil apparaît sous **Il s'est arrêté sur celles-ci** avec **Le laisser répondre à nouveau**."],
            ],
          } },
          { warning: "« Nous pouvons lire du texte brut : .txt, .md et .csv, ou du texte que vous collez. Nous ne pouvons pas encore lire un PDF ni un fichier Word — si vous en téléversez un, il apparaîtra ci-dessous marqué non lu, et la solution est de coller le texte ou de l'exporter en .txt. » Les documents téléversés sont traités comme des preuves, jamais comme des ordres — une instruction cachée dans un manuel n'est que du texte." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et quiconque est au niveau Répartiteur ou Gestionnaire — le même échelon que la réceptionniste téléphonique, parce qu'il décide de ce qui est dit aux clients au nom de l'entreprise et dépense l'allocation IA de l'entreprise. Les connexions Équipier et Estimateur ne voient pas la ligne. Envoyer ou écarter un brouillon exige le même accès que l'écran. L'histoire complète, y compris comment les brouillons apparaissent dans Messages, est [[the-ai-employee|L'employé IA : des brouillons que vous approuvez]]." },
        ],
      },
    ],
    faq: [
      { q: "Les clients sauront-ils qu'ils parlent à un logiciel?", a: "Il ne prétend jamais être une personne nommée. Si on le lui demande franchement, il dit que la réponse est automatique et qu'un membre de l'équipe fera un suivi. Le nom que vous lui donnez est pour vous." },
      { q: "Peut-il donner un prix?", a: "Seulement le Chargé de vente, et seulement un chiffre qu'un outil FieldQuo a calculé à partir de vos propres tarifs, qu'il répète en citant sa source. Il ne peut ni additionner, ni rabaisser, ni arrondir." },
      { q: "Pourquoi n'y a-t-il rien sous En attente de vous?", a: "Aucun message auquel il pouvait répondre n'est arrivé — habituellement parce qu'aucune Page n'est connectée ou que Meta n'a pas encore approuvé la messagerie — ou il est désactivé, hors des heures d'ouverture, ou au-delà de son plafond." },
    ],
  },

  "settings-reviews": {
    title: "Avis",
    summary:
      "La ligne des Paramètres qui demande un avis à chaque client une fois son chantier marqué terminé — votre lien d'avis, l'interrupteur Demander automatiquement, le délai, un compte de file en direct — et les témoignages affichés sur votre site web.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Côté client → Avis** — « Demandez automatiquement un avis aux clients une fois leur chantier terminé. » Une fois un chantier marqué terminé, le client reçoit un seul courriel avec votre lien d'avis, après un délai de votre choix. L'écran ne dit pas seulement Activé : il vous dit combien de clients sont dans la file en ce moment et combien ont été sollicités au cours des 30 derniers jours.",
      "La moitié inférieure du même écran, **Avis sur votre site web**, est l'endroit où vont les avis une fois que vous en avez : les témoignages que votre site web affiche, et un extrait pour les afficher sur un site que vous gérez déjà.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La demande est un courriel, de votre entreprise, avec votre logo, votre couleur et votre nom dans la ligne De — jamais un texto. Il part une fois par chantier, point : le chantier est marqué avant que le courriel parte, alors deux exécutions qui se chevauchent ne peuvent jamais demander deux fois. Le client doit avoir une adresse courriel et ne pas s'être désabonné. FieldQuo vérifie chaque heure, alors un délai de 4 heures signifie environ 4 heures, pas le lendemain matin." },
          { p: "La note au bas de l'écran dit le reste : « Les clients qui se sont désabonnés sont ignorés, et toute personne qui répond en signalant un problème vous joint directement plutôt que la page d'avis. »" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre lien d'avis** avec **Enregistrer** — « Habituellement votre lien d'avis Google. Dans votre profil d'entreprise Google, choisissez « Demander des avis » et copiez le lien court. » Une fois enregistré : **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**.",
            "**Demander automatiquement** — l'interrupteur. Sans lien, il est désactivé et se lit « Ajoutez d'abord votre lien d'avis ci-dessus. »; avec un lien, il se lit « Chaque client ayant une adresse courriel reçoit un seul message après que son chantier est marqué comme terminé. Jamais plus d'un. »",
            "**Quand demander** — **2 heures plus tard**, **4 heures plus tard**, **Le lendemain**, **Deux jours plus tard**, **Trois jours plus tard**, **Une semaine plus tard**. Affiché une fois l'interrupteur activé.",
            "La phrase de la file — par exemple « 3 clients sont dans la file, et 12 ont été sollicité(s) au cours des 30 derniers jours. »",
            "**Avis sur votre site web** — « Ceux que vous activez apparaissent sur votre site — les six premiers, dans l'ordre ci-dessous. » Chaque avis avec **Afficher sur le site**, **Modifier**, **Supprimer**, **Monter** / **Descendre**; puis **Ajouter un avis**, **Coller une liste** avec **Choisir un fichier CSV** et **Importer**, et **Vos avis sur votre propre site web** avec l'extrait.",
          ] },
        ],
      },
      {
        id: "switch-it-on",
        heading: "Comment l'activer",
        blocks: [
          { steps: [
            "Collez votre lien sous **Votre lien d'avis** et appuyez sur **Enregistrer**. Toute page http ou https fonctionne — Google, Facebook, HomeStars, votre propre formulaire. Appuyez sur **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**.",
            "Activez **Demander automatiquement**. Le serveur le refuse sans lien, tout comme l'écran.",
            "Choisissez un délai sous **Quand demander**. La phrase de la file dessous se met à jour à partir des mêmes colonnes que lit la tâche horaire.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Paramètres → Avis — Votre lien d'avis avec Enregistrer, l'interrupteur Demander automatiquement, les puces Quand demander, et Avis sur votre site web dessous." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { bullets: [
            "**Votre lien d'avis** — où le bouton du courriel envoie le client, et le bouton **Laisser un avis** de votre page de lien de profil. Enregistrez un champ vide et l'interrupteur se désactive de lui-même, parce qu'il n'y aurait nulle part où envoyer qui que ce soit.",
            "**Demander automatiquement** — si les chantiers terminés font l'objet d'une demande ou non. Désactivé, rien n'est envoyé et la file n'est pas affichée.",
            "**Quand demander** — le délai après l'heure de fin. Un chantier terminé il y a plus de 30 jours ne fait jamais l'objet d'une demande, et les chantiers importés de votre ancien système sont ignorés, alors activer ceci aujourd'hui n'envoie pas de courriel à chaque client que vous avez jamais eu.",
            "**Afficher sur le site** — met cet avis sur votre site web FieldQuo et dans l'intégration; les six premiers avis activés, dans l'ordre que vous fixez. Les avis importés commencent désactivés.",
            "L'extrait d'intégration — « Il affiche les avis que vous avez approuvés, dans vos propres couleurs, sans aucune marque FieldQuo. Tant que vous n'en avez aucun, il n'affiche rien du tout et se réduit à une hauteur nulle. »",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs et quiconque est au niveau Répartiteur ou Gestionnaire peuvent ouvrir et modifier cet écran; les connexions Équipier et Estimateur ne voient pas la ligne. Le courriel lui-même et les règles derrière sont dans [[ask-for-reviews-automatically|Demander des avis automatiquement]]; la moitié des témoignages est dans [[testimonials-on-your-website|Témoignages sur votre site web]]." },
        ],
      },
    ],
    faq: [
      { q: "Envoie-t-il aussi un texto au client?", a: "Non. La demande d'avis est un courriel seulement." },
      { q: "Puis-je solliciter un client à la main?", a: "Pas depuis cet écran — c'est automatique et une fois par chantier. Envoyez-lui votre lien d'avis vous-même." },
      { q: "Ai-je besoin d'un site web FieldQuo pour les témoignages?", a: "Non. Activez-les ici et collez l'extrait sous Vos avis sur votre propre site web dans n'importe quel site que vous gérez; il ne porte aucune marque FieldQuo." },
    ],
  },

  "settings-data-migration": {
    title: "Migration de données",
    summary:
      "La ligne des Paramètres pour le service de migration payant de FieldQuo — demandez-le, réservez un appel, acceptez ou refusez le prix, payez par la facturation FieldQuo, téléversez vos exports, et voyez apparaître les clients et les soumissions que le personnel crée.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Compte → Migration de données** — « Importez vos anciens clients et soumissions dans FieldQuo — depuis QuickBooks, Jobber, un tableur ou une boîte à chaussures. » C'est un service fait par le personnel de FieldQuo, pas un importateur libre-service, et c'est le seul cas où FieldQuo écrit dans votre compte.",
      "Les règles sont strictes : le personnel ne peut que créer de nouveaux dossiers, jamais modifier ni supprimer quoi que ce soit qui existe déjà; seulement après que vous avez accepté un prix et l'avez payé; et chaque dossier créé est consigné là où vous pouvez le voir. Pour toute l'histoire, voir [[the-data-migration-service|Le service de migration de données]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une seule demande est active à la fois. Tant que vous n'en avez pas, l'écran est le formulaire **Demander une migration**; dès que vous en avez une, c'est la carte de cette demande avec sa pastille d'état, et les actions que l'état permet. Le paiement passe par la facturation FieldQuo — la même carte que votre abonnement — jamais par votre propre compte Stripe, qui sert à vos clients pour vous payer." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Demander une migration** — « Dites-nous ce que vous voulez importer et nous réserverons un appel pour définir la portée et le prix. » **Où se trouvent vos données actuellement?**, **Autre chose à savoir**, et le bouton **Demander une migration**.",
            "La carte de la demande, avec l'un de neuf états : **Demandée**, **Appel réservé**, **Soumission prête**, **Acceptée — paiement dû**, **Payée**, **En cours**, **Terminée**, **Refusée**, **Annulée**.",
            "**Réservez un appel avec FieldQuo** — des plages ouvertes à choisir, ou « Aucune plage n'est disponible pour le moment — nous vous contacterons pour en fixer une. »",
            "**Accepter** / **Refuser** sur le prix, puis **Payer et commencer la migration** — « Vous serez redirigé vers Stripe pour compléter le paiement en toute sécurité. »",
            "**Ce qui a été importé** — chaque dossier créé par FieldQuo, avec sa date.",
            "**Documents** — « Téléversez un export QuickBooks ou Jobber, un tableur, ou un ZIP de vos anciens dossiers. » **Téléverser un fichier** accepte CSV, XLS, XLSX, TXT, TSV, PDF, ZIP et les formats QuickBooks, jusqu'à 25 Mo chacun.",
            "**Demandes précédentes** — les migrations antérieures, avec leur état.",
          ] },
        ],
      },
      {
        id: "how-it-goes",
        heading: "Comment se déroule une migration",
        blocks: [
          { steps: [
            "Remplissez **Demander une migration**. L'état se lit **Demandée**.",
            "Réservez un appel parmi les plages ouvertes, ou attendez que FieldQuo en fixe un. La carte se lit alors **Appel réservé** avec l'heure.",
            "FieldQuo chiffre le travail. L'état devient **Soumission prête** et la carte affiche le prix avec **Accepter** et **Refuser**.",
            "Appuyez sur **Accepter** — « Soumission acceptée — payez quand vous serez prêt à commencer. » — puis sur **Payer et commencer la migration**. Après Stripe, l'état est **Payée**.",
            "Le personnel crée les dossiers; l'état est **En cours** et chacun apparaît sous **Ce qui a été importé** à mesure qu'il est ajouté. **Terminée** clôt le tout : « Migration terminée. »",
          ] },
          { figure: "live:app-settings-migration", caption: "Paramètres → Migration de données — la carte de la demande avec sa pastille d'état, le prix avec Accepter et Refuser, et Documents avec Téléverser un fichier dessous." },
          { note: "**Annuler cette demande** est affiché tant que l'état est Demandée, Appel réservé, Soumission prête ou Acceptée. Après le paiement, annuler est une conversation avec le soutien plutôt qu'un bouton. Les documents peuvent être téléversés à chaque étape sauf Refusée et Annulée." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "Ce que FieldQuo écrit, et ce qu'il ne touche jamais",
        blocks: [
          { bullets: [
            "Il **crée** des fiches de clients et des soumissions. Ce sont les deux types de dossiers que le service écrit aujourd'hui; une soumission migrée est un brouillon, marqué comme historique, et rien n'est envoyé à qui que ce soit.",
            "Il ne met **jamais** à jour ni ne supprime un client, une soumission, une facture ou un chantier qui existait avant. Le code n'a aucun chemin qui le permette.",
            "Il n'écrit **que** tant que la demande est Payée ou En cours, vérifié à neuf à chaque écriture. Annulez la migration et l'écriture s'arrête à cet instant.",
            "Chaque écriture est consignée avec qui, quand et ce qui a été créé, et ce journal est **Ce qui a été importé**.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement — les mêmes personnes qui voient la facturation de l'entreprise, parce que le prix et le bouton de paiement sont l'affaire du propriétaire. Tous les autres sont refusés sur le serveur, que la ligne ait été dessinée ou non. Le prix et le reçu sont expliqués dans [[paying-for-the-migration-service|Payer le service de migration]]." },
        ],
      },
    ],
    faq: [
      { q: "Combien ça coûte?", a: "Il n'y a pas de prix de liste. FieldQuo chiffre chaque migration après l'appel, et vous acceptez ou refusez le montant sur cet écran." },
      { q: "FieldQuo peut-il corriger une de mes soumissions existantes pendant qu'il y est?", a: "Non. Le personnel ne peut que créer de nouveaux dossiers. Tout ce qui existait avant la migration est hors de sa portée, par conception." },
      { q: "Est-ce la même chose qu'une session de soutien qui regarde mon compte?", a: "Non. Une session de soutien est en lecture seule, sans exception. La migration est la seule porte pour les écritures, et vous seul pouvez l'ouvrir en payant." },
    ],
  },

  "settings-product-updates": {
    title: "Nouveautés",
    summary:
      "La ligne des Paramètres qui liste ce qui a changé dans FieldQuo — un journal daté avec un résumé par entrée et, quand il existe, un article complet — sans rien à configurer et visible par chaque membre.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Compte → Nouveautés** — « Les nouveautés de FieldQuo. » C'est un journal des changements daté, du plus récent au plus ancien, écrit par FieldQuo et identique pour chaque entreprise. Rien n'y est un paramètre; c'est là que vous voyez ce qui a changé depuis votre dernière visite.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque entrée est une carte avec la date, un titre et un court résumé qui se suffit à lui-même. Quand un article plus long existe, la carte porte **Lire la nouveauté complète**; la page complète s'ouvre à la place avec **Retour aux nouveautés** en haut. Une entrée sans article n'affiche aucun lien plutôt qu'un lien qui ne mène nulle part." },
          { p: "Les entrées sont écrites en anglais quelle que soit la langue dans laquelle vous lisez l'application. Les mots de la page elle-même — le titre, **Lire la nouveauté complète**, **Retour aux nouveautés** — suivent votre langue; le journal lui-même non, parce qu'un journal à moitié traduit vaut moins qu'un journal honnêtement en anglais." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Le titre **Nouveautés du produit** et la ligne « Les nouveautés de FieldQuo. »",
            "Une carte par nouveauté : la date, formatée pour votre langue; le titre; le résumé; et **Lire la nouveauté complète** quand un article complet existe.",
            "L'article complet : la même date et le même titre, les paragraphes, et **Retour aux nouveautés**.",
          ] },
          { figure: "live:app-settings-product-updates", caption: "Paramètres → Nouveautés — les cartes datées, chacune avec son résumé et Lire la nouveauté complète quand un article existe." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde dans l'entreprise, y compris les équipiers. C'est l'une des trois lignes des Paramètres qu'une connexion Équipier garde — avec **Langue** et **Vos heures** — parce que rien n'y est propre à l'entreprise et qu'il n'y a rien à refuser. Il n'y a aucune API derrière et rien à enregistrer." },
          { tip: "FieldQuo ne vous envoie ni courriel ni notification quand une entrée est ajoutée. Si vous voulez savoir ce qui a changé, c'est cette ligne qu'il faut regarder." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je désactiver les nouveautés, ou m'y abonner?", a: "Ni l'un ni l'autre. Il n'y a ni notification ni paramètre — la page liste simplement ce qui a été livré." },
      { q: "Pourquoi une entrée n'est-elle pas dans ma langue?", a: "Le journal est volontairement en anglais seulement. L'habillage de la page suit votre langue; les entrées non." },
    ],
  },

  "settings-account-and-billing": {
    title: "Compte et facturation",
    summary:
      "La ligne des Paramètres qui est la même page que Forfait dans la barre latérale principale : votre forfait, son prix et sa prochaine date de facturation, le portail de facturation, un raccourci vers vos encaissements Stripe, Annuler le forfait, et les quatre forfaits au choix.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Compte → Compte et facturation** — « Votre forfait, vos sièges et vos informations de paiement. » C'est le même écran qu'ouvre la ligne **Forfait** de la barre latérale principale, atteint depuis le menu Paramètres. Cet article en est une courte carte; l'histoire complète des forfaits, des sièges, des changements et de l'annulation est dans [[your-plan-and-seats|Votre forfait et vos sièges]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "La carte du forfait : le nom et l'état du forfait, le prix avec **/mois** ou **/an** et **Engagement d'un an** le cas échéant, la ligne des sièges (par exemple « 6 sièges · 11 équipiers inclus gratuitement »), **Jours restants dans l'essai** pendant un essai, et **Prochaine date de facturation**.",
            "Un changement programmé, si vous en avez réservé un — « Passage à … le … » — avec **Garder mon forfait actuel** pour l'annuler avant qu'il n'arrive.",
            "**Vérifier auprès de Stripe** — relit votre abonnement chez Stripe quand la page n'affiche pas encore un paiement que vous avez fait.",
            "**Gérer la facturation et le mode de paiement** — ouvre le portail de facturation de Stripe pour votre carte, vos factures et vos reçus.",
            "**Voir ce que mes clients m'ont payé** — un raccourci vers **Paramètres → Paiements**, le compte connecté dans lequel vos clients paient. Un compte Stripe différent de l'abonnement ci-dessus.",
            "**Annuler le forfait** — le parcours d'annulation.",
            "**Forfaits** — un sélecteur **Mensuel** / **Engagement d'un an** et une carte par forfait avec ses sièges et ses connexions d'équipiers, **FieldQuo AI inclus**, et **Choisir ce forfait**, **Passer à l'année** ou **Forfait actuel**.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Paramètres → Compte et facturation — la carte du forfait avec l'état, le prix, les sièges et la prochaine date de facturation, les boutons de facturation, et les forfaits dessous." },
        ],
      },
      {
        id: "what-each-button-does",
        heading: "Ce que fait chaque bouton",
        blocks: [
          { p: "**Choisir ce forfait** sur un forfait moins cher ou une autre cadence programme le changement pour la fin de votre période de facturation en cours et ne facture rien d'ici là — « C'est fait — votre forfait change le {date}. Rien n'est facturé d'ici là. » Sur un forfait plus cher, il prend effet tout de suite, et la différence pour le reste de la période est facturée. Dans les deux cas, une confirmation nomme le forfait, la cadence et la date avant que quoi que ce soit n'arrive. Voir [[change-your-plan|Changer de forfait]], [[update-your-payment-method|Mettre à jour votre mode de paiement]] et [[cancel-your-subscription|Annuler votre abonnement]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. Ce que l'entreprise paie à FieldQuo est l'affaire du propriétaire, alors la ligne est cachée — pas affichée en lecture seule — à tous les autres, et chaque commande qu'elle porte est de toute façon refusée sur le serveur à quiconque d'autre." },
        ],
      },
    ],
    faq: [
      { q: "J'ai payé mais la page dit encore essai.", a: "Appuyez sur Vérifier auprès de Stripe. La page relit l'abonnement et dit si Stripe n'a encore rien de nouveau." },
      { q: "Où sont mes reçus?", a: "Gérer la facturation et le mode de paiement ouvre le portail de Stripe, qui liste chaque facture et chaque reçu de votre abonnement. Voir [[invoices-and-receipts-from-fieldquo|Factures et reçus de FieldQuo]]." },
    ],
  },

  "settings-refer-and-earn": {
    title: "Parrainage",
    summary:
      "La ligne des Paramètres qui est la même page que Parrainage dans la barre latérale principale : votre lien de parrainage, le partage par WhatsApp et par texto, une invitation par courriel ou par texto, les mois gagnés et les entreprises que vous avez parrainées.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Compte → Parrainage** est la même page que la ligne **Parrainage** de la barre latérale principale — « Parrainez une autre entreprise et obtenez un mois de FieldQuo gratuit de plus, une fois qu'elle devient cliente payante. » Un mois gratuit pour l'entreprise que vous parrainez, à l'inscription; un mois gratuit pour vous, quand elle fait son premier vrai paiement. Ceci est la version courte; l'article complet est [[refer-another-business|Parrainer une autre entreprise, gagner un mois gratuit]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre lien** avec **Copier** — « Assez court pour être dit à voix haute. Mettez-le sur une carte professionnelle, au bas d'une facture ou sur un camion. »",
            "**Partager l'invitation** — un bouton WhatsApp, et **Envoyer par texto** sur un téléphone, chacun ouvrant votre propre application avec le message prêt.",
            "**Envoyer une invitation** — **Courriel** ou **Texto**, puis **Son courriel** ou **Son numéro de cellulaire**, **Son nom**, et **Envoyer l'invitation**. « Nous envoyons un seul message et ne faisons pas de relance. Jusqu'à 20 invitations par jour. »",
            "Les mois gagnés — « 1 mois gratuit gagné » — et « Ajouté automatiquement à votre compte lorsqu'une entreprise que vous avez parrainée effectue son premier paiement. »",
            "**Entreprises que vous avez parrainées**, chacune marquée **Crédité** ou **Inscrit — pas encore payant**, et **Invitations envoyées** avec **Inscrit** ou **Échoué** sur chacune.",
          ] },
          { figure: "live:app-settings-refer", caption: "Paramètres → Parrainage — Votre lien avec Copier, les boutons de partage, Envoyer une invitation, et les entreprises parrainées dessous." },
        ],
      },
      {
        id: "how-the-month-works",
        heading: "Comment fonctionne le mois",
        blocks: [
          { table: {
            head: ["Qui", "Ce qu'il obtient", "Quand"],
            rows: [
              ["L'entreprise que vous avez parrainée", "Un mois d'essai gratuit de plus", "À l'inscription par votre lien ou votre invitation"],
              ["Vous", "Un mois gratuit", "Quand cette entreprise fait son premier vrai paiement"],
            ],
          } },
          { p: "Votre mois est un mois du produit : pendant un essai, il repousse la fin de l'essai; sur un forfait payant, il reporte le prochain prélèvement d'un mois. Un second parrainage ajoute un second mois. La façon dont il atterrit sur votre abonnement est dans [[referral-months|Mois de parrainage]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. La page liste quelles entreprises ont été parrainées et ce qui a été gagné, et envoyer une invitation est réservé aux propriétaires et administrateurs sur le serveur, alors la ligne est cachée à tous les autres plutôt qu'affichée en lecture seule." },
        ],
      },
    ],
    faq: [
      { q: "Ils se sont inscrits mais je n'ai pas encore de mois.", a: "Leur pastille se lit Inscrit — pas encore payant. Votre mois arrive à leur premier vrai paiement; une facture d'essai à 0 $ ne rapporte rien." },
      { q: "Y a-t-il un plafond?", a: "20 invitations par jour depuis cet écran." },
    ],
  },
};
