"use client";

// app/components/messaging/ConversationTemperature.js
//
// Hot / warm / cold on the conversation, with the reasons and the quotes that
// produced it — and the optional paid reading behind a priced button.
//
// ══ Why the reasons are not collapsed behind a chevron ═════════════════════
//
// A colour with no argument is a number nobody can check, and a number nobody
// can check gets obeyed when it is wrong. The whole design of this scorer is
// that it quotes the fragment it matched: "shall the draft be for Truefinish
// Cabinets or your name?" is a sentence a contractor can read in one second
// and agree or disagree with. Hiding that behind a click would leave the chip
// doing all the talking, which is exactly the failure the Meta AI made when it
// told this contractor his most detailed customer was "ready to buy".
//
// ══ The two things that are shown but worth nothing ════════════════════════
//
// A stated budget and product questions are drawn in a muted "noticed, and
// deliberately not counted" line. They are the trap: the customer with the
// biggest stated budget and the best questions in this contractor's history
// was quoted thirteen thousand dollars and never answered again. Showing that
// the scorer SAW them and gave them nothing is the sentence this whole feature
// exists to be able to say.
//
// ══ A cold conversation is never hidden ════════════════════════════════════
//
// This panel ranks and explains. Nothing in the product filters a conversation
// out for scoring low — the corpus contains a man who scored badly for two
// months and was one revised quote from buying.

import { useCallback, useEffect, useState } from "react";
import { Flame, Sparkles, Loader2, Ban, Info } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * The chip, shared by the thread panel, the inbox row and the month-end list.
 *
 * `temperature` null draws NOTHING. A conversation nobody has scored has not
 * said it is cold, and a grey "cold" pill on every thread written before the
 * columns existed would be the product asserting something it was never told.
 */
export function TemperatureChip({ temperature, score, confidence, t }) {
  if (!temperature) return null;
  const tone =
    temperature === "hot"
      ? "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100"
      : temperature === "warm"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {temperature === "hot" && <Flame size={12} aria-hidden="true" />}
      {t(`app.messages.temperature.${temperature}`)}
      {Number.isFinite(score) && <span className="font-normal tabular-nums">{score}</span>}
      {confidence === "thin" && (
        <span className="font-normal">{t("app.messages.temperature.thinShort")}</span>
      )}
    </span>
  );
}

/**
 * One reason line: what fired, what it was worth, and what they actually typed.
 *
 * The weight is printed with its sign because the direction is the argument. A
 * reason worth nothing prints no number at all rather than "0" — "0" reads as
 * a measurement, and the point of these two lines is that they were NOT
 * measured.
 */
function Reason({ reason, t }) {
  const noted = !reason.weight;
  return (
    <li className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-baseline gap-2">
        <span className={`text-sm ${noted ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          {t(reason.labelKey)}
        </span>
        {noted ? (
          <span className="text-xs text-muted-foreground">
            {t("app.messages.temperature.notCounted")}
          </span>
        ) : (
          <span
            className={`text-xs font-semibold tabular-nums ${
              reason.weight > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
            }`}
          >
            {reason.weight > 0 ? `+${reason.weight}` : reason.weight}
          </span>
        )}
      </span>
      {reason.quote && (
        <span className="text-xs text-muted-foreground italic break-words">
          {t("app.messages.temperature.quoted", { quote: reason.quote })}
        </span>
      )}
    </li>
  );
}

export default function ConversationTemperature({ threadId, isDemo = false, refreshKey = 0 }) {
  const { t } = useTranslation();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    const result = await fetchList(`/api/messaging/threads/${encodeURIComponent(id)}/temperature`);
    if (result.aborted) return;
    // No `if (res.ok)` with nothing on the other side: a failed load says so
    // and offers the retry, rather than rendering an empty box that reads as
    // "this conversation has no score".
    if (result.ok) {
      setState(result.data);
      setError("");
    } else {
      setState(null);
      setError(t("app.messages.temperature.loadError"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load(threadId);
  }, [load, threadId, refreshKey]);

  async function readWithAi() {
    setRunning(true);
    setError("");
    const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/temperature`, {
      method: "POST",
    });
    if (!res.ok) {
      await reportResponseError(res, setError, t("app.messages.temperature.runError"));
      setRunning(false);
      return;
    }
    // Reload rather than trusting the POST's copy: the price and the remaining
    // allowance have both moved, and showing the pre-spend numbers beside a
    // result that just spent them is a screen that disagrees with itself.
    await load(threadId);
    setRunning(false);
  }

  if (loading) {
    return <div className="h-16 rounded-lg bg-accent animate-pulse" aria-hidden="true" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm text-foreground">{error}</p>
        <button
          type="button"
          onClick={() => load(threadId)}
          className="mt-2 min-h-[44px] rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
        >
          {t("app.messages.temperature.retry")}
        </button>
      </div>
    );
  }

  const score = state?.score || null;
  if (!score) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(state?.reasonKey || "app.messages.temperature.notScored")}
      </p>
    );
  }

  const price = state?.price || null;
  const canRun = Boolean(state?.available) && !running && !isDemo;
  const blockedKey = state?.reasonKey || null;
  const counted = score.reasons.filter((r) => r.weight);
  const noted = score.reasons.filter((r) => !r.weight);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TemperatureChip
          temperature={score.temperature}
          score={score.score}
          confidence={score.confidence}
          t={t}
        />
        <span className="text-xs text-muted-foreground">
          {t("app.messages.temperature.fromMessages", { count: score.messageCount })}
        </span>
      </div>

      {/* ── A structural refusal, said plainly and shown with its quote ──
          Not a verdict about how keen they are: a fact about whether the job
          can exist. It is contestable and the wording says so — the rule reads
          the words, and the contractor knows the town. */}
      {score.disqualified && (
        <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Ban size={14} aria-hidden="true" />
            {t(score.disqualified.labelKey)}
          </p>
          {score.disqualified.quote && (
            <p className="mt-1 text-xs text-foreground italic break-words">
              {t("app.messages.temperature.quoted", { quote: score.disqualified.quote })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("app.messages.temperature.disqualifiedHint")}
          </p>
        </div>
      )}

      {score.confidence === "thin" && !score.disqualified && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t("app.messages.temperature.thin")}
        </p>
      )}

      {counted.length > 0 && (
        <ul className="space-y-2">
          {counted.map((r, i) => (
            <Reason key={`${r.id}-${i}`} reason={r} t={t} />
          ))}
        </ul>
      )}
      {counted.length === 0 && !score.disqualified && (
        <p className="text-xs text-muted-foreground">{t("app.messages.temperature.nothingYet")}</p>
      )}

      {noted.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("app.messages.temperature.notedTitle")}
          </p>
          <ul className="mt-1 space-y-1">
            {noted.map((r, i) => (
              <Reason key={`${r.id}-noted-${i}`} reason={r} t={t} />
            ))}
          </ul>
        </div>
      )}

      {/* ── The paid reading, priced before the click ────────────────────
          The reason the button is off sits in the SAME block as the button,
          never floating above it: a greyed control with its explanation
          somewhere else reads as "the feature is gone". */}
      <div className="rounded-lg border border-border p-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles size={13} aria-hidden="true" />
          {t("app.messages.temperature.aiTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("app.messages.temperature.aiSubtitle")}
        </p>

        {score.ai?.note && (
          <div className="mt-2 rounded-lg bg-muted p-2">
            <p className="text-sm text-foreground">{score.ai.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {score.ai.blocked === "disqualified"
                ? t("app.messages.temperature.aiBlocked")
                : score.ai.applied
                  ? t("app.messages.temperature.aiMoved", {
                      points: score.ai.applied > 0 ? `+${score.ai.applied}` : String(score.ai.applied),
                    })
                  : t("app.messages.temperature.aiNoChange")}
              {Number.isFinite(score.ai.messagesSince) && score.ai.messagesSince > 0
                ? ` ${t("app.messages.temperature.aiSince", { count: score.ai.messagesSince })}`
                : ""}
            </p>
          </div>
        )}

        {/* The quote has gone out and nothing has been read since — the one
            moment the corpus says this reading is worth buying. A sentence,
            not an automatic charge. */}
        {state?.recommended && (
          <p className="mt-2 text-xs font-semibold text-foreground">
            {t("app.messages.temperature.recommended")}
          </p>
        )}
        {blockedKey && (
          <p className="mt-2 text-xs text-foreground">
            {t(blockedKey, state?.reasonValues || {})}
          </p>
        )}
        {price && !price.allowed && price.reason && (
          <p className="mt-2 text-xs text-foreground">{price.reason}</p>
        )}
        {price && price.allowed && (
          <p className="mt-2 text-xs text-muted-foreground">
            {Number.isFinite(price.remaining)
              ? t("app.messages.temperature.price", {
                  tokens: price.estimatedTokens,
                  remaining: price.remaining,
                })
              : t("app.messages.temperature.priceNoRemaining", { tokens: price.estimatedTokens })}
          </p>
        )}
        {state?.examples && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("app.messages.temperature.examples", {
              won: state.examples.won,
              other: state.examples.other,
            })}
          </p>
        )}

        <button
          type="button"
          onClick={readWithAi}
          disabled={!canRun}
          className="mt-2 min-h-[44px] inline-flex items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground disabled:opacity-40"
        >
          {running ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Sparkles size={14} aria-hidden="true" />
          )}
          {score.ai?.note
            ? t("app.messages.temperature.readAgain")
            : t("app.messages.temperature.read")}
        </button>
      </div>
    </div>
  );
}
