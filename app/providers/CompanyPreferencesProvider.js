// app/providers/CompanyPreferencesProvider.js
//
// The company's display preferences, fetched once for the whole app.
//
// ── Why a provider rather than each page fetching ───────────────────────────
//
// Date format and week start are needed by roughly every list and detail
// screen in the product. Having each fetch business-info would mean a dozen
// identical requests per navigation, and — worse — dates that render in the
// wrong format for a frame before the preference arrives. Fetched once at the
// layout, read from context everywhere.
//
// ── Defaults are the app's, not empty ───────────────────────────────────────
//
// Until the fetch resolves, and forever on a failure, this returns
// MM/DD/YYYY and Sunday — the same values the settings form starts with. A
// preferences fetch that fails must degrade to "the old behaviour", never to
// blank dates on a page full of them.
//
// ── Internal only ───────────────────────────────────────────────────────────
//
// Nothing under /q, /portal, /book or /quote should consume this. Those are
// client-facing and format by the CLIENT's locale — see the note at the top of
// lib/format/companyDate.js. The provider is mounted in the /app layout only,
// which makes that boundary structural rather than a rule to remember.
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  formatCompanyDate,
  formatCompanyDateTime,
  DEFAULT_DATE_FORMAT,
} from "@/lib/format/companyDate";

const CompanyPreferencesContext = createContext(null);

const FALLBACK = { dateFormat: DEFAULT_DATE_FORMAT, weekStartsOn: 0 };

export default function CompanyPreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setPrefs({
          dateFormat: d.dateFormat || DEFAULT_DATE_FORMAT,
          weekStartsOn: Number(d.weekStartsOn) === 1 ? 1 : 0,
        });
      })
      // Swallowed: the fallback is already in state and is the behaviour
      // every screen had before this existed.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      ...prefs,
      formatDate: (v) => formatCompanyDate(v, prefs.dateFormat),
      formatDateTime: (v) => formatCompanyDateTime(v, prefs.dateFormat),
    }),
    [prefs],
  );

  return (
    <CompanyPreferencesContext.Provider value={value}>
      {children}
    </CompanyPreferencesContext.Provider>
  );
}

/**
 * Usable outside the provider — returns the defaults rather than throwing.
 *
 * A date helper that throws when someone renders a component on a page that
 * happens to sit outside the layout turns a cosmetic preference into a white
 * screen. Not a trade worth making.
 */
export function useCompanyPreferences() {
  return (
    useContext(CompanyPreferencesContext) || {
      ...FALLBACK,
      formatDate: (v) => formatCompanyDate(v, FALLBACK.dateFormat),
      formatDateTime: (v) => formatCompanyDateTime(v, FALLBACK.dateFormat),
    }
  );
}
