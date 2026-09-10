"use client";

// app/components/sales/RepLanguageChoice.js
//
// The rep's own language picker. One component, two homes: /sales/pay (the
// settings screen) and /sales/welcome (the first-run pass).
//
// Shared rather than written twice, because the copy below is the honest part
// of this feature — it says how much of the portal actually changes — and a
// second copy is the one that rots, which would leave one of the two screens
// promising a fully translated console.
//
// ══ Why "Follow my browser" is a real option and not a blank ══════════════
//
// SalesRep.language is nullable and null means "nobody has stated one" — see
// lib/sales/repLanguage.js. A picker with no way back to null would make the
// first click permanent: a rep who tried French could never return to "just do
// whatever my browser does", and the column would fill up with choices nobody
// meant to make. It is the first option, selected when nothing is stored, so
// the screen shows the state the database is actually in.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useLanguageContext } from "@/app/providers/LanguageProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

/** The sentinel the radio group uses for "no stated preference". */
const BROWSER = "__browser__";

export default function RepLanguageChoice({ onSaved }) {
  const router = useRouter();
  const { changeLanguage } = useLanguageContext();
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [choice, setChoice] = useState(BROWSER);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Resolved outside the callback so the callback's dependency is a string
  // rather than t(), which is a new function identity on every language change
  // and would re-fire the load for no reason.
  const loadFailedMessage = t("app.salesLang.loadFailed");

  // No setLoading(true) here for the same reason app/sales/pay's loader gives:
  // `loading` already starts true, and a synchronous set inside the effect
  // triggers the cascading render the React compiler rejects.
  const load = useCallback(async () => {
    try {
      const json = await fetchJson("/api/sales/language");
      setData(json);
      setChoice(json.language || BROWSER);
      setError("");
    } catch (err) {
      // Never a silent failure — the whole point of the control is that what
      // is on screen is what is in the database.
      setError(err?.message || loadFailedMessage);
    } finally {
      setLoading(false);
    }
  }, [loadFailedMessage]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const language = choice === BROWSER ? null : choice;
    try {
      const json = await fetchJson("/api/sales/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      setData(json);
      setChoice(json.language || BROWSER);
      setSaved(true);

      // Two steps, and both are needed.
      //
      // changeLanguage() moves the chrome NOW, so the tabs above change while
      // the rep is still looking at the button they pressed. Without it the
      // control looks dead until the refresh lands, which on a bad connection
      // is a second or two of nothing.
      //
      // router.refresh() re-runs app/sales/layout.js, which is the only place
      // that knows whether this is a DECISION — it re-reads the column and
      // hands the provider `fromAccount` accordingly. Skipping it would leave
      // the shell in the previous mode until a hard reload: a rep who cleared
      // their preference would keep seeing the language they just cleared,
      // because `fromAccount` would still be true and the provider would keep
      // ignoring the browser.
      if (json.language) changeLanguage(json.language);
      router.refresh();
      onSaved?.(json.language);
    } catch (err) {
      setError(err?.message || t("app.salesLang.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("app.salesLang.loading")}</p>;
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">{error || loadFailedMessage}</p>
      </div>
    );
  }

  const dirty = choice !== (data.language || BROWSER);

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex gap-2">
        <Languages size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.salesLang.heading")}
          </h2>
          {/* Said plainly rather than implied, and REWRITTEN when it stopped
              being true. This paragraph used to list ten screens that were
              "still written in English" — queue, leads, conversations, texts,
              notes, calendar, demo, support, voicemail and this one. They are
              translated now, so the old sentence would be the control that
              appears to work and doesn't, inverted: a picker under-promising
              what it does. What is still English is named instead, because a
              rep who meets one of those has to be able to tell "not translated
              yet" from "this is somebody's own words". */}
          <p className="text-sm text-muted-foreground">{t("app.salesLang.explainer")}</p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t("app.salesLang.legend")}</legend>

        {/* First, and selected when nothing is stored, because that is the
            state the row is actually in. */}
        <label
          className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
            choice === BROWSER ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
          }`}
        >
          <input
            type="radio"
            name="repLanguage"
            value={BROWSER}
            checked={choice === BROWSER}
            onChange={() => {
              setChoice(BROWSER);
              setSaved(false);
            }}
            className="mt-1 shrink-0"
          />
          <span className="min-w-0">
            <span className="block font-medium text-foreground">
              {t("app.salesLang.followBrowser")}
            </span>
            <span className="block text-sm text-muted-foreground mt-0.5">
              {t("app.salesLang.followBrowserBody")}
            </span>
          </span>
        </label>

        {(data.options || []).map((o) => (
          <label
            key={o.code}
            className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
              choice === o.code ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
            }`}
          >
            <input
              type="radio"
              name="repLanguage"
              value={o.code}
              checked={choice === o.code}
              onChange={() => {
                setChoice(o.code);
                setSaved(false);
              }}
              className="mt-1 shrink-0"
            />
            <span className="min-w-0">
              {/* The native name leads: a rep scanning for their own language
                  looks for "Français", not for "French". The English name
                  follows for anybody setting it up on somebody else's behalf. */}
              <span className="block font-medium text-foreground">{o.nativeName}</span>
              <span className="block text-sm text-muted-foreground mt-0.5">{o.name}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 break-words" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="inline-flex items-center min-h-[44px] rounded-full bg-primary text-primary-foreground px-5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? t("app.salesLang.saving") : t("app.salesLang.save")}
        </button>
        {saved && !dirty ? (
          <span className="text-sm text-muted-foreground">{t("app.salesLang.saved")}</span>
        ) : null}
      </div>
    </form>
  );
}
