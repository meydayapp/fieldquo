const NOW = new Date();
const ago = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const ME = "+14055550132";
const SC = "+16315550177";
const PP = "+18195550106";
const CP = "+15145550148";
const SL = "+14165550198";

const meltonMessages = [
  { id: "a", direction: "in", body: "Who is this? You called from a 918 number", sentAt: ago(2 * 24 * 60 + 60), fromE164: ME, toE164: "+19185550000" },
  { id: "b", direction: "out", body: "Hi, Rachel from FieldQuo — we make quoting and invoicing software for electrical contractors. Rang to see how you're doing quotes today. No rush, text back when you're off the job.\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(2 * 24 * 60 + 58), fromE164: "+19185550000", toE164: ME },
  { id: "b2", direction: "out", body: "If it's easier, 15 minutes on a call tomorrow works too.\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(2 * 24 * 60 + 57), fromE164: "+19185550000", toE164: ME },
  { id: "c", direction: "in", body: "We do quotes on paper at the truck then type them up at night. Takes forever", sentAt: ago(24 * 60 + 20), fromE164: ME, toE164: "+19185550000" },
  { id: "c2", direction: "in", body: "how much is it", sentAt: ago(24 * 60 + 19), fromE164: ME, toE164: "+19185550000" },
  { id: "d", direction: "out", body: "$49 a month, one seat, everything included — quotes, invoices, scheduling. First month free, cancel any time.\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(24 * 60 + 5), fromE164: "+19185550000", toE164: ME },
  { id: "e", direction: "in", body: "Can my wife use it too for the invoices?", sentAt: ago(40), fromE164: ME, toE164: "+19185550000", triage: "question", triageReason: "Asks whether a second person can use it for invoicing.", triagedAt: ago(39), triageModel: "gpt-5-mini", triageOverriddenById: null },
  { id: "e2", direction: "in", body: "she does the books", sentAt: ago(39), fromE164: ME, toE164: "+19185550000", triage: "question", triageReason: "Asks whether his wife, who does the books, can use it too.", triagedAt: ago(38), triageModel: "gpt-5-mini", triageOverriddenById: null },
];

// ── A roadblock: Toitures Ouellet hit a wall on the signup form ───────────
const TO = "+14185550148";
const ouelletMessages = [
  { id: "o1", direction: "out", body: "Bonjour, c'est Rachel de FieldQuo. Voici le lien pour commencer : https://www.fieldquo.com/signup?sales=RACH\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(3 * 60), fromE164: "+19185550000", toE164: TO },
  { id: "o2", direction: "in", body: "Le lien dit que mon courriel est déjà utilisé, je peux pas passer l'étape 2", sentAt: ago(55), fromE164: TO, toE164: "+19185550000", triage: "roadblock", triageReason: "The signup form rejects his email as already in use; he is stuck at step 2.", triagedAt: ago(54), triageModel: "gpt-5-mini", triageOverriddenById: null },
];

const canned = [
  { id: "signup", group: "sales", titleKey: "app.salesText.cannedSignupTitle", title: "Signup link", text: "Hi, it is Rachel from FieldQuo. Here is the link to get started: https://www.fieldquo.com/signup?sales=RACH" },
  { id: "checkin:all_good", group: "checkin", titleKey: "app.salesCheckin.reason.all_good", title: "Nothing looks wrong", text: "Hi, it is Rachel from FieldQuo, about Melton Electric. How is it going so far - is everything working the way you expected? If anything is not right, just reply here and I will sort it." },
  { id: "checkin:onboarding_unfinished", group: "checkin", titleKey: "app.salesCheckin.reason.onboarding_unfinished", title: "They never finished onboarding", text: "Hi, it is Rachel from FieldQuo, about Melton Electric. I noticed the setup is not finished yet. Happy to walk you through the rest if it helps. How is it going so far - is everything working the way you expected?" },
  { id: "checkin:payment_failing", group: "checkin", titleKey: "app.salesCheckin.reason.payment_failing", title: "Their subscription payment is failing", text: "Hi, it is Rachel from FieldQuo, about Melton Electric. Your card did not go through this month. Let me know if you want a hand sorting it. How is it going so far?" },
];

const baseThread = (e164, over = {}) => ({
  with: e164,
  messages: [],
  lead: null,
  company: null,
  timeZone: null,
  canSend: true,
  suppressed: false,
  blockers: [],
  checkIns: [],
  checkInError: null,
  suggestion: null,
  readState: null,
  canned,
  window: { known: false, open: false, until: null, timeZone: null },
  calls: [],
  suppressions: [],
  contact: { trade: null, city: null, province: null, score: null, repName: "Rachel K.", numbers: [], emailThreads: [], pastCheckIns: [] },
  ...over,
});

const ouellet = baseThread(TO, {
  messages: ouelletMessages,
  lead: { id: "lead-ouellet", businessName: "Toitures Ouellet", contactName: "Marc Ouellet", timeZone: "America/Toronto", email: "marc@toituresouellet.ca", status: "contacted", prospectId: "p-2" },
  timeZone: "America/Toronto",
  readState: { readAt: ago(50), doneAt: null },
  window: { known: true, open: true, until: new Date(NOW.getTime() + 5 * 3600000).toISOString(), timeZone: "America/Toronto" },
  triage: { kind: "roadblock", reason: "The signup form rejects his email as already in use; he is stuck at step 2.", overridden: false, at: ago(54), open: true },
  contact: { trade: "roofing", city: "Québec", province: "QC", score: { value: 71, at: ago(60 * 24) }, repName: "Rachel K.", numbers: [{ id: "n9", e164: TO, kind: "mobile", label: null, canCall: true, canText: true, preferred: true }], emailThreads: [], pastCheckIns: [] },
});

const melton = baseThread(ME, {
  messages: meltonMessages,
  triage: { kind: "question", reason: "Asks whether his wife, who does the books, can use it too.", overridden: false, at: ago(38), open: true },
  lead: { id: "lead-melton", businessName: "Melton Electric", contactName: "Cody Melton", timeZone: "America/Winnipeg", email: "cody@meltonelectric.com", status: "contacted", prospectId: "p-melton" },
  timeZone: "America/Winnipeg",
  readState: { readAt: ago(45), doneAt: null },
  window: { known: true, open: true, until: new Date(NOW.getTime() + 3 * 3600000).toISOString(), timeZone: "America/Winnipeg" },
  calls: [
    { id: "call1", at: ago(24 * 60 + 30), direction: "out", disposition: "no_answer", answered: false, talkSeconds: null, dialChannel: "browser" },
    { id: "call2", at: ago(3 * 24 * 60), direction: "out", disposition: "voicemail", answered: false, talkSeconds: null, dialChannel: "handset" },
  ],
  checkIns: [
    { id: "ck1", draftText: "Hi, it is Rachel from FieldQuo, about Melton Electric. How is it going so far - is everything working the way you expected? If anything is not right, just reply here and I will sort it.", scheduledFor: new Date(NOW.getTime() + 26 * 3600000).toISOString(), createdAt: ago(10), status: "draft", origin: "engine", reasonCode: "all_good", draftSource: "rule", degraded: false },
  ],
  contact: {
    trade: "electrical", city: "Oklahoma City", province: "OK",
    score: { value: 78, at: ago(60 * 24) }, repName: "Rachel K.",
    numbers: [
      { id: "n1", e164: ME, kind: "mobile", label: "Cody's cell", canCall: true, canText: true, preferred: true },
      { id: "n2", e164: "+14055550100", kind: "landline", label: "Shop", canCall: true, canText: false, preferred: false },
    ],
    emailThreads: [{ id: "t1", subject: "Quoting on the truck — FieldQuo", lastMessageAt: ago(5 * 24 * 60) }],
    pastCheckIns: [{ id: "ck0", status: "sent", sentAt: ago(9 * 24 * 60), dismissedAt: null, draftText: "…", reasonCode: "all_good" }],
  },
});

const sloth = baseThread(SL, {
  messages: [
    { id: "s1", direction: "out", body: "Hi, Rachel from FieldQuo — quoting and invoicing for electrical contractors. Would 15 minutes this week suit?\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(9 * 24 * 60 + 30), fromE164: "+19185550000", toE164: SL },
    { id: "s2", direction: "in", body: "STOP", sentAt: ago(9 * 24 * 60), fromE164: SL, toE164: "+19185550000" },
  ],
  lead: { id: "lead-sloth", businessName: "Sloth Electric", contactName: null, timeZone: "America/Toronto", email: null, status: "lost", prospectId: null },
  timeZone: "America/Toronto",
  canSend: false,
  suppressed: true,
  blockers: [{ code: "suppressed", title: "This number asked not to be contacted.", fix: "It stays on the do-not-contact list for three years; nothing can be sent to it." }],
  readState: { readAt: ago(8 * 24 * 60), doneAt: null },
  window: { known: true, open: true, until: new Date(NOW.getTime() + 2 * 3600000).toISOString(), timeZone: "America/Toronto" },
  suppressions: [{ id: "sup1", requestedAt: ago(9 * 24 * 60), source: "sms_stop", reason: "Replied STOP" }],
});

const park = baseThread(PP, {
  messages: [
    { id: "p1", direction: "out", body: "Hi, Rachel from FieldQuo. No rush, text back when you're off the job.\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(24 * 60 + 60), fromE164: "+19185550000", toE164: PP },
  ],
  lead: { id: "lead-park", businessName: "Park Place Installations", contactName: "Marc", timeZone: null, email: null, status: "new", prospectId: null },
  timeZone: null,
  canSend: false,
  blockers: [{ code: "time_zone_unknown", title: "We don't know what time it is where this prospect is.", fix: "Texting is limited to 08:00–21:00 every day, in the prospect's own time zone, so say where they are and the window can be checked." }],
  readState: { readAt: ago(10), doneAt: null },
});

const closed = baseThread(SC, {
  messages: [
    { id: "q1", direction: "out", body: "Hi, Rachel from FieldQuo — quoting software for electricians. Worth a look?\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: ago(200), fromE164: "+19185550000", toE164: SC },
    { id: "q2", direction: "in", body: "Can you call after 6", sentAt: ago(180), fromE164: SC, toE164: "+19185550000" },
  ],
  lead: { id: "lead-sc", businessName: null, contactName: null, timeZone: "America/Vancouver", email: null, status: "contacted", prospectId: null },
  timeZone: "America/Vancouver",
  canSend: false,
  blockers: [{ code: "outside_sms_window", title: "Outside the texting window where they are (08:00–21:00 every day, in the prospect's own time zone).", fix: "Send it once they're inside the window. Nothing is queued — you press send." }],
  readState: null,
  window: { known: true, open: false, until: new Date(NOW.getTime() + 9 * 3600000).toISOString(), timeZone: "America/Vancouver" },
});

const fresh = baseThread(CP, {
  messages: [],
  lead: { id: "lead-cp", businessName: "", contactName: null, timeZone: null, email: null, status: "new", prospectId: null },
  canSend: false,
  blockers: [{ code: "time_zone_unknown", title: "We don't know what time it is where this prospect is.", fix: "Say where they are." }],
});

const conversations = [
  { e164: TO, lastAt: ago(55), lastBody: "Le lien dit que mon courriel est déjà utilisé, je peux pas passer l'étape 2", lastDirection: "in", leadId: "lead-ouellet", name: "Toitures Ouellet", count: 2, unanswered: true, lastInboundAt: ago(55), unread: 1, readState: { readAt: ago(50), doneAt: null }, openDrafts: 0, nextDraftDue: null, triage: { kind: "roadblock", reason: "The signup form rejects his email as already in use; he is stuck at step 2.", overridden: false, at: ago(54), open: true } },
  { e164: ME, lastAt: ago(39), lastBody: "she does the books", lastDirection: "in", leadId: "lead-melton", name: "Melton Electric", count: 8, unanswered: true, lastInboundAt: ago(39), unread: 2, readState: { readAt: ago(45), doneAt: null }, openDrafts: 1, nextDraftDue: new Date(NOW.getTime() + 26 * 3600000).toISOString(), triage: { kind: "question", reason: "Asks whether his wife, who does the books, can use it too.", overridden: false, at: ago(38), open: true } },
  { e164: SC, lastAt: ago(180), lastBody: "Can you call after 6", lastDirection: "in", leadId: "lead-sc", name: null, count: 2, unanswered: true, lastInboundAt: ago(180), unread: 1, readState: null, openDrafts: 0, nextDraftDue: null, triage: { kind: "positive", reason: "Wants a call after 6.", overridden: false, at: ago(179), open: true } },
  { e164: PP, lastAt: ago(24 * 60 + 60), lastBody: "Hi, Rachel from FieldQuo. No rush, text back when you're off the job.", lastDirection: "out", leadId: "lead-park", name: "Park Place Installations", count: 1, unanswered: false, lastInboundAt: null, unread: 0, readState: { readAt: ago(10), doneAt: null }, openDrafts: 0, nextDraftDue: null },
  { e164: "+15145550101", lastAt: ago(3 * 24 * 60), lastBody: "Thanks, I'll have a look this week.", lastDirection: "in", leadId: "lead-col", name: "Colonna's Painting", count: 4, unanswered: true, lastInboundAt: ago(3 * 24 * 60), unread: 0, readState: { readAt: ago(2 * 24 * 60), doneAt: ago(2 * 24 * 60) }, openDrafts: 0, nextDraftDue: null, triage: { kind: "fine", reason: null, overridden: false, at: ago(3 * 24 * 60), open: false } },
  { e164: "+16135550122", lastAt: ago(2 * 24 * 60), lastBody: "Sounds good, talk Thursday.", lastDirection: "out", leadId: "lead-ott", name: "Ottawa Roofing Co", count: 6, unanswered: false, lastInboundAt: ago(2 * 24 * 60 + 30), unread: 0, readState: { readAt: ago(2 * 24 * 60), doneAt: null }, openDrafts: 1, nextDraftDue: new Date(NOW.getTime() + 24 * 3600000).toISOString() },
  { e164: SL, lastAt: ago(9 * 24 * 60), lastBody: "STOP", lastDirection: "in", leadId: "lead-sloth", name: "Sloth Electric", count: 2, unanswered: true, lastInboundAt: ago(9 * 24 * 60), unread: 0, readState: { readAt: ago(8 * 24 * 60), doneAt: ago(8 * 24 * 60) }, openDrafts: 0, nextDraftDue: null, triage: { kind: "stop", reason: null, overridden: false, at: ago(9 * 24 * 60), open: false } },
];

const contacts = [
  { kind: "lead", id: "lead-melton", name: "Melton Electric", e164: ME, status: "contacted" },
  { kind: "lead", id: "lead-park", name: "Park Place Installations", e164: PP, status: "new" },
  { kind: "prospect", id: "p-1", name: "Northside Painting", e164: "+15145550177", place: "Montréal, QC" },
  { kind: "prospect", id: "p-2", name: "Toitures Ouellet", e164: "+14185550148", place: "Québec, QC" },
];

const signup = {
  messages: [],
  sms: { canSend: false, blockers: [{ code: "time_zone_unknown", title: "We don't know what time it is where this prospect is.", fix: "Say where they are and the window can be checked." }], to: CP, from: "+19185550000", body: null },
  contact: { choices: [{ id: "n-cp", e164: CP, label: null, kind: "unknown" }], refused: [] },
  timeZones: [{ value: "America/Toronto", label: "Eastern (Toronto, Ottawa, Montréal, New York)" }, { value: "America/Winnipeg", label: "Central (Winnipeg, Chicago)" }],
};

export const FIXTURES = {
  default: { conversations, threads: { [ME]: melton, [TO]: ouellet, [SL]: sloth, [PP]: park, [SC]: closed, [CP]: fresh, "+15145550134": fresh }, contacts, signup },
  empty: { conversations: [], threads: {}, contacts: [], signup },
  unreadable: { conversations: conversations.map((c) => ({ ...c, unread: null, openDrafts: null })), readStateError: "Read markers could not be read, so unread counts are not shown.", draftsError: null, threads: { [ME]: melton }, contacts, signup },
};

// ── A company that signed up through the link and was never texted ─────────
// Easy Roofers Inc., as production shaped it on 2026-09-12 after the backlog
// was materialised: no message rows, one open day-1 draft keyed on the
// company's own number, a lead created for it, the company attributed.
const EZ = "+18192387263";
const easyDraftAt = new Date(NOW.getTime() + 20 * 60000).toISOString();
const easyDraft = {
  id: "ck-easy-1",
  companyId: "co-easy",
  leadId: "lead-easy",
  toE164: EZ,
  draftText: "Hi, it is Rachel from FieldQuo, about Easy Roofers Inc. I noticed the setup is not quite finished. Happy to walk you through the rest if it helps. How is it going so far - is everything working the way you expected? If anything is not right, just reply here and I will sort it.",
  origin: "engine",
  reasonCode: "onboarding_unfinished",
  draftSource: "rule",
  degraded: true,
  scheduledFor: easyDraftAt,
  status: "draft",
  createdAt: ago(15),
};
const easy = baseThread(EZ, {
  messages: [],
  lead: { id: "lead-easy", businessName: "Easy Roofers Inc.", contactName: null, timeZone: "America/Toronto", email: "sierra@example.com", status: "signed", prospectId: null },
  company: { id: "co-easy", name: "Easy Roofers Inc." },
  timeZone: "America/Toronto",
  canSend: true,
  readState: null,
  checkIns: [easyDraft],
  window: { known: true, open: true, until: new Date(NOW.getTime() + 7 * 3600000).toISOString(), timeZone: "America/Toronto" },
  contact: { trade: "roofing", city: "Ottawa", province: "ON", score: null, repName: "Rachel K.", numbers: [{ id: "n-ez", e164: EZ, kind: "mobile", label: "Company", canCall: true, canText: true, preferred: true }], emailThreads: [], pastCheckIns: [] },
});
const easyConversation = {
  e164: EZ,
  lastAt: easyDraftAt,
  lastBody: easyDraft.draftText,
  lastDirection: "out",
  leadId: null,
  name: "Easy Roofers Inc.",
  isDemo: false,
  count: 0,
  unanswered: false,
  lastInboundAt: null,
  unread: 0,
  readState: null,
  openDrafts: 1,
  nextDraftDue: easyDraftAt,
  draftOnly: true,
};
const DEMO = "+16135550150";
const demoDraft = {
  ...easyDraft,
  id: "ck-demo-1",
  companyId: "co-demo",
  leadId: null,
  toE164: DEMO,
  origin: "demo",
  reasonCode: "payments_not_connected",
  draftText: "Hi, it is Rachel from FieldQuo, about Cedar & Co. Flooring. I noticed payouts are not connected yet, so you cannot take card payments through the app. Happy to walk you through it whenever suits. How is it going so far - is everything working the way you expected?",
};
const demoThread = baseThread(DEMO, {
  messages: [],
  lead: null,
  company: null,
  draftCompany: { id: "co-demo", name: "Cedar & Co. Flooring", isDemo: true },
  demo: true,
  timeZone: null,
  canSend: false,
  blockers: [{ code: "demo_company", title: "This is your demo company. Nothing is sent from a demo.", fix: "The draft is here so you can see what a day-1 check-in looks like; on a real signup it is sendable." }],
  checkIns: [demoDraft],
});
const demoConversation = {
  ...easyConversation,
  e164: DEMO,
  lastBody: demoDraft.draftText,
  name: "Cedar & Co. Flooring",
  isDemo: true,
};
FIXTURES.companyCheckin = {
  conversations: [easyConversation, demoConversation, ...conversations],
  threads: { [EZ]: easy, [DEMO]: demoThread, [ME]: melton, [SL]: sloth, [PP]: park, [SC]: closed, [CP]: fresh },
  contacts,
  signup,
};
