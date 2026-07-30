// scripts/check-billing-access.mjs
//
//   npm run check:access
//
// The 7-day read-only grace period, executed against every subscription state.
//
// This gate can lock a paying customer out of their own business, so the
// assertions lean hard on the states where being wrong is expensive:
//
//   * NO subscription row → FULL access. A company created by hand, or one
//     whose checkout webhook hasn't landed, must not be locked out of a product
//     they may well have paid for. Wrong in this direction costs a few days of
//     usage; wrong the other way is a support emergency.
//   * past_due with a NULL timestamp → read-only, clock starts now. A missing
//     date is our bug and shouldn't cost them their account.
//   * Billing paths stay writable in EVERY state, including locked and
//     cancelled. The only thing a locked-out company needs to do is pay, and
//     paying is a POST — without the allow-list the grace period is a trap.
//
// 402 rather than 403 is deliberate and asserted: "Forbidden" reads as a
// permissions problem and sends people to their admin, where nothing can be
// fixed. Payment Required sends them to the billing screen.

import { accessFor, denyReason, isBillingPath, isReadMethod, GRACE_DAYS } from "@/lib/billing/access";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};
const NOW = new Date("2026-07-30T12:00:00Z");
const ago = d => new Date(NOW.getTime() - d*24*60*60*1000);

// ── Every subscription state ──────────────────────────────────────────────
ok(accessFor(null, NOW).level === "full",
   "NO subscription row → full access (a hand-made company, or a webhook that hasn't landed, must not be locked out)");
ok(accessFor({status:"active"}, NOW).level === "full", "active → full");
ok(accessFor({status:"trialing"}, NOW).level === "full", "trialing → full (the free month)");
ok(accessFor({status:"canceled"}, NOW).level === "locked", "cancelled → locked immediately (they asked to stop; there's nothing to fix)");

// ── The 7-day clock ───────────────────────────────────────────────────────
for (const [days, want, left] of [[0,"readonly",7],[1,"readonly",6],[6,"readonly",1],[6.9,"readonly",1],[7,"locked",0],[30,"locked",0]]) {
  const a = accessFor({status:"past_due", pastDueSince: ago(days)}, NOW);
  ok(a.level===want && a.daysLeft===left, `${days}d overdue → ${a.level}, ${a.daysLeft} day(s) left`);
}
ok(accessFor({status:"past_due", pastDueSince:null}, NOW).level === "readonly",
   "past_due with a NULL timestamp starts the clock now rather than locking — a missing date is our bug, not their fault");
ok(accessFor({status:"past_due", pastDueSince: new Date(NOW.getTime()+1e9)}, NOW).daysLeft === GRACE_DAYS,
   "a future timestamp can't produce more than the full grace period");

// ── What read-only actually blocks ────────────────────────────────────────
const ro = accessFor({status:"past_due", pastDueSince: ago(2)}, NOW);
ok(denyReason(ro, {method:"GET",  pathname:"/api/quotes"}) === null, "read-only: GET a quote is allowed");
ok(denyReason(ro, {method:"HEAD", pathname:"/api/quotes"}) === null, "read-only: HEAD is allowed");
const post = denyReason(ro, {method:"POST", pathname:"/api/quotes"});
ok(post?.status === 402, `read-only: POST is refused with 402 Payment Required, not 403 — 403 reads as a permissions problem and sends people to their admin`);
ok(/5 more days/.test(post.error), `the message counts down: "${post.error.slice(0,80)}…"`);
ok(/nothing has been deleted/i.test(post.error), "the message says the data is safe — that's the first fear");
ok(denyReason(ro, {method:"DELETE", pathname:"/api/clients/1"})?.status === 402, "read-only: DELETE is refused");

// ── Paying must always be possible ───────────────────────────────────────
const locked = accessFor({status:"past_due", pastDueSince: ago(20)}, NOW);
for (const path of ["/api/platform/billing/checkout","/api/settings/subscription","/api/auth/sign-out","/api/platform/feedback"]) {
  ok(denyReason(locked, {method:"POST", pathname:path}) === null, `locked: POST ${path} still allowed`);
}
ok(denyReason(locked, {method:"GET", pathname:"/api/quotes"})?.status === 402,
   "locked: even reads are blocked");
ok(denyReason(accessFor({status:"canceled"},NOW), {method:"POST",pathname:"/api/platform/billing/checkout"}) === null,
   "cancelled: they can still restart the subscription");

// ── Full access is never gated ───────────────────────────────────────────
ok(denyReason(accessFor({status:"active"},NOW), {method:"DELETE",pathname:"/api/anything"}) === null,
   "a paying company is never blocked");
ok(denyReason(null, {method:"POST", pathname:"/api/quotes"}) === null, "a null access object doesn't block anything");

// ── The allow-list is an allow-list ──────────────────────────────────────
ok(isBillingPath("/api/platform/billing"), "exact match counts");
ok(isBillingPath("/api/platform/billing/checkout"), "sub-path counts");
ok(!isBillingPath("/api/platform/billing-something-else"), "a prefix that isn't a path boundary does NOT count");
ok(!isBillingPath("/api/quotes"), "an ordinary route is not billing");
ok(isReadMethod("get") && isReadMethod("OPTIONS") && !isReadMethod("PATCH"), "read methods are case-insensitive");

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
