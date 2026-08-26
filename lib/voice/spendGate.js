// lib/voice/spendGate.js
//
// Nothing spends FieldQuo's money until the company's money is already here.
//
// ══ Why this module exists ═════════════════════════════════════════════════
//
// FieldQuo holds ONE Retell account (see lib/voice/retell.js). Every number
// provisioned "for a tenant" is billed to FieldQuo, immediately and every month
// after, whether or not that contractor ever pays a cent. Talk time was already
// prepaid; the number itself was not. `POST /api/settings/voice/number` bought a
// live phone number with no balance check at all and then GRANTED credit, so the
// first thing a brand-new company could do was cost FieldQuo $4–9 a month
// forever and take 30 minutes of calls, having paid nothing.
//
// So: one gate, and every path that turns into a provider charge goes through
// it. One, not one per route — the second copy is the one that rots, because
// it's the one nobody looks at. If a new voice feature costs money, it adds a
// kind here rather than a check of its own.
//
// ══ Reserve first, buy second ══════════════════════════════════════════════
//
// The debit is written BEFORE the provider call, not after. "Check, then buy,
// then charge" is the same as no gate at all when the buy succeeds and the
// charge throws — FieldQuo owns a number nobody paid for, and the only record is
// a log line. Reserving first inverts the failure: the worst case is a company
// briefly short of credit for a number they didn't get, and `refundReservation`
// puts it back with a note that says why.
//
// ══ Prepaid balance, not a card charge ═════════════════════════════════════
//
// Rent draws down the same prepaid balance talk time does. Two alternatives were
// considered and rejected:
//
//   * A Stripe subscription per number. That is FieldQuo's own Stripe BILLING
//     account (not Connect — different integration, see AGENTS.md), and it means
//     a contractor with a $9 toll-free line gets a second recurring invoice
//     separate from their plan, plus dunning, plus a card that expires while
//     their business number quietly stops being paid for. It also breaks the
//     promise credits.js makes: no surprise invoices, ever.
//   * Charging the card on file per month. Same surprise, less warning.
//
// Drawing on the balance means a company that stops topping up loses the number
// rather than FieldQuo eating the cost — and, crucially, they lose it the way a
// prepaid phone is lost: with a warning, a grace period, and a state they can
// see, not overnight.
//
// ══ What this gate does NOT cover, and where it would go ═══════════════════
//
// CONCURRENCY. The one Retell account has a single simultaneous-call ceiling
// shared by every tenant (`/get-concurrency`), so on a busy Monday one company's
// call volume can make another company's phone stop answering with
// `concurrency_limit_reached`. That is the same class of problem as this module
// — a shared platform resource a tenant can exhaust — but it is a CAPACITY limit,
// not a money one, and the honest fix is buying more concurrency, not refusing a
// paying customer's caller. It belongs in canTakeCall/`checkSpend({kind:"call"})`
// the day the ceiling is real: read the account's limit, compare against live
// calls, and refuse the OUTBOUND queue first (a callback can wait; a homeowner
// ringing in cannot). Deliberately not built on a guess about the ceiling —
// inventing a limit would drop calls nobody needed to drop.
//
// SMS. Twilio charges FieldQuo per message for appointment reminders, visit
// notifications and the crew inbox, and none of it is metered anywhere. Same
// leak shape as the rental was; it needs a price per message before it can have
// a gate, which is a product decision rather than a bug fix.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
// Whether FieldQuo still OFFERS voice to this company — a different question
// from whether the company can afford it, and it has to be asked first. See the
// header of lib/features/gate.js for what happens to money when it is withdrawn.
import { featureAllowsSpend } from "@/lib/features/gate";
// The single release path: provider first, database only on proof. See its
// header for why a 200 on the DELETE is not evidence the number went back.
import { releaseHeldNumber } from "./numberRelease";
import {
  balanceFor,
  canTakeCall,
  debitCredit,
  addCredit,
  monthlyCentsFor,
  ratePerMinute,
  minutesFor,
  CREW_LINE_MONTHLY_CENTS,
} from "./credits";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Everything that costs FieldQuo money on a tenant's behalf, and what it costs.
 *
 * `label` is shown to the contractor before they commit, so it has to be the
 * whole truth: "a number" is not a price, "$4.00 now, then $4.00 a month" is.
 */
export const SPEND_KINDS = {
  /**
   * Buying a number. The provider starts charging the moment it exists, so the
   * first month is taken up front — this is the charge the whole module is
   * about.
   */
  number_setup: { key: "number_setup", recurring: true },
  /** Each month after the first. Same price, taken by the rent cron. */
  number_rent: { key: "number_rent", recurring: true },
  /**
   * Talk time. Priced per minute and already gated by canTakeCall, which
   * provision.js and outboundCall.js call directly. Represented here so the gate
   * is the complete list of what spends money — and so the two can be asserted
   * to agree rather than assumed to.
   */
  call: { key: "call", recurring: false },
  /**
   * A crew text, in or out. Priced per MESSAGE rather than per minute — an
   * inbound photo costs more than an inbound line of text, and the carrier has
   * already been paid by the time we see either.
   *
   * Represented here for the same reason `call` is: this map is meant to be the
   * complete list of what spends a company's balance, and lib/crew/messaging.js
   * debits the same ledger. A kind that spends money and is missing from here
   * makes the platform spend screens quietly understate what a company costs.
   *
   * `priceSpend` deliberately does NOT price it: a text's cost depends on
   * whether it carried media and how many segments it split into, neither of
   * which this signature takes. lib/crew/messaging.js holds that arithmetic.
   */
  crew_text: { key: "crew_text", recurring: false },
  /**
   * Buying a crew texting line, and each month after.
   *
   * Separate kinds from `number_setup`/`number_rent` rather than a third
   * `numberType`, because the two rent cycles are billed by different crons off
   * different tables — voice-rent walks VoicePhoneNumber, crew-line-rent walks
   * CrewInboxNumber — and a company can hold one of each. Sharing a kind would
   * make "which number is this $4 for?" unanswerable from the ledger, which is
   * the question a contractor asks first.
   */
  crew_line_setup: { key: "crew_line_setup", recurring: true },
  crew_line_rent: { key: "crew_line_rent", recurring: true },
};

/** What one unit of this spend costs, in cents. Pure. */
export function priceSpend(kind, numberType = "local") {
  switch (kind) {
    case "number_setup":
    case "number_rent":
      return monthlyCentsFor(numberType);
    // Flat — a crew line has no toll-free variant to price differently, so
    // `numberType` is ignored here rather than silently accepted and used.
    case "crew_line_setup":
    case "crew_line_rent":
      return CREW_LINE_MONTHLY_CENTS;
    case "call":
      // A call's floor is one minute — costForSeconds rounds up with a
      // one-minute minimum, so anything less than that cannot be afforded.
      return ratePerMinute(numberType);
    default:
      return 0;
  }
}

/**
 * The decision, with no database in it.
 *
 * Pure so it can be executed against hostile input — a NaN balance, an unknown
 * kind, a negative one — in a check script rather than reasoned about. Every
 * "no" carries the numbers the UI needs to say WHY, because "insufficient
 * balance" after the fact is the dead control AGENTS.md forbids.
 */
export function spendVerdict({ kind, numberType = "local", balanceCents }) {
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;

  if (!SPEND_KINDS[kind]) {
    // An unknown kind is refused, not waved through. A typo in a new caller must
    // fail closed — the whole point of this module is that money can't leak past
    // it by accident.
    return {
      allowed: false,
      kind,
      needCents: 0,
      balanceCents: balance,
      shortfallCents: 0,
      reason: "unknown_spend",
    };
  }

  const needCents = priceSpend(kind, numberType);
  const allowed = balance >= needCents;
  return {
    allowed,
    kind,
    numberType,
    needCents,
    balanceCents: balance,
    shortfallCents: allowed ? 0 : needCents - balance,
    reason: allowed ? "ok" : "insufficient_balance",
  };
}

/**
 * Does FieldQuo still OFFER voice to this company?
 *
 * Exported so a caller can resolve it BEFORE opening a transaction and hand the
 * answer to checkSpend. featureMapForCompany reads a platform-wide table and
 * swallows its own errors on purpose — both of which are wrong inside a
 * serialisable transaction, where a swallowed serialisation failure leaves the
 * transaction aborted and every statement after it failing on something
 * unrelated. The feature key lives here and nowhere else, so a caller that
 * pre-resolves it cannot pre-resolve the wrong one.
 */
export async function spendAvailable(companyId) {
  return featureAllowsSpend(companyId, "voice_receptionist");
}

/**
 * Can this company afford it, right now?
 *
 * Read-only. Used by the settings API to decide whether a button is live, and by
 * reserveSpend immediately before taking the money.
 *
 * `prisma` takes a transaction client so the balance is read inside whatever
 * transaction is taking the money — see reserveSpend. `available` is the
 * pre-resolved answer from spendAvailable(); omitting it asks for real, so this
 * cannot fail open by forgetting.
 */
export async function checkSpend({ companyId, kind, numberType = "local", prisma = db, available }) {
  if (!companyId) {
    return { allowed: false, kind, needCents: priceSpend(kind, numberType), balanceCents: 0, shortfallCents: priceSpend(kind, numberType), reason: "no_company" };
  }

  // Availability before affordability. A company that FieldQuo has withdrawn
  // voice from must not buy a number however much credit it holds — and asking
  // here rather than in the buy route means a future caller cannot spend by
  // forgetting, which is the same argument that put every price in this module.
  const offered = available === undefined ? await spendAvailable(companyId) : available;
  if (!offered) {
    return {
      allowed: false,
      kind,
      numberType,
      needCents: priceSpend(kind, numberType),
      balanceCents: await balanceFor(companyId, prisma),
      shortfallCents: 0,
      // Not "insufficient_balance" — topping up would not fix it, and telling
      // someone to add money to solve a problem money can't solve is the worst
      // kind of dead control.
      reason: "feature_unavailable",
    };
  }

  // Talk time defers to canTakeCall rather than re-deriving it: provision.js and
  // outboundCall.js call that function directly and cannot be edited from here,
  // and two implementations of "may this call happen" is exactly the drift this
  // module exists to prevent.
  if (kind === "call") {
    const verdict = await canTakeCall(companyId, numberType, prisma);
    return {
      allowed: verdict.allowed,
      kind,
      numberType,
      needCents: ratePerMinute(numberType),
      balanceCents: verdict.cents,
      shortfallCents: verdict.allowed ? 0 : ratePerMinute(numberType) - verdict.cents,
      reason: verdict.allowed ? "ok" : "insufficient_balance",
    };
  }

  return spendVerdict({ kind, numberType, balanceCents: await balanceFor(companyId, prisma) });
}

/**
 * Take the money, if it's there.
 *
 * Returns the same verdict shape as checkSpend, plus `entry` when it went
 * through. Callers branch on `allowed` and hand the rest to the UI — they never
 * compute a price themselves, because a price computed at a call site is a price
 * that can disagree with the one the contractor was shown.
 *
 * `prisma` is how this becomes the serialisation point for a purchase. The
 * ledger read (the balance) and the ledger write (the debit) land in the same
 * transaction as the caller's own duplicate guard, so two overlapping purchases
 * are a read-write conflict Postgres can see and abort under SERIALIZABLE. On
 * the default client it behaves exactly as it always did.
 */
export async function reserveSpend({ companyId, kind, numberType = "local", ref, note, prisma = db, available }) {
  const verdict = await checkSpend({ companyId, kind, numberType, prisma, available });
  if (!verdict.allowed) return verdict;

  const entry = await debitCredit({
    companyId,
    cents: verdict.needCents,
    kind,
    ref,
    note,
    prisma,
  });
  return { ...verdict, entry };
}

/**
 * Give a reservation back.
 *
 * Only for the case where we took the money and then the provider refused — the
 * company must not be down $4 for a number they never got. Written under its own
 * ref so a retried failure path refunds once, and so the statement reads
 * "reserved / refunded" rather than showing a hole that has to be explained.
 *
 * The refund is deliberately NOT in the reservation's transaction: by the time
 * anything knows the provider refused, that transaction committed minutes ago.
 * It is an ordinary credit written afterwards, and `refundRefFor` is what ties
 * the two rows together — including for purchaseInFlight below, which reads a
 * refunded reservation as settled rather than as a purchase still running.
 */
export async function refundReservation({ companyId, ref, cents, note }) {
  if (!companyId || !ref) return null;
  return addCredit({
    companyId,
    cents,
    kind: "adjustment",
    ref: refundRefFor(ref),
    note: note || "Refund — the number couldn't be set up",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// A purchase already in flight
// ═══════════════════════════════════════════════════════════════════════════
//
// ══ The race this closes ═══════════════════════════════════════════════════
//
// The buy route asks heldNumber() "do they have one already?", and then, if
// not, reserves the rental and calls Retell. The VoicePhoneNumber row is only
// written once the provider answers. Between the guard and that row sits a
// network call to somebody else's API — seconds, not milliseconds — and a
// second click landing inside that window finds no held number either. Both
// buy. Company cmsl36it7000004juyw4qyn0u holds two purchased numbers with two
// $4 `number_setup` debits 31 seconds apart.
//
// ══ Why SERIALIZABLE alone is not the answer ═══════════════════════════════
//
// Wrapping the guard and the reservation in a serialisable transaction was the
// obvious fix and it is not sufficient. Postgres SSI can only order
// transactions that OVERLAP. This transaction has to commit before the provider
// is called — holding one open across a multi-second network call is worse than
// the bug — so the second request's transaction starts after the first one has
// already committed, conflicts with nothing, and reserves happily. It closes
// the millisecond, which was never the window that hurt.
//
// What spans the provider call is the reservation ROW. It is written before
// Retell is touched and it is still there afterwards, so it is evidence a
// purchase is running that a later request can actually see. That makes the
// guard a read of durable state rather than a bet on timing, and the
// serialisable transaction is still worth having on top: it settles the
// genuinely simultaneous pair that would otherwise both read "no claim".
//
// ══ Why not a unique index, or a placeholder row ═══════════════════════════
//
//   * `@@unique([companyId])` on VoicePhoneNumber cannot work — released rows
//     persist, and a company that gives a number back must be able to buy
//     another. A partial unique index needs raw SQL, and this repo runs
//     `prisma db push` with no migration files.
//   * Creating the VoicePhoneNumber row up front as a claim would be the
//     tidiest marker, but `e164` is NOT NULL and unique, and there is no number
//     yet — it would mean inventing a fake one and putting it on the settings
//     screen, in the refusal messages, and in front of diagnoseNumber. Absence
//     of a number is not a number.
//   * A `pg_advisory_xact_lock` releases at commit, which is the same
//     millisecond this is not about. A session-level lock would outlive the
//     request on a pooled connection and could strand a company for ever.

/**
 * How long a reservation with no number behind it counts as still running.
 *
 * Long enough to cover any realistic provisionAgent + buyNumber round trip, and
 * short enough that a request killed mid-purchase strands the company for
 * minutes rather than until somebody notices. Erring longer would block honest
 * retries; erring shorter reopens the window this exists to close.
 */
export const CLAIM_WINDOW_MS = 5 * 60 * 1000;

/** The ledger ref a number purchase reserves under. One spelling, two readers. */
export function numberSetupRef(token) {
  return `number_setup:${token}`;
}

/**
 * The same, for a crew texting line.
 *
 * Its own spelling rather than a shared one, because claimVerdict below reads
 * the PREFIX to decide which purchase is running. A company may buy a voice
 * number and a crew line in the same minute, and each guard has to be blind to
 * the other or the second buyer is refused for the first one's reservation.
 */
export function crewLineSetupRef(token) {
  return `crew_line_setup:${token}`;
}

/** The ref its refund is written under — see refundReservation. */
export function refundRefFor(ref) {
  return `refund:${ref}`;
}

/**
 * Is one of these reservations a purchase that is still running?
 *
 * Pure, so it can be executed against a hostile ledger rather than reasoned
 * about. A reservation is SETTLED — and therefore not in flight — when either:
 *
 *   * a refund was written against it (the provider refused, the money is back,
 *     and they are free to try again), or
 *   * a VoicePhoneNumber row was created at or after it (the purchase finished;
 *     from here heldNumber() is the guard, and it is the one that must decide,
 *     because it knows about `released` and this does not).
 *
 * That second rule is what keeps this from widening the guard's meaning. A
 * company whose only rows are `released` has no unsettled reservation — the
 * release happened after a row that settled the claim — so it may buy again.
 */
export function claimVerdict({
  entries,
  numberRowsCreatedAt = [],
  now = new Date(),
  windowMs = CLAIM_WINDOW_MS,
  // Which purchase this is asking about. Defaults to the voice number so every
  // existing caller and check keeps its exact meaning; the crew line passes
  // "crew_line_setup" and reads CrewInboxNumber rows into numberRowsCreatedAt.
  kind = "number_setup",
}) {
  const at = (v) => {
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : null;
  };
  const nowMs = at(now) ?? Date.now();
  const floor = nowMs - windowMs;

  const rows = (Array.isArray(entries) ? entries : []).filter(
    (e) => e && typeof e === "object",
  );

  const refunded = new Set(
    rows.map((e) => e.ref).filter((r) => typeof r === "string" && r.startsWith("refund:")),
  );

  const numberRowMs = (Array.isArray(numberRowsCreatedAt) ? numberRowsCreatedAt : [])
    .map(at)
    .filter((ms) => ms !== null);

  let newest = null;
  for (const e of rows) {
    if (e.kind !== kind) continue;
    if (typeof e.ref !== "string" || !e.ref.startsWith(`${kind}:`)) continue;
    const started = at(e.createdAt);
    // No timestamp is no evidence of a purchase running NOW. Treating it as one
    // would block a company on a row we cannot place in time.
    if (started === null || started < floor) continue;
    if (refunded.has(refundRefFor(e.ref))) continue;
    if (numberRowMs.some((ms) => ms >= started)) continue;
    if (!newest || started > newest.startedMs) newest = { ref: e.ref, startedMs: started };
  }

  if (!newest) return { inFlight: false, ref: null, startedAt: null, retryAt: null };
  return {
    inFlight: true,
    ref: newest.ref,
    startedAt: new Date(newest.startedMs),
    // What the refusal can promise. A window with no end is the spinner this
    // codebase keeps replacing with a date.
    retryAt: new Date(newest.startedMs + windowMs),
  };
}

/**
 * The same question, against the database.
 *
 * `prisma` is normally a transaction client: the reservation read below is what
 * gives Postgres a read-write conflict to detect when two purchases really are
 * simultaneous, and reading it on the global client instead would be a read
 * outside the transaction that conflicts with nothing.
 */
export async function purchaseInFlight({ companyId, prisma = db, now = new Date() }) {
  if (!companyId) return { inFlight: false, ref: null, startedAt: null, retryAt: null };
  const floor = new Date(new Date(now).getTime() - CLAIM_WINDOW_MS);

  const [entries, numbers] = await Promise.all([
    prisma.voiceCreditEntry.findMany({
      where: { companyId, createdAt: { gte: floor } },
      select: { ref: true, kind: true, createdAt: true },
    }),
    // Only rows created inside the same window can settle a claim inside it,
    // and the comparison is done in claimVerdict rather than here so the rule
    // has one home.
    prisma.voicePhoneNumber.findMany({
      where: { companyId, createdAt: { gte: floor } },
      select: { createdAt: true },
    }),
  ]);

  return claimVerdict({
    entries,
    numberRowsCreatedAt: (numbers || []).map((n) => n.createdAt),
    now,
  });
}

/**
 * purchaseInFlight, for the crew texting line.
 *
 * Same shape, different tables: crew_line_setup reservations, settled by a
 * CrewInboxNumber row rather than a VoicePhoneNumber one. Written out rather
 * than parameterised into the function above because the two read DIFFERENT
 * models, and a `model` argument threaded through Prisma is the kind of
 * indirection that makes the next reader check what it resolves to.
 */
export async function crewLinePurchaseInFlight({ companyId, prisma = db, now = new Date() }) {
  if (!companyId) return { inFlight: false, ref: null, startedAt: null, retryAt: null };
  const floor = new Date(new Date(now).getTime() - CLAIM_WINDOW_MS);

  const [entries, lines] = await Promise.all([
    prisma.voiceCreditEntry.findMany({
      where: { companyId, createdAt: { gte: floor } },
      select: { ref: true, kind: true, createdAt: true },
    }),
    prisma.crewInboxNumber.findMany({
      where: { companyId, createdAt: { gte: floor } },
      select: { createdAt: true },
    }),
  ]);

  return claimVerdict({
    entries,
    numberRowsCreatedAt: (lines || []).map((n) => n.createdAt),
    now,
    kind: "crew_line_setup",
  });
}

/**
 * Is this the database refusing to order two transactions, rather than a bug?
 *
 * Postgres raises SQLSTATE 40001 ("could not serialize access…") to whichever
 * serialisable transaction it decides to abort, and 40P01 for a deadlock. Both
 * mean "you lost a race, and nothing you did was wrong" — the caller owes the
 * user the same refusal it would have given had it lost the race by a second,
 * never a 500.
 *
 * Three shapes are checked because this stack can produce three. Prisma has a
 * dedicated code (P2034) for the write-conflict case; the PrismaPg driver
 * adapter otherwise passes the raw SQLSTATE through
 * `meta.driverAdapterError.cause.originalCode` (verified against this database
 * — a division by zero surfaces there as `22012`); and the message carries the
 * text either way.
 */
export function isSerialisationFailure(err) {
  if (!err) return false;
  if (err.code === "P2034") return true;
  const raw = err?.meta?.driverAdapterError?.cause;
  const codes = [err.code, raw?.originalCode, raw?.code, err?.cause?.code];
  if (codes.some((c) => c === "40001" || c === "40P01")) return true;
  return /could not serialize|serialization failure|deadlock detected/i.test(
    String(err?.message || ""),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Monthly rental
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A "month" is 30 days, not a calendar month.
 *
 * Calendar months make the first charge land on the 31st and then argue about
 * February. Thirty days is what the provider's own metering behaves like, it
 * makes the paid-through arithmetic exact, and it is what the UI can state as a
 * date the contractor can check.
 */
export const RENT_PERIOD_DAYS = 30;

/**
 * How long a number keeps working after a rent debit fails.
 *
 * Seven days because the failure mode on the other side is a contractor's
 * advertised phone number disappearing while they're on a job site with no
 * signal. A week covers a working week away; it costs FieldQuo at most one week
 * of one number's rental (about $1) per delinquent company, which is a price
 * worth paying to never take someone's business line without warning.
 */
export const RENT_GRACE_DAYS = 7;

/** Warn this far ahead of a due date the balance can't cover. */
export const RENT_WARN_AHEAD_DAYS = 3;

/** Don't re-send the same warning more often than this. */
export const RENT_REMIND_EVERY_DAYS = 3;

const addDays = (date, days) => new Date(date.getTime() + days * DAY);

/** Day resolution, UTC — the idempotency key has to be stable across timezones. */
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/** The ledger ref for one number's rent for one period. Unique per (company, ref). */
export function rentRef(numberId, periodStart) {
  return `number_rent:${numberId}:${dayKey(periodStart)}`;
}

/** What this number's rent actually is. */
export function rentFor(number) {
  // The row's own price wins. A number bought at last year's rate keeps last
  // year's rate until someone changes it deliberately — that's what the column
  // is for. Falling back to the price list would silently re-price every
  // existing number the day the list moves.
  const stored = Math.round(Number(number?.monthlyCents) || 0);
  if (stored > 0) return stored;
  return monthlyCentsFor(number?.numberType);
}

/**
 * What should happen to this number today?
 *
 * Pure: a row, a balance, a clock. Every branch is reachable from a check script
 * without a database, which is the only way the "what happens when the balance
 * runs dry mid-month" path gets tested at all — it is, by definition, the path
 * nobody exercises by hand.
 *
 * @param available  is voice_receptionist still offered to this company?
 *                   Defaults true so every existing caller and every test that
 *                   isn't about availability behaves exactly as before.
 *
 * @returns { action, ... }
 *   none          nothing due
 *   charge        due and affordable — debit and advance paid-through
 *   warn_soon     due within a few days and the balance won't cover it
 *   grace_start   due, unaffordable, first time — number KEEPS WORKING, warn
 *   grace_remind  still unaffordable, and it's been a few days since we said so
 *   grace_wait    still unaffordable, already warned recently — say nothing
 *   release       grace has run out — the number goes back
 *   skip          not an active rented number (porting, released, no rental),
 *                 or FieldQuo has withdrawn the feature
 */
export function rentDecision({ number, balanceCents, now = new Date(), available = true }) {
  if (!number?.id) return { action: "skip", reason: "no_number" };

  // ── FieldQuo withdrew the feature ────────────────────────────────────────
  //
  // Checked FIRST, above every other branch, because the two things this cron
  // can do to a number are both wrong once the platform has switched voice off
  // for this company:
  //
  //   charging  — taking a contractor's prepaid balance for a month in which
  //               FieldQuo's own decision stopped them using the thing. That is
  //               billing for nothing, and it is not recoverable by apologising.
  //   releasing — handing back the phone number the contractor advertises,
  //               because a switch WE flipped stopped the rent being paid. A
  //               released number cannot be got back. It is the "turning a
  //               feature off must never delete data" rule at its sharpest: the
  //               call records, the agent and the credit balance all survive a
  //               withdrawal, and the number has to as well.
  //
  // So: nothing happens. rentPaidThroughAt is deliberately NOT advanced, so no
  // month is silently marked paid — the row simply stops moving, and FieldQuo
  // carries the provider's rental for as long as it has withheld the feature.
  // That cost is in the right place; FieldQuo made the decision.
  //
  // On switching back on, the existing arrears branch below takes over: a pause
  // longer than one period is forgiven wholesale (`forgaveArrears`), and a
  // shorter one bills a single period. It cannot compound.
  if (!available) return { action: "skip", reason: "feature_unavailable" };

  // Porting rows carry a price but nothing is rented yet — the port is a request
  // a human actions, and charging for a number that doesn't exist would be
  // charging for a wait. Rent starts when it goes active, which the null
  // paid-through below then treats as due immediately.
  if (number.status !== "active") return { action: "skip", reason: `status_${number.status}` };

  const cents = rentFor(number);
  if (!(cents > 0)) return { action: "skip", reason: "no_rental" };

  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  const affordable = balance >= cents;

  // Null paid-through means never charged: a number from before rent billing
  // existed, or a port that just went live. Due now, and it goes through exactly
  // the same warn-then-grace path, so nobody is surprised by the catch-up.
  const dueAt = number.rentPaidThroughAt ? new Date(number.rentPaidThroughAt) : new Date(now);
  const graceUntil = number.rentGraceUntilAt ? new Date(number.rentGraceUntilAt) : null;
  const warnedAt = number.rentWarnedAt ? new Date(number.rentWarnedAt) : null;

  if (now < dueAt) {
    // Not due. Say something only if it's close AND they can't cover it — a
    // heads-up while there's still time to act is the difference between a
    // prepaid service and a trap.
    if (!affordable && dueAt.getTime() - now.getTime() <= RENT_WARN_AHEAD_DAYS * DAY) {
      const quiet = warnedAt && now.getTime() - warnedAt.getTime() < RENT_REMIND_EVERY_DAYS * DAY;
      return quiet
        ? { action: "grace_wait", reason: "warned_recently", dueAt, cents, balanceCents: balance }
        : { action: "warn_soon", dueAt, cents, balanceCents: balance, shortfallCents: cents - balance };
    }
    return { action: "none", dueAt, cents, balanceCents: balance };
  }

  if (affordable) {
    // Advance from the period that just ended, so paying late doesn't buy extra
    // time. The exception is a long outage — more than a whole period behind
    // means OUR cron didn't run, and billing arrears for a gap we caused would
    // drain a contractor's balance for months they may not have used.
    const fromDue = addDays(dueAt, RENT_PERIOD_DAYS);
    const paidThroughAt = fromDue > now ? fromDue : addDays(now, RENT_PERIOD_DAYS);
    return {
      action: "charge",
      cents,
      balanceCents: balance,
      periodStart: dueAt,
      paidThroughAt,
      ref: rentRef(number.id, dueAt),
      forgaveArrears: fromDue <= now,
    };
  }

  if (!graceUntil) {
    return {
      action: "grace_start",
      cents,
      balanceCents: balance,
      shortfallCents: cents - balance,
      graceUntil: addDays(now, RENT_GRACE_DAYS),
    };
  }

  if (now >= graceUntil) {
    return { action: "release", cents, balanceCents: balance, graceUntil };
  }

  const quiet = warnedAt && now.getTime() - warnedAt.getTime() < RENT_REMIND_EVERY_DAYS * DAY;
  return quiet
    ? { action: "grace_wait", reason: "warned_recently", cents, balanceCents: balance, graceUntil }
    : { action: "grace_remind", cents, balanceCents: balance, shortfallCents: cents - balance, graceUntil };
}

/**
 * Execute today's decision for one number.
 *
 * The cron stays thin on purpose, the same way /api/cron/voice-outbound does:
 * the judgement lives here so a second caller (a platform console "bill now", a
 * backfill) can reuse it without re-deriving the rules.
 */
export async function billNumberRent(number, { now = new Date(), origin } = {}) {
  const balanceCents = await balanceFor(number.companyId);
  // Availability is resolved here rather than in the cron for the same reason
  // everything else is: a second caller ("bill now" from the console, a
  // backfill) must not be able to bill a company whose feature FieldQuo has
  // withdrawn just by forgetting to ask.
  const available = await featureAllowsSpend(number.companyId, "voice_receptionist");
  const decision = rentDecision({ number, balanceCents, now, available });

  switch (decision.action) {
    case "charge": {
      const entry = await debitCredit({
        companyId: number.companyId,
        cents: decision.cents,
        kind: "number_rent",
        ref: decision.ref,
        note: `Number rental — ${dayKey(decision.periodStart)} to ${dayKey(decision.paidThroughAt)}`,
      });
      // Written whether or not the debit was new: a ref collision means another
      // run already charged this period, and the paid-through still has to move
      // or the same period retries forever.
      await db.voicePhoneNumber.update({
        where: { id: number.id },
        data: {
          rentPaidThroughAt: decision.paidThroughAt,
          // Paid up: the past-due state is over, and the next warning should
          // start from silence rather than from a stale timestamp.
          rentGraceUntilAt: null,
          rentWarnedAt: null,
        },
      });
      return { ...decision, charged: Boolean(entry) };
    }

    case "grace_start":
    case "warn_soon":
    case "grace_remind": {
      const data = { rentWarnedAt: now };
      if (decision.action === "grace_start") data.rentGraceUntilAt = decision.graceUntil;
      await db.voicePhoneNumber.update({ where: { id: number.id }, data });
      const sent = await notifyRent(number, decision, { origin });
      return { ...decision, notified: sent };
    }

    case "release": {
      // ── One release path, shared with the contractor's own button ─────────
      //
      // This used to do it by hand: DELETE at the provider, then trust the 200
      // and write the row. Trusting the 200 is the failure the whole voice side
      // has been bitten by twice (see syncNumberAttachment) — a success status
      // from somebody else's service is not evidence of a state. So it goes
      // through lib/voice/numberRelease.js, which reads the number back and
      // only lets the row move to `released` once the provider answers 404.
      //
      // Copying it here instead would have been the copy that rots: this branch
      // runs unattended, at most once per delinquent company, and nobody would
      // ever have watched it.
      const outcome = await releaseHeldNumber(number, { now });
      if (!outcome.ok) {
        // Logged and retried tomorrow — the row stays active so we try again,
        // because giving up here means paying rent on it indefinitely.
        //
        // `still_present` and `unconfirmed` are logged distinctly from a
        // refusal on purpose: both mean the DELETE was accepted and the number
        // may already be gone while our row still says active. Tomorrow's run
        // re-DELETEs it, which a 404 then confirms — and /platform/voice-numbers
        // shows it in the meantime.
        await recordError({
          area: "voice-rent",
          message: `Couldn't release ${number.e164}: ${outcome.reason}${outcome.message ? ` — ${outcome.message}` : ""}`,
          companyId: number.companyId,
        });
        return { ...decision, action: "release_failed", reason: outcome.reason };
      }

      const sent = await notifyRent(number, decision, { origin });
      return { ...decision, released: true, notified: sent };
    }

    default:
      return decision;
  }
}

/**
 * Tell them, in the one email family that is NOT white-labelled.
 *
 * FieldQuo is the vendor here and the contractor is the customer, so this looks
 * like FieldQuo — the same reasoning as the subscription emails it shares a
 * builder with. Never throws: the ledger write has already committed, and a
 * mailbox problem must not roll it back or make the cron retry the charge.
 */
async function notifyRent(number, decision, { origin } = {}) {
  try {
    const company = await db.company.findUnique({
      where: { id: number.companyId },
      select: { name: true, email: true },
    });
    const to = company?.email || (await ownerEmailFor(number.companyId));
    if (!to) {
      await recordError({
        area: "voice-rent",
        message: "No address to warn about the number rental",
        companyId: number.companyId,
      });
      return false;
    }

    const base = origin || "https://www.fieldquo.com";
    const money = (c) => `$${(Math.max(0, Number(c) || 0) / 100).toFixed(2)}`;
    const date = (d) => new Date(d).toLocaleDateString("en-CA", { dateStyle: "medium" });
    const num = number.publicNumber || number.e164;

    const copy = {
      warn_soon: {
        heading: "Your number's rental is due soon",
        sub: num,
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} comes out of your phone credit on ${date(decision.dueAt)}, and there isn't enough on the balance to cover it.`,
          "Top up before then and nothing changes. If it isn't covered, the number keeps working for a week while you sort it out — we'll say so again if that happens.",
        ],
      },
      grace_start: {
        heading: "We couldn't take your number's rental",
        sub: num,
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} was due today and your phone credit is ${money(decision.balanceCents)}.`,
          `<strong>Your number still works.</strong> It keeps working until ${date(decision.graceUntil)}. If the balance still won't cover the rental then, the number is released and you lose it — so anything printed on a van or a lawn sign would stop ringing.`,
        ],
      },
      grace_remind: {
        heading: "Your number will be released soon",
        sub: num,
        paragraphs: [
          `${num} is still unpaid — the rental is ${money(decision.cents)} and your credit is ${money(decision.balanceCents)}.`,
          `It stops working on ${date(decision.graceUntil)} and cannot be brought back afterwards; a released number goes back to the carrier's pool and someone else can take it.`,
        ],
      },
      release: {
        heading: "Your number has been released",
        sub: num,
        paragraphs: [
          `${num} has been released — the rental went unpaid past the ${RENT_GRACE_DAYS}-day grace period we wrote to you about.`,
          // Stated flatly because it is now proved: the row only reaches
          // `released` after the provider has answered 404 for it. The old
          // hedge ("marked released on your account") existed for the case
          // where the DELETE returned 200 and nobody looked; that case no
          // longer reaches this email.
          "The number is gone from your account. You can set up a new one from the receptionist settings whenever you're ready, and if you were forwarding your own number to it, that forwarding now goes nowhere — turn it off with ##002# from your phone.",
        ],
      },
    }[decision.action];

    if (!copy) return false;

    const { subject, html } = buildPlatformNotice({
      heading: copy.heading,
      sub: copy.sub,
      subject: `${copy.heading} — ${company?.name || "FieldQuo"}`,
      paragraphs: copy.paragraphs,
      facts: [
        ["Number", num],
        ["Monthly rental", money(decision.cents)],
        ["Your phone credit", money(decision.balanceCents)],
        ...(decision.graceUntil ? [["Works until", date(decision.graceUntil)]] : []),
        ...(decision.dueAt ? [["Due", date(decision.dueAt)]] : []),
      ],
      cta: { url: `${base}/app/settings/voice`, label: "Add credit" },
    });

    const result = await sendEmail({ from: await getPlatformFrom(), to, subject, html });
    return !result?.error && !result?.skipped;
  } catch (err) {
    await recordError({
      area: "voice-rent",
      message: `Rental notice failed: ${err?.message}`,
      companyId: number?.companyId,
    });
    return false;
  }
}

/**
 * The rental facts the settings screen needs, shaped for display.
 *
 * Derived here rather than in the page so "past due" means the same thing in the
 * UI, the email and the cron. `minutes` is included because a balance in dollars
 * is not what a contractor is deciding about.
 */
export function rentStatus(number, balanceCents, now = new Date()) {
  if (!number || number.status !== "active") return null;
  const cents = rentFor(number);
  if (!(cents > 0)) return null;

  const decision = rentDecision({ number, balanceCents, now });
  const pastDue = ["grace_start", "grace_remind", "grace_wait", "release"].includes(decision.action)
    && Boolean(number.rentGraceUntilAt || decision.action === "grace_start");

  return {
    monthlyCents: cents,
    dueAt: number.rentPaidThroughAt || null,
    graceUntil: number.rentGraceUntilAt || null,
    pastDue,
    // "Will it survive the next charge?" — the question the contractor is
    // actually asking, answered before it's too late to act on.
    coversNext: Number(balanceCents) >= cents,
    minutes: minutesFor(balanceCents, number.numberType),
  };
}
