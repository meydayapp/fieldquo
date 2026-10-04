// lib/leads/identityMatch.js
//
// "Is this Facebook lead somebody we already have?" — asked of a lead-form
// submission when it arrives, against the open leads on the board, the
// Messenger / Instagram conversations in the inbox, and the clients on file.
//
// ══ Why a second matcher exists at all ═════════════════════════════════════
//
// lib/contacts/matchContact.js answers "which CLIENT is this?" and is reused
// here for every comparison (scoreCandidate — one phone normaliser, one name
// folder, one address key). What it cannot answer is the question the owner
// asked on 2026-10-03: a homeowner taps a lead ad, fills the form, and then
// messages the Page too — "FB leads are pretty bad and deceptive", and the
// board showed that one person as two leads. So this file runs the same
// comparison over THREE kinds of record and says which one, if any, the new
// form lead should be folded into instead of becoming a second lead.
//
// ══ What links, and what is only shown ═════════════════════════════════════
//
//   psid      the Meta id of the person (PSID on Messenger, IGSID on
//             Instagram) — the same id on both sides, same platform. Meta
//             issued it; nobody typed it. Certain. (A lead-form payload does
//             not carry one, so this fires for conversation-to-conversation
//             and for leads a conversation already produced.)
//   email     an exact email. Certain — the same rule matchContact applies.
//   phone     an exact number, AND the names do not disagree. The family
//             landline is the ordinary case for a trade: "John Smith" and
//             "Mary Smith" share one number and can be two enquiries, so a
//             phone with names that disagree is only POSSIBLE — shown on the
//             lead, never linked. A phone with one side unnamed links.
//   name + address   a full name AND an agreeing address, with no conflict.
//             Likely — links. Same name, different address: a conflict, and
//             two people until somebody says otherwise.
//   name alone       possible. Never links.
//
// A tie — two leads that match equally — links neither: picking one would
// attach a stranger to the wrong household with nothing downstream able to
// notice (matchContact's lesson 2, inherited).
//
// A pair somebody already pressed "Not the same person" on is excluded
// (`rejected`), so the matcher never proposes it again.
//
// Pure: rows in, decision out. Executed against hostile input (emoji names, a
// shared family phone, same name at two addresses, missing phone, another
// tenant's row) by scripts/check-meta-history.mjs.
import { contactKeys, scoreCandidate, nameKey, namesClose } from "@/lib/contacts/matchContact";

/** The tiers that link. Anything weaker is only shown. */
export const LINK_CONFIDENCE = Object.freeze(["certain", "likely"]);

/** Kinds of record a form lead can be matched to, strongest home first. */
export const TARGET_KINDS = Object.freeze(["lead", "thread", "client"]);

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A lead row's address, wherever the writer put it. */
export function leadAddress(lead) {
  const intake = lead?.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? lead.intake : {};
  const fromEvidence = lead?.conversationEvidence?.fields?.address?.value;
  return (
    [str(intake.address), str(intake.city), str(intake.province), str(intake.postalCode)].filter(Boolean).join(", ") ||
    str(fromEvidence) ||
    null
  );
}

/**
 * Do two names DISAGREE? Not "fail to agree" — both must be present (after
 * folding: an emoji-only display name is no name), and neither the same name
 * nor one typo away. Pure.
 */
export function namesDisagree(a, b) {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return false;
  return !namesClose(a, b);
}

/**
 * Score one candidate. Reuses matchContact's scoreCandidate for email, phone,
 * name and address, then applies the two rules this file adds: the Meta id,
 * and the family phone.
 */
export function scoreIdentity(incoming, candidate) {
  const keys = contactKeys({ name: incoming.name, email: incoming.email, phone: incoming.phone, address: incoming.address });
  const base = scoreCandidate(keys, { name: candidate.name, email: candidate.email, phone: candidate.phone, address: candidate.address }, { tolerantNames: true });
  const reasons = [...base.reasons];
  const conflicts = [...base.conflicts];
  let confidence = base.confidence;
  let score = base.score;

  const samePsid =
    str(incoming.psid) && str(candidate.psid) && incoming.psid === candidate.psid &&
    (!incoming.platform || !candidate.platform || incoming.platform === candidate.platform);
  if (samePsid) {
    reasons.unshift("psid");
    score += 200;
    confidence = "certain";
  } else if (reasons.includes("phone") && !reasons.includes("email") && namesDisagree(incoming.name, candidate.name)) {
    // The family landline. Recorded as a conflict so the drawer can say why
    // it did not link.
    conflicts.push("name");
    confidence = "possible";
    score -= 40;
  }
  return { score, confidence, reasons, conflicts };
}

/**
 * Decide. Pure.
 *
 * @param companyId  every candidate row is re-checked against it — a row from
 *                   another tenant is dropped even if a query returned it.
 * @param incoming   { name, email, phone, address, psid?, platform? }
 * @param leads      open LeadRequest rows: { id, companyId, name, email,
 *                   phone, intake, conversationEvidence, createdAt, psid?,
 *                   platform? }
 * @param threads    MessageThread rows: { id, companyId, leadId,
 *                   participantName, participantExternalId, platform,
 *                   contacts: { email, phone, address } } — contacts are what
 *                   the CUSTOMER typed, read by lib/leads/conversationLead.js's
 *                   deterministicContacts
 * @param clients    CLIENT_MATCH_SELECT rows
 * @param rejected   Set of "lead:<id>" / "thread:<id>" / "client:<id>" a
 *                   person has said is NOT this person
 *
 * @returns {{ kind: "lead"|"thread"|"client"|null, id: string|null,
 *             leadId: string|null, confidence, matchedOn: string[],
 *             conflicts: string[], why: string, possible: object[],
 *             ambiguous: boolean }}
 */
export function matchLeadIdentity({ companyId, incoming = {}, leads = [], threads = [], clients = [], rejected = new Set() } = {}) {
  if (!companyId) throw new Error("matchLeadIdentity: companyId is required — a match is always tenant-scoped");
  const none = (why, possible = []) => ({ kind: null, id: null, leadId: null, confidence: "none", matchedOn: [], conflicts: [], why, possible, ambiguous: false });

  const keys = contactKeys({ name: incoming.name, email: incoming.email, phone: incoming.phone, address: incoming.address });
  if (keys.isEmpty && !str(incoming.psid)) return none("Nothing to match on: no name, email, phone, address or Meta id.");

  const own = (r) => r && r.id && r.companyId === companyId;
  const candidates = [];
  for (const l of leads || []) {
    if (!own(l) || rejected.has(`lead:${l.id}`)) continue;
    candidates.push({ kind: "lead", id: l.id, leadId: l.id, name: l.name, email: l.email, phone: l.phone, address: leadAddress(l), psid: l.psid || null, platform: l.platform || null, label: l.name || null });
  }
  for (const t of threads || []) {
    if (!own(t) || rejected.has(`thread:${t.id}`)) continue;
    // A thread that already belongs to a lead is that lead — matched once, as
    // the lead, so the same person is not counted twice and tied with
    // themselves.
    if (t.leadId && candidates.some((c) => c.kind === "lead" && c.id === t.leadId)) {
      const c = candidates.find((x) => x.kind === "lead" && x.id === t.leadId);
      c.psid = c.psid || str(t.participantExternalId);
      c.platform = c.platform || t.platform || null;
      c.email = c.email || t.contacts?.email || null;
      c.phone = c.phone || t.contacts?.phone || null;
      c.address = c.address || t.contacts?.address || null;
      continue;
    }
    if (t.leadId && rejected.has(`lead:${t.leadId}`)) continue;
    candidates.push({
      kind: "thread",
      id: t.id,
      leadId: t.leadId || null,
      name: t.participantName,
      email: t.contacts?.email || null,
      phone: t.contacts?.phone || null,
      address: t.contacts?.address || null,
      psid: str(t.participantExternalId),
      platform: t.platform || null,
      label: t.participantName || null,
    });
  }
  for (const c of clients || []) {
    if (!own(c) || rejected.has(`client:${c.id}`)) continue;
    candidates.push({
      kind: "client",
      id: c.id,
      leadId: null,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: [c.address, c.city, c.province].filter(Boolean).join(", ") || null,
      psid: null,
      platform: null,
      label: c.name || null,
    });
  }

  const scored = candidates
    .map((c) => ({ c, ...scoreIdentity(incoming, c) }))
    .filter((s) => s.confidence !== "none")
    .sort((a, b) => b.score - a.score || TARGET_KINDS.indexOf(a.c.kind) - TARGET_KINDS.indexOf(b.c.kind));

  const possible = scored
    .filter((s) => !LINK_CONFIDENCE.includes(s.confidence))
    .slice(0, 3)
    .map((s) => ({ kind: s.c.kind, id: s.c.id, name: s.c.label, confidence: s.confidence, reasons: s.reasons, conflicts: s.conflicts }));

  const linkable = scored.filter((s) => LINK_CONFIDENCE.includes(s.confidence));
  if (!linkable.length) {
    return none(possible.length ? "Only a possible match — not enough to say it is the same person." : "Nobody on file is this person.", possible);
  }

  // The strongest home: a lead beats a thread beats a client at the SAME
  // tier, because the lead is where the work is being done. A tie inside the
  // best kind refuses.
  // The strongest TIER present, not the top score: a phone match carrying an
  // email conflict scores below a name-and-address match and is still the
  // stronger evidence (matchContact's confidenceFor says why).
  const bestTier = linkable.some((s) => s.confidence === "certain") ? "certain" : "likely";
  const top = linkable.filter((s) => s.confidence === bestTier);
  const kind = TARGET_KINDS.find((k) => top.some((s) => s.c.kind === k));
  const ofKind = top.filter((s) => s.c.kind === kind).sort((a, b) => b.score - a.score);
  const best = ofKind[0];
  const tied = ofKind.filter((s) => s.score === best.score);
  if (tied.length > 1) {
    return {
      ...none(`${tied.length} ${kind}s match equally well (${best.reasons.join(" + ")}) — somebody has to choose.`, tied.slice(0, 3).map((s) => ({ kind: s.c.kind, id: s.c.id, name: s.c.label, confidence: s.confidence, reasons: s.reasons, conflicts: s.conflicts }))),
      ambiguous: true,
    };
  }
  return {
    kind,
    id: best.c.id,
    leadId: best.c.leadId,
    confidence: best.confidence,
    matchedOn: best.reasons,
    conflicts: best.conflicts,
    why: `${best.c.label || "A record"} matches on ${best.reasons.join(" + ")}${best.conflicts.length ? ` (${best.conflicts.join(", ")} differ)` : ""}.`,
    possible,
    ambiguous: false,
  };
}

/**
 * Which columns of the surviving lead a folded-in form lead may fill — only
 * EMPTY ones, and each recorded with what it was before so an undo can put it
 * back. Pure.
 *
 * @returns {{ data: object, wrote: { [field]: { before, after } } }}
 */
export function planFoldIn(lead, mapped) {
  const data = {};
  const wrote = {};
  const empty = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim());
  if (empty(lead?.phone) && str(mapped?.phone)) {
    data.phone = String(mapped.phone).slice(0, 40);
    wrote.phone = { before: lead?.phone ?? null, after: data.phone };
  }
  if (empty(lead?.email) && str(mapped?.email)) {
    data.email = String(mapped.email).trim().toLowerCase();
    wrote.email = { before: lead?.email ?? null, after: data.email };
  }
  return { data, wrote };
}
