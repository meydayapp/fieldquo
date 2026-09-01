// lib/documents/issueDate.js
//
// What date a quote or invoice should print as "the" date on it.
//
// ── Why not just createdAt ───────────────────────────────────────────────────
//
// createdAt is when the database row was made, which for a document that goes
// through a review or an edit pass is not the same day a client ever saw it. A
// draft invoice raised in March and actually emailed in May is, to the client
// and to their accountant, a May invoice — printing March is not a rounding
// error, it is the wrong month on a financial record.
//
// ── Why sentAt is the right thing to prefer ─────────────────────────────────
//
// Both Quote.sentAt and Invoice.sentAt are already written for exactly one
// reason and at exactly one moment: the send route stamps them AFTER Resend
// accepts the message, never before (see app/api/quotes/[id]/send/route.js and
// app/api/invoices/[id]/send/route.js — both header comments say so in almost
// the same words). lib/servicePlans/run.js's auto-billed invoices set it the
// same way, right after the email actually goes out. So sentAt already means
// "the day this document was issued to the client" everywhere it's set; this
// file just gives that meaning a name other code can read by.
//
// ── Why createdAt is still the fallback, not an error ───────────────────────
//
// An invoice settled in person and marked paid without ever being emailed has
// no sentAt and never will — there was no send event to record. That is not a
// missing value to fix; it is an invoice that was, honestly, only ever dated
// by when it was raised. createdAt is a defensible fallback for that case, and
// it is also what every row created before sentAt existed already has, so no
// migration or backfill is needed to make this correct.
export function documentIssueDate(doc) {
  return doc?.sentAt || doc?.createdAt || null;
}
