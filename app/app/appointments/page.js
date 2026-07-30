// app/(app)/appointments/page.js
"use client";

import { useEffect, useState } from "react";
import { Plus, MapPin, User as UserIcon, ShieldAlert, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  needs_supervisor: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments").then((r) => r.json()),
      fetch("/api/settings/members").then((r) => r.json()),
    ]).then(([appts, mem]) => {
      setAppointments(appts);
      setMembers(mem);
      setLoading(false);
    });
  }, []);

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

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
          className="admin-btn-primary flex items-center justify-center gap-2 shrink-0"
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
        {filtered.map((appt) => (
          <div key={appt.id} className="glass-effect card-hover rounded-lg p-4">
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
        ))}
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
              <option value="">Unassigned</option>
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
            className="admin-btn-primary w-full mt-2"
          >
            {saving ? "Creating..." : "Create Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}
