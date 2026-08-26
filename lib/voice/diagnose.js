// lib/voice/diagnose.js
//
// What is actually wrong with a stuck phone number, and whose fault it is.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// A number left on `provisioning` used to produce one sentence on the settings
// page: "set up but never finished activating... please get in touch, this one
// is already yours and already being charged for." Both halves of that were
// asserted without checking. The provider has a read API, so BOTH are knowable:
//
//   getNumber(e164)          does it exist at Retell at all
//   boundAgentId(response)   is an agent actually answering on it
//
// A number that 404s at the provider is not being charged for by anyone, and
// telling a contractor it is — while also telling them not to buy a working one
// — leaves them with no phone and a bill they don't have. That is the failure
// this module exists to stop.
//
// ── The one thing it must never do is guess ────────────────────────────────
//
// A provider we could not reach is `provider_unreachable`, NOT a ghost. The
// whole point is to stop asserting a state we have not observed, so failing to
// observe has to be its own answer rather than falling through to the worst
// case. Absence of a reply is not a reply.
//
// ── Whose fault ────────────────────────────────────────────────────────────
//
// The owner asked to be told which side is broken. `side` answers it:
//
//   "fieldquo"  provisioning stalled on our side — a half-finished purchase, an
//               agent that was never created, a binding that never took. The
//               contractor did nothing wrong and can't have. Repairable here.
//   "company"   the number is unbound because the company turned the
//               receptionist OFF, or is out of credit. Working as asked; not a
//               fault at all, and repairing it would override their decision.
//   "unknown"   we could not see enough to say. Never presented as either.

import { db } from "@/lib/db";
import {
  voiceConfigured,
  getNumber,
  boundAgentId,
  RetellError,
} from "@/lib/voice/retell";
import { canTakeCall } from "@/lib/voice/credits";
import { heldNumber } from "@/lib/voice/numbers";

/**
 * Every verdict this can return. Exported so the UI and the check script use
 * the same list rather than each spelling the strings out — a banner branching
 * on a verdict that no longer exists renders nothing at all.
 *
 * `repairable` is the only thing that may put a Fix button on screen.
 * `billing` is what licenses the "you are being charged for it" sentence, and
 * it is false wherever we have not confirmed the number exists at the provider.
 */
export const NUMBER_VERDICTS = {
  ok: { side: null, repairable: false, billing: true },
  no_number: { side: null, repairable: false, billing: false },
  not_configured: { side: "fieldquo", repairable: false, billing: false },
  provider_unreachable: { side: "unknown", repairable: false, billing: false },
  ghost: { side: "fieldquo", repairable: true, billing: false },
  no_agent: { side: "fieldquo", repairable: true, billing: true },
  unbound: { side: "fieldquo", repairable: true, billing: true },
  status_stale: { side: "fieldquo", repairable: true, billing: true },
  voice_off: { side: "company", repairable: false, billing: true },
  no_credit: { side: "company", repairable: false, billing: true },
  porting: { side: null, repairable: false, billing: true },
};

/**
 * Turn the pieces into a verdict. Pure — no I/O — so the decision table can be
 * executed against every combination rather than reasoned about.
 *
 * @param {object} p
 * @param {string|null} p.status         the stored VoicePhoneNumber.status
 * @param {boolean|null} p.existsAtProvider  null when we could not look
 * @param {string|null} p.boundAgent     agent id the provider reports, or null
 * @param {string|null} p.wantAgent      the company's own provider agent id
 * @param {boolean} p.agentEnabled       has the company switched voice on
 * @param {boolean} p.hasCredit          can they afford to take a call
 */
export function verdictFor({
  status,
  existsAtProvider,
  boundAgent,
  wantAgent,
  agentEnabled,
  hasCredit,
}) {
  // A port in flight is not stuck, it is slow. Weeks is the normal case and the
  // UI already says "moving, est. 3 Aug" from portExpectedAt.
  if (status === "porting") return "porting";

  // We could not look. Say so, and say nothing else — every branch below this
  // point claims something about the provider.
  //
  // `!== true` rather than `=== null`: undefined is also "we didn't look", and
  // a strict null check let a caller that simply omitted the field fall
  // through to a verdict that asserts the number exists. The check caught it.
  if (existsAtProvider !== true && existsAtProvider !== false)
    return "provider_unreachable";

  // The purchase half-failed: money may have been reserved on our side, but
  // there is no number at the provider and nobody is renting anything.
  if (existsAtProvider === false) return "ghost";

  // It exists. From here the question is only whether anything answers on it.
  if (!wantAgent) return "no_agent";

  // Unbound ON PURPOSE. Checked before `unbound` because the two look identical
  // at the provider and only one of them is a fault — "repairing" this would
  // switch a contractor's receptionist back on after they turned it off.
  if (!agentEnabled) return "voice_off";
  if (!hasCredit) return "no_credit";

  if (boundAgent !== wantAgent) return "unbound";

  // Answering correctly. The stored status is simply behind — a provisioning
  // run that completed at the provider and died before its own UPDATE.
  return status === "active" ? "ok" : "status_stale";
}

/**
 * Look the number up at the provider and decide what is wrong with it.
 *
 * @returns {Promise<{verdict:string, side:string|null, repairable:boolean,
 *                    billing:boolean, e164:string|null, status:string|null,
 *                    boundAgent:string|null, wantAgent:string|null}>}
 */
export async function diagnoseNumber(companyId) {
  const number = await heldNumber(companyId);
  if (!number) return shape("no_number", { e164: null, status: null });

  if (!voiceConfigured()) {
    return shape("not_configured", { e164: number.e164, status: number.status });
  }

  const [agent, credit] = await Promise.all([
    db.voiceAgent.findUnique({
      where: { companyId },
      select: { providerAgentId: true, enabled: true },
    }),
    canTakeCall(companyId).catch(() => ({ allowed: false })),
  ]);

  // `existsAtProvider` is deliberately three-state. A 404 is evidence of
  // absence; any other failure is absence of evidence, and the two must not
  // collapse into one another.
  let existsAtProvider = null;
  let boundAgent = null;
  try {
    const live = await getNumber(number.e164);
    existsAtProvider = true;
    boundAgent = boundAgentId(live);
  } catch (err) {
    if (err instanceof RetellError && err.status === 404) existsAtProvider = false;
  }

  const verdict = verdictFor({
    status: number.status,
    existsAtProvider,
    boundAgent,
    wantAgent: agent?.providerAgentId || null,
    agentEnabled: Boolean(agent?.enabled),
    hasCredit: Boolean(credit?.allowed),
  });

  return shape(verdict, {
    e164: number.e164,
    status: number.status,
    boundAgent,
    wantAgent: agent?.providerAgentId || null,
  });
}

function shape(verdict, extra) {
  const meta = NUMBER_VERDICTS[verdict] || NUMBER_VERDICTS.provider_unreachable;
  return { verdict, ...meta, boundAgent: null, wantAgent: null, ...extra };
}
