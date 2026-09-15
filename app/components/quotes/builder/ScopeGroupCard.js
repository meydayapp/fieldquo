// app/components/quotes/builder/ScopeGroupCard.js
//
// The shell around one service on the quote being built.
//
// ── Why the shell is its own component ──────────────────────────────────────
//
// The body of a scope group differs wildly by trade: cabinet work has a unit
// grid and complexity levels, junk removal has tiered packages, most trades
// have structured intake fields, and everything ends in an editable line-item
// table. That variety belongs in the builder page where the domain logic
// lives. What does NOT vary is the frame — accent, title, running subtotal,
// remove — and that frame is exactly what was missing.
//
// So this takes children and owns only the chrome. The parent keeps its state
// and its save path untouched, which matters because quote creation is the one
// flow in this product that cannot be allowed to break.
//
// ── The running subtotal is the point ───────────────────────────────────────
//
// A multi-service quote used to show one figure at the very bottom. Someone
// pricing "interior painting + flooring" had no idea which half was the
// expensive one without adding it up by hand — and that's the number that
// decides whether the client is told to drop a service or discount the lot.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import { resolveServiceContent } from "@/lib/documents/serviceContent";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

/**
 * @param group     the scope group being edited (needs categoryKey + label)
 * @param index     position, for the numbered badge on multi-service quotes
 * @param showIndex false on a single-service quote — numbering one thing "01"
 *                  is bureaucracy
 * @param subtotal  computed by the parent, which owns the pricing rules
 */
export default function ScopeGroupCard({
  group,
  index,
  showIndex,
  subtotal,
  onRemove,
  // The company's saved wording for this service (Settings > Services), or
  // null for the catalogue's defaults — see wordingOverrideFor in the builder.
  wordingOverride = null,
  t = null,
  children,
}) {
  // Same resolver as the PDF and the client-facing page, so the colour here is
  // the colour the client eventually sees against this work — and, since
  // 2026-09-15, the WORDS too. The estimator used to see only the name and
  // the lines on this card while the client got a scope paragraph and a
  // "what's included" list under that name; the review's "no description"
  // finding read as nonsense against a document that plainly had one. The
  // paragraph is shown here, folded, so what the client reads is in front of
  // the person writing it.
  const content = resolveServiceContent(group.categoryKey, wordingOverride, group.takeoff || null);
  const accent = content.accent;
  const [showWording, setShowWording] = useState(false);
  const hasWording = Boolean(content.description) || (content.included || []).length > 0;

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{ backgroundColor: `${accent}0f` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {showIndex && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
              style={{ backgroundColor: accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <h3 className="font-semibold text-foreground truncate">
            {group.label}
          </h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Only once there's a figure worth showing. A card reading $0.00
              while someone is still typing quantities is noise. */}
          {subtotal > 0 && (
            <span className="font-semibold tabular-nums text-foreground">
              {money(subtotal)}
            </span>
          )}
          {/* No handler, no button. An imported subcontractor cost and a quote
              the client has already decided are both groups this screen may not
              drop — rendering a bin that refuses is worse than not rendering
              one. */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-red-600 p-1 -mr-1"
              aria-label={`Remove ${group.label}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* What the client reads under this service's name — the same
          paragraph and list the PDF prints, resolved the same way. Folded by
          default: the estimator is here to price, not to reread the
          catalogue, but one tap shows why the review no longer calls a bare
          line "only a name". Edited in Settings > Services, never here — a
          quote-by-quote rewrite of a service's scope would put two different
          descriptions of the same trade in front of two clients. */}
      {hasWording && t && (
        <div className="px-5 pt-3 -mb-1" data-group-wording>
          <button
            type="button"
            onClick={() => setShowWording((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showWording}
          >
            <ChevronDown size={13} className={`transition-transform ${showWording ? "rotate-180" : ""}`} />
            {t("app.quoteNew.groupWordingToggle")}
          </button>
          {showWording && (
            <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-foreground space-y-2">
              {content.description && <p className="leading-relaxed">{content.description}</p>}
              {(content.included || []).length > 0 && (
                <ul className="space-y-1">
                  {content.included.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground/60 shrink-0">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground/80">
                {t("app.quoteNew.groupWordingWhere")}{" "}
                <Link href="/app/settings/services" className="underline">
                  {t("app.quoteNew.groupWordingLink")}
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}
