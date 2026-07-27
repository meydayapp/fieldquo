// app/app/settings/work-areas/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";

export default function WorkAreasPage() {
  const [workAreas, setWorkAreas] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/work-areas").then((r) => r.json()),
      fetch("/api/settings/members").then((r) => r.json()),
    ]).then(([wa, m]) => {
      setWorkAreas(Array.isArray(wa) ? wa : []);
      setMembers(Array.isArray(m) ? m : []);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/work-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const created = await res.json();
      setWorkAreas((prev) => [...prev, created]);
      setName("");
    }
  }

  async function toggleAssignment(workAreaId, userId, currentlyAssigned) {
    const workArea = workAreas.find((w) => w.id === workAreaId);
    const currentUserIds = workArea.assignments.map((a) => a.userId);
    const nextUserIds = currentlyAssigned
      ? currentUserIds.filter((id) => id !== userId)
      : [...currentUserIds, userId];

    const res = await fetch("/api/work-areas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workAreaId, userIds: nextUserIds }),
    });
    if (res.ok) {
      const updated = await res.json();
      setWorkAreas((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Areas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Group tasks by project or zone and assign your team.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          placeholder="New work area name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1"
        />
        <button
          type="submit"
          className="bg-gray-900 text-white px-4 rounded-full"
        >
          <Plus size={14} />
        </button>
      </form>

      <div className="space-y-3">
        {workAreas.map((wa) => {
          const assignedIds = wa.assignments.map((a) => a.userId);
          return (
            <div
              key={wa.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="font-medium text-gray-900 mb-2">{wa.name}</div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const assigned = assignedIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      onClick={() =>
                        toggleAssignment(wa.id, m.userId, assigned)
                      }
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        assigned
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {m.user.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
