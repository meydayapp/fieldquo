// content/help/fr/marketing-and-website-2.js
//
// Partie 2 de la catégorie « marketing-and-website » en français (voir le
// composeur, marketing-and-website.js). Slugs assignés à cette partie
// (lib/help/tree.js) : pamphlet-routes, email-campaigns-and-subscribers,
// marketing-spend, the-marketing-designer, make-a-post-from-a-job,
// social-posting-and-scheduling, connect-meta-ads,
// ask-for-reviews-automatically, refer-another-business,
// instant-estimates-as-marketing.
//
// Même structure que l'anglais (mêmes sections, mêmes blocs, mêmes figures) ;
// les mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "pamphlet-routes": {
    title: "Trajets de dépliants et d'accroche-portes",
    summary:
      "Planifiez une distribution porte-à-porte comme une liste d'adresses, laissez FieldQuo les ordonner en trajet et cochez chaque arrêt depuis un téléphone — une conversation au pas de la porte devient directement un client et une visite.",
    updated: "2026-09-12",
    intro: [
      "Une campagne de dépliants est une campagne marketing de type **Distribution de dépliants**. Vous ajoutez les adresses que vous comptez couvrir, FieldQuo les ordonne en un trajet efficace, à pied ou en camion, à partir de l'adresse de votre entreprise, et la personne qui distribue marque chaque arrêt au fur et à mesure — **Distribué**, **Absent** ou **Parlé au propriétaire**. Ce dernier est le but : une conversation au pas de la porte devient une fiche client, une visite planifiée si vous le voulez, et une soumission que vous pouvez commencer sur place.",
      "FieldQuo planifie et suit le trajet. Il n'imprime pas les accroche-portes et n'organise pas la livraison — vous fournissez le matériel imprimé et les personnes. Rien dans les données de comparaison que FieldQuo tient sur Jobber, Housecall Pro et Projul ne mentionne un trajet d'accroche-portes, à quelque forfait que ce soit ; c'est pourquoi cet article est classé sous Seulement dans FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les campagnes vivent sous **Marketing** dans la barre latérale. Les mots de l'écran : « Gérez et suivez vos campagnes — publicités payantes, envois courriel et distribution de dépliants porte-à-porte, avec les trajets, les assignations et les relances au pas de porte au même endroit. » Chaque campagne est une carte avec sa pastille de statut, son type (**Distribution de dépliants**, **Meta / publicités payantes**, **Envoi courriel**, **Autre**) et, pour une campagne de dépliants, sa progression — **26/40 arrêts** et **9 contactés** — plus la personne à qui elle est assignée." },
          { figure: "live:app-marketing", caption: "Marketing — une carte par campagne, avec Abonnés, Dépenses marketing et Nouvelle campagne en haut." },
          { p: "Ouvrez une campagne de dépliants et vous obtenez le trajet : une carte avec des repères numérotés dans l'ordre du trajet, une case pour ajouter des adresses, et la liste ordonnée des arrêts avec une pastille de statut sur chacun. C'est cette page que la personne qui marche le trajet garde ouverte sur son téléphone." },
        ],
      },
      {
        id: "create-a-route",
        heading: "Comment créer un trajet",
        blocks: [
          { steps: [
            "Ouvrez **Marketing** et appuyez sur **Nouvelle campagne**.",
            "Donnez-lui un nom, gardez le type **Distribution de dépliants** et choisissez la personne responsable sous **Assigner à** (ou laissez **Non assigné**). Appuyez sur **Créer la campagne**.",
            "Ouvrez la campagne. Sous **Ajouter une adresse au trajet**, commencez à taper une adresse, choisissez-la parmi les suggestions et appuyez sur **Ajouter**. Répétez pour chaque rue que vous prévoyez couvrir.",
            "Chaque adresse ajoutée est placée automatiquement dans le trajet — la carte et la liste numérotée se réordonnent après chaque ajout.",
          ] },
          { figure: "create:app-marketing-create", caption: "Nouvelle campagne — le nom, le type, la personne assignée, puis le budget et le lien facultatifs." },
          { note: "L'ordre est un trajet du plus proche voisin : il part de l'adresse de votre entreprise (dans Profil de l'entreprise) et va toujours à l'arrêt le plus proche pas encore placé. Une adresse qui n'a pas pu être localisée sur la carte est listée à la fin, dans l'ordre où vous l'avez ajoutée, pour ne jamais fausser celles qui l'ont été." },
        ],
      },
      {
        id: "working-the-route",
        heading: "Travailler le trajet au pas de la porte",
        blocks: [
          { p: "Chaque arrêt commence **En attente** et a trois boutons. Ce que chacun fait :" },
          { table: {
            head: ["Bouton", "Ce qu'il change"],
            rows: [
              ["**Distribué**", "L'arrêt est marqué Distribué et compte comme visité. Rien d'autre ne se passe."],
              ["**Absent**", "L'arrêt est marqué Absent (en ambre). Il compte comme visité — c'est celui où ça vaut la peine de repasser."],
              ["**Parlé au propriétaire**", "Ouvre un petit formulaire : **Nom du propriétaire**, **Téléphone (facultatif)** et **Planifier une visite (facultatif)**. À l'enregistrement, FieldQuo crée un client avec ce nom et l'adresse de l'arrêt (ou réutilise celui déjà lié à l'arrêt), marque l'arrêt Parlé au propriétaire et — si vous avez mis une date et une heure — planifie un rendez-vous à cette adresse."],
              ["L'icône de poubelle (**Retirer l'arrêt**)", "Supprime l'arrêt du trajet. Il n'y a pas d'annulation."],
            ],
          } },
          { p: "Dès qu'un arrêt a un client, un lien **Créer une soumission** apparaît dessous. Il ouvre le constructeur de soumissions déjà réglé sur ce client, pour que l'estimation commence avant même d'avoir quitté la rue. L'en-tête de la campagne compte comme **visités** tous les arrêts qui ne sont plus En attente." },
          { warning: "Planifier la visite depuis le pas de la porte exige les permissions de rendez-vous. Si la personne qui marche le trajet ne les a pas, le formulaire le dit — laissez la date vide et enregistrez simplement le client ; quelqu'un au bureau pourra planifier la visite depuis la fiche client." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Marketing**, la liste des campagnes et **Nouvelle campagne** sont réservées aux propriétaires, administrateurs, gestionnaires et répartiteurs — la même règle que tous les autres écrans marketing. Créer une campagne et ajouter des adresses exigent aussi ce niveau." },
          { p: "Marquer un arrêt est volontairement ouvert à tout membre actif de l'entreprise : la distribution est un travail de terrain, et la personne dans la rue est souvent un membre de l'équipe. Elle ne verra pas la ligne Marketing, mais la page de la campagne s'ouvre pour elle à partir d'un lien — envoyez le lien de la campagne à la personne assignée et les boutons Distribué / Absent / Parlé au propriétaire fonctionnent sur son téléphone. Le budget de la campagne lui est caché." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce que FieldQuo imprime les dépliants ou les accroche-portes ?", a: "Non. Il planifie et suit seulement le trajet ; vous imprimez le matériel et le distribuez vous-même. Enregistrez le coût de l'impression sous Dépenses marketing, canal Dépliants, pour qu'il entre dans votre coût par prospect." },
      { q: "Pourquoi la carte dit-elle encore Draft ?", a: "La pastille de statut d'une campagne de dépliants n'est modifiée par rien sur l'écran — surveillez plutôt le compte d'arrêts et le nombre de contactés ; ce sont eux que le trajet met à jour." },
      { q: "Puis-je coller une liste complète d'adresses d'un coup ?", a: "L'écran ajoute une adresse à la fois, à partir des suggestions de la carte. Chacune est placée dans le trajet dès qu'elle est ajoutée." },
    ],
  },

  "email-campaigns-and-subscribers": {
    title: "Campagnes courriel et abonnés",
    summary:
      "Envoyez un seul courriel à tous vos clients abonnés depuis votre propre adresse d'envoi, avec un modèle que vous avez rédigé, un lien de désabonnement fonctionnel dans chaque copie et une liste que vous contrôlez.",
    updated: "2026-09-12",
    intro: [
      "Une campagne **Envoi courriel** envoie l'un de vos modèles de courriel à tous les membres de votre liste d'**Abonnés** qui ne se sont pas désabonnés. Elle part au nom de votre entreprise et de votre expéditeur, avec votre logo et votre couleur de marque dans l'en-tête, et chaque copie porte un lien de désabonnement en un clic — le même lien que vos demandes d'avis, parce que les deux sont du marketing au sens des lois canadienne et américaine.",
      "La liste est la vôtre : importez-la depuis vos clients en un clic, ajoutez des gens qui ne sont pas encore clients, et désabonnez ou réabonnez qui vous voulez à la main.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Trois écrans entrent en jeu. **Paramètres → Modèles de courriel**, c'est là que vivent les mots — une campagne ne peut envoyer qu'un modèle de type Marketing ou Personnalisé, jamais les modèles automatisés de soumission ou de facture. **Marketing → Abonnés**, c'est à qui elle s'adresse. **Marketing → Nouvelle campagne** avec le type **Envoi courriel** relie les deux, et la page de la campagne porte le bouton **Send Campaign**." },
          { figure: "live:app-marketing", caption: "Marketing — Abonnés est à côté de Nouvelle campagne ; la carte d'une campagne courriel montre son modèle et Envoyé à N ou Pas encore envoyé." },
        ],
      },
      {
        id: "subscribers",
        heading: "La liste des Abonnés",
        blocks: [
          { p: "L'écran Abonnés dit en haut exactement à quoi il sert : « {subscribed} abonnés sur {total} au total — c'est à eux qu'une campagne d'envoi courriel s'adresse. » Deux façons de le remplir :" },
          { bullets: [
            "**Importer depuis les clients** ramène chaque client ayant une adresse courriel au dossier. Vous pouvez le refaire plus tard sans risque : un client déjà sur la liste garde son état — quelqu'un qui s'est désabonné n'est jamais réabonné en douce — et seules les nouvelles lignes arrivent abonnées. Le résultat se lit « 34 clients sur 41 ayant un courriel au dossier ont été importés. » Les lignes importées portent l'étiquette **Depuis les clients**.",
            "**Ajouter un abonné** prend un **Courriel**, un **Nom (facultatif)** et un **Téléphone (facultatif)**, pour un prospect qui n'est pas client.",
          ] },
          { p: "Chaque ligne a **Se désabonner** ou **Se réabonner**, et un bouton pour la retirer. Se désabonner conserve la ligne et son historique — seul l'indicateur d'abonnement change — donc une réimportation ne peut pas l'annuler." },
        ],
      },
      {
        id: "send-a-campaign",
        heading: "Comment envoyer une campagne",
        blocks: [
          { steps: [
            "Dans **Paramètres → Modèles de courriel**, rédigez le courriel comme modèle Marketing. Son objet est ce que les destinataires voient ; le nom de la campagne n'est que votre étiquette interne.",
            "Ouvrez **Marketing → Abonnés** et appuyez sur **Importer depuis les clients**, puis ajoutez les autres à la main.",
            "De retour sur **Marketing**, appuyez sur **Nouvelle campagne**, mettez le type à **Envoi courriel**, choisissez le modèle sous **Modèle à envoyer** et appuyez sur **Créer la campagne**.",
            "Ouvrez la campagne. Elle montre le modèle, le nombre de destinataires abonnés et un bouton **Send Campaign** (les boutons de cette page sont en anglais). Appuyez, lisez la confirmation — elle rappelle que l'envoi part à tous les abonnés tout de suite et ne peut pas être annulé — et appuyez sur **Yes, send now**.",
          ] },
          { p: "L'envoi remplit les champs du modèle pour chaque abonné — nom, adresse et téléphone du client, nom, téléphone et courriel de votre entreprise — et les expédie un à un. Chaque destinataire est réservé avant que sa copie parte, si bien qu'appuyer deux fois sur Send, ou un envoi interrompu à mi-chemin, n'écrit jamais deux fois à la même personne. Un envoi terminé marque la campagne **completed** et la carte se lit **Envoyé à N** ; un envoi interrompu se lit « Partially sent » avec un bouton **Resume send** qui n'écrit qu'à ceux qui restent." },
          { note: "Une campagne terminée ne peut pas être renvoyée depuis la même page. Pour écrire de nouveau à la liste, créez une nouvelle campagne. L'envoi exige aussi une entreprise qui a terminé son paiement d'inscription — une entreprise encore à l'étape de configuration est invitée à la terminer plutôt que d'envoyer." },
        ],
      },
      {
        id: "unsubscribes",
        heading: "Ce que fait le lien de désabonnement",
        blocks: [
          { p: "Chaque courriel de campagne porte un lien de désabonnement et les en-têtes qui permettent à Gmail et à Apple Mail d'afficher leur propre bouton Se désabonner. Le lien ouvre une page qui nomme votre entreprise et dit, dans les mots conservés sur la ligne, qu'il n'arrête que les courriels promotionnels — les soumissions, les factures et les reçus continuent d'arriver. Un clic met la personne désabonnée ; rien n'est supprimé, et le moment et la formulation qu'elle a vue sont conservés." },
          { p: "La même liste est vérifiée avant qu'une demande d'avis parte, donc un désabonnement arrête les deux. Tout le détail : [[client-consent-and-unsubscribes|Consentement des clients et désabonnements]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs, gestionnaires et répartiteurs voient Marketing, la liste des abonnés et le bouton d'envoi. Les estimateurs et l'équipe de terrain, non. L'adresse d'expédition est celle que FieldQuo a vérifiée pour votre entreprise — voir [[send-from-your-own-domain|Envoyer des courriels depuis votre propre domaine]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je voir qui a ouvert ou cliqué ?", a: "Non. FieldQuo enregistre à qui la campagne a été envoyée et quand ; il ne suit ni les ouvertures ni les clics." },
      { q: "Puis-je envoyer à un segment — seulement les clients de toiture, par exemple ?", a: "Pas depuis cet écran. Une campagne part à toutes les lignes abonnées. Désabonnez d'abord les lignes à exclure, ou tenez une liste à part en ajoutant les abonnés à la main." },
      { q: "D'où viennent les couleurs et le logo du courriel ?", a: "De Paramètres → Image de marque, comme vos soumissions et vos factures. Rien dans le courriel ne mentionne FieldQuo." },
    ],
  },

  "marketing-spend": {
    title: "Dépenses marketing",
    summary:
      "Enregistrez ce que vous dépensez pour obtenir des contrats — par canal, à la main ou synchronisé depuis Meta — et lisez un coût moyen par prospect calculé à partir de votre vrai nombre de prospects.",
    updated: "2026-09-12",
    intro: [
      "**Marketing → Dépenses marketing** est le registre de ce que vous payez pour obtenir des prospects : Facebook et Instagram, Google, TikTok, dépliants, primes de référencement, et le reste. Vous tapez les montants, ou vous connectez votre compte publicitaire Meta et laissez **Synchroniser maintenant** les importer. Au-dessus du registre, FieldQuo divise le total par le nombre de vrais prospects reçus et affiche un **Coût moyen par prospect**.",
      "« Moyen » est le mot honnête. Le coût par prospect par campagne n'est calculé que pour les prospects arrivés par un formulaire Meta ; tous les autres canaux — et le propriétaire qui a vu l'annonce et téléphoné — restent fondus dans l'ensemble, parce que rien ne relie cette dépense à ce prospect.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le sous-titre de l'écran en donne la portée : « Ce que vous dépensez pour obtenir des contrats, par canal — et ce que cela vous coûte par prospect, en moyenne sur l'ensemble. » De haut en bas : la carte **Coût moyen par prospect**, un tableau **Dépenses par canal**, un tableau **Campagnes** pour tout ce qui vient de Meta, et la liste des entrées avec **Modifier** et **Supprimer** sur chacune." },
          { figure: "live:app-marketing", caption: "Marketing — le bouton Dépenses marketing, en haut à droite, ouvre le registre." },
        ],
      },
      {
        id: "log-spend",
        heading: "Comment enregistrer une dépense",
        blocks: [
          { steps: [
            "Ouvrez **Marketing**, puis **Dépenses marketing**, et appuyez sur **Enregistrer une dépense**.",
            "Choisissez le **Canal** — Facebook / Instagram, Google, TikTok, Dépliants, Prime de référencement ou Autre — la **Date** et le **Montant**.",
            "Au besoin, nommez la **Campagne** et entrez **Prospects apportés** et **Conversions** si vous les connaissez. C'est votre propre estimation ; l'écran l'affiche « saisi » et ne la mélange jamais à votre vrai nombre de prospects.",
            "Appuyez sur **Enregistrer**. L'entrée apparaît dans la liste avec la source **Manuel** ; les lignes venues de Meta se lisent **Depuis Meta**.",
          ] },
          { tip: "Vous faites de la pub sur Meta ? L'écran le dit lui-même : connectez votre compte publicitaire et les dépenses s'importent sans rien taper — voir [[connect-meta-ads|Connecter votre compte publicitaire Meta]]." },
        ],
      },
      {
        id: "the-numbers",
        heading: "Ce que chaque chiffre veut dire",
        blocks: [
          { table: {
            head: ["Chiffre", "Comment il est calculé"],
            rows: [
              ["**Coût moyen par prospect**", "Tout ce qui est enregistré, divisé par les prospects de votre tableau Prospects sur la même période. Les prospects saisis à la main ou importés d'un fichier sont exclus et comptés à part — « + 4 prospects saisis manuellement ou importés, non comptés » — parce que la dépense de la période ne les a pas provoqués."],
              ["**Dépenses par canal**", "Les montants enregistrés par canal sous **Dépensé**, avec les prospects et le coût par prospect que vous avez tapés, marqués « (saisi) », et une colonne **Budgété (campagnes)** : les budgets de vos campagnes non archivées dans Marketing, additionnés par canal — les campagnes de dépliants vers Dépliants, Meta / publicités payantes vers Facebook / Instagram, courriel et autre vers Autre. Un canal avec un budget et rien d'enregistré affiche « rien d'enregistré pour l'instant », et une liste sous le tableau nomme la campagne d'où vient le chiffre. Un budget n'entre jamais dans un total ni dans un coût par prospect."],
              ["**Campagnes**", "Une ligne par campagne Meta synchronisée par FieldQuo : ce qu'elle a coûté, ce que Meta a rapporté (impressions, portée, clics, CTR, CPC, conversations, vues vidéo, interactions) et ce que sont devenus ses prospects par formulaire — prospects, soumissions, chantiers, facturé."],
              ["**≈ approximatif**", "Un compte Meta qui rapporte dans une autre devise que celle de votre entreprise est converti à un taux de change fixé et marqué ≈. Si ce taux date de plus de 45 jours, ou si FieldQuo n'a pas de taux pour cette paire, les lignes sont exclues et l'écran nomme le montant et la raison."],
            ],
          } },
          { p: "La colonne Prospects du tableau des campagnes ne compte que les formulaires Meta reçus pour cette campagne. Sa propre note le dit : un propriétaire qui a vu l'annonce et téléphoné n'est pas compté, donc le coût par prospect ici est le maximum qu'un prospect par formulaire vous a coûté — le chiffre combiné au-dessus donne le tableau complet." },
          { warning: "Supprimer une entrée change les coûts par prospect ; la confirmation le dit. Les mêmes lignes alimentent la carte des coûts d'exploitation du tableau de bord KPI et le courriel de bilan mensuel." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs, gestionnaires et répartiteurs — la règle de la ligne Marketing. Connecter le compte Meta qui l'alimente est réservé aux propriétaires et administrateurs." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo peut-il me dire quel canal fonctionne ?", a: "Seulement pour les prospects par formulaire Meta, par campagne. Tout le reste est fondu dans la moyenne, et l'écran le dit sous le chiffre plutôt que de deviner." },
      { q: "La synchronisation Meta tourne-t-elle toute seule ?", a: "Non. Appuyez sur Synchroniser maintenant dans Paramètres → Publicités Meta ; chaque pression importe les 30 derniers jours." },
      { q: "Pourquoi mon chiffre dit-il « Pas encore assez de données » ?", a: "Aucune dépense n'a été enregistrée, ou aucun prospect n'est arrivé pendant la période. Les deux cas sont affichés plutôt qu'un zéro." },
      { q: "Pourquoi un canal affiche-t-il un chiffre Budgété alors que je n'ai rien enregistré ?", a: "Parce qu'une campagne de ce canal dans Marketing porte un budget. Budgété est ce que vous avez réservé pour toute la durée de la campagne, pas pour une période ; Dépensé est ce qui a été enregistré ici ou synchronisé depuis Meta. Archivez la campagne et son budget quitte la colonne." },
    ],
  },

  "the-marketing-designer": {
    title: "Le Créateur marketing",
    summary:
      "Concevez une publicité sur un canevas et obtenez-la dans tous les formats qu'Instagram, TikTok, Facebook et YouTube demandent — gabarits, vos photos, photos de banque, texte et formes gratuits ; images IA sur crédit ; approbation avant que quoi que ce soit ne sorte.",
    updated: "2026-09-12",
    intro: [
      "La ligne **Créateur** de la barre latérale ouvre le Créateur marketing. Sa propre description : « Concevez une publicité et exportez-la dans tous les formats demandés par les réseaux sociaux — Instagram, TikTok, Facebook et YouTube — sans refaire la mise en page à la main. » Un visuel porte cinq formats à la fois, chacun avec ses propres ajustements enregistrés, et **Télécharger tous les formats** vous remet un PNG de chacun.",
      "Aucune donnée de comparaison que FieldQuo tient sur Jobber, Housecall Pro ou Projul ne mentionne un canevas de conception publicitaire, à quelque forfait que ce soit ; c'est pourquoi cet article est classé sous Seulement dans FieldQuo. Ce qu'il n'est pas : un outil qui publie à votre place aujourd'hui — voir [[social-posting-and-scheduling|Publier sur Facebook et Instagram, maintenant ou plus tard]] pour l'état des choses.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque visuel appartient à une campagne publicitaire, et ces campagnes sont les mêmes lignes que sur l'écran Marketing — une campagne créée ici apparaît là-bas et inversement. L'index du Créateur liste chaque campagne avec ses visuels : une pastille **Approuvé**, **Non approuvé** ou **À réapprouver**, des puces pour les cinq formats, et **2/5 formats prêts**. Sous chaque campagne : **Créer une publication à partir d'un chantier** et une case de nom avec **Nouveau visuel**." },
          { figure: "live:app-marketing-designer", caption: "Créateur marketing — Nouvelle campagne publicitaire en haut, puis les visuels de chaque campagne avec leur pastille d'approbation et les formats prêts." },
        ],
      },
      {
        id: "the-editor",
        heading: "Ce qu'il y a dans l'éditeur",
        blocks: [
          { p: "Ouvrez un visuel : le canevas a un onglet par format en haut — **Instagram post** (1080 × 1080), **Instagram story** (1080 × 1920), **TikTok** (1080 × 1920), **Facebook feed** (1200 × 630) et **YouTube thumbnail** (1280 × 720). Composez la publicité une fois ; changer d'onglet la recale dans l'autre cadre, et ce que vous déplacez sur un onglet n'est enregistré que pour ce format. Un avertissement apparaît quand un élément dépasse le bord d'un format." },
          { bullets: [
            "**Design** — des gabarits pour commencer.",
            "**Image** — **Upload image**, des photos de banque, et un onglet **Photos du chantier** qui liste les photos d'un chantier pour qu'un vrai avant-après se pose sur le canevas. Les photos marquées Issue / snag ne sont jamais proposées.",
            "**Text**, **Shapes**, **Draw** — les outils ordinaires, tous gratuits.",
            "**AI** — la génération d'**Image IA** à partir d'une consigne, au choix à partir d'une de vos photos, et la suppression d'arrière-plan. C'est le seul morceau payant : il consomme du crédit d'images IA de **Paramètres → Crédit IA**, le panneau affiche le prix avant que vous appuyiez, et il propose **Ajouter du crédit IA** si le solde manque. Le panneau dit aussi ce qu'il ne sait pas : vos prix ni votre zone de service.",
            "**Settings** — la taille du canevas et l'arrière-plan.",
          ] },
          { p: "Les changements s'enregistrent au fur et à mesure — l'en-tête se lit « All changes saved », « Saving… » ou « Couldn't save — check your connection ». **Télécharger tous les formats** exporte chaque onglet en PNG nommé d'après la campagne et le format." },
        ],
      },
      {
        id: "approve",
        heading: "Réviser et approuver",
        blocks: [
          { steps: [
            "Appuyez sur **Réviser et approuver** dans l'en-tête de l'éditeur.",
            "Rédigez ou collez la légende et les mots-clics. S'ils ne sont pas enregistrés, l'approbation les enregistre d'abord.",
            "Appuyez sur **Approuver cette publication**. La pastille devient **Approuvé**, avec la personne qui a approuvé et le moment.",
          ] },
          { p: "L'approbation est une empreinte du visuel et des mots. Changez l'un ou l'autre ensuite et la pastille se lit **À réapprouver** — « Ceci a changé après l'approbation. Revoyez-le, puis approuvez-le de nouveau. » Renommer le visuel ne la retire pas ; **Retirer l'approbation** le fait, volontairement. Rien ne peut être planifié ni publié tant qu'un visuel n'est pas approuvé." },
          { p: "Sous « What next », l'écran d'approbation offre **Télécharger tous les formats** et **Copier la légende**. Pour une publicité payante, il le dit clairement : téléversez le fichier téléchargé dans Meta Ads Manager — FieldQuo ne peut pas créer la publicité à votre place, parce que cela exige une permission Meta qui ne lui a pas été accordée." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs, gestionnaires et répartiteurs voient la ligne Créateur et peuvent créer, modifier, approuver et supprimer des visuels. Supprimer un visuel demande confirmation et ne peut pas être annulé." },
        ],
      },
    ],
    faq: [
      { q: "Le Créateur coûte-t-il un supplément ?", a: "Non. Les gabarits, les téléversements, les photos de banque, les photos de chantier, le texte, les formes et chaque exportation sont compris. Seules la génération d'images IA et la suppression d'arrière-plan puisent dans le crédit IA." },
      { q: "D'où viennent les photos de chantier ?", a: "Des photos que votre équipe a versées sur les chantiers, avec leurs étiquettes d'étape — voir [[job-photos-and-tags|Photos de chantier et étiquettes]]. Une photo Issue / snag n'atteint jamais un visuel." },
      { q: "Puis-je publier directement d'ici ?", a: "Le bouton Publier et le Calendrier social sont construits, mais la publication attend l'approbation de l'application par Meta. D'ici là, téléchargez tous les formats et publiez depuis votre propre compte — l'écran d'approbation le dit tel quel." },
    ],
  },

  "make-a-post-from-a-job": {
    title: "Créer une publication à partir d'un chantier",
    summary:
      "Transformez les photos avant-après d'un chantier terminé en publication prête à approuver — les vraies photos de l'équipe côte à côte, un titre rédigé à partir du descriptif des travaux de ce chantier, et votre métier et votre ville au bas.",
    updated: "2026-09-12",
    intro: [
      "La meilleure publicité d'un entrepreneur, c'est la cuisine qu'il vient de finir. **Créer une publication à partir d'un chantier**, dans le Créateur marketing, construit cette publication avec ce qui existe déjà : la première photo **Before / start** et la dernière photo **Finished** d'un chantier, étiquetées BEFORE et AFTER, un titre tiré du descriptif des travaux, et un pied de page qui nomme votre métier et votre ville. Rien n'est inventé — l'indication de l'écran le dit — et une photo marquée **Issue / snag** n'est jamais utilisée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "C'est une composition, pas une image générée. Les pixels sont vos photographies ; ce que FieldQuo décide, c'est où elles se placent, la taille des mots et quelles couleurs sont sûres avec votre couleur de marque. On ne demande au modèle que des phrases — un titre et, plus tard, une légende — et s'il est indisponible, la publication reçoit un titre plus sobre et factuel bâti à partir du descriptif des travaux plutôt qu'une publication brisée." },
          { figure: "live:app-marketing-designer", caption: "Créateur marketing — Créer une publication à partir d'un chantier se trouve sous chaque campagne, à côté de Nouveau visuel." },
        ],
      },
      {
        id: "steps",
        heading: "Comment en créer une",
        blocks: [
          { steps: [
            "Ouvrez **Créateur** et trouvez la campagne à laquelle la publication appartient. Appuyez sur **Créer une publication à partir d'un chantier**.",
            "FieldQuo parcourt vos chantiers et liste ceux qui ont une photo publiable. Chacun indique **Avant et après** quand il a une photo de début et une de fin, ou **Une seule photo — pas d'avant/après sur ce chantier** quand il n'en a qu'une.",
            "Appuyez sur **Créer** sur le chantier. Le visuel s'ouvre dans l'éditeur avec les photos placées, les étiquettes posées, le titre rédigé et le pied de page rempli.",
            "Ajustez ce que vous voulez sur chaque onglet de format, puis **Réviser et approuver**. Sous la légende, **Générer avec l'IA** rédige une légende à partir du descriptif réel des travaux de ce chantier et le dit — ou vous avertit quand il n'a trouvé aucun détail de chantier et que le texte est générique.",
          ] },
          { note: "Si aucun chantier n'a de photo que FieldQuo peut publier, la liste dit : « Aucun chantier n'a encore de photo publiable. Marquez une photo de début et une de fin sur un chantier et il apparaîtra ici. » Le marquage se fait sur le chantier — voir [[job-photos-and-tags|Photos de chantier et étiquettes]]." },
        ],
      },
      {
        id: "what-goes-in",
        heading: "Ce qui entre, et ce qui n'entre jamais",
        blocks: [
          { table: {
            head: ["Élément", "D'où il vient"],
            rows: [
              ["La photo BEFORE", "La plus ancienne photo du chantier marquée **Before / start**."],
              ["La photo AFTER", "La plus récente photo marquée **Finished**. Sans paire, la photo de fin la plus récente, seule, sans étiquette AFTER."],
              ["Le titre", "Rédigé à partir du descriptif des travaux ; le titre factuel de secours nomme les travaux si le modèle est indisponible."],
              ["Le pied de page", "Votre métier activé, et votre ville et votre province dans Profil de l'entreprise."],
              ["Les couleurs", "Votre couleur de marque, mesurée pour le contraste — jamais choisie par le modèle."],
            ],
          } },
          { p: "Une photo marquée **Issue / snag** — un dégât d'eau derrière une armoire, un problème signalé par l'équipe — est filtrée deux fois : avant que quoi que ce soit n'atteigne le modèle, et avant que quoi que ce soit n'atteigne le canevas. Les photos de deux chantiers différents ne sont jamais mélangées dans une même légende." },
          { p: "Le titre et la légende sont des appels à l'IA et consomment du crédit IA comme le reste de FieldQuo IA ; les photos elles-mêmes ne sont pas générées et ne coûtent rien." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les mêmes personnes que le Créateur : propriétaires, administrateurs, gestionnaires et répartiteurs." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je choisir les photos utilisées ?", a: "Pas dans le sélecteur — il prend la première photo de début et la dernière de fin. Une fois le visuel ouvert, remplacez l'une ou l'autre depuis l'onglet Photos du chantier du panneau Image." },
      { q: "Le nom ou l'adresse du client apparaîtra-t-il sur la publication ?", a: "Non. Le pied de page porte votre métier et votre ville, et le titre est rédigé à partir du descriptif des travaux, pas de la fiche client." },
    ],
  },

  "social-posting-and-scheduling": {
    title: "Publier sur Facebook et Instagram, maintenant ou plus tard",
    summary:
      "Ce que font la boîte de dialogue Publier et le Calendrier social — publier tout de suite ou planifier un visuel approuvé sur votre page Facebook et Instagram — et l'état honnête des choses aujourd'hui : la connexion attend l'approbation de Meta.",
    updated: "2026-09-12",
    intro: [
      "Un visuel approuvé dans le Créateur marketing a un bouton **Publier**. Il ouvre **Publier sur Instagram et Facebook** : choisissez les plateformes, le format, vérifiez la légende, puis **Publier maintenant** ou **Planifier pour plus tard**. Les publications planifiées apparaissent dans le **Calendrier social**, où une publication peut être annulée avant de partir.",
      "Lisez ceci d'abord : publier exige des autorisations que Meta doit accorder à l'application FieldQuo, et cet examen n'est pas encore revenu. **Paramètres → Publicités Meta → Publication Facebook et Instagram** se lit **En attente de l'approbation de Meta**, et la boîte de dialogue Publier dit **Pas encore connecté**. La solution de rechange tient en une étape — téléchargez la publication et mettez-la en ligne depuis votre propre compte — et l'écran d'approbation vous le dit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Tout le parcours est construit de bout en bout : la connexion de la page, la boîte de dialogue, le planificateur, le calendrier et les règles de reprise. Ce qui manque, c'est l'approbation par Meta de deux autorisations — publier sur une page et publier sur Instagram — donc aucune vraie entreprise ne peut encore connecter une page. Rien ne manque de votre côté, et il n'y a rien à préparer à l'avance." },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — la carte Publication Facebook et Instagram se trouve sous la connexion du compte publicitaire et dit ce qu'elle attend." },
        ],
      },
      {
        id: "the-publish-dialog",
        heading: "Ce que fait la boîte de dialogue Publier",
        blocks: [
          { bullets: [
            "**Publier sur** — **Page Facebook** et **Instagram**. Instagram n'est offert que si un compte professionnel Instagram est lié à la page connectée.",
            "**Format** — **Carré (1:1)** ou **Paysage (1,91:1)**, les deux recadrages qu'Instagram accepte. Si un recadrage ne respecte pas les règles d'Instagram, la boîte de dialogue le dit et demande l'autre.",
            "**Légende** — les mots approuvés, en lecture seule ici. Les limites d'Instagram s'appliquent aux deux plateformes : 2 200 caractères, 30 mots-clics, 20 mentions.",
            "**Publier maintenant** publie tout de suite. **Planifier pour plus tard** affiche les fenêtres : « Facebook : de 10 minutes à 75 jours à l'avance. Instagram : au moins 5 minutes à l'avance — FieldQuo conserve la publication et la diffuse au bon moment. » FieldQuo conserve une publication jusqu'à 180 jours.",
          ] },
          { p: "Une publication Facebook planifiée dans la fenêtre propre de Facebook est remise tout de suite au planificateur de Facebook. Chaque publication Instagram — Instagram n'a pas de planificateur — est conservée par FieldQuo et envoyée par une tâche qui tourne toutes les cinq minutes. Seules les publications image peuvent être planifiées ; les Reels et les vidéos ne sont pas pris en charge, et le calendrier le dit." },
        ],
      },
      {
        id: "the-calendar",
        heading: "Le Calendrier social",
        blocks: [
          { p: "**Calendrier**, dans l'en-tête de l'éditeur, ouvre une grille mensuelle de chaque publication **Planifié**, en cours de publication, **Publié**, **Échec**, **Limite atteinte** ou **Annulé**, classée à l'heure où elle devait partir. Choisissez un jour pour voir ses publications, et **Annuler** une publication planifiée qui n'est pas encore partie. Une publication refusée par Meta affiche la raison ; **Limite atteinte** veut dire que la plateforme a atteint la limite de publication de Meta pour les 24 prochaines heures." },
        ],
      },
      {
        id: "rules",
        heading: "Ce qui doit être vrai avant qu'une publication parte",
        blocks: [
          { table: {
            head: ["Règle", "Pourquoi"],
            rows: [
              ["Le visuel est **Approuvé**, et inchangé depuis", "Une publication porte votre nom ; le serveur recalcule l'approbation à chaque publication et refuse une approbation périmée."],
              ["La légende est celle du visuel", "Une légende modifiée dans la boîte de dialogue est refusée plutôt que publiée en douce — enregistrez-la sur le visuel et approuvez de nouveau."],
              ["Votre entreprise a terminé son paiement d'inscription", "Publier au nom de l'entreprise est un acte vers l'extérieur, encadré comme l'envoi d'une soumission."],
              ["Une page est connectée", "Aujourd'hui, en attente de Meta — voir plus haut."],
            ],
          } },
          { tip: "En attendant l'approbation : **Réviser et approuver**, puis **Télécharger tous les formats** et **Copier la légende**, et publiez vous-même depuis Facebook ou Instagram. Cela prend une minute et rien n'est perdu." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs, gestionnaires et répartiteurs peuvent approuver, publier, planifier et annuler. Connecter la page, quand ce sera possible, se fait dans Paramètres → Publicités Meta par un propriétaire ou un administrateur, et cette seule connexion alimente aussi la boîte de réception Messages — voir [[connect-your-facebook-page-and-instagram|Connecter votre page Facebook et Instagram]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je faire quelque chose pour accélérer l'approbation de Meta ?", a: "Non. L'examen porte sur l'application FieldQuo, pas sur votre compte. La carte des paramètres dit « Rien ne manque de votre côté. »" },
      { q: "FieldQuo peut-il créer la publicité payante à ma place ?", a: "Non. Diffuser une publicité exige une autre autorisation Meta que FieldQuo ne détient pas. Téléchargez tous les formats et téléversez-les dans Meta Ads Manager ; la dépense de la publicité se synchronise ensuite dans Dépenses marketing." },
      { q: "Puis-je planifier un Reel ou une vidéo ?", a: "Pas encore — seulement des publications image." },
    ],
  },

  "connect-meta-ads": {
    title: "Connecter votre compte publicitaire Meta",
    summary:
      "Liez votre propre compte publicitaire Facebook et Instagram pour que ses dépenses et ses résultats de campagne entrent dans Dépenses marketing — en lecture seule, synchronisés quand vous appuyez sur Synchroniser maintenant — et voyez ce que le même écran attend encore de Meta.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Encaissement → Publicités Meta** connecte le compte publicitaire Meta de votre entreprise. Dans les mots de l'écran : « Connectez votre propre compte publicitaire Meta (Facebook/Instagram) pour intégrer les dépenses et les performances des campagnes à vos chiffres marketing. » FieldQuo ne fait que lire les dépenses et les performances — il ne crée ni ne modifie jamais une publicité.",
      "Le même écran porte trois autres cartes Meta : **Formulaires de prospects Facebook**, **Publication Facebook et Instagram** et **WhatsApp Business**. Chacune énonce ses propres conditions, et aujourd'hui chacune attend une autorisation que Meta n'a pas encore accordée à l'application FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran a quatre états honnêtes et n'affiche jamais un bouton qui ne peut pas fonctionner. **Pas encore configuré** — le déploiement n'a pas d'identifiants d'application Meta. **Impossible de stocker un jeton en toute sécurité pour l'instant** — un réglage de déploiement manque. **Non connecté** — un vrai bouton **Connecter Meta Ads**. **Connecté** — la carte du compte avec **Synchroniser maintenant**, **Déconnecter** et, dès qu'une synchronisation a eu lieu, **Voir vos campagnes →**." },
          { figure: "live:app-settings-meta-ads", caption: "Paramètres → Publicités Meta — la connexion du compte publicitaire, puis les cartes des formulaires de prospects, de la publication et de WhatsApp." },
        ],
      },
      {
        id: "connect",
        heading: "Comment connecter",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Publicités Meta** et appuyez sur **Connecter Meta Ads**. Vous êtes envoyé chez Meta pour vous connecter et consentir.",
            "Si Meta retourne plusieurs comptes publicitaires pour votre connexion, l'écran demande **Quel compte publicitaire ?** — choisissez-en un et appuyez sur **Connecter ce compte**.",
            "De retour sur l'écran, la carte montre le nom, l'identifiant et la devise du compte avec la pastille **Connecté**, et « Jamais synchronisé. » Appuyez sur **Synchroniser maintenant**.",
            "Le résultat se lit « 12 nouvelles lignes, 3 mises à jour. » Ouvrez **Marketing → Dépenses marketing** pour les voir, source **Depuis Meta**.",
          ] },
          { note: "Chaque **Synchroniser maintenant** importe les 30 derniers jours de résultats de campagne — la dépense par campagne et par jour, et ce que Meta a rapporté à côté. Il n'y a pas de synchronisation automatique : appuyez quand vous voulez rafraîchir les chiffres. La synchronisation avertit aussi quand des lignes ressemblent à des dépenses déjà saisies à la main, pour ne pas compter les deux." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Ce que fait chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["**Synchroniser maintenant**", "Importe les 30 derniers jours dans Dépenses marketing et met à jour le tableau des campagnes. Les lignes dans une autre devise sont converties à un taux fixé et marquées ≈."],
              ["**Reconnecter**", "Apparaît quand la pastille se lit **Reconnexion nécessaire** — Meta indique que le jeton conservé n'est plus valide. La synchronisation est en pause tant que vous ne l'avez pas fait."],
              ["**Déconnecter**", "Arrête la synchronisation. Les lignes déjà importées restent dans votre historique de dépenses marketing."],
              ["Les interrupteurs des **Formulaires de prospects Facebook**", "Affichés par formulaire avec leur nombre de prospects, mais désactivés : « Les formulaires de prospects Facebook nécessitent l'approbation par Meta d'une autorisation supplémentaire ; rien n'est encore reçu. » Voir [[facebook-lead-forms|Formulaires de prospects Facebook]]."],
              ["**Publication Facebook et Instagram**", "Se lit **En attente de l'approbation de Meta**. Publier depuis le Créateur en dépend — voir [[social-posting-and-scheduling|Publier sur Facebook et Instagram, maintenant ou plus tard]]."],
              ["**WhatsApp Business**", "Se lit **En attente de l'approbation de Meta**. Voir [[whatsapp-business|Messages WhatsApp Business]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et administrateurs seulement — la même tablette que Paiements. Un gestionnaire voit ici un panneau d'accès refusé, et chaque route derrière l'écran le refuse aussi. Les chiffres produits par la synchronisation sont visibles par quiconque peut ouvrir Dépenses marketing." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo va-t-il modifier mes publicités ou mon budget ?", a: "Non. L'autorisation demandée à Meta est en lecture seule ; l'écran dit qu'il ne crée ni ne modifie jamais une publicité." },
      { q: "Mon compte publicitaire facture en USD et mon entreprise est en CAD — que se passe-t-il ?", a: "Les lignes sont converties à un taux de change fixé et chaque chiffre qu'elles touchent est marqué ≈ approximatif, avec l'ancienneté du taux à côté. Un taux de plus de 45 jours est refusé et le montant est nommé comme exclu." },
      { q: "Où vont les prospects de mes publicités ?", a: "Dès que Meta approuve l'autorisation des formulaires de prospects, un prospect issu d'un formulaire que vous activez arrive dans Prospects comme toute autre demande. D'ici là, les interrupteurs sont désactivés et la carte dit que rien n'est reçu." },
    ],
  },

  "ask-for-reviews-automatically": {
    title: "Demander des avis automatiquement",
    summary:
      "Un court courriel, de votre part, à chaque client après que son chantier est marqué terminé — jamais deux fois, jamais à quelqu'un qui s'est désabonné — avec le délai que vous choisissez et un compte en direct de qui est dans la file.",
    updated: "2026-09-12",
    intro: [
      "Les avis sont la plus grande source de contrats entrants d'un petit entrepreneur, et demander est l'étape qu'on saute. **Paramètres → Côté client → Avis** demande pour vous : une fois un chantier marqué terminé, le client reçoit un seul message avec votre lien d'avis, après un délai que vous fixez. L'écran ne dit pas seulement Activé — il vous dit combien de clients sont dans la file en ce moment et combien ont été sollicités au cours des 30 derniers jours.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "De haut en bas : **Votre lien d'avis** avec **Enregistrer** ; l'interrupteur **Demander automatiquement** ; les puces de délai **Quand demander** ; une phrase comme « 3 clients sont dans la file, et 12 ont été sollicité(s) au cours des 30 derniers jours. » ; et une note : « Les clients qui se sont désabonnés sont ignorés, et toute personne qui répond en signalant un problème vous joint directement plutôt que la page d'avis. » En dessous, les avis affichés sur votre site web — l'autre moitié de l'écran, couverte dans [[testimonials-on-your-website|Témoignages sur votre site web]]." },
          { figure: "live:app-settings-reviews", caption: "Paramètres → Avis — le lien d'avis, l'interrupteur Demander automatiquement, et les avis affichés sur votre site web." },
        ],
      },
      {
        id: "switch-it-on",
        heading: "Comment l'activer",
        blocks: [
          { steps: [
            "Collez votre lien d'avis sous **Votre lien d'avis** et appuyez sur **Enregistrer**. L'aide en dessous dit où le trouver : dans votre profil d'entreprise Google, choisissez « Demander des avis » et copiez le lien court. N'importe quelle page http ou https fonctionne — Google, Facebook, HomeStars, votre propre formulaire. Utilisez **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**.",
            "Activez **Demander automatiquement**. Il ne peut pas être activé sans lien — l'interrupteur dit « Ajoutez d'abord votre lien d'avis ci-dessus. » — et le serveur le refuse aussi.",
            "Choisissez **Quand demander** : **2 heures plus tard**, **4 heures plus tard**, **Le lendemain**, **Deux jours plus tard**, **Trois jours plus tard** ou **Une semaine plus tard**. La phrase en dessous se met à jour pour montrer la file.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "Les règles que la demande respecte",
        blocks: [
          { bullets: [
            "**Une fois, pour toujours.** Un chantier fait l'objet d'au plus une demande. Le chantier est marqué avant que le courriel parte, si bien qu'une exécution qui se chevauche ou un double clic ne peut jamais demander deux fois.",
            "**Terminé veut dire terminé.** Seulement un chantier au statut terminé, avec une heure de fin. Les chantiers annulés ou rouverts ne sont pas sollicités.",
            "**Le client doit avoir une adresse courriel**, et ne pas s'être désabonné — la même liste que vos campagnes courriel.",
            "**À l'heure.** FieldQuo vérifie chaque heure, donc un délai de 4 heures veut dire environ 4 heures, pas le lendemain matin.",
            "**Pas le passé lointain.** Un chantier terminé depuis plus de 30 jours n'est jamais sollicité, et les chantiers importés de votre ancien système sont ignorés — activer ceci aujourd'hui n'écrit pas à tous les clients que vous avez déjà eus.",
          ] },
          { p: "Le courriel lui-même est court exprès : une phrase de remerciement, un bouton, votre logo et votre couleur, votre nom comme expéditeur, les réponses dans votre boîte. Sous le bouton, cinq petits liens de note, de 1 à 5 — la note du client arrive dans FieldQuo, et une réponse mécontente vous joint, vous, pas la page d'avis. Chaque copie porte un lien de désabonnement." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, administrateurs, gestionnaires et répartiteurs peuvent ouvrir et modifier cet écran. Ce qui se passe quand un chantier est marqué terminé, y compris cette demande, est dans [[when-a-job-is-completed|Quand un chantier est terminé]]." },
        ],
      },
    ],
    faq: [
      { q: "Envoie-t-il aussi un texto au client ?", a: "Non. La demande d'avis est un courriel seulement." },
      { q: "Puis-je solliciter un client précis à la main ?", a: "Pas depuis cet écran — c'est automatique, et une fois par chantier. Envoyez-lui vous-même votre lien d'avis depuis la fiche client." },
      { q: "Qu'est-ce qui compte comme « dans la file » ?", a: "Les chantiers terminés dont le délai n'est pas encore écoulé et qui n'ont pas été sollicités, lus dans les mêmes colonnes que la tâche horaire." },
    ],
  },

  "refer-another-business": {
    title: "Parrainer une autre entreprise, gagner un mois gratuit",
    summary:
      "Envoyez votre lien ou une invitation à un autre entrepreneur ; il obtient un mois gratuit à son inscription, et vous en obtenez un ajouté à votre compte une fois qu'il est client payant.",
    updated: "2026-09-12",
    intro: [
      "**Parrainage** — une ligne dans la barre latérale et de nouveau sous **Paramètres → Compte** — est le programme de parrainage de FieldQuo, un entrepreneur qui en parle à un autre. Les deux parties reçoivent la même chose : un mois de FieldQuo. Le mois du nouveau venu arrive le jour de son inscription ; le vôtre arrive le jour de son premier vrai paiement. L'écran sépare les deux volontairement, pour que « J'ai parrainé trois personnes, où sont mes mois ? » ait une réponse visible : **Inscrit — pas encore payant**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page s'ouvre sur « Parrainez une autre entreprise et obtenez un mois de FieldQuo gratuit de plus, une fois qu'elle devient cliente payante. » Puis **Votre lien** avec **Copier** — « Assez court pour être dit à voix haute. Mettez-le sur une carte professionnelle, au bas d'une facture ou sur un camion. » — un bouton **WhatsApp**, **Envoyer par texto** sur un téléphone, et **Envoyer une invitation** par **Courriel** ou **Texto**. En dessous : le nombre de mois gratuits gagnés, **Entreprises que vous avez parrainées** avec une pastille **Crédité** ou **Inscrit — pas encore payant** sur chacune, et **Invitations envoyées**." },
          { figure: "live:app-settings-refer", caption: "Parrainage — votre lien, les boutons de partage, le formulaire d'invitation et les entreprises parrainées jusqu'ici." },
        ],
      },
      {
        id: "send-an-invite",
        heading: "Comment envoyer une invitation",
        blocks: [
          { steps: [
            "Ouvrez **Parrainage**.",
            "Pour le partager vous-même, appuyez sur **Copier** et collez le lien où vous voulez, ou **WhatsApp** / **Envoyer par texto** pour ouvrir votre propre application de messagerie avec le message prêt, et c'est vous qui choisissez le destinataire.",
            "Pour que FieldQuo l'envoie, choisissez **Courriel** ou **Texto** sous **Envoyer une invitation**, entrez **Son courriel** ou **Son numéro de cellulaire**, au besoin **Son nom**, et appuyez sur **Envoyer l'invitation**.",
            "L'invitation apparaît sous **Invitations envoyées** avec son canal et sa date ; elle devient **Inscrit** quand la personne s'inscrit, ou **Échoué** si elle n'a pas pu être livrée.",
          ] },
          { note: "FieldQuo envoie un seul message et ne fait pas de relance. Jusqu'à 20 invitations par jour. Une personne qui a demandé à FieldQuo de ne pas la contacter n'en reçoit pas, et l'écran vous le dit." },
        ],
      },
      {
        id: "how-the-months-work",
        heading: "Comment fonctionnent les mois gratuits",
        blocks: [
          { table: {
            head: ["Qui", "Ce qu'il reçoit", "Quand"],
            rows: [
              ["L'entreprise que vous avez parrainée", "Un mois d'essai gratuit de plus", "À l'inscription par votre lien ou votre invitation"],
              ["Vous", "Un mois gratuit", "Quand cette entreprise fait son premier vrai paiement, a terminé sa configuration et a vérifié ses paiements — « Ajouté automatiquement à votre compte lorsqu'une entreprise que vous avez parrainée effectue son premier paiement. »"],
            ],
          } },
          { p: "Votre mois est un mois du produit, pas un montant en dollars : si vous êtes encore en essai, il repousse la fin de votre essai ; si vous payez, il reporte votre prochain prélèvement d'un mois, sur les forfaits mensuels comme annuels. Rien n'est jamais raccourci, et un deuxième parrainage ajoute un deuxième mois. La récompense est la même quelle que soit la taille de l'entreprise que vous parrainez." },
          { p: "Les limites, toutes contre les abus : vous ne pouvez pas vous parrainer vous-même, une entreprise qui existe déjà ne peut pas utiliser un lien, et un parrain est crédité pour au plus 50 parrainages admissibles par mois civil." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires et administrateurs seulement. La page liste quelles entreprises ont été parrainées et ce qui a été gagné, et envoyer une invitation est réservé aux propriétaires et administrateurs côté serveur, donc la ligne est cachée aux autres plutôt qu'affichée en lecture seule. Les références de clients — un propriétaire qui vous envoie un voisin — sont autre chose : [[referrals-from-clients|Références de clients]]." },
        ],
      },
    ],
    faq: [
      { q: "Ils se sont inscrits mais je n'ai pas encore mon mois — pourquoi ?", a: "Leur pastille se lit Inscrit — pas encore payant. Votre mois arrive à leur premier vrai paiement, une fois leur configuration terminée et leurs paiements vérifiés ; une facture d'essai à 0 $ ne rapporte rien." },
      { q: "D'où vient l'invitation ?", a: "De FieldQuo — c'est FieldQuo qui invite une entreprise en votre nom, pas un message à l'un de vos clients. Votre nom y figure." },
      { q: "Y a-t-il un plafond ?", a: "20 invitations par jour, et un crédit pour au plus 50 parrainages admissibles par mois." },
    ],
  },

  "instant-estimates-as-marketing": {
    title: "L'estimation instantanée comme aimant à prospects",
    summary:
      "Mettez une vraie fourchette de prix sur votre site web, votre lien bio et vos liens à partager, et chaque propriétaire qui l'utilise devient un client, une soumission brouillon dans votre file de révision et un prospect noté — sans que votre grille de tarifs ne devienne jamais publique.",
    updated: "2026-09-12",
    intro: [
      "Un propriétaire qui compare trois entrepreneurs répond à celui qui donne un chiffre. **Paramètres → Côté client → Soumissions instantanées** lui permet d'en obtenir un de vous en quelques secondes — toit mesuré à partir de son adresse, ou une surface qu'il trace sur une carte — et chaque estimation est une fourchette qu'il peut demander, qui arrive dans vos **Révisions de devis** avant que quoi que ce soit ne soit contraignant. Cet article parle de s'en servir comme marketing : où la placer, ce que chaque demande vous apporte, et ce que vous contrôlez.",
      "La grille de tarifs derrière n'est jamais publiée. Un visiteur voit une fourchette, ou rien avant d'avoir soumis — à votre choix — et les tarifs à l'unité restent sur cet écran. La configuration de la tarification elle-même est dans [[instant-quotes-on-your-website|Soumissions instantanées sur votre site web]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran vous dit ce qui est en ligne : « 2 en ligne sur votre lien d'estimation instantanée. » avec **Voir ce que voient les propriétaires**, ou « Rien n'est encore actif sur votre lien d'estimation instantanée — activez un service ci-dessous. » Dès que quelque chose est en ligne, une carte **Ajoutez l'estimation instantanée à votre site web** offre le code à intégrer avec **Copier le code**. Puis une carte par métier : un interrupteur **Activé** / **Désactivé**, **Ce que voit le propriétaire**, les tarifs, **Frais minimum**, **Largeur de la fourchette (±)**, **Tranches de budget** et une note **Financement** facultative." },
          { figure: "live:app-settings-instant-quotes", caption: "Paramètres → Soumissions instantanées — le compte en ligne, le code à intégrer, puis une carte par métier avec son interrupteur et ses tarifs." },
        ],
      },
      {
        id: "where-to-put-it",
        heading: "Où la placer",
        blocks: [
          { bullets: [
            "**Sa propre page** — chaque entreprise a son propre lien d'estimation instantanée, celui qu'ouvre **Voir ce que voient les propriétaires**. La page Soumission de votre site web FieldQuo porte le formulaire d'auto-soumission, qui est autre chose ; l'estimation instantanée se partage par son lien ou s'intègre.",
            "**N'importe quel autre site web** — collez le code de **Copier le code** où vous le voulez. La note dessous dit pourquoi c'est sûr : un élément HTML ordinaire qui fonctionne sur Wix, Squarespace, WordPress et en HTML écrit à la main ; le petit script ne fait que redimensionner le cadre, et sans lui le cadre fonctionne à hauteur fixe.",
            "**Votre lien bio** — quand un métier est activé, l'estimation instantanée est le premier lien proposé, avant réserver une visite et demander une soumission.",
            "**Partager vos liens** — la carte **Estimation instantanée** y porte le lien, **Copier le lien** et **Ouvrir**, pour un texto, une signature de courriel ou un dépliant. Voir [[share-your-links|Partager vos liens]].",
          ] },
        ],
      },
      {
        id: "what-a-request-gives-you",
        heading: "Ce que chaque demande vous apporte",
        blocks: [
          { steps: [
            "Une fiche **client** avec le nom, les coordonnées et l'adresse que le propriétaire a entrés.",
            "Une **soumission brouillon**, chiffrée à partir de vos tarifs, marquée **À réviser** dans la liste des Soumissions et en attente dans **Révisions de devis** — rien ne peut être envoyé avant que quelqu'un confirme le prix. Voir [[estimate-reviews|Révisions de devis : approuver les estimations instantanées]].",
            "Un **prospect** sur le tableau Prospects, source estimation instantanée, noté comme les autres — avec la tranche de budget choisie par le propriétaire et les photos qu'il a jointes. Voir [[lead-scoring-hot-warm-cold|Notation des prospects : chaud, tiède, froid]].",
            "Un courriel au propriétaire confirmant son estimation, à votre image de marque.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il change"],
            rows: [
              ["**Activé** / **Désactivé**", "Si le métier est offert ou non. C'est **Enregistrer et activer** qui le met en ligne ; rien n'est en ligne avec des chiffres que personne n'a choisis."],
              ["**Ce que voit le propriétaire**", "**Ne pas afficher de prix** — il soumet et on lui dit qu'une soumission suivra. **Afficher la fourchette immédiatement** — le montant apparaît avant qu'il laisse ses coordonnées ; attendez-vous à ce que certains le lisent et partent. **Afficher la fourchette après l'envoi** — il remplit le formulaire pour débloquer sa fourchette ; vous obtenez ses coordonnées dans tous les cas — le choix habituel."],
              ["**Largeur de la fourchette (±)** et **Frais minimum**", "L'ampleur de la fourchette autour du montant calculé, et le plancher sous lequel elle ne descend jamais."],
              ["**Tranches de budget**", "Les quatre options proposées quand on demande son budget au propriétaire ; la tranche choisie note le prospect."],
              ["**Financement**", "Facultatif, dans vos mots. FieldQuo n'offre pas de financement ; si vous indiquez votre propre taux et votre durée, l'estimation affiche aussi une mensualité selon ces conditions."],
            ],
          } },
          { warning: "L'écran signale aussi une incohérence — un métier chiffré instantanément qui n'est pas dans votre écran Services, ou un service sans prix instantané — et ne change rien de lui-même. Lisez-le avant de partager le lien." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute personne dont l'accès inclut la vue des prix — propriétaires, administrateurs, gestionnaires, répartiteurs et estimateurs. L'équipe de terrain ne voit pas cet écran, parce que c'est une grille de tarifs." },
        ],
      },
    ],
    faq: [
      { q: "Un concurrent verra-t-il mes tarifs ?", a: "Non. La page publique ne renvoie jamais un tarif ; elle renvoie une fourchette pour un chantier précis, ou rien avant que le propriétaire soumette, selon Ce que voit le propriétaire." },
      { q: "Le propriétaire peut-il accepter l'estimation tout de suite ?", a: "Non. C'est un brouillon qui attend dans Révisions de devis ; vous confirmez le prix, en l'ajustant si la propriété l'exige, puis vous envoyez la soumission." },
      { q: "L'estimation instantanée compte-t-elle comme prospect dans mes chiffres marketing ?", a: "Oui — elle crée un prospect sur le tableau, et ce prospect compte dans le coût moyen par prospect de Dépenses marketing." },
    ],
  },
};
