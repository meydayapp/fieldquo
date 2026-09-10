// scripts/check-sales-playbook-battlecards.mjs
//
//   npm run check:sales-playbook-battlecards
//
// The competitor facts a rep says out loud, and the one thing that must be
// true of all of them: they came from the same rows the public comparison
// pages render.
//
// ══ What this is actually guarding ═══════════════════════════════════════
//
// Not "is the battlecard nice". Four specific ways it could become a liability:
//
//   1. A CLAIM WITHOUT A SOURCE reaching a rep. competitors.js draws an
//      asymmetric publishability bar — a concession may rest on the owner's
//      signed assertion, an advantage needs the competitor's own page — and a
//      cold call is a more exposed surface than a web page, not a less exposed
//      one. A page can be corrected in an hour; a sentence said down a phone
//      cannot. So the gate is CALLED, never re-implemented, and a withheld
//      claim's words must not appear anywhere on the card.
//
//   2. A FIGURE THAT NOBODY IS WATCHING. Every price on a card has to be one
//      `publishableFigures` returns for the date being judged — which means a
//      stale figure disappears from the rep's screen the same day it
//      disappears from the marketing page, rather than living on in the
//      portal where nobody reviews it.
//
//   3. A SPOKEN LINE THAT MAKES A BANNED MOVE. The assembled lines are a
//      script. They run through the same detectors as the seed playbooks —
//      the shared table in lib/sales/playbook/bannedMoves.js, imported here
//      and there rather than copied.
//
//   4. AN INVENTED SAVING. shopMath returns null when either side is unknown,
//      and a null must never become a sentence. A made-up saving is the one
//      number on a call a contractor can disprove with a calculator while the
//      rep is still talking.
//
// ══ Everything here EXECUTES ═════════════════════════════════════════════
//
// No regex over source. The cards are built, the gate is driven directly with
// synthetic entries in both directions, and the mutation cases are run rather
// than described. `asOf` is pinned so two runs of this file cannot disagree
// about whether a ninety-day-old figure still publishes.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CLAIM_ADVANTAGE,
  CLAIM_CONCESSION,
  COMPETITORS,
  SOURCED_OWNER_ASSERTED,
  SOURCED_PUBLISHER,
  UNVERIFIED,
  VERIFIED,
  claimPublishable,
  claims,
  publishableFigures,
} from "../lib/marketing/competitors.js";
import { COMPARE_PAGES } from "../app/(marketing)/compare/compareCopy.js";
import { BANNED_MOVES, bannedMovesIn } from "../lib/sales/playbook/bannedMoves.js";
import {
  DEFAULT_SHOP,
  MAX_NEVER_LISTED,
  battlecard,
  battlecards,
  matchBattlecard,
} from "../lib/sales/playbook/battlecards.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, condition, got) {
  if (condition) {
    pass++;
    return true;
  }
  failures.push(name);
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

// Pinned, not `new Date()`. STALE_AFTER_DAYS is 90 and the figures were read on
// 2026-08-28, so a card built "now" changes contents as the clock moves and
// this file would start failing on a day nobody edited anything. The staleness
// behaviour itself is asserted below with a date chosen to trip it.
const AS_OF = new Date("2026-09-10T12:00:00Z");

const CARDS = battlecards({ asOf: AS_OF });

// ═══════════════════════════════════════════════════════════════════════════
section("1. There is a card for everybody a prospect could name");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a card is built for every competitor we hold research on", CARDS.length === COMPETITORS.length, CARDS.length);
  for (const c of COMPETITORS) {
    const card = CARDS.find((x) => x.competitorId === c.id);
    ok(`${c.id}: has a card`, Boolean(card));
    ok(`${c.id}: the card carries their real name`, card?.name === c.name, card?.name);
  }
  ok("an unknown competitor gets null rather than an empty shell", battlecard("acme_field_ops") === null);

  // The rep's link and the page a homeowner reads must be the same URL. Two
  // spellings of a slug is how a rep sends a prospect to a 404 in front of them.
  for (const page of COMPARE_PAGES) {
    const card = CARDS.find((c) => c.competitorId === page.competitorId);
    ok(
      `${page.competitorId}: the card links the page's own slug`,
      card?.comparePath === `/compare/${page.slug}`,
      card?.comparePath,
    );
    ok(
      `${page.competitorId}: …and that page really exists on disk`,
      existsSync(join(ROOT, "app/(marketing)/compare/[slug]/page.js")) && COMPARE_PAGES.includes(page),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The publishability gate is called, not re-implemented");
// ═══════════════════════════════════════════════════════════════════════════
//
// competitors.js's own header explains why claimPublishable is exported rather
// than closed over: mutation testing walked straight through the advantage bar
// because every advantage in the data today happens to be publisher-sourced,
// so the rule only bit on data that did not exist. Both directions are driven
// here with synthetic entries for that reason.
{
  const unverifiedConcession = {
    capability: "mobile_app",
    claim: "They ship a phone app",
    sourcing: SOURCED_PUBLISHER,
    verification: UNVERIFIED,
  };
  const unverifiedAdvantage = { ...unverifiedConcession, capability: "white_label" };
  const assertedConcession = {
    ...unverifiedConcession,
    sourcing: SOURCED_OWNER_ASSERTED,
    // The grounds have to be real prose — isSignedAssertion requires more than
    // fifteen characters, deliberately, so "he said so" cannot pass as a
    // reason. The fixture has to clear the same bar the data does.
    assertedBy: {
      who: "Emilio Boves, FieldQuo's owner",
      on: "2026-08-29",
      grounds: "He has used their product and the app is on his own phone.",
    },
  };

  ok("an unverified advantage is refused", claimPublishable(unverifiedAdvantage, CLAIM_ADVANTAGE) === false);
  ok("an unverified concession with no signature is refused", claimPublishable(unverifiedConcession, CLAIM_CONCESSION) === false);
  ok("a signed owner assertion may back a concession", claimPublishable(assertedConcession, CLAIM_CONCESSION) === true);
  ok("…but never an advantage", claimPublishable(assertedConcession, CLAIM_ADVANTAGE) === false);
  ok("a verified entry publishes either way", claimPublishable({ verification: VERIFIED }, CLAIM_ADVANTAGE) === true);

  // The card must never carry a claim the gate refused — and this is not a
  // tautology over the same filter, because it asserts on the RENDERED text.
  // The whole card is flattened and the withheld claim's own words are looked
  // for in it, which catches a renderer that reached past the filter into
  // claims() for "the full picture".
  let checkedWithheld = 0;
  for (const c of COMPETITORS) {
    const card = CARDS.find((x) => x.competitorId === c.id);
    const all = claims(c.id);
    const flat = JSON.stringify(card);
    const withheld = [...all.theyHaveWeDont, ...all.weHaveTheyDont].filter(
      (e) => !e.publishable || !e.consistent,
    );
    for (const w of withheld) {
      checkedWithheld++;
      ok(`${c.id}: the withheld claim "${w.claim.slice(0, 40)}…" is nowhere on the card`, !flat.includes(w.claim));
    }
    // And the count is reported rather than swallowed. A card that showed
    // three of four strengths and said nothing about the fourth would read as
    // a complete picture, which is the padding failure inverted.
    ok(
      `${c.id}: withheld claims are counted rather than silently dropped`,
      withheld.length === 0
        ? card.theyDoWellWithheld === null && card.weWinWithheld === null
        : (card.theyDoWellWithheld?.count || 0) + (card.weWinWithheld?.count || 0) === withheld.length,
      { withheld: withheld.length, they: card.theyDoWellWithheld, we: card.weWinWithheld },
    );
  }
  ok("there is at least one withheld claim in the data to test against", checkedWithheld > 0, checkedWithheld);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every figure on a card is one the marketing side would publish");
// ═══════════════════════════════════════════════════════════════════════════
{
  const publishable = new Set(publishableFigures(AS_OF).map((f) => f.id));
  let counted = 0;
  for (const card of CARDS) {
    for (const f of card.price.figures) {
      counted++;
      ok(`${card.competitorId}: ${f.id} is publishable at this date`, publishable.has(f.id));
      // A figure without its coordinates is not a figure — competitors.js paid
      // for that on Jobber twice in one day, two reads of the same page
      // disagreeing because neither recorded the selectors.
      ok(`${card.competitorId}: ${f.id} carries the date it was read`, Boolean(f.checked));
      ok(`${card.competitorId}: ${f.id} carries its source`, typeof f.source === "string" && f.source.startsWith("http"));
    }
  }
  ok("there are figures to check", counted >= 20, counted);

  // The staleness rule is real, not decorative: pushed a year past the read
  // date, every published figure has to fall off the cards rather than sit
  // there being quoted down a phone.
  const stale = battlecards({ asOf: new Date("2027-09-10T12:00:00Z") });
  const stillShowing = stale.reduce((n, c) => n + c.price.figures.length, 0);
  ok("a year later every figure has withdrawn itself", stillShowing === 0, stillShowing);
  // …and the cards do not vanish with them. A rep whose prospect names Jobber
  // in 2027 still needs the concession, the unlisted list and the ask.
  ok("…while the cards themselves survive it", stale.length === CARDS.length);
  ok(
    "…and every one of them still has something to say",
    stale.every((c) => c.saidOutLoud.length >= 2),
    stale.filter((c) => c.saidOutLoud.length < 2).map((c) => c.competitorId),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The spoken lines are a script and are swept like one");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Self-test first, the same discipline check-playbook-copy.mjs uses: a
  // detector that has stopped recognising the move it exists for passes
  // silently over everything, which reads exactly like success.
  ok("the shared table has moves in it", BANNED_MOVES.length >= 8, BANNED_MOVES.length);
  ok(
    "the sweep still recognises a banned line",
    bannedMovesIn("I'll be ninety seconds and then I'll leave you alone.").length >= 2,
  );
  ok("…and passes a line that is fine", bannedMovesIn("Is this a good time?").length === 0);

  for (const card of CARDS) {
    ok(`${card.competitorId}: there is something to say`, card.saidOutLoud.length >= 2, card.saidOutLoud.length);
    for (const line of card.saidOutLoud) {
      const hits = bannedMovesIn(line.text);
      ok(`${card.competitorId}/${line.beat}: makes no banned move`, hits.length === 0, hits);
      // Provenance travels with every line. A rep asked "where did you get
      // that" on a call has to be able to answer, and a line whose origin is
      // blank is one nobody can defend afterwards.
      ok(`${card.competitorId}/${line.beat}: says where it came from`, Boolean(line.from));
    }

    // The honest half is mandatory. A card that opened on our advantage would
    // be the brochure the whole data model exists to refuse — and the owner's
    // instruction was explicit: a rep who oversells gets caught on the call.
    ok(
      `${card.competitorId}: the first line concedes something`,
      card.saidOutLoud[0]?.beat === "concede",
      card.saidOutLoud[0]?.beat,
    );
    // …and it concedes something REAL: either their verified strength, or our
    // own ledger's list of what we do not have. Never nothing.
    ok(
      `${card.competitorId}: the concession names a real limitation`,
      card.theyDoWell.length > 0 || card.ourOwnLimits.length > 0,
    );
    ok(
      `${card.competitorId}: our own limits are always available to concede`,
      card.ourOwnLimits.length > 0 && card.ourOwnLimits.every((l) => l.label && l.evidence),
    );
    // Saylor ch.11: never knock the competition. The lines may quote their
    // page and may state their published prices; nothing may assert how their
    // software behaves.
    ok(
      `${card.competitorId}: no line claims their product is bad`,
      card.saidOutLoud.every((l) => !/\b(?:they can'?t|they cannot|their .* is (?:bad|broken|useless)|clunky|outdated)\b/i.test(l.text)),
      card.saidOutLoud.find((l) => /\bthey can'?t\b/i.test(l.text))?.text,
    );
    // The ask is the playbook's ask. A rep who ends a competitor conversation
    // somewhere else has run a different call from the one the script sets up.
    ok(`${card.competitorId}: it ends in an ask`, card.saidOutLoud.at(-1)?.beat === "ask");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. No invented arithmetic");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const card of CARDS) {
    const line = card.saidOutLoud.find((l) => l.beat === "arithmetic");
    const known = card.shop.savesPerMonth !== null && card.shop.fieldquo && card.shop.competitor;
    ok(
      `${card.competitorId}: an arithmetic line exists only when both sides are known`,
      Boolean(line) === Boolean(known),
      { line: Boolean(line), known: Boolean(known) },
    );
    if (line) {
      // Both prices printed have to be the ones shopMath returned, not a
      // rounding or a recomputation. Asserted as substrings of the rendered
      // sentence, because that is what the rep says out loud.
      ok(
        `${card.competitorId}: the printed prices are the computed ones`,
        line.text.includes(`$${card.shop.competitor.price}`) && line.text.includes(`$${card.shop.fieldquo.price}`),
        line.text,
      );
      ok(
        `${card.competitorId}: the shop it prices is the one that was asked for`,
        line.text.includes(`${DEFAULT_SHOP.estimators} pricing work`) &&
          line.text.includes(`${DEFAULT_SHOP.crew} in vans`),
        line.text,
      );
    }
  }

  // ServiceTitan is the case that proves it: they publish no tier a headcount
  // can be priced against, so there must be no saving and no arithmetic line.
  const st = CARDS.find((c) => c.competitorId === "servicetitan");
  ok("ServiceTitan's saving is null rather than zero", st.shop.savesPerMonth === null, st.shop.savesPerMonth);
  ok("…so no arithmetic is spoken", !st.saidOutLoud.some((l) => l.beat === "arithmetic"));
  // What it has instead is third-hand material, and it may never be dressed as
  // a published price. The line has to say so in its own words.
  const diff = st.saidOutLoud.find((l) => l.beat === "difference");
  ok("…and the price line says the numbers are reported, not published", /\breport\b|\breported\b/i.test(diff?.text || ""), diff?.text);
  ok("…and the reported costs are kept in their own field", Array.isArray(st.price.reported) && st.price.reported.length > 0);
  ok("…separate from the published figures", st.price.figures.every((f) => !st.price.reported.some((r) => r.id === f.id)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Nothing is padded, and the counts are real");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const card of CARDS) {
    ok(
      `${card.competitorId}: the unlisted preview is a slice of the real total`,
      card.neverListed.length === Math.min(MAX_NEVER_LISTED, card.neverListedTotal),
      { shown: card.neverListed.length, total: card.neverListedTotal },
    );
    ok(
      `${card.competitorId}: every previewed feature has a name and a key`,
      card.neverListed.every((e) => e.key && e.name),
    );
    ok(
      `${card.competitorId}: the pricing unit is stated or explicitly absent`,
      typeof card.price.unitKey === "string" && card.price.unitKey.length > 0,
      card.price.unitKey,
    );
    // The caveat travels with the mapping, never as a footnote somewhere else.
    // PRICING_UNITS' own comment: mapping twenty technicians onto free crew
    // without printing it is a comparison we cannot defend.
    ok(
      `${card.competitorId}: the unit's caveat travels with it`,
      Boolean(card.price.caveat) || card.price.unitKey === "flat",
      card.price.unitKey,
    );
    ok(
      `${card.competitorId}: our own entry rung is quoted from the ladder`,
      card.price.entryTier.price > 0 && card.price.entryTier.seats >= 1,
      card.price.entryTier,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. A rep finds the card by what the contractor said");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("'we already use jobber' finds Jobber", matchBattlecard("well we already use jobber for that").includes("jobber"));
  ok("'Housecall Pro' finds Housecall Pro", matchBattlecard("we're on Housecall Pro").includes("housecall_pro"));
  ok("…and the spaceless spelling too", matchBattlecard("we use housecallpro").includes("housecall_pro"));
  ok("'servicetitan' finds ServiceTitan", matchBattlecard("the boss wants ServiceTitan").includes("servicetitan"));
  // A near-match that opens the wrong card is worse than no match, because the
  // rep reads it out. objections.js makes the same argument for its cues.
  ok("a job board is not Jobber", matchBattlecard("we've got a job board on the site").length === 0);
  ok("an empty utterance matches nothing", matchBattlecard("").length === 0);
  ok("two named in one sentence both match", matchBattlecard("we looked at Jobber and QuoteIQ").length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Reachable — a rep can actually get to this");
// ═══════════════════════════════════════════════════════════════════════════
//
// The most-repeated defect in this repository is a finished screen with no way
// in. docs/sales/OPEN-WORK.md records three features that shipped unreachable,
// and check-sales-home.mjs's own reachability section exists for the /sales
// tree because check-nav-audit.mjs does not walk it. This is the same
// assertion made from the other end: the module has a screen, and the screen
// has a tab.
{
  ok("the playbook screen exists", existsSync(join(ROOT, "app/sales/playbook/page.js")));
  const page = read("app/sales/playbook/page.js");
  ok("…and it renders battlecards from the module rather than its own table", /from "@\/lib\/sales\/playbook\/battlecards"/.test(page));
  ok("…and the objection library from the store, so it matches the call console", /loadObjections/.test(page));
  ok("…and the playbooks from the store as well", /loadPlaybooks/.test(page));
  // The gatekeeper, the voicemail and the two follow-ups are the other half
  // of what the owner asked for, and a module nothing renders is the same
  // defect as a screen nothing links.
  ok("…and the moments either side of the call", /playbookMoments/.test(page));
  ok(
    "the shell links it, so it is not a screen with no door",
    read("app/sales/SalesShell.js").includes('"/sales/playbook"'),
    "add a tab in SalesShell.js",
  );
  // No hand-typed competitor facts in the screen. The whole argument for this
  // module is that a second copy rots; a screen that reached for a literal
  // would be that second copy wearing JSX.
  const names = COMPETITORS.map((c) => c.name);
  const literal = names.filter((n) => page.includes(`"${n}"`) || page.includes(`>${n}<`));
  ok("the screen names no competitor as a literal", literal.length === 0, literal);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length ? "✗ FAILED" : "check:sales-playbook-battlecards passed"} — ${CARDS.length} battlecards, ${pass} assertions${failures.length ? `, ${failures.length} failures` : ""}.`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
