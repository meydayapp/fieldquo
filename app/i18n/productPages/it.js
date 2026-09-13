// app/i18n/productPages/it.js
//
// Italiano, forma di cortesia (Lei), come il resto del catalogo.
//
// Lessico ripreso da quanto è già in produzione: "preventivo" per il documento,
// "prezzo di pareggio", "fogli ore", "collaboratore", "mestiere", "cantiere",
// "turno" per shift, "timbratura" per il time clock, "busta paga" per payroll,
// "spese generali" per overhead, "addetto alla pianificazione" per dispatcher.
//
// Da far rileggere: "tempi cuscinetto" per buffer times — è comprensibile ma
// non è un termine di mestiere; un artigiano direbbe forse "margine tra un
// appuntamento e l'altro". Anche "sostituzione" per cover e "scambio" per
// trade, e "tabellone del giorno" per day board.

const it = {

  // /product/quoting
  "productPage.quoting.headline": "Invii un preventivo professionale in pochi minuti",
  "productPage.quoting.description":
    "Componga i preventivi con i Suoi prezzi per ogni servizio che offre, aggiunga foto e lasci che il cliente approvi online — niente stampe, niente telefonate avanti e indietro.",
  "productPage.quoting.bullet.1":
    "I Suoi prezzi per categoria di servizio, non un modello generico",
  "productPage.quoting.bullet.2": "Il cliente approva e firma elettronicamente online",
  "productPage.quoting.bullet.3": "Un clic trasforma un preventivo accettato in fattura",
  "productPage.quoting.bullet.4":
    "Modifichi una fattura inviata e la precedente viene conservata — mai un dubbio su cosa fosse stato concordato",
  "productPage.quoting.section.pricebook.heading": "I Suoi servizi e le Sue tariffe, impostati una volta",
  "productPage.quoting.section.pricebook.body":
    "Ogni servizio che offre ha il proprio listino — al quadrato, al piede lineare, all'ora, come fattura il mestiere. Lo imposta una volta e riempie ogni preventivo. La lista dei prodotti si importa da un foglio di calcolo e si esporta di nuovo.",
  "productPage.quoting.section.pricebook.bullet.1": "Un listino per servizio, nelle unità che il Suo mestiere usa davvero",
  "productPage.quoting.section.pricebook.bullet.2": "Prodotti e servizi importati da un CSV, esportati allo stesso modo",
  "productPage.quoting.section.pricebook.bullet.3": "Costi dei materiali e ricette dietro il prezzo, mai mostrati al cliente",
  "productPage.quoting.section.pricebook.alt":
    "La schermata Servizi e prezzi: tetti, rivestimenti e grondaie, ciascuno con il proprio listino e i materiali con cui viene quotato",
  "productPage.quoting.section.builder.heading": "Componga il preventivo a casa del cliente",
  "productPage.quoting.section.builder.body":
    "Tocchi un servizio e i Suoi prezzi si compilano. Raggruppi le righe per stanza o per ambito, alleghi le foto inviate dal cliente e tenga costo e margine in un pannello che il cliente non vede mai.",
  "productPage.quoting.section.builder.bullet.1": "Raggruppi le righe per stanza o ambito, così il preventivo si legge come procede il lavoro",
  "productPage.quoting.section.builder.bullet.2": "Foto e video del cliente restano sul preventivo e passano in fattura",
  "productPage.quoting.section.builder.bullet.3": "Costo e margine calcolati accanto al prezzo — ore della squadra, materiali, spese generali",
  "productPage.quoting.section.builder.alt":
    "L'editor dei preventivi: cliente, persona assegnata, i servizi da aggiungere con un tocco e il pannello interno di costo e margine",
  "productPage.quoting.section.review.heading": "Una revisione prima dell'invio, ed extra che il cliente può spuntare",
  "productPage.quoting.section.review.body":
    "Prima che un preventivo parta, FieldQuo AI lo legge: cosa ha dimenticato di menzionare, come si colloca il prezzo rispetto ai preventivi che ha già vinto, e una formulazione più chiara. Gli extra suggeriti sono prezzati dal Suo storico e compaiono come opzioni che il cliente spunta nella pagina di approvazione.",
  "productPage.quoting.section.review.bullet.1": "Cosa manca, come si confronta il prezzo, cosa riformulare",
  "productPage.quoting.section.review.bullet.2": "Confrontato solo con i Suoi preventivi accettati — mai con quelli di un'altra azienda",
  "productPage.quoting.section.review.bullet.3": "Gli extra sono prezzati dalla Sua parte; il cliente sceglie solo quali accettare",
  "productPage.quoting.section.review.alt":
    "Il pannello di revisione dell'IA che assegna 76 su 100 a un preventivo, con tre cose da sistemare prima dell'invio",
  "productPage.quoting.section.approval.heading": "Il cliente approva e firma dal telefono",
  "productPage.quoting.section.approval.body":
    "Il preventivo arriva in un'email dal Suo indirizzo, con il Suo logo e il Suo colore, e si apre su una pagina che porta il Suo nome. Il cliente sceglie gli extra, firma, e il lavoro parte. Ciò che ha visto al momento della firma viene conservato insieme alla firma.",
  "productPage.quoting.section.approval.bullet.1": "Il Suo logo, il Suo colore, il Suo nome — nulla dice FieldQuo",
  "productPage.quoting.section.approval.bullet.2": "Firma registrata con il documento esatto che il cliente ha visto",
  "productPage.quoting.section.approval.bullet.3": "Un preventivo mantiene la lingua in cui è stato scritto; un documento firmato non cambia mai le sue parole",
  "productPage.quoting.section.invoice.heading": "Un clic per fatturare, pagato dal telefono",
  "productPage.quoting.section.invoice.body":
    "Un preventivo approvato diventa una fattura che somiglia al preventivo, perché è costruita da esso. Chieda un acconto, divida un lavoro grande in fasi, e lasci che il cliente paghi con carta o addebito bancario — i soldi arrivano sul Suo conto, mai sul nostro.",
  "productPage.quoting.section.invoice.bullet.1": "Modifichi una fattura emessa e la versione precedente viene conservata",
  "productPage.quoting.section.invoice.bullet.2": "Acconti e pagamenti per fase, richiesti secondo il calendario che stabilisce Lei",
  "productPage.quoting.section.invoice.bullet.3": "Carta, o addebito bancario in Canada e Stati Uniti, versato direttamente sul Suo conto",
  "productPage.quoting.section.invoice.alt":
    "La schermata della nuova fattura con le righe e il pannello interno di costo e margine",
  "productPage.quoting.section.instant.heading": "Una stima istantanea sul Suo sito web",
  "productPage.quoting.section.instant.body":
    "Un visitatore risponde a qualche domanda — o traccia il tetto dall'indirizzo — e ottiene una fascia di prezzo dalle tariffe che stabilisce Lei. Arriva nella Sua coda di revisione prima che qualcosa sia vincolante, e il Suo listino in sé non viene mai pubblicato.",
  "productPage.quoting.section.instant.bullet.1": "Mostri una fascia subito, dopo l'invio, o per niente — scelta Sua per ogni servizio",
  "productPage.quoting.section.instant.bullet.2": "Ogni stima attende in Revisione stime che Lei la confermi o la corregga",
  "productPage.quoting.section.instant.bullet.3": "Un modulo di auto-preventivo in cui il proprietario descrive il lavoro e carica le foto",
  "productPage.quoting.section.instant.alt":
    "Impostazioni dei preventivi istantanei: tetto misurato dall'indirizzo, cosa vede il proprietario e le fasce di budget",
  "productPage.quoting.faq.white-label.q": "I miei clienti vedono FieldQuo da qualche parte?",
  "productPage.quoting.faq.white-label.a":
    "No. Preventivo, fattura, pagina di approvazione, email e PDF portano il Suo logo, il Suo colore e il Suo nome come mittente. Il nostro nome compare solo in due piccoli punti: una riga \"Site by FieldQuo\" nel piè di pagina del Suo sito finché l'azienda non è su un piano a pagamento — sparisce non appena lo è — e una riga \"Made by FieldQuo\" in fondo alla pagina del link in bio.",
  "productPage.quoting.faq.own-prices.q": "Posso usare i miei prezzi?",
  "productPage.quoting.faq.own-prices.a":
    "È l'unico modo in cui funziona. Ogni servizio parte da tariffe tipiche del Suo mestiere, indicate come punto di partenza, e Lei le adatta al Suo mercato; l'editor dei preventivi si compila dai Suoi numeri, mai dai nostri. Un listino si importa anche da un foglio di calcolo e si esporta di nuovo.",
  "productPage.quoting.faq.after-approval.q": "Cosa succede quando il cliente approva?",
  "productPage.quoting.faq.after-approval.a":
    "Il preventivo diventa un lavoro con ambito, indirizzo e documenti già a bordo, e un clic lo trasforma in una fattura che rispecchia il preventivo. Se ha chiesto un acconto, viene richiesto all'approvazione.",
  "productPage.quoting.faq.instalments.q": "I clienti possono pagare a rate?",
  "productPage.quoting.faq.instalments.a":
    "Può dividere una fattura in fasi, e ciascuna viene richiesta secondo il Suo calendario. Il pagamento dilazionato al momento del pagamento è offerto tramite Stripe, dove decide il finanziatore — FieldQuo non presta e non approva nessuno.",

  // /product/scheduling
  "productPage.scheduling.headline": "Ogni persona, ogni ora, su un unico tabellone",
  "productPage.scheduling.description":
    "Prepari la giornata e la settimana della squadra, pubblichi una volta, e ognuno vede i propri turni sul telefono. I clienti prenotano visite dalla Sua disponibilità reale mentre Lei è in cantiere.",
  "productPage.scheduling.bullet.1": "Un tabellone del giorno con una riga per persona e una colonna per ora",
  "productPage.scheduling.bullet.2": "I turni restano nascosti alla squadra finché non pubblica",
  "productPage.scheduling.bullet.3": "Pagina di prenotazione pubblica, con il Suo logo e i Suoi colori",
  "productPage.scheduling.bullet.4":
    "Tempi cuscinetto e disponibilità per persona, non un calendario generico",
  "productPage.scheduling.hero.alt":
    "Il tabellone del giorno: cinque persone in riga, le ore in colonna, una in ferie, una timbrata, e la striscia di copertura in alto",
  "productPage.scheduling.section.board.heading": "Il tabellone del giorno: chi è dove, ora per ora",
  "productPage.scheduling.section.board.body":
    "Una riga per persona, una colonna per ora. Un turno è un blocco con pranzo e pause disegnati; la timbratura colora i punti di verde e ambra man mano che le persone timbrano; chi è in ferie approvate compare come riga ASSENTE, così nessuno lo pianifica per sbaglio.",
  "productPage.scheduling.section.board.bullet.1": "La striscia di copertura dice quante persone restano in cantiere ogni ora — in rosso dove manca qualcuno negli orari di apertura",
  "productPage.scheduling.section.board.bullet.2": "Una bozza fuori dalla disponibilità dichiarata è tratteggiata e segnalata, non ammessa in silenzio",
  "productPage.scheduling.section.board.bullet.3": "Etichette In ritardo e Puntuale, dalla timbratura rispetto al turno, sul blocco stesso",
  "productPage.scheduling.section.board.alt":
    "Il tabellone del giorno visto dal titolare: la riga della manodopera per il giorno e la settimana, gli straordinari, e le etichette In ritardo e Puntuale sui turni",
  "productPage.scheduling.section.week.heading": "Pianifichi la settimana, pubblichi una sola volta",
  "productPage.scheduling.section.week.body":
    "La griglia settimanale sono gli stessi turni per giorno. Applichi un turno a più giorni in un colpo, pubblichi un turno aperto che chiunque può prendere, e legga ore e paghe nel piè di pagina prima di pubblicare. Finché non lo fa, la squadra non vede nulla.",
  "productPage.scheduling.section.week.bullet.1": "Interruttori \"applica a\" per giorno: imposti il lunedì una volta, spunti gli altri quattro",
  "productPage.scheduling.section.week.bullet.2": "I turni aperti stanno in una riga propria finché qualcuno li prende",
  "productPage.scheduling.section.week.bullet.3": "Ore, straordinari e — con accesso alle paghe — il costo del personale, per giorno e per settimana",
  "productPage.scheduling.section.week.alt":
    "La griglia settimanale: le righe Eventi e Turni aperti, un turno per persona per giorno, e il piè di pagina con paghe e ore",
  "productPage.scheduling.section.phone.heading": "Pubblicato, e su ogni telefono",
  "productPage.scheduling.section.phone.body":
    "Quando pubblica, ogni persona viene avvisata sul telefono, e avvisata di nuovo se il suo turno si sposta. Il suo orario è una scheda per giorno: il lavoro, l'indirizzo, chi altro c'è, la nota che ha lasciato Lei, e un pulsante Timbra entrata sulla scheda di oggi.",
  "productPage.scheduling.section.phone.bullet.1": "Avvisati quando un turno viene pubblicato, spostato o tolto — una bozza non arriva mai a un telefono",
  "productPage.scheduling.section.phone.bullet.2": "I colleghi dello stesso turno, la nota del cantiere e la riga dei festivi",
  "productPage.scheduling.section.phone.bullet.3": "Timbrare dalla scheda del giorno; aggiungere l'orario al calendario del telefono",
  "productPage.scheduling.section.phone.alt":
    "Il mio orario su un telefono: una scheda per giorno con il lavoro, l'indirizzo, la squadra e un pulsante Timbra entrata",
  "productPage.scheduling.section.requests.heading": "Scambi, sostituzioni e ferie, approvati dal responsabile giusto",
  "productPage.scheduling.section.requests.body":
    "Un membro della squadra chiede una sostituzione dal telefono; un collega accetta per primo, poi il responsabile approva, e tutti vengono avvisati a ogni passaggio. Le ferie seguono le regole che stabilisce Lei, con saldi che si accumulano da soli, date bloccate e le festività della Sua provincia o del Suo stato.",
  "productPage.scheduling.section.requests.bullet.1": "Scambiare un turno, chiedere una sostituzione, prendere un turno aperto — tutto dal centro richieste",
  "productPage.scheduling.section.requests.bullet.2": "Regole ferie con saldi, un tetto di persone assenti insieme e date bloccate",
  "productPage.scheduling.section.requests.bullet.3": "I cambi di disponibilità hanno effetto da una data, così il tabellone lo sa in anticipo",
  "productPage.scheduling.section.requests.alt":
    "Il centro richieste: ferie, scambio, sostituzione e disponibilità, con le richieste del membro della squadra elencate sotto",
  "productPage.scheduling.section.booking.heading": "Una pagina di prenotazione che riempie il calendario mentre Lei lavora",
  "productPage.scheduling.section.booking.body":
    "I clienti scelgono uno slot dalla disponibilità reale della persona che andrà, con il tempo di viaggio tra i lavori e una finestra di arrivo che promette Lei, su una pagina che porta il Suo nome. Un SMS prima della visita, e un link che permette loro di spostarla da soli.",
  "productPage.scheduling.section.booking.bullet.1": "Cuscinetto di viaggio tra i lavori e una finestra di arrivo — esatta, ±15, ±30 o ±60 minuti",
  "productPage.scheduling.section.booking.bullet.2": "Incassi una tariffa di visita alla prenotazione e la scali dalla fattura",
  "productPage.scheduling.section.booking.bullet.3": "Promemoria via SMS prima della visita; il cliente la sposta dal link, senza chiamarLa",
  "productPage.scheduling.section.booking.alt":
    "Impostazioni della pagina di prenotazione: il codice da incorporare, quanto dura una visita, il cuscinetto di viaggio e la finestra di arrivo promessa al cliente",
  "productPage.scheduling.section.clock.heading": "Timbrare sul lavoro, pause comprese",
  "productPage.scheduling.section.clock.body":
    "La squadra timbra da qualsiasi telefono, sul lavoro in cui si trova — o su nessuno, perché viaggio e magazzino sono ore vere. Anche pranzo e pause si timbrano. Al tocco, il telefono chiede una sola volta la posizione; il foglio ore mostra poi a che distanza dal cantiere era. Nulla traccia nessuno tra un tocco e l'altro.",
  "productPage.scheduling.section.clock.bullet.1": "Due visite oggi? La timbratura chiede quale; \"nessun lavoro\" è sempre un'opzione onesta",
  "productPage.scheduling.section.clock.bullet.2": "Pause pagate e non pagate, dal telefono",
  "productPage.scheduling.section.clock.bullet.3": "Una posizione al tocco, mai nel mezzo — rifiutarla non cambia nulla della timbratura",
  "productPage.scheduling.section.clock.alt":
    "La timbratura: l'ora attuale, quale lavoro, e il pulsante Timbra entrata",
  "productPage.scheduling.faq.phone.q": "La mia squadra deve installare qualcosa?",
  "productPage.scheduling.faq.phone.a":
    "No. FieldQuo funziona nel browser del telefono e si può fissare nella schermata iniziale, così si apre come qualsiasi altra icona. Niente da installare, niente da aggiornare.",
  "productPage.scheduling.faq.reminders.q": "Come vengono ricordati i clienti?",
  "productPage.scheduling.faq.reminders.a":
    "Con un SMS prima della visita, con un link per spostarla o annullarla. Non c'è ancora un promemoria via email, e il testo del promemoria è fisso — l'SMS \"sto arrivando\" è quello che può modificare.",
  "productPage.scheduling.faq.crew-sees.q": "Cosa vede un membro della squadra?",
  "productPage.scheduling.faq.crew-sees.a":
    "I propri turni, i lavori a cui è assegnato, cosa comprare per quei lavori e le proprie ore. Niente prezzi, niente preventivi, niente fatture, niente richieste altrui — a meno che Lei non giri un selettore per lui.",
  "productPage.scheduling.faq.book-account.q": "I clienti hanno bisogno di un account per prenotare?",
  "productPage.scheduling.faq.book-account.a":
    "No. La pagina di prenotazione chiede nome, numero di telefono e indirizzo, e la conferma contiene il link con cui gestire la visita.",

  // /product/team
  "productPage.team.headline": "Dia accesso alla Sua squadra senza rinunciare al controllo",
  "productPage.team.description":
    "Livelli di accesso predefiniti per operai, preventivisti, addetti alla pianificazione e responsabili, un selettore per area per chi ha bisogno di qualcosa di diverso, e un fascicolo per persona: documenti, inserimento, regolamenti, ore e paga.",
  "productPage.team.bullet.1": "Profili Operaio, Preventivista, Pianificatore e Responsabile, poi un selettore per area per persona",
  "productPage.team.bullet.2": "Fogli ore legati a lavori reali, non a stime",
  "productPage.team.bullet.3": "Cicli paga e buste paga dalle ore approvate",
  "productPage.team.bullet.4": "Documenti dei dipendenti, inserimento e regolamenti in un unico fascicolo",
  "productPage.team.hero.alt":
    "La schermata iniziale del responsabile: ore pagate e paghe di oggi, due visite da assegnare, stato della squadra e le richieste da esaminare",
  "productPage.team.section.access.heading": "La qualifica è una parola; l'accesso è un selettore",
  "productPage.team.section.access.body":
    "Parta da un profilo — Operaio, Preventivista, Pianificatore, Responsabile — poi cambi qualsiasi selettore per quella persona: cosa vede dell'orario, dei fogli ore, delle paghe, dei clienti, dei preventivi, dei lavori, delle fatture. Vale sul server, non solo sullo schermo, così un pulsante nascosto non è mai l'unica cosa di mezzo.",
  "productPage.team.section.access.bullet.1": "Quattro profili e un editor personalizzato, un selettore per area",
  "productPage.team.section.access.bullet.2": "Mostra prezzi, Costi di commessa e Pagamenti sono interruttori separati",
  "productPage.team.section.access.bullet.3": "Gli accessi Operaio sono gratuiti; i posti sono per chi scrive preventivi e fatture",
  "productPage.team.section.access.alt":
    "Il pannello dei permessi di un nuovo membro: i profili Operaio, Preventivista, Pianificatore e Responsabile, e un selettore per area sotto",
  "productPage.team.section.home.heading": "La schermata iniziale di ciascuno, sul proprio telefono",
  "productPage.team.section.home.body":
    "Un operaio apre FieldQuo e trova il prossimo turno, la nota che ha lasciato Lei, quanto ha guadagnato oggi e i pulsanti che usa davvero: timbra, cerca sostituto, scambia, messaggio. Un responsabile lo apre e trova le ore pagate del giorno, le visite ancora da assegnare, chi è in cantiere e le richieste in attesa di una decisione.",
  "productPage.team.section.home.bullet.1": "Il prossimo turno con il lavoro, l'indirizzo e chi altro c'è",
  "productPage.team.section.home.bullet.2": "Cercare un sostituto, scambiare un turno, chiedere ferie — dalla stessa schermata",
  "productPage.team.section.home.bullet.3": "La vista del responsabile: assegnazioni, stato della squadra e cosa c'è da esaminare",
  "productPage.team.section.home.alt":
    "La schermata iniziale del dipendente su un telefono: buon pomeriggio, il prossimo turno, una nota per quel turno, Cerca sostituto e Scambia, e Timbra uscita",
  "productPage.team.section.hr.heading": "Un fascicolo del personale per persona",
  "productPage.team.section.hr.body":
    "Patenti, tesserini e certificazioni con promemoria di scadenza. Una lista di inserimento con il TD1 o il W-4 compilato da telefono e conservato nel fascicolo — FieldQuo non trasmette nulla ad alcuna autorità fiscale e non chiede mai un numero di previdenza sociale. I regolamenti hanno versioni e vengono riconosciuti col nome digitato, e una vista di conformità mostra a chi manca cosa.",
  "productPage.team.section.hr.bullet.1": "Documenti con data di scadenza e un promemoria prima",
  "productPage.team.section.hr.bullet.2": "Lista di inserimento: moduli da compilare, documenti da caricare, regolamenti da firmare",
  "productPage.team.section.hr.bullet.3": "Il registro del responsabile per note e richiami, conservato con la persona",
  "productPage.team.section.hr.alt":
    "Personale e conformità: una riga per persona con documenti da verificare, avanzamento dell'inserimento, regolamenti non firmati e richiami",
  "productPage.team.section.chat.heading": "Una chat per ogni lavoro, e una per l'azienda",
  "productPage.team.section.chat.body":
    "Ogni lavoro ha una stanza condivisa dalla squadra assegnata e dall'ufficio, così la foto del frontale del cassetto graffiato sta accanto al lavoro e non nei messaggi di qualcuno. Gruppi e messaggi diretti stanno lì accanto, con le @menzioni, sul telefono e alla scrivania.",
  "productPage.team.section.chat.bullet.1": "Una stanza per lavoro, aperta dal lavoro e che riporta al lavoro",
  "productPage.team.section.chat.bullet.2": "Gruppi, messaggi diretti e @menzioni",
  "productPage.team.section.chat.bullet.3": "Contatori dei non letti per stanza, sul telefono",
  "productPage.team.section.chat.alt":
    "Chat della squadra: una stanza di lavoro con i messaggi della squadra sulla dima del piano e sul sopralluogo, con una @menzione evidenziata",
  "productPage.team.section.timesheets.heading": "Fogli ore da timbrature reali, con le segnalazioni",
  "productPage.team.section.timesheets.body":
    "Le ore arrivano legate al lavoro e al turno su cui sono state timbrate. Il tabellone mostra chi era in ritardo e di quanto, chi supera le quaranta ore questa settimana e — per chi ha accesso alle paghe — quanto costano il giorno e la settimana in paghe. Lei approva le ore prima che possano diventare paga.",
  "productPage.team.section.timesheets.bullet.1": "In ritardo o puntuale dalla timbratura rispetto al turno, non a memoria",
  "productPage.team.section.timesheets.bullet.2": "Straordinari segnalati per persona man mano che la settimana avanza",
  "productPage.team.section.timesheets.bullet.3": "Il costo del personale del giorno e della settimana, nascosto a chi non ha accesso alle paghe",
  "productPage.team.section.timesheets.alt":
    "Il tabellone del giorno visto da un pianificatore: ore programmate, straordinari oltre le quaranta, etichette In ritardo e Puntuale, e una nota che il costo della manodopera si mostra solo a chi può vedere le tariffe di paga",
  "productPage.team.section.payroll.heading": "Cicli paga e buste paga dalle ore approvate",
  "productPage.team.section.payroll.body":
    "Le ore approvate e la tariffa di ciascuno diventano un ciclo paga per il periodo che sceglie, con una busta paga per persona e un'esportazione per il Suo commercialista. FieldQuo calcola il lordo; non paga i dipendenti e non presenta le ritenute. Chi nel Suo organico è segnato come collaboratore esterno può essere pagato per le ore timbrate con un bonifico reale sul suo conto.",
  "productPage.team.section.payroll.bullet.1": "Periodi paga secondo il Suo ciclo, buste paga in PDF, il ciclo esportato",
  "productPage.team.section.payroll.bullet.2": "Collaboratori esterni del Suo organico pagati per le ore timbrate alla tariffa che stabilisce Lei",
  "productPage.team.section.payroll.bullet.3": "Aziende subappaltatrici in archivio con la loro assicurazione e la lista T5018 di fine anno",
  "productPage.team.section.payroll.alt":
    "Paghe: le ore approvate del periodo, lordo, trattenute e netto, e un nuovo ciclo paga in preparazione",
  "productPage.team.faq.taxes.q": "FieldQuo presenta le ritenute sulle paghe?",
  "productPage.team.faq.taxes.a":
    "No. Calcola il lordo dalle ore approvate, produce le buste paga ed esporta il ciclo. Le trattenute sono quelle che fornisce Lei o il Suo commercialista, e nulla viene trasmesso ad alcuna autorità fiscale.",
  "productPage.team.faq.crew-free.q": "Gli accessi Operaio sono gratuiti?",
  "productPage.team.faq.crew-free.a":
    "Sì. Un accesso Operaio vede il proprio orario, timbra entrata e uscita e archivia foto — non conta sui Suoi posti. I posti sono per le persone che creano e modificano preventivi, lavori e fatture.",
  "productPage.team.faq.see-pay.q": "Un pianificatore può vedere quanto pago le persone?",
  "productPage.team.faq.see-pay.a":
    "Solo se gli dà accesso alle paghe. Senza, il tabellone mostra ore e straordinari e dice perché i soldi mancano. Ogni tariffa e ogni cifra di paga è nascosta sul server, non solo sullo schermo.",
  "productPage.team.faq.leaves.q": "Cosa succede quando qualcuno se ne va?",
  "productPage.team.faq.leaves.a":
    "Lo disattiva. Le sue ore, i documenti e lo storico restano nel fascicolo; non può più accedere, e il suo posto è libero per la persona successiva.",

  // /product/analytics
  "productPage.analytics.headline": "Conosca i Suoi numeri prima di tirare a indovinare",
  "productPage.analytics.description":
    "Veda le Sue spese generali reali, il Suo prezzo di pareggio per lavoro e come i Suoi prezzi si confrontano con altre aziende del Suo mestiere — più un assistente IA che risponde a domande sulla Sua azienda.",
  "productPage.analytics.bullet.1":
    "Tasso di spesa e prezzo minimo, calcolati dalle Sue spese reali",
  "productPage.analytics.bullet.2":
    "Spesa marketing suddivisa per canale — Facebook, Google, TikTok e altri",
  "productPage.analytics.bullet.3":
    "Veda come si confrontano i Suoi prezzi, in forma anonima, con altri del Suo mestiere",
  "productPage.analytics.bullet.4":
    "Chieda a FieldQuo AI cose come \"il mio tasso di conversione è normale?\"",
  "productPage.analytics.section.kpis.heading": "Il cruscotto dei KPI: vendite, denaro, costi, utile, esecuzione",
  "productPage.analytics.section.kpis.body":
    "Tasso di chiusura, valore medio del lavoro, conversione da contatto a preventivo, entrate contro uscite per giorno, manodopera come quota dei ricavi, completamento puntuale. Ogni cifra viene da ciò che è già in FieldQuo — nessun collegamento bancario, nessun foglio di calcolo. Una scheda senza dati dice perché, invece di mostrare uno zero.",
  "productPage.analytics.section.kpis.bullet.1": "Questo mese, il mese scorso, questo trimestre, da inizio anno o l'anno scorso",
  "productPage.analytics.section.kpis.bullet.2": "Prospetti finanziari, vinti e persi, e precisione delle stime come report a sé",
  "productPage.analytics.section.kpis.bullet.3": "Un riepilogo settimanale, e un resoconto mensile in frasi invece che in grafici",
  "productPage.analytics.section.kpis.alt":
    "Il cruscotto dei KPI: schede vendite, flusso di denaro con entrate contro uscite per giorno, e costi aziendali",
  "productPage.analytics.section.overhead.heading": "Le spese generali, e il prezzo minimo che ne deriva",
  "productPage.analytics.section.overhead.body":
    "Affitto, assicurazioni, telefoni, gli stipendi d'ufficio, il finanziamento del furgone e quanto il furgone perde di valore ogni mese — inseriti una volta. Dica a FieldQuo quanti lavori prende la squadra in una settimana normale e Le dice il prezzo più basso che un lavoro può reggere coprendo comunque l'azienda.",
  "productPage.analytics.section.overhead.bullet.1": "Costi fissi, stipendi, debiti, beni e ammortamento, bollette in scadenza",
  "productPage.analytics.section.overhead.bullet.2": "Le ore pagate che non sono mai arrivate a un lavoro contate come spese generali, non nascoste",
  "productPage.analytics.section.overhead.bullet.3": "Il prezzo minimo sta accanto al totale del preventivo mentre lo compone",
  "productPage.analytics.section.overhead.alt":
    "La schermata delle spese generali: lavori a settimana, ore pagate mai arrivate a un lavoro, e le sezioni costi fissi, stipendi e debiti",
  "productPage.analytics.section.expenses.heading": "Spese, tasso di spesa e autonomia",
  "productPage.analytics.section.expenses.body":
    "Registri ciò che spende, o importi un mese intero da un CSV dell'estratto conto, e separi ciò che appartiene a un lavoro da ciò che appartiene all'azienda. Il tasso di spesa mensile e l'autonomia sulla liquidità che ha ne derivano.",
  "productPage.analytics.section.expenses.bullet.1": "Importazione da un CSV bancario; mai un accesso alla banca",
  "productPage.analytics.section.expenses.bullet.2": "Spesa di lavoro contro spesa aziendale, per categoria, su sei mesi",
  "productPage.analytics.section.expenses.bullet.3": "Spesa marketing per canale, con importazione automatica da Meta Ads",
  "productPage.analytics.section.expenses.alt":
    "Monitoraggio spese: spese registrate questo mese, tasso di spesa mensile, autonomia, la ripartizione e l'andamento su sei mesi",
  "productPage.analytics.section.costing.heading": "Costi di commessa: ciò che ha preventivato contro ciò che è costato",
  "productPage.analytics.section.costing.body":
    "Il preventivo porta un costo stimato — ore della squadra, materiali dalla ricetta, una quota di spese generali — che il cliente non vede mai. A lavoro finito, le ore timbrate, i materiali comprati e le spese registrate stanno di fronte al prezzo, così sa cosa ha guadagnato davvero e quali stime sforano.",
  "productPage.analytics.section.costing.bullet.1": "Manodopera, materiali e spese contro il prezzo preventivato, per lavoro",
  "productPage.analytics.section.costing.bullet.2": "Precisione delle stime: lo scostamento mediano sui Suoi lavori completati",
  "productPage.analytics.section.costing.bullet.3": "Un richiamo a rivedere i costi quando un lavoro supera la soglia che stabilisce Lei",
  "productPage.analytics.section.costing.alt":
    "Il pannello Costo e margine su un preventivo: ore della squadra, spese generali come quota del prezzo, materiali e manodopera, e il costo stimato contro il prezzo del preventivo",
  "productPage.analytics.section.benchmark.heading": "Come si confrontano i Suoi prezzi, senza nominare nessuno",
  "productPage.analytics.section.benchmark.body":
    "Aderisca, e il Suo preventivo medio per categoria di servizio viene messo a confronto con la media anonimizzata delle altre aziende del Suo mestiere sulla piattaforma. I Suoi singoli preventivi non vengono mai condivisi e nessuna azienda viene nominata — la Sua compresa.",
  "productPage.analytics.section.benchmark.bullet.1": "Adesione dalle Impostazioni; nulla viene confrontato finché non lo dice Lei",
  "productPage.analytics.section.benchmark.bullet.2": "Prezzo medio e tasso di chiusura per categoria di servizio",
  "productPage.analytics.section.benchmark.bullet.3": "Solo medie aggregate — una categoria con troppo poche aziende non mostra nulla",
  "productPage.analytics.section.benchmark.alt":
    "Il confronto, prima di aderire: la spiegazione che il confronto è su adesione e il link alle Impostazioni",
  "productPage.analytics.section.ai.heading": "Chieda a FieldQuo AI della Sua azienda",
  "productPage.analytics.section.ai.body":
    "Quali clienti non sono ancora stati fatturati? Qual è il mio preventivo medio questo mese? Quali costi dei materiali sono saliti di più? FieldQuo AI cerca la risposta nei Suoi preventivi, fatture, clienti e costi invece di indovinare. Risponde solo sulla Sua azienda: rifiuta le domande generiche, e non vede mai i dati di un'altra azienda.",
  "productPage.analytics.section.ai.bullet.1": "Risposte dai Suoi numeri, con le cifre che ha usato",
  "productPage.analytics.section.ai.bullet.2": "Rifiuta tutto ciò che non riguarda la Sua azienda",
  "productPage.analytics.section.ai.bullet.3": "Misurato in credito IA, con una dotazione in ogni piano",
  "productPage.analytics.section.ai.alt":
    "FieldQuo AI: quattro domande da provare, su clienti non fatturati, valore medio dei preventivi, costi dei materiali e preventivi senza risposta",
  "productPage.analytics.faq.other-data.q": "L'IA vede i dati di altre aziende?",
  "productPage.analytics.faq.other-data.a":
    "No. FieldQuo AI legge i dati della Sua azienda e nient'altro. Il confronto dei prezzi usa medie anonimizzate a cui aderisce Lei; i Suoi preventivi non vengono mai mostrati a nessuno.",
  "productPage.analytics.faq.general.q": "Posso fargli domande generiche?",
  "productPage.analytics.faq.general.a":
    "No. Risponde a domande sulla Sua azienda — i Suoi preventivi, lavori, fatture, clienti, costi e ore — e rifiuta tutto il resto. Non è un assistente generico.",
  "productPage.analytics.faq.bank.q": "Devo collegare la mia banca?",
  "productPage.analytics.faq.bank.a":
    "No, e non può. Le entrate vengono dai pagamenti registrati in FieldQuo; le spese sono quelle che registra o importa da un CSV dell'estratto conto che scarica Lei stesso.",
  "productPage.analytics.faq.benchmark-source.q": "Da dove vengono i numeri del confronto?",
  "productPage.analytics.faq.benchmark-source.a":
    "Da altre aziende del Suo mestiere su FieldQuo che hanno aderito anch'esse, mediate per categoria di servizio senza nominare nessuno. Una categoria con troppo poche aziende dietro non mostra nulla piuttosto che un numero fuorviante.",

  // Page furniture shared by all four
  "productPage.chrome.readHow": "Legga come funziona",
  "productPage.chrome.inEnglish": "in inglese",
  "productPage.chrome.everythingTitle": "Tutto ciò che comprende {label}",
  "productPage.chrome.everythingBody":
    "Ogni funzione elencata qui è nel prodotto oggi. Dove una si ferma, lo dice.",
  "productPage.chrome.faqTitle": "Domande frequenti",
};

export default it;
