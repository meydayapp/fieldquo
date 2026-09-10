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
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { firstSuppression } from "@/lib/sales/suppression";
import { loadContactNumbers, pickContactNumber } from "@/lib/sales/contact/resolve";
import { CHANNEL_VOICE } from "@/lib/sales/contact/numbers";
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
 * ── A lead with no location is a gap the rep can close ──────────────────
 *
 * This used to say a bare lead could never be located, because SalesLead
 * carried a phone and a time zone and nothing else — so every hand-typed lead
 * produced `location_unknown` forever and the gate answered `unknown`. The
 * refusal was right; the dead end was not. A rep who has spoken to the
 * business knows which state it is in, and now says so: SalesLead.country and
 * .province are written from the lead screen and read here, ahead of the
 * linked prospect's pair, because the rep is closer to the fact than a
 * directory row that may name a head office two states away.
 *
 * A lead with neither still produces `location_unknown`, and still refuses.
 * Nothing here infers a state from an area code.
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
        country: true,
        province: true,
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
      // Normalised, not the raw string. A rep types "613-555-0142"; the gate,
      // the suppression list and Twilio all key on E.164, and passing the raw
      // form through made every hand-typed lead look like a number with no
      // suppression history.
      phoneE164: normalisePhone(lead.phone) || lead.prospect?.phoneE164 || null,
      // The LEAD's own pair first. It is typed by the rep who spoke to them;
      // discovery's is inferred from a directory row that can be a head office
      // in another state, and the rep is closer to the fact. Same precedence
      // lib/sales/leadDial.js applies on the screen, so the two agree.
      country: lead.country || lead.prospect?.country || null,
      province: lead.province || lead.prospect?.province || null,
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
    // `portalSeenAt: now` is not an assumption — this request IS the rep in
    // the portal, and it is the same fact lib/sales/gate.js stamps on the read
    // path. Leaving it null would hand the rep's own screen a presence object
    // claiming they have never signed in, while they are looking at it.
    presence: livePresence(open, now, { portalSeenAt: now }),
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
      presence: livePresence(result.activity, now, { portalSeenAt: now }),
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
    if (target.doNotContactAt) {
      return bad("This business asked not to be contacted. That does not expire.", 409);
    }

    // ── WHICH number, and why the browser does not get to say ─────────────
    //
    // The listed number is the shop. Somebody answers and says "call him on
    // his cell" — so a rep records that number and then rings it, and this is
    // the request where the second half happens.
    //
    // The wire carries `contactNumberId`, never a phone number. A request that
    // could name its own destination is toll fraud waiting for one stolen
    // session: a premium-rate line, dialled on FieldQuo's Twilio account,
    // billed by the minute, and indistinguishable from a legitimate dial
    // because a well-formed E.164 is exactly what an attacker would send. No
    // validation fixes that; only refusing to accept one does.
    //
    // The rows are re-read in THIS request, scoped to the prospect and lead
    // `targetFor()` already resolved through the rep's own claim — so an id
    // belonging to somebody else's prospect is not in the set searched and is
    // refused by the same path as a typo. See lib/sales/contact/resolve.js for
    // why that is one step rather than a read-then-compare.
    //
    // Our own numbers are excluded here for BOTH channels now, not just the
    // browser one. callPlan() has always refused them on the browser path;
    // the handset path could still be handed one, and ringing our own
    // infrastructure bridges a loop that bills both legs.
    const [ours, contactRows] = await Promise.all([
      ownNumbers().catch(() => []),
      loadContactNumbers({
        prospectId: target.prospectId,
        salesLeadId: target.leadId,
      }),
    ]);

    // ── The suppression list, which this route did not read ───────────────
    //
    // A contractor who replies STOP to one of our texts is written to the
    // suppression list across ALL_CHANNELS — lib/sales/salesSms.js does it,
    // and it means voice as well as sms. Outbound email checks that list
    // (outreachSender), outbound SMS checks it (salesSms), and an INBOUND call
    // checks it (rep-dial/inbound). This route did not. It read only the
    // prospect's own do-not-contact flag, so somebody who said stop by text
    // stayed dialable and the rep had no way to know.
    //
    // That was the one gap on this path that is a legal problem rather than an
    // inconvenience: a call placed after consent was revoked is the call that
    // gets FieldQuo a complaint, and the rep making it did nothing wrong.
    //
    // Read in the request that places the call, not trusted from the screen
    // that drew the button — the same discipline the email path states above
    // itself, and the reason a stale screen cannot authorise a dial.
    //
    // ── EVERY number of theirs, not only the one about to ring ────────────
    //
    // A STOP is written to the list keyed on the number it arrived from, and
    // free dial makes that a hole if the check is per-number: a contractor
    // texts STOP from the shop line, the rep rings the cell somebody gave
    // them, and a check on the cell alone finds nothing and lets the call
    // through. The refusal is a fact about the BUSINESS — it is the same
    // reasoning contactChoices()'s `blocked` and `doNotContactAt` above use —
    // so the question is asked about every number on this record, and one hit
    // anywhere refuses the whole dial.
    //
    // Asked BEFORE the number is chosen, so the choice cannot change the
    // answer, and so a rep is never told "pick a different one".
    const everyNumber = [
      ...new Set(
        [target.phoneE164, ...contactRows.map((r) => r.e164)].map(normalisePhone).filter(Boolean),
      ),
    ];
    //
    // firstSuppression() is the shared loop, in lib/sales/suppression.js beside
    // checkSuppression — it asks about each number in turn, fails CLOSED on a
    // lookup that throws, and names which number carried the refusal. Shared
    // rather than written out here and again in the texting route, because the
    // copy is the one that rots.
    const suppression = await firstSuppression(db, { channel: "phone", phones: everyNumber });
    if (suppression?.suppressed) {
      return NextResponse.json(
        {
          error: suppression.reason || "They asked us to stop contacting them.",
          suppressed: true,
          optedOut: true,
          // Said in the refusal so a rep is never left wondering whether to
          // try again, or who to ask. Lifting one is superadmin-only and needs
          // a written reason — app/api/platform/suppressions enforces both.
          lift: "Only a superadmin can lift a do-not-contact, and it needs a written reason.",
        },
        { status: 409 },
      );
    }

    const chosen = pickContactNumber({
      target,
      rows: contactRows,
      contactNumberId:
        typeof body.contactNumberId === "string" ? body.contactNumberId.trim() : "",
      channel: CHANNEL_VOICE,
      ourNumbers: ours,
    });
    if (!chosen.ok) {
      return NextResponse.json(
        { error: chosen.error, reason: chosen.code, choices: chosen.choices, refused: chosen.refused },
        // A refusal about WHICH number is a conflict with the world's state,
        // not a malformed request — except a number that is not on this record
        // at all, which is the caller naming something that does not exist.
        { status: chosen.code === "not_on_this_record" ? 404 : 409 },
      );
    }

    // Everything below this line reads `dialTo`, and nothing below it reads
    // `target.phoneE164`. That is the point: the 24-hour cap and the caller-id
    // plan have to be asked about the number that will actually ring, not
    // about the one printed in the directory. A guard that runs against a
    // number nobody dials is not a guard.
    const dialTo = chosen.e164;

    // Counted for real now. Passing null here would put the cap back into
    // `unenforced` while the table sits there full of rows.
    const attempts24h = await attemptsLast24h(dialTo, { now });

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
      const callerNumbers = await salesCallerNumbers();
      plan = callPlan({
        toE164: dialTo,
        readiness,
        callerNumbers,
        // `ours` was read at the top of this branch and is the same list
        // pickContactNumber() already refused against. Read once and used
        // twice on purpose: two reads a few lines apart could disagree, and
        // the disagreement would be a number one gate allowed and the other
        // did not.
        ownNumbers: ours,
      });
      if (!plan.ok) return bad(plan.reason, 409);
    }

    const recorded = await recordDial({
      salesRepId: rep.id,
      prospectId: target.prospectId,
      leadId: target.leadId,
      // The bridge reads the destination off THIS row rather than from the
      // browser (see app/api/rep-dial/bridge), so the chosen number has to
      // land here or the free dial would ring the listing anyway.
      toE164: dialTo,
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
      to: dialTo,
      // Which stored number this was, and what the rep called it. Sent back so
      // the screen can say "ringing the owner's cell" rather than printing ten
      // digits the rep has to recognise.
      contactNumberId: chosen.numberId,
      contactLabel: chosen.choice?.label || null,
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
