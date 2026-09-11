"use client";

// app/components/sales/RepSellsInChoice.js
//
// "Languages I can sell in" — the rep's own list. One component, two homes:
// /sales/pay (the settings screen) and /sales/welcome (the first-run pass),
// rendered directly under RepLanguageChoice on both, because a rep who has
// just said what language the portal should speak is standing at the right
// question to say which languages THEY speak.
//
// ══ Why this is not the portal-language picker ════════════════════════════
//
// RepLanguageChoice writes SalesRep.language, which draws the chrome. This
// writes SalesRep.sellsIn, which the queue reads before handing out a
// prospect: a Quebec row goes only to a rep whose list carries French —
// lib/sales/leadLanguage.js. A rep can read the console in English and sell
// in French, so the two are two controls, and the explainer says which is
// which.
//
// ══ Empty is shown as unset, not as "English" ═════════════════════════════
//
// SalesRep.sellsIn defaults to []. Allocation reads [] as English-only, which
// is the safe direction; the screen reads it as "you have not answered" and
// says so, so the safe reading never quietly becomes the permanent one. The
// sentence names the consequence — every Quebec lead is held back — because
// that is the thing a rep would otherwise discover as "why is my queue so
// small".
import { useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function RepSellsInChoice({ onSaved }) {
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [choice, setChoice] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Resolved outside the callback so its dependency is a string rather than
  // t(), which is a new identity on every language change.
  const loadFailedMessage = t("app.salesSellsIn.loadFailed");

  const load = useCallback(async () => {
    try {
      const json = await fetchJson("/api/sales/sells-in");
      setData(json);
      setChoice(Array.isArray(json.sellsIn) ? json.sellsIn : []);
      setError("");
    } catch (err) {
      // Never silent — the point of the control is that what is on screen is
      // what is in the database.
      setError(err?.message || loadFailedMessage);
    } finally {
      setLoading(false);
    }
  }, [loadFailedMessage]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(code) {
    setSaved(false);
    setChoice((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const json = await fetchJson("/api/sales/sells-in", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellsIn: choice }),
      });
      setData(json);
      setChoice(Array.isArray(json.sellsIn) ? json.sellsIn : []);
      setSaved(true);
      onSaved?.(json.sellsIn);
    } catch (err) {
      setError(err?.message || t("app.salesSellsIn.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("app.salesSellsIn.loading")}</p>;
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">{error || loadFailedMessage}</p>
      </div>
    );
  }

  const stored = Array.isArray(data.sellsIn) ? data.sellsIn : [];
  const dirty = !same(choice, stored);
  const unset = stored.length === 0;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex gap-2">
        <MessageSquareText size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t("app.salesSellsIn.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.salesSellsIn.explainer")}</p>
        </div>
      </div>

      {unset ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 break-words">
          {t("app.salesSellsIn.unset")}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="sr-only">{t("app.salesSellsIn.legend")}</legend>
        {(data.options || []).map((o) => {
          const on = choice.includes(o.code);
          return (
            <label
              key={o.code}
              className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
                on ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              }`}
            >
              <input
                type="checkbox"
                name="sellsIn"
                value={o.code}
                checked={on}
                onChange={() => toggle(o.code)}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                {/* Native name first, for RepLanguageChoice's reason: a rep
                    looks for "Français", not "French". */}
                <span className="block font-medium text-foreground">{o.nativeName}</span>
                <span className="block text-sm text-muted-foreground mt-0.5">{o.name}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <p className="text-xs text-muted-foreground">{t("app.salesSellsIn.hint")}</p>

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
          {busy ? t("app.salesSellsIn.saving") : t("app.salesSellsIn.save")}
        </button>
        {saved && !dirty ? (
          <span className="text-sm text-muted-foreground">{t("app.salesSellsIn.saved")}</span>
        ) : null}
      </div>
    </form>
  );
}
