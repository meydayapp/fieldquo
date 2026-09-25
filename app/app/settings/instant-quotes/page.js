// app/app/settings/instant-quotes/page.js
//
// The company's instant-estimate rate card. Each wired trade is a card: a
// toggle, editable material sell rates, the surcharge knobs the estimate
// applies, a minimum charge and a range band. Saving a trade is what makes its
// public "instant quote" appear — until then it's off, so there's never a
// live button pricing off numbers nobody chose.
//
// Reads AND writes the same config the estimator prices off
// (lib/estimate/instantEstimate.js), so what the owner sees here is exactly
// what a homeowner is quoted.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmbedCode from "@/app/components/settings/EmbedCode";
import BackToHome from "@/app/components/BackToHome";
import { AlertTriangle, Info, Loader2, Zap } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
// The per-trade card and its field helpers live in ./TradeCard.js, because
// the home page's set-up dialog renders the same cards.
import TradeCard from "./TradeCard";
import AdTrackingCard from "./AdTrackingCard";

export default function InstantQuotesSettingsPage() {
  const { t } = useTranslation();
  const [trades, setTrades] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [financing, setFinancing] = useState(null);
  const [reportWebsite, setReportWebsite] = useState(null);
  const [live, setLive] = useState({ count: 0, slug: null });
  const [mismatches, setMismatches] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await fetchJson("/api/settings/instant-quote");
      setTrades(data.trades);
      setMismatches(data.mismatches || null);
      setCanEdit(Boolean(data.canEdit));
      setFinancing(data.financing || { enabled: false });
      setReportWebsite(data.reportWebsite || null);
      setLive({
        count: data.liveTradeCount || 0,
        slug: data.companySlug || null,
      });
    } catch (err) {
      setError(
        err.message ||
          t(
            "app.setInstantQuotes.couldNotLoad",
            "Could not load instant-quote settings",
          ),
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Their trades, and only their trades ──────────────────────────────────
  //
  // This screen used to list all fourteen wired estimators — the company's own
  // first, the rest behind a "+ Show 11 other trades FieldQuo can price"
  // disclosure. The owner, looking at TrueFinish's three services: "if
  // TrueFinish only has 3 selected quote types, why do I have the option to
  // show the other 11? it doesn't make sense, I should enable them first."
  //
  // He is right, and a cabinet painter had already proved it by working down
  // the list and saving a roofing rate card — being SHOWN a card is what made
  // filling it in look like the job. The route no longer sends a trade the
  // company doesn't sell and the PUT refuses to enable one, so the disclosure
  // is gone rather than merely collapsed; the line under the cards says where
  // the real first step is.
  //
  // A trade they have already switched on is still sent and still listed even
  // when it isn't one of their services — it is their row, a homeowner can be
  // quoted from it right now, and the amber finding above is only actionable
  // if the card with the off switch is on the screen.

  // ── Two findings that used to be one panel, and shouldn't have been ──────
  //
  // They were both rendered under "your instant quotes and your services don't
  // match", which framed each of them as a list to reconcile by hand. Only one
  // of them is that. Since the settings route provisions a trade the moment it
  // can price it from the company's OWN rates
  // (lib/estimate/instantQuoteProvision.js), the second direction now has
  // exactly one cause left, and it is not a mismatch at all:
  //
  //   quoted, not sold  → a genuine disagreement. A homeowner can be quoted
  //                       for work nobody here does. Amber, unchanged.
  //   sold, not quoted  → it WOULD be on, automatically, except the company
  //                       has never stated a price for it and FieldQuo will
  //                       not invent one. That is a missing number with a known
  //                       home, so it says which card and links to it.
  const quotedNotSold = mismatches?.instantWithoutService || [];
  const needsYourPrice = mismatches?.serviceWithoutInstant || [];

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.setInstantQuotes.title", "Instant Quotes")}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        {t(
          "app.setInstantQuotes.intro",
          "Let homeowners get a real starting estimate from your website in seconds — roof measured from their address, or an area they trace on a map. Every estimate is a range they can request, and lands in your review queue before anything is binding.",
        )}
      </p>
      <div className="mb-6">
        <BackToHome />
      </div>

      {/* What a homeowner would see right now. The owner switched trades on,
          opened their own link and read "Instant estimates aren't available
          here yet" — with no way to tell from this screen whether anything was
          live. The count is of trades that are BOTH on and priceable, because
          "on but can't price" is invisible to a homeowner. */}
      {trades && (
        <p className="text-sm text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-block h-2 w-2 rounded-full ${live.count > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden="true"
          />
          {live.count > 0
            ? t(
                "app.setInstantQuotes.liveSome",
                "{count} live on your instant-estimate link.",
                { count: live.count },
              )
            : t(
                "app.setInstantQuotes.liveNone",
                "Nothing is live on your instant-estimate link yet — switch a service on below.",
              )}
          {live.slug && (
            <a
              href={`/instant-quote/${live.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-foreground"
            >
              {t(
                "app.setInstantQuotes.viewPublicPage",
                "See what homeowners see",
              )}
            </a>
          )}
        </p>
      )}

      {/* Only once something is actually live.
          The embed for an estimator with no services switched on renders a
          page that asks nothing and prices nothing — handing out code for that
          is worse than handing out none, because it goes onto a real website
          and sits there empty. The line above already tells them to switch
          something on. */}
      {live.slug && live.count > 0 && (
        <EmbedCode
          className="mb-4"
          slug={live.slug}
          widget="instant-quote"
          title={t("app.setLeadForm.instantTitle")}
          heading={t(
            "app.setInstantQuotes.embedHeading",
            "Put the instant estimate on your website",
          )}
          note={t(
            "app.setInstantQuotes.embedNote",
            "Paste this where you want it to appear. It is an ordinary HTML element, so it works on Wix, Squarespace, WordPress and hand-written HTML alike. The small script only resizes the box as the homeowner answers; if your site strips scripts it still works at a fixed height.",
          )}
        />
      )}

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!trades && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" />{" "}
          {t("app.state.loading")}
        </div>
      )}

      {/* ── What doesn't line up, said plainly, changed by nobody ──────────
          The owner found this himself by opening two screens: "the instant
          quote has roofing, which is not displayed in the services, so who
          does roofing?". Nothing here switches anything — each finding names
          the disagreement and points at the screen that settles it. */}
      {quotedNotSold.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t(
                  "app.setInstantQuotes.mismatchTitle",
                  "Your instant quotes and your services don't match",
                )}
              </h2>
              <ul className="mt-2 space-y-1.5">
                {quotedNotSold.map((f) => (
                  <li
                    key={`quoted:${f.trade}`}
                    className="text-xs text-amber-900 dark:text-amber-200"
                  >
                    {t(
                      "app.setInstantQuotes.mismatchInstantOnly",
                      "You give homeowners an instant quote for {trade}, which isn't one of your services.",
                      { trade: f.tradeLabel },
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {t(
                  "app.setInstantQuotes.mismatchHelp",
                  "Nothing has been changed. Switch a card off below, or add the service on the Services screen — whichever is right.",
                )}{" "}
                <Link
                  href="/app/settings/services"
                  className="underline font-medium"
                >
                  {t(
                    "app.setInstantQuotes.mismatchServicesLink",
                    "Open Services",
                  )}
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Sold, and one number short of being live ─────────────────────────
          Not amber, because nothing is wrong: this is the last step of a
          set-up that did the rest of itself. Each row links at the card whose
          rate box is empty, so the fix is one click and one number rather
          than a trip to Services and back. */}
      {needsYourPrice.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                {t(
                  "app.setInstantQuotes.needsPriceTitle",
                  "These are ready to go live as soon as you price them",
                )}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "app.setInstantQuotes.needsPriceHelp",
                  "Everything you sell that FieldQuo can price from your own rates is already switched on below. These are the ones where we don't have a rate of yours to use — and we won't quote a homeowner a number you didn't set.",
                )}
              </p>
              <ul className="mt-2 space-y-1.5">
                {needsYourPrice.map((f) => (
                  <li key={`needs:${f.trade}`} className="text-xs text-foreground">
                    {t(
                      "app.setInstantQuotes.needsPriceRow",
                      "You sell {service}. Set your price and it goes live.",
                      { service: f.categoryLabels.join(" / ") },
                    )}{" "}
                    <a
                      href={`#trade-${f.trade}`}
                      className="underline font-medium"
                    >
                      {t("app.setInstantQuotes.needsPriceLink", "Price {trade}", {
                        trade: f.tradeLabel,
                      })}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* id: the dashboard's "Enable instant quotes" set-up step lands here
          (lib/setupSteps.js). */}
      <div id="trades" className="space-y-4 scroll-mt-4">
        {(trades || []).map((trade) => (
          <TradeCard
            key={trade.trade}
            trade={trade}
            canEdit={canEdit}
            onSaved={load}
          />
        ))}
      </div>

      {/* One line where eleven cards used to be. Not a disclosure that reopens
          them — a contractor who genuinely adds a trade adds the SERVICE, and
          this says so and links there. */}
      {trades && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t(
            "app.setInstantQuotes.enableServiceFirst",
            "Only the services you sell can be offered as an instant quote.",
          )}{" "}
          <Link
            href="/app/settings/services"
            className="underline font-medium text-foreground"
          >
            {t(
              "app.setInstantQuotes.enableServiceLink",
              "Enable a trade in Settings › Services to offer it here",
            )}
          </Link>
        </p>
      )}

      {financing && (
        <FinancingCard financing={financing} canEdit={canEdit} onSaved={load} />
      )}

      {reportWebsite && (
        <ReportWebsiteCard reportWebsite={reportWebsite} canEdit={canEdit} onSaved={load} />
      )}

      {/* The company's ad pixels, "ask first", and the tracking link. Its own
          loader and route: it is read by the funnels too, and a slow trade
          list must not hold it up. */}
      <AdTrackingCard />
    </div>
  );
}

/**
 * Where the estimate REPORT's "Website" tile and "Back to the website" button
 * send a homeowner.
 *
 * The automatic rule (lib/estimate/report/website.js) prefers the company's
 * own website, falls back to the FieldQuo-hosted site only when it is
 * published and carries something of theirs, and otherwise shows no link at
 * all. This card shows what that rule picks TODAY and lets an owner override
 * it. A choice that cannot be honoured — "my website" with none on record,
 * "FieldQuo site" with nothing published — is offered disabled with the
 * reason beside it, rather than saved and silently resolved to no link.
 */
function ReportWebsiteCard({ reportWebsite, canEdit, onSaved }) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(reportWebsite.setting || "auto");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const auto = reportWebsite.automatic || { kind: "none", url: null };
  const autoText =
    auto.kind === "own"
      ? t("app.setInstantQuotes.reportSiteAutoOwn", "Right now: your own website ({url})", { url: auto.url })
      : auto.kind === "fieldquo"
        ? t("app.setInstantQuotes.reportSiteAutoHosted", "Right now: your FieldQuo website ({url})", { url: auto.url })
        : t("app.setInstantQuotes.reportSiteAutoNone", "Right now: no website link — add your website under Company, or publish and personalise your FieldQuo site.");

  const options = [
    {
      key: "auto",
      label: t("app.setInstantQuotes.reportSiteAuto", "Automatic"),
      hint: autoText,
      disabled: false,
    },
    {
      key: "own",
      label: t("app.setInstantQuotes.reportSiteOwn", "My own website"),
      hint: reportWebsite.ownUrl
        ? reportWebsite.ownUrl
        : t("app.setInstantQuotes.reportSiteOwnMissing", "No website on record — add it under Settings › Company."),
      disabled: !reportWebsite.ownUrl,
    },
    {
      key: "fieldquo",
      label: t("app.setInstantQuotes.reportSiteHosted", "My FieldQuo website"),
      hint: !reportWebsite.hostedUrl
        ? t("app.setInstantQuotes.reportSiteHostedUnpublished", "Not published yet — publish it from Settings › Website.")
        : reportWebsite.hostedTailored
          ? reportWebsite.hostedUrl
          : t("app.setInstantQuotes.reportSiteHostedStock", "{url} — still showing stock photos; homeowners will see them.", { url: reportWebsite.hostedUrl }),
      disabled: !reportWebsite.hostedUrl,
    },
    {
      key: "none",
      label: t("app.setInstantQuotes.reportSiteNone", "No website link"),
      hint: t("app.setInstantQuotes.reportSiteNoneHint", "The report shows Call and Email only."),
      disabled: false,
    },
  ];

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetchJson("/api/settings/instant-quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instantReportWebsite: choice === "auto" ? null : choice }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      showError(err.message || t("app.setInstantQuotes.couldNotSave", "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">
        {t("app.setInstantQuotes.reportSiteTitle", "Website link on the estimate report")}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-md">
        {t(
          "app.setInstantQuotes.reportSiteIntro",
          "After a homeowner sees their price they get a branded report with Call, Email and Website tiles. This decides where the Website tile and the \"Back to the website\" button go.",
        )}
      </p>
      <div className="mt-3 space-y-2">
        {options.map((o) => (
          <label
            key={o.key}
            className={`flex items-start gap-3 rounded-lg border border-border px-3 py-2 ${o.disabled ? "opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name="reportWebsite"
              value={o.key}
              checked={choice === o.key}
              disabled={!canEdit || o.disabled}
              onChange={() => setChoice(o.key)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground break-words">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}{" "}
            {t("app.action.save")}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">{t("app.action.saved")}</span>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Company-wide financing offer shown on estimates and on the quote a client
 * approves.
 *
 * FieldQuo invents no monthly payment — it doesn't provide financing. The
 * homeowner sees the company's own "ask us" wording, a link to a real provider
 * that quotes the terms itself, or a monthly ESTIMATE computed from the rate
 * and term the company types into the two fields below. Nothing is defaulted:
 * leave either field blank and no monthly figure is shown anywhere, which is
 * why the save below refuses a half-filled pair rather than quietly keeping one
 * value. See lib/estimate/financing.js and lib/financing/monthlyEstimate.js.
 */
function FinancingCard({ financing, canEdit, onSaved }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(Boolean(financing.enabled));
  const [note, setNote] = useState(financing.note || "");
  const [url, setUrl] = useState(financing.url || "");
  // Strings, not numbers: "" is the honest representation of "not stated", and
  // a numeric state would turn a cleared field into 0% APR — a rate the company
  // never typed, on a document a homeowner acts on.
  const [aprPct, setAprPct] = useState(
    financing.aprPct === null || financing.aprPct === undefined
      ? ""
      : String(financing.aprPct),
  );
  const [termMonths, setTermMonths] = useState(
    financing.termMonths === null || financing.termMonths === undefined
      ? ""
      : String(financing.termMonths),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // One stated without the other can't produce a payment, so the server stores
  // neither. Saying so here beats saving a value that silently vanishes.
  const halfStated =
    Boolean(aprPct.trim()) !== Boolean(termMonths.trim());

  async function save() {
    if (halfStated) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetchJson("/api/settings/instant-quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financing: {
            enabled,
            note,
            url,
            // Blank means "not stated" all the way down — normaliseTerms turns
            // "" into null rather than into 0.
            aprPct: aprPct.trim() === "" ? null : aprPct.trim(),
            termMonths: termMonths.trim() === "" ? null : termMonths.trim(),
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      // Was a native alert() — the one un-brandable modal in an app whose
      // whole premise is that nothing looks like it came from us. Every other
      // failure path on this page already uses showError, imported above.
      showError(
        err.message ||
          t(
            "app.setInstantQuotes.couldNotSaveFinancing",
            "Couldn't save financing.",
          ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t("app.setInstantQuotes.financing", "Financing")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {t(
              "app.setInstantQuotes.financingIntro",
              "Optional. FieldQuo doesn't provide financing and never shows a monthly figure — this just lets homeowners know it's available, in your words or via your provider.",
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit}
          onClick={() => setEnabled((v) => !v)}
          className={`shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? "bg-emerald-600" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-foreground">
              {t(
                "app.setInstantQuotes.whatToTell",
                "What to tell the homeowner",
              )}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder={t(
                "app.setInstantQuotes.financingNotePlaceholder",
                "e.g. We offer financing on approved credit — ask us for details.",
              )}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none"
            />
            <span className="text-xs text-muted-foreground">
              {t(
                "app.setInstantQuotes.financingNoteHelp",
                "Your own wording — don't promise a rate or monthly amount you can't honour.",
              )}
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-foreground">
              {t(
                "app.setInstantQuotes.providerLink",
                "Provider link (optional)",
              )}
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t(
                "app.setInstantQuotes.providerLinkPlaceholder",
                "https://… (Shop Pay, Affirm, your bank)",
              )}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
            />
            <span className="text-xs text-muted-foreground">
              {t(
                "app.setInstantQuotes.providerLinkHelp",
                'If set, homeowners get a button to your provider, who quotes the terms. Leave blank for "ask us".',
              )}
            </span>
          </label>

          {/* The only place a monthly figure can come from. Empty = silent. */}
          <div className="pt-3 border-t border-border">
            <span className="text-sm text-foreground">
              {t("app.setInstantQuotes.statedTerms", "Your stated terms (optional)")}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  {t("app.setInstantQuotes.aprLabel", "Annual rate (APR %)")}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={aprPct}
                  onChange={(e) => setAprPct(e.target.value)}
                  placeholder="9.9"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  {t("app.setInstantQuotes.termLabel", "Term (months)")}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="600"
                  step="1"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="12"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </label>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(
                "app.setInstantQuotes.statedTermsHelp",
                "Fill in both and the quote shows an estimated monthly payment, labelled as an estimate on your stated terms. Leave either one blank and no monthly figure is ever shown — FieldQuo has no default rate and no default term.",
              )}
            </span>
            {halfStated && (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                {t(
                  "app.setInstantQuotes.termsIncomplete",
                  "Enter both a rate and a term, or leave both blank.",
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || halfStated}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}{" "}
            {t("app.action.save")}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              {t("app.action.saved")}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
