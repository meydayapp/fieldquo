"use client";

// app/components/sales/StageBoard.js
//
// The eight stages, in order, with what each one is doing.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The campaign screen could say how many businesses had been accepted, and
// which stages had STOPPED. Between those two facts sat the whole pipeline,
// and nothing said which stage was running, which had finished, or what came
// next: "i don't see any banners or status updates telling me that x step is
// running.. y one is completed z is the next one etc".
//
// ══ Why every stage is drawn, including the empty ones ════════════════════
//
// The stalled panel above this one is deliberately absent when nothing is
// wrong — it answers "why has nothing happened for an hour". This one answers
// a different question, "what is happening", and that question has an answer
// even when the answer is "nothing yet". A board that hid its empty rows would
// change shape as work moved through it, and a reader could not tell a stage
// that has not started from a stage that does not exist.
//
// ══ `claimed` is the only status that means right now ═════════════════════
//
// A stage with queued tasks and nothing claimed is WAITING, not running — the
// runner drains on a schedule, so that is the normal state between ticks and
// it must not read as a fault. The wording distinguishes them in every place
// it appears; see boardSummary in lib/sales/pipeline/progress.js, which is
// where the sentence is composed so that this screen cannot word it
// differently from anything else that shows it.

import { useTranslation } from "@/app/hooks/useTranslation";

// The state word is a KEY, not a sentence: the five words are the distinction
// this board is for, and a rep reading the console in Spanish has to be able to
// tell "running now" from "queued" in Spanish too. The map still owns which
// word goes with which state, so the pairing cannot drift between languages.
const TONE = {
  working: {
    dot: "bg-emerald-500",
    ring: "border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30",
    wordKey: "app.salesQueue.stageStateWorking",
  },
  waiting: {
    dot: "bg-sky-500",
    ring: "border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20",
    wordKey: "app.salesQueue.stageStateWaiting",
  },
  stopped: {
    dot: "bg-amber-500",
    ring: "border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30",
    wordKey: "app.salesQueue.stageStateStopped",
  },
  done: {
    dot: "bg-foreground/30",
    ring: "border-border",
    wordKey: "app.salesQueue.stageStateDone",
  },
  not_started: {
    dot: "bg-foreground/15",
    ring: "border-border",
    wordKey: "app.salesQueue.stageStateNotStarted",
  },
};

/**
 * Emphasis inside a translated sentence.
 *
 * The words that carry the distinction are not the same words in every
 * language, and they are rarely in the same place in the sentence, so the
 * marker travels INSIDE the translated string and is unwrapped here. The
 * obvious alternative — splicing `<span>` between three separate keys — is the
 * assembled-sentence bug: it forces every translator into English word order.
 */
function emphasise(text, className) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, i) =>
      // The same shape the split captured, not `startsWith`: a bare "**"
      // passes a loose test at both ends and would be eaten as an empty
      // emphasis, silently deleting two characters of the sentence.
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <span key={i} className={className}>
          {part.slice(2, -2)}
        </span>
      ) : (
        part
      ),
    );
}

function Count({ n, label, className = "" }) {
  // Zeros are not drawn. A row reading "0 failed · 0 abandoned" spends the
  // reader's attention on the absence of a problem.
  if (!n) return null;
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="font-mono tabular-nums">{n.toLocaleString()}</span> {label}
    </span>
  );
}

export default function StageBoard({ stages = [], pipeline = null }) {
  const { t } = useTranslation();
  const rows = Array.isArray(stages) ? stages : [];
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          {t("app.salesQueue.stageBoardTitle")}
        </h3>
        {pipeline?.sentence ? (
          <p className="text-xs text-muted-foreground break-words">{pipeline.sentence}</p>
        ) : null}
      </div>

      <ol className="space-y-1.5">
        {rows.map((s, i) => {
          const tone = TONE[s.state] || TONE.not_started;
          const bar = s.settled;
          return (
            <li key={s.kind} className={`rounded-lg border p-2.5 ${tone.ring}`}>
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs text-muted-foreground tabular-nums w-4 shrink-0">
                  {i + 1}
                </span>
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${tone.dot} ${
                    s.state === "working" ? "animate-pulse" : ""
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium text-foreground break-words">
                      {s.label}
                    </span>
                    {/* The state in words as well as colour — the dot alone is
                        not readable to a screen reader or to anyone who cannot
                        separate the two greens. */}
                    <span className="text-xs text-muted-foreground">{t(tone.wordKey)}</span>
                  </div>

                  {s.what ? (
                    <p className="text-xs text-muted-foreground break-words">{s.what}</p>
                  ) : null}

                  <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap text-xs text-muted-foreground">
                    <Count
                      n={s.claimed}
                      label={t("app.salesQueue.stageCountInFlight")}
                      className="text-emerald-700 dark:text-emerald-400"
                    />
                    <Count n={s.queued} label={t("app.salesQueue.stageCountQueued")} />
                    <Count n={s.done} label={t("app.salesQueue.stageCountDone")} />
                    <Count
                      n={s.failed}
                      label={t("app.salesQueue.stageCountFailed")}
                      className="text-amber-700 dark:text-amber-400"
                    />
                    <Count
                      n={s.abandoned}
                      label={t("app.salesQueue.stageCountAbandoned")}
                      className="text-amber-700 dark:text-amber-400"
                    />
                    {s.total === 0 ? <span>{t("app.salesQueue.stageNothingQueued")}</span> : null}
                  </div>

                  {/* Capped at 99 while anything is still queued or in flight —
                      see settledPercent. A bar at 100% beside two running
                      crawls is a control that appears to work and doesn't. */}
                  {bar === null ? null : (
                    <div
                      className="h-1 w-full rounded-full bg-foreground/10 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={bar}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("app.salesQueue.stageProgressLabel", {
                        stage: s.label,
                        percent: bar,
                      })}
                    >
                      <div
                        className={`h-full rounded-full ${
                          s.state === "stopped" ? "bg-amber-500" : "bg-foreground/40"
                        }`}
                        style={{ width: `${bar}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground break-words">
        {emphasise(t("app.salesQueue.stageBoardHowItReads"), "font-semibold")}
      </p>
      <p className="text-xs text-muted-foreground break-words">
        {t("app.salesQueue.stageBoardDownstream")}
      </p>
    </section>
  );
}
