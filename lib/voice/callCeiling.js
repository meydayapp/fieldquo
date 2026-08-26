// lib/voice/callCeiling.js
//
// How long a call is allowed to run, given what the company can actually pay.
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// Credit was checked when a call STARTED and charged when it ENDED, and nothing
// looked at the balance in between. A company with two minutes of credit could
// therefore talk for an hour: canTakeCall said yes (they can afford one
// minute), the call ran to Retell's default one-hour ceiling, and chargeCall
// then wrote a debit that took them $20 negative. FieldQuo pays the provider
// for every one of those minutes; the contractor pays for two.
//
// ══ Enforced at the provider, like the detach ══════════════════════════════
//
// Retell agents carry `max_call_duration_ms` — "will force end the call if
// reached" — so the ceiling is real rather than a number on one of our screens.
// Same discipline as syncNumberAttachment: the phone has to stop, not the UI.
//
//   minimum   60,000 ms (1 minute)   — Retell's floor, not ours
//   default   3,600,000 ms (1 hour)  — what every agent had before this file
//   maximum   7,200,000 ms (2 hours)
//
// The floor lines up with the gate by luck rather than by design, and it is
// worth writing down why it works: canTakeCall already refuses a call unless
// the balance covers a whole minute, and costForSeconds bills a one-minute
// minimum. So any company allowed to take a call can afford at least the
// shortest call Retell will let us configure. There is no gap to absorb.
//
// ══ What this does NOT fix, and where the shortfall lands ══════════════════
//
// CONCURRENCY. The ceiling is per call, and a company with three minutes of
// credit that takes three simultaneous calls can burn nine minutes against it.
// Each call individually respects the ceiling; together they overshoot. The
// same is true of the ceiling being pushed between calls rather than at the
// instant one starts — a balance that moved thirty seconds ago is enforced on
// the NEXT call, not the one in progress.
//
// That residue is deliberately not absorbed in silence. Every debit that takes
// a balance below zero is recorded as an overdraft on the platform error log
// (see lib/voice/reconcileCalls.js) and totalled on /platform, so the cost of
// this gap is a number somebody can look at rather than a slow leak in a margin
// report. Closing it properly means a per-call reservation at answer time,
// which needs a Retell inbound-webhook decision hook we do not currently use.
import { db } from "@/lib/db";
import { balanceFor, minutesFor } from "./credits";
import { updateAgent, voiceConfigured } from "./retell";

/** Retell's own bounds. Sending outside them is a 400, not a clamp. */
export const MIN_CALL_MS = 60_000;
export const MAX_CALL_MS = 7_200_000;

/**
 * The ceiling a balance buys, in milliseconds. Pure, and total on any input.
 *
 * Never returns something outside Retell's range, never returns a non-finite
 * value, and never returns more time than the money covers. A balance too small
 * for one minute still yields the one-minute floor: the ceiling is not the gate
 * — syncNumberAttachment refuses the call outright — and returning something
 * Retell would reject would fail the agent push and leave the OLD ceiling live,
 * which is the one-hour default we are trying to get rid of.
 */
export function ceilingMsFor(balanceCents, numberType = "local") {
  const minutes = minutesFor(balanceCents, numberType);
  if (!Number.isFinite(minutes) || minutes < 1) return MIN_CALL_MS;
  const ms = minutes * 60_000;
  if (!Number.isFinite(ms)) return MAX_CALL_MS;
  return Math.min(MAX_CALL_MS, Math.max(MIN_CALL_MS, Math.floor(ms)));
}

/**
 * What this company's ceiling should be right now, from their own rows.
 *
 * Priced against the number they actually hold, so a toll-free line — which
 * costs 40¢ a minute, not 35¢ — buys proportionally fewer minutes of ceiling.
 * Reading the local rate for a toll-free customer is the same leak NUMBER_TYPES
 * exists to close.
 */
export async function ceilingForCompany(companyId) {
  const [cents, number] = await Promise.all([
    balanceFor(companyId),
    db.voicePhoneNumber.findFirst({
      where: { companyId, status: { in: ["provisioning", "active"] } },
      orderBy: { createdAt: "asc" },
      select: { numberType: true },
    }),
  ]);
  return ceilingMsFor(cents, number?.numberType || "local");
}

/**
 * Push the ceiling to both of the company's agents.
 *
 * Called wherever the balance can have moved — after a call is billed, after a
 * top-up, after the reconciler rescues a call — so the number Retell enforces
 * follows the money rather than whatever was true at provisioning time. Safe to
 * call often: writing the same value is a no-op at the provider.
 *
 * OUTBOUND TOO. A detached inbound number says nothing about whether we will
 * still dial out on the company's behalf, and an outbound minute costs the
 * shared pool exactly as much as an inbound one.
 *
 * Never throws. A ceiling that could not be pushed leaves the previous one in
 * force, which is a billing exposure worth logging but never a reason to fail
 * the caller — the caller is usually a webhook whose 500 makes Retell retry a
 * charge we have already written.
 *
 * @returns { ok, ms?, reason? }
 */
export async function pushCallCeiling(companyId, { ms } = {}) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };
  if (!companyId) return { ok: false, reason: "no_company" };

  const agent = await db.voiceAgent.findUnique({
    where: { companyId },
    select: { providerAgentId: true, outboundProviderAgentId: true },
  });
  if (!agent?.providerAgentId && !agent?.outboundProviderAgentId) {
    return { ok: false, reason: "no_agent" };
  }

  const target = Number.isFinite(ms) ? ms : await ceilingForCompany(companyId);

  const ids = [agent.providerAgentId, agent.outboundProviderAgentId].filter(Boolean);
  const failures = [];
  for (const id of ids) {
    try {
      await updateAgent(id, { max_call_duration_ms: target });
    } catch (err) {
      failures.push(`${id}: ${err.message}`);
    }
  }

  if (failures.length) {
    console.error("[voice/callCeiling] couldn't push the ceiling:", failures.join("; "));
    return { ok: false, ms: target, reason: failures.join("; ") };
  }
  return { ok: true, ms: target };
}
