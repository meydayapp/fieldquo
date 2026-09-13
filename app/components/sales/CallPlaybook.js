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
// ══ The stage shows its name and its lines, and nothing else by default ═══
//
// The owner read "Establish relevance — One sentence that could only have
// been said to this business. Not a compliment — a reason this call is not a
// cold list." on a live prospect and said he did not understand what it was
// about. He was reading the author's note — the paragraph stages.js keeps
// for whoever WRITES the lines — printed above the lines as if it were one
// of them. So each stage now shows a two-word name in the rep's language
// (stages.js `nameKey`) and the words to say. The note is in a <details>
// labelled "why this stage exists", closed by default, for a rep who wants
// it. scripts/check-playbook-voice.mjs holds the default closed.
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
import { AlertCircle, ChevronLeft, ChevronRight, CircleHelp, Loader2, ShieldAlert, Sparkles, Target } from "lucide-react";
import { objectionsToShow } from "@/lib/sales/playbook/objections";
import { languageMeta } from "@/app/i18n/languages";
import { useTranslation } from "@/app/hooks/useTranslation";
import StayOnTheLine from "@/app/components/sales/StayOnTheLine";

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
 * The script a model wrote for THIS call, above the rules.
 *
 * Rendered only when the route returned one (`data.callScript`), and the
 * rules-built stages and the objection rail stay below it unchanged — the
 * generated page is a layer on top of the fallback, never a replacement for
 * it, so a prospect whose script has not been written yet gets the same
 * screen as before. The sentences are printed verbatim in the language the
 * script was written in — English, French or Spanish, the switch below the
 * heading (lib/sales/intel/callScript.js says which is the default and
 * why); the headings are the rep's portal language, whatever the script's.
 *
 * The date is the crawl the script describes. A script written before the
 * website was read says so rather than borrowing a date from elsewhere.
 */
function H({ children }) {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">{children}</p>;
}

/**
 * English · Français · Español — the script's language switch.
 *
 * The labels are each language's own name (app/i18n/languages.js
 * nativeName), the way lib/sales/repLanguage.js argues a picker should be
 * labelled: a rep looking for French looks for "Français". The current one
 * is the route's `scriptLanguage.current` — the default until the rep
 * chooses — and choosing asks CallPanel to re-read the playbook in that
 * language, which writes the script on demand if it has to. While that
 * read is in flight the switch is disabled and says so; the script already
 * on screen stays where it is. When the route could not deliver the
 * language asked for it says which one is showing instead, under the
 * switch, so a rep who pressed Français and is reading English knows why.
 */
function ScriptLanguageSwitch({ scriptLanguage, chosen, loading, onChange }) {
  const { t } = useTranslation();
  if (!scriptLanguage?.available?.length || !onChange) return null;
  const current = chosen || scriptLanguage.current || scriptLanguage.default;
  const name = (code) => languageMeta(code).nativeName;
  return (
    <div className="space-y-1" data-script-language-switch>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("app.salesCall.scriptLanguage")}</span>
        <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label={t("app.salesCall.scriptLanguage")}>
          {scriptLanguage.available.map((code) => {
            const active = code === current;
            return (
              <button
                key={code}
                type="button"
                disabled={loading || active}
                aria-pressed={active}
                data-script-language={code}
                onClick={() => onChange(code)}
                className={`min-h-[44px] lg:min-h-[36px] px-3 text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"} disabled:opacity-100`}
              >
                {name(code)}
              </button>
            );
          })}
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-script-language-loading>
            <Loader2 className="animate-spin" size={12} /> {t("app.salesCall.scriptLanguageLoading", { language: name(current) })}
          </span>
        ) : null}
      </div>
      {!loading && scriptLanguage.fallback ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words" data-script-language-fallback>
          {t("app.salesCall.scriptLanguageFallback", {
            requested: name(scriptLanguage.fallback.requested),
            shown: name(scriptLanguage.fallback.shown),
          })}
        </p>
      ) : null}
    </div>
  );
}

function AiScript({ script, language, switchProps }) {
  const { t } = useTranslation();
  const crawled = script.crawledAt ? new Date(script.crawledAt) : null;
  const when = crawled && !Number.isNaN(crawled.getTime())
    ? crawled.toLocaleDateString(language || undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  return (
    <div
      className={`rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3 space-y-3${switchProps?.loading ? " opacity-60" : ""}`}
      data-testid="ai-call-script"
      data-script-language-shown={script.language || "en"}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-accent-text" />
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("app.salesCall.aiScriptHeading")}</p>
          <p className="text-xs text-muted-foreground break-words">
            {when
              ? t("app.salesCall.aiScriptGenerated", { date: when })
              : t("app.salesCall.aiScriptGeneratedNoCrawl")}
          </p>
        </div>
      </div>
      {switchProps ? <ScriptLanguageSwitch {...switchProps} /> : null}

      <div>
        <H>{t("app.salesCall.aiScriptOpener")}</H>
        <p className="text-base text-foreground break-words mt-1">{script.opener}</p>
      </div>

      {script.whatWeSaw?.length ? (
        <div>
          <H>{t("app.salesCall.aiScriptWhatWeSaw")}</H>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {script.whatWeSaw.map((line, i) => (
              <li key={i} className="text-sm text-foreground break-words">{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <H>{t("app.salesCall.aiScriptWhyNow")}</H>
        <p className="text-sm text-foreground break-words mt-1">{script.whyThemNow}</p>
      </div>

      {script.threeQuestions?.length ? (
        <div>
          <H>{t("app.salesCall.aiScriptQuestions")}</H>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            {script.threeQuestions.map((q, i) => (
              <li key={i} className="text-sm text-foreground break-words">{q}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {script.objections?.length ? (
        <div>
          <H>{t("app.salesCall.aiScriptObjections")}</H>
          <div className="mt-1 space-y-2">
            {script.objections.map((o, i) => (
              <div key={i} className="text-sm break-words">
                <p className="text-muted-foreground italic">“{o.they}”</p>
                <p className="text-foreground">{o.you}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <H>{t("app.salesCall.aiScriptClose")}</H>
        <p className="text-sm text-foreground break-words mt-1">{script.closeAsk}</p>
      </div>
      {/* After a yes: text the link, stay on the line — in the script's language. */}
      <StayOnTheLine language={script.language || "en"} />

      {script.doNotSay?.length ? (
        <div>
          <H>{t("app.salesCall.aiScriptDoNotSay")}</H>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {script.doNotSay.map((line, i) => (
              <li key={i} className="text-sm text-amber-900 dark:text-amber-200 break-words">{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* What the opener and the why-them paragraph were built from — the
          model's own citations, verified against the page text before the
          script was stored. Printed so a rep can say "it says on your site
          that…" with the words in front of them. Absent on a script written
          with nothing crawled, which is the honest generic one. */}
      {script.citations?.length ? (
        <div>
          <H>{t("app.salesCall.aiScriptCitations")}</H>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {script.citations.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground break-words">
                “{c.quote}”{c.sourceUrl && c.sourceUrl !== "inference" ? ` — ${c.sourceUrl}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground break-words border-t border-border pt-2">
        {t("app.salesCall.aiScriptRulesBelow")}
      </p>
    </div>
  );
}

/**
 * The console's shape of the generated script — the reference dialler's
 * "Call Script" panel: numbered steps down the left, each with the sentence
 * to say; on the right, "Key talking points" and "Goal".
 *
 * The same `callScript` object AiScript reads, restructured and nothing
 * more. The steps ARE the script's five parts in the order they are said —
 * Open · What we saw · Why them now · Three questions · The ask. The talking
 * points are the sentences the rules engine marked as defensible about
 * THIS business (the stages' `points`, each citing an observation) with the
 * script's own do-not-say list under them; the goal is the close — the
 * fifteen-minute ask lib/sales/intel/callScript.js holds every script to.
 * Nothing here is written by this file: a missing part is left out, never
 * padded (AGENTS.md failure class 5).
 */
function ConsoleScript({ script, stages, language, switchProps }) {
  const { t } = useTranslation();
  const crawled = script.crawledAt ? new Date(script.crawledAt) : null;
  const when = crawled && !Number.isNaN(crawled.getTime())
    ? crawled.toLocaleDateString(language || undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  const steps = [
    { key: "open", title: t("app.salesCall.aiScriptOpener"), text: script.opener || null, lines: null },
    { key: "saw", title: t("app.salesCall.aiScriptWhatWeSaw"), text: null, lines: script.whatWeSaw?.length ? script.whatWeSaw : null },
    { key: "why", title: t("app.salesCall.aiScriptWhyNow"), text: script.whyThemNow || null, lines: null },
    { key: "questions", title: t("app.salesCall.aiScriptQuestions"), text: null, lines: script.threeQuestions?.length ? script.threeQuestions : null, ordered: true },
    { key: "ask", title: t("app.salesCall.aiScriptClose"), text: script.closeAsk || null, lines: null },
  ].filter((step) => step.text || step.lines);
  const points = stages.flatMap((s) => (s.points || []).map((p) => ({ ...p, stageKey: s.stageKey })));

  return (
    <div
      className={`grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]${switchProps?.loading ? " opacity-60" : ""}`}
      data-testid="ai-call-script"
      data-script-language-shown={script.language || "en"}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-accent-text" />
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("app.salesCall.aiScriptHeading")}</p>
            <p className="text-xs text-muted-foreground break-words">
              {when ? t("app.salesCall.aiScriptGenerated", { date: when }) : t("app.salesCall.aiScriptGeneratedNoCrawl")}
            </p>
          </div>
        </div>
        {switchProps ? <ScriptLanguageSwitch {...switchProps} /> : null}
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.key} className="flex gap-3" data-script-step={step.key}>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                {step.text ? <p className="text-base text-foreground break-words">{step.text}</p> : null}
                {step.lines ? (
                  step.ordered ? (
                    <ol className="list-decimal pl-5 space-y-1">
                      {step.lines.map((line, j) => (
                        <li key={j} className="text-sm text-foreground break-words">{line}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1">
                      {step.lines.map((line, j) => (
                        <li key={j} className="text-sm text-foreground break-words">{line}</li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {script.objections?.length ? (
          <div>
            <H>{t("app.salesCall.aiScriptObjections")}</H>
            <div className="mt-1 space-y-2">
              {script.objections.map((o, i) => (
                <div key={i} className="text-sm break-words">
                  <p className="text-muted-foreground italic">“{o.they}”</p>
                  <p className="text-foreground">{o.you}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {script.citations?.length ? (
          <div>
            <H>{t("app.salesCall.aiScriptCitations")}</H>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {script.citations.map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground break-words">
                  “{c.quote}”{c.sourceUrl && c.sourceUrl !== "inference" ? ` — ${c.sourceUrl}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 space-y-2" data-script-points>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-900 dark:text-emerald-100">
            {t("app.salesCall.keyTalkingPoints")}
          </p>
          {points.length ? (
            <ul className="list-disc pl-4 space-y-1.5">
              {points.map((p, i) => (
                <li key={`${p.capabilityCode}-${i}`} className="text-sm text-emerald-900 dark:text-emerald-100 break-words">
                  {p.text}
                  <span className="block text-xs text-emerald-800 dark:text-emerald-200">
                    {t("app.salesCall.pointCitation", {
                      capability: p.capabilityName,
                      cited: t("app.salesCall.observationCount", { value: p.evidenceIds.length }),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80 break-words">{t("app.salesCall.noPointsAtAll")}</p>
          )}
          {script.doNotSay?.length ? (
            <div className="pt-1 border-t border-emerald-200 dark:border-emerald-900">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">{t("app.salesCall.aiScriptDoNotSay")}</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                {script.doNotSay.map((line, i) => (
                  <li key={i} className="text-xs text-amber-900 dark:text-amber-200 break-words">{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {script.closeAsk ? (
          <div className="rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3 space-y-1" data-script-goal>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text flex items-center gap-1.5">
              <Target size={13} aria-hidden="true" /> {t("app.salesCall.goal")}
            </p>
            <p className="text-sm text-foreground break-words">{script.closeAsk}</p>
          </div>
        ) : null}
        {/* After a yes: text the link, stay on the line — in the script's language. */}
        <StayOnTheLine language={script.language || "en"} compact />
      </div>
    </div>
  );
}

/**
 * @param layout       "stack" (default) is the card as it has always been —
 *                     the generated script above one stage at a time. "console"
 *                     is the queue's Script tab: the generated script as
 *                     numbered steps with talking points and goal beside it
 *                     (ConsoleScript), then the same stage stepper and the
 *                     objection rail under it. Same data, same fetch, one
 *                     more arrangement of it.
 * @param unavailable  why there is no script to show, when that is a fact
 *                     rather than a failure. A lead the rep typed in has no
 *                     discovery behind it and therefore no playbook, and the
 *                     panel used to render nothing at all for that case —
 *                     which reads on screen exactly like a playbook that
 *                     failed to load, or like a product that has no scripts.
 *                     Same argument lib/sales/dialSpace.js makes for the dial:
 *                     absence of UI is indistinguishable from absence of
 *                     feature, so the space says which one it is.
 * @param scriptLanguage         the code the rep chose, or null for the default
 * @param scriptLanguageLoading  a re-read in another language is in flight
 * @param onScriptLanguage       (code) => void — CallPanel re-reads the playbook
 */
export default function CallPlaybook({
  loading = false,
  error = "",
  data = null,
  unavailable = "",
  onRetry,
  layout = "stack",
  scriptLanguage = null,
  scriptLanguageLoading = false,
  onScriptLanguage = null,
}) {
  // Chrome only. Every stage name, purpose, line, prompt, talking point and
  // refusal below arrives from /api/sales/playbook already written — some from
  // a SalesPlaybook row, some from the seed library behind it — and is printed
  // verbatim. Translating what a rep is about to READ ALOUD to an
  // English-speaking contractor would be the one change on this screen that
  // could not be undone by the time they heard it.
  const { t, language } = useTranslation();
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
  // The switch exists only when the route described the languages and the
  // panel gave it somewhere to send a choice — a caller that renders this
  // read-only gets no control that would do nothing.
  const switchProps = data.scriptLanguage && onScriptLanguage
    ? { scriptLanguage: data.scriptLanguage, chosen: scriptLanguage, loading: scriptLanguageLoading, onChange: onScriptLanguage }
    : null;
  const pointStages = stages.filter((s) => (s.points || []).length > 0);
  const pointCount = pointStages.reduce((n, s) => n + s.points.length, 0);

  return (
    <div className={layout === "console" ? "space-y-4" : "rounded-xl border border-border bg-card p-4 space-y-4"}>
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

      {/* ── The generated script, when the pipeline has written one ───────
          Above the stages, because it is about THIS business and the stages
          are about every business of its tier. Absent, nothing is drawn: the
          stages below are the whole screen, as they were. */}
      {data.callScript ? (
        layout === "console" ? (
          <ConsoleScript script={data.callScript} stages={stages} language={language} switchProps={switchProps} />
        ) : (
          <AiScript script={data.callScript} language={language} switchProps={switchProps} />
        )
      ) : switchProps ? (
        // No script in any language yet — the switch still stands, because
        // pressing another language writes one, and the fallback sentence
        // is where "the French one could not be written" is said.
        <ScriptLanguageSwitch {...switchProps} />
      ) : null}
      {/* No AI script for this row: the after-a-yes step still stands, in
          the language the script would be in. With a script it is drawn
          under that script's close instead. */}
      {!data.callScript ? <StayOnTheLine language={data.scriptLanguage?.current || data.scriptLanguage?.default || "en"} /> : null}

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
                  {i + 1}. {s.nameKey ? t(s.nameKey, s.name) : s.name}
                  {(s.points || []).length ? ` ·  ${t("app.salesCall.aboutThisBusinessTag")}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground break-words">
              {stage.nameKey ? t(stage.nameKey, stage.name) : stage.name}
            </p>

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

          {/* The author's note, off by default. A rep who wants to know why
              the stage exists opens it; a rep on a call never has to read
              past it to reach the words. Not a `useState`: a native
              <details> is closed on every render and every stage change,
              which is the default the owner asked for. */}
          {stage.purpose ? (
            <details className="rounded-lg border border-border bg-muted/40" data-testid="stage-purpose">
              <summary className="cursor-pointer list-none px-3 py-2 min-h-[44px] flex items-center text-xs text-muted-foreground">
                {t("app.salesCall.whyStage")}
              </summary>
              <p className="px-3 pb-3 text-xs text-muted-foreground break-words">{stage.purpose}</p>
            </details>
          ) : null}

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
