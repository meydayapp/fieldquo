// scripts/notify-new-service-seeds.mjs
//
//   node --import dotenv/config --import ./scripts/alias-loader.mjs scripts/notify-new-service-seeds.mjs            # dry run
//   node --import dotenv/config --import ./scripts/alias-loader.mjs scripts/notify-new-service-seeds.mjs --send     # notify
//   … --company <id>   one company only
//   … --skip <id,id>   leave these companies out
//
// Tells each existing (non-demo) company's owners and admins, in their own
// language, how many seeded services their trades gained that they do not
// hold yet, linking to Settings › Services. lib/services/newSeedNotice.js has
// the rules: the count is what "Add missing services for my trade" would add,
// nothing is ever inserted into a catalogue, and a re-run tells nobody twice.
//
// DRY RUN unless --send is passed; the dry run only reads.
import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { planNewSeedNotices, NEW_SEEDS_TYPE, NEW_SEEDS_RELEASE } from "@/lib/services/newSeedNotice";

const send = process.argv.includes("--send");
const i = process.argv.indexOf("--company");
const companyId = i > -1 ? process.argv[i + 1] : null;

// --skip id1,id2 — leave named companies out (an internal test company is
// `isDemo: false` like any customer, and only a person knows it is a test).
const s = process.argv.indexOf("--skip");
const skip = new Set(s > -1 ? String(process.argv[s + 1] || "").split(",").filter(Boolean) : []);

const plans = (await planNewSeedNotices({ db, companyId })).filter((p) => !skip.has(p.companyId));

console.log(`${send ? "SEND" : "DRY RUN"} — release ${NEW_SEEDS_RELEASE}, ${plans.length} companies to notify`);
const perTrade = new Map();
let recipients = 0;
for (const p of plans) {
  for (const t of p.trades) {
    if (!perTrade.has(t.key)) perTrade.set(t.key, { companies: 0, services: 0 });
    const row = perTrade.get(t.key);
    row.companies += 1;
    row.services += t.count;
  }
  const trades = p.trades.map((t) => `${t.label} ${t.count}`).join(", ");
  const langs = p.groups.map((g) => `${g.language}×${g.userIds.length}`).join(" ");
  recipients += p.groups.reduce((n, g) => n + g.userIds.length, 0);
  console.log(`  ${p.companyId}  ${p.companyName} — ${p.total} new (${trades}) → ${langs}`);
  for (const g of p.groups) console.log(`      [${g.language}] "${g.params.trades}" (${g.params.count})`);
}
console.log(`\nper trade (companies, services they would add):`);
for (const [trade, row] of [...perTrade.entries()].sort((a, b) => b[1].companies - a[1].companies)) {
  console.log(`  ${trade.padEnd(22)} ${String(row.companies).padStart(4)} companies  ${String(row.services).padStart(6)} services`);
}
console.log(`\n${plans.length} companies, ${recipients} owners/admins`);

if (send) {
  let delivered = 0;
  for (const p of plans) {
    for (const g of p.groups) {
      const r = await notifyEvent({
        companyId: p.companyId,
        type: NEW_SEEDS_TYPE,
        entityId: NEW_SEEDS_RELEASE,
        params: g.params,
        recipientUserIds: g.userIds,
      });
      delivered += r.delivered || 0;
      if (!r.created) console.log(`  ${p.companyId} [${g.language}] not sent: ${r.reason}`);
    }
  }
  console.log(`delivered: ${delivered}`);
  // notifyEvent fires the Web Push copy without awaiting it (a webhook must
  // not wait on a push service). In a script the process would otherwise
  // disconnect under those sends, so give them a moment to leave.
  await new Promise((r) => setTimeout(r, 5000));
}
await db.$disconnect();
