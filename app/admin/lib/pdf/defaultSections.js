// app/admin/lib/pdf/defaultSections.js
//
// The out-of-the-box document, and the order it reads in.
//
// A company that never opens the template editor gets this, so it has to be
// good rather than minimal. The order below is the order a client reads in,
// not the order the data happens to sit in the database:
//
//   header        who sent it, which document, how long they have
//   client_info   is this mine, and what's the reference
//   scope_groups  the work, one card per service, with what's included
//   totals        the number, in their brand colour
//   process_steps what happens if they say yes  ← the one that closes deals
//   payment_terms when money changes hands
//   notes         anything specific to this job
//   signature     somewhere to sign, for clients who print
//   footer        contact details
//
// process_steps sits AFTER the total on purpose. The client's eye goes to the
// price first whatever we do; the question immediately after is "is that worth
// it", and that's the moment the steps answer. Put them before the total and
// they're read before the reader has a reason to care.

export function getDefaultSections(documentType) {
  if (documentType === "invoice_pdf" || documentType === "invoice_email") {
    // An invoice is a demand, not a pitch. No process steps (the work is
    // done), no signature (there's nothing left to accept), no payment
    // schedule (the schedule already happened — what's owed now is the total).
    return [
      { type: "header", sortOrder: 0 },
      { type: "client_info", sortOrder: 1 },
      { type: "scope_groups", sortOrder: 2 },
      { type: "totals", sortOrder: 3 },
      { type: "payment_summary", sortOrder: 4 },
      { type: "notes", sortOrder: 5 },
      { type: "footer", sortOrder: 6 },
    ];
  }

  const quote = [
    { type: "header", sortOrder: 0 },
    { type: "client_info", sortOrder: 1 },
    { type: "scope_groups", sortOrder: 2 },
    { type: "totals", sortOrder: 3 },
    { type: "process_steps", sortOrder: 4 },
    { type: "payment_terms", sortOrder: 5 },
    { type: "notes", sortOrder: 6 },
    { type: "signature", sortOrder: 7 },
    { type: "footer", sortOrder: 8 },
  ];

  // Email is a nudge to open the real document, not a copy of it. The
  // signature block renders nothing in email anyway, and a process timeline
  // inline is what makes people stop scrolling.
  if (documentType === "quote_email") {
    return quote.filter((s) => !["signature", "process_steps"].includes(s.type));
  }

  return quote;
}
