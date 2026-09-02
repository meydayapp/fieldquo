// app/sales/threads/page.js
//
// Every conversation this rep is having, newest activity first.
//
// The list exists because a rep's day is organised by "who wrote back", not by
// "which lead did I click". The lead screen is the other view of the same rows.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import OutreachNotice from "../leads/OutreachNotice";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SalesThreadsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/sales/threads"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const threads = data?.threads;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mail size={20} className="text-muted-foreground" />
          Conversations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sent from your own mailbox, kept here against the prospect.
        </p>
      </div>

      <OutreachNotice outreach={data?.outreach} />

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {threads === undefined && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      )}

      {threads && threads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Open a lead and write the first email.
        </p>
      )}

      {threads && threads.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {threads.map((t) => {
            const last = t.messages[0];
            return (
              <Link
                key={t.id}
                href={`/sales/threads/${t.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
              >
                {last?.direction === "in" ? (
                  <ArrowDownLeft size={15} className="mt-1 text-green-700 dark:text-green-300 shrink-0" />
                ) : (
                  <ArrowUpRight size={15} className="mt-1 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.lead?.businessName} · {t._count?.messages} message
                    {t._count?.messages === 1 ? "" : "s"} · {when(t.lastMessageAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
