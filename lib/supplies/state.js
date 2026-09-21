// lib/supplies/state.js
//
// A supply request's life: requested → ordered → restocked, with one side
// door (cancelled). PURE — the routes ask this what is allowed and write only
// what it says; scripts/check-supply-requests.mjs runs it against every pair.
//
// ══ Why the transitions are closed ═════════════════════════════════════════
//
// "Restocked" writes a `received` StockMovement (lib/purchasing/stock.js), and
// a movement is append-only by design. A request that could be restocked
// twice would put two deliveries in the ledger for one box of tape; a
// request restocked from "requested" would skip the order the office never
// raised. So each step has exactly one predecessor, and the write route
// re-reads the row inside the transaction before it believes the status.
//
// Cancelled is a status, not a delete: NO DATA DELETION, and "we asked for
// this and then didn't need it" is a fact the next stock count wants.

export const SUPPLY_STATUSES = Object.freeze(["requested", "ordered", "restocked", "cancelled"]);

const NEXT = Object.freeze({
  requested: ["ordered", "cancelled"],
  ordered: ["restocked", "cancelled"],
  restocked: [],
  cancelled: [],
});

/** Where a request came from. Printed under the row; never inferred. */
export const SUPPLY_SOURCES = Object.freeze(["field", "low_stock", "material_list"]);

/**
 * May a request move from `from` to `to`?
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function transition(from, to) {
  if (!SUPPLY_STATUSES.includes(from)) return { ok: false, error: `"${from}" isn't a request state.` };
  if (!SUPPLY_STATUSES.includes(to)) return { ok: false, error: `"${to}" isn't a request state.` };
  if (from === to) return { ok: false, error: `It's already ${to}.` };
  if (!NEXT[from].includes(to)) {
    return {
      ok: false,
      error:
        from === "restocked"
          ? "This request is already restocked — its stock movement is on the ledger."
          : from === "cancelled"
            ? "This request was cancelled. Ask for it again if it's still needed."
            : `A ${from} request can only become ${NEXT[from].join(" or ")}.`,
    };
  }
  return { ok: true };
}

/**
 * The stock movement "Restocked" writes for a request matched to a material.
 * Null for a free-text item: nothing in stock to move.
 *
 * `received`, positive, the request's own quantity — the crew asked for six
 * rolls, six rolls came in. If fewer arrived the office records the
 * difference as an adjustment, the way every other count is corrected.
 */
export function restockMovementFor(request) {
  if (!request?.materialId) return null;
  const qty = Number(request.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return {
    materialId: request.materialId,
    kind: "received",
    quantity: qty,
    // Idempotency: the ledger's unique `ref` refuses a second movement for
    // the same request even if two office tabs press Restocked together.
    ref: `supply_request:${request.id}`,
    note: request.restockNote || `Restocked — request ${request.id}`,
    jobId: request.jobId || null,
  };
}

/**
 * The requests the reorder banner pre-fills: one per material below its
 * threshold, for the SHORTFALL (threshold − level), never for a material
 * without a threshold (no statement) or one already covered by an open
 * request (asking twice is the thing the list exists to stop).
 *
 * @param levels      stockLevels() rows
 * @param openRequests SupplyRequest rows with status requested|ordered
 */
export function lowStockPrefills(levels, openRequests = []) {
  const covered = new Set(
    (Array.isArray(openRequests) ? openRequests : [])
      .filter((r) => r?.materialId && (r.status === "requested" || r.status === "ordered"))
      .map((r) => r.materialId),
  );
  return (Array.isArray(levels) ? levels : [])
    .filter((l) => l?.belowThreshold === true && !covered.has(l.materialId))
    .map((l) => {
      const level = Number(l.level);
      const threshold = Number(l.threshold);
      const shortfall = Number.isFinite(level) && Number.isFinite(threshold) ? threshold - level : null;
      return {
        materialId: l.materialId,
        itemName: l.name,
        unit: l.unit || null,
        level: Number.isFinite(level) ? level : null,
        threshold: Number.isFinite(threshold) ? threshold : null,
        quantity: shortfall !== null && shortfall > 0 ? Math.round(shortfall * 1000) / 1000 : null,
      };
    })
    .filter((p) => p.quantity !== null);
}

/**
 * Validate what a phone posted. Returns the row to store or an error.
 * `materials` is the company's own list, used to fill the name from an id.
 */
export function normaliseRequest(body, { materials = [] } = {}) {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const materialId = body?.materialId ? String(body.materialId).slice(0, 64) : null;
  const material = materialId ? byId.get(materialId) : null;
  if (materialId && !material) return { error: "That item isn't on your stock list." };

  const typed = String(body?.itemName ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const itemName = material ? material.name : typed;
  if (!itemName) return { error: "What do you need?" };

  const qty = Number(body?.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { error: "How many? A number above zero." };
  if (qty > 100_000) return { error: "That quantity is not a supply request." };

  const unit = String(body?.unit ?? material?.unit ?? "").trim().slice(0, 24) || null;

  let neededBy = null;
  if (body?.neededBy) {
    const d = new Date(body.neededBy);
    if (Number.isNaN(d.getTime())) return { error: "That date couldn't be read." };
    neededBy = d;
  }

  const photoUrl = typeof body?.photoUrl === "string" && /^https:\/\//.test(body.photoUrl) ? body.photoUrl.slice(0, 500) : null;
  const note = String(body?.note ?? "").trim().slice(0, 1000) || null;
  const source = SUPPLY_SOURCES.includes(body?.source) ? body.source : "field";

  return {
    row: {
      materialId: material ? material.id : null,
      itemName,
      quantity: Math.round(qty * 1000) / 1000,
      unit,
      neededBy,
      photoUrl,
      note,
      source,
    },
  };
}
