// scripts/meta-capi-backfill.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/meta-capi-backfill.mjs --company=<companyId>
//   node --import ./scripts/alias-loader.mjs scripts/meta-capi-backfill.mjs --company=<companyId> --send
//
// "Send lead results to Meta" — the history send, run by FieldQuo's owner
// from his own machine for ONE company that has the switch on.
//
// DRY BY DEFAULT. Without --send it reads the company's last 90 days (or
// --days=N), prints how many events of each stage FieldQuo would owe Meta,
// and splits them into "sendable" and "too old" — then writes nothing and
// sends nothing.
//
// ══ Why most of a 90-day history cannot go ═════════════════════════════════
//
// Meta's Conversions API refuses an event whose event_time is more than 7
// days before the upload ("You can backfill your data for up to 7 days in the
// past", Conversion Leads FAQ, read 2026-10-05). FieldQuo never moves an
// event's time to sneak it in — a stage dated today that happened in July
// would teach Meta's model a lie. So --send queues every stage (the old ones
// are stored `expired`, which is what the settings screen counts as "too old
// for Meta") and delivers only the ones inside the window. The counts are
// printed first so nobody is surprised by that.
//
// Qualified and Disqualified have no timestamp of their own; they are only
// owed for leads inside Meta's 28-day optimisation window (lib/meta/capi/
// events.js says why), so a 90-day run reports them for the last 28 days only.
//
// Requires DATABASE_URL (the real database — run it the way the other local
// scripts are run, see docs/META-CONVERSIONS-API.md). It never calls Meta
// without --send.
import { db } from "@/lib/db";
import { sweepCompany } from "@/lib/meta/capi/sweep";
import { enqueueEvents, deliverPending } from "@/lib/meta/capi/outbox";
import { withinUploadWindow } from "@/lib/meta/capi/events";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  }),
);
const companyId = typeof args.company === "string" ? args.company : null;
const days = Math.min(365, Math.max(1, Number(args.days) || 90));
const send = args.send === true;

if (!companyId) {
  console.error("Usage: … scripts/meta-capi-backfill.mjs --company=<companyId> [--days=90] [--send]");
  process.exit(2);
}

const now = new Date();
const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
if (!company) {
  console.error(`No company ${companyId}.`);
  process.exit(1);
}
const result = await sweepCompany(db, { companyId, now, days, write: false });
if (!result.enabled) {
  console.log(`${company.name}: "Send lead results to Meta" is OFF — nothing to do. Turn it on in Settings → Meta Ads first.`);
  process.exit(0);
}
console.log(`${company.name} — last ${days} days (${send ? "SEND" : "dry run"})`);
console.log("readiness:", JSON.stringify(result.readiness));
const list = result.list || [];
const table = {};
for (const r of list) {
  const key = `${r.kind}:${r.stage}`;
  table[key] = table[key] || { sendable: 0, tooOld: 0 };
  if (withinUploadWindow(r.eventTime, now)) table[key].sendable++;
  else table[key].tooOld++;
}
for (const [key, c] of Object.entries(table).sort()) {
  console.log(`  ${key.padEnd(28)} ${String(c.sendable).padStart(5)} sendable   ${String(c.tooOld).padStart(5)} too old for Meta (> 7 days)`);
}
if (!list.length) console.log("  nothing owed");

if (!send) {
  console.log("\nDry run: nothing written, nothing sent. Add --send to queue and deliver.");
  process.exit(0);
}
const { queued } = await enqueueEvents(db, companyId, list, { now });
console.log(`\nqueued ${queued} new row(s) (rows already in the outbox are left as they are)`);
const delivery = await deliverPending(db, { now: new Date(), companyId });
console.log("delivery:", JSON.stringify(delivery));
process.exit(0);
