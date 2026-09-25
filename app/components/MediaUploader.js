"use client";

// app/components/MediaUploader.js
//
// Attach photos, videos and PDF plans to a quote — the same control on a public
// self-quote (a homeowner in a driveway) and on staff surfaces. It uploads each
// file through lib/media/uploadClient.js (signed by the given endpoint, bytes
// straight to Cloudinary, verified), shows a thumbnail as soon as it's up, and hands
// the parent a normalised list of { url, kind, publicId, filename } to submit
// with the request.
//
// The PDF case is the one a cabinet company asked for: their clients arrive with
// an IKEA kitchen planner PDF, and every quote used to start with "can you email
// me that plan separately?".
//
// Deliberately dumb about WHERE it uploads: the caller passes uploadUrl, so the
// public route (company-scoped, anonymous) and the authenticated /api/upload
// both drive the identical UI. One control, no divergence.

import { useRef, useState, useCallback } from "react";
import { ImagePlus, X, Film, FileText, Loader2 } from "lucide-react";
import { CLIENT_MEDIA_ACCEPT, megabytes } from "@/lib/media/validate";
import { uploadFile } from "@/lib/media/uploadClient";
import UploadProgress from "@/app/components/UploadProgress";

export default function MediaUploader({
  // The scope's upload endpoint — "/api/upload", "/api/portal/<token>/upload"
  // or "/api/self-quote/<slug>/upload". The helper adds /sign and /verify.
  uploadUrl,
  // Staff only: which sub-folder of the company's own this lands in (see
  // MEMBER_PURPOSES in lib/media/directUpload.js). Ignored by the public
  // scopes, whose folder is fixed by the route.
  purpose,
  value = [],
  onChange,
  max = 12,
  label = "Add photos, a video or a PDF plan",
  // Names the PDF explicitly. A homeowner holding an IKEA plan will not try it
  // unless told they can — the whole point of accepting the format is lost if
  // the control only ever mentions pictures.
  hint = "A picture, short clip or your PDF plan helps us quote accurately.",
  // Only shown when a PDF arrives without a usable filename. A fallback, never
  // a substitute — the real name is what tells someone their right file went up.
  documentLabel = "PDF",
  // ── The rest of the strings, on the same footing as the three above ───────
  //
  // label/hint/documentLabel were already injected because the public
  // self-quote form runs in the CLIENT's language, not the company's. These
  // four were left hardcoded, so a homeowner filling in a French form got
  // "Uploading…" and, on a bad connection, an English sentence about their
  // connection — on the surface where an English sentence is most likely to be
  // the thing they see. The English defaults keep every /app caller identical.
  busyLabel = "Uploading…",
  limitLabel = (n) => `You can attach up to ${n} files.`,
  failedLabel = "Upload failed — check your connection and try again.",
  rejectedLabel = "That file couldn't be uploaded.",
  // A file over the size that can actually be stored. Until 2026-09-25 this
  // was Vercel's 4.5 MB request cap, which refused most phone photos; uploads
  // now go straight to Cloudinary, so the limit is the real one — ours, or the
  // Cloudinary plan's if lower — and usually arrives with the server's own
  // sentence. Both numbers are named because "too large" without them leaves
  // somebody guessing how much to shrink it by.
  tooLargeLabel = (size, limit) => `That file is ${size} — the most that can be sent in one upload is ${limit}. Take the photo at a smaller size, or resize it and try again.`,
  // Every other unexplained status. A 401 after a session expired looked
  // exactly like a corrupt file.
  signedOutLabel = "Your session has expired. Sign in again, then re-attach the file.",
  removeLabel = "Remove",
  // `async (file) => entry | null`. When given and the browser reports no
  // signal, the file is handed here instead of being uploaded — the offline
  // queue (lib/offline/queue.js) stores it and uploads it at replay. The
  // entry it returns is shown like any other (a local object URL); null
  // means "not this file" and the ordinary upload path runs (and fails
  // with failedLabel, as it always did).
  offlineCapture = null,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      setError("");
      setBusy(true);
      const added = [];
      try {
        for (const file of files) {
          if (value.length + added.length >= max) {
            setError(limitLabel(max));
            break;
          }
          if (offlineCapture && typeof navigator !== "undefined" && navigator.onLine === false) {
            const entry = await offlineCapture(file).catch(() => null);
            if (entry) {
              added.push(entry);
              continue;
            }
          }
          // Direct to Cloudinary through the one helper. The bytes no longer
          // pass through our server, so Vercel's 4.5 MB request cap — the
          // reason an ordinary phone photo was refused until 2026-09-25 — is
          // not in the way, and no pre-check against it is needed. The helper
          // signs, uploads and verifies (lib/media/uploadClient.js); `uploadUrl`
          // is the scope's endpoint, unchanged.
          let entry;
          try {
            entry = await uploadFile(file, { endpoint: uploadUrl, purpose });
          } catch (err) {
            if (err?.code === "network") {
              setError(failedLabel);
              break;
            }
            // A size refusal that carries its limit reads through
            // tooLargeLabel — same two numbers the server would give, but in
            // the language a public form was opened in. Otherwise the
            // server's own reason first — it inspected the file: the
            // classifyMedia verdict, an upload it could not confirm. The
            // labels are the fallbacks — and nothing sits between them and
            // the server's reason: err.message is uploadClient's English
            // sentence, and ahead of rejectedLabel it put English on the
            // public self-quote form a client opened in French.
            setError(
              err?.code === "too_large" && err?.maxBytes
                ? tooLargeLabel(megabytes(file.size), megabytes(err.maxBytes))
                : err?.serverMessage ||
                    (err?.code === "signed_out" ? signedOutLabel : rejectedLabel),
            );
            continue;
          }
          // The server's classification, as the verify step returned it —
          // it is the side that looked the file up. The entry the parent
          // stores keeps the shape it always had.
          added.push({
            url: entry.url,
            kind: entry.kind,
            publicId: entry.publicId,
            filename: entry.filename,
          });
        }
        if (added.length) onChange?.([...value, ...added]);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
      }
    },
    [uploadUrl, purpose, value, onChange, max, limitLabel, failedLabel, rejectedLabel, tooLargeLabel, signedOutLabel, offlineCapture],
  );

  function remove(idx) {
    const next = value.slice();
    next.splice(idx, 1);
    onChange?.(next);
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((m, i) => (
            <div key={m.url + i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {m.kind === "document" ? (
                // A file card, not a thumbnail. PDFs are stored as Cloudinary
                // `raw` so no page image exists to show, and an <img> pointed at
                // a PDF is a broken-image icon on the one screen where the person
                // needs to be sure their plan actually attached.
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-muted-foreground">
                  <FileText size={20} aria-hidden="true" />
                  <span className="line-clamp-2 break-all text-[10px] leading-tight text-foreground">
                    {m.filename || documentLabel}
                  </span>
                </div>
              ) : m.kind === "video" ? (
                // A poster frame would need a transform round-trip; a labelled
                // tile is honest and instant, and the reviewer opens it to watch.
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Film size={20} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                // h-8 w-8, not h-6 w-6: a 24px circle is the icon-only-button
                // tap-target problem in miniature, and this is what a
                // homeowner mis-taps trying to remove a photo of the wrong
                // room. Not grown to the full 44px floor — at grid-cols-3 on
                // a 375px phone the tile itself is only ~110px square, and a
                // 44px badge would eat 40% of it — but 32px is a real,
                // measurable improvement that still reads as a corner badge.
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                aria-label={removeLabel}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || value.length >= max}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2.5 min-h-11 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        {busy ? busyLabel : label}
      </button>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {/* The one progress bar. Draws only if no other instance is mounted
          (the /app shell has one), so the public forms and the portal get it
          from here and /app pages do not get two. */}
      <UploadProgress />

      <input
        ref={inputRef}
        type="file"
        accept={CLIENT_MEDIA_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
