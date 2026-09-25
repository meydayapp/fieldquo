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

// ══ Hosted by the chat.js loader ═══════════════════════════════════════════
//
// On a website FieldQuo did not build, lib/embed/chatLoader.js owns the
// iframe and sizes it from what this widget posts (`hosted`). The widget then
// FILLS its frame rather than positioning itself in a corner of a big one:
// closed, the frame is the bubble plus FRAME_PAD of room for its shadow, so
// the contractor's page stays clickable everywhere else; open, it is the
// panel. The loader decides "float" (a card) or "full" (a phone-sized host:
// the whole screen) and says which — the frame cannot tell a phone from a
// narrow card by its own width, since on a desktop it IS a narrow card.
//
// Messages to the parent carry sizes, a state and the frame's title (the
// company's own "Chat with …"), nothing about the visitor — which is why
// targetOrigin can be "*": the widget cannot know which domain framed it.
// Messages FROM the parent are accepted only from window.parent, and can do
// no more than close the panel or change its layout.
const FRAME_PAD = 12; // keep equal to lib/embed/chatLoader.js FRAME_PAD
const PANEL_W = 360;
const PANEL_H = 520;

function postToHost(msg) {
  if (typeof window === "undefined" || window.parent === window) return;
  try {
    window.parent.postMessage({ type: "fq-chat", ...msg }, "*");
  } catch {
    // A parent that has gone away — nothing to tell.
  }
}

/** Rendered by SiteChatMount when no employee answers the web channel and
 *  the loader is hosting: nothing on screen, one message so the loader
 *  removes its (still hidden) iframe instead of leaving it on the page. */
export function ChatDisabledSignal() {
  useEffect(() => {
    postToHost({ state: "disabled" });
  }, []);
  return null;
}

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
 * @param hosted       the chat.js loader owns the frame (see FRAME_PAD above)
 * @param side         "right" | "left" — the loader's corner
 */
export default function SiteChatWidget({ companySlug, language, company, employee, fill, copy, startOpen = false, hosted = false, side = "right" }) {
  const [open, setOpen] = useState(startOpen);
  // "float" | "full" — only the loader changes it (see FRAME_PAD above).
  const [layout, setLayout] = useState("float");
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  // Focus moves on a visitor's open and close, never on a page load or on a
  // close the host page asked for while its own page had focus.
  const focusOnOpen = useRef(false);
  const focusOnClose = useRef(false);

  const openChat = () => {
    focusOnOpen.current = true;
    setOpen(true);
  };
  const closeChat = () => {
    focusOnClose.current = true;
    setOpen(false);
  };

  // What the loader is told: the size this state needs. Closed, the button
  // is measured (its label is translated, so its width is not a constant) and
  // re-measured if it changes — a web font arriving late widens it.
  useEffect(() => {
    if (!hosted) return undefined;
    if (open) {
      postToHost({ state: "open", width: PANEL_W + FRAME_PAD * 2, height: PANEL_H + FRAME_PAD * 2 });
      return undefined;
    }
    const node = buttonRef.current;
    if (!node) return undefined;
    let last = "";
    const report = () => {
      const width = Math.ceil(node.offsetWidth) + FRAME_PAD * 2;
      const height = Math.ceil(node.offsetHeight) + FRAME_PAD * 2;
      const key = `${width}x${height}`;
      if (key === last) return;
      last = key;
      postToHost({ state: "closed", width, height, title: copy.title });
    };
    report();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hosted, open, copy.title]);

  // What the loader may say back.
  useEffect(() => {
    if (!hosted) return undefined;
    const onMessage = (e) => {
      if (e.source !== window.parent) return;
      const m = e.data;
      if (!m || typeof m !== "object" || m.type !== "fq-chat-host") return;
      if (m.layout === "full" || m.layout === "float") setLayout(m.layout);
      if (m.action === "close") setOpen(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [hosted]);

  // Focus into the panel when a visitor opens it; back to the bubble when a
  // visitor closes it. Full screen focuses the dialog itself rather than the
  // text box, so a phone does not throw its keyboard over the conversation
  // the moment it opens.
  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false;
      const phone = hosted
        ? layout === "full"
        : typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches;
      (phone ? panelRef.current : inputRef.current)?.focus();
    } else if (!open && focusOnClose.current) {
      focusOnClose.current = false;
      buttonRef.current?.focus();
    }
  }, [open, hosted, layout]);
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
        ref={buttonRef}
        type="button"
        onClick={openChat}
        aria-label={copy.open}
        style={{
          position: "fixed", zIndex: 2147483000, display: "inline-flex", alignItems: "center",
          gap: 10, padding: "10px 16px 10px 10px", borderRadius: 999, border: 0, cursor: "pointer",
          background: fill.bg, color: fill.fg, fontWeight: 600, fontSize: 15,
          minHeight: 48,
          // Hosted: the frame is exactly the button plus FRAME_PAD, so the
          // shadow is kept inside that pad, and the label may not wrap — the
          // frame starts 1px wide and a wrapped label would measure tall.
          ...(hosted
            ? { bottom: FRAME_PAD, [side]: FRAME_PAD, whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(0,0,0,.2)" }
            : { right: 16, bottom: 16, boxShadow: "0 6px 24px rgba(0,0,0,.18)" }),
        }}
      >
        <Avatar url={employee?.avatarUrl} name={name} size={28} fill={fill} />
        {copy.open}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={copy.title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeChat();
        }
      }}
      style={{
        position: "fixed", zIndex: 2147483000, display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#ffffff", color: "#111827", outline: "none",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        // Hosted: fill the frame the loader sized — inset by the shadow's pad
        // as a card, edge to edge as a phone's full screen.
        ...(hosted
          ? layout === "full"
            ? { inset: 0, borderRadius: 0 }
            : { inset: FRAME_PAD, borderRadius: 16, boxShadow: "0 6px 16px rgba(0,0,0,.22)" }
          : {
              right: 16, bottom: 16, width: PANEL_W, maxWidth: "calc(100vw - 32px)", height: PANEL_H,
              maxHeight: "calc(100vh - 32px)", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.22)",
            }),
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
          onClick={closeChat}
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
          ref={inputRef}
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
