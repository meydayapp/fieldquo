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
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { firstSuppression } from "@/lib/sales/suppression";
import { ownNumbers } from "@/lib/sales/calls/store";
import { CHANNEL_TEXT } from "@/lib/sales/contact/numbers";
import { loadContactNumbers, pickContactNumber } from "@/lib/sales/contact/resolve";

/** The only columns this route reads, so both handlers see the same lead. */
const LEAD_SELECT = {
  id: true,
  businessName: true,
  email: true,
  phone: true,
  timeZone: true,
  // Where they are, so the texting window can be judged from the province
  // when no rep has stated a zone — lib/sales/leadTimeZone.js.
  country: true,
  province: true,
  // The discovered business behind this lead, when there is one. Read because
  // an extra number a rep was given hangs on the BUSINESS — see
  // app/api/sales/calls/numbers — so a lead that never saw the number itself
  // still has to be able to text it, and because a do-not-contact recorded
  // against the business covers every number of theirs.
  prospectId: true,
  prospect: { select: { id: true, phoneE164: true, doNotContactAt: true, country: true, province: true } },
};

/**
 * Which number this text goes to, and every reason it may not.
 *
 * ══ Why a landline is REFUSED and not merely warned about ═════════════════
 *
 * Texting a landline is a silent success: the carrier accepts the message, the
 * provider reports it sent, the rep sees a green tick, and it reaches nobody.
 * There is no bounce and no error to log, so a rep waits two days for a reply
 * to a message that was never delivered. lib/sales/contact/numbers.js exists
 * for that one failure, and this is the texting side of it — the choice is
 * made with `channel: "text"`, so a number recorded as a landline is not in
 * the list at all and the reason comes back with the refusal.
 *
 * ══ The browser names an ID, never a number ═══════════════════════════════
 *
 * Same rule as the dial route and the same reason: a request that could name
 * its own destination is a way to spend FieldQuo's money at a carrier on a
 * number nobody at FieldQuo has ever seen. The row is re-read here, scoped to
 * this lead and its prospect.
 */
async function textTargetFor(lead, contactNumberId) {
  const [ours, rows] = await Promise.all([
    ownNumbers().catch(() => []),
    loadContactNumbers({ prospectId: lead.prospectId, salesLeadId: lead.id }),
  ]);

  const primary = normalisePhone(lead.phone) || lead.prospect?.phoneE164 || null;

  // Every number of theirs, not just the one being texted. A STOP is keyed on
  // the number it arrived from, so a contractor who opted out from the shop
  // line must not be reachable on a mobile somebody gave us afterwards.
  const suppression = await firstSuppression(db, {
    channel: "sms",
    phones: [...new Set([primary, ...rows.map((r) => normalisePhone(r.e164))].filter(Boolean))],
  });

  const chosen = pickContactNumber({
    target: { phoneE164: primary },
    rows,
    contactNumberId,
    channel: CHANNEL_TEXT,
    ourNumbers: ours,
    // One flag for both standing refusals. contactChoices() then refuses every
    // number of theirs rather than only the listed one, which is the whole
    // point of the flag being on the business.
    blocked: Boolean(lead.prospect?.doNotContactAt) || Boolean(suppression.suppressed),
    blockedReason: lead.prospect?.doNotContactAt
      ? "This business asked not to be contacted. That does not expire, and it covers every " +
        "number of theirs."
      : suppression.reason,
  });

  return { chosen, rows, suppression };
}

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

  // Which number the text would go to, and every one it could go to instead.
  // Asked with `contactNumberId` from the query so the panel can preview a
  // specific choice — the readiness below is then computed for THAT number
  // rather than for the one on the lead, which is what makes the previewed
  // message and the sent message the same message.
  const contactNumberId = new URL(request.url).searchParams.get("contactNumberId") || "";
  const { chosen } = await textTargetFor(lead, contactNumberId);

  return NextResponse.json({
    lead,
    // The readiness is computed against the CHOSEN number. Handing
    // salesSmsStatus the lead's own phone while the send used another one
    // would put a different number in the preview than in the message — and
    // the suppression read, the +1 rule and the unusable-number blocker would
    // all be answering about a number nobody was going to text.
    sms: await salesSmsStatus({
      rep,
      lead: chosen.ok ? { ...lead, phone: chosen.e164 } : lead,
      origin: getAppOrigin(request),
    }),
    // The picker, and what was refused with the reason. A rep who was given a
    // number and cannot see it in the list will phone it off their own handset
    // — lib/sales/contact/numbers.js says so — so the refusals are shown, not
    // dropped.
    contact: {
      to: chosen.ok ? chosen.e164 : null,
      contactNumberId: chosen.ok ? chosen.numberId : null,
      choices: chosen.choices,
      refused: chosen.refused,
      reason: chosen.code,
      error: chosen.error,
    },
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

  // ── Which number, decided HERE and not on the screen ──────────────────
  //
  // The request names an id of a number we already stored, never a number.
  // Resolved again in the request that sends, so a picker rendered before a
  // landline was reclassified cannot send a text into a void — and so a
  // do-not-contact or a STOP that landed in between wins.
  const { chosen } = await textTargetFor(
    lead,
    typeof body.contactNumberId === "string" ? body.contactNumberId.trim() : "",
  );
  if (!chosen.ok) {
    return NextResponse.json(
      {
        error: chosen.error,
        reason: chosen.code,
        refused: chosen.refused,
        choices: chosen.choices,
        // A landline refusal is not a failure the rep should retry. Said as a
        // blocker so the panel renders it in the same place as every other
        // reason a text cannot go out.
        blockers: [{ code: chosen.code, title: chosen.error, fix: "Ring them and ask where to text." }],
      },
      { status: chosen.code === "not_on_this_record" ? 404 : 409 },
    );
  }

  const result = await deliverSignupLinkSms({
    rep,
    // The chosen number stands in for the lead's own, so every rule
    // salesSmsReadiness applies — the suppression read at send time, the +1
    // restriction, the texting window — runs against the number that will
    // actually be messaged. Nothing about the lead row is changed by this.
    lead: { ...lead, phone: chosen.e164 },
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
