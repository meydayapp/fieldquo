// lib/sales/replyTriage.js
//
// A prospect texted back. What kind of answer is it?
//
// ══ What this decides, and what it must never do ══════════════════════════
//
// One column on the inbound SalesSmsMessage row — `triage` — and a sentence
// beside it. The rules in lib/sales/messages/triage.js go first (STOP, an
// empty body, a bare "ok"), and the model is asked only about a reply that
// is an actual sentence. The whole point is the owner's fear of losing a
// contractor who hit a wall: "the link says my email is taken" must not sit
// in a list looking like "thanks".
//
// It never throws. A vendor blip, a schema mismatch, a table that could not
// be read — every failure leaves `triage` null, files one row in the
// platform error log, and returns. The text itself was stored before this
// ran (handleSalesInboundSms writes the row first, and the suppression for a
// STOP is written there too), so nothing a prospect said is lost when the
// classifier is. Null is honest: "not classified" is a different claim from
// "fine", and the list shows no chip rather than a green one.
//
// ══ STOP is not the model's to decide ═════════════════════════════════════
//
// preTriage() reads the opt-out keywords through the SAME function the
// suppression path calls (lib/sms/optOutKeywords.js). A STOP is filed as
// "stop" before any model is reached, and the model is never asked to
// second-guess it. The suppression row is salesSms.js's and was written
// before this ran; nothing here reads or writes SalesSuppression.
//
// ══ Which meter, and what it costs ════════════════════════════════════════
//
// The platform's own ledger — lib/ai/platformUsage.js — for the reason
// lib/sales/checkin/draft.js gives at length: `checkAiQuota` and
// `recordAiUsage` are TENANT meters, keyed on a company and capped by its
// plan, and a prospect who has not signed up has no company to bill. Same
// shape, before and after: checkPlatformAiBudget() refuses when FieldQuo's
// own ceiling is spent, recordPlatformAiUsage() writes what the vendor said
// it cost, area "sms_reply_triage".
//
// Cost, on the default model (gpt-5-mini, lib/ai/usage.js's table: $0.13/M
// in, $1.00/M out): the prompt is ~350 tokens and the reply — reasoning at
// the lowest effort plus a two-field JSON object — ~150–300, so a reply
// costs about $0.0002–0.0004, a fortieth of a cent. The rules above mean
// most replies cost nothing at all.
//
// ══ Where it runs ═════════════════════════════════════════════════════════
//
// After the Twilio webhook has answered. app/api/sms/inbound/route.js hands
// handleSalesInboundSms next/server's after(), which runs
// triageStoredReply() once the empty TwiML has gone out — Twilio retries a
// webhook that takes too long, and a retried webhook is a duplicate text in
// the thread. The row id is all that crosses; everything else is re-read.
import { db } from "@/lib/db";
import { complete as providerComplete, isAiConfigured, AI_FAILURE } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { recordError } from "@/lib/platform/errorLog";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { requiredLanguageFor, inboundNeedsFrench } from "./leadLanguage";
import {
  TRIAGE_KINDS,
  TRIAGE_STOP,
  isTriageKind,
  preTriage,
} from "./messages/triage";

/** Traceable in PlatformAiUsage.area, so this spend can be told from the rest. */
export const TRIAGE_AI_AREA = "sms_reply_triage";

/** Why a reply was left unclassified. Codes, not prose — the screen has none to show. */
export const TRIAGE_SKIPPED = Object.freeze({
  empty: "empty",
  unconfigured: "unconfigured",
  unmetered: "unmetered",
  budget: "budget",
  vendor_error: "vendor_error",
  refused: "refused",
  bad_answer: "bad_answer",
  overridden: "overridden",
  not_inbound: "not_inbound",
  missing: "missing",
});

const SYSTEM = [
  "You sort text-message replies for a software sales rep at FieldQuo. FieldQuo sells a quoting, invoicing and scheduling app to small contracting businesses (painters, roofers, plumbers).",
  "The rep texted a prospect, usually a signup link. The prospect answered. Say what KIND of answer it is, from this list and no other:",
  "- roadblock: they tried and something stopped them - the link failed, the form rejected them, a price or a term is in the way, they need something before they can go on. Anything a rep must fix or unblock.",
  "- question: they are asking the rep something and waiting for the answer.",
  "- positive: interest, agreement, a yes, a request to be called, a time they are free.",
  "- not_interested: a no, a decline, already using something else, do not want it - WITHOUT asking to stop being contacted.",
  "- fine: an acknowledgement or small talk that needs nothing from the rep.",
  "Never answer stop; opt-outs are handled before you and are not on your list.",
  "The reply may be in English, French or Spanish. Read it as written; do not translate it.",
  "reason: one short sentence, at most 120 characters, saying what they need or said. No greeting, no advice, no quotation marks. Write it in the language whose code you are given.",
].join("\n");

const SCHEMA = {
  type: "object",
  properties: {
    triage: { type: "string", enum: TRIAGE_KINDS.filter((k) => k !== TRIAGE_STOP) },
    reason: { type: "string" },
  },
  required: ["triage", "reason"],
  additionalProperties: false,
};

/** A short, single-line version of somebody's text, safe to put in a prompt. */
function sayable(text, max = 600) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function prompt({ body, language, context }) {
  const lines = [
    `Write the reason in this language: ${language}`,
    context?.businessName ? `The prospect's business: ${sayable(context.businessName, 80)}` : null,
    context?.lastOutbound ? `What the rep last texted them:\n${sayable(context.lastOutbound)}` : "What the rep last texted them: unknown",
    "",
    "The prospect's reply:",
    sayable(body, 1200),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/**
 * Classify one reply. Never throws.
 *
 * @param {string}   body       the prospect's text.
 * @param {string}   language   the code the REASON is written in — the rep's
 *                              portal language, since the rep reads it. Any
 *                              unsupported value falls back to English.
 * @param {object}   context    `{ lastOutbound, businessName }` — what the
 *                              rep asked, so "yes" after "can I call you
 *                              Thursday" and "yes" after "did the link work"
 *                              are read for what they are.
 * @param {object}   client     the Prisma client, for the platform AI budget
 *                              and ledger. OMIT IT and the model is not
 *                              called: an unmetered path is how invisible
 *                              spend starts (lib/sales/checkin/draft.js).
 * @param {Function} complete   the provider's complete(). Injectable ONLY so
 *                              scripts/check-sales-reply-triage.mjs can
 *                              execute this against a scripted vendor.
 *
 * @returns {Promise<{ triage: string|null, reason: string|null,
 *   source: "rule"|"ai"|null, model: string|null, skipped: string|null }>}
 */
export async function triageReply({
  body,
  language = "en",
  context = null,
  client = null,
  salesRepId = null,
  ref = null,
  now = new Date(),
  complete = providerComplete,
} = {}) {
  const settle = (triage, { reason = null, source = null, model = null, skipped = null } = {}) => ({
    triage: isTriageKind(triage) ? triage : null,
    reason,
    source,
    model,
    skipped,
  });

  try {
    const rule = preTriage(body);
    if (rule) {
      return rule.triage
        ? settle(rule.triage, { source: "rule" })
        : settle(null, { source: "rule", skipped: TRIAGE_SKIPPED.empty });
    }

    if (!isAiConfigured()) return settle(null, { skipped: TRIAGE_SKIPPED.unconfigured });
    if (!client) return settle(null, { skipped: TRIAGE_SKIPPED.unmetered });

    let budget;
    try {
      budget = await checkPlatformAiBudget(client, { now });
    } catch {
      return settle(null, { skipped: TRIAGE_SKIPPED.budget });
    }
    if (!budget?.allowed) return settle(null, { skipped: TRIAGE_SKIPPED.budget });

    const lang = LANGUAGE_CODES.includes(language) ? language : "en";
    let usage = null;
    let result;
    try {
      result = await complete({
        system: SYSTEM,
        prompt: prompt({ body, language: lang, context }),
        schema: SCHEMA,
        schemaName: "sales_reply_triage",
        // The cheapest setting the provider offers. Six labels and one
        // sentence do not need thinking, and the tokens spent thinking are
        // the whole cost of this call.
        reasoningEffort: "low",
        onUsage: (u) => {
          usage = u;
        },
      });
    } catch (err) {
      // complete() does not normally throw; an injected one might.
      result = { ok: false, reason: AI_FAILURE.VENDOR_ERROR, message: err?.message };
    }

    // Metered before any decision about the content — a reply we discard was
    // still generated and still billed (provider.js's own argument).
    if (usage) {
      await recordPlatformAiUsage(client, {
        area: TRIAGE_AI_AREA,
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        salesRepId,
        ref,
      });
    }

    if (!result?.ok) {
      const skipped = result?.reason === AI_FAILURE.REFUSED ? TRIAGE_SKIPPED.refused : TRIAGE_SKIPPED.vendor_error;
      return settle(null, { model: usage?.model || null, skipped, reason: result?.message || null });
    }

    const kind = result.data?.triage;
    // The schema forbids it, but a provider that did not honour strict mode
    // is exactly the case this guard is for: a model saying "stop" would
    // put a label on a row the suppression path never saw.
    if (!isTriageKind(kind) || kind === TRIAGE_STOP) {
      return settle(null, { model: usage?.model || null, skipped: TRIAGE_SKIPPED.bad_answer });
    }
    const reason = sayable(result.data?.reason, 160) || null;
    return settle(kind, { reason, source: "ai", model: usage?.model || null });
  } catch (err) {
    // The one promise this module makes. Whatever happened, the caller gets
    // a null verdict and the reason, never an exception.
    return settle(null, { skipped: TRIAGE_SKIPPED.vendor_error, reason: err?.message || null });
  }
}

/**
 * The language the REASON is written in: the rep's own, because the rep is
 * who reads it. A rep who never chose one gets English, and a Quebec lead's
 * rep who never chose one still gets English — the reason is for the rep,
 * not the prospect, and inventing a preference is the thing
 * lib/sales/repLanguage.js argues against.
 */
export function reasonLanguageFor({ rep = null, lead = null, e164 = null } = {}) {
  if (rep && LANGUAGE_CODES.includes(rep.language)) return rep.language;
  // No stated rep language: fall back to the PROSPECT's, on the theory that
  // a rep who sells in Quebec and never set the portal's language reads
  // French — the same inference the call script makes.
  if (lead && requiredLanguageFor(lead) === "fr") return "fr";
  if (e164 && inboundNeedsFrench(e164)) return "fr";
  return "en";
}

/**
 * Classify a stored inbound row and write the verdict on it. Never throws.
 *
 * Reads the row fresh — direction, body, the rep it was filed to — and
 * refuses to touch anything that is not an inbound text or that a rep has
 * already overridden. Every failure is one error-log row and a null column.
 *
 * @returns `{ ok, messageId, triage, skipped }` for the check and the log.
 */
export async function triageStoredReply({ messageId, client = db, now = new Date(), complete = providerComplete } = {}) {
  const outcome = { ok: false, messageId: messageId || null, triage: null, skipped: null };
  if (!messageId) {
    outcome.skipped = TRIAGE_SKIPPED.missing;
    return outcome;
  }
  try {
    const row = await client.salesSmsMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        direction: true,
        body: true,
        fromE164: true,
        toE164: true,
        salesRepId: true,
        leadId: true,
        triageOverriddenById: true,
        salesRep: { select: { language: true } },
        lead: { select: { businessName: true, contactName: true, province: true } },
      },
    });
    if (!row) {
      outcome.skipped = TRIAGE_SKIPPED.missing;
      return outcome;
    }
    if (row.direction !== "in") {
      outcome.skipped = TRIAGE_SKIPPED.not_inbound;
      return outcome;
    }
    if (row.triageOverriddenById) {
      outcome.skipped = TRIAGE_SKIPPED.overridden;
      return outcome;
    }

    // What the rep last said to this number, so the model reads the reply as
    // an answer to it. Scoped to the same rep the reply was filed to.
    const lastOut = await client.salesSmsMessage
      .findFirst({
        where: { direction: "out", toE164: row.fromE164, ...(row.salesRepId ? { salesRepId: row.salesRepId } : {}) },
        orderBy: { sentAt: "desc" },
        select: { body: true },
      })
      .catch(() => null);

    const verdict = await triageReply({
      body: row.body,
      language: reasonLanguageFor({ rep: row.salesRep, lead: row.lead, e164: row.fromE164 }),
      context: {
        lastOutbound: lastOut?.body || null,
        businessName: row.lead?.businessName || row.lead?.contactName || null,
      },
      client,
      salesRepId: row.salesRepId,
      // One ledger row per message, however many times a webhook is retried.
      ref: `sms_reply_triage:${row.id}`,
      now,
      complete,
    });

    outcome.triage = verdict.triage;
    outcome.skipped = verdict.skipped;

    if (verdict.skipped && verdict.skipped !== TRIAGE_SKIPPED.empty) {
      // Left null, and said so where support looks. Not for "unconfigured":
      // a deployment with no key would file one of these per reply, and an
      // error log full of the same known fact stops being read.
      if (verdict.skipped !== TRIAGE_SKIPPED.unconfigured) {
        await recordError({
          area: "sales_sms",
          code: `triage_${verdict.skipped}`,
          message: `A reply to FieldQuo's sales number was not triaged (${verdict.skipped})${verdict.reason ? `: ${verdict.reason}` : ""}`,
          detail: { messageId: row.id, salesRepId: row.salesRepId, from: row.fromE164 },
        }).catch(() => {});
      }
      return outcome;
    }

    // Written with the override guard in the WHERE, not only checked above:
    // a rep who changed the chip while the model was thinking wins.
    const { count } = await client.salesSmsMessage.updateMany({
      where: { id: row.id, triageOverriddenById: null },
      data: {
        triage: verdict.triage,
        triageReason: verdict.reason,
        triagedAt: now,
        triageModel: verdict.model,
      },
    });
    outcome.ok = count > 0;
    if (!outcome.ok) outcome.skipped = TRIAGE_SKIPPED.overridden;
    return outcome;
  } catch (err) {
    await recordError({
      area: "sales_sms",
      code: "triage_failed",
      message: `Triage of an inbound sales text threw: ${err?.message || err}`,
      detail: { messageId },
    }).catch(() => {});
    outcome.skipped = TRIAGE_SKIPPED.vendor_error;
    return outcome;
  }
}

/**
 * A rep changes the chip by hand.
 *
 * Writes the LATEST inbound row of the rep's own thread with that number —
 * the row the chip is drawn from — with the rep's id in the WHERE, the same
 * updateMany discipline setLeadTimeZone() uses: two steps leave a window
 * where a scoping bug lives. `null` clears the chip and the override
 * together; a rep cannot clear another rep's.
 *
 * @returns `{ ok, messageId }` — ok:false when the thread has no inbound row
 *          of this rep's, or the kind is not one of ours.
 */
export async function overrideTriage({ salesRepId, e164, triage, client = db, now = new Date() } = {}) {
  if (!salesRepId || !e164) return { ok: false, messageId: null };
  if (triage !== null && !isTriageKind(triage)) return { ok: false, messageId: null };
  const latest = await client.salesSmsMessage.findFirst({
    where: { salesRepId, direction: "in", fromE164: e164 },
    orderBy: { sentAt: "desc" },
    select: { id: true },
  });
  if (!latest) return { ok: false, messageId: null };
  const { count } = await client.salesSmsMessage.updateMany({
    where: { id: latest.id, salesRepId },
    data:
      triage === null
        ? { triage: null, triageOverriddenById: null, triagedAt: null, triageModel: null }
        : { triage, triageOverriddenById: salesRepId, triagedAt: now, triageModel: null },
  });
  return { ok: count > 0, messageId: latest.id };
}
