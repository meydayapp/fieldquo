// lib/legal/privacyOfficer.js
//
// Quebec's Law 25 requires a company to designate a person "responsible for
// the protection of personal information" and publish their TITLE and
// CONTACT information (not necessarily a name, but this codebase has no
// designated person to omit a name for either). FieldQuo has not made this
// designation. That is a real gap — an owner/legal decision, not something
// an engineering session can invent on the owner's behalf — so the privacy
// page ships with an honest, obviously-unfilled placeholder instead of a
// made-up name and title.
//
// ── Why this is a flag and not just text in the page ────────────────────────
//
// A placeholder sitting only in JSX prose is exactly the kind of thing that
// silently ships forever: nobody re-reads a page they didn't touch. Pulling
// it into one constant that scripts/check-legal-pages.mjs imports and checks
// against is what makes the "unfilled" state IMPOSSIBLE to miss:
//
//   - While PENDING is true, the three fields below must still read as the
//     bracketed placeholder text. If someone types in a real name but
//     forgets to flip PENDING to false, the check fails — a half-filled
//     placeholder (looks real, isn't confirmed) is worse than an obvious one.
//   - Once PENDING is false, none of the three fields may still contain the
//     placeholder markup. Flipping the flag without actually filling the
//     fields in fails the same check from the other side.
//
// So: to ship this for real, both the data AND the flag have to change
// together, in one commit a reviewer can see. That is the actual protection
// against "shipped unfilled" — not a comment asking nicely.
// Filled in by the owner on 2026-09-01. Quebec's Law 25 makes the person with
// the highest authority the person in charge by default unless the role is
// delegated in writing — so naming the CEO is not a placeholder standing in
// for a decision, it is the decision.
export const PRIVACY_OFFICER_PENDING = false;

export const PRIVACY_OFFICER = {
  name: "Emilio Boves",
  // Law 25's own term for the role. "CEO" is the job; this is the
  // responsibility the statute names, and the statute's wording is what a
  // reader looking for it will be scanning for.
  title: "Chief Executive Officer, and Person in Charge of the Protection of Personal Information",
  // A phone number rather than an inbox, because it is the contact that
  // actually exists today. Swap it for privacy@fieldquo.com the moment that
  // inbox is real — a published contact nobody reads is worse than none.
  contact: "819-238-7263",
};
