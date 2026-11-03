// app/app/settings/follow-ups/FlowDiagram.js
//
// A picture of what the follow-up automation actually does.
//
// ── Why this is read-only, and why it is not a canvas ──────────────────────
//
// The ask was a Power-Automate-style process view. Power Automate's own flow
// view is a VERTICAL stack of trigger → wait → action, not a graph you pan
// around, and that is the shape copied here — for a reason beyond imitation:
// this page has to work in a van on a 390px phone. A node graph with pan and
// zoom is strictly worse than a list at that width, so the diagram is a single
// vertical spine at every breakpoint and never scrolls sideways.
//
// Editing stays in the list below. A drag-and-drop editor is a much larger
// feature than a view, and half of one would be exactly the "control that
// appears to work and doesn't" this codebase keeps getting swept for.
//
// ── Why it can't drift ─────────────────────────────────────────────────────
//
// Every box below is derived from a real FollowUpRule row plus TRIGGER_META in
// lib/followUps/triggers.js, which the cron route implements. Nothing here is
// hand-drawn: the delay comes from delayValue/delayUnit, the channel from the
// rule's own `channel` column through followUpChannel(), the stop condition
// from the cron's own `where` clause via `stopsWhen`. A rule with no template
// is drawn as broken because the cron skips it, and a paused rule is drawn as
// paused because the cron only loads `active: true`.
//
// ── The channel used to be a constant ──────────────────────────────────────
//
// This read `FOLLOW_UP_CHANNEL === "email" ? t("…sendEmail") : FOLLOW_UP_CHANNEL`
// — a conditional whose else branch would have printed the bare word "sms" at
// a contractor, left behind by the single-channel constant it was written
// against. Each step now answers for itself, and three states that only exist
// for a text are drawn because the cron genuinely produces all three: the
// company's follow-up-text switch being off (nothing sends), a trigger with no
// SMS wording (nothing sends), and a client with no mobile (that client is
// skipped).
//
// ── Accessibility ─────────────────────────────────────────────────────────
//
// aria-hidden. The diagram restates the list underneath it, and the list is
// the source of truth for screen readers — including the stop conditions,
// which the list spells out in words for exactly this reason. Nothing is
// readable ONLY here.
"use client";

import { Fragment } from "react";
import { Zap, Clock, Mail, MessageSquare, Ban, AlertTriangle, Pause } from "lucide-react";
import { followUpChannel, triggerMaySms } from "@/lib/followUps/triggers";
import {
  buildFlows,
  channelKeyFor,
  channelsIn,
  SKIPPED_KEYS,
  TRIGGER_LABEL_KEYS,
  STOP_KEYS,
  ONCE_KEYS,
} from "@/lib/followUps/flow";
import { formatDuration } from "@/lib/i18n/duration";
import { useTranslation } from "@/app/hooks/useTranslation";

function Node({ icon, tone = "neutral", children }) {
  const discTone =
    tone === "trigger"
      ? "bg-inverted text-inverted-foreground border-transparent"
      : tone === "warning"
        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
        : "bg-card border-border text-muted-foreground";

  return (
    <li className="relative">
      <span
        className={`absolute -left-9 top-1.5 grid h-[26px] w-[26px] place-items-center rounded-full border ${discTone}`}
      >
        {icon}
      </span>
      {children}
    </li>
  );
}

/**
 * @param smsEnabled  whether Company.followUpSmsOn is on, from the rules API.
 *                    A boolean, not a truthiness: `undefined` (an older
 *                    response, or a load that answered without it) must not
 *                    be drawn as "switched off", which would put an amber
 *                    warning on a step that is sending perfectly well.
 */
export default function FlowDiagram({ rules, smsEnabled }) {
  const { t } = useTranslation();

  const flows = buildFlows(rules);
  // Only the channels these rules use — a company with no text rule is not
  // told about mobile numbers it does not need.
  const channels = channelsIn(flows);
  const smsOff = smsEnabled === false;
  // No rules is not an empty canvas. The page already says so in words above
  // this component; drawing an empty frame would only imply something is
  // configured.
  if (flows.length === 0) return null;

  return (
    <section
      aria-hidden="true"
      className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-6"
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.followFlow.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("app.followFlow.subtitle")}
        </p>
      </div>

      {flows.map((flow) => {
        const triggerLabelKey = TRIGGER_LABEL_KEYS[flow.triggerEvent];
        const triggerLabel = triggerLabelKey
          ? t(triggerLabelKey)
          : flow.triggerEvent;
        const entityType = flow.meta?.entityType;
        const stopKey = STOP_KEYS[flow.meta?.stopsWhen];
        const onceKey = ONCE_KEYS[entityType];

        return (
          <div key={flow.triggerEvent} className="relative pl-9">
            {/* The spine. Inset top and bottom so it reads as connecting the
                discs rather than running off the ends of the flow. Kept
                outside the <ol> so space-y-3 doesn't offset the first node
                against it.

                NOT bg-border. The app's hairline borders sit around 1.3:1 on
                card, which is fine for a divider nobody needs to see and
                useless for the one line in this component that carries the
                meaning. muted-foreground at 70% measures 3.26:1 on card in
                light and 4.48:1 in dark (canvas-composited in a browser, not
                estimated), clearing the 3:1 WCAG floor for a non-text graphic
                in both themes. */}
            <span className="absolute left-[13px] top-4 bottom-4 w-px bg-muted-foreground/70" />

            <ol className="space-y-3">
            <Node icon={<Zap size={12} />} tone="trigger">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.followFlow.triggerLabel")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {triggerLabel}
              </div>
              {!flow.meta && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {t("app.followFlow.unknownTrigger")}
                </p>
              )}
            </Node>

            {flow.steps.map((rule) => {
              const channel = followUpChannel(rule);
              // What "nothing to send" means differs by channel.
              //
              // EMAIL: a hand-made rule with no template. A FieldQuo default
              // with no template is NOT broken — the cron renders its
              // built-in wording in the client's language.
              //
              // SMS: a template is irrelevant (the wording is a message type
              // on Settings › Messages), so the only broken text rule is one
              // on a trigger with no SMS wording at all. The save routes
              // refuse to create that, which is why it is drawn rather than
              // assumed impossible: a row stored before the refusal existed
              // would otherwise look armed.
              const broken =
                channel === "sms"
                  ? !triggerMaySms(rule.triggerEvent)
                  : !rule.template && !rule.builtInKey;
              // Not broken, but not sending either: the rule is fine and the
              // company has not switched follow-up texts on.
              const offForCompany = channel === "sms" && smsOff && !broken;

              return (
                <Fragment key={rule.id}>
                  <Node icon={<Clock size={12} />}>
                    <span className="inline-block text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                      {t("app.followFlow.wait", {
                        duration: formatDuration(t, rule.delayValue, rule.delayUnit),
                      })}
                    </span>
                  </Node>

                  <Node
                    icon={
                      broken || offForCompany ? (
                        <AlertTriangle size={12} />
                      ) : channel === "sms" ? (
                        <MessageSquare size={12} />
                      ) : (
                        <Mail size={12} />
                      )
                    }
                    tone={broken || offForCompany ? "warning" : "neutral"}
                  >
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        rule.active
                          ? broken || offForCompany
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30"
                            : "border-border bg-background"
                          : // Paused: dashed and faded, because the cron loads
                            // active rules only and this step genuinely does
                            // not happen.
                            "border-dashed border-border bg-transparent opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground break-words">
                          {rule.name}
                        </span>
                        {!rule.active && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            <Pause size={10} /> {t("app.setFollowUps.paused")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 break-words">
                        {t(channelKeyFor(rule))}
                        {channel === "sms"
                          ? ` · ${t("app.followFlow.smsWording")}`
                          : rule.template
                            ? ` · ${rule.template.name}`
                            : rule.builtInKey
                              ? ` · ${t("app.setFollowUps.builtInWording")}`
                              : ""}
                      </p>
                      {broken && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {channel === "sms"
                            ? t("app.followFlow.noSmsWording")
                            : t("app.followFlow.noTemplate")}
                        </p>
                      )}
                      {offForCompany && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {t("app.followFlow.smsOffNote")}
                        </p>
                      )}
                      {!rule.active && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("app.followFlow.pausedNote")}
                        </p>
                      )}
                    </div>
                  </Node>
                </Fragment>
              );
            })}

            <Node icon={<Ban size={12} />}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.followFlow.stopTitle")}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stopKey ? t(stopKey) : t("app.followFlow.stopUnknown")}
              </p>
              {onceKey && (
                <p className="text-xs text-muted-foreground">{t(onceKey)}</p>
              )}
            </Node>
            </ol>
          </div>
        );
      })}

      {/* One line per channel these rules actually use. The email sentence
          used to be unconditional, which would have told a company whose only
          rules are texts that clients with no EMAIL are skipped — true of
          nothing they have configured. */}
      <div className="border-t border-border pt-3 space-y-1">
        {channels.map((channel) => (
          <p key={channel} className="text-xs text-muted-foreground">
            {t(SKIPPED_KEYS[channel])}
          </p>
        ))}
      </div>
    </section>
  );
}
