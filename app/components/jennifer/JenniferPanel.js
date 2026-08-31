"use client";

// app/components/jennifer/JenniferPanel.js
//
// The one right-hand panel, used on both surfaces the owner asked for — the
// marketing site (anonymous) and the signed-in app (company). Which MODE the
// conversation runs in is decided entirely server-side, per request, from the
// session (see app/api/jennifer/route.js) — this component never claims a
// mode and never sends a companyId; `variant` here only changes cosmetic
// things (openers, attach button) and which of the two request shapes it
// sends, with no bearing on what the server will actually let the
// conversation do.
//
// ── Two different conversation models, on purpose ───────────────────────────
//
// marketing (anonymous): the whole message history lives in component state
// and is POSTed back in full each turn — there is no server-side row for it,
// which is what makes "don't persist anonymous conversations"
// (AGENTS.md non-negotiable #8) trivially true rather than a promise to keep.
//
// app (company): the server owns the history now (JenniferConversation /
// JenniferMessage — see lib/ai/jennifer/conversations.js), because an
// escalated conversation has to be something a FieldQuo operator can open and
// reply into from /platform/jennifer, and a reply has to be able to reach
// THIS panel again — which a stateless resend-the-array design has no way to
// do. `conversationId` is returned by the first response and sent on every
// later one.
//
// ── Reactivity: polling, only while it matters ──────────────────────────────
//
// There is no push mechanism in this stack. Jennifer's own reply is a plain
// request/response (the loading spinner is the honest "still working"
// signal — not streamed token-by-token in this pass, a scope cut made under
// time pressure and named as such in the project report, not hidden). An
// OPERATOR's reply is different: nothing else will ever notice a human typed
// into /platform/jennifer, so this panel polls GET /api/jennifer while — and
// ONLY while — the conversation's status is "escalated". A plain bot
// conversation never changes except by the visitor's own actions, so polling
// it the rest of the time would be pure waste. A failed poll sets
// `pollError` and says so on screen rather than silently going quiet — this
// codebase already distinguishes "empty" from "could not load" everywhere
// else, and the same discipline applies here.
//
// ── Navigation is a real <a>, not a script-driven redirect ──────────────────
//
// The route Jennifer offers is rendered as an anchor tag. It moves the page
// only when the visitor clicks it — nothing here calls next/navigation on the
// server's say-so. See lib/ai/jennifer/allowlist.js for why the target can
// only ever be one of a fixed set of routes.
//
// ── Text chat only ───────────────────────────────────────────────────────
//
// No voice, no TTS, no speech input, deliberately: a firm cost decision, not
// a "later" placeholder. There is nothing half-built to hide here — no mic
// button, no audio player on a message.
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Paperclip, WifiOff } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const MARKETING_OPENERS = [
  "I want to grow, but my current setup can't keep up",
  "Can I see results from businesses like mine?",
  "What kind of ROI do contractors like me typically see?",
];

const APP_OPENERS = [
  "Is my receptionist actually switched on?",
  "Why didn't my invoice email send?",
  "Do I have AI credit left?",
];

const POLL_MS = 5000;

function roleClasses(role) {
  if (role === "user") return "bg-inverted text-inverted-foreground";
  if (role === "operator") return "border border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100";
  return "border border-border bg-background text-foreground";
}

export default function JenniferPanel({ variant = "marketing" }) {
  const isCompany = variant === "app";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [navigation, setNavigation] = useState(null);
  const [pendingImage, setPendingImage] = useState(null); // { url, name } | null
  const [uploading, setUploading] = useState(false);

  // Company mode only.
  const [conversationId, setConversationId] = useState(null);
  const [status, setStatus] = useState("unresolved");
  const [pollError, setPollError] = useState(false);

  const endRef = useRef(null);

  const openers = isCompany ? APP_OPENERS : MARKETING_OPENERS;

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  // ── Polling, gated on "escalated" — see this file's header ───────────────
  useEffect(() => {
    if (!isCompany || !conversationId || status !== "escalated") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchJson(`/api/jennifer?conversationId=${encodeURIComponent(conversationId)}`);
        if (cancelled) return;
        setPollError(false);
        setStatus(data.status);
        setMessages(
          data.messages.map((m) => ({ role: m.role, content: m.content, id: m.id })),
        );
      } catch {
        if (!cancelled) setPollError(true);
      }
    };

    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isCompany, conversationId, status]);

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Not fetchJson: /api/upload takes multipart form data, not JSON, and
      // returns { url } on success or { error } on failure — read directly.
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setPendingImage({ url: data.url, name: file.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const sendAnonymous = useCallback(
    async (content) => {
      const next = [...messages, { role: "user", content }];
      setMessages(next);
      try {
        const data = await fetchJson("/api/jennifer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })) }),
        });
        setMessages((m) => [...m, { role: "assistant", content: data.text, escalated: data.escalated }]);
        setNavigation(data.navigation || null);
      } catch (err) {
        setError(err.message);
        setInput(content);
        setMessages(messages);
      }
    },
    [messages],
  );

  const sendCompany = useCallback(
    async (content, imageUrl) => {
      setMessages((m) => [...m, { role: "user", content, imageUrl: imageUrl || null }]);
      try {
        const data = await fetchJson("/api/jennifer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: content,
            images: imageUrl ? [imageUrl] : undefined,
          }),
        });
        setConversationId(data.conversationId);
        setStatus(data.status);
        if (data.text) {
          setMessages((m) => [...m, { role: "assistant", content: data.text, escalated: data.escalated }]);
        }
        setNavigation(data.navigation || null);
      } catch (err) {
        setError(err.message);
        setInput(content);
        // Roll back the optimistic user bubble on a genuine send failure —
        // the server never saw it, so pretending it's part of the thread
        // would show the contractor a message that was never delivered.
        setMessages((m) => m.slice(0, -1));
      }
    },
    [conversationId],
  );

  async function send(text) {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || sending) return;

    const attachedImage = pendingImage;
    setInput("");
    setPendingImage(null);
    setError("");
    setNavigation(null);
    setSending(true);

    try {
      if (isCompany) {
        await sendCompany(content || "(sent a screenshot)", attachedImage?.url);
      } else {
        await sendAnonymous(content);
      }
    } finally {
      setSending(false);
    }
  }

  const waitingForOperator = isCompany && status === "escalated" && !sending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat with Jennifer" : "Chat with Jennifer"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-inverted text-inverted-foreground shadow-lg hover:opacity-90"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      <div
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Jennifer</p>
            <p className="text-xs text-muted-foreground">
              {isCompany ? "FieldQuo support" : "FieldQuo"}
              {isCompany && status === "escalated" && " · with a person"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Try asking
              </p>
              {openers.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={m.id || i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${roleClasses(m.role)}`}>
                {m.role === "operator" && (
                  <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">FieldQuo</p>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-background px-3 py-2">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {waitingForOperator && (
            <p className="text-xs text-muted-foreground">
              {pollError ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <WifiOff size={12} /> Couldn't check for a reply — retrying…
                </span>
              ) : (
                "Waiting for a reply from FieldQuo…"
              )}
            </p>
          )}

          {navigation && (
            <div className="flex justify-start">
              <a
                href={navigation.path}
                className="inline-block rounded-lg bg-inverted px-3 py-2 text-xs font-semibold text-inverted-foreground hover:opacity-90"
              >
                {navigation.label}
              </a>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border p-3 space-y-2">
          {pendingImage && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground">
              <Paperclip size={12} />
              <span className="truncate flex-1">{pendingImage.name}</span>
              <button type="button" onClick={() => setPendingImage(null)} className="hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            {isCompany && (
              <>
                <input
                  id="jennifer-attach-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChosen}
                />
                <label
                  htmlFor="jennifer-attach-input"
                  className="flex items-center justify-center rounded-lg border border-border px-2.5 text-muted-foreground hover:bg-muted cursor-pointer"
                  aria-label="Attach a screenshot"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                </label>
              </>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Jennifer…"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || (!input.trim() && !pendingImage)}
              className="flex items-center gap-1 rounded-lg bg-inverted px-3 py-2 text-sm font-semibold text-inverted-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
