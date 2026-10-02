// app/components/sales/ReverseSellingScripts.js
//
// The Reverse Selling playbook's short scripts. Two arrangements of the same
// rows:
//
//   default export            the Playbook tab: every script, grouped — one
//                             per lead source, the follow-ups, the demo, the
//                             customer check-ins, the partner call, Backup;
//   ReverseSellingCallScript  the call screen: ONE script (owner, 2026-10-02:
//                             "why are there two scripts… shouldn't they have
//                             one?"), a small switch on it where the source
//                             cannot be detected, the objection answers the
//                             caller passes in, and one closed "Tips" area.
//                             The server already chose the script and sent
//                             only it and its switch's options
//                             (reverseSellingScripts.js callScreenScripts).
//
// ══ Only for that playbook, and only from props ═══════════════════════════
//
// The rows come from lib/sales/playbook/reverseSellingScripts.js through the
// server (the call route's `salesScripts`, the reading page's props) and are
// never imported here: that module reads the referral policy, which reads the
// database, and none of it may reach a browser bundle. Both callers send them
// only when the playbook in front of the rep IS Reverse Selling, so a starter
// playbook's screen draws nothing new, and while the owner keeps the playbook
// switched off nobody sees any of it.
//
// ══ The words are data; the headings are the rep's language ═══════════════
//
// Script lines are read out and stay English, like every playbook line
// (CallPlaybook.js says why). Group headings and the "for this lead" label
// are catalogue keys. Group order is the order the rows arrive in — the
// server's SCRIPT_GROUPS — so this file does not keep a second copy of it.
"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

const GROUP_KEYS = Object.freeze({
  lead_source: "app.salesScripts.group.lead_source",
  follow_up: "app.salesScripts.group.follow_up",
  demo: "app.salesScripts.group.demo",
  check_in: "app.salesScripts.group.check_in",
  partner: "app.salesScripts.group.partner",
  backup: "app.salesScripts.group.backup",
});

const linesOf = (script) =>
  Array.isArray(script?.lines) ? script.lines.filter((l) => l && typeof l.text === "string" && l.text.trim()) : [];
const notesOf = (script) =>
  Array.isArray(script?.notes) ? script.notes.filter((n) => typeof n === "string" && n.trim()) : [];

/** A script's words: numbered lines, or labelled parts (the demo). One drawing for both screens. */
function ScriptLines({ script }) {
  const lines = linesOf(script);
  const labelled = lines.some((l) => l.label);
  return labelled ? (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={`${script.key}-${i}`}>
          {l.label ? (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text break-words">{l.label}</p>
          ) : null}
          <p className="text-sm text-foreground break-words whitespace-pre-line">{l.text}</p>
        </div>
      ))}
    </div>
  ) : (
    <ol className="list-decimal pl-5 space-y-1.5">
      {lines.map((l, i) => (
        <li key={`${script.key}-${i}`} className="text-sm text-foreground break-words">
          {l.text}
        </li>
      ))}
    </ol>
  );
}

/** One script: numbered lines (or labelled parts), then notes for the rep. */
function Script({ script, open = false }) {
  const { t } = useTranslation();
  const notes = notesOf(script);
  return (
    <details className="rounded-lg border border-border bg-card" open={open} data-testid={`rs-script-${script.key}`}>
      <summary className="cursor-pointer list-none px-3 py-3 min-h-[44px] flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground break-words">{script.name}</span>
        {script.when ? <span className="text-xs text-muted-foreground break-words">{script.when}</span> : null}
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <ScriptLines script={script} />
        {notes.length || script.source ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{t("app.salesCall.repTips")}</p>
            <ul className="list-disc pl-5 space-y-1">
              {notes.map((n, i) => (
                <li key={`${script.key}-note-${i}`} className="text-xs text-foreground break-words">
                  {n}
                </li>
              ))}
            </ul>
            {script.source ? (
              <p className="text-xs text-muted-foreground break-words">
                {t("app.salesScripts.whereFrom", { source: script.source })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Every script, grouped — the Playbook tab's arrangement. The call screen no
 * longer draws this (it draws ReverseSellingCallScript, below); `suggested`
 * and the panel heading without the intro are kept for a caller that wants
 * one script opened first above the rest.
 *
 * @param scripts    the rows, in group order (server-built)
 * @param suggested  the lead-source key to open first, or null
 * @param showIntro  the reading page explains the panel
 */
export default function ReverseSellingScripts({ scripts = [], suggested = null, showIntro = false }) {
  const { t } = useTranslation();
  const rows = Array.isArray(scripts) ? scripts.filter((s) => s && s.key && GROUP_KEYS[s.group]) : [];
  if (!rows.length) return null;
  const pick = suggested ? rows.find((s) => s.key === suggested) || null : null;
  const groups = [...new Set(rows.map((s) => s.group))];

  return (
    <section className="space-y-3" data-testid="reverse-selling-scripts">
      {/* The reading page is a page of sections (h2); the call screen is a
          panel inside a card (h4). Same words either way. */}
      {showIntro ? (
        <>
          <h2 className="text-lg font-semibold text-foreground">{t("app.salesScripts.heading")}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{t("app.salesScripts.intro")}</p>
        </>
      ) : (
        <h4 className="text-sm font-semibold text-foreground">{t("app.salesScripts.heading")}</h4>
      )}
      {pick ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-brand-accent-text break-words">
            {t("app.salesScripts.forThisLead", { name: pick.name })}
          </p>
          <Script script={pick} open />
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t(GROUP_KEYS[g])}</p>
          {rows
            .filter((s) => s.group === g && s.key !== pick?.key)
            .map((s) => (
              <Script key={s.key} script={s} />
            ))}
        </div>
      ))}
    </section>
  );
}

/**
 * The call screen's ONE script, for the Reverse Selling playbook.
 *
 * Top to bottom: a line saying a demo is booked for today when that is why the
 * demo script is up; the script, open, with its switch ("Not a cold call?" /
 * "Not the demo?") where the server offered one; then whatever the caller
 * passes as children (the objection answers); then one "Tips" area, closed:
 * this script's notes, what to do after a yes, and the playbook's notes stage
 * by stage — the nine stages are still the playbook's data, read by the coach
 * and the Playbook tab; the call screen just does not step through them.
 *
 * The switch swaps the ONE script in place; it never draws a second. Its
 * choice is this component's state, so a new prospect (the caller keys this
 * by prospect) starts on the server's pick again.
 *
 * @param callScreen  the route's `salesScripts`: { shown, reason, demoAt, demoRunning, switch, scripts }
 * @param stages      the playbook's rendered stages, for their notes in Tips
 * @param afterYes    the "after a yes" box (StayOnTheLine), drawn inside Tips
 */
export function ReverseSellingCallScript({ callScreen, stages = [], afterYes = null, children = null }) {
  const { t, language } = useTranslation();
  const [choice, setChoice] = useState(null);
  const scripts = Array.isArray(callScreen?.scripts) ? callScreen.scripts.filter((s) => s && s.key) : [];
  const byKey = new Map(scripts.map((s) => [s.key, s]));
  const sw = callScreen?.switch && Array.isArray(callScreen.switch.options)
    ? { ...callScreen.switch, options: callScreen.switch.options.filter((k) => byKey.has(k)) }
    : null;
  const current = byKey.get(choice) || byKey.get(callScreen?.shown) || null;
  const notes = notesOf(current);
  const stageTips = (Array.isArray(stages) ? stages : []).filter((s) => Array.isArray(s?.tips) && s.tips.length);
  const demoTime = callScreen?.demoAt ? new Date(callScreen.demoAt) : null;
  const demoLabel = demoTime && !Number.isNaN(demoTime.getTime())
    ? demoTime.toLocaleTimeString(language || undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="space-y-4" data-testid="rs-call-screen-script">
      {current ? (
        <div className="rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3 space-y-3" data-testid={`rs-call-script-${current.key}`}>
          {current.key === "demo" && demoLabel ? (
            <p className="text-xs font-semibold text-brand-accent-text break-words" data-testid="rs-demo-now">
              {callScreen.demoRunning
                ? t("app.salesScripts.demoRunning", { time: demoLabel })
                : t("app.salesScripts.demoToday", { time: demoLabel })}
            </p>
          ) : null}
          <div className="space-y-0.5">
            <h4 className="text-base font-semibold text-foreground break-words">{current.name}</h4>
            {current.when ? <p className="text-xs text-muted-foreground break-words">{current.when}</p> : null}
          </div>
          {sw && sw.options.length > 1 ? (
            <label className="flex flex-wrap items-center gap-2" data-testid="rs-script-switch" data-kind={sw.kind}>
              <span className="text-xs font-semibold text-muted-foreground">{t(sw.labelKey)}</span>
              <select
                className="min-h-[44px] lg:min-h-[36px] max-w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                value={current.key}
                onChange={(e) => setChoice(e.target.value)}
                aria-label={t(sw.labelKey)}
              >
                {sw.options.map((k) => (
                  <option key={k} value={k}>
                    {byKey.get(k)?.name || k}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <ScriptLines script={current} />
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground break-words" data-testid="rs-no-script">
          {t("app.salesScripts.noScript")}
        </p>
      )}

      {children}

      <details className="rounded-lg border border-border bg-muted/40" data-testid="rs-tips">
        <summary className="cursor-pointer list-none px-3 py-2 min-h-[44px] flex items-center text-sm font-semibold text-foreground">
          {t("app.salesScripts.tips")}
        </summary>
        <div className="px-3 pb-3 space-y-3">
          {notes.length || current?.source ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">{t("app.salesScripts.tipsThisScript")}</p>
              <ul className="list-disc pl-5 space-y-1">
                {notes.map((n, i) => (
                  <li key={`note-${i}`} className="text-xs text-foreground break-words">
                    {n}
                  </li>
                ))}
              </ul>
              {current?.source ? (
                <p className="text-xs text-muted-foreground break-words">{t("app.salesScripts.whereFrom", { source: current.source })}</p>
              ) : null}
            </div>
          ) : null}
          {afterYes}
          {stageTips.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{t("app.salesScripts.tipsEveryCall")}</p>
              {stageTips.map((s) => (
                <div key={s.stageKey} className="space-y-1">
                  <p className="text-xs font-semibold text-foreground break-words">{s.nameKey ? t(s.nameKey, s.name) : s.name}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {s.tips.map((tip, i) => (
                      <li key={`${s.stageKey}-tip-${i}`} className="text-xs text-foreground break-words">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
