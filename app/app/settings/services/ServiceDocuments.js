// app/app/settings/services/ServiceDocuments.js
//
// The technical documents attached to the preparation guide — at company
// level (every guide) or for one service. Upload through the signed
// uploader, then a row on ServiceDocument; each row saves on its own, not
// with the page's Save, because a file that has already been uploaded is
// already a fact and a half-saved list would leave orphans nobody can see.
"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { uploadFile } from "@/lib/media/uploadClient";
import { showError } from "@/lib/clientErrors";
import { LANGUAGES } from "@/app/i18n/languages";
import { formatBytes } from "@/lib/jobs/documents";

/**
 * @param categoryId  null for the company-level list
 * @param documents   every ServiceDocument of the company (the parent loads once)
 * @param onChange    (nextDocuments) after a create or delete
 * @param canEdit     owner/admin
 */
export default function ServiceDocuments({ categoryId = null, documents, onChange, canEdit }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { url, publicId, sizeBytes, filename }
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [deleting, setDeleting] = useState(null);

  const rows = (documents || []).filter((d) => (categoryId ? d.categoryId === categoryId : !d.categoryId));

  useEffect(() => {
    if (pending && !title) setTitle(pending.filename?.replace(/\.pdf$/i, "") || "");
  }, [pending, title]);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = await uploadFile(file, { purpose: "documents" });
      if (data.kind !== "document") {
        showError(t("app.prepGuide.docs.pdfOnly", "Technical documents must be PDFs."));
        return;
      }
      setPending({ url: data.url, publicId: data.publicId || null, sizeBytes: file.size, filename: data.filename || file.name });
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function attach() {
    if (!pending) return;
    setBusy(true);
    try {
      const row = await fetchJson("/api/settings/service-documents", {
        method: "POST",
        body: {
          title: title.trim(),
          url: pending.url,
          publicId: pending.publicId,
          sizeBytes: pending.sizeBytes,
          mimeType: "application/pdf",
          categoryId,
          language: language || null,
        },
      });
      onChange([...(documents || []), row]);
      setPending(null);
      setTitle("");
      setLanguage("");
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    setDeleting(row.id);
    try {
      await fetchJson(`/api/settings/service-documents/${row.id}`, { method: "DELETE" });
      onChange((documents || []).filter((d) => d.id !== row.id));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && !pending && (
        <p className="text-xs text-muted-foreground">
          {categoryId
            ? t("app.prepGuide.docs.emptyService", "No documents for this service yet. A spec sheet attached here rides only the guides for jobs that include this service.")
            : t("app.prepGuide.docs.emptyCompany", "No documents yet. A document attached here rides every preparation guide you send.")}
        </p>
      )}
      {rows.map((d) => (
        <div key={d.id} className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5 text-sm">
          <FileText size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
            {d.title}
          </a>
          <span className="shrink-0 text-xs text-muted-foreground">
            {[d.language ? d.language.toUpperCase() : null, formatBytes(d.sizeBytes)].filter(Boolean).join(" · ")}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => remove(d)}
              disabled={deleting === d.id}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-600 disabled:opacity-50"
              title={t("app.prepGuide.docs.remove", "Remove from the guide")}
              aria-label={t("app.prepGuide.docs.remove", "Remove from the guide")}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {canEdit && pending && (
        <div className="rounded border border-border bg-muted/40 p-2.5 space-y-2">
          <p className="text-xs text-muted-foreground truncate">{pending.filename}</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("app.prepGuide.docs.titlePlaceholder", "Title the client sees, e.g. Renner Italia technical data sheet")}
            className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
              aria-label={t("app.prepGuide.docs.language", "Language")}
            >
              <option value="">{t("app.prepGuide.docs.anyLanguage", "Every language")}</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={attach}
              disabled={busy || !title.trim()}
              className="rounded bg-inverted px-3 py-1 text-sm font-medium text-inverted-foreground disabled:opacity-50"
            >
              {t("app.prepGuide.docs.attach", "Attach to the guide")}
            </button>
            <button type="button" onClick={() => setPending(null)} className="text-sm text-muted-foreground hover:text-foreground">
              {t("app.action.cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {canEdit && !pending && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground hover:underline">
          <Upload size={14} />
          {busy ? t("app.prepGuide.docs.uploading", "Uploading…") : t("app.prepGuide.docs.add", "Add a PDF")}
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={pick} disabled={busy} />
        </label>
      )}
    </div>
  );
}
