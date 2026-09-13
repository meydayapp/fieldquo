"use client";

// app/components/hr/WorkerDocumentsPanel.js
//
// One person's paperwork, from either side.
//
//   mode="manager"  — /app/settings/team/people/[id]: every row, upload any
//                     kind, mark verified, archive (never delete).
//   mode="self"     — /app/me/documents: my rows, upload my own kinds
//                     (certification, licence, ID, other); no verify, no
//                     archive, and the manager's private note is not here.
//
// Same two-step upload as every document panel in the product: the file to
// /api/upload, the URL to this feature's route. The expiry badge is the
// shared ExpiryBadge, on the shared window: a document with no date reads
// "no expiry recorded", never "expired".

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, ShieldCheck, Archive } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import { CLIENT_MEDIA_ACCEPT } from "@/lib/media/validate";
import { formatBytes } from "@/lib/jobs/documents";
import { WORKER_DOCUMENT_KINDS, WORKER_SELF_KINDS } from "@/lib/hr/documents";
import { documentExpiry } from "@/lib/hr/documentExpiry";

export function documentKindLabel(t, kind) {
  return t(`app.hr.docs.kind.${kind}`, kind);
}

export default function WorkerDocumentsPanel({ mode = "manager", workerId = null, onChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const base = mode === "self" ? "/api/hr/me/documents" : `/api/hr/workers/${workerId}/documents`;
  const kinds = mode === "self" ? WORKER_SELF_KINDS : WORKER_DOCUMENT_KINDS;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(kinds[0]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [rowBusy, setRowBusy] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(base);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!file || !file.size) {
      setFormError(t("app.hr.docs.pickFile"));
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/upload", { method: "POST", body: upload });
      if (!uploaded.ok) {
        await reportResponseError(uploaded, t("app.hr.docs.uploadError"));
        return;
      }
      const { url, filename } = await uploaded.json();
      await fetchJson(base, {
        method: "POST",
        body: {
          kind,
          title: String(form.get("title") || "").trim() || filename || file.name,
          fileUrl: url,
          sizeBytes: file.size,
          mimeType: file.type || null,
          issuedAt: String(form.get("issuedAt") || "") || null,
          expiresAt: String(form.get("expiresAt") || "") || null,
          number: String(form.get("number") || "") || null,
          note: mode === "manager" ? String(form.get("note") || "") || null : undefined,
        },
      });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(doc, body) {
    setRowBusy(doc.id);
    try {
      await fetchJson(`/api/hr/documents/${doc.id}`, { method: "PATCH", body });
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(errorText(t, err));
    } finally {
      setRowBusy(null);
      setConfirmArchive(null);
    }
  }

  const documents = data?.documents || [];

  return (
    <section className="bg-card border border-border rounded-xl p-5" data-hr-documents>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FileText size={16} /> {t("app.hr.docs.title")}
        </h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px]"
            data-hr-upload
          >
            <Plus size={14} /> {t("app.hr.docs.upload")}
          </button>
        )}
      </div>

      {mode === "self" && (
        <p className="text-xs text-muted-foreground mb-3">{t("app.hr.docs.selfHint")}</p>
      )}

      {open && (
        <form onSubmit={submit} className="border border-border rounded-lg p-4 mb-4 grid gap-3 sm:grid-cols-2" data-hr-upload-form>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.file")}</span>
            <input type="file" name="file" accept={CLIENT_MEDIA_ACCEPT} className="block w-full text-sm" required />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.kindLabel")}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]">
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {documentKindLabel(t, k)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.titleLabel")}</span>
            <input name="title" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" placeholder={t("app.hr.docs.titlePlaceholder")} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.number")}</span>
            <input name="number" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.issuedAt")}</span>
            <input type="date" name="issuedAt" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.expiresAt")}</span>
            <input type="date" name="expiresAt" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" />
          </label>
          {mode === "manager" && (
            <label className="text-sm sm:col-span-2">
              <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.docs.note")}</span>
              <input name="note" className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" placeholder={t("app.hr.docs.notePlaceholder")} />
            </label>
          )}
          {formError && <p className="text-sm text-red-700 dark:text-red-300 sm:col-span-2">{formError}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
              {busy ? t("app.hr.docs.uploading") : t("app.hr.docs.file_action")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-full px-4 py-2 text-sm min-h-[44px]">
              {t("app.action.cancel")}
            </button>
          </div>
        </form>
      )}

      {!open && formError && <p className="text-sm text-red-700 dark:text-red-300 mb-2">{formError}</p>}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={data !== null && documents.length === 0}
        onRetry={load}
        empty={<p className="text-sm text-muted-foreground">{mode === "self" ? t("app.hr.docs.emptySelf") : t("app.hr.docs.emptyManager")}</p>}
      >
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const expiry = doc.expiry || documentExpiry(doc);
            return (
              <li key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2" data-hr-document>
                <div className="min-w-0">
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-foreground underline truncate">
                    {doc.title}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {documentKindLabel(t, doc.kind)}
                    {doc.number ? ` · ${t("app.hr.docs.numberShort", { number: doc.number })}` : ""}
                    {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                    {" · "}
                    {t("app.hr.docs.filedOn", { date: formatDate(doc.createdAt) })}
                    {/* "uploaded by them" is the manager's sentence; on the
                        person's own screen the row is theirs by default. */}
                    {mode === "manager" && doc.uploadedByKind === "worker" ? ` · ${t("app.hr.docs.byWorker")}` : ""}
                  </span>
                  {mode === "manager" && doc.note ? <span className="block text-xs text-muted-foreground mt-1">{doc.note}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {doc.expiresAt ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ExpiryBadge state={expiry.state} />
                      {formatDate(doc.expiresAt)}
                    </span>
                  ) : (
                    <ExpiryBadge state="unknown" />
                  )}
                  {doc.verifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                      <ShieldCheck size={12} /> {t("app.hr.docs.verified")}
                    </span>
                  ) : doc.uploadedByKind === "worker" ? (
                    <span className="text-xs rounded-full border border-border bg-muted text-muted-foreground px-2 py-0.5">{t("app.hr.docs.unverified")}</span>
                  ) : null}
                  {mode === "manager" && (
                    <>
                      <button
                        type="button"
                        disabled={rowBusy === doc.id}
                        onClick={() => patch(doc, { verified: !doc.verifiedAt })}
                        className="text-xs border border-border rounded-full px-3 py-1.5 min-h-[36px]"
                      >
                        {doc.verifiedAt ? t("app.hr.docs.unverify") : t("app.hr.docs.verify")}
                      </button>
                      {confirmArchive === doc.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button type="button" disabled={rowBusy === doc.id} onClick={() => patch(doc, { archived: true })} className="text-xs rounded-full px-3 py-1.5 min-h-[36px] bg-red-700 text-white">
                            {t("app.hr.docs.archiveConfirm")}
                          </button>
                          <button type="button" onClick={() => setConfirmArchive(null)} className="text-xs border border-border rounded-full px-3 py-1.5 min-h-[36px]">
                            {t("app.action.cancel")}
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmArchive(doc.id)} className="text-xs border border-border rounded-full px-3 py-1.5 min-h-[36px] inline-flex items-center gap-1">
                          <Archive size={12} /> {t("app.hr.docs.archive")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </ListState>
    </section>
  );
}
