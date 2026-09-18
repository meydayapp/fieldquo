// app/api/sales/intro-email/route.js
//
// The "we tried calling you" email, from the pop-up on the call console.
//
//   GET  ?leadId= | ?prospectId=   what the pop-up may offer — the addresses
//                                  on the record, each judged, the default
//                                  language, or the reason nothing can go.
//   POST { leadId | prospectId, attemptId?, toAddress, language }
//                                  send it. A typed address is saved on the
//                                  lead first (lib/sales/contact/record.js);
//                                  every refusal the GET reported is decided
//                                  again here, fresh.
//
// Behind requireOutreachRep — the gate for a rep's own outreach — because
// that is what this is: an email, from the rep's mailbox, to a prospect on
// the rep's own record. The tables it writes (salesIntroEmail,
// salesContactEmail, and salesLead when a prospect has no lead yet) are on
// REP_OUTREACH_WRITES with the reason beside each.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { introEmailOffer, sendIntroEmail } from "@/lib/sales/outreach/introSend";

const id = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : null);

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const leadId = id(url.searchParams.get("leadId"));
  const prospectId = id(url.searchParams.get("prospectId"));
  if (!leadId && !prospectId) return NextResponse.json({ error: "Which lead?" }, { status: 400 });

  const offer = await introEmailOffer({ rep, leadId, prospectId });
  if (!offer.ok) return NextResponse.json({ error: offer.error, code: offer.code }, { status: offer.status });
  return NextResponse.json(offer);
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  const leadId = id(body.leadId);
  const prospectId = id(body.prospectId);
  if (!leadId && !prospectId) return NextResponse.json({ error: "Which lead?" }, { status: 400 });

  const result = await sendIntroEmail({
    rep,
    leadId,
    prospectId,
    attemptId: id(body.attemptId),
    toAddress: typeof body.toAddress === "string" ? body.toAddress.slice(0, 254) : "",
    language: typeof body.language === "string" ? body.language.slice(0, 2) : "",
    request,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status || 400 });
  return NextResponse.json(result, { status: 201 });
}
