// app/components/clients/AutoMessages.js
//
// The screens' half of "No automatic emails or texts — send by hand only"
// (Client.autoMessagesOffAt) and of "Do not contact" (Client.doNotContactAt),
// which since 2026-10-14 holds back the same automatic messages. The gate is
// lib/clients/autoMessages.js; both components ask its autoMessageHold, so a
// screen can never promise a message the gate will refuse.
//
//   AutoMessagesNotice  the one line beside a Send / Request payment / Send
//                       receipt button, and inside the send dialogs: this
//                       client gets nothing automatic, and pressing Send still
//                       works. For Do not contact it is a warning: send only
//                       what they need (an invoice they owe). Renders nothing
//                       when neither is set — every other client's screens
//                       are unchanged.
//   AutoMessagesPanel   the client page's panel while either is set: which
//                       one, why, since when, how the two differ, and every
//                       automatic message held back for them.
"use client";

import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { autoMessageHold, autoMessagesOff, AUTO_MESSAGE_HOLD } from "@/lib/clients/autoMessages";

export function AutoMessagesNotice({ client, className = "" }) {
  const { t } = useTranslation();
  const hold = autoMessageHold(client);
  if (!hold) return null;
  const dnc = hold.reason === AUTO_MESSAGE_HOLD.DO_NOT_CONTACT;
  return (
    <p
      className={`text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5 ${className}`}
      data-auto-messages-notice={hold.reason}
    >
      <BellOff size={13} className="shrink-0 mt-0.5" />
      <span className="break-words min-w-0">
        {dnc ? t("app.autoMessages.dncNotice") : t("app.autoMessages.notice")}
        {hold.note ? ` ${t("app.autoMessages.reasonInline", { reason: hold.note })}` : ""}
      </span>
    </p>
  );
}

export function AutoMessagesPanel({ client }) {
  const { t, language } = useTranslation();
  const hold = autoMessageHold(client);
  const held = Boolean(hold);
  const [skips, setSkips] = useState(null);

  useEffect(() => {
    if (!held || !client?.id) return;
    let live = true;
    fetch(`/api/clients/${client.id}/auto-messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setSkips(Array.isArray(d?.skips) ? d.skips : []))
      .catch(() => live && setSkips([]));
    return () => {
      live = false;
    };
  }, [held, client?.id]);

  if (!hold) return null;
  const when = (v) => (v ? new Date(v).toLocaleString(language) : "");
  const dnc = hold.reason === AUTO_MESSAGE_HOLD.DO_NOT_CONTACT;

  return (
    <div
      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-5 py-4 space-y-2"
      data-auto-messages-panel={hold.reason}
    >
      <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
        <BellOff size={15} className="text-amber-700 dark:text-amber-300" />
        {dnc ? t("app.callbacks.dncBadge") : t("app.autoMessages.title")}
      </h2>
      <p className="text-sm text-foreground">{dnc ? t("app.autoMessages.dncBody") : t("app.autoMessages.body")}</p>
      {hold.note && (
        <p className="text-sm text-foreground break-words">
          <span className="text-muted-foreground">{t("app.autoMessages.reasonLabel")}: </span>
          {hold.note}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {dnc ? t("app.autoMessages.dncSince", { date: when(hold.since) }) : t("app.autoMessages.since", { date: when(hold.since) })}
      </p>
      {/* Both set: Do not contact is what the gate answers with, so turning
          the switch off resumes nothing — said here, beside it. */}
      {dnc && autoMessagesOff(client) && <p className="text-xs text-muted-foreground">{t("app.autoMessages.dncAlsoSwitch")}</p>}
      {!dnc && <p className="text-xs text-muted-foreground">{t("app.autoMessages.vsDnc")}</p>}

      <div className="pt-2 border-t border-amber-200 dark:border-amber-900">
        <h3 className="text-xs font-semibold text-foreground mb-1">{t("app.autoMessages.heldTitle")}</h3>
        {skips === null ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : skips.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("app.autoMessages.heldNone")}</p>
        ) : (
          <ul className="space-y-1" data-auto-messages-held>
            {skips.map((s) => (
              <li key={s.id} className="text-xs text-foreground break-words">
                <span className="font-medium">{t(`app.autoMessages.sender.${s.sender}`)}</span>
                {s.refLabel ? ` · ${s.refLabel}` : ""}
                {/* Which of the two held it back, when it was Do not contact
                    (AutoMessageSkip.cause) — the switch's rows read as before. */}
                {s.cause === AUTO_MESSAGE_HOLD.DO_NOT_CONTACT ? ` · ${t("app.autoMessages.causeDnc")}` : ""}
                <span className="text-muted-foreground"> · {when(s.lastSkippedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
