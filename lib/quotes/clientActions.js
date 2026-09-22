// lib/quotes/clientActions.js
//
// The two things a staff member does with a saved quote from more than one
// screen — get the client's link, download the PDF — as plain fetch helpers.
// The quote page (app/app/quotes/[id]/page.js) and the document builder's
// Send… menu both call these; before this file the page held them inline
// and the builder would have needed a copy.
//
// No React, no state: each returns or throws, and the caller owns the
// spinner and the error banner.

/**
 * The client's link: the stored share token, minted on first use. The same
 * route the approval page uses (GET/POST /api/quotes/[id]/share), so "Copy
 * quote link" everywhere hands out one URL.
 */
export async function fetchClientLink(quoteId, fallbackError = "Couldn't get the client link.") {
  const got = await fetch(`/api/quotes/${quoteId}/share`);
  const data = await got.json().catch(() => null);
  if (got.ok && data?.url) return data.url;
  const made = await fetch(`/api/quotes/${quoteId}/share`, { method: "POST" });
  const created = await made.json().catch(() => null);
  if (!made.ok) throw new Error(created?.error || fallbackError);
  return created.url;
}

/**
 * The PDF the client would receive, for the office to keep or print.
 *
 * POSTs rather than opens a link: the route is a POST because it also
 * archives a copy, and a GET would let a plain <a> bypass the money gate
 * with a prefetch. The document's language is the quote's own, resolved
 * server-side — non-negotiable #6 — so nothing here says which it wants.
 * Never a bare `if (res.ok)`: a refusal names its reason through the thrown
 * error so the press cannot read as having worked.
 */
export async function downloadQuotePdf(quoteId, quoteNumber, fallbackError = "Couldn't build the PDF.") {
  const res = await fetch(`/api/quotes/${quoteId}/pdf`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || fallbackError);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quote-${quoteNumber || quoteId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
