"use client";

// app/components/billing/UsdBillingNote.js
//
// "Billed in US dollars" — one sentence, shown beside every add-on FieldQuo
// prices in USD, to a company whose own billing currency is not USD.
//
// ══ The owner's rule (2026-09-06, restated 2026-10-04) ═════════════════════
//
// Add-ons and bundles are USD-only: the video pack, the AI credit plans and
// AI top-ups, and the phone & text (Retell voice, Twilio texts) credit and its
// top-ups. The companies behind them — Cloudinary, OpenAI, Retell, Twilio —
// charge FieldQuo in US dollars, so the price is set in US dollars and a
// Canadian or Australian company's bank converts it. "There should be a
// disclaimer for Canadian companies that the pricing is in USD … explain that
// the companies providing those services do charge in USD."
//
// One component so the sentence cannot drift between the five screens that
// sell these, and so a USD company never reads a disclaimer about itself.
//
// ── The "≈" hint ───────────────────────────────────────────────────────────
//
// With `cents`, and a rate for the company's currency (GET /api/fx/usd — the
// ExchangeRate table, else the checked-in rate), it adds "≈ CA$110 at today's
// rate (approximate)", rounded to two significant figures as every FieldQuo
// approximation is (lib/marketing/fx.js approximateAmount). No rate (AUD
// today) → no hint, never a guessed one. The charge itself is always USD.
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { needsUsdNote, approxRounded } from "@/lib/billing/usdNote";

let ratesPromise = null;
function loadRates() {
  if (!ratesPromise) {
    ratesPromise = fetch("/api/fx/usd")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return ratesPromise;
}

export default function UsdBillingNote({ cents = null, className = "" }) {
  const { t, language } = useTranslation();
  const { currency } = useCompanyPreferences();
  const show = needsUsdNote(currency);
  const [rate, setRate] = useState(null);
  useEffect(() => {
    if (!show || cents == null) return undefined;
    let live = true;
    loadRates().then((d) => {
      const r = Number(d?.rates?.[String(currency).toUpperCase()]);
      if (live && Number.isFinite(r) && r > 0) setRate(r);
    });
    return () => {
      live = false;
    };
  }, [show, cents, currency]);
  if (!show) return null;

  let approx = null;
  if (rate && cents != null) {
    const n = approxRounded((Number(cents) / 100) * rate);
    if (n) {
      try {
        approx = new Intl.NumberFormat(language || "en", { style: "currency", currency: String(currency).toUpperCase(), maximumFractionDigits: 0 }).format(n);
      } catch {
        approx = `${n} ${currency}`;
      }
    }
  }

  return (
    <p className={`text-xs text-muted-foreground flex items-start gap-1.5 ${className}`} data-usd-billing-note>
      <Info size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        {t(
          "app.usdNote.body",
          "Billed in US dollars. The companies behind this — video storage, AI, phone and text providers — charge us in US dollars, so it's priced in USD; your bank converts it.",
        )}
        {approx ? ` ${t("app.usdNote.approx", "About {amount} at today's rate (approximate).", { amount: approx })}` : ""}
      </span>
    </p>
  );
}
