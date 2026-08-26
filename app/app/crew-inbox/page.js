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
// What the setup panel shows, decided as a list rather than as fifteen separate
// conditions scattered down a component. The blocker sentence used to render
// twice — two correct branches that nothing could see together. See the file.
import { crewPanelBlocks } from "@/lib/crew/panelBlocks";

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
//
// ══ What this panel is for, and what it stopped being ══════════════════════
//
// It is the contractor's answer to four questions: what number do my crew text,
// is it on, what does it cost, and what do I have to do. That is all.
//
// It used to also print `https://www.fieldquo.com/api/crew/inbound` under a
// "Setup details" disclosure. The owner read it off his own screen, clicked it,
// and got a blank page — correctly, since it is a POST-only webhook address and
// not a page at all. Worse than confusing: it was an invitation to wire a
// private Twilio number straight at our endpoint, around the claim flow whose
// unique CrewInboxNumber.e164 is the only guarantee that a crew photo reaches
// the right tenant. FieldQuo holds the Twilio account and lends the number, the
// same way it holds the Retell account and provisions the voice line, and no
// contractor has ever been shown a Retell agent id either. That whole half now
// lives on /platform/crew-lines, where somebody can act on it.
//
// The same rule killed the duplicate. The blocker sentence rendered twice —
// once as `capability.message` and once again from a `!signatureConfigured`
// branch below it — and both copies named an environment variable at a painter.
// One sentence now, and it says the true and useful half: not available yet,
// FieldQuo's problem, nothing for you to do.
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

  // ── What this panel shows, decided as data ──────────────────────────────
  //
  // Every `show(...)` below reads a list that crewPanelBlocks built once. That
  // is what makes "the blocker renders once" a thing a check can execute rather
  // than a thing a reviewer has to notice: the duplicate that shipped was two
  // correct conditions in different halves of this component, and no amount of
  // reading catches that. check:crew-inbox now walks every state a contractor
  // can be in and fails if the list repeats itself.
  const { blocks, actions } = crewPanelBlocks({
    deployment,
    capability,
    line,
    owned,
    provider,
    spend,
    test,
  });
  const show = (key) => blocks.includes(key);
  const can = (key) => actions.includes(key);

  const claimable = line ? [line.e164] : (owned || []).map((n) => n.e164);
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

      {/* The blocker, and the ONLY place a capability sentence is printed when
          FieldQuo can't run the feature at all. Nothing follows it: a number
          list, a rate card and a claim button are all statements about
          something that cannot happen here. */}
      {show("blocker") && <p className="text-sm text-foreground mt-2">{message}</p>}

      {show("number") && line ? (
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
          {show("expires") && (
            <p className="text-xs text-muted-foreground">
              {t("app.crewSetup.expires", {
                date: new Date(line.expiresAt).toLocaleDateString(),
              })}
            </p>
          )}
        </div>
      ) : (
        show("status") && <p className="text-sm text-foreground mt-2">{message}</p>
      )}

      {/* No number to lend. Says what is true — FieldQuo hasn't got one for you
          — and stops. It used to promise that a number added to our account
          "appears here to switch on", which is only true when the deployment can
          also verify a reply; in the state the owner was actually looking at, it
          was a promise the screen could not keep. crewPanelBlocks never emits
          this alongside the blocker, so the sentence is honest wherever it
          renders. */}
      {show("noNumbers") && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.noNumbers")}
        </p>
      )}

      {/* A number that can take an SMS but not an MMS is a real state and a bad
          surprise: the crew's photos — the entire point of the feature — are
          silently refused by the carrier. A property of the line they hold, so
          it belongs on their screen. */}
      {show("noMms") && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.noMms")}
        </p>
      )}

      {/* More than one to choose from: pick, don't guess. With exactly one the
          button below claims it without an extra step. */}
      {show("pickNumber") && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {owned.map((n) => (
            <button
              key={n.e164}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => act({ action: "claim", e164: n.e164 }, "claim")}
              className="text-sm px-3 py-1.5 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 tabular-nums"
            >
              {n.e164}
            </button>
          ))}
        </div>
      )}

      {/* ── The one thing that IS the contractor's to do ──────────────────
          And, until now, the one thing they could not actually do. The sentence
          said "add your own mobile to your staff profile" and named no screen;
          the screen it meant is Settings → Team → Workers, which had no phone
          field at all — mobile could only ever be typed once, on the invite
          form. So an owner whose record predates the field read an instruction
          with nowhere to carry it out. The field now exists on the worker row
          and this links straight at it. */}
      {show("addPhone") && (
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.crewSetup.addPhonePre")}{" "}
          <Link href="/app/settings/team/workers" className="underline">
            {t("app.crewSetup.addPhoneLink")}
          </Link>
          {t("app.crewSetup.addPhonePost")}
        </p>
      )}

      {/* Credit. The same pooled balance the phone agent draws on, and the same
          ledger — so "where did my credit go" has one answer covering both.
          The paused state is a real state at the PROVIDER, not a hidden button:
          past the overdraft floor the number's webhook is un-pointed at Twilio,
          which is what actually stops the spending. */}
      {show("paused") && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
          {t("app.crewSetup.paused")}
        </p>
      )}
      {/* ── The rate, said the way it is actually charged ─────────────────
          "2¢ a text" was a promise the meter did not keep. Twilio bills SMS by
          SEGMENT and lib/crew/messaging.js follows it — a 200-character update
          is two segments and costs 4¢ — so a per-message price undercharged on
          screen and overcharged on the statement. The segment length is now in
          the sentence, and check:crew-inbox asserts the number in the copy is
          the same constant the webhook debits.

          The statement link matters as much as the price. A charge a contractor
          cannot find an itemised record of is how a support call becomes a
          chargeback, and the crew's texts land in the same VoiceCreditEntry
          ledger the calls do — so "where did my credit go" has one answer
          covering both, and this is the way to it. */}
      {show("credit") && (
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.crewSetup.balance", {
            amount: `$${(spend.balanceCents / 100).toFixed(2)}`,
          })}{" "}
          ·{" "}
          {t("app.crewSetup.rates", {
            sms: spend.smsCents,
            mms: spend.mmsCents,
            chars: spend.smsSegmentChars,
          })}{" "}
          <Link href="/app/settings/voice#credit" className="underline">
            {t("app.crewSetup.statement")}
          </Link>{" "}
          ·{" "}
          <Link href="/app/settings/voice#credit" className="underline">
            {t("app.crewSetup.topUp")}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {can("claim") && (
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
        {can("test") && (
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
        {can("off") && (
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

      {/* There is deliberately no "Setup details" disclosure here any more. It
          held the number's Twilio smsUrl and this deployment's inbound webhook
          URL — FieldQuo's plumbing, printed at a contractor, one of them beside
          a bare "—" that said nothing about what its absence meant. Both facts
          are real and both still matter; they are on /platform/crew-lines, read
          from Twilio, next to the person who can repoint them. */}
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
