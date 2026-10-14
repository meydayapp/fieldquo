// app/app/settings/notifications/ClientAlertsPanel.js
//
// "Client activity alerts" — the owner, 2026-10-14: "is there a way for a
// company to be notified when the client has opened the quote?", then "yes
// and as a text message as optional in the notifications (send me a text when
// the client has opened / approved a quote / change order / request)".
//
// Two halves, two owners:
//
//   · MY alerts — every member, their own row only
//     (/api/settings/alert-preferences): per event, the bell + push, email
//     and text, and the mobile number the texts go to.
//   · For the whole company — owners and admins only: one switch per event
//     (NotificationRule, /api/settings/notification-rules). Off means nobody
//     in the company gets that alert on any channel.
//
// Every switch auto-saves and rolls back on a refusal, the shape the page's
// other toggles use. A switch is never drawn live for an alert that cannot
// reach this person (wrong access, company switch off, no phone for a text):
// it is drawn disabled with the reason beside it, never as a box that saves
// and then does nothing.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, MessageSquare } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

const CHANNELS = ["inApp", "email", "sms"];

export default function ClientAlertsPanel({ readOnly = false }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchJson("/api/settings/alert-preferences");
      setData(d);
      setPhone(d?.phone || "");
    } catch (err) {
      setError(err?.message || t("app.clientAlerts.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function setChannel(event, channel, on) {
    const key = `${event}:${channel}`;
    setBusy(key);
    setError("");
    const previous = data;
    // Optimistic, rolled back on a refusal.
    setData((d) => ({
      ...d,
      events: d.events.map((e) => (e.event === event ? { ...e, channels: { ...e.channels, [channel]: on } } : e)),
    }));
    try {
      const d = await fetchJson("/api/settings/alert-preferences", { method: "PUT", body: { event, channel, on } });
      setData(d);
    } catch (err) {
      setData(previous);
      setError(err?.message || t("app.setNotifications.saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function savePhone() {
    setBusy("phone");
    setError("");
    setPhoneSaved(false);
    try {
      const d = await fetchJson("/api/settings/alert-preferences", { method: "PUT", body: { phone } });
      setData(d);
      setPhone(d?.phone || "");
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (err) {
      setError(err?.status === 400 ? t("app.clientAlerts.phoneInvalid") : err?.message || t("app.setNotifications.saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function setCompany(event, active) {
    // The rule type comes from the server's own table (CLIENT_ALERTS in
    // lib/notifications/clientAlerts.js), never a copy kept here.
    const rule = data.events.find((e) => e.event === event)?.rule;
    setBusy(`company:${event}`);
    setError("");
    const previous = data;
    setData((d) => ({ ...d, events: d.events.map((e) => (e.event === event ? { ...e, companyOn: active } : e)) }));
    try {
      await fetchJson("/api/settings/notification-rules", { method: "POST", body: { type: rule, active } });
      await load();
    } catch (err) {
      setData(previous);
      setError(err?.message || t("app.setNotifications.saveError"));
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return <div className="animate-pulse h-48 bg-accent rounded-xl" />;

  const smsReady = Boolean(data?.phoneValid) && !data?.smsOptedOut;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-start gap-3">
        <MessageSquare size={18} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.clientAlerts.title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("app.clientAlerts.desc")}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {data && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-1 py-2 font-medium" />
                  {CHANNELS.map((c) => (
                    <th key={c} className="px-2 py-2 font-medium text-center whitespace-nowrap">
                      {t(`app.clientAlerts.col.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => {
                  const off = !e.eligible || !e.companyOn;
                  const hint = !e.eligible
                    ? t("app.clientAlerts.notForRole")
                    : !e.companyOn
                      ? t("app.clientAlerts.companyOff")
                      : [
                          e.event === "quote.viewed" ? t("app.clientAlerts.hint.quote.viewed") : null,
                          e.event === "client_ticket.opened" ? t("app.clientAlerts.hint.client_ticket.opened") : null,
                          e.ownOnly ? t("app.clientAlerts.ownOnly") : null,
                        ]
                          .filter(Boolean)
                          .join(" ");
                  return (
                    <tr key={e.event} className="border-t border-border align-top">
                      <td className="px-1 py-3 min-w-[12rem]">
                        <div className="font-medium text-foreground">{t(`app.clientAlerts.event.${e.event}`)}</div>
                        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
                      </td>
                      {CHANNELS.map((c) => {
                        const key = `${e.event}:${c}`;
                        // A text needs a number that is not opted out — but
                        // an existing "on" stays visible and can be switched
                        // OFF whatever the phone's state.
                        const disabled = off || busy === key || (c === "sms" && !smsReady && !e.channels.sms);
                        return (
                          <td key={c} className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${t(`app.clientAlerts.event.${e.event}`)} — ${t(`app.clientAlerts.col.${c}`)}`}
                              checked={!off && Boolean(e.channels[c])}
                              disabled={readOnly || disabled}
                              onChange={(ev) => setChannel(e.event, c, ev.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="alert-phone">
              {t("app.clientAlerts.phoneLabel")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="alert-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                placeholder="(514) 555-0123"
                className="w-56 max-w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
              <button
                type="button"
                onClick={savePhone}
                disabled={readOnly || busy === "phone" || phone.trim() === (data.phone || "")}
                className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {busy === "phone" && <Loader2 size={14} className="animate-spin" />}
                {t("app.action.save")}
              </button>
              {phoneSaved && (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
                  <Check size={14} /> {t("app.action.saved")}
                </span>
              )}
            </div>
            {!data.phoneValid && <p className="text-xs text-muted-foreground">{t("app.clientAlerts.phoneNeeded")}</p>}
            {data.smsOptedOut && <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.clientAlerts.optedOut")}</p>}
            <p className="text-xs text-muted-foreground">{t("app.clientAlerts.smsNote", { cap: data.dailyCap })}</p>
          </div>

          {data.canManageCompany && (
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t("app.clientAlerts.companyTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("app.clientAlerts.companyDesc")}</p>
              <div className="space-y-1.5">
                {data.events.map((e) => (
                  <label key={e.event} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={e.companyOn}
                      disabled={readOnly || busy === `company:${e.event}`}
                      onChange={(ev) => setCompany(e.event, ev.target.checked)}
                    />
                    {t(`app.clientAlerts.event.${e.event}`)}
                    {busy === `company:${e.event}` && <Loader2 size={12} className="animate-spin" />}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

