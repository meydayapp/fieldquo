// lib/signup/salesFloor.js
//
// The db half of lib/signup/leads.js: capturing what /signup types, turning a
// quiet signup into a lead, the welcome-call and stalled-trial rows for a
// finished one, and the ONE write that puts any of them in a rep's queue.
//
// ══ Who ends up where — the owner's two rulings, 2026-09-21 ════════════════
//
//   1. "assign to sales reps manually … in the sales platform": every row an
//      UNREFERRED signup produces lands in the review folder's signup section
//      (/platform/sales/review) and reaches a rep's queue ONLY through
//      assignSignupToRep() below, pressed by a superadmin. No SalesQueueClaim
//      is written anywhere else in this file; the check greps for it.
//   2. a signup that came in on a REP'S link belongs to that rep already
//      (lib/sales/attribution.js attributes the finished company to them; the
//      unfinished one carries the same code). It never touches the folder:
//      an abandoned one becomes that rep's own SalesLead — with the Prospect
//      handed to them directly, no claim row — and a completed one is read
//      straight off the Company by /api/sales/signups.
//
// ══ `client` is a parameter ════════════════════════════════════════════════
//
// The routes and crons pass `db`; scripts/check-signup-leads.mjs passes the
// scripted db from scripts/fixtures/dbStub.mjs and executes every write path
// — including "a completed signup is never promoted" against a row that
// completes between the list read and the write. Nothing here imports from
// next.

import { checkSuppression } from "@/lib/sales/suppression";
import { isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { createSalesLead } from "@/lib/sales/leadCreate";
import { isRepAttributable } from "@/lib/sales/attribution";
import { repCanTake, requiredLanguageFor } from "@/lib/sales/leadLanguage";
import { claimExpiryFrom, claimState } from "@/lib/sales/prospectView";
import { ASSIGN_MODE, assignBatchId, lastKnownZoneFor, notifyRepAssigned } from "@/lib/sales/assignLeads";
import { localDateIn } from "@/lib/sales/queueBatch";
import { CHECKOUT_GRACE_MS } from "@/lib/signup/setupGate";
import { incompleteSignupWhere } from "@/lib/signup/abandoned";
import {
  SIGNUP_KINDS,
  SIGNUP_SOURCE,
  SIGNUP_STATUS,
  STEP_LABELS,
  WELCOME_BACKFILL_DAYS,
  contactNameOf,
  decideSignupLeadPromotion,
  emailKeyOf,
  newResumeToken,
  normaliseCapture,
  planCaptureWrite,
  prospectFromCompany,
  prospectFromSignupLead,
  signupFact,
  stalledDecision,
  unplacedSignupWhere,
  worthCapturing,
} from "@/lib/signup/leads";

/** What the resume link may hand back to the browser that holds the token. Never the row id, never the codes. */
const RESUME_SELECT = {
  email: true,
  firstName: true,
  lastName: true,
  companyName: true,
  phoneRaw: true,
  address: true,
  city: true,
  province: true,
  country: true,
  language: true,
  trades: true,
  serviceCategoryIds: true,
  stepReached: true,
  completedCompanyId: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// Capture
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One capture from the signup page. Answers nothing about the row: the
 * route returns 204 whatever happened, so the endpoint cannot be used to ask
 * "has this email started a signup". `{ ok, reason }` is for the check.
 */
export async function captureSignupLead({ client, body, now = new Date() } = {}) {
  const read = normaliseCapture(body);
  if (read.error) return { ok: false, reason: `invalid_${read.error}` };
  if (!worthCapturing(read.lead)) return { ok: false, reason: "nothing_yet" };

  const existing = await client.signupLead.findUnique({
    where: { emailKey: read.lead.emailKey },
    select: {
      id: true, firstName: true, lastName: true, companyName: true, phoneRaw: true, phoneE164: true,
      country: true, province: true, city: true, trades: true, language: true, referrer: true, utm: true,
      visitorId: true, salesCode: true, referralCode: true, stepReached: true, consentAt: true,
      completedCompanyId: true, promotedAt: true,
    },
  });
  const plan = planCaptureWrite({ existing, incoming: read.lead, now });
  if (plan.refusal) return { ok: false, reason: plan.refusal };

  if (plan.create) {
    await client.signupLead.create({
      data: { emailKey: read.lead.emailKey, resumeToken: newResumeToken(), startedAt: now, ...plan.data },
    });
    return { ok: true, reason: "created" };
  }
  // Guarded on the row still being unfinished: a Company created between the
  // read above and this write locks the row in the same instant.
  const updated = await client.signupLead.updateMany({
    where: { id: existing.id, completedCompanyId: null, promotedAt: null },
    data: plan.data,
  });
  return { ok: updated.count > 0, reason: updated.count > 0 ? "updated" : "locked" };
}

/**
 * The prefill behind a resume token — or, for a SIGNED-IN person, behind the
 * address their session proves they own — or null. Only what the person
 * typed themselves.
 *
 * The second key is the fix for the owner's own return on 2026-09-21: he
 * signed back in from a fresh session, the tab that held the draft was
 * gone, and nothing asked the server for the row that already knew he had
 * reached Plan. A session is a stronger proof of identity than the token,
 * so the same read is allowed on it. A row that finished (completedCompanyId)
 * is still returned, flagged `completed`, so the page can refuse to prefill.
 */
export async function signupLeadForResume({ client, token, email } = {}) {
  const key = email ? emailKeyOf(email) : null;
  const where = typeof token === "string" && token ? { resumeToken: token } : key ? { emailKey: key } : null;
  if (!where) return null;
  const row = await client.signupLead.findUnique({ where, select: RESUME_SELECT });
  if (!row) return null;
  return {
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    companyName: row.companyName,
    phone: row.phoneRaw,
    address: row.address,
    city: row.city,
    province: row.province,
    country: row.country,
    language: row.language,
    trades: row.trades || [],
    serviceCategoryIds: row.serviceCategoryIds || [],
    stepReached: row.stepReached,
    // The account step already created a login: the page shows "sign in
    // instead" rather than asking for a second password on the same address.
    accountExists: row.stepReached !== "account" && row.stepReached !== "business",
    completed: Boolean(row.completedCompanyId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Promotion — the cron
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The companies and prospects a SignupLead could be a duplicate of.
 * Email first (exact, normalised), then the E.164 phone. A merged-away
 * prospect does not count — its survivor does.
 */
async function findMatches({ client, lead }) {
  const emails = [lead.email, lead.emailKey].filter(Boolean);
  const phone = lead.phoneE164 || null;
  // Company.phone is stored as the contractor typed it ("613-555-0142"), not
  // E.164, so the database narrows on the last four digits and the E.164
  // comparison happens here through the same normaliser the key was made
  // with. A Prospect's phoneE164 is already normalised and compares exactly.
  const last4 = phone ? phone.slice(-4) : null;
  const [byEmail, byPhone, prospect] = await Promise.all([
    emails.length
      ? client.company.findFirst({
          where: {
            isDemo: false,
            OR: [{ email: { in: emails, mode: "insensitive" } }, { members: { some: { user: { email: { in: emails, mode: "insensitive" } } } } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    last4
      ? client.company.findMany({ where: { isDemo: false, phone: { contains: last4 } }, select: { id: true, name: true, phone: true }, take: 20 })
      : Promise.resolve([]),
    client.prospect.findFirst({
      where: {
        mergedIntoId: null,
        // Nullable: a hand-typed prospect has no provider and must still match.
        AND: [{ OR: [{ sourceProvider: null }, { sourceProvider: { not: SIGNUP_SOURCE } }] }],
        OR: [...(emails.length ? [{ email: { in: emails, mode: "insensitive" } }] : []), ...(phone ? [{ phoneE164: phone }] : [])],
      },
      select: { id: true, assignedRepId: true, claimExpiresAt: true },
    }),
  ]);
  const company = byEmail || (Array.isArray(byPhone) ? byPhone.find((c) => normalisePhone(c.phone) === phone) || null : null);
  return { company: company ? { id: company.id, name: company.name } : null, prospect };
}

/** The active rep behind a lead's sales code, else null. Read fresh, never trusted from the row. */
async function referredRepFor({ client, lead }) {
  if (!lead.salesCode) return null;
  const rep = await client.salesRep.findUnique({
    where: { code: lead.salesCode },
    select: { id: true, name: true, active: true, endedAt: true, sellsIn: true, language: true },
  });
  return rep && isRepAttributable(rep) ? rep : null;
}

/**
 * Promote every SignupLead that is due. Returns counts per reason so the cron
 * response says what it did and what it refused.
 *
 * The verdict is re-taken against a fresh read inside the write's WHERE
 * (`completedCompanyId: null, promotedAt: null`): a person who finishes
 * checkout between the list and the write is a customer, and the promotion
 * writes nothing.
 */
/**
 * Promote ONE SignupLead — the cron's loop body, and the on-demand path
 * behind "assign for callback" on /platform/signups (`immediate`, see
 * decideSignupLeadPromotion). One function so the two cannot drift: the
 * duplicate search, the referred-rep rule and every guard on the write are
 * the same whichever caller asks.
 *
 * @returns { action, reason, prospectId?, salesRepId? }
 *   action is the verdict's, plus "completed_before_write" when the row
 *   finished between the read and the write.
 */
export async function promoteOneSignupLead({ client, lead, now = new Date(), immediate = false } = {}) {
  // Quick refusals need no reads.
  const pre = decideSignupLeadPromotion({ lead, now, immediate });
  if (pre.action === "wait") return { action: "wait", reason: pre.reason };
  if (pre.action === "skip" && pre.reason !== "no_lead" && lead.prospectId) {
    // Already on the floor (or a rep's): the on-demand caller wants the row.
    return { action: "skip", reason: pre.reason, prospectId: lead.prospectId, salesRepId: lead.referredRepId || null };
  }

  const [emailVerdict, phoneVerdict] = await Promise.all([
    checkSuppression(client, { channel: "email", email: lead.email }),
    lead.phoneE164 ? checkSuppression(client, { channel: "phone", phone: lead.phoneE164 }) : Promise.resolve(null),
  ]);
  const suppressed = Boolean(emailVerdict?.suppressed || phoneVerdict?.suppressed);
  const { company, prospect } = await findMatches({ client, lead });
  const referredRep = await referredRepFor({ client, lead });

  const verdict = decideSignupLeadPromotion({ lead, now, suppressed, matchingCompany: company, matchingProspect: prospect, referredRep, immediate });
  if (verdict.action === "wait") return { action: "wait", reason: verdict.reason };

  // ── The guard on every write: still unfinished, still unpromoted ──────
  const guard = { id: lead.id, completedCompanyId: null, promotedAt: null };

  if (verdict.action === "skip") {
    await client.signupLead.updateMany({ where: guard, data: { skipReason: verdict.reason } });
    return { action: "skip", reason: verdict.reason };
  }
  if (verdict.action === "link_company") {
    await client.signupLead.updateMany({ where: guard, data: { completedCompanyId: verdict.companyId, skipReason: "company_exists" } });
    return { action: "link_company", reason: verdict.reason, companyId: verdict.companyId };
  }
  if (verdict.action === "link_prospect") {
    // The existing row is flagged and linked; its status, trade and holder
    // are left exactly as they were. It shows in the folder's signup
    // section only while nobody holds it (unplacedSignupWhere).
    await client.$transaction(async (tx) => {
      const linked = await tx.signupLead.updateMany({ where: guard, data: { prospectId: verdict.prospectId, promotedAt: now } });
      if (linked.count === 0) return;
      await tx.prospect.update({
        where: { id: verdict.prospectId },
        data: { hot: true, signupKind: "abandoned", signupStateAt: now, signupStateReason: prospectFromSignupLead(lead, { now }).signupStateReason },
      });
    });
    return { action: "link_prospect", reason: verdict.reason, prospectId: verdict.prospectId };
  }
  if (verdict.action === "rep_lead") {
    // The referring rep's own lead. The Prospect is handed to them outright
    // — assignedRepId with NO expiry, the schema's "worked" shape — so it
    // is on their queue and never lapses into the owner's folder; no claim
    // row is written (the owner never assigned it, and the sweeps that read
    // claims have nothing to release).
    let createdId = null;
    try {
      await client.$transaction(async (tx) => {
        const created = await tx.prospect.create({
          data: { ...prospectFromSignupLead(lead, { now }), assignedRepId: verdict.salesRepId, assignedAt: now, claimExpiresAt: null },
          select: { id: true, businessName: true, email: true, phoneE164: true, country: true, province: true },
        });
        const salesLead = await createSalesLead(tx, {
          salesRepId: verdict.salesRepId,
          source: created,
          contactName: contactNameOf(lead),
          notes: `Started a FieldQuo signup on your link and stopped at ${prospectFromSignupLead(lead).signupStateReason.replace(/^Stopped at /, "")}.`,
        });
        const linked = await tx.signupLead.updateMany({
          where: guard,
          data: { prospectId: created.id, promotedLeadId: salesLead.id, promotedAt: now, referredRepId: verdict.salesRepId },
        });
        if (linked.count === 0) throw new Error("completed_before_write");
        createdId = created.id;
      });
    } catch (err) {
      if (err?.message === "completed_before_write") return { action: "completed_before_write", reason: "completed_before_write" };
      throw err;
    }
    return { action: "rep_lead", reason: verdict.reason, prospectId: createdId, salesRepId: verdict.salesRepId };
  }
  // ── The folder ─────────────────────────────────────────────────────────
  let prospectId = null;
  try {
    await client.$transaction(async (tx) => {
      const created = await tx.prospect.upsert({
        where: { sourceProvider_sourceRecordId: { sourceProvider: SIGNUP_SOURCE, sourceRecordId: lead.id } },
        create: prospectFromSignupLead(lead, { now }),
        update: {},
        select: { id: true },
      });
      const linked = await tx.signupLead.updateMany({ where: guard, data: { prospectId: created.id, promotedAt: now } });
      if (linked.count === 0) throw new Error("completed_before_write");
      prospectId = created.id;
    });
  } catch (err) {
    if (err?.message === "completed_before_write") return { action: "completed_before_write", reason: "completed_before_write" };
    throw err;
  }
  return { action: "prospect", reason: verdict.reason, prospectId };
}

/**
 * Promote every SignupLead that is due. Returns counts per reason so the cron
 * response says what it did and what it refused.
 *
 * The verdict is re-taken against a fresh read inside the write's WHERE
 * (`completedCompanyId: null, promotedAt: null`): a person who finishes
 * checkout between the list and the write is a customer, and the promotion
 * writes nothing.
 */
export async function promoteSignupLeads({ client, now = new Date(), limit = 200 } = {}) {
  const rows = await client.signupLead.findMany({
    where: { completedCompanyId: null, promotedAt: null, skipReason: null, phoneE164: { not: null } },
    orderBy: { lastSeenAt: "asc" },
    take: limit,
  });
  const counts = {};
  const note = (k) => { counts[k] = (counts[k] || 0) + 1; };
  const written = [];

  for (const lead of rows) {
    const result = await promoteOneSignupLead({ client, lead, now });
    note(result.reason);
    if (result.action === "wait" || result.action === "skip" || result.action === "link_company" || result.action === "completed_before_write") continue;
    written.push({ leadId: lead.id, action: result.action, ...(result.salesRepId ? { salesRepId: result.salesRepId } : {}) });
  }
  return { considered: rows.length, written, counts };
}

// ═══════════════════════════════════════════════════════════════════════════
// A company was created
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called by app/api/companies/route.js once the Company row is committed.
 * Never throws: a contractor's signup does not depend on FieldQuo's own
 * lead bookkeeping (the same rule recordSignupOrigin lives by).
 *
 *   · the SignupLead at the owner's address is linked as completed — and if
 *     it had already been promoted to a HOT prospect, that prospect becomes
 *     the welcome-call row (hot off, kind "new", company linked): the person
 *     the owner was about to hand out just finished on their own.
 *   · a company nobody referred gets a welcome-call Prospect for the folder.
 *     `referred` is the route's own knowledge — a rep code that attributed,
 *     a referral code that applied, a promo — and a referred company gets
 *     nothing here: it is the rep's, or the referrer's.
 *
 * @returns { linkedLeadId, prospectId, reason }
 */
export async function recordSignupCompletion({ client, company, ownerEmail = null, ownerName = null, referred = false, now = new Date() } = {}) {
  try {
    if (!company?.id || company.isDemo) return { linkedLeadId: null, prospectId: null, reason: company?.isDemo ? "demo" : "no_company" };
    const keys = [...new Set([emailKeyOf(ownerEmail), emailKeyOf(company.email)].filter(Boolean))];
    let lead = null;
    if (keys.length) {
      lead = await client.signupLead.findFirst({ where: { emailKey: { in: keys }, completedCompanyId: null }, select: { id: true, prospectId: true, promotedLeadId: true } });
      if (lead) {
        await client.signupLead.updateMany({ where: { id: lead.id, completedCompanyId: null }, data: { completedCompanyId: company.id, stepReached: "checkout", lastSeenAt: now } });
      }
    }
    if (referred) {
      // Theirs already. The hot prospect, if one was written before the
      // company finished, is closed off so nobody rings a rep's customer.
      if (lead?.prospectId) {
        await client.prospect.update({ where: { id: lead.prospectId }, data: { hot: false, signupKind: null, signupStateAt: now, signupStateReason: "Completed signup on a rep's link", companyId: company.id } });
      }
      return { linkedLeadId: lead?.id || null, prospectId: null, reason: "referred" };
    }
    const welcome = prospectFromCompany(company, { now, ownerName });
    if (lead?.prospectId) {
      const row = await client.prospect.update({
        where: { id: lead.prospectId },
        data: { hot: false, signupKind: "new", signupStateAt: now, signupStateReason: welcome.signupStateReason, companyId: company.id, businessName: company.name, sourceRecordId: welcome.sourceRecordId },
        select: { id: true },
      });
      return { linkedLeadId: lead.id, prospectId: row.id, reason: "hot_completed" };
    }
    const row = await client.prospect.upsert({
      where: { sourceProvider_sourceRecordId: { sourceProvider: SIGNUP_SOURCE, sourceRecordId: welcome.sourceRecordId } },
      create: welcome,
      update: {},
      select: { id: true },
    });
    return { linkedLeadId: lead?.id || null, prospectId: row.id, reason: "welcome" };
  } catch (err) {
    console.error("[signup/salesFloor] recordSignupCompletion failed:", err?.message || err);
    return { linkedLeadId: null, prospectId: null, reason: "failed", error: err?.message || String(err) };
  }
}

/** What a signup prospect reads off its company: the two facts the badge turns on. */
const COMPANY_FACTS_SELECT = {
  id: true, name: true, email: true, phone: true, city: true, province: true, country: true, industries: true, defaultLanguage: true,
  createdAt: true, isDemo: true,
  subscription: { select: { id: true, status: true } },
  salesAttribution: { select: { salesRepId: true } },
  quotes: { where: { sentAt: { not: null } }, orderBy: { sentAt: "asc" }, take: 1, select: { sentAt: true } },
};

export function companyFactsOf(company) {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    city: company.city,
    industries: company.industries,
    defaultLanguage: company.defaultLanguage,
    createdAt: company.createdAt,
    subscription: company.subscription ?? null,
    firstQuoteSentAt: company.quotes?.[0]?.sentAt || null,
    attributedRepId: company.salesAttribution?.salesRepId || null,
  };
}

/**
 * The cron's second job: flip welcome rows to stalled and back, and write
 * the welcome row for any unreferred company of the last WELCOME_BACKFILL_DAYS
 * that has none (the three real companies at deploy; a signup whose
 * completion hook failed afterwards).
 */
export async function sweepSignupProspects({ client, now = new Date() } = {}) {
  const counts = { flippedStalled: 0, cleared: 0, backfilled: 0, unchanged: 0 };

  // ── Backfill ─────────────────────────────────────────────────────────────
  const since = new Date(now.getTime() - WELCOME_BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const recent = await client.company.findMany({
    where: { isDemo: false, createdAt: { gte: since }, salesAttribution: { is: null }, referredByCode: null, signupProspects: { none: {} } },
    select: { ...COMPANY_FACTS_SELECT, members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } } },
  });
  for (const c of recent) {
    await client.prospect.upsert({
      where: { sourceProvider_sourceRecordId: { sourceProvider: SIGNUP_SOURCE, sourceRecordId: `company:${c.id}` } },
      create: prospectFromCompany(c, { now, ownerName: c.members?.[0]?.user?.name || null }),
      update: {},
      select: { id: true },
    });
    counts.backfilled += 1;
  }

  // ── Stalled ⇄ new ────────────────────────────────────────────────────────
  const rows = await client.prospect.findMany({
    where: { signupKind: { in: ["new", "stalled"] }, companyId: { not: null } },
    select: { id: true, signupKind: true, signupStateReason: true, company: { select: COMPANY_FACTS_SELECT } },
  });
  for (const p of rows) {
    const facts = companyFactsOf(p.company);
    const verdict = stalledDecision({ company: facts, now, checkoutGraceMs: CHECKOUT_GRACE_MS });
    const wantKind = verdict.stalled ? "stalled" : "new";
    if (wantKind === p.signupKind && (verdict.reason || null) === (p.signupKind === "stalled" ? p.signupStateReason : null)) {
      counts.unchanged += 1;
      continue;
    }
    await client.prospect.update({
      where: { id: p.id },
      data: { signupKind: wantKind, signupStateAt: now, signupStateReason: verdict.stalled ? verdict.reason : "Signed up" },
    });
    if (verdict.stalled) counts.flippedStalled += 1; else counts.cleared += 1;
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reading a signup row
// ═══════════════════════════════════════════════════════════════════════════

/** The relations a prospect read needs for signupStateOf(). */
export const SIGNUP_PROSPECT_SELECT = {
  hot: true,
  signupKind: true,
  signupStateReason: true,
  signupStateAt: true,
  companyId: true,
  signupLead: { select: { firstName: true, lastName: true, stepReached: true, trades: true, language: true, lastSeenAt: true, resumeToken: true, referredRepId: true } },
  company: { select: COMPANY_FACTS_SELECT },
};

/** The `signup` block a card, a list row or the folder prints — null on any other prospect. */
export function signupStateOf(prospect, { now = new Date() } = {}) {
  if (!prospect?.signupKind) return null;
  const state = {
    kind: prospect.signupKind,
    hot: Boolean(prospect.hot),
    stateReason: prospect.signupStateReason || null,
    stateAt: prospect.signupStateAt || null,
    lead: prospect.signupLead || null,
    company: companyFactsOf(prospect.company),
  };
  const fact = signupFact(state, { now });
  return {
    kind: state.kind,
    hot: state.hot,
    badge: fact?.badge || state.kind,
    stateReason: state.stateReason,
    companyId: prospect.companyId || null,
    stepReached: state.lead?.stepReached || null,
    stepLabel: state.lead?.stepReached ? STEP_LABELS[state.lead.stepReached] || state.lead.stepReached : null,
    language: state.lead?.language || state.company?.defaultLanguage || null,
    // For the opener (lib/sales/playbook/signupOpener.js): who to greet, what
    // to call the business, and when it happened.
    firstName: state.lead?.firstName || null,
    businessName: prospect.businessName || state.company?.name || null,
    at: state.kind === "abandoned" ? state.lead?.lastSeenAt || null : state.company?.createdAt || null,
    resumeToken: state.lead?.resumeToken || null,
    fact,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The owner's assign
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The unplaced signup rows, newest first, hot first. `hotOnly` is the funnel
 * link's filter.
 */
export async function listUnplacedSignups({ client, now = new Date(), hotOnly = false, take = 200 } = {}) {
  const rows = await client.prospect.findMany({
    where: { ...unplacedSignupWhere(now), ...(hotOnly ? { hot: true } : {}) },
    orderBy: [{ hot: "desc" }, { signupStateAt: "desc" }],
    take,
    select: {
      id: true, businessName: true, phoneE164: true, email: true, city: true, province: true, country: true, tradeKey: true,
      assignedRepId: true, claimExpiresAt: true, createdAt: true,
      ...SIGNUP_PROSPECT_SELECT,
    },
  });
  return rows.map((p) => ({
    id: p.id,
    businessName: p.businessName,
    phoneE164: p.phoneE164,
    email: p.email,
    where: [p.city, p.province, p.country].filter(Boolean).join(", "),
    tradeKey: p.tradeKey,
    contactName: contactNameOf(p.signupLead || {}),
    requiredLanguage: requiredLanguageFor(p),
    signup: signupStateOf(p, { now }),
    createdAt: p.createdAt,
  }));
}

/**
 * Why this signup row cannot go to this rep, or null. The same refusals the
 * hand-pick assign gives (lib/sales/assignLeads.js assignRefusalFor), minus
 * the trade — a signup row with no trade is still a person to ring — and
 * minus the claimable-status rule, which this row fails by design.
 */
export function signupAssignRefusalFor(prospect, rep, { now = new Date() } = {}) {
  if (!prospect) return "This signup no longer exists.";
  if (!prospect.signupKind) return "Not a signup row — assign it from the prospects list.";
  if (prospect.doNotContactAt) return "Do not contact — a human said never to ring this business.";
  if (prospect.mergedIntoId) return "Merged into another record.";
  const claim = claimState(prospect, { repId: rep?.id || null, now });
  if (claim.state === "mine" || claim.state === "mine_worked") return `Already ${rep?.name || "this rep"}'s.`;
  if (claim.state === "held" || claim.state === "held_worked") return `Held by ${prospect.assignedRep?.name || "another rep"}.`;
  if (!repCanTake(rep, prospect)) {
    const need = requiredLanguageFor(prospect);
    return need === "fr" ? `In Quebec — ${rep?.name || "this rep"} does not sell in French.` : `Outside Quebec — ${rep?.name || "this rep"} does not sell in English.`;
  }
  return null;
}

/**
 * THE write that puts a signup row in a rep's queue. A superadmin's action
 * on /platform/sales/review. Writes exactly what the hand-pick assign writes
 * — the three Prospect columns with the 48-hour lease, one SalesQueueClaim in
 * mode "admin" — so every sweep that reads a console assignment reads this
 * one the same way, and the audit log names the admin.
 */
export async function assignSignupToRep({ client, admin, rep, prospectId, now = new Date(), notify = null, callback = false } = {}) {
  if (!client) throw new Error("assignSignupToRep needs a client");
  if (!admin?.id) throw new Error("assignSignupToRep needs the admin doing it");
  if (!rep?.id) return { error: "Choose a rep to assign to." };
  if (rep.active === false) return { error: "That rep is deactivated. Leads can only be assigned to an active rep." };
  if (typeof prospectId !== "string" || !prospectId) return { error: "Pick a signup to assign." };

  const row = await client.prospect.findUnique({
    where: { id: prospectId },
    select: { id: true, businessName: true, province: true, country: true, signupKind: true, doNotContactAt: true, mergedIntoId: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true, tradeKey: true },
  });
  if (row?.assignedRepId && row.assignedRepId !== rep.id) {
    const holder = await client.salesRep.findUnique({ where: { id: row.assignedRepId }, select: { name: true } }).catch(() => null);
    row.assignedRep = holder || null;
  }
  const refusal = signupAssignRefusalFor(row, rep, { now });
  if (refusal) return { error: refusal, refused: true };

  const zone = await lastKnownZoneFor({ db: client, salesRepId: rep.id, now });
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  const last = await client.salesQueueClaim.aggregate({ where: { salesRepId: rep.id, releasedAt: null, workedAt: null }, _max: { position: true } });
  const position = Number.isInteger(last?._max?.position) ? last._max.position + 1 : 0;
  const batchId = assignBatchId({ adminId: admin.id, at: now });

  const won = await client.$transaction(async (tx) => {
    const updated = await tx.prospect.updateMany({
      where: { id: row.id, ...unplacedSignupWhere(now) },
      data: {
        assignedRepId: rep.id, assignedAt: now, claimExpiresAt: claimExpiryFrom(now),
        // "Assign for callback" from /platform/signups: the owner wants this
        // person rung, so the row is HOT whatever its kind — hoistHot puts a
        // hot row at the front of its window group on the rep's queue.
        ...(callback ? { hot: true } : {}),
      },
    });
    if (updated.count === 0) return false;
    await tx.salesQueueClaim.create({
      data: { salesRepId: rep.id, prospectId: row.id, claimedAt: now, mode: ASSIGN_MODE, batchId, position, repTimeZone: zone, localDate },
    });
    return true;
  });
  if (!won) return { error: "Claimed by another rep just now.", refused: true };

  await client.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "leads_assigned",
      details: { repId: rep.id, repEmail: rep.email || null, tradeKey: row.tradeKey || null, count: 1, asked: 1, province: row.province || null, language: null, prospectIds: [row.id], refused: 0, batchId, how: callback ? "signup_callback" : "signup" },
    },
  });
  await notifyRepAssigned({ db: client, rep, admin, count: 1, tradeKey: row.tradeKey || null, province: row.province || null, notify });
  return { assigned: 1, prospectId: row.id, batchId };
}

// ═══════════════════════════════════════════════════════════════════════════
// /platform/signups — assign for callback, set the trade
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The Prospect behind a row on /platform/signups — found, or written NOW
 * the same way the cron and the completion hook write it. One function for
 * both kinds of row so a company that never got its welcome row and a lead
 * the cron has not reached yet are handled by the code that would have
 * handled them anyway, not by a second copy.
 *
 *   lead      → promoteOneSignupLead(immediate): the folder row, an existing
 *               prospect flagged hot, or — on a rep's link — that rep's own
 *               lead, handed to them (the owner's rule: never hot to
 *               somebody else).
 *   company   → the welcome row (prospectFromCompany), unless the company
 *               is a rep's (salesAttribution / referredByCode), which is
 *               theirs already and gets no folder row.
 *
 * @returns { prospectId, referredRepId, reason } | { error, reason }
 */
export async function ensureSignupProspect({ client, leadId = null, companyId = null, now = new Date() } = {}) {
  if (leadId) {
    const lead = await client.signupLead.findUnique({ where: { id: leadId } });
    if (!lead) return { error: "That signup no longer exists.", reason: "no_lead" };
    if (lead.completedCompanyId) return { error: "This person finished their signup — they are a company now.", reason: "completed" };
    if (lead.prospectId) return { prospectId: lead.prospectId, referredRepId: lead.referredRepId || null, reason: "already_promoted" };
    const result = await promoteOneSignupLead({ client, lead, now, immediate: true });
    if (result.prospectId) return { prospectId: result.prospectId, referredRepId: result.salesRepId || null, reason: result.reason };
    if (result.action === "link_company") return { error: "This email already belongs to a company on the books.", reason: "company_exists" };
    if (result.reason === "suppressed") return { error: "On FieldQuo's do-not-contact list — never handed to a rep.", reason: "suppressed" };
    return { error: `Could not place this signup (${result.reason}).`, reason: result.reason };
  }
  if (companyId) {
    const company = await client.company.findUnique({
      where: { id: companyId },
      select: {
        ...COMPANY_FACTS_SELECT, phone: true, referredByCode: true,
        signupProspects: { select: { id: true, assignedRepId: true }, take: 1 },
        members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } },
      },
    });
    if (!company || company.isDemo) return { error: "That company no longer exists.", reason: "no_company" };
    if (company.subscription) return { error: "This company has a subscription — it is a customer, not a signup.", reason: "completed" };
    if (company.signupProspects[0]) return { prospectId: company.signupProspects[0].id, referredRepId: company.salesAttribution?.salesRepId || null, reason: "exists" };
    if (company.salesAttribution?.salesRepId || company.referredByCode) {
      return { error: "This signup came in on a rep's link — it is already theirs.", reason: "referred", referredRepId: company.salesAttribution?.salesRepId || null };
    }
    const row = await client.prospect.upsert({
      where: { sourceProvider_sourceRecordId: { sourceProvider: SIGNUP_SOURCE, sourceRecordId: `company:${company.id}` } },
      create: prospectFromCompany(company, { now, ownerName: company.members?.[0]?.user?.name || null }),
      update: {},
      select: { id: true },
    });
    return { prospectId: row.id, referredRepId: null, reason: "welcome" };
  }
  return { error: "Pick a signup to assign.", reason: "no_target" };
}

/**
 * "Assign for callback" — one row on /platform/signups to one rep. The
 * Prospect is found or written (above), then handed over through the ONE
 * assign write (assignSignupToRep, with `callback` so the row is hot and the
 * audit row says how). A referred signup is refused with the rep it belongs
 * to, whoever was picked: the owner's rule.
 *
 * @returns { assigned: 1, prospectId, rep: { id, name } } | { error, refused?, referredRepId? }
 */
export async function assignSignupForCallback({ client, admin, rep, leadId = null, companyId = null, now = new Date(), notify = null } = {}) {
  if (!rep?.id) return { error: "Choose a rep to assign to." };
  const placed = await ensureSignupProspect({ client, leadId, companyId, now });
  if (placed.error) return { error: placed.error, refused: true, referredRepId: placed.referredRepId || null };
  if (placed.referredRepId && placed.referredRepId !== rep.id) {
    const owner = await client.salesRep.findUnique({ where: { id: placed.referredRepId }, select: { id: true, name: true } }).catch(() => null);
    return { error: `Came in on ${owner?.name || "a rep"}'s link — it is already theirs.`, refused: true, referredRepId: placed.referredRepId, prospectId: placed.prospectId };
  }
  if (placed.referredRepId === rep.id) {
    return { assigned: 0, alreadyTheirs: true, prospectId: placed.prospectId, rep: { id: rep.id, name: rep.name } };
  }
  const result = await assignSignupToRep({ client, admin, rep, prospectId: placed.prospectId, now, notify, callback: true });
  if (result.error) return { ...result, prospectId: placed.prospectId };
  return { assigned: 1, prospectId: placed.prospectId, rep: { id: rep.id, name: rep.name } };
}

/**
 * "Set trade" on a row whose own words mapped to nothing. Written on the
 * Prospect — the one place a trade lives on the floor — which is found or
 * written first, the same way as the assign. A referred lead's row is the
 * rep's, and its trade may still be set (the rep's card reads it).
 */
export async function setSignupTrade({ client, leadId = null, companyId = null, tradeKey, now = new Date() } = {}) {
  if (!isDiscoveryTradeKey(tradeKey)) return { error: "Not a trade FieldQuo sells to." };
  const placed = await ensureSignupProspect({ client, leadId, companyId, now });
  if (placed.error) return { error: placed.error, refused: true };
  await client.prospect.update({ where: { id: placed.prospectId }, data: { tradeKey } });
  return { ok: true, prospectId: placed.prospectId, tradeKey };
}

/** Every signup kind, for the screens that list them. */
export { SIGNUP_KINDS, SIGNUP_STATUS, incompleteSignupWhere };
