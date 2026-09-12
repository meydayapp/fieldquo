// app/components/sales/SalesSearch.js
//
// The top bar's search box, and the rule that it only exists when a screen
// is listening to it.
//
// ══ Why a context and not a box on every screen ═══════════════════════════
//
// The reference dialler the owner sent has one search box in the top bar. On
// the queue it filters the day's list by business name or number. On the
// other screens nothing on the page reads a query — and a search box above a
// screen that does not search is the dead control AGENTS.md opens by
// forbidding: it accepts typing and changes nothing.
//
// So the box is drawn by the shell but OWNED by the screen: a screen that
// wants it calls useSalesSearch({ placeholder }) and gets the live query
// back; the shell renders the input only while a consumer is registered.
// Leave the queue and the box goes with it. Nothing here filters anything —
// the screen does, client-side, over the payload it already has.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);

export function SalesSearchProvider({ children }) {
  const [query, setQuery] = useState("");
  const [consumer, setConsumer] = useState(null);

  // The query is cleared when the consumer changes: a filter typed on the
  // queue must not survive into the next screen that asks for the box.
  const register = useCallback((spec) => {
    setConsumer(spec);
    setQuery("");
    return () => {
      setConsumer((current) => (current === spec ? null : current));
      setQuery("");
    };
  }, []);

  const value = useMemo(
    () => ({ query, setQuery, consumer, register }),
    [query, consumer, register],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shell's side: what to draw, if anything. */
export function useSalesSearchBox() {
  return useContext(Ctx) || { query: "", setQuery: () => {}, consumer: null, register: () => () => {} };
}

/**
 * The screen's side. Registers a consumer for as long as the component is
 * mounted and returns the live query. `placeholder` is already translated by
 * the caller — this file owns no words.
 */
export function useSalesSearch({ placeholder = "" } = {}) {
  const ctx = useContext(Ctx);
  const register = ctx?.register;
  useEffect(() => {
    if (!register) return undefined;
    return register({ placeholder });
  }, [register, placeholder]);
  return ctx?.query || "";
}
