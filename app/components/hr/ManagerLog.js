"use client";

// app/components/hr/ManagerLog.js
//
// /app/log — the manager's day book. Newest day first, filtered by day or
// tag, and a composer prefilled with today. The author may correct their
// own entry; nobody deletes one. Distinct from a job's daily log — see
// ManagerLogEntry in prisma/schema.prisma.

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { LOG_TAGS, dayKey } from "@/lib/hr/log";

const TAG_TONE = {
  weather: "border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300",
  incident: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
  staffing: "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  client: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  equipment: "border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300",
  other: "border-border bg-muted text-muted-foreground",
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ManagerLog() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [day, setDay] = useState("");
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState({ id: null, date: today(), body: "", tags: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (day) q.set("day", day);
    if (tag) q.set("tag", tag);
    const result = await fetchList(`/api/hr/log${q.toString() ? `?${q}` : ""}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [day, tag]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (draft.id) await fetchJson(`/api/hr/log/${draft.id}`, { method: "PATCH", body: { date: draft.date, body: draft.body, tags: draft.tags } });
      else await fetchJson("/api/hr/log", { method: "POST", body: { date: draft.date, body: draft.body, tags: draft.tags } });
      setDraft({ id: null, date: today(), body: "", tags: [] });
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const entries = data?.entries || [];
  // Group by day for the reading view.
  const days = [];
  for (const en of entries) {
    const k = dayKey(en.date);
    let g = days.find((d) => d.key === k);
    if (!g) days.push((g = { key: k, date: en.date, entries: [] }));
    g.entries.push(en);
  }

  return (
    <div className="space-y-4" data-hr-log>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <BookOpen size={16} /> {draft.id ? t("app.hr.log.editEntry") : t("app.hr.log.todayEntry")}
          </h2>
          {!open && (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm min-h-[44px]">
              <Plus size={14} /> {t("app.hr.log.write")}
            </button>
          )}
        </div>
        {open && (
          <form onSubmit={save} className="space-y-3" data-hr-log-form>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.log.day")}</span>
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required className="border border-border rounded-lg px-3 py-2 bg-card min-h-[44px] text-sm" />
              </label>
              <div className="text-sm">
                <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.log.tags")}</span>
                <div className="flex flex-wrap gap-2">
                  {LOG_TAGS.map((tg) => {
                    const on = draft.tags.includes(tg);
                    return (
                      <button key={tg} type="button" onClick={() => setDraft({ ...draft, tags: on ? draft.tags.filter((x) => x !== tg) : [...draft.tags, tg] })} className={`text-xs rounded-full border px-3 py-1.5 min-h-[36px] ${on ? TAG_TONE[tg] : "border-border"}`}>
                        {t(`app.hr.log.tag.${tg}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={4} required placeholder={t("app.hr.log.placeholder")} className="w-full border border-border rounded-lg px-3 py-2 bg-card text-sm" />
            {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
                {t("app.hr.log.save")}
              </button>
              {draft.id && (
                <button type="button" onClick={() => setDraft({ id: null, date: today(), body: "", tags: [] })} className="border border-border rounded-full px-4 py-2 text-sm min-h-[44px]">
                  {t("app.action.cancel")}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("app.hr.log.filterDay")}</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="border border-border rounded-lg px-3 py-2 bg-card min-h-[44px] text-sm" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTag("")} className={`text-xs rounded-full border px-3 py-1.5 min-h-[36px] ${tag === "" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
            {t("app.hr.log.allTags")}
          </button>
          {LOG_TAGS.map((tg) => (
            <button key={tg} type="button" onClick={() => setTag(tg)} className={`text-xs rounded-full border px-3 py-1.5 min-h-[36px] ${tag === tg ? TAG_TONE[tg] : "border-border"}`}>
              {t(`app.hr.log.tag.${tg}`)}
            </button>
          ))}
        </div>
      </div>

      <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && entries.length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.log.empty")}</p>}>
        <div className="space-y-4" data-hr-log-days>
          {days.map((d) => (
            <section key={d.key} className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">{formatDate(d.date)}</h3>
              <ul className="divide-y divide-border">
                {d.entries.map((en) => (
                  <li key={en.id} className="py-3" data-hr-log-entry>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {en.tags.map((tg) => (
                        <span key={tg} className={`rounded-full border px-2 py-0.5 ${TAG_TONE[tg] || TAG_TONE.other}`}>
                          {t(`app.hr.log.tag.${tg}`)}
                        </span>
                      ))}
                      {en.authorName ? <span>{en.authorName}</span> : null}
                      {en.mine && (
                        <button type="button" onClick={() => { setDraft({ id: en.id, date: dayKey(en.date), body: en.body, tags: en.tags }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="underline">
                          {t("app.action.edit")}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{en.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {data?.truncated && <p className="text-xs text-muted-foreground">{t("app.hr.log.truncated")}</p>}
        </div>
      </ListState>
    </div>
  );
}
