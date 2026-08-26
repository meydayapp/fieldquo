// app/api/settings/voice/number/release/route.js
//
// Give a bought number back.
//
//   POST { confirm: "+1…", acknowledgeSoleNumber?: true }
//
// ══ Why this is a route of its own ═════════════════════════════════════════
//
// DELETE on ../route.js cancels a PORT REQUEST, which is a row in our database
// and nothing else — no number was bought, nothing exists at Retell, no rental
// was reserved. Withdrawing it is a status change and it is safe.
//
// This is the opposite operation and it deserved its own door. It DELETES the
// number at the provider: it goes back to the carrier's pool, anybody may buy
// it, and it cannot be recovered. Anything printed on a van stops working the
// moment it completes.
//
// Until now there was no way for a company to do it at all. The settings page
// said "get in touch" and the only code path that released anything was the
// rent cron past its grace period — so a contractor who bought a number they
// did not want was billed for it by Retell, through FieldQuo, for ever.
//
// ══ The two confirmations ══════════════════════════════════════════════════
//
// `confirm` must be the number's own E.164. Not a boolean: the caller has to
// say WHICH number, so a request built against a stale screen refuses instead
// of destroying the wrong line. `acknowledgeSoleNumber` is the second gate and
// is required only when this is the company's last working line — losing your
// business number by misclick is not recoverable, and neither is this call.
//
// Both are decided by planRelease() in lib/voice/numberRelease.js, which is
// pure and executed by scripts/check-voice-number-release.mjs.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { recordError, errorDetail } from "@/lib/platform/errorLog";
import { voiceConfigured } from "@/lib/voice/retell";
import { formatNumber } from "@/lib/voice/numbers";
import { HELD_STATUSES, planRelease, releaseHeldNumber } from "@/lib/voice/numberRelease";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    // 403, not 401: they are signed in and this is simply not theirs to do.
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = String(body?.confirm || "").trim();

  // ── The row is found BY the number they named ───────────────────────────
  //
  // Not heldNumber(), which is a findFirst and returns one row. A company can
  // hold more than one — one production company holds three, two of which were
  // bought 31 seconds apart — and a release that acted on "the first row" would
  // delete a working line while the contractor was looking at a broken one.
  // Scoped to their own companyId, so naming somebody else's number finds
  // nothing rather than releasing it.
  const target = confirm
    ? await db.voicePhoneNumber.findFirst({
        where: { companyId: member.companyId, e164: confirm, status: { in: HELD_STATUSES } },
      })
    : null;

  const siblings = await db.voicePhoneNumber.findMany({
    where: { companyId: member.companyId, status: { in: HELD_STATUSES } },
    select: { id: true, status: true, e164: true },
  });

  const plan = planRelease({
    target,
    siblings,
    confirm,
    acknowledgeSoleNumber: body?.acknowledgeSoleNumber === true,
  });

  if (!plan.allowed) {
    // Each refusal names what is actually wrong and carries an i18n key: a
    // route has no t(), and these are the sentences that stop somebody
    // destroying a phone line.
    const refusals = {
      no_number: {
        status: 404,
        errorKey: "app.setVoice.release.noNumber",
        error: "We couldn't find that number on your account.",
      },
      not_held: {
        status: 409,
        errorKey: "app.setVoice.release.notHeld",
        error: "That number has already been given up.",
      },
      confirm_mismatch: {
        status: 400,
        errorKey: "app.setVoice.release.confirmMismatch",
        error: "Type the number exactly as it's shown to confirm you mean this one.",
      },
      sole_number: {
        status: 409,
        errorKey: "app.setVoice.release.soleNumber",
        error:
          "This is the only working number on your account. Releasing it takes your receptionist line away for good — confirm again if that's really what you want.",
      },
    };
    const refusal = refusals[plan.reason] || refusals.confirm_mismatch;
    const { status, ...payload } = refusal;
    return NextResponse.json({ ...payload, reason: plan.reason }, { status });
  }

  // ── A port request never reached the provider ────────────────────────────
  //
  // Retell's API has no porting endpoint at all — importNumber() is a SIP
  // import of a number the company keeps at their own carrier, and it is wired
  // to nothing. So a `porting` row is a piece of paperwork, no number was ever
  // created for it, and there is nothing to DELETE. Cancelling one is the
  // DELETE on ../route.js and it is correctly database-only.
  //
  // `providerId` is checked rather than assumed: the day anyone wires
  // importNumber up, a porting row WILL have a provider object behind it, and
  // this branch would quietly start abandoning real numbers.
  if (target.status === "porting" && !target.providerId) {
    return NextResponse.json(
      {
        errorKey: "app.setVoice.release.portInstead",
        error: "That number is still a port request — cancel the request instead.",
        reason: "port_request",
      },
      { status: 409 },
    );
  }

  if (!voiceConfigured()) {
    // Refused rather than marked released locally. A row that says released
    // while the provider still bills us is the one outcome worse than not
    // being able to release at all — it is expensive AND invisible.
    return NextResponse.json(
      {
        errorKey: "app.setVoice.release.notConfigured",
        error: "The phone provider isn't set up on this deployment, so nothing can be released.",
        reason: "not_configured",
      },
      { status: 503 },
    );
  }

  let result;
  try {
    result = await releaseHeldNumber(target);
  } catch (err) {
    await recordError({
      area: "voice",
      code: "number_release_threw",
      companyId: member.companyId,
      message: `Releasing ${target.e164} threw`,
      detail: errorDetail(err, { e164: target.e164, status: target.status }),
    }).catch(() => {});
    result = { ok: false, released: false, reason: "threw", message: err?.message || null };
  }

  if (!result.ok) {
    // The row is UNTOUCHED. Said plainly, because the contractor pressed a
    // destructive button and the honest answer is "nothing happened" — and
    // because the alternative reading, "it half-worked", would stop them
    // trying again.
    await recordError({
      area: "voice",
      code: `number_release_${result.reason}`,
      companyId: member.companyId,
      message: `Couldn't release ${target.e164}: ${result.reason}`,
      detail: {
        e164: target.e164,
        reason: result.reason,
        providerMessage: result.message || null,
        // `unconfirmed` and `still_present` both mean Retell may still be
        // billing FieldQuo for this number. /platform/voice-numbers is where
        // that shows up.
        stillBilling: result.reason !== "provider_refused",
      },
    }).catch(() => {});

    const copy = {
      provider_refused: {
        errorKey: "app.setVoice.release.providerRefused",
        error:
          "The phone provider wouldn't release that number, so nothing has changed — your number still works. Try again in a few minutes.",
      },
      still_present: {
        errorKey: "app.setVoice.release.stillThere",
        error:
          "The provider accepted the request but still reports the number as yours, so we haven't marked it released. Nothing has changed — we're looking into it.",
      },
      unconfirmed: {
        errorKey: "app.setVoice.release.unconfirmed",
        error:
          "We asked the provider to release the number but couldn't confirm it went through, so nothing has been changed on your account. Check back shortly.",
      },
      threw: {
        errorKey: "app.setVoice.release.failed",
        error: "We couldn't release that number just now. Nothing has changed.",
      },
    };
    const said = copy[result.reason] || copy.threw;

    await recordActivity(member, {
      action: "voice.number_release_failed",
      entityType: "settings",
      summary: `Couldn't release ${target.e164} (${result.reason})`,
      metadata: { e164: target.e164, reason: result.reason },
    }).catch(() => {});

    return NextResponse.json({ ...said, released: false, reason: result.reason }, { status: 502 });
  }

  await recordActivity(member, {
    action: "voice.number_released",
    entityType: "settings",
    summary: `Released ${formatNumber(target.e164)}`,
    metadata: {
      e164: target.e164,
      status: target.status,
      source: target.source,
      // True when the provider 404'd the DELETE: the number was never really
      // there, so this was a ghost row being tidied rather than a line given up.
      alreadyGone: Boolean(result.alreadyGone),
      soleNumber: Boolean(plan.soleNumber),
    },
  }).catch(() => {});

  return NextResponse.json({
    released: true,
    e164: target.e164,
    alreadyGone: Boolean(result.alreadyGone),
    // No rent is taken on a released row — rentDecision skips anything that is
    // not `active`, and the rent cron only selects `active`. Stated back so the
    // screen can say it rather than implying it.
    rentStopped: true,
  });
}
