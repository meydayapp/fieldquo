"use client";

// app/components/sales/RepNoteEditor.js
//
// The editor. A textarea, and every property a block editor would not have
// given for free.
//
// ══ It is a textarea, and the screen says so ═══════════════════════════════
//
// The decision handed to this work was BlockNote, with an instruction to
// verify the packages first and ship a textarea if they would not install.
// They do not: `npm install @blocknote/core` fails ERESOLVE on every published
// version, because @y/protocols declares a non-optional `peer @y/y@"*"` and
// every published @y/y is a prerelease that a bare `*` range does not match.
// The full measurement, both escape hatches and why neither is worth taking,
// is in lib/sales/notes/body.js's header. EDITOR.why is the sentence a rep
// reads, and RepNoteVisibilityNotice renders it.
//
// What is NOT here, deliberately: a toolbar of bold/italic buttons with
// nothing behind them. AGENTS.md's first rule.
//
// ══ Autosave, and the three things that make it honest ═════════════════════
//
//   1. A GUARD. Every save carries `expectedUpdatedAt` and the server refuses
//      a write against a version it has moved past — lib/sales/notes/write.js.
//      Without it, a rep with the note open on a phone and a laptop has two
//      writers racing every 1.5 seconds and the loser's work vanishes with no
//      error. Autosave is what makes the guard mandatory rather than nice.
//
//   2. A LOCAL DRAFT. Every keystroke is written to localStorage before any
//      network call. docs/construction/AUDIT-realtime-hosting.md §6 names this
//      exactly: the crew member types in a basement, `onChange` updates React
//      state so the text is on screen, the fetch fails, and they walk out
//      believing it saved. A draft keyed by note id plus a visible unsaved
//      state fixes that without a CRDT.
//
//   3. A SAVE STATE THAT CAN SAY NO. `saved`, `saving`, `unsaved`, `offline`,
//      `error`, `conflict` — six states, each with its own sentence. The one
//      that matters is that a failure is never silent: AGENTS.md failure class
//      #2 is `if (res.ok)` with no else, and an autosaving editor is where
//      that bug does the most damage because nobody pressed anything to check.
//
// ══ Why the debounce is 1500ms and the flush points are what they are ══════
//
// A rep types in bursts between sentences. Under a second and every pause
// costs a round trip on a phone connection; over three and closing the tab
// loses the last thought. 1500 is the middle, and the flushes are what make
// the number not matter much: blur, tab hidden, and pagehide all save
// immediately, so the debounce only ever governs the idle case.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, Loader2, RotateCcw } from "lucide-react";
import { readStaleConflict } from "@/lib/concurrency/staleWriteClient";
import { VERSION_FIELD } from "@/lib/concurrency/staleWrite";
import { LIMITS, sanitiseBody, sanitiseTitle } from "@/lib/sales/notes/body";
import RepNoteConflict from "./RepNoteConflict";

const DEBOUNCE_MS = 1500;

/** Where a local draft lives. One key per note, so two notes cannot collide. */
export function draftKey(noteId) {
  return `fieldquo.repnote.${noteId}`;
}

function readDraft(noteId) {
  try {
    const raw = window.localStorage.getItem(draftKey(noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    // Private browsing, a full quota, a corrupted value. A draft that cannot
    // be read is not an error worth showing — the server copy is still right.
    return null;
  }
}

function writeDraft(noteId, value) {
  try {
    window.localStorage.setItem(draftKey(noteId), JSON.stringify(value));
  } catch {
    /* quota or private mode — the save state below is still truthful */
  }
}

function clearDraft(noteId) {
  try {
    window.localStorage.removeItem(draftKey(noteId));
  } catch {
    /* nothing to do, and nothing broken */
  }
}

/**
 * @param {object}   props
 * @param {object}   props.note     the stored note, from the API
 * @param {Function} [props.onSaved] called with the fresh row after each save
 */
export default function RepNoteEditor({ note, onSaved }) {
  const [title, setTitle] = useState(note.title || "");
  const [body, setBody] = useState(note.body || "");
  const [state, setState] = useState("saved");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(null);

  // The version every save is guarded on. A ref, not state: the save closure
  // has to read the CURRENT one, and a stale closure over a state variable is
  // how a guarded write starts sending a version from two saves ago and
  // conflicts with itself forever.
  const version = useRef(note.updatedAt);
  const timer = useRef(null);
  const pending = useRef(null);
  const inFlight = useRef(false);

  // ── Recover a draft left behind by a save that never landed ─────────────
  //
  // Runs once, on mount. A draft only survives a failed save (a successful one
  // clears it), so its presence IS the evidence that something did not reach
  // the server. It is loaded into the editor and the state says so rather than
  // saving it silently — the rep should see what they are about to overwrite
  // the server copy with.
  useEffect(() => {
    const draft = readDraft(note.id);
    if (!draft) return;
    if (draft.title === (note.title || "") && draft.body === (note.body || "")) {
      // Identical to what is stored: the save DID land and the clear did not.
      clearDraft(note.id);
      return;
    }
    setTitle(draft.title ?? "");
    setBody(draft.body ?? "");
    setState("unsaved");
    setMessage("Recovered from this device — the last save didn't reach the server.");
    // note.id only: re-running on a title change would clobber what the rep is
    // typing with a draft they already recovered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const save = useCallback(
    async (next, { force = false } = {}) => {
      if (inFlight.current) {
        // One save at a time. The newer values are kept and sent the moment
        // the current request settles — see the flush at the end of this
        // function. Firing both would race two writes at the same guard and
        // conflict this editor with itself.
        pending.current = next;
        return;
      }
      inFlight.current = true;
      setState("saving");

      let res;
      try {
        res = await fetch(`/api/sales/notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: next.title,
            body: next.body,
            [VERSION_FIELD]: version.current,
          }),
        });
      } catch {
        // The basement. The text is on screen and in localStorage; what is not
        // true is that it is saved, and this is the sentence that says so.
        inFlight.current = false;
        setState("offline");
        setMessage("Not saved — no connection. Your text is kept on this device.");
        return;
      }

      if (!res.ok) {
        const stale = await readStaleConflict(res);
        if (stale) {
          inFlight.current = false;
          setState("conflict");
          setConflict(stale);
          // The version the server just named. "Keep what I typed" re-submits
          // against THIS, so the overwrite is deliberate and still guarded.
          if (force) {
            /* a forced save that conflicted again: a third writer landed
               between the refusal and the retry. Show it again rather than
               looping — an editor that retries forever is how a rep watches a
               spinner instead of a problem. */
          }
          return;
        }

        let text = "";
        try {
          text = (await res.clone().json())?.error || "";
        } catch {
          /* not JSON — the status below is still true */
        }
        inFlight.current = false;
        setState("error");
        setMessage(text || `Not saved (${res.status}). Your text is kept on this device.`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data?.note?.updatedAt) version.current = data.note.updatedAt;

      inFlight.current = false;
      setConflict(null);
      clearDraft(note.id);
      setState("saved");
      setMessage("");
      if (onSaved && data?.note) onSaved(data.note);

      // Anything typed while the request was in flight goes now.
      if (pending.current) {
        const queued = pending.current;
        pending.current = null;
        save(queued);
      }
    },
    [note.id, onSaved],
  );

  /** Cancel the debounce and save immediately. Blur, tab-hide, unmount. */
  const flush = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    save({ title, body });
  }, [save, title, body]);

  const change = useCallback(
    (nextTitle, nextBody) => {
      setTitle(nextTitle);
      setBody(nextBody);
      // BEFORE the network call, always. This is the line that makes the
      // basement survivable.
      writeDraft(note.id, { title: nextTitle, body: nextBody });
      setState("unsaved");
      setMessage("");

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        save({ title: nextTitle, body: nextBody });
      }, DEBOUNCE_MS);
    },
    [note.id, save],
  );

  // Leaving the page with a debounce still pending is the one way to lose a
  // sentence, so both exits are covered: `visibilitychange` fires when a phone
  // is locked or the app is backgrounded, `pagehide` when the tab actually
  // goes. Neither is guaranteed on iOS, which is exactly why the draft above
  // is written on every keystroke rather than relying on these.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  async function keepMine() {
    if (!conflict?.currentUpdatedAt) return;
    // Re-guard on the version the server named, rather than dropping the
    // guard. A save that lands between the refusal and this one conflicts
    // again — there is no unguarded force anywhere in this feature.
    version.current = conflict.currentUpdatedAt;
    await save({ title, body }, { force: true });
  }

  async function loadSaved() {
    let res;
    try {
      res = await fetch(`/api/sales/notes/${note.id}`);
    } catch {
      setState("offline");
      setMessage("Couldn't reach the server. Nothing was changed.");
      return;
    }
    if (!res.ok) {
      setState("error");
      setMessage(`Couldn't load the saved version (${res.status}). Nothing was changed.`);
      return;
    }
    const data = await res.json().catch(() => null);
    if (!data?.note) {
      setState("error");
      setMessage("Couldn't read the saved version. Nothing was changed.");
      return;
    }
    setTitle(data.note.title || "");
    setBody(data.note.body || "");
    version.current = data.note.updatedAt;
    clearDraft(note.id);
    setConflict(null);
    setState("saved");
    setMessage("");
  }

  return (
    <div className="space-y-3">
      {conflict && (
        <RepNoteConflict
          conflict={conflict}
          onKeepMine={keepMine}
          onLoadSaved={loadSaved}
          busy={state === "saving"}
        />
      )}

      <div className="rounded-lg border border-border bg-card">
        <label className="sr-only" htmlFor="rep-note-title">
          Title
        </label>
        <input
          id="rep-note-title"
          value={title}
          onChange={(e) => change(sanitiseTitle(e.target.value), body)}
          onBlur={flush}
          maxLength={LIMITS.title}
          placeholder="Title"
          className="w-full px-3 py-3 bg-transparent text-foreground font-semibold border-b border-border rounded-t-lg outline-none placeholder:text-muted-foreground"
        />

        <label className="sr-only" htmlFor="rep-note-body">
          Note
        </label>
        <textarea
          id="rep-note-body"
          value={body}
          onChange={(e) => change(title, sanitiseBody(e.target.value))}
          onBlur={flush}
          maxLength={LIMITS.body}
          rows={16}
          placeholder="What happened on the call…"
          // min-h in vh rather than a pixel height: a fixed 400px box is
          // unreachable on a short screen with the keyboard up, which is every
          // phone. See the modal-height rule in check-mobile-surfaces.mjs.
          className="w-full px-3 py-3 bg-transparent text-foreground rounded-b-lg outline-none resize-y min-h-[40vh] placeholder:text-muted-foreground"
        />
      </div>

      <SaveState state={state} message={message} />
    </div>
  );
}

/**
 * The one line that says whether the work is safe.
 *
 * Every branch is reachable and every branch says something different. A
 * spinner that never resolves, or a green tick that appears on a failed save,
 * is the whole failure this component exists to avoid.
 */
function SaveState({ state, message }) {
  if (state === "saving") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Saving…
      </p>
    );
  }

  if (state === "saved") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check size={14} />
        Saved
      </p>
    );
  }

  if (state === "unsaved") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <RotateCcw size={14} />
        {message || "Not saved yet"}
      </p>
    );
  }

  if (state === "conflict") {
    // The banner above already says everything. A second sentence here would
    // compete with it.
    return null;
  }

  // offline and error. Both mean the same thing to the person reading it —
  // what is on screen is not on the server — and both say it in words rather
  // than with a colour.
  return (
    <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
      <CloudOff size={14} className="mt-0.5 shrink-0" />
      {message || "Not saved. Your text is kept on this device."}
    </p>
  );
}
