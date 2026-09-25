// app/components/settings/PairPhotoFields.js
//
// The three pieces a before/after pair editor is made of: a photo slot that
// uploads through the shared helper (lib/media/uploadClient.js — signed by
// /api/upload, bytes straight to Cloudinary), a text field that commits
// on blur, and the "new pair" draft that only becomes a pair once BOTH
// photos exist. Shared by Settings › Quote Email and the company gallery
// editor (app/components/settings/GalleryEditor.js) since the two write to
// the same gallery — a second copy of PhotoSlot is the one that rots.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { uploadFile } from "@/lib/media/uploadClient";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/** One "before" or "after" slot. Uploads through the shared upload helper. */
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
      const data = await uploadFile(file, { purpose: "website" });
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


// ── The new pair, and the draft it can be left as ───────────────────────────
//
// The bug this replaced (owner, 2026-09-25): "I cannot delete the new pair
// and I think I'm stuck like that." The slot held its first photo in React
// state with no remove control, so a before with no after to hand sat there
// with no way out — and closing the dialog silently threw it away.
//
// Now the half pair is STORED as the company's one gallery draft
// (Company.galleryDraftPair, via /api/settings/gallery `draft`), so:
//   - it survives closing the dialog and can be finished later, anywhere;
//   - it is marked as a draft, in words, with a Discard control (confirmed);
//   - it never reaches a client — the draft is not a gallery row, and the
//     website, quote email and proposal read only gallery rows.
// When the second photo lands, the pair is handed to `onComplete` and the
// draft cleared only once that save succeeded; a failed save leaves both
// photos in the draft with a "Save this pair" retry.

const GALLERY_URL = "/api/settings/gallery";

function sideOf(draft, side) {
  const url = draft?.[`${side}Url`];
  return url ? { url, publicId: draft?.[`${side}PublicId`] || "" } : null;
}

function putDraft(draft) {
  return fetchJson(GALLERY_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
}

/**
 * @param initialDraft  the draft the parent already loaded (GET /api/settings/
 *                      gallery answers it); undefined → loaded here
 * @param onComplete    async (pair) → true when the pair was stored, false
 *                      when not, or "cleared" when the parent's own save also
 *                      cleared the draft (the gallery editor sends both in one
 *                      request)
 */
export function NewPair({ disabled, onComplete, onError, t, initialDraft }) {
  const [before, setBefore] = useState(() => sideOf(initialDraft, "before"));
  const [after, setAfter] = useState(() => sideOf(initialDraft, "after"));
  const [busy, setBusy] = useState(false);
  const loaded = useRef(initialDraft !== undefined);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    fetchJson(GALLERY_URL)
      .then((d) => {
        if (cancelled || !d?.draft) return;
        setBefore(sideOf(d.draft, "before"));
        setAfter(sideOf(d.draft, "after"));
      })
      .catch(() => {
        // The editor above reports its own load failure; an unreadable draft
        // leaves an empty slot, which is what there was before drafts existed.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draftOf = (b, a) => ({
    beforeUrl: b?.url || null,
    beforePublicId: b?.publicId || null,
    afterUrl: a?.url || null,
    afterPublicId: a?.publicId || null,
  });

  async function finish(b, a) {
    setBusy(true);
    try {
      const done = await onComplete({
        beforeUrl: b.url,
        beforePublicId: b.publicId,
        afterUrl: a.url,
        afterPublicId: a.publicId,
      });
      if (!done) return; // the parent showed its error; the draft stays
      if (done !== "cleared") await putDraft(null);
      setBefore(null);
      setAfter(null);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function placed(side, photo) {
    const b = side === "before" ? photo : before;
    const a = side === "after" ? photo : after;
    if (side === "before") setBefore(photo);
    else setAfter(photo);
    // Stored before anything else, so a failed completion below cannot lose
    // the photo that was just uploaded.
    try {
      await putDraft(draftOf(b, a));
    } catch (err) {
      onError(err.message);
      return;
    }
    if (b && a) await finish(b, a);
  }

  async function discard() {
    if (!window.confirm(t("app.gallery.draftDiscardConfirm", "Discard this unfinished pair? The photo you uploaded for it is removed from your gallery editor."))) return;
    setBusy(true);
    try {
      await putDraft(null);
      setBefore(null);
      setAfter(null);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isDraft = Boolean(before || after);
  const complete = Boolean(before && after);

  return (
    <div
      className={`border border-dashed rounded-lg p-3 ${isDraft ? "border-amber-400 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"}`}
      data-gallery-draft={isDraft ? "" : undefined}
    >
      {isDraft ? (
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {t("app.gallery.draftLabel", "Unfinished pair — draft")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("app.gallery.draftHint", "Clients don't see it until both photos are in. You can finish it later.")}
            </div>
          </div>
          <button
            type="button"
            onClick={discard}
            disabled={disabled || busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm text-foreground hover:text-red-600 disabled:opacity-50 min-h-11"
          >
            <Trash2 size={14} aria-hidden="true" />
            {t("app.gallery.draftDiscard", "Discard")}
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-2">
          {t("app.setQuoteEmail.addPair")}
        </div>
      )}
      <div className="flex gap-3">
        <PhotoSlot
          url={before?.url}
          label={t("app.setQuoteEmail.before")}
          disabled={disabled || busy}
          onError={onError}
          onUploaded={(p) => placed("before", p)}
        />
        <PhotoSlot
          url={after?.url}
          label={t("app.setQuoteEmail.after")}
          disabled={disabled || busy}
          onError={onError}
          onUploaded={(p) => placed("after", p)}
        />
      </div>
      {complete && !busy && (
        <button
          type="button"
          onClick={() => finish(before, after)}
          disabled={disabled}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 text-sm font-semibold min-h-11 disabled:opacity-50"
        >
          {t("app.gallery.draftSave", "Save this pair")}
        </button>
      )}
    </div>
  );
}
