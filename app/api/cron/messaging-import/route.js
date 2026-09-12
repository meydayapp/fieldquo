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
// Never-imported ONLY. This is not a periodic re-sync: after the first pull
// the webhook carries every message, and re-pulling a Page's conversations
// every fifteen minutes for every tenant would spend Meta's rate budget on
// rows the ingest would find already written.
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

/** Companies per run. Each is up to two platforms of up to 100 conversations. */
const MAX_PER_RUN = 5;

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
      lastError: result?.lastError ? { kind: result.lastError.kind, platform: result.lastError.platform } : null,
    });
  }

  return NextResponse.json({
    ok: true,
    dry,
    due: companies.length,
    pending: [...new Set(due.map((c) => c.companyId))].length,
    results,
  });
}
