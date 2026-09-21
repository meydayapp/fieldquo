// app/app/settings/ai-credit/AiCreditCard.js
//
// The AI wallet card of Settings > AI credit — the balance, what it buys, the
// top-up buttons and the statement — as a component, because the home page's
// "Add AI credits" dialog renders the same card (app/components/dashboard/
// stepPanels.js). The Card and Statement pieces and the credit-currency
// formatter moved here with it and the page imports them back, so the voice
// cards beside it on the page are drawn with the same pieces.
//
// A top-up hands the browser to Stripe Checkout, from both doors. It comes
// back to the AI credit PAGE, which is where the payment is confirmed against
// Stripe before a balance is shown (that page's own effect) — the dialog says
// so above its buttons rather than pretending a payment ends where it began.
"use client";

import { useState } from "react";
import { Sparkles, Image as ImageIcon, Eye } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

export const money = (c) => formatAppMoney(Number(c || 0) / 100, CREDIT_CURRENCY, "en");

// `id` is optional and exists for deep links — the dashboard's set-up steps
// point at `#ai-credit` (lib/setupSteps.js).
export function Card({ id, title, icon: Icon, hint, children, tour }) {
  return (
    <section id={id} data-tour={tour} className="bg-card border border-border rounded-xl p-5 scroll-mt-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={17} className="text-muted-foreground" />}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Statement({ t, entries, empty }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <details className="mt-1">
      <summary className="text-sm text-muted-foreground cursor-pointer">
        {t("app.setAiCredit.whereItWent", "Where the credit went")}
      </summary>
      <ul className="mt-2 space-y-1">
        {entries.map((e, i) => (
          <li key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {e.note || e.kind}
              <span className="opacity-60"> {new Date(e.at).toLocaleDateString()}</span>
            </span>
            <span
              className={
                e.cents >= 0
                  ? "text-emerald-600 dark:text-emerald-400 tabular-nums"
                  : "text-foreground tabular-nums"
              }
            >
              {e.cents >= 0 ? "+" : "−"}
              {money(Math.abs(e.cents))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * @param {object} props
 * @param {object} props.ai — the `ai` half of GET /api/settings/ai/credit
 */
export default function AiCreditCard({ ai }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const imagesFor = (cents) => Math.floor(Number(cents || 0) / ai.priceCents.image_generation);
  const visionFor = (cents) => Math.floor(Number(cents || 0) / ai.priceCents.image_vision);

  async function buyAiCredit(cents) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/ai/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cents }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setAiCredit.paymentError", "Couldn't start the payment."));
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      id="ai-credit"
      tour="ai-credit-ai"
      title={t("app.setAiCredit.aiTitle", "AI image credit")}
      icon={Sparkles}
      hint={t("app.setAiCredit.aiHint", "Spent by AI image generation ({gen}¢ each) and the paid deep photo read on a quote ({vis}¢ per read, up to 8 photos).", { gen: ai.priceCents.image_generation, vis: ai.priceCents.image_vision })}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-muted-foreground">{t("app.setAiCredit.balance", "Balance:")}</span>
        <span className="text-2xl font-bold text-foreground">{money(ai.cents)}</span>
        <span className="text-sm text-muted-foreground">
          {t("app.setAiCredit.aiBalanceContext", "(about {images} images, or {reads} deep reads)", {
            images: imagesFor(ai.cents),
            reads: visionFor(ai.cents),
          })}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <ImageIcon size={14} /> {t("app.setAiCredit.genLabel", "Image generation")}
        <Eye size={14} className="ml-2" /> {t("app.setAiCredit.visionLabel", "Deep photo read")}
      </div>

      <p className="text-sm font-medium text-foreground mt-4">{t("app.setAiCredit.addCredit", "Add credit")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ai.topups.map((topup) => (
          <button
            key={topup.cents}
            type="button"
            disabled={busy}
            onClick={() => buyAiCredit(topup.cents)}
            className={`px-4 py-2 rounded-full border text-sm disabled:opacity-50 ${
              topup.popular
                ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            {topup.label}
            <span className="opacity-70"> · {imagesFor(topup.cents)} {t("app.setAiCredit.images", "images")}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Statement t={t} entries={ai.entries} empty={t("app.setAiCredit.aiEmpty", "Nothing spent from the AI balance yet.")} />
      </div>
    </Card>
  );
}
