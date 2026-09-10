// app/i18n/comparePages/it.js
//
// Italian /compare catalogue. Formal third person ("Lei") throughout, which is
// what the `it` block of app/i18n/messages.js already uses on every marketing
// surface — a contractor being sold software is addressed politely, not as "tu".
//
// Vocabulary pinned to messages.js so the two files cannot drift: seat is
// "postazione" (pricing.seatsOneIncluded), crew is "squadra"
// (pricing.crewIncluded), and the AI phone receptionist is "centralino AI"
// (feature.voice_receptionist.name) rather than a literal "receptionist".
//
// One structural change, deliberate: compare.per.month / .year carry the
// preposition ("al mese", "all'anno") and compare.price.amount / addOns.money
// drop the English "per". Italian cannot build "al {per}" from a bare noun —
// "al anno" is wrong — and those two carriers are the only readers of
// compare.per.*, so folding the article in is safe. Keys and placeholders are
// untouched.
//
// Three values arrive from the data layer already in English and are never
// translated: {ask} (their button's own words), {claim} (a recorded quotation)
// and {provenance} (provenanceLabel in lib/marketing/competitors.js takes no
// t). compare.thisListFrom therefore takes a colon before it — "Questo elenco
// read off their own page" would be neither language.
//
// The concessions — unverifiedConcessionNote, staleClaimNote,
// matchUnknownIntro, theirTiersNoMatchNote, aiMeteringOurs — are kept exactly
// as narrow as the English. "Non abbiamo verificato" never becomes "non ce
// l'hanno".

const it = {
  "compare.eyebrow": "Confronto",
  "compare.indexTitle": "Confronta FieldQuo",
  "compare.indexLede": "Cinque confronti, ciascuno costruito su quello che l'altra azienda pubblica sul proprio sito. Qui non c'è nulla di convertito da una valuta all'altra, nulla che sia un prezzo promozionale, e tutto ciò che non siamo riusciti a stabilire viene detto invece che indovinato. Uno dei cinque parte più in basso di noi, e quella pagina lo dice prima di dire qualsiasi altra cosa.",
  "compare.rulesTitle": "Come sono fatte queste pagine",
  "compare.entryGapTitle": "Partono più in basso di noi",
  "compare.entryGapIntro": "Non tutti i confronti di questo sito ci danno ragione, e questo non lo fa. I due prezzi qui sotto sono la loro cifra pubblicata e il nostro gradino più economico, letti entrambi dagli stessi registri che usa il resto della pagina.",
  "compare.entryGapTheirListIntro": "Che cosa elenca la loro pagina su quel piano, con parole loro:",
  "compare.entryGapAdvice": "Se il lavoro che le serve è quello, compri il loro. Preferiamo scriverlo qui piuttosto che vendere a qualcuno più software di quanto ne usi e ritrovarcelo davanti al rimborso. A cambiare la risposta è la squadra: i loro piani contano ogni accesso come utente a pagamento, i nostri no.",
  "compare.theirTiersTitle": "Che cosa aggiunge ciascuno dei loro piani, con parole loro",
  "compare.theirTiersIntro": "Le loro descrizioni dei loro livelli, citate come le presenta la loro pagina e messe accanto al prezzo a cui ciascuno arriva. Non ne abbiamo riscritto niente nel nostro vocabolario: ribattezzare la funzionalità di un concorrente perché somigli a una delle nostre è il modo in cui un confronto diventa in silenzio un fantoccio, quindi le parole qui sotto sono le loro e l'elenco delle nostre sta più in basso in questa pagina, separato.",
  "compare.theirTiersNoMatchNote": "Nessuno ha stabilito, funzionalità per funzionalità, quale dei loro livelli porti quali delle capacità che vendiamo noi. La loro pagina descrive i piani in prosa e la nostra ricerca non registra alcuna risposta livello per livello, quindi questa pagina non afferma alcuna corrispondenza né in un senso né nell'altro — legga il loro elenco, legga il nostro, e decida.",
  "compare.matchUnknownIntro": "Nessuno ha stabilito quale dei loro livelli lo comprenda, quindi questa pagina non ne indica nessuno. Non è un'affermazione che a loro manchi — non abbiamo verificato, e una pagina che tratta come assenza ciò che non ha verificato è una pagina che si inventa le cose.",
  "compare.aiMeteringTitle": "Come ciascuna delle due parti conteggia la propria AI",
  "compare.aiMeteringIntro": "La loro è venduta come un plafond mensile che cambia con il livello, stampato sulla loro pagina. La nostra non è venduta così, e la versione onesta di quella frase ha due metà.",
  "compare.aiMeteringOurs": "FieldQuo non vende l'AI a crediti: sulla nostra pagina prezzi non c'è un plafond per piano che si possa esaurire, né un pacchetto più grande per cui salire di livello. Il centralino è su ogni piano, con i minuti di conversazione acquistati a parte come credito prepagato e senza minimo mensile, quindi un mese senza chiamate non costa nulla. L'altra metà, che sta bene anche qui: l'uso del modello è conteggiato per azienda contro un tetto che fissiamo noi internamente, quindi nulla in questa pagina sta sostenendo che sia illimitato.",
  "compare.concessionTitle": "Che cosa FieldQuo non fa",
  "compare.concessionIntro": "Questa sezione è su ognuna di queste pagine, nello stesso punto, sopra la parte in cui facciamo bella figura. Una tabella di confronto fatta solo delle nostre vittorie vende a qualcuno un abbonamento di cui poi chiede il rimborso.",
  "compare.unverifiedConcessionNote": "Non abbiamo verificato se questa azienda lo offra, quindi non stiamo dicendo che lo faccia.",
  "compare.staleClaimNote": "Quella lettura ha più di tre mesi, quindi qualsiasi importo che contiene resta trattenuto finché qualcuno non ricontrolla la loro pagina. Segua il link e veda che cosa dice oggi.",
  "compare.advantageTitle": "Dove FieldQuo è avanti",
  "compare.advantageIntro": "Ognuna di queste voci è stata letta sulla loro pagina nella data indicata. Segua il link e la controlli — il link serve a questo.",
  "compare.priceTitle": "Il prezzo, come lo pubblica ciascuna azienda",
  "compare.featuresTitle": "Che cosa ottiene con FieldQuo",
  "compare.featuresIntro": "Ogni riga qui sotto è una funzionalità con dietro un'implementazione. L'elenco è generato dallo stesso registro su cui girano i controlli tecnici, quindi una funzionalità che smette di funzionare smette di essere pubblicizzata.",
  "compare.ctaTitle": "Primo mese gratuito con la carta registrata, e il prezzo lo può leggere prima di cominciare",
  "compare.ctaBody": "Nessuna chiamata da prenotare, e il prezzo è sulla pagina prezzi invece che dietro un modulo. La carta viene registrata all'iscrizione e non viene addebitata finché il mese gratuito non finisce.",
  "compare.ctaButton": "Inizi il suo mese gratuito",
  "compare.ctaSecondary": "Guardi i prezzi",
  "compare.otherPagesTitle": "Gli altri confronti",
  "compare.rule.1": "Ogni prezzo è il prezzo di listino che l'azienda stampa sulla propria pagina prezzi. Le promozioni restano fuori: una pagina come questa viene costruita una volta e servita per mesi, e non può accorgersi che un'offerta è finita.",
  "compare.rule.2": "Il denaro resta nella valuta in cui è stato pubblicato. Non convertiamo mai. Un tasso di cambio è giusto il giorno in cui lo si guarda e sbagliato quello dopo, e una cifra convertita ferma su una pagina statica è un'aritmetica che nessuno sta controllando.",
  "compare.rule.3": "Dove non siamo riusciti a stabilire che cosa volesse dire una cifra, la riga lo dichiara e non mostra alcun numero. Succede più spesso di quanto si aspetti, ed è la parte della pagina di cui siamo più sicuri.",
  "compare.rule.4": "Ogni cifra porta con sé il giorno in cui è stata letta e il paese da cui è stata letta, perché un prezzo può cambiare per l'uno e per l'altro.",

  "compare.lede.jobber": "Jobber vende la sua suite di marketing, il suo centralino AI e la sua pipeline commerciale come componenti aggiuntivi mensili separati — $177 al mese sopra un piano il cui prezzo si muove già con la dimensione del team. FieldQuo mette tutti e tre in ogni piano, a ogni prezzo, e chi sta in furgone non si paga.",
  "compare.concession.jobber": "Partiamo da quello che non abbiamo. FieldQuo è un'applicazione web: non c'è niente da installare da uno store, niente funziona senza campo, e non c'è un venditore che glielo spieghi passo passo.",
  "compare.lede.housecall_pro": "Housecall Pro fa pagare ogni utente in più, quindi il prezzo del piano è solo il punto da cui parte la sua fattura. FieldQuo fa pagare le persone che il lavoro lo valorizzano davvero — preventivi, lavori, fatture — e chi sta in furgone è squadra, senza costi. Ogni funzionalità è in ogni piano, a partire da $99.",
  "compare.concession.housecall_pro": "Prima la parte onesta. La pagina di Housecall Pro elenca come standard un'app per telefono, l'accesso offline e una demo guidata. FieldQuo non ha nessuna delle tre, e se una di queste decide per Lei, l'acquisto migliore è il loro.",
  "compare.lede.servicetitan": "La pagina prezzi di ServiceTitan non porta una cifra in dollari da nessuna parte — si prenota una demo e il numero si contratta sul suo fatturato e sul suo organico. Gli artigiani riferiscono canoni mensili per tecnico sopra un costo di avviamento a cinque cifre e un contratto pluriennale. Ogni prezzo di FieldQuo è su questa pagina, non c'è alcun costo di attivazione, e può cominciare stasera senza parlare con nessuno.",
  "compare.concession.servicetitan": "Quello che non possiamo offrire, detto per primo: nessuna app per telefono, niente che funzioni fuori rete, e nessuno che le faccia da guida prima che decida.",
  "compare.lede.projul": "Projul chiede un impegno annuale fisso pagato in anticipo. FieldQuo costa $99 al mese per una postazione e cinque persone in squadra, tutte le funzionalità comprese, e se ne può andare alla fine di qualsiasi mese — non deve comprare un anno per scoprire se le va bene.",
  "compare.concession.projul": "Prima del resto: FieldQuo non ha un'app per telefono, non funziona senza campo, e non ha nessuno che gliela venga a mostrare. Projul le fissa una demo.",
  "compare.lede.quoteiq": "QuoteIQ parte da $29.99, e quel piano non può costruirle un sito, prendere una prenotazione, né lasciare che sia il proprietario di casa a valorizzarsi il lavoro da solo. Il piano QuoteIQ che porta quello che FieldQuo mette in ogni piano è il loro livello Max, a $699 al mese. Il nostro è $99 — e quarantuno voci del nostro elenco non stanno nella loro offerta a nessun prezzo.",
  "compare.concession.quoteiq": "Prima il prezzo, perché è la cosa che è venuto a controllare. QuoteIQ parte sotto il nostro piano più economico, ha app per telefono che noi non abbiamo, e le fissa una dimostrazione guidata. FieldQuo è un'applicazione web, senza un venditore attaccato.",

  "compare.counterpoint.projul.monthly_billing": "La loro pagina argomenta a favore del piano annuale, e l'argomento è valido: Projul dice che il suo prezzo non prevede alcun costo per utente né alcun tetto al numero di progetti. Un'impresa che aggiunge persone spesso può trovarsi meglio da loro.",

  "compare.capability.mobile_app": "App mobile nativa (iOS / Android)",
  "compare.capability.offline_use": "Funziona offline",
  "compare.capability.self_serve_demo": "Prenotare una demo guidata con un venditore",
  "compare.capability.accounting_sync": "Sincronizzazione bidirezionale con QuickBooks o Xero",
  "compare.capability.gantt_charts": "Diagrammi di Gantt e cronoprogrammi di progetto collegati",
  "compare.capability.purchase_orders": "Ordini di acquisto ai fornitori",
  "compare.capability.daily_logs": "Rapportini giornalieri di cantiere",
  "compare.capability.geofencing": "Geolocalizzazione e timbratura con geofencing",
  "compare.capability.field_worker_quotes": "La squadra in cantiere può valorizzare e inviare un preventivo dal furgone",
  "compare.capability.entry_price_below_our_floor": "Un piano a pagamento sotto il gradino più economico di FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "Centralino telefonico AI su ogni piano, senza minimo mensile",
  "compare.capability.self_serve_signup": "Iscriversi e cominciare senza parlare con nessuno",
  "compare.capability.published_price": "Prezzo pubblicato apertamente, senza chiamata commerciale",
  "compare.capability.monthly_billing": "Si paga mese per mese, senza impegno annuale",
  "compare.capability.free_crew_seats": "Squadra in cantiere compresa gratis — si paga solo per chi genera denaro",

  "compare.teamSize.solo": "Solo io",
  "compare.teamSize.2-5": "2-5 persone",
  "compare.teamSize.6-10": "6-10 persone",
  "compare.teamSize.11-15": "11-15 persone",
  "compare.teamSize.16-plus": "16 o più",
  "compare.billing.annual_prepaid": "Annuale, prepagato",
  "compare.billing.monthly_1yr": "Mensile, impegno di 1 anno",
  "compare.billing.monthly_none": "Mensile, senza impegno",

  "compare.comparableFeature.ai_receptionist": "Centralino telefonico AI",

  // ── La pagina indice ────────────────────────────────────────────────────
  "compare.vs": "FieldQuo a confronto con {competitor}",
  "compare.preparedAsOf": "Aggiornato al {date}.",
  "compare.preparedAsOfLong": "Aggiornato al {date}. Ogni cifra qui sotto porta con sé anche il giorno in cui è stata letta e il paese da cui è stata letta.",
  "compare.readComparison": "Legga il confronto",

  // Che cosa può affermare una scheda, montata in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} dei loro prezzi pubblicati si possono mettere accanto ai nostri, nella valuta in cui li stampano.",
  "compare.summary.amounts": "{count} dei loro prezzi pubblicati si possono mettere accanto ai nostri.",
  "compare.summary.asserted": "{count} di questi non indicano alcuna valuta sulla loro pagina, quindi il confronto dice di chi è il giudizio sulla valuta invece di presentarla come loro.",
  "compare.summary.onRequest": "{count} dei loro livelli non pubblicano alcuna cifra e le chiedono di richiederla.",
  "compare.summary.none": "Non c'è nulla, in quello che pubblicano, da mettere a confronto con un prezzo FieldQuo.",
  "compare.summary.withheldOne": "{count} cifra in più è trattenuta, mostrata insieme alla ragione.",
  "compare.summary.withheld": "{count} cifre in più sono trattenute, ciascuna mostrata insieme alla ragione.",

  // ── Come si legge un prezzo ─────────────────────────────────────────────
  //
  // {currency} è un codice e {ask} sono le parole del loro pulsante: arrivano
  // già decisi e non si traducono. {per} passa da compare.per.* qui sotto e in
  // italiano si porta dietro la preposizione articolata — "al anno" non esiste,
  // quindi l'articolo sta nel valore e non nella frase che lo ospita.
  "compare.price.amount": "${amount} {currency} {per}",
  "compare.price.free": "Gratuito ({currency})",
  "compare.price.onRequest": "Nessun prezzo pubblicato — la loro pagina dice «{ask}»",
  "compare.price.notOffered": "Non venduto per questa dimensione",
  "compare.per.month": "al mese",
  "compare.per.year": "all'anno",
  "compare.pricePerMonth": "${amount} al mese",
  "compare.and": " e ",

  // ── Come si legge la disponibilità di una funzionalità ──────────────────
  //
  // included e includedUsageExtra non devono MAI collassare in un'unica frase.
  // La nostra è la seconda: il centralino è su ogni piano e i minuti sono
  // credito prepagato, quindi "compreso" accanto al nostro prezzo sarebbe
  // un'affermazione falsa sul nostro stesso prezzo, detta a qualcuno che alla
  // prima chiamata incontra una ricarica.
  "compare.availability.included": "nel prezzo del piano",
  "compare.availability.includedUsageExtra": "su ogni piano, con i minuti di conversazione acquistati a parte come credito prepagato",
  "compare.availability.addOn": "un componente aggiuntivo a pagamento sopra il piano",
  "compare.availability.absent": "non su quel livello",
  "compare.availability.unknown": "non stabilito",

  // ── La sezione prezzi ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} postazione, più {crew} persone in squadra senza costi",
  "compare.tierSeats": "{seats} postazioni, più {crew} persone in squadra senza costi",
  "compare.sameNumberBothCurrencies": "Lo stesso numero in ciascuna valuta in cui vendiamo ({currencies}) — ${price} in ognuna è un prezzo FieldQuo reale, quindi niente in questa pagina deve essere convertito per allinearli. La valuta in cui le viene fatturato dipende dall'indirizzo aziendale che indica all'iscrizione.",
  "compare.soldIn": "Venduto in {currencies}.",
  "compare.nothingPublishable": "Sulla pagina prezzi di {competitor} non c'è nulla che possiamo pubblicare come prezzo. Ogni cifra che abbiamo in mano è elencata qui sotto con la ragione per cui viene trattenuta.",
  "compare.usersIncludedOne": "{count} utente compreso",
  "compare.usersIncluded": "{count} utenti compresi",
  "compare.unlimitedUsers": "Utenti illimitati, quindi non c'è un numero di postazioni da confrontare",
  "compare.currencyNotTheirs": "L'importo è loro, preso dalla loro pagina. La valuta no: {provenance}",
  "compare.withheldCountOne": "{count} altro prezzo di {competitor} non è mostrato qui — o la lettura è invecchiata, o non siamo riusciti a stabilire che cosa volesse dire la cifra pubblicata. Preferiamo lasciare fuori una riga piuttosto che stampare un numero di cui non possiamo rispondere.",
  "compare.withheldCount": "{count} altri prezzi di {competitor} non sono mostrati qui — o la lettura è invecchiata, o non siamo riusciti a stabilire che cosa volesse dire la cifra pubblicata. Preferiamo lasciare fuori una riga piuttosto che stampare un numero di cui non possiamo rispondere.",

  // ── La loro scala, con parole loro ──────────────────────────────────────
  "compare.addsOverTier": "Aggiunge rispetto al livello sottostante:",
  "compare.onThisTier": "Su questo livello:",
  "compare.aiCreditsTier": "La loro pagina indica {count} crediti AI al mese su questo livello.",
  "compare.thisListFrom": "Questo elenco: {provenance}",
  "compare.creditsAMonth": "{count} crediti al mese",

  // ── Il riquadro del centralino ──────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: quanto costa da una parte e dall'altra",
  "compare.receptionistIntro": "I livelli si accostano per quello che contengono, non per dove stanno in una tabella. Questo è il livello {competitor} più economico che abbiamo verificato portarlo davvero.",
  "compare.receptionistUnknownIntro": "Su questo, per {competitor}, non possiamo rispondere.",
  "compare.featureOnThisTier": "La funzionalità è {availability} su questo livello.",
  "compare.receptionistLowerDown": "Più in basso nella loro gamma è {availability}: {price}{at}. È un minimo che paga anche in un mese in cui il telefono non squilla mai.",
  "compare.atCoordinates": " per {coordinates}",
  "compare.ourAvailability": "È {availability}. Un mese senza chiamate non costa nulla.",
  "compare.theirWordsNotOurs": "I loro piani sono descritti sulla loro pagina con parole loro, e questo confronto non leggerà quelle parole come se fossero nostre. Il loro elenco è qui sopra, non toccato, ed è la cosa da controllare sul loro sito.",

  // ── Dove siamo avanti, e dove non lo siamo ──────────────────────────────
  "compare.readOnTheirSite": "Letto sul loro sito il {checked}",
  "compare.theySay": "{competitor} dice: «{claim}».",
  "compare.entryOursNothingBelowOne": "{seats} postazione, più {crew} persone in squadra senza costi. Sotto non c'è niente.",
  "compare.entryOursNothingBelow": "{seats} postazioni, più {crew} persone in squadra senza costi. Sotto non c'è niente.",

  // ── Il faccia a faccia ──────────────────────────────────────────────────
  "compare.case.eyebrow": "Fianco a fianco",
  "compare.case.headlineOurs": "Tutto quello che fa FieldQuo costa {price}.",
  "compare.case.headlineTheirs": "Da {competitor} lo stesso elenco costa {price}.",
  "compare.case.headlineNoPricesOurs": "FieldQuo pubblica ogni prezzo.",
  "compare.case.headlineNoPricesTheirs": "{competitor} non ne pubblica nessuno.",
  "compare.case.sub": "Non vendiamo le funzionalità a livelli. Ogni piano ha tutte le funzionalità — i piani si distinguono solo per quante persone ci stanno dentro.",
  "compare.case.missingOne": "{count} altra cosa che {competitor} non offre a nessun prezzo.",
  "compare.case.missing": "{count} altre cose che {competitor} non offre a nessun prezzo.",
  "compare.case.missingBody": "Ci sono tutte nel piano {plan}, a {price}.",
  "compare.case.shopTitle": "Quanto costa per un'impresa come la sua",
  "compare.case.shopIntro": "{competitor} fa pagare ogni accesso. Noi facciamo pagare le persone che valorizzano il lavoro; chi sta in furgone è squadra, senza costi. Quella differenza cresce a ogni persona che assume.",
  "compare.case.shop1": "Lei e due in furgone",
  "compare.case.shop2": "Due preventivisti, quattro in cantiere",
  "compare.case.shop3": "Un'impresa di undici",
  "compare.case.shopSplit": "{estimators} a fare prezzi · {crew} in cantiere",
  "compare.case.youKeep": "le resta",
  "compare.case.cheaperThere": "Con una sola persona costa meno da loro.",
  "compare.case.calcBefore": "Metta i suoi numeri nel",
  "compare.case.calcLink": "calcolatore dei costi",
  "compare.case.calcAfter": "e li veda tutti e cinque fianco a fianco.",
  "compare.case.wholeTitle": "Tutto quello che ottiene, in ogni piano",
  "compare.case.wholeIntro": "Non una selezione dei pezzi migliori — il prodotto intero, e se compaia da qualche parte nei piani di {competitor}.",
  "compare.case.both": "Entrambi",
  "compare.case.only": "Solo FieldQuo",

  // ── Le righe del faccia a faccia ────────────────────────────────────────
  "compare.rows.perMo": "{amount}/mese",
  "compare.rows.perYr": "{amount}/anno",
  "compare.rows.usersOne": "{count} utente",
  "compare.rows.users": "{count} utenti",
  "compare.rows.unlimitedUsers": "utenti illimitati",
  "compare.rows.cheapestPlan": "Piano più economico",
  "compare.rows.soloSub": "{plan} — 1 postazione, {crew} in squadra gratis",
  "compare.rows.annualEquivalent": "{plan} — equivalgono a {amount} al mese, fatturati come anno",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Il piano più economico con quello che FieldQuo mette in ogni piano",
  "compare.rows.paritySub": "Lo stesso piano. Non chiudiamo le funzionalità dietro i livelli.",
  "compare.rows.parityAnnual": "{plan} — equivalgono a {amount} al mese",
  "compare.rows.parityTheirs": "{plan} — i loro piani più economici non lo portano",
  "compare.rows.publishedPrice": "Prezzo pubblicato",
  "compare.rows.everyPlanOnThisPage": "Ogni piano, su questa pagina",
  "compare.rows.nonePublished": "Nessuno pubblicato",
  "compare.rows.bookDemo": "Prenoti una demo; il numero si contratta durante la chiamata",
  "compare.rows.whatItCosts": "Quanto costa",
  "compare.rows.oneToTwentyFive": "Da 1 a 25 persone",
  "compare.rows.reportedNotPublished": "riferito dagli artigiani, non pubblicato",
  "compare.rows.setupFee": "Costo di attivazione",
  "compare.rows.none": "Nessuno",
  "compare.rows.reported": "riferito",
  "compare.rows.howYouPay": "Come si paga",
  "compare.rows.monthly": "Mensile",
  "compare.rows.leaveAnyMonth": "Se ne può andare alla fine di qualsiasi mese",
  "compare.rows.aYearUpFront": "{amount} all'anno, in anticipo",
  "compare.rows.noMonthlyOption": "Non è offerta alcuna opzione mensile — lo dicono le loro FAQ",
  "compare.rows.paidAddOns": "Venduti come componenti aggiuntivi a pagamento",
  "compare.rows.everyFeature": "Ogni funzionalità è in ogni piano, al prezzo del piano",
  "compare.rows.plusPerMo": "+{amount}/mese",
  "compare.rows.peopleInField": "Persone in cantiere",
  "compare.rows.free": "Gratis",
  "compare.rows.crewFreeSub": "La squadra vede la pianificazione e il lavoro senza costi",
  "compare.rows.billed": "A pagamento",
  "compare.rows.everyLoginPaid": "Da {competitor} ogni accesso è un utente a pagamento",
  "compare.rows.biggestPlan": "Piano più grande",
  "compare.rows.biggestSub": "{seats} postazioni più {crew} in squadra — 25 persone",
  "compare.rows.onRequest": "Su richiesta",
  "compare.rows.everyPlan": "Ogni piano",
  "compare.rows.tierAtPrice": "{plan} — {amount}/mese",
  "compare.rows.theirCheapestWithIt": "il loro piano più economico che lo comprende",
  "compare.rows.notInTheirPlans": "Non nei loro piani",
  "compare.rows.freeTrial": "Prova gratuita",
  "compare.rows.firstMonthFree": "Primo mese gratuito",
  "compare.rows.noCardCharged": "Nessun addebito sulla carta finché non finisce",
  "compare.rows.trialOffered": "Prova offerta",
  "compare.rows.seeTheirSite": "veda il loro sito per le condizioni di oggi",

  // ── La pila dei componenti aggiuntivi ───────────────────────────────────
  //
  // Resa su /compare/fieldquo-vs-jobber E su /pricing. Erano queste le chiavi
  // di cui parlava davvero la segnalazione del titolare: il blocco aveva
  // chiamate a t() con fallback inglesi e nessuna voce di catalogo dietro,
  // quindi ogni lingua ricadeva sull'inglese.
  "addOns.title": "{count} cose che {competitor} fa pagare a parte",
  "addOns.intro": "Sulla loro pagina prezzi stanno sopra il piano, ciascuna con il proprio prezzo mensile. Ognuna di esse è lavoro che FieldQuo fa dentro il piano che sta già pagando.",
  "addOns.scope": "Della loro pagina prezzi abbiamo letto il nome e il prezzo, e nient'altro. Che cosa ci sia dentro il loro componente aggiuntivo non è una cosa che abbiamo verificato, quindi niente qui sotto lo descrive.",
  "addOns.money": "${amount} {currency} {per}",
  "addOns.provenance": "Letto da una connessione {country} il {checked}",
  "addOns.sourceLink": "la loro pagina prezzi",
  "addOns.oursTitle": "In FieldQuo, su ogni piano:",
  "addOns.limits": "Dove si ferma:",
  "addOns.total": "{total} {currency} al mese, sopra il prezzo del piano.",
  "addOns.totalBody": "È quanto costano insieme quei tre nel punto dei loro selettori in cui li abbiamo letti. In FieldQuo gli stessi tre lavori sono in ogni piano, a ogni dimensione, a partire da quello più economico di questa pagina.",
  "addOns.receptionist": "Il loro componente aggiuntivo di centralino è un minimo mensile: viene addebitato anche in un mese in cui il telefono non squilla mai. Il nostro non ha minimo mensile. La funzionalità è su ogni piano e i minuti di conversazione sono credito prepagato che compra quando le serve, quindi un febbraio tranquillo non costa nulla.",

  // ── La riga di /pricing sotto la pila dei componenti aggiuntivi ─────────
  //
  // Richiamata da PricingPlans.js da quando il blocco è stato scritto e mai
  // definita, che è la seconda metà della stessa segnalazione.
  "pricing.addOnsCompare": "Ogni cifra qui sopra è stata letta dalla loro pagina prezzi, nella data indicata. Il confronto completo fianco a fianco, compreso quello che FieldQuo non fa, è qui →",
};

export default it;
