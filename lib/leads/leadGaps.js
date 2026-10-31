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
 * @param contact { name?, phone?, email?, address? } — what the person typed
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
  consider("address", intake.address, text(contact.address, 200), (v) => {
    intake.address = v;
    intakeChanged = true;
  });

  if (intakeChanged) out.intake = intake;
  return out;
}
