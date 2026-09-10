// app/i18n/comparePages/fr.js
//
// Canadian French (fr-CA) against en.js. Register is Quebec business plain
// speech, not France marketing: « soumission » for a quote, « facture », and
// vouvoiement throughout, because a stranger comparing three contractors is
// not somebody we are on tutoiement terms with.
//
// Decisions a reviewer should know about:
//
//   • « poste » = seat (the licensed login), « personnes sur le terrain » =
//     crew when a count is attached, « équipe de terrain » when it is the
//     collective. One French word for both would erase the distinction the
//     whole pricing argument rests on.
//   • « palier » = tier, « forfait » = plan. Kept apart for the same reason.
//   • Amounts are no longer written here at all. They used to be, transcribed
//     from the English rather than restyled — the note that stood here argued
//     that reformatting the figure with fr-CA typography was how a number
//     silently becomes a different number. That was true and it was not the
//     bigger problem: a price typed into a catalogue is a price no gate can
//     withdraw, and nine copies of one are nine sentences that keep quoting a
//     competitor after the reading behind it has expired. The ledes carry
//     {ourEntry}, {theirEntry}, {theirParity} and {addOnTotal}; the values
//     arrive from app/(marketing)/compare/copyFigures.js, already formatted
//     for the reader's locale, and are bracketed when they will not publish.
//     Translate the words around a placeholder; never replace one.
//   • Competitor prose stays in the competitor's language, as in en.js. This
//     file translates our sentences around the quotation, never the quotation.
//   • The hedges — unverifiedConcessionNote, staleClaimNote, matchUnknownIntro,
//     theirTiersNoMatchNote — are kept exactly as narrow as the English.
//     « nous n’avons pas vérifié » never becomes « ils ne l’ont pas ».

const fr = {
  "compare.eyebrow": "Comparatif",
  "compare.indexTitle": "Comparer FieldQuo",
  "compare.indexLede": "Cinq comparatifs, chacun monté à partir de ce que l’autre entreprise publie sur son propre site. Rien ici n’est converti d’une devise à l’autre, rien n’est un prix promotionnel, et tout ce que nous n’avons pas pu trancher est nommé plutôt que deviné. L’un des cinq commence moins cher que nous, et cette page-là le dit avant de dire quoi que ce soit d’autre.",
  "compare.rulesTitle": "Comment ces pages sont montées",
  "compare.entryGapTitle": "Leur prix d’entrée est plus bas que le nôtre",
  "compare.entryGapIntro": "Les comparatifs de ce site ne tournent pas tous à notre avantage, et celui-ci ne tourne pas à notre avantage. Les deux prix ci-dessous sont leur montant publié et notre propre échelon le moins cher, tirés tous les deux des mêmes relevés que le reste de cette page.",
  "compare.entryGapTheirListIntro": "Ce que leur propre page inscrit à ce forfait, dans leurs mots :",
  "compare.entryGapAdvice": "Si c’est ce travail-là que vous avez à faire, achetez le leur. Nous préférons l’écrire ici plutôt que de vendre à quelqu’un plus de logiciel qu’il n’en utilise et de le revoir au remboursement. Ce qui change la réponse, c’est une équipe de terrain : chez eux, chaque accès compte comme un utilisateur payant ; chez nous, non.",
  "compare.theirTiersTitle": "Ce que chacun de leurs forfaits ajoute, dans leurs mots",
  "compare.theirTiersIntro": "Leurs propres descriptions de leurs propres paliers, citées telles que leur page les présente et placées à côté du prix auquel chacun aboutit. Nous n’avons rien transposé dans notre vocabulaire : rebaptiser la fonction d’un concurrent pour qu’elle ressemble à l’une des nôtres, c’est ainsi qu’un comparatif devient discrètement un épouvantail. Les mots ci-dessous sont donc les leurs, et la liste des nôtres se trouve plus bas sur cette page, à part.",
  "compare.theirTiersNoMatchNote": "Personne n’a établi, fonction par fonction, lequel de leurs paliers porte laquelle des capacités que nous vendons. Leur page décrit ses forfaits en prose et notre recherche ne consigne aucune réponse palier par palier ; cette page n’avance donc aucune correspondance, dans un sens comme dans l’autre — lisez leur liste, lisez la nôtre, et décidez.",
  "compare.matchUnknownIntro": "Personne n’a établi lequel de leurs paliers porte cette fonction, alors cette page n’en nomme aucun. Ce n’est pas une affirmation qu’elle leur manque — nous n’avons pas vérifié, et une page qui traite ce qu’elle n’a pas vérifié comme une absence est une page qui invente.",
  "compare.aiMeteringTitle": "Comment chaque camp comptabilise son IA",
  "compare.aiMeteringIntro": "La leur se vend comme un quota mensuel qui change selon le palier, imprimé sur leur propre page. La nôtre ne se vend pas comme ça, et la version honnête de cette phrase a deux moitiés.",
  "compare.aiMeteringOurs": "FieldQuo ne vend pas l’IA au crédit : il n’y a, sur notre page de prix, aucun quota par forfait à épuiser ni bloc plus gros vers lequel monter. Le réceptionniste est sur tous les forfaits, le temps d’appel s’achète à part en crédit prépayé et il n’y a pas de minimum mensuel ; un mois sans appels ne coûte donc rien de ce côté. L’autre moitié, qui a sa place ici aussi : l’usage du modèle est comptabilisé par entreprise, contre un plafond que nous fixons à l’interne, alors rien sur cette page ne prétend que c’est illimité.",
  "compare.concessionTitle": "Ce que FieldQuo ne fait pas",
  "compare.concessionIntro": "Cette section se trouve sur chacune de ces pages, au même endroit, au-dessus de la partie où nous paraissons bien. Un tableau comparatif fait uniquement de nos victoires vend à quelqu’un un abonnement dont il redemandera son argent.",
  "compare.unverifiedConcessionNote": "Nous n’avons pas vérifié si cette entreprise l’offre, alors nous ne disons pas qu’elle l’offre.",
  "compare.staleClaimNote": "Ce relevé date de plus de trois mois, alors tout montant qu’il contient est retenu jusqu’à ce que quelqu’un revérifie leur page. Suivez le lien et voyez ce qu’elle dit aujourd’hui.",
  "compare.advantageTitle": "Là où FieldQuo est en avance",
  "compare.advantageIntro": "Chacun de ces points a été relevé sur leur propre page à la date indiquée. Suivez le lien et vérifiez — c’est à ça que sert le lien.",
  "compare.priceTitle": "Le prix, tel que chaque entreprise le publie",
  "compare.featuresTitle": "Ce que vous obtenez avec FieldQuo",
  "compare.featuresIntro": "Chaque ligne ci-dessous est une fonction avec une implémentation derrière. La liste est générée à partir du même registre que celui sur lequel roulent les vérifications techniques, alors une fonction qui cesse de marcher cesse d’être annoncée.",
  "compare.ctaTitle": "Premier mois gratuit avec une carte au dossier, et vous pouvez lire le prix avant de commencer",
  "compare.ctaBody": "Aucun appel à réserver, et le prix est sur la page des prix plutôt que derrière un formulaire. Votre carte est prise à l’inscription et n’est débitée qu’à la fin du mois gratuit.",
  "compare.ctaButton": "Commencer votre mois gratuit",
  "compare.ctaSecondary": "Voir les prix",
  "compare.otherPagesTitle": "Les autres comparatifs",
  "compare.rule.1": "Chaque prix est le prix régulier que l’entreprise imprime sur sa propre page de prix. Les prix en rabais sont écartés : une page comme celle-ci est montée une fois et servie pendant des mois, et elle ne peut pas s’apercevoir qu’une offre a pris fin.",
  "compare.rule.2": "L’argent reste dans la devise où il a été publié. Nous ne convertissons jamais. Un taux de change est juste le jour où on le consulte et faux le lendemain, et un montant converti posé sur une page statique, c’est un calcul que personne ne surveille.",
  "compare.rule.3": "Quand nous n’avons pas pu trancher ce que voulait dire un montant, la ligne le dit et n’affiche aucun chiffre. Ça arrive plus souvent qu’on ne le croirait, et c’est la partie de la page dont nous sommes le plus sûrs.",
  "compare.rule.4": "Chaque montant porte la date de son relevé et le pays d’où il a été relevé, parce qu’un prix peut varier selon l’un comme selon l’autre.",

  "compare.lede.jobber": "Jobber vend sa suite marketing, son réceptionniste IA et son pipeline de ventes comme des modules mensuels distincts — {addOnTotal} par mois par-dessus un forfait dont le prix bouge déjà selon la taille de votre équipe. FieldQuo met les trois dans tous les forfaits, à tous les prix, et tout le monde dans une camionnette est gratuit.",
  "compare.concession.jobber": "Commençons par ce que nous n’avons pas. FieldQuo est une application web : il n’y a rien à installer depuis une boutique d’applications, rien ne fonctionne sans signal, et il n’y a pas de vendeur pour vous en faire le tour.",
  "compare.lede.housecall_pro": "Housecall Pro facture chaque utilisateur supplémentaire, alors le prix du forfait n’est que le point de départ de votre facture. FieldQuo facture les gens qui chiffrent vraiment le travail — soumissions, chantiers, factures — et tout le monde dans une camionnette fait partie de l’équipe de terrain, sans frais. Toutes les fonctions sont dans tous les forfaits, à partir de {ourEntry}.",
  "compare.concession.housecall_pro": "La partie honnête d’abord. La page de Housecall Pro inscrit une application mobile, l’accès hors ligne et une démo guidée comme du standard. FieldQuo n’a aucun des trois, et si l’un d’eux tranche la question pour vous, c’est eux qu’il faut acheter.",
  "compare.lede.servicetitan": "La page de prix de ServiceTitan ne porte aucun montant en dollars, nulle part — vous réservez une démo et le chiffre se négocie contre votre chiffre d’affaires et votre effectif. Des entrepreneurs rapportent des frais mensuels par technicien par-dessus des frais d’implantation à cinq chiffres et un contrat pluriannuel. Tous les prix de FieldQuo sont sur cette page, il n’y a pas de frais d’installation, et vous pouvez commencer ce soir sans parler à personne.",
  "compare.concession.servicetitan": "Ce que nous ne pouvons pas offrir, dit en premier : pas d’application mobile, rien qui fonctionne hors réseau, et personne pour vous faire faire le tour avant que vous décidiez.",
  "compare.lede.projul": "Projul demande un engagement annuel forfaitaire payé d’avance. FieldQuo, c’est {ourEntry} par mois pour un poste et cinq personnes sur le terrain, toutes les fonctions incluses, et vous pouvez partir à la fin de n’importe quel mois — vous n’avez pas à acheter une année pour savoir si ça vous convient.",
  "compare.concession.projul": "Avant le reste : FieldQuo n’a pas d’application mobile, ne fonctionne pas sans signal, et n’a personne pour vous en faire la démonstration. Projul, lui, vous réservera une démo.",
  "compare.lede.quoteiq": "QuoteIQ commence à {theirEntry}, et ce forfait-là ne peut pas vous bâtir un site web, prendre une réservation, ni laisser un propriétaire chiffrer lui-même ses travaux. Le forfait QuoteIQ qui porte ce que FieldQuo met dans tous les forfaits, c’est leur palier Max, à {theirParity} par mois. Le nôtre est à {ourEntry} — et quarante et une choses de notre liste ne sont dans leur gamme à aucun prix.",
  "compare.concession.quoteiq": "Le prix d’abord, parce que c’est ce que vous êtes venu vérifier. QuoteIQ commence sous notre forfait le moins cher, livre des applications mobiles que nous n’avons pas, et vous réservera une visite guidée. FieldQuo est une application web, sans vendeur attaché.",

  "compare.counterpoint.projul.monthly_billing": "Leur page plaide en faveur du forfait annuel, et l’argument se tient : Projul dit que son prix ne comporte aucuns frais par utilisateur ni plafond sur le nombre de projets. Une entreprise qui ajoute souvent du monde sera peut-être mieux servie là.",

  "compare.capability.mobile_app": "Application mobile native (iOS / Android)",
  "compare.capability.offline_use": "Fonctionne hors ligne",
  "compare.capability.self_serve_demo": "Réserver une démo guidée avec un vendeur",
  "compare.capability.accounting_sync": "Synchronisation bidirectionnelle avec QuickBooks ou Xero",
  "compare.capability.gantt_charts": "Diagrammes de Gantt et échéanciers de projet liés",
  "compare.capability.purchase_orders": "Bons de commande aux fournisseurs",
  "compare.capability.daily_logs": "Journaux de chantier quotidiens",
  "compare.capability.geofencing": "Géolocalisation et pointage à l’intérieur d’un périmètre",
  "compare.capability.field_worker_quotes": "L’équipe de terrain peut chiffrer et envoyer une soumission depuis la camionnette",
  "compare.capability.entry_price_below_our_floor": "Un forfait payant sous l’échelon le moins cher de FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "Réceptionniste téléphonique IA sur tous les forfaits, sans minimum mensuel",
  "compare.capability.self_serve_signup": "S’inscrire et commencer sans parler à personne",
  "compare.capability.published_price": "Prix publié ouvertement, sans appel de vente",
  "compare.capability.monthly_billing": "Paiement mensuel, aucun engagement annuel exigé",
  "compare.capability.free_crew_seats": "Équipe de terrain incluse gratuitement — seules les personnes qui génèrent de l’argent sont facturées",

  "compare.teamSize.solo": "Juste moi",
  "compare.teamSize.2-5": "2 à 5 personnes",
  "compare.teamSize.6-10": "6 à 10 personnes",
  "compare.teamSize.11-15": "11 à 15 personnes",
  "compare.teamSize.16-plus": "16 ou plus",
  "compare.billing.annual_prepaid": "Annuel, payé d’avance",
  "compare.billing.monthly_1yr": "Mensuel, engagement de 1 an",
  "compare.billing.monthly_none": "Mensuel, sans engagement",

  "compare.comparableFeature.ai_receptionist": "Réceptionniste téléphonique IA",

  // ── La page d’index ─────────────────────────────────────────────────────
  "compare.vs": "FieldQuo vs {competitor}",
  "compare.preparedAsOf": "Préparé en date du {date}.",
  "compare.preparedAsOfLong": "Préparé en date du {date}. Chaque montant ci-dessous porte aussi le jour de son relevé et le pays d’où il a été relevé.",
  "compare.readComparison": "Lire le comparatif",

  // Ce qu’une carte a le droit d’avancer, assemblé dans ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} de leurs prix publiés peuvent être placés à côté des nôtres, dans la devise où ils l’impriment.",
  "compare.summary.amounts": "{count} de leurs prix publiés peuvent être placés à côté des nôtres.",
  "compare.summary.asserted": "{count} d’entre eux ne nomment aucune devise sur leur propre page, alors le comparatif dit de qui vient le jugement sur la devise au lieu de l’imprimer comme la leur.",
  "compare.summary.onRequest": "{count} de leurs paliers ne publient aucun montant du tout et vous demandent d’en faire la demande.",
  "compare.summary.none": "Rien de ce qu’ils publient ne peut être comparé à un prix FieldQuo.",
  "compare.summary.withheldOne": "{count} montant de plus est retenu, affiché avec la raison.",
  "compare.summary.withheld": "{count} montants de plus sont retenus, chacun affiché avec la raison.",

  // ── Comment se lit un prix ──────────────────────────────────────────────
  //
  // {currency} est un code et {ask} est le libellé de leur bouton : les deux
  // arrivent déjà décidés et ni l’un ni l’autre n’est traduit. {per} passe par
  // compare.per.* ci-dessous, parce qu’une préposition anglaise soudée à
  // « par mois » est exactement ce que ce fichier existe pour éviter.
  "compare.price.amount": "${amount} {currency} par {per}",
  "compare.price.free": "Gratuit ({currency})",
  "compare.price.onRequest": "Aucun prix publié — leur page dit « {ask} »",
  "compare.price.notOffered": "Pas vendu à cette taille",
  "compare.per.month": "mois",
  "compare.per.year": "an",
  "compare.pricePerMonth": "${amount} par mois",
  "compare.and": " et ",

  // ── Comment se lit la disponibilité d’une fonction ──────────────────────
  //
  // included et includedUsageExtra ne doivent JAMAIS se replier en une seule
  // phrase. La nôtre est la seconde : le réceptionniste est sur tous les
  // forfaits et le temps d’appel est du crédit prépayé, alors « dans le prix
  // du forfait » à côté de notre prix serait une fausse affirmation sur notre
  // propre prix, faite à quelqu’un qui rencontre une recharge au premier appel.
  "compare.availability.included": "dans le prix du forfait",
  "compare.availability.includedUsageExtra": "sur tous les forfaits, le temps d’appel s’achetant à part en crédit prépayé",
  "compare.availability.addOn": "un module payant en sus du forfait",
  "compare.availability.absent": "absente de ce palier",
  "compare.availability.unknown": "non établie",

  // ── La section des prix ─────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} poste, plus {crew} personnes sur le terrain sans frais",
  "compare.tierSeats": "{seats} postes, plus {crew} personnes sur le terrain sans frais",
  "compare.sameNumberBothCurrencies": "Le même chiffre dans chacune des devises où nous vendons ({currencies}) — ${price} dans chacune est un vrai prix FieldQuo, alors rien sur cette page n’a besoin d’être converti pour les aligner. La devise dans laquelle vous êtes facturé vient de l’adresse d’entreprise que vous donnez à l’inscription.",
  "compare.soldIn": "Vendu en {currencies}.",
  "compare.nothingPublishable": "Il n’y a rien sur la page de prix de {competitor} que nous puissions publier comme prix. Chaque montant que nous détenons est listé ci-dessous avec la raison pour laquelle il est retenu.",
  "compare.usersIncludedOne": "{count} utilisateur inclus",
  "compare.usersIncluded": "{count} utilisateurs inclus",
  "compare.unlimitedUsers": "Utilisateurs illimités, alors il n’y a pas de nombre de postes à comparer",
  "compare.currencyNotTheirs": "Le montant est le leur, tiré de leur propre page. La devise, non : {provenance}",
  "compare.withheldCountOne": "{count} prix {competitor} de plus n’est pas montré ici — soit le relevé est périmé, soit nous n’avons pas pu trancher ce que voulait dire le montant publié. Nous préférons laisser tomber une ligne plutôt qu’imprimer un chiffre que nous ne pouvons pas défendre.",
  "compare.withheldCount": "{count} prix {competitor} de plus ne sont pas montrés ici — soit le relevé est périmé, soit nous n’avons pas pu trancher ce que voulait dire le montant publié. Nous préférons laisser tomber une ligne plutôt qu’imprimer un chiffre que nous ne pouvons pas défendre.",

  // ── Leur gamme, dans leurs propres mots ─────────────────────────────────
  "compare.addsOverTier": "Ajoute par rapport au palier en dessous :",
  "compare.onThisTier": "Sur ce palier :",
  "compare.aiCreditsTier": "Leur page indique {count} crédits IA par mois sur ce palier.",
  "compare.thisListFrom": "Cette liste {provenance}",
  "compare.creditsAMonth": "{count} crédits par mois",

  // ── Le panneau du réceptionniste ────────────────────────────────────────
  "compare.receptionistTitle": "{feature} : ce que ça coûte de chaque côté",
  "compare.receptionistIntro": "Les paliers sont appariés selon ce qu’ils contiennent, pas selon leur place dans un tableau. Voici le palier {competitor} le moins cher dont nous avons vérifié qu’il le porte réellement.",
  "compare.receptionistUnknownIntro": "Celle-là, nous ne pouvons pas y répondre pour {competitor}.",
  "compare.featureOnThisTier": "La fonction est {availability} sur ce palier.",
  "compare.receptionistLowerDown": "Plus bas dans leur gamme, elle est {availability} : {price}{at}. C’est un plancher que vous payez dans un mois où le téléphone ne sonne jamais.",
  "compare.atCoordinates": " à {coordinates}",
  "compare.ourAvailability": "Elle est {availability}. Un mois sans appels ne coûte rien de ce côté.",
  "compare.theirWordsNotOurs": "Leurs forfaits sont décrits sur leur page dans leurs propres mots, et ce comparatif ne lira pas ces mots comme s’ils étaient les nôtres. Leur liste est ci-dessus, non retouchée, et c’est elle qu’il faut aller vérifier sur leur propre site.",

  // ── Là où nous sommes en avance, et là où nous ne le sommes pas ─────────
  "compare.readOnTheirSite": "Relevé sur leur site {checked}",
  "compare.theySay": "{competitor} dit : « {claim} ».",
  "compare.entryOursNothingBelowOne": "{seats} poste, plus {crew} personnes sur le terrain sans frais. Il n’y a rien en dessous.",
  "compare.entryOursNothingBelow": "{seats} postes, plus {crew} personnes sur le terrain sans frais. Il n’y a rien en dessous.",

  // ── Le face-à-face ──────────────────────────────────────────────────────
  "compare.case.eyebrow": "Côte à côte",
  "compare.case.headlineOurs": "Tout ce que FieldQuo fait coûte {price}.",
  "compare.case.headlineTheirs": "Chez {competitor}, la même liste est à {price}.",
  "compare.case.headlineTheirsAnnual": "Chez {competitor}, la même liste est à {price} par année.",
  "compare.case.headlineNoPricesOurs": "FieldQuo publie tous ses prix.",
  "compare.case.headlineNoPricesTheirs": "{competitor} n’en publie aucun.",
  "compare.case.sub": "Nous ne vendons pas les fonctions au palier. Chaque forfait a toutes les fonctions — les forfaits ne diffèrent que par le nombre de personnes qui s’y trouvent.",
  "compare.case.missingOne": "{count} chose de plus que {competitor} n’offre à aucun prix.",
  "compare.case.missing": "{count} choses de plus que {competitor} n’offre à aucun prix.",
  "compare.case.missingBody": "Elles sont toutes dans le forfait {plan}, à {price}.",
  "compare.case.shopTitle": "Ce que ça coûte pour une entreprise comme la vôtre",
  "compare.case.shopIntro": "{competitor} facture chaque accès. Nous facturons les gens qui chiffrent le travail ; tout le monde dans une camionnette fait partie de l’équipe de terrain, sans frais. L’écart grandit à chaque personne que vous embauchez.",
  "compare.case.shop1": "Vous et deux personnes dans une camionnette",
  "compare.case.shop2": "Deux estimateurs, quatre sur le terrain",
  "compare.case.shop3": "Une entreprise de onze personnes",
  "compare.case.shopSplit": "{estimators} qui chiffrent · {crew} sur le terrain",
  "compare.case.youKeep": "vous gardez",
  "compare.case.cheaperThere": "Moins cher chez eux à une personne.",
  "compare.case.calcBefore": "Entrez vos propres chiffres dans le",
  "compare.case.calcLink": "calculateur de coûts",
  "compare.case.calcAfter": "et voyez les cinq côte à côte.",
  "compare.case.wholeTitle": "Tout ce que vous obtenez, dans tous les forfaits",
  "compare.case.wholeIntro": "Pas une sélection de faits saillants — le produit au complet, et le fait qu’il apparaisse ou non quelque part dans les forfaits de {competitor}.",
  "compare.case.both": "Les deux",
  "compare.case.only": "FieldQuo seulement",

  // ── Les lignes du face-à-face ───────────────────────────────────────────
  "compare.rows.perMo": "{amount}/mois",
  "compare.rows.perYr": "{amount}/an",
  "compare.rows.usersOne": "{count} utilisateur",
  "compare.rows.users": "{count} utilisateurs",
  "compare.rows.unlimitedUsers": "utilisateurs illimités",
  "compare.rows.cheapestPlan": "Forfait le moins cher",
  "compare.rows.soloSub": "{plan} — 1 poste, {crew} personnes sur le terrain gratuites",
  "compare.rows.annualEquivalent": "{plan} — équivalent de {amount} par mois, facturé à l’année",
  "compare.rows.annualOnlyPlain": "{plan} — facturé à l’année",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Le forfait le moins cher qui porte ce que FieldQuo met dans tous les siens",
  "compare.rows.paritySub": "Le même forfait. Nous ne verrouillons pas les fonctions par palier.",
  "compare.rows.parityAnnual": "{plan} — équivalent de {amount} par mois",
  "compare.rows.parityTheirs": "{plan} — leurs forfaits moins chers ne le portent pas",
  "compare.rows.publishedPrice": "Prix publié",
  "compare.rows.everyPlanOnThisPage": "Tous les forfaits, sur cette page",
  "compare.rows.nonePublished": "Aucun publié",
  "compare.rows.bookDemo": "Réservez une démo ; le chiffre se négocie pendant l’appel",
  "compare.rows.whatItCosts": "Ce que ça coûte",
  "compare.rows.oneToTwentyFive": "1 à 25 personnes",
  "compare.rows.reportedNotPublished": "rapporté par des entrepreneurs, non publié",
  "compare.rows.setupFee": "Frais d’installation",
  "compare.rows.none": "Aucun",
  "compare.rows.reported": "rapporté",
  "compare.rows.howYouPay": "Comment vous payez",
  "compare.rows.monthly": "Mensuel",
  "compare.rows.leaveAnyMonth": "Partez à la fin de n’importe quel mois",
  "compare.rows.aYearUpFront": "{amount} par année, payé d’avance",
  "compare.rows.noMonthlyOption": "Aucune option mensuelle n’est offerte — leur FAQ le dit",
  "compare.rows.paidAddOns": "Vendu en modules payants",
  "compare.rows.everyFeature": "Toutes les fonctions sont dans tous les forfaits, au prix du forfait",
  "compare.rows.plusPerMo": "+{amount}/mois",
  "compare.rows.peopleInField": "Personnes sur le terrain",
  "compare.rows.free": "Gratuit",
  "compare.rows.crewFreeSub": "L’équipe de terrain voit l’horaire et le chantier sans frais",
  "compare.rows.billed": "Facturé",
  "compare.rows.everyLoginPaid": "Chez {competitor}, chaque accès est un utilisateur payant",
  "compare.rows.biggestPlan": "Forfait le plus gros",
  "compare.rows.biggestSub": "{seats} postes plus {crew} personnes sur le terrain — 25 personnes",
  "compare.rows.onRequest": "Sur demande",
  "compare.rows.everyPlan": "Tous les forfaits",
  "compare.rows.tierAtPrice": "{plan} — {amount}/mois",
  "compare.rows.tierAtAnnualPrice": "{plan} — {amount}/an",
  "compare.rows.theirCheapestWithIt": "leur forfait le moins cher qui l’inclut",
  "compare.rows.notInTheirPlans": "Absent de leurs forfaits",
  "compare.rows.freeTrial": "Essai gratuit",
  "compare.rows.firstMonthFree": "Premier mois gratuit",
  "compare.rows.noCardCharged": "Aucune carte débitée avant la fin",
  "compare.rows.trialOffered": "Essai offert",
  "compare.rows.seeTheirSite": "voyez leur site pour les conditions en vigueur",

  // ── La pile de modules ──────────────────────────────────────────────────
  //
  // Rendu sur /compare/fieldquo-vs-jobber ET sur /pricing. Ce sont les clés
  // que le rapport du propriétaire visait vraiment : le bloc appelait t() avec
  // des replis anglais et aucune entrée de catalogue derrière, alors chaque
  // langue retombait sur l’anglais.
  "addOns.title": "{count} choses que {competitor} facture en supplément",
  "addOns.intro": "Ils s’ajoutent au forfait sur leur propre page de prix, chacun avec son prix mensuel. Chacun d’eux est du travail que FieldQuo fait à l’intérieur du forfait que vous payez déjà.",
  "addOns.scope": "Nous avons relevé le nom et le prix sur leur page de prix, et rien d’autre. Ce qu’il y a dans leur module, nous ne l’avons pas vérifié, alors rien de ce qui suit ne le décrit.",
  "addOns.money": "${amount} {currency} par {per}",
  "addOns.provenance": "Relevé depuis une connexion {country} le {checked}",
  "addOns.sourceLink": "leur page de prix",
  "addOns.oursTitle": "Dans FieldQuo, sur tous les forfaits :",
  "addOns.limits": "Là où ça s’arrête :",
  "addOns.total": "{total} {currency} par mois, par-dessus le prix du forfait.",
  "addOns.totalBody": "C’est ce que ces trois-là coûtent ensemble au réglage de leurs propres sélecteurs où nous les avons relevés. Dans FieldQuo, ces trois mêmes tâches sont dans tous les forfaits, à toutes les tailles, à partir du moins cher de cette page.",
  "addOns.receptionist": "Leur module de réceptionniste est un plancher mensuel : il est facturé dans un mois où le téléphone ne sonne jamais. Le nôtre n’a pas de minimum mensuel. La fonction est sur tous les forfaits et le temps d’appel est du crédit prépayé que vous achetez quand vous en avez besoin, alors un février tranquille ne coûte rien de ce côté.",

  // ── La ligne propre à /pricing sous la pile de modules ──────────────────
  //
  // Référencée par PricingPlans.js depuis l’écriture du bloc et jamais
  // définie, ce qui est la seconde moitié du même bogue rapporté.
  "pricing.addOnsCompare": "Chaque montant ci-dessus a été relevé sur leur propre page de prix, à la date indiquée. Le comparatif complet, y compris ce que FieldQuo ne fait pas, est ici →",
};

export default fr;
