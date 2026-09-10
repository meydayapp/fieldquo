// app/(marketing)/compare/caseRows.js
//
// The head-to-head rows, decided from data rather than written per page.
//
// ══ Why the rows are computed ═════════════════════════════════════════════
//
// Five competitors, one page template. A hand-written row per page is five
// copies of the same claim that drift apart the first time a price moves —
// AGENTS.md failure class 4, and the copy that rots is the one nobody looks
// at. So every row here is derived: from SEAT_LADDER for our side, from the
// competitor's own published tiers for theirs.
//
// ══ Why a row may say "not listed" and never "they don't have it" ═════════
//
// The strong claim is available and is the one the owner asked for, but it has
// to survive a prospect opening their pricing page in the next tab. So the row
// renders what is CHECKABLE — the capability is not in their published plans —
// which is both the honest sentence and, for somebody choosing what to buy,
// the damning one. A rep is never left holding a claim their own page
// contradicts.
//
// ══ On the translator ═════════════════════════════════════════════════════
//
// `caseRows(competitorId, competitorName, t, locale)`. Both extra arguments are
// optional and every t() call carries the English literal that used to be here,
// so a caller with neither — scripts/check-compare-pages.mjs, and anything
// rendering outside a LanguageProvider — gets exactly the rows it got before
// these pages were translated.
//
// What is NOT translated here, on purpose: the competitor's own tier labels
// (`cheapest.label`, `parity.tier.label`) and the band a contractor reported.
// They are quotations. See lib/marketing/compareLabels.js for the argument.
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import {
  tierLadder,
  firstTierWith,
  parityFor,
  neverListed,
  addOnsFor,
  notesFor,
  derivedMonthlyFromAnnual,
  derivationProps,
} from "@/lib/marketing/parity";
import { competitor as findCompetitor, reportedCostText } from "@/lib/marketing/competitors";
import { matrixEntry } from "@/lib/marketing/featureMatrix";
import { featureEntry } from "@/lib/marketing/featureLabels";

// Locale-aware grouping, defaulted to the Canadian English the rows used to be
// built with. A French-Canadian reader gets "1 250", which is the same figure
// and the only one that reads as a number to them.
const moneyIn = (locale) => (n) =>
  typeof n === "number"
    ? `$${n % 1 === 0 ? n.toLocaleString(locale) : n.toFixed(2)}`
    : null;

export const YES = "yes";
export const NO = "no";
export const PLAIN = "plain";

/**
 * The capabilities the head-to-head leads on.
 *
 * Chosen because each one is in EVERY FieldQuo plan and is either gated high
 * or absent everywhere else — which is the argument, stated as a table. Read
 * from the matrix rather than retyped, so a feature renamed once is renamed
 * here too.
 */
const HEADLINE_KEYS = [
  "website_builder",
  "ai_quote_review",
  "instant_quotes",
  "self_quote",
  "kitchen_designer",
  "voice_receptionist",
  "client_portal",
  "white_label",
];

/** One row: a label, our cell, theirs. */
function row(label, mine, theirs, note = null) {
  return { label, mine, theirs, note };
}

/**
 * Data attributes a cell carries into the markup.
 *
 * Not decoration and not styling. Three of the cells below print an amount
 * nobody publishes — a saving, an annual price said per month — and
 * scripts/check-compare-pages.mjs has to be able to tell those apart from a
 * figure read off a pricing page, ROW BY ROW. A flat search of the page cannot:
 * $399 is Jobber's Grow tier and also Projul's annual fee divided by twelve,
 * and the two need opposite treatment. See the derivation block in
 * lib/marketing/parity.js for the rule these attributes let it enforce.
 */
const withAttrs = (cell, attrs) =>
  attrs && Object.keys(attrs).length ? { ...cell, attrs } : cell;

/** A tier's annual fee said per month, or null when it does not divide clean. */
const monthlyEquivalent = (tier) =>
  tier?.annualOnly && tier.monthlyExact ? derivedMonthlyFromAnnual(tier.annualTotal) : null;

export function caseRows(competitorId, competitorName, t, locale = "en-CA", asOf = null) {
  const money = moneyIn(locale);
  const say = (key, fallback, values) =>
    typeof t === "function"
      ? t(key, fallback, values)
      : String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
          values?.[name] !== undefined ? String(values[name]) : m,
        );
  const perMo = (amount) => say("compare.rows.perMo", "{amount}/mo", { amount });
  const perYr = (amount) => say("compare.rows.perYr", "{amount}/yr", { amount });
  const users = (n) =>
    n === null
      ? say("compare.rows.unlimitedUsers", "unlimited users")
      : say(
          n === 1 ? "compare.rows.usersOne" : "compare.rows.users",
          n === 1 ? "{count} user" : "{count} users",
          { count: n },
        );

  const ladder = tierLadder(competitorId, asOf);
  const priced = ladder.filter((tier) => typeof tier.price === "number");
  const reported = ladder.filter((tier) => tier.reported);
  const parity = parityFor(competitorId, { asOf });
  const solo = SEAT_LADDER[0];
  const rows = [];

  // ── Price, both readings ────────────────────────────────────────────────
  //
  // Their cheapest published plan first, because hiding it is what gets a page
  // caught, and because the row directly under it is the one that wins.
  if (priced.length) {
    const cheapest = priced[0];
    rows.push(
      row(
        say("compare.rows.cheapestPlan", "Cheapest plan"),
        {
          kind: PLAIN,
          text: perMo(money(solo.price)),
          sub: say("compare.rows.soloSub", "{plan} — 1 seat, {crew} crew free", {
            plan: solo.label,
            crew: solo.crewSeats,
          }),
        },
        cheapest.annualOnly
          ? withAttrs(
              {
                kind: PLAIN,
                text: perYr(money(cheapest.annualTotal)),
                // The annual total is what they publish; the monthly beside it
                // is that number divided by twelve, and it is printed only
                // when the division leaves nothing over. An annual fee that is
                // not a multiple of twelve has no monthly equivalent to state
                // — rounding one into existence and calling it "equivalent"
                // is the approximated money this site does not print.
                sub: monthlyEquivalent(cheapest)
                  ? say(
                      "compare.rows.annualEquivalent",
                      "{plan} — {amount} a month equivalent, billed as a year",
                      { plan: cheapest.label, amount: money(cheapest.price) },
                    )
                  : say("compare.rows.annualOnlyPlain", "{plan} — billed as a year", {
                      plan: cheapest.label,
                    }),
              },
              derivationProps(monthlyEquivalent(cheapest)),
            )
          : {
              kind: PLAIN,
              text: perMo(money(cheapest.price)),
              sub: say("compare.rows.tierUsers", "{plan} — {users}", {
                plan: cheapest.label,
                users: users(cheapest.seats),
              }),
            },
      ),
    );
    if (parity.tier && typeof parity.tier.price === "number") {
      rows.push(
        row(
          say(
            "compare.rows.parityLabel",
            "Cheapest plan with what FieldQuo puts in every plan",
          ),
          {
            kind: YES,
            text: perMo(money(solo.price)),
            sub: say(
              "compare.rows.paritySub",
              "The same plan. We don't gate features by tier.",
            ),
          },
          parity.tier.annualOnly
            ? withAttrs(
                {
                  kind: PLAIN,
                  text: perYr(money(parity.tier.annualTotal)),
                  sub: monthlyEquivalent(parity.tier)
                    ? say("compare.rows.parityAnnual", "{plan} — {amount} a month equivalent", {
                        plan: parity.tier.label,
                        amount: money(parity.tier.price),
                      })
                    : say("compare.rows.annualOnlyPlain", "{plan} — billed as a year", {
                        plan: parity.tier.label,
                      }),
                },
                derivationProps(monthlyEquivalent(parity.tier)),
              )
            : {
                kind: PLAIN,
                text: perMo(money(parity.tier.price)),
                sub: say(
                  "compare.rows.parityTheirs",
                  "{plan} — their cheaper plans don't carry it",
                  { plan: parity.tier.label },
                ),
              },
        ),
      );
    }
  }

  if (reported.length) {
    const first = reported[0];
    // The provenance a reported band may never be printed without.
    // competitors.js is unambiguous that reportedCostText() is "the sentence a
    // renderer prints for a reported cost. There is no other one" — it names
    // the band, the KINDS of source that reported it and the fact that the
    // vendor publishes nothing, and where the sources state no currency it
    // says so. This module was printing the band with a two-word label of its
    // own and dropping the rest, which mattered most for the half nobody would
    // think to miss: a Canadian reader who takes "$245" for his own dollar is
    // reading a number about 38% too small.
    const reportedEntry = (findCompetitor(competitorId)?.reportedCosts || []).find(
      (r) => r.id === first.reportedId,
    );
    const reportedProvenance = reportedEntry
      ? reportedCostText(reportedEntry, { subject: competitorName })
      : null;
    rows.push(
      row(
        say("compare.rows.publishedPrice", "Published price"),
        {
          kind: YES,
          text: say("compare.rows.everyPlanOnThisPage", "Every plan, on this page"),
        },
        {
          kind: NO,
          text: say("compare.rows.nonePublished", "None published"),
          sub: say(
            "compare.rows.bookDemo",
            "Book a demo; the number is negotiated on the call",
          ),
        },
      ),
    );
    if (first.reportedBand) {
      rows.push(
        row(
          say("compare.rows.whatItCosts", "What it costs"),
          {
            kind: PLAIN,
            text: perMo(`${money(solo.price)}–${money(SEAT_LADDER.at(-1).price)}`),
            sub: say("compare.rows.oneToTwentyFive", "1 to 25 people"),
          },
          withAttrs(
            {
              // Their reported band is what a contractor said they paid.
              // Quoted, never translated.
              kind: PLAIN,
              text: first.reportedBand.replace(/^Contractors report paying /, ""),
              sub: say(
                "compare.rows.reportedNotPublished",
                "reported by contractors, not published",
              ),
              // Untranslated on purpose, like the band above it: it names two
              // sources and a currency caveat, and a machine-translated
              // sentence about somebody else's prices is one nobody has read
              // in the language it is published in.
              foot: reportedProvenance,
            },
            { "data-reported-cost": first.reportedId },
          ),
        ),
      );
    }
    if (first.alsoReported) {
      rows.push(
        row(
          say("compare.rows.setupFee", "Setup fee"),
          { kind: YES, text: say("compare.rows.none", "None") },
          withAttrs(
            {
              kind: NO,
              text: first.alsoReported.replace(/^an implementation fee of /, ""),
              sub: say("compare.rows.reported", "reported"),
              foot: reportedProvenance,
            },
            { "data-reported-cost": first.reportedId },
          ),
        ),
      );
    }
  }

  // ── Annual-only, where that is the shape of the deal ────────────────────
  //
  // Projul sells no monthly plan at all — their own FAQ says "we can't
  // currently offer a monthly option". That is not a footnote about billing
  // frequency, it is the commitment a buyer is being asked for before they
  // know whether the software suits them.
  if (priced.length && priced.every((tier) => tier.annualOnly)) {
    const entry = priced[0];
    rows.push(
      row(
        say("compare.rows.howYouPay", "How you pay"),
        {
          kind: YES,
          text: say("compare.rows.monthly", "Monthly"),
          sub: say("compare.rows.leaveAnyMonth", "Leave at the end of any month"),
        },
        withAttrs(
          {
            kind: NO,
            text: say("compare.rows.aYearUpFront", "{amount} a year, up front", {
              amount: money(entry.annualTotal),
            }),
            sub: say(
              "compare.rows.noMonthlyOption",
              "No monthly option is offered — their FAQ says so",
            ),
          },
          // The page-level disclosure that licenses every per-month figure on
          // a Projul page. Their monthly numbers are ours to compute, not
          // theirs to charge, and this row is where a reader is told that in
          // the plainest terms available: the amount they publish, per year,
          // up front, with no monthly option offered.
          { "data-annual-only": competitorId },
        ),
      ),
    );
  }

  // ── What the sticker price leaves out ───────────────────────────────────
  //
  // The strongest true line available on Jobber, and it is computed from their
  // own pricing page rather than asserted: the marketing suite, the AI
  // receptionist and the sales pipeline are sold SEPARATELY at every tier
  // below Plus, and all three are standard on every FieldQuo plan. A Grow
  // buyer who wants what we include is paying Grow plus $177 a month.
  // Only what a buyer is actually CHARGED, and only what is charged monthly.
  //
  // Projul's support package is $4,500 a YEAR and their page marks it "FREE
  // with annual plan" — and every Projul plan is annual, so it is free full
  // stop. Summing it blindly printed "+$4,500/mo" beside their name: a false
  // claim, on their own published terms, that a prospect disproves in one
  // click and that discredits every true row above it.
  const addOns = addOnsFor(competitorId, asOf).filter(
    (a) => !a.includedFree && a.per === "month" && typeof a.price === "number",
  );
  if (addOns.length) {
    const total = addOns.reduce((n, a) => n + (a.price || 0), 0);
    rows.push(
      row(
        say("compare.rows.paidAddOns", "Sold as paid add-ons"),
        {
          kind: YES,
          text: say("compare.rows.none", "None"),
          sub: say(
            "compare.rows.everyFeature",
            "Every feature is in every plan, at the plan price",
          ),
        },
        {
          kind: NO,
          text: say("compare.rows.plusPerMo", "+{amount}/mo", { amount: money(total) }),
          // Their add-on names are theirs — "Marketing Suite" stays "Marketing
          // Suite" in every language, the way a tier name does.
          sub: addOns.map((a) => `${a.label} ${money(a.price)}`).join(" · "),
        },
      ),
    );
  }

  // ── How people are counted, which is the difference that compounds ──────
  rows.push(
    row(
      say("compare.rows.peopleInField", "People in the field"),
      {
        kind: YES,
        text: say("compare.rows.free", "Free"),
        sub: say(
          "compare.rows.crewFreeSub",
          "Crew see the schedule and the job at no charge",
        ),
      },
      {
        kind: NO,
        text: say("compare.rows.billed", "Billed"),
        sub: say("compare.rows.everyLoginPaid", "Every login is a paid user at {competitor}", {
          competitor: competitorName,
        }),
      },
    ),
  );

  rows.push(
    row(
      say("compare.rows.biggestPlan", "Biggest plan"),
      {
        kind: PLAIN,
        text: perMo(money(SEAT_LADDER.at(-1).price)),
        sub: say(
          "compare.rows.biggestSub",
          "{seats} seats plus {crew} crew — 25 people",
          { seats: SEAT_LADDER.at(-1).seats, crew: SEAT_LADDER.at(-1).crewSeats },
        ),
      },
      priced.length
        ? {
            kind: PLAIN,
            // Their own unit, not ours. Quoting an annual-only vendor a month
            // at a time in the one row a buyer uses to size the top of the
            // ladder invents a billing option they do not sell.
            text: priced.at(-1).annualOnly
              ? perYr(money(priced.at(-1).annualTotal))
              : perMo(money(priced.at(-1).price)),
            sub: users(priced.at(-1).seats),
          }
        : { kind: PLAIN, text: say("compare.rows.onRequest", "On request") },
    ),
  );

  // ── The capabilities ────────────────────────────────────────────────────
  for (const key of HEADLINE_KEYS) {
    // readiness comes off the matrix, which is English data; the NAME and
    // SUMMARY are resolved through featureLabels.js so the head-to-head reads
    // in the same language as the rest of the page. This was the exact bug
    // featureLabels.js was written for, one surface along.
    const entry = matrixEntry(key);
    if (!entry || entry.readiness !== "shipped") continue;
    const said = featureEntry(key, t) ?? entry;
    const tier = firstTierWith(competitorId, key, asOf);
    rows.push(
      row(
        said.name,
        { kind: YES, text: say("compare.rows.everyPlan", "Every plan"), sub: said.summary },
        tier
          ? {
              kind: PLAIN,
              text:
                typeof tier.price !== "number"
                  ? tier.label
                  : tier.annualOnly
                    ? say("compare.rows.tierAtAnnualPrice", "{plan} — {amount}/yr", {
                        plan: tier.label,
                        amount: money(tier.annualTotal),
                      })
                    : say("compare.rows.tierAtPrice", "{plan} — {amount}/mo", {
                        plan: tier.label,
                        amount: money(tier.price),
                      }),
              sub: say(
                "compare.rows.theirCheapestWithIt",
                "their cheapest plan that includes it",
              ),
            }
          : { kind: NO, text: say("compare.rows.notInTheirPlans", "Not in their plans") },
      ),
    );
  }

  rows.push(
    row(
      say("compare.rows.freeTrial", "Free trial"),
      {
        kind: YES,
        text: say("compare.rows.firstMonthFree", "First month free"),
        sub: say("compare.rows.noCardCharged", "No card charged until it ends"),
      },
      {
        kind: PLAIN,
        text: say("compare.rows.trialOffered", "Trial offered"),
        sub: say("compare.rows.seeTheirSite", "see their site for current terms"),
      },
    ),
  );

  return {
    rows,
    addOns,
    notes: notesFor(competitorId),
    parity,
    missingCount: neverListed(competitorId, asOf).length,
    hasPrices: priced.length > 0,
    reported,
  };
}
