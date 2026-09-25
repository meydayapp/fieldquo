// app/components/schedule/EntryPanel.js
//
// The side panel a calendar card opens (EntryCard, Cards view of
// /app/appointments): everything a dispatcher or a crew member does next with
// one entry, without leaving the week —
//
//   * go to it: the quote, the job, the invoice, the client (each offered only
//     when lib/schedule/entryCard.js kept it — i.e. this viewer may open that
//     page);
//   * reach it: call the client, get directions (DirectionsButtons, the job
//     page's own component, so "directions" means the same thing on both);
//   * change it: reschedule / cancel / complete through EntryActions, the one
//     set of controls the list rows already use, offered on the same
//     mayActOnEntry answer the list asks.
//
// A drawer from the right like the lead drawer (app/app/leads/page.js
// LeadDrawer), dismissed by the backdrop, the close button or Escape.
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  X,
  Phone,
  FileText,
  Briefcase,
  Receipt,
  User as UserIcon,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { localeDateTime } from "@/lib/calendar/monthGrid";
import {
  appointmentStatusClasses,
  appointmentStatusLabel,
} from "@/lib/appointments/statusLabels";
import { bookingModeLine } from "@/lib/booking/bookingModes";
import DirectionsButtons from "@/app/components/jobs/DirectionsButtons";
import EntryActions from "@/app/components/schedule/EntryActions";
import { cardTimeText } from "@/app/components/schedule/EntryCard";

const LINK =
  "inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent";

function kindLabel(kind, t) {
  if (kind === "visit") return t("app.appts.jobVisit");
  if (kind === "booking") return t("app.appts.clientBooking");
  return t("app.entryPanel.appointment", "Appointment");
}

/**
 * @param entry        the raw feed row (EntryActions needs its own fields)
 * @param card         entryCard(entry, access) — what may be shown and linked
 * @param serviceText  what it is for, already translated by the page
 * @param canAct       mayActOnEntry(entry, …)
 */
export default function EntryPanel({ entry, card, serviceText, canAct, onClose, onChanged, t, language }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!entry || !card) return null;

  const dateText = card.start
    ? localeDateTime(card.start, language, { weekday: "long", month: "long", day: "numeric" })
    : "";
  const modeLine =
    card.mode && card.mode !== "visit"
      ? bookingModeLine({ mode: card.mode, phone: card.phone, email: entry.client?.email, language })
      : null;
  const { quote, job, invoice, client } = card.links;
  const anyLink = quote || job || invoice || client;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="entry-panel-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <span className="text-sm font-semibold text-foreground">{kindLabel(card.kind, t)}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("app.action.close")}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 id="entry-panel-title" className="text-lg font-bold text-foreground break-words">
                {card.clientName || t("app.entryCard.noClient", "No client named")}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 mt-1 ${appointmentStatusClasses(card.status)}`}>
                {appointmentStatusLabel(card.status, t)}
              </span>
            </div>
            {serviceText && <p className="text-sm text-muted-foreground mt-0.5">{serviceText}</p>}
            <p className="text-sm text-foreground mt-2">
              {dateText}
              {dateText && " · "}
              <span className="tabular-nums">{cardTimeText(card, language)}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <UserIcon size={13} aria-hidden="true" />
              {card.assignedName || t("app.appts.unassigned")}
            </p>
            {card.requiresSupervisor && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                <ShieldAlert size={12} aria-hidden="true" />
                {t("app.appts.supervisorRequired")}
              </p>
            )}
            {card.clientRestricted && (
              <p className="text-xs text-muted-foreground italic mt-1">
                {t("app.access.restricted", "Hidden by your access level")}
              </p>
            )}
          </div>

          {/* Reach them: ring, or drive. */}
          {(card.phone || card.address || modeLine) && (
            <div className="space-y-2">
              {card.address && (
                <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                  <MapPin size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{card.address}</span>
                </p>
              )}
              {modeLine && <p className="text-sm text-muted-foreground">{modeLine}</p>}
              <div className="flex flex-wrap gap-2">
                {card.phone && (
                  <a href={`tel:${card.phone}`} className={LINK}>
                    <Phone size={16} aria-hidden="true" />
                    {t("app.entryPanel.call", { phone: card.phone })}
                  </a>
                )}
                {card.address && <DirectionsButtons address={card.address} t={t} />}
              </div>
            </div>
          )}

          {/* Go to it. */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("app.entryPanel.goTo", "Go to")}
            </div>
            {anyLink ? (
              <div className="flex flex-wrap gap-2">
                {quote && (
                  <Link href={`/app/quotes/${encodeURIComponent(quote.id)}`} className={LINK}>
                    <FileText size={16} aria-hidden="true" />
                    {quote.ref
                      ? t("app.entryPanel.openQuoteRef", { ref: quote.ref })
                      : t("app.entryPanel.openQuote", "Open quote")}
                  </Link>
                )}
                {job && (
                  <Link href={`/app/jobs/${encodeURIComponent(job.id)}`} className={LINK}>
                    <Briefcase size={16} aria-hidden="true" />
                    {t("app.appts.openJob")}
                  </Link>
                )}
                {invoice && (
                  <Link href={`/app/invoices/${encodeURIComponent(invoice.id)}`} className={LINK}>
                    <Receipt size={16} aria-hidden="true" />
                    {invoice.ref
                      ? t("app.entryPanel.openInvoiceRef", { ref: invoice.ref })
                      : t("app.entryPanel.openInvoice", "Open invoice")}
                  </Link>
                )}
                {client && (
                  <Link href={`/app/clients/${encodeURIComponent(client.id)}`} className={LINK}>
                    <UserIcon size={16} aria-hidden="true" />
                    {t("app.entryPanel.openClient", "Open client")}
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("app.entryPanel.noLinks", "Nothing linked to this entry that you can open.")}
              </p>
            )}
          </div>

          {/* Change it — the list rows' own controls, on the list's own rule. */}
          {canAct && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.entryPanel.change", "Change")}
              </div>
              <EntryActions
                kind={card.kind === "visit" ? "visit" : "appointment"}
                id={entry.id}
                jobId={entry.jobId}
                status={entry.status}
                scheduledAt={entry.scheduledAt}
                // Same client shape the list hands each kind: a visit's feed
                // row carries a name and an address and no email key.
                client={card.kind === "visit" ? { name: entry.client?.name || null } : entry.client || null}
                onChanged={onChanged}
              />
            </div>
          )}
          {card.cancelReason && card.status === "cancelled" && (
            <p className="text-xs text-muted-foreground">
              {t("app.visitAction.cancelledWhy", { reason: card.cancelReason })}
            </p>
          )}

          {card.notes && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.entryPanel.notes", "Notes")}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{card.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
