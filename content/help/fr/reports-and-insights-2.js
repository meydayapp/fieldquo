// content/help/fr/reports-and-insights-2.js
//
// Partie 2 de la catégorie « reports-and-insights » en français (voir le
// composeur, reports-and-insights.js). Slugs de cette partie
// (lib/help/tree.js) : kpi-customer, the-metrics-fieldquo-refuses-to-invent,
// weekly-digests, the-monthly-digest-email, financial-statements,
// won-and-lost, estimate-accuracy, expense-tracking-and-burn-rate,
// import-expenses-from-a-bank-csv, overhead-and-your-minimum-price.
//
// Même structure que le module anglais; les mots à l'écran viennent du bloc
// `fr` de app/i18n/appMessages.js. Les libellés de lignes des états
// financiers et les phrases de constats du rapport de justesse sont en
// anglais dans l'application aujourd'hui, et sont cités tels quels.
export const ARTICLES = {
  "kpi-customer": {
    title: "KPI : Client",
    summary:
      "La section Client du tableau de bord KPI : une note de satisfaction sur 5, d'où viennent les réponses, le seuil avant qu'un chiffre s'affiche, et qui peut la voir.",
    updated: "2026-09-12",
    intro: [
      "La section **Client** se trouve vers le bas des **KPI**, juste au-dessus de **Non suivi**. Elle porte un seul chiffre — **Satisfaction client**, une moyenne sur 5 — et un petit graphique à barres montrant comment les réponses se répartissent par note. Chaque réponse derrière lui vient d'un client qui a touché un chiffre dans le courriel de demande d'avis après la fin d'un chantier.",
      "Cet article dit exactement ce que la carte moyenne, pourquoi elle peut afficher un tiret au lieu d'un chiffre, et comment la réponse d'un client arrive là en premier lieu.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo pose une question au client après un chantier terminé — **How did we do?**, sur une échelle de 1 à 5 — et cette carte est la moyenne des réponses pour les chantiers terminés dans la période que vous avez choisie en haut de la page. Ce n'est pas une note d'avis, pas une note Google, et pas une estimation : un client à qui le sondage a été envoyé et qui n'a jamais répondu n'est pas compté du tout." },
          { p: "Le sous-titre de la section dit lui-même d'où viennent les réponses : « Ce que disent les clients une fois le travail terminé — une seule question, envoyée avec le courriel de demande d'avis. » Le sondage voyage dans le même courriel que la demande d'avis, alors une entreprise qui n'a pas configuré les demandes d'avis ne recueille aucune donnée de satisfaction non plus." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Satisfaction client** — la moyenne, imprimée **4.6 / 5**, avec le nombre de réponses en dessous (« 9 chantiers/soumissions »). L'indication se lit : « Moyenne du sondage à une question envoyé après un chantier. Seules les entreprises ayant défini un lien d'avis le reçoivent aujourd'hui — il voyage dans le même courriel. »",
            "**Réponses par note** — cinq barres, une par note de 1 à 5, avec le nombre de réponses à côté de chacune. Il n'apparaît qu'une fois la moyenne elle-même affichée.",
            "**« {count} de ces réponses ont noté 1 ou 2 — un suivi téléphonique serait utile. »** — une ligne ambre sous les barres dès qu'au moins une réponse était un 1 ou un 2. Cette phrase est tout ce que FieldQuo fait d'une mauvaise note : pas de tâche, pas de texto, pas d'alerte.",
          ] },
          { figure: "harness:kpis-cash", caption: "KPI — les sections Trésorerie, Client et Non suivi au pied du tableau de bord; Satisfaction client à 4.6 / 5 sur 9 réponses, réparties par note." },
        ],
      },
      {
        id: "how-an-answer-gets-here",
        heading: "Comment la réponse d'un client arrive ici",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Avis**. Collez **Votre lien d'avis**, activez **Demander automatiquement**, et choisissez un délai sous **Quand demander** — de **2 heures plus tard** à **Une semaine plus tard**. Sans lien d'avis, rien n'est envoyé, et donc rien n'est recueilli.",
            "Marquez le chantier **terminé**. Une fois le délai passé, le client qui a une adresse courriel au dossier reçoit un seul courriel de demande d'avis de votre entreprise — jamais plus d'un par chantier, et jamais pour un chantier terminé il y a plus de 30 jours.",
            "Le courriel porte une rangée de cinq boutons numérotés. En toucher un ouvre une courte page aux couleurs de votre entreprise : **How did we do?**, les cinq notes, un commentaire facultatif, et **Send**. La page est dans la langue dans laquelle le courriel a été envoyé.",
            "Appuyer sur **Send** enregistre la note une fois. Le lien ne peut pas servir à répondre deux fois, et un analyseur de courriel qui l'ouvre n'enregistre rien — seul l'appui sur **Send** compte.",
          ] },
          { note: "Le courriel et la page du sondage portent votre logo et votre couleur de marque, pas ceux de FieldQuo. Un client qui s'est désabonné de vos demandes d'avis est ignoré, et n'est donc jamais interrogé. Tout le détail sur le courriel lui-même : [[review-requests|Les demandes d'avis après un chantier]]." },
        ],
      },
      {
        id: "what-the-number-means",
        heading: "Ce que le chiffre veut dire, exactement",
        blocks: [
          { table: {
            head: ["Question", "Réponse"],
            rows: [
              ["Ce qui est moyenné", "Chaque note de 1 à 5 enregistrée pour un chantier terminé dans la période choisie. Arrondi à une décimale."],
              ["Ce qui compte comme échantillon", "Les réponses seulement. Un sondage envoyé et jamais répondu n'est pas dans le compte et ne tire pas la moyenne vers le bas."],
              ["Le seuil", "5 réponses. En dessous, la carte affiche un tiret et « {n} sur 5 pour l'instant — {remaining} de plus et ce chiffre devient fiable. »"],
              ["Aucune réponse du tout", "« Aucun client n'a encore répondu au sondage de satisfaction. Une fois que 5 auront répondu, ce chiffre s'affichera ici. »"],
              ["Mauvaises notes", "Un 1 ou un 2. Comptées et nommées sous le graphique à barres; rien d'autre n'est déclenché."],
            ],
          } },
          { p: "Le seuil de cinq réponses est le même que le tableau de bord utilise pour la valeur moyenne d'un chantier et les chiffres de marge : la moyenne est l'affirmation, et une moyenne de trois touches est une anecdote. Les cartes de taux de réussite utilisent un seuil de dix parce qu'un pourcentage bouge davantage sur un seul basculement; voir [[the-kpi-dashboard|Le tableau de bord KPI]] pour les deux seuils." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute la page KPI est tout ou rien : elle exige l'interrupteur **Job costing**, **See prices**, et un accès en consultation aux soumissions, aux chantiers (toute l'entreprise), aux factures et aux demandes. Parmi les niveaux d'accès livrés, cela veut dire **Manager**, les administrateurs et le propriétaire. Crew, Estimator et Dispatcher ne voient pas la ligne **KPI**, et taper l'adresse donne un refus, pas une page à laquelle il manque une carte. La carte de satisfaction n'ajoute aucune barrière propre." },
        ],
      },
    ],
    faq: [
      { q: "Nous avons des dizaines d'avis Google. Pourquoi la carte est-elle vide ?", a: "Les avis collés dans Paramètres → Avis sont des témoignages pour votre site web, pas des réponses au sondage. Cette carte ne compte que les touches de 1 à 5 venues du courriel que FieldQuo envoie après un chantier, et il lui en faut cinq avant d'imprimer un chiffre." },
      { q: "Un client peut-il changer sa réponse ?", a: "Avant d'appuyer sur Send, oui — la page a un lien Change your answer. Après Send, la note est enregistrée une fois et le lien est consommé; le rouvrir dit que la réponse a déjà été reçue." },
      { q: "Une mauvaise note prévient-elle quelqu'un ?", a: "Non. La carte imprime combien de réponses étaient un 1 ou un 2 et suggère un appel. Il n'y a ni notification, ni tâche, ni message automatique derrière." },
      { q: "À quelle période appartient une note ?", a: "À la période où le chantier a été terminé, pas au jour où le client a répondu. Passer de Ce trimestre à Le mois dernier change quels chantiers sont dans le compte." },
    ],
  },

  "the-metrics-fieldquo-refuses-to-invent": {
    title: "Les indicateurs que FieldQuo refuse d'inventer",
    summary:
      "La section Non suivi au pied du tableau de bord KPI : les deux chiffres que FieldQuo ne calcule volontairement pas, pourquoi, où vit la version honnête de chacun, et la règle derrière chaque tiret de la page.",
    updated: "2026-09-12",
    intro: [
      "La dernière section des **KPI** s'appelle **Non suivi**, et son sous-titre résume l'idée : « Des indicateurs qu'un tableau de bord comme celui-ci porte habituellement, pour lesquels FieldQuo n'invente pas de chiffres. » Au lieu d'une carte avec un pourcentage d'allure plausible, vous obtenez le nom de l'indicateur et un paragraphe expliquant pourquoi il n'y a pas de chiffre en dessous.",
      "Deux entrées s'y trouvent aujourd'hui. Cet article explique les deux, dit où vit réellement la version honnête de chaque chiffre, et couvre la règle plus large que suit le reste de la page : une carte sans données affiche un tiret et une raison, jamais un zéro.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque chiffre de la page KPI est de l'arithmétique sur des lignes qui existent — soumissions, chantiers, factures, heures approuvées, dépenses saisies. Quand les lignes dont un indicateur a besoin sont tapées à la main, ne portent aucun lien vers la chose par laquelle elles seraient divisées, ou ne sont tout simplement pas enregistrées, la page le dit plutôt que d'imprimer un chiffre qui a l'air précis et ne veut rien dire. La liste a raccourci à mesure que les données sont arrivées, et c'est bien le but." },
          { p: "Les deux entrées sont écrites dans les mots du produit et, aujourd'hui, en anglais sur l'écran de chaque langue — elles ne sont pas traduites comme le sont les libellés des cartes au-dessus." },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Coût par prospect",
        blocks: [
          { p: "Ce que dit la page : le chiffre de prospects sur une ligne de dépense marketing est tapé à la main, et en dehors des formulaires de prospects Meta, aucun prospect dans FieldQuo ne porte d'identifiant de campagne ni de valeur UTM. Un coût par prospect par canal construit sur un dénominateur tapé à la main, sans moyen d'attribuer un prospect à un canal, aurait l'air précis et ne voudrait rien dire — il est donc refusé." },
          { bullets: [
            "**Par campagne, pour les prospects des formulaires Meta seulement** — le seul chemin avec un identifiant des deux côtés, une ligne de dépense synchronisée et un prospect arrivé par un formulaire Meta. Ce chiffre est réel et il est affiché dans [[marketing-spend|Dépenses marketing]].",
            "**Combiné, sur l'ensemble** — la dépense marketing totale du mois divisée par chaque vrai prospect de chaque canal d'entrée actif, les prospects saisis à la main ou importés d'un fichier étant exclus du dénominateur. Ce chiffre se trouve dans [[the-monthly-digest-email|Le courriel de résumé mensuel]], et il ne prétend jamais savoir quel canal a produit quel prospect.",
          ] },
        ],
      },
      {
        id: "equipment-utilisation",
        heading: "Utilisation de l'équipement",
        blocks: [
          { p: "Ce que dit la page : FieldQuo enregistre maintenant quel actif était sur quel chantier, alors les données existent — mais l'utilisation d'un parc n'est pas naturellement un taux pour une période comme le sont les autres cartes, et l'y forcer (« utilisé 62 % des jours ce mois-ci ») inventerait une affirmation sur le nombre de jours où le compresseur aurait dû servir, ce que rien dans le produit n'énonce." },
          { note: "L'entrée dit que le chiffre vit sur son propre écran dans Paramètres → Actifs. Aujourd'hui, aucun écran de FieldQuo ne lit ce rapport. Le registre **Actifs et amortissement** dans **Paramètres → Frais généraux** montre ce que chaque article a coûté et ce qu'il vaut aux livres, pas à quelle fréquence il a servi — voir [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]]." },
        ],
      },
      {
        id: "what-used-to-be-here",
        heading: "Ce qui figurait autrefois sur cette liste",
        blocks: [
          { p: "Trois indicateurs ont quitté la liste dès que le produit a eu quelque chose d'honnête pour les calculer, et chacun est maintenant une vraie carte sur la page :" },
          { bullets: [
            "**Taux de reprises et rappels** et **taux d'avenants** — sous **Qualité**, dès qu'une visite a pu être marquée comme un retour et qu'un changement de portée est devenu son propre enregistrement. Voir [[kpi-quality|KPI : Qualité]].",
            "**Satisfaction client** — sous **Client**, dès que le sondage à une question a existé pour demander et que quelque chose a existé pour faire la moyenne. Voir [[kpi-customer|KPI : Client]].",
            "**Taux d'incidents de sécurité** — dès que les incidents ont été consignés contre les heures approuvées. Il ne s'imprime qu'au-delà de 1 000 heures approuvées dans la période.",
          ] },
        ],
      },
      {
        id: "the-rule-behind-every-dash",
        heading: "La règle derrière chaque tiret",
        blocks: [
          { table: {
            head: ["Ce que vous voyez", "Ce que cela veut dire"],
            rows: [
              ["—, avec « {n} sur 10 pour l'instant — {remaining} de plus et ce chiffre devient fiable. »", "Un taux — taux de réussite, conversion prospect → soumission, achèvement à temps — avec moins de 10 cas décidés. Un seul basculement le ferait bouger de plus de dix points."],
              ["—, avec « {n} sur 5 pour l'instant… »", "Une valeur centrale — valeur moyenne d'un chantier, marge, satisfaction — tirée de moins de 5 chantiers ou réponses."],
              ["—, avec une phrase simple", "Les lignes dont le chiffre a besoin n'existent pas encore, et la phrase dit lesquelles : aucune soumission décidée, aucun chantier terminé, aucune capacité définie dans Paramètres → Frais généraux, aucune facture jamais émise."],
              ["Un chiffre avec un triangle ambre", "Réel, mais incomplet de façon connue — des heures sans taux, des feuilles de temps en attente d'approbation, des matériaux cochés sur la liste d'achats mais jamais saisis en dépense. La note sous la carte dit ce qui manque."],
              ["Un vrai 0", "Un vrai zéro : rien en retard, aucun carnet. Zéro et inconnu sont deux phrases différentes et la page les garde séparées."],
            ],
          } },
          { p: "La même discipline traverse les autres rapports du groupe : **Gagnées et perdues** imprime « Trop peu pour conclure » sous dix décisions, **Justesse des estimations** imprime des effectifs mais aucun pourcentage sous cinq chantiers comparables, et **États financiers** imprime « Rien d'enregistré » ou « Indisponible » plutôt que 0,00 $." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les mêmes personnes que le reste de la page — **Manager**, les administrateurs et le propriétaire, parce que le tableau de bord KPI exige l'interrupteur **Job costing** et refuse en bloc sans lui. Voir [[the-kpi-dashboard|Le tableau de bord KPI]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je désactiver la section Non suivi ?", a: "Non. Elle fait partie de la page, et c'est la réponse honnête aux deux questions qu'un entrepreneur pose le plus souvent à un tableau de bord. Il n'y a rien à configurer." },
      { q: "Le coût par prospect par canal sera-t-il un jour suivi ?", a: "Seulement si les prospects se mettent à porter une source qui peut être reliée à une dépense. Aujourd'hui, cela n'existe que pour les formulaires de prospects Meta, et ce chiffre par campagne est déjà sur la page Dépenses marketing." },
      { q: "Pourquoi une carte affiche-t-elle parfois un chiffre avec un triangle d'avertissement ?", a: "Parce que le chiffre est réel mais incomplet — certaines heures n'ont pas de taux, ou certaines feuilles de temps attendent encore l'approbation. Le triangle, c'est FieldQuo qui refuse de faire disparaître le trou dans une moyenne." },
    ],
  },

  "weekly-digests": {
    title: "Résumés hebdomadaires",
    summary:
      "Ce qu'ouvre le lien Résumés hebdomadaires de la page Analyses — la page Résumé mensuel — ce que contient chaque entrée, et le fait tout simple que FieldQuo ne produit aucun résumé hebdomadaire aujourd'hui.",
    updated: "2026-09-12",
    intro: [
      "Sous le titre des **Analyses** (la page **Comment vous vous comparez**) se trouve une rangée de liens vers le reste du groupe de rapports. Le premier se lit **Résumés hebdomadaires**. Il ouvre une page intitulée **Résumé mensuel** — « Résumés automatisés du rendement de votre entreprise chaque mois. » Le nom du lien est plus ancien que la page qu'il ouvre.",
      "Pour être clair, donc : FieldQuo n'écrit pas de résumé hebdomadaire. Rien ne tourne chaque semaine, rien n'est envoyé par courriel chaque semaine, et aucun réglage ne changerait cela. Ce que le lien vous donne, c'est la liste des comptes rendus mensuels, et cet article porte sur cette liste. Le courriel que chacun envoie est couvert dans [[the-monthly-digest-email|Le courriel de résumé mensuel]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une fois par mois, le premier, FieldQuo écrit un court résumé pour chaque entreprise active — trois ou quatre phrases de l'IA FieldQuo autour d'un ensemble fixe de chiffres, plus les signalements que le code lui-même a levés — le classe sous le mois qu'il couvre, et l'envoie par courriel au propriétaire et aux administrateurs. La page **Résumé mensuel** est l'archive : chaque compte rendu que l'entreprise a reçu, du plus récent au plus ancien, jusqu'à deux ans." },
          { p: "La page montre plus que le courriel. Le courriel porte le paragraphe et les signalements; la page ajoute la grille de chiffres à partir de laquelle le paragraphe a été écrit et, pour les mois générés après l'arrivée de la fonctionnalité, la section **Les appels derrière les décisions de ce mois-ci**." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Une ligne par mois, coiffée du mois et de l'année dans votre langue (« août 2026 »), avec « {n} signalements ce mois-ci » en ambre quand le mois en a levé. Le plus récent est ouvert; les autres se déploient d'une touche.",
            "Le **résumé** — le paragraphe écrit par l'IA. Si l'entreprise avait dépassé son allocation IA FieldQuo ce mois-là, le paragraphe est remplacé par le message d'allocation et une ligne en italique : « Le résumé IA de ce mois-ci a été omis — votre allocation IA FieldQuo est épuisée. Les chiffres ci-dessus ne sont pas affectés. »",
            "Les **signalements** — des encadrés ambre. Il n'y a aujourd'hui qu'une règle : un taux d'acceptation des soumissions sous 30 % pour le mois, avec la variation par rapport au mois précédent quand il y avait un mois complet avant.",
            "Les **chiffres** — une petite grille des données remises au modèle : revenus, dépenses, marge, soumissions créées, soumissions acceptées, taux de conversion, dépenses marketing, le vrai nombre de prospects et, quand il y a quelque chose par quoi diviser, le coût par prospect combiné.",
            "**Les appels derrière les décisions de ce mois-ci** — quand l'entreprise utilise la réceptionniste IA ou les appels sortants, ce qui a été dit lors des appels liés aux soumissions gagnées et perdues du mois, ou une phrase disant pourquoi rien n'a été lu (aucun appel lié, allocation épuisée, IA non disponible sur ce déploiement).",
          ] },
          { p: "Avant le premier mois complet, il n'y a rien à montrer, et la page le dit : « Aucun résumé pour l'instant — votre premier résumé mensuel apparaîtra ici après votre premier mois complet d'activité. »" },
        ],
      },
      {
        id: "how-to-open-it",
        heading: "Comment l'ouvrir",
        blocks: [
          { steps: [
            "Dans la barre latérale, sous **Analyses**, ouvrez **Analyses**. La page est intitulée **Comment vous vous comparez**.",
            "Sous le sous-titre, appuyez sur **Résumés hebdomadaires**. La page **Résumé mensuel** s'ouvre avec le mois le plus récent déployé.",
            "Touchez n'importe quel mois antérieur pour le déployer. Il n'y a rien à générer à la main; les entrées sont écrites le premier de chaque mois.",
          ] },
          { figure: "live:app-analytics-benchmark", caption: "Analyses — Comment vous vous comparez, avec la rangée de liens sous le titre : Résumés hebdomadaires, États financiers, Gagnées et perdues, Justesse des estimations, Tableau de bord KPI." },
          { note: "Le compte rendu lui-même est en anglais aujourd'hui, quelle que soit la langue de votre entreprise : l'en-tête du mois et les mots propres à la page sont traduits, le paragraphe de l'IA et les phrases de signalement ne le sont pas." },
        ],
      },
      {
        id: "what-weekly-means-today",
        heading: "Ce que « hebdomadaire » veut dire aujourd'hui",
        blocks: [
          { p: "Rien. Le libellé sur la page Analyses dit **Résumés hebdomadaires**; la page qu'il ouvre, son en-tête, son état vide et la planification derrière disent tous mensuel. Il n'y a pas de courriel hebdomadaire, pas de cadence hebdomadaire à activer, et pas de résumé pour un mois partiel. Si vous voulez un chiffre plus souvent que chaque mois, la page **KPI** et le tableau de bord sont en direct pour toute période que vous choisissez — voir [[the-kpi-dashboard|Le tableau de bord KPI]] et [[the-dashboard-in-detail|Le tableau de bord en détail]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Analyses** de la barre latérale est montrée à quiconque dont l'accès inclut les prix (**See prices** activé) — Estimator et plus. La page Résumé mensuel n'exige rien de plus qu'un membre connecté de l'entreprise. Le courriel ne va qu'au propriétaire et aux administrateurs, quelle que soit la personne qui peut lire la page." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je passer le résumé en hebdomadaire ?", a: "Non. Il n'y a pas de résumé hebdomadaire et pas de réglage pour en avoir un. Le libellé du lien est la seule chose hebdomadaire là-dedans." },
      { q: "Puis-je générer le résumé de ce mois-ci en avance ?", a: "Non. Les résumés sont écrits le premier du mois pour le mois qui vient de se terminer. Pour une vue en direct du mois en cours, utilisez le tableau de bord KPI." },
      { q: "Pourquoi un résumé n'a-t-il pas son paragraphe ?", a: "L'entreprise avait dépassé son allocation IA FieldQuo quand il a été généré. Les chiffres et les signalements sont toujours là; seules les phrases écrites par l'IA ont été omises, et la page le dit sous l'entrée." },
    ],
  },

  "the-monthly-digest-email": {
    title: "Le courriel de résumé mensuel",
    summary:
      "Le courriel que FieldQuo envoie aux propriétaires et aux administrateurs le premier de chaque mois : quand il part, qui le reçoit, ce qu'il contient, à partir de quels chiffres il est écrit, et ce qui se passe quand l'allocation IA est épuisée.",
    updated: "2026-09-12",
    intro: [
      "Le premier de chaque mois, à 8 h 00 UTC, FieldQuo écrit un court résumé pour chaque entreprise active et l'envoie par courriel au propriétaire et à chaque administrateur qui a une adresse courriel. L'objet est **Your August summary** — le mois qui vient de se terminer. Le même compte rendu est classé sur la page **Résumé mensuel**, accessible par le lien **Résumés hebdomadaires** des **Analyses**.",
      "C'est une lecture courte, volontairement : trois ou quatre phrases écrites par l'IA FieldQuo à partir d'un ensemble fixe de chiffres, puis les signalements que le code a levés. Le modèle ne calcule jamais rien — chaque chiffre est d'abord calculé, puis lui est remis avec l'instruction de n'utiliser que ces chiffres-là.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le résumé est le seul rapport de FieldQuo qui vient à vous plutôt que d'attendre d'être ouvert. Il est interne — envoyé à votre équipe, jamais à un client — alors il arrive de **FieldQuo** à digest@fieldquo.com plutôt que de l'expéditeur de votre entreprise, et c'est la seule surface de ce groupe signée par FieldQuo. Le paragraphe et les signalements sont en anglais aujourd'hui, quelle que soit la langue de votre entreprise." },
          { p: "Il est généré que quelqu'un regarde ou non, pour chaque entreprise dont l'intégration est terminée. Il n'y a pas d'interrupteur pour l'arrêter ni de réglage pour changer qui le reçoit." },
        ],
      },
      {
        id: "what-is-in-it",
        heading: "Ce qu'il y a dans le courriel",
        blocks: [
          { bullets: [
            "**Le paragraphe** — « Write a 3–4 sentence monthly business summary… like a knowledgeable colleague giving a quick update, not a formal report. » C'est l'instruction donnée au modèle, avec les chiffres ci-dessous et les signalements.",
            "**Les signalements**, en liste à puces, quand il y en a. Une seule règle existe aujourd'hui : le taux d'acceptation des soumissions du mois est sous 30 %. Quand l'entreprise avait un mois complet avant, la phrase dit aussi si c'est en hausse ou en baisse par rapport à lui.",
            "Rien d'autre. La grille de chiffres et la section **Les appels derrière les décisions de ce mois-ci** sont sur la page Résumé mensuel seulement — voir [[weekly-digests|Résumés hebdomadaires]].",
          ] },
        ],
      },
      {
        id: "the-numbers-it-is-written-from",
        heading: "Les chiffres à partir desquels il est écrit",
        blocks: [
          { table: {
            head: ["Chiffre", "D'où il vient"],
            rows: [
              ["Revenus, dépenses, marge", "La vue d'ensemble du tableau de bord : factures payées, dépenses saisies, et la différence."],
              ["Soumissions créées, soumissions acceptées, taux de conversion", "La vue d'ensemble du tableau de bord. Le taux de conversion du mois précédent n'est inclus que si l'entreprise existait pendant tout ce mois — un demi-mois n'est jamais comparé à un mois complet."],
              ["Dépenses marketing", "Chaque ligne de dépense datée dans le mois qui vient de se terminer, tous canaux confondus. Quand une ligne dans une autre devise a été convertie à un taux épinglé, le modèle est prévenu que le chiffre est approximatif."],
              ["Vrai nombre de prospects et coût par prospect combiné", "Les prospects arrivés dans le mois qui vient de se terminer par les canaux d'entrée actifs — les prospects tapés à la main et importés sont exclus — et les dépenses marketing divisées par eux. Le coût par prospect est entièrement omis quand il n'y a aucun prospect par quoi diviser, jamais écrit 0 $."],
            ],
          } },
          { warning: "Les quatre premières lignes sont lues comme le tableau de bord les lit — pour le mois civil en cours au moment où le résumé est généré — et le résumé est généré quelques heures après le début du nouveau mois. Considérez les chiffres de revenus, de dépenses, de marge et de soumissions du courriel comme un instantané à ce moment-là, pas comme les totaux du mois précédent. Les dépenses marketing, les prospects et les appels sont ceux du mois précédent. Pour les vrais chiffres du mois dernier, utilisez **États financiers** ou **KPI** avec **Le mois dernier** sélectionné." },
        ],
      },
      {
        id: "when-the-ai-allowance-is-used-up",
        heading: "Quand l'allocation IA est épuisée",
        blocks: [
          { p: "Chaque fonction IA de FieldQuo vérifie l'allocation mensuelle de l'entreprise avant de dépenser. Si le résumé trouve l'allocation déjà épuisée, il part quand même : les chiffres ne coûtent rien et sont toujours réels, alors le courriel sort avec le message d'allocation à la place du paragraphe, et l'entrée sur la page Résumé mensuel porte une note en italique disant que le résumé a été omis. Rien n'est écarté en silence, et le soutien peut voir quelles entreprises ont atteint le plafond. Voir [[ai-credit-and-allowance|Crédit et allocation IA]] pour l'allocation elle-même." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Qui le reçoit",
        blocks: [
          { p: "Le propriétaire et chaque administrateur actif qui a une adresse courriel. Les Managers, les Dispatchers, les Estimators et l'équipe ne le reçoivent pas, même si un Manager peut lire le même compte rendu sur la page Résumé mensuel. Il n'y a pas de désabonnement individuel et aucun moyen d'ajouter un destinataire, sinon d'en faire un administrateur." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer le jour d'envoi ?", a: "Non. Il tourne le premier du mois à 8 h 00 UTC pour chaque entreprise, et il n'y a pas de réglage pour cela." },
      { q: "Puis-je l'envoyer à mon comptable ?", a: "Pas depuis FieldQuo. Transférez le courriel, ou donnez-lui un accès Manager ou administrateur; seuls les administrateurs et le propriétaire sont sur la liste." },
      { q: "Pourquoi les revenus dans le courriel sont-ils si bas ?", a: "Parce qu'ils sont lus pour le mois en cours au moment de l'envoi, quelques heures après le changement de mois. La page États financiers avec Le mois dernier sélectionné a le vrai total." },
      { q: "Le courriel va-t-il aux clients ?", a: "Jamais. C'est un résumé interne pour votre équipe, et la seule chose de ce groupe qui n'est pas en marque blanche — il vient de FieldQuo, pour vous." },
    ],
  },

  "financial-statements": {
    title: "États financiers",
    summary:
      "Les résultats, le flux de trésorerie, le sommaire des taxes de vente et le bilan partiel que FieldQuo construit à partir de ce qu'il enregistre déjà : les contrôles de période et de méthode, ce que contient chaque ligne, pourquoi certaines lignes disent Indisponible, et qui peut ouvrir la page.",
    updated: "2026-09-12",
    intro: [
      "**États financiers** arrange les lignes que FieldQuo détient déjà — factures, paiements, dépenses, heures approuvées, cycles de paie, prêts — dans les quatre documents qu'un comptable, un prêteur ou un courtier demande. Son sous-titre est la promesse : « à partir de ce que FieldQuo enregistre déjà. Chaque chiffre indique ce qu'il contient. » Rien sur la page n'est un nouveau genre de chiffre; chaque ligne peut s'ouvrir pour montrer de quoi elle est composée, ce qu'elle comprend, et ce qu'elle laisse de côté.",
      "On y accède par le lien **États financiers** sous le titre des **Analyses**, et par **Voir le détail →** dans la section Trésorerie de la page KPI.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page tient deux règles. D'abord, la méthode comptable n'est jamais implicite : vous choisissez **Caisse** ou **Exercice** en haut, le choix est répété en phrase complète au-dessus des chiffres, et les résultats le nomment encore. Ensuite, rien ne s'affiche à 0,00 $ à moins que zéro ne soit un fait — une ligne sans rien derrière se lit **Rien d'enregistré**, et une ligne à laquelle FieldQuo ne peut pas répondre se lit **Indisponible** avec la raison, et ne contribue à aucun total, lequel se déclare alors **incomplet**." },
          { p: "Les factures modifiées sont comptées une fois, au montant de la dernière version, datées de l'originale. Un remboursement de prêt est réparti comme un teneur de livres le répartit : seuls les intérêts sont un coût aux résultats; le capital est une sortie de trésorerie et une dette plus petite, jamais une dépense." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Cinq boutons de période — **Ce mois-ci**, **Le mois dernier**, **Ce trimestre**, **Depuis le début de l'année**, **L'an dernier** — et une paire **Du** / **Au** pour toute autre plage. Les jours sont comptés en UTC.",
            "**Méthode comptable** — **Caisse** (par défaut) ou **Exercice**. En dessous, la phrase de méthode et « Du {from} au {to}, en {currency}. »",
            "Avec la méthode d'exercice, un bandeau ambre : les coûts de cet état restent comptabilisés en caisse, parce que FieldQuo n'a pas de grand livre de factures fournisseurs, alors les revenus sont à l'exercice et les coûts en caisse — lisez les deux moitiés en conséquence.",
            "Les quatre états — **Résultats**, **Flux de trésorerie**, **Taxes de vente facturées**, **Bilan (partiel)** — chaque ligne avec un chevron qui ouvre **Composé de**, **Totalisé à partir de**, **Comprend**, **Ne comprend pas** et **N'a pas pu être inclus**.",
            "**Éléments qui influencent ces chiffres** au bas : des heures encore en attente d'approbation, des heures approuvées travaillées par quelqu'un sans taux, un coût général récurrent stocké comme une seule ligne et qui n'apparaît donc que dans une période, et des feuilles de temps qui coûtent plus que les cycles de paie approuvés.",
          ] },
          { p: "Une période sans rien du tout — aucun paiement, aucune facture émise, aucune dépense, aucune heure approuvée, aucun cycle de paie — affiche une seule phrase au lieu de quatre états à zéro : c'est une absence d'enregistrements, pas une période d'activité nulle." },
        ],
      },
      {
        id: "the-four-statements",
        heading: "Les quatre états",
        blocks: [
          { table: {
            head: ["État", "Ce qu'il contient", "Ce qu'il ne contient pas"],
            rows: [
              ["Résultats", "Revenus hors taxes; Matériaux, sous-traitants et autres coûts de chantier; Main-d'œuvre directe sur les chantiers (heures approuvées au taux de chaque personne); Coût des travaux réalisés; Bénéfice brut; Frais généraux (loyer, assurance, véhicules, administration); Autres charges d'exploitation; Salaires non imputés à un chantier (cycles de paie moins la main-d'œuvre déjà sur les chantiers); Intérêts sur prêts; Bénéfice net.", "L'impôt sur le revenu, l'amortissement des véhicules et des outils, les retraits du propriétaire, le capital des prêts."],
              ["Flux de trésorerie", "Argent reçu (par méthode); Dépenses payées; Salaires versés (net des cycles de paie); Mouvement net de l'activité enregistrée; puis, à part, les remboursements de prêts que les modalités au dossier disent exigibles, répartis en capital et intérêts.", "L'encaisse, à l'ouverture et à la clôture — FieldQuo ne détient ni solde bancaire ni flux bancaire."],
              ["Taxes de vente facturées", "La taxe facturée sur les factures émises, la taxe comprise dans l'argent réellement reçu, et combien de factures ont facturé la taxe, l'avaient désactivée, n'en devaient aucune, ou disent qu'une taxe s'applique sans la facturer.", "Tout ce qui est produit ou remis, la taxe payée sur les achats, une ventilation TPS/TVQ, la taxe sur les remboursements. La page le dit en toutes lettres : ceci n'est pas une déclaration de taxes."],
              ["Bilan (partiel)", "L'argent qui vous est dû (factures impayées, par facture) et les prêts en cours selon les modalités au dossier.", "L'encaisse, les immobilisations, les stocks, les factures fournisseurs, les taxes dues, les capitaux propres et chaque total — affichés Indisponible, de sorte que le bilan déclare de lui-même qu'il n'est pas équilibré."],
            ],
          } },
          { note: "Les libellés de lignes et les raisons sous une ligne Indisponible — « FieldQuo doesn't record this », « Your access doesn't include everyone's pay » — sont en anglais sur l'écran de chaque langue aujourd'hui. Les en-têtes, les boutons et les noms de période sont traduits." },
        ],
      },
      {
        id: "cash-or-accrual",
        heading: "Caisse ou exercice",
        blocks: [
          { p: "**Caisse** compte les revenus comme l'argent reçu dans la période et les coûts comme l'argent dépensé dedans; une facture émise et pas encore payée n'est pas un revenu. C'est la méthode sur laquelle la plupart des propriétaires-exploitants déclarent, et chaque chiffre y est appuyé par un paiement ou une dépense qui a réellement eu lieu. **Exercice** compte une facture dans la période où elle a été émise, payée ou non — mais seulement pour les revenus. FieldQuo n'a aucun enregistrement de factures fournisseurs, alors le côté des coûts reste comptabilisé en caisse, et la page le dit au-dessus des totaux plutôt que d'appeler exercice un état mixte." },
          { tip: "Choisissez la méthode sur laquelle votre comptable déclare et restez-y. Un état de caisse et un état d'exercice pour le même mois montrent légitimement des revenus différents, et la première question de quiconque lit un état est de savoir lequel il tient." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Un état des résultats est toute la base de coûts de l'entreprise avec les revenus à côté, alors la barrière est la plus large du groupe : l'interrupteur **Job costing**, **See prices**, l'accès aux **dépenses** de toute l'entreprise et la capacité de gérer les utilisateurs. Parmi les niveaux livrés, c'est **Manager**, les administrateurs et le propriétaire. Crew, Estimator et Dispatcher sont refusés." },
          { p: "Un Manager voit la page sans la paie : **Wages not charged to a job** et **Wages paid** se lisent Indisponible — « Your access doesn't include everyone's pay » — et chaque total qui les contient se dit incomplet, plutôt que de montrer en silence un mois rentable auquel manque la masse salariale." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je télécharger ou imprimer les états ?", a: "Pas depuis cette page — il n'y a ni PDF ni bouton d'export. Pour des fichiers à remettre à un comptable, utilisez l'Export comptable du Suivi des dépenses, qui produit des CSV de factures, de paiements et de dépenses pour une plage de dates. Voir [[the-accounting-export|L'export comptable]]." },
      { q: "Pourquoi mon état de mars ne montre-t-il aucun loyer ?", a: "Un coût général récurrent est stocké comme une seule ligne, datée une fois, et n'apparaît que dans la période où cette ligne est datée. FieldQuo ne fabrique pas douze lignes de loyer que personne n'a saisies. L'avertissement au pied de la page dit combien d'engagements récurrents sont au dossier et combien tombent dans la période." },
      { q: "Pourquoi le bilan n'est-il pas équilibré ?", a: "Parce qu'il est partiel et le dit. FieldQuo ne connaît ni votre solde bancaire, ni vos immobilisations, ni vos factures fournisseurs, alors le total de l'actif, le total du passif et les capitaux propres sont affichés Indisponible plutôt qu'à zéro." },
      { q: "Pourquoi les intérêts d'un prêt sont-ils Indisponible ?", a: "Le prêt n'a pas de taux d'intérêt consigné dans Paramètres → Frais généraux. Un taux à zéro ne se distingue pas d'un taux que personne n'a tapé, alors la ligne dit quel prêt en manque un au lieu de comptabiliser 0 $ d'intérêts." },
    ],
  },

  "won-and-lost": {
    title: "Gagnées et perdues",
    summary:
      "Le rapport de ventes : ce que vous avez envoyé, ce que vous avez gagné et perdu et pour combien, le temps que les clients prennent à répondre, les raisons qu'ils ont données dans leurs propres mots, et les règles qui décident quand un pourcentage est imprimé.",
    updated: "2026-09-12",
    intro: [
      "**Gagnées et perdues** répond à la question à laquelle le taux de réussite seul ne peut pas répondre : pas seulement combien de fois vous perdez, mais pourquoi. Son sous-titre le dit — « Ce que vous avez envoyé, ce qui est revenu et — quand quelqu'un l'a dit — pourquoi ça n'a pas marché. Un taux de réussite vous dit que vous perdez; les raisons vous disent quoi changer. » FieldQuo consigne une raison de refus sur chaque soumission refusée depuis que le champ existe; cette page est l'endroit où vous les lisez enfin.",
      "On y accède par le lien **Gagnées et perdues** sous le titre des **Analyses**. Le taux de réussite de la page KPI est le même calcul, alors les deux ne se contredisent jamais.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une soumission appartient à la période où elle a été **envoyée**, pas à celle où on y a répondu — ainsi « envoyées en juin » tient toujours la route, peu importe le temps que le client prend à dire oui. Les soumissions en attente ne sont ni gagnées ni perdues : le taux de réussite divise par les soumissions décidées seulement, parce que compter comme perdue chaque soumission encore à l'étude sous-estimerait un mois occupé exactement au moment où vous essayez de le lire." },
          { p: "Les raisons sont montrées mot pour mot, de la plus récente à la plus ancienne, et jamais classées par catégorie. Une soumission perdue sans raison est comptée comme son propre chiffre — « personne n'a dit pourquoi » — jamais repliée dans « autre » et jamais écartée pour que les raisons restantes se fassent passer pour le portrait complet. Aux volumes qu'envoie une petite entreprise, les phrases brutes sont le rapport." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Les cinq boutons de période, **Du** / **Au**, et la note de cohorte sur les dates d'envoi.",
            "Quatre décomptes — **Envoyées** (« occasions qui sont sorties d'ici »), **Gagnées**, **Perdues**, **Toujours en attente** — les trois derniers avec l'argent en dessous : le total accepté pour une victoire, le prix le plus bas proposé pour une perte ou une soumission encore en attente.",
            "Le **taux de réussite**, « de {decided} soumissions décidées ({won} gagnées, {lost} perdues) », ou **Aucune décision encore**, ou **Trop peu pour conclure** avec la phrase qui dit pourquoi.",
            "**Le temps qu'ils prennent à répondre** — les jours de l'envoi à la décision, la valeur typique (médiane) à côté de la moyenne, et combien de décisions ont été écartées faute d'horodatage.",
            "**Pourquoi vous les avez perdues** — combien de soumissions perdues ont une raison consignée, combien sont muettes, puis chaque raison avec le numéro de soumission, le client, la date et la valeur.",
            "**Selon qui a rédigé la soumission** — un tableau **Qui**, **Décidées**, **Gagnées**, **Taux de réussite**, montré seulement quand au moins deux personnes ont chacune dix décisions.",
            "Trois notes de bas de page quand elles s'appliquent : les soumissions sans auteur, les soumissions placées selon leur date de décision parce qu'elles n'ont jamais été marquées envoyées, et les soumissions sans aucune date qui n'appartiennent à aucune période.",
          ] },
        ],
      },
      {
        id: "how-a-quote-is-counted",
        heading: "Comment une soumission est comptée",
        blocks: [
          { table: {
            head: ["Situation", "Comment le rapport la traite"],
            rows: [
              ["Un trio Bon / Mieux / Meilleur", "Une occasion, pas trois. Gagnée si une option a été acceptée; perdue si une a été refusée et aucune acceptée; sinon toujours en attente. Sa valeur est le total de l'option acceptée, ou l'option la plus basse quand rien n'a été accepté."],
              ["Acceptée à la main après un appel, jamais marquée envoyée", "Comptée, dans la période de la décision, et nommée dans une note de bas de page. Elle est exclue du délai de décision, qui exige une vraie date d'envoi."],
              ["Ni date d'envoi ni date de décision", "Dans aucune période et dans aucun chiffre — comptée dans une note de bas de page. La plupart datent d'avant que FieldQuo n'inscrive ces dates."],
              ["Décidée avant que FieldQuo n'inscrive les dates de décision", "Dans les décomptes; écartée de la moyenne du délai de décision plutôt que comptée comme décidée le jour même."],
              ["Renvoyée après que le client avait déjà répondu", "Sa décision tombe avant sa date d'envoi, alors elle est impossible à mesurer et écartée de la moyenne."],
            ],
          } },
        ],
      },
      {
        id: "recording-a-reason",
        heading: "Consigner une raison",
        blocks: [
          { p: "Deux portes écrivent la raison. Sur la page d'approbation publique, un client qui refuse peut taper pourquoi, et ses mots arrivent ici sans retouche. Dans le bureau :" },
          { steps: [
            "Ouvrez la soumission et sa page **Faire approuver cette soumission**.",
            "Appuyez sur **Ils l'ont refusée**. Une case s'ouvre : **Ont-ils dit pourquoi ? (facultatif)**.",
            "Tapez ce que le client a dit, dans ses mots, et appuyez sur **Consigner comme perdue**. La soumission affiche **Raison consignée**.",
          ] },
          { tip: "Quand la plupart de vos pertes sont muettes, la page le dit : « {n} des {lost} pertes sont muettes. Rien ici ne peut vous dire pourquoi celles-là sont parties — la prochaine que vous perdez, demandez, et tapez ce qu'ils répondent dans la soumission. » Cette phrase est le constat le plus utile que le rapport puisse faire tant que les raisons n'existent pas." },
        ],
      },
      {
        id: "the-floors",
        heading: "Quand un pourcentage est imprimé",
        blocks: [
          { bullets: [
            "**Dix soumissions décidées** avant qu'un taux de réussite apparaisse. À dix, une soumission qui bascule déplace le taux de dix points; en dessous, la page affiche les décomptes et « Trop peu pour conclure » — « 3 sur 4 » est honnête à toute taille, « 75 % » ne l'est pas.",
            "**Deux personnes avec dix décisions chacune** avant que le tableau par estimateur apparaisse. Un seul groupe est le total de l'entreprise avec un nom dessus, pas une comparaison.",
            "**Aucun pourcentage du tout** dans une période vide : « Aucune soumission n'est partie entre le {from} et le {to}. Ce n'est pas un taux de réussite de 0 % — c'est une période où il n'y a rien. »",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Plus léger que les autres rapports, volontairement : il ne montre ni coût, ni marge, ni salaire, alors il n'exige que l'accès en consultation aux soumissions et **See prices**. C'est **Estimator**, **Dispatcher**, **Manager**, les administrateurs et le propriétaire — l'estimateur dont il s'agit des propres soumissions n'en est pas exclu. Crew est refusé." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon taux de réussite diffère-t-il du nombre de soumissions acceptées sur le nombre envoyé ?", a: "Parce que les soumissions en attente ne sont pas des pertes. Le taux est gagnées sur décidées (gagnées plus perdues); la page imprime la fraction exacte en dessous." },
      { q: "FieldQuo peut-il regrouper les raisons en prix, délai, et ainsi de suite ?", a: "Non, volontairement. Trois phrases classées en catégories, c'est une tendance que le rapport a inventée, pas une qu'il a trouvée. Lisez les raisons; elles sont courtes." },
      { q: "Un client a accepté l'option du milieu sur trois. Les deux autres comptent-elles comme perdues ?", a: "Non. Les trois options sont une seule occasion, et elle est gagnée." },
    ],
  },

  "estimate-accuracy": {
    title: "Justesse des estimations",
    summary:
      "Comment les estimations de coûts de vos chantiers terminés se comparent à ce qu'ils ont réellement coûté — heures de main-d'œuvre, coût de main-d'œuvre et matériaux tenus à part — avec les seuils, la marge de tolérance, les segments, et les problèmes de données que la page nomme avant de nommer un pourcentage.",
    updated: "2026-09-12",
    intro: [
      "Le calcul du coût de revient vous dit qu'une cuisine a pris trop de temps. **Justesse des estimations** vous dit que toutes les cuisines en prennent. Il reprend la même comparaison estimation-réel et la fait tourner sur chaque chantier terminé dans une période, ventilée par direction et par dimension, parce que la main-d'œuvre et les matériaux dérapent pour des raisons différentes : la main-d'œuvre dépasse quand le travail a pris plus de temps que l'estimateur ne le pensait, les matériaux quand le carnet de prix est périmé ou que quelqu'un a acheté l'apprêt cher.",
      "On y accède par le lien **Justesse des estimations** sous le titre des **Analyses**, et par **Rapport complet →** sur la carte Exécution de la page KPI. Aucune IA n'en écrit une ligne : chaque phrase sous **Ce que disent les chiffres** est générée à partir de l'arithmétique qui l'a produite.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un chantier compte quand il est **terminé**, avec une date d'achèvement dans la plage — un chantier encore en cours a des coûts qui arrivent encore et paraîtrait sous le budget à tout coup. Les chantiers archivés sont inclus (archiver, c'est classer, pas annuler); les chantiers annulés ne le sont pas. Une facture n'est pas requise : ceci mesure l'estimation des coûts, pas la marge." },
          { p: "Le titre de chaque carte est la **médiane** des pourcentages par chantier, pas la moyenne, pour qu'un chantier catastrophique ne puisse pas devenir le titre. La moyenne est imprimée à côté, et quand les deux s'écartent de plus de 25 points, la page nomme le chantier responsable. Un chantier à **±5 %** de son estimation compte comme dans la cible." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Les boutons de période — **Ce trimestre**, **Les 6 derniers mois**, **Depuis le début de l'année**, **Les 12 derniers mois**, **L'an dernier** — et **Du** / **Au**. Des préréglages plus longs que les autres rapports, parce que cinq chantiers comparables prennent du temps à s'accumuler.",
            "La ligne de portée : « Chantiers marqués terminés entre {from} et {to} : {jobs}. De ceux-là, {comparable} avaient à la fois une estimation de coûts enregistrée et assez de consigné pour être comparés. » — et le seuil : « Un pourcentage n'est affiché que là où au moins 5 chantiers l'appuient. »",
            "**Ce que disent les chiffres** — les constats, les plus importants d'abord : les problèmes de données, puis le biais sur chaque dimension, puis tout métier qui se comporte différemment des autres.",
            "Trois cartes — **Labour hours**, **Labour cost**, **Materials and other job costs** — chacune avec « {n} chantiers comparables sur {total} », la médiane « sur le chantier typique », « {over} en dépassement, {under} en dessous, {onTarget} dans la cible », **Moyenne sur l'ensemble des chantiers**, **Total, estimé contre réel**, et les segments **Par métier**, **Par taille de chantier**, **Par client** et **Par membre de l'équipe, sur les chantiers qu'il a faits seul**.",
            "**Ce qui retient ce rapport** — les décomptes de chantiers terminés sans estimation de coûts enregistrée, sans dépense consignée, avec des feuilles de temps encore en attente d'approbation, des heures travaillées par quelqu'un sans taux, et des chantiers couvrant plus d'un métier.",
          ] },
        ],
      },
      {
        id: "the-three-comparisons",
        heading: "Les trois comparaisons",
        blocks: [
          { table: {
            head: ["Carte", "Estimé", "Réel", "Pourquoi c'est séparé"],
            rows: [
              ["Labour hours", "Les heures sur l'estimation de coûts enregistrée de la soumission", "Les heures approuvées consignées sur le chantier", "La compétence d'estimation, masse salariale retirée. Un travailleur sans taux ou une augmentation ne peut pas la fausser."],
              ["Labour cost", "Le coût de main-d'œuvre sur l'estimation", "Les heures approuvées au taux de chaque personne", "Les erreurs de taux et les erreurs d'heures tombent toutes deux ici, alors ce n'est pas celle sur laquelle fixer vos prix."],
              ["Materials and other job costs", "Les matériaux de l'estimation", "Chaque dépense associée au chantier — matériaux, sous-traitants, voyages au dépotoir, location", "Les catégories de dépense sont du texte libre, alors le côté réel ne peut pas être découpé plus finement que le chantier."],
            ],
          } },
          { p: "Un chantier est exclu d'une comparaison — et la raison listée sous la carte — quand l'un des deux côtés est inconnu : pas d'estimation enregistrée, aucune heure consignée, des feuilles de temps en attente d'approbation, un travailleur sans taux (écarté du coût de main-d'œuvre, gardé dans les heures de main-d'œuvre), ou aucune dépense consignée du tout. Un chantier terminé sans ligne de dépense n'est pas un chantier qui n'a rien dépensé; le noter comme une économie de 100 % serait le mensonge le plus flatteur que la page puisse raconter." },
        ],
      },
      {
        id: "what-the-findings-say",
        heading: "Ce que disent les constats",
        blocks: [
          { bullets: [
            "**Critique** — des heures approuvées travaillées par quelqu'un sans taux horaire au dossier, nommé. Ces heures ne coûtent rien dans FieldQuo et tireraient toute la période vers le sous-budget; définissez le taux sous **Votre équipe** et les chantiers rejoignent le rapport.",
            "**Avertissement** — des heures en attente d'approbation, des chantiers sans estimation enregistrée (« Remplissez Coût et marge sur une soumission avant de l'envoyer »), des chantiers sans dépenses.",
            "**Constat** — un biais assez constant pour être une habitude de tarification (sept chantiers sur dix tombant du même côté), ou un métier qui s'écarte de plus de dix points d'un autre : « une seule correction à l'échelle de l'entreprise surfacturerait l'un et laisserait l'autre à court. »",
            "**Info** — un échantillon mince (« 5 est le minimum à partir duquel ce rapport tire un pourcentage. Encore 2 et il le fera. »), une dimension dans la cible, ou une moyenne éloignée de la médiane par un chantier nommé.",
          ] },
          { note: "Les phrases de constat sont générées en anglais sur l'écran de chaque langue aujourd'hui; les en-têtes, libellés et noms de période autour sont traduits." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'interrupteur **Job costing** et l'accès aux chantiers de toute l'entreprise — la base de coûts elle-même. **Manager**, les administrateurs et le propriétaire le voient; Crew, Estimator et Dispatcher sont refusés, et un membre confiné à ses propres chantiers est refusé plutôt que de se voir montrer un cumul d'entreprise construit sur le tiers des preuves." },
          { p: "Deux segments ont leur propre barrière et sont absents plutôt que vides pour qui ne l'a pas : **Par client** exige le carnet de clients, et **Par membre de l'équipe** exige les heures de tout le monde — la page imprime « votre niveau d'accès n'inclut pas… » à leur place." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la page KPI affiche-t-elle un seul chiffre de justesse des estimations et cette page trois ?", a: "La carte KPI est l'écart médian de la comparaison du coût de main-d'œuvre pour la même période. Cette page garde les heures, le coût et les matériaux séparés parce qu'ils se corrigent différemment." },
      { q: "Tous mes chantiers ont dépassé mais la page n'affiche aucun pourcentage.", a: "Moins de cinq étaient comparables. Les décomptes sont quand même imprimés — « 3 en dépassement, 0 en dessous, 0 dans la cible » — parce que trois chantiers qui concordent sont une observation sur trois chantiers, pas un taux." },
      { q: "Un chantier a-t-il besoin d'une facture pour être compté ?", a: "Non. Les coûts sont réglés que la paperasse soit sortie ou non. Il lui faut une estimation de coûts enregistrée sur la soumission et des heures approuvées ou des dépenses sur le chantier." },
    ],
  },

  "expense-tracking-and-burn-rate": {
    title: "Suivi des dépenses et rythme de dépenses",
    summary:
      "L'écran Suivi des dépenses : les quatre cartes du mois, de quoi est fait le rythme de dépenses mensuel, pourquoi Autonomie affiche un tiret, le Résumé IA, les répartitions et la tendance, comment ajouter une dépense et ce que change chaque champ, et qui peut voir le cumul de l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "**Suivi des dépenses**, c'est « Où va votre argent — par chantier, frais généraux et catégorie — plus votre rythme de dépenses mensuel. » C'est le même écran que vous ouvriez **Dépenses** sous Finances dans la barre latérale ou **Suivi des dépenses** sous Encaissement dans les Paramètres : un mois à la fois, quatre cartes en haut, puis les répartitions, la tendance sur six mois, les reçus récents et l'export comptable.",
      "Cet article porte sur cet écran et sur le formulaire **Ajouter une dépense**. L'importateur de relevé bancaire a son propre article, [[import-expenses-from-a-bank-csv|Importer des dépenses depuis un CSV bancaire]], et l'export le sien, [[the-accounting-export|L'export comptable]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une dépense dans FieldQuo est un montant daté avec une catégorie, éventuellement lié à un chantier, marqué frais généraux, marqué récurrent, ou rattaché à un véhicule. Ces quatre choix décident où elle apparaît : dans le coût de revient du chantier et dans la justesse des estimations, dans le rythme de dépenses, dans le coût d'exploitation du véhicule, ou simplement dans le total du mois. L'écran est un mois de ces lignes, additionnées de toutes les façons dont un entrepreneur s'en informe." },
          { figure: "live:app-settings-expense-tracking", caption: "Paramètres → Suivi des dépenses — le sélecteur de mois, les quatre cartes, Résumé IA, les deux répartitions, la Tendance sur 6 mois, Dépenses récentes et l'Export comptable." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Importer depuis un CSV bancaire** et **Ajouter une dépense** en haut à droite, et un sélecteur de mois (**Mois précédent** / **Mois suivant**).",
            "**Dépenses suivies ce mois-ci** — chaque dépense datée dans le mois, quelle que soit sa catégorie ou son association.",
            "**Rythme de dépenses mensuel** — « Frais généraux + salaires + dette » : ce que l'entreprise coûte à faire tourner pendant un mois, à partir des registres de **Paramètres → Frais généraux**. Il ne change pas avec le mois que vous consultez.",
            "**Autonomie** — des mois de trésorerie à ce rythme. Elle se lit **—** avec **Ajoutez l'encaisse pour estimer** : aujourd'hui, il n'y a nulle part dans FieldQuo où saisir l'encaisse, alors la carte reste un tiret. FieldQuo ne détient ni solde bancaire ni flux bancaire.",
            "**Dépenses liées aux chantiers** — les dépenses liées à un chantier ce mois-ci, avec **Frais généraux {amount} · Général {amount}** en dessous pour les deux autres sortes.",
            "**Résumé IA** — un bouton, **Générer un résumé**, qui écrit un paragraphe en langage clair sur les dépenses du mois dans votre langue. Voir plus bas.",
            "**Répartition des dépenses mensuelles** — **Frais généraux**, **Salaires**, **Paiements de dette** en barres, et **Gérer salaires et dette** vers la page Frais généraux.",
            "**Dépenses par catégorie** — les catégories de ce mois-ci, de la plus grosse à la plus petite, avec la part de chacune.",
            "**Tendance sur 6 mois** — une barre par mois, ce mois-ci en dernier.",
            "**Dépenses récentes** — les vingt lignes les plus récentes tous mois confondus, chacune étiquetée **Frais généraux** ou **Lié au chantier**, avec une icône de suppression.",
            "**Export comptable** — une plage de dates en CSV pour votre comptable.",
          ] },
        ],
      },
      {
        id: "how-to-add-an-expense",
        heading: "Comment ajouter une dépense",
        blocks: [
          { steps: [
            "Appuyez sur **Ajouter une dépense**.",
            "Choisissez une **Catégorie** — Materials, Fuel & Vehicle, Tools & Equipment, Insurance, Rent & Utilities, Software & Subscriptions, Marketing, Permits & Licensing, Office Supplies, Meals & Travel, ou **Other** avec un **Nom de catégorie personnalisée**. Les catégories sont du texte libre en dessous; tout ce qui existe déjà dans vos données apparaît dans la répartition même si ce n'est pas dans la liste.",
            "Saisissez le **Montant** et la **Date**.",
            "Choisissez **Associer à** : **Général**, **Un chantier** (puis **Choisir un chantier...**), ou **Frais généraux**.",
            "Cochez **Récurrent (alimente le rythme de dépenses ci-dessous)** s'il s'agit d'un coût permanent, et choisissez **Hebdomadaire**, **Mensuel** ou **Annuel**.",
            "Choisissez éventuellement un **Véhicule (facultatif)** et ajoutez des **Notes**, puis appuyez sur **Ajouter une dépense**.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque contrôle",
        blocks: [
          { table: {
            head: ["Contrôle", "Ce qu'il change"],
            rows: [
              ["Associer à → Un chantier", "Le montant tombe dans le coût de revient de ce chantier et dans la comparaison des matériaux de la Justesse des estimations, et il est compté dans Dépenses liées aux chantiers. Le calcul du coût de revient ne lit que les lignes de dépense — un achat coché sur la liste d'achats du chantier et jamais saisi ici lui est invisible."],
              ["Associer à → Frais généraux", "La ligne est étiquetée Frais généraux, comptée dans le chiffre Frais généraux sous Dépenses liées aux chantiers, et, si elle est aussi récurrente, alimente le rythme de dépenses."],
              ["Récurrent + fréquence", "La ligne est traitée comme un coût mensuel permanent : hebdomadaire × 4,33, annuel ÷ 12. Elle apparaît dans le rythme de dépenses, dans le coût par chantier de Paramètres → Frais généraux, et dans le registre des Coûts fixes qui s'y trouve — ce sont les mêmes lignes. Elle reste datée une fois, alors les états et le total du mois ne la comptent que dans un seul mois."],
              ["Véhicule", "Le montant est imputé au coût d'exploitation de ce véhicule dans Véhicules."],
              ["Supprimer (l'icône de poubelle)", "Retire la ligne sur-le-champ, sans confirmation, et chaque chiffre construit dessus change immédiatement."],
            ],
          } },
        ],
      },
      {
        id: "the-burn-rate-and-the-ai-summary",
        heading: "Le rythme de dépenses et le Résumé IA",
        blocks: [
          { p: "Le rythme de dépenses est de la trésorerie : les dépenses de frais généraux récurrentes à leur équivalent mensuel, plus les lignes **Salaires** de Paramètres → Frais généraux (un salaire général horaire a besoin d'heures par semaine, sinon il ne contribue à rien), plus le **Paiement mensuel** complet de chaque prêt actif. L'amortissement n'en fait pas partie, parce qu'il ne déplace aucun argent. Le chiffre de coût qu'utilise le prix minimum est différent — voir [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]]." },
          { p: "**Générer un résumé** envoie les chiffres du mois — le total, les répartitions par catégorie et par association, le rythme de dépenses et ses composantes, l'autonomie, la tendance sur six mois — à l'IA FieldQuo avec l'instruction de n'utiliser que ces chiffres, et imprime trois ou quatre phrases dans votre langue. En dessous, des signalements que le code a levés de lui-même : une autonomie sous trois mois (jamais, tant que l'encaisse ne peut pas être saisie), une catégorie à 40 % ou plus du mois, ou un mois à 15 % ou plus au-dessus ou en dessous du précédent. Il est écrit à la demande, pas stocké, et il est effacé quand vous changez de mois." },
          { note: "Le bouton compte contre l'allocation IA FieldQuo mensuelle de l'entreprise et est refusé, avec le message d'allocation, une fois celle-ci épuisée. Seuls les propriétaires, les administrateurs et les Managers peuvent l'appuyer." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le cumul — les cartes, les répartitions, la tendance — exige l'accès aux **dépenses** de toute l'entreprise (« everyone's ») : **Manager**, les administrateurs et le propriétaire. La ligne **Dépenses** et la ligne des Paramètres sont toutes deux masquées pour quiconque est en dessous. Crew, Estimator et Dispatcher peuvent toujours enregistrer leurs propres dépenses sur leurs propres écrans et ne voient que leurs propres lignes; cette page ne leur est pas montrée." },
        ],
      },
    ],
    faq: [
      { q: "Comment remplir Autonomie ?", a: "Vous ne pouvez pas aujourd'hui. La carte demande l'encaisse et aucun écran de FieldQuo ne l'accepte, alors Autonomie reste un tiret. Le rythme de dépenses mensuel est le chiffre qui est réel." },
      { q: "J'ai ajouté le loyer comme dépense normale. Pourquoi le rythme de dépenses est-il toujours à 0 $ ?", a: "Seules les lignes marquées Récurrent avec une fréquence, et étiquetées Frais généraux, alimentent le rythme de dépenses. Ajoutez le loyer une fois en Récurrent / Mensuel / Frais généraux — ou sous Coûts fixes dans Paramètres → Frais généraux, qui écrit la même ligne." },
      { q: "Pourquoi le rythme de dépenses ne change-t-il pas quand je passe à un autre mois ?", a: "Il est construit à partir des registres permanents, pas des reçus de ce mois-là. Dépenses suivies ce mois-ci et les répartitions suivent le mois; le rythme de dépenses est ce que l'entreprise coûte chaque mois." },
      { q: "Le résumé IA est-il enregistré quelque part ?", a: "Non. Il est généré quand vous appuyez sur le bouton et affiché sur la page; le résumé mensuel est le compte rendu qui est stocké et envoyé par courriel." },
    ],
  },

  "import-expenses-from-a-bank-csv": {
    title: "Importer des dépenses depuis un CSV bancaire",
    summary:
      "Comment amener un export de relevé bancaire dans le Suivi des dépenses : le fichier que FieldQuo accepte, l'association des colonnes, les questions de signe et de date qu'il pose, l'étape de vérification où rien n'est encore enregistré, ce que deviennent les lignes importées, et ce qui arrête un doublon.",
    updated: "2026-09-12",
    intro: [
      "Au lieu de taper un mois de reçus, exportez un relevé de votre banque en CSV et appuyez sur **Importer depuis un CSV bancaire** dans le **Suivi des dépenses**. FieldQuo lit le fichier, vous demande quelle colonne est quoi, montre chaque ligne qu'il compte créer, et n'écrit rien tant que vous n'appuyez pas sur **Importer {n} dépenses**. Il n'y a pas de connexion bancaire : FieldQuo ne détient ni identifiants bancaires ni flux bancaire, alors le CSV est tout le chemin.",
      "L'importateur est conçu pour refuser plutôt que deviner. Une colonne de dates qui pourrait se lire jour d'abord ou mois d'abord s'arrête et demande; un dépôt est ignoré comme « pas une dépense » plutôt que comptabilisé comme un coût négatif; une ligne qui correspond à quelque chose de déjà enregistré est exclue comme doublon.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est intitulée **Importer des dépenses depuis un CSV** — « Téléversez un relevé bancaire exporté, associez ses colonnes, puis vérifiez chaque ligne avant tout enregistrement. » Trois étapes : téléverser, associer, vérifier. Le navigateur ne lit le fichier que pour vous montrer les en-têtes et quelques lignes d'exemple; le serveur le relit pour construire la liste de vérification, alors ce que le navigateur montre n'est jamais pris pour le registre de ce qui sera créé." },
          { p: "Un fichier est un simple .csv d'au plus **5 000** lignes — quelques années de relevés d'un petit entrepreneur. Au-delà, les premières lignes sont lues et la page dit de répartir le reste dans un second fichier. Une feuille de calcul renommée en .csv, un fichier vide, ou un fichier avec des en-têtes et aucune ligne reçoivent chacun leur propre message." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "Les trois étapes",
        blocks: [
          { steps: [
            "**Choisir un fichier CSV** ou déposez-en un.",
            "**Associer les colonnes.** Chaque colonne du fichier reçoit un menu déroulant : **Date**, **Description**, **Montant**, **Débit (sortie d'argent)**, **Crédit (entrée d'argent)**, **Catégorie** ou **Ignorer**. FieldQuo préremplit les en-têtes évidents, mais **Continuer (n/3)** ne s'active qu'une fois Date, Description et un montant — une seule colonne Montant ou une colonne Débit — associés.",
            "Répondez à la question de signe : « Dans ce fichier, l'argent sortant (une dépense) est indiqué par : » **Des nombres négatifs, comme -45,00** ou **Des nombres positifs, comme 45,00**. La réponse présélectionnée vient du comptage des valeurs d'exemple; c'est un défaut, pas une décision.",
            "Vérifiez le **Format de date détecté**. Si les dates peuvent se lire dans les deux sens, choisissez **Jour d'abord — 13/01/2024 est le 13 janvier** ou **Mois d'abord — 01/13/2024 est le 13 janvier**. Si les dates ne sont pas reconnues du tout, la page le dit et s'arrête.",
            "Définissez une **Catégorie par défaut** — utilisée pour les lignes sans colonne de catégorie ou avec une cellule de catégorie vide — et continuez.",
            "**Vérifier avant d'importer.** « Rien n'est encore enregistré — décochez toute ligne indésirable et associez un chantier là où c'est pertinent. » Chaque ligne a une case à cocher et un menu déroulant **Chantier**; les décomptes se lisent « prêtes à importer », « exclues comme doublons », « n'ont pas pu être lues », « dépôts, pas des dépenses ».",
            "Appuyez sur **Importer {n} dépenses**. La page confirme « {n} dépenses importées. » avec **Retour au suivi des dépenses** et **Importer un autre fichier**.",
          ] },
          { figure: "live:app-settings-expense-tracking", caption: "Suivi des dépenses — Importer depuis un CSV bancaire se trouve à côté d'Ajouter une dépense en haut; les lignes importées tombent dans Dépenses récentes et dans les chiffres du mois." },
        ],
      },
      {
        id: "what-the-review-decides",
        heading: "Ce que la vérification décide pour chaque ligne",
        blocks: [
          { table: {
            head: ["Statut de la ligne", "Ce que cela veut dire", "Ce qui arrive"],
            rows: [
              ["Prête à importer", "Une date, une description et une sortie d'argent selon la convention de signe que vous avez confirmée.", "Créée quand vous appuyez sur Importer, sauf si vous la décochez."],
              ["Doublon possible", "Même date, même montant et même description (sans tenir compte de la casse, des accents ni des espaces) qu'une dépense déjà enregistrée pour l'entreprise, quelle que soit sa source — ou qu'une ligne antérieure du même fichier.", "Exclue. L'étiquette la nomme; elle n'est pas écrite."],
              ["Dépôts, pas des dépenses", "Un crédit selon la convention de signe — une entrée d'argent. La forme normale d'un relevé bancaire, pas une erreur.", "Ignorée. **Afficher les {n} lignes ignorées** les liste."],
              ["N'ont pas pu être lues", "Une date ou un montant vide ou illisible sur cette seule ligne.", "Ignorée. **Afficher les {n} lignes qui n'ont pas pu être lues** les liste avec la raison."],
            ],
          } },
          { p: "Les montants sont lus dans les formes que les banques exportent : « $1,234.56 », « (125.50) », « 125.50- », « 1.234,56 ». Les symboles et codes de devise sont retirés; le dernier séparateur d'une valeur est pris comme séparateur décimal." },
        ],
      },
      {
        id: "what-the-rows-become",
        heading: "Ce que deviennent les lignes importées",
        blocks: [
          { bullets: [
            "Une dépense par ligne, datée du relevé, avec la description comme notes, la catégorie du fichier ou votre catégorie par défaut, et le chantier que vous avez choisi à la vérification (ou aucun).",
            "**Ponctuelle, jamais récurrente**, et non étiquetée Frais généraux. Un relevé, ce sont douze paiements de loyer distincts, pas une déclaration sur chaque mois à venir; les importer comme récurrentes compterait un loyer douze fois dans le rythme de dépenses. La page le dit : « Pour qu'une facture récurrente comme le loyer alimente le rythme de dépenses mensuel, ajoutez-la séparément dans Paramètres → Frais généraux. »",
            "Écrite une fois. Une réponse lente et un second clic ne peuvent pas doubler le lot — la session de vérification porte une seule clé, et une répétition dit « Ce fichier avait déjà été importé — rien de nouveau n'a été enregistré. »",
            "Revérifiée au moment de l'écriture : « {n} de plus correspondaient à une transaction enregistrée depuis l'ouverture de cette vérification et ont été ignorées. »",
            "Une seule entrée au Journal d'activité pour tout le lot, pas une par ligne.",
          ] },
          { warning: "Les lignes sont appariées sur la date, le montant et la description. Deux pleins d'essence de 45,00 $ réellement distincts à la même station le même jour ressembleront à un seul pour l'importateur; ne décochez rien, et ajoutez le second à la main si l'étiquette se trompe." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Importer exige le même accès qu'enregistrer une dépense — le palier qui permet à une personne d'ajouter les siennes — alors quiconque a un palier **Expenses** au-dessus de **none** peut lancer l'importateur. Le bouton se trouve dans le **Suivi des dépenses**, qui n'est montré qu'à **Manager**, aux administrateurs et au propriétaire (accès aux dépenses de toute l'entreprise); la page qu'il ouvre n'exige rien de plus." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo peut-il se connecter directement à ma banque ?", a: "Non. Il n'y a pas de flux bancaire et FieldQuo ne détient jamais d'identifiants bancaires. Exportez un CSV de votre banque et importez-le; la détection des doublons ignore d'où vient une ligne, alors réimporter plus tard un relevé qui chevauche ne crée rien deux fois." },
      { q: "Le fichier a une colonne Débit et une colonne Crédit. Laquelle associer ?", a: "Les deux. Les lignes de débit deviennent des dépenses; les lignes de crédit sont ignorées comme dépôts. Si le fichier a plutôt une seule colonne Montant signée, associez-la et répondez à la question de signe." },
      { q: "Puis-je importer des matériaux sur un chantier ?", a: "Oui — choisissez le chantier dans le menu Chantier à l'étape de vérification. La ligne compte alors dans le coût de revient de ce chantier et dans la Justesse des estimations." },
      { q: "Pourquoi mes dates étaient-elles décalées d'un mois ?", a: "Elles ne peuvent pas l'être, par conception : quand le jour et le mois ne se distinguent pas d'après les valeurs, l'importateur s'arrête et demande. Si le fichier mélange les formes, il refuse la colonne et le dit." },
    ],
  },

  "overhead-and-your-minimum-price": {
    title: "Frais généraux et votre prix minimum",
    summary:
      "Paramètres → Frais généraux : la capacité en chantiers par semaine et la marge cible qui transforment vos coûts fixes en coût par chantier et en prix minimum, les cinq registres qui l'alimentent, le panneau de main-d'œuvre non absorbée, où le chiffre est utilisé, et qui peut le voir.",
    updated: "2026-09-12",
    intro: [
      "**Frais généraux**, c'est « Coûts fixes mensuels. Divisés par le nombre de chantiers que vous pouvez prendre, ils donnent le prix le plus bas auquel un chantier peut sortir tout en couvrant l'entreprise. » C'est le chiffre qu'un entrepreneur veut le plus et a le moins souvent, et il n'est volontairement pas deviné : tant que vous ne dites pas combien de chantiers par semaine vous pouvez prendre, la page montre les registres et aucun prix.",
      "La page se trouve sous **Services et tarifs** dans le menu des Paramètres. Cet article est la page de haut en bas; la règle de tarification elle-même, et pourquoi elle utilise le coût plutôt que la trésorerie, est aussi dans [[the-break-even-price|Le prix de rentabilité]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Tout sur cette page est une seule somme : ce qu'un mois d'activité coûte, divisé par les chantiers que vous faites dans un mois, majoré de votre marge cible. Le côté des coûts est lu dans cinq registres de la même page — coûts fixes, salaires, dette, actifs, factures — et nulle part ailleurs; il n'y a aucune moyenne du secteur ni règle empirique là-dedans. Changez un registre et le prix change sur-le-champ." },
          { figure: "live:app-settings-overhead", caption: "Paramètres → Frais généraux — Votre prix minimum avec Chantiers par semaine et les quatre tuiles, puis Heures payées qui n'ont jamais atteint un chantier, et les registres en dessous." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre prix minimum** — « Combien de chantiers votre équipe peut-elle prendre dans une semaine normale? » avec **Chantiers par semaine**, **Marge cible %** (valeur indicative **20 (par défaut)**) et **Enregistrer**. Tant que la capacité n'est pas définie : « Dites-nous combien de chantiers par semaine vous pouvez prendre et nous calculerons votre prix minimum. Sans cela, il n'y a rien par quoi diviser vos frais généraux. »",
            "Quatre tuiles — **Coûts fixes mensuels**, **Chantiers / mois**, **Coût par chantier**, **Prix minimum** — et en dessous les phrases qui justifient le total : « Comprend {fixed} de coûts fixes + {salaries} de salaires + {debt} de remboursements », l'amortissement et les intérêts de prêt qu'il comprend aussi, l'argent qui sort réellement du compte et pourquoi il diffère, et « À une marge cible de {pct}%. Cela couvre uniquement les frais généraux — les matériaux et la main-d'œuvre du chantier s'ajoutent. »",
            "**Heures payées qui n'ont jamais atteint un chantier** — les 30 derniers jours de semaines garanties contre les heures consignées sur des chantiers : **Main-d'œuvre non absorbée**, **Heures non absorbées**, et une ligne par travailleur (**Travailleur**, **Prévu**, **Sur chantier**, **Non absorbé**, **Coût**).",
            "**Coûts fixes** — « Loyer, assurance, téléphone, abonnements — tout ce qui revient chaque mois, que vous décrochiez un chantier ou non. » Nom, **Montant**, hebdomadaire / mensuel / annuel, **Ajouter un coût fixe**.",
            "**Salaires** — frais généraux de l'entreprise seulement : votre propre retrait, un salaire de bureau. **Montant** avec hebdomadaire / mensuel / annuel / horaire (**Heures / semaine**, **Taux / h**). Pas utilisés pour payer qui que ce soit — la paie d'un employé vient de Gérer l'équipe et apparaît dans la Paie.",
            "**Dette** — prêts et contrats de financement : **Capital**, **Paiement mensuel**, **Taux d'intérêt (% par an)**, **Ajouter une dette**.",
            "**Actifs et amortissement** — le camion, la remorque, le pulvérisateur : **Prix payé**, **Valeur de reprise (facultatif)**, **Combien de mois durera-t-il ?**, **En service depuis**, **Acheté avec quel prêt ?**, **Vendu ou radié aujourd'hui**, **Ajouter un actif**.",
            "**Factures à payer** — **En souffrance**, **À sortir ce mois-ci**, **En retard**, chaque facture avec **Dû le {date}** et **Marquer payée**, **Ajouter une facture**.",
          ] },
        ],
      },
      {
        id: "how-the-price-is-worked-out",
        heading: "Comment le prix est calculé",
        blocks: [
          { steps: [
            "**Chantiers / mois** = **Chantiers par semaine** × 4,33.",
            "**Coûts fixes mensuels** = coûts fixes récurrents à leur équivalent mensuel + salaires + amortissement des actifs en service + intérêts des prêts liés à un actif + paiement complet des prêts liés à rien.",
            "**Coût par chantier** = Coûts fixes mensuels ÷ Chantiers / mois.",
            "**Prix minimum** = Coût par chantier ÷ (1 − marge cible). La marge par défaut est 20 %; le champ accepte de 0 à 95.",
          ] },
          { p: "Le chiffre de coût n'est pas le chiffre de trésorerie, et la page imprime les deux. La trésorerie compte tout le paiement du prêt et rien pour l'usure; le coût compte l'usure (l'amortissement) et seulement les intérêts d'un prêt qui a acheté un actif, parce que rembourser du capital n'est pas une dépense. Un plancher bâti sur la trésorerie facture le camion deux fois pendant que le prêt court et le perd le mois où le prêt se termine — c'est ainsi qu'un entrepreneur glisse en silence sous son seuil de rentabilité. Le **Rythme de dépenses mensuel** du Suivi des dépenses est le chiffre de trésorerie; les **Coûts fixes mensuels** ici sont le chiffre de coût." },
          { warning: "Un actif sans prêt lié à côté d'un prêt sans actif lié déclenche l'avertissement propre à la page : s'il s'agit du même camion, vous le facturez deux fois. Liez-les avec **Acheté avec quel prêt ?** et le prêt ne compte plus qu'en intérêts." },
        ],
      },
      {
        id: "what-each-register-feeds",
        heading: "Ce que chaque registre alimente",
        blocks: [
          { table: {
            head: ["Registre", "Dans le prix minimum", "Dans le rythme de dépenses", "Ailleurs"],
            rows: [
              ["Coûts fixes", "Oui, à l'équivalent mensuel", "Oui", "Les mêmes lignes qu'une dépense Récurrent + Frais généraux dans le Suivi des dépenses; les états comptent chacune dans le mois où elle est datée."],
              ["Salaires", "Oui", "Oui", "Nulle part ailleurs — ils ne paient jamais personne."],
              ["Dette", "Intérêts seulement quand lié à un actif; le paiement complet sinon", "Le paiement mensuel complet", "Intérêts et capital des prêts dans les États financiers; prêts en cours au bilan."],
              ["Actifs et amortissement", "Oui — amortissement linéaire pendant le service, qui s'arrête une fois entièrement amorti ou cédé", "Non — l'amortissement ne déplace aucun argent", "Valeur comptable par actif; le coût d'un véhicule dans Véhicules."],
              ["Factures à payer", "Non — « Les factures ne changent pas votre prix minimum — le coût récurrent ci-dessus le couvre déjà. Ceci est de la trésorerie, pas du coût. »", "Non", "Seulement cette page. Marquer une facture payée n'enregistre rien d'autre; payez-la comme d'habitude."],
            ],
          } },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Heures payées qui n'ont jamais atteint un chantier",
        blocks: [
          { p: "Pour chaque personne ayant une semaine garantie définie sous **Votre équipe**, le panneau compare les 30 derniers jours de cette garantie aux heures qu'elle a consignées sur un chantier, et chiffre l'écart à son taux horaire. Quelqu'un payé à l'heure sans semaine garantie n'a aucun écart à rapporter; quelqu'un sans taux au dossier montre des heures et aucun coût, et le total se dit incomplet plutôt que de compter ces heures comme gratuites. Le personnel de bureau est exclu — tout son coût est déjà des frais généraux." },
          { note: "L'encadré ambre le dit clairement : ceci n'est **pas** compté dans le coût par chantier ni dans le prix minimum. Il ferait bouger chaque soumission que vous rédigez à partir de pointages que personne n'a encore vérifiés, alors il est montré d'abord et laissé hors du prix. Ajoutez-le vous-même à votre prix et vous le comptez deux fois." },
        ],
      },
      {
        id: "where-the-number-goes",
        heading: "Où va le chiffre",
        blocks: [
          { p: "Le **Coût par chantier** est les frais généraux que le panneau Coût et marge du constructeur de soumissions impute à chaque estimation, de sorte que la marge d'une soumission à l'écran est nette de l'entreprise, pas seulement du chantier. La **Marge nette** du tableau de bord KPI en a besoin aussi — sans capacité, elle se lit « Indiquez combien de chantiers par semaine vous pouvez prendre dans Paramètres → Frais généraux, et la marge nette pourra être calculée. » La carte **Coûts fixes** de la page KPI et le rythme de dépenses du Suivi des dépenses lisent les mêmes registres." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Frais généraux** exige la capacité de gérer les utilisateurs **et** l'interrupteur **Job costing** : chaque salaire de l'entreprise et la marge de l'entreprise sont sur cette page. **Manager**, les administrateurs et le propriétaire la voient. Un Dispatcher peut gérer les utilisateurs mais n'a pas Job costing, alors la ligne est masquée et chaque point d'accès derrière refuse. Supprimer une ligne de registre demande d'abord — « votre prix plancher change immédiatement » — et supprimer un actif avertit que son historique d'amortissement part avec lui; marquez-le plutôt vendu pour conserver ce qu'il vous a déjà coûté." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi n'y a-t-il pas de prix minimum sur ma page ?", a: "Chantiers par semaine n'est pas défini. FieldQuo supposait autrefois trois chantiers par semaine pour tout le monde et tarifait chaque soumission contre un chiffre inventé; il refuse maintenant de répondre tant que vous n'avez pas tapé le vôtre." },
      { q: "Les salaires de mon équipe ne sont pas dans Salaires. Le prix est-il trop bas ?", a: "Non. Les heures de l'équipe sont imputées à chaque chantier comme main-d'œuvre, alors le coût propre d'un chantier les porte. Salaires ici est pour la paie générale seulement — votre retrait, un salaire de bureau. Y mettre un taux d'équipe le compterait deux fois." },
      { q: "Le prêt est remboursé. Le camion disparaît-il de mes coûts ?", a: "Pas s'il est dans Actifs et amortissement. Le paiement du prêt s'arrête, l'usure continue d'être imputée jusqu'à ce que l'actif soit entièrement amorti, et vous continuez d'épargner pour le remplacer." },
      { q: "Le prix minimum comprend-il les matériaux et la main-d'œuvre ?", a: "Non. Il couvre uniquement les frais généraux; les matériaux et la main-d'œuvre du chantier s'ajoutent. Le constructeur de soumissions les ajoute à partir de l'estimation." },
    ],
  },
};
