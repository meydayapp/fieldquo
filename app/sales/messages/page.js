// app/sales/messages/page.js
//
// The rep's texts, drawn as a conversation rather than as a list of rows —
// with the check-in this contractor is due sitting in it, unsent.
//
// ══ What the owner asked for, in three clauses ═════════════════════════════
//
//   "can the /sales/messages look more like a text message type UI"
//   "the check-ins and follow-ups via text should be draft but not sent"
//   "when it should be sent should be able to be changed by the sales rep, or
//    set up a manual one based on a conversation"
//
// All three are on this screen. The first is lib/sales/messages/grouping.js
// plus MessageThread.js; the second and third are CheckInDraft.js plus the
// three routes under /api/sales/checkins.
//
// ══ Every refusal is the SERVER's ═════════════════════════════════════════
//
// The compose box does not decide whether a text may go: the suppression list
// is read fresh at the moment of the send, the texting window is judged in the
// prospect's own zone, and the mailing address CASL requires is checked there.
// This screen shows the answer it gets back. A second copy of those rules here
// is how a reply goes out at two in the morning to somebody who said STOP.
//
// What the screen DOES do is stop offering a control the server would refuse:
// a suppressed conversation gets no compose box and no send button, and the
// reason is printed instead. That is courtesy, not enforcement — the two
// checkins routes and the reply route each refuse it again on their own.
//
// ══ Nothing on this page sends anything on its own ═════════════════════════
//
// There is no interval, no scheduler and no effect that calls a send. Every
// path to the carrier starts with a press. scripts/check-sales-messages.mjs
// asserts that by scanning this file for a send call outside an event handler.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
  ShieldOff,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { raiseSupportTicket } from "@/lib/support/repClient";
import MessageThread, { conversationInitials } from "./MessageThread";
import CheckInDraft from "./CheckInDraft";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

function when(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ═══════════════════════════════════════════════════════════════════════════
// Escalation — only where a ticket could actually be raised
// ═══════════════════════════════════════════════════════════════════════════
//
// decideEscalation() refuses without a company attributed to this rep, and the
// route re-reads that attribution before writing. So the control renders only
// when the thread resolved to one of the rep's own companies, and is ABSENT —
// not disabled — otherwise. A button that 404s is the dead control AGENTS.md
// opens with.
function EscalatePanel({ company }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [raised, setRaised] = useState(null);

  if (!company) return null;

  if (raised) {
    return (
      <div className={CARD}>
        <p className="text-sm font-semibold text-foreground break-words">{raised.subject}</p>
        {/* The route's own sentence. It says in words whether anybody is on it
            — `assigned: false` is a real answer, and a screen that renders
            "Open" either way is the reassuring lie this channel exists to
            stop. */}
        <p className="text-sm text-muted-foreground break-words">{raised.statusLine}</p>
        <Link href="/sales/support" className={`${BTN} border border-border text-foreground w-full`}>
          <LifeBuoy size={16} aria-hidden="true" /> Follow it on my tickets
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${BTN} border border-border text-foreground w-full`}
      >
        <LifeBuoy size={16} aria-hidden="true" /> Hand this to tech support
      </button>
    );
  }

  return (
    <div className={CARD}>
      <p className="text-sm text-muted-foreground break-words">
        A technical problem with <span className="font-medium text-foreground">{company.name}</span>.
        Support sees the ticket, not this conversation — so say what happened.
      </p>
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-subject">
        One line
      </label>
      <input
        id="ticket-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Invoice emails are not arriving"
        className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      />
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-body">
        What happened
      </label>
      <textarea
        id="ticket-body"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      />
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-priority">
        How urgent
      </label>
      <select
        id="ticket-priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      >
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>

      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-sm text-amber-900 dark:text-amber-200 break-words">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !subject.trim() || !body.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { ticket } = await raiseSupportTicket({
                companyId: company.id,
                subject,
                body,
                priority,
              });
              setRaised(ticket);
            } catch (err) {
              setError(err?.message || "The ticket was not raised.");
            } finally {
              setBusy(false);
            }
          }}
          className={`${BTN} bg-primary text-primary-foreground`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LifeBuoy size={16} aria-hidden="true" />
          )}
          Raise it
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${BTN} text-muted-foreground`}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SalesMessagesPage() {
  const [list, setList] = useState(null);
  const [openWith, setOpenWith] = useState("");
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Rows the rep has typed that have not come back from the server yet, and
  // the ones that came back refused. Held here rather than merged into
  // `thread.messages`, so a refresh cannot resurrect a failed send as a real
  // message.
  const [inFlight, setInFlight] = useState([]);
  const [draftBusy, setDraftBusy] = useState("");
  const [draftError, setDraftError] = useState("");
  const [parking, setParking] = useState(false);
  const [parkText, setParkText] = useState("");
  const [parkWhen, setParkWhen] = useState("");

  const loadList = useCallback(async () => {
    setError("");
    try {
      setList((await fetchJson("/api/sales/messages")).conversations || []);
    } catch (err) {
      setError(err?.message || "Could not load your conversations.");
    }
  }, []);

  const loadThread = useCallback(async (e164) => {
    setError("");
    try {
      setThread(await fetchJson(`/api/sales/messages?with=${encodeURIComponent(e164)}`));
    } catch (err) {
      setError(err?.message || "Could not load that conversation.");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (openWith) loadThread(openWith);
  }, [openWith, loadThread]);

  // Messages, the rep's un-landed attempts, and any drafts — one list, ordered
  // by the grouping function rather than by three separate renders.
  const items = useMemo(() => {
    const messages = (thread?.messages || []).map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      at: m.sentAt,
      kind: "message",
      status: "sent",
    }));
    const drafts = (thread?.checkIns || []).map((c) => ({
      ...c,
      id: c.id,
      direction: "out",
      body: c.draftText,
      // A draft aimed at Thursday belongs at Thursday's end of the thread. One
      // with no time sits where it was written.
      at: c.scheduledFor || c.createdAt,
      kind: "draft",
    }));
    return [...messages, ...drafts, ...inFlight];
  }, [thread, inFlight]);

  const them =
    thread?.lead?.businessName || thread?.lead?.contactName || thread?.company?.name || openWith;

  async function send() {
    const words = text.trim();
    if (!words) return;
    const tempId = `pending:${Date.now()}`;
    setBusy(true);
    setError("");
    setInFlight((rows) => [
      ...rows,
      { id: tempId, direction: "out", body: words, at: new Date(), kind: "message", status: "pending" },
    ]);
    setText("");
    try {
      const next = await fetchJson("/api/sales/messages", {
        method: "POST",
        body: { to: openWith, text: words },
      });
      // The server's list replaces the optimistic row entirely — its body
      // carries the CASL footer, which is part of what was actually sent and
      // is not what the rep typed.
      setInFlight((rows) => rows.filter((r) => r.id !== tempId));
      setThread((t) => ({ ...t, messages: next.messages }));
      await loadList();
    } catch (err) {
      // The server's own sentence, not a rewrite of it. It names the blocker —
      // opted out, outside their hours, no mailing address — and the fix.
      const message = err?.message || "That did not send.";
      setInFlight((rows) =>
        rows.map((r) => (r.id === tempId ? { ...r, status: "failed", error: message } : r)),
      );
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  /** One place that talks to the check-in routes, so every path refreshes. */
  const checkInCall = useCallback(
    async (url, options, key) => {
      setDraftBusy(key);
      setDraftError("");
      try {
        await fetchJson(url, options);
        await loadThread(openWith);
        return true;
      } catch (err) {
        setDraftError(err?.message || "That did not work.");
        return false;
      } finally {
        setDraftBusy("");
      }
    },
    [loadThread, openWith],
  );

  // ── One conversation ────────────────────────────────────────────────────
  if (openWith) {
    const suppressed = Boolean(thread?.suppressed);
    const blockers = thread?.blockers || [];

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setOpenWith("");
            setThread(null);
            setInFlight([]);
          }}
          // min-h-[44px]: it is the only way back on a phone.
          className="min-h-[44px] text-sm text-muted-foreground flex items-center gap-1"
        >
          <ArrowLeft size={14} aria-hidden="true" /> All conversations
        </button>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground break-words">{them}</h1>
          <p className="text-sm text-muted-foreground tabular-nums break-words">
            {openWith}
            {thread?.lead ? (
              <>
                {" · "}
                <Link href={`/sales/leads/${thread.lead.id}`} className="underline">
                  open the lead
                </Link>
              </>
            ) : null}
            {thread?.company ? (
              <>
                {" · "}
                <Link href="/sales/companies" className="underline">
                  {thread.company.name} is a customer
                </Link>
              </>
            ) : null}
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="break-words">{error}</p>
            </div>
          </div>
        ) : null}

        {thread?.checkInError ? (
          // Absence of a statement is not a statement: "we could not read the
          // drafts" is a different claim from "there are none", and the rep
          // gets the one that is true.
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground break-words">
            {thread.checkInError}
          </div>
        ) : null}

        <div className={CARD}>
          {!thread ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
              Loading…
            </p>
          ) : (
            <MessageThread
              messages={items}
              them={them}
              onRetry={(m) => {
                // Back into the box, not straight back to the carrier. A retry
                // that re-sends on one press is how a refused message becomes
                // two sent ones once the blocker clears.
                setText(m.body);
                setInFlight((rows) => rows.filter((r) => r.id !== m.id));
              }}
              renderDraft={(d) => (
                <CheckInDraft
                  draft={d}
                  busy={draftBusy === d.id}
                  // The failure sentence is shown once, below the thread,
                  // rather than repeated inside every draft. One banner is one
                  // place to look.
                  canSend={!suppressed}
                  onSaveText={(next) =>
                    checkInCall(`/api/sales/checkins/${d.id}`, { method: "PATCH", body: { text: next } }, d.id)
                  }
                  onReschedule={(iso) =>
                    checkInCall(
                      `/api/sales/checkins/${d.id}`,
                      { method: "PATCH", body: { scheduledFor: iso } },
                      d.id,
                    )
                  }
                  onDismiss={() =>
                    checkInCall(
                      `/api/sales/checkins/${d.id}`,
                      { method: "PATCH", body: { dismiss: true } },
                      d.id,
                    )
                  }
                  onSend={async () => {
                    const done = await checkInCall(
                      `/api/sales/checkins/${d.id}/send`,
                      { method: "POST" },
                      d.id,
                    );
                    if (done) await loadList();
                  }}
                />
              )}
            />
          )}
        </div>

        {draftError ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 break-words">
            {draftError}
          </div>
        ) : null}

        {/* ── The engine's suggestion, when it has one ────────────────── */}
        {thread?.suggestion ? (
          <CheckInDraft
            draft={thread.suggestion}
            suggestion
            busy={draftBusy === "suggestion"}
            canSend={!suppressed}
            onAdopt={() =>
              checkInCall(
                "/api/sales/checkins",
                { method: "POST", body: { to: openWith, origin: "engine" } },
                "suggestion",
              )
            }
            onDismiss={() =>
              checkInCall(
                "/api/sales/checkins",
                { method: "POST", body: { to: openWith, origin: "engine", dismiss: true } },
                "suggestion",
              )
            }
          />
        ) : null}

        {/* ── Suppressed: no compose box at all ───────────────────────── */}
        {suppressed ? (
          <div className="rounded-xl border border-border bg-muted p-4 space-y-2">
            <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
              <ShieldOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              This conversation is closed.
            </p>
            {blockers
              .filter((b) => b.code === "suppressed")
              .map((b) => (
                <p key={b.code} className="text-sm text-muted-foreground break-words">
                  {b.title} {b.fix}
                </p>
              ))}
            <p className="text-sm text-muted-foreground break-words">
              Nothing can be sent to this number on any channel — not a reply, not a check-in, not a
              follow-up. FieldQuo removes somebody from that list only on a superadmin&rsquo;s written
              request, because the row is the evidence behind a three-year obligation.
            </p>
          </div>
        ) : (
          <>
            <div className={CARD}>
              <label className="block text-sm font-medium text-foreground" htmlFor="reply">
                Your reply
              </label>
              <textarea
                id="reply"
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Thursday at eight works — I'll call then."
              />
              {/* Said before they type it, not after it is sent. The footer is not
                  optional and it is not the rep's to remove: CASL requires the
                  sender's address and an unsubscribe in every commercial message,
                  and this one is arranging the sale of software. */}
              <p className="text-xs text-muted-foreground break-words">
                FieldQuo&rsquo;s address and &ldquo;Reply STOP to opt out&rdquo; are added to the end.
                That is the law, not a setting — every commercial text carries them. Texts go from
                FieldQuo&rsquo;s one shared sales number, not from your own line.
              </p>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={send}
                className={`${BTN} bg-primary text-primary-foreground w-full`}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Send size={16} aria-hidden="true" />
                )}
                Send it
              </button>
            </div>

            {/* ── A follow-up the rep invents from the conversation ────── */}
            {parking ? (
              <div className={CARD}>
                <label className="block text-sm font-medium text-foreground" htmlFor="park-text">
                  What do you want to say?
                </label>
                <textarea
                  id="park-text"
                  rows={3}
                  value={parkText}
                  onChange={(e) => setParkText(e.target.value)}
                  placeholder="Following up on the quote we talked about — are you happy to go ahead?"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
                />
                <label className="block text-sm font-medium text-foreground" htmlFor="park-when">
                  When should this be in front of you?
                </label>
                <input
                  id="park-when"
                  type="datetime-local"
                  value={parkWhen}
                  onChange={(e) => setParkWhen(e.target.value)}
                  className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
                />
                <p className="text-xs text-muted-foreground break-words">
                  It waits as a draft. FieldQuo does not send it — you do, when you are ready. The time
                  has to fall inside this contractor&rsquo;s texting hours, or there would be nothing to
                  press send on when it arrives.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={draftBusy === "park" || !parkText.trim()}
                    onClick={async () => {
                      const at = parkWhen ? new Date(parkWhen) : null;
                      const done = await checkInCall(
                        "/api/sales/checkins",
                        {
                          method: "POST",
                          body: {
                            to: openWith,
                            text: parkText,
                            scheduledFor: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
                          },
                        },
                        "park",
                      );
                      if (done) {
                        setParking(false);
                        setParkText("");
                        setParkWhen("");
                      }
                    }}
                    className={`${BTN} bg-primary text-primary-foreground`}
                  >
                    {draftBusy === "park" ? (
                      <Loader2
                        size={16}
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <CalendarPlus size={16} aria-hidden="true" />
                    )}
                    Park it as a draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setParking(false)}
                    className={`${BTN} text-muted-foreground`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setParking(true)}
                className={`${BTN} border border-border text-foreground w-full`}
              >
                <CalendarPlus size={16} aria-hidden="true" /> Park a follow-up for later
              </button>
            )}
          </>
        )}

        <EscalatePanel company={thread?.company || null} />
      </div>
    );
  }

  // ── The list ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Texts</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everyone you have texted, and everyone who has written back. A conversation is with a
          person, so it is grouped by their number — one business may sit behind two leads and the
          reply belongs to the same thread either way.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {!list ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
          Loading…
        </p>
      ) : list.length === 0 ? (
        // Nothing invented to fill it. A rep who has texted nobody has no
        // conversations, which is a true and ordinary state.
        <div className={CARD}>
          <p className="text-sm text-muted-foreground break-words">
            Nothing yet. The first text to a prospect goes from their lead — it carries your signup
            link and the identification a first contact needs. After that, the conversation lives
            here.
          </p>
          <Link href="/sales/leads" className={`${BTN} border border-border text-foreground w-full`}>
            <MessageSquare size={16} aria-hidden="true" /> Go to my leads
          </Link>
        </div>
      ) : (
        /* ── The list a messaging app has ────────────────────────────────
           This was a stack of bordered cards showing a raw E.164 number and
           two lines of body, and it is the screen a rep LANDS on — so the
           thread rewrite next door was invisible to anyone who did not click
           into a conversation. The owner looked at Texts, saw the same cards,
           and said nothing had changed. They were right about the screen they
           were looking at.

           Now: an avatar gutter matching the thread's, the name where there is
           one, one line of preview, the time on the right, and the waiting
           state as a dot rather than a sentence — the shape every phone draws,
           and the same gutter the thread underneath it uses. */
        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {list.map((c) => (
            <li key={c.e164}>
              <button
                type="button"
                onClick={() => setOpenWith(c.e164)}
                className="w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-muted transition-colors motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 grid h-9 w-9 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                >
                  {conversationInitials(c)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={`truncate ${c.unanswered ? "font-semibold text-foreground" : "font-medium text-foreground"} ${c.name ? "" : "tabular-nums"}`}
                    >
                      {c.name || c.e164}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {when(c.lastAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${c.unanswered ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {/* Said, not implied: without it an outbound line reads
                          as something they sent us. */}
                      {c.lastDirection === "in" ? "" : "You: "}
                      {c.lastBody}
                    </span>
                    {/* The dot IS the status, and the text beside it is for a
                        screen reader — a coloured dot alone states nothing to
                        somebody who cannot see it. */}
                    {c.unanswered ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="shrink-0 h-2 w-2 rounded-full bg-amber-500"
                        />
                        <span className="sr-only">they wrote last, waiting on you</span>
                      </>
                    ) : null}
                  </span>
                  {/* The number stays reachable when a name has replaced it —
                      a rep checking they are texting the right line should not
                      have to open the thread to see it. */}
                  {c.name ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground tabular-nums">
                      {c.e164}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
