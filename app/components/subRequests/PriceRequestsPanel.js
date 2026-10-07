// app/components/subRequests/PriceRequestsPanel.js
//
// "Prices from subs" — the GC's side of a price request (lib/subRequests/),
// on the quote page (open and approved quotes) and the job page. The owner,
// 2026-10-06: the GC sends a request for a price to the subs they already
// have; each sub gets an email; their answer lands in the side-by-side
// compare on this quote.
//
//   · "Request prices from subs" — pick the trade, several subs, the scope,
//     the photos to include, a wanted-by date. What is shared is said on the
//     dialog: the job address, the scope and the ticked photos; never the
//     client's name, phone or email.
//   · Each sub's status — not sent, sent, opened, quoting, quoted, declined.
//   · A price a sub WITHOUT FieldQuo typed into the reply form waits here
//     until the GC presses "Add to compare" (POST …/confirm, no body). A
//     linked sub's sent quote goes to the compare by itself.
//
// Every control is drawn only when the route behind it would accept it
// (canSend / canConfirm come from the server). No figure leaves the browser.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Loader2, X, FileText, Users } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchJson } from "@/lib/fetchJson";
import { RECIPIENT_STATUSES } from "@/lib/subRequests/model";

const STATUS_CLS = {
  not_sent: "text-red-700 dark:text-red-400",
  sent: "text-muted-foreground",
  opened: "text-foreground",
  quoting: "text-amber-700 dark:text-amber-400",
  quoted: "text-emerald-700 dark:text-emerald-400",
  declined: "text-muted-foreground",
};

export default function PriceRequestsPanel({ quoteId = null, jobId = null, onCompareChanged }) {
  const { t } = useTranslation();
  const { formatDate, money } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = jobId ? `jobId=${encodeURIComponent(jobId)}` : `quoteId=${encodeURIComponent(quoteId || "")}`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/price-requests?${query}`);
      if (res.status === 403 || res.status === 404 || res.status === 400) {
        // Not this member's to see, or a job with no quote: nothing to show.
        setHidden(true);
        return;
      }
      const d = await res.json().catch(() => null);
      if (res.ok && d) setData(d);
      else setError(d?.error || t("app.priceRequests.loadFailed"));
    } catch {
      setError(t("app.priceRequests.loadFailed"));
    }
  }, [query, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden || (!data && !error)) return null;
  if (data && !data.canSend && data.requests.length === 0) return null;

  async function confirm(r) {
    if (busy) return;
    setBusy(r.id);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/price-requests/recipients/${r.id}/confirm`, { method: "POST" });
      setNotice(t("app.priceRequests.confirmed", { name: r.name }));
      await load();
      if (typeof onCompareChanged === "function") onCompareChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function resend(r) {
    if (busy) return;
    setBusy(r.id);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/price-requests/recipients/${r.id}/resend`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t("app.priceRequests.title")}</h2>
        </div>
        {data?.canSend && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-2 rounded-lg min-h-9"
          >
            <Send size={13} />
            {t("app.priceRequests.request")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t("app.priceRequests.subtitle")}</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2">{notice}</p>}

      <div className="space-y-4">
        {(data?.requests || []).map((req) => (
          <div key={req.id}>
            <p className="text-xs font-semibold text-foreground">
              {req.trade}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {formatDate(req.createdAt)}
                {req.wantedBy ? ` · ${t("app.priceRequests.wantedBy", { date: formatDate(`${req.wantedBy}T12:00:00Z`) })}` : ""}
              </span>
            </p>
            <ul className="mt-1.5 divide-y divide-border border border-border rounded-lg">
              {req.recipients.map((r) => (
                <li key={r.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-foreground">
                      {r.name}
                      {r.onFieldQuo && <span className="ml-1.5 text-[11px] text-muted-foreground">{t("app.priceRequests.onFieldQuo")}</span>}
                    </span>
                    <span className={`text-xs font-medium ${STATUS_CLS[r.status] || ""}`}>
                      {t(`app.priceRequests.status.${RECIPIENT_STATUSES.includes(r.status) ? r.status : "sent"}`)}
                    </span>
                  </div>
                  {r.status === "declined" && r.declineReason && (
                    <p className="text-xs text-muted-foreground mt-1">{t("app.priceRequests.declineReason", { reason: r.declineReason })}</p>
                  )}
                  {r.reply && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>
                        {r.reply.amountHidden
                          ? t("app.priceRequests.replyHidden")
                          : t("app.priceRequests.replyAmount", { amount: money(r.reply.amount) })}
                        {r.reply.file?.url && (
                          <a href={r.reply.file.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline underline-offset-2 text-foreground">
                            <FileText size={12} />
                            {r.reply.file.filename || t("app.priceRequests.replyFile")}
                          </a>
                        )}
                      </p>
                      {r.reply.note && <p className="whitespace-pre-line">{r.reply.note}</p>}
                    </div>
                  )}
                  {r.inCompare && <p className="text-xs text-muted-foreground mt-1">{t("app.priceRequests.inCompare")}</p>}
                  {r.awaitingConfirmation && data.canConfirm && (
                    <button
                      type="button"
                      onClick={() => confirm(r)}
                      disabled={Boolean(busy)}
                      className="mt-2 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                    >
                      {busy === r.id && <Loader2 size={12} className="animate-spin" />}
                      {t("app.priceRequests.addToCompare")}
                    </button>
                  )}
                  {r.awaitingConfirmation && data.canConfirm && (
                    <p className="text-[11px] text-muted-foreground mt-1">{t("app.priceRequests.addToCompareHint")}</p>
                  )}
                  {r.status === "not_sent" && data.canSend && (
                    <button
                      type="button"
                      onClick={() => resend(r)}
                      disabled={Boolean(busy)}
                      className="mt-2 inline-flex items-center gap-1.5 border border-border text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                    >
                      {busy === r.id && <Loader2 size={12} className="animate-spin" />}
                      {t("app.priceRequests.sendAgain")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {data && data.requests.length === 0 && <p className="text-xs text-muted-foreground">{t("app.priceRequests.none")}</p>}
      </div>

      {open && data && (
        <RequestDialog
          data={data}
          jobId={jobId}
          onClose={() => setOpen(false)}
          onSent={async (result) => {
            setOpen(false);
            setNotice(
              result.failed
                ? t("app.priceRequests.sentSome", { sent: result.sent, failed: result.failed })
                : t("app.priceRequests.sentAll", { n: result.sent }),
            );
            await load();
          }}
        />
      )}
    </div>
  );
}

function RequestDialog({ data, jobId, onClose, onSent }) {
  const { t } = useTranslation();
  const [trade, setTrade] = useState("");
  const [picked, setPicked] = useState([]);
  const [scope, setScope] = useState("");
  const [photoUrls, setPhotoUrls] = useState([]);
  const [wantedBy, setWantedBy] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Subs whose trade matches what was typed come first; the rest stay
  // pickable (a GC's roster trade is free text and rarely spelled the same).
  const subs = useMemo(() => {
    const want = trade.trim().toLowerCase();
    const score = (s) => (want && s.trade && s.trade.toLowerCase().includes(want) ? 0 : 1);
    return [...data.subs].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  }, [data.subs, trade]);
  const trades = useMemo(() => [...new Set(data.subs.map((s) => s.trade).filter(Boolean))], [data.subs]);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function send(e) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const result = await fetchJson("/api/price-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(jobId ? { jobId } : { quoteId: data.quoteId }),
          trade,
          scope,
          subcontractorIds: picked,
          photoUrls,
          wantedBy: wantedBy || null,
        }),
      });
      await onSent(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <form
        onSubmit={send}
        className="bg-card border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{t("app.priceRequests.dialogTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t("app.priceRequests.dialogHint", { quote: data.quoteNumber })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("app.action.cancel")} className="p-1.5 text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.priceRequests.trade")}</span>
          <input
            list="price-request-trades"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            maxLength={80}
            required
            placeholder={t("app.priceRequests.tradePlaceholder")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <datalist id="price-request-trades">
            {trades.map((tr) => (
              <option key={tr} value={tr} />
            ))}
          </datalist>
        </label>

        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground">{t("app.priceRequests.subs")}</legend>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.priceRequests.noSubs")}{" "}
              <a href="/app/subcontractors" className="underline underline-offset-2 text-foreground">
                {t("app.nav.subcontractors")}
              </a>
            </p>
          ) : (
            <ul className="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {subs.map((s) => (
                <li key={s.id}>
                  <label className={`flex items-center gap-2 px-3 py-2 text-sm ${s.hasEmail ? "" : "opacity-60"}`}>
                    <input
                      type="checkbox"
                      disabled={!s.hasEmail}
                      checked={picked.includes(s.id)}
                      onChange={() => toggle(picked, setPicked, s.id)}
                    />
                    <span className="text-foreground">{s.name}</span>
                    {s.trade && <span className="text-xs text-muted-foreground">· {s.trade}</span>}
                    {!s.hasEmail && <span className="ml-auto text-[11px] text-muted-foreground">{t("app.priceRequests.noEmail")}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.priceRequests.scope")}</span>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={5}
            maxLength={4000}
            required
            placeholder={t("app.priceRequests.scopePlaceholder")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        {data.photos.length > 0 && (
          <fieldset>
            <legend className="text-xs font-medium text-muted-foreground">{t("app.priceRequests.photos")}</legend>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {data.photos.map((p) => (
                <label key={p.url} className="relative block">
                  {p.kind === "video" ? (
                    <video src={p.url} className="w-full aspect-square object-cover rounded-md bg-muted" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-md bg-muted" />
                  )}
                  <input
                    type="checkbox"
                    className="absolute top-1.5 left-1.5 h-4 w-4"
                    checked={photoUrls.includes(p.url)}
                    onChange={() => toggle(photoUrls, setPhotoUrls, p.url)}
                    aria-label={t("app.priceRequests.includePhoto")}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.priceRequests.wantedByLabel")}</span>
          <input
            type="date"
            value={wantedBy}
            onChange={(e) => setWantedBy(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <p className="text-xs text-muted-foreground">
          {data.jobAddress
            ? t("app.priceRequests.shared", { address: data.jobAddress })
            : t("app.priceRequests.sharedNoAddress")}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-foreground">
            {t("app.action.cancel")}
          </button>
          <button
            type="submit"
            disabled={sending || picked.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60"
          >
            {sending && <Loader2 size={14} className="animate-spin" />}
            {t("app.priceRequests.send", { n: picked.length })}
          </button>
        </div>
      </form>
    </div>
  );
}
