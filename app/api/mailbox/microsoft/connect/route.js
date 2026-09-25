// app/api/mailbox/microsoft/connect/route.js
//
// GET — start connecting a Microsoft 365 / Outlook.com mailbox (and GoDaddy's
// Microsoft-hosted email). Same shape as the Google door: server-side
// refusals, a signed state in an httpOnly cookie, the intent beside it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { providerAvailable } from "@/lib/mailbox/config";
import { microsoftAuthorizeUrl, msStateSecret } from "@/lib/mailbox/providers/microsoft";
import { signState, stateCookieOptions, STATE_COOKIE, INTENT_COOKIE, encodeIntent } from "@/lib/mailbox/oauthState";
import { WORK_EMAIL_SETTINGS_PATH, isOwnerOrAdmin } from "@/lib/mailbox/connections";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const back = (params) => NextResponse.redirect(`${origin}${WORK_EMAIL_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return back({ mailbox: "read_only" });
  if (!providerAvailable("microsoft")) return back({ mailbox: "not_configured" });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "company" ? "company" : "member";
  const send = url.searchParams.get("send") === "1";
  if (scope === "company" && !isOwnerOrAdmin(member)) return back({ mailbox: "company_scope_forbidden" });
  if (send && scope !== "company") return back({ mailbox: "send_company_only" });

  const state = signState({ memberId: member.id, secret: msStateSecret() });
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE.microsoft, state, stateCookieOptions());
  cookieStore.set(INTENT_COOKIE, encodeIntent({ scope, send }), stateCookieOptions());

  const hint = url.searchParams.get("hint");
  return NextResponse.redirect(
    microsoftAuthorizeUrl({
      redirectUri: `${origin}/api/mailbox/microsoft/callback`,
      state,
      withSend: send,
      loginHint: hint && /^[^\s@]+@[^\s@]+$/.test(hint) ? hint.slice(0, 254) : null,
    }),
  );
}
