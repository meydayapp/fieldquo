"use client";

// app/components/public/HowToPayBlock.js
//
// The "How to pay" block on the two interactive client surfaces — the client
// portal's invoice page and the public quote page's deposit terms. Paints the
// model buildHowToPay() rendered server-side (lib/payments/offlineMethods.js)
// and never composes a sentence of its own, so what a homeowner reads here is
// word-for-word what the PDF and the email said.
//
// `showOnline` is false where the page already has a Pay button (the portal
// invoice page) — the online row would then be a sentence about the button
// it sits under. The quote page has no button, so it keeps the row.

import { washPair } from "@/lib/documents/theme";

export default function HowToPayBlock({ block, theme, showOnline = true, className = "" }) {
  if (!block || (!block.methods?.length && !(showOnline && block.online))) return null;
  const wash = washPair(theme);
  return (
    <div className={className} data-how-to-pay>
      <h3
        className="text-xs font-bold tracking-wider mb-2.5 uppercase"
        style={{ color: theme.accentText }}
      >
        {block.title}
      </h3>
      {showOnline && block.online && (
        <div
          className="rounded-lg px-3 py-2.5 border mb-3 text-sm font-semibold"
          style={{ backgroundColor: wash.bg, borderColor: theme.accentRule, color: wash.accent }}
        >
          {block.online.line}
        </div>
      )}
      <dl className="space-y-2.5">
        {block.methods.map((m) => (
          <div key={m.method} className="sm:grid sm:grid-cols-[9rem_1fr] sm:gap-3" data-method={m.method}>
            <dt className="text-sm font-semibold" style={{ color: theme.ink }}>
              {m.label}
            </dt>
            <dd className="text-sm leading-snug" style={{ color: theme.inkMuted }}>
              {m.lines.map((line, i) => (
                <div key={i} className="break-words">
                  {line}
                </div>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
