// app/components/help-centre/HelpFeedback.js
//
// "Was this helpful?" — two buttons that POST { lang, slug, helpful } to
// /api/help/feedback. No name, no email, no free text: the row is a vote,
// and a vote needs no identity. One vote per article per browser is
// remembered in localStorage so the buttons do not invite a second press;
// the server rate-limits per IP for everything else.
"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const KEY = "fieldquo-help-feedback";

function readVotes() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export default function HelpFeedback({ lang, slug, labels }) {
  const [state, setState] = useState("idle"); // idle | sending | done | failed
  const [voted, setVoted] = useState(null);

  useEffect(() => {
    const v = readVotes()[slug];
    if (v === true || v === false) {
      setVoted(v);
      setState("done");
    }
  }, [slug]);

  async function vote(helpful) {
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const res = await fetch("/api/help/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, slug, helpful }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setVoted(helpful);
      setState("done");
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ ...readVotes(), [slug]: helpful }));
      } catch {
        /* a private window forgets; the server still has the vote */
      }
    } catch {
      setState("failed");
    }
  }

  const btn = (helpful, Icon, text) => (
    <button
      type="button"
      onClick={() => vote(helpful)}
      disabled={state === "sending" || state === "done"}
      aria-pressed={voted === helpful}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
        voted === helpful
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-muted disabled:opacity-60"
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {text}
    </button>
  );

  return (
    <div className="mt-10 rounded-2xl border border-border bg-card px-5 py-4">
      <p className="text-sm font-semibold text-foreground">{labels.helpful}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {btn(true, ThumbsUp, labels.yes)}
        {btn(false, ThumbsDown, labels.no)}
        {state === "done" && <span className="ml-2 text-sm text-muted-foreground" role="status">{labels.thanks}</span>}
        {state === "failed" && <span className="ml-2 text-sm text-muted-foreground" role="status">{labels.failed}</span>}
      </div>
    </div>
  );
}
