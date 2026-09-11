// app/platform/sales/reps/page.js
//
// FieldQuo's own sales team. Reads like /app/settings/team on purpose — that
// was the owner's requirement, and it is a statement about the EXPERIENCE:
// type a name and an email, click Invite, they get a link.
//
// None of the tenant invite machinery is underneath it, and none could be:
// lib/sales/invite.js's header lists every assumption POST
// /api/settings/members makes that is false for FieldQuo hiring its own staff
// (a member as the actor, a seat charged to a company's plan, a role from the
// per-company permission grid, a Better Auth organization invitation).
//
// ══ What the owner found missing, and what each gap now is ════════════════
//
// He added a rep and asked: "asks me for a name email and code? what is the
// code for? where do i enter their work email? where can i assign them a
// number for callbacks etc?" Every one of those was real.
//
//   the code       is the slug in /signup?sales=<code> — the ONLY mechanism by
//                  which a signup is credited to a rep. It is now generated
//                  from the name, shown before the invite goes out, and
//                  overridable. The screen and the server agree because both
//                  call lib/sales/repAdmin.js's codeCandidates().
//   the work email is SalesRep.workEmail, the mailbox outreach is sent from and
//                  replies come back to. The column existed and had no writer
//                  anywhere in the product, while lib/sales/outreachSender.js
//                  refuses every send without one. Both halves are wired now,
//                  and the row says so in the blocker's own words.
//   the plan       is SalesCommissionPlan, and it was the same shape of gap one
//                  layer down: this screen READ commissionPlan.name to display
//                  it and nothing anywhere in the product could write it —
//                  `salesCommissionPlan.create` appeared in no route, no screen
//                  and no seed. A rep with no plan earns NOTHING (earnMilestone
//                  refuses a null amount and writes no row at all), so the
//                  picker below, and /platform/sales/plans behind it, are what
//                  make hiring a closer mean anything.
//   a number       is two different answers and is given as two: texting is
//                  real and SHARED (one first-party number, not one per rep),
//                  and a per-rep voice callback number does not exist. There is
//                  no picker for the second, because there is nothing behind
//                  it. See NUMBER_CAPABILITIES.
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no delete control here, and the screen says why rather than leaving
// its absence to be noticed: a rep's attributions and ledger are history.
// Deactivating closes the door within one request — lib/sales/gate.js re-reads
// `active` on every call — and leaves the record standing.
//
// ══ The queue, and what happens to it when the rep is gone ════════════════
//
// The owner: "in the /platform I should also see how many leads the sales
// have in their queue and manually release them if needed, in case they
// disconnect and do not reconnect, etc. And if I deactivate an account I
// should be able to handle their leads → maybe assign them to someone else or
// temporarily assign them to me."
//
// Every card now says what the rep holds — counted by the same queueWhere()
// their own screen lists — and "Queue…" opens the panel: presence (declared,
// with its staleness, never assumed), the split of held rows, and the three
// controls. Release untouched and Release all held both call the ONE release
// function the rep's own button and the hourly cron call; Move hands held
// prospects and open leads to another active rep, or to "me" when the
// superadmin's sign-in email is also a rep's. Attributions and commission
// never move, and the confirm says so.
//
// Deactivating a rep who holds work is refused by the server with the counts,
// and the same panel asks what to do with it first; one confirm does the
// hand-off and the deactivation in one transaction.
//
// ══ Cards, not a table ════════════════════════════════════════════════════
//
// A rep's row now carries a signup link, a mailbox, a code, a status, a
// company count and a sending verdict. Six columns of that in a table is a
// horizontal scroll on every phone, and the standing rule says the console has
// to work on one. A card per rep reads down instead of across.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  Copy,
  HandCoins,
  ListChecks,
  Loader2,
  Mail,
  Phone,
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import { describeDuration } from "@/lib/sales/calls/agentState";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";
import { codeProblem, suggestCode, workEmailProblem } from "@/lib/sales/repAdmin";
import { ENGAGEMENTS } from "@/lib/sales/payoutDetails";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const BTN_PRIMARY = `${BTN} bg-inverted text-inverted-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";
const HELP = "mt-1 text-xs text-muted-foreground";
const CARD = "rounded-xl border border-border bg-card p-4";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function ago(value, now = Date.now()) {
  if (!value) return null;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  const d = describeDuration(Math.max(0, now - at));
  return d ? `${d} ago` : null;
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "Holding 37 prospects — 12 untouched, 20 dialled, 5 worked · 12 open leads".
 *
 * The three-way split is the one the release controls act on: untouched is
 * what "Release untouched" gives back, dialled is what "Release all held"
 * adds, worked is what neither touches. Printing them apart is what makes the
 * two buttons' confirms readable as a difference rather than a guess.
 */
function queueSentence(q) {
  if (!q) return "Queue not counted.";
  if (q.held === 0 && q.openLeads === 0) return "Holding nothing. No open leads.";
  const parts = [];
  if (q.held > 0) {
    parts.push(
      `Holding ${plural(q.held, "prospect")} — ${q.untouched} untouched, ${q.dialled} dialled, ${q.worked} worked`,
    );
  }
  parts.push(plural(q.openLeads, "open lead"));
  return parts.join(" · ") + ".";
}

/**
 * What the presence rows say, in the three-tone discipline the floor board
 * uses: what was declared, and separately whether anybody has heard from them
 * since. `null` is "the call store is not on this build", which is a
 * different sentence from "offline".
 */
function presenceSentence(p) {
  if (!p) return { text: "Presence unavailable on this build.", tone: "muted" };
  if (!p.everSignedIn) return { text: "Never signed in to the sales portal.", tone: "muted" };
  if (!p.everSeen) {
    return {
      text: `Signed in, nothing declared — last opened the portal ${ago(p.portalSeenAt) || "at an unknown time"}.`,
      tone: "muted",
    };
  }
  if (p.state === "offline") {
    return { text: `Off${p.since ? ` since ${ago(p.since)}` : ""}.`, tone: "muted" };
  }
  const what = p.pauseLabel ? `${p.label} — ${p.pauseLabel}` : p.label;
  const forHow = p.since ? describeDuration(Math.max(0, Date.now() - new Date(p.since).getTime())) : null;
  if (p.stale) {
    return {
      text: `Says "${what}"${forHow ? ` for ${forHow}` : ""}, but nothing has been heard from their browser since ${ago(p.lastSeenAt) || "a while"} — stale. This is the disconnected-and-not-reconnected case.`,
      tone: "amber",
    };
  }
  return { text: `${what}${forHow ? ` for ${forHow}` : ""}.`, tone: "live" };
}

/**
 * "Standard closer plan — $125 per company", for the picker.
 *
 * The three amounts are summed rather than a stored total being trusted,
 * and a plan missing any of them prints its name alone instead of a confident
 * "$0.00" — the same rule the performance screen's money() follows, for the
 * same reason: on a screen about what FieldQuo owes people, a fabricated zero
 * and a real one look identical.
 */
function planOptionLabel(plan) {
  const parts = [plan.activationCents, plan.firstPaymentCents, plan.retentionCents];
  if (!parts.every((n) => typeof n === "number" && Number.isFinite(n))) return plan.name;
  const total = parts.reduce((a, b) => a + b, 0) / 100;
  const suffix = plan.active ? "" : " — no longer offered";
  return `${plan.name} — $${total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} per company${suffix}`;
}

const BLANK = {
  name: "",
  email: "",
  workEmail: "",
  code: "",
  codeTouched: false,
  // "" is "no plan", which is a real (and expensive) state rather than a
  // missing field — a rep without one earns nothing on every milestone and no
  // ledger row is written at all. The form says so instead of defaulting to
  // whichever plan happens to be first.
  commissionPlanId: "",
  // "" is "nobody has said" — a real state the Pay screen names, not a
  // missing field. Deliberately not defaulted to freelancer even though every
  // rep is one today: a default is what makes the first employee silently
  // wrong. See SalesRep.engagement in the schema.
  engagement: "",
};

export default function PlatformSalesRepsPage() {
  const [reps, setReps] = useState([]);
  const [salesNumber, setSalesNumber] = useState(null);
  const [numberCapabilities, setNumberCapabilities] = useState([]);
  const [plans, setPlans] = useState([]);
  const [draft, setDraft] = useState(null);
  const [mailboxDraft, setMailboxDraft] = useState({});
  const [planDraft, setPlanDraft] = useState({});
  const [engagementDraft, setEngagementDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [copied, setCopied] = useState("");
  // rep id → the answer of GET /reps/[id]/queue (presence, split, targets),
  // for the cards whose Queue… panel is open.
  const [queuePanel, setQueuePanel] = useState({});
  // rep id → the target picked in that card's Move picker.
  const [moveTarget, setMoveTarget] = useState({});
  // rep id → the deactivation panel: counts from the server, the chosen
  // hand-off, and the targets. Opened from Deactivate, or by the 409.
  const [deactivating, setDeactivating] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/platform/sales/reps");
      setReps(data.reps || []);
      setSalesNumber(data.salesNumber || null);
      setNumberCapabilities(data.numberCapabilities || []);
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const takenCodes = useMemo(() => reps.map((r) => r.code), [reps]);

  function clearBanners() {
    setError("");
    setNotice("");
    setWarning("");
  }

  /**
   * Retype the name, and the code follows — until somebody edits the code, at
   * which point it stops following. A field that silently overwrites what a
   * person typed is the same class of surprise as a control that does nothing.
   */
  function setName(name) {
    setDraft((d) => ({
      ...d,
      name,
      code: d.codeTouched ? d.code : (suggestCode(name, takenCodes) ?? ""),
    }));
  }

  const draftCodeProblem = draft ? codeProblem(draft.code) : null;
  const draftMailboxProblem = draft ? workEmailProblem(draft.workEmail, draft.email) : null;

  async function invite() {
    setBusy(true);
    clearBanners();
    try {
      const created = await fetchJson("/api/platform/sales/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          workEmail: draft.workEmail,
          code: draft.code,
          // "" would be a string the route has to interpret; null is the state
          // itself. resolvePlanAssignment treats both as "no plan", but sending
          // the state rather than the empty box is what keeps the two apart on
          // this side too.
          commissionPlanId: draft.commissionPlanId || null,
          engagement: draft.engagement || null,
        }),
      });
      setDraft(null);
      // The send outcome is reported separately from the row being created,
      // because they genuinely can differ — lib/email/teamInvite.js's header is
      // the story of an invite that looked sent from every angle except the
      // recipient's inbox. "Invited" over a refused send would be the same lie.
      if (created.invite?.sent) {
        setNotice(
          `Invitation sent to ${created.email}. Their signup link is ${created.signupLink}.`,
        );
      } else {
        setWarning(
          `${created.email} was added, but the invitation email didn't go out: ${created.invite?.error || "no reason given"} — use Resend invite once that's fixed.`,
        );
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadQueue(rep) {
    const data = await fetchJson(`/api/platform/sales/reps/${rep.id}/queue`);
    setQueuePanel((q) => ({ ...q, [rep.id]: data }));
    return data;
  }

  async function openQueue(rep) {
    if (queuePanel[rep.id]) {
      setQueuePanel((q) => {
        const next = { ...q };
        delete next[rep.id];
        return next;
      });
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await loadQueue(rep);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Give a rep's held prospects back to the pool. Same server function as the
   * rep's own "Release the rest" and the hourly cron; the only difference
   * between the two buttons is whether rows the rep dialled go too, and the
   * confirm says exactly that and nothing more — nothing is deleted, no
   * attempt or note is lost, the rows are simply claimable by somebody else.
   */
  async function releaseQueue(rep, scope) {
    const q = queuePanel[rep.id]?.queue || rep.queue;
    const all = scope === "release_all";
    const n = all ? q?.leased ?? 0 : q?.untouched ?? 0;
    if (n === 0) {
      setWarning(all ? `${rep.name} holds nothing on a lease.` : `${rep.name} has no untouched prospects.`);
      return;
    }
    const text = all
      ? `Release all ${plural(n, "prospect")} ${rep.name} holds back to the pool? The ${q.dialled} they dialled lose their place in ${rep.name}'s list — the call attempts and notes stay on the prospect. ${q.worked > 0 ? `The ${plural(q.worked, "worked prospect")} stay with them: a conversation is not a lease. ` : ""}Nothing is deleted.`
      : `Release the ${plural(n, "untouched prospect")} ${rep.name} holds back to the pool? The ${q.dialled} they dialled are kept. Nothing is deleted.`;
    if (!confirm(text)) return;
    setBusy(true);
    clearBanners();
    try {
      const res = await fetchJson(`/api/platform/sales/reps/${rep.id}/queue`, {
        method: "POST",
        body: { action: scope },
      });
      setNotice(
        `${plural(res.released, "prospect")} released from ${rep.name}'s queue${res.kept > 0 ? `; ${res.kept} kept` : ""}. They are claimable by any rep now.`,
      );
      await Promise.all([load(), loadQueue(rep)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function moveQueue(rep) {
    const panel = queuePanel[rep.id];
    const toRepId = moveTarget[rep.id] || "";
    const target = (panel?.targets || []).find((t) => t.id === toRepId);
    if (!target) {
      setError("Choose who the work moves to.");
      return;
    }
    const q = panel?.queue || rep.queue;
    if (
      !confirm(
        `Move ${plural(q?.held ?? 0, "held prospect")} and ${plural(q?.openLeads ?? 0, "open lead")} from ${rep.name} to ${target.name}${target.isMe ? " (you)" : ""}? Leases are re-issued to ${target.name} for 48 hours and dial after what they already hold. Companies ${rep.name} brought in stay credited to ${rep.name} — attributions and commission do not move, only the work in progress. Research already queued for these prospects carries on.`,
      )
    )
      return;
    setBusy(true);
    clearBanners();
    try {
      const res = await fetchJson(`/api/platform/sales/reps/${rep.id}/queue`, {
        method: "POST",
        body: { action: "reassign", toRepId },
      });
      setNotice(
        `${plural(res.prospects, "prospect")} (${res.leases} on a lease, ${res.worked} worked) and ${plural(res.leads, "open lead")} moved from ${rep.name} to ${target.name}.`,
      );
      setMoveTarget((m) => {
        const next = { ...m };
        delete next[rep.id];
        return next;
      });
      await Promise.all([load(), loadQueue(rep)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Open the deactivation panel for a rep who holds work, with the counts the
   * SERVER reported — from the list, or from the 409 the PATCH just returned,
   * which is the same shape. The panel needs the hand-off targets, so it
   * loads the queue answer too.
   */
  async function askHandoff(rep, counts) {
    setBusy(true);
    try {
      const panel = queuePanel[rep.id] || (await loadQueue(rep));
      setDeactivating((d) => ({
        ...d,
        [rep.id]: {
          counts,
          prospects: "release",
          toRepId: panel.me?.id || "",
          targets: panel.targets || [],
          me: panel.me || null,
          meNote: panel.meNote || "",
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(rep, active) {
    if (!active) {
      const q = rep.queue;
      if (q && (q.leased > 0 || q.openLeads > 0)) {
        clearBanners();
        await askHandoff(rep, { leased: q.leased, openLeads: q.openLeads, worked: q.worked });
        return;
      }
    }
    if (
      !confirm(
        active
          ? `Reactivate ${rep.email}?`
          : `Deactivate ${rep.email}? They'll be signed out of the sales portal on their next request. Their attributed companies and commission history stay exactly as they are.`,
      )
    )
      return;

    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      await load();
    } catch (err) {
      // The server counted fresh and found work the list did not know about
      // — a batch claimed since the page loaded. Same panel, its counts.
      if (err.status === 409 && err.data?.counts && !active) {
        await askHandoff(rep, err.data.counts);
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /** The one confirm: hand-off and deactivation, one request, one transaction. */
  async function confirmDeactivate(rep) {
    const d = deactivating[rep.id];
    if (!d) return;
    const target = d.targets.find((t) => t.id === d.toRepId) || null;
    const needsTarget = d.prospects === "move" || d.counts.openLeads > 0;
    if (needsTarget && !target) {
      setError(
        d.prospects === "move"
          ? "Choose who the work moves to."
          : "Open leads can only be moved, never released — choose who takes them.",
      );
      return;
    }
    const what =
      d.prospects === "move"
        ? `move ${plural(d.counts.leased + d.counts.worked, "held prospect")} and ${plural(d.counts.openLeads, "open lead")} to ${target.name}${target.isMe ? " (you)" : ""}`
        : `release ${plural(d.counts.leased, "leased prospect")} back to the pool${d.counts.openLeads > 0 ? ` and move ${plural(d.counts.openLeads, "open lead")} (with the prospects they sit on) to ${target.name}${target.isMe ? " (you)" : ""}` : ""}`;
    if (
      !confirm(
        `This will ${what}, then deactivate ${rep.email} — one transaction, so neither happens without the other. Companies ${rep.name} brought in stay credited to them; attributions and commission do not move. Nothing is deleted.`,
      )
    )
      return;
    setBusy(true);
    clearBanners();
    try {
      const res = await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        body: {
          active: false,
          handoff: { prospects: d.prospects, toRepId: needsTarget ? d.toRepId : null },
        },
      });
      const h = res.handoff || {};
      const moved = h.moved || null;
      setNotice(
        `${rep.name} deactivated. ${h.mode === "move" ? `${plural(moved?.prospects ?? 0, "prospect")} and ${plural(moved?.leads ?? 0, "open lead")} moved to ${target?.name || "the chosen rep"}.` : `${plural(h.released ?? 0, "prospect")} released to the pool${moved ? `; ${plural(moved.leads ?? 0, "open lead")} moved to ${target?.name || "the chosen rep"}` : ""}.`}`,
      );
      setDeactivating((all) => {
        const next = { ...all };
        delete next[rep.id];
        return next;
      });
      setQueuePanel((all) => {
        const next = { ...all };
        delete next[rep.id];
        return next;
      });
      await load();
    } catch (err) {
      if (err.status === 409 && err.data?.counts) {
        // Counts moved again under us. Keep the panel, refresh its numbers.
        setDeactivating((all) => ({ ...all, [rep.id]: { ...all[rep.id], counts: err.data.counts } }));
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMailbox(rep) {
    const value = mailboxDraft[rep.id] ?? "";
    const problem = workEmailProblem(value, rep.email);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workEmail: value }),
      });
      setMailboxDraft((d) => {
        const next = { ...d };
        delete next[rep.id];
        return next;
      });
      setNotice(
        value
          ? `${rep.name} now sends from ${value.trim().toLowerCase()}.`
          : `${rep.name}'s work mailbox was cleared. They can't send until another one is set.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Put a rep on a commission plan, or take them off one.
   *
   * The same draft-then-Save shape as the mailbox rather than a select that
   * saves on change: this field decides what somebody is paid, and a stray
   * click on a dropdown is not a decision.
   */
  async function saveEngagement(rep) {
    const value = engagementDraft[rep.id] ?? "";
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement: value || null }),
      });
      setEngagementDraft((d) => {
        const next = { ...d };
        delete next[rep.id];
        return next;
      });
      const chosen = ENGAGEMENTS.find((e) => e.key === value);
      setNotice(
        chosen
          ? `${rep.name} is recorded as ${chosen.label.toLowerCase()}. ${chosen.note}`
          : `${rep.name}'s engagement is back to "not decided" — their Pay screen will say so.`,
      );
      await load();
    } catch (err) {
      setError(err.message || "Could not save the engagement.");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(rep) {
    const value = planDraft[rep.id] ?? "";
    if (
      !value &&
      !confirm(
        `Leave ${rep.name} with no commission plan? They earn nothing — no ledger row is written at all for any milestone their companies reach, and there is no record afterwards that one should have been.`,
      )
    ) {
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPlanId: value || null }),
      });
      setPlanDraft((d) => {
        const next = { ...d };
        delete next[rep.id];
        return next;
      });
      const chosen = plans.find((p) => p.id === value);
      setNotice(
        chosen
          ? `${rep.name} is on ${chosen.name}. Milestones already earned keep the amounts they were written with.`
          : `${rep.name} now has no commission plan and earns nothing until one is assigned.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(rep) {
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}/invite`, { method: "POST" });
      setNotice(
        `A fresh invitation went to ${rep.email}. Any earlier link has stopped working.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Copy, and say whether it worked.
   *
   * navigator.clipboard is unavailable on an insecure origin and can be denied
   * by permission, so the failure is reported rather than swallowed — a Copy
   * button that silently does nothing is precisely the dead control this
   * codebase keeps being swept for. The link is also rendered in a selectable
   * read-only field beside it, so there is always a way to get it by hand.
   */
  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("This browser wouldn't let the page copy. Select the link and copy it by hand.");
    }
  }

  // Was a hand-rolled `fetchJson("/api/platform/me").catch(() => null)` whose
  // failure left `me` null — read here as "not a superadmin" and answered with
  // a refusal, shown to a superadmin, for a power they hold. The shared hook
  // keeps never-loaded apart from refused; see PlatformWriteGate's header.
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales reps</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            FieldQuo&apos;s own salespeople. A rep signs in at /sales and sees
            only the companies attributed to them — never a contractor&apos;s
            quotes, clients or revenue, and never anything they can write to.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            <Link href="/platform/sales/performance" className="underline">
              Sales performance
            </Link>{" "}
            has the signups, milestones, commission and leads.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setDraft({ ...BLANK })}
            className={BTN_PRIMARY}
          >
            <Plus size={14} /> Add rep
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Adding or editing a sales rep"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {warning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {warning}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300 break-words">
          {notice}
        </div>
      )}

      {/* ── Add a rep ──────────────────────────────────────────────────── */}
      {draft && (
        <div className={`${CARD} space-y-4`}>
          <h2 className="text-base font-semibold text-foreground">Invite a sales rep</h2>

          <div>
            <label htmlFor="rep-name" className={LABEL}>
              Name
            </label>
            <input
              id="rep-name"
              value={draft.name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="rep-email" className={LABEL}>
              Sign-in email
            </label>
            <input
              id="rep-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={FIELD}
            />
            <p className={HELP}>
              Where the invitation goes, and the address they sign in with. It
              can be a personal one — it is never used to send outreach.
            </p>
          </div>

          <div>
            <label htmlFor="rep-work-email" className={LABEL}>
              Work mailbox — optional now, required to send
            </label>
            <input
              id="rep-work-email"
              type="email"
              value={draft.workEmail}
              onChange={(e) => setDraft({ ...draft, workEmail: e.target.value })}
              placeholder="dana@fieldquo.com"
              className={FIELD}
            />
            <p className={HELP}>
              The mailbox their outreach is sent from and prospects&apos; replies
              come back to. You buy it separately and assign it here once it
              exists. Until it is set,{" "}
              <strong className="font-semibold">
                this rep cannot send a single email
              </strong>{" "}
              — the compose box in their portal refuses to render and says the
              same thing. It is deliberately not their sign-in address: a
              stranger&apos;s reply has to land somewhere they are happy to
              receive it.
            </p>
            {draftMailboxProblem ? (
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{draftMailboxProblem}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="rep-code" className={LABEL}>
              Attribution code
            </label>
            <input
              id="rep-code"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value, codeTouched: true })}
              className={FIELD}
            />
            <p className={HELP}>
              This is the whole of how a signup gets credited to them: their link
              is{" "}
              <span className="font-mono break-all">
                /signup?sales={draft.code || "…"}
              </span>
              , and a company that signs up through it is theirs. Generated from
              the name and already checked against the codes in use — change it
              if you have a reason, but it is fixed once the rep exists, because
              the link will be on a card by then.
            </p>
            {draftCodeProblem ? (
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{draftCodeProblem}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="rep-plan" className={LABEL}>
              Commission plan
            </label>
            <select
              id="rep-plan"
              value={draft.commissionPlanId}
              onChange={(e) => setDraft({ ...draft, commissionPlanId: e.target.value })}
              className={FIELD}
            >
              <option value="">No plan — earns nothing</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planOptionLabel(p)}
                </option>
              ))}
            </select>
            <p className={HELP}>
              What this rep is paid for a company they bring in, in three
              stages. Until a plan is assigned{" "}
              <strong className="font-semibold">
                every milestone earns them $0
              </strong>{" "}
              — the ledger writes no row at all, deliberately, because paying an
              invented figure is worse than paying late, and there is no record
              afterwards that one was missed. Set it up on{" "}
              <Link href="/platform/sales/plans" className="underline">
                commission plans
              </Link>
              .
            </p>
            {plans.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No commission plans exist yet, so there is nothing to assign.{" "}
                <Link href="/platform/sales/plans" className="underline">
                  Create one first
                </Link>{" "}
                — it takes a minute, and it is the difference between this rep
                earning $125 a sale and $0.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="rep-engagement" className={LABEL}>
              Freelancer or employee
            </label>
            <select
              id="rep-engagement"
              value={draft.engagement}
              onChange={(e) => setDraft({ ...draft, engagement: e.target.value })}
              className={FIELD}
            >
              <option value="">Not decided yet</option>
              {ENGAGEMENTS.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
            <p className={HELP}>
              Decides whether paid leave accrues and whether FieldQuo withholds
              anything. Until it is set, the rep&apos;s Pay screen says nobody has
              decided — it is never guessed from the payout method.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            They&apos;ll get an emailed link and choose their own password. The
            link works once and expires in seven days.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={invite}
              disabled={
                busy ||
                !draft.name.trim() ||
                !draft.email.trim() ||
                !draft.code.trim() ||
                Boolean(draftCodeProblem) ||
                Boolean(draftMailboxProblem)
              }
              className={BTN_PRIMARY}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Send invitation
            </button>
            <button onClick={() => setDraft(null)} className={BTN_QUIET}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Numbers: what can be assigned, and what cannot ─────────────── */}
      <section className={`${CARD} space-y-3`}>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Phone size={16} className="shrink-0" /> Phone numbers
        </h2>
        {salesNumber ? (
          <p className="text-sm text-muted-foreground">{salesNumber.detail}</p>
        ) : null}
        <ul className="space-y-3">
          {numberCapabilities.map((c) => (
            <li key={c.key} className="rounded-lg border border-border p-3">
              <div className="text-sm font-medium text-foreground">
                {c.label} — {c.available ? "available" : "not built"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
              {c.where ? (
                <Link href={c.where} className="mt-2 inline-block text-sm underline">
                  Open {c.where}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* ── The team ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : reps.length === 0 ? (
        <div className={`${CARD} text-center text-sm text-muted-foreground`}>
          No sales reps yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reps.map((rep) => {
            const editingMailbox = rep.id in mailboxDraft;
            return (
              <div key={rep.id} className={`${CARD} space-y-3`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-foreground">{rep.name}</div>
                    <div className="text-xs text-muted-foreground break-all">{rep.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!rep.active ? (
                      <span>Deactivated {formatDate(rep.endedAt)}</span>
                    ) : rep.acceptedAt ? (
                      <span>Active since {formatDate(rep.acceptedAt)}</span>
                    ) : (
                      <span>Invited {formatDate(rep.invitedAt)} — not accepted yet</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Code
                    </div>
                    <div className="font-mono text-foreground break-all">{rep.code}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Companies attributed
                    </div>
                    <div className="text-foreground">{rep.companyCount}</div>
                  </div>
                </div>

                {/* ── The queue ──────────────────────────────────────────
                    Counted by the same queueWhere() the rep's own screen
                    lists. The panel below is the owner's lever for a rep
                    who disconnected and did not reconnect. */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Queue
                      </div>
                      <div className="text-sm text-foreground">{queueSentence(rep.queue)}</div>
                      {rep.queue?.oldestClaimMs != null ? (
                        <div className="text-xs text-muted-foreground">
                          Oldest lease taken {describeDuration(rep.queue.oldestClaimMs)} ago.
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => openQueue(rep)}
                      disabled={busy}
                      className={BTN_QUIET}
                      aria-expanded={Boolean(queuePanel[rep.id])}
                    >
                      <ListChecks size={13} /> {queuePanel[rep.id] ? "Close" : "Queue…"}
                    </button>
                  </div>

                  {queuePanel[rep.id] ? (
                    <QueuePanel
                      rep={rep}
                      panel={queuePanel[rep.id]}
                      isSuperadmin={isSuperadmin}
                      busy={busy}
                      moveTarget={moveTarget[rep.id] || ""}
                      onPickTarget={(id) => setMoveTarget((m) => ({ ...m, [rep.id]: id }))}
                      onRelease={(scope) => releaseQueue(rep, scope)}
                      onMove={() => moveQueue(rep)}
                    />
                  ) : null}
                </div>

                {deactivating[rep.id] ? (
                  <DeactivatePanel
                    rep={rep}
                    state={deactivating[rep.id]}
                    busy={busy}
                    onChange={(patch) =>
                      setDeactivating((all) => ({ ...all, [rep.id]: { ...all[rep.id], ...patch } }))
                    }
                    onConfirm={() => confirmDeactivate(rep)}
                    onCancel={() =>
                      setDeactivating((all) => {
                        const next = { ...all };
                        delete next[rep.id];
                        return next;
                      })
                    }
                  />
                ) : null}

                <div>
                  <label htmlFor={`link-${rep.id}`} className={LABEL}>
                    Signup link
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`link-${rep.id}`}
                      readOnly
                      value={rep.signupLink || ""}
                      className={`${FIELD} flex-1 font-mono`}
                    />
                    <button
                      onClick={() => copy(rep.signupLink || "", rep.id)}
                      disabled={!rep.signupLink}
                      className={BTN_QUIET}
                    >
                      {copied === rep.id ? <Check size={14} /> : <Copy size={14} />}
                      {copied === rep.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className={HELP}>
                    A company that signs up through this link is credited to{" "}
                    {rep.name}, at signup, permanently.
                  </p>
                </div>

                <div>
                  <div className={LABEL}>Work mailbox</div>
                  {editingMailbox && isSuperadmin ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label={`Work mailbox for ${rep.name}`}
                        type="email"
                        value={mailboxDraft[rep.id]}
                        onChange={(e) =>
                          setMailboxDraft({ ...mailboxDraft, [rep.id]: e.target.value })
                        }
                        placeholder="dana@fieldquo.com"
                        className={`${FIELD} flex-1`}
                      />
                      <button
                        onClick={() => saveMailbox(rep)}
                        disabled={busy}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setMailboxDraft((d) => {
                            const next = { ...d };
                            delete next[rep.id];
                            return next;
                          })
                        }
                        className={BTN_QUIET}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground break-all">
                        {rep.workEmail || "Not assigned"}
                      </span>
                      {isSuperadmin ? (
                        <button
                          onClick={() =>
                            setMailboxDraft({ ...mailboxDraft, [rep.id]: rep.workEmail || "" })
                          }
                          className={BTN_QUIET}
                        >
                          <Mail size={13} /> {rep.workEmail ? "Change" : "Assign"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ── What they're paid ──────────────────────────────────
                    The row already SHOWED commissionPlan.name and had no way
                    to set it, which is the readable half of a column with no
                    writer: SalesCommissionPlan decides every figure in this
                    rep's ledger, and until this picker existed there was no
                    screen anywhere in the product that could fill it. */}
                <div>
                  <div className={LABEL}>Commission plan</div>
                  {rep.id in planDraft && isSuperadmin ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label={`Commission plan for ${rep.name}`}
                        value={planDraft[rep.id]}
                        onChange={(e) =>
                          setPlanDraft({ ...planDraft, [rep.id]: e.target.value })
                        }
                        className={`${FIELD} flex-1`}
                      >
                        <option value="">No plan — earns nothing</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {planOptionLabel(p)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => savePlan(rep)}
                        disabled={busy}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setPlanDraft((d) => {
                            const next = { ...d };
                            delete next[rep.id];
                            return next;
                          })
                        }
                        className={BTN_QUIET}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">
                        {rep.commissionPlan || "None — earns nothing"}
                      </span>
                      {isSuperadmin ? (
                        <button
                          onClick={() =>
                            setPlanDraft({
                              ...planDraft,
                              [rep.id]: rep.commissionPlanId || "",
                            })
                          }
                          className={BTN_QUIET}
                        >
                          <HandCoins size={13} />{" "}
                          {rep.commissionPlan ? "Change" : "Assign"}
                        </button>
                      ) : null}
                    </div>
                  )}
                  {!rep.commissionPlan ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      No ledger row is written for any milestone this rep&apos;s
                      companies reach. Assigning a plan starts recording from the
                      next milestone onwards — it does not backfill the ones that
                      passed while there was none.
                    </p>
                  ) : null}
                </div>
                <div>
                  <div className={LABEL}>Freelancer or employee</div>
                  {rep.id in engagementDraft && isSuperadmin ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label={`Engagement for ${rep.name}`}
                        value={engagementDraft[rep.id]}
                        onChange={(e) =>
                          setEngagementDraft({ ...engagementDraft, [rep.id]: e.target.value })
                        }
                        className={`${FIELD} flex-1`}
                      >
                        <option value="">Not decided yet</option>
                        {ENGAGEMENTS.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => saveEngagement(rep)}
                        disabled={busy}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setEngagementDraft((d) => {
                            const next = { ...d };
                            delete next[rep.id];
                            return next;
                          })
                        }
                        className={BTN_QUIET}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">
                        {ENGAGEMENTS.find((e) => e.key === rep.engagement)?.label ||
                          "Not decided yet"}
                      </span>
                      {isSuperadmin ? (
                        <button
                          onClick={() =>
                            setEngagementDraft({
                              ...engagementDraft,
                              [rep.id]: rep.engagement || "",
                            })
                          }
                          className={BTN_QUIET}
                        >
                          {rep.engagement ? "Change" : "Set"}
                        </button>
                      ) : null}
                    </div>
                  )}
                  {!rep.engagement ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Nobody has said whether this rep is a freelancer or an
                      employee. Their Pay screen shows this same sentence until
                      you set it here.
                    </p>
                  ) : null}
                </div>

                {/* The sending verdict, from the same function the rep's own
                    portal asks. Never a local guess: two opinions is how the
                    console reports a rep as ready while their compose box
                    refuses to render. */}
                {rep.sending?.canSend ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Can send outreach.
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Cannot send outreach yet.
                    </div>
                    {(rep.sending?.blockers || []).map((b) => (
                      <div key={b.code} className="text-sm text-amber-900 dark:text-amber-200">
                        <div className="font-medium">{b.title}</div>
                        <div className="text-xs">{b.fix}</div>
                      </div>
                    ))}
                  </div>
                )}

                {isSuperadmin && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Only rendered when it would actually work: the route
                        refuses a resend for a rep who has already set a
                        password, or one who is deactivated. */}
                    {rep.active && !rep.acceptedAt && (
                      <button onClick={() => resend(rep)} disabled={busy} className={BTN_QUIET}>
                        <Mail size={13} /> Resend invite
                      </button>
                    )}
                    <button
                      onClick={() => setActive(rep, !rep.active)}
                      disabled={busy}
                      className={BTN_QUIET}
                    >
                      {rep.active ? (
                        <>
                          <UserX size={13} /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} /> Reactivate
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-2xl">
        Reps are deactivated, never deleted — their attributions and commission
        ledger are the record of who brought which company in and what FieldQuo
        owed for it. The attribution code is fixed after creation for the same
        kind of reason: changing it would stop crediting every link already
        handed out, silently.
      </p>
    </div>
  );
}

/**
 * One rep's queue, opened: presence, the split, and the three controls.
 *
 * The controls render only for a superadmin, and only when they would do
 * something — a "Release untouched" over zero untouched rows is a button that
 * appears to work and doesn't.
 */
function QueuePanel({ rep, panel, isSuperadmin, busy, moveTarget, onPickTarget, onRelease, onMove }) {
  const q = panel.queue || {};
  const presence = presenceSentence(q.presence);
  const presenceClass =
    presence.tone === "live"
      ? "text-emerald-700 dark:text-emerald-300"
      : presence.tone === "amber"
        ? "text-amber-800 dark:text-amber-300"
        : "text-muted-foreground";
  const targets = panel.targets || [];
  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Presence</div>
          <div className={presenceClass}>{presence.text}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Held now</div>
          <div className="text-foreground">
            {plural(q.held ?? 0, "prospect")}: {q.untouched ?? 0} untouched, {q.dialled ?? 0} dialled since
            claiming, {q.worked ?? 0} worked.
          </div>
          <div className="text-foreground">{plural(q.openLeads ?? 0, "open lead")}.</div>
          {q.oldestClaimMs != null ? (
            <div className="text-xs text-muted-foreground">
              Oldest lease taken {describeDuration(q.oldestClaimMs)} ago; a lease lapses on its own after 48 hours.
            </div>
          ) : null}
        </div>
      </div>

      {isSuperadmin ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onRelease("release_untouched")}
              disabled={busy || !(q.untouched > 0)}
              className={BTN_QUIET}
            >
              Release untouched ({q.untouched ?? 0})
            </button>
            <button
              onClick={() => onRelease("release_all")}
              disabled={busy || !(q.leased > 0)}
              className={BTN_QUIET}
            >
              Release all held ({q.leased ?? 0})
            </button>
          </div>
          <p className={HELP}>
            Both put the rows back where any rep can claim them, through the same
            release the rep&apos;s own &quot;Release the rest&quot; and the hourly
            day-end sweep use. &quot;All held&quot; also gives back the rows they
            dialled — those lose their place in {rep.name}&apos;s list, nothing
            else. Worked rows are conversations, not leases, and stay.
          </p>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[12rem]">
              <label htmlFor={`move-${rep.id}`} className={LABEL}>
                Move to another rep…
              </label>
              <select
                id={`move-${rep.id}`}
                value={moveTarget}
                onChange={(e) => onPickTarget(e.target.value)}
                className={FIELD}
                disabled={busy || targets.length === 0}
              >
                <option value="">{targets.length === 0 ? "No other active rep" : "Choose a rep"}</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.isMe ? `Me — ${t.name}` : t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onMove}
              disabled={busy || !moveTarget || !((q.held ?? 0) > 0 || (q.openLeads ?? 0) > 0)}
              className={BTN_PRIMARY}
            >
              <ArrowRightLeft size={13} /> Move
            </button>
          </div>
          <p className={HELP}>
            Moves the held prospects (leases re-issued for 48 hours, dialled after
            what the other rep already holds) and the open leads. Companies{" "}
            {rep.name} brought in stay credited to {rep.name} — attributions and
            commission never move. {panel.meNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Daniel holds 37 prospects and 12 open leads. Release them, or move them
 * to: [picker] — then deactivate." One confirm does both, in one transaction.
 */
function DeactivatePanel({ rep, state, busy, onChange, onConfirm, onCancel }) {
  const { counts, targets } = state;
  const heldSentence = `${rep.name} holds ${plural(counts.leased, "leased prospect")}${counts.worked > 0 ? ` (and ${plural(counts.worked, "worked one")})` : ""} and ${plural(counts.openLeads, "open lead")}.`;
  const needsTarget = state.prospects === "move" || counts.openLeads > 0;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-3">
      <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {heldSentence} Release them, or move them — then deactivate.
      </div>

      <div className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`handoff-${rep.id}`}
            checked={state.prospects === "release"}
            onChange={() => onChange({ prospects: "release" })}
            className="mt-1"
          />
          <span>
            Release the {plural(counts.leased, "leased prospect")} back to the pool.
            {counts.openLeads > 0
              ? ` The ${plural(counts.openLeads, "open lead")} can only be moved — a lead has to have a rep — and the prospects they sit on go with them.`
              : ""}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`handoff-${rep.id}`}
            checked={state.prospects === "move"}
            onChange={() => onChange({ prospects: "move" })}
            className="mt-1"
          />
          <span>Move everything held, and the open leads, to another rep.</span>
        </label>
      </div>

      {needsTarget ? (
        <div>
          <label htmlFor={`handoff-to-${rep.id}`} className={LABEL}>
            {state.prospects === "move" ? "Move to" : "Move the open leads to"}
          </label>
          <select
            id={`handoff-to-${rep.id}`}
            value={state.toRepId}
            onChange={(e) => onChange({ toRepId: e.target.value })}
            className={FIELD}
            disabled={busy || targets.length === 0}
          >
            <option value="">{targets.length === 0 ? "No other active rep" : "Choose a rep"}</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.isMe ? `Me — ${t.name}` : t.name}
              </option>
            ))}
          </select>
          <p className={HELP}>{state.meNote}</p>
          {targets.length === 0 ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              There is no other active rep to move work to. Invite one, or reactivate
              one, before deactivating {rep.name}.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className={HELP}>
        Companies {rep.name} brought in stay credited to {rep.name}; attributions and
        commission do not move. Nothing is deleted. The hand-off and the deactivation
        are one transaction — neither happens without the other.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onConfirm}
          disabled={busy || (needsTarget && !state.toRepId)}
          className={BTN_PRIMARY}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          <UserX size={13} /> {state.prospects === "move" ? "Move, then deactivate" : "Release, then deactivate"}
        </button>
        <button onClick={onCancel} disabled={busy} className={BTN_QUIET}>
          Cancel
        </button>
      </div>
    </div>
  );
}
