// app/app/error.js
//
// What staff see when a page in the back office throws.
//
// ── Why this file did not exist, and why that cost an afternoon ─────────────
//
// There was no error boundary anywhere in the app. Every render crash produced
// the framework's own "This page couldn't load. Reload to try again, or go
// back." — which names no page, no error, and nothing to act on, and is
// identical whether the cause is a missing import, a bad shape from an API, or
// a genuine bug in one component. Two separate crashes this month were
// diagnosed by reading source and guessing.
//
// This does three things that message could not: say WHAT broke, record it
// where support can find it, and let the person carry on working.
//
// It shows the real message rather than a friendly euphemism because the
// audience is the contractor's own staff, not their client. "Cannot read
// properties of undefined (reading 'map')" is not pretty, but somebody can
// paste it to us; "Something went wrong" cannot be pasted anywhere useful.
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AppError({ error, reset }) {
  const [reported, setReported] = useState(false);

  useEffect(() => {
    // Fire and forget. A logger that can fail inside an error boundary would
    // turn a handled crash into a blank screen — the same contract
    // lib/platform/errorLog.js keeps on the server.
    fetch("/api/app-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message || String(error),
        digest: error?.digest || null,
        stack: error?.stack || null,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    })
      .then(() => setReported(true))
      .catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto max-w-lg p-6 sm:p-10">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">
              This screen hit a problem
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing you were working on has been lost — this is the page
              failing to draw, not the data.
            </p>
          </div>
        </div>

        {/* The actual error. Staff-facing, and the only thing here that makes
            the difference between "it broke" and a fix. */}
        <pre className="mt-4 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
          {error?.message || String(error)}
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <RotateCw size={14} /> Try again
          </button>
          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground"
          >
            <ArrowLeft size={14} /> Back to the dashboard
          </Link>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {reported
            ? "We've been told about this automatically."
            : "Reporting this…"}
          {error?.digest ? ` Reference ${error.digest}.` : ""}
        </p>
      </div>
    </div>
  );
}
