// content/help/fr/invoices-and-payments-2.js
//
// Partie 2 de la catégorie « invoices-and-payments » en français (voir le
// composeur, invoices-and-payments.js). Même structure que l'anglais, article
// par article : mêmes slugs, mêmes sections dans le même ordre, mêmes blocs,
// mêmes figures — scripts/check-help-centre.mjs compare les deux. Les mots à
// l'écran viennent du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "payment-processing-fees-and-payouts": {
    title: "Frais de traitement des paiements et virements",
    summary:
      "Ce qu'un paiement par carte ou par débit bancaire vous coûte, comment les frais apparaissent sur chaque paiement, quand l'argent arrive dans votre banque et comment tout cela figure dans votre export comptable.",
    updated: "2026-09-12",
    intro: [
      "Quand un client paie une facture en ligne, le paiement passe par le compte Stripe de votre entreprise et atterrit dans votre compte bancaire. Des frais de traitement sont retenus sur chaque paiement avant d'y arriver — jamais facturés à part, et sans frais mensuel pour encaisser. Cet article raconte toute l'histoire de ces frais : les taux, où vous les voyez, ce qui se passe lors d'un remboursement ou d'un litige, et comment votre comptable les concilie.",
      "En bref : **3 % + 0,30 $** sur une carte, **1 % + 0,40 $ plafonné à 5 $** sur un débit bancaire canadien, **1 %** en option pour être viré sur-le-champ, et **15 $** si un client conteste un paiement. Tout le reste de cette page explique ces quatre chiffres.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque paiement en ligne d'un client est une transaction Stripe créée au nom de votre entreprise et versée dans votre compte bancaire. FieldQuo ne détient jamais l'argent. Les frais de traitement sont déduits du paiement lui-même : le client paie le total de la facture, les frais sont retenus, et le **net** est ce que Stripe dépose." },
          { p: "Vous verrez trois montants pour chaque paiement en ligne : le **montant** (ce que le client a payé et ce qui a été soustrait de la facture), les **frais de traitement**, et le **net déposé**. Ils figurent sur la facture, sur la fiche du paiement, et dans trois colonnes de l'export comptable." },
          { note: "Il n'y a ni pourboire ni produit de crédit ou de prêt dans FieldQuo. Si vous connaissez les pages d'aide de Jobber, ces deux sections n'ont pas d'équivalent ici : un client paie exactement la facture, et le seul argent qui bouge est celui de la facture." },
        ],
      },
      {
        id: "settings",
        heading: "Paramètres",
        blocks: [
          { p: "Les taux sont imprimés dans **Paramètres → Paiements** avant même que vous connectiez Stripe, pour qu'aucun frais ne soit une surprise au premier virement. La carte affiche chaque mode de paiement que Stripe tarifie dans votre devise, un exemple calculé sur un paiement par carte de 2 260 $ (68,10 $ de frais, 2 191,90 $ déposés) et les deux suppléments qui ne s'appliquent qu'à certaines cartes." },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — la carte des frais de traitement, le compte Stripe connecté et son état." },
          { steps: [
            "Ouvrez **Paramètres → Paiements**.",
            "Lisez la carte **Frais de traitement**. Les paiements par carte affichent 3 % + 0,30 $; les entreprises canadiennes voient aussi Débit bancaire (Canada) à 1 % + 0,40 $, max 5,00 $.",
            "Connectez Stripe (voir [[connect-stripe-and-get-verified|Connecter Stripe et faire vérifier son compte]]). Dès que Stripe signale que les encaissements sont activés, un bouton Payer apparaît sur chaque facture reçue par vos clients.",
          ] },
          { p: "Il n'y a rien à configurer pour les frais eux-mêmes. Ils sont les mêmes pour toutes les entreprises, ils ne peuvent pas être désactivés et ils ne peuvent pas être refilés au client sous forme de ligne de supplément : le total de la facture est ce que le client paie." },
        ],
      },
      {
        id: "payouts",
        heading: "Comment savoir qu'un paiement a atteint votre banque",
        blocks: [
          { p: "Stripe vire votre solde vers votre banque selon son calendrier standard — gratuit, en environ **2 jours ouvrables** pour un compte canadien ou américain. FieldQuo affiche le paiement comme **Payée** dès que Stripe confirme la transaction; le virement vers votre banque suit au rythme de Stripe." },
          { steps: [
            "Sur la facture, la ligne du paiement indique la date, le mode, le montant et, dessous, les frais et le net déposé.",
            "Pour voir le virement lui-même — le transfert vers votre banque — ouvrez **Paramètres → Paiements → Gérer dans Stripe**. Le tableau de bord Express de Stripe liste chaque virement avec sa date d'arrivée et les paiements qu'il contient.",
            "La ligne sur votre relevé bancaire correspondra au **net déposé**, jamais au montant brut.",
          ] },
          { tip: "Si un paiement est Payée dans FieldQuo mais que rien n'est arrivé après quelques jours ouvrables, c'est en général que Stripe retient ou vérifie le compte — voir [[payouts-held-or-under-review|Virements retenus ou en vérification]]. La page Paiements le dit en toutes lettres quand c'est le cas." },
        ],
      },
      {
        id: "payments",
        heading: "Paiements",
        blocks: [
          { p: "Un client paie depuis le bouton Payer du courriel de facture ou depuis son espace client. Les modes offerts dépendent de votre devise : la carte partout, et le débit préautorisé pour les entreprises canadiennes qui facturent en dollars canadiens." },
          { p: "Sur chaque paiement, FieldQuo enregistre les frais au taux publié, et la ligne du paiement sur la facture se lit, par exemple, **« frais carte 68,10 $ · déposé 2 191,90 $ »**. Un paiement que vous enregistrez à la main — comptant, chèque, virement Interac — ne porte aucuns frais et n'en affiche aucun." },
          { figure: "live:app-invoices", caption: "Factures — Impayé, Payée et Total facturé, puis chaque facture avec son état et son solde." },
          { p: "Le financement en plusieurs versements (Affirm), si vous l'activez, est tarifé par Affirm plutôt qu'au taux carte; ces frais sont refacturés sur ces paiements de la même façon." },
        ],
      },
      {
        id: "instant-payouts",
        heading: "Virements instantanés",
        blocks: [
          { p: "Au lieu d'attendre le calendrier standard, vous pouvez transférer votre solde Stripe disponible sur une **carte de débit** en environ 30 minutes, tous les jours, à toute heure. Cela coûte **1 %** du montant (minimum 0,50 $) — la tarification de Stripe, refacturée au coût. FieldQuo n'en garde rien." },
          { steps: [
            "Ouvrez **Paramètres → Paiements** et trouvez la carte **Virement instantané**.",
            "Elle affiche ce qui est disponible maintenant, les frais et ce que vous recevrez. Appuyez sur **Virer … maintenant** et confirmez.",
            "L'argent arrive sur la carte de débit enregistrée chez Stripe, habituellement en 30 minutes; votre banque peut le retarder.",
          ] },
          { note: "Le virement instantané exige un compte Stripe d'au moins **30 jours**, les virements activés et une carte de débit au dossier. Un compte bancaire ne reçoit que les virements standards — ajoutez une carte de débit dans votre tableau de bord Stripe pour utiliser les instantanés. Tous les détails : [[instant-payouts|Virements instantanés]]." },
        ],
      },
      {
        id: "fees",
        heading: "Frais",
        blocks: [
          { table: {
            head: ["Mode de paiement", "Frais", "Devise"],
            rows: [
              ["Carte (Visa, Mastercard, Amex, cartes d'entreprise comprises)", "3 % + 0,30 $", "CAD et USD"],
              ["Débit bancaire — débit préautorisé (Canada)", "1 % + 0,40 $, plafonné à 5,00 $ par paiement", "CAD"],
              ["Virement instantané (facultatif)", "1 % du virement, minimum 0,50 $", "CAD et USD"],
              ["Litige (rétrofacturation)", "15 $ par litige, non remboursés si vous gagnez", "CAD et USD"],
            ],
          } },
          { p: "Le taux carte est un seul chiffre quelle que soit la carte : une carte d'entreprise ou une Amex coûte les mêmes 3 % + 0,30 $ qu'une Visa de particulier. C'est 2,9 % + 0,30 $ pour Stripe plus une marge FieldQuo de 0,1 %, et vous voyez partout un seul taux combiné — sur la page des paramètres, sur la fiche du paiement et dans l'export." },
          { p: "Deux suppléments ne s'appliquent que lorsqu'ils s'appliquent, parce que la carte est inconnue tant qu'elle n'est pas débitée : **+0,8 %** sur une carte émise hors du Canada, et **+2 %** quand le paiement exige une conversion de devise. Ils sont refacturés au coût de Stripe sur ce paiement seulement. Le débit bancaire n'a aucun supplément." },
          { p: "Une **facture de 5 000 $ payée par débit bancaire coûte 5 $** — le plafond — là où la même facture par carte coûte 150,30 $. Pour les grosses factures de clients canadiens, offrir le débit bancaire est la plus grande économie de cette page." },
          { p: "Stripe facture aussi de petits frais de compte : des **frais mensuels de compte actif** les mois où vous encaissez, et **0,25 % + 0,25 $ par virement** vers votre banque. Ils sont refacturés au coût et apparaissent sur leur propre ligne lors de votre prochain paiement — « Frais de compte Stripe 2,25 $ (2026-09) » — jamais fondus dans les frais de traitement." },
        ],
      },
      {
        id: "refunds",
        heading: "Remboursements",
        blocks: [
          { p: "Un remboursement rend l'argent au client par Stripe. Les frais de traitement ne sont **pas remboursés** : Stripe garde ses frais sur une transaction remboursée, et les frais déjà déduits restent déduits. La fiche du paiement continue d'afficher les frais d'origine, et le remboursement apparaît dans votre tableau de bord Stripe sur la même transaction." },
          { warning: "Remboursez le montant de la facture, pas le net. Un client qui a payé 2 260 $ s'attend à recevoir 2 260 $; les 68,10 $ de frais sont votre coût pour avoir encaissé le paiement." },
        ],
      },
      {
        id: "disputes",
        heading: "Litiges",
        blocks: [
          { p: "Quand un titulaire de carte conteste un paiement, Stripe retient le montant contesté et des **frais de litige de 15 $** tant que le litige est ouvert. FieldQuo sort les deux de votre solde — le montant comme retenue, les frais comme frais — et la facture affiche une ligne du genre **« Litige — 2 260,00 $ retenus, 15,00 $ de frais »**. Vous répondez au litige dans votre tableau de bord Stripe avec vos preuves : la soumission signée, les photos, la liste de fin de chantier." },
          { bullets: [
            "**Si vous gagnez**, le montant retenu vous revient. Stripe ne rembourse pas les 15 $ de frais de litige, et la facture le dit : « Litige gagné — 2 260,00 $ rendus. Stripe ne rembourse pas les frais de litige de 15,00 $. »",
            "**Si vous perdez**, le montant retenu est parti et les frais restent : « Litige perdu — 2 260,00 $ repris, 15,00 $ de frais ».",
          ] },
          { note: "Un litige ne peut reprendre que ce que le paiement vous a transféré. Si le montant contesté plus les frais dépassent le net que vous avez reçu, la différence est consignée plutôt qu'absorbée en silence — vous la verrez, et le soutien aussi." },
        ],
      },
      {
        id: "negative-balances",
        heading: "Soldes négatifs",
        blocks: [
          { p: "Votre solde Stripe peut devenir négatif après un litige ou un remboursement plus grand que ce qui est disponible. Stripe récupère un solde négatif sur vos **prochains paiements** avant de virer quoi que ce soit et, pour les frais de compte Connect ci-dessus, FieldQuo ajoute ce qui reste dû à votre prochaine transaction sur sa propre ligne — plafonné pour que les frais ne dépassent jamais le paiement, le reste étant reporté au paiement suivant." },
          { p: "Une entreprise qui cesse d'encaisser garde son solde impayé dans les livres; rien n'est radié en silence." },
        ],
      },
      {
        id: "errors",
        heading: "Erreurs",
        blocks: [
          { bullets: [
            "**« Stripe retient votre argent »** dans Paramètres → Paiements — Stripe a encore besoin de quelque chose de vous (un document, un compte bancaire, le nom d'un administrateur). Ouvrez **Gérer dans Stripe** et complétez ce qui est demandé; les paiements de vos clients continuent d'aboutir entre-temps.",
            "**« Stripe vérifie votre compte »** — vous avez tout envoyé et Stripe vérifie, en général un jour, parfois deux ou trois. Rien à faire.",
            "**Un paiement sans frais affichés** — c'est un paiement manuel, ou un paiement en ligne enregistré avant que les frais soient notés sur le paiement. L'export laisse ces cellules vides plutôt que d'écrire 0,00, parce que « frais inconnus » et « aucuns frais » sont deux affirmations différentes.",
            "**Le bouton Payer manque sur une facture** — Stripe n'a pas encore activé les encaissements. Paramètres → Paiements indique ce qu'il attend.",
          ] },
        ],
      },
      {
        id: "accounting-export",
        heading: "Comment cela figure dans votre export comptable",
        blocks: [
          { p: "L'export comptable (**Dépenses → Export comptable**) produit des fichiers CSV pour une période, et le fichier des paiements contient une ligne par paiement avec trois colonnes d'argent : **Amount** (le brut — ce que le client a payé et ce qui a été soustrait de la facture), **Processing fee** et **Net deposited**, plus une colonne **Fee rate** qui nomme le mode selon lequel les frais ont été pris (« card », « acss_debit »)." },
          { figure: "live:app-settings-expense-tracking", caption: "Suivi des dépenses — la carte Export comptable, au bas de la page, télécharge la période en fichiers CSV." },
          { p: "Comptabilisez le brut en revenu et les frais en dépense de frais marchands à partir de la même ligne; le flux bancaire correspond alors au **Net deposited**. Le fichier des totaux additionne les frais de traitement par code de taxe séparément du revenu, de sorte que les frais sont une dépense dans vos livres, pas une vente plus petite." },
          { p: "Les paiements sont filtrés sur la **date du paiement lui-même**, pas celle de la facture — une facture de décembre payée en janvier est de l'argent de janvier. Les colonnes de frais sont vides pour les paiements manuels et pour les paiements en ligne encaissés avant que les frais soient notés sur le paiement." },
          { tip: "Pour importer dans QuickBooks en ligne ou Xero : associez Amount → revenu, Processing fee → frais marchands, Net deposited → le dépôt bancaire. Voir [[the-accounting-export|L'export comptable]] et [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero et votre comptable]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je refiler les frais au client?", a: "Pas sous forme de supplément distinct — le total de la facture est ce que le client paie et les frais sont retenus de votre côté. Fixez le prix du chantier en tenant compte des frais, ou offrez le débit bancaire aux clients canadiens, plafonné à 5 $." },
      { q: "Y a-t-il des frais mensuels pour encaisser des paiements?", a: "Non. Stripe facture de petits frais de compte actif seulement les mois où vous encaissez, et ils apparaissent sur leur propre ligne lors de votre prochain paiement." },
      { q: "Pourquoi mon relevé bancaire ne correspond-il pas au montant de la facture?", a: "La banque reçoit le net déposé — le montant moins les frais de traitement. La facture et l'export affichent les deux chiffres." },
      { q: "FieldQuo détient-il mon argent?", a: "Jamais. La transaction est créée au nom de votre entreprise et Stripe vire directement dans votre banque." },
    ],
  },

  "bank-debit-in-canada": {
    title: "Débit bancaire au Canada : 1 % plafonné à 5 $",
    summary:
      "Où le débit préautorisé est offert, ce qu'il coûte, combien de temps un débit met à passer, et pourquoi le plafond de 5 $ est la façon la moins chère d'encaisser une grosse facture récurrente.",
    updated: "2026-09-12",
    intro: [
      "Un client canadien inscrit à un forfait de service peut payer par débit préautorisé directement depuis son compte bancaire plutôt que par carte. Les frais sont de **1 % + 0,40 $, plafonnés à 5,00 $** par paiement — un débit de 5 000 $ vous coûte donc 5 $, là où le même montant par carte coûte 150,30 $. Le débit bancaire est refacturé au coût de Stripe; FieldQuo n'y ajoute rien.",
      "Cet article dit exactement où le débit bancaire est offert (les forfaits de service facturés en dollars canadiens, pas le bouton Payer d'une facture ponctuelle), ce que le client accepte, combien de temps un débit met à passer, et comment les frais figurent sur la facture et dans votre export comptable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le débit bancaire dans FieldQuo est le débit préautorisé canadien (DPA) par Stripe. Le client enregistre son compte bancaire une seule fois, sur une page hébergée par Stripe, et accepte par écrit une série de paiements d'un montant fixe à une fréquence fixe. Ensuite, chaque échéance du forfait est prélevée sans que le client fasse quoi que ce soit, et chaque prélèvement produit une facture qu'il peut voir dans son espace client." },
          { p: "Il est offert seulement quand l'entreprise facture en **CAD**. Stripe exige que la devise du débit corresponde au compte bancaire canadien du client; une entreprise qui facture en dollars américains ne voit que la carte comme mode automatique." },
          { note: "Le débit bancaire n'est pas offert sur le bouton Payer d'une facture ordinaire. Ce paiement accepte les cartes (et Affirm, si vous avez activé le paiement échelonné). Le débit bancaire vit sur les forfaits de service avec prélèvement automatique — voir [[service-plans|Forfaits de service]]." },
        ],
      },
      {
        id: "where-it-is-offered",
        heading: "Où le débit bancaire est offert",
        blocks: [
          { p: "Le choix revient au client, pas à vous : quand vous demandez à un client d'autoriser un forfait, la page de Stripe propose une carte ou, pour une entreprise en CAD, un compte bancaire, et le client choisit. Voici le chemin de votre côté." },
          { steps: [
            "Ouvrez **Forfaits** et créez le forfait en choisissant **Prélever automatiquement** sous **Mode de paiement**.",
            "Enregistrez-le. Le forfait affiche **Prélèvement automatique demandé, mais le client n'a pas encore accepté** tant que le client n'a pas agi. Appuyez sur **Demander au client d'autoriser les paiements** pour lui envoyer le lien par courriel.",
            "Le client lit les conditions d'autorisation sur sa propre page, coche la case et arrive sur la page de Stripe, qui propose **carte** ou **compte bancaire**. Pour un compte bancaire, Stripe affiche sa propre entente de débit préautorisé et en envoie une copie au client par courriel.",
            "Une fois le compte enregistré, le forfait affiche **Prélèvement automatique — débit bancaire**, avec la date à laquelle le client l'a autorisé. D'ici là, il facture chaque visite, exactement comme un forfait sans mandat.",
          ] },
          { figure: "live:app-plans", caption: "Forfaits — chaque forfait avec sa fréquence, son mode de paiement et la prochaine étape." },
          { note: "Le texte d'autorisation n'existe qu'en anglais et en français. Un client dont la langue n'est ni l'une ni l'autre ne se voit pas offrir le prélèvement automatique du tout : son forfait envoie plutôt une facture avec un lien de paiement à chaque visite. Tous les détails : [[service-plan-bank-debit-mandates|Forfaits payés par débit bancaire : le mandat]]." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Ce que cela coûte",
        blocks: [
          { table: {
            head: ["Montant prélevé", "Frais de débit bancaire", "Le même montant par carte"],
            rows: [
              ["200 $", "2,40 $", "6,30 $"],
              ["460 $", "5,00 $ (le plafond)", "14,10 $"],
              ["5 000 $", "5,00 $ (le plafond)", "150,30 $"],
            ],
          } },
          { p: "Les frais sont déduits du prélèvement avant que l'argent atteigne votre banque, comme pour une carte. La ligne du paiement sur la facture se lit, par exemple, **« frais débit bancaire 5,00 $ · déposé 4 995,00 $ »**, et l'export comptable inscrit le mode « acss_debit » dans sa colonne **Fee rate**. Il n'y a aucun supplément international ni de conversion de devise sur le débit bancaire." },
          { tip: "Le plafond est atteint à 460 $. Au-delà, chaque dollar de plus qu'un client paie par débit bancaire est sans frais — c'est pourquoi un forfait d'entretien trimestriel ou annuel est l'endroit où l'offrir." },
        ],
      },
      {
        id: "how-a-debit-settles",
        heading: "Comment un débit passe",
        blocks: [
          { p: "Un paiement par carte a sa réponse en quelques secondes. Un débit bancaire est accepté sur-le-champ, mais l'argent circule ensuite dans le système bancaire et met environ **5 jours ouvrables** à passer." },
          { bullets: [
            "Pendant le transit, l'échéance du forfait s'affiche comme en cours de prélèvement et la facture n'est **pas** marquée payée — FieldQuo n'affiche pas une facture réglée sur de l'argent qui n'est pas arrivé. Stripe envoie au client l'avis de prélèvement que le mandat exige.",
            "Quand le débit passe, la facture devient **Payée** et le client reçoit un reçu de votre entreprise par courriel.",
            "Si la banque le retourne (fonds insuffisants, compte fermé), l'échéance est marquée échouée et le client reçoit la facture avec un lien de paiement par courriel : la visite reste facturée et peut encore être payée par carte.",
          ] },
          { warning: "Un compte bancaire qui attend encore la vérification par microdépôts n'est pas encore un mandat. FieldQuo n'enregistre l'autorisation que lorsque Stripe confirme la configuration terminée; un forfait peut donc afficher « Le client a accepté mais n'a pas encore enregistré de moyen de paiement » pendant un jour ou deux, le temps que le client confirme les dépôts." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Ce que les autres logiciels ne font pas",
        blocks: [
          { p: "Les pages de comparaison de FieldQuo consignent ce que la page de tarifs de chaque concurrent affiche, avec la date de lecture. La page de Jobber, lue le 2026-09-12, tarifie les paiements bancaires à 1 % du montant sans plafond, et les cartes à 2,9 % + 0,30 $. Le taux carte de FieldQuo est d'un dixième de point plus élevé — 3 % + 0,30 $ — et son débit bancaire s'arrête à 5,00 $ par paiement." },
          { p: "L'avantage est donc le plafond, pas le taux carte. Sur une facture de 5 000 $ payée depuis un compte bancaire, la différence est de 45 $; sur une facture de 200 $, il n'y en a aucune. Dites-le ainsi, parce que c'est ce que disent les deux pages de tarifs." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le mettre en place",
        blocks: [
          { p: "Les forfaits de service sont rangés sous Factures dans la grille d'accès : quiconque voit les factures voit les forfaits. Créer un forfait et envoyer le lien d'autorisation exige l'accès en modification aux factures **et** l'option **paiements** — le niveau Gestionnaire et plus, et tout accès personnalisé qui a les deux. Les frais eux-mêmes ne sont pas un paramètre; personne ne peut les changer." },
        ],
      },
    ],
    faq: [
      { q: "Un client peut-il payer une facture ponctuelle par débit bancaire?", a: "Non. Le bouton Payer d'une facture accepte les cartes, plus Affirm si vous offrez le financement. Le débit bancaire passe par un forfait de service que le client a autorisé." },
      { q: "Le plafond de 5 $ est-il par paiement ou par mois?", a: "Par paiement. Deux débits de 5 000 $ dans le même mois coûtent 5 $ chacun." },
      { q: "Pourquoi la facture est-elle encore impayée deux jours après le débit?", a: "Un débit bancaire met environ cinq jours ouvrables à passer. La facture est marquée payée quand l'argent arrive vraiment, pas quand le débit est demandé." },
    ],
  },

  "instant-payouts": {
    title: "Virements instantanés",
    summary:
      "Transférez votre solde Stripe disponible sur une carte de débit en environ 30 minutes pour des frais de 1 %, au lieu d'attendre deux jours ouvrables pour le virement standard.",
    updated: "2026-09-12",
    intro: [
      "Stripe vire votre solde vers votre banque selon son calendrier standard — gratuit, en environ 2 jours ouvrables. Quand il vous faut l'argent aujourd'hui, la carte **Virement instantané** de **Paramètres → Paiements** envoie ce qui est disponible sur une carte de débit en environ 30 minutes, tous les jours, à toute heure, pour **1 %** du montant (minimum 0,50 $). C'est la tarification de Stripe, refacturée au coût; FieldQuo n'en garde rien.",
      "Cet article, c'est la carte elle-même : ce qu'elle affiche, ce que fait le bouton, les conditions que Stripe y met, et chaque raison pour laquelle elle peut dire non.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un virement instantané est un virement Stripe dont le mode est réglé sur instantané, envoyé sur la carte de débit de votre compte Stripe. Ce n'est ni un prêt ni une avance : il déplace de l'argent qui est déjà à vous — des paiements passés dans votre solde Stripe — plus tôt que le calendrier standard ne le ferait." },
          { p: "Le montant est toujours la totalité du net que Stripe déclare disponible à cet instant. Il n'y a pas de champ de montant, et c'est voulu : FieldQuo ne laisse jamais un navigateur envoyer une somme d'argent, et un virement instantané partiel serait un deuxième produit. Une pression vire tout ce qui peut partir." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "Ce qu'il y a sur la carte",
        blocks: [
          { p: "La carte se trouve dans **Paramètres → Paiements** une fois Stripe connecté. De haut en bas, elle affiche :" },
          { bullets: [
            "**Virement instantané** et une phrase qui énonce les frais avant tout bouton — les règles de Stripe exigent que les frais soient bien visibles, alors c'est une phrase, pas une infobulle.",
            "**Disponible maintenant** — le solde brut que Stripe peut virer sur-le-champ, dans votre devise.",
            "**Frais** — ce que Stripe prendra, avec le pourcentage que cela représente (par exemple « 12,40 $ (1 %) »).",
            "**Vous recevrez** — le net qui atteindra la carte, et **Vers votre carte de débit se terminant par ····**.",
            "**Virer … maintenant** — le bouton, avec le montant net dans son libellé.",
            "**Virements instantanés récents** — les derniers virements envoyés d'ici, avec leurs dates et montants.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Comment en envoyer un",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements** et trouvez la carte **Virement instantané**.",
            "Vérifiez **Disponible maintenant**, **Frais** et **Vous recevrez**. Chaque chiffre vient de Stripe à cet instant.",
            "Appuyez sur **Virer … maintenant**. Une ligne de confirmation répète les trois chiffres — « Virer 1 240,00 $ maintenant · frais 12,40 $ · vous recevez 1 227,60 $ ».",
            "Appuyez sur **Confirmer le virement**. La carte affiche **Envoyé. Stripe prévoit l'arrivée sur votre carte d'ici environ 30 minutes.**",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — le compte Stripe connecté; la carte Virement instantané apparaît dessous dès que le compte y a droit." },
          { note: "L'argent arrive sur la carte de débit enregistrée chez Stripe, habituellement en 30 minutes; votre banque peut le retarder. Une deuxième pression pendant que le premier virement s'envoie encore est refusée avec « Un virement est déjà en cours d'envoi. »" },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Ce que cela coûte",
        blocks: [
          { table: {
            head: ["Virement", "Frais", "Arrivée"],
            rows: [
              ["Virement standard vers votre banque", "Gratuit", "Environ 2 jours ouvrables"],
              ["Virement instantané sur une carte de débit", "1 % du montant, minimum 0,50 $", "Environ 30 minutes"],
            ],
          } },
          { p: "La carte imprime les frais que Stripe a réellement déclarés pour ce virement à côté du 1 % publié; si le chiffre de Stripe diffère un jour du taux annoncé, vous voyez le chiffre de Stripe — et c'est celui-là que vous obtenez." },
        ],
      },
      {
        id: "when-it-is-refused",
        heading: "Quand la carte dit non",
        blocks: [
          { p: "L'admissibilité est décidée à partir des réponses de Stripe, pas de ce que FieldQuo conserve. Chaque refus est imprimé sur la carte en mots simples :" },
          { bullets: [
            "**Connectez d'abord Stripe.** — pas encore de compte Stripe.",
            "**Disponible dès que votre compte Stripe peut accepter des paiements.** — Stripe n'a pas activé les encaissements.",
            "**Stripe n'a pas encore activé les virements sur ce compte.** — les virements sont suspendus; voir [[payouts-held-or-under-review|Virements retenus ou en vérification]].",
            "**Disponible dès que votre compte Stripe aura 30 jours. Le vôtre a 12 jours.** — un compte récent ne peut pas virer sur-le-champ. Trente jours, c'est la fenêtre « nouveau compte » de Stripe pour le risque de virement, et FieldQuo, comme plateforme, porte la responsabilité d'un solde négatif sur un jeune compte.",
            "**Les virements instantanés vont sur une carte de débit. Un compte bancaire ne reçoit que les virements habituels — ajoutez une carte de débit dans votre tableau de bord Stripe.** — au Canada surtout, un compte bancaire ne reçoit que les virements standards. La carte propose **Ajouter une carte de débit dans Stripe**.",
            "**Rien n'est disponible pour un virement instantané en ce moment.** — le solde est à zéro, ou encore en attente.",
          ] },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Qui peut l'utiliser",
        blocks: [
          { p: "Les propriétaires et les administrateurs — les mêmes personnes qui peuvent ouvrir **Paramètres → Paiements**. Une session de soutien en lecture seule voit la carte mais ne peut pas appuyer sur le bouton. Chaque virement est consigné avec le nom de qui l'a envoyé." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je virer une partie du solde?", a: "Non. Le bouton vire la totalité du net que Stripe déclare disponible. Pour en garder une partie dans le solde, attendez plutôt le virement standard." },
      { q: "Un virement instantané coûte-t-il quelque chose à FieldQuo, ou lui rapporte-t-il quelque chose?", a: "Ni l'un ni l'autre. Stripe facture 1 % et FieldQuo le refacture au coût." },
      { q: "Mon compte bancaire est au dossier. Pourquoi ne puis-je pas virer sur-le-champ?", a: "Les virements instantanés vont sur une carte de débit, pas sur un compte bancaire. Ajoutez une carte de débit dans votre tableau de bord Stripe — la carte de la page des paramètres y mène directement." },
    ],
  },

  "payouts-held-or-under-review": {
    title: "Virements retenus ou en vérification",
    summary:
      "Pourquoi les paiements des clients peuvent continuer d'aboutir alors que rien n'atteint votre banque, comment Paramètres → Paiements vous dit lequel des deux cas s'applique, et quoi faire dans chacun.",
    updated: "2026-09-12",
    intro: [
      "Encaisser des paiements et être payé sont deux interrupteurs différents sur un compte Stripe. Stripe peut continuer d'accepter les cartes de vos clients tout en retenant l'argent, et de l'intérieur de l'application tout semble fonctionner — les factures passent à **Payée**, le solde grossit, et rien n'arrive. **Paramètres → Paiements** le dit désormais dans une bannière ambre dès que Stripe signale les virements suspendus, et vous dit si l'attente dépend de vous ou de Stripe.",
      "Cet article, c'est cette bannière, la carte du compte dessous, et les raisons que Stripe donne.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque fois que vous ouvrez **Paramètres → Paiements**, FieldQuo demande à Stripe l'état réel de votre compte : si les encaissements sont activés, si les virements sont activés, ce qui manque encore, ce qui est en vérification, et la raison donnée par Stripe si le compte est restreint. Rien ici n'est gardé en cache d'un autre jour." },
          { p: "Les virements s'arrêtent pour deux raisons qui appellent des gestes opposés : Stripe **attend quelque chose de vous** (un document, un compte bancaire, le nom d'un administrateur), ou Stripe **vérifie ce que vous avez déjà envoyé**. Distinguer les deux est tout l'intérêt de la bannière — inviter quelqu'un à « fournir plus de renseignements » pendant que Stripe les examine, c'est ainsi que le même document se fait téléverser quatre fois." },
        ],
      },
      {
        id: "the-two-banners",
        heading: "Les deux bannières",
        blocks: [
          { bullets: [
            "**Stripe retient votre argent** — « Les paiements de vos clients passent, mais Stripe ne versera rien sur votre compte tant qu'il n'aura pas ce qu'il vous demande encore. Ouvrez Gérer dans Stripe ci-dessous et complétez ce qui manque. » Dessous, la raison de Stripe quand il en a donné une.",
            "**Stripe vérifie votre compte** — « Vous leur avez envoyé tout ce qu'ils demandaient. Les virements vers votre banque sont suspendus jusqu'à la fin de la vérification — en général un jour, parfois deux ou trois. Les paiements de vos clients continuent d'aboutir, et vous n'avez rien à faire. »",
          ] },
          { p: "La bannière n'apparaît que sur un compte actif — un compte dont les encaissements sont activés. Tant que les encaissements sont désactivés, il n'y a pas d'argent à retenir, et le bloc de configuration au-dessus dit déjà ce qui n'est pas terminé." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "La carte « Votre compte Stripe »",
        blocks: [
          { p: "Sous la connexion, les propriétaires voient une carte intitulée **Votre compte Stripe**. Elle existe parce qu'une personne dont les virements étaient retenus ne pouvait pas, avant, identifier son propre compte auprès de l'entreprise qui retenait son argent. Elle affiche :" },
          { bullets: [
            "**Identifiant de compte Stripe** avec un bouton de copie, et le **Courriel de connexion** auquel Stripe envoie le code de connexion Express.",
            "**Ce que Stripe a activé** — **Encaissement par carte : Activé / Désactivé** et **Versements à votre banque : Activé / Suspendu**.",
            "**Ce que Stripe attend encore** — chaque élément manquant en mots simples, en anglais (une photo de votre pièce d'identité, un compte bancaire pour les virements, votre numéro d'entreprise), avec la **Date limite de Stripe** quand il y en a une; ou « Rien de votre part. Stripe vérifie ce que vous avez déjà envoyé; le renvoyer n'accélérera rien. »",
          ] },
          { note: "Cette carte est réservée au propriétaire : l'identifiant de compte et le courriel de connexion sont la moitié « identifiants » de la relation bancaire de l'entreprise. Les administrateurs voient la bannière et la connexion, mais pas cette carte. La liste complète de ce que Stripe demande, et pourquoi, se trouve dans [[what-stripe-asks-for-and-why|Ce que Stripe demande, et pourquoi]]." },
        ],
      },
      {
        id: "how-to-clear-a-hold",
        heading: "Comment lever une retenue",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paiements** et lisez la bannière. Si elle dit **vérifie**, arrêtez-vous ici — il n'y a rien à envoyer.",
            "Si elle dit **retient**, lisez **Ce que Stripe attend encore** sur la carte du compte, pour savoir quoi préparer.",
            "Appuyez sur **Gérer dans Stripe**. Le tableau de bord Express de Stripe s'ouvre avec une bannière d'avis qui rassemble exactement ces éléments et les réglages qui les satisfont.",
            "Fournissez ce qui est demandé. Revenez à **Paramètres → Paiements**; la page relit Stripe à chaque chargement, alors la bannière passe à **vérifie** dès que Stripe a reçu votre envoi, et disparaît quand les virements sont rétablis.",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — le compte connecté, ses interrupteurs et ce que Stripe attend encore." },
          { tip: "Si le tableau de bord de Stripe ne peut vraiment pas régler la situation, l'assistance de Stripe s'atteint depuis ce tableau de bord une fois connecté. Donnez-leur l'identifiant de compte de la carte — c'est ce qui identifie votre compte auprès d'eux. FieldQuo ne peut pas lever une retenue; le compte est le vôtre, à votre nom." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "Les raisons que Stripe donne",
        blocks: [
          { p: "Quand Stripe restreint un compte, il envoie un code machine. FieldQuo imprime la phrase qui lui correspond plutôt que le code — ces phrases, comme la liste des éléments manquants, s'affichent en anglais à l'écran; voici ce qu'elles veulent dire :" },
          { table: {
            head: ["Ce que la page dit", "Ce que cela veut dire"],
            rows: [
              ["Stripe attend des renseignements maintenant en retard.", "Un élément de la liste a dépassé sa date limite. Fournissez-le et les virements reprennent après vérification."],
              ["Stripe vérifie encore ce que vous avez envoyé. Il n'y a rien à faire.", "Vérification en cours — le cas « vérifie »."],
              ["Stripe vérifie le compte.", "Une vérification manuelle, sans élément manquant. En général un jour ou trois."],
              ["Stripe vérifie une possible correspondance avec une liste de sanctions.", "Un nom a correspondu à une liste de surveillance. Stripe règle la question; il peut demander une pièce d'identité."],
              ["Stripe a fermé le compte pour fraude soupçonnée / pour violation des conditions d'utilisation / après une correspondance avec une liste de sanctions.", "Le compte est fermé. Seul Stripe peut le rouvrir — contactez-le depuis le tableau de bord."],
              ["FieldQuo a suspendu ce compte.", "Une suspension par la plateforme. Contactez le soutien de FieldQuo."],
            ],
          } },
        ],
      },
      {
        id: "what-keeps-working",
        heading: "Ce qui continue de fonctionner pendant la suspension des virements",
        blocks: [
          { p: "Tout, du côté du client. Les boutons Payer fonctionnent, les transactions aboutissent, les factures passent à **Payée**, et les frais de traitement sont toujours retenus au taux publié. L'argent reste dans votre solde Stripe et est viré, selon le calendrier standard, dès que les virements sont réactivés — rien n'est perdu et rien n'a besoin d'être renvoyé. Les virements instantanés sont refusés tant que les virements sont suspendus." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "**Paramètres → Paiements** est réservé aux propriétaires et aux administrateurs. La carte **Votre compte Stripe**, avec l'identifiant et le courriel de connexion, est réservée au propriétaire. Une session de soutien en lecture seule voit tout ce qu'il y a sur la page, cette carte comprise, parce que « pourquoi l'argent de cette entreprise est-il retenu » est la raison la plus fréquente d'ouvrir une session de soutien — et elle ne peut rien modifier." },
        ],
      },
    ],
    faq: [
      { q: "Mes clients ont payé il y a une semaine et ma banque n'affiche rien. L'argent est-il perdu?", a: "Non. Ouvrez Paramètres → Paiements : si la bannière ambre est là, Stripe retient le solde jusqu'à ce qu'il ait ce qu'il lui faut, ou pendant qu'il vérifie. Il vire dès que les virements sont réactivés." },
      { q: "FieldQuo peut-il libérer l'argent?", a: "Non. Le compte Stripe est le vôtre, à votre nom; FieldQuo ne détient jamais l'argent et ne peut pas lever une retenue. Le tableau de bord de Stripe, et l'assistance de Stripe depuis ce tableau de bord, sont les seuls leviers." },
      { q: "Devrais-je téléverser le document de nouveau pour accélérer les choses?", a: "Pas si la page dit que Stripe vérifie. Le renvoyer n'accélérera rien et remet souvent la demande au bout de la file." },
    ],
  },

  "refunds": {
    title: "Remboursements",
    summary:
      "Comment rendre un paiement en ligne à un client par Stripe, ce que FieldQuo enregistre quand vous le faites, et pourquoi les frais de traitement restent déduits.",
    updated: "2026-09-12",
    intro: [
      "Un remboursement rend tout ou partie d'un paiement en ligne sur la carte ou le compte bancaire du client. Vous l'émettez dans votre tableau de bord Stripe — il n'y a pas de bouton de remboursement dans FieldQuo — et FieldQuo l'enregistre dès que Stripe le signale : la ligne du paiement, le solde et l'état de la facture, et une notification aux personnes qui s'occupent des paiements.",
      "Les frais de traitement ne sont pas remboursés. Stripe garde ses frais sur une transaction remboursée, alors les frais déjà déduits restent déduits. Remboursez le montant que le client a payé, pas le net que vous avez reçu.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque paiement en ligne est une transaction Stripe au nom de votre entreprise. La rembourser est un geste Stripe, fait depuis le tableau de bord Express derrière **Gérer dans Stripe**, pour le montant complet ou une partie, une fois ou plusieurs. FieldQuo écoute la confirmation de Stripe et met la facture à jour — il n'émet jamais un remboursement de facture de lui-même, et il ne sort jamais d'argent de votre solde sans que Stripe lui dise que le remboursement a eu lieu." },
          { note: "Il y a un remboursement que FieldQuo émet lui-même : les frais de visite d'une réservation, rendus quand un client annule une visite dans le délai d'avis que vous avez fixé. C'est une règle à part — voir [[booking-fees-and-visit-deposits|Frais de réservation et acomptes de visite]]." },
        ],
      },
      {
        id: "how-to-refund",
        heading: "Comment rembourser un paiement en ligne",
        blocks: [
          { steps: [
            "Ouvrez la facture et notez la date et le montant du paiement sur sa ligne.",
            "Ouvrez **Paramètres → Paiements** et appuyez sur **Gérer dans Stripe**.",
            "Dans le tableau de bord de Stripe, ouvrez le paiement et remboursez-le — le montant complet ou une partie.",
            "De retour dans FieldQuo, la facture se met à jour d'elle-même dès que Stripe confirme le remboursement. Rien à appuyer.",
          ] },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — Gérer dans Stripe ouvre le tableau de bord où les remboursements s'émettent." },
          { warning: "Remboursez le montant de la facture, pas le net. Un client qui a payé 2 260 $ s'attend à recevoir 2 260 $; les 68,10 $ de frais sont votre coût pour avoir encaissé le paiement, et Stripe ne les rend pas." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "Ce que FieldQuo enregistre",
        blocks: [
          { bullets: [
            "La ligne du paiement garde son montant et ses frais d'origine, et gagne le montant remboursé et la date. Un deuxième remboursement partiel sur la même transaction met à jour la même ligne avec le nouveau total remboursé — jamais une deuxième ligne.",
            "Le montant payé de la facture baisse du remboursement et son solde remonte d'autant. Une facture entièrement remboursée se lit **Remboursé**; une facture remboursée en partie se lit **Remboursé en partie**, avec une bannière du genre « Partiellement remboursée — 500,00 $ ont été retournés au client. »",
            "Les propriétaires et les administrateurs reçoivent une notification : « Somme reprise sur la facture INV-1042 — Jane Tremblay », marquée **Remboursé**. Le niveau Gestionnaire ne la reçoit pas — voir [[disputes-and-chargebacks|Litiges et rétrofacturations]] pour savoir qui est averti.",
            "Dans l'export comptable, le paiement garde son brut, ses frais et son net; le remboursement apparaît dans votre tableau de bord Stripe sur la même transaction.",
          ] },
          { p: "Un remboursement sur une version antérieure d'une facture modifiée est appliqué à la dernière version, parce que la famille de versions partage un seul solde courant." },
        ],
      },
      {
        id: "the-fee",
        heading: "Les frais sur un paiement remboursé",
        blocks: [
          { p: "Stripe garde ses frais de traitement sur une transaction remboursée. Un remboursement émis depuis votre tableau de bord laisse les frais où ils sont, et le seul remboursement que FieldQuo émet lui-même — les frais de visite — est créé avec les frais délibérément **non** rendus : les rendre laisserait FieldQuo payer Stripe pour un paiement que personne n'a gardé. Les frais que vous avez vus sur la ligne du paiement sont donc les frais que vous avez payés, remboursement ou pas." },
          { p: "Si votre solde ne peut pas couvrir un remboursement, Stripe récupère la différence sur vos prochains paiements avant de virer quoi que ce soit — voir la section sur les soldes négatifs de [[payment-processing-fees-and-payouts|Frais de traitement des paiements et virements]]." },
        ],
      },
      {
        id: "manual-payments",
        heading: "Rembourser un paiement comptant, par chèque ou par virement Interac",
        blocks: [
          { p: "FieldQuo n'enregistre pas les remboursements de paiements manuels. Le formulaire **Enregistrer un paiement** refuse un montant négatif, alors un remboursement en argent comptant que vous remettez ne peut pas être saisi comme paiement. Rendez l'argent en dehors de l'application et, si la facture doit afficher un total plus petit, modifiez plutôt la facture — voir [[edit-an-invoice-after-sending|Modifier une facture après l'envoi]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut rembourser",
        blocks: [
          { p: "Quiconque peut ouvrir **Gérer dans Stripe** — les propriétaires et les administrateurs. Voir le remboursement sur la facture exige l'option **paiements**, que le niveau Gestionnaire possède et que les niveaux Équipe, Estimateur et Répartiteur n'ont pas." },
        ],
      },
    ],
    faq: [
      { q: "Y a-t-il un bouton de remboursement sur la facture?", a: "Non. Les remboursements s'émettent dans votre tableau de bord Stripe par Gérer dans Stripe; FieldQuo enregistre le résultat automatiquement." },
      { q: "Le client récupère-t-il ses frais de traitement?", a: "Le client n'a jamais payé de frais — il a payé le total de la facture. Remboursez ce total. Les frais ont été déduits de votre côté et restent déduits." },
      { q: "Le rappel de retard va-t-il relancer une facture remboursée?", a: "Non. Le rappel automatique de retard ne relance que les factures encore à l'état Envoyée ou En retard; une facture remboursée ou remboursée en partie n'est ni l'un ni l'autre." },
    ],
  },

  "disputes-and-chargebacks": {
    title: "Litiges et rétrofacturations",
    summary:
      "Ce qui se passe quand la banque d'un client conteste un paiement par carte : qui est averti, ce que la facture affiche, où va l'argent pendant que le litige est ouvert, et ce que gagner ou perdre coûte.",
    updated: "2026-09-12",
    intro: [
      "Un litige — une rétrofacturation — c'est un titulaire de carte qui demande à sa banque de reprendre un paiement. Stripe sort du solde le montant contesté et des frais de litige de **15 $** tant que le litige est ouvert, démarre un compte à rebours pour les preuves, et attend votre réponse. FieldQuo vous avertit dès que cela arrive, marque la facture **Contesté**, et déplace les montants de façon que ce soit votre solde, pas celui de FieldQuo, qui les porte.",
      "Avant que le fil de notifications de FieldQuo existe, une rétrofacturation n'avertissait personne : l'entrepreneur l'apprenait à sa prochaine visite du tableau de bord Stripe, souvent après la date limite. C'est la raison pour laquelle le fil a été construit.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque paiement d'un client est une transaction Stripe créée sur la plateforme de FieldQuo et transférée à votre compte. Quand le titulaire de carte la conteste, Stripe débite la plateforme du montant contesté et des 15 $ de frais. FieldQuo reprend les deux sur le transfert qu'il vous a fait — en deux mouvements distincts, pour qu'ils restent lisibles séparément sur la ligne du paiement — et la facture affiche **« Litige — 2 260,00 $ retenus, 15,00 $ de frais »**." },
          { p: "Vous répondez dans votre tableau de bord Stripe avec des preuves. La soumission signée, les photos des travaux terminés, la liste de fin de chantier et les courriels échangés sont ce qui fait gagner un litige; FieldQuo les a tous sur le chantier et sur la soumission." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Ce que vous voyez dans FieldQuo",
        blocks: [
          { bullets: [
            "Une notification, marquée critique, aux propriétaires et aux administrateurs (voir qui est averti, plus bas) : « Somme reprise sur la facture INV-1042 — Jane Tremblay », étiquetée **Rétrofacturation — Stripe impose un délai**.",
            "L'état de la facture devient **Contesté** — il prime sur Payée, parce qu'une banque en pleine décision est un fait différent de l'un comme de l'autre.",
            "Une bannière sur la facture : « La banque d'un client a contesté un paiement sur cette facture — l'argent est retenu jusqu'à la résolution. »",
            "La ligne du paiement : **Litige — 2 260,00 $ retenus, 15,00 $ de frais** tant qu'il est ouvert; puis soit **Litige gagné — 2 260,00 $ rendus. Stripe ne rembourse pas les frais de litige de 15,00 $.** soit **Litige perdu — 2 260,00 $ repris, 15,00 $ de frais**.",
          ] },
          { figure: "live:app-invoices", caption: "Factures — une facture contestée affiche son état dans la liste comme toutes les autres." },
        ],
      },
      {
        id: "what-happens-to-the-money",
        heading: "Ce qui arrive à l'argent",
        blocks: [
          { table: {
            head: ["Étape", "Le montant contesté", "Les 15 $ de frais"],
            rows: [
              ["Ouvert", "Repris sur votre transfert et retenu", "Repris sur votre transfert"],
              ["Gagné", "Retransféré vers vous", "Non rendus — Stripe les garde"],
              ["Perdu", "Parti; fondu dans le total remboursé de la facture", "Non rendus"],
            ],
          } },
          { p: "Une reprise ne peut reprendre que ce que le transfert vous a donné. Le transfert sur un paiement par carte de 2 260 $ était de 2 191,90 $ — le net après les frais de traitement — alors un litige sur le montant complet plus les frais le dépasse de 83,10 $. La retenue est prise en premier, les frais sur ce qui reste, et tout manque est consigné comme tel plutôt qu'absorbé en silence. En pratique, un litige est habituellement plus petit que le transfert et le manque est au plus les frais." },
          { note: "Stripe n'émet pas de remboursement quand un litige est perdu — la transaction reste simplement reprise. FieldQuo fond un litige perdu dans le total remboursé de la facture, une seule fois, pour que la facture se lise ensuite Remboursé ou Remboursé en partie plutôt que Contesté pour toujours." },
        ],
      },
      {
        id: "how-to-respond",
        heading: "Comment répondre",
        blocks: [
          { steps: [
            "Ouvrez la notification, ou la facture — la ligne du paiement affiche le montant retenu et les frais.",
            "Rassemblez les preuves dans FieldQuo : la soumission acceptée avec l'approbation du client, les photos et la liste de fin de chantier, les courriels de la facture.",
            "Ouvrez **Paramètres → Paiements → Gérer dans Stripe**, trouvez le litige et soumettez les preuves avant la date limite de Stripe.",
            "Attendez la décision du réseau de cartes. La facture se met à jour d'elle-même quand Stripe signale le litige clos.",
          ] },
          { warning: "La date limite est celle de Stripe, pas celle de FieldQuo, et elle est courte — des jours, pas des semaines. Un litige sans réponse est perdu par défaut. Traitez la notification comme urgente." },
        ],
      },
      {
        id: "the-fee",
        heading: "Les frais de litige",
        blocks: [
          { p: "Stripe facture **15 $** par litige, en CAD ou en USD, et ne les rend pas quand vous gagnez. FieldQuo les refacture au coût, et la facture le dit en toutes lettres quand un litige est gagné. Il n'y a aucuns frais FieldQuo par-dessus." },
        ],
      },
      {
        id: "who-is-told",
        heading: "Qui est averti",
        blocks: [
          { p: "La notification va aux propriétaires et aux administrateurs, et à tout membre en accès personnalisé dont la grille comprend l'option **paiements** — quelqu'un à qui un propriétaire a délibérément confié l'encaissement. Le niveau Gestionnaire a l'option mais est volontairement laissé de côté, comme le Répartiteur, pour que les revenus de l'entreprise ne soient pas poussés vers des gens que le propriétaire voit comme des chefs d'équipe; les niveaux Équipe et Estimateur ont l'option désactivée et ne la voient jamais. Aucun courriel n'est envoyé : la ligne du fil est le registre, plus une notification poussée sur tout téléphone ou navigateur où la personne les a activées." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je rembourser le client au lieu de contester le litige?", a: "Pas une fois qu'il est ouvert — Stripe a déjà repris le montant. Acceptez le litige dans votre tableau de bord Stripe si vous ne voulez pas le contester; le résultat est le même que de perdre, frais de 15 $ compris." },
      { q: "Un litige bloque-t-il les autres factures du client?", a: "Non. Seule la facture contestée change d'état. Les autres factures du client et son espace client ne sont pas touchés." },
      { q: "D'où viennent les 15 $ si mon solde est vide?", a: "Stripe récupère un solde négatif sur vos prochains paiements avant de virer quoi que ce soit. Rien n'est radié en silence." },
    ],
  },

  "deposits-and-payment-schedules": {
    title: "Acomptes et échéanciers de paiement",
    summary:
      "Répartissez ce qu'un chantier doit en un acompte et des étapes ultérieures liées aux dates du chantier lui-même, depuis la carte Échéancier de paiement de Paramètres → Profil de l'entreprise.",
    updated: "2026-09-12",
    intro: [
      "La plupart des métiers prennent un acompte et le solde plus tard. La carte **Échéancier de paiement** de **Paramètres → Profil de l'entreprise** en fait des règles : un pourcentage à la création de la facture, un pourcentage au début du chantier, à mi-parcours ou à l'achèvement. Chaque soumission acceptée à partir de là produit une seule facture, demandée en ces étapes, chacune avec son propre lien de paiement pour sa propre part.",
      "C'est désactivé par défaut — sans étape, chaque soumission produit une seule facture complète à l'acceptation, exactement comme toujours. Cet article, c'est la carte; la façon dont chaque étape est réellement demandée se trouve dans [[progress-payments-by-stage|Paiements progressifs : comment chaque étape est demandée]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un échéancier est une liste d'étapes. Chacune a un nom, un déclencheur et un pourcentage, et les pourcentages doivent totaliser exactement 100. Les montants sont calculés à partir du total de la soumission acceptée au moment où le client l'approuve, puis gelés sur le chantier — une étape déjà demandée ne change jamais parce qu'une date a bougé ensuite." },
          { p: "La carte rédige aussi vos **Conditions de paiement** pour vous : avec un échéancier enregistré, les conditions sur chaque soumission, facture et PDF se lisent « 30 % Acompte, 40 % Début du chantier, 15 % À mi-parcours, 15 % À l'achèvement » — générées à partir des étapes, pour que le document vu par le client corresponde toujours à ce qui est réellement facturé. Le champ de texte libre des conditions est verrouillé tant qu'un échéancier est actif." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "Ce qu'il y a sur la carte",
        blocks: [
          { p: "« Répartissez ce qui est dû en étapes liées au chantier lui-même — un acompte à l'envoi de la facture, le reste au début, à mi-parcours ou à la fin. Désactivé par défaut; activez-le en ajoutant une étape ci-dessous. » Chaque ligne d'étape a **Nom de l'étape**, **Quand** et **Pourcentage**; la liste **Quand** propose quatre déclencheurs :" },
          { bullets: [
            "**Acompte — à la création et à l'envoi de la facture** — se déclenche dès que la soumission est acceptée, avant qu'aucune date soit connue.",
            "**Début du chantier** — la date de début du chantier.",
            "**À mi-parcours du chantier** — le jour du milieu du chantier, compté à partir de ses dates de début et de fin.",
            "**Fin du chantier (achèvement)** — la date de fin prévue du chantier, pas le jour où l'équipe a réellement terminé.",
          ] },
          { p: "Sous les lignes : **Total** avec la somme courante, **Ajouter une étape**, **Retirer cette étape** sur chaque ligne, **Enregistrer l'échéancier**, et **Désactiver — revenir au texte libre**." },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "Comment en créer un",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et trouvez la carte **Échéancier de paiement**.",
            "Appuyez sur **Ajouter une étape**. La première ligne est par défaut **Acompte**; tapez le pourcentage.",
            "Ajoutez le reste — par exemple **Début du chantier** 40, **À mi-parcours** 15, **À l'achèvement** 15 — en renommant les étapes dans vos propres mots.",
            "Surveillez **Total** : « Les étapes doivent totaliser exactement 100 % avant de pouvoir être enregistrées. » Appuyez sur **Enregistrer l'échéancier** quand il affiche 100.",
          ] },
          { figure: "live:app-settings-company", caption: "Paramètres → Profil de l'entreprise — la carte Échéancier de paiement, avec Description des travaux et conditions au-dessus." },
          { note: "Jusqu'à 12 étapes, chaque nom jusqu'à 80 caractères. Une étape à 0 % est permise et est simplement abandonnée quand vient son tour — aucun courriel de 0 $ ne part vers le client." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["Nom de l'étape", "Le libellé sur le courriel du client et sur l'échéancier du chantier. Modifiable; jamais recalculé une fois enregistré."],
              ["Quand", "Quelle date du chantier déclenche la demande. Une étape sans date utilisable attend, visiblement, et n'est jamais sautée."],
              ["Pourcentage", "La part de l'étape sur le total accepté. La dernière étape absorbe l'arrondi pour que les étapes totalisent au cent près."],
              ["Enregistrer l'échéancier", "Écrit les étapes et régénère la phrase des Conditions de paiement. S'applique aux soumissions acceptées à partir de maintenant; les chantiers déjà en cours gardent leurs étapes gelées."],
              ["Désactiver — revenir au texte libre", "Supprime toutes les étapes. Les nouvelles soumissions produisent de nouveau une seule facture complète et le champ des Conditions de paiement redevient modifiable."],
            ],
          } },
        ],
      },
      {
        id: "the-halfway-math",
        heading: "Comment la mi-parcours est comptée",
        blocks: [
          { p: "Les jours sont comptés inclusivement : un chantier du 1er au 6 septembre est un chantier de 6 jours. La mi-parcours est le jour 3, alors la demande part le 3 septembre. Une durée impaire arrondit **vers le haut** — un chantier de 5 jours demande au jour 3, une fois plus de la moitié du travail vraiment faite, jamais au jour 2. Les dates sont le début et la fin prévus du chantier; un chantier qui n'a que l'une des deux affiche « Pas encore programmable » pour les étapes qui ont besoin de l'autre." },
        ],
      },
      {
        id: "turning-it-off",
        heading: "Le désactiver",
        blocks: [
          { warning: "« Ceci efface toutes les étapes. Les chantiers déjà facturés selon cet échéancier gardent ce qui a déjà été facturé; les nouveaux devis utiliseront le texte libre ci-dessous. » Désactiver n'annule aucune demande déjà envoyée et ne rembourse rien." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le modifier",
        blocks: [
          { p: "Enregistrer ou effacer l'échéancier exige la capacité **user:manage** — les propriétaires, les administrateurs, et les niveaux Répartiteur et Gestionnaire. **Paramètres → Profil de l'entreprise** est caché aux niveaux Équipe et Estimateur. L'acompte de visite de la page de rendez-vous est une autre chose, réglée dans **Paramètres → Page de rendez-vous** — voir [[booking-fees-and-visit-deposits|Frais de réservation et acomptes de visite]]." },
        ],
      },
    ],
    faq: [
      { q: "Un échéancier crée-t-il plusieurs factures?", a: "Non. Une facture par chantier, demandée en étapes. Chaque étape envoie par courriel un lien de paiement plafonné à sa propre part de cette seule facture; le solde de la facture est le total courant de toutes les étapes payées." },
      { q: "Puis-je fixer un échéancier différent par soumission?", a: "Pas pour l'instant. L'échéancier vaut pour toute l'entreprise et s'applique à chaque soumission acceptée pendant qu'il est actif. Désactivez-le pour un chantier ponctuel qui doit être facturé en entier." },
      { q: "Et les travaux ajoutés après l'acceptation?", a: "Les étapes sont des pourcentages de la soumission acceptée. Les avenants acceptés sont encaissés sur le solde de la facture, pas par une étape, et la page du chantier dit de combien il s'agit." },
    ],
  },

  "progress-payments-by-stage": {
    title: "Paiements progressifs : comment chaque étape est demandée",
    summary:
      "Ce qui déclenche chaque étape d'un échéancier de paiement, ce que le client reçoit, comment la page du chantier affiche En attente, Demandé et Renoncé, et ce qui arrive quand les dates du chantier bougent.",
    updated: "2026-09-12",
    intro: [
      "Une fois un échéancier de paiement actif, accepter une soumission crée le chantier, la seule facture qui lui correspond, et une copie gelée de l'échéancier sur ce chantier : chaque étape avec sa part en dollars et, quand une date est connue, sa date d'échéance. L'acompte part aussitôt. Les autres partent lors d'un passage quotidien, à mesure que les dates du chantier arrivent.",
      "Cet article suit une étape de « En attente » jusqu'à la boîte de réception du client. La mise en place de l'échéancier se trouve dans [[deposits-and-payment-schedules|Acomptes et échéanciers de paiement]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une étape est demandée exactement une fois. La demander envoie au client un courriel de facture qui met en vedette le montant propre de l'étape — « Facture INV-1042 — 1 200,00 $ » — avec le nom de l'étape en note et un bouton **Payer** qui encaisse ce montant, pas le solde entier. La première étape demandée est ce qui envoie la facture : elle marque la facture envoyée, à cette adresse, et la fait passer de brouillon à **Envoyée**." },
          { p: "Le fait qu'une étape ait été payée n'est pas suivi sur l'étape. Le solde de la facture y répond déjà, quel que soit le nombre de paiements d'étape arrivés, et un deuxième indicateur « payée » serait deux endroits qui peuvent se contredire." },
        ],
      },
      {
        id: "when-each-stage-fires",
        heading: "Quand chaque étape part",
        blocks: [
          { table: {
            head: ["Déclencheur", "Part quand", "Exige"],
            rows: [
              ["Acompte — à la création et à l'envoi de la facture", "Dès que la soumission est acceptée, avant qu'aucune date existe", "Une adresse courriel du client"],
              ["Début du chantier", "Le jour de la date de début du chantier, lors du passage quotidien", "Une date de début sur le chantier"],
              ["À mi-parcours du chantier", "Le jour du milieu entre le début et la fin, compté inclusivement et arrondi vers le haut", "Les deux dates, la fin pas avant le début"],
              ["Fin du chantier (achèvement)", "Le jour de la date de fin prévue du chantier", "Une date de fin sur le chantier"],
            ],
          } },
          { p: "Le passage quotidien s'exécute une fois par jour, tôt le matin, sur chaque chantier qui a encore une étape en attente. Une étape dont la date est arrivée est demandée; une étape dont le client ne peut pas être joint par courriel (aucune adresse au dossier) reste en attente et est réessayée le lendemain." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Ce que le client reçoit",
        blocks: [
          { p: "Chaque demande est le même courriel de facture que le bouton Envoyer utilise, dans la langue du client, depuis l'expéditeur de votre entreprise, avec trois différences :" },
          { bullets: [
            "L'objet et l'en-tête portent le montant de l'étape — sa part — plutôt que le solde complet de la facture.",
            "Le nom de l'étape (« Acompte », « Début du chantier ») apparaît comme une ligne dans le courriel.",
            "Le lien **Payer** ouvre la facture dans l'espace client, pointée sur cette étape, pour que le bouton de paiement demande exactement cette part. Le montant est recalculé à partir de l'étape sur le serveur; rien dans le lien ne peut le changer.",
          ] },
          { note: "Si Stripe n'est pas connecté, le courriel part quand même, avec **Voir la facture** au lieu de **Payer**, et le client paie par les modes que votre facture indique. Une demande d'étape ne réclame jamais plus que le vrai solde restant de la facture, même si les étapes ont été calculées avant une modification." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "Sur la page du chantier",
        blocks: [
          { p: "La carte **Échéancier de paiement** du chantier liste chaque étape avec sa part et l'un de trois états :" },
          { bullets: [
            "**En attente** — pas encore demandée. Affiche **Dû le {date}** dès que la date est connue, ou pourquoi elle ne peut pas encore être programmée.",
            "**Demandé** — le client a reçu le courriel pour cette étape. Sa date est maintenant gelée.",
            "**Renoncé (0 %)** — une étape à 0 %, consignée comme partie sans courriel.",
          ] },
          { p: "Les trois messages de blocage sont : « Pas encore programmable — définissez une date de début pour ce chantier », « Pas encore programmable — définissez une date de fin pour ce chantier », et « La date de fin précède la date de début — corrigez les dates du chantier ». Une étape bloquée est un état visible, jamais une étape sautée en silence." },
        ],
      },
      {
        id: "when-dates-move",
        heading: "Quand les dates du chantier bougent",
        blocks: [
          { p: "La date d'échéance de chaque étape en attente est recalculée à partir des dates actuelles du chantier à chaque passage quotidien — elle n'est pas prise pour acquise depuis le jour où l'échéancier a été créé. Un chantier qui glisse d'une semaine entraîne ses étapes en attente avec lui. Une étape déjà demandée garde la date à laquelle elle a été demandée : un client à qui l'on a réclamé de l'argent à une date ne doit pas en voir une autre parce que le chantier a été replanifié ensuite." },
          { note: "Un chantier saisi après coup comme chantier passé ne reçoit jamais d'étapes, et n'envoie jamais de demande d'acompte pour des travaux déjà payés." },
        ],
      },
      {
        id: "change-orders",
        heading: "Modifications acceptées après l'acceptation",
        blocks: [
          { p: "Les montants des étapes sont des pourcentages de la soumission acceptée et sont gelés pour trois raisons : le client a approuvé ces chiffres, une étape demandée a déjà été réclamée, et recalculer déplacerait de l'argent réel. La page du chantier le dit quand cela s'applique : « Ces étapes sont des pourcentages de la soumission acceptée et n'incluent pas 640,00 $ d'avenants acceptés. Ce montant est encaissé sur le solde de la facture, pas par une étape. »" },
        ],
      },
    ],
    faq: [
      { q: "Puis-je demander une étape d'avance, à la main?", a: "Pas depuis l'échéancier. Vous pouvez relancer la facture elle-même à tout moment — voir [[invoice-reminders-and-chasing|Rappels de facture et relances]] — ce qui réclame le solde restant complet." },
      { q: "Le client a payé l'acompte par virement Interac. L'étape le sait-elle?", a: "Enregistrez-le sur la facture comme paiement manuel. Le solde de la facture baisse, et le lien de paiement de l'étape suivante est plafonné à ce qui reste dû." },
      { q: "Pourquoi la demande de mi-parcours est-elle partie au jour 3 d'un chantier de 5 jours?", a: "Les durées impaires arrondissent vers le haut pour que la demande arrive une fois plus de la moitié du travail faite, jamais avant le milieu." },
    ],
  },

  "invoice-reminders-and-chasing": {
    title: "Rappels de facture et relances",
    summary:
      "Le rappel automatique de retard dans Paramètres → Relances, le bouton Relancer le paiement sur le tableau de bord et sur la facture, et la trace que chacun laisse.",
    updated: "2026-09-12",
    intro: [
      "Deux choses relancent une facture impayée. Un **rappel automatique**, configuré une fois dans **Paramètres → Relances**, envoie un gabarit par courriel un délai donné après la date d'échéance, une fois par facture, et s'arrête dès que la facture est payée. Et **Relancer le paiement**, dans « En attente de vous » sur le tableau de bord et sur la facture elle-même, envoie une demande de paiement à la main, avec une note dans vos mots, aussi souvent que vous voulez.",
      "Les deux sont des courriels envoyés par l'expéditeur de votre entreprise, dans la langue du client, avec un lien vers l'espace client. Les deux laissent une trace sur la facture.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une facture est en retard quand sa date d'échéance est passée et qu'elle est encore **Envoyée** ou **En retard**. Le panneau **Argent dû** du tableau de bord et l'échelle des comptes clients montrent ce qui est en retard et depuis combien de jours, et disent en une ligne si un rappel automatique existe : « Un rappel automatique part 5 jours après la date d'échéance d'une facture. » ou « Aucun rappel automatique de retard n'est configuré, alors rien ne relance ces factures tout seul. » — avec **En configurer un** ou **Le modifier** à côté." },
          { p: "Les rappels par texto n'existent pas. Chaque règle de relance envoie exactement un courriel; un schéma qui dessinerait une branche texto décrirait une fonction qui n'est pas là." },
        ],
      },
      {
        id: "the-automatic-reminder",
        heading: "Le rappel automatique de retard",
        blocks: [
          { p: "Une règle de relance, c'est un déclencheur, un délai et un gabarit de courriel. Pour les factures, le déclencheur est **Invoice overdue** (les noms de déclencheurs de ce formulaire sont en anglais) — il part une fois qu'une facture impayée a dépassé sa date d'échéance du délai fixé — et le délai par défaut est de 5 jours." },
          { steps: [
            "Ouvrez **Paramètres → Modèles de courriel** et assurez-vous d'avoir un gabarit de relance, de marketing ou personnalisé à envoyer. Sans gabarit, la page le dit et le bouton **Nouvelle règle** est désactivé.",
            "Ouvrez **Paramètres → Relances** et appuyez sur **Nouvelle règle**.",
            "Réglez **Déclencheur** sur **Invoice overdue**, le **Délai** et l'**Unité** (heures ou jours), et choisissez le **Gabarit à envoyer**. Donnez-lui un nom de règle si vous voulez.",
            "Appuyez sur **Créer la règle**. Le schéma **Comment tout cela s'exécute** se redessine : déclencheur → attente → envoi du courriel → « S'arrête dès que la facture est payée. » et « Chaque facture reçoit ce courriel une seule fois. »",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Paramètres → Relances — le schéma Comment tout cela s'exécute, tiré des règles en dessous." },
          { note: "Les règles sont vérifiées une fois par jour. Une règle peut être suspendue avec **Mettre en pause** et reprise avec **Activer**; une règle en pause n'envoie rien. Deux règles sur le même déclencheur avec des délais différents partent toutes les deux, dans l'ordre des délais — un coup de coude à 3 jours et un rappel plus ferme à 14 jours est une configuration normale. Le gabarit peut utiliser le numéro de facture, le total, le montant payé, le solde dû, la date d'échéance et un lien direct vers la facture dans l'espace client." },
        ],
      },
      {
        id: "chase-by-hand",
        heading: "Relancer à la main",
        blocks: [
          { steps: [
            "Sur le tableau de bord, sous **En attente de vous** ou **Argent dû**, appuyez sur **Relancer le paiement** sur la facture; ou ouvrez la facture et appuyez sur **Relancer le paiement** dans sa bannière.",
            "Dans **Relancer ce paiement** — « Envoie à Jane un lien pour payer les 1 240,00 $ encore dus, dans sa langue, depuis votre adresse. » — ajoutez une note si vous en voulez une : « nous avions convenu d'un règlement après la dernière visite ».",
            "Appuyez sur **Envoyer le rappel**. La ligne confirme : « Demande de paiement envoyée à jane@… à 14 h 41 ».",
          ] },
          { p: "Le courriel réclame le solde restant complet de la facture, avec un bouton **Payer** quand Stripe est connecté. Le bouton manque quand le client n'a pas d'adresse courriel — la facture dit « Jane n'a aucune adresse courriel au dossier : cette facture ne peut être ni envoyée ni relancée. »" },
        ],
      },
      {
        id: "what-the-invoice-records",
        heading: "La trace sur la facture",
        blocks: [
          { bullets: [
            "**Envoyée par courriel → jane@…** avec la date du premier envoi.",
            "**Dernière relance · 3×** avec la date de la dernière relance manuelle — chaque envoi accepté compte.",
            "**Rappel automatique envoyé** avec une date pour chaque rappel livré par la règle.",
          ] },
          { p: "Les lignes du tableau de bord portent les mêmes faits — « Dernière relance le 4 sept. · 2× », « Rappel automatique envoyé le 9 sept. » — pour que vous voyiez d'un coup d'œil quelles factures en retard ont déjà été relancées. Le journal d'activité consigne aussi chaque envoi." },
        ],
      },
      {
        id: "the-chase-task",
        heading: "La tâche de suivi",
        blocks: [
          { p: "Envoyer une facture crée aussi une tâche, due dans une semaine : « Follow up payment for INV-1042 — Sent to Jane Tremblay. Check it's been paid before chasing — the client portal shows the current balance. » Une tâche par facture, quel que soit le nombre de copies envoyées; elle se ferme quand le solde est réglé. Sept jours, c'est un rappel de jeter un œil, pas votre condition de paiement — celle-ci est sur la facture." },
        ],
      },
      {
        id: "who-can",
        heading: "Qui peut faire quoi",
        blocks: [
          { p: "Créer, suspendre ou supprimer une règle de relance exige **user:manage** — les propriétaires, les administrateurs, les niveaux Répartiteur et Gestionnaire; la ligne **Paramètres → Relances** est cachée à tous les autres. Appuyer sur **Relancer le paiement** exige l'accès en modification aux factures (Gestionnaire et plus par défaut). Le rappel automatique n'a besoin de personne : il s'exécute tout seul." },
        ],
      },
    ],
    faq: [
      { q: "Le rappel va-t-il envoyer un courriel tous les jours?", a: "Non. Chaque règle envoie un courriel à chaque facture une seule fois. Pour un deuxième coup de coude, ajoutez une deuxième règle avec un délai plus long." },
      { q: "Le client peut-il se désabonner des rappels de retard?", a: "Non. Un rappel pour une facture qu'il doit est transactionnel, alors il ne porte aucun lien de désabonnement. Seule la relance de fin de chantier, qui est du marketing, en porte un." },
      { q: "La facture n'a pas de date d'échéance. Sera-t-elle relancée?", a: "Pas automatiquement — la règle se base sur la date d'échéance, et le tableau de bord dit « Aucune date d'échéance sur cette facture — elle n'est pas en retard ». Vous pouvez quand même la relancer à la main." },
    ],
  },
};
