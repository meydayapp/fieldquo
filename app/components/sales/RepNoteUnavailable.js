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
// The `detail` prop carries the server's own sentence. It arrives with a
// `code` beside it — NOTES_UNAVAILABLE has always carried one — and the code
// is what this panel now looks the sentence up by, so the one refusal a rep
// sees when a note will not save is in their own language rather than in
// lib/sales/notes/model.js's English. The English is the fallback.

import { Database } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { NOTES_REFUSAL_KEYS } from "@/lib/sales/notes/model";

/** The path this panel names. Not copy — it is a filename, in every language. */
const SCHEMA_FILE = "prisma/schema.prisma";

export default function RepNoteUnavailable({ detail, code = null }) {
  const { t } = useTranslation();
  // The server's code names the sentence; the server's English is what shows
  // if this build's catalogue has not got it yet, and this screen's own words
  // are what show if no server sentence arrived at all.
  const refusalKey = code ? NOTES_REFUSAL_KEYS[code] || null : null;

  // One key for the whole sentence, split on its own placeholder at render
  // time so the filename can keep its <code> styling. The obvious
  // alternative — a key for the words before the path and another for the
  // words after — is the fragment assembly this catalogue's rules forbid, and
  // it would put the path in the English position in every language.
  const [beforeFile, afterFile = ""] = t("app.salesNotes.unavailableFix").split("{file}");

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Database size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.salesNotes.unavailableHeading")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {/* Resolution order, most specific first: the catalogue entry the
                server's own code names, then the server's English sentence,
                then this screen's own words. */}
            {refusalKey
              ? t(refusalKey, detail || t("app.salesNotes.unavailableDetail"))
              : detail || t("app.salesNotes.unavailableDetail")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {beforeFile}
            <code className="font-mono text-xs">{SCHEMA_FILE}</code>
            {afterFile}
          </p>
        </div>
      </div>
    </div>
  );
}
