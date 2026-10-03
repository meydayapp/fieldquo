// app/app/quotes/drawings/new/page.js
//
// "Start from drawings" — creates an empty drawing read (free; nothing is
// read or charged until its own button) and opens it. `?lead=<id>` ties it to
// a lead: its name becomes the project's, its message the first draft of what
// the client wants, and the files filed on it reach the lead's quote.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function NewDrawingReadPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // Once, even under React's double-invoked effects in development: two
    // POSTs would leave an empty second read behind.
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    (async () => {
      try {
        const { id } = await fetchJson("/api/plan-reads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonBody({ leadId: params.get("lead") || null, clientId: params.get("client") || null }),
        });
        router.replace(`/app/quotes/drawings/${id}`);
      } catch (err) {
        setError(err?.message || t("app.planRead.createError", "Couldn't start a drawing read."));
      }
    })();
  }, [router, t]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {error ? (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-red-700 dark:text-red-300">{error}</div>
      ) : (
        <div className="h-40 rounded-xl bg-accent animate-pulse" aria-label={t("app.planRead.creating", "Starting…")} />
      )}
    </div>
  );
}
