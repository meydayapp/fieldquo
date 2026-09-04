// app/app/leads/page.js
//
// Inbound enquiries, before they're anyone's client — now triaged. Every lead
// arrives scored hot / warm / cold from what the homeowner told us (budget,
// timeline, urgency, effort), so the question "what's worth calling back first"
// has an answer on the card instead of in someone's head.
//
// Still a pipeline board (a lead is a thing that moves left to right), but each
// card opens a detail panel where the real work happens: see WHY it scored what
// it did, assign it, log a call-back, and — the part that used to be a dead
// link — convert it into a real draft quote that carries the client, category,
// photos and answers across.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Inbox,
  Mail,
  Phone,
  PhoneOff,
  Film,
  Paperclip,
  Search,
  X,
  Flame,
  FileText,
  Loader2,
  Upload,
  ArrowRight,
  GripVertical,
  AlertTriangle,
} from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import { countMediaKinds } from "@/lib/media/validate";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import PlanSvg from "@/app/components/kitchen/PlanSvg";
import { describeFinish } from "@/lib/kitchen/finishes";
import { LEAD_STATUSES, canSetLeadStatus, LOST_REASONS, isValidLostReason } from "@/lib/leads/pipeline";

const COLUMNS = [
  { key: "new", labelKey: "app.status.new", tone: "border-blue-200 dark:border-blue-900" },
  { key: "contacted", labelKey: "app.status.contacted", tone: "border-amber-200 dark:border-amber-900" },
  { key: "converted", labelKey: "app.leads.won", tone: "border-emerald-200 dark:border-emerald-900" },
  { key: "lost", labelKey: "app.status.lost", tone: "border-border" },
];

// The three bands and their colour. Measured tones that read on the muted card
// background in both themes — hot is the one that should catch the eye.
const TEMPS = {
  hot: {
    labelKey: "app.leads.hot",
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  warm: {
    labelKey: "app.leads.warm",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  cold: {
    labelKey: "app.leads.cold",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

const BUDGET_LABEL_KEY = {
  under_1k: "app.leads.budgetUnder1k",
  "1k_5k": "app.leads.budget1k5k",
  "5k_15k": "app.leads.budget5k15k",
  "15k_plus": "app.leads.budget15kPlus",
  unsure: "app.leads.budgetUnsure",
};
const TIMELINE_LABEL_KEY = {
  asap: "app.leads.tlAsap",
  "2_weeks": "app.leads.tl2Weeks",
  "1_3_months": "app.leads.tl13Months",
  exploring: "app.leads.tlExploring",
};

function initials(name) {
  return String(name || "")
    .replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function LeadsPage() {
  const { t } = useTranslation();
  // The bottom rung — GET /api/leads refuses below it. Leads ARE the requests
  // category; see lib/permissions/nav.js.
  const canView = useHasLevel("requests", "view_only");
  // null until the server answers — see lib/loadState.js. The board below
  // renders four columns whose headers are counts; on a refused load they all
  // read 0 and every column says "nothing here".
  const [leads, setLeads] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  // Filters / sort — server-side so the board reflects them exactly.
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState(""); // "" = all
  const [sort, setSort] = useState("score"); // hottest-first by default
  const [openId, setOpenId] = useState("");

  const load = useCallback(async () => {
    setErrorKey("");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (temp) params.set("temperature", temp);
    if (sort) params.set("sort", sort);
    const result = await fetchArray(`/api/leads?${params.toString()}`);
    if (result.aborted) return;
    if (result.ok) setLeads(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, [q, temp, sort]);

  useEffect(() => {
    if (!canView) return undefined;
    const id = setTimeout(load, q ? 250 : 0); // debounce typing
    return () => clearTimeout(id);
  }, [load, q, canView]);

  // `canView` was read in the body and missing from the deps, so the guard and
  // the re-run disagreed: the effect could only ever fire on mount, and would
  // never fetch the owner list again if the answer changed under it. Harmless
  // today because PermissionProvider resolves in the same render pass as the
  // page (it is server-rendered props, not a fetch) — and one refactor away
  // from a permanently empty "Owner" dropdown, which is a lead nobody can be
  // assigned to rather than a visible error.
  useEffect(() => {
    if (!canView) return;
    fetch("/api/leads/assignees")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAssignees)
      .catch(() => {});
  }, [canView]);

  const grouped = useMemo(() => {
    const out = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const lead of leads ?? []) (out[lead.status] || out.new).push(lead);
    return out;
  }, [leads]);

  // Replace one lead in place after a mutation (assign/status/convert/rescore).
  const patchLead = useCallback((updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
  }, []);

  const openLead = (leads ?? []).find((l) => l.id === openId) || null;

  const tempCounts = (leads ?? []).reduce((a, l) => {
    if (l.temperature) a[l.temperature] = (a[l.temperature] || 0) + 1;
    return a;
  }, {});

  // ── Drag-to-move ────────────────────────────────────────────────────────
  //
  // The permission gate that matters is server-side (PATCH /api/leads — see
  // its own comment on why). This is checked here too so a refused drag never
  // even reaches the network — the card's drag handle is simply not rendered
  // for someone who can't move a lead — but it is a courtesy, not the
  // control. The drawer's status buttons have never had a client-side check
  // and rely on the same server gate; this mirrors that rather than inventing
  // a second standard.
  const canEdit = useHasLevel("requests", "view_create_edit");

  // The lead mid-drag, by id — DragOverlay reads it for the floating preview
  // and canSetLeadStatus reads it to decide whether each column is a legal
  // drop target while the drag is in progress.
  const [activeId, setActiveId] = useState("");
  // ids with a PATCH in flight from a drag. A card stays non-draggable while
  // its own move is unresolved, so a second drag can't race the first one's
  // revert.
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [boardError, setBoardError] = useState("");
  // The lead awaiting a lost-reason pick, and the reason picked so far — a
  // drop onto Lost pauses HERE rather than moving the card and reverting it,
  // because canSetLeadStatus refuses the move without a reason anyway (see
  // lib/leads/pipeline.js), and asking before moving means there's nothing
  // to roll back if the person picking abandons the prompt.
  const [lostPromptLead, setLostPromptLead] = useState(null);
  const [lostReasonDraft, setLostReasonDraft] = useState("");

  // Two device-specific sensors rather than one PointerSensor: a distance
  // threshold that feels right for a mouse (8px) would make a touch scroll
  // down the board register as a drag pickup after a few pixels of finger
  // wobble. TouchSensor's own delay+tolerance gives a touch user a genuine
  // press-and-hold before anything lifts, so scrolling the stacked mobile
  // layout (AGENTS.md: "often run from a van", one-handed) stays a scroll.
  // KeyboardSensor is unrelated to either and is what makes the board
  // operable without a pointer at all.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const activeLead = (leads ?? []).find((l) => l.id === activeId) || null;

  function handleDragStart(event) {
    setBoardError("");
    setActiveId(event.active.id);
  }

  function handleDragCancel() {
    setActiveId("");
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId("");
    if (!over) return; // dropped outside every column — nothing to do

    const lead = (leads ?? []).find((l) => l.id === active.id);
    const targetStatus = over.id;
    if (!lead || lead.status === targetStatus) return;

    // A drop onto Lost needs a reason before it can move at all — ask first
    // rather than let canSetLeadStatus refuse it below every time, which
    // would read as a stuck card with no way to ever complete the drop.
    if (targetStatus === "lost" && !isValidLostReason(lead.lostReason)) {
      setLostReasonDraft("");
      setLostPromptLead(lead);
      return;
    }

    // THE TRAP: "Converted" is Won, and Won is not a thing a slide gesture
    // gets to declare — see lib/leads/pipeline.js. Refused here, before
    // anything moves, so there is nothing to revert and no request to send:
    // the card simply stays put and the reason is shown.
    const check = canSetLeadStatus(lead, targetStatus);
    if (!check.ok) {
      setBoardError(check.reason);
      return;
    }

    await moveLead(lead, targetStatus);
  }

  async function confirmLostPrompt() {
    if (!lostPromptLead || !isValidLostReason(lostReasonDraft)) return;
    const lead = lostPromptLead;
    const reason = lostReasonDraft;
    setLostPromptLead(null);
    setLostReasonDraft("");
    await moveLead(lead, "lost", reason);
  }

  // Optimistic move that ACTUALLY reverts. The reference Trello clone this
  // idea came from applied the drop locally and never rolled back on
  // failure — the card stayed where it was dropped while the server had
  // refused it, a control that appears to work and doesn't. Here the card
  // jumps immediately, and jumps back the moment the server disagrees.
  async function moveLead(lead, targetStatus, lostReason) {
    const prevStatus = lead.status;
    setPendingIds((prev) => new Set(prev).add(lead.id));
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: targetStatus } : l)),
    );
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          status: targetStatus,
          ...(targetStatus === "lost" && { lostReason }),
        }),
      });
      if (!res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: prevStatus } : l)),
        );
        await reportResponseError(res, setBoardError, t("app.leads.updateError"));
        return;
      }
      patchLead(await res.json());
    } catch {
      // Network failure — same revert, since the server never agreed either.
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: prevStatus } : l)),
      );
      setBoardError(t("app.leads.updateError"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  // Rendered INSTEAD of the screen, not around it: nothing loads, and the
  // panel names who to ask. A list that is empty because the server refused it
  // reads as "you have none", which is a different and untrue statement.
  if (!canView) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.leads.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.leads.subtitle")}</p>
        </div>
        <Link
          href="/app/leads/import"
          className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground shrink-0"
        >
          <Upload size={15} /> {t("app.leads.import")}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]" data-tour="leads-search">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("app.leads.search")}
            className="w-full border border-border rounded-full pl-9 pr-3 py-2 text-sm bg-card"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5" data-tour="leads-temp">
          {["", "hot", "warm", "cold"].map((k) => (
            <button
              key={k || "all"}
              onClick={() => setTemp(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                temp === k ? "bg-inverted text-inverted-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k ? t(TEMPS[k].labelKey) : t("app.leads.filterAll")}
              {k && tempCounts[k] ? ` ${tempCounts[k]}` : ""}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSort((s) => (s === "score" ? "recent" : "score"))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold text-foreground"
          title={t("app.leads.sortToggleHint")}
          data-tour="leads-sort"
        >
          <Flame size={13} className={sort === "score" ? "text-red-500" : "text-muted-foreground"} />
          {sort === "score" ? t("app.leads.sortHottest") : t("app.leads.sortNewest")}
        </button>
      </div>

      {boardError && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{boardError}</span>
          <button
            onClick={() => setBoardError("")}
            className="text-red-700 dark:text-red-300 hover:opacity-70 shrink-0"
            aria-label={t("app.action.close", "Close")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {lostPromptLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setLostPromptLead(null)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-foreground">
              {t("app.leads.lostReasonTitle", "Why is this lead lost?")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "app.leads.lostReasonBody",
                "Real inquiries and accidental clicks both used to land in the same bucket — this is what tells them apart later.",
              )}
            </p>
            <select
              autoFocus
              value={lostReasonDraft}
              onChange={(e) => setLostReasonDraft(e.target.value)}
              className="w-full border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
            >
              <option value="">{t("app.leads.lostReasonSelect", "Select a reason…")}</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`app.leads.lostReason.${r}`)}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLostPromptLead(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!isValidLostReason(lostReasonDraft)}
                onClick={confirmLostPrompt}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-inverted text-inverted-foreground disabled:opacity-40"
              >
                {t("app.leads.lostReasonConfirm", "Mark as lost")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={(leads ?? []).length === 0}
        skeleton={<div className="animate-pulse h-96 bg-accent rounded-xl" />}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Inbox size={30} className="text-muted-foreground mx-auto" />
            <p className="mt-3 font-medium text-foreground">
              {q || temp ? t("app.leads.noResults") : t("app.leads.empty")}
            </p>
            {!q && !temp && (
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {t("app.leads.emptyHint")}
              </p>
            )}
          </div>
        }
      >
        {/*
          Desktop/tablet: drag across the grid below. Phone (this same grid,
          reflowed to one column by the `md:`/`xl:` breakpoints, not a
          separate layout): the columns stack full-width instead of sitting
          side by side, so dragging a card past a tall stack to reach a column
          far down the page is exactly the two-thumbs, squint-at-a-small-
          target gesture AGENTS.md warns "someone working from a van" cannot
          be asked to do one-handed. Nothing here requires it — dnd-kit is
          still wired up (TouchSensor keeps it honestly usable if someone
          tries), but the drawer's status buttons are the primary path on a
          phone and are untouched by any of this.
        */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <LeadColumn
                key={col.key}
                col={col}
                leads={grouped[col.key]}
                onOpen={setOpenId}
                t={t}
                canEdit={canEdit}
                pendingIds={pendingIds}
                activeLead={activeLead}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <div className="rotate-2 shadow-lg">
                <LeadCard lead={activeLead} tone="border-border" onOpen={() => {}} t={t} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ListState>

      {openLead && (
        <LeadDrawer
          leadId={openLead.id}
          assignees={assignees}
          onClose={() => setOpenId("")}
          onPatched={patchLead}
          t={t}
        />
      )}
    </div>
  );
}

function TempBadge({ temperature, score, t, size = "sm" }) {
  if (!temperature) return null;
  const cfg = TEMPS[temperature] || TEMPS.cold;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${cfg.chip} ${
        size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {t(cfg.labelKey)}
      {typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

// One droppable column. Highlights while something is dragged over it —
// green if this drop is legal, red (and the cursor tells the same story) if
// it isn't, so the refusal is visible from the moment the card crosses the
// boundary rather than only after it's released.
function LeadColumn({ col, leads, onOpen, t, canEdit, pendingIds, activeLead }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  // "Lost" always shows as a legal drop target during the drag itself — the
  // reason canSetLeadStatus would refuse it for (no lostReason yet) is
  // collected AFTER the drop, in handleDragEnd's prompt, not before. Ringing
  // this column red while dragging would read as "you can never drop a lead
  // here", which isn't true.
  const dropCheck =
    activeLead && col.key !== "lost" ? canSetLeadStatus(activeLead, col.key) : { ok: true };
  const showInvalid = isOver && activeLead && activeLead.status !== col.key && !dropCheck.ok;
  const showValid = isOver && activeLead && activeLead.status !== col.key && dropCheck.ok;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">{t(col.labelKey)}</h2>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[3rem] rounded-xl transition-colors ${
          showInvalid
            ? "ring-2 ring-red-400 dark:ring-red-800 bg-red-50/40 dark:bg-red-950/20"
            : showValid
              ? "ring-2 ring-emerald-400 dark:ring-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10"
              : ""
        }`}
      >
        {leads.length === 0 && (
          <div className="border border-dashed border-border rounded-xl px-4 py-6 text-center text-xs text-muted-foreground">
            {t("app.leads.nothingHere")}
          </div>
        )}
        {leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            tone={col.tone}
            onOpen={() => onOpen(lead.id)}
            t={t}
            disabled={!canEdit || pendingIds.has(lead.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Wraps a card as a dnd-kit draggable. The drag handle is its OWN small
// button rather than the whole card, and deliberately not wired to
// `onClick`/`onOpen` at all — dnd-kit's KeyboardSensor activates a drag on
// Space/Enter, the same keys a plain <button> uses to fire a click, and one
// element trying to be both would mean a keyboard user could never reliably
// open the drawer. Mouse and touch can still pick the card up from anywhere
// on the handle; the rest of the card stays a normal click target.
function DraggableLeadCard({ lead, tone, onOpen, t, disabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled,
  });
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-40" : ""}>
      <LeadCard
        lead={lead}
        tone={tone}
        onOpen={onOpen}
        t={t}
        dragHandle={
          disabled
            ? null
            : { attributes, listeners, ref: setActivatorNodeRef }
        }
      />
    </div>
  );
}

function LeadCard({ lead, tone, onOpen, t, dragHandle }) {
  const budgetKey = BUDGET_LABEL_KEY[lead.budgetBand];
  const timelineKey = TIMELINE_LABEL_KEY[lead.timeline];
  // Counted by kind, not by array length. The badge next to a film icon used to
  // be `clientPhotos.length`, which was fine while the array could only hold
  // photos and clips — now that a client can attach a PDF plan, that same number
  // would file the plan under "video". The plan is also the more interesting of
  // the two signals, so it gets its own badge rather than being folded in.
  const { visual: photoCount, documents: docCount } = countMediaKinds(lead.clientPhotos);
  return (
    <div className={`relative bg-card border rounded-xl ${tone} hover:shadow-sm transition-shadow`}>
      {dragHandle && (
        <button
          type="button"
          ref={dragHandle.ref}
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="absolute right-1.5 top-1.5 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing touch-none"
          aria-label={t("app.leads.dragHandle", "Drag to move")}
          title={t("app.leads.dragHandle", "Drag to move")}
        >
          <GripVertical size={14} />
        </button>
      )}
      <button onClick={onOpen} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-2 pr-6">
          <span className="font-medium text-foreground">{lead.name}</span>
          <TempBadge temperature={lead.temperature} score={lead.score} t={t} />
        </div>

        {(budgetKey || timelineKey) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {timelineKey && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {t(timelineKey)}
              </span>
            )}
            {budgetKey && lead.budgetBand !== "unsure" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {t(budgetKey)}
              </span>
            )}
          </div>
        )}

        {lead.category?.label && (
          <div className="mt-2 text-xs text-muted-foreground">{lead.category.label}</div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            {lead.doNotCall && (
              <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
                <PhoneOff size={11} /> {t("app.leads.doNotCall")}
              </span>
            )}
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Film size={11} aria-hidden="true" /> {photoCount}
                <span className="sr-only">{t("app.leads.mediaCountLabel")}</span>
              </span>
            )}
            {docCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Paperclip size={11} aria-hidden="true" /> {docCount}
                <span className="sr-only">{t("app.leads.planCountLabel")}</span>
              </span>
            )}
            {lead.quote && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <FileText size={11} /> {lead.quote.quoteNumber}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {lead.assignedTo?.name && (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-inverted text-inverted-foreground text-[8px] font-bold"
                title={lead.assignedTo.name}
              >
                {initials(lead.assignedTo.name)}
              </span>
            )}
            {new Date(lead.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
          </span>
        </div>
      </button>
    </div>
  );
}

function LeadDrawer({ leadId, assignees, onClose, onPatched, t }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [busy, setBusy] = useState(false);
  // Same reason-before-move shape as the board's drag prompt above — a click
  // on "Lost" pauses here instead of patching straight through, unless the
  // lead already carries a valid reason (re-clicking the button it's already
  // on is a no-op, not a re-prompt).
  const [showLostPrompt, setShowLostPrompt] = useState(false);
  const [lostReasonDraft, setLostReasonDraft] = useState("");

  // `if (res.ok)` with no else, and the failure was invisible rather than
  // wrong: `loading` went false with `lead` still null, and the render below
  // reads `loading || !lead`, so a refused or 500'd lead left the drawer
  // pulsing its skeleton for as long as somebody was willing to watch it.
  // Nothing said the request had failed and nothing offered a retry.
  const reload = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) return reportResponseError(res, setErr, t("app.leads.loadError"));
      setLead(await res.json());
    } catch {
      setErr(t("app.leads.loadError"));
    } finally {
      setLoading(false);
    }
  }, [leadId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patch(body) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return reportResponseError(res, setErr, t("app.leads.updateError"));
      const updated = await res.json();
      setLead((prev) => ({ ...prev, ...updated }));
      onPatched(updated);
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    setErr("");
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteText.trim() }),
      });
      if (!res.ok) return reportResponseError(res, setErr, t("app.leads.noteError"));
      const note = await res.json();
      setLead((prev) => ({ ...prev, notes: [note, ...(prev.notes || [])] }));
      setNoteText("");
    } finally {
      setSavingNote(false);
    }
  }

  async function convert() {
    setConverting(true);
    setErr("");
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
      if (!res.ok) return reportResponseError(res, setErr, t("app.leads.convertError"));
      const d = await res.json();
      // Land the estimator straight in the new draft, ready to price.
      window.location.href = `/app/quotes/${d.quoteId}/edit`;
    } finally {
      setConverting(false);
    }
  }

  const intakeEntries =
    lead?.intake && typeof lead.intake === "object"
      ? Object.entries(lead.intake).filter(
          ([k, v]) => k !== "address" && v !== "" && v != null && v !== false,
        )
      : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{t("app.leads.detail")}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-6 bg-accent rounded w-1/2" />
            <div className="h-24 bg-accent rounded" />
          </div>
        ) : !lead ? (
          // Three states, not two. "Still loading" and "the server refused
          // this" used to share the skeleton, so a failed request was
          // indistinguishable from a slow one and stayed that way forever.
          <div className="p-6 space-y-3">
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{err || t("app.leads.loadError")}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                reload();
              }}
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground"
            >
              {t("app.action.retry")}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {err && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {err}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">{lead.name}</h2>
                <TempBadge temperature={lead.temperature} score={lead.score} t={t} size="lg" />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(lead.createdAt).toLocaleString()}
                {lead.source && ` · ${lead.source}`}
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-1.5 text-sm">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-foreground hover:underline break-all">
                  <Mail size={14} className="shrink-0 text-muted-foreground" />
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-foreground hover:underline">
                    <Phone size={14} className="shrink-0 text-muted-foreground" />
                    {lead.phone}
                  </a>
                  {lead.doNotCall && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-400 font-semibold">
                      <PhoneOff size={11} /> {t("app.leads.doNotCall")}
                    </span>
                  )}
                </div>
              )}
              {lead.intake?.address && (
                <div className="text-muted-foreground">{lead.intake.address}</div>
              )}
              {/* Said, not left as a gap.
                  GET /api/leads removes the email, the phone and the stated
                  budget for a member on clientsProperties "name_address_only"
                  and marks the lead `restricted`. Without this the block simply
                  renders empty, which reads as an enquiry that arrived with no
                  way to answer it — and sends somebody looking for a contact
                  the company already has. */}
              {lead.restricted && (
                <div className="text-muted-foreground italic text-xs">
                  {t("app.access.restricted", "Hidden by your access level")}
                </div>
              )}
            </div>

            {/* Why this score */}
            {Array.isArray(lead.scoreReasons) && lead.scoreReasons.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-foreground mb-2">{t("app.leads.whyScore")}</div>
                <ul className="space-y-1">
                  {lead.scoreReasons.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.label}</span>
                      {r.weight > 0 && <span className="text-foreground font-medium">+{r.weight}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Qualifiers — editable, re-scores on change.
                The BUDGET half is withheld from a restricted member, and a
                <select> whose value resolves to "" would show "Not stated" —
                claiming this household never said what it could spend, when it
                said 15k+. That is the same false absence the job page printed
                as "Not set". So the pair collapses to the timeline alone and
                the reason is said once. */}
            <div className={lead.restricted ? "" : "grid grid-cols-2 gap-3"}>
              <label className="text-xs">
                <span className="text-muted-foreground">{t("app.leads.timeline")}</span>
                <select
                  value={lead.timeline || ""}
                  disabled={busy}
                  onChange={(e) => patch({ timeline: e.target.value })}
                  className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                >
                  <option value="">{t("app.leads.notStated")}</option>
                  {Object.entries(TIMELINE_LABEL_KEY).map(([k, key]) => (
                    <option key={k} value={k}>{t(key)}</option>
                  ))}
                </select>
              </label>
              {!lead.restricted && (
                <label className="text-xs">
                  <span className="text-muted-foreground">{t("app.leads.budget")}</span>
                  <select
                    value={lead.budgetBand || ""}
                    disabled={busy}
                    onChange={(e) => patch({ budgetBand: e.target.value })}
                    className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                  >
                    <option value="">{t("app.leads.notStated")}</option>
                    {Object.entries(BUDGET_LABEL_KEY).map(([k, key]) => (
                      <option key={k} value={k}>{t(key)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Their message */}
            {lead.message && (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">{t("app.leads.messageLabel")}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.message}</p>
              </div>
            )}

            {/* Structured intake */}
            {intakeEntries.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">{t("app.leads.details")}</div>
                <dl className="text-xs">
                  {intakeEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-0.5 border-b border-border/50">
                      <dt className="text-muted-foreground capitalize">{k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}</dt>
                      <dd className="text-foreground text-right">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Photos */}
            {Array.isArray(lead.clientPhotos) && lead.clientPhotos.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">{t("app.leads.photos")}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {lead.clientPhotos.map((m, i) => (
                    <ClientMediaTile
                      key={(typeof m === "string" ? m : m?.url) + i}
                      media={m}
                      variant="thumb"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Kitchen they drew */}
            {lead.kitchenDesign?.elements?.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <PlanSvg design={lead.kitchenDesign} showScale={false} />
                <p className="px-2 py-1.5 text-[11px] text-neutral-600 border-t border-border">
                  {describeFinish(lead.kitchenDesign.finish)}
                </p>
              </div>
            )}

            {/* Owner */}
            <label className="block text-xs">
              <span className="text-muted-foreground">{t("app.leads.owner")}</span>
              <select
                value={lead.assignedTo?.id || ""}
                disabled={busy}
                onChange={(e) => patch({ assignedToId: e.target.value || null })}
                className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
              >
                <option value="">{t("app.leads.unassigned")}</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

            {/* Status */}
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("app.leads.status")}</div>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STATUSES.map((s) => {
                  const isLostButton = s === "lost";
                  // "Lost" is never shown blocked here — a click opens the
                  // reason prompt below instead of the button disabling
                  // itself over a rule the prompt exists to satisfy. Every
                  // other status keeps the same refuse-and-explain rule the
                  // drag board uses — see lib/leads/pipeline.js.
                  const statusCheck = isLostButton ? { ok: true } : canSetLeadStatus(lead, s);
                  const blocked = lead.status !== s && !statusCheck.ok;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (isLostButton && lead.status !== "lost") {
                          setLostReasonDraft("");
                          setShowLostPrompt(true);
                          return;
                        }
                        patch({ status: s });
                      }}
                      disabled={busy || lead.status === s || blocked}
                      title={blocked ? statusCheck.reason : undefined}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        lead.status === s
                          ? "bg-inverted text-inverted-foreground border-transparent"
                          : blocked
                            ? "border-border text-muted-foreground/50 cursor-not-allowed"
                            : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t(s === "converted" ? "app.leads.won" : `app.status.${s}`)}
                    </button>
                  );
                })}
              </div>
              {lead.status !== "converted" && !canSetLeadStatus(lead, "converted").ok && (
                <p className="mt-1.5 text-[11px] text-muted-foreground italic">
                  {t("app.leads.wonNeedsQuote", "Won follows the quote's own outcome — convert this lead first.")}
                </p>
              )}
              {lead.status === "lost" && lead.lostReason && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t("app.leads.lostReasonShown", "Reason:")}{" "}
                  {t(`app.leads.lostReason.${lead.lostReason}`)}
                </p>
              )}
              {showLostPrompt && (
                <div className="mt-2 p-3 border border-border rounded-lg bg-muted/40 space-y-2">
                  <div className="text-xs font-medium text-foreground">
                    {t("app.leads.lostReasonTitle", "Why is this lead lost?")}
                  </div>
                  <select
                    autoFocus
                    value={lostReasonDraft}
                    onChange={(e) => setLostReasonDraft(e.target.value)}
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                  >
                    <option value="">{t("app.leads.lostReasonSelect", "Select a reason…")}</option>
                    {LOST_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t(`app.leads.lostReason.${r}`)}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLostPrompt(false)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {t("app.action.cancel", "Cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={!isValidLostReason(lostReasonDraft) || busy}
                      onClick={async () => {
                        await patch({ status: "lost", lostReason: lostReasonDraft });
                        setShowLostPrompt(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-inverted text-inverted-foreground disabled:opacity-40"
                    >
                      {t("app.leads.lostReasonConfirm", "Mark as lost")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Convert / view quote */}
            {lead.quote ? (
              <Link
                href={`/app/quotes/${lead.quote.id}`}
                className="flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold py-2.5 rounded-lg"
              >
                <FileText size={15} /> {t("app.leads.viewQuote")} {lead.quote.quoteNumber}
              </Link>
            ) : (
              <button
                onClick={convert}
                disabled={converting}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60"
              >
                {converting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {converting ? t("app.leads.converting") : t("app.leads.convert")}
              </button>
            )}

            {/* Notes */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-1.5">{t("app.leads.notes")}</div>
              <form onSubmit={addNote} className="flex gap-2 mb-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t("app.leads.addNote")}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  className="px-3 py-2 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {savingNote ? <Loader2 size={13} className="animate-spin" /> : t("app.leads.saveNote")}
                </button>
              </form>
              {(lead.notes || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.leads.noNotes")}</p>
              ) : (
                <ul className="space-y-2">
                  {lead.notes.map((n) => (
                    <li key={n.id} className="text-xs border-l-2 border-border pl-2.5">
                      <p className="text-foreground whitespace-pre-wrap">{n.body}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {n.author?.name || t("app.leads.someone")} ·{" "}
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
