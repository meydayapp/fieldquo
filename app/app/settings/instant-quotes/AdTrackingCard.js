// app/app/settings/instant-quotes/AdTrackingCard.js
//
// The company's ad pixels and the "ask first" switch, on the screen that
// owns the instant estimate — the surface they are loaded on — and read by
// every lead funnel that has not set its own (lib/funnels/pixels.js
// effectivePixels). Saved through /api/settings/tracking, which refuses a
// malformed id with the field named; this card puts the refusal beside that
// field rather than in a toast that disappears.
//
// Below the form: the ad-link builder for every page an ad can open — the
// instant estimate, each published funnel, the booking page and the website
// (app/api/leads/traffic/landings) — and the way to the report the whole
// thing feeds (Leads › Visits & unfinished, campaign ▸ ad set ▸ ad).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, Radio } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import TrackingLinkBuilder from "@/app/components/settings/TrackingLinkBuilder";

const FIELDS = [
  { key: "metaPixelId", label: "app.tracking.metaLabel", hint: "app.tracking.metaHint", inputMode: "numeric" },
  { key: "ga4Id", label: "app.tracking.ga4Label", hint: "app.tracking.ga4Hint" },
  { key: "tiktokPixelId", label: "app.tracking.tiktokLabel", hint: "app.tracking.tiktokHint" },
];

export default function AdTrackingCard() {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [publicSlug, setPublicSlug] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [badFields, setBadFields] = useState([]);

  useEffect(() => {
    fetchJson("/api/settings/tracking")
      .then((d) => {
        setForm({
          metaPixelId: d.metaPixelId,
          ga4Id: d.ga4Id,
          tiktokPixelId: d.tiktokPixelId,
          pixelConsentRequired: d.pixelConsentRequired,
        });
        setCanEdit(Boolean(d.canEdit));
        setPublicSlug(d.publicSlug);
      })
      .catch((err) => setLoadError(err.message || t("app.tracking.couldNotLoad")));
  }, [t]);

  async function save() {
    setSaving(true);
    setError("");
    setBadFields([]);
    setSaved(false);
    try {
      const d = await fetchJson("/api/settings/tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({
        metaPixelId: d.metaPixelId,
        ga4Id: d.ga4Id,
        tiktokPixelId: d.tiktokPixelId,
        pixelConsentRequired: d.pixelConsentRequired,
      });
      setSaved(true);
    } catch (err) {
      const fields = Array.isArray(err?.data?.fields) ? err.data.fields : [];
      setBadFields(fields);
      setError(fields.length ? t("app.tracking.invalidFields") : err.message || t("app.tracking.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseUrl = publicSlug && origin ? `${origin}/instant-quote/${publicSlug}` : null;

  // Every page an ad can open whose visits are counted
  // (app/api/leads/traffic/landings). A failed load falls back to the
  // instant estimate alone — the one page this card always offered — and
  // says so.
  const [landingRows, setLandingRows] = useState(null);
  const [landingsError, setLandingsError] = useState("");
  useEffect(() => {
    fetchJson("/api/leads/traffic/landings")
      .then((d) => setLandingRows(Array.isArray(d?.landings) ? d.landings : []))
      .catch(() => setLandingsError(t("app.adLinks.loadFailed")));
  }, [t]);
  const landingLabel = (l) => {
    if (l.kind === "instant_quote") return t("app.traffic.instantEstimate");
    if (l.kind === "funnel") return `${t("app.traffic.funnel")} · ${l.name}`;
    if (l.kind === "booking") return t("app.adLinks.bookingPage");
    if (l.kind === "booking_type") return `${t("app.adLinks.bookingPage")} · ${l.name}`;
    if (l.kind === "website") return t("app.traffic.source.website");
    return l.key;
  };
  const landings =
    landingRows && origin
      ? landingRows
          .map((l) => ({ key: l.key, label: landingLabel(l), url: l.url || (l.path ? `${origin}${l.path}` : null) }))
          .filter((l) => l.url)
      : null;

  return (
    <section id="ad-tracking" className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-5 scroll-mt-4">
      <div className="flex items-center gap-2">
        <Radio size={16} className="text-foreground" />
        <h2 className="text-base font-semibold text-foreground">{t("app.tracking.settingsTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{t("app.tracking.settingsIntro")}</p>

      {loadError && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{loadError}</p>}
      {!form && !loadError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> {t("app.state.loading")}
        </div>
      )}

      {form && (
        <>
          <div className="mt-4 space-y-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-sm font-medium text-foreground">{t(f.label)}</span>
                <input
                  value={form[f.key]}
                  disabled={!canEdit}
                  inputMode={f.inputMode}
                  aria-invalid={badFields.includes(f.key) || undefined}
                  onChange={(e) => {
                    setSaved(false);
                    setForm((p) => ({ ...p, [f.key]: e.target.value }));
                  }}
                  className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60 ${
                    badFields.includes(f.key) ? "border-red-500" : "border-border"
                  }`}
                />
                <span className={`block text-xs mt-1 ${badFields.includes(f.key) ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                  {t(f.hint)}
                </span>
              </label>
            ))}

            <label className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                checked={form.pixelConsentRequired}
                disabled={!canEdit}
                onChange={(e) => {
                  setSaved(false);
                  setForm((p) => ({ ...p, pixelConsentRequired: e.target.checked }));
                }}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-medium text-foreground">{t("app.tracking.consentLabel")}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{t("app.tracking.consentHint")}</span>
              </span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground mt-4">{t("app.tracking.whatIsSent")}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("app.tracking.embedLimit")}</p>

          {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          {canEdit && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? t("app.action.saving") : t("app.action.save")}
              </button>
              {saved && <span className="text-sm text-muted-foreground">{t("app.action.saved")}</span>}
            </div>
          )}
        </>
      )}

      {landingsError && <p className="mt-5 text-xs text-red-700 dark:text-red-400">{landingsError}</p>}
      <TrackingLinkBuilder baseUrl={baseUrl} landings={landings?.length ? landings : null} className="mt-5" />

      <Link href="/app/leads/traffic" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline">
        <BarChart3 size={14} /> {t("app.tracking.openReport")}
      </Link>
    </section>
  );
}
