// app/app/team/settings/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Clock, Mail } from "lucide-react";

const ROLE_OPTIONS = ["owner", "admin", "supervisor", "employee"];

function timeAgo(date) {
  if (!date) return "Never";
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function TeamOverviewPage() {
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [seats, setSeats] = useState({ used: 0, limit: null });
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/settings/members").then((r) => r.json()),
      fetch("/api/settings/members/pending").then((r) =>
        r.ok ? r.json() : { pending: [], seats: {} },
      ),
    ]).then(([memberData, pendingData]) => {
      setMembers(Array.isArray(memberData) ? memberData : []);
      setPending(Array.isArray(pendingData.pending) ? pendingData.pending : []);
      setSeats(pendingData.seats || { used: 0, limit: null });
    });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function updateMember(userId, patch) {
    setSavingUserId(userId);
    try {
      const res = await fetch("/api/settings/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      if (res.ok) await load();
    } finally {
      setSavingUserId(null);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Team</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-lg">
            Add or manage team members that need to log into FieldQuo in the
            office or in the field. Dispatch them to job sites or give them
            access to more FieldQuo features.
          </p>
        </div>
        <Link
          href="/app/settings/team/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-full text-sm font-semibold shrink-0"
        >
          <Plus size={14} /> Add User
        </Link>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="font-medium text-gray-900">
          {seats.used}
          {seats.limit ? ` / ${seats.limit}` : ""}
        </span>{" "}
        active users {seats.limit ? "and unallocated licenses" : ""}
        {seats.limit && seats.used >= seats.limit && (
          <span className="text-amber-600 font-medium">
            · At your plan's limit
          </span>
        )}
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/app/settings/team/workers"
          className="border border-gray-300 rounded-full px-4 py-2"
        >
          Workers
        </Link>
        <Link
          href="/app/settings/team/timesheets"
          className="border border-gray-300 rounded-full px-4 py-2"
        >
          Timesheets
        </Link>
        <Link
          href="/app/settings/team/payroll"
          className="border border-gray-300 rounded-full px-4 py-2"
        >
          Payroll
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Name / Email</span>
          <span>Role</span>
          <span>Last Login</span>
          <span>Active</span>
        </div>

        <div className="divide-y divide-gray-100">
          {members.map((m) => (
            <div
              key={m.userId}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {m.user.name}
                </div>
                <div className="text-xs text-gray-500">{m.user.email}</div>
              </div>

              {m.role === "owner" ? (
                <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full capitalize w-fit">
                  Owner
                </span>
              ) : (
                <select
                  value={m.role}
                  disabled={savingUserId === m.userId}
                  onChange={(e) =>
                    updateMember(m.userId, { role: e.target.value })
                  }
                  className="text-xs border border-gray-300 rounded-full px-2.5 py-1 capitalize bg-white"
                >
                  {ROLE_OPTIONS.filter((r) => r !== "owner").map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}

              <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
                <Clock size={12} /> {timeAgo(m.lastLoginAt)}
              </span>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={m.active}
                  disabled={m.role === "owner" || savingUserId === m.userId}
                  onChange={(e) =>
                    updateMember(m.userId, { active: e.target.checked })
                  }
                />
              </label>
            </div>
          ))}

          {pending.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center bg-gray-50/60"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {p.name || p.email}
                </div>
                <div className="text-xs text-gray-500">{p.email}</div>
              </div>
              <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                <Mail size={11} /> Invited
              </span>
              <span className="text-xs text-gray-400">—</span>
              <span className="text-xs text-gray-400">—</span>
            </div>
          ))}

          {members.length === 0 && pending.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">
              No team members yet.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        The account used to register FieldQuo is the owner — at least one
        account always needs a top-level (owner or admin) role.
      </p>
    </div>
  );
}
