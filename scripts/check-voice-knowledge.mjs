// scripts/check-voice-knowledge.mjs
//
//   npm run check:voice-knowledge
//
// The receptionist's knowledge draft, executed.
//
// This feature writes text that ends up in a prompt that is read aloud, in the
// contractor's voice, to a stranger who may hold them to it. Three properties
// are the whole safety argument, and none of them is provable by reading:
//
//   1. NOTHING THE APP ALREADY KNOWS IS DRAFTED INTO PROSE. Opening hours,
//      service names and work areas reach the agent as structured facts on
//      every push. A prose copy is a copy that goes stale the day somebody
//      edits the row, and a stale sentence outlives the fact it contradicts.
//
//   2. NOTHING IS INVENTED. No figure, no date, no duration, no guarantee —
//      not in our catalogue, not in the French catalogue, and not in anything
//      a model rewrote. A number said out loud by something that sounds like
//      the business is a number the business may have to honour.
//
//   3. AN UNANSWERED DRAFT REACHES NOBODY. Every drafted line is wholly
//      bracketed, and buildAgentPrompt withholds a bracketed line. So a
//      contractor who pastes the draft in and saves it without editing has
//      added exactly nothing to what the phone says — which is the only
//      acceptable behaviour for text nobody has read.
//
// No model is called here. The one thing the model does — choose and reword —
// is exercised through mergeDraft() with hand-written hostile output.
//
// Section 9 covers the other half of that screen: the stuck-number banner. Its
// old copy asserted "already yours and already being charged for" against every
// verdict including `ghost`, where no number exists at the provider and nobody
// is charging for anything — leaving a contractor with no phone and an
// imaginary bill. The money sentence is now licensed by the verdict, and that
// licence is asserted here in all six catalogues.

import {
  gapsFor,
  draftNote,
  usableNotes,
  tradeGaps,
  forbiddenIn,
  restatesStructured,
  gapKey,
  NOTE_GAP_IDS,
  STRUCTURED_GAP_IDS,
} from "@/lib/voice/knowledge";
import { draftKnowledge, mergeDraft } from "@/lib/voice/knowledgeDraft";
import { buildAgentPrompt } from "@/lib/voice/prompt";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { NUMBER_VERDICTS } from "@/lib/voice/diagnose";
import {
  DIAGNOSIS_TONE,
  DIAGNOSIS_TEXT,
  SIDE_TEXT,
  diagnosisKey,
  sideKey,
} from "@/lib/voice/diagnosisCopy";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let fail = 0;
const ok = (c, m) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) fail++;
};

// A real-ish company, and a deliberately awkward one: "Roofing" is a word that
// could plausibly turn up inside a generic question, and "Home" as a work area
// is the kind of name that breaks a naive substring check.
const COMPANY = { name: "Sunset Roofing", phone: "+18192387263", city: "Gatineau", province: "QC" };
const SERVICES = ["Roofing", "Siding", "Snow Removal"];
const AREAS = ["Gatineau", "Ottawa", "Home"];

const text = (lang) => (key) => APP_MESSAGES[lang]?.[key] || null;

// ══ 1. The catalogue itself is clean, in both gated languages ══════════════
//
// Filtered at runtime only for DERIVED text (see the note in gapsFor), so the
// hand-written catalogue's cleanliness has to be asserted rather than enforced.

for (const lang of ["en", "fr"]) {
  for (const id of [...NOTE_GAP_IDS, ...STRUCTURED_GAP_IDS]) {
    const s = APP_MESSAGES[lang]?.[gapKey(id)];
    ok(Boolean(s), `${lang}: ${gapKey(id)} exists`);
    if (!s) continue;
    const bad = forbiddenIn(s);
    ok(!bad, `${lang}: ${id} carries no ${bad || "figure, date, duration or guarantee"}`);
    ok(/\?/.test(s), `${lang}: ${id} is a QUESTION, not a statement about the business`);
  }
}

// The note-gap wording must not name a fact the agent already has. Structured
// gaps are exempt — "when are you open?" is the whole point of that one, and it
// never enters the note.
for (const lang of ["en", "fr"]) {
  for (const id of NOTE_GAP_IDS) {
    const s = APP_MESSAGES[lang][gapKey(id)];
    const dup = restatesStructured(s, { services: SERVICES, areas: ["Gatineau", "Ottawa"] });
    ok(!dup, `${lang}: ${id} does not restate ${dup || "a structured fact"}`);
  }
}

// ══ 2. A fully-populated company: the draft covers only the gaps ═══════════

const full = gapsFor({
  company: COMPANY,
  services: SERVICES,
  areas: AREAS,
  hasHours: true,
  canBook: true,
  notes: "",
  text: text("en"),
});
const fullNote = draftNote(full.questions);

ok(full.questions.length >= 4, `a fully set-up company still has ${full.questions.length} questions worth asking`);
ok(full.structured.length === 0, "and nothing left to fill in structurally");

ok(!/\d/.test(fullNote), "the drafted note contains no digit at all");
ok(!forbiddenIn(fullNote), `no figure, date, duration or guarantee: ${forbiddenIn(fullNote) || "clean"}`);

for (const s of SERVICES) {
  ok(!fullNote.toLowerCase().includes(s.toLowerCase()), `the note never names the service "${s}"`);
}
for (const a of ["Gatineau", "Ottawa"]) {
  ok(!fullNote.toLowerCase().includes(a.toLowerCase()), `the note never names the work area "${a}"`);
}
ok(
  !restatesStructured(fullNote, { services: SERVICES, areas: ["Gatineau", "Ottawa"] }),
  "and it states no opening-hours phrase — hours reach the agent as a fact, not as prose",
);

// ══ 3. An unedited draft reaches nobody ════════════════════════════════════

const asNotes = usableNotes(fullNote);
ok(asNotes.text === "", "an unedited draft contributes NOTHING to the live prompt");
ok(asNotes.withheld.length === full.questions.length, "and every line of it is reported as withheld");

const promptWithRawDraft = buildAgentPrompt({ company: COMPANY, notes: fullNote });
ok(
  !/NOTES FROM THE BUSINESS/.test(promptWithRawDraft),
  "buildAgentPrompt omits the notes section entirely when every line is unanswered",
);
ok(
  !promptWithRawDraft.includes("["),
  "no bracket survives into the prompt — a question read aloud is the business asking the caller to fill in a form",
);

// Half-answered: the answered line goes through, the rest is still held back.
const halfAnswered = ["We don't do commercial work.", ...fullNote.split("\n").slice(1)].join("\n");
const half = usableNotes(halfAnswered);
ok(half.text === "We don't do commercial work.", "an answered line passes through untouched");
ok(half.withheld.length === full.questions.length - 1, "and only the unanswered ones are withheld");
const halfPrompt = buildAgentPrompt({ company: COMPANY, notes: halfAnswered });
ok(/We don't do commercial work/.test(halfPrompt), "the answered line reaches the agent");
ok(!halfPrompt.includes("["), "the unanswered ones still do not");

// ══ 4. An absent fact produces a QUESTION and a place to answer it ═════════
//
// Never a sentence. The failure this prevents is a drafted "we're open weekdays"
// for a company that never said so — the invented-opening-hours case that
// provision.js and prompt.js are both written against.

const bare = gapsFor({
  company: { name: "Bare Co" },
  services: [],
  areas: [],
  hasHours: false,
  canBook: false,
  notes: "",
  text: text("en"),
});
const bareNote = draftNote(bare.questions);
const structuredIds = bare.structured.map((s) => s.id);

for (const id of ["hours", "services", "areas", "phone", "place", "booking"]) {
  ok(structuredIds.includes(id), `nothing set → "${id}" is raised`);
}
for (const s of bare.structured) {
  ok(/\?/.test(s.question), `"${s.id}" is asked as a question, not asserted as a fact`);
  ok(Boolean(s.href), `"${s.id}" names the screen that actually holds it`);
  ok(!bareNote.includes(s.question), `"${s.id}" is NOT drafted into the note — it belongs in a column`);
}
ok(!/\d/.test(bareNote), "a company with nothing filled in still drafts a digit-free note");
ok(
  !/open|closed|hours/i.test(bareNote),
  "and nothing that could be read as an opening-hours statement",
);
ok(
  !bare.questions.some((q) => q.id === "closed"),
  "with no hours set, 'what happens when you're shut' is not asked — the structured fix comes first",
);
ok(
  !bare.questions.some((q) => q.id === "outsideArea"),
  "and with no work areas, 'what about outside your area' has nothing to mean",
);

// ══ 5. The owner's own words switch questions OFF ══════════════════════════
//
// The real note on the real account is exactly this sentence. Re-asking
// somebody what they already told you is how a helpful screen becomes noise.

const answered = gapsFor({
  company: COMPANY,
  services: SERVICES,
  areas: AREAS,
  hasHours: true,
  canBook: true,
  notes: "we don't do commercial work.",
  text: text("en"),
});
ok(
  !answered.questions.some((q) => q.id === "audience"),
  '"we don\'t do commercial work." answers the audience question, so it is not asked again',
);
ok(
  answered.questions.length < full.questions.length,
  "and the list is shorter than it was for a company that said nothing",
);
// A note that is still all brackets has answered nothing.
const stillBlank = gapsFor({
  company: COMPANY, services: SERVICES, areas: AREAS,
  hasHours: true, canBook: true, notes: fullNote, text: text("en"),
});
ok(
  stillBlank.questions.length === full.questions.length,
  "an unedited draft in the box does NOT count as having answered anything",
);

// ══ 6. Trade questions, seeded from the company's own quote content ════════

const roofing = tradeGaps([
  { key: "roofing_service", label: "Roofing", content: resolveServiceContent("roofing_service", null, null) },
]);
ok(roofing.length > 0, `roofing has ${roofing.length} question(s) drawn from what its quotes already say`);
for (const q of roofing) {
  ok(!forbiddenIn(q.question), `trade question carries no ${forbiddenIn(q.question) || "figure"}`);
  ok(
    !q.question.toLowerCase().includes("roofing"),
    "the trade NAME stays out of the question — it is a copy of a row that can be switched off tomorrow",
  );
  ok(q.forService === "Roofing", "the trade travels alongside as a label the screen can show");
}

// A mayChange title carrying a count must be dropped, not smuggled through.
const numeric = tradeGaps([
  {
    key: "x",
    label: "X",
    content: { mayChange: [{ title: "A 2nd layer underneath" }, { title: "The weather" }] },
  },
]);
ok(
  !numeric.some((q) => /\d/.test(q.question)),
  "a trade whose wording carries a figure is dropped rather than drafted",
);
ok(numeric.length === 1, "and the clean one beside it still comes through");

// A trade whose topic happens to be a service name is filtered at assembly.
const echoing = gapsFor({
  company: COMPANY, services: SERVICES, areas: AREAS, hasHours: true, canBook: true, notes: "",
  text: text("en"),
  trades: [{ id: "trade:x:y", kind: "note", question: "Callers ask about siding. What should we say?", forService: "Siding" }],
});
ok(
  !echoing.questions.some((q) => q.id === "trade:x:y"),
  "a derived question that echoes a service name is dropped at assembly",
);

// ══ 7. What the model is allowed to change, and what it isn't ══════════════

const base = { questions: full.questions, structured: full.structured };

const invented = mergeDraft(base, { use: ["audience", "makeUpAPrice", "yearsInBusiness"], wording: {} }, {
  services: SERVICES,
  areas: AREAS,
});
ok(invented.length === 1, "an id the model invented has nowhere to land and is dropped");
ok(invented[0].id === "audience", "only ids from our own closed list survive");

const hostile = mergeDraft(
  base,
  {
    use: ["audience", "urgent", "sound"],
    wording: {
      // A price, a duration, and a service name — one of each failure.
      audience: "Do you charge $200 for a callout on a commercial job?",
      urgent: "Can you be there within 2 hours?",
      sound: "Should Roofing callers get a different tone?",
    },
  },
  { services: SERVICES, areas: AREAS },
);
ok(hostile.length === 3, "all three ids are real, so all three come back");
for (const q of hostile) {
  ok(q.reworded === false, `"${q.id}": the model's wording was rejected and the catalogue's kept`);
  ok(!forbiddenIn(q.question), `"${q.id}": what survives carries no figure, date, duration or guarantee`);
}
ok(
  !draftNote(hostile).includes("$"),
  "and none of it reaches the note — a price in the note is a price the phone is holding",
);

// Good wording IS taken. The model has to be able to do its job.
const good = mergeDraft(
  base,
  { use: ["audience"], wording: { audience: "Do you take on work for landlords, or just people in their own place?" } },
  { services: SERVICES, areas: AREAS },
);
ok(good[0].reworded === true, "wording that breaks no rule is used as written");
ok(good[0].question.includes("landlords"), `and it is the model's sentence: "${good[0].question}"`);

// ══ 8. No AI at all still produces something usable ════════════════════════

const offline = await draftKnowledge({
  company: COMPANY,
  services: SERVICES,
  areas: AREAS,
  hasHours: true,
  canBook: true,
  notes: "",
  language: "en",
  text: text("en"),
  skipModel: true,
});
ok(offline.generated === false, "with no model the result says so out loud rather than implying one wrote it");
ok(offline.questions.length >= 4, `and it still asks ${offline.questions.length} real questions`);
ok(offline.note.trim().length > 0, "the note is not empty");
ok(usableNotes(offline.note).text === "", "and it is still entirely unanswered, so it still reaches nobody");
ok(!forbiddenIn(offline.note), "the offline note is as clean as the generated one");

const offlineFr = await draftKnowledge({
  company: COMPANY, services: SERVICES, areas: AREAS, hasHours: true, canBook: true,
  notes: "", language: "fr", text: text("fr"), skipModel: true,
});
ok(
  offlineFr.note !== offline.note && offlineFr.note.length > 0,
  "a French company gets the French catalogue, not an English screen",
);
ok(!forbiddenIn(offlineFr.note), "and the French wording is held to the same rule");

// A company that has answered everything gets told so rather than handed a box.
const nothingLeft = await draftKnowledge({
  company: COMPANY,
  services: [],
  areas: [],
  hasHours: false,
  canBook: false,
  // Every note gap that applies with nothing set, answered at once.
  notes:
    "We work for homeowners, never commercial. A leak is urgent, ring Dave straight back. " +
    "Ask for Dave. We come and look at the job first. Be friendly and plain.",
  language: "en",
  text: text("en"),
  skipModel: true,
});
ok(
  nothingLeft.questions.length === 0,
  "a note that covers everything produces no questions at all, not filler",
);
ok(nothingLeft.note === "", "and an empty note rather than an empty box of brackets");
ok(
  nothingLeft.structured.length > 0,
  "while the structured gaps are still raised — they cannot be answered in prose",
);

// ══ 9. The stuck-number banner's copy ══════════════════════════════════════
//
// lib/voice/diagnose.js decides the truth; lib/voice/diagnosisCopy.js decides
// the sentence, and the sentence is the half that can be wrong silently. Two
// failures neither a build nor a screenshot catches: a verdict the banner
// renders with no wording behind it (an empty amber box), and — the one that
// caused this work — money copy printed against a verdict that has no money.

const RENDERED = Object.keys(DIAGNOSIS_TONE);
const SILENT = Object.keys(NUMBER_VERDICTS).filter((v) => !RENDERED.includes(v));

for (const v of RENDERED) {
  ok(v in NUMBER_VERDICTS, `banner verdict "${v}" is a verdict the diagnosis can actually return`);
  ok(Boolean(DIAGNOSIS_TEXT[v]), `"${v}" has an English sentence rather than an empty banner`);
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
    ok(Boolean(APP_MESSAGES[lang]?.[diagnosisKey(v)]), `${lang}: ${diagnosisKey(v)} exists`);
  }
}
ok(
  SILENT.sort().join(",") === "no_number,not_configured,ok,porting",
  `the four silent verdicts are exactly the ones with somewhere else to live (${SILENT.join(", ")})`,
);

// Alarm only where something is actually wrong. A `company`-side verdict is the
// system doing what it was told, and amber there tells somebody their own
// decision is broken.
for (const v of RENDERED) {
  const meta = NUMBER_VERDICTS[v];
  if (meta.side === "company") {
    ok(DIAGNOSIS_TONE[v] === "info", `"${v}" is a company setting, not a fault — rendered calmly`);
    ok(!meta.repairable, `and "${v}" offers no Fix button, which would override their own choice`);
  }
}
ok(DIAGNOSIS_TONE.provider_unreachable === "info", "not being able to look is not an alarm");
ok(
  !NUMBER_VERDICTS.provider_unreachable.repairable,
  "and it offers no repair — we have observed nothing to repair",
);

// The sentence that started all this. `ghost` is a purchase that never
// happened: nothing exists at the provider and nobody is renting anything, so
// the copy must not tell them they are paying for it.
ok(NUMBER_VERDICTS.ghost.billing === false, "a ghost number is not billed for");
for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
  const s = APP_MESSAGES[lang][diagnosisKey("ghost")];
  ok(
    !/already yours|already being charged|déjà à vous|déjà facturé/i.test(s),
    `${lang}: the ghost sentence never claims they own it and are being charged for it`,
  );
}
ok(
  /not|nothing|rien|nada|нічого|ਨਹੀਂ|walang/i.test(APP_MESSAGES.en["app.setVoice.diag.billingNo"]),
  "the not-billed sentence is a denial, not a hedge",
);

// Every side the verdict table can produce has wording behind it.
for (const side of [...new Set(Object.values(NUMBER_VERDICTS).map((m) => m.side))]) {
  if (!side) continue;
  ok(Boolean(SIDE_TEXT[side]), `side "${side}" has an English sentence`);
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
    ok(Boolean(APP_MESSAGES[lang]?.[sideKey(side)]), `${lang}: ${sideKey(side)} exists`);
  }
}

// The controls and outcomes. `notRepaired` and `before` are what stop a Fix
// button reporting success over a phone that is still silent.
for (const key of [
  "app.setVoice.diag.fix",
  "app.setVoice.diag.recheck",
  "app.setVoice.diag.checking",
  "app.setVoice.diag.repaired",
  "app.setVoice.diag.notRepaired",
  "app.setVoice.diag.before",
  "app.setVoice.diag.error",
  "app.setVoice.diag.billingYes",
  "app.setVoice.diag.billingNo",
  "app.setVoice.emailUs",
  "app.setVoice.numberBusy.ghost",
  "app.setVoice.numberBusy.stuck",
]) {
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
    ok(Boolean(APP_MESSAGES[lang]?.[key]), `${lang}: ${key} exists`);
  }
}

// The dead sentence is gone from the catalogue as well as from the code —
// a key nobody renders is the next thing somebody renders by accident.
ok(
  !("app.setVoice.numberStuck" in APP_MESSAGES.en),
  "the old fixed 'already yours and already being charged' string is deleted, not orphaned",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
