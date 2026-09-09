// lib/aiEmployee/tools.js
//
// What the AI employee can DO, as opposed to say.
//
// ══ companyId is injected, never taken from the model ══════════════════════
//
// Exactly the shape lib/ai/copilotClient.js uses, and for exactly the reason
// its header gives: a model can hallucinate a tool argument, but it cannot
// hallucinate its way into another tenant's rows, because the id it would have
// to supply is overwritten before the query runs. Every implementation below
// takes `{ ...args, companyId }` with companyId LAST, and executeFor() is the
// only thing that supplies it.
//
// ══ Every tool is an existing server path ══════════════════════════════════
//
//   look_up_service_prices  the company's own Product rows — the same price
//                           book the quote builder reads.
//   create_instant_quote    lib/estimate/instantQuoteServer.js. The MODEL
//                           supplies measurements; the SERVER prices. This is
//                           AGENTS.md non-negotiable #5 with a model standing
//                           in for the browser, and the argument is stronger
//                           rather than weaker: a browser can be inspected, a
//                           model's arithmetic cannot.
//   book_callback           lib/leads/createLead.js's createScoredLead — the
//                           one creator every other inbound source uses, so a
//                           callback the employee took is scored, notified and
//                           triaged identically to one from the web form.
//   hand_off_to_human       records the handoff on AiEmployeeReply. No second
//                           implementation of "flag a thread": the reply row
//                           IS the record, and decide.js reads it.
//
// Nothing here updates or deletes anything a company already had. The employee
// can create a lead and read a price; it cannot touch an existing quote,
// invoice, client or booking, and there is no tool for it — the same guarantee
// lib/voice/tools.js makes for the phone, made the same way.
//
// ══ Results are fenced ═════════════════════════════════════════════════════
//
// Through lib/ai/jennifer/dataFence.js's fenceCompanyData, unchanged. A
// product name and a lead's own message are free text somebody typed, and the
// employee is reading them mid-conversation with a stranger who may have
// written some of it.

import { db } from "@/lib/db";
import { fenceCompanyData } from "@/lib/ai/jennifer/dataFence";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { measureForTrade, priceAllMaterials, tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { effectiveVisibility } from "@/lib/estimate/visibility";
import { cleanPhone, cleanText, normaliseEmail } from "@/lib/voice/tools";
import { toolsForRole } from "./roles";

// ── Definitions ────────────────────────────────────────────────────────────
//
// Written for the MODEL, not for a developer — the same rule lib/voice/tools.js
// states: the model is deciding WHEN to call a thing, not what it is.
const DEFINITIONS = {
  look_up_service_prices: {
    name: "look_up_service_prices",
    description:
      "Look up what this company charges for a service, from their own price " +
      "list. Call this before you say any number at all. If it comes back " +
      "empty, the company has not priced that — say you will have it confirmed " +
      "rather than estimating it yourself.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "What they asked about, in a word or two — \"cabinet painting\", " +
            "\"gutters\". Leave it out to see the whole list.",
        },
      },
    },
  },

  create_instant_quote: {
    name: "create_instant_quote",
    description:
      "Get a real estimate for a job from this company's own saved rates. You " +
      "supply the MEASUREMENTS they gave you and nothing else — you never " +
      "supply a price, and the figure that comes back is the company's, not " +
      "yours. Only for the trades this company has set up; if it says the " +
      "trade is not configured, do not improvise one.",
    input_schema: {
      type: "object",
      properties: {
        trade: {
          type: "string",
          description:
            "Which trade — roofing, painting, flooring, epoxy, parging, " +
            "countertop, cabinet_refinishing, cabinet_refacing, lawn_mowing, " +
            "stair, junk_removal. Use the word they used for the work.",
        },
        square_footage: {
          type: "number",
          description:
            "The area in square feet, if they gave you one. Their number, " +
            "never one you worked out from a room description.",
        },
        address: {
          type: "string",
          description:
            "The property address — ONLY for roofing, which is measured from " +
            "the roof itself. Leave it out otherwise.",
        },
      },
      required: ["trade"],
    },
  },

  book_callback: {
    name: "book_callback",
    description:
      "Record that somebody should ring this person back. Call it as soon as " +
      "you have a name and a phone number — do not wait until the conversation " +
      "feels finished. It does NOT book a time and you must not tell them one; " +
      "it puts them in front of a person.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Their name." },
        phone: {
          type: "string",
          description:
            "Their number, exactly as they gave it. Digits or words are both " +
            "fine. Leave it out rather than guessing.",
        },
        email: {
          type: "string",
          description: "Their OWN email, if they gave one. Never one you read out to them.",
        },
        summary: {
          type: "string",
          description:
            "What they want, in one or two plain sentences, in their own words " +
            "rather than a tidied-up version.",
        },
        preferred_times: {
          type: "string",
          description:
            "When they can take a call, in their own words — \"after six\", " +
            "\"weekday mornings\". Leave it out rather than guessing.",
        },
      },
      required: ["name"],
    },
  },

  hand_off_to_human: {
    name: "hand_off_to_human",
    description:
      "Stop answering and put this conversation in front of a person. Use it " +
      "when they ask for a human, when they are upset, when it is urgent, when " +
      "they want something you are not allowed to answer, or whenever you are " +
      "not sure. After this you say one sentence telling them you are passing " +
      "it on — without promising when — and you call nothing else.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why, in a few words. The contractor reads this, not the customer.",
        },
      },
      required: ["reason"],
    },
  },
};

/** The definitions this role may be given. Never more, never fewer. */
export function definitionsForRole(role) {
  return toolsForRole(role).map((name) => DEFINITIONS[name]).filter(Boolean);
}

/** Every definition, for the check. Not used at runtime — roles decide. */
export const ALL_TOOL_DEFINITIONS = Object.freeze(Object.values(DEFINITIONS));

// ── Implementations ────────────────────────────────────────────────────────

/**
 * The price book, fenced.
 *
 * Deliberately returns the company's OWN rows only — this is not a public
 * surface, so AGENTS.md non-negotiable #4 (public endpoints never return
 * prices) does not apply directly, but its reasoning does: the employee is
 * writing to a stranger. So it returns at most twelve rows and the model is
 * told, in roles.js, to repeat a figure rather than recite a rate card.
 */
async function lookUpServicePrices({ companyId, query }) {
  const q = String(query || "").trim();

  const rows = await db.product.findMany({
    where: {
      companyId,
      active: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { name: true, description: true, unitPrice: true, unit: true },
    orderBy: { name: "asc" },
    take: 12,
  });

  return fenceCompanyData({
    matched: rows.length,
    // Null unitPrice is passed through as null, never as 0 and never dropped:
    // "this company has a service called Deep Clean and has not priced it" is a
    // different fact from "it costs nothing", and the model needs to be able to
    // tell them apart to say "I'll get that confirmed".
    services: rows.map((r) => ({
      name: r.name,
      description: r.description || null,
      unitPrice: r.unitPrice === null || r.unitPrice === undefined ? null : Number(r.unitPrice),
      unit: r.unit || null,
    })),
  });
}

/**
 * An instant estimate, priced by the SERVER.
 *
 * The model hands over a trade and a measurement. Everything after that is
 * lib/estimate/instantQuoteServer.js — the same module the public estimator
 * runs — reading this company's own saved rates. No number the model produced
 * is ever multiplied by anything, echoed back, or stored.
 *
 * Returns RANGES, the same shape the public estimator shows a homeowner, and
 * carries the visibility flag the company set: a company that chose not to show
 * figures on its own estimator has chosen that, and an employee that answered
 * with them would be a second door round a decision they already made.
 */
async function createInstantQuote({ companyId, trade, square_footage: sqft, address }) {
  const key = String(trade || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!key) return { ok: false, reason: "no_trade" };

  const measured = await measureForTrade(key, {
    address: typeof address === "string" ? address : undefined,
    intake: { squareFootage: Number(sqft) || undefined },
  });
  if (!measured.ok) {
    return fenceCompanyData({
      ok: false,
      reason: measured.reason,
      trade: tradeLabel(key),
      // Named so the model asks for the ONE missing thing rather than
      // apologising vaguely or filling the gap itself.
      needs: measured.reason === "no_area" ? "square_footage" : measured.reason,
    });
  }

  const priced = await priceAllMaterials({ companyId, trade: key, measurement: measured.measurement });
  if (!priced.ok) {
    return fenceCompanyData({ ok: false, reason: priced.reason, trade: tradeLabel(key) });
  }

  // ── The company's own decision about showing figures, honoured here ────
  //
  // priceAllMaterials returns the MODE the owner saved ("gated" |
  // "after_submit" | "range"), not a boolean, and it has to be resolved
  // against where we are in the flow. "confirmed" is the right stage and it is
  // a fact rather than a convenience: this person messaged the business, so
  // their name and their handle are already on the thread — which is exactly
  // the line "after_submit" draws. A company that chose "gated" chose it, and
  // an employee that answered with a figure anyway would be a second door
  // round a decision the owner already made on their own estimator.
  if (effectiveVisibility(priced.visibility, "confirmed") === "gated") {
    return fenceCompanyData({
      ok: false,
      reason: "prices_hidden_by_company",
      trade: tradeLabel(key),
    });
  }

  return fenceCompanyData({
    ok: true,
    trade: tradeLabel(key),
    priced_by: "fieldquo_server_from_company_rates",
    options: (priced.options || []).map((o) => ({
      material: o.label || null,
      low: o.low ?? null,
      high: o.high ?? null,
      unit: o.unit || null,
    })),
  });
}

/**
 * A callback request — an ORDINARY lead.
 *
 * createScoredLead is the one creator every inbound source uses (its own
 * header says so), which means a callback the employee took is scored the same
 * way, fires the same notification and lands in the same list as one from the
 * web form. A private db.leadRequest.create here would be the copy that rots.
 *
 * `source` is the conversation's own platform where there is one, so the
 * attribution vocabulary lib/attribution/conversationOutcome.js already uses
 * carries through rather than gaining a tenth value nothing else knows.
 */
async function bookCallback({
  companyId,
  name,
  phone,
  email,
  summary,
  preferred_times: preferredTimes,
  // Injected by executeFor, never by the model — see the module header.
  source = "ai_employee",
  language = null,
}) {
  const cleanName = cleanText(name, 120);
  if (!cleanName) return { ok: false, reason: "no_name" };

  const lead = await createScoredLead({
    companyId,
    name: cleanName,
    phone: cleanPhone(phone) || undefined,
    email: normaliseEmail(email) || undefined,
    // The readable summary staff actually see. The preferred time goes in it
    // as well as in intake, because the lead list shows the message and a
    // callback nobody can time is a callback that does not connect.
    message: [cleanText(summary, 800), preferredTimes ? `Best time: ${cleanText(preferredTimes, 120)}` : null]
      .filter(Boolean)
      .join("\n"),
    source,
    // Through the shared shape so `preferredTimes: null` never lands in the
    // column — a key present with no value reads, on the leads screen, as a
    // question that was answered with nothing. This channel has no address to
    // give it: it books a callback, it does not ask where the job is.
    intake: buildLeadIntake({
      details: {
        callbackRequested: true,
        preferredTimes: cleanText(preferredTimes, 120),
        capturedBy: "ai_employee",
      },
    }),
    ...(language ? { language } : {}),
  });

  return {
    ok: true,
    leadId: lead?.id || null,
    // Told back to the model in the words it should use. Without this it
    // reaches for "someone will call you within the hour", which is a time
    // nobody promised.
    say: "Recorded. Tell them the team will get back to them — do not say when.",
  };
}

/**
 * The handoff.
 *
 * Writes nothing here on purpose: respond.js records it on the
 * AiEmployeeReply row it is already writing, in the same operation as the
 * cost and the tool list. A separate write from inside a tool would be a
 * second record of the same event that could disagree with the first.
 */
function handOffToHuman({ reason }) {
  return { ok: true, handedOff: true, reason: cleanText(reason, 300) || "unspecified" };
}

const IMPLEMENTATIONS = {
  look_up_service_prices: lookUpServicePrices,
  create_instant_quote: createInstantQuote,
  book_callback: bookCallback,
  hand_off_to_human: handOffToHuman,
};

/**
 * The executor runToolLoop calls.
 *
 * @param role      decides which tools EXIST for this conversation. A name not
 *                  in the role's list throws "Unknown tool" — the same answer a
 *                  hallucinated name gets, and deliberately so: a refusal the
 *                  model can distinguish from a missing tool is a refusal it
 *                  will try to work around (lib/ai/copilotClient.js says the
 *                  same thing at more length).
 * @param dryRun    the settings screen's test box. Read-only tools run for
 *                  real, because showing a contractor a fake price would make
 *                  the test worthless; the two tools with SIDE EFFECTS return
 *                  what they WOULD have done and write nothing. There is no
 *                  third behaviour and no per-tool flag: the split is by
 *                  whether the tool writes.
 * @param onTool    called with { name, ok, summary } for every call, in order,
 *                  so respond.js can store the list on AiEmployeeReply.
 */
export function executeFor({ companyId, role, dryRun = false, source = "ai_employee", language = null, onTool }) {
  const allowed = new Set(toolsForRole(role));

  return async function execute(name, args) {
    if (!allowed.has(name)) throw new Error(`Unknown tool: ${name}`);

    const record = (ok, summary) => {
      if (onTool) onTool({ name, ok, summary });
    };

    if (dryRun && (name === "book_callback" || name === "hand_off_to_human")) {
      record(true, "simulated");
      return {
        simulated: true,
        note:
          "This is a test. Nothing was created and nobody was notified. Carry " +
          "on as though it had worked.",
        wouldHaveDone: name,
        with: args,
      };
    }

    const impl = IMPLEMENTATIONS[name];
    // `...args` first and the injected fields last, so a model that supplies
    // its own companyId has it overwritten rather than honoured.
    const result = await impl({ ...args, companyId, source, language });
    record(result?.ok !== false, result?.reason || null);
    return result;
  };
}
