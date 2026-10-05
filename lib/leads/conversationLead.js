// lib/leads/conversationLead.js
//
// A Facebook, Instagram or WhatsApp conversation -> ONE lead, with every
// field traceable to the message it came from.
//
// ══ What was there before ══════════════════════════════════════════════════
//
// A Meta lead FORM became a lead (lib/meta/leadsImport.js). A Meta
// CONVERSATION did not: it sat in the inbox, `MessageThread.leadId` was set
// only if somebody linked it by hand, and the AI employee's callback tool made
// a lead only when it booked a callback — without linking it to the thread.
// So the busiest channel a small contractor has produced the fewest leads on
// the board, and the campaign rollup (lib/analytics/campaignRollup.js), which
// joins on LeadRequest.metaCampaignId, could not see a single click-to-message
// ad at all.
//
// ══ The order of work, cheapest first ══════════════════════════════════════
//
//   1. Deterministic, free, on every new inbound message: phone, email, street
//      address and postal code out of what the CUSTOMER typed
//      (lib/attribution/contactPatterns.js — the same patterns the
//      conversation review redacts with), the WhatsApp number Meta already
//      gives us, and the photo count (lib/aiEmployee/evidence.js's tally).
//   2. The model (lib/ai/conversationLeadExtract.js), metered, only when
//      aiRunDecision says so: once when there is something to read, again on
//      each new message while it is still "undetermined", and otherwise ONLY
//      when a new contact detail has appeared. Never past MAX_AI_RUNS_PER_THREAD.
//   3. Without the model (no key, no AI credit), the AI employee's front desk
//      intent stands in where it exists — `book` and `price` are somebody
//      wanting work — and an existing lead matched on a phone or an email is
//      still enriched, because that needs no judgement at all.
//
// ══ One lead per person, not per channel ═══════════════════════════════════
//
// findDuplicateLead() looks for the lead this person ALREADY is, before a new
// one is made: the thread's own linked lead first, then an open lead with the
// same phone or email (lib/contacts/matchContact.js's scoring, so "(613)
// 555-0142" and "+16135550142" are one number), then — the lead-ad case — an
// open Meta lead-FORM lead whose name is exactly this conversation's Facebook
// profile name, made in the last LEAD_AD_JOIN_DAYS. That last join is sound
// because Meta pre-fills the form's full_name from the same Facebook profile
// the Messenger thread is named after; it is still only taken when exactly ONE
// lead qualifies and no phone or email on the two disagrees, and the evidence
// says it was joined on name and timing so a person can see it.
//
// ══ What is never done ═════════════════════════════════════════════════════
//
//   * A column a person (or the homeowner, on a form) filled is never
//     overwritten. planLeadWrite() writes only an EMPTY column, or one that
//     still holds exactly the value this file wrote last time. What the
//     conversation said instead is kept in `skipped`, and the drawer shows it.
//   * Nothing is invented. A name the customer did not type falls back to the
//     profile name Meta sends (labelled "profile", never "they said"), and
//     nothing else falls back to anything.
//   * Spam, an existing customer's problem with finished work, and a message
//     with no work in it make no lead.
//   * The thread's own `leadId`, when a person set it, is never replaced.
//   * A link a person UNDID — a lead unlinked from the thread in the inbox, or
//     "Not the same person" on the lead — is never made again
//     (lib/leads/identityLinks.js's rejectedPairs).
//   * A conversation a person marked "not a lead" when deleting the lead it
//     made (leadCapture.notALead, lib/leads/deleteLead.js) makes no lead
//     again, unless a person links one to it by hand.
//
// ══ The message reviewer's verdict (2026-10-03) ════════════════════════════
//
// Beside "is this a lead", every pass that has something new to judge also
// asks the RECORDS who this person is (lib/leads/messageReview.js): a client
// on file, and whether a quote, a job or an invoice already exists for them.
// A conversation from somebody who already CONVERTED, or an existing client
// with no new work, makes no new lead — it is tied to the client instead —
// and the verdict (genuine lead / not a lead and why / existing client /
// converted), with the message and the documents it rests on, is stored on
// the thread's leadCapture.review and on the lead's conversationEvidence.
//
// ══ Only a `lead` tier makes a lead (owner, 2026-10-05) ════════════════════
//
// Before any of the above, every pass classifies the conversation into one
// of four tiers (lib/leads/qualification.js): tap_only, conversation, lead,
// not_relevant — deterministically and for free. Only `lead` (a buying signal
// plus a real detail: counts, photos, an address, a phone or email, a booking
// request, a specific question about their job) may create a lead. The model
// runs ONLY where it can change the outcome: when the rules cannot place the
// thread (`needsAi`), or when the thread is a lead and the existing field
// reading applies (name, service, timeline — under aiRunDecision's cost rule,
// unchanged). A tap-only, not-relevant or rules-decided conversation never
// spends AI credit. A person's tier (one tap in the inbox or on the lead)
// overrides the rules and sticks; the "not a lead" mark above still wins over
// everything, including that. The counts the person typed ("22 doors + 15
// drawers") are stored on the lead's intake.scope with the sentence they came
// from (lib/leads/scopeExtract.js), and a "back in three weeks" becomes a
// dated follow-up task (lib/leads/followUpIntent.js, followUpTask.js).
//
// ══ History ════════════════════════════════════════════════════════════════
//
// The history backfill (lib/meta/historyBackfill.js) calls this with
// `imported: true` once a conversation's history has been stored. A lead it
// makes is stamped importedAt (no "new lead" alert — createScoredLead), and
// the model runs only when the caller allows it (`allowAi`, which the
// backfill sets for recent conversations only — see there for the cost).
import { db } from "@/lib/db";
import { createScoredLead, rescoreLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { cleanTimeline } from "@/lib/leads/qualifiers";
import { cleanEmail } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai/provider";
import { extractConversationLead, LEAD_KINDS } from "@/lib/ai/conversationLeadExtract";
import { attachmentTally } from "@/lib/aiEmployee/evidence";
import { sourceForPlatform } from "@/lib/messaging/platforms";
import { contactKeys, scoreCandidate, nameKey } from "@/lib/contacts/matchContact";
import { freshPatterns } from "@/lib/attribution/contactPatterns";
import { resolveCampaignForAd } from "@/lib/meta/leadsFetch";
import { reviewVerdict, verdictMakesLead, reviewForLead, reviewRecords as loadReviewRecords } from "@/lib/leads/messageReview";
import { rejectedPairs, linkThreadToLead, linkLeadToClient } from "@/lib/leads/identityLinks";
import { isMarkedNotALead } from "@/lib/leads/conversationSources";
import { applyAiVerdict, effectiveTier, storableQualification, reasonInEnglish, isSystemLine } from "@/lib/leads/qualification";
import { languageOfText } from "@/lib/leads/textLanguage";
import { loadTemplateCounts, loadQualificationServices, verdictForThread } from "@/lib/leads/qualifyThreads";
import { storableScope, hasCounts } from "@/lib/leads/scopeExtract";
import { inferService } from "@/lib/leads/scopeEstimate";
import { pendingFollowUp } from "@/lib/leads/followUpIntent";
import { ensureFollowUpTask } from "@/lib/leads/followUpTask";

/** The Meta conversations this runs on. FieldQuo's own web chat and SMS line
 *  are not here: their AI employee already takes a callback lead directly. */
export const CAPTURE_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp"]);

/** The most model reads one conversation can cost. */
export const MAX_AI_RUNS_PER_THREAD = 3;

/** Characters of customer text before the first read is worth paying for.
 *  "hi" and "hello?" are not. */
export const MIN_TEXT_FOR_AI = 12;

/** How far back an open lead is looked for. */
export const LEAD_DEDUPE_DAYS = 180;

/** The lead-ad name-and-timing join's window — see the header. */
export const LEAD_AD_JOIN_DAYS = 30;

/** Messages of a thread read per pass — the newest. */
export const MESSAGES_READ = 60;

/**
 * A conversation whose newest customer message is older than this is history
 * when the backfill reviews it: a lead made from it is stamped importedAt and
 * announced to nobody. Younger than this, it is somebody who wrote today and
 * has not been answered — that is a live lead, and it pings like one.
 */
export const HISTORY_SILENT_AFTER_MS = 24 * 60 * 60 * 1000;

/** A "back in three weeks" older than this is not turned into a task. */
export const FOLLOW_UP_LOOKBACK_DAYS = 120;

/** The verdicts that end a conversation's lead story (no lead, ever,
 *  unless a NEW contact detail reopens it — and spam not even then). */
const NO_LEAD_KINDS = Object.freeze(["spam", "existing_customer_issue", "not_work"]);

const DAY = 24 * 60 * 60 * 1000;

const clipQuote = (body, at, len) => {
  const text = String(body ?? "");
  const start = Math.max(0, at - 30);
  const end = Math.min(text.length, at + len + 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
};

const evidenceOf = (m, value, method, at = 0, len = 0) => ({
  value,
  messageId: m?.id ?? null,
  sentAt: m?.sentAt ?? null,
  quote: m ? clipQuote(m.body, at, len || String(value).length) : null,
  method,
});

/**
 * What the customer typed that a pattern can read. Pure, free.
 *
 * Inbound and non-private only — an outbound signature carries the
 * CONTRACTOR's phone and email (the same rule loadMonthlyConversations'
 * contactFromThread keeps). First occurrence wins: the number somebody gave
 * first is the one they meant, and a later "or my husband's, 613…" is not a
 * correction.
 */
export function deterministicContacts({ messages = [], platform = null, participantExternalId = null } = {}) {
  const out = { phone: null, email: null, address: null, postcode: null };
  const inbound = (Array.isArray(messages) ? messages : []).filter((m) => m && m.direction === "in" && !m.private);

  for (const m of inbound) {
    const body = String(m.body ?? "");
    if (!body) continue;
    const p = freshPatterns();
    if (!out.email) {
      const hit = p.email.exec(body);
      if (hit) out.email = evidenceOf(m, hit[0], "pattern", hit.index, hit[0].length);
    }
    if (!out.phone) {
      const hit = p.phone.exec(body);
      if (hit) out.phone = evidenceOf(m, hit[0].trim(), "pattern", hit.index, hit[0].length);
    }
    if (!out.address) {
      const hit = p.address.exec(body);
      if (hit) out.address = evidenceOf(m, hit[0].trim().replace(/[.,]$/, ""), "pattern", hit.index, hit[0].length);
    }
    if (!out.postcode) {
      const hit = p.postcode.exec(body);
      if (hit) out.postcode = evidenceOf(m, hit[0].toUpperCase(), "pattern", hit.index, hit[0].length);
    }
  }

  // WhatsApp's participant id IS the customer's number (international, no
  // "+"). It is something Meta verified, not something typed — a better
  // phone than any pattern, so it wins when there is one.
  if (platform === "whatsapp" && /^\d{8,15}$/.test(String(participantExternalId || ""))) {
    out.phone = { value: `+${participantExternalId}`, messageId: null, sentAt: null, quote: null, method: "whatsapp_number" };
  }
  // A text's sender IS the phone, in E.164, from the carrier — the same
  // standing as WhatsApp's number above (lib/businessNumber/ — a text to the
  // company's own business line).
  if (platform === "sms" && /^\+\d{8,15}$/.test(String(participantExternalId || ""))) {
    out.phone = { value: String(participantExternalId), messageId: null, sentAt: null, quote: null, method: "sms_number" };
  }

  return { ...out, photos: attachmentTally(inbound) };
}

/** A stable list of the contact details seen — what "new details" is measured against. */
export function contactSignature(det = {}) {
  const sig = [];
  const k = contactKeys({ email: det.email?.value, phone: det.phone?.value, address: det.address?.value });
  if (k.phone) sig.push(`phone:${k.phone}`);
  if (k.email) sig.push(`email:${k.email}`);
  if (k.address?.key) sig.push(`address:${k.address.key}`);
  if (det.postcode?.value) sig.push(`postcode:${String(det.postcode.value).replace(/\s|-/g, "")}`);
  return sig.sort();
}

/**
 * Should the model read this conversation now? Pure — the cost rule.
 *
 * @param capture        MessageThread.leadCapture (or null)
 * @param signature      contactSignature() of the conversation now
 * @param inboundChars   characters of customer text so far
 * @param inboundCount   customer messages so far
 * @param aiConfigured   lib/ai/provider.js isAiConfigured()
 */
export function aiRunDecision({ capture = null, signature = [], inboundChars = 0, inboundCount = 0, aiConfigured = true } = {}) {
  const c = capture || {};
  const runs = Number(c.aiRuns) || 0;
  if (!aiConfigured) return { run: false, why: "ai_unconfigured" };
  if (runs >= MAX_AI_RUNS_PER_THREAD) return { run: false, why: "cap_reached" };
  if (c.kind === "spam") return { run: false, why: "spam" };
  if (!runs) {
    return inboundChars >= MIN_TEXT_FOR_AI ? { run: true, why: "first_read" } : { run: false, why: "too_little_said" };
  }
  if (c.kind === "undetermined" || !c.kind) {
    return inboundCount > (Number(c.inboundAtRun) || 0)
      ? { run: true, why: "still_undetermined" }
      : { run: false, why: "nothing_new" };
  }
  const seen = new Set(Array.isArray(c.contactsSeen) ? c.contactsSeen : []);
  return signature.some((s) => !seen.has(s)) ? { run: true, why: "new_contact_details" } : { run: false, why: "nothing_new" };
}

/**
 * The verdict, from the best evidence available. Pure.
 *
 * The model's answer when there is one. Otherwise the front desk's — `book`
 * and `price` are somebody wanting work; `problem` is NOT, because it covers
 * both a new leak and a complaint about finished work (routing.js's own
 * definition), and `other` says nothing. A verdict the model made on an
 * EARLIER message outranks the front desk. Otherwise null: unknown, which
 * makes no lead.
 */
export function decideKind({ ai = null, routingIntent = null, capture = null } = {}) {
  if (ai?.ok && ai.kind) return { kind: ai.kind, method: "ai", reason: ai.reason || null };
  // A reading the model already made of this conversation outranks the front
  // desk's four-word triage of its first message.
  if (capture?.kind && capture.kindMethod === "ai") return { kind: capture.kind, method: "ai", reason: capture.reason || null };
  if (routingIntent === "book" || routingIntent === "price") {
    return { kind: "work_request", method: "front_desk", reason: `front desk read the first message as "${routingIntent}"` };
  }
  if (capture?.kind) return { kind: capture.kind, method: capture.kindMethod || null, reason: capture.reason || null };
  return { kind: null, method: null, reason: null };
}

/**
 * The fields, with evidence, from both passes. Pure.
 *
 * Deterministic wins over the model for phone, email and address: a pattern
 * cannot hallucinate, and the model's copy has already been through
 * verifyExtraction's witness test anyway. The name is the one field only the
 * model can read; when it cannot, Meta's profile name stands in and says so.
 */
export function buildFieldEvidence({ det = {}, ai = null, participantName = null } = {}) {
  const f = {};
  const fromAi = (key, method = "ai") => {
    const x = ai?.ok ? ai.fields?.[key] : null;
    return x ? evidenceOf(x.message, x.value, method, Math.max(0, String(x.message?.body ?? "").toLowerCase().indexOf(String(x.value).toLowerCase())), String(x.value).length) : null;
  };
  const name = fromAi("name");
  if (name) f.name = name;
  else if (participantName && String(participantName).trim()) {
    f.name = { value: String(participantName).trim().slice(0, 120), messageId: null, sentAt: null, quote: null, method: "profile" };
  }
  const phone = det.phone || fromAi("phone");
  if (phone) f.phone = phone;
  const email = det.email || fromAi("email");
  if (email) f.email = email;
  const address = det.address || fromAi("address");
  if (address) f.address = address;
  const area = fromAi("area") || det.postcode || null;
  if (area && !address) f.area = area;
  if (ai?.ok && ai.fields?.service) {
    const s = ai.fields.service;
    f.service = { ...evidenceOf(s.message, s.value, "ai"), label: s.label || null, quote: s.message ? clipQuote(s.message.body, 0, 120) : null };
  }
  if (ai?.ok && ai.fields?.timeline) {
    const t = ai.fields.timeline;
    f.timeline = { ...evidenceOf(t.message, t.value, "ai"), quote: t.message ? clipQuote(t.message.body, 0, 120) : null };
  }
  return f;
}

const empty = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Which columns may be written, and what is kept instead. Pure.
 *
 * A column is written when it is EMPTY, or when it still holds exactly the
 * value this file wrote last time (`previous`, from conversationEvidence) —
 * that value was ours, not a person's, and a better reading of the same
 * conversation may replace it (a profile name giving way to the name they
 * typed). Anything else a person put there stays, and the conversation's
 * version goes into `skipped` with the value that was kept.
 *
 * @param lead      the LeadRequest row (or null for a new lead)
 * @param fields    buildFieldEvidence()
 * @param previous  lead.conversationEvidence?.fields — what we wrote before
 * @returns { data, intake, written: string[], skipped: [{ field, kept, offered }] }
 */
export function planLeadWrite({ lead = null, fields = {}, previous = {} } = {}) {
  const data = {};
  const written = [];
  const skipped = [];
  const prev = previous && typeof previous === "object" ? previous : {};
  const intake = lead?.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? { ...lead.intake } : {};
  let intakeChanged = false;

  const consider = (field, current, offered, apply) => {
    if (empty(offered)) return;
    if (!empty(current) && String(current) === String(offered)) return; // already says it
    const ours = prev[field] && String(prev[field].value) === String(current);
    if (empty(current) || ours) {
      apply(offered);
      written.push(field);
    } else {
      skipped.push({ field, kept: current, offered });
    }
  };

  consider("name", lead?.name, fields.name?.value, (v) => { data.name = String(v).slice(0, 120); });
  consider("phone", lead?.phone, fields.phone?.value, (v) => { data.phone = String(v).slice(0, 40); });
  const email = fields.email?.value ? cleanEmail(fields.email.value) : null;
  consider("email", lead?.email, email, (v) => { data.email = v; });
  consider("address", intake.address, fields.address?.value, (v) => { intake.address = String(v).slice(0, 200); intakeChanged = true; });
  consider("area", intake.area, fields.area?.value, (v) => { intake.area = String(v).slice(0, 120); intakeChanged = true; });
  consider("service", lead?.categoryId, fields.service?.value, (v) => { data.categoryId = v; });
  consider("timeline", lead?.timeline, cleanTimeline(fields.timeline?.value), (v) => { data.timeline = v; });

  return { data, intake: intakeChanged ? intake : null, written, skipped };
}

/**
 * The lead this conversation already is, if any. Pure.
 *
 * @param leads  open LeadRequest rows of this company (LEAD_SELECT), newest first
 * @param contact { name, email, phone } from the conversation
 * @param participantName  Meta's profile name for the thread
 * @param threadStartedAt  for the lead-ad window
 * @returns {{ lead, how, possible }} — `lead` null when nothing is safe to
 *   join; `possible` lists name-only candidates for the drawer to mention.
 */
export function findDuplicateLead({ leads = [], companyId, contact = {}, participantName = null, threadStartedAt = null } = {}) {
  const rows = (Array.isArray(leads) ? leads : []).filter((l) => l && l.id && l.companyId === companyId);
  const keys = contactKeys({ email: contact.email, phone: contact.phone });
  if (keys.email || keys.phone) {
    const hits = rows
      .map((l) => ({ l, s: scoreCandidate(keys, { name: null, email: l.email, phone: l.phone }) }))
      .filter((x) => x.s.reasons.includes("email") || x.s.reasons.includes("phone"));
    if (hits.length) {
      // Newest first — the rows arrive that way. Two open leads with one
      // number are already one household's duplicate; joining the newest is
      // the one that is being worked.
      return { lead: hits[0].l, how: hits[0].s.reasons.filter((r) => r === "email" || r === "phone"), possible: [] };
    }
  }

  // The lead-ad join — see the header.
  const profile = nameKey(participantName);
  const started = threadStartedAt ? new Date(threadStartedAt).getTime() : null;
  if (profile && profile.includes(" ")) {
    const named = rows.filter((l) => nameKey(l.name) === profile);
    const formLeads = named.filter((l) => {
      if (l.source !== "meta_lead_form") return false;
      if (started === null) return true;
      const made = new Date(l.createdAt).getTime();
      return Number.isFinite(made) && Math.abs(started - made) <= LEAD_AD_JOIN_DAYS * DAY;
    });
    const conflicts = (l) => {
      const theirs = contactKeys({ email: l.email, phone: l.phone });
      return (keys.email && theirs.email && keys.email !== theirs.email) || (keys.phone && theirs.phone && keys.phone !== theirs.phone);
    };
    const clean = formLeads.filter((l) => !conflicts(l));
    if (clean.length === 1) return { lead: clean[0], how: ["profile_name", "lead_form_timing"], possible: [] };
    return { lead: null, how: [], possible: named.slice(0, 3).map((l) => ({ id: l.id, name: l.name })) };
  }
  return { lead: null, how: [], possible: [] };
}

export const LEAD_SELECT = Object.freeze({
  id: true,
  companyId: true,
  name: true,
  email: true,
  phone: true,
  categoryId: true,
  timeline: true,
  intake: true,
  source: true,
  status: true,
  createdAt: true,
  metaCampaignId: true,
  metaCampaignName: true,
  conversationEvidence: true,
  language: true,
});

const firstWords = (messages) => {
  const m = (messages || []).find((x) => x && x.direction === "in" && !x.private && String(x.body || "").trim().length >= MIN_TEXT_FOR_AI);
  return m ? String(m.body).replace(/\s+/g, " ").trim().slice(0, 500) : null;
};

/**
 * The hook lib/messaging/ingest.js calls after a genuinely new inbound
 * message is stored. Never throws; returns what it did, for the log and the
 * check.
 *
 * `deps` are the seams scripts/check-social-leads.mjs drives: prisma, the
 * lead creator, the model call, the campaign lookup, and whether AI exists.
 */
export async function captureLeadFromConversation({ companyId, threadId, businessLine = false, imported = false, allowAi = true, prisma = db, deps = {}, now = new Date() }) {
  const {
    createLead = createScoredLead,
    rescore = rescoreLead,
    extract = extractConversationLead,
    resolveCampaign = resolveCampaignForAd,
    aiConfigured = isAiConfigured,
    reviewRecords = loadReviewRecords,
    rejected: loadRejected = rejectedPairs,
    linkThread = linkThreadToLead,
    linkClient = linkLeadToClient,
    templates = loadTemplateCounts,
    servicesFor = loadQualificationServices,
    followUp = ensureFollowUpTask,
  } = deps;
  try {
    if (!companyId || !threadId) return { acted: false, reason: "missing_ids" };
    const thread = await prisma.messageThread.findFirst({
      where: { id: threadId, companyId },
      select: {
        id: true,
        leadId: true,
        participantName: true,
        participantExternalId: true,
        assignedToId: true,
        routingIntent: true,
        adReferral: true,
        leadCapture: true,
        createdAt: true,
        clientId: true,
        quoteId: true,
        channel: { select: { platform: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: MESSAGES_READ,
          select: { id: true, direction: true, body: true, sentAt: true, attachments: true, private: true, imported: true },
        },
      },
    });
    if (!thread) return { acted: false, reason: "unknown_thread" };
    const platform = thread.channel?.platform || null;
    // A text to the company's own brought business number is captured by the
    // same rules (lib/businessNumber/conversation.js) — but only when the
    // ingest says it arrived on that line. The "sms" platform alone is not
    // enough: the shared FieldQuo line is "sms" too, and only ever carries
    // people already on file.
    const smsBusinessLine = businessLine === true && platform === "sms";
    if (!CAPTURE_PLATFORMS.includes(platform) && !smsBusinessLine) return { acted: false, reason: "not_a_meta_conversation" };

    const messages = (thread.messages || []).slice().reverse();
    const inbound = messages.filter((m) => m.direction === "in" && !m.private);
    const det = deterministicContacts({ messages, platform, participantExternalId: thread.participantExternalId });
    const signature = contactSignature(det);
    const capture = thread.leadCapture && typeof thread.leadCapture === "object" ? thread.leadCapture : null;

    // ── What a person has said this conversation is NOT: a lead ───────────
    //
    // "Delete and don't create a lead from this conversation again"
    // (lib/leads/deleteLead.js). Checked before anything costs anything — no
    // model read, no record scan. Without it the next "thanks!" would rebuild
    // the lead somebody just deleted. A lead a PERSON links to the thread
    // afterwards overrules it (thread.leadId), the same way a person's link
    // stands everywhere else in this file.
    if (isMarkedNotALead(capture) && !thread.leadId) return { acted: false, reason: "marked_not_a_lead" };

    // ── What this conversation is: the tier (lib/leads/qualification.js) ──
    //
    // Free and deterministic: the company's quick-reply templates (one query
    // over its own threads' first messages), its enabled services (labels and
    // keys — never a price), and the messages. A person's tier, and a verdict
    // the model already made on a thread the rules cannot place, are carried
    // by verdictForThread. A failed read makes the rules see no templates and
    // no services; it never stops the capture.
    const services = await Promise.resolve(servicesFor(prisma, companyId)).catch(() => []);
    const templateCounts = await Promise.resolve(templates(prisma, companyId)).catch(() => new Map());
    let rules = verdictForThread(thread, messages, { templateCounts, services: services || [] });

    // ── What a person has already said is NOT this person ─────────────────
    //
    // An undone link (lib/leads/identityLinks.js), and the two undos the
    // inbox already had: a lead this file linked that is no longer linked,
    // and a client the reviewer linked that somebody unlinked. Each is a
    // statement, and re-linking on the next message would overrule it.
    const rejected = await Promise.resolve(loadRejected(prisma, { companyId, threadId: thread.id })).catch(() => new Set());
    const rejectedSet = rejected instanceof Set ? rejected : new Set();
    if (capture?.leadId && !thread.leadId) rejectedSet.add(`lead:${capture.leadId}`);
    if (capture?.review?.wroteClientId && thread.clientId !== capture.review.wroteClientId) rejectedSet.add(`client:${capture.review.wroteClientId}`);

    // History: the newest thing the customer said arrived in a backfill, and
    // is older than a day. See HISTORY_SILENT_AFTER_MS.
    const newestInbound = inbound.length ? inbound[inbound.length - 1] : null;
    const newestAt = newestInbound?.sentAt ? new Date(newestInbound.sentAt).getTime() : null;
    const historyCapture =
      (imported || newestInbound?.imported === true) &&
      (newestAt === null || now.getTime() - newestAt > HISTORY_SILENT_AFTER_MS);

    // ── The lead this already is ───────────────────────────────────────────
    let lead = null;
    let joinedHow = [];
    let possible = [];
    if (thread.leadId) {
      lead = await prisma.leadRequest.findFirst({ where: { id: thread.leadId, companyId }, select: LEAD_SELECT });
      if (lead) joinedHow = ["thread_link"];
    }
    if (!lead) {
      const open = await prisma.leadRequest.findMany({
        where: { companyId, status: { in: ["new", "contacted"] }, createdAt: { gte: new Date(now.getTime() - LEAD_DEDUPE_DAYS * DAY) } },
        select: LEAD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const dup = findDuplicateLead({
        leads: open.filter((l) => !rejectedSet.has(`lead:${l.id}`)),
        companyId,
        contact: { email: det.email?.value, phone: det.phone?.value },
        participantName: thread.participantName,
        threadStartedAt: thread.createdAt,
      });
      lead = dup.lead;
      joinedHow = dup.how;
      possible = dup.possible;
    }

    // ── The model, only where it can change the outcome ─────────────────────
    //
    // The rules could not place the thread (`needsAi`), or it is a lead and
    // the field reading (name, service, timeline) applies. A tap, a
    // not-relevant thread or a rules-decided conversation never pays for a
    // read: that is most of a Page's inbox (TrueFinish: 3 in 4 threads).
    const tierBefore = effectiveTier(rules);
    const aiUseful = rules.needsAi || tierBefore === "lead";
    const ruled = aiUseful
      ? aiRunDecision({
          capture,
          signature,
          inboundChars: inbound.reduce((n, m) => n + String(m.body || "").trim().length, 0),
          inboundCount: inbound.length,
          aiConfigured: aiConfigured(),
        })
      : { run: false, why: `tier_${tierBefore || "none"}` };
    // The backfill decides whether history may spend AI credit at all.
    const decision = ruled.run && !allowAi ? { run: false, why: "history_ai_off" } : ruled;
    let ai = null;
    const runs = Number(capture?.aiRuns) || 0;
    if (decision.run) {
      ai = await extract({
        companyId,
        threadId: thread.id,
        run: runs + 1,
        messages,
        // Label and id only. No rate, no price — the model never sees what
        // the company charges (non-negotiable 4's reasoning, inside).
        services: (services || []).map((s) => ({ id: s.id, label: s.label })),
        hint: thread.routingIntent || null,
        prisma,
      });
    }

    // The model's reading settles a thread the rules asked about, and can
    // veto a rules "lead" that is spam or not work at all — never the other
    // way round, and never a person's tier.
    if (ai?.ok && rules.method !== "person") {
      if (rules.needsAi) rules = applyAiVerdict(rules, ai);
      else if (ai.kind === "spam" || ai.kind === "not_work") rules = applyAiVerdict({ ...rules, needsAi: true }, ai);
    }
    const qualification = storableQualification(rules, { previous: capture?.qualification || null, at: now });
    const tier = effectiveTier(qualification);

    let verdict = decideKind({ ai, routingIntent: thread.routingIntent, capture });
    // A lead by the rules (or by a person) is somebody wanting work, with or
    // without the model — the model's "undetermined" only means it could not
    // tell, and the rules found the detail. A person's tier outranks even a
    // model verdict.
    if (tier === "lead" && !LEAD_KINDS.includes(verdict.kind) && (rules.method === "person" || !verdict.kind || verdict.kind === "undetermined")) {
      verdict = { kind: "work_request", method: rules.method === "person" ? "person" : "rules", reason: reasonInEnglish(rules) || null };
    }
    // …and a not-relevant thread the RULES settled is said in the same
    // vocabulary, so the reviewer and the cost rule read it: spam is "spam"
    // (never read again — aiRunDecision), anything else not relevant is
    // "not_work". Only where nothing better is known.
    if (tier === "not_relevant" && rules.method === "rules" && (!verdict.kind || verdict.kind === "undetermined")) {
      verdict = { kind: rules.reasonKey === "app.leads.tier.reason.spam" ? "spam" : "not_work", method: "rules", reason: reasonInEnglish(rules) || null };
    }
    const fields = buildFieldEvidence({ det, ai, participantName: thread.participantName });
    // No service from the model: the counts name one when the company sells
    // exactly one per-piece cabinet service, or the person said which.
    if (!fields.service && hasCounts(rules.scope)) {
      const typedWords = inbound.map((m) => m.body || "").join(" ");
      const svc = inferService(
        (services || []).map((s) => ({ categoryId: s.id, key: s.key, label: s.label })),
        rules.scope.counts,
        typedWords,
      );
      const src = Object.values(rules.scope.sources || {})[0] || {};
      if (svc) fields.service = { value: svc.categoryId, label: svc.label || null, messageId: src.messageId || null, sentAt: src.sentAt || null, quote: src.quote || null, method: "rules" };
    }
    const scopeStored = storableScope(rules.scope);
    const writtenIn = languageOfText(inbound.filter((m) => !isSystemLine(m.body)).map((m) => m.body || ""));

    // ── The reviewer: who is this, by the records? ────────────────────────
    //
    // Re-read when the model ran, when a new contact detail appeared, or the
    // first time — never on every "ok thanks", because it scans the client
    // list. Free: no model. Failure keeps the previous review.
    const reviewSig = signature.join("|");
    const needsReview = Boolean(ai) || !capture?.review || capture.review.signature !== reviewSig;
    let review = capture?.review || null;
    if (needsReview) {
      const records = await Promise.resolve(
        reviewRecords(prisma, {
          companyId,
          thread,
          platformSource: sourceForPlatform(platform),
          contact: {
            name: fields.name?.method === "profile" ? thread.participantName : fields.name?.value || thread.participantName || null,
            email: fields.email?.value || null,
            phone: fields.phone?.value || null,
            address: fields.address?.value || null,
          },
        }),
      ).catch(() => null);
      // A client somebody unlinked is not this person, whatever the records
      // say — their statement stands (rejectedSet above).
      const conversion = records?.conversion && records.conversion.clientId && rejectedSet.has(`client:${records.conversion.clientId}`) ? null : records?.conversion || null;
      const aiUnavailable = ai && !ai.ok ? ai.reason || "failed" : !ai && ["ai_unconfigured", "history_ai_off"].includes(decision.why) ? decision.why : null;
      const fresh = reviewVerdict({ ai, capture, conversion, clientDocs: records ? records.clientDocs : [], aiUnavailable, decidedKind: verdict.kind });
      review = {
        ...fresh,
        signature: reviewSig,
        reviewedAt: now.toISOString(),
        wroteClientId: capture?.review?.wroteClientId || null,
      };
    }

    // The verdict can veto a NEW lead (a converted person, an existing client
    // with nothing new, a non-lead); it never vetoes enriching one that exists.
    //
    // And only the `lead` tier makes one (2026-10-05). A person who set the
    // tier to lead overrules the model's "not a lead" — never the records'
    // "converted" or "existing client with nothing new".
    const personSaysLead = rules.method === "person" && tier === "lead";
    const wantsLead =
      tier === "lead" &&
      LEAD_KINDS.includes(verdict.kind) &&
      (verdictMakesLead(review) || (personSaysLead && review?.verdict === "not_a_lead"));
    // An existing lead found on an IDENTIFIER (or linked) is enriched without
    // the model's say-so — unless the model has positively said this
    // conversation is not a lead, or the tier says it is a tap or not
    // relevant. Joining on a phone number needs no judgement.
    const enrichOnly = Boolean(lead) && !NO_LEAD_KINDS.includes(verdict.kind) && tier !== "tap_only" && tier !== "not_relevant";

    const nextCapture = {
      kind: verdict.kind,
      kindMethod: verdict.method,
      reason: verdict.reason,
      aiRuns: runs + (ai && (ai.ok || ai.metered) ? 1 : 0),
      lastAiAt: ai && (ai.ok || ai.metered) ? now.toISOString() : capture?.lastAiAt || null,
      lastAiDecision: decision.why,
      lastAiError: ai && !ai.ok ? ai.reason || "failed" : null,
      inboundAtRun: ai && (ai.ok || ai.metered) ? inbound.length : Number(capture?.inboundAtRun) || 0,
      contactsSeen: ai && (ai.ok || ai.metered) ? signature : capture?.contactsSeen || [],
      // The VALUES behind the signature, for lib/leads/identityMatch.js —
      // a form lead arriving later is matched against what this customer typed.
      contacts: {
        phone: det.phone?.value || capture?.contacts?.phone || null,
        email: det.email?.value || capture?.contacts?.email || null,
        address: det.address?.value || capture?.contacts?.address || null,
      },
      leadId: capture?.leadId || null,
      review,
      // The tier, its reason and a person's override (carried).
      qualification,
      // Carried, never dropped: a person's statement outlives a pass that
      // ran only because somebody linked a lead by hand.
      ...(capture?.notALead ? { notALead: capture.notALead } : {}),
      updatedAt: now.toISOString(),
    };

    // Reported only when this pass actually wrote to it — a lead that merely
    // shares a phone with a complaint was looked at, not acted on.
    let leadId = wantsLead || enrichOnly ? lead?.id || null : null;
    let created = false;
    let plan = null;

    if (wantsLead || enrichOnly) {
      const previous = lead?.conversationEvidence?.fields || {};
      plan = planLeadWrite({ lead, fields, previous });
      // The scope the person typed, onto intake.scope — unless a person (or a
      // form) put a scope there that this file did not write.
      if (lead && scopeStored) {
        const ownScope = lead.intake?.scope;
        if (!ownScope || ownScope.from === "conversation") {
          const base = plan.intake || (lead.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? { ...lead.intake } : {});
          if (JSON.stringify(base.scope || null) !== JSON.stringify(scopeStored)) {
            plan.intake = { ...base, scope: scopeStored };
            plan.written.push("scope");
          }
        }
      }

      if (!lead) {
        const name = fields.name?.value || fields.phone?.value || fields.email?.value || null;
        if (!name) {
          nextCapture.lastSkip = "no_identity";
        } else {
          const made = await createLead({
            companyId,
            name: String(name).slice(0, 120),
            email: plan.data.email || undefined,
            phone: plan.data.phone || undefined,
            categoryId: plan.data.categoryId || undefined,
            timeline: plan.data.timeline || undefined,
            // The homeowner's own first words — what `message` holds on every
            // other lead. The model's summary is evidence, shown as such.
            message: firstWords(messages) || undefined,
            // The language they WROTE in, when it is unmistakable
            // (lib/leads/textLanguage.js) — the quote is born in it.
            language: writtenIn || undefined,
            source: sourceForPlatform(platform, "ai_employee"),
            // The scope they typed rides as one of the channel's own details
            // (buildLeadIntake drops it when null).
            intake: buildLeadIntake({ address: fields.address?.value, details: { area: fields.address ? null : fields.area?.value, scope: scopeStored } }) || undefined,
            // History is filed, not announced — see HISTORY_SILENT_AFTER_MS.
            ...(historyCapture ? { importedAt: now } : {}),
          });
          leadId = made?.id || null;
          created = Boolean(leadId);
          lead = made ? { ...made, conversationEvidence: null } : null;
        }
      }

      if (leadId) {
        const priorEvidence = lead?.conversationEvidence && typeof lead.conversationEvidence === "object" ? lead.conversationEvidence : {};
        const writtenFields = { ...(priorEvidence.fields || {}) };
        for (const f of plan.written) {
          if (fields[f]) writtenFields[f] = serialiseEvidence(fields[f]);
        }

        // The campaign that paid for the click, when Meta said which ad.
        let campaign = priorEvidence.campaign || null;
        const update = {};
        const adId = thread.adReferral?.adId || null;
        if (adId && !lead?.metaCampaignId) {
          const resolved = await resolveCampaign({ companyId, adId }).catch(() => null);
          if (resolved?.campaignId) {
            update.metaCampaignId = String(resolved.campaignId);
            update.metaCampaignName = resolved.campaignName ? String(resolved.campaignName) : null;
          }
          campaign = { adId, adTitle: thread.adReferral?.adTitle || null, campaignId: resolved?.campaignId || null, campaignName: resolved?.campaignName || null };
        } else if (adId) {
          campaign = campaign || { adId, adTitle: thread.adReferral?.adTitle || null, campaignId: lead.metaCampaignId, campaignName: lead.metaCampaignName || null };
        }

        const evidence = {
          threadId: thread.id,
          platform,
          kind: verdict.kind,
          kindMethod: verdict.method,
          // The tier the conversation had when this pass wrote — the board's
          // review action re-reads the thread for the current one.
          tier,
          summary: ai?.ok ? ai.summary : priorEvidence.summary || null,
          fields: writtenFields,
          // What the conversation said that a person had already answered
          // differently — kept, shown, never written. Replaced each pass so it
          // describes the lead as it stands.
          skipped: created ? [] : plan.skipped.map((s) => ({ ...s, evidence: fields[s.field] ? serialiseEvidence(fields[s.field]) : null })),
          photos: det.photos,
          campaign,
          joinedOn: created ? null : joinedHow,
          possibleDuplicates: possible,
          // The reviewer's verdict and what it rests on, for the drawer.
          // Numbers stripped — see reviewForLead.
          review: review ? reviewForLead(review) : priorEvidence.review || null,
          updatedAt: now.toISOString(),
        };

        await prisma.leadRequest.update({
          where: { id: leadId },
          data: {
            ...(created ? {} : plan.data),
            ...(!created && plan.intake ? { intake: plan.intake } : {}),
            ...update,
            ...(!created && !lead?.language && writtenIn ? { language: writtenIn } : {}),
            conversationEvidence: evidence,
          },
          select: { id: true },
        });
        if (!created && (plan.written.length || update.metaCampaignId)) {
          await Promise.resolve(rescore(leadId)).catch(() => null);
        }

        // Link the thread — only where nobody has. A person's link stands.
        // A join MADE BY MATCHING (a phone, an email, a profile name) is also
        // recorded as a link row, so the lead drawer can show why and offer
        // "Not the same person"; a lead this pass created, or the thread's
        // own link, needs no such row.
        const matchedJoin = !created && joinedHow.length && !joinedHow.includes("thread_link");
        const pointed = await prisma.messageThread.updateMany({ where: { id: thread.id, companyId, leadId: null }, data: { leadId } });
        if (matchedJoin) {
          const wroteFields = {};
          for (const f of plan?.written || []) {
            const col = f === "service" ? "categoryId" : f;
            if (["name", "phone", "email", "categoryId", "timeline"].includes(col) && col in (plan?.data || {})) {
              wroteFields[col] = { before: lead?.[col] ?? null, after: plan.data[col] };
            }
          }
          await Promise.resolve(
            linkThread(prisma, {
              companyId,
              threadId: thread.id,
              leadId,
              match: { confidence: joinedHow.includes("phone") || joinedHow.includes("email") ? "certain" : "likely", matchedOn: joinedHow, why: null },
              method: ai?.ok ? "ai" : "deterministic",
              wroteFields,
              pointed: Boolean(pointed?.count),
            }),
          ).catch(() => null);
        }
        nextCapture.leadId = leadId;

        // A known client asking for new work: tie the lead to them, so the
        // quote it becomes reuses the client (lib/leads/convertLead.js).
        const clientId = review?.evidence?.client?.id || null;
        if (clientId && !rejectedSet.has(`client:${clientId}`)) {
          await Promise.resolve(
            linkClient(prisma, {
              companyId,
              leadId,
              clientId,
              threadId: thread.id,
              match: { confidence: "certain", matchedOn: review.evidence.client.matchedOn || [], why: null },
              method: review.method,
              documents: review.evidence.documents || [],
            }),
          ).catch(() => null);
        }
      }
    }

    // ── No lead, because the records say who this is ──────────────────────
    //
    // A converted person or an existing client with nothing new: the thread
    // is pointed at the client (only when nobody pointed it anywhere — a
    // person's link stands), and that is remembered, so unlinking it in the
    // inbox is an undo this file will respect.
    const reviewClient = review?.evidence?.client?.id || null;
    if (!leadId && reviewClient && !thread.clientId && (review.verdict === "converted" || review.verdict === "existing_client") && !rejectedSet.has(`client:${reviewClient}`)) {
      const pointed = await prisma.messageThread
        .updateMany({ where: { id: thread.id, companyId, clientId: null }, data: { clientId: reviewClient } })
        .catch(() => null);
      if (pointed?.count) nextCapture.review = { ...review, wroteClientId: reviewClient };
    }
    if (!leadId && wantsLead === false && LEAD_KINDS.includes(verdict.kind) && review && !verdictMakesLead(review)) {
      nextCapture.lastSkip = `review_${review.verdict}`;
    }

    await prisma.messageThread.update({ where: { id: thread.id }, data: { leadCapture: nextCapture } });

    // ── "I'll get in touch when I'm back" → a dated follow-up ──────────────
    //
    // After the capture is stored, best effort: a reminder that could not be
    // written must never cost the message or the lead. Not for a tap or a
    // not-relevant thread, and not for a promise older than
    // FOLLOW_UP_LOOKBACK_DAYS (a history backfill reaching back a year must
    // not bury the office in last winter's "maybe in spring").
    let followUpTask = null;
    if (tier !== "tap_only" && tier !== "not_relevant") {
      const pending = pendingFollowUp(messages);
      const said = pending?.sentAt ? new Date(pending.sentAt).getTime() : null;
      if (pending && (said === null || now.getTime() - said <= FOLLOW_UP_LOOKBACK_DAYS * DAY)) {
        followUpTask = await Promise.resolve(
          followUp(prisma, {
            companyId,
            threadId: thread.id,
            leadId: leadId || thread.leadId || null,
            clientId: thread.clientId || null,
            assignedToId: thread.assignedToId || null,
            name: (fields.name?.method === "profile" ? thread.participantName : fields.name?.value) || thread.participantName || null,
            intent: pending,
            now,
          }),
        ).catch(() => null);
      }
    }

    return {
      acted: Boolean(leadId),
      created,
      leadId,
      tier,
      followUp: followUpTask ? { id: followUpTask.id ?? null, dueDate: followUpTask.dueDate ?? null, created: Boolean(followUpTask.created) } : null,
      kind: verdict.kind,
      aiRan: Boolean(ai),
      decision: decision.why,
      written: plan?.written || [],
      skipped: plan?.skipped || [],
      review: review ? review.verdict : null,
      history: historyCapture,
    };
  } catch (err) {
    console.error("[conversationLead] capture failed:", err?.message);
    return { acted: false, reason: "error" };
  }
}

/** Evidence as stored: the message's id and time, never the Message row. */
function serialiseEvidence(e) {
  return {
    value: e.value ?? null,
    ...(e.label ? { label: e.label } : {}),
    messageId: e.messageId ?? null,
    sentAt: e.sentAt ? new Date(e.sentAt).toISOString() : null,
    quote: e.quote ?? null,
    method: e.method ?? null,
  };
}
