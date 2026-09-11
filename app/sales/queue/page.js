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
// ══ The batch: "Claim the next 100", and the day it makes ═══════════════
//
// The owner: "they should not need to get 1 claimed at a time — that would
// mean instead of 100–150 calls per day it might come down to 30". So the
// primary control claims up to QUEUE_BATCH_MAX (100) prospects of the picked
// trade in one press, researched ones first, only rows whose calling window
// opens before the rep's local day ends, capped at QUEUE_DAILY_CLAIM_CAP
// (150) per rep per day counted from the claim log — every one of those
// decisions is lib/sales/queueBatch.js's and the button sends only the trade
// and the browser's time zone. "Just one" keeps the single-claim path for a
// rep who wants one more. The list on the left is the day, in dial order;
// "Next" walks it; "Release the rest" gives back every row with no call
// attempt, and app/api/cron/sales-queue-release does the same when the
// rep's day ends.
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

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock,
  ListFilter,
  Loader2,
  NotebookPen,
  Phone,
  PhoneOff,
  Plus,
  ShieldAlert,
  Undo2,
  UserPlus,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import ContactNumbers from "@/app/components/sales/ContactNumbers";
import QueueLeadEditor from "@/app/components/sales/QueueLeadEditor";
import { LAYER_HEADINGS } from "@/lib/sales/prospectView";
import { CALL_ALLOWED, CALL_REFUSED, dialHref, salesCallReadiness } from "@/lib/sales/callingRules";
import {
  DIAL_DO_NOT_CONTACT,
  DIAL_NO_NUMBER,
  DIAL_READY,
  DIAL_REFUSED,
  dialSpace,
} from "@/lib/sales/dialSpace";
import { displayTitle } from "@/lib/sales/notes/body";
import { dispositionFor } from "@/lib/sales/calls/dispositions";
import { formatTimeOfDay } from "@/lib/format/localeDate";
import RepNoteVisibilityNotice from "@/app/components/sales/RepNoteVisibilityNotice";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";
import DialRegion, { Notice } from "@/app/components/sales/DialRegion";
import { useTranslation } from "@/app/hooks/useTranslation";

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
 * "08:00" in the PROSPECT's zone, in the rep's language. The list says when a
 * row's window opens or shuts where the phone rings, not where the rep sits —
 * the latter is the mistake the calling rules exist to refuse.
 */
function hhmmIn(iso, zone, language) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language || "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      ...(zone ? { timeZone: zone } : {}),
    }).format(d);
  } catch {
    return formatTimeOfDay(d, language);
  }
}

/**
 * The second and third lines of a day-list row, from what the server sent.
 *
 * Every value here was computed server-side — `researched`, `researching`,
 * `window`, `lastOutcome` — and this only puts words to it. In particular
 * "researching…" is only said when the server saw a pipeline task for the
 * row; the absence of research is "not researched", a different sentence.
 */
function rowMeta(item, t, language) {
  const place = [item.tradeLabel || null, item.city || null].filter(Boolean).join(" · ");
  const research = item.researched
    ? t("app.salesQueue.rowResearched")
    : item.researching
      ? t("app.salesQueue.rowResearching")
      : t("app.salesQueue.rowNotResearched");
  let window = "";
  const w = item.window || null;
  if (w?.decision === CALL_ALLOWED && w.closesAt) {
    window = t("app.salesQueue.rowWindowClosesAt", { time: hhmmIn(w.closesAt, w.zone, language) });
  } else if (w?.decision === CALL_ALLOWED) {
    window = t("app.salesQueue.rowWindowOpen");
  } else if (w?.opensAt) {
    window = t("app.salesQueue.rowWindowOpensAt", { time: hhmmIn(w.opensAt, w.zone, language) });
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
  return { place, research, window, outcome };
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
  // Mobile only: the list folds away once a prospect is open, and this reopens
  // it. On lg: both columns are on screen and this is never read.
  const [listOpen, setListOpen] = useState(false);

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
    // `t` only changes when the rep changes language; reloading the queue at
    // that moment costs one request and keeps the fallback sentence honest.
  }, [tradeKey, prospectId, stampClock, t]);

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
        body: JSON.stringify({ action, tradeKey, timeZone: browserTimeZone(), ...extra }),
      });
      if (body?.claimed === null) {
        // The server has an honest answer for "nothing to give you" and it is
        // not an error. Say it, and leave the queue as it was. By key when
        // the server named one, so the sentence is in the rep's language.
        setError(body.reasonKey ? t(body.reasonKey, body.reasonParams || {}) : body.message);
      } else {
        stampClock(body);
        setData(body);
        // Mirrored into the URL so the new prospect is linkable and survives a
        // reload. When the id is unchanged this is a no-op; when it changes,
        // load() runs again and the two answers are guaranteed to agree,
        // which is worth one request.
        setQuery({ prospectId: body?.current?.id || "" });
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
  const index = current ? items.findIndex((i) => i.id === current.id) : -1;

  function select(id) {
    setQuery({ prospectId: id });
    // Fold the list on a phone; on lg: it never folded and this changes
    // nothing anybody can see.
    setListOpen(false);
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
        // The reader's language, for the ONE string this produces that is a
        // formatted instant rather than a sentence — "It opens at 08:00 on Tue
        // 8 Sep". Everything else travels as a catalogue key; a date cannot,
        // so it is formatted through CLDR here where the language is known.
      language,
    });
    // `tick` is here to re-run this every thirty seconds; it is not read.
  }, [current, clock, tick, language]);

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

  // The chosen number, not the listing's. dialHref is still the only producer
  // of a tel: target and still refuses anything but an `allowed` decision —
  // what changed is WHICH number it is given, and that number came from the
  // server's own list of ones it is willing to ring.
  const href = dialHref(compliance, chosenNumber?.e164 || current?.phoneE164);
  // Everything that goes where the Call button goes, including the sentence
  // that goes there when there is no Call button. dialSpace re-gates the href
  // against the decision, so a bug here cannot manufacture a dial control.
  const space = dialSpace({
    prospect: current,
    compliance,
    href,
    claimedCount: items.length,
  });

  const showList = !current || listOpen;

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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesQueue.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.salesQueue.pageIntro")}</p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Two columns from lg: up. One below it, master then detail. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        {/* ── The list. It does not unmount, and it does not blank ────────── */}
        <aside
          className={`${showList ? "block" : "hidden"} lg:block space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto`}
        >
          {/* data-tour: where the portal tour's queue step points. The four
              values on this screen are named in app/sales/tourSteps.js and
              asserted present by scripts/check-sales-mobile.mjs. */}
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
                {batchResult.reasonKey ? (
                  <p className="text-xs text-muted-foreground break-words">
                    {t(batchResult.reasonKey, { cap: data?.batch?.dailyCap ?? 0 })}
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

          <section className={CARD}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("app.salesQueue.yoursToWork")}
              </h2>
              {loading ? (
                <Loader2 className="animate-spin text-muted-foreground" size={15} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("app.salesQueue.claimedCount", { value: items.length })}
                </span>
              )}
            </div>

            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={15} /> {t("app.salesQueue.queueLoading")}
              </p>
            ) : null}

            {/* ── The four empty states, kept apart ───────────────────────────
                buildQueue() distinguishes no_trade, unknown_pool, pool_empty
                and nothing_claimed, and the difference is the whole value: "you
                have not picked a trade", "we could not count", "the pool is
                dry" and "there are some, go claim one" have four different
                fixes. The sentence comes from the server so a second screen
                cannot re-word it; only the icon is chosen here, and it is
                chosen from the same four codes rather than from a truthiness
                test. */}
            {!loading && data?.queue?.empty ? (
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
                <p className="text-xs text-muted-foreground">
                  {t("app.salesQueue.emptyDisclaimer")}
                </p>
              </div>
            ) : null}

            {items.length > 0 ? (
              <ul className="space-y-2">
                {items.map((item, position) => {
                  const status = rowStatus(item, t);
                  const meta = rowMeta(item, t, language);
                  const active = current?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => select(item.id)}
                        className={`${ROW} ${
                          active
                            ? "border-brand-accent bg-muted text-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        <status.Icon
                          size={16}
                          aria-hidden="true"
                          className={`mt-0.5 shrink-0 ${status.className}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium break-words">
                            <span className="text-muted-foreground tabular-nums mr-1">{position + 1}.</span>
                            {item.businessName}
                          </span>
                          {meta.place ? (
                            <span className="block text-xs text-muted-foreground break-words">
                              {meta.place}
                            </span>
                          ) : null}
                          <span className="block text-xs text-muted-foreground break-words">
                            {[meta.research, meta.window].filter(Boolean).join(" · ")}
                          </span>
                          <span className="block text-xs text-muted-foreground break-words">
                            {meta.outcome || status.label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

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
                <p className="text-xs text-muted-foreground break-words">
                  {t("app.salesQueue.releaseRestNote")}
                </p>
              </div>
            ) : null}
          </section>
        </aside>

        {/* ── The pane. Everything about the one they are on ──────────────── */}
        <div className="space-y-4 min-w-0">
          {/* ── The call region, first — and in normal flow ───────────────
              First in the pane at every width. NOT sticky: this card holds
              the call panel, whose playbook and disposition form make it
              taller than the viewport on a call, and a sticky element taller
              than the viewport never scrolls through — the lead editor and
              the notes below it scrolled up behind it, unreadable. The
              header's "The call region scrolls with the page" section is the
              full account. */}
          <section className={CARD} data-tour="sales-queue-dial">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground break-words">
                  {current ? current.businessName : t("app.salesQueue.nobodyOpen")}
                </h2>
                <p className="text-sm text-muted-foreground break-words">
                  {current
                    ? [current.tradeLabel, current.territory?.name].filter(Boolean).join(" · ") ||
                      t("app.salesQueue.noTradeOrTerritory")
                    : t("app.salesQueue.pickOrClaim")}
                </p>
              </div>
              {fetching && !loading ? (
                <Loader2 className="animate-spin text-muted-foreground shrink-0" size={16} />
              ) : null}
            </div>

            {/* Back to the list, on a phone. Hidden from lg: up, where the list
                is already on screen and a button to show it would do nothing. */}
            {current ? (
              <button
                type="button"
                className={`${BTN} border border-border text-foreground w-full lg:hidden`}
                onClick={() => setListOpen((open) => !open)}
              >
                <ListFilter size={16} />
                {listOpen
                  ? t("app.salesQueue.hideQueue")
                  : t("app.salesQueue.showQueue", { count: items.length })}
              </button>
            ) : null}

            {/* ── The dial, or the reason there is not one ──────────────────
                Never blank. lib/sales/dialSpace.js decides which of the seven
                states this is and supplies the sentence; DialRegion only picks
                an icon. It lives in app/components/sales because the lead
                screen renders the identical region — see its header for why a
                second copy was refused. */}
            <DialRegion
              space={space}
              compliance={compliance}
              target={
                current
                  ? {
                      prospectId: current.id,
                      phoneE164: chosenNumber?.e164 || current.phoneE164,
                      // An id of a row we stored, never a number. The server
                      // re-reads it against this prospect before anything rings.
                      contactNumberId: chosenNumber?.id || null,
                      businessName: current.businessName,
                    }
                  : null
              }
              onWorked={load}
            />

            {/* ── The other numbers, and the one somebody just read out ─────
                Under the dial rather than beside it: a rep reaches for the
                Call button first, and the picker is what they touch when the
                answer was "call him on his cell instead". */}
            {current ? (
              <ContactNumbers
                prospectId={current.id}
                numbers={currentNumbers}
                selectedId={chosenNumber?.id || ""}
                onSelect={(pick) => setNumberId(pick?.id || "")}
                onChanged={load}
                disabled={current.contact?.callable === false}
              />
            ) : null}

            {current ? (
              <p className="text-xs text-muted-foreground break-words">{current.claim.text}</p>
            ) : null}

            {items.length > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground flex-1`}
                  disabled={index <= 0}
                  onClick={() => select(items[index - 1].id)}
                >
                  <ChevronLeft size={16} /> {t("app.salesQueue.previous")}
                </button>
                <span className="text-xs text-muted-foreground">
                  {t("app.salesQueue.positionOf", { position: index + 1, total: items.length })}
                </span>
                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground flex-1`}
                  disabled={index < 0 || index >= items.length - 1}
                  onClick={() => select(items[index + 1].id)}
                >
                  {t("app.salesQueue.next")} <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </section>

          {/* Nothing selected. The pane says what would fill it rather than
              standing empty — the same rule the dial region follows, for the
              same reason. */}
          {!loading && !current ? (
            <section className={CARD}>
              <h2 className="text-base font-semibold text-foreground">
                {t("app.salesQueue.paneEmptyTitle")}
              </h2>
              <p className="text-sm text-muted-foreground break-words">
                {t("app.salesQueue.paneEmptyBody")}
              </p>
            </section>
          ) : null}

          {!loading && current ? (
            <>
              {/* ── The record, corrected from the screen the rep is on ─────
                  Writes the rep's own lead through the route that already
                  writes it — never the discovered Prospect, whose phone number
                  is a dedupe key and whose province decides a statute. The
                  component's header argues that split at length. */}
              <section className={CARD}>
                <QueueLeadEditor
                  prospectId={current.id}
                  businessName={current.businessName}
                  lead={current.lead || null}
                  onChanged={load}
                />
              </section>

              {/* ── Notes, beside the call rather than a screen away ──────── */}
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">
                  <NotebookPen size={16} className="inline mr-1" />
                  {t("app.salesQueue.notesHeading", { business: current.businessName })}
                </h2>
                <ProspectNotes prospectId={current.id} businessName={current.businessName} />
              </section>

              {/* ── Layer 1: facts ─────────────────────────────────────────── */}
              <section className={CARD} data-tour="sales-queue-research">
                <LayerHeader layer="fact" />
                <ul className="space-y-2">
                  {current.facts.map((f) => (
                    <li key={f.key} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t(f.labelKey, f.label)}
                      </span>
                      <span
                        className={`text-sm break-words ${f.known ? "text-foreground" : "text-muted-foreground italic"}`}
                      >
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
                  <h3 className="text-sm font-medium text-foreground">
                    {t("app.salesQueue.siteCapabilitiesHeading")}
                  </h3>
                  {current.capabilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("app.salesQueue.siteNotCrawled")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {current.capabilities.map((c) => (
                        <li key={c.code} className="space-y-1">
                          <Pill tone={c.tone}>{c.text}</Pill>
                          {c.detail ? (
                            <p className="text-xs text-muted-foreground break-words">{c.detail}</p>
                          ) : null}
                          {c.known && !c.sayable ? (
                            <p className="text-xs text-muted-foreground">
                              {t("app.salesQueue.notVerifiedImpression")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 space-y-1">
                  <h3 className="text-sm font-medium text-foreground">
                    {t("app.salesQueue.softwareHeading")}
                  </h3>
                  <p className="text-sm text-foreground break-words">{current.competitor.text}</p>
                </div>
              </section>

              {/* ── Layer 2: inferences ────────────────────────────────────── */}
              <section className={CARD}>
                <LayerHeader layer="inference" />
                {current.inferences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("app.salesQueue.noInferences")}
                  </p>
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
                                  kind: inf.kindTextKey
                                    ? t(inf.kindTextKey, inf.kindText)
                                    : inf.kindText,
                                }),
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground break-words">
                              {t("app.salesQueue.inferenceCaveat", {
                                confidence: t(inf.confidenceTextKey, inf.confidenceText, {
                                  percent: inf.confidencePercent,
                                }),
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
              </section>

              {/* ── Layer 3: recommendations ───────────────────────────────── */}
              <section className={CARD}>
                <LayerHeader layer="recommendation" />
                {current.opportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("app.salesQueue.noRecommendations")}
                  </p>
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
                                    confidence: t(o.confidenceTextKey, o.confidenceText, {
                                      percent: o.confidencePercent,
                                    }),
                                    observations: t("app.salesQueue.observationCount", {
                                      value: o.evidenceIds.length,
                                    }),
                                    rule: o.ruleCode,
                                  })
                                : t("app.salesQueue.recommendationEvidence", {
                                    confidence: t(o.confidenceTextKey, o.confidenceText, {
                                      percent: o.confidencePercent,
                                    }),
                                    observations: t("app.salesQueue.observationCount", {
                                      value: o.evidenceIds.length,
                                    }),
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
              </section>

              {/* ── What we do not know ────────────────────────────────────── */}
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">
                  <CircleHelp size={16} className="inline mr-1" />
                  {t("app.salesQueue.unknownsHeading")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("app.salesQueue.unknownsNote")}
                </p>
                {current.unknowns.length === 0 ? (
                  <p className="text-sm text-foreground">{t("app.salesQueue.unknownsNone")}</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {current.unknowns.map((u, i) => (
                      <li
                        key={`${u.key || u.text}-${i}`}
                        className="text-sm text-muted-foreground break-words"
                      >
                        {u.key ? t(u.key, u.text, u.params || {}) : u.text}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ── What happens next ──────────────────────────────────────── */}
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">
                  {t("app.salesQueue.wrapUpHeading")}
                </h2>
                <button
                  type="button"
                  className={`${BTN} bg-primary text-primary-foreground w-full`}
                  disabled={Boolean(busy)}
                  onClick={() => act("worked", { prospectId: current.id })}
                >
                  {busy === "worked" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  {t("app.salesQueue.markWorked")}
                </button>
                <p className="text-xs text-muted-foreground">
                  {t("app.salesQueue.markWorkedNote")}
                </p>

                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground w-full`}
                  disabled={Boolean(busy)}
                  onClick={() => act("release", { prospectId: current.id })}
                >
                  {busy === "release" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
                  {t("app.salesQueue.release")}
                </button>

                {/* ── Carry it across to a lead ────────────────────────────────
                    SalesLead.prospectId has existed since the queue did, and
                    nothing wrote it from here: a rep who wanted to EMAIL or
                    TEXT somebody they had just researched and phoned had to
                    retype the name and the number on the leads screen. Slow,
                    and it silently broke the link — two records about one
                    business, neither able to see the other.

                    Pressing it twice is the ordinary case, so the server hands
                    back the lead that already exists rather than making a
                    second one. */}
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
                <p className="text-xs text-muted-foreground">
                  {t("app.salesQueue.carryToLeadNote")}
                </p>

                {/* ── Stop working this one ────────────────────────────────────
                    The distinction below sits OUTSIDE the disclosure, so it is read
                    before the press rather than after it. The body copy was
                    corrected on 2026-09-03; the button that opened it still said
                    "They asked not to be contacted", which is the sentence a rep
                    hears on the phone and the promise this action does not keep —
                    it writes one Prospect row, not the platform list. A retraction
                    underneath a button that already made the promise is the
                    refusal-shaped-as-an-afterthought AGENTS.md's design notes warn
                    about, so the button now says what it does and the sentence
                    stands above both states. */}
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

                {/* The scope of this button, in full. It is the sentence that
                    stops a rep believing they have honoured "never call me
                    again" when they have written one Prospect row, so it is
                    translated whole rather than trimmed to fit. */}
                <p className="text-xs text-muted-foreground">
                  {emphasise(
                    t("app.salesQueue.dncScopeNote"),
                    "span",
                    "font-medium text-foreground",
                  )}
                </p>
              </section>
            </>
          ) : null}
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
