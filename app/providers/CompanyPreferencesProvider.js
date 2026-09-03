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
// ── The billing currency lives here too ─────────────────────────────────────
//
// Same argument, one step worse. Roughly forty back-office screens render an
// amount, and almost none of them had the company's currency to hand — so they
// each wrote `$${n.toFixed(2)}` and a British painter read `$1,234.00` on their
// own quote. Threading a prop into forty pages would mean forty chances to miss
// one; the currency is a company-level fact that every /app screen needs, which
// is exactly what this provider already is.
//
// `initialCurrency` comes from the layout's own company query, so the FIRST
// paint is already correct. Without it a GBP company would render CA$ for a
// frame and then swap — a money figure that changes value under the reader is
// worse than one that arrives late.
//
// `money()` binds the currency and the "en" reader locale, matching what
// LineItemsTable / CostMarginPanel / UnitPricingFields already pass by hand.
// Currency belongs to the company, locale to the reader (see lib/format/money.js);
// the back office has never varied the locale, and making it vary here — while
// the four components above still hardcode "en" — would put two groupings of
// the same number on one screen. That is a separate change, all at once.
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
import { moneyFormatter } from "@/lib/format/money";

const CompanyPreferencesContext = createContext(null);

// `currency: null` rather than "CAD". Null is what documentFormatters already
// reads as "the schema default", and writing CAD here would be this file
// asserting a company bills in Canadian dollars when it has not been told
// anything — the padding-absent-data-with-defaults trap. The layout supplies
// the real value; the fetch below is the fallback for a client that mounted
// without one.
const FALLBACK = {
  dateFormat: DEFAULT_DATE_FORMAT,
  weekStartsOn: 0,
  currency: null,
};

export default function CompanyPreferencesProvider({ children, initialCurrency = null }) {
  const [prefs, setPrefs] = useState({
    ...FALLBACK,
    currency: initialCurrency || null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setPrefs((p) => ({
          dateFormat: d.dateFormat || DEFAULT_DATE_FORMAT,
          weekStartsOn: Number(d.weekStartsOn) === 1 ? 1 : 0,
          // A fetch that answers without a currency must not blank the one the
          // server already handed us — "the field is absent" is not "the
          // company has no currency".
          currency: d.currency || p.currency || null,
        }));
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
      money: moneyFormatter(prefs.currency, "en"),
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
      money: moneyFormatter(FALLBACK.currency, "en"),
    }
  );
}

/**
 * Just the money formatter, for the many components that want nothing else.
 *
 *   const money = useCompanyMoney();
 *   …{money(row.amount)}…          // "£1,234.00", never a hardcoded "$"
 *
 * Its own hook because the alternative call sites reach for is a private
 * `const money = (n) => `$${n.toFixed(2)}`` — six of those is how this bug
 * happened the first time (lib/format/money.js has the post-mortem). One
 * import, one line, no props to thread.
 *
 * Safe outside the provider: the formatter falls back to the schema default,
 * so a component rendered in a test harness formats rather than throwing.
 */
export function useCompanyMoney() {
  return useCompanyPreferences().money;
}
