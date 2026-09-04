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
  Copy, MapPin, Send, Link2, Power, Phone, ShoppingCart,
} from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { fetchList, fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
// The purchase confirmation. Reused rather than rebuilt: it already names the
// one thing being committed to and puts it on its own line, which is the whole
// job here — see the note in that file on why two of its labels became props.
import SendConfirmModal from "@/app/components/SendConfirmModal";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
// What the setup panel shows, decided as a list rather than as fifteen separate
// conditions scattered down a component. The blocker sentence used to render
// twice — two correct branches that nothing could see together. See the file.
import { crewPanelBlocks } from "@/lib/crew/panelBlocks";

// Credit is collected in USD and this page is read by companies whose every
// other figure is CAD. A bare `$` here said "$4.00" to a contractor who was
// about to be charged four US dollars, which is the exact mistake the voice
// settings screen was fixed for — a contractor read "$30.00", pressed buy, and
// Stripe took around forty Canadian ones. Same formatter, same currency
// constant, so the two screens cannot drift.
// `Number(cents || 0)` turned any figure that failed to arrive into a
// confident $0.00 — and one of the places this renders is the confirmation
// panel shown immediately before a monthly charge is agreed to. "$0.00 a month"
// on the last screen before money moves is the worst possible reading of an
// absent number, so an absent one now renders as nothing and the caller's own
// guard decides what to say. A real 0 is finite and still prints.
const money = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return formatAppMoney(n / 100, CREDIT_CURRENCY, "en");
};

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
  // ── The held photo that could never be filed ─────────────────────────────
  //
  // A "needs you" message whose sender had no scheduled job that day arrives
  // with zero candidates. The card then rendered one sentence — "No job was on
  // their schedule that day." — and nothing else, so it sat at the top of the
  // queue forever, on the page built to clear it.
  //
  // The server was never the obstacle. fileHeldMessage guards with
  // `if (msg.candidateJobIds.length && !includes(jobId))`, so when the
  // candidate list is EMPTY any job in the company is accepted — the free
  // choice was designed for exactly this case and the screen never offered it.
  // Loaded on demand, from the card, so the common path costs no extra request.
  const [jobs, setJobs] = useState(null);
  const [jobsErrorKey, setJobsErrorKey] = useState("");
  const [pickedJob, setPickedJob] = useState({});

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

  const loadJobs = useCallback(async () => {
    setJobsErrorKey("");
    const result = await fetchArray("/api/jobs");
    if (result.aborted) return;
    if (!result.ok) {
      setJobs(null);
      setJobsErrorKey(result.errorKey);
      return;
    }
    setJobs(result.data);
  }, []);

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
        <div data-tour="crew-inbox-header" className="flex-1 min-w-[12rem]">
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
                      <NoCandidatePicker
                        messageId={m.id}
                        busy={busy === m.id}
                        jobs={jobs}
                        jobsErrorKey={jobsErrorKey}
                        onLoadJobs={loadJobs}
                        picked={pickedJob[m.id] || ""}
                        onPick={(v) =>
                          setPickedJob((prev) => ({ ...prev, [m.id]: v }))
                        }
                        onFile={fileTo}
                        t={t}
                      />
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
          {t("app.crewSetup.balance", { amount: money(spend.balanceCents) })}{" "}
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

      {/* Buying one of their own. Offered by crewPanelBlocks, so it cannot
          appear on a setup that could not receive the first text — the
          not-configured state returns a single sentence and no actions at all,
          and this is an action. */}
      {can("buy") && (
        <BuyLine
          t={t}
          busy={Boolean(busy)}
          onBought={async (e164) => {
            setNote(t("app.crewSetup.buy.bought", { number: e164 }));
            await load();
            await onChanged?.();
          }}
        />
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

// ══ Buying a crew number ═══════════════════════════════════════════════════
//
// Deliberately the same shape as the voice screen's NumberPicker — an area code
// box, a list of real free numbers, the monthly price on every row. Two screens
// that buy a phone number should not feel like two different products, and a
// contractor who has already bought a receptionist number should recognise this
// one without being taught it again.
//
// ── Where it differs, and why ─────────────────────────────────────────────
//
// The voice picker buys on the click: "Picking one buys it straight away." This
// one asks first. The difference is not taste — that picker sits inside a
// several-step "get a receptionist" flow where the contractor arrived intending
// to spend, whereas this panel is on the page they open to read their crew's
// photos. A row that looks like a list and charges money is the dead control's
// mirror image: a control that does MORE than it appears to.
//
// ── Three answers, three sentences, and none of them a spinner ────────────
//
// `null` results — nothing searched yet.
// `[]` results — we looked and that area code has nothing free. Routine, not a
//   failure: 416 and 514 both come back empty from real inventory because
//   Toronto and Montreal local stock is exhausted. It gets its own sentence and
//   must never read as a connection problem.
// a refused search — we could not look at all. Reported through the normal
//   error path, which is a different sentence again, and `results` stays null so
//   the "nothing free" line cannot render on top of it.
//
// ── The price is stated before the button, never at the 402 ───────────────
//
// `monthlyCents` and `balanceCents` come back on the SAME search response, so
// the two figures on screen were read at the same instant and cannot disagree
// with each other. When the credit won't cover the first month the number list
// is withheld entirely and the shortfall is named instead — the voice screen
// hides its picker in the same state for the same reason. A row that 402s on
// press is a button that appears to work and doesn't.
function BuyLine({ t, busy, onBought }) {
  const [open, setOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  // { monthlyCents, balanceCents } — never held from an earlier page load. See
  // the note above on why both have to come off one response.
  const [price, setPrice] = useState(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [buying, setBuying] = useState(false);

  async function search(code) {
    setSearching(true);
    setResults(null);
    try {
      const wanted = String(code ?? areaCode).trim();
      const res = await fetch("/api/crew/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No area code at all is a real request, not an empty one: the server
        // falls back to the company's own number and then to its city, and
        // sending "" would ask it to search for nothing.
        body: JSON.stringify({ action: "search", ...(wanted ? { areaCode: wanted } : {}) }),
      });
      if (!res.ok) {
        // A failed LOOK, which is not an empty result. `results` is left null
        // so the "nothing free in 819" sentence below cannot render as well.
        await reportResponseError(
          res,
          t("app.crewSetup.buy.searchFailed", "We couldn't check which numbers are free just now. Nothing has been charged."),
        );
        return;
      }
      const payload = await res.json();
      setResults(payload.numbers || []);
      setSearched(payload.searched || null);
      setPrice({
        monthlyCents: payload.monthlyCents,
        balanceCents: payload.balanceCents,
      });
      // Show which area code was actually used. The server picked it from the
      // company's own number; reflecting it keeps the box honest about what was
      // asked, and gives the contractor something to edit rather than a blank.
      // `searched.areaCode` is null when it fell back to the city — nothing is
      // invented into the box in that case, because three digits sitting in a
      // box are three digits somebody buys a number in.
      if (!wanted && payload.searched?.areaCode) setAreaCode(payload.searched.areaCode);
    } catch (err) {
      showError(
        t("app.crewSetup.buy.searchFailed", "We couldn't check which numbers are free just now. Nothing has been charged.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setSearching(false);
    }
  }

  async function buy(e164) {
    setBuying(true);
    try {
      const res = await fetch("/api/crew/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // An E.164 and nothing else. The browser never sends an amount — the
        // price is read from our own rows inside the reservation.
        body: JSON.stringify({ action: "buy", e164 }),
      });
      if (!res.ok) {
        const payload = await res.clone().json().catch(() => ({}));
        // A 402 carries the real figures. Adopting them turns "not enough
        // credit" from a toast that disappears into a shortfall that stays on
        // screen with the top-up link beside it. Only when there IS a shortfall:
        // the same refusal is also returned when FieldQuo has withdrawn the
        // feature, and telling someone to add money to a problem money cannot
        // solve is the worst kind of dead control.
        if (payload?.verdict?.shortfallCents > 0) {
          setPrice({
            monthlyCents: payload.verdict.needCents,
            balanceCents: payload.verdict.balanceCents,
          });
        }
        await reportResponseError(res, t("app.crewSetup.buy.error", "We couldn't buy that number."));
        // The number may have gone in the seconds since the list was drawn, so
        // the list is now a claim we can't stand behind. Re-asked rather than
        // left on screen offering a number somebody else already owns.
        await search();
        return;
      }
      const data = await res.json();
      setOpen(false);
      await onBought?.(data.line?.e164 || e164);
    } finally {
      setBuying(false);
      setConfirming(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setOpen(true);
          search();
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-2 disabled:opacity-50"
      >
        <ShoppingCart size={13} />
        {t("app.crewSetup.buy.open", "Buy your crew a number of their own")}
      </button>
    );
  }

  // Read once so the list and the sentence explaining its absence cannot
  // disagree about whether the credit covers the first month.
  const short = price ? price.balanceCents < price.monthlyCents : false;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mt-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("app.crewSetup.buy.title", "Pick your crew's number")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("app.crewSetup.buy.hint", "These are real numbers that are free right now. The one you pick is the one you get — if somebody else takes it first we'll tell you, and nothing is charged.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-muted-foreground" htmlFor="crew-area-code">
          {t("app.crewSetup.buy.areaCodeLabel", "Area code")}
        </label>
        <input
          id="crew-area-code"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          inputMode="numeric"
          maxLength={3}
          // No placeholder digits. A greyed-out "819" in an empty box reads as a
          // value, and this is a box where a misread default gets bought.
          placeholder=""
          className="w-20 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
        />
        <button
          type="button"
          onClick={() => search()}
          disabled={busy || searching || buying}
          className="px-3 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {searching ? (
            <Loader2 size={14} className="inline animate-spin" />
          ) : (
            t("app.crewSetup.buy.search", "Show me numbers")
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("app.crewSetup.buy.areaCodeHint", "Change the area code if you'd rather your crew's number looked local to somewhere else.")}
      </p>

      {searching && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          {t("app.crewSetup.buy.searching", "Checking what's free…")}
        </p>
      )}

      {/* ── The price, before the button, next to what they hold ──────────
          Both figures off the one search response. A contractor must never
          discover the cost at the refusal. */}
      {!searching && price && (
        <p className="text-xs text-foreground">
          {t("app.crewSetup.buy.price", "{amount} a month, taken from your credit. You have {balance}.", {
            amount: money(price.monthlyCents),
            balance: money(price.balanceCents),
          })}
        </p>
      )}

      {/* Can't afford it, so no list. Hiding the rows rather than disabling them
          is the same choice the voice screen makes: a row that looks pickable
          and answers with a payment error is a control that appears to work. */}
      {!searching && short && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("app.crewSetup.buy.shortfall", "Add {amount} more credit first — the first month's {rental} rental is charged up front.", {
            amount: money(price.monthlyCents - price.balanceCents),
            rental: money(price.monthlyCents),
          })}{" "}
          <Link href="/app/settings/voice#credit" className="underline">
            {t("app.crewSetup.topUp")}
          </Link>
        </p>
      )}

      {/* An empty result is an ANSWER and gets said as one. Busy area codes run
          dry constantly — 416 and 514 are both empty against real inventory
          today — and rendering that as a failure sends a contractor chasing a
          problem that was never theirs. */}
      {!searching && !short && results?.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {searched?.areaCode
            ? t("app.crewSetup.buy.noneInAreaCode", "Nothing free in {code} right now — it's a busy area code. Try one next to it.", { code: searched.areaCode })
            : t("app.crewSetup.buy.noneNearby", "We couldn't find a free number near you. Try typing an area code.")}
        </p>
      )}

      {!searching && !short && results?.length > 0 && (
        <div className="space-y-2">
          {searched?.locality && (
            <p className="text-xs text-muted-foreground">
              {t("app.crewSetup.buy.nearCity", "Free numbers near {city}.", { city: searched.locality })}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {results.map((n) => (
              <button
                key={n.e164}
                type="button"
                disabled={busy || buying}
                onClick={() => setConfirming(n)}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border text-left hover:bg-muted disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {n.display}
                </span>
                <span className="text-xs text-muted-foreground">
                  {/* The city only when the phone company gave us one. Part of
                      the inventory comes back with no locality at all, and
                      printing the area code's "usual" city there would be an
                      invented place on a screen about buying a number. */}
                  {n.locality ? `${n.locality} · ` : ""}
                  {money(price.monthlyCents)}
                  {t("app.setVoice.perMonth", "/month")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <SendConfirmModal
        // A known PRICE is part of the precondition, not just a chosen number.
        // The dialog's own comment says both facts are named because this is
        // the last screen before the money moves — so if the price is not one
        // of them, there is nothing here to agree to. Today /api/crew/line
        // always sends monthlyCents; this makes that a requirement rather than
        // a habit, because the failure mode is a monthly charge agreed to
        // against a blank.
        isOpen={Boolean(confirming) && Number.isFinite(Number(price?.monthlyCents))}
        busy={buying}
        icon={<Phone size={24} className="text-foreground" />}
        // The two facts being committed to: which number, and what it costs.
        // Both named, because this is the last screen before the money moves.
        title={t("app.crewSetup.buy.confirmTitle", "Buy this number for your crew?")}
        recipient={confirming?.display || confirming?.e164 || ""}
        detail={t("app.crewSetup.buy.confirmDetail", "{amount} a month. The first month comes out of your credit now.", {
          amount: money(price?.monthlyCents),
        })}
        confirmLabel={t("app.crewSetup.buy.confirmCta", "Buy this number")}
        cancelLabel={t("app.crewSetup.buy.cancel", "Cancel")}
        // Not closed until the outcome is known — a refusal arriving with the
        // dialog already gone leaves nothing on screen tying the message to what
        // was attempted.
        onClose={() => (buying ? null : setConfirming(null))}
        onConfirm={() => buy(confirming.e164)}
      />
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

/**
 * The way out of a held message with no candidate jobs.
 *
 * Deliberately a second click rather than a chip row: the candidate chips are
 * a short list of jobs this person was ACTUALLY on that day, and a dropdown of
 * every open job is a different, weaker claim. Making it a separate step keeps
 * the two from looking equally confident.
 *
 * A job with no visit is refused by fileHeldMessage with a sentence saying so,
 * and reportResponseError shows it — so this offers every job rather than
 * pre-filtering to a set this screen would have to guess at.
 */
function NoCandidatePicker({
  messageId, busy, jobs, jobsErrorKey, onLoadJobs, picked, onPick, onFile, t,
}) {
  if (jobs === null && !jobsErrorKey) {
    return (
      <button
        type="button"
        onClick={onLoadJobs}
        className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground hover:bg-muted"
      >
        {t(
          "app.crewInbox.noCandidatesPick",
          "No job was on their schedule that day — choose one",
        )}
      </button>
    );
  }

  if (jobsErrorKey) {
    return (
      <span className="text-xs text-muted-foreground">
        {t(jobsErrorKey)}{" "}
        <button type="button" onClick={onLoadJobs} className="underline font-medium">
          {t("app.load.retry")}
        </button>
      </span>
    );
  }

  if (jobs.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("app.crewInbox.noJobsAtAll", "There are no jobs to file this against yet.")}
      </span>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {/* text-base: anything smaller makes iOS Safari zoom the page on focus,
          and this screen is read on a phone. */}
      <select
        value={picked}
        onChange={(e) => onPick(e.target.value)}
        aria-label={t("app.crewInbox.whichJob")}
        className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground"
      >
        <option value="">{t("app.crewInbox.chooseJob", "Choose a job…")}</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || !picked}
        onClick={() => onFile(messageId, picked)}
        className="min-h-11 rounded-full bg-inverted px-4 text-sm font-semibold text-inverted-foreground disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          t("app.crewInbox.fileHere", "File it here")
        )}
      </button>
    </div>
  );
}
