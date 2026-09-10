// app/sales/messages/CheckInDraft.js
//
// A check-in sitting in the conversation, written and NOT sent.
//
// ══ The whole point is that it does not look like a message ════════════════
//
// It sits where a message would sit, in the same thread, aligned the way an
// outbound message is aligned — because that is where the rep will look for
// it and because it shows them what the contractor would see. Everything else
// about it is different on purpose: a dashed edge instead of a filled bubble,
// a DRAFT badge, the reason it exists written above it, and a send button
// attached. A rep glancing at this thread must never wonder whether it went.
//
// ══ Two shapes, one component ══════════════════════════════════════════════
//
//   SUGGESTION  lib/sales/checkin/signals.js says this company is due, and
//               nothing is stored yet. The wording shown is the deterministic
//               one — free, no model — and pressing "Draft this" is what
//               spends anything. See lib/sales/checkin/store.js for why the
//               model is not asked while a page merely renders.
//
//   DRAFT       a stored row. Editable, reschedulable, sendable, dismissable.
//
// Written as one component rather than two because they are the same object at
// two ages, and the version that would rot is the copy — AGENTS.md failure
// class #4. The differences are three conditionals, all of them visible here.
"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Loader2, PencilLine, Send, Sparkles, X } from "lucide-react";
import { scheduleLabel } from "./MessageThread";

const BTN =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/**
 * A Date → the string `<input type="datetime-local">` wants.
 *
 * Built from the LOCAL parts rather than from toISOString().slice(0,16), which
 * is UTC and would show a rep in Vancouver a time eight hours out. The input
 * has no zone of its own; it means the browser's, so it must be filled in the
 * browser's.
 */
function toLocalInput(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CheckInDraft({
  draft,
  suggestion = false,
  busy = false,
  error = "",
  canSend = true,
  onAdopt = null,
  onDismiss = null,
  onSaveText = null,
  onReschedule = null,
  onSend = null,
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.draftText || draft.text || "");
  const [picking, setPicking] = useState(false);
  const [when, setWhen] = useState(toLocalInput(draft.scheduledFor));
  const editorRef = useRef(null);

  // The server is the source of truth for the wording: after a save, a send,
  // or an AI rewrite on adoption, the row that comes back may not be what was
  // typed. Re-seeding on the row's own id and text keeps the box honest
  // without stamping on a rep mid-sentence — `editing` guards that.
  useEffect(() => {
    if (!editing) setText(draft.draftText || draft.text || "");
  }, [draft.id, draft.draftText, draft.text, editing]);

  useEffect(() => {
    setWhen(toLocalInput(draft.scheduledFor));
  }, [draft.id, draft.scheduledFor]);

  useEffect(() => {
    if (editing && editorRef.current) editorRef.current.focus();
  }, [editing]);

  const reason = draft.headline || null;

  return (
    <div className="flex flex-col items-end py-2">
      <p className="px-1 pb-1 text-xs text-muted-foreground break-words text-right max-w-[95%]">
        <span className="font-semibold text-foreground">
          {suggestion ? "Suggested check-in" : "Draft"}
        </span>
        {reason ? ` · ${reason}` : null}
      </p>

      <div className="w-full max-w-[95%] rounded-2xl rounded-br-md border-2 border-dashed border-primary/50 bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Said in words, not only in a dashed border. A colour-blind rep on
              a bright screen in a van gets the same sentence everybody else
              gets. */}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            <PencilLine size={12} aria-hidden="true" />
            Not sent
          </span>
          {draft.scheduledFor ? (
            <span className="text-xs text-muted-foreground">
              You said {scheduleLabel(draft.scheduledFor)}
            </span>
          ) : null}
          {draft.degraded && draft.draftSource === "rule" ? (
            // Not hidden. A rep who knows the wording came from the fallback
            // will read it more carefully, which is exactly what should happen.
            <span className="text-xs text-muted-foreground">plain wording</span>
          ) : null}
        </div>

        {editing ? (
          <>
            <label className="sr-only" htmlFor={`draft-${draft.id || "suggestion"}`}>
              Edit this check-in
            </label>
            <textarea
              id={`draft-${draft.id || "suggestion"}`}
              ref={editorRef}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              // text-base: anything smaller makes iOS zoom the whole page on
              // focus, which is the rule app/globals.css encodes.
              className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
            />
          </>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {draft.draftText || draft.text}
          </p>
        )}

        {picking ? (
          <div className="space-y-2 rounded-lg bg-muted p-3">
            <label className="block text-sm font-medium text-foreground" htmlFor={`when-${draft.id}`}>
              Send it when?
            </label>
            <input
              id={`when-${draft.id}`}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
            />
            {/* The honest sentence, said before they pick rather than after
                the server refuses. Nothing here fires on its own. */}
            <p className="text-xs text-muted-foreground break-words">
              This is a reminder to yourself, not a timer. FieldQuo never texts a contractor without
              you pressing send — the time only decides when this draft is put in front of you, and
              it has to fall inside their texting hours.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !when}
                onClick={async () => {
                  const at = new Date(when);
                  if (Number.isNaN(at.getTime())) return;
                  const done = await onReschedule?.(at.toISOString());
                  if (done) setPicking(false);
                }}
                className={`${BTN} bg-primary text-primary-foreground`}
              >
                Set the time
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const done = await onReschedule?.(null);
                  if (done) setPicking(false);
                }}
                className={`${BTN} border border-border text-foreground`}
              >
                No particular time
              </button>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className={`${BTN} text-muted-foreground`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200 break-words">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end">
          {suggestion ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAdopt?.(text)}
                className={`${BTN} bg-primary text-primary-foreground`}
              >
                {busy ? (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Sparkles size={15} aria-hidden="true" />
                )}
                Draft this
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss?.()}
                className={`${BTN} border border-border text-foreground`}
              >
                Not today
              </button>
            </>
          ) : editing ? (
            <>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={async () => {
                  const done = await onSaveText?.(text);
                  if (done) setEditing(false);
                }}
                className={`${BTN} bg-primary text-primary-foreground`}
              >
                Save the wording
              </button>
              <button
                type="button"
                onClick={() => {
                  setText(draft.draftText || "");
                  setEditing(false);
                }}
                className={`${BTN} text-muted-foreground`}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className={`${BTN} border border-border text-foreground`}
              >
                <PencilLine size={15} aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPicking((v) => !v)}
                className={`${BTN} border border-border text-foreground`}
              >
                <CalendarClock size={15} aria-hidden="true" /> When
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss?.()}
                className={`${BTN} text-muted-foreground`}
              >
                <X size={15} aria-hidden="true" /> Put away
              </button>
              {/* Absent, not disabled, when the send would be refused. A
                  greyed-out Send invites a rep to keep pressing it; the
                  sentence beside it says what is in the way. */}
              {canSend ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSend?.()}
                  className={`${BTN} bg-primary text-primary-foreground`}
                >
                  {busy ? (
                    <Loader2
                      size={15}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send size={15} aria-hidden="true" />
                  )}
                  Send it now
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
