// app/embed/EmbedFrame.js
//
// Reports its own height to the page hosting it.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// An iframe has a height the PARENT chose, and it has no idea what's inside.
// A booking flow is short on step one and tall on step three, and a fixed
// 600px box means the visitor picks a time, fills in their details, presses
// Confirm — and the confirmation renders below the fold of a box that doesn't
// scroll with the page. From where they're sitting, nothing happened. They
// book again, or they leave.
//
// ── The fix, and its limits ─────────────────────────────────────────────────
//
// ResizeObserver measures the content, postMessage sends the number, and the
// snippet FieldQuo hands out resizes the iframe. When the snippet isn't there
// — someone pasted a plain <iframe> tag, or a CMS stripped the script — the
// message goes nowhere and the box scrolls. That's the old behaviour, not a
// broken one, which is the property that matters for something running on a
// website nobody at FieldQuo can see.
//
// targetOrigin is "*" deliberately. The embed cannot know which domain has
// framed it, and this message carries one integer — a height — with no
// user data in it. Restricting it would mean maintaining a list of every
// customer's website domain, which is a real cost for no gain here.
"use client";

import { useEffect, useRef } from "react";

export default function EmbedFrame({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return;
    // Not inside an iframe — nothing to tell.
    if (window.parent === window) return;

    let last = 0;

    const report = () => {
      // offsetHeight rather than scrollHeight: scrollHeight of a growing
      // element inside a short frame keeps returning the larger of the two,
      // which makes the frame grow every tick and never settle.
      const height = Math.ceil(node.offsetHeight);
      // A dead band. Sub-pixel reflows would otherwise post a message on every
      // animation frame for the life of the page.
      if (Math.abs(height - last) < 2) return;
      last = height;
      window.parent.postMessage(
        { type: "fieldquo:embed-height", height },
        "*",
      );
    };

    report();

    // ResizeObserver isn't in very old browsers, and this is a progressive
    // enhancement — no observer just means the frame keeps the height the
    // host page gave it.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-white">
      {children}
    </div>
  );
}
