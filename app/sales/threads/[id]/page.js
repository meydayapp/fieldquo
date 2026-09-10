// app/sales/threads/[id]/page.js
//
// One conversation, and the box to answer it.
//
// ══ Every message body is rendered as TEXT ═════════════════════════════════
//
// An inbound body is written by a stranger and arrives through a mail provider.
// It is stored as text (parseInboundEmail strips markup out of an html-only
// message on the way in) and it is rendered inside a `whitespace-pre-wrap`
// element — never with dangerouslySetInnerHTML. That is the whole defence, and
// it is deliberately boring: a prospect who replies with a <script> tag gets a
// prospect who appears to have typed a <script> tag.
//
// `params` is a Promise in Next 16 — read with `use()`.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Loader2, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";
import OutreachNotice from "../../leads/OutreachNotice";
import MessageThread from "../../messages/MessageThread";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SalesThreadPage({ params }) {
  const { id } = use(params);
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson(`/api/sales/threads/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function reply(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/sales/threads/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ body: message }, "reply"),
      });
      setMessage("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const thread = data?.thread;
  const outreach = data?.outreach;
  const optedOut = data?.optedOut;
  // Same field, same reason as app/sales/leads/[id]/page.js: the route computes
  // WHICH entry closed this and how it got there, and this screen used to
  // overwrite that with one mechanism.
  //
  // What is NEW is the language. The route now sends the catalogue key that
  // composed the sentence as well as the sentence, so this screen resolves it
  // against the rep's own catalogue instead of printing the server's English.
  // The English stays the fallback — a route that has not been redeployed
  // sends no key, and an English sentence is a much smaller failure than a
  // blank where the reason should be.
  //
  // Still ONE expression on screen, and still not a mechanism this screen
  // decided: which of the eight sources closed the channel is the route's
  // answer, and all this does is choose the language it is read in.
  const optedOutReason = data?.optedOutReasonKey
    ? t(data.optedOutReasonKey, {
        ...(data.optedOutReasonParams || {}),
        // A suppression row with no requestedAt cannot be written by
        // suppress(), but the column is nullable — so the slot gets a
        // translated "not recorded" rather than the word "null" or an
        // invented day on a compliance notice.
        date:
          data.optedOutReasonParams?.date || t("app.salesSuppression.dateNotRecorded"),
      })
    : data?.optedOutReason;

  if (!thread) {
    return (
      <div className="space-y-4">
        <Link href="/sales/threads" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {t("app.salesNotes.threadsHeading")}
        </Link>
        {error ? (
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> {t("app.salesNotes.loading")}
          </div>
        )}
      </div>
    );
  }

  const canReply = Boolean(outreach?.canSend) && !optedOut;

  return (
    <div className="space-y-6">
      <Link href="/sales/threads" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {t("app.salesNotes.threadsHeading")}
      </Link>

      <div>
        <h1 className="text-xl font-bold text-foreground">{thread.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <Link href={`/sales/leads/${thread.lead.id}`} className="underline">
            {thread.lead.businessName}
          </Link>
          {thread.lead.email ? ` · ${thread.lead.email}` : ""}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── One conversation layout, not two ─────────────────────────────
          This screen drew every message as a bordered card headed "From
          someone@somewhere · 3:14 PM", which reads as a mail log rather than a
          conversation, while /sales/messages next door drew the same thing as
          a proper thread. Two screens doing one job in two visual languages is
          AGENTS.md failure class #4, and the copy nobody looks at is the one
          that rots — this was it.

          The addresses are not lost, they have moved: they belong in the
          thread header, said once, rather than repeated above every line. What
          a rep needs down the page is who spoke and when. */}
      <MessageThread
        messages={thread.messages.map((m) => ({
          id: m.id,
          body: m.body,
          direction: m.direction,
          // MessageThread reads `at`; the mail schema calls it sentAt. Mapped
          // here rather than renamed in the API, because the SMS thread and
          // the mail thread have genuinely different columns and one of them
          // has to translate.
          at: m.sentAt,
        }))}
        them={thread.lead?.contactName || thread.lead?.businessName || t("app.salesNotes.threadThem")}
      />

      <OutreachNotice outreach={outreach} />

      {optedOut && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-2 text-sm">
          <Ban size={16} className="mt-0.5 text-red-700 dark:text-red-300 shrink-0" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">
              {t("app.salesNotes.optedOutHeadline")}
            </p>
            {/* The route still composes this sentence — WHICH entry closed
                this prospect and how — and this screen still does not get a
                second opinion about it. What the route now sends alongside the
                sentence is the catalogue key it was composed from, which is
                what "it stays English until the route that writes it keys it"
                was waiting for. Resolved above, printed here. */}
            {optedOutReason ? (
              <p className="text-red-800 dark:text-red-300/90">{optedOutReason}</p>
            ) : null}
            <p className="text-red-800 dark:text-red-300/90">
              {t("app.salesNotes.optedOutServerRefusal")}
            </p>
          </div>
        </div>
      )}

      {canReply && (
        <form onSubmit={reply} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">{t("app.salesNotes.replyHeading")}</div>
          <textarea
            required
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("app.salesNotes.replyPlaceholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("app.salesNotes.sendReply")}
          </button>
        </form>
      )}
    </div>
  );
}
