"use client";

// app/components/billing/AiAllowance.js
//
// "US$X of US$Y AI used this month" — the company's side of the dollar AI
// allowance (lib/ai/usage.js resolveAiCap / allowanceDisplay, owner-approved
// 2026-10-03). Every figure is the server's: the line renders the shape
// allowanceDisplay returns and computes nothing but the formatting.
//
// Three honest renderings, never a fourth invented one:
//   - a dollar allowance:  "US$1.20 of US$5.00 AI used this month"
//   - still a token cap:   "US$0.40 of AI used this month · 31% of your allowance"
//                          (a token cap has no dollar ceiling to print)
//   - no cost figure:      "31% of this month's AI allowance used"
// An uncapped account (display null) renders nothing at all.
//
// USD, always: the allowance is a ceiling on what OpenAI bills FieldQuo, not a
// price in the company's currency — Intl writes "US$" for a Canadian reader,
// which is the truth.
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { fetchJson } from "@/lib/fetchJson";

function usd(cents, locale) {
  const n = Number(cents);
  if (cents === null || cents === undefined || !Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n / 100);
  } catch {
    return `US$${(n / 100).toFixed(2)}`;
  }
}

/** The sentence for one allowanceDisplay, or null. Exported for the card. */
export function useAllowanceSentence() {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);
  return (display) => {
    if (!display) return null;
    const used = usd(display.usedCents, locale);
    const cap = usd(display.capCents, locale);
    const pct = Number.isFinite(Number(display.pct)) ? Number(display.pct) : null;
    if (display.unit === "dollars" && used && cap) {
      return t("app.aiAllowance.dollars", "{used} of {cap} AI used this month", { used, cap });
    }
    if (used && pct !== null) {
      return t("app.aiAllowance.tokens", "{used} of AI used this month · {pct}% of your allowance", { used, pct });
    }
    if (pct !== null) return t("app.aiAllowance.percent", "{pct}% of this month's AI allowance used", { pct });
    return null;
  };
}

export function AiAllowanceLine({ display, className = "" }) {
  const sentence = useAllowanceSentence();
  const text = sentence(display);
  if (!text) return null;
  return (
    <p className={`text-xs text-muted-foreground flex items-center gap-1.5 ${className}`} data-ai-allowance>
      <Sparkles size={12} className="shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

/**
 * Account & Billing's card: the allowance the AI tools spend, and — when the
 * assistant is counted separately on FieldQuo's own ledger — the assistant's
 * own ceiling of the same size. GET /api/ai/allowance.
 */
export function AiAllowanceCard() {
  const { t } = useTranslation();
  const sentence = useAllowanceSentence();
  const [data, setData] = useState(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchJson("/api/ai/allowance")
      .then((d) => setData(d || null))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground" data-ai-allowance-card>
        {t("app.aiAllowance.loadFailed", "Couldn't load this month's AI use. Refresh to try again.")}
      </div>
    );
  }
  if (data === undefined) return null;
  const tools = sentence(data?.allowance);
  const assistant = sentence(data?.assistant);
  if (!tools && !assistant && !data?.off) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-2" data-ai-allowance-card>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Sparkles size={16} className="text-muted-foreground" aria-hidden="true" />
        {t("app.aiAllowance.title", "FieldQuo AI this month")}
      </h2>
      {data?.off ? (
        <p className="text-sm text-muted-foreground">
          {t("app.aiAllowance.off", "FieldQuo AI isn't enabled on this account. Contact support if you'd like it turned on.")}
        </p>
      ) : (
        <dl className="text-sm space-y-1">
          {tools && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{t("app.aiAllowance.toolsLabel", "AI tools (quote review, website writing, drafts):")}</dt>
              <dd className="text-foreground">{tools}</dd>
            </div>
          )}
          {assistant && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{t("app.aiAllowance.assistantLabel", "FieldQuo AI assistant:")}</dt>
              <dd className="text-foreground">{assistant}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        {t("app.aiAllowance.resets", "It resets at the start of each month. The AI employee and other paid AI are charged to your AI credit instead and are not counted here.")}
      </p>
    </div>
  );
}
