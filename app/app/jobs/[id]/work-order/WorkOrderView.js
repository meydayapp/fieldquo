// app/app/jobs/[id]/work-order/WorkOrderView.js
//
// The crew work order on a screen: per area, what was sold and how long it
// should take, the estimator's crew note, a tick and photos. No prices — the
// model never carries one (lib/workOrder/build.js) — and the client's phone
// only when the member's access gives it (redactClient: the full client
// record, or Crew's "phone on their jobs" switch — the same rule the job page
// follows).
//
// ── Two readers, one page ───────────────────────────────────────────────────
//
// A crew member sees the crew's copy. Someone who can edit the job sees the
// same copy plus the items the office has hidden, flagged, with a control to
// show or hide each — so "what does Marco see" is answered by looking, not
// by remembering. Hidden items are ABSENT from the PDF and the print sheet
// whoever downloads them.
//
// ── Enough to do the job (2026-10-04) ───────────────────────────────────────
//
// Each area lists its lines with how many and in what unit, the door and
// drawer counts, the colour / sheen / coats it was sold in, and the trade's
// "what's included" bullets; below the areas come the options the client
// chose, the materials list, the checklist and the visits with their notes.
// All of it is scope from lib/workOrder/build.js — the model still carries no
// price, and this file only draws what is there.
//
// The tick and the photos are the job's own Task rows (one write, two views):
// POST /api/jobs/[id]/work-order/areas creates the Task on first use, and the
// photos go through the existing POST /api/tasks/[id]/photos.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, EyeOff, Eye, FileText, Loader2, Printer } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { fetchJson } from "@/lib/fetchJson";
import { formatShortDate, formatTimeOfDay, formatWeekdayDayMonth } from "@/lib/format/localeDate";
import MediaUploader from "@/app/components/MediaUploader";
import { workOrderPath, workOrderPdfPath, workOrderPrintPath } from "@/lib/workOrder/url";

export default function WorkOrderView({ jobId }) {
  const { t, language } = useTranslation();
  const caller = usePermissions();
  const canEdit = hasLevel(caller, "jobs", "view_create_edit");
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchJson(`/api/jobs/${jobId}/work-order`);
      setWo(data?.workOrder || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function tick(area, done) {
    setBusyKey(area.key);
    setError("");
    try {
      const data = await fetchJson(`/api/jobs/${jobId}/work-order/areas`, {
        method: "POST",
        body: { key: area.key, done },
      });
      setWo(data?.workOrder || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function addPhotos(area, added) {
    // Only what the upload endpoint classified as a photo — a PDF from the
    // same picker is not a site photo. See lib/media/validate.js.
    const photos = (added || []).filter((m) => m?.url && m.kind === "photo");
    if (!photos.length) return;
    setBusyKey(area.key);
    setError("");
    try {
      // The Task behind this area may not exist yet; asking for it with no
      // `done` creates it and changes nothing else.
      let taskId = area.taskId;
      if (!taskId) {
        const ensured = await fetchJson(`/api/jobs/${jobId}/work-order/areas`, {
          method: "POST",
          body: { key: area.key },
        });
        taskId = ensured?.taskId;
      }
      await fetchJson(`/api/tasks/${taskId}/photos`, {
        method: "POST",
        body: { photos: photos.map((m) => ({ url: m.url })) },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function setHidden(key, hidden) {
    setBusyKey(key);
    setError("");
    try {
      const data = await fetchJson(`/api/jobs/${jobId}/work-order`, {
        method: "PATCH",
        body: { key, hidden },
      });
      setWo(data?.workOrder || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${workOrderPath(jobId)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("app.workOrder.copyFailed", "Couldn't copy the link — select it from the address bar instead."));
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (!wo) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 text-sm text-muted-foreground">
        {error || t("app.workOrder.notFound", "This job has no work order — it needs a quote behind it.")}
      </div>
    );
  }

  const dates = [wo.job.startDate, wo.job.endDate]
    .filter(Boolean)
    .map((d) => formatShortDate(d, language));
  const dateText = dates.length === 2 && dates[0] !== dates[1] ? `${dates[0]} – ${dates[1]}` : dates[0] || "";
  // The client's PO, when the job has one — the same fact the PDF and the
  // print sheet put on this line.
  const poText = wo.job.clientPoNumber ? t("app.clientPo.chip", { po: wo.job.clientPoNumber }) : "";
  const sub = [wo.job.siteAddress, wo.client?.name, dateText, poText].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/app/jobs/${jobId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={12} /> {t("app.workOrder.backToJob", "Job")}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-foreground">
            {t("app.workOrder.title", "Work order — crew copy")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("app.workOrder.subtitle", "Crew only, no prices. Regenerated from the quote whenever it changes.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t("app.workOrder.copied", "Copied") : t("app.workOrder.copyLink", "Copy link")}
          </button>
          <a
            href={workOrderPdfPath(jobId)}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground"
          >
            <FileText size={14} /> PDF
          </a>
          <a
            href={workOrderPrintPath(jobId)}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground"
          >
            <Printer size={14} /> {t("app.action.print", "Print")}
          </a>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground">{wo.job.title}</div>
            {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
            {wo.client?.phone && (
              <div className="text-xs text-muted-foreground">{wo.client.phone}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-foreground">
              {/* "0 h across 1 areas" told the crew nothing; no estimate is
                  said as no estimate. */}
              {wo.totalHours > 0
                ? t("app.workOrder.hoursAcross", "{hours} h across {n} areas", { hours: wo.displayHours, n: wo.stats.areas })
                : t("app.workOrder.areasOnly", "{n} areas", { n: wo.stats.areas })}
            </div>
            {wo.hoursFromQuote && (
              <div className="text-xs text-muted-foreground">{t("app.workOrder.hoursFromQuote", "Hours as estimated on the quote")}</div>
            )}
            {wo.crew.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {t("app.workOrder.crew", "Crew: {names}", { names: wo.crew.join(", ") })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value={`${wo.stats.done} / ${wo.stats.areas}`} label={t("app.workOrder.statDone", "areas done")} />
          <Stat
            value={`${wo.clockedHours} h`}
            label={wo.totalHours > 0 ? t("app.workOrder.statClocked", "clocked of {hours}", { hours: wo.displayHours }) : t("app.workOrder.statClockedOnly", "clocked")}
          />
          <Stat value={String(wo.stats.photos)} label={t("app.workOrder.statPhotos", "photos filed")} />
        </div>

        {wo.areas.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("app.workOrder.noAreas", "The quote behind this job has no areas or lines to put on a work order yet.")}
          </p>
        )}

        <ul>
          {wo.areas.map((a) => (
            <li
              key={a.key}
              className={`grid grid-cols-[28px_1fr] gap-2.5 border-b border-border py-3 last:border-b-0 ${a.hidden ? "opacity-60" : ""}`}
            >
              <div>
                {!a.hidden && (
                  <button
                    type="button"
                    disabled={busyKey === a.key}
                    onClick={() => tick(a, !a.done)}
                    aria-label={a.done ? t("app.workOrder.markNotDone", "Mark {area} as not done", { area: a.label }) : t("app.workOrder.markDone", "Mark {area} as done", { area: a.label })}
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded border transition ${
                      a.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border hover:border-foreground/40"
                    } disabled:opacity-50`}
                  >
                    {busyKey === a.key ? <Loader2 size={13} className="animate-spin" /> : a.done && <Check size={14} strokeWidth={3} />}
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <div className="font-semibold text-foreground">
                    {a.label}
                    {a.hours > 0 && <span className="font-normal text-muted-foreground"> · {a.displayHours} h</span>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {a.assignee && <div>{a.assignee}</div>}
                    {a.done && <div className="text-emerald-700 dark:text-emerald-400">{t("app.workOrder.done", "Done")}</div>}
                    {a.hidden && (
                      <div className="text-amber-700 dark:text-amber-400">
                        {t("app.workOrder.hiddenFlag", "Hidden from the crew")}
                      </div>
                    )}
                  </div>
                </div>
                <AreaScope area={a} t={t} />
                {a.crewNote && (
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                    {t("app.workOrder.crewNote", "Crew note: {note}", { note: a.crewNote })}
                  </p>
                )}

                {/* Line items of a non-takeoff group, each with its own hide
                    control for the office — only when there is more than one,
                    since hiding a group's single line is hiding the group. A
                    paint area is hidden whole. */}
                {canEdit && a.lines?.filter((l) => l.key).length > 1 && (
                  <ul className="mt-1 space-y-0.5">
                    {a.lines.map((l) => (
                      <li key={l.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className={l.hidden ? "text-muted-foreground line-through" : "text-foreground"}>{l.label}</span>
                        <button
                          type="button"
                          disabled={busyKey === l.key}
                          onClick={() => setHidden(l.key, !l.hidden)}
                          className="inline-flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {l.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                          {l.hidden ? t("app.workOrder.show", "Show on work order") : t("app.workOrder.hide", "Hide on work order")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {!a.hidden && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {a.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.url} alt="" className="h-14 w-16 rounded border border-border object-cover" />
                    ))}
                    <MediaUploader
                      uploadUrl="/api/upload" purpose="jobs"
                      value={[]}
                      max={6}
                      label={t("app.workOrder.addPhoto", "+ photo")}
                      hint=""
                      onChange={(added) => addPhotos(a, added)}
                    />
                  </div>
                )}

                {canEdit && (
                  <div className="mt-1">
                    <button
                      type="button"
                      disabled={busyKey === a.key}
                      onClick={() => setHidden(a.key, !a.hidden)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {a.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                      {a.hidden ? t("app.workOrder.show", "Show on work order") : t("app.workOrder.hide", "Hide on work order")}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <JobExtras wo={wo} t={t} language={language} />

      <p className="mt-3 text-xs text-muted-foreground">
        {wo.hiddenCount > 0
          ? t("app.workOrder.footHidden", "Not on the crew's copy: {n} items hidden by the office, and prices. The client's contact details follow your access level, the same rule as the job page.", { n: wo.hiddenCount })
          : t("app.workOrder.foot", "Not on the crew's copy: prices. The client's contact details follow your access level, the same rule as the job page.")}
      </p>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/**
 * One area's scope: each line with how many and in what unit, the door and
 * drawer counts, the finish, and the trade's "what's included".
 */
function AreaScope({ area: a, t }) {
  const lines = (a.lines || []).filter((l) => !l.hidden && l.label);
  const qtyText = (l) => {
    // A generic "unit" is the cabinet base line's — its counts are said below.
    const unit = l.unit && l.unit !== "unit" ? ` ${l.unit}` : "";
    return l.quantity > 1 || unit ? ` × ${l.quantity}${unit}` : "";
  };
  const finish = a.finish || {};
  const facts = [
    finish.colour && t("app.workOrder.fact.colour", "Colour: {v}", { v: finish.colour }),
    finish.sheen && t("app.workOrder.fact.sheen", "Sheen: {v}", { v: finish.sheen }),
    finish.doorStyle && t("app.workOrder.fact.doorStyle", "Door style: {v}", { v: finish.doorStyle }),
    finish.primerCoats && t("app.workOrder.fact.primerCoats", "Primer coats: {n}", { n: finish.primerCoats }),
    finish.topCoats && t("app.workOrder.fact.topCoats", "Top coats: {n}", { n: finish.topCoats }),
    finish.twoTone && t("app.workOrder.fact.twoTone", "Two-tone"),
    finish.threeTone && t("app.workOrder.fact.threeTone", "Three-tone"),
  ].filter(Boolean);
  const counts = a.counts
    ? [
        a.counts.doors > 0 && t("app.workOrder.count.doors", "{n} doors", { n: a.counts.doors }),
        a.counts.drawers > 0 && t("app.workOrder.count.drawers", "{n} drawers", { n: a.counts.drawers }),
      ].filter(Boolean)
    : [];
  // A paint area's lines carry coats and product; its scope sentence already
  // says them, so it is printed as it was.
  const isPaintArea = lines.some((l) => l.coats != null || l.product != null);
  return (
    <div className="mt-1 space-y-1 text-sm text-foreground">
      {isPaintArea ? (
        a.scope ? <p>{a.scope}</p> : null
      ) : (
        lines.length > 0 && (
          <ul className="space-y-0.5">
            {lines.map((l, i) => (
              <li key={l.key || i}>
                <span className="font-medium">{l.label}</span>
                <span className="text-muted-foreground">{qtyText(l)}</span>
                {l.colour ? <span className="text-muted-foreground"> · {l.colour}</span> : null}
                {l.detail ? <span className="block text-xs text-muted-foreground">{l.detail}</span> : null}
              </li>
            ))}
          </ul>
        )
      )}
      {counts.length > 0 && <p className="font-semibold">{counts.join(" · ")}</p>}
      {facts.length > 0 && <p className="text-muted-foreground">{facts.join(" · ")}</p>}
      {a.included?.length > 0 && (
        <div className="pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("app.workOrder.included", "What's included")}
          </div>
          <ul className="ml-4 list-disc text-xs text-foreground/90">
            {a.included.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Below the areas: the options the client chose, materials, checklist, visits. */
function JobExtras({ wo, t, language }) {
  const addOns = wo.addOns || [];
  const materials = wo.materials || [];
  const checklist = wo.checklist || [];
  const visits = (wo.visits || []).filter((v) => v.notes || v.scheduledAt);
  if (!addOns.length && !materials.length && !checklist.length && !visits.length) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {addOns.length > 0 && (
        <Panel title={t("app.workOrder.addOns", "Options the client chose")}>
          <ul className="space-y-1">
            {addOns.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.description}</span>
                {a.area ? <span className="text-muted-foreground"> · {a.area}</span> : null}
                {a.detail ? <span className="block text-xs text-muted-foreground">{a.detail}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {materials.length > 0 && (
        <Panel title={t("app.workOrder.materials", "Materials")}>
          <ul className="space-y-0.5">
            {materials.map((m, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className={m.bought ? "text-muted-foreground line-through" : ""}>{m.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {m.qty}
                  {m.unit ? ` ${m.unit}` : ""}
                  {m.bought ? ` · ${t("app.workOrder.bought", "bought")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {checklist.length > 0 && (
        <Panel title={t("app.workOrder.checklist", "Checklist")}>
          <ul className="space-y-0.5">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-sm border ${c.done ? "border-emerald-600 bg-emerald-600" : "border-muted-foreground"}`} />
                <span>
                  {c.label}
                  {c.required ? <span className="text-xs text-muted-foreground"> · {t("app.workOrder.required", "required")}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {visits.length > 0 && (
        <Panel title={t("app.workOrder.visits", "Visits")}>
          <ul className="space-y-1.5">
            {visits.map((v, i) => (
              <li key={v.id || i}>
                <span className="font-medium">
                  {v.scheduledAt ? `${formatWeekdayDayMonth(new Date(v.scheduledAt), language)}, ${formatTimeOfDay(v.scheduledAt, language)}` : ""}
                </span>
                {v.assignee ? <span className="text-muted-foreground"> · {v.assignee}</span> : null}
                {v.notes ? <span className="block text-xs text-foreground/90">“{v.notes}”</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
