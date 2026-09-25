// lib/signup/leads.js
//
// A signup kept as it is typed, and the rules that turn one into a lead.
//
// ══ The gap this closes ════════════════════════════════════════════════════
//
// The public signup (app/signup/page.js) collects a name, a company, an
// email, a phone, an address, a language and the trades on its FIRST step,
// and app/api/companies/route.js writes the Company row on its LAST. Between
// the two, everything lived in one browser tab's sessionStorage. The platform
// funnel for this month counted sixteen browsers on /signup and thirteen that
// left at the Trades step, and not one of them could be phoned: nothing they
// typed had reached a server. The owner, 2026-09-21: "The people that start
// the signup process — are we capturing that as potential leads we can call?"
//
// ══ The three rows a signup can become ═════════════════════════════════════
//
//   abandoned   a SignupLead with a phone, no Company, quiet for
//               PROMOTE_AFTER_MS. Promoted by app/api/cron/signup-leads into a
//               Prospect with `hot: true` for the owner to hand to a rep from
//               /platform/sales/review — OR, when the link the visitor arrived
//               on carried a rep's code, straight into THAT rep's SalesLead,
//               because the signup was already theirs (lib/sales/attribution.js
//               would attribute the finished company to them for the same
//               reason).
//   new         a Company created from the public signup by somebody nobody
//               referred. A welcome-call Prospect for the owner to hand out;
//               the rep's job is onboarding, not selling.
//   stalled     that same row once the company has no card after the checkout
//               grace, or no quote sent in its first week. Flipped and cleared
//               by the cron as the condition comes and goes.
//
// A rep-referred COMPLETED signup never becomes a Prospect at all: the
// SalesAttribution row already says whose it is, and the rep's own list
// (/api/sales/signups) reads the facts straight off the Company.
//
// ══ Never the dispatcher ═══════════════════════════════════════════════════
//
// Every row this file shapes carries `status: SIGNUP_STATUS`, which is not in
// lib/sales/prospectView.js's CLAIMABLE_STATUSES. That is the whole mechanism
// by which "Claim the next 25" cannot pick one up, the review folder's trade
// bulks cannot accept or reject one, and the retry pool never recycles one.
// The ONE path to a rep's queue is assignSignupToRep() in
// lib/signup/salesFloor.js, pressed by a superadmin. scripts/
// check-signup-leads.mjs asserts all three by executing the WHEREs.
//
// ══ Pure ═══════════════════════════════════════════════════════════════════
//
// No database, no clock of its own, no next/server. lib/signup/salesFloor.js
// is the db half. Every rule here is executed by the check against a hostile
// fixture rather than read — which is where the real bugs in this repo have
// been found (AGENTS.md, "How to verify").

import { randomBytes } from "node:crypto";
import { INDUSTRIES } from "@/app/data/industries";
import { COUNTRIES } from "@/lib/currency";
import { isSupported } from "@/app/i18n/languages";
import { isValidEmail } from "@/lib/validation";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { normalisePhone, normaliseEmail } from "@/lib/sales/suppressionRules";
import { readSalesCode } from "@/lib/sales/attribution";
import { STEPS } from "@/lib/signup/funnel";

/** Prospect.sourceProvider and Prospect.status for every signup-sourced row. */
export const SIGNUP_SOURCE = "signup";
export const SIGNUP_STATUS = "signup";

/** Prospect.signupKind — the three badges. */
export const SIGNUP_KINDS = Object.freeze(["abandoned", "new", "stalled"]);

/**
 * How long a SignupLead has to be quiet before it is promoted. THIRTY
 * MINUTES — the owner's number. Shorter than lib/signup/abandoned.js's
 * 24-hour email delay on purpose: that letter goes to somebody who reached
 * Stripe and whose checkout link is still live for a day; this row is
 * somebody who typed a phone number and closed the tab, and the call is
 * warmest the same morning.
 */
export const PROMOTE_AFTER_MS = 30 * 60 * 1000;

/** The browser's capture contract lives in lib/signup/leadCapture.js (no imports). */
export { CAPTURE_DEBOUNCE_MS, CAPTURE_ENDPOINT } from "@/lib/signup/leadCapture";

/** "No quote sent within 7 days of signup" — the stalled rule's second leg. */
export const STALLED_NO_QUOTE_DAYS = 7;

/**
 * The welcome-call sweep's reach back on its first run: the companies of
 * the last 30 days get a row so the owner can see the shape. Nothing older
 * — an existing customer is not a lead.
 */
export const WELCOME_BACKFILL_DAYS = 30;

/** The steps a capture may report, in funnel order, plus the handoff to Stripe. */
export const SIGNUP_LEAD_STEPS = Object.freeze([...STEPS, "checkout"]);
const STEP_RANK = Object.fromEntries(SIGNUP_LEAD_STEPS.map((s, i) => [s, s === "business" ? 0 : i]));

/** Steps the funnel screen shows, as the platform analytics names them. */
export const STEP_LABELS = Object.freeze({
  account: "Account & company",
  business: "Account & company",
  team: "Team size",
  goals: "Goals",
  industry: "Trades",
  services: "Services",
  plan: "Plan",
  checkout: "Checkout",
});

const OFFERED_COUNTRIES = new Set(COUNTRIES.map((c) => c.code));
const VISITOR_ID = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_TRADES = 12;
const MAX_SERVICE_CATEGORIES = 60;
/** A ServiceCategory id — a cuid. Anything else is dropped, never repaired. */
const CATEGORY_ID = /^[a-z0-9]{10,40}$/;

function text(value, max) {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, max);
  return v ? v : null;
}

/** lib/signup/abandoned.js nudgeRecipient's rule, and lib/sales/suppressionRules' key: one address, one row. */
export function emailKeyOf(email) {
  return normaliseEmail(email);
}

/**
 * Domains where the mailbox provider itself ignores dots in the local part
 * and everything after a "+". Only there may a signed-in session at
 * "d.martin+fq@gmail.com" be read as the row keyed "dmartin@gmail.com":
 * at icloud.com the dotted and undotted addresses are two different
 * people, and handing one the other's name and number is a leak. Gmail is
 * the one provider that documents both rules; the plus-only providers are
 * left out on purpose, because a plus that is NOT an alias is a literal
 * character in somebody's address.
 */
const DOT_AND_PLUS_INSENSITIVE = new Set(["gmail.com", "googlemail.com"]);

/**
 * The emailKeys a session's address may resume: the exact key first, then
 * — for the providers above only — the same mailbox without its plus tag and
 * without its dots. One direction only: a row keyed on the DOTTED form is
 * not found from an undotted session, because finding it would mean a scan
 * over every row at that domain. The auth-user-id link (authUserId) is the
 * fallback that does not depend on spelling at all.
 */
export function resumeEmailKeys(email) {
  const key = emailKeyOf(email);
  if (!key) return [];
  const keys = [key];
  const at = key.lastIndexOf("@");
  const domain = key.slice(at + 1);
  if (DOT_AND_PLUS_INSENSITIVE.has(domain)) {
    const local = key.slice(0, at);
    const untagged = local.split("+")[0];
    const undotted = untagged.replace(/\./g, "");
    for (const variant of [untagged, undotted]) {
      const candidate = variant ? `${variant}@${domain}` : null;
      if (candidate && !keys.includes(candidate)) keys.push(candidate);
    }
  }
  return keys;
}

/**
 * Did this signup FINISH — did it create the company it is linked to?
 *
 * `completedCompanyId` is written by two hands that mean different things:
 *
 *   · recordSignupCompletion, when /api/companies commits the company this
 *     very signup produced (stepReached becomes "checkout");
 *   · the promotion cron's `link_company` verdict, when a company ALREADY
 *     on the books carries the same email or phone — a guess that this
 *     person is a customer, stamped `skipReason: "company_exists"`.
 *
 * The owner's own row, 2026-09-21: the cron matched his test signup by the
 * last four digits of his phone to a company he had set up a week earlier
 * under another address, and every reader of `completedCompanyId` — the
 * resume read, the capture lock, the platform's started list — then treated
 * an unfinished signup as a finished one. He signed back in to an empty
 * business form under a banner saying nothing had been kept. The two
 * meanings are told apart here, once, by the stamp the cron leaves and the
 * completion does not.
 */
export function signupLeadFinished(lead) {
  return Boolean(lead?.completedCompanyId) && lead?.skipReason !== "company_exists";
}

/** The Prisma WHERE for "still unfinished" — the query-side twin of signupLeadFinished. */
export function unfinishedSignupLeadWhere() {
  return { OR: [{ completedCompanyId: null }, { skipReason: "company_exists" }] };
}

/** A fresh resume token: 32 random bytes, URL-safe. */
export function newResumeToken() {
  return randomBytes(32).toString("base64url");
}

export function isResumeToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,48}$/.test(value);
}

/**
 * What a browser posted, made safe.
 *
 * Refuses (with `error`) rather than repairs: an email that is not one, a
 * step that is not a step, markup in a name. Everything else is trimmed,
 * bounded and — for the phone, the country, the language and the codes —
 * normalised through the same helpers the rest of the product uses, so
 * "555-123-4567" becomes the +1 number the suppression list is keyed on and
 * "zz" is not a country.
 *
 * NOTHING here reads a query string: the page posts a JSON body, and the
 * check greps the page for it (no PII in a URL — the resume link carries a
 * random token for the same reason).
 */
export function normaliseCapture(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email || !isValidEmail(email) || email.length > 254) return { error: "email" };
  const emailKey = emailKeyOf(email);
  if (!emailKey) return { error: "email" };

  const step = typeof b.step === "string" ? b.step.trim() : "";
  if (!SIGNUP_LEAD_STEPS.includes(step)) return { error: "step" };

  for (const k of ["firstName", "lastName", "companyName", "address", "city", "province"]) {
    if (containsMarkupCharacters(b[k])) return { error: k };
  }

  const phoneRaw = text(b.phone, 40);
  const phoneE164 = phoneRaw ? normalisePhone(phoneRaw) : null;

  const countryRaw = text(b.country, 2);
  const country = countryRaw && OFFERED_COUNTRIES.has(countryRaw.toUpperCase()) ? countryRaw.toUpperCase() : null;

  const langRaw = text(b.language, 5);
  const language = langRaw && isSupported(langRaw) ? langRaw.toLowerCase() : null;

  const trades = Array.isArray(b.trades)
    ? [...new Set(b.trades.filter((s) => typeof s === "string").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,40}$/.test(s)))].slice(0, MAX_TRADES)
    : [];
  const serviceCategoryIds = Array.isArray(b.serviceCategoryIds)
    ? [...new Set(b.serviceCategoryIds.filter((s) => typeof s === "string").map((s) => s.trim()).filter((s) => CATEGORY_ID.test(s)))].slice(0, MAX_SERVICE_CATEGORIES)
    : [];

  const utm = {};
  if (b.utm && typeof b.utm === "object") {
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = text(b.utm[k], 100);
      if (v && !containsMarkupCharacters(v)) utm[k] = v;
    }
  }

  const salesCode = readSalesCode(b.salesCode).code;
  const referralCode = text(b.referralCode, 40);

  return {
    lead: {
      emailKey,
      email,
      firstName: text(b.firstName, 80),
      lastName: text(b.lastName, 80),
      companyName: text(b.companyName, 160),
      phoneRaw,
      phoneE164,
      country,
      address: text(b.address, 200),
      province: text(b.province, 40),
      city: text(b.city, 80),
      trades,
      serviceCategoryIds,
      language,
      referrer: text(b.referrer, 200),
      utm: Object.keys(utm).length ? utm : null,
      visitorId: typeof b.visitorId === "string" && VISITOR_ID.test(b.visitorId) ? b.visitorId : null,
      salesCode,
      referralCode: referralCode && !containsMarkupCharacters(referralCode) ? referralCode.toLowerCase() : null,
      stepReached: step,
    },
  };
}

/** Is the typed form worth a row yet? An email alone is a login attempt, not a lead. */
export function worthCapturing(lead = {}) {
  if (!lead?.emailKey) return false;
  return Boolean(lead.firstName || lead.lastName || lead.companyName || lead.phoneE164 || (lead.trades || []).length);
}

/**
 * The write for one capture against what is already on file, or a refusal.
 *
 *   locked      the row is finished business — a Company completed it
 *               (signupLeadFinished: the cron's "matches a company on the
 *               books" stamp is NOT a finish), or it was promoted. A later
 *               capture at the same address is somebody starting over (or
 *               somebody else typing a stranger's email); either way the
 *               lead on the floor must not be rewritten under a rep.
 *               Nothing is written.
 *
 * Otherwise every typed value replaces the stored one when it is non-empty
 * and is kept when the new capture is blank — a visitor who cleared the phone
 * box has not un-given their number; the check asserts the opposite for the
 * step, which never moves backwards. `consentAt` is set ONCE, at the first
 * capture carrying a phone, and never moved: it is the moment the number was
 * given, which is the evidence.
 */
export function planCaptureWrite({ existing = null, incoming, now = new Date() } = {}) {
  if (!incoming?.emailKey) return { refusal: "email" };
  if (signupLeadFinished(existing) || existing?.promotedAt) return { refusal: "locked" };

  const keep = (k) => incoming[k] ?? existing?.[k] ?? null;
  const fromRank = STEP_RANK[existing?.stepReached] ?? 0;
  const toRank = STEP_RANK[incoming.stepReached] ?? 0;
  const stepReached = toRank >= fromRank ? incoming.stepReached : existing.stepReached;

  const phoneE164 = keep("phoneE164");
  const data = {
    email: incoming.email,
    firstName: keep("firstName"),
    lastName: keep("lastName"),
    companyName: keep("companyName"),
    phoneRaw: keep("phoneRaw"),
    phoneE164,
    country: keep("country"),
    address: keep("address"),
    province: keep("province"),
    city: keep("city"),
    trades: incoming.trades?.length ? incoming.trades : existing?.trades || [],
    serviceCategoryIds: incoming.serviceCategoryIds?.length ? incoming.serviceCategoryIds : existing?.serviceCategoryIds || [],
    language: keep("language"),
    referrer: keep("referrer"),
    utm: keep("utm"),
    visitorId: keep("visitorId"),
    // The link's codes: the query string wins over an older row, exactly as
    // app/signup/page.js lets a fresh ?sales= beat a stale draft's.
    salesCode: keep("salesCode"),
    referralCode: keep("referralCode"),
    stepReached,
    lastSeenAt: now,
    consentAt: existing?.consentAt || (phoneE164 ? now : null),
  };
  // The Better Auth user this address signed in as, when the capture came
  // from a session whose address IS this one (captureSignupLead checks that,
  // never this function — the body is public and cannot carry it). Kept
  // once set: the session that proved it is not un-proved by a later
  // signed-out capture at the same address.
  if (incoming.authUserId) data.authUserId = incoming.authUserId;
  return { data, create: !existing };
}

/**
 * Should this SignupLead become a lead on the floor right now — and which
 * kind?
 *
 * @param lead            the SignupLead row
 * @param now             injectable clock
 * @param suppressed      FieldQuo's do-not-contact list closes the phone OR
 *                        the email for this person — read in the request
 *                        that promotes, never cached (lib/sales/suppression).
 * @param matchingCompany a Company whose email or phone is this person's, or
 *                        null. A company on the books is a customer, not a
 *                        lead — and its email is linked so /platform/signups
 *                        can say "this is Sunset Space".
 * @param matchingProspect a Prospect already carrying this phone or email
 *                        (not merged away), or null. Linked, never duplicated:
 *                        two rows for one number is two reps ringing it.
 * @param referredRep     the SalesRep behind `salesCode`, when it resolved to
 *                        an active one, else null.
 * @param immediate       a superadmin pressed "assign for callback" on
 *                        /platform/signups: the two WAITS (no phone yet,
 *                        not quiet for thirty minutes) are the cron's
 *                        patience, and a human choosing to ring this person
 *                        now has already answered both. Every refusal still
 *                        applies — a customer, a suppressed address, a
 *                        promoted row are not overridden by a button.
 *
 * @returns { action, reason, final }
 *   action  "wait"        not yet — leave the row alone
 *           "skip"        never — stamp skipReason (`final: true`)
 *           "link_company" the person already has a company
 *           "link_prospect" flag the existing Prospect hot, link it
 *           "rep_lead"    write the referring rep's SalesLead
 *           "prospect"    write a HOT Prospect for the review folder
 */
export function decideSignupLeadPromotion({
  lead,
  now = new Date(),
  suppressed = false,
  matchingCompany = null,
  matchingProspect = null,
  referredRep = null,
  immediate = false,
} = {}) {
  if (!lead) return { action: "skip", reason: "no_lead", final: false };
  // ── The assertions first, in the order that cannot be reordered ──────────
  // A completed signup is a customer. Checked before anything that could
  // return a different verdict for the same row, so "a completed signup was
  // never promoted" is a property of the first branch, not of luck.
  if (signupLeadFinished(lead)) return { action: "skip", reason: "completed", final: true };
  if (lead.promotedAt || lead.prospectId || lead.promotedLeadId) return { action: "skip", reason: "already_promoted", final: true };
  if (lead.skipReason) return { action: "skip", reason: lead.skipReason, final: true };
  if (matchingCompany?.id) return { action: "link_company", reason: "company_exists", companyId: matchingCompany.id, final: true };

  if (!immediate) {
    if (!lead.phoneE164) return { action: "wait", reason: "no_phone", final: false };

    const seen = lead.lastSeenAt ? new Date(lead.lastSeenAt) : null;
    if (!seen || Number.isNaN(seen.getTime())) return { action: "wait", reason: "no_last_seen", final: false };
    if (now.getTime() - seen.getTime() < PROMOTE_AFTER_MS) return { action: "wait", reason: "too_recent", final: false };
  }

  if (suppressed) return { action: "skip", reason: "suppressed", final: true };

  if (matchingProspect?.id) {
    return { action: "link_prospect", reason: "prospect_exists", prospectId: matchingProspect.id, final: true };
  }
  if (referredRep?.id) return { action: "rep_lead", reason: "referred", salesRepId: referredRep.id, final: true };
  return { action: "prospect", reason: "due", final: true };
}

/** The discovery trade behind the first industry slug that maps to one, else null. */
export function tradeKeyForIndustries(slugs = []) {
  for (const slug of Array.isArray(slugs) ? slugs : []) {
    const hit = INDUSTRIES.find((i) => i.slug === slug && i.tradeKey);
    if (hit) return hit.tradeKey;
  }
  return null;
}

/** "Dave Martin" from the two boxes, or null. */
export function contactNameOf(lead = {}) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

/**
 * The Prospect an abandoned SignupLead becomes. `sourceRecordId` is the
 * SignupLead id, so `@@unique([sourceProvider, sourceRecordId])` makes a
 * retried promotion a no-op rather than a second row.
 */
export function prospectFromSignupLead(lead, { now = new Date() } = {}) {
  return {
    sourceProvider: SIGNUP_SOURCE,
    sourceRecordId: lead.id,
    status: SIGNUP_STATUS,
    classification: "contractor",
    classificationReason: "Typed into the FieldQuo signup form by the business itself.",
    businessName: lead.companyName || contactNameOf(lead) || lead.email,
    rawName: lead.companyName || null,
    phoneE164: lead.phoneE164 || null,
    email: lead.email || null,
    emailSource: "signup_form",
    city: lead.city || null,
    province: lead.province || null,
    country: lead.country || null,
    tradeKey: tradeKeyForIndustries(lead.trades),
    sourceCategories: Array.isArray(lead.trades) ? lead.trades : [],
    sourceUpdatedAt: lead.lastSeenAt || now,
    hot: true,
    signupKind: "abandoned",
    signupStateAt: now,
    signupStateReason: `Stopped at ${STEP_LABELS[lead.stepReached] || lead.stepReached}`,
  };
}

/**
 * The welcome-call Prospect for a Company nobody referred.
 * `sourceRecordId` is the company id — the same idempotency as above.
 */
export function prospectFromCompany(company, { now = new Date(), ownerName = null } = {}) {
  return {
    sourceProvider: SIGNUP_SOURCE,
    sourceRecordId: `company:${company.id}`,
    status: SIGNUP_STATUS,
    classification: "contractor",
    classificationReason: "Created its own FieldQuo company from the public signup.",
    businessName: company.name,
    phoneE164: normalisePhone(company.phone) || null,
    email: company.email || null,
    emailSource: company.email ? "signup_form" : null,
    city: company.city || null,
    province: company.province || null,
    country: company.country || null,
    tradeKey: tradeKeyForIndustries(company.industries),
    sourceCategories: Array.isArray(company.industries) ? company.industries : [],
    sourceUpdatedAt: company.createdAt || now,
    hot: false,
    signupKind: "new",
    signupStateAt: now,
    signupStateReason: ownerName ? `Signed up — ask for ${ownerName}` : "Signed up",
    companyId: company.id,
  };
}

/**
 * Is this company's trial stalled, and why.
 *
 * Two legs, either one stalls:
 *   no_card   no Subscription after CHECKOUT_GRACE (lib/signup/setupGate.js's
 *             hour — the same grace the setup banner counts down).
 *   no_quote  no quote SENT within STALLED_NO_QUOTE_DAYS of signup.
 *
 * Both clear the moment the condition clears (a card arrives, a quote goes
 * out), which is why this is a reading of the company and never a stamp.
 *
 * @param company { createdAt, subscription: {...}|null, firstQuoteSentAt }
 *                `subscription` must be SELECTED — undefined throws, for the
 *                reason lib/signup/abandoned.js isIncompleteSignup gives.
 */
export function stalledDecision({ company, now = new Date(), checkoutGraceMs } = {}) {
  if (!company) return { stalled: false, reason: null };
  if (company.subscription === undefined) {
    throw new Error("stalledDecision: company.subscription was not selected — cannot tell 'no card' from 'not loaded'");
  }
  const created = company.createdAt ? new Date(company.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return { stalled: false, reason: null };
  const age = now.getTime() - created.getTime();
  if (company.subscription === null && age > checkoutGraceMs) return { stalled: true, reason: "no_card" };
  if (!company.firstQuoteSentAt && age > STALLED_NO_QUOTE_DAYS * 24 * 60 * 60 * 1000) return { stalled: true, reason: "no_quote" };
  return { stalled: false, reason: null };
}

/**
 * The fact a rep reads FIRST on a signup-sourced row — and what /platform
 * and the rep's "Your signups" list print. One shape, keyed for the nine
 * catalogues; `params` carry the numbers and the names verbatim.
 *
 * @param signup  { kind, stateReason, stateAt, lead: SignupLead|null,
 *                  company: { createdAt, subscription, firstQuoteSentAt }|null }
 */
export function signupFact(signup, { now = new Date() } = {}) {
  if (!signup?.kind) return null;
  const base = { key: "signup", label: "Signup", labelKey: "app.salesIntel.fact.signup.label", known: true, layer: "fact" };
  const ago = agoParts(signup.kind === "abandoned" ? signup.lead?.lastSeenAt : signup.company?.createdAt, now);
  if (signup.kind === "abandoned") {
    const lead = signup.lead || {};
    const step = STEP_LABELS[lead.stepReached] || lead.stepReached || "—";
    const trade = tradeLabelFor(lead.trades);
    const language = (lead.language || "").toUpperCase() || "—";
    return {
      ...base,
      text: `Started signup ${ago.text} — got as far as ${step}; trade ${trade}; language ${language}`,
      textKey: "app.salesIntel.fact.signup.abandoned",
      params: { ...ago.params, step, trade, language },
      badge: "hot",
    };
  }
  const company = signup.company || {};
  const card = company.subscription ? "added" : "not yet";
  const quote = company.firstQuoteSentAt ? "sent" : "not yet";
  const trade = tradeLabelFor(company.industries);
  const city = company.city || "—";
  const language = (company.defaultLanguage || "").toUpperCase() || "—";
  const facts = `card ${card}; first quote ${quote}`;
  if (signup.kind === "stalled") {
    const why = signup.stateReason === "no_card" ? "no card after the checkout grace" : `no quote sent in ${STALLED_NO_QUOTE_DAYS} days`;
    return {
      ...base,
      text: `Signed up ${ago.text} — ${trade}, ${city}, ${language}; ${facts}. Stalled: ${why}`,
      textKey: signup.stateReason === "no_card" ? "app.salesIntel.fact.signup.stalledNoCard" : "app.salesIntel.fact.signup.stalledNoQuote",
      params: { ...ago.params, trade, city, language, card, quote, cardAdded: Boolean(company.subscription), quoteSent: Boolean(company.firstQuoteSentAt), days: STALLED_NO_QUOTE_DAYS },
      // "Assign for callback" on /platform/signups sets `hot` on a welcome
      // or stalled row; hoistHot already treats it as hot, so the badge
      // agrees rather than saying "Stalled" over a row at the top of the
      // queue.
      badge: signup.hot ? "hot" : "stalled",
    };
  }
  return {
    ...base,
    text: `Signed up ${ago.text} — ${trade}, ${city}, ${language}; ${facts}`,
    textKey: "app.salesIntel.fact.signup.new",
    params: { ...ago.params, trade, city, language, card, quote, cardAdded: Boolean(company.subscription), quoteSent: Boolean(company.firstQuoteSentAt) },
    badge: signup.hot ? "hot" : "new",
  };
}

/** The first industry's label, else "—". A label a rep reads, not a slug. */
export function tradeLabelFor(slugs = []) {
  for (const slug of Array.isArray(slugs) ? slugs : []) {
    const hit = INDUSTRIES.find((i) => i.slug === slug);
    if (hit) return hit.label;
  }
  return "—";
}

/**
 * "12 minutes ago" / "3 hours ago" / "2 days ago" as a sentence and as
 * { n, unit } so the catalogues can say it in nine languages.
 */
export function agoParts(at, now = new Date()) {
  const d = at ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime())) return { text: "—", params: { n: 0, unit: "minutes" } };
  const ms = Math.max(0, now.getTime() - d.getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return { text: `${minutes} minute${minutes === 1 ? "" : "s"} ago`, params: { n: minutes, unit: "minutes" } };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { text: `${hours} hour${hours === 1 ? "" : "s"} ago`, params: { n: hours, unit: "hours" } };
  const days = Math.floor(hours / 24);
  return { text: `${days} day${days === 1 ? "" : "s"} ago`, params: { n: days, unit: "days" } };
}

/**
 * Hot rows to the front of their window group.
 *
 * Applied AFTER lib/sales/retryPool.js regroupForRetry, and inside each group
 * only: a hot row in "Opens at 14:00" does not jump into "Callable now" —
 * the calling window is a law, the badge is a priority. Within "Callable
 * now" a hot row outranks a due retry, because a person who typed their
 * number into our form an hour ago is warmer than a business that said
 * "call back" last week. Pure; the check executes it.
 */
export function hoistHot(windows, hotIds = new Set()) {
  if (!windows || !Array.isArray(windows.groups)) return windows;
  const hot = hotIds instanceof Set ? hotIds : new Set(hotIds);
  if (hot.size === 0) return windows;
  const groups = windows.groups.map((g) => {
    const ids = Array.isArray(g.ids) ? g.ids : [];
    const first = ids.filter((id) => hot.has(id));
    if (!first.length) return g;
    return { ...g, ids: [...first, ...ids.filter((id) => !hot.has(id))] };
  });
  return { ...windows, groups, order: groups.flatMap((g) => g.ids) };
}

/**
 * The WHERE for "a signup row the owner still has to place": every kind,
 * nobody holding it (or a lapsed hold), not do-not-contact, not merged away.
 * The review folder's signup section, its count and the assign write all
 * carry this — one expression, so the list cannot show what the write
 * refuses.
 */
export function unplacedSignupWhere(now = new Date()) {
  return {
    signupKind: { in: [...SIGNUP_KINDS] },
    mergedIntoId: null,
    doNotContactAt: null,
    OR: [{ assignedRepId: null }, { claimExpiresAt: { lt: now } }],
  };
}
