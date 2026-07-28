// app/app/settings/translations/page.js
//
// Review and correct the translated wording that appears on client documents.
//
// Laid out source-beside-translation, one row per service, because the job
// here is comparison — you can't judge whether "finition" is right without the
// English "finish" next to it. A tabbed or stacked layout would make that a
// memory exercise.
//
// Rows needing attention float to the top. Someone opening this page has a
// quote to send, not an afternoon.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Languages,
  Loader2,
  Check,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { LANGUAGES } from "@/app/i18n/languages";

export default function TranslationsPage() {
  const [language, setLanguage] = useState("fr");
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/translations?language=${language}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't load translations.");
      setData(d);
      setDrafts(
        Object.fromEntries(d.items.map((i) => [i.id, { ...i.translation }])),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => {
      // Missing first, then drafted-but-unreviewed, then done.
      const rank = (i) => (i.missing ? 0 : i.reviewed ? 2 : 1);
      return rank(a) - rank(b);
    });
  }, [data]);

  async function save(item) {
    setSavingId(item.id);
    setError("");
    try {
      const draft = drafts[item.id] || {};
      const res = await fetch("/api/settings/translations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.id,
          language,
          name: draft.name,
          description: draft.description,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't save.");
      setSavedId(item.id);
      setTimeout(() => setSavedId(""), 2000);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId("");
    }
  }

  const sourceName =
    LANGUAGES.find((l) => l.code === data?.sourceLanguage)?.nativeName ||
    data?.sourceLanguage;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Translations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The wording clients see on quotes and invoices written in another
          language. Drafts are generated for you — but nothing here is used with
          confidence until you&apos;ve read it.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Languages size={16} className="text-muted-foreground" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
        >
          {LANGUAGES.filter((l) => l.code !== data?.sourceLanguage).map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} — {l.name}
            </option>
          ))}
        </select>

        {data && (
          <span className="text-sm text-muted-foreground">
            {data.missing > 0 ? (
              <span className="text-amber-700 dark:text-amber-300 font-medium">
                {data.missing} still missing
              </span>
            ) : (
              <span className="text-green-700 dark:text-green-300 font-medium">
                All {data.total} translated
              </span>
            )}
            {data.unreviewed > 0 && ` · ${data.unreviewed} drafted, unread`}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-72 bg-accent rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          No services yet. Add them under Settings → Products &amp; Services and
          drafts will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => {
            const draft = drafts[item.id] || { name: "", description: "" };
            const dirty =
              draft.name !== item.translation.name ||
              draft.description !== item.translation.description;

            return (
              <div
                key={item.id}
                className={`bg-card border rounded-xl p-5 ${
                  item.missing ? "border-amber-300" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.type === "product" ? "Product" : "Service"}
                  </div>
                  {item.missing ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={12} /> Not translated
                    </span>
                  ) : item.reviewed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
                      <Check size={12} /> Reviewed
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Drafted — not read yet
                    </span>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Source — never editable here. Changing the original
                      belongs on the product itself, not on a translation
                      screen. */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {sourceName}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {item.source.name}
                    </div>
                    {item.source.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {item.source.description}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {LANGUAGES.find((l) => l.code === language)?.nativeName}
                    </div>
                    <input
                      value={draft.name}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.id]: { ...draft, name: e.target.value },
                        }))
                      }
                      placeholder="Name"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    {item.source.description && (
                      <textarea
                        value={draft.description}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              description: e.target.value,
                            },
                          }))
                        }
                        rows={2}
                        placeholder="Description"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-2"
                      />
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => save(item)}
                        disabled={savingId === item.id || !draft.name.trim()}
                        className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {savingId === item.id && (
                          <Loader2 size={11} className="animate-spin" />
                        )}
                        {item.reviewed && !dirty ? "Saved" : "Mark reviewed"}
                      </button>
                      {savedId === item.id && (
                        <span className="text-xs text-green-700 dark:text-green-300">Saved</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
