// app/components/sales/CallbacksStrip.js
//
// The call-backs a rep promised, with the button that keeps them.
//
// ══ Why it exists ═════════════════════════════════════════════════════════
//
// "Call back at three" wrote a time to the attempt row and to the retry pool
// and then had no surface of its own: the console's Tasks tab listed the
// call-backs of the business ON SCREEN, as text, and once the rep moved to
// the next row there was no list and no way back but the queue's rotation.
// The owner watched a rep log a call-back and have nothing to press.
//
// This is that list — the rep's own promises, soonest first, the due ones
// flagged — and "Call now", which loads that business into the console and
// rings it through the ONE dial path the queue's Call button uses
// (app/sales/queue/page.js callNow → select → dialNumber → CallPanel
// place("browser")). Nothing here dials; a second dialler is AGENTS.md
// failure class 4 aimed at a live phone.
//
// ══ No dead buttons ═══════════════════════════════════════════════════════
//
// The route (lib/sales/calls/store.js promisedCallbacks) says per row whether
// the console CAN dial it: `held` is true only while the prospect is still
// this rep's, and "Call now" is drawn only then. A promise on the rep's own
// lead links to the lead page, where that phone is. A promise on a typed
// number shows the number and nothing to press.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Phone } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const DUE = "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200";
const LATER = "border-border bg-card text-foreground";

function whenLabel(iso, language) {
  try {
    return new Intl.DateTimeFormat(language || undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return String(iso || "");
  }
}

/**
 * The promises, read from GET /api/sales/calls/callbacks. Re-read whenever
 * `refreshKey` changes — the queue bumps it after every outcome, so a
 * call-back just logged appears and one just kept disappears.
 *
 * @returns {{ items: object[]|null, due: number, error: string, reload }}
 */
export function usePromisedCallbacks({ refreshKey = 0 } = {}) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const body = await fetchJson("/api/sales/calls/callbacks");
      setItems(Array.isArray(body?.items) ? body.items : []);
      setError("");
    } catch (err) {
      setError(err?.message || t("app.salesCall.callbacks.loadFailed"));
    }
    // `t` changes only with the language; the sentence is re-read then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    reload();
  }, [reload, refreshKey]);
  const due = Array.isArray(items) ? items.filter((i) => i.due).length : 0;
  return { items, due, error, reload };
}

/**
 * @param items      from usePromisedCallbacks — null while loading.
 * @param onCallNow  called with the row; the host loads the business and
 *                   dials. Drawn only on rows the route marked `held`.
 * @param dialling   the attempt id being loaded and dialled right now, so
 *                   its button shows a spinner and the rest stay pressable.
 */
export default function CallbacksStrip({ items, error = "", onRetry = null, onCallNow, dialling = null, currentProspectId = null }) {
  const { t, language } = useTranslation();
  const rows = Array.isArray(items) ? items : null;

  // Nothing promised: nothing drawn. A permanent empty card on every rep's
  // dialler column is noise; the Tasks tab already says "none" in place.
  if (rows && rows.length === 0 && !error) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" data-callbacks-strip={rows ? rows.length : "loading"}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarClock size={16} className="text-brand-accent-text" aria-hidden="true" />
          {t("app.salesCall.callbacks.title")}
        </h2>
        {rows && rows.some((r) => r.due) ? (
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${DUE}`} data-callbacks-due={rows.filter((r) => r.due).length}>
            {t("app.salesCall.callbacks.dueCount", { count: rows.filter((r) => r.due).length })}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="text-sm text-amber-900 dark:text-amber-200 space-y-2" role="alert">
          <p className="break-words">{error}</p>
          {onRetry ? (
            <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={onRetry}>
              {t("app.salesCall.callbacks.tryAgain")}
            </button>
          ) : null}
        </div>
      ) : !rows ? (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t("app.salesCall.callbacks.loading")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const busy = dialling === row.id;
            const isCurrent = Boolean(currentProspectId) && row.prospectId === currentProspectId;
            return (
              <li
                key={row.id}
                className={`rounded-lg border p-2.5 text-sm space-y-1.5 ${row.due ? DUE : LATER}`}
                data-callback-row={row.id}
                data-callback-due={row.due ? "yes" : "no"}
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{row.businessName || row.toE164}</p>
                  <p className="text-xs break-words">
                    {row.businessName ? `${row.toE164} · ` : ""}
                    {t("app.salesQueue.tasksCallbackAt", { when: whenLabel(row.callbackAt, language) })}
                    {row.due ? ` · ${t("app.salesQueue.tasksOverdue")}` : ""}
                  </p>
                  {row.note ? <p className="text-xs break-words">“{row.note}”</p> : null}
                  {/* A promise another rep made, handed to this one because
                      they were off at the hour (callbackAgenda.js). Said,
                      so a name the rep never rang is not a mystery. */}
                  {row.handedOver ? (
                    <p className="text-xs font-medium break-words" data-callback-handed-over>
                      {t("app.salesCall.callbacks.handedOver", { rep: row.promisedBy || "—" })}
                    </p>
                  ) : null}
                </div>
                {row.held && row.prospectId ? (
                  <button
                    type="button"
                    className={`${BTN} w-full bg-emerald-600 text-white`}
                    onClick={() => onCallNow?.(row)}
                    disabled={Boolean(dialling)}
                    data-callback-call-now={row.id}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}
                    {isCurrent ? t("app.salesCall.callbacks.callNow") : t("app.salesCall.callbacks.loadAndCall")}
                  </button>
                ) : row.leadId ? (
                  <Link href={`/sales/leads/${encodeURIComponent(row.leadId)}`} className={`${BTN} w-full border border-border bg-card text-foreground`} data-callback-open-lead={row.leadId}>
                    <Phone size={16} aria-hidden="true" /> {t("app.salesCall.callbacks.openLead")}
                  </Link>
                ) : (
                  // Not this rep's any more (the claim lapsed) or a typed
                  // number with no record: the promise is shown, and the
                  // reason there is no button is said.
                  <p className="text-xs text-muted-foreground break-words" data-callback-no-button>
                    {row.prospectId ? t("app.salesCall.callbacks.notHeld") : t("app.salesCall.callbacks.noRecord")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
