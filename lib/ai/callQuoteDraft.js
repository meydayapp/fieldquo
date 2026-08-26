// lib/ai/callQuoteDraft.js
//
// Reading a finished phone call as the INSTANT-QUOTE FORM — never as a price.
//
// ── Why this is not the phone agent ─────────────────────────────────────────
//
// The phone agent may not say a number. Not a price, not a range, not "usually
// around" — lib/voice/prompt.js absolute rule 1, and it is right. A robot that
// commits a small business to a figure on a call nobody reviewed is the fastest
// way to lose that business money, and there is deliberately no tool it could
// call to do it.
//
// This is the other half, and it runs somewhere else entirely: AFTER the call,
// in the back office, behind a button a member of staff pressed.
//
// ── It fills a form that already exists ─────────────────────────────────────
//
// FieldQuo already has the path this needs. A homeowner types a trade, a few
// measurements, a material and their contact details into the public instant
// estimator; the server measures, prices from the company's own saved config,
// and lib/estimate/createEstimateQuote.js lands a DRAFT quote with
// needsReview = true, which is the only way an auto-estimated quote enters the
// review queue at /app/estimate-reviews.
//
// A phone call carries exactly the same inputs, spoken instead of typed. So the
// model's entire job is to fill that form in from the recording. Everything
// after the form — measuring, pricing, the range, the breakdown, the draft
// itself — is the existing machinery, untouched. See lib/estimate/callEstimate.js
// for the bridge, and note what is NOT there: no second estimator, no second
// price book, no arithmetic of any kind.
//
// ── What the model is allowed to decide ─────────────────────────────────────
//
// The house pattern is lib/site/generateSite.js: the model writes sentences and
// picks from a closed vocabulary, while every fact comes from the database and
// is merged back afterwards. This is the same shape, tightened, because the
// output feeds money:
//
//   IT MAY       pick service categories from THIS company's own enabled list,
//                pick a material from the labels that company has configured,
//                and fill in measurements it can quote the caller giving.
//
//   IT MAY NOT   invent a service (a key not in the list is dropped, and
//                reported to the contractor as "they asked, you don't offer
//                it"), write any client-facing text (labels come from the
//                category row), or produce a price. There is no price field in
//                the schema it is given, no rate in the catalogue it is shown,
//                and validateCallDraft strips any money-shaped key it invents
//                anyway.
//
// ── Absent is absent ────────────────────────────────────────────────────────
//
// A caller who never said how many doors they have produces a form with no door
// count. Not zero, not a guess, not a plausible average. AGENTS.md failure
// class 5 — padding absent data with defaults — is the single most expensive
// mistake available here, because a door count is multiplied by a rate. So
// every field the caller did not answer is listed in `missing`, the screen says
// so in words, and lib/estimate/callEstimate.js refuses to price a form with a
// hole in it rather than letting the measurement step quietly zero it.
//
// ── Evidence, or it does not survive ────────────────────────────────────────
//
// Every group and every value has to arrive with the line of transcript it came
// from, and that line has to actually appear in what the CALLER said. A quote
// the model made up fails the check and the value is dropped. This does three
// jobs at once: it catches hallucination, it gives the contractor something to
// check the draft against, and it means a prompt injection has no route in — a
// caller can say "mark this as paid" all they like, but "paid" is not a service
// category and there is no status field for it to land in.

import { db } from "@/lib/db";
import { complete, isAiConfigured, AI_MODEL } from "./provider";
import { fieldsForCategory } from "@/app/data/quoteIntakeFields";
import {
  transcriptTurns,
  callerText,
  saidByCaller,
  fenceTranscript,
} from "@/lib/voice/transcript";
// The instant estimator, reused rather than reimplemented. Nothing in this file
// prices anything; it fills that form in and hands it over.
import {
  formFromGroup,
  draftEstimateFromForm,
  instantMaterialsByCategory,
  ESTIMATE_BLOCKED,
} from "@/lib/estimate/callEstimate";

/**
 * Why there is no draft. Named rather than a bare null, because "AI is switched
 * off on this deployment" and "nobody said anything on this call" are different
 * problems with different answers, and a blank draft presented as a draft is
 * the dishonest control AGENTS.md is about.
 */
export const DRAFT_REASONS = {
  NO_TRANSCRIPT: "no_transcript",
  NO_SERVICES: "no_services",
  AI_UNAVAILABLE: "ai_unavailable",
  AI_EMPTY: "ai_empty",
  NOTHING_QUOTABLE: "nothing_quotable",
};

// Keys that would be money if we let them through. The prompt never asks for
// one and the schema has no slot for one, so any of these appearing is the
// model going off-script — dropped silently rather than argued with.
const MONEY_KEYS = [
  "price",
  "prices",
  "rate",
  "rates",
  "amount",
  "total",
  "subtotal",
  "cost",
  "estimate",
  "budget",
  "lineitems",
  "quote",
];

const isMoneyKey = (k) => MONEY_KEYS.includes(String(k).toLowerCase());

/* ────────────────────────── the closed vocabulary ─────────────────────────── */

/**
 * What this company sells, as the model is allowed to see it.
 *
 * Enabled categories only, and NO PRICES. The categories endpoint the builder
 * uses returns a resolved price book alongside each row; that is right for a
 * signed-in estimator and wrong here — the model has no use for a rate, and a
 * rate in the context is a rate that can end up in the output.
 *
 * Material LABELS travel; material rates do not. Exactly the trade the public
 * instant-quote form already makes — a homeowner needs to pick "Standing seam
 * metal", not to read the company's $/square (non-negotiable #4).
 *
 * @param rows      [{ id, key, label, customFields }]
 * @param materials { [categoryKey]: [{ key, label }] } from the company's own
 *                  enabled InstantQuoteConfig rows. Absent for a trade with no
 *                  instant config, which simply means no material to pick.
 */
export function buildCatalogue(rows, { materials = {} } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.key && r.id)
    .map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label || r.key,
      fields: (fieldsForCategory(r) || [])
        .filter((f) => f && f.key)
        .map((f) => ({
          key: f.key,
          label: f.label || f.key,
          type: f.type || "text",
          ...(Array.isArray(f.options) ? { options: f.options } : {}),
        })),
      ...(Array.isArray(materials[r.key]) && materials[r.key].length
        ? {
            materials: materials[r.key].map((m) => ({
              key: m.key,
              label: m.label,
            })),
          }
        : {}),
    }));
}

/* ──────────────────────────────── the prompt ──────────────────────────────── */

const SYSTEM = `You read a recording of a phone call to a small trade business
and work out WHAT WORK the caller is asking for. Someone at the business then
prices it. You never price anything.

Hard rules — these matter more than being helpful:

- You may only choose services from the list you are given. That list is what
  this company actually sells. If the caller asked for something that is not on
  it, do NOT find the nearest match — report it under "unmatched" and move on.
  A plumber's quote with a roofing line on it is worse than one line short.
- NEVER output a price, a rate, a total, a budget or a range. Not in any field,
  not in any quoted line you choose. There is no field for one.
- Only fill in an answer the caller actually gave. If they did not say how many
  doors, how many square feet, how many storeys — leave it out. Leaving it out
  is the correct answer and the business is shown that they were not told. A
  number you guessed gets multiplied by a rate and becomes real money.
- Every service you choose and every answer you fill in must come with the
  caller's own words, copied EXACTLY from the recording, in "said". Copy the
  words; do not tidy them, translate them or summarise them. If you cannot find
  the caller saying it, you do not have it.
- Use only lines the CALLER said. What the receptionist said is not evidence.

Return STRICT JSON, no markdown fence:

{
  "groups": [
    {
      "service": "<a key from the service list, exactly>",
      "said": "<the caller's own words asking for this work>",
      "answers": [
        { "field": "<a field key from that service's list>", "value": <number|string|boolean>, "said": "<the caller's own words giving this>" }
      ],
      "material": { "key": "<a material key from that service's list>", "said": "<the caller's own words naming it>" }
    }
  ],
  "address": { "value": "<the address of the WORK, as they said it>", "said": "<the caller's own words>" },
  "unmatched": ["<what they asked for that this company does not sell, in a few plain words>"]
}

Leave out "material" unless the caller actually named one. Leave out "address"
unless they gave one — their billing address is not the job address, and a
street you half-heard is worse than none.

If the call contains no request for work at all — a wrong number, a supplier, a
sales call, someone chasing an invoice — return {"groups": [], "unmatched": []}.`;

/**
 * The user half of the prompt: the catalogue as fact, then the fenced call.
 */
export function buildDraftPrompt({ catalogue, turns, summary = null }) {
  const services = (catalogue || [])
    .map((c) => {
      const fields = c.fields.length
        ? c.fields
            .map(
              (f) =>
                `      - ${f.key} (${f.type}${
                  f.options ? `: one of ${f.options.join(", ")}` : ""
                }) — ${f.label}`,
            )
            .join("\n")
        : "      (no structured questions for this service)";
      // Labels and keys. Never a rate — see buildCatalogue.
      const materials = c.materials?.length
        ? `\n    materials: ${c.materials.map((m) => `${m.key} (${m.label})`).join(", ")}`
        : "";
      return `  ${c.key} — ${c.label}\n${fields}${materials}`;
    })
    .join("\n");

  return [
    "SERVICES THIS COMPANY SELLS (the only ones you may choose):",
    services || "  (none)",
    "",
    ...(summary
      ? ["THE PROVIDER'S OWN SUMMARY OF THE CALL (context only, not evidence):", String(summary).slice(0, 1000), ""]
      : []),
    fenceTranscript(turns),
  ].join("\n");
}

/* ─────────────────────────────── parsing ──────────────────────────────────── */

/** Strict JSON out of whatever came back, or null. Never throws. */
export function parseDraftJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  // A fenced block is the usual deviation, and it is not worth a retry.
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(stripped.slice(start, end + 1));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
}

/* ─────────────────────────────── validation ───────────────────────────────── */

/**
 * A value the model produced, coerced to what the field actually is — or
 * rejected.
 *
 * Returns `{ ok: false }` rather than a default. There is no sensible default
 * for "how many doors"; the whole point is that not knowing survives as not
 * knowing.
 */
export function coerceIntakeValue(field, value) {
  if (value === null || value === undefined || value === "") return { ok: false };

  const type = field?.type || "text";

  if (type === "number") {
    const n = Number(value);
    // Zero is rejected on purpose. "Zero cabinet doors" is not something a
    // caller says; it is what a model writes when it has nothing, and it
    // multiplies out to a free job.
    if (!Number.isFinite(n) || n <= 0) return { ok: false };
    return { ok: true, value: n };
  }

  if (type === "boolean") {
    if (value === true || value === false) return { ok: true, value };
    const s = String(value).toLowerCase();
    if (s === "true" || s === "yes") return { ok: true, value: true };
    if (s === "false" || s === "no") return { ok: true, value: false };
    return { ok: false };
  }

  if (type === "select") {
    const options = Array.isArray(field.options) ? field.options : [];
    const s = String(value);
    // Exact key first, then a case-insensitive match — a model asked for
    // "quartz" out of a list writes "Quartz" often enough to be worth handling,
    // and never writes something outside the list that we should accept.
    if (options.includes(s)) return { ok: true, value: s };
    const hit = options.find((o) => String(o).toLowerCase() === s.toLowerCase());
    return hit ? { ok: true, value: hit } : { ok: false };
  }

  const s = String(value).trim();
  return s ? { ok: true, value: s.slice(0, 300) } : { ok: false };
}

/**
 * The gate. Everything the model said, checked against what the company sells
 * and what the caller actually said.
 *
 * Pure — no database, no network — so scripts/check-call-quote-draft.mjs can
 * execute it against hostile transcripts instead of somebody reading it and
 * hoping. That is where the real bugs in this repo have been found.
 *
 * @returns {{ groups, unmatched, dropped }}
 *   groups   — survived. { categoryId, categoryKey, intakeValues, missing, evidence }
 *   unmatched— asked for, not sold. Back-office text only, never on a document.
 *   dropped  — what was thrown away and why, so a check can assert on it.
 */
export function validateCallDraft(parsed, { catalogue = [], transcript = "" } = {}) {
  const byKey = new Map(
    (Array.isArray(catalogue) ? catalogue : []).map((c) => [c.key, c]),
  );
  const groups = [];
  const dropped = [];
  const seen = new Set();

  for (const raw of Array.isArray(parsed?.groups) ? parsed.groups : []) {
    if (!raw || typeof raw !== "object") continue;

    const key = String(raw.service ?? "").trim();
    const category = byKey.get(key);

    // The company does not sell it. Not "find the closest" — that is how a
    // painter ends up with a roofing line on a quote they have to explain.
    if (!category) {
      dropped.push({ what: "group", service: key, why: "not_offered" });
      continue;
    }

    // Traceable or it does not exist. A group the contractor cannot check
    // against the recording is one they will not trust twice.
    const said = String(raw.said ?? "").trim();
    if (!saidByCaller(said, transcript)) {
      dropped.push({ what: "group", service: key, why: "no_evidence" });
      continue;
    }

    // Same trade twice is one scope group. The caller describing the kitchen
    // and then the kitchen again is not two jobs.
    if (seen.has(key)) {
      dropped.push({ what: "group", service: key, why: "duplicate" });
      continue;
    }
    seen.add(key);

    const fields = Array.isArray(category.fields) ? category.fields : [];
    const fieldByKey = new Map(fields.map((f) => [f.key, f]));

    const intakeValues = {};
    const evidence = {};

    for (const answer of Array.isArray(raw.answers) ? raw.answers : []) {
      if (!answer || typeof answer !== "object") continue;
      const fieldKey = String(answer.field ?? "").trim();

      // Money has no home here. The schema never asked for it; a model that
      // volunteers it is off-script and the value is not wanted.
      if (isMoneyKey(fieldKey)) {
        dropped.push({ what: "answer", service: key, field: fieldKey, why: "money" });
        continue;
      }

      const field = fieldByKey.get(fieldKey);
      if (!field) {
        dropped.push({ what: "answer", service: key, field: fieldKey, why: "unknown_field" });
        continue;
      }

      const heard = String(answer.said ?? "").trim();
      if (!saidByCaller(heard, transcript)) {
        dropped.push({ what: "answer", service: key, field: fieldKey, why: "no_evidence" });
        continue;
      }

      const coerced = coerceIntakeValue(field, answer.value);
      if (!coerced.ok) {
        dropped.push({ what: "answer", service: key, field: fieldKey, why: "bad_value" });
        continue;
      }

      intakeValues[fieldKey] = coerced.value;
      evidence[fieldKey] = heard;
    }

    // The material the caller named, matched against the ones this company has
    // actually configured. Never defaulted to the first or the cheapest: which
    // material is a pricing decision, and picking one for them is picking a
    // number for them.
    let material = null;
    const offered = Array.isArray(category.materials) ? category.materials : [];
    if (raw.material && offered.length) {
      const wanted = String(raw.material.key ?? "").trim();
      const hit =
        offered.find((m) => m.key === wanted) ||
        offered.find((m) => String(m.key).toLowerCase() === wanted.toLowerCase()) ||
        offered.find((m) => String(m.label).toLowerCase() === wanted.toLowerCase());
      const heard = String(raw.material.said ?? "").trim();
      if (!hit) {
        dropped.push({ what: "material", service: key, why: "not_offered" });
      } else if (!saidByCaller(heard, transcript)) {
        dropped.push({ what: "material", service: key, why: "no_evidence" });
      } else {
        material = { key: hit.key, label: hit.label };
        evidence.material = heard;
      }
    }

    groups.push({
      categoryId: category.id,
      categoryKey: category.key,
      // From the DATABASE, not the model. This is the one string on the draft
      // that ends up on a document a homeowner reads, so a model never writes
      // it — same reason lib/site/generateSite.js merges service names back in
      // rather than letting them be generated.
      label: category.label,
      intakeValues,
      // What we were NOT told. Listed rather than omitted, because "we don't
      // know how many doors" is a fact the estimator has to act on, and a form
      // that simply looks empty reads as a form nobody filled in.
      missing: fields.filter((f) => !(f.key in intakeValues)).map((f) => f.key),
      // Field keys are for the builder; humans get the label. Carried on the
      // draft so the receptionist screen doesn't have to load the whole
      // category catalogue to print "Cabinet Doors" instead of "doorCount".
      fieldLabels: Object.fromEntries(fields.map((f) => [f.key, f.label])),
      // Null when they never named one, and null is load-bearing: the estimate
      // bridge refuses to price a materials trade without it rather than
      // choosing on the homeowner's behalf.
      material,
      // What this company offers for this trade, carried so the review screen
      // can ask the contractor which it was without a second round trip.
      materialOptions: offered,
      evidence: { scope: said, ...evidence },
    });
  }

  // Plain words, back office only. Capped and de-duplicated; this is model text
  // and it never leaves /app.
  const unmatched = [
    ...new Set(
      (Array.isArray(parsed?.unmatched) ? parsed.unmatched : [])
        .map((u) => String(u ?? "").trim().slice(0, 120))
        .filter(Boolean),
    ),
  ].slice(0, 6);

  // Where the work is. Free text by nature — a spoken address is not a closed
  // vocabulary — so the only guard available is the same one everything else
  // gets: the caller has to have said it.
  let address = null;
  if (parsed?.address) {
    const value = String(parsed.address.value ?? "").trim().slice(0, 300);
    const heard = String(parsed.address.said ?? "").trim();
    if (value && saidByCaller(heard, transcript)) {
      address = { value, said: heard };
    } else if (value) {
      dropped.push({ what: "address", why: "no_evidence" });
    }
  }

  return { groups, unmatched, dropped, address };
}

/* ─────────────────────────────── the whole job ────────────────────────────── */

/**
 * Draft the scope of one call, and turn it into a reviewable estimate where the
 * caller said enough to.
 *
 * Two outcomes, both honest:
 *
 *   a draft Quote     everything the trade's form needs was heard. It lands in
 *                     `draft` with needsReview = true through the SAME
 *                     createEstimateDraft the public instant quote uses, so it
 *                     appears in the existing review queue and nobody has
 *                     invented a second way for a price to reach a homeowner.
 *
 *   a filled form     something was missing. Nothing is priced, nothing is
 *                     created, and the contractor is told exactly which
 *                     questions the call left open — then opens the ordinary
 *                     quote builder with what WAS heard already in it.
 *
 * There is deliberately no third outcome where a number is produced from a
 * measurement nobody gave.
 *
 * @param companyId  the SIGNED-IN member's company. The call is looked up
 *                   inside it, never the other way round — a call id from
 *                   another tenant resolves to nothing rather than to their
 *                   transcript.
 * @param onUsage    metering hook. Wired to recordAiUsage by the route, which
 *                   also runs checkAiQuota first.
 * @returns {{ ok:false, reason:string } | { ok:true, draft:object }}
 */
export async function draftQuoteFromCall({ companyId, callId, onUsage }) {
  const call = await db.voiceCall.findFirst({
    where: { id: callId, companyId },
    select: {
      id: true,
      transcript: true,
      summary: true,
      fromE164: true,
      // A plain column, not a relation — VoiceCall points at the lead by id.
      leadId: true,
      // What a previous run produced, so pressing the button twice cannot
      // produce two priced drafts of the same call. See below.
      quoteDraft: true,
    },
  });
  if (!call) return { ok: false, reason: DRAFT_REASONS.NO_TRANSCRIPT, notFound: true };

  const turns = transcriptTurns(call.transcript);
  const said = callerText(turns);
  // Nothing the caller said, nothing to read. A wrong number that was answered
  // and hung up on is the normal case, not an error.
  if (!said.trim()) return { ok: false, reason: DRAFT_REASONS.NO_TRANSCRIPT };

  // Who the caller is, for the draft's client record. From the lead the
  // receptionist already created during the call, so the name and email it
  // collected are not asked for a second time.
  const lead = call.leadId
    ? await db.leadRequest
        .findFirst({
          where: { id: call.leadId, companyId },
          select: { name: true, email: true, phone: true, language: true },
        })
        .catch(() => null)
    : null;

  const [rows, materials, company] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: {
        category: { select: { id: true, key: true, label: true, customFields: true } },
      },
    }),
    instantMaterialsByCategory(companyId),
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, defaultLanguage: true },
    }),
  ]);

  const catalogue = buildCatalogue(
    rows.map((r) => r.category),
    { materials },
  );
  if (!catalogue.length) return { ok: false, reason: DRAFT_REASONS.NO_SERVICES };

  // Checked here as well as in the route, because "the key is missing" has to
  // produce a named reason rather than an empty draft that looks like the
  // model found nothing. complete() returns "" when unconfigured, and "" is
  // indistinguishable from a model with nothing to say.
  if (!isAiConfigured()) return { ok: false, reason: DRAFT_REASONS.AI_UNAVAILABLE };

  const raw = await complete({
    system: SYSTEM,
    prompt: buildDraftPrompt({ catalogue, turns, summary: call.summary }),
    // Reasoning models spend the visible budget on thinking; this is a small
    // JSON object but the reading behind it is the work.
    maxTokens: 4000,
    onUsage,
  });

  const parsed = parseDraftJson(raw);
  if (!parsed) return { ok: false, reason: DRAFT_REASONS.AI_EMPTY };

  const { groups, unmatched, dropped, address } = validateCallDraft(parsed, {
    catalogue,
    transcript: said,
  });

  if (!groups.length && !unmatched.length) {
    return { ok: false, reason: DRAFT_REASONS.NOTHING_QUOTABLE };
  }

  // The instant-quote form, per drafted trade. Filled here and reported whether
  // or not it is complete — "we heard cabinet refacing but nobody said how many
  // doors" is the most useful sentence on the review screen.
  const forms = groups.map((g) => ({
    categoryKey: g.categoryKey,
    ...formFromGroup(g, { address: address?.value || null }),
  }));

  // Price at most ONE. A call covering three trades is a site visit, not an
  // instant estimate, and three auto-drafted quotes for one caller is three
  // things somebody has to reconcile.
  const priceable = forms.find((f) => f.ok);
  let estimate = null;

  // ── Re-reading a call must not draft it twice ────────────────────────────
  //
  // The button can be pressed again — a call can be re-read after the model
  // improves, and the panel offers it. Creating a second draft Quote each time
  // would leave the review queue holding three versions of one caller's kitchen
  // for somebody to work out which is current. So an estimate already written
  // for this call is REUSED, as long as the quote is still there and still
  // waiting for review. A draft somebody has already approved or deleted is
  // gone, and the call may produce a fresh one.
  const previous = call.quoteDraft?.estimate?.quoteId
    ? await db.quote
        .findFirst({
          where: {
            id: call.quoteDraft.estimate.quoteId,
            companyId,
            needsReview: true,
          },
          select: { id: true, quoteNumber: true },
        })
        .catch(() => null)
    : null;

  if (previous) {
    estimate = {
      categoryKey: call.quoteDraft.estimate.categoryKey,
      trade: call.quoteDraft.estimate.trade,
      quoteId: previous.id,
      quoteNumber: previous.quoteNumber,
      reused: true,
    };
  } else if (priceable && company) {
    const group = groups.find((g) => g.categoryKey === priceable.categoryKey);
    const contact = {
      name: lead?.name || "Phone caller",
      email: lead?.email || null,
      phone: lead?.phone || call.fromE164 || null,
    };
    const result = await draftEstimateFromForm({
      company,
      form: priceable,
      contact,
      language: lead?.language || company.defaultLanguage || "en",
    }).catch((err) => {
      console.error("[callQuoteDraft] estimate failed:", err?.message);
      return { ok: false, reason: ESTIMATE_BLOCKED.NOT_PRICEABLE };
    });

    estimate = result.ok
      ? {
          categoryKey: group.categoryKey,
          trade: priceable.trade,
          quoteId: result.quote.id,
          quoteNumber: result.quote.quoteNumber,
        }
      : { categoryKey: priceable.categoryKey, blocked: result.reason };
  }

  // The client, only if one already exists on this company with this number.
  // Never created here: creating a client record from a phone call nobody has
  // decided to work with is a row somebody has to clean up, and the builder's
  // own client picker already handles adding one. (The estimate path DOES
  // create one, because a Quote cannot exist without a client — but that only
  // happens once a real draft is being written.)
  const clientId = await matchClientByPhone(companyId, call.fromE164);

  return {
    ok: true,
    draft: {
      generatedAt: new Date().toISOString(),
      model: AI_MODEL,
      groups,
      unmatched,
      dropped,
      ...(address ? { address } : {}),
      // Per trade: either "this is what the instant quote still needs" or
      // nothing, because it got priced.
      blocked: forms
        .filter((f) => !f.ok)
        .map((f) => ({
          categoryKey: f.categoryKey,
          reason: f.reason,
          ...(f.missing ? { missing: f.missing } : {}),
        })),
      ...(estimate ? { estimate } : {}),
      ...(clientId ? { clientId } : {}),
    },
  };
}

async function matchClientByPhone(companyId, phone) {
  const p = String(phone || "").trim();
  if (!p) return null;
  const hit = await db.client
    .findFirst({ where: { companyId, phone: p }, select: { id: true } })
    .catch(() => null);
  return hit?.id || null;
}
