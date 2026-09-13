"use client";

// app/components/me/ShiftRequestDialog.js
//
// "Find cover", "Trade" and "Claim this shift" — one sheet, three modes,
// the same POST /api/shift-requests. Bottom sheet on a phone, centred on
// the web, like ShiftModal. The browser sends ids and a note; who is
// eligible, what the shift is worth and whether a manager still has to say
// yes are all the server's.
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import { formatTimeOfDay, formatWeekdayDayMonth } from "@/lib/format/localeDate";
import { Action } from "./bits";

const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground";

/**
 * @param shift    { id, start, end, job } — the caller's own (cover/trade) or an open one (claim)
 * @param mode     "cover" | "trade" | "claim"
 * @param partners [{ id, name, title }] — from GET /api/shift-requests
 * @param needsApproval  whether a manager still decides after the peer
 */
export default function ShiftRequestDialog({ shift, mode, partners = [], needsApproval = true, onClose, onDone }) {
  const { t, language } = useTranslation();
  const [toWorkerId, setToWorkerId] = useState("");
  const [offeredShiftId, setOfferedShiftId] = useState("");
  const [partnerShifts, setPartnerShifts] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);

  // Trade: once a colleague is picked, their upcoming shifts for "in return".
  useEffect(() => {
    if (mode !== "trade" || !toWorkerId) {
      setPartnerShifts([]);
      return;
    }
    let cancelled = false;
    fetchList(`/api/shift-requests/partner-shifts?workerId=${encodeURIComponent(toWorkerId)}`).then((r) => {
      if (!cancelled && r.ok) setPartnerShifts(r.data?.shifts || []);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, toWorkerId]);

  async function submit() {
    setBusy(true);
    setRefusal(null);
    try {
      const body =
        mode === "claim"
          ? { claim: true, shiftId: shift.id, note: note.trim() || undefined }
          : {
              kind: mode,
              shiftId: shift.id,
              toWorkerId: toWorkerId || undefined,
              offeredShiftId: mode === "trade" && offeredShiftId ? offeredShiftId : undefined,
              note: note.trim() || undefined,
            };
      const res = await fetch("/api/shift-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // A 409 with `refused` is the fit check saying why the swap cannot
        // be applied — worth reading in place, not as a toast that vanishes.
        if (res.status === 409 && data?.refused?.length) {
          setRefusal(data.refused);
          return;
        }
        await reportResponseError(res, t("app.me.requests.sendError"));
        return;
      }
      await onDone?.();
    } finally {
      setBusy(false);
    }
  }

  const when = shift ? `${formatWeekdayDayMonth(shift.start, language)} · ${formatTimeOfDay(shift.start, language)} – ${formatTimeOfDay(shift.end, language)}` : "";
  const place = [shift?.job?.client?.name, shift?.job?.siteAddress].filter(Boolean).join(" · ");
  const title = mode === "claim" ? t("app.me.requests.claimTitle") : mode === "trade" ? t("app.me.requests.tradeTitle") : t("app.me.requests.coverTitle");
  const canSubmit = mode === "trade" ? Boolean(toWorkerId) : true;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-request-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="shift-request-title" className="text-lg font-bold text-foreground">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
          <div className="font-semibold text-foreground">{when}</div>
          {place ? <div className="text-muted-foreground">{place}</div> : null}
        </div>

        {refusal ? (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-semibold">{t("app.me.requests.refusedTitle")}</p>
            {refusal.map((r) => (
              <p key={r}>{r}</p>
            ))}
          </div>
        ) : null}

        {mode !== "claim" ? (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-foreground">
              {mode === "trade" ? t("app.me.requests.tradeWith") : t("app.me.requests.coverWho")}
            </span>
            <select value={toWorkerId} onChange={(e) => setToWorkerId(e.target.value)} className={field}>
              <option value="">{mode === "trade" ? t("app.me.requests.pickColleague") : t("app.me.requests.anyoneEligible")}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.title ? ` — ${p.title}` : ""}
                </option>
              ))}
            </select>
            {mode === "cover" ? <span className="mt-1 block text-xs text-muted-foreground">{t("app.me.requests.coverAudienceNote")}</span> : null}
          </label>
        ) : null}

        {mode === "trade" && toWorkerId ? (
          <label className="mt-3 block">
            <span className="text-sm font-medium text-foreground">{t("app.me.requests.inReturn")}</span>
            <select value={offeredShiftId} onChange={(e) => setOfferedShiftId(e.target.value)} className={field}>
              <option value="">{t("app.me.requests.nothingInReturn")}</option>
              {partnerShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatWeekdayDayMonth(s.start, language)} {formatTimeOfDay(s.start, language)}–{formatTimeOfDay(s.end, language)}
                  {s.job?.client?.name ? ` · ${s.job.client.name}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="mt-3 block">
          <span className="text-sm font-medium text-foreground">{t("app.me.requests.noteOptional")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder={t("app.me.requests.notePlaceholder")} className={field} />
        </label>

        <p className="mt-3 text-xs text-muted-foreground">
          {mode === "claim"
            ? needsApproval
              ? t("app.me.requests.claimNeedsApproval")
              : t("app.me.requests.claimNoApproval")
            : needsApproval
              ? t("app.me.requests.flowNeedsApproval")
              : t("app.me.requests.flowNoApproval")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Action variant="secondary" onClick={onClose}>
            {t("app.action.cancel")}
          </Action>
          <Action onClick={submit} disabled={busy || !canSubmit}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {mode === "claim" ? t("app.me.requests.claimAction") : t("app.me.requests.sendAction")}
          </Action>
        </div>
      </div>
    </div>
  );
}
