// app/app/clients/ClientListRow.js
//
// One card of the clients list, in its own file so the card can be drawn
// outside the list — the /signup side panel renders this exact component
// against fixture clients rather than a hand-drawn lookalike. Presentational:
// no fetch, no router, no permission hook.
"use client";

import Link from "next/link";
import { Phone, MapPin, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param client  a GET /api/clients row: id, name, type ("company" | …),
 *                contactName, email, phone, city, province, address,
 *                _count { quotes, invoices }
 */
export default function ClientListRow({ client }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/app/clients/${client.id}`}
      className="bg-card border border-border rounded-xl p-5 hover:border-border hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate flex items-center gap-2">
            <span className="truncate">{client.name}</span>
            {client.type === "company" && (
              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full shrink-0">
                {t("app.clients.contractor")}
              </span>
            )}
          </div>
          {client.type === "company" && client.contactName ? (
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {client.contactName}
            </div>
          ) : (
            client.email && (
              <div className="text-sm text-muted-foreground truncate mt-0.5">
                {client.email}
              </div>
            )
          )}
        </div>
        <ArrowRight size={16} className="text-muted-foreground shrink-0" />
      </div>

      <div className="mt-3 space-y-1.5">
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone size={13} className="shrink-0" /> {client.phone}
          </div>
        )}
        {(client.city || client.address) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">
              {[client.city, client.province]
                .filter(Boolean)
                .join(", ") || client.address}
            </span>
          </div>
        )}
      </div>

      {/* Counted nouns, not "{n} quotes". These two were the last raw
          English on this card — a French office read "3 quotes" beside
          a translated everything-else — and the catalogue entries for
          them (app.clients.quoteCount / .invoiceCount) had been written
          and never wired up. countedNoun asks Intl.PluralRules, so
          "1 quote" and Ukrainian's three forms both come out right. */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <span>
          {t("app.clients.quoteCount", { value: client._count?.quotes ?? 0 })}
        </span>
        <span>
          {t("app.clients.invoiceCount", { value: client._count?.invoices ?? 0 })}
        </span>
      </div>
    </Link>
  );
}
