// app/components/settings/PairPhotoFields.js
//
// The three pieces a before/after pair editor is made of: a photo slot that
// uploads through the shared /api/upload route, a text field that commits
// on blur, and the "new pair" draft that only becomes a pair once BOTH
// photos exist. Shared by Settings › Quote Email and the company gallery
// editor (app/components/settings/GalleryEditor.js) since the two write to
// the same gallery — a second copy of PhotoSlot is the one that rots.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/** One "before" or "after" slot. Uploads through the shared /api/upload route. */
export function PhotoSlot({ url, label, disabled, onUploaded, onError }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    // Cleared so choosing the SAME file twice still fires a change event —
    // otherwise a failed upload can't be retried without picking a different
    // photo, which reads as the button being broken.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJson("/api/upload", { method: "POST", body: form });
      onUploaded({ url: data.url, publicId: data.publicId || "" });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="w-full aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload size={13} />
            {t("app.setQuoteEmail.addPhoto")}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
    </div>
  );
}


// `format` is opt-in rather than sniffed from the placeholder: this Field also
// holds a person's NAME, and running a phone formatter over "O'Brien" would
// quietly delete it.
export function Field({ value, placeholder, disabled, onCommit, format }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      type={format ? "tel" : "text"}
      inputMode={format ? "tel" : undefined}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(format ? format(e.target.value) : e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? "")) onCommit(draft);
      }}
      className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground disabled:opacity-60"
    />
  );
}


export function NewPair({ disabled, onComplete, onError, t }) {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);

  useEffect(() => {
    if (!before || !after) return;
    onComplete({
      beforeUrl: before.url,
      beforePublicId: before.publicId,
      afterUrl: after.url,
      afterPublicId: after.publicId,
    });
    setBefore(null);
    setAfter(null);
  }, [before, after, onComplete]);

  return (
    <div className="border border-dashed border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-2">
        {t("app.setQuoteEmail.addPair")}
      </div>
      <div className="flex gap-3">
        <PhotoSlot
          url={before?.url}
          label={t("app.setQuoteEmail.before")}
          disabled={disabled}
          onError={onError}
          onUploaded={setBefore}
        />
        <PhotoSlot
          url={after?.url}
          label={t("app.setQuoteEmail.after")}
          disabled={disabled}
          onError={onError}
          onUploaded={setAfter}
        />
      </div>
    </div>
  );
}
