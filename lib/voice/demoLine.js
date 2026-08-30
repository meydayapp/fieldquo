// lib/voice/demoLine.js
//
// A sales demo's phone number: a real receptionist, on a line that cannot ring.
//
// ══ Why a demo needs this at all ═══════════════════════════════════════════
//
// A demo account cannot buy a real number — app/api/settings/voice/number/
// route.js has always refused that, correctly, because a purchased number
// outlives the demo, keeps billing FieldQuo, and is a real line a stranger can
// dial while the account is re-dressed as a different trade next week. But
// that left the receptionist undemonstrable end to end: a prospect could not
// see the whole setup happen and could not ring it.
//
// This is the other half. The screens, the picker, the greeting, the voice,
// the tuning — everything a real company's setup does — run for a demo too,
// unchanged. Only the one moment that would create a real, billable, dialable
// object at Retell is replaced with a fictional one. See lib/voice/retell.js
// for exactly where and how: the whole substitution is one E.164 shape that
// `buyNumber`, `attachAgent`, `getNumber` and `releaseNumber` all recognise on
// their own, so provision.js and syncNumberAttachment need no changes at all
// and cannot drift from the paid path.
//
// ══ What this module owns, and what it deliberately reuses ════════════════
//
// The number: bought here, through buyNumber(..., demo: true), which returns
// an E.164 in NANP's reserved fictional block (NPA-555-0100–0199) rather than
// touching Retell.
//
// The agent: NOT owned here. provisionAgent(companyId, origin) — the exact
// function a real purchase calls — builds a REAL Retell agent and LLM from
// this company's own facts. A demo's receptionist sounds like this company's
// receptionist, because it is one; it is simply never wired to a number
// anybody outside FieldQuo can dial.
//
// The row: created with `simulated: true` and `monthlyCents: 0`, so
// lib/voice/spendGate.js's rentDecision skips it by name (see its "a demo's
// line is never billed" branch) and /platform/voice-numbers, which reconciles
// this table against Retell's real inventory, excludes it rather than
// reporting a billing leak that was never a purchase.
import { db } from "@/lib/db";
import { buyNumber } from "./retell";
import { toE164, isSharedTestNumber, heldNumber } from "./numbers";
import { provisionAgent } from "./provision";
import { grantFreeTrial } from "./credits";

/**
 * Collisions are possible but rare — NANP's fictional block has 100 numbers
 * per area code and this file rotates five, so five demo accounts set up in
 * the same instant have roughly a 1-in-250 chance of a clash, caught by
 * `e164`'s unique constraint and retried here rather than surfaced as a
 * purchase failure. Bounded, not looped forever: a provider genuinely wedged
 * (or a bug in the generator) must fail loudly rather than spin.
 */
const MAX_ATTEMPTS = 5;

/**
 * Set up a demo's receptionist end to end, on a line nobody can dial.
 *
 * Mirrors the shape of the real purchase in
 * app/api/settings/voice/number/route.js — agent first, then the number, then
 * the row — for the same reason: a number that exists before an agent is
 * attached is a window, however short, where a caller who somehow reached it
 * hears nothing. There is no such caller here (nobody can dial a fictional
 * number), and the ordering is kept anyway because it is one fewer way for
 * this path to behave differently from the one it stands in for.
 *
 * No credit is reserved and no transaction race-guards the write: there is no
 * scarce external resource to lose a race over (the fictional number is
 * generated fresh, retried on collision), and this is a superadmin-triggered,
 * one-at-a-time action on a handful of internal fixtures, not a public button
 * under real concurrent load.
 *
 * @returns { status, body } — shaped like the real route's responses, so the
 *          caller can hand `body` straight to NextResponse.json(body, {status}).
 */
export async function provisionSimulatedNumber({ member, source, ownNumber, origin }) {
  // Same duplicate guard a real purchase uses. A demo should no more end up
  // with two numbers than a paying company should.
  const existing = await heldNumber(member.companyId);
  if (existing) {
    return {
      status: 409,
      body: {
        errorKey: "app.setVoice.numberBusy.held",
        error: "This demo already has a number set up. Release it first to change.",
        status: existing.status,
      },
    };
  }

  const provisioned = await provisionAgent(member.companyId, origin);
  const agent = await db.voiceAgent.findUnique({
    where: { companyId: member.companyId },
    select: { providerAgentId: true },
  });

  let row = null;
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && !row; attempt += 1) {
    let bought;
    try {
      bought = await buyNumber({ agentId: agent?.providerAgentId || undefined, demo: true });
    } catch (err) {
      lastErr = err;
      break;
    }

    const e164 = toE164(bought?.phone_number);
    // The shared test line is a different fixture (the owner's line for trying
    // a TENANT receptionist) and must never double as a demo's fictional one —
    // same rule the real purchase enforces, kept here for the same reason.
    if (!e164 || isSharedTestNumber(e164)) {
      lastErr = new Error("The simulated number generator returned something unusable.");
      continue;
    }

    try {
      row = await db.voicePhoneNumber.create({
        data: {
          companyId: member.companyId,
          e164,
          publicNumber: source === "forwarded" ? ownNumber : e164,
          source,
          status: "active",
          numberType: "local",
          providerId: e164,
          monthlyCents: 0,
          simulated: true,
        },
      });
    } catch (err) {
      // P2002 = unique constraint — a genuine collision with another row's
      // E.164. Retried with a freshly generated number; anything else is a
      // real failure and stops the loop.
      if (err?.code === "P2002") {
        lastErr = err;
        continue;
      }
      lastErr = err;
      break;
    }
  }

  if (!row) {
    console.error("[voice/demoLine] couldn't set up a simulated number", lastErr);
    return {
      status: 502,
      body: {
        error:
          "Couldn't set up the demo line just now. Nothing was charged — there was never anything to charge.",
      },
    };
  }

  // ── The same free-minutes grant a real purchase gives ───────────────────
  //
  // Not because any minute will ever really be spent — nobody can dial a
  // fictional number — but because the settings screen's readiness card and
  // "Answer my calls" switch both read the credit balance to decide whether
  // they may turn on, through the exact same checkSpend() a real company's do.
  // Without this a demo would show "add credit first" beside a line that is
  // never going to ring either way, which is its own small dead-looking
  // control. `grantFreeTrial` is idempotent per company, so re-running this
  // (a second demo number after a release) grants nothing twice.
  await grantFreeTrial({ companyId: member.companyId, numberType: "local" }).catch(() => {});

  return {
    status: 200,
    body: {
      e164: row.e164,
      source,
      numberType: "local",
      publicNumber: row.publicNumber,
      agentReady: provisioned.ok,
      chargedCents: 0,
      simulated: true,
    },
  };
}
