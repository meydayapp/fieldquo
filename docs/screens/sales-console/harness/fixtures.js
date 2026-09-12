// Fixture data for the /sales/queue console harness. Shapes follow
// app/api/sales/queue/route.js and lib/sales/prospectView.js.
const now = Date.now();
const iso = (minFromNow) => new Date(now + minFromNow * 60000).toISOString();

const mk = (id, businessName, city, province, zoneShort, zone, opts = {}) => ({
  id, businessName, tradeKey: "electrical", city, province,
  language: opts.language || null,
  researched: opts.researched ?? true,
  researching: opts.researching ?? false,
  phoneE164: opts.phone || "+14055550100",
  contact: { callable: opts.callable ?? true, code: opts.callable === false ? "do_not_contact" : "ok", title: opts.callable === false ? "Asked not to be contacted" : "" },
  claim: { state: opts.worked ? "mine_worked" : "mine", text: "Claimed by you until 4:12 PM tomorrow." },
  lastOutcome: opts.outcome ? { disposition: opts.outcome, at: iso(-40) } : null,
  window: opts.window || { decision: "allowed", callableNow: true, opensAtIso: null, opensAtLocal: null, closesAtIso: iso(120), closesAtLocal: "9:00 PM", zoneShort, zone, zoneLabel: opts.zoneLabel || "Central Time", zoneAcronym: opts.acronym || "CT" },
});

const later = (opens, zoneShort, zone, zoneLabel, acronym = "PT", opensIn = 120) => ({ decision: "refused", callableNow: false, opensAtIso: iso(opensIn), opensAtLocal: opens, closesAtLocal: null, zoneShort, zone, zoneLabel, zoneAcronym: acronym });

export const ITEMS = [
  mk("p1", "South County Electric, LLC", "Norman", "OK", "CDT", "America/Chicago"),
  mk("p2", "Bright Current Electrical", "Tulsa", "OK", "CDT", "America/Chicago", { outcome: "no_answer" }),
  mk("p3", "Red Dirt Wiring Co.", "Edmond", "OK", "CDT", "America/Chicago", { researched: false, researching: true }),
  mk("p4", "Sooner Sparks Electric", "Moore", "OK", "CDT", "America/Chicago", { outcome: "reached_interested", worked: true }),
  mk("p5", "Lone Star Volt", "Plano", "TX", "CDT", "America/Chicago", { outcome: "voicemail" }),
  mk("p6", "Hill Country Electric", "Austin", "TX", "CDT", "America/Chicago", { callable: false }),
  mk("p7", "Golden State Wiring", "Fresno", "CA", "PDT", "America/Los_Angeles", { window: later("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT") }),
  mk("p8", "Sierra Electrical Services", "Reno", "NV", "PDT", "America/Los_Angeles", { window: later("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT") }),
  mk("p9", "Pacific Amp Co.", "Portland", "OR", "PDT", "America/Los_Angeles", { window: later("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT"), researched: false }),
  mk("p10", "Électricité Bouchard", "Laval", "QC", "EDT", "America/Toronto", { language: "fr", acronym: "ET", zoneLabel: "Eastern Time" }),
  mk("p11", "Grand Canyon Electric", "Phoenix", "AZ", "MST", "America/Phoenix", { window: { decision: "refused", callableNow: false, opensAtIso: null, opensAtLocal: null, closesAtLocal: null, zoneShort: "MST", zone: "America/Phoenix", zoneLabel: "Mountain Time", zoneAcronym: "MT" } }),
];

// 9:20 pm Eastern: every held row shut. Eastern opens 8:00 AM, Central 9:00
// AM ET, Pacific 11:00 AM ET — nothing before then.
const shutAt = (opens, zoneShort, zone, zoneLabel, acronym, opensIn) => later(opens, zoneShort, zone, zoneLabel, acronym, opensIn);
export const ITEMS_SHUT = [
  mk("s1", "Hudson Valley Electric", "Kingston", "NY", "EDT", "America/New_York", { window: shutAt("8:00 AM", "EDT", "America/New_York", "Eastern Time", "ET", 640) }),
  mk("s2", "Garden State Wiring", "Trenton", "NJ", "EDT", "America/New_York", { window: shutAt("8:00 AM", "EDT", "America/New_York", "Eastern Time", "ET", 640), outcome: "no_answer" }),
  mk("s3", "Électricité Bouchard", "Laval", "QC", "EDT", "America/Toronto", { language: "fr", window: shutAt("9:00 AM", "EDT", "America/Toronto", "Eastern Time", "ET", 700) }),
  mk("s4", "Bright Current Electrical", "Tulsa", "OK", "CDT", "America/Chicago", { window: shutAt("9:00 AM", "CDT", "America/Chicago", "Central Time", "CT", 700) }),
  mk("s5", "Red Dirt Wiring Co.", "Edmond", "OK", "CDT", "America/Chicago", { researched: false, researching: true, window: shutAt("9:00 AM", "CDT", "America/Chicago", "Central Time", "CT", 700) }),
  mk("s6", "Golden State Wiring", "Fresno", "CA", "PDT", "America/Los_Angeles", { window: shutAt("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT", 820) }),
  mk("s7", "Sierra Electrical Services", "Reno", "NV", "PDT", "America/Los_Angeles", { window: shutAt("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT", 820) }),
  mk("s8", "Pacific Amp Co.", "Portland", "OR", "PDT", "America/Los_Angeles", { researched: false, window: shutAt("11:00 AM", "PDT", "America/Los_Angeles", "Pacific Time", "PT", 820) }),
];
export const GROUPS_SHUT = [
  { key: "opens:8", kind: "opens", count: 2, ids: ["s1", "s2"], opensAtLocal: "8:00 AM", zoneLabel: "Eastern Time" },
  { key: "opens:9", kind: "opens", count: 3, ids: ["s3", "s4", "s5"], opensAtLocal: "9:00 AM", zoneLabel: "Eastern Time, Central Time" },
  { key: "opens:11", kind: "opens", count: 3, ids: ["s6", "s7", "s8"], opensAtLocal: "11:00 AM", zoneLabel: "Pacific Time" },
];

export const GROUPS = [
  { key: "now", kind: "now", count: 7, ids: ["p1", "p2", "p3", "p4", "p5", "p6", "p10"] },
  { key: "opens:11", kind: "opens", count: 3, ids: ["p7", "p8", "p9"], opensAtLocal: "11:00 AM", zoneLabel: "Pacific Time" },
  { key: "later", kind: "later", count: 1, ids: ["p11"] },
];

const capability = (code, tone, text, detail, extra = {}) => ({ code, tone, text, detail, known: tone !== "unknown", sayable: tone !== "unknown", state: tone === "has" ? "has" : tone === "gap" ? "no" : "unknown", subject: code, ...extra });

export function currentFor(id) {
  const item = [...ITEMS, ...ITEMS_SHUT].find((i) => i.id === id) || ITEMS[0];
  const isP1 = item.id === "p1";
  return {
    id: item.id,
    businessName: item.businessName,
    businessNameKey: null,
    tradeKey: "electrical",
    tradeLabel: "Electrical",
    territory: { id: "t1", name: "Oklahoma City" },
    websiteUrl: isP1 ? "https://southcountyelectric.com" : null,
    phoneE164: item.phoneE164,
    email: isP1 ? "office@southcountyelectric.com" : null,
    emailSource: isP1 ? "mailto" : null,
    status: "discovered",
    facts: [
      { key: "businessName", label: "Business", labelKey: "app.salesIntel.fact.businessName.label", known: true, text: item.businessName, textKey: null },
      { key: "location", label: "Where", labelKey: "app.salesIntel.fact.location.label", known: true, text: `2104 W Main St · ${item.city}, ${item.province}, US`, textKey: null },
      { key: "phone", label: "Phone", labelKey: "app.salesIntel.fact.phone.label", known: true, text: item.phoneE164, textKey: null },
      { key: "rating", label: "Rating", labelKey: "app.salesIntel.fact.rating.label", known: true, text: "4.7 out of 5", textKey: "app.salesIntel.fact.rating.value", params: { rating: "4.7" } },
      { key: "reviews", label: "Reviews", labelKey: "app.salesIntel.fact.reviews.label", known: true, text: "38 reviews", textKey: "app.salesIntel.fact.reviews.value", params: { count: 38 } },
    ],
    contact: item.contact,
    claim: item.claim,
    competitor: { known: true, text: "Their site runs on Wix. No field-service software detected." },
    technologies: [],
    capabilities: isP1 ? [
      capability("WEBSITE", "has", "Has a website", "southcountyelectric.com"),
      capability("ONLINE_BOOKING", "gap", "No online booking", null),
      capability("ONLINE_PAYMENT", "gap", "No online payment", null),
      capability("QUOTE_FORM", "has", "Has a quote form", "A contact form asks for the job and a phone number."),
      capability("LIVE_CHAT", "unknown", "We don't know whether they have live chat", null),
      capability("REVIEWS", "has", "Shows reviews", "Google rating on the home page."),
    ] : [],
    inferences: isP1 ? [
      { kind: "owner_name", renderable: true, text: "Dave Hensley", textKey: null, kindText: "Owner", kindTextKey: null, confidenceText: "82% confident", confidenceTextKey: "app.salesIntel.confidencePercent", confidencePercent: 82, sourceText: "Derived from what we observed.", sourceTextKey: "app.salesIntel.inference.sourceObserved", evidenceIds: ["e1"] },
      { kind: "company_scale", renderable: true, text: "Small business", textKey: "app.salesIntel.bucket.SMALL_BUSINESS", kindText: "Company scale", kindTextKey: "app.salesIntel.kind.company_scale", confidenceText: "71% confident", confidenceTextKey: "app.salesIntel.confidencePercent", confidencePercent: 71, sourceText: "Derived from what we observed.", sourceTextKey: "app.salesIntel.inference.sourceObserved", evidenceIds: ["e2", "e3"] },
      { kind: "crew_size", renderable: false, refusal: "A crew-size inference was recorded with no confidence figure, so it is withheld.", refusalKey: null },
    ] : [],
    opportunities: isP1 ? [
      { capabilityCode: "ONLINE_BOOKING", renderable: true, name: "Online booking", nameKey: null, reason: "their site has a quote form but no way to pick a time — every job still needs a phone call back", confidenceText: "88% confident", confidenceTextKey: "app.salesIntel.confidencePercent", confidencePercent: 88, evidenceIds: ["e4", "e5"], ruleCode: "BOOKING_FROM_FORM" },
      { capabilityCode: "ONLINE_PAYMENT", renderable: true, name: "Online payment", nameKey: null, reason: "invoices are paid by cheque or at the door, per the FAQ", confidenceText: "64% confident", confidenceTextKey: "app.salesIntel.confidencePercent", confidencePercent: 64, evidenceIds: ["e6"], ruleCode: null },
    ] : [],
    unknowns: isP1 ? [{ key: null, text: "We do not know whether they offer live chat." }] : [{ key: "app.salesIntel.unknown.nothingInferred", text: "Nothing has been inferred about this business yet." }],
    score: isP1 ? { value: 78, version: "1", reasons: [] } : null,
    scoreNote: null,
    lastCrawledAt: iso(-3000),
    numbers: {
      stored: [],
      voice: { choices: [
        { id: "n1", e164: item.phoneE164, kind: "landline", label: "Listing number", preferred: true },
        ...(isP1 ? [{ id: "n2", e164: "+14055550177", kind: "mobile", label: "Dave's cell", preferred: false }] : []),
      ], refused: [], reason: "ok" },
      text: { choices: isP1 ? [{ id: "n2", e164: "+14055550177" }] : [], refused: [], reason: "ok" },
    },
    lead: isP1 ? { id: "lead1", businessName: item.businessName, contactName: "Dave Hensley", email: "office@southcountyelectric.com", phone: item.phoneE164, timeZone: "America/Chicago", country: "US", province: "OK", status: "new", notes: "" } : null,
    compliance: null,
    callingContext: { country: "US", province: item.province, timeZone: item.window.zone, attemptsLast24h: isP1 ? 1 : 0 },
    brief: {
      owner: isP1 ? { name: "Dave Hensley", quote: "Owner Dave Hensley has been wiring homes across Cleveland County since 2009.", source: "derived" } : null,
      description: isP1 ? "South County Electric is a family-run residential electrician in Norman with a strong Google rating, a website that takes quote requests through a form, and no way for a homeowner to book a time or pay online." : null,
      generatedAt: iso(-200),
      crawled: isP1,
      talkingPoints: [],
    },
    history: isP1 ? [
      { id: "a1", direction: "out", dialledAt: iso(-1500), answered: true, talkSeconds: 252, disposition: "reached_interested", callbackAt: iso(60 * 24), channel: "browser" },
      { id: "a2", direction: "in", dialledAt: iso(-3000), answered: false, talkSeconds: null, disposition: null, callbackAt: null, channel: "browser" },
      { id: "a3", direction: "out", dialledAt: iso(-4400), answered: false, talkSeconds: null, disposition: "voicemail", callbackAt: null, channel: "browser" },
    ] : [],
    existingCustomer: item.id === "p4",
    checkIns: isP1 ? [{ id: "c1", scheduledFor: iso(60 * 30), draftText: "Hi Dave, Daniel from FieldQuo. Did the booking link land in your inbox OK?", origin: "engine" }] : [],
  };
}

export const TRADES = [
  { key: "electrical", label: "Electrical", claimed: 11, available: 62 },
  { key: "plumbing", label: "Plumbing", claimed: 0, available: 34 },
  { key: "painting", label: "Painting", claimed: 0, available: 19 },
  { key: "roofing", label: "Roofing", claimed: 0, available: 0 },
];

export const PLAYBOOK = {
  prospect: { id: "p1", businessName: "South County Electric, LLC", email: "office@southcountyelectric.com", emailSource: "mailto" },
  playbook: { key: "form_no_booking", name: "Has a form, no booking", selectorLabel: "a quote form and no booking page", describe: "", facts: [{ label: "rating", value: "4.7" }] },
  noPlaybookReason: null,
  script: {
    stages: [
      { stageKey: "open", name: "Open", nameKey: null, purpose: "Say who you are before they can hang up.", say: { text: "Hi — is that South County Electric? My name's Daniel and I'm from FieldQuo.", missing: [], refusal: null }, prompts: [], points: [] },
      { stageKey: "relevance", name: "Why them", nameKey: null, purpose: null, say: { text: "I've been through your website and noticed a few things that could bring in more jobs.", missing: [], refusal: null }, prompts: [], points: [
        { capabilityCode: "ONLINE_BOOKING", capabilityName: "Online booking", text: "Their quote form asks for a callback — there is no way to pick a time.", evidenceIds: ["e4", "e5"], ruleCode: "BOOKING_FROM_FORM" },
        { capabilityCode: "REVIEWS", capabilityName: "Reviews", text: "A strong Google rating on the home page — homeowners already trust them.", evidenceIds: ["e7"], ruleCode: null },
      ] },
      { stageKey: "discover", name: "Discover", nameKey: null, purpose: null, say: { text: "How do quotes get back to a homeowner today — is that you, after hours?", missing: [], refusal: null }, prompts: [{ text: "Who answers the phone when you're on a ladder?", missing: [], refusal: null }], points: [] },
      { stageKey: "close", name: "Close", nameKey: null, purpose: null, say: { text: "I can show you in fifteen minutes how it works for a shop like yours. What works better for you, mornings or afternoons?", missing: [], refusal: null }, prompts: [], points: [] },
    ],
    missingStages: [],
  },
  objections: [
    { code: "ALREADY_USE_COMPETITOR", label: "We already use [another platform]", response: "That's fine — most of our electricians came from one. What does it do for you at the door, when the homeowner wants to pay?", context: "" },
    { code: "TOO_EXPENSIVE", label: "That sounds expensive / we can't afford another subscription", response: "One booked job a month covers it. The first month is free, so you'd know before you paid anything.", context: "" },
    { code: "NO_TIME_TO_SWITCH", label: "I don't have time to learn new software", response: "You don't switch anything. Your quote form keeps working; the booking link just goes underneath it.", context: "" },
  ],
  callScript: {
    opener: "Hi — is that South County Electric? My name's Daniel and I'm from FieldQuo. I'm calling because I've been through your website and noticed a couple of things that could help you book more jobs — do you have a few minutes so I can show you how?",
    whatWeSaw: ["Your site takes quote requests through a form, but a homeowner can't pick a time — every job waits on a call back.", "A strong Google rating from dozens of reviews — people already trust you; they just can't book you.", "Invoices are paid by cheque or at the door, per your FAQ."],
    whyThemNow: "Norman is heading into storm season and the shops that let people book a time online are the ones that fill the schedule first.",
    threeQuestions: ["How do quotes get back to a homeowner today — is that you, after hours?", "When somebody wants to pay, what happens?", "How many calls a week do you miss because you're on a ladder?"],
    objections: [
      { they: "We're busy enough.", you: "Then the question is which jobs you take — booking online lets you keep the good ones." },
      { they: "Send me an email.", you: "Happy to — what should it say you care about most, the booking or the payments? Then I'll keep it to one screen." },
    ],
    closeAsk: "I can show you in fifteen minutes how it works for a business like yours. What works better for you, mornings or afternoons?",
    doNotSay: ["Don't quote a price on this call.", "Don't say the form is broken — it works; it just can't book."],
    citations: [{ field: "opener", quote: "Request a quote and we'll call you back within one business day.", sourceUrl: "https://southcountyelectric.com/contact" }],
    generatedAt: iso(-200),
    crawledAt: iso(-3000),
    model: "gpt-4.1-mini",
    version: "2",
    language: "en",
  },
  // The switch's state as the route reports it: English is the default for
  // a New York row, and the rep may ask for the other two.
  scriptLanguage: { current: "en", default: "en", leadLanguage: "en", available: ["en", "fr", "es"], fallback: null, repId: "r1" },
  unchecked: [],
  generation: { degraded: false },
  store: { ready: true },
};

// The same script in the other two languages — what /api/sales/playbook
// answers with ?language=fr / ?language=es. The register the prompt asks
// for (lib/sales/intel/callScript.js REGISTER): vous, soumission, cellulaire;
// usted, cotización, celular. The citations stay in the site's own English.
// Both pass validateCallScript and the voice lint for their language.
export const CALL_SCRIPT_FR = {
  opener: "Bonjour — c'est bien South County Electric? Je m'appelle Daniel et je suis chez FieldQuo. Je vous appelle parce que j'ai regardé votre site web et j'ai remarqué deux ou trois choses qui pourraient vous aider à booker plus de contrats. Avez-vous quelques minutes pour que je vous montre comment?",
  whatWeSaw: ["Votre site prend les demandes de soumission par un formulaire, mais le client ne peut pas choisir une heure — chaque contrat attend un rappel.", "Une bonne note Google avec des dizaines d'avis — les gens vous font déjà confiance, ils ne peuvent juste pas vous réserver.", "Les factures se paient par chèque ou à la porte, selon votre FAQ."],
  whyThemNow: "Norman s'en va vers la saison des tempêtes, et les entreprises qui laissent les gens réserver une heure en ligne sont celles qui remplissent leur horaire en premier.",
  threeQuestions: ["Comment les soumissions reviennent-elles au client aujourd'hui — c'est vous, après les heures?", "Quand quelqu'un veut payer, qu'est-ce qui se passe?", "Combien d'appels par semaine manquez-vous parce que vous êtes dans une échelle?"],
  objections: [
    { they: "On est assez occupés.", you: "Alors la question, c'est quels contrats vous prenez — la réservation en ligne vous laisse garder les bons." },
    { they: "Envoyez-moi un courriel.", you: "Avec plaisir — qu'est-ce qui compte le plus pour vous, la réservation ou les paiements? Je vais garder ça sur un écran." },
  ],
  closeAsk: "Je peux vous montrer en quinze minutes comment ça marche pour une entreprise comme la vôtre. Qu'est-ce qui vous convient le mieux, le matin ou l'après-midi?",
  doNotSay: ["Ne donnez pas de prix sur cet appel.", "Ne dites pas que le formulaire est brisé — il marche, il ne peut juste pas réserver."],
  citations: [{ field: "opener", quote: "Request a quote and we'll call you back within one business day.", sourceUrl: "https://southcountyelectric.com/contact" }],
  generatedAt: iso(-5),
  crawledAt: iso(-3000),
  model: "gpt-4.1-mini",
  version: "2",
  language: "fr",
};

export const CALL_SCRIPT_ES = {
  opener: "Hola, ¿hablo con South County Electric? Me llamo Daniel y soy de FieldQuo. Le llamo porque revisé su sitio web y noté un par de cosas que le podrían ayudar a agendar más trabajos. ¿Tiene unos minutos para que le muestre cómo?",
  whatWeSaw: ["Su sitio recibe pedidos de cotización por un formulario, pero el cliente no puede elegir una hora: cada trabajo espera una llamada de vuelta.", "Una buena calificación en Google con decenas de reseñas: la gente ya confía en ustedes, solo que no puede reservarlos.", "Las facturas se pagan con cheque o en la puerta, según su página de preguntas."],
  whyThemNow: "Norman entra en temporada de tormentas, y los negocios que dejan a la gente reservar una hora en línea son los que llenan la agenda primero.",
  threeQuestions: ["¿Cómo le llegan las cotizaciones al cliente hoy? ¿Es usted, fuera de horario?", "Cuando alguien quiere pagar, ¿qué pasa?", "¿Cuántas llamadas a la semana pierde porque está en una escalera?"],
  objections: [
    { they: "Ya tenemos bastante trabajo.", you: "Entonces la pregunta es cuáles trabajos toma usted: reservar en línea le deja quedarse con los buenos." },
    { they: "Mándeme un correo.", you: "Con gusto. ¿Qué le importa más, las reservas o los pagos? Así lo dejo en una sola pantalla." },
  ],
  closeAsk: "Le puedo mostrar en quince minutos cómo funciona para un negocio como el suyo. ¿Qué le conviene más, las mañanas o las tardes?",
  doNotSay: ["No dé un precio en esta llamada.", "No diga que el formulario está roto: funciona, solo que no puede reservar."],
  citations: [{ field: "opener", quote: "Request a quote and we'll call you back within one business day.", sourceUrl: "https://southcountyelectric.com/contact" }],
  generatedAt: iso(-5),
  crawledAt: iso(-3000),
  model: "gpt-4.1-mini",
  version: "2",
  language: "es",
};

/** The playbook as the route answers it for one language. */
export function playbookIn(language) {
  const script = language === "fr" ? CALL_SCRIPT_FR : language === "es" ? CALL_SCRIPT_ES : PLAYBOOK.callScript;
  return { ...PLAYBOOK, callScript: script, scriptLanguage: { ...PLAYBOOK.scriptLanguage, current: script.language } };
}

export const NOTES = [
  { id: "note1", title: "Dave — spoke Tue", body: "Dave answers himself after 4pm. Wants to see booking first, payment later.", updatedAt: iso(-1400), parentKind: "prospect", parentId: "p1" },
];

export const ME = { id: "r1", name: "Daniel Roy", email: "daniel@fieldquo.com", code: "DAN1", signups: { today: 1, thisWeek: 4, total: 27 } };
export const BADGES = { callsToday: 24, dayCap: 250, texts: 3, team: 1, voicemail: 2 };
