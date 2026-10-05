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
  PhoneCall,
  PhoneOff,
  Film,
  Paperclip,
  Search,
  X,
  Flame,
  FileText,
  Loader2,
  Upload,
  GripVertical,
  AlertTriangle,
  Trash2,
  MapPinOff,
  BarChart3,
  Megaphone,
  MoreHorizontal,
  CheckSquare,
  CalendarClock,
  ListChecks,
} from "lucide-react";
import LeadDeleteDialog from "@/app/components/leads/LeadDeleteDialog";
import QualificationControl, { TierChip, scopeCountsText } from "@/app/components/leads/QualificationControl";
import ConversationReviewDialog from "@/app/components/leads/ConversationReviewDialog";
import ActionMenu from "@/app/components/mobile/ActionMenu";
import { describeAttribution, sourceName } from "@/lib/tracking/describe";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel, usePermissions } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import StreetViewPeek from "@/app/components/StreetViewPeek";
import { countMediaKinds } from "@/lib/media/validate";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import PlanSvg from "@/app/components/kitchen/PlanSvg";
import { describeFinish } from "@/lib/kitchen/finishes";
import { LEAD_STATUSES, canSetLeadStatus, LOST_REASONS, isValidLostReason } from "@/lib/leads/pipeline";
import {
  leadAddressLine,
  leadIntakeDetails,
  formatIntakeValue,
  humaniseKey,
} from "@/lib/leads/intakeShape";
import { wasAsked } from "@/lib/leads/qualifiers";
import { leadSourceLabel } from "@/lib/leads/sourceLabel";
import { serviceAreaCopy } from "@/lib/company/serviceArea";
import { tradeQuestionCopy, whenNeededLabel } from "@/lib/leads/tradeQuestions";
import { summarisePotential } from "@/lib/leads/potentialValue";
import BridgeCallButton from "@/app/components/calls/BridgeCallButton";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import {
  LinkedDocuments,
  QuoteLinkPicker,
  WonBlockedNote,
  wonReasonText,
} from "@/app/components/leads/LeadLinkedDocuments";

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

// ── What the public flows put in `intake` and how it reads on the board ────
//
// The booking page and the instant estimate store three things beside the
// funnel's own answers (lib/leads/tradeQuestions.js, lib/company/serviceArea.js):
//
//   whenNeeded          the ladder option actually tapped ("within_month"),
//                       finer than the scorer's `timeline` it was folded to
//   activeLeak, scope…  the trade's one or two questions, by key
//   outsideServiceArea  true when the address fell outside the company's area
//
// All three are keys, not sentences, so the generic "humanise the key" row
// would print "active leak: yes" at staff. They are rendered through the same
// copy tables the homeowner saw the question in, in the STAFF's language —
// "Active leak: Yes" — and the area flag is a badge, not a row.
const TRADE_ANSWER_KEYS = new Set(Object.keys(tradeQuestionCopy("en").questions));
const INTAKE_KEYS_HANDLED_ELSEWHERE = new Set(["outsideServiceArea"]);

/** "Within a month" — the tapped option, or null when the intake carries none. */
function whenNeededOf(lead, language) {
  const key = lead?.intake?.whenNeeded;
  return typeof key === "string" ? whenNeededLabel(key, language) : null;
}

/**
 * The label and value for one intake row, or null to drop the row. Trade
 * answers and the timeline resolve through their copy tables; anything else
 * falls back to the generic humanised key.
 */
function intakeRow([key, value], language) {
  if (INTAKE_KEYS_HANDLED_ELSEWHERE.has(key)) return null;
  const copy = tradeQuestionCopy(language);
  if (key === "whenNeeded") {
    const label = whenNeededLabel(value, language);
    return label ? { label: copy.whenLabel, value: label, raw: false } : null;
  }
  if (TRADE_ANSWER_KEYS.has(key)) {
    // The question with its trailing "?" (and French's space before it)
    // removed reads as a label — the same trim tradeAnswerLines applies to
    // the quote's notes, so the board and the quote say the same thing.
    const label = (copy.questions[key] || key).replace(/\s* ?[?¿]+\s*$/u, "").replace(/^¿/, "");
    const shown = typeof value === "string" ? copy.options[value] || formatIntakeValue(value) : formatIntakeValue(value);
    return { label, value: shown, raw: false };
  }
  return { label: humaniseKey(key), value: formatIntakeValue(value), raw: true };
}

/** "Outside usual service area" — the flag the public flow set on the lead. */
function OutsideAreaBadge({ language, size = "sm" }) {
  const text = serviceAreaCopy(language).outsideBadge;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium ${
        size === "lg" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5"
      }`}
    >
      <MapPinOff size={size === "lg" ? 13 : 11} aria-hidden="true" />
      {text}
    </span>
  );
}

function initials(name) {
  return String(name || "")
    .replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// The route's export. A real mount passes nothing and gets the board below,
// unchanged. `sample` ({ leads, assignees }) is set only by the marketing
// walk-through on /industries/roofing (app/(marketing)/industries/[slug]/
// showcase/), following QuoteApproval's `sample` (commit da656e6d): the
// card and the drawer a contractor uses, fed a lead instead of fetching one.
// A wrapper rather than a branch inside LeadsPage, because the board's hooks
// cannot be skipped conditionally; LeadCard and LeadDrawer stay where they
// are, since a page module may only export its default.
export default function LeadsRoute({ sample = null } = {}) {
  return sample ? <LeadsSample sample={sample} /> : <LeadsPage />;
}

// The "New" column as the board draws it, with no board around it: no
// DndContext (a drag would be a PATCH), no search, filters or sort (they are
// server queries), no links into the app. What is left is what the showcase
// is for — the card, and the drawer it opens. Status and owner changes made
// in the drawer land on the card, the way the board's patchLead does, and go
// nowhere else.
function LeadsSample({ sample }) {
  const { t } = useTranslation();
  // Named apart from the board's `leads` below: the showcase always passes
  // its rows, and check:empty-vs-error governs the board's own list state.
  const [rows, setSampleLeads] = useState(() => (Array.isArray(sample.leads) ? sample.leads : []));
  const [openId, setOpenId] = useState("");
  const col = COLUMNS[0];
  const openLead = rows.find((l) => l.id === openId) || null;
  const patchLead = (updated) =>
    setSampleLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">{t(col.labelKey)}</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <div className="space-y-3">
        {rows.map((lead) => (
          <LeadCard key={lead.id} lead={lead} tone={col.tone} onOpen={() => setOpenId(lead.id)} t={t} dragHandle={null} />
        ))}
      </div>
      {openLead && (
        <LeadDrawer
          leadId={openLead.id}
          assignees={Array.isArray(sample.assignees) ? sample.assignees : []}
          onClose={() => setOpenId("")}
          onPatched={patchLead}
          t={t}
          sample={openLead}
        />
      )}
    </div>
  );
}

function LeadsPage() {
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
  // ?lead=<id> — how a Page / Instagram conversation's "Open lead" lands on
  // the lead it is linked to rather than on the board. Read from the
  // location rather than useSearchParams (which would need a Suspense
  // boundary for one string); the drawer opens only once the lead is in
  // the loaded list, so a stale or foreign id opens nothing, and the first
  // paint is the same on the server and the client.
  const [openId, setOpenId] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lead") || "" : "",
  );
  // …and read again once mounted. The initializer alone only works on a full
  // page load: on a client-side router.push the new page renders BEFORE Next
  // commits the URL, so it reads the page being left. Measured in a harness
  // (2026-09-25): initializer "(empty)", this effect "abc123", for the same
  // push. That is the path /app/leads/new takes after a save — the new lead's
  // drawer would silently not open — and any in-app "Open lead" Link.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lead");
    if (fromUrl) setOpenId(fromUrl);
  }, []);

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

  // "Quoted" (2026-10-05): only leads with a quote — linked, or a confirmed
  // match the API found (lead.quoted). In the browser, because the inferred
  // half is computed per load and is not a column a query could filter on.
  const [quotedOnly, setQuotedOnly] = useState(false);
  const quotedCount = (leads ?? []).filter((l) => l.quoted).length;
  const shown = useMemo(() => (quotedOnly ? (leads ?? []).filter((l) => l.quoted) : leads ?? []), [leads, quotedOnly]);

  // "Review leads made from conversations" — owner and admin, and the delete
  // rung (the server asks both; lib/leads/conversationReview.js).
  const perms = usePermissions();
  const deleteRung = useHasLevel("requests", "view_create_edit_delete");
  const canReview = (perms?.role === "owner" || perms?.role === "admin") && deleteRung;
  const [reviewOpen, setReviewOpen] = useState(false);

  const grouped = useMemo(() => {
    const out = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const lead of shown) (out[lead.status] || out.new).push(lead);
    return out;
  }, [shown]);

  // Replace one lead in place after a mutation (assign/status/convert/rescore).
  const patchLead = useCallback((updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
  }, []);

  const openLead = (leads ?? []).find((l) => l.id === openId) || null;

  const tempCounts = (leads ?? []).reduce((a, l) => {
    if (l.temperature) a[l.temperature] = (a[l.temperature] || 0) + 1;
    return a;
  }, {});

  // ── What the board is worth ─────────────────────────────────────────────
  //
  // `potential` is attached per lead by GET /api/leads, and only for a member
  // whose pricing toggle is on — a payload with no `potential` on any lead is
  // a member who may not see money, and the strip stays off rather than
  // summing a column of nulls into a confident "$0". The sums themselves are
  // lib/leads/potentialValue.js, which also says why nothing is weighted.
  const money = useCompanyMoney();
  const showsMoney = (leads ?? []).some((l) => l.potential !== undefined);
  const potential = useMemo(() => summarisePotential(leads ?? []), [leads]);

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

  // ── Delete (owner, 2026-10-05) ──────────────────────────────────────────
  //
  // The top rung of the requests dial — the same one DELETE /api/leads and
  // /api/leads/[id] ask (lib/leads/deleteLead.js). Below it nothing about
  // deleting is drawn: no ⋯ menu, no Select, no button in the panel. The
  // server refuses regardless; this keeps the screen from offering it.
  const canDelete = useHasLevel("requests", "view_create_edit_delete");
  // The leads the confirm is about — one from a card or the panel, or the
  // selection. Empty = the dialog is closed.
  const [deleteTargets, setDeleteTargets] = useState([]);
  // Selection mode: the board's cards become checkboxes. Off by default so a
  // tap on a card still opens it, which is what the board is for.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };
  // Only what the server confirmed is removed from the board — never the
  // selection as sent, which may have held an id that was already gone.
  const onLeadsDeleted = (ids) => {
    const gone = new Set(ids);
    setLeads((prev) => (prev ?? []).filter((l) => !gone.has(l.id)));
    setSelectedIds((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    if (gone.has(openId)) setOpenId("");
    setDeleteTargets([]);
    if (ids.length > 1) setSelecting(false);
  };
  const selectedLeads = (leads ?? []).filter((l) => selectedIds.has(l.id));

  // The lead mid-drag, by id — DragOverlay reads it for the floating preview
  // and canSetLeadStatus reads it to decide whether each column is a legal
  // drop target while the drag is in progress.
  const [activeId, setActiveId] = useState("");
  // ids with a PATCH in flight from a drag. A card stays non-draggable while
  // its own move is unresolved, so a second drag can't race the first one's
  // revert.
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [boardError, setBoardError] = useState("");
  // The lead a refused Won drop was about. The drawer is where the fix lives
  // (link the quote that won it), so the banner offers to open it rather than
  // leaving the refusal as a dead end on the board.
  const [wonFixLeadId, setWonFixLeadId] = useState("");
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
      setBoardError(wonReasonText(check, t) || check.reason);
      setWonFixLeadId(targetStatus === "converted" ? lead.id : "");
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
        <div className="flex flex-wrap justify-end gap-2 shrink-0">
          {/* Visits, sources and the people who typed their details and
              stopped — lib/tracking/. Beside Import rather than in the
              toolbar: it is a different screen, not a filter on this one. */}
          <Link
            href="/app/leads/traffic"
            className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground"
          >
            <BarChart3 size={15} /> {t("app.traffic.navLink")}
          </Link>
          <Link
            href="/app/leads/import"
            className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground"
          >
            <Upload size={15} /> {t("app.leads.import")}
          </Link>
          {canReview && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground"
            >
              <ListChecks size={15} /> {t("app.leads.convReview.open")}
            </button>
          )}
        </div>
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
        <button
          type="button"
          onClick={() => setQuotedOnly((v) => !v)}
          aria-pressed={quotedOnly}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold ${
            quotedOnly ? "bg-inverted text-inverted-foreground border-transparent" : "border-border text-foreground"
          }`}
        >
          <FileText size={13} />
          {t("app.leads.filterQuoted")}
          {quotedCount ? ` ${quotedCount}` : ""}
        </button>
        {canDelete && (leads ?? []).length > 0 && (
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            aria-pressed={selecting}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold ${
              selecting ? "bg-inverted text-inverted-foreground border-transparent" : "border-border text-foreground"
            }`}
          >
            <CheckSquare size={13} />
            {selecting ? t("app.leads.select.done") : t("app.leads.select.toggle")}
          </button>
        )}
      </div>

      {/* The selection's own bar. Shown only while selecting, and the delete
          button is disabled — not hidden — at zero, so it is clear where the
          action will appear. */}
      {selecting && (
        <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <span className="text-sm font-medium text-foreground mr-auto">
            {t("app.leads.select.count", { count: selectedIds.size })}
          </span>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-[44px] px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("app.leads.select.clear")}
            </button>
          )}
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setDeleteTargets(selectedLeads)}
            className="min-h-[44px] px-3 rounded-lg bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 size={13} />
            {t("app.leads.delete.confirmMany", { count: selectedIds.size })}
          </button>
        </div>
      )}

      {showsMoney && (leads ?? []).length > 0 && (
        <PotentialStrip potential={potential} money={money} t={t} />
      )}

      {boardError && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{boardError}</span>
          {wonFixLeadId && (
            <button
              type="button"
              onClick={() => {
                setOpenId(wonFixLeadId);
                setBoardError("");
                setWonFixLeadId("");
              }}
              className="shrink-0 underline underline-offset-2 font-semibold"
            >
              {t("app.leads.won.openLead", "Open the lead")}
            </button>
          )}
          <button
            onClick={() => {
              setBoardError("");
              setWonFixLeadId("");
            }}
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
            className="fq-dialog-card bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3"
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
        isEmpty={shown.length === 0}
        skeleton={<div className="animate-pulse h-96 bg-accent rounded-xl" />}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Inbox size={30} className="text-muted-foreground mx-auto" />
            <p className="mt-3 font-medium text-foreground">
              {q || temp || quotedOnly ? t("app.leads.noResults") : t("app.leads.empty")}
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
                canEdit={canEdit && !selecting}
                pendingIds={pendingIds}
                activeLead={activeLead}
                selecting={selecting}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelected}
                onDelete={canDelete ? (lead) => setDeleteTargets([lead]) : null}
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
          onDelete={canDelete ? (lead) => setDeleteTargets([{ ...openLead, ...lead }]) : null}
          boardLead={openLead}
          onBoardPatch={patchLead}
          t={t}
        />
      )}

      <LeadDeleteDialog
        leads={deleteTargets}
        onDeleted={onLeadsDeleted}
        onClose={() => setDeleteTargets([])}
        t={t}
      />
      {canReview && (
        <ConversationReviewDialog open={reviewOpen} onClose={() => setReviewOpen(false)} onDeleted={onLeadsDeleted} t={t} />
      )}
    </div>
  );
}

// "Came from Facebook · ad click · campaign spring_roofs" — the landing the
// visitor arrived with, copied onto the lead from the server's own visit row
// when it came through a funnel or the instant estimate (lib/tracking/
// visits.js). Absent for every other lead, and then nothing is printed:
// no attribution means "we do not know", not "direct".
function CameFrom({ attribution, t }) {
  const a = describeAttribution(attribution);
  if (!a) return null;
  const source =
    a.source === "direct"
      ? t("app.traffic.source.direct")
      : a.source === "website"
        ? t("app.traffic.source.website")
        : sourceName(a.source);
  const parts = [source];
  if (a.adClick) parts.push(t("app.traffic.adClick"));
  if (a.campaign) parts.push(t("app.traffic.campaignNamed", { campaign: a.campaign }));
  if (a.content) parts.push(a.content);
  return (
    <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
      <Megaphone size={12} className="shrink-0 mt-0.5" />
      <span>
        {t("app.traffic.cameFrom")} {parts.join(" · ")}
      </span>
    </div>
  );
}

// "Call back requested · afternoon" — set by the public instant estimate's
// "this doesn't look right" control (app/api/instant-quote/[slug]/callback).
// The preferred time and the note ride in the intake; the flag is the column.
function CallbackBadge({ lead, t, detail = false }) {
  // Two sources set callbackRequestedAt: the instant estimate's "this
  // doesn't look right" (a measurement dispute, with a fixed time-of-day
  // choice) and, since 2026-10-04, the AI employee's book_callback (the
  // customer's own words for when, and an urgency hint) — told apart by
  // intake.capturedBy, which book_callback writes.
  const fromAi = lead.intake?.capturedBy === "ai_employee";
  const when = lead.intake?.callbackPreferredTime;
  const whenLabel = fromAi
    ? lead.intake?.preferredTimes || null
    : when
      ? t(`app.leads.callbackTime.${when}`, { morning: "morning", afternoon: "afternoon", evening: "evening", anytime: "any time" }[when] || when)
      : null;
  const urgent = fromAi && lead.intake?.callbackUrgency === "urgent";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        urgent ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      } ${detail ? "text-xs px-2.5 py-1" : "mt-2 text-[11px] px-2 py-0.5"}`}
    >
      <PhoneCall size={detail ? 13 : 11} />
      {urgent ? `${t("app.leads.callbackUrgent", "Urgent")} · ` : ""}
      {fromAi
        ? t("app.leads.callbackRequestedAi", "Call back requested through your AI assistant")
        : t("app.leads.callbackRequested", "Call back requested — measurement disputed")}
      {whenLabel ? ` · ${whenLabel}` : ""}
      {detail && lead.intake?.callbackNote ? `: ${lead.intake.callbackNote}` : ""}
    </span>
  );
}

// "≈ $4,200 · from quote Q-0031" — the figure and, always, where it came
// from. A lead with no basis renders NOTHING here rather than a dash or a
// zero: the strip above counts those, and a chip that said "$0" would be the
// padded-absence failure AGENTS.md names. Absent entirely for a member whose
// pricing toggle is off (the API attaches no `potential` for them).
//
// "scope" (2026-10-05): the homeowner's own counts priced from the company's
// own book — "estimate from 22 doors + 15 drawers". There is no "average"
// any more: a lead that gave no scope shows no figure (lib/leads/
// potentialValue.js). `detail` draws, in the drawer, WHY a lead with counts
// still has none (no service, or no price for it).
function PotentialChip({ potential, t, detail = false }) {
  const money = useCompanyMoney();
  if (!potential) return null;
  if (potential.amount == null || potential.basis === "unknown") {
    if (!detail || !potential.counts) return null;
    const why =
      potential.why === "no_pricing"
        ? t("app.leads.potential.noPricing", { counts: scopeCountsText(potential.counts, t), service: potential.service || t("app.leads.potential.thisService") })
        : potential.why === "no_service"
          ? t("app.leads.potential.noService", { counts: scopeCountsText(potential.counts, t) })
          : null;
    return why ? <div className="mt-2 text-xs text-muted-foreground">{why}</div> : null;
  }
  const basis =
    potential.basis === "quote"
      ? t("app.leads.potential.fromQuote", { number: potential.quoteNumber || "" })
      : potential.basis === "estimate"
        ? t("app.leads.potential.fromEstimate")
        : t("app.leads.potential.fromScope", { counts: scopeCountsText(potential.counts, t) });
  const hint =
    potential.basis === "scope"
      ? `${t("app.leads.potential.fromScopeHint", { service: potential.service || "" })}${potential.minimumApplied ? ` ${t("app.leads.potential.minimumApplied")}` : ""}`
      : undefined;
  return (
    <div className="mt-2 text-xs text-foreground" title={hint}>
      <span className="font-semibold">≈ {money(potential.amount)}</span>
      <span className="text-muted-foreground"> · {basis}</span>
      {detail && hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

// Quote statuses → the shared status labels. Written out in full so
// check:translations can see every key.
const QUOTE_STATUS_KEY = {
  draft: "app.status.draft",
  sent: "app.status.sent",
  accepted: "app.status.approved",
  declined: "app.status.declined",
};

// "Q-0031 · Sent · $5,550" — the quote this lead became (2026-10-05). A
// recorded link (LeadRequest.quoteId), or a quote for the same client made
// after the lead that the campaign rollup's own rule confirms (an exact phone
// or email, or a name plus an agreeing address) — the second labelled
// "probably", never written onto the lead. The total only for a member who
// may see prices (the API sends none otherwise).
function LeadQuoteLine({ lead, t }) {
  const money = useCompanyMoney();
  const q = lead.quote || lead.inferredQuote;
  if (!q) return null;
  const inferred = !lead.quote;
  const status = QUOTE_STATUS_KEY[q.status] ? t(QUOTE_STATUS_KEY[q.status]) : q.status;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-emerald-800 dark:text-emerald-300" data-lead-quote>
      <FileText size={11} aria-hidden="true" />
      <span className="font-semibold">{q.quoteNumber}</span>
      <span>· {status}</span>
      {typeof q.total === "number" && q.total > 0 ? <span>· {money(q.total)}</span> : null}
      {inferred ? <span className="text-muted-foreground">· {t("app.leads.quote.probably")}</span> : null}
    </div>
  );
}

// "Follow up · Oct 26" — the dated task a "back in three weeks" became
// (lib/leads/followUpTask.js). Red once the day has passed: a promise nobody
// kept is the reason this exists.
function FollowUpChip({ followUp, t }) {
  const { language } = useTranslation();
  if (!followUp?.dueDate) return null;
  const due = new Date(followUp.dueDate);
  const overdue = due.getTime() < Date.now();
  const date = due.toLocaleDateString(language || "en", { month: "short", day: "numeric" });
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        overdue ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
      }`}
    >
      <CalendarClock size={11} aria-hidden="true" />
      {overdue ? t("app.leads.followUp.overdue", { date }) : t("app.leads.followUp.due", { date })}
    </span>
  );
}

// The summary strip: open potential first, then one cell per stage. "Not
// weighted" is printed rather than implied because the number a sales tool
// usually shows here IS weighted, and a reader who assumes that would
// discount a figure that has already been left undiscounted on purpose.
function PotentialStrip({ potential, money, t }) {
  const { open, byStage, withoutFigure } = potential;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3" data-tour="leads-potential">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("app.leads.potential.title")}
          </span>
          <span className="text-lg font-bold text-foreground" title={t("app.leads.potential.openHint")}>
            ≈ {money(open.total)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("app.leads.potential.open")} · {t("app.leads.potential.notWeighted")}
          </span>
        </div>
        {withoutFigure > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("app.leads.potential.noFigure", { count: withoutFigure })}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {COLUMNS.map((col) => {
          const cell = byStage[col.key];
          if (!cell) return null;
          return (
            <div key={col.key} className={`rounded-lg border ${col.tone} px-3 py-2`}>
              <div className="text-[11px] font-semibold text-muted-foreground">{t(col.labelKey)}</div>
              <div className="text-sm font-semibold text-foreground">
                {cell.withFigure > 0 ? `≈ ${money(cell.total)}` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("app.leads.potential.withFigure", {
                  withFigure: cell.withFigure,
                  count: cell.count,
                })}
              </div>
            </div>
          );
        })}
      </div>
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
function LeadColumn({ col, leads, onOpen, t, canEdit, pendingIds, activeLead, selecting = false, selectedIds = null, onToggleSelect = null, onDelete = null }) {
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
            selection={
              selecting && onToggleSelect
                ? { selected: Boolean(selectedIds?.has(lead.id)), toggle: () => onToggleSelect(lead.id) }
                : null
            }
            onDelete={onDelete && !selecting ? () => onDelete(lead) : null}
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
function DraggableLeadCard({ lead, tone, onOpen, t, disabled, selection = null, onDelete = null }) {
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
        selection={selection}
        onDelete={onDelete}
      />
    </div>
  );
}

// The card's ⋯ menu — ActionMenu, the one "More…" menu (a bottom sheet on a
// phone, a viewport-kept dropdown above that). One item today, Delete, and
// drawn only for someone who may delete (onDelete is null otherwise), so it
// is never a menu of nothing.
function CardMenu({ onDelete, t, offsetRight }) {
  return (
    <div className={`absolute top-1.5 z-10 ${offsetRight ? "right-[3.25rem]" : "right-1.5"}`}>
      <ActionMenu
        title={t("app.leads.menu")}
        triggerClassName="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
        triggerProps={{ "aria-label": t("app.leads.menu"), title: t("app.leads.menu") }}
        trigger={<MoreHorizontal size={15} />}
        items={[
          {
            key: "delete",
            label: t("app.leads.delete.action"),
            icon: Trash2,
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </div>
  );
}

function LeadCard({ lead, tone, onOpen, t, dragHandle, selection = null, onDelete = null }) {
  const { language } = useTranslation();
  const budgetKey = BUDGET_LABEL_KEY[lead.budgetBand];
  const timelineKey = TIMELINE_LABEL_KEY[lead.timeline];
  // The option the homeowner actually tapped beats the scorer's bucket it was
  // folded into: "Within a month" is what they said, "Within 2 weeks" is how
  // it was scored.
  const whenNeeded = whenNeededOf(lead, language);
  const outsideArea = lead.intake?.outsideServiceArea === true;
  // Counted by kind, not by array length. The badge next to a film icon used to
  // be `clientPhotos.length`, which was fine while the array could only hold
  // photos and clips — now that a client can attach a PDF plan, that same number
  // would file the plan under "video". The plan is also the more interesting of
  // the two signals, so it gets its own badge rather than being folded in.
  const { visual: photoCount, documents: docCount } = countMediaKinds(lead.clientPhotos);
  return (
    <div
      className={`relative bg-card border rounded-xl ${tone} hover:shadow-sm transition-shadow ${
        selection?.selected ? "ring-2 ring-red-500 dark:ring-red-700" : ""
      }`}
    >
      {onDelete && <CardMenu onDelete={onDelete} t={t} offsetRight={Boolean(dragHandle)} />}
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
      {/* While selecting, the whole card is the checkbox — a 44px target on
          a phone, where a lone box in the corner would not be. */}
      <button
        onClick={selection ? selection.toggle : onOpen}
        role={selection ? "checkbox" : undefined}
        aria-checked={selection ? selection.selected : undefined}
        aria-label={selection ? t("app.leads.select.one", { name: lead.name }) : undefined}
        className="w-full text-left p-4"
      >
        <div className={`flex items-start justify-between gap-2 ${onDelete && dragHandle ? "pr-24" : "pr-6"}`}>
          <span className="flex items-start gap-2 min-w-0">
            {selection && (
              <span
                aria-hidden="true"
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${
                  selection.selected ? "bg-red-700 border-red-700 text-white" : "border-border bg-card"
                }`}
              >
                {selection.selected ? "✓" : ""}
              </span>
            )}
            <span className="font-medium text-foreground break-words">{lead.name}</span>
          </span>
          <TempBadge temperature={lead.temperature} score={lead.score} t={t} />
        </div>
        {/* The homeowner pressed "this doesn't look right" under a measured
            estimate and asked to be rung. Not a temperature — an
            instruction: book the on-site visit. */}
        {lead.callbackRequestedAt && <CallbackBadge lead={lead} t={t} />}

        {(budgetKey || timelineKey || whenNeeded || outsideArea) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(whenNeeded || timelineKey) && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {whenNeeded || t(timelineKey)}
              </span>
            )}
            {outsideArea && <OutsideAreaBadge language={language} />}
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

        {(lead.qualification || lead.followUp) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TierChip qualification={lead.qualification} t={t} />
            <FollowUpChip followUp={lead.followUp} t={t} />
          </div>
        )}

        <PotentialChip potential={lead.potential} t={t} />
        <LeadQuoteLine lead={lead} t={t} />

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

// `sample` is a lead object, set only by LeadsSample below (the marketing
// walk-through on /industries/roofing). With it the drawer renders that lead
// instead of fetching one, and every write stays in this component's state —
// see LeadsSample for why, and patch() below for how.
function LeadDrawer({ leadId, assignees, onClose, onPatched, t, sample = null, onDelete = null, boardLead = null, onBoardPatch = null }) {
  const { language } = useTranslation();
  const [lead, setLead] = useState(sample);
  const [loading, setLoading] = useState(!sample);
  const [err, setErr] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  // The call-back log is the Notes dial's, on top of the requests dial: an
  // Estimator may change the request and only read its notes; Crew (the
  // "jobs and visits only" floor) get the lead with the log removed and
  // `notesRestricted` set. Same functions the API asks — lib/permissions/
  // enforce.js, Notes. Affordance only; the server refuses regardless.
  const canWriteNotes = useHasLevel("notes", "view_edit_all");
  const canDeleteNotes = useHasLevel("notes", "view_edit_delete_all");
  // Linked documents (app/components/leads/LeadLinkedDocuments.js). Linking
  // is a write on the lead (requests) by someone allowed to see quotes;
  // creating one is the quotes dial's write, which the convert route asks.
  const canEditLead = useHasLevel("requests", "view_create_edit");
  const canSeeQuotes = useHasLevel("quotes", "view_only");
  const canCreateQuotes = useHasLevel("quotes", "view_create_edit");
  // null | { markWon } — the quote picker, plain or "Link the quote that won it".
  const [picker, setPicker] = useState(null);
  // Bumped after any link/unlink so the documents block re-reads.
  const [docsKey, setDocsKey] = useState(0);
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
    if (sample) return;
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
  }, [leadId, t, sample]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patch(body) {
    // A sample's owner and status change here and on the sample's card, the
    // way a PATCH's reply would — never on a server.
    if (sample) {
      const next = { ...body };
      if ("assignedToId" in body) next.assignedTo = assignees.find((a) => a.id === body.assignedToId) || null;
      setLead((prev) => ({ ...prev, ...next }));
      onPatched({ id: leadId, ...next });
      return;
    }
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
    if (sample || !noteText.trim()) return;
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

  // DELETE /api/leads/[id]/notes/[noteId] — the top rung of the Notes dial.
  // Removed from the local list only after the server said so.
  async function deleteNote(noteId) {
    if (sample) return;
    setDeletingNoteId(noteId);
    setErr("");
    try {
      const res = await fetch(`/api/leads/${leadId}/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) return reportResponseError(res, setErr, t("app.leads.noteDeleteError", "Couldn't delete that note."));
      setLead((prev) => ({ ...prev, notes: (prev.notes || []).filter((n) => n.id !== noteId) }));
    } finally {
      setDeletingNoteId(null);
    }
  }

  // After the quote-link route answered: the lead's new status/quote on both
  // the drawer and the board card, and a fresh read of its documents.
  function applyLinked(partial) {
    if (!partial) return;
    setLead((prev) => ({ ...prev, ...partial }));
    onPatched(partial);
    setDocsKey((k) => k + 1);
  }

  async function convert() {
    if (sample) return;
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

  // Read through the shared shape, not by key. This filtered `address` out by
  // hand and let `city`, `province` and `country` through, so a self-quote lead
  // from a Places pick printed its address on the contact line AND then three
  // more rows — "city: Ottawa", "province: ON" — under "What they told us",
  // which is not a thing anybody told us. See lib/leads/intakeShape.js.
  // …and then through the copy tables, so a trade answer prints as the
  // question it answered. See intakeRow.
  const intakeEntries = leadIntakeDetails(lead?.intake)
    .map((entry) => ({ key: entry[0], ...intakeRow(entry, language) }))
    .filter((row) => row.label)
    // The instant estimate's option, by the name the homeowner picked it by
    // (the route sends it: GET /api/leads/[id] materialLabel) — the row
    // printed the price-book key, "asphalt_arch". An option nobody can name
    // any more keeps the key.
    .map((row) =>
      row.key === "material" && lead?.materialLabel
        ? {
            ...row,
            label: t("app.reviews.material").replace(/\s*:\s*$/, ""),
            value: lead.materialLabel.translations?.[language] || lead.materialLabel.label,
            raw: false,
          }
        : row,
    );
  const addressLine = leadAddressLine(lead?.intake);

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
              {lead.callbackRequestedAt && (
                <div className="mt-2">
                  <CallbackBadge lead={lead} t={t} detail />
                </div>
              )}
              {lead.intake?.outsideServiceArea === true && (
                <div className="mt-2">
                  <OutsideAreaBadge language={language} size="lg" />
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(lead.createdAt).toLocaleString()}
                {/* The channel as a sentence, not the column's word: this
                    printed "· instant_quote". See lib/leads/sourceLabel.js. */}
                {lead.source && ` · ${leadSourceLabel(t, lead.source)}`}
              </div>
              <CameFrom attribution={lead.attribution} t={t} />
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
                  {/* From the business number, when the company has one —
                      renders nothing otherwise (BridgeCallButton). */}
                  <BridgeCallButton kind="lead" id={lead.id} className="ml-auto" />
                </div>
              )}
              {addressLine && (
                <div className="text-muted-foreground">{addressLine}</div>
              )}
              {/* The house, before anyone drives out to quote it. The server
                  resolves the address from this lead's own intake and checks
                  for imagery for free; the panorama loads only on tap. The
                  detail panel only — never on a board card. */}
              {/* Not for a sample: its address is invented, and the lookup
                  is a Google request the walk-through promises not to make. */}
              {addressLine && !sample && (
                <StreetViewPeek
                  kind="lead"
                  id={lead.id}
                  className="pt-1"
                  labels={{
                    see: t("app.streetView.see"),
                    hide: t("app.streetView.hide"),
                    openInMaps: t("app.streetView.openInMaps"),
                    frameTitle: t("app.streetView.frameTitle"),
                  }}
                />
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

            {/* What the conversation was, and the one-tap change
                (lib/leads/qualification.js) — only for a lead that came
                from one. The board's row carries the tier; a change is
                patched back into it so the card agrees at once. */}
            {!sample && (boardLead?.threadId || lead.conversationEvidence?.threadId) && (
              <div className="rounded-lg border border-border p-3">
                <QualificationControl
                  qualification={boardLead?.qualification || null}
                  endpoint={`/api/leads/${lead.id}/qualification`}
                  canEdit={canEditLead}
                  onChanged={(q) => onBoardPatch?.({ id: lead.id, qualification: q })}
                  t={t}
                />
              </div>
            )}

            {/* The scope they typed, each count with its sentence, and the
                quick estimate from the company's own prices — or why there
                is none. */}
            {(lead.intake?.scope || boardLead?.potential?.counts) && (
              <div className="rounded-lg border border-border p-3 space-y-1" data-lead-scope>
                <div className="text-xs font-semibold text-foreground">{t("app.leads.scope.title")}</div>
                {lead.intake?.scope?.counts && Object.keys(lead.intake.scope.counts).length > 0 && (
                  <p className="text-sm text-foreground">{scopeCountsText(lead.intake.scope.counts, t)}</p>
                )}
                {Object.values(lead.intake?.scope?.sources || {})[0]?.quote && (
                  <p className="text-xs text-muted-foreground break-words">“{Object.values(lead.intake.scope.sources)[0].quote}”</p>
                )}
                {lead.intake?.scope?.colour?.quote && (
                  <p className="text-xs text-muted-foreground break-words">{t("app.leads.scope.colour")}: “{lead.intake.scope.colour.quote}”</p>
                )}
                {lead.intake?.scope?.hardware?.quote && (
                  <p className="text-xs text-muted-foreground break-words">{t("app.leads.scope.hardware")}: “{lead.intake.scope.hardware.quote}”</p>
                )}
                {lead.intake?.scope?.damage?.quote && (
                  <p className="text-xs text-muted-foreground break-words">{t("app.leads.scope.damage")}: “{lead.intake.scope.damage.quote}”</p>
                )}
                <PotentialChip potential={boardLead?.potential} t={t} detail />
              </div>
            )}

            {boardLead?.followUp?.dueDate && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <FollowUpChip followUp={boardLead.followUp} t={t} />
                <Link href="/app/tasks" className="underline underline-offset-2">{t("app.leads.followUp.openTasks")}</Link>
              </div>
            )}

            {/* Why this score */}
            {Array.isArray(lead.scoreReasons) && lead.scoreReasons.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-foreground mb-2">{t("app.leads.whyScore")}</div>
                <ul className="space-y-1">
                  {lead.scoreReasons.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      {/* Keyed reasons print in the reader's language; a row
                          scored before keys existed carries only its English
                          label and prints that. See lib/leads/score.js. */}
                      <span>{r.key ? t(r.key, r.label, r.values) : r.label}</span>
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
            {/* ── "Not stated" is a claim about the household ─────────────
                It says they were asked and did not answer, which is worth
                knowing — a self-quote visitor who skipped the budget question
                really did decline. It is a small lie on a channel that never
                put the question: the instant quote has no timeline field on it,
                the kitchen designer and the portal ask neither. Those leads read
                "Nobody asked" instead, from NOT_ASKED_BY_SOURCE in
                lib/leads/qualifiers.js — the one place that knows which of our
                forms carries which question. Only while the value is still
                empty: once a rep has picked one, the answer is the answer. */}
            <div className={lead.restricted ? "" : "grid grid-cols-2 gap-3"}>
              <label className="text-xs">
                <span className="text-muted-foreground">{t("app.leads.timeline")}</span>
                <select
                  value={lead.timeline || ""}
                  disabled={busy}
                  onChange={(e) => patch({ timeline: e.target.value })}
                  className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                >
                  <option value="">
                    {wasAsked(lead.source, "timeline")
                      ? t("app.leads.notStated")
                      : t("app.leads.notAsked")}
                  </option>
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
                    <option value="">
                      {wasAsked(lead.source, "budget")
                        ? t("app.leads.notStated")
                        : t("app.leads.notAsked")}
                    </option>
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
                  {intakeEntries.map((row) => (
                    <div key={row.key} className="flex justify-between gap-3 py-0.5 border-b border-border/50">
                      {/* `capitalize` only on the humanised keys: a label from
                          the copy table is already a sentence, and Tailwind's
                          capitalize would turn "Is there an active leak" into
                          "Is There An Active Leak". */}
                      <dt className={`text-muted-foreground ${row.raw ? "capitalize" : ""}`}>{row.label}</dt>
                      {/* formatIntakeValue, not String(v): the junk-removal
                          picker stores [{key, quantity}] and the funnels store
                          arrays of chosen labels, both of which printed
                          "[object Object]" at the estimator. */}
                      <dd className="text-foreground text-right">{row.value}</dd>
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
                      title={blocked ? wonReasonText(statusCheck, t) || statusCheck.reason : undefined}
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
              {/* Why Won is refused, and the way through — never a greyed-out
                  button alone. The rule is lib/leads/pipeline.js wonCheck. */}
              {lead.status !== "converted" && (
                <WonBlockedNote
                  check={canSetLeadStatus(lead, "converted")}
                  lead={lead}
                  canEdit={canEditLead}
                  canQuotes={canSeeQuotes}
                  onLinkWinning={() => setPicker({ markWon: true })}
                  t={t}
                />
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

            {/* What this lead became — the quote, its jobs, its invoices —
                and the ways to put a quote on it: create one (the existing
                convert path) or link one that already exists. */}
            {/* A sample's documents are the page's own sections below the
                drawer; this list would fetch the lead's real ones. */}
            {!sample && (
            <LinkedDocuments
              leadId={leadId}
              lead={lead}
              reloadKey={docsKey}
              canEdit={canEditLead}
              canQuotes={canSeeQuotes}
              canCreateQuotes={canCreateQuotes}
              converting={converting}
              onConvert={convert}
              onOpenPicker={(markWon) => setPicker({ markWon })}
              onUnlinked={applyLinked}
              t={t}
            />
            )}
            {/* A commercial enquiry with drawings: read them into a draft
                quote (lib/planRead/). Only where a quote could be created. */}
            {!sample && canCreateQuotes && !lead.quote?.id && (
              <Link
                href={`/app/quotes/drawings/new?lead=${leadId}`}
                className="mt-3 inline-flex items-center min-h-[44px] px-3 rounded-lg border border-border text-sm hover:bg-accent"
              >
                {t("app.planRead.startFromDrawingsShort", "Start from drawings")}
              </Link>
            )}
            {picker && (
              <QuoteLinkPicker
                leadId={leadId}
                markWon={picker.markWon}
                hasLinkedQuote={Boolean(lead.quote?.id)}
                onClose={() => setPicker(null)}
                onLinked={applyLinked}
                t={t}
              />
            )}

            {/* Notes */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-1.5">{t("app.leads.notes")}</div>
              {/* The composer is drawn only for a member who may write. A
                  greyed-out input that the POST refuses is the dead control
                  AGENTS.md names. */}
              {canWriteNotes && !lead.notesRestricted && (
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
              )}
              {/* Restriction is said, not left as an empty log: "No notes
                  yet" over notes that exist would send somebody to go and
                  collect what the office already knows. */}
              {lead.notesRestricted ? (
                <p className="text-xs text-muted-foreground italic">
                  {t("app.access.restricted", "Hidden by your access level")}
                </p>
              ) : (lead.notes || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.leads.noNotes")}</p>
              ) : (
                <ul className="space-y-2">
                  {lead.notes.map((n) => (
                    <li key={n.id} className="text-xs border-l-2 border-border pl-2.5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground whitespace-pre-wrap">{n.body}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {n.author?.name || t("app.leads.someone")} ·{" "}
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {canDeleteNotes && (
                        <button
                          type="button"
                          onClick={() => deleteNote(n.id)}
                          disabled={deletingNoteId === n.id}
                          aria-label={t("app.leads.deleteNote", "Delete note")}
                          title={t("app.leads.deleteNote", "Delete note")}
                          className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          {deletingNoteId === n.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Last, and apart from everything above it: the one control in
                the panel that cannot be taken back. The confirm it opens
                (LeadDeleteDialog) names the lead and says what is kept. */}
            {onDelete && !sample && (
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => onDelete(lead)}
                  className="min-h-[44px] px-3 rounded-lg border border-red-200 dark:border-red-900 text-sm font-semibold text-red-700 dark:text-red-300 inline-flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={14} /> {t("app.leads.delete.action")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
