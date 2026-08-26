// lib/voice/pool.js
//
// FieldQuo's OWN exposure at Retell — the shared pool every tenant draws on.
//
// ══ The thing nothing was watching ═════════════════════════════════════════
//
// Everything else in lib/voice/ answers "can THIS company afford this call".
// Nothing answered "can FIELDQUO". There is one Retell account. Every tenant's
// minutes, every number's rent and every outbound dial is billed to it. If that
// account runs out of credit, or hits its simultaneous-call ceiling, every
// tenant's phone stops at the same moment, for a reason no tenant caused and no
// tenant can see — and the first anyone would learn of it is a contractor
// ringing to say their number is dead.
//
// ══ What Retell actually exposes, and what it does not ═════════════════════
//
// CONCURRENCY is real. `GET /get-concurrency` returns the account's live count
// and its ceiling. That number is READ, not derived, and it is the one hard
// fact on this page.
//
// CREDIT IS NOT EXPOSED. Retell's billing — credit balance, auto-recharge,
// invoices — lives in the dashboard. There is no balance endpoint in the API
// reference at all. So the money half below is DERIVED from our own rows: the
// minutes we know we served, multiplied by what a minute costs FieldQuo. It is
// an estimate of SPEND, not a reading of a balance, and it is labelled that way
// everywhere it surfaces. Inventing a balance we cannot read would be worse
// than showing none — the whole point is to be trusted when it says the pool is
// draining.
//
// If Retell ever ships a balance endpoint, replace `derivedSpend` with the read
// and delete this paragraph. Until then the honest answer to "how much credit
// is left" is "log in and look", plus the burn rate below to say how long that
// number has.
import { db } from "@/lib/db";
import { getConcurrency, voiceConfigured } from "./retell";

/**
 * What one minute costs FIELDQUO at the provider — not what we charge for it.
 *
 * ~16¢ is the all-in mid-range figure the pricing note in lib/voice/credits.js
 * is built on: voice infra + STT/TTS + the LLM + the carrier leg. It is an
 * estimate and it is the ONLY estimate in this file, which is why it is a named
 * constant with an env override rather than a number inline in a sum.
 *
 * Deliberately NOT CENTS_PER_MINUTE. That is the retail price; using it here
 * would report FieldQuo's revenue as FieldQuo's cost and understate the runway
 * by a factor of two.
 */
export const PROVIDER_COST_CENTS_PER_MINUTE = (() => {
  const n = Number(process.env.RETELL_COST_CENTS_PER_MINUTE);
  return Number.isFinite(n) && n > 0 ? n : 16;
})();

/**
 * Credit bought at Retell, in cents, if the owner has recorded it.
 *
 * Optional on purpose, and absent by default. There is no API to read this, so
 * it can only be a number a human typed after topping up the Retell account —
 * and a stale hand-typed number that the code treats as gospel is how a
 * dashboard confidently reports six weeks of runway on an account that is
 * already empty. Unset, the report says the balance is unknown and shows the
 * burn rate alone, which is still enough to act on.
 */
function purchasedCents() {
  const n = Number(process.env.RETELL_CREDIT_PURCHASED_CENTS);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Warn once utilisation of the shared ceiling reaches this. */
export const CONCURRENCY_WARN_RATIO = 0.7;
/** Below this many days of runway, somebody has to go and buy credit. */
export const RUNWAY_WARN_DAYS = 14;

/**
 * Minutes served across every tenant, and what they cost us, over a window.
 *
 * Derived from VoiceCall.durationSec — our record of calls, which is exactly as
 * complete as the metering is. That is a real caveat rather than a footnote: a
 * window during which the webhook was down and the reconciler had not yet run
 * UNDERSTATES the spend. It is stated in the return value (`basis`) so the page
 * can say where the number came from instead of presenting it as a meter
 * reading.
 *
 * Rounded up per call, matching how the provider bills and how we bill — a
 * thousand 20-second calls is a thousand minutes, not 333.
 */
export async function derivedSpend({ days = 30, prisma = db, now = Date.now() } = {}) {
  const since = new Date(now - days * 24 * 60 * 60 * 1000);

  const calls = await prisma.voiceCall.findMany({
    where: { createdAt: { gte: since }, durationSec: { gt: 0 } },
    select: { durationSec: true },
  });

  let minutes = 0;
  for (const c of calls) {
    const s = Number(c.durationSec);
    if (Number.isFinite(s) && s > 0) minutes += Math.ceil(s / 60);
  }

  const cents = minutes * PROVIDER_COST_CENTS_PER_MINUTE;
  return {
    days,
    calls: calls.length,
    minutes,
    cents,
    centsPerDay: days > 0 ? cents / days : 0,
    basis: "derived",
  };
}

/**
 * The whole picture: what Retell tells us, and what we can work out.
 *
 * Never throws. A provider that will not answer produces `concurrency: null`
 * with a reason, NOT a zero — reporting "0 of 20 calls in flight" when we could
 * not ask is the same class of lie as billing a call whose duration we could
 * not establish.
 */
export async function poolStatus({ prisma = db, now = Date.now(), days = 30 } = {}) {
  const configured = voiceConfigured();

  const [concurrency, spend] = await Promise.all([
    configured
      ? getConcurrency().catch((err) => ({ error: err?.message || "unreachable" }))
      : Promise.resolve({ error: "not_configured" }),
    derivedSpend({ days, prisma, now }).catch(() => null),
  ]);

  const conc = concurrency && !concurrency.error
    ? {
        current: num(concurrency.current_concurrency),
        limit: num(concurrency.concurrency_limit),
        base: num(concurrency.base_concurrency),
        purchased: num(concurrency.purchased_concurrency),
        burstEnabled: Boolean(concurrency.concurrency_burst_enabled),
        burstLimit: num(concurrency.concurrency_burst_limit),
        basis: "read",
      }
    : null;

  const purchased = purchasedCents();
  const remainingCents =
    purchased !== null && spend ? purchased - spend.cents : null;
  const runwayDays =
    remainingCents !== null && spend?.centsPerDay > 0
      ? remainingCents / spend.centsPerDay
      : null;

  return {
    configured,
    concurrency: conc,
    concurrencyError: concurrency?.error || null,
    spend,
    credit: {
      // Said out loud, in the payload, because the page renders it: Retell has
      // no balance API and this figure is only as good as the env var.
      basis: purchased === null ? "unknown" : "declared",
      purchasedCents: purchased,
      remainingCents,
      runwayDays,
      costCentsPerMinute: PROVIDER_COST_CENTS_PER_MINUTE,
    },
    alerts: alertsFor({ conc, remainingCents, runwayDays, error: concurrency?.error }),
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * What is worth waking someone up about. Pure, so it can be executed.
 *
 * Ordered worst-first, and every one of them fires BEFORE exhaustion rather
 * than after: a pool that is already empty has already taken every tenant's
 * phone down, and an alert at that point is a post-mortem.
 */
export function alertsFor({ conc, remainingCents, runwayDays, error } = {}) {
  const out = [];

  if (error && error !== "not_configured") {
    out.push({
      level: "warn",
      code: "concurrency_unreadable",
      message:
        `Retell won't say how much of the shared call ceiling is in use (${error}). ` +
        `Nothing is wrong with any tenant's phone because of this — but the one ` +
        `platform-wide limit that can take every tenant down at once is currently invisible.`,
    });
  }

  if (conc && conc.limit > 0 && conc.current !== null) {
    const ratio = conc.current / conc.limit;
    if (conc.current >= conc.limit) {
      out.push({
        level: "critical",
        code: "concurrency_exhausted",
        message:
          `All ${conc.limit} simultaneous calls on FieldQuo's Retell account are in use. ` +
          `Any tenant whose customer rings right now gets no answer, and nothing in their ` +
          `account explains why. Buy concurrency.`,
      });
    } else if (ratio >= CONCURRENCY_WARN_RATIO) {
      out.push({
        level: "warn",
        code: "concurrency_high",
        message:
          `${conc.current} of ${conc.limit} simultaneous calls in use across all tenants. ` +
          `At the ceiling, callers get dropped — buy concurrency before a busy Monday finds it.`,
      });
    }
  }

  if (remainingCents !== null && remainingCents <= 0) {
    out.push({
      level: "critical",
      code: "pool_spent",
      message:
        `Estimated spend has passed the credit recorded as bought at Retell. This is ` +
        `DERIVED from calls we metered, not read from Retell — check the Retell billing ` +
        `dashboard now, and update RETELL_CREDIT_PURCHASED_CENTS after topping up.`,
    });
  } else if (runwayDays !== null && runwayDays < RUNWAY_WARN_DAYS) {
    out.push({
      level: "warn",
      code: "pool_low",
      message:
        `About ${Math.floor(runwayDays)} days of Retell credit left at the current burn ` +
        `rate — derived from our own call records, not read from Retell. When it runs out, ` +
        `every tenant's phone stops at once.`,
    });
  }

  return out;
}
