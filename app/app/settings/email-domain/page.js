// app/app/settings/email-domain/page.js
//
// Lets a company send client emails from its OWN domain instead of FieldQuo's
// shared one. Registers the domain with Resend, shows the DNS records to add,
// and polls verification.
//
// The mental model to keep in mind while reading this: nothing here creates a
// mailbox. quotes@send.theircompany.com never needs to exist as an inbox —
// verifying the domain is what grants permission to send as it. Replies are a
// separate concern, handled by Company.email (see ReplyToPromptModal).
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import ReplyToPromptModal from "@/app/components/settings/ReplyToPromptModal";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const STATUS_META = {
  verified: {
    label: "Verified",
    className: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Waiting on DNS",
    className: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    Icon: Clock,
  },
  failed: {
    label: "Verification failed",
    className: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    Icon: AlertCircle,
  },
  not_started: {
    label: "Not set up",
    className: "bg-muted text-muted-foreground border-border",
    Icon: AlertCircle,
  },
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Copy value"
    >
      {copied ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

export default function EmailDomainPage() {
  const [data, setData] = useState(null);
  const [domainInput, setDomainInput] = useState("");
  const [localInput, setLocalInput] = useState("quotes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/email-domain");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load");
      setData(json);
      setLocalInput(json.emailFromLocal || "quotes");
      setDomainInput(json.emailDomain || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while DNS is propagating — it can take minutes to hours, and making
  // someone sit refreshing the page is a poor experience.
  useEffect(() => {
    if (data?.emailDomainStatus !== "pending") return;
    const t = setInterval(() => recheck(true), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.emailDomainStatus]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not connect domain");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function recheck(silent = false) {
    if (!silent) setBusy(true);
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else if (!silent) {
        // `silent` is the background poll that runs while DNS propagates —
        // surfacing an error on every one of those would bury the page in
        // messages about a check the user never asked for. A check they
        // clicked, though, has to say what happened.
        setError(json?.error || "Couldn't check your domain just now.");
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function saveLocal() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailFromLocal: localInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !confirm(
        "Disconnect this domain? Your emails will go back to sending from FieldQuo's shared address.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setDomainInput("");
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const status = data?.emailDomainStatus || "not_started";
  const meta = STATUS_META[status] || STATUS_META.not_started;
  const StatusIcon = meta.Icon;
  const records = Array.isArray(data?.emailDomainRecords)
    ? data.emailDomainRecords
    : [];
  const isConnected = Boolean(data?.emailDomain);

  return (
    <div className="max-w-3xl space-y-6">
      <ReplyToPromptModal
        context="quotes and invoices"
        onSaved={(email) => setData((d) => ({ ...(d || {}), email }))}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Domain</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send client emails from your own domain instead of ours. Better
          deliverability, and no &ldquo;via fieldquo.com&rdquo; next to your
          name.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Current status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground">
              {isConnected ? data.emailDomain : "No domain connected"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isConnected
                ? `Emails will send from ${data.emailFromLocal || "quotes"}@${data.emailDomain}`
                : "Your emails currently send from FieldQuo's shared address, using your company name."}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${meta.className}`}
          >
            <StatusIcon size={13} />
            {meta.label}
          </span>
        </div>

        {isConnected && (
          <div className="flex flex-wrap gap-2 mt-4">
            {status !== "verified" && (
              <button
                onClick={() => recheck()}
                disabled={busy}
                className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Check verification
              </button>
            )}
            <button
              onClick={disconnect}
              disabled={busy}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-muted disabled:opacity-60"
            >
              <Trash2 size={14} />
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connect a domain */}
      {!isConnected && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Connect a domain</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Use a subdomain like{" "}
            <span className="font-mono text-foreground">
              send.yourcompany.com
            </span>{" "}
            rather than your root domain. It keeps this separate from your
            normal email so it can&apos;t interfere with your existing inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputClass}
              placeholder="send.yourcompany.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
            <button
              onClick={connect}
              disabled={busy || !domainInput.trim()}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Connect
            </button>
          </div>
        </div>
      )}

      {/* DNS records */}
      {isConnected && records.length > 0 && status !== "verified" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Add these DNS records</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add them wherever your domain is managed (Cloudflare, GoDaddy,
            Namecheap...). Changes usually apply within an hour, but can take up
            to 24. This page rechecks itself every 30 seconds.
          </p>

          <div className="space-y-3">
            {records.map((r, i) => (
              <div
                key={i}
                className="border border-border rounded-lg p-3 text-sm bg-muted/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {r.record || r.type}
                  </span>
                  {r.status && (
                    <span className="text-xs text-muted-foreground">({r.status})</span>
                  )}
                </div>
                <dl className="space-y-1.5">
                  {[
                    ["Type", r.type],
                    ["Name", r.name],
                    ["Value", r.value],
                    ["Priority", r.priority],
                    ["TTL", r.ttl],
                  ]
                    .filter(([, v]) => v !== undefined && v !== null && v !== "")
                    .map(([label, value]) => (
                      <div key={label} className="flex items-start gap-2">
                        <dt className="w-16 shrink-0 text-xs text-muted-foreground pt-0.5">
                          {label}
                        </dt>
                        <dd className="flex-1 font-mono text-xs text-foreground break-all">
                          {String(value)}
                        </dd>
                        <CopyButton value={String(value)} />
                      </div>
                    ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sender address */}
      {isConnected && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Sender address</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The address clients see. This doesn&apos;t need to be a real
            mailbox — verifying the domain is what lets us send as it.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="flex items-center flex-1 min-w-0">
              <input
                className={`${inputClass} rounded-r-none`}
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
              />
              <span className="border border-l-0 border-border rounded-r-lg px-3 py-2 text-sm text-muted-foreground bg-muted whitespace-nowrap">
                @{data.emailDomain}
              </span>
            </div>
            <button
              onClick={saveLocal}
              disabled={busy || localInput === data.emailFromLocal}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 shrink-0"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Replies */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Replies</h2>
        <p className="text-sm text-muted-foreground">
          When a client replies to a quote or invoice, it goes to{" "}
          {data?.email ? (
            <span className="font-medium text-foreground">{data.email}</span>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              your account owner&apos;s email, because no company email is set
            </span>
          )}
          . Change it under Company Settings.
        </p>
      </div>
    </div>
  );
}
