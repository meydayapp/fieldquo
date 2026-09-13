// lib/sales/checkin/unfinishedSignup.js
//
// Two check-in drafts for a signup that was OPENED and not finished:
// two hours after the link was opened, and a day after.
//
// ══ Why these exist beside the day-1 / day-7 drafts ═══════════════════════
//
// The backlog in materialise.js writes its drafts from Company.createdAt —
// a company that exists. A contractor who opened the rep's texted link and
// stopped at the card has no company (or one with no Subscription), no
// attribution, and until 2026-09-13 no row anywhere saying the link was
// opened. lib/sales/signupProgress.js now records that instant, and the
// owner's decision is that the rep gets two drafts to send from the thread:
// a nudge two hours on ("still on for it? the link's below"), and one the
// next day. Both carry the SAME link — the same token — so the contractor
// lands on the same signup and the stepper keeps counting.
//
// ══ What is different from the company drafts, and why ═══════════════════
//
//   hour-granular   the company engine counts whole days from a signup; a
//                   link opened at 15:10 wants a nudge at 17:10, not
//                   tomorrow. So the instant is openedAt + the offset,
//                   rolled to the texting window in the LEAD's zone
//                   (schedule.js nextWindowOpening).
//   a link          draft.js's judgeDraft refuses a URL, on purpose — a
//                   check-in with a link reads as spam. This draft IS the
//                   link, so it is composed here, deterministically, and
//                   never sent through the model. The send path
//                   (store.js sendCheckIn → deliverReplySms) appends the
//                   CASL footer the same as any other draft.
//   the language    the lead's, decided the way the call script decides
//                   it (lib/sales/leadLanguage.js requiredLanguageFor:
//                   Quebec is French, everywhere else English; Spanish for
//                   a lead somebody stated as Spanish is not a fact any row
//                   holds yet, so "es" is in the table for the day it is).
//   its own key     `signup:<progressId>:<2h|24h>` — never the shape a
//                   company touchpoint uses (plan.js touchpointOfKey admits
//                   only `\d+|retention`), so the two engines cannot claim
//                   each other's rows.
//   companyId null  the row hangs on the LEAD; SalesCheckIn.companyId is
//                   nullable for exactly this (the schema's "manual half").
//
// The latest due touchpoint is drafted, not every one that has passed: a
// rep who was away for a day should find ONE draft on the thread, the
// day-after one, not a stale two-hour nudge beside it. Nothing is drafted
// past UNFINISHED_SIGNUP_MAX_AGE_MS — a week-old link is a lead to ring,
// not a text to send. A completed signup drafts nothing, ever.
//
// Pure functions first; the store function takes the client and is executed
// by scripts/check-sales-checkin-materialise.mjs against the in-memory db.

import { requiredLanguageFor } from "../leadLanguage";
import { resolveLeadTimeZone } from "../leadTimeZone";
import { signupLinkFor } from "../repStats";
import { openedUnfinishedForRep } from "../signupProgress";
import { normalisePhone } from "../suppressionRules";
import { insertDraftRow } from "./rows";
import { nextWindowOpening } from "./schedule";

/** The reason code the rows carry. Not in CHECKIN_REASONS: it is not a company signal. */
export const UNFINISHED_SIGNUP_REASON = "signup_unfinished";

/** The two touchpoints, in order, from the instant the link was opened. */
export const UNFINISHED_SIGNUP_TOUCHPOINTS = Object.freeze([
  Object.freeze({ key: "2h", afterMs: 2 * 60 * 60 * 1000 }),
  Object.freeze({ key: "24h", afterMs: 24 * 60 * 60 * 1000 }),
]);

/** Past this, the link is stale and the lead is a call, not a text. */
export const UNFINISHED_SIGNUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The languages the draft comes in — the call script's three. */
export const UNFINISHED_SIGNUP_LANGUAGES = Object.freeze(["en", "fr", "es"]);

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/** `signup:<progressId>:<key>` — never a company touchpoint's shape. */
export function unfinishedSignupDedupeKey(progressId, key) {
  if (typeof progressId !== "string" || !progressId) return null;
  if (!UNFINISHED_SIGNUP_TOUCHPOINTS.some((t) => t.key === key)) return null;
  return `signup:${progressId}:${key}`;
}

/** Is this one of ours? The counterpart of plan.js touchpointOfKey. */
export function isUnfinishedSignupKey(dedupeKey) {
  return typeof dedupeKey === "string" && /^signup:[^:]+:(2h|24h)$/.test(dedupeKey);
}

/**
 * Which touchpoint is due for a row, if any: the LATEST whose instant has
 * passed, or null — for a completed signup, an unopened link, a link older
 * than the maximum age, or nothing due yet.
 *
 * @returns {{ key, afterMs, dueAt: Date } | null}
 */
export function unfinishedSignupDue({ openedAt, completedAt, now = new Date() } = {}) {
  const opened = isDate(openedAt) ? openedAt : null;
  const at = isDate(now) ? now : new Date();
  if (!opened || isDate(completedAt)) return null;
  const age = at.getTime() - opened.getTime();
  if (age < 0 || age > UNFINISHED_SIGNUP_MAX_AGE_MS) return null;
  let due = null;
  for (const t of UNFINISHED_SIGNUP_TOUCHPOINTS) {
    if (age >= t.afterMs) due = { key: t.key, afterMs: t.afterMs, dueAt: new Date(opened.getTime() + t.afterMs) };
  }
  return due;
}

/**
 * The words, by language and touchpoint. Deterministic, no model, the link
 * in the sentence. Short enough for two SMS segments with the CASL footer
 * the send appends (the link is the longest part and it is one token).
 */
export function unfinishedSignupDraft({ language = "en", repName = "", businessName = "", link = "", touchpoint = "2h" } = {}) {
  const lang = UNFINISHED_SIGNUP_LANGUAGES.includes(language) ? language : "en";
  const rep = String(repName || "").trim();
  const biz = String(businessName || "").trim();
  const url = String(link || "").trim();
  if (!url) return null;
  const later = touchpoint === "24h";
  if (lang === "fr") {
    const who = rep ? `${rep} de FieldQuo` : "FieldQuo";
    const about = biz ? ` pour ${biz}` : "";
    return later
      ? `Bonjour, c'est ${who}. L'inscription${about} d'hier n'est pas finie. Le lien marche encore, rien n'est facturé pendant un mois : ${url}`
      : `Bonjour, c'est ${who}. Toujours partant${about}? Deux minutes, rien n'est facturé pendant un mois : ${url} Répondez ici si ça bloque.`;
  }
  if (lang === "es") {
    const who = rep ? `${rep} de FieldQuo` : "FieldQuo";
    const about = biz ? ` para ${biz}` : "";
    return later
      ? `Hola, soy ${who}. El registro${about} de ayer quedó a medias. El enlace sigue vigente, no se cobra nada en un mes: ${url}`
      : `Hola, soy ${who}. ¿Seguimos${about}? Son dos minutos y no se cobra nada en un mes: ${url} Responda aquí si algo lo detiene.`;
  }
  const who = rep ? `${rep} from FieldQuo` : "FieldQuo";
  const about = biz ? ` for ${biz}` : "";
  return later
    ? `Hi, it is ${who}. Yesterday's signup${about} did not get finished. The link still works, nothing is charged for a month: ${url}`
    : `Hi, it is ${who}. Still on${about}? Two minutes, nothing is charged for a month: ${url} Reply here if anything is in the way.`;
}

/**
 * The lead's language for the draft: Quebec is French (the same rule the
 * call script uses), everywhere else English.
 */
export function unfinishedSignupLanguage(lead = {}) {
  return requiredLanguageFor({ province: lead?.province || lead?.prospect?.province || null }) || "en";
}

/**
 * Write the due draft for every opened-and-unfinished link this rep texted.
 *
 * @param origin  the app origin for the link (lib/appUrl.js getAppOrigin);
 *                null skips every row with reason `no_origin` — a draft
 *                without its link is the whole point missing.
 * @returns {{ created: [...], skipped: [{ progressId, reason }] }}
 */
export async function materialiseUnfinishedSignupsForRep({ salesRepId, client, now = new Date(), origin = null, dryRun = false } = {}) {
  const out = { created: [], skipped: [] };
  if (!salesRepId || !client) return out;
  const rep = await client.salesRep.findUnique({ where: { id: salesRepId }, select: { id: true, name: true, code: true } });
  if (!rep) return out;
  const rows = await openedUnfinishedForRep({ client, salesRepId });
  if (!rows.length) return out;
  const leadIds = [...new Set(rows.map((r) => r.leadId))];
  const leads = await client.salesLead.findMany({
    where: { id: { in: leadIds }, salesRepId },
    select: { id: true, businessName: true, phone: true, timeZone: true, country: true, province: true },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));
  for (const row of rows) {
    const due = unfinishedSignupDue({ openedAt: row.openedAt, completedAt: row.completedAt, now });
    if (!due) {
      out.skipped.push({ progressId: row.id, reason: "not_due" });
      continue;
    }
    const lead = leadById.get(row.leadId);
    if (!lead) {
      out.skipped.push({ progressId: row.id, reason: "lead_not_yours" });
      continue;
    }
    const to = normalisePhone(lead.phone);
    if (!to) {
      out.skipped.push({ progressId: row.id, reason: "no_number" });
      continue;
    }
    if (!origin || !rep.code) {
      out.skipped.push({ progressId: row.id, reason: origin ? "no_rep_code" : "no_origin" });
      continue;
    }
    const link = signupLinkFor(origin, rep.code, { linkToken: row.token });
    const language = unfinishedSignupLanguage(lead);
    const draftText = unfinishedSignupDraft({ language, repName: rep.name, businessName: lead.businessName, link, touchpoint: due.key });
    const dedupeKey = unfinishedSignupDedupeKey(row.id, due.key);
    const zone = resolveLeadTimeZone({ timeZone: lead.timeZone, country: lead.country, province: lead.province }).timeZone;
    // Never before the touchpoint, never outside the texting window where
    // they are; with no zone the instant is the touchpoint's and the send
    // path's own window check has the last word.
    const scheduledFor = zone ? nextWindowOpening(due.dueAt, zone) || due.dueAt : due.dueAt;
    if (dryRun) {
      out.created.push({ progressId: row.id, leadId: lead.id, touchpoint: due.key, language, dedupeKey, scheduledFor, dryRun: true, id: null });
      continue;
    }
    const written = await insertDraftRow(client, {
      salesRepId,
      companyId: null,
      leadId: lead.id,
      toE164: to,
      draftText,
      origin: "engine",
      reasonCode: UNFINISHED_SIGNUP_REASON,
      draftSource: "rule",
      degraded: false,
      scheduledFor,
      status: "draft",
      dedupeKey,
    });
    if (written.existed) {
      out.skipped.push({ progressId: row.id, reason: "open" });
      continue;
    }
    out.created.push({ progressId: row.id, leadId: lead.id, touchpoint: due.key, language, dedupeKey, scheduledFor, dryRun: false, id: written.checkIn?.id || null });
  }
  return out;
}
