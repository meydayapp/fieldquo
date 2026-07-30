// app/site/[subdomain]/BeforeAfter.js
//
// A draggable before/after comparison.
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
// The AFTER image is a plain <img> in normal flow, so with JS off (or before
// hydration, or if this island fails) a visitor sees the finished work — the
// picture the company would have chosen anyway. The before image and the handle
// are layered on top only once mounted. There is no state in which the section
// is blank or broken.
//
// ── Keyboard and touch, not just mouse ─────────────────────────────────────
//
// The handle is a real <input type="range">, invisible but present: that gets
// arrow keys, touch dragging, screen-reader semantics and a focus ring for free,
// and all of it is behaviour a hand-rolled pointer-event divider gets wrong. The
// visible handle is decoration drawn at the input's value.
"use client";

import { useId, useState } from "react";

export default function BeforeAfter({ before, after, caption, radius = "rounded-2xl", theme }) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const id = useId();

  if (!before || !after) return null;

  const ink = theme?.ink || "#20242b";
  const paper = theme?.paper || "#ffffff";

  return (
    <figure className="m-0">
      <div
        // aspect-[4/3] is a FLOOR, not a crop: the after image below sets the
        // real height. It matters when an image URL 404s — without it the figure
        // collapses to zero and the caption floats in the middle of a blank
        // section, which reads as a broken page rather than a missing photo.
        className={`relative overflow-hidden aspect-[4/3] ${radius} select-none`}
        style={{ backgroundColor: theme?.accentWash || "#f4f4f5" }}
      >
        {/* AFTER — the base layer, and the no-JS answer. Absolute so both images
            share one box; the aspect ratio above owns the height. */}
        <img
          src={after}
          alt={caption ? `After: ${caption}` : "After"}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
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
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          loading="lazy"
          draggable={false}
        />

        {/* Labels. Fade the one being covered rather than removing it, so the
            layout never shifts mid-drag. */}
        <span
          className="absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider pointer-events-none transition-opacity"
          style={{
            backgroundColor: paper,
            color: ink,
            opacity: pos > 12 ? 1 : 0,
            borderRadius: 4,
          }}
        >
          Before
        </span>
        <span
          className="absolute top-3 right-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider pointer-events-none transition-opacity"
          style={{
            backgroundColor: paper,
            color: ink,
            opacity: pos < 88 ? 1 : 0,
            borderRadius: 4,
          }}
        >
          After
        </span>

        {/* The visible divider and grip. Decoration only — the real control is
            the range input below. pointer-events-none so it never eats a drag. */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-0.5 h-full" style={{ backgroundColor: paper }} />
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
        </div>

        <label htmlFor={id} className="sr-only">
          Drag to compare before and after{caption ? `: ${caption}` : ""}
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
