// content/help/fr/marketing-and-website-1.js
//
// Partie 1 de la catégorie « marketing-and-website » en français (voir le
// composeur, marketing-and-website.js). Slugs de cette partie
// (lib/help/tree.js) : the-website-builder, website-pages-and-blocks,
// your-website-address, the-site-by-fieldquo-footer, share-your-links,
// embed-booking-and-quote-forms, the-bio-link, funnels, build-a-funnel,
// marketing-campaigns.
//
// Même structure que l'anglais (sections, blocs, figures, listes, FAQ) ; les
// faits viennent du même code, les mots à l'écran du bloc `fr` de
// app/i18n/appMessages.js. Les puces de mise en page et de style, les
// questions de l'assistant du site et la barre de l'éditeur d'entonnoir
// s'affichent en anglais sur tous les écrans : l'article les cite tels quels.
export const ARTICLES = {
  "the-website-builder": {
    title: "Le créateur de site web",
    summary:
      "Décrivez l'allure que votre site doit avoir : FieldQuo le rédige à partir de ce que vous avez déjà saisi — puis Enregistrer, Publier, et modifier en tapant à nouveau.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Votre site web** crée un vrai site web pour votre entreprise, à sa propre adresse. Vous ne remplissez pas de formulaire : vous tapez une phrase sur l'allure et le ton voulus, et le créateur rédige les pages à partir de ce que FieldQuo sait déjà — votre nom, votre logo, votre couleur de marque, vos services, vos heures d'ouverture, vos coordonnées, vos photos de chantier et vos avis approuvés. Rien n'est public tant que vous n'appuyez pas sur **Publier**.",
      "Cet article couvre tout l'écran : la consigne du premier lancement, la conversation, les puces Mise en page et Style, Ajuster, les volets Aperçu et Sections, et ce que font Enregistrer, Publier et Mettre à jour.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "Le créateur est une conversation. À gauche, vous dites quoi changer (« plus audacieux », « mettez les avis en avant », « page plus courte ») ; à droite, vous voyez le site exactement comme un visiteur, parce que l'aperçu est la vraie page et non une image de celle-ci. L'assistant de rédaction n'écrit que des phrases. La liste des sections, les noms de services et les témoignages viennent de vos propres données et sont réinsérés après chaque reconstruction : le site ne peut donc jamais décrire un métier que vous n'offrez pas ni citer un avis que personne n'a laissé." },
          { p: "Si l'assistant de rédaction n'est pas joignable, le créateur produit quand même une page — rédigée simplement à partir de vos informations enregistrées — et le dit dans le fil. Vous obtenez des mots plus plats, jamais un site brisé." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Premier lancement** — une seule boîte sous **Que devrait dire votre site web ?**, quatre puces d'exemple à toucher pour la remplir, une flèche **Créer mon site**, et la ligne **Rien n'est public tant que vous ne l'avez pas publié.**",
            "**La barre** — votre adresse (**votrenom.fieldquo.com**), un badge **En ligne** une fois publié, **Ouvrir**, **Dépublier** (seulement quand le site est en ligne), **Enregistrer**, et **Publier** (qui devient **Mettre à jour** quand le site est en ligne).",
            "**Le fil** — ce que vous avez demandé et ce qui a été construit. Quand il manque quelque chose, l'assistant le dit avec une action à un toucher, affichée en anglais : **Add photos**, **Pair them up**, **Add a logo**, **Add a review**, **Set hours**, **Choose services**.",
            "Les puces **Mise en page** et **Style**, la boîte de consigne (**Rendez-le plus audacieux · mettez les avis en avant · page plus courte…**), et le volet **Ajuster** avec **Adresse web**, **Langues**, **Paires avant-après** et le code d'intégration des avis.",
            "**Aperçu | Sections** — le site en direct avec une bascule ordinateur / mobile et un bouton d'actualisation, ou les sections de la page d'accueil sous forme de champs texte à reformuler à la main.",
          ] },
        ],
      },
      {
        id: "build-your-first-site",
        heading: "Comment créer votre premier site",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Votre site web**, dans le groupe Côté client du menu des paramètres.",
            "Décrivez l'allure en une ou deux phrases — le ton, ce qu'il faut mettre en avant, si les gens doivent pouvoir réserver en ligne — ou touchez une puce d'exemple. Pas besoin de taper votre nom, votre téléphone ni vos services.",
            "Appuyez sur la flèche (**Créer mon site**). Le fil indique ce qui a été construit (« Site reconstruit : … sections ») et l'aperçu charge le brouillon enregistré.",
            "Répondez à ce que l'assistant demande : ajoutez des photos de chantier, jumelez des photos avant-après, ajoutez un logo dans Image de marque, approuvez un avis dans Avis. Chaque ajout rend possible une section qui avait été laissée de côté.",
            "Appuyez sur **Publier**. Le site est en ligne à votre adresse ; la barre affiche **En ligne**.",
          ] },
          { figure: "live:app-settings-website", caption: "Paramètres → Votre site web au premier lancement — une consigne, quatre puces d'exemple, et « Rien n'est public tant que vous ne l'avez pas publié. »" },
          { note: "Une construction lancée par une consigne consomme l'allocation IA mensuelle de votre forfait ; si elle est épuisée, le bouton le dit au lieu de construire. Choisir une puce **Mise en page** ou **Style** n'appelle aucun modèle et n'est jamais bloqué." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qui se passe"],
            rows: [
              ["Taper dans la boîte de consigne et envoyer", "Réécrit chaque titre et chaque paragraphe de chaque page selon votre demande. Les photos, les paires avant-après, le logo et les couleurs sont conservés. Le résultat est enregistré aussitôt, donc l'aperçu le montre toujours."],
              ["Une puce **Mise en page** — l'une des cinq formes de la page, dans les mots de l'écran (Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager)", "Réorganise le même site dans cette forme. Vos mots et vos photos sont conservés ; aucune IA n'est utilisée."],
              ["Une puce **Style** (Modern, Bold, Minimal, Classic, Warm, Editorial, et d'autres)", "Change la typographie, les espacements et la façon d'appliquer votre couleur de marque. Mots et photos sont conservés."],
              ["Le volet **Sections**", "Reformulez à la main n'importe quel titre ou paragraphe de la page d'accueil, choisissez la variante de mise en page d'une section, ajoutez ou retirez une photo, **Masquer** ou **Afficher** une section. Votre logo, vos couleurs, vos services, vos heures et vos coordonnées ne se modifient pas ici — changez-les dans les paramètres de l'entreprise et le site se met à jour."],
              ["**Enregistrer**", "Enregistre le brouillon. Une fois le site en ligne, il n'y a pas de brouillon séparé : un changement enregistré est ce que les visiteurs voient."],
              ["**Publier** / **Mettre à jour**", "Rend le site public à votre adresse, ou le reconfirme. Exige une entreprise qui a terminé son inscription à un forfait."],
              ["**Dépublier**", "Met le site hors ligne après une boîte de dialogue — **Mettre votre site hors ligne ?** — qui dit ce qui se passe : les visiteurs voient tout de suite une page « non publié », Google retire le site de ses résultats dans les jours qui suivent, et chaque section, photo et langue est conservée. **Publier** remet le même site en ligne."],
              ["**Langues** (sous Ajuster)", "Ajouter une langue rédige tout le site dans cette langue — ce n'est pas une traduction automatique — et donne aux visiteurs un sélecteur dans l'en-tête. Votre langue principale est indiquée et ne peut pas être retirée."],
            ],
          } },
          { figure: "harness:settings-website", caption: "Le créateur avec un site en ligne — la barre d'adresse avec En ligne, Ouvrir, Enregistrer et Mettre à jour ; le fil ; les puces Mise en page et Style ; la consigne ; Aperçu et Sections à droite." },
          { warning: "Si vous avez reformulé des sections à la main puis tapez une nouvelle consigne, le créateur s'arrête et demande : **Ceci réécrira les mots que vous avez modifiés**. Choisissez **Garder ce que j'ai écrit** ou **Reconstruire quand même**. Les photos et les paires survivent dans les deux cas ; les titres et paragraphes tapés, non." },
        ],
      },
      {
        id: "publishing",
        heading: "Publier, les photos d'archive et retirer le site",
        blocks: [
          { p: "Tant que vous n'avez pas de photos, le créateur utilise des photos d'archive pour que la page ne soit pas vide — seulement en arrière-plan de l'en-tête et à des endroits semblables, jamais dans **Our work**, parce que cette section affirme que les photos sont des chantiers que vous avez faits. Publier avec des photos d'archive encore sur la page est permis, mais jamais en silence : une boîte de dialogue les compte et propose **Ajouter mes photos** ou **Publier quand même**." },
          { p: "Pour retirer un site en ligne, appuyez sur **Dépublier** dans la barre et confirmez **Le mettre hors ligne**. Rien n'est supprimé : le fil dit **Votre site est hors ligne. Rien n'a été supprimé — republiez-le quand vous voulez.**, le badge **En ligne** disparaît, et l'adresse répond avec une page « non publié » jusqu'à ce que vous appuyiez de nouveau sur **Publier**. Annuler votre abonnement vous demande de dépublier d'abord ; c'est ce bouton-là." },
        ],
      },
      {
        id: "what-is-different",
        heading: "Ce que ce créateur fait qu'un gabarit de site ne fait pas",
        blocks: [
          { bullets: [
            "Il est rédigé à partir de ce que vous avez déjà dit à FieldQuo — services, heures, avis, photos de chantier — et reste en phase avec eux : changez votre numéro de téléphone dans **Profil de l'entreprise** et le site change.",
            "Le calendrier de rendez-vous, le formulaire de demande de soumission et l'estimation instantanée sont des sections du site, pas des liens vers un autre produit. Un visiteur réserve une vraie plage selon vos disponibilités et la demande arrive sur votre tableau **Prospects**.",
            "Les mises en page forment un ensemble fermé, conçu et vérifié sur un téléphone. L'assistant choisit parmi elles ; il n'émet jamais de règle de style, donc une reconstruction ne peut pas produire une page brisée sur mobile ou illisible sur votre couleur de marque.",
            "Il est inclus dans chaque forfait, et le site d'une entreprise qui paie ne porte le nom de FieldQuo nulle part — voir [[the-site-by-fieldquo-footer|Le pied de page « Site par FieldQuo »]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'écran, ses enregistrements, Publier, Dépublier, les langues et les photos sont réservés aux propriétaires et aux administrateurs — une seule règle pour tout le site, parce qu'une page publiée est le visage public de l'entreprise. Tous les autres, répartiteurs et gestionnaires compris, ne voient pas la ligne, et la page les refuse. Publier exige aussi une entreprise qui a terminé son paiement — un essai qui n'a jamais ajouté de carte peut construire le site, mais pas le mettre devant le public." },
        ],
      },
    ],
    faq: [
      { q: "Une reconstruction va-t-elle supprimer mes photos ?", a: "Non. Une reconstruction ne réécrit que les mots ; les photos de chantier, les paires avant-après, votre logo et vos couleurs sont conservés à chaque fois. Seul le texte tapé à la main dans le volet Sections est remplacé, et le créateur demande d'abord." },
      { q: "Puis-je modifier le site sans l'IA ?", a: "Oui. Les puces Mise en page et Style et le volet Sections n'utilisent aucun modèle, et ils fonctionnent même quand l'assistant de rédaction est indisponible ou que votre allocation mensuelle est épuisée." },
      { q: "L'aperçu montre-t-il ce que les visiteurs voient ?", a: "Exactement cela — l'aperçu est la vraie page, rendue avec un indicateur d'aperçu que seul un membre connecté de votre entreprise peut utiliser. Un inconnu qui devine l'adresse d'un site non publié obtient une page introuvable." },
      { q: "Le site est-il traduit automatiquement ?", a: "Non. Ajouter une langue sous Ajuster rédige une version complète du site dans cette langue et ajoute un sélecteur ; rien n'est traduit par machine au moment de l'affichage. Huit langues sont offertes : anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien." },
    ],
  },

  "website-pages-and-blocks": {
    title: "Pages et sections du site web",
    summary:
      "Les pages qu'un site FieldQuo peut avoir, les quinze sortes de sections qui les composent, celles que vous pouvez reformuler à la main et celles tirées de la fiche de votre entreprise.",
    updated: "2026-09-12",
    intro: [
      "Un site FieldQuo est une liste de pages, et chaque page est une liste de sections (blocs). Le créateur décide, d'après vos données, quelles pages et quelles sections votre site reçoit ; vous pouvez reformuler à la main les sections de la page d'accueil, masquer celles dont vous ne voulez pas et choisir une autre disposition pour chacune. Cet article nomme chaque page et chaque bloc pour que vous sachiez ce qui est possible avant de le demander.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "Chaque site produit par le créateur actuel a plusieurs pages : une page **Home** plus les pages que le catalogue permet, chacune avec ses sections et sa place dans le menu d'en-tête. Une section est soit **rédigée** (un titre et un paragraphe écrits par l'assistant, que vous pouvez modifier), soit **dérivée** (rendue à partir de la fiche de votre entreprise — le calendrier de rendez-vous, le formulaire de soumission, les heures d'ouverture, les secteurs desservis — et non modifiable comme du texte). Une section pour laquelle le site n'a aucune donnée est laissée de côté plutôt que remplie artificiellement : un titre de galerie sans photos, ou une bande de témoignages sans avis approuvé, n'est jamais publié." },
        ],
      },
      {
        id: "the-pages",
        heading: "Les pages",
        blocks: [
          { table: {
            head: ["Page", "Dans le menu", "Sections par défaut"],
            rows: [
              ["Home", "Home", "Header, What we do, Before & after, Call to action band, Get in touch — l'en-tête, ce que nous faisons, l'avant-après, la bande d'appel à l'action et les coordonnées"],
              ["Services", "Services", "Header, What we do, How it works, FAQ, Call to action band — l'en-tête, ce que nous faisons, la démarche, la FAQ et la bande d'appel à l'action"],
              ["Work", "Our Work", "Header, Our work, Before & after, What clients say, Call to action band — l'en-tête, nos réalisations, l'avant-après, les témoignages et la bande d'appel à l'action"],
              ["About", "About", "Header, About us, Credentials & numbers, Areas we serve, Call to action band — l'en-tête, à propos de nous, les accréditations et chiffres, les secteurs desservis et la bande d'appel à l'action"],
              ["Book", "Book", "Header, Book a visit (calendar), Opening hours — l'en-tête, le calendrier de rendez-vous et les heures d'ouverture"],
              ["Quote", "Get a quote", "Header, Request a quote (form) — l'en-tête et le formulaire de demande de soumission"],
              ["Contact", "Contact", "Header, Get in touch, Opening hours, Areas we serve — l'en-tête, les coordonnées, les heures d'ouverture et les secteurs desservis"],
            ],
          } },
          { p: "Home est toujours en premier et toujours dans le menu. Une page dont les sections n'ont rien à montrer — une FAQ sans questions, une galerie sans photos — sort du menu d'elle-même. Le volet d'aperçu affiche un onglet par page pour vérifier chacune avant de publier. Les noms de pages et de sections du catalogue apparaissent en anglais dans l'éditeur ; le site publié, lui, est dans la langue de votre entreprise." },
        ],
      },
      {
        id: "the-sections",
        heading: "Les quinze sortes de sections",
        blocks: [
          { table: {
            head: ["Section", "Ce que vous pouvez modifier", "D'où vient le reste"],
            rows: [
              ["Header", "Titre, sous-titre, libellé du bouton ; sept variantes de disposition", "Toujours en premier ; ne peut pas être masquée"],
              ["What we do", "Titre, introduction", "Vos services activés"],
              ["About us", "Titre, texte", "—"],
              ["Our work", "Titre, introduction ; ajouter ou retirer des photos", "Les photos de chantier récentes"],
              ["What clients say", "Titre", "Les témoignages approuvés dans Paramètres → Avis"],
              ["FAQ", "Titre ; les questions et réponses", "—"],
              ["Request a quote (form)", "Titre, introduction", "Le formulaire d'auto-soumission pour vos services activés"],
              ["Book a visit (calendar)", "Titre, introduction", "Votre page de rendez-vous et vos vraies disponibilités"],
              ["Opening hours", "Titre, note", "Les heures d'ouverture de l'entreprise"],
              ["Get in touch", "Titre, introduction", "Téléphone, courriel et adresse du Profil de l'entreprise"],
              ["Before & after", "Titre, introduction ; les paires", "Les paires confirmées sous Ajuster"],
              ["How it works", "Titre, introduction ; les étapes", "—"],
              ["Areas we serve", "Titre, introduction", "Vos zones de travail"],
              ["Credentials & numbers", "Titre, introduction ; les éléments", "—"],
              ["Call to action band", "Titre, sous-titre, libellé du bouton", "—"],
            ],
          } },
        ],
      },
      {
        id: "edit-a-section",
        heading: "Comment reformuler ou masquer une section",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Votre site web** et passez le volet de droite de **Aperçu** à **Sections**.",
            "Repérez la section par son nom (ceux du tableau ci-dessus) et tapez dans ses champs. Titres, paragraphes et éléments de liste sont du texte brut ; les puces sous le nom changent la variante.",
            "Appuyez sur **Masquer** pour une section dont vous ne voulez pas ; **Afficher** la ramène. L'en-tête ne peut pas être masqué.",
            "Appuyez sur **Enregistrer**. L'aperçu se recharge avec vos mots.",
          ] },
          { figure: "harness:settings-website", caption: "Le créateur — la bascule Aperçu | Sections en haut du volet de droite ouvre l'éditeur de sections." },
          { note: "Le volet Sections modifie la page **Home**. Les autres pages sont réécrites par l'assistant quand vous tapez une consigne, et réorganisées quand vous choisissez une puce Mise en page." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Mises en page, styles et variantes",
        blocks: [
          { p: "Trois choses décident de l'allure d'une page, et toutes trois sont des ensembles fermés conçus et vérifiés sur un téléphone — l'assistant choisit parmi elles et n'écrit jamais sa propre règle de style." },
          { bullets: [
            "**Mise en page** — l'ordre et le choix des sections : Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager. Une mise en page qui exige une donnée que vous n'avez pas (un avis, une photo) est offerte une fois que vous l'avez.",
            "**Style** — typographie, espacements et traitement de la couleur : Modern, Bold, Minimal, Classic, Warm, Editorial, Technical, Couture, Gallery, Playful, Noir, Future, Monument. Chaque paire texte-fond est mesurée contre votre couleur de marque, jamais supposée.",
            "**Variante** — la disposition d'une seule section. L'en-tête à lui seul en a sept (centered, split, banner, overlay, side by side, minimal, editorial) ; une variante qui exige une photo n'est utilisée que s'il y en a une.",
          ] },
          { p: "Les libellés des puces et des variantes s'affichent en anglais sur l'écran de chaque langue." },
        ],
      },
      {
        id: "photos",
        heading: "Les photos",
        blocks: [
          { p: "Les photos de chantier arrivent sur le site par deux chemins : celles que votre équipe joint aux chantiers, et celles que vous téléversez depuis l'action **Add photos** du créateur. Sous **Ajuster → Paires avant-après**, vous jumelez une photo avant avec sa photo après ; seules les paires confirmées apparaissent dans la section Before & after. Les photos d'archive ne servent qu'en arrière-plan de l'en-tête et à des endroits semblables tant que vous n'avez pas de photos, jamais dans Our work." },
          { tip: "Une seule paire avant-après forte sur la page d'accueil fait plus qu'une galerie de douze photos. Demandez à l'assistant de « mettre nos photos avant-après en avant » une fois la paire confirmée." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je ajouter une page que le catalogue n'a pas ?", a: "Pas aujourd'hui. Les sept pages ci-dessus forment tout le catalogue ; une page qu'un entrepreneur ne peut pas remplir est pire que pas de page. Vous pouvez masquer des sections et renommer des titres librement à l'intérieur." },
      { q: "Pourquoi une section manque-t-elle après une reconstruction ?", a: "Parce qu'il n'y avait rien à y mettre. Le fil le dit (« Laissé de côté … — raison »). Ajoutez la donnée — un avis, une photo, des heures d'ouverture — et reconstruisez, ou choisissez une mise en page qui n'en a pas besoin." },
      { q: "Puis-je changer les services ou les heures affichés sur le site ?", a: "Pas dans le créateur — ils sont lus en direct depuis Paramètres → Services et tarifs et le Profil de l'entreprise. Changez-les là et le site suit." },
    ],
  },

  "your-website-address": {
    title: "L'adresse de votre site web : sous-domaine et domaine personnalisé",
    summary:
      "Comment l'adresse de votre site FieldQuo est choisie, les règles qu'un nom doit respecter, les noms réservés, et pourquoi un domaine personnalisé n'est pas encore pris en charge.",
    updated: "2026-09-12",
    intro: [
      "Votre site vit à un sous-domaine de fieldquo.com — **votrenom.fieldquo.com** — affiché dans la barre en haut du créateur et modifiable sous **Ajuster → Adresse web**. FieldQuo en suggère un d'après le nom de votre entreprise au premier enregistrement ; vous pouvez le changer à tout moment. Les domaines personnalisés (votre propre .com pointant vers le site) ne sont pas pris en charge aujourd'hui ; cet article le dit clairement pour que vous ne cherchiez pas le réglage.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "L'adresse est un seul mot : lettres minuscules, chiffres et traits d'union. C'est ce qu'un visiteur tape, et ce vers quoi pointe le lien de profil une fois le site publié. Le changement est immédiat : la nouvelle adresse répond dès l'enregistrement, et l'ancienne cesse — rien ne redirige une ancienne adresse vers une nouvelle." },
        ],
      },
      {
        id: "choose-or-change",
        heading: "Comment la choisir ou la changer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Votre site web** et appuyez sur **Ajuster** sous la boîte de consigne.",
            "Tapez le mot voulu sous **Adresse web**. Le suffixe est toujours fieldquo.com.",
            "Appuyez sur **Enregistrer**. Si le nom est pris, réservé ou mal formé, l'enregistrement est refusé avec une phrase qui nomme le problème — corrigez le mot et enregistrez de nouveau.",
          ] },
          { figure: "harness:settings-website", caption: "L'adresse dans la barre du haut du créateur ; le champ qui la change est sous Ajuster, sous la boîte de consigne." },
        ],
      },
      {
        id: "the-rules",
        heading: "Les règles qu'un nom doit respecter",
        blocks: [
          { bullets: [
            "Au moins **3** caractères et au plus **63** — la limite absolue d'une étiquette d'adresse web, pas un choix du produit.",
            "Lettres minuscules, chiffres et traits d'union simples seulement. Pas d'espaces, pas d'accents, pas de points.",
            "Il ne peut ni commencer ni finir par un trait d'union, ni contenir deux traits d'union de suite.",
            "Il ne doit pas déjà appartenir à une autre entreprise — l'enregistrement dit que l'adresse est déjà prise et d'en essayer une autre.",
            "Il ne doit pas figurer sur la liste des noms réservés ci-dessous.",
          ] },
        ],
      },
      {
        id: "reserved-names",
        heading: "Les noms réservés",
        blocks: [
          { p: "Certains noms sont refusés même s'ils semblent libres : **www**, **app**, **api**, **admin**, **platform**, **sales**, **help**, **book**, **quote**, **portal**, **refer**, **site**, **mail**, **support**, **docs**, **status**, **blog**, **shop**, **pay**, **billing**, **login**, **signup**, **account**, **dashboard**, **demo**, **fieldquo**, **official**, **security** et quelques dizaines d'autres du même genre." },
          { note: "C'est une frontière de sécurité, pas une préférence de nommage. Les témoins de connexion sont partagés entre tous les sous-domaines de fieldquo.com : une entreprise qui posséderait **app.fieldquo.com** pourrait lire les sessions des autres. La liste préfère refuser ; un refus vous coûte dix secondes et un autre mot." },
        ],
      },
      {
        id: "custom-domains",
        heading: "Les domaines personnalisés",
        blocks: [
          { p: "FieldQuo ne permet pas de faire pointer votre propre domaine vers votre site FieldQuo, et il n'y a aucun champ pour cela. « Sous-domaines seulement » est une décision de portée délibérée, pas un oubli. Si vous possédez déjà un domaine avec un site dessus, gardez ce site et placez-y les widgets de rendez-vous, de soumission et d'avis de FieldQuo — voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission sur n'importe quel site]] — ou mettez votre adresse FieldQuo sur votre lien de profil et votre fiche Google." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je avoir deux adresses pour un même site ?", a: "Non. Une entreprise a un seul sous-domaine ; le changer remplace l'ancien." },
      { q: "Google trouvera-t-il mon site ?", a: "Un site publié est indexable et porte le titre et la description rédigés par l'assistant. Un site non publié, les pages d'intégration et les entonnoirs sont marqués à ne pas indexer, volontairement." },
      { q: "Le nom de mon entreprise donne un mot réservé ou invalide — que faire ?", a: "FieldQuo s'est déjà rabattu sur une suggestion utilisable (souvent votre nom avec un suffixe comme -site). Tapez n'importe quel mot qui respecte les règles ; il n'a pas à correspondre à votre raison sociale." },
    ],
  },

  "the-site-by-fieldquo-footer": {
    title: "Le pied de page « Site par FieldQuo »",
    summary:
      "Le seul endroit où le nom de FieldQuo est permis sur une page côté client : une petite mention dans le pied de page du site web tant qu'une entreprise ne paie pas, et comment elle disparaît.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo est en marque blanche par défaut. Soumissions, factures, courriels, page de rendez-vous, entonnoirs et portail client portent votre nom, votre logo et votre couleur, jamais les nôtres. Le site web a une seule exception sanctionnée : tant que votre entreprise n'est pas sur un forfait payant, le pied de page de votre site porte une petite ligne — **Site par FieldQuo** — sous votre mention de droit d'auteur. Cet article dit exactement quand elle s'affiche et quand elle ne s'affiche pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "La mention est le prix d'un site web gratuit. C'est une ligne discrète dans le pied de page, à côté de **© année Votre entreprise**, qui renvoie vers fieldquo.com. Rien d'autre sur la page ne nomme FieldQuo — ni le titre, ni les formulaires, ni le calendrier de rendez-vous. Un entrepreneur qui paie obtient un pied de page avec son propre nom et son droit d'auteur, sans aucune trace du nôtre, pour qu'un propriétaire qui compare trois soumissions ne puisse pas deviner quels entrepreneurs partagent le même logiciel." },
        ],
      },
      {
        id: "when-it-shows",
        heading: "Quand elle s'affiche",
        blocks: [
          { table: {
            head: ["Votre situation", "Mention au pied de page"],
            rows: [
              ["Forfait payant, en règle", "Aucune mention"],
              ["Premier mois gratuit sur un forfait payant, carte au dossier", "Aucune mention — le mois que nous avons dit gratuit est gratuit"],
              ["Un paiement a échoué, à l'intérieur du délai de grâce", "Aucune mention — ces jours servent à corriger la carte, pas à remarquer votre site"],
              ["Délai de grâce expiré, ou abonnement annulé et terminé", "La mention s'affiche"],
              ["Aucun abonnement, ou un forfait à prix zéro", "La mention s'affiche"],
            ],
          } },
          { p: "La décision est prise à chaque affichage de page à partir de votre abonnement, donc elle change dès que votre situation change : payez, et la ligne disparaît au prochain chargement ; laissez tomber, et elle revient." },
        ],
      },
      {
        id: "where-else",
        heading: "Où le nom de FieldQuo apparaît ailleurs",
        blocks: [
          { p: "La page du lien de profil porte une petite ligne **Made by FieldQuo** à côté de son droit d'auteur, sur chaque forfait — une décision du propriétaire, parce qu'une page de lien en bio est un menu plutôt qu'un document, et que tout menu de ce genre porte le nom de son fabricant. Tout ce qui est au-dessus de ce pied de page est à vous seul. Aucune soumission, facture, courriel, page de rendez-vous, estimation instantanée, entonnoir ou portail client ne porte le nom de FieldQuo ; le titre d'onglet d'un widget intégré affiche le nom de votre entreprise." },
        ],
      },
      {
        id: "how-to-remove-it",
        heading: "Comment la retirer",
        blocks: [
          { steps: [
            "Ouvrez **Compte et facturation** (propriétaires et administrateurs) et choisissez un forfait — voir [[your-plan-and-seats|Votre forfait et vos sièges]].",
            "Terminez le paiement avec une carte. Dès ce moment, le site s'affiche sans la mention, y compris pendant le premier mois gratuit.",
            "Gardez la carte valide. Si un paiement échoue, vous avez le délai de grâce avant que la mention revienne — voir [[failed-payments-and-the-grace-period|Paiements échoués et délai de grâce]].",
          ] },
          { note: "L'annulation montre la même règle à l'envers : le parcours d'annulation vous dit que le site et la page de rendez-vous restent en ligne, et que la petite ligne revient au pied de page une fois le compte fermé." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je payer pour retirer la mention en gardant tout le reste gratuit ?", a: "Il n'y a pas de frais séparé pour cela. N'importe quel forfait payant retire la mention ; il n'existe pas de forfait gratuit avec une option payante « sans pied de page »." },
      { q: "La mention apparaît-elle sur mes soumissions ou mes factures ?", a: "Jamais. Elle n'existe que dans le pied de page du site web, et seulement tant que l'entreprise ne paie pas." },
    ],
  },

  "share-your-links": {
    title: "Partager vos liens",
    summary:
      "Un seul écran avec tous les liens publics de votre entreprise — Demander une soumission, Réserver une visite, Estimation instantanée et chaque entonnoir publié — chacun avec Copier le lien, Ouvrir et un code d'intégration.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Partager vos liens** répond à une seule question : qu'est-ce que je peux mettre sur ma page Facebook, ma fiche Google, ma signature de courriel ou le côté de la camionnette ? Il liste les liens qu'un inconnu peut utiliser pour devenir un prospect, chacun avec un bouton **Copier le lien**, un bouton **Ouvrir** pour l'essayer vous-même, et le code à coller dans un site web que vous avez déjà.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "La plupart des entrepreneurs n'ont pas de site web où coller du code — ils ont une page Facebook, une fiche Google et un téléphone. Le lien brut vient donc en premier sur chaque carte, et le code d'intégration en second. Chaque lien est public : pas de connexion, pas d'application, ça fonctionne sur un téléphone dans une entrée de garage. Tout ce qui arrive par ces liens atterrit sur votre tableau **Prospects** ou dans votre calendrier, avec votre image de marque sur la page que le client a vue." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Demander une soumission** — « Ils décrivent le travail et laissent leurs coordonnées. Cela arrive dans votre liste de prospects. Idéal pour ceux qui comparent encore les prix. »",
            "**Réserver une visite** — « Ils choisissent une heure selon vos réelles disponibilités. Idéal pour ceux qui ont déjà décidé et veulent simplement votre présence. »",
            "**Estimation instantanée** — la page adresse-en-entrée, prix-en-sortie ; chaque estimation arrive dans votre file de révision avant d'être contraignante. Les métiers et les tarifs se règlent dans **Paramètres → Soumissions instantanées**.",
            "**Concevez votre cuisine** — « Un propriétaire dessine lui-même sa cuisine — armoires, finis, tout — et vous l'envoie comme demande avec le plan joint. » Affichée seulement tant que **Kitchen Design & New Installs** est activé sous Services, et comme lien seulement : il n'y a pas de code à intégrer pour elle.",
            "**Une carte par entonnoir publié**, au nom que vous lui avez donné — « Un entonnoir de prospects à parcourir — partagez le lien dans une annonce ou placez-le sur votre site. » Les entonnoirs en brouillon ne sont pas listés, parce que leur lien ne fonctionnerait pas encore.",
            "Une ligne de clôture : le formulaire de soumission n'offre que les services activés dans Paramètres → Services, et n'affiche jamais vos prix.",
          ] },
        ],
      },
      {
        id: "copy-a-link",
        heading: "Comment copier un lien",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Partager vos liens**.",
            "Sur la carte voulue, appuyez sur **Copier le lien**. Le bouton affiche **Copié** pendant deux secondes.",
            "Collez-le là où les gens vous trouvent déjà. Appuyez d'abord sur **Ouvrir** si vous voulez voir ce qu'ils verront.",
            "Pour un site web que vous gérez déjà, appuyez plutôt sur **Copier** sous **Ou collez ceci dans votre propre site web**, et remettez le code à la personne qui modifie le site — voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission sur n'importe quel site]].",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Paramètres → Partager vos liens — les cartes Demander une soumission, Réserver une visite et Estimation instantanée, chacune avec le lien, Copier le lien, Ouvrir et son code d'intégration." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Où mène chaque lien",
        blocks: [
          { table: {
            head: ["Lien", "Ce que fait le client", "Où ça atterrit"],
            rows: [
              ["Demander une soumission", "Choisit un service, décrit le travail, ajoute des photos, laisse ses coordonnées", "Un prospect noté sur le tableau Prospects — voir [[the-self-quote-form|Le formulaire d'auto-soumission]]"],
              ["Réserver une visite", "Choisit un type de rendez-vous et une plage selon vos vraies disponibilités, paie des frais de visite si vous en exigez", "Un rendez-vous dans votre calendrier et un prospect — voir [[the-booking-page|La page de rendez-vous]]"],
              ["Estimation instantanée", "Saisit une adresse ou trace une zone, voit un prix de départ", "Révisions de devis, où vous confirmez le prix avant tout envoi — voir [[estimate-reviews|Révisions d'estimations]]"],
              ["Concevez votre cuisine", "Dessine sa cuisine sur un plan, choisit les finis, laisse ses coordonnées", "Une demande avec le plan joint et sans prix — c'est vous qui soumissionnez ; voir [[the-kitchen-designer|Le concepteur de cuisine]]"],
              ["Un entonnoir", "Parcourt un court questionnaire et laisse ses coordonnées", "Un prospect noté, marqué du canal de l'entonnoir — voir [[funnels|Les entonnoirs de prospects]]"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs, les répartiteurs et les gestionnaires voient la ligne et toutes les cartes. Les cartes d'entonnoir lisent la liste des entonnoirs, que les mêmes niveaux peuvent ouvrir ; quelqu'un en dessous verrait la phrase **Les entonnoirs de prospects sont gérés par un propriétaire ou un administrateur — demandez-leur le lien** à la place des cartes d'entonnoir, mais cette ligne de paramètres ne lui est pas montrée du tout." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon entonnoir n'est-il pas listé ?", a: "Seuls les entonnoirs publiés avec une adresse apparaissent. Ouvrez Entonnoirs dans la barre latérale, ouvrez l'entonnoir et appuyez sur Publier ; il lui faut d'abord une étape de coordonnées." },
      { q: "Ces liens montrent-ils mes prix ?", a: "Non. Le formulaire de soumission recueille assez de détails pour soumissionner avec précision sans publier un tarif. L'estimation instantanée montre un prix de départ seulement pour les métiers que vous avez activés, et seulement ce que vous avez choisi sous « Ce que le propriétaire voit »." },
      { q: "Y a-t-il un code QR ?", a: "Pas sur cet écran aujourd'hui. Copiez le lien et utilisez n'importe quel générateur de code QR ; le lien ne change pas." },
    ],
  },

  "embed-booking-and-quote-forms": {
    title: "Intégrer les formulaires de rendez-vous et de soumission sur n'importe quel site",
    summary:
      "Collez un seul extrait de code dans le site web que vous avez déjà pour y afficher votre calendrier de rendez-vous, votre formulaire de soumission, votre estimation instantanée, vos avis ou un entonnoir — sans marque FieldQuo, et la boîte ajuste sa hauteur elle-même.",
    updated: "2026-09-12",
    intro: [
      "Un entrepreneur établi ne jettera pas un site web qui se classe bien. Ce qu'il fera, c'est y coller une boîte pour que « réserver une visite » et « demander une soumission » cessent d'être un numéro de téléphone et deviennent une ligne dans le pipeline. FieldQuo fournit cette boîte sous forme d'extrait à copier depuis **Paramètres → Partager vos liens** (et, pour les avis, depuis **Paramètres → Avis** et le volet Ajuster du créateur de site).",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "Chaque extrait est un iframe qui pointe vers une page d'intégration, plus quelques lignes de script. La page d'intégration exécute le même parcours que la page publique — le même calendrier de rendez-vous, le même formulaire de soumission — sans habillage FieldQuo et avec le nom de votre entreprise dans l'onglet. Le script est la moitié qui rend le tout utilisable : la boîte signale sa propre hauteur, donc un visiteur qui termine une réservation voit la confirmation plutôt qu'un cadre coupé. Gardez le script avec l'iframe ; sans lui, la boîte fonctionne encore mais défile à l'intérieur d'une hauteur fixe." },
        ],
      },
      {
        id: "the-widgets",
        heading: "Les cinq widgets",
        blocks: [
          { table: {
            head: ["Widget", "Où se trouve l'extrait", "Hauteur de départ"],
            rows: [
              ["Réserver une visite", "Paramètres → Partager vos liens", "640 px"],
              ["Demander une soumission", "Paramètres → Partager vos liens", "640 px"],
              ["Estimation instantanée", "Paramètres → Partager vos liens", "560 px"],
              ["Avis de clients", "Paramètres → Avis, et Paramètres → Votre site web → Ajuster", "220 px — et il n'affiche rien du tout tant que vous n'avez pas d'avis approuvé"],
              ["Un entonnoir", "Paramètres → Partager vos liens (un par entonnoir publié), et la page de l'entonnoir", "520 px"],
            ],
          } },
          { p: "La hauteur de départ est ce que mesure la boîte avant que le script l'ait redimensionnée, et ce qui reste à un site dont l'éditeur retire les scripts — c'est pourquoi aucune n'est à zéro." },
        ],
      },
      {
        id: "paste-the-snippet",
        heading: "Comment coller un extrait",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Partager vos liens** et repérez la carte voulue.",
            "Sous **Ou collez ceci dans votre propre site web**, appuyez sur **Copier**.",
            "Dans l'éditeur de votre site, ajoutez un bloc HTML ou « code personnalisé » là où le formulaire doit apparaître, et collez. L'iframe et le script doivent tous deux se retrouver sur la page.",
            "Publiez votre site et ouvrez la page sur un téléphone. Faites une réservation ou une demande d'essai ; elle apparaît sur votre tableau Prospects ou dans votre calendrier comme n'importe quelle autre.",
          ] },
          { figure: "harness:settings-lead-form", caption: "Paramètres → Partager vos liens — le code d'intégration de chaque carte se trouve sous « Ou collez ceci dans votre propre site web », avec son propre bouton Copier." },
        ],
      },
      {
        id: "how-it-behaves",
        heading: "Comment se comporte la boîte intégrée",
        blocks: [
          { bullets: [
            "**Votre marque, pas la nôtre.** La page dans la boîte porte votre logo et votre couleur ; le titre de son onglet est le nom de votre entreprise ; rien ne dit FieldQuo.",
            "**Non indexée.** Les pages d'intégration sont marquées à ne pas indexer, pour que votre propre page garde le trafic de recherche au lieu de rivaliser avec une copie sans habillage d'elle-même.",
            "**Payer à l'intérieur d'un cadre.** Une réservation qui perçoit des frais de visite envoie le visiteur vers Stripe Checkout, qui refuse de se charger dans le cadre d'un autre site. FieldQuo déplace tout l'onglet vers le paiement et affiche aussi un lien que le visiteur peut toucher si le navigateur a bloqué le déplacement automatique.",
            "**Deux boîtes sur une même page**, c'est correct — deux entonnoirs, ou les avis à côté d'un formulaire de soumission. Chaque extrait ne redimensionne que sa propre boîte.",
            "**Les avis se réduisent à rien** quand rien n'est approuvé, donc l'extrait des avis peut être mis en place avant l'arrivée de votre premier avis.",
          ] },
          { note: "L'extrait contient l'adresse FieldQuo d'où il a été copié et le nom court de votre entreprise. Copiez-le frais depuis l'écran plutôt que de le retaper ; un extrait avec une faute dans l'adresse affiche une boîte vide, sans erreur." },
        ],
      },
    ],
    faq: [
      { q: "Ça fonctionne sur Wix, Squarespace, WordPress et les autres ?", a: "Partout où vous pouvez coller un bloc HTML. Certains créateurs hébergés retirent le script ; la boîte garde alors sa hauteur de départ et défile à l'intérieur, ce qui fonctionne quand même." },
      { q: "Puis-je intégrer tout le site FieldQuo ?", a: "Non, et vous n'en avez pas besoin — le site est une page à part entière à votre adresse. Les intégrations servent aux parties qui font un travail : réserver, soumissionner, estimer, avis, entonnoirs." },
      { q: "Une réservation intégrée respecte-t-elle mes disponibilités et mes frais ?", a: "Oui. C'est le même parcours de réservation que votre page de rendez-vous, qui lit les mêmes types de rendez-vous, le même tampon de déplacement, les mêmes fenêtres d'arrivée et les mêmes frais de visite." },
    ],
  },

  "the-bio-link": {
    title: "Le lien de profil",
    summary:
      "Une seule page à votre image pour le lien unique qu'Instagram et TikTok autorisent — construite à partir de ce que votre entreprise a déjà, ordonnée et activée ou désactivée par vous, avec un aperçu téléphone en direct.",
    updated: "2026-09-12",
    intro: [
      "Instagram et TikTok vous donnent un seul lien dans un profil. **Paramètres → Lien de profil** fait de ce lien une page avec votre logo, votre couleur, un titre, une ligne en dessous, une rangée d'icônes de réseaux sociaux et les boutons qui comptent : obtenir un prix, réserver une visite, appeler, écrire, voir le site web, laisser un avis. Seules les choses que vous avez réellement y apparaissent, et rien n'est un lien mort.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "La page est dérivée de la fiche de votre entreprise, pas tapée de zéro. Une ligne apparaît parce que la chose derrière existe : le formulaire de soumission est toujours là ; **Prendre rendez-vous** apparaît dès que vous avez un type de rendez-vous actif ; **Obtenir un prix instantané** dès qu'un estimateur instantané est activé ; **Concevez votre cuisine** dès que Kitchen Design & New Installs est activé sous Services ; chaque entonnoir publié comme bouton distinct ; votre site web dès qu'il est publié ou dès que vous avez saisi un domaine dans le Profil de l'entreprise ; le lien d'avis dès qu'il est réglé dans Avis ; votre téléphone et votre courriel depuis le Profil de l'entreprise. Une ligne que vous désactivez reste désactivée ; une ligne que personne n'a touchée est activée au premier chargement de la page — y compris un entonnoir que vous publiez le mois prochain." },
          { p: "La page suit d'elle-même le téléphone du visiteur entre clair et sombre ; la bascule clair / sombre de cet écran ne change que le cadre d'aperçu. Elle porte une petite ligne **Made by FieldQuo** tout en bas, sur chaque forfait — voir [[the-site-by-fieldquo-footer|Le pied de page « Site par FieldQuo »]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre lien** — l'adresse, **Copier le lien**, **Ouvrir**, et la case **La page est en ligne**. « Collez ceci dans votre bio Instagram ou TikTok. »",
            "**Titre** (« Laissez vide pour utiliser le nom de votre entreprise. ») et **Une ligne en dessous** (« Facultatif. Vide signifie que rien ne s'affiche — nous n'en rédigeons pas à votre place. »).",
            "**Suivez-nous** — Instagram, Facebook, TikTok, YouTube, LinkedIn et X ; tapez un identifiant ou collez le lien du profil, laissez vide pour masquer.",
            "**Ce qui figure sur la page** — chaque ligne avec une case **Afficher sur la page**, son **Texte du bouton**, une poignée à glisser, **Monter** / **Descendre**, et son groupe (Obtenir un prix, Rendez-vous, Contact, Plus). « Le premier est le grand bouton. »",
            "**Ajouter votre propre lien** — jusqu'à dix lignes que vous rédigez vous-même, chacune avec un texte, une adresse et une icône.",
            "**Pas encore disponible** — les lignes que vous ne pouvez pas encore avoir, et l'écran qui créerait chacune.",
            "**Aperçu** dans un cadre de téléphone, mis à jour au fur et à mesure, avec une bascule clair / sombre, et **Enregistrer** en bas.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Comment le configurer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Lien de profil**.",
            "Rédigez le **Titre** ou laissez le nom de votre entreprise, et **Une ligne en dessous** si vous en voulez une — rien n'est inventé à votre place.",
            "Sous **Suivez-nous**, tapez vos identifiants. Un champ qui ne ressemble ni à un identifiant ni à un lien de profil n'est pas enregistré, et l'écran le dit.",
            "Sous **Ce qui figure sur la page**, cochez les lignes voulues, renommez un bouton si le libellé par défaut n'est pas le vôtre, et glissez ou utilisez les flèches pour mettre la plus importante en premier — elle devient le grand bouton.",
            "Appuyez sur **Ajouter votre propre lien** pour tout le reste (une fiche Google, une galerie ailleurs). Vos liens personnalisés ont besoin d'un texte et d'une adresse.",
            "Appuyez sur **Enregistrer**, puis sur **Copier le lien**, et collez-le dans votre profil Instagram ou TikTok.",
          ] },
          { figure: "live:app-settings-links", caption: "Paramètres → Lien de profil — Votre lien, le titre et la ligne, Suivez-nous, Ce qui figure sur la page avec ses cases et ses flèches, et l'aperçu téléphone à droite." },
          { note: "Rien ici n'est enregistré tant que vous n'appuyez pas sur **Enregistrer**. Réordonner, renommer et désactiver est une modification en plusieurs étapes d'une seule page publique, et enregistrer chaque frappe mettrait des états à moitié finis devant quiconque touche le lien entre-temps." },
        ],
      },
      {
        id: "what-goes-on-the-page",
        heading: "Ce qui peut figurer sur la page",
        blocks: [
          { table: {
            head: ["Ligne", "Apparaît quand", "Activée par défaut"],
            rows: [
              ["Obtenir un prix instantané", "Un estimateur instantané est activé dans Paramètres → Soumissions instantanées", "Oui"],
              ["Devis gratuit (le formulaire de soumission)", "Toujours — chaque entreprise l'a", "Oui"],
              ["Concevez votre cuisine", "Kitchen Design & New Installs est activé sous Paramètres → Services", "Oui"],
              ["Prendre rendez-vous", "Au moins un type de rendez-vous actif dans Paramètres → Page de rendez-vous", "Oui"],
              ["Chaque entonnoir publié, par son nom", "L'entonnoir est publié", "Oui"],
              ["Voir notre site web", "Un domaine dans le Profil de l'entreprise, ou un site FieldQuo publié", "Oui"],
              ["Appeler", "Un numéro de téléphone dans le Profil de l'entreprise", "Oui"],
              ["Écrire sur WhatsApp", "Un numéro de téléphone dans le Profil de l'entreprise", "Non — avoir un numéro ne veut pas dire que WhatsApp y est"],
              ["Nous écrire", "Un courriel dans le Profil de l'entreprise", "Oui"],
              ["Laisser un avis", "Un lien d'avis dans Paramètres → Avis", "Oui"],
              ["Vos propres liens", "Vous les avez ajoutés", "Oui"],
            ],
          } },
          { p: "Le libellé des boutons vient de la langue de votre entreprise, pas de la langue dans laquelle vous lisez les paramètres — la page d'une entreprise anglophone dit **Get a free quote** et **Call**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { bullets: [
            "**La page est en ligne** — décochez et enregistrez, et l'adresse affiche une page introuvable jusqu'à ce que vous recochiez. La page est activée dès le départ.",
            "**Afficher sur la page** — masque ou affiche une ligne. Une ligne masquée garde sa place et son libellé pour quand vous la ramenez.",
            "**Texte du bouton** — remplace le libellé par défaut pour cette ligne seulement. Vide veut dire le libellé par défaut, jamais un bouton sans texte.",
            "**L'ordre** — la première ligne est le grand bouton ; les sections sont ordonnées selon la position de la première ligne de chaque groupe, donc mettre votre site web en premier place **Plus** en premier.",
            "**Clair / Sombre** — le cadre d'aperçu seulement. Les visiteurs obtiennent ce que leur téléphone demande.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs, les répartiteurs et les gestionnaires peuvent ouvrir et enregistrer cet écran. La page publique elle-même n'exige rien — ni compte, ni application." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi « Prendre rendez-vous » est-il grisé ?", a: "Vous n'avez aucun type de rendez-vous actif. La liste Pas encore disponible dit quel écran le crée — Paramètres → Page de rendez-vous." },
      { q: "Un lien peut-il pointer vers un numéro de téléphone ou WhatsApp ?", a: "Appeler et Écrire sur WhatsApp sont intégrés et lisent le numéro de téléphone de votre entreprise. WhatsApp reste désactivé tant que vous ne l'activez pas, parce qu'un lien wa.me vers un numéro qui n'est pas sur WhatsApp ouvre un clavardage avec personne." },
      { q: "Y a-t-il un code QR pour le lien ?", a: "Pas sur cet écran aujourd'hui. L'adresse est assez courte pour se dire à voix haute ; n'importe quel générateur de code QR en fera un carré pour la camionnette." },
    ],
  },

  funnels: {
    title: "Les entonnoirs de prospects",
    summary:
      "Des questionnaires conçus pour le mobile, à parcourir en quelques touchers, pour vos publicités et votre lien en bio : ils qualifient un visiteur et déposent un prospect noté sur votre tableau Prospects — avec un rapport d'abandon par étape.",
    updated: "2026-09-12",
    intro: [
      "Un entonnoir est une courte page d'atterrissage pour une publicité ou un dépliant : une question par écran, un toucher par réponse, et à la fin un formulaire de coordonnées — ou un prix avant le formulaire. **Entonnoirs** liste les vôtres avec leur statut, leur canal et leur nombre de prospects ; **Nouvel entonnoir** en démarre un à partir d'un modèle par canal ou d'une phrase que vous tapez à l'IA. Chaque parcours terminé devient un prospect sur votre tableau **Prospects**, noté chaud, tiède ou froid d'après les réponses, pour que la personne qui a touché « ce mois-ci » et « plus de 15 000 $ » soit en haut de la liste quand vous ouvrez l'application.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "Un formulaire statique pose huit questions d'un coup et perd le visiteur à la deuxième. Un entonnoir en pose une à la fois, le pouce du visiteur faisant le travail, et note jusqu'où chaque visiteur s'est rendu — « 60 % abandonnent à la question du budget » devient un chiffre que vous lisez plutôt qu'une supposition. La page publique porte votre logo et votre couleur de marque et rien de FieldQuo, et elle est marquée à ne pas indexer, parce que c'est une page d'atterrissage publicitaire et non votre site web." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Le titre **Entonnoirs** — « Des entonnoirs de vente conçus pour le mobile, à parcourir en quelques touches, pour vos publicités et votre lien en bio. Chacun qualifie les visiteurs et dépose une piste notée directement dans votre pipeline. » — et **Nouvel entonnoir**.",
            "Une ligne par entonnoir : son nom, **Publié** ou **Brouillon**, son canal (Web, Instagram, TikTok, YouTube), le nombre de pistes produites, la date de la dernière mise à jour, et une corbeille.",
            "Sans entonnoir : **Aucun entonnoir pour l'instant — Partez d'un modèle ou décrivez-le à l'IA — puis partagez le lien dans vos publicités.**",
          ] },
          { figure: "harness:funnels", caption: "Entonnoirs — un entonnoir Web publié avec 14 pistes et un brouillon Instagram, chacun avec son canal et sa dernière mise à jour." },
        ],
      },
      {
        id: "create-a-funnel",
        heading: "Comment créer un entonnoir",
        blocks: [
          { steps: [
            "Ouvrez **Entonnoirs** sous Croissance dans la barre latérale et appuyez sur **Nouvel entonnoir**.",
            "Soit tapez une phrase sous **Décrivez-le et laissez l'IA le construire** (« Un entonnoir TikTok pour la peinture extérieure qui qualifie le budget et fixe une estimation ») et appuyez sur **Générer**, soit choisissez un modèle : **Site web — obtenir une soumission**, **TikTok — questionnaire de 60 secondes**, **Instagram — estimation gratuite**, **YouTube — réservez votre visite**, chacun « questionnaire → qualification → coordonnées ». **ou partez d'un entonnoir vierge** est la troisième porte.",
            "L'éditeur s'ouvre avec les étapes à gauche, l'étape sélectionnée au centre et un aperçu téléphone à vos couleurs à droite — voir [[build-a-funnel|Construire un entonnoir et lire son rapport d'abandon]].",
            "Appuyez sur **Publier**. Le lien public et le code d'intégration apparaissent sur la page de l'entonnoir, et l'entonnoir est listé dans **Paramètres → Partager vos liens** et, une fois activé, sur votre lien de profil. **Dépublier** le ramène en brouillon ; le lien cesse de répondre, et les parcours et le rapport sont conservés.",
          ] },
          { figure: "create:app-funnels-create", caption: "Nouvel entonnoir — la boîte IA (« Décrivez-le et laissez l'IA le construire »), les quatre modèles par canal, et « ou partez d'un entonnoir vierge »." },
          { note: "L'IA n'écrit que les phrases de l'entonnoir — l'accroche, les questions, le texte des boutons — à partir de vos vrais services et du canal nommé. Elle n'invente jamais un service ni un prix, et les questions de notation gardent leurs valeurs de réponse fixes, donc un entonnoir généré note les pistes exactement comme un entonnoir construit à la main. Si l'IA n'est pas joignable, vous obtenez le modèle du canal avec des textes plus plats, jamais un entonnoir brisé. Générer consomme l'allocation IA mensuelle de votre forfait." },
        ],
      },
      {
        id: "the-lead-it-produces",
        heading: "La piste qu'il produit",
        blocks: [
          { p: "Quand un visiteur termine, FieldQuo crée une piste nommée d'après l'étape de coordonnées, avec son courriel ou son téléphone (l'un des deux est requis), la tranche de budget et l'échéancier tirés des questions que vous avez marquées pour les alimenter, chaque autre réponse comme ligne du message de la piste (« Quelles pièces ? : Cuisine, Deux salles de bain »), les photos téléversées, et une source **funnel** suivie du canal. Elle est notée de la même façon que toute autre piste — voir [[lead-scoring-hot-warm-cold|La notation des pistes : chaud, tiède, froid]] — et se trouve sur [[the-leads-board|le tableau Prospects]] avec les autres." },
        ],
      },
      {
        id: "what-is-different",
        heading: "Ce que les autres outils n'affichent pas",
        blocks: [
          { bullets: [
            "Aucun des cinq concurrents dont FieldQuo suit les pages de tarifs — Jobber, Housecall Pro, QuoteIQ, ServiceTitan et Projul — n'affiche d'entonnoirs de prospects à aucun palier. Ils affichent un formulaire de contact de site web ; un entonnoir est autre chose, avec un rapport d'abandon étape par étape.",
            "Un entonnoir peut chiffrer le chantier avant l'étape des coordonnées, à partir de vos tarifs d'estimation instantanée, pour que le visiteur donne ses coordonnées en connaissant déjà la fourchette — voir l'étape d'estimation instantanée dans [[build-a-funnel|Construire un entonnoir et lire son rapport d'abandon]].",
            "Il est inclus dans chaque forfait.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les propriétaires, les administrateurs, les répartiteurs et les gestionnaires voient la ligne **Entonnoirs** et peuvent créer, modifier, publier et supprimer. Les estimateurs et les équipes ne voient pas la ligne, et la liste les refuse. La page publique de l'entonnoir n'exige rien du visiteur, sinon un pouce." },
        ],
      },
    ],
    faq: [
      { q: "Qu'arrive-t-il aux pistes si je supprime un entonnoir ?", a: "Les pistes déjà sur votre tableau restent où elles sont. Ce qui part avec l'entonnoir, c'est chaque parcours enregistré et tout le rapport d'abandon qui va avec — la boîte de dialogue de suppression dit combien de parcours." },
      { q: "Puis-je utiliser le même entonnoir sur TikTok et sur mon site web ?", a: "Oui — le canal est une étiquette qui voyage dans la source de la piste ; le lien fonctionne partout. Faites-en deux si vous voulez comparer séparément l'abandon des deux publics." },
      { q: "Un entonnoir a-t-il besoin de mon site web FieldQuo ?", a: "Non. C'est une page à part, à sa propre adresse, et elle peut être intégrée dans n'importe quel site que vous gérez déjà." },
      { q: "Mon pixel Meta ou Google Analytics peut-il voir l'entonnoir ?", a: "Oui — collez l'identifiant sous Pixels de suivi publicitaire dans le créateur. Le pixel se charge sur la page publique, enregistre une vue de page et déclenche l'événement prospect de la plateforme quand le formulaire est envoyé, sans aucune donnée personnelle. FieldQuo n'ajoute aucune bannière de consentement aux témoins ; si vos visiteurs se trouvent là où elle est obligatoire, elle est à votre charge. Voir [[build-a-funnel|Construire un entonnoir et lire son rapport d'abandon]]." },
    ],
  },

  "build-a-funnel": {
    title: "Construire un entonnoir et lire son rapport d'abandon",
    summary:
      "L'éditeur d'entonnoir étape par étape : les sept sortes d'étapes, les marqueurs de notation, l'étape d'estimation instantanée, les pixels publicitaires, ce qu'exige Publier, et comment lire Démarrages, Prospects, Conversion et l'abandon par étape.",
    updated: "2026-09-12",
    intro: [
      "Ouvrez un entonnoir depuis **Entonnoirs** et vous êtes dans l'éditeur : la liste des étapes à gauche, l'éditeur de l'étape sélectionnée au centre, et un aperçu en direct de cette étape à vos couleurs à droite. Cet article explique ce que fait chaque sorte d'étape, quelles questions alimentent la note de la piste, comment un prix se retrouve au milieu d'un entonnoir, et comment lire le rapport une fois que des gens l'ont parcouru.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "La barre du haut contient le nom de l'entonnoir (tapez pour renommer), son badge **Brouillon** ou **Publié**, **Enregistrer**, et **Publier** / **Dépublier**. Quand l'entonnoir est publié, son lien public apparaît avec **Copier le lien** et **Ouvrir**, et son code d'intégration avec **Copier le code** ; tant qu'il est en brouillon, ni l'un ni l'autre n'est offert, parce que le lien ne fonctionnerait pas encore. En dessous, dès que quelqu'un l'a commencé, se trouve **Performance**. La barre et l'éditeur suivent tous deux votre langue." },
        ],
      },
      {
        id: "the-steps",
        heading: "Les sept sortes d'étapes",
        blocks: [
          { table: {
            head: ["Étape", "Ce que voit le visiteur", "Ce que vous réglez"],
            rows: [
              ["Introduction", "L'accroche et un bouton", "Le titre, une ligne d'appui, le texte du bouton"],
              ["Choix unique", "Une question, une réponse à toucher", "La question, le texte d'aide, les réponses (libellé et valeur enregistrée), et le marqueur de notation"],
              ["Choix multiple", "Une question, plusieurs réponses à toucher", "La question, le texte d'aide, les réponses"],
              ["Estimation instantanée", "Une question sur l'ampleur et, d'après vos tarifs, une fourchette de prix", "Le service à chiffrer, les options d'ampleur, une hypothèse pour tous les visiteurs, et si le prix vient avant ou après l'étape des coordonnées"],
              ["Envoi de photos", "« Touchez pour ajouter des photos »", "La question et le texte d'aide ; les photos atterrissent sur la piste"],
              ["Formulaire de contact", "Nom, courriel, téléphone", "Les champs à recueillir — le nom est toujours demandé, plus au moins le courriel ou le téléphone"],
              ["Remerciement", "L'écran de clôture", "Son titre et son texte"],
            ],
          } },
          { p: "Ajoutez des étapes avec **Ajouter une étape**, réordonnez-les avec les flèches et retirez-en une avec la corbeille. Le visiteur les voit dans l'ordre de la liste. Le texte que vous tapez est dans la langue du visiteur, quelle que soit la langue de votre application — c'est votre texte sur une page publique, et FieldQuo ne le traduit pas." },
        ],
      },
      {
        id: "scoring",
        heading: "Quelles réponses notent la piste",
        blocks: [
          { p: "Une question à choix unique porte un marqueur **Notation des pistes** : **Aucune notation**, **Alimente l'échéancier** ou **Alimente le budget**. Les réponses d'une question marquée doivent utiliser les valeurs enregistrées fixes que le noteur comprend — l'éditeur les imprime sous le marqueur (« Les valeurs des réponses doivent être : … ») — et les libellés que le visiteur touche peuvent dire ce que vous voulez. L'échéancier et le budget de la piste pilotent ensuite sa note chaud / tiède / froid exactement comme pour une piste venue du formulaire de soumission." },
          { note: "Les modèles par canal arrivent avec une question d'échéancier et une question de budget déjà marquées et valorisées. Renommez les libellés librement ; laissez les valeurs enregistrées telles quelles, sinon la réponse cesse d'alimenter la note." },
        ],
      },
      {
        id: "the-instant-estimate-step",
        heading: "L'étape d'estimation instantanée",
        blocks: [
          { p: "Cette étape place un vrai prix de départ au milieu de l'entonnoir, calculé du côté de FieldQuo à partir des tarifs réglés dans **Paramètres → Soumissions instantanées**. Le visiteur touche une option d'ampleur (« Une pièce, environ 200 pi² ») ; son téléphone n'envoie que l'option touchée, jamais une mesure, et la fourchette revient de vos tarifs enregistrés." },
          { bullets: [
            "**Service à chiffrer** — seulement un métier activé dans Soumissions instantanées et qui se chiffre à partir d'une option touchée. La toiture, la tonte de pelouse et l'enlèvement de débris sont chiffrés à partir d'une mesure satellite, d'un tracé sur carte ou d'une liste d'articles : ils restent sur votre page d'estimation instantanée plutôt que dans un entonnoir, et l'éditeur le dit.",
            "**Ordre** — **Le prix d'abord, leurs coordonnées ensuite** (moins de contacts, mais bien plus chauds — la raison d'être de l'étape) ou **Leurs coordonnées d'abord, le prix ensuite** (plus de contacts, plus froids). Un service réglé pour ne dévoiler sa fourchette qu'après l'envoi montre le prix après l'étape des coordonnées, quel que soit votre choix.",
            "**Hypothèse pour tous les visiteurs** — ce qu'un entonnoir ne peut pas demander, indiqué une fois : un chantier extérieur laissé vide est chiffré comme un chantier intérieur.",
            "Un service réglé sur « ne pas afficher de prix » montre votre message de rappel plutôt qu'un montant.",
          ] },
        ],
      },
      {
        id: "publish-and-share",
        heading: "Comment le publier et le partager",
        blocks: [
          { steps: [
            "Appuyez sur **Enregistrer** chaque fois que le bouton est foncé ; il affiche **Enregistré** quand rien n'est en attente.",
            "Sous **Pixels de suivi publicitaire** (facultatif), collez un **Identifiant du pixel Meta**, un **Identifiant du pixel TikTok** ou un **Identifiant de mesure GA4**. Chaque pixel renseigné se charge sur la page publique de l'entonnoir et enregistre une vue de page ; quand un visiteur envoie le formulaire de coordonnées, il déclenche l'événement prospect de la plateforme — Meta **Lead**, GA4 **generate_lead**, TikTok **SubmitForm** — sans aucune donnée personnelle. Un identifiant qui n'a pas la forme que la plateforme délivre est ignoré plutôt que placé sur la page. FieldQuo n'ajoute aucune bannière de consentement aux témoins, nulle part ; si vos visiteurs se trouvent là où elle est obligatoire, elle est à votre charge.",
            "Appuyez sur **Publier**. Le badge passe à **Publié** et le lien public et le code d'intégration apparaissent.",
            "Appuyez sur **Copier le lien** pour une publicité ou une publication, ou sur **Copier le code** pour mettre l'entonnoir sur un site que vous avez déjà ; il est aussi listé dans **Paramètres → Partager vos liens** et sur votre lien de profil.",
          ] },
          { warning: "**Publier** est refusé sans étape de coordonnées — un entonnoir sans formulaire ne recueille rien, et le message le dit. Une étape d'estimation instantanée sans service chiffrable bloque aussi ; les raisons sont listées sous une bannière **Cet entonnoir ne peut pas encore être mis en ligne** plutôt que cachées derrière un bouton grisé." },
        ],
      },
      {
        id: "read-the-drop-off",
        heading: "Comment lire le rapport d'abandon",
        blocks: [
          { p: "**Performance** apparaît dès qu'au moins un visiteur a commencé l'entonnoir. Il montre **Démarrages** (les visiteurs distincts qui ont vu la première étape), **Prospects** (les parcours terminés) et **Conversion** (les pistes en proportion des départs), puis une barre par étape dans votre ordre, avec le nombre de visiteurs distincts qui l'ont atteinte et ce nombre en pourcentage des départs." },
          { bullets: [
            "Une étape où le pourcentage chute brusquement est l'étape à changer : moins de réponses, une question plus accueillante, ou le prix déplacé après l'étape des coordonnées.",
            "Le rapport est construit à partir des parcours de cet entonnoir ; supprimer l'entonnoir supprime le rapport, et dépublier le conserve.",
            "Rien ici n'est l'identité d'une piste — les identités sont sur le tableau Prospects.",
          ] },
          { tip: "Comparez honnêtement **Le prix d'abord** et **Leurs coordonnées d'abord** : faites tourner un ordre pendant une semaine, notez Starts et Conversion, changez l'ordre, faites tourner une autre semaine. Le rapport est par entonnoir, donc une copie de l'entonnoir avec l'autre ordre est le test le plus propre." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la question d'ampleur chiffre-t-elle tout comme de l'intérieur ?", a: "Parce que rien ne lui a dit le contraire. Réglez « Hypothèse pour tous les visiteurs » sur extérieur dans l'étape d'estimation, ou ajoutez une question à choix unique — l'hypothèse est le seul fait que l'étape ne peut pas demander." },
      { q: "Un visiteur peut-il revenir à l'étape précédente ?", a: "Oui — chaque étape après la première affiche un lien de retour jusqu'à l'envoi du formulaire. Le rapport compte un visiteur une seule fois par étape, peu importe combien de fois il y revient." },
      { q: "L'entonnoir fonctionne-t-il dans le navigateur intégré d'Instagram ou de TikTok ?", a: "Oui — c'est une page ordinaire sans application à installer, et sa hauteur est d'une question par écran, ce qui tient dans le cadre intégré." },
    ],
  },

  "marketing-campaigns": {
    title: "Les campagnes marketing",
    summary:
      "L'écran Marketing : une carte par campagne — distribution de dépliants, Meta / publicités payantes, envoi courriel ou autre — avec son type, son statut, sa progression et son responsable, plus Abonnés et Dépenses marketing à côté.",
    updated: "2026-09-12",
    intro: [
      "**Marketing** est l'étagère où reposent vos campagnes. Une distribution de dépliants se travaille arrêt par arrêt depuis un téléphone et affiche **26/40 arrêts · 9 contactés** ; un envoi courriel affiche son modèle et **Envoyé à …** avec le nombre ; une fiche de publicités payantes affiche son budget et un lien vers le gestionnaire de publicités. Cet article couvre l'écran, le formulaire **Nouvelle campagne** et les quatre types ; le trajet de dépliants, l'envoi courriel et le rapport de dépenses ont chacun leur propre article.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Aperçu général",
        blocks: [
          { p: "Sous le titre — « Gérez et suivez vos campagnes — publicités payantes, envois courriel et distribution de dépliants porte-à-porte, avec les trajets, les assignations et les relances au pas de porte au même endroit. » — se trouvent **Abonnés**, **Dépenses marketing** et **Nouvelle campagne**. Chaque campagne est une carte. Une carte de dépliants ou de courriel ouvre sa propre page ; une carte de publicités payantes ou autre est une fiche et n'ouvre rien, parce que le travail se fait dans la plateforme publicitaire." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Le nom de la carte et une puce de statut : **Brouillon**, **Active**, **En pause**, **Envoyée**, **Partiellement envoyée** ou **Archivée**.",
            "Son type : **Distribution de dépliants**, **Meta / publicités payantes**, **Envoi courriel** ou **Autre**.",
            "Sa progression — un trajet de dépliants affiche **visités/total arrêts** avec une barre et **… contactés** ; un courriel affiche le nom du modèle et **Envoyé à …** ou **Pas encore envoyé** ; une publicité affiche **Budget …** et **lié** quand un lien a été saisi.",
            "À qui elle est assignée — et sous la carte, ses boutons de statut : **Activer** ou **Mettre en pause** (**Reprendre** quand elle est en pause), et **Archiver** ; une carte archivée affiche **Restaurer**. Dès que vous en avez, un lien **Afficher les archivées (n)** en haut à droite les ramène à la vue.",
            "Sans campagne : **Aucune campagne pour l'instant. Créez-en une pour suivre votre marketing.**",
          ] },
          { figure: "live:app-marketing", caption: "Marketing — le titre, Abonnés, Dépenses marketing et Nouvelle campagne, et une carte par campagne avec son type et son statut." },
        ],
      },
      {
        id: "create-a-campaign",
        heading: "Comment créer une campagne",
        blocks: [
          { steps: [
            "Ouvrez **Marketing** sous Croissance et appuyez sur **Nouvelle campagne**.",
            "Tapez le **Nom de la campagne** et choisissez le type.",
            "**Assigner à** une personne, ou laissez **Non assigné**. Pour une distribution de dépliants, c'est la personne qui fait le trajet.",
            "Pour **Envoi courriel**, choisissez le **Modèle à envoyer** — seuls les modèles marketing et personnalisés sont offerts ; si vous n'en avez aucun, créez-en un d'abord dans **Modèles de courriel**, le formulaire le dit. Pour **Meta / publicités payantes** et **Autre**, saisissez un **Budget (facultatif)** et un **Lien (Meta Ads Manager, etc.)**.",
            "Appuyez sur **Créer la campagne**. La carte apparaît ; une carte de dépliants ou de courriel s'ouvre au toucher.",
          ] },
          { figure: "create:app-marketing-create", caption: "Nouvelle campagne — le nom, le type, Assigner à et Créer la campagne ; les champs supplémentaires apparaissent quand le type est Envoi courriel, Meta / publicités payantes ou Autre." },
        ],
      },
      {
        id: "the-four-kinds",
        heading: "Les quatre types",
        blocks: [
          { table: {
            head: ["Type", "Ce que contient la campagne", "À lire ensuite"],
            rows: [
              ["Distribution de dépliants", "Un trajet d'adresses, ordonné en parcours efficace, chaque arrêt marqué Distribué, Parlé au propriétaire, Absent ou Ignoré depuis le téléphone, et un propriétaire rencontré transformé en client sur place", "[[pamphlet-routes|Trajets de dépliants et d'accroche-portes]]"],
              ["Envoi courriel", "Un modèle envoyé une fois à toutes les personnes actuellement abonnées, depuis votre propre expéditeur, avec le compte de qui il a rejoint", "[[email-campaigns-and-subscribers|Campagnes courriel et abonnés]]"],
              ["Meta / publicités payantes", "Un budget et un lien vers le gestionnaire de publicités, comme fiche", "[[marketing-spend|Dépenses marketing]] et [[connect-meta-ads|Connecter votre compte publicitaire Meta]]"],
              ["Autre", "Un budget et un lien, pour tout le reste — une publicité radio, une commandite", "[[marketing-spend|Dépenses marketing]]"],
            ],
          } },
          { note: "Le **Budget** d'une carte de publicités payantes ou autre est ce que vous réservez pour toute la durée de la campagne. Il s'affiche dans **Dépenses marketing** sous **Budgété (campagnes)**, à côté de ce qui a réellement été dépensé sur ce canal, et n'entre jamais dans un total ni dans un coût par piste — ceux-ci ne lisent que les dépenses enregistrées ou synchronisées. Voir [[marketing-spend|Dépenses marketing]]." },
        ],
      },
      {
        id: "statuses",
        heading: "Les statuts",
        blocks: [
          { bullets: [
            "**Brouillon** — toute nouvelle campagne. Sur une campagne de dépliants, de publicités payantes ou autre, appuyez sur **Activer** quand le trajet est en cours ou que les publicités tournent ; la puce lit **Active**.",
            "**Active** et **En pause** — **Mettre en pause** suspend une campagne active et **Reprendre** la relance. Une campagne courriel n'a ni l'un ni l'autre : l'envoi est le geste, et sa puce est écrite par l'envoi lui-même.",
            "**Envoyée** — une campagne courriel une fois que chaque abonné l'a reçue. **Partiellement envoyée** — un envoi arrêté en cours de route ; la page de la campagne propose de reprendre l'envoi, qui n'écrit qu'aux personnes pas encore rejointes. Rien de ce que vous appuyez ne règle ces deux-là.",
            "**Archivée** — **Archiver** sur n'importe quelle campagne, après une confirmation (**Archiver ? Elle quitte la liste ; rien n'est supprimé.**). La carte quitte la liste derrière **Afficher les archivées**, son budget quitte la page des dépenses, et chaque arrêt, chaque envoi et chaque note qu'elle contient est conservé. **Restaurer** la ramène en brouillon.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Marketing**, la liste, les abonnés et le rapport de dépenses sont pour les propriétaires, les administrateurs, les répartiteurs et les gestionnaires, et les boutons Activer, Mettre en pause, Archiver et Restaurer aussi. Marquer un arrêt sur un trajet de dépliants est du travail de terrain, ouvert à tout membre actif, et la page d'une campagne cache son budget et ses notes à quiconque est sous ce niveau — mais les équipes et les estimateurs n'ont aucune ligne pour atteindre la liste, donc remettez-leur directement le lien de la campagne." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je supprimer une campagne ?", a: "Non, volontairement — supprimer emporterait chaque fiche de porte-à-porte et chaque envoi avec elle. Appuyez plutôt sur Archiver : la campagne quitte la liste, garde tout, et Restaurer la ramène. Les arrêts d'un trajet de dépliants peuvent toujours être retirés un à un." },
      { q: "Une campagne Meta ici se connecte-t-elle à mon compte publicitaire Meta ?", a: "Pas depuis cette carte — elle contient un budget et un lien. La synchronisation du compte publicitaire, les formulaires de prospects et l'importation des dépenses se trouvent dans Paramètres → Publicités Meta." },
      { q: "D'où viennent les adresses courriel d'un envoi ?", a: "Des Abonnés — les personnes actuellement abonnées. Quiconque s'est désabonné est exclu automatiquement." },
    ],
  },
};
