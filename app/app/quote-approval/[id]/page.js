// app/app/quote-approval/[id]/page.js
//
// The internal side of getting a quote approved: mint the share link, see
// what the client has done with it, and record a decision they gave you some
// other way.
//
// That last part is the reason this page exists rather than just a "copy link"
// button on the quote. Most quotes in this trade are approved on the phone or
// in someone's kitchen, not by clicking a link. If the only path to "accepted"
// runs through the client-facing page, the pipeline numbers are wrong.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

export default function QuoteApprovalPage() {
  const { formatDate } = useCompanyPreferences();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [q, s] = await Promise.all([
        fetch(`/api/quotes/${id}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/quotes/${id}/share`).then((r) => (r.ok ? r.json() : null)),
      ]);
      setQuote(q);
      setShare(s);
    } catch {
      setError("Couldn't load this quote.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createLink(rotate = false) {
    setBusy(rotate ? "rotate" : "create");
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't create the link.");
      setShare(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't reach the clipboard — select the link and copy it.");
    }
  }

  async function record(status) {
    setBusy(status);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't update the quote.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse h-80 bg-accent rounded-xl" />
    );

  if (!quote)
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto text-sm text-muted-foreground">
        Quote not found.
      </div>
    );

  const decided = ["accepted", "declined"].includes(quote.status);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href={`/app/quotes/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to {quote.quoteNumber}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Get this approved</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {quote.quoteNumber} · {quote.client?.name} · {money(quote.total)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {quote.status === "draft" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          This quote is still a draft. The public link stays closed until it&apos;s
          marked as sent — clients can&apos;t open a quote you&apos;re still
          working on.
        </div>
      )}

      {/* Share link */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Link2 size={16} className="text-muted-foreground" /> Client link
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Anyone with this link can see the quote and approve it. Send it only to
          the client.
        </p>

        {share?.url ? (
          <>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={share.url}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm font-mono bg-muted text-foreground"
              />
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-semibold text-foreground shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-600 dark:text-green-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex gap-4 flex-wrap text-sm">
              <a
                href={share.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={13} /> Preview what they see
              </a>
              <button
                onClick={() => createLink(true)}
                disabled={busy === "rotate"}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {busy === "rotate" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Replace link
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Replacing the link kills the old one. Use it if the wrong person
              got a copy — but any email already sent will stop working.
            </p>
          </>
        ) : (
          <button
            onClick={() => createLink(false)}
            disabled={busy === "create"}
            className="mt-4 inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {busy === "create" && <Loader2 size={14} className="animate-spin" />}
            Create client link
          </button>
        )}
      </div>

      {/* Where it stands */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">Where it stands</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Status
            </dt>
            <dd className="mt-1 font-medium text-foreground capitalize">
              {quote.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Sent
            </dt>
            <dd className="mt-1 text-foreground">
              {quote.sentAt
                ? formatDate(quote.sentAt)
                : "Not yet"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Valid until
            </dt>
            <dd className="mt-1 text-foreground">
              {quote.validUntil
                ? formatDate(quote.validUntil)
                : "No expiry"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Record a decision made elsewhere */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">Record their answer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          If they told you over the phone or in person, log it here so the
          pipeline stays accurate.
        </p>

        {decided ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Already marked{" "}
            <span className="font-semibold text-foreground">{quote.status}</span>.
            Change it from the quote page if that was wrong.
          </div>
        ) : (
          <div className="mt-4 flex gap-3 flex-wrap">
            <button
              onClick={() => record("accepted")}
              disabled={Boolean(busy) || quote.status === "draft"}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {busy === "accepted" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              They approved it
            </button>
            <button
              onClick={() => record("declined")}
              disabled={Boolean(busy) || quote.status === "draft"}
              className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {busy === "declined" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              They declined
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
