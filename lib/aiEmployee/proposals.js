// lib/aiEmployee/proposals.js
//
// The proposals inbox: what the employee wanted to do and was not allowed to
// do alone, waiting for a person.
//
// ══ Approving runs the same tool, the same way ═════════════════════════════
//
// executeProposal is the ONLY thing that turns a pending row into an action,
// and it does it by calling lib/aiEmployee/tools.js's runToolForCompany with
// the proposal's own companyId — the same implementation map, the same
// injection order, the same argument shape the live reply uses. There is no
// "approve" implementation of book_appointment; there is book_appointment.
//
// ══ Bound to what the person read ══════════════════════════════════════════
//
// The approve request carries the hash of the arguments the screen showed (or
// the edited ones the person typed). The route recomputes the hash of what
// it is about to execute and refuses on a mismatch, so a proposal cannot be
// re-armed with different arguments between the preview and the yes. See
// permission.js's argsHash.
//
// ══ Stale is checked at the moment of the yes ══════════════════════════════
//
// From the clock, never from the row's status: a booking approved after its
// slot has started is marked stale and NOT executed. A van sent to a slot
// that has passed is worse than no van.
//
// ══ Tenant ═════════════════════════════════════════════════════════════════
//
// Every read here takes companyId and puts it in the where. The route gets
// that id from the member's session. A proposal of company A, approved by a
// member of company B, is `unknown_proposal` — the row is not found, because
// it is looked up under B.

import { db } from "@/lib/db";
import { runToolForCompany, proposalExpiry, riskOf } from "./tools";
import { argsHash } from "./permission";
import { notifyEvent } from "@/lib/notifications/notify";

export const PROPOSAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
  STALE: "stale",
  FAILED: "failed",
});

/** How much of the conversation is kept as the reason. */
const EXCERPT_TURNS = 6;
const EXCERPT_CHARS = 1500;

/** The last few turns, as text a person can read in a list. */
export function excerptOf(history = []) {
  return (history || [])
    .slice(-EXCERPT_TURNS)
    .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${String(m.content || "").trim()}`)
    .join("\n")
    .slice(0, EXCERPT_CHARS);
}

/**
 * Write one proposal. Called by respond.js after the reply row exists.
 *
 * @returns the id, or null on a bookkeeping failure (logged, never thrown —
 *          the reply that carried "someone will confirm" has already been
 *          composed, and the honest failure here is a missing row a person
 *          can see is missing, not a 500 on a webhook).
 */
export async function createProposal(
  { companyId, employeeId, threadId = null, replyId = null, channel = "meta", name, args, risk, history = [] },
  { db: prisma = db, notify = notifyEvent } = {},
) {
  try {
    const row = await prisma.aiEmployeeProposal.create({
      data: {
        companyId,
        employeeId,
        threadId,
        replyId,
        channel,
        tool: name,
        args: args && typeof args === "object" ? args : {},
        risk: risk || riskOf(name),
        excerpt: excerptOf(history) || null,
        status: PROPOSAL_STATUS.PENDING,
        expiresAt: proposalExpiry(name, args),
      },
      select: { id: true },
    });
    // The badge in the app's notifications. Best effort, like every notify.
    await notify({
      companyId,
      type: "ai_employee.proposal",
      entityId: row.id,
      params: { tool: name, channel },
    }).catch(() => {});
    return row.id;
  } catch (err) {
    console.error("[aiEmployee] failed to record proposal:", err?.message);
    return null;
  }
}

/** Is this proposal past the moment it made sense? Pure. */
export function isStale(proposal, now = new Date()) {
  const at = proposal?.expiresAt ? new Date(proposal.expiresAt) : null;
  return Boolean(at && !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime());
}

/**
 * The public shape of a proposal — what the settings screen lists. The hash
 * travels with it so the approve can be bound to exactly these arguments.
 */
export function publicProposal(row) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    threadId: row.threadId,
    channel: row.channel,
    tool: row.tool,
    args: row.args || {},
    argsHash: argsHash(row.args || {}),
    risk: row.risk,
    excerpt: row.excerpt,
    status: row.status,
    expiresAt: row.expiresAt,
    stale: row.status === PROPOSAL_STATUS.PENDING && isStale(row),
    decidedAt: row.decidedAt,
    result: row.result || null,
    failureReason: row.failureReason || null,
    createdAt: row.createdAt,
  };
}

/** Pending proposals for one company, newest first. */
export async function listProposals(companyId, { take = 50, db: prisma = db } = {}) {
  const rows = await prisma.aiEmployeeProposal.findMany({
    where: { companyId, status: PROPOSAL_STATUS.PENDING },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(publicProposal);
}

/**
 * Approve — and execute — one proposal.
 *
 * @param companyId   from the member's session. The row is read under it.
 * @param id          the proposal
 * @param args        edited arguments, or undefined to use the stored ones
 * @param expectedHash the hash of the arguments the person READ. Required.
 * @param userId      who said yes
 * @param deps        { db, runTool, now } — the check's seam
 *
 * @returns {{ ok, reason?, status, result? }}
 */
export async function executeProposal(
  { companyId, id, args, expectedHash, userId = null, language = null },
  { db: prisma = db, runTool = runToolForCompany, now = () => new Date() } = {},
) {
  if (!companyId || !id) return { ok: false, reason: "unknown_proposal", status: null };

  const row = await prisma.aiEmployeeProposal.findFirst({ where: { id, companyId } });
  if (!row) return { ok: false, reason: "unknown_proposal", status: null };
  if (row.status !== PROPOSAL_STATUS.PENDING) {
    return { ok: false, reason: "already_decided", status: row.status };
  }

  // ── The arguments that will run are the ones the person read ───────────
  const finalArgs = args && typeof args === "object" ? args : row.args || {};
  if (!expectedHash || argsHash(finalArgs) !== expectedHash) {
    return { ok: false, reason: "hash_mismatch", status: row.status };
  }

  // ── Stale, from the clock ──────────────────────────────────────────────
  //
  // Recomputed from the FINAL arguments as well as the stored expiry, so an
  // edit that moves a booking to a slot already in the past is caught too.
  const expiry = proposalExpiry(row.tool, finalArgs) || row.expiresAt;
  if (isStale({ expiresAt: expiry }, now())) {
    await prisma.aiEmployeeProposal.update({
      where: { id: row.id },
      data: { status: PROPOSAL_STATUS.STALE, decidedByUserId: userId, decidedAt: now() },
    });
    return { ok: false, reason: "stale", status: PROPOSAL_STATUS.STALE };
  }

  let result;
  try {
    // companyId from the ROW, which was read under the member's companyId —
    // never from the request body, never from the model's arguments.
    result = await runTool({ companyId: row.companyId, name: row.tool, args: finalArgs, language });
  } catch (err) {
    await prisma.aiEmployeeProposal.update({
      where: { id: row.id },
      data: {
        status: PROPOSAL_STATUS.FAILED,
        decidedByUserId: userId,
        decidedAt: now(),
        failureReason: String(err?.message || "tool_failed").slice(0, 500),
      },
    });
    return { ok: false, reason: "tool_failed", status: PROPOSAL_STATUS.FAILED };
  }

  const succeeded = result?.ok !== false;
  await prisma.aiEmployeeProposal.update({
    where: { id: row.id },
    data: {
      status: succeeded ? PROPOSAL_STATUS.APPROVED : PROPOSAL_STATUS.FAILED,
      args: finalArgs,
      decidedByUserId: userId,
      decidedAt: now(),
      result: result && typeof result === "object" ? result : { value: result ?? null },
      failureReason: succeeded ? null : String(result?.reason || "refused").slice(0, 500),
    },
  });
  return {
    ok: succeeded,
    reason: succeeded ? null : result?.reason || "refused",
    status: succeeded ? PROPOSAL_STATUS.APPROVED : PROPOSAL_STATUS.FAILED,
    result,
  };
}

/** Decline. No tool runs; the row records who and when. */
export async function declineProposal({ companyId, id, userId = null }, { db: prisma = db, now = () => new Date() } = {}) {
  const row = await prisma.aiEmployeeProposal.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
  if (!row) return { ok: false, reason: "unknown_proposal" };
  if (row.status !== PROPOSAL_STATUS.PENDING) return { ok: false, reason: "already_decided", status: row.status };
  await prisma.aiEmployeeProposal.update({
    where: { id: row.id },
    data: { status: PROPOSAL_STATUS.DECLINED, decidedByUserId: userId, decidedAt: now() },
  });
  return { ok: true, status: PROPOSAL_STATUS.DECLINED };
}
