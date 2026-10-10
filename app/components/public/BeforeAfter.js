// app/components/public/BeforeAfter.js
//
// A draggable before/after comparison — the ONE slider every client-facing
// page draws: the website's `beforeafter` block (app/site/[subdomain]/
// SiteBlocks.js, through the re-export at app/site/[subdomain]/BeforeAfter.js)
// and the quote / instant-estimate proposal's "Before & after" section
// (app/components/public/proposal/ProposalSections.js).
//
// ── Why a slider and not two images side by side ────────────────────────────
//
// Side by side asks a visitor to compare two rectangles and work out what
// changed. A slider makes them do the reveal themselves, on the same pixels, in
// the same frame — which is why every restoration, painting and roofing company
// on earth uses one. It is the single most persuasive thing a trade can put on a
// page, and the photos already exist on JobVisit.photos.
//
// ── It works before JavaScript, and without it ──────────────────────────────
//
// Both images and the handle are in the server HTML, the before image clipped
// to the left half. With JS off (or before hydration, or if this island fails)
// a visitor sees a still half-before / half-after frame — the comparison, just
// not draggable. There is no state in which the section is blank or broken.
// (This said "the before image is layered on only once mounted" until
// 2026-10-10; it never was, and the static split is the better no-JS answer.)
//
// ── Keyboard and touch, not just mouse ─────────────────────────────────────
//
// The handle is a real <input type="range">, invisible but present: that gets
// arrow keys, touch dragging, screen-reader semantics and a focus ring for free,
// and all of it is behaviour a hand-rolled pointer-event divider gets wrong. The
// visible handle is decoration drawn at the input's value.
//
// ── The document props (2026-10-10) ────────────────────────────────────────
//
// The proposal needed four things the website block never asked for, and each
// is OPT-IN: with none of them the markup is the pre-move markup, pinned in
// scripts/check-proposal-slider.mjs.
//
//   labels       { before, after } in the page's language. The website block
//                passes these too (with compareLabel) since 2026-10-10 — it
//                printed English "Before"/"After" on every non-English site.
//                With labels, both images carry alt text ("Before — Maple St"),
//                the format the email and the old side-by-side used.
//   compareLabel the screen-reader name of the range input, localised.
//   handle       a measured { bg, fg } (lib/documents/theme.js fillPair): the
//                grip in the brand colour, inside a white ring inside an ink
//                ring. The photo behind is unknown, so neither ring alone can
//                promise contrast; together they do — against ANY colour one of
//                white (21:1 at most) and ink #20242b (15.9:1 from white) is at
//                least √15.9 ≈ 3.99:1, over the 3:1 a UI component needs.
//                Measured in the check across a sweep of photo colours.
//   fitToPhoto   the box takes the AFTER photo's own shape instead of a fixed
//                4:3, clamped to 3:4…16:9 so a tall phone shot crops at most a
//                quarter and a panorama doesn't become a letterbox. Until the
//                photo loads (and with JS off) it is 4:3, the floor that stops a
//                404 collapsing the figure.
//
// With `handle`, motion is reduced for visitors who ask for it
// (prefers-reduced-motion): the label fade and the grip's grow are instant.
"use client";

import { useCallback, useId, useState } from "react";

// The shapes a photo's box may take with fitToPhoto: 3:4 portrait to 16:9.
const MIN_RATIO = 3 / 4;
const MAX_RATIO = 16 / 9;

// The grip's two rings — see "handle" above. Ink is documentTheme's ink.
const RING_LIGHT = "#ffffff";
const RING_DARK = "#20242b";

export default function BeforeAfter({
  before,
  after,
  caption,
  radius = "rounded-2xl",
  theme,
  labels,
  compareLabel,
  handle,
  fitToPhoto = false,
}) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [ratio, setRatio] = useState(null);
  const id = useId();

  // An image that finished loading before hydration fires no onLoad React can
  // see, so the ref reads `complete` too.
  const measure = useCallback((img) => {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const r = img.naturalWidth / img.naturalHeight;
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, r)));
  }, []);

  if (!before || !after) return null;

  const ink = theme?.ink || "#20242b";
  const paper = theme?.paper || "#ffffff";
  const named = Boolean(labels);
  const beforeText = labels?.before || "Before";
  const afterText = labels?.after || "After";
  const alt = (word) => `${word}${caption ? ` — ${caption}` : ""}`;
  const motionSafe = Boolean(handle);

  const boxStyle = { backgroundColor: theme?.accentWash || "#f4f4f5" };
  if (fitToPhoto && ratio) boxStyle.aspectRatio = String(ratio);

  return (
    <figure className="m-0">
      <div
        // aspect-[4/3] owns the height: both images are absolute, so nothing
        // else gives the box one. (This comment called it "a floor, not a
        // crop" until 2026-10-10 — it is a crop; fitToPhoto is the opt-in that
        // follows the photo instead.) It matters when an image URL 404s —
        // without it the figure collapses to zero and the caption floats in
        // the middle of a blank section, which reads as a broken page rather
        // than a missing photo.
        className={`relative overflow-hidden aspect-[4/3] ${radius} select-none`}
        style={boxStyle}
      >
        {/* AFTER — the base layer, and the no-JS answer. Absolute so both images
            share one box; the aspect ratio above owns the height. */}
        <img
          src={after}
          alt={named ? alt(afterText) : caption ? `After: ${caption}` : "After"}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
          {...(fitToPhoto ? { ref: measure, onLoad: (e) => measure(e.currentTarget) } : {})}
        />

        {/* BEFORE — the same box as the after image, revealed by clip-path.
            clip-path rather than a width-constrained wrapper on purpose: a
            wrapper needs the inner image sized to the CONTAINER, which means
            measuring the DOM, which means a ref read during render (a hydration
            mismatch) and a value that goes stale on resize. Clipping needs no
            measurement, reflows for free, and object-cover keeps the two photos
            aligned even though they were never shot at the same aspect ratio. */}
        <img
          src={before}
          {...(named ? { alt: alt(beforeText) } : { alt: "", "aria-hidden": "true" })}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          loading="lazy"
          draggable={false}
        />

        {/* Labels. Fade the one being covered rather than removing it, so the
            layout never shifts mid-drag. */}
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider pointer-events-none transition-opacity${motionSafe ? " motion-reduce:transition-none" : ""}`}
          style={{
            backgroundColor: paper,
            color: ink,
            opacity: pos > 12 ? 1 : 0,
            borderRadius: 4,
          }}
        >
          {beforeText}
        </span>
        <span
          className={`absolute top-3 right-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider pointer-events-none transition-opacity${motionSafe ? " motion-reduce:transition-none" : ""}`}
          style={{
            backgroundColor: paper,
            color: ink,
            opacity: pos < 88 ? 1 : 0,
            borderRadius: 4,
          }}
        >
          {afterText}
        </span>

        {/* The visible divider and grip. Decoration only — the real control is
            the range input below. pointer-events-none so it never eats a drag. */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div
            className="w-0.5 h-full"
            style={handle ? { backgroundColor: RING_LIGHT, boxShadow: `0 0 0 1px ${RING_DARK}` } : { backgroundColor: paper }}
          />
          {handle ? (
            <div
              className="absolute top-1/2 left-1/2 flex items-center justify-center rounded-full transition-[scale] duration-[120ms] ease-out motion-reduce:transition-none"
              style={{
                transform: "translate(-50%,-50%)",
                width: 44,
                height: 44,
                backgroundColor: handle.bg,
                boxShadow: `0 0 0 2px ${RING_LIGHT}, 0 0 0 3.5px ${RING_DARK}, 0 4px 12px rgba(0,0,0,0.25)`,
                scale: dragging ? "1.08" : "1",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={handle.fg} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M9 6 4 12l5 6" />
                <path d="m15 6 5 6-5 6" />
              </svg>
            </div>
          ) : (
            <div
              className="absolute top-1/2 left-1/2 flex items-center justify-center rounded-full shadow-lg"
              style={{
                transform: "translate(-50%,-50%)",
                width: 44,
                height: 44,
                backgroundColor: paper,
                // Grows slightly while dragging: the only affordance telling a
                // first-time visitor the thing is draggable at all.
                scale: dragging ? "1.08" : "1",
                transition: "scale 120ms ease-out",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 6 4 12l5 6" />
                <path d="m15 6 5 6-5 6" />
              </svg>
            </div>
          )}
        </div>

        <label htmlFor={id} className="sr-only">
          {/* A localised label is a whole sentence ("Drag the handle to
              compare."), so the project's name goes first, not after a colon. */}
          {compareLabel
            ? `${caption ? `${caption} — ` : ""}${compareLabel}`
            : <>Drag to compare before and after{caption ? `: ${caption}` : ""}</>}
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          // Fills the image and is invisible, so the whole picture is the
          // control — dragging anywhere works, which is what people try first.
          // `appearance-none` plus a transparent thumb keeps the native
          // behaviour and hides the native chrome.
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize appearance-none bg-transparent"
        />
      </div>

      {caption && (
        <figcaption
          className="mt-2.5 text-sm"
          style={{ color: theme?.inkMuted || "#6b7280" }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
