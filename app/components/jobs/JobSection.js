// app/components/jobs/JobSection.js
//
// One collapsible card header, shared by every section of the job detail page.
//
// The owner's words: "can the sections within a job be collapsed so i don't
// have to infinitely scroll down". /app/jobs/<id> stacks two dozen cards —
// client, selections, costing, subs, plan, change orders, materials,
// equipment, to-dos, documents, the daily log, visits, photos — and a crew
// member on a phone scrolls past all of them to reach the one they came for.
//
// ── Why each card asks for this itself, rather than JobDetail wrapping them ─
//
// The obvious implementation is a <Collapsible> around every child in
// JobDetail.js: one file, one diff. It was rejected because JobDetail cannot
// see whether a child drew anything. Most of these cards fetch their own data
// and return null — no subcontractors, no payment schedule, no prep guide, no
// to-dos — and a wrapper would then render a heading and a chevron over
// nothing, which is the dead control AGENTS.md forbids. The card knows; the
// page above it does not. So the toggle lives inside each card, below its own
// early returns, and a card that renders nothing has no header to click.
//
// ── Why localStorage and not the schema ────────────────────────────────────
//
// Same reasoning as app/components/layout/navDisclosure.js, and the same
// words: disclosure is a preference, not a record. Nothing on a server needs
// to know which card somebody folded, and a per-user column would turn a
// click into a round trip.
//
// Keyed on the job id alone rather than companyId + jobId. Job.id is a cuid,
// unique across every tenant, so a company scope would restate a uniqueness
// the id already carries — and threading a companyId through sixteen
// components to do it is exactly the copy that rots. The property that
// matters is kept: two jobs never share an entry, so folding Materials on one
// job does not fold it on the next.
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const PREFIX = "fq-job-sections:";

/** The stored open/closed map for one job, or {} for anything unreadable. */
function readState(jobId) {
  try {
    const raw = window.localStorage.getItem(PREFIX + jobId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    // Private window, cleared site data, blocked storage, or somebody's
    // hand-edited JSON. "Everything open" is a fine answer; a job page that
    // throws on boot is not.
    return {};
  }
}

function writeState(jobId, key, open) {
  try {
    // Re-read before merging rather than keeping a copy in React state: this
    // page mounts a dozen of these hooks, each owning one key of the same
    // object, and a stale copy would drop a sibling's last click.
    const next = { ...readState(jobId), [key]: open };
    window.localStorage.setItem(PREFIX + jobId, JSON.stringify(next));
  } catch {
    /* nothing to do — the card still folds, it just won't be remembered */
  }
}

/**
 * One card's disclosure state: `{ open, toggle, bodyId }`.
 *
 * `key` names the section, not the card's file, so renaming a component does
 * not lose somebody's layout.
 */
export function useJobSection(jobId, key) {
  // Open on the first render, always. Reading storage in the initialiser
  // would disagree with the server's HTML and hydrate wrong, and defaulting
  // to closed would hide content people could see before this shipped — the
  // worse of the two failures by a distance.
  const [open, setOpen] = useState(true);
  const reactId = useId();

  useEffect(() => {
    if (!jobId) return;
    const stored = readState(jobId)[key];
    // Only a real boolean overrides the default: a key absent from the map,
    // or carrying somebody's edited rubbish, means "never decided" and must
    // not read as closed.
    if (typeof stored === "boolean") setOpen(stored);
  }, [jobId, key]);

  // Next computed from the rendered value rather than inside the updater:
  // React may run an updater twice, and writing to storage from one is a side
  // effect in a place that promises not to have any.
  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (jobId) writeState(jobId, key, next);
  }, [open, jobId, key]);

  // For a control that sits in the header, OUTSIDE the fold, and whose whole
  // output lands inside it — "Build the material list" is the one. Pressing it
  // on a folded card would otherwise write a result nobody can see, which is
  // the same failure as a button that does nothing. Unfolding on demand is the
  // honest answer; re-opening on every render would silently undo a click, the
  // mistake navDisclosure.js records for the active nav group.
  const expand = useCallback(() => {
    if (open) return;
    setOpen(true);
    if (jobId) writeState(jobId, key, true);
  }, [open, jobId, key]);

  return { open, toggle, expand, bodyId: `job-section-${reactId}` };
}

/**
 * The clickable part of a card's header: whatever heading content you pass,
 * plus a chevron, with the whole row as the hit target.
 *
 * Goes INSIDE the card's existing <h2>/<h3>, not around it — a heading is not
 * phrasing content, so a <button> wrapping one is invalid and loses the
 * heading from the accessibility tree. Heading-wraps-button is the WAI-ARIA
 * accordion shape and keeps the card findable by heading navigation.
 *
 * `w-full` because these headers come in two shapes: a heading that is the
 * only thing in its row, and a heading sharing a flex row with action
 * buttons. In the second, the <h2> is the flex child that takes the space the
 * buttons leave, and the button fills it — so no caller passes layout in.
 */
export function JobSectionToggle({ section, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={section.toggle}
      aria-expanded={section.open}
      aria-controls={section.bodyId}
      className={`-mx-1 flex min-h-[44px] w-full min-w-0 items-center justify-between gap-2 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${className}`}
    >
      {children}
      <ChevronDown
        size={18}
        aria-hidden="true"
        className={`shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none ${
          section.open ? "" : "-rotate-90"
        }`}
      />
    </button>
  );
}
