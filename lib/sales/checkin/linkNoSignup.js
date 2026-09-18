// lib/sales/checkin/linkNoSignup.js
//
// Three follow-up drafts for a signup link that was SENT and went nowhere:
// no signup, no reply — day 2, day 5, and one last nudge before the claim
// lapses.
//
// ══ Why these exist beside unfinishedSignup.js ════════════════════════════
//
// That file drafts for a link that was OPENED and stopped at the card. This
// one is the step before it: the rep texted the link on the call, the
// contractor never tapped it, and nothing anywhere brought the company back
// to the rep's attention. The owner (2026-09-18): "follow-up drafts for
// companies the rep has claimed, texted the signup link to, and that have
// not signed up" — each a draft the rep reviews and sends, NEVER auto-sent,
// in the lead's language, with the compliance footer the send appends.
//
// ══ The sequence ══════════════════════════════════════════════════════════
//
//   day 2   "any questions about the link I sent?"
//   day 5   "happy to walk you through it in fifteen minutes — mornings or
//            afternoons?"
//   last    one last nudge, six hours before the prospect's claim lapses
//           (Prospect.claimExpiresAt) — or, for a claim with no expiry (a
//           worked claim is permanent, dispositions.js CLAIM_WORKED) and a
//           lead with no prospect, on day LAST_NUDGE_DAY.
//
// Counted from linkSentAt on the SalesSignupProgress row the text minted,
// and the latest due touchpoint is drafted, not every one that has passed:
// a rep back from two days off finds ONE draft, not three.
//
// ══ Stopped the moment ════════════════════════════════════════════════════
//
//   they signed up      progress.completedAt, or a company attributed to
//                       the token (progress.companyId + completedAt);
//   they replied        any inbound SalesSmsMessage from the number after
//                       the link went — a reply is a conversation, and the
//                       thread's own suggestion machinery takes over;
//   they asked to stop  the do-not-contact list (checkSuppression, sms) —
//                       and no draft is written for them, because a row for
//                       somebody who said STOP invites the next rep to try;
//   the claim went      the prospect is no longer this rep's (assignedRepId)
//                       or the lead is not theirs any more;
//   the link was opened unfinishedSignup.js owns the thread from there —
//                       its 2h / 24h nudges say something more specific.
//
// A stop condition also DISMISSES the sequence's open drafts (status
// "dismissed", the same filing a rep's own dismiss makes), so "Drafts due"
// clears rather than offering a text to somebody who has since signed up.
// linkNoSignupVerdict() is the one pure function that decides all of this;
// the store function reads the rows it needs and executes the verdict.
//
// ══ Its own key ═══════════════════════════════════════════════════════════
//
// `linksent:<progressId>:<d2|d5|last>` — never a company touchpoint's shape
// (plan.js touchpointOfKey) and never unfinishedSignup's, so the three
// engines cannot claim each other's rows. companyId null: the row hangs on
// the lead, the schema's "manual half".
//
// Pure functions first; the store function takes the client and is executed
// by scripts/check-sales-link-no-signup.mjs against a scriptable client,
// one stop condition at a time.

import { requiredLanguageFor } from "../leadLanguage";
import { resolveLeadTimeZone } from "../leadTimeZone";
import { normalisePhone } from "../suppressionRules";
import { checkSuppression } from "../suppression";
import { insertDraftRow } from "./rows";
import { nextWindowOpening } from "./schedule";

/** The reason code the rows carry. Not a company signal (signals.js); its own catalogue key. */
export const LINK_NO_SIGNUP_REASON = "link_no_signup";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** The last nudge lands this long before the claim lapses. */
export const LAST_NUDGE_BEFORE_CLAIM_MS = 6 * HOUR_MS;
/** …and on this day when nothing lapses (a worked claim, a typed lead). */
export const LAST_NUDGE_DAY = 9;

/** The touchpoints, in order, from the instant the link went. */
export const LINK_NO_SIGNUP_TOUCHPOINTS = Object.freeze([
  Object.freeze({ key: "d2", afterMs: 2 * DAY_MS }),
  Object.freeze({ key: "d5", afterMs: 5 * DAY_MS }),
  Object.freeze({ key: "last", afterMs: null }),
]);

/** Past this, a link nobody tapped is a lead to ring, not a text to send. */
export const LINK_NO_SIGNUP_MAX_AGE_MS = 21 * DAY_MS;

export const LINK_NO_SIGNUP_LANGUAGES = Object.freeze(["en", "fr", "es"]);

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/** `linksent:<progressId>:<key>` — never another engine's shape. */
export function linkNoSignupDedupeKey(progressId, key) {
  if (typeof progressId !== "string" || !progressId) return null;
  if (!LINK_NO_SIGNUP_TOUCHPOINTS.some((t) => t.key === key)) return null;
  return `linksent:${progressId}:${key}`;
}

/** Is this one of ours? */
export function isLinkNoSignupKey(dedupeKey) {
  return typeof dedupeKey === "string" && /^linksent:[^:]+:(d2|d5|last)$/.test(dedupeKey);
}

/** The progress id and touchpoint a key names, or null. */
export function parseLinkNoSignupKey(dedupeKey) {
  const m = /^linksent:([^:]+):(d2|d5|last)$/.exec(String(dedupeKey || ""));
  return m ? { progressId: m[1], touchpoint: m[2] } : null;
}

/**
 * When the last nudge is due: six hours before the claim lapses, when a
 * claim lapses at all and does so after day 5 — else day LAST_NUDGE_DAY.
 * A claim lapsing before day 5 is overtaken: its own release stops the
 * sequence (linkNoSignupVerdict), and no last nudge is invented for it.
 */
export function lastNudgeAt({ linkSentAt, claimExpiresAt = null } = {}) {
  const sent = isDate(linkSentAt) ? linkSentAt : null;
  if (!sent) return null;
  const day5 = new Date(sent.getTime() + 5 * DAY_MS);
  if (isDate(claimExpiresAt)) {
    const at = new Date(claimExpiresAt.getTime() - LAST_NUDGE_BEFORE_CLAIM_MS);
    if (at.getTime() > day5.getTime()) return at;
  }
  return new Date(sent.getTime() + LAST_NUDGE_DAY * DAY_MS);
}

/**
 * THE decision: draft, or stop — and why.
 *
 * @param progress   `{ linkSentAt, openedAt, completedAt, companyId }`
 * @param inboundAfterLink  true when any inbound text from the number
 *                   arrived after linkSentAt (the caller reads the rows)
 * @param suppressed the do-not-contact verdict for the number (sms)
 * @param claim      `{ held: boolean, claimExpiresAt }` — held is "this
 *                   rep still holds the prospect" (or the lead has no
 *                   prospect and is still theirs); expiry null = permanent
 * @param leadHeld   the lead is still this rep's
 * @param now
 * @returns {{ action: "draft", touchpoint, dueAt }
 *         | { action: "stop", reason }   — dismiss open rows, write none
 *         | { action: "wait" }           — nothing due yet, nothing to stop
 */
export function linkNoSignupVerdict({ progress = {}, inboundAfterLink = false, suppressed = false, claim = { held: true, claimExpiresAt: null }, leadHeld = true, now = new Date() } = {}) {
  const sent = isDate(progress?.linkSentAt) ? progress.linkSentAt : null;
  if (!sent) return { action: "wait" };
  if (isDate(progress?.completedAt) || (progress?.companyId && isDate(progress?.cardAt))) return { action: "stop", reason: "signed_up" };
  if (inboundAfterLink) return { action: "stop", reason: "replied" };
  if (suppressed) return { action: "stop", reason: "suppressed" };
  if (!leadHeld) return { action: "stop", reason: "lead_released" };
  if (!claim?.held) return { action: "stop", reason: "claim_released" };
  if (isDate(progress?.openedAt)) return { action: "stop", reason: "opened" };
  const at = isDate(now) ? now : new Date();
  const age = at.getTime() - sent.getTime();
  if (age < 0) return { action: "wait" };
  if (age > LINK_NO_SIGNUP_MAX_AGE_MS) return { action: "stop", reason: "stale" };
  let due = null;
  for (const t of LINK_NO_SIGNUP_TOUCHPOINTS) {
    const dueAt = t.key === "last" ? lastNudgeAt({ linkSentAt: sent, claimExpiresAt: claim?.claimExpiresAt || null }) : new Date(sent.getTime() + t.afterMs);
    if (dueAt && at.getTime() >= dueAt.getTime()) due = { touchpoint: t.key, dueAt };
  }
  return due ? { action: "draft", ...due } : { action: "wait" };
}

/**
 * The words, by language and touchpoint. Deterministic, no model, NO link:
 * the link is already in their thread two lines up, and draft.js's judge
 * refuses a URL in a check-in for the reason it gives (it reads as spam).
 * The send path appends the CASL footer.
 */
export function linkNoSignupDraft({ language = "en", repName = "", businessName = "", touchpoint = "d2" } = {}) {
  const lang = LINK_NO_SIGNUP_LANGUAGES.includes(language) ? language : "en";
  const rep = String(repName || "").trim();
  const biz = String(businessName || "").trim();
  if (lang === "fr") {
    const who = rep ? `${rep} de FieldQuo` : "FieldQuo";
    const hi = biz ? `Bonjour ${biz}` : "Bonjour";
    if (touchpoint === "d5") return `${hi}, c'est ${who}. Je peux vous faire le tour en quinze minutes, quand ça vous arrange — plutôt le matin ou l'après-midi?`;
    if (touchpoint === "last") return `${hi}, c'est ${who}. Dernier petit mot de ma part : le lien d'inscription est toujours dans ce fil, et le premier mois est gratuit. Répondez ici si vous avez une question, sinon je vous laisse tranquille.`;
    return `${hi}, c'est ${who}. Des questions sur le lien que je vous ai envoyé? Répondez ici et je vous réponds.`;
  }
  if (lang === "es") {
    const who = rep ? `${rep} de FieldQuo` : "FieldQuo";
    const hi = biz ? `Hola ${biz}` : "Hola";
    if (touchpoint === "d5") return `${hi}, soy ${who}. Con gusto le muestro cómo funciona en quince minutos, cuando le convenga — ¿mañanas o tardes?`;
    if (touchpoint === "last") return `${hi}, soy ${who}. Último mensaje de mi parte: el enlace de registro sigue en esta conversación y el primer mes es gratis. Responda aquí si tiene alguna pregunta; si no, no le molesto más.`;
    return `${hi}, soy ${who}. ¿Alguna pregunta sobre el enlace que le envié? Responda aquí y le contesto.`;
  }
  const who = rep ? `${rep} from FieldQuo` : "FieldQuo";
  const hi = biz ? `Hi ${biz}` : "Hi";
  if (touchpoint === "d5") return `${hi}, it is ${who}. Happy to walk you through it in fifteen minutes, whenever suits — mornings or afternoons?`;
  if (touchpoint === "last") return `${hi}, it is ${who}. Last note from me: the signup link is still in this thread, and the first month is free. Reply here if you have any questions — otherwise I will leave you be.`;
  return `${hi}, it is ${who}. Any questions about the link I sent? Reply here and I will answer.`;
}

/** The lead's language: Quebec is French (the call script's rule), everywhere else English. */
export function linkNoSignupLanguage(lead = {}) {
  return requiredLanguageFor({ province: lead?.province || lead?.prospect?.province || null }) || "en";
}

/**
 * Write the due draft for every link this rep sent that went nowhere, and
 * dismiss the sequence's open drafts wherever a stop condition holds.
 *
 * @returns {{ created: [...], skipped: [{ progressId, reason }], dismissed: [{ progressId, reason, count }] }}
 */
export async function materialiseLinkNoSignupForRep({ salesRepId, client, now = new Date(), dryRun = false } = {}) {
  const out = { created: [], skipped: [], dismissed: [] };
  if (!salesRepId || !client || typeof client.salesSignupProgress?.findMany !== "function") return out;
  const rep = await client.salesRep.findUnique({ where: { id: salesRepId }, select: { id: true, name: true, code: true } });
  if (!rep) return out;

  // Links this rep sent; the ones that opened or completed are read too,
  // because their open drafts (written before the tap) are dismissed here.
  const rows = await client.salesSignupProgress.findMany({
    where: { salesRepId, linkSentAt: { not: null } },
    orderBy: { linkSentAt: "asc" },
    take: 300,
  });
  if (!rows.length) return out;

  const leadIds = [...new Set(rows.map((r) => r.leadId).filter(Boolean))];
  const leads = await client.salesLead.findMany({
    where: { id: { in: leadIds } },
    select: {
      id: true,
      salesRepId: true,
      businessName: true,
      phone: true,
      timeZone: true,
      country: true,
      province: true,
      prospectId: true,
      prospect: { select: { id: true, assignedRepId: true, claimExpiresAt: true, province: true } },
    },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const dismissOpen = async (progressId, reason) => {
    if (dryRun) {
      out.dismissed.push({ progressId, reason, count: null, dryRun: true });
      return;
    }
    const keys = LINK_NO_SIGNUP_TOUCHPOINTS.map((t) => linkNoSignupDedupeKey(progressId, t.key));
    const { count } = await client.salesCheckIn.updateMany({
      where: { salesRepId, dedupeKey: { in: keys }, status: "draft" },
      data: { status: "dismissed", dismissedAt: now },
    });
    if (count > 0) out.dismissed.push({ progressId, reason, count });
  };

  for (const row of rows) {
    const lead = leadById.get(row.leadId) || null;
    const leadHeld = Boolean(lead && lead.salesRepId === salesRepId);
    const to = lead ? normalisePhone(lead.phone) : null;

    // The inbound read and the list read are per row, on purpose: both
    // are about THIS number after THIS link, and a batched read that got
    // the join wrong would stop the wrong sequence.
    const inbound = to
      ? await client.salesSmsMessage.findFirst({
          where: { direction: "in", fromE164: to, sentAt: { gt: row.linkSentAt } },
          select: { id: true },
        })
      : null;
    // No number, no list to ask: the lead branch below says what is wrong.
    const verdict = to ? await checkSuppression(client, { phone: to, channel: "sms" }).catch(() => null) : { suppressed: false };
    const claim = lead?.prospect
      ? { held: lead.prospect.assignedRepId === salesRepId, claimExpiresAt: lead.prospect.claimExpiresAt || null }
      : { held: true, claimExpiresAt: null };

    const decision = linkNoSignupVerdict({
      progress: row,
      inboundAfterLink: Boolean(inbound),
      // An unreadable list is treated as a stop for WRITING (nothing is
      // drafted on the assumption that nobody opted out) but not for
      // dismissing what exists: verdict null → suppressed true below only
      // decides this pass's write.
      suppressed: verdict === null ? true : Boolean(verdict?.suppressed),
      claim,
      leadHeld,
      now,
    });

    if (decision.action === "stop") {
      // A list that could not be read is "skip this pass", not "dismiss".
      if (verdict === null && decision.reason === "suppressed") {
        out.skipped.push({ progressId: row.id, reason: "suppression_unreadable" });
        continue;
      }
      await dismissOpen(row.id, decision.reason);
      out.skipped.push({ progressId: row.id, reason: decision.reason });
      continue;
    }
    if (decision.action === "wait") {
      out.skipped.push({ progressId: row.id, reason: "not_due" });
      continue;
    }
    if (!to) {
      out.skipped.push({ progressId: row.id, reason: "no_number" });
      continue;
    }

    const language = linkNoSignupLanguage(lead);
    const draftText = linkNoSignupDraft({ language, repName: rep.name, businessName: lead.businessName, touchpoint: decision.touchpoint });
    const dedupeKey = linkNoSignupDedupeKey(row.id, decision.touchpoint);
    const zone = resolveLeadTimeZone({ timeZone: lead.timeZone, country: lead.country, province: lead.province, prospect: lead.prospect }).timeZone;
    const scheduledFor = zone ? nextWindowOpening(decision.dueAt, zone) || decision.dueAt : decision.dueAt;
    if (dryRun) {
      out.created.push({ progressId: row.id, leadId: lead.id, touchpoint: decision.touchpoint, language, dedupeKey, scheduledFor, dryRun: true, id: null });
      continue;
    }
    // An earlier touchpoint's draft still open (the rep never sent day 2
    // and day 5 is now due) is dismissed in favour of the current one —
    // one draft on the thread, the one that is due.
    const earlier = LINK_NO_SIGNUP_TOUCHPOINTS.filter((t) => t.key !== decision.touchpoint).map((t) => linkNoSignupDedupeKey(row.id, t.key));
    await client.salesCheckIn.updateMany({
      where: { salesRepId, dedupeKey: { in: earlier }, status: "draft" },
      data: { status: "dismissed", dismissedAt: now },
    });
    const written = await insertDraftRow(client, {
      salesRepId,
      companyId: null,
      leadId: lead.id,
      toE164: to,
      draftText,
      origin: "engine",
      reasonCode: LINK_NO_SIGNUP_REASON,
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
    out.created.push({ progressId: row.id, leadId: lead.id, touchpoint: decision.touchpoint, language, dedupeKey, scheduledFor, dryRun: false, id: written.checkIn?.id || null });
  }
  return out;
}
