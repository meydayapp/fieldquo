// app/providers/TradeGateProvider.js
//
// The company's resolved trade gate ({ cabinetRates, materialCosts } from
// lib/settings/tradeGate.js's companyTradeGate()), handed down by
// app/app/layout.js so the FIRST paint of every menu is already right.
//
// It used to be resolved by app/app/settings/layout.js and passed to the
// settings sidebar as a prop, because only that sidebar drew a trade-gated
// row. The shell reorganisation (2026-09-21) folded the settings rows into
// the one rail, the settings index and the phone sheet — three more readers
// — so the value moved one layout up and became a context, the same way the
// feature flags and the permission grid travel. Null means "unresolved",
// which every consumer reads as "show it" (lib/settings/tradeGateNav.js).
"use client";

import { createContext, useContext } from "react";

const TradeGateContext = createContext(null);

export function TradeGateProvider({ tradeGate, children }) {
  return <TradeGateContext.Provider value={tradeGate ?? null}>{children}</TradeGateContext.Provider>;
}

/** Null outside the provider or while unresolved — never throws. */
export function useTradeGate() {
  return useContext(TradeGateContext);
}
