"use client";

// app/components/staff/StaffChat.js
//
// FieldQuo's own team chat, drawn once and rendered by both portals.
//
// ══ Why one component for /sales and /platform ════════════════════════════
//
// It is ONE set of conversations. A rep and a platform admin are in the same
// rooms saying things to each other, so two components would be two
// implementations of one screen — and the copy nobody looks at is the one that
// rots. That is the same failure that left /sales/threads drawing a mail log
// while /sales/messages next door drew a proper thread.
//
// ══ Why it reuses MessageThread rather than drawing its own ═══════════════
//
// The ask was that this feel like the texting screen. The way to make two
// screens feel the same is not to style them the same twice; it is to render
// them with the same component. MessageThread already carries the grouping
// (same author, under 300 seconds, not across a day — Rocket.Chat's
// isMessageSequential, read out of their source), the day-divider pill, and the
// avatar gutter. It gained one thing for this: an author name per message,
// because a channel has more than two people in it and "them" is not a name.
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import MessageThread from "@/app/sales/messages/MessageThread";
import { participantInitials } from "@/lib/staff/participants";
import { ArrowLeft, Hash, Loader2, Lock, Plus, Send } from "lucide-react";

function when(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function StaffChat({ heading = "Team" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [room, setRoom] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setData(await fetchJson("/api/staff/rooms"));
    } catch (err) {
      // Named, not swallowed: an empty screen and a broken screen look
      // identical and mean opposite things.
      setError(err?.message || "Your conversations could not be loaded.");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadRoom = useCallback(async (id) => {
    setRoom(null);
    try {
      setRoom(await fetchJson(`/api/staff/rooms/${id}`));
    } catch (err) {
      setError(err?.message || "That conversation could not be opened.");
    }
  }, []);

  useEffect(() => {
    if (openId) loadRoom(openId);
  }, [openId, loadRoom]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !openId) return;
    setSending(true);
    try {
      await fetchJson(`/api/staff/rooms/${openId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setText("");
      await loadRoom(openId);
      // The list re-reads too, so the preview and the ordering move with the
      // message rather than on some later refresh.
      loadList();
    } catch (err) {
      setError(err?.message || "That did not send.");
    } finally {
      setSending(false);
    }
  }

  async function startDirect(person) {
    try {
      const res = await fetchJson("/api/staff/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ with: { kind: person.kind, id: person.id } }),
      });
      setPicking(false);
      await loadList();
      setOpenId(res.roomId);
    } catch (err) {
      setError(err?.message || "That conversation could not be started.");
    }
  }

  if (error && !data) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Loading…
      </p>
    );
  }

  if (openId) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
            setRoom(null);
            loadList();
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" /> All conversations
        </button>

        {!room ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Loading…
          </p>
        ) : (
          <>
            <header className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2 break-words">
                {room.kind === "channel" ? (
                  <Hash size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Lock size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                {room.title}
              </h1>
              <p className="text-sm text-muted-foreground break-words">
                {room.topic ||
                  (room.kind === "direct"
                    ? "Just the two of you. Nobody else can read this."
                    : `${room.members.length} people`)}
              </p>
            </header>

            <div className="rounded-xl border border-border bg-card p-3">
              <MessageThread messages={room.messages} them={room.title} />
            </div>

            <form onSubmit={send} className="space-y-2">
              <label htmlFor="staff-reply" className="sr-only">
                Your message
              </label>
              <textarea
                id="staff-reply"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter breaks the line — what every
                  // messaging app does, and what a rep's hands already expect.
                  if (e.key === "Enter" && !e.shiftKey) send(e);
                }}
                rows={2}
                placeholder={`Message ${room.title}`}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Send size={15} aria-hidden="true" />
                )}
                Send
              </button>
              {error && <p className="text-xs text-muted-foreground">{error}</p>}
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            Everyone at FieldQuo — the reps on the phones and the people who fix things.
            Channels are for the team; a direct message is between the two of you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <Plus size={15} aria-hidden="true" /> Message someone
        </button>
      </header>

      {picking && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 pb-1">
            Everyone at FieldQuo
          </p>
          {data.people.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 pb-1">
              Nobody else has an active account yet.
            </p>
          ) : (
            data.people.map((p) => (
              <button
                key={`${p.kind}:${p.id}`}
                type="button"
                onClick={() => startDirect(p)}
                className="w-full text-left px-2 py-2 rounded-lg flex items-center gap-3 hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                >
                  {participantInitials(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.role}</span>
              </button>
            ))
          )}
        </div>
      )}

      {data.rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Your team channels appear here the moment somebody says something in one.
        </p>
      ) : (
        /* The same shape the texts list draws, on purpose — see the header. */
        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {data.rooms.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-muted transition-colors motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 grid h-9 w-9 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                >
                  {r.kind === "channel" ? "#" : participantInitials(r.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={`truncate ${r.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}
                    >
                      {r.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {when(r.lastAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${r.unread ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {r.lastBody
                        ? `${r.lastWasMine ? "You: " : ""}${r.lastBody}`
                        : r.topic || "No messages yet"}
                    </span>
                    {r.unread ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="shrink-0 min-w-[1.25rem] px-1 h-5 grid place-items-center rounded-full bg-amber-500 text-[11px] font-semibold text-white tabular-nums"
                        >
                          {r.unread}
                        </span>
                        <span className="sr-only">{r.unread} unread</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
