// app/app/settings/branding/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import BrandPreview from "@/app/components/settings/BrandPreview";
import { useTranslation } from "@/app/hooks/useTranslation";

const PRESET_COLORS = [
  "#06356b",
  "#2ea043",
  "#0969da",
  "#cf222e",
  "#8250df",
  "#1a1a1a",
];

// Mirrors NEUTRALS.dark in lib/email/emailTheme.js — the header bar colour a
// company gets when it hasn't chosen a neutral of its own.
const DEFAULT_NEUTRAL = "#1A1917";

// One labelled swatch + picker + presets. `value` may be "" meaning "not set,
// inherit the default", which is why the picker falls back to `placeholder`
// for display while the stored value stays empty.
function ColorRow({ label, hint, value, onChange, onReset, placeholder }) {
  const { t } = useTranslation();
  const shown = value || placeholder || "#000000";
  const isSet = Boolean(value);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <span className="text-sm font-medium text-foreground">{label}</span>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
        {onReset && isSet && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
          >
            {t("app.setBranding.reset")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-9 h-9 rounded-full border-2 transition-transform ${
              value === color ? "border-inverted scale-110" : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`${label} ${color}`}
          />
        ))}

        <div className="flex items-center gap-2 ml-2">
          <input
            type="color"
            value={shown}
            onChange={(e) => onChange(e.target.value)}
            className="w-9 h-9 rounded-lg border border-border cursor-pointer"
            aria-label={t("app.setBranding.customColour", { label })}
          />
          <span className="text-sm text-muted-foreground font-mono">
            {isSet ? value : t("app.setBranding.defaultSuffix", { placeholder })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [logoUrl, setLogoUrl] = useState("");
  // Kept alongside the URL so replacing a logo can delete the old asset
  // rather than orphaning it on the Cloudinary account.
  const [logoPublicId, setLogoPublicId] = useState("");
  const [brandColor, setBrandColor] = useState("#06356b");
  // "" means unset — the renderer derives a default rather than storing one,
  // so a company that later changes its primary gets the secondary following
  // along instead of being stuck on a stale copy.
  const [secondary, setSecondary] = useState("");
  const [neutral, setNeutral] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => {
        setLogoUrl(data.logoUrl || "");
        setLogoPublicId(data.logoPublicId || "");
        setBrandColor(data.brandColor || "#06356b");
        setSecondary(data.brandColors?.secondary || "");
        setNeutral(data.brandColors?.neutral || "");
      })
      .catch(() => setError(t("app.setBranding.loadError")))
      .finally(() => setLoading(false));
  }, []);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("app.setBranding.uploadFailed"));
      }

      setLogoUrl(data.url);
      setLogoPublicId(data.publicId || "");
    } catch (err) {
      setError(err.message || t("app.setBranding.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only send the keys that are actually set, and send null rather than
        // an empty object so "reset to defaults" round-trips correctly.
        body: JSON.stringify({
          logoUrl,
          logoPublicId,
          brandColor,
          brandColors:
            secondary || neutral
              ? {
                  ...(secondary && { secondary }),
                  ...(neutral && { neutral }),
                }
              : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("app.setBranding.saveError"));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || t("app.setBranding.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-accent rounded" />
          <div className="h-40 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.settings.branding")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setBranding.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Logo */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">{t("app.setBranding.logo")}</h2>
        {/* 8 MB, not 10 — the API route rejects anything larger, so the old
            copy invited a failure and then blamed the file. */}
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.setBranding.logoFormats")}
        </p>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={t("app.setBranding.logoAlt")}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">{t("app.setBranding.noLogo")}</span>
            )}
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {uploading
                ? t("app.setBranding.uploading")
                : logoUrl
                  ? t("app.setBranding.replaceLogo")
                  : t("app.setBranding.uploadLogo")}
            </button>
          </div>
        </div>
      </div>

      {/* Brand colors */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">{t("app.setBranding.brandColors")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.setBranding.colorsHint1")}{" "}
          <strong className="text-foreground">{t("app.setBranding.colorsStrong")}</strong>
          {t("app.setBranding.colorsHint2")}
        </p>

        <div className="space-y-5">
          <ColorRow
            label={t("app.setBranding.primary")}
            hint={t("app.setBranding.primaryHint")}
            value={brandColor}
            onChange={setBrandColor}
          />
          <ColorRow
            label={t("app.setBranding.secondary")}
            hint={t("app.setBranding.secondaryHint")}
            value={secondary}
            onChange={setSecondary}
            onReset={() => setSecondary("")}
            placeholder={brandColor}
          />
          {/* Live, before save. The colour now drives the whole app chrome,
              so "pick and find out after a reload" is no longer acceptable. */}
          <div className="pt-2">
            <div className="text-sm font-medium text-foreground mb-2">
              {t("app.setBranding.howAppLooks")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">{t("app.setBranding.light")}</div>
                <BrandPreview brandColor={brandColor} secondary={secondary} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">{t("app.setBranding.dark")}</div>
                <BrandPreview brandColor={brandColor} secondary={secondary} dark />
              </div>
            </div>
          </div>

          <ColorRow
            label={t("app.setBranding.neutral")}
            hint={t("app.setBranding.neutralHint")}
            value={neutral}
            onChange={setNeutral}
            onReset={() => setNeutral("")}
            placeholder={DEFAULT_NEUTRAL}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">{t("app.action.preview")}</h2>
        <p className="text-sm text-muted-foreground mb-3">
          {t("app.setBranding.previewHint")}
        </p>

        <div className="border border-border rounded-lg overflow-hidden max-w-md">
          {/* Header bar — neutral role */}
          <div
            className="px-5 py-4"
            style={{ background: neutral || DEFAULT_NEUTRAL }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={t("app.setBranding.logoPreviewAlt")}
                className="h-8 object-contain"
              />
            ) : (
              <span
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brandColor }}
              >
                {t("app.setBranding.yourCompanyName")}
              </span>
            )}
          </div>

          <div className="p-5 bg-card">
            <p
              className="text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{ color: secondary || brandColor }}
            >
              {t("app.setBranding.whatsIncluded")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("app.setBranding.quoteReady")}
            </p>
            <span
              className="inline-block px-6 py-2.5 rounded-md text-sm font-bold text-white"
              style={{ background: brandColor }}
            >
              {t("app.setBranding.viewApprove")}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
      >
        {saving ? t("app.action.saving") : saved ? t("app.setBranding.savedCheck") : t("app.setBranding.saveBranding")}
      </button>
    </div>
  );
}
