"use client";

// app/components/dashboard/InfoTip.js
//
// A small "what does this number mean?" tip, for the two money figures that
// used to sit side by side answering different questions ("Revenue this
// month" and "Money received"). A native `title` alone is invisible on a
// phone and to a keyboard, so the tip is a real button: tap or focus-and-
// Enter opens it, Escape or a second tap closes it, and the sentence is wired
// to the button with aria-describedby so a screen reader hears it without
// opening anything.
//
// It opens IN FLOW — a full-width line under the label (`basis-full` in the
// label's wrapping flex row) — not as a hand-positioned popover:
// scripts/check-mobile.mjs refuses absolutely-placed dropdowns because on a
// 375px screen they clip off the edge. The parent row must be `flex-wrap`.
import { useId, useState } from "react";
import { Info } from "lucide-react";

export default function InfoTip({ text, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text) return null;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center justify-center min-h-9 min-w-9 -my-2 text-muted-foreground hover:text-foreground"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        id={id}
        className={
          open
            ? "basis-full block border-l-2 border-foreground/30 pl-2 text-xs font-normal leading-snug text-muted-foreground"
            : "sr-only"
        }
      >
        {text}
      </span>
    </>
  );
}
