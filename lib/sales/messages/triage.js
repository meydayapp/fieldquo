// lib/sales/messages/triage.js
//
// What kind of answer a prospect's text is — the vocabulary, the rules that
// need no model, and the arithmetic over a thread. PURE: no database, no
// vendor, importable by the screen and by the check that executes it.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner: "just in case we lose them on a roadblock". A rep texts forty
// signup links a week; the replies land in one list, newest first, and
// "the site won't take my postal code" reads exactly like "thanks, got it"
// until somebody opens it. The reply that needed a human today is the one
// that scrolls off the screen by Thursday. So every inbound text gets a
// KIND, the list draws a chip for it, and a roadblock or a question nobody
// has answered is listed on its own until a rep writes back.
//
// ══ The rules first, the model only when needed ═══════════════════════════
//
// preTriage() decides what a keyword decides. STOP is the opt-out vocabulary
// lib/sms/optOutKeywords.js already listens for, and it is decided HERE by
// the same function the suppression path uses — never by a model, because
// "the model thought it was a joke" is not a defence under CASL. An empty
// body has nothing to read. "ok", "yes", "thanks" and their French and
// Spanish twins are acknowledgements, and spending a model call to learn
// that "👍" is fine is money for nothing. Everything else is a sentence
// somebody typed, and a sentence is the model's job.
//
// ══ What the chip does NOT do ═════════════════════════════════════════════
//
// A "stop" chip is a LABEL. The do-not-contact row lib/sales/salesSms.js
// writes on the same keyword is the enforcement, written before and
// independently of anything here, and no verdict in this column lifts or
// lowers it. openTriage() lists roadblocks and questions; it does not answer
// them, schedule anything or send anything.
import { classifyInboundSms } from "@/lib/sms/optOutKeywords";

/** The closed vocabulary. The column, the model's schema and the chips all read from here. */
export const TRIAGE_ROADBLOCK = "roadblock";
export const TRIAGE_QUESTION = "question";
export const TRIAGE_POSITIVE = "positive";
export const TRIAGE_NOT_INTERESTED = "not_interested";
export const TRIAGE_STOP = "stop";
export const TRIAGE_FINE = "fine";

export const TRIAGE_KINDS = Object.freeze([
  TRIAGE_ROADBLOCK,
  TRIAGE_QUESTION,
  TRIAGE_POSITIVE,
  TRIAGE_NOT_INTERESTED,
  TRIAGE_STOP,
  TRIAGE_FINE,
]);

/**
 * The kinds that stay OPEN until a rep writes back — the ones the owner is
 * afraid of losing. In the order the task list shows them: a roadblock
 * outranks a question, because a roadblock is somebody who tried and could
 * not, and a question is somebody who has not tried yet.
 */
export const TRIAGE_OPEN = Object.freeze([TRIAGE_ROADBLOCK, TRIAGE_QUESTION]);

/** Guard for anything arriving from a request body or a model. */
export function isTriageKind(value) {
  return typeof value === "string" && TRIAGE_KINDS.includes(value);
}

/**
 * The i18n key each kind's chip is drawn from. `fine` has none on purpose —
 * a chip on every ordinary reply is a list full of chips, and the owner's
 * list needs the exceptions to stand out.
 */
export const TRIAGE_LABEL_KEY = Object.freeze({
  [TRIAGE_ROADBLOCK]: "app.salesText.triage.roadblock",
  [TRIAGE_QUESTION]: "app.salesText.triage.question",
  [TRIAGE_POSITIVE]: "app.salesText.triage.positive",
  [TRIAGE_NOT_INTERESTED]: "app.salesText.triage.notInterested",
  [TRIAGE_STOP]: "app.salesText.triage.stop",
  [TRIAGE_FINE]: "app.salesText.triage.fine",
});

/** Whether a kind draws a chip at all. */
export function triageShowsChip(kind) {
  return isTriageKind(kind) && kind !== TRIAGE_FINE;
}

// ── Acknowledgements ──────────────────────────────────────────────────────
//
// Lower-cased, punctuation and emoji stripped, whitespace collapsed. The
// list is what a contractor types with one thumb when there is nothing to
// say: English, French (Quebec is a third of the market) and Spanish. It is
// deliberately SHORT — a phrase that could carry a problem ("ok but", "yes
// however") is not on it, and the normaliser leaves those to the model
// because the extra word is the whole point.
const ACKNOWLEDGEMENTS = new Set([
  "yes", "y", "yep", "yeah", "yup", "ok", "okay", "k", "kk", "sure", "sounds good", "great", "perfect",
  "thanks", "thank you", "thx", "ty", "got it", "will do", "noted", "cool", "nice", "received", "done", "good",
  "oui", "ok merci", "merci", "daccord", "d accord", "parfait", "super", "cest bon", "c est bon", "recu", "bien recu",
  "si", "vale", "gracias", "ok gracias", "perfecto", "bueno", "listo", "recibido", "de acuerdo", "claro",
]);

function normaliseAck(body) {
  return String(body ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Emoji and symbols, then punctuation. A lone thumbs-up becomes "" and
    // is handled as an acknowledgement below rather than as an empty body:
    // somebody DID answer.
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ONLY_SYMBOLS = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\s!.]+$/u;

/**
 * The verdicts no model is needed for.
 *
 * @returns `{ triage, reason, source: "rule" }` for a decided reply,
 *          `{ triage: null, reason: "empty", source: "rule" }` for a body
 *          with nothing in it, or `null` when the model is needed.
 *
 * STOP is first and absolute: lib/sms/optOutKeywords.js's own
 * classification, the same call the suppression path makes, so the two
 * cannot disagree about which words are an opt-out. START (an opt-in
 * keyword) is filed as fine — it is not a problem and not a question, and
 * whether it lifts anything is salesSms.js's business (it does not).
 */
export function preTriage(body) {
  const raw = String(body ?? "");
  if (!raw.trim()) return { triage: null, reason: "empty", source: "rule" };

  const keyword = classifyInboundSms(raw);
  if (keyword === "opt_out") return { triage: TRIAGE_STOP, reason: "opt_out_keyword", source: "rule" };
  if (keyword === "opt_in") return { triage: TRIAGE_FINE, reason: "opt_in_keyword", source: "rule" };

  if (ONLY_SYMBOLS.test(raw)) return { triage: TRIAGE_FINE, reason: "acknowledgement", source: "rule" };
  const ack = normaliseAck(raw);
  if (ack && ACKNOWLEDGEMENTS.has(ack)) return { triage: TRIAGE_FINE, reason: "acknowledgement", source: "rule" };
  if (!ack) return { triage: TRIAGE_FINE, reason: "acknowledgement", source: "rule" };

  return null;
}

// ── Over a thread ─────────────────────────────────────────────────────────

function at(value) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

/**
 * The thread's chip: the LATEST inbound row's verdict, and whether it is
 * still waiting on the rep.
 *
 * @param messages  rows with `{ direction, sentAt, triage, triageReason,
 *                  triagedAt, triageOverriddenById }`, in any order.
 * @returns `{ kind, reason, overridden, at, messageId, open }` or null when
 *          nobody has written to us in this thread.
 *
 * `open` is "the last word is theirs": an outbound row after the inbound one
 * means a rep answered, whatever they said, and the item leaves the task
 * list. A rep can still SEE the chip on the thread — the kind is a fact
 * about the message — but it is no longer something to do.
 */
export function threadTriage(messages) {
  const rows = (Array.isArray(messages) ? messages : []).filter(Boolean);
  let latestIn = null;
  let latestOut = 0;
  for (const m of rows) {
    if (m.direction === "in") {
      if (!latestIn || at(m.sentAt) > at(latestIn.sentAt)) latestIn = m;
    } else if (at(m.sentAt) > latestOut) {
      latestOut = at(m.sentAt);
    }
  }
  if (!latestIn) return null;
  return {
    kind: isTriageKind(latestIn.triage) ? latestIn.triage : null,
    reason: latestIn.triageReason || null,
    overridden: Boolean(latestIn.triageOverriddenById),
    at: latestIn.triagedAt || null,
    messageId: latestIn.id || null,
    body: latestIn.body || null,
    sentAt: latestIn.sentAt || null,
    open: at(latestIn.sentAt) > latestOut,
  };
}

/**
 * The task list: every thread whose latest inbound is a roadblock or a
 * question and has had no reply since. Roadblocks first, then questions,
 * newest first inside each — the order a rep should work them in.
 *
 * @param messages  rows across many threads, each with `fromE164`/`toE164`
 *                  and `direction` as SalesSmsMessage stores them, plus the
 *                  triage columns.
 * @returns `[{ e164, kind, reason, body, sentAt, messageId, leadId, name }]`
 */
export function openTriage(messages) {
  const byThread = new Map();
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m) continue;
    const other = m.direction === "in" ? m.fromE164 : m.toE164;
    if (!other) continue;
    if (!byThread.has(other)) byThread.set(other, []);
    byThread.get(other).push(m);
  }
  const items = [];
  for (const [e164, rows] of byThread) {
    const verdict = threadTriage(rows);
    if (!verdict || !verdict.open || !TRIAGE_OPEN.includes(verdict.kind)) continue;
    const named = rows.find((r) => r.lead?.businessName || r.lead?.contactName);
    items.push({
      e164,
      kind: verdict.kind,
      reason: verdict.reason,
      body: verdict.body,
      sentAt: verdict.sentAt,
      messageId: verdict.messageId,
      leadId: rows.find((r) => r.leadId)?.leadId || null,
      name: named ? named.lead.businessName || named.lead.contactName : null,
    });
  }
  const rank = (k) => TRIAGE_OPEN.indexOf(k);
  items.sort((a, b) => rank(a.kind) - rank(b.kind) || at(b.sentAt) - at(a.sentAt));
  return items;
}

/** Counts for a digest line: `{ roadblock: n, question: n }`. */
export function countOpenTriage(items) {
  const counts = Object.fromEntries(TRIAGE_OPEN.map((k) => [k, 0]));
  for (const item of Array.isArray(items) ? items : []) {
    if (item && TRIAGE_OPEN.includes(item.kind)) counts[item.kind] += 1;
  }
  return counts;
}
