"use client";

// app/app/scheduler/EventDialog.js
//
// "Add event" on the week grid's Events row: a title, a description, one
// day. POST /api/schedule-events; editing an existing one PATCHes it, and
// the ✕ deletes it behind a confirm (schedule edit_all on all three).
import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function EventDialog({ ymd, event = null, onClose, onSaved, t }) {
  const editing = Boolean(event?.id);
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [busy, setBusy] = useState(false);
  const field = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/schedule-events/${event.id}` : "/api/schedule-events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { title: title.trim(), description: description.trim() } : { date: ymd, title: title.trim(), description: description.trim() }),
      });
      if (!res.ok) return reportResponseError(res, t("app.scheduler.eventSaveError"));
      await onSaved?.();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!editing || !window.confirm(t("app.scheduler.eventDeleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/schedule-events/${event.id}`, { method: "DELETE" });
      if (!res.ok) return reportResponseError(res);
      await onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="fq-dialog-card w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{editing ? t("app.scheduler.editEvent") : t("app.scheduler.addEvent")}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">{t("app.scheduler.eventTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} className={field} autoFocus />
        </label>
        <label className="mt-3 block">
          <span className="text-xs text-muted-foreground">{t("app.scheduler.eventDescription")}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 600))} rows={3} className={field} />
        </label>
        <button type="button" onClick={save} disabled={busy || !title.trim()} className="mt-4 w-full rounded-lg bg-inverted py-2.5 text-sm font-semibold text-inverted-foreground disabled:opacity-60">
          {editing ? t("app.action.save") : t("app.scheduler.addEvent")}
        </button>
        {editing ? (
          <button type="button" onClick={remove} disabled={busy} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-300">
            <Trash2 size={14} /> {t("app.scheduler.deleteEvent")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
