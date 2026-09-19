"use client";

// app/components/chat/SiteChatWidget.js
//
// The floating chat button on a contractor's public site and on the embed —
// white-label: the company's name, the employee's face and name, the
// company's brand colour at a measured contrast (lib/documents/theme.js
// computed `fill` on the server; nothing here guesses a colour).
//
// ══ What it does, and does not, keep ═══════════════════════════════════════
//
// One thing in localStorage: the visitor token the server minted, so a
// reload keeps the conversation. Wrapped in try/catch because a private
// window returns nothing, and the widget works without it — a fresh thread.
// No name, no phone, no email is stored by the widget; whatever the visitor
// types is in the transcript and nowhere else.
//
// ══ Honest states ══════════════════════════════════════════════════════════
//
// After a send the server says `replied` or `waiting`. `waiting` prints the
// one sentence — "someone will reply shortly" — whether the employee is off,
// drafting for a person, out of credit or handed off: from where the visitor
// sits those are one fact. The transcript keeps polling, so a human reply
// from the inbox appears without a reload.

import { useCallback, useEffect, useRef, useState } from "react";

const TOKEN_KEY = "fq_chat_token";
const POLL_MS = 5000;

function readToken(slug) {
  try {
    return window.localStorage.getItem(`${TOKEN_KEY}:${slug}`) || null;
  } catch {
    return null;
  }
}
function writeToken(slug, token) {
  try {
    window.localStorage.setItem(`${TOKEN_KEY}:${slug}`, token);
  } catch {
    // Private window, cleared storage — the conversation just does not survive a reload.
  }
}

function Avatar({ url, name, size = 36, fill }) {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "AI";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: size * 0.4, fontWeight: 600, background: fill.fg, color: fill.bg, flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * @param companySlug  the booking slug — the only thing that names the company
 * @param language     the visitor's language (the site page's)
 * @param company      { name, logoUrl }
 * @param employee     { displayName, avatarUrl } | null
 * @param fill         { bg, fg } — the brand colour pair at ≥ 4.5:1
 * @param copy         lib/aiEmployee/webChatCopy.js's words, already resolved
 * @param startOpen    the embed frame opens on the button too; a host page may
 *                     pass true to open at once
 */
export default function SiteChatWidget({ companySlug, language, company, employee, fill, copy, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [state, setState] = useState(null); // null | "sending" | "replied" | "waiting" | "error" | "tooMany"
  // Read lazily on the first render in the browser; the server renders the
  // closed button, which reads nothing.
  const [token, setToken] = useState(() => (typeof window === "undefined" ? null : readToken(companySlug)));
  const listRef = useRef(null);
  const base = `/api/site-chat/${encodeURIComponent(companySlug)}`;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${base}?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // A poll that fails is retried on the next tick; nothing to tell the visitor.
    }
  }, [base, token]);

  useEffect(() => {
    if (!open) return undefined;
    // The first read is scheduled, not called in the effect body, so the
    // open frame paints before the poll's setState lands.
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, state, open]);

  async function send(body) {
    const trimmed = String(body || "").trim();
    if (!trimmed || state === "sending") return;
    setState("sending");
    setText("");
    // Shown at once, so the visitor sees their own words before the round trip.
    setMessages((m) => [...m, { id: `local:${Date.now()}`, from: "visitor", text: trimmed, at: new Date().toISOString() }]);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text: trimmed, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState(res.status === 429 ? "tooMany" : "error");
        return;
      }
      if (data.token && data.token !== token) {
        writeToken(companySlug, data.token);
        setToken(data.token);
      }
      if (Array.isArray(data.messages)) setMessages(data.messages);
      setState(data.state === "replied" ? "replied" : "waiting");
    } catch {
      setState("error");
    }
  }

  const name = employee?.displayName || company?.name || "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy.open}
        style={{
          position: "fixed", right: 16, bottom: 16, zIndex: 2147483000, display: "inline-flex", alignItems: "center",
          gap: 10, padding: "10px 16px 10px 10px", borderRadius: 999, border: 0, cursor: "pointer",
          background: fill.bg, color: fill.fg, fontWeight: 600, fontSize: 15, boxShadow: "0 6px 24px rgba(0,0,0,.18)",
          minHeight: 48,
        }}
      >
        <Avatar url={employee?.avatarUrl} name={name} size={28} fill={fill} />
        {copy.open}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 2147483000, width: 360, maxWidth: "calc(100vw - 32px)",
        height: 520, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", borderRadius: 16,
        overflow: "hidden", background: "#ffffff", color: "#111827", boxShadow: "0 12px 40px rgba(0,0,0,.22)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 12px 14px", background: fill.bg, color: fill.fg }}>
        <Avatar url={employee?.avatarUrl} name={name} size={36} fill={fill} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company?.name}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={copy.close}
          style={{ background: "transparent", border: 0, color: "inherit", fontSize: 22, lineHeight: 1, cursor: "pointer", minWidth: 44, minHeight: 44 }}
        >
          ×
        </button>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#f6f4f0" }}>
        {messages.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "#4b5563" }}>{copy.intro}</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.from === "visitor" ? "flex-end" : "flex-start",
              maxWidth: "85%", padding: "8px 12px", borderRadius: 14, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap",
              background: m.from === "visitor" ? fill.bg : "#ffffff", color: m.from === "visitor" ? fill.fg : "#111827",
              border: m.from === "visitor" ? 0 : "1px solid #e5e7eb",
            }}
          >
            {m.text}
          </div>
        ))}
        {(state === "waiting" || state === "sending") && (
          <p style={{ margin: 0, fontSize: 13, color: "#4b5563", alignSelf: "flex-start" }}>
            {state === "sending" ? "…" : copy.waiting}
          </p>
        )}
        {state === "error" && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{copy.error}</p>}
        {state === "tooMany" && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{copy.tooMany}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e5e7eb", background: "#ffffff" }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.placeholder}
          maxLength={1500}
          aria-label={copy.placeholder}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 16, color: "#111827", background: "#ffffff" }}
        />
        <button
          type="submit"
          disabled={!text.trim() || state === "sending"}
          style={{ minHeight: 44, padding: "0 14px", borderRadius: 10, border: 0, background: fill.bg, color: fill.fg, fontWeight: 600, cursor: "pointer", opacity: !text.trim() || state === "sending" ? 0.6 : 1 }}
        >
          {copy.send}
        </button>
      </form>
      <button
        type="button"
        onClick={() => send(copy.personMessage)}
        style={{ border: 0, borderTop: "1px solid #e5e7eb", background: "#ffffff", color: "#374151", fontSize: 13, minHeight: 40, cursor: "pointer" }}
      >
        {copy.person}
      </button>
    </div>
  );
}
