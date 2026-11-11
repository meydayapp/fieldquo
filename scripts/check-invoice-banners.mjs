// scripts/check-invoice-banners.mjs
//
// A banner on an invoice is a claim made in the contractor's voice. The two
// ways to get it wrong are both expensive:
//
//   * A false claim — "overdue by 12 days" over an invoice that was paid last
//     week, next to a Chase button that would email the client asking again.
//   * A claim over a document that has been replaced — offering to send,
//     chase or take payment on a superseded version.
//
// So the selection is a pure function and this drives it through the states a
// real invoice actually passes through. Anything that renders a banner must go
// through selectInvoiceBanners; a condition written inline on the page is a
// condition nothing here can check.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-invoice-banners.mjs

import {
  selectInvoiceBanners,
  invoiceMoney,
  calendarDaysBetween,
  PAID_EPSILON,
  stripBannerMoney,
} from "@/lib/invoices/lifecycle";
import {
  currentVersionId,
  familySize,
  invoiceHref,
  invoiceVersionHref,
  askedForVersion,
  resolveInvoiceVersionView,
} from "@/lib/invoices/currentVersion";
import { groupInvoiceLineItems } from "@/lib/invoices/documentGroups";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`,
  );
};

const NOW = new Date("2026-08-25T14:00:00");
const ids = (input) => selectInvoiceBanners({ now: NOW, ...input }).map((b) => b.id);
const find = (input, id) =>
  selectInvoiceBanners({ now: NOW, ...input }).find((b) => b.id === id) || null;

// A sent, unpaid, in-date invoice with a job on the board and a visit booked to
// somebody. Nothing about it is actionable, so it is the baseline every test
// below perturbs one fact at a time.
const client = { name: "ZZ Client", email: "zz@example.com" };
const job = {
  id: "job1",
  title: "204 Avro Cir",
  visits: [
    {
      id: "v1",
      scheduledAt: "2026-09-01T09:00:00",
      assignedToId: "u1",
    },
  ],
};
const base = {
  id: "inv1",
  status: "sent",
  version: 1,
  parentInvoiceId: null,
  versions: [],
  client,
  clientId: "c1",
  total: 2100,
  subtotal: 2000,
  amountPaid: 0,
  amountDue: 2100,
  dueDate: "2026-09-10T00:00:00",
  sentAt: "2026-08-20T10:00:00",
  sentToEmail: "zz@example.com",
  quoteId: "q1",
};

console.log("\nA quiet invoice raises nothing");
t("sent, in date, job scheduled and staffed", ids({ invoice: base, job }), []);

console.log("\nPaid invoices are never chased");
const paid = {
  ...base,
  status: "paid",
  amountPaid: 2100,
  amountDue: 0,
  paidDate: "2026-08-22T12:00:00",
  // The due date is in the PAST and the invoice is paid. This is the case the
  // whole file exists for.
  dueDate: "2026-08-01T00:00:00",
};
t("no overdue banner on a paid invoice", ids({ invoice: paid, job }).includes("overdue"), false);
t("it says paid instead", ids({ invoice: paid, job }).includes("paid"), true);
t("and offers no chase action",
  selectInvoiceBanners({ invoice: paid, job, now: NOW }).some((b) => b.action === "chase"),
  false);
t("an open chase task cannot resurrect the chase banner on a paid invoice",
  ids({ invoice: paid, job, chaseTask: { id: "t1", status: "open", dueDate: "2026-08-01" } })
    .includes("chaseDue"),
  false);
t("float residue still counts as paid",
  ids({ invoice: { ...paid, amountDue: 0.0000000001 }, job }).includes("paid"),
  true);

console.log("\nRefunded and disputed (money-fixes finding #1)");
// computeInvoiceState (lib/invoices/computeInvoiceState.js) is what SETS
// amountPaid/amountDue/amountRefunded/status on a real invoice; this file
// only checks that selectInvoiceBanners reads status honestly once it's set,
// the same division of labour the rest of this file already keeps.
const refunded = {
  ...base,
  status: "refunded",
  amountPaid: 0,
  amountDue: 2100,
  amountRefunded: 2100,
  dueDate: "2026-08-01T00:00:00", // in the past — must not ALSO read overdue
};
t("a fully refunded invoice shows 'refunded', not 'paid'",
  ids({ invoice: refunded, job }).includes("refunded"), true);
t("...and never 'paid' — the money isn't there any more",
  ids({ invoice: refunded, job }).includes("paid"), false);
t("...with the refunded amount attached",
  find({ invoice: refunded, job }, "refunded")?.data.refunded, 2100);

const partiallyRefunded = {
  ...base,
  status: "partially_refunded",
  amountPaid: 1600,
  amountDue: 500,
  amountRefunded: 500,
};
t("a PARTIAL refund is a different banner from a full one",
  ids({ invoice: partiallyRefunded, job }).includes("partiallyRefunded"), true);
t("...and is not the full-refund banner too",
  ids({ invoice: partiallyRefunded, job }).includes("refunded"), false);

const disputed = { ...base, status: "disputed", amountPaid: 2100, amountDue: 0 };
t("an open dispute shows its own banner, outranking 'paid'",
  ids({ invoice: disputed, job }).includes("disputed"), true);
t("...even though the money hasn't technically left yet (amountDue is 0)",
  ids({ invoice: disputed, job }).includes("paid"), false);
// Disputed and overdue are compatible facts — see lib/invoices/lifecycle.js's
// own comment on why this does NOT return early the way superseded does.
const disputedAndLate = { ...disputed, dueDate: "2026-08-01T00:00:00" };
t("disputed does not suppress a genuinely overdue balance",
  ids({ invoice: disputedAndLate, job }).includes("disputed"), true);

console.log("\nstripBannerMoney redacts the refunded figure too");
const strippedRefunded = stripBannerMoney(selectInvoiceBanners({ invoice: refunded, job, now: NOW }));
const refundedBanner = strippedRefunded.find((b) => b.id === "refunded");
t("the dollar figure is REMOVED, not zeroed", refundedBanner?.data.refunded === undefined, true);
t("...and flagged, the same as every other money banner", refundedBanner?.pricingHidden, true);

console.log("\nA $0 invoice owes nothing but was never paid");
t("no invented payment",
  ids({ invoice: { ...base, total: 0, amountDue: 0, amountPaid: 0 }, job }),
  []);

console.log("\nOverdue");
const late = { ...base, dueDate: "2026-08-13T00:00:00" };
t("fires when the due day has passed", ids({ invoice: late, job }).includes("overdue"), true);
t("counts calendar days, not milliseconds", find({ invoice: late, job }, "overdue").data.days, 12);
t("the action is to chase", find({ invoice: late, job }, "overdue").action, "chase");
t("tone is critical", find({ invoice: late, job }, "overdue").tone, "critical");
t("due TODAY is not yet late",
  ids({ invoice: { ...base, dueDate: "2026-08-25T00:00:00" }, job }).includes("overdue"),
  false);
t("...even at 2pm on the due day",
  calendarDaysBetween("2026-08-25T00:00:00", NOW),
  0);
t("due tomorrow is not late",
  ids({ invoice: { ...base, dueDate: "2026-08-26T00:00:00" }, job }).includes("overdue"),
  false);
t("no due date, no claim about lateness",
  ids({ invoice: { ...base, dueDate: null }, job }).includes("overdue"),
  false);

console.log("\nA draft was never billed, so nobody is late");
const staleDraft = {
  ...base,
  status: "draft",
  sentAt: null,
  sentToEmail: null,
  dueDate: "2026-07-01T00:00:00",
};
t("no overdue on an unsent draft", ids({ invoice: staleDraft, job }).includes("overdue"), false);
t("it says the invoice hasn't been sent", ids({ invoice: staleDraft, job }).includes("unsent"), true);
t("and offers Send", find({ invoice: staleDraft, job }, "unsent").action, "send");

console.log("\nPart payment");
const part = { ...base, amountPaid: 500, amountDue: 1600 };
t("partially paid is stated", ids({ invoice: part, job }).includes("partiallyPaid"), true);
t("with both figures", find({ invoice: part, job }, "partiallyPaid").data.paid, 500);
t("it is not also 'paid'", ids({ invoice: part, job }).includes("paid"), false);
t("a part-paid DRAFT offers no chase — nothing was ever sent",
  find({ invoice: { ...part, status: "draft", sentAt: null }, job }, "partiallyPaid").action,
  null);

console.log("\nThe client has no email address");
const noEmail = { ...base, client: { name: "ZZ Client", email: "  " } };
t("blocks send and chase, so it is said up front",
  ids({ invoice: noEmail, job }).includes("noClientEmail"),
  true);
t("not raised once the invoice is settled",
  ids({ invoice: { ...paid, client: { name: "ZZ", email: null } }, job })
    .includes("noClientEmail"),
  false);

console.log("\nThe chase task");
const openDue = { id: "t1", status: "open", dueDate: "2026-08-27T09:00:00" };
const openPast = { id: "t1", status: "open", dueDate: "2026-08-24T09:00:00" };
t("an open task not yet due raises nothing",
  ids({ invoice: base, job, chaseTask: openDue }).includes("chaseDue"), false);
t("an open task that has come due does",
  ids({ invoice: base, job, chaseTask: openPast }).includes("chaseDue"), true);
t("a task due TODAY counts as due",
  ids({ invoice: base, job, chaseTask: { id: "t", status: "open", dueDate: "2026-08-25T09:00" } })
    .includes("chaseDue"),
  true);
t("a task somebody already ticked off is not re-raised",
  ids({ invoice: base, job, chaseTask: { ...openPast, status: "done" } }).includes("chaseDue"),
  false);
t("never on an invoice that was never sent",
  ids({ invoice: staleDraft, job, chaseTask: openPast }).includes("chaseDue"),
  false);

console.log("\nSuperseded versions offer exactly one thing");
const superseded = {
  ...base,
  version: 1,
  versions: [{ id: "inv2", version: 2 }],
  dueDate: "2026-07-01T00:00:00", // would otherwise be loudly overdue
};
t("only the superseded banner", ids({ invoice: superseded, job }), ["superseded"]);
t("pointing at the version that replaced it",
  find({ invoice: superseded, job }, "superseded").data.latestId, "inv2");
t("no send, no chase, no payment prompt",
  selectInvoiceBanners({ invoice: superseded, job, now: NOW })
    .some((b) => ["send", "chase"].includes(b.action)),
  false);
t("an OLDER sibling version does not make this one superseded",
  ids({ invoice: { ...base, version: 3, versions: [{ id: "x", version: 2 }] }, job }),
  []);
// A revision is a CHILD of the root, so v2's own `versions` relation is empty
// and it would read as current with v3 sitting beside it. The lifecycle route
// therefore hands the whole family in; this pins the behaviour that depends on
// it, and the highest version must win rather than the last one listed.
const midVersion = {
  ...base,
  version: 2,
  parentInvoiceId: "root",
  versions: [
    { id: "root", version: 1 },
    { id: "v3", version: 3 },
    { id: "v4", version: 4 },
  ],
};
t("a middle version is superseded by a later sibling",
  ids({ invoice: midVersion, job }), ["superseded"]);
t("...and points at the highest, not the last listed",
  find({ invoice: midVersion, job }, "superseded").data.latestId, "v4");
t("the family including itself does not make it its own successor",
  ids({
    invoice: { ...base, version: 2, parentInvoiceId: "root",
      versions: [{ id: "root", version: 1 }, { id: "inv1", version: 2 }] },
    job,
  }),
  []);

// ══ Which version a link opens, and which one the page renders ════════════
//
// The banners above are right about a version that has been replaced. What was
// wrong was being SENT to it: every link in the office points at the family
// root, and after one amendment the root is the v1 snapshot. The office saved
// an amendment and kept being handed the document it had just replaced.
//
// The href and the page have to agree, so there is ONE rule
// (lib/invoices/currentVersion.js) and both call it. These drive that rule
// through the shapes each side actually holds — the list row carries the
// Prisma `versions` relation, the detail page carries the family from
// GET /api/invoices/[id]/versions — because a function that is only ever
// exercised with one of them is a function that works on one screen.
console.log("\nWhich version a link opens");

// The live shape, 2026-11-11: INV-2026-0052, amended once. The root keeps its
// id and its v1 total; the client holds v2.
const root = { id: "r", version: 1, parentInvoiceId: null, versions: [{ id: "v2", version: 2 }] };
const v2 = { id: "v2", version: 2, parentInvoiceId: "r", versions: [] };
const family = [
  { id: "r", version: 1 },
  { id: "v2", version: 2 },
];

t("the root of an amended family is not the current version",
  currentVersionId(root), "v2");
t("an unamended invoice is its own current version",
  currentVersionId({ id: "solo", version: 1, versions: [] }), "solo");
t("a child row resolves through the family, not its empty children relation",
  currentVersionId(v2, family), "v2");
t("a middle version resolves to the highest, not to itself",
  currentVersionId({ id: "v2", version: 2, parentInvoiceId: "r" },
    [{ id: "r", version: 1 }, { id: "v2", version: 2 }, { id: "v3", version: 3 }]),
  "v3");
// Ordered by version NUMBER. A family whose rows were written out of order —
// an import, a repair — has a latest version that is not its newest id, and
// "last row wins" would hand the office the wrong document with no banner on
// it, because the banner rule counts versions too.
t("the latest is the highest version, not the last id listed",
  currentVersionId({ id: "a", version: 1 },
    [{ id: "a", version: 1 }, { id: "zzz", version: 3 }, { id: "bbb", version: 2 }]),
  "zzz");
t("a version with no number does not outrank a real one",
  currentVersionId(root, [{ id: "r", version: 1 }, { id: "v2", version: 2 }, { id: "junk" }]),
  "v2");

t("the list links the version that stands", invoiceHref(root), "/app/invoices/v2");
t("...and an unamended one links itself",
  invoiceHref({ id: "solo", version: 1, versions: [] }), "/app/invoices/solo");
// GET /api/invoices resolves the same thing with the same function and ships
// it as `currentVersionId`. The href prefers it — the field had no reader at
// all until this link used it.
t("the href uses the id the API already resolved",
  invoiceHref({ ...root, currentVersionId: "v2" }), "/app/invoices/v2");
t("...and agrees with computing it from the row",
  invoiceHref({ ...root, currentVersionId: currentVersionId(root) }), invoiceHref(root));

console.log("\nThe detail page renders the version that stands");
const view = (invoice, fam, asked) =>
  resolveInvoiceVersionView({ invoice, family: fam, askedForThisVersion: asked });

t("a replaced version is not rendered — it redirects to the current one",
  (() => { const v = view(root, family, false); return [v.render, v.redirectTo]; })(),
  [false, "v2"]);
t("the current version renders, with no redirect",
  (() => { const v = view(v2, family, false); return [v.render, v.redirectTo]; })(),
  [true, null]);
// Always-redirect would make v1 unreachable, and v1 is a document a household
// received. The explicit flag is the way back in.
t("asked for on purpose, the replaced version renders where it is",
  (() => { const v = view(root, family, true); return [v.render, v.redirectTo]; })(),
  [true, null]);
t("...and it is still the superseded banner that greets it",
  ids({ invoice: { ...base, id: "r", version: 1, versions: [{ id: "v2", version: 2 }] }, job }),
  ["superseded"]);
t("an unamended invoice renders without consulting anything",
  (() => {
    const v = view({ id: "solo", version: 1, versions: [] }, [{ id: "solo", version: 1 }], false);
    return [v.render, v.redirectTo];
  })(),
  [true, null]);
// The versions endpoint can refuse or fail. A page that waited for it would
// never draw; a page that redirected on an empty family would bounce to
// itself. Neither: it renders what it loaded, and the banner still protects.
t("no family loaded → render what we have rather than block the page",
  (() => { const v = view(v2, null, false); return [v.render, v.redirectTo]; })(),
  [true, null]);
t("a family that is only this row cannot redirect to itself",
  (() => { const v = view(v2, [{ id: "v2", version: 2 }], false); return [v.render, v.redirectTo]; })(),
  [true, null]);

console.log("\nEarlier versions is drawn only where there are any");
t("one version, no control", view({ id: "solo", version: 1, versions: [] }, [{ id: "solo", version: 1 }], false).showHistory, false);
t("a family of two, on the current version → the control",
  view(v2, family, false).showHistory, true);
t("...and never on a replaced version, which already has the banner",
  view(root, family, true).showHistory, false);
t("the family counts itself once, however the rows arrive",
  [familySize(root), familySize(v2, family), familySize(v2, [{ id: "v2", version: 2 }])],
  [2, 2, 1]);

console.log("\nThe flag the history list emits is the flag the page honours");
t("the history list emits it",
  invoiceVersionHref("r"), "/app/invoices/r?history=1");
t("...and the page reads it back",
  askedForVersion(new URL(`https://x.test${invoiceVersionHref("r")}`).search), true);
t("the banner's Open-the-current-version link carries no flag",
  [invoiceVersionHref("v2", { history: false }), askedForVersion("")],
  ["/app/invoices/v2", false]);
t("a plain office link is not read as asking for history",
  askedForVersion(new URL(`https://x.test${invoiceHref(root)}`).search), false);
// `?history=0` is somebody saying no. A truthy-string test would read it as
// yes and put the replaced document back on screen.
t("only the flag's own value counts",
  [askedForVersion("history=0"), askedForVersion("history=yes"), askedForVersion("history=1")],
  [false, false, true]);

console.log("\nThe link to the work");
t("no job → offer to create one", ids({ invoice: base, job: null }).includes("noJob"), true);
t("...with the quote carried across",
  find({ invoice: base, job: null }, "noJob").data.quoteId, "q1");
t("a job with no visits → offer to schedule",
  ids({ invoice: base, job: { ...job, visits: [] } }).includes("jobUnscheduled"), true);
t("an upcoming visit with nobody on it → offer to assign",
  ids({
    invoice: base,
    job: { ...job, visits: [{ id: "v1", scheduledAt: "2026-09-01T09:00", assignedToId: null }] },
  }).includes("visitUnassigned"),
  true);
t("a PAST unassigned visit is history, not a prompt",
  ids({
    invoice: base,
    job: { ...job, visits: [{ id: "v1", scheduledAt: "2026-08-01T09:00", assignedToId: null }] },
  }),
  []);
t("a scheduled, staffed job raises nothing", ids({ invoice: base, job }), []);
t("a job with no visits but its OWN start/end date → no false 'needs a visit' claim",
  ids({
    invoice: base,
    job: { ...job, visits: [], startDate: "2026-09-01", endDate: "2026-09-14" },
  }).includes("jobUnscheduled"),
  false);
t("...raises nothing at all — dates are a complete answer, not a lesser one",
  ids({
    invoice: base,
    job: { ...job, visits: [], startDate: "2026-09-01", endDate: "2026-09-14" },
  }),
  []);
t("a start date with no end yet STILL counts as scheduled",
  ids({
    invoice: base,
    job: { ...job, visits: [], startDate: "2026-09-01", endDate: null },
  }).includes("jobUnscheduled"),
  false);

console.log("\nOrder: money before housekeeping");
const messy = { ...late, client: { name: "ZZ", email: null } };
t("overdue is read first",
  ids({ invoice: messy, job: null })[0], "overdue");
t("the job link comes last",
  ids({ invoice: messy, job: null }).at(-1), "noJob");

console.log("\ninvoiceMoney");
t("amountDue is trusted when present", invoiceMoney({ total: 100, amountPaid: 40, amountDue: 60 }).due, 60);
t("...and derived when it is not",
  invoiceMoney({ total: 100, amountPaid: 40, amountDue: null }).due, 60);
t("settled uses the same half-cent rule as the API",
  invoiceMoney({ total: 100, amountPaid: 100, amountDue: PAID_EPSILON }).settled, true);
t("a whole cent owing is not settled",
  invoiceMoney({ total: 100, amountPaid: 99.99, amountDue: 0.01 }).settled, false);
t("garbage in is not a payment",
  invoiceMoney({ total: "abc", amountPaid: undefined, amountDue: NaN }),
  { total: 0, paid: 0, due: 0, settled: true, partiallyPaid: false });

console.log("\nNo invoice, no banners");
t("null invoice", selectInvoiceBanners({ invoice: null }), []);
t("no argument at all", selectInvoiceBanners(), []);

// ───────────────────────────────────────────────────────────────────────────
// Regrouping the billed lines
// ───────────────────────────────────────────────────────────────────────────
//
// The prefix match is the part that could quietly invent a scope group, so it
// is checked against the case that tempts a naive split(": ").

console.log("\ngroupInvoiceLineItems");
const scope = [
  { id: "g1", label: "Interior Painting", categoryKey: "interior_painting", sortOrder: 0 },
  { id: "g2", label: "Flooring", categoryKey: "flooring", sortOrder: 1 },
];
const grouped = groupInvoiceLineItems(
  [
    { description: "Interior Painting: Walls and ceilings", amount: 1200 },
    { description: "Flooring: Vinyl plank, 420 sq ft", amount: 800 },
    { description: "Interior Painting: Trim", amount: 300 },
    { description: "Supply and fit: 3 drawers, soft close", amount: 250 },
  ],
  scope,
);
t("one group per matched label, in scope order", grouped.map((g) => g.label),
  ["Interior Painting", "Flooring", null]);
t("the label is stripped off each row",
  grouped[0].lineItems.map((i) => i.description),
  ["Walls and ceilings", "Trim"]);
t("group subtotal is the billed sum", grouped[0].subtotal, 1500);
t("an unmatched colon is NOT split into an invented group",
  grouped[2].lineItems[0].description,
  "Supply and fit: 3 drawers, soft close");
t("the leftover bucket says it is unmatched", grouped[2].matched, false);
t("the category rides along for trade content", grouped[0].categoryKey, "interior_painting");

t("no quote behind the invoice → one ungrouped list",
  groupInvoiceLineItems([{ description: "Callout", amount: 120 }], []).map((g) => [g.label, g.matched]),
  [[null, false]]);
t("longest label wins, so a prefix cannot steal another group's lines",
  groupInvoiceLineItems(
    [{ description: "Painting — exterior: Soffits", amount: 400 }],
    [
      { id: "a", label: "Painting", categoryKey: "p", sortOrder: 0 },
      { id: "b", label: "Painting — exterior", categoryKey: "pe", sortOrder: 1 },
    ],
  ).map((g) => g.label),
  ["Painting — exterior"]);
t("no line items, no groups", groupInvoiceLineItems(null, scope), []);
t("junk rows are dropped, not rendered as blanks",
  groupInvoiceLineItems([null, "nope", { description: "Callout", amount: 10 }], []).length, 1);

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — no invoice claims something that isn't true of it\n",
);
process.exit(fail ? 1 : 0);
