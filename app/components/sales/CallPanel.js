// app/components/sales/CallPanel.js
//
// The call, from the rep's side: press, talk, hang up, say what happened.
//
// ══ Two ways to place it, and the screen never offers a broken one ════════
//
// In-browser is the intended path — the rep talks through their headset and
// the prospect sees a number FieldQuo owns and answers on. It needs Twilio
// credentials, a TwiML application, at least one number, and a microphone the
// browser will actually hand over.
//
// When any of those is missing the panel falls back to the handset link, which
// is what this portal did before, and SAYS which link it is offering and why.
// What it never does is render a Call button that cannot call. A button that
// silently does nothing because a permission prompt was dismissed six weeks
// ago is the exact control AGENTS.md opens by forbidding, and microphone
// permission is the most likely single cause of it here.
//
// ══ Both paths record the attempt, and the server decides ═════════════════
//
// Every dial — browser or handset — POSTs first. The server re-asks the
// calling window with the per-24h cap now actually counted, refuses if it must,
// and writes the attempt row before anything rings. The handset link is only
// followed after that POST comes back. A rep who is offline gets a refusal
// rather than an untracked call, and that is the right way round: the cap has
// a private right of action behind it and an uncounted call is the failure.
//
// ══ The disposition is not optional, and not a modal over a live call ═════
//
// A call with no outcome makes every number computed from it wrong, and the
// rep is the only person who can fix one. So an unlogged call is rendered at
// the top of this panel, in place of the Call button, until it is written up.
// Never a modal DURING a call — a modal on a phone, over a rep who is still
// talking, is worse than useless — and not a block on the rest of the portal
// either. The one thing it holds back is starting another call, because two
// unlogged calls is how a day's numbers become unrecoverable.
//
// The form is drawn in the Dialer column AND, when the console offers a
// Disposition tab, in that tab too — one state, two places. It used to go
// ONLY into the tab, which is how a rep on the Script tab came to see the
// refusal ("the last one is not written up yet") and nothing to press.
//
// There IS a pop-up now (OutcomeForm.js's OutcomeSheet), and it does not
// contradict the paragraph above: it opens only after the carrier has
// reported the call ENDED and the server has said it was answered — the
// auto-log reply, "talked" or the rep's own hang-up on a connected call —
// never on connect, never over a live call, never for a call nobody
// answered. It never blocks the rest of the portal: Esc, the X and a click
// outside are "later", and the form in the Dialer column is still there.
// The buttons are the owner's six (lib/sales/calls/outcomeChoices.js), keys
// 1–4 and M; the nine-option dropdown is gone from every copy.
//
// ══ The line logs what it already knows ═══════════════════════════════════
//
// A prospect who picks up and puts the phone down, or a line nobody answers,
// is an outcome the carrier has already reported. Asking the rep to type it
// after every one — and holding the next dial until they did — stopped the
// floor on 2026-09-14. So when a browser call ends, this panel waits
// AUTO_LOG_GRACE_SECONDS for the rep to start an outcome, then asks the
// server to log what the row says (lib/sales/calls/dispositions.js
// autoLogOutcome: who hung up, how long they talked, or the terminal status
// of a call that never connected). A hang-up under ten seconds, a no-answer
// and a busy tone are written by themselves, marked autoLogged, and a
// fifteen-second strip says so with a "change" that reopens the form. A
// conversation — ten seconds or more, or the rep's own Hang up — is never
// logged for the rep. Who hung up is posted from here at `disconnect`,
// because Twilio's "completed" says nothing about which side dropped.
//
// ══ Transfer lives in TransferControl, not here ═══════════════════════════
//
// It used to be written out in this file, which is why it only ever worked on
// an outbound call: a rep who ANSWERED a callback in IncomingCallDock had no
// way to hand it to anybody. The control is now
// app/components/sales/TransferControl.js and both screens render it —
// extracted rather than copied, because two pickers over one state machine is
// AGENTS.md failure class 4 pointed at a live call.
//
// Nothing about the behaviour moved with it: the same three states, the same
// polling, the same rule that it renders nothing at all when the server says
// this call cannot be transferred.
//
// ══ The playbook loads WITH the prospect, never on the press ══════════════
//
// CallPlaybook is fetched from a `useEffect` keyed on `prospectId` — the same
// moment the card appears — and never from `place()`. The fetch itself now
// lives in PlaybookMount.js, which DialRegion also mounts when this panel is
// NOT on the screen (a closed calling window, a number nobody confirmed), so
// the Script tab reads the same playbook whether or not there is a dial. This
// file only hands it the prospect. That is not tidiness:
// assembling a script reads the prospect, its capabilities, its technologies
// and its opportunities, selects a playbook and renders nine stages. Putting
// that between the press and the ring would add a wait to the one action a rep
// takes forty times a day, and a rep who has learned that the Call button
// hesitates presses it twice.
//
// It is also why the panel renders BEFORE the call as well as during it. The
// opener is the one line that has to be read before the phone is answered, so
// a playbook that only appeared once the call connected would arrive after the
// only stage it was needed for.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CircleHelp,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ShieldAlert,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { STATE_AFTER_CALL } from "@/lib/sales/calls/agentState";
import {
  AUTO_LOG_GRACE_SECONDS,
  AUTO_LOG_UNDO_SECONDS,
  HUNG_UP_BY_PROSPECT,
  HUNG_UP_BY_REP,
  PROVIDER_ENDED,
} from "@/lib/sales/calls/dispositions";
import { OUTCOME_CHOICES, choiceLabelKey, foldChoice } from "@/lib/sales/calls/outcomeChoices";
import { ALREADY_ON_A_CALL } from "@/lib/sales/calls/liveCall";
import OutcomeForm, { EMPTY_DRAFT, OutcomeSheet, draftStarted } from "./OutcomeForm";
import PlaybookMount from "./PlaybookMount";
import PublishedEmail from "./PublishedEmail";
import TransferControl from "./TransferControl";
import NextSteps from "./NextSteps";
import TextThemButton, { openTextThread } from "./TextThem";
import { useRepPresence } from "./RepStatus";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
/** "4:12". A call timer, so seconds are never dropped. */
function clock(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * What the browser will say about the microphone, before we ask for it.
 *
 * Three answers, and `null` is one of them: some browsers do not implement the
 * permissions query for microphone at all, and treating "cannot ask" as
 * "denied" would take the good path away from Firefox users for no reason.
 * Null means unknown, the call button stays live, and the real prompt happens
 * on the first press — which is where a permission prompt belongs anyway,
 * attached to an action the rep just took.
 */
async function micState() {
  try {
    if (!navigator?.permissions?.query) return null;
    const status = await navigator.permissions.query({ name: "microphone" });
    return status?.state ?? null;
  } catch {
    return null;
  }
}

// ══ One panel, two kinds of target ════════════════════════════════════════
//
// A discovered Prospect out of the queue, or a lead the rep typed in
// themselves. The server has always accepted both — app/api/sales/calls's
// targetFor() reads `prospectId` OR `leadId`, SalesCallAttempt.leadId exists
// for exactly this, and dispositions write back to the lead — but until this
// panel could be handed a lead there was no screen that sent one. The owner
// found that the way anybody finds it: he opened his four leads and there was
// nothing to press.
//
// Exactly one of the two is set. Sending both would let the server pick, and a
// server picking between two ids the screen thinks are the same row is how a
// call gets logged against the wrong business.
export default function CallPanel({
  prospectId = null,
  // The prospect whose PLAYBOOK to read when the dial target is a lead. The
  // dial itself never uses it — see DialRegion — so a lead's call is logged on
  // the lead and its script comes from the business discovery found.
  playbookProspectId = null,
  leadId = null,
  phoneE164,
  // WHICH stored number to ring, when the rep has picked one that is not the
  // one on the listing. An ID, never a number: the server re-reads the row and
  // checks it belongs to this record in the request that dials, because a
  // request that could name its own destination is toll fraud on FieldQuo's
  // Twilio account. lib/sales/contact/resolve.js carries the whole argument.
  contactNumberId = null,
  businessName,
  // What the Call button and the on-call line NAME. Null means the business;
  // the console passes the number itself, read aloud, when the number that
  // will ring is not one of the record's stored ones — "Call +1 613 555
  // 0100", never "Call DRAIN KINGS", because it is the number that is being
  // called. `businessName` stays the business for NextSteps' booking.
  callLabel = null,
  fallbackHref,
  onWorked,
  // ── The autodialler's press ──────────────────────────────────────────
  //
  // `{ token, prospectId }`. When the token changes and the prospectId is
  // THIS panel's, the panel calls place("browser") — the same function the
  // Call button calls, with nothing in between. There is deliberately no
  // second way to start a call: lib/sales/autodial.js decides, this file
  // dials, and scripts/check-sales-autodial.mjs asserts the queue page holds
  // no `device.connect` of its own. The panel refuses the press when it is
  // not idle (a call up, an outcome unlogged, a press in flight) and reports
  // what happened through onAutoDialResult, so the dialler can skip on a
  // server refusal rather than sit on a row that will never ring.
  autoDial = null,
  onAutoDialResult = null,
  // ── Where the console wants the pieces drawn ─────────────────────────
  //
  // `{ disposition, nextSteps, script, contact }` — DOM nodes the queue console
  // registers for its bottom panel's tabs. When a node is given, that piece
  // is rendered THROUGH A PORTAL into it instead of inline below the dial;
  // when it is null (the lead screen, an older console) the piece renders
  // where it always did. The state machine is untouched by this: the
  // disposition form still reads `pending` from this component's state and
  // still writes through saveOutcome(), the playbook is still fetched with
  // the prospect (PlaybookMount, which takes `script`). Only the DOM
  // position moves. A second copy of the
  // form in the console would be AGENTS.md failure class 4 with a live call
  // behind it.
  slots = null,
  // ── A number the rep typed, resolved before the press rings anything ──
  //
  // `async () => ({ ok, phoneE164, contactNumberId } | { ok: false, error })`.
  // When given, place() awaits it FIRST and dials what it returns; when it
  // says no, the press ends with its sentence and nothing is posted. The
  // console uses it to turn a typed number into a stored one (through the
  // numbers route, with its validation) and hand back the id — so a typed
  // number reaches the dial route exactly as a stored one does, and the
  // route's suppression check and jurisdiction gate see it the same way.
  // Null keeps every existing caller byte-identical.
  beforeDial = null,
  // ── A press from a Dial button elsewhere on the console ───────────────
  //
  // `{ token }`. A new token calls place("browser") exactly as the Call
  // button does — the Company and Contact cards' per-number Dial buttons
  // paste the number into the display and hand the press here. Same
  // function, same beforeDial, same gate; consumed once; refused with the
  // panel's own sentence when a call is up or an outcome is unlogged.
  dialRequest = null,
  // Told the live Call object when a call goes up, and null when it ends —
  // the console's keypad sends DTMF through it while a call is up. Never
  // used to place or end a call; those stay here.
  onLiveCall = null,
}) {
  // The rep's own language, not the prospect's. Everything on this panel is
  // read by the person holding the phone; the words they SAY come from the
  // playbook, which is a separate catalogue in a separate language.
  const { t, language } = useTranslation();
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [mic, setMic] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  // The live call: the attempt row it belongs to, when it started, and the
  // Twilio connection object when there is one.
  const [attempt, setAttempt] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [muted, setMuted] = useState(false);
  const [tick, setTick] = useState(0);

  // Written up, or waiting to be. `draft` is what the rep has pressed and
  // typed in the outcome form — OutcomeForm.js's shape, shared by the three
  // copies of the form (Dialer column, Disposition tab, pop-up).
  const [pending, setPending] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  // The pop-up. Opened only by the auto-log reply saying "answered, ask the
  // rep"; closed by a save, by "later", or by the pending call going away.
  const [sheetOpen, setSheetOpen] = useState(false);
  // What the line logged by itself, while the "change" strip is up:
  // `{ attemptId, code, toE164, dialledAt, until }`.
  const [autoLogged, setAutoLogged] = useState(null);
  // A refused dial press flashes the form so the rep sees what to press.
  const [flash, setFlash] = useState(0);
  const formRef = useRef(null);
  // Who ended the current call, known only here: "rep" is set by hangUp()
  // before it disconnects; anything else at `disconnect` is the far end.
  const hungUpByRef = useRef(null);
  // The outcome the rep has started, readable from a timer without closing
  // over a stale render.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The "Schedule a call back" calendar entry — and the demo, the sign-up and
  // the walkthrough beside it — live in NextSteps.js, separate from the
  // disposition callback above (which is how a LOGGED call records the time
  // agreed). They put the promise on the rep's own /sales/calendar with the
  // contact already filled from who they're on the phone with, so it survives
  // past the call whether or not the call gets dispositioned.

  // The prospect's published contact, off the playbook read — PlaybookMount
  // fetches the script (see the header) and hands the body back through
  // onData; the Contact card wants one field of it. Null until it arrives.
  const [playbookProspect, setPlaybookProspect] = useState(null);
  const onPlaybookData = useCallback((body) => setPlaybookProspect(body?.prospect || null), []);

  const deviceRef = useRef(null);
  const callRef = useRef(null);

  // The portal-wide presence: the dialler reads `callUp` off it, and the two
  // automatic ledger transitions this panel makes (hangup → after_call, and
  // the re-read after the server moves the rep on dial and on disposition)
  // go through it. Read through a ref inside the SDK's event handlers, which
  // are bound once per call and would otherwise close over a stale object.
  const presence = useRepPresence();
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  const load = useCallback(async () => {
    try {
      const body = await fetchJson("/api/sales/calls");
      setConfig(body);
      const row = body?.pendingAttempt || null;
      // A call that ended while nobody was looking (a reload, a closed
      // laptop) is asked about at once rather than after the grace: the
      // grace exists so a rep who is reaching for the picker is not raced,
      // and nobody reaches for a picker on a page that just mounted. Only a
      // browser dial the carrier has finished with can be answered.
      setPending(
        row
          ? {
              ...row,
              autoAsk: row.dialChannel === "browser" && (Boolean(row.endedAt) || PROVIDER_ENDED.includes(row.providerStatus)),
              graceMs: 0,
            }
          : null,
      );
    } catch (err) {
      setError(err?.message || t("app.salesCall.loadSetupFailed"));
    }
  }, []);

  useEffect(() => {
    load();
    micState().then(setMic);
  }, [load]);

  // The call timer. A counter rather than a clock — the elapsed time is
  // computed from startedAt on every render so a paused tab does not lose
  // seconds the way an incrementing counter would.
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // The heartbeat used to be here, which meant it beat only on the screens
  // that render this panel — a rep reading notes went stale in fifteen
  // minutes and dropped off the inbound ring plan. It is in
  // RepPresenceProvider now, once, for every /sales screen.

  useEffect(
    () => () => {
      // Leaving the screen must not leave a call up. The rep would still be
      // connected with nothing on screen to hang up with.
      try {
        callRef.current?.disconnect?.();
        deviceRef.current?.destroy?.();
      } catch {
        /* the SDK throws on a device already torn down; nothing to do */
      }
    },
    [],
  );

  const browserReady = Boolean(
    config?.store?.ready && config?.dial?.ready !== false && mic !== "denied",
  );
  const blocked = config?.dial?.blockedBy || null;

  const elapsed = startedAt ? Date.now() - startedAt : 0;
  // `tick` is read so the timer re-renders; the value itself is not used.
  void tick;

  // A call THIS panel is not holding — the answered inbound call in
  // IncomingCallDock, reported through the provider. While it is up the
  // Call button is disabled and says so, and every press path below
  // refuses: the thumb, the Dial button beside a number, the autodialler.
  // 83144544 deliberately kept the inbound call out of this panel's own
  // state so it could not hold the dialler hostage; that left nothing
  // telling the panel a call was up, and QA (2026-09-17) placed a second
  // dial under a live one. The panel's own call sets `startedAt` and hides
  // the button, so `callLive && !startedAt` is exactly "somebody else's".
  const onAnotherCall = presence.callLive === true && !startedAt;


  // `source` is who pressed: "manual" for a thumb, "autodial" for the
  // countdown in lib/sales/autodial.js. Recorded on the attempt
  // (SalesCallAttempt.dialSource) so the floor board can say how many calls
  // the dialler placed against how many a rep did; it changes nothing about
  // the call.
  async function place(channel, source = "manual") {
    // Never two at once, and never over a call. The Call button is not
    // rendered in these states, so this guard exists for the autodialler's
    // press, which arrives on a timer rather than from a thumb.
    if (busy || startedAt || pending) return false;
    // Read through the ref, not the render: the autodialler's press arrives
    // on a timer and a countdown that ended a beat after Pick up must see
    // the answered call, not the render it was armed in.
    if (presenceRef.current.callLive === true) {
      setError(t("app.salesCall.onACall"));
      return false;
    }
    setBusy("dial");
    setError("");
    try {
      // The typed-number step, when the console asks for one. Awaited before
      // the dial POST so a number that fails validation or is suppressed
      // never reaches the wire; its refusal is this panel's error.
      let dialTarget = { phoneE164, contactNumberId };
      if (beforeDial) {
        const pre = await beforeDial();
        if (!pre?.ok) {
          setError(pre?.error || t("app.salesCall.dialFailed"));
          return false;
        }
        dialTarget = {
          phoneE164: pre.phoneE164 || phoneE164,
          contactNumberId: pre.contactNumberId || null,
          // A typed number the numbers route refused to store because it is
          // a test dial (a test line, or a test account). Sent as the number
          // itself, which the dial route accepts ONLY for those two cases
          // and re-judges for itself — see its `typedE164`.
          typedE164: pre.typedE164 || null,
        };
      }
      const body = await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the id that is actually set. `prospectId: null` alongside a real
        // leadId would still be a prospectId key on the wire, and targetFor
        // checks `if (prospectId)` first — a falsy one is harmless today and is
        // one truthiness change away from routing every lead call at a
        // prospect that does not exist.
        body: JSON.stringify({
          action: "dial",
          ...(prospectId ? { prospectId } : { leadId }),
          // Omitted entirely when the rep has not picked one, so the server
          // falls back to its OWN best choice rather than to a null it has to
          // interpret.
          ...(dialTarget.contactNumberId ? { contactNumberId: dialTarget.contactNumberId } : {}),
          ...(dialTarget.typedE164 ? { typedE164: dialTarget.typedE164 } : {}),
          channel,
          source,
        }),
      });
      setAttempt(body);
      // The server moved the rep to on_call; the header should say so now
      // rather than at the next beat.
      presenceRef.current.refresh();

      if (channel !== "browser") {
        // The attempt is recorded; now hand off to the handset. The href comes
        // from dialHref() — this file has no dial string of its own, and
        // scripts/check-sales-calling-window.mjs asserts none appears under
        // app/sales.
        if (fallbackHref) window.location.href = fallbackHref;
        setPending({ id: body.attemptId, toE164: body.to, dialledAt: body.serverNow });
        setAttempt(null);
        return true;
      }

      const { Device } = await import("@twilio/voice-sdk");
      const tokenBody = await fetchJson("/api/sales/calls/token", { method: "POST" });

      const device = new Device(tokenBody.token, { logLevel: "error" });
      deviceRef.current = device;
      // NOT registered, deliberately. register() is what makes a client
      // RECEIVE calls, and connect() does not need it. Since the access token
      // began granting incomingAllow, registering here would put a SECOND
      // client on this rep's identity — Twilio rings every registered client,
      // this one has no `incoming` handler, and a contractor ringing back
      // while a rep happened to be on an outbound call would be answered by a
      // Device that does nothing with it. One registered client per rep, and
      // it is the portal-wide dock in IncomingCallDock.js.

      // The destination is NOT sent. The bridge reads it off the attempt row
      // the server just wrote, after the gate cleared — see the bridge route's
      // header. All the browser gets to say is which attempt this is.
      const call = await device.connect({ params: { attemptId: body.attemptId } });
      callRef.current = call;
      setStartedAt(Date.now());
      setMuted(false);
      presenceRef.current.setCallUp(true);
      onLiveCall?.(call);

      hungUpByRef.current = null;
      call.on("disconnect", () => {
        callRef.current = null;
        onLiveCall?.(null);
        setStartedAt(null);
        // Who dropped. The Hang up button set "rep" before disconnecting;
        // a disconnect nobody here asked for is the far end. Posted, not
        // awaited — the write-up must not wait on it, and a lost report
        // reads as "ask the rep", never as a hang-up.
        const hungUpBy = hungUpByRef.current === HUNG_UP_BY_REP ? HUNG_UP_BY_REP : HUNG_UP_BY_PROSPECT;
        hungUpByRef.current = null;
        fetchJson("/api/sales/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ended", attemptId: body.attemptId, hungUpBy }),
        }).catch(() => {});
        setPending({
          id: body.attemptId,
          toE164: body.to,
          dialledAt: body.serverNow,
          dialChannel: "browser",
          hungUpBy,
          // The line may log this one — after the grace, and only if the
          // rep has not started. The rep's own hang-up is never auto-logged
          // (the server refuses it too); asking would be a wasted round trip.
          autoAsk: hungUpBy !== HUNG_UP_BY_REP,
          graceMs: AUTO_LOG_GRACE_SECONDS * 1000,
        });
        setAttempt(null);
        try {
          device.destroy();
        } catch {
          /* already gone */
        }
        deviceRef.current = null;
        presenceRef.current.setCallUp(false);
        // The one automatic transition only this handler can make: the call
        // has ended and the outcome has not been logged. On the ledger this
        // is what separates time on the phone from time writing it up. Soft
        // — the disposition below moves the rep on regardless.
        presenceRef.current.postState({ state: STATE_AFTER_CALL, callAttemptId: body.attemptId });
      });
      call.on("error", (err) => {
        setError(err?.message || t("app.salesCall.callDropped"));
      });
      return true;
    } catch (err) {
      // A refusal from the gate arrives with the whole decision attached, so
      // the reason shown is the same sentence the card above would print.
      const blockers = err?.data?.compliance?.blockers;
      setError(
        Array.isArray(blockers) && blockers.length
          ? blockers.map((b) => b.title).join(" ")
          : // The server's own "you're on a call" (a stale tab's dial, the
            // browser's flag not knowing) in the rep's language, not the
            // route's English.
            err?.data?.code === ALREADY_ON_A_CALL
            ? t("app.salesCall.onACall")
            : err?.message || t("app.salesCall.dialFailed"),
      );
      return false;
    } finally {
      setBusy("");
    }
  }

  // ── The autodialler's press, once per token ──────────────────────────
  //
  // A token this panel has already acted on is never acted on again, so a
  // re-render cannot dial twice; a token for another prospect is ignored, so
  // a countdown that ended after the rep clicked a different row rings
  // nobody. The result goes back by token so the dialler can match it.
  const autoDialSeen = useRef(null);
  useEffect(() => {
    if (!autoDial || !autoDial.token || autoDial.prospectId !== prospectId) return;
    if (autoDialSeen.current === autoDial.token) return;
    // Consumed the moment it is seen, whatever happens next. A token that
    // waited for the panel to become idle would fire later, on its own, after
    // the rep had logged an outcome — which is the one thing a progressive
    // dialler must never do. Not idle now means not dialled, reported back.
    autoDialSeen.current = autoDial.token;
    const token = autoDial.token;
    if (!browserReady || busy || startedAt || pending || onAnotherCall) {
      onAutoDialResult?.({ token, ok: false, reason: "not_idle" });
      return;
    }
    place("browser", "autodial").then((ok) => onAutoDialResult?.({ token, ok: ok === true, reason: ok ? null : "refused" }));
    // `place` is a plain function of this render; the guards above are what
    // matter, and they are read from the same render the token arrived in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDial?.token, autoDial?.prospectId, prospectId]);

  const dialRequestSeen = useRef(null);
  useEffect(() => {
    if (!dialRequest?.token || dialRequestSeen.current === dialRequest.token) return;
    dialRequestSeen.current = dialRequest.token;
    if (onAnotherCall) {
      // The Dial button beside a number, or a call-back's "Call now", while
      // an inbound call is live: refused, and the sentence already printed
      // above the disabled button is brought into view rather than printed
      // a second time in the error box.
      try {
        document.querySelector("[data-call-on-another-call]")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      } catch {
        /* an old browser; the sentence is on the card regardless */
      }
      return;
    }
    if (busy || startedAt || pending) {
      // Said with what to press, and the form is flashed and scrolled to —
      // the refusal alone, on a tab without the form, was the floor's
      // whole complaint.
      setError(t("app.salesCall.dialWhileBusy"));
      setFlash((n) => n + 1);
      try {
        formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      } catch {
        /* an old browser; the flash still shows */
      }
      return;
    }
    if (!browserReady && !fallbackHref) return;
    place(browserReady ? "browser" : "handset");
    // `place` is a plain function of this render; the guards above are read
    // from the same render the token arrived in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialRequest?.token]);

  function hangUp() {
    // Before the disconnect, so the handler it fires reads "rep". The far
    // end dropping and the rep pressing the button in the same instant is
    // filed as the rep's — they pressed it.
    hungUpByRef.current = HUNG_UP_BY_REP;
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* the disconnect handler does the rest */
    }
  }

  // ── The line logs what it knows, after the grace ─────────────────────
  //
  // One timer per pending attempt. It asks the server once the grace has
  // passed, and only if the rep has not started typing — a code or a note
  // in the form means the rep is answering and the line stays out of it.
  // "not_reported" (the carrier's completed event is still in flight) is
  // asked again a few times; every other refusal leaves the form up.
  const autoAskSeen = useRef(null);
  useEffect(() => {
    if (!pending?.autoAsk || !pending.id) return undefined;
    if (autoAskSeen.current === pending.id) return undefined;
    autoAskSeen.current = pending.id;
    const attemptId = pending.id;
    const toE164 = pending.toE164;
    const dialledAt = pending.dialledAt;
    let cancelled = false;
    let timer = null;
    let tries = 0;
    const ask = async () => {
      if (cancelled) return;
      if (draftStarted(draftRef.current)) return;
      tries += 1;
      let body = null;
      try {
        body = await fetchJson("/api/sales/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auto_log", attemptId }),
        });
      } catch {
        return; // the form is still there; the rep can log it
      }
      if (cancelled) return;
      if (body?.ok && body.code) {
        setPending((p) => (p?.id === attemptId ? null : p));
        setAutoLogged({ attemptId, code: body.code, toE164, dialledAt, until: Date.now() + AUTO_LOG_UNDO_SECONDS * 1000 });
        // The server moved the rep to available; the same order the typed
        // path keeps, for the same reason (see saveOutcome).
        await presenceRef.current.refresh();
        await load();
        onWorked?.();
        return;
      }
      if (body?.reason === "not_reported" && tries < 5) {
        timer = setTimeout(ask, 3000);
        return;
      }
      // The server's word that the call was ANSWERED and the rep has to say
      // what happened: a conversation ("talked"), or the rep's own hang-up on
      // a connected call (talkSeconds is a number only when it connected).
      // This — and nothing else — opens the pop-up. A call nobody answered
      // never reaches here with a code of null and a number of seconds.
      if ((body?.reason === "talked" || body?.reason === "rep_hung_up") && typeof body?.talkSeconds === "number") {
        setSheetOpen(true);
      }
    };
    timer = setTimeout(ask, Math.max(0, Number(pending.graceMs) || 0));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `load` and `onWorked` are read when the answer lands; keying on them
    // would re-arm the timer on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, pending?.autoAsk]);

  useEffect(() => {
    if (!flash) return undefined;
    const id = setTimeout(() => setFlash(0), 2500);
    return () => clearTimeout(id);
  }, [flash]);

  // The strip goes away by itself. A rep who wants to change it after
  // fifteen seconds still can — the row is in today's list — but the strip
  // in the dial space would otherwise sit over the Call button.
  useEffect(() => {
    if (!autoLogged) return undefined;
    const ms = autoLogged.until - Date.now();
    if (ms <= 0) {
      setAutoLogged(null);
      return undefined;
    }
    const id = setTimeout(() => setAutoLogged(null), ms);
    return () => clearTimeout(id);
  }, [autoLogged]);

  /** "Change": the line's outcome comes back up as the rep's to overwrite. */
  function changeAutoLogged() {
    if (!autoLogged) return;
    setPending({ id: autoLogged.attemptId, toE164: autoLogged.toE164, dialledAt: autoLogged.dialledAt, override: autoLogged.code, autoAsk: false });
    setAutoLogged(null);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setError("");
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }

  // "You rang {number}" for a call this rep placed; "They called you back
  // from {number} at {time}" for one they received. The server no longer
  // hands an inbound row to this panel (pendingAttempt is outbound-only),
  // but the sentence is chosen by the row's direction rather than by that
  // assumption, so a row that reaches here by any other path is never
  // described as a call the rep made.
  function whatHappenedBody(row) {
    if (row?.direction === "in") {
      let time = "";
      try {
        time = new Intl.DateTimeFormat(language || undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(row.dialledAt));
      } catch {
        time = String(row.dialledAt || "");
      }
      return t("app.salesCall.whatHappenedBodyInbound", { number: row.toE164, time });
    }
    return t("app.salesCall.whatHappenedBody", { number: row?.toE164 });
  }

  async function saveOutcome() {
    if (!pending || !draft.choice) return;
    // The fold is pure (outcomeChoices.js): the six buttons become one of the
    // table's codes, or a refusal with the sentence to print. Nothing here
    // names a code.
    const fold = foldChoice({
      key: draft.choice,
      note: draft.note,
      whenKind: draft.whenKind,
      whenAt: draft.whenAt ? new Date(draft.whenAt) : null,
      notOwner: draft.notOwner,
      interested: draft.interested,
      which: draft.which,
      now: new Date(),
    });
    if (!fold.ok) {
      setFormError(t(fold.reasonKey));
      return;
    }
    setBusy("disposition");
    setError("");
    setFormError("");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disposition",
          attemptId: pending.id,
          disposition: fold.code,
          note: fold.note,
          callbackAt: fold.callbackAt ? fold.callbackAt.toISOString() : null,
        }),
      });
      setPending(null);
      setDraft(EMPTY_DRAFT);
      setSheetOpen(false);
      // ── "They asked to be texted instead" opens the composer ──────────
      //
      // The outcome's retry rule schedules no re-dial (lib/sales/retryRules.js
      // text_instead); the next touch is a text, and it is the rep's to
      // write NOW, while the call is fresh. Same door as the Text them
      // button (TextThem.js openTextThread): the thread on the number that
      // was rung, the lead behind it, the blank box focused. A refusal
      // here — the number is on the do-not-contact list, or another rep's
      // — is printed as the form's error; the outcome is already saved.
      if (fold.code === "text_instead") {
        try {
          const { href } = await openTextThread({
            e164: pending.toE164 || phoneE164,
            leadId: leadId || null,
            prospectId: leadId ? null : prospectId || null,
          });
          await presenceRef.current.refresh();
          await load();
          onWorked?.();
          router.push(href);
          return;
        } catch (err) {
          setFormError(err?.message || t("app.salesText.newOpenFailed"));
        }
      }
      // The server moved the rep back to available. Awaited BEFORE onWorked,
      // because the queue's autodialler arms on onWorked and reads the state
      // through the same context — armed against a row still saying on_call
      // it would stop with "not available" and wait for a press that is not
      // coming.
      await presenceRef.current.refresh();
      await load();
      onWorked?.();
    } catch (err) {
      setFormError(err?.message || t("app.salesCall.outcomeSaveFailed"));
    } finally {
      setBusy("");
    }
  }

  // ── "Write it up later" ─────────────────────────────────────────────
  //
  // The call goes to the rep's unlogged list (UnloggedCalls.js: the Today
  // card, the Queue badge, the log-out gate) and the dialler is freed —
  // the server's `defer` stops holding it in pendingAttempt and gives the
  // retry pool a provisional schedule. Not a dismiss: a pop-up closed with
  // Esc IS this, so the rep is never left with a form they have to find.
  const later = useCallback(async () => {
    setSheetOpen(false);
    const row = pending;
    if (!row?.id || row.override) return;
    setBusy("defer");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer", attemptId: row.id }),
      });
      setPending((p) => (p?.id === row.id ? null : p));
      setDraft(EMPTY_DRAFT);
      setFormError("");
      await presenceRef.current.refresh();
      await load();
      onWorked?.();
    } catch (err) {
      // The form is still in the Dialer column; the sentence says why.
      setFormError(err?.message || t("app.salesCall.deferFailed"));
    } finally {
      setBusy("");
    }
    // `load` and `onWorked` are read when the reply lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, pending?.override]);

  /** Draw `node` in the console's slot when it has one, inline otherwise. */
  const into = (slot, node) => (slot ? createPortal(node, slot) : node);
  /**
   * Draw inline AND in the console's slot — one state, two places. `render`
   * is called once per place with whether this is the inline copy, so a ref
   * that scrolls the form into view lands on the copy in the Dialer column
   * and not on the one behind a hidden tab.
   */
  const both = (slot, render) => (
    <>
      {render(true)}
      {slot ? createPortal(render(false), slot) : null}
    </>
  );
  // The console's Call button is the big green one of the reference dialler;
  // the lead screen keeps the portal's primary. Same button, same press.
  const callClass = slots
    ? "bg-emerald-600 hover:bg-emerald-700 text-white min-h-[52px] text-base"
    : "bg-primary text-primary-foreground";

  // ── While the tables are absent ──────────────────────────────────────────
  //
  // Reads the store's own answer rather than a constant, so this disappears on
  // its own the day the models land. Until then the handset link still works
  // and nothing pretends a call is being recorded.
  if (config && !config.store?.ready) {
    return (
      <div className="space-y-2">
        {fallbackHref ? (
          <a href={fallbackHref} className={`${BTN} bg-primary text-primary-foreground w-full`}>
            <Phone size={16} /> {t("app.salesCall.callName", { name: phoneE164 })}
          </a>
        ) : null}
        <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{t("app.salesCall.notRecordedTitle")}</p>
          {/* Two whole sentences rather than one with an "is/are" hole in it.
              The model names are identifiers and stay in English; the verb they
              govern does not exist in half the languages this portal is read
              in, so the count picks a SENTENCE and each language writes its own
              agreement. */}
          <p className="break-words">
            {config.store.missing.length > 1
              ? t("app.salesCall.notRecordedBodyMany", {
                  models: config.store.missing.join(t("app.salesCall.listAnd")),
                })
              : t("app.salesCall.notRecordedBodyOne", {
                  models: config.store.missing.join(t("app.salesCall.listAnd")),
                })}
          </p>
        </div>
        {/* The call still happens on this path, so the words still belong on
            the screen. The two systems are unrelated: no SalesCallAttempt
            table is not a reason to send a rep in without a script. */}
        <PlaybookMount prospectId={prospectId} playbookProspectId={playbookProspectId} onData={onPlaybookData} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {/* The address their own site publishes, from the playbook read — it
          rides on the same ownership query the script does. Nothing when
          there is none. */}
      {into(
        slots?.contact || null,
        <PublishedEmail email={playbookProspect?.email || null} source={playbookProspect?.emailSource || null} />,
      )}

      {/* ── On a call ───────────────────────────────────────────────────── */}
      {startedAt ? (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100 break-words">
              {t("app.salesCall.onCallWith", { name: callLabel || businessName || phoneE164 })}
            </p>
            <p className="text-xl font-mono tabular-nums text-emerald-900 dark:text-emerald-100">
              {clock(elapsed)}
            </p>
          </div>
          {attempt?.callerId ? (
            <p className="text-xs text-emerald-900 dark:text-emerald-200 break-words">
              {t("app.salesCall.callerIdNotice", { number: attempt.callerId })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={`${BTN} border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1`}
              onClick={toggleMute}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              {muted ? t("app.salesCall.unmute") : t("app.salesCall.mute")}
            </button>
            <button
              type="button"
              className={`${BTN} bg-red-600 text-white flex-1`}
              onClick={hangUp}
            >
              <PhoneOff size={16} /> {t("app.salesCall.hangUp")}
            </button>
          </div>

          {/* ── Handing them to somebody else ──────────────────────────────
              The same control the inbound dock renders, extracted rather than
              copied: two pickers over one state machine is AGENTS.md failure
              class 4 aimed at a live call. It renders nothing at all when the
              server says this call cannot be transferred. */}
          <TransferControl attemptId={attempt?.attemptId || null} active={Boolean(startedAt)} onError={setError} tone="call" />

          {/* "They'd rather text" — mid-call, the thread on THIS number
              with the blank box, without hanging up: the call stays up
              (nothing here ends it), the rep types while they talk. */}
          <TextThemButton
            e164={phoneE164}
            leadId={leadId || null}
            prospectId={leadId ? null : prospectId || null}
            variant="chip"
            label={t("app.salesText.ratherText")}
          />
        </div>
      ) : null}

      {/* ── An unlogged call, which outranks starting another ─────────────
          Drawn HERE, in the Dialer column where the Call button was, and
          again in the console's Disposition tab when it has one. One form,
          one state, two places — see the header. */}
      {!startedAt && pending
        ? both(slots?.disposition || null, (inline) => (
            <div
              className={`rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 ${flash ? "ring-2 ring-amber-500 animate-pulse" : ""}`}
              data-call-disposition={inline ? "dialer" : "tab"}
              ref={inline ? formRef : null}
            >
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  {t("app.salesCall.whatHappened")}
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  {pending.override
                    ? t("app.salesCall.changeAutoLoggedBody", {
                        outcome: t(`app.salesCall.disposition.${pending.override}.label`),
                        number: pending.toE164,
                      })
                    : whatHappenedBody(pending)}
                </p>
              </div>

              {/* The six buttons, over the one shared draft. Every press
                  folds to a real code in lib/sales/calls/outcomeChoices.js;
                  this screen has no say in which. */}
              <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={saveOutcome} onLater={pending.override ? null : later} error={formError} />

              {/* After the call, beside the write-up: the same control the
                  Call button had, so "text me instead" is one press whether
                  or not the rep logs it as the outcome. Drawn in the Dialer
                  column only — the tab's copy of the form is the same
                  state, and two presses for one thread is noise. */}
              {inline ? (
                <TextThemButton
                  e164={pending.toE164 || phoneE164}
                  leadId={leadId || null}
                  prospectId={leadId ? null : prospectId || null}
                  variant="chip"
                  label={t("app.salesText.textThem")}
                />
              ) : null}

              {pending.autoAsk && pending.dialChannel === "browser" ? (
                <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  {t("app.salesCall.autoLogPending")}
                </p>
              ) : null}
            </div>
          ))
        : slots?.disposition
          ? createPortal(
              // The console's Disposition tab, with no call to write up: say so,
              // and list what a written-up call will ask for. A blank tab reads
              // as a broken one.
              <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground space-y-2" data-call-disposition-empty>
                <p className="font-semibold text-foreground">{t("app.salesCall.noCallToLog")}</p>
                <p className="break-words">{t("app.salesCall.noCallToLogBody")}</p>
                {/* What the buttons offer — not the line's three, which a
                    rep never picks (outcomeChoices.js). */}
                <ul className="flex flex-wrap gap-1.5">
                  {OUTCOME_CHOICES.map((c) => (
                    <li key={c.key} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
                      {t(choiceLabelKey(c.key))}
                    </li>
                  ))}
                </ul>
              </div>,
              slots.disposition,
            )
          : null}

      {/* ── What the line logged by itself, with fifteen seconds to change it ── */}
      {autoLogged && !pending && !startedAt
        ? both(slots?.disposition || null, () => (
            <div
              className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3"
              data-call-auto-logged={autoLogged.code}
              role="status"
            >
              <p className="break-words min-w-0">
                {t("app.salesCall.autoLoggedAs", {
                  outcome: t(`app.salesCall.disposition.${autoLogged.code}.label`),
                })}
              </p>
              <button
                type="button"
                className="shrink-0 min-h-[36px] px-3 rounded-lg border border-emerald-400 font-semibold"
                onClick={changeAutoLogged}
                data-call-auto-logged-change
              >
                {t("app.salesCall.autoLoggedChange")}
              </button>
            </div>
          ))
        : null}

      {/* ── The pop-up, after an answered call has ended ─────────────────
          Same draft, same save. Opened only by the auto-log reply — see the
          header and the timer above. */}
      <OutcomeSheet
        t={t}
        open={Boolean(sheetOpen && pending && !startedAt)}
        onLater={later}
        title={t("app.salesCall.whatHappened")}
        body={pending ? whatHappenedBody(pending) : ""}
      >
        <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={saveOutcome} onLater={later} error={formError} autoFocus />
      </OutcomeSheet>

      {/* ── The call button ─────────────────────────────────────────────── */}
      {!startedAt && !pending ? (
        <div className="space-y-2">
          {/* Said above the button it disables, and only while it is true.
              A greyed button with no sentence is the control that "appears
              to work and doesn't" — the rep would blame the microphone. */}
          {onAnotherCall ? (
            <p className="text-sm text-amber-900 dark:text-amber-200 break-words text-center" role="status" data-call-on-another-call>
              {t("app.salesCall.onACall")}
            </p>
          ) : null}
          {browserReady ? (
            <button
              type="button"
              className={`${BTN} ${callClass} w-full`}
              disabled={Boolean(busy) || onAnotherCall}
              onClick={() => place("browser")}
              data-call-button
            >
              {busy === "dial" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Phone size={16} />
              )}
              {t("app.salesCall.callName", { name: callLabel || businessName || phoneE164 })}
            </button>
          ) : null}

          {!browserReady && fallbackHref ? (
            <button
              type="button"
              className={`${BTN} ${callClass} w-full`}
              disabled={Boolean(busy) || onAnotherCall}
              onClick={() => place("handset")}
              data-call-button
            >
              {busy === "dial" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Phone size={16} />
              )}
              {t("app.salesCall.callFromYourPhone", { phone: phoneE164 })}
            </button>
          ) : null}

          {/* ── Text them, beside the Call button ─────────────────────────
              The press that was missing when a company said "text me
              instead" (TextThem.js says what it does). The number is the
              one the Call button would ring — a typed number included,
              which the server records on the lead the way the dial pad
              does, or leaves off the record when it is a test line. */}
          <TextThemButton
            e164={phoneE164}
            leadId={leadId || null}
            prospectId={leadId ? null : prospectId || null}
            businessName={callLabel ? null : businessName || null}
          />

          {/* Why the good path is not on offer. Never silent: a rep who does
              not know the browser refused the microphone will assume the
              product is broken, and they will be half right. */}
          {!browserReady && config ? (
            <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                {mic === "denied" ? (
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CircleHelp size={16} className="mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground break-words">
                    {mic === "denied"
                      ? t("app.salesCall.micRefusedTitle")
                      : blocked?.title
                        ? t("app.salesCall.callingNeeds", { requirement: blocked.title })
                        : t("app.salesCall.callingNotConfigured")}
                  </p>
                  <p className="break-words">
                    {mic === "denied"
                      ? t("app.salesCall.micRefusedBody")
                      : blocked?.fix || t("app.salesCall.handsetFallbackBody")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── What happens next ────────────────────────────────────────────────
          Available in every state: a rep books the next step when they reach
          someone AND when they don't. The three next steps — a demo with the
          rep, sent to sign up, a walkthrough with a specialist — and the
          call-back, in one block (NextSteps.js says why three). Opens the
          same event editor the calendar uses, with the business and number
          already filled from who they're calling. */}
      {into(
        slots?.nextSteps || null,
        <NextSteps prospectId={prospectId} leadId={leadId} businessName={businessName} phoneE164={phoneE164} />,
      )}

      {/* ── The words ────────────────────────────────────────────────────────
          Last in the DOM and in all three states — before the dial, during the
          call, and while the outcome is being written up. Last because the
          controls above are what a thumb reaches for first on a phone; in all
          three states because the rep needs the opener before the ring, the
          objections while they are being pushed back on, and the stages again
          when they are writing down what was actually said. */}
      <PlaybookMount
        prospectId={prospectId}
        playbookProspectId={playbookProspectId}
        slot={slots?.script || null}
        onData={onPlaybookData}
      />
    </div>
  );
}
