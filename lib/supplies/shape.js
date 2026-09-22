// lib/supplies/shape.js
//
// The row shaper and the include every supply-request route answers with.
// A lib module rather than an export off a route file, for the reason
// lib/purchasing/access.js gives: a route.js has a fixed export surface.

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const REQUEST_INCLUDE = {
  job: { select: { title: true } },
  requestedBy: { select: { name: true } },
};

export function shapeRequest(r) {
  return {
    id: r.id,
    materialId: r.materialId,
    itemName: r.itemName,
    quantity: num(r.quantity),
    unit: r.unit,
    jobId: r.jobId,
    jobTitle: r.job?.title || null,
    requestedById: r.requestedById,
    requestedByName: r.requestedBy?.name || null,
    neededBy: r.neededBy,
    photoUrl: r.photoUrl,
    note: r.note,
    status: r.status,
    source: r.source,
    purchaseOrderId: r.purchaseOrderId,
    purchaseOrderNumber: r.purchaseOrderNumber || null,
    orderedAt: r.orderedAt,
    restockedAt: r.restockedAt,
    restockNote: r.restockNote,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
  };
}

