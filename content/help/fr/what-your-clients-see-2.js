// content/help/fr/what-your-clients-see-2.js
//
// Partie 2 de la catégorie « what-your-clients-see » en français (voir le
// composeur, what-your-clients-see.js). Même structure que l'anglais,
// article par article : mêmes slugs, mêmes sections dans le même ordre, mêmes
// blocs, mêmes figures — scripts/check-help-centre.mjs compare les deux. Les
// mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js; ce que le
// client voit vient de lib/i18n/clientDocCopy.js, lib/links/labels.js,
// lib/site/siteCopy.js, lib/reviews/reviewEmail.js et lib/sms/templates.js.
export const ARTICLES = {
  "the-self-quote-form-as-a-client": {
    title: "Le formulaire de demande de soumission",
    summary:
      "Ce qu'un propriétaire voit quand il ouvre votre lien Demander une soumission : trois courtes étapes, aucun prix, une confirmation à vos couleurs, et un prospect dans votre pipeline.",
    updated: "2026-09-12",
    intro: [
      "Votre lien **Demander une soumission** est un formulaire public qu'un inconnu peut remplir depuis votre site web, une publication Facebook ou l'arrière du camion. Il porte votre logo, votre nom et votre couleur de marque; rien dessus ne dit FieldQuo. Il demande le service, la taille approximative des travaux, et un moyen de répondre — dans cet ordre, parce que quelqu'un qui compare trois entrepreneurs choisira un service avant de donner une adresse courriel.",
      "Il n'affiche jamais de prix. Le formulaire produit un **prospect**, pas une soumission : on dit au propriétaire qu'une personne chiffrera les travaux, et ce qu'il a tapé arrive sur votre tableau Prospects avec la taille des travaux déjà connue.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le formulaire vit au lien propre à votre entreprise (la carte **Demander une soumission** de **Paramètres → Partager vos liens** vous le donne, avec un extrait de code pour l'intégrer dans un site web que vous avez déjà). Il est écrit dans la langue de votre entreprise et disposé dans le même ordre que votre soumission — bandeau d'identité en haut, une ligne de progression à trois points, puis une étape à la fois." },
          { figure: "harness:client-self-quote-form", caption: "Le formulaire de demande de soumission tel qu'un propriétaire le voit — le logo et le nom de l'entreprise, puis l'étape 1, « Comment pouvons-nous vous aider ? », qui ne liste que les services que l'entreprise a activés." },
          { note: "La liste des services est celle que vous avez activée sous **Paramètres → Services et tarifs**. Un visiteur ne peut pas demander des travaux que vous ne faites pas, et la grille de tarifs derrière chaque service ne quitte jamais cet écran de réglages — le point d'accès public renvoie des services et des champs de prise d'information, pas des prix." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "Ce que le propriétaire remplit",
        blocks: [
          { steps: [
            "**Comment pouvons-nous vous aider ?** — un tapotement sur un service. Une entreprise d'armoires qui a activé Conception de cuisine montre aussi une ligne ici : « Vous préférez le dessiner? Concevez votre cuisine vous-même et envoyez-nous le plan → ».",
            "**Quelle est l'ampleur?** — au plus trois champs numériques ou à choix pour ce service (portes, pieds carrés, pièces), puis deux rangées de puces toujours demandées : **Quand souhaitez-vous commencer ?** (Dès que possible · D'ici 2 semaines · Dans 1 à 3 mois · Je me renseigne seulement) et **Budget approximatif ?** (quatre tranches dans votre devise, plus Je ne sais pas encore — facultatif), et un champ libre **Autre chose à nous signaler ?**.",
            "**Où devons-nous vous répondre ?** — un nom, et un courriel ou un numéro de téléphone (« Un courriel ou un téléphone suffit. »), une adresse facultative avec l'autocomplétion Google, et **Ajouter des photos, une vidéo ou un plan PDF**. Le bouton se lit **Envoyer ma demande**, et en dessous : « Sans obligation. [Votre entreprise] vous reviendra avec un prix. »",
          ] },
          { p: "Une adresse choisie dans l'autocomplétion apporte sa ville, sa province et son pays au prospect, alors le client que vous en créez a déjà une juridiction fiscale. Une adresse tapée à la main s'envoie quand même — le formulaire ne dépend jamais de la disponibilité de Google." },
        ],
      },
      {
        id: "after-they-press-send",
        heading: "Ce qui se passe après Envoyer",
        blocks: [
          { bullets: [
            "L'écran se transforme en document **Demande reçue** à vos couleurs : votre logo et votre téléphone, le mot **Demande**, une référence, un panneau « préparé pour » avec ce qu'il a tapé, **Ce que vous avez demandé**, et **Les prochaines étapes** en trois points numérotés — vous la lisez, vous la chiffrez, il reçoit une soumission. Une ligne se lit « Aucun prix n'est affiché pour l'instant — cette demande n'a pas été chiffrée. »",
            "S'il a donné un courriel, une copie lui part **de votre entreprise**, dans la langue dans laquelle le prospect a été créé, avec le même contenu et sans prix. L'écran dit « Une copie est en route vers … » seulement quand une copie a vraiment été envoyée.",
            "Si votre entreprise peut prendre des rendez-vous (au moins un type d'événement actif et le mode visite activé), un panneau **Souhaitez-vous que nous venions voir ?** apparaît sous la confirmation avec un bouton **Réserver une visite**, prérempli avec les coordonnées qu'il vient de taper. Voir [[the-booking-page|La page de rendez-vous]].",
            "De votre côté, un prospect apparaît dans **Prospects** avec la source, les réponses en champs structurés, les photos et le plan, coté **Chaud**, **Tiède** ou **Froid** — et les gens qui reçoivent les notifications de prospects sont avertis. Un numéro de téléphone donné ici est enregistré comme un consentement à être rappelé.",
          ] },
          { tip: "Le prospect garde la langue dans laquelle il a été écrit, et la soumission en laquelle vous le convertissez est créée dans cette langue — voir [[quote-language|Une soumission garde sa langue]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Où", "Ce que ça change sur le formulaire"],
            rows: [
              ["Paramètres → Image de marque", "Le logo, la couleur de marque et chaque couleur qui en découle — le contraste est mesuré, alors une marque jaune ou blanche reste lisible."],
              ["Paramètres → Services et tarifs", "Quels services apparaissent à l'étape 1, et quels champs l'étape 2 demande (les trois premiers champs numériques ou à choix de chaque service)."],
              ["Paramètres → Langue", "La langue dans laquelle le formulaire et la confirmation sont écrits — celle par défaut de votre entreprise. Il n'y a pas de sélecteur de langue pour le visiteur aujourd'hui : FieldQuo ne permet pas encore à une entreprise de lister plusieurs langues d'envoi."],
              ["Paramètres → Page de rendez-vous", "Si le panneau Réserver une visite apparaît après la confirmation (il faut au moins un type d'événement actif)."],
              ["Paramètres → Partager vos liens", "Le lien lui-même, un bouton Ouvrir, et l'extrait de code à intégrer dans votre propre site web."],
            ],
          } },
          { p: "La formulation des étapes est celle de FieldQuo, en huit langues; elle ne peut pas être modifiée. Ce que vous ne pouvez pas faire, volontairement : afficher un prix, demander une carte, ou ajouter vos propres champs." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le formulaire lui-même est public — quiconque a le lien. L'écran **Partager vos liens** qui distribue le lien demande le niveau Manager ou plus (un propriétaire, un administrateur, un Manager ou un Dispatcher). Les prospects qu'il crée sont visibles par quiconque a un accès qui inclut les demandes." },
        ],
      },
    ],
    faq: [
      { q: "Le propriétaire peut-il voir un prix sur le formulaire?", a: "Non, et c'est voulu. Le formulaire crée un prospect; une personne le chiffre. Si vous voulez qu'un visiteur voie un montant de départ, c'est la soumission instantanée — voir [[the-instant-estimate-page|La page de soumission instantanée]]." },
      { q: "Pourquoi le formulaire ne montre-t-il qu'une partie de mes services?", a: "Il liste les services activés sous Paramètres → Services et tarifs. Activez-en un et il apparaît sur le formulaire tout de suite." },
      { q: "Le visiteur doit-il donner un courriel?", a: "Un courriel ou un numéro de téléphone — un seul suffit. Un courriel mal orthographié est refusé pendant qu'il regarde encore le formulaire, plutôt que de rebondir plus tard." },
      { q: "Puis-je mettre le formulaire sur mon site web existant?", a: "Oui. Paramètres → Partager vos liens a un extrait de code à intégrer; dans votre propre page, le formulaire laisse tomber son bandeau de logo parce que votre site porte déjà votre nom." },
    ],
  },

  "the-review-request": {
    title: "La demande d'avis",
    summary:
      "Le seul courriel qu'un client reçoit après un chantier terminé : votre logo, une phrase de remerciement, une note de 1 à 5, un bouton Laisser un avis vers votre lien Google — et les règles qui garantissent qu'il est envoyé une fois, et jamais à la mauvaise personne.",
    updated: "2026-09-12",
    intro: [
      "Quand un chantier est marqué **Terminé**, FieldQuo peut demander un avis au client en votre nom. Le courriel vient de votre entreprise, porte votre logo et la couleur de votre bouton, et ne dit rien de FieldQuo. Il est court volontairement : une ligne de remerciement, un bouton, une façon de se plaindre à vous plutôt qu'en public.",
      "Il est envoyé **une fois, à jamais, par chantier** — jamais deux fois, jamais à quelqu'un qui s'est désabonné, jamais pour un chantier terminé il y a plus de 30 jours.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La demande est désactivée tant que vous n'avez pas collé un lien d'avis et activé **Demander automatiquement** sous **Paramètres → Avis**. À partir de là, chaque chantier qui atteint **Terminé** est vérifié une fois par heure : quand le délai que vous avez choisi est passé et que le client a une adresse courriel, le message part." },
          { figure: "live:app-settings-reviews", caption: "Paramètres → Avis — Votre lien d'avis, le sélecteur Demander automatiquement, et la carte Avis sur votre site web en dessous." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Ce que le client reçoit",
        blocks: [
          { bullets: [
            "Objet : **Comment avons-nous fait? — [Votre entreprise]**, envoyé depuis l'expéditeur de votre entreprise.",
            "Votre logo (ou le nom de votre entreprise), puis « Bonjour [prénom], » et une phrase : merci d'avoir fait appel à vous, un court avis aiderait beaucoup.",
            "Une rangée **Comment avons-nous fait?** de cinq puces numérotées, de 1 à 5. En taper une ouvre une petite page à vos couleurs où la note est présélectionnée et où le client peut ajouter un commentaire facultatif et appuyer sur Envoyer. Rien n'est enregistré tant qu'il n'appuie pas.",
            "Un bouton **Laisser un avis** dans votre couleur de marque qui ouvre votre lien d'avis (habituellement Google), et « Ça prend environ une minute. »",
            "Une ligne de pied de page : si quelque chose n'allait pas, répondez plutôt à ce courriel et l'entreprise y verra — les réponses arrivent à l'adresse courriel de votre entreprise.",
            "Un lien de désabonnement, parce que demander un avis public est un message commercial au sens de la loi canadienne anti-pourriel.",
          ] },
          { note: "Le courriel existe en anglais et en français. Un client dont la langue est autre chose reçoit la version anglaise. La page de notation sous les puces est écrite dans les huit langues des clients." },
        ],
      },
      {
        id: "the-rules",
        heading: "Quand il est envoyé, et quand il ne l'est pas",
        blocks: [
          { table: {
            head: ["Condition", "Ce qui se passe"],
            rows: [
              ["Le chantier a déjà fait l'objet d'une demande", "Jamais redemandé — c'est vérifié avant tout le reste, même si deux personnes appuient en même temps."],
              ["Pas de lien d'avis, ou Demander automatiquement est désactivé", "Rien n'est envoyé."],
              ["Le chantier n'est pas Terminé, ou FieldQuo ne sait pas quand il a fini", "Rien n'est envoyé. Un chantier terminé avant que les dates de fin soient enregistrées est laissé tranquille plutôt que deviné."],
              ["Le client n'a pas d'adresse courriel", "Rien n'est envoyé — il n'y a pas de demande d'avis par texto."],
              ["Le client s'est désabonné", "Sauté."],
              ["Le délai n'est pas encore passé", "Ça attend. Le délai est la puce que vous avez choisie : 2 heures plus tard, 4 heures plus tard, Le lendemain, Deux jours plus tard, Trois jours plus tard, Une semaine plus tard."],
              ["Le chantier a fini il y a plus de 30 jours", "Jamais demandé. Activer la fonction aujourd'hui n'écrit pas à tous les clients que vous aviez l'an dernier."],
            ],
          } },
          { warning: "La réservation est écrite avant que le courriel parte. Si l'envoi échoue ensuite, ce client n'est plus jamais sollicité — c'est l'échec le plus sûr. Ne pas demander coûte un avis; demander deux fois coûte la relation." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Avis** et collez votre lien dans **Votre lien d'avis** — habituellement le lien court « Demander des avis » de votre fiche d'entreprise Google, mais n'importe quelle page http ou https fonctionne. Appuyez sur **Enregistrer**, puis utilisez **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**.",
            "Activez **Demander automatiquement**. Tant qu'un lien valide n'est pas enregistré, le sélecteur est désactivé et dit d'ajouter d'abord votre lien d'avis ci-dessus.",
            "Choisissez une puce sous **Quand demander**. Par défaut, c'est le lendemain.",
            "Lisez la ligne de file d'attente en dessous — combien de clients sont en file et combien ont été sollicités dans les 30 derniers jours — pour la voir fonctionner.",
          ] },
          { p: "Les notes de la rangée 1 à 5 alimentent la tuile **Satisfaction client** dans **KPI**. Les avis que les clients laissent sur Google restent sur Google; pour les montrer sur votre site web, collez-les dans **Avis sur votre site web** sur le même écran — voir [[testimonials-on-your-website|Témoignages sur votre site web]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "**Paramètres → Avis** demande le niveau Manager ou plus — un propriétaire, un administrateur, un Manager ou un Dispatcher. La demande elle-même est envoyée par FieldQuo selon un horaire; il n'y a pas de bouton Demander maintenant sur un chantier, et personne ne peut l'envoyer deux fois." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je envoyer une demande d'avis par texto?", a: "Non. La demande part par courriel seulement, et seulement à un client qui a une adresse courriel au dossier." },
      { q: "Puis-je modifier la formulation?", a: "Pas aujourd'hui. Le courriel, c'est une phrase et un bouton à vos couleurs; les seules choses que vous réglez sont le lien et le délai." },
      { q: "Un client a répondu au courriel — où est-ce allé?", a: "À l'adresse courriel de votre entreprise, la même adresse de réponse que vos soumissions. Les réponses n'arrivent jamais chez FieldQuo." },
      { q: "On l'a activé et rien n'a été envoyé pour les chantiers du mois dernier.", a: "C'est voulu. Un chantier terminé il y a plus de 30 jours ne fait jamais l'objet d'une demande, et seuls les chantiers qui atteignent Terminé à partir de maintenant sont considérés." },
    ],
  },

  "the-referral-page": {
    title: "La page de parrainage",
    summary:
      "La page sur laquelle un autre propriétaire d'entreprise arrive quand vous partagez votre lien Parrainage — à qui elle s'adresse, ce qu'elle promet, ce qu'elle dit de vous, et le seul endroit où le nom de FieldQuo est censé apparaître.",
    updated: "2026-09-12",
    intro: [
      "Votre lien de parrainage n'est pas pour les propriétaires. Il est pour **une autre entreprise** — l'électricien avec qui vous partagez des chantiers, le peintre qui a demandé quel logiciel vous utilisez. La page qu'il ouvre dit que vous utilisez FieldQuo, lui offre un mois gratuit en plus de l'essai, et l'envoie au formulaire d'inscription avec votre nom attaché.",
      "C'est donc l'exception à la règle de la marque blanche, volontairement : une page dont tout le but est de dire « cet entrepreneur utilise FieldQuo — vous pourriez aussi » ne peut pas cacher le nom. Votre logo et votre couleur y sont comme parrain, et ceux de FieldQuo y sont comme produit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le lien est court — le nom de votre entreprise sans les espaces ni la ponctuation, pour qu'on puisse le lire à voix haute, l'imprimer sur une carte d'affaires ou le peindre sur un camion. Il est insensible à la casse. Votre écran **Parrainage** le montre sous **Votre lien** avec un bouton **Copier**." },
          { figure: "live:app-settings-refer", caption: "Parrainage — le lien de l'entreprise avec Copier, Envoyer une invitation par courriel ou par texto, puis les mois gagnés, les entreprises parrainées et les invitations envoyées." },
        ],
      },
      {
        id: "what-the-visitor-sees",
        heading: "Ce que le visiteur voit",
        blocks: [
          { bullets: [
            "Votre logo — ou, sans logo, votre initiale sur votre couleur de marque — au-dessus de la ligne « [Votre entreprise] uses FieldQuo ».",
            "Le titre **Get your first month free**, un paragraphe de description de FieldQuo, et un bouton **Claim your first month free** qui ouvre le formulaire d'inscription avec votre code de parrainage attaché.",
            "Sous le bouton : « No card charged during your trial. Cancel any time. » Puis trois puces sur ce que fait le produit.",
            "Un pied de page qui dit la partie discrète : « For businesses new to FieldQuo. Already have an account? Sign in. » — une entreprise existante ne peut pas réclamer l'offre.",
          ] },
          { p: "La page est rendue sur le serveur pour être lisible dans la première demi-seconde avec une barre de signal, et elle porte un aperçu de lien (titre et description) parce qu'elle se fait coller dans des groupes WhatsApp et Facebook où la carte d'aperçu est l'argument de vente." },
        ],
      },
      {
        id: "what-it-promises",
        heading: "Ce qu'elle promet, exactement",
        blocks: [
          { table: {
            head: ["Qui", "Ce qu'il reçoit", "Quand"],
            rows: [
              ["L'entreprise que vous avez parrainée", "**1 mois gratuit de plus** ajouté à son essai", "À l'inscription, dès qu'elle utilise votre lien"],
              ["Vous", "**1 mois gratuit** ajouté à votre propre accès", "Quand l'entreprise parrainée fait son premier paiement — pas à l'inscription"],
            ],
          } },
          { p: "Les deux côtés reçoivent la même chose — un mois de FieldQuo — quelle que soit la taille de l'entreprise que vous parrainez. Votre mois tombe à son premier paiement plutôt qu'à son inscription pour que vingt inscriptions jetables ne puissent pas rapporter une année gratuite; le plafond est de 50 parrainages crédités par mois civil." },
          { note: "Le lien ne fait rien pour une entreprise qui a déjà un compte, et vous ne pouvez pas vous parrainer vous-même. La page le leur dit avant qu'ils remplissent quoi que ce soit." },
        ],
      },
      {
        id: "sending-it",
        heading: "Comment l'envoyer",
        blocks: [
          { steps: [
            "Ouvrez **Parrainage** (dans la barre latérale, ou **Paramètres → Parrainage** — le même écran).",
            "Appuyez sur **Copier** à côté de **Votre lien** et collez-le n'importe où, ou **Envoyer par texto** sur un téléphone pour ouvrir votre propre application de messagerie avec l'invitation déjà écrite.",
            "Ou utilisez **Envoyer une invitation** avec **Son courriel** ou **Son numéro de cellulaire** et un nom facultatif, puis **Envoyer l'invitation**. FieldQuo envoie un message et ne relance jamais; jusqu'à 20 invitations par jour.",
            "Surveillez **Entreprises que vous avez parrainées** : chacune indique **Inscrit — pas encore payant** jusqu'à son premier paiement, puis **Crédité**, et votre mois apparaît sous le compte en haut.",
          ] },
          { warning: "Une invitation envoyée depuis cet écran est un courriel ou un texto de **FieldQuo** — l'en-tête de FieldQuo, l'expéditeur de FieldQuo — qui dit que votre entreprise utilise le produit. C'est le seul message du produit qui n'est pas à vos couleurs, parce qu'il parle de FieldQuo, pas de votre travail." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La page d'arrivée est publique. **Parrainage** est réservé au propriétaire et aux administrateurs — il liste quelles entreprises ont été parrainées et ce qui a été crédité, ce qui est de l'information de facturation. Un Manager ne voit pas la ligne." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce pour mes clients propriétaires?", a: "Non. C'est un parrainage d'entreprise à entreprise vers FieldQuo. Pour ce que FieldQuo fait et ne fait pas au sujet des clients qui recommandent des clients, voir [[referrals-from-clients|Recommandations de clients]]." },
      { q: "Pourquoi la page dit-elle FieldQuo alors que rien d'autre ne le dit?", a: "Parce que son but est de recommander FieldQuo. Chaque soumission, facture, page et courriel que vos clients voient porte votre nom; cette page s'adresse à un autre entrepreneur et parle du logiciel." },
      { q: "Quand est-ce que je reçois mon mois gratuit?", a: "Quand l'entreprise que vous avez parrainée fait son premier paiement. D'ici là, la ligne indique Inscrit — pas encore payant. Détails : [[referral-months|Mois de parrainage]]." },
    ],
  },

  "your-website-as-a-visitor": {
    title: "Votre site web",
    summary:
      "Ce qu'un visiteur voit sur votre site hébergé par FieldQuo : vos pages, vos heures, vos services lus en direct depuis les Paramètres, des boutons Obtenir un devis et Rendez-vous qui restent à votre adresse, et la seule ligne de pied de page que seul un site gratuit porte.",
    updated: "2026-09-12",
    intro: [
      "Votre site web vit à votre propre sous-domaine — **votreentreprise.fieldquo.com** — et c'est la seule page destinée aux clients dans FieldQuo qui est censée être trouvée par Google. Tout ce qui s'y trouve est à vous : le logo, la couleur, la formulation, les photos que vos équipes ont prises. La seule mention de FieldQuo, où que ce soit, est une petite ligne **Site by FieldQuo** dans le pied de page, et cette ligne n'est que sur les sites **gratuits**.",
      "Il est rendu sur le serveur en une seule requête et fonctionne avec JavaScript désactivé, parce qu'un inconnu sur une mauvaise connexion dans une entrée de garage est exactement la personne à qui il s'adresse.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Rien n'est public tant que vous n'appuyez pas sur **Publier** dans **Paramètres → Votre site web**. Un site non publié est une page introuvable pour un visiteur et un aperçu de brouillon pour un membre connecté de votre entreprise — la barre ambrée en haut le dit, et les moteurs de recherche reçoivent l'instruction de ne pas l'indexer." },
          { figure: "harness:client-website", caption: "Un site publié tel qu'un visiteur le voit — le nom de l'entreprise, une pastille Ouvert · ferme à tirée de ses heures d'ouverture, le menu des pages, un sélecteur de langue, le numéro de téléphone, et le bouton Obtenir un devis." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Ce qu'il y a sur la page",
        blocks: [
          { bullets: [
            "**L'en-tête** : votre logo ou votre nom, une pastille **Ouvert · ferme à …** / **Fermé · ouvre …** calculée d'après les heures d'ouverture de **Profil de l'entreprise** (absente si vous n'en avez pas réglé), le menu des pages, un sélecteur de langue quand le site a plus d'une langue, votre numéro de téléphone, et un bouton **Obtenir un devis**.",
            "**Les pages** : Accueil, Services, Réalisations, À propos, Rendez-vous, Devis et Contact, chacune bâtie de sections — en-tête, services, avant-après, galerie, témoignages, FAQ, processus, accréditations, zones desservies, heures, contact, un appel à l'action.",
            "**Les services** sont lus depuis **Paramètres → Services et tarifs** à chaque requête : activez un métier et il apparaît; désactivez-en un et il disparaît. Les textes sont conservés, la liste est en direct.",
            "Les sections **galerie** et **avant-après** que vous avez laissées vides se remplissent d'elles-mêmes avec des photos récentes de chantiers et des visites à deux photos tirées de vos chantiers; ce que vous avez choisi vous-même a toujours priorité.",
            "**Les témoignages** sont ceux que vous avez activés sous **Paramètres → Avis** — les six premiers.",
            "**Obtenir un devis**, c'est votre formulaire de demande de soumission rendu à l'intérieur de la page, et **Rendez-vous**, c'est votre calendrier de réservation. Les deux gardent le visiteur à votre adresse; rien ne l'envoie vers fieldquo.com.",
            "**Le pied de page** : votre logo, © et votre nom — et, sur un site gratuit seulement, « Site by FieldQuo ».",
          ] },
          { note: "Les moteurs de recherche reçoivent aussi une fiche structurée « LocalBusiness » — nom, téléphone, courriel, adresse et heures d'ouverture — qui est ce qui met « Ouvert ⋅ Ferme à 17 h » dans un résultat Google. Les heures ne sont incluses que si vous les avez réglées; une semaine vide n'est jamais inventée." },
        ],
      },
      {
        id: "languages",
        heading: "Langues",
        blocks: [
          { p: "La première langue est la principale et vit à l'adresse racine; chaque autre langue vit à **/fr**, **/es** et ainsi de suite, avec un sélecteur dans l'en-tête. Ajouter une langue sous **Langues** écrit tout le site dans cette langue — ce n'est pas une traduction automatique de la page — et chaque langue porte son propre titre et sa propre description pour les moteurs de recherche. Une langue que vous n'avez pas activée est une page introuvable, pas un repli silencieux vers l'anglais." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez, et d'où",
        blocks: [
          { table: {
            head: ["Commande", "Ce que le visiteur voit changer"],
            rows: [
              ["Publier / Dépublier (Paramètres → Votre site web)", "Le site apparaît ou, sur Dépublier, montre une page non publiée tout de suite; rien n'est supprimé et Publier remet le même site."],
              ["Adresse web", "Le sous-domaine. Les noms réservés (app, www, api et compagnie) ne peuvent pas être pris — c'est une frontière de sécurité, pas une préférence de nommage."],
              ["Les sections et le volet de conversation", "La formulation de chaque section. Reconstruire réécrit les mots que vous avez modifiés; les photos, les paires, le logo et les couleurs sont conservés."],
              ["Paramètres → Image de marque", "Le logo et les couleurs sur tout le site, avec le contraste mesuré."],
              ["Profil de l'entreprise", "Téléphone, courriel, adresse, heures d'ouverture et zones desservies — lus en direct, jamais retapés dans le site."],
              ["Paramètres → Services et tarifs", "La liste des services, en direct."],
              ["Paramètres → Avis", "Quels témoignages s'affichent."],
              ["Votre forfait", "Une entreprise sur un forfait gratuit, ou dont l'abonnement est échu, montre la ligne de pied de page Site by FieldQuo; une entreprise payante — essai compris — non."],
            ],
          } },
          { p: "FieldQuo n'offre pas de domaine personnalisé aujourd'hui : le site est servi à votre sous-domaine fieldquo.com. Si vous possédez un domaine, le lien de profil et Partager vos liens peuvent pointer vers lui, et l'intégration des avis peut se placer sur un site que vous avez déjà." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Le site publié est public et indexé. Le générateur dans **Paramètres → Votre site web** — publier, dépublier, l'adresse, les langues — est réservé au propriétaire et aux administrateurs." },
        ],
      },
    ],
    faq: [
      { q: "Le site dit-il FieldQuo quelque part?", a: "Seulement la ligne de pied de page « Site by FieldQuo », et seulement sur un site gratuit ou dont l'abonnement est échu. Le site d'une entreprise payante ne porte aucune mention de FieldQuo." },
      { q: "Puis-je utiliser mon propre domaine?", a: "Pas aujourd'hui. Le site vit à votreentreprise.fieldquo.com. Voir [[your-website-address|L'adresse de votre site web]]." },
      { q: "J'ai ajouté un service dans les Paramètres — dois-je reconstruire le site?", a: "Non. La section des services lit vos services activés à chaque visite. Même chose pour les heures, le téléphone, l'adresse et les zones desservies." },
      { q: "D'où viennent les photos?", a: "Les photos que vous avez téléversées dans le générateur d'abord; sinon, des photos récentes de chantiers prises par vos équipes remplissent automatiquement une galerie vide. Les photos de banque sont des images Unsplash liées directement, pas copiées — voir [[stock-photos-on-your-website|Photos de banque sur votre site web]]." },
    ],
  },

  "the-kitchen-design-link": {
    title: "Le lien de conception de cuisine",
    summary:
      "La page qu'un client ouvre pour déplacer des armoires et essayer des finis sur la cuisine que vous avez soumissionnée — aucun prix, sa version enregistrée à côté de la vôtre, et un courriel pour vous quand il enregistre.",
    updated: "2026-09-12",
    intro: [
      "Pour un chantier d'armoires que vous avez dessiné dans le concepteur de cuisine, le client peut recevoir un lien vers sa propre copie du dessin. Il voit votre nom et votre logo, le numéro de la soumission et son nom, un plan sur lequel il peut faire glisser des pièces, et un panneau **Colours & finishes**. Il ne peut voir aucun tarif, et rien de ce qu'il fait ne change un chiffre de lui-même.",
      "Quand il appuie sur **Save my version**, sa disposition est enregistrée à côté de la vôtre — jamais par-dessus — et le créateur de la soumission plus vos propriétaires et administrateurs reçoivent un courriel qui le dit. Vous ouvrez le concepteur, vous comparez, et vous décidez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le lien est le jeton de partage de la soumission — la même clé que la page d'approbation — alors il existe dès que la soumission a été envoyée. Sur l'écran **Concepteur de cuisine** de la soumission, le bouton **Lien client** le copie; avant l'envoi, l'écran dit d'envoyer la soumission pour obtenir un lien de conception client." },
          { figure: "harness:client-kitchen-design", caption: "La vue du client — le nom de l'entreprise, le numéro de la soumission et le nom du client, « Your kitchen », les onglets de pièces et les dimensions des murs, la palette de pièces, le plan, et Save my version." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Ce que le client voit",
        blocks: [
          { bullets: [
            "Un en-tête avec votre logo (ou votre nom) à gauche et **Quote [numéro]** avec son nom à droite. Le pied de page est le nom de votre entreprise. Rien sur la page ne dit FieldQuo.",
            "**Your kitchen** — une invitation, en anglais, à déplacer les éléments et à essayer différents finis; quand il enregistre, [Votre entreprise] reçoit sa version et confirmera le prix.",
            "Les onglets de pièces (Kitchen, Laundry, Closet), la longueur et la hauteur de chaque mur, les vues (Plan, Back, Right, Front, Left, Island Layout) et **Colours & finishes**.",
            "La palette de pièces — armoires du bas, du haut, hautes, de coin, électroménagers et ouvertures — et le plan lui-même, avec sa consigne en anglais : taper une pièce pour la sélectionner, puis la glisser; les caissons s'alignent contre les murs, les coins et entre eux.",
            "Un bouton **Save my version** dans votre couleur. Après l'enregistrement, une ligne en anglais confirme que c'est enregistré, que [Votre entreprise] a été avisée et reviendra avec un prix à jour si quelque chose a changé.",
          ] },
          { note: "La page est toujours claire, comme la soumission elle-même, et elle est en anglais seulement aujourd'hui — un client qui tient une soumission en français reçoit un concepteur en anglais. Elle n'est pas indexée par les moteurs de recherche." },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Ce qu'il ne peut pas faire",
        blocks: [
          { bullets: [
            "**Voir un prix.** Le panneau de tarification que vous utilisez est caché, et les données que la page charge ont chaque tarif et chaque prix d'électroménager retirés — reconstruites champ par champ, pas filtrées.",
            "**Changer un prix.** Ce qui revient est fusionné par-dessus votre dessin : la pièce, la tarification des électroménagers et votre grille de tarifs sont rattachées depuis votre copie, et tout chiffre envoyé par le navigateur est jeté.",
            "**Écraser votre dessin.** Sa version est enregistrée dans son propre champ, avec la date. Votre disposition est intacte tant que vous ne choisissez pas **Charger leur version**.",
            "**Modifier une soumission fermée.** Une fois la soumission acceptée ou refusée, la page dit que c'est la disposition de la soumission et le bouton a disparu.",
          ] },
        ],
      },
      {
        id: "on-your-side",
        heading: "De votre côté",
        blocks: [
          { steps: [
            "Ouvrez la soumission et appuyez sur **Concepteur de cuisine**. Dessinez la pièce, puis envoyez la soumission — le bouton **Lien client** devient actif.",
            "Appuyez sur **Lien client** pour le copier et collez-le dans un message au client.",
            "Quand il enregistre, le courriel **Client design saved — [numéro de soumission]** arrive au créateur de la soumission et à chaque propriétaire et administrateur, avec un lien vers le concepteur.",
            "Dans le concepteur, la bannière **Votre client a enregistré sa propre version de cette disposition le [date]** offre **Charger leur version**. Chargez-la, puis **Enregistrer et retarifer la soumission** — le serveur retarife d'après vos tarifs.",
          ] },
          { warning: "Le dessin d'une soumission envoyée est en lecture seule de votre côté — l'écran le dit. Dupliquez la soumission pour le changer; une soumission envoyée est un engagement, et en retarifer une sous les pieds du client vous laisse tous les deux devant des chiffres différents." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La page client est publique pour quiconque tient le lien. Le bouton **Concepteur de cuisine** apparaît sur une soumission quand votre entreprise a **Conception de cuisine et installations neuves** activé sous Services, ou quand la soumission porte déjà un dessin; l'ouvrir demande un accès en modification aux soumissions. Un concepteur public distinct — **Concevez votre cuisine** dans Partager vos liens — permet à un inconnu de dessiner une cuisine et de l'envoyer comme prospect; voir [[the-kitchen-designer|Le concepteur de cuisine]]." },
        ],
      },
    ],
    faq: [
      { q: "L'enregistrement du client change-t-il le total de ma soumission?", a: "Non. Sa disposition est enregistrée à part. Le total ne change que quand vous chargez sa version et appuyez sur Enregistrer et retarifer la soumission." },
      { q: "Le client peut-il voir ce que coûte chaque armoire?", a: "Non. La page ne reçoit jamais de tarif; il a déjà son total sur la soumission elle-même." },
      { q: "Le client dit que le lien ne fonctionne pas.", a: "Le lien est lié à la soumission envoyée. Si la soumission a été acceptée ou refusée, il est en lecture seule; si elle a été supprimée, la page le dit et lui demande de répondre au courriel dans lequel sa soumission est arrivée." },
    ],
  },

  "the-bio-link-page": {
    title: "La page de lien de profil",
    summary:
      "La seule page derrière l'unique lien qu'Instagram et TikTok permettent : votre logo, un titre, vos comptes, et un bouton pour tout ce que vous offrez — avec une petite ligne Made by FieldQuo dans le pied de page.",
    updated: "2026-09-12",
    intro: [
      "Votre lien de profil est une courte adresse — **fieldquo.com/l/votreentreprise** — qui ouvre une page listant partout où vous pouvez envoyer un visiteur : obtenir un prix, réserver une visite, votre site web, appeler, écrire, laisser un avis. Elle est bâtie pour un écran de téléphone et suit le réglage clair ou sombre du téléphone.",
      "Tout ce qui est au-dessus du pied de page est à vous : logo, couleur, formulation, ordre. Le pied de page porte un lien discret **Made by FieldQuo** à côté de la ligne de droits d'auteur — une décision du propriétaire, parce qu'un menu de liens n'est pas un document que le client lit comme venant de vous, et que chaque menu de ce genre porte le nom de son fabricant.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est désactivée tant que vous n'activez pas **La page est en ligne** sous **Paramètres → Lien de profil**; d'ici là, l'adresse montre une page introuvable. Elle n'est volontairement pas indexée par les moteurs de recherche — un résultat de recherche montrant fieldquo.com sous votre nom dirait à un propriétaire quel logiciel vous utilisez, et le trafic de la page vient d'une bio, pas d'une recherche." },
          { figure: "harness:client-bio-link", caption: "La page de lien de profil — l'initiale de l'entreprise sur sa couleur de marque, le titre, la ligne du site web, la bio, deux icônes sociales, puis les boutons groupés sous Rendez-vous, Plus et Contact." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Ce qu'il y a sur la page",
        blocks: [
          { bullets: [
            "Votre logo, ou votre initiale sur votre couleur de marque.",
            "Le **Titre** — le nom de votre entreprise à moins que vous en ayez écrit un — et, en dessous, votre propre domaine de site web en légende quand vous en avez entré un dans Profil de l'entreprise. (Votre site hébergé fieldquo.com n'y est jamais imprimé : ce serait la fuite que la règle de la marque blanche existe pour empêcher.)",
            "**Une ligne en dessous** — la bio, seulement si vous en avez écrit une. FieldQuo n'en invente pas.",
            "**Suivez-nous** — une rangée d'icônes rondes pour les comptes que vous avez entrés : Instagram, Facebook, TikTok, YouTube, LinkedIn, X.",
            "Les boutons, dans votre ordre, groupés sous **Obtenir un prix**, **Rendez-vous**, **Plus** et **Contact**, chacun s'ouvrant dans un nouvel onglet.",
          ] },
        ],
      },
      {
        id: "the-buttons",
        heading: "Quels boutons existent, et pourquoi certains manquent",
        blocks: [
          { table: {
            head: ["Bouton", "Apparaît quand"],
            rows: [
              ["Obtenir un prix instantané", "Au moins un métier est activé sous Paramètres → Soumissions instantanées."],
              ["Devis gratuit", "Toujours — votre formulaire de demande de soumission."],
              ["Concevez votre cuisine", "Conception de cuisine et installations neuves est activé sous Services."],
              ["Prendre rendez-vous", "Vous avez au moins un type d'événement actif sur la Page de rendez-vous."],
              ["Un bouton par entonnoir publié", "L'état de l'entonnoir est Publié; l'étiquette est le nom de l'entonnoir."],
              ["Voir notre site web", "Vous avez entré un site web dans Profil de l'entreprise, ou votre site FieldQuo est publié — votre propre domaine l'emporte."],
              ["Appeler · Nous écrire", "Un numéro de téléphone ou un courriel est sur la fiche de votre entreprise."],
              ["Écrire sur WhatsApp", "Un numéro de téléphone est au dossier — désactivé par défaut; activez-le."],
              ["Laisser un avis", "Un lien d'avis est enregistré sous Paramètres → Avis."],
              ["Vos propres liens", "Jusqu'à 10 lignes que vous ajoutez avec Ajouter votre propre lien — texte, URL et une icône."],
            ],
          } },
          { note: "L'écran de réglages montre aussi les lignes qui ne sont pas disponibles, grisées, avec l'écran qui les créerait — pour qu'un Prendre rendez-vous manquant se lise comme une prochaine étape, pas comme un bogue. Chaque bouton interne utilise le même identifiant que votre page de rendez-vous, alors une entreprise avec une adresse de rendez-vous personnalisée a une seule adresse pour tout." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Lien de profil**. **Votre lien** est en haut avec Copier et Ouvrir — à coller dans votre bio Instagram ou TikTok.",
            "Écrivez un **Titre** et **Une ligne en dessous**, et remplissez les comptes **Suivez-nous** que vous avez.",
            "Sous **Ce qui figure sur la page**, activez ou désactivez les lignes avec **Afficher sur la page**, renommez le texte de leur bouton, et réordonnez-les en glissant ou avec Monter / Descendre. Ajoutez les vôtres avec **Ajouter votre propre lien**.",
            "Vérifiez l'**Aperçu** dans le cadre de téléphone en clair et en sombre, activez **La page est en ligne**, et appuyez sur **Enregistrer** — rien n'est publié tant que vous ne le faites pas.",
          ] },
          { p: "La page est écrite dans la langue de votre entreprise. Il n'y a pas de sélecteur de langue dessus." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "La page est publique une fois en ligne. **Paramètres → Lien de profil** demande le niveau Manager ou plus — un propriétaire, un administrateur, un Manager ou un Dispatcher." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je retirer Made by FieldQuo du pied de page?", a: "Non. C'est la seule ligne de la page qui n'est pas à vous, tenue au même contraste discret que la ligne de droits d'auteur. Tout ce qui est au-dessus l'est." },
      { q: "Pourquoi n'y a-t-il pas de bouton Prendre rendez-vous?", a: "Vous n'avez aucun type d'événement actif. Créez-en un dans Paramètres → Page de rendez-vous et la ligne apparaît, activée." },
      { q: "La page montre-t-elle l'adresse fieldquo.com de mon site web?", a: "Seulement comme bouton Voir notre site web, et seulement quand vous n'avez pas entré votre propre domaine. La légende sous le titre n'imprime jamais une adresse fieldquo.com." },
    ],
  },

  "a-funnel-as-a-visitor": {
    title: "Un entonnoir",
    summary:
      "Ce que voit quelqu'un qui tape sur votre annonce ou votre lien de profil : une page plein écran, une question à la fois, dans votre couleur, une fourchette instantanée facultative, un court formulaire de contact — et, de votre côté, un prospect coté.",
    updated: "2026-09-12",
    intro: [
      "Un entonnoir est une page d'arrivée à parcourir en tapotant, pour une annonce, un code QR sur un dépliant ou votre lien de profil. Le visiteur voit votre couleur de marque d'un bord à l'autre, votre logo et votre nom, une ligne de progression, et une étape à la fois — la forme des stories Instagram que le trafic publicitaire mobile attend. Il n'y a ni menu, ni pied de page, ni rien qui dise FieldQuo; l'onglet du navigateur porte le nom de votre entreprise.",
      "À la fin, il laisse un nom et un courriel ou un téléphone, et un prospect **Chaud**, **Tiède** ou **Froid** arrive sur votre tableau Prospects avec chaque réponse attachée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les entonnoirs se bâtissent sur l'écran **Entonnoirs** — à partir d'un modèle de canal (Web, Instagram, TikTok, YouTube) ou d'une phrase que vous tapez dans le générateur — et chacun a un état, **Brouillon** ou **Publié**. Seul un entonnoir publié répond à son adresse; un brouillon, ou une mauvaise adresse, affiche que l'entonnoir n'est pas disponible. Le lien et un extrait de code à intégrer pour chaque entonnoir publié sont dans **Paramètres → Partager vos liens**." },
          { figure: "harness:client-funnel", caption: "Un entonnoir à mi-chemin — la couleur de marque plein écran, la ligne de progression, le monogramme et le nom de l'entreprise, Back, et une carte de question à choix unique." },
        ],
      },
      {
        id: "the-steps",
        heading: "Les étapes qu'un visiteur peut rencontrer",
        blocks: [
          { table: {
            head: ["Étape", "Ce que le visiteur voit"],
            rows: [
              ["Intro", "Un titre, une ligne de texte et un bouton — Get started à moins que vous l'ayez nommé."],
              ["Choix unique", "Une question et une liste de réponses; un tapotement fait avancer. Une réponse peut bifurquer vers une étape plus loin."],
              ["Choix multiple", "Cochez-en plusieurs, puis Continue."],
              ["Téléversement de photos", "Ajoutez des photos ou une courte vidéo des travaux, puis Continue."],
              ["Estimation instantanée", "Des tranches de taille; en taper une montre une fourchette de prix que le serveur a calculée d'après vos tarifs — ou, si l'étape est réglée sur les détails d'abord, la fourchette est révélée après le formulaire. Si votre métier est réglé pour ne montrer la fourchette qu'après l'envoi, elle est retenue jusque-là."],
              ["Formulaire", "« Where should we send it? » — nom, courriel, téléphone. Un nom et l'un de courriel ou téléphone sont requis."],
              ["Merci", "Votre titre et votre texte de clôture, ou un simple « Thanks! »."],
            ],
          } },
          { note: "Les mots de chaque étape sont les vôtres — écrits dans le générateur ou rédigés par le générateur — alors l'entonnoir est dans la langue dans laquelle vous l'avez écrit. Les éléments intégrés (le lien Back et les espaces réservés Your name / Email / Phone du formulaire) sont en anglais." },
        ],
      },
      {
        id: "what-happens-on-submit",
        heading: "Ce qui se passe quand il envoie",
        blocks: [
          { bullets: [
            "Un prospect est créé dans le pipeline normal — pas une sorte à part — avec la source **funnel**, chaque réponse en champ structuré, les photos, et une ligne de message par question.",
            "Une question que vous avez marquée **budget** ou **timeline** dans le générateur alimente directement le coteur; le prospect se lit Chaud, Tiède ou Froid dans **Prospects** comme n'importe quel autre. Voir [[lead-scoring-hot-warm-cold|Cote des prospects]].",
            "Les gens qui reçoivent les notifications de prospects sont avertis. Un numéro de téléphone est enregistré comme un consentement à être rappelé.",
            "Si vous avez entré un pixel Meta, un pixel TikTok ou un identifiant GA4 dans le générateur, la page déclenche une vue de page au chargement et un événement de prospect seulement **après** que le serveur a accepté l'envoi — jamais pour un envoi refusé.",
            "Une balise de vue d'étape est enregistrée à mesure que chaque étape est atteinte, et c'est ce que le rapport d'abandon du générateur compte. Elle est anonyme — un identifiant par visite, pas une personne.",
          ] },
          { p: "FieldQuo n'envoie pas au visiteur une copie de ce qu'il a envoyé, et l'entonnoir ne montre aucun prix à moins d'avoir une étape d'estimation instantanée. Rien ici ne retarife quoi que ce soit : une fourchette instantanée vient de vos tarifs sur le serveur et est marquée comme à réviser avant qu'une soumission parte." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { steps: [
            "Dans **Entonnoirs**, appuyez sur **Nouvel entonnoir** et choisissez un modèle de canal, ou décrivez l'entonnoir et appuyez sur **Générer**.",
            "Dans le générateur, modifiez les mots et les réponses de chaque étape, marquez les questions de budget et d'échéancier, réglez une étape d'estimation instantanée sur prix d'abord ou détails d'abord, et ajoutez vos identifiants de pixel.",
            "Publiez-le. Copiez son lien depuis le générateur ou depuis **Paramètres → Partager vos liens**; la page de lien de profil reçoit un bouton pour lui automatiquement.",
            "Revenez au générateur pour le rapport d'abandon — combien ont atteint chaque étape et où ils sont partis.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Un entonnoir publié est public pour quiconque a le lien, et volontairement pas indexé. L'écran **Entonnoirs** est pour les propriétaires, les administrateurs, les Managers et les Dispatchers; dans **Partager vos liens**, les autres voient « Les entonnoirs de prospects sont gérés par un propriétaire ou un administrateur — demandez-leur le lien. » Les prospects sont visibles par quiconque a un accès qui inclut les demandes." },
        ],
      },
    ],
    faq: [
      { q: "L'entonnoir montre-t-il mes prix?", a: "Seulement si vous avez ajouté une étape d'estimation instantanée, et alors seulement une fourchette calculée sur le serveur d'après vos tarifs — jamais la grille de tarifs. Chaque estimation de ce genre est signalée pour votre révision avant qu'une soumission soit envoyée." },
      { q: "Puis-je mettre un entonnoir sur mon site web existant?", a: "Oui — Partager vos liens a un extrait de code à intégrer pour chaque entonnoir publié. Dans votre propre page, le bandeau de logo est retiré, puisque votre site porte déjà votre nom." },
      { q: "Où vont les réponses?", a: "Sur le prospect dans Prospects, comme champs que vous pouvez lire et comme note par question, avec les photos jointes. Convertissez-le en soumission à partir de là." },
    ],
  },

  "the-texts-clients-receive": {
    title: "Les textos que reçoivent les clients",
    summary:
      "Les deux textos automatisés qu'un client peut recevoir — En route et un rappel de rendez-vous — ce qu'ils disent, dans quelle langue, de quel numéro, comment STOP fonctionne, et tout ce que FieldQuo ne texte pas.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo envoie à un client exactement deux sortes de textos : **En route**, quand un équipier tape cet état sur une visite de chantier, et un **rappel de rendez-vous** avant un rendez-vous réservé ou une visite de chantier planifiée. Les deux commencent par le nom de votre entreprise, les deux partent dans la langue du client, et les deux respectent une réponse STOP. C'est toute la liste — soumissions, factures, confirmations de rendez-vous et demandes d'avis partent par courriel.",
      "Les rappels sont désactivés tant que vous ne choisissez pas un délai sous **Paramètres → Notifications**. Rien n'est facturé par texto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque texto part du numéro de textos propre à votre entreprise si vous en avez un, sinon d'un numéro FieldQuo partagé — c'est pourquoi chaque message commence par le nom de votre entreprise : sur une ligne partagée, le nom dans le corps est ce qui dit au client qui lui écrit. Rien dans le message ne dit FieldQuo." },
          { figure: "live:app-settings-messages", caption: "Paramètres → Messages aux clients — un éditeur par type de texto, les champs qu'il accepte, un aperçu « Votre client voit : », et Enregistrer." },
          { note: "**Rappels de rendez-vous** est marqué partiel dans la propre liste de fonctions de FieldQuo : les rappels partent par texto seulement — il n'y a pas de rappel par courriel. La formulation des deux textos se modifie dans Paramètres → Messages aux clients." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "Les deux textos",
        blocks: [
          { table: {
            head: ["Texto", "Formulation intégrée (français)", "Quand il est envoyé"],
            rows: [
              ["En route", "« [Entreprise] : [Employé] est en route, arrivée dans 20 min. Pour reporter, appelez le [téléphone]. »", "Dès qu'un équipier met une visite de chantier à En route. L'heure d'arrivée est calculée d'après l'endroit où était son téléphone quand il a tapé jusqu'à l'adresse du chantier, arrondie aux cinq minutes, et omise quand l'un ou l'autre bout est inconnu. La ligne du téléphone est retirée si votre entreprise n'a pas de téléphone au dossier."],
              ["Rappel de rendez-vous", "« [Entreprise] : Rappel — votre rendez-vous est mar. 15 sept., 14 h 00 au 123, rue des Chênes. Répondez STOP pour ne plus recevoir. »", "Une fois, à l'intérieur du délai que vous avez choisi (2, 24 ou 48 heures avant), pour un rendez-vous réservé ou une visite de chantier planifiée qui n'est ni annulée ni terminée. Vérifié chaque heure."],
            ],
          } },
          { p: "L'heure dans un rappel est écrite dans le fuseau horaire de votre entreprise et dans le format de date du client. Le mot STOP reste en anglais dans chaque langue, parce que STOP est le mot-clé que les opérateurs et le traitement des réponses reconnaissent." },
          { warning: "Les réponses à ces textos ne sont lues par personne. Le texto En route pointe vers votre numéro de téléphone pour une raison : un client qui répond « on peut faire 15 h à la place? » parle à personne. Seuls STOP et START sont traités." },
        ],
      },
      {
        id: "language",
        heading: "Quelle langue reçoit un client",
        blocks: [
          { p: "Le texto suit la langue du client comme sa soumission l'a fait — les huit langues de clients dans lesquelles FieldQuo écrit des documents (anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand, italien); toute autre lit l'anglais. Si vous avez réécrit un message dans **Paramètres → Messages aux clients**, votre formulation va aux clients qui lisent la langue de votre entreprise; un client dont la langue est différente reçoit la formulation intégrée de FieldQuo dans la sienne. FieldQuo ne traduit pas votre phrase automatiquement." },
        ],
      },
      {
        id: "stop-and-start",
        heading: "STOP, et reprendre",
        blocks: [
          { bullets: [
            "Une réponse **STOP** (ou STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT — un point ou un point d'exclamation à la fin est ignoré) retire ce numéro de téléphone. Aucun des deux textos ne lui est plus envoyé, et un numéro qui a refusé les appels se voit aussi refuser les textos.",
            "**START** ou **UNSTOP** annule le retrait des textos. Ça ne rétablit jamais le consentement aux appels, qui est volontairement à sens unique.",
            "Sur le numéro FieldQuo partagé, un STOP retire le numéro de chaque entreprise qui le détient sur une fiche client — la seule lecture honnête d'un « arrêtez de me texter » envoyé à une ligne qui texte pour plusieurs.",
            "La barrière est vérifiée au moment de chaque envoi, pour les deux textos, à un seul endroit.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Notifications → Rappels de rendez-vous** et choisissez **Désactivé**, **2 heures avant**, **24 heures avant** ou **48 heures avant**. Désactivé est la valeur par défaut; une entreprise qui n'a jamais choisi de délai n'envoie aucun rappel.",
            "Ouvrez **Paramètres → Messages aux clients** pour reformuler l'un ou l'autre texto. Seuls les champs affichés fonctionnent — {company}, {worker}, {name}, {eta}, {phone} pour En route; {company}, {when}, {location} pour le rappel. Un champ inconnu est refusé à l'enregistrement, et un message de plus de 320 caractères est signalé parce qu'il coûte trois segments.",
            "Lisez **Votre client voit :** sous l'éditeur — c'est la chaîne exacte qui partira — puis **Enregistrer**, ou **Utiliser le texte par défaut** pour revenir à la formulation de FieldQuo.",
          ] },
          { p: "Un équipier envoie En route depuis la visite de chantier sur son téléphone; personne n'a à se rappeler de texter. Il n'y a pas de bouton pour envoyer un rappel à la main, et une visite est rappelée au plus une fois." },
        ],
      },
      {
        id: "what-is-not-texted",
        heading: "Ce que FieldQuo ne texte pas",
        blocks: [
          { bullets: [
            "Une confirmation de rendez-vous — elle part par courriel, de votre entreprise, quand une visite est réservée sur votre page de rendez-vous.",
            "Une soumission, une facture, une relance de facture en retard ou un message « votre chantier est terminé » — courriel seulement.",
            "Une demande d'avis — courriel seulement, et seulement à un client qui a une adresse courriel.",
            "Un texto de la réceptionniste téléphonique — elle lit un lien de rendez-vous à voix haute; elle ne peut pas le texter aujourd'hui.",
          ] },
          { p: "Tout le détail sur ce qui est automatisé et ce qui ne l'est pas : [[texting-clients-what-is-and-is-not-automated|Texter les clients : ce qui est automatisé et ce qui ne l'est pas]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "**Paramètres → Notifications** est réservé au propriétaire et aux administrateurs. **Paramètres → Messages aux clients** demande le niveau Manager ou plus — un propriétaire, un administrateur, un Manager ou un Dispatcher. Tout équipier assigné à une visite peut déclencher En route depuis son téléphone." },
        ],
      },
    ],
    faq: [
      { q: "Un texto me coûte-t-il quelque chose?", a: "Non. Les textos aux clients sont compris dans votre forfait et rien n'est facturé par message. (La ligne de textos de l'équipe et la réceptionniste téléphonique sont à part et comptées.)" },
      { q: "Pourquoi un client n'a-t-il pas reçu de rappel?", a: "L'une de ces raisons : les rappels sont Désactivé sous Paramètres → Notifications; le client n'a pas de numéro de téléphone; le rendez-vous est annulé ou terminé; il a déjà été rappelé une fois; ou le numéro a répondu STOP." },
      { q: "Le client peut-il répondre pour reporter?", a: "Pas par texto — les réponses ne sont pas lues. Le texto En route donne votre numéro de téléphone pour ça; une visite réservée sur votre page de rendez-vous a aussi son propre lien de gestion par courriel." },
      { q: "Le texto vient-il de mon numéro?", a: "De votre propre numéro de textos si votre entreprise en a un; sinon d'un numéro FieldQuo partagé, avec le nom de votre entreprise au début du message." },
    ],
  },
};
