"use client";

// app/components/messaging/HandlingTimeline.js
//
// "How this was handled" — a collapsed line above the composer that opens
// into the AI team's steps on this conversation, in time order: what the
// front desk made of the first message, who it went to, what each employee
// looked up, who handed off to whom, when a person took over, what was
// proposed and who said yes.
//
// Read-only. The steps come from GET /api/messaging/threads/[id]/handling,
// which builds them from rows that already exist
// (lib/aiEmployee/handlingTimeline.js); there is no control in here that
// changes anything, so there is nothing here that could appear to work and
// not. The cost and a proposal's contact details arrive only for a viewer the
// server decided may see them — this component draws what it was given and
// never decides access itself.
//
// Nothing is drawn for a conversation the AI team never touched: an empty
// "How this was handled" on every hand-answered thread would be noise.

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Hand,
  Layers,
  ListChecks,
  RefreshCw,
  Route,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

const ICON = {
  front_desk: Route,
  handed_off: ArrowRightLeft,
  escalated: ShieldAlert,
  human_took_over: UserRound,
  resumed: Bot,
  burst_merged: Layers,
  reply: Bot,
  quiet: CircleSlash,
  proposal: Hand,
};

/** Capitalise the first letter of a finished sentence — the actor phrases
 *  ("the AI team", "a former AI employee") are lower-case so they read right
 *  mid-sentence, and a sentence can open with one. No-op for scripts without
 *  case. */
function sentence(text) {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export default function HandlingTimeline({ threadId, refreshKey, formatDate }) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  // null = not loaded yet; the bar is not drawn until there is something to
  // say, so a thread the AI never touched shows nothing at all.
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");

  // Bumped by Retry; part of the read's dependencies so a press re-reads.
  const [attempt, setAttempt] = useState(0);

  // Re-read when the conversation moves (a message in or out changes what
  // the AI team did), not on a timer. A response to an earlier read that
  // lands after a newer one started is dropped, and the parent keys this
  // component by thread id — so a different thread starts closed and empty,
  // and one thread's steps are never drawn under another's name.
  useEffect(() => {
    if (!threadId) return undefined;
    let cancelled = false;
    (async () => {
      const result = await fetchList(`/api/messaging/threads/${encodeURIComponent(threadId)}/handling`);
      if (cancelled || result.aborted) return;
      if (result.ok) {
        setData({ steps: Array.isArray(result.data?.steps) ? result.data.steps : [], truncated: Boolean(result.data?.truncated) });
        setErrorKey("");
      } else {
        setErrorKey(result.errorKey || "app.messages.handling.loadError");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, refreshKey, attempt]);

  const steps = data?.steps || [];
  if (!errorKey && !steps.length) return null;

  const time = (at) => {
    if (!at) return null;
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    return `${formatDate(d)} ${d.toLocaleTimeString(language || undefined, { hour: "numeric", minute: "2-digit" })}`;
  };

  return (
    <section className="border-t border-border bg-card text-xs" data-handling-timeline>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[40px] w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground hover:bg-muted"
      >
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <ListChecks size={13} aria-hidden="true" />
        <span className="font-semibold text-foreground">{t("app.messages.handling.title", "How this was handled")}</span>
        {steps.length ? (
          <span className="rounded-full bg-muted px-1.5 tabular-nums text-muted-foreground">{steps.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className="max-h-72 overflow-y-auto px-3 pb-3">
          {errorKey ? (
            <div className="space-y-2">
              <p className="text-foreground break-words">{t(errorKey, t("app.messages.handling.loadError"))}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border bg-card px-3 font-semibold text-foreground hover:bg-muted"
              >
                <RefreshCw size={12} aria-hidden="true" /> {t("app.load.retry")}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-muted-foreground break-words">{t("app.messages.handling.hint")}</p>
              {data?.truncated ? (
                <p className="mb-2 text-muted-foreground break-words">{t("app.messages.handling.truncated")}</p>
              ) : null}
              <ol className="space-y-2.5">
                {steps.map((step) => (
                  <Step key={step.id} step={step} t={t} language={language} time={time} />
                ))}
              </ol>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Step({ step, t, language, time }) {
  const Icon = ICON[step.kind] || Bot;
  const when = time(step.at);
  return (
    <li className="flex gap-2">
      <Icon size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm text-foreground break-words">
          {sentence(t(step.key, words(step.params, t, language)))}
          {step.params?.count > 1 ? <span className="ml-1 text-muted-foreground tabular-nums">×{step.params.count}</span> : null}
        </p>
        {step.note ? <p className="text-muted-foreground break-words">“{step.note}”</p> : null}
        {step.outcome ? (
          <p className="text-foreground break-words">
            {t(step.outcome.key, { person: step.outcome.params?.person || "", status: step.outcome.params?.status || "" })}
            {time(step.outcome.at) ? <span className="ml-1 text-muted-foreground">· {time(step.outcome.at)}</span> : null}
          </p>
        ) : null}
        {Array.isArray(step.tools) && step.tools.length ? (
          <p className="text-muted-foreground break-words">
            {t("app.messages.handling.toolsLabel")}{" "}
            {step.tools
              .map((chip) => {
                const name = t(`app.aiEmployee.tool.${chip.name}`, chip.name);
                const label =
                  chip.state === "failed"
                    ? t("app.messages.handling.toolFailed", { tool: name })
                    : chip.state === "proposed"
                      ? t("app.messages.handling.toolProposed", { tool: name })
                      : name;
                return chip.count > 1 ? `${label} ×${chip.count}` : label;
              })
              .join(" · ")}
          </p>
        ) : null}
        {Array.isArray(step.args) && step.args.length ? (
          <dl className="grid grid-cols-[auto,1fr] gap-x-2 text-muted-foreground">
            {step.args.map((a) => (
              <div key={a.field} className="contents">
                <dt>{t(`app.messages.handling.arg.${a.field}`, a.field)}</dt>
                <dd className="text-foreground break-words">{a.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {step.argsHidden ? <p className="text-muted-foreground break-words">{t("app.messages.handling.argsHidden")}</p> : null}
        <p className="flex flex-wrap gap-x-2 text-muted-foreground tabular-nums">
          {when ? <time dateTime={step.at}>{when}</time> : null}
          {step.model ? <span>{step.model}</span> : null}
          {step.confidence ? (
            <span>
              {t("app.messages.handling.confidenceLabel", {
                level: t(`app.messages.handling.confidence.${step.confidence}`, step.confidence),
              })}
            </span>
          ) : null}
          {typeof step.costCents === "number" ? (
            <span>
              {t("app.messages.handling.cost", {
                amount: formatAppMoney(step.costCents / 100, CREDIT_CURRENCY, language),
              })}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

/** The builder's raw params, turned into words for this language. */
function words(params, t, language) {
  const p = params || {};
  const actor = (a) => {
    if (!a) return t("app.messages.handling.team");
    if (a.missing) return t("app.messages.handling.former");
    const role = a.role && a.role !== "custom" ? t(`app.aiEmployee.role.${a.role}`, a.role) : null;
    if (!a.name) return role || t("app.messages.handling.team");
    return role ? `${a.name} (${role})` : a.name;
  };
  const slot = p.slotAt ? new Date(p.slotAt) : null;
  return {
    who: actor(p.who),
    from: actor(p.from),
    to: actor(p.to),
    person: p.person || "",
    intent: p.intent ? t(`app.aiEmployee.intent.${p.intent}`, p.intent) : "",
    tool: p.tool ? t(`app.aiEmployee.tool.${p.tool}`, p.tool) : "",
    slot:
      slot && !Number.isNaN(slot.getTime())
        ? slot.toLocaleString(language || undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        : "",
    // Only a quiet step carries a reason or a code.
    why: p.reason
      ? t(`app.messages.handling.why.${p.reason}`)
      : p.code
        ? t("app.messages.handling.why.other", { code: p.code })
        : "",
    count: p.count || 1,
  };
}
