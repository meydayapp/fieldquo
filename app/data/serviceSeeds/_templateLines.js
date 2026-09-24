// app/data/serviceSeeds/_templateLines.js
//
// The estimate-template vocabulary every trade seed shares, and the builder
// that attaches a template to a seeded service.
//
// ── Why one shared file ────────────────────────────────────────────────────
//
// Nineteen trades, seven languages. "Diagnostic visit", "Removal and disposal
// of the old unit", "Debris haul-away and cleanup" and "New customer discount"
// appear in most of them, and a plumber's French for a service call must be
// the same words as an electrician's — a contractor who runs both trades sees
// both lists on one screen. Copying the seven-language text into each file is
// the copy that rots (AGENTS.md, failure class 4), so the common lines live
// here once and a trade file only writes the lines that are its own.
//
// The leading underscore keeps this file OUT of the per-trade seed set:
// scripts/check-service-seeds.mjs skips `_*.js` when it walks the folder and
// index.js does not register it. It is imported by a relative path, never
// through the alias, so a bare `node` can still load every seed file.
//
// ── What a template is ─────────────────────────────────────────────────────
//
// A seeded service MAY carry an estimate template — the lines a new quote for
// that service opens with, each with a unit PRICE (what the client pays) and
// a unit COST (what it costs the company), so the job-costing panel has a
// margin from the first minute. A service without one is still a service; the
// template is a starting point the estimator edits, never a rate card.
//
// `withTemplates(seed, templates)` adds these keys to each matching row and
// touches nothing else on it:
//
//   templateKind    "installation" | "repair" | "inspection" | "maintenance" —
//                   the four headings the template gallery groups by
//   templateLines   [{ kind: "labour"|"material"|"other", name, description,
//                      qty, unit, unitPrice, unitCost, taxable,
//                      measurementKey? }]  — English text; the other six
//                   languages are under `translations`
//   defaultDiscount { name, kind: "fixed"|"percent", amount } | null
//   imageUrl        null — a company adds its own photo; nothing is shipped
//   range           { min, median, max } in USD — the preset price and its
//                   guideline (see rangeFor for where the numbers come from);
//                   null only when rangeBasis is "measured"
//   rangeBasis      "benchmark" | "lines" | "measured" — where the range came
//                   from; "measured" = a flat row with no benchmark whose
//                   lines are all per-measurement, so there is no flat preset
//   translations    { fr, es, it, de, uk, tl } → { name, description,
//                   templateLines: [{ name, description }] in the same order
//                   as `templateLines`, defaultDiscount: { name } | null }
//
// ── Measurement-driven lines ───────────────────────────────────────────────
//
// The owner (2026-09-24): "it's not just the pricing but also taking
// measurements like the room for an interior painter to determine sq ft".
// So every line sold per unit of a measurement — per sq ft, per linear ft,
// per door, per riser, per square — carries a `measurementKey`, and the app
// fills its qty from the takeoff or the satellite report. In the seed such a
// line keeps `qty: 1` as the fallback (enforced below); a genuinely flat line
// (a design fee, a diagnostic visit, project management) carries no key.
//
// The keys are the field names the measuring modules actually produce — read
// from the source, not from a wish list — grouped in MEASUREMENT_KEYS:
//
//   painting   lib/pricing/paintTakeoff.js     wallSqft, ceilingSqft,
//              floorSqft, linearFt (the room perimeter — baseboard and trim
//              run on it); doorCount, windowCount for the per-side and
//              per-window picks
//   stairs     lib/estimate/stairsFromSteps.js treads, risers, balusters,
//              handrailFt, newels
//   cabinets   lib/pricing/cabinetLabour.js    doorCount, drawerCount
//   roofing    lib/measure/roofMeasurement.js → roofGeometry.js
//              squares, ridgeFt, hipFt, valleyFt, eaveFt, rakeFt, plus
//              stepFlashingFt from the roofing takeoff config and wastePct:
//              that line's qty is squares × the company's rate-card waste
//              factor (tradePriceBooks roofing_service.wastePct, 10% by
//              default), priced per square like the shingle line above it
//   generic    areaSqFt, linearFt, each — floor area, a run of edge, a count,
//              for construction, flooring, drywall, tile, fencing, concrete
//              and cleaning, where the takeoff is a room or a lot measure
//
// ── Prices ─────────────────────────────────────────────────────────────────
//
// Every unit price is a realistic 2026 North-American figure in USD. Unit
// costs are labour ≈ 50% of price and material ≈ 75% of price unless the
// trade file says it has better evidence — the two ratios match the captured
// competitor templates the electrical file reproduces, and each trade file's
// header names its own evidence.

export const TEMPLATE_LANGUAGES = ["fr", "es", "it", "de", "uk", "tl"];
const ALL_LANGUAGES = ["en", ...TEMPLATE_LANGUAGES];
export const TEMPLATE_KINDS = ["installation", "repair", "inspection", "maintenance"];
export const LINE_KINDS = ["labour", "material", "other"];
export const LINE_UNITS = ["flat", "each", "hour", "sqft", "linear_ft", "square"];
export const MEASUREMENT_KEYS = [
  // painting (lib/pricing/paintTakeoff.js)
  "wallSqft", "ceilingSqft", "floorSqft", "doorCount", "windowCount",
  // stairs (lib/estimate/stairsFromSteps.js)
  "treads", "risers", "balusters", "handrailFt", "newels",
  // cabinets (lib/pricing/cabinetLabour.js) — doorCount is shared with painting
  "drawerCount",
  // roofing (lib/measure/roofGeometry.js + the roofing takeoff config)
  "squares", "ridgeFt", "hipFt", "valleyFt", "eaveFt", "rakeFt", "stepFlashingFt", "wastePct",
  // generic
  "areaSqFt", "linearFt", "each",
];
/** Line units that are a measurement — such a line must carry a key. */
export const MEASURED_UNITS = ["sqft", "linear_ft", "square"];
export const DISCOUNT_KINDS = ["fixed", "percent"];

const fail = (msg) => {
  throw new Error(`serviceSeeds template: ${msg}`);
};

/** `text` is { en: [name, description], fr: [...], … } — all seven, checked. */
function checkText(text, where) {
  if (!text || typeof text !== "object") fail(`${where}: text is not an object`);
  for (const lang of ALL_LANGUAGES) {
    const t = text[lang];
    if (!Array.isArray(t) || t.length !== 2) fail(`${where}: ${lang} must be [name, description]`);
    if (typeof t[0] !== "string" || !t[0].trim()) fail(`${where}: ${lang} name is empty`);
    if (typeof t[1] !== "string") fail(`${where}: ${lang} description must be a string`);
  }
  return text;
}

const money = (n, where) => {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) fail(`${where}: ${n} is not a non-negative number`);
  return Math.round(n * 100) / 100;
};

/**
 * One template line. `text` holds all seven languages; the builder splits it
 * into the English row and the six translations.
 */
export function line(kind, qty, unit, unitPrice, unitCost, text, extra = {}) {
  const where = `line "${text?.en?.[0] || "?"}"`;
  if (!LINE_KINDS.includes(kind)) fail(`${where}: kind ${kind}`);
  if (!LINE_UNITS.includes(unit)) fail(`${where}: unit ${unit}`);
  const price = money(unitPrice, where + " price");
  const cost = money(unitCost, where + " cost");
  if (cost > price) fail(`${where}: cost ${cost} above price ${price}`);
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) fail(`${where}: qty ${qty}`);
  if (extra.measurementKey !== undefined && !MEASUREMENT_KEYS.includes(extra.measurementKey)) fail(`${where}: measurementKey ${extra.measurementKey}`);
  if (MEASURED_UNITS.includes(unit) && !extra.measurementKey) fail(`${where}: a per-${unit} line needs a measurementKey`);
  if (extra.measurementKey && qty !== 1) fail(`${where}: a measured line keeps qty 1 as the fallback, got ${qty}`);
  return {
    kind,
    qty,
    unit,
    unitPrice: price,
    unitCost: cost,
    taxable: extra.taxable === undefined ? true : Boolean(extra.taxable),
    measurementKey: extra.measurementKey,
    text: checkText(text, where),
  };
}

/** The default cost ratios — labour half, material three quarters. */
export const half = (price) => Math.round(price * 50) / 100;
export const threeQuarters = (price) => Math.round(price * 75) / 100;

export const L = {
  /** labour(qty, unit, price, text, { cost, taxable }) — cost defaults to 50%. */
  labour: (qty, unit, price, text, extra = {}) => line("labour", qty, unit, price, extra.cost ?? half(price), text, extra),
  /** material(qty, unit, price, text, { cost, taxable, measurementKey }) — cost defaults to 75%. */
  material: (qty, unit, price, text, extra = {}) => line("material", qty, unit, price, extra.cost ?? threeQuarters(price), text, extra),
  /** other(qty, unit, price, text, { cost }) — fees passed through at cost unless said otherwise. */
  other: (qty, unit, price, text, extra = {}) => line("other", qty, unit, price, extra.cost ?? price, text, extra),
};

// ── The shared lines ───────────────────────────────────────────────────────
//
// Each is a function of the price (and optional cost) so a trade sets its
// own number; the seven-language text is the part that is shared. The French
// is Quebec trade French, the Spanish is what a US or Latin-American crew
// says, the Tagalog is the Taglish a Filipino crew actually uses on site —
// "labor", "permit", "walkthrough" stay English there because that is the
// word on the job.

const TXT = {
  serviceCall: {
    en: ["Service call and travel", "Technician dispatched to the property; covers travel and the first look at the problem."],
    fr: ["Frais de déplacement", "Technicien dépêché sur place; couvre le déplacement et le premier examen du problème."],
    es: ["Visita de servicio y traslado", "Técnico enviado al domicilio; cubre el traslado y la primera revisión del problema."],
    it: ["Uscita e trasferta", "Tecnico inviato sul posto; copre il viaggio e la prima verifica del problema."],
    de: ["Anfahrt und Serviceeinsatz", "Techniker vor Ort; deckt die Anfahrt und die erste Sichtung des Problems ab."],
    uk: ["Виклик майстра та виїзд", "Виїзд техніка на об'єкт; включає дорогу та первинний огляд проблеми."],
    tl: ["Service call at biyahe", "Pagpapadala ng technician sa bahay; kasama ang biyahe at unang tingin sa problema."],
  },
  diagnostic: {
    en: ["Diagnostic visit", "A technician comes to the home, finds the cause of the problem and explains the fix before any repair."],
    fr: ["Visite de diagnostic", "Un technicien se rend sur place, trouve la cause du problème et explique la réparation avant d'intervenir."],
    es: ["Visita de diagnóstico", "Un técnico acude al domicilio, encuentra la causa del problema y explica la reparación antes de hacerla."],
    it: ["Visita diagnostica", "Un tecnico viene a casa, individua la causa del problema e spiega l'intervento prima di eseguirlo."],
    de: ["Diagnosebesuch", "Ein Techniker kommt ins Haus, findet die Ursache und erklärt die Reparatur, bevor sie ausgeführt wird."],
    uk: ["Діагностичний візит", "Технік приїжджає додому, знаходить причину проблеми та пояснює ремонт до його початку."],
    tl: ["Diagnostic visit", "Pupunta ang technician sa bahay, hahanapin ang sanhi ng problema at ipapaliwanag ang ayos bago gawin."],
  },
  removeOld: {
    en: ["Removal and disposal of the old unit", "The existing unit disconnected, removed and hauled away for disposal."],
    fr: ["Dépose et mise au rebut de l'ancien appareil", "Appareil existant débranché, retiré et évacué pour disposition."],
    es: ["Retiro y desecho del equipo viejo", "Equipo existente desconectado, retirado y llevado a desechar."],
    it: ["Smontaggio e smaltimento del vecchio apparecchio", "Apparecchio esistente scollegato, rimosso e portato allo smaltimento."],
    de: ["Ausbau und Entsorgung des Altgeräts", "Bestehendes Gerät abgeklemmt, ausgebaut und zur Entsorgung abtransportiert."],
    uk: ["Демонтаж та утилізація старого обладнання", "Наявне обладнання від'єднано, демонтовано та вивезено на утилізацію."],
    tl: ["Pagtanggal at pagtapon ng lumang unit", "Tinanggal at hinakot ang lumang unit para itapon."],
  },
  haulAway: {
    en: ["Debris haul-away and cleanup", "The work area cleaned and every scrap of debris removed from the property."],
    fr: ["Nettoyage et évacuation des débris", "Aire de travail nettoyée et tous les débris évacués de la propriété."],
    es: ["Retiro de escombros y limpieza", "Área de trabajo limpia y todos los escombros retirados de la propiedad."],
    it: ["Rimozione detriti e pulizia", "Area di lavoro pulita e tutti i detriti portati via dalla proprietà."],
    de: ["Schuttabfuhr und Reinigung", "Arbeitsbereich gereinigt und sämtlicher Schutt vom Grundstück entfernt."],
    uk: ["Вивезення сміття та прибирання", "Робоча зона прибрана, усе сміття вивезено з ділянки."],
    tl: ["Paghakot ng debris at paglilinis", "Nilinis ang pinagtrabahuan at hinakot lahat ng debris mula sa property."],
  },
  techHour: {
    en: ["Technician labour", "Skilled labour billed by the hour, one technician."],
    fr: ["Main-d'œuvre — technicien", "Main-d'œuvre qualifiée facturée à l'heure, un technicien."],
    es: ["Mano de obra — técnico", "Mano de obra calificada cobrada por hora, un técnico."],
    it: ["Manodopera — tecnico", "Manodopera qualificata fatturata a ore, un tecnico."],
    de: ["Arbeitszeit — Techniker", "Fachkraft, abgerechnet nach Stunden, ein Techniker."],
    uk: ["Робота техніка", "Кваліфікована праця з погодинною оплатою, один технік."],
    tl: ["Labor — technician", "Skilled labor na sinisingil kada oras, isang technician."],
  },
  helperHour: {
    en: ["Helper labour", "Second person on the crew, billed by the hour."],
    fr: ["Main-d'œuvre — aide", "Deuxième personne de l'équipe, facturée à l'heure."],
    es: ["Mano de obra — ayudante", "Segunda persona de la cuadrilla, cobrada por hora."],
    it: ["Manodopera — aiutante", "Seconda persona della squadra, fatturata a ore."],
    de: ["Arbeitszeit — Helfer", "Zweite Person im Team, abgerechnet nach Stunden."],
    uk: ["Робота помічника", "Друга людина в бригаді, погодинна оплата."],
    tl: ["Labor — helper", "Pangalawang tao sa crew, sinisingil kada oras."],
  },
  permit: {
    en: ["Permit and inspection coordination", "The permit pulled and the municipal inspection booked on the client's behalf."],
    fr: ["Permis et coordination de l'inspection", "Permis obtenu et inspection municipale planifiée au nom du client."],
    es: ["Permiso y coordinación de la inspección", "Permiso tramitado e inspección municipal agendada a nombre del cliente."],
    it: ["Permesso e coordinamento del collaudo", "Permesso richiesto e collaudo comunale prenotato per conto del cliente."],
    de: ["Genehmigung und Abnahmekoordination", "Genehmigung eingeholt und die behördliche Abnahme im Namen des Kunden terminiert."],
    uk: ["Дозвіл та узгодження перевірки", "Отримання дозволу та запис на муніципальну перевірку від імені клієнта."],
    tl: ["Permit at pag-schedule ng inspeksyon", "Kinuha ang permit at in-schedule ang inspeksyon ng munisipyo para sa kliyente."],
  },
  protect: {
    en: ["Site protection and setup", "Floors, furniture and fixtures covered before work starts."],
    fr: ["Protection des lieux et préparation", "Planchers, meubles et accessoires recouverts avant le début des travaux."],
    es: ["Protección del área y preparación", "Pisos, muebles y accesorios cubiertos antes de empezar el trabajo."],
    it: ["Protezione dei locali e preparazione", "Pavimenti, mobili e arredi coperti prima dell'inizio dei lavori."],
    de: ["Abdecken und Einrichten der Baustelle", "Böden, Möbel und Einrichtung vor Arbeitsbeginn abgedeckt."],
    uk: ["Захист приміщення та підготовка", "Підлога, меблі та обладнання накриті перед початком робіт."],
    tl: ["Proteksyon at paghahanda ng lugar", "Tinakpan ang sahig, muwebles at fixtures bago magsimula ang trabaho."],
  },
  report: {
    en: ["Written report with photos", "Findings documented with photos and a prioritised list of recommendations."],
    fr: ["Rapport écrit avec photos", "Constats documentés avec photos et liste de recommandations par priorité."],
    es: ["Informe escrito con fotos", "Hallazgos documentados con fotos y una lista de recomendaciones por prioridad."],
    it: ["Relazione scritta con foto", "Rilievi documentati con foto e un elenco di raccomandazioni in ordine di priorità."],
    de: ["Schriftlicher Bericht mit Fotos", "Befunde mit Fotos dokumentiert und eine nach Dringlichkeit geordnete Empfehlungsliste."],
    uk: ["Письмовий звіт із фото", "Результати задокументовано з фото та переліком рекомендацій за пріоритетом."],
    tl: ["Nakasulat na report na may litrato", "Naka-dokumento ang nakita, may litrato at listahan ng rekomendasyon ayon sa priyoridad."],
  },
  walkthrough: {
    en: ["Final walkthrough", "The finished work reviewed with the client before the crew leaves."],
    fr: ["Visite finale avec le client", "Travaux terminés passés en revue avec le client avant le départ de l'équipe."],
    es: ["Recorrido final", "Trabajo terminado revisado con el cliente antes de que se retire la cuadrilla."],
    it: ["Sopralluogo finale", "Lavoro finito esaminato con il cliente prima che la squadra vada via."],
    de: ["Abschlussbegehung", "Die fertige Arbeit mit dem Kunden durchgesehen, bevor das Team abrückt."],
    uk: ["Фінальний огляд із клієнтом", "Виконану роботу переглянуто з клієнтом до від'їзду бригади."],
    tl: ["Final walkthrough", "Sinuri kasama ang kliyente ang natapos na trabaho bago umalis ang crew."],
  },
  testing: {
    en: ["Testing and commissioning", "The installed equipment run, tested and set up, and the client shown how it works."],
    fr: ["Essais et mise en service", "Équipement installé démarré, testé et réglé, puis fonctionnement expliqué au client."],
    es: ["Pruebas y puesta en marcha", "Equipo instalado encendido, probado y ajustado, y el cliente instruido en su uso."],
    it: ["Prove e messa in servizio", "Impianto installato avviato, collaudato e regolato; il cliente istruito sull'uso."],
    de: ["Prüfung und Inbetriebnahme", "Die Anlage in Betrieb genommen, geprüft und eingestellt; der Kunde eingewiesen."],
    uk: ["Випробування та введення в експлуатацію", "Встановлене обладнання запущено, перевірено й налаштовано; клієнту показано, як користуватися."],
    tl: ["Testing at pag-commission", "Pinaandar, sinubukan at in-set up ang bagong kagamitan, at tinuruan ang kliyente."],
  },
  consumables: {
    en: ["Fasteners, sealant and consumables", "Screws, anchors, sealant, tape and the small parts a job uses up."],
    fr: ["Fixations, scellant et consommables", "Vis, ancrages, scellant, ruban et les petites pièces qu'un chantier consomme."],
    es: ["Tornillería, sellador y consumibles", "Tornillos, anclajes, sellador, cinta y las piezas menores que consume el trabajo."],
    it: ["Viti, sigillante e materiale di consumo", "Viti, tasselli, sigillante, nastro e la minuteria che un lavoro consuma."],
    de: ["Befestigungsmaterial, Dichtstoff und Verbrauchsmaterial", "Schrauben, Dübel, Dichtstoff, Klebeband und die Kleinteile, die ein Auftrag verbraucht."],
    uk: ["Кріплення, герметик і витратні матеріали", "Шурупи, анкери, герметик, стрічка та дрібні деталі, які витрачаються на роботі."],
    tl: ["Turnilyo, sealant at consumables", "Turnilyo, anchor, sealant, tape at maliliit na parte na nauubos sa trabaho."],
  },
  disposalFee: {
    en: ["Disposal fee", "Tipping fee at the transfer station, passed through at cost."],
    fr: ["Frais de disposition", "Frais d'enfouissement au centre de transfert, refacturés au coût."],
    es: ["Cargo por desecho", "Tarifa del centro de transferencia, cobrada al costo."],
    it: ["Costo di smaltimento", "Tariffa della discarica, addebitata al costo."],
    de: ["Entsorgungsgebühr", "Gebühr der Umladestation, zum Selbstkostenpreis weitergegeben."],
    uk: ["Плата за утилізацію", "Плата за приймання відходів на станції, за собівартістю."],
    tl: ["Bayad sa pagtapon", "Bayad sa transfer station, ipinapasa sa kliyente sa cost."],
  },
  binRental: {
    en: ["Bin rental", "A roll-off bin delivered for the job and picked up when it is done."],
    fr: ["Location de conteneur", "Conteneur livré pour les travaux et repris à la fin."],
    es: ["Renta de contenedor", "Contenedor entregado para la obra y retirado al terminar."],
    it: ["Noleggio cassone", "Cassone consegnato per il lavoro e ritirato a fine lavori."],
    de: ["Containermiete", "Container für die Baustelle geliefert und nach Abschluss abgeholt."],
    uk: ["Оренда контейнера", "Контейнер доставлено на час робіт і забрано після завершення."],
    tl: ["Renta ng bin", "Roll-off bin na dinala para sa trabaho at kinuha pagkatapos."],
  },
  materialsAllowance: {
    en: ["Materials allowance", "An allowance for materials, reconciled on the invoice against the receipts."],
    fr: ["Allocation pour matériaux", "Allocation pour les matériaux, ajustée sur la facture selon les reçus."],
    es: ["Provisión para materiales", "Provisión para materiales, ajustada en la factura según los recibos."],
    it: ["Stanziamento per materiali", "Importo previsto per i materiali, conguagliato in fattura sugli scontrini."],
    de: ["Materialpauschale", "Pauschale für Material, auf der Rechnung anhand der Belege abgerechnet."],
    uk: ["Резерв на матеріали", "Сума на матеріали, яка уточнюється в рахунку за чеками."],
    tl: ["Allowance para sa materyales", "Allowance para sa materyales, ia-adjust sa invoice base sa resibo."],
  },
};

export const SHARED = {
  serviceCall: (price = 89, extra) => L.labour(1, "flat", price, TXT.serviceCall, extra),
  diagnostic: (price = 95, extra) => L.labour(1, "flat", price, TXT.diagnostic, extra),
  removeOld: (price, extra) => L.labour(1, "flat", price, TXT.removeOld, extra),
  haulAway: (price, extra) => L.labour(1, "flat", price, TXT.haulAway, extra),
  techHour: (qty, price, extra) => L.labour(qty, "hour", price, TXT.techHour, extra),
  helperHour: (qty, price, extra) => L.labour(qty, "hour", price, TXT.helperHour, extra),
  permit: (price, extra) => L.labour(1, "flat", price, TXT.permit, extra),
  protect: (price, extra) => L.labour(1, "flat", price, TXT.protect, extra),
  report: (price, extra) => L.labour(1, "flat", price, TXT.report, extra),
  walkthrough: (price, extra) => L.labour(1, "flat", price, TXT.walkthrough, extra),
  testing: (price, extra) => L.labour(1, "flat", price, TXT.testing, extra),
  consumables: (price, extra) => L.material(1, "flat", price, TXT.consumables, extra),
  disposalFee: (price, extra) => L.other(1, "flat", price, TXT.disposalFee, extra),
  binRental: (price, extra) => L.other(1, "flat", price, TXT.binRental, extra),
  materialsAllowance: (price, extra) => L.material(1, "flat", price, TXT.materialsAllowance, extra),
};

// ── Discounts ──────────────────────────────────────────────────────────────

const DISCOUNT_NAMES = {
  newCustomer: { en: "New customer discount", fr: "Rabais nouveau client", es: "Descuento cliente nuevo", it: "Sconto nuovo cliente", de: "Neukundenrabatt", uk: "Знижка для нового клієнта", tl: "Discount para sa bagong kliyente" },
  regular: { en: "Regular customer discount", fr: "Rabais client fidèle", es: "Descuento cliente frecuente", it: "Sconto cliente abituale", de: "Stammkundenrabatt", uk: "Знижка для постійного клієнта", tl: "Discount para sa suki" },
  seasonal: { en: "Seasonal discount", fr: "Rabais saisonnier", es: "Descuento de temporada", it: "Sconto stagionale", de: "Saisonrabatt", uk: "Сезонна знижка", tl: "Seasonal discount" },
  bundle: { en: "Bundle discount", fr: "Rabais de regroupement", es: "Descuento por paquete", it: "Sconto pacchetto", de: "Paketrabatt", uk: "Знижка за пакет послуг", tl: "Bundle discount" },
  senior: { en: "Senior discount", fr: "Rabais aînés", es: "Descuento para adultos mayores", it: "Sconto over 65", de: "Seniorenrabatt", uk: "Знижка для пенсіонерів", tl: "Senior discount" },
};

function discount(key, kind, amount) {
  if (!DISCOUNT_KINDS.includes(kind)) fail(`discount ${key}: kind ${kind}`);
  const n = money(amount, `discount ${key}`);
  if (kind === "percent" && n > 100) fail(`discount ${key}: ${n}% is not a percentage`);
  return { key, kind, amount: n };
}
export const D = {
  newCustomer: (kind, amount) => discount("newCustomer", kind, amount),
  regular: (kind, amount) => discount("regular", kind, amount),
  seasonal: (kind, amount) => discount("seasonal", kind, amount),
  bundle: (kind, amount) => discount("bundle", kind, amount),
  senior: (kind, amount) => discount("senior", kind, amount),
};

// ── The template and the range ─────────────────────────────────────────────

/**
 * T(kind, names, lines, discount?) — `names` is { it, de, uk, tl } → [name,
 * description] for the SERVICE (its en/fr/es already sit on the row); `lines`
 * from L.* / SHARED.*; `discount` from D.* or null.
 */
export function T(kind, names, lines, discount = null) {
  if (!TEMPLATE_KINDS.includes(kind)) fail(`kind ${kind}`);
  if (!Array.isArray(lines) || lines.length === 0) fail("a template needs at least one line");
  for (const lang of ["it", "de", "uk", "tl"]) {
    const t = names?.[lang];
    if (!Array.isArray(t) || t.length !== 2 || !t[0] || typeof t[1] !== "string") fail(`service ${lang} must be [name, description]`);
  }
  return { kind, names, lines, discount };
}

/**
 * Round a USD suggestion so it cannot read as exact:
 *   ≥ $1,000 → $50 · ≥ $100 → $10 · ≥ $20 → $5 · ≥ $5 → $1 · under → $0.25.
 * The three coarse steps are the brief's; the two fine ones exist because a
 * per-square-foot rate of $3.50 must not become $5.
 */
export function roundPreset(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  const step = v >= 1000 ? 50 : v >= 100 ? 10 : v >= 20 ? 5 : v >= 5 ? 1 : 0.25;
  return Math.round(v / step) * step;
}

/**
 * The preset range for a templated service.
 *
 * With a benchmark on the row: OUR rounded reading of it — median rounded to
 * the step, min ≈ the low quartile, max ≈ the high one; a missing quartile
 * becomes ±20/25% of the median. The raw quartiles stay in `benchmark`
 * untouched; this is the number the preset price is set from.
 *
 * Without one: derived from the template's own lines and said so in
 * `rangeBasis`. For a flat or per-item service that is the line total; for a
 * service sold per sq ft / linear ft / hour / square it is the SUM OF THE
 * UNIT PRICES of the lines sold in that unit — the per-unit rate — because
 * `range` is in the service's unit and a 200 sq ft example job is not a rate.
 */
export function rangeFor(service, lines) {
  const b = service.benchmark;
  if (b && Number.isFinite(Number(b.median)) && Number(b.median) > 0) {
    const median = Number(b.median);
    const low = Number.isFinite(Number(b.low)) && Number(b.low) > 0 ? Number(b.low) : median * 0.8;
    const high = Number.isFinite(Number(b.high)) && Number(b.high) > 0 ? Number(b.high) : median * 1.25;
    return { basis: "benchmark", range: ordered(roundPreset(low), roundPreset(median), roundPreset(high)) };
  }
  const perUnit = ["sqft", "linear_ft", "hour", "square"].includes(service.unit)
    ? lines.filter((l) => l.unit === service.unit).reduce((s, l) => s + l.unitPrice, 0)
    : 0;
  // A flat-priced row with no benchmark whose lines are measured has no
  // honest flat preset: qty 1 is a fallback, not a job, and inventing a
  // "typical" area would be padding absent data. The range is null and the
  // basis says why; the price appears once the takeoff fills the quantities.
  if (perUnit === 0 && lines.some((l) => l.measurementKey)) {
    return { basis: "measured", range: null };
  }
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const base = perUnit > 0 ? perUnit : total;
  if (!(base > 0)) fail(`${service.seedKey}: no benchmark and the lines total zero`);
  return { basis: "lines", range: ordered(roundPreset(base * 0.8), roundPreset(base), roundPreset(base * 1.25)) };
}

const ordered = (min, median, max) => ({
  min: Math.min(min, median),
  median,
  max: Math.max(max, median),
});

/**
 * Attach templates to a seed's services, in place, and return the seed.
 * A template whose seed key names no service is a bug, not a silent no-op:
 * it throws at import so the build fails instead of a trade quietly losing a
 * template.
 */
export function withTemplates(seed, templates) {
  const byKey = new Map(seed.services.map((s) => [s.seedKey, s]));
  for (const key of Object.keys(templates)) {
    if (!byKey.has(key)) fail(`${seed.trade}: template for unknown service ${key}`);
  }
  seed.services = seed.services.map((s) => {
    const t = templates[s.seedKey];
    if (!t) return s;
    const templateLines = t.lines.map((l) => {
      const row = {
        kind: l.kind,
        name: l.text.en[0],
        description: l.text.en[1],
        qty: l.qty,
        unit: l.unit,
        unitPrice: l.unitPrice,
        unitCost: l.unitCost,
        taxable: l.taxable,
      };
      if (l.measurementKey) row.measurementKey = l.measurementKey;
      return row;
    });
    const defaultDiscount = t.discount
      ? { name: DISCOUNT_NAMES[t.discount.key].en, kind: t.discount.kind, amount: t.discount.amount }
      : null;
    const translations = {};
    for (const lang of TEMPLATE_LANGUAGES) {
      const own = s.name?.[lang] && s.description?.[lang] ? [s.name[lang], s.description[lang]] : t.names[lang];
      if (!own) fail(`${s.seedKey}: no ${lang} name`);
      translations[lang] = {
        name: own[0],
        description: own[1],
        templateLines: t.lines.map((l) => ({ name: l.text[lang][0], description: l.text[lang][1] })),
        defaultDiscount: t.discount ? { name: DISCOUNT_NAMES[t.discount.key][lang] } : null,
      };
    }
    const { basis, range } = rangeFor(s, t.lines);
    return {
      ...s,
      templateKind: t.kind,
      templateLines,
      defaultDiscount,
      imageUrl: null,
      range,
      rangeBasis: basis,
      translations,
    };
  });
  return seed;
}
