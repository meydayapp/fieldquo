// scripts/check-sales-reply-triage.mjs
//
//   npm run check:sales-reply-triage
//
// AI triage of a prospect's text reply — executed, not read.
//
// ══ What is being proved ══════════════════════════════════════════════════
//
// The owner's ask: "just in case we lose them on a roadblock". Every inbound
// text to FieldQuo's sales number gets a kind (roadblock / question /
// positive / not_interested / stop / fine), the Texts list shows a chip, and
// a roadblock nobody answered is listed until somebody does. Five things
// have to be true for that to be worth anything, and each is driven here
// against a stub — a scripted vendor, a fake Prisma client — rather than
// asserted from prose:
//
//   §1  the pre-rules decide what a keyword decides, and NOTHING else. STOP
//       is "stop" without a model; "please stop by at 3" is not a STOP; "ok"
//       costs nothing; an empty body is left null, not called fine.
//   §2  the model path: a strict-valid schema, the vendor's answer accepted
//       when it is one of ours, refused when it is not (a "stop" from a
//       misbehaving provider must not label a row the suppression never
//       saw), metered on the platform ledger before any decision about the
//       content, and NEVER a throw — a vendor that explodes leaves null.
//   §3  STOP precedence end to end: handleSalesInboundSms writes the
//       suppression, stores the row, schedules the triage; the triage files
//       "stop" from the keyword and the suppression is untouched by it. A
//       rep's override is honoured by the next automatic pass.
//   §4  the list arithmetic: a thread's chip is its latest reply's; an
//       answered roadblock is not open; roadblocks before questions, newest
//       first; the db-backed reader returns the same.
//   §5  the wiring: the webhook hands next/server's after(); the screen has
//       the chip, the filter and the dropdown; the console's Tasks tab and
//       the cron's report read the same helper; every key in every language.
//
// ══ Rules for reading this file ═══════════════════════════════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed.
// Every source read for a regex is decommented first — this repository
// explains at length, in prose, what each file must not do, and a check
// satisfied by a comment about the rule is no check.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// The fake database. Installed BEFORE lib/db is imported (lib/db.js reads
// globalThis.__prisma outside production), the same trick check-sales-sms
// uses, so lib/sales/salesSms.js can be driven whole.
// ═══════════════════════════════════════════════════════════════════════════

let seq = 0;
const id = () => `id${++seq}`;
const store = {
  numbers: [],
  leads: new Map(),
  smsMessages: [],
  suppressions: [],
  suppressionEvents: [],
  errors: [],
  aiUsage: [],
  aiBudgets: [],
};
function resetStore() {
  store.numbers.length = 0;
  store.leads.clear();
  store.smsMessages.length = 0;
  store.suppressions.length = 0;
  store.suppressionEvents.length = 0;
  store.errors.length = 0;
  store.aiUsage.length = 0;
  store.aiBudgets.length = 0;
}
const matches = (row, where) =>
  Object.entries(where || {}).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(row[k]);
      if ("notIn" in v) return !v.notIn.includes(row[k]);
      if ("not" in v) return row[k] !== v.not;
    }
    return row[k] === v;
  });
const bySentDesc = (a, b) => new Date(b.sentAt) - new Date(a.sentAt);

const fakeDb = {
  platformSmsNumber: {
    findFirst: async ({ where }) =>
      store.numbers.find((n) => (where.e164 === undefined || n.e164 === where.e164) && n.purpose === where.purpose && n.active) || null,
  },
  salesLead: {
    findFirst: async () => [...store.leads.values()][0] || null,
  },
  salesSmsMessage: {
    create: async ({ data }) => {
      const row = { id: id(), sentAt: data.sentAt || new Date(), triage: null, triageReason: null, triagedAt: null, triageModel: null, triageOverriddenById: null, ...data };
      store.smsMessages.push(row);
      return row;
    },
    findFirst: async ({ where }) => store.smsMessages.filter((m) => matches(m, where)).sort(bySentDesc)[0] || null,
    findUnique: async ({ where }) => {
      const row = store.smsMessages.find((m) => m.id === where.id) || null;
      if (!row) return null;
      const lead = row.leadId ? store.leads.get(row.leadId) || null : null;
      return { ...row, salesRep: row.salesRepId ? { language: store.repLanguage || null } : null, lead: lead ? { businessName: lead.businessName, contactName: lead.contactName, province: lead.province } : null };
    },
    findMany: async ({ where, take }) =>
      store.smsMessages
        .filter((m) => matches(m, where))
        .sort(bySentDesc)
        .slice(0, take || 1000)
        .map((m) => ({ ...m, lead: m.leadId && store.leads.get(m.leadId) ? { businessName: store.leads.get(m.leadId).businessName, contactName: null } : null })),
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const m of store.smsMessages) {
        if (!matches(m, where)) continue;
        Object.assign(m, data);
        count++;
      }
      return { count };
    },
  },
  salesSuppression: {
    findMany: async ({ where }) => store.suppressions.filter((r) => (where?.OR || []).some((k) => k.kind === r.kind && k.value === r.value)),
    findUnique: async ({ where }) => store.suppressions.find((r) => r.kind === where.kind_value.kind && r.value === where.kind_value.value) || null,
    upsert: async ({ where, create, update }) => {
      const found = store.suppressions.find((r) => r.kind === where.kind_value.kind && r.value === where.kind_value.value);
      if (found) { Object.assign(found, update); return found; }
      const row = { id: id(), ...create };
      store.suppressions.push(row);
      return row;
    },
  },
  salesSuppressionEvent: { create: async ({ data }) => { store.suppressionEvents.push(data); return { id: id(), ...data }; } },
  platformErrorLog: { create: async ({ data }) => { store.errors.push(data); return { id: id(), ...data }; } },
  // suppress() runs inside a transaction; the stub hands itself back.
  $transaction: async (fn) => (typeof fn === "function" ? fn(fakeDb) : Promise.all(fn)),
  platformAiBudget: { findMany: async () => store.aiBudgets },
  platformAiUsage: {
    create: async ({ data }) => { store.aiUsage.push(data); return { id: id(), ...data }; },
    findUnique: async ({ where }) => store.aiUsage.find((u) => u.ref === where.ref) || null,
    aggregate: async () => ({ _sum: { costMicros: store.aiUsage.reduce((s, u) => s + (u.costMicros || 0), 0) } }),
    count: async () => 0,
  },
};
globalThis.__prisma = fakeDb;

// A key so isAiConfigured() is true; never a real one, and the provider's
// client is never constructed because complete() is injected throughout.
process.env.OPENAI_API_KEY = "not-a-real-key";

const {
  TRIAGE_KINDS, TRIAGE_OPEN, TRIAGE_STOP, TRIAGE_FINE, TRIAGE_ROADBLOCK, TRIAGE_QUESTION,
  preTriage, threadTriage, openTriage, countOpenTriage, isTriageKind, triageShowsChip,
} = await import("@/lib/sales/messages/triage");
const { triageReply, triageStoredReply, overrideTriage, TRIAGE_SKIPPED, TRIAGE_AI_AREA } = await import("@/lib/sales/replyTriage");
const { openTriageThreads } = await import("@/lib/sales/messages/triageStore");
const { handleSalesInboundSms } = await import("@/lib/sales/salesSms");
const { assertStrictSchema } = await import("@/lib/ai/jsonSchema");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The pre-rules decide what a keyword decides, and nothing else");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the vocabulary is the six kinds, in the documented order",
    TRIAGE_KINDS.join() === "roadblock,question,positive,not_interested,stop,fine", TRIAGE_KINDS);
  ok("the open kinds are roadblock then question", TRIAGE_OPEN.join() === "roadblock,question", TRIAGE_OPEN);
  ok("isTriageKind refuses anything else", !isTriageKind("STOP") && !isTriageKind("") && !isTriageKind(null) && isTriageKind("fine"));
  ok("fine draws no chip; every other kind does",
    !triageShowsChip(TRIAGE_FINE) && TRIAGE_KINDS.filter((k) => k !== TRIAGE_FINE).every(triageShowsChip));

  for (const body of ["STOP", "stop", " Stop. ", "UNSUBSCRIBE", "cancel!", "END", "quit"]) {
    const r = preTriage(body);
    ok(`${JSON.stringify(body)} → stop, by rule`, r?.triage === TRIAGE_STOP && r.source === "rule", r);
  }
  for (const body of ["START", "unstop"]) {
    ok(`${JSON.stringify(body)} → fine (an opt-in keyword is not a problem)`, preTriage(body)?.triage === TRIAGE_FINE, preTriage(body));
  }
  for (const body of ["", "   ", null, undefined]) {
    const r = preTriage(body);
    ok(`${JSON.stringify(body)} → null, reason empty (nothing to read is not "fine")`, r && r.triage === null && r.reason === "empty", r);
  }
  for (const body of ["yes", "OK", "ok!", "Okay.", "k", "Thanks!", "thank you", "👍", "👍🏽", "Sounds good", "Got it", "Merci!", "D'accord", "Oui", "Sí", "Gracias", "vale", "Perfecto", "Will do"]) {
    const r = preTriage(body);
    ok(`${JSON.stringify(body)} → fine, by rule (no model call)`, r?.triage === TRIAGE_FINE && r.source === "rule", r);
  }
  for (const body of [
    "please stop by at 3",
    "Stop sending me the link, it does not work",
    "ok but the link says my email is already taken",
    "yes, can you call me thursday?",
    "Not interested thanks",
    "How much is it per month?",
    "No, we use Jobber",
    "Merci mais le formulaire refuse mon code postal",
  ]) {
    ok(`${JSON.stringify(body)} → the model's job (null from the rules)`, preTriage(body) === null, preTriage(body));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The model path, driven over a scripted vendor");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The schema complete() will send, lifted from the module by the same
  // regex the provider would lint it with. Strict mode refuses an enum on
  // some providers' older builds; ours has to pass the repo's own linter.
  const src = decomment(read("lib/sales/replyTriage.js"));
  ok("the module asks for a strict JSON schema with the kinds as an enum",
    /schema: SCHEMA/.test(src) && /enum: TRIAGE_KINDS\.filter\(\(k\) => k !== TRIAGE_STOP\)/.test(src));
  const SCHEMA = {
    type: "object",
    properties: { triage: { type: "string", enum: TRIAGE_KINDS.filter((k) => k !== TRIAGE_STOP) }, reason: { type: "string" } },
    required: ["triage", "reason"],
    additionalProperties: false,
  };
  const lint = assertStrictSchema(SCHEMA);
  ok("…and that schema passes the strict-subset linter", lint.ok === true, lint.errors);
  ok("…and STOP is not a value the model may answer", !SCHEMA.properties.triage.enum.includes("stop"), SCHEMA.properties.triage.enum);

  const calls = [];
  const scripted = (answer) => async (args) => {
    calls.push(args);
    if (args.onUsage) await args.onUsage({ model: "gpt-5-mini", promptTokens: 340, completionTokens: 120, imageCount: 0 });
    return typeof answer === "function" ? answer(args) : answer;
  };
  const client = fakeDb;

  // ── A good answer ──────────────────────────────────────────────────────
  resetStore();
  calls.length = 0;
  const good = await triageReply({
    body: "ok but the link says my email is already taken",
    language: "fr",
    context: { lastOutbound: "Hi, it is Daniel from FieldQuo. Here is the link: https://x", businessName: "Northside Painting" },
    client,
    salesRepId: "rep1",
    ref: "sms_reply_triage:m1",
    complete: scripted({ ok: true, data: { triage: "roadblock", reason: "Le lien refuse son courriel : déjà utilisé." } }),
  });
  ok("a roadblock the vendor names comes back as one", good.triage === TRIAGE_ROADBLOCK && good.source === "ai", good);
  ok("…with the model's sentence", /courriel/.test(good.reason || ""), good.reason);
  ok("…and the model that answered", good.model === "gpt-5-mini", good.model);
  ok("the vendor was called exactly once", calls.length === 1, calls.length);
  ok("…with the schema, named after the caller", calls[0].schema && calls[0].schemaName === "sales_reply_triage", calls[0].schemaName);
  ok("…the rep's last text in the prompt, so 'yes' is read as an answer to something", /Here is the link/.test(calls[0].prompt), calls[0].prompt);
  ok("…the reply in the prompt", /already taken/.test(calls[0].prompt));
  ok("…and the language the reason is wanted in", /language: fr/.test(calls[0].prompt));
  ok("…at low reasoning effort — six labels do not need thinking", calls[0].reasoningEffort === "low", calls[0].reasoningEffort);
  ok("the spend was recorded on the PLATFORM ledger, not a tenant's",
    store.aiUsage.length === 1 && store.aiUsage[0].area === TRIAGE_AI_AREA && store.aiUsage[0].salesRepId === "rep1", store.aiUsage);
  ok("…with the idempotency ref, so a retried webhook cannot pay twice", store.aiUsage[0]?.ref === "sms_reply_triage:m1", store.aiUsage[0]?.ref);
  ok("…and a cost the ledger can sum", Number.isFinite(store.aiUsage[0]?.costMicros) && store.aiUsage[0].costMicros > 0, store.aiUsage[0]?.costMicros);
  ok("…a fraction of a cent per reply", store.aiUsage[0].costMicros < 10_000, `${store.aiUsage[0].costMicros} micro-dollars`);

  // ── A provider that does not honour strict mode ────────────────────────
  resetStore();
  const stopAnswer = await triageReply({ body: "how much is it", client, complete: scripted({ ok: true, data: { triage: "stop", reason: "x" } }) });
  ok("a 'stop' from the model is refused — the suppression path never saw it", stopAnswer.triage === null && stopAnswer.skipped === TRIAGE_SKIPPED.bad_answer, stopAnswer);
  ok("…but the call was still metered (the tokens were spent)", store.aiUsage.length === 1, store.aiUsage.length);
  const junk = await triageReply({ body: "how much is it", client, complete: scripted({ ok: true, data: { triage: "maybe", reason: "x" } }) });
  ok("a kind we do not know is refused the same way", junk.triage === null && junk.skipped === TRIAGE_SKIPPED.bad_answer, junk);

  // ── Every unhappy path leaves null and never throws ────────────────────
  const vendorDown = await triageReply({ body: "how much is it", client, complete: scripted({ ok: false, reason: "vendor_error", message: "429" }) });
  ok("a vendor error leaves null, named", vendorDown.triage === null && vendorDown.skipped === TRIAGE_SKIPPED.vendor_error, vendorDown);
  const refused = await triageReply({ body: "how much is it", client, complete: scripted({ ok: false, reason: "refused", message: "no" }) });
  ok("a refusal leaves null, named as one", refused.triage === null && refused.skipped === TRIAGE_SKIPPED.refused, refused);
  let threw = false;
  let exploded;
  try {
    exploded = await triageReply({ body: "how much is it", client, complete: async () => { throw new Error("boom"); } });
  } catch { threw = true; }
  ok("a provider that THROWS does not: null comes back", !threw && exploded?.triage === null, exploded);
  let threw2 = false;
  try {
    await triageReply({ body: { not: "a string" }, client, complete: async () => { throw new Error("boom"); } });
    await triageReply({ client: { platformAiBudget: { findMany: async () => { throw new Error("db down"); } } }, body: "how much", complete: scripted({ ok: true, data: { triage: "question", reason: "x" } }) });
  } catch { threw2 = true; }
  ok("…nor a body that is not a string, nor a budget table that is down", !threw2);

  // ── No meter, no call ──────────────────────────────────────────────────
  calls.length = 0;
  const unmetered = await triageReply({ body: "how much is it", complete: scripted({ ok: true, data: { triage: "question", reason: "x" } }) });
  ok("without a client (no ledger) the model is NOT called", calls.length === 0 && unmetered.skipped === TRIAGE_SKIPPED.unmetered, unmetered);
  delete process.env.OPENAI_API_KEY;
  const unconfigured = await triageReply({ body: "how much is it", client, complete: scripted({ ok: true, data: { triage: "question", reason: "x" } }) });
  ok("without a key the model is NOT called and the reason says so", calls.length === 0 && unconfigured.skipped === TRIAGE_SKIPPED.unconfigured, unconfigured);
  process.env.OPENAI_API_KEY = "not-a-real-key";
  resetStore();
  store.aiBudgets.push({ id: "b1", scope: "global", scopeId: null, limitMicros: 1, active: true });
  store.aiUsage.push({ area: "x", model: "gpt-5-mini", costMicros: 5, ref: "spent" });
  const overBudget = await triageReply({ body: "how much is it", client, complete: scripted({ ok: true, data: { triage: "question", reason: "x" } }) });
  ok("a spent platform budget refuses the call before it is made", calls.length === 0 && overBudget.skipped === TRIAGE_SKIPPED.budget, overBudget);

  // ── The rules still run first, with a vendor standing by ──────────────
  resetStore();
  calls.length = 0;
  const ruled = await triageReply({ body: "STOP", client, complete: scripted({ ok: true, data: { triage: "positive", reason: "x" } }) });
  ok("STOP never reaches a vendor that would have said 'positive'", calls.length === 0 && ruled.triage === TRIAGE_STOP && ruled.source === "rule", ruled);
  const acked = await triageReply({ body: "ok", client, complete: scripted({ ok: true, data: { triage: "roadblock", reason: "x" } }) });
  ok("'ok' never reaches the vendor either", calls.length === 0 && acked.triage === TRIAGE_FINE, acked);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. STOP precedence and the rep's override, end to end");
// ═══════════════════════════════════════════════════════════════════════════

{
  resetStore();
  store.numbers.push({ e164: "+15145550111", purpose: "sales", active: true });
  store.leads.set("lead1", { id: "lead1", salesRepId: "rep1", phone: "+16135550142", businessName: "Northside Painting", province: "QC", updatedAt: new Date() });
  store.smsMessages.push({ id: "out1", direction: "out", salesRepId: "rep1", leadId: "lead1", fromE164: "+15145550111", toE164: "+16135550142", body: "Hi, it is Daniel from FieldQuo. Here is the link: https://x", sentAt: new Date("2026-09-12T14:00:00Z") });

  // The handler schedules triageStoredReply({ messageId }) with the REAL
  // provider behind it. Recorded here and never run: the check drives the
  // same call itself with the vendor injected, so no network is touched.
  const scheduled = [];
  const schedule = (run) => { scheduled.push(run); };
  const vendor = async (args) => {
    if (args.onUsage) await args.onUsage({ model: "gpt-5-mini", promptTokens: 300, completionTokens: 100 });
    return { ok: true, data: { triage: "positive", reason: "They would like it." } };
  };

  // A STOP. The suppression is written by the handler; the triage says
  // "stop" from the keyword; the vendor is never asked.
  const stop = await handleSalesInboundSms({ to: "+15145550111", from: "613-555-0142", body: "STOP", schedule });
  ok("STOP is stored and suppressed, and the stored row's id comes back", stop.action === "suppressed" && typeof stop.messageId === "string", stop);
  ok("…the do-not-contact row exists before the triage has run", store.suppressions.length === 1 && store.suppressions[0].value === "+16135550142");
  ok("…and the triage was scheduled, not awaited inline", scheduled.length === 1 && typeof scheduled[0] === "function", scheduled.length);
  const suppressionBefore = JSON.stringify(store.suppressions);
  const stopRow = store.smsMessages.find((m) => m.id === stop.messageId);
  const stopVerdict = await triageStoredReply({ messageId: stop.messageId, client: fakeDb, complete: vendor });
  ok("the stored STOP row is filed as stop, by the keyword", stopRow?.triage === TRIAGE_STOP && stopVerdict.ok, { row: stopRow?.triage, stopVerdict });
  ok("…with no model named (no model was asked)", stopRow?.triageModel === null && store.aiUsage.length === 0, { model: stopRow?.triageModel, usage: store.aiUsage.length });
  ok("…and the suppression is byte-for-byte what it was — the label changed nothing", JSON.stringify(store.suppressions) === suppressionBefore);

  // An ordinary reply: stored, scheduled, classified by the vendor.
  scheduled.length = 0;
  const reply = await handleSalesInboundSms({ to: "+15145550111", from: "+16135550142", body: "yes, can you call me thursday?", schedule });
  ok("an ordinary reply is stored with its id", reply.action === "stored" && typeof reply.messageId === "string", reply);
  ok("…and its triage was scheduled too", scheduled.length === 1, scheduled.length);
  const verdict = await triageStoredReply({ messageId: reply.messageId, client: fakeDb, complete: vendor });
  const row = store.smsMessages.find((m) => m.id === reply.messageId);
  ok("…and the vendor's verdict is written on the row", verdict.ok && row.triage === "positive" && row.triageModel === "gpt-5-mini" && row.triagedAt instanceof Date, { verdict, row: { triage: row.triage, model: row.triageModel } });
  ok("…with the reason", row.triageReason === "They would like it.", row.triageReason);
  ok("…and the ledger row carries the message id as its ref", store.aiUsage.length === 1 && store.aiUsage[0].ref === `sms_reply_triage:${reply.messageId}`, store.aiUsage[0]?.ref);
  ok("…and nothing was filed in the error log for a reply that worked", store.errors.filter((e) => /triage/.test(e.code || "")).length === 0, store.errors.map((e) => e.code));

  // The rep overrides. The next automatic pass must not undo a person.
  const over = await overrideTriage({ salesRepId: "rep1", e164: "+16135550142", triage: "roadblock", client: fakeDb });
  ok("the rep's override writes the latest inbound row", over.ok && over.messageId === reply.messageId && row.triage === "roadblock" && row.triageOverriddenById === "rep1", { over, row: row.triage });
  ok("…and keeps the model's sentence for the audit", row.triageReason === "They would like it.");
  const again = await triageStoredReply({ messageId: reply.messageId, client: fakeDb, complete: vendor });
  ok("a second automatic pass leaves the person's word alone", again.skipped === TRIAGE_SKIPPED.overridden && row.triage === "roadblock", { again, row: row.triage });
  const stranger = await overrideTriage({ salesRepId: "rep2", e164: "+16135550142", triage: "fine", client: fakeDb });
  ok("another rep cannot relabel it", stranger.ok === false && row.triage === "roadblock", stranger);
  const bad = await overrideTriage({ salesRepId: "rep1", e164: "+16135550142", triage: "urgent", client: fakeDb });
  ok("a kind we do not know is refused", bad.ok === false && row.triage === "roadblock", bad);
  const cleared = await overrideTriage({ salesRepId: "rep1", e164: "+16135550142", triage: null, client: fakeDb });
  ok("null clears the chip and the override together", cleared.ok && row.triage === null && row.triageOverriddenById === null, { cleared, row });

  // An outbound row is never classified; a missing row is not an error.
  const notIn = await triageStoredReply({ messageId: "out1", client: fakeDb, complete: vendor });
  ok("an outbound row is refused", notIn.ok === false && notIn.skipped === TRIAGE_SKIPPED.not_inbound, notIn);
  const missing = await triageStoredReply({ messageId: "nope", client: fakeDb, complete: vendor });
  ok("a row that does not exist is refused, quietly", missing.ok === false && missing.skipped === TRIAGE_SKIPPED.missing, missing);

  // The never-throws promise, with the database gone.
  let threw = false;
  let broken;
  try {
    broken = await triageStoredReply({ messageId: reply.messageId, client: { salesSmsMessage: { findUnique: async () => { throw new Error("P1001"); } } }, complete: vendor });
  } catch { threw = true; }
  ok("a database that throws does not: null verdict, one error-log row", !threw && broken?.ok === false && store.errors.some((e) => e.code === "triage_failed"), { broken, errors: store.errors.map((e) => e.code) });

  // A vendor failure on the stored path is logged where support looks.
  store.errors.length = 0;
  const reply2 = await handleSalesInboundSms({ to: "+15145550111", from: "+16135550142", body: "how much per month?", schedule });
  await triageStoredReply({ messageId: reply2.messageId, client: fakeDb, complete: async () => ({ ok: false, reason: "vendor_error", message: "429" }) });
  ok("a vendor failure leaves the row null and files triage_vendor_error", store.smsMessages.find((m) => m.id === reply2.messageId).triage === null && store.errors.some((e) => e.code === "triage_vendor_error"), store.errors.map((e) => e.code));
  store.errors.length = 0;
  delete process.env.OPENAI_API_KEY;
  await triageStoredReply({ messageId: reply2.messageId, client: fakeDb, complete: vendor });
  ok("…but an unconfigured deployment files NOTHING per reply (an error log full of one known fact is not read)", store.errors.length === 0, store.errors.map((e) => e.code));
  process.env.OPENAI_API_KEY = "not-a-real-key";
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The list arithmetic, executed");
// ═══════════════════════════════════════════════════════════════════════════

{
  const t = (h) => new Date(`2026-09-12T${h}:00Z`);
  const OUT = "+15145550111";
  const inRow = (id, from, at, triage, extra = {}) => ({ id, direction: "in", fromE164: from, toE164: OUT, sentAt: t(at), triage, triageReason: triage ? `because ${id}` : null, triagedAt: t(at), triageOverriddenById: null, body: `body ${id}`, ...extra });
  const outRow = (id, to, at) => ({ id, direction: "out", fromE164: OUT, toE164: to, sentAt: t(at), triage: null });

  ok("a thread nobody has written to us in has no verdict", threadTriage([outRow("o", "+16135550101", "09:00")]) === null);
  const answered = threadTriage([inRow("a", "+16135550101", "09:00", "roadblock"), outRow("o", "+16135550101", "10:00")]);
  ok("a roadblock the rep answered keeps its kind but is not open", answered.kind === "roadblock" && answered.open === false, answered);
  const waiting = threadTriage([outRow("o", "+16135550101", "09:00"), inRow("a", "+16135550101", "10:00", "roadblock")]);
  ok("a roadblock after the rep's last word is open", waiting.open === true && waiting.reason === "because a", waiting);
  const later = threadTriage([inRow("a", "+16135550101", "09:00", "roadblock"), inRow("b", "+16135550101", "11:00", "fine")]);
  ok("a later 'fine' from them is the thread's chip — the latest word wins", later.kind === "fine" && later.messageId === "b", later);
  const unclassified = threadTriage([inRow("a", "+16135550101", "09:00", null)]);
  ok("an unclassified reply is kind null, never 'fine'", unclassified.kind === null && unclassified.open === true, unclassified);
  const rubbish = threadTriage([inRow("a", "+16135550101", "09:00", "urgent"), null, undefined]);
  ok("a kind the column should not hold reads as null, and rubbish rows are skipped", rubbish.kind === null);

  const rows = [
    outRow("o1", "+16135550101", "08:00"), inRow("q1", "+16135550101", "09:00", "question"),
    outRow("o2", "+16135550102", "08:00"), inRow("r1", "+16135550102", "09:30", "roadblock", { leadId: "L2", lead: { businessName: "Two Roofing", contactName: null } }),
    outRow("o3", "+16135550103", "08:00"), inRow("r2", "+16135550103", "11:00", "roadblock"),
    outRow("o4", "+16135550104", "08:00"), inRow("r3", "+16135550104", "09:00", "roadblock"), outRow("o5", "+16135550104", "12:00"),
    outRow("o6", "+16135550105", "08:00"), inRow("p1", "+16135550105", "13:00", "positive"),
    outRow("o7", "+16135550106", "08:00"), inRow("r4", "+16135550106", "09:00", "roadblock"), inRow("f1", "+16135550106", "14:00", "fine"),
    inRow("s1", "+16135550107", "09:00", "stop"),
    inRow("q2", "+16135550108", "15:00", "question"),
  ];
  const open = openTriage(rows);
  ok("only open roadblocks and questions are listed", open.every((i) => TRIAGE_OPEN.includes(i.kind)) && open.length === 4, open.map((i) => `${i.e164}:${i.kind}`));
  ok("roadblocks first, newest first, then questions newest first", open.map((i) => i.e164).join() === "+16135550103,+16135550102,+16135550108,+16135550101", open.map((i) => `${i.e164}@${i.sentAt.toISOString().slice(11, 16)}`));
  ok("the answered one (+4), the later-fine one (+6), the positive (+5) and the stop (+7) are not tasks", !open.some((i) => ["+16135550104", "+16135550105", "+16135550106", "+16135550107"].includes(i.e164)));
  ok("an item carries the business name and lead when the rows have one", open[1].name === "Two Roofing" && open[1].leadId === "L2", open[1]);
  ok("…and the reply's own words and the model's sentence", open[0].body === "body r2" && open[0].reason === "because r2", open[0]);
  const counts = countOpenTriage(open);
  ok("the counts a digest prints", counts.roadblock === 2 && counts.question === 2, counts);
  ok("counting nothing is zero, not undefined", JSON.stringify(countOpenTriage(null)) === '{"roadblock":0,"question":0}', countOpenTriage(null));

  // The db-backed reader, over the same rows in the stub.
  resetStore();
  for (const r of rows) store.smsMessages.push({ ...r, salesRepId: "rep1" });
  store.smsMessages.push(inRow("other", "+16135550109", "16:00", "roadblock", { salesRepId: "rep2" }));
  const fromDb = await openTriageThreads({ salesRepId: "rep1", client: fakeDb });
  ok("openTriageThreads returns the same four, in the same order, for the rep's own rows only",
    fromDb.items.map((i) => i.e164).join() === "+16135550103,+16135550102,+16135550108,+16135550101", fromDb.items.map((i) => i.e164));
  ok("…and never another rep's roadblock", !fromDb.items.some((i) => i.e164 === "+16135550109"));
  ok("…with the counts", fromDb.counts.roadblock === 2 && fromDb.counts.question === 2, fromDb.counts);
  const one = await openTriageThreads({ salesRepId: "rep1", e164: "(514) 000-0002".replace(/\D/g, "").replace(/^/, "+16135550101").slice(0, 2) === "+16135550101" ? "+16135550102" : "+16135550102", client: fakeDb });
  ok("narrowed to one number, it returns that thread's item", one.items.length === 1 && one.items[0].e164 === "+16135550102", one.items);
  const none = await openTriageThreads({ salesRepId: "rep1", e164: "+16135550104", client: fakeDb });
  ok("…and nothing for a thread the rep already answered", none.items.length === 0, none.items);
  const nobody = await openTriageThreads({ client: fakeDb });
  ok("no rep, no rows — not somebody else's", nobody.items.length === 0);

  // The filter the screen applies is the same predicate, on the list's shape.
  const list = [
    { e164: "+16135550101", triage: { kind: "roadblock", open: true } },
    { e164: "+16135550102", triage: { kind: "question", open: true } },
    { e164: "+16135550103", triage: null },
    { e164: "+16135550104", triage: { kind: "roadblock", open: false } },
  ];
  const filtered = list.filter((c) => c.triage?.kind === TRIAGE_ROADBLOCK);
  ok("the Roadblocks filter keeps every roadblock, answered or not — a filed roadblock is still one", filtered.map((c) => c.e164).join() === "+16135550101,+16135550104", filtered.map((c) => c.e164));
  ok("…and nothing unclassified", !filtered.some((c) => !c.triage));
  void TRIAGE_QUESTION;
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The wiring");
// ═══════════════════════════════════════════════════════════════════════════

{
  const webhook = decomment(read("app/api/sms/inbound/route.js"));
  ok("the webhook imports after() from next/server", /import \{[^}]*\bafter\b[^}]*\} from "next\/server"/.test(webhook));
  ok("…and hands it to the sales handler as `schedule`", /handleSalesInboundSms\(\{ to, from, body, schedule: after \}\)/.test(webhook));

  const sms = decomment(read("lib/sales/salesSms.js"));
  const createAt = sms.indexOf("direction: \"in\"");
  const scheduleAt = sms.indexOf("schedule(() => triageStoredReply({ messageId }))");
  const suppressAt = sms.indexOf("const outcome = await suppress(db, {");
  ok("the handler schedules the triage AFTER the row is stored and BEFORE the suppression branch",
    createAt > 0 && scheduleAt > createAt && suppressAt > scheduleAt, { createAt, scheduleAt, suppressAt });
  ok("…for every stored reply, STOP included (the label is decided by the keyword, not skipped)",
    /if \(storedId\) \{[\s\S]{0,200}schedule\(\(\) => triageStoredReply/.test(sms));
  ok("the conversation list selects the triage columns and decides per thread with threadTriage",
    /triage: true, triageReason: true, triagedAt: true, triageOverriddenById: true/.test(sms) && /threadTriage\(\[m\]\)/.test(sms));
  ok("the triage module never touches the suppression table",
    !/salesSuppression/.test(decomment(read("lib/sales/replyTriage.js"))) && !/salesSuppression/.test(decomment(read("lib/sales/messages/triage.js"))));
  ok("…and STOP is read through the same keyword function the suppression uses",
    /classifyInboundSms/.test(decomment(read("lib/sales/messages/triage.js"))) && /import \{ classifyInboundSms \} from "@\/lib\/sms\/optOutKeywords"/.test(read("lib/sales/messages/triage.js")));
  ok("the triage spends through lib/ai/provider.js and the platform ledger, nothing else",
    /from "@\/lib\/ai\/provider"/.test(read("lib/sales/replyTriage.js")) && /recordPlatformAiUsage/.test(read("lib/sales/replyTriage.js")) && !/new OpenAI/.test(read("lib/sales/replyTriage.js")));

  const page = decomment(read("app/sales/messages/page.js"));
  ok("the Texts list draws a chip per room from the thread's verdict", /badges: <TriageChip triage=\{c\.triage\} \/>/.test(page));
  ok("…in the kit's colours: roadblock red, question amber, positive green, not interested grey, fine none",
    /roadblock: "bg-red-600 text-white"/.test(page) && /question: "bg-amber-100/.test(page) && /positive: "bg-emerald-100/.test(page) && /not_interested: "bg-muted/.test(page) && /if \(!triageShowsChip\(kind\)\) return null/.test(page));
  ok("the Roadblocks filter is at the top of the list", /data-triage-filter/.test(page) && /setRoadblocksOnly\(\(v\) => !v\)/.test(page) && /aria-pressed=\{roadblocksOnly\}/.test(page));
  ok("…and its buttons meet the portal's 36px touch floor (check:mobile's rule)", (page.match(/min-h-\[36px\]/g) || []).length >= 2);
  ok("…narrows every bucket rather than replacing them", /const visible = \(rooms\) => \(roadblocksOnly \? rooms\.filter\(\(c\) => c\.triage\?\.kind === TRIAGE_ROADBLOCK\) : rooms\)/.test(page));
  ok("…and says so when it hides everything", /filterNoRoadblocks/.test(page));
  ok("the grouping call the messages check pins is untouched", /groupConversations\(list \|\| \[\]\)/.test(page));
  ok("the thread header has the dropdown that overrides the chip", /data-triage-select/.test(page) && /\/api\/sales\/messages\/triage/.test(page));
  ok("…offering every kind and a clear", /TRIAGE_KINDS\.map\(\(k\) =>/.test(page) && /<option value="">/.test(page));
  ok("…and shows the model's reason only until a rep has had the last word", /thread\.triage\.reason && !thread\.triage\.overridden/.test(page));

  const override = decomment(read("app/api/sales/messages/triage/route.js"));
  ok("the override route is on the outreach gate, like the read-marker route", /requireOutreachRep\(request\)/.test(override));
  ok("…refuses a body without the field, and a kind that is not ours", /!\("triage" in body\)/.test(override) && /isTriageKind\(triage\)/.test(override));
  ok("…writes nothing directly (the write is overrideTriage's, rep id in the WHERE)",
    !/\bdb\./.test(override) && /where: \{ id: latest\.id, salesRepId \}/.test(decomment(read("lib/sales/replyTriage.js"))));
  ok("…and sends nothing", !/sendSms|deliverReplySms|twilio/.test(override));

  const thread = decomment(read("app/api/sales/messages/route.js"));
  ok("the thread payload carries the verdict from the same pure function", /threadTriage\(messages\)/.test(thread));

  const queue = decomment(read("app/api/sales/queue/route.js"));
  ok("the console reads open roadblocks/questions for the number on screen", /openTriageThreads\(\{ salesRepId: rep\.id, e164: full\.phoneE164 \}\)/.test(queue) && /openTriage: openTriage/.test(queue));
  ok("…null when the read failed, never an empty list", /\.catch\(\(\) => null\)/.test(queue.slice(queue.indexOf("openTriageThreads("), queue.indexOf("openTriageThreads(") + 200)));
  const console_ = decomment(read("app/sales/queue/page.js"));
  ok("the Tasks tab lists them, roadblocks in the gap tone, with a link into the thread",
    /data-console-triage/.test(console_) && /tasksReplies/.test(console_) && /\/sales\/messages\?thread=\$\{encodeURIComponent\(o\.e164\)\}/.test(console_));
  ok("…and tells 'could not read' from 'nothing open'", /openTriage === null/.test(console_) && /tasksRepliesUnreadable/.test(console_));

  const materialise = decomment(read("lib/sales/checkin/materialise.js"));
  ok("the 07:00 UTC cron's report counts open roadblocks and questions per rep and in total",
    /openRoadblocks: 0, openQuestions: 0/.test(materialise) && /openTriageThreads\(\{ salesRepId: rep\.id, client \}\)/.test(materialise) && /openTriage,\s*\}\);/.test(materialise));
  ok("…and the cron still imports nothing that sends", !/salesSms|twilio|sms\//.test(decomment(read("app/api/cron/sales-checkins/route.js"))));
  ok("the store the cron and the console share has no write in it", !/\.(create|update|updateMany|upsert|delete|deleteMany)\(/.test(decomment(read("lib/sales/messages/triageStore.js"))));

  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesSmsMessage {"));
  const body = model.slice(0, model.indexOf("\n}\n"));
  for (const col of ["triage String?", "triageReason String?", "triagedAt DateTime?", "triageModel String?", "triageOverriddenById String?"]) {
    ok(`the column exists: ${col}`, body.includes(col));
  }
  ok("…indexed by rep and kind for the task list", /@@index\(\[salesRepId, triage\]\)/.test(body));

  const KEYS = [
    "app.salesText.triage.roadblock", "app.salesText.triage.question", "app.salesText.triage.positive",
    "app.salesText.triage.notInterested", "app.salesText.triage.stop", "app.salesText.triage.fine",
    "app.salesText.filterRoadblocks", "app.salesText.filterAll", "app.salesText.filterNoRoadblocks",
    "app.salesText.triageLabel", "app.salesText.triageUnset", "app.salesText.triageSaveFailed",
    "app.salesQueue.tasksReplies", "app.salesQueue.tasksRepliesUnreadable", "app.salesQueue.tasksNoReplies", "app.salesQueue.tasksAnswerInTexts",
  ];
  const langs = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", langs.length === 9, langs);
  for (const lang of langs) {
    const missing = KEYS.filter((k) => typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim());
    ok(`every triage key is translated in ${lang}`, missing.length === 0, missing);
  }
  const untranslated = langs.filter((l) => l !== "en").filter((l) => APP_MESSAGES[l]["app.salesQueue.tasksReplies"] === APP_MESSAGES.en["app.salesQueue.tasksReplies"]);
  ok("…and the sentences are not English left in place", untranslated.length === 0, untranslated);

  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-reply-triage is a script", typeof pkg.scripts?.["check:sales-reply-triage"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-reply-triage"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
