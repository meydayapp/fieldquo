// app/(app)/appointments/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, MapPin, User as UserIcon, ShieldAlert, X, Car, AlertTriangle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { travelLegs, describeTravel } from "@/lib/booking/travel";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  needs_supervisor: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * The drive between each appointment and the one before it.
 *
 * Grouped BY ASSIGNEE first. The list is one chronological stream across the
 * whole company, so pairing neighbours blind would show a painter the drive
 * from a plumber's last job — a number that is not merely useless but actively
 * misleading, because it looks exactly like a real one.
 *
 * Unassigned appointments are skipped rather than lumped together: "nobody" is
 * not a person with a van.
 */
function legsByAppointment(appointments) {
  const byPerson = new Map();
  for (const a of appointments) {
    if (!a.assignedToId) continue;
    if (!byPerson.has(a.assignedToId)) byPerson.set(a.assignedToId, []);
    byPerson.get(a.assignedToId).push(a);
  }

  const out = new Map();
  for (const list of byPerson.values()) {
    const stops = list
      .slice()
      .sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt))
      .map((a) => ({
        id: a.id,
        at: a.scheduledAt,
        endAt: a.booking?.endTime || null,
        latitude: a.latitude,
        longitude: a.longitude,
      }));
    for (const leg of travelLegs(stops)) out.set(leg.id, leg);
  }
  return out;
}

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    // Was a bare Promise.all(...).then(): if either request 500'd, r.json()
    // threw, the .then never ran, and setLoading(false) never fired — the page
    // sat on its skeleton forever with nothing to report.
    (async () => {
      try {
        const [appts, mem] = await Promise.all([
          fetchJson("/api/appointments"),
          fetchJson("/api/settings/members"),
        ]);
        setAppointments(appts);
        setMembers(mem);
      } catch (err) {
        setError(err.message || "Could not load appointments");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

  const legs = useMemo(() => legsByAppointment(appointments), [appointments]);

  const assign = async (id, assignedToId) => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">{t("app.appts.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.appts.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 shrink-0"
        >
          <Plus size={16} />{t("app.appts.new")}</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {["all", "scheduled", "needs_supervisor", "completed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${
                filter === s
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ),
        )}
      </div>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">{error}</p>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-accent rounded-lg" />
          <div className="h-20 bg-accent rounded-lg" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
          {t("app.appts.empty")}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((appt) => {
          // Read from the FULL list, not `filtered`. A drive is measured from
          // the previous stop, and that stop may be filtered off screen —
          // computing legs over the visible subset would quietly invent a
          // drive from whatever happened to be above it.
          const leg = legs.get(appt.id);
          return (
          <div key={appt.id}>
          {leg?.travel && (
            <div
              className={`flex items-center gap-1.5 text-xs px-1 pb-1.5 ${
                leg.tight
                  ? "text-amber-700 dark:text-amber-400 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {leg.tight ? <AlertTriangle size={12} /> : <Car size={12} />}
              <span>
                {describeTravel(leg.travel)}
                {leg.gapMinutes != null && ` · ${leg.gapMinutes} min gap`}
                {leg.tight && ` · ${leg.shortBy} min short`}
              </span>
            </div>
          )}
          <div className="glass-effect card-hover rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {appt.client?.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[appt.status]}`}
                  >
                    {appt.status.replace("_", " ")}
                  </span>
                  {appt.requiresSupervisor && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <ShieldAlert size={12} />{t("app.appts.supervisorRequired")}</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {new Date(appt.scheduledAt).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                {appt.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{appt.location}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <UserIcon size={14} className="text-muted-foreground" />
                <select
                  value={appt.assignedToId || ""}
                  onChange={(e) => assign(appt.id, e.target.value || null)}
                  className="border rounded px-2 py-1.5 text-sm bg-card"
                >
                  <option value="">{t("app.appts.unassigned")}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                      {appt.requiresSupervisor &&
                      !["owner", "admin", "supervisor"].includes(m.role)
                        ? " (not a supervisor)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          </div>
          );
        })}
      </div>

      {showForm && (
        <NewAppointmentModal
          members={members}
          onClose={() => setShowForm(false)}
          onCreated={(appt) => {
            setAppointments((prev) => [appt, ...prev]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function NewAppointmentModal({ members, onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    scheduledAt: "",
    location: "",
    requiresSupervisor: false,
    assignedToId: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      onCreated(await res.json());
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New Appointment</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.clientName")}</label>
            <input
              required
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.dateTime")}</label>
            <input
              required
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) =>
                setForm({ ...form, scheduledAt: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.location")}</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm mt-1"
              placeholder={t("app.appts.siteAddress")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresSupervisor}
              onChange={(e) =>
                setForm({ ...form, requiresSupervisor: e.target.checked })
              }
            />
            {t("app.appts.supervisorHint")}
          </label>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.assignTo")}</label>
            <select
              value={form.assignedToId}
              onChange={(e) =>
                setForm({ ...form, assignedToId: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-sm mt-1 bg-card"
            >
              <option value="">{t("app.appts.unassigned")}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 w-full mt-2"
          >
            {saving ? "Creating..." : "Create Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}
