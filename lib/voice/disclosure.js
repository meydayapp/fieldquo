// lib/voice/disclosure.js
//
// What a form tells someone before it takes their phone number.
//
// ── Why this isn't in outbound.js ──────────────────────────────────────────
//
// Because a FORM has to render it, and outbound.js imports the database. A
// client component pulling these strings in dragged Prisma — and therefore
// `pg`, and therefore node's `dns` — into the browser bundle, which fails the
// build outright. Same reason lib/documentSections/sectionMeta.js exists.
//
// So: no imports here, ever. Strings only.
//
// ── One copy, rendered AND stored ──────────────────────────────────────────
//
// The form shows this string and the consent row stores this string, so what we
// can prove somebody saw is literally what was on their screen. Two copies
// drift, and the one that drifts is the one in the evidence.
//
// Changing the wording is fine — existing rows keep the wording THEY were shown,
// which is the point of storing it rather than referencing it.
export const DISCLOSURE = {
  self_quote:
    "Someone will call you shortly about your quote — it may be an assistant taking the details first.",
  booking:
    "We'll call to confirm your appointment. It may be an assistant calling first.",
  job_completed:
    "We may call after the work is done to check you're happy and ask for a review.",
};
