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
import { Send, Loader2, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const SUGGESTIONS = [
  "Which clients haven't been invoiced yet?",
  "What's my average quote value this month?",
  "Which material costs went up the most?",
  "How many quotes are still waiting on a response?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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
    } catch (err) {
      setError(err.message);
      // Drop the optimistic message back into the box so a failed send
      // doesn't lose what they typed.
      setInput(content);
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={20} className="text-muted-foreground" />
          FieldQuo AI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask about your own quotes, invoices, clients and material costs. It
          looks up real numbers rather than guessing.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Try asking
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

      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about your business…"
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
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
