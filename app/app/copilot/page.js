// app/app/copilot/page.js
//
// Chat UI for FieldQuo AI. The interesting work happens server-side in
// lib/ai/copilotClient.js, which runs a tool-use loop over read-only lookups
// against this company's own quotes, invoices, clients and material costs —
// this file just collects messages and renders the replies.
//
// This file was empty while /api/ai/copilot and the whole tool layer existed,
// which broke the production build ("The default export is not a React
// Component"). Dev never caught it because nobody had opened the page.
"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, AlertTriangle, Gauge } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasToggle } from "@/lib/permissions/enforce";

export default function CopilotPage() {
  const { t } = useTranslation();
  // ── Suggestions the asker can actually get an answer to ────────────────
  //
  // The copilot's tools are now filtered by the permission grid, so three of
  // these four ask for money — average quote value, material costs, invoiced
  // status — and a Worker with showPricing off has no tool that can answer
  // them. A tappable suggestion that reliably fails is the dead control this
  // codebase keeps being swept for, and it is worse coming from an assistant:
  // the model has to refuse a question the app itself proposed.
  //
  // Gated on the same toggle the tools are, so the two cannot drift.
  const caller = usePermissions();
  const seesMoney = hasToggle(caller, "showPricing");
  const SUGGESTIONS = seesMoney
    ? [
        t("app.copilot.suggest1", "Which clients haven't been invoiced yet?"),
        t("app.copilot.suggest2", "What's my average quote value this month?"),
        t("app.copilot.suggest3", "Which material costs went up the most?"),
        t("app.copilot.suggest4", "How many quotes are still waiting on a response?"),
      ]
    : [
        // What is left when the money tools are gone: the schedule, which
        // getUpcomingWork still serves to anyone who may see jobs.
        t("app.copilot.suggestWork1", "What work is coming up this week?"),
        t("app.copilot.suggestWork2", "Which jobs am I assigned to?"),
      ];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // ── The warning the server has been sending to nobody ────────────────────
  //
  // lib/ai/usage.js computes `nearLimit` at 80% and its comment states the
  // reason: "Someone who hits a wall with no warning experiences a broken
  // feature; someone warned at 80% experiences a limit." /api/ai/copilot put
  // {used, cap, nearLimit} in every successful reply with a comment promising
  // the UI would warn — and this page dropped the whole object on the floor.
  // A field written and never read is AGENTS.md failure class 1, and here it
  // was the difference between a limit and a broken assistant.
  const [usage, setUsage] = useState(null);
  // ── An exhausted allowance is not an error ───────────────────────────────
  //
  // Held apart from `error` because the two want opposite renderings. A 502
  // from OpenAI is a red line worth retrying; a spent allowance is a settled
  // fact about the month with nothing to retry, and rendering it as a small
  // red line beside the composer read as "the assistant is broken".
  //
  // Deliberately NOT offered the AI credit top-up dialog. This cap is
  // Company.aiMonthlyTokenCap / the plan's (see getAiCap), which buying wallet
  // credit does not raise — a Buy button here would be the dead control this
  // codebase keeps being swept for, wearing a helpful label.
  const [outOfAllowance, setOutOfAllowance] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    // Optimistically render the user's message, and keep a local copy of the
    // full history — setState is async, so reading `messages` straight after
    // would send a list missing the message just typed.
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setSending(true);

    try {
      // fetchJson, not res.json() — a 500 returns an HTML error page, and
      // parsing that as JSON produced "The string did not match the expected
      // pattern", which named neither the cause nor the fix.
      const data = await fetchJson("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      setMessages((m) => [...m, { role: "assistant", content: data.text }]);
      // `null` when the account is uncapped — the strip below renders nothing
      // for that, rather than inventing a ceiling nobody set.
      setUsage(data.usage ?? null);
      setOutOfAllowance(false);
    } catch (err) {
      // fetchJson attaches the parsed body, so the route's own machine-readable
      // flag is what decides this — not string-matching an English sentence
      // that only exists in English.
      if (err.status === 429 && err.data?.quotaExceeded) {
        setOutOfAllowance(true);
        setError("");
      } else {
        setError(err.message);
      }
      // Drop the optimistic message back into the box so a failed send
      // doesn't lose what they typed.
      setInput(content);
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  // The percentage, only when both halves are real numbers the server sent.
  // `usage.used` of 0 is a legitimate answer and `Number(undefined)` is NaN,
  // so this asks whether the figures are finite rather than whether they are
  // truthy — the 0-is-finite trap that produced four bugs in this repo.
  const usedPct =
    usage &&
    Number.isFinite(usage.used) &&
    Number.isFinite(usage.cap) &&
    usage.cap > 0
      ? Math.min(100, Math.round((usage.used / usage.cap) * 100))
      : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={20} className="text-muted-foreground" />
          FieldQuo AI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.copilot.subtitle",
            "Ask about your own quotes, invoices, clients and material costs. It looks up real numbers rather than guessing.",
          )}
        </p>
      </div>

      {/* The 80% warning. Present only while it is true and the allowance has
          not actually run out — once it has, the block above the composer says
          so and this would be the same news twice. */}
      {usage?.nearLimit && !outOfAllowance && usedPct !== null && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <Gauge size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t(
              "app.copilot.nearLimit",
              "You've used {pct}% of this month's FieldQuo AI allowance. When it runs out, FieldQuo AI stops answering until the allowance resets at the start of next month.",
              { pct: usedPct },
            )}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("app.copilot.tryAsking", "Try asking")}
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-sm text-foreground border border-border rounded-xl px-4 py-3 hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-inverted text-inverted-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-2.5">
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* ── The refusal and the box it disables, as ONE thing ─────────────────
          Inside the composer's own bordered region and directly above the
          input, because a reason floating somewhere else on the page over a
          separately greyed-out box reads as two unrelated facts — "something
          went wrong" and "the assistant is gone". Together they read as what
          they are: a monthly limit, and when it lifts. */}
      <div className="border-t border-border pt-3">
        {outOfAllowance && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="font-semibold">
                {t("app.copilot.outTitle", "This month's FieldQuo AI allowance is used up.")}
              </span>{" "}
              {t(
                "app.copilot.outBody",
                "It resets at the start of next month, and everything else in FieldQuo carries on as normal. Get in touch if you need a bigger allowance before then.",
              )}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={outOfAllowance}
            aria-label={t("app.copilot.placeholder", "Ask about your business…")}
            placeholder={t("app.copilot.placeholder", "Ask about your business…")}
            className="flex-1 min-h-11 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || outOfAllowance || !input.trim()}
            aria-label={t("app.copilot.send", "Send")}
            className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 min-h-11 rounded-lg flex items-center gap-2 disabled:opacity-60"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
