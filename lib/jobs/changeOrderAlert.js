// lib/jobs/changeOrderAlert.js
//
// "The client approved the change order" as an alert to the company's own
// team — the owner, 2026-10-14 ("send me a text when the client has … approved
// a … change order"). Before this, a homeowner signing a change order on
// /co/<token> told nobody: the ActivityLog row was the only trace, and the
// contractor found out by opening the job.
//
// Called by POST /api/public/change-orders/[token] after the approval has
// committed (the status-guarded updateMany there is what makes it happen at
// most once per change order: a second tap finds no row to move and returns
// 409 before reaching this). Everything is read off the change order's own
// row — the company is the job's, never a value from the request.

import { notifyEvent } from "@/lib/notifications/notify";
import { quotePeople } from "@/lib/notifications/clientAlerts";

/**
 * @param changeOrderId  the change order just approved
 * @param label          its "CO-2" label, as the route already computed it
 * @param signedBy       the name on the signature
 */
export async function alertChangeOrderApproved(prisma, { changeOrderId, label, signedBy = null, notify = notifyEvent }) {
  const co = await prisma.changeOrder.findUnique({
    where: { id: changeOrderId },
    select: {
      id: true,
      jobId: true,
      status: true,
      priceDelta: true,
      createdById: true,
      job: {
        select: {
          id: true,
          companyId: true,
          client: { select: { name: true } },
          quote: { select: { createdById: true, assignedToId: true } },
        },
      },
    },
  });
  // Only an approval is announced. A row that is no longer approved (staff
  // took it back in the same second) is not news to send.
  if (!co?.job?.companyId || co.status !== "approved") return { created: false, reason: "not_approved" };
  const amount = Number(co.priceDelta);
  return notify({
    companyId: co.job.companyId,
    type: "changeOrder.approved",
    entityId: co.job.id,
    params: { clientName: co.job.client?.name || "", label: label || "" },
    // Structural, like quote.accepted's: never inside a sentence, and the
    // catalog refuses this type to anybody without showPricing.
    amount: Number.isFinite(amount) ? amount : null,
    actorUserId: null,
    actorName: "Client (change order link)",
    // Who raised the change, and who wrote and works the quote the job came
    // from. Owners and admins are added by the resolver.
    peopleUserIds: quotePeople(co.createdById, co.job.quote?.createdById, co.job.quote?.assignedToId),
    alertContext: { signedBy },
  });
}
