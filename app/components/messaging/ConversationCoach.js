"use client";

// app/components/messaging/ConversationCoach.js
//
// The "Coach" tab of the conversation's side panel: how likely this person is
// to buy (free, from the rule score), then — after a priced, on-demand run —
// the approach, the red flags, anything the contractor should walk back, and a
// draft of the next reply.
//
// ══ The draft is never sent from here ══════════════════════════════════════
//
// "Use this reply" hands the text to the screen, which puts it in the reply
// box. Nothing in this file posts a message; the contractor's own Send is the
// only way the draft leaves. When the reply box cannot take it (a demo, a
// read-only member, a closed WhatsApp window, no connection) the button is
// not drawn — "Copy" is, because a button that inserts into a disabled box is
// the control that appears to work.
//
// ══ Every quote on this panel is one we found ══════════════════════════════
//
// Red flags and slips arrive with quotes the server has already looked up in
// the transcript (lib/ai/conversationCoach.js verifyQuote). They are printed
// verbatim in quotation marks so the contractor can check them against the
// thread in one glance — advice nobody can check is advice nobody argues with.

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Undo2, MessageSquareText, Copy, Check, Info } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { languageMeta } from "@/app/i18n/languages";
import { TemperatureChip } from "./ConversationTemperature";

const SECTION = "rounded-lg border border-border p-3 space-y-2";
const TITLE = "text-xs font-semibold text-foreground flex items-center gap-1.5";
const BUTTON =
  "min-h-[44px] inline-flex items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-40";

function Quoted({ text, t }) {
  if (!text) return null;
  return <p className="text-xs text-muted-foreground italic break-words">{t("app.messages.temperature.quoted", { quote: text })}</p>;
}

/** The free likelihood — the same score as the chip in the inbox, with its reasons. */
function Likelihood({ likelihood, t }) {
  if (!likelihood?.temperature) {
    return <p className="text-xs text-muted-foreground">{t("app.messages.temperature.notScored")}</p>;
  }
  return (
    <div className={SECTION} data-coach-likelihood>
      <p className={TITLE}>{t("app.messages.coach.likelihoodTitle")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <TemperatureChip temperature={likelihood.temperature} score={likelihood.score} confidence={likelihood.confidence} t={t} />
        {Number.isFinite(likelihood.messageCount) && (
          <span className="text-xs text-muted-foreground">
            {t("app.messages.temperature.fromMessages", { count: likelihood.messageCount })}
          </span>
        )}
      </div>
      {likelihood.disqualified && (
        <div>
          <p className="text-sm font-medium text-foreground">{t(likelihood.disqualified.labelKey)}</p>
          <Quoted text={likelihood.disqualified.quote} t={t} />
        </div>
      )}
      {likelihood.reasons?.length ? (
        <ul className="space-y-1.5">
          {likelihood.reasons.map((r, i) => (
            <li key={`${r.labelKey}-${i}`}>
              <span className="text-sm text-foreground">{t(r.labelKey)}</span>{" "}
              <span
                className={`text-xs font-semibold tabular-nums ${
                  r.weight > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                }`}
              >
                {r.weight > 0 ? `+${r.weight}` : r.weight}
              </span>
              <Quoted text={r.quote} t={t} />
            </li>
          ))}
        </ul>
      ) : null}
      {likelihood.aiRead?.note && <p className="text-xs text-muted-foreground break-words">{likelihood.aiRead.note}</p>}
      <p className="text-[11px] text-muted-foreground">{t("app.messages.coach.likelihoodNote")}</p>
    </div>
  );
}

/** The draft, with the two things that can be done with it. */
function Draft({ result, replyLanguage, canInsert, onUseReply, t }) {
  const [copied, setCopied] = useState(false);
  const text = result?.draftReply || "";
  if (!text) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (an insecure origin, a denied permission). The text
      // is on screen and selectable; say so rather than pretend it copied.
      setCopied(false);
      showError(t("app.messages.coach.copyFailed"));
    }
  }

  return (
    <div className={SECTION} data-coach-draft>
      <p className={TITLE}>
        <MessageSquareText size={13} aria-hidden="true" /> {t("app.messages.coach.draftTitle")}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t("app.messages.coach.draftLanguage", { language: languageMeta(replyLanguage).nativeName })}
      </p>
      <p className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-sm text-foreground">{text}</p>
      {result.draftHasPlaceholders && (
        <p className="text-xs text-foreground flex items-start gap-1.5">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t("app.messages.coach.draftPlaceholders")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canInsert && (
          <button
            type="button"
            onClick={() => onUseReply?.(text)}
            className={`${BUTTON} bg-inverted text-inverted-foreground`}
            data-coach-use-reply
          >
            {t("app.messages.coach.useReply")}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className={`${BUTTON} border border-border bg-card font-medium text-foreground`}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? t("app.messages.coach.copied") : t("app.messages.coach.copy")}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("app.messages.coach.neverSent")}</p>
    </div>
  );
}

function Result({ coach, canInsert, onUseReply, formatDate, t }) {
  const r = coach?.result;
  if (!r) return null;
  const at = coach.generatedAt ? new Date(coach.generatedAt) : null;
  const g = r.grounding || {};
  return (
    <div className="space-y-3" data-coach-result>
      <p className="text-[11px] text-muted-foreground">
        {at && !Number.isNaN(at.getTime()) ? t("app.messages.coach.generatedAt", { date: formatDate(at) }) : null}{" "}
        {t("app.messages.coach.basedOn", { count: coach.basedOnMessages })}
      </p>
      {coach.stale && coach.messagesSince > 0 && (
        <p className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-foreground">
          {t("app.messages.coach.since", { count: coach.messagesSince })}
        </p>
      )}
      {r.confidence === "not_enough" && (
        <p className="text-xs text-foreground flex items-start gap-1.5">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t("app.messages.coach.notEnough")}
        </p>
      )}

      <div className={SECTION}>
        <p className={TITLE}>
          <Sparkles size={13} aria-hidden="true" /> {t("app.messages.coach.approachTitle")}
        </p>
        <p className="text-sm text-foreground break-words">{r.approach}</p>
        {r.nextSteps?.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
            {r.nextSteps.map((s, i) => (
              <li key={i} className="break-words">{s}</li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className={SECTION} data-coach-flags>
        <p className={TITLE}>
          <AlertTriangle size={13} aria-hidden="true" /> {t("app.messages.coach.flagsTitle")}
        </p>
        {r.redFlags?.length ? (
          <ul className="space-y-2">
            {r.redFlags.map((f, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-foreground">{t(`app.messages.coach.flag.${f.kind}`)}</p>
                <Quoted text={f.quote} t={t} />
                <p className="text-xs text-foreground break-words">{f.why}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("app.messages.coach.flagsNone")}</p>
        )}
      </div>

      <div className={SECTION} data-coach-slips>
        <p className={TITLE}>
          <Undo2 size={13} aria-hidden="true" /> {t("app.messages.coach.slipsTitle")}
        </p>
        {r.slips?.length ? (
          <ul className="space-y-2">
            {r.slips.map((s, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-foreground">{t(`app.messages.coach.slip.${s.kind}`)}</p>
                <p className="text-xs text-muted-foreground italic break-words">
                  {t("app.messages.coach.youWrote", { quote: s.quote })}
                </p>
                <p className="text-xs text-foreground break-words">{s.why}</p>
                <p className="text-xs text-foreground break-words">
                  <span className="font-semibold">{t("app.messages.coach.fixLabel")}</span> {s.fix}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("app.messages.coach.slipsNone")}</p>
        )}
      </div>

      <Draft result={r} replyLanguage={coach.replyLanguage} canInsert={canInsert} onUseReply={onUseReply} t={t} />

      <div className="text-[11px] text-muted-foreground space-y-1" data-coach-grounding>
        {g.rollup && g.rollup.judged > 0 ? (
          <p>
            {g.rollup.scope === "trade" && g.tradeLabel
              ? t("app.messages.coach.groundingTrade", { trade: g.tradeLabel, won: g.rollup.won, judged: g.rollup.judged })
              : t("app.messages.coach.groundingCompany", { won: g.rollup.won, judged: g.rollup.judged })}
          </p>
        ) : (
          <p>{t("app.messages.coach.groundingNone")}</p>
        )}
        {g.examples ? (
          <p>{t("app.messages.temperature.examples", { won: g.examples.won, other: g.examples.other })}</p>
        ) : null}
        {g.review ? <p>{t("app.messages.coach.groundingReview", { month: `${g.review.year}-${String(g.review.month).padStart(2, "0")}` })}</p> : null}
        {r.scrubbed && (r.scrubbed.redFlags || r.scrubbed.slips) ? (
          <p>{t("app.messages.coach.dropped", { count: (r.scrubbed.redFlags || 0) + (r.scrubbed.slips || 0) })}</p>
        ) : null}
        <p>{t("app.messages.coach.redacted")}</p>
      </div>
    </div>
  );
}

/**
 * @param canRun     the member may spend the allowance (requests:view_create_edit).
 *                   The server re-checks; this only decides whether the button is drawn.
 * @param canInsert  the reply box can take a draft right now.
 * @param onUseReply (text) => void — puts the draft in the composer. Never sends.
 */
export default function ConversationCoach({ threadId, isDemo = false, canRun = false, canInsert = false, onUseReply, refreshKey = 0, formatDate }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (id) => {
      if (!id) return;
      setLoading(true);
      const result = await fetchList(`/api/messaging/threads/${encodeURIComponent(id)}/coach`);
      if (result.aborted) return;
      if (result.ok) {
        setState(result.data);
        setError("");
      } else {
        setState(null);
        setError(t("app.messages.coach.loadError"));
      }
      setLoading(false);
    },
    [t],
  );

  useEffect(() => {
    setNotice("");
    load(threadId);
  }, [load, threadId, refreshKey]);

  async function run(force) {
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: Boolean(force) }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.messages.coach.runError"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.status === "unchanged") setNotice(t("app.messages.coach.unchanged"));
      if (data.status === "too_short") setNotice(t("app.messages.coach.tooShort"));
      // Reload rather than trusting the POST: the remaining allowance moved,
      // and pre-spend numbers beside a result that just spent them is a
      // screen that disagrees with itself.
      await load(threadId);
    } finally {
      setRunning(false);
    }
  }

  if (loading && !state) return <div className="h-24 rounded-lg bg-accent animate-pulse" aria-hidden="true" />;

  if (error && !state) {
    return (
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm text-foreground">{error}</p>
        <button type="button" onClick={() => load(threadId)} className={`${BUTTON} mt-2 border border-border bg-card font-medium text-foreground`}>
          {t("app.messages.temperature.retry")}
        </button>
      </div>
    );
  }

  const coach = state?.coach || null;
  const price = state?.price || null;
  const hasCoach = Boolean(coach?.result);
  const fresh = hasCoach && !coach.stale;
  const runnable = Boolean(state?.available) && canRun && !isDemo && !running;

  return (
    <div className="space-y-3" data-coach-panel>
      <p className="text-xs text-muted-foreground">{t("app.messages.coach.subtitle")}</p>
      <Likelihood likelihood={state?.likelihood} t={t} />

      {hasCoach ? <Result coach={coach} canInsert={canInsert} onUseReply={onUseReply} formatDate={formatDate} t={t} /> : null}

      {/* ── The paid run, priced before the click ────────────────────────
          The reason it cannot run sits beside the button, never elsewhere. */}
      <div className={SECTION} data-coach-run>
        {state?.reasonKey && <p className="text-xs text-foreground">{t(state.reasonKey)}</p>}
        {price && !price.allowed && price.reason && <p className="text-xs text-foreground">{price.reason}</p>}
        {price && price.allowed && (
          <p className="text-xs text-muted-foreground">
            {price.payer === "fieldquo"
              ? t("app.messages.coach.priceFieldquo")
              : Number.isFinite(price.remaining)
                ? t("app.messages.temperature.price", { tokens: price.estimatedTokens, remaining: price.remaining })
                : t("app.messages.temperature.priceNoRemaining", { tokens: price.estimatedTokens })}
          </p>
        )}
        {!canRun && !isDemo && <p className="text-xs text-muted-foreground">{t("app.messages.coach.readOnly")}</p>}
        {notice && <p className="text-xs text-foreground" role="status">{notice}</p>}
        {error && state && <p className="text-xs text-destructive break-words">{error}</p>}
        {canRun && !isDemo && (
          <button
            type="button"
            onClick={() => run(fresh)}
            disabled={!runnable}
            className={`${BUTTON} bg-inverted text-inverted-foreground`}
            data-coach-run-button
          >
            {running ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles size={14} aria-hidden="true" />
            )}
            {running
              ? t("app.messages.coach.running")
              : !hasCoach
                ? t("app.messages.coach.run")
                : fresh
                  ? t("app.messages.coach.runAgainAnyway")
                  : t("app.messages.coach.runAgain")}
          </button>
        )}
        {fresh && canRun && !isDemo && <p className="text-[11px] text-muted-foreground">{t("app.messages.coach.nothingNew")}</p>}
      </div>
    </div>
  );
}
