// app/components/email/EmailPreferencesPanel.js
//
// The three optional email categories (lib/email/preferences.js), as one
// panel used in two places:
//
//   - the no-login page behind every commercial email's footer
//     (app/email-preferences/[token]), endpoint /api/email-preferences/<token>;
//   - Settings › Notifications in the app, endpoint
//     /api/settings/email-preferences (the session's own user).
//
// One component so the two can never offer different switches. Words come
// from lib/i18n/lifecycleEmailCopy.js, in the reader's language.
//
// ── Nothing is shown as saved until the server said so ─────────────────────
//
// The checkboxes are a draft; "Save" PUTs them and the panel then shows what
// the server RETURNED, not what was ticked. A failed save keeps the draft and
// says it failed (fetchJson throws on any non-2xx — no `if (res.ok)` without
// an else).
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Mail } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { lifecycleT } from "@/lib/i18n/lifecycleEmailCopy";
import { PREFERENCE_CATEGORIES } from "@/lib/email/preferences";

export default function EmailPreferencesPanel({ endpoint, language = null, highlight = null, inApp = false }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const lang = language || state.data?.language || "en";
  const t = lifecycleT(lang);
  const catName = (c) => t(`prefs.cat.${c}`);

  useEffect(() => {
    let cancelled = false;
    fetchJson(endpoint)
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", data });
        setDraft(data.preferences);
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err?.status === 404 ? "invalid" : err.message || "load", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function save(patch, note) {
    setSaving(true);
    setSaveError("");
    setSavedNote("");
    try {
      const res = await fetchJson(endpoint, { method: "PUT", body: patch });
      setDraft(res.preferences);
      setState((s) => ({ ...s, data: { ...s.data, preferences: res.preferences } }));
      setSavedNote(note || t("prefs.saved"));
    } catch (err) {
      setSaveError(t("prefs.error"));
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground flex items-start gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <span>{state.error === "invalid" ? t("prefs.invalid") : t("prefs.loadError")}</span>
      </div>
    );
  }

  const saved = state.data.preferences;
  const dirty = PREFERENCE_CATEGORIES.some((c) => draft?.[c] !== saved?.[c]);
  const highlighted = PREFERENCE_CATEGORIES.includes(highlight) ? highlight : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Mail size={18} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          {inApp ? (
            <h2 className="font-semibold text-foreground">{t("prefs.appTitle")}</h2>
          ) : (
            <h1 className="text-lg font-semibold text-foreground">{t("prefs.title")}</h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {inApp ? t("prefs.appIntro") : t("prefs.intro", { email: state.data.email })}
          </p>
        </div>
      </div>

      {state.data.doNotContact === true && (
        <div role="note" className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200">
          {t("prefs.doNotContact")}
        </div>
      )}

      {highlighted && saved?.[highlighted] !== false && (
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ [highlighted]: false }, t("prefs.unsubscribedOne", { category: catName(highlighted) }))}
          className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold py-2.5 px-4 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("prefs.unsubscribeOne", { category: catName(highlighted) })}
        </button>
      )}

      <div className="space-y-3">
        {PREFERENCE_CATEGORIES.map((c) => (
          <label key={c} className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(draft?.[c])}
              disabled={saving}
              onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.checked }))}
            />
            <span>
              <span className="font-medium">{catName(c)}</span>
              <span className="block text-muted-foreground">{t(`prefs.cat.${c}.desc`)}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">{t("prefs.always")}</p>

      {saveError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {saveError}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => save(Object.fromEntries(PREFERENCE_CATEGORIES.map((c) => [c, Boolean(draft?.[c])])))}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("prefs.save")}
        </button>
        {PREFERENCE_CATEGORIES.some((c) => saved?.[c]) && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(Object.fromEntries(PREFERENCE_CATEGORIES.map((c) => [c, false])))}
            className="text-sm underline text-foreground disabled:opacity-60"
          >
            {t("prefs.unsubscribeAll")}
          </button>
        )}
        {savedNote && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
            <Check size={14} /> {savedNote}
          </span>
        )}
      </div>
    </div>
  );
}
