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

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, PenLine, Eraser, X } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";
import DayMapView, { ymdOf } from "@/app/components/schedule/DayMapView";
import { readPolygon } from "@/lib/workAreas/polygon";

export default function WorkAreasPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canAssign = access.canChange("workarea:assign");
  const [workAreas, setWorkAreas] = useState([]);
  // Refused is not empty. The read-only branch below states "none yet",
  // which a failed request has no standing to say.
  const [loadError, setLoadError] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  // ── The map ──────────────────────────────────────────────────────────────
  //
  // The same day map the calendar shows (DayMapView), coloured by the
  // assignee's WORK AREA rather than by the assignee, with each area's drawn
  // zone underneath. Drawing is offered only behind workarea:assign, the
  // permission that already decides whose patch a street is; everyone else
  // sees the zones read-only.
  //
  // Nothing else reads WorkArea.polygon yet. No dispatch, filter or price is
  // derived from it — it is a picture of the zone, and the page says so.
  const [mapDay, setMapDay] = useState(() => ymdOf(new Date()));
  const [drawingFor, setDrawingFor] = useState(null);
  const [drawingCount, setDrawingCount] = useState(0);
  const [finishNonce, setFinishNonce] = useState(0);
  const [savingPolygon, setSavingPolygon] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [waRes, mRes] = await Promise.all([
          fetch("/api/work-areas"),
          fetch("/api/settings/members"),
        ]);
        // Don't feed an error body into the setters. "Leave lists empty so the
        // page renders normally" was the old reasoning, and it is what made
        // this page print "No work areas yet" — a statement about the company —
        // when /api/work-areas had in fact refused to answer. The toast that
        // said otherwise fades; the sentence stays.
        //
        // The two responses are also handled independently now. `return`ing on
        // the first failure abandoned the second, so a work-areas 500 silently
        // produced an empty roster as well.
        if (!waRes.ok) {
          setLoadError(await reportResponseError(waRes));
        } else {
          const wa = await waRes.json();
          setWorkAreas(Array.isArray(wa) ? wa : []);
          setLoadError("");
        }
        if (!mRes.ok) {
          await reportResponseError(mRes);
        } else {
          const m = await mRes.json();
          setMembers(Array.isArray(m) ? m : []);
        }
      } catch {
        // Was silent: a network rejection left the page stuck on the skeleton.
        const msg = t("app.load.network");
        setLoadError(msg);
        showError(msg);
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

  // Which area colours a stop: the assignee's first area by name. A person
  // on two areas is coloured by one of them, consistently; a person on none
  // is grey, like an unassigned stop.
  const areaOfUser = useMemo(() => {
    const map = new Map();
    for (const wa of [...workAreas].sort((a, b) => a.name.localeCompare(b.name))) {
      for (const a of wa.assignments || []) {
        if (!map.has(a.userId)) map.set(a.userId, wa.id);
      }
    }
    return map;
  }, [workAreas]);
  const groupOf = useCallback(
    (entry) => (entry.assignedToId ? areaOfUser.get(entry.assignedToId) || null : null),
    [areaOfUser],
  );
  const polygons = useMemo(
    () =>
      workAreas
        .map((wa) => ({ id: wa.id, name: wa.name, path: readPolygon(wa.polygon) }))
        .filter((p) => p.path),
    [workAreas],
  );
  const legend = useMemo(() => workAreas.map((wa) => ({ id: wa.id, name: wa.name })), [workAreas]);

  async function savePolygon(workAreaId, polygon) {
    setSavingPolygon(workAreaId);
    try {
      const updated = await fetchJson(`/api/work-areas/${encodeURIComponent(workAreaId)}/polygon`, {
        method: "PUT",
        body: { polygon },
      });
      setWorkAreas((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      showError(err.message || t("app.load.network"));
    } finally {
      setSavingPolygon(null);
      setDrawingFor(null);
    }
  }

  const drawing = canAssign
    ? {
        forId: drawingFor,
        onComplete: (path) => drawingFor && savePolygon(drawingFor, path),
        onProgress: setDrawingCount,
        finishNonce,
      }
    : null;

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
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
        {loadError && (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        )}
        {!loadError && !canAssign && workAreas.length === 0 && (
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="font-medium text-foreground">{wa.name}</div>
                {/* The zone: drawn, not drawn, being drawn. Only the
                    permission that assigns people may draw; a reader sees a
                    word, not a disabled button. */}
                {canAssign ? (
                  drawingFor === wa.id ? (
                    <button
                      type="button"
                      onClick={() => setDrawingFor(null)}
                      className="inline-flex items-center gap-1 text-xs min-h-[36px] px-3 rounded-full border border-inverted bg-inverted text-inverted-foreground"
                    >
                      <X size={12} /> {t("app.setWorkAreas.drawingCancel", "Stop drawing")}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDrawingCount(0);
                          setDrawingFor(wa.id);
                        }}
                        disabled={savingPolygon === wa.id}
                        className="inline-flex items-center gap-1 text-xs min-h-[36px] px-3 rounded-full border border-border hover:bg-muted disabled:opacity-50"
                      >
                        <PenLine size={12} />
                        {readPolygon(wa.polygon)
                          ? t("app.setWorkAreas.redraw", "Redraw zone")
                          : t("app.setWorkAreas.draw", "Draw zone on the map")}
                      </button>
                      {readPolygon(wa.polygon) && (
                        <button
                          type="button"
                          onClick={() => savePolygon(wa.id, null)}
                          disabled={savingPolygon === wa.id}
                          className="inline-flex items-center gap-1 text-xs min-h-[36px] px-3 rounded-full border border-border hover:bg-muted disabled:opacity-50"
                        >
                          <Eraser size={12} /> {t("app.setWorkAreas.clearZone", "Clear zone")}
                        </button>
                      )}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {readPolygon(wa.polygon)
                      ? t("app.setWorkAreas.zoneDrawn", "Zone drawn")
                      : t("app.setWorkAreas.zoneNotDrawn", "No zone drawn")}
                  </span>
                )}
              </div>
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

      {/* ── The map ──────────────────────────────────────────────────────
          Below the list, because the list is the answer to "who is on what"
          and the map is where they are today. */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          {t("app.setWorkAreas.mapTitle", "Today on the map")}
        </h2>
        {drawingFor && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border border-border bg-muted px-3 py-2">
            <p className="min-w-0">
              {t("app.setWorkAreas.drawingHint", "Click the map to place the corners of {name}'s zone; click the first corner again to close it.", {
                name: workAreas.find((w) => w.id === drawingFor)?.name || "",
              })}
            </p>
            {/* Offered only once there is a zone to finish: three corners.
                Before that it would be a button that does nothing. */}
            {drawingCount >= 3 && (
              <button
                type="button"
                onClick={() => setFinishNonce((n) => n + 1)}
                disabled={savingPolygon === drawingFor}
                className="shrink-0 inline-flex items-center min-h-[36px] px-3 rounded-full bg-inverted text-inverted-foreground text-xs font-medium disabled:opacity-50"
              >
                {t("app.setWorkAreas.finishZone", "Finish zone ({n} corners)", { n: drawingCount })}
              </button>
            )}
          </div>
        )}
        <DayMapView
          day={mapDay}
          onDayChange={setMapDay}
          groupOf={groupOf}
          legend={legend}
          polygons={polygons}
          drawing={drawing}
          explain={t(
            "app.setWorkAreas.mapExplain",
            "Stops are coloured by the person's work area, numbered per person in time order. A drawn zone is optional and is only a picture for now — nothing is dispatched or priced from it yet.",
          )}
        />
      </section>
    </div>
  );
}
