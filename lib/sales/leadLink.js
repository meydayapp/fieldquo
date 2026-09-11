// lib/sales/leadLink.js
//
// "This prospect is that company" — decided from the email the company
// registered with, never from a list.
//
// ══ What went wrong, and why the list is gone ═════════════════════════════
//
// The lead screen used to offer "every company attributed to you that no lead
// claims yet" and let the rep pick. On 2026-09-11 the owner's lead "truefinish
// cabinets" (emilio.boves@…) got linked to "Easy Roofers Inc." (sierra_…@…)
// because Easy Roofers was the ONLY candidate on the list. Nothing compared
// the two emails; the screen showed a "same email" hint that the write never
// read. A list that offers one wrong thing is a control that appears to work
// and doesn't — AGENTS.md's first rule.
//
// So the rep now types the email the client registered with, and FieldQuo
// looks the company up by exactly that. There is no prefix search and no
// "did you mean": a rep who does not know the email has not been told by the
// client that they signed up, and guessing at addresses is how a rep finds
// somebody else's customer.
//
// ══ What this decides, and in what order ══════════════════════════════════
//
//   not_found                  no company registered with that email
//   lead_already_linked        this lead already points at a company
//   demo_company               the email names a demo tenant — a fixture,
//                              not a sale
//   already_linked_to_lead     another lead (any rep's) already holds it
//   self_deal                  the rep is the company — same rule, same
//                              function, as the attribution sources
//   attributed_to_another_rep  a colleague brought them in
//   signed_up_before_lead      the anti-gaming rule (see attribution.js)
//   ok_already_yours           attributed to this rep already; link only
//   referral_code              the company arrived through a referral —
//                              nobody's sale to claim
//   ok_unclaimed               link, and attribute to this rep
//
// The two ok_ reasons differ in what gets WRITTEN, and the order between
// ok_already_yours and referral_code is deliberate: a company already
// attributed to this rep is a fact the attribution table holds, and the link
// is the rep's own bookkeeping catching up to it — a referral code on such a
// row does not make the bookkeeping wrong. The code refuses only a fresh
// CLAIM, because a referred signup is the referrer's, not a rep's.
//
// ══ When one email names several companies ════════════════════════════════
//
// It happens — the owner's own address is on two. The company a lead led to
// is the FIRST signup after the lead was created; earlier ones predate the
// lead and later ones are a second business the same person started. If no
// signup follows the lead, the newest is reported as signed_up_before_lead so
// the rep learns the honest thing: this address was already a customer.
//
// ══ Pure, and executed ════════════════════════════════════════════════════
//
// decideLeadLink() and decideUnlink() take rows and return verdicts; nothing
// here below the fold reads `db` except through an injected client, so
// scripts/check-sales-lead-link.mjs runs every branch under bare node. Same
// shape and same reason as lib/sales/attribution.js.

import {
  captureAttributionWithin,
  emailMatchesCompany,
  leadPredatesCompany,
  selfDealReason,
} from "./attribution";

// The vocabulary lives in leadLinkReasons.js so the screen can import it
// without this module's database import. Re-exported so server code and the
// check script have one place to read it from.
export {
  LEAD_LINK_REASONS,
  UNLINK_REFUSALS,
  UNLINK_WINDOW_MS,
  LEAD_LINK_REASON_KEYS,
} from "./leadLinkReasons";
import { UNLINK_WINDOW_MS } from "./leadLinkReasons";

/** Trimmed, lower-cased, or "" — the only shape an email is compared in. */
export function normaliseEmail(raw) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * The company a lead led to, out of every company the email names.
 *
 * The first signup AFTER the lead was created — see the header. Returns
 * `{ company, predates }`: `predates` false means every match signed up
 * before (or at the same instant as) the lead, and `company` is then the
 * newest of them so the refusal can be specific.
 */
export function pickSignup(lead, companies) {
  const rows = (Array.isArray(companies) ? companies : []).filter(Boolean);
  if (!rows.length) return { company: null, predates: false };
  const time = (c) => (c.createdAt instanceof Date ? c.createdAt.getTime() : Date.parse(c.createdAt));
  const sorted = [...rows].sort((a, b) => time(a) - time(b));
  const after = sorted.find((c) => leadPredatesCompany(lead?.createdAt, c.createdAt));
  if (after) return { company: after, predates: true };
  return { company: sorted[sorted.length - 1], predates: false };
}

function verdict(reason, company = null) {
  const eligible = reason.startsWith("ok_");
  return {
    found: reason !== "not_found" && reason !== "lead_already_linked",
    eligible,
    reason,
    // The name is returned ONLY on an eligible verdict. A rep who fails the
    // gate learns that the address is taken and nothing about whose it is —
    // "attributed to another rep" plus a company name is a colleague's
    // customer list, one email at a time.
    company: eligible && company ? { id: company.id, name: company.name, createdAt: company.createdAt } : null,
    // What the write must do. Explicit so the db half never re-derives an
    // action from a reason string — the two copies of a rule that drift.
    writes: { link: eligible, attribution: reason === "ok_unclaimed" },
  };
}

/**
 * The whole decision, as one pure function.
 *
 * @param {object} args
 * @param {string} args.email       what the rep typed.
 * @param {object} args.lead        { id, createdAt, convertedCompanyId }
 * @param {object} args.rep         the signed-in SalesRep row.
 * @param {object[]} args.companies every company whose registered email is
 *   `email`, each as { id, name, email, ownerEmails, createdAt, isDemo,
 *   referredByCode, attribution: { salesRepId } | null, repIsMember,
 *   linkedLeadId: string | null }.
 */
export function decideLeadLink({ email, lead, rep, companies = [] }) {
  const typed = normaliseEmail(email);
  if (!typed || !lead) return verdict("not_found");
  if (lead.convertedCompanyId) return verdict("lead_already_linked");

  // Re-matched here even though the loader queried by this email: the loader
  // is a database predicate and this is the rule, and a loader widened to a
  // prefix search tomorrow must not turn into a link.
  const matches = companies.filter((c) => emailMatchesCompany(typed, c));
  const { company, predates } = pickSignup(lead, matches);
  if (!company) return verdict("not_found");

  if (company.isDemo) return verdict("demo_company", company);
  if (company.linkedLeadId && company.linkedLeadId !== lead.id) {
    return verdict("already_linked_to_lead", company);
  }

  // The same function the attribution sources use, on the same two signals.
  // A rep who is a member of the company they are linking is refused here
  // whether or not the attribution write would have caught it, because
  // ok_already_yours writes no attribution and would otherwise slip past.
  // (An inactive rep never reaches this: requireOutreachRep refuses them at
  // the door, and captureAttributionWithin refuses them again on the write.)
  if (selfDealReason({ rep, company, repIsMember: company.repIsMember })) {
    return verdict("self_deal", company);
  }

  const existing = company.attribution || null;
  if (existing && existing.salesRepId !== rep.id) return verdict("attributed_to_another_rep", company);
  if (!predates) return verdict("signed_up_before_lead", company);
  if (existing) return verdict("ok_already_yours", company);
  if (typeof company.referredByCode === "string" && company.referredByCode.trim()) {
    return verdict("referral_code", company);
  }
  return verdict("ok_unclaimed", company);
}

/**
 * May this rep undo the link themselves?
 *
 * `convertedAt` absent refuses: the window is measured from it, and a link
 * with no date cannot be shown to be inside any window. That is the same
 * "absence is not a statement" rule as everywhere else in this repo, and the
 * refusal names it so a superadmin knows which kind of row they are looking at.
 */
export function decideUnlink({ lead, now = new Date() }) {
  if (!lead?.convertedCompanyId) return { allowed: false, reason: "not_linked" };
  const at = lead.convertedAt instanceof Date ? lead.convertedAt.getTime() : Date.parse(lead.convertedAt);
  if (!Number.isFinite(at)) return { allowed: false, reason: "no_link_date" };
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const age = nowMs - at;
  // A link dated in the future is not "inside the window" — it is a clock
  // somebody got wrong, and the safe reading is that it cannot be undone
  // here. Zero age (same instant) is allowed; the window is inclusive.
  if (!Number.isFinite(age) || age < 0 || age > UNLINK_WINDOW_MS) {
    return { allowed: false, reason: "window_expired" };
  }
  return { allowed: true, reason: null };
}

/**
 * The status a lead returns to when its link is undone.
 *
 * In order: the lead's CURRENT status if it is no longer "signed" — the rep
 * has already moved it since the link (the wrong row of 2026-09-11 read
 * "demoed" while linked), and an unlink must not undo that; then the
 * recorded pre-link status when there is one and it is not "signed"; then
 * "contacted", because a lead somebody tried to link had at least been
 * spoken to. The fallback is never "new": that would erase the conversation
 * the link was the end of. A RECORDED "new" is restored as recorded — it is
 * the history, not a guess.
 */
export function statusAfterUnlink(previous, current = "signed") {
  if (typeof current === "string" && current && current !== "signed") return current;
  if (typeof previous === "string" && previous && previous !== "signed") return previous;
  return "contacted";
}

// ── The db half ────────────────────────────────────────────────────────────
//
// Both take the client as an argument (`tx`) rather than importing `db`, so a
// check script can drive them with a scripted client — lib/sales/attribution.js
// and lib/marketing/unsubscribe.js make the same choice for the same reason.
// The route owns the transaction and the P2002 retry.

/**
 * Every company the email names, shaped for decideLeadLink().
 *
 * ONE lookup, exact email, both addresses: Company.email OR an owner-role
 * member's login email. No prefix, no LIKE — see the header. Bounded: an
 * address on more than ten companies is not a real prospect, it is a test
 * account, and the decision needs only the ones around the lead's date.
 */
export async function loadLinkCandidates(tx, { email, rep }) {
  const typed = normaliseEmail(email);
  if (!typed) return [];
  const rows = await tx.company.findMany({
    where: {
      OR: [
        { email: { equals: typed, mode: "insensitive" } },
        { members: { some: { role: "owner", user: { email: { equals: typed, mode: "insensitive" } } } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      isDemo: true,
      referredByCode: true,
      salesAttribution: { select: { salesRepId: true } },
      members: {
        // Owner addresses for the match; the rep's own address for the
        // self-deal signal. One relation read, filtered twice below.
        where: {
          OR: [
            { role: "owner" },
            ...(rep?.email ? [{ user: { email: { equals: rep.email, mode: "insensitive" } } }] : []),
          ],
        },
        select: { role: true, user: { select: { email: true } } },
      },
    },
  });
  if (!rows.length) return [];

  // No relation from SalesLead.convertedCompanyId to Company, so "does a lead
  // already hold this company" is a second read — across EVERY rep's leads,
  // because the column is @unique across all of them and the refusal must
  // not depend on whose lead it is.
  const held = await tx.salesLead.findMany({
    where: { convertedCompanyId: { in: rows.map((r) => r.id) } },
    select: { id: true, convertedCompanyId: true },
  });
  const heldBy = new Map(held.map((l) => [l.convertedCompanyId, l.id]));
  const repEmail = normaliseEmail(rep?.email);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    createdAt: r.createdAt,
    isDemo: Boolean(r.isDemo),
    referredByCode: r.referredByCode,
    ownerEmails: (r.members || []).filter((m) => m.role === "owner").map((m) => m.user?.email).filter(Boolean),
    attribution: r.salesAttribution ? { salesRepId: r.salesAttribution.salesRepId } : null,
    repIsMember: Boolean(repEmail) && (r.members || []).some((m) => normaliseEmail(m.user?.email) === repEmail),
    linkedLeadId: heldBy.get(r.id) || null,
  }));
}

/**
 * Link, inside a transaction the caller owns.
 *
 * Re-decides from rows read HERE — the GET that showed the verdict is a
 * different request and may be minutes old. Returns the verdict either way;
 * `linked` is set only when the write happened. Throws to roll back when the
 * attribution write disagrees with the decision, because a lead marked
 * "signed" against a company nobody is credited for is the disagreement this
 * whole module exists to remove.
 */
export async function linkLeadWithin(tx, { email, lead, rep, now = new Date() }) {
  const companies = await loadLinkCandidates(tx, { email, rep });
  const v = decideLeadLink({ email, lead, rep, companies });
  if (!v.writes.link) return { ...v, linked: null };

  // Read BEFORE the update: the event records what the link overwrote, and a
  // caller that hands in the live row would otherwise see "signed" here.
  const statusBefore = lead.status || null;
  const { count } = await tx.salesLead.updateMany({
    // `convertedCompanyId: null` makes this a compare-and-set rather than a
    // read-then-write, so two clicks a moment apart cannot both win.
    where: { id: lead.id, salesRepId: rep.id, convertedCompanyId: null },
    data: {
      convertedCompanyId: v.company.id,
      convertedAt: now,
      // A signup IS the pipeline reaching its end. Set rather than left to
      // the rep to remember, because a lead that converted and still reads
      // "contacted" is the disagreement this route exists to remove.
      status: "signed",
    },
  });
  if (!count) return { ...verdict("lead_already_linked"), linked: null };

  await tx.salesLeadLinkEvent.create({
    data: {
      leadId: lead.id,
      salesRepId: rep.id,
      action: "linked",
      companyId: v.company.id,
      statusBefore,
      reason: v.reason,
    },
  });

  let attribution = null;
  if (v.writes.attribution) {
    const a = await captureAttributionWithin(tx, {
      companyId: v.company.id,
      // The session's rep, never a body field — the platform route's header
      // named this as the condition under which a rep-side door could exist.
      salesRepId: rep.id,
      source: "lead_link",
      claim: { email, leadCreatedAt: lead.createdAt },
      note: `Claimed from lead ${lead.id} by the email it registered with.`,
    });
    if (a.outcome !== "attribute") {
      const err = new Error(`lead_link attribution refused: ${a.outcome}`);
      err.code = "LEAD_LINK_ATTRIBUTION_REFUSED";
      err.outcome = a.outcome;
      throw err;
    }
    attribution = a.attribution;
  }

  return { ...v, linked: { companyId: v.company.id, name: v.company.name, attribution } };
}

/**
 * Unlink, inside a transaction the caller owns.
 *
 * ── What this deliberately does NOT touch ─────────────────────────────────
 *
 * SalesAttribution. A wrong LEAD link does not make the company's attribution
 * wrong: Easy Roofers was attributed to the rep by the signup link they
 * handed out, and that stayed true while the rep's pipeline pointed the wrong
 * prospect at it. Attribution is who gets paid, it is locked at capture, and
 * moving it is a superadmin correction with a reason and an audit row —
 * lib/sales/attribution.js's correctAttributionWithin(). Undoing a note in the
 * rep's own pipeline must not be a side door to that.
 */
export async function unlinkLeadWithin(tx, { lead, rep, reason, now = new Date() }) {
  const u = decideUnlink({ lead, now });
  if (!u.allowed) return { ...u, unlinked: null };

  // The status the link overwrote, from the matching "linked" row — the
  // newest one for this company, since a lead can be linked, unlinked and
  // linked again. Absent for links written before the event table existed.
  const linkedEvent = await tx.salesLeadLinkEvent.findFirst({
    where: { leadId: lead.id, action: "linked", companyId: lead.convertedCompanyId },
    orderBy: { occurredAt: "desc" },
    select: { statusBefore: true },
  });
  const restored = statusAfterUnlink(linkedEvent?.statusBefore, lead.status);
  const statusBefore = lead.status || null;
  const companyId = lead.convertedCompanyId;

  const { count } = await tx.salesLead.updateMany({
    // Compare-and-set on the company it is being unlinked FROM, so a stale
    // screen cannot unlink a link made after it loaded.
    where: { id: lead.id, salesRepId: rep.id, convertedCompanyId: companyId },
    data: { convertedCompanyId: null, convertedAt: null, status: restored },
  });
  if (!count) return { allowed: false, reason: "not_linked", unlinked: null };

  const text = typeof reason === "string" ? reason.trim() : "";
  await tx.salesLeadLinkEvent.create({
    data: {
      leadId: lead.id,
      salesRepId: rep.id,
      action: "unlinked",
      companyId,
      statusBefore,
      reason:
        (text || "No reason given.") +
        (statusBefore && statusBefore !== "signed"
          ? ` Status "${restored}" kept — the rep had already moved it since the link.`
          : linkedEvent?.statusBefore
            ? ` Status restored to "${restored}".`
            : ` No pre-link status on record; status set to "${restored}".`),
    },
  });

  return { ...u, unlinked: { companyId, status: restored } };
}
