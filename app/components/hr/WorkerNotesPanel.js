"use client";

// app/components/hr/WorkerNotesPanel.js
//
// The performance file, manager side: a timeline of notes, recognitions,
// warnings and write-ups, and the form that adds one. Nothing here edits or
// deletes — lib/hr/notes.js says why. Attendance flags would join this
// timeline read-only once lib/shifts/attendance.js exists (see the route).

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, Award, AlertTriangle, FileWarning, StickyNote, Clock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { NOTE_KINDS, NOTE_KIND_DEFAULTS } from "@/lib/hr/notes";

const ICONS = { note: StickyNote, recognition: Award, warning: AlertTriangle, write_up: FileWarning };
const TONE = {
  note: "border-border bg-muted text-muted-foreground",
  recognition: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  write_up: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
};

export function noteKindLabel(t, kind) {
  return t(`app.hr.notes.kind.${kind}`, kind);
}

export default function WorkerNotesPanel({ workerId, onChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("note");
  const [visible, setVisible] = useState(NOTE_KIND_DEFAULTS.note.visibleToWorker);
  const [ack, setAck] = useState(NOTE_KIND_DEFAULTS.note.requiresAcknowledgement);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/hr/workers/${workerId}/notes`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  function pickKind(k) {
    setKind(k);
    setVisible(NOTE_KIND_DEFAULTS[k].visibleToWorker);
    setAck(NOTE_KIND_DEFAULTS[k].requiresAcknowledgement);
  }

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/hr/workers/${workerId}/notes`, {
        method: "POST",
        body: {
          kind,
          body: String(form.get("body") || ""),
          occurredAt: String(form.get("occurredAt") || "") || null,
          visibleToWorker: visible,
          requiresAcknowledgement: visible && ack,
        },
      });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const notes = data?.notes || [];
  // Attendance flags from the rota, read-only, on the same timeline. Merged
  // by date with the notes so "late three times the week before the
  // warning" reads as one story.
  const timeline = [
    ...notes.map((n) => ({ ...n, kindGroup: "note" })),
    ...(data?.attendance || []).map((a) => ({ ...a, kindGroup: "attendance" })),
  ].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));

  return (
    <section className="bg-card border border-border rounded-xl p-5" data-hr-notes>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquareText size={16} /> {t("app.hr.notes.title")}
        </h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px]" data-hr-add-note>
            {t("app.hr.notes.add")}
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="border border-border rounded-lg p-4 mb-4 space-y-3" data-hr-note-form>
          <div className="flex flex-wrap gap-2">
            {NOTE_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => pickKind(k)} className={`text-xs rounded-full border px-3 py-1.5 min-h-[36px] ${kind === k ? TONE[k] : "border-border"}`}>
                {noteKindLabel(t, k)}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.notes.body")}</span>
            <textarea name="body" required rows={4} className="w-full border border-border rounded-lg px-3 py-2 bg-card" />
          </label>
          <label className="block text-sm max-w-xs">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.notes.occurredAt")}</span>
            <input type="date" name="occurredAt" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => { setVisible(e.target.checked); if (!e.target.checked) setAck(false); }} />
            {t("app.hr.notes.visibleToWorker")}
          </label>
          <label className={`flex items-center gap-2 text-sm ${visible ? "" : "opacity-50"}`}>
            <input type="checkbox" checked={ack} disabled={!visible} onChange={(e) => setAck(e.target.checked)} />
            {t("app.hr.notes.requiresAck")}
          </label>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
              {t("app.hr.notes.save")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-full px-4 py-2 text-sm min-h-[44px]">
              {t("app.action.cancel")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("app.hr.notes.permanent")}</p>
        </form>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={data !== null && timeline.length === 0}
        onRetry={load}
        empty={<p className="text-sm text-muted-foreground">{t("app.hr.notes.empty")}</p>}
      >
        <ol className="relative border-l border-border ml-2 space-y-4" data-hr-timeline>
          {timeline.map((n) => {
            if (n.kindGroup === "attendance") {
              return (
                <li key={`att-${n.id}`} className="pl-5" data-hr-attendance data-hr-attendance-status={n.status}>
                  <span className="absolute -left-[9px] mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <Clock size={10} />
                  </span>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5">{t(`app.hr.notes.attendance.${n.status}`)}</span>
                    <span>{n.occurredAt ? formatDate(n.occurredAt) : ""}</span>
                    {n.status === "late" && n.lateMinutes ? <span>· {t("app.hr.notes.attendance.lateBy", { minutes: n.lateMinutes })}</span> : null}
                    {n.status === "early_out" && n.earlyMinutes ? <span>· {t("app.hr.notes.attendance.earlyBy", { minutes: n.earlyMinutes })}</span> : null}
                    <span>· {t("app.hr.notes.attendance.fromRota")}</span>
                  </div>
                </li>
              );
            }
            const Icon = ICONS[n.kind] || StickyNote;
            return (
              <li key={n.id} className="pl-5" data-hr-note data-hr-note-kind={n.kind}>
                <span className={`absolute -left-[9px] mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border ${TONE[n.kind]}`}>
                  <Icon size={10} />
                </span>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                  <span className={`rounded-full border px-2 py-0.5 ${TONE[n.kind]}`}>{noteKindLabel(t, n.kind)}</span>
                  <span>{formatDate(n.occurredAt)}</span>
                  {n.authorName ? <span>· {n.authorName}</span> : null}
                  <span>· {n.visibleToWorker ? t("app.hr.notes.visible") : t("app.hr.notes.private")}</span>
                  {n.requiresAcknowledgement ? (
                    <span>· {n.acknowledgedAt ? t("app.hr.notes.acknowledgedOn", { date: formatDate(n.acknowledgedAt), name: n.acknowledgedName || "" }) : t("app.hr.notes.awaitingAck")}</span>
                  ) : null}
                </div>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{n.body}</p>
              </li>
            );
          })}
        </ol>
      </ListState>
    </section>
  );
}
