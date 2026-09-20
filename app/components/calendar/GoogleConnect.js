"use client";

// app/components/calendar/GoogleConnect.js
//
// Settings → My calendar → "Connect Google Calendar". The member's OWN
// connection: connect, "connected as {email} since {date}", the two
// switches, disconnect — and one sentence that is the whole promise:
// FieldQuo creates and updates its own events only; it never edits yours.
//
// Three honest states, none of them a dead button:
//   not configured   the deployment has no Google OAuth client yet — one
//                    sentence, no button (the connect route refuses too)
//   not connected    a link to /api/calendar/google/connect
//   connected        the email, the date, the switches, Disconnect
//
// The ?google=<word> the callback lands with is read once, shown as a
// banner, and scrubbed from the URL so a reload does not repeat it.
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck, CheckCircle2, Link2, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { localeFormat } from "@/lib/calendar/monthGrid";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";

const RESULT_KEYS = {
  connected: { tone: "success", key: "app.calendar.google.result.connected" },
  denied: { tone: "error", key: "app.calendar.google.result.denied" },
  bad_state: { tone: "error", key: "app.calendar.google.result.badState" },
  session: { tone: "error", key: "app.calendar.google.result.session" },
  not_configured: { tone: "error", key: "app.calendar.google.result.notConfigured" },
  exchange_failed: { tone: "error", key: "app.calendar.google.result.exchangeFailed" },
  no_refresh_token: { tone: "error", key: "app.calendar.google.result.noRefreshToken" },
  scope_missing: { tone: "error", key: "app.calendar.google.result.scopeMissing" },
};

function Switch({ checked, onChange, disabled, label, hint }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5 disabled:opacity-50 ${
          checked ? "bg-inverted" : "bg-accent"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export default function GoogleConnect() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(null); // { configured, missing, connection }
  const [loadFailed, setLoadFailed] = useState(false);
  const [banner, setBanner] = useState(null); // { tone, text }
  const [saving, setSaving] = useState(null); // "writeEnabled" | "busyReadEnabled" | "disconnect"
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setStatus(await fetchJson("/api/calendar/google"));
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The callback's one word, shown once.
  useEffect(() => {
    const result = searchParams.get("google");
    if (!result) return;
    const spec = RESULT_KEYS[result] || { tone: "error", key: "app.calendar.google.result.unknown" };
    setBanner({ tone: spec.tone, text: t(spec.key) });
    const next = new URLSearchParams(searchParams.toString());
    next.delete("google");
    router.replace(`${window.location.pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }, [searchParams, router, t]);

  async function flip(name, value) {
    setSaving(name);
    try {
      const data = await fetchJson("/api/calendar/google", { method: "PATCH", body: { [name]: value } });
      setStatus((prev) => ({ ...(prev || {}), connection: data.connection }));
      if (name === "writeEnabled") {
        if (value && data.eventsCreated > 0) showToast({ message: t("app.calendar.google.toast.created", { n: data.eventsCreated }), tone: "success" });
        if (!value && data.eventsRemoved > 0) showToast({ message: t("app.calendar.google.toast.removed", { n: data.eventsRemoved }), tone: "info" });
      }
    } catch (err) {
      showError(err.message || t("app.calendar.google.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  async function disconnect() {
    setSaving("disconnect");
    try {
      const data = await fetchJson("/api/calendar/google/disconnect", { method: "POST" });
      setConfirmDisconnect(false);
      setStatus((prev) => ({ ...(prev || {}), connection: null }));
      setBanner({
        tone: "success",
        text:
          data.eventsRemoved > 0
            ? t("app.calendar.google.result.disconnectedRemoved", { n: data.eventsRemoved })
            : t("app.calendar.google.result.disconnected"),
      });
    } catch (err) {
      showError(err.message || t("app.calendar.google.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  const connection = status?.connection || null;

  return (
    <section className="glass-effect rounded-xl p-5 space-y-4" aria-labelledby="google-calendar-heading">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <CalendarCheck size={18} className="text-foreground" />
        </span>
        <div className="min-w-0">
          <h2 id="google-calendar-heading" className="text-base font-semibold text-foreground">
            {t("app.calendar.google.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("app.calendar.google.promise")}</p>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            banner.tone === "success"
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
        >
          {banner.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{banner.text}</span>
        </div>
      )}

      {loadFailed ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t("app.calendar.google.loadFailed")}</span>
          <button type="button" onClick={load} className="min-h-[44px] px-3 rounded-lg border border-border text-foreground">
            {t("app.action.retry")}
          </button>
        </div>
      ) : !status ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> {t("app.common.loading")}
        </div>
      ) : !status.configured ? (
        // No button: the connect route refuses without these too, so a link
        // here would be a control that appears to work and doesn't.
        <p className="text-sm text-muted-foreground">{t("app.calendar.google.notSetUp")}</p>
      ) : !connection ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("app.calendar.google.notConnectedHint")}</p>
          <a
            href="/api/calendar/google/connect"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-inverted text-inverted-foreground text-sm font-medium"
          >
            <Link2 size={15} /> {t("app.calendar.google.connect")}
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {t("app.calendar.google.connectedAs", {
              email: connection.email || t("app.calendar.google.unknownAccount"),
              date: connection.connectedAt
                ? localeFormat(new Date(connection.connectedAt), language, { day: "numeric", month: "short", year: "numeric" })
                : "",
            })}
          </p>
          {connection.lastError && (
            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{t("app.calendar.google.lastError", { error: connection.lastError })}</span>
            </p>
          )}
          <div className="divide-y divide-border rounded-lg border border-border px-3">
            <Switch
              checked={connection.writeEnabled}
              disabled={saving !== null}
              onChange={(v) => flip("writeEnabled", v)}
              label={t("app.calendar.google.switchWrite")}
              hint={t("app.calendar.google.switchWriteHint")}
            />
            <Switch
              checked={connection.busyReadEnabled}
              disabled={saving !== null}
              onChange={(v) => flip("busyReadEnabled", v)}
              label={t("app.calendar.google.switchBusy")}
              hint={t("app.calendar.google.switchBusyHint")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              disabled={saving !== null}
              className="min-h-[44px] px-4 rounded-lg border border-border text-sm text-foreground disabled:opacity-50"
            >
              {t("app.calendar.google.disconnect")}
            </button>
            <a href="/api/calendar/google/connect" className="text-sm text-muted-foreground underline underline-offset-2">
              {t("app.calendar.google.reconnect")}
            </a>
          </div>
          <DeleteConfirmModal
            isOpen={confirmDisconnect}
            onClose={() => setConfirmDisconnect(false)}
            onConfirm={disconnect}
            title={t("app.calendar.google.disconnect")}
            message={t("app.calendar.google.disconnectConfirm")}
            itemName={connection.email || ""}
            busy={saving === "disconnect"}
          />
        </div>
      )}
    </section>
  );
}
