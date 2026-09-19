// app/components/sales/TradePoints.js
//
// The three things FieldQuo sells to the prospect's trade, on the call screen
// and in the queue's pitch layer. The words come from
// lib/sales/tradeSellingPoints.js in the script's language (EN / FR / ES) —
// the same language the AI script beside it is in — and the heading is the
// rep's own language (nine keys). Same shape and the same argument as
// TurnaroundQuestion: it is the same on every call of a trade, so it stands
// whether or not an AI script was ever written for the row.
//
// ══ Why it says it is NOT evidence ═══════════════════════════════════════
//
// The queue's three layers (lib/sales/prospectView.js) exist so a rep can
// tell an observation from an argument. These three are neither: they are
// what we sell to every roofer, and a rep who read them as "what we saw on
// their site" would defend a claim with nothing behind it. So the note under
// the heading says so in as many words, and the block is drawn under the
// evidence-cited recommendations, never among them.
"use client";

import { Wrench } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { languageMeta } from "@/app/i18n/languages";
import { TRADE_PITCH_TOP, tradePitchLabel, tradeSellingPoints } from "@/lib/sales/tradeSellingPoints";

export default function TradePoints({ tradeKey, language = "en", compact = false, note = true }) {
  const { t } = useTranslation();
  const { points, fallback } = tradeSellingPoints(tradeKey, language, { limit: TRADE_PITCH_TOP });
  // A prospect with no trade, or a trade with no list, draws nothing: an
  // empty heading would read as "we have nothing to sell them".
  if (points.length === 0) return null;
  const trade = tradePitchLabel(tradeKey) || tradeKey;
  return (
    <div
      className={compact ? "rounded-lg border border-border bg-muted p-3 space-y-1" : "rounded-lg border border-border bg-muted p-3 space-y-2"}
      data-testid="trade-points"
      data-trade={tradeKey}
      data-language={fallback ? "en" : language}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground flex items-center gap-1.5">
        <Wrench size={13} aria-hidden="true" /> {t("app.salesCall.tradePoints", { trade })}
      </p>
      {note ? <p className="text-xs text-muted-foreground break-words">{t("app.salesCall.tradePointsNote", { trade })}</p> : null}
      <ol className="list-decimal pl-5 space-y-1.5">
        {points.map((p) => (
          <li key={p.key} className="text-sm text-foreground break-words" data-point={p.key}>
            <strong>{p.headline}</strong> — {p.oneLiner}
            <span className="block text-muted-foreground">“{p.proof}”</span>
          </li>
        ))}
      </ol>
      {fallback ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
          {t("app.salesCall.tradePointsFallback", { language: languageMeta(language)?.name || language })}
        </p>
      ) : null}
    </div>
  );
}
