"use client";

// app/app/tickets/page.js
//
// Client tickets — what clients raised from their portal: repairs, warranty
// claims, questions, billing queries, reschedule requests, maintenance visits
// to book. Open work first; each row opens the conversation.
//
// Fed by GET /api/client-tickets (company-scoped by the session). Reached from
// More › Work, the notification a new ticket raises, and the count on a
// client's or job's page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy, ArrowRight, MessageSquare } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TYPE_KEYS, STATUS_KEYS, STATUS_CLASSES, PRIORITY_KEYS, label } from "@/app/components/tickets/ticketLabels";

const FILTERS = ["open", "in_progress", "waiting_on_client", "resolved", "closed", "all"];

export default function ClientTicketsPage() {
  const { t, language } = useTranslation();
  const [filter, setFilter] = useState("open");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchList(`/api/client-tickets?status=${filter}`);
    if (result.aborted) return;
    if (result.ok) setData(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const tickets = data?.tickets ?? null;
  const counts = data?.counts || {};
  const openCount = (counts.open || 0) + (counts.in_progress || 0) + (counts.waiting_on_client || 0);
  const when = (d) => {
    try {
      return new Date(d).toLocaleDateString(language, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.clientTickets.title", "Client tickets")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.clientTickets.subtitle", "Issues and requests your clients raised from their portal. Replies are emailed to them from your company.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => {
          const n = f === "open" ? openCount : f === "all" ? null : counts[f] || 0;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold border ${
                filter === f ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? t("app.clientTickets.filter.all", "All") : f === "open" ? t("app.clientTickets.filter.open", "Open") : label(t, STATUS_KEYS[f])}
              {n != null && <span className="ml-1.5 tabular-nums opacity-80">{n}</span>}
            </button>
          );
        })}
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={tickets !== null && tickets.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <LifeBuoy size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{t("app.clientTickets.emptyTitle", "Nothing waiting")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("app.clientTickets.emptyBody", "When a client reports an issue or asks for a visit from their portal, it lands here.")}
            </p>
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {(tickets ?? []).map((tk) => (
            <Link key={tk.id} href={`/app/tickets/${tk.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/50" data-ticket-row={tk.id}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[tk.status] || STATUS_CLASSES.closed}`}>
                    {label(t, STATUS_KEYS[tk.status])}
                  </span>
                  <span className="text-xs text-muted-foreground">{label(t, TYPE_KEYS[tk.type])}</span>
                  {(tk.priority === "high" || tk.priority === "urgent") && (
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">{label(t, PRIORITY_KEYS[tk.priority])}</span>
                  )}
                </div>
                <p className="font-semibold text-foreground mt-1 truncate">{tk.subject}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tk.client?.name}
                  {" · "}
                  {tk.assignee ? tk.assignee : t("app.clientTickets.unassigned", "Unassigned")}
                </p>
              </div>
              <div className="text-right shrink-0 text-xs text-muted-foreground">
                <div>{when(tk.updatedAt)}</div>
                {tk._count?.messages > 0 && (
                  <div className="inline-flex items-center gap-1 mt-1">
                    <MessageSquare size={12} /> {tk._count.messages}
                  </div>
                )}
                <ArrowRight size={16} className="inline-block mt-2" />
              </div>
            </Link>
          ))}
        </div>
      </ListState>
    </div>
  );
}
