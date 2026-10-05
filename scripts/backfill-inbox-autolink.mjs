// scripts/backfill-inbox-autolink.mjs
//
// The one-time backfill for "link conversations to clients automatically"
// (owner, 2026-10-05; lib/conversations/autoLink.js backfillCompany).
//
// For each company with the switch on:
//   · every text / WhatsApp / email / Messenger / Instagram conversation with
//     no client, whose phone or email belongs to EXACTLY ONE of the company's
//     clients, is linked — and recorded in ThreadClientMatch, so "Not this
//     client" undoes it; a shared number is left alone; an undone pair is
//     never re-linked;
//   · every inbound message on a client's conversation that nobody has filed
//     to a job is filed when the rule can tell (a homeowner's only active
//     job, or the one job whose visit days / schedule contain the message's
//     day); the rest are left for "Which job?".
//
// It only ever fills a NULL. It never overwrites a person's link, never
// unlinks anything, never deletes anything.
//
// DRY RUN BY DEFAULT — prints what it would do and writes nothing. Pass
// --apply to write. --company=<id> limits it to one company.
//
// Run: node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-inbox-autolink.mjs [--apply] [--company=<id>]

import { db } from "@/lib/db";
import { backfillCompany } from "@/lib/conversations/autoLink";

const APPLY = process.argv.includes("--apply");
const only = process.argv.find((a) => a.startsWith("--company="))?.slice("--company=".length) || null;

const companies = await db.company.findMany({
  where: only ? { id: only } : {},
  select: { id: true, name: true },
  orderBy: { createdAt: "asc" },
});

console.log(`${APPLY ? "APPLYING" : "DRY RUN (nothing is written; pass --apply)"} — ${companies.length} compan${companies.length === 1 ? "y" : "ies"}\n`);
const total = { linked: 0, ambiguous: 0, undone: 0, onlyJob: 0, byDate: 0, ask: 0 };
for (const c of companies) {
  const r = await backfillCompany(db, { companyId: c.id, apply: APPLY });
  if (r.switchedOff) {
    console.log(`  ${String(c.name).padEnd(28)} switched off — skipped`);
    continue;
  }
  if (!r.threads.scanned && !r.messages.scanned) continue;
  total.linked += r.threads.linked;
  total.ambiguous += r.threads.ambiguous;
  total.undone += r.threads.undone;
  total.onlyJob += r.messages.onlyJob;
  total.byDate += r.messages.byDate;
  total.ask += r.messages.ask;
  console.log(
    `  ${String(c.name).padEnd(28)} threads ${r.threads.scanned}: ${r.threads.linked} link, ${r.threads.ambiguous} shared number (left), ${r.threads.undone} undone (left), ${r.threads.noMatch + r.threads.noContact} no client` +
      ` | messages ${r.messages.scanned}: ${r.messages.onlyJob} only job, ${r.messages.byDate} by date, ${r.messages.ask} "Which job?", ${r.messages.noActiveJob} no active job`,
  );
}
console.log(`\nTotal: ${total.linked} conversations ${APPLY ? "linked" : "would be linked"}, ${total.ambiguous} shared-number threads left for a person, ${total.undone} undone pairs respected; ${total.onlyJob + total.byDate} messages ${APPLY ? "filed" : "would be filed"} to a job (${total.onlyJob} only job, ${total.byDate} by date), ${total.ask} left asking "Which job?".`);
await db.$disconnect?.();
