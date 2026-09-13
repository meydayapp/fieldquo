// app/i18n/comparePages/tl.js
//
// Tagalog. Drafted, not natively authored — read the note in ./index.js before
// treating any sentence here as settled, and put the concessions in front of a
// native speaker first.
//
// ══ Register ══════════════════════════════════════════════════════════════
//
// The same voice as the `tl` block in app/i18n/messages.js: plain Tagalog with
// the English business term left standing wherever a Filipino contractor
// actually says it — quote, invoice, plano, tier, seat, crew, add-on, booking,
// receptionist, dashboard. Inventing a Tagalog coinage for "tier" would make a
// reader stop and translate it back, which on a comparison page is a reader who
// has lost the thread of an argument about money.
//
// ══ The sentences that were hardest, and why they read the way they do ═════
//
// The hedges are deliberately awkward. compare.matchUnknownIntro,
// compare.unverifiedConcessionNote and compare.theirTiersNoMatchNote say we did
// not check — NOT that the competitor lacks the thing. Tagalog offers a much
// smoother "wala sila niyan" for all three and it is the wrong sentence: it
// converts an admission of ignorance into a claim about a named company. The
// clumsier "hindi namin ito tiningnan" is kept everywhere for that reason.
//
// compare.availability.included and .includedUsageExtra stay two distinct
// sentences here as they do in English; collapsing them would promise free talk
// time in Tagalog that the English never promised.
//
// Unsure, flagged for a native reviewer: "baitang" for the pricing "rung"
// (compare.entryGapIntro, .capability.entry_price_below_our_floor) reads a shade
// literary; "natitipid mo" for compare.case.youKeep interprets a fragment whose
// English is ambiguous out of context.

const tl = {
  "compare.eyebrow": "Paghahambing",
  "compare.indexTitle": "Ikumpara ang FieldQuo",
  "compare.indexLede": "Limang paghahambing, bawat isa ay hango sa kung ano ang inilalathala ng kabilang kumpanya sa sarili nitong website. Walang kinonvert na currency dito, walang promotional na presyo, at ang hindi namin natiyak ay pinapangalanan sa halip na hulaan. Isa sa lima ang mas mura ang simula kaysa sa amin, at sinasabi iyon ng page na iyon bago pa ang kahit anong iba.",
  "compare.rulesTitle": "Paano binubuo ang mga page na ito",
  "compare.entryGapTitle": "Mas mura ang simula nila kaysa sa amin",
  "compare.entryGapIntro": "Hindi lahat ng paghahambing sa site na ito ay pabor sa amin, at hindi pabor ang isang ito. Ang dalawang presyo sa ibaba ay ang inilathala nilang halaga at ang pinakamurang baitang namin, parehong hango sa mismong mga talang ginagamit ng buong page na ito.",
  "compare.entryGapTheirListIntro": "Ang nakalista sa sarili nilang page para sa planong iyon, sa sarili nilang salita:",
  "compare.entryGapAdvice": "Kung iyon ang trabahong kailangan mong maipagawa, sa kanila ka bumili. Mas gusto pa naming isulat iyan dito kaysa magbenta sa isang tao ng software na mas malaki kaysa sa gagamitin niya at magkita kaming muli sa refund. Ang nagpapabago ng sagot ay ang crew: sa mga plano nila, bawat login ay bayad na user; sa amin, hindi.",
  "compare.theirTiersTitle": "Ano ang idinaragdag ng bawat plano nila, sa sarili nilang salita",
  "compare.theirTiersIntro": "Ang sarili nilang paglalarawan sa sarili nilang mga tier, sinipi gaya ng paghaharap ng page nila at itinabi sa presyong inaabot ng bawat isa. Wala kaming isinaling anuman dito sa bokabularyo namin: ang pagpapalit ng pangalan sa feature ng isang kakumpitensya para tumugma sa amin ang tahimik na paraan para maging straw man ang isang paghahambing, kaya kanila ang mga salita sa ibaba at ang listahan namin ay nasa mas ibaba pa ng page na ito, hiwalay.",
  "compare.theirTiersNoMatchNote": "Walang nakapagtatag, feature bawat feature, kung aling tier nila ang may dala ng alin sa mga kakayahang ibinebenta namin. Inilalarawan ng page nila ang mga plano nito sa talata at walang naitalang sagot kada tier ang pananaliksik namin, kaya walang itinutugmang inaangkin ang page na ito sa alinmang panig — basahin ang listahan nila, basahin ang sa amin, at magpasya.",
  "compare.matchUnknownIntro": "Walang nakapagtatag kung aling tier nila ang may dala nito, kaya walang pinapangalanan ang page na ito. Hindi iyon pagsasabing wala sila nito — hindi namin ito tiningnan, at ang page na ipinapalagay na kawalan ang hindi nito tiningnan ay page na gumagawa-gawa lang.",
  "compare.aiMeteringTitle": "Paano sinusukat ng bawat panig ang AI nito",
  "compare.aiMeteringIntro": "Ang sa kanila ay ibinebenta bilang buwanang allowance na nagbabago ayon sa tier, nakalimbag sa sarili nilang page. Hindi ganoon ibinebenta ang sa amin, at may dalawang kalahati ang tapat na bersyon ng pangungusap na iyon.",
  "compare.aiMeteringOurs": "Hindi nagbebenta ang FieldQuo ng AI kada credit: walang allowance kada plano sa pricing page namin na maaaring maubos at walang mas malaking bundle na kailangang akyatin. Nasa bawat plano ang receptionist, at ang talk time ay hiwalay na binibili bilang prepaid credit na walang buwanang minimum, kaya ang buwang walang tawag ay walang bayad para dito. Ang kabilang kalahati, na nararapat ding nandito: sinusukat ang paggamit ng model kada kumpanya laban sa isang hangganang kami ang nagtatakda sa loob, kaya walang sinasabi sa page na ito na walang limitasyon ito.",
  "compare.concessionTitle": "Ang hindi ginagawa ng FieldQuo",
  "compare.concessionIntro": "Nasa bawat isa sa mga page na ito ang seksyong ito, sa parehong lugar, sa itaas ng bahaging maganda ang dating namin. Ang comparison table na puro panalo namin ang laman ay nagbebenta sa isang tao ng subscription na hihingian niya ng refund.",
  "compare.unverifiedConcessionNote": "Hindi namin tiningnan kung inaalok ito ng kumpanyang ito, kaya hindi namin sinasabing inaalok nila.",
  "compare.staleClaimNote": "Mahigit tatlong buwan na ang pagbasang iyon, kaya pinipigil muna ang anumang halagang nasa loob nito hanggang may muling tumingin sa page nila. Sundan ang link at tingnan kung ano ang sinasabi nito ngayon.",
  "compare.advantageTitle": "Kung saan nangunguna ang FieldQuo",
  "compare.advantageIntro": "Bawat isa sa mga ito ay binasa mula sa sarili nilang page sa petsang nakalagay. Sundan ang link at tingnan ito — iyan ang silbi ng link.",
  "compare.priceTitle": "Presyo, gaya ng inilalathala ng bawat kumpanya",
  "compare.featuresTitle": "Ano ang makukuha mo sa FieldQuo",
  "compare.featuresIntro": "Bawat linya sa ibaba ay feature na may totoong implementasyon sa likod nito. Ang listahan ay ginagawa mula sa parehong talaang sinusuri ng mga engineering check, kaya ang feature na tumigil sa paggana ay tumitigil ding maipagmalaki rito.",
  "compare.ctaTitle": "Libre ang unang buwan kapag may nakatalang card, at mababasa mo ang presyo bago ka magsimula",
  "compare.ctaBody": "Walang tawag na kailangang i-book, at nasa pricing page ang presyo sa halip na nakatago sa likod ng form. Kukunin ang card mo sa pag-sign up at hindi ito sisingilin hangga't hindi natatapos ang libreng buwan.",
  "compare.ctaButton": "Simulan ang libreng buwan mo",
  "compare.ctaSecondary": "Tingnan ang presyo",
  "compare.otherPagesTitle": "Ang ibang mga paghahambing",
  "compare.rule.1": "Bawat presyo ay ang regular na presyong inililimbag ng kumpanya sa sarili nitong pricing page. Hindi kasama ang mga sale price: ang page na tulad nito ay ginagawa nang minsan at inihahain nang ilang buwan, at hindi nito mapapansing natapos na ang isang alok.",
  "compare.rule.2": "Nananatili ang pera sa currency na pinaglathalaan nito. Hindi kami nagko-convert. Tama ang isang exchange rate sa araw na tiningnan mo at mali na kinabukasan, at ang kinonvert na numerong nakaupo sa isang static na page ay aritmetikang walang tumitingin.",
  "compare.rule.3": "Kung saan hindi namin natiyak kung ano ang ibig sabihin ng isang numero, sinasabi iyon ng hilera at walang ipinapakitang numero. Mas madalas itong mangyari kaysa sa inaakala mo, at ito ang bahagi ng page na pinakatiwala namin.",
  "compare.rule.4": "Bawat numero ay may dalang petsa kung kailan ito binasa at ang bansang pinagbasahan, dahil maaaring magkaiba ang presyo dahil sa dalawang iyon.",

  "compare.lede.jobber": "Ibinebenta ng Jobber ang marketing suite nito, ang AI receptionist nito at ang sales pipeline nito bilang magkakahiwalay na buwanang add-on — {addOnTotal} kada buwan sa ibabaw ng planong ang presyo ay gumagalaw na ayon sa laki ng team mo. Inilalagay ng FieldQuo ang tatlo sa bawat plano, sa bawat presyo, at libre ang lahat ng nasa van.",
  "compare.concession.jobber": "Magsimula tayo sa wala sa amin. Ang FieldQuo ay isang web application: walang ii-install mula sa app store, walang gumagana nang walang signal, at walang salesperson na gagabay sa iyo dito.",
  "compare.lede.housecall_pro": "Naniningil ang Housecall Pro sa bawat dagdag na user, kaya ang presyo ng plano ay simula pa lang ng bill mo. Sinisingil ng FieldQuo ang mga taong talagang nagpepresyo ng trabaho — quotes, jobs, invoices — at ang lahat ng nasa van ay crew, walang bayad. Nasa bawat plano ang bawat feature, simula sa {ourEntry}.",
  "compare.concession.housecall_pro": "Ang tapat na bahagi muna. Nakalista sa page ng Housecall Pro ang phone app, offline na access at gabay na demo bilang standard. Wala ang FieldQuo sa tatlong iyon, at kung alinman doon ang magpapasya para sa iyo, sila ang mas magandang bilhin.",
  "compare.lede.servicetitan": "Walang kahit saang halaga sa dolyar ang pricing page ng ServiceTitan — magbu-book ka ng demo at ang numero ay pinag-uusapan laban sa kita mo at sa dami ng tauhan mo. May mga kontratistang nag-uulat ng buwanang bayad kada technician sa ibabaw ng limang-digit na singil sa implementasyon at kontratang tatagal ng ilang taon. Nasa page na ito ang bawat presyo ng FieldQuo, walang setup fee, at maaari kang magsimula ngayong gabi nang hindi kailangang makipag-usap kaninuman.",
  "compare.concession.servicetitan": "Ang hindi namin maiaalok, sabihin na muna: walang phone app, walang gumagana kapag wala sa network, at walang taong maglilibot sa iyo bago ka magpasya.",
  "compare.lede.projul": "Humihingi ang Projul ng patag na taunang commitment nang maaga. Ang FieldQuo ay {ourEntry} kada buwan para sa isang seat at limang crew, kasama ang bawat feature, at maaari kang umalis sa katapusan ng kahit anong buwan — hindi mo kailangang bumili ng isang taon para malaman kung bagay ba ito sa iyo.",
  "compare.concession.projul": "Bago ang iba pa: walang phone app ang FieldQuo, hindi ito gumagana nang walang signal, at walang taong magpapakita nito sa iyo. Ang Projul ay magbu-book sa iyo ng demo.",
  "compare.lede.quoteiq": "Nagsisimula ang QuoteIQ sa {theirEntry}, at hindi kayang gawan ka ng website ng planong iyon, hindi rin makatanggap ng booking, ni hindi rin nito mapapapresyo ng may-bahay ang sarili niyang trabaho. Ang planong QuoteIQ na may dala ng inilalagay ng FieldQuo sa bawat plano ay ang Max tier nila, sa {theirParity} kada buwan. Ang sa amin ay {ourEntry} — at apatnapu't isang bagay sa listahan namin ang wala sa hanay nila sa kahit anong presyo.",
  "compare.concession.quoteiq": "Presyo muna, dahil iyan ang pinunta mong tingnan. Nagsisimula ang QuoteIQ sa ilalim ng pinakamura naming plano, may mga phone app silang wala sa amin, at magbu-book sila sa iyo ng walkthrough. Ang FieldQuo ay isang web application na walang kasamang salesperson.",

  "compare.counterpoint.projul.monthly_billing": "Ipinaglalaban ng page nila ang taunang plano at makatuwiran naman ito: sabi ng Projul, walang bayad kada user ang presyo nito at walang hangganan sa dami ng proyekto. Ang shop na madalas magdagdag ng tao ay maaaring mas mabuti pa roon.",

  "compare.capability.mobile_app": "Native na mobile app (iOS / Android)",
  "compare.capability.offline_use": "Gumagana kahit offline",
  "compare.capability.self_serve_demo": "Mag-book ng gabay na demo kasama ang isang salesperson",
  "compare.capability.accounting_sync": "Two-way sync sa QuickBooks o Xero",
  "compare.capability.gantt_charts": "Gantt chart at magkakaugnay na timeline ng proyekto",
  "compare.capability.purchase_orders": "Purchase order sa mga supplier",
  "compare.capability.daily_logs": "Araw-araw na log sa site",
  "compare.capability.geofencing": "Geolocation at geofenced na clock-in",
  "compare.capability.field_worker_quotes": "Kayang magpresyo at magpadala ng quote ng field crew mula mismo sa van",
  "compare.capability.entry_price_below_our_floor": "Bayad na planong mas mababa sa pinakamurang baitang ng FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "AI phone receptionist sa bawat plano, walang buwanang minimum",
  "compare.capability.bank_debit_capped": "Bank debit sa Canada na may limit na limang dolyar bawat bayad",
  "compare.capability.self_serve_signup": "Mag-sign up at magsimula nang walang kausap na kahit sino",
  "compare.capability.published_price": "Hayagang inilathalang presyo, walang sales call",
  "compare.capability.monthly_billing": "Buwanang bayad, walang kailangang taunang commitment",
  "compare.capability.free_crew_seats": "Kasama ang field crew nang libre — ang mga taong pinagmumulan ng pera lang ang sinisingil",

  "compare.teamSize.solo": "Ako lang",
  "compare.teamSize.2-5": "2-5 katao",
  "compare.teamSize.6-10": "6-10 katao",
  "compare.teamSize.11-15": "11-15 katao",
  "compare.teamSize.16-plus": "16 pataas",
  "compare.billing.annual_prepaid": "Taunan, bayad nang maaga",
  "compare.billing.monthly_1yr": "Buwanan, 1 taong commitment",
  "compare.billing.monthly_none": "Buwanan, walang commitment",

  "compare.comparableFeature.ai_receptionist": "AI phone receptionist",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo laban sa {competitor}",
  "compare.preparedAsOf": "Inihanda noong {date}.",
  "compare.preparedAsOfLong": "Inihanda noong {date}. Ang bawat numero sa ibaba ay may dala ring araw kung kailan ito binasa at ang bansang pinagbasahan.",
  "compare.readComparison": "Basahin ang paghahambing",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} sa mga inilathala nilang presyo ang maitatabi sa amin, sa currency na inilimbag nila.",
  "compare.summary.amounts": "{count} sa mga inilathala nilang presyo ang maitatabi sa amin.",
  "compare.summary.asserted": "{count} doon ang walang pinapangalanang currency sa sarili nilang page, kaya sinasabi ng paghahambing kung kaninong pasya ang currency sa halip na ilimbag ito bilang kanila.",
  "compare.summary.onRequest": "{count} sa mga tier nila ang walang inilalathalang halaga at hinihiling na humingi ka nito.",
  "compare.summary.none": "Walang inilalathala sila na maikukumpara sa isang presyo ng FieldQuo.",
  "compare.summary.withheldOne": "{count} pang numero ang pinipigil, ipinapakita kasama ang dahilan.",
  "compare.summary.withheld": "{count} pang numero ang pinipigil, bawat isa ay ipinapakita kasama ang dahilan.",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} resolves through
  // compare.per.* below so the preposition is Tagalog's, not English's.
  "compare.price.amount": "${amount} {currency} kada {per}",
  "compare.price.free": "Libre ({currency})",
  "compare.price.onRequest": "Walang inilathalang presyo — ang sabi ng page nila ay “{ask}”",
  "compare.price.notOffered": "Hindi ibinebenta sa laking ito",
  "compare.per.month": "buwan",
  "compare.per.year": "taon",
  "compare.pricePerMonth": "${amount} kada buwan",
  "compare.and": " at ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: "nasa presyo ng plano" beside our own price would
  // promise talk time a caller meets a top-up for on their first call.
  "compare.availability.included": "nasa presyo ng plano",
  "compare.availability.includedUsageExtra": "nasa bawat plano, at ang talk time ay hiwalay na binibili bilang prepaid credit",
  "compare.availability.addOn": "bayad na add-on sa ibabaw ng plano",
  "compare.availability.absent": "wala sa tier na iyon",
  "compare.availability.unknown": "hindi natiyak",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} seat, kasama ang {crew} crew nang walang bayad",
  "compare.tierSeats": "{seats} seats, kasama ang {crew} crew nang walang bayad",
  "compare.sameNumberBothCurrencies": "Iisang numero sa bawat currency na ibinebenta namin ({currencies}) — ang ${price} sa bawat isa ay totoong presyo ng FieldQuo, kaya walang kailangang i-convert sa page na ito para maipantay sila. Ang currency na sisingilin sa iyo ay nagmumula sa business address na ibibigay mo sa pag-sign up.",
  "compare.soldIn": "Ibinebenta sa {currencies}.",
  "compare.nothingPublishable": "Walang anuman sa pricing page ng {competitor} na maaari naming ilathala bilang presyo. Bawat numerong hawak namin ay nakalista sa ibaba kasama ang dahilan kung bakit ito pinipigil.",
  "compare.usersIncludedOne": "{count} user ang kasama",
  "compare.usersIncluded": "{count} na user ang kasama",
  "compare.unlimitedUsers": "Walang limitasyong user, kaya walang bilang ng seat na maikukumpara",
  "compare.currencyNotTheirs": "Kanila ang halaga, mula sa sarili nilang page. Hindi kanila ang currency: {provenance}",
  "compare.withheldCountOne": "{count} pang presyo ng {competitor} ang hindi ipinapakita rito — maaaring luma na ang pagbasa, o hindi namin natiyak kung ano ang ibig sabihin ng inilathalang numero. Mas gusto pa naming huwag maglagay ng hilera kaysa maglimbag ng numerong hindi namin matatayuan.",
  "compare.withheldCount": "{count} pang presyo ng {competitor} ang hindi ipinapakita rito — maaaring luma na ang pagbasa, o hindi namin natiyak kung ano ang ibig sabihin ng mga inilathalang numero. Mas gusto pa naming huwag maglagay ng hilera kaysa maglimbag ng numerong hindi namin matatayuan.",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "Idinaragdag sa tier na nasa ilalim nito:",
  "compare.onThisTier": "Sa tier na ito:",
  "compare.aiCreditsTier": "Sinasabi ng page nila na {count} AI credit kada buwan sa tier na ito.",
  "compare.thisListFrom": "Ang listahang ito {provenance}",
  "compare.creditsAMonth": "{count} credit kada buwan",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: magkano ito sa bawat panig",
  "compare.receptionistIntro": "Itinutugma ang mga tier ayon sa laman nila, hindi sa kung saan sila nakaupo sa talahanayan. Ito ang pinakamurang tier ng {competitor} na napatunayan naming may dala talaga nito.",
  "compare.receptionistUnknownIntro": "Hindi namin masasagot ang isang ito para sa {competitor}.",
  "compare.featureOnThisTier": "Ang feature ay {availability} sa tier na ito.",
  "compare.receptionistLowerDown": "Sa mas mababang bahagi ng hanay nila ito ay {availability}: {price}{at}. Iyan ay minimum na babayaran mo sa buwang hindi tumunog ang telepono.",
  "compare.atCoordinates": " sa {coordinates}",
  "compare.ourAvailability": "Ito ay {availability}. Ang buwang walang tawag ay walang bayad para dito.",
  "compare.theirWordsNotOurs": "Inilalarawan ang mga plano nila sa page nila sa sarili nilang salita, at hindi babasahin ng paghahambing na ito ang mga salitang iyon bilang sa amin. Nasa itaas ang listahan nila, hindi binago, at iyon ang dapat tingnan sa sarili nilang site.",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "Binasa sa site nila {checked}",
  "compare.theySay": "Sabi ng {competitor}: “{claim}”.",
  "compare.entryOursNothingBelowOne": "{seats} seat, kasama ang {crew} crew nang walang bayad. Wala nang mas mababa pa rito.",
  "compare.entryOursNothingBelow": "{seats} seats, kasama ang {crew} crew nang walang bayad. Wala nang mas mababa pa rito.",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "Magkatabi",
  "compare.case.headlineOurs": "Lahat ng ginagawa ng FieldQuo ay nagkakahalaga ng {price}.",
  "compare.case.headlineTheirs": "Sa {competitor}, ang parehong listahan ay {price}.",
  "compare.case.headlineTheirsAnnual": "Sa {competitor}, ang parehong listahan ay {price} kada taon.",
  "compare.case.headlineNoPricesOurs": "Inilalathala ng FieldQuo ang bawat presyo.",
  "compare.case.headlineNoPricesTheirs": "Ang {competitor} ay wala ni isang inilalathala.",
  "compare.case.sub": "Hindi namin ibinebenta ang mga feature kada tier. Bawat plano ay may bawat feature — sa dami lang ng taong nakalagay dito nagkakaiba ang mga plano.",
  "compare.case.missingOne": "{count} pang bagay na hindi inaalok ng {competitor} sa kahit anong presyo.",
  "compare.case.missing": "{count} pang bagay na hindi inaalok ng {competitor} sa kahit anong presyo.",
  "compare.case.missingBody": "Lahat ng iyon ay nasa planong {plan} sa {price}.",
  "compare.case.shopTitle": "Magkano ito para sa shop na tulad ng sa iyo",
  "compare.case.shopIntro": "Sinisingil ng {competitor} ang bawat login. Sinisingil namin ang mga taong nagpepresyo ng trabaho; ang lahat ng nasa van ay crew, walang bayad. Lumalaki ang agwat na iyan sa bawat taong kukunin mo.",
  "compare.case.shop1": "Ikaw at dalawa sa isang van",
  "compare.case.shop2": "Dalawang estimator, apat sa field",
  "compare.case.shop3": "Isang shop na labing-isa ang tao",
  "compare.case.shopSplit": "{estimators} nagpepresyo ng trabaho · {crew} nasa field",
  "compare.case.youKeep": "natitipid mo",
  "compare.case.cheaperThere": "Mas mura roon kapag isang tao lang.",
  "compare.case.calcBefore": "Ilagay ang sarili mong mga numero sa",
  "compare.case.calcLink": "cost calculator",
  "compare.case.calcAfter": "at tingnan ang lahat ng lima nang magkatabi.",
  "compare.case.wholeTitle": "Lahat ng makukuha mo, sa bawat plano",
  "compare.case.wholeIntro": "Hindi ito piling-pili lang — ang buong produkto, at kung lumalabas ba ito kahit saan sa mga plano ng {competitor}.",
  "compare.case.both": "Pareho",
  "compare.case.only": "Sa FieldQuo lang",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/buwan",
  "compare.rows.perYr": "{amount}/taon",
  "compare.rows.usersOne": "{count} user",
  "compare.rows.users": "{count} na user",
  "compare.rows.unlimitedUsers": "walang limitasyong user",
  "compare.rows.cheapestPlan": "Pinakamurang plano",
  "compare.rows.soloSub": "{plan} — 1 seat, {crew} crew nang libre",
  "compare.rows.annualEquivalent": "{plan} — katumbas ng {amount} kada buwan, sinisingil bilang isang taon",
  "compare.rows.annualOnlyPlain": "{plan} — sinisingil bilang isang taon",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Pinakamurang planong may laman ng inilalagay ng FieldQuo sa bawat plano",
  "compare.rows.paritySub": "Iisang plano lang. Hindi namin kinakandado ang mga feature kada tier.",
  "compare.rows.parityAnnual": "{plan} — katumbas ng {amount} kada buwan",
  "compare.rows.parityTheirs": "{plan} — wala nito ang mas murang mga plano nila",
  "compare.rows.publishedPrice": "Inilathalang presyo",
  "compare.rows.everyPlanOnThisPage": "Bawat plano, nasa page na ito",
  "compare.rows.nonePublished": "Walang inilathala",
  "compare.rows.bookDemo": "Mag-book ng demo; ang numero ay pinag-uusapan sa tawag",
  "compare.rows.whatItCosts": "Magkano ito",
  "compare.rows.oneToTwentyFive": "1 hanggang 25 katao",
  "compare.rows.reportedNotPublished": "iniulat ng mga kontratista, hindi inilathala",
  "compare.rows.setupFee": "Setup fee",
  "compare.rows.none": "Wala",
  "compare.rows.reported": "iniulat",
  "compare.rows.howYouPay": "Paano ka magbabayad",
  "compare.rows.monthly": "Buwanan",
  "compare.rows.leaveAnyMonth": "Umalis sa katapusan ng kahit anong buwan",
  "compare.rows.aYearUpFront": "{amount} kada taon, bayad nang maaga",
  "compare.rows.noMonthlyOption": "Walang inaalok na buwanang opsyon — sabi mismo ng FAQ nila",
  "compare.rows.paidAddOns": "Ibinebenta bilang bayad na add-on",
  "compare.rows.everyFeature": "Nasa bawat plano ang bawat feature, sa presyo ng plano",
  "compare.rows.plusPerMo": "+{amount}/buwan",
  "compare.rows.peopleInField": "Mga tao sa field",
  "compare.rows.free": "Libre",
  "compare.rows.crewFreeSub": "Nakikita ng crew ang iskedyul at ang trabaho nang walang bayad",
  "compare.rows.billed": "Sinisingil",
  "compare.rows.everyLoginPaid": "Sa {competitor}, bawat login ay bayad na user",
  "compare.rows.biggestPlan": "Pinakamalaking plano",
  "compare.rows.biggestSub": "{seats} seats kasama ang {crew} crew — 25 katao",
  "compare.rows.onRequest": "Kapag hiniling",
  "compare.rows.everyPlan": "Bawat plano",
  "compare.rows.tierAtPrice": "{plan} — {amount}/buwan",
  "compare.rows.tierAtAnnualPrice": "{plan} — {amount}/taon",
  "compare.rows.theirCheapestWithIt": "ang pinakamura nilang planong may kasamang ito",
  "compare.rows.notInTheirPlans": "Wala sa mga plano nila",
  "compare.rows.freeTrial": "Libreng subok",
  "compare.rows.firstMonthFree": "Libre ang unang buwan",
  "compare.rows.noCardCharged": "Walang sisingiling card hangga't hindi ito natatapos",
  "compare.rows.trialOffered": "May inaalok na subok",
  "compare.rows.seeTheirSite": "tingnan ang site nila para sa kasalukuyang tuntunin",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing, so these read on
  // two pages with different surrounding copy — keep them self-contained.
  "addOns.title": "{count} bagay na may dagdag-singil sa {competitor}",
  "addOns.intro": "Nakapatong ang mga ito sa plano sa sarili nilang pricing page, bawat isa ay may sariling buwanang presyo. Bawat isa sa kanila ay trabahong ginagawa ng FieldQuo sa loob ng planong binabayaran mo na.",
  "addOns.scope": "Ang pangalan at ang presyo lang ang binasa namin sa pricing page nila, wala nang iba. Ang laman ng add-on nila ay hindi namin tiningnan, kaya walang naglalarawan nito sa ibaba.",
  "addOns.money": "${amount} {currency} kada {per}",
  "addOns.provenance": "Binasa mula sa koneksyong {country} noong {checked}",
  "addOns.sourceLink": "ang pricing page nila",
  "addOns.oursTitle": "Sa FieldQuo, sa bawat plano:",
  "addOns.limits": "Kung saan ito nagtatapos:",
  "addOns.total": "{total} {currency} kada buwan, sa ibabaw ng presyo ng plano.",
  "addOns.totalBody": "Iyan ang halaga ng tatlong iyon nang magkakasama sa puntong binasa namin sa sarili nilang mga selector. Sa FieldQuo, ang parehong tatlong trabaho ay nasa bawat plano, sa bawat laki, mula sa pinakamura sa page na ito.",
  "addOns.receptionist": "Ang receptionist add-on nila ay buwanang minimum: sinisingil ito sa buwang hindi man lang tumunog ang telepono. Ang sa amin ay walang buwanang minimum. Nasa bawat plano ang feature at ang talk time ay prepaid credit na binibili mo kapag kailangan mo, kaya ang tahimik na Pebrero ay walang bayad para dito.",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  "pricing.addOnsCompare": "Bawat numero sa itaas ay binasa mula sa sarili nilang pricing page, sa petsang nakalagay. Ang buong magkatabing paghahambing, kasama ang hindi ginagawa ng FieldQuo, ay narito →",
};

export default tl;
