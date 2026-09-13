// content/help/fr/reports-and-insights-1.js
//
// Partie 1 de la catégorie « reports-and-insights » en français (voir le
// composeur, reports-and-insights.js). Slugs de cette partie
// (lib/help/tree.js) : the-dashboard-in-detail, the-revenue-goal,
// how-you-compare, the-kpi-dashboard, kpi-sales, kpi-money-flow,
// kpi-business-costs, kpi-profit, kpi-execution, kpi-quality, kpi-cash.
//
// Même structure que le module anglais; les mots à l'écran viennent du bloc
// `fr` de app/i18n/appMessages.js. L'éditeur d'accès (lib/permissions.js)
// n'est pas traduit dans l'application : ses préréglages (Crew, Estimator,
// Dispatcher, Manager) et ses paliers (View only, See prices…) sont donc
// cités tels qu'ils apparaissent à l'écran.
export const ARTICLES = {
  "the-dashboard-in-detail": {
    title: "Le tableau de bord en détail",
    summary:
      "Chaque carte de l'Accueil, de haut en bas : ce qui vous attend, le chiffre des revenus et les quatre tuiles, le détail en dessous, le bouton Relancer le paiement, et qui voit quel panneau.",
    updated: "2026-09-12",
    intro: [
      "**Tableau de bord — Voici où en est votre entreprise.** L'Accueil est l'écran que votre équipe ouvre le plus souvent; il est donc classé plutôt que carrelé : ce qui a besoin d'une personne aujourd'hui vient en premier, puis le seul chiffre qui fait tourner l'entreprise, puis quatre chiffres d'appui, et tout le reste sous une ligne nommée **Le détail**. Cet article le parcourt de haut en bas et dit d'où vient chaque nombre.",
      "[[the-dashboard|Le tableau de bord : ce qui vous attend]] est la version courte — le classement et sa raison. Celui-ci est le détail : chaque carte, chaque état qu'une carte peut prendre, chaque bouton, et quel niveau d'accès voit quoi.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque chiffre de la page provient d'une poignée de points d'accès, et chaque panneau n'est dessiné que lorsque son point d'accès a répondu. Un membre à qui le serveur refuse un panneau ne reçoit tout simplement pas ce panneau — ni zéro, ni excuse — parce que « 0 $ de revenus ce mois-ci » est une affirmation sur l'entreprise, pas un vide. Un panneau qui a échoué pour toute autre raison le dit et propose de réessayer." },
          { p: "Deux mesures de l'argent se côtoient et ne sont jamais mélangées. **Revenus ce mois-ci** totalise les factures marquées payées ce mois-ci, selon la date où elles ont été payées. **Argent reçu** compte les paiements selon le mois où l'argent est entré. Une facture marquée payée en août avec un acompte consigné en juillet donne deux chiffres différents, volontairement, et la légende sous le graphique dit lequel est lequel." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "En attente de vous",
        blocks: [
          { p: "**En attente de vous** ouvre la page et liste les factures réellement en retard — le client, le montant, **12 jours de retard**, le numéro de facture — avec un bouton **Relancer le paiement** sur chacune. Jusqu'à cinq lignes sont nommées; au-delà, un lien **{count} autres en retard** ouvre la liste des Factures. Une facture sans date d'échéance n'est jamais ici : elle n'a aucune échéance à manquer." },
          { bullets: [
            "**2 soumissions en attente de votre approbation du prix.** — des estimations instantanées venues de votre site web ou d'un appel, qui attendent dans les [[estimate-reviews|Révisions de soumissions]] qu'une personne confirme le prix.",
            "**3 appels de votre réceptionniste — rien de fait pour l'instant.** — des appels pris par la réceptionniste IA qui ne sont ni devenus une soumission ni été archivés. La ligne ouvre l'écran Réceptionniste.",
            "**Vous avez 1 rendez-vous à venir depuis vos appels — le prochain est …** — les visites réservées par la réceptionniste qui sont encore à venir. La ligne ouvre le calendrier.",
          ] },
          { figure: "harness:home", caption: "Tableau de bord — En attente de vous en haut, puis Revenus ce mois-ci à côté de la courbe Argent reçu, puis les quatre tuiles." },
          { note: "Le bloc disparaît de lui-même quand rien n'est en retard et que rien n'attend. Une journée calme n'a pas de bandeau, et c'est ce qui donne du sens au bandeau les jours chargés." },
        ],
      },
      {
        id: "revenue-and-the-four-tiles",
        heading: "Revenus ce mois-ci et les quatre tuiles",
        blocks: [
          { p: "**Revenus ce mois-ci** est le total des factures marquées payées depuis le 1er, en gros caractères, avec la légende « Le total des factures marquées payées ce mois-ci. » En dessous, une variation par rapport au mois dernier — « 2 480,50 $ CA de plus que le mois dernier. » — n'apparaît que si l'entreprise existait pendant tout le mois précédent; une entreprise dans son premier mois obtient le chiffre et aucune tendance inventée. À droite, **Argent reçu** trace les six derniers mois de paiements sous forme de courbe, avec une phrase comparant les deux derniers mois complets — jamais le mois en cours contre un mois terminé." },
          { table: {
            head: ["Tuile", "Ce qu'elle compte", "La ligne de variation en dessous"],
            rows: [
              ["**Soumissions envoyées ce mois-ci**", "Les soumissions créées ce mois-ci dont le statut est envoyée, acceptée ou refusée.", "« 2 de plus que le mois dernier. » — seulement si le mois dernier était un mois complet d'activité."],
              ["**Taux de conversion**", "Soumissions acceptées ce mois-ci ÷ soumissions envoyées ce mois-ci, imprimé avec ses effectifs à côté : « 38 % » puis « 6 sur 16 · % de soumissions envoyées acceptées par les clients »." , "« 9 points de plus que le mois dernier. » — seulement si les deux mois comptaient au moins 10 soumissions envoyées."],
              ["**Argent dû**", "Ce qui reste à recevoir sur toutes les factures impayées — la dernière version de chacune, moins les paiements consignés dessus — et « {amount} de ce montant est en retard. »", "Aucune. Un solde n'a pas de chiffre honnête du mois dernier à comparer."],
              ["**Visites à venir**", "Tous les rendez-vous, visites de chantier et réservations en attente encore devant vous.", "Aucune. Ce qui est à venir n'a pas de période précédente."],
            ],
          } },
          { p: "Sous 10 soumissions envoyées, la tuile de conversion n'affiche que les effectifs — « 1 sur 1 », puis « Soumissions acceptées. Un taux exige 10 envois dans le mois pour vouloir dire quelque chose. » Un pourcentage tiré de deux soumissions est un chiffre sur lequel vous agiriez et sur lequel vous ne devriez pas agir. Argent dû a trois états et aucun d'eux n'est 0,00 $ : « Aucune facture pour l'instant, alors rien ne vous est dû. », « Rien en souffrance — toutes les factures que vous avez envoyées ont été réglées. », ou le chiffre." },
        ],
      },
      {
        id: "the-detail",
        heading: "Le détail",
        blocks: [
          { p: "Trois boutons se trouvent entre les tuiles et la ligne : **+ Nouvelle soumission** (dessiné seulement pour quelqu'un qui peut créer des soumissions), **Voir les clients** et **Planifier un rendez-vous**. Sous **Le détail**, la page conserve tout ce avec quoi elle s'ouvrait autrefois :" },
          { bullets: [
            "**Argent reçu** — le graphique à barres mensuel avec les boutons **3 mois / 6 mois / 12 mois**. Le mois en cours est dessiné en gris et légendé comme non terminé; un mois sans rien n'a aucune barre.",
            "**Argent dû** — le total « Réparti sur {count} factures impayées », le montant en retard, l'échelle d'ancienneté (**Pas encore dû**, **1 à 30 jours**, **31 à 60 jours**, **61 à 90 jours**, **90 jours et plus**, plus **Aucune date d'échéance**) qui n'affiche que les échelons occupés, puis jusqu'à six factures avec les coordonnées du client, **modifiée, v2** s'il y a eu une révision, un lien **Chantier**, les lignes **Dernière relance le … · 2×** et **Rappel automatique envoyé le …**, et le bouton Relancer le paiement. Le pied de carte dit si un rappel automatique de retard existe, avec **En configurer un** ou **Le modifier**. Tout le détail : [[money-owed-and-receivables-aging|Argent dû et âge des comptes clients]].",
            "**Revenue goal** — l'objectif annuel et votre rythme par rapport à lui; voir [[the-revenue-goal|L'objectif de revenus]].",
            "Les réservations retenues pour des frais de visite pas encore payés — elles ne figurent sur aucun calendrier, c'est donc le seul endroit où elles apparaissent. Absentes quand il n'y en a pas.",
            "**Soumissions récentes** — les cinq plus récentes, avec **Tout voir**. Absent pour un membre qui ne peut pas voir les soumissions.",
            "**Prochains rendez-vous** — les cinq prochains à l'agenda, avec **Tout voir**. Un membre qui ne voit que son propre horaire voit ici les siens.",
          ] },
          { p: "Au-dessus de l'argent, une nouvelle entreprise voit aussi **Terminer la configuration de FieldQuo** avec son anneau de progression tant que chaque étape n'est pas faite, et un propriétaire ou un administrateur voit **Étapes de configuration supplémentaires** — dix lignes qui disparaissent chacune quand la base de données dit que l'étape est faite, ou quand vous appuyez sur **Fait, masquer**." },
        ],
      },
      {
        id: "how-to-chase",
        heading: "Comment relancer un paiement depuis l'Accueil",
        blocks: [
          { steps: [
            "Trouvez la facture dans **En attente de vous** (si elle est en retard) ou dans **Argent dû** (en retard ou non) et appuyez sur **Relancer le paiement**.",
            "FieldQuo envoie au client, par courriel et au nom de votre entreprise, une demande de paiement avec un lien vers son portail, puis horodate la facture. La ligne se lit alors « Demande de paiement envoyée à {address} à {time} ».",
            "Si le client n'a pas de courriel au dossier, la ligne le dit au lieu d'afficher un bouton. **Dernière relance le … · 2×** compte vos relances; **Rappel automatique envoyé le …** montre ce que la règle de retard décrite dans [[invoice-reminders-and-chasing|Rappels de facture et relances]] a déjà fait toute seule.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'Accueil figure dans la barre latérale de tout le monde, mais chaque panneau a sa propre barrière, vérifiée par le serveur. L'argent — le chiffre des revenus, trois des quatre tuiles, Argent reçu et Argent dû — exige l'interrupteur **See prices**; Argent dû exige en plus au moins **View only** sur les factures. Soumissions récentes exige View only sur les soumissions. Le bouton Relancer le paiement exige **View, create, and edit** sur les factures. Les cartes de configuration sont pour les propriétaires et les administrateurs." },
          { p: "Avec les quatre préréglages : **Crew** voit les Visites à venir et ses propres Prochains rendez-vous, et rien sur l'argent; **Estimator**, **Dispatcher** et **Manager** voient toute la page; et seuls un Manager, un propriétaire ou un administrateur peuvent appuyer sur Relancer le paiement. Les panneaux qu'un membre ne peut pas voir sont absents, pas mis à zéro. Voir [[access-levels-overview|Niveaux d'accès : qui voit quoi]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Revenus ce mois-ci et Argent reçu ne concordent-ils pas ?", a: "Ils mesurent des choses différentes : les factures marquées payées ce mois-ci, et les paiements selon le mois où l'argent est arrivé. Un acompte reçu en juillet sur une facture marquée payée en août apparaît dans la barre de juillet et dans le chiffre d'août." },
      { q: "Pourquoi n'y a-t-il pas de ligne de variation sous Revenus ce mois-ci ?", a: "La comparaison exige que le mois dernier ait été un mois complet d'activité. Une entreprise inscrite le 15 obtient le chiffre et aucune tendance tant que son premier mois complet n'est pas passé." },
      { q: "Un membre de l'équipe ne voit rien sous Argent dû. Est-ce brisé ?", a: "Non — ce membre s'est vu refuser le chiffre, généralement parce que See prices est désactivé ou que les factures sont à No access. Un panneau refusé est omis plutôt qu'affiché à 0 $." },
    ],
  },

  "the-revenue-goal": {
    title: "L'objectif de revenus",
    summary:
      "Fixez un objectif annuel une seule fois et l'Accueil vous dit si vous êtes en avance ou en retard sur lui aujourd'hui, en dollars — comment le rythme, la projection et le chiffre mensuel sont calculés, et qui peut changer l'objectif.",
    updated: "2026-09-12",
    intro: [
      "La carte **Revenue goal** de l'Accueil est un objectif annuel que vous fixez une fois, et une barre de rythme qui dit si vous êtes en avance ou en retard sur lui aujourd'hui. Elle commence par le rythme, en dollars, parce que « 180 000 $ sur 500 000 $ » ne veut rien dire sans la date — 36 % est un triomphe en avril et un désastre en novembre.",
      "Tout ce qui est sur la carte est calculé à partir du seul nombre que vous tapez. Rien d'autre n'est stocké : les cibles mensuelle et hebdomadaire, le rythme et la projection sont tous dérivés, alors ils ne peuvent jamais s'éloigner du chiffre annuel.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'objectif appartient à l'entreprise, pas à une personne : une seule cible, fixée par un propriétaire ou un administrateur, montrée à tous ceux qui voient l'argent du tableau de bord. La progression se mesure sur le même chiffre que **Revenus ce mois-ci** — les factures marquées payées, selon la date où elles ont été payées — élargi à l'année, de sorte que la carte de l'objectif et la carte des revenus ne peuvent jamais raconter deux histoires différentes sur le même argent." },
          { p: "Sans objectif fixé, un propriétaire ou un administrateur voit la carte comme une invitation à en fixer un — « Set a target for the year and the dashboard will track your pace toward it. » avec un bouton **Set a revenue goal** — et tous les autres ne voient aucune carte. Il n'y a pas d'invitation inerte pour quelqu'un qui ne peut pas y donner suite." },
        ],
      },
      {
        id: "set-the-goal",
        heading: "Comment fixer, changer ou effacer l'objectif",
        blocks: [
          { steps: [
            "Ouvrez l'**Accueil** et descendez jusqu'à **Le détail**. Appuyez sur **Set a revenue goal**, ou sur le crayon d'une carte existante (**Change goal**).",
            "Tapez la cible de l'année dans la case **$ … / year**. Pendant que vous tapez, la carte dit ce que cela représente par mois et par semaine — « That's about $41,667/month, $9,615/week. »",
            "Appuyez sur **Save**. Le chiffre est arrondi au dollar et plafonné à 100 000 000 $, pour qu'un zéro de trop tapé par erreur soit attrapé plutôt que stocké et ne rende pas silencieusement chaque cible impossible.",
            "Pour le retirer, rouvrez l'éditeur et appuyez sur **Clear goal**. Enregistrer une case vide ou un zéro l'efface de la même façon.",
          ] },
          { note: "Fixer ou effacer l'objectif est inscrit au Journal d'activité comme « Set the revenue goal to … » ou « Cleared the revenue goal », sous le nom de la personne qui l'a fait." },
        ],
      },
      {
        id: "what-the-card-shows",
        heading: "Ce que montre la carte",
        blocks: [
          { table: {
            head: ["Ligne", "Ce qu'elle veut dire"],
            rows: [
              ["**Revenue goal · $500,000/yr**", "La cible annuelle que vous avez enregistrée."],
              ["**$180,000 this year**", "Les factures marquées payées depuis le 1er janvier, selon la date de paiement."],
              ["**On pace** / **$22,000 behind pace** / **$9,000 ahead of pace**", "Les revenus à ce jour comparés à ce qu'un rythme régulier aurait produit aujourd'hui. En retard est ambre; dans le rythme et en avance sont verts."],
              ["La barre et le repère", "Le remplissage est la progression vers l'objectif; le petit repère est là où un rythme régulier vous placerait aujourd'hui. Un remplissage avant le repère est en retard; après, en avance."],
              ["**36% of goal**", "Les revenus à ce jour en part de la cible annuelle."],
              ["**$41,667/mo · projecting $480k**", "La cible annuelle divisée par douze, et là où l'année se termine si le rythme quotidien d'aujourd'hui se maintient."],
            ],
          } },
        ],
      },
      {
        id: "how-pace-is-worked-out",
        heading: "Comment le rythme est calculé",
        blocks: [
          { bullets: [
            "**Attendu à ce jour** est l'objectif annuel multiplié par la fraction de l'année écoulée, comptée en jours civils sur le calendrier UTC — 366 dans une année bissextile, pour que le calcul ne dérive jamais d'un jour.",
            "**On pace** signifie que les revenus à ce jour sont à 2 % près de ce chiffre attendu, dans un sens ou dans l'autre — une marge de tolérance, pour que la carte ne bascule pas entre en avance et en retard à chaque vente.",
            "**Projecting** maintient le rythme quotidien d'aujourd'hui pour le reste de l'année. Dans les premiers jours de janvier, un gros chantier projette un nombre farfelu; c'est pourquoi la projection est en petits caractères à côté de la cible mensuelle plutôt qu'en titre.",
            "La cible mensuelle est l'annuel divisé par 12, à plat; l'hebdomadaire par 52; la quotidienne par 365. Aucune courbe saisonnière n'est inventée — le mars et le décembre d'un peintre ne se ressemblent pas, et la carte ne prétend pas savoir de combien.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Quiconque voit l'argent du tableau de bord — l'interrupteur **See prices** — voit la carte dès qu'un objectif existe. Seuls un **propriétaire** ou un **administrateur** peuvent le fixer, le changer ou l'effacer : le serveur refuse tous les autres, et le crayon n'est pas dessiné pour eux. Un Manager voit le rythme mais ne peut pas déplacer la cible." },
          { note: "Les mots de cette carte ne sont pas encore dans le catalogue de traduction. Elle se lit en anglais — « Revenue goal », « On pace », « behind pace » — quelle que soit la langue du reste de l'application." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je fixer un objectif mensuel à la place ?", a: "Pas directement. Vous fixez l'année et la carte en dérive le mois (l'annuel divisé par 12) et la semaine (divisé par 52). Un chiffre mensuel stocké s'éloignerait de l'annuel dès que l'un ou l'autre serait modifié." },
      { q: "L'objectif compte-t-il les soumissions acceptées ou les factures envoyées ?", a: "Ni l'un ni l'autre. Il compte les factures marquées payées cette année, selon la date où elles ont été payées — la même mesure que Revenus ce mois-ci." },
      { q: "Pourquoi la projection semble-t-elle fausse en janvier ?", a: "Elle maintient le rythme quotidien observé jusqu'ici pour le reste de l'année, et quelques jours de données font un mauvais rythme. Elle se stabilise à mesure que l'année se remplit." },
    ],
  },

  "how-you-compare": {
    title: "Comment vous vous comparez : vos prix face à la plateforme",
    summary:
      "Les Analyses s'ouvrent sur une comparaison de prix anonymisée : votre moyenne par catégorie de service contre la moyenne de toutes les entreprises qui ont adhéré — comment adhérer, ce qui entre exactement dans la moyenne, et ce que la page ne montre jamais.",
    updated: "2026-09-12",
    intro: [
      "**Comment vous vous comparez — Le prix moyen de vos soumissions comparé à la moyenne anonymisée de la plateforme, par catégorie de service.** Les Analyses s'ouvrent sur cette page : pour chaque catégorie de service que vous avez activée, ce que vous facturez en moyenne contre ce que facturent toutes les autres entreprises qui ont adhéré, et l'écart en pourcentage.",
      "C'est facultatif, ce sont des agrégats seulement, et cela ne montre jamais la soumission d'une autre entreprise. Tous les autres rapports de FieldQuo répondent uniquement sur vos propres données; c'est le seul écran où les chiffres d'autres locataires apparaissent, regroupés et anonymisés. Cet article dit exactement ce qui entre dans la moyenne et ce qui n'y entre pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est une ligne par catégorie, sous une rangée de liens — **Résumés hebdomadaires**, **États financiers**, **Gagnées et perdues**, **Justesse des estimations**, **Tableau de bord KPI** — parce que la barre latérale n'a qu'une ligne **Analyses** pour tout le groupe. Tant que vous n'avez pas adhéré, les lignes sont remplacées par « L'analyse comparative est facultative. Activez-la dans les Paramètres pour voir comment vos prix se comparent — vos soumissions individuelles ne sont jamais partagées, seulement des moyennes agrégées. » avec un bouton **Aller aux Paramètres**." },
          { figure: "live:app-analytics-benchmark", caption: "Analyses → Comment vous vous comparez avant l'adhésion — la note, le bouton Aller aux Paramètres et les liens vers le reste du groupe." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "Comment l'activer",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et trouvez la carte **Comparatif sectoriel**.",
            "Cochez **Partager mes chiffres anonymisés pour débloquer les comparatifs** et enregistrez. L'indication en dessous résume tout l'accord : « Vos chiffres sont regroupés avec ceux d'autres entreprises et ne sont jamais affichés individuellement. Vous pouvez désactiver cette option à tout moment. »",
            "Revenez aux **Analyses**. Une ligne apparaît pour chaque catégorie que vous avez activée où l'échantillon de la plateforme est assez grand.",
            "Pour vous retirer, décochez la case et enregistrez. Vos chiffres cessent d'alimenter le bassin et la page revient à la note d'adhésion.",
          ] },
          { note: "Le partage est symétrique : le bassin n'est construit qu'à partir des entreprises qui ont coché la case, alors vous ne le lisez que tant que vous y contribuez." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { figure: "harness:insights", caption: "Comment vous vous comparez — une ligne par catégorie : votre moyenne, la moyenne de la plateforme et l'écart." },
          { table: {
            head: ["Colonne", "Ce que c'est"],
            rows: [
              ["La catégorie, et « 61 soumissions dans votre région ce trimestre »", "Une catégorie de service de Paramètres → Services, et la taille de l'échantillon de la plateforme dont la moyenne est tirée."],
              ["**Votre moyenne**", "Le montant chiffré moyen des groupes de portée de cette catégorie, sur vos propres soumissions."],
              ["**Moyenne de la plateforme**", "La même moyenne sur les soumissions de toutes les entreprises adhérentes dans cette catégorie."],
              ["La flèche et le pourcentage", "Vous face à la plateforme : vert avec une flèche vers le haut au-dessus de +3 %, ambre avec une flèche vers le bas sous −3 %, un tiret gris entre les deux. Un tiret sans pourcentage veut dire qu'il n'y avait rien à comparer."],
            ],
          } },
        ],
      },
      {
        id: "how-the-average-is-built",
        heading: "Comment la moyenne est construite",
        blocks: [
          { bullets: [
            "Les deux moyennes sont prises sur les **groupes de portée** — les sections d'une soumission regroupées par catégorie — pas sur des soumissions entières. Une soumission de cuisine avec un groupe armoires et un groupe comptoirs contribue à deux lignes.",
            "Une ligne n'apparaît que si vous avez au moins un groupe chiffré dans cette catégorie et que la plateforme en a au moins **5**. Sous cinq, le prix d'un concurrent pourrait se déduire de la moyenne, alors rien n'est publié.",
            "Les entreprises de démonstration sont exclues du bassin quels que soient leurs propres réglages — des prix inventés n'ont pas à dire à un vrai entrepreneur ce que le marché facture.",
            "Quand aucun groupe d'un échantillon n'a de montant chiffré, la moyenne affiche **—** plutôt que 0,00 $, et aucun pourcentage n'en est tiré.",
            "Le calcul n'a aujourd'hui ni fenêtre de dates ni filtre régional : il fait la moyenne de tous les groupes de portée chiffrés de la catégorie, toutes périodes confondues, pour vous et pour le bassin. La formulation de la ligne d'échantillon sur la région et le trimestre est en avance sur le code.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres outils ne font pas",
        blocks: [
          { p: "Les pages de comparaison de FieldQuo consignent ce que la page de tarifs de chaque concurrent affiche, avec la date de lecture. Aucune des cinq pages de tarifs suivies — Jobber, Housecall Pro, ServiceTitan, Projul et QuoteIQ — n'affiche de comparaison de vos prix avec d'autres entreprises de la même plateforme, alors cette page figure sous « non affiché sur leur page de tarifs » dans chaque comparaison." },
          { p: "C'est toute l'affirmation. Elle ne dit pas que les autres ne pourraient pas en construire une; elle dit qu'ils n'en vendent pas sur la page qu'un acheteur lit." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La page et son point d'accès exigent l'interrupteur **See prices** — chaque nombre qui s'y trouve est de l'argent, y compris votre propre grille tarifaire. Crew est refusé; Estimator, Dispatcher, Manager, les propriétaires et les administrateurs peuvent la lire. La case d'adhésion se trouve dans le Profil de l'entreprise, qui exige la permission de gestion du personnel — Dispatcher, Manager, propriétaire ou administrateur." },
        ],
      },
    ],
    faq: [
      { q: "Une autre entreprise peut-elle voir mes soumissions ?", a: "Non. Seule une moyenne sur au moins cinq groupes de portée du bassin est jamais montrée, et une catégorie qui en compte moins de cinq n'est pas montrée du tout." },
      { q: "Pourquoi une catégorie manque-t-elle dans la liste ?", a: "Soit vous n'y avez aucune soumission chiffrée, soit moins de cinq soumissions de la plateforme existent encore pour elle. La page dit « Pas encore assez de données de plateforme pour votre région/catégorie » quand rien ne se qualifie." },
      { q: "Adhérer change-t-il ce que voient mes clients ?", a: "Non. Cela ne change rien aux soumissions, aux factures ni à la page de réservation — seulement si vos chiffres rejoignent le bassin et si cette page affiche des lignes." },
    ],
  },

  "the-kpi-dashboard": {
    title: "Le tableau de bord KPI",
    summary:
      "Un seul écran pour les ventes, le flux de trésorerie, les coûts de l'entreprise, la marge, l'exécution, la qualité, la trésorerie et le client — les boutons de période, ce que contient chaque section, comment se lit une carte sans données, et qui peut l'ouvrir.",
    updated: "2026-09-12",
    intro: [
      "**Tableau de bord des indicateurs clés — Ventes, marge, exécution et trésorerie, au même endroit — la plupart de ces chiffres n'ont jamais eu d'écran avant celui-ci. Une carte sans données explique pourquoi, plutôt que d'afficher un zéro.** Ce sous-titre est la conception même : un sélecteur de période, neuf sections, et une règle voulant qu'une carte imprime un chiffre qu'elle peut défendre ou dise en mots pourquoi elle ne le peut pas.",
      "Cet article est la carte de l'écran — les boutons de période, les sections et ce que chacune contient, comment lire une carte, et qui peut ouvrir la page. Chaque section a son propre article avec la définition exacte de chaque carte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page se trouve sous **Analyses → KPI** dans la barre latérale, avec un lien **Comment vous vous situez** vers le carrefour des Analyses. Rien n'y est calculé une seconde fois : le taux de réussite est celui du rapport Gagnées et perdues, les créances clients sont celles du tableau de bord, la justesse des estimations est celle du rapport Justesse des estimations — un chiffre ici ne peut donc jamais contredire l'écran d'où il vient." },
          { figure: "live:app-analytics-kpis", caption: "Tableau de bord KPI — les boutons de période, puis Ventes, Flux de trésorerie, Coûts de l'entreprise, Marge et Exécution, chaque carte imprimant un chiffre ou la raison pour laquelle elle ne le peut pas." },
        ],
      },
      {
        id: "the-period",
        heading: "La période",
        blocks: [
          { p: "Cinq boutons choisissent la période, et un seul choix gouverne toutes les sections. Le défaut est **Ce trimestre**. Les périodes sont des périodes civiles sur le calendrier UTC — le même calendrier que tous les rapports utilisent — pour que deux écrans ne se contredisent jamais sur le mois auquel appartient un document." },
          { bullets: [
            "**Ce mois-ci** — du 1er au dernier jour du mois en cours.",
            "**Le mois dernier** — tout le mois précédent.",
            "**Ce trimestre** — le trimestre civil en cours, jusqu'à son dernier jour.",
            "**Depuis le début de l'année** — du 1er janvier à aujourd'hui.",
            "**L'an dernier** — du 1er janvier au 31 décembre de l'an dernier.",
          ] },
          { note: "Ce mois-ci et Ce trimestre vont jusqu'à la fin de la période, pas jusqu'à aujourd'hui. Les cartes qui comparent à une période précédente en tiennent compte — voir [[kpi-money-flow|KPI : Flux de trésorerie]] — pour qu'un trimestre vieux de trois jours ne soit pas mesuré contre un trimestre complet." },
        ],
      },
      {
        id: "the-sections",
        heading: "Les sections",
        blocks: [
          { table: {
            head: ["Section", "Cartes", "Article"],
            rows: [
              ["**Ventes**", "Taux de réussite · Valeur moyenne d'un chantier · Conversion prospect → soumission · Carnet de commandes", "[[kpi-sales|KPI : Ventes]]"],
              ["**Flux de trésorerie**", "Revenu · Dépenses · Restant · Revenus et dépenses, par jour · Où est passé l'argent", "[[kpi-money-flow|KPI : Flux de trésorerie]]"],
              ["**Coûts de l'entreprise**", "Paie de cette période · Coûts fixes · Dépenses marketing · Engagé, pas encore facturé", "[[kpi-business-costs|KPI : Coûts de l'entreprise]]"],
              ["**Marge**", "Marge brute (chantier type) · Marge nette (chantier type) · Coût de main-d'œuvre, % du chiffre d'affaires · Chiffre d'affaires par employé", "[[kpi-profit|KPI : Marge]]"],
              ["**Exécution**", "Achèvement à temps · Utilisation de la main-d'œuvre · Précision des estimations (écart médian) · Chantiers récents : fenêtre planifiée vs achèvement", "[[kpi-execution|KPI : Exécution]]"],
              ["**Qualité**", "Taux de reprises / rappels · Taux d'avenants", "[[kpi-quality|KPI : Qualité]]"],
              ["**Trésorerie**", "Créances clients, par ancienneté · Montants reçus, 6 derniers mois", "[[kpi-cash|KPI : Trésorerie]]"],
              ["**Client**", "Satisfaction client · Réponses par note", "[[kpi-customer|KPI : Client]]"],
              ["**Non suivi**", "Les indicateurs que la page nomme et refuse d'inventer", "[[the-metrics-fieldquo-refuses-to-invent|Les indicateurs que FieldQuo refuse d'inventer]]"],
            ],
          } },
        ],
      },
      {
        id: "how-a-card-reads",
        heading: "Comment lire une carte",
        blocks: [
          { bullets: [
            "Une **valeur** en gros caractères, et en dessous l'échantillon dont elle est tirée — « 24 chantiers/soumissions ». Un taux sans son dénominateur est un chiffre qu'il faut croire plutôt que vérifier, alors l'effectif est toujours à côté.",
            "Un **—** et une phrase quand il n'y a pas de valeur : « 1 sur 10 pour l'instant — 9 de plus et ce chiffre devient fiable. », « Aucun chantier n'a été terminé pendant cette période. », « Aucun prospect cette période. » La phrase est la raison de la carte, jamais un texte de remplissage.",
            "Un **triangle d'avertissement** quand le chiffre est réel mais incomplet de façon connue — des heures sans taux de paie, des matériaux achetés sur la liste d'achats et jamais saisis en dépense — avec « données incomplètes, voir ci-dessous ». Le chiffre est montré; il n'est pas moyenné par-dessus le trou.",
            "Deux seuils. Un **pourcentage** (taux de réussite, conversion, achèvement à temps, reprises, avenants) exige **10** résultats décidés; une **valeur centrale** sur des chantiers (valeur moyenne d'un chantier, les marges, le coût de main-d'œuvre, la satisfaction) en exige **5**. Sous le seuil, la carte compte ce qu'elle a et dit combien il lui en manque.",
            "Un **≈** devant un montant signifie qu'une partie a été convertie d'une autre devise au taux épinglé; l'indication sous la tuile nomme le montant d'origine et l'âge du taux.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres outils ne font pas",
        blocks: [
          { p: "Ce tableau de bord n'est pas encore dans le tableau comparatif public de FieldQuo — la matrice des fonctionnalités l'omet tant qu'aucune page de fonctionnalité n'existe pour lui, plutôt que de revendiquer une ligne que personne ne peut lire. Ce que fait le code et qu'un tableau de bord générique ne fait pas : une carte sous son seuil d'échantillon n'imprime aucun pourcentage, un chiffre incomplet de façon connue est signalé au lieu d'être lissé, et une section nommée **Non suivi** nomme les indicateurs qu'elle refuse de fabriquer." },
          { p: "Là où un morceau en est offert par un concurrent, la matrice le dit : le calcul du coût de revient figure au palier Grow de Jobber et au palier Pro de QuoteIQ, ce qui explique pourquoi [[job-costing|Coût de revient]] n'est pas marqué comme propre à FieldQuo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La page est tout ou rien : le serveur refuse la requête KPI à moins que le membre détienne **View only** ou mieux sur les soumissions, les chantiers, les factures et les demandes, voie tous les chantiers plutôt que seulement les siens, et ait les interrupteurs **See prices** et **Job costing**. La ligne de la barre latérale est masquée sur le seul interrupteur Job costing; une adresse mise en favori est arrêtée par la même vérification." },
          { bullets: [
            "Avec les préréglages : **Crew**, **Estimator** et **Dispatcher** sont refusés — aucun d'eux ne détient Job costing. **Manager**, les propriétaires et les administrateurs voient la page.",
            "**Flux de trésorerie** a sa propre barrière à l'intérieur de la page — les factures à View only, les dépenses à **View, record, and edit everyone's**, See prices — et refuse dans la section, pas toute la page. Manager passe.",
            "**Coûts de l'entreprise** est plus étroit encore : Job costing plus **View everyone's payslips** sur la paie plus la gestion du personnel. Avec les préréglages, ce sont les propriétaires et les administrateurs; un Manager voit le reste de la page et un refus dans cette section.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une carte affiche-t-elle — alors que je connais le chiffre ?", a: "Parce que la page n'imprime pas un chiffre sous son seuil ou sans preuve. La phrase sous le tiret dit ce qu'il faut — généralement plus de soumissions décidées ou plus de chantiers terminés dans la période." },
      { q: "Puis-je choisir mes propres dates ?", a: "Non. Cinq préréglages, et une seule sélection pour toute la page. La page États financiers utilise les mêmes cinq." },
      { q: "Où est la sécurité ?", a: "La page KPI n'a pas de carte de sécurité aujourd'hui. Les incidents sont consignés et listés sur l'écran Sécurité; le taux par 1 000 heures que l'API calcule n'a pas encore de carte." },
    ],
  },

  "kpi-sales": {
    title: "KPI : Ventes",
    summary:
      "Les quatre cartes Ventes du tableau de bord KPI — taux de réussite, valeur moyenne d'un chantier, conversion prospect → soumission et carnet de commandes en semaines — avec la définition exacte de chacune et l'échantillon qu'il lui faut avant de s'imprimer.",
    updated: "2026-09-12",
    intro: [
      "**Ventes — Ce qui est parti, ce qui est revenu, et votre avance de réservation.** Quatre cartes : **Taux de réussite**, **Valeur moyenne d'un chantier**, **Conversion prospect → soumission** et **Carnet de commandes**. Les deux premières sont lues directement dans le rapport Gagnées et perdues, alors elles ne peuvent jamais le contredire; les deux autres n'existent qu'ici.",
      "Chaque carte porte la taille de son échantillon, et aucune n'imprime un pourcentage sous 10 résultats décidés ni une moyenne sous 5 soumissions gagnées. Sous le seuil, la carte dit combien il lui en manque.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une soumission appartient à la période selon la date où elle a été **envoyée**; une soumission jamais marquée envoyée compte selon la date où elle a été acceptée ou refusée. Un trio Bon / Mieux / Meilleur est une seule occasion, pas trois : le groupe est réduit avant tout comptage, de sorte qu'un client choisissant une option sur trois ne peut pas apparaître comme une victoire et deux défaites." },
          { figure: "harness:kpis", caption: "Tableau de bord KPI → Ventes — Taux de réussite, Valeur moyenne d'un chantier, Conversion prospect → soumission et Carnet de commandes, chacune avec son échantillon." },
        ],
      },
      {
        id: "win-rate",
        heading: "Taux de réussite",
        blocks: [
          { p: "Le **Taux de réussite** est la part des soumissions décidées qui ont été gagnées : soumissions acceptées ÷ (acceptées + refusées). Une soumission encore envoyée et sans réponse n'est ni l'un ni l'autre — elle n'est pas au dénominateur." },
          { bullets: [
            "Il s'imprime une fois que **10** soumissions de la période ont été décidées. En dessous : « 1 sur 10 pour l'instant — 9 de plus et ce chiffre devient fiable. »",
            "Rien de décidé encore : « Rien n'a encore été décidé cette période. Une fois que 10 soumissions seront marquées gagnées ou perdus, votre taux de réussite s'affichera ici. » Aucune soumission du tout : « Envoyez des soumissions et faites-en décider 10 — gagnés ou perdus — pour voir votre taux de réussite ici. »",
            "Le même 10 est le seuil dans [[won-and-lost|Gagnées et perdues]], où le taux est ventilé par estimateur, par catégorie et par raison de la perte.",
          ] },
        ],
      },
      {
        id: "average-job-value",
        heading: "Valeur moyenne d'un chantier",
        blocks: [
          { p: "La **Valeur moyenne d'un chantier** est la valeur moyenne d'une occasion **gagnée** dans la période : le total accepté, ou le total soumissionné quand aucun total accepté n'a été consigné, divisé par le nombre de soumissions gagnées." },
          { bullets: [
            "Elle exige **5** soumissions gagnées. Moins : « Remportez 5 soumissions et la valeur moyenne de vos chantiers s'affichera ici. », ou le décompte « {n} sur 5 pour l'instant ».",
            "Une soumission gagnée sans total lisible est laissée de côté et comptée — la carte affiche le triangle d'avertissement plutôt que de faire silencieusement la moyenne sur un ensemble plus petit que ne le laisse croire l'effectif à côté.",
          ] },
        ],
      },
      {
        id: "lead-to-quote-conversion",
        heading: "Conversion prospect → soumission",
        blocks: [
          { p: "La **Conversion prospect → soumission** est la part des prospects créés dans la période qui sont devenus une soumission. Un prospect compte comme converti quand il porte un lien vers une soumission — le vrai lien — pas quand quelqu'un a déplacé sa carte dans une colonne." },
          { bullets: [
            "Elle exige **10** prospects dans la période. En dessous : « {n} sur 10 pour l'instant — {m} de plus et ce chiffre devient fiable. »",
            "Aucun prospect : « Aucun prospect cette période. Une fois que 10 prospects seront arrivés, ceci montrera la part convertie en soumissions. »",
          ] },
        ],
      },
      {
        id: "backlog",
        heading: "Carnet de commandes",
        blocks: [
          { p: "Le **Carnet de commandes** est le nombre de **semaines** de travail accepté encore devant vous, au rythme de cette période — des semaines, volontairement, pas des mois. L'indication sur la carte dit pourquoi : « Semaines de travail accepté qui vous attendent encore, au rythme de cette période — pas des mois. Une entreprise résidentielle avec 2 à 6 semaines réservées se porte bien. »" },
          { bullets: [
            "Le numérateur est la valeur de chaque chantier ouvert — pas encore terminé — dont la soumission est **acceptée**, prise sur le total accepté ou le total soumissionné. Un chantier ouvert sans soumission, ou avec une soumission jamais marquée acceptée, est compté et laissé de côté : sa valeur inventerait un accord que personne n'a donné.",
            "Le dénominateur est un rythme hebdomadaire : la valeur des chantiers **terminés dans cette période**, divisée par le nombre de semaines de la période.",
            "Rien d'ouvert et d'accepté est un vrai **0 semaine**, pas un chiffre manquant.",
            "Un carnet sans rien de terminé cette période n'a pas de rythme par lequel diviser : « Il y a des chantiers en réserve, mais aucun chantier avec une soumission chiffrée n'a été terminé cette période pour mesurer un rythme hebdomadaire. Terminez-en un et le chiffre apparaîtra. » Le montant en dollars apparaît quand même dans la section Coûts de l'entreprise sous **Engagé, pas encore facturé**.",
          ] },
          { tip: "Changez la période et le rythme change avec elle. Depuis le début de l'année donne le rythme le plus stable; Ce mois-ci donne le plus récent." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La section Ventes fait partie de la barrière unique de la page — voir [[the-kpi-dashboard|Le tableau de bord KPI]]. Avec les préréglages, Manager, les propriétaires et les administrateurs la voient; Crew, Estimator et Dispatcher se voient refuser toute la page. Un Estimator qui a besoin de ses propres chiffres retrouve le même taux de réussite dans Gagnées et perdues, qui n'exige que View only sur les soumissions et See prices." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon taux de réussite diffère-t-il du nombre d'Approuvées de la liste des soumissions ?", a: "Le taux compte les soumissions décidées de la période selon la date d'envoi et réduit les groupes de paliers à une seule occasion. La liste compte des documents. Les deux ont raison sur ce qu'ils comptent." },
      { q: "Une soumission en attente fait-elle baisser mon taux de réussite ?", a: "Non. Seules les soumissions acceptées et refusées sont au dénominateur; une soumission qui attend encore le client n'est ni l'un ni l'autre." },
      { q: "Pourquoi le Carnet de commandes dit-il 0 semaine alors que j'ai des chantiers planifiés ?", a: "Ces chantiers n'ont pas de soumission acceptée derrière eux — un chantier manuel, un rappel sous garantie — alors ils ne portent aucune valeur convenue. Seuls les chantiers ouverts avec une soumission acceptée sont dans le carnet." },
    ],
  },

  "kpi-money-flow": {
    title: "KPI : Flux de trésorerie",
    summary:
      "Revenu, Dépenses et Restant pour la période, avec un graphique jour par jour et une ventilation par catégorie — ce que lit chaque chiffre, comment la comparaison avec la période précédente est rendue équitable, et l'avertissement sur les matériaux.",
    updated: "2026-09-12",
    intro: [
      "**Flux de trésorerie — Ce qui est entré, ce qui est sorti, et ce qu'il reste pour cette période — jour par jour. Le revenu correspond aux paiements réellement reçus; les dépenses sont celles saisies ou importées, jamais une estimation de ce qui manque.** Trois tuiles, un graphique et une ventilation, et l'arithmétique la plus simple de la page : deux sommes et une soustraction.",
      "C'est une section du tableau de bord KPI plutôt qu'un second écran, et elle suit les mêmes boutons de période. Elle a sa propre barrière, alors un membre qui voit le reste de la page peut voir un refus dans cette seule section.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Revenu** est l'ensemble des paiements consignés dans la période — chaque paiement compté une fois, selon sa propre date, quelle que soit la version de la facture sur laquelle il a été pris. Ce n'est volontairement pas le total des factures, qu'une modification ferait compter en double. **Dépenses** est chaque dépense datée dans la période, qu'elle ait été tapée dans le Suivi des dépenses ou importée d'un relevé bancaire. **Restant** est l'un moins l'autre." },
          { p: "Une entreprise qui n'a jamais consigné de paiement, ou jamais saisi de dépense, voit **—** sur cette tuile et une phrase — « Aucune dépense n'a jamais été enregistrée pour cette entreprise. » avec un lien **Importer un relevé bancaire →** — jamais un 0,00 $ confiant. Une entreprise avec un historique et un mois tranquille obtient un vrai 0 $." },
        ],
      },
      {
        id: "the-three-tiles",
        heading: "Les trois tuiles",
        blocks: [
          { table: {
            head: ["Tuile", "Ce qu'elle additionne", "Quand elle affiche —"],
            rows: [
              ["**Revenu**", "Les lignes de paiement datées dans la période, selon la date où l'argent a été consigné.", "Aucun paiement n'a jamais été consigné pour l'entreprise."],
              ["**Dépenses**", "Les lignes de dépense datées dans la période — saisies à la main ou importées.", "Aucune dépense n'a jamais été enregistrée pour l'entreprise."],
              ["**Restant**", "Revenu moins dépenses.", "L'un des deux côtés est inconnu — un inconnu moins un vrai nombre reste un inconnu."],
            ],
          } },
          { figure: "harness:kpis", caption: "Tableau de bord KPI → Flux de trésorerie — Revenu, Dépenses et Restant avec leurs lignes de tendance, et le début du graphique quotidien." },
        ],
      },
      {
        id: "the-chart-and-categories",
        heading: "Le graphique et la ventilation",
        blocks: [
          { bullets: [
            "**Revenus et dépenses, par jour** trace une ligne pour chacun, chaque jour civil de la période. Les jours qui ne sont pas encore arrivés sont omis plutôt que tracés comme une ligne plate à 0 $ vers la droite — le 3, un trimestre fait trois jours de large.",
            "**Où est passé l'argent** liste les trois plus grosses catégories de dépense et replie le reste dans **Autre**; les lignes totalisent toujours le total des dépenses de la période. Une dépense sans catégorie devient **Non catégorisé** et concourt pour une place comme les autres, de sorte que rien n'est écarté sans être nommé.",
            "Les noms de catégorie sont les mots tapés sur la dépense, affichés tels quels — les mêmes noms qu'utilise le Suivi des dépenses, pour que les deux écrans ne se contredisent jamais sur le nom d'une catégorie.",
          ] },
        ],
      },
      {
        id: "the-comparison",
        heading: "La comparaison avec la période précédente",
        blocks: [
          { p: "Chaque tuile porte « En hausse de 26% par rapport à la période précédente », « En baisse de 12% par rapport à la période précédente », « Environ pareil qu'à la période précédente » ou « En hausse — rien la période précédente ». La période précédente est le même nombre de jours immédiatement avant celle-ci — un mois de 30 jours contre les 30 jours d'avant." },
          { bullets: [
            "Pour une période encore en cours, la comparaison est ramenée aux jours qui se sont **écoulés** contre le même nombre de jours avant le début de la période. Trois jours de septembre sont comparés à trois jours, pas à tout le mois d'août — sinon chaque tuile lirait « En baisse de 91 % » jusqu'au 28 de chaque mois.",
            "Les totaux en titre couvrent quand même toute la plage choisie : « qu'ai-je encaissé ce mois-ci » veut dire tout ce qui a été consigné dessus.",
            "« En hausse — rien la période précédente » est écrit à la place d'un pourcentage quand la période précédente était à 0 $ — une hausse de 100 % à partir de rien n'est pas un chiffre que quiconque peut lire.",
          ] },
        ],
      },
      {
        id: "materials-warning",
        heading: "L'avertissement sur les matériaux",
        blocks: [
          { p: "Le calcul du coût de revient ne lit que les dépenses; il ne lit jamais la liste d'achats de matériaux d'un chantier. Une entreprise qui coche ses achats sur la liste et ne les saisit jamais comme dépenses a des dépenses réelles que cette section ne peut pas voir." },
          { warning: "Quand au moins 200 $ ont été cochés sur la liste d'achats dans la période et que les dépenses de ces chantiers en représentent le dixième ou moins, une note ambre apparaît : « Ces chantiers montrent {amount} acheté sur la liste de matériaux cette période, mais seulement {expense} a été saisi comme dépense… » La tuile Dépenses est quand même affichée, avec le triangle d'avertissement et « Certains matériaux ont été achetés sur la liste et jamais saisis comme dépense ». Saisissez-les comme dépenses, ou importez le relevé bancaire, et la note disparaît." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Cette section exige les factures à **View only**, les dépenses à **View, record, and edit everyone's**, et l'interrupteur **See prices** — les dépenses de toute l'entreprise, pas « les miennes ». Avec les préréglages, Manager, les propriétaires et les administrateurs la voient; un Estimator ou un Dispatcher, dont les dépenses sont seulement les siennes, se verrait refuser cette section — mais la page lui est déjà refusée. Voir [[expense-tracking-and-burn-rate|Suivi des dépenses et rythme de dépenses]] pour l'écran des dépenses lui-même." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Revenu diffère-t-il de Revenus ce mois-ci sur l'Accueil ?", a: "Le chiffre de revenus de l'Accueil totalise les factures marquées payées; Revenu ici totalise les paiements selon leur propre date. Un acompte pris un mois sur une facture marquée payée le mois suivant tombe dans des mois différents sur les deux écrans." },
      { q: "Pourquoi Dépenses n'inclut-il pas les salaires de mon équipe ?", a: "Les salaires sont des heures pointées, pas des lignes de dépense. Ils apparaissent comme Paie de cette période sous Coûts de l'entreprise, tenus à part pour que le même argent ne soit pas compté deux fois." },
      { q: "Puis-je importer mon relevé bancaire d'ici ?", a: "Oui — le lien Importer un relevé bancaire → ouvre l'import CSV; voir Importer des dépenses depuis un CSV bancaire." },
    ],
  },

  "kpi-business-costs": {
    title: "KPI : Coûts de l'entreprise",
    summary:
      "Paie de cette période, Coûts fixes, Dépenses marketing et Engagé, pas encore facturé — quatre chiffres construits à partir de ce que FieldQuo sait déjà, chacun étiqueté avec ce qu'il inclut et volontairement jamais additionnés en un seul total.",
    updated: "2026-09-12",
    intro: [
      "**Coûts de l'entreprise — Paie, coûts fixes, dépenses marketing et travaux déjà engagés — construit à partir de ce que FieldQuo sait déjà, sans relevé bancaire requis.** Quatre cartes, dont chacune avait un écran qui la calculait — la Paie, Paramètres → Frais généraux, la page Dépenses marketing, la carte Carnet de commandes — et dont aucune n'avait de vue d'ensemble en argent avant cette section.",
      "Ce sont quatre formes différentes de « vrai », et la page ne les additionne jamais. Cet article dit ce que chacune lit, ce qu'elle laisse de côté, et pourquoi il n'y a pas de total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Trois des quatre suivent les boutons de période; une non. **Paie de cette période** et **Dépenses marketing** sont ce qui s'est passé entre le premier et le dernier jour de la période. **Coûts fixes** est un chiffre mensuel quelle que soit la période, parce que répartir le loyer sur « ce trimestre » inventerait une règle que personne n'a demandée. **Engagé, pas encore facturé** est un instantané d'aujourd'hui." },
          { figure: "live:app-analytics-kpis", caption: "Tableau de bord KPI → Coûts de l'entreprise — Paie de cette période, Coûts fixes, Dépenses marketing et Engagé, pas encore facturé, sur une entreprise sans temps ni frais généraux encore consignés." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "Les quatre cartes",
        blocks: [
          { table: {
            head: ["Carte", "Ce qu'elle lit", "Quand elle affiche —"],
            rows: [
              ["**Paie de cette période**", "Les heures pointées approuvées dans la période × le taux de paie de chaque travailleur, additionnées pour toute l'entreprise.", "Aucun temps approuvé n'a jamais été consigné pour l'entreprise."],
              ["**Coûts fixes**", "Le total mensuel de Paramètres → Frais généraux — loyer et coûts fixes, salaires généraux, prêts et actifs — inchangé et par mois.", "Aucun loyer, salaire général, prêt ni actif n'a encore été consigné."],
              ["**Dépenses marketing**", "Les lignes de dépenses marketing datées dans la période, tous canaux confondus, dans la devise de l'entreprise.", "Aucune dépense marketing n'a jamais été saisie pour l'entreprise."],
              ["**Engagé, pas encore facturé**", "La valeur de chaque chantier ouvert avec une soumission acceptée — le même chiffre que la carte Carnet de commandes divise en semaines.", "Jamais — rien d'ouvert et d'accepté est un vrai 0,00 $ avec « 0 chantiers acceptés et ouverts. »"],
            ],
          } },
        ],
      },
      {
        id: "payroll",
        heading: "Paie de cette période",
        blocks: [
          { bullets: [
            "Seules les heures **approuvées** sont payées, alors seules les heures approuvées sont comptées. Les heures encore en attente sont comptées à part et dites tout haut : « 12h encore en attente d'approbation, non comptées pour l'instant. » Voir [[timesheets-and-approving-hours|Feuilles de temps : réviser et approuver les heures]].",
            "Le taux est celui qu'utilise la paie — le taux horaire du travailleur quand il est défini, sinon le coût de main-d'œuvre sur sa fiche de membre. Les salaires généraux saisis dans Paramètres → Frais généraux sont un coût de l'entreprise, pas la paie d'une personne, et ne sont jamais lus ici.",
            "Les heures sans taux de paie au dossier ne sont pas absorbées comme de la main-d'œuvre gratuite. La carte affiche le triangle d'avertissement et « {n} heures saisies par {m} personnes n'ont aucun taux de paie enregistré et ne sont pas comptées ici. »",
          ] },
        ],
      },
      {
        id: "fixed-costs",
        heading: "Coûts fixes",
        blocks: [
          { bullets: [
            "Le chiffre est le total mensuel du rythme de dépenses, réutilisé tel quel depuis [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]] — l'indication dit « Par mois, peu importe la période ci-dessus — loyer, salaires généraux et dettes. »",
            "**Voir le détail →** ouvre Paramètres → Frais généraux, où chaque ligne en est saisie.",
            "Il affiche — tant qu'au moins un registre — coûts fixes, salaires, dette, actifs — n'a pas une ligne. Quatre tableaux vides ne sont pas un loyer à 0,00 $.",
          ] },
        ],
      },
      {
        id: "marketing-spend",
        heading: "Dépenses marketing",
        blocks: [
          { bullets: [
            "Une ligne dans une autre devise est convertie au taux de change épinglé et le chiffre est précédé de **≈**, avec une ligne en dessous nommant le montant d'origine et l'âge du taux — « Comprend 840,46 $ US convertis au taux de change épinglé (vieux de 15 jours). » Une ligne dont le taux a été refusé est laissée de côté, et la carte le dit avec le montant.",
            "« Peut chevaucher une dépense déjà saisie dans le suivi des dépenses — non combiné avec les dépenses ci-dessus. » — une facture Facebook saisie sur les deux écrans serait comptée sur les deux, et rien ne relie les deux tables pour l'attraper.",
            "**Voir les campagnes →** ouvre la page Dépenses marketing à sa liste de campagnes.",
          ] },
        ],
      },
      {
        id: "committed-not-yet-invoiced",
        heading: "Engagé, pas encore facturé",
        blocks: [
          { p: "Le montant en dollars derrière [[kpi-sales|la carte Carnet de commandes]] : chaque chantier pas encore terminé dont la soumission est acceptée, évalué au total accepté, avec « 3 chantiers acceptés et ouverts. » en dessous. Il est récupéré une fois pour la section Ventes et relu ici, de sorte que les deux cartes ne peuvent jamais montrer des montants différents." },
        ],
      },
      {
        id: "why-not-one-total",
        heading: "Pourquoi il n'y a pas de total",
        blocks: [
          { note: "La paie et les dépenses marketing sont des dépenses réelles qui ont pu aussi être tapées à la main comme dépense — un virement de paie saisi comme ligne de salaire ici et comme dépense manuelle, une facture de publicité sur les deux écrans. Rien dans FieldQuo ne relie ces tables, alors un « total des sorties d'argent » combiné aurait l'air précis et serait parfois faux. Chaque chiffre est montré seul, étiqueté avec ce qu'il inclut et n'inclut pas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Cette section est l'union des barrières de ses trois sources : l'interrupteur **Job costing** et See prices (coûts fixes), Job costing plus **View everyone's payslips** sur la paie (paie), et la permission de gestion du personnel (dépenses marketing). Avec les préréglages, ce sont les propriétaires et les administrateurs seulement — un Manager ne détient que ses propres bulletins de paie et se voit refuser cette section tout en voyant le reste de la page. Un accès Personnalisé avec les trois passe." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Coûts fixes ne change-t-il pas quand je choisis L'an dernier ?", a: "C'est une projection mensuelle tirée de Paramètres → Frais généraux, pas une somme de ce qui s'est passé dans la période. L'indication sur la carte le dit." },
      { q: "Paie de cette période est-il ce que j'ai réellement versé ?", a: "Ce sont les heures approuvées multipliées par les taux de paie pour la période — ce que l'équipe a gagné. Ce qui a été versé se trouve dans la Paie, par cycle de paie." },
    ],
  },

  "kpi-profit": {
    title: "KPI : Marge",
    summary:
      "Marge brute et nette sur un chantier terminé type, coût de main-d'œuvre en part du chiffre d'affaires, et chiffre d'affaires par employé — comment chacun se calcule à partir des heures approuvées et des dépenses saisies, et les quatre raisons pour lesquelles une marge refuse de s'imprimer.",
    updated: "2026-09-12",
    intro: [
      "**Marge — Cumulée sur tous les chantiers terminés pendant la période, à partir des heures approuvées et des dépenses enregistrées uniquement.** Quatre cartes : **Marge brute (chantier type)**, **Marge nette (chantier type)**, **Coût de main-d'œuvre, % du chiffre d'affaires** et **Chiffre d'affaires par employé**.",
      "Les marges sont les chiffres les plus fragiles de la page, parce qu'elles reposent sur ce que l'équipe a pointé et sur ce qui a été saisi en dépense — une équipe qui pointe mal affiche une meilleure marge. La section signale donc un chiffre incomplet de façon connue et refuse d'en imprimer un qu'elle ne peut pas défendre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La population est chaque chantier **terminé** dans la période. Le chiffre d'affaires d'un chantier est le total des factures émises pour lui — la dernière version de chacune, brouillons exclus — et son coût direct est les dépenses saisies sur lui plus les heures approuvées × le taux de paie, la même arithmétique que [[job-costing|Coût de revient : soumissionné contre réel]] sur la page du chantier." },
          { figure: "live:app-analytics-kpis", caption: "Tableau de bord KPI → Marge — Marge brute, Marge nette, Coût de main-d'œuvre et Chiffre d'affaires par employé, avec la raison sous chaque carte sans valeur." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "Les quatre cartes",
        blocks: [
          { table: {
            head: ["Carte", "Ce que c'est", "Seuil"],
            rows: [
              ["**Marge brute (chantier type)**", "La **médiane** de (chiffre d'affaires − coût direct) ÷ chiffre d'affaires sur les chantiers terminés — un chantier type, pas une moyenne pondérée par l'argent qu'un seul énorme chantier pourrait dominer.", "5 chantiers terminés et chiffrés"],
              ["**Marge nette (chantier type)**", "La même médiane avec les frais généraux par chantier de l'entreprise ajoutés au coût de chaque chantier.", "5 chantiers, et une capacité hebdomadaire de chantiers définie"],
              ["**Coût de main-d'œuvre, % du chiffre d'affaires**", "Tout le coût de main-d'œuvre ÷ tout le chiffre d'affaires de ces chantiers — un seul ratio pour l'entreprise, parce qu'une masse salariale est une ligne que le propriétaire lit comme un seul nombre.", "5 chantiers"],
              ["**Chiffre d'affaires par employé**", "Les factures marquées payées dans la période ÷ le nombre de membres actifs de l'équipe aujourd'hui.", "Au moins un membre actif de l'équipe"],
            ],
          } },
        ],
      },
      {
        id: "how-margin-is-worked-out",
        heading: "Comment la marge est calculée",
        blocks: [
          { bullets: [
            "Le **coût direct** est les matériaux et autres dépenses de chantier saisis sur le chantier, plus la main-d'œuvre : les heures approuvées sur le chantier × le taux de paie de chaque travailleur. Pas de frais généraux — c'est ce qui la rend brute.",
            "Les **frais généraux par chantier** viennent de Paramètres → Frais généraux : le rythme de dépenses mensuel divisé par le nombre de chantiers que vous avez dit pouvoir prendre par semaine. Il est nul, pas zéro, tant que **Chantiers par semaine** n'est pas défini, et la marge nette hérite exactement de ce refus plutôt que de retomber silencieusement sur le chiffre brut.",
            "Un chantier terminé sans facture, ou avec un total de facture à zéro, est exclu et compté — jamais évalué à 0 $.",
            "Le chiffre d'affaires par employé utilise la même mesure de trésorerie que **Revenus ce mois-ci** sur l'Accueil, pour que les deux ne se contredisent jamais en silence; l'effectif est celui d'aujourd'hui, parce qu'un nombre de travailleurs n'a pas d'historique à lire.",
            "Un chantier dont les heures n'ont pas de taux de paie, ou dont les heures attendent encore l'approbation, est marqué incomplet; la carte affiche le triangle d'avertissement et « données incomplètes » plutôt que de faire la moyenne par-dessus le trou.",
          ] },
        ],
      },
      {
        id: "when-it-refuses",
        heading: "Quand une marge refuse de s'imprimer",
        blocks: [
          { bullets: [
            "« Aucun chantier n'a été terminé pendant cette période. » — la population est vide.",
            "« Aucun chantier terminé pendant cette période n'avait à la fois un chiffre d'affaires et un coût à comparer. » — des chantiers ont été finis, mais aucun n'a été facturé.",
            "« {n} sur 5 pour l'instant — {m} de plus et ce chiffre devient fiable. » — sous le seuil. À cinq chantiers, la probabilité qu'ils tombent tous du même côté d'un tirage à pile ou face est déjà sous un sur dix; moins, c'est du bruit.",
            "« Indiquez combien de chantiers par semaine vous pouvez prendre dans Paramètres → Frais généraux, et la marge nette pourra être calculée. » — marge nette seulement, avec un lien **Définissez votre capacité hebdomadaire de chantiers →**; le champ est **Chantiers par semaine** dans Paramètres → Frais généraux.",
          ] },
          { warning: "Le piège des matériaux : quand les chantiers montrent au moins 200 $ cochés sur la liste d'achats de matériaux mais le dixième ou moins saisi en dépenses, les deux marges sont masquées avec une note ambre — « Le calcul des coûts ne lit que les dépenses, donc la marge ci-dessous serait fictive — elle est masquée tant que les achats de matériaux ne sont pas aussi saisis comme dépenses. » Le % de coût de main-d'œuvre s'imprime quand même, parce qu'il ne dépend pas des matériaux." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Fait partie de la barrière unique de la page, et c'est la raison pour laquelle la barrière inclut l'interrupteur **Job costing** — voir [[the-kpi-dashboard|Le tableau de bord KPI]]. Manager, les propriétaires et les administrateurs la voient; Crew, Estimator et Dispatcher se voient refuser la page. Les frais généraux par chantier sont lus dans Paramètres → Frais généraux, qu'un propriétaire, un administrateur ou un Manager peut modifier." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la marge nette est-elle vide alors que la marge brute a une valeur ?", a: "La nette a besoin des frais généraux par chantier, et ceux-ci ont besoin de Chantiers par semaine dans Paramètres → Frais généraux. Tant que ce n'est pas défini, la page refuse de le deviner." },
      { q: "Pourquoi la médiane et pas la moyenne ?", a: "Un chantier de 60 000 $ parmi dix de 4 000 $ dicterait la moyenne. La médiane est le chantier du milieu — ce que rapporte un chantier type chez vous." },
      { q: "Mon équipe oublie de pointer. Cela fausse-t-il la marge ?", a: "Cela la rend optimiste — des heures manquantes sont un coût manquant. Approuvez les heures depuis les Feuilles de temps; la carte signale comme incomplets les chantiers avec des heures sans taux ou en attente." },
    ],
  },

  "kpi-execution": {
    title: "KPI : Exécution",
    summary:
      "Achèvement à temps, utilisation de la main-d'œuvre et précision des estimations — ce que chacun mesure, ce qu'il ne mesure volontairement pas, et la bande des chantiers récents tracée de la fenêtre planifiée à l'achèvement.",
    updated: "2026-09-12",
    intro: [
      "**Exécution — À quel point l'estimation correspondait à la réalité, et comment le calendrier a tenu.** Trois cartes — **Achèvement à temps**, **Utilisation de la main-d'œuvre**, **Précision des estimations (écart médian)** — et en dessous une bande, **Chantiers récents : fenêtre planifiée vs achèvement**, une ligne par chantier.",
      "Chaque carte dit sur sa face ce qu'elle ne mesure pas. L'achèvement à temps n'est pas un délai d'exécution; l'utilisation n'est pas une note de productivité; la précision des estimations est une médiane, pas un total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les trois lisent les chantiers terminés dans la période, et deux d'entre elles lisent les heures approuvées de l'équipe. La carte d'utilisation lit les heures garanties sur la fiche de chaque travailleur; sans cela, elle n'a rien à quoi comparer les heures et le dit." },
          { figure: "live:app-analytics-kpis", caption: "Tableau de bord KPI → Exécution — Achèvement à temps, Utilisation de la main-d'œuvre et Précision des estimations, chacune expliquant ce qu'il lui faut avant de pouvoir s'imprimer." },
        ],
      },
      {
        id: "on-time-completion",
        heading: "Achèvement à temps",
        blocks: [
          { p: "L'**Achèvement à temps** est la part des chantiers terminés qui ont fini à la date de leur **dernière visite planifiée** ou avant. L'indication dit le reste : « Terminé à la date de la dernière visite planifiée, ou avant. Pas un délai d'exécution — les chantiers n'ont pas de date de début à comparer. »" },
          { bullets: [
            "La date planifiée est la date actuelle de la visite. Une visite replanifiée est écrasée sur place, alors la date comparée est celle réellement convenue avec le client — un chantier n'est pas noté en retard pour avoir fini exactement quand on lui avait dit.",
            "Un chantier terminé sans aucune visite n'a pas d'horaire à quoi se mesurer; il est compté et exclu : « Aucun chantier terminé pendant cette période n'avait de visite planifiée à quoi se mesurer. »",
            "Il exige **10** chantiers mesurables avant qu'un pourcentage s'imprime.",
          ] },
        ],
      },
      {
        id: "labour-utilisation",
        heading: "Utilisation de la main-d'œuvre",
        blocks: [
          { p: "L'**Utilisation de la main-d'œuvre** est les heures qui ont atteint un chantier, sur les heures que l'entreprise a garanties : les heures de chantier approuvées dans la période ÷ (les heures garanties par semaine de chaque travailleur de terrain × le nombre de semaines de la période). L'indication : « Heures ayant atteint un chantier, comparées aux heures promises par une semaine garantie. Le personnel de bureau n'est pas compté — son temps est un frais général par conception. »" },
          { bullets: [
            "Seuls les travailleurs avec une semaine garantie sur leur fiche sont au dénominateur. Sans aucun : « Aucun travailleur de terrain actif n'a de semaine garantie définie, alors il n'y a rien à quoi comparer les heures. »",
            "Les employés de bureau sont exclus d'emblée — demander quelle part du mardi d'un comptable appartient à un chantier est la mauvaise question.",
            "Les heures d'un travailleur sans taux de paie sont comptées comme des heures mais pas comme de l'argent; la carte est marquée incomplète et dit combien de travailleurs elle n'a pas pu chiffrer.",
            "Les heures non absorbées derrière ce taux — payées, jamais sur un chantier — sont montrées en argent dans [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]]. Elles y sont rapportées et volontairement pas encore ajoutées à votre prix minimum.",
          ] },
        ],
      },
      {
        id: "estimate-accuracy",
        heading: "Précision des estimations (écart médian)",
        blocks: [
          { p: "La **Précision des estimations (écart médian)** est un petit graphique à barres : pour **Labour hours**, **Labour cost** et **Materials and other job costs**, la médiane de l'écart entre le réel et l'estimation, en pourcentage — positif veut dire dépassement. Un lien **Rapport complet →** ouvre le rapport [[estimate-accuracy|Justesse des estimations]] au complet." },
          { bullets: [
            "Elle est tirée des chantiers terminés qui ont à la fois une soumission chiffrée et des coûts réels. Sous **5** chantiers de ce genre : « Pas assez de chantiers terminés et chiffrés cette période pour en tirer un taux. »",
            "Une dimension n'est tracée que si elle est rapportable sur son propre échantillon; une dimension avec trop peu de chantiers est omise plutôt que tracée sur presque rien.",
            "Les barres positives sont colorées comme des dépassements, pour qu'un coup d'œil dise de quel côté vous vous trompez.",
          ] },
        ],
      },
      {
        id: "the-schedule-strip",
        heading: "La bande du calendrier",
        blocks: [
          { p: "**Chantiers récents : fenêtre planifiée vs achèvement** apparaît quand au moins un chantier terminé avait une visite : jusqu'à vingt lignes, du plus récent au plus ancien, chacune tracée de la première visite planifiée à la dernière, avec la date d'achèvement marquée et la ligne colorée **Terminé à temps** ou **Terminé en retard**. Ce sont les mêmes données qui ont servi au taux ci-dessus, montrées un chantier à la fois." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Fait partie de la barrière unique de la page — voir [[the-kpi-dashboard|Le tableau de bord KPI]] : Manager, les propriétaires et les administrateurs. Les heures garanties et le taux de paie que lit l'utilisation sont définis par personne dans les écrans d'équipe; les dates de visite viennent des visites du chantier." },
        ],
      },
    ],
    faq: [
      { q: "Un chantier a fini un jour après sa visite parce que le client l'a demandé. Est-il en retard ?", a: "Si la visite a été replanifiée à la nouvelle date, non — c'est la date actuelle de la visite qui est comparée. Si la date de visite a été laissée telle quelle, oui." },
      { q: "Pourquoi l'utilisation dit-elle qu'il n'y a rien à comparer ?", a: "Aucun travailleur de terrain actif n'a d'heures garanties par semaine sur sa fiche. Définissez-les sur la personne et la carte se remplit pour les périodes qui suivent." },
      { q: "L'utilisation change-t-elle mon prix minimum ?", a: "Pas encore. Les heures non absorbées sont rapportées sur l'écran des frais généraux et volontairement pas intégrées au rythme de dépenses tant que le chiffre n'aura pas été jugé fiable pendant un moment." },
    ],
  },

  "kpi-quality": {
    title: "KPI : Qualité",
    summary:
      "Le taux de reprises / rappels et le taux d'avenants — ce qui compte, ce qui ne compte volontairement pas, et comment consigner une visite de retour ou un changement de portée pour que les cartes puissent le voir.",
    updated: "2026-09-12",
    intro: [
      "**Qualité — Travaux qu'il a fallu revoir, et portée qui a changé après l'accord du client.** Deux cartes : **Taux de reprises / rappels** et **Taux d'avenants**. Les deux se trouvaient autrefois sous Non suivi; les deux en sont sorties quand la page du chantier a gagné un moyen de consigner le fait honnêtement au lieu de le déduire.",
      "Aucun des deux n'est déduit. Une visite de retour ne compte que si quelqu'un a dit pourquoi il y retournait; un avenant ne compte que si quelqu'un en a consigné un. Une modification ordinaire d'une soumission ou d'une facture n'est jamais lue comme l'un ou l'autre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les deux taux sont des parts des chantiers **terminés** dans la période, et les deux exigent **10** chantiers terminés avant qu'un pourcentage s'imprime. En dessous, la carte compte — « 4 sur 10 pour l'instant — 6 de plus et ce chiffre devient fiable. » — et sans aucun : « Aucun chantier n'a été terminé pendant cette période. »" },
          { p: "Un rappel peut prendre deux formes sur la page du chantier : une visite de retour ajoutée au même chantier, ou un nouveau chantier créé comme rappel de l'original. Les deux demandent **Pourquoi y retournez-vous ?**, et les deux alimentent le taux contre le chantier d'origine." },
        ],
      },
      {
        id: "rework-callback-rate",
        heading: "Taux de reprises / rappels",
        blocks: [
          { p: "La part des chantiers terminés où l'entreprise a dû retourner pour une **reprise** ou un retour sous **garantie**. L'indication sur la carte : « Chantiers terminés pour lesquels l'entreprise a dû revenir refaire quelque chose ou pour un retour sous garantie. Un client qui pensait qu'il manquait quelque chose et se trompait ne compte pas ici — voir la page du chantier pour savoir comment distinguer les deux. »" },
          { bullets: [
            "**Reprise — on a manqué quelque chose** et **Garantie — travaux couverts** comptent contre le chantier.",
            "**Pas de notre faute — le client pensait qu'il manquait quelque chose** est consigné mais pas compté. Si tout est classé comme reprise, le taux est faux et vous cessez de lui faire confiance — le troisième choix existe donc pour garder les deux premiers honnêtes.",
            "Un chantier qui est lui-même un rappel n'est pas au dénominateur : un retour sous garantie n'est pas un nouveau travail qu'on mesure pour savoir s'il a, à son tour, exigé un retour.",
            "Un chantier avec plusieurs visites de retour est un seul chantier au numérateur, pas plusieurs.",
          ] },
        ],
      },
      {
        id: "how-to-record-a-callback",
        heading: "Comment consigner un rappel",
        blocks: [
          { steps: [
            "Pour une petite retouche, ouvrez le chantier terminé et ajoutez une visite de retour; à la question **Pourquoi y retournez-vous ?**, choisissez Reprise, Garantie ou Pas de notre faute. Le choix est obligatoire.",
            "Pour un retour plus important, créez un nouveau chantier comme rappel de l'original. Le bandeau dit ce que cela fait : « Ce chantier est un rappel pour {title} — il apparaîtra sur la page de ce chantier et comptera dans le taux de reprises/rappels du tableau de bord des indicateurs. »",
            "Terminez le chantier d'origine comme d'habitude. Le taux compte l'original dans la période où il a été terminé, quelle que soit la période du retour.",
          ] },
        ],
      },
      {
        id: "change-order-rate",
        heading: "Taux d'avenants",
        blocks: [
          { p: "La part des chantiers terminés avec au moins un **avenant** consigné — un changement de portée convenu après que le client a accepté la soumission. L'indication : « Chantiers terminés avec au moins un changement de portée enregistré après l'acceptation de la soumission — jamais déduit d'une modification ordinaire de la soumission ou de la facture. »" },
          { bullets: [
            "Chaque chantier terminé est ici au dénominateur, rappels compris — qu'un chantier soit un retour n'a rien à voir avec le fait que sa propre portée ait changé.",
            "Un avenant consigné après la fin du chantier compte quand même; le journal est lu sans date limite, parce qu'un changement convenu la dernière semaine est souvent rédigé après la clôture du chantier.",
            "L'argent derrière — les écarts de prix des avenants approuvés — est le même chiffre que la page du chantier et la facture utilisent, additionné une fois à un seul endroit. Seuls les avenants approuvés sont de l'argent; un avenant refusé compte quand même le chantier comme ayant eu un changement de portée.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Fait partie de la barrière unique de la page — voir [[the-kpi-dashboard|Le tableau de bord KPI]] : Manager, les propriétaires et les administrateurs. Consigner la raison d'une visite de retour ou créer un chantier de rappel exige **View, create, and edit** sur les chantiers — Dispatcher et plus." },
        ],
      },
    ],
    faq: [
      { q: "Nous y sommes retournés parce que le client a changé d'idée. Une reprise ?", a: "Non — c'est un changement de portée, pas un oubli. Consignez-le comme avenant sur le chantier; il compte dans le taux d'avenants, pas dans le taux de rappels." },
      { q: "Pourquoi le taux est-il vide alors que nous avons eu deux rappels le mois dernier ?", a: "La carte exige 10 chantiers terminés dans la période avant d'imprimer un pourcentage. Élargissez la période à Ce trimestre ou Depuis le début de l'année." },
    ],
  },

  "kpi-cash": {
    title: "KPI : Trésorerie",
    summary:
      "Créances clients par ancienneté et montants reçus sur les six derniers mois — ce que compte le chiffre en souffrance, comment une facture est classée par ancienneté, et pourquoi une facture sans échéance n'est jamais en retard.",
    updated: "2026-09-12",
    intro: [
      "**Trésorerie — Ce qui vous est dû, et ce qui est réellement rentré.** Deux cartes : **Créances clients, par ancienneté**, avec l'échelle d'ancienneté en dessous, et **Montants reçus, 6 derniers mois**, une courbe des paiements par mois. Les deux sont les chiffres du tableau de bord lui-même — le même constructeur, les mêmes lignes — alors cette section et l'Accueil ne peuvent jamais se contredire sur ce qui est dû.",
      "Les créances n'ont pas de période : ce qui vous est dû est dû aujourd'hui, quel que soit l'âge de la facture, alors c'est la seule section que les boutons de période ne touchent pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le chiffre en souffrance est construit à partir de chaque facture que l'entreprise a jamais émise — chaque version — brouillons exclus. Chaque famille de factures est évaluée à sa **dernière** version, moins chaque paiement consigné sur n'importe quelle version, de sorte qu'une facture modifiée n'est jamais comptée au montant de sa première émission et qu'un acompte pris sur la version un compte toujours contre la version deux." },
          { figure: "harness:kpis-cash", caption: "Tableau de bord KPI → Trésorerie — Créances clients par ancienneté avec l'échelle et le lien Rapport complet, et la courbe des Montants reçus sur six mois." },
        ],
      },
      {
        id: "accounts-receivable-by-age",
        heading: "Créances clients, par ancienneté",
        blocks: [
          { p: "Le gros chiffre est le total en souffrance, puis « {overdue} de ce montant est en retard ({count}) » ou « Rien en attente actuellement. » En dessous, l'échelle — les mêmes cinq échelons que l'Accueil — avec les échelons en retard en rouge, et un lien **Rapport complet →** vers [[financial-statements|États financiers]]." },
          { table: {
            head: ["Échelon", "Ce qui y tombe"],
            rows: [
              ["**Pas encore dû**", "En souffrance, et la date d'échéance n'est pas passée."],
              ["**1 à 30 jours**", "Entre un et trente jours civils après l'échéance."],
              ["**31 à 60 jours**", "Trente et un à soixante jours après l'échéance."],
              ["**61 à 90 jours**", "Soixante et un à quatre-vingt-dix jours après l'échéance."],
              ["**90 jours et plus**", "Quatre-vingt-onze jours ou plus après l'échéance."],
            ],
          } },
        ],
      },
      {
        id: "what-the-figure-counts",
        heading: "Ce que le chiffre compte, et ce qu'il nomme",
        blocks: [
          { bullets: [
            "L'ancienneté se compte à partir de la **date d'échéance**, en jours civils entiers. Une facture sans date d'échéance est en souffrance mais jamais en retard et jamais sur l'échelle — c'est une affirmation différente, et l'Accueil la liste sous **Aucune date d'échéance**.",
            "Une facture sans aucune date — jamais envoyée, sans date de création — ne peut pas être placée dans le temps. Elle est comptée et nommée plutôt qu'écartée en silence, et la carte affiche le triangle d'avertissement quand cela arrive.",
            "Un paiement consigné avec une date illisible est de même compté comme non placé et signale le chiffre.",
            "Une facture payée en trop est un crédit que vous détenez, pas de l'argent qui vous est dû; elle est tenue hors du chiffre. L'Accueil le dit avec le montant.",
            "Trois états, jamais un seul 0,00 $ : un vrai solde, « Rien en attente actuellement. » quand tout est réglé, et « Aucune facture n'a jamais été émise. » quand il n'y a rien qui puisse être dû.",
          ] },
        ],
      },
      {
        id: "money-received-last-6-months",
        heading: "Montants reçus, 6 derniers mois",
        blocks: [
          { p: "Une courbe des paiements selon le mois où ils ont été consignés, sur les six derniers mois, avec la valeur du dernier mois étiquetée. C'est la même série que le graphique **Argent reçu** de l'Accueil à son réglage 6 mois, construite à partir des mêmes lignes de paiement." },
          { bullets: [
            "Le mois en cours est tracé comme partiel — il n'est pas fini, et le comparer à un mois complet fabriquerait un effondrement le 2 de chaque mois.",
            "Une entreprise qui n'a jamais consigné de paiement voit « Aucun paiement enregistré pour l'instant. » plutôt qu'une ligne plate le long de l'axe.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Fait partie de la barrière unique de la page — voir [[the-kpi-dashboard|Le tableau de bord KPI]] : Manager, les propriétaires et les administrateurs. Les mêmes chiffres, avec le nom du client et un bouton **Relancer le paiement** sur chaque facture, sont sur l'Accueil pour quiconque a les factures à View only et See prices — voir [[money-owed-and-receivables-aging|Argent dû et âge des comptes clients]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi une vieille facture sans date d'échéance n'apparaît-elle pas en retard ?", a: "Le retard se mesure à partir de la date d'échéance, et cette facture n'en a pas. Ajoutez-lui une date d'échéance et elle vieillira à partir de là." },
      { q: "Pourquoi le chiffre des créances est-il le même quelle que soit la période choisie ?", a: "Ce qui vous est dû n'a pas de période — une facture de 2019 que personne n'a payée est due aujourd'hui. Les boutons de période gouvernent les autres sections." },
      { q: "Pourquoi le total ne correspond-il pas à la somme de l'échelle ?", a: "L'échelle ne contient que les factures avec une date d'échéance. Les factures sans date sont dans le total et nommées à part; les factures payées en trop ne sont ni dans l'un ni dans l'autre." },
    ],
  },
};
