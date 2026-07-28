// app/components/settings/BrandPreview.js
//
// Shows what a brand colour does to the app BEFORE it's saved.
//
// This matters more than it used to. The colour no longer just tints a quote
// header — it becomes the sidebar, the buttons and the active states of the
// app the company's whole team works in all day. Picking one blind and
// discovering the result after a page reload is a bad way to find out you
// chose something unreadable.
//
// The contrast readout is the real content here. Every foreground is computed
// by lib/brand/colour.js from measured WCAG ratios, so a pale colour gets dark
// text automatically — but a company should still be able to see that their
// chosen yellow produces a sidebar that looks like a highlighter.
"use client";

import { deriveBrandTokens, contrastRatio, isValidHex } from "@/lib/brand/colour";
import { AlertTriangle, Check } from "lucide-react";

export default function BrandPreview({ brandColor, secondary, dark = false }) {
  if (!isValidHex(brandColor)) return null;

  const t = deriveBrandTokens(brandColor, { dark, accent: secondary });
  const chromeRatio = contrastRatio(t.invertedForeground, t.inverted);
  const accentRatio = contrastRatio(t.secondaryForeground, t.secondary);

  // Not a pass/fail on the company's taste — the maths guarantees legibility.
  // This flags the case where the colour is so pale the chrome stops reading
  // as chrome at all, which contrast alone can't tell you.
  const veryPale = contrastRatio(t.inverted, "#ffffff") < 1.6;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div
        className="flex"
        style={{ background: t.background, color: t.foreground }}
      >
        {/* Miniature sidebar */}
        <div
          className="w-24 shrink-0 p-2.5 space-y-1.5"
          style={{ background: t.inverted, color: t.invertedForeground }}
        >
          <div className="text-[9px] font-bold opacity-90">FieldQuo</div>
          <div
            className="rounded px-1.5 py-1 text-[8px] font-semibold"
            style={{ background: t.secondary, color: t.secondaryForeground }}
          >
            Quotes
          </div>
          <div className="text-[8px] opacity-70 px-1.5">Clients</div>
          <div className="text-[8px] opacity-70 px-1.5">Invoices</div>
        </div>

        {/* Miniature page */}
        <div className="flex-1 p-3 space-y-2">
          <div className="text-[10px] font-bold">New quote</div>
          <div
            className="rounded-md p-2 space-y-1.5"
            style={{ background: t.card, border: `1px solid ${t.border}` }}
          >
            <div className="text-[8px]" style={{ color: t.mutedForeground }}>
              Client
            </div>
            <div className="text-[9px]">Jane Doe</div>
            <div className="flex gap-1.5 pt-1">
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
                style={{ background: t.inverted, color: t.invertedForeground }}
              >
                Save
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
                style={{ background: t.secondary, color: t.secondaryForeground }}
              >
                Send
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-muted border-t border-border space-y-1">
        <Readout
          label="Text on your sidebar"
          ratio={chromeRatio}
          swatch={t.inverted}
        />
        <Readout
          label="Text on your accent"
          ratio={accentRatio}
          swatch={t.secondary}
        />
        {veryPale && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5 pt-1">
            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
            That&apos;s very pale for a sidebar — readable, but it won&apos;t
            look like navigation. Something darker usually reads better.
          </p>
        )}
      </div>
    </div>
  );
}

function Readout({ label, ratio, swatch }) {
  const ok = ratio >= 4.5;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className="w-3 h-3 rounded-sm border border-black/10 shrink-0"
        style={{ background: swatch }}
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span
        className={`inline-flex items-center gap-1 font-medium ${
          ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300"
        }`}
      >
        {ok ? <Check size={10} /> : <AlertTriangle size={10} />}
        {ratio.toFixed(1)}:1
      </span>
    </div>
  );
}
