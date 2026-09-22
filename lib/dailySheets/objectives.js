// lib/dailySheets/objectives.js
//
// The two JSON columns on a daily sheet, and where their rows come from.
//
// ── Objectives ────────────────────────────────────────────────────────────
//
// From the plan when there is one: the Task rows on the job assigned to this
// person and due that day (the job plan writes Task rows with a jobId — see
// lib/tasks/). When the plan has nothing for them, the coordinator types
// objectives. Either way the sheet stores its own copy with `taskId` set for
// the ones that came from a task, so a task renamed later does not rewrite
// what the person was asked to do that morning — and so a typed objective
// and a planned one are the same shape to every reader.
//
// ── Upsells ───────────────────────────────────────────────────────────────
//
// An add-on the crew member sold on site. Linked to a QuoteAddOn (the
// homeowner ticked it on the job's quote) or a ChangeOrder (priced on the
// job) when one exists — the amount is COPIED from that row by the route,
// never from the request. A typed upsell (nothing on file) carries the
// amount the coordinator typed; it is a crediting figure for a bonus, not a
// price a client sees, and the route that stores it is owner/coordinator-
// only.
//
// Pure: every normaliser takes a request body and returns the stored shape
// or drops the row; scripts/check-daily-objectives.mjs feeds them garbage.

export const OBJECTIVE_STATUSES = ["planned", "done", "partial", "not_done"];

const MAX_ROWS = 40;
const MAX_TEXT = 300;

const text = (v, max = MAX_TEXT) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const idish = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);
const hours = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n * 100) / 100 : null;
};
const url = (v) => (typeof v === "string" && /^https?:\/\/\S{1,500}$/.test(v) ? v : null);

let seq = 0;
const newId = () => `o${Date.now().toString(36)}${(++seq).toString(36)}`;

/** Objective rows from Task rows: title, planned hours when the task says, taskId. */
export function objectivesFromTasks(tasks) {
  const out = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task || !idish(task.id) || !text(task.title)) continue;
    out.push({
      id: newId(),
      taskId: task.id,
      title: text(task.title, 200),
      plannedHours: hours(task.estimatedHours ?? task.plannedHours),
      status: task.status === "done" || task.status === "completed" ? "done" : "planned",
      actualHours: null,
      note: "",
      beforePhoto: null,
      afterPhoto: null,
    });
  }
  return out;
}

/** The stored objective list from a request body. Drops rows without a title. */
export function normaliseObjectives(input) {
  const out = [];
  for (const row of Array.isArray(input) ? input.slice(0, MAX_ROWS) : []) {
    if (!row || typeof row !== "object") continue;
    const title = text(row.title, 200);
    if (!title) continue;
    out.push({
      id: idish(row.id) || newId(),
      taskId: idish(row.taskId),
      title,
      plannedHours: hours(row.plannedHours),
      status: OBJECTIVE_STATUSES.includes(row.status) ? row.status : "planned",
      actualHours: hours(row.actualHours),
      note: text(row.note),
      beforePhoto: url(row.beforePhoto),
      afterPhoto: url(row.afterPhoto),
    });
  }
  return out;
}

/**
 * The stored upsell list. `linked` maps a QuoteAddOn / ChangeOrder id the
 * route already loaded (company-scoped) to its amount in cents and label;
 * a row that names an id NOT in the map is dropped — an id from another
 * tenant, or one that was deleted, cannot credit anybody.
 */
export function normaliseUpsells(input, linked = new Map()) {
  const out = [];
  for (const row of Array.isArray(input) ? input.slice(0, MAX_ROWS) : []) {
    if (!row || typeof row !== "object") continue;
    const addOnId = idish(row.quoteAddOnId);
    const changeOrderId = idish(row.changeOrderId);
    if (addOnId || changeOrderId) {
      const key = addOnId ? `addon:${addOnId}` : `co:${changeOrderId}`;
      const hit = linked.get(key);
      if (!hit) continue;
      out.push({
        id: idish(row.id) || newId(),
        description: hit.description || text(row.description, 200) || "",
        amountCents: hit.amountCents,
        quoteAddOnId: addOnId,
        changeOrderId,
      });
      continue;
    }
    const description = text(row.description, 200);
    const cents = Math.round(Number(row.amountCents));
    if (!description) continue;
    out.push({
      id: idish(row.id) || newId(),
      description,
      amountCents: Number.isFinite(cents) && cents >= 0 && cents <= 100_000_000 ? cents : 0,
      quoteAddOnId: null,
      changeOrderId: null,
    });
  }
  return out;
}

/** 1–5 or null. */
export function normaliseScore(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}
