// lib/sales/attribution.js
//
// Which FieldQuo rep brought a company in — captured once, then locked.
//
// ── Why this is pure functions plus a thin db wrapper ──────────────────────
//
// decideAttribution() and decideCorrection() touch no database and take rows
// somebody else loaded. That is not tidiness: this is the layer that decides
// whether money is owed, and every interesting case is a hostile one — a code
// that arrives twice, two reps racing the same signup, a rep pointing their
// own link at their own company. AGENTS.md says most of the real bugs in this
// repo were found by executing pure functions against hostile input rather
// than by reading them, so the deciding is separated from the writing and
// scripts/check-sales-attribution.mjs executes every branch. Same shape and
// same reason as lib/marketing/jobPhotoContext.js.
//
// The wrappers (`captureSalesAttribution`, `correctSalesAttribution`) are the
// only parts that touch `db`, and they stay thin: read fresh rows inside a
// transaction, hand them to the pure function, write what it decided.
//
// ── The three capture paths, and why they share one decision ──────────────
//
//   1. link   — /signup?sales=CODE, posted as its own `salesCode` field.
//   2. manual — a rep entering a company from their own portal.
//   3. admin  — a superadmin correcting a mistake.
//
// One waterfall, first non-null wins, and then it locks. `source` records
// which door it came through; it never changes the rules, because a rep who
// can pick a door that skips the self-dealing check is a rep who can pay
// themselves.
//
// ── What "locked" means, and the one thing it must never do ───────────────
//
// SalesAttribution.companyId is @unique, so Postgres refuses a second row.
// That is the backstop, not the guard: the guard is that a SECOND rep's touch
// is RECORDED as a SalesAttributionTouch and the signup carries on. Refusing
// or failing a contractor's signup over FieldQuo's own commission bookkeeping
// is not a trade this product makes — and keeping the losing rep's involvement
// means whichever policy the owner picks later (split, first touch, last
// touch) still has the evidence, instead of it having been discarded at the
// door. Both reasons are in the schema comment on SalesAttributionTouch.
//
// ── Null attribution is a permanent, correct state ────────────────────────
//
// All 31 companies that existed when this shipped have no row here and never
// will. "No SalesAttribution" does not mean "attribution pending" and nothing
// in this file, or downstream of it, may invent one to fill the gap.
import { db } from "@/lib/db";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";

/** The doors an attribution can come through. Anything else is refused. */
export const ATTRIBUTION_SOURCES = ["link", "manual", "admin"];

// Long enough for any slug a human would print on a card, short enough that a
// query string full of junk is refused before it reaches Postgres.
export const MAX_SALES_CODE_LENGTH = 64;

/**
 * Read a sales code off untrusted input.
 *
 * Returns `{ code, rejected }` rather than just a string, because "nobody
 * presented a code" and "somebody presented something that is not a code" are
 * different facts and only the second one is worth logging. Collapsing them
 * would either spam the error log with every ordinary signup or hide a
 * printed link that has been wrong for a month.
 *
 * Lower-cased and matched case-insensitively downstream, the same way
 * findReferrer() treats a referral code: these get retyped off business cards
 * and a capital letter is not a different rep.
 *
 * @param {unknown} raw
 * @returns {{ code: string|null, rejected: null|"too_long"|"markup" }}
 */
export function readSalesCode(raw) {
  if (typeof raw !== "string") return { code: null, rejected: null };
  const trimmed = raw.trim();
  if (!trimmed) return { code: null, rejected: null };
  if (trimmed.length > MAX_SALES_CODE_LENGTH) return { code: null, rejected: "too_long" };
  // Same second layer as the company-name guard on the signup route: `<` and
  // `>` have no business in a slug, and this value reaches an error log and a
  // platform console table. See lib/security/rejectMarkupCharacters.js for why
  // this is a second layer and not the actual fix.
  if (containsMarkupCharacters(trimmed)) return { code: null, rejected: "markup" };
  return { code: trimmed.toLowerCase(), rejected: null };
}

/**
 * May this rep be attributed anything right now?
 *
 * Deliberately NOT gated on `acceptedAt`. The schema says a rep "can be
 * attributed to from the moment they are added" — a rep who has handed out a
 * link and not yet clicked their own invite email still earned the signup, and
 * refusing it would silently move that company to nobody.
 *
 * `endedAt` is checked as well as `active` because they are set by different
 * things (a deactivation toggle versus a leaving date) and either one alone
 * means "no new attributions".
 */
export function isRepAttributable(rep) {
  return Boolean(rep) && rep.active === true && !rep.endedAt;
}

function sameEmail(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return Boolean(x) && x === y;
}

/**
 * Is this rep selling to themselves?
 *
 * Two signals, both cheap, both re-read fresh at write time by the callers
 * below — never trusted from an earlier request, because the interesting case
 * is a rep who joins the company between the check and the write.
 *
 * `repIsMember` is passed in already resolved rather than being derived from a
 * row here, because answering it needs a join (Member -> User -> email) that
 * belongs in the db wrapper, not in a function that is meant to be executable
 * without a database.
 *
 * @returns {null|"email"|"member"} why, or null if this is at arm's length
 */
export function selfDealReason({ rep, company, repIsMember }) {
  if (sameEmail(rep?.email, company?.email)) return "email";
  if (repIsMember) return "member";
  return null;
}

function verdict(outcome, extra = {}) {
  return {
    outcome,
    salesRepId: null,
    detail: null,
    // What the caller must write. Explicit so the db wrapper stays dumb: it
    // never re-derives an outcome into an action, which is where the two
    // copies of a rule start to disagree.
    writes: { attribution: false, touch: false },
    ...extra,
  };
}

/**
 * The whole waterfall, as one pure decision.
 *
 * @param {object} args
 * @param {"link"|"manual"|"admin"} args.source
 * @param {object|null} args.rep        SalesRep row, or null if the code/id
 *                                       matched nothing.
 * @param {object|null} args.company    { id, email } for the company being
 *                                       attributed.
 * @param {object|null} args.existing   the live SalesAttribution row, or null.
 * @param {boolean} args.repIsMember    is this rep a Member of that company?
 * @param {null|"too_long"|"markup"} args.codeRejected  from readSalesCode.
 * @param {boolean} args.presented      did the request carry a code or a rep
 *                                       id at all? An ordinary signup carries
 *                                       neither, and that is not a miss.
 * @returns {{outcome:string, salesRepId:string|null, detail:string|null,
 *            writes:{attribution:boolean, touch:boolean}}}
 */
export function decideAttribution({
  source,
  rep = null,
  company = null,
  existing = null,
  repIsMember = false,
  codeRejected = null,
  presented = true,
}) {
  if (!ATTRIBUTION_SOURCES.includes(source)) return verdict("invalid_source", { detail: String(source) });
  if (codeRejected) return verdict("malformed_code", { detail: codeRejected });
  // Nobody claimed this signup. The overwhelmingly common case, and the one
  // that must stay silent: null attribution is a permanent, correct state, so
  // an ordinary self-serve signup is not a gap and does not get logged as one.
  if (!presented) return verdict("no_code");
  if (!rep) return verdict("unknown_rep");
  if (!isRepAttributable(rep)) return verdict("inactive_rep", { salesRepId: rep.id });
  if (!company) return verdict("unknown_company");

  // Re-stated here rather than only at the call site: the self-dealing checks
  // come BEFORE the "is it already attributed" branch on purpose. A rep who
  // fails them earns nothing and is not recorded as a losing touch either —
  // the touch table exists to preserve a legitimate rep's involvement for a
  // split policy nobody has chosen yet, and dropping a self-deal attempt into
  // it would put a disqualified claim in the same evidence pile. The attempt
  // is logged by the caller instead.
  const self = selfDealReason({ rep, company, repIsMember });
  if (self) return verdict("self_dealing", { salesRepId: rep.id, detail: self });

  // The same code arriving twice — a reload, a retried request, a rep clicking
  // their own link to check it. Nothing to write: the row already says exactly
  // what a second one would, and a touch row would fabricate a second rep's
  // involvement out of one rep's double-click.
  if (existing && existing.salesRepId === rep.id) {
    return verdict("already_attributed", { salesRepId: rep.id });
  }

  // A different rep, on a company that is already spoken for. Recorded, never
  // refused — see the header.
  if (existing) {
    return verdict("touch", {
      salesRepId: rep.id,
      detail: existing.salesRepId,
      writes: { attribution: false, touch: true },
    });
  }

  return verdict("attribute", { salesRepId: rep.id, writes: { attribution: true, touch: false } });
}

/**
 * A superadmin correction, decided.
 *
 * Separate from decideAttribution() rather than a flag on it, because the one
 * case that function refuses — "this company already belongs to another rep" —
 * is the entire point of this one. A shared function with a `force` argument
 * would be one boolean away from the signup path being able to overwrite a
 * lock, which is the thing the lock is for.
 *
 * A correction still cannot break the self-dealing rules, and still cannot
 * point at a rep who has left: both are re-checked here on rows read fresh
 * inside the correcting transaction. A departed rep is reactivated first if a
 * historical fix genuinely needs to name them.
 */
export function decideCorrection({
  rep = null,
  company = null,
  existing = null,
  repIsMember = false,
  reason = null,
}) {
  const text = typeof reason === "string" ? reason.trim() : "";
  // An audit row whose `reason` is blank records that something happened and
  // nothing about why, which is the half that makes an audit trail worth
  // keeping. Refused rather than defaulted (AGENTS.md failure class #5).
  if (!text) return verdict("no_reason");
  if (containsMarkupCharacters(text)) return verdict("no_reason", { detail: "markup" });
  if (!rep) return verdict("unknown_rep");
  if (!isRepAttributable(rep)) return verdict("inactive_rep", { salesRepId: rep.id });
  if (!company) return verdict("unknown_company");

  const self = selfDealReason({ rep, company, repIsMember });
  if (self) return verdict("self_dealing", { salesRepId: rep.id, detail: self });

  if (existing && existing.salesRepId === rep.id) {
    return verdict("already_attributed", { salesRepId: rep.id });
  }

  return verdict("correct", {
    salesRepId: rep.id,
    detail: existing?.salesRepId || null,
    writes: { attribution: true, touch: Boolean(existing) },
  });
}

/** True when a verdict means "a code was presented and nothing was attributed". */
export function isAttributionMiss(outcome) {
  return ["malformed_code", "unknown_rep", "inactive_rep", "unknown_company", "self_dealing"].includes(
    outcome,
  );
}

// ── The db half ────────────────────────────────────────────────────────────

async function loadRep(tx, { code, salesRepId }) {
  if (salesRepId) {
    return tx.salesRep.findUnique({
      where: { id: salesRepId },
      select: { id: true, email: true, active: true, endedAt: true, code: true },
    });
  }
  if (!code) return null;
  return tx.salesRep.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: { id: true, email: true, active: true, endedAt: true, code: true },
  });
}

/**
 * Everything both write paths need, read INSIDE the caller's transaction.
 *
 * Nothing here is accepted from an earlier request. The membership join in
 * particular is the reason: "is this rep a member of this company" is true the
 * instant they accept an invite, and a value carried from the request that
 * rendered a button is exactly the stale answer this is meant to catch. Same
 * discipline as lib/migrations/writes.js's loadWritableMigration().
 */
async function loadContext(tx, { companyId, code, salesRepId }) {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { id: true, email: true },
  });
  const rep = await loadRep(tx, { code, salesRepId });
  const existing = companyId
    ? await tx.salesAttribution.findUnique({
        where: { companyId },
        select: { id: true, companyId: true, salesRepId: true, source: true, capturedAt: true },
      })
    : null;

  // Member -> User -> email. SalesRep is deliberately a third identity with no
  // User row (see the schema header), so email is the only thing the two
  // tables share. Inactive members count: someone deactivated last week is
  // still connected to the business.
  let repIsMember = false;
  if (rep?.email && company) {
    const member = await tx.member.findFirst({
      where: { companyId: company.id, user: { email: { equals: rep.email, mode: "insensitive" } } },
      select: { id: true },
    });
    repIsMember = Boolean(member);
  }

  return { company, rep, existing, repIsMember };
}

/**
 * Capture, inside a transaction the caller owns.
 *
 * Exported so a caller with a bigger transaction can enlist — and so
 * scripts/check-sales-attribution.mjs can drive the real write logic with its
 * own scripted client instead of asserting about it by reading the source.
 */
export async function captureAttributionWithin(
  tx,
  { companyId, rawCode = null, salesRepId = null, source, note = null },
) {
  const read = readSalesCode(rawCode);
  // "Something was claimed here" — a code that survived readSalesCode, a code
  // that didn't, or a rep chosen by id. Anything else is an ordinary signup
  // with no rep behind it.
  const presented = Boolean(read.code || read.rejected || salesRepId);
  const ctx = presented
    ? await loadContext(tx, { companyId, code: read.code, salesRepId })
    : { company: null, rep: null, existing: null, repIsMember: false };

  const v = decideAttribution({ source, codeRejected: read.rejected, presented, ...ctx });

  let attribution = null;
  let touch = null;
  if (v.writes.attribution) {
    attribution = await tx.salesAttribution.create({
      data: { companyId, salesRepId: v.salesRepId, source },
    });
  }
  if (v.writes.touch) {
    touch = await tx.salesAttributionTouch.create({
      data: {
        companyId,
        salesRepId: v.salesRepId,
        source,
        note: note || `Company already attributed to ${v.detail}.`,
      },
    });
  }

  return { ...v, attribution, touch };
}

/**
 * Capture an attribution for `companyId`.
 *
 * Pass `rawCode` (from a query string or a POST body) or `salesRepId` (chosen
 * from a list). Never both — a code that resolves to a different rep than the
 * id would be a silent disagreement, and there is no honest way to pick a
 * winner.
 *
 * ── The race, and why the retry is the whole guard ────────────────────────
 *
 * Two reps' links can reach the same brand-new company inside the same
 * millisecond. Both transactions read "no attribution yet", both decide
 * `attribute`, and Postgres refuses the second one on companyId @unique. That
 * refusal is caught here and the whole capture is RE-RUN: the second pass
 * re-reads, now sees the winner, and records a SalesAttributionTouch. So the
 * loser's involvement survives a race exactly as it survives an ordinary
 * second touch, rather than being lost as a swallowed P2002.
 *
 * Only P2002 is retried, and only once. Anything else propagates — a caller
 * that turns a real database failure into a silent "no attribution" is how a
 * commission goes missing with nothing in any log.
 */
export async function captureSalesAttribution({
  companyId,
  rawCode = null,
  salesRepId = null,
  source,
  note = null,
}) {
  const args = { companyId, rawCode, salesRepId, source, note };
  return withUniqueRetry((a) => db.$transaction((tx) => captureAttributionWithin(tx, a)), args);
}

/**
 * Run `runner(args)`, and run it once more if Postgres refused the write on a
 * unique constraint.
 *
 * Split out from captureSalesAttribution so the losing half of a race can be
 * EXECUTED rather than asserted about — scripts/check-sales-attribution.mjs
 * hands this a runner that fails the way a real lost race fails (read "not
 * attributed", write refused) and then succeeds, and checks that what comes
 * back is a recorded touch rather than a swallowed error. That is the one
 * guarantee here that no amount of reading the source can establish.
 */
export async function withUniqueRetry(runner, args) {
  try {
    return await runner(args);
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    return runner(args);
  }
}

/**
 * A superadmin correction, inside a transaction the caller owns.
 *
 * ── Why the old row is deleted rather than marked superseded ──────────────
 *
 * SalesAttribution.companyId is @unique and the model carries no
 * `supersededById` column, so "one company, at most one live attribution" is a
 * database fact, not a convention. There is therefore no way to hold the old
 * row and the new one at the same time. Rather than reach for the schema (it
 * belongs to another change), the old row's content is written FORWARD into
 * two places before it goes: a SalesAttributionTouch preserving the outgoing
 * rep's involvement — which is precisely what that table exists for — and the
 * SalesAttributionAudit row recording who moved it, from whom, to whom and
 * why. Nothing about the old attribution is lost; what is deleted is the
 * pointer, not the history.
 *
 * All four writes are in ONE transaction with the change they describe, the
 * discipline lib/migrations/writes.js established for the only other place
 * FieldQuo staff write into tenant-adjacent data: "the write happened" and
 * "the write is logged" must never be able to come apart.
 */
export async function correctAttributionWithin(
  tx,
  { companyId, salesRepId, actorAdminId, reason },
) {
  const ctx = await loadContext(tx, { companyId, code: null, salesRepId });
  const v = decideCorrection({ ...ctx, reason });
  if (!v.writes.attribution) return { ...v, attribution: null, touch: null, audit: null };

  const fromRepId = ctx.existing?.salesRepId || null;

  let touch = null;
  if (ctx.existing) {
    touch = await tx.salesAttributionTouch.create({
      data: {
        companyId,
        salesRepId: ctx.existing.salesRepId,
        source: ctx.existing.source,
        note: `Superseded by a superadmin correction on ${new Date().toISOString()}: ${reason.trim()}`,
      },
    });
    await tx.salesAttribution.delete({ where: { companyId } });
  }

  const attribution = await tx.salesAttribution.create({
    data: { companyId, salesRepId: v.salesRepId, source: "admin" },
  });

  const audit = await tx.salesAttributionAudit.create({
    data: {
      companyId,
      fromRepId,
      toRepId: v.salesRepId,
      actorAdminId,
      reason: reason.trim(),
    },
  });

  return { ...v, attribution, touch, audit };
}

/** The transactional wrapper around correctAttributionWithin. */
export async function correctSalesAttribution({ companyId, salesRepId, actorAdminId, reason }) {
  return db.$transaction((tx) =>
    correctAttributionWithin(tx, { companyId, salesRepId, actorAdminId, reason }),
  );
}
