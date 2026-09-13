// content/help/fr/invoices-and-payments-3.js
//
// Partie 3 de la catégorie « invoices-and-payments » en français (voir le
// composeur, invoices-and-payments.js) : conditions de paiement, taxes sur
// les factures, paiement échelonné, forfaits de service et leur mandat de
// prélèvement bancaire, le portail client, l'export comptable, les frais de
// visite et le panneau « Argent dû ».
//
// Même structure que la version anglaise, section pour section ; les mots
// à l'écran viennent du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "payment-terms": {
    title: "Conditions de paiement",
    summary:
      "La ligne qui dit quand le client paie — où vous la définissez, où elle s'imprime, et comment l'échéancier de paiement prend le relais.",
    updated: "2026-09-12",
    intro: [
      "Les conditions de paiement sont une ligne de texte dans le Profil de l'entreprise — « 50 % de dépôt, solde à la fin », « Net 30 », « Payable à réception ». FieldQuo imprime cette ligne sur chaque soumission que vous envoyez et l'affiche sur les pages de soumission et de facture que votre équipe consulte. Rien n'en invente une à votre place : laissez le champ vide et la section n'apparaît tout simplement pas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les conditions s'impriment sur le PDF de la soumission, dans le courriel de soumission et sur la page d'approbation que le client ouvre — après le total et les étapes du processus, donc au moment précis où le client se décide. Par défaut, elles ne s'impriment pas sur le PDF ni dans le courriel de la facture : une facture est une demande du montant dû à la date d'échéance, et l'échéancier est déjà derrière. Si vous les voulez aussi sur les factures, ajoutez la section **Payment terms** à votre mise en page de facture dans **Paramètres → Modèles PDF** — voir [[settings-pdf-templates|Modèles PDF]]. Votre équipe les voit toujours sur la page de la facture, sous **Modalités de paiement**, pour que la personne à qui on pose la question sur le pas de la porte puisse répondre." },
          { p: "Sous les conditions, le document énumère les modes de paiement que votre entreprise accepte (comptant, virement Interac et chèque par défaut). Aucun écran ne permet de modifier cette liste aujourd'hui." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Ouvrez **Paramètres → Profil de l'entreprise**. La première carte est **Description des travaux et conditions** : une zone **Description des travaux par défaut** avec des modèles de métier pour partir de quelque chose, puis dessous le champ **Conditions de paiement** avec l'exemple « p. ex. 50 % de dépôt, solde à la fin — ou Net 30 ». La ligne d'aide sous le champ dit ce qu'il advient de ce que vous tapez : un échéancier lisible s'imprime en cartes, tout le reste s'imprime tel quel, et vide veut dire aucune section." },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — la carte Description des travaux et conditions, avec le champ Conditions de paiement, puis la carte Échéancier de paiement dessous." },
        ],
      },
      {
        id: "set-them",
        heading: "Comment définir vos conditions de paiement",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise**.",
            "Dans **Description des travaux et conditions**, tapez vos conditions dans **Conditions de paiement** — une phrase, ou une suite de pourcentages.",
            "Appuyez sur **Mettre à jour les réglages**. La prochaine soumission que vous créez porte les nouvelles conditions ; les soumissions déjà envoyées gardent celles avec lesquelles elles sont parties.",
          ] },
          { tip: "Écrivez des pourcentages si vous voulez des cartes. « 50 % dépôt, 50 % à la fin » s'imprime en deux gros blocs que le client lit en une seconde ; « Paiement par virement Interac dans les 14 jours suivant la facture » s'imprime comme cette phrase, mot pour mot." },
        ],
      },
      {
        id: "cards-or-sentence",
        heading: "Des cartes ou une phrase : comment le texte est lu",
        blocks: [
          { p: "FieldQuo tente de lire un échéancier par jalons dans vos conditions et n'affiche des cartes que lorsqu'il en est sûr. La règle est volontairement prudente — des cartes mal découpées seraient pires que la phrase claire qu'elles remplacent." },
          { table: {
            head: ["Ce que vous avez tapé", "Ce que le client voit"],
            rows: [
              ["50 % dépôt, 50 % à la fin", "Deux cartes : 50 % Dépôt · 50 % À la fin — le mot qui suit le pourcentage devient l'étiquette, alors n'écrivez pas « de dépôt »"],
              ["30 % dépôt, 40 % début du chantier, 30 % à la fin", "Trois cartes : Dépôt · Début du chantier · À la fin"],
              ["50 %, 40 %, 10 %", "Des cartes avec des étiquettes de remplacement — Deposit · Progress payment · On completion — toujours en anglais, quelle que soit la langue du document"],
              ["Net 30", "La phrase, imprimée telle quelle"],
              ["10 % de rabais pour paiement comptant", "La phrase — un seul pourcentage n'est pas un échéancier, et les parts doivent totaliser environ 100 %"],
            ],
          } },
        ],
      },
      {
        id: "payment-schedule",
        heading: "Quand un échéancier de paiement est activé",
        blocks: [
          { p: "La carte **Échéancier de paiement** sous les conditions est la version à règles : de vraies factures produites à partir des dates du chantier lui-même — un acompte à la création de la facture, le reste au début du chantier, à mi-parcours ou à l'achèvement. Dès qu'elle contient des étapes, le champ **Conditions de paiement** se verrouille et se réécrit depuis l'échéancier (« 30% Deposit, 40% Job start, 30% On completion » — les noms d'étape par défaut sont en anglais, à moins que vous ne nommiez les vôtres), pour que le document lu par le client dise toujours ce qui sera réellement facturé. Appuyez sur **Désactiver — revenir au texte libre** pour retaper la phrase à la main. Voir [[deposits-and-payment-schedules|Acomptes et échéanciers de paiement]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Le Profil de l'entreprise s'adresse aux personnes qui peuvent diriger l'entreprise : le propriétaire, les administrateurs et toute personne au niveau Gestionnaire ou Répartiteur. Les estimateurs et l'équipe de terrain ne voient pas la ligne Profil de l'entreprise dans le menu ; les conditions s'impriment quand même sur les soumissions qu'ils rédigent. Une session de soutien en lecture seule voit la carte mais ne peut pas l'enregistrer." },
        ],
      },
    ],
    faq: [
      { q: "Les conditions changent-elles sur les soumissions déjà envoyées ?", a: "Non. Une soumission est lue à partir des conditions en vigueur à sa création, et un PDF signé continue de dire ce qu'il disait. Changez les conditions et la prochaine nouvelle soumission les reprend." },
      { q: "Puis-je définir des conditions différentes par soumission ?", a: "Pas aujourd'hui — les conditions sont une seule ligne pour toute l'entreprise. Ce que vous pouvez varier par soumission, c'est la description des travaux, copiée sur chaque soumission et modifiable là." },
      { q: "Pourquoi le champ Conditions de paiement est-il grisé ?", a: "Un échéancier de paiement est actif. Le texte est généré à partir des étapes de l'échéancier pour que les deux ne puissent pas se contredire. Désactivez l'échéancier pour taper librement de nouveau." },
    ],
  },

  "sales-tax-on-invoices": {
    title: "Les taxes sur les factures",
    summary:
      "Comment la ligne de taxe d'une facture est décidée, ce que fait Appliquer la taxe, pourquoi un envoi peut être refusé, et où votre numéro d'inscription s'imprime.",
    updated: "2026-09-12",
    intro: [
      "Une facture porte un seul montant de taxe, calculé à partir des taux que vous avez configurés une fois dans le Profil de l'entreprise. Une facture produite depuis une soumission copie exactement la taxe de la soumission ; une nouvelle facture résout un taux pour le client dès que vous le choisissez, et vous dit d'où vient ce taux. FieldQuo n'invente jamais de taux, et refuse d'envoyer une facture qui dit que la taxe s'applique mais n'en facture aucune sans rien pour l'expliquer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Trois choses décident de la ligne de taxe : les taux de la carte **Paramètres de taxes**, le réglage **Appliquer automatiquement le taux de taxe local du client**, et la case **Appliquer la taxe** sur le document lui-même. Votre numéro d'inscription, si vous en saisissez un, s'imprime au bas de chaque soumission et facture pour qu'un client d'affaires puisse récupérer la taxe." },
          { note: "La taxe est un montant unique par facture. Une entreprise du Québec qui facture la TPS et la TVQ saisit un taux combiné (14,975 %) et la facture affiche une seule ligne de taxe. Il n'y a ni codes de taxe ni taxe par ligne, donc l'export comptable ne peut pas produire une déclaration de taxes — voir [[the-accounting-export|L'export comptable]]." },
        ],
      },
      {
        id: "tax-settings-card",
        heading: "La carte Paramètres de taxes",
        blocks: [
          { p: "Dans **Paramètres → Profil de l'entreprise**, la carte **Paramètres de taxes** contient : **Nom du numéro de taxe** (p. ex. TPS) et le champ du numéro, étiqueté comme votre pays le nomme ; une case **Je n'en ai pas — mon entreprise n'est pas inscrite.** ; la liste **Taux de taxe**, chaque taux avec son pourcentage et une étiquette **Par défaut** sur l'un d'eux ; **Créer un taux de taxe** (un nom, un **Taux %** et une coche **Par défaut**) ; et la case **Appliquer automatiquement le taux de taxe local du client**. Une entreprise dans un pays à TVA répond aussi à **Êtes-vous inscrit à la TVA ?**." },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — la carte Paramètres de taxes : numéro d'inscription, les taux de taxe avec leur étiquette Par défaut, et la case du taux automatique." },
          { p: "La carte complète est décrite dans [[tax-settings|Paramètres de taxes]]. Cet article porte sur ce que ces réglages font à une facture." },
        ],
      },
      {
        id: "on-a-new-invoice",
        heading: "Sur une nouvelle facture",
        blocks: [
          { p: "Dans **Factures → Nouvelle facture**, la case **Appliquer la taxe** affiche le taux dans son libellé — **Appliquer la taxe (13 %)** — et, une fois cochée, un champ **Taux de taxe** que vous pouvez écraser. Le taux est résolu pour le client choisi, dans cet ordre : si le réglage automatique est désactivé, votre taux par défaut ; sinon un de vos taux dont le nom correspond à la province du client (« TVH Ontario », « TPS + TVQ (QC) ») ; sinon le taux publié pour cette province canadienne ; sinon votre taux par défaut. Rien n'est jamais deviné hors du Canada — un chiffre d'État américain est un plancher, pas un taux, et la TVA européenne ne s'applique qu'une fois que vous avez déclaré être inscrit." },
          { figure: "live:app-invoices-new", caption: "Nouvelle facture — les lignes, puis Appliquer la taxe avec le taux résolu et la note qui dit d'où il vient." },
          { warning: "Si le client n'a aucune adresse au dossier, le taux est **Présumée** à partir de votre propre province et l'écran le dit. Un client de l'autre côté d'une frontière provinciale doit un taux différent — Ottawa et Gatineau, c'est 13 % et 14,975 % — alors vérifiez avant d'envoyer, ou ajoutez l'adresse du client et le vrai taux s'applique." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["Appliquer la taxe, cochée", "La taxe est calculée au taux affiché et ajoutée au total. Le document indique le taux."],
              ["Appliquer la taxe, décochée", "Le document dit qu'aucune taxe ne s'applique — une position déclarée, pas un blanc."],
              ["Taux de taxe, tapé à la main", "Votre chiffre l'emporte pour ce document et n'est pas recalculé si vous changez de client."],
              ["Étiquette Par défaut", "Le taux utilisé chaque fois que rien de plus précis ne correspond."],
              ["Appliquer automatiquement le taux de taxe local", "Compare la province du client aux noms de vos taux, puis à la table canadienne publiée ; désactivé, chaque document part de votre taux par défaut."],
              ["Nom et numéro de taxe", "S'impriment au bas de chaque soumission et facture. Vide veut dire aucune ligne, jamais une étiquette sans rien derrière."],
            ],
          } },
        ],
      },
      {
        id: "a-refused-send",
        heading: "Quand un envoi est refusé",
        blocks: [
          { p: "L'envoi est bloqué quand une facture dit que la taxe s'applique, facture 0,00 $, et que rien ne peut l'expliquer — ni pays ni province pour le client, et aucun taux de repli. Le message se lit : « Ce document dit que la taxe s'applique mais n'en facture aucune, et il n'y a rien pour calculer le taux. » Ajoutez le pays et la province du client, ou décochez Appliquer la taxe si rien n'est dû, puis renvoyez. Les soumissions ont le même arrêt." },
        ],
      },
      {
        id: "invoices-from-quotes-and-plans",
        heading: "Factures issues de soumissions, et de forfaits",
        blocks: [
          { bullets: [
            "Une facture produite depuis une soumission acceptée copie le montant de taxe de la soumission et son état activé/désactivé. Elle n'est pas recalculée — le client a déjà lu ce chiffre.",
            "Supprimer ou modifier un taux de taxe ne touche jamais un document déjà envoyé ; la taxe est stockée comme un montant, pas comme un taux.",
            "Un forfait de service déclare son propre **Taxe %** au moment de la vente. Vide signifie aucune taxe sur ce forfait, et non « à déterminer plus tard ».",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Les Paramètres de taxes appartiennent au propriétaire, aux administrateurs, aux gestionnaires et aux répartiteurs. Produire une facture et choisir sa taxe demande le niveau Factures **View, create, and edit** et **Show Pricing** — un répartiteur ou un gestionnaire par défaut ; un estimateur peut lire les factures mais pas en produire." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je facturer deux taxes sur deux lignes ?", a: "Non. Saisissez le taux combiné (Québec : 14,975 %) comme un seul taux ; la facture affiche une seule ligne de taxe." },
      { q: "Pourquoi la facture dit-elle « Ontario présumée » ?", a: "Le client n'a aucune adresse au dossier, alors FieldQuo s'est rabattu sur votre propre province et l'a étiquetée comme une supposition. Ajoutez l'adresse du client, ou écrasez le taux." },
      { q: "FieldQuo remet-il ou déclare-t-il quelque chose ?", a: "Non. Il imprime ce que vous saisissez et ajoute la taxe que vous avez choisie. Les déclarations et les remises vous appartiennent." },
    ],
  },

  "pay-over-time-financing": {
    title: "Le paiement échelonné",
    summary:
      "Deux choses distinctes : Affirm au moment du paiement, où le prêteur décide et où vous êtes payé en entier, et une mensualité facultative sur les soumissions, selon des conditions que vous énoncez vous-même.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo ne prête pas d'argent et n'approuve personne. Ce qu'il offre, ce sont deux choses que vous activez séparément : **Affirm** comme deuxième option à côté de la carte au moment du paiement, pour qu'un client puisse fractionner une facture en versements pendant que vous êtes payé en entier et d'avance ; et une mensualité sur la page d'approbation de la soumission, affichée seulement si vous avez saisi votre propre taux et votre propre durée. Ni l'un ni l'autre n'est activé par défaut.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le paiement échelonné est offert au moment du paiement par l'intermédiaire de Stripe, où le prêteur décide. FieldQuo ne prête pas et n'approuve personne. La mensualité affichée sur une soumission n'apparaît que si vous saisissez votre propre taux et votre propre durée — FieldQuo n'en invente jamais." },
          { p: "Les deux commandes vivent sur deux écrans : l'interrupteur **Proposer le paiement échelonné (Affirm)** dans **Paramètres → Paiements**, et la carte **Financement** dans **Paramètres → Soumissions instantanées**." },
        ],
      },
      {
        id: "affirm-at-checkout",
        heading: "Affirm au moment du paiement",
        blocks: [
          { steps: [
            "Activez d'abord Affirm dans votre propre tableau de bord Stripe — FieldQuo ne peut pas le faire à votre place ni le vérifier.",
            "Ouvrez **Paramètres → Paiements**. Une fois Stripe actif, la carte **Proposer le paiement échelonné (Affirm)** apparaît avec un interrupteur.",
            "Activez-le. Les factures de **50 $ à 30 000 $** en USD ou en CAD affichent alors Affirm à côté de la carte sur la page de paiement ; tout ce qui sort de cette plage, ou une entreprise pour laquelle Affirm n'a pas été activé, obtient une page carte seulement plutôt qu'une page brisée.",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — la carte des frais de traitement, le compte Stripe connecté, et l'interrupteur du paiement échelonné dessous." },
          { p: "Vous êtes toujours payé en entier, d'avance ; Affirm perçoit les versements auprès du client. Les frais sur un paiement Affirm sont le taux d'Affirm, plus élevé que le taux carte, et ils sont refilés sur ce paiement de la même manière que des frais de carte — voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]]. Un client qui paie par carte sur la même page paie les frais de carte, rien de plus." },
        ],
      },
      {
        id: "a-monthly-figure-on-quotes",
        heading: "Une mensualité sur les soumissions",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Soumissions instantanées** et trouvez la carte **Financement**.",
            "Activez-la et rédigez **Quoi dire au propriétaire** dans vos mots — « Nous offrons du financement sur crédit approuvé — demandez-nous les détails. » Ajoutez un **Lien du fournisseur (facultatif)** si vous passez par un prêteur ; le client obtient un bouton vers lui.",
            "Sous **Vos conditions annoncées (facultatif)**, remplissez à la fois **Taux annuel (TAEG %)** et **Durée (mois)**, ou ni l'un ni l'autre. Appuyez sur **Enregistrer**.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Paramètres → Soumissions instantanées — la carte Financement au bas : la note, le lien du fournisseur, et le taux et la durée annoncés." },
          { p: "Avec les deux conditions énoncées, la page d'approbation de la soumission affiche une mensualité estimative sous le total, présentée comme une estimation selon vos conditions. La page d'estimation instantanée affiche votre note et le bouton du fournisseur, jamais de mensualité. Laissez l'un des deux champs vide et aucune mensualité n'apparaît nulle part — il n'y a ni taux ni durée par défaut." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["Proposer le paiement échelonné (Affirm) — activé", "Les factures admissibles proposent Affirm à côté de la carte au paiement. Les frais d'Affirm sont refilés sur ces paiements seulement."],
              ["Proposer le paiement échelonné (Affirm) — désactivé", "Chaque page de paiement est carte seulement, même si Affirm est actif dans votre tableau de bord Stripe."],
              ["Carte Financement — activée, sans conditions", "La soumission dit que du financement est offert, dans vos mots, avec un bouton vers votre fournisseur si vous en avez donné un. Aucun chiffre."],
              ["Carte Financement — taux et durée énoncés", "La soumission ajoute une mensualité estimative, calculée depuis votre TAEG et votre durée et présentée comme votre estimation."],
              ["Carte Financement — désactivée", "Rien au sujet du financement n'apparaît sur les soumissions ni les estimations."],
            ],
          } },
        ],
      },
      {
        id: "the-limits",
        heading: "Les limites",
        blocks: [
          { warning: "Ne promettez pas un taux ni une mensualité que vous ne pouvez pas honorer. Le chiffre sur la soumission est calculé à partir des conditions que vous avez tapées et présenté au propriétaire comme le vôtre. Au paiement, Affirm annonce ses propres conditions et la décision est celle du prêteur, pas celle de FieldQuo ni la vôtre." },
          { bullets: [
            "Affirm : factures de 50 $ à 30 000 $, en USD ou en CAD seulement, et seulement une fois Affirm activé sur votre compte Stripe.",
            "La mensualité : des mois entiers, un TAEG entre 0 % et 100 %, les deux champs ou aucun.",
            "Le prélèvement bancaire et les forfaits de service ne sont pas du financement — un forfait, ce sont vos propres versements, sur vos propres factures. Voir [[service-plans|Forfaits de service]].",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Les deux interrupteurs sont réservés au propriétaire et aux administrateurs : Paramètres → Paiements est un écran d'administration de la facturation, et la grille de tarifs des Soumissions instantanées, financement compris, refuse tout autre membre à l'enregistrement." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo vérifie-t-il le crédit du client ?", a: "Non. C'est Affirm qui le fait, au moment du paiement, et qui décide seul. FieldQuo ne voit jamais la demande." },
      { q: "Puis-je afficher une mensualité sans énoncer de taux ?", a: "Non. Pas de conditions, pas de chiffre — un nombre inventé par FieldQuo serait une condition qu'on pourrait vous opposer." },
      { q: "Affirm est-il offert au Canada ?", a: "Oui, pour les factures en CAD comme en USD, dans la plage de 50 $ à 30 000 $, une fois activé dans votre tableau de bord Stripe." },
    ],
  },

  "service-plans": {
    title: "Forfaits de service (facturation récurrente)",
    summary:
      "Vendez un service récurrent — printemps et automne, chaque mois, chaque trimestre — et laissez chaque visite produire sa propre facture, ou prélevez automatiquement la carte ou le compte bancaire enregistré du client.",
    updated: "2026-09-12",
    intro: [
      "Un forfait de service est une instruction permanente de facturer le même montant à un client, à la fréquence de votre choix : nettoyage de gouttières deux fois par an, visite de pelouse mensuelle, entretien trimestriel. Chaque échéance produit une vraie facture à votre nom. L'encaissement se fait soit par une facture avec lien de paiement, qui fonctionne pour tous les clients, soit par un prélèvement automatique sur une carte ou un compte bancaire canadien que le client a autorisé par écrit.",
      "Les conditions financières — montant, rabais, fréquence, durée — sont figées à l'enregistrement du forfait, parce que le client autorise ces chiffres exacts. Pour changer l'entente, annulez le forfait et vendez-en un nouveau.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Forfaits** se trouve dans le groupe Argent de la barre latérale, après Factures, parce qu'un forfait est une règle qui produit des factures. L'écran dit « Travaux récurrents vendus en forfait, facturés à la fréquence de votre choix. » Chaque ligne affiche le nom du forfait, **Actif**, le client, la fréquence (**Deux fois par an**, **Tous les trois mois**), le prix par visite, le mode d'encaissement (**Facture envoyée à chaque visite** ou **Prélèvement automatique — Visa ···· 4242**), et soit le total du forfait avec son rabais, soit **Jusqu’à annulation**." },
          { figure: "live:app-plans", caption: "Forfaits de service — une ligne par forfait avec sa fréquence, son prix par visite, son mode d'encaissement et son total." },
        ],
      },
      {
        id: "sell-a-plan",
        heading: "Comment vendre un forfait",
        blocks: [
          { steps: [
            "Ouvrez **Forfaits** et appuyez sur **Nouveau forfait**.",
            "Choisissez le **Client** et le **Service**, et donnez un **Nom du forfait** — c'est ce que le client voit sur chaque facture.",
            "Sous **Calendrier**, choisissez la **Fréquence** (Chaque semaine, Chaque mois, Tous les trois mois, Deux fois par an, Une fois par an), la date de la **Première visite**, et la **Durée** : **Un nombre de visites**, **Jusqu’à une date** ou **Jusqu’à annulation**.",
            "Sous **Prix**, saisissez le montant **Par visite, avant rabais**, un **Rabais forfait %** facultatif, et **Taxe %** — vide veut dire aucune taxe sur ce forfait.",
            "Sous **Mode de paiement**, choisissez **Facturer chaque visite** ou **Prélever automatiquement**, puis appuyez sur **Créer le forfait**.",
          ] },
          { figure: "create:app-plans-create", caption: "Nouveau forfait de service — client, service, calendrier, prix et mode de paiement." },
          { note: "L'aperçu sous Prix dit ce qui sera réellement facturé — pour 200 $ la visite avec 10 % de rabais : « Chaque visite est facturée 180,00 $. » et, pour une durée fixe, « 6 visites, 1 080,00 $ au total — 120,00 $ de rabais. » Le rabais s'applique à chaque visite au même taux, donc chaque facture s'additionne d'elle-même et le total du forfait est la somme des factures." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Ce que chaque champ change",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il fait"],
            rows: [
              ["Fréquence", "Chaque semaine avance de 7 jours ; les autres avancent par mois depuis la date de la première visite, donc un forfait ancré le 31 facture le 31 (ou le dernier jour d'un mois plus court) et ne recule jamais."],
              ["Durée — Un nombre de visites", "De 1 à 520 visites, puis le forfait se termine de lui-même."],
              ["Durée — Jusqu’à une date", "Rien n'est facturé après le Dernier jour. Une date de fin avant la première visite est refusée."],
              ["Durée — Jusqu’à annulation", "Aucune date de fin. Le client en est informé explicitement avant d'accepter quoi que ce soit."],
              ["Rabais forfait %", "Retiré de chaque visite, de 0 à 99 %. Affiché sur la facture."],
              ["Taxe %", "Appliquée à chaque visite. Vide est une décision — aucune taxe — pas un oubli."],
              ["Facturer chaque visite", "Chaque échéance produit une facture et envoie le lien de paiement par courriel. Rien n'est conservé, rien n'est prélevé à moins que le client ne paie."],
              ["Prélever automatiquement", "La même facture, plus un prélèvement hors session sur le moyen de paiement que le client a autorisé. Tant qu'il n'a pas autorisé, le forfait facture comme ci-dessus."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-each-visit",
        heading: "Ce qui se passe à chaque date de visite",
        blocks: [
          { p: "Une fois par jour, FieldQuo passe en revue chaque forfait actif. Une échéance dont la date est arrivée produit une facture — une seule ligne, « Nom du forfait — Service », avec le rabais et la taxe que le forfait déclare, exigible à la date de la visite, dans la langue dans laquelle le forfait a été vendu — et envoie au client le lien de paiement par courriel. Au plus **une échéance par forfait par jour** est générée : une date de début mal tapée coûte une facture, pas cent, et une semaine manquée se rattrape en une semaine." },
          { p: "Sur la page du forfait, **Facturé jusqu’ici** liste chaque échéance comme **En préparation**, **Facturé**, **Paiement en cours**, **Payé** ou **Paiement refusé**, avec **Voir la facture**. Un forfait vendu pour six visites passe à **Terminé** après la sixième ; un forfait ouvert tourne jusqu'à ce que vous appuyiez sur **Annuler le forfait**." },
          { warning: "**Annuler le forfait** arrête l'argent. Plus aucune visite n'est facturée, l'autorisation du client est retirée et son moyen de paiement enregistré est détaché chez Stripe. Les factures déjà produites restent exactement telles quelles — annulez le forfait, puis traitez une facture impayée sur sa propre page." },
        ],
      },
      {
        id: "automatic-collection",
        heading: "Le prélèvement automatique, en bref",
        blocks: [
          { p: "Choisir **Prélever automatiquement** ne prélève encore rien. Après l'enregistrement, appuyez sur **Demander au client d’autoriser les paiements** : le client reçoit un lien, lit le montant exact, la fréquence et les conditions d'annulation, coche une case et enregistre une carte ou un compte bancaire sur une page Stripe. À partir de là, la page du forfait indique **Prélèvement automatique sur Visa ···· 4242. Le client l’a autorisé le 12 sept. 2026.** Une carte refusée ou un moyen retiré retombe sur la facture avec lien de paiement, et la page dit lequel. Le parcours complet, le libellé et le mandat de prélèvement bancaire canadien : [[service-plan-bank-debit-mandates|Forfaits payés par prélèvement bancaire]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut voir et vendre des forfaits",
        blocks: [
          { p: "Voir l'écran Forfaits demande le niveau Factures **View only** — à partir de l'estimateur. Créer un forfait et demander au client d'autoriser les paiements demandent **View, create, and edit** sur les Factures plus l'interrupteur **Payments** (« Allow payment collection on quotes and invoices » — la grille d'accès est en anglais sur tous les écrans) : un gestionnaire, un administrateur ou le propriétaire. Annuler un forfait ne demande que **View, create, and edit**, donc un répartiteur peut en annuler un mais pas en vendre un." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Pourquoi c'est classé sous Seulement dans FieldQuo",
        blocks: [
          { p: "Les pages de comparaison de FieldQuo décident « seulement dans FieldQuo » d'une seule façon : la capacité n'est listée sur la page de tarifs de l'autre produit à aucun palier — jamais par simple affirmation. Sur les cinq produits auxquels FieldQuo se compare, les forfaits de service récurrents sont listés par un seul (Housecall Pro, à son palier le plus élevé) et absents des quatre autres pages de tarifs. Le prélèvement bancaire préautorisé canadien à 1 % plafonné à 5 $, comme mode d'encaissement d'un forfait, n'est listé par aucun d'eux." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer le prix d'un forfait en cours ?", a: "Non. Le montant, le rabais, la fréquence et la durée sont figés à la création parce que le client a autorisé ces chiffres. Annulez-le et vendez un nouveau forfait." },
      { q: "Le forfait crée-t-il une visite au calendrier ?", a: "Non. Un forfait produit des factures à ses dates ; la planification de l'équipe se fait sur le chantier et ses visites, comme d'habitude." },
      { q: "Et si la carte du client est refusée ?", a: "L'échéance est marquée Paiement refusé, le client reçoit la facture avec un lien de paiement, et la page du forfait vous le dit. Rien n'est encaissé en silence." },
      { q: "Un client sur un forfait peut-il payer par prélèvement bancaire ?", a: "Oui, si votre entreprise facture en CAD — le client enregistre un compte bancaire canadien au moment d'autoriser, et chaque prélèvement coûte 1 % + 0,40 $, plafonné à 5 $." },
    ],
  },

  "service-plan-bank-debit-mandates": {
    title: "Forfaits payés par prélèvement bancaire : le mandat",
    summary:
      "Ce que le client accepte avant qu'un forfait puisse le prélever, comment un prélèvement préautorisé canadien est mis en place et réglé, et ce qui l'arrête.",
    updated: "2026-09-12",
    intro: [
      "Un forfait réglé sur **Prélever automatiquement** ne peut prendre de l'argent que sur un mandat : l'accord écrit du client pour une série de paiements d'un montant nommé à une fréquence nommée, plus une carte ou un compte bancaire enregistré chez Stripe. FieldQuo affiche les conditions sur sa propre page, consigne le libellé exact que le client a accepté, et seulement ensuite l'envoie chez Stripe pour enregistrer l'instrument. Pour une entreprise canadienne qui facture en CAD, cet instrument peut être un compte bancaire — un prélèvement préautorisé — moins cher qu'une carte et sans date d'expiration.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Demander un prélèvement automatique est une requête ; détenir un mandat vivant est une capacité. La page du forfait les distingue : **Prélèvement automatique demandé, mais le client n’a pas encore accepté**, **Le client a accepté mais n’a pas encore enregistré de moyen de paiement**, **Le moyen de paiement enregistré a été retiré — des factures sont envoyées à la place**, ou **Prélèvement automatique sur … Le client l’a autorisé le …**. Tant que la dernière n'est pas vraie, chaque visite est facturée avec un lien de paiement." },
          { note: "Le prélèvement bancaire n'est offert que lorsque la devise de votre entreprise est le CAD, parce que Stripe exige que la devise du prélèvement corresponde au compte bancaire canadien du client. En USD, le client ne peut enregistrer qu'une carte. Voir [[bank-debit-in-canada|Le prélèvement bancaire au Canada]]." },
        ],
      },
      {
        id: "how-the-client-authorises",
        heading: "Comment le client autorise",
        blocks: [
          { steps: [
            "Sur la page du forfait, appuyez sur **Demander au client d’autoriser les paiements**. L'écran confirme : « Envoyé à jane@exemple.com. Le client verra le montant et le calendrier avant d’accepter quoi que ce soit. »",
            "Le client ouvre le lien — une page dans la langue du forfait, intitulée « Autoriser les paiements automatiques — Nettoyage de gouttières printemps et automne » — lit les conditions, coche **J’ai lu ce qui précède et j’autorise ces paiements.** et appuie sur **Accepter et continuer**. Rien n'est prélevé ce jour-là.",
            "La page sécurisée de Stripe recueille la carte ou le compte bancaire. Pour un prélèvement préautorisé, Stripe affiche sa propre entente de DPA et en envoie une copie au client par courriel.",
            "Un compte bancaire peut devoir être vérifié : le client voit « Vos renseignements bancaires ont été reçus mais doivent encore être vérifiés… d’ici un ou deux jours. » Une fois que la banque confirme, la page du forfait passe à **Prélèvement automatique sur …**.",
          ] },
          { p: "Si le client a coché la case puis abandonné le formulaire de carte, le forfait indique **Le client a accepté mais n’a pas encore enregistré de moyen de paiement** et continue de facturer. **Renvoyer le lien d’autorisation** renvoie la même demande." },
        ],
      },
      {
        id: "what-the-terms-say",
        heading: "Ce que disent les conditions",
        blocks: [
          { p: "Stripe exige qu'un marchand qui prélève hors session énonce, et conserve, quatre choses : qu'une série de paiements sera lancée, leur moment et leur fréquence, comment le montant est déterminé, et la politique d'annulation. La page de FieldQuo les énonce en phrases simples, construites à partir du forfait lui-même, et le texte exact est figé avec l'acceptation du client — améliorer le libellé plus tard ne peut pas réécrire ce qu'un client existant a accepté." },
          { bullets: [
            "Vous autorisez l'entreprise à prélever une série de paiements sur le moyen de paiement que vous enregistrez à l'étape suivante, sans autre intervention de votre part.",
            "Le premier paiement est prélevé à la date de la première visite, puis tous les trois mois (ou selon la fréquence du forfait).",
            "Chaque paiement est du montant du forfait, taxes comprises lorsqu'un taux de taxe est déclaré. Ce montant est fixé et ne peut pas être modifié en cours d'entente.",
            "Comment ça se termine : un nombre de paiements au total, aucun paiement après une date, ou aucune date de fin — les paiements continuent jusqu'à ce qu'une des parties y mette fin.",
            "Le client peut y mettre fin à tout moment en communiquant avec l'entreprise, au téléphone et au courriel au dossier. Aucun paiement n'est prélevé après l'annulation.",
            "Chaque paiement donne lieu à une facture, visible dans l'espace client.",
          ] },
          { warning: "Le prélèvement automatique ne peut être vendu qu'en **anglais ou en français** — les deux langues pour lesquelles FieldQuo détient un libellé d'autorisation révisé. Un client dont la langue est autre n'est pas invité à autoriser du tout ; son forfait facture chaque visite, ce qui fonctionne dans toutes les langues." },
        ],
      },
      {
        id: "the-debit-itself",
        heading: "Le prélèvement lui-même",
        blocks: [
          { p: "À chaque date de visite, le forfait produit la facture et prélève le moyen enregistré sous le mandat, sans que le client soit présent. Une carte se règle sur-le-champ : l'échéance est **Payé** et le client reçoit la facture présentée comme un reçu, de votre entreprise, et non un reçu Stripe d'un nom qu'il ne connaît pas. Un prélèvement bancaire prend environ **cinq jours ouvrables** pour être compensé, alors l'échéance reste à **Paiement en cours** — la facture n'est pas marquée payée sur de l'argent qui n'a pas bougé — et Stripe envoie au client l'avis de prélèvement que le mandat exige. Une fois compensé, Payé et le reçu ; s'il revient, **Paiement refusé** et la facture avec un lien de paiement." },
          { table: {
            head: ["Moyen", "Frais à chaque échéance", "Compensation"],
            rows: [
              ["Carte", "3 % + 0,30 $", "Immédiate"],
              ["Prélèvement préautorisé (Canada, CAD)", "1 % + 0,40 $, plafonné à 5,00 $", "Environ 5 jours ouvrables"],
            ],
          } },
          { tip: "Sur un forfait trimestriel de 500 $, la carte coûte 15,30 $ par visite et le prélèvement bancaire 5,00 $ — le plafond. Sur un an, c'est 41,20 $ d'économie pour un seul client." },
        ],
      },
      {
        id: "what-stops-it",
        heading: "Ce qui l'arrête",
        blocks: [
          { bullets: [
            "**Retirer le moyen de paiement enregistré** sur la page du forfait : l'autorisation est d'abord retirée dans FieldQuo, puis le moyen est détaché chez Stripe. Le forfait continue de tourner et facture chaque visite à la place.",
            "**Annuler le forfait** : plus rien n'est facturé, et le moyen est détaché de la même façon. Si Stripe ne confirme pas le détachement, l'écran le dit et vous demande de vérifier la fiche du client dans Stripe.",
            "Le client qui vous demande d'arrêter : les conditions lui disent de communiquer avec vous, et vous annulez. Rien chez Stripe ne peut facturer tout seul — aucun abonnement n'y est créé — donc un forfait annulé ne peut pas laisser un préleveur actif derrière lui.",
            "Un prélèvement refusé, ou une banque qui exige une authentification que le client absent ne peut pas donner : cette échéance est facturée avec un lien de paiement et le mandat demeure pour la suivante.",
          ] },
        ],
      },
      {
        id: "who-can-do-this",
        heading: "Qui peut le faire",
        blocks: [
          { p: "Envoyer la demande d'autorisation et retirer un moyen enregistré demandent tous deux **View, create, and edit** sur les Factures plus l'interrupteur **Payments** — un gestionnaire, un administrateur ou le propriétaire. Qui ne peut pas mettre un mandat en place ne peut pas non plus le défaire." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Pourquoi c'est classé sous Seulement dans FieldQuo",
        blocks: [
          { p: "Sur les pages de comparaison de FieldQuo, une capacité compte comme « seulement dans FieldQuo » lorsqu'elle n'est listée sur la page de tarifs de l'autre produit à aucun palier. Encaisser un forfait récurrent par prélèvement préautorisé canadien, avec le libellé du mandat consigné contre l'acceptation du client, n'est listé par aucun des cinq produits auxquels FieldQuo se compare ; les forfaits récurrents eux-mêmes figurent sur une seule de ces pages de tarifs (le palier le plus élevé de Housecall Pro)." },
        ],
      },
    ],
    faq: [
      { q: "Le client a-t-il besoin d'un compte FieldQuo ?", a: "Non. La page d'autorisation s'ouvre depuis le lien envoyé par courriel, et la page de Stripe enregistre l'instrument. Les factures du client sont dans son portail client, aussi par lien." },
      { q: "Puis-je saisir la carte du client à sa place ?", a: "Non. Le client l'enregistre lui-même sur la page de Stripe, après avoir accepté les conditions. FieldQuo ne voit jamais les numéros de carte ni de compte." },
      { q: "Le prélèvement est revenu — est-ce que je perds la visite ?", a: "Non. La facture est réelle et impayée ; le client la reçoit avec un lien de paiement, et l'échéance affiche Paiement refusé sur la page du forfait." },
    ],
  },

  "the-client-portal": {
    title: "Le portail client",
    summary:
      "Un lien, aucune connexion : là où un client voit ses factures, ce qu'il doit encore, ses soumissions et le bouton Payer — à votre nom, pas au nôtre.",
    updated: "2026-09-12",
    intro: [
      "Chaque client a un lien de portail, créé la première fois que vous lui envoyez une facture par courriel. Il s'ouvre sans mot de passe et affiche son solde dû, chaque facture émise avec un bouton **Payer**, et chaque soumission que vous avez envoyée. La page porte votre logo et votre couleur de marque et ne mentionne jamais FieldQuo — le client vous a engagé, pas nous.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le lien est la seule chose entre un inconnu et l'historique de facturation d'un client, alors il est fait de 32 octets aléatoires, pas d'un numéro que quelqu'un peut deviner en comptant. Il reste le même d'un courriel à l'autre, donc un courriel plus ancien s'ouvre encore. Le bouton Payer du courriel de facture mène directement à la page de la facture dans le portail, là où le paiement commence vraiment — une session de paiement Stripe n'est créée qu'au moment où le client appuie sur Payer, donc un lien dans une boîte de réception ne périme jamais." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Ce que le client voit",
        blocks: [
          { bullets: [
            "Votre logo et le nom de votre entreprise, puis **Compte de Jeanne Tremblay**.",
            "**Solde dû**, en premier sur la page, avec **Réparti sur 2 factures.** — ou **Rien en souffrance. Merci.**",
            "**Factures** : numéro, total, **1 200 $ payé**, **échéance 30 sept. 2026**, et un bouton **Payer 2 260 $** à côté de ce qui est dû — ou **Payé**.",
            "**Soumissions** : chacune avec une pastille dans les mots du client — **En attente de votre réponse**, **Approuvée**, **Refusée** — et un lien **Consulter** vers la page d'approbation.",
            "**Des questions à ce sujet ? Contactez Peinture Acme au 613-555-0100 · bonjour@acme.ca** au bas de la page.",
          ] },
          { p: "La page d'une facture affiche les lignes, **Échéance** ou **Était dû**, les montants d'étape demandés s'il y en a, et le même bouton Payer ; une fois réglée, elle indique **Payée en totalité**. Quand vous n'êtes pas connecté à Stripe, le bouton Payer est remplacé par vos instructions de paiement hors ligne." },
        ],
      },
      {
        id: "how-the-link-reaches-them",
        heading: "Comment le lien parvient au client",
        blocks: [
          { steps: [
            "Envoyez une facture, ou appuyez sur **Relancer le paiement** sur l'une d'elles — le bouton Payer du courriel ouvre la facture dans le portail. Voir [[send-an-invoice|Envoyer une facture]].",
            "Les rappels automatiques de retard de vos règles de relance portent le même lien.",
            "Les factures et reçus d'un forfait de service mènent aussi au portail, et les conditions d'autorisation du forfait disent au client que « chaque paiement donne lieu à une facture, visible dans votre espace client ».",
          ] },
          { note: "Il n'y a pas de bouton « copier le lien du portail » dans l'application aujourd'hui. Le lien voyage dans les courriels que FieldQuo envoie ; si un client l'a perdu, relancez ou renvoyez une facture." },
        ],
      },
      {
        id: "what-is-not-there",
        heading: "Ce qui n'y est pas, volontairement",
        blocks: [
          { bullets: [
            "Les factures en brouillon. Seules les factures émises sont listées — envoyées, ou marquées payées en personne — pour qu'un client ne voie jamais un montant dû sur une facture que personne n'a envoyée.",
            "Les soumissions en brouillon et les estimations instantanées non révisées. Un chiffre que personne dans votre entreprise n'a fixé n'apparaît pas comme le vôtre.",
            "Les chantiers, visites, techniciens, notes. Le portail montre les soumissions et les factures, rien d'autre — les notes de révision IA d'une soumission n'atteignent jamais une surface destinée au client.",
            "Vos coordonnées Stripe. Si Payer fonctionne se décide sur le serveur ; le client voit un bouton ou vos instructions hors ligne, jamais le compte.",
          ] },
        ],
      },
      {
        id: "language-and-branding",
        heading: "Langue et image de marque",
        blocks: [
          { p: "Le portail est rédigé dans la langue du client, avec repli sur la langue par défaut de votre entreprise — la même règle que pour chaque courriel. Chaque document garde la langue dans laquelle il a été créé, donc une soumission en français listée sur un portail en anglais s'ouvre quand même en français. Les couleurs viennent de votre unique couleur de marque, et le contraste du texte sur le bouton Payer est mesuré plutôt que présumé." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Quiconque détient le lien. Personne dans votre équipe n'ouvre le portail depuis l'application ; le personnel lit la même facture dans **Factures**. Si un lien est parvenu à la mauvaise personne, communiquez avec le soutien — renouveler le lien d'un client n'est pas un bouton de l'application aujourd'hui." },
        ],
      },
    ],
    faq: [
      { q: "Le client doit-il créer un compte ?", a: "Non. Le lien est le compte. Pas de mot de passe, pas d'inscription et aucune application à installer." },
      { q: "Le client peut-il payer une partie d'une facture ?", a: "Seulement ce qu'un échéancier de paiement a demandé comme étape. Sinon, le bouton Payer prend tout le solde dû." },
      { q: "Le client verra-t-il FieldQuo quelque part ?", a: "Non. La page porte votre nom, votre logo et votre couleur ; le relevé de carte affiche le nom de votre entreprise." },
    ],
  },

  "the-accounting-export": {
    title: "L'export comptable (CSV pour QuickBooks, Xero ou votre comptable)",
    summary:
      "Un ZIP, quatre fichiers CSV, une période : ce que contient chaque fichier, les règles derrière les chiffres, et ce que l'export refuse de contenir.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo ne se synchronise pas avec QuickBooks ni Xero. Ce qu'il fait à la place, c'est laisser les chiffres sortir proprement : choisissez une période dans **Dépenses**, appuyez sur **Télécharger la période**, et vous obtenez un ZIP avec une feuille de synthèse et trois fichiers de données — factures, paiements, dépenses — que n'importe quel comptable peut ouvrir et que n'importe quel logiciel comptable peut importer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte **Export comptable** se trouve au bas de **Dépenses** (le même écran que Paramètres → Suivi des dépenses). Elle a des dates **Du** et **Au** et un seul bouton. Les montants sont dans la devise de facturation de votre entreprise, définie dans le Profil de l'entreprise ; sans devise, l'export refuse plutôt que de deviner." },
          { figure: "live:app-settings-expense-tracking", caption: "Suivi des dépenses — la carte Export comptable au bas : une période, Télécharger la période, et la liste de ce que le fichier ne contient pas." },
        ],
      },
      {
        id: "download-a-range",
        heading: "Comment télécharger une période",
        blocks: [
          { steps: [
            "Ouvrez **Dépenses** et descendez jusqu'à **Export comptable**.",
            "Réglez **Du** et **Au** — un mois, un trimestre, l'année.",
            "Appuyez sur **Télécharger la période**. Le ZIP se nomme bookkeeping-2026-01-01-to-2026-03-31.zip et contient la synthèse, les factures, les paiements et les dépenses en CSV.",
          ] },
          { tip: "Envoyez le ZIP au complet, pas un seul fichier tiré de celui-ci. La feuille de synthèse répète la liste de ce que les données ne peuvent pas dire — une déclaration de taxes, entre autres — pour que la mise en garde voyage avec les chiffres." },
        ],
      },
      {
        id: "the-four-files",
        heading: "Les quatre fichiers",
        blocks: [
          { table: {
            head: ["Fichier", "Une ligne par", "Colonnes"],
            rows: [
              ["summary", "période", "Entreprise, période, date de génération, devise de facturation ; puis par devise : Facturé, dont taxes, Paiements reçus, Remboursements, Frais de traitement, Frais de compte Stripe, Dépenses ; puis les limites et les notes sur la période."],
              ["invoices", "facture", "Numéro de facture, Émise, Date tirée de, Échéance, Client, Statut, Version, Devise, Sous-total, Rabais, Taxe, Taxe appliquée, Total, Payé à ce jour, Reçu dans la période, Solde."],
              ["payments", "paiement ou remboursement", "Date, Numéro de facture, Client, Moyen, Devise, Montant, Frais de traitement, Net déposé, Taux de frais, Frais de compte Stripe, Référence, Notes. Un remboursement émis depuis FieldQuo est sa propre ligne : moyen **refund**, un Montant négatif, l'identifiant de remboursement Stripe comme Référence et le motif comme Notes."],
              ["expenses", "dépense", "Date, Catégorie, Devise, Montant, Frais généraux, Récurrente, Fréquence, Chantier, Notes."],
            ],
          } },
        ],
      },
      {
        id: "the-rules-behind-the-numbers",
        heading: "Les règles derrière les chiffres",
        blocks: [
          { bullets: [
            "Une facture modifiée après envoi est une nouvelle version sous le même numéro. L'export produit **une ligne par facture**, aux montants de la dernière version, datée de l'original — une modification en mars ne double jamais une facture de janvier.",
            "Il n'y a pas de champ de date d'émission, alors chaque ligne dit de quelle colonne vient sa date : **sentAt (emailed)**, **createdAt (raised)**, ou les dates propres d'un chantier passé.",
            "Les paiements sont filtrés sur la **date du paiement lui-même**, pas celle de la facture : une facture de décembre payée en janvier est de l'argent de janvier. **Montant** est le brut ; **Frais de traitement** et **Net déposé** sont ce que Stripe a pris et ce qui est arrivé à la banque, vides — et non 0,00 — pour les paiements manuels et les paiements en ligne plus anciens.",
            "Les jours sont regroupés par jour civil UTC. Une période avec deux devises est rapportée par devise et jamais additionnée en un seul total.",
            "Les noms de clients, catégories et notes sont protégés contre les formules de tableur — un client nommé =cmd… s'ouvre comme du texte.",
          ] },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "Ce qu'il ne contient pas",
        blocks: [
          { bullets: [
            "Une déclaration. Rien ici n'a été remis à une administration fiscale.",
            "Une déclaration de taxes de vente. La taxe d'une facture est un montant unique, sans codes de taxe ni taxe par ligne.",
            "Les crédits de taxe sur intrants. Les dépenses ne portent ni taxe ni fournisseur, donc la taxe récupérable sur vos achats n'est pas suivie.",
            "Les notes de crédit. Un remboursement émis depuis la facture dans FieldQuo est une ligne négative du fichier des paiements et se totalise sous Remboursements ; un remboursement fait directement dans votre tableau de bord Stripe n'est pas une ligne — il n'apparaît que sur le montant remboursé du paiement d'origine.",
            "Un plan comptable. Rien n'est associé à un compte du grand livre — votre comptable le fait une fois, à l'import.",
          ] },
        ],
      },
      {
        id: "importing-it",
        heading: "Importer dans QuickBooks ou Xero",
        blocks: [
          { p: "Associez le **Montant** du fichier des paiements aux revenus, les **Frais de traitement** à une dépense de frais marchands et le **Net déposé** au dépôt bancaire ; le flux bancaire concorde alors ligne pour ligne. Une ligne **refund** est un Montant négatif sur le même compte de revenus, sans frais propres. Les factures entrent au **Total** avec **Taxe** comme montant de taxe. La marche à suivre par logiciel est dans [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero et votre comptable]] ; les colonnes de frais sont expliquées dans [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]]." },
        ],
      },
      {
        id: "who-can-download-it",
        heading: "Qui peut le télécharger",
        blocks: [
          { p: "L'export nomme chaque client et ce qu'il a payé, alors il est protégé comme la liste de prix : **Show Pricing** plus le niveau Factures **View only** ou plus. Un estimateur peut le télécharger ; un membre de l'équipe de terrain non. Une session de soutien en lecture seule est refusée — la console de FieldQuo peut consulter vos données mais ne génère jamais votre fin d'année sous forme de fichier." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce une intégration QuickBooks ?", a: "Non. C'est un export CSV que n'importe quel logiciel importe. Une synchronisation en direct exigerait le processus d'approbation d'Intuit et une correspondance de modèles de taxes qui n'existe pas encore, et le produit le dit plutôt que de faire semblant." },
      { q: "Pourquoi la cellule des frais est-elle vide sur certains paiements ?", a: "Ce paiement a été consigné à la main, ou en ligne avant que les frais soient enregistrés sur le paiement. Une cellule vide veut dire « aucuns frais connus » ; un zéro affirmerait « aucuns frais »." },
      { q: "Pourquoi un paiement de janvier manque-t-il dans mon export de décembre ?", a: "Les paiements sont datés du moment où ils ont été reçus. Exportez janvier pour l'argent de janvier ; la facture elle-même est dans le fichier de décembre avec son solde." },
    ],
  },

  "booking-fees-and-visit-deposits": {
    title: "Frais de réservation et dépôts de visite",
    summary:
      "Facturez des frais de visite quand un client réserve en ligne, retenez la plage 30 minutes, décidez si les frais reviennent en cas d'annulation, et créditez-les sur la facture quand le chantier va de l'avant.",
    updated: "2026-09-12",
    intro: [
      "Des frais de visite, c'est un prix sur un type de rendez-vous réservable — une visite de prise de mesures à 79 $, une consultation en design payante. Le client les paie par carte sur votre page de rendez-vous avant que la plage soit à lui ; si le chantier va de l'avant, vous créditez les frais sur la facture d'un seul bouton. Ce n'est pas un acompte de soumission : ceux-là sont demandés depuis l'échéancier de paiement de la soumission et sont couverts dans [[deposits-and-payment-schedules|Acomptes et échéanciers de paiement]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les frais ne sont perçus que lorsque votre entreprise peut vraiment les encaisser — Stripe connecté et paiements activés. Sans cela, un type de rendez-vous payant se réserve discrètement comme gratuit plutôt que d'afficher un prix que personne ne peut être facturé. La page de rendez-vous affiche le prix, le serveur le décide, et le navigateur ne calcule jamais de frais." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Dans **Paramètres → Page de rendez-vous**, chaque carte de type de rendez-vous porte des **Frais de visite** (ou **Gratuit**), un **Prix promo** et un interrupteur **Promo activée**. Au-dessus des cartes, **Modifications et annulations** contient **Préavis nécessaire pour modifier ou annuler**, l'interrupteur **Rembourser les frais de visite en cas d’annulation à temps**, et **Préavis nécessaire pour être remboursé**, avec une phrase d'aperçu qui énonce la politique exactement comme le client la lira. Une carte dont les frais ne peuvent pas être perçus dit **Connectez Stripe pour percevoir ces frais — configurez-le dans Paiements**." },
          { figure: "live:app-settings-booking-page", caption: "Paramètres → Page de rendez-vous — les réglages de visite, Modifications et annulations, puis une carte par type de rendez-vous avec ses frais et son prix promo." },
        ],
      },
      {
        id: "set-a-fee",
        heading: "Comment facturer une visite",
        blocks: [
          { steps: [
            "Connectez Stripe dans **Paramètres → Paiements** et attendez que les paiements soient activés — voir [[connect-stripe-and-get-verified|Connecter Stripe et faire vérifier votre compte]].",
            "Ouvrez **Paramètres → Page de rendez-vous** et, sur le type de rendez-vous, saisissez des **Frais de visite**. Laissez vide pour une visite gratuite.",
            "Pour lancer une offre, saisissez un **Prix promo** et activez **Promo activée**. La page de rendez-vous affiche le prix courant barré — 79 $ → 20 $ — et perçoit le prix promo.",
            "Sous **Modifications et annulations**, réglez le préavis et décidez si les frais sont remboursés quand un client annule à temps. Ça s'enregistre au fur et à mesure.",
          ] },
        ],
      },
      {
        id: "what-happens-when-a-client-books",
        heading: "Ce qui se passe quand un client réserve",
        blocks: [
          { bullets: [
            "Le client choisit une plage et est envoyé sur une page de carte Stripe pour les frais. La plage est **retenue 30 minutes** ; une retenue que personne ne paie expire et la plage redevient libre.",
            "Au paiement, la réservation est confirmée, un rendez-vous apparaît à votre calendrier et la confirmation est envoyée. Une vérification horaire relit Stripe pour toute réservation encore retenue, donc une visite payée que le webhook a manquée devient quand même un rendez-vous.",
            "Le tableau de bord affiche une réservation qui attend encore ses frais comme **En attente de 79 $**, avec un bouton pour vérifier le paiement.",
            "Les frais sont un paiement Stripe à votre nom : les frais de carte (3 % + 0,30 $) en sont déduits et le net est versé avec tout le reste.",
          ] },
        ],
      },
      {
        id: "credit-against-the-invoice",
        heading: "Créditer les frais sur la facture",
        blocks: [
          { p: "Quand le chantier va de l'avant, ouvrez la facture. Une carte **Crédit de frais de visite** dit « Ce client a déjà payé des frais de visite. Créditez-les sur cette facture. » Appuyez sur **Créditer sur la facture** et les frais sont consignés comme une ligne de paiement, **Crédit de frais de visite**, qui réduit le solde comme tout autre paiement ; **Retirer le crédit** le reprend. Les frais sont appariés par l'adresse courriel du client au sein de votre entreprise, et des frais ne peuvent être crédités qu'une fois, sur une seule facture." },
          { note: "Créditer est votre décision, pas un automatisme — parfois la consultation se suffit à elle-même. Cela demande l'interrupteur **Payments**." },
        ],
      },
      {
        id: "cancellations-and-refunds",
        heading: "Annulations et remboursements",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il fait"],
            rows: [
              ["Préavis nécessaire pour modifier ou annuler", "À l'intérieur de ce délai, le client ne peut plus déplacer ni annuler la visite lui-même ; la page lui dit de vous téléphoner. Non réglé, c'est 24 heures."],
              ["Rembourser les frais de visite en cas d’annulation à temps — désactivé", "L'annulation a lieu quand même et les frais vous restent. C'est le réglage par défaut."],
              ["Rembourser les frais de visite en cas d’annulation à temps — activé", "Une annulation avec assez de préavis rembourse les frais par Stripe, et le client en est informé avant de confirmer."],
              ["Préavis nécessaire pour être remboursé", "Peut être plus long que le préavis de modification : « déplaçable jusqu'à la veille, mais remboursé seulement avec deux jours de préavis ». Vide reprend le préavis de modification."],
            ],
          } },
          { warning: "Un remboursement retourne l'argent du client ; Stripe garde ses frais de traitement sur le paiement d'origine. Voir [[refunds|Remboursements]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Les réglages de la Page de rendez-vous sont réservés au propriétaire, aux administrateurs, aux gestionnaires et aux répartiteurs. Créditer des frais sur une facture demande **Payments** — par défaut un gestionnaire, un administrateur ou le propriétaire." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi ma visite payante s'affiche-t-elle comme gratuite sur la page de rendez-vous ?", a: "Stripe n'est pas connecté, ou les paiements ne sont pas encore activés. Les frais reviennent dès que Stripe signale les paiements activés." },
      { q: "Les frais peuvent-ils être payés par prélèvement bancaire ?", a: "Non. Les frais de réservation se paient par carte seulement. Le prélèvement bancaire est offert pour les forfaits de service en CAD." },
      { q: "Le client a payé mais je ne vois aucun rendez-vous.", a: "Attendez la vérification horaire, ou appuyez sur le bouton de vérification du paiement sur la carte d'attente du tableau de bord. Un paiement que Stripe confirme devient toujours un rendez-vous." },
    ],
  },

  "money-owed-and-receivables-aging": {
    title: "Argent dû et âge des comptes clients",
    summary:
      "Qui vous doit de l'argent, depuis combien de temps, et le bouton Relancer le paiement — comment le tableau de bord le compte et pourquoi il concorde avec la page de la facture et le bilan.",
    updated: "2026-09-12",
    intro: [
      "Le tableau de bord répond à deux questions que la liste des factures ne pose pas : qui vous doit de l'argent, et depuis combien de temps. Les factures en retard sont nommées en haut de la page avec un bouton **Relancer le paiement** ; la tuile **Argent dû** totalise ce qui est en souffrance ; et la carte **Argent dû** étale le même chiffre par âge — pas encore dû, 1 à 30, 31 à 60, 61 à 90, 90 jours et plus — avec chaque facture et son contact.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'argent dû se compte de la même façon partout : la dernière version de chaque facture, brouillons et documents annulés exclus, moins chaque paiement consigné dessus. C'est aussi la règle du bilan, et celle de la page de la facture — passez le statut d'une facture à Payée sans consigner le paiement et les trois continuent de dire qu'elle est due. L'absence n'est jamais un zéro : une entreprise sans facture lit **Aucune facture pour l'instant, alors rien ne vous est dû.**, et une entreprise entièrement payée lit **Rien en souffrance — toutes les factures que vous avez envoyées ont été réglées.**" },
          { figure: "live:app", caption: "Accueil — En attente de vous en haut avec la facture en retard et Relancer le paiement, les quatre tuiles, puis Le détail avec la carte Argent dû." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**En attente de vous** : la facture la plus en retard avec son client, **12 jours de retard**, et **Relancer le paiement** ; **3 autres en retard** quand il y en a d'autres.",
            "La tuile **Argent dû**, avec **4 120 $ de ce montant est en retard.** sous le total.",
            "Dans **Le détail**, la carte **Argent dû** : la légende **Réparti sur 5 factures impayées. Compte la dernière version de chaque facture, moins les paiements consignés dessus.**, puis l'échelle des âges — **Pas encore dû**, **1 à 30 jours**, **31 à 60 jours**, **61 à 90 jours**, **90 jours et plus**, et **Aucune date d'échéance** à part.",
            "Jusqu'à six factures, la plus ancienne en premier : numéro, client, **Échéance le 30 août 2026** ou **27 jours de retard**, **modifiée, v2** si elle a été modifiée après envoi, un lien **Chantier**, **Dernière relance le 5 sept. 2026 · 2×** ou **Rappel automatique envoyé le 3 sept. 2026**, et **Relancer le paiement**. Puis **4 de plus qui ne sont pas affichées ici**.",
            "Une ligne sur les rappels : **Un rappel automatique part 3 jours après la date d'échéance d'une facture.** avec **Le modifier**, ou **Aucun rappel automatique de retard n'est configuré…** avec **En configurer un**.",
          ] },
        ],
      },
      {
        id: "how-it-is-counted",
        heading: "Comment c'est compté",
        blocks: [
          { table: {
            head: ["Cas", "Comment il est traité"],
            rows: [
              ["Facture modifiée après envoi", "Une seule entrée, au total de la dernière version, datée de l'original. Marquée modifiée, v2."],
              ["Aucune date d'échéance", "Listée sous Aucune date d'échéance. Elle est due, mais pas en retard, et n'atterrit jamais dans une tranche de jours."],
              ["Jours de retard", "Des jours civils entiers après la date d'échéance, le même compte que la bannière de la page de la facture."],
              ["Facture payée en trop", "Pas dans le total. Nommée à part : « 1 facture a été payée en trop, de 180 $ au total. C'est de l'argent que vous détenez, pas de l'argent qui vous est dû. »"],
              ["Facture sans aucune date", "Comptée et nommée — « 1 facture ne porte aucune date et n'est pas comptée ci-dessus. » — jamais écartée en silence."],
              ["Brouillon ou annulée", "Pas un compte à recevoir. Pas affichée."],
            ],
          } },
        ],
      },
      {
        id: "chase-payment",
        heading: "Relancer le paiement",
        blocks: [
          { steps: [
            "Appuyez sur **Relancer le paiement** sur la facture — en haut du tableau de bord ou dans la carte Argent dû.",
            "Le client reçoit par courriel un rappel présenté comme un rappel, pas comme une nouvelle facture, avec un bouton Payer qui ouvre la facture dans son portail. La carte confirme : **Demande de paiement envoyée à jane@exemple.com à 9 h 42**.",
            "La facture le consigne : **Dernière relance le 12 sept. 2026 · 1×**, et le compte monte à chaque relance. La date d'envoi d'origine de la facture n'est jamais écrasée.",
          ] },
          { note: "Relancer exige un courriel de client au dossier ; le bouton le dit quand il n'y en a pas. Une facture saisie comme chantier passé n'est jamais relancée — rien n'est envoyé à un client pour un chantier passé." },
        ],
      },
      {
        id: "automatic-reminders",
        heading: "Les rappels automatiques",
        blocks: [
          { p: "Une règle de relance avec le déclencheur **Facture en retard** relance toute seule, un délai fixé après la date d'échéance, et le tableau de bord le dit en une phrase — ou dit clairement que rien ne relance ces factures tout seul. Chaque envoi automatique apparaît sur la ligne de la facture comme **Rappel automatique envoyé le** avec la date. Configurez la règle dans **Paramètres → Relances** : [[invoice-reminders-and-chasing|Rappels de facture et relances]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La tuile et la carte Argent dû exigent **Show Pricing** et le niveau Factures **View only** ; sans eux, le panneau est absent — pas de carte, pas de zéro. Appuyer sur **Relancer le paiement** exige **View, create, and edit** sur les Factures : un répartiteur, un gestionnaire, un administrateur ou le propriétaire. Un estimateur voit les chiffres et ne peut pas relancer." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la tuile ne concorde-t-elle pas avec En souffrance dans la liste des factures ?", a: "La tuile est l'argent dû ce matin, dernière version par facture moins les paiements ; la tuile de la liste totalise les soldes par statut. Un paiement consigné sans changer le statut apparaît ici en premier." },
      { q: "Une facture est marquée Payée mais s'affiche encore comme due.", a: "Aucun paiement n'a été consigné dessus. Consignez le paiement sur la facture — voir [[record-a-manual-payment|Consigner un paiement comptant, par chèque ou par virement]] — et elle disparaît des trois surfaces d'un coup." },
      { q: "Combien de factures la carte affiche-t-elle ?", a: "Six, la plus ancienne en premier, puis le compte du reste. La liste des factures les a toutes." },
    ],
  },
};
