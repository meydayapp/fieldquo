"use client";

// app/components/subcontractors/SubcontractorDocuments.js
//
// A sub's paperwork: the COI, the WSIB/WCB clearance, the signed agreement.
//
// Same two-step upload as app/components/jobs/JobDocuments.js — the file goes
// to /api/upload, the URL goes to this feature's own route — and the same
// rule that nothing is replaced: a renewed certificate is a new row above the
// old one. The one thing this panel adds is the expiry date: for a COI or a
// clearance it is what the server copies onto the sub, so the badge on the
// roster agrees with the paper.

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { CLIENT_MEDIA_ACCEPT } from "@/lib/media/validate";
import { formatBytes } from "@/lib/jobs/documents";
import { DOCUMENT_KINDS } from "@/lib/subcontractors/payload";

export default function SubcontractorDocuments({ subcontractorId, onExpiryChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("coi");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/subcontractors/${subcontractorId}/documents`);
    if (!res.ok) {
      await reportResponseError(res, t("app.subcontractors.docsLoadError", "Couldn't load this subcontractor's documents."));
      setData({ documents: [], canUpload: false, failed: true });
      return;
    }
    setData(await res.json());
  }, [subcontractorId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!file || !file.size) return;

    setBusy(true);
    try {
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/upload", { method: "POST", body: upload });
      if (!uploaded.ok) {
        await reportResponseError(uploaded, t("app.subcontractors.uploadError", "Couldn't upload that file."));
        return;
      }
      const { url, filename } = await uploaded.json();

      const res = await fetch(`/api/subcontractors/${subcontractorId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim() || filename || file.name,
          kind,
          url,
          sizeBytes: file.size,
          mimeType: file.type || null,
          expiresAt: String(form.get("expiresAt") || "") || null,
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.subcontractors.fileError", "Couldn't file that document."));
        return;
      }
      const body = await res.json();
      setOpen(false);
      await load();
      if (body.updatedExpiry) onExpiryChanged?.(body.updatedExpiry);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const documents = data.documents || [];
  const kindLabel = (k) =>
    ({
      coi: t("app.subcontractors.kind.coi", "Certificate of insurance"),
      clearance: t("app.subcontractors.kind.clearance", "WSIB / WCB clearance"),
      agreement: t("app.subcontractors.kind.agreement", "Agreement"),
      other: t("app.subcontractors.kind.other", "Other"),
    })[k] || k;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FileText size={16} /> {t("app.subcontractors.documents", "Documents")}
        </h2>
        {data.canUpload && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px]"
          >
            <Plus size={14} /> {t("app.subcontractors.upload", "Upload")}
          </button>
        )}
      </div>

      {data.failed ? null : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("app.subcontractors.noDocuments", "No documents filed yet. The COI and the clearance certificate belong here.")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="py-2.5 flex items-start justify-between gap-3">
              <span className="min-w-0">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-foreground underline truncate">
                  {doc.name}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {kindLabel(doc.kind)}
                  {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                  {" · "}
                  {t("app.subcontractors.filedOn", "Filed {date}", { date: formatDate(doc.uploadedAt) })}
                </span>
              </span>
              {doc.expiresAt && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("app.subcontractors.expiresOn", "Expires {date}", { date: formatDate(doc.expiresAt) })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border pt-4">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label={t("app.subcontractors.kindLabel", "Document type")}
            className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground"
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>

          <input
            type="file"
            name="file"
            required
            accept={CLIENT_MEDIA_ACCEPT}
            className="block w-full text-sm text-foreground file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:text-sm file:font-semibold"
          />

          <input
            type="text"
            name="name"
            placeholder={t("app.subcontractors.docNamePlaceholder", "What is it? (optional)")}
            className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground"
          />

          <label className="block text-xs text-muted-foreground">
            {kind === "coi"
              ? t("app.subcontractors.docExpiresCoi", "Expiry date on the certificate — this sets the subcontractor's insurance date")
              : kind === "clearance"
                ? t("app.subcontractors.docExpiresClearance", "Expiry date on the certificate — this sets the subcontractor's clearance date")
                : t("app.subcontractors.docExpires", "Expiry date (optional)")}
            <input
              type="date"
              name="expiresAt"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy ? t("app.subcontractors.uploading", "Uploading…") : t("app.subcontractors.upload", "Upload")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground"
            >
              {t("app.subcontractors.cancel", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
