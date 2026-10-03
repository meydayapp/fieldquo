"use client";
// app/components/calls/BridgeCallButton.js
//
// "Call" from the business number, on a lead, a client, a job and a
// conversation. FieldQuo rings the member's own phone first; when they press 1
// it dials the client, who sees the company's business number.
//
// Drawn only when the server says this company HAS a live business number
// (GET /api/calls/bridge → `show`). Every other reason it cannot ring right
// now — no phone on the member's profile, outside calling hours, a client
// who asked not to be called — draws it disabled with that sentence beside it,
// so a press never fails for a reason the screen already knew.
import { useEffect, useState } from "react";
import { PhoneOutgoing, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

const REASON_KEYS = {
  no_member_phone: ["app.bridge.reason.noMemberPhone", "Add your own phone to your profile — FieldQuo rings you first."],
  no_client_phone: ["app.bridge.reason.noClientPhone", "No phone number on this record."],
  do_not_call: ["app.bridge.reason.doNotCall", "They asked not to be called."],
  outside_hours: ["app.bridge.reason.outsideHours", "Outside calling hours where they are (9:00–20:00)."],
};

export default function BridgeCallButton({ kind, id, className = "" }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kind || !id) return;
    let live = true;
    fetchJson(`/api/calls/bridge?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`)
      .then((d) => live && setState(d))
      .catch(() => live && setState(null));
    return () => {
      live = false;
    };
  }, [kind, id]);

  if (!state?.show) return null;

  async function call() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetchJson("/api/calls/bridge", { method: "POST", body: { kind, id } });
      setMessage(
        r.simulated
          ? t("app.bridge.simulated", "Demo — no call was placed.")
          : t("app.bridge.ringing", "Ringing your phone now — answer and press 1 to connect."),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const reason = !state.allowed ? REASON_KEYS[state.reasonKey] : null;
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={call}
        disabled={busy || !state.allowed}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <PhoneOutgoing size={14} />}
        {t("app.bridge.call", "Call")}
      </button>
      {reason && <span className="text-xs text-muted-foreground">{t(reason[0], reason[1])}</span>}
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
      {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}
    </span>
  );
}
