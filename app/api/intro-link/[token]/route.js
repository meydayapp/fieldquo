// app/api/intro-link/[token]/route.js
//
// The public door behind the intro email's three links — "call me back",
// "book a demo", "unsubscribe". No session: the person holding the token is
// a contractor reading an email on their phone.
//
// ══ GET reads, POST acts ═════════════════════════════════════════════════
//
// The same split app/api/no-contact/[token]/route.js and the marketing
// unsubscribe keep, for the same reason: Outlook Safe Links and corporate
// mail proxies pre-fetch every link in delivered mail with a plain GET. A
// GET that filed a call-back request would file one for every prospect
// whose mail server scanned the message. So GET answers what the page
// should show, and the request is the POST behind the one button.
//
// ══ One refusal for every bad token ══════════════════════════════════════
//
// A malformed token, a tampered one, one for a row that does not exist and
// one whose row disagrees with it all answer 404 "This link isn't valid" —
// telling a caller WHICH check they failed is a hint (lib/dataDeletion/
// signedRequest.js says the same). Expiry is the one distinguished case,
// because the person holding an expired link did nothing wrong and should
// be told to reply to the email instead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { actIntroLink, introLinkState } from "@/lib/sales/outreach/introRequests";

function refusalFor(reason) {
  if (reason === "expired") return { status: 410, body: { error: "This link has expired.", reason: "expired" } };
  return { status: 404, body: { error: "This link isn't valid.", reason: "invalid" } };
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const state = await introLinkState(token);
  if (!state.ok) {
    const r = refusalFor(state.reason);
    return NextResponse.json(r.body, { status: r.status });
  }
  return NextResponse.json(state);
}

export async function POST(request, { params }) {
  const { token } = await params;
  const result = await actIntroLink(token);
  if (!result.ok) {
    if (result.reason === "refused") return NextResponse.json({ error: result.error || "That didn't go through." }, { status: 400 });
    const r = refusalFor(result.reason);
    return NextResponse.json(r.body, { status: r.status });
  }
  return NextResponse.json(result);
}
