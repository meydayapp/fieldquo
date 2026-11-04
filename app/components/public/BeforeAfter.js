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
// ── The drag is ours; the range input is the keyboard ──────────────────────
//
// This read "the handle is a real <input type=\"range\"> … that gets arrow keys,
// touch dragging and a focus ring for free" until 2026-11-03. Three of those
// four were true. Touch dragging was not, and the owner reported it twice:
// homeowners press and hold, double tap, and give up.
//
// A native range does not treat its track as a drag surface. Chrome and Firefox
// on a desktop jump the thumb to a click and then follow the mouse, so the thing
// always worked on the machine it was built on. On iOS Safari a touch that lands
// anywhere but the THUMB does nothing at all — no jump, no drag — and the thumb
// here is one pixel wide, because 2026-10-31 shrank it to 1px to fix the
// desktop mapping (app/globals.css, and it did fix that). So the fix for the
// desktop drift left iPhone visitors a one-pixel target, which is the phone a
// quote is read on in a driveway. Press-and-hold then hits Safari's image sheet
// and double-tap hits zoom, which is exactly what the owner watched people do.
//
// So the position is driven by pointer events on the photo itself — one code
// path for mouse, touch and pen, on every browser, with setPointerCapture so a
// drag that leaves the box keeps tracking. touch-pan-y hands a VERTICAL swipe
// back to the page (a client scrolling the quote must still scroll) and claims
// the horizontal one; -webkit-touch-callout:none stops the long-press "Save
// Image" sheet that a homeowner was getting instead of a slider.
//
// The <input type="range"> stays, pointer-events-none: it is no longer the drag
// surface, only the keyboard control and the screen-reader semantics (role,
// value, localised name), which a hand-rolled divider does get wrong. It is
// invisible, so the focus ring it "got for free" was never drawn either — the
// drawn grip now shows one while the input has focus.
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

import { useCallback, useId, useRef, useState } from "react";
import { resizedUrl } from "@/lib/media/cloudinaryUrl";

// The shapes a photo's box may take with fitToPhoto: 3:4 portrait to 16:9.
const MIN_RATIO = 3 / 4;
const MAX_RATIO = 16 / 9;

// The grip's two rings — see "handle" above. Ink is documentTheme's ink.
const RING_LIGHT = "#ffffff";
const RING_DARK = "#20242b";

/**
 * Where a pointer at `clientX` puts the divider, 0–100, given the photo's box.
 *
 * Exported so the clamp is EXECUTED rather than eyeballed
 * (scripts/check-proposal-slider.mjs). Two cases are not obvious:
 *
 *   • A drag that leaves the photo keeps sending moves, because the box holds
 *     pointer capture — so a finger dragged off the left edge must pin to 0,
 *     not carry on negative and invert the clip-path.
 *   • A box with no width (a photo that 404'd, a section mid-layout) must give
 *     nothing at all. Dividing by zero yields NaN, `inset(0 NaN% 0 0)` is an
 *     invalid clip-path, and an invalid clip-path clips NOTHING — the before
 *     photo would cover the after one full-frame and the slider would look
 *     stuck rather than unmeasured.
 */
export function positionFromX(clientX, rect) {
  if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) return null;
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left)) return null;
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
}

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
  const [focused, setFocused] = useState(false);
  const [ratio, setRatio] = useState(null);
  const id = useId();
  const boxRef = useRef(null);
  // Not the `dragging` state: the first pointermove can arrive before React has
  // re-rendered, so a handler reading state would drop it and the drag would
  // feel like it needed a second nudge to start.
  const draggingRef = useRef(false);

  const posFromClientX = useCallback(
    (clientX) => positionFromX(clientX, boxRef.current?.getBoundingClientRect()),
    [],
  );

  // A press anywhere on the photo moves the divider there and starts a drag —
  // what people try first, and what the old comment claimed already happened.
  const startDrag = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const next = posFromClientX(e.clientX);
      if (next === null) return;
      setPos(next);
      setDragging(true);
      draggingRef.current = true;
      // Keeps the drag alive past the edge of the photo, and past the moment a
      // finger strays onto the caption below.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; the move handler works without it.
      }
    },
    [posFromClientX],
  );

  const moveDrag = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      const next = posFromClientX(e.clientX);
      if (next !== null) setPos(next);
    },
    [posFromClientX],
  );

  // pointercancel fires when the browser decides the gesture was a vertical
  // scroll after all. Ending the drag there is the point: the page scrolls and
  // the divider stays where the finger left it, rather than tracking a scroll.
  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

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

  // ── Delivered, not original ────────────────────────────────────────────
  //
  // These are gallery uploads: phone photos of a kitchen, which Cloudinary
  // stores at whatever the camera produced. Served raw, ONE of this company's
  // was 1.7 MB, and a five-pair section is ten of them — so the slider boxes
  // sat empty on the client's quote while the originals crawled down. The
  // owner read that as broken, which on a phone in a driveway it is.
  //
  // c_limit never enlarges, so a small photo is untouched; f_auto/q_auto let
  // Cloudinary negotiate webp/avif at the edge. 1400 is the widest this box
  // is ever drawn at (a full-width website block on a retina laptop) — the
  // proposal's three-up grid draws it at a third of that.
  const shown = (u) => resizedUrl(u, { width: 1400 });

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
        ref={boxRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        // touch-pan-y: a vertical swipe still scrolls the quote, a horizontal
        // one is the slider. cursor-ew-resize has to live here now that the
        // range input on top no longer takes the pointer.
        className={`relative overflow-hidden aspect-[4/3] ${radius} select-none touch-pan-y cursor-ew-resize [-webkit-touch-callout:none]`}
        style={boxStyle}
      >
        {/* AFTER — the base layer, and the no-JS answer. Absolute so both images
            share one box; the aspect ratio above owns the height. */}
        <img
          src={shown(after)}
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
          src={shown(before)}
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
                // The focus ring repeats the ink/white pair the rings already
                // prove ≥3:1 against any photo colour, so a keyboard visitor
                // can see where they are on a photo of any colour.
                boxShadow: `0 0 0 2px ${RING_LIGHT}, 0 0 0 3.5px ${RING_DARK}, 0 4px 12px rgba(0,0,0,0.25)${focused ? `, 0 0 0 6px ${RING_DARK}, 0 0 0 8px ${RING_LIGHT}` : ""}`,
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
                // Only while focused, so shadow-lg is untouched otherwise.
                ...(focused ? { boxShadow: `0 0 0 3px ${paper}, 0 0 0 5px ${ink}` } : {}),
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
          // Rounded, because the drag is a float: the input's step is 1, and a
          // value React renders as 37.42 would be normalised by the browser to
          // 37 and fought over on every move. The float drives the picture; the
          // integer drives the input, so an arrow key is a clean 1%.
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // pointer-events-none: the photo above owns the pointer (see "The
          // drag is ours" at the top). This input is the keyboard and the
          // screen reader — arrow keys, role, value, and the localised name in
          // the <label>. `appearance-none` and ba-range (app/globals.css) keep
          // the native thumb and track from ever being drawn over the photo.
          className="ba-range absolute inset-0 w-full h-full opacity-0 pointer-events-none appearance-none bg-transparent"
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
