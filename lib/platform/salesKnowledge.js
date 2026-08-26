// lib/platform/salesKnowledge.js
//
// What FieldQuo's OWN phone agent is allowed to believe about FieldQuo.
//
// ══ This is not the tenant receptionist ════════════════════════════════════
//
// lib/voice/prompt.js builds the agent that answers the phone FOR a contractor.
// It has a company, a rate card it must never read out, and a homeowner on the
// line. This file feeds a completely different agent: FieldQuo's own, answering
// FieldQuo's own number, to somebody asking about FieldQuo.
//
// The two must never converge. A contractor's receptionist that starts
// explaining FieldQuo's plans has broken the white-label promise that is the
// product (AGENTS.md, "What this is"), and FieldQuo's agent has no tenant to
// speak for. Nothing here imports lib/voice/prompt.js and nothing there imports
// this.
//
// ══ Why the facts are DERIVED and not written down ═════════════════════════
//
// A sales agent that invents capability is worse than no agent: somebody buys
// on it, and the first week is a refund and a bad review. Prose in a prompt
// cannot be verified and rots the day a feature is withdrawn — so every
// capability claim below traces to something the build already proves:
//
//   1. CORE OBJECTS      lib/permissions.js — PERMISSION_CATEGORIES and
//                        PERMISSION_TOGGLES. Every entry is enforced per
//                        request by lib/permissions/enforce.js, so a category
//                        existing is evidence the thing it governs exists.
//                        A screen nobody built has no access level to set.
//
//   2. OPTIONAL FEATURES lib/features/registry.js — a CLOSED list where
//                        `npm run check:features` fails the build if an entry
//                        has no gate mount and no guard call. Surviving there
//                        is the strongest "this exists" the repo can offer.
//                        Resolved against the PlatformFeature globals, so a
//                        feature the owner HIDES in the console stops being
//                        sold on the phone without anyone editing a prompt.
//
//   3. PRICES AND LIMITS Plan rows, filtered through the same
//                        lib/platform/sellablePlans.js the public pricing page
//                        uses, plus TRIAL_PRICE from lib/pricing.js. A price
//                        that lives in a prompt string is a price that goes
//                        stale silently; this one changes when the row changes.
//
// Marketing copy is deliberately NOT a source. app/(marketing)/** is where
// FieldQuo describes itself, and it is written to persuade — it is fine for
// tone and it is not evidence.
//
// ══ Absent is not zero, and null is not "unlimited" ════════════════════════
//
// Plan.maxUsers and Plan.maxQuotesPerMonth are nullable, and null there means
// nobody has stated a limit — NOT that there isn't one. So an absent limit
// produces NO LINE, exactly like an unset opening time in provision.js. The one
// null that genuinely is a statement is Plan.aiMonthlyTokenCap, whose schema
// comment defines null as unlimited; that one is read as written.
//
// ══ No model runs here ═════════════════════════════════════════════════════
//
// This derives text from rows. It makes no AI call, so there is no quota to
// check and no usage to record — lib/ai/provider.js is untouched by design. The
// only model involved is Retell's, at call time, reading what this produced.
import { db } from "@/lib/db";
import { PERMISSION_CATEGORIES, PERMISSION_TOGGLES } from "@/lib/permissions";
import { FEATURES, resolveFeature, isVisible, isAvailable } from "@/lib/features/registry";
import { featureMapForCompany } from "@/lib/features/gate";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { TRIAL_PRICE, trialLabel } from "@/lib/pricing";

/**
 * One plain sentence per registry feature, for a caller.
 *
 * ── Why this map exists at all ─────────────────────────────────────────────
 *
 * The registry's `blurb` is written for FieldQuo's own staff — "FieldQuo holds
 * the vendor account, so this one costs money per company" is true and is not
 * something to say to a prospect. The `label` is caller-safe but too thin to
 * answer "do you do X?".
 *
 * ── Why it cannot rot ──────────────────────────────────────────────────────
 *
 * It is keyed BY the registry and iterated FROM the registry, never the other
 * way round, so a feature deleted from lib/features/registry.js disappears from
 * the phone whether or not anybody remembers this file. check:sales-agent
 * asserts both directions: no orphan sentence for a feature that no longer
 * exists, and no registry key without one.
 *
 * A key with no sentence falls back to its label rather than being dropped —
 * the label is derived and true, and silently omitting a shipped feature from
 * the sales agent is its own quiet failure.
 *
 * Every line describes what the contractor GETS. None of them names a price, a
 * seat count, a limit or a date; those come from the Plan rows or from nowhere.
 */
export const SPOKEN_FEATURE_LINES = Object.freeze({
  voice_receptionist:
    "An AI receptionist that answers the calls you miss, takes the caller's " +
    "name, number and what they need, and can book a visit against your real " +
    "calendar. You keep your own number and forward the calls you don't pick up.",
  crew_inbox:
    "Your crew text photos and updates to a number and they get filed against " +
    "the right job automatically. Anything the assistant can't place waits in a " +
    "queue for someone to sort.",
  ai_copilot:
    "A chat assistant that answers questions about your own jobs, quotes and " +
    "numbers. It only ever sees your company's data.",
  funnels:
    "Multi-step lead capture pages you can point an ad at, with figures for " +
    "where people drop out.",
  website_builder:
    "A website for the business, built from what's already in the account, on " +
    "your own address. It's your branding on it, not ours.",
  instant_quotes:
    "A page where a homeowner answers a few questions and gets a price range " +
    "straight away, from a rate card you set.",
  marketing_campaigns:
    "Email campaigns and printed door-hanger rounds, with the subscriber list " +
    "and the route stops in one place.",
});

/**
 * The parts of FieldQuo nobody can be sold separately.
 *
 * Derived from the permission grid rather than listed by hand. Each of these is
 * a category the server enforces on every request, which means the screens
 * behind them are real — you cannot set an access level on a feature that was
 * never built.
 *
 * `payroll` and `notes` are in PERMISSION_CATEGORIES and so appear here; that
 * is correct and deliberate, because both are shipped (PayRun, LeadNote). If a
 * category is ever added for something half-built, this list is wrong and
 * check:sales-agent will not catch it — the grid is the contract, and the fix
 * is not to add a category before the screen.
 */
export function coreCapabilities() {
  const categories = Object.entries(PERMISSION_CATEGORIES).map(([key, config]) => ({
    key,
    label: config.label,
  }));
  const toggles = Object.keys(PERMISSION_TOGGLES).map((key) => ({ key }));
  return { categories, toggles };
}

/**
 * What FieldQuo is currently OFFERING, resolved the same way a tenant's app
 * resolves it.
 *
 * No company override is passed, and there is no company to pass one for: this
 * agent has no tenant. So the question is only "has FieldQuo globally withheld
 * this", answered from PlatformFeature exactly as lib/features/gate.js would.
 *
 * `hidden` is dropped entirely — the state means "no trace", and a sales agent
 * describing a feature the console has hidden is a trace on the loudest surface
 * there is. `locked` is dropped too: locked means visible-and-refused to a
 * contractor who already has an account, which is a support answer, not
 * something to sell to a stranger. `preview` is kept and SAID to be a preview.
 *
 * @param featureMap  key → { state } from featureMapForCompany(null). A key it
 *                    does not carry falls back to the registry's own default,
 *                    so a partial map cannot silently withdraw a live feature.
 */
export function offeredFeatures(featureMap = {}) {
  const map = featureMap && typeof featureMap === "object" ? featureMap : {};

  return FEATURES.map((f) => {
    const resolved = map[f.key]?.state
      ? map[f.key]
      : resolveFeature({ key: f.key });
    return {
      key: f.key,
      label: f.label,
      line: SPOKEN_FEATURE_LINES[f.key] || f.label,
      state: resolved.state,
      preview: resolved.state === "preview",
    };
  }).filter((f) => isVisible(f.state) && isAvailable(f.state));
}

/**
 * A plan, reduced to what may be said out loud.
 *
 * Everything here is a column. Nothing is inferred, and an unstated limit is
 * omitted rather than described — see the header.
 */
function spokenPlan(plan) {
  const price = Number(plan.priceMonthly);
  return {
    name: String(plan.name || "").trim(),
    // Number, not Decimal: Prisma's Decimal does not survive JSON, and the
    // platform screen renders this over the wire.
    priceMonthly: Number.isFinite(price) ? price : null,
    // null stays null all the way to the renderer, which then says nothing.
    maxUsers: Number.isFinite(plan.maxUsers) ? plan.maxUsers : null,
    maxQuotesPerMonth: Number.isFinite(plan.maxQuotesPerMonth)
      ? plan.maxQuotesPerMonth
      : null,
    aiCopilotEnabled: Boolean(plan.aiCopilotEnabled),
    // Kept in the STRUCTURE so the platform screen shows it, and deliberately
    // not spoken as a figure — see renderSalesKnowledge. Null is unlimited here
    // because the schema says so, which is the one place null is a statement.
    aiMonthlyTokenCap: Number.isFinite(plan.aiMonthlyTokenCap)
      ? plan.aiMonthlyTokenCap
      : null,
    // Free-form flags typed into the platform console. Data, not a catalogue,
    // so they are repeated verbatim in whatever words the owner used.
    extras:
      plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
        ? Object.entries(plan.features)
            .filter(([, v]) => v)
            .map(([k]) => k.replace(/_/g, " "))
        : [],
  };
}

/**
 * The whole knowledge base, as structure. Pure — give it rows, get an object.
 *
 * Split from the database read for the same reason buildAgentConfig is split
 * out of provisionAgent: the check script can execute this against fabricated
 * plans and prove that changing a row changes what the phone says, which
 * reading the source cannot.
 *
 * @param plans       raw Plan rows (unfiltered — the filtering is part of the
 *                    derivation and must be exercised by the check)
 * @param featureMap  the resolved map from featureMapForCompany(null)
 */
export function deriveSalesKnowledge({ plans = [], featureMap = {} } = {}) {
  // The same gate the public pricing page uses. A plan with no Stripe price
  // cannot be bought, and an agent quoting a price whose checkout will not open
  // has sold something that does not exist yet — the exact failure
  // sellablePlans.js was written for, arriving over the phone instead.
  const { sellable, withheld, allWithheld } = partitionPlans(plans);

  return {
    core: coreCapabilities(),
    features: offeredFeatures(featureMap),
    plans: sellable
      .map(spokenPlan)
      .filter((p) => p.name && p.priceMonthly !== null)
      .sort((a, b) => a.priceMonthly - b.priceMonthly),
    // Counted, not named. The agent must know that "these are all the plans" is
    // false when something was held back, so it says "these are the ones I can
    // quote" instead of implying the list is complete.
    withheldPlanCount: withheld.length,
    nothingSellable: allWithheld || sellable.length === 0,
    trial: { price: TRIAL_PRICE, label: trialLabel() },
  };
}

/**
 * How FieldQuo works, in the four answers a prospect actually asks for.
 *
 * These are AGENTS.md's non-negotiables, not feature claims — they are the
 * product's standing commitments, and they are the things most damaging to get
 * wrong on a sales call ("is your name on my quote?" has exactly one correct
 * answer). They carry no figure, no date and no promise beyond what the code
 * already enforces, and check:sales-agent asserts that.
 *
 * If a non-negotiable in AGENTS.md changes, this changes with it. It is prose
 * about policy, which is why it is here and separate from anything derived.
 */
export const POLICY_FACTS = Object.freeze([
  "Everything the homeowner sees is the contractor's branding — the quote, the " +
    "invoice, the booking page, the website, the emails. FieldQuo's name is not " +
    "on any of it. Somebody comparing three contractors cannot tell which of " +
    "them use the same software.",
  "Anyone can start a company account themselves from the website. Adding a " +
    "person to a company that already exists is by invitation from inside that " +
    "account only — there is no way to join a company you were not invited to.",
  "FieldQuo staff can see a company's account for support, and cannot change " +
    "anything in it. Nobody here edits a customer's quote.",
  "A quote keeps the language it was written in. It is never machine-translated " +
    "afterwards, so a document that has been signed still says what it said.",
]);

/**
 * The knowledge base for the live agent, from the live database.
 *
 * Reads Plan directly and feature availability through featureMapForCompany,
 * and neither is a tenant's data. That is structural rather than a convention:
 * nothing here can name a company, so there is nothing for a caller to talk the
 * agent into looking up. AGENTS.md non-negotiable 8 in spirit — FieldQuo's
 * sales line has no business reading anybody's quotes, clients or numbers.
 *
 * ── Why the feature read goes through the gate ─────────────────────────────
 *
 * PlatformFeature and CompanyFeatureOverride are deliberately read in ONE
 * place (check:features asserts it), because a second reader is a second
 * resolution rule — and that is how `override ?? global ?? default` quietly
 * becomes `||` somewhere nobody looks. So this asks the gate rather than the
 * table.
 *
 * NULL is the right argument and not a shortcut: this agent has no company, so
 * there are no per-company overrides to consult. Passing one would mean
 * FieldQuo's sales line describing the product as a single beta tester sees it.
 */
export async function salesKnowledge() {
  const [plans, featureMap] = await Promise.all([
    db.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      select: {
        name: true,
        priceMonthly: true,
        maxUsers: true,
        maxQuotesPerMonth: true,
        aiCopilotEnabled: true,
        aiMonthlyTokenCap: true,
        features: true,
        // Both are needed by isSellable and neither reaches the prompt.
        // isPublic MUST be selected: isSellable reads a missing column as
        // "not stated", so omitting it would let a bespoke rate negotiated
        // with one company be read out to every caller.
        stripePriceId: true,
        isPublic: true,
      },
    }),
    featureMapForCompany(null),
  ]);

  return deriveSalesKnowledge({ plans, featureMap });
}

/**
 * The knowledge base as the text the agent reads.
 *
 * Pure, and separate from the structure so the platform screen can render both:
 * the owner needs to see the facts AND the exact words, because "what does it
 * know?" and "what will it say?" are different questions.
 *
 * Every figure in the output came in through `kb`. There is no currency symbol,
 * seat count or allowance written into this function, which is the property
 * check:sales-agent verifies by rendering two different sets of plans and
 * asserting neither's numbers survive into the other.
 */
export function renderSalesKnowledge(kb) {
  const lines = [];

  lines.push(
    "FieldQuo is software for field-service contractors — painters, cabinet " +
      "makers, flooring installers, plumbers, landscapers. Usually one to twenty " +
      "people. It runs the whole job: the enquiry comes in, a quote goes out, the " +
      "customer approves it, it becomes a job with visits scheduled, and it ends " +
      "as an invoice that gets paid.",
  );

  const categories = kb?.core?.categories || [];
  if (categories.length) {
    lines.push(
      "",
      "WHAT IS IN EVERY ACCOUNT",
      "These are part of the product, not add-ons: " +
        categories.map((c) => c.label).join(", ") +
        ".",
    );
  }

  const toggles = kb?.core?.toggles || [];
  if (toggles.find((t) => t.key === "payments")) {
    lines.push(
      "Customers can pay a quote or an invoice by card, and the money goes to " +
        "the contractor's own account.",
    );
  }
  if (toggles.find((t) => t.key === "jobCosting")) {
    lines.push(
      "Job costing shows what a job actually made once labour, materials and " +
        "expenses are counted against it.",
    );
  }

  const features = kb?.features || [];
  if (features.length) {
    lines.push("", "THE OPTIONAL PARTS");
    for (const f of features) {
      lines.push(`- ${f.label}${f.preview ? " (an early preview)" : ""}: ${f.line}`);
    }
    lines.push(
      "That list is complete. If somebody asks about something that is not on " +
        "it and not in the list above, FieldQuo does not do it as far as you " +
        "know — say so, and offer to have someone confirm.",
    );
  }

  lines.push("", "HOW FIELDQUO WORKS", ...POLICY_FACTS.map((f) => `- ${f}`));

  lines.push("", "PRICING");
  if (kb?.nothingSellable || !(kb?.plans || []).length) {
    // Not a formatting edge case — production has sat in exactly this state,
    // with every Plan row missing a Stripe price. An agent that responds to
    // "what does it cost?" with silence is bad; one that fills the silence with
    // a remembered number is a refund.
    lines.push(
      "You do not have a price list right now, and you must not estimate one. " +
        "If they ask what it costs, say you would rather have someone give them " +
        "the exact figure than guess at it, and get them to a person.",
    );
  } else {
    lines.push(
      "These are the published plans. Say them exactly as written and nothing " +
        "else — no other figure, no per-person rate you work out yourself, no " +
        "discount.",
    );
    for (const p of kb.plans) {
      const bits = [`${p.name}: ${p.priceMonthly} a month`];
      // An unstated limit produces no words at all. "Up to null seats" and
      // "unlimited seats" are both inventions, and the second one is the
      // expensive one.
      if (p.maxUsers !== null) {
        bits.push(p.maxUsers === 1 ? "for one person" : `for up to ${p.maxUsers} people`);
      }
      if (p.maxQuotesPerMonth !== null) {
        bits.push(`up to ${p.maxQuotesPerMonth} quotes a month`);
      }
      // A boolean column is always a statement, so both directions are said.
      // The token allowance is NOT read out: a token count means nothing to a
      // painter, and a number said aloud is a number somebody holds you to.
      bits.push(
        p.aiCopilotEnabled
          ? p.aiMonthlyTokenCap === null
            ? "includes the AI assistant with no monthly cap"
            : "includes the AI assistant, with a monthly usage allowance"
          : "does not include the AI assistant",
      );
      for (const extra of p.extras) bits.push(extra);
      lines.push(`- ${bits.join("; ")}.`);
    }
    // ── Say the number, never the currency ────────────────────────────────
    //
    // A Plan row holds ONE figure and Stripe bills it in the company's own
    // currency, so the same row is a very different price to a contractor in
    // Toronto and one in Buffalo — roughly a third apart. The natural thing for
    // a model to do with a bare number is attach "dollars" to it, which would
    // be a quoted price in a currency nobody chose. Said out loud here because
    // instructing it not to is the only place this can be stopped.
    lines.push(
      "Say the figure as a plain number. Do NOT attach a currency to it — not " +
        "dollars, not pounds, not euros. The same figure is billed in the " +
        "currency of the country they choose when they sign up, and tax is " +
        "added on top. If they ask which currency or what it comes to in their " +
        "own money, tell them it follows the country they sign up in and that " +
        "you do not want to guess at a conversion.",
    );
    if (kb.withheldPlanCount > 0) {
      // The agent has to know its list is partial, or it will say "those are all
      // the plans" about a subset — which is a false statement it was handed.
      lines.push(
        "There are other plans you have not been given. Do not say this is the " +
          "complete list; say these are the ones you can quote and offer to have " +
          "someone go through the rest.",
      );
    }
  }

  // The trial label rather than the figure: TRIAL_PRICE is 0 today, and "$0
  // first month" is technically correct and reads like a bug. lib/pricing.js
  // owns that wording for the three screens that print it; the phone is the
  // fourth, and it must not become a fourth spelling of it.
  //
  // Nothing is said about contracts, notice or refunds. "No contract" is a
  // commitment, not a fact this code can prove, and rule 7 forbids the agent
  // making one — so the honest move is to hand that question to a person rather
  // than answer it either way.
  lines.push(
    `The first month is free — say it exactly as "${kb?.trial?.label || trialLabel()}". ` +
      "You have not been told anything about contracts, notice periods, minimum " +
      "terms or refunds. Do not answer those either way; get them to a person.",
  );

  return lines.join("\n");
}
