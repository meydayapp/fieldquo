// app/api/cron/mailbox-sync/route.js
//
// Every ten minutes: pull what is new in each connected work mailbox and
// file the mail exchanged with clients (lib/mailbox/sync.js).
//
// ══ Batched and time-boxed ════════════════════════════════════════════════
//
// The function may run 300s; this one stops starting new work at
// TOTAL_BUDGET_MS (200s) and gives each mailbox at most PER_MAILBOX_MS, so a
// 90-day backfill in one company cannot starve every other company's inbox.
// Mailboxes are taken least-recently-synced first; whoever does not fit this
// tick is first in line for the next. Sequential on purpose — the uploads and
// the database are shared, and a client's email filed a minute later is fine.
//
// A row in "error" is retried too: a network blip should not need the
// contractor's Reconnect. A refused credential goes back to "error" on the
// same failure, and stays visible on the card until they act.
export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { syncMailbox } from "@/lib/mailbox/sync";
import { mailCryptoConfigured } from "@/lib/mailbox/crypto";

const TOTAL_BUDGET_MS = 200 * 1000;
const PER_MAILBOX_MS = 60 * 1000;
const BATCH = 40;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  if (!mailCryptoConfigured()) return NextResponse.json({ skipped: "not_configured" });

  const started = Date.now();
  const rows = await db.mailboxConnection.findMany({
    where: { status: { in: ["connected", "error"] }, secretEnc: { not: null } },
    orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
  });

  const results = [];
  for (const row of rows) {
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 15 * 1000) break;
    const r = await syncMailbox(db, row, { budgetMs: Math.min(PER_MAILBOX_MS, left - 10 * 1000) }).catch((err) => ({
      ok: false,
      reason: "threw",
      error: String(err?.message || err).slice(0, 200),
    }));
    // Counters only — never an address or a subject in a cron log.
    results.push({ id: row.id, provider: row.provider, ok: r.ok, reason: r.reason || null, filed: r.filed || 0, skipped: r.skipped || 0 });
  }
  return NextResponse.json({ mailboxes: results.length, of: rows.length, results });
}
