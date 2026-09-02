// lib/demo/simulatedSpend.js
//
// The one place that answers "is this company a sales demo, and therefore must
// this purchase be simulated rather than made?"
//
// ══ Why this exists as its own module ══════════════════════════════════════
//
// lib/voice/demoLine.js already solved this for Retell numbers, and its header
// is the reasoning for all of it: a bought number "outlives the demo, keeps
// billing FieldQuo, and is a real line a stranger can dial while the account
// is re-dressed as a different trade next week." Every word of that was true of
// the Twilio crew line too, and of credit top-ups — a demo could reach Stripe
// Checkout and a rep could put a real card through it.
//
// The voice fix substituted at the vendor-call seam inside retell.js. That
// works when there is one vendor and one module. Crew texting, voice top-ups
// and AI top-ups are three stacks with three different vendors, so the shared
// thing is not a substitution — it is the QUESTION. Each caller asks it here
// and takes its own simulated branch.
//
// ══ Re-read, never trusted ═════════════════════════════════════════════════
//
// isDemoCompany() re-reads the row, exactly as lib/demo/seedDemo.js's
// assertDemo() does, and for the same reason: an id arriving from an HTTP
// request is an id, and the only thing that makes it safe to skip a charge is
// what the row says about itself. A caller that already loaded the company may
// pass the boolean it read — that is fine, it read the same row — but nothing
// here accepts an override, a flag, or an option that would let a real tenant
// take the simulated path. A real company MUST be charged; silently not
// charging one is the same class of bug as charging a demo, pointing the other
// way.
import { db } from "@/lib/db";

/**
 * Does this company's own row say it is a sales demo?
 *
 * Returns false for a missing company rather than throwing: every caller uses
 * this to decide "simulate or charge", and the safe answer when we cannot tell
 * is to take the real path, which has its own company checks and will refuse.
 */
export async function isDemoCompany(companyId) {
  if (!companyId) return false;
  const row = await db.company.findUnique({
    where: { id: companyId },
    select: { isDemo: true },
  });
  return Boolean(row?.isDemo);
}

// NANP reserved fictional range: NPA-555-0100 through 0199. Numbers in this
// block are guaranteed never to be assigned to a real subscriber, which is why
// lib/voice/retell.js's simulated branch uses it too — a rep reading one aloud
// during a demo cannot make a stranger's phone ring.
const SIMULATED_AREA_CODES = ["416", "514", "604", "212", "312", "415"];

/**
 * A fictional, undialable E.164 for a simulated purchase.
 *
 * Deliberately the same shape retell.js produces, so /platform/crew-lines and
 * the voice screens show one recognisable kind of demo number rather than two.
 */
export function simulatedCrewE164(areaCode) {
  const area = /^\d{3}$/.test(String(areaCode || ""))
    ? String(areaCode)
    : SIMULATED_AREA_CODES[Math.floor(Math.random() * SIMULATED_AREA_CODES.length)];
  const last2 = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `+1${area}55501${last2}`;
}

/**
 * Provision a simulated crew texting line: a real row, a fictional number, no
 * provider and no money.
 *
 * ── Why this lives here and not beside the real purchase ───────────────────
 *
 * It was written inline in purchaseCrewLine first, and
 * scripts/check-crew-line-purchase.mjs failed — correctly. That check asserts
 * the REAL purchase writes its row only after the money is reserved and the
 * provider has answered, by comparing the position of `db.crewInboxNumber.create`
 * against the reserve and buy calls. A second create earlier in the same file
 * made that comparison find the wrong one, and the ordering it protects is a
 * genuine property worth keeping legible: a row written before the buy would
 * claim a number FieldQuo does not own.
 *
 * So the simulated path keeps its write out of that file entirely. The check
 * goes back to proving what it was written to prove, with no exception carved
 * into it for a case it was never about.
 *
 *  - `provider: "simulated"` has no entry in SMS_CAPABLE_PROVIDERS
 *    (lib/crew/capability.js), which already returns an explicit
 *    "provider_no_sms" verdict rather than attempting a send.
 *  - `source: "demo"` is invisible to app/api/cron/crew-line-rent, which
 *    queries `source: "dedicated"` — the same way a shared_test loan is
 *    excluded from billing rather than skipped in the loop.
 *  - `providerId: null` means a reset can delete this row without orphaning
 *    anything at a vendor. See wipeContent in lib/demo/seedDemo.js.
 */
export async function createSimulatedCrewLine({ companyId, webhookUrl }) {
  const line = await db.crewInboxNumber.create({
    data: {
      companyId,
      // The requested number is deliberately not honoured. It came from a
      // provider search and belongs to somebody; recording it would put a real,
      // textable number on a demo account's screen for a rep to read aloud.
      e164: simulatedCrewE164(),
      provider: "simulated",
      source: "demo",
      providerId: null,
      webhookUrl: webhookUrl || null,
      connectedAt: new Date(),
      // Nothing to bill, and the rent cron cannot see this row anyway.
      rentPaidThroughAt: null,
      expiresAt: null,
    },
  });
  await db.company.update({
    where: { id: companyId },
    data: { crewInboxEnabled: true },
  });
  return line;
}
