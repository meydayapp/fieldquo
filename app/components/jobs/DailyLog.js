"use client";

// app/components/jobs/DailyLog.js
//
// One day of a job, written down. The panel that owns loading, autosaving and
// the conflict that autosaving makes possible.
//
// ══ What autosave costs, and what pays for it ══════════════════════════════
//
// Autosave without a conflict check is a faster way to overwrite a colleague:
// the write nobody asked for is also the write nobody watches, so a lost
// paragraph is discovered days later by the person who typed it. A daily log
// is the row two crew members most plausibly both have open — end of shift,
// two phones, one Tuesday.
//
// So every save carries the `updatedAt` this screen loaded, the server puts
// that inside the WHERE (lib/concurrency/staleWrite.js), and a miss comes back
// as a 409 this panel STOPS on. It does not retry, it does not merge, and it
// does not clear the box — the words stay on screen, unsaved, and the person
// decides. Retrying an autosave against a conflict would be an infinite loop
// that eventually wins, which is the silent overwrite with extra steps.
//
// ══ Why the day comes from the browser ═════════════════════════════════════
//
// logDate is a calendar DAY at UTC midnight, and only the browser knows which
// calendar day the person means. A crew member filling yesterday's log at 6am
// picks yesterday and gets yesterday's row — see lib/jobs/dailyLog.js's header
// for why the server refuses to infer this from an instant.

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Camera, CheckCircle2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { readStaleConflict } from "@/lib/concurrency/staleWriteClient";
import StaleWriteBanner from "@/app/components/StaleWriteBanner";
import DailyLogEditor from "@/app/components/jobs/DailyLogEditor";
import {
  localDayKey,
  shiftDayKey,
  bodyToText,
  seedBody,
} from "@/lib/jobs/dailyLog";

/** Long enough that a sentence isn't three saves, short enough to survive a
 *  phone locking itself. Blur saves immediately regardless. */
const AUTOSAVE_MS = 2500;

const EMPTY = { text: "", weather: "", crewCount: "", hoursOnSite: "", delays: "" };

/** A loaded row → the form's own shape. Null stays null, never "" or 0. */
function toDraft(log) {
  if (!log) return { ...EMPTY };
  return {
    text: bodyToText(log.body) ?? "",
    weather: log.weather ?? "",
    // `?? ""` so a stored 0 shows as 0 and a stored null shows as blank. The
    // two are different answers and the box must not confuse them.
    crewCount: log.crewCount ?? "",
    hoursOnSite: log.hoursOnSite ?? "",
    delays: log.delays ?? "",
  };
}

export default function DailyLog({ jobId }) {
  const { t, language } = useTranslation();

  const [day, setDay] = useState(() => localDayKey());
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [conflict, setConflict] = useState(null);

  // The version this screen is editing FROM. Held in a ref as well as in
  // `data` because the debounced save reads it from a closure that was built
  // before the previous save returned.
  const versionRef = useRef({ logId: null, updatedAt: null });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const load = useCallback(
    async (key) => {
      const res = await fetch(
        `/api/jobs/${jobId}/daily-logs?day=${encodeURIComponent(key)}`,
      );
      if (!res.ok) {
        // Distinguishing "no logs" from "the request failed" — an empty panel
        // over a failed fetch is the empty-vs-error trap this repo checks for.
        await reportResponseError(
          res,
          t("app.dailyLog.loadError", "Couldn't load this job's daily logs."),
        );
        setData({ logs: [], day: null, failed: true });
        return;
      }
      const payload = await res.json();
      setData(payload);
      const log = payload.day?.log || null;
      versionRef.current = {
        logId: log?.id || null,
        updatedAt: log?.updatedAt || null,
      };
      setDraft(toDraft(log));
      setDirty(false);
      setConflict(null);
      setSavedAt(null);
    },
    [jobId, t],
  );

  useEffect(() => {
    load(day);
  }, [load, day]);

  // ── The seed ─────────────────────────────────────────────────────────────
  //
  // A blank box at the end of a shift gets skipped, so a day with no log opens
  // holding what the product already knows: how many photos were filed and
  // which to-dos were finished. It is a DRAFT — nothing is stored until the
  // person types, because a row nobody looked at would be a fabricated record
  // of a day, which is worse than a missing one. `dirty` is set only by
  // onChange below, and only `dirty` triggers a save.
  const seedText =
    data?.day && !data.day.log
      ? (bodyToText(
          seedBody(
            { photoCount: data.day.photoCount, taskLines: data.day.taskLines },
            {
              photos: t("app.dailyLog.seedPhotos", "{count} photos filed today."),
              tasks: t("app.dailyLog.seedTasks", "Finished today:"),
            },
          ),
        ) ?? "")
      : "";

  useEffect(() => {
    if (seedText && !dirtyRef.current && draftRef.current.text === "") {
      setDraft((d) => ({ ...d, text: seedText }));
    }
  }, [seedText]);

  const save = useCallback(
    async ({ overwriteWith = null } = {}) => {
      const body = draftRef.current;
      const { logId, updatedAt } = versionRef.current;
      const expected = overwriteWith ?? updatedAt;
      const targetId = overwriteWith ? conflict?.id || logId : logId;

      setSaving(true);
      try {
        const payload = {
          text: body.text,
          weather: body.weather,
          delays: body.delays,
          crewCount: body.crewCount,
          hoursOnSite: body.hoursOnSite,
        };

        const res = targetId
          ? await fetch(`/api/jobs/${jobId}/daily-logs/${targetId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, expectedUpdatedAt: expected }),
            })
          : await fetch(`/api/jobs/${jobId}/daily-logs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, day }),
            });

        if (!res.ok) {
          // Checked FIRST and never allowed to reach the toast — the person has
          // unsaved work on screen and needs a decision, not a message that
          // disappears in four seconds.
          const clash = await readStaleConflict(res);
          if (clash) {
            setConflict(clash);
            return false;
          }
          await reportResponseError(
            res,
            t("app.dailyLog.saveError", "Couldn't save the daily log."),
          );
          return false;
        }

        const { log } = await res.json();
        versionRef.current = { logId: log.id, updatedAt: log.updatedAt };
        setConflict(null);
        setDirty(false);
        setSavedAt(Date.now());
        // Refresh the list underneath so a new day appears in it, without
        // touching the box the person may still be typing in.
        setData((prev) =>
          prev
            ? {
                ...prev,
                day: { ...prev.day, log },
                logs: [log, ...(prev.logs || []).filter((l) => l.id !== log.id)].sort(
                  (a, b) => (a.day < b.day ? 1 : -1),
                ),
              }
            : prev,
        );
        return true;
      } finally {
        setSaving(false);
      }
    },
    [jobId, day, t, conflict],
  );

  // Debounced autosave. Suspended entirely while a conflict is on screen: a
  // retry against a version the server has already refused is a loop, and a
  // loop that eventually wins is the silent overwrite this guard exists to
  // prevent.
  useEffect(() => {
    if (!dirty || conflict || saving) return undefined;
    const id = setTimeout(() => {
      save();
    }, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [dirty, conflict, saving, draft, save]);

  if (!data) return null;

  const logs = data.logs || [];
  const today = localDayKey();

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-1.5">
          <CalendarDays size={16} />
          {t("app.dailyLog.title", "Daily log")}
        </h2>
        <SaveState
          t={t}
          saving={saving}
          dirty={dirty}
          savedAt={savedAt}
          conflict={conflict}
        />
      </div>

      {/* Day picker. One row on a phone: the two days anybody actually files
          plus a date field for the rest. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setDay(today)}
          className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold ${
            day === today
              ? "border-foreground bg-foreground text-background"
              : "border-border text-foreground"
          }`}
        >
          {t("app.dailyLog.today", "Today")}
        </button>
        <button
          type="button"
          onClick={() => setDay(shiftDayKey(today, -1))}
          className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold ${
            day === shiftDayKey(today, -1)
              ? "border-foreground bg-foreground text-background"
              : "border-border text-foreground"
          }`}
        >
          {t("app.dailyLog.yesterday", "Yesterday")}
        </button>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          aria-label={t("app.dailyLog.pickDay", "Pick a day")}
          className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
      </div>

      {/* What the product already knows about this day. Facts, not the log —
          they are shown whether or not a log exists, because they stay true
          after somebody edits the seeded text away. */}
      {data.day && (data.day.photoCount > 0 || data.day.taskLines?.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {data.day.photoCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Camera size={13} />
              {t("app.dailyLog.photosToday", "{count} photos", {
                count: data.day.photoCount,
              })}
            </span>
          )}
          {data.day.taskLines?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={13} />
              {t("app.dailyLog.tasksToday", "{count} to-dos finished", {
                count: data.day.taskLines.length,
              })}
            </span>
          )}
        </div>
      )}

      {conflict && (
        <div className="mt-3">
          {/* No `href`: a daily log has no page of its own to open, and a link
              that goes nowhere is worse than no link. `onOverwrite` re-saves
              against the version the server just named — still guarded, so a
              third save conflicts again rather than forcing. */}
          <StaleWriteBanner
            conflict={conflict}
            busy={saving}
            onOverwrite={() => save({ overwriteWith: conflict.currentUpdatedAt })}
          />
        </div>
      )}

      <div className="mt-3">
        <DailyLogEditor
          value={draft}
          disabled={data.failed}
          onChange={(next) => {
            setDraft(next);
            setDirty(true);
          }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => save()}
          disabled={saving || !dirty || Boolean(conflict)}
          className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
        >
          {saving
            ? t("app.dailyLog.saving", "Saving…")
            : t("app.dailyLog.save", "Save the day")}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("app.dailyLog.autosaveNote", "Saves on its own as you type.")}
        </span>
      </div>

      {logs.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("app.dailyLog.recent", "Recent days")}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id}>
                <button
                  type="button"
                  onClick={() => setDay(log.day)}
                  className="w-full py-2.5 text-left"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(`${log.day}T00:00:00Z`).toLocaleDateString(language, {
                        timeZone: "UTC",
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      <Optional
                        value={log.crewCount}
                        render={(v) =>
                          t("app.dailyLog.crewShort", "{count} crew", { count: v })
                        }
                      />
                      <Optional
                        value={log.hoursOnSite}
                        render={(v) => t("app.dailyLog.hoursShort", "{count}h", { count: v })}
                        separator=" · "
                      />
                    </span>
                  </span>
                  {log.bodyText && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {log.bodyText}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Render a number only if somebody actually answered.
 *
 * The whole reason this is a component rather than `{log.crewCount} crew` is
 * the null case. `crewCount` null means nobody said; 0 means somebody said
 * nobody was there. Printing "0 crew" over a null is inventing a statement —
 * AGENTS.md failure class #5 — and on a daily log that statement is evidence
 * in a delay claim. So null renders NOTHING at all, not "0" and not "—",
 * because a dash in this row would still read as an answer.
 */
function Optional({ value, render, separator = "" }) {
  if (value === null || value === undefined) return null;
  return (
    <>
      {separator}
      {render(value)}
    </>
  );
}

function SaveState({ t, saving, dirty, savedAt, conflict }) {
  if (conflict) return null; // the banner is saying it, louder
  if (saving)
    return (
      <span className="text-xs text-muted-foreground">
        {t("app.dailyLog.saving", "Saving…")}
      </span>
    );
  if (dirty)
    return (
      <span className="text-xs text-muted-foreground">
        {t("app.dailyLog.unsaved", "Not saved yet")}
      </span>
    );
  if (savedAt)
    return (
      <span className="text-xs text-muted-foreground">
        {t("app.dailyLog.saved", "Saved")}
      </span>
    );
  return null;
}
