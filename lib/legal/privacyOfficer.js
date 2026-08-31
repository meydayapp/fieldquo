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
export const PRIVACY_OFFICER_PENDING = true;

export const PRIVACY_OFFICER = {
  name: "[[PLACEHOLDER: privacy officer name — optional under Law 25, but decide whether to name one]]",
  title: "[[PLACEHOLDER: privacy officer title, e.g. \"Privacy Officer\" or \"Person in Charge of the Protection of Personal Information\"]]",
  contact: "[[PLACEHOLDER: privacy officer contact — a role email is fine, e.g. privacy@fieldquo.com, once that inbox exists]]",
};
