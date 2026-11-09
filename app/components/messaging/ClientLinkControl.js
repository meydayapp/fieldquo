"use client";

// app/components/messaging/ClientLinkControl.js
//
// "Link this conversation to a client" — the client who ALREADY EXISTS, found
// by typing. The owner asked for it on 2026-11-08: the inbox could create a
// client from a conversation and could open the one already linked, but the
// everyday case — the homeowner is in the book, under a number this thread
// arrived on from somewhere else — had no control at all.
//
// Every channel, not just text. A Messenger thread, an Instagram DM, a
// WhatsApp message, a website chat, a text and a filed email are one
// MessageThread with one clientId, and "the way we do with other
// conversations" is the requirement: the caller draws this without asking
// what platform the row is on.
//
// ══ What it is NOT ═════════════════════════════════════════════════════════
//
// Not a second way to CREATE a client. That exists already — the contact-card
// button in the thread (addContactAsClient in app/app/messages/page.js) posts
// /api/clients behind its own `clientsProperties: full_edit` gate and links
// the row it got back. Offering "New client" here as well would be a second
// place that creates a client, which is how the two drift.
//
// Not a silent re-point either. A thread that is already linked shows WHOSE it
// is and says, in the panel, that picking somebody else moves the conversation
// to them — because the record this writes is the company's sales history, and
// a mis-link quietly overwritten is a lost enquiry.
//
// ══ Why it does not reuse the quote builder's ClientPicker ═════════════════
//
// app/components/quotes/builder/ClientPicker.js is a presentational section of
// a FORM: the parent owns the whole client book in state, filters it, and owns
// every field of the quick-add modal (showNewClient, newClient,
// onNewClientChange, onCreateClient, creating, error, companyLanguage) plus a
// `locked` state that only means something to a sent quote. The inbox holds
// none of that and must not start: a contractor's book is long, the search
// that matters here runs on the SERVER (GET /api/clients?q= matches name,
// email, phone and street, and redacts contact fields the reader may not see),
// and this screen has no business owning a client-creation form. So this is
// not a fork of that component — it is the other shape, the type-ahead, which
// is what the calendar's own picker (app/app/appointments/page.js) already is.
//
// That calendar picker is the one this SHOULD eventually be: same route, same
// 250 ms debounce, same two-character floor. It is left where it is on purpose
// — it also carries "New client", an `isNew` draft the appointment form
// resolves on save, and a value shape the booking screen owns — so folding the
// two together is a change to a working control on a screen nobody asked about.
// The next person to need a third one should extract this file, not copy it.
//
// ══ Who may see it ═════════════════════════════════════════════════════════
//
// The caller decides, from the two gates the two routes behind this actually
// enforce: PATCH /api/messaging/threads/[id] wants `requests:
// view_create_edit` and GET /api/clients hands a crew member only the
// households on their own jobs. A control drawn for anyone else would be the
// dead button AGENTS.md's first rule forbids.

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

/** Enough typed for a search to mean something — the calendar picker's rule. */
const MIN_CHARS = 2;

export default function ClientLinkControl({ thread, busy, onLink, triggerClassName = "", t }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [linking, setLinking] = useState(null);

  const threadId = thread?.id || null;

  // A different conversation is a different question: close and forget.
  useEffect(() => {
    setOpen(false);
    setQ("");
    setRows(null);
    setLoadFailed(false);
  }, [threadId]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < MIN_CHARS) {
      setRows(null);
      setLoadFailed(false);
      return undefined;
    }
    let live = true;
    setSearching(true);
    setLoadFailed(false);
    const handle = setTimeout(() => {
      fetchJson(`/api/clients?q=${encodeURIComponent(term)}`)
        .then((list) => {
          if (!live) return;
          setRows(Array.isArray(list) ? list.slice(0, 8) : []);
        })
        .catch(() => {
          // The failure branch, said on the panel rather than swallowed: an
          // empty result list and a failed search are different facts, and
          // "no clients match" on a 500 is how somebody creates a duplicate
          // client for a homeowner who was there all along.
          if (!live) return;
          setRows(null);
          setLoadFailed(true);
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(handle);
    };
  }, [q, open]);

  if (!threadId) return null;

  const linked = Boolean(thread.clientId);
  // The name is only on the payload for a member the thread route decided may
  // read client records; without it the warning still names the fact.
  const linkedName = thread.client?.name || t("app.messages.webMatch.aClient");

  async function pick(client) {
    if (!client?.id || client.id === thread.clientId) {
      setOpen(false);
      return;
    }
    setLinking(client.id);
    try {
      // The page's own patchThread: it reports the server's sentence on a
      // refusal and re-reads the thread on success. Not a second fetch here —
      // that copy would be the one that stops refreshing.
      const saved = await onLink(client.id);
      if (saved) {
        setOpen(false);
        setQ("");
        setRows(null);
      }
    } finally {
      setLinking(null);
    }
  }

  const term = q.trim();
  return (
    <div data-client-link>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className={triggerClassName}
          data-client-link-open
        >
          <UserPlus size={13} aria-hidden="true" />
          {linked ? t("app.messages.linkClient.change") : t("app.messages.linkClient.link")}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-3" data-client-link-panel>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{t("app.messages.linkClient.title")}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 inline-flex min-h-[32px] min-w-[32px] items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={t("app.action.cancel")}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Already linked: say so before the search box, not after the
              press. The conversation moves — nothing about the client it is
              leaving changes — and that is what this sentence says. */}
          {linked ? (
            <p className="mt-1.5 text-xs text-muted-foreground" data-client-link-replace>
              {t("app.messages.linkClient.replaceWarning", { name: linkedName })}
            </p>
          ) : null}

          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder={t("app.messages.linkClient.search")}
            aria-label={t("app.messages.linkClient.search")}
            data-client-link-search
          />

          {term.length < MIN_CHARS ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("app.messages.linkClient.hint")}</p>
          ) : (
            <ul className="mt-1.5 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {searching && rows === null && !loadFailed ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{t("app.messages.linkClient.searching")}</li>
              ) : null}
              {loadFailed ? (
                <li className="px-3 py-2 text-sm text-foreground" data-client-link-error>
                  {t("app.messages.linkClient.loadError")}
                </li>
              ) : null}
              {(rows || []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    disabled={busy || Boolean(linking)}
                    className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      {c.phone || c.email || c.address ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.phone, c.email, c.address].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    {linking === c.id ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" /> : null}
                  </button>
                </li>
              ))}
              {rows !== null && rows.length === 0 && !searching ? (
                <li className="px-3 py-2 text-sm text-muted-foreground" data-client-link-empty>
                  {t("app.messages.linkClient.noMatch")}
                </li>
              ) : null}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
