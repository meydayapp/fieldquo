// app/api/mailbox/google/connect/route.js
//
// GET — start connecting a Gmail / Google Workspace mailbox. Redirects to
// Google's consent screen with gmail.readonly (and gmail.send when the
// company mailbox is being set up to send client email, ?send=1).
//
// A GET that redirects, like the calendar's: the card is a link. Refuses
// server-side — never only by hiding the link — when the deployment is not
// configured, when the caller is a read-only support session, and when a
// non-admin asks for the company mailbox.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { providerAvailable } from "@/lib/mailbox/config";
import { gmailAuthorizeUrl } from "@/lib/mailbox/providers/google";
import { signState, stateCookieOptions, STATE_COOKIE, INTENT_COOKIE, encodeIntent } from "@/lib/mailbox/oauthState";
import { WORK_EMAIL_SETTINGS_PATH, isOwnerOrAdmin } from "@/lib/mailbox/connections";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const back = (params) => NextResponse.redirect(`${origin}${WORK_EMAIL_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return back({ mailbox: "read_only" });
  if (!providerAvailable("google")) return back({ mailbox: "not_configured" });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "company" ? "company" : "member";
  const send = url.searchParams.get("send") === "1";
  if (scope === "company" && !isOwnerOrAdmin(member)) return back({ mailbox: "company_scope_forbidden" });
  if (send && scope !== "company") return back({ mailbox: "send_company_only" });

  const state = signState({ memberId: member.id });
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE.google, state, stateCookieOptions());
  cookieStore.set(INTENT_COOKIE, encodeIntent({ scope, send }), stateCookieOptions());

  return NextResponse.redirect(gmailAuthorizeUrl({ redirectUri: `${origin}/api/mailbox/google/callback`, state, withSend: send }));
}
