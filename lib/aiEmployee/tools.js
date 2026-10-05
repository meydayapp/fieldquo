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
//   check_availability      lib/voice/availability.js's bookableSlots — the
//                           SAME computeAvailableSlots the public booking page
//                           and the phone receptionist read. Read-only.
//   book_appointment        lib/voice/availability.js's bookSlot — the same
//                           Appointment + Booking pair and the same
//                           finalizeBooking (confirmation email, consent,
//                           reminder) the self-booking confirm route writes.
//                           A visit with a fee is NOT booked here: the tool
//                           returns the booking link and the customer pays
//                           there, exactly as the phone path does.
//   send_instant_quote_link the company's own price-it-yourself page. A LINK,
//                           carrying no price — the page does the arithmetic
//                           from the company's rates (non-negotiable #4/#5).
//
// ══ Every tool carries a RISK, and the mode decides who runs it ════════════
//
// TOOL_RISK below classifies every tool as reversible, commits or floor
// (lib/aiEmployee/permission.js). executeFor() asks mayActAlone() before
// running a tool; when the answer is no, the tool is NOT run — the call is
// handed to the caller's onProposal so respond.js can write an
// AiEmployeeProposal, and the model is told to say a person will confirm.
// scripts/check-ai-employee.mjs asserts every tool in AI_EMPLOYEE_TOOLS has a
// risk here, so a new tool cannot appear unclassified.
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
import { isMarkedNotALead } from "@/lib/leads/conversationSources";
import { measureForTrade, priceAllMaterials, tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { effectiveVisibility } from "@/lib/estimate/visibility";
import { cleanPhone, cleanText, normaliseEmail } from "@/lib/voice/tools";
import { bookableSlots, bookSlot, visitPolicyFor } from "@/lib/voice/availability";
import { getAppOrigin } from "@/lib/appUrl";
import { toolsForRole, AI_EMPLOYEE_TOOLS, AI_EMPLOYEE_ROLES } from "./roles";
import { mayActAlone, RISK_REVERSIBLE, RISK_COMMITS, isRisk } from "./permission";
import { handOffToEmployee, HAND_OFF_TOOL } from "./routing";
import { openTicket } from "@/lib/clientTickets/service";
import { loadClientContext, underRecordedWarranty } from "./clientContext";
import { lookUpErrorCode } from "./errorCodes";
import { LOG_TOOL, cleanTroubleshootingLog, attemptSummary } from "./troubleshooting";
import { cleanCategory } from "./triage";

/**
 * The risk class of every tool. Frozen, complete, checked.
 *
 * look_up_service_prices and create_instant_quote are READS: the figure is
 * the server's, and the reply that carries it is the reversible action the
 * mode governs (in `ask` that reply is itself a draft nobody has sent). A
 * slot on the calendar is the one thing here that commits the company to a
 * time and a place. Nothing here spends money, deletes, moves a confirmed job,
 * sends a contract or changes a setting — there is no tool for any of it, and
 * the floor exists so that when one is added it cannot run alone.
 */
export const TOOL_RISK = Object.freeze({
  look_up_service_prices: RISK_REVERSIBLE,
  create_instant_quote: RISK_REVERSIBLE,
  send_instant_quote_link: RISK_REVERSIBLE,
  book_callback: RISK_REVERSIBLE,
  check_availability: RISK_REVERSIBLE,
  book_appointment: RISK_COMMITS,
  hand_off_to_human: RISK_REVERSIBLE,
  // Moving a conversation to a colleague commits the company to nothing; the
  // colleague's reply is governed by the same mode as this one's.
  hand_off_to_employee: RISK_REVERSIBLE,
  // A read: rows with a source, at most three, never a guess.
  look_up_error_code: RISK_REVERSIBLE,
  // Bookkeeping: writes nothing itself (the reply row records it).
  log_troubleshooting: RISK_REVERSIBLE,
});

/** The risk of a named tool. An unknown name is `floor` — see permission.js. */
export function riskOf(name) {
  const r = TOOL_RISK[name];
  return isRisk(r) ? r : "floor";
}

/**
 * When a proposed action stops making sense, per tool. A booking is stale
 * once its slot has started; nothing else here goes stale on its own.
 */
export function proposalExpiry(name, args) {
  if (name === "book_appointment") {
    const ms = Number(String(args?.slot_id || "").split("_")[1]);
    return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
  }
  return null;
}

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
      "it puts them in front of a person. When the conversation already " +
      "belongs to a known customer, their name and number are filled in from " +
      "their record — leave them out rather than asking again.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Their name. Leave it out for a known customer." },
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
        urgency: {
          type: "string",
          enum: ["routine", "urgent"],
          description:
            "\"urgent\" when something is getting worse right now — water " +
            "coming in, no heat in freezing weather, a code the lookup called " +
            "urgent. Otherwise \"routine\". The team sees it on the callback; " +
            "it does not change what you tell them about timing.",
        },
      },
      // Not even the name: a known customer's comes from their record, and
      // the implementation refuses by name ("no_name") when there is none.
      required: [],
    },
  },

  look_up_error_code: {
    name: "look_up_error_code",
    description:
      "Look up what a code on an appliance or unit's display means — from " +
      "this company's own manuals first, then FieldQuo's reference table — " +
      "with the safe steps a homeowner may take, when to stop, how urgent it " +
      "is, and where it says so. Call it whenever they give you a code. If " +
      "it finds nothing, it is not in our references: never guess what a " +
      "code means. The brand comes from their equipment record when you " +
      "leave it out.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The code exactly as they gave it — \"UE\", \"E 15\", \"4 flashes\"." },
        brand: { type: "string", description: "The brand, if they said or the record shows it." },
        model: { type: "string", description: "The model number, if they gave one." },
        appliance: { type: "string", description: "What it is — \"washer\", \"furnace\", \"water heater\" — if known." },
      },
      required: ["code"],
    },
  },

  log_troubleshooting: {
    name: "log_troubleshooting",
    description:
      "Record what you just suggested for a problem, so that if they write " +
      "back that it's still happening, the callback is booked from this " +
      "record without asking them again. Call it whenever you have given " +
      "them steps to try. It sends nothing and books nothing.",
    input_schema: {
      type: "object",
      properties: {
        symptom: { type: "string", description: "The problem, in their words." },
        code: { type: "string", description: "The code on the display, if any." },
        brand: { type: "string", description: "The brand, if known." },
        model: { type: "string", description: "The model number, if known." },
        equipment_id: { type: "string", description: "The equipment_id from their INSTALLED EQUIPMENT record, if it is one of those." },
        steps_given: { type: "array", items: { type: "string" }, description: "The steps you suggested, one per item." },
        urgency: { type: "string", enum: ["routine", "urgent"], description: "\"urgent\" if anything they said is getting worse; otherwise \"routine\"." },
      },
      required: ["symptom"],
    },
  },

  send_instant_quote_link: {
    name: "send_instant_quote_link",
    description:
      "Get the link to this company's own price-it-yourself page, to put in " +
      "your reply. Use it when they want a ballpark and you do not have their " +
      "measurements — the page asks them and prices from the company's own " +
      "rates. If it says the company has no such page, do not invent one.",
    input_schema: { type: "object", properties: {} },
  },

  check_availability: {
    name: "check_availability",
    description:
      "See which appointment times this company can actually honour. Call it " +
      "before you offer ANY time. Offer at most three of the times it returns, " +
      "by their labels, and keep their slot ids for book_appointment. If it " +
      "returns none, say you will have someone get in touch to arrange a time.",
    input_schema: {
      type: "object",
      properties: {
        preferred_date: {
          type: "string",
          description:
            "YYYY-MM-DD, if they named a day. Leave it out for the next few days.",
        },
      },
    },
  },

  book_appointment: {
    name: "book_appointment",
    description:
      "Book one of the times check_availability returned, by its slot id. " +
      "Needs their name and phone; for a visit, the address of the work. If it " +
      "comes back with a booking link, the visit has a fee and they pay there — " +
      "give them the link and do not say it is booked. If it says the slot has " +
      "gone, offer another. If it says a person will confirm, say exactly that " +
      "and never say it is booked.",
    input_schema: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "The id from check_availability, exactly as returned." },
        name: { type: "string", description: "Their name." },
        phone: { type: "string", description: "Their number, exactly as they gave it." },
        email: { type: "string", description: "Their OWN email, if they gave one." },
        address: { type: "string", description: "Where the work is. Required for a visit." },
        reason: { type: "string", description: "What the appointment is for, in their own words." },
        mode: {
          type: "string",
          description: "\"visit\" for someone coming out, \"call\" for a phone appointment. Leave it out to use the company's default.",
        },
      },
      required: ["slot_id", "name", "phone"],
    },
  },

  hand_off_to_human: {
    name: "hand_off_to_human",
    description:
      "Stop answering and put this conversation in front of a person. Use it " +
      "when they ask for a human, when they are upset, when it is urgent, when " +
      "they want something you are not allowed to answer, or whenever you are " +
      "not sure. After this you say one sentence telling them you are passing " +
      "it on — without promising when — and you call nothing else. When it is " +
      "urgent or an emergency, say so in `urgency`: the company's on-call " +
      "person is alerted from it.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why, in a few words. The contractor reads this, not the customer.",
        },
        urgency: {
          type: "string",
          enum: ["routine", "urgent", "emergency"],
          description:
            "\"emergency\" for gas or CO, fire, someone hurt, water on the electrics; " +
            "\"urgent\" for property damage happening now (water actively leaking, no heat " +
            "in freezing weather, a roof leaking in a storm, sewage backing up, a hot " +
            "outlet); otherwise \"routine\". Decide only once you are sure — ask first " +
            "when it isn't clear.",
        },
        category: {
          type: "string",
          enum: ["water", "heat", "roof", "sewage", "electrical", "gas_co", "fire", "injury", "water_electrics", "other"],
          description: "What it is about, when urgent or an emergency.",
        },
      },
      required: ["reason"],
    },
  },

  hand_off_to_employee: {
    name: "hand_off_to_employee",
    description:
      "Pass this conversation to a colleague on the business's AI team whose " +
      "job it is: the closer for prices and quotes, the receptionist for " +
      "bookings and callbacks, the troubleshooter for something broken or " +
      "work already done. Use it when what they need is another job, not " +
      "yours. If it succeeds, say in one short sentence that your colleague " +
      "will take it from here, and stop — they write the next message. If it " +
      "says there is no such colleague, carry on or hand off to a person.",
    input_schema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: [...AI_EMPLOYEE_ROLES],
          description: "Which colleague: closer, receptionist, troubleshooter or custom.",
        },
        reason: {
          type: "string",
          description: "Why, in a few words. The contractor reads this, not the customer.",
        },
      },
      required: ["role", "reason"],
    },
  },
};

/**
 * The definitions this role may be given. Never more, never fewer.
 *
 * @param disabledTools  the company's own switches on this employee
 *                       (AiEmployee.disabledTools), applied inside the role.
 * @param afterHandOff   true on the turn a colleague just handed over: the
 *                       hand-off tool is withheld so one inbound message can
 *                       move a thread once and never bounce it back.
 */
export function definitionsForRole(role, { disabledTools = [], afterHandOff = false, onlyTools = null } = {}) {
  return toolsForRole(role, { disabledTools })
    .filter((name) => !(afterHandOff && name === HAND_OFF_TOOL))
    // The follow-up past the reply cap: shown exactly the tools it may call.
    .filter((name) => !Array.isArray(onlyTools) || onlyTools.includes(name))
    .map((name) => DEFINITIONS[name])
    .filter(Boolean);
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
  urgency,
  // Injected by executeFor (or the proposal executor), never by the model —
  // see the module header.
  source = "ai_employee",
  language = null,
  threadId = null,
  prisma = db,
  // { client, attempt } from respond.js — the known client's record and the
  // troubleshooting attempt still waiting, when there are either.
  context = null,
}) {
  const level = urgency === "urgent" ? "urgent" : "routine";
  const thread = await threadFacts(prisma, companyId, threadId);
  // The client's record: handed in by the live reply, or read here — for an
  // approved proposal (which has the thread, not the reply's context), or
  // whenever the reply had none to hand. The thread, read under the
  // company, is what says whether there IS a known client.
  const client =
    context?.client ||
    (thread?.clientId ? await loadClientContext(prisma, { companyId, clientId: thread.clientId }) : null);
  const tried = attemptSummary(context?.attempt || null, { equipment: client?.equipment || [] });
  const best = cleanText(preferredTimes, 120);
  const note = [cleanText(summary, 800), tried, best ? `Best time: ${best}` : null].filter(Boolean).join("\n");

  // ── A KNOWN client's problem is a ticket on their record, not a new lead ──
  //
  // Until 2026-10-04 an existing customer whose furnace stopped became a
  // brand-new lead — a stranger on the board, with no job, no equipment and
  // no history beside it. ClientTicket is where their problem belongs: on
  // their record, typed repair or warranty, prioritised, linked to the job
  // that installed the equipment. Created through the ONE ticket creator
  // (lib/clientTickets/service.js openTicket), which verifies every link
  // under this client and company and tells the office.
  if (client?.clientId) {
    const item = pickEquipment(client, context?.attempt);
    const warranty = underRecordedWarranty(item);
    const subjectText = cleanText(summary, 80) || cleanText(context?.attempt?.symptom, 80) || "Callback request";
    const open = (jobId) =>
      openTicket({
        client: { id: client.clientId, companyId, name: client.contact?.name || "" },
        input: {
          type: warranty ? "warranty" : "repair",
          subject: `Callback request: ${subjectText}`,
          body: note || "They asked for a call back.",
          ...(jobId ? { jobId } : {}),
        },
        priority: level === "urgent" ? "urgent" : "normal",
        db: prisma,
      });
    let opened = await open(item?.installedByJobId || null);
    // An install job that no longer resolves under this client (moved,
    // archived) must not lose the ticket — the link is dropped, the ticket
    // is written.
    if (!opened.ok && item?.installedByJobId) opened = await open(null);
    if (!opened.ok) return { ok: false, reason: opened.error || "ticket_failed" };
    return {
      ok: true,
      ticketId: opened.ticket?.id || null,
      urgency: level,
      say: "Recorded on their customer file. Tell them the team will get back to them — do not say when.",
    };
  }

  const cleanName = cleanText(name, 120) || cleanText(thread?.participantName, 120);
  if (!cleanName) return { ok: false, reason: "no_name" };

  // The office deleted the lead this conversation made and said "don't
  // create a lead from this conversation again" (lib/leads/deleteLead.js).
  // That statement binds the employee too: no lead, and nothing told to the
  // customer that would claim one was recorded.
  if (thread?.notALead) {
    return {
      ok: false,
      reason: "conversation_marked_not_a_lead",
      say: "Nothing was recorded. Do not tell them a callback is booked.",
    };
  }

  const lead = await createScoredLead({
    companyId,
    name: cleanName,
    phone: cleanPhone(phone) || thread?.phone || undefined,
    email: normaliseEmail(email) || undefined,
    // The readable summary staff actually see. The preferred time goes in it
    // as well as in intake, because the lead list shows the message and a
    // callback nobody can time is a callback that does not connect.
    message: note,
    source,
    // Through the shared shape so `preferredTimes: null` never lands in the
    // column — a key present with no value reads, on the leads screen, as a
    // question that was answered with nothing. This channel has no address to
    // give it: it books a callback, it does not ask where the job is.
    intake: buildLeadIntake({
      details: {
        callbackRequested: true,
        preferredTimes: best,
        capturedBy: "ai_employee",
        // Read by the leads board's Callback badge (app/app/leads/page.js),
        // which shows "Urgent" beside it — the hint is stored AND shown.
        callbackUrgency: level,
      },
    }),
    // The column the board's Callback badge, sort and dashboard read
    // (LeadRequest.callbackRequestedAt). Until 2026-10-04 an AI-booked
    // callback set only intake.callbackRequested, which nothing on the board
    // reads — so it arrived as an ordinary new lead with no badge.
    callbackRequestedAt: new Date(),
    ...(language ? { language } : {}),
  });

  // The conversation points at the lead it made — only where nobody has
  // pointed it anywhere (a person's link stands, as in
  // lib/leads/conversationLead.js). Until 2026-10-05 the callback lead was
  // never linked, so the inbox could not open it and deleting it could not
  // find the conversation to mark "not a lead" (lib/leads/deleteLead.js).
  if (lead?.id && threadId && prisma?.messageThread?.updateMany) {
    await prisma.messageThread
      .updateMany({ where: { id: threadId, companyId, leadId: null }, data: { leadId: lead.id } })
      .catch((err) => console.error("[aiEmployee] thread link failed:", err?.message));
  }

  return {
    ok: true,
    leadId: lead?.id || null,
    urgency: level,
    // Told back to the model in the words it should use. Without this it
    // reaches for "someone will call you within the hour", which is a time
    // nobody promised.
    say: "Recorded. Tell them the team will get back to them — do not say when.",
  };
}

/** The piece of equipment a callback is about: the one the attempt named,
 *  or the only one on record. Never a guess between several. */
function pickEquipment(client, attempt) {
  const list = client?.equipment || [];
  if (attempt?.equipmentId) return list.find((e) => e.id === attempt.equipmentId) || null;
  return list.length === 1 ? list[0] : null;
}

/** The thread's own facts — its client, the name it carries, and an SMS
 *  thread's number — read under the company. Null without a thread. */
async function threadFacts(prisma, companyId, threadId) {
  if (!threadId || !prisma?.messageThread?.findFirst) return null;
  try {
    const t = await prisma.messageThread.findFirst({
      where: { id: threadId, companyId },
      select: { clientId: true, participantName: true, participantExternalId: true, leadCapture: true, channel: { select: { platform: true } } },
    });
    if (!t) return null;
    const phone = t.channel?.platform === "sms" ? cleanPhone(t.participantExternalId) : null;
    return {
      clientId: t.clientId || null,
      participantName: t.participantName || null,
      phone: phone || null,
      notALead: isMarkedNotALead(t.leadCapture),
    };
  } catch (err) {
    console.error("[aiEmployee] thread read failed:", err?.message);
    return null;
  }
}

/**
 * What a code means — lib/aiEmployee/errorCodes.js. The equipment the brand
 * is resolved from is the known client's, injected; the model supplies the
 * code and, optionally, what the customer said about the machine.
 */
async function lookUpErrorCodeTool({ companyId, code, brand, model, appliance, prisma = db, context = null, threadId = null }) {
  let equipment = context?.client?.equipment;
  if (!equipment && threadId) {
    const thread = await threadFacts(prisma, companyId, threadId);
    equipment = thread?.clientId ? (await loadClientContext(prisma, { companyId, clientId: thread.clientId }))?.equipment : [];
  }
  const out = await lookUpErrorCode({
    prisma,
    companyId,
    code: cleanText(code, 40),
    brand: cleanText(brand, 60),
    model: cleanText(model, 60),
    appliance: cleanText(appliance, 60),
    equipment: equipment || [],
  });
  // The rows carry text a company's manual (or its owner) typed — fenced.
  // The instruction for the model stays outside the fence: it is ours.
  const { codes = [], ...rest } = out;
  return { ...rest, ...fenceCompanyData({ codes }) };
}

/**
 * The attempt, recorded. Writes nothing: respond.js keeps the cleaned log
 * on the reply row's toolsUsed (onTool's `detail`), where the next turn
 * finds it (lib/aiEmployee/troubleshooting.js pendingAttempt).
 */
function logTroubleshooting({ context = null, ...args }) {
  const equipmentIds = (context?.client?.equipment || []).map((e) => e.id);
  const log = cleanTroubleshootingLog(args, { equipmentIds });
  if (!log) return { ok: false, reason: "no_symptom" };
  // A step that is not vetted (a panel, a gas valve, a ladder, live wiring —
  // lib/aiEmployee/knowledge/firstSteps.js) is not recorded, and the model
  // is told to take it out of its reply. The reply guard in respond.js holds
  // the reply for a person if it stays in.
  if (log.refusedSteps?.length) {
    return {
      ok: true,
      logged: log,
      urgency: log.urgency,
      refused: log.refusedSteps,
      say: "These steps are not ones you may give — remove them from your reply and offer to get a tech instead: " + log.refusedSteps.join("; "),
    };
  }
  return { ok: true, logged: log, urgency: log.urgency, say: "Noted. Finish your reply — the closing line about writing back is added for you." };
}

/**
 * The handoff.
 *
 * Writes nothing here on purpose: respond.js records it on the
 * AiEmployeeReply row it is already writing, in the same operation as the
 * cost and the tool list. A separate write from inside a tool would be a
 * second record of the same event that could disagree with the first.
 */
function handOffToHuman({ reason, urgency, category }) {
  // urgency/category are the model's half of the turn's triage
  // (lib/aiEmployee/triage.js turnTriage) — cleaned to the closed lists here,
  // and never able to LOWER what the pattern match over the customer's own
  // words found.
  const u = urgency === "emergency" || urgency === "urgent" ? urgency : "routine";
  return { ok: true, handedOff: true, reason: cleanText(reason, 300) || "unspecified", urgency: u, ...(u !== "routine" ? { category: cleanCategory(category) || "other" } : {}) };
}

/**
 * The company's own instant-quote page, or the honest "none".
 *
 * A link and nothing else: the page prices from the company's rates when the
 * homeowner fills it in, so the reply carries no figure. Refused by name when
 * the company has no enabled estimator, so the model does not send someone to
 * a page that says "nothing configured".
 */
async function sendInstantQuoteLink({ companyId }) {
  const [company, enabled] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { slug: true, bookingSlug: true } }),
    db.instantQuoteConfig.count({ where: { companyId, enabled: true } }),
  ]);
  const slug = String(company?.bookingSlug || company?.slug || "").trim();
  if (!slug || enabled === 0) return { ok: false, reason: "no_instant_quote" };
  return {
    ok: true,
    url: `${getAppOrigin()}/instant-quote/${encodeURIComponent(slug)}`,
    say: "Give them this link. It asks for their measurements and prices from the company's own rates — you do not quote a figure.",
  };
}

/**
 * The calendar, read through the phone receptionist's own reader — which is
 * the public booking page's computeAvailableSlots underneath. Slot ids are
 * the opaque tokens that file mints, so the model cannot invent one.
 */
async function checkAvailability({ companyId, preferred_date: preferredDate }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(preferredDate || "")) ? preferredDate : null;
  const slots = await bookableSlots(companyId, date);
  return fenceCompanyData({
    ok: true,
    count: slots.length,
    slots: slots.map((s) => ({ slot_id: s.id, label: s.label })),
    say: slots.length
      ? "Offer up to three of these by label. Book only with a slot_id from this list."
      : "Nothing is free in that window. Say someone will be in touch to arrange a time.",
  });
}

/**
 * A real appointment — the same write the phone receptionist and the public
 * confirm route make (lib/voice/availability.js's bookSlot: Appointment +
 * Booking, re-checked for a clash at booking time, then finalizeBooking's
 * confirmation email, consent record and reminder).
 *
 * A fee is not taken here. bookSlot refuses with "fee_due"; this returns the
 * company's booking link so the customer pays on the page, and the model is
 * told not to say it is booked.
 */
async function bookAppointment({
  companyId,
  slot_id: slotId,
  name,
  phone,
  email,
  address,
  reason,
  mode,
  source = "ai_employee",
  // { client, attempt } from respond.js. A KNOWN customer's name, phone and
  // the address on their only piece of equipment fill in what the model
  // left out — the troubleshooter is told not to ask for them again.
  context = null,
}) {
  const client = context?.client || null;
  const onlySite = (client?.equipment || []).length === 1 ? client.equipment[0].siteAddress : null;
  const cleanName = cleanText(name, 120) || cleanText(client?.contact?.name, 120);
  const cleanedPhone = cleanPhone(phone) || cleanPhone(client?.contact?.phone);
  if (!address && onlySite) address = onlySite;
  if (!email && client?.contact?.email) email = client.contact.email;
  if (!cleanName) return { ok: false, reason: "no_name" };
  if (!cleanedPhone) return { ok: false, reason: "no_phone" };

  const result = await bookSlot({
    companyId,
    slotId: String(slotId || ""),
    name: cleanName,
    phone: cleanedPhone,
    email: normaliseEmail(email) || null,
    address: cleanText(address, 300) || null,
    reason: cleanText(reason, 1000) || null,
    mode: mode === "call" || mode === "visit" || mode === "video" ? mode : null,
    source,
  });

  if (result.ok) {
    return {
      ok: true,
      bookingId: result.bookingId,
      when: result.label,
      confirmationEmailed: result.confirmationSent,
      say: `Booked for ${result.label}. Tell them that, and that a confirmation ${result.confirmationSent ? "email has been sent" : "will follow"}.`,
    };
  }

  if (result.reason === "fee_due") {
    const policy = await visitPolicyFor(companyId, { origin: getAppOrigin() });
    return {
      ok: false,
      reason: "fee_due",
      bookingUrl: policy.bookingUrl || null,
      say: "This visit has a fee, so it is booked and paid on the booking page. Give them the link. Do not say it is booked.",
    };
  }

  return {
    ok: false,
    reason: result.reason,
    say:
      result.reason === "taken"
        ? "That time has just gone. Offer another from check_availability."
        : result.reason === "address_required"
          ? "Ask for the address of the work, then try again."
          : "Could not book that. Check availability again and offer another time.",
  };
}

const IMPLEMENTATIONS = {
  look_up_service_prices: lookUpServicePrices,
  create_instant_quote: createInstantQuote,
  send_instant_quote_link: sendInstantQuoteLink,
  book_callback: bookCallback,
  check_availability: checkAvailability,
  book_appointment: bookAppointment,
  hand_off_to_human: handOffToHuman,
  // The assignment moves in lib/aiEmployee/routing.js, under the companyId
  // and threadId executeFor injects — the model names a ROLE, never an
  // employee id and never a thread.
  hand_off_to_employee: ({ role, reason, companyId, threadId, employeeId, prisma }) =>
    handOffToEmployee({ companyId, threadId, fromEmployeeId: employeeId, role, reason, ...(prisma ? { prisma } : {}) }),
  look_up_error_code: lookUpErrorCodeTool,
  log_troubleshooting: logTroubleshooting,
};

/** Every tool with a side effect — the ones a dry run simulates. */
const WRITES = new Set(["book_callback", "book_appointment", "hand_off_to_human", "hand_off_to_employee"]);

/**
 * The two hand-offs change WHO answers, not what the company has promised
 * anyone, so they run in every mode — including `ask`, where the reply they
 * sit in is itself a draft nobody has sent. Proposing a hand-off would put
 * "may the receptionist stop answering?" in the approval inbox beside "may
 * it book Tuesday?", and a person approving the first has nothing to gain:
 * the thread is already waiting on them. Simulated on a dry run like every
 * other write.
 */
const ROUTING = new Set(["hand_off_to_human", "hand_off_to_employee"]);

/**
 * The one door onto a tool's implementation, for the proposal path.
 *
 * lib/aiEmployee/proposals.js's executeProposal calls this with the
 * proposal's OWN companyId. It is the same map, the same injection order and
 * the same argument shape as the live path below, so an approved proposal
 * does exactly what the employee would have done — and nothing outside this
 * module can reach IMPLEMENTATIONS at all.
 */
export async function runToolForCompany({ companyId, name, args, source = "ai_employee", language = null, threadId = null }) {
  if (!AI_EMPLOYEE_TOOLS.includes(name)) throw new Error(`Unknown tool: ${name}`);
  const impl = IMPLEMENTATIONS[name];
  if (!impl) throw new Error(`Unknown tool: ${name}`);
  // threadId is the PROPOSAL ROW's (read under the member's company), never
  // the model's: an approved callback on a known client's thread becomes a
  // ticket on that client, exactly as the live reply would have made it.
  return impl({ ...args, companyId, source, language, threadId });
}

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
 *                  the test worthless; the tools with SIDE EFFECTS (WRITES)
 *                  return what they WOULD have done — or would have PROPOSED,
 *                  under the mode — and write nothing. There is no third
 *                  behaviour and no per-tool flag: the split is by whether
 *                  the tool writes.
 * @param mode      the employee's permission mode (lib/aiEmployee/permission.js).
 * @param tainted   whether this turn's input came from an untrusted party.
 *                  Every channel turn is; the default says so.
 * @param onProposal async ({ name, args, risk }) => proposalId. Called instead
 *                  of the tool when the mode does not allow it alone. The
 *                  caller writes the row; this module writes nothing.
 * @param onTool    called with { name, ok, summary, result } for every call,
 *                  in order, so respond.js can store the list on
 *                  AiEmployeeReply and read a hand-off's destination.
 * @param disabledTools  AiEmployee.disabledTools — the company's switches,
 *                  applied inside the role exactly as definitionsForRole
 *                  applies them, so a tool the model was not shown is also a
 *                  tool it cannot call by name.
 * @param threadId / employeeId  injected into the hand-off tool the way
 *                  companyId is injected into every tool: the model never
 *                  names a thread or an employee.
 * @param afterHandOff  see definitionsForRole.
 * @param prisma    the client the hand-off's reads and writes go through —
 *                  respond.js hands over the one it was given, so the check
 *                  can script it. Every other tool reads through lib/db
 *                  directly, as before.
 */
export function executeFor({
  companyId,
  role,
  mode = "ask",
  tainted = true,
  dryRun = false,
  source = "ai_employee",
  language = null,
  disabledTools = [],
  threadId = null,
  employeeId = null,
  afterHandOff = false,
  prisma = db,
  onTool,
  onProposal = null,
  // { client, attempt } — the known client's record and a pending
  // troubleshooting attempt, read by respond.js under companyId. Injected
  // like companyId: the model never supplies either.
  context = null,
  // A follow-up past the reply cap may only book the callback or fetch a
  // person (lib/aiEmployee/troubleshooting.js FOLLOW_UP_TOOLS).
  onlyTools = null,
}) {
  const allowed = new Set(
    toolsForRole(role, { disabledTools })
      .filter((n) => !(afterHandOff && n === HAND_OFF_TOOL))
      .filter((n) => !Array.isArray(onlyTools) || onlyTools.includes(n)),
  );

  return async function execute(name, args) {
    if (!allowed.has(name)) throw new Error(`Unknown tool: ${name}`);

    const record = (ok, summary, result = null) => {
      // A troubleshooting log's cleaned record travels as `detail`, so the
      // reply row's toolsUsed carries it for the next turn.
      const detail = name === LOG_TOOL && result?.ok ? result.logged : null;
      if (onTool) onTool({ name, ok, summary, result, ...(detail ? { detail } : {}) });
    };

    // ── The mode gate, before anything runs ─────────────────────────────
    //
    // Asked of every call, read-only ones included: mayActAlone answers yes
    // for a reversible read in every mode but `ask`, and in `ask` even a
    // price lookup is allowed to run because the reply that would carry it is
    // itself the draft a person reads first. What `ask` never lets run is a
    // write — those become proposals below.
    const risk = riskOf(name);
    const alone = mayActAlone({ mode, risk, tainted });
    const isWrite = WRITES.has(name);

    if (!alone && isWrite && !ROUTING.has(name)) {
      if (dryRun) {
        record(true, "would_propose");
        return {
          simulated: true,
          wouldPropose: true,
          wouldHaveDone: name,
          with: args,
          note:
            "This is a test. In this mode the action would wait for a person to " +
            "approve it. Tell them someone from the team will confirm — do not say it is done.",
        };
      }
      const proposalId = onProposal ? await onProposal({ name, args, risk }) : null;
      record(true, "proposed");
      return {
        proposed: true,
        proposalId,
        note:
          "This needs a person at the company to approve it before it happens. " +
          "Tell them someone from the team will confirm shortly. Do NOT say it is " +
          "booked, recorded or done.",
      };
    }

    if (dryRun && isWrite) {
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
    const result = await impl({ ...args, companyId, source, language, threadId, employeeId, prisma, context });
    record(result?.ok !== false, result?.reason || null, result);
    return result;
  };
}
