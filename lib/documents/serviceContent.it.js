// lib/documents/serviceContent.it.js
//
// What a quote SAYS about each trade — in Italian.
//
// ── Why a parallel file, and not translation at send time ───────────────────
//
// A document keeps the language it was created in (AGENTS.md non-negotiable
// #6). The prose here is not stored on the quote; resolveServiceContent picks
// it at render time from a STATIC catalogue keyed by the quote's own fixed
// `language`, so an Italian preventivo renders the same Italian sentences on
// the day it is signed and on every day after. Nothing is machine-translated
// at send time, and a viewer's browser language changes nothing.
//
// Written as an Italian impresa writes a preventivo to a private client: the
// formal "Lei", trade vocabulary rather than a calque of the English, and
// every scope boundary and caveat kept exactly — what is NOT included is the
// part a client holds the contractor to.
//
// Same rules as the English: nothing states a warranty term, a price, a cure
// time, a brand or a number of days that the English does not. Anything
// specific stays a [placeholder] — in Italian, and still in square brackets,
// because the resolver withholds a line with a bracket left in it whatever
// language the bracket is in. Same keys and shape as serviceContent.js; text
// fields only (no `accent`, no `variantOn` — those ride through from English).

const PREP_APPLY_FINISH = [
  {
    title: "Sopralluogo e conferma",
    body: "Confermiamo sul posto i lavori da eseguire, concordiamo con Lei finitura e colori e chiariamo ogni dubbio prima di iniziare.",
  },
  {
    title: "Protezione e preparazione",
    body: "Mobili spostati o coperti, superfici circostanti mascherate e tutte le superfici pulite e preparate per un risultato duraturo.",
  },
  {
    title: "Riparazioni e fondo",
    body: "Imperfezioni stuccate e carteggiate, e fondo applicato dove serve per l'aderenza e la copertura.",
  },
  {
    title: "Applicazione",
    body: "La finitura viene applicata a mani piene, rispettando tra una mano e l'altra i tempi di asciugatura che il prodotto richiede davvero.",
  },
  {
    title: "Pulizia e sopralluogo finale",
    body: "Mascherature rimosse, ambienti lasciati puliti e un sopralluogo insieme a Lei prima di considerare il lavoro concluso.",
  },
];

const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Preparazione e protezione della cucina",
    body: "Per prima cosa si montano mascherature e teli di contenimento — pavimenti, piani di lavoro, elettrodomestici e passaggi verso il resto della casa — così che polvere e nebulizzazione restino nella stanza in lavorazione.",
  },
  {
    title: "Smontaggio ed etichettatura",
    body: "Ante, frontali dei cassetti e ferramenta vengono smontati, e ogni pezzo viene etichettato per tornare esattamente sul vano da cui proviene.",
  },
  {
    title: "Pulizia e carteggiatura",
    body: "Ogni superficie viene sgrassata e poi carteggiata. Una finitura spruzzata sopra il grasso di cucina o su una laccatura lucida di fabbrica è una finitura che si stacca: per questo questa fase non va mai accorciata.",
  },
  {
    title: "Fondo e carteggiatura fine",
    body: "Si applica il fondo per bloccare le macchie e dare aggrappo alla mano di finitura, con una carteggiatura fine tra una mano e l'altra per abbattere la fibra sollevata dalla precedente.",
  },
  {
    title: "Finitura, controllo e ritocchi",
    body: "La finitura viene spruzzata a mani piene, poi controllata con una buona illuminazione e ritoccata prima di rimontare qualsiasi pezzo.",
  },
  {
    title: "Rimontaggio, pulizia e sopralluogo",
    body: "Ante e frontali vengono rimontati ciascuno sul proprio vano, la ferramenta rimessa in opera e le ante riallineate; la stanza viene pulita e la verifichiamo insieme a Lei.",
  },
];

const CABINET_REFACE_WORKFLOW = [
  {
    title: "Misure e scelta",
    body: "Ogni vano viene misurato sul posto e modello, colore e finitura delle ante vengono confermati con Lei prima di qualsiasi ordine. Le ante sono prodotte su queste misure e non possono essere ridimensionate in seguito.",
  },
  {
    title: "Ordine e produzione",
    body: "Ante, frontali dei cassetti e il materiale coordinato per i fianchi a vista delle scocche vengono prodotti sulle misure e nella finitura confermate.",
  },
  {
    title: "Smontaggio",
    body: "Ante, frontali dei cassetti e ferramenta esistenti vengono smontati e portati via.",
  },
  {
    title: "Preparazione e finitura delle scocche",
    body: "Le parti esterne a vista delle scocche vengono pulite, preparate e rifinite in abbinamento ai nuovi frontali, così che ciò che resta e ciò che viene sostituito appaiano come un'unica cucina.",
  },
  {
    title: "Montaggio e regolazione",
    body: "Cerniere montate, fori per le maniglie eseguiti nella posizione da Lei scelta, e ogni anta e cassetto allineati perché le fughe risultino regolari.",
  },
  {
    title: "Pulizia e sopralluogo",
    body: "La stanza viene pulita e la verifichiamo insieme a Lei prima della firma di fine lavori.",
  },
];

const SHELL_SEQUENCE = [
  {
    title: "Esame dei disegni",
    body: "Lei ci fornisce i disegni architettonici e strutturali. Esaminiamo i requisiti della struttura, individuiamo eventuali travi o pilastri in acciaio necessari e segnaliamo i problemi di accesso al cantiere prima che diventino ritardi.",
    timeline: "1–2 giorni",
  },
  {
    title: "Sopralluogo",
    body: "Percorriamo la proprietà per valutare vie di accesso, aree di deposito e ogni particolarità del sito — compreso il modo in cui il materiale verrà consegnato su un lotto stretto.",
    timeline: "1–2 ore",
  },
  {
    title: "Preventivo dettagliato",
    body: "Prezzi voce per voce, con lavori e tempistiche messi per iscritto. Nulla arriva dopo come sorpresa.",
    timeline: "3–5 giorni lavorativi",
  },
  {
    title: "Struttura",
    body: "Quando le fondazioni sono pronte e hanno superato il collaudo, si realizzano solai, pareti e copertura e si posano i rinforzi per impianto elettrico, idraulico e accessori. La struttura viene lasciata pronta per la posa grezza degli impianti.",
    timeline: "2–4 settimane",
  },
  {
    title: "Isolamento",
    body: "Dopo il collaudo della posa grezza degli impianti meccanici ed elettrici, si posa l'isolamento previsto — schiuma spray, pannelli o una combinazione, secondo i disegni e i requisiti energetici.",
    timeline: "3–7 giorni",
  },
  {
    title: "Cartongesso",
    body: "Lastre posate, nastrate e stuccate a livello 4, o a livello 5 dove previsto. Pareti lasciate pronte per fondo e pittura, e le nostre aree di lavoro pulite.",
    timeline: "1–2 settimane",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Consulenza e scelta",
    body: "Confermiamo con Lei lavori, materiali e finiture, e chiariamo ogni dubbio prima di ordinare.",
  },
  {
    title: "Rilievo delle misure",
    body: "Misure esatte prese sul posto, così che il materiale venga tagliato sul Suo spazio e non su una stima.",
  },
  {
    title: "Ordine e produzione",
    body: "Materiali ordinati e preparati sulle misure confermate.",
  },
  {
    title: "Rimozione e preparazione",
    body: "Materiale esistente rimosso e smaltito quando rientra nei lavori, e zona preparata per la posa.",
  },
  {
    title: "Posa e sopralluogo",
    body: "Posato, messo in bolla, sigillato e pulito, seguito da un sopralluogo insieme a Lei.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Diagnosi",
    body: "Individuiamo il problema sul posto e confermiamo cosa serve prima di impegnare lavoro o ricambi.",
  },
  {
    title: "Conferma",
    body: "Se l'intervento risulta diverso da quanto preventivato, Lei ne viene informato prima che procediamo — non dopo, in fattura.",
  },
  {
    title: "L'intervento",
    body: "Eseguito a regola d'arte e secondo le norme, con i ricambi e i metodi indicati in questo preventivo.",
  },
  {
    title: "Collaudo",
    body: "Tutto viene provato in normali condizioni di esercizio prima di rimettere via l'attrezzatura.",
  },
  {
    title: "Pulizia e consegna",
    body: "La zona viene lasciata come l'abbiamo trovata, e Le illustriamo cosa è stato fatto e a cosa prestare attenzione.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Conferma",
    body: "Confermiamo accesso, orari e qualsiasi aspetto a cui desidera che prestiamo particolare attenzione.",
  },
  {
    title: "Preparazione",
    body: "La zona viene preparata e tutto ciò che va protetto viene coperto prima di iniziare.",
  },
  {
    title: "L'intervento",
    body: "Eseguito secondo quanto indicato in questo preventivo, con attrezzature e materiali nostri salvo diversa indicazione.",
  },
  {
    title: "Controllo",
    body: "Verifichiamo il lavoro prima di andare via e sistemiamo tutto ciò che non è all'altezza.",
  },
];

const INSPECT_REPORT_REVIEW = [
  {
    title: "Appuntamento e accesso",
    body: "Confermiamo l'immobile, l'orario e le modalità di accesso. La Sua presenza è benvenuta — la maggior parte dei clienti trae più vantaggio dall'ispezione quando è presente.",
  },
  {
    title: "Ispezione sul posto",
    body: "Un'ispezione visiva delle aree e degli impianti facilmente accessibili indicati sopra. Non è invasiva: nulla viene smontato, nessuna superficie finita viene aperta e gli oggetti depositati non vengono spostati.",
  },
  {
    title: "Risultati sul posto",
    body: "Prima di andare via esaminiamo insieme a Lei quanto rilevato, così che i punti importanti Le vengano spiegati di persona e possa fare domande sul momento.",
  },
  {
    title: "Relazione scritta",
    body: "Una relazione scritta con fotografie di ogni rilievo significativo, del suo significato e di ciò che suggeriremmo di fare.",
  },
  {
    title: "Domande successive",
    body: "Rileggendo la relazione con calma sorgono domande. Restiamo a disposizione per parlarne insieme.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Lavori e programma",
    body: "Confermiamo l'intera portata dei lavori, organizziamo la sequenza delle lavorazioni e concordiamo con Lei data di inizio e durata prevista.",
  },
  {
    title: "Permessi e preparazione",
    body: "Si predispongono i permessi e i collaudi necessari, e il cantiere viene preparato e protetto.",
  },
  {
    title: "Demolizioni e impianti grezzi",
    body: "Materiale esistente rimosso e opere strutturali, elettriche e idrauliche portate al punto di poter essere collaudate.",
  },
  {
    title: "Finiture",
    body: "Superfici, apparecchi e finiture posati secondo le specifiche concordate sopra.",
  },
  {
    title: "Collaudo e consegna",
    body: "Collaudo finale, elenco delle difformità risolto, cantiere pulito e un sopralluogo insieme a Lei.",
  },
];

// The closing sentence every door variant repeats, as the English does: a
// client reading only their own variant still has to be told what happens to
// the boxes and the old doors.
const REFACE_TAIL =
  " Le parti esterne a vista delle scocche vengono rifinite in abbinamento, le cerniere sono fornite, montate e regolate, i fori per le maniglie vengono eseguiti nella posizione da Lei scelta, e le vecchie ante e i vecchi frontali vengono portati via.";

const REFACE_DESCRIPTION =
  "Sostituiamo le ante e i frontali dei cassetti e rifiniamo in abbinamento le parti esterne a vista delle scocche, così che la Sua cucina mantenga la disposizione e le scocche attuali. Il modello di anta quotato sopra è quello che verrà prodotto; le cerniere sono fornite, montate e regolate, i fori per le maniglie vengono eseguiti nella posizione da Lei scelta, e le vecchie ante e i vecchi frontali vengono portati via. L'interno dei mobili non viene rifinito, salvo che una voce qui sopra lo indichi.";

const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "Le ante e i frontali dei cassetti di questo preventivo sono in thermofoil: un'anima in MDF rivestita da una pellicola in vinile termoformata e rifinita in fabbrica nel colore da Lei scelto. Arrivano complete — sul posto nulla viene carteggiato, trattato con fondo o verniciato a spruzzo, e il colore non potrà essere cambiato in seguito senza sostituire l'anta." +
    REFACE_TAIL,
  painted_mdf:
    "Le ante e i frontali dei cassetti di questo preventivo sono in MDF laccato: un'anta in MDF lavorata a macchina e verniciata a spruzzo nel colore da Lei scelto. L'MDF non ha venatura che traspaia sotto la vernice, ed è questo che permette una laccatura uniforme e senza giunte visibili; inoltre potrà essere riverniciato in futuro." +
    REFACE_TAIL,
  red_oak:
    "Le ante e i frontali dei cassetti di questo preventivo sono in rovere rosso massello: un'anta in legno naturale dalla venatura aperta e marcata che traspare sotto la finitura, per cui non esistono due ante identiche. Il legno si muove con le stagioni, e sottili fessure che si aprono e si chiudono nei giunti tra traversi e montanti sono normali e non costituiscono un difetto." +
    REFACE_TAIL,
  white_oak:
    "Le ante e i frontali dei cassetti di questo preventivo sono in rovere bianco massello: un'anta in legno naturale dalla venatura più fitta e più diritta del rovere rosso, che traspare sotto la finitura, per cui non esistono due ante identiche. Il legno si muove con le stagioni, e sottili fessure che si aprono e si chiudono nei giunti tra traversi e montanti sono normali e non costituiscono un difetto." +
    REFACE_TAIL,
};

// Each ends by naming what is NOT in it, as the English does: the commonest
// gutter dispute is a client who thought the fascia, the roof or the second
// elevation was included.
const GUTTER_WORK_VARIANTS = {
  cleaning:
    "Puliamo le grondaie e i pluviali esistenti, li laviamo con acqua per dimostrare che scaricano, e ispezioniamo i canali mentre sono vuoti — staffe, giunture, raccordi e la tavola di gronda dietro di essi — sigillando man mano i piccoli difetti che troviamo. Quanto quotato qui è il lavoro elencato sopra: sostituire un tratto, ripristinarne la pendenza o riparare una tavola di gronda marcia sono lavori separati e compaiono solo dove li vede quotati.",
  install:
    "Forniamo e posiamo nuove grondaie sui tratti quotati sopra, sagomate sul posto sulla lunghezza della Sua tavola di gronda e fissate con una pendenza che porta l'acqua agli scarichi, con i pluviali elencati sopra condotti dove desidera che vada l'acqua. Vengono posati solo i tratti e i pluviali quotati sopra — parafoglie, cavi riscaldanti, sottogronda, tavola di gronda e qualsiasi lavoro sul tetto sono voci separate e sono compresi solo dove li vede quotati.",
  replacement:
    "Smontiamo le grondaie esistenti, le portiamo via e fissiamo al loro posto nuovi canali lungo i tratti quotati sopra, sagomati sul posto e posati con una pendenza che porta l'acqua agli scarichi, con i pluviali elencati sopra. La rimozione e lo smaltimento delle vecchie grondaie fanno parte di ciò che paga qui — li troverà compresi nella tariffa al piede o su una voce a sé. Una tavola di gronda che risulti marcia una volta tolto il vecchio canale Le viene segnalata con fotografie e quotata prima di qualsiasi riparazione. Vengono sostituiti solo i tratti e i pluviali quotati sopra.",
  repair:
    "Ripariamo i difetti elencati sopra — risigillando giunture e raccordi, rifissando le staffe e ripristinando la pendenza di brevi tratti perché il canale scarichi invece di trattenere l'acqua — e prima di andare via facciamo scorrere acqua nei tratti riparati, così che possa vederli defluire. Le riparazioni sono quotate a tratto in questo preventivo. Sostituire un canale intero, ripristinare la pendenza dell'intero sistema o risanare una tavola di gronda marcia sono lavori separati e compaiono solo dove li vede quotati.",
  guard_only:
    "Posiamo il parafoglie quotato sopra sui tratti elencati sopra. Un parafoglie va montato su una grondaia pulita, altrimenti imprigiona i detriti sotto di sé; per questo ogni tratto non pulito viene prima ripulito — tale pulizia è un lavoro separato ed è compresa solo dove la vede quotata. Vengono protetti solo i tratti quotati sopra, e pluviali, tetto e tutto ciò che sta sopra la linea di gronda sono voci separate alle stesse condizioni.",
};

export const GENERIC_IT = {
  included: [
    "Tutta la manodopera e l'attrezzatura necessarie per eseguire i lavori descritti sopra",
    "Protezione delle superfici e delle finiture circostanti durante la nostra presenza in cantiere",
    "Pulizia e rimozione dei nostri detriti a fine lavori",
    "Un sopralluogo insieme a Lei prima della firma di fine lavori",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

export const CONTENT_IT = {
  // ── Coatings and finishes ────────────────────────────────────────────────
  interior_painting: {
    description:
      "Tinteggiamo gli ambienti e le superfici quotati sopra. I mobili vengono spostati o coperti e i pavimenti protetti, i fori dei chiodi e le crepe stuccati, le fessure sigillate, e le superfici carteggiate e trattate con fondo dove serve prima delle mani di finitura. Vengono tinteggiate solo le superfici elencate sopra — soffitti, battiscopa e cornici, porte e interni degli armadi a muro sono voci separate e sono compresi solo dove li vede quotati.",
    included: [
      "Mobili spostati o coperti e pavimenti protetti in tutti gli ambienti",
      "Fori dei chiodi e crepe stuccati, zone ruvide carteggiate, fessure sigillate",
      "Fondo applicato dove serve per cambi di colore, riparazioni o superfici grezze",
      "Mani piene di pittura di alta qualità su ogni superficie elencata sopra",
      "Profilature a pennello su cornici, bordi e dettagli anziché linee col nastro",
      "Placche delle prese e ferramenta smontate e rimontate",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    description:
      "Laviamo le superfici esterne quotate sopra e le lasciamo asciugare, raschiamo il materiale che si stacca o si sfoglia, carteggiamo le zone ruvide, sigilliamo giunti e fessure aperti, diamo il fondo sulle parti grezze e riparate e poi applichiamo le mani di finitura. Vengono trattate solo le superfici elencate sopra — cornici, sottogronda, tavole di gronda, porte e persiane sono voci separate e sono compresi solo dove li vede quotati.",
    included: [
      "Superfici lavate e lasciate asciugare bene prima di qualsiasi applicazione",
      "Materiale che si stacca o si sfoglia raschiato, zone ruvide carteggiate",
      "Giunti, fessure e interstizi sigillati; piccole riparazioni superficiali eseguite",
      "Fondo per esterni sulle zone grezze e riparate",
      "Mani piene di pittura per esterni su ogni superficie elencata sopra",
      "Area lasciata sgombra da mascherature, teli di protezione e detriti",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    description:
      "Rinnoviamo la finitura dei mobili della cucina che già possiede. Ante, frontali dei cassetti e parti esterne a vista delle scocche vengono sgrassati, carteggiati, trattati con fondo e verniciati a spruzzo con una nuova finitura nel colore e nel grado di brillantezza da Lei scelti. Nulla viene sostituito: scocche, disposizione e modello delle ante restano esattamente come sono, e l'interno dei mobili non viene rifinito, salvo che una voce qui sopra lo indichi.",
    included: [
      "Colore e grado di brillantezza concordati con Lei prima di qualsiasi ordine",
      "Cucina mascherata e isolata perché polvere e nebulizzazione restino nella stanza",
      "Ante, frontali dei cassetti e ferramenta smontati, etichettati e rimontati",
      "Tutte le superfici sgrassate, carteggiate e preparate per l'aderenza",
      "Fondo applicato per bloccare le macchie e dare aggrappo alla finitura",
      "Finitura a spruzzo su entrambe le facce di ogni anta e frontale di cassetto",
      "Parti esterne delle scocche rifinite in abbinamento",
      "Ferramenta rimontata, ante riallineate e un sopralluogo insieme a Lei",
      "Fondo: [quante mani, e quale fondo utilizzate]",
      "Finitura: [quante mani, quale prodotto e il rapporto di catalisi se lo usate]",
      "Garanzia contro il distacco: [la vostra durata e cosa copre]",
      "Tempo abituale in cantiere: [quanti giorni, dall'inizio al sopralluogo finale]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    description: REFACE_DESCRIPTION,
    variantLabel: "il materiale delle ante",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Modello, colore e finitura delle ante confermati con Lei prima dell'ordine",
      "Ogni vano misurato sul posto, perché le ante siano fatte sulla Sua cucina",
      "Nuove ante e nuovi frontali dei cassetti prodotti su quelle misure",
      "Parti esterne delle scocche rifinite in abbinamento ai nuovi frontali",
      "Cerniere fornite, montate e regolate perché le ante stiano in bolla",
      "Fori per le maniglie eseguiti nella posizione da Lei scelta",
      "Ante, frontali e ferramenta esistenti smontati e portati via",
      "Ante e cassetti regolati alla consegna, con un sopralluogo finale",
      "Costruzione e finitura delle ante: [il vostro fornitore e la finitura prevista]",
      "Garanzia su ante e finitura: [la vostra durata e cosa copre]",
      "Tempi abituali dall'ordine alla posa: [i vostri tempi di consegna]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    description:
      "Rinnoviamo la finitura della scala così com'è. Pareti, colonnine e pavimento circostante vengono mascherati, i componenti quotati sopra vengono carteggiati fino al legno grezzo, ammaccature e fessure stuccate, la tinta viene applicata dove è stato scelto un colore, e seguono le mani protettive con una leggera carteggiatura tra una mano e l'altra. Vengono rifiniti solo i componenti elencati sopra — pedate, alzate, colonnine, pilastrini, corrimano e pianerottolo sono voci separate. Sostituire un componente, anziché rifinirlo, è un lavoro separato.",
    included: [
      "Pareti, colonnine e pavimento circostanti mascherati e protetti",
      "Pedate e componenti carteggiati e pronti per la finitura",
      "Fessure, ammaccature e imperfezioni stuccate",
      "Tinta applicata in modo uniforme su tutte le superfici preparate",
      "Mani di finitura protettive con leggera carteggiatura tra una mano e l'altra",
      "Indicazioni per la cura e l'asciugatura alla consegna",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    description:
      "Rinnoviamo i pavimenti in legno che già possiede nelle zone quotate sopra. Le doghe allentate vengono fissate, poi il pavimento viene levigato con grane via via più fini per togliere la vecchia finitura e livellare la superficie, fori e fessure vengono stuccati, la tinta viene applicata dove è stato scelto un colore, e seguono le mani protettive con una carteggiatura intermedia tra l'una e l'altra. Le doghe danneggiate oltre ciò che la levigatura può correggere richiedono una sostituzione e sono quotate a parte.",
    included: [
      "Mobili spostati secondo necessità e zone circostanti protette",
      "Doghe allentate fissate e pavimento controllato prima della levigatura",
      "Levigatura progressiva per togliere la vecchia finitura e livellare la superficie",
      "Fori dei chiodi e fessure stuccati prima dell'ultima passata",
      "Tinta applicata in modo uniforme dove è stato scelto un colore",
      "Mani di finitura protettive con carteggiatura intermedia tra l'una e l'altra",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    description:
      "Rileviamo sul posto la dima dei Suoi mobili, realizziamo il piano di lavoro nel materiale quotato sopra su quelle misure, rimuoviamo e smaltiamo il piano esistente, e posiamo, mettiamo in bolla e giuntiamo quello nuovo. I fori e il profilo del bordo elencati sopra sono ciò che verrà realizzato — ciò che non è elencato non viene lavorato. Scollegare e ricollegare impianto idraulico, elettrico e gas è un lavoro separato e compare sopra solo se lo ha richiesto.",
    included: [
      "Materiale fornito secondo le specifiche indicate sopra",
      "Rilievo della dima sul posto, per un piano su misura dei Suoi mobili reali",
      "Piano di lavoro esistente rimosso e smaltito",
      "Lavorazione compresi il profilo del bordo e i fori elencati",
      "Posa, messa in bolla e giunzione",
      "Giunti, giunzioni e perimetro sigillati",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { steps: MEASURE_SUPPLY_INSTALL },
  drywall: { steps: SHELL_SEQUENCE },
  drywall_install: { steps: SHELL_SEQUENCE },

  // ── Mechanical and electrical ────────────────────────────────────────────
  plumbing: { steps: ASSESS_REPAIR_TEST },
  electrical: { steps: ASSESS_REPAIR_TEST },
  hvac_install: { steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { steps: ASSESS_REPAIR_TEST },
  appliance_repair: { steps: ASSESS_REPAIR_TEST },
  garage_door: {
    description:
      "Forniamo e posiamo la porta o le porte quotate sopra, con le guide, le molle, i cavi e la ferramenta su cui scorrono, e prima di andare via la porta viene bilanciata e provata con più cicli di apertura e chiusura. Coprifili e rifiniture sono voci separate e sono compresi solo dove li vede quotati. Lavori elettrici, una nuova motorizzazione e qualsiasi modifica alle dimensioni o all'intelaiatura del vano sono lavori separati e non sono compresi, salvo che una voce qui sopra lo indichi.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { steps: ASSESS_REPAIR_TEST },
  well_water: { steps: ASSESS_REPAIR_TEST },
  elevator_services: { steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { steps: ASSESS_REPAIR_TEST },
  installation_services: { steps: MEASURE_SUPPLY_INSTALL },

  // ── Structure and envelope ───────────────────────────────────────────────
  roofing_service: {
    description:
      "Rimuoviamo il manto di copertura esistente fino al tavolato, ispezioniamo le tavole sottostanti e realizziamo sopra di esse una nuova copertura: guaina sottotegola, scossaline su ogni parete, camino, compluvio e sfiato, il manto quotato sopra, e la ventilazione di colmo e di gronda di cui il tetto ha bisogno per asciugarsi. Il materiale rimosso viene portato via dal cantiere e il terreno viene ripulito dai chiodi prima di andare via. Quanto quotato qui è la superficie di copertura elencata sopra — sottogronda, tavole di gronda, grondaie, isolamento e riparazioni strutturali sono lavori separati e compaiono solo dove li vede quotati.",
    included: [
      "Manto esistente rimosso e portato via dal cantiere",
      "Tavolato ispezionato e ogni parte danneggiata segnalata prima della sostituzione",
      "Guaina sottotegola, scossaline e ventilazione secondo necessità",
      "Nuova copertura posata secondo le specifiche del produttore",
      "Terreno sgomberato e ripulito da chiodi e detriti",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
    mayChange: [
      {
        title: "Più strati del previsto",
        body: "Questo preventivo è calcolato sugli strati che abbiamo potuto vedere o sondare. Un secondo o terzo strato sottostante significa più tempo di rimozione e più smaltimento, e Glielo comunicheremo prima di proseguire.",
      },
      {
        title: "Lo stato del tavolato",
        body: "Le tavole sotto il vecchio tetto non si possono ispezionare finché questo non viene tolto. Il tavolato sano viene ricoperto come preventivato; le parti marce vengono sostituite alla tariffa per pannello di questo preventivo, contate e mostrate a Lei.",
      },
      {
        title: "Meteo",
        body: "Un tetto aperto non resta aperto durante la notte. Una settimana di pioggia sposta la data di fine lavori e nient'altro — il prezzo non cambia perché ha piovuto.",
      },
    ],
    glossary: [
      {
        term: "Square (unità di copertura)",
        body: "100 piedi quadrati di superficie del tetto. È l'unità con cui tutto il settore ordina e quota — un tetto da 2.400 piedi quadrati equivale a 24 square.",
      },
      {
        term: "Pendenza",
        body: "L'inclinazione, espressa come salita su 12 pollici di sviluppo orizzontale. Un tetto che sale di 6 pollici ogni 12 in orizzontale è un \"6/12\". Un tetto a falde ha più superficie del terreno che copre, e uno più ripido richiede più tempo di lavoro.",
      },
      {
        term: "Tavolato (assito)",
        body: "I pannelli strutturali sopra i travetti a cui si fissa tutto il resto. Il suo stato non si può conoscere finché il vecchio manto non viene tolto.",
      },
      {
        term: "Rimozione del manto",
        body: "Lo smontaggio della copertura esistente. Gli strati quotati qui sono indicati nel preventivo; qualsiasi strato in più comporta manodopera e smaltimento aggiuntivi.",
      },
      {
        term: "Guaina sottotegola",
        body: "La membrana stesa sul tavolato prima della posa del manto. È lo strato che tiene fuori l'acqua quando il vento la spinge sotto una tegola.",
      },
    ],
  },
  gutter_services: {
    description: GUTTER_WORK_VARIANTS.cleaning,
    variantLabel: "il tipo di lavoro sulle grondaie",
    variants: GUTTER_WORK_VARIANTS,
    included: [
      "Grondaie pulite a mano e detriti portati via, non soffiati sul terreno",
      "Ogni pluviale lavato con acqua e verificato che scarichi",
      "Canali, staffe e giunture ispezionati mentre sono vuoti",
      "Piccole sigillature dove una giuntura o un raccordo lo richiede",
      "Ogni problema che richieda più di una sigillatura viene segnalato con fotografie prima di intervenire",
    ],
    steps: [
      {
        title: "Pulizia delle grondaie",
        body: "Ogni tratto viene ripulito a mano da foglie, graniglia e detriti accumulati, e i detriti vengono portati via anziché spinti nei pluviali o lasciati sul terreno.",
      },
      {
        title: "Lavaggio dei pluviali",
        body: "Ogni pluviale viene lavato con acqua e osservato, per confermare che ciò che esce dalla grondaia arrivi a terra. Una grondaia pulita sopra un pluviale intasato trabocca comunque.",
      },
      {
        title: "Ispezione e sigillatura",
        body: "A canali vuoti controlliamo staffe, giunture, raccordi e la tavola di gronda dietro di essi per individuare allentamenti, danni e perdite, e sigilliamo i piccoli difetti che troviamo. Qualsiasi problema più grande viene segnalato prima di intervenire, non aggiunto al conto.",
      },
      {
        title: "Parafoglie — facoltativo",
        body: "Dove previsto in questo preventivo, sui tratti puliti viene posato il parafoglie in alluminio Smart Screen. Compare sopra solo se è stato effettivamente venduto; un parafoglie montato su una grondaia non pulita imprigiona i detriti sotto di sé.",
      },
      {
        title: "Consegna",
        body: "La posa del parafoglie è coperta da una garanzia di [durata della garanzia] che copre [cosa copre]. Le grondaie vengono lasciate funzionanti e l'area di lavoro sgomberata.",
      },
    ],
    mayChange: [
      {
        title: "Come si presentano i canali una volta vuoti",
        body: "Una staffa allentata, una giuntura aperta o una tavola di gronda marcia dietro la grondaia non si vedono attraverso un canale pieno. Le piccole sigillature sono comprese nel prezzo sopra; ogni problema strutturale viene segnalato con fotografie e quotato a parte prima di qualsiasi intervento.",
      },
      {
        title: "Come si raggiunge il tetto",
        body: "Un tratto che richiede un ponteggio, un distanziatore per la scala sopra una veranda o una seconda persona per sicurezza richiede più tempo di uno raggiungibile con una scala su terreno piano.",
      },
      {
        title: "Quanti pluviali servono davvero al canale",
        body: "I pluviali di questo preventivo sono quelli che la casa ha oggi. Un canale che prima scaricava male scaricherà male anche con lamiera nuova; perciò, dove riteniamo che serva un altro scarico, lo diciamo e lo quotiamo a parte, anziché dare per scontato che Lei lo voglia.",
      },
    ],
    glossary: [
      {
        term: "Pluviale",
        body: "Il tubo verticale che porta l'acqua dalla grondaia a terra. Pulire la grondaia senza verificare che il pluviale scarichi risolve metà del problema.",
      },
      {
        term: "Staffa (cicogna)",
        body: "Il supporto che fissa la grondaia alla tavola di gronda. Una staffa allentata fa imbarcare il canale, e un canale imbarcato trattiene l'acqua invece di smaltirla.",
      },
      {
        term: "Tavola di gronda",
        body: "La tavola dietro la grondaia in cui si avvitano le staffe. Il lavoro sulle grondaie si ferma dove comincia il legno marcio, perché nel legno molle nulla tiene — ed è per questo che un preventivo di sostituzione può essere certo dello stato della tavola solo quando il vecchio canale è stato tolto.",
      },
      {
        term: "Grondaia senza giunture",
        body: "Canale profilato sul posto da un unico rotolo continuo sulla lunghezza esatta del tratto, così che gli unici giunti siano negli angoli e agli scarichi. La grondaia a elementi viene giuntata ogni pochi piedi, e ogni giunto è un punto che col tempo può perdere.",
      },
      {
        term: "Da cinque e da sei pollici",
        body: "La larghezza del canale. Un canale da sei pollici con uno scarico più grande porta molta più acqua di uno da cinque, ed è ciò che serve a un tetto grande, a un tetto ripido o a un compluvio che scarica in un solo angolo.",
      },
      {
        term: "Parafoglie in micro-rete",
        body: "Una rete fine che trattiene graniglia delle tegole, semi e aghi di pino oltre alle foglie. Una rete semplice trattiene le foglie e lascia passare i detriti piccoli: è questa la differenza tra i due prezzi.",
      },
      {
        term: "Parafoglie",
        body: "Una rete posata sulla grondaia che tiene fuori le foglie lasciando passare l'acqua. Riduce la pulizia ma non la elimina, e va montato su una grondaia pulita.",
      },
      {
        term: "Importo minimo di intervento",
        body: "Raggiungere un tratto corto costa quasi quanto raggiungerne uno lungo — lo stesso furgone, le stesse scale, lo stesso viaggio. Per questo i piccoli interventi sono addebitati a un importo minimo anziché al piede, e quando si applica il preventivo mostra l'integrazione su una voce a sé invece di gonfiare di nascosto la tariffa.",
      },
    ],
  },

  siding: {
    description:
      "Rimuoviamo il rivestimento esistente dalle pareti quotate sopra, controlliamo i pannelli di tamponamento retrostanti e ripristiniamo le parti previste da questo preventivo, poi posiamo una barriera all'acqua e al vento e il nuovo rivestimento elencato sopra, con profili di finitura agli angoli, alle finestre e alle porte. Vengono rivestite solo le pareti quotate sopra. Sottogronda, tavole di gronda, grondaie, finestre e isolamento sono voci separate e sono compresi solo dove li vede quotati.",
    steps: MEASURE_SUPPLY_INSTALL,
  },

  insulation: {
    description:
      "Isoliamo le zone quotate sopra fino al valore R indicato in questo preventivo. Prima si chiudono le infiltrazioni d'aria — correnti superiori, attraversamenti e botola — perché l'isolante rallenta il calore ma non ferma uno spiffero, poi il materiale viene posato allo spessore richiesto da quel valore R, mantenendo libero il percorso di ventilazione dove la stratigrafia lo prevede. Il materiale esistente resta al suo posto salvo che una voce qui sopra ne indichi la rimozione, e lo spessore effettivamente posato viene registrato e segnalato perché si possa verificare in seguito.",
    included: [
      "Condizioni e spessori esistenti registrati prima di coprire qualsiasi cosa",
      "Infiltrazioni d'aria sigillate su correnti superiori, attraversamenti e botola",
      "Percorso di ventilazione mantenuto libero dove la stratigrafia lo richiede",
      "Materiale posato allo spessore richiesto dal valore R indicato",
      "Indicatori di spessore lasciati in posizione e area di lavoro sgomberata",
    ],
    steps: [
      {
        title: "Esame del progetto",
        body: "Esaminiamo i disegni o percorriamo gli spazi e concordiamo esattamente quali zone isolare — seminterrato, testate dei travetti, soffitto del garage, sottotetto.",
        timeline: "1–2 giorni",
      },
      {
        title: "Preventivo",
        body: "Calcolato sulle zone da coprire, sul materiale e sullo spessore necessario a ciascuna stratigrafia per raggiungere il proprio valore R.",
        timeline: "2–4 giorni",
      },
      {
        title: "Programmazione",
        body: "Fissata dopo il completamento e il collaudo della struttura e della posa grezza degli impianti meccanici ed elettrici. Isolare prima di quel collaudo significa dover riaprire.",
        timeline: "Secondo necessità",
      },
      {
        title: "Preparazione del cantiere",
        body: "Zone sgomberate, e finestre, apparecchi e superfici finite mascherati e protetti.",
        timeline: "1–2 ore",
      },
      {
        title: "Applicazione",
        body: "Materiale posato allo spessore previsto, in più passate dove lo spessore lo richiede.",
        timeline: "1–3 giorni",
      },
      {
        title: "Rifilatura e pulizia",
        body: "Eccedenze rifilate a filo della struttura, nebulizzazione pulita, spessore registrato e zona consegnata pronta per la lavorazione successiva.",
        timeline: "In giornata",
      },
    ],
    mayChange: [
      {
        title: "Ciò che emerge una volta aperto lo spazio",
        body: "Il materiale bagnato, compattato o contaminato va rimosso prima di posare qualsiasi cosa, e un vecchio impianto elettrico a fili scoperti su isolatori in ceramica o un aspiratore del bagno che scarica nel sottotetto vanno sistemati prima. Nulla di tutto ciò si vede dalla botola.",
      },
      {
        title: "Lo spessore che l'intercapedine può davvero contenere",
        body: "Un'intercapedine chiusa contiene ciò che contiene. Dove lo spazio non permette di raggiungere il valore R previsto con il materiale preventivato, Glielo diremo e Le proporremo le alternative, anziché posarne di meno senza dirlo.",
      },
    ],
    glossary: [
      {
        term: "Valore R",
        body: "La resistenza della stratigrafia al passaggio del calore — più è alto, meglio è. È ciò che chiedono sia un programma di incentivi sia un ispettore edilizio, ed è il motivo dello spessore indicato in questo preventivo.",
      },
      {
        term: "Valore R per pollice",
        body: "Quanta resistenza fornisce ogni pollice di un materiale. È il motivo per cui due materiali che raggiungono lo stesso valore R hanno spessori diversi, e per cui uno dei due potrebbe non starci.",
      },
      {
        term: "Sigillatura all'aria",
        body: "Chiudere le fessure attraverso cui l'aria passa davvero prima di coprirle. L'isolante rallenta il calore ma non ferma uno spiffero, e insufflare su un sottotetto non sigillato è il motivo più comune per cui un lavoro rende meno del previsto.",
      },
      {
        term: "Deflettore di ventilazione",
        body: "Un canale che mantiene aperto il passaggio dalla bocchetta del sottogronda al sottotetto una volta posato l'isolante. Senza deflettori le bocchette si ostruiscono e il tavolato del tetto smette di asciugarsi.",
      },
    ],
  },
  masonry: { steps: MEASURE_SUPPLY_INSTALL },
  concrete: { steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    description:
      "Scaviamo la zona quotata sopra, stendiamo un geotessile di separazione e realizziamo un sottofondo in misto granulare compattato a strati, poi posiamo i masselli elencati sopra secondo lo schema concordato, in squadra con la casa e chiusi da una fila di bordura. I bordi vengono contenuti, le fughe riempite e compattate, e la superficie viene posata con una pendenza che allontana l'acqua dall'edificio. Il terreno smosso attorno ai lavori viene livellato e ripristinato. Spostamento di sottoservizi, drenaggi oltre l'area di lavoro e permessi sono esclusi e trattati a parte.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    description:
      "Spazziamo e soffiamo la superficie fino a pulirla, trattiamo le macchie d'olio e di grasso perché il sigillante aderisca, mascheriamo i bordi e applichiamo il sigillante sulla superficie del vialetto quotata sopra con il numero di mani indicato in questo preventivo. La sigillatura è manutenzione su una superficie sana: rallenta i danni da acqua e sole. Non ripara un asfalto già sgretolato, e non nasconde crepe o rappezzi esistenti — la sigillatura delle crepe è una voce separata ed è compresa solo dove la vede quotata.",
    steps: PREP_APPLY_FINISH,
  },
  fence_services: { steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { steps: VISIT_SERVICE_VERIFY },
  restoration: { steps: ASSESS_REPAIR_TEST },
  excavation: { steps: PLAN_BUILD_HANDOVER },
  demolition: { steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { steps: PLAN_BUILD_HANDOVER },

  home_inspection: {
    description:
      "Ispezioniamo le aree e gli impianti facilmente accessibili dell'immobile e Le consegniamo una relazione scritta, con fotografie, di quanto rilevato e del suo significato. L'ispezione è visiva e non invasiva: nulla viene smontato, nessuna superficie finita viene aperta e gli oggetti depositati non vengono spostati — perciò un difetto nascosto dietro di essi è un difetto che non possiamo segnalare. Test su radon, qualità dell'aria, apparecchi a legna, pozzo e fossa settica sono servizi separati e vengono eseguiti solo dove li vede quotati sopra.",
    included: [
      "Un'ispezione visiva delle aree facilmente accessibili dell'immobile",
      "Copertura, rivestimenti esterni, pendenze del terreno e drenaggio, per quanto raggiungibili in sicurezza",
      "Struttura, fondazioni e seminterrato o vespaio dove vi si può accedere",
      "Impianti di riscaldamento, raffrescamento, idraulico ed elettrico azionati con i normali comandi",
      "Finiture interne, finestre, porte, isolamento e ventilazione del sottotetto",
      "Una relazione scritta con fotografie dei rilievi significativi",
      "Tempo sul posto al termine per illustrarLe quanto rilevato",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Whole-project ────────────────────────────────────────────────────────
  general_contracting: { steps: SHELL_SEQUENCE },
  general_contracting_reno: { steps: PLAN_BUILD_HANDOVER },
  construction: { steps: SHELL_SEQUENCE },
  remodeling: { steps: PLAN_BUILD_HANDOVER },
  carpentry: { steps: MEASURE_SUPPLY_INSTALL },
  handyman: { steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { steps: VISIT_SERVICE_VERIFY },

  // ── Cleaning ─────────────────────────────────────────────────────────────
  residential_cleaning: {
    included: [
      "Tutti i prodotti e le attrezzature per la pulizia forniti da noi",
      "Ogni ambiente e superficie elencati sopra",
      "Sanitari, accessori e punti di contatto puliti",
      "Rifiuti portati via e sacchi dei cestini sostituiti",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { steps: VISIT_SERVICE_VERIFY },
  janitorial: { steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_driveway: { steps: VISIT_SERVICE_VERIFY },
  auto_detailing: { steps: VISIT_SERVICE_VERIFY },
  junk_removal: { steps: VISIT_SERVICE_VERIFY },

  // ── Grounds ──────────────────────────────────────────────────────────────
  landscaping_design: { steps: PLAN_BUILD_HANDOVER },
  lawn_care: { steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { steps: VISIT_SERVICE_VERIFY },
  irrigation: { steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    description:
      "Sgomberiamo dalla neve le zone quotate sopra secondo il piano indicato in questo preventivo, per la stagione che copre. Prima della neve posiamo dei paletti segnaletici, così che bordi del prato e aiuole siano visibili e vengano evitati. Vialetti pedonali, gradini e spargimento di sale sono voci separate e vengono sgomberati o trattati solo dove li vede quotati. Tetti, balconi e qualsiasi cosa lasciata nell'area da sgomberare e rimasta sepolta sotto la neve non sono compresi.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { steps: VISIT_SERVICE_VERIFY },
  pool_spa: { steps: VISIT_SERVICE_VERIFY },
  dog_walking: { steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { steps: VISIT_SERVICE_VERIFY },
};
