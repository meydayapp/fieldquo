"use client";

// app/components/MediaUploader.js
//
// Attach photos and videos to a quote — the same control on a public self-quote
// (a homeowner in a driveway) and, later, staff surfaces. It POSTs each file to
// the given endpoint, shows a thumbnail as soon as it's up, and hands the parent
// a normalised list of { url, kind, publicId } to submit with the request.
//
// Deliberately dumb about WHERE it uploads: the caller passes uploadUrl, so the
// public route (company-scoped, anonymous) and the authenticated /api/upload
// both drive the identical UI. One control, no divergence.

import { useRef, useState, useCallback } from "react";
import { ImagePlus, X, Film, Loader2 } from "lucide-react";
import { CLIENT_MEDIA_ACCEPT } from "@/lib/media/validate";

export default function MediaUploader({
  uploadUrl,
  value = [],
  onChange,
  max = 12,
  label = "Add photos or a video",
  hint = "A picture or short clip helps us quote accurately.",
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
            setError(`You can attach up to ${max} files.`);
            break;
          }
          const fd = new FormData();
          fd.append("file", file);
          let res;
          try {
            res = await fetch(uploadUrl, { method: "POST", body: fd });
          } catch {
            setError("Upload failed — check your connection and try again.");
            break;
          }
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.url) {
            // Surface the server's specific reason (too large, wrong type) —
            // a silent failure here is the "why won't my photo upload" black hole.
            setError(data?.error || "That file couldn't be uploaded.");
            continue;
          }
          added.push({ url: data.url, kind: data.kind === "video" ? "video" : "photo", publicId: data.publicId || null });
        }
        if (added.length) onChange?.([...value, ...added]);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
      }
    },
    [uploadUrl, value, onChange, max],
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
              {m.kind === "video" ? (
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
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || value.length >= max}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        {busy ? "Uploading…" : label}
      </button>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

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
