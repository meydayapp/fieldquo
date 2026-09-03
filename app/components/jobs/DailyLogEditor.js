"use client";

// app/components/jobs/DailyLogEditor.js
//
// The writing surface for one day. Controlled, dumb, and mobile-first — it
// owns no fetching and no save timer; DailyLog.js owns both.
//
// ══ Why this is a textarea and not BlockNote ═══════════════════════════════
//
// The owner decided on 2026-09-02 that the editor would be BlockNote → JSON →
// Postgres with autosave and no realtime (docs/construction/STATUS.md item 14).
// BlockNote could not be installed:
//
//   @blocknote/core@0.54.0 declares `@y/y ^14.0.0-rc.23` as an OPTIONAL peer —
//   which is what the brief said and it is true — but @y/y's `latest` dist-tag
//   is 14.0.0-rc.7, which does not satisfy that range. npm resolves the peer
//   against `latest`, finds nothing, and fails the whole tree with ERESOLVE.
//   It installs only with `overrides: { "@y/y": "14.0.0-rc.24" }` pinning a
//   prerelease of a CRDT library this product deliberately does not use, or
//   with --legacy-peer-deps, which changes resolution for every other package
//   in the repo. The last version that installs unaided is 0.51.4, which
//   hard-depends on yjs/y-prosemirror/y-protocols (the realtime stack that was
//   costed and rejected) and whose @blocknote/shadcn is the RADIX build, not
//   the @base-ui one FieldQuo already has.
//
// So: a textarea, and said out loud rather than half-shipped. What is NOT
// given up is the storage format — lib/jobs/dailyLog.js's textToBody() writes
// real BlockNote JSON and bodyToText() reads it back, so the column holds what
// the schema says it holds and dropping the editor in later is a change to this
// one file with no migration behind it.
//
// ══ Mobile-first, and honestly unverified ══════════════════════════════════
//
// This is written in a driveway on a phone, so: one column, 44px minimum touch
// targets, `inputMode` set on both numeric fields so the phone offers a keypad,
// and a textarea tall enough to see what you wrote. `npm run check:mobile` does
// NOT walk this screen — it covers /platform, /sales and /app/clock only — so
// these rules are followed rather than enforced. Widening that check is item 5
// in docs/construction/STATUS.md.

import { useTranslation } from "@/app/hooks/useTranslation";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground";

export default function DailyLogEditor({ value, onChange, disabled = false }) {
  const { t } = useTranslation();

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="dailyLogText"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("app.dailyLog.whatHappened", "What happened today")}
        </label>
        <textarea
          id="dailyLogText"
          rows={8}
          value={value.text}
          disabled={disabled}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={t(
            "app.dailyLog.textPlaceholder",
            "Where the crew got to, what went in, anything the office needs to know.",
          )}
          className={`${FIELD} mt-1 resize-y leading-relaxed`}
        />
      </div>

      {/* Every field below is OPTIONAL and every one of them is nullable.
          An empty box stays empty — see lib/jobs/dailyLog.js: an unanswered
          crew count is null, and null is never rendered or stored as 0. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="dailyLogCrew"
            className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("app.dailyLog.crewCount", "Crew on site")}
          </label>
          <input
            id="dailyLogCrew"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            // `?? ""` and never `|| ""`: a genuine 0 ("nobody was on site
            // today") is an answer somebody typed, and `||` would erase it back
            // to blank on every re-render.
            value={value.crewCount ?? ""}
            disabled={disabled}
            onChange={(e) => set({ crewCount: e.target.value })}
            placeholder={t("app.dailyLog.optional", "Optional")}
            className={`${FIELD} mt-1`}
          />
        </div>
        <div>
          <label
            htmlFor="dailyLogHours"
            className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("app.dailyLog.hoursOnSite", "Hours on site")}
          </label>
          <input
            id="dailyLogHours"
            type="number"
            min="0"
            max="24"
            step="0.25"
            inputMode="decimal"
            value={value.hoursOnSite ?? ""}
            disabled={disabled}
            onChange={(e) => set({ hoursOnSite: e.target.value })}
            placeholder={t("app.dailyLog.optional", "Optional")}
            className={`${FIELD} mt-1`}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="dailyLogWeather"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("app.dailyLog.weather", "Weather")}
        </label>
        <input
          id="dailyLogWeather"
          type="text"
          value={value.weather ?? ""}
          disabled={disabled}
          onChange={(e) => set({ weather: e.target.value })}
          placeholder={t("app.dailyLog.weatherPlaceholder", "Rain from 2pm")}
          className={`${FIELD} mt-1`}
        />
      </div>

      <div>
        <label
          htmlFor="dailyLogDelays"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("app.dailyLog.delays", "Delays or blockers")}
        </label>
        <textarea
          id="dailyLogDelays"
          rows={2}
          value={value.delays ?? ""}
          disabled={disabled}
          onChange={(e) => set({ delays: e.target.value })}
          placeholder={t(
            "app.dailyLog.delaysPlaceholder",
            "Waiting on the electrician, materials short",
          )}
          className={`${FIELD} mt-1 resize-y`}
        />
      </div>
    </div>
  );
}
