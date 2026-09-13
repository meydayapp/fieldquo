// lib/sales/signupProgress.js
//
// What a rep sees while the prospect they just spoke to is signing up.
//
// ══ The owner's process ═══════════════════════════════════════════════════
//
// The rep does not take a card. After a yes they text the signup link and
// STAY ON THE LINE while the contractor opens it — company details, plan,
// card — because the card step is where a signup dies, and a voice saying
// "you're not charged for a month, and cancel is one click in Settings" is
// what carries it over. For that the rep needs to SEE where the contractor
// is, on the lead panel, without asking. Until 2026-09-13 nothing recorded
// any of it: the link was per-rep (`/signup?sales=<code>`), the signup page
// kept its step in the browser's sessionStorage, and the first server-side
// fact was the Company row at the plan step. The rep read "Sign-up link
// sent" on the step list and then nothing until, maybe, a Subscription.
//
// ══ How it is recorded ════════════════════════════════════════════════════
//
// One SalesSignupProgress row per link a rep texts (lib/sales/salesSms.js
// deliverSignupLinkSms creates it and puts `&link=<token>` on the link the
// text carries). Six instants, each set ONCE — a stamp never moves back,
// and a step reported twice is the first report:
//
//   linkSentAt   the carrier accepted the text          salesSms.js
//   openedAt     the signup page loaded with the token  app/api/signup/progress (browser)
//   companyAt    the business step was submitted        app/api/signup/progress (browser)
//   planAt       Company created, card page reached     app/api/companies (server)
//   cardAt       Stripe checkout completed              lib/platform/stripeBilling.js
//   completedAt  Subscription row written               lib/platform/stripeBilling.js
//
// The two browser-reported steps are the only ones a stranger can write,
// and they can write nothing else: the public endpoint accepts a token and
// one of two step names, stamps a null column, and answers 204 whether or
// not the token exists — so it leaks nothing and cannot be replayed into a
// later step. Everything from "plan" on is the server's own fact.
//
// ══ Scope ═════════════════════════════════════════════════════════════════
//
// A rep sees progress only for links THEY sent: the row carries
// `salesRepId`, and signupProgressForRep() reads by (leadId, salesRepId),
// so another rep's lead — or another rep's link to the same lead — is a
// 404, the way every other /api/sales/leads/[id] read is (lib/sales/outreach.js
// leadWhere). Nothing here reads a tenant's data; the companyId on the row
// is an id the rep already learns when the lead links.
//
// ══ "Stuck" ═══════════════════════════════════════════════════════════════
//
// A step that has not advanced for STUCK_AFTER_MS (three minutes — the
// owner's number) is "stuck at <step> for N min" on the panel. Computed
// from the last stamp and the clock, never stored: it is a reading of the
// row, not a fact about the contractor.
//
// Pure functions first, then the store functions that take a client, so
// scripts/check-signup-progress.mjs executes every step against the db stub.

import { randomBytes } from "node:crypto";

/** The steps, in order, with the column each reads. */
export const SIGNUP_STEPS = Object.freeze([
  Object.freeze({ key: "link_sent", column: "linkSentAt", labelKey: "app.salesSignupProgress.step.linkSent", label: "Link sent" }),
  Object.freeze({ key: "opened", column: "openedAt", labelKey: "app.salesSignupProgress.step.opened", label: "Opened" }),
  Object.freeze({ key: "company", column: "companyAt", labelKey: "app.salesSignupProgress.step.company", label: "Company details" }),
  Object.freeze({ key: "plan", column: "planAt", labelKey: "app.salesSignupProgress.step.plan", label: "Plan chosen" }),
  Object.freeze({ key: "card", column: "cardAt", labelKey: "app.salesSignupProgress.step.card", label: "Card entered" }),
  Object.freeze({ key: "completed", column: "completedAt", labelKey: "app.salesSignupProgress.step.completed", label: "Signed up" }),
]);

export const SIGNUP_STEP_KEYS = Object.freeze(SIGNUP_STEPS.map((s) => s.key));

/** The steps a BROWSER may report against a token. Nothing past the company form. */
export const BROWSER_REPORTABLE_STEPS = Object.freeze(["opened", "company"]);

/** Not advancing for this long is "stuck". The owner's three minutes. */
export const STUCK_AFTER_MS = 3 * 60 * 1000;

/** How often the rep's panel asks. Ten seconds while a call is live. */
export const PROGRESS_POLL_MS = 10 * 1000;

/** The query-string key the link carries the token under. */
export const LINK_TOKEN_PARAM = "link";

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** A fresh token: 16 random bytes, URL-safe, no padding. */
export function newLinkToken() {
  return randomBytes(16).toString("base64url");
}

/** Is this a token shape this module minted? Refuses anything else at the door. */
export function isLinkToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/** The step definition for a key, or null. */
export function signupStepFor(key) {
  return SIGNUP_STEPS.find((s) => s.key === key) || null;
}

/**
 * The Prisma `data` that stamps one step at `now`. The write pairs it with
 * a `where` on `<column>: null`, so a second report cannot move the first.
 */
export function signupStepData(key, now = new Date()) {
  const step = signupStepFor(key);
  if (!step) return null;
  return { [step.column]: when(now) || new Date() };
}

/**
 * What the panel draws, from the row and the clock.
 *
 * @returns {{ steps: [{ key, label, labelKey, at: string|null, done: boolean, current: boolean }],
 *            currentKey: string|null, completed: boolean, lastAt: string|null,
 *            stuck: boolean, stuckAtKey: string|null, stuckForMs: number,
 *            companyId: string|null }}
 *          `currentKey` is the LAST step reached. `stuck` is true when the
 *          signup is not complete and the last stamp is older than
 *          STUCK_AFTER_MS. `stuckForMs` is how long, for "for 3 min".
 */
export function signupProgressView(row = null, now = new Date()) {
  const at = when(now) || new Date();
  if (!row) return null;
  let currentKey = null;
  let lastAt = null;
  const steps = SIGNUP_STEPS.map((s) => {
    const stamp = when(row[s.column]);
    if (stamp) {
      currentKey = s.key;
      if (!lastAt || stamp.getTime() > lastAt.getTime()) lastAt = stamp;
    }
    return { key: s.key, label: s.label, labelKey: s.labelKey, at: stamp ? stamp.toISOString() : null, done: Boolean(stamp), current: false };
  });
  for (const s of steps) s.current = s.key === currentKey;
  const completed = Boolean(when(row.completedAt));
  const sinceMs = lastAt ? Math.max(0, at.getTime() - lastAt.getTime()) : 0;
  const stuck = !completed && Boolean(lastAt) && sinceMs >= STUCK_AFTER_MS;
  return {
    steps,
    currentKey,
    completed,
    lastAt: lastAt ? lastAt.toISOString() : null,
    stuck,
    stuckAtKey: stuck ? currentKey : null,
    stuckForMs: stuck ? sinceMs : 0,
    companyId: typeof row.companyId === "string" ? row.companyId : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Store — every function takes the client so the check can hand in a stub
// ═══════════════════════════════════════════════════════════════════════════

/** True when the client has the delegate — the schema has been pushed. */
export function signupProgressAvailable(client) {
  return Boolean(client?.salesSignupProgress && typeof client.salesSignupProgress.findFirst === "function");
}

/**
 * The row a link for this lead will carry — an open one (not yet
 * completed) reused, so a re-sent text keeps the same token and the same
 * panel; a new one otherwise. `linkSentAt` is NOT set here: the carrier has
 * not accepted anything yet. markLinkSent() does that.
 *
 * @returns the row, or null when the table is absent (the text still goes;
 *          the panel just has nothing to draw).
 */
export async function ensureSignupProgress({ client, leadId, salesRepId, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !leadId || !salesRepId) return null;
  const open = await client.salesSignupProgress.findFirst({
    where: { leadId, salesRepId, completedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (open) return open;
  return client.salesSignupProgress.create({
    data: { token: newLinkToken(), leadId, salesRepId, createdAt: when(now) || new Date() },
  });
}

/** "Link sent" — once, when the carrier accepted the text. */
export async function markLinkSent({ client, id, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !id) return 0;
  const r = await client.salesSignupProgress.updateMany({
    where: { id, linkSentAt: null },
    data: signupStepData("link_sent", now),
  });
  return r.count;
}

/**
 * A browser's report: stamp `step` on the row this token names, if that
 * column is still null. Only BROWSER_REPORTABLE_STEPS; anything else, an
 * unknown token, or a malformed one is a silent zero — the public endpoint
 * answers the same either way.
 */
export async function stampSignupStepByToken({ client, token, step, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !isLinkToken(token) || !BROWSER_REPORTABLE_STEPS.includes(step)) return 0;
  const col = signupStepFor(step).column;
  const r = await client.salesSignupProgress.updateMany({
    where: { token, [col]: null },
    data: signupStepData(step, now),
  });
  return r.count;
}

/**
 * The server's own fact at the plan step: the company exists and the card
 * page is next. Stamps `planAt` and records the companyId — and fills in the
 * two browser steps if a report never arrived (a blocked beacon must not
 * draw "Plan chosen" with "Opened" still empty — the plan step proves both).
 */
export async function stampSignupPlanByToken({ client, token, companyId, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !isLinkToken(token) || !companyId) return 0;
  const at = when(now) || new Date();
  const row = await client.salesSignupProgress.findFirst({ where: { token }, select: { id: true, openedAt: true, companyAt: true, planAt: true, companyId: true } });
  if (!row || row.planAt || row.companyId) return 0;
  const data = { planAt: at, companyId };
  if (!row.openedAt) data.openedAt = at;
  if (!row.companyAt) data.companyAt = at;
  const r = await client.salesSignupProgress.updateMany({ where: { id: row.id, planAt: null, companyId: null }, data });
  return r.count;
}

/**
 * The end: Stripe's checkout completed and the Subscription row exists.
 * Both stamps at once — they are one event in this flow — on every open row
 * for the company (there is normally one).
 */
export async function stampSignupCompletedByCompany({ client, companyId, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !companyId) return 0;
  const at = when(now) || new Date();
  const r = await client.salesSignupProgress.updateMany({
    where: { companyId, completedAt: null },
    data: { cardAt: at, completedAt: at },
  });
  return r.count;
}

/**
 * The rep's read: the newest row for THEIR link to THIS lead, as the panel
 * view — or null, which the route answers with 404 the way every other
 * lead read does. A rep never sees another rep's link.
 */
export async function signupProgressForRep({ client, leadId, salesRepId, now = new Date() } = {}) {
  if (!signupProgressAvailable(client) || !leadId || !salesRepId) return null;
  const row = await client.salesSignupProgress.findFirst({
    where: { leadId, salesRepId },
    orderBy: { createdAt: "desc" },
  });
  return row ? signupProgressView(row, now) : null;
}

/**
 * The rows the unfinished-signup check-in drafts are written from: this
 * rep's links that were OPENED and not completed. lib/sales/checkin/
 * unfinishedSignup.js decides which are due.
 */
export async function openedUnfinishedForRep({ client, salesRepId } = {}) {
  if (!signupProgressAvailable(client) || !salesRepId) return [];
  return client.salesSignupProgress.findMany({
    where: { salesRepId, openedAt: { not: null }, completedAt: null },
    orderBy: { openedAt: "asc" },
    take: 200,
  });
}

