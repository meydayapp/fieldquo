// app/app/settings/language/page.js
//
// Two settings that look similar and mean different things, so the page is
// explicit about which is which:
//
//   * Your language      — what YOU read the app in
//   * Company default    — what everyone who hasn't chosen inherits, and what
//                          client documents use when a client has no language
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Globe } from "lucide-react";
import { LANGUAGES } from "@/app/i18n/languages";
import { appCoverage } from "@/app/i18n/appMessages";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * How much of the interface this language covers.
 *
 * Rendered next to every option rather than only next to the incomplete ones:
 * "Interface 100%" on English and French is what makes "Interface in English"
 * on the others read as a fact about this language rather than a warning
 * someone forgot to remove.
 */
function Coverage({ code }) {
  const pct = Math.round(appCoverage(code) * 100);
  if (pct === 100) {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        Interface 100%
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {pct > 0 ? `Interface ${pct}%` : "Interface in English"}
    </span>
  );
}

export default function LanguageSettingsPage() {
  const { changeLanguage } = useTranslation();

  const [personal, setPersonal] = useState(null); // null = inherit
  const [companyDefault, setCompanyDefault] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/language")
      .then((r) => r.json())
      .then((data) => {
        setPersonal(data.language ?? null);
        setCompanyDefault(data.defaultLanguage || "en");
      })
      .catch(() => setError("Couldn't load language settings."))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");

      setPersonal(data.language ?? null);
      setCompanyDefault(data.defaultLanguage || "en");

      // Apply immediately rather than waiting for a reload — the effective
      // language is the personal choice, or the company default when
      // inheriting.
      changeLanguage(data.language ?? data.defaultLanguage ?? "en");

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  const effective = personal ?? companyDefault;

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe size={20} className="text-muted-foreground" />
          Language
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What language your clients&apos; quotes, invoices and emails go out in.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Personal */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">Your language</h2>
        {/* ── Still telling the truth, with a better answer ──────────────────
            This used to say the interface was English-only, because User.language
            was written here and read by nothing. It is read now — the app layout
            resolves it and feeds the language provider.

            What has NOT changed is the honesty requirement. The interface
            catalogue is English and French; the other supported languages render
            an English interface. So each option prints its own real coverage
            rather than letting the presence of a button imply a translation that
            isn't there. The percentage comes from the catalogue itself
            (appCoverage), so it can't drift out of date the way a hardcoded
            sentence would. */}
        <p className="text-sm text-muted-foreground mt-1 mb-2">
          What you read the app in. Each option below shows how much of the
          interface is translated — the rest falls back to English.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          This is separate from what your <em>clients</em> see. Quotes, invoices,
          PDFs and the emails carrying them go out in the client&apos;s own
          language in every supported language, whatever you read the app in.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => save({ language: null })}
            disabled={saving}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left ${
              personal === null
                ? "border-inverted bg-muted"
                : "border-border hover:border-border"
            }`}
          >
            <span className="text-sm text-foreground">
              Match company default
              <span className="text-muted-foreground">
                {" "}
                —{" "}
                {LANGUAGES.find((l) => l.code === companyDefault)?.nativeName ||
                  companyDefault}
              </span>
            </span>
            {personal === null && <Check size={16} className="text-foreground" />}
          </button>

          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => save({ language: l.code })}
              disabled={saving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left ${
                personal === l.code
                  ? "border-inverted bg-muted"
                  : "border-border hover:border-border"
              }`}
            >
              <span className="text-sm text-foreground">
                {l.nativeName}
                <span className="text-muted-foreground"> — {l.name}</span>
              </span>
              <span className="flex items-center gap-3">
                <Coverage code={l.code} />
                {personal === l.code && (
                  <Check size={16} className="text-foreground" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Company default */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">Company default</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Used for team members who haven&apos;t picked a language, and for
          quotes and invoices to clients who don&apos;t have one set. Owners and
          admins only.
        </p>

        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => save({ defaultLanguage: l.code })}
              disabled={saving}
              className={`px-4 py-2 rounded-full border text-sm ${
                companyDefault === l.code
                  ? "border-inverted bg-inverted text-inverted-foreground"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {l.nativeName}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Changing this moves everyone who hasn&apos;t set their own language.
          It does not change quotes already sent — those keep the language they
          were sent in.
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {saving && (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Saving…
          </span>
        )}
        {savedFlash && <span className="text-emerald-600 dark:text-emerald-400">Saved</span>}
        <span className="text-muted-foreground">
          Currently showing:{" "}
          {LANGUAGES.find((l) => l.code === effective)?.nativeName || effective}
        </span>
      </div>
    </div>
  );
}
