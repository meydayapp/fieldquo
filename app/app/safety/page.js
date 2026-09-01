// app/app/safety/page.js
//
// Safety incidents and near-misses. Short to fill in on a phone, standing on
// site — see lib/safety/incidentFields.js and the SafetyIncident model in
// prisma/schema.prisma for the design reasoning.
//
// ── What this page deliberately does NOT build ──────────────────────────────
//
// No "involved worker" picker — the API accepts involvedWorkerId, but a
// second person-picker on top of the job picker made the form longer than
// "report this fast" allows for a first cut. Documented in
// docs/SAFETY-AND-EQUIPMENT.md rather than silently dropped.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ListState from "@/app/components/ListState";
import { loadErrorKey, LOAD_ERROR_KEYS } from "@/lib/loadState";
import MediaUploader from "@/app/components/MediaUploader";

const KINDS = ["near_miss", "injury", "property_damage", "other"];
const STATUSES = ["open", "reviewed", "closed"];

function toLocalInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ReportForm({ t, jobs, onCreated, onCancel }) {
  const [form, setForm] = useState({
    kind: "near_miss",
    description: "",
    occurredAt: toLocalInputValue(new Date()),
    location: "",
    jobId: "",
    workStopped: false,
    regulatoryNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // the row, once saved — unlocks the photo step

  async function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/safety-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          description: form.description,
          occurredAt: new Date(form.occurredAt).toISOString(),
          location: form.location || null,
          jobId: form.jobId || null,
          workStopped: form.workStopped,
          regulatoryNote: form.regulatoryNote || null,
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.safety.form.error", "Couldn't file that report."));
        return;
      }
      const data = await res.json();
      setCreated(data.incident);
      onCreated?.(data.incident);
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          {t("app.safety.form.success", "Filed. Add a photo of the scene if you have one — optional.")}
        </p>
        <MediaUploader
          uploadUrl="/api/upload"
          value={[]}
          max={6}
          onChange={async (added) => {
            const usable = (added || []).filter((m) => m?.url);
            if (!usable.length) return;
            const res = await fetch(`/api/safety-incidents/${created.id}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photos: usable.map((m) => ({ url: m.url })) }),
            });
            if (!res.ok) {
              await reportResponseError(res, t("app.safety.photos.error", "Couldn't attach that photo."));
            }
          }}
        />
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-foreground underline"
        >
          {t("app.safety.form.done", "Done")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 font-medium text-foreground">
            {t("app.safety.form.kind", "What kind of incident")}
          </span>
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`app.safety.kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-foreground">
            {t("app.safety.form.occurredAt", "When it happened")}
          </span>
          <input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </label>
      </div>

      <label className="text-sm block">
        <span className="block mb-1 font-medium text-foreground">
          {t("app.safety.form.description", "What happened")}
        </span>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder={t("app.safety.form.descriptionPlaceholder", "In your own words — short is fine.")}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          required
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 font-medium text-foreground">
            {t("app.safety.form.location", "Where")}
          </span>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t("app.safety.form.locationPlaceholder", "e.g. second floor bathroom, the yard")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-foreground">
            {t("app.safety.form.job", "Job (optional)")}
          </span>
          <select
            value={form.jobId}
            onChange={(e) => setForm({ ...form, jobId: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("app.safety.form.jobNone", "Not tied to a job")}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.workStopped}
          onChange={(e) => setForm({ ...form, workStopped: e.target.checked })}
        />
        {t("app.safety.form.workStopped", "Work stopped because of this")}
      </label>

      <label className="text-sm block">
        <span className="block mb-1 font-medium text-foreground">
          {t("app.safety.form.regulatoryNote", "Reporting note (optional)")}
        </span>
        <textarea
          value={form.regulatoryNote}
          onChange={(e) => setForm({ ...form, regulatoryNote: e.target.value })}
          placeholder={t(
            "app.safety.form.regulatoryNotePlaceholder",
            "Anything about reporting this to a provincial authority — FieldQuo doesn't decide that for you.",
          )}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <span className="block mt-1 text-xs text-muted-foreground">
          {t(
            "app.safety.form.regulatoryNoteHelp",
            "FieldQuo doesn't know your province's reporting rules or deadlines — this is a place to write down what you decide, not a compliance check.",
          )}
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !form.description.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t("app.safety.form.submitting", "Filing…") : t("app.safety.form.submit", "File report")}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground">
          {t("app.safety.form.cancel", "Cancel")}
        </button>
      </div>
    </form>
  );
}

function KindBadge({ t, kind }) {
  const tone =
    kind === "injury"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : kind === "near_miss"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : kind === "property_damage"
          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${tone}`}>
      {t(`app.safety.kind.${kind}`)}
    </span>
  );
}

function FollowUpPanel({ t, incident, onSaved }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(incident.status);
  const [notes, setNotes] = useState(incident.followUpNotes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/safety-incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, followUpNotes: notes }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.safety.followUp.error", "Couldn't save the follow-up."));
        return;
      }
      const data = await res.json();
      onSaved?.(data.incident);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-border mt-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-semibold text-foreground"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {t("app.safety.followUp.title", "Follow up")}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`app.safety.status.${s}`)}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("app.safety.followUp.notesPlaceholder", "What was done about it")}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            {t("app.safety.followUp.save", "Save")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SafetyPage() {
  const { t, language } = useTranslation();
  const caller = usePermissions();
  const canSeeAll = hasLevel(caller, "safety", "view_all");
  const canFollowUp = hasLevel(caller, "safety", "view_edit_all");

  const [incidents, setIncidents] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setErrorKey("");
    try {
      const url = filter ? `/api/safety-incidents?status=${filter}` : "/api/safety-incidents";
      const res = await fetch(url);
      if (!res.ok) {
        setErrorKey(loadErrorKey(res.status));
        setIncidents([]);
        return;
      }
      const data = await res.json();
      setIncidents(data.incidents || []);
    } catch {
      setErrorKey(LOAD_ERROR_KEYS.network);
      setIncidents([]);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setJobs((Array.isArray(data) ? data : []).slice(0, 200)))
      .catch(() => setJobs([]));
  }, []);

  if (!hasLevel(caller, "safety", "report_own")) {
    return <NoAccessPanel capability="accessLevel" />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert size={20} />
            {t("app.safety.title", "Safety")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.safety.subtitle",
              "Injuries and near-misses. A near-miss is worth reporting exactly like an injury — it's how you learn before someone gets hurt.",
            )}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5"
          >
            <AlertTriangle size={15} />
            {t("app.safety.reportButton", "Report")}
          </button>
        )}
      </div>

      {showForm && (
        <ReportForm
          t={t}
          jobs={jobs}
          onCreated={() => load()}
          onCancel={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {canSeeAll && (
        <div className="flex items-center gap-2 text-xs">
          {["", ...STATUSES].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-full font-semibold ${
                filter === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              }`}
            >
              {s ? t(`app.safety.status.${s}`) : t("app.safety.filter.all", "All")}
            </button>
          ))}
        </div>
      )}

      <ListState
        loading={incidents === null}
        errorKey={errorKey}
        isEmpty={incidents !== null && incidents.length === 0}
        onRetry={load}
        empty={
          <div className="text-center py-10">
            <p className="text-sm font-semibold text-foreground">
              {t("app.safety.list.empty", "Nothing reported")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.safety.list.emptyBody", "That's a good thing — this is where it'll show up if it happens.")}
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          {(incidents || []).map((incident) => (
            <div key={incident.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KindBadge t={t} kind={incident.kind} />
                    {incident.workStopped && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400">
                        {t("app.safety.workStoppedBadge", "Work stopped")}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(incident.occurredAt).toLocaleString(language)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5">{incident.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {incident.location && `${incident.location} · `}
                    {incident.job?.title && `${incident.job.title} · `}
                    {t("app.safety.reportedBy", "Reported by {name}", {
                      name: incident.reportedByMember?.user?.name || incident.reportedByMember?.user?.email || "—",
                    })}
                  </p>
                  {incident.regulatoryNote && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{incident.regulatoryNote}</p>
                  )}
                  {incident.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {incident.photos.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                          <img
                            src={p.url}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover border border-border"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Camera size={13} className="opacity-0" />
                  {t(`app.safety.status.${incident.status}`)}
                </span>
              </div>
              {canFollowUp && (
                <FollowUpPanel
                  t={t}
                  incident={incident}
                  onSaved={(updated) =>
                    setIncidents((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
                  }
                />
              )}
            </div>
          ))}
        </div>
      </ListState>
    </div>
  );
}
