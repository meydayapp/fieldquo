"use client";

// app/components/tickets/OpenTicketsLink.js
//
// "2 open client tickets →" on a client's page and a job's page. Asks
// GET /api/client-tickets?count=1 for exactly that client or job; draws
// nothing at zero (there is nothing to go to) and nothing for a member the
// route would refuse (requests: view_only). A failed count draws nothing
// rather than a zero that might be false.

import { useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";

export default function OpenTicketsLink({ clientId = null, jobId = null }) {
  const { t } = useTranslation();
  const canRead = useHasLevel("requests", "view_only");
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!canRead || (!clientId && !jobId)) return;
    const q = new URLSearchParams({ count: "1", ...(clientId ? { clientId } : {}), ...(jobId ? { jobId } : {}) });
    let alive = true;
    fetch(`/api/client-tickets?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && typeof d?.open === "number") setCount(d.open);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canRead, clientId, jobId]);

  if (!canRead || !count) return null;
  return (
    <Link
      href="/app/tickets"
      data-open-tickets={count}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300"
    >
      <LifeBuoy size={14} />
      {t("app.clientTickets.openCount", "{count} open client tickets", { count })}
    </Link>
  );
}
