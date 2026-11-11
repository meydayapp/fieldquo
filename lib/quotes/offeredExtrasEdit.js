// lib/quotes/offeredExtrasEdit.js
//
// Who may edit an offered extra, and how a row in the document's READ-ONLY
// mirror reaches the one editor that can.
//
// ── The fault this closes ──────────────────────────────────────────────────
//
// Owner, on a quote open in edit mode: "Not sure why when I go back to a
// quote in edit — Not able to edit the add-ons." He was pressing the little
// squares in the document itself. Those blocks (DocumentBuilder's
// `data-doc-stored-options` and `data-doc-foot-options`) are a picture of
// what the homeowner will read — the square is the box the CLIENT ticks on
// their copy — and they had no interaction of any kind. The real editor
// (OfferedExtras, inside SuggestAddOns) was on the same page the whole time,
// a long scroll further down. Two renderings of one list, only one of them
// editable, and nothing on the page said so.
//
// The fix is a route from the picture to the editor, not a second editor.
// A duplicate list with its own Save button would be two writers for one
// row, and the PUT it saves through replaces the list wholesale.
//
// ── Why the predicate lives here and not in either component ───────────────
//
// The mirror has to make exactly the decision OfferedExtras makes about each
// row, from the same facts, or it offers an Edit button that leads to a
// disabled input — a control that appears to work and doesn't. Two copies of
// "may this row be edited" is the drift that has bitten this repo before (the
// marketing dashboard counting a visit the lead page said never happened), so
// there is one copy and both sites call it.
//
// NOT `OPEN_STATUSES` (draft + sent), which QuoteBuilder uses for the scope:
// SuggestAddOns' own rule is "the client has decided", and while those two
// happen to be complements across today's four QuoteStatus members, they are
// different questions and a fifth status would split them.
//
// ── Why the hook is keyed on the id and not on the text ────────────────────
//
// Matching the row by its description would break on the first extra whose
// text the estimator edits, on two extras with the same name (the "double
// hinges" pair the review warns about are both real rows), and on any
// language where the mirror and the editor render different strings. The id
// is QuoteAddOn.id — the key the PUT route already round-trips.
//
// ── And why the SAVE is in here too ────────────────────────────────────────
//
// Sending people from the document to the editor made a second fault
// reachable: the editor saved through PUT /api/quotes/[id]/add-ons and told
// nobody, while the mirror drew server data frozen at page load. Change a
// price, press Save extras, scroll back up, read the old price — "it didn't
// save", and the owner would have been right. So the success half of that
// save — what the panel keeps, what the parent is handed — is one function
// here (`applySavedExtras`), driven through the caller's own setters the way
// lib/quotes/applyActuals.js is. It lives in lib/ for the same reason that
// one does: the panel cannot be rendered past its loading state without a
// database, so a check can only EXECUTE this, never click it.

/**
 * The QuoteStatus values that put the offered extras beyond editing.
 *
 * The client has decided; the list they ticked is a record of what they were
 * offered, and rewriting it afterwards rewrites history.
 */
export const DECIDED_STATUSES = Object.freeze(["accepted", "declined"]);

/** SuggestAddOns' `readOnly`, as one function. */
export function extrasReadOnlyFor(status) {
  return DECIDED_STATUSES.includes(String(status ?? ""));
}

/**
 * May the estimator edit THIS row?
 *
 * `source === "takeoff"` is regenerated from the scope group on every save,
 * so OfferedExtras shows those fields disabled and says to change the room
 * instead. The mirror must not offer an edit affordance on one.
 */
export function extraRowEditable(addOn, { readOnly = false } = {}) {
  if (readOnly) return false;
  if (!addOn || typeof addOn !== "object") return false;
  return String(addOn.source ?? "") !== "takeoff";
}

/** The editor's description input, keyed on QuoteAddOn.id. */
export const EXTRA_INPUT_ATTR = "data-offered-extra";
/** The editor's heading block — where "Edit extras" lands. */
export const EXTRAS_SECTION_ATTR = "data-offered-section";
/** The review panel's outer card, which exists even while it is loading. */
export const EXTRAS_PANEL_ATTR = "data-offered-panel";

const normaliseId = (id) => {
  if (typeof id !== "string" && typeof id !== "number") return "";
  const v = String(id).trim();
  return v;
};

/**
 * The attributes the editor's description input carries — nothing at all for
 * a row that cannot be edited, so the hook itself means "focusable", and a
 * mirror button can never point at a disabled field.
 *
 * Returned as a spreadable object rather than a string so the rule lives in
 * one expression that a check can execute.
 */
export function extraInputAttrs(addOn, { readOnly = false } = {}) {
  const id = normaliseId(addOn?.id);
  if (!id || !extraRowEditable(addOn, { readOnly })) return {};
  return { [EXTRA_INPUT_ATTR]: id };
}

/**
 * `[data-offered-extra="…"]` for one id, or null when there is no usable id.
 *
 * Ids come from the database, so they are cuids today — but a selector built
 * by concatenation is one bad value away from a thrown SyntaxError that would
 * look, on a phone, exactly like the dead button this file exists to remove.
 * Quotes, backslashes and control characters are escaped the way CSS strings
 * require.
 */
export function extraSelector(id) {
  const v = normaliseId(id);
  if (!v) return null;
  const escaped = v.replace(/[\\"]/g, "\\$&").replace(/[\u0000-\u001f\u007f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
  return `[${EXTRA_INPUT_ATTR}="${escaped}"]`;
}

/**
 * What is actually on the page for this id, best first.
 *
 * `row` is the input itself. `section` is the editor's heading — the answer
 * when the id is unknown (the "Edit extras" affordance passes none) or when
 * the row is not drawn yet. `panel` is the review card, which is all there is
 * while it loads: it opens on a pulse and fills itself from two GETs, so a
 * press a second after the page paints finds no rows at all. Null means the
 * editor is not on this screen, and the caller must not pretend otherwise.
 */
export function offeredExtraTarget(doc, id) {
  if (!doc || typeof doc.querySelector !== "function") return null;
  const find = (selector) => {
    try {
      return doc.querySelector(selector) || null;
    } catch {
      return null;
    }
  };
  const selector = extraSelector(id);
  if (selector) {
    const row = find(selector);
    if (row) return { kind: "row", el: row };
  }
  const section = find(`[${EXTRAS_SECTION_ATTR}]`);
  if (section) return { kind: "section", el: section };
  const panel = find(`[${EXTRAS_PANEL_ATTR}]`);
  if (panel) return { kind: "panel", el: panel };
  return null;
}

/**
 * Put the editor under the thumb, and the cursor in this extra's own field.
 *
 * Phone-first: the mirror and the editor are the same page but metres apart,
 * so the press scrolls as well as focuses. When only the loading panel is
 * there it scrolls to that and keeps looking for the row until the GETs land
 * — a button that scrolls to something not yet rendered is the same dead
 * control in a new place. The retry is bounded; nothing here waits forever.
 *
 * Returns what this attempt reached, so a check can execute it without a
 * browser: `{ kind, focused, waiting }`.
 */
export function openOfferedExtra(id, options = {}) {
  const {
    doc = typeof document === "undefined" ? null : document,
    attempts = 25,
    delay = 120,
    schedule = (fn, ms) => (typeof setTimeout === "function" ? setTimeout(fn, ms) : null),
  } = options;
  const wantRow = Boolean(normaliseId(id));
  let scrolled = false;
  let tries = 0;

  const step = () => {
    tries += 1;
    const found = offeredExtraTarget(doc, id);
    if (!found) return { kind: null, focused: false, waiting: false };
    // Scrolled once on the way there, and again only when the row itself
    // turns up — re-issuing a smooth scroll every 120ms fights the browser.
    if (!scrolled || found.kind === "row") {
      scrolled = true;
      try {
        found.el.scrollIntoView?.({ behavior: "smooth", block: "center" });
      } catch {
        /* a detached node is not worth a thrown handler */
      }
    }
    if (found.kind === "row") {
      let focused = false;
      try {
        found.el.focus?.({ preventScroll: true });
        focused = true;
      } catch {
        /* ditto */
      }
      return { kind: "row", focused, waiting: false };
    }
    if (wantRow && tries < attempts) {
      schedule(step, delay);
      return { kind: found.kind, focused: false, waiting: true };
    }
    return { kind: found.kind, focused: false, waiting: false };
  };

  return step();
}

/**
 * The rows everyone draws after a successful "Save extras".
 *
 * The ROUTE's answer, never the array the editor submitted. The PUT deletes
 * every non-takeoff row and re-creates it, so the submitted array's ids are
 * dead the moment the save succeeds — and those ids are what the document's
 * per-row Edit aims at. The answer also replies with the takeoff-sourced rows
 * the PUT deliberately never touches, so it is the whole list and is taken
 * wholesale.
 *
 * The response's own array is returned by reference on purpose: a copy here
 * would be a second thing to keep in step with the route.
 */
export function savedExtrasFrom(response) {
  return Array.isArray(response?.addOns) ? response.addOns : [];
}

/**
 * Apply a successful save: what the panel keeps, and what anyone else drawing
 * the same list is handed.
 *
 * `handlers` are the panel's own setters plus the parent's `onAddOnsSaved`,
 * exactly as lib/quotes/applyActuals.js takes the builder's. Nothing here
 * decides whether the save worked — the caller's try/catch owns that, and a
 * FAILED save must never reach this function, which is why there is no
 * "failed" branch in it to get the condition wrong in. A parent that mirrors
 * the list then keeps showing what is stored rather than what was attempted.
 *
 * Returns the rows it applied, so a caller can use them without reaching
 * back into its own state.
 */
/**
 * The save itself: write the list, then apply what came back.
 *
 * `put(rows)` is the caller's own request — the panel passes a `fetchJson`
 * to PUT /api/quotes/[id]/add-ons — and the rows that are APPLIED are that
 * call's answer, by construction. The submitted array is never in scope
 * here for anything but sending, which is the point: it is the one shape of
 * this bug a reviewer cannot see by reading, because the two arrays look
 * alike and differ only in the ids the route re-minted.
 *
 * A rejection is re-thrown untouched and NOTHING is applied: the panel's own
 * catch reports it, and anyone mirroring the list keeps showing what is
 * stored rather than what was attempted.
 */
export async function saveOfferedExtras({ rows, put, handlers } = {}) {
  if (typeof put !== "function") throw new TypeError("saveOfferedExtras needs a put()");
  const response = await put(rows);
  return applySavedExtras(response, handlers);
}

export function applySavedExtras(response, handlers = {}) {
  const {
    setAddOns,
    setCuratedAt,
    setSavedAt,
    setEdited,
    onAddOnsSaved,
    now = () => Date.now(),
  } = handlers;
  const rows = savedExtrasFrom(response);
  setAddOns?.(rows);
  // Quote.addOnsCuratedAt, from the answer rather than assumed: a save that
  // somehow left the marker alone must not leave the panel believing this
  // list is protected from the review's auto-append.
  setCuratedAt?.(response?.addOnsCuratedAt || null);
  setSavedAt?.(now());
  setEdited?.(false);
  onAddOnsSaved?.(rows);
  return rows;
}
