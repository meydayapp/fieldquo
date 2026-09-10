"use client";

// app/components/sales/RepNoteVisibilityNotice.js
//
// The sentence a rep reads before they type anything.
//
// ══ Why this is a component and not a line of JSX on the page ══════════════
//
// Because there are two screens that compose a note — the index, which starts
// one, and the editor, which continues it — and a promise about privacy that
// appears on one of them and not the other is worse than one that appears on
// neither. A rep who learns the rule on Tuesday and does not see it on
// Wednesday reasonably assumes Wednesday's screen is different.
//
// ══ Why the strings come from lib and not from the API ═════════════════════
//
// lib/sales/notes/visibility.js has no imports, so it is safe to pull straight
// into the browser bundle, and pulling it straight in means the notice cannot
// fail to render. If this arrived in the list payload, a rep on a bad
// connection in a driveway — the exact person this product is written for —
// would get a compose box with no statement above it, and would have been told
// nothing at all about who reads what they are about to write.
//
// scripts/check-rep-notes.mjs asserts the import, and asserts that both screens
// render this component.
//
// ══ Why the lib constant is still here now that this is translated ═════════
//
// Each of these four sentences is a t() key WITH the lib constant passed as
// its fallback, rather than a key alone. Two reasons, and the second is the
// load-bearing one:
//
//   * The English in the catalogue and the English in lib/sales/notes/ cannot
//     drift into two different promises about who reads a rep's notes — the
//     lib one is what the platform screen and the checks read, and it stays
//     the source it always was.
//   * A privacy statement must never fail to appear. The fallback chain is
//     rep's language → English catalogue → this constant, so even a catalogue
//     that lost the key still renders the sentence rather than a key name.
//
// The translations are literal on purpose. A visibility rule that is close
// enough in another language is worse than one left in English.

import { Eye } from "lucide-react";
import { VISIBILITY_NOTICE } from "@/lib/sales/notes/visibility";
import { RETENTION } from "@/lib/sales/notes/model";
import { EDITOR } from "@/lib/sales/notes/body";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object}  props
 * @param {boolean} [props.showEditorNote] also say what the editor is. On the
 *                  editor screen, where somebody is looking at a textarea and
 *                  wondering where the formatting went; not on the index,
 *                  where it would be noise.
 */
export default function RepNoteVisibilityNotice({ showEditorNote = false }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4 text-sm">
      <div className="flex items-start gap-2">
        {/* An icon that says "someone is looking", not a padlock. A padlock
            would say the opposite of what the sentence beside it says. */}
        <Eye size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {t("app.salesNotes.visibilityHeadline", VISIBILITY_NOTICE.headline)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("app.salesNotes.visibilityDetail", VISIBILITY_NOTICE.detail)}
          </p>

          {showEditorNote && (
            <p className="mt-2 text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("app.salesNotes.editorKindLabel", EDITOR.label)}.{" "}
              </span>
              {t("app.salesNotes.editorKindWhy", EDITOR.why)}
            </p>
          )}

          {/* Retention, stated because a note holds a stranger's personal
              information and "we have not decided yet" is a real answer that
              somebody has to be able to read. See RETENTION in
              lib/sales/notes/model.js for why it is not built. */}
          {!RETENTION.applied && (
            <p className="mt-2 text-muted-foreground">
              {t("app.salesNotes.retentionStatement", RETENTION.statement)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
