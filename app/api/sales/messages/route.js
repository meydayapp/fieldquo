// app/api/sales/messages/route.js
//
// A rep's text conversations: who wrote, what they said, a reply — and the
// check-in this contractor is due, waiting unsent.
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
//
// ══ THE LEAD LOOKUP WAS WRONG, AND IT COST EVERY SEND ═════════════════════
//
// This route used to ask for "this rep's most recently updated lead that has a
// phone at all", then discard it if the phone did not match the thread. For
// any rep holding more than one lead that is a miss almost every time, so
// `lead` was almost always null — including in POST, where the lead is the
// only source of the prospect's TIME ZONE. No zone means lib/sales/smsWindow.js
// refuses the send, correctly and with a good sentence, for a reason that has
// nothing to do with the clock. The reply box was refusing nearly every reply.
//
// The fix is leadForThread() in lib/sales/checkin/store.js: match on the
// NORMALISED number, because `phone` is stored as the rep typed it and
// "(514) 555-0134" and "+15145550134" are the same prospect.
//
// ══ Absent is not the same as empty ═══════════════════════════════════════
//
// `checkIns: null` means the draft table could not be read; `checkIns: []`
// means there are none. The screen says different things for the two, because
// "no drafts" and "we could not look" are different claims and only one of
// them is reassuring. AGENTS.md failure class #5.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireSmsRep } from "@/lib/sales/smsGate";
import {
  salesConversations,
  salesThread,
  deliverReplySms,
  salesSmsStatus,
} from "@/lib/sales/salesSms";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { getAppOrigin } from "@/lib/appUrl";
import { leadForThread, threadContext, openCheckIns, suggestionForThread } from "@/lib/sales/checkin/store";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const withE164 = normalisePhone(url.searchParams.get("with"));

  if (!withE164) {
    return NextResponse.json({ conversations: await salesConversations({ salesRepId: rep.id }) });
  }

  const messages = await salesThread({ salesRepId: rep.id, withE164 });
  const { lead, company, timeZone } = await threadContext({ salesRepId: rep.id, toE164: withE164 });

  // The same readiness the send itself evaluates, so the screen can hide a
  // compose box that could not succeed and SAY WHY. It is not the decision:
  // deliverReplySms reads the list again at the moment of the send, because an
  // opt-out that lands while the rep is typing has to win. Hiding a button is
  // not access control — this is the courtesy, that is the enforcement.
  const readiness = await salesSmsStatus({
    rep,
    lead: lead || { phone: withE164, timeZone: null },
    origin: getAppOrigin(request),
  }).catch(() => null);

  // Both reads fail soft and fail DISTINGUISHABLY. A missing SalesCheckIn
  // table — this deployment's Neon project is at its size limit and the table
  // could not be created — must show as "we could not look", never as "you
  // have no drafts".
  let checkIns = null;
  let suggestion = null;
  let checkInError = null;
  try {
    checkIns = await openCheckIns({ salesRepId: rep.id, toE164: withE164 });
    // Only when nothing is already open on this thread. A second draft for the
    // same company on the same day is noise, and the dedupe key would refuse
    // to store it anyway.
    if (!checkIns.length) {
      ({ suggestion } = await suggestionForThread({
        salesRepId: rep.id,
        company,
        timeZone,
        repName: rep.name,
      }));
    }
  } catch (err) {
    checkInError =
      "Check-in drafts could not be read, so this conversation may be missing one. " +
      "Nothing was sent and nothing was lost.";
    console.error("[sales messages] check-ins unreadable:", err?.message);
  }

  return NextResponse.json({
    with: withE164,
    messages,
    lead: lead
      ? { id: lead.id, businessName: lead.businessName, contactName: lead.contactName, timeZone: lead.timeZone }
      : null,
    // Only ever a company this rep is attributed to — threadContext re-checks
    // that through assignedCompanyWhere. The escalation control renders off
    // this and off nothing else, because a support ticket needs a signed-up
    // company and decideEscalation() refuses without one.
    company: company ? { id: company.id, name: company.name } : null,
    timeZone,
    canSend: readiness ? readiness.canSend : false,
    suppressed: readiness ? readiness.blockers.some((b) => b.code === "suppressed") : false,
    blockers: readiness ? readiness.blockers : null,
    checkIns,
    checkInError,
    suggestion,
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

  const lead = await leadForThread({ salesRepId: rep.id, toE164: withE164 });

  const result = await deliverReplySms({
    rep,
    // The lead supplies the prospect's TIME ZONE, which is what the texting
    // window is judged in. A lead matched by anything other than the number
    // would evaluate the clock against somebody else's town.
    lead: lead || { phone: withE164, timeZone: null },
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
