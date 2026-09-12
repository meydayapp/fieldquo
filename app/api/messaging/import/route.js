// app/api/messaging/import/route.js
//
// "Refresh from Facebook": pull the company's existing Page and Instagram
// conversations into the inbox, now, by hand.
//
// ══ Why a button as well as the connect-time run ═══════════════════════════
//
// The connect flow runs the import once (lib/messaging/pageImport.js's
// importAfterConnect) — but a Page connected before that existed never got
// one, a contractor who answered on their phone all week wants the echoes
// the webhook did not carry while the subscription hiccuped, and "shouldn't
// we fetch them?" deserves a control that does exactly that, in front of the
// person asking. So: a POST a member presses, and never a read that writes.
//
// ══ Who may press it ═══════════════════════════════════════════════════════
//
// `requests` at view_create_edit — the same rung as replying. Importing
// writes threads into the company's inbox, which is a write against its
// relationship with its customers, not a read of it. And a MEMBER of the
// company: memberOrRefusal refuses an impersonation cookie on every non-GET
// (middleware does too), so the platform console cannot press this into a
// customer's tenant — non-negotiable #3, which is why the import is a
// company member's button and never a superadmin read.
//
// ══ Rate limit ═════════════════════════════════════════════════════════════
//
// Once per ten minutes per COMPANY, enforced on the stamp the import writes
// (MessagingChannel.importedAt) rather than on lib/rateLimit.js's per-IP,
// per-instance window — a limit that has to hold across Vercel instances
// cannot live in one instance's memory. The in-memory guard is kept as well,
// as the cheap first line against a held-down button.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { rateLimit } from "@/lib/rateLimit";
import { refreshPageConversations } from "@/lib/messaging/pageImport";

/** classifyMetaError's kinds and this route's own, to a status the browser can act on. */
const STATUS_FOR_KIND = Object.freeze({
  ok: 200,
  demo: 409,
  not_connected: 409,
  not_granted: 409,
  rate_limited: 429,
  error: 502,
});

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireLevel(
      { ...member, permissions: member.id ? (await loadEnforceableMember(db, member.id))?.permissions ?? null : null },
      "requests",
      "view_create_edit",
      "import conversations",
    );
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const limited = rateLimit(request, "messaging-import", {
    limit: 3,
    windowMs: 60 * 1000,
    message: "That import is already running. Give it a moment.",
  });
  if (limited) return limited;

  const result = await refreshPageConversations({ companyId: member.companyId });

  const status = STATUS_FOR_KIND[result.kind] || 502;
  return NextResponse.json(
    {
      kind: result.kind,
      conversations: result.conversations,
      messages: result.messages,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
      platforms: result.platforms,
      // The KIND of the last Meta refusal, never Meta's prose: a Graph error
      // message is written for a developer, in English, and can quote an id
      // straight back at a browser. The screen has a sentence per kind.
      lastError: result.lastError ? { kind: result.lastError.kind, platform: result.lastError.platform } : null,
      ...(result.kind === "rate_limited" ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
      // A message on every refusal, so fetchJson / reportResponseError have
      // something truthful to show rather than "Something went wrong on our
      // end" for a state that is Meta's, or the company's own.
      ...(status !== 200 ? { error: refusalMessage(result) } : {}),
    },
    {
      status,
      ...(result.kind === "rate_limited"
        ? { headers: { "retry-after": String(result.retryAfterSeconds || 60) } }
        : {}),
    },
  );
}

function refusalMessage(result) {
  switch (result.kind) {
    case "demo":
      return "This is the sample inbox, so there is nothing to import into it.";
    case "not_connected":
      return "No Facebook Page is connected to this inbox.";
    case "not_granted":
      return "Meta hasn't granted this Page's messaging permission, so its conversations can't be read. Reconnect the Page and allow messaging.";
    case "rate_limited":
      return "Conversations were refreshed a moment ago. Try again in a few minutes.";
    default:
      return result.lastError?.kind === "auth_error"
        ? "That Page needs reconnecting before its conversations can be read."
        : "Meta didn't return this Page's conversations. Try again in a moment.";
  }
}
