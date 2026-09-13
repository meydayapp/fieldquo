// lib/onboarding/run.js
//
// One person's checklist, from the day it starts to the day it completes.
// Pure: every function takes rows and returns rows, and scripts/check-hr.mjs
// walks a run through its whole life without a database.
//
// ══ The items are copied at start ══════════════════════════════════════════
//
// A run stores the template's items as they were on day one. A manager who
// adds "forklift ticket" to the template a month later is describing the
// NEXT hire; the person halfway through does not wake up with a new overdue
// item. Progress lives on the copy.
//
// ══ Three kinds tick themselves ════════════════════════════════════════════
//
// A `document`, `policy` or `form` item is done when the evidence exists —
// the upload, the signature, the submitted form — and never by somebody
// ticking a box. `reconcile()` reads the evidence and stamps the item, with
// the evidence's own id on it, so the checklist and the file cannot
// disagree. Only a `task` is ticked by hand, and the row remembers who.
//
// ══ Completion is required items, not all items ════════════════════════════
//
// "Upload your trade tickets" is optional for an apprentice who has none.
// A run completes when every REQUIRED item is done; optional ones stay open
// without holding the person in onboarding forever.
const DAY_MS = 86400000;

/** The template's items, opened. */
export function openItems(templateItems) {
  return (Array.isArray(templateItems) ? templateItems : []).map((it) => ({
    ...it,
    status: "open",
    doneAt: null,
    doneByUserId: null,
    doneByName: null,
    documentId: null,
    acknowledgementId: null,
    taxFormId: null,
  }));
}

/**
 * Stamp the evidence-driven items from what the file actually holds.
 *
 * @param items            the run's items
 * @param evidence         { documents: [{id, kind, archivedAt, createdAt}],
 *                           acknowledgements: [{id, policyId, policyVersion, acknowledgedAt}],
 *                           policies: [{id, version}],
 *                           taxForms: [{id, formKind, submittedAt}] }
 * @returns {{ items, changed }}
 *
 * A signature on an OLD version of a policy does not tick the item: the
 * company changed the text and asked again. A document that was archived
 * does not either — archiving the only licence on file re-opens the item,
 * which is the honest reading of "we no longer hold one".
 */
export function reconcile(items, evidence = {}) {
  const documents = evidence.documents || [];
  const acks = evidence.acknowledgements || [];
  const policies = new Map((evidence.policies || []).map((p) => [p.id, p.version]));
  const forms = evidence.taxForms || [];
  let changed = false;

  const next = (items || []).map((it) => {
    if (it.kind === "task") return it;
    let proof = null;
    if (it.kind === "document") {
      const doc = documents
        .filter((d) => d.kind === it.documentKind && !d.archivedAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (doc) proof = { documentId: doc.id, doneAt: doc.createdAt };
    } else if (it.kind === "policy") {
      const version = policies.get(it.policyId);
      const ack = version == null ? null : acks.find((a) => a.policyId === it.policyId && a.policyVersion === version);
      if (ack) proof = { acknowledgementId: ack.id, doneAt: ack.acknowledgedAt };
    } else if (it.kind === "form") {
      const form = forms
        .filter((f) => f.formKind === it.formKind)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
      if (form) proof = { taxFormId: form.id, doneAt: form.submittedAt };
    }

    const shouldBeDone = !!proof;
    const isDone = it.status === "done";
    if (shouldBeDone === isDone) return it;
    changed = true;
    return shouldBeDone
      ? { ...it, status: "done", doneAt: proof.doneAt, doneByUserId: null, doneByName: null, ...proof }
      : { ...it, status: "open", doneAt: null, doneByUserId: null, doneByName: null, documentId: null, acknowledgementId: null, taxFormId: null };
  });
  return { items: next, changed };
}

/**
 * Tick (or untick) a TASK by hand.
 *
 * @returns {{ items }} or {{ error }} — an evidence item refuses, with the
 *   reason, because ticking "upload your ID" without an ID is exactly the
 *   dead control AGENTS.md forbids.
 */
export function setTaskDone(items, key, { done = true, byUserId = null, byName = null, at = new Date() } = {}) {
  const idx = (items || []).findIndex((it) => it.key === key);
  if (idx === -1) return { error: "That item isn't on this checklist." };
  const it = items[idx];
  if (it.kind !== "task") return { error: "That item is completed by the upload, signature or form itself, not by ticking it." };
  const next = items.slice();
  next[idx] = done
    ? { ...it, status: "done", doneAt: at, doneByUserId: byUserId, doneByName: byName }
    : { ...it, status: "open", doneAt: null, doneByUserId: null, doneByName: null };
  return { items: next };
}

/** Counts, and whether the run is complete (every required item done). */
export function progress(items) {
  const list = items || [];
  const total = list.length;
  const done = list.filter((it) => it.status === "done").length;
  const required = list.filter((it) => it.required !== false);
  const requiredDone = required.filter((it) => it.status === "done").length;
  return { total, done, requiredTotal: required.length, requiredDone, complete: required.length > 0 ? requiredDone === required.length : done === total };
}

/** The day an item is due, or null for no deadline. */
export function dueDate(item, startedAt) {
  if (item?.dueDays == null) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + Number(item.dueDays) * DAY_MS);
}

/** Open items whose due day has passed. */
export function overdueItems(items, startedAt, asOf = new Date()) {
  const now = new Date(asOf).getTime();
  return (items || []).filter((it) => {
    if (it.status === "done") return false;
    const due = dueDate(it, startedAt);
    return due && due.getTime() < now;
  });
}

/**
 * What to write on the run after its items changed: the items, and
 * completedAt stamped on the first moment every required item is done, or
 * cleared if an item re-opened (an archived licence un-completes a run — the
 * file no longer holds what the checklist said it held).
 */
export function runPatch(run, items, now = new Date()) {
  const p = progress(items);
  const data = { items };
  if (p.complete && !run?.completedAt) data.completedAt = now;
  if (!p.complete && run?.completedAt) data.completedAt = null;
  return { data, progress: p, justCompleted: !!data.completedAt && !run?.completedAt };
}

/** A run as the screens read it: each item with its due date and overdue
 *  flag, plus the counts. */
export function describeRun(run, asOf = new Date()) {
  if (!run) return null;
  const overdue = new Set(overdueItems(run.items, run.startedAt, asOf).map((it) => it.key));
  return {
    ...run,
    items: (run.items || []).map((it) => ({ ...it, dueAt: dueDate(it, run.startedAt), overdue: overdue.has(it.key) })),
    progress: progress(run.items),
  };
}
