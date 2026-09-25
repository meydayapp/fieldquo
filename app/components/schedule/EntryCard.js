// app/components/schedule/EntryCard.js
//
// One calendar entry as a compact card — the Cards view of /app/appointments,
// drawn the way the leads board draws a lead (app/app/leads/page.js LeadCard):
// who, what, when, where, and a status chip, with the whole card one button
// that opens the side panel (EntryPanel). The facts come from
// lib/schedule/entryCard.js, which is where permissions shaped them; this file
// only draws.
//
// A button rather than a div with onClick: it is reachable by keyboard, it
// announces as something that opens, and it holds no links of its own — a
// link inside a button is neither, which is why call/directions/open-quote
// live in the panel and not here.
"use client";

import { MapPin, User as UserIcon, Clock } from "lucide-react";
import { localeDateTime } from "@/lib/calendar/monthGrid";
import {
  appointmentStatusClasses,
  appointmentStatusLabel,
} from "@/lib/appointments/statusLabels";

/** "9:00 AM – 11:30 AM", or just the start when the end is not known. */
export function cardTimeText(card, language) {
  if (!card?.start) return "";
  const fmt = { hour: "numeric", minute: "2-digit" };
  const start = localeDateTime(card.start, language, fmt);
  return card.end ? `${start} – ${localeDateTime(card.end, language, fmt)}` : start;
}

const KIND_TONE = {
  visit: "border-l-purple-400 dark:border-l-purple-500",
  booking: "border-l-teal-400 dark:border-l-teal-500",
  appointment: "border-l-sky-400 dark:border-l-sky-500",
};

export default function EntryCard({ card, serviceText, onOpen, t, language, active = false }) {
  if (!card) return null;
  const cancelled = card.status === "cancelled" || card.status === "canceled";
  return (
    <button
      type="button"
      onClick={() => onOpen(card.key)}
      aria-haspopup="dialog"
      data-entry-card={card.key}
      className={`w-full text-left bg-card border border-border border-l-4 ${KIND_TONE[card.kind] || KIND_TONE.appointment} rounded-lg px-3 py-2.5 shadow-sm hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
        active ? "ring-2 ring-ring" : ""
      } ${cancelled ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground tabular-nums">
          <Clock size={11} className="text-muted-foreground shrink-0" aria-hidden="true" />
          {cardTimeText(card, language)}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${appointmentStatusClasses(card.status)}`}
        >
          {appointmentStatusLabel(card.status, t)}
        </span>
      </div>
      <div className={`mt-1 text-sm font-semibold text-foreground truncate ${cancelled ? "line-through" : ""}`}>
        {card.clientName || t("app.entryCard.noClient", "No client named")}
      </div>
      {serviceText && (
        <div className="text-xs text-muted-foreground truncate">{serviceText}</div>
      )}
      {(card.addressShort || card.assignedName) && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
          {card.addressShort && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin size={10} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{card.addressShort}</span>
            </span>
          )}
          {card.assignedName && (
            <span className="inline-flex items-center gap-1 shrink-0 ml-auto">
              <UserIcon size={10} aria-hidden="true" />
              {card.assignedName.split(" ")[0]}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
