// app/api/sales/messages/route.js
//
// A rep's text conversations: who wrote, what they said, and a reply.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// A rep could send exactly one thing — a templated signup link, from a panel
// on a lead — and could see nothing that came back. Until the inbound handler
// started storing replies, nothing DID come back: a contractor answering "sure,
// call me Thursday" was scanned for STOP and dropped. Both halves exist now, so
// this is the screen behind them.
//
// ══ The same two gates, unchanged ═════════════════════════════════════════
//
// GET goes through requireSalesRep — the portal's normal door, which permits
// reads. POST goes through requireSmsRep, the narrow named exception, used at
// exactly this one method. The blanket "the sales portal is read-only" rule
// stays intact everywhere else, and the list of things a rep may do that leave
// the building stays short enough to read.
//
// ══ A rep's own conversations, and nobody else's ══════════════════════════
//
// Every read is scoped by salesRepId. Two reps working different territories
// off one shared sales number must not read each other's prospects, and "it is
// all our own number anyway" is the argument that turns a shared line into a
// shared inbox.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireSmsRep } from "@/lib/sales/smsGate";
import { salesConversations, salesThread, deliverReplySms } from "@/lib/sales/salesSms";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const withE164 = normalisePhone(url.searchParams.get("with"));

  if (!withE164) {
    return NextResponse.json({ conversations: await salesConversations({ salesRepId: rep.id }) });
  }

  const messages = await salesThread({ salesRepId: rep.id, withE164 });
  // The lead behind the thread, when there is one — so the screen can name the
  // business rather than a phone number, and link to the record.
  const lead = messages.length
    ? await db.salesLead.findFirst({
        where: { salesRepId: rep.id, phone: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, businessName: true, contactName: true, phone: true },
      })
    : null;

  return NextResponse.json({
    with: withE164,
    messages,
    // Only when the phone actually matches. A lead attached because it was the
    // rep's most recent one would put the wrong business's name over somebody
    // else's conversation.
    lead: lead && normalisePhone(lead.phone) === withE164 ? lead : null,
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const withE164 = normalisePhone(body?.to);
  const text = String(body?.text ?? "").trim();

  if (!withE164) return NextResponse.json({ error: "Who to?" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "There is nothing to send." }, { status: 400 });

  // The rep must already be IN this conversation. A free-text send to an
  // arbitrary number would be a cold-contact path with none of the
  // first-contact rules attached — no signup link, no lead, and no record of
  // where the number came from.
  const existing = await salesThread({ salesRepId: rep.id, withE164 });
  if (!existing.length) {
    return NextResponse.json(
      {
        error:
          "You have not texted this number before. Start from the lead — the first message carries " +
          "your signup link and the identification the law wants on a first contact.",
      },
      { status: 409 },
    );
  }

  const lead = await db.salesLead.findFirst({
    where: { salesRepId: rep.id, phone: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, phone: true, timeZone: true, businessName: true, salesRepId: true },
  });

  const result = await deliverReplySms({
    rep,
    // The lead supplies the prospect's TIME ZONE, which is what the texting
    // window is judged in. Passing the wrong one would evaluate the clock
    // against somebody else's town.
    lead: lead && normalisePhone(lead.phone) === withE164 ? lead : { phone: withE164, timeZone: null },
    text,
    origin: getAppOrigin(request),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers || null, suppressed: result.suppressed || false },
      { status: result.status || 409 },
    );
  }
  return NextResponse.json({ ok: true, messages: await salesThread({ salesRepId: rep.id, withE164 }) });
}
