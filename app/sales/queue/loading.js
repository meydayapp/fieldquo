// app/sales/queue/loading.js
//
// The queue's loading boundary — and why a dynamic route needs one.
//
// /sales is a dynamic route (the layout reads the session cookie and the
// rep's language from the database), and a dynamic route WITHOUT a
// loading.js is not prefetched and does not transition until the server has
// rendered it: the rep presses "Queue" on the Messages page and nothing
// moves until the page function has answered — a cold function, five to
// ten seconds on 2026-09-17 by the owner's watch. With this file Next
// prefetches the shell and this fallback when the nav link is on screen,
// swaps to it the instant the link is pressed, and streams the console in
// behind it. The console itself then draws from the tab's last payload
// (lib/sales/queueCache.js) before its first request leaves.
//
// The same sentence the console's own Suspense fallback says, so a rep sees
// one message once rather than two in a row.
"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-muted-foreground" data-queue-loading>
      <Loader2 className="animate-spin" size={18} /> {t("app.salesQueue.openingConsole")}
    </div>
  );
}
