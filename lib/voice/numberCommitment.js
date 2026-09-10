// lib/voice/numberCommitment.js
//
// Is this number already doing a job?
//
// ══ The incident this exists because of ═══════════════════════════════════
//
// On 2026-09-10 a contractor turned on crew texting and was given
// +17166383616 — a number FieldQuo had assigned to a SALES REP the same day.
// The company had bought no number and had US$0.00 of credit. Its activity log
// read "Crew texting turned on — crew text +17166383616", and the claim
// repointed that number's SMS webhook to /api/crew/inbound, so the rep's
// inbound texts started arriving in a customer's crew inbox.
//
// The claim path was not missing a check. It had two, and both passed:
//
//   1. "Does FieldQuo's Twilio account own this number?" — yes. It is
//      FieldQuo's rep line. That check exists to stop a contractor naming a
//      STRANGER's number, and it did its job.
//   2. "Is another company holding this as a crew line?" — no. It was not a
//      crew line at all. It was a sales line, in a different table.
//
// So the hole is the shape of the question. "Nobody else's crew line" is not
// the same as "not in use", and every number FieldQuo owns for any other
// purpose sat in the gap between them: every rep's line, every contractor's
// receptionist number.
//
// ══ Why the decision is pure and the loading is not ═══════════════════════
//
// commitmentOf() takes rows the caller has already read and returns a verdict,
// so scripts/check-number-commitment.mjs can drive every combination — a rep's
// line, another tenant's receptionist, an expired loan, the shared test line —
// without a database or a Twilio account. numberCommitment() below is the four
// queries that feed it, and nothing else.
import { db } from "@/lib/db";

/**
 * What a committed number is committed TO, and what to say about it.
 *
 * Each reason is written for the CONTRACTOR who pressed the button, not for an
 * engineer: they cannot act on "PlatformSmsNumber row exists", and telling them
 * the number belongs to a FieldQuo salesperson tells them something true about
 * somebody else's account. So every one of these says the same actionable
 * thing — this number is not available, here is what to do — and the detail
 * that matters for support goes in `kind`.
 */
export const COMMITMENT_REASONS = {
  platform:
    "That number is already in use by FieldQuo and cannot be used for crew texting. " +
    "Buy a crew number instead and it will be yours alone.",
  voice:
    "That number is already answering calls as a receptionist line. Using it for crew " +
    "texting as well would send your crew's messages to the same place. Buy a separate " +
    "crew number.",
  crew:
    "Another company is already texting its crew on that number.",
  self:
    "You are already using that number for crew texting.",
};

/**
 * The verdict. PURE.
 *
 * @param e164          the number being claimed, normalised.
 * @param sharedE164    the platform's shared test line, which IS claimable —
 *                      that is the whole point of it. Compared explicitly
 *                      rather than by "is it in PlatformSmsNumber", because it
 *                      is in that table too and would otherwise be refused by
 *                      its own gate.
 * @param platformRow   a PlatformSmsNumber for this e164, or null.
 * @param voiceRow      a VoicePhoneNumber for this e164, or null.
 * @param crewRow       a CrewInboxNumber for this e164, or null.
 * @param forCompanyId  who is asking.
 * @param now           injectable, so an expired loan is executable.
 *
 * @returns null when the number is free to claim, otherwise
 *          `{ kind, reason, sameCompany }`.
 */
export function commitmentOf({
  e164,
  sharedE164 = null,
  platformRow = null,
  voiceRow = null,
  crewRow = null,
  forCompanyId = null,
  now = new Date(),
} = {}) {
  if (!e164) return { kind: "invalid", reason: "That doesn't look like a phone number." };

  // The shared test line is lent on purpose. It is checked FIRST because it is
  // also a PlatformSmsNumber, and the platform rule below would otherwise
  // refuse the one number this feature is designed to hand out.
  const isShared = Boolean(sharedE164) && e164 === sharedE164;

  // ── Somebody else's crew line ──────────────────────────────────────────
  //
  // An EXPIRED loan is free again — that is what the expiry is for, or the
  // shared line is claimed once and gone forever.
  if (crewRow) {
    const mine = forCompanyId && crewRow.companyId === forCompanyId;
    if (mine) return { kind: "self", reason: COMMITMENT_REASONS.self, sameCompany: true };
    const expired = crewRow.expiresAt && new Date(crewRow.expiresAt) <= now;
    if (!expired) return { kind: "crew", reason: COMMITMENT_REASONS.crew, sameCompany: false };
  }

  if (isShared) return null;

  // ── FieldQuo's own line ────────────────────────────────────────────────
  //
  // THE ONE THAT WAS MISSING. A released number is free again; an active one,
  // assigned to a rep or not, is not. `assignedRepId` is deliberately NOT part
  // of this test: an unassigned sales number is still FieldQuo's inventory, and
  // handing it to a tenant means the next rep to be given it inherits a
  // customer's crew inbox.
  if (platformRow && !platformRow.releasedAt && platformRow.active !== false) {
    return { kind: "platform", reason: COMMITMENT_REASONS.platform, sameCompany: false };
  }

  // ── A receptionist line ────────────────────────────────────────────────
  //
  // Refused even for the SAME company. Twilio keeps voice and SMS webhooks
  // apart, so this would technically work — and the result is a contractor
  // whose crew's messages and whose customers' texts land in two different
  // inboxes on one number, with no way to tell which is which from the outside.
  if (voiceRow && voiceRow.status !== "released") {
    return {
      kind: "voice",
      reason: COMMITMENT_REASONS.voice,
      sameCompany: Boolean(forCompanyId && voiceRow.companyId === forCompanyId),
    };
  }

  return null;
}

/**
 * The same verdict, against the live database.
 *
 * Four reads, no writes. Called before a claim, never after — a check that runs
 * after the webhook has been repointed has already done the damage.
 */
export async function numberCommitment(
  e164,
  { forCompanyId = null, sharedE164 = null, prisma = db, now = new Date() } = {},
) {
  if (!e164) return commitmentOf({ e164: null });
  const [platformRow, voiceRow, crewRow] = await Promise.all([
    prisma.platformSmsNumber.findFirst({
      where: { e164 },
      select: { id: true, active: true, releasedAt: true, purpose: true, assignedRepId: true },
    }),
    prisma.voicePhoneNumber.findUnique({
      where: { e164 },
      select: { id: true, companyId: true, status: true },
    }),
    prisma.crewInboxNumber.findUnique({
      where: { e164 },
      select: { id: true, companyId: true, expiresAt: true },
    }),
  ]);
  return commitmentOf({ e164, sharedE164, platformRow, voiceRow, crewRow, forCompanyId, now });
}
