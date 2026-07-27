// app/app/settings/branding/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";

const PRESET_COLORS = [
  "#bd9d60",
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
  const shown = value || placeholder || "#000000";
  const isSet = Boolean(value);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
        {onReset && isSet && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
          >
            Reset
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
              value === color ? "border-gray-900 scale-110" : "border-transparent"
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
            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
            aria-label={`${label} custom colour`}
          />
          <span className="text-sm text-gray-500 font-mono">
            {isSet ? value : `${placeholder} (default)`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const fileInputRef = useRef(null);

  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#bd9d60");
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
        setBrandColor(data.brandColor || "#bd9d60");
        setSecondary(data.brandColors?.secondary || "");
        setNeutral(data.brandColors?.neutral || "");
      })
      .catch(() => setError("Could not load branding settings"))
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
        throw new Error(data.error || "Upload failed");
      }

      setLogoUrl(data.url);
    } catch (err) {
      setError(err.message || "Could not upload logo");
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
        throw new Error(data.error || "Could not save branding");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save branding");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branding</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your logo and brand color appear on every quote, invoice, and email
          your clients see.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Logo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Logo</h2>
        <p className="text-sm text-gray-500 mb-4">PNG or JPG, up to 10MB.</p>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Company logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
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
              className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {uploading
                ? "Uploading..."
                : logoUrl
                  ? "Replace logo"
                  : "Upload logo"}
            </button>
          </div>
        </div>
      </div>

      {/* Brand colors */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Brand Colors</h2>
        <p className="text-sm text-gray-500 mb-4">
          Used across your emails, quotes and invoices. Only the primary is
          required — leave the others alone and they follow sensible defaults.
        </p>

        <div className="space-y-5">
          <ColorRow
            label="Primary"
            hint="Buttons, progress bars and your name in the email header."
            value={brandColor}
            onChange={setBrandColor}
          />
          <ColorRow
            label="Secondary"
            hint="Supporting accents, like section titles on itemized lists. Defaults to your primary."
            value={secondary}
            onChange={setSecondary}
            onReset={() => setSecondary("")}
            placeholder={brandColor}
          />
          <ColorRow
            label="Neutral"
            hint="The email header bar. Dark tones read as more premium than a saturated brand colour."
            value={neutral}
            onChange={setNeutral}
            onReset={() => setNeutral("")}
            placeholder={DEFAULT_NEUTRAL}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Preview</h2>
        <p className="text-sm text-gray-500 mb-3">
          Roughly how the top of your emails will look.
        </p>

        <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md">
          {/* Header bar — neutral role */}
          <div
            className="px-5 py-4"
            style={{ background: neutral || DEFAULT_NEUTRAL }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-8 object-contain"
              />
            ) : (
              <span
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brandColor }}
              >
                Your Company Name
              </span>
            )}
          </div>

          <div className="p-5 bg-white">
            <p
              className="text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{ color: secondary || brandColor }}
            >
              What&apos;s included
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Your quote is ready to review.
            </p>
            <span
              className="inline-block px-6 py-2.5 rounded-md text-sm font-bold text-white"
              style={{ background: brandColor }}
            >
              View &amp; approve
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-gray-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Branding"}
      </button>
    </div>
  );
}
