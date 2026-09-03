"use client";

// app/components/jobs/JobDocuments.js
//
// The plans, permits, contracts and warranties for one job.
//
// docs/construction/AUDIT-existing.md §2 graded document management ABSENT and
// named the confusion this panel has to survive: `lib/documents/` is document
// RENDERING (it builds PDFs). The store is `lib/jobs/documents.js` and this.
//
// ══ Upload goes through the existing route, twice on purpose ═══════════════
//
// The file goes to /api/upload (signed, authenticated, size- and type-capped),
// which answers with a Cloudinary URL; that URL is then POSTed here to become a
// row. Two round trips rather than one, because AGENTS.md is explicit that a
// second upload path is not to be added, and because the server refuses a URL
// that did not come from its own cloud.
//
// ══ Revise, never replace ══════════════════════════════════════════════════
//
// The only way to change a document is to upload the new version AS a revision
// of the old one. The old row keeps its url and its date forever. There is no
// delete button and no way to edit a url, because "which plan were we working
// from in March" is the entire reason the column exists — and a Replace button
// that quietly destroyed the answer would be a destructive operation labelled
// as cosmetic.
//
// ══ Mobile-first, and honestly unverified ══════════════════════════════════
//
// One column, 44px touch targets, and a file input that opens the phone's own
// picker. `npm run check:mobile` does NOT walk this screen (it covers
// /platform, /sales and /app/clock only), so these rules are followed rather
// than enforced.

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, History, Upload } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { CLIENT_MEDIA_ACCEPT } from "@/lib/media/validate";
import {
  DOCUMENT_KINDS,
  MONEY_KINDS,
  formatBytes,
  revisionCount,
} from "@/lib/jobs/documents";

export default function JobDocuments({ jobId }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  // Set when the upload is a REVISION of an existing document rather than a
  // new one. Holds { id, name, kind } so the form can say what it is revising.
  const [revising, setRevising] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/documents`);
    if (!res.ok) {
      // An empty panel over a failed request is the empty-vs-error trap; the
      // toast says which one happened and `failed` stops the panel claiming
      // there are no documents.
      await reportResponseError(
        res,
        t("app.jobDocuments.loadError", "Couldn't load this job's documents."),
      );
      setData({ chains: [], hiddenCount: 0, canUpload: false, failed: true });
      return;
    }
    setData(await res.json());
  }, [jobId, t]);

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
      // 1 — the existing uploader. Nothing about the file reaches this
      // component's own route.
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/upload", { method: "POST", body: upload });
      if (!uploaded.ok) {
        await reportResponseError(
          uploaded,
          t("app.jobDocuments.uploadError", "Couldn't upload that file."),
        );
        return;
      }
      const { url, filename } = await uploaded.json();

      // 2 — file it. `sizeBytes` is the browser's own File.size, which is the
      // only byte count available here; the server refuses anything it cannot
      // use and stores null rather than 0.
      const res = await fetch(`/api/jobs/${jobId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim() || filename || file.name,
          kind: revising ? revising.kind : form.get("kind"),
          url,
          sizeBytes: file.size,
          mimeType: file.type || null,
          supersedesId: revising?.id || null,
        }),
      });
      if (!res.ok) {
        await reportResponseError(
          res,
          t("app.jobDocuments.fileError", "Couldn't file that document."),
        );
        return;
      }

      setOpen(false);
      setRevising(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const chains = data.chains || [];
  // Contracts and invoices are the price, and the kind picker must not offer a
  // type whose POST would answer 403 — see MONEY_KINDS in lib/jobs/documents.js.
  const kinds = data.canSeeMoney
    ? DOCUMENT_KINDS
    : DOCUMENT_KINDS.filter((k) => !MONEY_KINDS.has(k));

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-1.5">
          <FileText size={16} />
          {t("app.jobDocuments.title", "Documents")}
        </h2>
        {/* Drawn only when the POST would succeed. The server decided this
            (canUpload), so the button and the gate cannot disagree. */}
        {data.canUpload && !open && (
          <button
            type="button"
            onClick={() => {
              setRevising(null);
              setOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground"
          >
            <Plus size={14} />
            {t("app.jobDocuments.add", "Add a document")}
          </button>
        )}
      </div>

      {chains.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {data.failed
            ? t("app.jobDocuments.unknown", "Couldn't load the documents on this job.")
            : t(
                "app.jobDocuments.empty",
                "No documents on this job yet — plans, permits, warranties.",
              )}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {chains.map((chain) => {
            const doc = chain.current;
            const revs = revisionCount(chain);
            const size = formatBytes(doc.sizeBytes);
            return (
              <li key={chain.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground underline break-words"
                    >
                      {doc.name}
                    </a>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(`app.jobDocuments.kind.${doc.kind}`, doc.kind)}
                      {" · "}
                      {new Date(doc.uploadedAt).toLocaleDateString(language)}
                      {/* Null sizeBytes prints NOTHING. "0 bytes" would read as
                          a failed upload and send somebody to upload it again —
                          see the column's own comment in schema.prisma. */}
                      {size ? ` · ${size}` : ""}
                      {revs > 1 &&
                        ` · ${t("app.jobDocuments.revision", "Rev {n}", { n: revs })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {revs > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [chain.id]: !e[chain.id] }))
                        }
                        className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-foreground"
                      >
                        <History size={13} />
                        {t("app.jobDocuments.history", "History")}
                      </button>
                    )}
                    {data.canUpload && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevising({ id: doc.id, name: doc.name, kind: doc.kind });
                          setOpen(true);
                        }}
                        className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-foreground"
                      >
                        <Upload size={13} />
                        {t("app.jobDocuments.revise", "New version")}
                      </button>
                    )}
                  </div>
                </div>

                {expanded[chain.id] && chain.history.length > 0 && (
                  <ul className="mt-2 border-l border-border pl-3 space-y-1">
                    {chain.history.map((old) => {
                      const oldSize = formatBytes(old.sizeBytes);
                      return (
                        <li key={old.id} className="text-xs">
                          <a
                            href={old.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground underline break-words"
                          >
                            {old.name}
                          </a>
                          <span className="text-muted-foreground">
                            {" · "}
                            {new Date(old.uploadedAt).toLocaleDateString(language)}
                            {oldSize ? ` · ${oldSize}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* "There is nothing here" and "there is something here you may not see"
          are different statements. Saying the first when the second is true
          sends a crew member chasing a contract that was filed weeks ago. */}
      {data.hiddenCount > 0 && (
        <p className="mt-3 text-xs italic text-muted-foreground">
          {t(
            "app.jobDocuments.hidden",
            "{count} more hidden by your access level",
            { count: data.hiddenCount },
          )}
        </p>
      )}

      {open && data.canUpload && (
        <form onSubmit={submit} className="mt-4 border-t border-border pt-4 space-y-3">
          {revising && (
            <p className="text-xs text-muted-foreground">
              {t(
                "app.jobDocuments.revisingNote",
                'New version of "{name}". The old one stays on the job — nothing is replaced.',
                { name: revising.name },
              )}
            </p>
          )}

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
            placeholder={t("app.jobDocuments.namePlaceholder", "What is it? (optional)")}
            className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground"
          />

          {!revising && (
            <select
              name="kind"
              defaultValue="plan"
              aria-label={t("app.jobDocuments.kindLabel", "Document type")}
              className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-base text-foreground"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`app.jobDocuments.kind.${k}`, k)}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy
                ? t("app.jobDocuments.uploading", "Uploading…")
                : t("app.jobDocuments.upload", "Upload")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRevising(null);
              }}
              className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground"
            >
              {t("app.jobDocuments.cancel", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
