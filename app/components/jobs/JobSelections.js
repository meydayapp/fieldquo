// app/components/jobs/JobSelections.js
//
// "Colours & materials" on the job page: what the work is done in, one row per
// area — "Uppers: BM Chantilly Lace OC-65, satin, 2 coats", "Shingles: GAF
// Timberline HDZ, Charcoal". The owner (2026-10-10): "in the job they should
// have a place where that can be recorded. If they use multiple colors it
// should allow for that."
//
// ── Who sees what ───────────────────────────────────────────────────────────
//
// Everyone who can open the job reads it — Crew on their own jobs most of all,
// they mix the paint. Add, edit, reorder, remove and "Pull from quote" are
// offered exactly when GET says `canEdit` (jobs:view_create_edit, the level
// the routes enforce — lib/jobs/selectionsAccess.js), so no control here
// answers 403.
//
// ── Pull from quote ─────────────────────────────────────────────────────────
//
// A job created from an accepted quote already has the quote's rows (each
// service's cabinet Colour / Sheen / Door style and its added colour rows).
// The button is for the jobs made before that copy existed, and for rows
// added to the quote since. Pressing it twice adds nothing twice, and never
// overwrites a row somebody has edited here.
//
// ── Remove ──────────────────────────────────────────────────────────────────
//
// Removes the row, and only the row: the quote keeps its colour, and pulling
// again brings a pulled row back. Asked once, inline.
//
// INTERNAL for now: not on the client's quote or portal (owner decision
// pending). A later "show to client" reads these same rows.
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, ImagePlus, Loader2, Palette, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { uploadFile } from "@/lib/media/uploadClient";
import SelectionFields, { coatsTextFor } from "@/app/components/selections/SelectionFields";
import {
  SELECTION_TEMPLATES,
  SELECTION_TEMPLATE_KEYS,
  formatSelectionLine,
  isBlankSelection,
} from "@/lib/jobs/selections";

const EDITABLE = ["templateKey", "area", "product", "colourName", "colourCode", "finish", "coats", "notes", "swatchUrl"];

function draftFrom(row, templateKey) {
  const d = { templateKey: row?.templateKey || templateKey || "generic" };
  for (const f of EDITABLE) if (f !== "templateKey") d[f] = row?.[f] ?? "";
  return d;
}

export default function JobSelections({ jobId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // { id: <row id> | "new", draft }
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setData(await fetchJson(`/api/jobs/${jobId}/selections`));
    } catch (err) {
      setLoadError(errorText(t, err) || t("app.selections.loadError", "Couldn't load this job's colours and materials."));
    } finally {
      setLoading(false);
    }
  }, [jobId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const coatsText = coatsTextFor(t);
  const rows = data?.selections || [];
  const canEdit = Boolean(data?.canEdit);
  const defaultTemplate = data?.templates?.[0] || "generic";

  async function run(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setError(errorText(t, err) || t("app.selections.saveError", "That didn't save."));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!editing) return;
    const body = { ...editing.draft };
    if (isBlankSelection(body)) {
      setError(t("app.selections.emptyRow", "Say at least the area, the product or the colour."));
      return;
    }
    run(async () => {
      const next =
        editing.id === "new"
          ? await fetchJson(`/api/jobs/${jobId}/selections`, { method: "POST", body })
          : await fetchJson(`/api/jobs/${jobId}/selections/${editing.id}`, { method: "PATCH", body });
      setData(next);
      setEditing(null);
    });
  }

  function remove(id) {
    run(async () => {
      setData(await fetchJson(`/api/jobs/${jobId}/selections/${id}`, { method: "DELETE" }));
      setConfirmRemove(null);
    });
  }

  function move(index, delta) {
    const j = index + delta;
    if (j < 0 || j >= rows.length) return;
    const order = rows.map((r) => r.id);
    [order[index], order[j]] = [order[j], order[index]];
    run(async () => {
      setData(await fetchJson(`/api/jobs/${jobId}/selections`, { method: "PATCH", body: { order } }));
    });
  }

  function pull() {
    run(async () => {
      const next = await fetchJson(`/api/jobs/${jobId}/selections/pull`, { method: "POST" });
      setData(next);
      const p = next?.pulled || {};
      setNotice(
        p.added > 0
          ? t("app.selections.pulledAdded", "{n} added from the quote.", { n: p.added })
          : p.total > 0
            ? t("app.selections.pulledNone", "Everything on the quote is already here.")
            : t("app.selections.pulledEmpty", "The quote has no colours recorded."),
      );
    });
  }

  async function pickSwatch(e) {
    const file = e.target.files?.[0];
    // Cleared so picking the same photo again after a failure still fires.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const up = await uploadFile(file, { purpose: "jobs" });
      setEditing((ed) => (ed ? { ...ed, draft: { ...ed.draft, swatchUrl: up.url } } : ed));
    } catch (err) {
      setError(err?.message || t("app.selections.swatchFailed", "That photo didn't upload."));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  // Someone the routes refuse never reaches this page; a load that FAILED is
  // said, never drawn as an empty list (an empty list says "none recorded").
  if (loadError) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-destructive" role="alert">
        {loadError}
      </div>
    );
  }

  const editor = (key) => {
    const d = editing.draft;
    return (
      <div className="rounded-lg border border-border p-3 space-y-2" data-selection-editor={key}>
        <label className="block text-xs text-muted-foreground">
          {t("app.selections.template", "Suggestions for")}
          <select
            value={d.templateKey}
            onChange={(e) => setEditing((ed) => ({ ...ed, draft: { ...ed.draft, templateKey: e.target.value } }))}
            className="ml-2 border border-border rounded px-2 py-1 text-sm bg-card text-foreground"
          >
            {SELECTION_TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(SELECTION_TEMPLATES[k].label[0], SELECTION_TEMPLATES[k].label[1])}
              </option>
            ))}
          </select>
        </label>
        <SelectionFields
          value={d}
          onChange={(patch) => setEditing((ed) => ({ ...ed, draft: { ...ed.draft, ...patch } }))}
          templateKey={d.templateKey}
          idPrefix={`jsel-${key}`}
          t={t}
        />
        <div className="flex flex-wrap items-center gap-3">
          {d.swatchUrl ? (
            <span className="inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.swatchUrl} alt={t("app.selections.swatch", "Swatch photo")} className="h-10 w-10 rounded object-cover border border-border" />
              <button
                type="button"
                onClick={() => setEditing((ed) => ({ ...ed, draft: { ...ed.draft, swatchUrl: "" } }))}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X size={12} /> {t("app.selections.swatchRemove", "Remove photo")}
              </button>
            </span>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              {uploading ? t("app.selections.swatchUploading", "Uploading…") : t("app.selections.swatchAdd", "Add a swatch photo")}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickSwatch} disabled={uploading} />
            </label>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg text-foreground hover:bg-muted"
            >
              {t("app.selections.cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || uploading}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {busy ? t("app.selections.saving", "Saving…") : t("app.selections.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="job-selections" className="bg-card border border-border rounded-xl p-5" data-job-selections>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Palette size={15} className="text-muted-foreground" />
          {t("app.selections.title", "Colours & materials")}
        </h2>
        {canEdit && !editing && (
          <div className="flex flex-wrap gap-2">
            {data?.hasQuote && (
              <button
                type="button"
                onClick={pull}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Download size={12} /> {t("app.selections.pull", "Pull from quote")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing({ id: "new", draft: draftFrom(null, defaultTemplate) })}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Plus size={12} /> {t("app.selections.add", "Add")}
            </button>
          </div>
        )}
      </div>

      {notice && <p className="mt-2 text-xs text-muted-foreground" role="status">{notice}</p>}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}

      {rows.length === 0 && !editing && (
        <p className="mt-2 text-sm text-muted-foreground">
          {canEdit
            ? data?.hasQuote
              ? t("app.selections.emptyEditQuote", "No colours recorded yet. Add one, or pull them from the quote.")
              : t("app.selections.emptyEdit", "No colours recorded yet.")
            : t("app.selections.emptyRead", "No colours recorded for this job.")}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {rows.map((row, i) => {
          if (editing?.id === row.id) return <li key={row.id}>{editor(row.id)}</li>;
          const { line, notes } = formatSelectionLine(row, { coatsText });
          return (
            <li key={row.id} className="flex items-start gap-3" data-selection-row={row.id}>
              {row.swatchUrl ? (
                <a href={row.swatchUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.swatchUrl} alt={t("app.selections.swatch", "Swatch photo")} className="h-9 w-9 rounded object-cover border border-border" />
                </a>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground break-words">{line}</div>
                {notes && <div className="text-xs text-muted-foreground whitespace-pre-line break-words">{notes}</div>}
              </div>
              {canEdit && !editing && (
                confirmRemove === row.id ? (
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{t("app.selections.removeConfirm", "Remove this row?")}</span>
                    <button type="button" onClick={() => remove(row.id)} disabled={busy} className="font-medium text-destructive hover:underline">
                      {t("app.selections.removeYes", "Remove")}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="text-muted-foreground hover:underline">
                      {t("app.selections.cancel", "Cancel")}
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={t("app.selections.moveUp", "Move up")}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={busy || i === rows.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={t("app.selections.moveDown", "Move down")}>
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" onClick={() => setEditing({ id: row.id, draft: draftFrom(row, defaultTemplate) })} className="p-1 text-muted-foreground hover:text-foreground" aria-label={t("app.selections.edit", "Edit")}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(row.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={t("app.selections.removeYes", "Remove")}>
                      <Trash2 size={14} />
                    </button>
                  </span>
                )
              )}
            </li>
          );
        })}
        {editing?.id === "new" && <li>{editor("new")}</li>}
      </ul>
    </div>
  );
}
