// lib/setupSteps.js
//
// The dashboard's "Additional set-up steps" — the seventeen things a company
// should get round to AFTER the onboarding checklist (lib/onboarding.js) is
// done (eleven until 2026-09-21; the four client-proposal rows joined then,
// the website row and "Confirm what you quote" on 2026-09-24).
//
// ══ How this differs from onboarding, and why it is a second list ══════════
//
// Onboarding is the five things without which the product cannot work at all:
// a logo, an address, a service, a price, a way to be paid. Every one of them
// is a fact the product reads on the next quote, so every one of them is
// measured and none can be waved away. And every one of them needs its own
// page, which is why that card is a list of links.
//
// These eleven are the things the product works WITHOUT but works worse
// without: no overhead means job costing shows margin against nothing; no
// payment schedule means one invoice on acceptance; no availability means the
// booking page has nothing to offer. A company can legitimately decide any of
// them does not apply to it — a one-van painter has no add-ons to review — so,
// per the owner's ask of 2026-09-08, each row can be hidden by hand as well as
// by being done.
//
// "Invite your team" moved here from onboarding on 2026-09-18, at the owner's
// ask: "it can be marked as done without leaving the window." It is the one
// row finished by a popup rather than a page, so this card hosts the quick
// Add Employee popup beside it (app/components/dashboard/SetupSteps.js), and
// the row goes the way every row here goes — removed the moment the roster
// says somebody was added, never ticked. The measurement is the one the
// onboarding step used (a second active member, or a pending invitation,
// which holds a seat) and so is the "it's just me — no crew right now" claim
// from Team Settings, honoured through `appliesWhen` below.
//
// ══ The rule every row obeys ═══════════════════════════════════════════════
//
// A step is REMOVED, never ticked, the moment the database says the company
// did it. `doneWhen` reads the same rows the feature itself reads: the
// overhead step looks at the same Expense/Salary/Debt/Asset rows the burn-rate
// calculation sums, the payment-schedule step at the same PaymentScheduleStage
// rows lib/paymentSchedule/run.js fires. So a row vanishing from the card means
// the thing is genuinely on the next quote, not that a flag was set.
//
// Where nothing in the schema can distinguish "reviewed and kept as shipped"
// from "never looked at" — a company that opened its add-ons, agreed with all
// of them and changed nothing — the step stays until dismissed, and its
// comment says so. That is honest; auto-removing it on a page view would be a
// control that appears to measure something and doesn't.
//
// A third way off the card, for three rows: a step that does not APPLY.
// The company has said it works alone, or the plan has no seat left to put
// anybody in; it already has a website; its trade already came with a full
// service list ("Confirm what you quote") — a step nobody can finish is worse than no step, and a step
// nobody can get rid of is the same bug wearing a hat (lib/onboarding.js's
// tax step reached that conclusion first). `applies: false` is reported
// alongside `done` and `dismissed` rather than folded into either, because
// it is neither: the company did not do it and did not hide it, and a support
// screen reading the reason a row is absent must not be told a lie.
//
// ══ Pure on purpose ════════════════════════════════════════════════════════
//
// This file never touches the database. The route builds a `snapshot` (one
// tenant-scoped query per signal — lib/setupStepsSnapshot.js) and hands it
// here, so scripts/check-setup-steps.mjs can execute every `doneWhen` against
// fixtures and prove each signal flips exactly one step. Absent signals are
// treated as NOT done, never as done — and, for `appliesWhen`, as APPLYING:
// a snapshot with a field missing means the query did not run, and a step
// must not disappear because of a bug in the thing that decides whether it
// disappears.

import { STANDARD_ADDONS } from "@/app/data/standardAddOns";

/** `from=setup` is what tells the target page to show its "Back to home" link. */
export const SETUP_FROM_PARAM = "setup";

const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const list = (value) => (Array.isArray(value) ? value : []);

/**
 * Standard add-on prices by name, across every trade's catalogue. Used to tell
 * a product the company typed (or repriced) from one FieldQuo seeded and the
 * company never touched. Product has no updatedAt, so "touched" has to be
 * inferred from the row disagreeing with the catalogue it came from.
 */
const STANDARD_PRICES_BY_NAME = (() => {
  const map = new Map();
  for (const items of Object.values(STANDARD_ADDONS || {})) {
    for (const item of items || []) {
      if (!item?.name) continue;
      const set = map.get(item.name) || new Set();
      set.add(Number(item.unitPrice));
      map.set(item.name, set);
    }
  }
  return map;
})();

/** True when this product is byte-for-byte a seeded standard add-on. */
export function isUntouchedStandardAddOn(product) {
  if (!product || typeof product.name !== "string") return false;
  const prices = STANDARD_PRICES_BY_NAME.get(product.name.trim());
  if (!prices) return false;
  const price = product.unitPrice == null ? NaN : Number(product.unitPrice);
  return prices.has(price) && product.active !== false;
}

/**
 * The wording overrides on a service category. Any of the three columns
 * QuoteWording.js writes, non-empty, means somebody opened that panel and
 * changed something — the same test that component uses for its "customised"
 * badge, so the card and the badge agree.
 */
function wordingCustomised(row) {
  if (!row) return false;
  return Boolean(
    (Array.isArray(row.processSteps) && row.processSteps.length) ||
      (Array.isArray(row.includedItems) && row.includedItems.length) ||
      (typeof row.scopeDescription === "string" && row.scopeDescription.trim()),
  );
}

/**
 * How many services signup seeded (lib/setupStepsSnapshot.js). Only a real
 * non-negative integer counts; anything else is "not measured" and reads 0 —
 * which removes nothing on its own, because a thin list still applies.
 */
function seededAtSignup(s) {
  const n = s?.signupSeededServices;
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Active members plus pending invitations — the seats spoken for. */
const seatsUsed = (s) => count(s.activeMembers) + count(s.pendingInvites);

/**
 * "Confirm what you quote" applies to a company with a trade whose seeded
 * services it holds fewer than this many of (or whose trade has no seed file
 * at all). Ten, because the smallest hand-authored seed FieldQuo ships is
 * snow_removal's ten — a narrow, seasonal trade whose contract prices live in
 * its price book, and still judged a complete list. Below ten a trade's list
 * is a scrap of rows other trades tagged for it (caulking_sealants gets one,
 * pressure_washing_house two), not a list a company can quote a month from.
 * Exported for lib/services/confirmServices.js, which picks the trades to
 * draw candidates for by the same number; kept here because this file is
 * the one the dashboard bundle imports, and the seed data must not ride in
 * with it.
 */
export const QUOTE_COVERAGE_MIN = 10;

/**
 * True when some enabled catalogue trade is thin: no seed file of its own, or
 * fewer than QUOTE_COVERAGE_MIN of its seeded services installed. A company
 * with no catalogue trade enabled at all (the "Other" signup, or custom quote
 * types only) has nothing seeded to quote from, so it is thin too. Anything
 * not an array is "not measured" and answers true — see the header.
 */
function quoteCoverageThin(coverage) {
  if (!Array.isArray(coverage)) return true;
  if (coverage.length === 0) return true;
  return coverage.some(
    (c) => !c || c.ownSeed !== true || !(Number(c.installed) >= QUOTE_COVERAGE_MIN),
  );
}

/**
 * The team row first, then "Confirm what you quote", then the ten in the
 * order the owner listed them. `href`
 * carries the anchor or query that lands the reader on the right card of the
 * right page; every id named here exists in the target page's source and
 * scripts/check-setup-steps.mjs greps for each one.
 *
 * `titleKey` + `title`: the key the client renders through t(), and the
 * English that survives if the catalogue entry is ever missing.
 *
 * `appliesWhen` is optional and true by default: only the team, website and
 * confirm-services rows have a reason not to apply (see the header). A step that does not apply is not on
 * the card whatever `done` says.
 *
 * `minutes: [low, high]` is the time estimate printed beside the row. Each is
 * counted from what the editor the row opens asks for to satisfy `doneWhen`
 * — fields, uploads, hand-offs to Stripe or Google — with the count in the
 * comment beside it; the high end is the owner who has to go and find
 * something. Same field, same meaning, as lib/onboarding.js's steps.
 */
export const SETUP_STEPS = [
  {
    key: "team",
    titleKey: "app.setup.step.team",
    title: "Invite your team",
    // No anchor: the Team page IS the section, and the card's own Add
    // Employee popup is the short way to do it without leaving the dashboard.
    href: "/app/settings/team",
    // AddEmployeeModal: name and email (role has a default), Send invite.
    // The high end is looking up the employee's email.
    minutes: [1, 3],
    // Done once somebody other than the owner has been brought in. The
    // onboarding step used to require every licence on the plan spent — a
    // 20-seat company had to invite nineteen people — and was fixed to one
    // teammate; that fix carries over. A Member row appears only when the
    // invitation is accepted, so a pending invite counts too: it holds the
    // seat (that is what the seat check charges for), exactly as it does on
    // GET /api/settings/members/pending, and PendingTeamProfile rows are
    // deleted on acceptance by reconcilePendingProfiles, so nobody is counted
    // twice.
    doneWhen: (s) => seatsUsed(s) > 1,
    // Two reasons the row is not for this company, both facts beating a
    // claim. "It's just me — no crew right now" (Company.worksAloneAt, ticked
    // in Team Settings beside the roster it is about) takes the row off while
    // the owner is the only person on it; the moment somebody is invited the
    // claim stops applying and `done` takes over, which is why the column is
    // never cleared on hire — clearing it would destroy the record of when
    // the owner said it, and hand the owner an unfinishable row again the day
    // that hire leaves. And a plan with no seat left (seatLimit is the plan's
    // total headcount; null is unlimited) has nowhere to put anybody: "buy a
    // bigger plan" is a different thing to do, and the Team page says so
    // itself. An absent or malformed signal APPLIES — see the header.
    appliesWhen: (s) => {
      const used = seatsUsed(s);
      if (s.worksAlone === true && used <= 1) return false;
      const limit = Number(s.seatLimit);
      if (s.seatLimit != null && Number.isFinite(limit) && limit > 0 && used >= limit) return false;
      return true;
    },
  },
  {
    // 2026-09-24, the owner: "if we don't have [services for their industry]
    // we should ask to confirm which are the items they quote." Second on the
    // card because every quote after it is built from the answer.
    key: "confirm_services",
    titleKey: "app.setup.step.confirm_services",
    title: "Confirm what you quote",
    href: "/app/settings/services/confirm#confirm-services",
    // ConfirmServices: read one list of 20–120 candidate rows grouped by
    // heading, tick the ones you sell (prices are prefilled), one button.
    // The high end adds two or three services of their own through the
    // product form (name, price, unit each) that nothing on the list covers.
    minutes: [3, 10],
    // 2026-09-25, the owner: "they might not do it — it is loaded by
    // default, so if it is loaded by default it should say so." A company
    // whose trades all have a list, and whose signup seeded services
    // (s.signupSeededServices — lib/services/addedForYou.js counts them from
    // the rows' own creation times), reads "Review the services we added for
    // you (N)". A company with a thin or missing list keeps "Confirm what you
    // quote" — the ask there is to fill a gap, not to review what we added.
    // The count sits in brackets rather than in the sentence so no language
    // has to decline "service" for it.
    titleWhen: (s) => {
      if (quoteCoverageThin(s.quoteCoverage)) return null;
      const n = seededAtSignup(s);
      return n > 0
        ? { titleKey: "app.setup.step.confirm_services_seeded", title: "Review the services we added for you ({n})", titleParams: { n } }
        : null;
    },
    // Company.servicesConfirmedAt, stamped by POST /api/settings/products/
    // confirm-services — the confirm button, which a company that sells
    // nothing on the list may press with nothing ticked. Nothing else
    // distinguishes "looked and agreed" from "never opened": the Product rows
    // a company holds say what it has, not that it checked.
    doneWhen: (s) => s.servicesConfirmed === true,
    // Two reasons to apply, either is enough:
    //   - a trade FieldQuo cannot already list: no seed file, fewer than
    //     QUOTE_COVERAGE_MIN seeded services installed, or no catalogue trade
    //     at all (2026-09-24). An absent signal APPLIES;
    //   - signup seeded services the owner never chose (2026-09-25, the
    //     owner overruling the first version, which kept a plumber with 101
    //     seeded rows off the card: "if it is loaded by default it should say
    //     so"). A company with nothing seeded and a full list has nothing to
    //     review, and the row does not apply.
    // Done and "Done, hide" work exactly as before either way.
    appliesWhen: (s) => quoteCoverageThin(s.quoteCoverage) || seededAtSignup(s) > 0,
  },
  {
    key: "overhead",
    titleKey: "app.setup.step.overhead",
    title: "Enter your overhead",
    href: "/app/settings/overhead#fixed-costs",
    // FixedCostsEditor: name, amount, frequency per row. One row satisfies
    // `doneWhen`, but an honest entry — rent, insurance, the van, software —
    // is four to six amounts to look up.
    minutes: [2, 8],
    // The four tables lib/analytics/burnRate.js sums. A recurring overhead
    // expense, a salary, a loan or an asset — any one of them is overhead
    // entered. The capacity figure (ForecastSettings) is deliberately NOT a
    // signal: it defaults to 3 on the row, so a row's existence says nothing.
    doneWhen: (s) =>
      count(s.overheadFixedCosts) +
        count(s.overheadSalaries) +
        count(s.overheadDebts) +
        count(s.overheadAssets) >
      0,
  },
  {
    key: "payment_schedule",
    titleKey: "app.setup.step.payment_schedule",
    title: "Set up your payment schedule",
    href: "/app/settings/company#payment-schedule",
    // PaymentScheduleEditor: usually two stages (deposit, balance) — label
    // and trigger prefilled, one percentage each, totals must reach 100.
    minutes: [1, 3],
    // One PaymentScheduleStage row is a schedule: validate.js refuses a set
    // that does not sum to 100, so a company with any row has a whole one.
    doneWhen: (s) => count(s.paymentScheduleStages) > 0,
  },
  // ── The client proposal (2026-09-21, client mockup §2) ──────────────────
  //
  // Four rows for what a homeowner reads BESIDE the quote. Each is measured
  // on the rows the proposal itself reads (lib/proposal/load.js): the story
  // column, the one gallery, a client-visible document, a connected Google
  // Business Profile or an approved testimonial. Each opens in the home
  // page's dialog around the SAME editor Settings › Presentation renders.
  {
    key: "story",
    titleKey: "app.setup.step.story",
    title: "Add your company story",
    href: "/app/settings/presentation#story",
    // StoryEditor: one paragraph of prose (headline, photo, video optional).
    // Writing, not form-filling — the widest of the short ones.
    minutes: [3, 10],
    doneWhen: (s) => s.storySet === true,
  },
  {
    key: "gallery",
    titleKey: "app.setup.step.gallery",
    title: "Upload before & after photos",
    href: "/app/settings/presentation#gallery",
    // GalleryEditor: two uploads (before, after); saves itself once both are
    // in. The time is finding the pair on a phone.
    minutes: [2, 5],
    doneWhen: (s) => count(s.galleryPairs) > 0,
  },
  {
    key: "documents",
    titleKey: "app.setup.step.documents",
    title: "Upload your insurance, licence and documents",
    href: "/app/settings/presentation#documents",
    // CompanyDocumentsEditor: one file, a title, ideally its expiry date.
    // The certificate itself has to be found first.
    minutes: [3, 8],
    // A document a client can currently open: marked show-on-quotes, not
    // archived, not a waiver, not expired. An expired certificate takes the
    // row BACK onto the card — see lib/company/documents.js.
    doneWhen: (s) => count(s.clientDocuments) > 0,
  },
  {
    key: "google_reviews",
    titleKey: "app.setup.step.google_reviews",
    title: "Connect Google reviews",
    href: "/app/settings/reviews#google-business",
    // GoogleBusiness: one click, Google's sign-in and consent screens, back.
    minutes: [1, 3],
    doneWhen: (s) => s.googleReviewsConnected === true || count(s.approvedTestimonials) > 0,
  },
  {
    key: "quote_process",
    titleKey: "app.setup.step.quote_process",
    title: "Review the job process on your quotes",
    href: "/app/settings/services#quote-wording",
    // QuoteWording: every line is prefilled; changing one and saving is
    // enough. Most of the time is reading the default wording.
    minutes: [2, 5],
    // An enabled category whose wording the company overrode. A company that
    // read the default steps and liked them leaves no trace — that is what
    // the hide control is for.
    doneWhen: (s) => list(s.enabledCategories).some(wordingCustomised),
  },
  {
    key: "ai_credits",
    titleKey: "app.setup.step.ai_credits",
    title: "Add AI credits",
    href: "/app/settings/ai-credit#ai-credit",
    // AiCreditCard: pick one top-up amount, then Stripe Checkout (a card to
    // type), then back.
    minutes: [2, 4],
    // A positive AI-pool balance (lib/voice/credits.js balanceFor, pool "ai")
    // or a monthly bundle subscription — either is credit to spend.
    doneWhen: (s) => count(s.aiCreditCents) > 0 || Boolean(s.aiCreditBundle),
  },
  {
    key: "instant_quotes",
    titleKey: "app.setup.step.instant_quotes",
    title: "Enable instant quotes",
    href: "/app/settings/instant-quotes#trades",
    // TradeCard: one toggle and "Save & enable"; ranges are prefilled from
    // the service prices, so reviewing them is optional.
    minutes: [1, 3],
    doneWhen: (s) => count(s.instantQuotesEnabled) > 0,
  },
  {
    key: "availability",
    titleKey: "app.setup.step.availability",
    title: "Check your availability for bookings",
    href: "/app/settings/availability#bookable",
    // AvailabilityEditor: tick the days (hours prefilled 08:00–16:00), adjust
    // a few, Save.
    minutes: [1, 3],
    // Bookable hours (AvailabilitySchedule — the PUBLIC window, not
    // WorkingHours) for at least one active member. An EventType on its own
    // is not enough: with no hours behind it the booking page offers nothing.
    doneWhen: (s) => count(s.bookableScheduleRows) > 0,
  },
  {
    key: "materials",
    titleKey: "app.setup.step.materials",
    title: "Review cost and material recipes",
    href: "/app/settings/material-costs#recipes",
    // MaterialCostsEditor: a real review is 8–12 figures per trade (cost per
    // unit, coverage, coats) from a supplier's price list.
    minutes: [2, 8],
    // A saved recipe override, or a rate card the company edited (the `rates`
    // column on a category is written only by RateCard's save).
    doneWhen: (s) =>
      count(s.materialRecipeSettings) > 0 ||
      list(s.enabledCategories).some(
        (row) => row?.rates != null && typeof row.rates === "object",
      ),
  },
  {
    key: "add_ons",
    titleKey: "app.setup.step.add_ons",
    title: "Review your add-ons",
    href: "/app/settings/products#catalogue",
    // ProductCatalogue: reprice one standard add-on, or add one (name and
    // price), Save.
    minutes: [1, 3],
    // Done when the catalogue holds anything that is not a seeded standard
    // add-on exactly as shipped: an item the company added, repriced, renamed
    // or switched off. All-standard-and-untouched, or empty, stays on the
    // card — "reviewed and agreed" is indistinguishable from "never opened",
    // and the hide control is the honest answer for that case.
    doneWhen: (s) => {
      const products = list(s.products);
      return products.length > 0 && products.some((p) => !isUntouchedStandardAddOn(p));
    },
  },
  {
    key: "emails",
    titleKey: "app.setup.step.emails",
    title: "Review your emails",
    href: "/app/settings/email-templates#templates",
    // DocumentEmails: Customise one email, change a line (subject, intro,
    // closing or signature), Save.
    minutes: [2, 5],
    // Any of: a verified sending domain, a template the company edited after
    // it was seeded (seedDefaultTemplates writes every company a starter set,
    // so a template's existence proves nothing — its updatedAt moving does),
    // or a quote-email section switched on. Company.email is set at signup
    // for everyone, so reply-to is NOT a signal — it would tick itself.
    doneWhen: (s) =>
      s.emailDomainVerified === true ||
      count(s.editedEmailTemplates) > 0 ||
      s.quoteEmailSectionsOn === true,
  },
  {
    key: "import_jobs",
    titleKey: "app.setup.step.import_jobs",
    title: "Import older jobs",
    href: "/app/jobs/import",
    // PastJobsEntry: six required fields per job (client, description, start
    // date, amount, paid date, method) from one old invoice to look up.
    minutes: [3, 6],
    // Invoice.historicalImportedAt is stamped by the import at /app/jobs/import.
    // The snapshot reports null (not 0) while that column is not yet in the
    // generated client, and null is "not done" here — see the snapshot.
    doneWhen: (s) => count(s.historicalImports) > 0,
  },
  {
    key: "website",
    titleKey: "app.setup.step.website",
    title: "Create your website",
    // The website builder is a page, not a dialog: no panel in
    // stepPanels.js, so the row stays a link. No anchor — the page IS it.
    href: "/app/settings/website",
    // Builder.js: describe the business in one box and Generate (the copy is
    // written from the company's own services and reviews), look it over,
    // swap the stock photos for a couple of their own, Publish. The low end
    // takes the generated site as it comes; the high end is someone who
    // rewrites sections and uploads photos first.
    minutes: [5, 15],
    // Published through the builder: CompanySite.published, the flag the
    // public /site route serves on.
    doneWhen: (s) => s.sitePublished === true,
    // For a company that said at signup it has NO website, or never
    // answered (Company.hasWebsite false / null — lib/signup/website.js).
    // One that said yes, or has an address on file, already has a site;
    // offering to build a second is noise. An absent signal APPLIES.
    appliesWhen: (s) => s.hasOwnWebsite !== true,
  },
];

export const SETUP_STEP_KEYS = SETUP_STEPS.map((s) => s.key);

/** Keep only known keys, deduplicated, in catalogue order. */
export function normaliseDismissed(value) {
  const wanted = new Set(list(value).filter((k) => typeof k === "string"));
  return SETUP_STEP_KEYS.filter((k) => wanted.has(k));
}

/**
 * `?from=setup` spliced in BEFORE the `#anchor`. Appending it to the end would
 * make the browser read "fixed-costs?from=setup" as the fragment: no element
 * has that id, so the page would not scroll, and the target page would not
 * see the param, so no "Back to home" link either — both halves of the link
 * dead at once.
 */
export function withSetupParam(href) {
  const hashAt = href.indexOf("#");
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}from=${SETUP_FROM_PARAM}${hash}`;
}

/**
 * Every step with its measured `done`, stored `dismissed` and measured
 * `applies`. The client hides anything done, dismissed or not applying; all
 * three are returned so the check script (and a support screen, one day) can
 * see WHY a row is absent.
 */
export function stepsFor(snapshot = {}) {
  const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
  const dismissed = new Set(normaliseDismissed(snap.dismissed));
  return SETUP_STEPS.map((step) => {
    let done = false;
    try {
      done = step.doneWhen(snap) === true;
    } catch {
      // A malformed signal is "not measured", and not measured is not done.
      done = false;
    }
    let applies = true;
    try {
      applies = step.appliesWhen ? step.appliesWhen(snap) !== false : true;
    } catch {
      // The same rule the other way up: a signal that cannot be read must not
      // remove a row.
      applies = true;
    }
    // A step may reword its title from the snapshot (confirm_services says
    // how many services signup added). Same rule as the signals: a title
    // that cannot be worked out is the step's own, never a blank row.
    let titled = null;
    try {
      titled = step.titleWhen ? step.titleWhen(snap) : null;
    } catch {
      titled = null;
    }
    return {
      key: step.key,
      titleKey: titled?.titleKey || step.titleKey,
      title: titled?.title || step.title,
      titleParams: titled?.titleParams || null,
      href: withSetupParam(step.href),
      minutes: step.minutes,
      done,
      dismissed: dismissed.has(step.key),
      applies,
    };
  });
}

/** The rows the card actually shows: not done, not hidden, and applicable. */
export function remainingSteps(steps) {
  return list(steps).filter((s) => !s.done && !s.dismissed && s.applies !== false);
}

/**
 * The card's progress line: "3 of 14 done · 2 hidden".
 *
 * Counted over the steps that APPLY — a step that does not apply is neither
 * done nor outstanding, and counting it in the total would promise the owner
 * a row they can never see. A hidden step is NOT counted as done: "Done,
 * hide" says "stop showing me this", and nothing in the database says the
 * thing was done, so the card reports it separately rather than inflating
 * progress with a claim it cannot check. A step that is done AND was hidden
 * is done — the measurement wins over the preference.
 */
export function setupProgress(steps) {
  const applicable = list(steps).filter((s) => s && s.applies !== false);
  const done = applicable.filter((s) => s.done === true).length;
  const hidden = applicable.filter((s) => s.done !== true && s.dismissed === true).length;
  return { done, hidden, total: applicable.length };
}
