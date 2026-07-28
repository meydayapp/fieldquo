// app/app/quotes/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Send,
  RefreshCw,
  Pencil,
  Link2,
  Mail,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { reportResponseError } from "@/lib/clientErrors";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function QuoteDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(""); // "" | "quote" | "follow_up"
  const [justSent, setJustSent] = useState("");

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then(setQuote)
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Actually emails the client.
   *
   * This button used to call updateStatus("sent"), which changed a word on
   * screen and then hid itself because the status was no longer draft. Every
   * signal said the quote had gone out; nothing had been sent. It now calls a
   * route that emails, and only reports success once Resend has accepted the
   * message.
   */
  async function sendQuote(kind) {
    setSending(kind);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't send the email.");

      // Merge rather than refetch: the response carries exactly the fields
      // that changed, and a refetch would blank the page for a moment on the
      // one action the user most wants confirmation of.
      setQuote((q) => ({ ...q, ...data }));
      setJustSent(data.to);
      setTimeout(() => setJustSent(""), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending("");
    }
  }

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setQuote(await res.json());
    } else {
      // Marking a quote sent or accepted is a status change the whole
      // pipeline depends on. Failing at it silently means the board is wrong
      // and nobody knows why.
      setError(
        (await res.json().catch(() => null))?.error ||
          "Couldn't update the quote's status.",
      );
    }
    setActionLoading(false);
  }

  async function handleConvert() {
    setError("");
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not convert to invoice");
      return;
    }
    router.push(`/app/invoices/${data.id}`);
  }

  async function handleDelete() {
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/app/quotes"); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!quote)
    return (
      <div className="p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        Quote not found.
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <Link
        href="/app/quotes"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={14} /> Back to Quotes
      </Link>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {quote.quoteNumber}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[quote.status]}`}
            >
              {quote.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{quote.client?.name}</p>
        </div>

        <div className="flex gap-2">
          {/* Shown while the quote is still live, not only while it's a draft.
              Re-sending a quote a client says they never received is one of
              the most common things anyone needs to do, and the old button
              vanished the moment the status changed. */}
          {["draft", "sent"].includes(quote.status) && (
            <button
              onClick={() => sendQuote("quote")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "quote" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {quote.sentAt ? "Send again" : "Send"}
            </button>
          )}
          {quote.status === "sent" && quote.sentAt && (
            <button
              onClick={() => sendQuote("follow_up")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "follow_up" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              Follow up
            </button>
          )}
          {["sent", "draft"].includes(quote.status) && (
            <Link
              href={`/app/quote-approval/${id}`}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Link2 size={14} /> Get approved
            </Link>
          )}
          {quote.status === "accepted" && !quote.invoices?.length && (
            <button
              onClick={handleConvert}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw size={14} /> Convert to Invoice
            </button>
          )}
          <Link
            href={`/app/quotes/${id}/edit`}
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold"
          >
            <Pencil size={14} /> Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="border border-border text-muted-foreground p-2 rounded-full"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* The email trail. Every banner here is written only after Resend
          accepted the message, so "Emailed 3 July" is a fact rather than an
          intention — which is what the old sentAt recorded, since the Send
          button never sent anything. */}
      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 size={16} className="shrink-0" />
          Sent to <span className="font-medium">{justSent}</span>.
        </div>
      )}

      {(quote.sentAt || quote.followUpSentAt) && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-1.5">
          {quote.sentAt && (
            <TrailRow
              label="Emailed"
              at={quote.sentAt}
              detail={quote.sentToEmail}
            />
          )}
          {quote.followUpSentAt && (
            <TrailRow
              label={
                quote.followUpCount > 1
                  ? `Followed up (${quote.followUpCount}×)`
                  : "Followed up"
              }
              at={quote.followUpSentAt}
            />
          )}
          {/* clientDesignAt is reused by the public approval endpoint to
              record when the client decided — see the comment there. */}
          {["accepted", "declined"].includes(quote.status) &&
            quote.clientDesignAt && (
              <TrailRow
                label={quote.status === "accepted" ? "Approved" : "Declined"}
                at={quote.clientDesignAt}
                tone={quote.status === "accepted" ? "positive" : "muted"}
              />
            )}
        </div>
      )}

      {quote.invoices?.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          Already converted to invoice{" "}
          <Link
            href={`/app/invoices/${quote.invoices[0].id}`}
            className="underline font-medium"
          >
            {quote.invoices[0].invoiceNumber}
          </Link>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        {quote.scopeGroups?.map((group) => (
          <div key={group.id}>
            <h3 className="font-semibold text-foreground mb-2">{group.label}</h3>
            <div className="space-y-1">
              {(group.lineItems || []).map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm text-foreground"
                >
                  <span>
                    {item.description}{" "}
                    {item.quantity > 1 && `× ${item.quantity}`}
                  </span>
                  <span>${Number(item.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {quote.notes && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-1">Notes</h3>
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </div>
        )}

        {quote.addOns?.length > 0 && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Optional extras
            </h3>
            <div className="space-y-1">
              {quote.addOns.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between text-sm gap-3"
                >
                  <span
                    className={
                      a.selected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {a.description}
                    {a.selected && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                        added by client
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      a.selected ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    ${Number(a.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>${Number(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>${Number(quote.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground text-base">
            <span>Quoted total</span>
            <span>${Number(quote.total).toFixed(2)}</span>
          </div>

          {/* Shown only when it differs, so it reads as news rather than as
              a second total to reconcile. This is the figure the invoice is
              built from. */}
          {quote.acceptedTotal !== null &&
            quote.acceptedTotal !== undefined &&
            Number(quote.acceptedTotal) !== Number(quote.total) && (
              <div className="flex justify-between font-semibold text-green-700 dark:text-green-400 text-base pt-1">
                <span>Approved with extras</span>
                <span>${Number(quote.acceptedTotal).toFixed(2)}</span>
              </div>
            )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Quote"
        message="This quote and its line items will be permanently removed."
        itemName={quote.quoteNumber}
      />
    </div>
  );
}

/**
 * One line of the email trail.
 *
 * Absolute date AND relative age, because they answer different questions:
 * "when exactly" matters when a client disputes it, "how long ago" is what
 * tells you whether it's time to chase.
 */
function TrailRow({ label, at, detail, tone }) {
  const when = new Date(at);
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  const ago =
    days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap text-sm">
      <span
        className={
          tone === "positive"
            ? "font-medium text-green-700 dark:text-green-400"
            : "font-medium text-foreground"
        }
      >
        {label}
        {detail && (
          <span className="font-normal text-muted-foreground"> → {detail}</span>
        )}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {when.toLocaleString("en-CA", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        <span className="text-muted-foreground/60"> · {ago}</span>
      </span>
    </div>
  );
}
