// app/components/auth/samples/SampleFrame.js
//
// The window every signup sample is shown through: a REAL component (or the
// real email HTML) rendered at the width it is actually used at, scaled down
// to the panel, clipped to a height, and labelled "Sample".
//
// ══ Why an iframe, not a scaled <div> ══════════════════════════════════════
//
// The owner's rule (2026-09-25): the samples must be the product, not a
// drawing of it. The product's components lay themselves out with the
// viewport's breakpoints — the client quote page is a phone layout below
// `md` and a two-column page with a contents rail above it; the dashboard
// tiles go from one column to four at `lg`. A component dropped into a
// 520px panel on a 1440px screen would render its DESKTOP layout squeezed
// into 520px: a picture of nothing the product ever shows. An iframe has its
// own viewport, so the component inside it sees the width we give it — 390
// for the page a homeowner opens on a phone, 1100 for the office dashboard —
// and lays itself out exactly as it does there. The frame then scales the
// whole viewport to the panel's width with a CSS transform.
//
// The component is still rendered by THIS React tree, through a portal into
// the iframe's body, so it keeps the page's providers (language, company
// preferences) and needs no second bundle. The page's stylesheets are cloned
// into the iframe's head — the same Tailwind build the product uses — and
// kept in step with a MutationObserver, because a lazily-loaded chunk can
// add a stylesheet after the frame is up.
//
// ══ A picture, not a control ═══════════════════════════════════════════════
//
// Everything inside is inert: the iframe takes no pointer events, is out of
// the tab order and hidden from assistive tech, and its body carries
// `inert`. The frame itself is role="img" with a label saying what the
// sample is, so a screen reader hears "Sample: …" rather than walking a
// document it cannot use. A control that looks pressable and does nothing
// would be the thing AGENTS.md forbids; a labelled image is not a control.
//
// ══ Before the iframe exists ═══════════════════════════════════════════════
//
// On the server (and in scripts/check-signup-aside.mjs, which renders with
// react-dom/server) there is no iframe document to portal into, so the
// children render in a hidden div instead. That keeps the server markup
// honest about what the frame shows — the check reads the real component's
// output there — and the client's first render identical to it; the swap to
// the iframe happens after mount.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/app/hooks/useTranslation";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const BLANK = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>";

/** Clone the page's stylesheets into the frame, and keep them in step. */
function mirrorStyles(doc) {
  const selector = 'link[rel="stylesheet"], style';
  const copy = (node) => {
    const clone = node.cloneNode(true);
    clone.setAttribute("data-sample-mirror", "");
    doc.head.appendChild(clone);
  };
  document.head.querySelectorAll(selector).forEach(copy);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType === 1 && n.matches?.(selector)) copy(n);
      });
    }
  });
  observer.observe(document.head, { childList: true });
  return () => observer.disconnect();
}

/**
 * @param width      the viewport width the sample is rendered at, in px
 * @param crop       how much of that width is shown, from the left (default:
 *                   all of it). The dispatch board lays out eleven hours; the
 *                   sample shows the name column and the morning at a
 *                   readable size rather than the whole day at a third.
 * @param maxHeight  the tallest slice shown, in the sample's own px; the rest
 *                   is clipped under a fade
 * @param label      what the sample is, for the Sample tag's screen-reader text
 * @param html       a whole HTML document (the email) instead of children
 * @param children   the real component(s), when `html` is not given
 * @param background the iframe body's background (a document is white paper)
 */
export default function SampleFrame({ width = 390, crop = null, maxHeight = 720, label, html = null, children = null, background = "transparent", className = "" }) {
  const shownWidth = Math.min(width, crop || width);
  const { t } = useTranslation();
  const outerRef = useRef(null);
  const frameRef = useRef(null);
  const [scale, setScale] = useState(null);
  const [contentHeight, setContentHeight] = useState(null);
  const [mount, setMount] = useState(null);
  // What the content's height is read from, once the frame has loaded.
  const readHeight = useRef(null);

  // ── Measuring, without a ResizeObserver ─────────────────────────────────
  //
  // Two numbers decide the frame: the panel's width (the scale — never above
  // 1: a sample is never drawn bigger than the product draws it) and the
  // content's height (the frame is exactly as tall as the slice it shows).
  // Each depends on the other through the page's layout, and watching them
  // with ResizeObservers — one of them on a node inside the iframe — tripped
  // "ResizeObserver loop completed with undelivered notifications" on every
  // heavy sample. They are read instead: on mount, on window resize, and a
  // few times a second while the frame is on screen (content keeps arriving
  // after mount — a month of slots, a lazy image), setting state only when
  // a number actually changed. Two reads of a laid-out page per tick.
  useIsoLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const tick = () => {
      const nextScale = Math.min(1, el.clientWidth / shownWidth) || 1;
      setScale((prev) => (prev != null && Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
      const read = readHeight.current;
      if (read) {
        const h = read();
        if (h > 0) setContentHeight((prev) => (prev === h ? prev : h));
      }
    };
    tick();
    const id = setInterval(tick, 250);
    window.addEventListener("resize", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", tick);
    };
  }, [shownWidth]);

  // The iframe's document: for `html`, what the browser parsed from srcDoc;
  // for children, a blank page given our stylesheets and a node to portal
  // into. Either way the content's height is watched so the frame is exactly
  // as tall as the slice it shows.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    let cleanup = () => {};
    const onLoad = () => {
      cleanup();
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      doc.body.setAttribute("inert", "");
      doc.body.style.margin = "0";
      // The frame is always exactly as tall as its content, so it never
      // scrolls — and a scrollbar that came and went as the height settled
      // would change the width, reflow the content and change the height
      // again: the resize loop the browser reports.
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";
      doc.body.style.background = background;
      if (html) {
        readHeight.current = () => doc.documentElement.scrollHeight;
        setContentHeight(readHeight.current());
        cleanup = () => {
          readHeight.current = null;
        };
        return;
      }
      // The page's own classes on <html> carry the font variables and the
      // theme (light / dark); the body gets the app's ink and nothing that
      // stretches it (the real body is min-h-full, which here would be the
      // frame's own height and never let it shrink).
      doc.documentElement.className = document.documentElement.className;
      for (const attr of ["data-theme", "style", "lang", "dir"]) {
        const v = document.documentElement.getAttribute(attr);
        if (v != null) doc.documentElement.setAttribute(attr, v);
      }
      // After the copy above, which replaces the style attribute wholesale.
      doc.documentElement.style.height = "auto";
      doc.documentElement.style.overflow = "hidden";
      doc.body.className = "text-foreground antialiased";
      const stopStyles = mirrorStyles(doc);
      const node = doc.createElement("div");
      node.setAttribute("data-sample-root", "");
      doc.body.appendChild(node);
      readHeight.current = () => node.scrollHeight;
      setMount(node);
      cleanup = () => {
        readHeight.current = null;
        stopStyles();
        setMount(null);
      };
    };
    frame.addEventListener("load", onLoad);
    // A same-origin blank frame can finish loading before this effect runs.
    if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.body) onLoad();
    return () => {
      frame.removeEventListener("load", onLoad);
      cleanup();
    };
  }, [html, background]);

  const shown = contentHeight == null ? null : Math.min(contentHeight, maxHeight);
  const clipped = contentHeight != null && contentHeight > maxHeight;
  const s = scale ?? 1;

  const sampleWord = t("app.signup.aside.sample", "Sample");
  return (
    <div
      role="img"
      aria-label={label ? `${sampleWord}: ${label}` : sampleWord}
      className={`relative mx-auto w-full ${className}`}
      // Never wider than the viewport it stands for: a phone page in a wide
      // panel is a phone-width card, centred, at its own size.
      style={{ maxWidth: shownWidth }}
      data-sample-frame={html ? "html" : "component"}
      data-sample-width={width}
      // Set once the sample has been measured in its frame — what the
      // app-guide harness waits for before it photographs the panel.
      data-sample-ready={contentHeight != null ? "1" : undefined}
    >
      {/* The visible label, ON the frame's top border so it never covers the
          sample's own header — the same tag the drawn price book wears. */}
      <span
        aria-hidden="true"
        className="absolute right-3 -top-2.5 z-10 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {sampleWord}
      </span>
      <div
        ref={outerRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-white"
        style={{
          height: shown == null || scale == null ? undefined : Math.ceil(shown * s),
          // Before the first measurement: a quiet box the shape of the slice,
          // so the panel does not jump when the sample arrives.
          minHeight: shown == null ? Math.min(maxHeight, 320) * s : undefined,
          WebkitMaskImage: clipped ? "linear-gradient(to bottom, black calc(100% - 56px), transparent)" : undefined,
          maskImage: clipped ? "linear-gradient(to bottom, black calc(100% - 56px), transparent)" : undefined,
        }}
      >
        <iframe
          ref={frameRef}
          title={label || sampleWord}
          aria-hidden="true"
          tabIndex={-1}
          // allow-same-origin WITHOUT allow-scripts: nothing in the frame can
          // run, and this page can still read its height and portal into it.
          sandbox="allow-same-origin"
          srcDoc={html || BLANK}
          scrolling="no"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height: contentHeight ?? maxHeight,
            border: 0,
            transform: `scale(${s})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            background,
          }}
        />
        {!html && !mount ? (
          // Server render and the first client render: the real component's
          // markup, present but not shown — see the header.
          <div hidden data-sample-fallback>
            {children}
          </div>
        ) : null}
        {mount ? createPortal(children, mount) : null}
      </div>
    </div>
  );
}
