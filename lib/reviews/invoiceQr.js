// lib/reviews/invoiceQr.js
//
// The one gate behind the review QR in the invoice footer, pure, so the
// check can execute it: lib/documentSections/FooterSection.js is JSX and
// cannot be imported by a bare-node script, but the decision it makes can.
//
// Three conditions, all required: the company switched it on
// (Company.invoiceReviewQr, default off), the review link validates, and
// the document is an INVOICE — it carries an invoiceNumber. A quote never
// gets one: a review asked for before the work is done is an ask for
// nothing. The link is the condition, not the switch: the switch alone must
// never draw a QR that scans to nothing.

import { validReviewUrl } from "./request";

export function invoiceReviewQrWanted({ data, company } = {}) {
  return Boolean(company?.invoiceReviewQr && validReviewUrl(company?.reviewUrl) && data?.invoiceNumber);
}
