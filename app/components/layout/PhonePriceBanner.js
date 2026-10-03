"use client";

// app/components/layout/PhonePriceBanner.js
//
// "Text and call prices changed on Oct 3: incoming texts from some Canadian
// carriers now cost $0.09 each."
//
// Raised when a sustained carrier price change moved what a company pays
// (lib/phoneUsage/tiers.js). Who sees it — owners and admins of a company that
// texts or calls through FieldQuo, never a demo, never the crew — is decided
// by the server (lib/phoneUsage/priceChanges.js); this only draws what
// /api/ui-state hands it. The sentence is OUR price and the date: the payload
// carries no carrier name, no cost and no multiple, so this cannot show one.
// Dismissed per user, through the same store as the seat-sharing notice.

import { useEffect, useState } from "react";
import { X, Info } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

export default function PhonePriceBanner() {
  const { t, language } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let live = true;
    fetch("/api/ui-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && Array.isArray(d?.phonePrices) && setItems(d.phonePrices))
      // Silent: a price notice that appears because a status read failed would
      // be a notice about nothing.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!items.length) return null;

  function dismiss(key) {
    setItems((list) => list.filter((i) => i.key !== key));
    fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: key }),
    }).catch(() => {});
  }

  return (
    <>
      {items.map((item) => {
        const date = new Date(item.effectiveAt).toLocaleDateString(language || undefined, { month: "short", day: "numeric" });
        const price = formatAppMoney(item.chargeCents / 100, CREDIT_CURRENCY, language || "en");
        const what = t(`app.phonePrice.what.${item.priceClass}`, item.priceClass);
        const sentence = item.priceClass.startsWith("call_")
          ? t("app.phonePrice.bannerPerMinute", "Text and call prices changed on {date}: {what} now cost {price} a minute.", { date, what, price })
          : t("app.phonePrice.bannerEach", "Text and call prices changed on {date}: {what} now cost {price} each.", { date, what, price });
        return (
          <div key={item.key} role="status" data-phone-price-banner className="flex items-start gap-2 px-4 py-2.5 text-sm border-b border-border bg-muted text-foreground">
            <Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 flex-1">{sentence}</p>
            <button
              type="button"
              onClick={() => dismiss(item.key)}
              className="shrink-0 inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={t("app.phonePrice.dismiss", "Dismiss")}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </>
  );
}
