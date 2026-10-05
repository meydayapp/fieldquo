"use client";

// app/app/urgent/[id]/page.js
//
// Where the on-call text lands (lib/aiEmployee/urgentAlerts.js alertLink):
// what the customer said, who has been texted, and the one button that
// matters — "I've got it", which stops the next person being texted.
//
// A BUTTON, never the page load: a phone's link preview opens the URL in a
// text before the person does, and a preview must not take an urgent leak
// off the ladder for them.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Siren, Check, MessageSquare } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";

const BTN = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px]";

export default function UrgentAlertPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = String(params?.id || "");
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/ai-employee/alerts/${encodeURIComponent(id)}`);
    if (!res.ok) {
      await reportResponseError(res, setError, t("app.urgent.loadError", "Couldn't load this urgent conversation."));
      return;
    }
    setAlert((await res.json()).alert);
  }, [id, t]);

  useEffect(() => {
    load().catch(() => setError(t("app.urgent.loadError", "Couldn't load this urgent conversation.")));
  }, [load, t]);

  async function acknowledge() {
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-employee/alerts/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.urgent.ackError", "That didn't go through — try again."));
        return;
      }
      setAlert((await res.json()).alert);
    } catch {
      showError(t("app.urgent.ackError", "That didn't go through — try again."));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-4 text-sm text-red-700 dark:text-red-300">
        {error}{" "}
        <button type="button" className="underline" onClick={() => load()}>
          {t("app.common.retry", "Try again")}
        </button>
      </div>
    );
  }
  if (!alert) return <p className="max-w-xl mx-auto p-4 text-sm text-muted-foreground">{t("app.common.loading", "Loading…")}</p>;

  const done = Boolean(alert.acknowledgedAt);
  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Siren size={20} className="text-red-600 dark:text-red-400" />
        <h1 className="text-lg font-semibold text-foreground">
          {alert.tier === "emergency" ? t("app.urgent.titleEmergency", "Emergency") : t("app.urgent.title", "Urgent")}
          {" — "}
          {t(`app.aiEmployee.safety.cat.${alert.category}`, alert.category)}
        </h1>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        {alert.customerName ? <p className="text-sm font-medium text-foreground">{alert.customerName}</p> : null}
        {alert.summary ? <p className="text-sm text-foreground">“{alert.summary}”</p> : null}
        <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
        <Link href={`/app/messages?thread=${encodeURIComponent(alert.threadId)}`} className={`${BTN} border border-border text-foreground`}>
          <MessageSquare size={15} /> {t("app.urgent.openConversation", "Open the conversation")}
        </Link>
      </div>

      {done ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Check size={16} />
          {alert.acknowledgedBy
            ? t("app.urgent.takenBy", "{name} has it.", { name: alert.acknowledgedBy })
            : t("app.urgent.taken", "Somebody has it.")}
        </p>
      ) : (
        <button type="button" className={`${BTN} w-full bg-primary text-primary-foreground disabled:opacity-50`} disabled={busy} onClick={acknowledge}>
          <Check size={16} /> {t("app.urgent.ack", "I've got it")}
        </button>
      )}
      {!done ? (
        <p className="text-xs text-muted-foreground">
          {t("app.urgent.ackHint", "Pressing this stops the next person on call being texted.")}
        </p>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-foreground">{t("app.urgent.ladderTitle", "Who was told")}</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {alert.steps.length ? (
            alert.steps.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                {s.name || t("app.aiEmployee.safety.someone", "A team member")} · {t(`app.urgent.channel.${s.channel}`, s.channel)} ·{" "}
                {s.ok ? t("app.urgent.sent", "sent") : t(`app.aiEmployee.safety.problem.${s.reason}`, s.reason || "", { name: "" })}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">{t("app.urgent.nobodyTexted", "Nobody was texted.")}</li>
          )}
        </ul>
        {alert.reason ? (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">{t(`app.aiEmployee.safety.problem.${alert.reason}`, alert.reason, { name: "" })}</p>
        ) : null}
      </div>
    </div>
  );
}
