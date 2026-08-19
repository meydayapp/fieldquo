// app/components/jobs/SuggestedTasks.js
//
// "Read the notes on this job and suggest what the office still owes."
//
// ── Why this is a button and not something that happens on its own ─────────
//
// /app/tasks exists to answer one question: what have I let slip. A page that
// silently gains five machine-written rows every time a job is created stops
// answering it — the real overdue item is now the sixth row down, under four
// suggestions nobody asked for. So this spends nothing until someone presses
// it, and writes nothing until someone ticks a box.
//
// ── The quote under each suggestion is the point ───────────────────────────
//
// Every suggestion shows the phrase from the notes it came from, and
// lib/tasks/suggestFromJob.js has already dropped any whose quote isn't
// actually in those notes. What survives to this screen is traceable: a person
// can see the sentence that produced the task without opening the client
// record and the quote to go hunting for it.
"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";

const PRIORITY_STYLES = {
  urgent:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  high: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
};

// An empty result has four distinct causes and they are not interchangeable.
// "There is nothing to suggest" is a finding; "the AI is switched off" is a
// deployment fact; "this job has no notes" tells you what to do about it.
// Collapsing them into "No suggestions" would be the empty-vs-error failure.
const REASONS = {
  no_notes:
    "Nothing to read yet — this job has no client notes, quote notes or visit notes.",
  nothing_to_do: "Read the notes on this job. Nothing in them needs a task.",
  ungrounded:
    "Nothing reliable to suggest from these notes. Nothing was added.",
  ai_unavailable: "FieldQuo AI isn't switched on for this deployment.",
  ai_error: "Couldn't read the notes just now. Try again shortly.",
  not_found: "This job couldn't be found.",
};

export default function SuggestedTasks({ jobId, onCreated }) {
  const [state, setState] = useState("idle"); // idle | loading | ready | adding
  const [suggestions, setSuggestions] = useState([]);
  const [chosen, setChosen] = useState(() => new Set());
  const [message, setMessage] = useState("");

  async function run() {
    setState("loading");
    setMessage("");
    setSuggestions([]);
    setChosen(new Set());

    try {
      const res = await fetch(`/api/jobs/${jobId}/suggested-tasks`, {
        method: "POST",
      });
      if (!res.ok) {
        setState("idle");
        await reportResponseError(res, "Couldn't read this job's notes.");
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(list);
      // Nothing pre-ticked. A pre-ticked list turns "review these" into
      // "press the button", which is how machine-written rows end up on a
      // to-do list nobody chose.
      setChosen(new Set());
      setMessage(list.length ? "" : REASONS[data.reason] || REASONS.nothing_to_do);
      setState("ready");
    } catch {
      setState("idle");
      showError("Couldn't reach the server. Check your connection.");
    }
  }

  function toggle(index) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function addChosen() {
    const picked = suggestions.filter((_, i) => chosen.has(i));
    if (!picked.length) return;

    setState("adding");
    let added = 0;
    const failed = [];

    // Sequential, not Promise.all: each is a separate row a person chose, and
    // a partial failure has to be reportable as "3 of 4 added" rather than as
    // one rejected promise that hides which.
    for (const item of picked) {
      const dueDate =
        item.dueInDays === null || item.dueInDays === undefined
          ? null
          : (() => {
              const d = new Date();
              d.setDate(d.getDate() + item.dueInDays);
              d.setHours(9, 0, 0, 0);
              return d.toISOString();
            })();

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            // The source sentence is kept ON the task, not just shown once in
            // this panel. Two weeks later "Call Mrs. Alvarez about gate
            // access" on its own is a task nobody remembers agreeing to.
            description: `From the notes: “${item.because}”`,
            priority: item.priority,
            dueDate,
            jobId,
          }),
        });
        if (res.ok) added += 1;
        else failed.push(item.title);
      } catch {
        failed.push(item.title);
      }
    }

    setState("ready");

    if (added) {
      setSuggestions((prev) => prev.filter((_, i) => !chosen.has(i)));
      setChosen(new Set());
      onCreated?.();
    }

    if (failed.length) {
      showError(
        added
          ? `Added ${added}. ${failed.length} couldn't be added — try again.`
          : "Couldn't add those tasks. Try again.",
      );
    } else if (added) {
      setMessage(`Added ${added} task${added === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles size={14} className="text-muted-foreground" />
            Tasks from the notes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reads the client, quote and visit notes on this job. Suggestions
            only — nothing is added until you pick it.
          </p>
        </div>
        <button
          onClick={run}
          disabled={state === "loading" || state === "adding"}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-60"
        >
          {state === "loading" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Reading…
            </>
          ) : (
            <>
              <Sparkles size={12} />
              {suggestions.length ? "Read again" : "Read the notes"}
            </>
          )}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-xs text-muted-foreground">{message}</p>
      )}

      {suggestions.length > 0 && (
        <>
          <ul className="mt-3 space-y-2">
            {suggestions.map((item, index) => {
              const picked = chosen.has(index);
              return (
                <li key={`${item.title}-${index}`}>
                  <button
                    onClick={() => toggle(index)}
                    disabled={state === "adding"}
                    className={`w-full text-left border rounded-lg px-3 py-2 flex items-start gap-2.5 disabled:opacity-60 ${
                      picked
                        ? "border-foreground/30 bg-muted"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                        picked
                          ? "bg-foreground border-foreground text-background"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {picked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">
                        {item.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 italic">
                        “{item.because}”
                      </span>
                      <span className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1 py-px ${
                            PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.normal
                          }`}
                        >
                          {item.priority}
                        </span>
                        {item.dueInDays !== null &&
                          item.dueInDays !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              due in {item.dueInDays} day
                              {item.dueInDays === 1 ? "" : "s"}
                            </span>
                          )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={addChosen}
              disabled={chosen.size === 0 || state === "adding"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-foreground text-background rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              {state === "adding" ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <Plus size={12} /> Add{chosen.size ? ` ${chosen.size}` : ""} to
                  tasks
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSuggestions([]);
                setChosen(new Set());
                setMessage("");
              }}
              disabled={state === "adding"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <X size={12} /> Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}
