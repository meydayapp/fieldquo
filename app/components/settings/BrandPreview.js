// app/components/settings/BrandPreview.js
//
// Shows what a brand colour does to a CLIENT DOCUMENT before it's saved.
//
// It used to render a miniature app sidebar, back when the colour themed the
// whole back office. It no longer does — see app/components/BrandTheme.js —
// and a preview that shows the wrong surface is worse than no preview: it
// tells a contractor their choice lands somewhere it doesn't. So this is a
// quote: letterhead, a couple of lines, a filled total band, the two buttons
// a client actually sees.
//
// The contrast readout is the real content. Every foreground is computed by
// lib/brand/colour.js from measured WCAG ratios, so a pale colour gets dark
// text automatically — but a company should still be able to see that their
// chosen yellow produces a letterhead that looks like a highlighter.
//
// `inverted` is the right token to preview against: it is precisely what
// paints the document's letterhead and total band on the quote page, the PDF
// and the emails. The names below say "letterhead", not "sidebar", for that
// reason.
"use client";

import { deriveBrandTokens, contrastRatio, isValidHex } from "@/lib/brand/colour";
import { AlertTriangle, Check } from "lucide-react";

export default function BrandPreview({ brandColor, secondary, dark = false }) {
  if (!isValidHex(brandColor)) return null;

  const t = deriveBrandTokens(brandColor, { dark, accent: secondary });
  const chromeRatio = contrastRatio(t.invertedForeground, t.inverted);
  const accentRatio = contrastRatio(t.secondaryForeground, t.secondary);

  // Not a pass/fail on the company's taste — the maths guarantees legibility.
  // This flags the case where the colour is so pale the letterhead stops
  // reading as a band at all, which contrast alone can't tell you.
  const veryPale = contrastRatio(t.inverted, "#ffffff") < 1.6;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div style={{ background: t.background, color: t.foreground }}>
        {/* Letterhead — the filled band at the top of a quote or invoice */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: t.inverted, color: t.invertedForeground }}
        >
          <div className="text-[9px] font-bold opacity-95">Your company</div>
          <div className="text-[8px] opacity-80">Quote #1042</div>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-[8px]" style={{ color: t.mutedForeground }}>
              Prepared for
            </div>
            <div className="text-[9px] font-medium">Jane Doe</div>
          </div>

          <div
            className="rounded-md p-2 space-y-1"
            style={{ background: t.card, border: `1px solid ${t.border}` }}
          >
            <div className="flex justify-between text-[8px]">
              <span>Labour &amp; installation</span>
              <span className="tabular-nums">$1,850.00</span>
            </div>
            <div
              className="flex justify-between text-[8px]"
              style={{ color: t.mutedForeground }}
            >
              <span>Materials</span>
              <span className="tabular-nums">$640.00</span>
            </div>
          </div>

          {/* Total band — the other place the brand colour carries weight */}
          <div
            className="flex justify-between rounded-md px-2 py-1.5 text-[9px] font-bold"
            style={{ background: t.inverted, color: t.invertedForeground }}
          >
            <span>Total</span>
            <span className="tabular-nums">$2,490.00</span>
          </div>

          <div className="flex gap-1.5 pt-0.5">
            <span
              className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
              style={{ background: t.secondary, color: t.secondaryForeground }}
            >
              Approve
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
              style={{
                border: `1px solid ${t.border}`,
                color: t.mutedForeground,
              }}
            >
              Ask a question
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-muted border-t border-border space-y-1">
        <Readout
          label="Text on your letterhead"
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
            That&apos;s very pale for a letterhead — readable, but the band
            won&apos;t separate from the page. Something darker usually reads
            better on a printed quote.
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
        className="w-3 h-3 rounded-sm border border-border shrink-0"
        style={{ background: swatch }}
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span
        className={`inline-flex items-center gap-1 font-medium tabular-nums ${
          ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"
        }`}
      >
        {ok ? <Check size={11} /> : <AlertTriangle size={11} />}
        {ratio.toFixed(1)}:1
      </span>
    </div>
  );
}
