// scripts/backfill-meta-lead-double-count.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-meta-lead-double-count.mjs
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-meta-lead-double-count.mjs --apply
//
// One-off. Recompute MarketingSpend.conversions for every row the Meta sync
// wrote under the old rule, which summed Meta's `lead` action TOGETHER WITH
// the specific types `lead` is the roll-up of — see the decision comment on
// countLeadActions() in lib/meta/insightsImport.js. Every affected row stored
// roughly double the real lead count, so every cost-per-lead derived from it
// read roughly half.
//
// Nothing is refetched from Meta: `actionsRaw` holds the row's own raw actions
// array, so each row recomputes from what Meta actually said at the time.
//
// What this will and will not do:
//
//   - DRY BY DEFAULT. It writes only with --apply. (--dry-run is accepted as
//     an explicit spelling of the default, and wins over --apply if both are
//     passed — the safe direction.)
//   - The ONLY column it writes is `conversions`. It issues no delete, and
//     `conversionsExact`, `leads` and the raw actions are never touched.
//   - It calls the SAME countLeadActions() the sync calls. A second copy of
//     the rule here would be the copy that rots (AGENTS.md failure class 4)
//     and a backfill that disagrees with the importer is worse than no
//     backfill — the next sync would just undo it.
//   - A row whose `actionsRaw` is null, not an array, or an EMPTY array is
//     LEFT ALONE and counted as skipped. An unreadable raw blob is not a
//     statement that there were no leads, and the only correction such a row
//     could receive is a zeroing (failure class 5).
//   - A row whose `conversions` is null is LEFT ALONE too. Null is "no number
//     stored", not "a wrong number stored"; replacing it would invent a
//     statement rather than fix one. So is a row whose recomputed count is not
//     an integer, since `conversions` is an Int and rounding would state a
//     number Meta never sent.
//   - Only rows with source "meta_api" are considered. A hand-typed row's
//     conversions figure is the contractor's own and is not ours to recompute.
//   - Idempotent: it updates only where the stored value differs, so a second
//     run reports zero changes.

import { db } from "@/lib/db";
import { countLeadActions } from "@/lib/meta/insightsImport";

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--apply");

const rows = await db.marketingSpend.findMany({
  where: { source: "meta_api" },
  select: {
    id: true,
    companyId: true,
    campaignId: true,
    campaignName: true,
    date: true,
    amount: true,
    conversions: true,
    actionsRaw: true,
  },
  orderBy: [{ companyId: "asc" }, { date: "asc" }],
});

console.log(
  `${rows.length} MarketingSpend rows with source "meta_api" — ${dryRun ? "DRY RUN, nothing will be written" : "APPLY, conversions will be UPDATEd"}\n`,
);

/** The stored raw actions as an array, or null when there is nothing readable to recompute from. */
function readableActions(actionsRaw) {
  let v = actionsRaw;
  // Belt and braces: the column is Json? and Prisma hands back a parsed
  // value, but a row written through raw SQL at some point could hold the
  // array as a JSON string. A string that will not parse is unreadable, which
  // is a skip, not a zero.
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(v) || v.length === 0) return null;
  return v;
}

const perCompany = new Map();
const changes = [];
let skippedUnreadable = 0;
let skippedNullConversions = 0;
let skippedNonInteger = 0;

for (const row of rows) {
  const actions = readableActions(row.actionsRaw);
  if (!actions) {
    skippedUnreadable += 1;
    continue;
  }
  if (row.conversions === null || row.conversions === undefined) {
    skippedNullConversions += 1;
    continue;
  }

  // MarketingSpend.conversions is an Int. A non-integer recompute is left
  // alone and named rather than rounded: rounding would state a number Meta
  // did not send, and it would also hand Prisma a value it refuses, failing
  // the run partway through instead of at the row that caused it. No live row
  // does this — every stored action value parses as an integer — so this is
  // the branch that keeps a surprise from becoming a half-finished backfill.
  const next = countLeadActions(actions);
  if (!Number.isInteger(next)) {
    skippedNonInteger += 1;
    continue;
  }

  const stat = perCompany.get(row.companyId) ?? { considered: 0, changing: 0, before: 0, after: 0 };
  stat.considered += 1;
  stat.before += row.conversions;
  stat.after += next;
  if (next !== row.conversions) {
    stat.changing += 1;
    changes.push({ ...row, next });
  }
  perCompany.set(row.companyId, stat);
}

for (const [companyId, s] of perCompany) {
  console.log(
    `company ${companyId}: ${s.changing} of ${s.considered} rows would change — conversions total ${s.before} → ${s.after}`,
  );
}
if (skippedUnreadable) {
  console.log(`\n${skippedUnreadable} row(s) left alone: actionsRaw null, not an array, or empty — not zeroed.`);
}
if (skippedNullConversions) {
  console.log(`${skippedNullConversions} row(s) left alone: conversions is null — no number stored to correct.`);
}
if (skippedNonInteger) {
  console.log(`${skippedNonInteger} row(s) left alone: recomputed lead count is not an integer — not rounded.`);
}

if (changes.length) {
  console.log(`\nrows that would change (${changes.length}):`);
  for (const c of changes) {
    console.log(
      `  ${c.date.toISOString().slice(0, 10)}  campaign ${c.campaignId ?? "?"} "${c.campaignName ?? ""}"  spend ${c.amount}  conversions ${c.conversions} → ${c.next}`,
    );
  }
}

let written = 0;
if (!dryRun) {
  for (const c of changes) {
    // `data` names exactly one column on purpose. Nothing else on the row is
    // this script's business.
    await db.marketingSpend.update({ where: { id: c.id }, data: { conversions: c.next } });
    written += 1;
  }
}

console.log(
  `\n${changes.length} row(s) differ from the stored value; ${written} written${dryRun ? " (dry run — re-run with --apply to write)" : ""}`,
);

await db.$disconnect();
