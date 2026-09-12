// app/api/sales/messages/triage/route.js
//
// The rep overrides the chip on a text conversation.
//
// ══ Why requireOutreachRep and not requireSalesRep ════════════════════════
//
// requireSalesRep refuses every non-GET under /api/sales, deliberately — see
// lib/sales/gate.js. requireOutreachRep is the named exception in front of
// writes that are the rep's own work and decide no money; the read-marker
// route beside this one uses it for the same shape. The write is one column
// pair on the rep's OWN latest inbound row (lib/sales/replyTriage.js's
// overrideTriage, rep id in the WHERE), and it moves no milestone, mints no
// entry and reaches no carrier.
//
// ══ Nothing here sends anything, and nothing here lifts a STOP ════════════
//
// A rep relabelling "stop" as "fine" changes a chip. The do-not-contact row
// the keyword wrote is lib/sales/suppression.js's, superadmin-only to
// remove, and the send path reads THAT, not this column.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { isTriageKind } from "@/lib/sales/messages/triage";
import { overrideTriage } from "@/lib/sales/replyTriage";

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const withE164 = normalisePhone(body?.with);
  if (!withE164) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });

  // `null` clears the chip; anything else must be one of ours. A body that
  // forgot the field is refused rather than read as a clear.
  if (!body || !("triage" in body)) return NextResponse.json({ error: "Which kind?" }, { status: 400 });
  const triage = body.triage === null ? null : body.triage;
  if (triage !== null && !isTriageKind(triage)) {
    return NextResponse.json({ error: "That is not a kind of reply this screen knows." }, { status: 400 });
  }

  const result = await overrideTriage({ salesRepId: rep.id, e164: withE164, triage });
  if (!result.ok) {
    return NextResponse.json({ error: "They have not written to you in this conversation, so there is nothing to label." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, with: withE164, triage, messageId: result.messageId });
}
