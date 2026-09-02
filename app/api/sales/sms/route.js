// app/api/sales/sms/route.js
//
// A rep texts a prospect their own signup link.
//
// ══ Two gates, on purpose ══════════════════════════════════════════════════
//
// GET goes through lib/sales/gate.js's requireSalesRep — the portal's normal
// door, which permits reads. POST goes through lib/sales/smsGate.js's
// requireSmsRep, the third narrow, named exception in this codebase (after
// outreachGate.js), and it is used at exactly this one method on this one
// route. That is the point of it: the blanket "the sales portal is read-only"
// rule stays intact for every other route, and the list of things a rep may do
// that leave the building stays short enough to read.
//
// ══ Why the rep sends, and nothing else does ═══════════════════════════════
//
// There is no cron behind this and no queue. The owner's requirement is that a
// rep presses send, and the compliance posture leans on it: a human chooses
// each recipient and each moment, one at a time, which is the same property the
// compliance audit relied on for cold calling.
//
// ══ Why the time zone is a field on this request ═══════════════════════════
//
// A text has a legal clock on it and the clock is the RECIPIENT's — see
// lib/sales/smsWindow.js. Nothing in this codebase knows where a typed-in lead
// is; an area code does not answer it (every ported mobile is a
// counter-example) and FieldQuo's own local time is the worst substitute
// available. The rep does know, because they just spoke to them. So the send
// form carries the zone, this route stores it on the lead, and a rep who does
// not state one is refused with that said rather than having a zone invented
// for them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireSmsRep } from "@/lib/sales/smsGate";
import { leadWhere } from "@/lib/sales/outreach";
import { deliverSignupLinkSms, salesSmsStatus, setLeadTimeZone } from "@/lib/sales/salesSms";
import { SALES_SMS_TIME_ZONES, isSalesSmsTimeZone } from "@/lib/sales/smsWindow";

/** The only columns this route reads, so both handlers see the same lead. */
const LEAD_SELECT = {
  id: true,
  businessName: true,
  email: true,
  phone: true,
  timeZone: true,
};

/**
 * The rep's own lead, or null.
 *
 * findFirst with the rep in the WHERE rather than findUnique-then-check: one
 * query that can only match a row satisfying both halves, which is the shape
 * every other sales route uses and the reason none of them has a scoping bug.
 */
function leadFor(repId, leadId) {
  return db.salesLead.findFirst({ where: leadWhere(repId, leadId), select: LEAD_SELECT });
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // searchParams is a Promise on the page side; on a Request it is a plain URL
  // read, which is what this is.
  const leadId = new URL(request.url).searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "Which lead?" }, { status: 400 });
  }

  const lead = await leadFor(rep.id, leadId);
  // 404 rather than 403 for another rep's lead — telling a caller a row exists
  // but is not theirs confirms it exists.
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // What has already gone out, so the panel can say "you texted them this on
  // Tuesday" rather than inviting a rep to send the same link four times. It is
  // also the read that keeps SalesSmsMessage from being a table written and
  // never looked at — AGENTS.md failure class #1.
  const messages = await db.salesSmsMessage.findMany({
    where: { leadId: lead.id, salesRepId: rep.id },
    orderBy: { sentAt: "desc" },
    take: 5,
    select: { id: true, toE164: true, body: true, sentAt: true },
  });

  return NextResponse.json({
    lead,
    sms: await salesSmsStatus({ rep, lead, origin: getAppOrigin(request) }),
    timeZones: SALES_SMS_TIME_ZONES,
    messages,
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return NextResponse.json({ error: "Which lead?" }, { status: 400 });

  // Stored BEFORE the send, so the window is evaluated against a zone that is
  // on the row rather than one carried in the request. A zone that only ever
  // lives in the request body would let the same rep send at 3am tomorrow by
  // passing a different one, and would leave nothing behind to explain why a
  // send was allowed.
  if (body.timeZone !== undefined && body.timeZone !== null) {
    if (!isSalesSmsTimeZone(body.timeZone)) {
      return NextResponse.json(
        { error: "That isn't a time zone this portal recognises." },
        { status: 400 },
      );
    }
    const stored = await setLeadTimeZone({ repId: rep.id, leadId, timeZone: body.timeZone });
    if (!stored) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Re-read after the write, so the send evaluates the row as it now stands
  // rather than as the request described it.
  const lead = await leadFor(rep.id, leadId);
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const result = await deliverSignupLinkSms({
    rep,
    lead,
    origin: getAppOrigin(request),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.blockers ? { blockers: result.blockers } : {}),
        ...(result.suppressed ? { suppressed: true, optedOut: true } : {}),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    to: result.to,
    body: result.body,
    sentAt: result.sentAt,
  });
}
