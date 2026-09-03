// app/api/sales/calls/route.js
//
// A rep places a call, says what happened, and says what they are doing.
//
// ══ The calling gate is asked HERE, not trusted from the screen ═══════════
//
// Until browser calling existed there was exactly one way to reach a prospect's
// phone — `dialHref()`, which cannot return a target from a refusal or an
// unknown. That was structural rather than textual, which is why it held.
//
// A POST that bridges a call is a SECOND door, and a gate on one door is not a
// gate. So this route recomputes salesCallReadiness from rows it reads in this
// request, with attemptsLast24h now actually counted, and refuses anything
// that is not `allowed`. The screen's copy of the decision is a courtesy to
// the rep; this one is the control. Same discipline lib/migrations/state.js's
// canWrite() establishes and lib/sales/outreachSender.js applies to sending:
// the last statement before something leaves the building is read fresh.
//
// ══ Why the attempt row is written BEFORE the call is bridged ═════════════
//
// Oklahoma and Florida cap calls — not conversations — at three per business
// per 24 hours. A row written after a successful bridge would miss every call
// that failed to connect, and those were still calls. So the row exists the
// moment the gate clears, and the carrier's own figures are attached later by
// /api/rep-dial/status.
//
// ══ The tables may not exist yet ══════════════════════════════════════════
//
// lib/sales/calls/store.js probes the generated client. While
// SalesCallAttempt and SalesRepActivity are absent, GET reports that plainly
// and every POST refuses with the model names in the message — the screen
// renders no control at all rather than a picker that throws.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { queueWhere } from "@/lib/sales/prospectView";
import { salesCallReadiness, CALL_ALLOWED } from "@/lib/sales/callingRules";
import { twilioConfigured } from "@/lib/sms/twilioClient";
import { getAppOrigin } from "@/lib/appUrl";
import {
  CallStoreUnavailable,
  attemptsLast24h,
  callStoreState,
  currentActivity,
  heartbeat,
  ownNumbers,
  recordDial,
  salesCallerNumbers,
  saveDisposition,
  setRepState,
} from "@/lib/sales/calls/store";
import { dispositionOptions } from "@/lib/sales/calls/dispositions";
import {
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  REP_STATES,
  STATE_AVAILABLE,
  STATE_ON_CALL,
  STATE_ORDER,
  livePresence,
} from "@/lib/sales/calls/agentState";
import { dialModeState } from "@/lib/sales/calls/dialMode";
import { TWIML_APP_ENV, browserDialReadiness, callPlan } from "@/lib/sales/calls/browserDial";
import { repCallStats } from "@/lib/sales/calls/reporting";

const ACTIONS = ["dial", "disposition", "state", "heartbeat"];
const MAX_NOTE = 2000;

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The prospect or lead a rep is about to ring, with everything the calling
 * gate needs — read in THIS request and scoped to this rep.
 *
 * A prospect held by somebody else resolves to nothing rather than to a 403
 * that confirms it exists, matching every other sales route.
 *
 * ── A bare lead has no jurisdiction, and that is a refusal, not a gap ────
 *
 * SalesLead carries a phone and a time zone but no country or province, so a
 * lead with no Prospect behind it produces `location_unknown` and the gate
 * returns `unknown`. That is correct and deliberate: calling hours are set by
 * the place the phone rings, there is no federal rule underneath to fall back
 * on, and a rep who typed a business name into a form has told us nothing
 * about which statute applies.
 */
async function targetFor(repId, { prospectId, leadId }) {
  if (prospectId) {
    const prospect = await db.prospect.findFirst({
      where: { id: prospectId, ...queueWhere(repId) },
      select: {
        id: true,
        businessName: true,
        phoneE164: true,
        country: true,
        province: true,
        doNotContactAt: true,
        leads: {
          where: { timeZone: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { timeZone: true },
        },
      },
    });
    if (!prospect) return null;
    return {
      kind: "prospect",
      prospectId: prospect.id,
      leadId: null,
      name: prospect.businessName,
      phoneE164: prospect.phoneE164,
      country: prospect.country,
      province: prospect.province,
      timeZone: prospect.leads[0]?.timeZone || null,
      doNotContactAt: prospect.doNotContactAt,
    };
  }

  if (leadId) {
    const lead = await db.salesLead.findFirst({
      where: { id: leadId, salesRepId: repId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        timeZone: true,
        prospectId: true,
        prospect: {
          select: { id: true, country: true, province: true, doNotContactAt: true, phoneE164: true },
        },
      },
    });
    if (!lead) return null;
    return {
      kind: "lead",
      prospectId: lead.prospectId || null,
      leadId: lead.id,
      name: lead.businessName,
      phoneE164: lead.phone || lead.prospect?.phoneE164 || null,
      country: lead.prospect?.country || null,
      province: lead.prospect?.province || null,
      timeZone: lead.timeZone || null,
      doNotContactAt: lead.prospect?.doNotContactAt || null,
    };
  }

  return null;
}

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const store = callStoreState();
  const mode = dialModeState();

  const [numbers, open] = await Promise.all([
    salesCallerNumbers().catch(() => []),
    currentActivity(rep.id).catch(() => null),
  ]);

  // Today's own numbers. A rep sees their own and nobody else's — the
  // leaderboard, when it exists, is a separate decision with its own
  // visibility rules (lib/sales/repStats.js says so in the same words).
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let attempts = null;
  let activity = null;
  if (store.ready) {
    [attempts, activity] = await Promise.all([
      db.salesCallAttempt.findMany({
        where: { salesRepId: rep.id, dialledAt: { gte: dayStart } },
        orderBy: { dialledAt: "desc" },
      }),
      db.salesRepActivity.findMany({
        where: { salesRepId: rep.id, startedAt: { gte: dayStart } },
        orderBy: { startedAt: "asc" },
      }),
    ]);
  }

  return NextResponse.json({
    rep: { id: rep.id, name: rep.name },
    // Computed from the client, never asserted — the exact lesson
    // lib/sales/playbook/store.js's header records.
    store,
    dialMode: mode,
    dial: browserDialReadiness({
      twilioConfigured: twilioConfigured(),
      twimlAppSid: process.env.TWILIO_SALES_TWIML_APP_SID || null,
      callerNumbers: numbers,
      // The browser answers this, not the server. Null here means "not asked
      // yet", which the screen replaces with the real answer before it decides
      // whether to render a call button.
      micPermission: null,
      origin: getAppOrigin(request),
    }),
    twimlAppVar: TWIML_APP_ENV,
    dispositions: dispositionOptions(),
    states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
    pauseReasons: PAUSE_REASON_ORDER.map((code) => PAUSE_REASONS[code]),
    presence: livePresence(open, now),
    // The call a rep has made and not written up.
    //
    // OMniLeads keeps its agents in after-call work until they disposition,
    // and that is the right idea for the wrong reason there — it exists to
    // stop a dialler handing them another call. FieldQuo has no dialler, so
    // this is not a lock; it is the screen putting the unfinished thing in
    // front of the rep instead of letting it slide off the bottom of a list.
    // Unlogged calls are what make every number below them a lie, and the
    // rep is the only person who can fix one.
    pendingAttempt: attempts
      ? (() => {
          const row = attempts.find((a) => !a.disposition);
          return row
            ? { id: row.id, toE164: row.toE164, dialledAt: row.dialledAt, prospectId: row.prospectId }
            : null;
        })()
      : null,
    today: store.ready ? repCallStats({ attempts, activity, from: dayStart, to: now, now }) : null,
    serverNow: now.toISOString(),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) {
    return bad(`Unknown action. This route does ${ACTIONS.join(", ")}.`);
  }

  const store = callStoreState();
  if (!store.ready) {
    // Loud, with the model names, and 503 rather than 400: nothing the caller
    // sent is wrong. The database has not caught up with the code.
    return NextResponse.json(
      {
        error: new CallStoreUnavailable(store.missing).message,
        missing: store.missing,
        pendingSchemaFile: store.pendingSchemaFile,
      },
      { status: 503 },
    );
  }

  const now = new Date();

  if (action === "heartbeat") {
    await heartbeat(rep.id, { now });
    return NextResponse.json({ ok: true, serverNow: now.toISOString() });
  }

  if (action === "state") {
    const result = await setRepState({
      salesRepId: rep.id,
      to: typeof body.state === "string" ? body.state : null,
      pauseReason: typeof body.pauseReason === "string" ? body.pauseReason : null,
      now,
    });
    if (!result.ok) return bad(result.error, 409);
    return NextResponse.json({
      ok: true,
      presence: livePresence(result.activity, now),
      serverNow: now.toISOString(),
    });
  }

  if (action === "dial") {
    const target = await targetFor(rep.id, {
      prospectId: typeof body.prospectId === "string" ? body.prospectId.trim() : "",
      leadId: typeof body.leadId === "string" ? body.leadId.trim() : "",
    });
    if (!target) {
      return NextResponse.json(
        { error: "That is not yours to call. Claims are one rep at a time." },
        { status: 404 },
      );
    }
    if (!target.phoneE164) {
      return bad("This record carries no phone number, so there is nothing to dial.");
    }
    if (target.doNotContactAt) {
      return bad("This business asked not to be contacted. That does not expire.", 409);
    }

    // Counted for real now. Passing null here would put the cap back into
    // `unenforced` while the table sits there full of rows.
    const attempts24h = await attemptsLast24h(target.phoneE164, { now });

    const readiness = salesCallReadiness({
      prospect: { country: target.country, province: target.province },
      timeZone: target.timeZone,
      attemptsLast24h: attempts24h,
      now,
    });

    if (readiness.decision !== CALL_ALLOWED) {
      // The whole decision goes back, not a sentence about it, so the screen
      // prints the same blockers it would have printed itself.
      return NextResponse.json(
        { error: "This call is not allowed right now.", compliance: readiness },
        { status: 409 },
      );
    }

    const channel = body.channel === "browser" ? "browser" : "handset";

    let plan = null;
    if (channel === "browser") {
      const [callerNumbers, ours] = await Promise.all([salesCallerNumbers(), ownNumbers()]);
      plan = callPlan({
        toE164: target.phoneE164,
        readiness,
        callerNumbers,
        ownNumbers: ours,
      });
      if (!plan.ok) return bad(plan.reason, 409);
    }

    const recorded = await recordDial({
      salesRepId: rep.id,
      prospectId: target.prospectId,
      leadId: target.leadId,
      toE164: target.phoneE164,
      fromE164: plan?.callerId || null,
      dialChannel: channel,
      readiness,
      now,
    });
    if (!recorded.ok) return bad(recorded.error, 409);

    // The rep is on a call from the moment they press the button. Failing to
    // move the state is not a reason to refuse the call — the call is the
    // point and the board is the commentary — so this is soft.
    await setRepState({
      salesRepId: rep.id,
      to: STATE_ON_CALL,
      callAttemptId: recorded.attempt.id,
      now,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      attemptId: recorded.attempt.id,
      channel,
      // The number the prospect will see. Sent so the rep can read it out —
      // Canada's Telemarketing Rules require identifying with a callback
      // number, and a rep who cannot see the one being presented cannot say it.
      callerId: plan?.callerId || null,
      to: target.phoneE164,
      compliance: readiness,
      attemptsLast24h: attempts24h,
      serverNow: now.toISOString(),
    });
  }

  // disposition
  const attemptId = typeof body.attemptId === "string" ? body.attemptId.trim() : "";
  if (!attemptId) return bad("Which call?");

  const result = await saveDisposition({
    salesRepId: rep.id,
    attemptId,
    code: typeof body.disposition === "string" ? body.disposition.trim() : null,
    note: typeof body.note === "string" ? body.note.slice(0, MAX_NOTE) : "",
    callbackAt: body.callbackAt || null,
    now,
  });
  if (!result.ok) return bad(result.error, 409);

  // Logging the outcome ends the write-up. A rep who was still marked on a
  // call after saying what happened would show on the board as talking to
  // somebody who hung up ten minutes ago.
  await setRepState({ salesRepId: rep.id, to: STATE_AVAILABLE, now }).catch(() => {});

  return NextResponse.json({
    ok: true,
    attempt: {
      id: result.attempt.id,
      disposition: result.attempt.disposition,
      callbackAt: result.attempt.callbackAt,
    },
    serverNow: now.toISOString(),
  });
}
