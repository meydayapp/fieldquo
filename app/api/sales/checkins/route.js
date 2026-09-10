// app/api/sales/checkins/route.js
//
// A rep writes down a check-in they intend to send. Nothing is sent here.
//
// ══ Two ways in, one row out ══════════════════════════════════════════════
//
//   ENGINE   the conversation is with a company lib/sales/checkin/signals.js
//            says is due. The rep presses "Use this draft" and the wording is
//            produced by draftCheckIn() — the model rewriting the rule draft,
//            metered, once, on a press. The suggestion the screen showed was
//            the free deterministic version; see store.js for why the model is
//            not asked while merely rendering a page.
//
//   MANUAL   the rep types "follow up on the quote Thursday" against any
//            conversation, company or not. The owner asked for exactly this:
//            "or set up a manual one based on a conversation."
//
// Both produce the same kind of row, in status `draft`, and both wait for a
// press on the send route. There is no third way to make one and no scheduler
// that acts on either.
//
// ══ Why requireSmsRep and not a fourth gate ═══════════════════════════════
//
// lib/sales/gate.js refuses every non-GET under /api/sales, so a write needs a
// named exception. requireSmsRep is the exception that already exists for the
// texting machinery, and this IS the texting machinery — a row here becomes a
// text on the send route, through the same deliverReplySms every reply uses.
// A fourth gate would be a fourth copy of the same fresh-read-the-rep code
// with a different list attached to it.
//
// The list is separate rather than appended: REP_SMS_WRITES is asserted to
// name exactly two models for exactly one route, so the tables THIS route
// writes are declared as REP_CHECKIN_WRITES in lib/sales/checkin/store.js and
// asserted by scripts/check-sales-messages.mjs.
//
// ══ The window and the list are checked HERE too, and again at the send ════
//
// A moment outside the texting window is refused now, because writing down an
// intention that can never be honoured is a control that appears to work. A
// suppressed contractor gets no draft at all, for the same reason. Neither
// check is the enforcement: lib/sales/salesSms.js reads the list fresh at the
// instant a message would leave, and that is the one that binds.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSmsRep } from "@/lib/sales/smsGate";
import { salesThread, salesSmsStatus } from "@/lib/sales/salesSms";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { getAppOrigin } from "@/lib/appUrl";
import { parseScheduleRequest } from "@/lib/sales/checkin/schedule";
import {
  createCheckIn,
  engineDedupeKey,
  suggestionForThread,
  threadContext,
  updateCheckIn,
} from "@/lib/sales/checkin/store";

export async function POST(request) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const toE164 = normalisePhone(body?.to);
  const typed = String(body?.text ?? "").trim();
  const wantsEngineDraft = body?.origin === "engine";

  if (!toE164) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });

  // A draft belongs to a conversation that exists. The same rule the reply box
  // enforces, and the same reason: a first contact carries a signup link and
  // the identification the law wants, and neither of those is here.
  const existing = await salesThread({ salesRepId: rep.id, withE164: toE164 });
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

  const { lead, company, timeZone } = await threadContext({ salesRepId: rep.id, toE164 });

  // ── Suppression, before a draft exists at all ──────────────────────────
  //
  // A rep should not be able to write a follow-up to somebody who told
  // FieldQuo to stop, even one that would be refused on the way out. Offering
  // the row and refusing the send is a control that appears to work.
  const readiness = await salesSmsStatus({
    rep,
    lead: lead || { phone: toE164, timeZone: null },
    origin: getAppOrigin(request),
  });
  const suppressed = readiness.blockers.find((b) => b.code === "suppressed");
  if (suppressed) {
    return NextResponse.json({ error: suppressed.title, suppressed: true }, { status: 409 });
  }

  // ── When ────────────────────────────────────────────────────────────────
  let scheduledFor = null;
  if (body?.scheduledFor) {
    const verdict = parseScheduleRequest({ raw: body.scheduledFor, timeZone });
    if (!verdict.ok) {
      return NextResponse.json(
        { error: verdict.error, code: verdict.code, suggestion: verdict.suggestion },
        { status: 409 },
      );
    }
    scheduledFor = verdict.at;
  }

  // ── What ────────────────────────────────────────────────────────────────
  let decision = null;
  let dedupeKey = null;
  let ruleText = null;
  if (wantsEngineDraft) {
    // Re-decided here rather than taken from the request. A companyId and a
    // reason a browser can name is a browser that can draft a check-in for a
    // company the engine had suppressed.
    const fresh = await suggestionForThread({
      salesRepId: rep.id,
      company,
      timeZone,
      repName: rep.name,
    });
    if (!fresh.suggestion) {
      return NextResponse.json(
        {
          error:
            fresh.decision?.suppressed?.text ||
            "This company is not due a check-in any more. Nothing was drafted.",
        },
        { status: 409 },
      );
    }
    decision = fresh.decision;
    dedupeKey = engineDedupeKey({ companyId: company.id });
    ruleText = fresh.suggestion.text;
    if (scheduledFor === null) scheduledFor = fresh.suggestion.scheduledFor;
  }

  // ── "Not today" ─────────────────────────────────────────────────────────
  //
  // A dismissal is stored rather than held in the browser, because the engine
  // is re-evaluated on every load and a suggestion waved away in the UI would
  // be back on the next refresh — a control that appears to work. The row
  // carries the same dedupe key, so today is quiet and tomorrow is a new
  // decision.
  //
  // The AI is deliberately NOT asked for a draft nobody will read: the rule
  // wording is used, which costs nothing.
  const dismissing = body?.dismiss === true;

  const result = await createCheckIn({
    rep,
    toE164,
    lead,
    company,
    decision,
    // A rep who typed words gets their words. The engine wording is only
    // produced when they did not — and never for a dismissal.
    text: wantsEngineDraft && !typed && !dismissing ? null : typed || ruleText,
    scheduledFor,
    origin: wantsEngineDraft ? "engine" : "manual",
    dedupeKey,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  if (dismissing) {
    const put = await updateCheckIn({ salesRepId: rep.id, id: result.checkIn.id, dismiss: true });
    if (!put.ok) return NextResponse.json({ error: put.error }, { status: put.status || 409 });
    return NextResponse.json({ ok: true, checkIn: put.checkIn, dismissed: true });
  }

  return NextResponse.json({ ok: true, checkIn: result.checkIn, existed: Boolean(result.existed) });
}
