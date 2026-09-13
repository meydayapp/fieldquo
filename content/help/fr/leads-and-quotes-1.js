// content/help/fr/leads-and-quotes-1.js
//
// Partie 1 de la catégorie « leads-and-quotes » en français (voir le
// composeur, leads-and-quotes.js). Slugs de cette partie (lib/help/tree.js) :
// the-leads-board, lead-scoring-hot-warm-cold, where-leads-come-from,
// the-lead-form-on-your-website, facebook-lead-forms, import-leads,
// convert-a-lead-to-a-quote, the-quotes-list, build-a-quote,
// quote-types-and-takeoffs, lines-from-your-price-book,
// group-a-quote-by-room-or-scope, photos-on-a-quote.
//
// Même structure que l'anglais (sections, blocs, figures, listes, FAQ) —
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran sont
// les chaînes du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "the-leads-board": {
    title: "Le tableau des prospects",
    summary:
      "Chaque demande qui atteint votre entreprise, sur un tableau à quatre colonnes, classée Chaud, Tiède ou Froid, avec le panneau où vous l'attribuez, la notez et la convertissez en soumission.",
    updated: "2026-09-12",
    intro: [
      "**Prospects** est le premier écran du pipeline : l'endroit où une demande arrive avant d'être le client de qui que ce soit. Un inconnu remplit votre formulaire de soumission, réserve une visite, répond à une publicité, appelle la réceptionniste, ou vous importez une liste — et une carte apparaît ici. Rien sur cet écran n'est encore une soumission ; c'est la file des gens à rappeler, ordonnée pour que le meilleur soit en haut.",
      "Le tableau est un pipeline. Une carte se déplace de gauche à droite — **Nouveau**, **Contacté**, **Gagné**, **Perdue** — et chaque carte ouvre un panneau où se fait le vrai travail : lire pourquoi elle a obtenu ce score, l'attribuer à quelqu'un, consigner une note et la convertir en brouillon de soumission qui reprend tout ce que la personne vous a dit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Chaque prospect arrive déjà classé d'après ce que la personne a dit — budget, échéance, urgence, effort fourni — de sorte que la question « qui j'appelle en premier ? » a sa réponse sur la carte plutôt que dans la tête de quelqu'un. Le score est une liste transparente de raisons, pas une boîte noire, et vous pouvez le contredire en modifiant le prospect. Voir [[lead-scoring-hot-warm-cold|Classement des prospects : Chaud, Tiède, Froid]]." },
          { p: "Un prospect est la trace d'une demande, pas un client. La fiche client est créée — ou associée à une fiche existante par le courriel, puis par le téléphone — au moment où vous appuyez sur **Convertir en devis**. D'ici là, la personne n'existe que sur ce tableau." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "L'en-tête dit **Prospects — Demandes reçues de votre page de rendez-vous et de vos formulaires.** De haut en bas :" },
          { bullets: [
            "**Importer**, en haut à droite, ouvre l'importateur CSV — voir [[import-leads|Importer des prospects]].",
            "Une boîte de recherche, **Rechercher nom, courriel, téléphone…**, qui cherche aussi dans le message que la personne a écrit.",
            "Quatre pastilles de filtre — **Tous**, **Chaud**, **Tiède**, **Froid** — chacune avec le nombre de prospects de cette bande.",
            "Un bouton de tri qui affiche **Plus chauds** (score le plus élevé d'abord, puis les plus récents) ou **Plus récents**. Le tableau s'ouvre sur Plus chauds.",
            "Les quatre colonnes — **Nouveau**, **Contacté**, **Gagné**, **Perdue** — chacune avec son compte. Une colonne vide dit **Rien ici**.",
            "Sur chaque carte : le nom de la personne, la pastille de température avec le score (par exemple **Chaud · 86**), les pastilles d'échéance et de budget tels qu'elle les a répondus, la catégorie de service, un compte de photos et un compte de plans PDF, le numéro de la soumission liée dès qu'il en existe une, les initiales du responsable et la date d'arrivée. Un drapeau **Ne pas appeler** apparaît sur quiconque a refusé les appels.",
          ] },
          { figure: "harness:requests", caption: "Prospects — les quatre colonnes, les filtres Chaud / Tiède / Froid avec leurs comptes, le tri Plus chauds et le bouton Importer." },
        ],
      },
      {
        id: "move-a-lead",
        heading: "Comment faire avancer un prospect",
        blocks: [
          { steps: [
            "Ouvrez le prospect en touchant sa carte, ou glissez-la par la poignée dans son coin supérieur droit vers une autre colonne. Sur un téléphone, les colonnes s'empilent : utilisez plutôt les boutons **Statut** du panneau.",
            "Appuyez sur **Contacté** une fois que vous avez parlé à la personne. L'envoi d'une soumission le fait pour vous.",
            "Appuyez sur **Perdue** et choisissez une raison — **Est parti chez un concurrent**, **Prix trop élevé**, **Mauvais moment**, **Pas une vraie demande**, **Jamais répondu** ou **Autre** — puis **Marquer comme perdu**. Le tableau refuse un passage à Perdue sans raison.",
            "**Gagné** ne peut pas être choisi tant qu'aucune soumission n'existe pour le prospect. Convertissez-le d'abord ; dès que le client accepte la soumission, le prospect passe à Gagné de lui-même.",
          ] },
          { note: "La raison choisie pour un prospect perdu est ce qui distingue plus tard une vraie demande d'un faux numéro dans vos chiffres. Un prospect marqué **Pas une vraie demande** se rouvre en un clic si vous changez d'avis." },
          { warning: "Une carte revient à sa place dès que le serveur refuse le déplacement — un prospect ne reste jamais dans une colonne où il n'est pas vraiment. Si vous voyez une bannière rouge du genre « This lead has no quote yet », rien n'a changé." },
        ],
      },
      {
        id: "the-lead-panel",
        heading: "Le panneau du prospect",
        blocks: [
          { p: "Toucher une carte ouvre un panneau intitulé **Prospect**. Tout ce que vous pouvez changer s'y trouve :" },
          { table: {
            head: ["Contrôle", "Ce qu'il fait"],
            rows: [
              ["Les lignes courriel et téléphone", "Touchez pour écrire ou appeler. Un drapeau **Ne pas appeler** à côté du numéro signifie que la personne a refusé les appels."],
              ["**Pourquoi ce score**", "Les raisons et les points derrière elles, par exemple « Ready to start ASAP +35 ». En lecture seule."],
              ["**Échéance** et **Budget**", "Modifiables. Changer l'un ou l'autre reclasse le prospect aussitôt. Une valeur vide se lit **Non précisé** quand le formulaire a posé la question et que la personne l'a sautée, ou **Question non posée** quand ce canal ne la pose jamais — la soumission instantanée, le concepteur de cuisine, le portail et le téléphone."],
              ["**Leur message** et **Ce qu'ils nous ont dit**", "Le texte libre et les réponses structurées du formulaire, plus les photos jointes ou un plan de cuisine dessiné."],
              ["**Responsable**", "Qui s'occupe de ce prospect. **Non attribué** par défaut ; la liste est votre équipe."],
              ["**Statut**", "Les mêmes quatre boutons que les colonnes. Perdue demande une raison ; Gagné est grisé tant qu'aucune soumission n'existe."],
              ["**Convertir en devis** / **Voir le devis Q-…**", "Crée un brouillon de soumission à partir du prospect et l'ouvre dans le générateur, ou ouvre la soumission qui existe déjà. Voir [[convert-a-lead-to-a-quote|Convertir un prospect en soumission]]."],
              ["**Notes**", "Des notes internes avec l'auteur et la date. **Ajouter** en enregistre une ; elles n'atteignent jamais le client."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les prospects sont la zone **Requests** de la grille d'accès. L'écran exige au moins **View only** sur Requests ; déplacer une carte, modifier les qualificatifs, attribuer un responsable ou importer exige **View, create, and edit**. Convertir en soumission exige aussi **View, create, and edit** sur Quotes." },
          { bullets: [
            "**Crew** — aucun accès. La ligne n'est pas dans leur barre latérale et l'API les refuse.",
            "**Estimator** et **Dispatcher** — voir, créer et modifier, donc travailler le tableau et convertir les prospects.",
            "**Manager**, **Administrator** et le propriétaire — tout, suppression comprise.",
            "Un membre dont l'accès aux clients est « nom et adresse seulement » voit le tableau avec le courriel, le téléphone et le budget masqués, et le panneau dit **Masqué par votre niveau d'accès**.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi ne puis-je pas glisser un prospect directement dans Gagné ?", a: "Gagné signifie qu'un client a dit oui à une soumission chiffrée, et un prospect sans soumission n'a rien derrière lui. Convertissez-le d'abord ; une fois la soumission créée, vous pouvez déplacer la carte à la main, et quand le client accepte en ligne, elle bouge toute seule." },
      { q: "Où est passé le courriel du prospect ?", a: "Votre niveau d'accès aux clients est « nom et adresse seulement », donc le serveur retire le courriel, le téléphone et le budget déclaré avant de vous envoyer le tableau. Demandez à un propriétaire ou à un administrateur si vous en avez besoin." },
      { q: "Marquer un prospect Contacté envoie-t-il quelque chose ?", a: "Non. Cela consigne que vous avez parlé à la personne. Aucun bouton de statut de ce tableau n'envoie de courriel ni de texto — mais marquer un prospect Contacté arrête bien une règle de relance **Nouvelle demande, personne n'a répondu**, si vous en avez une. Voir [[follow-up-rules|Règles de relance]]." },
      { q: "Les appels reçus par la réceptionniste apparaissent-ils ici ?", a: "Oui. Un appel pris par la réceptionniste téléphonique crée un prospect avec les coordonnées de l'appelant, classé sans budget, parce que la réceptionniste ne peut jamais parler d'argent. Voir [[the-phone-receptionist|La réceptionniste téléphonique]]." },
    ],
  },

  "lead-scoring-hot-warm-cold": {
    title: "Classement des prospects : Chaud, Tiède, Froid",
    summary:
      "Comment FieldQuo note chaque prospect sur 100 d'après ce que la personne vous a dit, pourquoi les raisons sont imprimées sur le prospect, et ce qui change le score.",
    updated: "2026-09-12",
    intro: [
      "Chaque prospect du tableau porte un score sur 100 et une bande — **Chaud**, **Tiède** ou **Froid** — calculés au moment où il arrive. Le classement est un ensemble de règles transparentes, pas un modèle : chaque point ajouté a une raison en mots clairs, et les raisons sont imprimées sur le prospect sous **Pourquoi ce score**, pour que vous voyiez pourquoi une demande passe devant une autre et puissiez la contredire si vous n'êtes pas d'accord.",
      "Les poids traduisent ce qui prédit un chantier gagné, dans l'ordre : quand la personne veut que ce soit fait, combien elle compte dépenser, s'il s'agit d'une urgence, si vous pouvez la joindre, et l'effort qu'elle a mis dans sa demande.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Le score se calcule à partir des champs du prospect lui-même — échéance, bande de budget, indicateurs d'urgence dans les réponses structurées, téléphone, courriel, photos ou plans joints, plan de cuisine dessiné, et longueur du message. Il s'applique de la même façon à toutes les sources : un prospect venu de votre site web, d'une publicité Facebook, de la réceptionniste ou d'un import CSV est mesuré avec la même règle." },
          { p: "Il est recalculé chaque fois que vous modifiez **Échéance** ou **Budget** dans le panneau du prospect, de sorte qu'un appel téléphonique qui établit un budget fait bouger le prospect aussitôt." },
        ],
      },
      {
        id: "how-points-are-earned",
        heading: "Comment les points sont gagnés",
        blocks: [
          { table: {
            head: ["Signal", "Points", "La raison imprimée sur le prospect"],
            rows: [
              ["Échéance : **Dès que possible** / **Sous 2 semaines** / **1–3 mois** / **Exploration**", "35 / 25 / 12 / 2", "« Ready to start ASAP », « Wants to start within 2 weeks », « Planning within 1–3 months », « Just exploring for now »"],
              ["Budget : **15 000 $+** / **5 000–15 000 $** / **1 000–5 000 $** / **Moins de 1 000 $** / **Incertain**", "30 / 22 / 14 / 6 / 0", "« Budget $15k+ » … « Budget not stated » (affiché à 0 pour que l'absence soit visible)"],
              ["Un indicateur d'urgence dans les réponses (plomberie, CVC, dégâts de tempête)", "20", "« Flagged as an emergency »"],
              ["Un numéro de téléphone", "8", "« Phone number provided »"],
              ["Une adresse courriel", "4", "« Email provided »"],
              ["Des photos ou une vidéo jointes", "4 chacune, jusqu'à 10", "« 2 photos attached »"],
              ["Un plan PDF joint, ou une cuisine dessinée dans le concepteur", "12 pour un plan, 8 pour un plan dessiné", "« Sent a plan (1 PDF) », « Designed a kitchen layout »"],
              ["Un message de 120 caractères ou plus", "5", "« Wrote a detailed description »"],
            ],
          } },
          { p: "Les points s'additionnent et sont plafonnés à 100. Une photo vaut quelque chose parce que quelqu'un a pointé son téléphone vers un mur ; un plan PDF vaut davantage parce que quelqu'un est déjà passé par un planificateur de cuisine et a produit un document — un projet décidé, pas du lèche-vitrine." },
        ],
      },
      {
        id: "the-three-bands",
        heading: "Les trois bandes",
        blocks: [
          { bullets: [
            "**Chaud** — 60 ou plus. Un chantier « dès que possible » avec un vrai budget, ou une urgence, atterrit ici.",
            "**Tiède** — de 30 à 59. Une demande budgétée mais sans hâte, ou une demande pressée sans rien d'autre derrière.",
            "**Froid** — moins de 30. Peu de choses dites, peu de choses jointes. Toujours un prospect ; simplement pas le premier appel.",
          ] },
          { note: "Les bandes sont des seuils sur le score et rien d'autre. Rien n'est envoyé, caché ou supprimé parce qu'un prospect est Froid — le tri **Plus chauds** du tableau le place simplement plus bas." },
        ],
      },
      {
        id: "when-a-question-was-never-asked",
        heading: "Quand une question n'a jamais été posée",
        blocks: [
          { p: "L'absence de réponse n'est pas une réponse. La réceptionniste téléphonique a l'interdiction de parler d'argent, donc un prospect téléphonique ne peut jamais avoir de budget. Plutôt que de perdre 30 points qu'il ne pouvait pas gagner, le budget sort du dénominateur : un prospect téléphonique est noté sur 70 puis ramené sur 100, et le prospect le dit avec la ligne **Scored without budget — the phone can't ask**." },
          { p: "Le panneau du prospect fait la même distinction à l'écran. Une Échéance ou un Budget vide se lit **Non précisé** quand le formulaire a posé la question et que la personne l'a sautée — un visiteur du formulaire de soumission qui a sauté le budget a vraiment refusé de répondre — et **Question non posée** quand ce canal n'a pas cette question : la soumission instantanée ne demande jamais d'échéance, et le concepteur de cuisine, le portail client et l'employé IA ne demandent ni l'un ni l'autre." },
          { tip: "Un prospect **Question non posée** est en général celui à appeler avec la question. Choisissez la réponse dans le panneau et le score se met à jour sur-le-champ." },
        ],
      },
      {
        id: "rescoring",
        heading: "Comment reclasser un prospect",
        blocks: [
          { steps: [
            "Ouvrez le prospect depuis le tableau.",
            "Changez **Échéance** ou **Budget** selon ce que la personne vous a dit.",
            "Le score, la bande et la liste **Pourquoi ce score** se mettent à jour dès que le changement est enregistré ; la carte du tableau bouge avec.",
          ] },
          { p: "Rien d'autre ne reclasse un prospect. Ajouter une note, attribuer un responsable ou changer le statut laisse le score tel quel." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer les poids ?", a: "Non. Les points et les seuils sont les mêmes pour toutes les entreprises et ne sont pas un réglage. Ce que vous pouvez changer, ce sont les réponses du prospect, ce qui le reclasse." },
      { q: "Pourquoi un prospect importé est-il Froid ?", a: "Un CSV porte rarement un budget ou une échéance sous une forme que l'importateur reconnaît, donc le prospect est noté sur sa joignabilité — un téléphone et un courriel valent 12 points ensemble. Ouvrez-le et choisissez l'échéance et le budget dès que vous les connaissez." },
      { q: "Le score décide-t-il quelque chose par lui-même ?", a: "Non. Il ordonne le tableau quand le tri est sur Plus chauds et il est transmis à votre notification pour qu'un prospect chaud puisse être pondéré. Il n'envoie, ne chiffre et n'écarte jamais rien." },
    ],
  },

  "where-leads-come-from": {
    title: "D'où viennent les prospects",
    summary:
      "Les dix façons dont une demande atteint votre tableau des prospects — vos formulaires, vos liens, vos publicités, la réceptionniste et les imports — et ce que chacune a en commun avec les autres.",
    updated: "2026-09-12",
    intro: [
      "Toutes les façons dont un inconnu peut joindre votre entreprise aboutissent au même tableau. Quel que soit le canal — un formulaire sur votre site, une publicité Facebook, un appel pris par la réceptionniste, une liste achetée — la demande est créée par la même fonction, classée par les mêmes règles et annoncée aux mêmes personnes. Cet article dresse la liste des canaux et de ce que chacun apporte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Le panneau du prospect affiche la source sous le nom de la personne, à côté de la date. Connaître la source dit à quoi s'attendre sur la carte : un prospect du formulaire de soumission a un service, des réponses et souvent des photos ; un prospect téléphonique a une adresse et une description, mais pas de budget ; un prospect Facebook a les questions que vous avez mises sur ce formulaire." },
        ],
      },
      {
        id: "the-sources",
        heading: "Les sources",
        blocks: [
          { table: {
            head: ["Canal", "Comment il vous arrive", "Ce que le prospect apporte"],
            rows: [
              ["Formulaire **Demander une soumission**", "Le lien et l'intégration de **Réglages → Partager vos liens**. Voir [[the-lead-form-on-your-website|Le formulaire de prospects sur votre site web]].", "Le service, les réponses d'admission pour ce service, le budget, l'échéance, une description, des photos ou un plan PDF, l'adresse, les coordonnées, la langue choisie."],
              ["Concepteur de cuisine", "Le propriétaire dessine une cuisine sur votre concepteur public.", "Le plan dessiné, une adresse et des notes. Pas de question de budget ni d'échéance — le panneau dit **Question non posée**."],
              ["Estimation instantanée", "Votre lien d'estimation instantanée ; l'estimation arrive aussi dans **Révisions de devis** comme brouillon à approuver.", "La taille, le matériau, la fourchette vue, le budget déclaré. Pas de question d'échéance."],
              ["Entonnoir de prospects", "Un entonnoir publié depuis **Entonnoirs**, partagé dans une publicité ou intégré.", "Les questions propres à l'entonnoir, ce qui a été montré, et les médias joints."],
              ["Portail client", "Un client existant demande d'autres travaux depuis son portail.", "Une catégorie et un message, liés au client."],
              ["Réceptionniste téléphonique", "La réceptionniste IA prend un appel que vous n'avez pas pu prendre.", "Nom, adresse, le travail décrit, l'urgence traduite en échéance. Classé sans budget."],
              ["Employé IA", "Une conversation Facebook, Instagram ou WhatsApp traitée par l'employé IA, avec un rappel réservé.", "Les détails de la conversation, liés au fil dans **Messages**."],
              ["Formulaire de prospects Facebook", "Un formulaire attaché à l'une de vos publicités Meta. Voir [[facebook-lead-forms|Formulaires de prospects Facebook]].", "Les champs standard de Meta et chaque question personnalisée, mot pour mot."],
              ["Formulaire de prospects simple", "Le formulaire allégé conçu pour l'intégration : nom, courriel ou téléphone, une catégorie et un message.", "Les coordonnées, la catégorie et le message."],
              ["Import CSV", "**Importer** sur le tableau des prospects. Voir [[import-leads|Importer des prospects]].", "Ce que le fichier contenait : nom, courriel, téléphone, adresse, notes, budget et échéance quand ils sont reconnaissables."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Ce que toutes les sources partagent",
        blocks: [
          { bullets: [
            "Le prospect est classé à l'arrivée par les mêmes règles — voir [[lead-scoring-hot-warm-cold|Classement des prospects : Chaud, Tiède, Froid]].",
            "Une notification **lead.created** part vers les personnes nommées par vos règles de notification, avec le nom de la personne et la température. Voir [[notifications-for-you|Vos notifications]].",
            "Quand la personne a laissé un numéro de téléphone sur l'un de vos propres formulaires, son consentement à être appelée est consigné, ce qui permet à la réceptionniste de la rappeler si vous avez activé cette option. Un formulaire de prospects Facebook ne consigne pas de consentement, parce que la personne n'a jamais vu le libellé de FieldQuo.",
            "L'adresse courriel est vérifiée avant d'être enregistrée : une adresse à laquelle rien ne peut être livré est refusée sur le formulaire plutôt qu'enregistrée, pour qu'une soumission ne rebondisse pas plus tard.",
            "La langue choisie par la personne sur votre formulaire est conservée sur le prospect et devient la langue de la soumission dans laquelle vous le convertissez.",
          ] },
          { note: "Un prospect est créé même si la notification échoue. Capter la demande passe toujours en premier." },
        ],
      },
      {
        id: "your-links",
        heading: "Où se trouvent les liens",
        blocks: [
          { p: "**Réglages → Partager vos liens** regroupe les trois liens publics — **Demander une soumission**, **Réserver une visite**, **Estimation instantanée** — et une carte par entonnoir publié, chacune avec **Copier le lien**, **Ouvrir** et un extrait d'intégration." },
          { figure: "live:app-settings-lead-form", caption: "Réglages → Partager vos liens — les cartes Demander une soumission, Réserver une visite et Estimation instantanée, chacune avec son lien et son extrait d'intégration." },
          { tip: "Une réservation n'est pas un prospect. Quelqu'un qui réserve une visite depuis **Réserver une visite** obtient un rendez-vous dans votre calendrier, pas une carte sur ce tableau, parce qu'il a déjà décidé." },
        ],
      },
    ],
    faq: [
      { q: "Les messages d'une Page Facebook ou d'Instagram deviennent-ils des prospects ?", a: "Pas d'eux-mêmes. Une conversation vit dans Messages ; elle devient un prospect quand l'employé IA y réserve un rappel, ou quand vous ouvrez le prospect auquel le fil est lié." },
      { q: "Puis-je ajouter un prospect à la main ?", a: "Il n'y a pas de bouton Nouveau prospect. Importez un CSV d'une ligne, ou créez le client et commencez la soumission directement depuis Soumissions." },
      { q: "Tous les canaux posent-ils les mêmes questions ?", a: "Non, et le panneau du prospect est honnête à ce sujet : un Budget ou une Échéance vide se lit Non précisé quand le formulaire a posé la question et Question non posée quand ce canal n'a pas cette question." },
    ],
  },

  "the-lead-form-on-your-website": {
    title: "Le formulaire de prospects sur votre site web",
    summary:
      "Le formulaire Demander une soumission : ce qu'il demande à un propriétaire, où prendre le lien et le code d'intégration, et ce qui arrive sur votre tableau des prospects quand il appuie sur Envoyer.",
    updated: "2026-09-12",
    intro: [
      "**Demander une soumission** est le formulaire public pour quelqu'un qui compare encore les prix. La personne choisit un service, répond à quelques questions sur le travail, dit ce qu'elle compte dépenser et quand, joint des photos et laisse ses coordonnées. Ce qui revient est un prospect classé sur votre tableau — pas un courriel dans une boîte de réception, et jamais un prix.",
      "Vous le partagez comme un simple lien ou vous le collez dans votre propre site web. Les deux viennent de **Réglages → Partager vos liens**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Le formulaire produit un prospect, pas une soumission. Il n'affiche aucun tarif et le point d'accès derrière lui n'en renvoie aucun : un chiffre en libre-service que vous n'avez jamais vu est un chiffre que vous pourriez devoir honorer, et une grille tarifaire publiée est un cadeau à tous les concurrents de la ville. Ce que le formulaire fait à la place, c'est arriver au rappel avec la taille du travail déjà connue." },
          { p: "C'est une page à vous : votre logo et votre nom en haut, votre couleur de marque sur le filet, la confirmation mise en page comme votre soumission. Dans la version intégrée, la bande du logo disparaît, parce que le formulaire se trouve déjà sous l'en-tête de votre propre site." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a sur l'écran de réglages",
        blocks: [
          { p: "**Réglages → Partager vos liens** dit **Mettez-les partout où vous êtes déjà — votre site web, votre fiche Google, votre page Facebook, votre signature de courriel ou le côté de la camionnette.** La carte **Demander une soumission** est la première :" },
          { bullets: [
            "**Ils décrivent le travail et laissent leurs coordonnées. Cela arrive dans votre liste de prospects. Idéal pour ceux qui comparent encore les prix.**",
            "Le lien lui-même, avec **Copier le lien** et **Ouvrir**.",
            "**Ou collez ceci dans votre propre site web** — l'extrait d'intégration, avec **Copier**.",
            "Le pied de l'écran le dit clairement : **Le formulaire de soumission n'offre que les services que vous avez activés dans Réglages → Services, et n'affiche jamais vos prix.**",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Réglages → Partager vos liens — la carte Demander une soumission avec son lien, Copier le lien, Ouvrir et l'extrait d'intégration." },
        ],
      },
      {
        id: "put-it-on-your-site",
        heading: "Comment le mettre sur votre site",
        blocks: [
          { steps: [
            "Ouvrez **Réglages → Partager vos liens**.",
            "Sur la carte **Demander une soumission**, appuyez sur **Copier le lien** pour partager la page seule — dans une publicité, sur Google, dans un texto.",
            "Pour l'intégrer, appuyez sur **Copier** sous **Ou collez ceci dans votre propre site web** et collez l'extrait là où le formulaire doit apparaître.",
            "L'extrait comprend un petit script qui permet au formulaire d'annoncer sa hauteur, pour qu'il grandisse avec la page au lieu de défiler dans une boîte. Si votre outil de site web retire les scripts, le formulaire s'affiche quand même à 640 pixels fixes.",
            "Appuyez sur **Ouvrir** pour l'essayer comme le ferait un propriétaire.",
          ] },
          { note: "Le même écran porte **Réserver une visite**, **Estimation instantanée** et chaque entonnoir publié. L'intégration est traitée en détail dans [[embed-booking-and-quote-forms|Intégrer les formulaires de réservation et de soumission sur n'importe quel site]]." },
        ],
      },
      {
        id: "what-the-form-asks",
        heading: "Ce que le formulaire demande",
        blocks: [
          { p: "Trois étapes, dans l'ordre qu'un inconnu tolère — le service d'abord, les coordonnées en dernier :" },
          { bullets: [
            "Un sélecteur de langue, qui offre les langues dans lesquelles votre entreprise envoie. Le prospect, puis la soumission, sont créés dans la langue choisie.",
            "**Étape 1** — le service, parmi les types de soumission que vous avez activés dans **Réglages → Services et tarifs**.",
            "**Étape 2** — les questions d'admission de ce service (portes, pieds carrés, étages — ce que le type demande), puis les deux questions universelles : la bande de budget (**Incertain**, **Moins de 1 000 $**, **1 000–5 000 $**, **5 000–15 000 $**, **15 000 $+**) et l'échéance (**Dès que possible**, **Sous 2 semaines**, **1–3 mois**, **Exploration**), une description, et des photos, une courte vidéo ou un plan PDF.",
            "**Étape 3** — nom, courriel, téléphone et adresse du chantier, avec une saisie semi-automatique qui enregistre aussi la ville, la province et le pays pour que la taxe soit juste quand vous soumissionnez.",
            "Un courriel ou un téléphone est requis, pas les deux. Une adresse courriel qui ne peut pas recevoir de courrier est refusée pendant que la personne est encore sur le formulaire.",
            "La page de confirmation et, si un courriel a été donné, un courriel de confirmation à votre image. Il dit ce qui a été demandé, jamais un prix.",
          ] },
          { warning: "Désactiver un type de soumission dans **Réglages → Services et tarifs** le retire immédiatement de ce formulaire. Si le formulaire montre un service que vous n'offrez plus, c'est là qu'il faut corriger." },
        ],
      },
      {
        id: "what-arrives",
        heading: "Ce qui arrive de votre côté",
        blocks: [
          { p: "L'envoi devient un prospect avec la source **self_quote** :" },
          { bullets: [
            "Classé à l'arrivée — une bande Chaud / Tiède / Froid et les raisons — et notifié aux personnes nommées par vos règles de notification.",
            "Chaque réponse conservée deux fois : en texte lisible sous **Leur message**, et en réponses structurées sous **Ce qu'ils nous ont dit**, ce que lit le générateur de soumissions quand vous convertissez.",
            "Si la personne a laissé un numéro de téléphone, son consentement à être appelée est consigné, et la réceptionniste la rappelle si vous avez activé les rappels de soumission. Voir [[quote-callbacks|Rappels de soumission]].",
            "**Convertir en devis** crée le client (ou l'associe à un client existant par le courriel, puis par le téléphone) et un brouillon de soumission avec le service, les réponses, les photos et la langue déjà en place.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne de réglages **Partager vos liens** est montrée aux membres qui peuvent gérer les utilisateurs — **Dispatcher**, **Manager**, **Administrator** et le propriétaire. Un membre **Estimator** ou **Crew** ne la voit pas dans les réglages. Le formulaire public lui-même ne demande aucune connexion." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer les questions ?", a: "Par service, oui : un type de soumission personnalisé porte les champs que vous choisissez en le créant dans Réglages → Services et tarifs, et un type intégré pose son propre jeu de questions. Les questions de budget et d'échéance figurent sur chaque envoi et ne peuvent pas être retirées." },
      { q: "Pourquoi le formulaire n'affiche-t-il pas de prix ?", a: "C'est voulu. Les points d'accès publics ne renvoient jamais vos tarifs. Si vous voulez qu'un propriétaire voie un chiffre de départ, c'est l'Estimation instantanée, qui arrive dans Révisions de devis pour que vous la confirmiez avant que quiconque puisse l'envoyer." },
      { q: "Que reçoit le propriétaire ?", a: "Une page de confirmation et, avec une adresse courriel, un courriel de confirmation — les deux à votre image et dans la langue choisie. Aucun montant n'y figure." },
      { q: "Le formulaire de prospects simple est-il la même chose ?", a: "Non. Il existe aussi un formulaire allégé — nom, courriel ou téléphone, catégorie, message — conçu pour l'intégration dans votre propre code. Il crée un prospect de la même façon, mais ne pose aucune question d'admission." },
    ],
  },

  "facebook-lead-forms": {
    title: "Formulaires de prospects Facebook",
    summary:
      "Transformez les formulaires attachés à vos publicités Facebook et Instagram en prospects sur votre tableau, avec la campagne dont chacun provient — et ce que la connexion fait et ne fait pas.",
    updated: "2026-09-12",
    intro: [
      "Vous diffusez une publicité — « Obtenez une estimation de peinture gratuite » — et un propriétaire la touche. Meta affiche son propre formulaire, prérempli avec le nom et le courriel de son compte Facebook, et la personne appuie sur Envoyer. Cette personne est un prospect, et **Réglages → Publicités Meta** est l'endroit où vous dites à FieldQuo lesquels de ces formulaires transformer en prospects.",
      "Un prospect issu d'un formulaire que vous activez apparaît dans **Prospects** comme toute autre demande — noté de la même façon, annoncé aux mêmes personnes — et porte le nom de la campagne dont il vient.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Une seule connexion alimente trois choses : les dépenses publicitaires dans vos chiffres marketing, les formulaires de prospects dans Prospects, et les messages de Page, d'Instagram et de WhatsApp dans Messages. Les formulaires de prospects exigent d'abord la connexion du compte publicitaire Meta, parce que c'est la même connexion qui lit vos Pages." },
          { p: "Meta livre un envoi de deux façons et FieldQuo écoute les deux : un webhook à l'instant où le formulaire est soumis, et une relève de chaque formulaire activé à vingt minutes de chaque heure. Les deux se recoupent exprès — un webhook peut se perdre — et ne peuvent pas compter en double, parce qu'un prospect est indexé sur l'identifiant propre de Meta." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "La carte **Formulaires de prospects Facebook** se trouve sous la connexion du compte publicitaire dans **Réglages → Publicités Meta** :" },
          { bullets: [
            "**Quand quelqu'un remplit le formulaire attaché à l'une de vos publicités Facebook ou Instagram, FieldQuo peut l'ajouter comme prospect.**",
            "**Dernier prospect reçu le …** ou **Aucun prospect n'a encore été reçu depuis Meta.** — la seule ligne qui vous dit que le branchement fonctionne.",
            "Une ligne par formulaire trouvé sur vos Pages, avec **Prospects : …**, la date du dernier, et un commutateur **Activé** / **Désactivé**.",
            "**De quelles campagnes viennent ces prospects** — les campagnes et le nombre de prospects produits par chacune.",
            "**Trouver mes formulaires de prospects** — relit vos Pages et liste les nouveaux formulaires.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Réglages → Publicités Meta — la carte Formulaires de prospects Facebook sous la connexion du compte publicitaire, avant qu'un formulaire ait été trouvé." },
        ],
      },
      {
        id: "switch-a-form-on",
        heading: "Comment activer un formulaire",
        blocks: [
          { steps: [
            "Ouvrez **Réglages → Publicités Meta** et appuyez sur **Connecter Meta Ads** si la carte du haut dit que rien n'est connecté. Voir [[connect-meta-ads|Connecter votre compte publicitaire Meta]].",
            "Appuyez sur **Trouver mes formulaires de prospects**. Chaque formulaire de prospects des Pages que cette connexion peut lire est listé.",
            "Activez le commutateur de chaque formulaire dont les envois doivent devenir des prospects. Laissez un formulaire désactivé et ses envois restent chez Meta.",
            "Surveillez **Dernier prospect reçu le** après votre prochain envoi.",
            "Ouvrez **Prospects** — la nouvelle carte porte la source et la campagne.",
          ] },
          { note: "Si la carte affiche un avis ambre — **Les formulaires de prospects Facebook nécessitent l'approbation par Meta d'une autorisation supplémentaire ; rien n'est encore reçu.** — tous les commutateurs sont désactivés et rien n'arrive. C'est l'examen de l'autorisation par Meta, pas votre configuration ; le reste de la connexion fonctionne." },
        ],
      },
      {
        id: "how-a-lead-arrives",
        heading: "Comment un prospect arrive",
        blocks: [
          { p: "Rien n'est inventé. Les champs standard de Meta vont dans les colonnes du prospect ; chaque question personnalisée que vous avez écrite sur le formulaire est conservée mot pour mot sous **Ce qu'ils nous ont dit**." },
          { bullets: [
            "Le nom, le courriel et le téléphone viennent des champs standard de Meta. L'adresse, la ville, la province, le pays et le code postal les accompagnent quand le formulaire les a demandés.",
            "Aucune bande de budget, aucune échéance ni aucune langue n'est fixée, parce que le formulaire de Meta ne les demande pas, sauf si vous avez écrit ces questions vous-même — auquel cas les réponses sont sur le prospect dans vos mots, pas forcées dans les bandes de FieldQuo. Le panneau dit **Non précisé**.",
            "Le prospect est noté sur ce qu'il a — un téléphone et un courriel valent 12 points — et annoncé aux personnes nommées par vos règles de notification.",
            "Un envoi sans nom, ni courriel, ni téléphone est ignoré plutôt que posé sur votre tableau comme une carte sans nom.",
          ] },
          { warning: "Un formulaire de prospects Facebook ne consigne pas de consentement à être appelé, parce que la personne a vu le libellé de Meta et votre politique de confidentialité, jamais celui de FieldQuo. La réceptionniste ne composera pas son numéro automatiquement ; une personne peut le faire." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Ce que chaque contrôle change",
        blocks: [
          { table: {
            head: ["Contrôle", "Ce qu'il fait"],
            rows: [
              ["**Activé** / **Désactivé** par formulaire", "Activé : le webhook et la relève horaire importent les envois de ce formulaire. Désactivé : rien n'en est importé ; les prospects déjà sur votre tableau restent."],
              ["**Trouver mes formulaires de prospects**", "Relit vos Pages et ajoute à la liste les formulaires nouvellement créés. Il n'importe rien par lui-même."],
              ["**Déconnecter** sur le compte publicitaire", "Met fin à la connexion dont dépendent les formulaires. Les formulaires activés cessent de recevoir jusqu'à ce que vous reconnectiez."],
            ],
          } },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Coût par prospect",
        blocks: [
          { p: "Parce qu'un prospect Meta porte l'identifiant de sa campagne et que les dépenses publicitaires synchronisées portent le même identifiant, FieldQuo peut montrer un coût par prospect par campagne pour ce seul chemin. Le coût par prospect par campagne couvre les prospects arrivés par un formulaire de prospects Meta. Tous les autres canaux — et le propriétaire qui a vu la publicité et a téléphoné — restent mélangés dans l'ensemble, parce que rien ne relie cette dépense à ce prospect. Voir [[marketing-spend|Dépenses marketing]]." },
          { tip: "Donnez à chaque publicité son propre formulaire. Un formulaire partagé par cinq campagnes attribue quand même chaque prospect à la campagne qui l'a produit, mais un formulaire par publicité rend la liste de cette carte lisible d'un coup d'œil." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "**Publicités Meta** est un écran réservé au propriétaire et aux administrateurs : il tient une connexion à un compte qui dépense votre argent. Un membre Manager, Dispatcher, Estimator ou Crew ne voit pas la ligne, et l'API le refuse." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi tous les commutateurs sont-ils grisés ?", a: "La carte vous le dit : les formulaires de prospects Facebook nécessitent l'approbation par Meta d'une autorisation supplémentaire, et d'ici là rien n'est reçu. Votre connexion est bonne ; il n'y a rien à corriger de votre côté." },
      { q: "Un envoi est arrivé deux fois sur Facebook. Aurai-je deux prospects ?", a: "Non. Un prospect est indexé sur l'identifiant propre de Meta, et les deux chemins de livraison le vérifient. La seconde livraison est consignée comme doublon et ne crée rien." },
      { q: "Le prospect me notifie-t-il comme un prospect du site web ?", a: "Oui — la même notification lead.created, aux mêmes personnes, avec la même pondération Chaud / Tiède / Froid." },
      { q: "FieldQuo peut-il modifier mes publicités ?", a: "Non. La connexion ne fait que lire les dépenses, les performances et les formulaires de prospects. Elle ne crée ni ne modifie jamais une publicité." },
    ],
  },

  "import-leads": {
    title: "Importer des prospects",
    summary:
      "Amenez une liste achetée ou exportée d'un autre outil sur votre tableau des prospects à partir d'un CSV, classée de la même façon qu'une demande entrante.",
    updated: "2026-09-12",
    intro: [
      "**Importer**, en haut à droite du tableau des prospects, prend un CSV de prospects achetés ou exportés d'ailleurs et pose chaque ligne sur le tableau comme un prospect. Les colonnes courantes sont reconnues par leur nom, le budget et l'échéance sont associés quand ils sont reconnaissables, et chaque ligne passe par le même classement qu'une demande venue de votre site web.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "L'écran dit **Importer des prospects — Téléversez un CSV de prospects achetés ou exportés d'ailleurs. Nous reconnaîtrons les colonnes courantes (nom, courriel, téléphone, adresse, notes, budget, échéance), classerons chacun chaud/tiède/froid, et les déposerons dans votre entonnoir.** Rien n'est créé avant que vous appuyiez sur le bouton d'importation, et vous voyez d'abord un aperçu." },
          { figure: "harness:requests", caption: "Prospects — le bouton Importer, en haut à droite, ouvre l'importateur CSV." },
        ],
      },
      {
        id: "the-file",
        heading: "Le fichier",
        blocks: [
          { p: "Un CSV avec une ligne d'en-tête. Les noms de colonnes sont reconnus avec souplesse, majuscules ou non :" },
          { table: {
            head: ["Quoi", "Noms de colonnes reconnus"],
            rows: [
              ["Nom", "name, Full Name, full_name, contact"],
              ["Courriel", "email, e-mail"],
              ["Téléphone", "phone, Phone Number, phone_number, mobile, tel"],
              ["Message", "message, notes, details, description, comments"],
              ["Adresse", "address, street, street_address, job address, site address, location — la ligne de rue seulement"],
              ["Budget", "budget, budget_band, price — un chiffre, une fourchette ou des mots comme « under 5k », « $15,000+ », « not sure »"],
              ["Échéance", "timeline, urgency, when, timeframe — des mots comme « asap », « next week », « this spring », « just looking »"],
            ],
          } },
          { note: "La ville et la province ne sont volontairement pas lues depuis un tableur, parce qu'un territoire deviné à partir d'une colonne détermine un taux de taxe sur un document. L'adresse est reprise comme ligne de rue ; la ville et la province du client sont fixées quand vous convertissez." },
        ],
      },
      {
        id: "import-the-file",
        heading: "Comment importer",
        blocks: [
          { steps: [
            "Ouvrez **Prospects** et appuyez sur **Importer**.",
            "Appuyez sur **Choisir un fichier CSV** et choisissez le fichier. La page le lit dans votre navigateur et affiche **… trouvées. Aperçu :** avec les trois premiers noms et coordonnées.",
            "Appuyez sur **Importer … prospects**.",
            "Le résultat dit **… importés**, et **, … ignorés sans nom ni coordonnées** quand des lignes ont été écartées.",
            "Appuyez sur **Voir les prospects** pour revenir au tableau. Les nouvelles cartes sont triées avec les autres.",
          ] },
          { warning: "Un fichier de plus de 2 000 lignes est refusé — divisez-le. Une ligne sans nom et sans courriel ou téléphone utilisable est ignorée, parce qu'un prospect que personne ne peut joindre ni nommer est du bruit, pas un prospect." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "Ce qui arrive à chaque ligne",
        blocks: [
          { bullets: [
            "Elle devient un prospect avec la source **imported** et un nom — ou **Imported lead** quand la ligne n'en avait pas.",
            "Le budget et l'échéance sont associés aux mêmes bandes que le formulaire du site web quand le texte est reconnaissable — « $3,000–$5,000 » devient **1 000–5 000 $**, « $15,000+ » devient **15 000 $+**, « no rush » devient **Exploration**. Quand rien n'est reconnaissable, le prospect n'a simplement pas de bande ; on ne lui crédite pas un budget qu'il n'a jamais déclaré.",
            "Elle est notée sur ce qu'elle a. Une ligne avec un téléphone et un courriel mais sans budget ni échéance obtient 12 et atterrit **Froid** jusqu'à ce que vous l'ouvriez et choisissiez les réponses.",
            "La même notification **lead.created** part que pour toute demande, une par ligne.",
            "Une ligne qui échoue est ignorée ; le reste du fichier s'importe quand même.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Importer, c'est créer des demandes, donc il faut **View, create, and edit** sur Requests — **Estimator**, **Dispatcher**, **Manager**, **Administrator** et le propriétaire. Un membre en dessous voit le panneau d'accès refusé, et le serveur refuse le téléversement." },
        ],
      },
    ],
    faq: [
      { q: "Cela créera-t-il des doublons ?", a: "L'importateur ne vérifie pas les prospects existants, donc importer deux fois le même fichier donne deux cartes par personne. Les clients en double ne sont évités que plus tard, quand un prospect est converti et associé par le courriel ou le téléphone." },
      { q: "Puis-je importer des clients de cette façon ?", a: "Non — ceci crée des prospects. Les clients ont leur propre importateur sous Clients ; voir [[import-clients-from-a-csv|Importer des clients à partir d'un CSV]]." },
      { q: "Pourquoi ma colonne de budget n'a-t-elle pas été associée ?", a: "L'importateur lit un chiffre, une fourchette ou une poignée de mots. Un budget écrit « mid-range » ou « TBC » ne correspond à rien et le prospect n'affiche pas de bande. Ouvrez le prospect et choisissez-la." },
    ],
  },

  "convert-a-lead-to-a-quote": {
    title: "Convertir un prospect en soumission",
    summary:
      "Ce que fait le bouton Convertir en devis : le client qu'il crée ou associe, le brouillon de soumission qu'il ouvre, ce qui est repris, et pourquoi le prospect n'est pas encore Gagné.",
    updated: "2026-09-12",
    intro: [
      "**Convertir en devis**, dans le panneau du prospect, transforme une demande en brouillon de soumission avec les coordonnées de la personne, le service demandé, ses réponses et ses photos déjà en place, et vous dépose dans le générateur, prêt à chiffrer. Il crée la fiche client du même coup — ou l'associe à une fiche que vous avez déjà.",
      "Il ne rend pas le prospect Gagné. Rédiger une soumission n'est pas gagner le travail ; le prospect suit désormais le sort réel de la soumission.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Convertir est un seul geste et on peut le faire deux fois sans risque : un prospect déjà lié à une soumission affiche plutôt **Voir le devis Q-…**, et ce bouton ouvre cette soumission au lieu d'en créer une seconde." },
          { p: "La soumission est créée en **brouillon** avec un total de zéro. Personne ne l'a encore chiffrée, et un montant que le propriétaire pourrait voir sans que vous l'ayez jamais approuvé est exactement ce que la distinction prospect-soumission sert à éviter. Votre travail dans le générateur, c'est le prix ; le reste est déjà rempli." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment convertir",
        blocks: [
          { steps: [
            "Ouvrez le prospect sur le tableau **Prospects**.",
            "Lisez **Pourquoi ce score**, **Leur message** et **Ce qu'ils nous ont dit** — les réponses seront dans les notes de la soumission, mais c'est ici que vous décidez s'il faut d'abord appeler.",
            "Appuyez sur **Convertir en devis**. Le bouton affiche **Conversion…** et le générateur s'ouvre sur le nouveau brouillon.",
            "Ajoutez les lignes et le prix, puis **Enregistrer le brouillon** ou **Enregistrer et envoyer** — voir [[build-a-quote|Bâtir une soumission]] et [[send-a-quote|Envoyer une soumission]].",
          ] },
          { tip: "Convertissez avant d'appeler si vous voulez avoir le numéro de soumission sous les yeux pendant l'appel. La carte du prospect affiche le numéro dès qu'il existe." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "Ce qui est repris",
        blocks: [
          { table: {
            head: ["Sur le prospect", "Sur la soumission"],
            rows: [
              ["Nom, courriel, téléphone", "Le client. Associé à un client existant par le courriel d'abord, puis par le téléphone, pour qu'une personne qui redemande ne devienne pas une seconde fiche client."],
              ["Adresse, ville, province, pays venant du formulaire", "L'adresse du client et son territoire fiscal — ce qui fait la différence entre une soumission qui facture la bonne taxe et une qui n'en facture silencieusement aucune."],
              ["Le service choisi", "Le premier groupe de portée de la soumission, de ce type, sans lignes pour l'instant."],
              ["Budget et échéance", "Deux lignes en tête des **Notes** de la soumission : « Budget: 5,000 – 15,000 », « Timeline: Within 2 weeks », suivies de leur message."],
              ["Photos, vidéos, plans PDF", "Les **Photos et vidéos du client** de la soumission. Voir [[photos-on-a-quote|Les photos sur une soumission]]."],
              ["La langue choisie", "La langue de la soumission, fixée à la création. Un prospect à qui la question n'a jamais été posée reprend la langue de votre entreprise. Voir [[quote-language|Une soumission garde sa langue]]."],
              ["Le prospect lui-même", "Lié à la soumission : la carte affiche le numéro de soumission et le panneau propose **Voir le devis**."],
            ],
          } },
          { note: "Les deux lignes sur le budget et l'échéance vont dans les notes de la soumission, que le client peut lire. Modifiez les notes dans le générateur si vous préférez qu'il ne voie pas ce qu'il vous a dit." },
        ],
      },
      {
        id: "the-lead-follows-the-quote",
        heading: "Le prospect suit la soumission",
        blocks: [
          { p: "Convertir laisse la colonne du prospect là où elle était. À partir de là, le prospect bouge avec la soumission :" },
          { bullets: [
            "Soumission **envoyée** → le prospect passe à **Contacté**, s'il était encore dans **Nouveau**. Un renvoi ne ramène jamais un prospect gagné ou perdu en arrière.",
            "Soumission **acceptée** → le prospect passe à **Gagné**. C'est aussi le moment où un chantier est créé ; voir [[convert-a-quote-to-a-job|Ce qui se passe quand une soumission est approuvée]].",
            "Soumission **refusée** → le prospect passe à **Perdue**.",
          ] },
          { warning: "Tant qu'aucune soumission n'existe, **Gagné** est refusé sur le tableau et dans le panneau, avec la phrase **Gagné suit le sort du devis — convertissez d'abord ce prospect.** Une fausse victoire resterait dans votre taux de réussite pour toujours." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Convertir crée une soumission, donc il faut **View, create, and edit** sur Quotes — **Estimator**, **Dispatcher**, **Manager**, **Administrator** et le propriétaire. Un membre qui peut voir les prospects mais pas créer de soumissions reçoit un refus du serveur, affiché dans le panneau." },
        ],
      },
    ],
    faq: [
      { q: "J'ai converti le mauvais prospect. Puis-je annuler ?", a: "Supprimez le brouillon de soumission depuis sa page si votre niveau d'accès permet de supprimer des soumissions. Le prospect est délié quand la soumission disparaît et peut être converti de nouveau. Il n'y a pas de bouton d'annulation sur le prospect lui-même." },
      { q: "Pourquoi la conversion n'a-t-elle pas créé de nouveau client ?", a: "Parce que vous en aviez déjà un avec ce courriel ou ce téléphone. La soumission est rattachée au client existant, ce qui est ce que vous voulez pour un client qui revient." },
      { q: "La soumission s'est ouverte en anglais alors que mon entreprise travaille en français.", a: "La personne a choisi l'anglais sur votre formulaire, et tout ce qu'elle a reçu depuis était en anglais. Faire basculer le document en français au moment précis où il commence à compter est exactement ce que la règle empêche. Voir [[quote-language|Une soumission garde sa langue]]." },
    ],
  },

  "the-quotes-list": {
    title: "La liste des soumissions",
    summary:
      "Chaque soumission rédigée par votre entreprise, avec des pastilles de statut qui filtrent, une boîte de recherche, et les soumissions en attente d'un client remontées en haut.",
    updated: "2026-09-12",
    intro: [
      "**Soumissions** est la liste de toutes les soumissions — brouillon, envoyée, acceptée ou refusée — avec une pastille par statut qui filtre la liste, une boîte de recherche, et une chose qu'aucune liste plate ne fait : les soumissions envoyées et restées sans réponse sont remontées en haut sous l'en-tête **Soumission envoyée, sans réponse**, les plus anciennes d'abord, avec leur date d'expiration à côté.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "L'écran dit **Soumissions — Gérez les soumissions de vos clients.** Le bouton **Nouvelle soumission** ouvre le générateur — voir [[build-a-quote|Bâtir une soumission]]. Chaque ligne ouvre la page de la soumission, où vivent l'envoi, la modification, la révision IA et la décision du client — et **Dupliquer**, qui repart d'une soumission déjà écrite pour en faire un nouveau brouillon." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas :" },
          { bullets: [
            "**Nouvelle soumission**, en haut à droite — montré seulement aux membres qui peuvent créer des soumissions.",
            "Cinq pastilles avec des comptes — **Tous**, **Brouillon**, **Envoyée**, **Acceptée**, **Refusée**. En appuyer une montre les lignes derrière le chiffre. Les comptes portent sur les soumissions dont c'est le statut en ce moment, donc **Envoyée** baisse d'un à l'instant où un client accepte.",
            "**Rechercher une soumission...** — cherche dans le numéro de soumission et le nom du client.",
            "Le groupe **Soumission envoyée, sans réponse**, quand le filtre est sur **Tous** et qu'au moins une soumission attend : ces lignes d'abord, envoi le plus ancien en premier.",
            "Tout le reste dans l'ordre de création, la plus récente d'abord — ce que vous venez de taper est ce que vous cherchez.",
            "Un panneau de première utilisation, **Aucune soumission pour l’instant.** avec **Créez votre première soumission**, quand l'entreprise n'en a jamais rédigé ; **Aucune soumission ne correspond à votre recherche.** quand un filtre ou une recherche ramène la liste à rien.",
          ] },
          { figure: "harness:quotes", caption: "Soumissions — les cinq pastilles de statut avec leurs comptes, la boîte de recherche, et une soumission envoyée remontée en haut sous « Soumission envoyée, sans réponse »." },
        ],
      },
      {
        id: "the-order-of-the-rows",
        heading: "Pourquoi les lignes sont dans cet ordre",
        blocks: [
          { p: "Une soumission envoyée il y a douze jours et une autre envoyée il y a trente et un jours se ressemblaient, et la seconde expire demain. La liste sépare désormais les lignes que quelqu'un doit relancer de tout le reste :" },
          { bullets: [
            "**À relancer** — statut **Envoyée**. Triées par date d'envoi, la plus ancienne d'abord, parce que le client qui attend depuis le plus longtemps est celui qui a le plus probablement oublié. Une soumission envoyée dont l'expiration tombe dans les **3 jours**, ou est déjà passée, porte une barre d'accent sur son bord gauche.",
            "**Le reste** — tout ce qui n'est pas envoyé, le plus récent d'abord.",
            "Une soumission marquée envoyée à la main — un prix convenu au téléphone, un document importé — n'a pas de date d'envoi, donc la ligne n'affiche pas d'âge plutôt que d'en inventer un à partir du jour de création.",
          ] },
          { note: "L'accent à 3 jours n'est qu'un affichage. Rien n'est envoyé ni décidé sur cette base ; le courriel de relance automatique a son propre délai dans **Réglages → Relances** — voir [[quotes-sent-with-no-response|Soumissions envoyées sans réponse]]." },
        ],
      },
      {
        id: "what-each-row-says",
        heading: "Ce que dit chaque ligne",
        blocks: [
          { table: {
            head: ["Sur la ligne", "Signification"],
            rows: [
              ["**Q-1044** et un badge de statut", "Le numéro et le statut actuel — **Brouillon**, **Envoyée**, **Acceptée**, **Refusée**, ou **Expirée** sur une soumission envoyée dont la date est passée."],
              ["**À réviser**", "Une estimation instantanée que le propriétaire a chiffrée lui-même, encore à confirmer par une personne dans **Révisions de devis** avant de pouvoir être envoyée. Voir [[estimate-reviews|Révisions d'estimations]]."],
              ["**Approuvée — prête à envoyer**", "Une estimation instantanée qu'une personne a confirmée ; c'est maintenant un brouillon ordinaire."],
              ["Le nom du client", "Pour qui elle est."],
              ["**aujourd'hui**, **hier**, **il y a 4 jours**", "L'âge — depuis la date d'envoi sur une soumission envoyée, depuis la création sinon."],
              ["**Valide jusqu'au 2026-10-10** ou **Expirée 2026-09-01**", "L'expiration propre à la soumission, sur les soumissions envoyées. Une soumission sans expiration n'en affiche pas. Voir [[quote-validity-and-expiry|Combien de temps une soumission reste valide]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La liste exige au moins **View only** sur Quotes ; **Nouvelle soumission** exige **View, create, and edit**. **Crew** n'a pas accès aux soumissions et ne voit pas la ligne. **Estimator** et **Dispatcher** peuvent voir, créer et modifier ; **Manager**, **Administrator** et le propriétaire peuvent aussi supprimer. Un membre sans le commutateur **See prices** voit les lignes avec les montants masqués." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le compte Envoyée diffère-t-il de « Soumissions envoyées ce mois-ci » sur le tableau de bord ?", a: "Cette pastille compte les soumissions dont le statut est Envoyée en ce moment. Le tableau de bord compte toutes les soumissions envoyées dans le mois, y compris celles acceptées ou refusées depuis." },
      { q: "Où est la relance ?", a: "Le groupe Soumission envoyée, sans réponse est la file. Le courriel de rappel lui-même est une automatisation dans Réglages → Relances, et la page de chaque soumission montre ce qui a été envoyé." },
      { q: "Puis-je trier par montant ou par client ?", a: "Pas sur cet écran. Utilisez la boîte de recherche pour un client ; l'ordre est fixé à ce qu'il faut relancer d'abord, puis au plus récent." },
    ],
  },

  "build-a-quote": {
    title: "Bâtir une soumission",
    summary:
      "Le générateur de soumissions de haut en bas — client, responsable, langue, services, lignes, coût et marge, notes, photos, totaux — et les trois façons d'en sortir.",
    updated: "2026-09-12",
    intro: [
      "**Nouvelle soumission** ouvre un seul écran — le générateur — qui est aussi l'éditeur de chaque soumission que vous rouvrez. Vous choisissez le client, touchez les services, remplissez ce que chacun demande, ajustez les lignes, et le total se calcule de lui-même à partir de vos propres tarifs. Rien de ce que vous tapez ici n'atteint le client avant l'envoi.",
      "Le sous-titre le dit : **Créez une soumission à partir de vos services activés.** Les tuiles que vous voyez sont les types de soumission activés dans **Réglages → Services et tarifs**, et les prix qu'elles remplissent sont les vôtres.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Une soumission, c'est un client, une langue, un ou plusieurs **groupes de portée** (un par service, chacun avec ses lignes et son propre sous-total), un rabais, la taxe, une date d'expiration, des notes, des photos et un statut. Le générateur garde un sous-total courant sur chaque groupe pour que vous voyiez quelle moitié d'une soumission à deux services est la chère." },
          { p: "Créer et modifier ne diffèrent que sur deux points : sur une nouvelle soumission, vous choisissez le client et la langue ; sur une soumission enregistrée, les deux sont fixés — la langue parce qu'un document garde la langue dans laquelle il a été créé, le client parce que la soumission est la sienne." },
        ],
      },
      {
        id: "before-you-start",
        heading: "Avant de commencer",
        blocks: [
          { bullets: [
            "Activez les types de soumission que vous vendez et fixez leurs tarifs — [[quote-types-and-takeoffs|Types de soumission et relevés]]. Un type désactivé n'a pas de tuile.",
            "Mettez vos extras ponctuels dans le catalogue de prix — [[lines-from-your-price-book|Des lignes tirées de votre catalogue de prix]] — pour qu'ils soient à un doigt de distance.",
            "Ayez l'adresse du client : elle détermine le taux de taxe, et une soumission sans territoire affiche un taux présumé avec une mise en garde dessous.",
            "Vous avez déjà tarifé quelque chose de semblable ? **Dupliquer** sur la page de cette soumission ouvre un nouveau brouillon sous le numéro suivant, avec le même client, la même langue, les mêmes services et lignes, les options offertes, le calcul de coût, les notes et les sections du courriel — et rien de son historique : pas de date d'envoi, de signature, d'approbation, de modifications du client ni de révision IA.",
          ] },
          { tip: "Vous partez d'un prospect ? **Convertir en devis** dans le panneau du prospect ouvre cet écran avec le client, le service, les réponses et les photos déjà remplis. Voir [[convert-a-lead-to-a-quote|Convertir un prospect en soumission]]." },
        ],
      },
      {
        id: "the-builder-top-to-bottom",
        heading: "Le générateur, de haut en bas",
        blocks: [
          { p: "Les cartes, dans l'ordre où elles apparaissent :" },
          { bullets: [
            "**Client** — « Search clients… » ou « Add new client » (une personne ou une entreprise, avec sa personne-contact, sa langue et son adresse). Choisir un client dont la langue est enregistrée fixe la langue de la soumission.",
            "**Assigné à** — « Me (default) », ou un autre membre. Réattribuer à quelqu'un d'autre exige la permission d'attribution ; sinon le serveur refuse.",
            "La barre de langue — la langue dans laquelle ce document sera rédigé, parmi celles dans lesquelles votre entreprise envoie. Choisie une fois ; fixée après le premier enregistrement. Voir [[quote-language|Une soumission garde sa langue]].",
            "**Ajouter un service — Touchez-en un pour l'ajouter à cette soumission. Vos propres prix se remplissent automatiquement.** Une tuile par type de soumission activé. Certains métiers ouvrent une liste de sections à choisir — voir [[group-a-quote-by-room-or-scope|Regrouper une soumission par pièce ou par portée]].",
            "Une carte par service ajouté, numérotée **01**, **02** quand il y en a plus d'une, avec la couleur du métier, un sous-total courant et un bouton de retrait. À l'intérieur : le formulaire du métier — un relevé, une grille d'unités, un menu de forfaits ou une série de questions — puis les lignes : « Description », « Qty », « Rate », « Amount », « Add line item », « Common for this trade », et « + Add from Products & Services… ».",
            "**Cost & margin (internal — never shown to the client)** — équipe, heures, matériaux, frais généraux et la marge par rapport au prix. Montré seulement aux membres qui ont le calcul des coûts de chantier. Voir [[cost-and-margin-on-a-quote|Coût et marge sur une soumission]].",
            "**Notes** (**Tout ce que le client devrait savoir...**) et **Photos et vidéos du client** — voir [[photos-on-a-quote|Les photos sur une soumission]].",
            "La barre des totaux — **Valide jusqu'au** (30 jours à partir d'aujourd'hui, modifiable ou effaçable), **Rabais** en montant ou en pourcentage, **Taux de taxe (%)** avec **Facturer la taxe sur cette soumission**, puis **Sous-total**, **Taxe**, **Total** — et les boutons **Réviser**, **Enregistrer le brouillon**, **Enregistrer et envoyer**. Dessous, **Ce qui suit** : les étapes du déroulement que le client lit au bas de la soumission.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nouvelle soumission — Client, Assigné à, Ajouter un service, Coût et marge, Notes, Photos et vidéos, puis la barre des totaux avec Réviser, Enregistrer le brouillon et Enregistrer et envoyer." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment en bâtir une",
        blocks: [
          { steps: [
            "Appuyez sur **Nouvelle soumission** dans la liste des soumissions.",
            "Choisissez le client, ou « Add new client » et remplissez le nom, le courriel, le téléphone, la langue et l'adresse.",
            "Vérifiez la barre de langue. La langue enregistrée du client est déjà sélectionnée ; changez-la seulement si ce document doit être dans une autre.",
            "Touchez une tuile de service. Sa carte apparaît avec le formulaire propre au métier.",
            "Remplissez le formulaire — portes et façades de tiroirs, zones et surfaces, une taille de chargement, ou les questions du métier. Les lignes et le sous-total apparaissent à mesure.",
            "Ajustez les lignes : modifiez un tarif, ajoutez une ligne à la main, touchez-en une dans « Common for this trade » (une description dont le prix est laissé vide pour vous), ou choisissez un article dans « + Add from Products & Services… » avec son prix déjà en place.",
            "Fixez **Valide jusqu'au**, un **Rabais** s'il y a lieu, et vérifiez la ligne de taxe. Une mention jaune **Présumée** signifie que le taux vient de votre propre province parce que le client n'a pas d'adresse au dossier — choisissez un client avec une adresse, saisissez le taux, ou désactivez la taxe.",
            "Appuyez sur **Enregistrer le brouillon**, **Enregistrer et envoyer** ou **Réviser**.",
          ] },
          { note: "Le générateur refuse d'enregistrer tant qu'un client n'est pas choisi et qu'au moins un service n'est pas sur la soumission : les boutons restent désactivés et la bannière dit **Sélectionnez ou créez d'abord un client** ou **Ajoutez au moins un service à la soumission**." },
        ],
      },
      {
        id: "three-ways-out",
        heading: "Les trois façons d'en sortir",
        blocks: [
          { table: {
            head: ["Bouton", "Ce qui se passe"],
            rows: [
              ["**Enregistrer le brouillon**", "La soumission est enregistrée avec le statut **Brouillon** et sa page s'ouvre. Personne ne reçoit de courriel."],
              ["**Enregistrer et envoyer**", "Une confirmation demande **Envoyer cette soumission ? Ils la recevront par courriel immédiatement. L'envoi est irréversible.** et nomme le destinataire. **Enregistrer et envoyer** enregistre et envoie la soumission par courriel, avec son PDF, dans la langue de la soumission. Le statut devient **Envoyée** seulement une fois le courriel accepté. Voir [[send-a-quote|Envoyer une soumission]]."],
              ["**Réviser**", "Enregistre d'abord un brouillon — la révision lit la soumission enregistrée — puis l'ouvre avec les vérifications déjà faites : complétude, comparaison de prix avec votre propre historique, extras suggérés et notes de l'IA. Voir [[ai-quote-review|La révision IA des soumissions]]."],
            ],
          } },
          { warning: "Enregistrer une soumission fige ses prix. Les lignes d'un groupe enregistré se modifient comme des nombres ; son relevé est conservé mais pas rouvert, pour qu'une soumission déjà dans la boîte de réception d'un client ne se rechiffre jamais en silence parce qu'une grille tarifaire a bougé." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Bâtir une soumission exige **View, create, and edit** sur Quotes et le commutateur **See prices** — **Estimator**, **Dispatcher**, **Manager**, **Administrator** et le propriétaire. Un membre qui a accès aux soumissions mais pas à See prices se voit refuser le générateur plutôt que d'en recevoir un chiffré avec des nombres qui ne sont pas ceux de l'entreprise. **Crew** n'a pas accès aux soumissions." },
        ],
      },
    ],
    faq: [
      { q: "D'où viennent les prix ?", a: "De la grille tarifaire du métier dans Réglages → Services et tarifs pour la portée principale, et de Produits et services pour les extras. Les deux sont à vous ; les valeurs par défaut de FieldQuo ne s'appliquent que jusqu'à ce que vous fixiez les vôtres." },
      { q: "Puis-je rédiger une soumission sans tuile de service ?", a: "Non — chaque soumission a au moins un groupe de portée. Si aucun type intégré ne convient, créez un type de soumission personnalisé avec les champs voulus dans Réglages → Services et tarifs." },
      { q: "Pourquoi la barre de langue disparaît-elle sur une soumission enregistrée ?", a: "Une soumission garde la langue dans laquelle elle a été créée, pour que la copie envoyée par courriel et le PDF disent la même chose que ce qui a été approuvé. Créez une nouvelle soumission pour une autre langue." },
      { q: "À quoi servent les Notes à réviser ?", a: "Une boîte interne qui n'apparaît que lorsqu'un brouillon issu d'un appel téléphonique ou la révision y a mis quelque chose. Elle n'apparaît jamais sur la copie du client ; effacez-la une fois que vous avez réglé ce qu'elle dit." },
    ],
  },

  "quote-types-and-takeoffs": {
    title: "Types de soumission et relevés",
    summary:
      "Réglages → Services et tarifs : les types de soumission que vous activez, les quatre façons dont un type chiffre — relevé, grille d'unités, forfaits ou questions — la grille tarifaire derrière chacun, et les types personnalisés.",
    updated: "2026-09-12",
    intro: [
      "Un **type de soumission** est ce que représente une tuile de service dans le générateur : un genre de travail, les questions qu'il pose et la grille tarifaire d'où il tire ses prix. **Réglages → Services et tarifs** est l'endroit où vous activez et désactivez les types, fixez les tarifs et écrivez ce que la soumission dit de chacun. Les tuiles de **Nouvelle soumission** sont exactement les types activés ici.",
      "Certains types chiffrent à partir d'un **relevé** — un formulaire structuré qui mesure le travail et écrit les lignes pour vous. D'autres chiffrent à l'unité, à partir d'un menu de forfaits, ou d'une courte série de questions et d'un tarif forfaitaire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "L'écran dit **Services et tarifs — Activez les types de soumission que vous offrez et définissez votre tarif par défaut pour chacun. Ce sont ceux qui apparaissent lorsque vous créez une nouvelle soumission. Vous pouvez toujours modifier les prix sur chaque soumission.** Il liste les types des secteurs choisis à l'inscription ; **+ Afficher les services d’autres métiers** ouvre tout le catalogue, environ soixante-dix." },
          { p: "Les tarifs ne quittent jamais cet écran. Le formulaire public de soumission offre vos services activés et leurs questions, jamais un prix ; cette règle est fixe." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Une carte par type de soumission :" },
          { bullets: [
            "Une case à cocher — cochée, le type a une tuile dans le générateur et figure sur votre formulaire public de soumission.",
            "**Facturé à** — des pastilles nommant ce que le type facture (« 3-tab asphalt shingles (square) », « Per door », « Vinyl siding (sqft of wall) »). Un type chiffré à partir d'une facture de fournisseur n'a pas de base unitaire et n'en affiche aucune.",
            "« Rate card » — une grille repliable de vos tarifs pour la portée principale, avec « Reset to defaults ». Une pastille « customised » apparaît dès qu'un tarif est le vôtre plutôt que la valeur par défaut.",
            "**Ce que dit la soumission** — le libellé que le client lit pour ce métier : **Ce qu’est ce service**, **Ce qui est inclus**, **Comment le chantier se déroule**. Laissez un champ vide pour continuer d'hériter de la valeur par défaut de FieldQuo.",
            "**Les propriétaires peuvent obtenir un prix instantané pour ce service** ou **Un devis instantané est disponible pour ce service — configurez-le** — l'estimation instantanée du métier, avec un lien vers **Réglages → Soumissions instantanées**.",
            "Pour un type sans grille tarifaire : une case **Tarif** et une unité, plus **Ajouter des articles standards aux Produits et services** quand le métier livre un jeu standard d'extras.",
          ] },
          { figure: "live:app-settings-services", caption: "Réglages → Services et tarifs — une carte par type de soumission avec sa case à cocher, les pastilles Facturé à, la grille tarifaire et Ce que dit la soumission." },
        ],
      },
      {
        id: "the-four-ways-a-type-prices",
        heading: "Les quatre façons dont un type chiffre",
        blocks: [
          { table: {
            head: ["Comment il chiffre", "Quels types", "Ce que vous remplissez sur la soumission"],
            rows: [
              ["**Relevé** — un formulaire mesuré qui écrit les lignes", "Peinture intérieure et extérieure, planchers, escaliers, comptoirs, toiture, revêtement, gouttières, isolation, pavage, scellant d'entrée, portes de garage, déneigement, inspection de maison", "Zones, surfaces, carrés, pieds linéaires, les éléments du chantier. Chacun devient une ligne avec sa mesure dans la description, chiffrée d'après la grille tarifaire."],
              ["**Grille d'unités** — par porte, par façade de tiroir, avec complexité", "Refinition d'armoires, resurfaçage d'armoires", "Les quantités et le matériau des portes ; la complexité choisie sur la soumission fait bouger le tarif."],
              ["**Forfaits** — un menu de formules", "Enlèvement de déchets (**Load Size**), esthétique automobile, ramonage", "Un forfait ; son prix est la ligne."],
              ["**Questions et un tarif** — les champs d'admission et un tarif forfaitaire ou unitaire", "Tous les autres types, et chaque type personnalisé", "Les questions du type, puis des lignes ajoutées à la main ou depuis le catalogue de prix."],
            ],
          } },
          { p: "Seize métiers portent une grille tarifaire complète ; les autres ont un seul **Tarif** par unité. Quelle que soit la méthode, le résultat est le même genre de ligne — une description et un montant — et la page, le courriel et le PDF destinés au client ne lisent que cela. Les taux de production, les formules et les taux de vente restent de votre côté." },
        ],
      },
      {
        id: "turn-a-type-on",
        heading: "Comment activer un type et fixer ses tarifs",
        blocks: [
          { steps: [
            "Ouvrez **Réglages → Services et tarifs**. Utilisez **Rechercher des services** ou **+ Afficher les services d’autres métiers** pour trouver le type.",
            "Cochez sa case.",
            "Ouvrez « Rate card » et tapez vos tarifs par-dessus les valeurs par défaut. Chaque métier est livré avec les valeurs par défaut de FieldQuo pour qu'une nouvelle entreprise puisse soumissionner dès le premier jour ; un tarif que vous tapez l'emporte ensuite sur la valeur par défaut.",
            "Ouvrez **Ce que dit la soumission** si vous voulez votre propre libellé pour ce qu'est le service, ce qui est inclus et comment le chantier se déroule.",
            "Appuyez sur **Enregistrer les paramètres**. La tuile apparaît dans **Nouvelle soumission** et le service sur votre formulaire public de soumission.",
          ] },
          { note: "Changer un tarif ne change que les soumissions futures. Une soumission enregistrée garde les prix avec lesquels elle a été rédigée — ses lignes ont été figées à l'enregistrement pour que la copie d'un client ne se rechiffre jamais sous lui." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Types de soumission personnalisés",
        blocks: [
          { p: "Pour un travail qu'aucun type intégré ne décrit, **Ajouter un type de soumission personnalisé** crée le vôtre. Il dit : **Donnez-lui un nom, puis choisissez les champs qu'il doit demander sur une soumission — parmi les champs déjà utilisés dans les autres types de soumission de FieldQuo, pour qu'il fonctionne de la même façon dans le générateur de soumissions dès le départ.**" },
          { steps: [
            "Appuyez sur **Ajouter un type de soumission personnalisé** et tapez un nom, par exemple **Organisation de garde-robe**.",
            "Cochez les champs qu'il doit demander — cherchez dans la bibliothèque avec **Rechercher des champs…** — ou n'en cochez aucun : **Ne sélectionner aucun champ convient aussi — il se comportera comme un article à tarif forfaitaire, sans formulaire supplémentaire.**",
            "Appuyez sur **Créer le type de soumission**. Il apparaît dans la liste avec un badge **Personnalisé**, une case **Tarif** et une unité.",
            "Cochez-le et appuyez sur **Enregistrer les paramètres**.",
          ] },
          { tip: "Un type personnalisé peut porter son propre libellé **Ce que dit la soumission** et ses propres articles de catalogue, exactement comme un type intégré." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "Ce que dit la soumission",
        blocks: [
          { p: "Sous chaque type activé, **Ce que dit la soumission** contient les trois paragraphes que le client lit sur ce métier, dans la langue de la soumission :" },
          { bullets: [
            "**Ce qu’est ce service** — un paragraphe décrivant la portée.",
            "**Ce qui est inclus** — une liste de lignes, avec un bouton pour ajouter et un pour retirer une ligne.",
            "**Comment le chantier se déroule** — des étapes nommées avec un échéancier et une phrase chacune, avec un bouton pour ajouter et un pour retirer une étape.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne est montrée aux membres qui ont le commutateur **See prices** — **Estimator** et plus. Enregistrer les paramètres et créer un type personnalisé sont réservés au propriétaire et aux administrateurs ; toute autre personne reçoit « Only owners/admins can change settings » du serveur." },
          { warning: "Désactiver un type le retire du générateur et de votre formulaire public de soumission d'un coup. Les soumissions déjà rédigées avec ce type ne sont pas touchées." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je remplir toute la grille tarifaire ?", a: "Non. Chaque champ a une valeur par défaut, et seuls ceux que vous remplacez changent. La pastille customised vous dit quelles grilles portent vos propres chiffres." },
      { q: "Un client peut-il voir mes tarifs ?", a: "Jamais. Le formulaire public ne renvoie que les services et les questions ; le relevé, la formule et la grille tarifaire ne sont envoyés à aucune page destinée au client." },
      { q: "Quelle est la différence entre la grille tarifaire et Produits et services ?", a: "La grille tarifaire chiffre la portée principale d'un métier — par porte, par carré, par pied — et écrit les lignes de base. Produits et services contient les extras ponctuels que vous déposez sur n'importe quelle soumission. Voir [[lines-from-your-price-book|Des lignes tirées de votre catalogue de prix]]." },
      { q: "Pourquoi mon métier n'a-t-il pas de grille tarifaire ?", a: "Seuls seize métiers sont livrés avec une grille complète. Les autres prennent ici un seul Tarif par unité et chiffrent leurs lignes à la main ou depuis le catalogue de prix." },
    ],
  },

  "lines-from-your-price-book": {
    title: "Des lignes tirées de votre catalogue de prix",
    summary:
      "Réglages → Produits et services : les articles que vous pouvez déposer sur n'importe quelle soumission avec leur prix déjà en place, comment les ajouter et les importer, et comment ils apparaissent dans le générateur.",
    updated: "2026-09-12",
    intro: [
      "**Produits et services** est votre catalogue de prix : les extras et les articles ponctuels — poignées, charnières, frais d'urgence, frais de disposition — que vous déposez sur une soumission d'un seul geste, avec le prix que vous avez fixé. Une ligne prise ici est chiffrée par vous, de sorte que le montant que le propriétaire voit est celui que vous avez décidé.",
      "Il est distinct de la grille tarifaire de **Réglages → Services et tarifs**, qui chiffre la portée principale d'un métier. Les deux répondent à des questions différentes : un tarif dit ce que coûte une unité de travail ; un produit dit ce qui s'est ajouté au chantier.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "L'écran dit **Produits et services — Ajoutez et mettez à jour vos produits et services pour rester organisé lors de la création de soumissions, de modèles de soumission, de chantiers et de factures.** Un tableau avec **Name**, **Description** et **Type**, une recherche, **Ajouter un article**, modifier et supprimer sur chaque ligne, et deux cartes pour l'import et l'export CSV." },
          { p: "Un article peut être limité à certains types de soumission. Dans le générateur, le menu « + Add from Products & Services… » d'une carte de service ne liste que les articles liés à ce type — un groupe de planchers n'offre pas de quincaillerie d'armoires — ou tous les articles, si l'article n'a été lié à rien." },
        ],
      },
      {
        id: "rate-card-vs-price-book",
        heading: "Grille tarifaire ou catalogue de prix ?",
        blocks: [
          { table: {
            head: ["Question", "Grille tarifaire (Services et tarifs)", "Catalogue de prix (Produits et services)"],
            rows: [
              ["Ce qu'il chiffre", "La portée principale : par porte, par carré, par pied linéaire. Bâtit les lignes de base de la soumission à partir du relevé.", "Les extras et les articles ponctuels, chiffrés un à un. Ajoutés à une soumission à la main."],
              ["Où il apparaît", "Dans le formulaire du métier, sur la soumission.", "Dans le menu « + Add from Products & Services… » sous les lignes d'un service."],
            ],
          } },
          { p: "Plusieurs métiers sont livrés avec un jeu standard d'extras. **Ajouter des articles standards aux Produits et services**, sur la carte du type dans Services et tarifs, les crée ici d'un seul geste, déjà liés à ce type ; la même option peut être liée à plus d'un métier." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas :" },
          { bullets: [
            "La recherche et **Ajouter un article**.",
            "Le tableau — **Name**, **Description**, **Type** (**Service** ou **Produit**) — avec **Modifier l'article** et la suppression sur chaque ligne, paginé quand la liste est longue.",
            "**Coûts** — **Notez ce que vos produits et services vous coûtent — indiquez un prix de revient à côté du prix de vente lorsque vous ajoutez ou modifiez un article ci-dessus. Il est conservé sur l'article et inclus dans l'export CSV; aucune soumission, aucun calcul de coûts de chantier ni aucune marge ne le lit pour l'instant.**",
            "**Importer des produits et services** — **Importer un CSV** et **Télécharger un fichier exemple**. Colonnes : **name, description, type, unitPrice, costPrice, unit**.",
            "**Exporter des produits et services** — **Exporter un CSV** télécharge toute la liste.",
          ] },
          { figure: "live:app-settings-products", caption: "Réglages → Produits et services — le tableau, la carte Coûts, et les cartes d'import et d'export." },
        ],
      },
      {
        id: "add-an-item",
        heading: "Comment ajouter un article",
        blocks: [
          { steps: [
            "Ouvrez **Réglages → Produits et services** et appuyez sur **Ajouter un article**.",
            "Tapez le nom et, si le client doit en lire davantage, une **Description**.",
            "Choisissez **Service** ou **Produit**, et l'unité — **Unité (p. ex. pi²)**.",
            "Saisissez le **Prix unitaire**. Le **Prix de revient** est facultatif et, pour l'instant, purement informatif.",
            "Sous **Disponible sur ces types de soumission**, cochez les types auxquels cet article appartient, ou n'en cochez aucun : **Ne cochez rien pour rendre ceci disponible sur tous les types de soumission.**",
            "Appuyez sur **Ajouter un article**. Il est aussitôt prêt dans le générateur.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Produits et services — ce qui s'ouvre quand vous appuyez sur Ajouter un article : nom, description, type et unité, prix unitaire et prix de revient, et les types de soumission où il est disponible." },
          { note: "Supprimer un article demande d'abord : **Supprimer … ? Son prix et sa description sont retirés définitivement — les soumissions déjà rédigées conservent les montants avec lesquels elles ont été établies.**" },
        ],
      },
      {
        id: "use-it-on-a-quote",
        heading: "Comment l'utiliser sur une soumission",
        blocks: [
          { steps: [
            "Dans le générateur, ajoutez le service et ouvrez ses lignes.",
            "Sous les lignes, ouvrez « + Add from Products & Services… ». Chaque article affiche son nom et son prix.",
            "Choisissez-en un. Une ligne apparaît avec le nom de l'article, sa description en détail, une quantité de 1 et son prix unitaire.",
            "Changez la quantité ou le tarif sur cette soumission si le chantier l'exige. L'article du catalogue reste inchangé.",
          ] },
          { p: "Une ligne venue du catalogue est une ligne ordinaire une fois sur la soumission : le client voit une description et un montant, comme pour une ligne que vous avez tapée." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Import et export",
        blocks: [
          { p: "**Importer un CSV** prend un fichier exporté d'Excel, de Google Sheets ou de Numbers avec les colonnes **name, description, type, unitPrice, costPrice, unit** ; **Télécharger un fichier exemple** vous donne le format. **Exporter un CSV** réécrit toute la liste dans le même format, pour que vous puissiez modifier dans un tableur et réimporter." },
          { bullets: [
            "Le résultat dit **… articles importés.** Les articles importés ne sont liés à aucun type de soumission — disponibles partout — jusqu'à ce que vous les modifiiez.",
            "Une ligne sans nom est ignorée ; un type autre que **product** est enregistré comme **Service**. Un article ajouté à la main avec **Ajouter un article** voit aussi sa description rédigée dans les autres langues d'envoi de votre entreprise ; un article importé, non.",
            "L'importateur est simple : un nom contenant une virgule doit être entre guillemets, comme l'export l'écrit.",
          ] },
          { warning: "Importer ne remplace ni ne dédoublonne. Importer deux fois le même fichier vous donne chaque article en double." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne et la liste sont montrées aux membres qui ont le commutateur **See prices** — **Estimator** et plus ; un catalogue de prix, ce sont des prix, donc **Crew** est refusé plutôt que de recevoir une version caviardée. Ajouter, modifier, supprimer et importer des articles sont réservés au propriétaire et aux administrateurs : toute autre personne reçoit « Only an owner or admin can change the price book. »" },
        ],
      },
    ],
    faq: [
      { q: "Le prix de revient alimente-t-il la marge d'une soumission ?", a: "Pas encore. L'écran le dit : il est conservé sur l'article et exporté, et aucune soumission, aucun calcul de coûts de chantier ni aucune marge ne le lit. Le coût et la marge d'une soumission se calculent à partir des recettes de matériaux et de la main-d'œuvre dans Réglages → Coûts des matériaux." },
      { q: "Pourquoi mon article manque-t-il dans le menu d'une soumission ?", a: "Il est lié à d'autres types de soumission. Modifiez l'article et cochez le type que vous chiffrez, ou décochez tout pour le rendre disponible sur tous les types." },
      { q: "Le client peut-il voir le catalogue de prix ?", a: "Non. Seule la ligne que vous ajoutez — sa description et son montant — atteint la page, le courriel et le PDF du client." },
      { q: "Quelle est la différence entre un Service et un Produit ?", a: "Une étiquette sur l'article, affichée dans la colonne Type et conservée dans l'export. Les deux se chiffrent de la même façon sur une soumission." },
    ],
  },

  "group-a-quote-by-room-or-scope": {
    title: "Regrouper une soumission par pièce ou par portée",
    summary:
      "Comment une soumission s'organise en groupes de portée — un par service ou par section — et comment le relevé de peinture découpe un chantier par zone, pour que le client la lise comme il y pense.",
    updated: "2026-09-12",
    intro: [
      "Un propriétaire ne pense pas en lignes ; il pense en pièces et en travaux. Une soumission FieldQuo se bâtit de la même façon : un **groupe de portée** par service ou par section — **Peinture intérieure**, **Planchers**, **Drainage** — chacun avec ses lignes, son sous-total et la couleur du métier, et, dans un groupe de peinture, une zone par pièce avec les surfaces dessous.",
      "La copie du client — la page d'approbation, le courriel et le PDF — dessine les mêmes groupes dans le même ordre, de sorte que ce que vous avez chiffré est ce qu'il lit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "Chaque tuile de service que vous touchez dans **Nouvelle soumission** ajoute un groupe de portée. Une soumission pour la cuisine et le couloir fait deux groupes si ce sont deux métiers, et un seul groupe de peinture avec deux zones si les deux sont de la peinture. Le choix vous appartient ; le générateur garde un sous-total sur chaque carte dans les deux cas." },
          { p: "Il n'y a pas de champ « pièce » en texte libre sur un groupe : un groupe porte le nom de son service ou de la section choisie. Le détail pièce par pièce vit à l'intérieur du relevé de peinture, où chaque zone est nommée par vous." },
        ],
      },
      {
        id: "scope-groups",
        heading: "Les groupes de portée",
        blocks: [
          { p: "Chaque groupe est une carte :" },
          { bullets: [
            "Un numéro — **01**, **02** — affiché quand la soumission a plus d'un groupe, et la couleur d'accent du métier sur le bord gauche. La même couleur atteint la copie du client, pour que le générateur et le document se ressemblent visiblement.",
            "Le nom du groupe et un sous-total courant, affiché dès qu'il dépasse zéro.",
            "Le formulaire propre au métier — un relevé, une grille d'unités, un menu de forfaits ou une série de questions — puis les lignes.",
            "Un bouton de retrait. Un groupe importé de la soumission d'un sous-traitant, et chaque groupe d'une soumission que le client a déjà tranchée, ne peuvent pas être retirés.",
          ] },
          { tip: "Deux fois le même métier sur une soumission, c'est possible — touchez la tuile deux fois. Un groupe **Toiture** pour la maison et un autre pour le garage se lisent **01 Toiture** et **02 Toiture**, chacun avec son sous-total." },
        ],
      },
      {
        id: "sections-inside-a-trade",
        heading: "Les sections à l'intérieur d'un métier",
        blocks: [
          { p: "Certains métiers ont des sous-sections connues, et leur tuile ouvre une liste au lieu d'ajouter un groupe tout de suite — « Plumbing — pick a section » :" },
          { bullets: [
            "**Plumbing** offre **Groundworks**, **Drainage**, **Garage Drain**, **Waterlines**, **Tubs/Showers**, **Steamer**, **Recirc Lines**, **Gas**, **Finishing**, **Insulating** ; **HVAC Installation** offre **Inslab**, **Boiler Systems**, **Quick Track**, **Supply/Return Mains**, **Main Slab Heat**, **Upper Floor Slab Heat**, **Wiring**, **Venting**. Chacune devient un groupe portant le nom de la section.",
            "« Something else » ajoute un groupe simple portant le nom du métier, pour le cas que la liste ne couvre pas.",
          ] },
        ],
      },
      {
        id: "rooms-and-areas-in-painting",
        heading: "Pièces et zones en peinture",
        blocks: [
          { p: "Les relevés de peinture intérieure et extérieure s'organisent par **zone**. Chaque zone est une pièce ou une face de la maison, avec les surfaces à peindre listées dessous, et chaque surface devient une ligne que le client lit comme « Living room — Walls (414 sqft) »." },
          { steps: [
            "Ajoutez le service de peinture et appuyez sur **Ajouter une zone**. Nommez-la (la case propose **Zone 1**), choisissez le **Type de zone** et si elle est **Intérieur** ou **Extérieur**, puis entrez les mesures de la pièce — longueur, largeur et hauteur du plafond — ou tapez une superficie mesurée.",
            "Appuyez sur **Ajouter une surface…** et choisissez ce que vous peignez dans cette pièce — murs, plafond, boiseries, portes. La quantité de chaque surface se lit sur la géométrie de la pièce, avec **Saisir plutôt une quantité** si vous l'avez mesurée vous-même, plus **Couches**, **Produit** et d'éventuelles **Heures de préparation**.",
            "Répétez par pièce. **Total de la zone**, **Heures-personnes**, **Main-d'œuvre**, **Matériaux** et **Peinture à acheter** se mettent à jour à mesure.",
            "Cochez **Optionnel — le client peut l'ajouter ou la retirer** sur une zone ou une surface pour la sortir du total et l'offrir au bas de la soumission, à accepter par le client — voir [[upsell-add-ons|Les extras que le client peut accepter]].",
          ] },
          { note: "Une **Note au client (sur la soumission)** sur une zone est imprimée pour le client ; une **Note à l'équipe (bon de travail seulement)** ne l'est jamais. La formule de tarif derrière chaque ligne est interne et ne quitte jamais le générateur." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Ce que voit le client",
        blocks: [
          { p: "Chaque surface destinée au client dessine les groupes de la même façon :" },
          { bullets: [
            "Un en-tête par groupe avec son nom et son sous-total, puis ses lignes avec une description et un montant — pas de tarifs, pas de formules, pas de relevé.",
            "Un groupe dont l'unique ligne ne fait que répéter le nom et le total du groupe — un coût de sous-traitance regroupé, par exemple — n'affiche que l'en-tête plutôt que de dire deux fois la même chose.",
            "Le libellé du métier venu de **Ce que dit la soumission** — ce qu'est le service, ce qui est inclus, comment le chantier se déroule — sous le groupe, dans la langue de la soumission.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je renommer un groupe ?", a: "Pas en tapant. Un groupe porte le nom de son service ou de la section choisie sur la tuile. Utilisez les zones du relevé de peinture pour les noms de pièces, ou la description d'une ligne pour une étiquette que le client doit lire." },
      { q: "Puis-je réordonner les groupes ?", a: "Non. Les groupes apparaissent dans l'ordre où vous les avez ajoutés, sur votre écran comme sur la copie du client." },
      { q: "Pourquoi la copie du client montre-t-elle moins de lignes que le générateur ?", a: "Seules les lignes chiffrées et incluses sont dessinées. Les zones et surfaces optionnelles sont offertes à part au bas de la soumission, et une ligne unique qui ne fait que répéter l'en-tête de son groupe est fondue dans l'en-tête." },
    ],
  },

  "photos-on-a-quote": {
    title: "Les photos sur une soumission",
    summary:
      "D'où viennent les photos, vidéos et plans PDF d'une soumission, comment ajouter les vôtres depuis la visite, les limites, et où elles apparaissent ou non.",
    updated: "2026-09-12",
    intro: [
      "Une soumission porte un jeu de médias — **Photos et vidéos du client** — qui vient de deux directions : ce que le propriétaire a joint à sa demande, et ce que vous ajoutez depuis la visite. Ils restent sur la soumission, sont repris sur la facture et sont lus par la révision IA. Ils sont pour votre côté du chantier : la copie du client n'imprime pas ces photos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu",
        blocks: [
          { p: "La carte du générateur s'intitule **Photos et vidéos du client**, avec **Ajouter des photos ou une vidéo** et l'indication **Des photos prises lors de la visite. Elles restent sur la soumission et sont reprises sur la facture.** Le même jeu est montré sur la page de la soumission dans le bureau, et sur la facture créée à partir de la soumission." },
        ],
      },
      {
        id: "where-photos-come-from",
        heading: "D'où viennent les photos",
        blocks: [
          { bullets: [
            "**La demande.** Les photos, la courte vidéo ou le plan PDF que le propriétaire a joints sur votre formulaire de soumission, le concepteur de cuisine, un entonnoir ou une estimation instantanée sont sur le prospect, et **Convertir en devis** les reprend sur la soumission.",
            "**Un brouillon d'appel.** Une soumission rédigée à partir d'un appel à la réceptionniste n'a aucun média tant que vous n'en ajoutez pas.",
            "**La visite.** Vous les ajoutez dans le générateur, sur une nouvelle soumission ou une soumission enregistrée.",
            "**La facture.** Une facture créée à partir de la soumission hérite du jeu ; une facture rédigée de zéro a son propre téléverseur.",
          ] },
        ],
      },
      {
        id: "add-photos-yourself",
        heading: "Comment ajouter des photos",
        blocks: [
          { steps: [
            "Ouvrez la soumission dans le générateur — **Nouvelle soumission**, ou **Modifier** sur une soumission enregistrée.",
            "Descendez jusqu'à **Photos et vidéos du client** et appuyez sur **Ajouter des photos ou une vidéo**.",
            "Choisissez des photos, une vidéo ou un PDF depuis votre téléphone ou votre ordinateur. Chaque fichier se téléverse aussitôt et apparaît en vignette ; la croix d'une vignette la retire.",
            "Enregistrez la soumission. Les médias sont conservés avec elle.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nouvelle soumission — la carte Photos et vidéos du client, avec Ajouter des photos ou une vidéo, se trouve entre les Notes et la barre des totaux." },
          { note: "Les téléversements vont directement de votre navigateur au stockage sécurisé ; la soumission garde un lien vers chaque fichier, pas le fichier lui-même. Une photo prise sur un iPhone dans son format natif est acceptée telle quelle." },
        ],
      },
      {
        id: "limits",
        heading: "Limites",
        blocks: [
          { table: {
            head: ["Type", "Fichier le plus gros", "Combien"],
            rows: [
              ["Photo (tout format d'image sauf SVG)", "15 Mo", "Jusqu'à 12 éléments dans le téléverseur du générateur ; la soumission en conserve jusqu'à 20"],
              ["Vidéo", "100 Mo", "Comptée dans les mêmes 12"],
              ["Plan PDF", "25 Mo", "Compté dans les mêmes 12"],
            ],
          } },
        ],
      },
      {
        id: "where-they-show-up",
        heading: "Où elles apparaissent",
        blocks: [
          { p: "Les médias d'une soumission se lisent de votre côté, pas de celui du client :" },
          { bullets: [
            "La page de la soumission dans le bureau et le générateur, en vignettes qui s'ouvrent en grand.",
            "La facture créée à partir de la soumission, sous le même titre.",
            "La révision IA lit les photos avec la soumission et peut vous dire ce qu'elles montrent que les lignes ont manqué ; la **lecture approfondie des photos**, payante, va plus loin. Voir [[ai-quote-review|La révision IA des soumissions]] et [[the-ai-deep-photo-read|La lecture approfondie des photos par l'IA]].",
            "Les vérifications de complétude de la révision signalent « No photos » sur une soumission sans image du chantier — facultatif, mais cela vous distingue de celui qui a soumissionné par téléphone.",
          ] },
          { warning: "La page d'approbation du client, le courriel de soumission et le PDF n'impriment pas ces photos. Les photos avant-après qu'un client doit voir sont une autre fonction — voir [[references-and-photos-in-the-quote-email|Références et photos avant-après dans le courriel de soumission]]." },
        ],
      },
    ],
    faq: [
      { q: "Le client voit-il les photos que j'ajoute ?", a: "Non. Elles restent sur la soumission pour votre équipe, la facture et la révision IA. La page, le courriel et le PDF du client ne les incluent pas." },
      { q: "Puis-je ajouter des photos à une soumission envoyée ?", a: "Oui — ouvrez-la avec Modifier, ajoutez-les sous Photos et vidéos du client et enregistrez. Ajouter des médias ne rechiffre ni ne renvoie la soumission." },
      { q: "Où vont les photos de chantier prises par l'équipe ?", a: "Sur le chantier, pas sur la soumission — voir [[job-photos-and-tags|Photos de chantier et étiquettes]]. Le jeu de la soumission concerne l'estimation ; celui du chantier concerne le travail." },
    ],
  },
};
