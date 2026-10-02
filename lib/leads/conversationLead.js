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
export async function captureLeadFromConversation({ companyId, threadId, prisma = db, deps = {}, now = new Date() }) {
  const {
    createLead = createScoredLead,
    rescore = rescoreLead,
    extract = extractConversationLead,
    resolveCampaign = resolveCampaignForAd,
    aiConfigured = isAiConfigured,
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
        routingIntent: true,
        adReferral: true,
        leadCapture: true,
        createdAt: true,
        channel: { select: { platform: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: MESSAGES_READ,
          select: { id: true, direction: true, body: true, sentAt: true, attachments: true, private: true },
        },
      },
    });
    if (!thread) return { acted: false, reason: "unknown_thread" };
    const platform = thread.channel?.platform || null;
    if (!CAPTURE_PLATFORMS.includes(platform)) return { acted: false, reason: "not_a_meta_conversation" };

    const messages = (thread.messages || []).slice().reverse();
    const inbound = messages.filter((m) => m.direction === "in" && !m.private);
    const det = deterministicContacts({ messages, platform, participantExternalId: thread.participantExternalId });
    const signature = contactSignature(det);
    const capture = thread.leadCapture && typeof thread.leadCapture === "object" ? thread.leadCapture : null;

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
        leads: open,
        companyId,
        contact: { email: det.email?.value, phone: det.phone?.value },
        participantName: thread.participantName,
        threadStartedAt: thread.createdAt,
      });
      lead = dup.lead;
      joinedHow = dup.how;
      possible = dup.possible;
    }

    // ── The model, when the cost rule allows ──────────────────────────────
    const decision = aiRunDecision({
      capture,
      signature,
      inboundChars: inbound.reduce((n, m) => n + String(m.body || "").trim().length, 0),
      inboundCount: inbound.length,
      aiConfigured: aiConfigured(),
    });
    let ai = null;
    const runs = Number(capture?.aiRuns) || 0;
    if (decision.run) {
      const services = await prisma.companyServiceCategory
        .findMany({
          // Label and id only. No rate, no price — the model never sees what
          // the company charges (non-negotiable 4's reasoning, inside).
          where: { companyId, enabled: true },
          select: { category: { select: { id: true, label: true } } },
        })
        .then((rows) => rows.map((r) => r.category).filter(Boolean))
        .catch(() => []);
      ai = await extract({
        companyId,
        threadId: thread.id,
        run: runs + 1,
        messages,
        services,
        hint: thread.routingIntent || null,
        prisma,
      });
    }

    const verdict = decideKind({ ai, routingIntent: thread.routingIntent, capture });
    const fields = buildFieldEvidence({ det, ai, participantName: thread.participantName });
    const wantsLead = LEAD_KINDS.includes(verdict.kind);
    // An existing lead found on an IDENTIFIER (or linked) is enriched without
    // the model's say-so — unless the model has positively said this
    // conversation is not a lead. Joining on a phone number needs no judgement.
    const enrichOnly = Boolean(lead) && !NO_LEAD_KINDS.includes(verdict.kind);

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
      leadId: capture?.leadId || null,
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
            source: sourceForPlatform(platform, "ai_employee"),
            intake: buildLeadIntake({ address: fields.address?.value, details: { area: fields.address ? null : fields.area?.value } }) || undefined,
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
          updatedAt: now.toISOString(),
        };

        await prisma.leadRequest.update({
          where: { id: leadId },
          data: {
            ...(created ? {} : plan.data),
            ...(!created && plan.intake ? { intake: plan.intake } : {}),
            ...update,
            conversationEvidence: evidence,
          },
          select: { id: true },
        });
        if (!created && (plan.written.length || update.metaCampaignId)) {
          await Promise.resolve(rescore(leadId)).catch(() => null);
        }

        // Link the thread — only where nobody has. A person's link stands.
        await prisma.messageThread.updateMany({ where: { id: thread.id, companyId, leadId: null }, data: { leadId } });
        nextCapture.leadId = leadId;
      }
    }

    await prisma.messageThread.update({ where: { id: thread.id }, data: { leadCapture: nextCapture } });
    return {
      acted: Boolean(leadId),
      created,
      leadId,
      kind: verdict.kind,
      aiRan: Boolean(ai),
      decision: decision.why,
      written: plan?.written || [],
      skipped: plan?.skipped || [],
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
