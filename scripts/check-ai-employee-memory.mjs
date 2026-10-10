// scripts/check-ai-employee-memory.mjs
//
//   npm run check:ai-employee-memory
//
// "It should not ask for information that the client has already provided"
// (owner, 2026-10-10). TrueFinish's receptionist asked Tony three times for
// "the best phone number for you and the job address" — both of which he had
// typed into the same Messenger thread in July, and both of which were on the
// lead the thread is linked to (lib/aiEmployee/threadMemory.js has the root
// cause).
//
// This replays a Tony-shaped thread through the REAL responder
// (lib/aiEmployee/respond.js respondToMessage) with a scripted database and a
// scripted model that behaves the way the real one did: it confirms a phone
// and an address only if they are somewhere in what it was given, and asks
// for them otherwise. Then it asserts on what the model was handed and what
// the employee did with it.
import { respondToMessage } from "../lib/aiEmployee/respond.js";
import {
  shapeOnFile,
  onFileCardText,
  withOnFile,
  earlierConversationText,
  phoneSaid,
  addressSaid,
  emailSaid,
  missingForBooking,
  HISTORY_LIMIT,
  ON_FILE_RULES,
  PARTIAL_ANSWER_RULE,
} from "../lib/aiEmployee/threadMemory.js";
import { buildEmployeePrompt } from "../lib/aiEmployee/roles.js";
import { definitionsForRole, executeFor } from "../lib/aiEmployee/tools.js";

let passed = 0;
let failed = 0;
const ok = (name, cond, extra) => {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 400));
  }
};

// ── A scripted Prisma: equality, in, not, gte/gt/lte/lt, nested relation ────
function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    const val = row[k];
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      const ops = ["in", "not", "gte", "gt", "lte", "lt"];
      if ("in" in v && !v.in.includes(val)) return false;
      if ("not" in v && (v.not === null ? val == null : val === v.not)) return false;
      if ("gte" in v && !(new Date(val) >= new Date(v.gte))) return false;
      if ("gt" in v && !(new Date(val) > new Date(v.gt))) return false;
      if ("lte" in v && !(new Date(val) <= new Date(v.lte))) return false;
      if ("lt" in v && !(new Date(val) < new Date(v.lt))) return false;
      if (!ops.some((o) => o in v) && !matches(val || {}, v)) return false;
      continue;
    }
    if (val !== v) return false;
  }
  return true;
}
function sortBy(rows, orderBy) {
  if (!orderBy || Array.isArray(orderBy)) return rows;
  const [[k, dir]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => (new Date(a[k]) - new Date(b[k])) * (dir === "desc" ? -1 : 1));
}
let seq = 0;
function makeDb(seed) {
  const store = {
    aiEmployee: [], messageThread: [], message: [], aiEmployeeReply: [], aiEmployeeRoutingEvent: [], aiEmployeeSource: [],
    aiEmployeeProposal: [], company: [], aiFeaturePayer: [], leadRequest: [], client: [], clientEquipment: [], job: [],
    voiceCreditEntry: [{ id: "credit", companyId: "C1", pool: "ai", kind: "ai_topup", cents: 10_000 }],
    ...seed,
  };
  const reads = [];
  const model = (name) => ({
    findMany: async ({ where, orderBy, take } = {}) => { reads.push({ name, where }); const r = sortBy(store[name].filter((x) => matches(x, where)), orderBy); return take ? r.slice(0, take) : r; },
    findFirst: async ({ where, orderBy } = {}) => { reads.push({ name, where }); return sortBy(store[name].filter((x) => matches(x, where)), orderBy)[0] || null; },
    findUnique: async ({ where } = {}) => { reads.push({ name, where }); return store[name].find((x) => matches(x, where)) || null; },
    count: async ({ where } = {}) => store[name].filter((x) => matches(x, where)).length,
    create: async ({ data }) => { const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...data }; store[name].push(row); return row; },
    update: async ({ where, data }) => { const row = store[name].find((x) => matches(x, where)); if (!row) throw new Error(`no ${name}`); Object.assign(row, data); return row; },
    updateMany: async ({ where, data }) => { const rows = store[name].filter((x) => matches(x, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    aggregate: async ({ where, _sum = {} } = {}) => {
      const rows = store[name].filter((x) => matches(x, where));
      return { _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) };
    },
  });
  const db = { $store: store, $reads: reads };
  for (const name of Object.keys(store)) db[name] = model(name);
  return db;
}

// ── The Tony-shaped thread ──────────────────────────────────────────────────
//
// The real thread's shape (read-only from production, 2026-10-10): imported
// July history in which the address is 25 messages and the phone 19 messages
// before the October question, with Meta's own system lines in between.
const PHONE = "613-262-7407";
const ADDRESS = "29 Rialto way";
const EMAIL = "tonytohme@ymail.com";
const FOREIGN = { phone: "555-000-9999", address: "1 Foreign Street", email: "other@tenant.example", name: "Other Tenant Person", secret: "C2-PRIVATE-NOTE" };
const july = (min) => new Date(Date.UTC(2026, 6, 16, 23, min));
let mseq = 0;
const msg = (threadId, direction, body, sentAt, extra = {}) => ({ id: `m${++mseq}`, threadId, direction, private: false, body, sentAt, attachments: null, failedReason: null, sentByUserId: null, imported: true, ...extra });
const history = [
  ["out", "Tony Tohme replied to an ad."], ["out", "Hi Tony! Please let us know how we can help you."], ["in", "I would like to get a Free Quote"],
  ["out", "Your AI agent will respond."], ["out", "How many drawers and doors do you have?"], ["in", "I would like an in person quote if possible."],
  ["out", "We can definitely come by for an in-person quote."], ["out", "You took over this chat from your AI agent."], ["out", "Are you available tomorrow in the evening?"],
  ["out", "Where do you live?"], ["in", `${ADDRESS}. Are you able to match the paint color and style`], ["out", "I can yes how many doors and drawers?"],
  ["out", "You can give me a quick call."], ["in", "22 closets and 15 drawers."], ["out", "What time on Monday are you available?"],
  ["in", ""], ["in", "Monday afternoons"], ["out", "I have fixed doors with more extensive damage."], ["out", "I can be at your home on Monday at 2pm?"],
  ["in", ""], ["in", `${PHONE}. Please text before just a heads up`], ["out", "Auto-label added: Lead stage set to intake."], ["out", "Perfect"],
  ["out", "See you on Monday Tony."], ["in", ""], ["in", "I'm gonna need to reschedule. I'll get in touch when I'm back."],
  ["out", "Your AI agent will respond."], ["out", "No problem, Tony!"], ["out", "Your AI agent transferred this chat to you."], ["in", ""],
  ["out", "Hello Tony how are you? Do you still need your kitchen cabinets refinished?"],
].map(([d, b], i) => msg("th1", d, b, july(i)));

const T0 = new Date("2026-10-10T01:52:30Z");
const company = { id: "C1", name: "Acme Cabinets", phone: null, businessHours: null, timezone: "America/Toronto", defaultLanguage: "en" };
const employee = { id: "E1", companyId: "C1", role: "receptionist", name: "Jessica", displayName: "Jessica", enabled: true, mode: "accept_edits", maxRepliesPerThread: 4, businessHoursOnly: false, disabledTools: [], metaEnabled: true, intents: [], instructionsFingerprint: "f", createdAt: new Date("2026-01-01") };
const thread = (over = {}) => ({
  id: "th1", companyId: "C1", status: "open", participantName: "Tony Tohme", participantExternalId: "psid-tony", channel: { platform: "facebook" },
  lastInboundAt: T0, assignedEmployeeId: null, routingIntent: null, routingReason: null, humanTookOverAt: null,
  clientId: null, leadId: "L1", leadCapture: { leadId: "L1", contacts: { phone: PHONE, email: EMAIL, address: ADDRESS } }, ...over,
});
const lead = { id: "L1", companyId: "C1", name: "Tony Tohme", phone: PHONE, email: EMAIL, intake: { address: ADDRESS }, source: "meta_messenger" };
// Another company's rows, placed where a careless read would find them.
const foreign = {
  lead: { id: "L2", companyId: "C2", name: FOREIGN.name, phone: FOREIGN.phone, email: FOREIGN.email, intake: { address: FOREIGN.address } },
  client: { id: "K2", companyId: "C2", name: FOREIGN.name, type: "individual", phone: FOREIGN.phone, email: FOREIGN.email, address: FOREIGN.address, city: "Elsewhere" },
  thread: { ...thread(), id: "th2", companyId: "C2", leadId: "L2", participantName: FOREIGN.name, leadCapture: null },
  message: msg("th2", "in", `${FOREIGN.secret} ${FOREIGN.phone} ${FOREIGN.address}`, new Date("2026-10-10T01:00:00Z"), { imported: false }),
};

/**
 * The scripted model. It behaves like the real one on 2026-10-10: it knows a
 * detail only if the detail is in what it was handed (the system prompt or
 * the chat turns). Turn by turn:
 *   - "are you free" → offers times;
 *   - a picked time → confirms what it can see, or asks for what it cannot;
 *   - "yes" → books, leaving the confirmed details out of the call.
 */
function scriptedModel(log) {
  return async ({ system, messages, tools, execute, onUsage }) => {
    const seen = `${system}\n${messages.map((m) => m.content).join("\n")}`;
    const last = String(messages[messages.length - 1]?.content || "");
    log.push({ system, messages, tools: tools.map((t) => t.name) });
    onUsage?.({ model: "gpt-scripted", promptTokens: 100, completionTokens: 20 });
    const knowsPhone = seen.includes(PHONE);
    const knowsAddress = seen.includes(ADDRESS);
    if (/free tomorrow/i.test(last)) return { text: "Yes — Saturday at 8:00, 8:30 or 9:00 AM. Which suits you?" };
    if (/830|8:30/.test(last)) {
      if (knowsPhone && knowsAddress) return { text: `Saturday at 8:30 AM works. I have ${PHONE} and ${ADDRESS} — is that still right?` };
      return { text: "Saturday at 8:30 AM is available. Please send the best phone number for you and the job address." };
    }
    if (/^yes/i.test(last)) {
      const result = await execute("book_appointment", { slot_id: `abc123_${Date.UTC(2026, 9, 10, 12, 30)}`, reason: "Free in-person quote, kitchen cabinets", mode: "visit" });
      return { text: result?.proposed ? "Thanks Tony — someone from the team will confirm Saturday 8:30 shortly." : "Booked." };
    }
    return { text: "Thanks!" };
  };
}

async function turn(db, log, body, at) {
  const m = msg("th1", "in", body, at, { imported: false });
  db.$store.message.push(m);
  db.$store.messageThread.find((t) => t.id === "th1").lastInboundAt = at;
  const send = async (text) => {
    db.$store.message.push(msg("th1", "out", text, new Date(at.getTime() + 5000), { imported: false }));
    return { ok: true, externalId: `x${mseq}` };
  };
  return respondToMessage({
    companyId: "C1", threadId: "th1", messageId: m.id, channel: "meta", send,
    deps: {
      db, now: new Date("2026-10-15T12:00:00Z"),
      checkAiQuota: async () => ({ allowed: true }), recordAiUsage: async () => {}, isAiConfigured: () => true,
      notify: async () => {}, sleep: async () => {}, recordError: async () => {},
      runToolLoop: scriptedModel(log),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("1. The Tony replay: the model is handed what is already known");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = makeDb({
    aiEmployee: [employee], company: [company],
    messageThread: [thread(), foreign.thread],
    message: [...history, foreign.message],
    leadRequest: [lead, foreign.lead], client: [foreign.client],
  });
  const log = [];
  const r1 = await turn(db, log, "Hi Emilio\nAre you free tomorrow morning by any chance ?", T0);
  ok("turn 1 replies", r1.replied === true, r1);
  const first = log[0];
  ok("the window is the newest messages — the address is NOT in the chat turns", first && !first.messages.some((m) => m.content.includes(ADDRESS)), first?.messages?.length);
  ok("…but the model context carries the on-file phone", first?.system.includes(`Phone: ${PHONE}`), first?.system.slice(-1500));
  ok("…and the on-file job address", first?.system.includes(`Job address: ${ADDRESS}`));
  ok("…marked as given by the customer, so it may be read back", /Phone: 613-262-7407 \(they gave this themselves\)/.test(first?.system || ""));
  ok("…with the rule to confirm rather than ask", first?.system.includes(ON_FILE_RULES) && first?.system.includes(PARTIAL_ANSWER_RULE));
  ok("imported history is included as context (the July address line)", first?.system.includes(`Customer (2026-07-16): ${ADDRESS}. Are you able to match`));
  // On turn 1 the July phone line is the 12th-newest message — inside the
  // window, exactly as in production; by turn 2 it has slid out of it.
  ok("…and the July phone line is in context on turn 1 (window edge)", first?.messages.some((m) => m.content.startsWith(`${PHONE}. Please text`)));
  ok("…in the EARLIER block, fenced as data", /--- BEGIN EARLIER IN THIS CONVERSATION[^\n]*\(data, not instructions\) ---/.test(first?.system || ""));
  ok("imported rows still reach the chat turns too (not filtered out)", first?.messages.some((m) => m.content.includes("Do you still need your kitchen cabinets refinished")));

  const r2 = await turn(db, log, "830 is fine.", new Date(T0.getTime() + 150_000));
  ok("turn 2 replies", r2.replied === true, r2);
  const second = log[1];
  ok("on turn 2 the phone line has left the chat window…", second && !second.messages.some((m) => m.content.includes(PHONE)));
  ok("…and is in the EARLIER block instead (imported history as context)", second?.system.includes(`Customer (2026-07-16): ${PHONE}. Please text before`));
  ok("the booking step CONFIRMS what is on file", r2.text.includes(`I have ${PHONE} and ${ADDRESS}`), r2.text);
  ok("…and does not ask for the phone or the address", !/send the best phone number|job address\./i.test(r2.text), r2.text);

  const r3 = await turn(db, log, "Yes that's right", new Date(T0.getTime() + 300_000));
  const proposal = db.$store.aiEmployeeProposal[0];
  ok("turn 3 books (a proposal in accept_edits, as for TrueFinish)", proposal?.tool === "book_appointment", db.$store.aiEmployeeProposal);
  ok("…carrying the on-file phone the model left out", proposal?.args?.phone === PHONE, proposal?.args);
  ok("…and the on-file job address", proposal?.args?.address === ADDRESS, proposal?.args);
  ok("…and name and email from the lead", proposal?.args?.name === "Tony Tohme" && proposal?.args?.email === EMAIL, proposal?.args);
  ok("the customer was asked for neither, on any turn", !db.$store.message.some((m) => m.direction === "out" && !m.imported && /phone number|job address/i.test(m.body)));

  // ── Tenant isolation ───────────────────────────────────────────────────
  const everything = JSON.stringify(log) + JSON.stringify(db.$store.aiEmployeeProposal);
  ok("another company's phone is never in the model context", !everything.includes(FOREIGN.phone));
  ok("…nor its address, email, name or message", ![FOREIGN.address, FOREIGN.email, FOREIGN.name, FOREIGN.secret].some((s) => everything.includes(s)));
  const leadReads = db.$reads.filter((r) => r.name === "leadRequest" || r.name === "client");
  ok("every lead/client read is under this company", leadReads.length > 0 && leadReads.every((r) => r.where?.companyId === "C1"), leadReads);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("2. A thread pointing at ANOTHER company's lead and client");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = makeDb({
    aiEmployee: [employee], company: [company],
    messageThread: [thread({ leadId: "L2", clientId: "K2", leadCapture: null, participantName: "Sam" }), foreign.thread],
    message: [msg("th1", "in", "Hello", new Date(T0.getTime() - 60_000)), foreign.message],
    leadRequest: [lead, foreign.lead], client: [foreign.client],
  });
  const log = [];
  await turn(db, log, "Are you free tomorrow morning?", T0);
  const all = JSON.stringify(log);
  ok("a foreign leadId on the thread loads nothing", log.length === 1 && !all.includes(FOREIGN.phone) && !all.includes(FOREIGN.address) && !all.includes(FOREIGN.email), log[0]?.system?.slice(-800));
  ok("…and the card says the phone is not on file", /Not on file: phone, job address\./.test(log[0]?.system || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("3. Said here, or only on file");
// ═══════════════════════════════════════════════════════════════════════════
{
  const texts = [`${ADDRESS}. Are you able`, `${PHONE}. Please text`];
  ok("a phone typed with dashes matches the record's +1 form", phoneSaid("+16132627407", texts) && phoneSaid(PHONE, ["call me on (613) 262 7407"]));
  ok("…a different number does not", !phoneSaid("613-262-7408", texts));
  ok("an address matches case- and punctuation-insensitively", addressSaid("29 Rialto Way, Ottawa", texts) && !addressSaid("31 Rialto Way", texts));
  ok("an email matches whole, and only whole", emailSaid(EMAIL, [`it's ${EMAIL.toUpperCase()}`]) && !emailSaid("tonytohme@gmail.com", [EMAIL]));
  // A client matched from a typed email: the record's values are NOT read out.
  const matched = shapeOnFile({ client: { id: "K1", type: "individual", name: "Pat Jones", phone: "613-555-0100", email: "pat@example.com", address: "7 Hidden Lane" }, participantName: "Visitor", inboundTexts: ["my email is pat@example.com"] });
  const card = onFileCardText(matched);
  ok("a record value they did not say is not printed", !card.includes("613-555-0100") && !card.includes("7 Hidden Lane") && !card.includes("Pat Jones"), card);
  ok("…it is described as on file, not to be read out", /Phone: on file, but not given in this conversation — do not read it out/.test(card));
  ok("…while the email they typed is printed", card.includes("Email: pat@example.com (they gave this themselves)"));
  ok("…and the booking still gets the record's number, server-side", withOnFile("book_appointment", { slot_id: "s" }, matched).phone === "613-555-0100");
  ok("a company client's office is not offered as the job address", shapeOnFile({ client: { id: "K", type: "company", name: "GC Inc", contactName: "Lee", address: "1 Office Park" } }).address === null);
  ok("an SMS thread's own number counts as said", shapeOnFile({ smsNumber: "+16135550100", inboundTexts: [] })?.phone?.said === true);
  ok("nothing on file → no card at all (the prompt is unchanged)", shapeOnFile({}) === null && onFileCardText(null) === null);
  ok("precedence: client, then lead, then the conversation's capture", shapeOnFile({ client: { id: "K", type: "individual", phone: "111-111-1111" }, lead: { phone: "222-222-2222" }, capture: { contacts: { phone: "333-333-3333" } } }).phone.source === "client" && shapeOnFile({ lead: { phone: "222-222-2222" }, capture: { contacts: { phone: "333-333-3333" } } }).phone.source === "lead");
  ok("missingForBooking names only what is missing", missingForBooking(shapeOnFile({ lead: { name: "T", phone: PHONE } })).join() === "address" && missingForBooking(null).join() === "name,phone,address");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("4. A partial answer: an email when the phone was asked for");
// ═══════════════════════════════════════════════════════════════════════════
{
  const filled = withOnFile("book_appointment", { slot_id: "s", phone: "819-000-1111" }, shapeOnFile({ lead: { name: "T", phone: PHONE, intake: { address: ADDRESS } } }));
  ok("what the model supplied (a correction) wins over the record", filled.phone === "819-000-1111" && filled.address === ADDRESS);
  ok("only the two booking tools are filled", withOnFile("hand_off_to_human", { reason: "x" }, shapeOnFile({ lead: { phone: PHONE } })).phone === undefined);
  // No phone anywhere: the tool refuses BY NAME and says how to proceed, so
  // the model asks once, keeps the email, and never loops.
  const results = [];
  const run = executeFor({ companyId: "C1", role: "receptionist", mode: "auto", context: { onFile: shapeOnFile({ participantName: "Tony", inboundTexts: [EMAIL], capture: { contacts: { email: EMAIL } } }) }, onTool: (x) => results.push(x) });
  const out = await run("book_appointment", { slot_id: "abc123_1", email: EMAIL });
  ok("no phone on file or given → no_phone, never a booking", out.ok === false && out.reason === "no_phone", out);
  ok("…which tells the model to ask ONCE, keep the email, and fall back", /Ask once/.test(out.say) && /email instead, keep it/.test(out.say) && /book_callback/.test(out.say), out.say);
  const card = onFileCardText(shapeOnFile({ participantName: "Tony", inboundTexts: [EMAIL], capture: { contacts: { email: EMAIL } } }));
  ok("the card shows the email they gave and names the phone as missing", card.includes(`Email: ${EMAIL} (they gave this themselves)`) && /Not on file: phone, job address\./.test(card), card);
  ok("the partial-answer rule forbids a third ask", /do not ask a third\s+time/.test(PARTIAL_ANSWER_RULE) && /Never repeat a question they\s+have already answered/.test(PARTIAL_ANSWER_RULE));
  const def = definitionsForRole("receptionist").find((d) => d.name === "book_appointment");
  ok("book_appointment no longer REQUIRES a phone the model would have to obtain or invent", JSON.stringify(def.input_schema.required) === JSON.stringify(["slot_id"]), def.input_schema.required);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("5. The earlier block, and prompts with nothing to add");
// ═══════════════════════════════════════════════════════════════════════════
{
  const many = Array.from({ length: 60 }, (_, i) => ({ direction: i % 2 ? "out" : "in", body: `${i % 2 ? "business" : "customer"} line ${i} `.repeat(20), sentAt: new Date(Date.UTC(2026, 6, 1, 0, i)) }));
  const text = earlierConversationText(many, { maxChars: 2000 });
  ok("the block keeps to its budget", text.length <= 2000, text.length);
  ok("…dropping the business's lines before the customer's", !/^Business/m.test(text) && /^Customer/m.test(text));
  ok("…oldest first", text.indexOf("customer line 58") > text.indexOf("customer line 40") || !text.includes("customer line 40"));
  ok("failed and empty rows are not context", earlierConversationText([{ direction: "out", body: "x", failedReason: "e", sentAt: new Date() }, { direction: "in", body: "  ", sentAt: new Date() }]) === null);
  ok("notes and activity are never context", earlierConversationText([{ direction: "note", body: "private", sentAt: new Date() }, { direction: "activity", body: "a", sentAt: new Date() }]) === null);
  ok("the window is still twelve chat turns", HISTORY_LIMIT === 12);
  const base = { employee: { role: "receptionist", tone: "friendly" }, company: { name: "Acme" } };
  ok("no card and no earlier history → the prompt is byte-identical to before", buildEmployeePrompt(base) === buildEmployeePrompt({ ...base, onFileCard: null, earlier: null }) && !buildEmployeePrompt(base).includes("ON FILE"));
}

console.log(`\ncheck-ai-employee-memory: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
