"use client";

// app/components/dashboard/AwaitingPayment.js
//
// The one screen where a booking that hasn't been paid for is visible.
//
// A paid booking type holds the slot with a `pending_payment` row and no
// Appointment, so it appears on no calendar — which is correct, an unpaid visit
// must not reach the crew. What was NOT correct is that it appeared nowhere
// else either. A homeowner who chose a time and went to Stripe existed on no
// screen in the product; when the payment failed to be recorded, the contractor
// had no way of even knowing someone had tried.
//
// Renders itself away when there is nothing to show, so it is never a dead
// panel on the dashboard of a company that doesn't charge visit fees.

import { useState, useEffect, useCallback } from "react";
import { Clock, AlertCircle, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

function money(cents, currency) {
  if (cents == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)}`;
  }
}

export default function AwaitingPayment() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [currency, setCurrency] = useState("CAD");
  // Whether THIS member may press Check — decided by the server, which is the
  // only party that knows the role and the only one that enforces it.
  const [canCheck, setCanCheck] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checking, setChecking] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/bookings/awaiting-payment");
      setRows(Array.isArray(data?.bookings) ? data.bookings : []);
      setCurrency(data?.currency || "CAD");
      setCanCheck(Boolean(data?.canCheck));
    } catch {
      // A dashboard panel that cannot load is not worth an error banner across
      // the page — it renders away, same as having nothing to show.
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function check(bookingId) {
    setChecking(bookingId);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/bookings/awaiting-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) {
        // Never a silent `if (res.ok)` with no else — the whole point of this
        // panel is that a failure to find out is itself information.
        await reportResponseError(res, setError, t("app.booking.checkFailed"));
        return;
      }
      const { result } = await res.json();
      if (result?.action === "settled") {
        setNote(t("app.booking.checkSettled"));
      } else if (result?.action === "already_settled") {
        setNote(t("app.booking.checkAlready"));
      } else if (result?.action === "error") {
        setError(t("app.booking.checkUnreachable"));
      } else {
        setNote(t("app.booking.checkNoPayment"));
      }
      await load();
    } finally {
      setChecking(null);
    }
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Clock size={16} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground">
          {t("app.booking.awaitingPaymentTitle")}
        </h2>
      </div>

      <p className="px-5 pt-3 text-xs text-muted-foreground">
        {t("app.booking.awaitingPaymentBody")}
      </p>

      {error && (
        <p className="mx-5 mt-3 text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {note && <p className="mx-5 mt-3 text-xs text-muted-foreground">{note}</p>}

      <div className="divide-y divide-border mt-3">
        {rows.map((b) => {
          const lapsed = b.status === "cancelled";
          const asked = money(b.feeCents, currency);
          const took = money(b.feePaidCents, b.feeCurrency || currency);
          return (
            <div key={b.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {b.clientName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(b.startTime).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {b.eventTypeName ? ` · ${b.eventTypeName}` : ""}
                </div>
                <div className="text-xs mt-1 text-muted-foreground">
                  {lapsed
                    ? t("app.booking.paymentNotCompleted")
                    : t("app.booking.awaitingFee", { amount: asked || "" })}
                  {/* Shown only when money really was taken. Absence of a figure
                      means we have no record of one, not a fee of zero. */}
                  {took ? ` · ${t("app.booking.feeTaken", { amount: took })}` : ""}
                </div>
                {b.clientEmail && (
                  <div className="text-xs text-muted-foreground truncate">{b.clientEmail}</div>
                )}
              </div>
              {canCheck && !lapsed && (
                <button
                  type="button"
                  onClick={() => check(b.id)}
                  disabled={checking === b.id}
                  className="shrink-0 text-xs font-semibold border border-border rounded-full px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw
                    size={12}
                    className={checking === b.id ? "animate-spin" : undefined}
                  />
                  {t("app.booking.checkPayment")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
