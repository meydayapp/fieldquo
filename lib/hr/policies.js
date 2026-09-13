// lib/hr/policies.js
//
// Company policies and the signatures under them.
//
// ══ A signed version is never rewritten ════════════════════════════════════
//
// The whole value of "Dana acknowledged the vehicle policy on 3 March" is
// that the text she acknowledged can be produced. So the text of every
// published version is frozen in CompanyPolicyVersion the moment it is
// published, the acknowledgement stores the version number AND a hash of
// the frozen text (the same tamper-evidence Quote.signature carries), and
// an edit to the body after anybody has signed creates version N+1 — the
// old row is untouched and everybody is asked again. `nextVersionFor()` is
// that decision, pure, and scripts/check-hr.mjs executes it both ways.
//
// A body edit BEFORE anybody has signed corrects the draft in place: a typo
// fixed ten minutes after publishing is not a new policy, and asking twenty
// people to re-sign over a comma would teach them to sign without reading.
//
// ══ Publish scope ══════════════════════════════════════════════════════════
//
// `audienceTitles` empty = everybody on the roster. Otherwise a worker is in
// scope when their `Worker.title` matches one, case-insensitively — the
// title is free text (lib/team/personLabel.js), so the match is on the
// normalised string, never an id. A worker with no title is in scope only
// for "everybody" policies.
import { createHash } from "crypto";

export const POLICY_TITLE_MAX = 120;
export const POLICY_BODY_MAX = 20000;

/** sha256 hex of exactly what the reader saw. */
export function policyHash(title, body) {
  return createHash("sha256").update(`${title}\n\n${body}`).digest("hex");
}

/** Title/body as the browser sent them, or an error. */
export function parsePolicyBody(body, { creating = false } = {}) {
  const out = {};
  if (creating || body?.title !== undefined) {
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, POLICY_TITLE_MAX) : "";
    if (!title) return { error: "The policy needs a title." };
    out.title = title;
  }
  if (creating || body?.body !== undefined) {
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) return { error: "The policy needs some text." };
    if (text.length > POLICY_BODY_MAX) return { error: `A policy can hold at most ${POLICY_BODY_MAX} characters.` };
    out.body = text;
  }
  if (body?.requiresAcknowledgement !== undefined) out.requiresAcknowledgement = body.requiresAcknowledgement !== false;
  if (body?.audienceTitles !== undefined) {
    if (!Array.isArray(body.audienceTitles)) return { error: "The audience must be a list of job titles." };
    const titles = [...new Set(body.audienceTitles.map((t) => (typeof t === "string" ? t.trim().slice(0, 60) : "")).filter(Boolean))];
    out.audienceTitles = titles.slice(0, 40);
  }
  if (body?.effectiveFrom !== undefined && body.effectiveFrom !== null && body.effectiveFrom !== "") {
    const d = new Date(body.effectiveFrom);
    if (Number.isNaN(d.getTime())) return { error: "The effective date isn't a date." };
    out.effectiveFrom = d;
  }
  if (body?.templateKey !== undefined) out.templateKey = typeof body.templateKey === "string" ? body.templateKey.slice(0, 40) : null;
  return { data: out };
}

/**
 * The version decision for an edit.
 *
 * @param policy   { version, title, body }
 * @param patch    the parsed edit
 * @param opts     { signedVersions: Set<number> } — versions with ≥1 signature
 * @returns {{ version, newVersion: boolean, title, body }}
 *   `newVersion` true means: write version+1, freeze a new
 *   CompanyPolicyVersion, and every acknowledgement is stale. False means
 *   correct in place — but ONLY when nobody has signed the current version.
 */
export function nextVersionFor(policy, patch, { signedVersions = new Set() } = {}) {
  const title = patch.title ?? policy.title;
  const body = patch.body ?? policy.body;
  const textChanged = title !== policy.title || body !== policy.body;
  const currentSigned = signedVersions.has(policy.version);
  if (!textChanged) return { version: policy.version, newVersion: false, title, body };
  if (!currentSigned) return { version: policy.version, newVersion: false, title, body };
  return { version: policy.version + 1, newVersion: true, title, body };
}

/** Whether the version row's frozen text may be overwritten. It never may
 *  once signed; exported so the check can assert the invariant by name. */
export function mayRewriteVersion(version, signedVersions) {
  return !signedVersions.has(version);
}

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

/** Is this worker in the policy's publish scope? */
export function policyAppliesTo(policy, worker) {
  const titles = Array.isArray(policy?.audienceTitles) ? policy.audienceTitles : [];
  if (titles.length === 0) return true;
  const mine = norm(worker?.title);
  if (!mine) return false;
  return titles.some((t) => norm(t) === mine);
}

/** Has this worker signed the CURRENT version? */
export function acknowledgedCurrent(policy, acknowledgements) {
  return (acknowledgements || []).some((a) => a.policyId === policy.id && a.policyVersion === policy.version);
}

/**
 * The policies a worker still owes a signature on.
 *
 * @param policies         active (non-archived) CompanyPolicy rows
 * @param worker           { title }
 * @param acknowledgements the worker's own PolicyAcknowledgement rows
 */
export function pendingPolicies(policies, worker, acknowledgements) {
  return (policies || []).filter(
    (p) => !p.archivedAt && p.requiresAcknowledgement && policyAppliesTo(p, worker) && !acknowledgedCurrent(p, acknowledgements),
  );
}

/**
 * Validate an acknowledgement: a typed name, and the version and hash the
 * screen showed must be the CURRENT ones — a stale tab that signs an old
 * text is refused, because what it signed is not what is in force.
 */
export function parseAcknowledgement(body, policy) {
  const signatureName = typeof body?.signatureName === "string" ? body.signatureName.trim().slice(0, 80) : "";
  if (!signatureName) return { error: "Type your full name to acknowledge the policy." };
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version !== policy.version) {
    return { error: "This policy has changed since you opened it. Reload and read the new version." };
  }
  const expected = policyHash(policy.title, policy.body);
  if (body?.bodyHash !== undefined && body.bodyHash !== expected) {
    return { error: "This policy has changed since you opened it. Reload and read the new version." };
  }
  return { data: { signatureName, policyVersion: version, bodyHash: expected } };
}

// The database-backed counts for the employee home — pendingPolicyCount,
// pendingNoteCount — live in lib/hr/pending.js, which imports the Prisma
// client. This module is imported by client components (the screens read
// the kind lists and the parsers), so it must stay free of a db import,
// even a lazy one: Turbopack bundles a dynamic import("@/lib/db") into the
// browser graph and the build fails on `pg` wanting `dns`.
