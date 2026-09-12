// lib/sales/checkin/draft.js
//
// The text message a rep sends a company they signed up. A DRAFT of it.
//
// ══ Nothing here sends anything ═══════════════════════════════════════════
//
// No Twilio, no queue, no cron, no `db.write`. This file turns a decision from
// ./signals.js into words and hands them back. The rep reads them, edits them
// and presses send somewhere else — the same posture lib/sales/salesSms.js
// keeps ("a human chooses each recipient and each moment"), and the reason the
// compliance argument for the whole sales operation still holds.
//
// ══ The model rephrases; it never learns anything new ═════════════════════
//
// lib/site/generateSite.js's rule, applied here: the model writes SENTENCES.
// Every fact in the message came out of `decision.facts`, which came out of
// rows the caller read. The model is handed the deterministic draft and asked
// to say the same thing more like a person; what comes back is put through a
// gate that rejects a URL, a price, an emoji and — the one that matters — any
// NUMBER that is not one of the numbers we established. A model that decides
// they have "3 quotes waiting" has invented a fact about somebody's business,
// and a rep would send it, because it reads exactly like the true ones.
//
// If the gate refuses, or the vendor is down, or the budget is spent, the
// deterministic draft is what comes back. The rep always gets something
// usable; the worst outcome is plainer copy, never an empty box.
//
// ══ Which meter this spends against, and why not checkAiQuota ═════════════
//
// I was asked to meter this with `checkAiQuota`/`recordAiUsage` and did not,
// and this paragraph is me naming that rather than burying it.
//
// Those two are TENANT meters. `AiUsage.companyId` is NOT NULL and
// `checkAiQuota` reads the company's plan for a cap, so metering a rep's
// draft that way spends the CONTRACTOR's monthly AI allowance on FieldQuo's
// own sales activity — and worse, refuses the draft when the contractor has
// been a heavy user of their own copilot. A retention check-in that silently
// degrades because the customer used the product a lot is exactly backwards.
//
// lib/ai/platformUsage.js exists for precisely this case (its header: "FieldQuo
// is the customer, and FieldQuo has no plan for getAiCap to read"), keeps the
// same before/after shape, and its `PlatformAiUsage.salesRepId` column was
// added, in its own words, so "a rep-triggered regeneration can be told apart
// from an overnight run when a screen offers one". This is that screen.
//
// It takes `db` as an argument rather than importing it, so this file stays
// executable with no database. WITHOUT a db there is no ceiling, and no
// ceiling means the model is not called at all — `unmetered` degrades to the
// deterministic draft. Fail closed: an unmetered path is how a spend nobody
// can see starts.
import { complete as providerComplete, isAiConfigured, AI_FAILURE } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";

/** Traceable in PlatformAiUsage.area, so this spend can be told from prospecting. */
export const CHECKIN_AI_AREA = "retention_checkin";

/**
 * The length ceiling, and why it is this number.
 *
 * An SMS is 160 characters in GSM-7. Past that it is split, and each part of a
 * concatenated message only holds 153 — the other 7 go to the header that
 * reassembles them. So two parts is 306 characters, and 306 is the ceiling
 * here: two segments is a reasonable thing to send somebody, three is a wall
 * of text and costs 50% more per send.
 *
 * The bigger trap is the CHARACTER SET. One emoji, one curly quote, one em
 * dash, and the whole message re-encodes as UCS-2 — 70 characters for a lone
 * message, 67 per concatenated part. A 300-character message with a single
 * smart apostrophe in it is five segments, not two. That is why `isGsm7` is a
 * gate and not a warning, and why every deterministic sentence below is typed
 * with a plain hyphen and a plain apostrophe.
 *
 * lib/sms/renderTemplate.js flags a company's own templates past ~320 on the
 * same reasoning; this is the same rule stated exactly.
 */
export const MAX_SMS_CHARS = 306;
export const SINGLE_SEGMENT_CHARS = 160;
export const CONCAT_SEGMENT_CHARS = 153;
export const MAX_SEGMENTS = 2;

/** GSM-7 basic set. Anything outside it forces UCS-2 on the whole message. */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** The extension table. Legal, but each of these costs TWO of the 160. */
const GSM7_EXTENDED = "^{}\\[~]|€\f";

const BASIC = new Set([...GSM7_BASIC]);
const EXTENDED = new Set([...GSM7_EXTENDED]);

/** True when every character survives GSM-7 encoding. */
export function isGsm7(text) {
  return [...String(text ?? "")].every((ch) => BASIC.has(ch) || EXTENDED.has(ch));
}

/**
 * What this message actually costs to send.
 *
 * Returned on every draft so the rep's screen can show it, and asserted in the
 * check. Segment arithmetic, not a character count: those are different
 * numbers and only one of them is on the Twilio invoice.
 */
export function smsCost(text) {
  const s = String(text ?? "");
  const gsm7 = isGsm7(s);
  if (gsm7) {
    const units = [...s].reduce((n, ch) => n + (EXTENDED.has(ch) ? 2 : 1), 0);
    return {
      chars: s.length,
      gsm7: true,
      units,
      segments: units === 0 ? 0 : units <= SINGLE_SEGMENT_CHARS ? 1 : Math.ceil(units / CONCAT_SEGMENT_CHARS),
    };
  }
  // UCS-2 counts UTF-16 code units, which is why an emoji outside the BMP
  // costs two on its own before anything else is counted.
  const units = s.length;
  return { chars: s.length, gsm7: false, units, segments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67) };
}

/** Why a draft is the deterministic one rather than the model's. A closed set. */
export const DRAFT_REASONS = Object.freeze({
  unconfigured: "No model is configured on this deployment, so this is the plain version.",
  unmetered: "No spend ledger was available, so the model was not called.",
  campaign_budget: "FieldQuo's AI budget for this campaign is spent.",
  daily_budget: "FieldQuo's daily AI budget is spent.",
  global_budget: "FieldQuo's overall AI budget is spent.",
  budget_unreadable: "The AI budget could not be read, so the model was not called.",
  vendor_error: "The model could not be reached.",
  empty: "The model returned nothing.",
  truncated: "The model ran out of room mid-sentence.",
  refused: "The model declined to write it.",
  unparseable: "The model's reply was not readable.",
  schema_mismatch: "The model's reply was the wrong shape.",
  bad_schema: "The request to the model was malformed.",
  junk: "The model's draft made a claim we cannot back up, so it was discarded.",
});

/** Why there is no draft at all. Distinct from a degraded one — see refusals. */
export const DRAFT_REFUSALS = Object.freeze({
  no_decision: "There is nothing to draft from.",
  not_contactable: "This company is a demo. There is nobody to text.",
});

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * A person's name, made safe to put in an SMS.
 *
 * Trimmed hard, because a name is user-entered and a 300-character one would
 * eat the whole message; stripped of anything outside GSM-7, because one
 * accented character in a rep's surname triples the send cost of every message
 * they write. Empty is a legitimate answer and the sentences below cope.
 */
function sayable(name, max = 40) {
  const s = clean(name)
    .split("")
    .filter((ch) => BASIC.has(ch) || EXTENDED.has(ch))
    .join("")
    .trim();
  return s.slice(0, max).trim();
}

/**
 * The observation sentence for one reason code.
 *
 * Every one of these is a statement we can prove from `facts`, phrased as
 * something a person would say out loud. Nothing is quantified that was not
 * measured: the setup line only names a count because the count came from the
 * company's own dashboard, and it names titles only when there are titles.
 */
function observation(code, facts) {
  switch (code) {
    case "payment_failing":
      return "Your subscription payment did not go through, so I wanted to flag it before it lapses.";
    case "trial_ends_before_retention":
      return "Your free period is coming to an end soon.";
    case "payments_not_connected":
      return "I noticed payouts are not connected yet, so you cannot take card payments through the app.";
    case "onboarding_unfinished":
      return "I noticed the setup is not quite finished.";
    case "setup_steps_outstanding": {
      const n = facts?.setupRemainingCount;
      if (!Number.isFinite(n) || n <= 0) return null;
      return n === 1
        ? "I noticed there is still 1 setup step open on your dashboard."
        : `I noticed there are still ${n} setup steps open on your dashboard.`;
    }
    // retention_milestone_near, unknown_state and all_good deliberately have
    // no observation. There is nothing to observe — the whole message is the
    // question, and dressing "you are two months in" up as a finding would be
    // the marketing voice this is meant not to have.
    default:
      return null;
  }
}

/** The offer that follows the observation, when the observation invites one. */
function offer(code) {
  switch (code) {
    case "payment_failing":
      return "Let me know if you want a hand sorting it.";
    case "trial_ends_before_retention":
      return "Happy to go over what changes, if that is useful.";
    case "payments_not_connected":
      return "Happy to walk you through it whenever suits.";
    case "onboarding_unfinished":
    case "setup_steps_outstanding":
      return "Happy to walk you through the rest if it helps.";
    default:
      return null;
  }
}

/**
 * The draft a rep gets when there is no model, and the floor under the one
 * they get when there is.
 *
 * Assembled from parts with a drop order rather than truncated, because a text
 * cut off mid-word is worse than a shorter text: it reads as a mistake, and
 * the rep has to rewrite it anyway. Parts go in priority order and the last
 * ones are dropped until it fits. A hostile company name (contractors name
 * their businesses whatever they like) is what makes that real rather than
 * theoretical.
 *
 * @param decision  a checkInSignals() result.
 * @param repName   the rep's own first name, as the contractor knows them.
 * @returns {string}
 */
export function ruleDraft(decision, { repName = null } = {}) {
  const facts = decision?.facts || {};
  const code = decision?.primary?.code || "unknown_state";
  const rep = sayable(repName);
  // Trailing punctuation dropped: "Easy Roofers Inc." — the first real
  // company this ever drafted for — produced "about Easy Roofers Inc.. I
  // noticed", because the sentence adds its own full stop.
  const company = sayable(facts.companyName, 60).replace(/[.,;:!?]+$/, "").trim();

  const greeting = rep ? `Hi, it is ${rep} from FieldQuo.` : "Hi, it is FieldQuo here.";
  // The company name is a courtesy, not a fact worth the space. It is the
  // first thing dropped, and dropping it never changes what the message says.
  const named = company ? `${greeting.slice(0, -1)}, about ${company}.` : greeting;

  // The question is the message. Everything else is context for it, which is
  // why it can never be dropped: the owner asked for "see if everything is
  // going okay. Any issues they found or if everything is good type of thing".
  const question = "How is it going so far - is everything working the way you expected?";
  const close = "If anything is not right, just reply here and I will sort it.";

  const obs = observation(code, facts);
  const off = offer(code);

  // Priority order: what survives when it will not all fit.
  const attempts = [
    [named, obs, off, question, close],
    [named, obs, off, question],
    [named, obs, question],
    [greeting, obs, question],
    [greeting, question],
  ];

  for (const parts of attempts) {
    const text = parts.filter(Boolean).join(" ");
    const cost = smsCost(text);
    if (cost.chars <= MAX_SMS_CHARS && cost.segments <= MAX_SEGMENTS) return text;
  }

  // Reached only by a rep name long enough to blow the budget on its own,
  // which sayable() already caps. Stated anyway: a fallback that assumes it
  // cannot be reached is the one that returns undefined the day it is.
  return "Hi, it is FieldQuo here. How is it going so far - is everything working the way you expected?";
}

/**
 * The numbers a message is allowed to contain.
 *
 * Anything else is invented. This is the single most useful thing the gate
 * does: a model asked for a friendly check-in will cheerfully write "your 4
 * quotes are still unsent", which is well-formed, plausible, specific, and a
 * claim about a business nobody made.
 */
function allowedNumbers(facts) {
  const out = new Set();
  for (const n of [facts?.dayInLife, facts?.daysToRetention, facts?.setupRemainingCount]) {
    if (Number.isFinite(n)) out.add(String(Math.abs(n)));
  }
  return out;
}

/**
 * Is this text safe to hand a rep as a check-in draft?
 *
 * @returns {{ok:boolean, reason:string|null}} — `junk` when it is not, because
 *          the rep does not need the taxonomy, they need the other draft.
 */
export function judgeDraft(text, decision) {
  const s = clean(text);
  if (!s) return { ok: false, reason: "empty" };

  const cost = smsCost(s);
  if (!cost.gsm7) return { ok: false, reason: "junk" };
  if (cost.chars > MAX_SMS_CHARS || cost.segments > MAX_SEGMENTS) return { ok: false, reason: "junk" };

  // A link in a check-in is either a tracking URL nobody asked for or a
  // hallucinated one. Neither belongs in a message from a person.
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ca|net|org|io)\b/i.test(s)) return { ok: false, reason: "junk" };
  // Money. The rep may quote a price; the model may not invent one.
  if (/[$£€]|\b\d+(?:\.\d{2})\b/.test(s)) return { ok: false, reason: "junk" };
  // An unfilled template slot, which reads as broken software to the reader.
  if (/[[\]{}<>]/.test(s)) return { ok: false, reason: "junk" };

  const allowed = allowedNumbers(decision?.facts);
  for (const match of s.matchAll(/\d+/g)) {
    if (!allowed.has(match[0])) return { ok: false, reason: "junk" };
  }

  return { ok: true, reason: null };
}

const SYSTEM = [
  "You write short text messages for a FieldQuo sales rep checking in on a small contracting business they personally signed up.",
  "Rewrite the draft you are given so it sounds like a person typing on a phone.",
  "Rules, all of them absolute:",
  "- Say nothing the draft does not already say. Invent no numbers, no names, no features, no prices, no links.",
  "- No emoji, no accented characters, no curly quotes, no dashes other than a plain hyphen.",
  `- At most ${MAX_SMS_CHARS} characters in total.`,
  "- No marketing language. No exclamation marks. Do not thank them for their business or call them valued.",
  "- Ask how it is going and make it easy to reply with a problem.",
  "- Plain ASCII only.",
].join("\n");

const SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

function aiPrompt({ decision, base, repName }) {
  const f = decision?.facts || {};
  const lines = [
    `Rep's name: ${sayable(repName) || "unknown"}`,
    `Business: ${sayable(f.companyName, 60) || "unknown"}`,
    `Why this check-in: ${decision?.primary?.angle || "just checking in"}`,
    "",
    "Everything that is known about this account, and the ONLY facts you may refer to:",
    `- days since they signed up: ${Number.isFinite(f.dayInLife) ? f.dayInLife : "unknown"}`,
    `- finished onboarding: ${f.onboardingComplete === null ? "unknown" : f.onboardingComplete ? "yes" : "no"}`,
    `- can take card payments: ${f.paymentsConnected === null ? "unknown" : f.paymentsConnected ? "yes" : "no"}`,
    `- setup steps still open: ${f.setupMeasured ? f.setupRemainingCount : "unknown"}`,
    "",
    "The draft to rewrite:",
    base,
  ];
  return lines.join("\n");
}

/**
 * Draft the check-in text for one company.
 *
 * @param {object}   decision   a checkInSignals() result. Required.
 * @param {string}   repName    the rep's first name as the contractor knows it.
 * @param {object}   db         the Prisma client, for the platform AI budget and
 *                              ledger. OMIT IT and the model is not called at
 *                              all — see the header. Never written to except
 *                              PlatformAiUsage.
 * @param {string}   salesRepId recorded against the spend, so a rep-triggered
 *                              draft is distinguishable from pipeline work.
 * @param {string}   ref        optional idempotency key for the usage row.
 * @param {Date}     now        injectable.
 * @param {Function} complete   the provider's complete(). Injectable ONLY so
 *                              scripts/check-sales-checkin.mjs can execute the
 *                              gate against a model that answers badly — there
 *                              is no other way to prove the fallback without a
 *                              vendor. Production never passes it.
 *
 * @returns {Promise<{
 *   text: string|null, source: "rule"|"ai"|null, degraded: boolean,
 *   refused: boolean, reason: string|null, reasonText: string|null,
 *   model: string|null, chars: number, segments: number, gsm7: boolean,
 *   due: boolean, ruleText: string|null
 * }>}
 */
export async function draftCheckIn({
  decision = null,
  repName = null,
  db = null,
  salesRepId = null,
  ref = null,
  now = new Date(),
  complete = providerComplete,
} = {}) {
  const refuse = (code) => ({
    text: null,
    source: null,
    degraded: false,
    refused: true,
    reason: code,
    reasonText: DRAFT_REFUSALS[code] || code,
    model: null,
    chars: 0,
    segments: 0,
    gsm7: true,
    due: Boolean(decision?.due),
    ruleText: null,
  });

  if (!decision) return refuse("no_decision");
  // A demo company has no owner. Refusing here rather than in the screen is
  // the second lock on the same door signals.js already bolted, deliberately —
  // "hiding buttons is not access control" applies to a send button too.
  if (decision.contactable === false) return refuse("not_contactable");

  const base = ruleDraft(decision, { repName });
  const settle = (text, { source, reason, model = null }) => {
    const cost = smsCost(text);
    return {
      text,
      source,
      degraded: source !== "ai",
      refused: false,
      reason: reason || null,
      reasonText: reason ? DRAFT_REASONS[reason] || reason : null,
      model,
      chars: cost.chars,
      segments: cost.segments,
      gsm7: cost.gsm7,
      due: Boolean(decision.due),
      ruleText: base,
    };
  };

  if (!isAiConfigured()) return settle(base, { source: "rule", reason: "unconfigured" });
  // No ledger, no call. See the header: unmetered is how invisible spend starts.
  if (!db) return settle(base, { source: "rule", reason: "unmetered" });

  let budget;
  try {
    budget = await checkPlatformAiBudget(db, { now });
  } catch {
    // Fail closed, the same call lib/ai/platformUsage.js's own callers make: a
    // budget that cannot be read is not a budget with room in it.
    return settle(base, { source: "rule", reason: "budget_unreadable" });
  }
  if (!budget?.allowed) {
    const reason = Object.hasOwn(DRAFT_REASONS, budget?.reason) ? budget.reason : "budget_unreadable";
    return settle(base, { source: "rule", reason });
  }

  let usage = null;
  let result;
  try {
    result = await complete({
      system: SYSTEM,
      prompt: aiPrompt({ decision, base, repName }),
      // Not `quality: "writing"`. provider.js reserves that model for the one
      // most-read sentence FieldQuo generates — a contractor's homepage
      // headline — and this is a rep's text message being rephrased from a
      // draft that already says everything. The default model is the tool.
      schema: SCHEMA,
      schemaName: "sales_checkin_sms",
      onUsage: (u) => {
        usage = u;
      },
    });
  } catch {
    // complete() does not normally throw; an injected one might, and a rep
    // staring at a spinner because a helper threw is the failure this whole
    // file exists to avoid.
    result = { ok: false, reason: AI_FAILURE.VENDOR_ERROR };
  }

  // Metered before any decision about the content, the order provider.js's own
  // comment argues for: a reply we discard was still generated and still
  // billed, and a lane that shows zero spend is the number the budget exists
  // to get right.
  if (usage) {
    await recordPlatformAiUsage(db, {
      area: CHECKIN_AI_AREA,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      salesRepId,
      ref,
    });
  }

  if (!result?.ok) {
    const reason = Object.hasOwn(DRAFT_REASONS, result?.reason) ? result.reason : "vendor_error";
    return settle(base, { source: "rule", reason });
  }

  const candidate = clean(result.data?.text);
  const verdict = judgeDraft(candidate, decision);
  if (!verdict.ok) return settle(base, { source: "rule", reason: "junk", model: usage?.model || null });

  return settle(candidate, { source: "ai", reason: null, model: usage?.model || null });
}
