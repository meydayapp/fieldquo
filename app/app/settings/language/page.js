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
import { appCoverage, appReviewed } from "@/app/i18n/appMessages";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

/**
 * How much of the interface this language covers.
 *
 * Rendered next to every option rather than only next to the incomplete ones:
 * "Interface 100%" on English and French is what makes "Interface in English"
 * on the others read as a fact about this language rather than a warning
 * someone forgot to remove.
 */
function Coverage({ code, t }) {
  const pct = Math.round(appCoverage(code) * 100);
  if (pct === 100) {
    // Complete but not yet human-checked: say so rather than badge it "100%"
    // clean, which reads as verified. A fluent reviewer clears it in code.
    if (!appReviewed(code)) {
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
          {t("app.langSettings.coverageNeedsReview", "Interface 100% · needs review")}
        </span>
      );
    }
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        {t("app.langSettings.coverageComplete", "Interface 100%")}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {pct > 0
        ? t("app.langSettings.coveragePartial", "Interface {pct}%", { pct })
        : t("app.langSettings.coverageEnglish", "Interface in English")}
    </span>
  );
}

export default function LanguageSettingsPage() {
  const { t, changeLanguage } = useTranslation();
  // ── Why this screen is one of the three Crew keeps ────────────────────────
  //
  // "Your language" is a PERSONAL setting: PATCH /api/settings/language with
  // { language } writes User.language for the caller and is open to any member,
  // which is what makes this row correct for a crew member.
  //
  // "Company default" on the same screen is not. It writes
  // Company.defaultLanguage behind requirePermission(member.role, "user:manage")
  // — and the card drew a live button per language for everyone, every one of
  // which answered 403 for the member this row exists to serve. Rendered as a
  // fact now, with the notice that names who can change it.
  const canSetDefault = useSettingsAccess().canChange("user:manage");

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
      .catch(() => setError(t("app.langSettings.loadError", "Couldn't load language settings.")))
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
      if (!res.ok) throw new Error(data.error || t("app.langSettings.saveError", "Couldn't save."));

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
          {t("app.langSettings.title", "Language")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.langSettings.subtitle", "What language your clients' quotes, invoices and emails go out in.")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Personal */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">{t("app.langSettings.yourLanguage", "Your language")}</h2>
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
          {t("app.langSettings.yourLanguageHint", "What you read the app in. Each option below shows how much of the interface is translated — the rest falls back to English.")}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.langSettings.clientsNote", "This is separate from what your clients see. Quotes, invoices, PDFs and the emails carrying them go out in the client's own language in every supported language, whatever you read the app in.")}
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
              {t("app.langSettings.matchDefault", "Match company default")}
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
                <Coverage code={l.code} t={t} />
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
        <h2 className="font-semibold text-foreground">{t("app.langSettings.companyDefault", "Company default")}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          {t("app.langSettings.companyDefaultHint", "Used for team members who haven't picked a language, and for quotes and invoices to clients who don't have one set. Owners and admins only.")}
        </p>

        {canSetDefault ? (
          <>
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
              {t("app.langSettings.companyDefaultNote", "Changing this moves everyone who hasn't set their own language. It does not change quotes already sent — those keep the language they were sent in.")}
            </p>
          </>
        ) : (
          // The value, then who can change it — not a row of disabled pills. A
          // greyed-out button still says "this is where you'd change it" and
          // gives no clue who can; see PermissionNotice.js, which exists to
          // stop twelve screens inventing twelve answers to that.
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {LANGUAGES.find((l) => l.code === companyDefault)?.nativeName ||
                companyDefault}
            </p>
            <ReadOnlyNotice
              capability="user:manage"
              what={t("app.langSettings.companyDefaultReadOnlyWhat")}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        {saving && (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> {t("app.action.saving", "Saving…")}
          </span>
        )}
        {savedFlash && <span className="text-emerald-600 dark:text-emerald-400">{t("app.action.saved", "Saved")}</span>}
        <span className="text-muted-foreground">
          {t("app.langSettings.currentlyShowing", "Currently showing:")}{" "}
          {LANGUAGES.find((l) => l.code === effective)?.nativeName || effective}
        </span>
      </div>
    </div>
  );
}
