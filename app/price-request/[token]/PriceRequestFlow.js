// app/price-request/[token]/PriceRequestFlow.js
//
// The sub's three ways to answer a GC's price request — see ./page.js for
// what this page may show and why.
//
//   signed in, another company, may add requests → "Price it in FieldQuo"
//       (POST accept → their new lead), or "Open it in FieldQuo" if done
//   signed out → "Log in to FieldQuo" / "Create your free account", both
//       returning here (the signup hop leaves the way-back cookie)
//   anyone holding the link → reply with a price, note and optional PDF;
//       or decline with a reason
//
// Language: a signed-out reader has told FieldQuo nothing about themselves;
// the one signal is the GC who wrote to them, so the page speaks the GC's
// language (setPageLanguage — this render only). Signed in, their own.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatMoney } from "@/lib/currency";
import { uploadFile } from "@/lib/media/uploadClient";
import { TRIAL_DAYS } from "@/lib/pricing";
import { priceRequestPath, clearPriceRequestCookie } from "@/lib/subRequests/model";

const INK = "#2d2520";
const MUTED = "text-[#2d2520]/75";

export default function PriceRequestFlow({ token, language, initialView, fill }) {
  const { t, setPageLanguage } = useTranslation();
  const [ctx, setCtx] = useState(null);
  const [failed, setFailed] = useState(false);
  const view = ctx?.view || initialView;
  const gc = view.gc?.name || "";
  const here = priceRequestPath(token);

  const load = async () => {
    try {
      const res = await fetch(`/api/public/price-request/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setFailed(true);
        return;
      }
      if (!data.authenticated) setPageLanguage(language);
      else {
        // Back here signed in: the signup hop's cookie has done its job.
        try {
          document.cookie = clearPriceRequestCookie();
        } catch {
          /* blocked cookies: nothing to clear */
        }
      }
      setCtx(data);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const btn = { background: fill.bg, color: fill.fg };

  return (
    <main className="min-h-dvh bg-[#f6f7f9] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          {view.gc?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.gc.logoUrl} alt={gc} className="h-10 w-auto max-w-[160px] object-contain" />
          ) : null}
          <p className="text-sm font-semibold" style={{ color: INK }}>{gc}</p>
        </div>
        <p className={`mt-6 text-[11px] font-bold tracking-[0.15em] ${MUTED}`}>{t("app.priceRequest.eyebrow").toUpperCase()}</p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: INK }}>{t("app.priceRequest.title", { gc })}</h1>

        <section className="mt-5 rounded-2xl bg-white border border-black/10 p-5 space-y-3">
          <Row label={t("app.priceRequest.trade")} value={view.trade} />
          {view.address && <Row label={t("app.priceRequest.address")} value={view.address} />}
          {view.wantedBy && <Row label={t("app.priceRequest.wantedBy")} value={formatDay(view.wantedBy, language)} />}
          <div>
            <p className={`text-xs font-semibold ${MUTED}`}>{t("app.priceRequest.scope")}</p>
            <p className="mt-1 text-sm whitespace-pre-line leading-relaxed" style={{ color: INK }}>{view.scope}</p>
          </div>
          {view.photos?.length > 0 && (
            <div>
              <p className={`text-xs font-semibold ${MUTED}`}>{t("app.priceRequest.photos")}</p>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {view.photos.map((p) =>
                  p.kind === "video" ? (
                    <video key={p.url} src={p.url} controls className="w-full aspect-square object-cover rounded-lg bg-black/5" />
                  ) : (
                    <a key={p.url} href={p.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-lg bg-black/5" />
                    </a>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        {!ctx && !failed && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" aria-label={t("app.addToQuote.loading")} />
          </div>
        )}
        {failed && <p className="mt-6 text-sm text-red-700">{t("app.priceRequest.loadFailed")}</p>}

        {ctx?.declined && <p className="mt-6 text-sm font-semibold" style={{ color: INK }}>{t("app.priceRequest.declinedState")}</p>}

        {ctx && !ctx.declined && (
          <>
            <FieldQuoCard ctx={ctx} token={token} here={here} gc={gc} btn={btn} t={t} />
            <ReplyCard ctx={ctx} token={token} view={view} gc={gc} btn={btn} t={t} onDone={load} />
            {ctx.canDecline && <DeclineCard token={token} gc={gc} t={t} onDone={load} />}
          </>
        )}

        {(view.gc?.email || view.gc?.phone) && (
          <p className={`mt-8 text-sm ${MUTED}`}>
            {t("app.priceRequest.questions", { gc })}
            {view.gc.phone ? ` · ${view.gc.phone}` : ""}
            {view.gc.email ? (
              <>
                {" · "}
                <a href={`mailto:${view.gc.email}`} className="underline underline-offset-2">
                  {view.gc.email}
                </a>
              </>
            ) : null}
          </p>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <span className={`text-xs font-semibold ${MUTED}`}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: INK }}>{value}</span>
    </div>
  );
}

function formatDay(iso, language) {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

function FieldQuoCard({ ctx, token, here, gc, btn, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accept = ctx.accept;

  async function doAccept() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/price-requests/received/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.leadUrl) throw new Error(data?.error || t("app.priceRequest.fq.acceptFailed"));
      window.location.href = data.leadUrl;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const reasonKey = {
    own: "app.priceRequest.fq.own",
    linked_elsewhere: "app.priceRequest.fq.linkedElsewhere",
    no_access: "app.priceRequest.fq.noAccess",
    read_only: "app.priceRequest.fq.noAccess",
  }[accept?.reason];

  return (
    <section className="mt-6 rounded-2xl border border-black/10 bg-[#eef2f7] p-5 sm:p-6">
      <p className="text-sm font-semibold" style={{ color: INK }}>{t("app.priceRequest.fq.title")}</p>
      <p className={`text-sm mt-1 ${MUTED}`}>{t("app.priceRequest.fq.body", { gc })}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        {ctx.authenticated && accept?.leadUrl && (
          <a href={accept.leadUrl} style={btn} className="inline-flex items-center justify-center px-5 py-3 rounded-full text-sm font-semibold min-h-11">
            {t("app.priceRequest.fq.open")}
          </a>
        )}
        {ctx.authenticated && accept?.ok && !accept.leadUrl && (
          <button
            type="button"
            onClick={doAccept}
            disabled={busy}
            style={btn}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold min-h-11 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("app.priceRequest.fq.accept")}
          </button>
        )}
        {!ctx.authenticated && (
          <>
            <a href={`/login?next=${encodeURIComponent(here)}`} style={btn} className="inline-flex items-center justify-center px-5 py-3 rounded-full text-sm font-semibold min-h-11">
              {t("app.priceRequest.fq.login")}
            </a>
            <a
              href={`${here}/signup`}
              className="inline-flex items-center justify-center bg-white border border-black/20 px-5 py-3 rounded-full text-sm font-semibold min-h-11"
              style={{ color: INK }}
            >
              {t("app.priceRequest.fq.signup")}
            </a>
          </>
        )}
      </div>
      {!ctx.authenticated && <p className={`text-xs mt-2 ${MUTED}`}>{t("app.priceRequest.fq.signupNote", { days: TRIAL_DAYS, gc })}</p>}
      {ctx.authenticated && !accept?.ok && !accept?.leadUrl && reasonKey && <p className={`text-sm mt-3 ${MUTED}`}>{t(reasonKey)}</p>}
      {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
    </section>
  );
}

function ReplyCard({ ctx, token, view, gc, btn, t, onDone }) {
  const reply = view.reply;
  const [amount, setAmount] = useState(reply?.amount != null ? String(reply.amount) : "");
  const [note, setNote] = useState(reply?.note || "");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inputRef = useRef(null);

  if (reply?.confirmed) {
    return (
      <section id="reply" className="mt-4 rounded-2xl border border-black/10 bg-white p-5">
        <p className="text-sm" style={{ color: INK }}>{t("app.priceRequest.reply.confirmed", { gc })}</p>
      </section>
    );
  }
  if (!ctx.canReply) return null;

  async function pick(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setUploading(true);
    setError("");
    try {
      const entry = await uploadFile(picked, { endpoint: `/api/public/price-request/${encodeURIComponent(token)}/upload` });
      setFile({ url: entry.url, filename: entry.filename || picked.name });
    } catch (err) {
      setError(err?.serverMessage || err?.message || t("app.priceRequest.reply.failed"));
    } finally {
      setUploading(false);
    }
  }

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/price-request/${encodeURIComponent(token)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note, file }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.priceRequest.reply.failed"));
      setSent(true);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="reply" className="mt-4 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <p className="text-sm font-semibold" style={{ color: INK }}>{t("app.priceRequest.reply.title")}</p>
      <p className={`text-sm mt-1 ${MUTED}`}>{t("app.priceRequest.reply.body", { gc })}</p>
      {reply?.amount != null && !sent && (
        <p className="text-sm mt-2" style={{ color: INK }}>{t("app.priceRequest.reply.current", { amount: formatMoney(reply.amount, view.gc?.currency) })}</p>
      )}
      {sent && <p className="text-sm mt-2 text-emerald-800">{t("app.priceRequest.reply.sent", { gc })}</p>}
      <form onSubmit={send} className="mt-4 space-y-3">
        <label className="block">
          <span className={`text-xs font-semibold ${MUTED}`}>{t("app.priceRequest.reply.amount")}</span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full sm:w-48 rounded-lg border border-black/20 bg-white px-3 py-2 text-base"
            style={{ color: INK }}
          />
        </label>
        <label className="block">
          <span className={`text-xs font-semibold ${MUTED}`}>{t("app.priceRequest.reply.note")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-base"
            style={{ color: INK }}
          />
        </label>
        <div>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={pick} />
          {file ? (
            <p className="text-sm inline-flex items-center gap-2" style={{ color: INK }}>
              <Paperclip size={14} /> {file.filename}
              <button type="button" onClick={() => setFile(null)} aria-label={t("app.priceRequest.reply.remove")} className="p-1">
                <X size={14} />
              </button>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-2 min-h-11"
              style={{ color: INK }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {uploading ? t("app.priceRequest.reply.uploading") : t("app.priceRequest.reply.file")}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy || uploading}
          style={btn}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold min-h-11 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {reply ? t("app.priceRequest.reply.update") : t("app.priceRequest.reply.send")}
        </button>
      </form>
    </section>
  );
}

function DeclineCard({ token, gc, t, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function decline() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/price-request/${encodeURIComponent(token)}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.priceRequest.decline.failed"));
      setDone(true);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="mt-4 text-sm" style={{ color: INK }}>{t("app.priceRequest.decline.done", { gc })}</p>;
  return (
    <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5">
      <p className="text-sm font-semibold" style={{ color: INK }}>{t("app.priceRequest.decline.title")}</p>
      {open ? (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className={`text-xs font-semibold ${MUTED}`}>{t("app.priceRequest.decline.reason")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-base"
              style={{ color: INK }}
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="button"
            onClick={decline}
            disabled={busy}
            className="inline-flex items-center gap-2 border border-black/30 px-5 py-2.5 rounded-full text-sm font-semibold min-h-11 disabled:opacity-60"
            style={{ color: INK }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("app.priceRequest.decline.button")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-semibold underline underline-offset-2 min-h-11"
          style={{ color: INK }}
        >
          {t("app.priceRequest.decline.button")}
        </button>
      )}
    </section>
  );
}
