// app/components/quotes/builder/QuoteTotalsBar.js
//
// The running total, and the two ways out of this screen.
//
// ── Why the total moved into the sticky bar ─────────────────────────────────
//
// It used to sit in a card above the action bar, which meant scrolling away
// from it the moment a quote had more than one service — exactly when the
// number matters most. It's now beside the buttons, always visible, which is
// also where someone's thumb already is on a phone.
//
// ── "Save & send" says what it does ─────────────────────────────────────────
//
// It genuinely sends now (app/api/quotes/[id]/send), so the button can promise
// it. Until recently it set a status field and emailed nothing, which is why
// the label deserves care rather than being decoration.
"use client";

import { Loader2, Save, Send } from "lucide-react";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

export default function QuoteTotalsBar({
  subtotal,
  tax,
  taxRate,
  total,
  taxEnabled,
  onTaxToggle,
  saving,
  disabled,
  onSaveDraft,
  onSaveAndSend,
}) {
  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => onTaxToggle(e.target.checked)}
          />
          Apply tax ({taxRate}%)
        </label>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span className="tabular-nums">{money(tax)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground text-base pt-1 border-t border-border mt-1">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>
      </div>

      {/* left-60 clears the desktop sidebar; full width below that breakpoint
          where the sidebar collapses. */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3 z-40">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground leading-none">
            {taxEnabled ? "Total incl. tax" : "Total, no tax"}
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {money(total)}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving || disabled}
            className="border border-border px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {saving === "draft" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            <span className="hidden sm:inline">Save as</span> draft
          </button>

          <button
            type="button"
            onClick={onSaveAndSend}
            disabled={saving || disabled}
            className="bg-inverted text-inverted-foreground px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {saving === "sent" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Save &amp; send
          </button>
        </div>
      </div>
    </>
  );
}
