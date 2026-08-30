// scripts/check-voice-number-release.mjs
//
// Giving a phone number back, and knowing what we still pay for.
//
//   npm run check:number-release
//
// ── Why this one EXECUTES rather than reads ────────────────────────────────
//
// `releaseNumber()` is `DELETE /delete-phone-number/<e164>`: the number is
// deleted at Retell, returns to the carrier's pool, and cannot be recovered.
// The two ways to get it wrong both cost money and neither one is visible:
//
//   the row says released and the provider still has it   FieldQuo pays for
//       ever, and nothing in the app ever looks at a released row again.
//   the row stays held and the provider has dropped it    the contractor's
//       line is dead and the rent cron keeps charging them for it.
//
// Neither is reachable by clicking anything, and there is no RETELL_API_KEY in
// local .env, so none of it can be exercised against the real provider. What
// CAN be exercised is every decision and every write — with the provider
// replaced by fakes that refuse, that lie, and that go quiet. That is what this
// does: the refusal paths run for real and assert the row was never touched.
import { readFileSync } from "node:fs";
import { RetellError, listAllNumbers } from "@/lib/voice/retell";
import {
  planRelease,
  confirmGone,
  releaseAtProvider,
  releaseHeldNumber,
  HELD_STATUSES,
} from "@/lib/voice/numberRelease";
import { auditVoiceNumbers, normaliseProviderNumber } from "@/lib/voice/numberAudit";
import { rentDecision, RENT_PERIOD_DAYS } from "@/lib/voice/spendGate";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const NUM = "+15145550123";
const OTHER = "+15145559999";
const notFound = () => new RetellError("not found", { status: 404 });
const boom = (status = 500) => new RetellError("provider on fire", { status });

const row = (over = {}) => ({
  id: "num_1",
  companyId: "co_1",
  e164: NUM,
  status: "active",
  source: "purchased",
  numberType: "local",
  monthlyCents: 400,
  rentPaidThroughAt: new Date("2026-09-10T00:00:00Z"),
  rentGraceUntilAt: null,
  rentWarnedAt: null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

// ══ 1. Who may release, and what they have to say ══════════════════════════
//
// The one irreversible control in the product. Every refusal below is a phone
// line that did NOT get destroyed.

console.log("\nplanRelease — the two confirmations");

ok(
  "nothing to release refuses",
  planRelease({ target: null, confirm: NUM }).reason === "no_number",
);
ok(
  "an already-released row is not theirs to release again",
  planRelease({ target: row({ status: "released" }), confirm: NUM }).reason === "not_held",
  planRelease({ target: row({ status: "released" }), confirm: NUM }),
);
ok(
  "a `failed` row is not held either",
  planRelease({ target: row({ status: "failed" }), confirm: NUM }).reason === "not_held",
);
ok(
  "no confirmation at all refuses",
  planRelease({ target: row(), confirm: "" }).reason === "confirm_mismatch",
);
ok(
  "confirming a DIFFERENT number refuses — this is the misclick guard",
  planRelease({ target: row(), confirm: OTHER }).reason === "confirm_mismatch",
);
ok(
  "a truthy non-string confirmation does not slip through",
  planRelease({ target: row(), confirm: true }).reason === "confirm_mismatch",
);
ok(
  "the pretty form is not the identifier",
  planRelease({ target: row(), confirm: "(514) 555-0123" }).reason === "confirm_mismatch",
);

console.log("\nThe only working line needs a second yes");

ok(
  "their only active number refuses on one confirmation",
  planRelease({ target: row(), siblings: [row()], confirm: NUM }).reason === "sole_number",
);
ok(
  "...and goes through when they say so explicitly",
  planRelease({ target: row(), siblings: [row()], confirm: NUM, acknowledgeSoleNumber: true })
    .allowed === true,
);
ok(
  "...and the verdict still says it was the sole number, so the log can",
  planRelease({ target: row(), siblings: [row()], confirm: NUM, acknowledgeSoleNumber: true })
    .soleNumber === true,
);
ok(
  "a second active line means no extra gate",
  planRelease({
    target: row(),
    siblings: [row(), row({ id: "num_2", e164: OTHER })],
    confirm: NUM,
  }).allowed === true,
);
ok(
  "a STUCK row is not a working line — releasing it needs no second yes",
  planRelease({ target: row({ status: "provisioning" }), siblings: [row({ status: "provisioning" })], confirm: NUM })
    .allowed === true,
);
ok(
  "...and a sibling that is merely provisioning does not count as a spare",
  planRelease({
    target: row(),
    siblings: [row(), row({ id: "num_2", e164: OTHER, status: "provisioning" })],
    confirm: NUM,
  }).reason === "sole_number",
);
ok(
  "the target is not treated as its own sibling",
  planRelease({ target: row(), siblings: [], confirm: NUM }).reason === "sole_number",
);
ok("held statuses are the three heldNumber() counts", HELD_STATUSES.join(",") === "provisioning,active,porting");

// ══ 2. The provider has to agree, and be seen to ═══════════════════════════

console.log("\nconfirmGone — a 404 is evidence, silence is not");

ok("a 404 proves it is gone", (await confirmGone(NUM, { read: () => { throw notFound(); } })) === "gone");
ok(
  "the provider still returning it proves it is not",
  (await confirmGone(NUM, { read: async () => ({ phone_number: NUM }) })) === "present",
);
ok(
  "a 500 proves nothing",
  (await confirmGone(NUM, { read: () => { throw boom(); } })) === "unknown",
);
ok(
  "a timeout proves nothing",
  (await confirmGone(NUM, { read: () => { throw new RetellError("slow", { status: 504 }); } })) === "unknown",
);
ok(
  "a 200 with an empty body is not a 'no'",
  (await confirmGone(NUM, { read: async () => null })) === "unknown",
);

console.log("\nreleaseAtProvider — the DELETE alone is never enough");

{
  let readCalls = 0;
  const res = await releaseAtProvider(NUM, {
    release: () => { throw boom(); },
    read: () => { readCalls++; return null; },
  });
  ok("a refused DELETE fails", res.ok === false && res.reason === "provider_refused", res);
  ok("...and does not even bother reading back", readCalls === 0);
}
{
  const res = await releaseAtProvider(NUM, {
    release: () => { throw notFound(); },
    read: () => { throw notFound(); },
  });
  ok("a 404 on the DELETE is success — there was nothing to delete", res.ok === true, res);
  ok("...and is flagged as such, so the UI can say so", res.alreadyGone === true);
}
{
  const res = await releaseAtProvider(NUM, {
    release: async () => ({}),
    read: async () => ({ phone_number: NUM }),
  });
  ok(
    "a 200 DELETE with the number STILL there is a failure, not a success",
    res.ok === false && res.reason === "still_present",
    res,
  );
}
{
  const res = await releaseAtProvider(NUM, {
    release: async () => ({}),
    read: () => { throw boom(503); },
  });
  ok(
    "a 200 DELETE we could not verify is not treated as done",
    res.ok === false && res.reason === "unconfirmed",
    res,
  );
}
{
  const res = await releaseAtProvider(NUM, {
    release: async () => ({}),
    read: () => { throw notFound(); },
  });
  ok("a 200 DELETE confirmed by a 404 read-back is a release", res.ok === true && res.confirmed === true, res);
}

// ══ 3. The row moves ONLY on proof ═════════════════════════════════════════
//
// The heart of it. Every failure above must leave the database untouched — a
// row that says released while Retell bills us is invisible AND expensive.

console.log("\nreleaseHeldNumber — the row is untouched unless the provider agreed");

async function attempt(deps) {
  const writes = [];
  const result = await releaseHeldNumber(row(), {
    now: new Date("2026-08-26T12:00:00Z"),
    deps: { ...deps, write: async (id, data) => { writes.push({ id, data }); } },
  });
  return { result, writes };
}

{
  const { result, writes } = await attempt({ release: () => { throw boom(); }, read: async () => null });
  ok("a provider refusal reports failure", result.released === false, result);
  ok("...and writes NOTHING", writes.length === 0, writes);
}
{
  const { result, writes } = await attempt({
    release: async () => ({}),
    read: async () => ({ phone_number: NUM }),
  });
  ok("a number still present after the DELETE reports failure", result.released === false, result);
  ok("...and writes NOTHING — this is the expensive lie", writes.length === 0, writes);
}
{
  const { result, writes } = await attempt({ release: async () => ({}), read: () => { throw boom(); } });
  ok("an unverifiable release reports failure", result.reason === "unconfirmed", result);
  ok("...and writes NOTHING", writes.length === 0, writes);
}
{
  const { result, writes } = await attempt({ release: async () => ({}), read: () => { throw notFound(); } });
  ok("a confirmed release succeeds", result.released === true, result);
  ok("...and writes exactly one row", writes.length === 1, writes);
  ok("...to `released`", writes[0]?.data?.status === "released", writes[0]?.data);
  ok("...with a releasedAt", writes[0]?.data?.releasedAt instanceof Date);
  ok("...detached from the agent", writes[0]?.data?.agentId === null);
  ok("...with the past-due machinery cleared", writes[0]?.data?.rentGraceUntilAt === null && writes[0]?.data?.rentWarnedAt === null);
  ok(
    "...and rentPaidThroughAt left alone — it is the record of what was paid",
    !("rentPaidThroughAt" in (writes[0]?.data || {})),
    writes[0]?.data,
  );
}
{
  const { result, writes } = await attempt({ release: () => { throw notFound(); }, read: () => { throw notFound(); } });
  ok("a ghost row is cleared without a provider object to delete", result.released === true && result.alreadyGone === true, result);
  ok("...and still writes the row exactly once", writes.length === 1);
}
{
  const writes = [];
  const result = await releaseHeldNumber(null, { deps: { write: async (...a) => writes.push(a) } });
  ok("no row means no release and no write", result.released === false && writes.length === 0);
}

// ══ 4. A released number is never billed again ═════════════════════════════

console.log("\nRent stops, and a stuck number was never charged rent at all");

const balance = 10_000;
const now = new Date("2026-09-20T00:00:00Z"); // past the paid-through above

ok(
  "an active number past its paid-through IS charged",
  rentDecision({ number: row(), balanceCents: balance, now }).action === "charge",
);
ok(
  "...and the released version of the same row is not",
  rentDecision({ number: row({ status: "released" }), balanceCents: balance, now }).action === "skip",
  rentDecision({ number: row({ status: "released" }), balanceCents: balance, now }),
);
ok(
  "...for the reason the row states, not by accident",
  rentDecision({ number: row({ status: "released" }), balanceCents: balance, now }).reason ===
    "status_released",
);
ok(
  "a released number with a huge overdue balance is still not charged",
  rentDecision({
    number: row({ status: "released", rentPaidThroughAt: new Date("2020-01-01") }),
    balanceCents: balance,
    now,
  }).action === "skip",
);
ok(
  "a number stuck on `provisioning` for days is NOT charged monthly rent",
  rentDecision({ number: row({ status: "provisioning", rentPaidThroughAt: null }), balanceCents: balance, now })
    .action === "skip",
  rentDecision({ number: row({ status: "provisioning", rentPaidThroughAt: null }), balanceCents: balance, now }),
);
ok(
  "the rent cron only ever selects active rows, so it cannot see one either",
  /where: \{ status: "active" \}/.test(read("app/api/cron/voice-rent/route.js")),
);
ok(
  "a port in flight is not charged either",
  rentDecision({ number: row({ status: "porting" }), balanceCents: balance, now }).action === "skip",
);
// The end-to-end statement: release the row the way releaseHeldNumber does,
// then ask the gate again. This is the "stops the rent" claim, executed.
{
  const after = row({ status: "released", releasedAt: now, agentId: null, rentGraceUntilAt: null, rentWarnedAt: null });
  ok("the exact row releaseHeldNumber writes is never billed again", rentDecision({ number: after, balanceCents: balance, now }).action === "skip");
  ok(
    "...not even a period later",
    rentDecision({
      number: after,
      balanceCents: balance,
      now: new Date(now.getTime() + RENT_PERIOD_DAYS * 2 * 24 * 60 * 60 * 1000),
    }).action === "skip",
  );
}

// ══ 5. What Retell holds vs what we hold ═══════════════════════════════════

console.log("\nnormaliseProviderNumber — hostile shapes must not take the page down");

ok("null is dropped", normaliseProviderNumber(null) === null);
ok("a string is dropped", normaliseProviderNumber("+15145550123") === null);
ok("a row with no number is dropped", normaliseProviderNumber({ nickname: "x" }) === null);
ok("a non-E.164 is dropped", normaliseProviderNumber({ phone_number: "(514) 555-0123" }) === null);
ok("a real one survives", normaliseProviderNumber({ phone_number: NUM })?.e164 === NUM);
ok(
  "the deprecated scalar field is NOT read as an agent",
  normaliseProviderNumber({ phone_number: NUM, inbound_agent_id: "agent_x" })?.answering === false,
);
ok(
  "the weighted list is",
  normaliseProviderNumber({ phone_number: NUM, inbound_agents: [{ agent_id: "agent_x", weight: 1 }] })
    ?.boundAgent === "agent_x",
);
ok(
  "an empty routing list means nobody answers, not an unknown",
  normaliseProviderNumber({ phone_number: NUM, inbound_agents: [] })?.answering === false,
);

console.log("\nauditVoiceNumbers — the money leaving for nothing");

const company = { name: "Big Painter Inc" };
{
  const audit = auditVoiceNumbers({
    providerNumbers: [{ phone_number: NUM }, { phone_number: OTHER }],
    rows: [row({ e164: NUM, company })],
  });
  ok("a number Retell has and nobody holds is reported", audit.counts.unheld === 1, audit.counts);
  ok("...and named", audit.lines.find((l) => l.unheld)?.e164 === OTHER);
  ok("...with the reason 'no row of ours'", audit.lines.find((l) => l.unheld)?.unheldReason === "no_row");
  ok("...while the held one is attributed", audit.lines.find((l) => !l.unheld)?.holder?.companyName === "Big Painter Inc");
}
{
  // The exact bug the owner's question exposed: a path that marks a row
  // released and never tells the provider.
  const audit = auditVoiceNumbers({
    providerNumbers: [{ phone_number: NUM }],
    rows: [row({ status: "released", releasedAt: new Date("2026-08-01"), company })],
  });
  ok(
    "a row we marked released while Retell still has the number is reported",
    audit.counts.markedReleased === 1,
    audit.counts,
  );
  ok("...as unheld, because nobody is paying rent for it", audit.counts.unheld === 1);
  ok("...naming who used to hold it", audit.lines[0]?.lapsed?.companyName === "Big Painter Inc");
  ok("...and when we claimed to have given it back", Boolean(audit.lines[0]?.lapsed?.releasedAt));
}
{
  const audit = auditVoiceNumbers({
    providerNumbers: [],
    rows: [row({ company })],
  });
  ok(
    "a number the provider no longer has is reported as orphaned, not dropped",
    audit.counts.orphaned === 1 && audit.orphans[0]?.e164 === NUM,
    audit.counts,
  );
  ok("...and flagged as still taking the company's money", audit.orphans[0]?.billingRent === true);
  ok("...and it is NOT also counted as unheld", audit.counts.unheld === 0);
}
{
  const audit = auditVoiceNumbers({
    providerNumbers: [],
    rows: [row({ status: "provisioning", company })],
  });
  ok(
    "an orphaned row that is not active is reported without claiming rent is being taken",
    audit.counts.orphaned === 1 && audit.orphans[0]?.billingRent === false,
  );
}
{
  // Released once, sold the same number back later. The LIVE row wins, so this
  // is not a leak.
  const audit = auditVoiceNumbers({
    providerNumbers: [{ phone_number: NUM }],
    rows: [
      row({ id: "old", status: "released", releasedAt: new Date("2026-01-01"), createdAt: new Date("2025-01-01"), company }),
      row({ id: "new", status: "active", createdAt: new Date("2026-06-01"), company }),
    ],
  });
  ok("a re-bought number is held, not leaked", audit.counts.unheld === 0 && audit.counts.held === 1, audit.counts);
  ok("...and attributed to the live row", audit.lines[0]?.holder?.id === "new");
}
{
  const audit = auditVoiceNumbers({});
  ok("an empty account audits to zeroes rather than throwing", audit.counts.atProvider === 0 && audit.counts.unheld === 0);
  const junk = auditVoiceNumbers({ providerNumbers: [null, "x", {}], rows: [null, { status: "active" }] });
  ok("junk on both sides audits to zeroes rather than throwing", junk.counts.atProvider === 0 && junk.counts.orphaned === 0);
}

// ══ 6. Reading every page, and never spinning ══════════════════════════════

console.log("\nlistAllNumbers — the whole account, and a hard stop");

const realFetch = globalThis.fetch;
process.env.RETELL_API_KEY = process.env.RETELL_API_KEY || "test-key-not-real";
function stubPages(pages) {
  let i = 0;
  globalThis.fetch = async () => {
    const body = pages[Math.min(i, pages.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
}
try {
  stubPages([
    { items: [{ phone_number: NUM }], has_more: true, pagination_key: "p2" },
    { items: [{ phone_number: OTHER }], has_more: false },
  ]);
  const all = await listAllNumbers({ pageSize: 1 });
  ok("both pages are collected", all.items.length === 2, all.items.length);
  ok("...and it reports itself complete", all.complete === true);

  // A provider that says "more" for ever with the same cursor. Without the
  // guard this runs until the platform kills the request.
  stubPages([{ items: [{ phone_number: NUM }], has_more: true, pagination_key: "same" }]);
  const looped = await listAllNumbers({ pageSize: 1, pages: 50 });
  ok("a repeating cursor stops rather than spinning", looped.items.length <= 2, looped.items.length);

  // A provider with genuinely more pages than we will read.
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    return new Response(
      JSON.stringify({ items: [{ phone_number: NUM }], has_more: true, pagination_key: `p${n}` }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const capped = await listAllNumbers({ pageSize: 1, pages: 3 });
  ok("the page cap holds", capped.items.length === 3, capped.items.length);
  ok("...and says the list is INCOMPLETE rather than implying an empty account", capped.complete === false);
} finally {
  globalThis.fetch = realFetch;
}

// ══ 7. The wiring ══════════════════════════════════════════════════════════
//
// The logic above is worth nothing if nothing calls it, or if the control is
// reachable by someone who should not have it.

console.log("\nThe wiring");

const releaseRoute = read("app/api/settings/voice/number/release/route.js");
ok("there is a release route", releaseRoute.includes("export async function POST"));
ok("...owner/admin only", /requirePermission\(member\.role, "user:manage"\)/.test(releaseRoute));
ok("...refusing with a 403", /"Only an owner or admin can do this\."[\s\S]{0,80}status: 403/.test(releaseRoute));
ok("...scoped to the caller's own company", /companyId: member\.companyId, e164: confirm/.test(releaseRoute));
ok("...deciding through planRelease rather than inline", releaseRoute.includes("planRelease({"));
ok("...releasing through the one helper", releaseRoute.includes("releaseHeldNumber(target)"));
ok(
  "...and never marking a row released itself",
  !/voicePhoneNumber\.update/.test(releaseRoute) && !/status: "released"/.test(releaseRoute),
);
ok("...refusing outright when the provider is not configured", releaseRoute.includes("voiceConfigured()"));

const spendGate = read("lib/voice/spendGate.js");
ok("the rent cron's release goes through the same helper", spendGate.includes("releaseHeldNumber(number"));
ok("...and no longer calls the provider by hand", !spendGate.includes("releaseNumber(number.e164)"));
ok(
  "...still leaving the row active when the release fails, so tomorrow retries",
  spendGate.includes('action: "release_failed"'),
);

const numberRoute = read("app/api/settings/voice/number/route.js");
ok(
  "the port-cancel path refuses a port that has a provider number behind it",
  numberRoute.includes("held.providerId"),
);
ok(
  "...and points a live number at the release route instead of an email address",
  numberRoute.includes("app.setVoice.cancelNotPort"),
);

const repairRoute = read("app/api/settings/voice/number/repair/route.js");
ok(
  "the ghost repair still diagnoses server-side rather than trusting the request",
  repairRoute.includes("const before = await diagnoseNumber(member.companyId)"),
);
ok(
  "...and says why skipping the provider is sound there",
  repairRoute.includes("existsAtProvider === false"),
);

const platformRoute = read("app/api/platform/voice-numbers/route.js");
ok("the reconciliation route is superadmin-gated", platformRoute.includes("getCurrentPlatformAdmin"));
ok("...refusing with a 401 otherwise", /Unauthorized[\s\S]{0,40}status: 401/.test(platformRoute));
ok("...asking the PROVIDER rather than reading our own rows", platformRoute.includes("listAllNumbers()"));
// The query gained a `where` clause for `simulated: false` (demo numbers were
// never bought at Retell, so comparing them against the provider's real
// inventory would misreport every one as an "orphan" — see
// lib/voice/demoLine.js and scripts/check-demo-number-pool.mjs, which is where
// that exclusion is actually proven). The property this line exists to
// protect is narrower than "no where clause at all": released rows must still
// come through, so the assertion is that nothing filters on STATUS.
const findManyCall = platformRoute.slice(
  platformRoute.indexOf("db.voicePhoneNumber.findMany("),
  platformRoute.indexOf("});", platformRoute.indexOf("db.voicePhoneNumber.findMany(")),
);
ok(
  "...and including released rows, which is where the leak hides",
  findManyCall.includes("include:") && !/status\s*:/.test(findManyCall),
  `got: ${findManyCall}`,
);
ok(
  "...and editing nothing (AGENTS.md #3)",
  !/voicePhoneNumber\.(update|delete|create)/.test(platformRoute) && !platformRoute.includes("releaseNumber"),
);
ok(
  "the platform page is reachable from the console nav",
  read("app/components/platform/PlatformSidebar.js").includes('href: "/platform/voice-numbers"'),
);

const page = read("app/app/settings/voice/page.js");
ok("the settings screen renders a release control", page.includes("<ReleaseNumber"));
ok("...that posts to the release route", page.includes('"/api/settings/voice/number/release"'));
ok("...sending the E.164, not whatever was typed", /confirm: e164/.test(page));
ok("...and the sole-number acknowledgement", page.includes("acknowledgeSoleNumber"));
ok(
  "...disabled until the number is typed back",
  /disabled=\{busy \|\| !matches/.test(page),
);
ok(
  "...and, once the route says it is their last line, until that is acknowledged too",
  /\(soleWarning && !ack\)/.test(page),
);
// The sole-number gate must be the ROUTE's, not the page's. A checkbox ticked
// before anyone counted the company's lines would send a permanent yes and turn
// the server-side guard into decoration.
ok(
  "the extra confirmation only appears after the ROUTE refuses with sole_number",
  /refusal\?\.reason === "sole_number"/.test(page) && /\{soleWarning && \(/.test(page),
);
ok(
  "...so the first attempt never claims to have acknowledged it",
  /const \[ack, setAck\] = useState\(false\)/.test(page),
);
ok(
  "...naming the RENTED line for a forwarded setup, not the contractor's own",
  page.includes("number.forwardsToDisplay || number.e164"),
);
ok(
  "the old 'there is no button, email us' copy is gone",
  !page.includes("so it isn't a button on this page"),
);
ok("a port in flight is still cancelled, not released", page.includes("cancelPort"));

// ── Every new string exists, in every language the catalogue carries ───────
const NEW_KEYS = [...new Set([...page.matchAll(/"(app\.setVoice\.release\.[a-zA-Z]+)"/g)].map((m) => m[1]))];
ok("the release UI uses at least a dozen distinct strings", NEW_KEYS.length >= 12, NEW_KEYS.length);
for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
  const missing = NEW_KEYS.filter((k) => !(k in (APP_MESSAGES[lang] || {})));
  ok(`  ${lang} carries every release string`, missing.length === 0, missing);
}
const ROUTE_KEYS = [...new Set([...releaseRoute.matchAll(/errorKey: "([^"]+)"/g)].map((m) => m[1]))];
ok("the route's refusals all carry a key", ROUTE_KEYS.length >= 8, ROUTE_KEYS.length);
for (const lang of ["en", "fr"]) {
  const missing = ROUTE_KEYS.filter((k) => !(k in (APP_MESSAGES[lang] || {})));
  ok(`  ${lang} can render every refusal the route can send`, missing.length === 0, missing);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
