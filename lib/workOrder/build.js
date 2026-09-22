// lib/workOrder/build.js
//
// The crew work order: the approved quote, seen from the tools.
//
// ══ What it is ═════════════════════════════════════════════════════════════
//
// Per area — the living room, the dining room, the trim — what was sold, how
// long it should take, and the estimator's "crew note (work order only)",
// which app/components/quotes/builder/PaintAreas.js has written into every
// paint takeoff since it existed and which NOTHING read until this file. A
// tick per area (done) and photos, both stored as the job's own Task rows so
// the office sees the same step on the job page.
//
// ══ What it is not ═════════════════════════════════════════════════════════
//
// Not a price list. The model this builds carries no `rate`, `amount`,
// `labour`, `material`, `total` or `hourlySellRate` anywhere; hours yes, money
// no. scripts/check-work-order.mjs walks the result to prove it. Not the
// client's phone number either: the caller passes the client already through
// redactClient(), so a crew member on name_address_only gets the address and
// nothing else — the same rule the job page follows.
//
// Not a second source of scope. Areas and hours come from the same
// paintTakeoff() the quote was priced with, and non-takeoff trades come from
// the scope group's own line items, so the work order cannot describe a job
// the quote did not sell.
//
// ══ Hidden items ═══════════════════════════════════════════════════════════
//
// Job.workOrderHidden holds keys of the things the office took off the
// crew's copy — "Final walkthrough & touch-ups" is the quote's line and the
// office's step, not a crew instruction. Keys are per group and index:
//   g:<scopeGroupId>:a:<areaIndex>   a paint area
//   g:<scopeGroupId>:l:<lineIndex>   a line item
//   g:<scopeGroupId>                 a whole non-takeoff group
// A hidden item is ABSENT from the crew model, not greyed — the count of
// hidden items is reported so the office view can say so.
//
// Pure. No database, no React.
import { paintTakeoff, displayHours } from "@/lib/pricing/paintTakeoff";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v, max = 600) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The keys that mean money. Nothing below may produce one. */
export const WORK_ORDER_MONEY_KEYS = Object.freeze([
  "rate", "amount", "labour", "labor", "material", "total", "subtotal", "price",
  "cost", "unitCost", "hourlySellRate", "deposit", "margin", "markup",
]);

export const areaKey = (groupId, index) => `g:${groupId}:a:${index}`;
export const lineKey = (groupId, index) => `g:${groupId}:l:${index}`;
export const groupKey = (groupId) => `g:${groupId}`;

/** The Task sourceKey that stores one area's tick and photos. */
export const areaTaskSourceKey = (jobId, key) => `work_order:${jobId}:${key}`;

/**
 * The scope sentence for one paint area — substrates, coats, product labels —
 * in the crew's words. "walls 2 coats eggshell, ceiling 1 coat flat".
 */
function paintScopeText(area, products) {
  const parts = [];
  for (const l of area.lines || []) {
    if (l.kind === "prep") {
      parts.push(`additional prep ${l.displayHours} h`);
      continue;
    }
    const product = l.productKey ? products?.[l.productKey]?.label : null;
    const coats = l.coats ? `${l.coats} coat${l.coats === 1 ? "" : "s"}` : null;
    parts.push([text(l.label, 60), `${l.quantity} ${l.unit}`, coats, product ? text(product, 60) : null].filter(Boolean).join(" · "));
  }
  return parts.join("; ");
}

/**
 * Build the model.
 *
 * @param job         { id, title, status, startDate, endDate, siteAddress,
 *                      workOrderHidden, quote: { quoteNumber, language,
 *                      scopeGroups: [{ id, label, category: { key, label },
 *                      takeoff, lineItems, categoryId }] } }
 * @param client      ALREADY redacted by the caller
 * @param ratesById   Map(categoryId → rates), as loadJobForSourcing attaches
 * @param tasks       Task rows with sourceKey starting work_order:<jobId>:,
 *                    each with status, assignedTo?.name, photos[]
 * @param crew        names of the people assigned to the job's visits
 * @param clockedHours  sum of TimeEntry.hours on the job
 * @param forOffice   true keeps hidden items in the model, flagged, so the
 *                    office view can offer to unhide them; false (the crew)
 *                    drops them entirely
 */
export function buildWorkOrderModel({
  job,
  client = null,
  ratesById = new Map(),
  tasks = [],
  crew = [],
  clockedHours = 0,
  forOffice = false,
}) {
  const hidden = new Set(Array.isArray(job?.workOrderHidden) ? job.workOrderHidden : []);
  const taskByKey = new Map();
  const prefix = `work_order:${job?.id}:`;
  for (const t of tasks) {
    if (typeof t?.sourceKey === "string" && t.sourceKey.startsWith(prefix)) {
      taskByKey.set(t.sourceKey.slice(prefix.length), t);
    }
  }

  const areas = [];
  let hiddenCount = 0;
  const groups = Array.isArray(job?.quote?.scopeGroups) ? job.quote.scopeGroups : [];

  for (const g of groups) {
    const tradeKey = g?.category?.key || null;
    const tradeLabel = text(g?.label || g?.category?.label, 80) || tradeKey || "Scope";
    const rates = ratesById?.get?.(g.categoryId) || null;
    const takeoff = g?.takeoff;

    if (takeoff && typeof takeoff === "object" && takeoff.model === "area_substrate") {
      const book = getPriceBook(tradeKey, rates);
      const result = paintTakeoff(takeoff, book?.takeoff);
      const products = book?.takeoff?.products || {};
      for (const area of result.areas) {
        const key = areaKey(g.id, area.index);
        const isHidden = hidden.has(key);
        if (isHidden && !forOffice) {
          hiddenCount += 1;
          continue;
        }
        if (isHidden) hiddenCount += 1;
        areas.push(shapeArea({
          key,
          label: text(area.label, 80),
          trade: tradeLabel,
          hours: num(area.hours),
          scope: paintScopeText(area, products),
          lines: (area.lines || []).map((l) => ({
            label: text(l.label, 80),
            quantity: num(l.quantity),
            unit: l.unit || null,
            coats: l.coats ? num(l.coats) : null,
            product: l.productKey ? text(products?.[l.productKey]?.label, 60) || null : null,
            hours: num(l.hours),
          })),
          crewNote: text(area.crewNote, 600) || null,
          hidden: isHidden,
          task: taskByKey.get(key) || null,
        }));
      }
      continue;
    }

    // A trade with no per-area takeoff: one step per group, its line items
    // as the scope, hours from the trade's own productivity figure (0 when
    // the book states none — an invented figure is worse than none).
    const gKey = groupKey(g.id);
    const groupHidden = hidden.has(gKey);
    if (groupHidden && !forOffice) {
      hiddenCount += 1;
      continue;
    }
    if (groupHidden) hiddenCount += 1;
    const lines = [];
    const rawLines = Array.isArray(g?.lineItems) ? g.lineItems : [];
    rawLines.forEach((l, i) => {
      if (!l || typeof l !== "object") return;
      const key = lineKey(g.id, i);
      const isHidden = hidden.has(key);
      if (isHidden) {
        hiddenCount += 1;
        if (!forOffice) return;
      }
      lines.push({
        key,
        label: text(l.description, 240),
        detail: text(l.detail, 600) || null,
        quantity: num(l.quantity) || 1,
        unit: text(l.unit, 24) || null,
        hidden: isHidden,
      });
    });
    if (!lines.length && !forOffice) continue;
    const hours = takeoff && typeof takeoff === "object" ? num(tradeLabourHours(tradeKey, takeoff, rates)) : 0;
    areas.push(shapeArea({
      key: gKey,
      label: tradeLabel,
      trade: tradeLabel,
      hours,
      scope: lines.filter((l) => !l.hidden).map((l) => l.label).join("; "),
      lines,
      crewNote: null,
      hidden: groupHidden,
      task: taskByKey.get(gKey) || null,
    }));
  }

  const visible = areas.filter((a) => !a.hidden);
  const totalHours = visible.reduce((s, a) => s + a.hours, 0);
  const done = visible.filter((a) => a.done).length;
  const photoCount = visible.reduce((s, a) => s + a.photos.length, 0);

  return {
    job: {
      id: job?.id,
      title: text(job?.title, 160),
      status: job?.status || null,
      startDate: job?.startDate || null,
      endDate: job?.endDate || null,
      siteAddress: text(job?.siteAddress || client?.address, 240) || null,
      quoteNumber: job?.quote?.quoteNumber || null,
      language: job?.quote?.language || null,
    },
    client: client
      ? {
          name: text(client.name, 120) || null,
          // Present only when the caller's redaction left them in.
          phone: client.phone ? text(client.phone, 40) : null,
          email: client.email ? text(client.email, 120) : null,
          restricted: Boolean(client.restricted),
        }
      : null,
    crew: [...new Set((crew || []).map((n) => text(n, 80)).filter(Boolean))],
    totalHours: Math.round(totalHours * 10) / 10,
    displayHours: displayHours(totalHours, 1),
    clockedHours: Math.round(num(clockedHours) * 10) / 10,
    areas,
    stats: { done, areas: visible.length, photos: photoCount },
    hiddenCount,
  };
}

function shapeArea({ key, label, trade, hours, scope, lines, crewNote, hidden, task }) {
  return {
    key,
    label,
    trade,
    hours: Math.round(hours * 10) / 10,
    displayHours: displayHours(hours, 1),
    scope,
    lines,
    crewNote,
    hidden,
    taskId: task?.id || null,
    done: task?.status === "done",
    assignee: task?.assignedTo?.name || null,
    photos: Array.isArray(task?.photos)
      ? task.photos.map((p) => ({ id: p.id, url: p.url, createdAt: p.createdAt || null }))
      : [],
  };
}

/** Walk a model and return the path of the first money key, or null. */
export function findWorkOrderMoneyKey(value, path = "") {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findWorkOrderMoneyKey(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (WORK_ORDER_MONEY_KEYS.includes(k)) return `${path}.${k}`;
      const hit = findWorkOrderMoneyKey(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}
