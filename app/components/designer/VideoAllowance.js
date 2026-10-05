"use client";

// app/components/designer/VideoAllowance.js
//
// The month's video allowance, said the same way everywhere it is shown: the
// Marketing Designer, the video screen, and Account & Billing. Every number
// comes from the server's answer (GET /api/marketing/video-pack or a video
// post route's `allowance`), which reads lib/marketing/videoAllowance.js —
// nothing here restates a price or a count.
//
// "Add a video pack" is a real Stripe Checkout (POST /api/marketing/video-pack)
// and is only offered to an owner or admin (`canAddPack`, the server's
// isBillingAdmin). Everyone else is told who can add one, rather than shown a
// button that would refuse them.
import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { formatClipLength, formatPackPrice } from "@/lib/marketing/videoAllowance";

/** "3 of 5 videos used this month" (+ "· 1 uploading"). */
export function VideoAllowanceLine({ allowance, className = "" }) {
  const { t } = useTranslation();
  if (!allowance) return null;
  return (
    <p className={`text-xs text-muted-foreground flex items-center gap-1.5 ${className}`} data-video-allowance>
      <Film size={12} className="shrink-0" />
      <span>
        {t("app.videoAllowance.used", { used: allowance.used, total: allowance.total })}
        {allowance.reserved > 0 ? ` · ${t("app.videoAllowance.uploading", { count: allowance.reserved })}` : ""}
      </span>
    </p>
  );
}

/** Starts a pack checkout and sends the browser to Stripe. */
export function useAddVideoPack(returnPath) {
  const [busy, setBusy] = useState(false);
  const add = useCallback(async () => {
    setBusy(true);
    try {
      const data = await fetchJson("/api/marketing/video-pack", { method: "POST", body: { returnPath } });
      if (data?.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }, [returnPath]);
  return { add, busy };
}

/** The refusal when the month is used up — the reason, and what to do. */
export function AllowanceUsed({ allowance, returnPath }) {
  const { t } = useTranslation();
  const { add, busy } = useAddVideoPack(returnPath);
  if (!allowance) return null;
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-sm" data-video-allowance-used>
      <p className="text-foreground">{t("app.videoAllowance.usedUp", { total: allowance.total })}</p>
      {allowance.canAddPack ? (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t(allowance.packs > 0 ? "app.videoAllowance.addAnotherPack" : "app.videoAllowance.addPack", {
            videos: allowance.packVideos,
            price: formatPackPrice(allowance.packPriceCents),
            currency: allowance.packCurrency,
          })}
        </button>
      ) : (
        <p className="text-muted-foreground">{t("app.videoAllowance.askAdmin")}</p>
      )}
    </div>
  );
}

/**
 * Account & Billing's add-on card: this month's count, the packs held, add
 * one, stop one renewing. Settles a Checkout return (?videopack=<session>).
 */
export function VideoPackCard({ returnPath = "/app/settings/account-billing" }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const { add, busy } = useAddVideoPack(returnPath);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const session = params.get("videopack");
      const url = session ? `/api/marketing/video-pack?session_id=${encodeURIComponent(session)}` : "/api/marketing/video-pack";
      setData(await fetchJson(url));
      setError("");
      if (session) {
        params.delete("videopack");
        const qs = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id) {
    setCancelling(id);
    try {
      setData(await fetchJson(`/api/marketing/video-pack?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
    } catch (err) {
      showError(err.message);
    } finally {
      setCancelling(null);
    }
  }

  const a = data?.allowance;
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-3" data-video-pack-card>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Film size={16} /> {t("app.videoAllowance.cardTitle")}
      </h2>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
      {a && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("app.videoAllowance.explain", {
              included: a.included,
              videos: a.packVideos,
              price: formatPackPrice(a.packPriceCents),
              currency: a.packCurrency,
              length: formatClipLength(a.maxSeconds),
            })}
          </p>
          {/* The one limit that waits on FieldQuo's video plan (Cloudinary):
              how big ONE upload may be. Said with today's figure, from the
              same reading the upload is signed against. */}
          {data.uploadMaxLabel && (
            <p className="text-xs text-muted-foreground" data-video-upload-limit>
              {t("app.videoAllowance.uploadLimit", { size: data.uploadMaxLabel })}
            </p>
          )}
          <VideoAllowanceLine allowance={a} className="text-sm" />
          {data.packs.length > 0 && (
            <ul className="text-sm space-y-1">
              {data.packs.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg px-3 py-2">
                  <span className="text-foreground">
                    {t("app.videoAllowance.packLine", { videos: a.packVideos, price: formatPackPrice(a.packPriceCents), currency: a.packCurrency })}
                    <span className="block text-xs text-muted-foreground">
                      {p.cancelAtPeriodEnd
                        ? t("app.videoAllowance.packEnds", { date: p.paidThrough ? new Date(p.paidThrough).toLocaleDateString() : "—" })
                        : p.counts
                          ? t("app.videoAllowance.packRenews", { date: p.currentPeriodEnd ? new Date(p.currentPeriodEnd).toLocaleDateString() : "—" })
                          : t("app.videoAllowance.packNotPaid")}
                    </span>
                  </span>
                  {a.canAddPack && !p.cancelAtPeriodEnd && p.status !== "canceled" && (
                    <button
                      type="button"
                      onClick={() => cancel(p.id)}
                      disabled={cancelling === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {t("app.videoAllowance.cancelPack")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!data.availability?.ok && <p className="text-sm text-amber-700 dark:text-amber-400">{data.availability?.reason}</p>}
          {a.canAddPack && data.availability?.ok ? (
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60"
              data-video-pack-add
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t(a.packs > 0 ? "app.videoAllowance.addAnotherPack" : "app.videoAllowance.addPack", {
                videos: a.packVideos,
                price: formatPackPrice(a.packPriceCents),
                currency: a.packCurrency,
              })}
            </button>
          ) : !a.canAddPack ? (
            <p className="text-xs text-muted-foreground">{t("app.videoAllowance.askAdmin")}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
