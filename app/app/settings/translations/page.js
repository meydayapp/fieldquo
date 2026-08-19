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
//
// ── What the "Draft the missing ones" button does, and doesn't ─────────────
//
// It fills the boxes. It does not save. Machine-filled boxes are labelled as
// such until the person presses Mark reviewed, which is still the only thing
// that writes anything — see app/api/settings/translations/draft/route.js for
// why, and for why this doesn't contradict AGENTS.md non-negotiable 6.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Languages,
  Loader2,
  Check,
  AlertTriangle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { LANGUAGES } from "@/app/i18n/languages";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function TranslationsPage() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState("fr");
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);
  // Ids whose box currently holds text a model wrote and nobody has saved.
  // Cleared on save and on a language change, never on edit: a half-edited
  // machine draft is still a machine draft until someone commits to it.
  const [machineFilled, setMachineFilled] = useState(() => new Set());
  const [draftReport, setDraftReport] = useState(null);

  /**
   * @param preserveIds ids whose in-progress box contents must survive the
   *   reload. Saving one row re-fetches the list, and a plain reseed from the
   *   server would blank every OTHER row's unsaved draft — draft twenty, save
   *   the first, lose nineteen. Null (the default) means a fresh start: a
   *   language change, where nothing in the boxes applies any more.
   */
  const load = useCallback(async (preserveIds = null) => {
    setLoading(true);
    setError("");
    if (!preserveIds) {
      setMachineFilled(new Set());
      setDraftReport(null);
    }
    try {
      const res = await fetch(`/api/settings/translations?language=${language}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.translations.loadFailed", "Couldn't load translations."));
      setData(d);
      setDrafts((prev) =>
        Object.fromEntries(
          d.items.map((i) => [
            i.id,
            preserveIds?.has(i.id) && prev[i.id]
              ? prev[i.id]
              : { ...i.translation },
          ]),
        ),
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

  async function draftMissing() {
    setDrafting(true);
    setError("");
    setDraftReport(null);
    try {
      const res = await fetch("/api/settings/translations/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        // The server distinguishes "no key" (503) from "over your allowance"
        // (429) from everything else, and each already carries a sentence a
        // contractor can act on. Showing it beats a generic failure.
        throw new Error(
          d?.error ||
            t("app.translations.draftFailedAll", "Couldn't draft the translations. Try again in a moment."),
        );
      }

      const filled = d.drafts || {};
      setDrafts((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(filled)) {
          next[id] = {
            name: value.name || "",
            // Keep whatever description was already in the box if the model
            // returned none — overwriting a person's text with "" would be a
            // silent deletion dressed up as a translation.
            description: value.description || next[id]?.description || "",
          };
        }
        return next;
      });
      setMachineFilled((prev) => new Set([...prev, ...Object.keys(filled)]));

      // Everything the run couldn't do, counted rather than glossed. `pending`
      // is what it set out to fill; anything neither drafted nor failed was
      // never attempted, which only happens when the allowance ran out.
      const untouched = Math.max(
        0,
        (d.pending || 0) - (d.drafted || 0) - (d.failed || 0),
      );
      setDraftReport({
        drafted: d.drafted || 0,
        failed: d.failed || 0,
        stopped: Boolean(d.stopped),
        untouched,
        nothingToDo: (d.pending || 0) === 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setDrafting(false);
    }
  }

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
      if (!res.ok) throw new Error(d?.error || t("app.translations.saveFailed", "Couldn't save."));
      // Saved means a person put their name to it. It is no longer a draft —
      // but everyone else's unsaved drafts have to survive the reload.
      const stillDrafts = new Set(machineFilled);
      stillDrafts.delete(item.id);
      setMachineFilled(stillDrafts);
      setSavedId(item.id);
      setTimeout(() => setSavedId(""), 2000);
      await load(stillDrafts);
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
        <h1 className="text-2xl font-bold text-foreground">{t("app.translations.title", "Translations")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.translations.subtitle", "The wording clients see on quotes and invoices written in another language. Drafts are generated for you — but nothing here is used with confidence until you've read it.")}
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
                {t("app.translations.stillMissing", "{count} still missing", { count: data.missing })}
              </span>
            ) : (
              <span className="text-green-700 dark:text-green-300 font-medium">
                {t("app.translations.allTranslated", "All {count} translated", { count: data.total })}
              </span>
            )}
            {data.unreviewed > 0 && ` · ${t("app.translations.draftedUnread", "{count} drafted, unread", { count: data.unreviewed })}`}
          </span>
        )}

        {/* Rendered only when it can actually do something. No key on this
            deployment, or a role that can't spend the AI allowance, gets a
            sentence instead of a button that explains itself after the click. */}
        {data?.aiAvailable && data?.canDraft && (
          <button
            onClick={draftMissing}
            disabled={drafting || loading || data.missing === 0}
            title={
              data.missing === 0
                ? t("app.translations.draftNothingToDo", "Nothing to draft — every service already has wording in this language.")
                : ""
            }
            className="ml-auto inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
          >
            {drafting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {drafting
              ? t("app.translations.drafting", "Drafting…")
              : t("app.translations.draftMissing", "Draft the missing ones")}
          </button>
        )}
      </div>

      {data && !data.aiAvailable && (
        <p className="text-sm text-muted-foreground">
          {t("app.translations.draftUnavailable", "Automatic drafting isn't switched on for this deployment. You can still type the translations in yourself.")}
        </p>
      )}

      {data?.aiAvailable && data?.canDraft && data.missing > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("app.translations.draftNote", "Drafts land in the boxes below. Nothing is saved, and nothing reaches a client, until you read each one and mark it reviewed.")}
        </p>
      )}

      {draftReport && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground space-y-1">
          {draftReport.nothingToDo ? (
            <p>{t("app.translations.draftNothingToDo", "Nothing to draft — every service already has wording in this language.")}</p>
          ) : (
            <p>
              {t("app.translations.draftFilled", "Filled in below: {count}. Read each one, then mark it reviewed.", { count: draftReport.drafted })}
            </p>
          )}
          {draftReport.failed > 0 && (
            <p className="text-amber-700 dark:text-amber-300">
              {t("app.translations.draftFailedSome", "Not translated: {count}. Type those in yourself.", { count: draftReport.failed })}
            </p>
          )}
          {draftReport.stopped && draftReport.untouched > 0 && (
            <p className="text-amber-700 dark:text-amber-300">
              {t("app.translations.draftStopped", "Stopped at this month's AI allowance — {count} still to do.", { count: draftReport.untouched })}
            </p>
          )}
        </div>
      )}

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
          {t("app.translations.emptyState", "No services yet. Add them under Settings → Products & Services and drafts will appear here.")}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => {
            const draft = drafts[item.id] || { name: "", description: "" };
            const dirty =
              draft.name !== item.translation.name ||
              draft.description !== item.translation.description;
            // Machine text sitting unsaved in the boxes. Distinct from
            // item.reviewed (saved, checked) and from the server's "drafted,
            // not read yet" (saved by an earlier authoring-time draft).
            const unsavedMachineDraft = machineFilled.has(item.id);

            return (
              <div
                key={item.id}
                className={`bg-card border rounded-xl p-5 ${
                  unsavedMachineDraft || item.missing
                    ? "border-amber-300"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.type === "product" ? t("app.translations.productLabel", "Product") : t("app.translations.serviceLabel", "Service")}
                  </div>
                  {unsavedMachineDraft ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <Sparkles size={12} /> {t("app.translations.machineDraft", "AI draft — read it before saving")}
                    </span>
                  ) : item.missing ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={12} /> {t("app.translations.notTranslated", "Not translated")}
                    </span>
                  ) : item.reviewed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
                      <Check size={12} /> {t("app.translations.reviewed", "Reviewed")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("app.translations.draftedNotRead", "Drafted — not read yet")}
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
                      placeholder={t("app.field.name", "Name")}
                      className={`w-full border rounded-lg px-3 py-2 text-sm ${
                        unsavedMachineDraft ? "border-amber-400" : "border-border"
                      }`}
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
                        placeholder={t("app.translations.descriptionPlaceholder", "Description")}
                        className={`w-full border rounded-lg px-3 py-2 text-sm mt-2 ${
                          unsavedMachineDraft ? "border-amber-400" : "border-border"
                        }`}
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
                        {item.reviewed && !dirty ? t("app.action.saved", "Saved") : t("app.translations.markReviewed", "Mark reviewed")}
                      </button>
                      {savedId === item.id && (
                        <span className="text-xs text-green-700 dark:text-green-300">{t("app.action.saved", "Saved")}</span>
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
