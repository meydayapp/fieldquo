"use client";

// app/components/planRead/QuoteFilesCard.js
//
// The Files card — on a quote page, and on a drawing read before its quote
// exists. Drawing sets, scope spreadsheets, permits, site photos: uploaded
// through the shared uploader (uploadFile, purpose "plans" — signed, straight
// to Cloudinary, verified; never a new fetch to /api/upload), then filed as a
// QuoteDocument, which moves to the job's Documents when the quote is
// approved (lib/jobs/documentAutofile.js fileQuoteDocumentsOnJob).
//
// The job store's rule holds here: a revision SUPERSEDES — "Upload revision"
// files a new row pointing at the old one; nothing is replaced or deleted.
//
// On a drawing read, a PDF's sheets are also rendered to images in this
// browser (./pdfPages.js) before the file is filed, and the server reads the
// PDF's own text the moment it arrives (free — no model).

import { useRef, useState } from "react";
import { FileText, FileSpreadsheet, Image as ImageIcon, Upload, History, ShieldCheck } from "lucide-react";
import { uploadFile } from "@/lib/media/uploadClient";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { revisionCount } from "@/lib/jobs/documents";
import { renderAndUploadPages } from "./pdfPages";
import OpenFileLink from "@/app/components/files/OpenFileLink";

/** The kinds a person may file on a quote. The system-filed ones (quote,
 *  contract, invoice) are FieldQuo's to file — see lib/quotes/quoteDocuments.js. */
export const QUOTE_FILE_KINDS = ["plan", "permit", "photo", "warranty", "other"];

export const PLAN_FILE_ACCEPT =
  "application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv,image/*";

/** The kind a file starts as: drawings are plans, photos are photos, a
 *  spreadsheet is "other" with its own name. The person can change it. */
export function defaultKindFor(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "application/pdf") return "plan";
  if (type.startsWith("image/")) return "photo";
  return "other";
}

function iconFor(mime) {
  const m = String(mime || "");
  if (m.startsWith("image/")) return ImageIcon;
  if (m.includes("spreadsheet") || m === "text/csv") return FileSpreadsheet;
  return FileText;
}

function csvAware(file) {
  // Some systems hand a .csv over as "application/vnd.ms-excel" or with no
  // type at all; the extension is what the person chose.
  if (/\.csv$/i.test(file.name) && file.type !== "text/csv") return new File([file], file.name, { type: "text/csv" });
  return file;
}

/**
 * @param {{ endpoint: string, chains: object[], canUpload: boolean,
 *           renderPdfPages?: boolean, onChanged: () => void, locked?: boolean,
 *           title?: string, note?: string }} props
 */
export default function QuoteFilesCard({ endpoint, chains = [], canUpload = true, renderPdfPages = false, onChanged, locked = false, note }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [revising, setRevising] = useState(null);
  // The type the NEXT pick is filed as, for files that cannot tell by their
  // format (a permit is a PDF, like a drawing). "" = by file type.
  const [nextKind, setNextKind] = useState("");
  const [expanded, setExpanded] = useState({});

  async function fileOne(raw, supersedes) {
    const file = csvAware(raw);
    setBusy(t("app.planRead.files.uploading", "Uploading {name}…", { name: file.name }));
    const uploaded = await uploadFile(file, { purpose: "plans" });
    let pages = null;
    if (renderPdfPages && file.type === "application/pdf") {
      const out = await renderAndUploadPages(file, {
        onProgress: (done, total) => setBusy(t("app.planRead.files.rendering", "Preparing sheet {done} of {total}…", { done, total })),
      });
      pages = out.pages;
    }
    setBusy(t("app.planRead.files.reading", "Reading {name}…", { name: file.name }));
    const kind = supersedes ? supersedes.kind : nextKind || defaultKindFor(file);
    return fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonBody({
        name: file.name,
        kind,
        url: uploaded.url,
        publicId: uploaded.publicId,
        sizeBytes: file.size,
        mimeType: file.type || null,
        supersedesId: supersedes?.id || null,
        pages,
      }),
    });
  }

  async function onPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    try {
      for (const f of files) {
        const res = await fileOne(f, revising);
        if (res?.ingest && res.ingest.ok === false) {
          showError(t("app.planRead.files.unreadable", "{name} was saved, but FieldQuo couldn't read it. Check it opens, or upload it as a PDF, .xlsx or .csv.", { name: f.name }));
        }
        if (revising) break;
      }
    } catch (err) {
      showError(err?.message || t("app.planRead.files.uploadError", "Couldn't upload that file."));
    } finally {
      setBusy("");
      setRevising(null);
      onChanged?.();
    }
  }

  const statusLine = (doc) => {
    const s = doc.status;
    if (!s) return null;
    if (s.unreadable) return t("app.planRead.files.status.unreadable", "Couldn't be read");
    if (s.type === "drawing") {
      if (!s.sheets) return t("app.planRead.files.status.noSheets", "No sheets found");
      return s.sheetsRead === s.sheets
        ? t("app.planRead.files.status.sheetsRead", "{n} sheets · read", { n: s.sheets })
        : t("app.planRead.files.status.sheets", "{n} sheets · {read} read", { n: s.sheets, read: s.sheetsRead });
    }
    if (s.type === "spreadsheet") return t("app.planRead.files.status.rows", "{n} rows", { n: s.rows });
    if (s.type === "photo") return s.read ? t("app.planRead.files.status.photoRead", "Read") : t("app.planRead.files.status.photoWaiting", "Not read yet");
    return null;
  };

  return (
    <section className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold">{t("app.planRead.files.title", "Files")}</h2>
        {canUpload && !locked && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setRevising(null);
              input.current?.click();
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            <Upload className="w-4 h-4" aria-hidden />
            {t("app.planRead.files.upload", "Upload")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {note || t("app.planRead.files.note", "Drawings (PDF), scope sheets (.xlsx or .csv), permits and site photos. All files move to the job's Documents when the quote is approved.")}
      </p>
      <input ref={input} type="file" multiple={!revising} accept={PLAN_FILE_ACCEPT} className="hidden" onChange={onPick} />
      {busy && <p className="text-sm text-muted-foreground mb-3" role="status">{busy}</p>}
      {locked && <p className="text-xs text-muted-foreground mb-3">{t("app.planRead.files.locked", "Files can be added when the read finishes.")}</p>}

      {!chains.length ? (
        <p className="text-sm text-muted-foreground">{t("app.planRead.files.empty", "No files yet.")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {chains.map((c) => {
            const doc = c.current;
            const Icon = iconFor(doc.mimeType);
            const revs = revisionCount(c);
            const line = statusLine(doc);
            return (
              <li key={c.id} className="border border-border rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <OpenFileLink href={doc.openUrl} className="text-sm font-medium break-words hover:underline">
                      {doc.name}
                    </OpenFileLink>
                    <p className="text-xs text-muted-foreground">
                      {t(`app.planRead.files.kind.${doc.kind}`, doc.kind)}
                      {doc.size ? ` · ${doc.size}` : ""}
                      {revs > 1 ? ` · ${t("app.jobDocuments.revision", "Rev {n}", { n: revs })}` : ""}
                      {line ? ` · ${line}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {canUpload && !locked && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        setRevising({ id: doc.id, kind: doc.kind });
                        setTimeout(() => input.current?.click(), 0);
                      }}
                      className="text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent"
                    >
                      {t("app.planRead.files.revise", "Upload revision")}
                    </button>
                  )}
                  {revs > 1 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((x) => ({ ...x, [c.id]: !x[c.id] }))}
                      className="inline-flex items-center gap-1 text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent"
                    >
                      <History className="w-3.5 h-3.5" aria-hidden />
                      {t("app.planRead.files.history", "Earlier versions")}
                    </button>
                  )}
                </div>
                {expanded[c.id] && (
                  <ul className="mt-2 space-y-1">
                    {c.history.map((h) => (
                      <li key={h.id} className="text-xs">
                        <OpenFileLink href={h.openUrl} className="hover:underline">
                          {h.name}
                        </OpenFileLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canUpload && !locked && <KindPicker t={t} value={nextKind} onChange={setNextKind} />}
    </section>
  );
}

/** "File the next upload as…" — a permit is a PDF like a drawing, so the
 *  person says which. Applies to every file in the next pick. */
function KindPicker({ t, value, onChange }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
      <label htmlFor="planfile-kind">{t("app.planRead.files.kindNext", "File the next upload as")}</label>
      <select
        id="planfile-kind"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[36px] rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="">{t("app.planRead.files.kindAuto", "Automatic (by file type)")}</option>
        {QUOTE_FILE_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`app.planRead.files.kind.${k}`, k)}
          </option>
        ))}
      </select>
    </div>
  );
}
