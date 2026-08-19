// app/app/settings/work-areas/page.js
//
// ── Read-only, not hidden ──────────────────────────────────────────────────
//
// Which zones exist and who is on them is the answer to "whose patch is this",
// and a crew member has a real reason to look it up. So the page stays, and for
// anyone without "workarea:assign" it becomes what it actually is for them: a
// list. No create form, and the assignment chips render as names rather than as
// buttons.
//
// They were buttons before. Tapping one fired a PATCH that came back with
// `Forbidden: missing permission "workarea:assign"` — a developer's identifier
// in a toast, on a screen where nothing had told them the control wasn't
// theirs. The raw string is fixed at the source (lib/permissions.js), but the
// better fix is not offering the control: the sentence they now read names who
// to ask instead of what failed.
"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

export default function WorkAreasPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canAssign = access.canChange("workarea:assign");
  const [workAreas, setWorkAreas] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [waRes, mRes] = await Promise.all([
          fetch("/api/work-areas"),
          fetch("/api/settings/members"),
        ]);
        // Don't feed an error body into the setters — leave lists empty so the
        // page renders normally instead of choking on a 404/500 payload.
        if (!waRes.ok) return reportResponseError(waRes);
        if (!mRes.ok) return reportResponseError(mRes);
        const wa = await waRes.json();
        const m = await mRes.json();
        setWorkAreas(Array.isArray(wa) ? wa : []);
        setMembers(Array.isArray(m) ? m : []);
      } catch {
        // Was silent: a network rejection left the page stuck on the skeleton.
        showError("Couldn't load work areas. Check your connection and retry.");
      } finally {
        setLoading(false);
      }
    })();
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
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
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
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.setWorkAreas.title", "Work Areas")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setWorkAreas.subtitle", "Group tasks by project or zone and assign your team.")}
        </p>
      </div>

      {canAssign ? (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            placeholder={t("app.setWorkAreas.namePlaceholder", "New work area name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <button
            type="submit"
            className="bg-inverted text-inverted-foreground px-4 rounded-full"
          >
            <Plus size={14} />
          </button>
        </form>
      ) : (
        <ReadOnlyNotice
          capability="workarea:assign"
          what={t("app.setWorkAreas.readOnlyWhat")}
        />
      )}

      <div className="space-y-3">
        {/* Only in the read-only case. Someone who can create one is looking at
            the form above, which is its own empty state; someone who can't
            would otherwise be looking at nothing at all and wondering whether
            the page had failed to load. */}
        {!canAssign && workAreas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("app.setWorkAreas.noneYet")}
          </p>
        )}
        {workAreas.map((wa) => {
          const assignedIds = wa.assignments.map((a) => a.userId);
          return (
            <div
              key={wa.id}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="font-medium text-foreground mb-2">{wa.name}</div>
              {canAssign ? (
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
                            ? "bg-inverted text-inverted-foreground border-inverted"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {m.user.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Only the people actually ON the area, and as text. The full
                // roster with the unassigned half greyed out is the "disabled
                // control" pattern in another costume — it still reads as a
                // picker, and the unassigned names are noise to someone who
                // can't move them.
                <div className="text-sm text-muted-foreground">
                  {assignedIds.length === 0
                    ? t("app.setWorkAreas.nobodyAssigned")
                    : members
                        .filter((m) => assignedIds.includes(m.userId))
                        .map((m) => m.user.name)
                        .join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
