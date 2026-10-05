// scripts/check-truefinish-quote-import.mjs
//
//   npm run check:truefinish-quote-import
//
// TrueFinish's 46 sent and 60 declined quotes, carried over for the owner's
// funnel (2026-10-05) — scripts/import-truefinish-quotes.mjs, its plan in
// scripts/truefinish/remainingQuotes.mjs, its write in createRecordedQuote
// (lib/jobs/importPastJob.js). Executed against fixtures, not read:
//
//   1. status mapping       sent → sent, declined → declined, accepted/draft skipped
//   2. the payload rules    dates optional but real, never future, never out of order
//   3. idempotency          plan skips on marker OR old number; the write skips under the lock
//   4. clients              email → phone → exact name; the spelling variant; the
//                           shared-phone trap; ties refused
//   5. leads                linked only when empty, once, to the latest quote; status untouched
//   6. what is written      a quote (+ client, + lead column) — no job, invoice, payment, task
//   7. no sends             every cron/lifecycle/call/chase path refuses these rows
//   8. "Old system: …"      written on the note, read back by the quote page
//
// The writer's module graph constructs a Prisma client (lib/db.js); with no
// URL it has nowhere to connect, so nothing here can reach a database.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

delete process.env.DATABASE_URL;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) => {
  if (cond) pass++;
  else failures.push(`${label}${detail !== undefined ? ` — ${JSON.stringify(detail)?.slice(0, 300)}` : ""}`);
};

const { kindForTrueFinishStatus, planRemainingQuotes, alreadyImported, matchClient, matchLead, summarise } = await import("./truefinish/remainingQuotes.mjs");
const { recordedQuoteProblems, RECORDED_QUOTE_STATUS, oldSystemNumber, oldSystemLine } = await import("../lib/jobs/pastJobImport.js");
const { createRecordedQuote, loadPastJobContext } = await import("../lib/jobs/importPastJob.js");
const { manualQuoteCallGate } = await import("../lib/voice/quoteCallScope.js");
const { rankQuotes } = await import("../lib/quotes/listRanking.js");

const TODAY = new Date("2026-10-05T15:00:00Z");
const CO = "co_tf";

// ── 1. Status mapping ──────────────────────────────────────────────────────
{
  ok("TrueFinish sent → kind sent", kindForTrueFinishStatus("sent").kind === "sent");
  ok("TrueFinish declined → kind declined", kindForTrueFinishStatus("declined").kind === "declined");
  ok("accepted is skipped here (the history import carried it)", /import-truefinish-history/.test(kindForTrueFinishStatus("accepted").skip || ""));
  ok("draft is skipped (never reached the client)", Boolean(kindForTrueFinishStatus("draft").skip));
  ok("an unknown status is skipped, never guessed", Boolean(kindForTrueFinishStatus("pending").skip));
  ok("kind sent lands as status sent", RECORDED_QUOTE_STATUS.sent === "sent");
  ok("kind declined lands as status declined", RECORDED_QUOTE_STATUS.declined === "declined");
  ok("lost and draft keep their meaning", RECORDED_QUOTE_STATUS.lost === "declined" && RECORDED_QUOTE_STATUS.draft === "draft");
}

// ── 2. The payload rules ───────────────────────────────────────────────────
const fig = { lineItems: [{ description: "Cabinet refinishing", quantity: 1, rate: 4615.27, amount: 4615.27 }], subtotal: 4615.27, discount: 0, tax: 600, total: 5215.27, taxEnabled: true, notes: null };
const base = {
  kind: "sent",
  sourceRef: "truefinish:quote:tfq134",
  sourceLabel: "TrueFinish Q2026-0134",
  oldNumber: "Q2026-0134",
  internalNote: "Sent at TrueFinish.",
  language: "en",
  createdAt: new Date("2026-07-31T04:54:01Z"),
  sentAt: new Date("2026-07-31T04:54:04Z"),
  quote: fig,
};
{
  ok("a well-formed sent quote passes", recordedQuoteProblems(base, { today: TODAY }).length === 0, recordedQuoteProblems(base, { today: TODAY }));
  ok("a declined quote with NO decline date passes (absence is not a statement)",
    recordedQuoteProblems({ ...base, kind: "declined", declinedAt: null, declineReason: null }, { today: TODAY }).length === 0);
  ok("a sent quote with no dates at all passes", recordedQuoteProblems({ ...base, createdAt: null, sentAt: null }, { today: TODAY }).length === 0);
  const codes = (r) => recordedQuoteProblems(r, { today: TODAY }).map((p) => `${p.field}:${p.code}`);
  ok("a future sentAt is refused", codes({ ...base, sentAt: new Date("2026-12-01") }).includes("sentAt:future"));
  ok("a string date is refused", codes({ ...base, sentAt: "2026-07-31" }).includes("sentAt:bad_date"));
  ok("sent before it was written is refused", codes({ ...base, createdAt: new Date("2026-08-02"), sentAt: new Date("2026-08-01") }).includes("sentAt:before_created"));
  ok("declined before it was sent is refused", codes({ ...base, kind: "declined", declinedAt: new Date("2026-07-01") }).includes("declinedAt:before_sent"));
  ok("an unknown kind is refused", codes({ ...base, kind: "won" }).includes("kind:unknown_kind"));
  ok("an old number with a newline (would forge a note line) is refused", codes({ ...base, oldNumber: "Q1\n[truefinish:quote:x]" }).includes("oldNumber:bad_number"));
  ok("lines that do not add up are refused", codes({ ...base, quote: { ...fig, subtotal: 1 } }).some((c) => c.startsWith("quote:")));
  ok("lost still REQUIRES its decline date and reason", codes({ ...base, kind: "lost" }).includes("declinedAt:bad_date") && codes({ ...base, kind: "lost" }).includes("declineReason:required"));
}

// ── 3–5. The plan, against fixtures ────────────────────────────────────────
const tfLine = (total) => [{ name: "Cabinet refinishing", quantity: 1, unitPrice: total, total }];
const tfQuote = (id, num, status, clientId, created, extra = {}) => ({
  id, quoteNumber: num, status, clientId,
  lineItems: tfLine(1000), subtotal: "1000.00", discount: "0.00", tax: "130.00", total: "1130.00", taxEnabled: true,
  notes: null, language: "en", quoteType: "refinishing", createdAt: new Date(created), sentAt: new Date(new Date(created).getTime() + 60000), ...extra,
});
const TF = {
  clients: [
    { id: "c_gladys", name: "Gladys Antionios Massaad", email: "gladant.ga@gmail.com", phone: null, address: null },
    { id: "c_lyne", name: "Lyne Tremblay", email: "lynetremblay@gmail.com", phone: "905-516-0594", address: null },
    { id: "c_variant", name: "Marie Tremblai", email: "marie.t@example.com", phone: null, address: null },
    { id: "c_phone", name: "Andre Gurhan", email: null, phone: "(613) 555-0199", address: null },
    { id: "c_paul", name: "Paul Machaka", email: null, phone: "819-238-7263", address: null },
    { id: "c_josie", name: "Josie Muggeo", email: null, phone: null, address: null },
    { id: "c_jsmith", name: "John Smith", email: "john@two.example", phone: null, address: null },
    { id: "c_twins", name: "Sam Lee", email: null, phone: null, address: null },
    { id: "c_new", name: "Brand New", email: "brand@new.example", phone: null, address: null },
    { id: "c_linked", name: "Suzy Ramzy", email: "suzy@example.com", phone: null, address: null },
  ],
  quotes: [
    tfQuote("q_acc", "Q2026-0033", "accepted", "c_lyne", "2026-03-01"),
    tfQuote("q_draft", "Q2026-0001", "draft", "c_new", "2026-01-15"),
    tfQuote("q_g", "Q2026-0134", "sent", "c_gladys", "2026-07-31"),
    tfQuote("q_l1", "Q2026-0078", "declined", "c_lyne", "2026-05-01"),
    tfQuote("q_l2", "Q2026-0079", "sent", "c_lyne", "2026-05-03"),
    tfQuote("q_var", "Q2026-0090", "declined", "c_variant", "2026-06-01"),
    tfQuote("q_ph", "Q2026-0019", "declined", "c_phone", "2026-02-20"),
    tfQuote("q_paul", "Q2026-0013", "sent", "c_paul", "2026-02-10"),
    tfQuote("q_josie", "Q2026-0060", "sent", "c_josie", "2026-04-10"),
    tfQuote("q_js", "Q2026-0061", "declined", "c_jsmith", "2026-04-11"),
    tfQuote("q_twins", "Q2026-0062", "declined", "c_twins", "2026-04-12"),
    tfQuote("q_new1", "Q2026-0070", "declined", "c_new", "2026-04-20"),
    tfQuote("q_new2", "Q2026-0071", "sent", "c_new", "2026-04-25"),
    tfQuote("q_marker", "Q2026-0080", "sent", "c_new", "2026-05-10"),
    tfQuote("q_numonly", "Q2026-0081", "sent", "c_new", "2026-05-11"),
    tfQuote("q_label", "Q2026-0082", "declined", "c_new", "2026-05-12"),
    tfQuote("q_linked", "Q2026-0137", "sent", "c_linked", "2026-08-01"),
  ],
};
const fqClient = (id, name, email, phone, created = "2026-09-15") => ({ id, companyId: CO, name, email, phone, address: null, city: null, province: null, country: "CA", language: null, createdAt: new Date(created) });
const FQ = {
  companyId: CO,
  clients: [
    fqClient("fq_lyne", "Lyne Tremblay", "lynetremblay@gmail.com", "905-516-0594"),
    fqClient("fq_marie", "Marie Tremblay", "marie.t@example.com", null),
    fqClient("fq_andre", "Andre Gurhan", null, "613-555-0199"),
    // The trap: TrueFinish's Paul shares a phone with two test clients.
    fqClient("fq_emilio", "Emilio", "emilio@example.com", "819-238-7263", "2026-09-01"),
    fqClient("fq_josie", "Josie Muggeo", "josie.muggeo@gmail.com", "613-784-0470"),
    fqClient("fq_john", "John Smith", "john@one.example", null),
    fqClient("fq_sam1", "Sam Lee", null, null, "2026-09-02"),
    fqClient("fq_sam2", "Sam Lee", null, null, "2026-09-02"),
    { ...fqClient("other_co", "Brand New", "brand@new.example", null), companyId: "co_other" },
  ],
  leads: [
    { id: "lead_gladys", companyId: CO, name: "Gladys Antonios Massaad", email: "glandant.ga@gmail.com", phone: "819-968-3577", status: "contacted", quoteId: null, createdAt: new Date("2026-10-04") },
    { id: "lead_lyne", companyId: CO, name: "Lyne Tremblay", email: "lynetremblay@gmail.com", phone: null, status: "new", quoteId: null, createdAt: new Date("2026-09-20") },
    { id: "lead_suzy", companyId: CO, name: "Suzy Ramzy", email: "suzy@example.com", phone: null, status: "new", quoteId: "q_someone_else", createdAt: new Date("2026-09-21") },
    { id: "lead_paul", companyId: CO, name: "Someone Else", email: null, phone: "819-238-7263", status: "new", quoteId: null, createdAt: new Date("2026-09-22") },
  ],
  quoteNumbers: ["Q-2026-H0002", "Q-2026-H0019", "Q-2026-0017"],
  jobNotes: ["Entered as a past job — TrueFinish Q2026-0033 / INV2026-0009 [truefinish:quote:q_acc]"],
  quoteNotes: [
    "Entered as a sent quote — TrueFinish Q2026-0080 [truefinish:quote:q_marker]",
    `${oldSystemLine("Q2026-0081")}\n\nSomebody rewrote the rest of this note.`,
    "Edited note — TrueFinish Q2026-0082, no marker any more",
  ],
  categories: [{ id: "cat_ref", key: "cabinet_refinishing", label: "Cabinet Refinishing" }],
};
const items = planRemainingQuotes(TF, FQ, { today: TODAY });
const byNum = (n) => items.find((i) => i.quote.quoteNumber === n);
{
  ok("accepted quote skipped", byNum("Q2026-0033").decision === "skip");
  ok("draft quote skipped", byNum("Q2026-0001").decision === "skip");
  ok("a TrueFinish sent quote is planned as kind sent", byNum("Q2026-0134").decision === "create" && byNum("Q2026-0134").kind === "sent");
  ok("a TrueFinish declined quote is planned as kind declined", byNum("Q2026-0078").kind === "declined" && byNum("Q2026-0078").recorded.declinedAt === null);
  ok("the source's createdAt and sentAt travel; declinedAt is null (TrueFinish never recorded it)",
    byNum("Q2026-0078").recorded.createdAt.toISOString().startsWith("2026-05-01") && byNum("Q2026-0078").recorded.sentAt instanceof Date);

  // Idempotency, in the plan.
  ok("skipped on its source marker", byNum("Q2026-0080").decision === "skip" && /marker/.test(byNum("Q2026-0080").reason));
  ok("skipped on an Old system: line even when the marker was edited away", byNum("Q2026-0081").decision === "skip" && /Q2026-0081/.test(byNum("Q2026-0081").reason));
  ok("skipped on a 'TrueFinish Q…' label alone", byNum("Q2026-0082").decision === "skip");
  const done = alreadyImported({ jobNotes: FQ.jobNotes, quoteNotes: FQ.quoteNotes });
  ok("markers on JOB notes count as imported (the accepted past jobs)", done.refs.has("truefinish:quote:q_acc"));

  // Clients.
  const lyne = byNum("Q2026-0078");
  ok("existing client matched by email", lyne.client.kind === "existing" && lyne.client.clientId === "fq_lyne" && /email/.test(lyne.client.by), lyne.client);
  ok("the same TrueFinish client's next quote reuses it", byNum("Q2026-0079").client.clientId === "fq_lyne" && byNum("Q2026-0079").client.batch === true);
  const variant = byNum("Q2026-0090");
  ok("the spelling variant (Tremblai/Tremblay) with the same email IS the existing client", variant.client.kind === "existing" && variant.client.clientId === "fq_marie", variant.client);
  ok("...and the plan says how FieldQuo spells the name", variant.notes.some((n) => /Marie Tremblay/.test(n)));
  const gladysAsClient = matchClient(
    { name: "Gladys Antionios Massaad", email: "Glandant.GA@gmail.com", phone: null },
    [fqClient("fq_gladys", "Gladys Antonios Massaad", "glandant.ga@gmail.com", "819-968-3577")],
    CO,
  );
  ok("Gladys Antionios (TrueFinish) is Gladys Antonios (FieldQuo) when the email agrees", gladysAsClient.kind === "existing" && gladysAsClient.clientId === "fq_gladys", gladysAsClient);
  const gladysByPhone = matchClient(
    { name: "Gladys Antionios Massaad", email: null, phone: "+1 819 968 3577" },
    [fqClient("fq_gladys", "Gladys Antonios Massaad", "glandant.ga@gmail.com", "819-968-3577")],
    CO,
  );
  ok("...or when the phone agrees", gladysByPhone.kind === "existing" && gladysByPhone.by === "phone", gladysByPhone);
  const gladysNameOnly = matchClient(
    { name: "Gladys Antionios Massaad", email: "gladant.ga@gmail.com", phone: null },
    [fqClient("fq_gladys", "Gladys Antonios Massaad", "glandant.ga@gmail.com", null)],
    CO,
  );
  ok("...but a near name with a DIFFERENT email is not merged into the client (a lead may link; a client record is not guessed)", gladysNameOnly.kind === "new", gladysNameOnly);
  ok("a lead matched on name alone, email one typo away, is linkable", matchLead({ name: "Gladys Antionios Massaad", email: "gladant.ga@gmail.com" }, FQ.leads, CO).lead?.id === "lead_gladys");
  ok("a lead sharing only a phone under another name is not linked", !matchLead({ name: "Paul Machaka", phone: "819-238-7263" }, FQ.leads, CO).lead);
  ok("matched by phone written another way", byNum("Q2026-0019").client.clientId === "fq_andre" && /phone/.test(byNum("Q2026-0019").client.by), byNum("Q2026-0019").client);
  const paul = byNum("Q2026-0013");
  ok("a phone shared under a DIFFERENT name is refused for a person, not filed under the test client",
    paul.decision === "error" && paul.problems.some((p) => /different name/.test(p)) && !paul.recorded, paul.problems);
  ok("exact name, nothing conflicting → existing", byNum("Q2026-0060").client.clientId === "fq_josie" && byNum("Q2026-0060").client.by === "exact name", byNum("Q2026-0060").client);
  ok("exact name but a different email → a different person (new)", byNum("Q2026-0061").client.kind === "new");
  ok("two equally good clients → refused, never picked", byNum("Q2026-0062").decision === "error" && byNum("Q2026-0062").problems.some((p) => /match equally/.test(p)));
  ok("another company's client is never a match", byNum("Q2026-0070").client.kind === "new");
  ok("a new client's second quote is marked as created earlier in the run", byNum("Q2026-0071").client.kind === "new" && byNum("Q2026-0071").client.batch === true);

  // Leads.
  const g = byNum("Q2026-0134");
  ok("Gladys's lead (name one typo away, email one typo away) is linked", g.lead?.id === "lead_gladys" && g.recorded.leadId === "lead_gladys", g.lead || g.notes);
  ok("...and its status is reported as unchanged", g.lead?.status === "contacted");
  ok("a lead links to the client's MOST RECENT quote only", byNum("Q2026-0079").recorded.leadId === "lead_lyne" && !byNum("Q2026-0078").recorded.leadId);
  const suzy = byNum("Q2026-0137");
  ok("a lead that already has a quote is left as it is", !suzy.recorded.leadId && suzy.notes.some((n) => /already has a quote/.test(n)), suzy.notes);
  const leadIds = items.filter((i) => i.recorded?.leadId).map((i) => i.recorded.leadId);
  ok("no lead is linked twice", new Set(leadIds).size === leadIds.length);

  // Numbering.
  const nums = items.filter((i) => i.decision === "create").map((i) => i.quoteNumber);
  ok("the historical series continues after H0019", nums[0] === "Q-2026-H0020", nums);
  ok("...one number each, never reused", new Set(nums).size === nums.length && nums.every((n) => /^Q-2026-H\d{4}$/.test(n)));
  ok("...never a live number", !nums.some((n) => /^Q-2026-\d{4}$/.test(n)));

  const s = summarise(items);
  ok("the summary counts what the table shows", s.create === nums.length && s.sent + s.declined === s.create && s.refused === 2, s);
}

// ── 6. The write: createRecordedQuote against an in-memory Prisma ──────────
const fakeDb = () => {
  let seq = 0;
  const T = { company: [], serviceCategory: [], client: [], quote: [], invoice: [], leadRequest: [] };
  const writes = [];
  const same = (a, b) => (a instanceof Date || b instanceof Date ? a != null && b != null && new Date(a).getTime() === new Date(b).getTime() : a === b);
  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(row, w));
      const val = row[k];
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("not" in v && (v.not === null ? val == null : same(val, v.not))) return false;
        if ("contains" in v && !(typeof val === "string" && val.includes(v.contains))) return false;
        if ("equals" in v && String(val).toLowerCase() !== String(v.equals).toLowerCase()) return false;
        if ("in" in v && !v.in.includes(val)) return false;
        return true;
      }
      return v === null ? val == null : same(val, v);
    });
  const db = { $executeRaw: async () => 1, $transaction: async (fn) => fn(db), T, writes };
  for (const t of Object.keys(T)) {
    db[t] = {
      findMany: async ({ where } = {}) => T[t].filter((r) => matches(r, where)).map((r) => ({ ...r })),
      findFirst: async ({ where } = {}) => { const r = T[t].find((x) => matches(x, where)); return r ? { ...r } : null; },
      findUnique: async ({ where } = {}) => { const r = T[t].find((x) => matches(x, where)); return r ? { ...r } : null; },
      create: async ({ data }) => { writes.push(`${t}.create`); const { scopeGroups, ...rest } = data; const r = { id: `${t}${++seq}`, createdAt: new Date(), ...rest, _scopeGroups: scopeGroups }; T[t].push(r); return { ...r }; },
      update: async ({ where, data }) => { writes.push(`${t}.update`); const r = T[t].find((x) => matches(x, where)); Object.assign(r, data); return { ...r }; },
      updateMany: async ({ where, data }) => { writes.push(`${t}.updateMany`); const hits = T[t].filter((x) => matches(x, where)); for (const h of hits) Object.assign(h, data); return { count: hits.length }; },
    };
  }
  // Any model this file did not script — job, invoice writes, payment, task,
  // message, followUpLog, outboundCallTask … — throws the moment it is touched.
  return new Proxy(db, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      throw new Error(`fakeDb: db.${String(prop)} touched — a recorded quote must not reach it`);
    },
  });
};
{
  const db = fakeDb();
  db.T.company.push({ id: CO, defaultLanguage: "en", taxRate: 0, autoApplyLocalTax: true, taxMode: null, province: "ON", country: "CA", vatRegistered: null, usTaxOverrides: null, taxRates: [] });
  db.T.serviceCategory.push({ id: "cat_ref", key: "cabinet_refinishing", label: "Cabinet Refinishing", isSystem: true });
  db.T.quote.push({ id: "h19", companyId: CO, quoteNumber: "Q-2026-H0019", status: "declined", historicalImportedAt: new Date("2026-10-04"), reviewNotes: "x" });
  db.T.leadRequest.push(
    { id: "lead_gladys", companyId: CO, name: "Gladys Antonios Massaad", status: "contacted", quoteId: null },
    { id: "lead_taken", companyId: CO, name: "Taken", status: "new", quoteId: "q_by_a_person" },
    { id: "lead_foreign", companyId: "co_other", name: "Foreign", status: "new", quoteId: null },
  );
  const ctx = await loadPastJobContext(db, CO);
  const row = { clientName: "Gladys Antionios Massaad", clientEmail: "gladant.ga@gmail.com", clientPhone: null, clientAddress: null, quoteDate: base.createdAt };
  const cat = { id: "cat_ref", key: "cabinet_refinishing" };
  const writesBefore = db.writes.length;
  const r = await createRecordedQuote(db, { companyId: CO, row, category: cat, context: ctx, now: TODAY, recorded: { ...base, leadId: "lead_gladys" } });
  const q = db.T.quote.find((x) => x.id === r.quoteId);
  ok("a sent quote is created", r.status === "created" && q?.status === "sent", r);
  ok("...historical, created via import", q?.historicalImportedAt === TODAY && q.createdVia === "import");
  ok("...with the source's sent moment and created moment", q?.sentAt?.toISOString() === base.sentAt.toISOString() && q.createdAt?.toISOString() === base.createdAt.toISOString());
  ok("...never decided, never accepted", q?.declinedAt == null && q.acceptedAt == null && q.acceptedTotal == null);
  ok("...no share token (nothing a client can open)", q?.shareToken == null);
  ok("...in the H series", q?.quoteNumber === "Q-2026-H0020", q?.quoteNumber);
  ok("...the source's figures and lines, as stored", q?.total === 5215.27 && q.tax === 600 && q.lineItems === fig.lineItems);
  ok("...in the source document's language", q?.language === "en");
  ok("...with Old system: Q2026-0134 as the note's FIRST line", q?.reviewNotes.split("\n")[0] === "Old system: Q2026-0134", q?.reviewNotes);
  ok("...that the quote page reads back", oldSystemNumber(q?.reviewNotes) === "Q2026-0134");
  ok("...and the source marker the re-run is skipped on", q?.reviewNotes.includes("[truefinish:quote:tfq134]"));
  ok("...under its service, like any past job", q?._scopeGroups?.create?.[0]?.categoryId === "cat_ref");
  const lead = db.T.leadRequest.find((l) => l.id === "lead_gladys");
  ok("the empty lead is linked to it", r.leadLinked === true && lead.quoteId === q?.id);
  ok("...and the lead's status is untouched", lead.status === "contacted");
  const touched = new Set(db.writes.slice(writesBefore).map((w) => w.split(".")[0]));
  ok("only a client, a quote and the lead column were written — no job, invoice, payment or task",
    [...touched].every((t) => ["client", "quote", "leadRequest"].includes(t)), [...touched]);

  const again = await createRecordedQuote(db, { companyId: CO, row, category: cat, context: ctx, now: TODAY, recorded: { ...base, leadId: "lead_gladys" } });
  ok("a re-run is a no-op: skipped on its marker under the lock", again.status === "skipped" && again.reason === "source_ref", again);
  ok("...one quote, still", db.T.quote.filter((x) => x.reviewNotes?.includes("[truefinish:quote:tfq134]")).length === 1);

  const declined = await createRecordedQuote(db, {
    companyId: CO, row: { ...row, clientName: "Other Person", clientEmail: "other@example.com" }, category: null, context: ctx, now: TODAY,
    recorded: { ...base, kind: "declined", sourceRef: "truefinish:quote:tfq90", oldNumber: "Q2026-0090", declinedAt: null, declineReason: null, leadId: "lead_taken" },
  });
  const dq = db.T.quote.find((x) => x.id === declined.quoteId);
  ok("a declined quote is created declined, with no invented decline date or reason", dq?.status === "declined" && dq.declinedAt === null && dq.declineReason === null, dq);
  ok("...still historical, still with the source's sentAt", dq?.historicalImportedAt === TODAY && dq.sentAt?.toISOString() === base.sentAt.toISOString());
  ok("a lead someone already linked keeps its link", declined.leadLinked === false && db.T.leadRequest.find((l) => l.id === "lead_taken").quoteId === "q_by_a_person");

  const foreign = await createRecordedQuote(db, {
    companyId: CO, row: { ...row, clientName: "Third Person", clientEmail: "third@example.com" }, category: null, context: ctx, now: TODAY,
    recorded: { ...base, sourceRef: "truefinish:quote:tfq3", oldNumber: "Q2026-0003", leadId: "lead_foreign" },
  });
  ok("another company's lead is never linked", foreign.status === "created" && foreign.leadLinked === false && db.T.leadRequest.find((l) => l.id === "lead_foreign").quoteId === null);
  ok("no job, invoice or payment exists after all of it", db.T.invoice.length === 0);
}

// ── 7. No sends: every path that could reach the client refuses these rows ─
{
  const historicalSent = {
    id: "q1", companyId: CO, status: "sent", needsReview: false,
    sentAt: new Date("2026-04-10"), historicalImportedAt: TODAY,
    client: { phone: "+16135550100", name: "Old Client" }, company: { outboundCallsEnabled: true },
  };
  ok("Call about this quote is refused on an imported sent quote (it has a sentAt)", manualQuoteCallGate(historicalSent).allowed === false);
  ok("...while the same quote, live, may be called about (the control)", manualQuoteCallGate({ ...historicalSent, historicalImportedAt: null }).allowed === true);
  ok("...and an imported DECLINED quote is refused too", manualQuoteCallGate({ ...historicalSent, status: "declined" }).allowed === false);

  const { chase, rest } = rankQuotes([
    { id: "live", status: "sent", sentAt: "2026-09-30", historicalImportedAt: null },
    { id: "old", status: "sent", sentAt: "2026-02-10", historicalImportedAt: "2026-10-05" },
  ], TODAY);
  ok("the quotes list's follow-up group holds the live quote only", chase.map((q) => q.id).join() === "live");
  ok("...the imported sent quote is still listed, below", rest.some((q) => q.id === "old"));

  const followUps = code("app/api/cron/follow-ups/route.js");
  const finder = followUps.split("async function findQuoteNoResponse")[1]?.split("async function")[0] || "";
  ok("follow-ups cron: NOT_HISTORICAL is historicalImportedAt: null", /const NOT_HISTORICAL = \{ historicalImportedAt: null \}/.test(followUps));
  ok("follow-ups cron: the quote_no_response finder spreads it", /status: "sent"[\s\S]*\.\.\.NOT_HISTORICAL/.test(finder));
  const leadFinder = followUps.split("async function findLeadNoResponse")[1]?.split("async function")[0] || "";
  ok("follow-ups cron: a lead with a quote is never chased (quoteId: null)", /quoteId: null/.test(leadFinder));
  ok("large-quote-check skips historical quotes", /historicalImportedAt: null/.test(code("app/api/cron/large-quote-check/route.js")));
  ok("the send/follow-up route refuses a historical quote", /if \(quote\.historicalImportedAt\)\s*\{[\s\S]{0,200}status: 409/.test(code("app/api/quotes/[id]/send/route.js")));
  ok("the automatic voice callback refuses a historical quote", /if \(quote\.historicalImportedAt\) return \{ allowed: false/.test(code("lib/voice/triggers.js")));
  ok("the manual call route runs the same gate", /manualQuoteCallGate\(quote\)/.test(code("app/api/quotes/[id]/call/route.js")) && /historicalImportedAt: true/.test(code("lib/voice/triggers.js")));
  ok("acceptance never builds a job or invoice for a historical quote", /if \(flagged\?\.historicalImportedAt\) return \{ job: null, invoice: null \}/.test(code("lib/quotes/quoteLifecycle.js")));
  ok("no auto-created task for a historical quote", /if \(quote\.historicalImportedAt\) return null/.test(code("lib/tasks/autoCreate.js")));

  // Nothing in the import's own graph can send.
  const SENDERS = /from\s+["'](?:@\/lib\/(?:email|sms|voice|tasks|notifications|messaging|followUps)\/|resend|twilio)/;
  for (const f of ["scripts/import-truefinish-quotes.mjs", "scripts/truefinish/remainingQuotes.mjs", "scripts/truefinish/source.mjs", "lib/jobs/importPastJob.js", "lib/jobs/pastJobImport.js"]) {
    ok(`${f} imports no mailer, SMS, voice, task or messaging module`, !SENDERS.test(read(f)));
  }
  const runner = code("scripts/import-truefinish-quotes.mjs");
  ok("the runner is dry unless --apply, and drops DATABASE_URL before product code loads",
    /const APPLY = flag\("apply"\)/.test(runner) && runner.indexOf("delete process.env.DATABASE_URL") < runner.indexOf('await import("./truefinish/remainingQuotes.mjs")'));
  ok("the runner's dry run reads inside a read-only transaction", /BEGIN TRANSACTION READ ONLY/.test(read("scripts/truefinish/source.mjs")));
  ok("the runner writes only through createRecordedQuote", !/\.(create|update|upsert|delete)(Many)?\(/.test(runner.replace(/createRecordedQuote/g, "")));
}

// ── 8. "Old system: …" is read where it is shown ──────────────────────────
{
  const page = read("app/app/quotes/[id]/page.js");
  ok("the quote page reads the old number", /oldSystemNumber\(quote\.reviewNotes\)/.test(page) && /app\.pastJobs\.oldSystem/.test(page));
  const msgs = read("app/i18n/appMessages.js");
  ok("the label exists in all nine languages", (msgs.match(/"app\.pastJobs\.oldSystem":/g) || []).length === 9);
  ok("a note with no such line shows nothing", oldSystemNumber("Entered as a lost quote — TrueFinish Q2026-0075 [truefinish:quote:x]") === null);
  ok("a mid-sentence mention is not a number", oldSystemNumber("We moved from the Old system: never mind") === null);
}

console.log(`check-truefinish-quote-import: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
