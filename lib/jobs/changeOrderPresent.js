// lib/jobs/changeOrderPresent.js
//
// The change-order row as the job page reads it. One include and one
// presenter, shared by GET /api/jobs/[id] (which embeds the job's change
// orders), the change-orders routes and the send route — so every surface
// gets the same label and the same redaction.
//
// Redaction: the signature PNG and the share token never ride out with a
// list. The PNG is evidence, kept for the record and the addendum page; the
// token is the client's credential, and a staff list is not where it is
// needed (the send route returns the URL to the person who pressed Send).

import { changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";

export const CHANGE_ORDER_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  // So the panel can say WHICH invoice a change order was billed on rather
  // than a bare "billed", which is the sort of unfalsifiable status a
  // contractor cannot act on.
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
  task: { select: { id: true, title: true } },
};

/** What the panel gets per row: the row, its label, and its signature's name — never the PNG. */
export function presentChangeOrder(co, all) {
  const { signature, shareToken: _t, ...rest } = co;
  return {
    ...rest,
    label: changeOrderLabel(co, all),
    signedBy: signature?.name || null,
    signedAt: signature?.signedAt || null,
  };
}

