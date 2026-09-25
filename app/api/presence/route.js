// app/api/presence/route.js
//
// The /app keepalive: "a person is using FieldQuo in this tab". Stamps the
// caller's own Member.lastActiveAt, at most once per two minutes, so the
// platform console can say "Online now" / "Active 2 h ago" about a company
// (lib/platform/companyPresence.js). The sales portal's /api/sales/presence
// is the model; this is the same idea without the dialler.
//
// ══ Why a browser beat, and not a stamp inside getCurrentMember ═══════════
//
// getCurrentMember runs on every authenticated request and already carries
// one throttled side effect (the seat-sharing sample in
// lib/security/deviceGuard.js), so hanging the stamp there was the obvious
// alternative. It was rejected because "a request arrived" is not "a person
// is here":
//
//   · Screens poll with nobody looking. Jennifer's panel polls every five
//     seconds while a conversation is escalated, visible or not; the crew
//     chats poll their room lists. A laptop left open on the dashboard over a
//     weekend would read "Online now" until Monday.
//   · The app layout calls getCurrentMember five times per render, and every
//     /api call does it again — the stamp would sit on the hottest path in
//     the app to answer a question asked by one screen in the console.
//
// The beat (app/components/layout/ActivityBeat.js) fires only while the tab
// is VISIBLE and someone has touched it recently, once a minute, and this
// route writes only when the stamp is older than ACTIVE_STAMP_REFRESH_MS —
// the conditional is in the WHERE, so two tabs cannot both write. The page
// never awaits it and never shows its failure.
//
// ══ A support session never stamps — three independent refusals ══════════
//
//   1. middleware.js refuses every non-GET under a read-only impersonation
//      cookie with a 403 before this handler runs.
//   2. getCurrentMember resolves ANY impersonation cookie first, and a demo
//      sandbox (which the middleware lets write) comes back
//      `impersonation: true`; shouldStamp() refuses it here — including the
//      demo owner's real member id, which is why it checks the flag and not
//      only the id.
//   3. The layout does not mount the beat for a support session at all.
//
// A superadmin viewing a customer's account must never make that customer
// look active (non-negotiable #2: impersonation is read-only, and this is a
// write).
//
// ══ Billing ═══════════════════════════════════════════════════════════════
//
// Resolved with skipBillingGate, the same way POST /api/track resolves its
// /app hits. The gate refuses POSTs from a company in its read-only week
// after a failed payment; that company is precisely one FieldQuo wants to
// know is still coming in. The write is the server's clock on the caller's
// own row — nothing the customer owns changes, and no input reaches it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { shouldStamp, stampMemberActive } from "@/lib/company/memberActivity";

export async function POST(request) {
  // No session → 401; a read-only support session that got past the
  // middleware somehow → getCurrentMember's own 403. Nothing is stamped on
  // either path.
  const { member, response } = await memberOrRefusal(request, { skipBillingGate: true });
  if (response) return response;

  if (!shouldStamp(member)) {
    return NextResponse.json(
      {
        error: "A support session doesn't count as the company being active, so nothing was recorded.",
        stamped: false,
      },
      { status: 403 },
    );
  }

  const stamped = await stampMemberActive(member.id, new Date());
  return NextResponse.json({ ok: true, stamped });
}
