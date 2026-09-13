"use client";

// app/components/hr/MyNotes.js — /app/me/notes: what my managers wrote that
// I may see, and the ones waiting for my "I have seen this".

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { noteKindLabel } from "@/app/components/hr/WorkerNotesPanel";

export default function MyNotes({ onChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/me/notes");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(note) {
    setBusy(note.id);
    setError("");
    try {
      await fetchJson(`/api/hr/me/notes/${note.id}/acknowledge`, { method: "POST", body: { signatureName: names[note.id] || "" } });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(null);
    }
  }

  const notes = data?.notes || [];
  return (
    <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && notes.length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.notes.emptySelf")}</p>}>
      <ul className="space-y-3" data-hr-my-notes>
        {notes.map((n) => (
          <li key={n.id} className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
              <span className="font-medium text-foreground">{noteKindLabel(t, n.kind)}</span>
              <span>{formatDate(n.occurredAt)}</span>
              {n.authorName ? <span>· {n.authorName}</span> : null}
            </div>
            <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{n.body}</p>
            {n.requiresAcknowledgement && !n.acknowledgedAt && (
              <form
                className="mt-4 border-t border-border pt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  acknowledge(n);
                }}
              >
                <p className="text-sm">{t("app.hr.notes.ackStatement")}</p>
                <input value={names[n.id] || ""} onChange={(e) => setNames({ ...names, [n.id]: e.target.value })} required placeholder={t("app.hr.policies.typeName")} className="w-full max-w-sm border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" />
                {error && busy === null && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                <button type="submit" disabled={busy === n.id} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
                  {t("app.hr.notes.acknowledge")}
                </button>
              </form>
            )}
            {n.acknowledgedAt && <p className="mt-3 text-xs text-muted-foreground">{t("app.hr.notes.youAcknowledged", { date: formatDate(n.acknowledgedAt) })}</p>}
          </li>
        ))}
      </ul>
    </ListState>
  );
}
