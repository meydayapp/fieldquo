// app/platform/team/page.js
//
// FieldQuo's own staff accounts. Separate from tenant Members entirely —
// PlatformAdmin has its own table, its own bcrypt passwords and its own JWT.
// There is no signup page for these, deliberately: they're created here by an
// existing superadmin, or by scripts/seed-platform-admin.mjs for the first one.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  ShieldCheck,
  AlertCircle,
  UserX,
  UserCheck,
} from "lucide-react";

const ROLE_META = {
  superadmin: {
    label: "Superadmin",
    description: "Everything, including creating other staff accounts.",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  admin: {
    label: "Admin",
    description:
      "Manage and suspend companies, manage plans, impersonate, view analytics.",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  support: {
    label: "Support",
    description:
      "View companies, impersonate, view analytics. Cannot change plans or suspend.",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

export default function PlatformTeamPage() {
  const [admins, setAdmins] = useState([]);
  const [me, setMe] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/admins");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${res.status}).`);
      }
      setAdmins(await res.json());

      const meRes = await fetch("/api/platform/me").catch(() => null);
      if (meRes?.ok) setMe(await meRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't create account.");

      setDraft(null);
      setNotice(
        `Created ${data.email}. Send them the password over something other than email — it's the only copy.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(target, active) {
    if (
      !confirm(
        active
          ? `Reactivate ${target.email}?`
          : `Deactivate ${target.email}? They'll be signed out and unable to log in.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/admins/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't update.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isSuperadmin = me?.role === "superadmin";
  const activeSuperadmins = admins.filter(
    (a) => a.role === "superadmin" && a.active,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform team</h1>
          <p className="text-sm text-gray-500 mt-1">
            FieldQuo staff accounts. These can see across every company.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() =>
              setDraft({ email: "", password: "", role: "support" })
            }
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={14} /> Add staff
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {draft && (
        <div className="bg-white border border-gray-900 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New staff account</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="text"
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
                placeholder="At least 12 characters"
                className={`${inputClass} font-mono text-xs`}
              />
              {/* Deliberately not a password input. There's no reset flow for
                  these accounts, so whoever creates it needs to read it back
                  to send it on. Hiding it just causes typos. */}
              <p className="text-xs text-gray-400 mt-1">
                Visible so you can copy it. There&apos;s no reset email for
                platform accounts.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className={inputClass}
              >
                <option value="support">Support</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {ROLE_META[draft.role]?.description}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={
                busy || !draft.email.trim() || draft.password.length < 12
              }
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {admins.map((a) => {
            const meta = ROLE_META[a.role] || {};
            // Never let the last active superadmin be switched off — there'd
            // be nobody left who can create staff accounts, and recovery is a
            // manual database edit.
            const isLastSuperadmin =
              a.role === "superadmin" && a.active && activeSuperadmins <= 1;

            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium truncate ${a.active ? "text-gray-900" : "text-gray-400 line-through"}`}
                    >
                      {a.email}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${meta.className || "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {meta.label || a.role}
                    </span>
                    {me?.id === a.id && (
                      <span className="text-xs text-gray-400">you</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {meta.description}
                  </p>
                </div>

                {isSuperadmin && me?.id !== a.id && (
                  <button
                    onClick={() => setActive(a, !a.active)}
                    disabled={busy || isLastSuperadmin}
                    title={
                      isLastSuperadmin
                        ? "The last superadmin can't be deactivated"
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0"
                  >
                    {a.active ? (
                      <>
                        <UserX size={13} /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={13} /> Reactivate
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex gap-2">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-gray-400" />
        <div>
          <p className="font-medium text-gray-800">
            No self-signup, by design.
          </p>
          <p className="mt-1">
            Staff accounts exist only if a superadmin creates one here, or via{" "}
            <span className="font-mono text-xs">
              scripts/seed-platform-admin.mjs
            </span>
            . There&apos;s no password reset email either — re-running the seed
            script for an existing address resets it.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";
