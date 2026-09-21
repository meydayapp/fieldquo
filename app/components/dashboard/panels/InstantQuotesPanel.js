// app/components/dashboard/panels/InstantQuotesPanel.js
//
// "Enable instant quotes", in the home page's dialog. The cards are
// app/app/settings/instant-quotes/TradeCard.js — the same card, the same
// PUT, the same readiness rule Settings > Instant quotes runs — for the
// trades the company sells (the page's `mine`: offered as a service, or
// already switched on). The other trades FieldQuo can price stay on the
// page behind its disclosure; the honest order for a trade the company
// does not sell is to add the service first, and the page says so.
//
// The same read the page makes, and the same re-read after a save: the
// route is what decides a trade is ready, and a card that had just been
// switched on is re-drawn from its answer.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TradeCard from "@/app/app/settings/instant-quotes/TradeCard";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function InstantQuotesPanel({ onChanged }) {
  const { t } = useTranslation();
  const [trades, setTrades] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/settings/instant-quote");
      setTrades(Array.isArray(data?.trades) ? data.trades : []);
      setCanEdit(Boolean(data?.canEdit));
      setError("");
    } catch (err) {
      setError(
        err.message ||
          t("app.setInstantQuotes.couldNotLoad", "Could not load instant-quote settings"),
      );
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function saved() {
    await load();
    await onChanged?.();
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!trades) {
    return <div className="animate-pulse h-48 bg-accent rounded-xl" aria-busy="true" />;
  }

  const mine = trades.filter((tr) => tr.offeredAsService || tr.enabled);

  if (mine.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "app.setInstantQuotes.otherTradesNote",
          "These aren't in your services. If you do sell one, add it under Services first — that's the list your quotes, your website and your receptionist all read.",
        )}{" "}
        <Link href="/app/settings/services" className="underline underline-offset-2 text-foreground">
          {t("app.settings.services")}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {mine.map((trade) => (
        <TradeCard key={trade.trade} trade={trade} canEdit={canEdit} onSaved={saved} />
      ))}
    </div>
  );
}
