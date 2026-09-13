// content/help/fr/billing-and-subscription-1.js
//
// Partie 1 de la catégorie « billing-and-subscription » en français (voir le
// composeur, billing-and-subscription.js). Même structure que l'anglais,
// article par article : mêmes slugs, mêmes sections dans le même ordre, mêmes
// blocs, mêmes figures — scripts/check-help-centre.mjs compare les deux. Les
// mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js; les
// chiffres, de lib/pricing/ladder.js, lib/pricing.js, lib/billing/access.js,
// lib/billing/renewalReminder.js et lib/referrals.
export const ARTICLES = {
  "your-plan-and-seats": {
    title: "Votre forfait et vos sièges",
    summary:
      "L'écran Compte et facturation : le forfait que vous avez, ce qu'il coûte, combien de sièges et d'accès d'équipiers il comprend, quand tombe le prochain prélèvement, et les quatre boutons en dessous.",
    updated: "2026-09-12",
    intro: [
      "**Compte et facturation** est le seul écran qui parle de la relation entre votre entreprise et FieldQuo — le forfait, le prix, la carte, le prochain prélèvement. Tout le reste de FieldQuo concerne l'argent de vos clients; cette page concerne le vôtre. On y arrive par **Forfait** au bas de la barre latérale, ou par **Paramètres → Compte et facturation**.",
      "Cet article parcourt l'écran de haut en bas : la carte du forfait et ce que veut dire chaque ligne, les quatre boutons, puis la grille **Forfaits** en dessous. Changer de forfait, ajouter des gens et mettre la carte à jour ont chacun leur article, lié au fil du texte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Votre entreprise est sur l'un de quatre forfaits — Solo, Crew, Shop ou Scale — et le forfait fixe deux nombres : combien de **sièges** vous avez (les gens qui créent ou modifient des soumissions, des chantiers et des factures) et combien d'accès d'**équipiers** viennent gratuitement avec. Rien d'autre ne change d'un forfait à l'autre : chaque fonction est dans chaque forfait. Voir [[the-four-plans|Les quatre forfaits]]." },
          { p: "L'abonnement est facturé par Stripe pour le compte de FieldQuo, dans votre propre devise, chaque mois ou sur un engagement d'un an. C'est une relation Stripe distincte de celle par laquelle vos clients vous paient — celle-là vit dans **Paramètres → Paiements**, et la page vous y donne un raccourci pour que les deux ne soient jamais confondues." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — la carte du forfait avec sa pastille d'état et les quatre boutons, puis la grille Forfaits avec le sélecteur Mensuel / Engagement d'un an." },
          { p: "Sous le titre **Compte et facturation — Votre forfait, vos sièges et vos informations de paiement.**, la carte du forfait indique par exemple **Crew · Actif · 169,00 $/mois · 3 sièges · 8 équipiers inclus gratuitement · Prochaine date de facturation 2026-09-30**. Chaque morceau de cette ligne est un fait tiré de votre abonnement, et le tableau ci-dessous dit d'où il vient." },
          { table: {
            head: ["Sur la carte", "Ce que ça veut dire"],
            rows: [
              ["Le nom du forfait (Solo, Crew, Shop, Scale)", "Le palier où vous êtes aujourd'hui. Si un changement est programmé pour plus tard, c'est encore le forfait que vous avez maintenant qui est nommé."],
              ["La pastille d'état", "**Trial** pendant votre mois gratuit (la pastille reste en anglais aujourd'hui), **Actif** une fois que vous payez, **En retard** après un paiement refusé (un délai de grâce court — voir [[failed-payments-and-the-grace-period|Paiements refusés et délai de grâce]]), **Annulé** après votre départ."],
              ["Le prix", "Affiché à la fréquence à laquelle vous êtes vraiment facturé — **169,00 $/mois** au mois, ou le montant annuel suivi de **/an** et de **Engagement d'un an** si vous avez pris l'année."],
              ["Sièges et équipiers", "**3 sièges · 8 équipiers inclus gratuitement** — ce que le forfait permet, pas le nombre de gens que vous avez. Gérer l'équipe montre le compte que vous utilisez."],
              ["Jours restants dans l'essai", "Seulement pendant le mois gratuit : **Jours restants dans l'essai : 12**, en décompte jusqu'au premier prélèvement."],
              ["Prochaine date de facturation", "Le jour où Stripe prélève la carte au dossier pour la prochaine période. Pas affichée pendant l'essai, qui montre le décompte à la place."],
            ],
          } },
        ],
      },
      {
        id: "the-four-buttons",
        heading: "Les quatre boutons",
        blocks: [
          { bullets: [
            "**Vérifier auprès de Stripe** — demande à Stripe l'état réel de votre abonnement et le note. Appuyez dessus si la page affiche **Aucun forfait actif** juste après avoir payé : le retour de la page de paiement arrive parfois avant la confirmation de Stripe, et ce bouton comble l'écart. Rien n'est facturé en appuyant dessus.",
            "**Gérer la facturation et le mode de paiement** — ouvre le portail de facturation de Stripe dans le même onglet : changez la carte, et lisez ou téléchargez chaque facture que FieldQuo vous a émise. Vous revenez sur cette page quand vous le fermez. Voir [[update-your-payment-method|Mettre à jour votre mode de paiement]].",
            "**Voir ce que mes clients m'ont payé** — un raccourci vers **Paramètres → Paiements**, l'autre Stripe : votre propre compte connecté, où vit l'argent que vos clients vous ont payé. Il est sur cette page parce que c'est ici que les gens cherchent « mon argent », mais rien de votre abonnement ne s'y trouve.",
            "**Annuler le forfait** — ouvre le parcours d'annulation. Il demande pourquoi avant de faire quoi que ce soit; voir [[cancel-your-subscription|Annuler votre abonnement]] pour ce qui arrive à votre accès et à vos données.",
          ] },
          { note: "Si un changement de forfait est programmé pour la fin de votre période, une carte ambrée apparaît entre la ligne du forfait et les boutons : **Passage à Solo (facturé mensuellement) le 2026-10-01 — D'ici là, vous conservez Crew (facturé mensuellement). Rien n'est facturé avant cette date.** Son bouton **Garder mon forfait actuel** annule la programmation. Détails dans [[change-your-plan|Changer de forfait]]." },
        ],
      },
      {
        id: "the-plans-grid",
        heading: "La grille Forfaits",
        blocks: [
          { p: "Sous **Forfaits**, un sélecteur **Mensuel** / **Engagement d'un an** et une carte par palier, chacune avec son prix, sa ligne de sièges et d'équipiers, **FieldQuo AI inclus**, et un bouton. La carte où vous êtes indique **Forfait actuel** et est grisée; les autres indiquent **Choisir ce forfait**. Avec le sélecteur sur l'année, le bouton de votre propre palier indique plutôt **Passer à l'année**, parce que prendre l'engagement est un vrai changement même si le palier ne bouge pas." },
          { p: "Le sélecteur démarre sur la fréquence à laquelle vous êtes déjà facturé, et le basculer ne fait que retarifer les cartes — la ligne du forfait au-dessus ne bouge pas tant que vous n'avez pas vraiment confirmé un changement. La grille montre l'échelle dans votre devise seulement : dollars canadiens pour une adresse au Canada, dollars américains pour une adresse aux États-Unis. Une entreprise dont l'adresse n'a pas de pays voit une invitation à l'ajouter au lieu d'une liste de prix." },
          { tip: "Chaque carte porte les mots **1 siège · 5 équipiers inclus gratuitement**, **3 sièges · 8 équipiers inclus gratuitement**, et ainsi de suite. Comparez-les à la ligne **sièges utilisés** de **Gérer l'équipe** avant de monter de forfait — les équipiers que vous avez déjà entrent peut-être dans le forfait actuel." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Seulement un **propriétaire** ou un **administrateur** — la personne qui a inscrit l'entreprise, ou quiconque a été nommé administrateur avec la case **Nommer administrateur** de son accès. Tous les autres n'ont pas de ligne **Forfait** dans la barre latérale ni de ligne **Compte et facturation** dans Paramètres, et taper l'adresse affiche un refus, pas la page. Le préréglage Manager n'inclut pas la facturation, volontairement : gérer le quotidien n'est pas une autorité sur la carte de l'entreprise." },
          { p: "Le refus est appliqué par le serveur à chaque action, pas seulement en cachant les boutons — un superviseur qui appelle directement les routes de facturation reçoit **Only an owner or admin can change the plan or billing details.**" },
        ],
      },
    ],
    faq: [
      { q: "La page dit Aucun forfait actif, mais j'ai payé il y a une minute.", a: "Appuyez sur **Vérifier auprès de Stripe**. La page le fait aussi d'elle-même quand vous revenez de la page de paiement, mais une confirmation lente peut la devancer. Rien n'est facturé deux fois." },
      { q: "Pourquoi n'y a-t-il pas de Prochaine date de facturation sur ma carte?", a: "Vous êtes encore dans votre mois gratuit, et la carte affiche **Jours restants dans l'essai** à la place. Le premier prélèvement tombe le jour où ce compte arrive à zéro." },
      { q: "Où est l'argent que mes clients m'ont payé?", a: "Pas ici. Appuyez sur **Voir ce que mes clients m'ont payé**, qui ouvre **Paramètres → Paiements** — votre propre compte Stripe connecté, vos virements et vos frais. Voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et virements]]." },
      { q: "Ma responsable de bureau peut-elle ouvrir cette page?", a: "Seulement si elle est administratrice. Cochez **Nommer administrateur** sur son accès dans **Gérer l'équipe**; cela lui permet aussi de changer le forfait et la carte, alors donnez-le à la personne qui paie vraiment la facture." },
    ],
  },

  "the-four-plans": {
    title: "Les quatre forfaits : Solo, Crew, Shop, Scale",
    summary:
      "Ce que coûte chaque forfait, combien de sièges et d'accès d'équipiers gratuits il comprend, ce qu'est vraiment un siège, et pourquoi rien d'autre ne diffère entre les quatre.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo vend quatre forfaits, et ils diffèrent par exactement trois choses : le prix mensuel, le nombre de sièges et le nombre d'accès d'équipiers inclus gratuitement. Chaque fonction — soumissions, planification, facturation, paiement en ligne, générateur de site web, FieldQuo AI, paie — est dans les quatre. Il n'y a pas de palier où ce dont vous avez besoin se trouve deux échelons plus haut.",
      "Cet article est la liste de prix et les définitions derrière : ce qui compte comme un siège, ce qui compte comme un équipier, et comment savoir quel forfait convient aux gens que vous avez vraiment.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Forfait", "Par mois", "Par année (engagement d'un an)", "Sièges", "Accès d'équipiers, gratuits"],
            rows: [
              ["Solo", "99 $", "990 $", "1", "5"],
              ["Crew", "169 $", "1 690 $", "3", "8"],
              ["Shop", "269 $", "2 690 $", "6", "11"],
              ["Scale", "369 $", "3 690 $", "10", "15"],
            ],
          } },
          { p: "Le même nombre dans l'une ou l'autre devise : une entreprise canadienne paie ces montants en dollars canadiens, une entreprise américaine les paie en dollars américains. La devise dans laquelle vous êtes facturé est décidée par l'adresse de votre entreprise, jamais par un sélecteur — voir [[taxes-and-currency-on-your-subscription|Taxes et devise de votre abonnement]]. Le prix annuel, c'est dix mois pour douze; voir [[monthly-or-a-year-commitment|Au mois, ou un engagement d'un an]]." },
          { figure: "harness:plan", caption: "Compte et facturation — les quatre cartes de forfait, chacune avec sa ligne de sièges et d'équipiers, FieldQuo AI inclus, et Choisir ce forfait ou Forfait actuel." },
        ],
      },
      {
        id: "what-a-seat-is",
        heading: "Ce qu'est un siège",
        blocks: [
          { p: "Un **siège**, c'est une personne dont l'accès lui permet de créer ou de modifier de l'argent : des soumissions, des chantiers, des factures, ou les demandes qui deviennent des soumissions. Le propriétaire est toujours un siège. Les administrateurs aussi, et quiconque est sur les préréglages **Estimator**, **Dispatcher** ou **Manager**, parce que chacun d'eux peut écrire une soumission." },
          { p: "Un siège se compte d'après ce que la personne peut réellement faire, pas d'après le nom de son niveau d'accès. Si vous commencez quelqu'un sur Crew puis montez un seul curseur au-dessus de ce que Crew permet — disons, le laisser créer des soumissions — il devient un siège, et **Gérer l'équipe** l'affiche. C'est ce qui garde le compte honnête dans les deux sens : un chef d'équipe que vous promouvez est un siège, et un peintre que vous n'avez jamais promu n'en est pas un." },
        ],
      },
      {
        id: "what-crew-is",
        heading: "Ce qu'est un accès d'équipier",
        blocks: [
          { p: "Un accès d'**équipier**, c'est tous les autres : les gens dans le camion qui voient leur propre horaire, pointent à l'arrivée et au départ, marquent le travail terminé, ajoutent des photos et utilisent le clavardage d'équipe. Ils ne voient aucun prix et ne peuvent pas créer de soumissions, de chantiers ni de factures. Les accès d'équipiers ne coûtent rien et n'utilisent jamais de siège — un forfait Solo, c'est un estimateur et jusqu'à cinq personnes sur le terrain pour 99 $." },
          { p: "Gratuit ne veut pas dire illimité. Chaque forfait comprend un nombre fixe de places d'équipiers, et un équipier peut aussi occuper un siège que vous n'utilisez pas : Scale, c'est 10 sièges plus 15 équipiers, alors un atelier avec deux personnes au bureau et vingt techniciens y entre — deux au bureau et huit sur le terrain dans des sièges, les douze autres dans des places d'équipiers. Ça ne marche que dans ce sens : un détenteur de siège ne peut pas être casé dans une place d'équipier." },
          { note: "Le préréglage Crew est fixe, volontairement — choisissez-le et il n'y a pas de grille à déplacer. Tout ce qui est au-dessus est un siège, quel que soit le chemin pris, pour que personne ne puisse fabriquer un estimateur gratuit à la main." },
        ],
      },
      {
        id: "which-plan-fits",
        heading: "Quel forfait convient",
        blocks: [
          { steps: [
            "Comptez les gens qui chiffrent des travaux ou écrivent des factures, vous compris. C'est votre nombre de sièges.",
            "Comptez tous les autres qui ont besoin d'un accès — l'équipe sur le terrain. Ce sont les accès d'équipiers.",
            "Choisissez le plus petit forfait dont les sièges couvrent le premier nombre et dont les sièges plus les équipiers couvrent le total. Un estimateur et quatre peintres, c'est Solo; trois estimateurs et huit équipiers, c'est Crew; un atelier avec six personnes au bureau et onze sur le terrain, c'est Shop.",
            "Plus de dix sièges, ou plus de vingt-cinq personnes en tout, dépasse les forfaits vendus en ligne — la page d'inscription affiche **Il vous faut plus que Scale?** et vous invite à nous écrire.",
          ] },
          { tip: "FieldQuo AI — le copilote qui répond aux questions sur votre propre entreprise — est inclus dans chaque forfait; les cartes indiquent **FieldQuo AI inclus**. Les minutes téléphoniques de la réceptionniste et les images IA sont comptées à part, contre du crédit que vous achetez; voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]." },
        ],
      },
      {
        id: "what-does-not-change",
        heading: "Ce qui ne change pas d'un forfait à l'autre",
        blocks: [
          { bullets: [
            "**Les fonctions.** Les 76 fonctions de la propre liste de FieldQuo sont marquées disponibles dans chaque forfait. Il n'y a aucune fonction à débloquer en montant de forfait.",
            "**Les frais de carte et de débit bancaire.** Les frais de traitement sur un paiement en ligne d'un client sont les mêmes dans chaque forfait — voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et virements]].",
            "**La marque blanche.** Vos soumissions, factures, page de rendez-vous et courriels portent votre nom et vos couleurs dans chaque forfait, pas comme une option payante.",
            "**Le soutien et le centre d'aide.** Les mêmes pour une entreprise Solo que pour une entreprise Scale.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je acheter un seul siège de plus au lieu de monter de forfait?", a: "Non. Les quatre forfaits sont toute la liste de prix; quand vous avez utilisé chaque siège, le forfait suivant est la façon d'en ajouter un. **Gérer l'équipe** vous dit lequel." },
      { q: "Une personne désactivée utilise-t-elle encore un siège?", a: "Non. Seuls les membres actifs comptent — un compte désactivé ne peut pas écrire de soumission, alors il n'est pas facturé comme un siège." },
      { q: "J'ai plus de sièges en usage que mon forfait n'en comprend. Suis-je bloqué?", a: "Non. La limite vous empêche d'ajouter un autre siège; elle n'en retire jamais un que vous détenez déjà. Tout le monde continue de travailler, et Gérer l'équipe indique **Limite de votre forfait atteinte** jusqu'à ce que vous montiez de forfait ou remettiez quelqu'un sur Crew." },
      { q: "Est-ce moins cher en dollars américains?", a: "Non. Les nombres sont identiques dans les deux devises, et votre adresse décide dans laquelle vous payez." },
    ],
  },

  "free-first-month": {
    title: "Votre premier mois est gratuit",
    summary:
      "Comment fonctionne le mois gratuit à l'inscription, pourquoi une carte est quand même demandée, ce que l'écran affiche pendant l'essai, et exactement ce qui se passe le jour où il se termine.",
    updated: "2026-09-12",
    intro: [
      "Chaque nouvelle entreprise a son premier mois de FieldQuo gratuit — tout le produit, sur le forfait que vous avez choisi, sans aucun prélèvement pendant 30 jours. Votre carte est prise à la page de paiement pour que le forfait continue simplement quand le mois se termine; rien n'est facturé avant, et la page le dit en toutes lettres.",
      "Cet article dit ce qu'est l'essai, ce que vous voyez pendant qu'il court, quand on vous le rappelle, et ce qui se passe au jour 30 — y compris si la carte ne passe pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le mois gratuit est un essai Stripe sur un vrai abonnement. Vous choisissez un forfait et une fréquence à la dernière étape de l'inscription, entrez une carte sur la page de paiement de Stripe, et l'abonnement démarre à l'état **Trial** avec un essai de 30 jours. Le jour où l'essai se termine, Stripe prélève la carte pour la première période — le prix mensuel, ou le prix annuel complet si vous avez pris l'engagement — et l'état devient **Actif**." },
          { p: "C'est gratuit, pas un dollar symbolique : l'offre sur chaque écran se lit **Premier mois gratuit**, et aucune ligne ponctuelle n'apparaît à la page de paiement. Un parrainage par une autre entreprise FieldQuo ajoute un mois de plus à l'essai avant le premier prélèvement — voir [[referral-months|Mois de parrainage]]." },
        ],
      },
      {
        id: "how-it-works-at-signup",
        heading: "Comment ça marche à l'inscription",
        blocks: [
          { figure: "harness:signup", caption: "Commencez votre essai gratuit — les quatre étapes, et la carte à droite qui dit que la carte est prise à la page de paiement et que le premier prélèvement tombe à la fin du mois gratuit." },
          { steps: [
            "Remplissez **Votre compte et votre entreprise** — nom, courriel, entreprise, adresse. Le pays de votre adresse fixe votre devise de facturation.",
            "Choisissez vos métiers et vos services aux étapes 2 et 3.",
            "Dans **Choisissez votre forfait**, prenez un palier et répondez à **Comment souhaitez-vous être facturé?** — **Sans engagement** ou **Engagement d'un an**. La ligne en dessous se lit par exemple **Premier mois gratuit, puis 99,00 $/mois.**",
            "Appuyez sur **Continuer vers le paiement**. La page de Stripe prend votre carte et votre adresse de facturation et affiche l'essai; vous n'êtes pas facturé. Vous arrivez dans FieldQuo avec le forfait déjà actif.",
          ] },
          { note: "Une carte est requise pour commencer l'essai. C'est une décision délibérée : ça veut dire que le produit continue de fonctionner au jour 31 sans deuxième passage à la caisse, et c'est pourquoi l'essai peut être un mois complet du vrai produit plutôt qu'une démo." },
        ],
      },
      {
        id: "what-you-see-during-the-trial",
        heading: "Ce que vous voyez pendant l'essai",
        blocks: [
          { p: "Dans **Compte et facturation**, la carte du forfait porte une pastille **Trial** (en anglais, pour l'instant) et, sous le prix, **Jours restants dans l'essai : 23** en décompte. Il n'y a pas encore de **Prochaine date de facturation** — le décompte est cette date. Tout le reste de l'écran fonctionne comme après l'essai, y compris **Choisir ce forfait** : monter de forfait pendant le mois gratuit prend effet tout de suite et reste gratuit jusqu'à la fin du mois, parce que l'essai est gardé là où il était. Voir [[change-your-plan|Changer de forfait]]." },
          { p: "Vous recevez aussi un courriel de confirmation quand l'abonnement devient actif, qui nomme le forfait, **Status: Free trial** et **Trial ends** avec la date." },
        ],
      },
      {
        id: "when-the-month-ends",
        heading: "Quand le mois se termine",
        blocks: [
          { bullets: [
            "**Sept jours avant** le premier prélèvement, FieldQuo envoie au propriétaire un rappel par courriel qui nomme le forfait, le montant, la date et les quatre derniers chiffres de la carte s'ils sont connus. Voir [[renewal-reminders|Rappels de renouvellement]].",
            "**Le jour même**, Stripe prélève la carte. La pastille d'état passe à **Actif** et la carte affiche **Prochaine date de facturation** un mois (ou un an) plus tard.",
            "**Si le prélèvement échoue**, l'état devient **En retard** et un délai de grâce de 7 jours commence : vous pouvez encore tout lire, mais rien ajouter, jusqu'à ce que la carte soit réparée avec **Gérer la facturation et le mode de paiement**. Après les sept jours, le compte est verrouillé sur l'écran de facturation jusqu'à ce que ce soit payé. Rien n'est supprimé à aucun moment. Voir [[failed-payments-and-the-grace-period|Paiements refusés et délai de grâce]].",
          ] },
          { warning: "Annuler pendant le mois gratuit arrête le premier prélèvement, mais met fin à votre accès aux mêmes conditions que n'importe quelle annulation — lisez [[cancel-your-subscription|Annuler votre abonnement]] avant d'appuyer sur **Annuler le forfait** au jour 29 en espérant une journée gratuite de plus." },
        ],
      },
    ],
    faq: [
      { q: "Le premier mois est-il vraiment gratuit, ou c'est 1 $?", a: "Gratuit. Le prix du premier mois est zéro, la page de paiement n'affiche aucun frais pour lui, et l'écran d'inscription se lit **Premier mois gratuit**." },
      { q: "Le mois gratuit s'applique-t-il aussi au forfait annuel?", a: "Oui. Le mois vient d'abord, puis l'année : aucun prélèvement pendant 30 jours, puis le montant annuel complet, et l'année commence à ce prélèvement." },
      { q: "J'ai été parrainé par un autre entrepreneur — combien de temps dure mon essai?", a: "30 jours plus un mois de parrainage, et le rappel et le premier prélèvement se décalent d'autant. La confirmation après l'inscription nomme l'entreprise qui vous a parrainé." },
      { q: "Puis-je l'essayer sans carte?", a: "Non. L'inscription prend une carte à la page de paiement avant que l'essai commence. Elle n'est pas facturée avant la fin du mois gratuit, et vous pouvez annuler avant." },
    ],
  },

  "monthly-or-a-year-commitment": {
    title: "Au mois, ou un engagement d'un an",
    summary:
      "Les deux façons de payer : mois par mois sans engagement, ou une année payée d'avance au prix de dix mois — et ce que veut dire passer de l'une à l'autre.",
    updated: "2026-09-12",
    intro: [
      "Chaque forfait peut être payé de deux façons. **Mensuel**, c'est sans engagement : le forfait se renouvelle chaque mois et vous pouvez partir n'importe quand. **Engagement d'un an**, c'est un seul prélèvement pour douze mois au prix de dix — deux mois gratuits — en échange de l'engagement pour l'année.",
      "Vous choisissez à l'inscription, et vous pouvez changer d'idée plus tard depuis **Compte et facturation**. Cet article met les deux prix côte à côte, explique le sélecteur à l'écran, et dit clairement ce que veut dire le mot engagement une fois l'année prélevée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Forfait", "Mensuel", "Engagement d'un an", "Soit", "Vous économisez"],
            rows: [
              ["Solo", "99 $ par mois", "990 $ par année", "82,50 $ par mois", "198 $ par année"],
              ["Crew", "169 $ par mois", "1 690 $ par année", "140,83 $ par mois", "338 $ par année"],
              ["Shop", "269 $ par mois", "2 690 $ par année", "224,17 $ par mois", "538 $ par année"],
              ["Scale", "369 $ par mois", "3 690 $ par année", "307,50 $ par mois", "738 $ par année"],
            ],
          } },
          { p: "L'économie est exprimée en mois plutôt qu'en pourcentage parce que c'est ce que vous pouvez vérifier de tête : payez pour dix, recevez douze. Les cartes de forfait le disent en argent — **Économisez 198 $ par an** sous la carte Solo, avec **82,50 $ par mois** sous le prix annuel — et les mêmes chiffres apparaissent à l'étape d'inscription sous la forme **Économisez 198 $ par an — deux mois gratuits.**" },
        ],
      },
      {
        id: "the-switch-on-the-screen",
        heading: "Le sélecteur à l'écran",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — le sélecteur Mensuel / Engagement d'un an au-dessus de la grille Forfaits retarife chaque carte; la ligne du forfait au-dessus ne bouge pas tant que vous ne confirmez pas." },
          { p: "Au-dessus de la grille **Forfaits** se trouve un sélecteur à deux positions, **Mensuel** / **Engagement d'un an**. Il démarre sur la fréquence à laquelle vous êtes déjà facturé, pour qu'une entreprise à l'année voie d'abord les prix annuels et ne soit jamais ramenée en douce au mensuel par une montée de forfait. Basculez-le et les quatre cartes se retarifent : la vue annuelle affiche **990 $/an**, **82,50 $ par mois** et **Économisez 198 $ par an**." },
          { p: "Avec le sélecteur sur l'année, la carte de votre propre palier n'indique plus **Forfait actuel** — elle indique **Passer à l'année**, parce qu'une entreprise mensuelle qui prend l'engagement fait un vrai changement. Un palier sans prix annuel indiquerait **Pas vendu à l'année**; les quatre forfaits vendus en ligne en ont un." },
        ],
      },
      {
        id: "how-to-take-the-commitment",
        heading: "Comment passer du mensuel à l'année",
        blocks: [
          { steps: [
            "Ouvrez **Compte et facturation** et basculez le sélecteur sur **Engagement d'un an**.",
            "Appuyez sur **Passer à l'année** sur votre propre palier (ou sur **Choisir ce forfait** sur un autre).",
            "Lisez la boîte de dialogue. Un changement de fréquence au même palier ou à un palier inférieur est programmé pour la fin de votre mois en cours : **Votre forfait passe à Crew (facturé annuellement) le 2026-10-01. D'ici là, vous conservez Crew (facturé mensuellement). Rien n'est facturé aujourd'hui.** Appuyez sur **Programmer le changement**.",
            "La carte du forfait affiche maintenant le panneau ambré **Passage à …** avec **Garder mon forfait actuel** en dessous. À la date, Stripe prélève le montant annuel et l'année commence.",
          ] },
          { note: "Monter de palier et passer à l'année en même temps est une montée de forfait, alors ça s'applique aujourd'hui et la différence est calculée au prorata — la boîte de dialogue indique plutôt **Changer de forfait maintenant**. Voir [[change-your-plan|Changer de forfait]] pour la règle complète." },
        ],
      },
      {
        id: "what-commitment-means",
        heading: "Ce que veut dire l'engagement",
        blocks: [
          { bullets: [
            "**L'année est payée une fois, d'avance**, à la date de renouvellement, dans votre devise, avec les taxes ajoutées par Stripe là où elles s'appliquent.",
            "**Revenir au mensuel, ou descendre de palier, attend la fin de l'année.** Le changement est programmé pour la fin de la période et rien n'est remboursé, crédité ou facturé avant — la même règle qu'une descente de forfait au mois, sur une période plus longue.",
            "**Monter de forfait en cours d'année n'attend pas.** Un palier supérieur s'applique aujourd'hui et le reste de l'année est calculé au prorata.",
            "**Le premier mois gratuit vient avant l'année**, pas dedans : aucun prélèvement pendant 30 jours, puis le montant annuel complet.",
            "**Les rappels arrivent 30 jours avant** un renouvellement annuel, par courriel, avec le montant et la carte. Les renouvellements mensuels n'ont pas de rappel, parce qu'un prélèvement qui revient chaque mois n'est pas une nouvelle — voir [[renewal-reminders|Rappels de renouvellement]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Le prix annuel est-il un rabais ou juste une facturation en une fois?", a: "Un rabais : deux mois gratuits. 990 $ pour Solo contre 1 188 $ pour douze paiements mensuels." },
      { q: "J'ai pris l'année et je veux partir après six mois.", a: "L'année a été prélevée et l'engagement court jusqu'à sa date de fin; le retour au mensuel est programmé pour cette date, et rien n'est remboursé avant. Voir [[cancel-your-subscription|Annuler votre abonnement]] pour ce que fait l'annulation." },
      { q: "Monter de forfait va-t-il me ramener au mensuel?", a: "Non. Le sélecteur démarre sur votre fréquence actuelle et une montée de forfait s'achète à ce que le sélecteur affiche. Vérifiez qu'il indique **Engagement d'un an** avant d'appuyer sur **Choisir ce forfait** si c'est ce que vous voulez." },
    ],
  },

  "change-your-plan": {
    title: "Changer de forfait",
    summary:
      "Une montée de forfait s'applique aujourd'hui et au prorata; une descente ou un passage mensuel-annuel est programmé pour la fin de la période sans rien facturer d'ici là — et vous pouvez annuler une programmation.",
    updated: "2026-09-12",
    intro: [
      "Vous changez de forfait depuis la grille **Forfaits** de **Compte et facturation**. La carte sur laquelle vous appuyez et la position du sélecteur de fréquence décident d'une seule chose : si le changement se fait maintenant ou à la fin de ce que vous avez déjà payé. La boîte de dialogue vous dit lequel avant que vous confirmiez, dans une phrase qui vient de la même règle que le serveur applique.",
      "La règle en une ligne : **vers le haut, c'est maintenant; vers le bas ou de côté, c'est plus tard.** Un atelier qui vient d'embaucher deux estimateurs a besoin des sièges aujourd'hui; une entreprise qui descend garde les sièges qu'elle a payés jusqu'à la fin de la période, et n'est jamais remboursée ni refacturée entre-temps.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { table: {
            head: ["Le changement", "Quand il s'applique", "Ce qui est facturé"],
            rows: [
              ["Un palier plus haut (Solo → Crew, Crew → Shop …), à l'une ou l'autre fréquence", "Tout de suite", "La différence pour le reste de la période de facturation, au prorata aujourd'hui"],
              ["Un palier plus bas", "À la fin de la période en cours — après l'année, sur un forfait annuel", "Rien aujourd'hui; le nouveau prix à la date de renouvellement"],
              ["Même palier, mensuel → annuel ou annuel → mensuel", "À la fin de la période en cours", "Rien aujourd'hui; le nouveau montant à la date de renouvellement"],
              ["Même palier, même fréquence", "Rien ne se passe — le bouton indique **Forfait actuel**", "—"],
            ],
          } },
          { p: "« Haut » et « bas » sont décidés par l'ordre de l'échelle — Solo, Crew, Shop, Scale — pas par les noms, et un changement de palier et de fréquence en même temps est jugé sur le palier : Solo mensuel vers Crew annuel est une montée de forfait et s'applique maintenant." },
        ],
      },
      {
        id: "how-to-upgrade",
        heading: "Comment monter de forfait",
        blocks: [
          { figure: "harness:plan", caption: "Compte et facturation — l'entreprise est sur Shop; Crew et Solo en dessous sont des descentes, Scale est la seule montée qui reste." },
          { steps: [
            "Ouvrez **Compte et facturation**. Vérifiez que le sélecteur **Mensuel** / **Engagement d'un an** indique la fréquence que vous voulez; il démarre sur celle où vous êtes.",
            "Appuyez sur **Choisir ce forfait** sur le palier supérieur.",
            "La boîte de dialogue **Changer de forfait** se lit : **Votre forfait passe à Shop (facturé mensuellement) immédiatement. La différence pour le reste de la période de facturation est calculée au prorata aujourd'hui.** Appuyez sur **Changer de forfait maintenant**.",
            "La page se recharge et lit le nouveau forfait chez Stripe. Les sièges et places d'équipiers supplémentaires sont utilisables immédiatement dans **Gérer l'équipe**.",
          ] },
          { note: "Pendant votre mois gratuit, une montée de forfait s'applique aussi tout de suite, et reste gratuite : l'essai est gardé exactement là où il était et le nouveau prix commence à sa fin." },
        ],
      },
      {
        id: "how-to-downgrade-or-switch-cadence",
        heading: "Comment descendre de forfait, ou passer du mensuel à l'annuel et inversement",
        blocks: [
          { steps: [
            "Appuyez sur **Choisir ce forfait** sur le palier inférieur, ou basculez le sélecteur et appuyez sur **Passer à l'année** sur votre propre palier.",
            "La boîte de dialogue se lit : **Votre forfait passe à Solo (facturé mensuellement) le 2026-10-01. D'ici là, vous conservez Crew (facturé mensuellement). Rien n'est facturé aujourd'hui.** Appuyez sur **Programmer le changement**.",
            "La page confirme **C'est fait — votre forfait change le 2026-10-01. Rien n'est facturé d'ici là.** et un panneau ambré apparaît sur la carte du forfait : **Passage à Solo (facturé mensuellement) le 2026-10-01** avec **Garder mon forfait actuel** en dessous.",
            "À cette date, Stripe fait le changement sur sa propre horloge et facture le nouveau montant. Le nom du forfait sur la carte change à ce moment-là, pas avant, et vous recevez le courriel de changement de forfait à cet instant.",
          ] },
          { bullets: [
            "**Garder mon forfait actuel** libère la programmation. Le panneau disparaît et rien n'a bougé dans votre abonnement.",
            "**Programmer un deuxième changement** avant que le premier tombe le remplace — c'est la demande la plus récente qui tient.",
            "**Monter de forfait pendant qu'une descente est programmée** annule la programmation : la montée que vous choisissez aujourd'hui remplace la descente que vous aviez prévue.",
          ] },
        ],
      },
      {
        id: "what-happens-to-your-people",
        heading: "Ce qui arrive à votre équipe lors d'une descente",
        blocks: [
          { p: "Personne n'est bloqué. Si le forfait vers lequel vous descendez comprend moins de sièges que vous n'en utilisez, tout le monde garde son accès et continue de travailler; **Gérer l'équipe** indique **Limite de votre forfait atteinte** et le bouton **Ajouter un siège** est désactivé jusqu'à ce que vous remontiez de forfait ou remettiez quelqu'un sur Crew. La limite vous empêche d'ajouter un siège — elle n'en retire jamais un." },
          { tip: "Avant de descendre, comparez les comptes de sièges et d'équipiers de **Gérer l'équipe** à la ligne **sièges · équipiers inclus gratuitement** du forfait visé. Voir [[add-a-seat-or-a-crew-login|Ajouter un siège, ou un accès d'équipier gratuit]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "Les propriétaires et les administrateurs seulement. Les routes derrière **Choisir ce forfait**, **Programmer le changement** et **Garder mon forfait actuel** le revérifient toutes, alors un Manager ou un Dispatcher qui atteint la page par son adresse reçoit **Only an owner or admin can change the plan or billing details.** Chaque changement est écrit dans le Journal d'activité avec qui l'a fait et quand." },
        ],
      },
    ],
    faq: [
      { q: "J'ai monté de forfait par erreur. Puis-je revenir tout de suite?", a: "Vous pouvez programmer le retour en bas, et il tombe à la fin de la période; la différence au prorata déjà facturée pour la montée n'est pas remboursée. Lisez la boîte de dialogue avant d'appuyer sur **Changer de forfait maintenant**." },
      { q: "Pourquoi mon forfait dit-il encore Crew après avoir choisi Solo?", a: "Parce que vous avez encore Crew jusqu'à la date du panneau ambré. La carte nomme le forfait que vous avez aujourd'hui; le panneau nomme celui qui s'en vient." },
      { q: "Changer de forfait crée-t-il un deuxième abonnement?", a: "Non. Une entreprise avec un abonnement actif est déplacée sur place. La page de paiement ne s'ouvre que pour une entreprise sans forfait actif — une nouvelle, ou une qui a annulé et qui revient." },
    ],
  },

  "add-a-seat-or-a-crew-login": {
    title: "Ajouter un siège, ou un accès d'équipier gratuit",
    summary:
      "Les deux boutons Ajouter de Gérer l'équipe, ce que chacun coûte, comment fonctionnent les invitations, ce qui se passe quand le forfait est plein, et quel forfait il vous faut ensuite.",
    updated: "2026-09-12",
    intro: [
      "**Gérer l'équipe** a deux portes pour ajouter une personne, parce qu'elles coûtent un argent différent : **Ajouter un équipier — gratuit** pour quelqu'un qui travaille sur le terrain, et **Ajouter un siège** pour quelqu'un qui chiffre des travaux ou écrit des factures. Les deux mènent au même formulaire **Nouvel utilisateur** avec un point de départ différent sélectionné, et les deux finissent par une invitation par courriel que la personne accepte pour créer son propre accès.",
      "Rejoindre une entreprise se fait sur invitation seulement. Il n'y a aucun moyen pour quelqu'un de s'ajouter lui-même à votre entreprise; chaque membre a commencé par une invitation envoyée depuis cet écran.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { figure: "live:app-settings-team", caption: "Gérer l'équipe — le panneau des sièges (1 / 3 sièges utilisés, 0 / 8 équipiers — inclus gratuitement), les deux boutons Ajouter, et la liste en dessous." },
          { p: "Le panneau du haut indique par exemple **1 / 3 sièges utilisés** et **0 / 8 équipiers — inclus gratuitement**, avec un détail en dessous (**1 Administrateurs**, **2 Équipiers** …). Le premier nombre de chaque paire est ce que vous utilisez, invitations en attente comprises; le second, ce que votre forfait comprend. Sous les comptes se trouvent les deux boutons, et sous eux la liste avec le niveau d'accès de chaque personne." },
          { p: "Un siège, c'est quiconque a un accès qui lui permet de créer ou de modifier des soumissions, des chantiers, des factures ou des demandes — le propriétaire, chaque administrateur, et les préréglages **Estimator**, **Dispatcher** et **Manager**. Les équipiers, c'est tous ceux qui sont au niveau du préréglage **Crew** ou en dessous. Définitions complètes dans [[the-four-plans|Les quatre forfaits]] et [[seats-and-crew-logins|Sièges et accès d'équipiers]]." },
        ],
      },
      {
        id: "add-a-crew-login",
        heading: "Ajouter un accès d'équipier (gratuit)",
        blocks: [
          { steps: [
            "Ouvrez **Votre équipe** dans la barre latérale (ou **Paramètres → Gérer l'équipe**) et appuyez sur **Ajouter un équipier — gratuit**.",
            "Le formulaire **Nouvel utilisateur** s'ouvre avec le préréglage **Crew** déjà sélectionné. Entrez son nom, son courriel et son numéro de cellulaire; l'adresse et le coût de main-d'œuvre sont facultatifs.",
            "Laissez le préréglage sur **Crew** — il n'a aucun curseur à déplacer. Monter n'importe quelle permission au-dessus transforme la personne en siège, et le compte de sièges le dira.",
            "Appuyez sur **Envoyer l'invitation**. La personne reçoit un courriel avec un lien pour créer son propre accès; tant qu'elle n'a pas accepté, la liste l'affiche comme **Invité** avec **Annuler l’invitation** à côté.",
          ] },
          { note: "Quelqu'un sur la paie qui ne se connectera jamais — un aide payé à l'heure qui n'a pas besoin de l'application — n'a pas besoin d'invitation du tout. Ajoutez-le plutôt sous **Travailleurs**; voir [[payroll-settings|Réglages de la paie]]." },
        ],
      },
      {
        id: "add-a-seat",
        heading: "Ajouter un siège",
        blocks: [
          { figure: "create:app-settings-team-create", caption: "Nouvel utilisateur — les renseignements personnels, puis Permissions : Nommer administrateur, les quatre préréglages (Crew, Estimator, Dispatcher, Manager) et Personnalisé, et la grille en dessous." },
          { steps: [
            "Appuyez sur **Ajouter un siège**. Le formulaire s'ouvre sur le préréglage **Dispatcher** — la chose la moins chère qui soit vraiment un siège. Choisissez **Estimator** ou **Manager** si ça convient mieux, ou déplacez des curseurs un à un; tout changement transforme le préréglage en **Personnalisé**.",
            "Cochez **Nommer administrateur** seulement pour quelqu'un qui doit aussi voir la facturation et tout le reste du compte. Les administrateurs sont aussi des sièges.",
            "Appuyez sur **Envoyer l'invitation**. Le siège est compté dès que l'invitation existe, alors une invitation en attente retient un siège jusqu'à ce qu'elle soit acceptée ou annulée.",
          ] },
          { p: "Ajouter un siège ne coûte rien de plus tant que votre forfait en a un de libre : le prix du forfait est fixe, et **3 sièges** veut dire trois personnes pour 169 $. Ça coûte de l'argent seulement quand le forfait est plein et que le palier suivant est la façon d'en obtenir un autre — voir ci-dessous." },
        ],
      },
      {
        id: "when-the-plan-is-full",
        heading: "Quand le forfait est plein",
        blocks: [
          { p: "Les deux portes se ferment séparément. Quand chaque siège est utilisé, **Ajouter un siège** est désactivé et affiche **Vous utilisez tous les sièges de votre forfait.** au survol, tandis qu'**Ajouter un équipier — gratuit** reste actif; quand chaque place d'équipier est utilisée, c'est l'inverse. Un équipier peut aussi occuper un siège que vous n'utilisez pas, alors une entreprise Solo avec un siège et six équipiers reste dans son allocation si le siège est libre." },
          { p: "À côté d'un bouton désactivé, la page nomme la sortie : **Vous avez utilisé tous vos sièges. Crew couvre 3 sièges et 8 équipiers.** avec un lien **Passer au forfait supérieur** vers **Compte et facturation** pour les propriétaires et les administrateurs. Au-delà de Scale, elle indique **Vous dépassez les forfaits vendus en ligne — parlons-en.**" },
          { warning: "Le serveur refuse une invitation qui dépasserait le forfait même si un bouton a l'air actif — un deuxième onglet, un compte périmé. Le refus dit quelle limite a été atteinte et quel forfait convient. Il ne retire jamais une personne que vous avez déjà : la limite bloque l'ajout, pas la détention." },
        ],
      },
      {
        id: "who-can-add-people",
        heading: "Qui peut ajouter des gens",
        blocks: [
          { bullets: [
            "**Les propriétaires et les administrateurs** peuvent inviter n'importe qui à n'importe quel niveau, changer l'accès d'une personne existante, et voir le lien **Passer au forfait supérieur**.",
            "**Les Managers et les Dispatchers** peuvent inviter aussi, mais seulement au palier Travailleur — Crew ou Estimator — et jamais avec un curseur plus haut que le leur. Ils voient **Limite de votre forfait atteinte** mais pas de lien de montée, parce que le forfait n'est pas à eux à changer.",
            "**Les Estimators et les Crew** ne peuvent pas ouvrir le formulaire.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Inviter quelqu'un débite-t-il ma carte?", a: "Non. Le prix du forfait est fixe. Ajouter des gens dans les sièges et les places d'équipiers du forfait ne change rien à votre facture; les dépasser veut dire choisir le forfait suivant dans **Compte et facturation**, et c'est le seul frais." },
      { q: "J'ai déplacé les curseurs d'un équipier et le compte de sièges a monté.", a: "C'est la règle qui fonctionne : un siège se compte d'après ce que la personne peut faire. Remettez-la sur le préréglage **Crew** et le siège est libéré." },
      { q: "Puis-je annuler une invitation pour libérer le siège?", a: "Oui — **Annuler l’invitation** sur sa ligne. Le lien cesse de fonctionner et le siège est libéré sur-le-champ. Toute fiche de travailleur déjà dans vos livres est conservée." },
      { q: "Quelqu'un peut-il s'inscrire et demander à rejoindre mon entreprise?", a: "Non. On rejoint sur invitation seulement; la seule porte d'entrée est une invitation depuis cet écran." },
    ],
  },

  "update-your-payment-method": {
    title: "Mettre à jour votre mode de paiement",
    summary:
      "Changer la carte que FieldQuo prélève, par le portail de facturation de Stripe, et ce qui se passe dès votre retour — surtout si un paiement refusé avait mis le compte en attente.",
    updated: "2026-09-12",
    intro: [
      "La carte au dossier est détenue par Stripe, jamais par FieldQuo, alors on la change sur le portail de facturation de Stripe lui-même. Un bouton de **Compte et facturation** vous y amène et vous ramène : **Gérer la facturation et le mode de paiement**.",
      "Cet article est la version deux minutes de cet aller-retour, plus le seul cas où ça compte le plus — une carte expirée, un paiement refusé, et un compte dont le délai de grâce s'écoule.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Votre abonnement est un abonnement Stripe sur un client Stripe créé pour votre entreprise à votre premier passage à la caisse. La carte, l'adresse de facturation et les factures vivent toutes sur ce client. FieldQuo ne garde aucun détail de la carte — pas même les quatre derniers chiffres, qu'il demande à Stripe quand il rédige un rappel de renouvellement." },
          { p: "Le portail est la page hébergée par Stripe, ouverte dans le même onglet avec un lien de retour vers **Compte et facturation**. Quand vous revenez, la page demande tout de suite à Stripe l'état actuel de l'abonnement au lieu d'attendre un webhook, alors une carte réparée apparaît réparée sur-le-champ." },
        ],
      },
      {
        id: "how-to-change-the-card",
        heading: "Comment changer la carte",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — Gérer la facturation et le mode de paiement, le deuxième bouton de la carte du forfait, ouvre le portail de facturation de Stripe." },
          { steps: [
            "Ouvrez **Compte et facturation** — **Forfait** au bas de la barre latérale, ou **Paramètres → Compte et facturation**.",
            "Appuyez sur **Gérer la facturation et le mode de paiement**. Le bouton affiche **Ouverture...** et l'onglet passe au portail de Stripe, qui montre le nom de votre entreprise.",
            "Sur le portail, ajoutez la nouvelle carte dans sa section des modes de paiement et faites-en la carte par défaut; retirez l'ancienne si vous voulez. Mettez aussi l'adresse de facturation à jour si elle a changé — Stripe s'en sert pour calculer les taxes sur chaque prélèvement.",
            "Utilisez le lien de retour du portail. Vous revenez sur **Compte et facturation**, qui affiche **Vérification auprès de Stripe…** une seconde puis montre l'état actuel.",
          ] },
          { note: "Le bouton a besoin d'un historique de facturation pour s'ouvrir — une entreprise qui n'est jamais passée à la caisse voit **No billing history yet — start a plan first**. Choisissez un forfait sur la même page et le portail fonctionne à partir de là." },
        ],
      },
      {
        id: "after-a-failed-payment",
        heading: "Après un paiement refusé",
        blocks: [
          { p: "Si un prélèvement de renouvellement échoue, la carte du forfait indique **En retard** et le compte passe en lecture seule pendant 7 jours : tout le monde peut voir son travail, personne ne peut rien y ajouter. Après sept jours, il est verrouillé sur l'écran de facturation. Rien n'est jamais supprimé — voir [[failed-payments-and-the-grace-period|Paiements refusés et délai de grâce]]." },
          { p: "Réparer la carte, c'est le même aller-retour que ci-dessus. La différence, c'est ce qui se passe à votre retour : parce que le verrou est appliqué au chargement de l'application, la page recharge toute l'application après avoir vérifié auprès de Stripe, alors la barre latérale revient dès que le paiement passe plutôt que quand un webhook finit par arriver. Si vous réparez la carte et que l'application a encore l'air verrouillée, appuyez sur **Vérifier auprès de Stripe** sur la page de facturation." },
          { tip: "Le prélèvement refusé est une facture ouverte sur le portail. Payez-la là à la main avec la nouvelle carte si vous ne voulez pas attendre la prochaine tentative de Stripe; dans un cas comme dans l'autre, la pastille **En retard** redevient **Actif** dès que Stripe la signale payée." },
        ],
      },
      {
        id: "what-else-the-portal-does",
        heading: "Ce que le portail fait d'autre",
        blocks: [
          { bullets: [
            "**Factures et reçus** — chaque prélèvement que FieldQuo a fait, téléchargeable en PDF. Voir [[invoices-and-receipts-from-fieldquo|Factures et reçus de FieldQuo]].",
            "**Adresse de facturation et numéro de taxe** — l'adresse décide des taxes que Stripe ajoute; un numéro d'entreprise entré ici apparaît sur les factures.",
            "**Pas le forfait.** Changer de palier ou de fréquence se fait dans **Compte et facturation**, où vivent la règle de calendrier et la boîte de dialogue de confirmation — voir [[change-your-plan|Changer de forfait]]. Annuler, c'est **Annuler le forfait** sur la même page, qui demande pourquoi et vous dit ce qui arrive à vos données.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Les propriétaires et les administrateurs. La route du portail refuse tous les autres avec **Only an owner or admin can change the plan or billing details.** — un superviseur qui peut inviter des gens n'a quand même pas à lire l'historique de paiement de l'entreprise." },
        ],
      },
    ],
    faq: [
      { q: "Le bouton dit Impossible d'ouvrir le portail de facturation.", a: "Rien n'a changé dans votre forfait. Réessayez dans un moment; si ça continue d'échouer, la bannière d'erreur dit pourquoi, et le soutien voit le même message de son côté." },
      { q: "Puis-je payer par virement bancaire ou par chèque plutôt que par carte?", a: "Non. L'abonnement est prélevé sur une carte au dossier par Stripe." },
      { q: "La nouvelle carte s'applique-t-elle au prélèvement qui a déjà échoué?", a: "Le prélèvement refusé reste une facture ouverte sur le portail jusqu'à ce qu'elle soit payée — payez-la là avec la nouvelle carte. Appuyez sur **Vérifier auprès de Stripe** si la page n'a pas suivi ensuite." },
    ],
  },

  "invoices-and-receipts-from-fieldquo": {
    title: "Factures et reçus de FieldQuo",
    summary:
      "Où vit la facture de chaque prélèvement d'abonnement, ce qu'elle montre, quels courriels FieldQuo lui-même envoie au sujet de votre facturation, et comment ne pas les confondre avec les factures que vous envoyez à vos clients.",
    updated: "2026-09-12",
    intro: [
      "Chaque prélèvement que FieldQuo fait sur votre carte — le forfait mensuel ou annuel, et toute recharge ou tout paiement de migration — est une facture Stripe sur le client Stripe de votre entreprise. On les lit et on les télécharge depuis le portail de facturation de Stripe, atteint depuis **Compte et facturation**; FieldQuo n'en garde pas de deuxième copie dans l'application.",
      "Cet article dit où les trouver, ce qui est imprimé dessus, et quels courriels vous recevez de FieldQuo au sujet de votre abonnement, pour que vous sachiez lequel est lequel quand le comptable le demande.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo vous facture par Stripe Billing, dans votre propre devise — dollars canadiens pour une adresse au Canada, dollars américains pour une adresse aux États-Unis. À chaque période, Stripe émet une facture, prélève la carte au dossier et marque la facture payée; la facture payée est le reçu. Il n'y a pas de courriel de reçu distinct aux couleurs de FieldQuo par prélèvement." },
          { p: "C'est la direction opposée aux factures de votre écran **Factures**, qui sont les vôtres envoyées à vos clients et qui passent par votre propre compte Stripe connecté. Les deux ne se mélangent jamais : votre facture d'abonnement n'est pas dans votre export comptable, et le paiement d'un client n'est jamais sur votre client Stripe." },
        ],
      },
      {
        id: "where-to-find-them",
        heading: "Où les trouver",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — Gérer la facturation et le mode de paiement ouvre le portail Stripe où chaque facture d'abonnement est listée." },
          { steps: [
            "Ouvrez **Compte et facturation** et appuyez sur **Gérer la facturation et le mode de paiement**.",
            "Sur le portail de Stripe, ouvrez l'historique des factures. Chaque prélèvement est listé avec sa date, son montant et son état.",
            "Ouvrez une facture pour la voir ou la télécharger en PDF. Envoyez-la à votre comptable; c'est le document auquel la ligne bancaire correspond.",
            "Utilisez le lien de retour du portail pour revenir dans FieldQuo.",
          ] },
          { note: "Seul un propriétaire ou un administrateur peut ouvrir le portail. Si votre comptable n'est ni l'un ni l'autre, téléchargez les PDF et transmettez-les — ou nommez-le administrateur, ce qui lui permet aussi de changer le forfait et la carte." },
        ],
      },
      {
        id: "what-an-invoice-shows",
        heading: "Ce que montre une facture",
        blocks: [
          { table: {
            head: ["Ligne", "D'où elle vient"],
            rows: [
              ["**FieldQuo — Crew** (ou Solo, Shop, Scale)", "Le forfait où vous étiez pour cette période. Après qu'un changement programmé tombe, la ligne nomme le nouveau forfait à partir de ce renouvellement."],
              ["Le montant et la devise", "Le prix mensuel ou annuel du forfait dans votre devise de facturation — le même nombre que vous voyez sur la carte du forfait."],
              ["Une ligne au prorata", "N'apparaît que sur la facture qui suit une montée de forfait en cours de période : la différence pour le reste de cette période."],
              ["Taxes de vente", "Ajoutées automatiquement par Stripe d'après l'adresse de facturation au dossier; le taux est celui de la juridiction, pas quelque chose que FieldQuo fixe. Voir [[taxes-and-currency-on-your-subscription|Taxes et devise de votre abonnement]]."],
              ["Votre numéro de taxe d'entreprise", "Imprimé si vous l'avez entré à la page de paiement ou dans le portail; vide sinon."],
              ["Adresse de facturation", "L'adresse entrée à la page de paiement ou mise à jour dans le portail."],
            ],
          } },
          { p: "Une recharge de crédit téléphonique ou IA, ou un paiement du service de migration, apparaît dans le même portail comme sa propre facture ponctuelle, avec sa propre ligne — voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]] et [[paying-for-the-migration-service|Payer le service de migration]]." },
        ],
      },
      {
        id: "emails-fieldquo-sends",
        heading: "Les courriels que FieldQuo envoie au sujet de votre facturation",
        blocks: [
          { bullets: [
            "**Quand un forfait démarre** — une confirmation qui nomme le forfait, **Status: Free trial** pendant le mois gratuit, et **Trial ends** ou **Next billing date**. Envoyée une fois, peu importe combien de fois la page vérifie auprès de Stripe.",
            "**Quand un changement de forfait tombe** — le même courriel, qui nomme l'ancien forfait et le nouveau, le jour où le changement prend effet.",
            "**Avant le premier prélèvement** — sept jours avant qu'un essai devienne payant, avec le montant et les quatre derniers chiffres de la carte s'ils sont connus. Les renouvellements annuels reçoivent le même courriel 30 jours d'avance; les renouvellements mensuels n'en reçoivent pas. Voir [[renewal-reminders|Rappels de renouvellement]].",
            "**Quand un paiement échoue** — les avertissements du délai de grâce, voir [[failed-payments-and-the-grace-period|Paiements refusés et délai de grâce]].",
            "**Quand vous annulez** — une confirmation avec la date à laquelle votre accès se termine.",
          ] },
          { p: "Aucun de ceux-là n'est une facture. La facture elle-même est dans le portail, et tout courriel de reçu qui arrive de l'adresse de Stripe est celui de Stripe, pas de FieldQuo." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo peut-il m'envoyer la facture par courriel chaque mois?", a: "Pas depuis l'application. La facture est dans le portail Stripe par **Gérer la facturation et le mode de paiement**, téléchargeable en PDF." },
      { q: "Pourquoi la facture montre-t-elle des taxes alors que mes propres factures à mes clients n'en montrent pas?", a: "Ce sont deux ventes différentes. Stripe ajoute la taxe qui s'applique à FieldQuo qui vous vend, d'après votre adresse de facturation. La taxe sur vos factures à vos clients vient de vos propres réglages de taxes." },
      { q: "Mon abonnement est-il dans l'export comptable?", a: "Non. L'export couvre les paiements de vos clients et vos dépenses. Enregistrez la facture FieldQuo comme dépense logicielle à partir du PDF." },
    ],
  },
};
