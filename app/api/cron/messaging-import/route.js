// app/api/cron/messaging-import/route.js
//
// The backstop for the connect-time import.
//
// The OAuth callback, the Page-picker finalize step and the subscribe retry
// each schedule lib/messaging/pageImport.js's importAfterConnect with
// next/server's after() — the response goes out first, the pull runs behind
// it. That is the right shape for a redirect a person is waiting on, and it
// has one honest weakness: a function that hits its platform time limit
// mid-pull leaves the channel unstamped and the inbox half-filled. So this
// cron sweeps every live Facebook / Instagram channel that has NEVER been
// imported and runs the same function, which reaches the same stamp. A
// channel imported by the connect flow is skipped here (importedAt is set);
// one the connect flow lost is picked up within the quarter hour.
//
// ══ And, since 2026-09-12, the incremental re-pull ═════════════════════════
//
// The first version of this file said "never-imported ONLY: after the first
// pull the webhook carries every message". That is true once Meta delivers
// webhooks, and Meta does not deliver them for a long stretch of a tenant's
// life: none at all while the app is in Development mode (Meta's own banner:
// no production data, admins and testers included), and none from
// CUSTOMERS until App Review grants Advanced access on `pages_messaging` /
// `instagram_manage_messages`. The owner sent himself an Instagram DM on the
// day the Page connected and it reached /app/messages only because a pull
// happened to run after it. So every connected channel is now re-pulled
// every RESYNC_MS, asking Meta only for conversations updated since the last
// stamp (minus an overlap), a handful at a time — one Graph call per
// platform per company per run, answering "nothing new" almost always. The
// ingest is keyed on Meta's message id, so a message the webhook already
// wrote is found and not duplicated.
//
// `?dry=1` runs the same function with dryRun on and writes nothing — the
// counts it returns are what a real run would import. Behind the cron secret
// like the rest of it, so it is a diagnostic FieldQuo can run, not a read a
// browser can reach.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { PAGE_CHANNEL_PLATFORMS } from "@/lib/messaging/pageChannels";
import { importAfterConnect, importPageConversations } from "@/lib/messaging/pageImport";

/** Companies per run for the FIRST pull. Each is up to two platforms of up to 100 conversations. */
const MAX_PER_RUN = 5;

/** A channel stamped longer ago than this is re-pulled. Matches the cron's own cadence. */
export const RESYNC_MS = 15 * 60 * 1000;
/** How far behind the stamp the re-pull looks, so a message that landed while the previous pull ran is not missed. */
export const RESYNC_OVERLAP_MS = 30 * 60 * 1000;
/** Conversations per platform on a re-pull. Newest-updated first, so this is "the ones that moved", not the inbox. */
export const RESYNC_LIMIT = 20;
/** Companies re-pulled per run. Two Graph calls each, at most. */
const MAX_RESYNC_PER_RUN = 25;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dry = searchParams.get("dry") === "1";
  const sinceDays = Number(searchParams.get("sinceDays"));

  const due = await db.messagingChannel.findMany({
    where: {
      platform: { in: [...PAGE_CHANNEL_PLATFORMS] },
      disconnectedAt: null,
      status: "connected",
      importedAt: null,
    },
    orderBy: { connectedAt: "asc" },
    select: { companyId: true },
  });
  // One pull per company, not per channel: the import covers both of a
  // company's platforms in one call.
  const companies = [...new Set(due.map((c) => c.companyId))].slice(0, MAX_PER_RUN);

  const results = [];
  for (const companyId of companies) {
    const result = dry
      ? await importPageConversations({
          companyId,
          dryRun: true,
          ...(Number.isFinite(sinceDays) && sinceDays > 0
            ? { since: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) }
            : {}),
        }).catch((err) => ({ kind: "error", lastError: { kind: "unknown_error", message: err?.message } }))
      : await importAfterConnect({ companyId });
    results.push({
      companyId,
      kind: result?.kind ?? "skipped",
      conversations: result?.conversations ?? 0,
      messages: result?.messages ?? 0,
      created: result?.created ?? 0,
      skipped: result?.skipped ?? 0,
      errors: result?.errors ?? 0,
      platforms: result?.platforms ?? {},
      // Meta's own message too, here and only here: this response is read
      // by a person holding the cron secret, never by a browser, and a kind
      // alone ("unknown_error") cannot say which permission Meta wants.
      lastError: result?.lastError
        ? { kind: result.lastError.kind, platform: result.lastError.platform, message: result.lastError.message || null }
        : null,
    });
  }

  // ── The incremental re-pull ──────────────────────────────────────────────
  //
  // Channels stamped, and stamped long enough ago. The company's OLDEST stamp
  // sets the window so a platform stamped earlier than its sibling is not
  // left with a gap; the pull re-stamps both at `now`.
  const now = new Date();
  const stale = await db.messagingChannel.findMany({
    where: {
      platform: { in: [...PAGE_CHANNEL_PLATFORMS] },
      disconnectedAt: null,
      status: "connected",
      importedAt: { lte: new Date(now.getTime() - RESYNC_MS) },
    },
    orderBy: { importedAt: "asc" },
    select: { companyId: true, importedAt: true },
  });
  const oldestStamp = new Map();
  for (const c of stale) {
    if (companies.includes(c.companyId)) continue; // Its first pull just ran above.
    const prev = oldestStamp.get(c.companyId);
    if (!prev || c.importedAt < prev) oldestStamp.set(c.companyId, c.importedAt);
  }
  const resynced = [];
  for (const [companyId, stamp] of [...oldestStamp.entries()].slice(0, MAX_RESYNC_PER_RUN)) {
    const result = await importPageConversations({
      companyId,
      since: new Date(stamp.getTime() - RESYNC_OVERLAP_MS),
      limit: RESYNC_LIMIT,
      dryRun: dry,
      now,
    }).catch((err) => ({ kind: "error", lastError: { kind: "unknown_error", message: err?.message } }));
    resynced.push({
      companyId,
      since: new Date(stamp.getTime() - RESYNC_OVERLAP_MS).toISOString(),
      kind: result?.kind ?? "skipped",
      conversations: result?.conversations ?? 0,
      messages: result?.messages ?? 0,
      created: result?.created ?? 0,
      errors: result?.errors ?? 0,
      lastError: result?.lastError
        ? { kind: result.lastError.kind, platform: result.lastError.platform, message: result.lastError.message || null }
        : null,
    });
  }

  return NextResponse.json({
    ok: true,
    dry,
    due: companies.length,
    pending: [...new Set(due.map((c) => c.companyId))].length,
    results,
    resynced,
  });
}
