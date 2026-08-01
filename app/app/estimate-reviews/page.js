// app/app/estimate-reviews/page.js
//
// The queue of instant estimates awaiting sign-off. Each card shows what the
// homeowner saw — the satellite image, the measurements, the range — and the
// figure that will stick. Approving clears the review flag so the quote can be
// opened, edited and sent like any other; the "Open quote" link is where real
// editing happens, this page is just the gate.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, BadgeCheck, ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";

import { useTranslation } from "@/app/hooks/useTranslation";
function money(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString();
}

const SOURCE_LABEL = {
  google_solar: "Measured from satellite",
  lawn_polygon: "Lawn traced on map",
  manual: "Homeowner-entered",
};

export default function EstimateReviewsPage() {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const data = await fetchJson("/api/quotes/estimate-reviews");
      setQuotes(data.quotes);
      setCanApprove(Boolean(data.canApprove));
    } catch (err) {
      setError(err.message || "Could not load reviews");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(q, adjusted) {
    setBusyId(q.id);
    try {
      await fetchJson(`/api/quotes/${q.id}/approve-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjusted != null ? { total: adjusted } : {}),
      });
      await load();
    } catch (err) {
      showError(err.message || "Could not approve");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-1">
        <BadgeCheck size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.reviews.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        Instant estimates from your website land here first. Confirm the price —
        adjusting it if the property needs it — before the quote can be sent.
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">{error}</p>
      )}

      {!quotes && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {quotes && quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("app.reviews.empty")}
        </div>
      )}

      <div className="space-y-4">
        {quotes?.map((q) => (
          <ReviewCard
            key={q.id}
            q={q}
            canApprove={canApprove}
            busy={busyId === q.id}
            onApprove={approve}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ q, canApprove, busy, onApprove }) {
  const { t } = useTranslation();
  const d = q.estimateData || {};
  const m = d.measurement || {};
  const range = d.range || {};
  const [total, setTotal] = useState(Math.round(Number(q.total) || 0));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{q.client?.name || "Website enquiry"}</h3>
            <span className="text-xs text-muted-foreground">{q.quoteNumber}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[q.client?.email, q.client?.phone, q.client?.address].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground shrink-0">
          {SOURCE_LABEL[q.estimateSource] || q.estimateSource}
        </span>
      </div>

      <div className="mt-3 flex gap-4">
        {m.satelliteImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.satelliteImageUrl} alt={t("app.reviews.property")} className="h-28 w-40 object-cover rounded-lg border border-border shrink-0" />
        )}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {m.squares != null && <span><strong className="text-foreground">{m.squares}</strong> squares</span>}
            {m.areaSqft != null && <span><strong className="text-foreground">{Math.round(m.areaSqft).toLocaleString()}</strong> sq ft</span>}
            {m.predominantPitch && <span><strong className="text-foreground">{m.predominantPitch.rise}/12</strong> pitch</span>}
            {m.tearOffLayers ? <span>{m.tearOffLayers} layer(s) tear-off</span> : null}
          </div>
          {d.materialKey && <div>{t("app.reviews.material")}<strong className="text-foreground">{d.materialKey}</strong></div>}
          <div>
            Homeowner saw:{" "}
            <strong className="text-foreground">{money(range.low)}–{money(range.high)}{d.unit ? ` ${d.unit}` : ""}</strong>
          </div>
        </div>
      </div>

      {Array.isArray(d.breakdown) && d.breakdown.length > 0 && (
        <ul className="mt-3 text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
          {d.breakdown.map((b, i) => (
            <li key={i} className="flex justify-between">
              <span>{b.label}</span>
              <span>{money(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("app.reviews.approveAt")}</span>
          <span className="text-muted-foreground">$</span>
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={!canApprove}
            className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={() => onApprove(q, total)}
          disabled={!canApprove || busy || !(Number(total) > 0)}
          className="inline-flex items-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
          Approve
        </button>
        <Link
          href={`/app/quotes/${q.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >{t("app.reviews.openQuote")}<ExternalLink size={13} />
        </Link>
        {!canApprove && (
          <span className="text-xs text-muted-foreground">{t("app.reviews.supervisorOnly")}</span>
        )}
      </div>
    </div>
  );
}
