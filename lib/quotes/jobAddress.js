// lib/quotes/jobAddress.js
//
// "Job address · 214 rue Principale" — the one rule every surface applies
// to Quote.siteAddress, so the PDF, the email, the approval page and the
// back-office page agree on when the site is worth printing.
//
// Printed only when the quote names a site AND it is not simply the client's
// own address repeated: a homeowner's quote usually has the same string in
// both, and printing it twice says nothing. Null when the quote never asked
// (rows before Quote.siteAddress existed) — absence is not "same as the
// client", and no reader invents one.

const squash = (v) => String(v || "").replace(/\s+/g, " ").trim();

export function jobAddressLine(data, labels = {}) {
  const site = squash(data?.siteAddress);
  if (!site) return null;
  const own = squash(data?.client?.address);
  if (own && own.toLowerCase() === site.toLowerCase()) return null;
  return { label: labels.jobAddress || "Job address", value: site };
}

/**
 * What the builder prefills the field with for a freshly picked client: the
 * homeowner's own address; nothing for a company client, whose office is
 * not the site.
 */
export function defaultSiteAddressFor(client) {
  if (!client || client.type === "company") return "";
  return squash(client.address);
}

/** Whether a save may go through without a site: never for a company client. */
export function siteAddressRequired(client) {
  return client?.type === "company";
}
