// app/api/mailbox/microsoft/callback/route.js
//
// GET — Microsoft's redirect back after consent. Same checks as the Google
// callback: the signed state against its cookie and the signed-in member, the
// role re-checked for a company mailbox, Mail.Read actually granted, and the
// address read from Graph's /me with the fresh access token.
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
import { exchangeMicrosoftCode, microsoftMe, msStateSecret } from "@/lib/mailbox/providers/microsoft";
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
  const cookieValue = cookieStore.get(STATE_COOKIE.microsoft)?.value || null;
  const intent = decodeIntent(cookieStore.get(INTENT_COOKIE)?.value);
  cookieStore.delete(STATE_COOKIE.microsoft);
  cookieStore.delete(INTENT_COOKIE);

  // AADSTS65001 & co. arrive as ?error=…; "consent_required" is a tenant
  // whose admin has switched off user consent — its own sentence on the card.
  const err = url.searchParams.get("error");
  if (err) return back({ mailbox: /consent_required|admin/i.test(`${err} ${url.searchParams.get("error_description") || ""}`) ? "admin_consent_required" : "denied" });
  if (!code || !state || !cookieValue) return back({ mailbox: "bad_state" });
  const verified = verifyState(state, { cookieValue, secret: msStateSecret() });
  if (!verified) return back({ mailbox: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  if (!member || member.id !== verified.memberId) return back({ mailbox: "session" });
  if (member.impersonation) return back({ mailbox: "read_only" });
  if (!providerAvailable("microsoft")) return back({ mailbox: "not_configured" });
  if (intent.scope === "company" && !isOwnerOrAdmin(member)) return back({ mailbox: "company_scope_forbidden" });

  const redirectUri = `${origin}/api/mailbox/microsoft/callback`;
  const exchanged = await exchangeMicrosoftCode({ code, redirectUri, withSend: intent.send });
  if (!exchanged.ok) {
    await recordError({
      area: "mailbox",
      code: "microsoft_code_exchange",
      message: `Microsoft mailbox connect: code exchange failed (${exchanged.message}).`,
      companyId: member.companyId,
      detail: { memberId: member.id, status: exchanged.status },
    }).catch(() => null);
    return back({ mailbox: "exchange_failed" });
  }
  const refreshToken = exchanged.data?.refresh_token;
  if (!refreshToken) return back({ mailbox: "no_refresh_token" });
  const granted = String(exchanged.data?.scope || "");
  if (!/Mail\.Read/i.test(granted)) return back({ mailbox: "scope_missing" });
  if (intent.send && !/Mail\.Send/i.test(granted)) return back({ mailbox: "send_scope_missing" });

  const email = await microsoftMe(exchanged.data?.access_token);
  if (!email) return back({ mailbox: "no_address" });

  const saved = await saveConnection(db, {
    member,
    provider: "microsoft",
    address: email,
    scope: intent.scope,
    secret: refreshToken,
    grantedScopes: granted,
  });
  if (!saved.ok) return back({ mailbox: saved.code });

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
    summary: `Connected the mailbox ${email} (Microsoft)`,
    summaryKey: "app.workEmail.activity.connected",
  }).catch(() => null);

  after(async () => {
    const row = await db.mailboxConnection.findUnique({ where: { id: saved.row.id } });
    if (row) await syncMailbox(db, row, { budgetMs: 45 * 1000 }).catch(() => null);
  });

  return back({ mailbox: intent.send ? "sending_on" : "connected" });
}
