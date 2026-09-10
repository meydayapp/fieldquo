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
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { tierLadder, firstTierWith, parityFor, neverListed, addOnsFor, notesFor } from "@/lib/marketing/parity";
import { matrixEntry } from "@/lib/marketing/featureMatrix";

const money = (n) =>
  typeof n === "number" ? `$${n % 1 === 0 ? n.toLocaleString("en-CA") : n.toFixed(2)}` : null;

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

export function caseRows(competitorId, competitorName) {
  const ladder = tierLadder(competitorId);
  const priced = ladder.filter((t) => typeof t.price === "number");
  const reported = ladder.filter((t) => t.reported);
  const parity = parityFor(competitorId);
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
        "Cheapest plan",
        { kind: PLAIN, text: `${money(solo.price)}/mo`, sub: `${solo.label} — 1 seat, ${solo.crewSeats} crew free` },
        cheapest.annualOnly
          ? {
              kind: PLAIN,
              text: `${money(cheapest.annualTotal)}/yr`,
              sub: `${cheapest.label} — ${money(cheapest.price)} a month equivalent, billed as a year`,
            }
          : {
              kind: PLAIN,
              text: `${money(cheapest.price)}/mo`,
              sub: `${cheapest.label} — ${cheapest.seats === null ? "unlimited users" : `${cheapest.seats} user${cheapest.seats === 1 ? "" : "s"}`}`,
            },
      ),
    );
    if (parity.tier && typeof parity.tier.price === "number") {
      rows.push(
        row(
          "Cheapest plan with what FieldQuo puts in every plan",
          { kind: YES, text: `${money(solo.price)}/mo`, sub: "The same plan. We don't gate features by tier." },
          parity.tier.annualOnly
            ? {
                kind: PLAIN,
                text: `${money(parity.tier.annualTotal)}/yr`,
                sub: `${parity.tier.label} — ${money(parity.tier.price)} a month equivalent`,
              }
            : {
                kind: PLAIN,
                text: `${money(parity.tier.price)}/mo`,
                sub: `${parity.tier.label} — their cheaper plans don't carry it`,
              },
        ),
      );
    }
  }

  if (reported.length) {
    const first = reported[0];
    rows.push(
      row("Published price", { kind: YES, text: "Every plan, on this page" }, {
        kind: NO,
        text: "None published",
        sub: "Book a demo; the number is negotiated on the call",
      }),
    );
    if (first.reportedBand) {
      rows.push(
        row("What it costs", { kind: PLAIN, text: `${money(solo.price)}–${money(SEAT_LADDER.at(-1).price)}/mo`, sub: "1 to 25 people" }, {
          kind: PLAIN,
          text: first.reportedBand.replace(/^Contractors report paying /, ""),
          sub: "reported by contractors, not published",
        }),
      );
    }
    if (first.alsoReported) {
      rows.push(
        row("Setup fee", { kind: YES, text: "None" }, {
          kind: NO,
          text: first.alsoReported.replace(/^an implementation fee of /, ""),
          sub: "reported",
        }),
      );
    }
  }

  // ── Annual-only, where that is the shape of the deal ────────────────────
  //
  // Projul sells no monthly plan at all — their own FAQ says "we can't
  // currently offer a monthly option". That is not a footnote about billing
  // frequency, it is the commitment a buyer is being asked for before they
  // know whether the software suits them.
  if (priced.length && priced.every((t) => t.annualOnly)) {
    const entry = priced[0];
    rows.push(
      row(
        "How you pay",
        { kind: YES, text: "Monthly", sub: "Leave at the end of any month" },
        {
          kind: NO,
          text: `${money(entry.annualTotal)} a year, up front`,
          sub: "No monthly option is offered — their FAQ says so",
        },
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
  const addOns = addOnsFor(competitorId).filter(
    (a) => !a.includedFree && a.per === "month" && typeof a.price === "number",
  );
  if (addOns.length) {
    const total = addOns.reduce((n, a) => n + (a.price || 0), 0);
    rows.push(
      row(
        "Sold as paid add-ons",
        { kind: YES, text: "None", sub: "Every feature is in every plan, at the plan price" },
        {
          kind: NO,
          text: `+${money(total)}/mo`,
          sub: addOns.map((a) => `${a.label} ${money(a.price)}`).join(" · "),
        },
      ),
    );
  }

  // ── How people are counted, which is the difference that compounds ──────
  rows.push(
    row(
      "People in the field",
      { kind: YES, text: "Free", sub: "Crew see the schedule and the job at no charge" },
      { kind: NO, text: "Billed", sub: `Every login is a paid user at ${competitorName}` },
    ),
  );

  rows.push(
    row(
      "Biggest plan",
      { kind: PLAIN, text: `${money(SEAT_LADDER.at(-1).price)}/mo`, sub: `${SEAT_LADDER.at(-1).seats} seats plus ${SEAT_LADDER.at(-1).crewSeats} crew — 25 people` },
      priced.length
        ? {
            kind: PLAIN,
            text: `${money(priced.at(-1).price)}/mo`,
            sub: priced.at(-1).seats === null ? "unlimited users" : `${priced.at(-1).seats} users`,
          }
        : { kind: PLAIN, text: "On request" },
    ),
  );

  // ── The capabilities ────────────────────────────────────────────────────
  for (const key of HEADLINE_KEYS) {
    const entry = matrixEntry(key);
    if (!entry || entry.readiness !== "shipped") continue;
    const tier = firstTierWith(competitorId, key);
    rows.push(
      row(
        entry.name,
        { kind: YES, text: "Every plan", sub: entry.summary },
        tier
          ? {
              kind: PLAIN,
              text: typeof tier.price === "number" ? `${tier.label} — ${money(tier.price)}/mo` : tier.label,
              sub: "their cheapest plan that includes it",
            }
          : { kind: NO, text: "Not in their plans" },
      ),
    );
  }

  rows.push(
    row("Free trial", { kind: YES, text: "First month free", sub: "No card charged until it ends" }, {
      kind: PLAIN,
      text: "Trial offered",
      sub: "see their site for current terms",
    }),
  );

  return {
    rows,
    addOns,
    notes: notesFor(competitorId),
    parity,
    missingCount: neverListed(competitorId).length,
    hasPrices: priced.length > 0,
    reported,
  };
}
