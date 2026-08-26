// app/components/team/AddEmployeeModal.js
//
// The onboarding card's quick "Add Employee" popup. It is the short version of
// /app/settings/team/new, not a different feature — so the two agree on what
// an access role IS (the presets in lib/permissions.js) and on the shape of
// what they post: one `name`, an address picked from Google Places, a
// FieldQuo role, and the permission grid that role starts with. The popup used
// to offer a bare "employee / supervisor / admin" list of its own and a plain
// address text box, which meant the same decision was made twice, differently,
// depending on which door the contractor walked through.
"use client";

import { useState } from "react";
import Link from "next/link";
import { X, AlertTriangle } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions/roleManagement";
import { formatPhoneInput } from "@/lib/validation";
import { fetchJson } from "@/lib/fetchJson";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card";

// The same four presets the full form offers, in the same order. "Custom" is
// deliberately absent: the grid it edits doesn't fit in this popup, and an
// option that silently did something else would be worse than a link to the
// page that actually has it.
const PRESET_KEYS = ["worker", "workerFullView", "dispatcher", "manager"];

export default function AddEmployeeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    preset: "workerFullView",
    workerType: "employee",
    hourlyRate: "",
  });
  const [error, setError] = useState("");
  // Set when the person was created but the invitation email did not go out.
  // Kept separate from `error` because it is not a failure to add them — it is
  // a failure to tell them, and it needs a different sentence and a different
  // next step.
  const [emailWarning, setEmailWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function handlePlaceSelected({ address, city, province, postalCode, country }) {
    set({
      address,
      city: city || form.city,
      province: province || form.province,
      postalCode: postalCode || form.postalCode,
      country: country || form.country,
    });
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const preset = PERMISSION_PRESETS[form.preset];

    try {
      // fetchJson, not fetch + res.json(): a route that throws returns HTML,
      // and res.json() then reports the browser's parser complaint instead of
      // the reason. Same call shape as the full New User page.
      const data = await fetchJson("/api/team/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          country: form.country,
          role: PRESET_TO_ROLE[form.preset] || "employee",
          permissions: preset ? { ...preset.values } : null,
          workerType: form.workerType,
          hourlyRate: form.hourlyRate,
        }),
      });

      setSubmitting(false);

      // The server tells us whether the invitation email actually left. Don't
      // close on a half-success — the contractor would go on believing their
      // new hire has a login on the way.
      if (data?.emailSent === false) {
        setEmailWarning(
          data.emailError || "The invitation email could not be sent.",
        );
        return;
      }

      onAdded?.();
    } catch (err) {
      setSubmitting(false);
      setError(err.message);
    }
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

        {emailWarning ? (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-sm rounded-lg px-4 py-3 space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle size={15} /> Added, but the invitation email
                didn&apos;t send
              </p>
              <p>{emailWarning}</p>
              <p>
                {form.name || "They"} won&apos;t have received anything. The
                pending invite is on the Team page — cancel it there and try
                again once email is working.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/app/settings/team"
                className="flex-1 text-center border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
              >
                Open Team page
              </Link>
              <button
                type="button"
                onClick={() => onAdded?.()}
                className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                className={`${inputClass} mt-1`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Where their invitation goes. Also used for login and job
                notifications.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => set({ phone: formatPhoneInput(e.target.value) })}
                className={`${inputClass} mt-1`}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Address
              </label>
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => set({ address: v })}
                onPlaceSelected={handlePlaceSelected}
                className={`${inputClass} mt-1`}
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="Province"
                  value={form.province}
                  onChange={(e) => set({ province: e.target.value })}
                  className={inputClass}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For your own withholding estimates only — not tax advice. Confirm
                requirements with an accountant.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Access role
              </label>
              <select
                value={form.preset}
                onChange={(e) => set({ preset: e.target.value })}
                className={`${inputClass} mt-1`}
              >
                {PRESET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PERMISSION_PRESETS[key].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {/* The access level FIRST, then the tier it sits in. It used
                    to name the tier only — "Joins as Manager." for a
                    Dispatcher — matching a Manage Team badge that made the
                    same substitution. Both now lead with the level the owner
                    actually picked, and carry the tier as the secondary fact
                    it is: two levels share one tier, so the tier can never
                    identify a person. */}
                <span className="font-medium text-foreground">
                  Joins as {PERMISSION_PRESETS[form.preset]?.label || "Worker"} (
                  {ROLE_LABELS[PRESET_TO_ROLE[form.preset]] || "Worker"} tier).
                </span>{" "}
                {PERMISSION_PRESETS[form.preset]?.description}{" "}
                <Link
                  href="/app/settings/team/new"
                  className="underline underline-offset-2"
                >
                  Need custom permissions?
                </Link>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Worker type
                </label>
                <select
                  value={form.workerType}
                  onChange={(e) => set({ workerType: e.target.value })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="employee">Employee (W-2)</option>
                  <option value="contractor">Contractor (1099)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Hourly rate (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => set({ hourlyRate: e.target.value })}
                  className={`${inputClass} mt-1`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Sending invite..." : "Send Invite & Add Employee"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
