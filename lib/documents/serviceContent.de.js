// lib/documents/serviceContent.de.js
//
// What a quote SAYS about each trade — in German.
//
// ── Why a parallel file, and not translation at send time ───────────────────
//
// A document keeps the language it was created in (AGENTS.md non-negotiable
// #6). The prose here is not stored on the quote; resolveServiceContent picks
// it at render time from a STATIC catalogue keyed by the quote's own fixed
// `language`, so a German quote renders the same German sentences on the day
// it is signed and on every day after. Nothing is machine-translated at send
// time, and a viewer's browser language changes nothing.
//
// The register is the one a German Handwerksbetrieb uses in an Angebot to a
// private customer: formal "Sie", "Position" for a priced line, "bepreist" for
// "priced above". Trade words are the ones a Maler, Tischler or Dachdecker
// would write (Korpus, Schubkastenblende, Stirnbrett, Unterdeckbahn), not
// calques of the English.
//
// Same rules as the English: nothing states a warranty term, a price, a cure
// time, a brand or a number of days that the English does not already carry.
// Anything specific stays a [placeholder] — in German, still in square
// brackets and under the 80-character matcher limit, because the resolver
// withholds a line with a bracket left in it whatever language it is in.
// Text fields only: `accent` and `variantOn` ride through from the English.

const PREP_APPLY_FINISH = [
  {
    title: "Begehung und Abstimmung",
    body: "Wir bestätigen den Leistungsumfang vor Ort, legen Oberfläche und Farbtöne gemeinsam fest und klären alle offenen Fragen, bevor die Arbeit beginnt.",
  },
  {
    title: "Schutz und Vorbereitung",
    body: "Möbel werden verrückt oder abgedeckt, angrenzende Flächen abgeklebt und alle Oberflächen gereinigt und für ein dauerhaftes Ergebnis vorbereitet.",
  },
  {
    title: "Ausbesserung und Grundierung",
    body: "Unebenheiten werden gespachtelt und geschliffen, und wo es für Haftung und Deckkraft nötig ist, wird grundiert.",
  },
  {
    title: "Beschichtung",
    body: "Die Beschichtung wird in vollen Anstrichen aufgetragen, mit der Trocknungszeit dazwischen, die das Produkt tatsächlich verlangt.",
  },
  {
    title: "Aufräumen und Schlussbegehung",
    body: "Abklebungen werden entfernt, der Bereich sauber hinterlassen, und wir gehen alles mit Ihnen durch, bevor wir die Arbeit als fertig betrachten.",
  },
];

const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Vorbereitung und Schutz der Küche",
    body: "Zuerst werden Abklebung und Staubschutz aufgebaut — Böden, Arbeitsplatten, Geräte und die Durchgänge zum Rest des Hauses —, damit Staub und Sprühnebel in dem Raum bleiben, in dem gearbeitet wird.",
  },
  {
    title: "Demontage und Beschriftung",
    body: "Türen, Schubkastenblenden und Beschläge werden abgenommen, und jedes Teil wird beschriftet, damit es wieder an genau die Öffnung kommt, von der es stammt.",
  },
  {
    title: "Reinigen und Schleifen",
    body: "Jede Fläche wird entfettet und anschließend geschliffen. Ein Lack, der über Küchenfett oder eine glänzende Werksbeschichtung gespritzt wird, blättert ab — deshalb ist dies nicht der Schritt, an dem gespart werden sollte.",
  },
  {
    title: "Grundierung und Feinschliff",
    body: "Die Grundierung sperrt Verfärbungen ab und gibt dem Decklack Halt; zwischen den Schichten folgt ein Feinschliff, der die von der vorigen Schicht aufgestellten Holzfasern wieder glättet.",
  },
  {
    title: "Decklack, Kontrolle und Ausbesserung",
    body: "Der Decklack wird in vollen Schichten gespritzt, dann bei gutem Licht kontrolliert und ausgebessert, bevor irgendetwas wieder montiert wird.",
  },
  {
    title: "Montage, Reinigung und Begehung",
    body: "Türen und Blenden kommen wieder an ihre eigenen Öffnungen, die Beschläge werden montiert und die Türen neu ausgerichtet, der Raum wird gereinigt, und wir gehen ihn mit Ihnen durch.",
  },
];

const CABINET_REFACE_WORKFLOW = [
  {
    title: "Aufmaß und Festlegung",
    body: "Jede Öffnung wird vor Ort ausgemessen, und Türmodell, Farbton und Oberfläche werden mit Ihnen bestätigt, bevor etwas bestellt wird. Die Türen werden nach diesen Maßen gefertigt und können nachträglich nicht angepasst werden.",
  },
  {
    title: "Bestellung und Fertigung",
    body: "Türen, Schubkastenblenden und das passende Material für die Korpusseiten werden nach den bestätigten Maßen und in der bestätigten Oberfläche gefertigt.",
  },
  {
    title: "Demontage",
    body: "Die vorhandenen Türen, Schubkastenblenden und Beschläge werden abgenommen und abtransportiert.",
  },
  {
    title: "Korpusseiten vorbereiten und beschichten",
    body: "Die sichtbaren Außenseiten der Korpusse werden gereinigt, vorbereitet und passend zu den neuen Fronten beschichtet, sodass das, was bleibt, und das, was ersetzt wird, wie eine einzige Küche wirken.",
  },
  {
    title: "Montage und Einstellung",
    body: "Scharniere werden montiert, Griffbohrungen an der von Ihnen gewählten Position gesetzt und jede Tür und Schublade so ausgerichtet, dass die Fugen gleichmäßig sind.",
  },
  {
    title: "Reinigung und Begehung",
    body: "Der Raum wird gereinigt, und wir gehen ihn mit Ihnen durch, bevor er abgenommen wird.",
  },
];

// The durations are the English file's (a real contractor's published
// figures), translated rather than restated — nothing new is committed here.
const SHELL_SEQUENCE = [
  {
    title: "Planprüfung",
    body: "Sie stellen die Architekten- und Tragwerkspläne bereit. Wir prüfen die Anforderungen an den Holzrahmenbau, ermitteln, ob Stahlträger oder Stahlstützen nötig sind, und benennen Probleme mit der Zufahrt, bevor daraus Verzögerungen auf der Baustelle werden.",
    timeline: "1–2 Tage",
  },
  {
    title: "Ortstermin",
    body: "Wir begehen das Grundstück und prüfen Zufahrtswege, Lagerflächen und alle Besonderheiten des Standorts — auch, wie das Material auf ein enges Grundstück geliefert wird.",
    timeline: "1–2 Stunden",
  },
  {
    title: "Detailliertes Angebot",
    body: "Eine aufgeschlüsselte Preisaufstellung mit schriftlich festgehaltenem Leistungsumfang und Zeitplan. Nichts kommt später als Überraschung hinterher.",
    timeline: "3–5 Werktage",
  },
  {
    title: "Holzrahmenbau",
    body: "Sobald das Fundament fertig ist und die Abnahme bestanden hat, werden Böden, Wände und Dach im Holzrahmenbau erstellt und Unterkonstruktionen für Elektro, Sanitär und Einbauten gesetzt. Die Konstruktion wird bereit für die Rohinstallation der Haustechnik übergeben.",
    timeline: "2–4 Wochen",
  },
  {
    title: "Dämmung",
    body: "Nachdem die Rohinstallation von Haustechnik und Elektro abgenommen ist, wird die vorgegebene Dämmung eingebracht — Sprühschaum, Dämmmatten oder eine Kombination, gemäß den Plänen und den energetischen Anforderungen.",
    timeline: "3–7 Tage",
  },
  {
    title: "Trockenbau",
    body: "Platten montiert, Fugen bewehrt und in Qualitätsstufe Level 4 verspachtelt, oder Level 5, wo vorgegeben. Wände bereit für Grundierung und Anstrich übergeben, unsere Arbeitsbereiche gereinigt.",
    timeline: "1–2 Wochen",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Beratung und Auswahl",
    body: "Wir stimmen Leistungsumfang, Materialien und Oberflächen mit Ihnen ab und klären alle offenen Fragen, bevor bestellt wird.",
  },
  {
    title: "Aufmaß",
    body: "Genaue Maße werden vor Ort genommen, damit das Material auf Ihren Raum zugeschnitten wird und nicht auf eine Schätzung.",
  },
  {
    title: "Bestellung und Fertigung",
    body: "Materialien werden nach den bestätigten Maßen bestellt und vorbereitet.",
  },
  {
    title: "Rückbau und Vorbereitung",
    body: "Vorhandenes Material wird ausgebaut und entsorgt, sofern das zum Leistungsumfang gehört, und der Bereich wird für die Montage vorbereitet.",
  },
  {
    title: "Montage und Begehung",
    body: "Montiert, ausgerichtet, abgedichtet und gereinigt, anschließend eine gemeinsame Begehung mit Ihnen.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Befundaufnahme",
    body: "Wir stellen die Ursache vor Ort fest und klären, was nötig ist, bevor Arbeitszeit oder Teile verbindlich eingeplant werden.",
  },
  {
    title: "Abstimmung",
    body: "Stellt sich heraus, dass der Auftrag vom Angebot abweicht, erfahren Sie das, bevor wir weitermachen — nicht erst hinterher auf der Rechnung.",
  },
  {
    title: "Die Ausführung",
    body: "Fachgerecht nach den geltenden Vorschriften ausgeführt, mit den Teilen und Methoden, die in diesem Angebot festgelegt sind.",
  },
  {
    title: "Funktionsprüfung",
    body: "Alles wird unter normalen Betriebsbedingungen geprüft, bevor wir zusammenpacken.",
  },
  {
    title: "Aufräumen und Übergabe",
    body: "Der Bereich wird so hinterlassen, wie wir ihn vorgefunden haben, und wir erklären Ihnen, was gemacht wurde und worauf Sie achten sollten.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Abstimmung",
    body: "Wir stimmen Zugang und Zeitpunkt mit Ihnen ab und klären, worauf wir aus Ihrer Sicht besonders achten sollen.",
  },
  {
    title: "Vorbereitung",
    body: "Der Arbeitsbereich wird vorbereitet, und alles Schützenswerte wird abgedeckt, bevor wir beginnen.",
  },
  {
    title: "Die Ausführung",
    body: "Im Umfang dieses Angebots ausgeführt, mit unserer eigenen Ausrüstung und unserem eigenen Material, sofern nicht anders angegeben.",
  },
  {
    title: "Kontrolle",
    body: "Wir prüfen die Arbeit, bevor wir gehen, und bessern alles nach, was nicht dem Standard entspricht.",
  },
];

const INSPECT_REPORT_REVIEW = [
  {
    title: "Termin und Zugang",
    body: "Wir bestätigen Objekt, Uhrzeit und wie der Zugang geregelt ist. Sie sind herzlich eingeladen, dabei zu sein — die meisten Kunden haben mehr von der Inspektion, wenn sie anwesend sind.",
  },
  {
    title: "Inspektion vor Ort",
    body: "Eine Sichtprüfung der oben genannten, frei zugänglichen Bereiche und Anlagen. Sie ist zerstörungsfrei: Nichts wird zerlegt, keine fertige Oberfläche geöffnet, und eingelagerte Gegenstände werden nicht bewegt.",
  },
  {
    title: "Befunde vor Ort",
    body: "Wir besprechen die Ergebnisse mit Ihnen, bevor wir gehen, damit Sie die wesentlichen Punkte persönlich hören und direkt nachfragen können.",
  },
  {
    title: "Schriftlicher Bericht",
    body: "Ein schriftlicher Bericht mit Fotos zu jedem wesentlichen Befund, seiner Bedeutung und unserer Empfehlung, was zu tun ist.",
  },
  {
    title: "Fragen im Nachgang",
    body: "Wenn Sie sich in Ruhe mit dem Bericht befassen, kommen Fragen auf. Wir bleiben erreichbar, um sie mit Ihnen durchzugehen.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Umfang und Zeitplan",
    body: "Wir bestätigen den gesamten Leistungsumfang, planen die Abfolge der Gewerke und vereinbaren mit Ihnen einen Starttermin und die voraussichtliche Dauer.",
  },
  {
    title: "Genehmigungen und Vorbereitung",
    body: "Erforderliche Genehmigungen und Abnahmen werden organisiert, und die Baustelle wird vorbereitet und geschützt.",
  },
  {
    title: "Rückbau und Rohinstallation",
    body: "Vorhandenes Material wird entfernt, und Tragwerks-, Elektro- und Sanitärarbeiten werden bis zur Abnahmereife ausgeführt.",
  },
  {
    title: "Ausbau",
    body: "Oberflächen, Einbauten und Ausstattung werden gemäß der oben vereinbarten Spezifikation eingebaut.",
  },
  {
    title: "Abnahme und Übergabe",
    body: "Schlussabnahme, Mängelliste abgearbeitet, Baustelle gereinigt und eine gemeinsame Begehung mit Ihnen.",
  },
];

// The English repeats its closing sentence in every door variant on purpose —
// a client reading only their own variant still has to be told what happens to
// the boxes and the old doors — so it is one shared tail here too.
const REFACE_TAIL =
  " Die sichtbaren Außenseiten der Korpusse werden passend beschichtet, Scharniere geliefert, montiert und eingestellt, Griffbohrungen an der von Ihnen gewählten Position gesetzt, und die alten Türen und Blenden werden abtransportiert.";

const REFACE_DESCRIPTION =
  "Wir ersetzen die Türen und Schubkastenblenden und beschichten die sichtbaren Außenseiten der Korpusse passend dazu, sodass Ihre Küche ihre bestehende Aufteilung und ihre vorhandenen Korpusse behält. Gefertigt wird das oben bepreiste Türmodell; Scharniere werden geliefert, montiert und eingestellt, Griffbohrungen an der von Ihnen gewählten Position gesetzt, und die alten Türen und Blenden werden abtransportiert. Das Innere der Schränke wird nur neu beschichtet, wenn eine Position oben das ausweist.";

const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "Die Türen und Schubkastenblenden in diesem Angebot sind aus Thermofolie: ein MDF-Kern, ummantelt mit einer warmverformten Vinylfolie und im Werk im von Ihnen gewählten Farbton fertig beschichtet. Sie werden fertig geliefert — vor Ort wird nichts geschliffen, grundiert oder gespritzt, und der Farbton lässt sich später nur durch Austausch der Tür ändern." +
    REFACE_TAIL,
  painted_mdf:
    "Die Türen und Schubkastenblenden in diesem Angebot sind aus lackiertem MDF: eine gefräste MDF-Tür, im von Ihnen gewählten Farbton gespritzt. MDF hat keine Maserung, die sich durch den Lack abzeichnet — das macht eine gleichmäßige, fugenlose Lackoberfläche möglich —, und die Tür kann später neu lackiert werden." +
    REFACE_TAIL,
  red_oak:
    "Die Türen und Schubkastenblenden in diesem Angebot sind aus massiver Roteiche: eine Tür aus Naturholz mit offener, ausgeprägter Maserung, die sich durch die Oberfläche zeigt, sodass keine Tür der anderen gleicht. Holz arbeitet mit den Jahreszeiten, und feine Haarfugen, die sich an den Verbindungen zwischen Quer- und Längsfriesen öffnen und schließen, sind normal und kein Mangel." +
    REFACE_TAIL,
  white_oak:
    "Die Türen und Schubkastenblenden in diesem Angebot sind aus massiver Weißeiche: eine Tür aus Naturholz mit feinerer, geraderer Maserung als Roteiche, die sich durch die Oberfläche zeigt, sodass keine Tür der anderen gleicht. Holz arbeitet mit den Jahreszeiten, und feine Haarfugen, die sich an den Verbindungen zwischen Quer- und Längsfriesen öffnen und schließen, sind normal und kein Mangel." +
    REFACE_TAIL,
};

// Each ends, like the English, by naming what is NOT included — the commonest
// gutter dispute is a client who thought the fascia or the roof was in it.
const GUTTER_WORK_VARIANTS = {
  cleaning:
    "Wir reinigen Ihre vorhandenen Dachrinnen und Fallrohre, spülen sie durch, um zu zeigen, dass sie ablaufen, und prüfen die Rinnen, solange sie leer sind — Rinnenhalter, Nähte, Stöße und das Stirnbrett dahinter —, wobei wir kleine Mängel gleich abdichten. Bepreist sind hier die oben aufgeführten Arbeiten: eine Rinne zu ersetzen, ihr Gefälle neu einzustellen oder ein morsches Stirnbrett instand zu setzen, ist eine gesonderte Leistung und nur enthalten, wo Sie sie bepreist sehen.",
  install:
    "Wir liefern und montieren neue Dachrinnen an den oben bepreisten Abschnitten, vor Ort auf die Länge Ihres Stirnbretts geformt und mit einem Gefälle aufgehängt, das das Wasser zu den Abläufen führt; die oben aufgeführten Fallrohre werden dorthin geführt, wo das Wasser hin soll. Montiert werden nur die oben bepreisten Rinnen und Fallrohre — Laubschutz, Heizkabel, Dachuntersicht, Stirnbretter und jegliche Dacharbeiten sind eigene Positionen und nur enthalten, wo Sie sie bepreist sehen.",
  replacement:
    "Wir nehmen Ihre vorhandenen Dachrinnen ab, transportieren sie ab und hängen an den oben bepreisten Abschnitten neue Rinnen auf, vor Ort geformt und mit einem Gefälle, das das Wasser zu den Abläufen führt, samt den oben aufgeführten Fallrohren. Abbau und Entsorgung der alten Rinnen sind Teil dessen, wofür Sie hier bezahlen — Sie sehen das entweder im Preis pro Fuß oder als eigene Position. Ein Stirnbrett, das sich nach dem Abnehmen der alten Rinne als morsch erweist, wird Ihnen mit Fotos gemeldet und bepreist, bevor etwas davon repariert wird. Ersetzt werden nur die oben bepreisten Rinnen und Fallrohre.",
  repair:
    "Wir beheben die oben aufgeführten Mängel — Nähte und Stöße neu abdichten, Rinnenhalter neu befestigen und kurze Abschnitte im Gefälle nachrichten, damit die Rinne abläuft, statt Wasser zu halten — und lassen vor unserer Abfahrt Wasser durch die reparierten Abschnitte laufen, damit Sie den Abfluss sehen. Reparaturen werden in diesem Angebot pro Abschnitt berechnet. Eine komplette Rinne zu ersetzen, das Gefälle des ganzen Systems neu einzustellen oder ein morsches Stirnbrett instand zu setzen, ist eine gesonderte Leistung und nur enthalten, wo Sie sie bepreist sehen.",
  guard_only:
    "Wir montieren den oben bepreisten Laubschutz auf den oben aufgeführten Rinnen. Laubschutz gehört auf eine saubere Rinne, sonst hält er den Schmutz nur darunter fest; jede Rinne, die nicht sauber ist, wird daher zuerst gereinigt — diese Reinigung ist eine gesonderte Leistung und nur enthalten, wo Sie sie bepreist sehen. Nur die oben bepreisten Rinnen erhalten Laubschutz; Fallrohre, Dach und alles oberhalb der Rinnenkante sind eigene Positionen zu denselben Bedingungen.",
};

export const GENERIC_DE = {
  included: [
    "Sämtliche Arbeitsleistung und Ausrüstung, die für die oben beschriebenen Arbeiten erforderlich sind",
    "Schutz angrenzender Flächen und Oberflächen, solange wir vor Ort sind",
    "Reinigung und Abtransport unserer eigenen Abfälle nach Abschluss",
    "Eine gemeinsame Begehung mit Ihnen vor der Abnahme",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

export const CONTENT_DE = {
  // ── Beschichtungen und Oberflächen ──────────────────────────────────────
  interior_painting: {
    description:
      "Wir streichen die oben bepreisten Räume und Flächen. Möbel werden verrückt oder abgedeckt und die Böden geschützt, Nagellöcher und Risse gespachtelt, Fugen mit Acryl geschlossen und die Flächen, wo nötig, geschliffen und grundiert, bevor die Deckanstriche aufgetragen werden. Gestrichen werden nur die oben aufgeführten Flächen — Decken, Leisten und Zargen, Türen sowie das Innere von Einbauschränken sind eigene Positionen und nur enthalten, wo Sie sie bepreist sehen.",
    included: [
      "Möbel verrückt oder abgedeckt und Böden durchgehend geschützt",
      "Nagellöcher und Risse gespachtelt, raue Stellen geschliffen, Fugen verschlossen",
      "Grundierung, wo für Farbwechsel, Ausbesserungen oder rohe Flächen nötig",
      "Volle Anstriche mit hochwertiger Farbe auf jeder oben aufgeführten Fläche",
      "Saubere Pinselkanten an Leisten, Rändern und Details statt abgeklebter Linien",
      "Steckdosenabdeckungen und Beschläge abgenommen und wieder montiert",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    description:
      "Wir waschen die oben bepreisten Außenflächen und lassen sie trocknen, schaben lose und abblätternde Beschichtung ab, schleifen raue Stellen, schließen offene Fugen und Anschlüsse, grundieren rohe und ausgebesserte Stellen und tragen dann die Deckanstriche auf. Beschichtet werden nur die oben aufgeführten Flächen — Zierleisten, Dachuntersicht, Stirnbretter, Türen und Fensterläden sind eigene Positionen und nur enthalten, wo Sie sie bepreist sehen.",
    included: [
      "Flächen gewaschen und vollständig getrocknet, bevor eine Beschichtung aufgetragen wird",
      "Lose und abblätternde Beschichtung abgeschabt, raue Stellen geschliffen",
      "Fugen, Anschlüsse und Spalten abgedichtet; kleine Oberflächenschäden ausgebessert",
      "Grundierung für außen auf rohen und ausgebesserten Stellen",
      "Volle Anstriche mit Fassadenfarbe auf jeder oben aufgeführten Fläche",
      "Grundstück frei von Abklebungen, Abdeckplanen und Abfall hinterlassen",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    description:
      "Wir lackieren Ihre vorhandenen Küchenschränke neu. Türen, Schubkastenblenden und die sichtbaren Außenseiten der Korpusse werden entfettet, geschliffen, grundiert und in dem von Ihnen gewählten Farbton und Glanzgrad neu gespritzt. Ersetzt wird nichts: Korpusse, Aufteilung und Türmodell bleiben genau so, wie sie sind, und das Innere der Schränke wird nur neu beschichtet, wenn eine Position oben das ausweist.",
    included: [
      "Farbton und Glanzgrad mit Ihnen abgestimmt, bevor etwas bestellt wird",
      "Küche abgeklebt und abgeschottet, damit Staub und Sprühnebel im Raum bleiben",
      "Türen, Schubkastenblenden und Beschläge abgenommen, beschriftet und wieder montiert",
      "Alle Flächen entfettet, geschliffen und für gute Haftung vorbereitet",
      "Grundierung, die Verfärbungen absperrt und dem Decklack Halt gibt",
      "Gespritzter Decklack auf beiden Seiten jeder Tür und Schubkastenblende",
      "Außenseiten der Korpusse passend beschichtet",
      "Beschläge montiert, Türen neu ausgerichtet und eine gemeinsame Begehung",
      "Grundierung: [wie viele Schichten, welche Grundierung Sie verwenden]",
      "Decklack: [wie viele Schichten, welches Produkt, ggf. Härter-Mischverhältnis]",
      "Garantie gegen Abblättern: [Ihre Dauer und was sie abdeckt]",
      "Übliche Zeit vor Ort: [wie viele Tage, vom Start bis zur Begehung]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    description: REFACE_DESCRIPTION,
    variantLabel: "das Türmaterial",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Türmodell, Farbton und Oberfläche vor der Bestellung mit Ihnen bestätigt",
      "Jede Öffnung vor Ort ausgemessen, damit die Türen für Ihre Küche gefertigt werden",
      "Neue Türen und Schubkastenblenden nach diesen Maßen gefertigt",
      "Außenseiten der Korpusse passend zu den neuen Fronten beschichtet",
      "Scharniere geliefert, montiert und so eingestellt, dass die Türen gerade sitzen",
      "Griffbohrungen an der von Ihnen gewählten Position",
      "Vorhandene Türen, Blenden und Beschläge abgenommen und abtransportiert",
      "Türen und Schubladen bei der Übergabe eingestellt, mit gemeinsamer Begehung",
      "Türkonstruktion und Oberfläche: [Ihr Lieferant und die von Ihnen vorgegebene Oberfläche]",
      "Garantie auf Türen und Oberfläche: [Ihre Dauer und was sie abdeckt]",
      "Übliche Zeit von Bestellung bis Montage: [Ihre Lieferzeit]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    description:
      "Wir überarbeiten die Treppe in ihrem Bestand. Wände, Geländerstäbe und der angrenzende Boden werden abgeklebt, die oben bepreisten Bauteile bis auf das rohe Holz abgeschliffen, Dellen und Fugen gespachtelt, Beize wird aufgetragen, wo ein Farbton gewählt wurde, und anschließend folgen Schutzschichten mit leichtem Zwischenschliff. Überarbeitet werden nur die oben aufgeführten Bauteile — Trittstufen, Setzstufen, Geländerstäbe, Pfosten, Handlauf und Podest sind eigene Positionen. Ein Bauteil zu ersetzen, statt es zu überarbeiten, ist eine gesonderte Leistung.",
    included: [
      "Angrenzende Wände, Geländerstäbe und Böden abgeklebt und geschützt",
      "Trittstufen und Bauteile für die Beschichtung abgeschliffen",
      "Fugen, Dellen und Unebenheiten gespachtelt",
      "Beize gleichmäßig auf alle vorbereiteten Flächen aufgetragen",
      "Schützende Deckschichten mit leichtem Zwischenschliff",
      "Hinweise zu Pflege und Trocknung bei der Übergabe",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    description:
      "Wir schleifen die vorhandenen Holzböden in den oben bepreisten Bereichen ab und versiegeln sie neu. Lose Dielen werden befestigt, dann wird der Boden mit immer feinerer Körnung geschliffen, um die alte Oberfläche abzutragen und die Fläche zu egalisieren, Löcher und Fugen werden gekittet, Beize wird aufgetragen, wo ein Farbton gewählt wurde, und es folgen Schutzschichten mit Zwischenschliff. Dielen, die über das hinaus beschädigt sind, was Schleifen beheben kann, sind ein Austausch und werden gesondert berechnet.",
    included: [
      "Möbel nach Bedarf verrückt und angrenzende Bereiche geschützt",
      "Lose Dielen befestigt und der Boden vor dem Schleifen geprüft",
      "Schliff in mehreren Körnungen, um die alte Oberfläche abzutragen und die Fläche zu egalisieren",
      "Nagellöcher und Fugen vor dem letzten Durchgang gekittet",
      "Beize gleichmäßig aufgetragen, wo ein Farbton gewählt wurde",
      "Schützende Deckschichten mit Zwischenschliff",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    description:
      "Wir nehmen vor Ort eine Schablone Ihrer Unterschränke ab, fertigen die Arbeitsplatte aus dem oben bepreisten Material nach diesen Maßen, bauen die vorhandene Platte aus und entsorgen sie und montieren, nivellieren und verbinden die neue. Gefertigt werden die oben aufgeführten Ausschnitte und das oben aufgeführte Kantenprofil — was nicht aufgeführt ist, wird nicht ausgeschnitten. Das Ab- und Wiederanschließen von Wasser, Strom und Gas ist eine gesonderte Leistung und steht oben nur, wenn Sie danach gefragt haben.",
    included: [
      "Material gemäß der oben festgelegten Spezifikation geliefert",
      "Schablone vor Ort, damit die Platte auf Ihre tatsächlichen Unterschränke passt",
      "Vorhandene Arbeitsplatte ausgebaut und entsorgt",
      "Fertigung einschließlich Kantenprofil und aller aufgeführten Ausschnitte",
      "Montage, Nivellierung und Verbindung der Stöße",
      "Fugen, Stöße und Randanschlüsse abgedichtet",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { steps: MEASURE_SUPPLY_INSTALL },
  drywall: { steps: SHELL_SEQUENCE },
  drywall_install: { steps: SHELL_SEQUENCE },

  // ── Haustechnik und Elektro ─────────────────────────────────────────────
  plumbing: { steps: ASSESS_REPAIR_TEST },
  electrical: { steps: ASSESS_REPAIR_TEST },
  hvac_install: { steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { steps: ASSESS_REPAIR_TEST },
  appliance_repair: { steps: ASSESS_REPAIR_TEST },
  garage_door: {
    description:
      "Wir liefern und montieren das oben bepreiste Tor bzw. die oben bepreisten Tore samt Laufschienen, Federn, Seilen und Beschlägen, und das Tor wird ausbalanciert und mehrfach mit Antrieb geöffnet und geschlossen, bevor wir gehen. Rahmenverkleidung und Blenden sind eigene Positionen und nur enthalten, wo Sie sie bepreist sehen. Elektroarbeiten, ein neuer Torantrieb und jede Änderung an Größe oder Rahmen der Toröffnung sind gesonderte Leistungen und nicht enthalten, sofern keine Position oben das ausweist.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { steps: ASSESS_REPAIR_TEST },
  well_water: { steps: ASSESS_REPAIR_TEST },
  elevator_services: { steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { steps: ASSESS_REPAIR_TEST },
  installation_services: { steps: MEASURE_SUPPLY_INSTALL },

  // ── Rohbau und Gebäudehülle ─────────────────────────────────────────────
  roofing_service: {
    description:
      "Wir entfernen die vorhandene Dacheindeckung bis auf die Schalung, prüfen die Bretter darunter und bauen darauf ein neues Dach auf: Unterdeckbahn, Verwahrungen an jeder Wand, am Schornstein, an Kehlen und Entlüftungen, die oben bepreiste Eindeckung sowie die First- und Traufbelüftung, die das Dach zum Abtrocknen braucht. Das abgetragene Material wird abtransportiert, und das Grundstück wird vor unserer Abfahrt nach Nägeln abgesucht. Bepreist ist hier die oben aufgeführte Dachfläche — Dachuntersicht, Stirnbretter, Dachrinnen, Dämmung und Reparaturen am Tragwerk sind gesonderte Leistungen und nur enthalten, wo Sie sie bepreist sehen.",
    included: [
      "Vorhandenes Material abgetragen und abtransportiert",
      "Schalung geprüft und beschädigte Abschnitte vor dem Austausch gemeldet",
      "Unterdeckbahn, Verwahrungen und Belüftung nach Bedarf",
      "Neue Eindeckung nach Herstellervorgaben verlegt",
      "Grundstück geräumt und nach Nägeln und Abfall abgesucht",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
    mayChange: [
      {
        title: "Mehr Lagen als erwartet",
        body: "Dieses Angebot ist auf die Lagen kalkuliert, die wir sehen oder durch Sondieren feststellen konnten. Eine zweite oder dritte Lage darunter bedeutet mehr Abbruchzeit und mehr Entsorgung, und wir sagen Ihnen Bescheid, bevor wir weitermachen.",
      },
      {
        title: "Der Zustand der Schalung",
        body: "Die Bretter unter dem alten Dach lassen sich erst prüfen, wenn es abgedeckt ist. Intakte Schalung wird wie angeboten überdeckt; morsche Abschnitte werden zum Plattenpreis dieses Angebots ersetzt, gezählt und Ihnen gezeigt.",
      },
      {
        title: "Wetter",
        body: "Ein offenes Dach bleibt nicht über Nacht offen. Eine verregnete Woche verschiebt den Fertigstellungstermin und sonst nichts — der Preis ändert sich nicht, weil es geregnet hat.",
      },
    ],
    glossary: [
      {
        term: "Square (Flächeneinheit)",
        body: "100 Quadratfuß (sq ft) Dachfläche. Die Einheit, in der die ganze Branche bestellt und kalkuliert — ein Dach mit 2.400 sq ft hat 24 Squares.",
      },
      {
        term: "Dachneigung",
        body: "Das Gefälle, angegeben als Steigung auf 12 Zoll waagerechte Länge. Ein Dach, das auf 12 Zoll um 6 Zoll ansteigt, ist „6/12“. Ein geneigtes Dach hat mehr Fläche als die Grundfläche, die es überdeckt, und auf einem steileren Dach geht die Arbeit langsamer voran.",
      },
      {
        term: "Dachschalung",
        body: "Die tragenden Platten auf den Sparren, an denen alles Weitere befestigt wird. Ihr Zustand lässt sich erst beurteilen, wenn die alte Eindeckung entfernt ist.",
      },
      {
        term: "Abdecken (Rückbau)",
        body: "Das Entfernen der vorhandenen Eindeckung. Die hier bepreisten Lagen stehen im Angebot; alles darüber hinaus ist zusätzliche Arbeitszeit und zusätzliche Entsorgung.",
      },
      {
        term: "Unterdeckbahn",
        body: "Die Bahn, die vor der Eindeckung auf die Schalung gelegt wird. Sie hält das Wasser ab, wenn der Wind es unter eine Schindel treibt.",
      },
    ],
  },
  gutter_services: {
    description: GUTTER_WORK_VARIANTS.cleaning,
    variantLabel: "die Art der Dachrinnenarbeit",
    variants: GUTTER_WORK_VARIANTS,
    included: [
      "Rinnen von Hand geräumt und der Schmutz abtransportiert, nicht aufs Grundstück geblasen",
      "Jedes Fallrohr durchgespült und auf Ablauf geprüft",
      "Rinnen, Rinnenhalter und Nähte im leeren Zustand geprüft",
      "Kleinere Abdichtungen, wo eine Naht oder ein Stoß sie braucht",
      "Alles, was mehr als eine Abdichtung braucht, wird mit Fotos gemeldet, bevor es ausgeführt wird",
    ],
    steps: [
      {
        title: "Rinnen räumen",
        body: "Jede Rinne wird von Hand von Laub, Granulat und angesammeltem Schmutz befreit, und der Schmutz wird abtransportiert, statt in die Fallrohre gespült oder auf dem Grundstück liegen gelassen zu werden.",
      },
      {
        title: "Fallrohre durchspülen",
        body: "Jedes Fallrohr wird durchgespült und beobachtet, damit feststeht, dass das Wasser aus der Rinne auch unten ankommt. Eine saubere Rinne über einem verstopften Fallrohr läuft trotzdem über.",
      },
      {
        title: "Prüfen und abdichten",
        body: "Bei leeren Rinnen prüfen wir Rinnenhalter, Nähte, Stöße und das Stirnbrett dahinter auf lockere Stellen, Schäden und Undichtigkeiten und dichten kleinere Mängel ab. Alles Größere wird gemeldet, bevor es ausgeführt wird, statt einfach auf der Rechnung zu landen.",
      },
      {
        title: "Laubschutz — optional",
        body: "Wo er in diesem Angebot steht, wird Smart Screen Aluminium-Laubschutz auf die geräumten Rinnen montiert. Erscheint oben nur, wenn er tatsächlich verkauft wurde; Laubschutz auf einer ungereinigten Rinne hält den Schmutz darunter fest.",
      },
      {
        title: "Übergabe",
        body: "Für die Montage des Laubschutzes gilt eine Garantie von [Garantiezeitraum] auf [was sie abdeckt]. Die Rinnen werden ablaufend übergeben und der Arbeitsbereich geräumt.",
      },
    ],
    mayChange: [
      {
        title: "Wie die Rinnen im leeren Zustand aussehen",
        body: "Ein lockerer Rinnenhalter, eine gerissene Naht oder ein morsches Stirnbrett hinter der Rinne ist durch eine volle Rinne nicht zu sehen. Kleinere Abdichtungen sind im obigen Preis enthalten; alles Bauliche wird mit Fotos gemeldet und gesondert bepreist, bevor etwas davon ausgeführt wird.",
      },
      {
        title: "Wie das Dach erreicht wird",
        body: "Eine Rinne, die ein Gerüst, einen Leiterabstandhalter über einem Wintergarten oder aus Sicherheitsgründen eine zweite Person braucht, dauert länger als eine, die von einer Leiter auf ebenem Boden erreichbar ist.",
      },
      {
        title: "Wie viele Fallrohre die Rinne tatsächlich braucht",
        body: "Die Fallrohre in diesem Angebot sind die, die das Haus jetzt hat. Eine Rinne, die bisher zu wenig Abläufe hatte, hat auch mit neuem Metall zu wenige; wo wir einen weiteren Ablauf für nötig halten, sagen wir das und bepreisen ihn gesondert, statt davon auszugehen, dass Sie ihn wollen.",
      },
    ],
    glossary: [
      {
        term: "Fallrohr",
        body: "Das senkrechte Rohr, das das Wasser von der Rinne zum Boden führt. Die Rinne zu reinigen, ohne zu prüfen, ob das Fallrohr abläuft, löst nur die Hälfte des Problems.",
      },
      {
        term: "Rinnenhalter",
        body: "Die Halterung, die die Rinne am Stirnbrett hält. Ein lockerer Halter lässt die Rinne durchhängen, und eine durchhängende Rinne hält Wasser, statt es abzuleiten.",
      },
      {
        term: "Stirnbrett",
        body: "Das Brett hinter der Rinne, in das die Rinnenhalter geschraubt werden. Rinnenarbeit endet dort, wo morsches Holz beginnt, denn in weichem Holz hält nichts — deshalb kann ein Austauschangebot den Zustand des Stirnbretts erst sicher beurteilen, wenn die alte Rinne ab ist.",
      },
      {
        term: "Nahtlose Dachrinne",
        body: "Eine Rinne, die vor Ort aus einem durchgehenden Blechband auf die genaue Länge Ihres Abschnitts gerollt wird, sodass es nur an Ecken und Abläufen Verbindungen gibt. Rinnen aus Teilstücken werden alle paar Fuß verbunden, und jede Verbindung ist eine Stelle, die irgendwann undicht werden kann.",
      },
      {
        term: "Fünf Zoll und sechs Zoll",
        body: "Die Breite der Rinne. Eine Sechs-Zoll-Rinne mit größerem Ablauf führt deutlich mehr Wasser ab als eine Fünf-Zoll-Rinne — genau das braucht ein großes Dach, ein steiles Dach oder eine Kehle, die sich in eine Ecke entleert.",
      },
      {
        term: "Feinmaschiger Laubschutz",
        body: "Ein feines Gitter, das neben Laub auch Schindelgranulat, Samen und Kiefernnadeln abhält. Ein einfaches Gitter hält Laub ab und lässt den feinen Schmutz durch — das ist der Unterschied, den die beiden Preise beschreiben.",
      },
      {
        term: "Laubschutz",
        body: "Ein Gitter über der Rinne, das Laub fernhält und Wasser durchlässt. Es verringert das Reinigen, ersetzt es aber nicht, und es gehört auf eine saubere Rinne.",
      },
      {
        term: "Mindestpauschale",
        body: "Eine kurze Rinne zu erreichen kostet fast so viel wie eine lange — derselbe Wagen, dieselben Leitern, dieselbe Anfahrt. Kleine Einsätze werden daher mit einem Mindestbetrag berechnet statt pro Fuß, und wo das zutrifft, zeigt das Angebot den Aufschlag als eigene Position, statt den Preis stillschweigend zu erhöhen.",
      },
    ],
  },
  siding: {
    description:
      "Wir entfernen die vorhandene Fassadenverkleidung an den oben bepreisten Wänden, prüfen die Beplankung dahinter und bessern die Abschnitte aus, die dieses Angebot vorsieht, bringen dann eine Wetterschutzbahn und die oben aufgeführte neue Verkleidung an, mit Anschlussprofilen an Ecken, Fenstern und Türen. Neu verkleidet werden nur die oben bepreisten Wände. Dachuntersicht, Stirnbretter, Dachrinnen, Fenster und Dämmung sind eigene Positionen und nur enthalten, wo Sie sie bepreist sehen.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  insulation: {
    description:
      "Wir dämmen die oben bepreisten Bereiche auf den in diesem Angebot genannten R-Wert. Zuerst werden die Luftlecks geschlossen — an Kopfschwellen, Durchdringungen und der Bodenluke —, denn Dämmung bremst Wärme, hält aber keinen Luftzug auf; dann wird das Material in der Stärke eingebracht, die dieser R-Wert erfordert, und der Lüftungsweg bleibt offen, wo der Aufbau einen hat. Vorhandenes Material bleibt liegen, sofern eine Position oben nicht dessen Entfernung ausweist, und die tatsächlich eingebrachte Stärke wird festgehalten und markiert, damit sie später überprüft werden kann.",
    included: [
      "Bestehender Zustand und Stärke festgehalten, bevor etwas abgedeckt wird",
      "Luftlecks an Kopfschwellen, Durchdringungen und der Bodenluke abgedichtet",
      "Lüftungsweg offen gehalten, wo der Aufbau einen braucht",
      "Material in der Stärke eingebracht, die der angegebene R-Wert erfordert",
      "Stärkemarkierungen belassen und der Arbeitsbereich geräumt",
    ],
    steps: [
      {
        title: "Projektbesprechung",
        body: "Wir gehen die Pläne durch oder begehen die Räume und legen genau fest, welche Bereiche gedämmt werden — Keller, Randbalken, Garagendecke, Dachboden.",
        timeline: "1–2 Tage",
      },
      {
        title: "Angebot",
        body: "Kalkuliert nach den zu dämmenden Flächen, dem Material und der Stärke, die jeder Aufbau für seinen R-Wert braucht.",
        timeline: "2–4 Tage",
      },
      {
        title: "Terminplanung",
        body: "So getaktet, dass wir erst nach Fertigstellung und Abnahme des Rahmenbaus und der Rohinstallation von Haustechnik und Elektro beginnen. Wer vor dieser Abnahme dämmt, muss alles wieder öffnen.",
        timeline: "Nach Bedarf",
      },
      {
        title: "Vorbereitung vor Ort",
        body: "Bereiche geräumt, Fenster, Einbauten und fertige Oberflächen abgeklebt und geschützt.",
        timeline: "1–2 Stunden",
      },
      {
        title: "Einbringen",
        body: "Material in der vorgegebenen Stärke eingebracht, bei größerer Dicke in mehreren Durchgängen.",
        timeline: "1–3 Tage",
      },
      {
        title: "Beschneiden und Aufräumen",
        body: "Überstand bündig mit dem Rahmenwerk abgeschnitten, Sprühnebel entfernt, Stärke festgehalten und der Bereich bereit für das nächste Gewerk übergeben.",
        timeline: "Am selben Tag",
      },
    ],
    mayChange: [
      {
        title: "Was sich zeigt, sobald der Bereich geöffnet ist",
        body: "Nasses, verdichtetes oder verunreinigtes Material muss heraus, bevor etwas Neues hineinkommt, und alte Porzellanisolator-Verkabelung oder ein Badlüfter, der in den Dachboden entlüftet, müssen zuerst behoben werden. Nichts davon ist von der Luke aus zu sehen.",
      },
      {
        title: "Die Stärke, die der Hohlraum tatsächlich aufnehmen kann",
        body: "Ein geschlossener Hohlraum fasst, was er fasst. Wo der Raum mit dem angebotenen Material den Ziel-R-Wert nicht erreichen kann, sagen wir Ihnen das und nennen Ihnen die Möglichkeiten, statt stillschweigend weniger einzubauen.",
      },
    ],
    glossary: [
      {
        term: "R-Wert",
        body: "Wie gut der Aufbau dem Wärmestrom widersteht — je höher, desto besser. Danach fragen sowohl Förderprogramme als auch die Bauaufsicht, und deshalb ist die Stärke in diesem Angebot so, wie sie ist.",
      },
      {
        term: "R-Wert pro Zoll",
        body: "Wie viel R-Wert jeder Zoll eines Materials liefert. Deshalb sind zwei Materialien mit demselben R-Wert unterschiedlich dick, und deshalb passt eines davon vielleicht nicht hinein.",
      },
      {
        term: "Luftdichtung",
        body: "Die Spalten schließen, durch die tatsächlich Luft zieht, bevor sie abgedeckt werden. Dämmung bremst Wärme; sie hält keinen Luftzug auf, und Einblasdämmung über einem nicht abgedichteten Dachboden ist der häufigste Grund, warum eine Maßnahme hinter den Erwartungen bleibt.",
      },
      {
        term: "Lüftungskeil",
        body: "Ein Kanal, der den Weg von der Traufbelüftung zum Dachboden offen hält, sobald die Dämmung drin ist. Ohne ihn verstopfen die Lüftungsöffnungen, und die Dachschalung trocknet nicht mehr ab.",
      },
    ],
  },
  masonry: { steps: MEASURE_SUPPLY_INSTALL },
  concrete: { steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    description:
      "Wir heben den oben bepreisten Bereich aus, legen ein Trennvlies aus und bauen eine Tragschicht aus Schotter auf, die lagenweise verdichtet wird; dann verlegen wir die oben aufgeführten Steine im vereinbarten Verlegemuster, rechtwinklig zum Haus ausgerichtet und mit einer Randzeile abgeschlossen. Die Ränder werden eingefasst, die Fugen verfüllt und abgerüttelt, und die Fläche erhält ein Gefälle vom Gebäude weg. Das rund um die Arbeiten aufgewühlte Erdreich wird planiert und wiederhergestellt. Das Verlegen von Versorgungsleitungen, Entwässerung außerhalb des Arbeitsbereichs und Genehmigungen sind gesondert.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    description:
      "Wir kehren und blasen die Fläche sauber, behandeln Öl- und Fettflecken, damit die Versiegelung haftet, kleben die Ränder ab und tragen die Versiegelung auf der oben bepreisten Einfahrtsfläche in der in diesem Angebot genannten Anzahl von Schichten auf. Versiegeln ist Pflege einer intakten Fläche: Es bremst Schäden durch Wasser und Sonne. Es repariert keinen Asphalt, der bereits aufgebrochen ist, und es verdeckt keine vorhandenen Risse oder Flickstellen — das Verfüllen von Rissen ist eine eigene Position und nur enthalten, wo Sie sie bepreist sehen.",
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
      "Wir inspizieren die frei zugänglichen Bereiche und Anlagen des Objekts und übergeben Ihnen einen schriftlichen Bericht mit Fotos darüber, was wir festgestellt haben und was es bedeutet. Die Inspektion ist eine zerstörungsfreie Sichtprüfung: Nichts wird zerlegt, keine fertige Oberfläche geöffnet, und eingelagerte Gegenstände werden nicht bewegt — ein Mangel, der dahinter verborgen ist, ist also einer, den wir nicht melden können. Prüfungen auf Radon, Raumluftqualität, Feuerstätten, Brunnen und Kleinkläranlagen sind gesonderte Leistungen und werden nur durchgeführt, wo Sie sie oben bepreist sehen.",
    included: [
      "Eine Sichtprüfung der frei zugänglichen Bereiche des Objekts",
      "Dach, Fassadenverkleidung, Geländeneigung und Entwässerung, soweit sicher erreichbar",
      "Tragwerk, Fundament sowie Keller oder Kriechkeller, wo begehbar",
      "Heizung, Kühlung, Sanitär und Elektrik, bedient über ihre normalen Regler",
      "Innenausbau, Fenster, Türen, Dämmung und Belüftung des Dachbodens",
      "Ein schriftlicher Bericht mit Fotos der wesentlichen Befunde",
      "Zeit am Ende des Termins, um Ihnen die Befunde zu erläutern",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Gesamtprojekte ──────────────────────────────────────────────────────
  general_contracting: { steps: SHELL_SEQUENCE },
  general_contracting_reno: { steps: PLAN_BUILD_HANDOVER },
  construction: { steps: SHELL_SEQUENCE },
  remodeling: { steps: PLAN_BUILD_HANDOVER },
  carpentry: { steps: MEASURE_SUPPLY_INSTALL },
  handyman: { steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { steps: VISIT_SERVICE_VERIFY },

  // ── Reinigung ───────────────────────────────────────────────────────────
  residential_cleaning: {
    included: [
      "Alle Reinigungsmittel und Geräte werden von uns gestellt",
      "Jeder oben aufgeführte Raum und jede oben aufgeführte Fläche",
      "Armaturen, Einbauten und Kontaktflächen abgewischt",
      "Abfall entsorgt und Mülleimer mit neuen Beuteln versehen",
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

  // ── Außenanlagen ────────────────────────────────────────────────────────
  landscaping_design: { steps: PLAN_BUILD_HANDOVER },
  lawn_care: { steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { steps: VISIT_SERVICE_VERIFY },
  irrigation: { steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    description:
      "Wir räumen die oben bepreisten Flächen nach dem in diesem Angebot genannten Plan für die darin abgedeckte Saison. Vor dem ersten Schnee werden Markierungsstäbe gesetzt, damit Rasenkanten und Beete sichtbar bleiben und ausgespart werden können. Gehwege, Stufen und Streuen sind eigene Positionen und werden nur geräumt oder gestreut, wo Sie sie bepreist sehen. Dächer, Balkone und alles, was im Räumbereich liegen gelassen wurde und unter dem Schnee verborgen ist, sind nicht enthalten.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { steps: VISIT_SERVICE_VERIFY },
  pool_spa: { steps: VISIT_SERVICE_VERIFY },
  dog_walking: { steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { steps: VISIT_SERVICE_VERIFY },
};
