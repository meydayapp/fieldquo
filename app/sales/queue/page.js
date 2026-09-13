// app/sales/queue/page.js
//
// The rep console. One screen: the list stays, the prospect swaps, the call
// controls stay put.
//
// ══ What this was, and why it changed ═════════════════════════════════════
//
// It was one prospect at a time with no list at all, reached by leaving
// whatever screen you were on. The owner opened it and said "I don't even know
// where to go to dial". He was right, and the cause was structural rather than
// cosmetic: /sales, /sales/queue, /sales/leads, /sales/threads, /sales/notes
// and /sales/companies were six full-page navigations, so a closer working a
// list lost their place on every one, and the dial control lived three scrolls
// down inside a card that only existed once something was claimed.
//
// Every dialler has the same shape — ominicontacto's agent console, and the
// list/detail split in next15-echo's conversations screen — because it is the
// shape the job has. So: a persistent left column that is the rep's own
// claimed queue, a right pane that is the prospect they are on, and a call
// region pinned to the top of that pane.
//
// ══ Why one at a time was RIGHT, and what is kept of it ═══════════════════
//
// The original header argued that a list invites scanning and cherry-picking
// while a single card invites reading the thing you are about to say. That
// argument is about the POOL, and it is still enforced where it matters — see
// the next section. The list added here is the rep's OWN claims: prospects
// they already committed to and are already accountable for. There is nothing
// to cherry-pick between rows you have already taken, and losing your place
// between them was costing more than the discipline was buying.
//
// The detail pane is unchanged in every respect that made the old screen good:
// three labelled layers in the same order every time, facts before inferences
// before recommendations, and a refusal rendered rather than a row dropped.
//
// ══ A rep still cannot browse the pool ════════════════════════════════════
//
// Nothing here lists an unclaimed prospect and no request added here could.
// app/api/sales/queue/route.js's GET returns the rep's OWN claims through
// queueWhere(), there is deliberately no endpoint that lists what is free, and
// this console asks for nothing else. The per-trade "free" numbers in the
// picker are COUNTS — a count is not a list, and the only way to get a new
// prospect is still to press the button and let the server pick.
//
// ══ Routing: a search param, not a parallel route ═════════════════════════
//
// The selected prospect lives in the URL as `?prospectId=…` (and the trade as
// `?trade=…`), read with useSearchParams and written with router.replace.
//
// Parallel routes were the obvious alternative and were rejected on the data,
// not on taste: the list and the detail arrive in ONE payload from
// /api/sales/queue — `queue.items` and `current` are computed together against
// one clock and one queueWhere() — so a @list/@detail split would either fetch
// the same route twice or need a second endpoint listing claimed prospects.
// Two clocks and two scopes for one screen is how a list and a detail come to
// disagree about who owns what, and a new endpoint on the surface whose whole
// point is that it exposes as little as possible is a bad trade for a folder
// layout.
//
// What that buys, concretely:
//   * /sales/queue keeps working exactly as it did, with no prospect selected;
//   * a specific prospect is now openable by URL, which it was NOT before —
//     the old screen kept the selection in React state only, so a rep could
//     not send a colleague a link or reopen the one they were on;
//   * back/forward do not fill up with one entry per row click, because the
//     list IS the way back. router.replace, not push, for that reason.
//
// ══ The three layers are three sections, in the same order, every time ════
//
// Facts, then inferences, then recommendations. A rep must be able to tell at a
// glance which is which, because the difference is what they are entitled to
// ASSERT. So:
//
//   - a fact is a plain sentence;
//   - a fact we could not establish says so, in its own tone, and never in the
//     same words as a fact we established to be absent — "no online booking"
//     and "we don't know" are different sentences, and confusing them means
//     telling a contractor they lack a booking page while they are looking at
//     one;
//   - an inference is prefixed "We think" and NEVER appears without its
//     confidence — lib/sales/prospectView.js refuses to render one that has
//     none, and this page prints that refusal;
//   - a recommendation leads with its reason, not with the feature name.
//
// None of those decisions live in this file. They live in
// lib/sales/prospectView.js, which calls the presenters in
// lib/sales/intel/confidence.js, so a fourth screen cannot re-decide them.
//
// ══ Single-trade ══════════════════════════════════════════════════════════
//
// The owner's reasoning: a rep who says the same script forty times gets better
// at it. The trade picker is the spine of the screen and there is no "all
// trades" option to pick by accident.
//
// ══ It follows the rep's own language now, not English ════════════════════
//
// This screen was English-only while the shell around it was translated, on
// the argument that half a translated screen is worse than none. That was the
// right rule read from the wrong side: the shell, the companies list and the
// number picker were already translated, so the half left in English was this
// one. Every sentence a rep can read here is a key under app.salesQueue.*.
//
// What translation is NOT allowed to blur: the three layers keep their
// distinction in every language — an inference still reads as an impression
// and never as a fact — and a refusal that names a jurisdiction is carried
// across in full rather than shortened, because in those sentences the wording
// IS the compliance, not a label on it.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
//
// The two columns are a `lg:` grid only. Below that it is master-then-detail
// on one column: the list is shown when nothing is open, and folds behind one
// button once a prospect is. Not a route change — folding it is a state
// change, so the list is still there, still loaded, still in the same scroll
// position, which is the entire point of the rewrite.
//
// ══ There is no `tel:` string in this file, and that is deliberate ════════
//
// Until 2026-09-03 this page rendered `href={`tel:${current.phoneE164}`}` with
// no check of any kind, so a rep could dial an Oklahoma contractor at three in
// the morning against a statute with a $500 trebled private right of action.
// The href is now built by dialHref() in lib/sales/callingRules.js, which
// cannot return one from a refusal or an unknown. Adding a condition around
// the old link would have been one careless edit from regressing, and a check
// script arguing with JSX about which branch a string sits in has produced a
// false pass in this project before. Taking the string away entirely makes the
// rule executable instead of textual —
// scripts/check-sales-calling-window.mjs calls dialHref with each decision and
// reads the answer, and separately asserts no `tel:` anywhere under app/sales.
//
// ══ The call region scrolls with the page — it was pinned, and pinned hid ══
//
// From 2026-09-04 to 2026-09-11 the dial card was `lg:sticky lg:top-4 z-10`
// so "scrolling down through the research never takes the dial away". The
// owner then opened it on a desktop and reported: "when I scroll down the
// card of the lead sits on top and 'what you learned on the call' / 'your
// notes on the lead' scrolls underneath, blocking and making it hard to
// read." He was describing the mechanism exactly. That card is not a fixed
// height: it holds the call panel, whose nine-stage playbook and the
// disposition form make it taller than the viewport on a call. A sticky
// element taller than the viewport pins at its top edge and never scrolls
// through — so everything after it (the lead editor, the notes, the three
// research layers) scrolled up BEHIND a card that never moved, unreadable
// until the column ended. Capping its height with an inner scrollbar would
// keep the covering; the sections below a sticky element are always under
// it. So the card is in normal flow, and nothing on this screen is ever
// covered. What was lost — the Call button in view while reading the
// research — the day's list on the left keeps: a rep scrolls back up, or
// taps the next row. scripts/check-sales-console.mjs asserts the region is
// NOT sticky, with this paragraph as the reason.
//
// ══ The batch: "Claim the next 25", and the hours it makes ══════════════
//
// The owner, first: "they should not need to get 1 claimed at a time — that
// would mean instead of 100–150 calls per day it might come down to 30". So
// the primary control claims a BATCH in one press rather than a row. The
// batch was a hundred for the day, and the day is why it is not any more.
//
// A rep at 9:20 pm Eastern with a hundred leads claimed that morning had
// nothing to dial: every window in the batch had shut, and no sort could put
// a Pacific lead at the top of a list that held none. A batch composed for
// the morning is dead weight by evening, because the callable continent
// moves west through the shift. The owner's decision, that night: "a batch
// of 25, and if there are fewer than 5 leads left it auto-fetches a new set
// from the current time."
//
// So the claim is now QUEUE_BATCH_MAX (25) leads of the picked trade whose
// calling window is OPEN AT THE CLAIM INSTANT, shutting soonest first — a
// row that opens later is not claimed, however soon; a short batch says how
// many were open and when more open. When the rep's held-and-callable rows
// drop under QUEUE_TOP_UP_BELOW (5) this screen posts the same claim with
// `auto: true`, at most every QUEUE_TOP_UP_MIN_INTERVAL_MS, and the server
// first gives back the rep's untouched rows whose window is shut for the
// rest of the shift (releaseClosedUntouched, reason "closed" — never a row
// with an attempt or a callback) and then claims from what is open at THAT
// moment. The day's ceiling is QUEUE_DAILY_CLAIM_CAP (250) per rep, counted
// from the claim log, and it refuses a top-up the same as a press. Every one
// of those decisions is lib/sales/queueBatch.js's; the button sends only the
// trade, the browser's time zone and the auto flag. "Just one" keeps the
// single-claim path. "Release the rest" still gives back every held row
// with no call attempt, and app/api/cron/sales-queue-release still does
// the same when the rep's day ends — the top-up's release is the third
// path, and the only one that runs without anybody pressing anything.
//
// ══ The list is grouped by when a row can be rung, on the rep's clock ═════
//
// The owner: a rep fetching a hundred leads at eight in the morning Eastern
// should see which are Eastern and which are Pacific, "so that they can
// focus on the ones that can be called". The server groups the held rows
// (lib/sales/queueWindows.js) — Callable now, shuts-soonest first; then one
// group per opening instant, "Opens at 11:00 (Pacific Time)"; then anything
// not callable before the shift ends — and this screen draws a header per
// group with its count, a zone chip on every row, and the opening or closing
// time in the REP's own clock. The times are the server's strings, formatted
// in the rep's zone and language from the same request that sent both;
// nothing here re-derives a window from an IANA id. The autodialler walks
// the same grouped order and waits at a group that is not open yet rather
// than dialling into it (app/components/sales/AutodialControl.js).
//
// ══ There is still no greyed-out Call button — and no blank space either ══
//
// The rule stands: a control that looks broken teaches a rep to press it
// harder, so nothing renders a dead dial. What changed is the other half. The
// space the dial control WOULD occupy is now always occupied, by
// lib/sales/dialSpace.js, which returns a title and a body for every state
// that is not "ready": no prospect open, do-not-contact, no sales number yet,
// refused with the rule and the hour, or not confirmed either way. Absence of
// UI is indistinguishable from absence of feature — that is the complaint this
// rewrite started from, and rendering nothing was the reason for it.
//
// ══ The decision is re-asked on a timer ═══════════════════════════════════
//
// The window closes while the page is open. A decision computed by the server
// at 19:59 and left on screen until midnight is a dial button that looks live
// and is not — the same dead control in the other direction. So the page
// re-evaluates the same pure function every thirty seconds, against the
// SERVER's clock plus elapsed time rather than the rep's own, because a laptop
// an hour fast would otherwise open the window an hour early.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Clock,
  FileText,
  Globe,
  History,
  ListFilter,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  NotebookPen,
  OctagonAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Undo2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import ContactNumbers from "@/app/components/sales/ContactNumbers";
import DialerPad, { typedToE164 } from "@/app/components/sales/DialerPad";
import QueueLeadEditor from "@/app/components/sales/QueueLeadEditor";
import { LAYER_HEADINGS } from "@/lib/sales/prospectView";
import { CALL_ALLOWED, CALL_REFUSED, dialHref, salesCallReadiness } from "@/lib/sales/callingRules";
import { QUEUE_TOP_UP_BELOW, QUEUE_TOP_UP_MIN_INTERVAL_MS } from "@/lib/sales/queueBatch";
import {
  DIAL_DO_NOT_CONTACT,
  DIAL_NO_NUMBER,
  DIAL_READY,
  DIAL_REFUSED,
  dialSpace,
} from "@/lib/sales/dialSpace";
import { displayTitle } from "@/lib/sales/notes/body";
import { dispositionFor } from "@/lib/sales/calls/dispositions";
import RepNoteVisibilityNotice from "@/app/components/sales/RepNoteVisibilityNotice";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";
import DialRegion, { Notice } from "@/app/components/sales/DialRegion";
import AutodialControl, { useAutodial } from "@/app/components/sales/AutodialControl";
import { useSalesSearch } from "@/app/components/sales/SalesSearch";
import { useConsoleSlots } from "@/app/components/sales/consoleSlots";
import { useTranslation } from "@/app/hooks/useTranslation";
import { notify } from "@/lib/notify/browser";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
/** A queue row. Full width, 44px tall, and the whole row is the target. */
const ROW =
  "w-full text-left min-h-[44px] px-3 py-2.5 rounded-lg border flex items-start gap-2";

/**
 * Three tones, because there are three states.
 *
 * `gap` is a finding — we looked and it is not there. `unknown` is not a
 * finding at all. Rendering them in one colour is the single most damaging
 * thing this screen could do, so they differ in colour, in border style and in
 * wording.
 */
const TONE_CLASS = {
  has: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  gap: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  unknown: "bg-muted text-muted-foreground border-border border-dashed",
};

function Pill({ tone = "unknown", children }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}
    >
      {children}
    </span>
  );
}

/**
 * Emphasis inside a translated sentence.
 *
 * The words that carry a distinction are not the same words in every language
 * and are rarely in the same place in the sentence, so the marker travels
 * INSIDE the translated string and is unwrapped here. The obvious alternative —
 * splicing JSX between two half-sentences — hands every translator English word
 * order, which is how "Sent 3 ago" gets shipped.
 */
function emphasise(text, Wrap = "strong", className) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, i) =>
      // The same shape the split captured, not `startsWith`: a bare "**"
      // satisfies both ends of a loose test and would be eaten as an empty
      // emphasis, silently deleting two characters of somebody's sentence.
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <Wrap key={i} className={className}>
          {part.slice(2, -2)}
        </Wrap>
      ) : (
        part
      ),
    );
}

function LayerHeader({ layer }) {
  const { t } = useTranslation();
  const heading = LAYER_HEADINGS[layer];
  // The English is the fallback, never the first choice. These three words are
  // the entire interface for the fact/inference/pitch separation, and a rep
  // reading them in a language they do not speak is a rep who cannot tell an
  // observation from an argument.
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">
        {t(heading.titleKey, heading.title)}
      </h2>
      <p className="text-xs text-muted-foreground">{t(heading.noteKey, heading.note)}</p>
    </div>
  );
}

/**
 * The icon on a queue row, and what it is allowed to mean.
 *
 * It reads `contact` and `claim` — both computed server-side by
 * lib/sales/prospectView.js — and nothing else. In particular it never
 * distinguishes "good prospect" from "bad prospect": there is no such fact on
 * these rows, and an icon implying one would be the ranking the queue
 * deliberately does not have (nothing writes a ProspectScore in this build).
 *
 * `t` is a parameter rather than a hook because this is module scope; the
 * conditions above it are untouched and still read `contact` and `claim` only.
 */
function rowStatus(item, t) {
  if (!item?.contact?.callable) {
    return {
      Icon: item?.contact?.code === "do_not_contact" ? Ban : PhoneOff,
      className: "text-red-700 dark:text-red-300",
      label: item?.contact?.title || t("app.salesQueue.rowCannotBeCalled"),
    };
  }
  if (item?.claim?.state === "mine_worked") {
    return {
      Icon: CircleCheck,
      className: "text-emerald-700 dark:text-emerald-300",
      label: t("app.salesQueue.rowWorked"),
    };
  }
  return {
    Icon: Phone,
    className: "text-muted-foreground",
    label: t("app.salesQueue.rowClaimedNotCalled"),
  };
}

/**
 * The zone the rep's browser is in, as Intl names it — sent with every
 * request so the server counts the day's claims against the rep's own
 * calendar day and knows when that day ends. Read once; a browser does not
 * change zone mid-session, and a laptop that does gets the new one on reload.
 */
function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/**
 * The second and third lines of a day-list row, from what the server sent.
 *
 * Every value here was computed server-side — `researched`, `researching`,
 * `window`, `lastOutcome` — and this only puts words to it. In particular
 * "researching…" is only said when the server saw a pipeline task for the
 * row; the absence of research is "not researched", a different sentence.
 *
 * The window line is on the REP's clock: `opensAtLocal` / `closesAtLocal`
 * were formatted by the queue route in the zone and language this browser
 * sent with the request (lib/sales/queueWindows.js's repClock). Beside the
 * zone chip that makes "PDT · Window opens 11:00" one fact with two clocks
 * on it — the rule was judged where the phone rings, the time is when this
 * rep may press Call. Until 2026-09-11 this line printed the PROSPECT's local
 * time, which is the right clock for the rule and the wrong one for a rep
 * asking "when can I ring these".
 */
function rowMeta(item, t) {
  const place = [item.tradeLabel || null, item.city || null].filter(Boolean).join(" · ");
  const research = item.researched
    ? t("app.salesQueue.rowResearched")
    : item.researching
      ? t("app.salesQueue.rowResearching")
      : t("app.salesQueue.rowNotResearched");
  let window = "";
  const w = item.window || null;
  if (w?.decision === CALL_ALLOWED && w.inWindow === false && w.override) {
    // Callable by the platform console's override, not by the clock — the
    // row says which mode rather than "open", which it is not.
    window = t(w.override === "off" ? "app.salesQueue.rowWindowOverrideOff" : "app.salesQueue.rowWindowOverrideWarn");
  } else if (w?.decision === CALL_ALLOWED && w.closesAtLocal) {
    window = t("app.salesQueue.rowWindowClosesAt", { time: w.closesAtLocal });
  } else if (w?.decision === CALL_ALLOWED) {
    window = t("app.salesQueue.rowWindowOpen");
  } else if (w?.opensAtLocal) {
    window = t("app.salesQueue.rowWindowOpensAt", { time: w.opensAtLocal });
  } else if (w?.decision === CALL_REFUSED) {
    window = t("app.salesQueue.rowWindowRefused");
  } else if (w) {
    window = t("app.salesQueue.rowWindowUnknown");
  }
  const outcome = item.lastOutcome?.disposition
    ? t("app.salesQueue.rowLastOutcome", {
        outcome: t(
          `app.salesCall.disposition.${item.lastOutcome.disposition}.label`,
          dispositionFor(item.lastOutcome.disposition)?.label || item.lastOutcome.disposition,
        ),
      })
    : item.lastOutcome
      ? t("app.salesQueue.rowLastOutcomeUnlogged")
      : "";
  // The retry pool's word on the row — lib/sales/retryRules.js, through the
  // queue route's `retry`. "Retry 2 of 4 — next at 14:30" counts the dial
  // that is COMING (attemptCount + 1); "Exhausted after 4 attempts" counts
  // the ones made. On a held retry the window line is dropped: the server
  // re-keyed the row's "opens at" to the retry instant, and printing that as
  // the window's opening would be a true time with a false reason.
  const retry = retryLine(item.retry, t);
  if (w?.retryHold) window = "";
  return { place, research, window, outcome, retry, zone: w?.zoneShort || null, zoneId: w?.zone || null };
}

/** One sentence for a row's place in the retry pool, or "" when it has none. */
function retryLine(r, t) {
  if (!r) return "";
  if (r.exhausted) return t("app.salesQueue.retry.exhausted", { count: r.attemptCount });
  const n = r.attemptCount + 1;
  const max = r.maxAttempts;
  if (r.scheduled && r.nextAttemptAtLocal) return t("app.salesQueue.retry.next", { n, max, time: r.nextAttemptAtLocal });
  if (r.due) return t("app.salesQueue.retry.due", { n, max });
  return "";
}

/**
 * A window group's header: "Callable now · 42", "Opens at 11:00 (Pacific
 * Time) · 31", "Not callable today · 2". The time and the zone name are the
 * server's strings — rep's clock, rep's language — and the count is the
 * group's own.
 */
function groupTitle(group, t) {
  if (group.kind === "now") return t("app.salesQueue.windowGroup.now");
  if (group.kind === "later") return t("app.salesQueue.windowGroup.later");
  // A group the retry pool made (lib/sales/retryPool.js regroupForRetry):
  // its instant is a retry's, not a window's, and the header says which.
  if (group.retry) return t("app.salesQueue.windowGroup.retryAt", { time: group.opensAtLocal || "" });
  return group.zoneLabel
    ? t("app.salesQueue.windowGroup.opensAt", { time: group.opensAtLocal || "", zone: group.zoneLabel })
    : t("app.salesQueue.windowGroup.opensAtNoZone", { time: group.opensAtLocal || "" });
}

/**
 * The rep's notes about the prospect in the pane, beside the prospect.
 *
 * ══ Why they are here and not at /sales/notes ══════════════════════════════
 *
 * A rep on a call types before they know what they are typing about, and the
 * one thing that stops people taking notes is a second screen. /sales/notes is
 * still the place to read and edit them properly — every note here links
 * straight into it — but starting one has to be where the conversation is.
 *
 * ══ Scoped by the server, not by this component ════════════════════════════
 *
 * The request names a prospectId and the route narrows the rep's OWN notes to
 * it. It cannot widen: noteReaderWhere() is still the boundary and is still
 * built from the gate's fresh session read. A prospectId belonging to somebody
 * else returns nothing, which is the same answer as a prospect with no notes.
 */
function ProspectNotes({ prospectId, businessName }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!prospectId) return;
    setError("");
    setUnavailable("");
    let res;
    try {
      res = await fetch(`/api/sales/notes?prospectId=${encodeURIComponent(prospectId)}`);
    } catch {
      setNotes(null);
      setError(t("app.salesQueue.notesNetworkError"));
      return;
    }
    // Never `if (res.ok)` with no else — AGENTS.md failure class #2. The 503
    // gets its own branch because "the table isn't there" and "something went
    // wrong" need different sentences.
    const payload = await res.json().catch(() => null);
    if (res.status === 503 && payload?.code === "notes_model_missing") {
      setUnavailable(payload.error);
      setNotes(null);
      return;
    }
    if (!res.ok) {
      setNotes(null);
      setError(payload?.error || t("app.salesQueue.notesLoadFailed"));
      return;
    }
    setNotes(Array.isArray(payload?.notes) ? payload.notes : []);
    // `t` is a dependency because the fallback sentences above are built from
    // it; it only changes when the rep changes language, and re-reading the
    // notes at that moment is the correct answer anyway.
  }, [prospectId, t]);

  // The prospect in the pane changed, so the notes must too. Cleared first:
  // leaving the previous prospect's notes on screen under a new name is the
  // most confusing thing this panel could do.
  useEffect(() => {
    setNotes(null);
    setDraft("");
    load();
  }, [load]);

  async function save() {
    const body = draft.trim();
    if (!body || !prospectId) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/sales/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          // parentLabel is frozen at attach time on purpose — see
          // lib/sales/notes/parents.js. A note whose prospect is later tidied
          // out of the pipeline says who it was about instead of becoming a
          // scratchpad.
          parentKind: "prospect",
          parentId: prospectId,
          parentLabel: businessName || "",
        }),
      });
      setDraft("");
      await load();
    } catch (err) {
      setError(err?.message || t("app.salesQueue.noteSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (unavailable) return <RepNoteUnavailable detail={unavailable} />;

  return (
    <div className="space-y-3">
      <RepNoteVisibilityNotice />

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="break-words">{error}</p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-foreground">
          {t("app.salesQueue.notesPrompt")}
        </span>
        <textarea
          className={FIELD}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("app.salesQueue.notesPlaceholder")}
        />
      </label>
      <button
        type="button"
        className={`${BTN} bg-primary text-primary-foreground w-full`}
        disabled={saving || !draft.trim()}
        onClick={save}
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : <NotebookPen size={16} />}
        {t("app.salesQueue.noteSaveAgainst", {
          business: businessName || t("app.salesQueue.noteThisProspect"),
        })}
      </button>

      {notes === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> {t("app.salesQueue.notesLoading")}
        </p>
      ) : null}

      {Array.isArray(notes) && notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("app.salesQueue.notesEmpty")}
        </p>
      ) : null}

      {Array.isArray(notes) && notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/sales/notes/${n.id}`}
                className="block rounded-lg border border-border bg-muted p-3 min-h-[44px]"
              >
                <span className="block text-sm font-medium text-foreground break-words">
                  {displayTitle(n)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("app.salesQueue.noteLastEdited", {
                    stamp: new Date(n.updatedAt).toISOString().slice(0, 16).replace("T", " "),
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const RAIL_KEY = "fq-queue-rail";

/**
 * Which side the phone-style dialler sits. The owner: "can the dialer be on
 * the right side like a normal phone dialer". One word to flip it back:
 * "left" puts the Dialer first and the Contact column last.
 */
const DIALER_SIDE = "left";
const COLUMN_ORDER =
  DIALER_SIDE === "right" ? { dialer: "lg:order-2", panel: "lg:order-1" } : { dialer: "lg:order-1", panel: "lg:order-2" };

/** The bottom panel's tabs, in order. Labels are keys; icons are chrome. */
const PANEL_TABS = [
  { key: "company", labelKey: "app.salesQueue.cardCompany", Icon: Building2 },
  { key: "contact", labelKey: "app.salesQueue.cardContact", Icon: UserRound },
  { key: "script", labelKey: "app.salesQueue.tabScript", Icon: FileText },
  { key: "research", labelKey: "app.salesQueue.tabResearch", Icon: Search },
  { key: "notes", labelKey: "app.salesQueue.tabNotes", Icon: NotebookPen },
  { key: "disposition", labelKey: "app.salesQueue.tabDisposition", Icon: ClipboardCheck },
  { key: "tasks", labelKey: "app.salesQueue.tabTasks", Icon: CalendarClock },
  { key: "leads", labelKey: "app.salesQueue.tabLeads", Icon: ListFilter },
];

/** The chips' order: the trade's four, then the Atlantic pair, then anything else alphabetically. */
const ZONE_CHIP_ORDER = ["ET", "CT", "MT", "PT", "AT", "NT"];

/**
 * The batch result's reason, in the rep's language. The one reason that
 * carries a time — none_open_now — says when the pool's earliest window
 * opens, on the rep's clock with the acronym; without a time it says only
 * that nothing is open.
 */
function batchReasonText(t, result, cap) {
  if (result?.reason === "none_open_now") {
    return result.nextOpensAtLocal
      ? t("app.salesQueue.batchReason.noneOpenNow", { time: result.nextOpensAtLocal, zone: result.nextOpensAtZone || "" })
      : t("app.salesQueue.batchReason.noneOpenNowNoTime");
  }
  if (result?.reason === "partial_open") {
    return result.nextOpensAtLocal
      ? t("app.salesQueue.batchReason.partialOpen", { open: result.openNow ?? result.claimed, time: result.nextOpensAtLocal, zone: result.nextOpensAtZone || "" })
      : t("app.salesQueue.batchReason.partialOpenNoTime", { open: result.openNow ?? result.claimed });
  }
  return t(result.reasonKey, { cap });
}

/**
 * What a top-up says. "Added 25 leads open now (PT)" with the zones of the
 * rows it added, read off the reloaded list; at the cap or with nothing
 * open, the server's reason; released dead rows appended when any were.
 */
function topUpToast(t, body) {
  const result = body?.batch?.result || {};
  const added = Array.isArray(result.claimedIds) ? result.claimedIds : [];
  const byId = new Map((body?.queue?.items || []).map((item) => [item.id, item]));
  const zones = [...new Set(added.map((id) => byId.get(id)?.window?.zoneAcronym).filter(Boolean))];
  let text;
  if (added.length > 0) {
    text = t("app.salesQueue.topUpToast", { count: added.length, zones: zones.join(", ") || "—" });
  } else if (result.reasonKey) {
    text = batchReasonText(t, result, body?.batch?.dailyCap ?? 0);
  } else {
    text = t("app.salesQueue.topUpNothing");
  }
  if (result.releasedClosed > 0) {
    text = `${text} ${t("app.salesQueue.topUpReleased", { count: result.releasedClosed })}`;
  }
  return text;
}

/**
 * The zone chips. Drawn above the list in the rail, the drawer and the
 * Leads tab — one renderer. The selected chip says the zone's next fact:
 * "open until 9:00 PM PT" when any of its rows can be rung now, else
 * "closed — opens 8:00 AM". Both strings are the server's, on the rep's
 * clock.
 */
function ZoneChips({ t, zones, zoneFilter, onZone, total }) {
  if (!zones.length) return null;
  const chip = (key, label, count, active) => (
    <button
      key={key}
      type="button"
      onClick={() => onZone(key)}
      aria-pressed={active}
      data-zone-chip={key || "all"}
      className={`inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] py-2 px-2.5 rounded-full border text-xs font-semibold ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? "opacity-90" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
  const selected = zones.find((z) => z.zone === zoneFilter) || null;
  return (
    <div className="space-y-1.5" data-zone-chips>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("app.salesQueue.zoneChipsAria")}>
        {chip("", t("app.salesQueue.zoneAll"), total, !zoneFilter)}
        {zones.map((z) => chip(z.zone, z.zone, z.count, zoneFilter === z.zone))}
      </div>
      {selected ? (
        <p className="text-xs text-muted-foreground break-words" data-zone-status={selected.openNow > 0 ? "open" : "closed"}>
          {selected.openNow > 0
            ? selected.openUntil?.local
              ? t("app.salesQueue.zoneOpenUntil", { time: selected.openUntil.local, zone: selected.zone })
              : t("app.salesQueue.rowWindowOpen")
            : selected.opensAt?.local
              ? t("app.salesQueue.zoneClosedOpens", { time: selected.opensAt.local })
              : t("app.salesQueue.rowWindowRefused")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Nothing held can be rung at this instant. Said plainly, with one button:
 * claim rows whose window is open now — the same batch claim, same trade,
 * same cap, same language rule, with `onlyCallableNow` narrowing the
 * selection server-side. No count on the button: counting the pool's open
 * rows means the same readiness pass the claim itself makes, so it is not
 * cheap and is not faked.
 */
function NoneOpenNow({ t, total, tradeKey, remainingToday, batchSize, busy, act, batchResult }) {
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2" data-none-open-now>
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 break-words">
        {t("app.salesQueue.allOutsideWindow", { count: total })}
      </p>
      {tradeKey && remainingToday > 0 ? (
        <button
          type="button"
          className={`${BTN} bg-primary text-primary-foreground w-full`}
          disabled={Boolean(busy)}
          onClick={() => act("claim_batch")}
          data-claim-open-now
        >
          {busy === "claim_batch" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          {t("app.salesQueue.claimBatch", { count: batchSize })}
        </button>
      ) : (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
          {remainingToday > 0 ? t("app.salesQueue.claimHint") : t("app.salesQueue.batchReason.dailyCap", { cap: 0 })}
        </p>
      )}
      {batchResult?.reason === "none_open_now" || batchResult?.reason === "partial_open" ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words" data-none-open-now-result>
          {batchReasonText(t, batchResult, 0)}
        </p>
      ) : null}
    </div>
  );
}

/** Two letters for the avatar circle. "Toitures Ouellet" → "TO". */
function initials(name) {
  const words = String(name || "")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  const picked = words.slice(0, 2).map((w) => [...w].find((ch) => /[\p{L}\p{N}]/u.test(ch)) || "");
  return picked.join("").toUpperCase() || "?";
}

/** A date-time in the rep's language, or the raw string when it will not parse. */
function whenText(iso, language, opts = { dateStyle: "medium", timeStyle: "short" }) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat(language || undefined, opts).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * The retry pool's tag on the Dialer card: "Retry 2 of 4 — next at 14:30",
 * "Retry 3 of 4 — due now", "Exhausted after 4 attempts". Same sentences
 * the row prints; nothing for a row the pool has no word on.
 */
function RetryTag({ retry }) {
  const { t } = useTranslation();
  const text = retryLine(retry, t);
  if (!text) return null;
  const tone = retry.exhausted ? TONE_CLASS.gap : retry.due ? TONE_CLASS.has : TONE_CLASS.unknown;
  return (
    <p
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone}`}
      data-retry-tag={retry.exhausted ? "exhausted" : retry.due ? "due" : "scheduled"}
    >
      <RotateCcw size={12} aria-hidden="true" />
      <span className="break-words">{text}</span>
    </p>
  );
}

/**
 * The calling window as one tag on the Dialer card: "Open until 21:00 ·
 * Oklahoma's rule · 1 of 3 / 24 h", or "Opens at 08:00 Tue 8 Sep". Every
 * value is the decision's own — the rep-clock time is the row's server
 * string, the jurisdiction is the rule's, the cap is the rule's. Nothing is
 * derived here from an IANA id.
 */
function WindowTag({ compliance, row }) {
  const { t } = useTranslation();
  if (!compliance) return null;
  const w = row?.window || null;
  const parts = [];
  if (compliance.decision === CALL_ALLOWED && compliance.inWindow === false && compliance.windowOverride) {
    parts.push(
      t(
        compliance.windowOverride.mode === "off"
          ? "app.salesQueue.rowWindowOverrideOff"
          : "app.salesQueue.rowWindowOverrideWarn",
      ),
    );
  } else if (compliance.decision === CALL_ALLOWED) {
    parts.push(w?.closesAtLocal ? t("app.salesQueue.rowWindowClosesAt", { time: w.closesAtLocal }) : t("app.salesQueue.rowWindowOpen"));
  } else if (w?.opensAtLocal) {
    parts.push(t("app.salesQueue.rowWindowOpensAt", { time: w.opensAtLocal }));
  } else if (compliance.opensAtText) {
    parts.push(t("app.salesDial.window.opensAt", { opensAt: compliance.opensAtText }));
  } else if (compliance.decision === CALL_REFUSED) {
    parts.push(t("app.salesQueue.rowWindowRefused"));
  } else {
    parts.push(t("app.salesQueue.rowWindowUnknown"));
  }
  if (compliance.jurisdiction?.name) {
    parts.push(
      t(
        compliance.statutoryWindow ? "app.salesQueue.windowTagStatutory" : "app.salesQueue.windowTagCourtesy",
        { jurisdiction: compliance.jurisdiction.name },
      ),
    );
  }
  const open = compliance.decision === CALL_ALLOWED;
  return (
    <div className="space-y-1">
      <p
        className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
          open ? TONE_CLASS.has : compliance.decision === CALL_REFUSED ? TONE_CLASS.gap : TONE_CLASS.unknown
        }`}
        data-window-tag={open ? "open" : "closed"}
      >
        <Clock size={12} aria-hidden="true" />
        <span className="break-words">{parts.join(" · ")}</span>
      </p>
    </div>
  );
}

/**
 * The 24-hour cap as one line under the Call button: the server's count
 * against the rule's ceiling. Only when both are known — a cap with no
 * count is the caveat DialRegion prints, not a "0 of 3" invented here.
 */
function CapLine({ compliance }) {
  const { t } = useTranslation();
  const cap = Number.isFinite(compliance?.attemptCap) ? compliance.attemptCap : null;
  const used = Number.isFinite(compliance?.attemptsLast24h) ? compliance.attemptsLast24h : null;
  if (cap === null || used === null) return null;
  return (
    <p className="text-xs text-muted-foreground tabular-nums break-words text-center" data-attempt-cap>
      {t("app.salesQueue.windowTagAttempts", { used, cap, jurisdiction: compliance.jurisdiction?.name || "" })}
    </p>
  );
}

/** One coloured tag on the Company card. */
function Tag({ tone = "unknown", children, title }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium ${TONE_CLASS[tone] || TONE_CLASS.unknown}`} title={title}>
      {children}
    </span>
  );
}

/**
 * Card 2: the business. Facts from lib/sales/prospectView.js's rows and the
 * brief's phrased description (lib/sales/intel/brief.js) — a description
 * only when the model wrote one; otherwise the card says there is none and
 * whether research is running. Tags are the row's own flags.
 */
/** A small Dial button beside a number: pastes it into the display and presses Call. */
function DialButton({ t, e164, onDial }) {
  if (!onDial || !e164) return null;
  return (
    <button
      type="button"
      onClick={() => onDial(e164)}
      className="inline-flex items-center gap-1 min-h-[44px] lg:min-h-[36px] py-2 px-2 rounded-md border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
      aria-label={t("app.salesQueue.dialNumberAria", { number: e164 })}
      data-dial-number-button={e164}
    >
      <Phone size={12} aria-hidden="true" /> {t("app.salesQueue.dialButton")}
    </button>
  );
}

function CompanyCard({ t, current, row, compliance, numbers, onDial = null }) {
  const location = current.facts.find((f) => f.key === "location");
  const zone = current.callingContext?.timeZone || null;
  const zones = compliance?.zones || [];
  const zoneText = zone
    ? t("app.salesQueue.zoneStated", { zone })
    : zones.length
      ? t("app.salesQueue.zoneImplied", { zones: zones.join(", ") })
      : t("app.salesQueue.zoneUnknown");
  const phones = (numbers?.voice?.choices || []).map((c) => c.e164).filter(Boolean);
  const description = current.brief?.description || null;
  const dnc = current.contact?.callable === false;
  const score = Number.isFinite(current.score?.value) ? current.score.value : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold" aria-hidden="true">
          {initials(current.businessName)}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground break-words">
            {current.businessNameKey ? t(current.businessNameKey, current.businessName) : current.businessName}
          </p>
          <p className="text-sm text-muted-foreground break-words">
            {[current.tradeLabel, [row?.city, row?.province].filter(Boolean).join(", ")].filter(Boolean).join(" · ") ||
              t("app.salesQueue.noTradeOrTerritory")}
          </p>
          <p className="text-xs text-muted-foreground break-words">{zoneText}</p>
        </div>
      </div>

      {description ? (
        <p className="text-sm text-foreground break-words" data-company-description>{description}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic break-words" data-company-description="none">
          {row?.researching ? t("app.salesQueue.noDescriptionResearching") : t("app.salesQueue.noDescriptionYet")}
        </p>
      )}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground flex items-center gap-1"><MapPin size={13} aria-hidden="true" />{t("app.salesQueue.fieldAddress")}</dt>
        <dd className={`break-words ${location?.known ? "text-foreground" : "text-muted-foreground italic"}`}>
          {location ? (location.textKey ? t(location.textKey, location.text, location.params || {}) : location.text) : t("app.salesIntel.fact.location.missing")}
        </dd>
        <dt className="text-muted-foreground flex items-center gap-1"><Globe size={13} aria-hidden="true" />{t("app.salesQueue.fieldWebsite")}</dt>
        <dd className="break-words">
          {current.websiteUrl ? (
            <a href={current.websiteUrl} target="_blank" rel="noreferrer noopener" className="text-foreground underline break-all">
              {current.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="text-muted-foreground italic">{t("app.salesQueue.fieldNone")}</span>
          )}
        </dd>
        <dt className="text-muted-foreground flex items-center gap-1"><Phone size={13} aria-hidden="true" />{t("app.salesQueue.fieldPhone")}</dt>
        <dd className="break-words tabular-nums">
          {phones.length ? (
            <ul className="space-y-1">
              {phones.map((e164) => (
                <li key={e164} className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground">{e164}</span>
                  <DialButton t={t} e164={e164} onDial={onDial} />
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground italic">{t("app.salesQueue.fieldNone")}</span>
          )}
        </dd>
        <dt className="text-muted-foreground flex items-center gap-1"><Mail size={13} aria-hidden="true" />{t("app.salesQueue.fieldEmail")}</dt>
        <dd className="break-words">
          {current.email ? (
            <>
              <span className="text-foreground break-all">{current.email}</span>
              {current.emailSource ? (
                <span className="block text-xs text-muted-foreground">{t("app.salesQueue.emailSource", { source: current.emailSource })}</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground italic">{t("app.salesQueue.fieldNone")}</span>
          )}
        </dd>
      </dl>

      {/* Tags: each one is a flag the server set on this row. */}
      <div className="flex flex-wrap gap-1.5" data-company-tags>
        {current.tradeLabel ? <Tag tone="unknown">{current.tradeLabel}</Tag> : null}
        <Tag tone={row?.researched ? "has" : "unknown"}>
          {row?.researched ? t("app.salesQueue.rowResearched") : row?.researching ? t("app.salesQueue.rowResearching") : t("app.salesQueue.rowNotResearched")}
        </Tag>
        {row?.language === "fr" ? <Tag tone="unknown" title={t("app.salesQueue.frenchChipTitle")}>{t("app.salesQueue.frenchChip")}</Tag> : null}
        {score !== null ? <Tag tone="has">{t("app.salesQueue.scoreTag", { score })}</Tag> : null}
        {current.existingCustomer ? <Tag tone="has">{t("app.salesQueue.existingCustomerTag")}</Tag> : null}
        {dnc ? <Tag tone="gap">{t("app.salesQueue.doNotContactTag")}</Tag> : null}
      </div>

      {/* Capabilities as chips: has / gap / unknown, the three tones. */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">{t("app.salesQueue.siteCapabilitiesHeading")}</p>
        {current.capabilities.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("app.salesQueue.siteNotCrawled")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {current.capabilities.map((c) => (
              <li key={c.code}>
                <Pill tone={c.tone}>{c.text}</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Card 3: the person. The inferred owner with its confidence and, opened,
 * the sentence it was read from; the numbers, the email, the website.
 */
function ContactCard({ t, current, numbers, onDial = null }) {
  const owner = current.inferences.find((inf) => inf.kind === "owner_name") || null;
  const ownerName = current.brief?.owner?.name || (owner?.renderable ? owner.text : null);
  const quote = current.brief?.owner?.quote || null;
  const phones = numbers?.voice?.choices || [];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-sm font-bold" aria-hidden="true">
          {ownerName ? initials(ownerName) : <UserRound size={18} />}
        </span>
        <div className="min-w-0 space-y-0.5">
          {ownerName ? (
            <>
              <p className="text-base font-semibold text-foreground break-words" data-contact-owner>{ownerName}</p>
              <p className="text-xs text-muted-foreground break-words">
                {owner?.renderable
                  ? t("app.salesQueue.inferenceCaveat", {
                      confidence: t(owner.confidenceTextKey, owner.confidenceText, { percent: owner.confidencePercent }),
                      source: t(owner.sourceTextKey, owner.sourceText),
                    })
                  : t("app.salesQueue.ownerInferred")}
              </p>
              {quote ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer min-h-[44px] flex items-center">{t("app.salesQueue.ownerWhy")}</summary>
                  <p className="italic break-words">“{quote}”</p>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("app.salesQueue.ownerUnknown")}</p>
          )}
        </div>
      </div>

      <ul className="space-y-1 text-sm">
        {phones.map((c) => (
          <li key={c.id || c.e164} className="flex items-center gap-2 text-foreground">
            <Phone size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block tabular-nums break-words">{c.e164}</span>
              {c.label || c.kind ? <span className="block text-xs text-muted-foreground break-words">{[c.label, c.kind].filter(Boolean).join(" · ")}</span> : null}
            </span>
            <DialButton t={t} e164={c.e164} onDial={onDial} />
          </li>
        ))}
        {phones.length === 0 ? (
          <li className="text-muted-foreground italic">{t("app.salesDial.noRingableNumber")}</li>
        ) : null}
        <li className="flex items-center gap-2">
          <Mail size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          {current.email ? <span className="text-foreground break-all">{current.email}</span> : <span className="text-muted-foreground italic">{t("app.salesQueue.fieldNone")}</span>}
        </li>
        <li className="flex items-center gap-2">
          <Globe size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          {current.websiteUrl ? (
            <a href={current.websiteUrl} target="_blank" rel="noreferrer noopener" className="text-foreground underline break-all">
              {current.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="text-muted-foreground italic">{t("app.salesQueue.fieldNone")}</span>
          )}
        </li>
      </ul>
    </div>
  );
}

/** The last five attempts on this business by this rep. */
function CallHistory({ t, current, language }) {
  const rows = Array.isArray(current.history) ? current.history : [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("app.salesQueue.historyEmpty")}</p>;
  }
  return (
    <ul className="space-y-2" data-call-history>
      {rows.map((a) => {
        const inbound = a.direction === "in";
        const missed = inbound && !a.answered;
        const label = a.disposition
          ? t(`app.salesCall.disposition.${a.disposition}.label`, dispositionFor(a.disposition)?.label || a.disposition)
          : t("app.salesQueue.rowLastOutcomeUnlogged");
        const duration = Number.isFinite(a.talkSeconds) && a.talkSeconds > 0
          ? `${Math.floor(a.talkSeconds / 60)}:${String(a.talkSeconds % 60).padStart(2, "0")}`
          : null;
        return (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            {missed ? (
              <PhoneMissed size={15} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
            ) : inbound ? (
              <PhoneIncoming size={15} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            ) : (
              <PhoneOutgoing size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="block text-foreground break-words">
                {missed ? t("app.salesQueue.historyMissed") : inbound ? t("app.salesQueue.historyInbound") : t("app.salesQueue.historyOutbound")}
                {" · "}
                <span className="text-muted-foreground">{whenText(a.dialledAt, language)}</span>
                {duration ? <span className="text-muted-foreground"> · {duration}</span> : null}
              </span>
              <span className="block text-xs text-muted-foreground break-words">{label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Research tab: layer 1 facts (with software), layer 2 inferences,
 * layer 3 recommendations, then what we do not know. Moved from the page's
 * column into a tab; every sentence, every refusal and every key is what
 * it was. The three-layer discipline the header describes lives in
 * lib/sales/prospectView.js and is only printed here.
 */
function ResearchLayers({ t, current }) {
  return (
    <>
      {/* ── Layer 1: facts ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <LayerHeader layer="fact" />
        <ul className="space-y-2">
          {current.facts.map((f) => (
            <li key={f.key} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t(f.labelKey, f.label)}</span>
              <span className={`text-sm break-words ${f.known ? "text-foreground" : "text-muted-foreground italic"}`}>
                {/* A row with no textKey is one whose value is the
                    PROSPECT'S OWN — their phone number, their address,
                    the register's name for them. Those are printed
                    verbatim; translating data is inventing it. */}
                {f.textKey ? t(f.textKey, f.text, f.params || {}) : f.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-2 space-y-2">
          <h3 className="text-sm font-medium text-foreground">{t("app.salesQueue.siteCapabilitiesHeading")}</h3>
          {current.capabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("app.salesQueue.siteNotCrawled")}</p>
          ) : (
            <ul className="space-y-2">
              {current.capabilities.map((c) => (
                <li key={c.code} className="space-y-1">
                  <Pill tone={c.tone}>{c.text}</Pill>
                  {c.detail ? <p className="text-xs text-muted-foreground break-words">{c.detail}</p> : null}
                  {c.known && !c.sayable ? (
                    <p className="text-xs text-muted-foreground">{t("app.salesQueue.notVerifiedImpression")}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 space-y-1">
          <h3 className="text-sm font-medium text-foreground">{t("app.salesQueue.softwareHeading")}</h3>
          <p className="text-sm text-foreground break-words">{current.competitor.text}</p>
        </div>
      </div>

      {/* ── Layer 2: inferences ────────────────────────────────────── */}
      <div className="space-y-3 border-t border-border pt-4">
        <LayerHeader layer="inference" />
        {current.inferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesQueue.noInferences")}</p>
        ) : (
          <ul className="space-y-3">
            {current.inferences.map((inf, i) => (
              <li key={`${inf.kind}-${i}`}>
                {inf.renderable ? (
                  <>
                    {/* "We think" and the confidence travel together in
                        every language: the prefix is what marks this as
                        an impression rather than a finding, and a
                        translation that dropped either would turn the
                        whole layer into an assertion. */}
                    <p className="text-sm text-foreground break-words">
                      {emphasise(
                        t("app.salesQueue.inferenceLine", {
                          text: inf.textKey ? t(inf.textKey, inf.text) : inf.text,
                          kind: inf.kindTextKey ? t(inf.kindTextKey, inf.kindText) : inf.kindText,
                        }),
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {t("app.salesQueue.inferenceCaveat", {
                        confidence: t(inf.confidenceTextKey, inf.confidenceText, { percent: inf.confidencePercent }),
                        source: t(inf.sourceTextKey, inf.sourceText),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                    <ShieldAlert size={14} className="inline mr-1" />
                    {t(inf.refusalKey, inf.refusal)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Layer 3: recommendations ───────────────────────────────── */}
      <div className="space-y-3 border-t border-border pt-4">
        <LayerHeader layer="recommendation" />
        {current.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesQueue.noRecommendations")}</p>
        ) : (
          <ol className="space-y-3">
            {current.opportunities.map((o, i) => (
              <li key={`${o.capabilityCode}-${i}`} className="space-y-1">
                {o.renderable ? (
                  <>
                    <p className="text-sm text-foreground break-words">
                      <strong>{i + 1}. {o.nameKey ? t(o.nameKey, o.name) : o.name}</strong>
                    </p>
                    <p className="text-sm text-foreground break-words">
                      {t("app.salesQueue.recommendationBecause", { reason: o.reason })}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {o.ruleCode
                        ? t("app.salesQueue.recommendationEvidenceWithRule", {
                            confidence: t(o.confidenceTextKey, o.confidenceText, { percent: o.confidencePercent }),
                            observations: t("app.salesQueue.observationCount", { value: o.evidenceIds.length }),
                            rule: o.ruleCode,
                          })
                        : t("app.salesQueue.recommendationEvidence", {
                            confidence: t(o.confidenceTextKey, o.confidenceText, { percent: o.confidencePercent }),
                            observations: t("app.salesQueue.observationCount", { value: o.evidenceIds.length }),
                          })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                    <ShieldAlert size={14} className="inline mr-1" />
                    {t(o.refusalKey, o.refusal)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── What we do not know ────────────────────────────────────── */}
      <div className="space-y-2 border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">
          <CircleHelp size={16} className="inline mr-1" />
          {t("app.salesQueue.unknownsHeading")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("app.salesQueue.unknownsNote")}</p>
        {current.unknowns.length === 0 ? (
          <p className="text-sm text-foreground">{t("app.salesQueue.unknownsNone")}</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {current.unknowns.map((u, i) => (
              <li key={`${u.key || u.text}-${i}`} className="text-sm text-muted-foreground break-words">
                {u.key ? t(u.key, u.text, u.params || {}) : u.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * The claim's own wrap-up, under the disposition: mark worked, release,
 * carry to a lead, do-not-contact. Moved from the page's last card into the
 * Disposition tab; every button posts what it posted.
 */
function WrapUp({ t, current, busy, act, carryToLead, dncOpen, setDncOpen, dncReason, setDncReason }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">{t("app.salesQueue.wrapUpHeading")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={`${BTN} bg-primary text-primary-foreground w-full`}
          disabled={Boolean(busy)}
          onClick={() => act("worked", { prospectId: current.id })}
        >
          {busy === "worked" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
          {t("app.salesQueue.markWorked")}
        </button>
        <button
          type="button"
          className={`${BTN} border border-border text-foreground w-full`}
          disabled={Boolean(busy)}
          onClick={() => act("release", { prospectId: current.id })}
        >
          {busy === "release" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
          {t("app.salesQueue.release")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("app.salesQueue.markWorkedNote")}</p>

      {/* ── Carry it across to a lead ────────────────────────────────
          SalesLead.prospectId has existed since the queue did, and
          nothing wrote it from here: a rep who wanted to EMAIL or TEXT
          somebody they had just researched and phoned had to retype the
          name and the number on the leads screen. Slow, and it silently
          broke the link — two records about one business, neither able
          to see the other. Pressing it twice is the ordinary case, so
          the server hands back the lead that already exists rather than
          making a second one. */}
      <button
        type="button"
        data-tour="sales-queue-work-as-lead"
        className={`${BTN} border border-border text-foreground w-full`}
        disabled={Boolean(busy)}
        onClick={() => carryToLead(current.id)}
      >
        {busy === "lead" ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
        {t("app.salesQueue.carryToLeadButton")}
      </button>
      <p className="text-xs text-muted-foreground">{t("app.salesQueue.carryToLeadNote")}</p>

      {/* ── Stop working this one ────────────────────────────────────
          The distinction below sits OUTSIDE the disclosure, so it is read
          before the press rather than after it. The button says what it
          does — it writes one Prospect row, not the platform list — and
          the sentence stands above both states. */}
      {dncOpen ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="q-dnc">
            {t("app.salesQueue.dncReasonLabel")}
          </label>
          <input
            id="q-dnc"
            className={FIELD}
            value={dncReason}
            onChange={(e) => setDncReason(e.target.value)}
            placeholder={t("app.salesQueue.dncReasonPlaceholder")}
          />
          <button
            type="button"
            className={`${BTN} bg-red-600 text-white w-full`}
            disabled={Boolean(busy) || !dncReason.trim()}
            onClick={() => act("do_not_contact", { prospectId: current.id, reason: dncReason })}
          >
            {busy === "do_not_contact" ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
            {t("app.salesQueue.dncConfirm")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`${BTN} border border-red-300 text-red-700 dark:text-red-300 w-full`}
          disabled={Boolean(busy)}
          onClick={() => setDncOpen(true)}
        >
          <Ban size={16} /> {t("app.salesQueue.dncOpenButton")}
        </button>
      )}
      {/* The scope of this button, in full. It is the sentence that stops
          a rep believing they have honoured "never call me again" when
          they have written one Prospect row, so it is translated whole
          rather than trimmed to fit. */}
      <p className="text-xs text-muted-foreground">
        {emphasise(t("app.salesQueue.dncScopeNote"), "span", "font-medium text-foreground")}
      </p>
    </div>
  );
}

/**
 * The Tasks tab: callbacks this rep promised on this business (from the
 * attempts' callbackAt) and check-in drafts due for its number (from
 * SalesCheckIn, status draft). Both come with the queue payload — one
 * read, no second endpoint. Nothing else is a "task" here, and the tab says
 * so rather than listing the calendar's whole day.
 */
function TasksTab({ t, current, language }) {
  const now = Date.now();
  const callbacks = (Array.isArray(current.history) ? current.history : [])
    .filter((a) => a.callbackAt)
    .sort((a, b) => new Date(a.callbackAt) - new Date(b.callbackAt));
  const checkIns = Array.isArray(current.checkIns) ? current.checkIns : [];
  // Null means the read failed, [] means nothing is open. Different sentences.
  const openTriage = Array.isArray(current.openTriage) ? current.openTriage : null;
  return (
    <div className="space-y-4" data-console-tasks>
      <div className="space-y-2" data-console-triage>
        <h3 className="text-sm font-semibold text-foreground">{t("app.salesQueue.tasksReplies")}</h3>
        {openTriage === null ? (
          <p className="text-sm text-muted-foreground break-words">{t("app.salesQueue.tasksRepliesUnreadable")}</p>
        ) : openTriage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesQueue.tasksNoReplies")}</p>
        ) : (
          <ul className="space-y-1.5">
            {openTriage.map((o) => (
              <li
                key={o.e164 + o.sentAt}
                className={`rounded-lg border p-2.5 text-sm space-y-1 ${o.kind === "roadblock" ? TONE_CLASS.gap : "border-border bg-card text-foreground"}`}
                data-triage={o.kind}
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  {o.kind === "roadblock" ? <OctagonAlert size={13} aria-hidden="true" /> : <CircleHelp size={13} aria-hidden="true" />}
                  {t(o.kind === "roadblock" ? "app.salesText.triage.roadblock" : "app.salesText.triage.question")}
                  {o.sentAt ? <span className="font-normal text-muted-foreground">· {whenText(o.sentAt, language)}</span> : null}
                </p>
                <p className="text-foreground break-words">{o.body}</p>
                {o.reason ? <p className="text-xs text-muted-foreground break-words">{o.reason}</p> : null}
                <Link href={`/sales/messages?thread=${encodeURIComponent(o.e164)}`} className="inline-flex items-center min-h-[44px] text-sm font-medium text-foreground underline">
                  {t("app.salesQueue.tasksAnswerInTexts")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.salesQueue.tasksCallbacks")}</h3>
        {callbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesQueue.tasksNoCallbacks")}</p>
        ) : (
          <ul className="space-y-1.5">
            {callbacks.map((a) => {
              const due = new Date(a.callbackAt).getTime() < now;
              return (
                <li key={a.id} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${due ? TONE_CLASS.gap : "border-border bg-card text-foreground"}`}>
                  <CalendarClock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    {t("app.salesQueue.tasksCallbackAt", { when: whenText(a.callbackAt, language) })}
                    {due ? <span className="block text-xs">{t("app.salesQueue.tasksOverdue")}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.salesQueue.tasksCheckIns")}</h3>
        {checkIns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesQueue.tasksNoCheckIns")}</p>
        ) : (
          <ul className="space-y-1.5">
            {checkIns.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-2.5 text-sm space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {c.scheduledFor
                    ? t("app.salesQueue.tasksCheckInDue", { when: whenText(c.scheduledFor, language) })
                    : t("app.salesQueue.tasksCheckInUnscheduled")}
                </p>
                <p className="text-foreground break-words">{c.draftText}</p>
              </li>
            ))}
          </ul>
        )}
        <Link href="/sales/messages" className="inline-flex items-center min-h-[44px] text-sm font-medium text-foreground underline">
          {t("app.salesQueue.tasksOpenTexts")}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground break-words">{t("app.salesQueue.tasksScopeNote")}</p>
    </div>
  );
}

/**
 * The day, grouped by window. One header per group from the server
 * (queue.windows.groups), with its count; the rows under it in the order
 * the server put them. The running number continues across groups so "42."
 * still means the forty-second row of the day. The zone chip is the
 * PROSPECT's zone as Intl names it in the rep's language; the time beside
 * it is the REP's clock. `visibleIds` is the top bar's search: null means
 * every row, a Set means only those. Drawn by the rail, the drawer and the
 * Leads tab — one renderer, three places.
 */
function QueueList({ t, loading, data, items, groups, itemById, current, visibleIds, query, select, wide = false, zones = [], zoneFilter = "", setZoneFilter, noneOpenNow = false, tradeKey = "", remainingToday = 0, batchSize = 0, busy = "", act, batchResult = null, openHeld = 0, closedHeld = 0, topUpBelow = QUEUE_TOP_UP_BELOW }) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={15} /> {t("app.salesQueue.queueLoading")}
      </p>
    );
  }
  return (
    <div className="space-y-3" data-queue-list={wide ? "wide" : "rail"}>
      {/* ── The four empty states, kept apart ───────────────────────────
          buildQueue() distinguishes no_trade, unknown_pool, pool_empty
          and nothing_claimed, and the difference is the whole value: "you
          have not picked a trade", "we could not count", "the pool is
          dry" and "there are some, go claim one" have four different
          fixes. The sentence comes from the server so a second screen
          cannot re-word it; only the icon is chosen here, and it is
          chosen from the same four codes rather than from a truthiness
          test. */}
      {data?.queue?.empty ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {data.queue.emptyReason === "unknown_pool" ? (
              <CircleHelp size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            ) : data.queue.emptyReason === "nothing_claimed" ? (
              <Plus size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            ) : data.queue.emptyReason === "pool_empty" ? (
              <Ban size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <ListFilter size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <p className="text-sm text-foreground break-words">{data.queue.emptyText}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("app.salesQueue.emptyDisclaimer")}</p>
        </div>
      ) : null}

      {/* The rolling batch's one line: what is open, what is shut, and when
          the next batch comes. Every number is this list's own. */}
      {items.length > 0 ? (
        <p className="text-xs text-muted-foreground break-words" data-open-now-summary>
          {t("app.salesQueue.openNowSummary", { open: openHeld, closed: closedHeld, threshold: topUpBelow })}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ZoneChips t={t} zones={zones} zoneFilter={zoneFilter} onZone={(z) => setZoneFilter?.(z)} total={items.length} />
      ) : null}
      {noneOpenNow ? (
        <NoneOpenNow t={t} total={items.length} tradeKey={tradeKey} remainingToday={remainingToday} batchSize={batchSize} busy={busy} act={act} batchResult={batchResult} />
      ) : null}

      {items.length > 0 && visibleIds && visibleIds.size === 0 ? (
        <p className="text-sm text-muted-foreground break-words">{t("app.salesQueue.searchNoMatch", { query })}</p>
      ) : null}

      {items.length > 0 ? (
        <div className={wide ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
          {(() => {
            let position = 0;
            return groups.map((group) => {
              const shownIds = group.ids.filter((id) => !visibleIds || visibleIds.has(id));
              return (
              <div key={group.key} className={`space-y-2 ${shownIds.length === 0 ? "hidden" : ""}`}>
                {group.kind !== "all" ? (
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground break-words">
                      {groupTitle(group, t)}
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{group.count}</span>
                  </div>
                ) : null}
                {group.kind === "later" ? (
                  <p className="text-xs text-muted-foreground break-words">{t("app.salesQueue.windowGroup.laterNote")}</p>
                ) : null}
                <ul className="space-y-2">
                  {group.ids.map((id) => {
                    const item = itemById.get(id);
                    if (!item) return null;
                    position += 1;
                    if (visibleIds && !visibleIds.has(id)) return null;
                    const status = rowStatus(item, t);
                    const meta = rowMeta(item, t);
                    const active = current?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => select(item.id)}
                          data-queue-row={item.id}
                          className={`${ROW} ${
                            active
                              ? "border-brand-accent bg-muted text-foreground"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          <status.Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${status.className}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium break-words">
                              <span className="text-muted-foreground tabular-nums mr-1">{position}.</span>
                              {item.businessName}
                            </span>
                            {meta.place ? (
                              <span className="block text-xs text-muted-foreground break-words">{meta.place}</span>
                            ) : null}
                            <span className="block text-xs text-muted-foreground break-words">
                              {meta.zone ? (
                                <span
                                  className="inline-block rounded border border-border px-1 py-px mr-1 font-mono text-[11px] leading-4 text-foreground"
                                  title={meta.zoneId || undefined}
                                >
                                  {meta.zone}
                                </span>
                              ) : null}
                              {item.language === "fr" ? (
                                <span
                                  className="inline-block rounded border border-border px-1 py-px mr-1 text-[11px] leading-4 text-foreground"
                                  title={t("app.salesQueue.frenchChipTitle")}
                                >
                                  {t("app.salesQueue.frenchChip")}
                                </span>
                              ) : null}
                              {[meta.research, meta.window].filter(Boolean).join(" · ")}
                            </span>
                            <span className="block text-xs text-muted-foreground break-words">
                              {[meta.outcome || status.label, meta.retry].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            });
          })()}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The rail's whole content: the trade picker and the claim buttons, the
 * grouped list, Release the rest, and the day's count at the foot. Drawn in
 * the rail from lg up and in the drawer below it.
 */
function QueueRail(props) {
  const { t, loading, data, items, untouchedCount, busy, act } = props;
  const worked = items.length - untouchedCount;
  return (
    <div className="space-y-3">
      <ClaimCard {...props} />
      <section className={CARD}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("app.salesQueue.yoursToWork")}</h3>
          {loading ? (
            <Loader2 className="animate-spin text-muted-foreground" size={15} />
          ) : (
            <span className="text-xs text-muted-foreground">{t("app.salesQueue.claimedCount", { value: items.length })}</span>
          )}
        </div>
        <QueueList {...props} />
        {/* ── Give back what was never dialled ──────────────────────────
            Every row with no call attempt since it was claimed. The server
            decides the set at press time (releaseUntouched — the same
            function the day-end cron runs), so a row dialled between the
            render and the press is kept. Not offered when there is nothing
            it would do: a button that releases zero rows is a dead one. */}
        {!loading && untouchedCount > 0 ? (
          <div className="space-y-1 pt-1">
            <button
              type="button"
              className={`${BTN} border border-border text-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => act("release_rest")}
            >
              {busy === "release_rest" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
              {t("app.salesQueue.releaseRest", {
                count: t("app.salesQueue.prospectCount", { value: untouchedCount }),
              })}
            </button>
            <p className="text-xs text-muted-foreground break-words">{t("app.salesQueue.releaseRestNote")}</p>
          </div>
        ) : null}
        {/* The foot: how far through the day the rep is. */}
        {!loading && items.length > 0 ? (
          <div className="pt-2 border-t border-border space-y-1" data-queue-progress>
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesQueue.leadsLeft", { left: untouchedCount, total: items.length })}
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={worked}>
              <div className="h-full bg-primary" style={{ width: `${Math.round((worked / items.length) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </section>
      {data?.batch?.result ? null : null}
    </div>
  );
}

/**
 * The trade picker and the claim buttons — "Claim the next 25", "Just
 * one", the pool's counts and what the last press did. Unchanged from the
 * page's old left column; the rail and the drawer both draw it.
 */
function ClaimCard({ t, data, tradeKey, setQuery, stocked, empties, remainingToday, batchSize, batchResult, busy, act }) {
  return (
    <section className={CARD} data-tour="sales-queue-claim">
      <label className="block text-sm font-medium text-foreground" htmlFor="q-trade">
        {t("app.salesQueue.tradePickerLabel")}
      </label>

      {/* ── What is in the pool, before anybody opens the dropdown ────
          The counts have always been here, one per trade, inside a
          thirty-nine item <select>. That is not the same as being
          visible: the owner opened this screen with 159 prospects
          waiting across 28 trades, saw an empty "Yours to work" and a
          closed dropdown, and asked whether discovery had failed. A
          number nobody scrolls a select to find is a number nobody has.

          Still counts, never a list — nothing here lets a rep read the
          pool and pick the good ones, which is the rule the whole
          claim mechanic exists to enforce. */}
      {stocked.length ? (
        <p className="text-xs text-muted-foreground break-words">
          {emphasise(
            t("app.salesQueue.poolSummary", {
              free: t("app.salesQueue.poolFreeCount", {
                value: stocked.reduce((n, trade) => n + trade.available, 0),
              }),
              trades: t("app.salesQueue.tradeCount", { value: stocked.length }),
              top: stocked
                .slice(0, 3)
                .map((trade) => `${trade.label} (${trade.available})`)
                .join(", "),
            }),
            "span",
            "font-semibold text-foreground",
          )}
        </p>
      ) : null}

      <select
        id="q-trade"
        className={FIELD}
        value={tradeKey}
        onChange={(e) => setQuery({ trade: e.target.value, prospectId: "" })}
      >
        <option value="">{t("app.salesQueue.tradeAll")}</option>
        {/* Trades with something in them first, biggest first, so the
            ones a rep can actually work are not sorted underneath
            eleven empty ones. The empty trades stay on the list rather
            than being filtered out: a rep with claims in a trade whose
            pool has run dry still has to be able to select it. */}
        {stocked.map((trade) => (
          <option key={trade.key} value={trade.key}>
            {t("app.salesQueue.tradeOption", {
              label: trade.label,
              claimed: t("app.salesQueue.claimedCount", { value: trade.claimed }),
              free: t("app.salesQueue.freeCount", { value: trade.available }),
            })}
          </option>
        ))}
        {empties.length ? (
          <optgroup label={t("app.salesQueue.tradeGroupEmpty")}>
            {empties.map((trade) => (
              <option key={trade.key} value={trade.key}>
                {t("app.salesQueue.tradeOption", {
                  label: trade.label,
                  claimed: t("app.salesQueue.claimedCount", { value: trade.claimed }),
                  free: t("app.salesQueue.freeCount", { value: trade.available }),
                })}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      {tradeKey ? (
        <div className="space-y-2">
          {/* ── The day, in one press ──────────────────────────────────
              The number is the SERVER's (batch.max), never typed here,
              so the label and the cap cannot drift apart. At the daily
              ceiling the button is not rendered greyed — it is replaced
              by the sentence saying why, which is the rule this screen
              follows for every control. */}
          {remainingToday > 0 ? (
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => act("claim_batch")}
            >
              {busy === "claim_batch" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              {t("app.salesQueue.claimBatch", { count: batchSize })}
            </button>
          ) : (
            <p className="text-sm text-foreground break-words">
              {t("app.salesQueue.batchReason.dailyCap", { cap: data?.batch?.dailyCap ?? 0 })}
            </p>
          )}
          {remainingToday > 0 ? (
            <button
              type="button"
              className={`${BTN} border border-border text-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => act("claim")}
            >
              {busy === "claim" ? <Loader2 className="animate-spin" size={16} /> : null}
              {t("app.salesQueue.claimJustOne")}
            </button>
          ) : null}
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesQueue.claimBatchNote", {
              remaining: t("app.salesQueue.claimsRemainingCount", { value: remainingToday }),
              cap: data?.batch?.dailyCap ?? 0,
              threshold: Number.isFinite(data?.batch?.topUpBelow) ? data.batch.topUpBelow : QUEUE_TOP_UP_BELOW,
            })}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("app.salesQueue.claimHint")}</p>
      )}

      {/* ── What the last press did ──────────────────────────────────
          Said in numbers rather than "done": how many were claimed, how
          many came with research, how many are waiting on it, and how
          many were left in the pool because their window is shut for
          the rest of the rep's day. Every number is the server's. */}
      {batchResult && typeof batchResult.claimed === "number" ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground space-y-1">
          <p className="break-words">
            {t("app.salesQueue.batchSummary", {
              claimed: t("app.salesQueue.prospectCount", { value: batchResult.claimed }),
              researched: batchResult.researched,
              waiting: batchResult.unresearched,
            })}
          </p>
          {batchResult.skippedForWindow > 0 ? (
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesQueue.batchSkippedForWindow", {
                count: t("app.salesQueue.prospectCount", { value: batchResult.skippedForWindow }),
              })}
            </p>
          ) : null}
          {/* The rows the language rule kept back — the server counted
              them against the same trade's pool, so a rep without
              French reads why a 900-row trade yielded twelve. */}
          {batchResult.skippedForLanguage > 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-200 break-words">
              {t("app.salesQueue.batchSkippedForLanguage", {
                count: batchResult.skippedForLanguage,
              })}
            </p>
          ) : null}
          {batchResult.reasonKey ? (
            <p className="text-xs text-muted-foreground break-words">
              {batchReasonText(t, batchResult, data?.batch?.dailyCap ?? 0)}
            </p>
          ) : null}
        </div>
      ) : null}
      {batchResult && typeof batchResult.released === "number" ? (
        <p className="text-sm text-foreground break-words">
          {t("app.salesQueue.releaseRestDone", {
            released: t("app.salesQueue.prospectCount", { value: batchResult.released }),
            kept: t("app.salesQueue.prospectCount", { value: batchResult.kept }),
          })}
        </p>
      ) : null}
    </section>
  );
}

function QueueConsole() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The whole working state, in the URL. See the routing note in the header.
  const tradeKey = params.get("trade") || "";
  const prospectId = params.get("prospectId") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dncOpen, setDncOpen] = useState(false);
  const [dncReason, setDncReason] = useState("");

  // What the server's clock read, and what ours read at the same moment. The
  // difference is applied to every window re-evaluation below.
  const [clock, setClock] = useState(null);

  const stampClock = useCallback((body) => {
    const serverMs = body?.serverNow ? Date.parse(body.serverNow) : NaN;
    setClock(Number.isFinite(serverMs) ? { serverMs, localMs: Date.now() } : null);
  }, []);

  /**
   * Move the selection, and the trade, in the URL.
   *
   * replace rather than push: the list is how a rep goes back, and one history
   * entry per row click would make the browser's own back button useless for
   * the one thing it is good for here, which is leaving the console.
   */
  const setQuery = useCallback(
    (next) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const search = new URLSearchParams();
      if (tradeKey) search.set("tradeKey", tradeKey);
      if (prospectId) search.set("prospectId", prospectId);
      const zone = browserTimeZone();
      if (zone) search.set("timeZone", zone);
      // The language too: the route formats every "opens at" on the rep's
      // clock in the rep's words, and it cannot read either off the session.
      if (language) search.set("language", language);
      const body = await fetchJson(`/api/sales/queue?${search.toString()}`);
      stampClock(body);
      setData(body);
    } catch (err) {
      setError(err?.message || t("app.salesQueue.queueLoadFailed"));
    } finally {
      // `loading` is the FIRST load only. Every load after it leaves the list
      // on screen — a console whose list blanks each time a row is clicked is
      // the losing-your-place problem this rewrite exists to fix, wearing a
      // spinner.
      setLoading(false);
      setFetching(false);
    }
    // `t` and `language` only change when the rep changes language; reloading
    // the queue at that moment costs one request and keeps the fallback
    // sentence — and every server-formatted time — honest.
  }, [tradeKey, prospectId, stampClock, t, language]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Turn the claimed prospect into a lead the rep can email and text.
   *
   * Sends only the prospectId. Everything else — the name, the number, the
   * country and province — is read from the prospect BY THE SERVER, because a
   * prospectId a client could name alongside its own field values is a client
   * that can file any business into its own pipeline under any name.
   */
  async function carryToLead(prospectId) {
    setBusy("lead");
    setError("");
    try {
      const body = await fetchJson("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      if (body?.lead?.id) router.push(`/sales/leads/${body.lead.id}`);
    } catch (err) {
      setError(err?.message || t("app.salesQueue.carryToLeadFailed"));
    } finally {
      setBusy("");
    }
  }

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    try {
      const body = await fetchJson("/api/sales/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tradeKey, timeZone: browserTimeZone(), language, ...extra }),
      });
      if (body?.claimed === null) {
        // The server has an honest answer for "nothing to give you" and it is
        // not an error. Say it, and leave the queue as it was. By key when
        // the server named one, so the sentence is in the rep's language.
        setError(body.reasonKey ? t(body.reasonKey, body.reasonParams || {}) : body.message);
      } else {
        stampClock(body);
        setData(body);
        // A top-up says what it did in a quiet toast rather than a banner:
        // the rep did not press anything. Every number is the server's.
        // Through notify(), not a toast of this page's own: with the tab in
        // the background it is a system notification instead, and the
        // toast it draws when focused is the shared layer's — the one this
        // page drew itself sat under the tour's launcher pill on a phone.
        if (extra.auto && body?.batch?.result) {
          notify({
            title: t("app.salesQueue.topUpTitle"),
            body: topUpToast(t, body),
            tag: "sales-queue-topup",
            url: "/sales/queue",
            tone: "success",
          });
        }
        // Mirrored into the URL so the new prospect is linkable and survives a
        // reload. When the id is unchanged this is a no-op; when it changes,
        // load() runs again and the two answers are guaranteed to agree,
        // which is worth one request. A top-up keeps the row the rep is on.
        if (!extra.auto) setQuery({ prospectId: body?.current?.id || "" });
      }
    } catch (err) {
      setError(err?.message || t("app.salesQueue.actionFailed"));
    } finally {
      setBusy("");
      setDncOpen(false);
      setDncReason("");
    }
  }

  const current = data?.current || null;
  const tradeLabels = useMemo(
    () => Object.fromEntries((data?.trades || []).map((trade) => [trade.key, trade.label])),
    [data?.trades],
  );
  const items = useMemo(
    () =>
      (data?.queue?.items || []).map((item) => ({
        ...item,
        tradeLabel: item.tradeKey ? tradeLabels[item.tradeKey] || item.tradeKey : null,
      })),
    [data?.queue?.items, tradeLabels],
  );
  // ── The zone chips: All · ET · CT · MT · PT (· AT · NT · the rest) ──────
  //
  // The owner at 9:20 pm Eastern, holding a batch of shut windows: "fix
  // them by time zones with a little tab — ET, PT, the acronyms". Each chip
  // is one acronym the server put on the row (lib/sales/queueWindows.js's
  // zoneAcronym, from Intl) with its count and, for the selected one, the
  // earliest "open until" or "opens at" on the rep's clock. Selecting one
  // filters the list — the grouping stays inside the filter — and the
  // walk: Next, Previous and the autodialler follow the filtered order, so
  // a rep who picked PT is not handed an Eastern row at nine at night.
  const [zoneFilter, setZoneFilter] = useState("");
  const zones = useMemo(() => {
    const byZone = new Map();
    for (const item of items) {
      const z = item.window?.zoneAcronym || null;
      if (!z) continue;
      const entry = byZone.get(z) || { zone: z, count: 0, openUntil: null, opensAt: null, openNow: 0 };
      entry.count += 1;
      if (item.window?.callableNow) {
        entry.openNow += 1;
        // Earliest close among the open rows: the server's string, but the
        // ordering needs an instant, so the ISO rides along.
        if (item.window.closesAtIso && (!entry.openUntil || item.window.closesAtIso < entry.openUntil.iso)) {
          entry.openUntil = { iso: item.window.closesAtIso, local: item.window.closesAtLocal };
        }
      } else if (item.window?.opensAtIso && (!entry.opensAt || item.window.opensAtIso < entry.opensAt.iso)) {
        entry.opensAt = { iso: item.window.opensAtIso, local: item.window.opensAtLocal };
      }
      byZone.set(z, entry);
    }
    const rank = (z) => {
      const i = ZONE_CHIP_ORDER.indexOf(z);
      return i === -1 ? ZONE_CHIP_ORDER.length : i;
    };
    return [...byZone.values()].sort((a, b) => rank(a.zone) - rank(b.zone) || a.zone.localeCompare(b.zone));
  }, [items]);
  // A chip for a zone no held row carries any more is not a filter, it is a
  // way to see nothing; the selection falls back to All.
  useEffect(() => {
    if (zoneFilter && !zones.some((z) => z.zone === zoneFilter)) setZoneFilter("");
  }, [zoneFilter, zones]);
  const walkItems = useMemo(
    () => (zoneFilter ? items.filter((item) => item.window?.zoneAcronym === zoneFilter) : items),
    [items, zoneFilter],
  );
  const index = current ? walkItems.findIndex((i) => i.id === current.id) : -1;
  // Nothing held can be rung at this instant — the state that started this.
  const noneOpenNow = items.length > 0 && !items.some((item) => item.window?.callableNow);

  function select(id) {
    setQuery({ prospectId: id });
  }

  // A counter, not a clock. The real time is read fresh below; this only
  // exists to make the render happen again while the page sits open.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── WHICH number is about to ring ───────────────────────────────────────
  //
  // The rep's pick, held here rather than inside ContactNumbers, because the
  // dial belongs to this screen: the href, the button's label and the id that
  // goes on the wire all have to agree with the radio button, and state split
  // across two components is how they stop agreeing.
  //
  // `""` means "the one the server put at the top", which is what the server
  // will also do with no id — so the default is one decision in one place
  // rather than a copy of it here.
  const [numberId, setNumberId] = useState("");
  const currentNumbers = current?.numbers || null;
  useEffect(() => {
    // Cleared whenever the open prospect changes. Carrying a number id across
    // records would send an id the next prospect does not own — refused by the
    // server, correctly, but as a confusing error rather than a fresh screen.
    setNumberId("");
  }, [current?.id]);

  const chosenNumber =
    (currentNumbers?.voice?.choices || []).find((c) => (c.id || "") === numberId) ||
    (currentNumbers?.voice?.choices || [])[0] ||
    null;

  // ── The number in the field ──────────────────────────────────────────
  //
  // Prefilled with the chosen stored number and editable: "what if they
  // need to type a phone number to reach the owner". `typed` is text; the
  // NUMBER it means is decided on the press, by beforeDial() below — a
  // stored one by its id, anything else saved on this record first and then
  // dialled by the id that came back. The field never dials by itself and
  // there is still no `tel:` in this file.
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");
  useEffect(() => {
    setTyped(chosenNumber?.e164 || "");
    setTypedError("");
    // Re-filled when the chosen stored number changes — a new lead, or a tap
    // on the list under the field.
  }, [chosenNumber?.e164, current?.id]);
  const typedE164 = typedToE164(typed);
  const storedForTyped =
    typedE164 ? (currentNumbers?.voice?.choices || []).find((c) => c.e164 === typedE164) || null : null;
  // The live outbound call, for DTMF. Set by CallPanel through onLiveCall;
  // never used to start or end a call.
  const liveCallRef = useRef(null);
  const [liveCallUp, setLiveCallUp] = useState(false);
  const onLiveCall = useCallback((call) => {
    liveCallRef.current = call || null;
    setLiveCallUp(Boolean(call));
  }, []);
  // A Dial button beside a number on the Company or Contact card: the
  // number goes into the display and the press goes to CallPanel — the
  // same place("browser"), the same beforeDial, the same gate. This is the
  // ordinary path; the keypad is for a number the rep is told.
  const [dialRequest, setDialRequest] = useState(null);
  const dialNumber = useCallback((e164) => {
    setTyped(e164 || "");
    setTypedError("");
    setDialRequest({ token: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  }, []);
  const onDialKey = useCallback((key) => {
    const call = liveCallRef.current;
    // DTMF only while a call is up AND the SDK offers it — feature-detected,
    // so a Call object without sendDigits (a handset dial, an older SDK)
    // falls through to typing rather than throwing on a keypad press.
    if (call && typeof call.sendDigits === "function") {
      call.sendDigits(key);
      return;
    }
    setTyped((v) => (v + key).slice(0, 24));
    setTypedError("");
  }, []);
  /**
   * What the Call button rings. Awaited by CallPanel.place() before its dial
   * POST — see CallPanel's `beforeDial`.
   */
  const beforeDial = useCallback(async () => {
    const e164 = typedToE164(typed);
    if (!e164) {
      const error = t("app.salesQueue.typedNumberInvalid");
      setTypedError(error);
      return { ok: false, error };
    }
    const stored = (currentNumbers?.voice?.choices || []).find((c) => c.e164 === e164);
    if (stored) return { ok: true, phoneE164: e164, contactNumberId: stored.id || null };
    if (!current?.id) return { ok: false, error: t("app.salesQueue.pickOrClaim") };
    // Not one of the record's numbers: saved on THIS record first, through
    // the route "they gave us another number" posts to — same
    // normalisation, same refusals (a suppressed business, a number that
    // will not normalise, a record that is not ours) — and dialled by the
    // id the route hands back. The dial route then re-reads the record's
    // numbers and checks suppression for every one of them, this one
    // included, before anything rings.
    try {
      const body = await fetchJson("/api/sales/calls/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: current.id,
          e164,
          kind: "unknown",
          label: t("app.salesQueue.typedNumberLabel"),
          canCall: true,
        }),
      });
      const saved = (body?.numbers || []).find((n) => typedToE164(n.e164) === e164) || null;
      if (!saved?.id) {
        const error = t("app.salesQueue.typedNumberNotSaved");
        setTypedError(error);
        return { ok: false, error };
      }
      setTypedError("");
      // The list under the field and the Contact card learn the new number.
      load();
      return { ok: true, phoneE164: e164, contactNumberId: saved.id };
    } catch (err) {
      const error = err?.message || t("app.salesQueue.typedNumberNotSaved");
      setTypedError(error);
      return { ok: false, error };
    }
  }, [typed, currentNumbers, current?.id, t, load]);

  const compliance = useMemo(() => {
    if (!current) return null;
    const ctx = current.callingContext;
    // No context means an older response shape; fall back to the server's own
    // answer rather than deciding nothing was said about it.
    if (!ctx) return current.compliance || null;
    const nowMs = clock ? clock.serverMs + (Date.now() - clock.localMs) : Date.now();
    return salesCallReadiness({
      prospect: { country: ctx.country, province: ctx.province },
      timeZone: ctx.timeZone,
      now: new Date(nowMs),
      // The server's count for the number the dial rings — re-passed on
      // every re-ask so the cap stays enforced between reloads rather than
      // falling back to the "count unavailable" caveat every thirty seconds.
      attemptsLast24h: Number.isFinite(ctx.attemptsLast24h) ? ctx.attemptsLast24h : null,
      // The platform console's override, resolved on the server (the
      // registration hold included) and re-passed as-is. This screen holds
      // no override rows and resolves nothing; absent, it is enforce.
      windowPolicy: ctx.windowPolicy || null,
        // The reader's language, for the ONE string this produces that is a
        // formatted instant rather than a sentence — "It opens at 08:00 on Tue
        // 8 Sep". Everything else travels as a catalogue key; a date cannot,
        // so it is formatted through CLDR here where the language is known.
      language,
    });
    // `tick` is here to re-run this every thirty seconds; it is not read.
  }, [current, clock, tick, language]);

  // The chosen number, not the listing's. dialHref is still the only producer
  // of a tel: target and still refuses anything but an `allowed` decision —
  // what changed is WHICH number it is given, and that number came from the
  // server's own list of ones it is willing to ring.
  // The typed number when it normalises, else the chosen stored one — so a
  // half-typed field keeps the Call button (its press will say what is
  // wrong) rather than swapping the region for "no number".
  const href = dialHref(compliance, typedE164 || chosenNumber?.e164 || current?.phoneE164);
  // Everything that goes where the Call button goes, including the sentence
  // that goes there when there is no Call button. dialSpace re-gates the href
  // against the decision, so a bug here cannot manufacture a dial control.
  const space = dialSpace({
    prospect: current,
    compliance,
    href,
    claimedCount: items.length,
  });

  // ── The autodialler ──────────────────────────────────────────────────
  //
  // The day's order, as the dialler reads it: the list this screen already
  // draws, in the order the queue route sorted it (the claim log's
  // `(claimedAt, position)` — see lib/sales/queueBatch.js), with each row
  // marked dialled when a call attempt exists for it. `readiness` is THIS
  // screen's own answer for the open row — dialSpace's state and the live
  // calling-window decision — which is what the dialler is asked with when a
  // countdown reaches zero. The server re-asks all of it on the dial itself.
  //
  // `opensAt` is the row's opening instant for a row that is not callable
  // yet, null for one that is — the dialler waits at the first such row
  // rather than dialling past it (lib/sales/autodial.js). `opensAtLocal` and
  // `zoneLabel` ride along so the wait can be said in the rep's clock.
  const order = useMemo(
    () =>
      walkItems.map((item) => ({
        id: item.id,
        // A row with an outcome is not rung again by the machine — a retry
        // is a decision — and the retry pool is that decision: a DUE retry
        // (lib/sales/retryRules.js said "try again, and the time has come")
        // is undialled to the dialler. A scheduled one is a wall through
        // `opensAt`, keyed by the server to the retry instant.
        dialled: Boolean(item.lastOutcome) && !item.retry?.due,
        name: item.businessName,
        opensAt: item.window?.callableNow ? null : item.window?.opensAtIso || null,
        opensAtLocal: item.window?.opensAtLocal || null,
        zoneLabel: item.window?.zoneLabel || null,
      })),
    [walkItems],
  );
  const groups = useMemo(() => {
    const served = data?.queue?.windows?.groups;
    if (Array.isArray(served) && served.length) return served;
    // An older response with no groups: one group, the list as it came.
    return items.length ? [{ key: "all", kind: "all", count: items.length, ids: items.map((i) => i.id) }] : [];
  }, [data?.queue?.windows?.groups, items]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const clockOffsetMs = clock ? clock.serverMs - clock.localMs : 0;
  const readiness = useMemo(() => {
    if (!current) return null;
    if (space.state === DIAL_READY && compliance?.decision === CALL_ALLOWED) {
      return { decision: "allowed", reason: null };
    }
    return {
      decision: "refused",
      reason: space.state !== DIAL_READY ? space.state : compliance?.decision || "unknown",
    };
    // `space` is rebuilt every render from the same inputs; keying on its
    // state and the decision is what keeps this memo honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, space.state, compliance?.decision]);
  const auto = useAutodial({ order, currentId: current?.id || null, readiness, select, clockOffsetMs });
  useEffect(() => {
    setTab(auto.switchOn ? "disposition" : "script");
  }, [auto.switchOn]);
  const worked = useCallback(() => {
    // The flag first, the reload second: the dialler arms against the
    // reloaded order, never the one that predates the call.
    auto.onWorked();
    load();
  }, [auto.onWorked, load]);

  // ── The pool, split so the screen can lead with what is workable ───────
  //
  // `available` is a COUNT the server computed; this only orders them. A rep
  // still cannot see which businesses are in the pool, which is the rule
  // claiming exists to enforce — see the queue route's header.
  const stocked = useMemo(
    () =>
      (data?.trades || [])
        .filter((trade) => trade.available > 0)
        .sort((a, b) => b.available - a.available),
    [data?.trades],
  );
  const empties = useMemo(
    () => (data?.trades || []).filter((trade) => !(trade.available > 0)),
    [data?.trades],
  );



  // The batch ceilings are the server's. `batchSize` is what the button says
  // it will do: never more than what is left of the day.
  const remainingToday = Number.isFinite(data?.batch?.remainingToday)
    ? data.batch.remainingToday
    : 0;
  const batchSize = Math.min(data?.batch?.max ?? 0, remainingToday);
  const batchResult = data?.batch?.result || null;
  // Rows the rep has not dialled yet — what "Release the rest" would give
  // back. The server decides again at press time; this only sizes the label.
  const untouchedCount = items.filter(
    (item) => !item.lastOutcome && item.claim?.state !== "mine_worked",
  ).length;

  // ── The console's own chrome state ───────────────────────────────────
  //
  // The rail (the day's list beside the cards) folds to a strip and is
  // remembered per browser; below lg it is a drawer instead. The bottom
  // panel's tab and its maximised state are per visit. None of this is in
  // the URL: a link to a lead should open the lead, not somebody else's
  // folded rail.
  const [railOpen, setRailOpen] = useState(false);
  const [queueDrawer, setQueueDrawer] = useState(false);
  // Script first for a rep reading; Disposition first for one on autodial,
  // whose next action after every call is to log it. The switch is the
  // rep's own persisted setting (SalesRep.autodial), so this follows it
  // rather than keeping a second memory of the same choice.
  const [tab, setTab] = useState("script");
  const [maximized, setMaximized] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    // Remembered per browser. First visit: open only where three cards and
    // the list fit side by side (2xl, 1536px); narrower than that the strip
    // and the Leads tab carry the list, and the cards get the width the
    // reference gives them.
    try {
      const stored = window.localStorage.getItem(RAIL_KEY);
      setRailOpen(stored === null ? window.innerWidth >= 1536 : stored !== "0");
    } catch {
      setRailOpen(false);
    }
  }, []);
  function toggleRail() {
    setRailOpen((open) => {
      try {
        window.localStorage.setItem(RAIL_KEY, open ? "0" : "1");
      } catch {
        /* nothing to remember it in */
      }
      return !open;
    });
  }
  // The lead editor folds shut when the lead changes: an open form for the
  // last business under the next one's name is the confusing thing.
  useEffect(() => {
    setEditing(false);
  }, [current?.id]);

  // ── The top bar's search, over the held list ─────────────────────────
  //
  // Registered with the shell for as long as this screen is mounted (the
  // box is drawn only while a screen listens — SalesSearch.js). Filters the
  // rows already in hand by business, city or number; asks the server for
  // nothing, so it can never widen what a rep is allowed to see.
  const query = useSalesSearch({ placeholder: t("app.salesQueue.searchPlaceholder") });
  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !zoneFilter) return null;
    const digits = q.replace(/\D/g, "");
    return new Set(
      items
        .filter((item) => !zoneFilter || item.window?.zoneAcronym === zoneFilter)
        .filter((item) => {
          if (!q) return true;
          const hay = [item.businessName, item.city, item.tradeLabel].filter(Boolean).join(" ").toLowerCase();
          if (hay.includes(q)) return true;
          const phone = String(item.phoneE164 || "").replace(/\D/g, "");
          return digits.length >= 3 && phone.includes(digits);
        })
        .map((item) => item.id),
    );
  }, [items, query, zoneFilter]);

  // ── The slots the bottom panel offers CallPanel ───────────────────────
  //
  // DOM nodes, held in state so a portal can target them the render after
  // they mount. The panels stay mounted behind a hidden attribute when
  // another tab is open, so the disposition form survives a flip to the
  // script and back — a form that reset on a tab change would lose the
  // note a rep was typing.
  const [scriptSlot, setScriptSlot] = useState(null);
  const [dispositionSlot, setDispositionSlot] = useState(null);
  const [nextStepsSlot, setNextStepsSlot] = useState(null);
  const [contactSlot, setContactSlot] = useState(null);
  const slots = useMemo(
    () => ({ script: scriptSlot, disposition: dispositionSlot, nextSteps: nextStepsSlot, contact: contactSlot }),
    [scriptSlot, dispositionSlot, nextStepsSlot, contactSlot],
  );
  // Where an ANSWERED inbound call is drawn — the Dialer card's live-call
  // slot, registered with the shell's IncomingCallDock (consoleSlots.js).
  const consoleSlots = useConsoleSlots();
  const setLiveCallNode = consoleSlots?.setLiveCallNode;
  const liveCallSlotRef = useCallback(
    (node) => {
      setLiveCallNode?.(node || null);
    },
    [setLiveCallNode],
  );
  useEffect(() => () => setLiveCallNode?.(null), [setLiveCallNode]);

  // "Next in queue": the row after this one in the grouped order, with its
  // window on the rep's clock — the reference dialler's "next disposition"
  // slot, answered with the fact that actually matters here.
  const nextItem = index < 0 ? walkItems[0] || null : index < walkItems.length - 1 ? walkItems[index + 1] : null;
  const nextMeta = nextItem ? rowMeta(nextItem, t) : null;

  const currentRow = current ? itemById.get(current.id) || null : null;
  // ── The rolling batch: top up when the open rows run low ──────────────
  //
  // The owner: "a batch of 25, and if there are fewer than 5 leads left it
  // auto-fetches a new set from the current time". `openHeld` is what a rep
  // can ring right now and has not rung: callable at this instant, no
  // outcome logged, not marked worked. Under the server's threshold, the
  // console posts the same claim the button posts with `auto: true`, at
  // most once a minute, and never while a press is in flight. The server
  // decides everything else — what is open, the cap, the language rule —
  // and releases the rep's dead rows first. Autodial keeps walking: the
  // reloaded order is what it arms against (AutodialControl's pendingArm).
  const lastTopUp = useRef(0);
  const topUpBelow = Number.isFinite(data?.batch?.topUpBelow) ? data.batch.topUpBelow : QUEUE_TOP_UP_BELOW;
  const topUpInterval = Number.isFinite(data?.batch?.topUpIntervalMs) ? data.batch.topUpIntervalMs : QUEUE_TOP_UP_MIN_INTERVAL_MS;
  const openHeld = items.filter(
    (item) =>
      item.window?.callableNow && (!item.lastOutcome || item.retry?.due) && item.claim?.state !== "mine_worked",
  ).length;
  const closedHeld = items.filter((item) => !item.window?.callableNow).length;
  useEffect(() => {
    if (loading || fetching || busy || !data || !tradeKey) return;
    if (openHeld >= topUpBelow) return;
    // At the cap the top-up would be refused; say so once rather than ask
    // every minute. The rail's own cap sentence stands.
    if (!(remainingToday > 0)) return;
    const nowMs = Date.now();
    if (nowMs - lastTopUp.current < topUpInterval) return;
    lastTopUp.current = nowMs;
    act("claim_batch", { auto: true });
    // `act` is a plain function of this render; `tick` re-runs the check
    // every thirty seconds so a window closing under the rep is noticed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openHeld, loading, fetching, busy, tradeKey, remainingToday, topUpBelow, topUpInterval, tick, data?.serverNow]);
  const railProps = {
    t,
    loading,
    data,
    items,
    groups,
    itemById,
    current,
    visibleIds,
    query,
    select,
    untouchedCount,
    busy,
    act,
    tradeKey,
    setQuery,
    stocked,
    empties,
    remainingToday,
    batchSize,
    batchResult,
    zones,
    zoneFilter,
    setZoneFilter,
    noneOpenNow,
    openHeld,
    closedHeld,
    topUpBelow,
  };

  return (
    <div className="space-y-4" data-sales-console>
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {/* The top-up's quiet toast is the shared layer's now — see notify()
          in act(). It used to be drawn here, fixed at the same bottom offset
          and z-index as the tour's launcher pill, which covered it. */}

      {/* Below lg: one button opens the day's list as a drawer. From lg up
          the rail beside the cards is the list and this is not drawn. */}
      <div className="lg:hidden flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-foreground">{t("app.salesQueue.pageTitle")}</h1>
        <button
          type="button"
          className={`${BTN} border border-border bg-card text-foreground`}
          onClick={() => setQueueDrawer(true)}
          aria-expanded={queueDrawer}
          data-queue-drawer-open
        >
          <ListFilter size={16} />
          {t("app.salesQueue.showQueue", { count: items.length })}
        </button>
      </div>

      {/* The drawer, below lg. Same rail, same rows, same buttons; a scrim
          and a Close. Not a route: the list is still loaded and still in
          the same scroll position underneath. */}
      {queueDrawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("app.salesQueue.yoursToWork")} data-queue-drawer>
          <button
            type="button"
            className="absolute inset-0 bg-black/40 min-h-[44px]"
            aria-label={t("app.salesQueue.hideQueue")}
            onClick={() => setQueueDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(22rem,90vw)] bg-muted shadow-2xl overflow-y-auto p-3 space-y-3 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">{t("app.salesQueue.yoursToWork")}</h2>
              <button
                type="button"
                className={`${BTN} border border-border bg-card text-foreground`}
                onClick={() => setQueueDrawer(false)}
              >
                <X size={16} /> {t("app.salesQueue.hideQueue")}
              </button>
            </div>
            <QueueRail {...railProps} select={(id) => { select(id); setQueueDrawer(false); }} />
          </div>
        </div>
      ) : null}

      <div className="lg:flex lg:items-start lg:gap-4">
        {/* ── The rail: the day, beside the cards ──────────────────────────
            Sticky under the top bar for the viewport's height and scrolling
            inside itself — the bounded sticky, which covers nothing because
            nothing sits under it in its own column. Folded, it is a strip
            with the count and the button to unfold it; the list is still
            mounted and still where it was. */}
        <aside
          data-queue-rail={railOpen ? "open" : "collapsed"}
          className={`hidden lg:block shrink-0 lg:sticky lg:top-[77px] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto transition-[width] duration-200 motion-reduce:transition-none ${
            railOpen ? "w-[18rem]" : "w-[3.5rem]"
          }`}
        >
          {railOpen ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 className="text-base font-semibold text-foreground">{t("app.salesQueue.yoursToWork")}</h2>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                  onClick={toggleRail}
                  aria-expanded="true"
                  aria-label={t("app.salesQueue.collapseRail")}
                  title={t("app.salesQueue.collapseRail")}
                  data-queue-rail-toggle
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
              <QueueRail {...railProps} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-1.5 flex flex-col items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={toggleRail}
                aria-expanded="false"
                aria-label={t("app.salesQueue.expandRail")}
                title={t("app.salesQueue.expandRail")}
                data-queue-rail-toggle
              >
                <PanelLeftOpen size={18} />
              </button>
              <span className="text-xs font-semibold tabular-nums text-foreground" title={t("app.salesQueue.claimedCount", { value: items.length })}>
                {items.length}
              </span>
              {index >= 0 ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {index + 1}/{items.length}
                </span>
              ) : null}
            </div>
          )}
        </aside>

        {/* ── The cards, and the panel under them ───────────────────────── */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* ── Where you are in the day, and what is next ─────────────
              One slim row above the cards: previous / position / next, and
              the row after this one in the grouped order with its window on
              the rep's clock. */}
          {current ? (
            <div className="flex flex-wrap items-center justify-between gap-2" data-console-nav>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${BTN} border border-border bg-card text-foreground`}
                  disabled={index <= 0}
                  onClick={() => select(walkItems[index - 1].id)}
                >
                  <ChevronLeft size={16} /> {t("app.salesQueue.previous")}
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("app.salesQueue.positionOf", { position: index < 0 ? "—" : index + 1, total: walkItems.length })}
                  {zoneFilter ? ` · ${zoneFilter}` : ""}
                </span>
                {/* Outside the selected zone (index −1), Next goes to the
                    zone's first row rather than sitting disabled. */}
                <button
                  type="button"
                  className={`${BTN} border border-border bg-card text-foreground`}
                  disabled={index < 0 ? walkItems.length === 0 : index >= walkItems.length - 1}
                  onClick={() => select(walkItems[index < 0 ? 0 : index + 1].id)}
                >
                  {t("app.salesQueue.next")} <ChevronRight size={16} />
                </button>
              </div>
              <div className="text-xs text-muted-foreground min-w-0 break-words" data-next-in-queue>
                {t("app.salesQueue.nextInQueue")}{": "}
                {nextItem ? (
                  <button type="button" className="min-h-[44px] font-medium text-foreground underline" onClick={() => select(nextItem.id)}>
                    {nextItem.businessName}
                    {nextMeta?.window ? ` · ${nextMeta.window}` : ""}
                  </button>
                ) : (
                  <span>{t("app.salesQueue.nextInQueueNone")}</span>
                )}
              </div>
            </div>
          ) : null}

          {/* ── Two columns: the phone on one side, one tall tabbed card on
              the other, DIALER_SIDE deciding which. Below lg they stack,
              dialler first. */}
          <div className="lg:flex lg:items-start lg:gap-4 space-y-4 lg:space-y-0">
          {/* The dialler's column. Bounded sticky — max-h and its own
              scrollbar, like the rail — so it stays in reach while the tall
              card scrolls, and never covers anything: nothing sits under it
              in its own column. The section inside is in normal flow. */}
          <div className={`lg:w-[320px] lg:shrink-0 lg:sticky lg:top-[77px] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto ${COLUMN_ORDER.dialer}`} data-dialer-column>
            {/* ── The Dialer: a phone's, and nothing else ──────────────────
                Window line · number display with × · round keypad · the
                green Call · the cap line · Auto-dial. The Call button IS
                DialRegion's — CallPanel, dialHref via dialSpace — and when
                the record cannot be dialled, its refusal stands where the
                button would. NOT sticky: on a call the live block makes it
                taller than a phone's viewport, and a sticky element taller
                than the viewport never scrolls through — see the header's
                "The call region scrolls with the page". */}
            <section className={CARD} data-tour="sales-queue-dial" data-console-card="dialer">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Phone size={16} className="text-brand-accent-text" aria-hidden="true" />
                  {t("app.salesQueue.cardDialer")}
                </h2>
                {fetching && !loading ? (
                  <Loader2 className="animate-spin text-muted-foreground shrink-0" size={16} />
                ) : null}
              </div>

              {/* The calling window, one small line above the display. */}
              {current ? <WindowTag compliance={compliance} row={currentRow} /> : null}
              {current ? <RetryTag retry={current.retry || currentRow?.retry || null} /> : null}

              <DialerPad
                value={typed}
                onChange={(v) => {
                  setTyped(v);
                  setTypedError("");
                }}
                onKey={onDialKey}
                liveCall={liveCallUp}
                disabled={!current || current.contact?.callable === false}
                error={typedError}
                typedNote={
                  current && typedE164 && !storedForTyped
                    ? t("app.salesQueue.typedNumberNote", { business: current.businessName })
                    : ""
                }
              />

              {/* Where an answered inbound call is drawn (consoleSlots.js).
                  Empty until IncomingCallDock portals into it. */}
              <div ref={liveCallSlotRef} data-live-call-slot />

              {/* ── The Call button, or the reason there is not one ────────
                  Never blank. lib/sales/dialSpace.js decides which of the
                  seven states this is and supplies the sentence; DialRegion
                  only picks an icon. CallPanel inside it draws the Call
                  button here and portals its disposition form, next steps,
                  script and the published-email box into the panel's tabs
                  and the Contact card. */}
              <DialRegion
                space={space}
                compliance={compliance}
                target={
                  current
                    ? {
                        prospectId: current.id,
                        phoneE164: typedE164 || chosenNumber?.e164 || current.phoneE164,
                        // An id of a row we stored, never a number. The server
                        // re-reads it against this prospect before anything rings.
                        // For a typed number beforeDial supplies the id.
                        contactNumberId: storedForTyped?.id || chosenNumber?.id || null,
                        businessName: current.businessName,
                      }
                    : null
                }
                onWorked={worked}
                autoDial={auto.token}
                onAutoDialResult={auto.onResult}
                slots={slots}
                compact
                beforeDial={beforeDial}
                onLiveCall={onLiveCall}
                dialRequest={dialRequest}
              />
              {current ? <CapLine compliance={compliance} /> : null}

              {/* ── Auto-dial, one row ───────────────────────────────────
                  The switch, and — only while they have something to say —
                  the five-second countdown on the next row, the wait for a
                  window, the reason it stopped. lib/sales/autodial.js
                  decides; AutodialControl.js keeps the clock; CallPanel
                  dials. */}
              <AutodialControl
                auto={auto}
                claimLabel={tradeKey && remainingToday > 0 ? t("app.salesQueue.claimBatch", { count: batchSize }) : null}
                onClaim={tradeKey && remainingToday > 0 ? () => act("claim_batch") : null}
                busy={Boolean(busy)}
                compact
              />
            </section>

          </div>

          {/* ── The tall card: company · contact · script · research · notes ·
              disposition · tasks · leads. Every panel stays mounted (hidden
              attribute) so the portals have their targets and nothing a rep
              typed is lost on a flip. Maximise takes the viewport. */}
          <section
            // @container: the Script tab's two-column layout keys on THIS
            // card's width (Tailwind container query), not the viewport — with
            // the rail open at 1280 the card is too narrow for a side column
            // and the callouts drop under the steps instead of crushing them.
            className={`${CARD} @container min-w-0 flex-1 ${COLUMN_ORDER.panel} ${maximized ? "fixed inset-0 z-40 rounded-none overflow-y-auto lg:left-[var(--fq-sales-rail,220px)] lg:top-[61px]" : ""}`}
            data-console-panel={maximized ? "maximized" : "docked"}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-0.5 overflow-x-auto -mx-1 px-1" role="tablist" aria-label={t("app.salesQueue.panelTabsAria")}>
                {PANEL_TABS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.key}
                    aria-controls={`console-tab-${entry.key}`}
                    id={`console-tabbtn-${entry.key}`}
                    onClick={() => setTab(entry.key)}
                    data-console-tab={entry.key}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-1.5 2xl:px-3 rounded-lg text-sm font-medium border-b-2 shrink-0 ${
                      tab === entry.key
                        ? "border-brand-accent text-foreground bg-muted"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {/* Icons from 2xl only: below that the eight tabs need the width for their words. */}
                    <entry.Icon size={15} aria-hidden="true" className="hidden 2xl:inline" />
                    {t(entry.labelKey)}
                    {entry.key === "leads" && items.length ? (
                      <span className="hidden 2xl:inline rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{items.length}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hidden lg:inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                onClick={() => setMaximized((m) => !m)}
                aria-pressed={maximized}
                aria-label={maximized ? t("app.salesQueue.restorePanel") : t("app.salesQueue.maximizePanel")}
                title={maximized ? t("app.salesQueue.restorePanel") : t("app.salesQueue.maximizePanel")}
                data-console-maximize
              >
                {maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>

            {/* Company: the business, with Edit and Dial beside each number */}
            <div role="tabpanel" id="console-tab-company" aria-labelledby="console-tabbtn-company" hidden={tab !== "company"} className="space-y-3" data-console-card="company">
              {current ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => setEditing((e) => !e)}
                    aria-expanded={editing}
                    data-company-edit
                  >
                    <Pencil size={14} /> {editing ? t("app.salesQueue.editClose") : t("app.salesQueue.edit")}
                  </button>
                </div>
              ) : null}
              {!loading && !current ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t("app.salesQueue.paneEmptyTitle")}</p>
                  <p className="text-sm text-muted-foreground break-words">{t("app.salesQueue.paneEmptyBody")}</p>
                </div>
              ) : null}
              {!loading && current ? (
                <CompanyCard
                  t={t}
                  current={current}
                  row={currentRow}
                  compliance={compliance}
                  numbers={currentNumbers}
                  onDial={current.contact?.callable === false ? null : dialNumber}
                />
              ) : null}
              {/* ── The record, corrected from the screen the rep is on ─────
                  Writes the rep's own lead through the route that already
                  writes it — never the discovered Prospect, whose phone number
                  is a dedupe key and whose province decides a statute. The
                  component's header argues that split at length. Behind
                  Edit, in this tab, because it is this tab's record. */}
              {!loading && current && editing ? (
                <div className="border-t border-border pt-3">
                  <QueueLeadEditor
                    prospectId={current.id}
                    businessName={current.businessName}
                    lead={current.lead || null}
                    onChanged={load}
                  />
                </div>
              ) : null}
              {current ? (
                <p className="text-xs text-muted-foreground break-words">{current.claim.text}</p>
              ) : null}
            </div>

            {/* Contact: the person, their numbers with Dial, the published
                email, the add-number control, and the call history at the foot */}
            <div role="tabpanel" id="console-tab-contact" aria-labelledby="console-tabbtn-contact" hidden={tab !== "contact"} className="space-y-4" data-console-card="contact">
              {!loading && !current ? (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              ) : null}
              {!loading && current ? (
                <>
                  <ContactCard
                    t={t}
                    current={current}
                    numbers={currentNumbers}
                    onDial={current.contact?.callable === false ? null : dialNumber}
                  />
                  {/* The address their own site publishes, with Copy —
                      CallPanel reads it with the playbook and portals it
                      here (it is contact data, not dial data). */}
                  <div ref={setContactSlot} data-slot="contact" />
                  {/* Numbers the server would not offer, with the reason,
                      and "they gave us another number" — the same
                      component as the lead screen's, without the radios:
                      the dialler's display is the choice now. */}
                  <ContactNumbers
                    prospectId={current.id}
                    numbers={currentNumbers}
                    selectedId={chosenNumber?.id || ""}
                    onSelect={(pick) => setNumberId(pick?.id || "")}
                    onChanged={load}
                    disabled={current.contact?.callable === false}
                    parts={["refused", "add"]}
                  />
                  <div className="border-t border-border pt-4 space-y-3" data-console-card="history">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <History size={15} className="text-brand-accent-text" aria-hidden="true" />
                        {t("app.salesQueue.cardHistory")}
                      </h3>
                      {current.lead?.id ? (
                        <Link href={`/sales/leads/${current.lead.id}`} className="text-sm font-medium text-foreground underline min-h-[44px] inline-flex items-center">
                          {t("app.salesQueue.viewAll")}
                        </Link>
                      ) : null}
                    </div>
                    <CallHistory t={t} current={current} language={language} />
                  </div>
                </>
              ) : null}
            </div>

            {/* Script */}
            <div role="tabpanel" id="console-tab-script" aria-labelledby="console-tabbtn-script" hidden={tab !== "script"} className="space-y-3">
              {/* CallPanel portals the playbook here (layout="console"). */}
              <div ref={setScriptSlot} data-slot="script" />
              {!current && !loading ? (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              ) : null}
            </div>

            {/* Research: the three layers, in the same order every time */}
            <div role="tabpanel" id="console-tab-research" aria-labelledby="console-tabbtn-research" hidden={tab !== "research"} className="space-y-4" data-tour="sales-queue-research">
              {!loading && current ? <ResearchLayers t={t} current={current} /> : null}
              {!current && !loading ? (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              ) : null}
            </div>

            {/* Notes */}
            <div role="tabpanel" id="console-tab-notes" aria-labelledby="console-tabbtn-notes" hidden={tab !== "notes"} className="space-y-3">
              {!loading && current ? (
                <>
                  <h3 className="text-sm font-semibold text-foreground">
                    <NotebookPen size={15} className="inline mr-1" />
                    {t("app.salesQueue.notesHeading", { business: current.businessName })}
                  </h3>
                  <ProspectNotes prospectId={current.id} businessName={current.businessName} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              )}
            </div>

            {/* Disposition: the form CallPanel portals here, then next steps,
                then the claim's own wrap-up (worked / release / lead / DNC) */}
            <div role="tabpanel" id="console-tab-disposition" aria-labelledby="console-tabbtn-disposition" hidden={tab !== "disposition"} className="space-y-4">
              <div ref={setDispositionSlot} data-slot="disposition" />
              <div ref={setNextStepsSlot} data-slot="next-steps" />
              {!loading && current ? (
                <WrapUp
                  t={t}
                  current={current}
                  busy={busy}
                  act={act}
                  carryToLead={carryToLead}
                  dncOpen={dncOpen}
                  setDncOpen={setDncOpen}
                  dncReason={dncReason}
                  setDncReason={setDncReason}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              )}
            </div>

            {/* Tasks: callbacks promised and check-in drafts due */}
            <div role="tabpanel" id="console-tab-tasks" aria-labelledby="console-tabbtn-tasks" hidden={tab !== "tasks"} className="space-y-3">
              {!loading && current ? <TasksTab t={t} current={current} language={language} /> : (
                <p className="text-sm text-muted-foreground">{t("app.salesQueue.pickOrClaim")}</p>
              )}
            </div>

            {/* Leads: the batch, full width, same grouping, click selects */}
            <div role="tabpanel" id="console-tab-leads" aria-labelledby="console-tabbtn-leads" hidden={tab !== "leads"} className="space-y-3">
              <QueueList {...railProps} wide />
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary above it.
 *
 * app/sales/layout.js is force-dynamic, so nothing here prerenders and the
 * boundary is never actually crossed in production — but Next 16 refuses the
 * build without it, and a fallback that says what is happening costs one
 * element.
 */
export default function SalesQueuePage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> {t("app.salesQueue.openingConsole")}
        </div>
      }
    >
      <QueueConsole />
    </Suspense>
  );
}
