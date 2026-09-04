// lib/legal/deletionRequests.js
//
// How long FieldQuo has to answer a data deletion request, as one constant.
//
// ══ Why this is a constant and not a number typed into the page ═══════════
//
// It is a PROMISE, published on a public page, to people who will hold us to
// it — and unlike the rest of that page, it is not a fact about the code that
// can be re-derived by reading the code. Nothing in this repository implements
// or measures it: there is no deletion queue, no timer, no ticket system. A
// human reads an email and does the work.
//
// That makes it exactly the kind of value that rots silently. Put inline in
// the JSX it would be a number nobody could find again, changeable by anyone
// editing prose, with no reason attached. Here it is one line, in a diff a
// reviewer can see, beside the reason it is 30 and not 3.
//
// ══ Why 30 ════════════════════════════════════════════════════════════════
//
// It is the statutory ceiling FieldQuo is already bound by, not a target
// somebody liked the sound of. PIPEDA gives an organisation 30 days to respond
// to an access or correction request; Quebec's Law 25 uses the same 30 days;
// the GDPR gives one month for a request under Article 17. Publishing the
// ceiling means the published promise cannot be weaker than the law, which is
// the failure that matters. Beating it is the normal case and costs nothing to
// do quietly.
//
// Shortening this is an owner decision, and a real one: it is a commitment
// made to strangers by a company whose deletion process is one person doing it
// by hand. Nothing here should promise 48 hours because 48 hours sounds better.
//
// ══ What must change with it ══════════════════════════════════════════════
//
// The number appears on app/(marketing)/data-deletion/page.js, which is
// submitted to Meta's App Review as FieldQuo's data deletion instructions URL.
// Changing it changes what was submitted, so move
// DATA_DELETION_PAGE_UPDATED_DATE in lib/legal/effectiveDates.js in the same
// commit — a page that quietly says something different from the version a
// reviewer read is worse than one that is plainly out of date.

/** Days to respond to a deletion request. The statutory ceiling; see above. */
export const DELETION_RESPONSE_DAYS = 30;
