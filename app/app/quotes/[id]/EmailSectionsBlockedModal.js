// app/app/quotes/[id]/EmailSectionsBlockedModal.js
//
// What the person sees when a send is refused for an empty section.
//
// ── Why a dialog with two buttons and not an error banner ──────────────────
//
// The refusal is correct — a heading over a blank space must not reach a
// homeowner — but a refusal on its own leaves someone holding a quote they
// need to get out and a sentence about a section they may not remember
// switching on. The two ways forward are the whole point of stopping:
//
//   Add the content   → the settings screen, in a new tab, because the quote
//                       they were sending is still open behind this and losing
//                       it to a navigation would be its own small betrayal.
//   Leave it out      → PATCHes THIS quote only. The company setting is
//                       untouched: someone who meant to collect references and
//                       hasn't yet should not lose the intention because one
//                       quote went out in a hurry.
//
// ── Why the retry is a button and not automatic ────────────────────────────
//
// They did confirm the send, so re-sending the moment the last blocker clears
// would arguably be what they asked for. It is still a message to a stranger
// under the company's name going out on a click that was aimed at something
// else. One more press, deliberately.
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param blocked   the `blocked` array from the send route's 409:
 *                  [{ key, labelKey, emptyKey, actions: { fill, remove } }]
 * @param onCleared called after a section is removed, with the sections still
 *                  blocking. Empty array means the send can be retried.
 * @param onRetry   fires the send again.
 */
export default function EmailSectionsBlockedModal({
  isOpen,
  blocked = [],
  quoteId,
  onClose,
  onCleared,
  onRetry,
  sending = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function remove(section) {
    setBusy(section.key);
    setError("");
    try {
      // The body comes from the server's own `sectionActions()`, so this
      // dialog carries no copy of which column a section writes to.
      const action = section.actions?.remove;
      const result = await fetchJson(
        action?.href || `/api/quotes/${quoteId}/email-sections`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: jsonBody(action?.body || {}, "section change"),
        },
      );
      onCleared?.(result.blocked || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const clear = blocked.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-card border border-border w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">
              {clear
                ? t("app.quoteEmail.blockedClearedTitle")
                : t("app.quoteEmail.blockedTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {clear
                ? t("app.quoteEmail.blockedClearedBody")
                : t("app.quoteEmail.blockedBody")}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {blocked.map((section) => (
          <div
            key={section.key}
            className="border border-border rounded-lg p-3 space-y-2"
          >
            <div className="text-sm font-medium text-foreground">
              {t(section.labelKey)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(section.emptyKey)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={section.actions?.fill?.href || "/app/settings/quote-email"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-inverted text-inverted-foreground font-medium"
              >
                {t("app.quoteEmail.fillAction")}
                <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                onClick={() => remove(section)}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-foreground disabled:opacity-50"
              >
                {busy === section.key && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {t("app.quoteEmail.removeAction")}
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-border text-foreground"
          >
            {t("app.common.cancel", "Cancel")}
          </button>
          {clear && (
            <button
              type="button"
              onClick={onRetry}
              disabled={sending}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-inverted text-inverted-foreground font-medium disabled:opacity-50"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {t("app.quoteEmail.retrySend")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
