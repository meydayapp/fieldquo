// app/components/clients/AutoMessages.js
//
// The screens' half of "No automatic emails or texts — send by hand only"
// (Client.autoMessagesOffAt; the gate is lib/clients/autoMessages.js).
//
//   AutoMessagesNotice  the one line beside a Send / Request payment / Send
//                       receipt button, and inside the send dialogs: this
//                       client gets nothing automatic, and pressing Send still
//                       works. Renders nothing when the switch is off — every
//                       other client's screens are unchanged.
//   AutoMessagesPanel   the client page's panel while the switch is on: why,
//                       since when, how it differs from "Do not contact", and
//                       every automatic message held back for them.
"use client";

import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { autoMessagesOff } from "@/lib/clients/autoMessages";

export function AutoMessagesNotice({ client, className = "" }) {
  const { t } = useTranslation();
  if (!autoMessagesOff(client)) return null;
  return (
    <p className={`text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5 ${className}`} data-auto-messages-notice>
      <BellOff size={13} className="shrink-0 mt-0.5" />
      <span>
        {t("app.autoMessages.notice")}
        {client.autoMessagesOffReason ? ` ${t("app.autoMessages.reasonInline", { reason: client.autoMessagesOffReason })}` : ""}
      </span>
    </p>
  );
}

export function AutoMessagesPanel({ client }) {
  const { t, language } = useTranslation();
  const off = autoMessagesOff(client);
  const [skips, setSkips] = useState(null);

  useEffect(() => {
    if (!off || !client?.id) return;
    let live = true;
    fetch(`/api/clients/${client.id}/auto-messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setSkips(Array.isArray(d?.skips) ? d.skips : []))
      .catch(() => live && setSkips([]));
    return () => {
      live = false;
    };
  }, [off, client?.id]);

  if (!off) return null;
  const when = (v) => (v ? new Date(v).toLocaleString(language) : "");

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-5 py-4 space-y-2" data-auto-messages-panel>
      <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
        <BellOff size={15} className="text-amber-700 dark:text-amber-300" />
        {t("app.autoMessages.title")}
      </h2>
      <p className="text-sm text-foreground">{t("app.autoMessages.body")}</p>
      {client.autoMessagesOffReason && (
        <p className="text-sm text-foreground break-words">
          <span className="text-muted-foreground">{t("app.autoMessages.reasonLabel")}: </span>
          {client.autoMessagesOffReason}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("app.autoMessages.since", { date: when(client.autoMessagesOffAt) })}</p>
      <p className="text-xs text-muted-foreground">{t("app.autoMessages.vsDnc")}</p>

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
                <span className="text-muted-foreground"> · {when(s.lastSkippedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
