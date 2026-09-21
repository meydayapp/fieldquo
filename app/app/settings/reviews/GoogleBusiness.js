"use client";

// app/app/settings/reviews/GoogleBusiness.js
//
// "Connect Google Business Profile": the company's reviews, read from
// Google, cached for thirty days, shown here — and, per review, switched
// onto the company's own site.
//
// ── Three honest states, none of them a dead button ─────────────────────────
//
//   not configured   the OAuth client is not on this deployment (the same
//                    GOOGLE_OAUTH_CLIENT_ID/SECRET the calendar uses). One
//                    sentence naming the variables; no button.
//   connected, refused   Google answered — and on a project whose Business
//                    Profile API quota is still 0 (every new project) it
//                    answers 429 on the first call. The sentence the server
//                    built from that answer is printed verbatim, with
//                    Google's own words, and the paste box below is offered
//                    as the way that works today.
//   connected, reading   the listing picked, the last refresh time, the
//                    reviews as Google sent them.
//
// ── The words are never edited here ─────────────────────────────────────────
//
// No pencil on a Google row. The one control is "show on my site", the
// company's decision about publication; the words, the stars, the name and
// the date are Google's, refreshed nightly and gone at thirty days if
// Google stops returning them. lib/reviews/googleBusiness/sync.js.

import { useCallback, useEffect, useState } from "react";
import { Store, RefreshCw, Unplug, Loader2, Star, Check } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

function Stars({ n }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} fill={i < n ? "currentColor" : "none"} className={i < n ? "" : "text-muted-foreground/40"} />
      ))}
    </span>
  );
}

export default function GoogleBusiness({ googleBusiness, outcomeKey, onChanged }) {
  const { t } = useTranslation();
  const connection = googleBusiness?.connection || null;
  const configured = Boolean(googleBusiness?.configured);

  const [reviews, setReviews] = useState(null);
  const [locations, setLocations] = useState(null);
  const [locationsError, setLocationsError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  const loadReviews = useCallback(async () => {
    if (!connection) return;
    const res = await fetch("/api/settings/google-reviews");
    if (!res.ok) {
      await reportResponseError(res, t("app.setReviews.gbpLoadError"));
      return;
    }
    const json = await res.json();
    setReviews(json.reviews || []);
  }, [connection, t]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  async function loadLocations() {
    setBusy(true);
    setLocationsError(null);
    try {
      const res = await fetch("/api/reviews/google/locations");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Google's refusal, as the server worded it — printed, not toasted:
        // this is the sentence the owner needs to read twice.
        setLocationsError(json.error || t("app.setReviews.gbpLoadError"));
        setLocations([]);
        return;
      }
      setLocations(json.locations || []);
    } finally {
      setBusy(false);
    }
  }

  async function pickLocation(loc) {
    setBusy(true);
    try {
      const res = await fetch("/api/reviews/google/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName: loc.accountName, locationName: loc.locationName, locationTitle: loc.title }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setReviews.gbpSaveError"));
        return;
      }
      const json = await res.json().catch(() => ({}));
      setRefreshResult(json.refresh || null);
      setLocations(null);
      await onChanged?.();
      await loadReviews();
    } finally {
      setBusy(false);
    }
  }

  async function refreshNow() {
    setBusy(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/reviews/google/refresh", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setRefreshResult(json);
      await onChanged?.();
      await loadReviews();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm(t("app.setReviews.gbpDisconnectConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reviews/google/disconnect", { method: "POST" });
      if (!res.ok) {
        await reportResponseError(res, t("app.setReviews.gbpSaveError"));
        return;
      }
      setReviews(null);
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function toggleShow(row) {
    const res = await fetch(`/api/settings/google-reviews/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnSite: !row.showOnSite }),
    });
    if (!res.ok) await reportResponseError(res, t("app.setReviews.gbpSaveError"));
    await loadReviews();
  }

  const outcomeText = outcomeKey ? t(outcomeKey) : null;
  const lastError = connection?.lastError || null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4" data-gbp-section>
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Store size={16} /> {t("app.setReviews.gbpTitle")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t("app.setReviews.gbpSubtitle")}</p>
      </div>

      {outcomeText && (
        <p className="text-xs text-foreground rounded-lg bg-muted/40 px-3 py-2" data-gbp-outcome>
          {outcomeText}
        </p>
      )}

      {!configured ? (
        <p className="text-xs text-muted-foreground" data-gbp-unavailable>
          {t("app.setReviews.gbpNotSetUp")}{" "}
          <span className="font-mono">{(googleBusiness?.missing || []).join(", ")}</span>{" "}
          {t("app.setReviews.gbpPasteInstead")}
        </p>
      ) : !connection ? (
        <div className="space-y-2">
          <a
            href="/api/reviews/google/connect"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold"
          >
            {t("app.setReviews.gbpConnect")}
          </a>
          <p className="text-xs text-muted-foreground">{t("app.setReviews.gbpConnectHelp")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-foreground">
            {t("app.setReviews.gbpConnectedAs", { email: connection.email || "—" })}
            {connection.locationTitle && (
              <>
                {" · "}
                <strong>{connection.locationTitle}</strong>
              </>
            )}
            {connection.lastSyncAt && (
              <span className="text-muted-foreground">
                {" · "}
                {t("app.setReviews.gbpLastSync", { when: new Date(connection.lastSyncAt).toLocaleString() })}
              </span>
            )}
          </p>

          {lastError && (
            <p
              className="text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-2 whitespace-pre-line"
              data-gbp-last-error
            >
              {lastError}
              {"\n"}
              {t("app.setReviews.gbpPasteInstead")}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={loadLocations}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              {connection.locationName ? t("app.setReviews.gbpChangeListing") : t("app.setReviews.gbpPickListing")}
            </button>
            {connection.locationName && (
              <button
                type="button"
                disabled={busy}
                onClick={refreshNow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
              >
                <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {t("app.setReviews.gbpRefresh")}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-red-600 hover:bg-muted disabled:opacity-40"
            >
              <Unplug size={13} /> {t("app.setReviews.disconnect")}
            </button>
            {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>

          {locationsError && (
            <p className="text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-2" data-gbp-locations-error>
              {locationsError} {t("app.setReviews.gbpPasteInstead")}
            </p>
          )}

          {locations && !locationsError && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{t("app.setReviews.gbpWhichListing")}</p>
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.setReviews.gbpNoListings")}</p>
              ) : (
                <ul className="divide-y divide-border border border-border rounded-lg">
                  {locations.map((loc) => (
                    <li key={`${loc.accountName}/${loc.locationName}`} className="p-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground min-w-0">
                        <strong>{loc.title}</strong>
                        {loc.address && <span className="text-muted-foreground"> · {loc.address}</span>}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => pickLocation(loc)}
                        className="px-3 py-1 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-40 shrink-0"
                      >
                        {t("app.setReviews.select")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {refreshResult && (
            <p className="text-xs text-foreground flex items-center gap-1.5" data-gbp-refresh-result>
              {refreshResult.ok ? (
                <>
                  <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                  {t("app.setReviews.gbpRefreshed", { fetched: refreshResult.fetched, removed: refreshResult.removed })}
                </>
              ) : (
                <span className="whitespace-pre-line">{refreshResult.message}</span>
              )}
            </p>
          )}

          {reviews && reviews.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {t("app.setReviews.gbpReviewsTitle", { count: reviews.length })}
              </p>
              <p className="text-xs text-muted-foreground">{t("app.setReviews.gbpReviewsHelp")}</p>
              <ul className="divide-y divide-border border border-border rounded-lg" data-gbp-reviews>
                {reviews.map((row) => (
                  <li key={row.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Stars n={row.starRating} />
                        <span>{row.reviewerName}</span>
                        <span>· {new Date(row.reviewCreateTime).toLocaleDateString()}</span>
                        <span>· Google</span>
                      </p>
                      {row.comment ? (
                        <p className="text-sm text-foreground mt-1">{row.comment}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic mt-1">{t("app.setReviews.gbpNoWords")}</p>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground shrink-0">
                      <span>{t("app.setReviews.gbpShowOnSite")}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.showOnSite}
                        disabled={busy || !row.comment}
                        onClick={() => toggleShow(row)}
                        className={`w-9 h-5 rounded-full transition-colors disabled:opacity-40 ${
                          row.showOnSite ? "bg-emerald-600" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            row.showOnSite ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reviews && reviews.length === 0 && connection.locationName && !lastError && (
            <p className="text-xs text-muted-foreground">{t("app.setReviews.gbpNoReviewsYet")}</p>
          )}
        </div>
      )}
    </section>
  );
}
