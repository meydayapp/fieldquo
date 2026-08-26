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
import { diagnoseNumber } from "@/lib/voice/diagnose";
import { provisionAgent, syncNumberAttachment } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const result = await diagnoseNumber(member.companyId);
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
      // The row is the only thing that exists. Released rather than deleted:
      // the rent ledger and any activity log entry point at this id, and
      // deleting the row would orphan them. `releasedAt` is what frees the
      // company to buy, because heldNumber() only counts the three live states.
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
async function notifyIfBroken(companyId, result, previousVerdict = null) {
  if (result.side !== "fieldquo") return;
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
