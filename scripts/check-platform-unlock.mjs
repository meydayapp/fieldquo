// scripts/check-platform-unlock.mjs
//
//   npm run check:platform-unlock
//
// "Unlock company" on /platform/companies/[id] (owner, 2026-10-03) —
// EXECUTED against the same recording database/Stripe/admin stubs
// check:platform-cancel-lock uses (scripts/fixtures/platformCancelStubs.mjs):
//
//   1. lib/platform/unlock.js against every lock source and every
//      non-FieldQuo limit: only Company.platformEnd* and
//      Subscription.accessLockedAt are unlockable; an expired trial, a
//      past_due card and a company-cancelled plan are refused;
//   2. round trip: cancel route locks → unlock writes back EXACTLY the
//      pre-lock values of the columns the lock wrote (the access verdict
//      before the lock equals the verdict after the unlock, at three
//      moments), and what is deliberately not restored is said;
//   3. the route's gates: admin and support refused (company:unlock is
//      SUPERADMIN_ONLY), a live support session refused, no reason refused,
//      nothing-to-unlock refused — each with nothing written;
//   4. the write: one transaction, the clear + one audit row with who/why/
//      what was cleared; Stripe is never called, VoiceAutoTopup never
//      written;
//   5. wiring: the panel posts to the route that exists, the cancel panel
//      and extend-trial point at it, the audit catalogue and /platform/team
//      have words for it.

import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./platform-cancel-stub-hooks.mjs", import.meta.url);

let fail = 0;
let count = 0;
const ok = (cond, msg) => {
  count++;
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fail++;
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

process.env.IMPERSONATION_JWT_SECRET = "check-platform-unlock-secret-0123456789abcdef";

const stubs = await import("./fixtures/platformCancelStubs.mjs");
const { unlockPlan } = await import("@/lib/platform/unlock");
const { fieldquoEndAccessFor, trialAccessFor, accessFor } = await import("@/lib/billing/access");
const { SUPERADMIN_ONLY_PERMISSIONS, canPlatform } = await import("@/lib/platform/permissions");
const { SignJWT } = await import("jose");
const { NextRequest } = await import("next/server.js");

const NOW = new Date("2026-10-03T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (d) => new Date(NOW.getTime() + d * DAY);

// ══ 1. Which locks are FieldQuo's ═════════════════════════════════════════
console.log("\n1. What may be unlocked\n");
let threw = false;
try {
  unlockPlan({ company: {} });
} catch {
  threw = true;
}
ok(threw, "subscription not read (undefined) → throws, never reads as 'not locked'");

const notOurs = [
  ["a running trial", { trialEndsAt: at(5) }, null],
  ["an expired trial (read-only week)", { trialEndsAt: at(-3) }, null],
  ["an expired trial (locked)", { trialEndsAt: at(-30) }, null],
  ["a failed card (past_due, 20 days)", { trialEndsAt: null }, { stripeSubscriptionId: "sub_1", status: "past_due", accessLockedAt: null }],
  ["a plan the company cancelled itself", { trialEndsAt: null }, { stripeSubscriptionId: "sub_1", status: "canceled", canceledAt: at(-40), accessLockedAt: null }],
  ["a paying company", { trialEndsAt: null }, { stripeSubscriptionId: "sub_1", status: "active", accessLockedAt: null }],
];
for (const [label, company, sub] of notOurs) {
  const p = unlockPlan({ company, subscription: sub });
  ok(p.locked === false && Boolean(p.refusal) && !p.data.company && !p.data.subscription, `${label} → not FieldQuo's lock, refused, nothing to write`);
}

for (const mode of ["terms", "now", "period_end"]) {
  const company = { trialEndsAt: at(5), platformEndsAt: mode === "period_end" ? at(5) : at(-1), platformEndMode: mode, platformEndReason: "why" };
  const p = unlockPlan({ company, subscription: null });
  ok(p.locked && !p.refusal && JSON.stringify(p.sources) === '["company_ending"]', `Company ending (${mode}) → unlockable`);
  ok(JSON.stringify(p.data.company) === JSON.stringify({ platformEndsAt: null, platformEndMode: null, platformEndReason: null }) && p.data.subscription === null,
    `…writes exactly the three ending columns back to null (${mode}), no Subscription write`);
  ok(p.previous.company.platformEndMode === mode && p.previous.company.platformEndReason === "why", `…previous values carried for the audit row (${mode})`);
  ok((mode === "terms") === (p.notRestored.length === 2), `…"not restored" (top-up, released numbers) said only for a terms lock (${mode})`);
}
const subLock = { stripeSubscriptionId: "sub_1", status: "canceled", canceledAt: at(-2), accessLockedAt: at(-2), accessLockedReason: "spam" };
const ps = unlockPlan({ company: { trialEndsAt: null }, subscription: subLock });
ok(ps.locked && JSON.stringify(ps.sources) === '["subscription_lock"]' && JSON.stringify(ps.data.subscription) === JSON.stringify({ accessLockedAt: null, accessLockedReason: null }) && ps.data.company === null,
  "Stripe-path terms lock → clears accessLockedAt/Reason only");
ok(/stays cancelled/.test(ps.after) && /never touches Stripe/.test(ps.after), "…and says the Stripe subscription stays cancelled");
ok(ps.notRestored.length === 2, "…and names what is not restored");
// A row with a garbage date in platformEndsAt but a mode: still FieldQuo's.
ok(unlockPlan({ company: { platformEndsAt: "not a date", platformEndMode: "terms" }, subscription: null }).locked, "unparseable ending date but a mode set → still unlockable (absence of a date is not absence of a lock)");

// ══ 2. Round trip: lock, unlock, compare ═══════════════════════════════
console.log("\n2. Unlock restores the pre-lock state\n");
const cancelRoute = await import("@/app/api/platform/companies/[id]/cancel-subscription/route.js");
const unlockRoute = await import("@/app/api/platform/companies/[id]/unlock/route.js");
const post = async (mod, id, body, cookie) => {
  const headers = { "content-type": "application/json", ...(cookie ? { cookie } : {}) };
  const res = await mod.POST(new NextRequest(`http://x/api/platform/companies/${id}/unlock`, { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, json: await res.json() };
};
const applyOp = (row, op) => ({ ...row, ...op.args.data });
const verdict = (company, moment) => {
  const ended = fieldquoEndAccessFor(company, moment);
  if (ended) return ended.level + ":" + ended.reason;
  const t = trialAccessFor(company, moment);
  return t ? t.level + ":" + t.reason : "full:no_subscription";
};

for (const [label, base, mode] of [
  ["trial, terms", { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(10) }, "terms"],
  ["trial, now", { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(10) }, "now"],
  ["trial, period_end", { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(10) }, "period_end"],
  ["expired trial, terms", { id: "co_t", name: "Old Co", isDemo: false, trialEndsAt: at(-4) }, "terms"],
]) {
  const pre = { ...base, platformEndsAt: null, platformEndMode: null, platformEndReason: null };
  stubs.resetStubs();
  stubs.state.company = { ...pre };
  stubs.state.subscription = null;
  const locked = await cancelRoute.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, reason: "Sent spam" }) }), { params: Promise.resolve({ id: "co_t" }) });
  const lockTx = stubs.calls.find((c) => c.kind === "transaction");
  const lockedRow = applyOp(pre, lockTx.ops.find((o) => o.__op === "company.update"));
  ok(locked.status === 200 && lockedRow.platformEndMode === mode, `${label}: the cancel route locked it`);

  stubs.resetStubs();
  stubs.state.company = { ...lockedRow };
  stubs.state.subscription = null;
  const r = await post(unlockRoute, "co_t", { reason: "Locked the wrong company" });
  const tx = stubs.calls.find((c) => c.kind === "transaction");
  const ops = tx?.ops.map((o) => o.__op) || [];
  ok(r.status === 200 && JSON.stringify(ops) === JSON.stringify(["company.update", "platformAuditLog.create"]), `${label}: unlock → 200, one transaction: company.update + audit (${ops.join(", ")})`);
  const after = applyOp(lockedRow, tx.ops[0]);
  const cols = ["platformEndsAt", "platformEndMode", "platformEndReason", "trialEndsAt"];
  ok(cols.every((k) => JSON.stringify(after[k]) === JSON.stringify(pre[k])), `${label}: every column the lock wrote is back to its pre-lock value; trialEndsAt untouched`);
  ok([0, 5, 20].every((d) => verdict(after, at(d)) === verdict(pre, at(d))), `${label}: access verdict after unlock = before lock, today / +5d / +20d (${verdict(after, NOW)})`);
  ok(tx.ops[0].args.where.id === "co_t", `${label}: the write is scoped to that company`);
  ok(!stubs.calls.some((c) => c.kind === "stripe"), `${label}: Stripe never called`);
  ok(!JSON.stringify(tx.ops).includes("voiceAutoTopup"), `${label}: auto top-up not re-armed`);
}

// The Stripe path: the lock column back to null, Stripe still cancelled.
stubs.resetStubs();
stubs.state.company = { id: "co_s", name: "Paying Co", isDemo: false, trialEndsAt: at(-60) };
stubs.state.subscription = { stripeSubscriptionId: "sub_live", status: "canceled", canceledAt: at(-1), accessLockedAt: at(-1), accessLockedReason: "spam" };
const rs = await post(unlockRoute, "co_s", { reason: "Resolved with the owner" });
const txs = stubs.calls.find((c) => c.kind === "transaction");
ok(rs.status === 200 && JSON.stringify(txs.ops.map((o) => o.__op)) === JSON.stringify(["subscription.update", "platformAuditLog.create"]),
  "Stripe-path lock: subscription.update + audit, nothing else");
ok(JSON.stringify(txs.ops[0].args) === JSON.stringify({ where: { companyId: "co_s" }, data: { accessLockedAt: null, accessLockedReason: null } }),
  "…writes exactly { accessLockedAt: null, accessLockedReason: null } — status, canceledAt, Stripe ids untouched");
const subAfter = { ...stubs.state.subscription, ...txs.ops[0].args.data };
ok(accessFor(stubs.state.subscription, NOW).reason === "terms" && accessFor(subAfter, NOW).reason === "canceled",
  "…access: terms lock → the cancelled-plan window (the lock lifted, Stripe left cancelled)");
ok(!stubs.calls.some((c) => c.kind === "stripe"), "…Stripe never called");

// ══ 3. The gates ═══════════════════════════════════════════════════════════
console.log("\n3. Who, from where, and why\n");
ok(SUPERADMIN_ONLY_PERMISSIONS.includes("company:unlock") && canPlatform("superadmin", "company:unlock") && !canPlatform("admin", "company:unlock") && !canPlatform("support", "company:unlock"),
  "company:unlock is superadmin-only, declared in SUPERADMIN_ONLY_PERMISSIONS");
const lockedTrial = { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(10), platformEndsAt: at(-1), platformEndMode: "terms", platformEndReason: "x" };
for (const role of ["admin", "support"]) {
  stubs.resetStubs();
  stubs.state.company = { ...lockedTrial };
  stubs.state.admin = { id: `adm_${role}`, role };
  const r = await post(unlockRoute, "co_t", { reason: "Please unlock" });
  ok(r.status === 403 && stubs.calls.length === 0 && stubs.reads.length === 0, `${role} → 403 before any read or write`);
}
stubs.resetStubs();
stubs.state.admin = null;
ok((await post(unlockRoute, "co_t", { reason: "x x x" })).status === 401, "no platform session → 401");

const token = await new SignJWT({ impersonation: true, mode: "read_only", companyId: "co_other", platformAdminId: "adm_super" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("30m")
  .sign(new TextEncoder().encode(process.env.IMPERSONATION_JWT_SECRET));
stubs.resetStubs();
stubs.state.company = { ...lockedTrial };
let r = await post(unlockRoute, "co_t", { reason: "Please unlock" }, `impersonation-token=${token}`);
ok(r.status === 403 && /support session|View as company/.test(r.json.error) && stubs.calls.length === 0, "superadmin inside a live View as company session → 403, nothing written");
stubs.resetStubs();
stubs.state.company = { ...lockedTrial };
r = await post(unlockRoute, "co_t", { reason: "Please unlock" }, "impersonation-token=forged.token.value");
ok(r.status === 200, "a forged/expired cookie is not a session → proceeds (the verifier decides, not the cookie's presence)");

stubs.resetStubs();
stubs.state.company = { ...lockedTrial };
r = await post(unlockRoute, "co_t", { reason: "  " });
ok(r.status === 400 && stubs.calls.length === 0, "no reason → 400, nothing written");
stubs.resetStubs();
stubs.state.company = { id: "co_x", name: "Fine Co", isDemo: false, trialEndsAt: at(-30) };
r = await post(unlockRoute, "co_x", { reason: "Give them access" });
ok(r.status === 409 && /nothing to unlock/.test(r.json.error) && stubs.calls.length === 0, "an expired trial (not FieldQuo's lock) → 409, nothing written");
stubs.resetStubs();
r = await post(unlockRoute, "co_missing", { reason: "whatever" });
ok(r.status === 404, "unknown company → 404");

// ══ 4. The audit row ═══════════════════════════════════════════════════════
console.log("\n4. The audit row\n");
stubs.resetStubs();
stubs.state.company = { ...lockedTrial };
r = await post(unlockRoute, "co_t", { reason: "Locked the wrong company" });
const audit = stubs.calls.find((c) => c.kind === "transaction").ops.find((o) => o.__op === "platformAuditLog.create").args.data;
ok(audit.platformAdminId === "adm_super" && audit.action === "company_unlocked_by_platform" && audit.targetCompanyId === "co_t", "who, what, which company");
ok(audit.details.reason === "Locked the wrong company" && audit.details.previous.company.platformEndMode === "terms", "why, and the values cleared");
ok(Array.isArray(audit.details.notRestored) && audit.details.notRestored.length === 2, "what was deliberately left off is on the record too");

// ══ 5. Wiring ═════════════════════════════════════════════════════════════
console.log("\n5. Wiring\n");
const panel = read("app/platform/companies/[id]/CompanyActions.js");
ok(panel.includes("/api/platform/companies/${companyId}/unlock") && panel.includes('can("company:unlock")'), "the panel posts to the route and gates on company:unlock");
ok(/unlock\?\.locked/.test(panel), "the panel draws Unlock only when the server says FieldQuo locked it");
ok(read("app/platform/companies/[id]/CompanyDetail.js").includes("unlock={company.unlock}"), "the detail page passes the plan in");
ok(/unlockPlan\(/.test(read("app/api/platform/companies/[id]/route.js")) && /delete unlock\.data/.test(read("app/api/platform/companies/[id]/route.js")), "the company GET answers the plan, without the write set");
ok(!/no reinstate control yet/.test(read("lib/platform/cancelOptions.js")) && !/no reinstate control yet/.test(read("app/api/platform/companies/[id]/extend-trial/route.js")),
  "the cancel panel and extend-trial no longer say there is no reinstate control");
ok(/company_unlocked_by_platform:/.test(read("lib/platform/auditActions.js")), "the audit catalogue has words for it");
ok(/"company:unlock":/.test(read("app/platform/team/page.js")), "/platform/team describes company:unlock in words");
ok(!/@\/lib\/stripe/.test(read("app/api/platform/companies/[id]/unlock/route.js")), "the unlock route does not import Stripe");

console.log(`\n${count - fail}/${count} passed`);
if (fail) process.exit(1);
