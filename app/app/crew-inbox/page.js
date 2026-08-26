"use client";

// app/app/crew-inbox/page.js
//
// What the crew texted in, and — the point of the page — the ones that need a
// person. A filed photo already lives on its job; here you see the exceptions:
// a "which job?" nobody answered (so pick it), and texts from numbers not on
// the roster (so you know who to add).
//
// Needs-you first, and it doesn't clear itself — same rule as the receptionist
// page. A pending photo sits at the top until someone files it.
//
// ══ The setup panel above it, and why it's here ════════════════════════════
//
// This feature shipped as a toggle on the voice settings screen that saved a
// column and connected nothing: the number it offered was the Retell VOICE
// number, which cannot receive a text at all. The owner turned it on, texted
// that number for an evening, and got silence — with no screen anywhere able to
// tell him why.
//
// So setup lives at the top of the page that shows the result. One surface says
// which number to text, whether it is really wired (asked of Twilio, not
// assumed), what is missing when it isn't, and offers a test text — so the
// answer to "is this working?" is on screen instead of being inferred from an
// absence.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare, AlertTriangle, Check, ImageIcon, HelpCircle, UserX, Loader2,
  Copy, MapPin, Send, Link2, Power,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function CrewInboxPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // `messages` stays null on failure. It used to be read as `messages || []`,
  // which turned "we were refused" into "your crew has sent you nothing" —
  // with a toast as the only correction, and toasts disappear.
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchList("/api/crew/messages");
    if (result.aborted) return;
    if (result.ok) setMessages(result.data?.messages || []);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fileTo(id, jobId) {
    setBusy(id);
    try {
      const res = await fetch("/api/crew/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, jobId }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.crewInbox.fileError"));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const list = messages || [];
  // `needsYou` comes from the server rather than being re-derived from status
  // strings here. When `superseded` started being written, a client-side
  // `status === "pending"` filter would have quietly hidden a queue of held
  // photos — the same class of silent loss this whole feature keeps producing.
  const pending = list.filter((m) => m.needsYou);
  const unknown = list.filter((m) => !m.needsYou && !m.known);
  const rest = list.filter((m) => !m.needsYou && m.known);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare size={22} /> {t("app.nav.crewInbox")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.crewInbox.subtitle")}
          </p>
        </div>
      </div>

      <SetupPanel onChanged={load} />

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={list.length === 0}
        skeleton={
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-accent rounded-xl" />
            <div className="h-24 bg-accent rounded-xl" />
          </div>
        }
        empty={
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <MessageSquare size={22} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mt-3">{t("app.crewInbox.empty")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("app.crewInbox.emptyHint")}
            </p>
          </div>
        }
      >
        <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
            {t("app.crewInbox.needsYou", { count: pending.length })}
          </h2>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} t={t} />
                {m.body && <p className="text-sm text-foreground mt-2">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                {m.superseded && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("app.crewInbox.superseded")}
                  </p>
                )}
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <HelpCircle size={12} /> {t("app.crewInbox.whichJob")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.candidates.map((c) => (
                      <button
                        key={c.jobId}
                        type="button"
                        disabled={busy === m.id}
                        onClick={() => fileTo(m.id, c.jobId)}
                        className="text-sm px-3 py-1.5 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : c.name}
                      </button>
                    ))}
                    {m.candidates.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("app.crewInbox.noCandidates")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {unknown.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <UserX size={15} className="text-muted-foreground" />
            {t("app.crewInbox.unknownHeading", { count: unknown.length })}
          </h2>
          <div className="space-y-2">
            {unknown.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} t={t} />
                {m.body && <p className="text-sm text-foreground mt-2">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                <p className="text-xs text-muted-foreground mt-2">
                  {t("app.crewInbox.addNumberPre")}{" "}
                  <Link href="/app/settings/team" className="underline">{t("app.crewInbox.teamLink")}</Link>{" "}
                  {t("app.crewInbox.addNumberPost")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">{t("app.crewInbox.filed")}</h2>
          <div className="space-y-2">
            {rest.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <MsgHeader m={m} formatDateTime={formatDateTime} t={t} />
                {m.body && <p className="text-sm text-foreground mt-1">{m.body}</p>}
                <Thumbs photos={m.photos} count={m.photoCount} />
                {m.filedTo && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    <Check size={12} />{" "}
                    {m.jobId ? (
                      <Link href={`/app/jobs/${m.jobId}`} className="underline">
                        {t("app.crewInbox.filedTo", { name: m.filedTo })}
                      </Link>
                    ) : (
                      t("app.crewInbox.filedTo", { name: m.filedTo })
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
        </div>
      </ListState>
    </div>
  );
}

// ══ Setup ══════════════════════════════════════════════════════════════════
//
// Renders the SERVER's verdict — `capability`, computed by lib/crew/capability.js
// and read by the inbound webhook too. Nothing is decided here, so the panel
// cannot say "ready" about a line the webhook would refuse.
function SetupPanel({ onChanged }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/crew/line");
    if (!res.ok) {
      // Not fatal to the page — the message list below still renders. A viewer
      // (platform console) and a non-admin both land here legitimately.
      setData(null);
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body, key) {
    setBusy(key);
    setNote("");
    try {
      const res = await fetch("/api/crew/line", {
        method: body === null ? "DELETE" : "POST",
        ...(body === null
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.crewSetup.actionError"));
        return;
      }
      if (key === "test") setNote(t("app.crewSetup.testSent"));
      await load();
      await onChanged?.();
    } finally {
      setBusy("");
    }
  }

  if (!data) return null;

  const { line, capability, deployment, provider, owned, test, spend } = data;
  const ready = capability?.ready;
  const message = capability?.messageKey
    ? t(capability.messageKey, capability.message || "")
    : capability?.message || "";

  // What can actually be pressed. A claim is offered only when the shared line
  // exists AND is free AND the deployment could verify a reply — offering it
  // otherwise is the dead button this whole change exists to remove.
  // A claim is offered only when there is something real to claim: the
  // deployment can verify a reply, the balance is not spent, and Twilio actually
  // holds an SMS-capable number. That last one is not a formality — the account
  // was found holding none, and a button that fails on press is the thing this
  // whole page exists to stop shipping.
  const claimable = line ? [line.e164] : (owned || []).map((n) => n.e164);
  const canClaim =
    deployment?.signatureConfigured &&
    (spend ? spend.canReceive : true) &&
    claimable.length > 0;
  const claimLabel = line ? t("app.crewSetup.reconnect") : t("app.crewSetup.claim");

  return (
    <div
      className={`rounded-xl border p-4 ${
        ready
          ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
      }`}
    >
      <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <Link2 size={15} /> {t("app.crewSetup.title")}
      </h2>

      {ready && line ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-foreground">
            {t("app.crewSetup.textThis")}{" "}
            <code className="px-1.5 py-0.5 rounded bg-background border border-border text-sm tabular-nums">
              {line.e164}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(line.e164);
                setCopied(true);
              }}
              className="ml-2 align-middle text-muted-foreground hover:text-foreground"
              aria-label={t("app.crewSetup.textThis")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </p>
          {line.expiresAt && (
            <p className="text-xs text-muted-foreground">
              {t("app.crewSetup.expires", {
                date: new Date(line.expiresAt).toLocaleDateString(),
              })}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-foreground mt-2">{message}</p>
      )}

      {/* The one thing only a person with Vercel access can fix, said plainly
          and named exactly. Its absence is why every inbound text 401s. */}
      {deployment && !deployment.signatureConfigured && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.ready.notConfigured")}
        </p>
      )}

      {!line && (owned || []).length === 0 && deployment?.twilioConfigured && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.noNumbers")}
        </p>
      )}
      {!line && !deployment?.twilioConfigured && (
        <p className="text-xs text-muted-foreground mt-2">{t("app.crewSetup.noShared")}</p>
      )}

      {/* More than one to choose from: pick, don't guess. With exactly one the
          button below claims it without an extra step. */}
      {!line && (owned || []).length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {owned.map((n) => (
            <button
              key={n.e164}
              type="button"
              disabled={Boolean(busy) || !canClaim}
              onClick={() => act({ action: "claim", e164: n.e164 }, "claim")}
              className="text-sm px-3 py-1.5 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 tabular-nums"
            >
              {n.e164}
            </button>
          ))}
        </div>
      )}

      {test && !test.to && (
        <p className="text-xs text-muted-foreground mt-2">{t("app.crewSetup.addPhone")}</p>
      )}

      {/* Credit. The same pooled balance the phone agent draws on, and the same
          ledger — so "where did my credit go" has one answer covering both.
          The paused state is a real state at the PROVIDER, not a hidden button:
          past the overdraft floor the number's webhook is un-pointed at Twilio,
          which is what actually stops the spending. */}
      {spend && !spend.canReceive && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.paused")}
        </p>
      )}
      {spend && (
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.crewSetup.balance", {
            amount: `$${(spend.balanceCents / 100).toFixed(2)}`,
          })}{" "}
          · {t("app.crewSetup.rates", { sms: spend.smsCents, mms: spend.mmsCents })}{" "}
          <Link href="/app/settings/voice" className="underline">
            {t("app.crewSetup.topUp")}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {!ready && canClaim && (line || (owned || []).length === 1) && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => act({ action: "claim", e164: claimable[0] }, "claim")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-bold disabled:opacity-40"
          >
            {busy === "claim" ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            {claimLabel}
          </button>
        )}
        {ready && test?.to && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => act({ action: "test" }, "test")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-bold disabled:opacity-40"
          >
            {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("app.crewSetup.test")}
          </button>
        )}
        {line && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => act(null, "off")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-muted-foreground text-sm disabled:opacity-40"
          >
            {busy === "off" ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            {t("app.crewSetup.turnOff")}
          </button>
        )}
      </div>

      {note && <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">{note}</p>}

      {/* Read from Twilio, not from our own row. "It says connected and nothing
          arrives" is the state that cost an afternoon; this is where you see
          which of the two is lying. */}
      <details className="mt-3">
        <summary className="text-xs text-muted-foreground cursor-pointer">
          {t("app.crewSetup.details")}
        </summary>
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium">{t("app.crewSetup.deliversTo")}: </dt>
            <dd className="inline break-all">{provider?.smsUrl || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">FieldQuo: </dt>
            <dd className="inline break-all">{deployment?.webhookUrl}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function MsgHeader({ m, formatDateTime, t }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-semibold text-foreground">{m.crew || m.from}</span>
      {m.crew && <span className="text-xs text-muted-foreground tabular-nums">{m.from}</span>}
      <span className="text-xs text-muted-foreground">{m.at ? formatDateTime(m.at) : ""}</span>
      {m.photoCount > 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ImageIcon size={12} /> {m.photoCount}
        </span>
      )}
      {/* Stored since this feature shipped and read by nothing until now. On a
          message someone has to place by hand, where it was taken is the most
          useful fact we hold. */}
      {m.point && (
        <a
          href={`https://www.google.com/maps?q=${m.point.lat},${m.point.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline"
        >
          <MapPin size={12} /> {t("app.crewInbox.whereTaken")}
        </a>
      )}
    </div>
  );
}

function Thumbs({ photos, count }) {
  if (!photos?.length) return null;
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt=""
          className="w-16 h-16 object-cover rounded-lg border border-border"
        />
      ))}
      {count > photos.length && (
        <span className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          +{count - photos.length}
        </span>
      )}
    </div>
  );
}
