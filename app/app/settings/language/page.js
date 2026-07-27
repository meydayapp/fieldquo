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
import { useTranslation } from "@/app/hooks/useTranslation";

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
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const effective = personal ?? companyDefault;

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe size={20} className="text-gray-400" />
          Language
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          What you read the app in, and what your team and clients get by
          default.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Personal */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900">Your language</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Only affects what you see. Your teammates and clients are unaffected.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => save({ language: null })}
            disabled={saving}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left ${
              personal === null
                ? "border-gray-900 bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-sm text-gray-800">
              Match company default
              <span className="text-gray-500">
                {" "}
                —{" "}
                {LANGUAGES.find((l) => l.code === companyDefault)?.nativeName ||
                  companyDefault}
              </span>
            </span>
            {personal === null && <Check size={16} className="text-gray-900" />}
          </button>

          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => save({ language: l.code })}
              disabled={saving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left ${
                personal === l.code
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-sm text-gray-800">
                {l.nativeName}
                <span className="text-gray-500"> — {l.name}</span>
              </span>
              {personal === l.code && (
                <Check size={16} className="text-gray-900" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Company default */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900">Company default</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
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
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.nativeName}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Changing this moves everyone who hasn&apos;t set their own language.
          It does not change quotes already sent — those keep the language they
          were sent in.
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {saving && (
          <span className="text-gray-500 flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Saving…
          </span>
        )}
        {savedFlash && <span className="text-emerald-600">Saved</span>}
        <span className="text-gray-400">
          Currently showing:{" "}
          {LANGUAGES.find((l) => l.code === effective)?.nativeName || effective}
        </span>
      </div>
    </div>
  );
}
