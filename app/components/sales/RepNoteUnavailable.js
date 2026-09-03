"use client";

// app/components/sales/RepNoteUnavailable.js
//
// What both screens render when there is nowhere to save a note.
//
// ══ Why a panel and not a disabled editor ══════════════════════════════════
//
// The options were: a compose box that 500s on the first keystroke, a
// greyed-out editor, or this. The first two are the same failure AGENTS.md
// opens with — a control that appears to work and doesn't — and the greyed-out
// one is worse, because it implies the feature is coming on somebody's
// schedule rather than blocked on one specific thing.
//
// ══ What this panel now means, which is NOT what it used to ════════════════
//
// It was written while `SalesRepNote` was deliberately absent from
// prisma/schema.prisma — lib/sales/notes/model.js explains why the feature was
// built against a named interface during a session with twelve agents on a
// contested file. **The model has since landed** (prisma/schema.prisma
// declares it), so on a correctly deployed environment this panel does not
// render at all.
//
// It is kept, and it is not dead code: `notesAvailable()` asks the PRISMA
// CLIENT, not the schema file, so a deployment whose client was generated
// before the model landed still reaches this. That is a real state with a real
// fix, and it is a different fix from the one this panel used to name — so the
// wording changed with it. Telling somebody to add a schema block that is
// already there is exactly the stale instruction AGENTS.md asks be corrected
// rather than left standing.
//
// The `detail` prop carries the server's own sentence and is what normally
// shows; lib/sales/notes/model.js's NOTES_UNAVAILABLE still describes the old
// state and is out of this brief's scope. It is named in the report.

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
              "This deployment can't see the SalesRepNote table, so there is nowhere to put a note. Everything else — who can read them, how they save, how a clash is caught — is built and waiting on it."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The model is declared in{" "}
            <code className="font-mono text-xs">prisma/schema.prisma</code>, so this is a
            deployment that needs its Prisma client regenerating rather than a schema that
            needs writing. Nothing is offered here in the meantime, because a compose box
            with nowhere to save would lose whatever was typed into it.
          </p>
        </div>
      </div>
    </div>
  );
}
