// app/i18n/industries/it.js — see en.js for structure and rationale.

const it = {
  chrome: {
    startTrial: "Prova gratuita",
    talkToUs: "Parliamone",
    noCard:
      "Il primo mese è gratuito — la sua carta non viene addebitata finché non finisce.",
    videoSoon: "Presentazione del prodotto in arrivo",
    videoDemoPrefix: "Preferisce vederla dal vivo?",
    videoDemoLink: "Prenota una demo",
    soundFamiliar: "Le suona familiare?",
    // {trade} è interpolato in minuscolo
    painIntro:
      "Sono queste le cose che costano soldi, in silenzio, alle imprese di {trade}. Ed ecco cosa fa FieldQuo per ognuna.",
    ctaTitle: "Lo provi sul suo prossimo lavoro di {trade}",
    ctaBody:
      "Imposti i suoi prezzi, invii un preventivo e veda se le fa risparmiare la serata. La prova è tutta qui.",
    nearby: "Disponibile anche per i mestieri affini",
  },

  trades: {
    cleaning: {
      label: "Pulizie",
      headline:
        "Il software per imprese di pulizie che tiene in carreggiata il lavoro ricorrente",
      description:
        "Le pulizie civili e industriali vivono di visite ripetute, squadre che ruotano e margini stretti su ogni lavoro. FieldQuo tiene il calendario, la lista di controllo e la fattura in un unico posto.",
      pains: [
        {
          pain: "I clienti ricorrenti vengono riprenotati a mano ogni settimana",
          fix: "Imposti una volta la cadenza delle visite e il calendario si ripete da solo, con la squadra giusta assegnata ogni volta.",
        },
        {
          pain: "Le squadre saltano dei passaggi e il cliente se ne accorge prima di lei",
          fix: "Liste di controllo per ogni lavoro che il team spunta dal telefono, così lo standard è lo stesso chiunque si presenti.",
        },
        {
          pain: "Le piccole fatture restano non pagate perché sollecitarle non vale il tempo che porta via",
          fix: "Solleciti automatici sulle fatture scadute, e il cliente paga online direttamente dall'email.",
        },
        {
          pain: "Non sa quali contratti siano davvero redditizi",
          fix: "Il tempo registrato su ogni lavoro, confrontato con quanto ha fatturato, così i contratti in perdita emergono presto.",
        },
      ],
    },

    "construction-contracting": {
      label: "Edilizia e costruzioni",
      headline:
        "Il software per l'edilizia che protegge il suo margine su ogni offerta",
      description:
        "Lavorazioni che si allargano, subappaltatori e prezzi dei materiali che cambiano tra il preventivo e l'apertura del cantiere. FieldQuo collega preventivi, programma e costi reali, così sa sempre a che punto è un progetto.",
      pains: [
        {
          pain: "Un preventivo porta via un'intera serata e qualcosa manca comunque",
          fix: "Costruisca partendo dal suo listino prezzi, con gruppi di lavorazioni riutilizzabili: un preventivo diventa un montaggio, non una stesura.",
        },
        {
          pain: "Il costo dei materiali cambia tra il preventivo e l'apertura del cantiere",
          fix: "Monitoraggio dei costi dei materiali con lo storico dei prezzi, per preventivare sui prezzi di oggi e non su quelli della stagione scorsa.",
        },
        {
          pain: "Le varianti si concordano a voce e ci si dimentica di metterle in fattura",
          fix: "Revisioni il preventivo, lo faccia riapprovare online e la fattura recepisce la modifica automaticamente.",
        },
        {
          pain: "Scopre che un progetto ha perso soldi solo a lavori finiti",
          fix: "Manodopera, materiali e spese registrati sul lavoro mentre procede, non ricostruiti a posteriori.",
        },
      ],
    },

    electrical: {
      label: "Impianti elettrici",
      headline:
        "Il software per elettricisti costruito attorno agli interventi di assistenza",
      description:
        "Tra interventi di assistenza, adeguamenti di quadro e verifiche da programmare, la burocrazia si accumula in fretta. FieldQuo si occupa delle scartoffie, così le sue ore qualificate vanno sul lavoro fatturabile.",
      pains: [
        {
          pain: "Le chiamate d'emergenza mandano all'aria una giornata programmata",
          fix: "Sposti l'intervento in un'altra fascia: i clienti e la squadra coinvolti vengono avvisati automaticamente.",
        },
        {
          pain: "Preventivare un adeguamento di quadro significa riscrivere ogni volta le stesse voci",
          fix: "Catalogo servizi salvato con le sue tariffe — scelga la lavorazione, la adatti, la invii.",
        },
        {
          pain: "Le foto del lavoro e le note delle verifiche restano sul telefono di qualcuno",
          fix: "Foto e note si allegano alla scheda del lavoro, quindi si ritrovano quando un cliente o un verificatore le chiede mesi dopo.",
        },
        {
          pain: "Le ore degli apprendisti si tirano a indovinare al momento delle buste paga",
          fix: "Ore registrate su lavori reali, approvate da un responsabile, che confluiscono direttamente nelle buste paga.",
        },
      ],
    },

    hvac: {
      label: "Climatizzazione",
      headline:
        "Il software per la climatizzazione, tra picchi stagionali e contratti di manutenzione",
      description:
        "Il suo anno è fatto di due corse e due periodi morti. FieldQuo l'aiuta a coprire il picco senza perdere nessuno e a far girare i ricavi della manutenzione nei mesi tranquilli.",
      pains: [
        {
          pain: "La prima ondata di caldo genera più chiamate di quante riesca a programmarne",
          fix: "Una pagina di prenotazione che mostra la disponibilità reale: il cliente si prenota da solo nelle fasce libere invece di restare in attesa al telefono.",
        },
        {
          pain: "I contratti di manutenzione si dimenticano finché non chiama il cliente",
          fix: "Visite ricorrenti pianificate in anticipo con promemoria automatici: il lavoro a contratto si prenota da sé.",
        },
        {
          pain: "I tecnici arrivano senza sapere quale impianto c'è sul posto",
          fix: "Storico completo del cliente e del lavoro sul telefono, compreso quello che è stato fatto all'ultima visita.",
        },
        {
          pain: "I preventivi di installazione li vince chi risponde per primo",
          fix: "Prepari e invii il preventivo dal vialetto di casa; il cliente approva online senza aspettare che lei rientri in ufficio.",
        },
      ],
    },

    handyman: {
      label: "Manutenzioni e riparazioni",
      headline:
        "Il software per il tuttofare, dove nessun lavoro è uguale al precedente",
      description:
        "Tanti piccoli lavori, una varietà enorme e prezzi da fare in fretta ma senza superficialità. FieldQuo tiene la burocrazia proporzionata alla dimensione del lavoro.",
      pains: [
        {
          pain: "Ogni lavoro è diverso, quindi non si riutilizza niente",
          fix: "Un catalogo delle sue lavorazioni ricorrenti e delle sue tariffe da cui comporre, per quanto insolita sia la combinazione.",
        },
        {
          pain: "I lavori piccoli non sembrano meritare un preventivo formale, e poi vengono contestati",
          fix: "Invii un preventivo dal telefono in meno di un minuto — il cliente approva per iscritto e resta agli atti.",
        },
        {
          pain: "Mezza giornata se ne va in telefonate per fissare gli appuntamenti",
          fix: "I clienti si prenotano da soli nelle fasce che ha davvero libere.",
        },
        {
          pain: "I pagamenti in contanti e per bonifico non vengono mai registrati come si deve",
          fix: "Registri qualsiasi metodo di pagamento sulla fattura, così i conti corrispondono alla realtà.",
        },
      ],
    },

    landscaping: {
      label: "Giardinaggio e paesaggistica",
      headline:
        "Il software per il giardinaggio, tra progetti chiavi in mano e squadre stagionali",
      description:
        "Progetti chiavi in mano, personale stagionale e un meteo che riscrive la settimana. FieldQuo tiene insieme preventivi, squadre e costi quando il programma cambia di continuo.",
      pains: [
        {
          pain: "La pioggia riscrive la settimana e bisogna avvisare tutti",
          fix: "Sposti i lavori sul calendario: i clienti e le squadre coinvolti vengono avvisati automaticamente.",
        },
        {
          pain: "I preventivi chiavi in mano sono lunghi e richiedono giorni per essere preparati",
          fix: "Raggruppi le lavorazioni in sezioni con le foto: un preventivo grande si legge chiaro e si costruisce in fretta.",
        },
        {
          pain: "Con gli stagionali il costo della manodopera è difficile da inquadrare",
          fix: "Tempo registrato per lavoro e per operaio, così conosce il costo reale della manodopera di una realizzazione.",
        },
        {
          pain: "Piante e materiali erodono il margine senza farsi notare",
          fix: "Monitori i costi dei materiali con lo storico dei prezzi e li confronti con quanto aveva preventivato.",
        },
      ],
    },

    "lawn-care": {
      label: "Manutenzione prati",
      headline:
        "Il software per la manutenzione dei prati, pensato per la densità del giro",
      description:
        "Volumi alti, importi bassi e un utile che dipende tutto da quanto è compatto il giro. FieldQuo fa girare visite ricorrenti e fatturazione con il minimo di burocrazia a ogni fermata.",
      pains: [
        {
          pain: "Riprenotare ogni settimana gli stessi clienti è un lavoro a sé",
          fix: "Imposti la cadenza una volta sola — le visite si generano da sole con la squadra giusta collegata.",
        },
        {
          pain: "Fatturare decine di piccoli clienti porta via una serata",
          fix: "Generi in blocco le fatture delle visite completate, con i link di pagamento online.",
        },
        {
          pain: "Una visita saltata o rinviata per pioggia viene fatturata lo stesso",
          fix: "Segni le visite come completate o saltate direttamente sul campo, e la fatturazione segue quello che è successo davvero.",
        },
        {
          pain: "Non riesce a capire quali giri valga la pena tenere",
          fix: "Ricavi e tempo per ogni lavoro, per vedere quali clienti giustificano il viaggio.",
        },
      ],
    },

    painting: {
      label: "Imbiancatura e verniciatura",
      headline:
        "Il software per imbianchini, per preventivi che il cliente approva davvero",
      description:
        "L'imbiancatura si vince sul preventivo — chiarezza, foto e arrivare prima degli altri due concorrenti. FieldQuo l'aiuta a mandare un preventivo professionale in giornata.",
      pains: [
        {
          pain: "È il terzo preventivo e anche il più lento ad arrivare",
          fix: "Costruisca il preventivo in cantiere con le sue tariffe e lo invii prima di lasciare il vialetto di casa.",
        },
        {
          pain: "Il cliente non capisce cosa è compreso e tira sul prezzo",
          fix: "Lavorazioni voce per voce con foto e inclusioni chiare: si parla del lavoro invece che della cifra.",
        },
        {
          pain: "Le scelte su colori e preparazione si concordano a voce e poi si contestano",
          fix: "È scritto nel preventivo approvato, con data e ora e l'approvazione online del cliente allegata.",
        },
        {
          pain: "Pitture e materiali costano più di quanto aveva previsto",
          fix: "Monitoraggio dei costi dei materiali con lo storico, così le sue ipotesi di preventivo restano aggiornate.",
        },
      ],
    },

    plumbing: {
      label: "Idraulica",
      headline:
        "Il software per idraulici, tra emergenze e lavori programmati",
      description:
        "Le emergenze non rispettano il programma, e la burocrazia va comunque fatta. FieldQuo tiene in movimento assegnazioni, storico dei lavori e fatturazione senza bisogno di un ufficio.",
      pains: [
        {
          pain: "Un'emergenza fa saltare una giornata già piena",
          fix: "Riprogrammi i lavori coinvolti con pochi tocchi; clienti e squadra vengono avvisati senza che lei debba telefonare.",
        },
        {
          pain: "Fattura alle dieci di sera perché la giornata è stata piena",
          fix: "Trasformi il lavoro completato in fattura sul posto, con un link di pagamento che il cliente può usare subito.",
        },
        {
          pain: "Nessuno ricorda cosa è stato fatto l'ultima volta in questa casa",
          fix: "Storico completo dei lavori per ogni cliente, foto e note comprese, sul telefono del tecnico.",
        },
        {
          pain: "Le richiamate si fanno gratis perché nessuno aveva registrato l'intervento originale",
          fix: "Ogni visita è un documento — cosa è stato sostituito, quando e a quali condizioni.",
        },
      ],
    },

    "pressure-washing": {
      label: "Lavaggio a pressione",
      headline:
        "Il software per il lavaggio a pressione, per preventivi rapidi e lavori chiusi in fretta",
      description:
        "Lavori brevi, volumi alti e preventivi che spesso si fanno da una foto. FieldQuo tiene la burocrazia abbastanza leggera da valere la pena su un lavoro di due ore.",
      pains: [
        {
          pain: "Preventivare da una foto vuol dire tirare a indovinare e sperare",
          fix: "Prezzi a metro quadro presi dal suo listino prezzi, così le stime restano coerenti da un lavoro all'altro.",
        },
        {
          pain: "Sui lavori brevi le scartoffie sembrano sproporzionate",
          fix: "Preventivo, pianificazione e fattura dal telefono, un paio di minuti ciascuno.",
        },
        {
          pain: "Attraversare la città per lavori sparsi rovina la giornata",
          fix: "Veda insieme i lavori della giornata e raggruppi gli spostamenti con criterio.",
        },
        {
          pain: "Le foto prima e dopo restano nella galleria del telefono",
          fix: "Le foto si allegano al lavoro — utili in caso di contestazione e per il marketing più avanti.",
        },
      ],
    },

    roofing: {
      label: "Coperture e tetti",
      headline:
        "Il software per il rifacimento tetti, tra preventivi importanti e squadre da coordinare",
      description:
        "Lavori di valore alto, dipendenza dal meteo e clienti da convincere prima della firma. FieldQuo l'aiuta a preventivare con chiarezza e a tenere coordinate le squadre una volta preso il lavoro.",
      pains: [
        {
          pain: "Un preventivo da cinque cifre riceve un'email di una riga e poi più niente",
          fix: "Preventivi dettagliati con lavorazioni, foto e opzioni che il cliente approva online — e sollecito automatico se sparisce.",
        },
        {
          pain: "Il meteo sposta il programma e la squadra lo scopre tardi",
          fix: "Riprogrammi una volta sola; le notifiche alla squadra e al cliente partono da sole.",
        },
        {
          pain: "Acconti e pagamenti in avanzamento sono segnati solo a memoria",
          fix: "Registri acconti e pagamenti parziali sulla fattura, con il saldo sempre visibile a entrambe le parti.",
        },
        {
          pain: "Gli sfridi di materiale erodono il margine in silenzio",
          fix: "Monitori i costi dei materiali su ogni lavoro e li confronti con quanto aveva previsto a preventivo.",
        },
      ],
    },

    "tree-care": {
      label: "Cura degli alberi",
      headline:
        "Il software per l'arboricoltura, per un lavoro ad alto rischio e ad alto valore",
      description:
        "Attrezzature, sicurezza della squadra e lavori prezzati a giudizio più che a listino. FieldQuo tiene in ordine la documentazione, dal sopralluogo fino alla fattura.",
      pains: [
        {
          pain: "Ogni lavoro si prezza a giudizio e non c'è niente di confrontabile",
          fix: "I lavori passati, con le lavorazioni, le foto e il prezzo finale, restano consultabili: il suo giudizio ha un riferimento.",
        },
        {
          pain: "I rischi del posto si discutono sul posto e non si mettono mai per iscritto",
          fix: "Note, foto e liste di controllo si allegano al lavoro prima che arrivi la squadra.",
        },
        {
          pain: "Il lavoro d'emergenza dopo una tempesta arriva tutto insieme",
          fix: "Raccolga le richieste da un modulo di prenotazione e le smisti senza il telefono che squilla di continuo.",
        },
        {
          pain: "Il tempo di squadra e attrezzature non si riflette nel prezzo",
          fix: "Registrazione del tempo per lavoro confrontata con quanto ha fatturato, così il prezzo migliora sulla base dei fatti.",
        },
      ],
    },
  },
};

export default it;
