// app/platform/signups/page.js
//
// The people who wanted FieldQuo enough to type their business into it, and
// then stopped — at the first step, at the trades, at the card screen.
//
// ══ Why this screen exists ═════════════════════════════════════════════════
//
// Ten of them were sitting in the live database and nothing showed them to
// anybody: the dashboard counted them as companies, the company list showed
// them as "pending" beside real customers, and the trial banner filed them
// under "in an unpaid free month" — which is three screens agreeing that a
// person who gave FieldQuo no card and no money is a customer.
//
// The owner's instruction was "flag it to the fieldquo platform so that we
// call them". This is the flag. Everything on a row is something a rep needs
// before dialling, and the two that matter most are the two that stop a call
// going wrong: whether a follow-up email has already gone out, and whether
// this person is on FieldQuo's own do-not-contact list.
//
// ══ 2026-09-21: one list, a trade on every row, and a way to hand it out ═══
//
// The owner's own test signup ("Test Company inc. started, entered their
// trade…") showed up here as a raw word with no trade and nothing to do
// about it. Now every row carries the trade its own words map to (the same
// mapping the promotion writes — never a guess), a "Set trade" select when
// they map to nothing, and "Assign for callback": the row's Prospect is found
// or written the way the cron would have written it, and handed to the rep
// through the one assign write the review folder uses. A referred signup is
// shown as the referring rep's and offered to nobody else.
//
// ══ 2026-09-24: who holds it, how it got there, and Do Not Contact ═════════
//
// Luma Painting read "Do not contact" and "in the review folder" on one row —
// it had unsubscribed, and the folder had offered it anyway. A do-not-contact
// row now reads "Do not contact — {reason}" and nothing else about the floor,
// and the server keeps it out of the folder and every assign path. Every row
// says who holds it now (a rep, the Platform, or nobody yet) and a compact
// history off the claim log — assigned to X by Y, released, taken back,
// moved. A row a rep holds can be taken back to the Platform or moved to
// another rep (lib/signup/assignment.js; superadmin, re-checked server-side).
//
// English only, like the rest of the console.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Ban,
  Building2,
  Flame,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  Undo2,
  UserCheck,
} from "lucide-react";
import { count } from "@/app/components/platform/MetricCard";
import { fetchJson } from "@/lib/fetchJson";
import { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

/**
 * What the nudge decision means, in words a person can act on.
 *
 * Keyed off the reason code lib/signup/abandoned.js returns rather than
 * re-derived here — a second opinion about the same question written beside the
 * screen is exactly how the trial count came to be wrong on two tiles at once.
 * An unknown code falls through to the code itself rather than to a friendly
 * sentence that might be false.
 */
const NUDGE_LABELS = {
  due: "24 h note goes out on the next run",
  too_early: "24 h note — waiting out the delay",
  too_late: "Past the window — no 24 h note",
  already_nudged: "24 h note sent",
  address_already_nudged: "Covered by a note to the same address",
  suppressed: "On the do-not-contact list — no email",
  no_recipient: "No email address on the signup",
  no_owner: "No owner — created from the console, not a signup",
  completed_checkout: "Completed checkout (should not be on this list)",
  demo: "Demo account (should not be on this list)",
  no_created_at: "No signup date on record",
  held_by_rep: "A rep holds this signup — their intro replaces the note",
  // A card-free trial finished signing up (lib/signup/abandoned.js
  // isCardFreeTrial) — neither letter is ever written to it.
  trial_no_plan: "Finished signing up — no follow-up letters",
  dismissed: "Removed from the list — no email",
};

const SKIP_LABELS = {
  suppressed: "On the do-not-contact list — never promoted",
  company_exists: "Matches a company already on the books (same email or phone) — not promoted; the signup itself is unfinished",
  completed: "Completed the signup",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "phone", label: "Has phone" },
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
];

function minutesAgo(value) {
  if (!value) return "—";
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

function dayWord(value) {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  return d.toISOString().slice(0, 10);
}

function formatDay(value) {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * One shape for both kinds of row, so the filters, the sort and the controls
 * read the same fields. `kind` says which API row it came from and which id
 * the write route needs.
 */
function unify(data) {
  const started = (data?.started || []).map((r) => {
    const s = r.state || {};
    const assignedTo = s.code === "assigned" ? s.rep : s.code === "rep_lead" ? s.rep : null;
    return {
      kind: "lead",
      key: `lead:${r.id}`,
      target: { leadId: r.id },
      name: r.companyName || r.name || r.email,
      contact: r.name,
      email: r.email,
      phone: r.phone,
      where: r.where,
      language: r.language,
      stepLabel: r.stepLabel,
      lastSeenAt: r.lastSeenAt,
      startedAt: r.startedAt,
      trade: r.trade,
      prospectId: r.prospectId,
      hot: Boolean(s.hot),
      assignedTo,
      signedIn: Boolean(r.signedIn),
      referred: s.code === "rep_lead" ? s.rep : r.referredBy,
      doNotContact: Boolean(r.doNotContact),
      doNotContactReason: r.doNotContactReason || null,
      // A do-not-contact row never reads as waiting for a call (the
      // owner's 2026-09-24 Luma Painting row said both at once).
      floorText: floorLine(r, () => startedState(s)),
      holder: r.holder || null,
      history: r.history || [],
      actions: r.actions || {},
      nudges: r.nudges,
      companyHref: null,
      usedProduct: null,
      section: "incomplete",
      dismissed: r.dismissed || null,
    };
  });
  const company = (c, section) => ({
    kind: "company",
    key: `company:${c.id}`,
    target: { companyId: c.id },
    name: c.name,
    contact: c.ownerName,
    email: c.email,
    phone: c.phone,
    where: c.where,
    language: c.language,
    stepLabel: c.stepLabel,
    lastSeenAt: c.lastSeenAt,
    startedAt: c.createdAt,
    trade: c.trade,
    prospectId: c.lead?.prospectId || null,
    hot: Boolean(c.lead?.hot),
    assignedTo: c.lead?.assignedTo || (c.referredTo?.id ? c.referredTo : null),
    referred: c.referredTo,
    doNotContact: Boolean(c.doNotContact),
    doNotContactReason: c.doNotContactReason,
    floorText: floorLine(c, () => companyState(c)),
    holder: c.holder || null,
    history: c.history || [],
    actions: c.actions || {},
    nudges: c.nudges,
    nudgeState: c.nudgeState,
    companyHref: `/platform/companies/${c.id}`,
    usedProduct: c.quotes > 0 || c.clients > 0 ? { quotes: c.quotes, clients: c.clients } : null,
    section,
    trial: c.trial || null,
    dismissed: c.dismissed || null,
  });
  const signups = (data?.signups || []).map((c) => company(c, "incomplete"));
  // Finished on the card-free trial — their own section, never "got as far
  // as Checkout". See the header of app/api/platform/signups/route.js.
  const trials = (data?.trials || []).map((c) => company(c, "trial"));
  return [...started, ...signups, ...trials];
}

/**
 * What a finished card-free trial is, in one line: "Signed up · free trial,
 * 29 days left · no plan chosen yet". Off the trial state the API computed
 * with lib/billing/access.js trialAccessFor — the same function behind the
 * banner that company's owner is looking at.
 */
function trialLine(trial) {
  if (!trial) return "Signed up · free trial · no plan chosen yet";
  const n = Number(trial.daysLeft) || 0;
  const days = `${n} ${n === 1 ? "day" : "days"}`;
  if (trial.level === "full") return `Signed up · free trial, ${days} left · no plan chosen yet`;
  if (trial.level === "readonly") return `Signed up · trial ended, read-only for ${days} more · no plan chosen yet`;
  return "Signed up · trial ended, locked · no plan chosen yet";
}

/**
 * A do-not-contact row's one line: "Do not contact — {reason}", worded by
 * the API (lib/signup/assignment.js dncSentence) so the refusal an assign
 * gets and the row the owner reads say the same thing. Takes the place of
 * every "in the review folder" / "becomes a hot lead" line — the server
 * keeps such a row out of the folder and every assign path.
 */
function dncState(row) {
  return { text: row.doNotContactText || `Do not contact — ${row.doNotContactReason || "on FieldQuo's do-not-contact list"}`, tone: "dnc" };
}

/**
 * The row's floor line. Do-not-contact first, whatever else is true; then a
 * floor row the platform holds but the folder does not offer (removed,
 * merged) says so rather than "unassigned, in the review folder"; otherwise
 * the kind's own sentence.
 */
function floorLine(row, otherwise) {
  if (row.doNotContact) return dncState(row);
  if (row.holder?.kind === "platform" && !row.holder.inFolder) return { text: row.holder.text, tone: "muted" };
  return otherwise();
}

/** A moment in the history, in the viewer's own clock: "24 Sep, 22:32". */
function atWord(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** How many history lines a row shows before "N earlier". */
const HISTORY_SHOWN = 3;

/** Where a started-never-finished signup stands on the sales floor, in words. */
function startedState(state) {
  switch (state?.code) {
    case "rep_lead":
      return { text: `${state.rep?.name || "A rep"}'s lead — came in on their link`, tone: "muted" };
    case "assigned":
      return { text: `${state.hot ? "Hot lead" : "Lead"} assigned to ${state.rep?.name || "a rep"}`, tone: "hot" };
    case "unassigned":
      return { text: `${state.hot ? "Hot lead" : "Lead"} — unassigned, in the review folder`, tone: "hot" };
    case "skipped":
      return { text: SKIP_LABELS[state.reason] || `Not promoted: ${state.reason}`, tone: "muted", companyId: state.matchedCompanyId || null };
    case "no_phone":
      return { text: "No phone typed yet — assign by hand or wait for one", tone: "muted" };
    case "waiting":
      return { text: `Quiet for ${state.quietMinutes} min — becomes a hot lead after ${state.promoteAfterMinutes}, or assign now`, tone: "muted" };
    default:
      return { text: state?.code || "—", tone: "muted" };
  }
}

function companyState(c) {
  if (c.referredTo?.id) return { text: `${c.referredTo.name}'s signup — came in on their link`, tone: "muted" };
  if (c.referredTo?.code) return { text: `Referred (${c.referredTo.code})`, tone: "muted" };
  if (!c.lead) {
    return c.finished
      ? { text: "No welcome-call row yet — assign to write one", tone: "muted" }
      : { text: "Reached the card screen — no floor row yet; assign to write one", tone: "muted" };
  }
  const kind = c.lead.kind === "stalled" ? "Stalled" : "New signup";
  if (c.lead.assignedTo) return { text: `${kind} — assigned to ${c.lead.assignedTo.name}`, tone: "hot" };
  return { text: `${kind} — unassigned, in the review folder`, tone: "hot" };
}

export default function PlatformSignupsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [ticked, setTicked] = useState(() => new Set());
  const [repId, setRepId] = useState("");
  const [busy, setBusy] = useState("");
  // The last write's answer: a sentence, and any refused rows with the
  // server's reason for each.
  const [outcome, setOutcome] = useState(null);
  const { isSuperadmin } = usePlatformAdmin();
  // Removed rows are hidden unless this is on — "Show removed (N)".
  const [showRemoved, setShowRemoved] = useState(false);
  // Rows whose whole assignment history is unfolded (the latest few show).
  const [openHistory, setOpenHistory] = useState(() => new Set());
  const toggleHistory = (key) =>
    setOpenHistory((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // fetchJson: every non-2xx is a thrown, worded error — no bare if (res.ok).
      const json = await fetchJson("/api/platform/signups");
      setData(json);
    } catch (err) {
      setError(err.message || "Couldn't load incomplete signups.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allRows = useMemo(() => unify(data), [data]);
  const removedCount = allRows.filter((r) => r.dismissed).length;
  // What the filters, the counts and the bulk bar work on: removed rows only
  // when the owner asked to see them.
  const rows = useMemo(() => (showRemoved ? allRows : allRows.filter((r) => !r.dismissed)), [allRows, showRemoved]);
  const visible = useMemo(() => {
    const list = rows.filter((r) => {
      if (filter === "phone") return Boolean(r.phone);
      if (filter === "unassigned") return !r.assignedTo;
      if (filter === "assigned") return Boolean(r.assignedTo);
      return true;
    });
    // Last seen, newest first — the person who stopped ten minutes ago is
    // the warmest call on the list.
    return list.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
  }, [rows, filter]);
  const incompleteVisible = visible.filter((r) => r.section !== "trial");
  const trialVisible = visible.filter((r) => r.section === "trial");
  const policy = data?.policy;
  const reps = data?.reps || [];
  const trades = data?.trades || [];
  const repById = useMemo(() => new Map(reps.map((r) => [r.id, r])), [reps]);

  // Rows the bulk can take: not referred (theirs already), not held live.
  const assignable = visible.filter((r) => !r.referred?.id && !r.assignedTo && !r.doNotContact && !r.dismissed);
  const tickedTargets = assignable.filter((r) => ticked.has(r.key));

  function toggle(key) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function assign(targets, label) {
    if (!repId) {
      setOutcome({ error: "Choose a rep first." });
      return;
    }
    setBusy(label);
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/signups/assign", {
        method: "POST",
        body: { action: "assign", salesRepId: repId, targets: targets.map((t) => t.target) },
      });
      const refused = (res.results || []).filter((r) => r.error);
      const theirs = (res.results || []).filter((r) => r.alreadyTheirs);
      setOutcome({
        text: `${res.assigned} assigned to ${res.rep?.name || "the rep"}${theirs.length ? `, ${theirs.length} already theirs` : ""}${refused.length ? `, ${refused.length} refused` : ""}.`,
        refused: refused.map((r) => ({ key: r.leadId ? `lead:${r.leadId}` : `company:${r.companyId}`, reason: r.error })),
      });
      setTicked(new Set());
      await load();
    } catch (err) {
      setOutcome({ error: err.message || "Could not assign." });
    } finally {
      setBusy("");
    }
  }

  async function setTrade(row, tradeKey) {
    if (!tradeKey) return;
    setBusy(`trade:${row.key}`);
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/signups/assign", {
        method: "POST",
        body: { action: "set_trade", tradeKey, targets: [row.target] },
      });
      const r = res.results?.[0];
      if (r?.error) setOutcome({ error: r.error });
      await load();
    } catch (err) {
      setOutcome({ error: err.message || "Could not set the trade." });
    } finally {
      setBusy("");
    }
  }

  // "Take back to Platform" — the rep's lease released, the row the
  // platform's again (in the review folder unless it may not be rung). And
  // "Reassign" — straight from the rep holding it to another. Both re-read
  // everything server-side (lib/signup/assignment.js); the answer is printed
  // whatever it is, refusals included.
  async function takeBack(row) {
    setBusy(`take:${row.key}`);
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/signups/assign", {
        method: "POST",
        body: { action: "take_back", targets: [row.target] },
      });
      const r = res.results?.[0];
      if (r?.error) setOutcome({ error: `${row.name}: ${r.error}` });
      else if (r?.already) setOutcome({ text: `${row.name}: ${r.note || "nobody holds it — already the platform's."}` });
      else setOutcome({ text: `${row.name} taken back from ${r?.fromRep?.name || "the rep"} — it is the platform's again.` });
      await load();
    } catch (err) {
      setOutcome({ error: err.message || "Could not take it back." });
    } finally {
      setBusy("");
    }
  }

  async function reassign(row) {
    if (!repId) {
      setOutcome({ error: "Choose a rep first." });
      return;
    }
    setBusy(`move:${row.key}`);
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/signups/assign", {
        method: "POST",
        body: { action: "reassign", salesRepId: repId, targets: [row.target] },
      });
      const r = res.results?.[0];
      if (r?.error) setOutcome({ error: `${row.name}: ${r.error}` });
      else setOutcome({ text: `${row.name} moved${r?.fromRep?.name ? ` from ${r.fromRep.name}` : ""} to ${res.rep?.name || "the rep"}.` });
      await load();
    } catch (err) {
      setOutcome({ error: err.message || "Could not reassign." });
    } finally {
      setBusy("");
    }
  }

  // "Remove from list" / "Restore": FieldQuo's own note about a row, never a
  // delete (app/api/platform/signups/dismiss). Superadmin only — re-checked
  // by the route; the buttons are hidden from anyone else as a courtesy.
  async function setRemoved(row, remove) {
    setBusy(`remove:${row.key}`);
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/signups/dismiss", {
        method: "POST",
        body: { action: remove ? "dismiss" : "restore", targets: [row.target] },
      });
      const r = res.results?.[0];
      if (r?.error) setOutcome({ error: r.error });
      else setOutcome({ text: remove ? `${row.name} removed from the list.` : `${row.name} restored.` });
      await load();
    } catch (err) {
      setOutcome({ error: err.message || (remove ? "Could not remove." : "Could not restore.") });
    } finally {
      setBusy("");
    }
  }

  const nameOf = (key) => allRows.find((r) => r.key === key)?.name || key;

  // One row, whichever section it is in — the incomplete list and the new
  // free trials read the same fields (unify) and offer the same controls.
  const renderRow = (r) => {
    const tickable = isSuperadmin && !r.referred?.id && !r.assignedTo && !r.doNotContact && !r.dismissed;
    return (
      <div key={r.key} className="px-5 py-4 flex gap-4" data-signup-row data-kind={r.kind}>
        {isSuperadmin && (
          <div className="pt-1 shrink-0">
            <input
              type="checkbox"
              aria-label={`Tick ${r.name}`}
              disabled={!tickable}
              checked={ticked.has(r.key)}
              onChange={() => toggle(r.key)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-wrap gap-4 justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {r.companyHref ? (
                <Link href={r.companyHref} className="font-medium text-foreground hover:underline truncate">
                  {r.name}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{r.name}</span>
              )}
              {r.hot ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900">
                  <Flame size={11} /> Hot
                </span>
              ) : null}
              {/* The trade, from their own words; the raw words and a
                  select when nothing mapped. Never a guessed trade. */}
              {r.trade?.key ? (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border text-foreground" data-trade={r.trade.key} title={r.trade.source === "prospect" ? "Set on the floor row" : "From what they ticked"}>
                  {r.trade.label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {r.trade?.raw?.length ? `Ticked: ${r.trade.raw.join(", ")}` : "No trade yet"}
                  </span>
                  {isSuperadmin && (
                    <select
                      aria-label={`Set trade for ${r.name}`}
                      defaultValue=""
                      disabled={busy === `trade:${r.key}`}
                      onChange={(e) => setTrade(r, e.target.value)}
                      className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
                      data-set-trade
                    >
                      <option value="">Set trade…</option>
                      {trades.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              )}
              {r.doNotContact && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900">
                  <Ban size={11} /> Do not contact
                </span>
              )}
              {r.usedProduct && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                  Used the product · {count(r.usedProduct.quotes)} quotes · {count(r.usedProduct.clients)} clients
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {r.contact || "no name"}
              {r.where ? ` · ${r.where}` : ""}
              {r.language ? ` · ${r.language.toUpperCase()}` : ""}
              {/* A finished trial says what it is; only an unfinished
                  signup has a step it stopped at. */}
              {r.section === "trial" ? ` · ${trialLine(r.trial)}` : r.stepLabel ? ` · got as far as ${r.stepLabel}` : ""}
              {/* The state the signup page resumes into: a login
                  exists, no company does. A rep who rings them can
                  say "just sign in and carry on" rather than "start
                  again". */}
              {r.signedIn && r.kind === "lead" ? " · signed in, no company yet" : ""}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {/* Real links, not decorative text: this screen exists so
                  somebody rings or writes to these people. */}
              {r.email ? (
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                  <Mail size={12} /> {r.email}
                </a>
              ) : (
                <span className="text-muted-foreground">no email</span>
              )}
              {r.phone ? (
                <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                  <Phone size={12} /> {r.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">no phone</span>
              )}
            </div>

            {/* ── Who holds it now ─────────────────────────────────────
                The owner, 2026-09-24: "I don't see to who has it or if it
                was assigned". A rep, the platform, or nobody yet — the
                API's holder (lib/signup/assignment.js signupHolderOf). */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1" data-holder={r.holder?.kind || "unknown"}>
              <span className="text-muted-foreground">Holder:</span>
              {r.assignedTo ? (
                <Link
                  href={r.prospectId ? `/platform/sales/prospects?id=${r.prospectId}` : "/platform/sales/reps"}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                  data-assigned-chip
                >
                  <UserCheck size={11} />
                  {r.referred?.id && r.referred.id === r.assignedTo.id ? "Theirs" : "Assigned to"} {r.assignedTo.name}
                  {r.assignedTo.at ? ` · ${dayWord(r.assignedTo.at)}` : ""}
                  {r.holder?.kind === "rep" && r.holder.worked ? " · worked" : ""}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-foreground" data-holder-text>
                  {r.holder?.kind === "platform" ? <Building2 size={11} /> : null}
                  {r.holder?.text || "Unassigned"}
                </span>
              )}
              {/* Take back / reassign — only on a row a rep holds, and
                  only for a superadmin; the route re-checks both. */}
              {isSuperadmin && r.actions?.takeBack && (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => takeBack(r)}
                  className="inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  data-take-back
                >
                  <Undo2 size={11} /> {busy === `take:${r.key}` ? "Taking back…" : "Take back to Platform"}
                </button>
              )}
              {isSuperadmin && r.actions?.reassign && (
                <>
                  <select
                    aria-label={`Move ${r.name} to`}
                    value={repId}
                    onChange={(e) => setRepId(e.target.value)}
                    className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
                  >
                    <option value="">Move to…</option>
                    {reps
                      .filter((rep) => rep.id !== r.holder?.rep?.id)
                      .map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!repId || repId === r.holder?.rep?.id || Boolean(busy)}
                    onClick={() => reassign(r)}
                    className="inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                    data-reassign
                  >
                    <ArrowRightLeft size={11} /> {busy === `move:${r.key}` ? "Moving…" : "Reassign"}
                  </button>
                </>
              )}
              {isSuperadmin && r.holder?.kind === "rep" && r.holder.worked && !r.actions?.takeBack ? (
                <span className="text-muted-foreground">worked — a conversation stays with a rep; reassign to move it</span>
              ) : null}
            </div>

            {/* ── Assign for callback, and where the row stands ────────── */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {r.assignedTo ? null : r.referred?.code && !r.referred?.id ? (
                <span className="text-muted-foreground">referred ({r.referred.code}) — not a rep's code</span>
              ) : isSuperadmin && !r.doNotContact && !r.dismissed ? (
                <>
                  <select
                    aria-label={`Rep for ${r.name}`}
                    value={repId}
                    onChange={(e) => setRepId(e.target.value)}
                    className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
                  >
                    <option value="">Choose a rep…</option>
                    {reps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!repId || Boolean(busy)}
                    onClick={() => assign([r], r.key)}
                    className="border border-border rounded px-2 py-0.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                    data-assign-callback
                  >
                    {busy === r.key ? "Assigning…" : "Assign for callback"}
                  </button>
                </>
              ) : null}
              {/* An unplaced floor row the folder offers is also in the
                  review folder's signup section — the same row, the other
                  door. Only when the API says the folder offers it: a
                  do-not-contact row is the platform's and is NOT there. */}
              {r.holder?.inFolder && !r.assignedTo ? (
                <Link href="/platform/sales/review?signups=all" className={`underline ${r.floorText.tone === "hot" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                  {r.floorText.text}
                </Link>
              ) : r.floorText.companyId ? (
                // The company the cron matched this signup to — a
                // link, so "already on the books" can be checked
                // rather than believed (the owner's row matched by
                // phone to a different business of his).
                <Link href={`/platform/companies/${r.floorText.companyId}`} className="underline text-muted-foreground">
                  {r.floorText.text}
                </Link>
              ) : (
                <span
                  className={r.floorText.tone === "dnc" ? "font-medium text-red-700 dark:text-red-300" : r.floorText.tone === "hot" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}
                  data-dnc-line={r.floorText.tone === "dnc" ? "" : undefined}
                >
                  {r.floorText.text}
                </span>
              )}
            </div>

            {/* ── How it got there ─────────────────────────────────────
                Assigned to X by Y, released, taken back, moved — read off
                the claim log, oldest first; the latest few shown. */}
            {r.history?.length > 0 && (
              <div className="text-xs text-muted-foreground pt-1" data-assignment-history>
                {r.history.length > HISTORY_SHOWN && (
                  <button
                    type="button"
                    onClick={() => toggleHistory(r.key)}
                    className="underline mb-0.5"
                  >
                    {openHistory.has(r.key) ? "Show fewer" : `Show ${r.history.length - HISTORY_SHOWN} earlier`}
                  </button>
                )}
                <ol className="space-y-0.5">
                  {(openHistory.has(r.key) ? r.history : r.history.slice(-HISTORY_SHOWN)).map((e, i) => (
                    <li key={`${e.at}-${i}`} data-history-type={e.type}>
                      <span className="tabular-nums">{atWord(e.at)}</span> · {e.text}
                      {e.by ? ` · by ${e.by}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="text-right shrink-0 space-y-1">
            <div className="text-sm text-foreground">Last seen {minutesAgo(r.lastSeenAt)}</div>
            <div className="text-xs text-muted-foreground">
              {r.kind === "company" ? "Signed up" : "Started"} {formatDay(r.startedAt)}
            </div>
            {/* ── Which follow-ups went out ─────────────────────────
                Read off the SignupNudge log, never inferred. */}
            <div className="text-xs inline-flex items-center gap-1 text-muted-foreground" data-followups>
              <MailCheck size={12} />
              {r.nudges?.early || r.nudges?.recovery ? (
                <>
                  Follow-up sent
                  {r.nudges.early ? ` ${policy?.earlyMinutes ?? 5} min` : ""}
                  {r.nudges.early && r.nudges.recovery ? " ·" : ""}
                  {r.nudges.recovery ? ` ${policy?.delayHours ?? 24} h` : ""}
                </>
              ) : r.kind === "company" ? (
                NUDGE_LABELS[r.nudgeState] || r.nudgeState
              ) : (
                "No follow-up sent yet"
              )}
            </div>
            {/* ── Remove from list / Restore ────────────────────────────
                Hides the row from this page, the review folder and both
                follow-up letters; deletes nothing. */}
            {r.dismissed && (
              <div className="text-xs text-muted-foreground" data-removed>
                Removed {formatDay(r.dismissed.at)}
                {r.dismissed.by ? ` by ${r.dismissed.by}` : ""}
              </div>
            )}
            {isSuperadmin && (
              <div>
                <button
                  type="button"
                  disabled={busy === `remove:${r.key}`}
                  onClick={() => setRemoved(r, !r.dismissed)}
                  className="text-xs text-muted-foreground underline disabled:opacity-40"
                  data-remove-row={r.dismissed ? "restore" : "remove"}
                >
                  {busy === `remove:${r.key}` ? "Saving…" : r.dismissed ? "Restore" : "Remove from list"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Signups</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Two lists. <strong className="text-foreground">Signed up — on free trial</strong>: finished
            signing up, no card and no plan chosen yet (the plan is picked from the banner inside the
            app). <strong className="text-foreground">Incomplete signups</strong>: started and stopped —
            at the first step, at the trades, or (before 24 Sept. 2026) at the card screen; they are
            not counted as companies anywhere on this console. Nothing here is deleted —
            &ldquo;Remove from list&rdquo; only hides a row, and Restore brings it back.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2" data-signup-filters>
        {FILTERS.map((f) => {
          const n = rows.filter((r) =>
            f.key === "phone" ? Boolean(r.phone) : f.key === "unassigned" ? !r.assignedTo : f.key === "assigned" ? Boolean(r.assignedTo) : true,
          ).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`min-h-[44px] lg:min-h-0 inline-flex items-center text-xs px-3 py-1.5 rounded-full border ${
                filter === f.key ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label} · {n}
            </button>
          );
        })}
        {removedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowRemoved((v) => !v)}
            aria-pressed={showRemoved}
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted"
            data-show-removed
          >
            {showRemoved ? `Hide removed (${removedCount})` : `Show removed (${removedCount})`}
          </button>
        )}
        {policy && (
          <span className="text-xs text-muted-foreground ml-auto">
            Follow-ups: one email {policy.earlyMinutes} min after they go quiet, one {policy.delayHours} h after a
            company is created with no card, never past {policy.windowDays} days
          </span>
        )}
      </div>

      {/* ── The sticky bulk bar ───────────────────────────────────────────
          The review folder's pattern: the bar names what the filter shows,
          a rep is picked, and the button says exactly what it will do to
          exactly how many rows. Ticked rows only; a referred or held row is
          never in the count because it is never tickable. */}
      {isSuperadmin && !loading && rows.length > 0 && (
        <section className="sticky top-0 z-20 bg-card/95 backdrop-blur border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-bulk-bar>
          <span className="text-sm text-foreground">
            {FILTERS.find((f) => f.key === filter)?.label} · {visible.length} {visible.length === 1 ? "row" : "rows"}
            {tickedTargets.length ? ` · ${tickedTargets.length} ticked` : ""}
          </span>
          <select
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            aria-label="Rep to assign to"
            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
            data-bulk-rep
          >
            <option value="">Choose a rep…</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.sellsIn?.length ? ` (${r.sellsIn.join(", ")})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!repId || !tickedTargets.length || Boolean(busy)}
            onClick={() => assign(tickedTargets, "bulk")}
            className="min-h-[44px] lg:min-h-0 bg-inverted text-inverted-foreground rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            data-bulk-assign
          >
            {busy === "bulk" ? "Assigning…" : `Assign ${tickedTargets.length || ""} to ${repById.get(repId)?.name || "…"} for callback`}
          </button>
          <button
            type="button"
            onClick={() => setTicked(new Set(assignable.map((r) => r.key)))}
            className="text-xs text-muted-foreground underline"
          >
            Tick all {assignable.length} assignable
          </button>
          {ticked.size > 0 && (
            <button type="button" onClick={() => setTicked(new Set())} className="text-xs text-muted-foreground underline">
              Clear
            </button>
          )}
          {outcome?.text && <span className="text-xs text-emerald-700 dark:text-emerald-300">{outcome.text}</span>}
          {outcome?.error && <span className="text-xs text-red-700 dark:text-red-300">{outcome.error}</span>}
          {outcome?.refused?.length > 0 && (
            <ul className="w-full text-xs text-red-700 dark:text-red-300">
              {outcome.refused.map((r) => (
                <li key={r.key}>
                  {nameOf(r.key)}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data ? null : (
        <>
          {/* ── Signed up — on free trial ─────────────────────────────────
              Finished signing up — no card, no plan chosen yet (the plan is
              picked from the banner inside the app since 2026-09-24). Not
              incomplete, so not in the list below; on this screen because
              the welcome call is placed from here. The whole population,
              with search, is the companies list's "Free trial · no plan"
              filter. */}
          <section className="space-y-3" data-trial-section>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">
                Signed up — on free trial ({count(trialVisible.length)})
              </h2>
              <Link href="/platform/companies?status=trial_no_plan" className="text-sm text-muted-foreground underline">
                All free trials without a plan in Companies →
              </Link>
            </div>
            {trialVisible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {rows.some((r) => r.section === "trial") ? "Nothing matches this filter." : "No company is on a free trial without a plan right now."}
              </p>
            ) : (
              <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {trialVisible.map(renderRow)}
              </div>
            )}
          </section>

          {/* ── Incomplete signups — never finished ─────────────────────── */}
          <section className="space-y-3" data-incomplete-section>
            <h2 className="text-lg font-semibold text-foreground">
              Incomplete signups — never finished ({count(incompleteVisible.length)})
            </h2>
            {incompleteVisible.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Building2 size={28} className="text-muted-foreground mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {rows.filter((r) => r.section !== "trial").length === 0
                    ? "Nobody has an unfinished signup right now."
                    : "Nothing matches this filter."}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {incompleteVisible.map(renderRow)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
