// app/app/jobs/[id]/visits/new/page.js
//
// Schedule a visit against a job.
//
// This route did not exist. The job detail page had two "Add visit" links
// pointing at it — the empty-state one and the header button — and both landed
// on a 404, so the only way to put work on the calendar was the API. A visit
// is the unit that actually gets done, so that was the pipeline's dead end.
//
// The checklist picker lives here rather than only on the job page because
// scheduling is when someone is thinking about what the visit involves. It is
// still a choice: no template is preselected, and a visit created without one
// simply has no checklist.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, ClipboardList } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import {
  normalizeChecklistItems,
  PHASE_LABELS,
} from "@/lib/jobs/checklistItems";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function NewVisitPage() {
  const { t } = useTranslation();
  const { id: jobId } = useParams();
  const router = useRouter();

  const [job, setJob] = useState(null);
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [notes, setNotes] = useState("");
  const [chosenIds, setChosenIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Three independent loads. Only the job is fatal — a visit can be
      // scheduled with nobody assigned and no checklist, so a failure on
      // either of the other two must not block the form.
      const [jobRes, memberRes, tplRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`).catch(() => null),
        fetch("/api/settings/members").catch(() => null),
        fetch("/api/settings/checklists?includeSystem=1").catch(() => null),
      ]);

      if (cancelled) return;

      if (!jobRes?.ok) {
        setError("Couldn't load this job.");
        setLoading(false);
        return;
      }
      setJob(await jobRes.json());

      if (memberRes?.ok) {
        const data = await memberRes.json();
        setMembers(Array.isArray(data) ? data : []);
      }
      if (tplRes?.ok) {
        const data = await tplRes.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const own = useMemo(() => templates.filter((tpl) => !tpl.isSystem), [templates]);
  const suggested = useMemo(
    () => templates.filter((tpl) => tpl.isSystem),
    [templates],
  );

  // The items this visit will actually be created with, assembled in the order
  // the templates were ticked. Deduped on the label so picking a company list
  // and the starter list for the same trade doesn't produce "Mask the floor"
  // twice.
  const checklistItems = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const id of chosenIds) {
      const tpl = templates.find((x) => x.id === id);
      if (!tpl) continue;
      for (const item of normalizeChecklistItems(tpl.items, { phase: tpl.phase })) {
        const key = item.label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  }, [chosenIds, templates]);

  function toggleTemplate(id) {
    setChosenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!scheduledAt) {
      setError("Pick a date and time for the visit.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
          assignedToId: assignedToId || null,
          notes: notes.trim() || null,
          // Empty array, not null, when nothing was picked — the API turns an
          // empty list into null so "no checklist" stays distinguishable from
          // "a checklist with nothing on it".
          checklistItems,
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          "Couldn't schedule the visit.",
        );
        setError(message || "Couldn't schedule the visit.");
        return;
      }
      router.push(`/app/jobs/${jobId}`);
      router.refresh();
    } catch {
      setError("Couldn't schedule the visit. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={`/app/jobs/${jobId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {job?.title || t("app.jobs.title")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.job.addVisit")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A visit is a trip to the site — a date, who is going, and what gets
          done while they are there.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                When
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Who is going
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className={inputClass}
              >
                <option value="">Not assigned yet</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user?.id || m.userId}>
                    {m.user?.name || m.user?.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notes for the crew
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Gate code, where to park, who to ask for"
              className={inputClass}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardList size={15} className="text-muted-foreground" />
              Checklist
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Optional. Pick one or more and the crew gets their own tickable
              copy — editing it later never changes the original.
            </p>
          </div>

          {own.length === 0 && suggested.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No checklists yet.{" "}
              <Link
                href="/app/settings/checklists"
                className="underline text-foreground"
              >
                Write one in Settings
              </Link>
              , or switch on the services you offer to see the starter lists for
              your trades.
            </p>
          ) : (
            <div className="space-y-4">
              {own.length > 0 && (
                <TemplateChoices
                  heading="Your checklists"
                  templates={own}
                  chosenIds={chosenIds}
                  onToggle={toggleTemplate}
                />
              )}
              {suggested.length > 0 && (
                <TemplateChoices
                  heading="Starter lists for your trades"
                  note="Written by FieldQuo for the services you have switched on. Nothing is added unless you tick it."
                  templates={suggested}
                  chosenIds={chosenIds}
                  onToggle={toggleTemplate}
                />
              )}

              {checklistItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {checklistItems.length} step
                  {checklistItems.length === 1 ? "" : "s"} will be copied onto
                  this visit.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Schedule visit
          </button>
          <Link
            href={`/app/jobs/${jobId}`}
            className="border border-border text-foreground text-sm font-semibold px-4 py-2.5 rounded-lg"
          >
            {t("app.action.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

function TemplateChoices({ heading, note, templates, chosenIds, onToggle }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </div>
      {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto">
        {templates.map((tpl) => {
          const count = Array.isArray(tpl.items) ? tpl.items.length : 0;
          const checked = chosenIds.includes(tpl.id);
          return (
            <label
              key={tpl.id}
              className={`flex items-start gap-2.5 border rounded-lg px-3 py-2 cursor-pointer ${
                checked ? "border-inverted bg-muted" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(tpl.id)}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {tpl.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {PHASE_LABELS[tpl.phase] || PHASE_LABELS.during} · {count} step
                  {count === 1 ? "" : "s"}
                  {tpl.category?.label && ` · ${tpl.category.label}`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
