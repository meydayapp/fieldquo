"use client";

// app/components/sales/IncomingCallDock.js
//
// The thing that rings when a contractor calls back.
//
// ══ Why nothing rang before ═══════════════════════════════════════════════
//
// Two halves were missing and each made the other invisible.
//
// The access token granted `incomingAllow: false`, so a rep's identity was not
// permitted to RECEIVE a call. And the Twilio Device was constructed inside
// `place()` in CallPanel — created to make one outbound call and destroyed on
// disconnect — so even with the grant there was no registered client listening
// between calls. inboundDistribution.js was emitting perfectly correct TwiML,
// `<Dial><Client>sales_rep:…</Client></Dial>`, at a client that did not exist.
//
// The owner heard the consequence: he rang +17166383616, it was answered, and
// nobody picked up.
//
// ══ Why this lives in the shell and not on a screen ═══════════════════════
//
// A rep is on the queue, or reading a lead, or writing notes. A call does not
// arrive on a particular page, so a listener that only exists on the dialler
// screen means the phone rings only when you happen to be looking at it. It is
// mounted once, in the portal shell, and every /sales screen inherits it.
//
// ══ Registered is not the same as being rung ══════════════════════════════
//
// Registering only makes this browser REACHABLE. Who is actually rung is
// decided server-side by ringPlan(), from presence read at the instant the call
// lands — a rep who is paused, offline or stale is not a target. Deciding it
// in two places is how a paused rep's laptop starts ringing, so the client
// deliberately keeps no opinion about it.
//
// ══ Answering is the only moment anything knows WHO answered ══════════════
//
// An inbound SalesCallAttempt's `salesRepId` is written by the inbound webhook
// before the phone has rung once, from whoever last rang that contractor, and
// ringPlan then offers the call to up to three browsers at the same time. So
// the rep who actually picked up was never recorded as having picked up: the
// floor board and their own call history credited the call to somebody else,
// or to nobody. Only this component knows, and only at the instant of the
// click — so the click posts to /api/sales/calls/answered.
//
// What it posts is one CallSid, and a CallSid is a CLAIM, not proof. The route
// reads the leg back from Twilio and refuses it unless the carrier says it was
// rung at this rep's own client identity. Nothing here is trusted; the reply
// is what the transfer control is rendered from.
//
// ══ 2026-09-17: the ring is an alert dialog ═══════════════════════════════
//
// This supersedes the 2026-09-11 "drawer at the top". The owner rang his own
// number back that night and never saw a way to pick up — the drawer slid in
// under the top bar and, on the screen he was on, read as part of the page.
// His instruction: an incoming call must appear as an ALERT DIALOG, "like a
// dialog if they are available" — shadcn's alert-dialog shape: a centred
// card over a scrim, focus trapped, not dismissable by clicking outside, two
// clear actions, Pick up and Decline.
//
// So a ring renders app/components/AlertDialog.js with role="alertdialog":
// labelled "Incoming call", described by the caller line — the business the
// inbound matcher names, the number, whose claim it is, which of our numbers
// they rang — a ring clock ("Ringing for 12s"), a big Pick up that has focus
// the moment the card opens, and a Decline. Escape does NOTHING and the
// scrim is inert: a contractor ringing back is not something to lose by
// touching the wrong pixel, and Decline is a button with a name. z-[80]:
// above the tour (z-[60]) and the Off reminder (z-[65]); the reminder closes
// itself when a ring lands, because shouldRemind() answers no while
// inboundRinging is true.
//
// ══ 2026-09-17, the owner's addition: where the dialog may send the rep ═══
//
// Beside Pick up and Decline, two links that work while it rings AND after
// pick-up: "Open the company" (the queue card when the rep holds the claim,
// the lead page when it is their own lead) and "Notes" (that card's Notes
// tab, or the lead page's notes block). The dialog also prints the city.
// A number that matched nobody prints "Not one of your leads" and "Save as
// a new lead" — the leads screen with the form open and the number in it.
// A business held by another rep prints its name and "Held by <rep>" with
// NO link. All of that is decided by the server (/api/sales/calls/caller →
// lib/sales/calls/callerLinks.js) against the session's rep: this file
// draws an href it was given or nothing, and never composes one from an
// id, because the pages behind those hrefs are rep-scoped and a link that
// opened a 404 is the dead-control class AGENTS.md leads with. The links
// are ordinary <Link>s: the shell owns this dock, so the ring survives the
// navigation and the dialog is still up on the page it opened.
//
// Pick up closes the dialog, and the live call is drawn in the queue's Dialer
// card — through the slot lib consoleSlots.js describes — so an answered
// callback sits exactly where an outbound call would. On any other screen
// there is no card to draw into, and the call collapses to a fixed strip
// under the top bar with the same controls (hang up, transfer, the matched-
// call note); a rep must always be able to hang up AND keep using the page,
// which a modal would forbid. The state machine did not move: the Call
// object, the answered attempt, the transfer control and the ledger
// transitions are all still here. Only WHERE the buttons are drawn changed.
// The name IncomingCallDock stays, because the shell, the checks and five
// headers know it by that name.
//
// ══ 2026-09-17: the write-up happens HERE, once ═══════════════════════════
//
// An answered callback used to be written up nowhere in particular. The
// inbound row had no outcome, GET /api/sales/calls picked it as the newest
// unwritten attempt of the day, and CallPanel drew "What happened on that
// call? You rang {number}" over the Call button — for a call the rep did not
// place, with a "Write it up later" the server refused because defer was
// outbound-only. A rep was stuck on it for the afternoon.
//
// Now pendingAttempt is outbound-only and the question is asked in the
// strip the moment the answered call ends: "They called you back from
// {number} at {time}", the same six buttons (OutcomeForm), Save posts the
// same `disposition`, "later" posts `defer` — which now takes an inbound
// row — and the call goes to the unlogged list. Asked ONCE: `askedRef` holds
// the attempt ids this dock has already asked about, and a row with an
// outcome or a deferral is not on any list. A call the server could not
// match (no attempt id) has nothing to ask about here; the day-end cron
// writes the line's verdict on whatever it attributed (store.js
// autoLogStale, dispositions.js dayEndOutcome).
//
// ══ 2026-09-18: the Device is the shell's, and so is the live strip ═══════
//
// The Twilio Device used to be built and registered HERE — and a second one
// was built per outbound call in CallPanel. There is one now, in
// CallSession.js (mounted once in SalesShell), registered there, its token
// refreshed there; this dock subscribes to its `incoming` event through
// session.onIncoming() and draws the ring. Everything about the ring —
// the alert dialog, Pick up, Decline, the caller lookup, the answered
// attempt, the write-up when it ends — is still this file's.
//
// What LEFT this file is the drawing of the live call. Its controls (the
// clock, Hang up, Transfer, the links, and now Mute, Text them and Email)
// are LiveCallStrip's, which draws an inbound and an outbound call as one
// shape — into the Dialer card's slot on the queue, as a fixed strip on
// every other page. The dock reports the answered call into the session
// (setInbound) with the facts the strip needs; the Call object stays here
// so `disconnect` is still handled once, from one place.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, PhoneOff, AlertTriangle, Headphones, PhoneIncoming, Building2, NotebookPen, UserPlus } from "lucide-react";

import AlertDialog from "@/app/components/AlertDialog";
import { fetchJson } from "@/lib/fetchJson";
import { notify } from "@/lib/notify/browser";
import { useTranslation } from "@/app/hooks/useTranslation";
import { STATE_AFTER_CALL, STATE_ON_CALL } from "@/lib/sales/calls/agentState";
import { foldChoice } from "@/lib/sales/calls/outcomeChoices";
import TextThemButton from "./TextThem";
import OutcomeForm, { EMPTY_DRAFT } from "./OutcomeForm";
import { useRepPresence } from "./RepStatus";
import { useCallSession, TOKEN_ERROR_CODES } from "./CallSession";

// The token-refusal set lives with the Device now (CallSession.js); kept
// exported from here for anything that imported it by this name.
export { TOKEN_ERROR_CODES };

/**
 * Digits → something a person can read. Never throws on a short string.
 *
 * `t` is passed in rather than read from a hook because this runs at module
 * scope, and the only translated thing here is what it says when there are no
 * digits at all.
 */
function pretty(e164, t) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || t("app.salesDial.anUnknownNumber");
}

export default function IncomingCallDock() {
  const { t, language } = useTranslation();
  // For the Device's "incoming" handler, which is bound once: the current
  // t without re-binding the Device every time the language changes.
  const tRef = useRef(t);
  tRef.current = t;
  const [incoming, setIncoming] = useState(null);
  const [live, setLive] = useState(false);
  const [ownError, setOwnError] = useState("");
  // Which logged call this is, once the server has confirmed it. Null until
  // then, and the transfer control renders nothing on a null — a rep must
  // never be shown a Transfer button over a call the server could not
  // identify, because pressing it would refuse.
  const [answered, setAnswered] = useState(null);
  // Who is ringing, from /api/sales/calls/caller — the inbound matcher's own
  // answer. Null until it replies, and the dialog prints the bare number
  // until then rather than a guess.
  const [who, setWho] = useState(null);
  const [answeredAt, setAnsweredAt] = useState(null);
  // One tick a second drives the ring clock, "Ringing for 12s", while the
  // dialog is up. The call's own clock is the strip's.
  const [, setTick] = useState(0);
  // Pick up takes focus the moment the card opens (AlertDialog's
  // initialFocusRef): Enter answers, and a rep who was typing a note is not
  // left with focus on a field behind the scrim.
  const pickUpRef = useRef(null);
  // ── The write-up of the call that just ended ─────────────────────────
  //
  // `writeUp` is the ended call the strip is asking about: the attempt the
  // server matched at pick-up, the number, the business, when it rang.
  // `loggedRef` carries those facts from answer() to the disconnect handler
  // — which is bound at ring time and cannot read state — and `askedRef` is
  // the set of attempt ids already asked, so a reconnecting SDK firing
  // `disconnect` twice, or a second answer() on the same call, never asks
  // twice.
  const [writeUp, setWriteUp] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");
  const loggedRef = useRef(null);
  const askedRef = useRef(new Set());
  // `later` (below) as the once-bound `incoming` handler reads it.
  const laterRef = useRef(null);
  const callRef = useRef(null);
  // ── The shell's Device, and the strip that draws the call ────────────
  //
  // `ready`, the Device's own error and the headset warning are the
  // session's facts; this dock prints them in its quiet-state notice and
  // adds its own (a pick-up that failed). `error` below is the merged line,
  // so the "mounts nothing while idle" rule reads the same as it always did.
  const session = useCallSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const ready = session.ready;
  const audioWarning = session.audioWarning;
  const error = ownError || session.deviceError;
  const setError = setOwnError;
  // ── What the rest of the portal is told ──────────────────────────────
  //
  // The queue's autodialler must never start a call over one that is ringing
  // or up, so the dock reports both into the shared presence context, and
  // posts the ledger's two automatic transitions for an inbound call: on_call
  // when the rep answers, after_call when it ends. Read through a ref for the
  // same reason `t` is — the ring's handlers are bound once and must not
  // close over a stale context object.
  const presence = useRepPresence();
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  // Whether the call the SDK is about to report `disconnect` on was ever
  // answered here. A ref rather than `live` state because the handler is
  // bound at ring time and would read a stale closure; and read in the
  // handler rather than in hangUp(), because the SDK fires `disconnect` for
  // both sides' hang-ups and this must be written once from one place.
  const liveRef = useRef(false);

  // ── The ring, from the shell's Device ────────────────────────────────
  //
  // Subscribed once. The handler reads everything through refs — `t`,
  // presence, `later` — because it is bound at mount and a Call's own
  // `cancel`/`disconnect` handlers are bound at ring time; neither may
  // close over a render. Unsubscribing on unmount stops the ring reaching
  // a dock that is gone; it does NOT touch the Device or a call in
  // progress, which are the session's.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = sessionRef.current.onIncoming((call) => {
      if (cancelled) return;
      const from = call?.parameters?.From || null;
      // A second contractor ringing while the last call's write-up is
      // still open: that write-up is "later" — deferred to the unlogged
      // list, exactly as Esc would — not lost under the new dialog.
      laterRef.current?.();
      setIncoming({
        call,
        from,
        to: call?.parameters?.To || null,
        rangAt: Date.now(),
      });
      setWho(null);
      // Non-blocking, and never trusted for anything but the label: the
      // buttons work whether or not this ever answers.
      // The in-tab half of browser notifications: with the portal in a
      // background tab this is a system notification, so the rep sees
      // the ring without watching the tab (lib/notify/browser.js). With
      // the tab focused the dialog itself IS the notice, so notify() is
      // told to stay quiet rather than draw a toast that says the same
      // thing under it. Sent once with the number, then again with the
      // business name when the lookup answers — the same tag, so the
      // second replaces the first.
      const ringTag = `sales-ring:${from || "withheld"}`;
      notify({ title: tRef.current("app.notify.incomingCall.title"), body: from ? pretty(from, tRef.current) : "", tag: ringTag, url: "/sales/queue", quietWhenFocused: true });
      fetchJson(`/api/sales/calls/caller?from=${encodeURIComponent(from || "")}`)
        .then((body) => {
          if (cancelled) return;
          setWho(body || null);
          if (body?.businessName) {
            notify({ title: tRef.current("app.notify.incomingCall.title"), body: body.businessName, tag: ringTag, url: "/sales/queue", quietWhenFocused: true });
          }
        })
        .catch(() => {
          /* the number alone is still an honest label */
        });
      // Ringing. The autodialler's countdown is cancelled by this — a
      // contractor ringing back outranks the next cold row.
      presenceRef.current.setInboundRinging(true);
      call.on("cancel", () => {
        // They hung up before anybody answered.
        setIncoming(null);
        setLive(false);
        setAnswered(null);
        setAnsweredAt(null);
        callRef.current = null;
        presenceRef.current.setInboundRinging(false);
      });
      call.on("disconnect", () => {
        const wasLive = liveRef.current;
        liveRef.current = false;
        setIncoming(null);
        setLive(false);
        setAnsweredAt(null);
        // Nothing about the last call belongs on the screen of the next
        // one — least of all an attempt id a transfer would act on.
        setAnswered(null);
        callRef.current = null;
        presenceRef.current.setInboundRinging(false);
        presenceRef.current.setInboundLive(false);
        // The call ended: the rep is writing it up, on the ledger, until
        // they press Available. Soft — the row is commentary on a call
        // that has already happened.
        if (wasLive) presenceRef.current.postState({ state: STATE_AFTER_CALL });
        // And the write-up itself, in place, once (see the header).
        const logged = loggedRef.current;
        loggedRef.current = null;
        if (wasLive && logged?.attemptId && !askedRef.current.has(logged.attemptId)) {
          askedRef.current.add(logged.attemptId);
          setDraft(EMPTY_DRAFT);
          setFormError("");
          setWriteUp({ ...logged, endedAt: Date.now() });
        }
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /**
   * Which CallSid the SDK is holding for this incoming call.
   *
   * `call.parameters.CallSid` for an INCOMING call is the leg Twilio placed to
   * `client:sales_rep:<id>` out of `<Dial><Client>` — a call resource of its
   * own, whose parent is the contractor's inbound call. It is NOT the SID on
   * the SalesCallAttempt row, and the server knows that: it looks the leg up
   * with the carrier and matches on the parent. `customParameters` is read
   * first only because a `<Parameter>` would be exact if one is ever added,
   * and reading a Map that is usually empty costs nothing.
   */
  function sidOf(call) {
    const custom = call?.customParameters?.get?.("CallSid");
    const sid = custom || call?.parameters?.CallSid || null;
    return typeof sid === "string" && sid ? sid : null;
  }

  async function answer() {
    const call = incoming?.call;
    if (!call) return;
    try {
      // The click IS the user gesture browsers require before audio plays, so
      // it happens FIRST and nothing is awaited before it. Telling the server
      // who answered matters; making the rep wait on a round trip to hear the
      // contractor does not.
      call.accept();
      callRef.current = call;
      liveRef.current = true;
      setLive(true);
      setAnsweredAt(Date.now());
      setError("");
      presenceRef.current.setInboundRinging(false);
      presenceRef.current.setInboundLive(true);
      // The strip draws it from here on — the effect below keeps the
      // session's copy current as the caller lookup and the matched
      // attempt land.
    } catch (err) {
      setError(err?.message || t("app.salesDial.couldNotPickUp"));
      return;
    }

    const callSid = sidOf(call);
    if (!callSid) {
      // No SID means nothing can be filed and nothing can be transferred. Said
      // where the rep will see it rather than swallowed: the call itself is
      // fine, and what they need to know is that it will not be logged to
      // them.
      setAnswered({ attemptId: null, note: t("app.salesDial.callNotMatched") });
      // Still on a call, for the ledger — just not one it can point at.
      presenceRef.current.postState({ state: STATE_ON_CALL });
      return;
    }

    try {
      const body = await fetchJson("/api/sales/calls/answered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid }),
      });
      setAnswered({
        // Only when the server says both legs are on the row. `transferable`
        // false renders no control at all rather than a button that refuses.
        attemptId: body?.transferable ? body.attemptId || null : null,
        note: body?.transferable ? "" : t("app.salesDial.callLegNotRecorded"),
      });
      // For the write-up when it ends — the matched attempt whether or not
      // it is transferable; an outcome needs a row, not a second leg.
      if (body?.attemptId) {
        loggedRef.current = {
          attemptId: body.attemptId,
          from: incoming?.from || null,
          businessName: who?.businessName || null,
          rangAt: incoming?.rangAt || Date.now(),
        };
      }
      // The automatic transition an answered callback makes. The attempt id
      // is the one the server just matched, so the ledger row points at the
      // call rather than at nothing.
      presenceRef.current.postState({
        state: STATE_ON_CALL,
        callAttemptId: body?.attemptId || null,
      });
    } catch (err) {
      setAnswered({
        attemptId: null,
        note: err?.message || t("app.salesDial.callNotMatched"),
      });
      presenceRef.current.postState({ state: STATE_ON_CALL });
    }
  }

  function decline() {
    const call = incoming?.call;
    if (!call) return;
    try {
      // reject(), not disconnect(): rejecting hands the call back to Twilio so
      // the ring plan's NEXT target gets it. Disconnecting an unanswered call
      // ends it for the contractor.
      call.reject();
    } catch {
      /* already gone */
    }
    setIncoming(null);
    presenceRef.current.setInboundRinging(false);
  }

  function hangUp() {
    // disconnect() fires the call's own `disconnect` handler above, which is
    // where the ledger and the shared flags are updated — once, from one
    // place, whichever side hung up.
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* already gone */
    }
    callRef.current = null;
    setIncoming(null);
    setLive(false);
    setAnsweredAt(null);
    setAnswered(null);
    presenceRef.current.setInboundLive(false);
  }

  // ── What the strip is told ───────────────────────────────────────────
  //
  // The answered call, as LiveCallStrip draws it: the number, the business
  // and links the caller lookup named, the matched attempt (for Transfer)
  // and the server's note when there is none, and this dock's own hangUp
  // so the strip's button clears this state exactly as the one here did.
  // Null the moment the call is not live, so nothing about the last call
  // is on the strip of the next one.
  const { setInbound } = session;
  useEffect(() => {
    if (!live) {
      setInbound(null);
      return;
    }
    setInbound({
      call: callRef.current,
      from: incoming?.from || null,
      answeredAt,
      businessName: who?.businessName || null,
      attemptId: answered?.attemptId || null,
      note: answered?.note || "",
      links: who ? { open: who.open || null, notes: who.notes || null, save: who.save || null } : null,
      text: who?.text || null,
      hangUp,
    });
    // `hangUp` is a plain function of this render; the facts above are
    // what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, incoming?.from, answeredAt, who, answered, setInbound]);

  // ── Saving and deferring the write-up ────────────────────────────────
  //
  // The same two posts CallPanel makes, against the same route, for the
  // same reason it makes them: the fold is pure (outcomeChoices.js) and
  // nothing here names a code. `later` is read through `laterRef` by the
  // Device's `incoming` handler, which is bound once.
  const later = useCallback(async () => {
    const row = writeUp;
    if (!row?.attemptId) return;
    setWriteUp(null);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer", attemptId: row.attemptId }),
      });
      await presenceRef.current.refresh?.();
    } catch {
      // A defer the server refused (already logged, already deferred) leaves
      // the row exactly where it was: on the unlogged list or written up.
      // Nothing to put back on screen.
    }
  }, [writeUp]);
  useEffect(() => {
    laterRef.current = later;
  }, [later]);

  async function saveWriteUp() {
    const row = writeUp;
    if (!row?.attemptId || !draft.choice) return;
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
    setFormError("");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disposition",
          attemptId: row.attemptId,
          disposition: fold.code,
          note: fold.note,
          callbackAt: fold.callbackAt ? fold.callbackAt.toISOString() : null,
        }),
      });
      setWriteUp(null);
      setDraft(EMPTY_DRAFT);
      await presenceRef.current.refresh?.();
    } catch (err) {
      setFormError(err?.message || t("app.salesCall.outcomeSaveFailed"));
    } finally {
      setBusy("");
    }
  }

  // Esc is "later" while the write-up is up — the same rule OutcomeSheet
  // keeps: this never traps the rep.
  useEffect(() => {
    if (!writeUp) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        laterRef.current?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [writeUp]);

  // The ring clock, once a second while the dialog is up. A ring with no
  // clock looks frozen after the first few seconds; the seconds also tell a
  // rep how close the ring plan is to moving on.
  const ringing = Boolean(incoming) && !live;
  useEffect(() => {
    if (!ringing) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [ringing]);

  const fromText = incoming ? pretty(incoming.from, t) : "";
  const business = who?.businessName || null;
  const holderText = who?.holder
    ? who.holder.mine
      ? t("app.salesDial.callerClaimedByYou")
      : t("app.salesDial.callerClaimedBy", { name: who.holder.name || t("app.salesDial.anotherRep") })
    : who?.outcome === "none"
      ? // Looked, and this number belongs to nobody we hold — said in those
        // words, beside the save link. `unknown` (no number to look up)
        // and `ambiguous` stay silent rather than confidently wrong.
        t("app.salesDial.callerNotALead")
      : who && who.outcome
        ? t("app.salesDial.callerUnclaimed")
        : "";

  // The place, from the row the server matched — never inferred from the
  // number's area code.
  const placeText = [who?.city, who?.province].filter(Boolean).join(", ");
  const LINK = "inline-flex items-center gap-1.5 min-h-[44px] px-2 -mx-2 rounded-lg text-sm font-semibold text-brand-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card";

  /**
   * Where the rep may go from here — drawn under the caller line in the
   * dialog; LiveCallStrip draws the same server links once the call is up,
   * so they outlive Pick up.
   * Every href comes from the server (see the header); a caller the server
   * matched to nobody gets the save link, one it matched to somebody else's
   * claim gets nothing here (the holder line says who).
   */
  const callerLinks = who ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-0" data-incoming-links>
      {who.open?.href ? (
        <Link href={who.open.href} className={LINK} data-incoming-open-company={who.open.kind}>
          <Building2 size={15} aria-hidden="true" /> {t("app.salesDial.callerOpenCompany")}
        </Link>
      ) : null}
      {who.notes?.href ? (
        <Link href={who.notes.href} className={LINK} data-incoming-notes>
          <NotebookPen size={15} aria-hidden="true" /> {t("app.salesDial.callerNotes")}
        </Link>
      ) : null}
      {who.save?.href ? (
        <Link href={who.save.href} className={LINK} data-incoming-save-lead>
          <UserPlus size={15} aria-hidden="true" /> {t("app.salesDial.callerSaveAsLead")}
        </Link>
      ) : null}
      {/* "They'd rather text": the thread on the number that is ringing,
          with the blank composer — the same control every Call button has
          (TextThem.js). The ids come from the server's `text`; a number
          another rep holds gets the refusal printed under the link, from
          the server, never a silent press. */}
      {incoming?.from ? (
        <TextThemButton
          e164={incoming.from}
          leadId={who.text?.leadId || null}
          prospectId={who.text?.prospectId || null}
          variant="link"
          label={t("app.salesDial.callerTextThem")}
        />
      ) : null}
    </div>
  ) : null;

  // Nothing to say when nothing is happening. The dialog is not a status
  // light — a permanent "ready to receive calls" badge on every screen is
  // noise, and the errors below are the only quiet state worth interrupting
  // for.
  if (!incoming && !live && !error && !audioWarning && !writeUp) return null;

  let writeUpTime = "";
  if (writeUp) {
    try {
      writeUpTime = new Intl.DateTimeFormat(language || undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(writeUp.rangAt));
    } catch {
      writeUpTime = "";
    }
  }
  const writeUpNumber = writeUp ? pretty(writeUp.from, t) : "";

  return (
    <>
      {/* The answered call is LiveCallStrip's to draw — in the Dialer card
          when the console is open, as a strip everywhere else. */}

      {/* ── The ring: an alert dialog ─────────────────────────────────────
          Centred over a scrim at every width (a full-width card inside the
          wrapper's 16px gutters on a phone), role="alertdialog", labelled
          "Incoming call" and described by the caller line. No onEscape, no
          onScrim: the only ways out are the two buttons and the ring ending.
          z-[80]: above the tour's card (z-[60]), the Off reminder (z-[65])
          and the nav drawer (z-50) — a contractor ringing back outranks a
          walkthrough, a nudge and a menu. */}
      <AlertDialog
        open={ringing}
        role="alertdialog"
        labelledBy="fq-incoming-call-title"
        describedBy="fq-incoming-call-caller"
        initialFocusRef={pickUpRef}
        placement="center"
        zClass="z-[80]"
        wrapperProps={{ "data-incoming-dialog": "open" }}
        cardProps={{ "aria-live": "assertive" }}
      >
        {incoming ? (
          <>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 shrink-0 animate-pulse motion-reduce:animate-none">
                <PhoneIncoming size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="fq-incoming-call-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("app.salesDial.incomingCall")}
                  </h2>
                  <p className="text-xs font-mono tabular-nums text-muted-foreground shrink-0" data-incoming-ring-clock>
                    {t("app.salesDial.ringingFor", { seconds: Math.max(0, Math.floor((Date.now() - (incoming.rangAt || Date.now())) / 1000)) })}
                  </p>
                </div>
                <p id="fq-incoming-call-caller" className="text-lg font-semibold text-foreground break-words">
                  {business ? (
                    <>
                      {/* The dot is glued to the number: at 375 "Bright Current
                          Electrical ·" broke with the dot dangling at the end
                          of the name's line and the number alone on the next. */}
                      {business} <span className="text-muted-foreground font-normal whitespace-nowrap">· {fromText}</span>
                    </>
                  ) : (
                    fromText
                  )}
                </p>
                <p className="text-xs text-muted-foreground break-words" data-incoming-context>
                  {[placeText, holderText, incoming.to ? t("app.salesDial.rangYourNumber", { number: pretty(incoming.to, t) }) : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {callerLinks}
                {audioWarning ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
                    <Headphones size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    {audioWarning}
                  </p>
                ) : null}
                {error ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}
              </div>
            </div>
            {/* Pick up has focus on open (initialFocusRef) and is drawn on
                the right from sm up by row-reverse, where a primary action
                sits; Tab goes Pick up → Decline → the links above → back.
                Both ≥ 44px: a phone in a driveway. */}
            <div className="flex flex-col sm:flex-row-reverse gap-2">
              <button
                ref={pickUpRef}
                type="button"
                onClick={answer}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white min-h-[52px] px-6 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                data-incoming-pick-up
              >
                <Phone size={18} aria-hidden="true" /> {t("app.salesDial.pickUp")}
              </button>
              <button
                type="button"
                onClick={decline}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border min-h-[52px] px-5 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                data-incoming-decline
              >
                <PhoneOff size={18} aria-hidden="true" /> {t("app.salesDial.decline")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("app.salesDial.decliningNotice")}</p>
          </>
        ) : null}
      </AlertDialog>

      {/* ── The write-up of the call that just ended ──────────────────────
          Same place as the live strip, same width, drawn while no call is
          ringing (a new ring defers this one — see `incoming`). Inbound
          wording, by design and by check: "They called you back from …". */}
      {writeUp && !incoming ? (
        <div
          className="fixed inset-x-0 top-0 lg:top-[var(--fq-top-bar,61px)] lg:left-[var(--fq-sales-rail,220px)] z-[70] max-h-[100dvh] lg:max-h-[calc(100dvh-var(--fq-top-bar,61px))] overflow-y-auto"
          data-inbound-write-up={writeUp.attemptId}
          role="dialog"
          aria-modal="false"
          aria-label={t("app.salesCall.whatHappened")}
        >
          <div className="bg-card border-b border-border shadow-lg px-4 sm:px-6 py-4">
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 max-w-3xl">
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">{t("app.salesCall.whatHappened")}</p>
                <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  {writeUp.businessName ? `${writeUp.businessName} · ` : ""}
                  {t("app.salesCall.whatHappenedBodyInbound", { number: writeUpNumber, time: writeUpTime })}
                </p>
              </div>
              <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={saveWriteUp} onLater={later} error={formError} autoFocus />
            </div>
          </div>
        </div>
      ) : null}

      {/* The quiet-state notices: a lost registration, a missing headset.
          Small, at the top, where the live strip would be. */}
      {!incoming && (audioWarning || error) ? (
        <div className="fixed inset-x-0 top-0 lg:top-[var(--fq-top-bar,61px)] lg:left-[var(--fq-sales-rail,220px)] z-[65] px-4 sm:px-6 pt-2 pointer-events-none">
          <div className="pointer-events-auto rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/60 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2 max-w-xl">
            {audioWarning ? (
              <Headphones size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>{audioWarning || error}</span>
          </div>
        </div>
      ) : null}

      <span className="sr-only">
        {ready ? t("app.salesDial.readyToReceiveCalls") : t("app.salesDial.connecting")}
      </span>
    </>
  );
}
