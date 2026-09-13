// content/help/fr/billing-and-subscription-2.js
//
// Partie 2 de la catégorie « billing-and-subscription » en français (voir le
// composeur, billing-and-subscription.js). Même structure que l'anglais,
// article par article : mêmes slugs, mêmes sections dans le même ordre, mêmes
// blocs, mêmes figures — scripts/check-help-centre.mjs compare les deux. Les
// mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js; les
// chiffres, du code qui les applique (lib/billing/access.js,
// lib/billing/renewalReminder.js, lib/billing/retention.js,
// lib/referrals/index.js, lib/voice/credits.js, lib/ai/imageEconomics.js,
// lib/dataDeletion/constants.js).
export const ARTICLES = {
  "failed-payments-and-the-grace-period": {
    title: "Paiements refusés et délai de grâce",
    summary:
      "Ce qui se passe quand FieldQuo ne peut pas prélever votre carte : sept jours d'accès en lecture seule, deux courriels, une bannière, et comment tout récupérer en une minute environ.",
    updated: "2026-09-12",
    intro: [
      "Une carte échoue pour des raisons banales — elle a expiré, la banque l'a bloquée par précaution, la limite est atteinte. Quand ça arrive sur votre abonnement FieldQuo, rien n'est supprimé et personne n'est mis dehors. Le compte passe en **lecture seule** pendant **7 jours** : tout le monde peut encore ouvrir chaque soumission, facture, client et photo, mais personne ne peut rien créer ni envoyer de nouveau. Mettez la carte à jour et tout revient dès que le paiement passe.",
      "Cet article couvre toute cette fenêtre de sept jours : ce que vous voyez à l'écran, quels courriels FieldQuo envoie et quand, comment réparer la carte, et ce qui se passe si les sept jours s'écoulent.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Votre abonnement est facturé par Stripe à la fréquence de votre forfait. Quand un prélèvement échoue, Stripe le dit à FieldQuo, l'état du forfait devient **En retard**, et une horloge démarre ce jour-là. Pendant 7 jours, le compte est en lecture seule. Le huitième jour, il se verrouille : le seul écran que quiconque peut ouvrir est Compte et facturation, plus l'Aide. Payer rétablit l'accès complet sur-le-champ, quel que soit le jour." },
          { p: "L'horloge démarre au premier prélèvement refusé et ne repart pas à zéro si une tentative suivante échoue aussi. Si Stripe finit par abandonner et met fin à l'abonnement, le compte est traité comme **annulé**, ce qui a sa propre fenêtre, plus longue — voir [[cancel-your-subscription|Annuler votre abonnement]]." },
          { note: "La lecture seule est appliquée par le serveur, pas en cachant des boutons. Toute tentative d'enregistrer, d'envoyer ou de créer pendant la fenêtre est refusée avec un message qui dit combien de jours il reste et que rien n'a été supprimé." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Ce que vous voyez pendant la fenêtre",
        blocks: [
          { bullets: [
            "**Dans Compte et facturation** — la pastille d'état de la carte du forfait indique **En retard** en rouge, à côté du nom du forfait.",
            "**Une bannière en haut de chaque écran** — ambrée tant qu'il reste plus de deux jours, rouge quand il en reste deux ou moins, qui dit que le paiement n'est pas passé et combien de jours il reste, avec un lien **Update card**. Toute l'équipe la voit, pas seulement le propriétaire.",
            "**Deux courriels de FieldQuo** — un le jour où la fenêtre s'ouvre, qui dit que la carte n'a pas pu être prélevée, que le compte est en lecture seule et que rien n'a été supprimé; et un rappel quand il reste deux jours ou moins, qui nomme la date exacte du verrouillage. Il n'y a pas de relance quotidienne entre les deux, et les deux sont envoyés en anglais.",
            "**Après le septième jour** — un avis pleine page qui dit que le compte est verrouillé, avec un bouton **Update my card**. Il dit, en toutes lettres, que rien n'a été supprimé.",
          ] },
        ],
      },
      {
        id: "fix-the-card",
        heading: "Comment mettre la carte à jour",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Compte et facturation** (le même écran que **Forfait** dans la barre latérale principale). Seul un propriétaire ou un administrateur peut l'ouvrir.",
            "Appuyez sur **Gérer la facturation et le mode de paiement**. Le portail de facturation de Stripe s'ouvre pour le compte de FieldQuo; ajoutez la nouvelle carte ou réparez l'ancienne là.",
            "Revenez. FieldQuo demande à Stripe ce qui a changé dès votre retour et met la carte du forfait à jour. Si la pastille indique encore **En retard**, appuyez sur **Vérifier auprès de Stripe** un peu plus tard — Stripe encaisse le paiement en souffrance à son propre rythme une fois qu'une carte valide est au dossier.",
            "Quand le paiement passe, l'état revient à **Actif**, la bannière disparaît, et l'horloge de sept jours est remise à zéro — un problème plus tard reçoit sept jours neufs, pas le reste de ceux-ci.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — la carte du forfait avec sa pastille d'état, le bouton Gérer la facturation et le mode de paiement, et la grille Forfaits en dessous." },
          { tip: "Réparer la carte prend environ une minute et peut se faire depuis un téléphone. Si vous ne pouvez pas payer tout de suite, le lien **Aide** fonctionne encore à l'état verrouillé — écrivez-nous plutôt que d'attendre que l'horloge s'épuise." },
        ],
      },
      {
        id: "the-timeline",
        heading: "La chronologie",
        blocks: [
          { table: {
            head: ["Quand", "Ce qui se passe"],
            rows: [
              ["Le prélèvement échoue", "L'état devient En retard. Le compte est en lecture seule à partir de ce moment. L'horloge démarre."],
              ["Le même jour, ou le lendemain matin", "Le premier courriel part — la vérification quotidienne tourne une fois par jour, alors il peut arriver jusqu'à un jour après l'échec."],
              ["Deux jours ou moins restants", "La bannière passe au rouge et le seul courriel de rappel est envoyé, avec la date du verrouillage."],
              ["Jour 8", "Le compte se verrouille. La lecture s'arrête aussi; Compte et facturation et l'Aide restent ouverts."],
              ["Le jour où le paiement passe, quel qu'il soit", "L'accès complet revient immédiatement. Rien n'a été supprimé à aucun moment."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui le voit, et qui peut le réparer",
        blocks: [
          { p: "La bannière et l'état de lecture seule s'appliquent à tout le monde dans l'entreprise — un estimateur ne peut pas plus envoyer une soumission pendant la fenêtre que le propriétaire. La réparation est réservée aux propriétaires et aux administrateurs, parce que le mode de paiement appartient à l'entreprise : le bouton **Gérer la facturation et le mode de paiement** et la ligne Compte et facturation sont cachés à tous les autres niveaux, et le serveur les refuse de la même façon. Les courriels vont à l'adresse courriel de l'entreprise, ou à celle du propriétaire quand il n'y en a pas." },
        ],
      },
    ],
    faq: [
      { q: "Mes données sont-elles supprimées si les sept jours s'écoulent?", a: "Non. Un compte verrouillé est inaccessible, pas effacé. Les soumissions, factures, clients, chantiers et photos restent exactement où ils sont, et payer les rétablit instantanément." },
      { q: "Mes clients peuvent-ils encore me payer pendant la fenêtre?", a: "Oui. Leurs liens de soumission, leur portail et leurs pages de paiement de facture sont des pages publiques sans barrière de facturation, et leurs paiements arrivent toujours dans votre propre compte Stripe. Ce que vous ne pouvez pas faire, c'est envoyer, modifier ou relancer quoi que ce soit tant que la carte n'est pas réparée." },
      { q: "Pourquoi le premier courriel est-il arrivé le lendemain du refus de la carte?", a: "La vérification qui l'envoie tourne une fois par jour. Le compte est passé en lecture seule dès que le prélèvement a échoué; le courriel a rattrapé au passage suivant." },
    ],
  },

  "renewal-reminders": {
    title: "Rappels de renouvellement",
    summary:
      "Quels abonnements reçoivent un courriel avant le prochain prélèvement, combien de temps d'avance il arrive, ce qu'il dit, et pourquoi un forfait mensuel n'en reçoit pas.",
    updated: "2026-09-12",
    intro: [
      "Avant que FieldQuo prélève votre carte pour une autre période, il peut vous prévenir. Il le fait là où un avertissement est utile : **30 jours** avant le renouvellement d'un forfait annuel, et **7 jours** avant qu'un premier mois gratuit devienne le premier vrai prélèvement. Un forfait mensuel ne reçoit pas de rappel — le même montant le même jour chaque mois n'est pas quelque chose dont quiconque a besoin d'être averti par lettre.",
      "Cet article dit exactement qui reçoit le courriel, quand, ce qu'il contient, et quoi faire si vous voulez changer ou annuler avant la date qu'il nomme.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le rappel est décidé une fois par jour d'après la prochaine date de facturation de votre abonnement — celle affichée comme **Prochaine date de facturation** dans Compte et facturation. Il est envoyé une fois par période : un forfait annuel reçoit un courriel par année, et la même période n'est jamais rappelée deux fois. Si l'envoi échoue, le passage du lendemain réessaie, jusqu'au renouvellement." },
          { p: "Rien n'est facturé par le rappel lui-même. Le prélèvement est celui de Stripe, à la date du courriel, sur la carte au dossier — et le courriel dit quelle carte, par ses quatre derniers chiffres, quand Stripe en signale une." },
        ],
      },
      {
        id: "when-it-goes-out",
        heading: "Quand il part",
        blocks: [
          { table: {
            head: ["Votre abonnement", "Rappel"],
            rows: [
              ["Forfait annuel (engagement d'un an)", "30 jours avant la date de renouvellement"],
              ["Premier mois gratuit, sur le point de devenir payant", "7 jours avant le premier prélèvement (30 jours si le forfait est annuel)"],
              ["Forfait mensuel", "Aucun — le montant et le jour sont les mêmes chaque mois"],
            ],
          } },
          { note: "Un abonnement en retard ou annulé ne reçoit pas de rappel. Un compte en retard est déjà dans la fenêtre de sept jours décrite dans [[failed-payments-and-the-grace-period|Paiements refusés et délai de grâce]], et annoncer un prélèvement sur une carte qui vient d'être refusée serait le mauvais message." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "Ce que dit le courriel",
        blocks: [
          { bullets: [
            "Le nom du forfait et la date de renouvellement, en une phrase.",
            "Le montant qui sera prélevé, dans votre devise de facturation, et les quatre derniers chiffres de la carte quand Stripe les a.",
            "Que vous pouvez changer de forfait ou annuler n'importe quand avant cette date depuis Compte et facturation, et que rien n'est facturé avant la date de renouvellement.",
            "Un bouton **Manage billing** qui ouvre Compte et facturation.",
          ] },
          { p: "Le courriel vient de FieldQuo, pas de votre entreprise, et il est écrit en anglais. C'est le seul courriel automatique que FieldQuo envoie au sujet d'un prélèvement à venir; Stripe peut aussi envoyer son propre avis générique, et si vous recevez les deux le même jour, celui-là est de Stripe, pas un deuxième de nous." },
        ],
      },
      {
        id: "change-before-renewal",
        heading: "Changer ou annuler avant la date",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Compte et facturation**.",
            "Pour passer à un autre forfait, choisissez-le dans la grille **Forfaits**. Une descente de forfait ou un passage entre **Mensuel** et **Engagement d'un an** tombe à la date de renouvellement, sans rien facturer avant; une montée de forfait s'applique maintenant. Voir [[change-your-plan|Changer de forfait]].",
            "Pour arrêter le renouvellement tout court, appuyez sur **Annuler le forfait** — lisez d'abord [[cancel-your-subscription|Annuler votre abonnement]], parce que le forfait se termine dès que vous confirmez, pas à la date de renouvellement.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — la prochaine date de facturation sous la carte du forfait, et le sélecteur Mensuel / Engagement d'un an au-dessus de la grille Forfaits." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Qui le reçoit",
        blocks: [
          { p: "L'adresse courriel de l'entreprise, ou celle du propriétaire quand l'entreprise n'en a pas. Il n'est pas envoyé à chaque membre : combien l'entreprise paie à FieldQuo, et quand, est une information commerciale qui reste au propriétaire et aux administrateurs, les mêmes personnes qui peuvent ouvrir Compte et facturation." },
        ],
      },
    ],
    faq: [
      { q: "Je suis sur un forfait mensuel et je ne reçois jamais de rappel. Quelque chose est brisé?", a: "Non. Les forfaits mensuels n'en reçoivent pas, volontairement. La prochaine date de facturation est toujours dans Compte et facturation." },
      { q: "Le rappel veut-il dire que j'ai été prélevé?", a: "Non. Il dit qu'un prélèvement s'en vient, à la date qu'il nomme. Le reçu de Stripe après le prélèvement est un courriel distinct." },
      { q: "Puis-je recevoir le rappel en français ou en espagnol?", a: "Pas aujourd'hui. Les courriels de facturation de FieldQuo lui-même — renouvellement, paiement refusé, annulation — sont envoyés en anglais." },
    ],
  },

  "cancel-your-subscription": {
    title: "Annuler votre abonnement",
    summary:
      "Comment fonctionne le bouton Annuler le forfait : l'étape de la raison, l'étape de l'offre, les avertissements qui s'appliquent à votre entreprise, et les trente jours de lecture seule qui suivent.",
    updated: "2026-09-12",
    intro: [
      "Annuler, c'est un bouton dans Compte et facturation, pas un courriel au soutien. Avant que le forfait se termine, FieldQuo demande pourquoi vous partez, peut faire une offre qui correspond à la raison, puis vous dit — dans les mots clairs ci-dessous — exactement ce qui s'arrête, ce qui continue de tourner, et ce qui n'arrive pas. Le forfait se termine dès que vous confirmez; le compte reste ouvert en **lecture seule pendant 30 jours**, et rien n'est supprimé.",
      "Lisez ceci avant d'appuyer sur le bouton, parce que deux des choses qui continuent de tourner après une annulation coûtent de l'argent : un numéro de téléphone loué, et les recharges automatiques de crédit téléphonique.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Appuyer sur **Annuler le forfait** ouvre un court parcours : **Avant de partir** (pourquoi vous partez), parfois **Une chose d'abord** (une offre), puis **Annuler votre forfait** (les conséquences et la confirmation). Confirmer annule l'abonnement chez Stripe immédiatement. Stripe le dit à FieldQuo, l'état du forfait devient **Annulé**, et une fenêtre de lecture seule de 30 jours commence. Après, le compte se verrouille jusqu'à ce que quelqu'un redémarre un forfait." },
          { warning: "Le forfait se termine dès que vous confirmez — pas à la fin du mois ni de l'année. Ce que vous avez déjà payé pour le reste de la période n'est pas remboursé. Si vous voulez les semaines qui restent, gardez le forfait jusqu'à la prochaine date de facturation et annulez à ce moment-là." },
        ],
      },
      {
        id: "how-to-cancel",
        heading: "Comment annuler",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Compte et facturation** et appuyez sur **Annuler le forfait**, sous la carte du forfait.",
            "**Avant de partir** — l'écran montre ce que vous avez accumulé (soumissions, clients, factures) et demande ce qui vous fait annuler : trop cher, vous payez pour des gens qui ne l'utilisent pas, travail saisonnier, pas assez utilisé, une fonction manquante, vous passez à autre chose, vous fermez l'entreprise, ou autre chose. Choisissez-en une, ou appuyez sur **Passer et annuler**.",
            "**Une chose d'abord** — si une offre correspond, elle est montrée ici (le tableau ci-dessous). Prenez-la et le forfait reste; ou appuyez sur **Non merci — annuler mon compte**.",
            "**Annuler votre forfait** — lisez les conséquences, ajoutez une note si vous voulez (c'est la seule façon pour nous de savoir quoi corriger), et appuyez sur **Annuler mon forfait**. **Garder mon forfait** ferme le parcours sans rien changer.",
            "Un courriel confirme l'annulation. La carte du forfait indique maintenant **Annulé** et le bouton **Annuler le forfait** a disparu.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — Annuler le forfait se trouve sous la carte du forfait, à côté de Gérer la facturation et le mode de paiement." },
          { note: "Tout dans le parcours est décidé sur le serveur. L'offre que vous voyez est celle à laquelle votre compte a droit, et une annulation n'est enregistrée qu'une fois que Stripe a réellement mis fin à l'abonnement." },
        ],
      },
      {
        id: "the-offers",
        heading: "Les offres",
        blocks: [
          { table: {
            head: ["Offre", "Quand elle apparaît", "Ce qu'elle fait"],
            rows: [
              ["Réduire le nombre de licences", "Seulement sur un ancien forfait par licence avec plus de licences payées que de gens qui l'utilisent", "Réduit le nombre de licences sur votre abonnement Stripe à partir de la prochaine facture, la partie inutilisée étant créditée"],
              ["Mettre en pause jusqu'à ce que vous soyez occupé de nouveau", "Tout forfait, une fois par 12 mois", "Stripe cesse d'émettre des factures pendant la pause — aucune facture ne s'accumule à régler au retour"],
              ["25 % de rabais pendant 2 mois", "Tout forfait, une fois par 12 mois", "Vos 2 prochaines factures baissent de 25 %, puis le prix normal revient"],
            ],
          } },
          { p: "La pause et le rabais partagent un seul délai de 12 mois : prenez l'un ou l'autre et aucun des deux n'est offert de nouveau pendant un an, et l'écran dit à partir de quelle date le prochain est disponible. Réduire les licences n'est pas une concession — ça corrige une surfacturation — alors ça ne déclenche jamais le délai. Sur l'échelle à quatre échelons (Solo, Crew, Shop, Scale), l'offre de licences n'apparaît jamais, parce que ces forfaits ne sont pas tarifés par licence." },
        ],
      },
      {
        id: "what-happens-after",
        heading: "Ce qui se passe après votre confirmation",
        blocks: [
          { bullets: [
            "**Lecture seule pendant 30 jours.** Tout le monde peut encore ouvrir FieldQuo et tout lire — téléchargez ce qu'il faut pour votre comptable — mais personne ne peut rien changer. Une bannière en haut compte les jours.",
            "**Puis verrouillé.** Après les 30 jours, le compte reste fermé jusqu'à ce que le forfait soit redémarré. Rien n'est supprimé à aucun moment; redémarrer redonne tout.",
            "**Vos clients gardent chaque lien.** Les soumissions, le portail client et les pages de paiement de facture s'ouvrent toujours, et tout ce qu'ils paient arrive toujours dans votre propre compte Stripe.",
            "**Aucun remboursement de la période restante.** L'écran indique la date jusqu'à laquelle vous avez payé avant que vous confirmiez.",
            "**Redémarrer**, c'est **Choisir ce forfait** sur le même écran, qui ouvre une nouvelle page de paiement Stripe. Le premier mois gratuit n'est pas offert une deuxième fois.",
          ] },
        ],
      },
      {
        id: "before-you-cancel",
        heading: "Réglez ceci d'abord",
        blocks: [
          { p: "L'étape de confirmation ne liste que les avertissements qui sont vrais pour votre entreprise — un peintre sans numéro de téléphone n'est pas averti au sujet d'un numéro. Chacun est quelque chose que vous ne pouvez faire que tant que le compte est encore modifiable, alors faites-le avant de confirmer." },
          { bullets: [
            "**Un numéro de téléphone loué n'est pas rendu.** Son loyer mensuel continue de sortir de votre crédit téléphonique; quand le crédit ne peut plus le couvrir, vous recevez un préavis de 7 jours et le numéro est ensuite libéré pour de bon. Libérez-le vous-même d'abord si vous préférez choisir le moment.",
            "**Le crédit téléphonique n'est pas remboursé.** Le solde que vous avez acheté reste un solde.",
            "**Les recharges automatiques de crédit téléphonique restent activées.** Si une carte est enregistrée pour elles, elle continue d'être prélevée chaque fois que le solde baisse. Désactivez-les d'abord sur la page des réglages du téléphone.",
            "**Les plans de service avec un mode de paiement enregistré continuent de tourner.** Les factures continuent de partir et les cartes de vos clients continuent d'être prélevées selon l'horaire. Annulez ces plans d'abord si ce n'est pas ce que vous voulez.",
            "**Les factures impayées restent payables** par le client, mais une fois en lecture seule, vous ne pouvez plus les modifier, les renvoyer ni les relancer.",
            "**Votre site web et votre page de rendez-vous restent en ligne.** Les nouvelles demandes de rendez-vous continuent d'arriver, et après les 30 jours vous ne pourrez plus ouvrir le compte pour les voir. Une petite ligne « Site by FieldQuo » revient alors dans le pied de page. Dépubliez le site d'abord si vous préférez qu'il se taise.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut annuler",
        blocks: [
          { p: "Le propriétaire et les administrateurs. Un Manager, un Dispatcher ou un Estimator ne voit pas Compte et facturation du tout, et la demande d'annulation est refusée sur le serveur pour quiconque est sous propriétaire ou administrateur — l'abonnement est la relation commerciale de l'entreprise avec FieldQuo, pas une permission de planification." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je annuler à la fin de ma période de facturation plutôt qu'aujourd'hui?", a: "Pas avec le bouton — il met fin au forfait immédiatement. Attendez la veille de votre prochaine date de facturation et annulez à ce moment-là; le rappel de renouvellement d'un forfait annuel vous donne 30 jours de préavis de cette date." },
      { q: "J'ai payé pour une année. Est-ce que je récupère le reste?", a: "Non. L'écran indique la date jusqu'à laquelle vous avez payé et que le reste n'est pas remboursé, avant que vous confirmiez." },
      { q: "Mes données seront-elles supprimées après les 30 jours?", a: "Non. Verrouillé ne veut pas dire effacé. Pour faire vraiment supprimer des données, voir [[closing-your-account|Fermer votre compte et vos données]]." },
    ],
  },

  "referral-months": {
    title: "Mois de parrainage",
    summary:
      "Comment une entreprise parrainée et l'entreprise qui l'a parrainée gagnent chacune un mois gratuit, quand chaque mois tombe, et les règles qui empêchent d'abuser du programme.",
    updated: "2026-09-12",
    intro: [
      "Parrainez un autre entrepreneur et vous recevez tous les deux la même chose : **un mois de plus de FieldQuo gratuit**. Le mois du nouveau venu s'ajoute à son essai gratuit dès qu'il s'inscrit par votre lien. Le vôtre s'ajoute à votre compte quand il fait son **premier vrai paiement** — pas à l'inscription, parce qu'un mois pour une inscription, c'est un mois pour une adresse jetable.",
      "Cet article, c'est la mécanique : comment le mois est gagné, où il va sur un compte mensuel, annuel ou en essai, et les limites. La page elle-même — le lien, le formulaire d'invitation, la liste des entreprises — est couverte dans [[refer-another-business|Parrainer une autre entreprise, gagner un mois gratuit]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque entreprise a un code de parrainage et un lien dans **Parrainage**. Une entreprise qui s'inscrit par ce lien commence avec son premier mois gratuit normal plus un mois de parrainage. Elle est ensuite listée sous **Entreprises que vous avez parrainées** comme **Inscrit — pas encore payant** jusqu'à ce que sa première facture payée passe, moment où la pastille devient **Crédité** et un mois s'ajoute à votre propre accès, automatiquement." },
          { p: "Le mois est de la même taille peu importe qui vous parrainez. Une entreprise Solo qui parraine une entreprise Scale gagne un mois de Solo; la taille de l'entreprise que vous amenez ne change pas ce que vous recevez — l'écran le dit en toutes lettres." },
        ],
      },
      {
        id: "how-a-month-is-earned",
        heading: "Comment un mois est gagné",
        blocks: [
          { steps: [
            "Ouvrez **Parrainage** (dans la barre latérale principale, ou sous Paramètres) et partagez **Votre lien** — **Copier**-le, ou utilisez **Envoyer une invitation** par courriel ou par texto. FieldQuo envoie un message et ne relance pas, et le formulaire d'invitation en permet 20 par jour.",
            "L'autre entreprise s'inscrit par le lien. Son essai gratuit est prolongé d'un mois sur-le-champ, et elle apparaît dans votre liste comme **Inscrit — pas encore payant**.",
            "Elle paie sa première vraie facture — le mois gratuit est à 0 $, donc le premier prélèvement après — après avoir terminé son intégration et connecté un compte Stripe vérifié pour encaisser des paiements.",
            "Votre mois s'ajoute dès que ce paiement tombe, et la ligne indique **Crédité**.",
          ] },
          { figure: "live:app-settings-refer", caption: "Parrainage — votre lien, le formulaire d'invitation, et les entreprises que vous avez parrainées avec leur état." },
          { note: "Deux conditions sur l'entreprise parrainée doivent être vraies avant que votre mois soit accordé : son intégration est terminée, et son propre compte Stripe pour les paiements de clients est vérifié. Une entreprise parrainée qui paie avant de connecter Stripe vous fait gagner le mois à sa prochaine facture payée une fois vérifiée — plus tard, pas jamais." },
        ],
      },
      {
        id: "when-it-lands",
        heading: "Où va le mois",
        blocks: [
          { table: {
            head: ["Votre compte", "Ce que fait le mois"],
            rows: [
              ["Encore dans le premier mois gratuit", "La date de fin de votre essai recule d'un mois. Rien n'est facturé d'ici là."],
              ["Payant au mois", "Votre prochain prélèvement est reporté d'un mois civil. Le forfait continue; vous n'êtes simplement pas facturé pour ce mois-là."],
              ["Payant à l'année", "Votre date de renouvellement recule d'un mois — une année qui finit le 27 août se renouvelle le 27 septembre. On ne vous facture pas une autre année pour le recevoir."],
            ],
          } },
          { p: "Les mois s'empilent à partir de la plus tardive des deux dates. Parrainez une deuxième entreprise avant que le premier mois soit écoulé et la date de fin recule d'un autre mois, pas à son point de départ. Un 31 qui tomberait dans un mois plus court devient le dernier jour de ce mois." },
        ],
      },
      {
        id: "the-rules",
        heading: "Les règles",
        blocks: [
          { bullets: [
            "**Un mois chacun**, pour le parrain et le parrainé, quelle que soit la taille de l'une ou l'autre entreprise.",
            "**Une entreprise qui existe déjà peut parrainer mais jamais réclamer.** Le lien est pour les entreprises nouvelles sur FieldQuo; un client existant qui se réinscrit par un lien ne reçoit rien.",
            "**Vous ne pouvez pas vous parrainer vous-même.** Vérifié sur le code, pas sur l'adresse courriel.",
            "**Au plus 50 parrainages crédités par entreprise par mois civil.** Un plafond contre les abus, pas une limite sur ce qu'un vrai parrainage rapporte.",
            "**Chaque entreprise parrainée vous fait gagner le mois une seule fois.** Un paiement réessayé ou un renouvellement ne paie jamais le même parrainage deux fois.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire et les administrateurs. Parrainage est un écran de facturation — il change quand l'entreprise est prélevée la prochaine fois — alors il est derrière la même règle que Compte et facturation et caché à tous les autres niveaux." },
        ],
      },
    ],
    faq: [
      { q: "L'entreprise que j'ai parrainée s'est inscrite il y a des semaines. Pourquoi ne suis-je toujours pas crédité?", a: "Sa ligne indique encore Inscrit — pas encore payant. Le mois est accordé à son premier vrai paiement, après son mois gratuit, et seulement une fois son intégration terminée et son compte Stripe pour les paiements de clients vérifié." },
      { q: "Est-ce un rabais ou un mois gratuit?", a: "Un mois gratuit : votre prochain prélèvement recule d'un mois. Ce n'est pas un crédit en dollars sur une facture plus grosse." },
      { q: "L'entreprise parrainée reçoit-elle quelque chose?", a: "Oui — un mois de plus ajouté à son essai gratuit à l'inscription, avant qu'elle ait payé quoi que ce soit." },
    ],
  },

  "ai-credit-and-phone-credit": {
    title: "Crédit IA et crédit téléphonique",
    summary:
      "Les deux soldes prépayés que FieldQuo compte — minutes téléphoniques et loyer de numéro sur l'un, images IA et lecture approfondie de photos sur l'autre — ce que chacun coûte, comment en acheter, et comment fonctionne la recharge automatique.",
    updated: "2026-09-12",
    intro: [
      "Votre forfait comprend FieldQuo AI et le copilote. Deux choses sont comptées à part, contre du crédit que vous achetez d'avance : la **réceptionniste téléphonique** (et les textos de l'équipe), et les **images IA** (la génération, et la lecture approfondie payante des photos d'une soumission). Elles puisent dans deux soldes différents, séparés volontairement, et les deux sont affichés dans **Paramètres → Crédit IA**.",
      "Le crédit s'achète de FieldQuo par Stripe en **dollars américains**, quelle que soit la devise de votre forfait. Il n'expire jamais, et il n'est jamais remboursé — y compris quand vous annulez le forfait.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Crédit IA** est un écran à trois cartes : **Crédit téléphonique** (le solde, un lien pour en acheter, et **Où le crédit est passé**), **Crédit image IA** (le solde, une rangée **Ajouter du crédit** de montants ponctuels, et son propre relevé), et **Forfait crédit IA — payez mensuellement, économisez par crédit** (une allocation récurrente sur le solde IA). Acheter du crédit téléphonique et configurer la recharge automatique se font sur la page des réglages **Réceptionniste téléphonique**, vers laquelle la première carte pointe." },
          { note: "Les deux soldes ne se mélangent pas. Le crédit téléphonique ne peut pas être dépensé en images et le crédit image ne peut pas être dépensé en appels. L'écran le dit sous son titre, pour que personne n'achète le mauvais." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { figure: "live:app-settings-ai-credit", caption: "Crédit IA — la carte Crédit téléphonique, la carte Crédit image IA avec ses montants Ajouter du crédit, et la carte Forfait crédit IA." },
          { bullets: [
            "**Crédit téléphonique** — le solde, une mention **bientôt épuisé** quand il reste moins de dix minutes, la note que les textos de l'équipe puisent dans ce même solde, **Ajouter du crédit téléphonique** (qui ouvre la page des réglages du téléphone), et le relevé.",
            "**Crédit image IA** — le solde avec ce qu'il achète entre parenthèses (environ N images, ou N lectures approfondies), les deux choses qui le dépensent, **Ajouter du crédit** avec quatre montants, et le relevé.",
            "**Forfait crédit IA** — la promesse de report en mots clairs, puis soit les trois forfaits avec **S'abonner**, soit le forfait où vous êtes, sa date de renouvellement, et **Annuler le forfait**.",
          ] },
        ],
      },
      {
        id: "prices",
        heading: "Ce que coûte chaque chose",
        blocks: [
          { table: {
            head: ["Élément", "Coût", "Solde utilisé"],
            rows: [
              ["Appel de la réceptionniste", "35 ¢ la minute, arrondi vers le haut, une minute minimum", "Crédit téléphonique"],
              ["Loyer d'un numéro local", "4 $ par mois", "Crédit téléphonique"],
              ["Loyer d'un numéro sans frais", "9 $ par mois, plus 5 ¢ la minute sur les appels", "Crédit téléphonique"],
              ["Ligne de textos de l'équipe", "4 $ par mois", "Crédit téléphonique"],
              ["Génération d'image IA", "12 ¢ l'image", "Crédit image IA"],
              ["Lecture approfondie des photos d'une soumission", "25 ¢ la lecture, jusqu'à 8 photos", "Crédit image IA"],
            ],
          } },
          { p: "Le premier numéro de téléphone vient avec **30 minutes gratuites**, une fois par entreprise. Un numéro dont le crédit ne peut plus couvrir le loyer reçoit un préavis de 7 jours puis est libéré pour de bon — voir [[settings-phone-receptionist|Réceptionniste téléphonique]]." },
        ],
      },
      {
        id: "buying-credit",
        heading: "Acheter du crédit",
        blocks: [
          { steps: [
            "Pour le **crédit téléphonique**, ouvrez **Paramètres → Réceptionniste téléphonique** et appuyez sur **Ajouter du crédit** dans la carte **Crédit**. Choisissez **10 $**, **30 $**, **50 $** ou **100 $** — chacun affiche les minutes qu'il achète — ou entrez n'importe quel montant de 5 $ à 1 000 $. La page de paiement de Stripe s'ouvre; le crédit arrive sur votre solde à votre retour, ou en une minute ou deux par la propre confirmation de Stripe si vous avez fermé l'onglet.",
            "Pour le **crédit image IA**, appuyez sur l'un des quatre montants **Ajouter du crédit** dans **Paramètres → Crédit IA** — les mêmes 10 $ / 30 $ / 50 $ / 100 $, chacun étiqueté avec les images qu'il achète — et payez sur la page de Stripe de la même façon.",
            "Pour une **allocation mensuelle**, appuyez sur **S'abonner** sur l'un des trois forfaits de crédit IA. Le crédit du premier mois est sur votre solde à votre retour; celui de chaque mois suivant s'ajoute quand la facture de ce mois est payée.",
          ] },
          { bullets: [
            "**starter** — 30 $ par mois pour 4 000 crédits (environ 333 images).",
            "**busy** — 50 $ par mois pour 7 000 crédits (environ 583 images).",
            "**agency** — 80 $ par mois pour 11 500 crédits (environ 958 images).",
          ] },
          { p: "Un crédit vaut un cent de valeur à l'usage, alors une génération coûte 12 crédits et une lecture approfondie 25. Le crédit de forfait inutilisé est reporté : rien n'expire, et annuler le forfait arrête le prélèvement et le crédit du mois suivant mais ne reprend jamais le crédit déjà accordé. Les forfaits sont facturés en dollars américains sur le même client Stripe que votre abonnement, alors une entreprise dont le forfait est facturé en **CAD** ne peut pas en démarrer un — le bouton **S'abonner** est désactivé et dit pourquoi. Les recharges ponctuelles fonctionnent quand même sur un compte en CAD." },
        ],
      },
      {
        id: "automatic-top-up",
        heading: "Recharge automatique du crédit téléphonique",
        blocks: [
          { p: "Désactivée tant que vous ne l'activez pas. Une fois activée, FieldQuo achète lui-même du crédit téléphonique quand le solde descend sous un seuil que vous choisissez, pour que la réceptionniste n'arrête jamais de répondre au milieu de la semaine. C'est vérifié toutes les 15 minutes, ça achète au plus **3 fois par jour**, et ça attend au moins 15 minutes entre deux achats." },
          { steps: [
            "Dans **Paramètres → Réceptionniste téléphonique**, trouvez **Recharger automatiquement** et appuyez sur **Configurer la recharge automatique**.",
            "Choisissez **Recharger quand le solde descend sous** (5 $, 10 $ ou 20 $) **et acheter ce montant à chaque fois** (10 $, 30 $, 50 $ ou 100 $), lisez et cochez les conditions, et appuyez sur **Continuer**. Stripe enregistre la carte avec un mandat en bonne et due forme; les conditions que vous avez acceptées sont consignées avec la date.",
            "La carte indique **La recharge automatique est activée**, avec le seuil, les quatre derniers chiffres de la carte, le montant et le maximum quotidien. **Désactiver la recharge automatique** l'arrête en gardant la carte; **Retirer la carte enregistrée** la retire. Changer le seuil ou le montant vous demande d'accepter les conditions de nouveau.",
          ] },
          { warning: "Si la carte enregistrée est refusée, FieldQuo désactive la recharge automatique et ne réessaie pas — réessayer une carte refusée est la façon de la faire bloquer. La carte sur la page des réglages le dit; réglez la carte avec votre banque, puis appuyez sur **Réactiver**. Annuler votre forfait FieldQuo ne désactive pas la recharge automatique." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire, les administrateurs, et quiconque est sur le préréglage Dispatcher ou Manager — les mêmes personnes qui peuvent gérer l'équipe. Acheter du crédit, s'abonner à un forfait et armer la recharge automatique sont refusés sur le serveur pour tous les autres. Un estimateur ou un accès d'équipier ne voit jamais les lignes Crédit IA ni Réceptionniste téléphonique." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le crédit est-il en dollars américains alors que mon forfait est en CAD?", a: "Les minutes téléphoniques et l'IA sont achetées en dollars américains et les taux de change bougent, alors les soldes sont tenus dans la devise où ils coûtent. Seul le forfait mensuel de crédit IA n'est pas disponible sur un compte en CAD; les recharges ponctuelles de l'un ou l'autre solde fonctionnent." },
      { q: "Le crédit inutilisé expire-t-il?", a: "Non. Aucun des deux soldes n'expire, et le crédit de forfait est reporté de mois en mois. Il n'est jamais remboursé non plus, y compris quand vous annulez votre forfait FieldQuo." },
      { q: "FieldQuo AI — poser des questions sur mes propres soumissions et factures — est-il compté?", a: "Non. FieldQuo AI et le copilote sont inclus dans chaque forfait. Seuls les minutes téléphoniques, le loyer de numéro, la génération d'images et la lecture approfondie de photos puisent dans le crédit." },
      { q: "Où est-ce que je vois à quoi le crédit a servi?", a: "Sous Où le crédit est passé sur chaque carte de la page Crédit IA : chaque débit et chaque recharge, datés. La page du téléphone porte le même relevé." },
    ],
  },

  "paying-for-the-migration-service": {
    title: "Payer le service de migration",
    summary:
      "Comment le service payant de migration de données est tarifé, accepté et payé — par la facturation de FieldQuo, jamais par votre compte Stripe — et ce que le prix achète et n'achète pas.",
    updated: "2026-09-12",
    intro: [
      "Le service de migration de données, c'est le personnel de FieldQuo qui apporte vos anciens clients et soumissions dans votre compte à la main, pour un prix que FieldQuo fixe après avoir vu ce que vous avez. Vous le demandez, FieldQuo le tarife, vous acceptez le prix, vous le payez, et seulement alors quelqu'un écrit quoi que ce soit dans votre compte. Cet article, c'est la moitié argent de tout ça; le service lui-même est décrit dans [[the-data-migration-service|Le service de migration de données]].",
      "Le paiement, c'est FieldQuo qui facture votre entreprise — un paiement, par Stripe, sur la même fiche client que votre abonnement. Il ne touche jamais au compte Stripe par lequel vos clients vous paient.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Tout se passe dans **Paramètres → Migration de données**. La carte de demande montre d'où viennent vos données, son état, et — une fois que FieldQuo l'a tarifée — le prix avec une note, et **Accepter** / **Refuser**. Accepter transforme la carte en étape de paiement avec **Payer et commencer la migration**; payer la transforme en carte de progression, et **Ce qui a été importé** se remplit en dessous à mesure que des fiches sont ajoutées." },
          { note: "Le prix et sa devise sont fixés par FieldQuo sur la demande. Le navigateur n'envoie jamais de montant à Stripe — la page de paiement est construite à partir du prix de la demande sur le serveur, la même règle que tout autre paiement dans FieldQuo suit." },
        ],
      },
      {
        id: "the-steps",
        heading: "De la demande au paiement",
        blocks: [
          { steps: [
            "Appuyez sur **Demander une migration** et dites où sont vos données maintenant (QuickBooks, Jobber, un chiffrier…) et tout ce qui vaut la peine d'être su. La carte indique **Demandée**.",
            "Réservez au besoin un appel sous **Réservez un appel avec FieldQuo** pour cerner l'ampleur; la carte indique **Appel réservé**. Vous pouvez téléverser les exports sous **Documents** à n'importe quel moment jusqu'ici ou plus tard.",
            "FieldQuo la tarife. La carte indique **Soumission prête**, avec le prix et une note qui l'explique.",
            "Appuyez sur **Accepter**. La carte indique **Acceptée — paiement dû**, avec la ligne « payez quand vous serez prêt à commencer ». Ou appuyez sur **Refuser**, ce qui met fin à la demande.",
            "Appuyez sur **Payer et commencer la migration**. La page de paiement de Stripe s'ouvre; payez là. À votre retour, la carte indique **Payée** et dit que FieldQuo vous contactera. Si vous avez fermé l'onglet après avoir payé, la propre confirmation de Stripe la marque quand même payée.",
            "Une fois que le personnel commence, la carte indique **En cours**; quand il termine, **Terminée**. Chaque client et chaque soumission qu'il a créés sont listés sous **Ce qui a été importé**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Migration de données — la carte de demande avec son état et son prix, et la carte Documents pour vos exports." },
        ],
      },
      {
        id: "the-statuses",
        heading: "Les états",
        blocks: [
          { table: {
            head: ["État", "Sens", "Pouvez-vous annuler?"],
            rows: [
              ["Demandée", "Reçue; pas encore tarifée", "Oui — Annuler cette demande"],
              ["Appel réservé", "Un appel de cadrage est planifié", "Oui"],
              ["Soumission prête", "FieldQuo a fixé un prix", "Oui, ou Refuser"],
              ["Acceptée — paiement dû", "Vous avez accepté; rien n'est écrit tant que vous ne payez pas", "Oui"],
              ["Payée", "Paiement reçu; le personnel n'a pas commencé", "Non — c'est une conversation avec le soutien"],
              ["En cours", "Le personnel crée des fiches", "Non"],
              ["Terminée", "Fait", "—"],
              ["Refusée", "Vous avez refusé le prix", "—"],
              ["Annulée", "Annulée par vous ou par FieldQuo", "—"],
            ],
          } },
        ],
      },
      {
        id: "what-you-are-paying-for",
        heading: "Ce que le prix achète, exactement",
        blocks: [
          { bullets: [
            "**De nouveaux clients et de nouvelles soumissions, créés par un superadministrateur FieldQuo dans votre compte.** Rien de ce qui existait déjà n'est jamais modifié ni supprimé.",
            "**Chaque écriture est consignée** — qui, quand, quelle migration, ce qui a été créé — dans la même transaction que la fiche elle-même.",
            "**Les écritures ne sont possibles que tant que la demande est Payée ou En cours**, et c'est revérifié à chaque écriture, jamais tenu pour acquis d'un moment antérieur.",
            "**Pas de factures, pas de chantiers, pas d'importation automatique.** Il n'y a pas de bouton « Importer de QuickBooks »; une personne lit votre export et saisit les fiches. Les factures et les chantiers ne font pas partie du service aujourd'hui.",
          ] },
        ],
      },
      {
        id: "refunds-and-cancelling",
        heading: "Remboursements et annulation",
        blocks: [
          { p: "Avant de payer, **Annuler cette demande** y met fin et rien n'est dû. Après avoir payé, le bouton a disparu : reculer sur une migration payée est une conversation avec le soutien, et FieldQuo peut l'annuler de son côté — dès qu'il le fait, le chemin d'écriture se ferme." },
          { warning: "FieldQuo n'émet pas de remboursement automatique quand une migration payée est annulée. S'il en est dû un, il est fait à la main depuis le tableau de bord Stripe. Demandez-le dans la même conversation." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire et les administrateurs — la ligne Migration de données est un écran de facturation, protégé de la même façon que Compte et facturation, et les actions demander, accepter et payer sont refusées sur le serveur pour tous les autres. Ce qui a été importé est ensuite des données ordinaires de clients et de soumissions, visibles par quiconque peut voir les clients et les soumissions." },
        ],
      },
    ],
    faq: [
      { q: "La migration est-elle facturée par mon compte Stripe?", a: "Non. C'est FieldQuo qui facture votre entreprise, par la propre facturation de FieldQuo, comme votre abonnement. Les paiements de vos clients et vos virements ne sont pas touchés." },
      { q: "Quelque chose est-il écrit dans mon compte avant que je paie?", a: "Non. Les écritures sont refusées tant que la demande n'est pas Payée, et refusées de nouveau dès qu'elle est annulée ou terminée." },
      { q: "FieldQuo peut-il changer une soumission que j'avais déjà?", a: "Non. Le service crée de nouvelles fiches seulement. Les soumissions, clients et factures existants ne sont jamais modifiés ni supprimés par le personnel de FieldQuo." },
    ],
  },

  "taxes-and-currency-on-your-subscription": {
    title: "Taxes et devise de votre abonnement",
    summary:
      "Pourquoi une entreprise canadienne paie en CAD et une américaine en USD, comment les taxes de vente s'ajoutent au prélèvement de FieldQuo à la page de paiement, et pourquoi rien de tout ça ne touche aux taxes de vos propres factures.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo facture dans **votre propre devise** : dollars canadiens pour une entreprise au Canada, dollars américains pour une entreprise aux États-Unis. Les prix des forfaits sont le même nombre dans chacune — Solo, c'est 99 en CAD pour un Canadien et 99 en USD pour un Américain — alors personne ne paie un prix affiché plus un taux de change plus des frais de carte. Les taxes de vente sur ce prélèvement sont calculées par Stripe d'après votre adresse de facturation et ajoutées à la page de paiement.",
      "C'est le prélèvement de FieldQuo envers vous. Ça n'a rien à voir avec les taxes que vous facturez à vos clients : celles-là se règlent dans **Paramètres → Profil de l'entreprise** et s'appliquent à vos soumissions et à vos factures, et les deux ne se croisent jamais.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Votre devise de facturation est décidée une fois, d'après le pays de l'adresse de votre entreprise, et chaque prélèvement de FieldQuo sur votre abonnement est dans cette devise : le forfait mensuel ou annuel, la différence au prorata d'une montée de forfait, une descente programmée. Stripe garde une seule devise par client, alors elle ne peut pas changer plus tard sans une nouvelle fiche client — c'est pourquoi la grille des forfaits ne vous montre jamais que la seule rangée qui correspond à votre adresse." },
        ],
      },
      {
        id: "currency",
        heading: "Dans quelle devise vous êtes facturé",
        blocks: [
          { table: {
            head: ["Adresse de l'entreprise", "Devise de facturation", "Affichée comme"],
            rows: [
              ["Canada", "CAD", "CA$"],
              ["États-Unis", "USD", "US$"],
              ["Ailleurs, ou pas encore d'adresse", "Pas décidée — la grille Forfaits vous demande d'abord d'ajouter l'adresse de votre entreprise", "—"],
            ],
          } },
          { p: "Les quatre échelons sont 99, 169, 269 et 369 par mois, les mêmes chiffres dans l'une ou l'autre devise, et un **Engagement d'un an**, c'est dix mois pour douze — voir [[the-four-plans|Les quatre forfaits]] et [[monthly-or-a-year-commitment|Au mois, ou un engagement d'un an]]. Si Compte et facturation dit qu'il doit savoir où se trouve votre entreprise, appuyez sur **Ajouter l'adresse de votre entreprise**, enregistrez le pays, et revenez." },
        ],
      },
      {
        id: "sales-tax",
        heading: "Les taxes de vente sur le prélèvement",
        blocks: [
          { bullets: [
            "**Stripe Tax calcule le taux** d'après l'adresse de facturation que vous entrez à la page de paiement, et l'ajoute comme sa propre ligne — TPS/TVH/TVQ pour une adresse canadienne, taxe de vente d'État là où un État américain en prélève une.",
            "**Une adresse de facturation est requise** à la page de paiement pour cette raison, et Stripe la réécrit sur votre fiche client pour que les renouvellements, qui ne passent pas par la page de paiement, soient taxés de la même façon.",
            "**Vous pouvez entrer votre numéro de taxe** à la page de paiement — un numéro d'entreprise du Québec ou américain — et il apparaît sur la facture que Stripe émet.",
            "**Un changement de forfait programmé garde le réglage de taxes** avec lequel il a commencé, alors une descente programmée pour la date de renouvellement est taxée exactement comme le forfait qu'elle remplace.",
          ] },
          { note: "Rien de tout ça ne change ce que vos clients paient. Les taxes sur vos soumissions et vos factures viennent de vos propres réglages de taxes — voir [[tax-settings|Réglages des taxes]] et [[sales-tax-on-invoices|Taxes de vente sur les factures]] — et sont facturées dans la devise de votre entreprise par votre propre compte Stripe. La taxe automatique de Stripe n'y est volontairement pas appliquée, parce que ça taxerait une deuxième fois un total déjà taxé." },
        ],
      },
      {
        id: "what-is-not-taxed-here",
        heading: "Les autres prélèvements de FieldQuo",
        blocks: [
          { p: "Le crédit téléphonique, le crédit image IA et le forfait mensuel de crédit IA sont tarifés en **dollars américains** quelle que soit la devise de votre forfait, parce que les minutes et l'IA s'achètent en dollars américains — voir [[ai-credit-and-phone-credit|Crédit IA et crédit téléphonique]]. Le forfait mensuel de crédit IA ne peut pas être démarré sur un compte en CAD pour cette raison; les recharges ponctuelles, oui. Le service de migration est tarifé par FieldQuo sur la demande elle-même. La taxe automatique de Stripe s'applique à la page de paiement de l'abonnement et à ses renouvellements; ces autres prélèvements ponctuels n'y passent pas aujourd'hui." },
        ],
      },
      {
        id: "where-to-see-it",
        heading: "Où voir la devise et les taxes",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Compte et facturation**. La carte du forfait montre votre prix dans votre devise de facturation, par mois ou par année.",
            "Appuyez sur **Gérer la facturation et le mode de paiement**. Le portail de Stripe liste chaque facture que FieldQuo vous a émise, chacune avec la ligne de taxes et votre numéro de taxe si vous l'avez donné — voir [[invoices-and-receipts-from-fieldquo|Factures et reçus de FieldQuo]].",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Compte et facturation — le prix du forfait dans la devise de facturation de l'entreprise, et le bouton qui ouvre le portail de Stripe." },
        ],
      },
    ],
    faq: [
      { q: "J'ai déménagé mon entreprise du Canada aux États-Unis. Ma facturation peut-elle passer en USD?", a: "Pas par vous-même. Stripe tient une seule devise par client, alors le changement demande une nouvelle fiche client du côté de FieldQuo — écrivez-nous." },
      { q: "Le prix sur la page de tarification est-il avant ou après taxes?", a: "Avant. Les taxes s'ajoutent à la page de paiement d'après votre adresse de facturation, sur leur propre ligne, et figurent sur chaque facture que Stripe émet." },
      { q: "Le réglage de taxes de FieldQuo touche-t-il mes factures à mes clients?", a: "Non. Vos factures utilisent vos propres réglages de taxes. Le prélèvement de FieldQuo envers vous et votre facturation à vos clients sont deux ventes distinctes dans deux intégrations Stripe distinctes." },
    ],
  },

  "closing-your-account": {
    title: "Fermer votre compte et vos données",
    summary:
      "Annuler arrête la facture mais garde chaque fiche; supprimer est une demande écrite exécutée par une personne dans les 30 jours ouvrables. Ce que chacun fait, comment demander, et ce qui est conservé malgré tout.",
    updated: "2026-09-12",
    intro: [
      "Deux choses différentes se confondent facilement. **Annuler** l'abonnement met fin à la facture et, après 30 jours de lecture seule, verrouille le compte — mais rien n'est effacé, jamais, par ça. **Supprimer** les données est une demande écrite distincte : il n'y a aucun bouton dans FieldQuo qui supprime un compte, et la suppression n'est pas automatique. Une personne chez FieldQuo l'exécute à la main dans les **30 jours ouvrables** suivant la réception de votre demande, et vous recevez un courriel quand c'est fait.",
      "Cet article dit comment demander, ce qui se passe après, ce que vous pouvez supprimer vous-même depuis le produit aujourd'hui, et ce que FieldQuo garde même quand on le lui demande — parce qu'on préfère que vous le lisiez ici plutôt que de le découvrir après.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo n'a pas de tâche de purge : les fiches ne sont pas effacées après un an, ni jamais, à moins que quelqu'un les supprime. Un abonnement échu ou annulé rend le compte inaccessible — personne ne peut se connecter une fois la fenêtre de lecture seule terminée — mais les soumissions, factures, clients et photos en dessous sont intacts, et redémarrer un forfait ramène tout. C'est la direction sûre pour les dossiers d'une entreprise, et c'est pourquoi supprimer est un acte délibéré et distinct." },
          { warning: "La suppression est irréversible. FieldQuo vous demandera de confirmer qui vous êtes avant de supprimer quoi que ce soit — une demande d'une adresse qu'on ne peut pas situer, c'est exactement la façon dont une personne efface les dossiers d'une autre — et une suppression ne peut pas être annulée en redémarrant un forfait." },
        ],
      },
      {
        id: "cancel-vs-delete",
        heading: "Annuler ou supprimer",
        blocks: [
          { table: {
            head: ["Quoi", "Annuler l'abonnement", "Supprimer les données"],
            rows: [
              ["Comment", "Annuler le forfait dans Compte et facturation — en libre-service", "Une demande écrite, par courriel ou par le formulaire public Data Deletion du site web de FieldQuo"],
              ["Quand", "Le forfait se termine immédiatement; lecture seule pendant 30 jours, puis verrouillé", "Exécuté à la main dans les 30 jours ouvrables suivant la demande"],
              ["Vos dossiers", "Conservés au complet; revenez en redémarrant un forfait", "Effacés, sauf ce que la section « Ce qui est conservé » liste"],
            ],
          } },
          { p: "Si vous fermez l'entreprise, faites les deux, dans cet ordre : annulez d'abord (voir [[cancel-your-subscription|Annuler votre abonnement]]) pour que rien d'autre ne soit facturé, puis envoyez la demande de suppression une fois que vous avez téléchargé ce dont votre comptable a besoin." },
        ],
      },
      {
        id: "how-to-request-deletion",
        heading: "Comment demander la suppression",
        blocks: [
          { steps: [
            "Téléchargez d'abord ce dont vous avez besoin — l'export comptable et toutes les factures — pendant que le compte est encore ouvert. Une fois supprimé, rien ne peut être récupéré.",
            "Écrivez à **hello@fieldquo.com** avec l'objet **Data deletion request**, depuis l'adresse courriel avec laquelle vous vous êtes inscrit, ou utilisez le formulaire de la page **Data Deletion** du site web de FieldQuo, qui enregistre la même demande et vous envoie une référence par courriel tout de suite.",
            "Dites quelle entreprise FieldQuo la demande concerne (votre entreprise), que vous êtes le titulaire du compte, le courriel sous lequel le compte est, et si vous voulez tout supprimer ou quelque chose de précis.",
            "Gardez la référence que vous recevez — elle ressemble à **FQ-DEL-7K3M9Q**. La taper dans la page Data Deletion montre si la demande est reçue ou terminée, avec les dates, et rien d'autre.",
          ] },
          { note: "Un de vos clients — un propriétaire — peut demander aussi, mais pour ses dossiers, l'entreprise est le responsable du traitement et FieldQuo est son sous-traitant. Son chemin le plus rapide est de vous le demander, et vous pouvez supprimer sa fiche depuis le produit vous-même si elle ne porte ni soumission ni facture. Une demande qu'il envoie à FieldQuo au sujet de vos dossiers vous est transmise." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Ce qui se passe ensuite",
        blocks: [
          { bullets: [
            "**Vous recevez une confirmation** dès que le formulaire est soumis, avec la date de réception et votre référence. Si vous avez écrit par courriel, une personne répond avec la même confirmation dans les 30 jours.",
            "**Une personne supprime les données à la main**, directement dans la base de données, dans les 30 jours ouvrables suivant la réception de la demande. Si votre identité doit d'abord être confirmée, on écrit à l'adresse d'où vient la demande.",
            "**Vous recevez un deuxième courriel quand c'est fait**, avec la date et la référence. Là où quelque chose a dû être conservé, le courriel le dit plutôt que de passer par-dessus en silence.",
            "**Vous pouvez suivre la demande n'importe quand** avec la référence sur la page Data Deletion. La ligne d'état montre des dates et un état seulement, jamais qui a demandé.",
          ] },
        ],
      },
      {
        id: "what-is-kept",
        heading: "Ce qui est conservé, et pourquoi",
        blocks: [
          { bullets: [
            "**Les désabonnements et les réponses STOP**, en permanence. Un retrait est une instruction permanente; le supprimer remettrait la personne sur une liste.",
            "**Les dossiers financiers et fiscaux** qu'une entreprise est généralement tenue de conserver — factures, paiements et la piste comptable derrière. Là où une demande en retirerait un, la réponse le dit.",
            "**Les dossiers qui appartiennent à l'entreprise d'un entrepreneur plutôt qu'à la personne qui demande.** Là où FieldQuo n'est que le sous-traitant, il transmet la demande plutôt que de supprimer les données d'une entreprise sur l'instruction d'un tiers.",
            "**La trace de la demande de suppression elle-même** — la référence, l'adresse où la confirmation est allée, et les dates. C'est la preuve que vous avez demandé et que ça a été fait.",
          ] },
        ],
      },
      {
        id: "what-you-can-delete-yourself",
        heading: "Ce que vous pouvez supprimer vous-même, aujourd'hui",
        blocks: [
          { bullets: [
            "**Une fiche client** — seulement si ce client n'a ni soumission ni facture. Une fiche avec un historique de facturation est refusée, parce que la supprimer laisserait orphelins des dossiers financiers que vous devez peut-être conserver.",
            "**Des soumissions, factures, chantiers, tâches, rendez-vous, dépenses, photos, campagnes marketing et fiches d'abonnés individuels**, chacun depuis son propre écran, selon votre niveau d'accès.",
            "**Un compte publicitaire Meta connecté** — **Paramètres → Publicités Meta → Déconnecter** supprime la connexion enregistrée d'un coup, jeton chiffré compris. Les totaux de dépenses importés restent, parce que c'est votre historique marketing; dites-le dans une demande écrite si vous voulez qu'ils partent aussi.",
          ] },
          { p: "Tout ce qui va au-delà — un compte entier compris — passe par la demande écrite ci-dessus, traitée par une personne." },
        ],
      },
    ],
    faq: [
      { q: "Y a-t-il un bouton pour supprimer mon compte?", a: "Non. La suppression est une demande écrite, exécutée à la main dans les 30 jours ouvrables, et confirmée par courriel. Annuler le forfait est en libre-service; supprimer les données ne l'est pas." },
      { q: "Si j'annule et ne reviens jamais, mes données finissent-elles par être supprimées?", a: "Non. Rien n'expire selon un calendrier. Le compte devient inaccessible après la fenêtre de lecture seule de 30 jours, mais les dossiers restent jusqu'à ce que quelqu'un demande leur suppression." },
      { q: "Puis-je obtenir une copie de tout avant que ce soit supprimé?", a: "Téléchargez l'export comptable et vos factures pendant que le compte est ouvert; après la fenêtre de lecture seule, le compte est verrouillé, et après la suppression, rien ne peut être récupéré. Redémarrer le forfait pendant la fenêtre le rouvre." },
    ],
  },
};
