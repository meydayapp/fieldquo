// app/api/mailbox/google/callback/route.js
//
// GET — Google's redirect back after consent. Verifies the signed state
// against its cookie and the signed-in member, exchanges the code, checks
// Google actually GRANTED gmail.readonly (a person can untick it), learns the
// address from the id_token, and saves the connection with the refresh token
// sealed. Every failure lands back on the card with a code it has a
// sentence for; nothing here renders a page of its own.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";
import { providerAvailable } from "@/lib/mailbox/config";
import { exchangeGoogleCode, decodeIdTokenEmail, GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE } from "@/lib/mailbox/providers/google";
import { verifyState, STATE_COOKIE, INTENT_COOKIE, decodeIntent } from "@/lib/mailbox/oauthState";
import { saveConnection, WORK_EMAIL_SETTINGS_PATH, isOwnerOrAdmin } from "@/lib/mailbox/connections";
import { syncMailbox } from "@/lib/mailbox/sync";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const back = (params) => NextResponse.redirect(`${origin}${WORK_EMAIL_SETTINGS_PATH}?${new URLSearchParams(params)}`);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(STATE_COOKIE.google)?.value || null;
  const intent = decodeIntent(cookieStore.get(INTENT_COOKIE)?.value);
  cookieStore.delete(STATE_COOKIE.google);
  cookieStore.delete(INTENT_COOKIE);

  if (url.searchParams.get("error")) return back({ mailbox: "denied" });
  if (!code || !state || !cookieValue) return back({ mailbox: "bad_state" });
  const verified = verifyState(state, { cookieValue });
  if (!verified) return back({ mailbox: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  if (!member || member.id !== verified.memberId) return back({ mailbox: "session" });
  if (member.impersonation) return back({ mailbox: "read_only" });
  if (!providerAvailable("google")) return back({ mailbox: "not_configured" });
  // Re-checked here: the intent cookie is the browser's, the role is ours.
  if (intent.scope === "company" && !isOwnerOrAdmin(member)) return back({ mailbox: "company_scope_forbidden" });

  const exchanged = await exchangeGoogleCode({ code, redirectUri: `${origin}/api/mailbox/google/callback` });
  if (!exchanged.ok) {
    await recordError({
      area: "mailbox",
      code: "google_code_exchange",
      message: `Gmail connect: code exchange failed (${exchanged.message}).`,
      companyId: member.companyId,
      detail: { memberId: member.id, status: exchanged.status },
    }).catch(() => null);
    return back({ mailbox: "exchange_failed" });
  }
  const refreshToken = exchanged.data?.refresh_token;
  if (!refreshToken) return back({ mailbox: "no_refresh_token" });
  const granted = String(exchanged.data?.scope || "");
  if (!granted.includes(GMAIL_READ_SCOPE)) return back({ mailbox: "scope_missing" });
  if (intent.send && !granted.includes(GMAIL_SEND_SCOPE)) return back({ mailbox: "send_scope_missing" });

  const email = decodeIdTokenEmail(exchanged.data?.id_token);
  if (!email) return back({ mailbox: "no_address" });

  const saved = await saveConnection(db, {
    member,
    provider: "google",
    address: email,
    scope: intent.scope,
    secret: refreshToken,
    grantedScopes: granted,
  });
  if (!saved.ok) return back({ mailbox: saved.code });

  // Sending was what this consent was for: switch it on now that Google
  // granted gmail.send. (Only ever for the company mailbox — see connect.)
  if (intent.send && intent.scope === "company") {
    // One company mailbox sends at a time — the same rule the switch applies.
    await db.mailboxConnection.updateMany({
      where: { companyId: member.companyId, id: { not: saved.row.id }, sendEnabled: true },
      data: { sendEnabled: false },
    });
    await db.mailboxConnection.update({
      where: { id: saved.row.id },
      data: { sendEnabled: true, sendEnabledAt: new Date(), sendEnabledById: member.id },
    });
  }

  await recordActivity(member, {
    action: "mailbox.connected",
    entityType: "settings",
    entityId: saved.row.id,
    summary: `Connected the mailbox ${email} (Google)`,
    summaryKey: "app.workEmail.activity.connected",
  }).catch(() => null);

  after(async () => {
    const row = await db.mailboxConnection.findUnique({ where: { id: saved.row.id } });
    if (row) await syncMailbox(db, row, { budgetMs: 45 * 1000 }).catch(() => null);
  });

  return back({ mailbox: intent.send ? "sending_on" : "connected" });
}
