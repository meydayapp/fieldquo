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
// ══ Enough to do the job (2026-10-04) ══════════════════════════════════════
//
// The live test opened a cabinet job's work order and read "0 h across 1
// areas · Cabinet Refinishing · 0 h" — nothing a crew could act on. A cabinet
// group has no takeoff, so no hours came out of it, and the page drew line
// LABELS only, never how many. So the model now also carries, all of it
// scope and none of it money:
//
//   • per line: quantity and unit, and the colour / sheen / door style the
//     line was sold with (the line's own meta — never its rate or amount);
//   • per cabinet group: the door and drawer counts and the finish answers
//     (coats, two-tone) from its intake, and hours from the cabinet labour
//     model — the same tradeLabourHours() every trade answers "how long" with;
//   • per trade: the "what's included" bullets the client's quote printed,
//     resolved by the caller in the QUOTE's language (lib/documents/
//     serviceContent.js — passed in, so this file stays light enough for the
//     builder's client bundle);
//   • the options the client chose (QuoteAddOn.selected — description and
//     detail, never amount);
//   • the job's materials list (name, quantity, unit, bought or not — never a
//     cost), the visits with their notes, and the checklist;
//   • the quote's own labour-hours estimate (QuoteCosting.labourHours, an hours
//     figure) when the areas themselves sum to none.
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
import { richTextToPlain } from "@/lib/quotes/richText";
import { normaliseClientPo } from "@/lib/documents/clientPo";
import { paintTakeoff, displayHours } from "@/lib/pricing/paintTakeoff";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v, max = 600) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * A cabinet group's intake as the cabinet labour model reads it — doorCount /
 * drawerCount renamed to doors / drawers, exactly as lib/costing/
 * quoteCosting.js cabinetConfigFrom does. Null when nobody counted.
 */
function cabinetCounts(intake) {
  if (!intake || typeof intake !== "object") return null;
  const doors = num(intake.doorCount);
  const drawers = num(intake.drawerCount);
  if (doors + drawers <= 0) return null;
  return { doors, drawers };
}

/**
 * What the crew must finish it in: the colour, sheen and door style the
 * group's first line carries in its meta (the cabinet builder writes them
 * there), and the coats / two-tone answers from the intake. Only what was
 * stated — an absent answer is not a "no" (AGENTS.md failure class #5).
 */
function finishFacts(lines, intake) {
  const meta = (Array.isArray(lines) ? lines : []).find((l) => l?.meta && typeof l.meta === "object")?.meta || {};
  const iv = intake && typeof intake === "object" ? intake : {};
  const out = {};
  const colour = text(meta.colour || meta.color || iv.colour || iv.color, 80);
  if (colour) out.colour = colour;
  const sheen = text(meta.sheen || iv.sheen, 40);
  if (sheen) out.sheen = sheen;
  const doorStyle = text(meta.doorStyle || iv.doorStyle, 60);
  if (doorStyle) out.doorStyle = doorStyle;
  if (num(iv.primerCoats) > 0) out.primerCoats = num(iv.primerCoats);
  if (num(iv.topCoats) > 0) out.topCoats = num(iv.topCoats);
  if (iv.twoTone === true) out.twoTone = true;
  if (iv.threeTone === true) out.threeTone = true;
  return Object.keys(out).length ? out : null;
}

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
 * @param crew        names of the people on the job's visits and shifts
 * @param clockedHours  sum of TimeEntry.hours on the job
 * @param forOffice   true keeps hidden items in the model, flagged, so the
 *                    office view can offer to unhide them; false (the crew)
 *                    drops them entirely
 * @param includedByGroup  Map(scopeGroupId → string[]) — the "what's
 *                    included" bullets, resolved by the caller
 * @param addOns      the options the client CHOSE: [{ description, detail, areaLabel }]
 * @param materials   JobMaterial rows still on the list: [{ name, qty, unit, group, purchasedAt }]
 * @param visits      [{ id, scheduledAt, status, notes, assignedTo: { name } }]
 * @param quotedHours QuoteCosting.labourHours — used when the areas sum to none
 */
export function buildWorkOrderModel({
  job,
  client = null,
  ratesById = new Map(),
  tasks = [],
  crew = [],
  clockedHours = 0,
  forOffice = false,
  includedByGroup = new Map(),
  addOns = [],
  materials = [],
  visits = [],
  quotedHours = 0,
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

    const included = (includedByGroup?.get?.(g.id) || []).map((x) => text(x, 300)).filter(Boolean);

    if (takeoff && typeof takeoff === "object" && takeoff.model === "area_substrate") {
      const book = getPriceBook(tradeKey, rates);
      const result = paintTakeoff(takeoff, book?.takeoff);
      const products = book?.takeoff?.products || {};
      let firstOfGroup = true;
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
          // The trade's bullets once, on the group's first area drawn.
          included: firstOfGroup ? included : [],
        }));
        firstOfGroup = false;
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
      // Hidden by the office for THIS job, or written to be hidden from every
      // crew: a library text block ticked "Hidden on work order" (deposit
      // terms, exclusions — lib/quotes/textBlocks.js) carries the flag on the
      // line itself, so it is absent here without anyone hiding it per job.
      const isHidden = hidden.has(key) || l.hiddenOnWorkOrder === true;
      if (isHidden) {
        hiddenCount += 1;
        if (!forOffice) return;
      }
      const meta = l.meta && typeof l.meta === "object" ? l.meta : {};
      lines.push({
        key,
        label: text(l.description, 240),
        // The crew reads sentences, not markers: a block's rich text
        // (**bold**, "- " lists) is flattened to plain lines here.
        detail: text(richTextToPlain(l.detail), 600) || null,
        quantity: num(l.quantity) || 1,
        unit: text(l.unit, 24) || null,
        // The colour the line was sold in, when it says — a paint line's
        // "Chantilly Lace". From meta, which also holds the base price; only
        // the colour is read.
        colour: text(meta.colour || meta.color, 80) || null,
        hidden: isHidden,
      });
    });
    if (!lines.length && !forOffice) continue;
    // Hours from the trade's own model. A cabinet group has no takeoff — its
    // inputs are intake ANSWERS — so its door and drawer counts go in as the
    // config, the translation quoteCosting.js makes for the same reason.
    const counts = cabinetCounts(g?.intakeValues);
    const hoursConfig =
      takeoff && typeof takeoff === "object" ? takeoff : counts ? { ...g.intakeValues, ...counts } : null;
    let hours = 0;
    try {
      hours = hoursConfig ? num(tradeLabourHours(tradeKey, hoursConfig, rates)) : 0;
    } catch {
      // A malformed stored blob reads as "no estimate", never as a broken page.
      hours = 0;
    }
    areas.push(shapeArea({
      key: gKey,
      label: tradeLabel,
      trade: tradeLabel,
      hours,
      // "Cabinet Refinishing × 32" — how many, not only what. A generic
      // "unit" says nothing, so it is left off; "doors" or "sq ft" stays.
      scope: lines.filter((l) => !l.hidden).map(lineScopeText).join("; "),
      lines,
      crewNote: null,
      hidden: groupHidden,
      task: taskByKey.get(gKey) || null,
      included,
      counts,
      finish: finishFacts(rawLines, g?.intakeValues),
    }));
  }

  const visible = areas.filter((a) => !a.hidden);
  const areaHours = visible.reduce((s, a) => s + a.hours, 0);
  // The quote's own estimate stands in only when the areas know nothing —
  // never added to them, which would count the same hours twice.
  const hoursFromQuote = areaHours <= 0 && num(quotedHours) > 0;
  const totalHours = hoursFromQuote ? num(quotedHours) : areaHours;
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
      // The client's PO, printed on the crew copy — a commercial site's gate
      // or site office often asks for it. Null when the job has none, and
      // then nothing prints (lib/documents/clientPo.js).
      clientPoNumber: normaliseClientPo(job?.clientPoNumber),
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
    hoursFromQuote,
    areas,
    addOns: (Array.isArray(addOns) ? addOns : [])
      .filter((a) => a && text(a.description, 240))
      .map((a) => ({
        description: text(a.description, 240),
        detail: text(richTextToPlain(a.detail), 600) || null,
        area: text(a.areaLabel, 80) || null,
      })),
    materials: (Array.isArray(materials) ? materials : [])
      .filter((m) => m && text(m.name, 160))
      .map((m) => ({
        name: text(m.name, 160),
        qty: Math.round(num(m.qty) * 100) / 100,
        unit: text(m.unit, 24) || null,
        group: text(m.group, 80) || null,
        bought: Boolean(m.purchasedAt),
      })),
    visits: (Array.isArray(visits) ? visits : [])
      .filter((v) => v && v.status !== "cancelled" && v.status !== "canceled")
      .map((v) => ({
        id: v.id || null,
        scheduledAt: v.scheduledAt || null,
        status: v.status || "scheduled",
        notes: text(v.notes, 1000) || null,
        assignee: text(v.assignedTo?.name, 80) || null,
      })),
    checklist: (Array.isArray(job?.checklistItems) ? job.checklistItems : [])
      .filter((c) => c && text(c.label, 200))
      .map((c) => ({
        label: text(c.label, 200),
        required: c.required === true,
        phase: text(c.phase, 24) || null,
        done: c.done === true,
      })),
    stats: { done, areas: visible.length, photos: photoCount },
    hiddenCount,
  };
}

/** One line in the crew's words: its label, × how many, and in what unit. */
export function lineScopeText(l) {
  const qty = num(l?.quantity);
  const unit = l?.unit && l.unit !== "unit" ? l.unit : null;
  const many = qty > 0 && (qty !== 1 || unit) ? ` × ${Math.round(qty * 100) / 100}${unit ? ` ${unit}` : ""}` : "";
  return `${l?.label || ""}${many}`.trim();
}

function shapeArea({ key, label, trade, hours, scope, lines, crewNote, hidden, task, included = [], counts = null, finish = null }) {
  return {
    key,
    label,
    trade,
    hours: Math.round(hours * 10) / 10,
    displayHours: displayHours(hours, 1),
    scope,
    lines,
    crewNote,
    included,
    counts,
    finish,
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
