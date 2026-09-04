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
// ══ English-only, like the rest of the outreach portal ════════════════════
//
// /sales/leads and /sales/threads are English-only (docs/sales-intel/STATUS.md
// records it); the shell and the companies list are translated. This follows
// the outreach screens rather than the shell, because it is the same audience
// doing the same job, and half a translated screen is worse than none.
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
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
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
import RepNoteVisibilityNotice from "@/app/components/sales/RepNoteVisibilityNotice";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";
import CallPanel from "./CallPanel";

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
 * One reason a call cannot go ahead, or one caveat on a call that can.
 *
 * `tone` follows the same three-state discipline the pills do, and for the
 * harder version of the same reason. "It is 21:00 in Tulsa" is a finding and
 * gets the amber a finding gets; "nobody has read Colorado's statute" is not a
 * finding at all, and giving it the same colour would tell a rep we checked.
 * The dashed muted box is the one this page already uses for `unknown`.
 */
function Notice({ tone, icon: Icon, title, fix }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold break-words">{title}</p>
          {fix ? <p className="break-words">{fix}</p> : null}
        </div>
      </div>
    </div>
  );
}

function LayerHeader({ layer }) {
  const heading = LAYER_HEADINGS[layer];
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{heading.title}</h2>
      <p className="text-xs text-muted-foreground">{heading.note}</p>
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
 */
function rowStatus(item) {
  if (!item?.contact?.callable) {
    return {
      Icon: item?.contact?.code === "do_not_contact" ? Ban : PhoneOff,
      className: "text-red-700 dark:text-red-300",
      label: item?.contact?.title || "Cannot be called",
    };
  }
  if (item?.claim?.state === "mine_worked") {
    return { Icon: CircleCheck, className: "text-emerald-700 dark:text-emerald-300", label: "Worked" };
  }
  return { Icon: Phone, className: "text-muted-foreground", label: "Claimed, not called yet" };
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
      setError("Couldn't reach the server for your notes. Check your connection.");
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
      setError(payload?.error || "Your notes for this prospect didn't load.");
      return;
    }
    setNotes(Array.isArray(payload?.notes) ? payload.notes : []);
  }, [prospectId]);

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
      setError(err?.message || "That note did not save. It is still in the box — try again.");
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
          What did they say? Type it while you can still hear it.
        </span>
        <textarea
          className={FIELD}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="As close to their words as you can get."
        />
      </label>
      <button
        type="button"
        className={`${BTN} bg-primary text-primary-foreground w-full`}
        disabled={saving || !draft.trim()}
        onClick={save}
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : <NotebookPen size={16} />}
        Save this note against {businessName || "this prospect"}
      </button>

      {notes === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading your notes…
        </p>
      ) : null}

      {Array.isArray(notes) && notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have written nothing about this one yet.
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
                  Last edited {new Date(n.updatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
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
      const body = await fetchJson(`/api/sales/queue?${search.toString()}`);
      stampClock(body);
      setData(body);
    } catch (err) {
      setError(err?.message || "Could not load your queue.");
    } finally {
      // `loading` is the FIRST load only. Every load after it leaves the list
      // on screen — a console whose list blanks each time a row is clicked is
      // the losing-your-place problem this rewrite exists to fix, wearing a
      // spinner.
      setLoading(false);
      setFetching(false);
    }
  }, [tradeKey, prospectId, stampClock]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    try {
      const body = await fetchJson("/api/sales/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tradeKey, ...extra }),
      });
      if (body?.claimed === null) {
        // The server has an honest answer for "nothing to give you" and it is
        // not an error. Say it, and leave the queue as it was.
        setError(body.message);
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
      setError(err?.message || "That did not work.");
    } finally {
      setBusy("");
      setDncOpen(false);
      setDncReason("");
    }
  }

  const current = data?.current || null;
  const items = data?.queue?.items || [];
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
    });
    // `tick` is here to re-run this every thirty seconds; it is not read.
  }, [current, clock, tick]);

  const href = dialHref(compliance, current?.phoneE164);
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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Today&rsquo;s queue</h1>
        <p className="text-sm text-muted-foreground">
          Your claims, whoever you are on, and the call controls in the same place every time. One trade at a time — you get better at a script by saying it forty
          times, not by switching every call. What we could not establish says so.
        </p>
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
          <section className={CARD}>
            <label className="block text-sm font-medium text-foreground" htmlFor="q-trade">
              Which trade are you calling today?
            </label>
            <select
              id="q-trade"
              className={FIELD}
              value={tradeKey}
              onChange={(e) => setQuery({ trade: e.target.value, prospectId: "" })}
            >
              <option value="">Everything I have claimed</option>
              {(data?.trades || []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} — {t.claimed} claimed, {t.available} free
                </option>
              ))}
            </select>
            {tradeKey ? (
              <button
                type="button"
                className={`${BTN} bg-primary text-primary-foreground w-full`}
                disabled={Boolean(busy)}
                onClick={() => act("claim")}
              >
                {busy === "claim" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Claim the next one
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a trade to claim a new prospect. Claiming is what stops two reps phoning the same
                contractor, so there is no way to work one without it. The numbers beside each trade are
                counts, not a list — nobody gets to read the pool and pick.
              </p>
            )}
          </section>

          <section className={CARD}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Yours to work</h2>
              {loading ? (
                <Loader2 className="animate-spin text-muted-foreground" size={15} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {items.length} claimed
                </span>
              )}
            </div>

            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={15} /> Loading your queue…
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
                  Nothing is invented to fill this screen. An empty queue is an empty queue.
                </p>
              </div>
            ) : null}

            {items.length > 0 ? (
              <ul className="space-y-2">
                {items.map((item) => {
                  const status = rowStatus(item);
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
                        <span className="min-w-0">
                          <span className="block text-sm font-medium break-words">
                            {item.businessName}
                          </span>
                          <span className="block text-xs text-muted-foreground break-words">
                            {status.label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </aside>

        {/* ── The pane. Everything about the one they are on ──────────────── */}
        <div className="space-y-4 min-w-0">
          {/* ── The call region, pinned ───────────────────────────────────────
              First in the pane and sticky from lg: up, so scrolling down
              through the research never takes the dial away. On a phone it is
              simply the first thing on the screen, which is the same promise
              at 375px. */}
          <section className={`${CARD} lg:sticky lg:top-4 z-10`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground break-words">
                  {current ? current.businessName : "Nobody open"}
                </h2>
                <p className="text-sm text-muted-foreground break-words">
                  {current
                    ? [current.tradeLabel, current.territory?.name].filter(Boolean).join(" · ") ||
                      "No trade or territory on this record"
                    : "Pick one out of your queue, or claim one."}
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
                {listOpen ? "Hide the queue" : `Show the queue (${items.length})`}
              </button>
            ) : null}

            {/* ── The dial, or the reason there is not one ──────────────────
                Never blank. lib/sales/dialSpace.js decides which of the seven
                states this is and supplies the sentence; the only branch here
                is whether a control is rendered, and that is the one branch
                that must never be guessed at. */}
            {space.state === DIAL_READY && space.href ? (
              <>
                <CallPanel
                  prospectId={current.id}
                  phoneE164={current.phoneE164}
                  businessName={current.businessName}
                  fallbackHref={space.href}
                  onWorked={load}
                />
                <p className="text-xs text-muted-foreground break-words">{space.detail}</p>
              </>
            ) : space.state === DIAL_DO_NOT_CONTACT ? (
              // Red, and not one of the three tones. The three are epistemic —
              // we found it, we found its absence, we could not look — and a
              // do-not-contact is none of those. It is a hard stop, it was red
              // before this rewrite, and demoting it to the amber a closed
              // calling window gets would be the flattening the tones exist to
              // prevent.
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
                <div className="flex items-start gap-2">
                  <Ban size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{space.title}</p>
                    <p className="break-words">{space.detail}</p>
                    <p className="mt-1">
                      No dial control is shown, because pressing one would be a mistake rather than a refusal.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Notice
                tone={space.tone}
                icon={
                  space.state === DIAL_NO_NUMBER
                    ? PhoneOff
                    : space.state === DIAL_REFUSED
                      ? Clock
                      : CircleHelp
                }
                title={space.title}
                fix={space.detail}
              />
            )}

            {/* The blockers behind a refusal or an unknown, each in its own
                tone. A refusal is a finding; an unknown is not, and the two
                must not be the same colour — same rule the pills follow. */}
            {(space.reasons || []).map((b) => (
              <Notice
                key={b.code}
                tone={compliance?.decision === CALL_REFUSED ? "gap" : "unknown"}
                icon={compliance?.decision === CALL_REFUSED ? Clock : CircleHelp}
                title={b.title}
                fix={b.fix}
              />
            ))}

            {/* Said beside a working button on purpose. A cap nothing counts,
                and a registration nobody has filed, are facts about THIS call —
                burying them in a document is how they stop being true. */}
            {(compliance?.unenforced || []).map((u) => (
              <Notice key={u.code} tone="gap" icon={ShieldAlert} title={u.title} fix={u.fix} />
            ))}
            {(compliance?.warnings || []).map((w) => (
              <Notice key={w.code} tone="gap" icon={ShieldAlert} title={w.title} fix={w.fix} />
            ))}

            {compliance?.decision === CALL_ALLOWED && compliance.windowText ? (
              <p className="text-xs text-muted-foreground break-words">
                Judged in{" "}
                {compliance.zoneSource === "stated"
                  ? "the time zone recorded on their lead"
                  : `the time zone their address implies (${compliance.zones.join(", ")})`}
                .
              </p>
            ) : null}

            {/* ── The citation, shown rather than stored ────────────────────
                `citation` was carried on every row and reached a human only
                through the "nobody has read this" blocker — so the verified
                half of the table, which is the half that lets a call happen,
                cited its statute to nobody. That is AGENTS.md failure class #1
                with the safe-looking sign: written and never read.

                Folded shut because a rep dialling their fortieth painter does
                not want a statute number, and open in one click because the day
                they are asked "what makes this legal?" they need the answer on
                the screen they are already on. */}
            {compliance?.jurisdiction?.verified && compliance.citation ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  What {compliance.jurisdiction.name} actually says
                </summary>
                <p className="mt-1 break-words">{compliance.citation}</p>
              </details>
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
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  {index + 1} of {items.length}
                </span>
                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground flex-1`}
                  disabled={index < 0 || index >= items.length - 1}
                  onClick={() => select(items[index + 1].id)}
                >
                  Next <ChevronRight size={16} />
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
                This is where the prospect goes
              </h2>
              <p className="text-sm text-muted-foreground break-words">
                Everything already researched about whoever you open — the facts, what we only think,
                what we would pitch, and what nobody has established — reads here, under the call
                controls. Your queue stays put while you work through it.
              </p>
            </section>
          ) : null}

          {!loading && current ? (
            <>
              {/* ── Notes, beside the call rather than a screen away ──────── */}
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">
                  <NotebookPen size={16} className="inline mr-1" />
                  Your notes on {current.businessName}
                </h2>
                <ProspectNotes prospectId={current.id} businessName={current.businessName} />
              </section>

              {/* ── Layer 1: facts ─────────────────────────────────────────── */}
              <section className={CARD}>
                <LayerHeader layer="fact" />
                <ul className="space-y-2">
                  {current.facts.map((f) => (
                    <li key={f.key} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span
                        className={`text-sm break-words ${f.known ? "text-foreground" : "text-muted-foreground italic"}`}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">What their site does</h3>
                  {current.capabilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing has crawled this business, so nothing is known about their site. Ask.
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
                              Not verified — say it as an impression, not as a fact.
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 space-y-1">
                  <h3 className="text-sm font-medium text-foreground">Software they run</h3>
                  <p className="text-sm text-foreground break-words">{current.competitor.text}</p>
                </div>
              </section>

              {/* ── Layer 2: inferences ────────────────────────────────────── */}
              <section className={CARD}>
                <LayerHeader layer="inference" />
                {current.inferences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing has been inferred about this business. Do not fill the gap on the call.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {current.inferences.map((inf, i) => (
                      <li key={`${inf.kind}-${i}`}>
                        {inf.renderable ? (
                          <>
                            <p className="text-sm text-foreground break-words">
                              We think: <strong>{inf.text}</strong> ({inf.kindText})
                            </p>
                            <p className="text-xs text-muted-foreground break-words">
                              {inf.confidenceText}. {inf.sourceText} This is not a fact — do not say it as one.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                            <ShieldAlert size={14} className="inline mr-1" />
                            {inf.refusal}
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
                    Nothing is recommended for this prospect. A pitch needs an observation to cite, and there is
                    none — open with a question instead.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {current.opportunities.map((o, i) => (
                      <li key={`${o.capabilityCode}-${i}`} className="space-y-1">
                        {o.renderable ? (
                          <>
                            <p className="text-sm text-foreground break-words">
                              <strong>{i + 1}. {o.name}</strong>
                            </p>
                            <p className="text-sm text-foreground break-words">Because: {o.reason}</p>
                            <p className="text-xs text-muted-foreground break-words">
                              {o.confidenceText} · cites {o.evidenceIds.length} observation
                              {o.evidenceIds.length === 1 ? "" : "s"}
                              {o.ruleCode ? ` · rule ${o.ruleCode}` : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                            <ShieldAlert size={14} className="inline mr-1" />
                            {o.refusal}
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
                  What we do not know
                </h2>
                <p className="text-xs text-muted-foreground">
                  Said out loud here so it is not guessed at on the call.
                </p>
                {current.unknowns.length === 0 ? (
                  <p className="text-sm text-foreground">Nothing outstanding on this record.</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {current.unknowns.map((u, i) => (
                      <li key={`${u}-${i}`} className="text-sm text-muted-foreground break-words">
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ── What happens next ──────────────────────────────────────── */}
              <section className={CARD}>
                <h2 className="text-base font-semibold text-foreground">When you are done</h2>
                <button
                  type="button"
                  className={`${BTN} bg-primary text-primary-foreground w-full`}
                  disabled={Boolean(busy)}
                  onClick={() => act("worked", { prospectId: current.id })}
                >
                  {busy === "worked" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  I spoke to them — keep this one
                </button>
                <p className="text-xs text-muted-foreground">
                  It stops lapsing and stays yours. A real conversation is not a lease.
                </p>

                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground w-full`}
                  disabled={Boolean(busy)}
                  onClick={() => act("release", { prospectId: current.id })}
                >
                  {busy === "release" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
                  Put it back in the pool
                </button>

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
                      Why should we stop working this one?
                    </label>
                    <input
                      id="q-dnc"
                      className={FIELD}
                      value={dncReason}
                      onChange={(e) => setDncReason(e.target.value)}
                      placeholder="Sold the business — the new owner is not interested"
                    />
                    <button
                      type="button"
                      className={`${BTN} bg-red-600 text-white w-full`}
                      disabled={Boolean(busy) || !dncReason.trim()}
                      onClick={() => act("do_not_contact", { prospectId: current.id, reason: dncReason })}
                    >
                      {busy === "do_not_contact" ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
                      Stop working them — permanently
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${BTN} border border-red-300 text-red-700 dark:text-red-300 w-full`}
                    disabled={Boolean(busy)}
                    onClick={() => setDncOpen(true)}
                  >
                    <Ban size={16} /> Stop working this one
                  </button>
                )}

                <p className="text-xs text-muted-foreground">
                  Permanent on this prospect — it survives every pipeline stage and
                  there is no control anywhere that lifts it. It does not put the
                  number on FieldQuo&apos;s do-not-contact list: if they said it on
                  the phone, close the call with{" "}
                  <span className="font-medium text-foreground">
                    Asked not to be called again
                  </span>{" "}
                  instead. That one binds every rep and every channel.
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
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Opening your console…
        </div>
      }
    >
      <QueueConsole />
    </Suspense>
  );
}
