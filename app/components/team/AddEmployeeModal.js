// app/components/team/AddEmployeeModal.js
"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function AddEmployeeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    role: "employee",
    workerType: "employee",
    hourlyRate: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/team/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not add employee");
      return;
    }

    onAdded?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Add Employee</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">
                First name
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
                className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                Last name
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used for login access and job notifications.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Province"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              For your own withholding estimates only — not tax advice. Confirm
              requirements with an accountant.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">
                Access role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm bg-card"
              >
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                Worker type
              </label>
              <select
                value={form.workerType}
                onChange={(e) =>
                  setForm({ ...form, workerType: e.target.value })
                }
                className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm bg-card"
              >
                <option value="employee">Employee (W-2)</option>
                <option value="contractor">Contractor (1099)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              Hourly rate (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Send Invite & Add Employee"}
          </button>
        </form>
      </div>
    </div>
  );
}
