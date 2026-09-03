"use client";

// app/components/sales/RepNoteUnavailable.js
//
// What both screens render when the table is not there.
//
// ══ Why a panel and not a disabled editor ══════════════════════════════════
//
// SalesRepNote is not in prisma/schema.prisma yet — lib/sales/notes/model.js
// explains why this was built against a named interface instead of adding it
// during a session with twelve agents on a file that has already been
// invalidated twice.
//
// The options for that state were: a compose box that 500s on the first
// keystroke, a greyed-out editor, or this. The first two are the same failure
// AGENTS.md opens with — a control that appears to work and doesn't — and the
// greyed-out one is worse, because it implies the feature is coming on
// somebody's schedule rather than blocked on one specific thing.
//
// So: no controls at all, and the exact missing thing named. A "Coming soon"
// panel is honest; a dead button is not.

import { Database } from "lucide-react";

export default function RepNoteUnavailable({ detail }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Database size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Notes aren&apos;t switched on yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {detail ||
              "The SalesRepNote table hasn't been created, so there is nowhere to put a note. Everything else — who can read them, how they save, how a clash is caught — is built and waiting on it."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The exact schema block to add is in the header of{" "}
            <code className="font-mono text-xs">lib/sales/notes/model.js</code>. Nothing is
            offered here in the meantime, because a compose box with nowhere to save
            would lose whatever was typed into it.
          </p>
        </div>
      </div>
    </div>
  );
}
