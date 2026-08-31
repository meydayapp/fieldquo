// lib/ai/jennifer/tools.js
//
// Jennifer's tools, mode-aware and permission-aware — the same shape as
// lib/ai/copilotTools.js's copilotToolsFor(member): the CALLER's own state
// decides which tools exist for this conversation, never a prompt sentence
// asking the model to behave.
//
// ── companyId is bound here, never taken from the model (constraint 1) ─────
//
// Every company-mode tool's implementation is wrapped so `companyId` is
// appended LAST, after the model's own arguments — exactly copilotClient.js's
// injection point. A model that tries to pass its own companyId has it
// overwritten. The value it's overwritten WITH comes from jenniferClient.js's
// caller, which gets it from the session (see app/api/jennifer/route.js) —
// never from the request body. There is no argument named companyId in any
// tool's input_schema below, so there is nothing for a model to even try to
// set.
//
// ── The allowlist is what a tool RETURNS, not what it withholds (constraint 2) ──
//
// Every company-mode tool below is written from a positive list of fields —
// booleans, counts and qualitative statuses named explicitly in this file.
// None of them selects a Client, a Lead, a VoiceCall or anything with a name,
// email, phone, address, photo or transcript on it. That isn't enforced by
// filtering a bigger query's output (a denylist that leaks the next column
// someone adds); it's structural — the query itself only ever selects the
// fields named here, the same reasoning lib/permissions/enforce.js's own
// header gives for CLIENT_RESTRICTED_FIELDS being a named list.
//
// ── Permissions are inherited, not invented (constraint 3) ─────────────────
//
// The account-status tools (voice, AI credit, capacity, email) read the same
// account-configuration screens Settings → Voice / AI credit / Overhead /
// Email domain already gate to owner and admin only (see
// app/api/settings/voice/route.js: "Only an owner or admin can change the
// receptionist.") — UNRESTRICTED_ROLES is imported from enforce.js rather
// than a new role check invented for this file, so a crew member is refused
// here for the same reason they're refused the settings page itself, not a
// second opinion that could drift from it.
import { db } from "@/lib/db";
import { UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";
import {
  balanceFor,
  aiBalanceFor,
  isLowBalance,
  isOverdrawn,
  minutesFor,
  POOLS,
} from "@/lib/voice/credits";
import { estimateSavings, readInputs as readSavingsInputs } from "@/lib/marketing/savings";
import { compareCosts, readInputs as readCostInputs } from "@/lib/marketing/costCompare";
import { navRouteKeys, resolveNavRoute } from "./allowlist";
import { fenceCompanyData } from "./dataFence";

/* ═══════════════════════════════════════════════════════════════════════════
   Navigation — click-through only (constraint 7)
   ═══════════════════════════════════════════════════════════════════════════
   The tool returns a KEY plus the label to show on the button. It is the
   PANEL (app/components/jennifer/JenniferPanel.js) that renders that as a
   <button> and moves the page only when the visitor presses it. Nothing here
   calls next/navigation, sets window.location, or returns a raw URL a client
   could act on without a click — see resolveNavRoute in allowlist.js for why
   an arbitrary path can never come out of this even if a model tries. */
function offerNavigationTool(mode) {
  return {
    definition: {
      name: "offerNavigation",
      description:
        "Offer the visitor a button to a specific page on the site. This does NOT " +
        "navigate anyone anywhere by itself — it shows a button they can choose to " +
        "click. Only use a routeKey from the enum; there is no other page you can " +
        "offer.",
      input_schema: {
        type: "object",
        properties: {
          routeKey: { type: "string", enum: navRouteKeys(mode) },
        },
        required: ["routeKey"],
      },
    },
    implementation: (args) => {
      const route = resolveNavRoute(mode, args?.routeKey);
      if (!route) {
        return { offered: false, reason: "That isn't a page I can point you to." };
      }
      return { offered: true, routeKey: route.key, path: route.path, label: route.label };
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Escalation tool — the model's own way to hand off (escalate.js's regex is
   the FORCED path this file's caller runs before the model is invoked at
   all; this is the softer path for phrasing that regex missed).
   ═══════════════════════════════════════════════════════════════════════════ */
function escalateToolFor(mode) {
  // Company mode has nowhere better to click through TO — the conversation
  // itself is what an operator opens in /platform/jennifer once
  // app/api/jennifer/route.js flips its status to "escalated", and the reply
  // lands back in this same panel by polling. Only anonymous still points at
  // a page, because there is no persisted conversation for a human to reply
  // inside of (AGENTS.md non-negotiable #8).
  const contact = mode === "company" ? null : resolveNavRoute("anonymous", "contact");

  return {
    definition: {
      name: "escalateToHuman",
      description:
        "Hand this conversation to a human instead of answering. Use this — and " +
        "ONLY this, never an answer of your own — for anything about money actually " +
        "moving (a payout, a charge, a refund, a dispute), any request to delete " +
        "data or an account, or any legal or privacy request. Say plainly that a " +
        "person needs to help with this rather than guessing at an answer.",
      input_schema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "One short sentence summarising what the person needs, for the handoff.",
          },
        },
        required: ["reason"],
      },
    },
    implementation: (args) => ({
      escalated: true,
      reason: String(args?.reason || "").slice(0, 300),
      contact,
    }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANONYMOUS MODE — the marketing site's calculators
   ═══════════════════════════════════════════════════════════════════════════ */

const SAVINGS_PROPS = {
  seats: { type: "number", description: "People who write quotes, jobs or invoices." },
  crew: { type: "number", description: "People in the field who just need their schedule." },
  quotesPerMonth: { type: "number", description: "Quotes sent in a month, won or not." },
  projectsPerMonth: { type: "number", description: "Jobs finished in a month." },
  averageProjectValue: { type: "number", description: "What an average job invoices for, before tax." },
  adminHoursPerWeek: {
    type: "number",
    description: "Hours a week the office spends on scheduling, invoicing and chasing paperwork (not quote-writing time).",
  },
  hourlyCost: { type: "number", description: "What an hour of that time costs — wage plus overhead, or their own billable rate." },
  tools: { type: "string", enum: ["paper", "separate_apps"], description: "How they run it today." },
};

/**
 * Reduced to what a chat answer actually needs. `estimateSavings()` also
 * carries `proof`/`assumptions`/`workings` per line — the reasoning behind
 * each figure, meant for the calculator PAGE where someone can expand and
 * read it. A chat answer quoting the headline total and the top lines is a
 * better fit for the surface than dumping the full working, and every number
 * that survives is still exactly what estimateSavings() computed — nothing
 * here re-derives or rounds a figure the library already produced.
 */
function summariseSavings(result) {
  if (!result.ready) {
    return { ready: false, missing: result.missing, outOfRange: result.outOfRange };
  }
  return {
    ready: true,
    annualRevenueTyped: result.annualRevenue,
    totalAnnualSavings: result.total,
    capped: result.capped,
    lines: result.lines.map((l) => ({ label: l.label, annualAmount: l.amount })),
    omitted: result.omitted.map((o) => ({ label: o.label, reason: o.reason })),
    fieldquoAnnualCost: result.cost?.fits ? result.cost.yearAtMonthly : null,
    netAfterCost: result.netAfterCost,
    paysForItself: result.paysForItself,
  };
}

function estimateSavingsTool() {
  return {
    definition: {
      name: "estimateMonthlySavings",
      description:
        "Estimate what this visitor's business would save on FieldQuo, using the site's " +
        "own savings calculator. Pass whatever numbers the visitor has already given you " +
        "— if required ones are missing, this returns which ones so you can ask for just " +
        "those, one or two at a time, not all seven at once. NEVER compute a savings figure " +
        "yourself; only ever quote what this tool returns.",
      input_schema: { type: "object", properties: SAVINGS_PROPS },
    },
    implementation: (args) => {
      const { missing } = readSavingsInputs(args);
      if (missing.length) return { ready: false, missing };
      return summariseSavings(estimateSavings(args));
    },
  };
}

/**
 * Reduced from compareCosts()'s full page payload — `bases` carries a
 * capability-matched AND a cheapest-published comparison, each with a row per
 * competitor and a ScaledBand of methodology notes meant for a page with room
 * to show its work. A chat answer needs the headline number and, at most, the
 * few competitors closest to what was asked — so this keeps FieldQuo's own
 * cost and the CHEAPEST-basis rows (the more legible of the two bases in
 * prose) and drops the rest. Every figure kept is verbatim from the library.
 */
function summariseCostCompare(result) {
  if (!result.ready) {
    return { ready: false, missing: result.missing, outOfRange: result.outOfRange };
  }
  const cheapest = result.bases?.cheapest_published;
  const rows = Array.isArray(cheapest?.rows)
    ? cheapest.rows.slice(0, 6).map((r) => ({
        competitor: r.competitorName || r.competitorId || r.id,
        status: r.status,
        annualCost: r.annualCost ?? null,
        savingVsFieldquo: r.saving ?? null,
        note: typeof r.note === "string" ? r.note : undefined,
      }))
    : [];
  return {
    ready: true,
    people: result.people,
    fieldquoAnnualCost: result.fieldquo?.annualCost ?? null,
    fieldquoMonthlyCost: result.fieldquo?.monthlyCost ?? null,
    competitors: rows,
    currencyNote: result.currencyNote,
  };
}

function compareCostsTool() {
  return {
    definition: {
      name: "compareMonthlyCost",
      description:
        "Compare FieldQuo's price against named competitors for this visitor's team size, " +
        "using the site's own cost-comparison page. Pass officeSeats and fieldCrew if you " +
        "have them; if not, this tells you which is missing. NEVER state a competitor's " +
        "price or FieldQuo's price from memory — only ever quote what this tool returns.",
      input_schema: {
        type: "object",
        properties: {
          officeSeats: { type: "number", description: "People who quote, schedule or invoice." },
          fieldCrew: { type: "number", description: "People in the field who just need their schedule." },
        },
      },
    },
    implementation: (args) => {
      const { missing } = readCostInputs(args);
      if (missing.length) return { ready: false, missing };
      return summariseCostCompare(compareCosts(args, { asOf: new Date() }));
    },
  };
}

function anonymousTools() {
  const nav = offerNavigationTool("anonymous");
  const escalate = escalateToolFor("anonymous");
  const savings = estimateSavingsTool();
  const cost = compareCostsTool();
  return {
    definitions: [savings.definition, cost.definition, nav.definition, escalate.definition],
    implementations: {
      [savings.definition.name]: savings.implementation,
      [cost.definition.name]: cost.implementation,
      [nav.definition.name]: nav.implementation,
      [escalate.definition.name]: escalate.implementation,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPANY MODE — tier-1 account triage, owner/admin only (see header)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Access rule per tool. Missing here means denied — the same fail-closed
 * default copilotTools.js's TOOL_ACCESS uses, for the same reason: a tool
 * added without a rule must not ship open by omission. */
const ACCOUNT_TOOL_ACCESS = {
  getReceptionistStatus: (member) => UNRESTRICTED_ROLES.has(member?.role),
  getAiCreditStatus: (member) => UNRESTRICTED_ROLES.has(member?.role),
  getCapacityStatus: (member) => UNRESTRICTED_ROLES.has(member?.role),
  getEmailSendingStatus: (member) => UNRESTRICTED_ROLES.has(member?.role),
};

async function getReceptionistStatus({ companyId }) {
  const [activeNumbers, agent, creditCents] = await Promise.all([
    db.voicePhoneNumber.count({ where: { companyId, status: "active" } }),
    db.voiceAgent.findUnique({ where: { companyId }, select: { enabled: true } }),
    balanceFor(companyId, db, POOLS.VOICE),
  ]);
  return {
    hasNumber: activeNumbers > 0,
    switchedOn: Boolean(agent?.enabled),
    creditStatus: isOverdrawn(creditCents) ? "overdrawn" : isLowBalance(creditCents) ? "low" : "ok",
    approxMinutesRemaining: Math.max(0, minutesFor(creditCents)),
  };
}

// Below this many cents ($5), the AI wallet reads as "low" rather than "ok" —
// a smaller, deliberately separate threshold from the voice wallet's
// LOW_BALANCE_CENTS (ten minutes of call time), because the two wallets pay
// for entirely different things and nothing ties their thresholds together.
const AI_WALLET_LOW_CENTS = 500;

async function getAiCreditStatus({ companyId }) {
  const cents = await aiBalanceFor(companyId, db);
  return {
    aiWalletStatus: cents <= 0 ? "zero" : cents < AI_WALLET_LOW_CENTS ? "low" : "ok",
  };
}

async function getCapacityStatus({ companyId }) {
  const [forecast, pricedServices] = await Promise.all([
    db.forecastSettings.findUnique({ where: { companyId }, select: { jobsPerWeekCapacity: true } }),
    db.product.count({ where: { companyId, active: true, unitPrice: { not: null } } }),
  ]);
  return {
    // A ROW existing is the signal, not the number in it — the column
    // defaults to 3 in the schema, but that default is never reached by a
    // company that hasn't saved Settings → Overhead at all (see
    // app/api/settings/forecast/route.js, which only creates the row on a
    // PUT). No row is the "no default" state the support guide describes.
    capacitySet: Boolean(forecast),
    servicesConfigured: pricedServices > 0,
  };
}

async function getEmailSendingStatus({ companyId }) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [company, quotesSent, invoicesSent] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { emailDomainStatus: true } }),
    db.quote.count({ where: { companyId, sentAt: { gte: since } } }),
    db.invoice.count({ where: { companyId, sentAt: { gte: since } } }),
  ]);
  return {
    emailDomainStatus: company?.emailDomainStatus || "not_started",
    sentSomethingInLast30Days: quotesSent + invoicesSent > 0,
  };
}

const ACCOUNT_TOOL_DEFINITIONS = [
  {
    name: "getReceptionistStatus",
    description:
      "Is this company's AI phone receptionist actually able to answer calls right now? " +
      "Checks the three things that all have to be true: a number, credit, and the switch.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getAiCreditStatus",
    description:
      "This company's PAID AI-image wallet balance status (image generation, the deep photo " +
      "read). This is a SEPARATE balance from voice/phone credit — see getReceptionistStatus " +
      "for that one.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getCapacityStatus",
    description:
      "Whether this company has set a jobs-per-week capacity (required for the margin/minimum-" +
      "price card to appear at all) and whether they have any priced services configured.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getEmailSendingStatus",
    description:
      "This company's email sending domain status, and whether anything has actually sent " +
      "(a quote or invoice email) in the last 30 days.",
    input_schema: { type: "object", properties: {} },
  },
];

const ACCOUNT_TOOL_IMPLEMENTATIONS = {
  getReceptionistStatus,
  getAiCreditStatus,
  getCapacityStatus,
  getEmailSendingStatus,
};

function companyTools({ companyId, member }) {
  const nav = offerNavigationTool("company");
  const escalate = escalateToolFor("company");

  const definitions = [nav.definition, escalate.definition];
  const implementations = {
    [nav.definition.name]: nav.implementation,
    [escalate.definition.name]: escalate.implementation,
  };

  for (const def of ACCOUNT_TOOL_DEFINITIONS) {
    const allow = ACCOUNT_TOOL_ACCESS[def.name];
    if (!allow) {
      console.error(`[jennifer/tools] no access rule for "${def.name}" — withheld`);
      continue;
    }
    if (!allow(member)) continue;

    definitions.push(def);
    const impl = ACCOUNT_TOOL_IMPLEMENTATIONS[def.name];
    // companyId appended LAST — see this file's header. Any `companyId` the
    // model tries to supply in args is overwritten here, never honoured.
    implementations[def.name] = async (args) => {
      const result = await impl({ ...args, companyId });
      // Fenced exactly like a company's own free text reaching a phone-call
      // reader: none of these results are known to contain free text today
      // (they're booleans, counts and fixed-vocabulary statuses), but the
      // fence costs nothing to apply unconditionally and a future field added
      // to one of these functions — a plan name, a status label sourced from
      // somewhere a company can type into — inherits the protection instead
      // of needing someone to remember to add it.
      return fenceCompanyData(result);
    };
  }

  return { definitions, implementations };
}

/**
 * @param mode        "anonymous" | "company"
 * @param companyId   required when mode === "company"; ignored otherwise
 * @param member      { role } — required when mode === "company"; the grid
 *                    decides which account tools exist, same as
 *                    copilotToolsFor(member)
 */
export function jenniferToolsFor({ mode, companyId, member } = {}) {
  if (mode === "company") return companyTools({ companyId, member });
  return anonymousTools();
}
