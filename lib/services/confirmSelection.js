// lib/services/confirmSelection.js
//
// The selection model behind "Confirm what you quote"
// (app/app/settings/services/ConfirmServices.js) — pure, browser-safe, and
// executed by scripts/check-confirm-services.mjs, because every count and
// every row on the Selected tab is derived here and nowhere else.
//
// A row arrives from GET /api/settings/products/confirm-services as
//   { seedKey, name, description, unit, price, held, archived, addedForYou }
//   held      the company has it in its list now (an active Product row)
//   archived  the company has it, removed (every row for the key inactive)
//   neither   a suggestion it has never had
//
// The screen's state is two sets of KEYS — `add` (tick a suggestion, or tick
// a removed row back) and `remove` (untick a held row). Nothing is written
// until the confirm button posts both; until then an untick is shown as
// "Removed from your list — Undo" and costs nothing.
//
// Why the counts are computed over every row, held ones included: the first
// version counted only rows the browser could still add, so a group whose
// rows were all already in the list read "0 of 0 selected" over a column of
// ticks (the owner's screenshot, 2026-09-25). A group is "3 of 3 selected"
// when all three will be in the list after Done, whoever put them there.

export function emptySelection() {
  return { add: new Set(), remove: new Set() };
}

const keyOf = (row) => (row && typeof row.seedKey === "string" ? row.seedKey : null);

/** Will this row be in the company's list after Done? */
export function isChecked(row, sel) {
  const key = keyOf(row);
  if (!key) return false;
  if (row.held === true) return !sel?.remove?.has(key);
  return Boolean(sel?.add?.has(key));
}

/** What the row's right-hand column says — see ConfirmServices.js for the words. */
export function rowState(row, sel) {
  const key = keyOf(row);
  if (!key) return "offered";
  if (row.held === true) {
    if (sel?.remove?.has(key)) return "removing";
    return row.addedForYou === true ? "addedForYou" : "inList";
  }
  if (row.archived === true) return sel?.add?.has(key) ? "restoring" : "removed";
  return sel?.add?.has(key) ? "adding" : "offered";
}

function copy(sel) {
  return { add: new Set(sel?.add || []), remove: new Set(sel?.remove || []) };
}

/** Flip one row. A held row toggles in `remove`; anything else in `add`. */
export function toggleRow(sel, row) {
  const next = copy(sel);
  const key = keyOf(row);
  if (!key) return next;
  if (row.held === true) {
    if (next.remove.has(key)) next.remove.delete(key);
    else next.remove.add(key);
  } else if (next.add.has(key)) next.add.delete(key);
  else next.add.add(key);
  return next;
}

/** "Select all" (on = true) / "Clear" (on = false) over the given rows. */
export function setRows(sel, rows, on) {
  const next = copy(sel);
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyOf(row);
    if (!key) continue;
    if (row.held === true) {
      if (on) next.remove.delete(key);
      else next.remove.add(key);
    } else if (on) next.add.add(key);
    else next.add.delete(key);
  }
  return next;
}

/** "{n} of {total} selected" for a group's rows. */
export function groupCount(rows, sel) {
  const list = Array.isArray(rows) ? rows.filter(keyOf) : [];
  return { n: list.filter((r) => isChecked(r, sel)).length, total: list.length };
}

/** The filter box, shared by both tabs: name or description, case-folded. */
export function rowMatches(row, q) {
  const needle = typeof q === "string" ? q.trim().toLowerCase() : "";
  if (!needle) return true;
  return `${row?.name || ""} ${row?.description || ""}`.toLowerCase().includes(needle);
}

/**
 * The Selected tab: every row that will be in the list after Done — held
 * minus unticked, plus ticked — flat, each carrying its group's name, in the
 * groups' own order. A key offered in two groups is listed once.
 */
export function selectedRows(groups, sel, q = "") {
  const out = [];
  const seen = new Set();
  for (const g of Array.isArray(groups) ? groups : []) {
    for (const row of Array.isArray(g?.services) ? g.services : []) {
      const key = keyOf(row);
      if (!key || seen.has(key) || !isChecked(row, sel) || !rowMatches(row, q)) continue;
      seen.add(key);
      out.push({ ...row, groupKey: g.key, groupName: g.name });
    }
  }
  return out;
}

/** How many rows will be in the list after Done (the tab's "(N)"). */
export function selectedTotal(groups, sel) {
  return selectedRows(groups, sel).length;
}

/** The POST body's two lists, sorted so the same selection posts the same bytes. */
export function pendingChanges(sel) {
  return {
    add: [...(sel?.add || [])].sort(),
    remove: [...(sel?.remove || [])].sort(),
  };
}
