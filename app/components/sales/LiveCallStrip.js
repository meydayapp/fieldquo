"use client";

// app/components/sales/LiveCallStrip.js
//
// The live call, drawn once, on every /sales page.
//
// ══ One renderer, two places ══════════════════════════════════════════════
//
// The controls of a call that is up — who, the clock, Mute, Hang up,
// Transfer, Text them, Email — are rendered by THIS component and nothing
// else. On the queue the Dialer card registers a slot (consoleSlots.js) and
// the controls are drawn INTO it through a portal, where the Call button
// was; on every other page there is no card and the same controls sit in a
// fixed strip under the top bar, beside "Back to the call screen". The
// direction does not matter: an outbound call CallSession placed and an
// inbound call IncomingCallDock answered are the same shape here (`live`),
// and the dock no longer keeps a strip of its own.
//
// It used to be three renderers: CallPanel's on-call block (outbound, on
// the queue only), the dock's card portal (inbound, on the queue) and the
// dock's fixed strip (inbound, elsewhere). The owner's report — "the call
// should remain on" when the rep presses Text them — needed the outbound
// controls to exist on the Texts page, and the honest way to give them a
// fourth place was to give them one.
//
// ══ Not a modal ═══════════════════════════════════════════════════════════
//
// The rep is on a call and must keep the page — the thread they are
// typing in, the calendar they are booking on — usable, and must always be
// able to hang up. Fixed, full width of the body beside the rail, z-[70]:
// above the tour's card (z-[60]), the Off reminder (z-[65]) and the nav
// drawer (z-50); below the ring dialog (z-[80]). Never taller than what is
// under the bar, and scrolling inside itself past that.
//
// ══ The write-up follows the rep too ══════════════════════════════════════
//
// When an outbound call ends on a page with no CallPanel (the rep hung up
// from this strip on the Texts page), "What happened on that call?" is
// drawn here, in the strip's place, from the same CallSession state the
// Dialer column would have drawn it from. The pop-up after an answered call
// and the intro-email prompt are portals to <body> and render from here
// whatever the page — they used to be CallPanel's, which meant they could
// only open on the queue.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Ear, Headphones, Loader2, Mail, Mic, MicOff, NotebookPen, Pause, PhoneOff, Play, UserPlus } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCallSession } from "./CallSession";
import { useConsoleSlots } from "./consoleSlots";
import TransferControl from "./TransferControl";
import { AmdNotice, LiveMarkButton, useLiveCallFacts } from "./RecordingMark";
import TextThemButton from "./TextThem";
import OutcomeForm, { OutcomeSheet } from "./OutcomeForm";
import IntroEmailPrompt from "./IntroEmailPrompt";
import { OutboundWriteUpCard, whatHappenedBody } from "./OutboundWriteUp";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CHIP =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60";
const LINK =
  "inline-flex items-center gap-1.5 min-h-[44px] px-2 -mx-2 rounded-lg text-sm font-semibold text-brand-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const STRIP =
  "fixed inset-x-0 top-0 lg:top-[var(--fq-top-bar,61px)] lg:left-[var(--fq-sales-rail,220px)] z-[70] max-h-[100dvh] lg:max-h-[calc(100dvh-var(--fq-top-bar,61px))] overflow-y-auto";

/** "4:12". A call timer, so seconds are never dropped. */
function clock(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Digits → something a person can read. Never throws on a short string. */
function pretty(e164, t) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || t("app.salesDial.anUnknownNumber");
}

/**
 * "Email" — the composer on /sales/threads for the lead behind this call,
 * made from the prospect first when there is no lead yet (the same
 * carry-across Text them makes). A lead with no address is refused in
 * words under the button: the composer cannot address an email to nobody,
 * and a press that landed on an empty To field would be the dead control.
 */
export function EmailThemButton({ leadId = null, prospectId = null, className = "" }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!leadId && !prospectId) return null;
  async function press() {
    setBusy(true);
    setError("");
    try {
      let lead = null;
      if (leadId) {
        const body = await fetchJson(`/api/sales/leads/${encodeURIComponent(leadId)}`);
        lead = body?.lead || body || null;
      } else {
        const body = await fetchJson("/api/sales/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectId }),
        });
        lead = body?.lead || null;
      }
      if (!lead?.id) throw new Error(t("app.salesLive.emailOpenFailed"));
      if (!lead.email) throw new Error(t("app.salesLive.emailNoAddress"));
      router.push(`/sales/threads?compose=${encodeURIComponent(lead.id)}`);
    } catch (err) {
      setError(err?.message || t("app.salesLive.emailOpenFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`inline-flex flex-col ${className}`} data-email-them>
      <button type="button" onClick={press} disabled={busy} className={CHIP} data-email-them-button>
        {busy ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Mail size={13} aria-hidden="true" />}
        <span className="min-w-0 break-words">{t("app.salesLive.email")}</span>
      </button>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300 break-words" role="alert" data-email-them-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Hold, and who else is on the line — the conference-mode facts of an
 * outbound call, polled from /api/sales/calls/conference every four
 * seconds while the call is up.
 *
 * Hold is drawn only when the server says the call CAN be held (it is in
 * a conference); a plain bridge gets no button rather than one that
 * refuses. The supervisor line is whatever the server chose to say —
 * barge and take always, listen and whisper only if the platform setting
 * tells reps (lib/sales/calls/supervision.js repNotice). Nothing here
 * reaches the prospect.
 */
function ConferenceControls({ attemptId, active }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!attemptId || !active) return undefined;
    let cancelled = false;
    const ask = async () => {
      try {
        const body = await fetchJson(`/api/sales/calls/conference?attemptId=${encodeURIComponent(attemptId)}`);
        if (!cancelled) setState(body?.state || null);
      } catch {
        /* the next tick asks again; nothing here blocks the call */
      }
    };
    ask();
    const id = setInterval(ask, 4000);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, [attemptId, active]);

  if (!state) return null;

  async function toggleHold() {
    setBusy(true);
    setError("");
    try {
      const body = await fetchJson("/api/sales/calls/conference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: state.held ? "unhold" : "hold", attemptId }),
      });
      setState(body?.state || state);
    } catch (err) {
      setError(err?.message || t("app.salesHold.failed"));
    } finally {
      setBusy(false);
    }
  }

  const sup = state.supervision;
  const supText = sup
    ? {
        listen: t("app.salesSupervision.listening", { name: sup.name || t("app.salesSupervision.aSupervisor") }),
        whisper: t("app.salesSupervision.whispering", { name: sup.name || t("app.salesSupervision.aSupervisor") }),
        barge: t("app.salesSupervision.joined", { name: sup.name || t("app.salesSupervision.aSupervisor") }),
        take: t("app.salesSupervision.took", { name: sup.name || t("app.salesSupervision.aSupervisor") }),
      }[sup.kind] || null
    : null;

  return (
    <div className="space-y-2" data-conference-controls>
      {state.canHold ? (
        <div className="flex flex-wrap items-center gap-2" data-hold={state.held ? "held" : "off"}>
          <button
            type="button"
            className={`${BTN} border ${state.held ? "border-amber-400 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100" : "border-emerald-400 text-emerald-900 dark:text-emerald-100"} flex-1`}
            onClick={toggleHold}
            disabled={busy || state.taken}
            aria-pressed={state.held}
            data-live-call-hold
          >
            {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : state.held ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            {state.held ? t("app.salesHold.resume") : t("app.salesHold.hold")}
          </button>
          {state.held ? (
            <span className="text-sm font-mono tabular-nums text-amber-900 dark:text-amber-100" data-hold-clock>
              {t("app.salesHold.onHoldFor", { time: clock(state.heldAt ? Date.now() - new Date(state.heldAt).getTime() : 0) })}
            </span>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-amber-700 dark:text-amber-300 break-words">{error}</p> : null}
      {supText ? (
        <p className={`text-xs flex items-start gap-1.5 break-words ${sup.audible ? "font-semibold text-emerald-900 dark:text-emerald-100" : "text-emerald-900/80 dark:text-emerald-200/80"}`} data-supervision-notice={sup.kind}>
          <Ear size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          {supText}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The controls, given the session's `live`. `inCard` is the Dialer card's
 * copy: no "Back to the call screen", because they are on it.
 */
export function LiveCallControls({ inCard = false }) {
  const { t } = useTranslation();
  const session = useCallSession();
  const { live, muted, hangUp, toggleMute, callError, audioWarning } = session;
  const [, setTick] = useState(0);
  const [error, setError] = useState("");
  // The carrier's machine verdict, when detection is on, and the pickup
  // stamp the Mark button needs (RecordingMark.js). Outbound only: an
  // inbound call has no AMD leg and its attemptId lands later.
  const liveFacts = useLiveCallFacts(live?.direction === "out" ? live?.attemptId || null : null);
  useEffect(() => {
    if (!live?.startedAt) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live?.startedAt]);
  const onTransferError = useCallback((message) => setError(message || ""), []);
  if (!live) return null;

  const internal = live.kind === "internal";
  const number = pretty(live.e164, t);
  const links = live.links;
  return (
    <div
      className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-3"
      data-live-call={live.direction}
      data-inbound-live={live.direction === "in" ? "" : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900/80 dark:text-emerald-200/80">
            {t("app.salesDial.onACall")}
          </p>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100 break-words">
            {internal ? (
              t("app.salesInternal.onCallWithColleague", { name: live.internal?.name || live.label || t("app.salesInternal.aColleague") })
            ) : live.direction === "out" ? (
              t("app.salesCall.onCallWith", { name: live.label || number })
            ) : live.label ? (
              <>
                {live.label} <span className="whitespace-nowrap">· {number}</span>
              </>
            ) : (
              number
            )}
          </p>
        </div>
        <p className="text-xl font-mono tabular-nums text-emerald-900 dark:text-emerald-100" data-live-call-clock>
          {clock(live.startedAt ? Date.now() - live.startedAt : 0)}
        </p>
      </div>

      {live.callerId && !internal ? (
        <p className="text-xs text-emerald-900 dark:text-emerald-200 break-words">
          {t("app.salesCall.callerIdNotice", { number: live.callerId })}
        </p>
      ) : null}
      {internal ? (
        <p className="text-xs text-emerald-900 dark:text-emerald-200 break-words">{t("app.salesInternal.noCarrierCost")}</p>
      ) : null}

      {/* Where the rep may go from here. Inbound: the server's links for
          the caller (open the company, its notes, save as a lead) — an
          href it was given or nothing, never composed from an id. Outbound,
          away from the card: back to the screen the call was placed from. */}
      {links || (!inCard && live.direction === "out" && live.backHref) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0" data-incoming-links={live.direction === "in" ? "" : undefined}>
          {!inCard && live.direction === "out" && live.backHref ? (
            <Link href={live.backHref} className={LINK} data-live-call-back>
              <ArrowLeft size={15} aria-hidden="true" /> {t("app.salesLive.backToCall")}
            </Link>
          ) : null}
          {links?.open?.href ? (
            <Link href={links.open.href} className={LINK} data-incoming-open-company={links.open.kind}>
              <Building2 size={15} aria-hidden="true" /> {t("app.salesDial.callerOpenCompany")}
            </Link>
          ) : null}
          {links?.notes?.href ? (
            <Link href={links.notes.href} className={LINK} data-incoming-notes>
              <NotebookPen size={15} aria-hidden="true" /> {t("app.salesDial.callerNotes")}
            </Link>
          ) : null}
          {links?.save?.href ? (
            <Link href={links.save.href} className={LINK} data-incoming-save-lead>
              <UserPlus size={15} aria-hidden="true" /> {t("app.salesDial.callerSaveAsLead")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {audioWarning ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
          <Headphones size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          {audioWarning}
        </p>
      ) : null}
      {callError || error ? <p className="text-xs text-amber-700 dark:text-amber-300 break-words">{callError || error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          className={`${BTN} border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1`}
          onClick={toggleMute}
          aria-pressed={muted}
          data-live-call-mute
        >
          {muted ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
          {muted ? t("app.salesCall.unmute") : t("app.salesCall.mute")}
        </button>
        <button type="button" className={`${BTN} bg-red-600 text-white flex-1`} onClick={hangUp} data-live-call-hang-up>
          <PhoneOff size={16} aria-hidden="true" /> {t("app.salesCall.hangUp")}
        </button>
      </div>

      {/* ── Hold, and who else is on the line ──────────────────────────
          Only on an outbound prospect / off-queue call: an inbound call
          is not in a conference and a colleague is just muted. */}
      {!internal && live.direction === "out" && live.attemptId ? <ConferenceControls attemptId={live.attemptId} active /> : null}

      {/* ── Handing them to somebody else ──────────────────────────────
          One control for both directions (TransferControl.js). `attemptId`
          is null for an inbound call until /api/sales/calls/answered has
          said which logged call this is, and stays null when the server
          says the call has no rep leg to hand back from — so the control
          renders nothing rather than a button that would refuse. The
          reason is said below instead. */}
      {!internal ? <TransferControl attemptId={live.attemptId || null} active onError={onTransferError} tone="call" /> : null}
      {live.transferNote && !internal ? <p className="text-xs text-emerald-900 dark:text-emerald-200">{live.transferNote}</p> : null}

      {/* "Machine detected" when AMD is on and said so, and the Mark
          button — a bookmark on the recording at this second, stamped by
          the server (RecordingMark.js). Outbound calls: the recording and
          the AMD leg are the prospect leg's. */}
      {live.direction === "out" ? (
        <>
          <AmdNotice facts={liveFacts} />
          <LiveMarkButton attemptId={live.attemptId || null} />
        </>
      ) : null}

      {/* "They'd rather text" / "email me": the thread or the composer on
          THIS caller, without hanging up. The call is held by CallSession
          in the shell, so the navigation these make leaves it up and this
          strip follows the rep to the page they land on. */}
      <div className="flex flex-wrap gap-2" data-live-call-reach>
        {live.e164 && !internal ? (
          <TextThemButton
            e164={live.e164}
            leadId={live.leadId || null}
            prospectId={live.leadId ? null : live.prospectId || null}
            variant="chip"
            label={t("app.salesText.ratherText")}
          />
        ) : null}
        {!internal ? <EmailThemButton leadId={live.leadId || null} prospectId={live.leadId ? null : live.prospectId || null} /> : null}
      </div>
    </div>
  );
}

export default function LiveCallStrip() {
  const { t, language } = useTranslation();
  const session = useCallSession();
  const slots = useConsoleSlots();
  const liveCallNode = slots?.liveCallNode || null;
  const { live, pending, viewMounted, sheetOpen, later, saveOutcome, draft, setDraft, subLists, busy, formError, introPrompt, closeIntroPrompt } = session;
  if (!session.mounted) return null;

  return (
    <>
      {/* The call, in the Dialer card's slot when the console is open. */}
      {live && liveCallNode ? createPortal(<LiveCallControls inCard />, liveCallNode) : null}

      {/* The call, as a strip, when no card is on the screen. */}
      {live && !liveCallNode ? (
        <div className={STRIP} data-live-call-strip={live.direction} data-incoming-live-strip={live.direction === "in" ? "" : undefined} role="region" aria-label={t("app.salesDial.onACall")}>
          <div className="bg-card border-b border-border shadow-lg px-4 sm:px-6 py-4">
            <div className="max-w-3xl">
              <LiveCallControls />
            </div>
          </div>
        </div>
      ) : null}

      {/* The write-up of the outbound call that just ended, when no panel
          is mounted to draw it. Same state, same card. */}
      {!live && pending && !viewMounted && !sheetOpen ? (
        <div className={STRIP} data-outbound-write-up={pending.id} role="dialog" aria-modal="false" aria-label={t("app.salesCall.whatHappened")}>
          <div className="bg-card border-b border-border shadow-lg px-4 sm:px-6 py-4">
            <div className="max-w-3xl space-y-3">
              <OutboundWriteUpCard t={t} language={language} session={session} inline />
              {pending.prospectId || pending.leadId ? (
                <Link
                  href={pending.prospectId ? `/sales/queue?prospectId=${encodeURIComponent(pending.prospectId)}` : `/sales/leads/${encodeURIComponent(pending.leadId)}`}
                  className={LINK}
                  data-live-call-back
                >
                  <ArrowLeft size={15} aria-hidden="true" /> {t("app.salesLive.backToCall")}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── The pop-up, after an answered call has ended ─────────────────
          Same draft, same save. Opened only by the auto-log reply — see
          CallSession's timer. */}
      <OutcomeSheet t={t} open={Boolean(sheetOpen && pending && !live)} onLater={later} title={t("app.salesCall.whatHappened")} body={pending ? whatHappenedBody(t, language, pending) : ""}>
        <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={saveOutcome} onLater={later} error={formError} autoFocus subLists={subLists} language={language} />
      </OutcomeSheet>

      {/* "Send {business} the intro email?" — after a no-answer or a
          voicemail, and nothing else. A portal, so it draws over
          whichever page the rep is on. */}
      <IntroEmailPrompt target={introPrompt} onClose={closeIntroPrompt} />
    </>
  );
}
