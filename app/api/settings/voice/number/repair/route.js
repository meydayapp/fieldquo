// app/api/settings/voice/number/repair/route.js
//
//   GET   what is wrong with this company's number, and whose fault it is
//   POST  fix it, where the fault is ours and the fix is knowable
//
// ── "Nothing in the app can repair one" was untested ───────────────────────
//
// That sentence sat in app/app/settings/voice/page.js and on the platform
// console, and it was written without asking the provider. Retell exposes
// get-phone-number and update-phone-number, which is everything needed to tell
// a half-finished purchase from a half-finished binding, and to finish the
// binding. So the honest set of outcomes is four, not one:
//
//   ghost         no number at the provider — release the row, they may buy
//   no_agent      number exists, no agent was ever created — build it
//   unbound       both exist, the attach never took — attach
//   status_stale  it is working; only our column is behind — correct it
//
// ── What it will NOT do ────────────────────────────────────────────────────
//
// Anything the diagnosis marks `side: "company"`. A number sitting unbound
// because the contractor switched their receptionist off looks identical at the
// provider to one that failed to bind, and "repairing" it would turn their
// phone back on and start billing them for calls they chose not to take.
// verdictFor checks that case FIRST for exactly this reason.
//
// It also will not act on `provider_unreachable`. Not reaching the provider is
// not evidence of anything, and the repair for a ghost is destructive to the
// row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { recordError, errorDetail } from "@/lib/platform/errorLog";
import { diagnoseNumber, diagnoseAndHeal } from "@/lib/voice/diagnose";
import { provisionAgent, syncNumberAttachment } from "@/lib/voice/provision";
import { checkReadiness, originIsStable } from "@/lib/voice/readiness";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  let result = await diagnoseNumber(member.companyId);

  // ── Bookkeeping heals itself; the contractor's switch never moves ────────
  //
  // A GET that writes, narrowly and in one direction only: when the provider
  // confirms the number exists and our column still says `provisioning`, the
  // column is wrong and correcting it is not an action taken on anyone's
  // behalf. `enabled` is untouched — whether the receptionist answers stays
  // the contractor's decision.
  //
  // It is here rather than only behind the Fix button because the Fix button
  // was unreachable in the case that mattered. A number both stale and
  // switched off reports `voice_off`, which offers no repair, while every other
  // card on the page gates on the stale column — so the page told the owner
  // "you switched it off, turn it on below" above three cards saying "email us,
  // this needs a person", with the switch locked behind them.
  if (result.statusStale) result = await diagnoseAndHeal(member.companyId);
  // Told once per look rather than once per page render: a stuck number is
  // money leaving on something the tenant cannot use, and until now the only
  // way FieldQuo learned about one was the contractor emailing.
  await notifyIfBroken(member.companyId, result);
  return NextResponse.json(result);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can do this." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  // ── The second repair: push our configuration to the provider again ──────
  //
  // Added because the number diagnosis could not see the failure that was
  // actually keeping the owner's calls off the books. His phone ANSWERED — the
  // number was bound, the agent spoke — and not one call was ever recorded,
  // because the `webhook_url` Retell holds is derived from whatever origin the
  // agent happened to be provisioned from. A URL left pointing at a preview
  // deployment posts every call event into the void, and every downstream
  // feature (the call log, the transcript, the lead, the billing, the
  // call-to-quote draft) is dead while looking perfectly healthy.
  //
  // Repairing it is just provisionAgent again: it rewrites webhook_url, the
  // prompt, the greeting and the tool endpoints from our database, and then
  // syncNumberAttachment honours `enabled` — so this can never switch a
  // contractor's phone on, only put back what we should have written.
  if (body?.fix === "resync") return resync(request, member);

  // Diagnosed here rather than trusted from the request. A browser posting
  // `{ verdict: "ghost" }` at a working number would release it.
  const before = await diagnoseNumber(member.companyId);
  if (!before.repairable) {
    return NextResponse.json(
      { ...before, repaired: false, reason: "not_repairable" },
      { status: 409 },
    );
  }

  const origin = getAppOrigin(request);

  try {
    if (before.verdict === "ghost") {
      // ── Why this one is allowed to skip the provider ───────────────────────
      //
      // It writes `status: "released"` without calling releaseNumber(), which
      // is the shape of a real and expensive bug: a row that says released
      // while Retell keeps billing FieldQuo, invisibly, for ever. It reads like
      // that bug and it is not one — but only because of where it sits.
      //
      // `ghost` is reachable from exactly one place. verdictFor returns it only
      // when `existsAtProvider === false`, and diagnoseNumber sets that false
      // only on a 404 from get-phone-number; every other failure is
      // `provider_unreachable`, which is not repairable and never gets here.
      // So by the time this line runs, Retell has itself said the number does
      // not exist. There is nothing to DELETE and nobody is being billed.
      //
      // Two things keep that true rather than merely true today. The verdict is
      // re-derived HERE (`before`) rather than taken from the request, so a
      // browser cannot post `{ verdict: "ghost" }` at a working number. And the
      // release path proper (lib/voice/numberRelease.js) treats a 404 on the
      // DELETE as success for the same reason — if anyone ever routes this
      // branch through it, the outcome is identical rather than merely similar.
      //
      // Released rather than deleted: the rent ledger and any activity log
      // entry point at this id, and deleting the row would orphan them.
      // `releasedAt` is what frees the company to buy, because heldNumber()
      // only counts the three live states.
      await db.voicePhoneNumber.updateMany({
        where: { companyId: member.companyId, e164: before.e164 },
        data: { status: "released", releasedAt: new Date() },
      });
    } else if (before.verdict === "no_agent") {
      // Builds the LLM, the agent and the binding — the same run the purchase
      // does, which is idempotent by design ("rebuilt from scratch every push").
      const res = await provisionAgent(member.companyId, origin);
      if (!res?.ok) {
        return NextResponse.json(
          { ...before, repaired: false, reason: res?.reason || "provision_failed" },
          { status: 502 },
        );
      }
      await markActive(member.companyId, before.e164);
    } else if (before.verdict === "unbound" || before.verdict === "status_stale") {
      // Kept for the case where GET has not run — a repair posted directly.
      // status_stale first: syncNumberAttachment only looks at numbers whose
      // status is already `active`, which is the blind spot that let a
      // provisioning row stay stuck forever. Correcting the column is what
      // makes the number visible to every other part of voice, not cosmetics.
      await markActive(member.companyId, before.e164);
      if (before.verdict === "unbound") {
        const res = await syncNumberAttachment(member.companyId);
        if (!res?.ok) {
          return NextResponse.json(
            { ...before, repaired: false, reason: res?.reason || "attach_failed" },
            { status: 502 },
          );
        }
      }
    }

    // ── Proved, not assumed ─────────────────────────────────────────────────
    //
    // Re-read from the provider. A repair that reports success and leaves the
    // phone silent is the exact control this codebase is swept for, and the
    // whole reason the old message existed was somebody trusting a 200.
    const after = await diagnoseNumber(member.companyId);
    const fixed = after.verdict === "ok" || after.verdict === "no_number";

    await recordActivity(member, {
      action: fixed ? "voice.number_repaired" : "voice.number_repair_failed",
      entityType: "settings",
      summary: fixed
        ? `Repaired ${before.e164} (was ${before.verdict})`
        : `Could not repair ${before.e164} (${before.verdict} → ${after.verdict})`,
      metadata: { was: before.verdict, now: after.verdict, e164: before.e164 },
    }).catch(() => {});

    if (!fixed) await notifyIfBroken(member.companyId, after, before.verdict);

    return NextResponse.json({ ...after, repaired: fixed, was: before.verdict });
  } catch (err) {
    await recordError({
      area: "voice",
      code: "number_repair_failed",
      companyId: member.companyId,
      message: `Repairing ${before.e164} (${before.verdict}) threw`,
      detail: errorDetail(err, { verdict: before.verdict, e164: before.e164 }),
    });
    return NextResponse.json(
      { ...before, repaired: false, reason: "threw" },
      { status: 502 },
    );
  }
}

/**
 * Rewrite this company's agent at the provider from our own database.
 *
 * ── Why a preview origin is refused outright ─────────────────────────────
 *
 * The webhook URL we would write is derived from the address this request
 * arrived on. Pressed from a `*.vercel.app` preview or from a laptop, this
 * would take a LIVE agent that is posting to production and repoint it at a
 * deployment that stops existing — turning a working phone into exactly the
 * silent one we are here to fix, and doing it under a button labelled "fix".
 *
 * So it refuses, and says which address to use instead. `originIsStable` is
 * shared with the readiness check, which greys the same case out rather than
 * calling a healthy production webhook wrong.
 */
async function resync(request, member) {
  const origin = getAppOrigin(request);
  if (!originIsStable(origin)) {
    return NextResponse.json(
      {
        error:
          "This is a preview address, not your real one. Fixing from here would point your phone at a copy of FieldQuo that gets deleted — open the app at its normal address and press it there.",
        errorKey: "app.setVoice.chain.previewRefused",
        repaired: false,
        reason: "preview_origin",
      },
      { status: 409 },
    );
  }

  const res = await provisionAgent(member.companyId, origin);

  await recordActivity(member, {
    action: res?.ok ? "voice.agent_resynced" : "voice.agent_resync_failed",
    entityType: "settings",
    summary: res?.ok
      ? "Pushed the receptionist's settings to the phone provider again"
      : `Couldn't push the receptionist's settings (${res?.reason || "unknown"})`,
    metadata: { origin },
  }).catch(() => {});

  if (!res?.ok) {
    await recordError({
      area: "voice",
      code: "agent_resync_failed",
      companyId: member.companyId,
      message: `Re-pushing the agent for ${member.companyId} failed`,
      detail: { reason: res?.reason || null, origin },
    });
    return NextResponse.json(
      { repaired: false, reason: res?.reason || "provision_failed" },
      { status: 502 },
    );
  }

  // Proved rather than assumed, same as the number repair above: the chain is
  // re-read from the provider so the page renders what Retell now says, not
  // what our push believes it did.
  const after = await checkReadiness(member.companyId, origin);
  return NextResponse.json({ repaired: true, fix: "resync", readiness: after });
}

async function markActive(companyId, e164) {
  await db.voicePhoneNumber.updateMany({
    where: { companyId, e164 },
    data: { status: "active" },
  });
}

/**
 * Tell FieldQuo, but only about faults that are FieldQuo's.
 *
 * A receptionist the contractor switched off is not an incident, and logging it
 * would bury the real ones. Same for a number we simply couldn't look up this
 * minute — that resolves itself, and a daily page of transient provider blips
 * trains everyone to ignore the log.
 */
const NOTIFY_QUIET_HOURS = 24;

async function notifyIfBroken(companyId, result, previousVerdict = null) {
  if (result.side !== "fieldquo") return;

  // ── Once a day, not once a page view ────────────────────────────────────
  //
  // The settings page diagnoses on load, and it has to: an `unbound` number
  // whose stored status still says `active` is invisible any other way. But a
  // contractor who leaves that tab open would otherwise write a
  // PlatformErrorLog row every render, and a log that fills with one company's
  // repeated tab is a log nobody reads — the same reason company-side verdicts
  // are not logged at all.
  //
  // Keyed on company AND code, so a number that DEGRADES (unbound → ghost) is
  // reported immediately rather than being swallowed by the quiet period for
  // the state it used to be in. A failed repair always reports: someone just
  // pressed a button and it did not work, which is a new fact every time.
  if (!previousVerdict) {
    const since = new Date(Date.now() - NOTIFY_QUIET_HOURS * 60 * 60 * 1000);
    const recent = await db.platformErrorLog.findFirst({
      where: { companyId, code: `number_${result.verdict}`, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return;
  }

  await recordError({
    area: "voice",
    code: `number_${result.verdict}`,
    companyId,
    message: previousVerdict
      ? `Repair of ${result.e164} left it ${result.verdict} (was ${previousVerdict})`
      : `${result.e164} is ${result.verdict} — the contractor cannot answer calls`,
    detail: {
      e164: result.e164,
      storedStatus: result.status,
      boundAgent: result.boundAgent,
      wantAgent: result.wantAgent,
      repairable: result.repairable,
    },
  });
}
