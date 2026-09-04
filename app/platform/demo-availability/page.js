"use client";

// app/platform/demo-availability/page.js
//
// When FieldQuo's own staff will run a product demo. These rows ARE the
// marketing hero's calendar — /api/demo/slots offers the union of what is set
// here and nothing else.
//
// ── This screen edits, and that is not a mistake ───────────────────────────
//
// Everywhere else in this console FieldQuo can look at a company's data and not
// touch it. This is FieldQuo's OWN calendar, not a customer's, so editing is
// the point. Before it existed the hours were three constants in
// lib/demo/slots.js that published 6–10pm seven days a week to every visitor.
//
// ── Empty means empty ──────────────────────────────────────────────────────
//
// An admin with no windows offers nothing, and if nobody has any, the hero says
// "No open times right now" rather than inventing a grid. The panel says so out
// loud, because "I saved nothing and slots vanished" should never be a surprise.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertCircle,
  CalendarClock,
  Plus,
  Trash2,
  Save,
  Info,
} from "lucide-react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// The zones the runtime itself knows. A hand-written list would drift and would
// let someone pick a name the server can't resolve, which produces zero slots
// with no explanation.
function timezoneOptions() {
  try {
    const all = Intl.supportedValuesOf?.("timeZone");
    if (Array.isArray(all) && all.length) return all;
  } catch {
    /* older runtime — fall through */
  }
  return ["America/Toronto", "America/Vancouver", "America/New_York", "UTC"];
}

const inputClass =
  "border border-border rounded-lg px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10";

export default function DemoAvailabilityPage() {
  const [admins, setAdmins] = useState(null);
  const [me, setMe] = useState(null);
  const [drafts, setDrafts] = useState({}); // adminId → { windows, timezone }
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const zones = useMemo(timezoneOptions, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/platform/demo-availability");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
      setAdmins(data.admins);
      setMe(data.me);
      setDrafts(Object.fromEntries(data.admins.map((a) => [a.id, draftFrom(a)])));
    } catch (err) {
      // "failed", not []. An empty array rendered as a page with no admins on
      // it at all, sitting above the panel that explains "Nobody available
      // means no slots" — so a request that did not arrive read as a calendar
      // with nothing in it, on the screen that decides what the marketing site
      // offers the public.
      setError(err.message);
      setAdmins("failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(admin) {
    const draft = drafts[admin.id];
    setSavingId(admin.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/platform/demo-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: admin.id,
          windows: draft.windows.map((w) => ({ ...w, timezone: draft.timezone })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't save.");
      setNotice(
        data.windows.length === 0
          ? `${admin.email} now offers no demo slots.`
          : `Saved ${data.windows.length} window${data.windows.length === 1 ? "" : "s"} for ${admin.email}.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId("");
    }
  }

  if (admins === null) {
    return (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2 py-8">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (admins === "failed") {
    return (
      <div className="max-w-4xl space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Demo availability</h1>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Nobody&apos;s hours could be read, so none are shown. This is not an
          empty calendar — whatever is stored is still what the marketing site
          offers, and nothing has been cleared.
        </p>
        <button
          onClick={load}
          className="text-sm font-semibold text-foreground underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Demo availability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          When you&apos;ll run a product demo. The marketing site offers exactly
          these hours — the union across everyone here — minus what&apos;s
          already booked.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {admins.map((admin) => {
        const draft = drafts[admin.id];
        if (!draft) return null;
        const canEdit = me?.role === "superadmin" || me?.id === admin.id;
        const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(admin));
        const total = draft.windows.length;

        return (
          <section
            key={admin.id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <header className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarClock size={15} className="text-muted-foreground shrink-0" />
                  <span
                    className={`font-semibold ${admin.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                  >
                    {admin.email}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    {admin.role}
                  </span>
                  {me?.id === admin.id && (
                    <span className="text-xs text-muted-foreground">you</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {!admin.active
                    ? "Deactivated — these hours are ignored until the account is reactivated."
                    : total === 0
                      ? "No hours set. Offers nothing on the marketing site."
                      : `${total} window${total === 1 ? "" : "s"} across the week.`}
                </p>
                {/* The editor holds ONE timezone per person, which is true of
                    people. Rows that disagree can only come from the API, and
                    saving would rewrite them all — so say so first rather than
                    flattening someone's data without telling them. */}
                {mixedZones(admin).length > 1 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Stored in more than one timezone ({mixedZones(admin).join(", ")}).
                    Saving will put every window in {draft.timezone}.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={draft.timezone}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [admin.id]: { ...d[admin.id], timezone: e.target.value },
                    }))
                  }
                  className={`${inputClass} max-w-[15rem] disabled:opacity-50`}
                >
                  {zones.includes(draft.timezone) ? null : (
                    <option value={draft.timezone}>{draft.timezone}</option>
                  )}
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => save(admin)}
                  disabled={!canEdit || !dirty || savingId === admin.id}
                  className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                >
                  {savingId === admin.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save
                </button>
              </div>
            </header>

            <div className="divide-y divide-border">
              {DAYS.map((label, dayOfWeek) => {
                const rows = draft.windows
                  .map((w, index) => ({ ...w, index }))
                  .filter((w) => w.dayOfWeek === dayOfWeek);

                return (
                  <div
                    key={dayOfWeek}
                    className="px-5 py-3 flex flex-wrap items-center gap-3"
                  >
                    <span className="w-24 shrink-0 text-sm font-medium text-foreground">
                      {label}
                    </span>

                    {rows.length === 0 ? (
                      <span className="text-sm text-muted-foreground flex-1">
                        Nothing offered
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        {rows.map((row) => (
                          <div key={row.index} className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={row.startTime}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setDrafts((d) =>
                                  patchWindow(d, admin.id, row.index, {
                                    startTime: e.target.value,
                                  }),
                                )
                              }
                              className={`${inputClass} disabled:opacity-50`}
                            />
                            <span className="text-muted-foreground text-sm">–</span>
                            <input
                              type="time"
                              value={row.endTime}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setDrafts((d) =>
                                  patchWindow(d, admin.id, row.index, {
                                    endTime: e.target.value,
                                  }),
                                )
                              }
                              className={`${inputClass} disabled:opacity-50`}
                            />
                            {canEdit && (
                              <button
                                onClick={() =>
                                  setDrafts((d) => removeWindow(d, admin.id, row.index))
                                }
                                aria-label={`Remove ${label} ${row.startTime}–${row.endTime}`}
                                // red-600 on red-50 is 4.36:1; red-700 is 5.87:1.
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => setDrafts((d) => addWindow(d, admin.id, dayOfWeek))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 shrink-0"
                      >
                        <Plus size={12} /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground flex gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">
            Nobody available means no slots — not default hours.
          </p>
          <p className="mt-1">
            With every week here empty, the homepage shows &ldquo;No open times
            right now&rdquo; and points people at{" "}
            <span className="font-mono text-xs">hello@fieldquo.com</span>. Times
            are stored as wall-clock in each person&apos;s own timezone, so a
            6:00 PM slot stays 6:00 PM across the daylight-saving change.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The distinct timezones an admin's stored rows use. */
function mixedZones(admin) {
  return [...new Set(admin.demoAvailability.map((w) => w.timezone))];
}

/** Server rows → the editable draft. Timezone is per person, not per row. */
function draftFrom(admin) {
  return {
    timezone: admin.demoAvailability[0]?.timezone || "America/Toronto",
    windows: admin.demoAvailability.map((w) => ({
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
    })),
  };
}

function patchWindow(drafts, adminId, index, patch) {
  const windows = drafts[adminId].windows.map((w, i) =>
    i === index ? { ...w, ...patch } : w,
  );
  return { ...drafts, [adminId]: { ...drafts[adminId], windows } };
}

function removeWindow(drafts, adminId, index) {
  const windows = drafts[adminId].windows.filter((_, i) => i !== index);
  return { ...drafts, [adminId]: { ...drafts[adminId], windows } };
}

/** A new window opens 09:00–17:00 — a starting point to edit, saved only if
 *  the person presses Save. Nothing reaches the database unread. */
function addWindow(drafts, adminId, dayOfWeek) {
  const windows = [
    ...drafts[adminId].windows,
    { dayOfWeek, startTime: "09:00", endTime: "17:00" },
  ];
  return { ...drafts, [adminId]: { ...drafts[adminId], windows } };
}
