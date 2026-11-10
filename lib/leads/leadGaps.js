// lib/leads/leadGaps.js
//
// What a person learned on the phone, written onto a lead that didn't have it.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner: "maybe I called them and got their address and phone or email —
// when creating the appointment the page should allow me to enter the other
// fields I didn't have." A Messenger lead routinely arrives as a name and a
// thread (Meta sends nothing else), and the contractor fills the rest in by
// talking to the person. Until now there was nowhere to put it: the lead
// drawer shows those fields, it never let anyone type one.
//
// ── Only an empty column ───────────────────────────────────────────────────
//
// The same rule lib/leads/conversationLead.js's planLeadWrite follows, and for
// the same reason: a value already on the lead was put there by the homeowner
// on a form, or by a person who meant it. A later screen must not quietly
// replace it. What was offered and refused comes back in `skipped` so the
// caller can say so rather than silently dropping it.
//
// Deliberately NOT a merge, a "best value" or a freshness contest. Those all
// end in a field changing under somebody who was looking at it.

import { cleanEmail } from "@/lib/validation";
// The ONE shape LeadRequest.intake has. Reading or writing those four keys by
// hand is how the instant quote spent its life putting an address somewhere
// convertLead never looked — see the header of lib/leads/intakeShape.js, and
// scripts/check-lead-intake.mjs, which fails the build over a tenth spelling.
import { buildLeadIntake, LEAD_ADDRESS_KEYS } from "@/lib/leads/intakeShape";

const text = (v, max) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const empty = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim());

/**
 * Plan the write. Pure, so scripts/check-lead-linking.mjs can run it against
 * hostile input without a database.
 *
 * @param lead    { name, phone, email, intake }
 * @param contact { name?, phone?, email?, address?, city?, province?,
 *                  country? } — what the person typed, plus the structured
 *                  components when they PICKED the address rather than typing
 *                  it (app/components/leads/BookVisitPanel.js).
 * @returns {{ data, intake, written: string[], skipped: Array<{field, kept, offered}> }}
 */
export function planGapFill({ lead = null, contact = null } = {}) {
  const out = { data: {}, intake: null, written: [], skipped: [] };
  if (!lead || !contact || typeof contact !== "object") return out;

  const intake =
    lead.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake)
      ? { ...lead.intake }
      : {};
  let intakeChanged = false;

  const consider = (field, current, offered, apply) => {
    if (offered === null) return;
    if (!empty(current)) {
      // Identical is not a conflict — nothing to write, nothing to report.
      if (String(current).trim() !== String(offered)) {
        out.skipped.push({ field, kept: current, offered });
      }
      return;
    }
    apply(offered);
    out.written.push(field);
  };

  consider("name", lead.name, text(contact.name, 120), (v) => {
    out.data.name = v;
  });
  consider("phone", lead.phone, text(contact.phone, 40), (v) => {
    out.data.phone = v;
  });
  // cleanEmail is the one spelling of "is this an address" this app uses; a
  // second opinion here would let a lead hold an email the rest refuses.
  const email = contact.email ? cleanEmail(String(contact.email).trim()) : null;
  consider("email", lead.email, email || null, (v) => {
    out.data.email = v;
  });
  // The address, and the city/province/country a Places pick returned with
  // it. Normalised through buildLeadIntake rather than trimmed again here:
  // the empties drop out, which is exactly what keeps an absent province
  // ABSENT instead of null — a null beside a real address reads to the next
  // caller as "we asked and they have none".
  const offered =
    buildLeadIntake({
      address: text(contact.address, 200),
      city: text(contact.city, 120),
      province: text(contact.province, 120),
      country: text(contact.country, 60),
    }) || {};

  consider("address", intake.address, offered.address ?? null, (v) => {
    intake.address = v;
    intakeChanged = true;
  });

  // ── The jurisdiction travels with ITS OWN address, or not at all ─────────
  //
  // city/province/country are what the tax resolver runs on, and they are
  // only true of the address Google handed them back with. So they are
  // written only when THAT address is the one that just landed. A lead that
  // already held a typed address keeps it (the rule above), and writing
  // Gatineau's province alongside it would describe a house nobody picked —
  // and a wrong province is a wrong total on a document a homeowner signs.
  if (out.written.includes("address")) {
    for (const key of LEAD_ADDRESS_KEYS) {
      if (key === "address") continue;
      consider(key, intake[key], offered[key] ?? null, (v) => {
        intake[key] = v;
        intakeChanged = true;
      });
    }
  }

  if (intakeChanged) out.intake = intake;
  return out;
}
