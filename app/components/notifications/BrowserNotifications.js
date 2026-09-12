// app/components/notifications/BrowserNotifications.js
//
// The "Browser notifications" block, mounted on the three settings screens:
// /app/settings/notifications, /sales/pay and /platform/settings. One
// component, three endpoints, because the block's promises are identical on
// every surface and the thing that differs — who the person is — is decided
// by the endpoint's gate, never here.
//
// ══ What the switch means ═════════════════════════════════════════════════
//
// ON:  1. ask the browser for permission (a prompt, from this click);
//      2. remember, in this browser, that this person wants alerts
//         (lib/notify/browser.js NOTIFY_PREF_KEY) — from here on the pages'
//         own notify() calls show a system notification when the tab is in
//         the background;
//      3. when the deployment has VAPID keys, register public/sw.js and
//         store this browser's push subscription, so the same events arrive
//         with the tab closed.
// OFF: forget the flag, disable the server row, drop the subscription.
//
// The permission is the browser's and cannot be revoked from a page: a
// "denied" state is shown as a fact with where to change it, never as a
// switch that would do nothing.
//
// ══ Honest about push ═════════════════════════════════════════════════════
//
// Without WEB_PUSH_* on the deployment the switch still governs the in-tab
// half — that is real, it works, and the owner's question ("allow browser
// notifications onto the user's computer") is answered by it — while the
// block says in words that push with the tab closed is not set up here.
// The alternative the brief named, disabling the switch entirely, would
// have hidden a working feature behind a missing optional one.
//
// ══ Test ══════════════════════════════════════════════════════════════════
//
// "Send a test notification" shows a system notification NOW, focused tab
// or not — the one time a person wants to see the thing itself rather than
// a toast — and, when push is set up, asks the server to push one too, so
// the whole path (VAPID → push service → worker) is proven from the screen
// it was configured on. The two carry the same tag and collapse into one.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BellRing, Check, Loader2, Send } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import {
  NOTIFICATION_ICON,
  enabledHere,
  permissionState,
  requestPermission,
  setEnabledHere,
  supported,
} from "@/lib/notify/browser";
import { pushSupported, subscribePush, unsubscribePush } from "@/lib/notify/swClient";

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-browser-notify-switch
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none disabled:opacity-50 ${
        checked ? "bg-inverted" : "bg-accent"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform motion-reduce:transition-none ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/**
 * Show a system notification right now, ignoring focus — for the test
 * button only. Through the worker when one is registered (Android Chrome
 * has no constructor path), the constructor otherwise.
 */
async function showTestNotification(title, body) {
  const options = { body, tag: "fq-test", icon: NOTIFICATION_ICON, data: { url: window.location.pathname } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const n = new window.Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ endpoint: string }} props  the surface's push-subscription route
 */
export default function BrowserNotifications({ endpoint }) {
  const { t, language } = useTranslation();
  const [permission, setPermission] = useState("default");
  const [enabled, setEnabled] = useState(false);
  // null = loading, { error } = could not read, else the route's answer.
  const [server, setServer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { tone: "ok" | "warn", text }

  const loadServer = useCallback(async () => {
    try {
      const data = await fetchJson(endpoint);
      setServer({ configured: Boolean(data?.configured), publicKey: data?.publicKey || null, live: Number(data?.live) || 0 });
    } catch (err) {
      // Error and "not configured" are different states and must not
      // render the same sentence.
      setServer({ error: err?.message || "load" });
    }
  }, [endpoint]);

  useEffect(() => {
    setPermission(permissionState());
    setEnabled(enabledHere());
    loadServer();
  }, [loadServer]);

  const configured = Boolean(server?.configured);
  const canPush = configured && pushSupported();

  async function turnOn() {
    setBusy(true);
    setNote(null);
    try {
      const state = await requestPermission();
      setPermission(state);
      if (state !== "granted") {
        setNote({ tone: "warn", text: state === "denied" ? t("app.browserNotif.blocked") : t("app.browserNotif.notGranted") });
        return;
      }
      setEnabledHere(true);
      setEnabled(true);
      if (canPush) {
        try {
          await subscribePush({ publicKey: server.publicKey, endpoint });
          await loadServer();
          setNote({ tone: "ok", text: t("app.browserNotif.onWithPush") });
        } catch (err) {
          // The in-tab half is on regardless; say exactly which half failed.
          setNote({ tone: "warn", text: t("app.browserNotif.pushFailed", { reason: err?.message || "" }) });
        }
      } else {
        setNote({ tone: "ok", text: t("app.browserNotif.onTabOnly") });
      }
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNote(null);
    try {
      setEnabledHere(false);
      setEnabled(false);
      if (configured) {
        await unsubscribePush({ endpoint });
        await loadServer();
      }
      setNote({ tone: "ok", text: t("app.browserNotif.off") });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setNote(null);
    try {
      const shown = await showTestNotification(t("app.browserNotif.testTitle"), t("app.browserNotif.testBody"));
      let pushed = null;
      if (canPush && server.live > 0) {
        try {
          pushed = await fetchJson(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ test: true, language }),
          });
        } catch (err) {
          pushed = { error: err?.message || "" };
        }
      }
      if (!shown && !pushed) {
        setNote({ tone: "warn", text: t("app.browserNotif.testFailed") });
      } else if (pushed?.error) {
        setNote({ tone: "warn", text: t("app.browserNotif.pushFailed", { reason: pushed.error }) });
      } else if (pushed) {
        setNote({ tone: "ok", text: t("app.browserNotif.testSentPush", { count: pushed.sent ?? 0 }) });
      } else {
        setNote({ tone: "ok", text: t("app.browserNotif.testSent") });
      }
    } finally {
      setBusy(false);
    }
  }

  const unsupported = !supported();
  const permissionText = unsupported
    ? t("app.browserNotif.permUnsupported")
    : permission === "granted"
      ? t("app.browserNotif.permGranted")
      : permission === "denied"
        ? t("app.browserNotif.permDenied")
        : t("app.browserNotif.permDefault");

  let pushText;
  if (server === null) pushText = t("app.browserNotif.pushLoading");
  else if (server.error) pushText = t("app.browserNotif.pushLoadError");
  else if (!server.configured) pushText = t("app.browserNotif.pushNotSetUp");
  else if (!pushSupported()) pushText = t("app.browserNotif.pushUnsupported");
  else if (server.live > 0) pushText = t("app.browserNotif.pushOn", { count: server.live });
  else pushText = t("app.browserNotif.pushReady");

  const on = enabled && permission === "granted";

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-browser-notifications>
      <div className="flex items-start gap-3">
        <BellRing size={18} className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.browserNotif.title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("app.browserNotif.intro")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{t("app.browserNotif.switchLabel")}</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words" data-browser-notify-permission>
            {permissionText}
          </p>
        </div>
        <Toggle
          checked={on}
          disabled={busy || unsupported || permission === "denied"}
          label={t("app.browserNotif.switchLabel")}
          onChange={(next) => (next ? turnOn() : turnOff())}
        />
      </div>

      <p className="text-sm text-muted-foreground break-words" data-browser-notify-push>
        {pushText}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={busy || !on}
          data-browser-notify-test
          className="inline-flex items-center gap-2 min-h-[44px] bg-inverted text-inverted-foreground text-sm font-semibold px-4 rounded-lg disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {t("app.browserNotif.sendTest")}
        </button>
        {note ? (
          <span
            role="status"
            className={`inline-flex items-start gap-1.5 text-sm break-words ${
              note.tone === "ok" ? "text-green-700 dark:text-green-300" : "text-amber-800 dark:text-amber-200"
            }`}
          >
            {note.tone === "ok" ? (
              <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            {note.text}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">{t("app.browserNotif.iosNote")}</p>
    </div>
  );
}
