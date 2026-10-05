// lib/agency/leadRef.js
//
// The lead's pseudonymous reference for a marketing agency.
//
// ══ Why random, and stored ═════════════════════════════════════════════════
//
// The agency has to recognise the lead that closes two months later as the
// one its ad brought in — so the reference must be STABLE. It must also say
// nothing about the person: a hash of a phone number or an email is a
// reversible lookup for anyone holding a list of phone numbers (an agency
// does), so it is never derived from either. A random id, stored once on
// LeadRequest.agencyRef, is the only shape that is both.
//
// The row id (a cuid) is not used either: it is the key every internal URL
// and every other API takes, and an agency holding it holds a handle into the
// app it was never given.
//
// ══ The display form ═══════════════════════════════════════════════════════
//
// "L-7F3A" — the last four characters, which is what a person reads on the
// agency's dashboard. Four characters collide once a company has a few
// thousand leads, so the API keys on the FULL reference; a display form
// resolves only while it is unambiguous (resolveRefQuery below).

import { randomBytes } from "node:crypto";

// Crockford base32: no I, L, O, U — nothing a person misreads off a screen.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REF = /^lr_[0-9A-HJKMNP-TV-Z]{16}$/;
const DISPLAY = /^L-([0-9A-HJKMNP-TV-Z]{4})$/;

/** A new reference: "lr_" + 16 Crockford characters (80 bits). */
export function newLeadRef(random = randomBytes) {
  const bytes = random(16);
  let out = "lr_";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

export function isLeadRef(value) {
  return typeof value === "string" && REF.test(value);
}

/** "L-7F3A" for "lr_…7F3A"; null for anything that is not a reference. */
export function displayRef(ref) {
  return isLeadRef(ref) ? `L-${ref.slice(-4)}` : null;
}

/**
 * What a caller typed, as a lookup: { ref } for a full reference,
 * { suffix } for a display form ("L-7F3A", case-insensitive), or null.
 */
export function resolveRefQuery(value) {
  const s = String(value ?? "").trim().toUpperCase();
  if (/^LR_[0-9A-Z]{16}$/.test(s) && isLeadRef(`lr_${s.slice(3)}`)) return { ref: `lr_${s.slice(3)}` };
  const m = s.match(DISPLAY);
  if (m) return { suffix: m[1] };
  return null;
}

/**
 * Give every lead in `leads` a reference, writing only the ones that have
 * none. A lead's reference is written once and never changed — the write is
 * conditional on the column still being null, so two readers racing over the
 * same lead keep whichever landed first, and both then read that one back.
 *
 * Mutates each lead's `agencyRef`. Returns the leads.
 */
export async function ensureLeadRefs(db, companyId, leads, { make = newLeadRef } = {}) {
  const missing = leads.filter((l) => l && !l.agencyRef);
  for (const lead of missing) {
    for (let attempt = 0; attempt < 3 && !lead.agencyRef; attempt++) {
      const ref = make();
      try {
        const res = await db.leadRequest.updateMany({
          where: { id: lead.id, companyId, agencyRef: null },
          data: { agencyRef: ref },
        });
        if (res.count === 1) {
          lead.agencyRef = ref;
          break;
        }
        // Somebody else assigned it first: read theirs.
        const row = await db.leadRequest.findFirst({ where: { id: lead.id, companyId }, select: { agencyRef: true } });
        if (row?.agencyRef) lead.agencyRef = row.agencyRef;
      } catch (err) {
        // A collision on @@unique([companyId, agencyRef]) — 80 bits makes it
        // vanishingly rare; try a fresh one.
        if (err?.code !== "P2002") throw err;
      }
    }
  }
  return leads;
}
