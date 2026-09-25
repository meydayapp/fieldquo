// app/components/receipts/ReceiptCapture.js
//
// Snap or drop receipts — photos or PDFs, several at once — and read them.
//
// ══ Capture first, read second ═════════════════════════════════════════════
//
// Each receipt is SAVED (POST /api/receipts) before it is read
// (POST /api/receipts/[id]/read), so the photo — which is the bookkeeping
// record — exists even when the read fails or the phone loses signal halfway.
// A receipt that was saved and not read shows in the list as "Reading…" with
// "Read again", never as a photo that silently vanished.
//
// ══ One file, one receipt — unless the person says otherwise ═══════════════
//
// The default is the common case: every file is its own receipt (a stack of
// till slips photographed one by one, a folder of PDFs). A long receipt shot
// in two or three pieces is the exception, and a checkbox says so — the
// reader cannot tell "two receipts" from "two halves of one" by itself, and
// guessing would merge two purchases into one total.
"use client";

import { useState } from "react";
import { ScanLine, Check, AlertTriangle, Loader2 } from "lucide-react";
import MediaUploader from "@/app/components/MediaUploader";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { MAX_RECEIPT_FILES } from "@/lib/receipts/media";
import { refusalText } from "./labels";

/** Reads run two at a time — fast on a stack of slips, gentle on a phone. */
const PARALLEL = 2;

export default function ReceiptCapture({ source = "expenses", contextJobId = null, onRead, onClose }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [oneReceipt, setOneReceipt] = useState(false);
  const [progress, setProgress] = useState([]);
  const [busy, setBusy] = useState(false);

  const photos = files.filter((f) => f.kind !== "document");
  const pdfs = files.filter((f) => f.kind === "document");
  const canCombine = photos.length >= 2 && pdfs.length === 0 && photos.length <= MAX_RECEIPT_FILES;

  const groups = canCombine && oneReceipt ? [files] : files.map((f) => [f]);

  async function readAll() {
    if (!groups.length || busy) return;
    setBusy(true);
    const rows = groups.map((g, i) => ({ i, name: g[0]?.filename || t("app.receipts.capture.item", { n: i + 1 }), state: "saving", error: "" }));
    setProgress(rows);
    const update = (i, patch) => setProgress((prev) => prev.map((r) => (r.i === i ? { ...r, ...patch } : r)));

    let next = 0;
    async function worker() {
      while (next < groups.length) {
        const i = next++;
        try {
          const created = await fetchJson("/api/receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: groups[i], source, contextJobId }),
          });
          update(i, { state: "reading", id: created.receipt.id });
          onRead?.();
          try {
            await fetchJson(`/api/receipts/${created.receipt.id}/read`, { method: "POST" });
            update(i, { state: "done" });
          } catch (err) {
            // Saved, not read. The list shows it with "Read again".
            update(i, { state: "unread", error: refusalText(t, err) });
          }
        } catch (err) {
          update(i, { state: "failed", error: refusalText(t, err) });
        }
        onRead?.();
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, groups.length) }, worker));
    setBusy(false);
    setFiles([]);
    setOneReceipt(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ScanLine size={16} className="text-muted-foreground" />
          {t("app.receipts.capture.title")}
        </h2>
        {onClose && !busy && (
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            {t("app.action.cancel")}
          </button>
        )}
      </div>

      <MediaUploader
        uploadUrl="/api/upload" purpose="receipts"
        value={files}
        onChange={(next) => setFiles(next.filter((f) => f.kind !== "video"))}
        max={12}
        label={t("app.receipts.capture.add")}
        hint={t("app.receipts.capture.hint")}
      />

      {canCombine && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={oneReceipt}
            onChange={(e) => setOneReceipt(e.target.checked)}
          />
          <span>{t("app.receipts.capture.oneReceipt", { n: photos.length })}</span>
        </label>
      )}
      {photos.length > MAX_RECEIPT_FILES && pdfs.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("app.receipts.capture.tooManyToCombine", { n: MAX_RECEIPT_FILES })}</p>
      )}

      {files.length > 0 && (
        <button
          type="button"
          onClick={readAll}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
          {t("app.receipts.capture.read", { n: groups.length })}
        </button>
      )}

      {progress.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {progress.map((p) => (
            <li key={p.i} className="flex items-start gap-2 px-3 py-2 text-sm">
              {p.state === "done" ? (
                <Check size={14} className="mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
              ) : p.state === "failed" || p.state === "unread" ? (
                <AlertTriangle size={14} className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <Loader2 size={14} className="mt-0.5 animate-spin text-muted-foreground shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-foreground break-all">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`app.receipts.capture.state.${p.state}`)}
                  {p.error ? ` — ${p.error}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
