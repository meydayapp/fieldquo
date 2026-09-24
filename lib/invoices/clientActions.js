// lib/invoices/clientActions.js
//
// What a staff member does with a saved invoice from more than one screen,
// as plain fetch helpers — lib/quotes/clientActions.js's twin. The invoice
// page (app/app/invoices/[id]/page.js) held the PDF download inline; the
// document-shaped invoice builder's Send… menu needs the same press, and a
// second inline copy is the one that rots.
//
// No React, no state: returns or throws, and the caller owns the spinner
// and the error banner.

/**
 * The PDF the client would receive, for the office to keep or print.
 *
 * POSTs, as the quote's does: the route also archives a copy, and a GET
 * would let a plain <a> bypass the money gate with a prefetch. The
 * document's language is the invoice's own, resolved server-side
 * (non-negotiable #6). Never a bare `if (res.ok)`: a refusal names its
 * reason through the thrown error so the press cannot read as having worked.
 */
export async function downloadInvoicePdf(invoiceId, invoiceNumber, fallbackError = "Couldn't build the PDF.") {
  const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || fallbackError);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceNumber || invoiceId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
