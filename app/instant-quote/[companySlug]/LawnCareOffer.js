// app/instant-quote/[companySlug]/LawnCareOffer.js
//
// The lawn-care offer on the public instant-quote page: the programs as
// cards ("Best value" on the cheapest per service), each one's included
// services expandable, and the add-ons as checkboxes.
//
// Two sources feed it and they are deliberately different things:
//
//   `offer`   the NAMES — programs, services, descriptions, windows — which
//             arrive with the page (loadCompanyInstantTrades) and carry no
//             price, so the cards render before anything is measured and
//             in every visibility mode;
//   `priced`  the PRICES for this property, from /measure, present only when
//             the owner shows figures before submit ("range"). Absent, the
//             cards have no amount on them and say nothing about one.
//
// The browser never sends money: what leaves here is a program KEY and add-on
// KEYS (onPick), and the server reprices from its own card (#5). The total
// shown under the cards is the sum of the server's own per-item figures,
// for display; the figure on the confirmation is the server's.
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";
import { formatMoney } from "@/lib/currency";

export default function LawnCareOffer({ offer, priced, pick, onPick, language = "en", currency, theme, solid }) {
  const t = lawnEstimateCopy(language);
  const locale = language === "fr" ? "fr-CA" : language === "es" ? "es" : "en-CA";
  const money = (n) => estimateMoneyCents(n, currency, locale);
  const [open, setOpen] = useState({});

  const programs = offer?.programs || [];
  const addOns = offer?.addOns || [];
  const priceOf = (key) =>
    priced ? [...(priced.programs || []), ...(priced.addOns || [])].find((x) => x.key === key)?.price ?? null : null;
  const bestKey = priced ? (priced.programs || []).find((p) => p.bestValue)?.key : null;

  const services = addOns.filter((a) => a.kind !== "program");
  const addOnPrograms = addOns.filter((a) => a.kind === "program");

  const toggleAddOn = (key) => {
    const next = pick.addOnKeys.includes(key) ? pick.addOnKeys.filter((k) => k !== key) : [...pick.addOnKeys, key];
    onPick({ ...pick, addOnKeys: next });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {t.programsHeading} <span className="text-red-600">*</span>
        </h3>
        <div className="space-y-2">
          {programs.map((p) => {
            const selected = pick.programKey === p.key;
            const price = priceOf(p.key);
            const expanded = Boolean(open[p.key]);
            return (
              <div
                key={p.key}
                className={`rounded-xl border bg-card ${selected ? "border-transparent" : "border-border"}`}
                style={selected ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => onPick({ ...pick, programKey: p.key })}
                  className="w-full text-left px-4 py-3 min-h-11"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
                        {p.name}
                        {bestKey === p.key && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
                            // fillPair's measured pair, not white on the
                            // brand: the badge is a fill carrying text.
                            style={{ background: solid.bg, color: solid.fg, borderColor: theme.accentText }}
                          >
                            {t.bestValue}
                          </span>
                        )}
                      </div>
                      {p.window && <div className="text-xs text-muted-foreground mt-0.5">{p.window}</div>}
                      {p.description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.description}</p>}
                    </div>
                    {price != null && (
                      <div className="text-base font-bold tabular-nums shrink-0" style={{ color: theme.accentText }}>
                        {money(price)}
                      </div>
                    )}
                  </div>
                </button>
                {p.services?.length > 0 && (
                  <div className="border-t border-border px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [p.key]: !expanded }))}
                      className="flex items-center gap-1 text-xs font-medium text-foreground min-h-8"
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {t.included} · {t.perService(p.services.length)}
                    </button>
                    {expanded && (
                      <ul className="mt-1 space-y-2 pb-1">
                        {p.services.map((s) => {
                          const sp = priced ? (priced.programs || []).find((x) => x.key === p.key)?.services?.find((x) => x.key === s.key)?.price ?? null : null;
                          return (
                            <li key={s.key} className="text-xs">
                              <div className="flex justify-between gap-3">
                                <span className="font-medium text-foreground">
                                  {s.name}
                                  {s.window && <span className="font-normal text-muted-foreground"> · {s.window}</span>}
                                </span>
                                {sp != null && <span className="tabular-nums text-foreground">{money(sp)}</span>}
                              </div>
                              {s.description && <p className="text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {[
        [services, t.addOnsHeading],
        [addOnPrograms, t.addOnProgramsHeading],
      ].map(([list, heading]) =>
        list.length ? (
          <div key={heading}>
            <h3 className="text-sm font-semibold text-foreground mb-2">{heading}</h3>
            <div className="space-y-2">
              {list.map((a) => {
                const on = pick.addOnKeys.includes(a.key);
                const price = priceOf(a.key);
                return (
                  <label
                    key={a.key}
                    className={`flex items-start gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer ${on ? "border-transparent" : "border-border"}`}
                    style={on ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
                  >
                    <input type="checkbox" className="mt-1" checked={on} onChange={() => toggleAddOn(a.key)} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">{a.name}</span>
                        {price != null && (
                          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: theme.accentText }}>
                            {money(price)}
                          </span>
                        )}
                      </span>
                      {a.window && <span className="block text-xs text-muted-foreground mt-0.5">{a.window}</span>}
                      {a.description && <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{a.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

// Program prices are to the cent (the competitor prints 151.76, and a
// program is a price, not an estimate range), so the whole-unit formatter
// the range panel uses would round them. formatMoney is the same currency
// table with the cents kept; a non-finite amount is absence, not $0.00.
function estimateMoneyCents(amount, currency, locale) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return formatMoney(amount, currency, locale);
}

/** The display total for a pick — the sum of the SERVER's per-item figures. */
export function lawnPickTotal(priced, pick) {
  if (!priced) return null;
  let total = 0;
  let any = false;
  const p = (priced.programs || []).find((x) => x.key === pick.programKey);
  if (p) {
    total += Number(p.price) || 0;
    any = true;
  }
  for (const a of priced.addOns || []) {
    if (pick.addOnKeys.includes(a.key)) {
      total += Number(a.price) || 0;
      any = true;
    }
  }
  return any ? Math.round(total * 100) / 100 : null;
}

export { estimateMoneyCents };
