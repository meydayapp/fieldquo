// app/app/settings/email-domain/page.js
//
// Lets a company send client emails from its OWN domain instead of FieldQuo's
// shared one. Registers the domain with Resend, shows the DNS records to add,
// and polls verification.
//
// The mental model to keep in mind while reading this: nothing here creates a
// mailbox. quotes@send.theircompany.com never needs to exist as an inbox —
// verifying the domain is what grants permission to send as it. Replies are a
// separate concern, handled by Company.email.
//
// ── The top card: what clients actually see ─────────────────────────────────
//
// The owner, 2026-10-09: "in the domains page we should know what is the
// company's email address so that outgoing emails point to that and not to
// the owner's log in email." TrueFinish's replies had gone to the owner's
// Gmail for weeks because Company.email was blank, and nothing on this page
// said so in a way that could be fixed here. So the page opens on:
//
//   "Clients see: From … · Replies to …" — computed on the server by the
//     send path's own resolveSender/senderFor (lib/email/senderStatus.js),
//     never re-described in JSX, so it cannot disagree with a real send;
//   "Replies go to" — Company.email, editable in place, saved through the
//     company profile's own route (lib/email/companyReplyTo.js). It replaced
//     the ReplyToPromptModal this page used to open: a modal and an inline
//     field asking for the same value on one screen is one prompt too many.
//
// The company email also drives two PROPOSALS (lib/email/senderSuggestion.js):
// its domain prefills the empty connect field, and when the connected domain
// is that domain, "Use info@…" is offered as a one-tap change of the From
// local part. Neither writes anything until it is pressed.
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
import { reportResponseError } from "@/lib/clientErrors";
import { saveCompanyEmail } from "@/lib/email/companyReplyTo";
import { normaliseDomain, shouldOfferLocal } from "@/lib/email/senderSuggestion";
import { useTranslation } from "@/app/hooks/useTranslation";

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
  const { t } = useTranslation();
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
      aria-label={t("app.setEmailDomain.copyValue")}
    >
      {copied ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

/**
 * "Send from info@yourcompany.com?" — the company email's local part, offered
 * and never applied on its own. `suggestion.from` is the From line senderFor()
 * builds for it on the server, printed as-is.
 */
function SenderSuggestion({ suggestion, onUse, busy }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-muted/50">
      <p className="text-sm font-semibold text-foreground break-all">
        {t("app.setEmailDomain.suggestTitle", { address: suggestion.address })}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{t("app.setEmailDomain.suggestBody")}</p>
      <p className="text-sm text-foreground mt-2 break-all">
        {t("app.setEmailDomain.suggestFromLine", { from: suggestion.from })}
      </p>
      <button
        type="button"
        onClick={onUse}
        disabled={busy}
        className="mt-3 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 max-w-full truncate"
      >
        {t("app.setEmailDomain.suggestUse", { address: suggestion.address })}
      </button>
    </div>
  );
}

export default function EmailDomainPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [domainInput, setDomainInput] = useState("");
  const [localInput, setLocalInput] = useState("quotes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // "Replies go to" — Company.email, edited in place.
  const [replyEditing, setReplyEditing] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/email-domain");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("app.setEmailDomain.loadError"));
      setData(json);
      setLocalInput(json.emailFromLocal || "quotes");
      // Prefilled when nothing is connected yet — from the company email's
      // domain, else the website given at signup (domainPrefill says which).
      // A proposal they can edit; Connect is still their press.
      setDomainInput(json.emailDomain || json.domainPrefill?.domain || "");
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
    const timer = setInterval(() => recheck(true), 30000);
    return () => clearInterval(timer);
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
      if (!res.ok) throw new Error(json.error || t("app.setEmailDomain.connectError"));
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
        setError(json?.error || t("app.setEmailDomain.checkError"));
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
      if (!res.ok) throw new Error(json.error || t("app.setEmailDomain.saveError"));
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Company.email through the company profile's own route. The status line
  // is recomputed by the server afterwards rather than patched here — "who
  // replies reach" is resolveSender's answer, not this component's.
  async function saveReplyTo() {
    setReplySaving(true);
    setReplyError("");
    try {
      const r = await saveCompanyEmail(replyInput);
      if (!r.ok) {
        setReplyError(r.problem ? t("app.setEmailDomain.replyInvalid") : r.error || t("app.setEmailDomain.saveError"));
        return;
      }
      setReplyEditing(false);
      const res = await fetch("/api/settings/email-domain");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || t("app.setEmailDomain.loadError"));
        return;
      }
      // A prefill the owner hasn't touched follows the new email's domain;
      // anything they typed stays.
      setDomainInput((cur) =>
        !cur || cur === data?.domainPrefill?.domain ? json.emailDomain || json.domainPrefill?.domain || "" : cur,
      );
      setData(json);
    } finally {
      setReplySaving(false);
    }
  }

  // The one-tap "Use info@…": the existing PATCH, with the suggested local
  // part. This is the only way the suggestion reaches emailFromLocal.
  async function acceptSuggestedLocal(local) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailFromLocal: local }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("app.setEmailDomain.saveError"));
      setData(json);
      setLocalInput(json.emailFromLocal || local);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("app.setEmailDomain.disconnectConfirm"))) return;
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

  const clientsSee = data?.clientsSee || null;
  const companyEmail = data?.companyEmail || { value: "", state: "blank" };
  const suggestion = data?.senderSuggestion || null;
  // The address replies fall back to while Company.email is blank or
  // refused: resolveSender's owner-login answer, as the server computed it.
  const ownerFallback = clientsSee?.replyToSource === "owner" ? clientsSee.replyTo : null;
  const replyFieldOpen = replyEditing || companyEmail.state !== "set";
  const typedDomain = normaliseDomain(domainInput);
  const typingSuggestedDomain = Boolean(suggestion && !suggestion.freeMailbox && typedDomain === suggestion.domain);

  return (
    <div className="max-w-3xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.settings.emailDomain")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setEmailDomain.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* What clients see, and where their replies go */}
      {clientsSee && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-foreground break-words">
            {clientsSee.replyTo
              ? t("app.setEmailDomain.clientsSee", { from: clientsSee.from, replyTo: clientsSee.replyTo })
              : t("app.setEmailDomain.clientsSeeNoReplyTo", { from: clientsSee.from })}
          </p>
          {clientsSee.via === "mailbox" && (
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {t("app.setEmailDomain.viaMailbox", { fallback: clientsSee.fallbackFrom })}
            </p>
          )}

          <div className="border-t border-border mt-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">{t("app.setEmailDomain.repliesGoTo")}</h2>
                {companyEmail.state === "set" && !replyEditing && (
                  <p className="text-sm text-foreground mt-0.5 break-all">{companyEmail.value}</p>
                )}
                {companyEmail.state === "blank" && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5 break-words">
                    {ownerFallback
                      ? t("app.setEmailDomain.repliesOwnerFallback", { owner: ownerFallback })
                      : t("app.setEmailDomain.repliesNoCompanyEmail")}
                  </p>
                )}
                {companyEmail.state === "invalid" && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5 break-words">
                    {ownerFallback
                      ? t("app.setEmailDomain.repliesInvalid", { email: companyEmail.value, owner: ownerFallback })
                      : t("app.setEmailDomain.repliesInvalidNoOwner", { email: companyEmail.value })}
                  </p>
                )}
              </div>
              {companyEmail.state === "set" && !replyEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyInput(companyEmail.value);
                    setReplyError("");
                    setReplyEditing(true);
                  }}
                  className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-muted shrink-0"
                >
                  {t("app.action.edit")}
                </button>
              )}
            </div>

            {replyFieldOpen && (
              <div className="mt-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    className={inputClass}
                    placeholder={t("app.setEmailDomain.replyPlaceholder")}
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && replyInput.trim() && saveReplyTo()}
                    aria-label={t("app.setEmailDomain.repliesGoTo")}
                  />
                  <button
                    type="button"
                    onClick={saveReplyTo}
                    disabled={replySaving || !replyInput.trim() || replyInput.trim() === companyEmail.value}
                    className="bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
                  >
                    {replySaving && <Loader2 size={14} className="animate-spin" />}
                    {t("app.action.save")}
                  </button>
                  {replyEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyEditing(false);
                        setReplyError("");
                      }}
                      className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-muted shrink-0"
                    >
                      {t("app.action.cancel")}
                    </button>
                  )}
                </div>
                {replyError && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{replyError}</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{t("app.setEmailDomain.repliesHint")}</p>
          </div>
        </div>
      )}

      {/* Current status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground">
              {isConnected ? data.emailDomain : t("app.setEmailDomain.noDomainConnected")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isConnected
                ? t("app.setEmailDomain.willSendFrom", {
                    addr: `${data.emailFromLocal || "quotes"}@${data.emailDomain}`,
                  })
                : t("app.setEmailDomain.usingShared")}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${meta.className}`}
          >
            <StatusIcon size={13} />
            {t(`app.setEmailDomain.status.${status}`, meta.label)}
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
                {t("app.setEmailDomain.checkVerification")}
              </button>
            )}
            <button
              onClick={disconnect}
              disabled={busy}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-muted disabled:opacity-60"
            >
              <Trash2 size={14} />
              {t("app.setEmailDomain.disconnect")}
            </button>
          </div>
        )}
      </div>

      {/* Connect a domain */}
      {!isConnected && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">{t("app.setEmailDomain.connectDomain")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("app.setEmailDomain.connectHint1")}{" "}
            <span className="font-mono text-foreground">
              send.yourcompany.com
            </span>{" "}
            {t("app.setEmailDomain.connectHint2")}
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
              {t("app.setEmailDomain.connect")}
            </button>
          </div>
          {data?.domainPrefill?.source === "company_email" && typedDomain === data.domainPrefill.domain && (
            <p className="text-xs text-muted-foreground mt-2 break-words">
              {t("app.setEmailDomain.prefillFromEmail", { email: companyEmail.value })}
            </p>
          )}
          {suggestion?.freeMailbox && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-3 break-words">
              {t("app.setEmailDomain.freeMailbox", { email: companyEmail.value, domain: suggestion.domain })}
            </p>
          )}
          {typingSuggestedDomain && suggestion.fromAsStored && (
            <p className="text-sm text-foreground mt-3 break-all">
              {t("app.setEmailDomain.onceVerified", { from: suggestion.fromAsStored })}
            </p>
          )}
          {typingSuggestedDomain &&
            shouldOfferLocal({ suggestion, domain: domainInput, emailFromLocal: data?.emailFromLocal }) && (
              <SenderSuggestion
                suggestion={suggestion}
                busy={busy}
                onUse={() => acceptSuggestedLocal(suggestion.local)}
              />
            )}
        </div>
      )}

      {/* DNS records */}
      {isConnected && records.length > 0 && status !== "verified" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">{t("app.setEmailDomain.addDnsRecords")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("app.setEmailDomain.dnsIntro")}
          </p>

          {/* Written because "add these DNS records" assumes knowledge most
              contractors have no reason to have. The two lines that cause
              nearly every failed attempt are the name-suffix gotcha and the
              quotes-around-values one — both are called out explicitly. */}
          <ol className="text-sm text-muted-foreground space-y-2 mb-5 list-decimal pl-5">
            <li>
              {t("app.setEmailDomain.dns1a")}{" "}
              <span className="text-foreground font-medium">{t("app.setEmailDomain.dnsHost")}</span>
              {t("app.setEmailDomain.dns1b")}
            </li>
            <li>
              {t("app.setEmailDomain.dns2a")}{" "}
              <span className="text-foreground font-medium">{t("app.setEmailDomain.dnsWord")}</span>,{" "}
              <span className="text-foreground font-medium">{t("app.setEmailDomain.dnsRecordsWord")}</span>{" "}
              {t("app.setEmailDomain.dnsOr")}{" "}
              <span className="text-foreground font-medium">{t("app.setEmailDomain.dnsManageWord")}</span>
              {t("app.setEmailDomain.dns2b")}
            </li>
            <li>
              <span className="text-foreground font-medium">
                {t("app.setEmailDomain.dnsNameWatch")}
              </span>{" "}
              {t("app.setEmailDomain.dns3a")}{" "}
              <code className="font-mono text-xs">send._domainkey.example.com</code>{" "}
              {t("app.setEmailDomain.dns3b")}{" "}
              <code className="font-mono text-xs">send._domainkey</code>{" "}
              {t("app.setEmailDomain.dns3c")}{" "}
              <code className="font-mono text-xs">
                send._domainkey.example.com.example.com
              </code>{" "}
              {t("app.setEmailDomain.dns3d")}
            </li>
            <li>
              {t("app.setEmailDomain.dns4")}
            </li>
            <li>
              {t("app.setEmailDomain.dns5")}
            </li>
          </ol>

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
                    [t("app.setEmailDomain.type"), r.type],
                    [t("app.field.name"), r.name],
                    [t("app.setEmailDomain.value"), r.value],
                    [t("app.setEmailDomain.priority"), r.priority],
                    [t("app.setEmailDomain.ttl"), r.ttl],
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
          <h2 className="font-semibold text-foreground mb-1">{t("app.setEmailDomain.senderAddress")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("app.setEmailDomain.senderHint")}
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
              {t("app.action.save")}
            </button>
          </div>
          {shouldOfferLocal({ suggestion, domain: data.emailDomain, emailFromLocal: data.emailFromLocal }) && (
            <SenderSuggestion
              suggestion={suggestion}
              busy={busy}
              onUse={() => acceptSuggestedLocal(suggestion.local)}
            />
          )}
        </div>
      )}
    </div>
  );
}
