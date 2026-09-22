// app/components/layout/rovingRows.js
//
// Arrow-key movement between the rows of a list: the rail, the settings
// panel, the More sheet, the search results. Every row carries `data-nav-row`
// (a link or a group header) and the container passes the handler to
// onKeyDown. Tab still works as before — this ADDS ↑/↓/Home/End, it does not
// trap focus — so a screen-reader user who never learns the arrows loses
// nothing, and a keyboard user who does gets the rail in five presses
// instead of forty.
//
// Pure DOM, no state: the "current" row is whichever has focus, so there is
// nothing to keep in sync with the route or the disclosure. Rows inside a
// translated-away list are `inert` and therefore not focusable, which is
// what keeps the arrows on the visible list.
"use client";

import { useCallback } from "react";

const ROW = "[data-nav-row]";

function rowsIn(container) {
  return [...container.querySelectorAll(ROW)].filter((el) => {
    if (el.closest("[inert]")) return false;
    // display:none rows (a folded group's items are unmounted, but be safe).
    return el.offsetParent !== null || el.getClientRects().length > 0;
  });
}

/** onKeyDown for the list container. */
export function useRovingRows() {
  return useCallback((e) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const rows = rowsIn(e.currentTarget);
    if (rows.length === 0) return;
    const i = rows.indexOf(document.activeElement);
    let next;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    else if (e.key === "ArrowDown") next = i < 0 ? 0 : Math.min(rows.length - 1, i + 1);
    else next = i < 0 ? rows.length - 1 : Math.max(0, i - 1);
    e.preventDefault();
    rows[next].focus();
  }, []);
}
