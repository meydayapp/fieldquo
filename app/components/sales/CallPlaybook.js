// app/sales/queue/CallPlaybook.js
//
// The playbook, in front of the rep, while the prospect is on the line.
//
// ══ Why this is a separate file and not more of CallPanel ═════════════════
//
// CallPanel is about placing a call and writing it up — a state machine with a
// Twilio device in it. This is reading material. Keeping them apart means the
// rep console layout can move this block without going near the dial logic,
// which matters right now because the console is being rebuilt around it.
//
// ══ One stage at a time, and the rep moves it ═════════════════════════════
//
// Nine stages rendered at once is a wall of text nobody reads at speed; the
// spec's §54 argument for a single prospect card is the same argument one step
// down. So: one stage, big, with Prev/Next and a jump list. The stage does NOT
// advance itself on a timer or off the call duration — a call that goes
// sideways in the first ten seconds is the ordinary case, and a screen that
// had marched on to "Next step" while the rep was still opening would be
// worse than no screen.
//
// ══ The objection rail never closes ═══════════════════════════════════════
//
// Objections are rendered below the stage on EVERY stage, not only on stage
// seven. A prospect pushes back whenever they like; an objection panel that
// only exists in the objection stage is one the rep has to navigate to while
// somebody is talking. Labels are the scannable layer — one line each, the
// answer one tap away — which is what lib/sales/playbook/objections.js means
// by "a label is what a rep scans for mid-call".
//
// ══ Nothing on this screen is padded ══════════════════════════════════════
//
// A stage whose line names {city} on a prospect with no town renders the
// refusal, not the line with a hole in it — buildCallScript already decided
// that and this file prints its answer. A prospect nothing has crawled has no
// playbook at all, and says so. AGENTS.md failure class 5: the absence of a
// statement is not a statement.
"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, CircleHelp, Loader2, ShieldAlert } from "lucide-react";
import { objectionsToShow } from "@/lib/sales/playbook/objections";
import { useTranslation } from "@/app/hooks/useTranslation";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

/**
 * One objection: label to scan, answer one tap down.
 *
 * The label, the response and the evidence describing it are ROWS — written by
 * a superadmin in lib/sales/playbook/objections.js and edited in the database,
 * and rendered verbatim because a rep reads them out. Only the chrome around
 * them belongs to the rep's own language.
 */
function Objection({ row }) {
  const { t } = useTranslation();
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer list-none px-3 py-3 min-h-[44px] flex items-start gap-2">
        <span className="text-sm font-semibold text-foreground break-words">{row.label}</span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <p className="text-sm text-foreground break-words">{row.response}</p>
        {row.context ? (
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesCall.aboutThisBusiness", { summary: row.context.describe })}
            {row.context.facts?.length
              ? ` — ${row.context.facts.map((f) => `${f.label}: ${f.value}`).join(", ")}`
              : ""}
          </p>
        ) : (
          // Never hidden for want of evidence. objections.js argues it: the
          // most common objection there is has nothing to cite, and dropping
          // the answer to it is dropping it exactly when it is needed.
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesCall.generalAnswer")}
          </p>
        )}
      </div>
    </details>
  );
}

/**
 * @param unavailable  why there is no script to show, when that is a fact
 *                     rather than a failure. A lead the rep typed in has no
 *                     discovery behind it and therefore no playbook, and the
 *                     panel used to render nothing at all for that case —
 *                     which reads on screen exactly like a playbook that
 *                     failed to load, or like a product that has no scripts.
 *                     Same argument lib/sales/dialSpace.js makes for the dial:
 *                     absence of UI is indistinguishable from absence of
 *                     feature, so the space says which one it is.
 */
export default function CallPlaybook({
  loading = false,
  error = "",
  data = null,
  unavailable = "",
  onRetry,
}) {
  // Chrome only. Every stage name, purpose, line, prompt, talking point and
  // refusal below arrives from /api/sales/playbook already written — some from
  // a SalesPlaybook row, some from the seed library behind it — and is printed
  // verbatim. Translating what a rep is about to READ ALOUD to an
  // English-speaking contractor would be the one change on this screen that
  // could not be undone by the time they heard it.
  const { t } = useTranslation();
  const [stageIndex, setStageIndex] = useState(0);
  const [heard, setHeard] = useState("");

  const stages = useMemo(() => data?.script?.stages || [], [data]);
  const objections = useMemo(() => data?.objections || [], [data]);

  // Never re-ranked here. objectionsForProspect already ordered these for this
  // prospect; a miss falls back to the whole list rather than emptying the
  // panel mid-sentence. See objectionsToShow.
  const shown = useMemo(() => objectionsToShow(heard, objections), [heard, objections]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> {t("app.salesCall.playbookLoading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="break-words">
            {t("app.salesCall.playbookLoadFailed", { detail: error })}
          </p>
        </div>
        {onRetry ? (
          <button
            type="button"
            className={`${BTN} border border-amber-400 text-amber-900 dark:text-amber-100 w-full`}
            onClick={onRetry}
          >
            {t("app.salesCall.tryAgain")}
          </button>
        ) : null}
      </div>
    );
  }

  if (!data) {
    // Only when the caller stated a reason. A missing playbook with nothing to
    // say about itself stays silent rather than inventing an explanation.
    return unavailable ? (
      <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <CircleHelp size={14} className="mt-0.5 shrink-0" />
          <p className="break-words">{unavailable}</p>
        </div>
      </div>
    ) : null;
  }

  const index = Math.min(stageIndex, Math.max(0, stages.length - 1));
  const stage = stages[index] || null;
  const pointStages = stages.filter((s) => (s.points || []).length > 0);
  const pointCount = pointStages.reduce((n, s) => n + s.points.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground break-words">
          {data.playbook ? data.playbook.name : t("app.salesCall.noScriptHeading")}
        </h3>
        {data.playbook ? (
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesCall.chosenBecause", {
              reason: data.playbook.selectorLabel || data.playbook.describe,
            })}
            {data.playbook.facts?.length
              ? ` (${data.playbook.facts.map((f) => `${f.label}: ${f.value}`).join(", ")})`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground break-words">
            {data.noPlaybookReason} {t("app.salesCall.noPlaybookAdvice")}
          </p>
        )}
      </div>

      {/* ── One stage, and the rep moves it ──────────────────────────────── */}
      {stage ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">
              {t("app.salesCall.stageOf", { current: index + 1, total: stages.length })}
            </span>
            <select
              className={FIELD}
              value={String(index)}
              onChange={(e) => setStageIndex(Number(e.target.value))}
              aria-label={t("app.salesCall.stageSelectAria")}
            >
              {stages.map((s, i) => (
                <option key={s.stageKey} value={String(i)}>
                  {i + 1}. {s.name}
                  {(s.points || []).length ? ` ·  ${t("app.salesCall.aboutThisBusinessTag")}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground break-words">{stage.name}</p>
            {stage.purpose ? (
              <p className="text-xs text-muted-foreground break-words">{stage.purpose}</p>
            ) : null}

            {/* The line, or the reason there is no line. Never a hole. */}
            {stage.say.refusal ? (
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                <ShieldAlert size={14} className="inline mr-1" />
                {stage.say.refusalText}{" "}
                {t("app.salesCall.sayRefusalDetail", { fields: stage.say.missing.join(", ") })}
              </p>
            ) : stage.say.text ? (
              <p className="text-base text-foreground break-words">{stage.say.text}</p>
            ) : (
              <p className="text-sm text-muted-foreground break-words">
                {t("app.salesCall.stageNoLine")}
              </p>
            )}

            {stage.prompts.length ? (
              <ul className="list-disc pl-5 space-y-1">
                {stage.prompts.map((p, i) => (
                  <li key={`${stage.stageKey}-${i}`} className="text-sm break-words">
                    {p.refusal ? (
                      <span className="text-amber-900 dark:text-amber-200">
                        {t("app.salesCall.promptRefusal", { fields: p.missing.join(", ") })}
                      </span>
                    ) : (
                      <span className="text-foreground">{p.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* ── The only sentences that are about THIS business ────────────
                Kept visually apart from the script above, because the
                difference is what the rep is entitled to assert: one is the
                same on every call, the other cites something we saw. */}
            {(stage.points || []).length ? (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                  {t("app.salesCall.defensiblePoints")}
                </p>
                {stage.points.map((p, i) => (
                  <div key={`${p.capabilityCode}-${i}`}>
                    <p className="text-sm text-emerald-900 dark:text-emerald-100 break-words">
                      {p.text}
                    </p>
                    {/* "cites 1 observation" pluralises on a rule English has
                        and Ukrainian, French and Chinese do not, so the count
                        and its noun are one catalogue entry rather than a
                        trailing "s" bolted on here. */}
                    <p className="text-xs text-emerald-800 dark:text-emerald-200 break-words">
                      {t("app.salesCall.pointCitation", {
                        capability: p.capabilityName,
                        cited: t("app.salesCall.observationCount", { value: p.evidenceIds.length }),
                      })}
                      {p.ruleCode ? t("app.salesCall.pointRule", { code: p.ruleCode }) : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${BTN} border border-border text-foreground flex-1`}
              disabled={index <= 0}
              onClick={() => setStageIndex(index - 1)}
            >
              <ChevronLeft size={16} /> {t("app.salesCall.back")}
            </button>
            <button
              type="button"
              className={`${BTN} border border-border text-foreground flex-1`}
              disabled={index >= stages.length - 1}
              onClick={() => setStageIndex(index + 1)}
            >
              {t("app.salesCall.next")} <ChevronRight size={16} />
            </button>
          </div>

          {/* Not padded to nine. A playbook with a stage missing renders the
              stages it has and names the gap. */}
          {data.script.missingStages?.length ? (
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesCall.missingStages", { stages: data.script.missingStages.join(", ") })}
            </p>
          ) : null}

          {pointCount === 0 ? (
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesCall.noPointsAtAll")}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.script && stages.length === 0 ? (
        <p className="text-sm text-muted-foreground break-words">
          {t("app.salesCall.playbookNoStages")}
        </p>
      ) : null}

      {/* ── If they push back ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">
          {t("app.salesCall.ifTheyPushBack")}
        </h4>
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">
            {t("app.salesCall.typeWhatTheySaid")}
          </span>
          {/* The placeholder stays English on purpose, in every language. It is
              an example of an input that WORKS, and the cues it has to hit are
              English substrings in lib/sales/playbook/objections.js — matched
              exactly, because a close-enough match opens the wrong answer and
              the rep reads it out. A translated example would demonstrate a
              phrase that can never match. */}
          <input
            className={FIELD}
            value={heard}
            onChange={(e) => setHeard(e.target.value)}
            placeholder="we already use jobber"
            aria-label={t("app.salesCall.heardAria")}
          />
        </label>

        {shown.missed ? (
          <p className="text-xs text-muted-foreground break-words">
            <CircleHelp size={14} className="inline mr-1" />
            {t("app.salesCall.noCueMatch")}
          </p>
        ) : null}
        {shown.filtered ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesCall.matchCount", {
                shown: shown.rows.length,
                total: objections.length,
              })}
            </p>
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => setHeard("")}
            >
              {t("app.salesCall.showAll")}
            </button>
          </div>
        ) : null}

        {objections.length === 0 ? (
          <p className="text-sm text-muted-foreground break-words">
            {t("app.salesCall.objectionsEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {shown.rows.map((row) => (
              <Objection key={row.code} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* ── The honest footnotes ─────────────────────────────────────────── */}
      <div className="space-y-1 border-t border-border pt-3">
        {data.unchecked?.length ? (
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesCall.uncheckedNote", { items: data.unchecked.join(", ") })}
          </p>
        ) : null}
        {data.generation?.degraded ? (
          <p className="text-xs text-muted-foreground break-words">{data.generation.reasonText}</p>
        ) : null}
        {data.store && !data.store.ready ? (
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesCall.starterScripts")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
