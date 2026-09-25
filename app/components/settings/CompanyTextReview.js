// app/components/settings/CompanyTextReview.js
//
// The "Your wording" half of /app/settings/translations: the company's own
// client-facing texts (payment terms, what happens next, the story, the SMS
// wordings) and the quote text blocks, each with its auto-draft in the chosen
// language, an Auto / Reviewed / Pending / Outdated badge, and a box to
// correct it. Reads and writes app/api/settings/translations/company.
//
// Source beside translation, one row per text — the same layout as the
// product rows below it on the page, for the same reason: the job is
// comparison.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { LANGUAGES } from "@/app/i18n/languages";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

function StatusBadge({ status, reviewedAt, formatDate, t }) {
  if (status === "reviewed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
        <Check size={12} /> {t("app.translations.statusReviewed", "Reviewed")}
        {reviewedAt ? ` · ${formatDate(reviewedAt)}` : ""}
      </span>
    );
  }
  if (status === "drafted") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Sparkles size={12} /> {t("app.translations.statusAuto", "Auto — translated automatically, not yet read")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={12} /> {t("app.translations.statusPending", "Pending — the draft hasn't landed; clients see the original for now")}
      </span>
    );
  }
  if (status === "outdated") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle size={12} /> {t("app.translations.statusOutdated", "Outdated — the original changed; a fresh draft is on its way")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle size={12} /> {t("app.translations.notTranslated", "Not translated")}
    </span>
  );
}

// ── A trade's edited job-process wording (2026-09-25) ───────────────────────
// The scope paragraph is one box; "what's included" is one line per bullet;
// the steps are a title / body / timeline per step, the same shape the
// Settings › Services editor writes. The server refuses a reviewed list whose
// count or [prompts] differ from the original.
function serviceDraftText(field, value) {
  if (field === "scopeDescription") return typeof value === "string" ? value : "";
  if (field === "includedItems") return Array.isArray(value) ? value.join("\n") : "";
  return Array.isArray(value) ? value.map((s) => ({ title: s?.title || "", body: s?.body || "", timeline: s?.timeline || "" })) : null;
}

function serviceDraftValue(field, draft, source) {
  if (field === "scopeDescription") return String(draft || "");
  if (field === "includedItems") return String(draft || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const steps = Array.isArray(draft) ? draft : [];
  return steps.map((s, i) => ({
    title: s.title,
    body: s.body,
    ...(source?.[i]?.timeline ? { timeline: s.timeline } : {}),
  }));
}

const SERVICE_FIELD_LABEL = {
  scopeDescription: ["app.translations.serviceScope", "What the work is"],
  includedItems: ["app.translations.serviceIncluded", "What's included"],
  processSteps: ["app.translations.serviceSteps", "How the job runs"],
};

export default function CompanyTextReview({ language, nested = false }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState("");
  const [savedKey, setSavedKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/translations/company?language=${encodeURIComponent(language)}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.translations.loadFailed", "Couldn't load translations."));
      setData(d);
      const next = {};
      for (const i of d.items) next[i.key] = i.translation || "";
      for (const b of d.textBlocks) next[`block:${b.id}`] = { name: b.translation.name || "", body: b.translation.body || "" };
      for (const s of d.serviceItems || []) next[`service:${s.id}`] = serviceDraftText(s.field, s.translation);
      setDrafts(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(payload, id) {
    setSavingKey(id);
    setError("");
    try {
      const res = await fetch("/api/settings/translations/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, ...payload }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.translations.saveFailed", "Couldn't save."));
      setSavedKey(id);
      setTimeout(() => setSavedKey(""), 2000);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey("");
    }
  }

  // Per text since detection (2026-09-25): a story written in French at an
  // English-default company is labelled French, whatever the default says.
  const nameOf = (code) =>
    code === "other"
      ? t("app.autoTranslate.otherLanguage", "Another language")
      : LANGUAGES.find((l) => l.code === code)?.nativeName || code;
  const sourceNameOf = (item) => nameOf(item?.sourceLanguage || data?.sourceLanguage);
  const targetName = LANGUAGES.find((l) => l.code === language)?.nativeName || language;

  if (loading) return <div className="animate-pulse h-40 bg-accent rounded-xl" />;

  const serviceItems = data?.serviceItems || [];
  const empty = !data || (data.items.length === 0 && data.textBlocks.length === 0 && serviceItems.length === 0);
  // Texts written in another language than the company's default have a
  // draft IN the default, which the page's language picker (default
  // excluded) cannot reach — so it is listed here, once, under its own title.
  const showDefaultSection = !nested && data?.foreignSource && data.defaultLanguage && data.defaultLanguage !== language;

  return (
    <section className="space-y-3" id={nested ? undefined : "company-text"}>
      <div hidden={nested}>
        <h2 className="text-lg font-semibold text-foreground">{t("app.translations.companyTitle", "Your wording")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.translations.companyHint", "Payment terms, what happens next, your story, your text messages and your quote text blocks are translated automatically when you save them. Clients in this language receive the translation as it stands — read it and correct anything that isn't how you'd say it.")}
        </p>
        {data && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.translations.companyCounts", "{reviewed} reviewed · {drafted} auto · {pending} pending", data.counts)}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {empty ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          {t("app.translations.companyEmpty", "Nothing here yet. Write your payment terms, your story or a text-message wording in Settings and its translations will appear here.")}
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => {
            const draft = drafts[item.key] ?? "";
            const dirty = draft !== (item.translation || "");
            const attention = item.status !== "reviewed";
            return (
              <div key={item.key} className={`bg-card border rounded-xl p-5 ${attention ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(item.labelKey, item.label)}
                  </div>
                  <StatusBadge status={item.status} reviewedAt={item.reviewedAt} formatDate={formatDate} t={t} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{sourceNameOf(item)}</div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{item.source}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{targetName}</div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))}
                      rows={Math.min(12, Math.max(2, Math.ceil((item.source.length || 0) / 70)))}
                      disabled={!data.canEdit}
                      placeholder={item.status === "pending" ? t("app.translations.pendingPlaceholder", "No draft yet — type the translation, or save the original again to retry.") : ""}
                      className={`w-full border rounded-lg px-3 py-2 text-sm ${item.status === "drafted" ? "border-amber-400" : "border-border"}`}
                    />
                    {item.previousText && (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">{t("app.translations.previousReviewed", "Your earlier reviewed wording")}</summary>
                        <p className="mt-1 whitespace-pre-wrap">{item.previousText}</p>
                      </details>
                    )}
                    {data.canEdit && (
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => save({ key: item.key, text: draft }, item.key)}
                          disabled={savingKey === item.key || !draft.trim()}
                          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {savingKey === item.key && <Loader2 size={11} className="animate-spin" />}
                          {item.status === "reviewed" && !dirty ? t("app.action.saved", "Saved") : t("app.translations.markReviewed", "Mark reviewed")}
                        </button>
                        {savedKey === item.key && <span className="text-xs text-green-700 dark:text-green-300">{t("app.action.saved", "Saved")}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {data.textBlocks.length > 0 && (
            <h3 className="text-sm font-semibold text-foreground pt-2">{t("app.translations.textBlocksTitle", "Quote text blocks")}</h3>
          )}
          {data.textBlocks.map((b) => {
            const id = `block:${b.id}`;
            const draft = drafts[id] || { name: "", body: "" };
            const dirty = draft.name !== b.translation.name || draft.body !== b.translation.body;
            const attention = b.status !== "reviewed";
            return (
              <div key={b.id} className={`bg-card border rounded-xl p-5 ${attention ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.translations.textBlockLabel", "Text block")}
                  </div>
                  <StatusBadge status={b.status} reviewedAt={b.reviewedAt} formatDate={formatDate} t={t} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{sourceNameOf(b)}</div>
                    <div className="text-sm font-medium text-foreground">{b.source.name}</div>
                    {b.source.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{b.source.body}</p>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{targetName}</div>
                    <input
                      value={draft.name}
                      onChange={(e) => setDrafts((d) => ({ ...d, [id]: { ...draft, name: e.target.value } }))}
                      disabled={!data.canEdit}
                      placeholder={t("app.field.name", "Name")}
                      className={`w-full border rounded-lg px-3 py-2 text-sm ${b.status === "drafted" ? "border-amber-400" : "border-border"}`}
                    />
                    {b.source.body && (
                      <textarea
                        value={draft.body}
                        onChange={(e) => setDrafts((d) => ({ ...d, [id]: { ...draft, body: e.target.value } }))}
                        rows={Math.min(12, Math.max(2, Math.ceil((b.source.body.length || 0) / 70)))}
                        disabled={!data.canEdit}
                        className={`w-full border rounded-lg px-3 py-2 text-sm mt-2 ${b.status === "drafted" ? "border-amber-400" : "border-border"}`}
                      />
                    )}
                    {data.canEdit && (
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => save({ textBlockId: b.id, name: draft.name, body: draft.body }, id)}
                          disabled={savingKey === id || !draft.name.trim()}
                          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {savingKey === id && <Loader2 size={11} className="animate-spin" />}
                          {b.status === "reviewed" && !dirty ? t("app.action.saved", "Saved") : t("app.translations.markReviewed", "Mark reviewed")}
                        </button>
                        {savedKey === id && <span className="text-xs text-green-700 dark:text-green-300">{t("app.action.saved", "Saved")}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {serviceItems.length > 0 && (
            <h3 className="text-sm font-semibold text-foreground pt-2">{t("app.translations.serviceTitle", "Your job-process wording")}</h3>
          )}
          {serviceItems.map((s) => {
            const id = `service:${s.id}`;
            const draft = drafts[id];
            const attention = s.status !== "reviewed";
            const [labelKey, labelFallback] = SERVICE_FIELD_LABEL[s.field];
            const sourceSteps = Array.isArray(s.source) ? s.source : [];
            const value = serviceDraftValue(s.field, draft, sourceSteps);
            const ready = s.field === "scopeDescription" ? Boolean(String(draft || "").trim()) : Array.isArray(value) && value.length === sourceSteps.length;
            const box = `w-full border rounded-lg px-3 py-2 text-sm ${s.status === "drafted" ? "border-amber-400" : "border-border"}`;
            return (
              <div key={s.id} className={`bg-card border rounded-xl p-5 ${attention ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.trade} · {t(labelKey, labelFallback)}
                  </div>
                  <StatusBadge status={s.status} reviewedAt={s.reviewedAt} formatDate={formatDate} t={t} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{sourceNameOf(s)}</div>
                    {s.field === "scopeDescription" && <p className="text-sm text-foreground whitespace-pre-wrap">{s.source}</p>}
                    {s.field === "includedItems" && (
                      <ul className="text-sm text-foreground list-disc pl-5 space-y-1">
                        {sourceSteps.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    )}
                    {s.field === "processSteps" && (
                      <ol className="text-sm text-foreground list-decimal pl-5 space-y-2">
                        {sourceSteps.map((st, i) => (
                          <li key={i}>
                            <span className="font-medium">{st.title}</span>
                            {st.timeline ? <span className="text-muted-foreground"> · {st.timeline}</span> : null}
                            {st.body ? <p className="text-muted-foreground">{st.body}</p> : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{targetName}</div>
                    {s.field !== "processSteps" ? (
                      <textarea
                        value={typeof draft === "string" ? draft : ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                        rows={s.field === "includedItems" ? Math.min(20, Math.max(2, sourceSteps.length)) : 5}
                        disabled={!data.canEdit}
                        placeholder={s.field === "includedItems" ? t("app.translations.oneLinePerItem", "One line per item, in the same order") : ""}
                        className={box}
                      />
                    ) : (
                      <div className="space-y-3">
                        {sourceSteps.map((st, i) => {
                          const steps = Array.isArray(draft) && draft.length === sourceSteps.length ? draft : sourceSteps.map(() => ({ title: "", body: "", timeline: "" }));
                          const set = (patch) => setDrafts((d) => ({ ...d, [id]: steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                          return (
                            <div key={i} className="space-y-1">
                              <input value={steps[i].title} onChange={(e) => set({ title: e.target.value })} disabled={!data.canEdit} className={box} placeholder={`${i + 1}.`} />
                              <textarea value={steps[i].body} onChange={(e) => set({ body: e.target.value })} disabled={!data.canEdit} rows={2} className={box} />
                              {st.timeline ? <input value={steps[i].timeline} onChange={(e) => set({ timeline: e.target.value })} disabled={!data.canEdit} className={box} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {data.canEdit && (
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => save({ serviceRowId: s.rowId, field: s.field, value }, id)}
                          disabled={savingKey === id || !ready}
                          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 min-h-9 rounded-lg disabled:opacity-50"
                        >
                          {savingKey === id && <Loader2 size={11} className="animate-spin" />}
                          {t("app.translations.markReviewed", "Mark reviewed")}
                        </button>
                        {savedKey === id && <span className="text-xs text-green-700 dark:text-green-300">{t("app.action.saved", "Saved")}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDefaultSection && (
        <div className="pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t("app.translations.defaultLanguageTitle", "Written in another language — their {language} version", { language: nameOf(data.defaultLanguage) })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("app.translations.defaultLanguageHint", "Some of your wording is written in a language other than your default. Clients reading in {language} get this translation.", { language: nameOf(data.defaultLanguage) })}
          </p>
          <CompanyTextReview language={data.defaultLanguage} nested />
        </div>
      )}
    </section>
  );
}
