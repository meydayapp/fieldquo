// app/components/quotes/builder/LawnProgramPicker.js
//
// The estimator's side of the lawn-care offer: the company's programs and
// add-ons, priced by the measured lawn's size band, picked into the scope
// group's lines.
//
// It reads the group's Lot Size — the box LotAreaMeasure fills from the
// trace and the estimator can overrule — and asks the server for the
// company's card priced at that size (/api/quotes/lawn-care-offer). The
// prices shown are the server's; nothing here computes one. Picking writes
// the lines through lib/quotes/lawnLines.js: one line per program with the
// included treatments in its detail, one per add-on. Re-picking replaces the
// picker's own lines (they carry meta.lawn) and leaves hand-typed lines
// alone.
//
// A company with no lawn-care card yet is told where to make one, rather
// than shown a picker with nothing in it.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { lawnLinesFromOffer, splitLawnLines } from "@/lib/quotes/lawnLines";
import { formatAppMoney } from "@/lib/format/money";

export default function LawnProgramPicker({ areaSqft, language = "en", currency, lineItems = [], onLines }) {
  const { t } = useTranslation();
  const [offer, setOffer] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ready | none | error
  const [err, setErr] = useState("");

  // What the group already holds, so reopening the panel shows the picks
  // that produced its lines rather than an empty form over a priced group.
  const existing = useMemo(() => splitLawnLines(lineItems).lawn, [lineItems]);
  const [programKey, setProgramKey] = useState(existing.find((l) => l.meta.lawn.kind === "program")?.meta.lawn.key || null);
  const [addOnKeys, setAddOnKeys] = useState(existing.filter((l) => l.meta.lawn.kind === "addon").map((l) => l.meta.lawn.key));

  const size = Math.round(Number(areaSqft) || 0);

  useEffect(() => {
    if (!(size > 0)) {
      setOffer(null);
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetchJson(`/api/quotes/lawn-care-offer?areaSqft=${size}&language=${encodeURIComponent(language)}`);
        if (cancelled) return;
        if (!res.ok) {
          setOffer(null);
          setState("none");
          return;
        }
        setOffer(res);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setErr(e.message || "");
        setState("error");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [size, language]);

  const money = (n) => formatAppMoney(n, currency);

  function apply(nextProgram, nextAddOns) {
    if (!offer) return;
    const lines = lawnLinesFromOffer(offer, { programKey: nextProgram, addOnKeys: nextAddOns }, { language, currencyFormat: money });
    onLines?.(lines);
  }

  function pickProgram(key) {
    const next = programKey === key ? null : key;
    setProgramKey(next);
    apply(next, addOnKeys);
  }
  function toggleAddOn(key) {
    const next = addOnKeys.includes(key) ? addOnKeys.filter((k) => k !== key) : [...addOnKeys, key];
    setAddOnKeys(next);
    apply(programKey, next);
  }

  if (!(size > 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("app.lawn.programs.needSize", "Trace the lawn or type its size above to price the programs.")}
      </p>
    );
  }

  if (state === "loading" && !offer) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 size={12} className="animate-spin" /> {t("app.lawn.programs.pricing", "Pricing programs…")}
      </p>
    );
  }
  if (state === "none") {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        {t("app.lawn.programs.notConfigured", "No lawn-care programs are set up yet.")}{" "}
        <Link href="/app/settings/instant-quotes" className="underline text-foreground">
          {t("app.lawn.programs.setUp", "Set them up under Settings › Instant Quotes")}
        </Link>
      </div>
    );
  }
  if (state === "error") {
    return <p className="text-xs text-red-600">{err || t("app.lawn.programs.error", "Couldn't price the programs.")}</p>;
  }
  if (!offer) return null;

  const { lawn, programs, addOns } = offer;
  const services = addOns.filter((a) => a.kind !== "program");
  const addOnPrograms = addOns.filter((a) => a.kind === "program");

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {t("app.lawn.programs.pricedAt", "Priced at {sqft} sq ft", { sqft: lawn.bandSqft.toLocaleString() })}
        {lawn.belowMinimum && <> · {t("app.lawn.programs.minimumBand", "minimum band")}</>}
        {state === "loading" && <Loader2 size={11} className="inline ml-1 animate-spin" />}
      </div>

      <div>
        <div className="text-sm font-medium text-foreground mb-1.5">{t("app.lawn.programs.programs", "Programs")}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {programs.map((p) => {
            const on = programKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => pickProgram(p.key)}
                className={`text-left rounded-lg border p-3 ${on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">
                    {p.name}
                    {p.bestValue && (
                      <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                        {t("app.lawn.programs.bestValue", "Best value")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">{money(p.price)}</div>
                </div>
                {p.window && <div className="text-[11px] text-muted-foreground mt-0.5">{p.window}</div>}
                <ul className="mt-1.5 space-y-0.5">
                  {p.services.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{s.name}</span>
                      <span className="tabular-nums">{money(s.price)}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {[
        [services, t("app.lawn.programs.addOns", "Add-on services")],
        [addOnPrograms, t("app.lawn.programs.addOnPrograms", "Add-on programs")],
      ].map(([list, title]) =>
        list.length ? (
          <div key={title}>
            <div className="text-sm font-medium text-foreground mb-1.5">{title}</div>
            <div className="space-y-1">
              {list.map((a) => (
                <label key={a.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={addOnKeys.includes(a.key)} onChange={() => toggleAddOn(a.key)} />
                    <span className="text-foreground">{a.name}</span>
                    {a.window && <span className="text-[11px] text-muted-foreground">· {a.window}</span>}
                  </span>
                  <span className="tabular-nums text-foreground">{money(a.price)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
