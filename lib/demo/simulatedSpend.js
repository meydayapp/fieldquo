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
import { systemSmsNumber } from "@/lib/sms/systemNumber";
import { countryForAreaCode } from "@/lib/voice/nanp";
import {
  LIVE_ACTION,
  LIVE_DAILY_CAP,
  SIMULATED_REASON_TEXT,
  matchLiveRecipients,
  nanpDigits,
  recipientList,
} from "@/lib/demo/liveRecipients";

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

// ══ Live recipients: the one exception to "a demo never sends" ═══════════
//
// The owner: demos should send the real email and text "so that it can be
// shown to a client" — but "not the info that's already there, but if we
// need to create a new quote or create a client". So the verdict below is the
// whole rule, and lib/email/resend.js's sendEmail and lib/sms/twilioClient.js's
// sendSms both ask it, with an id, never a flag.
//
// ── Why a marker on the row, and not "created after the last reset" ──────
//
// The alternative was to compare Client.createdAt with the demo's last seed.
// It cannot work: the seeder creates its fixtures AFTER the reset, so every
// seeded client is "newer than the reset" too. Nothing about a row's age says
// who typed it. demoLiveAt is written only by the server, in the handful of
// create paths a person drives (demoLiveStamp below), from isDemoCompany()
// re-read at that moment; every one of those routes builds its data object
// field by field, so a request body carrying `demoLiveAt` is ignored rather
// than spread. Seeding, imports, the migration service and the platform
// console never call demoLiveStamp, and an UPDATE never sets it — so a rep
// typing a stranger's address onto a seeded client changes nothing.

const WINDOW_MS = 24 * 3600 * 1000;

/**
 * `{ demoLiveAt }` for a create path a person drives on a demo company, `{}`
 * everywhere else. Spread into the create's data object.
 *
 * Re-reads the row. A caller cannot hand it "this is a demo", and a real
 * company's client never carries the column — not because it would change
 * anything (the verdict below answers `demo: false` first for a real tenant),
 * but because a stray marker on a real row would be a lie in the data.
 */
export async function demoLiveStamp(companyId, now = new Date()) {
  return (await isDemoCompany(companyId)) ? { demoLiveAt: now } : {};
}

// FieldQuo's own system number's US A2P standing, read from Twilio at most
// every ten minutes. Never "assumed registered": an unknown answer keeps US
// texts simulated. See lib/sms/usA2pStatus.js for the 30034 history.
const US_TTL_MS = 10 * 60 * 1000;
let usCache = { e164: null, at: 0, registered: false };

// Exported for lib/trial/phoneGate.js, which asks the same question (can a
// code reach a US mobile from our number?) and must not keep a second cache.
export async function systemNumberTextsUs(e164) {
  if (usCache.e164 === e164 && Date.now() - usCache.at < US_TTL_MS) return usCache.registered;
  // Imported lazily: usA2pStatus imports the Twilio client, which imports this
  // module. A static import would be a cycle; at call time it is just a read.
  const { readUsA2pStatus } = await import("@/lib/sms/usA2pStatus");
  const status = await readUsA2pStatus({ numbers: [{ e164, purpose: "system" }] }).catch(() => null);
  const registered = status?.lines?.[0]?.state === "registered";
  usCache = { e164, at: Date.now(), registered };
  return registered;
}

/**
 * May this send leave the building — and if it is a demo's, for real?
 *
 * The one gate. Both vendor seams call it with the tenant's id and the
 * recipient; nothing else decides.
 *
 * @param companyId  the tenant the send is on behalf of
 * @param channel    "email" | "sms"
 * @param to         the recipient(s), as the vendor would receive them
 * @returns
 *   { demo: false }                          a real company — send as always
 *   { demo: true, live: false, reason }      simulate, and say why
 *   { demo: true, live: true, from? }        a demo, sending for real (SMS
 *                                            carries the number to send from)
 *
 * THROWS when the database cannot be read. Both callers already turn a throw
 * here into a send FAILURE — never a send — which is the property the
 * isDemoCompany() check had and this must keep: a Neon blip must not decide
 * that a demo's mail goes to a real inbox.
 */
export async function demoSendVerdict({ companyId, channel, to, now = new Date() }) {
  if (!companyId) return { demo: false };
  if (channel !== "email" && channel !== "sms") throw new Error(`demoSendVerdict: unknown channel ${channel}`);

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { isDemo: true, demoRetiredAt: true },
  });
  if (!company?.isDemo) return { demo: false };

  const simulated = (reason) => ({ demo: true, live: false, reason, reasonText: SIMULATED_REASON_TEXT[reason] || reason });

  // A retired rep demo (lib/sales/repDemo.js) keeps its rows; "reset" must
  // still end every live window on it.
  if (company.demoRetiredAt) return simulated("retired");

  // Only rows a person created live, ever — the window is judged in the pure
  // half so an expired one can be told apart from one that never was.
  const marked = { companyId, demoLiveAt: { not: null } };
  const [clients, leads] = await Promise.all([
    db.client.findMany({ where: marked, select: { email: true, phone: true, demoLiveAt: true }, take: 500 }),
    db.leadRequest.findMany({ where: marked, select: { email: true, phone: true, demoLiveAt: true }, take: 500 }),
  ]);
  const match = matchLiveRecipients({ channel, to, records: [...clients, ...leads], now });
  if (!match.live) return simulated(match.reason);

  let from;
  if (channel === "sms") {
    const digits = nanpDigits(recipientList(to)[0]);
    const e164 = `+1${digits}`;
    // STOP wins here too, not only in the callers that remember to ask
    // maySms — a demo sending for real is the last place to rely on that.
    const [optOut, callOptOut] = await Promise.all([
      db.smsOptOut.findUnique({ where: { companyId_e164: { companyId, e164 } }, select: { optedOut: true } }),
      db.callConsent.findFirst({ where: { companyId, e164, optedOutAt: { not: null } }, select: { id: true } }),
    ]);
    if (optOut?.optedOut || callOptOut) return simulated("opted_out");

    // A demo's own numbers are fictional (555-01xx, provider "simulated"), so
    // a real text goes from FieldQuo's own system number — the same line
    // every real company without a number of its own texts from, which is
    // also the line the inbound STOP handler resolves back to this company.
    from = await systemSmsNumber();
    if (!from) return simulated("no_sms_number");
    if (countryForAreaCode(digits.slice(0, 3)) !== "CA" && !(await systemNumberTextsUs(from))) {
      return simulated("us_unregistered");
    }
  }

  const sent = await db.activityLog.count({
    where: { companyId, action: LIVE_ACTION[channel], createdAt: { gte: new Date(now.getTime() - WINDOW_MS) } },
  });
  if (sent >= LIVE_DAILY_CAP[channel]) return simulated("cap");

  return { demo: true, live: true, ...(from ? { from } : {}) };
}

/**
 * Record a real demo send BEFORE it is made: the audit row (who it went to,
 * what it said, that FieldQuo paid), the unit the daily cap counts, and the
 * line /platform/costs sums. Returns false when the row could not be written —
 * and the caller then simulates instead, because a real send nobody can
 * account for is the one outcome this whole feature must not have.
 */
export async function claimLiveDemoSend({ companyId, channel, to, subject = null, body = null, from = null }) {
  const recipients = recipientList(to);
  try {
    await db.activityLog.create({
      data: {
        companyId,
        action: LIVE_ACTION[channel],
        entityType: channel,
        summary: `Demo account — this ${channel === "sms" ? "text" : "email"} WAS sent for real to ${recipients.join(", ")}, a client created live in this demo. FieldQuo pays for it.`,
        metadata: {
          to: recipients,
          from,
          subject,
          body: String(body || "").slice(0, 1600),
          live: true,
        },
      },
    });
    return true;
  } catch (err) {
    console.error("[demo live] couldn't record the live send, simulating instead:", err?.message);
    return false;
  }
}

/**
 * Today's live-send standing for one demo, for the rep's panel: how many of
 * each channel have gone out in the last 24 hours, against the cap.
 */
export async function demoLiveUsage(companyId, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [email, sms] = await Promise.all(
    ["email", "sms"].map((c) =>
      db.activityLog.count({ where: { companyId, action: LIVE_ACTION[c], createdAt: { gte: since } } }),
    ),
  );
  return { email, sms, cap: { ...LIVE_DAILY_CAP } };
}

/**
 * What the rep's demo panel says about real messages: the usage per demo,
 * and whether a text can go out at all — which number, and whether US phones
 * receive it. Read from the same places the verdict reads (the system number,
 * Twilio's own A2P resources), so the panel can never promise a text the gate
 * would then simulate.
 */
export async function demoLivePanel(companyIds = [], now = new Date()) {
  const usage = {};
  for (const id of companyIds) usage[id] = await demoLiveUsage(id, now);
  const number = await systemSmsNumber();
  const usTexting = number ? await systemNumberTextsUs(number) : false;
  return {
    windowHours: WINDOW_MS / 3600000,
    cap: { ...LIVE_DAILY_CAP },
    usage,
    sms: { number: number || null, canada: Boolean(number), us: Boolean(number) && usTexting },
  };
}

// ══ Money: the one thing a live demo still never does ══════════════════════
//
// Once a demo's messages can reach a real prospect, the prospect can reach the
// pay step: the quote's deposit, the invoice's Pay button, a booking fee, a
// card-on-file plan. Today every one of those is stopped only because no demo
// happens to hold a Stripe Connect account — DATA, not a guard, the same shape
// lib/email/demoMail.js's header describes for @example.com addresses. A
// superadmin connecting demo1 to show onboarding would have made every one of
// them a real charge on a stranger's card.

/**
 * Throws (status 409, code "demo_no_charge") when the company is a demo.
 * Called first thing in every function that creates a Stripe charge, setup or
 * checkout on behalf of a company (lib/stripe.js, lib/servicePlans/
 * stripeMandate.js) — the routes take the demo path before they get here, so
 * this firing means a new caller forgot, and refusing is the right failure.
 */
export async function refuseDemoCharge(company) {
  // Takes the company row the caller already loaded (every Stripe seam has
  // one) or an id. A row that carries `isDemo` is answered from it — it read
  // the same row, which this file's header allows; a row selected without it,
  // or a bare id, is re-read. Never a separate flag argument.
  const demo =
    company && typeof company === "object" && typeof company.isDemo === "boolean"
      ? company.isDemo
      : await isDemoCompany(typeof company === "string" ? company : company?.id);
  if (demo) {
    const err = new Error("This is a demo account — no card is charged.");
    err.status = 409;
    err.code = "demo_no_charge";
    throw err;
  }
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
