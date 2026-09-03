// lib/purchasing/access.js
//
// The one level the purchasing area requires, and the row shapers every route
// answers with.
//
// ── Why it lives here rather than in a route file ──────────────────────────
//
// Next's App Router treats a route.js as a module with a fixed export surface
// (the HTTP verbs plus `runtime`, `dynamic`, `revalidate`…). Exporting a shared
// constant from one and importing it into another works by accident and is the
// kind of thing that stops working on a framework upgrade. A plain lib module
// is the boring answer, and it is also the one a check script can import
// without pulling `next/server` in behind it.
//
// ── Why `expenses` and not a new category ──────────────────────────────────
//
// Buying is spending, and PERMISSION_CATEGORIES.expenses already draws exactly
// the line this area needs: "their own" versus "everyone's". A supplier list,
// a purchase order and a stock level are all company-wide facts — there is no
// such thing as "my own" purchase order — so every verb here requires the top
// rung, the same one lib/permissions/nav.js already uses to decide whether the
// expenses row is worth showing.
//
// Inventing a `purchasing` category instead would have meant a new column in
// the Manage Team grid, a new default on every stored preset, and a rung
// nobody has set on any existing member — which reads as "no access" or as
// "full access" depending on a fallback, and neither is a decision this
// session gets to make for a company.

export const PURCHASING_CATEGORY = "expenses";
export const PURCHASING_LEVEL = "view_record_edit_all";

/** Trim to a length, and turn "" into null — absence, not an empty statement. */
export function text(value, max) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/** Decimal columns arrive as Decimal objects; the browser wants numbers. */
export function num(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function shapeSupplier(s) {
  return {
    id: s.id,
    name: s.name,
    accountRef: s.accountRef,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    address: s.address,
    notes: s.notes,
    active: s.active,
    createdAt: s.createdAt,
  };
}

export function shapePurchaseOrderLine(l) {
  return {
    id: l.id,
    materialId: l.materialId,
    description: l.description,
    quantity: num(l.quantity),
    unit: l.unit,
    unitCost: num(l.unitCost),
    quantityReceived: num(l.quantityReceived),
  };
}

export function shapePurchaseOrder(po) {
  return {
    id: po.id,
    number: po.number,
    status: po.status,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name || null,
    jobId: po.jobId,
    // Named `expectedTotal` on the row and left named that here on purpose:
    // it is what was AGREED, not what was paid. The gap between the two is the
    // number the schema comment says a contractor wants and cannot get, and
    // renaming it to "total" on the way out would erase the distinction.
    expectedTotal: num(po.expectedTotal),
    currency: po.currency,
    orderedAt: po.orderedAt,
    expectedAt: po.expectedAt,
    receivedAt: po.receivedAt,
    notes: po.notes,
    createdAt: po.createdAt,
    lines: Array.isArray(po.lines) ? po.lines.map(shapePurchaseOrderLine) : [],
  };
}

export function shapeMovement(m, materialName) {
  return {
    id: m.id,
    materialId: m.materialId,
    materialName: materialName || null,
    quantity: num(m.quantity),
    kind: m.kind,
    jobId: m.jobId,
    purchaseOrderId: m.purchaseOrderId,
    note: m.note,
    occurredAt: m.occurredAt,
  };
}
