// app/q/[token]/QuoteApproval.js
//
// The client-facing quote. Two things matter here and nothing else does:
// the client can read what they're being charged for, and they can say yes.
//
// Approval is a two-step confirm rather than a bare button. This is a
// financial commitment on a page a stranger may have opened on a phone in
// bright sun; an accidental tap shouldn't create a contract.
//
// ── Colour comes from documentTheme, not from the raw brand hex ─────────────
//
// It used to paint every heading, every rule, the checkbox tick and the totals
// band with `company.brandColor` straight from the database. Three companies in
// production break that: #ffffff (a real tenant) rendered the masthead word, the
// brand rule at the top and the whole TOTALS BAND invisible — the single
// most-looked-at line of the document had no shape at all — and #c0c0c0 put the
// masthead at 1.8:1. lib/documents/theme.js was written for exactly this and the
// self-quote form next door has always used it. Now this page, that form and the
// PDF derive from the same measured palette, which is also why they finally look
// like the same document.
//
// ── Since 2026-09-21: a mini-site, not one document ─────────────────────────
//
// The quote is still the first section ("Your project") and still the same
// document: scope, prices, extras posting addOnIds only, the signature. But
// the link now opens a branded page with a sticky header (logo · total ·
// Accept) and a table of contents beside the document — About us, Before &
// after, Important documents, Testimonials, Services — each fed from
// company rows through the public route (lib/proposal/load.js) and each
// rendered ONLY when `quote.proposal.sections` lists it: a section with
// nothing behind it is not drawn and not in the contents. Nothing here is
// generated at request time, and nothing here names FieldQuo.
//
// Inside "Your project", above the prices: Scope of work (the trade's scope
// paragraphs and the estimator's text blocks — the same words, not a second
// copy) and How the work runs (the process steps, plus a day-by-day plan
// derived from the takeoff's hours and the crew size when BOTH exist).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Loader2, Building2, Plus, FileText, Play, Star } from "lucide-react";
import { accessiblePair } from "@/lib/brand/colour";
import {
  documentTheme,
  fillPair,
  ruleColor,
  washPair,
} from "@/lib/documents/theme";
import SignaturePad from "@/app/components/SignaturePad";
import HowToPayBlock from "@/app/components/public/HowToPayBlock";
import WaiverSign from "@/app/components/public/WaiverSign";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { documentCustomFacts } from "@/lib/documentSections/customFacts";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { monthlyPayment } from "@/lib/financing/monthlyEstimate";
import { jsonBody } from "@/lib/jsonBody";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";
import { lineShowsAmount, isTextLine } from "@/lib/quotes/textBlocks";
import RichTextBody from "@/app/components/quotes/RichTextBody";

// ── Muted ink is /70, never lighter ──────────────────────────────────────────
//
// #2d2520 composited over white measures 4.12:1 at /60 and 3.08:1 at /50 —
// under the 4.5:1 bar on the captions, the "Prepared for" line and the
// footer. /70 measures 5.65:1 (scripts/check-client-proposal.mjs runs the
// arithmetic), so every muted line on this page uses /70 or darker.
//
// Approve is the one green on this page, and it is NOT brand-derived — the
// homeowner reads it as "yes", not as the contractor's colour, so it stays the
// same on every tenant. It was #16a34a, which measures 3.30:1 against the white
// label sitting on it: under 4.5:1, on the single control this whole page
// exists to get pressed. Green-700 is the same green one step down and
// measures 5.02:1. Decline stays #4b5563 (7.56:1), which already cleared.
const APPROVE_GREEN = "#15803d";

export default function QuoteApproval({ token }) {
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(null); // "accepted" | "declined"
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [decided, setDecided] = useState(null);
  // The request never landed, as opposed to the server refusing it. Separate
  // states because they need separate screens: one has a sentence from the
  // server worth showing, the other has nothing but a browser exception.
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by the retry button
  // The quote expired between loading the page and pressing Approve. The route
  // answers 410 with an English sentence; this page already has the client's
  // own words for it, so it shows those instead.
  const [expiredOnSubmit, setExpiredOnSubmit] = useState(false);
  // Waivers attached to this quote, signed in place. Tokens of the ones
  // still pending: the Accept button stays disabled with the reason printed
  // while any remain, and the server refuses the approval regardless.
  const [waiverSigned, setWaiverSigned] = useState(() => new Set());
  // Which section the reader is in, for the contents — scroll-driven.
  const [activeSection, setActiveSection] = useState("project");
  const approveRef = useRef(null);

  // Ids of the optional extras ticked. Ids only — the amounts live on the
  // server and the total below is for the client's benefit, not the
  // server's. See priceWithAddOns in the API route: what gets charged is
  // recalculated there from these ids, so editing anything in this page
  // changes what you see and nothing else.
  const [picked, setPicked] = useState([]);
  const [settledTotal, setSettledTotal] = useState(null);

  // Signature (the approval). Required before "accepted" can be submitted.
  const [sigName, setSigName] = useState("");
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [sigConsent, setSigConsent] = useState(false);
  // "Pay by e-transfer or cheque — 3% off", ticked or not. A boolean goes to
  // the server; the amount below is an illustration from the quote's own
  // stored percentage, and the server reprices from its rows at approval.
  const [payOffline, setPayOffline] = useState(false);
  const canSign =
    sigName.trim().length > 1 && Boolean(sigDataUrl) && sigConsent;

  // The language is resolved server-side (quote.language → client.language →
  // company default → en), so it matches the PDF and the covering email the
  // client already received. Labels, dates and money all follow from it.
  const language = quote?.language || "en";
  const labels = documentLabels(language);
  const copy = clientDocCopy(language);
  // Currency stays the COMPANY's billing currency (falls back to CAD until
  // loaded / if unset); only the formatting locale shifts with the language.
  // quote is null on the first renders, but money()/date() are only called in
  // the loaded quote view, so the optional chain is safe.
  const fmt = documentFormatters(language, quote?.company?.currency);
  const money = fmt.money;
  // Built against fmt.locale, not hand-concatenated with "%": French writes
  // "9,9 %" and the space and comma are both part of being readable to the
  // person deciding. Falls back to the bare number if Intl refuses the locale.
  const percent = (pct) => {
    try {
      return new Intl.NumberFormat(fmt.locale, {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(Number(pct) / 100);
    } catch {
      return `${pct}%`;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      setOffline(false);

      // ── A dropped request is not an error message ─────────────────────────
      //
      // This used to be one try/catch that ended in `setLoadError(err.message)`,
      // so the most likely failure on this page — a phone, in a driveway, on one
      // bar — printed the browser's own words, "Failed to fetch", in bold, to
      // someone deciding on thirty thousand dollars of work. It also offered no
      // way back: the only remedy was knowing to reload. Both are fixed by
      // telling the two apart.
      let res;
      try {
        res = await fetch(`/api/public/quotes/${token}`);
      } catch {
        if (!cancelled) {
          setOffline(true);
          setLoading(false);
        }
        return;
      }

      const data = await res.json().catch(() => null);
      if (cancelled) return;

      if (!res.ok) {
        // The server's own sentence, or a stated fallback. Never an exception's
        // `message` — routing a refusal and a thrown fetch through one catch is
        // exactly how a browser string ended up as the headline.
        setLoadError(data?.error || clientDocCopy("en").selfQuote.linkInvalid);
        setLoading(false);
        return;
      }

      setQuote(data);
      if (data.status !== "sent") {
        setDecided(data.status);
        // Reopening a decided quote should show what was agreed, extras
        // included — not the figure before they were added.
        setSettledTotal(data.acceptedTotal ?? null);
        setPicked(
          (data.addOns || []).filter((a) => a.selected).map((a) => a.id),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  async function submit(decision) {
    setSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/public/quotes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No total is sent. Deliberate — the server prices it. On acceptance we
        // send the signature (name + drawn mark + consent); the server adds IP,
        // device, timestamp and the document hash and treats it as the approval.
        body: jsonBody({
          decision,
          addOnIds: decision === "accepted" ? picked : [],
          payOffline: decision === "accepted" && payOffline && Boolean(quote?.offlineDiscount),
          ...(decision === "accepted"
            ? {
                signature: {
                  name: sigName.trim(),
                  dataUrl: sigDataUrl,
                  consent: sigConsent,
                },
              }
            : {}),
        }, "approval"),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // A 409 means someone already decided. That's not really an error from
        // the client's point of view, so reflect the settled state instead of
        // showing them a failure.
        if (res.status === 409 && data?.status) {
          setDecided(data.status);
          setConfirming(null);
          return;
        }
        // 410: it lapsed between the page loading and the button being pressed.
        // The route's sentence is English on the wire (deliberately — a cron or
        // an integration calling it gets prose rather than a bare code), and
        // this document may be in any of eight languages. Show the client's own
        // words for "expired" rather than dropping an English line into a French
        // quote, which non-negotiable 6 exists to stop.
        if (res.status === 410) {
          setExpiredOnSubmit(true);
          setConfirming(null);
          return;
        }
        // A waiver attached to this quote is still unsigned: the page's own
        // sentence for it, in the document's language, rather than the
        // route's English.
        if (res.status === 409 && data?.needsWaiver) {
          throw new Error(copy.waiverRequiredBeforeApprove);
        }
        throw new Error(data?.error || copy.genericError);
      }
      setDecided(data.status);
      // The server's figure, not the one computed in this page. If they ever
      // disagreed, the client sees the truth here rather than discovering it
      // when the invoice lands.
      setSettledTotal(data.total ?? null);
      setConfirming(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The figures shown on screen.
   *
   * This mirrors priceWithAddOns on the server and exists purely so the total
   * moves the instant a box is ticked — a client who has to submit to find out
   * what they'd pay won't tick anything. It is NOT what gets charged: the
   * server recalculates from its own stored prices and ignores everything this
   * page might claim. If the two ever drift, the server's number is the real
   * one and `settledTotal` overwrites this on approval.
   */
  const pricing = useMemo(() => {
    if (!quote) return { subtotal: 0, tax: 0, total: 0, extras: 0 };

    const chosen = (quote.addOns || []).filter((a) => picked.includes(a.id));
    const extras = chosen.reduce((s, a) => s + Number(a.amount || 0), 0);
    const taxableExtras = chosen
      .filter((a) => a.taxable)
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    const rate = Number(quote.taxRate || 0);
    const subtotal = Number(quote.subtotal || 0) + extras;
    // The e-transfer / cheque discount, mirrored from the server's own
    // arithmetic (priceWithAddOns): a percentage of subtotal − discount,
    // taken before tax. Shown as a row only once ticked, or once the server
    // recorded it as chosen.
    const offlinePct = Number(quote.offlineDiscount?.pct || 0);
    const offlineOn = offlinePct > 0 && (quote.offlineDiscount?.chosen || payOffline);
    const offlineBase = Math.max(0, subtotal - Number(quote.discount || 0));
    const offline = offlineOn ? Math.round(offlineBase * offlinePct) / 100 : 0;
    const tax = Math.max(0, Number(quote.tax || 0) + taxableExtras * rate - offline * rate);
    const total = subtotal - Number(quote.discount || 0) - offline + tax;

    return {
      extras,
      subtotal,
      tax,
      offline,
      // After a decision, show what the server actually recorded.
      total: settledTotal ?? total,
    };
  }, [quote, picked, settledTotal, payOffline]);

  /**
   * The monthly instalment shown under the total, or null.
   *
   * Recomputed in the page for the same reason the total is: it has to move the
   * instant an extra is ticked, and an instalment frozen at the pre-extras
   * figure would be a wrong number sitting directly under a right one.
   *
   * `monthlyPayment` is the same pure function the check script exercises, and
   * it is reached only through `quote.financing.terms` — which the server sends
   * as null unless the COMPANY typed both a rate and a term. There is no default
   * APR and no default term anywhere behind this, so "no terms" renders no
   * figure rather than a plausible-looking guess.
   */
  const instalment = useMemo(() => {
    const terms = quote?.financing?.terms;
    if (!terms) return null;
    const monthly = monthlyPayment({
      principal: pricing.total,
      aprPct: terms.aprPct,
      termMonths: terms.termMonths,
    });
    return monthly === null ? null : { monthly, ...terms };
  }, [quote, pricing.total]);

  // The contents: "Your project" always, then whatever the server said has
  // content AND is switched on. Computed before the early returns so the
  // hook order is stable.
  const proposal = quote?.proposal || null;
  const sectionKeys = useMemo(
    () => ["project", ...((proposal?.sections || []).filter((k) => SECTION_IDS[k]))],
    [proposal],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !quote) return undefined;
    const ids = sectionKeys.map((k) => SECTION_IDS[k]);
    const onScroll = () => {
      // The section whose top is nearest above the header line wins.
      const line = 120;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - line <= 0) current = id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [quote, sectionKeys]);

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-black/10 rounded w-1/3" />
          <div className="h-64 bg-black/10 rounded-xl" />
        </div>
      </Shell>
    );
  }

  // Two different failures, two different screens and two different remedies.
  // English in both: the company never resolved, so there is no document
  // language to render in and guessing one would be inventing it — the same
  // reasoning, and the same wording, as the self-quote form's load error.
  if (offline) {
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">
            {clientDocCopy("en").connectionLost}
          </p>
          <p className="text-sm text-[#2d2520]/70 mt-2">
            {clientDocCopy("en").connectionLostHint}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-5 px-6 py-3 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]"
          >
            {clientDocCopy("en").tryAgain}
          </button>
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">{loadError}</p>
          <p className="text-sm text-[#2d2520]/70 mt-2">
            {clientDocCopy("en").linkInvalidHint}
          </p>
        </div>
      </Shell>
    );
  }

  const c = quote.company || {};
  // Four values, four jobs, all measured — see the file header for what
  // painting the raw hex four different ways did to real tenants.
  //
  //   theme.accentText  the accent as TEXT on paper (headings, the masthead)
  //   fill              a solid band with something legible on it (the TOTAL)
  //   rule              a hairline that is still visible for a white brand
  //   wash              a panel surface, plus text measured against THAT
  //                     rather than against paper — which is what the hand-
  //                     rolled `ensureContrast(accent, "#f2f2f2")` under the
  //                     financing heading was approximating.
  const theme = documentTheme(c);
  const fill = fillPair(theme);
  const rule = ruleColor(theme);
  const wash = washPair(theme);
  const expired =
    (expiredOnSubmit ||
      (quote.validUntil && new Date(quote.validUntil) < new Date())) &&
    !decided;

  const addOns = quote.addOns || [];
  // Resolved server-side from the largest scope group; [] for a trade that has
  // no jargon worth explaining, and the panel then does not render at all.
  const glossary = quote.glossary || [];
  // Once decided or expired the extras are a record of what was agreed, not
  // a menu. Nothing here is a security boundary — the server refuses a second
  // decision regardless — it's just not being misleading about what's still
  // available.
  const locked = Boolean(decided) || expired;

  // Does the tax line carry a NUMBER, as opposed to "To be confirmed" or
  // "None"? Computed once because two separate things depend on it and they
  // must not be allowed to disagree: the row itself, and the sentence
  // underneath explaining which province the rate came from. See
  // lib/tax/documentTax.js for why zero is not a statement.
  const taxIsAFigure = pricing.tax !== 0 || quote.taxKind === "charged";

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const waivers = proposal?.waivers || [];
  const pendingWaivers = waivers.filter((w) => w.status !== "signed" && !waiverSigned.has(w.token));
  const waiverBlocks = pendingWaivers.length > 0 && !locked;

  // The header's Accept: jump to the signature step in "Your project" and
  // open it — the same name + drawn mark + consent as the buttons at the foot.
  const startAccept = () => {
    if (locked || waiverBlocks) return;
    setConfirming("accepted");
    approveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sectionLabel = (key) =>
    key === "project"
      ? copy.proposal.yourProject
      : key === "about"
        ? copy.proposal.aboutUs
        : key === "beforeAfter"
          ? copy.proposal.beforeAfter
          : key === "documents"
            ? copy.proposal.importantDocuments
            : key === "testimonials"
              ? copy.proposal.testimonials
              : copy.proposal.services;

  const scopeBlocks = scopeOfWork(quote.scopeGroups);
  const plan = proposal?.plan || null;
  const howTheWorkRuns = (quote.processSteps?.length > 0) || (plan?.days?.length > 0) || Boolean(plan?.paint);

  const tocLink = (key, mobile) => {
    const id = SECTION_IDS[key];
    const on = activeSection === id;
    return (
      <button
        key={key}
        type="button"
        onClick={() => jumpTo(id)}
        aria-current={on ? "true" : undefined}
        className={
          mobile
            ? "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap min-h-9"
            : "block w-full text-left rounded-md px-3 py-2 text-sm min-h-10"
        }
        style={
          on
            ? { backgroundColor: fill.bg, color: fill.fg, fontWeight: 700 }
            : { color: theme.inkMuted, backgroundColor: mobile ? wash.bg : "transparent" }
        }
      >
        {sectionLabel(key)}
      </button>
    );
  };

  return (
    <Shell wide>
      {/* ── Sticky header: logo · total · Accept ───────────────────────────
          The total moves as extras are ticked (same `pricing` as the band
          below) and the button is the one green on the page, unchanged. */}
      <div className="sticky top-0 z-30 -mx-4 px-4 bg-white/95 backdrop-blur border-b border-black/10">
        <div className="max-w-5xl mx-auto flex items-center gap-3 py-2.5 min-h-14">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt={c.name} className="h-8 w-auto max-w-[120px] object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: fill.bg, color: fill.fg }}>
              <Building2 size={16} />
            </div>
          )}
          <span className="font-semibold text-[#2d2520] truncate text-sm sm:text-base">{c.name}</span>
          <span className="ml-auto text-right leading-tight shrink-0">
            <span className="hidden sm:inline text-xs text-[#2d2520]/70 mr-2">{copy.proposal.quoteTotal}</span>
            <span className="font-bold tabular-nums text-[#2d2520] text-sm sm:text-base">{money(pricing.total)}</span>
          </span>
          {!decided && !expired && (
            <button
              type="button"
              onClick={startAccept}
              disabled={waiverBlocks}
              title={waiverBlocks ? copy.waiverRequiredBeforeApprove : undefined}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white min-h-10 disabled:cursor-not-allowed"
              style={{ backgroundColor: waiverBlocks ? "#4b5563" : APPROVE_GREEN }}
            >
              <Check size={15} /> {copy.proposal.acceptQuote}
            </button>
          )}
        </div>
        {/* Phone: the contents as a chip bar under the header. */}
        {sectionKeys.length > 1 && (
          <div className="md:hidden max-w-5xl mx-auto flex gap-2 overflow-x-auto pb-2 -mb-px [scrollbar-width:none]">
            {sectionKeys.map((k) => tocLink(k, true))}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto md:grid md:grid-cols-[176px_1fr] md:gap-6 pt-5">
        {/* Desktop: the contents beside the document. */}
        {sectionKeys.length > 1 ? (
          <nav aria-label={copy.proposal.contents} className="hidden md:block">
            <div className="sticky top-20 space-y-0.5">
              {sectionKeys.map((k) => tocLink(k, false))}
              <div className="pt-4 px-3 text-[10px] uppercase tracking-wider" style={{ color: theme.inkMuted }}>
                {labels.quote} {quote.quoteNumber}
              </div>
              <div className="px-3 text-xs text-[#2d2520]">{quote.client?.name}</div>
            </div>
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        <div className="min-w-0 space-y-5">
      <section id={SECTION_IDS.project} className="scroll-mt-24">
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        {/* The brand rule, before anything else. Same device as the PDF —
            it reads as the document being on their letterhead rather than
            having their logo pasted into a generic one. */}
        <div className="flex h-1.5">
          <div className="flex-[2]" style={{ backgroundColor: rule }} />
          <div className="flex-1" style={{ backgroundColor: theme.accentSoft }} />
        </div>

        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5">
          {/* Identity left, document facts right — and when they will not both
              fit, the facts drop onto their own line and stay against the right
              edge. `text-right shrink-0` alone does not do that: once the block
              wraps it is the only thing on its line, so it lands hard LEFT with
              its text right-aligned inside a shrink-to-fit box, which on a
              375px phone reads as a rendering fault directly under the
              company's name. `ml-auto` on the wrapped block and a basis on the
              identity half are the same two utilities the self-quote
              confirmation next door already uses for the identical wrap. */}
          <div className="flex items-start justify-between gap-x-4 gap-y-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 basis-[58%] grow">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logoUrl}
                  alt={c.name}
                  className="h-11 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: fill.bg, color: fill.fg }}
                >
                  <Building2 size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[#2d2520] truncate">
                  {c.name}
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-xs text-[#2d2520]/70 hover:text-[#2d2520]"
                  >
                    {c.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 ml-auto">
              <div
                className="text-lg font-bold tracking-[0.15em] leading-none uppercase"
                style={{ color: theme.accentText }}
              >
                {labels.quote}
              </div>
              <div className="font-mono text-sm text-[#2d2520] mt-1">
                {quote.quoteNumber}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <p className="text-sm text-[#2d2520]/70">{labels.preparedFor}</p>
          <p className="text-lg font-semibold text-[#2d2520]">
            {quote.client?.name}
          </p>
          {/* Where the work is — the same line the PDF's "Prepared for"
              panel prints, when the quote names a site. */}
          {quote.siteAddress && (
            <p className="text-sm mt-1 text-[#2d2520]/60">
              {labels.jobAddress} · <span className="text-[#2d2520]">{quote.siteAddress}</span>
            </p>
          )}

          {quote.validUntil && (
            <p className="text-sm mt-2 text-[#2d2520]/70">
              {labels.validUntil} {fmt.date(quote.validUntil)}
            </p>
          )}
          {/* The company's own boxes flagged for the document, in the same
              words as the PDF attached to the email that brought them here. */}
          {documentCustomFacts(quote.customFields, { date: fmt.date, labels }).map(([label, value]) => (
            <p key={label} className="text-sm mt-1 text-[#2d2520]/70">
              {label} · <span className="text-[#2d2520]">{value}</span>
            </p>
          ))}
        </div>

        <div className="px-6 sm:px-8 pb-6 space-y-6">
          {/* ── Scope of work ─────────────────────────────────────────────
              The trade's scope paragraph for each group and the estimator's
              own text blocks, in their words — moved up from the price
              cards (which no longer repeat them) so the page never carries
              the same sentence twice. Omitted when nothing was written. */}
          {scopeBlocks.length > 0 && (
            <div>
              <SectionKicker theme={theme}>{copy.proposal.scopeOfWork}</SectionKicker>
              <div className="rounded-xl border border-black/10 overflow-hidden" style={{ borderLeft: `3px solid ${rule}` }}>
                {scopeBlocks.map((b, i) => (
                  <div key={i} className={i > 0 ? "border-t border-black/5" : ""}>
                    {b.heading && (
                      <div className="px-4 py-2 text-sm font-semibold text-[#2d2520]" style={{ backgroundColor: wash.bg, color: wash.ink }}>
                        {b.heading}
                      </div>
                    )}
                    {/* A block's body may carry the library's rich text
                        (bold, lists, links — lib/quotes/richText.js); a
                        trade's scope paragraph passes through unchanged. */}
                    <RichTextBody body={b.text} className="px-4 py-3 text-sm leading-relaxed text-[#2d2520]/80" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── How the work runs ─────────────────────────────────────────
              The trade's process steps (as before), then the day-by-day
              plan — derived server-side from the takeoff's hours and the
              crew size, and simply absent when either is missing. The
              paint line is the takeoff's products and coats, nothing
              invented. */}
          {howTheWorkRuns && (
            <div>
              <SectionKicker theme={theme}>{copy.howTheWorkRuns}</SectionKicker>
              {quote.processSteps?.length > 0 && (
                <ol className="space-y-0 mb-3">
                  {quote.processSteps.map((s, i) => {
                    const last = i === quote.processSteps.length - 1;
                    return (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: fill.bg, color: fill.fg }}
                          >
                            {s.num}
                          </span>
                          {!last && <span className="w-px flex-1 my-1" style={{ backgroundColor: theme.accentRule }} />}
                        </div>
                        <div className={last ? "pb-0" : "pb-4"}>
                          <p className="text-sm font-semibold text-[#2d2520]">
                            {s.title}
                            {s.timeline && (
                              <span className="ml-2 text-xs font-normal text-[#2d2520]/70">{s.timeline}</span>
                            )}
                          </p>
                          <p className="text-xs text-[#2d2520]/70 leading-relaxed mt-0.5">{s.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {plan?.days?.length > 0 && (
                <div className="rounded-xl border border-black/10 divide-y divide-black/5">
                  {plan.days.map((d) => (
                    <div key={d.day} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                      <span className="text-[#2d2520]">
                        <b>{copy.proposal.day(d.day)}</b>
                        {d.labels.length > 0 && <span className="text-[#2d2520]/80"> — {d.labels.join(", ")}</span>}
                      </span>
                      <span className="text-xs text-[#2d2520]/70 shrink-0">
                        {d.halfDay ? copy.proposal.halfDay : plan.crewSize ? copy.proposal.crewOf(plan.crewSize) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {plan?.paint && (plan.paint.products?.length > 0 || plan.paint.coats?.length > 0) && (
                <p className="text-xs text-[#2d2520]/70 mt-2">
                  {copy.proposal.paintLine(
                    plan.paint.products?.join(", ") || "",
                    plan.paint.coats?.length ? copy.proposal.coats(plan.paint.coats.length === 1 ? plan.paint.coats[0] : `${plan.paint.coats[0]}–${plan.paint.coats[plan.paint.coats.length - 1]}`) : "",
                  )}
                </p>
              )}
            </div>
          )}

          {quote.scopeGroups?.length > 0 && (
            <SectionKicker theme={theme}>{copy.proposal.priceByArea}</SectionKicker>
          )}
          {/* One card per service, matching the PDF exactly — a client who
              reads this page and then opens the attachment must not find two
              different documents. The per-service accent is the card's left
              border only; the page's own accent stays the company's. */}
          {quote.scopeGroups?.map((g, i) => {
            // `rule`, not the raw brand hex, as the fallback: a trade with no
            // colour of its own on a white-brand quote drew a white left border
            // and a white card head, which is a card with no card in it.
            const groupAccent = g.accent || rule;
            const multi = (quote.scopeGroups || []).length > 1;
            // The "01" badge sits ON the group's colour, and those colours are
            // deliberately desaturated mid-tones (serviceContent.js), which is
            // the one case where no foreground clears 4.5:1 — the clay reaches
            // 4.36 against white and the ochre 4.39 against ink. So the badge
            // fill nudges instead of the text, exactly as fillPair does for the
            // document. The card's left border and wash keep the untouched
            // colour, so the section still reads as that trade.
            const badge = accessiblePair(groupAccent);

            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden border border-black/10"
                style={{ borderLeft: `3px solid ${groupAccent}` }}
              >
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: `${groupAccent}0f` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {multi && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: badge.bg, color: badge.fg }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    <h2 className="font-semibold text-[#2d2520] truncate">
                      {g.label}
                    </h2>
                  </div>
                  {g.subtotal > 0 && (
                    <span className="font-semibold tabular-nums text-[#2d2520] shrink-0">
                      {money(g.subtotal)}
                    </span>
                  )}
                </div>

                <div className="px-4 py-3">
                  {/* The scope paragraph, above the prices — the same place
                      the PDF puts it, so the page and the attachment stay one
                      document. /80 rather than the /70 the bullets use: this
                      is the sentence the whole card depends on, and it clears
                      4.5:1 composited over white where /70 does not. */}
                  {/* The scope paragraph now prints once, under "Scope of
                      work" above — not here as well. */}

                  {/* The measurement behind the price — the satellite still
                      with the traced lawn (or the roof, or the eaves) and
                      "Lawn measured: 1,850 sq ft" — in the same place the
                      PDF prints it. Served by the public route through
                      measureEvidence, never the takeoff itself. */}
                  {(g.measure?.imageUrl || g.measure?.caption || g.outline) && (
                    <div className="mb-3 border-b border-black/5 pb-3">
                      {g.measure?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.measure.imageUrl}
                          alt={g.measure.caption || ""}
                          className="w-full max-w-sm rounded-md border border-black/10 mb-1.5"
                        />
                      )}
                      {/* The outline that was traced, beside its area — the
                          same points the PDF draws, so the page and the
                          attachment show one shape. Prints when the still
                          above could not be captured, too. */}
                      <div className="flex items-center gap-2">
                        {g.outline && (
                          <svg
                            width={g.outline.width}
                            height={g.outline.height}
                            viewBox={`0 0 ${g.outline.width} ${g.outline.height}`}
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <polygon
                              points={g.outline.pointsAttr}
                              fill={rule}
                              fillOpacity={0.18}
                              stroke={rule}
                              strokeWidth={1.2}
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {g.measure?.caption && (
                          <p className="text-xs font-semibold text-[#2d2520]">{g.measure.caption}</p>
                        )}
                      </div>
                      {/* "Measured at 12 Main St" — the job site, which is
                          often not the address on the header. /80 for the
                          same reason the scope sentence above uses it. */}
                      {g.measure.measuredAt && (
                        <p className="text-[11px] text-[#2d2520]/80">{g.measure.measuredAt}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {/* Not g.lineItems directly — a blended subcontractor
                        import's one line repeats the card head above word
                        for word, dollar for dollar. See
                        lib/quotes/scopeGroupDisplay.js. */}
                    {/* An UNPRICED text block prints once, under "Scope of
                        work" above, in the estimator's words; here it would
                        be a title with no amount saying the same thing
                        again. A PRICED block ("Painter for a day — 8 h") is
                        money the client is agreeing to, so it stays a line
                        (lib/quotes/textBlocks.js lineShowsAmount). */}
                    {visibleLineItems(g).filter((li) => !(isTextLine(li) && !lineShowsAmount(li))).map((li, j) => (
                      <div key={j}>
                        <div className="flex justify-between gap-4 text-sm text-[#2d2520]">
                          <span>
                            {li.description}
                            {Number(li.quantity) > 1 && (
                              <span className="text-[#2d2520]/70">
                                {" "}
                                × {li.quantity}
                              </span>
                            )}
                          </span>
                          {/* An unpriced text block — the exclusions, the
                              deposit terms — has no amount, not a $0.00. */}
                          {lineShowsAmount(li) ? (
                            <span className="shrink-0 tabular-nums">
                              {money(li.amount)}
                            </span>
                          ) : null}
                        </div>
                        {/* The scope under the name, same as the PDF — this
                            page and the printed quote are the same document
                            and a client who opens both must not find one of
                            them explaining more than the other.

                            RichTextBody keeps a typed list a list and draws
                            the library's bold, bullets and links the way the
                            PDF does (lib/quotes/richText.js); a plain
                            paragraph passes through it unchanged. */}
                        {li.detail ? (
                          <RichTextBody
                            body={li.detail}
                            className="mt-0.5 pl-2 pr-12 text-xs leading-relaxed text-[#2d2520]/70"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {g.included?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold tracking-wider text-[#2d2520]/70 mb-1.5 uppercase">
                        {copy.whatsIncluded}
                      </p>
                      <ul className="space-y-1">
                        {g.included.map((line, k) => (
                          <li
                            key={k}
                            className="text-xs text-[#2d2520]/70 flex gap-2 leading-relaxed"
                          >
                            <span
                              className="shrink-0"
                              style={{ color: groupAccent }}
                            >
                              •
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Said before the work starts rather than on day three. The
                      unknowns a roof (or a foundation, or a rewire) genuinely
                      has are the questions this client is about to ask anyway;
                      answering them here is what a second opinion reads like. */}
                  {g.mayChange?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold tracking-wider text-[#2d2520]/70 mb-1.5 uppercase">
                        {copy.whatCouldChange}
                      </p>
                      <dl className="space-y-1.5">
                        {g.mayChange.map((entry, k) => (
                          <div key={k}>
                            <dt className="text-xs font-semibold text-[#2d2520]/80">
                              {entry.title}
                            </dt>
                            <dd className="text-xs leading-relaxed text-[#2d2520]/70">
                              {entry.body}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {glossary.length > 0 && (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2d2520]/70">
                {copy.termsExplained}
              </p>
              <dl className="space-y-1.5">
                {glossary.map((entry, k) => (
                  <div key={k} className="sm:flex sm:gap-3">
                    <dt className="text-xs font-semibold text-[#2d2520]/80 sm:w-32 sm:shrink-0">
                      {entry.term}
                    </dt>
                    <dd className="text-xs leading-relaxed text-[#2d2520]/70">
                      {entry.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {addOns.length > 0 && (
            <div className="pt-4 border-t border-black/5">
              <h2
                className="text-sm font-bold uppercase tracking-wide pb-2 mb-1 border-b"
                style={{ color: theme.accentText, borderColor: theme.accentRule }}
              >
                {copy.optionalExtras}
              </h2>
              <p className="text-xs text-[#2d2520]/70 mt-2 mb-3">
                {locked ? copy.extrasChosen : copy.extrasTickHint}
              </p>

              <div className="space-y-2">
                {addOns.map((a) => {
                  const on = picked.includes(a.id);
                  // After a decision the list is a record, not a control.
                  // Unchosen extras disappear rather than sitting there
                  // implying they could still be added.
                  if (locked && !on) return null;

                  return (
                    <label
                      key={a.id}
                      className={`flex gap-3 items-start rounded-xl border px-4 py-3 transition-colors ${
                        locked ? "" : "cursor-pointer"
                      } ${
                        on
                          ? "bg-[#faf8f4] border-black/20"
                          : "bg-white border-black/10 hover:border-black/25"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => toggle(a.id)}
                        // fill.bg, not the brand hex: a white-brand company got
                        // a white tick on a white box, so an extra could be
                        // ticked with no visible sign that it had been.
                        className="mt-0.5 h-4 w-4 shrink-0 accent-current"
                        style={{ accentColor: fill.bg }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between gap-3">
                          <span className="text-sm font-medium text-[#2d2520]">
                            {a.description}
                          </span>
                          <span className="text-sm tabular-nums shrink-0 text-[#2d2520]">
                            {!locked && !on && (
                              <Plus
                                size={11}
                                className="inline -mt-0.5 mr-0.5 opacity-50"
                              />
                            )}
                            {money(a.amount)}
                          </span>
                        </span>
                        {a.detail && (
                          <span className="block text-xs text-[#2d2520]/70 mt-1">
                            {a.detail}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {quote.processNotes && (
            <div
              className="rounded-lg px-4 py-3"
              style={{
                backgroundColor: wash.bg,
                borderLeft: `3px solid ${rule}`,
              }}
            >
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: wash.ink }}
              >
                {quote.processNotes}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row
              label={labels.subtotal}
              value={pricing.subtotal}
              money={money}
            />
            {quote.discount > 0 && (
              <Row
                label={labels.discount}
                value={-quote.discount}
                money={money}
              />
            )}
            {/* ── The e-transfer / cheque offer ──────────────────────────
                Canada only, and only when this quote carried it
                (lib/payments/offlineDiscount.js). Before a decision it is a
                box the homeowner ticks, and the total moves the moment they
                do — the same reason the extras reprice live. After a
                decision it is a plain row, or nothing if they paid by card. */}
            {quote.offlineDiscount && !decided && (
              <label className="flex items-start gap-2.5 py-1 cursor-pointer" data-offline-discount>
                <input
                  type="checkbox"
                  checked={payOffline}
                  onChange={(e) => setPayOffline(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20"
                  style={{ accentColor: theme.accent }}
                />
                <span className="flex-1 flex justify-between gap-3 text-[#2d2520]">
                  <span>
                    {quote.offlineDiscount.label}
                    <span className="block text-xs text-[#2d2520]/60">{copy.payOfflineHint}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    −{money(Math.round(Math.max(0, pricing.subtotal - Number(quote.discount || 0)) * quote.offlineDiscount.pct) / 100)}
                  </span>
                </span>
              </label>
            )}
            {quote.offlineDiscount?.chosen && decided && (
              <Row label={quote.offlineDiscount.label} value={-pricing.offline} money={money} />
            )}
            {/* ── Not always a number ────────────────────────────────────
                A money row reading "$0.00" says tax was worked out and came to
                nothing. Q-2026-0011 said that here on $5,250 of Ontario work
                with tax switched on. `taxKind` comes from the server (see
                lib/tax/documentTax.js) and is overridden the moment a taxable
                extra is ticked, because then a real figure exists. */}
            {taxIsAFigure ? (
              <Row label={labels.tax} value={pricing.tax} money={money} />
            ) : (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{labels.tax}</span>
                <span>
                  {quote.taxKind === "unresolved"
                    ? labels.taxUnresolved
                    : labels.taxNone}
                </span>
              </div>
            )}
            {pricing.extras > 0 && (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{copy.includesOptionalExtras}</span>
                <span className="tabular-nums">{money(pricing.extras)}</span>
              </div>
            )}
            {/* The rate came from the contractor's own province, not this
                homeowner's — because we have no address for them. They are the
                one person who can correct it, and an Ottawa contractor quoting
                a Gatineau kitchen is 2% under.

                Only alongside an actual figure. `assumed` and `unresolved` are
                independent — a rate can be assumed from the company's province
                AND still not have produced a charge — and Q-2026-0001 shipped
                both: a tax row reading "To be confirmed" with "Tax is shown at
                the Ontario rate" printed directly under it. Nothing was shown,
                so the sentence was describing a number that wasn't there. */}
            {quote.taxAssumedRegion && taxIsAFigure && (
              <p className="text-xs text-[#2d2520]/70 leading-snug pt-1">
                {labels.taxAssumedNote.replace(
                  "{region}",
                  quote.taxAssumedRegion,
                )}
              </p>
            )}
            {/* What a US tax line means, or why there is none — the same
                sentence the PDF prints, in the document's language, from the
                record stored when the quote was written. */}
            {quote.taxSentence && (
              <p className="text-xs text-[#2d2520]/70 leading-snug pt-1">
                {quote.taxSentence}
              </p>
            )}
          </div>

          {/* The headline figure in a filled band in their colour. Previously
              subtotal, tax and total sat one line apart at similar weight, so
              the eye had to read three numbers to find the one that matters —
              on the single most-looked-at line of the document. */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3.5 -mt-1"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            <span className="text-sm font-bold tracking-wide uppercase">
              {labels.total}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {money(pricing.total)}
            </span>
          </div>

          {/* ── Financing ──────────────────────────────────────────────────
              Directly under the total, because "can I afford this" is the
              question the total just provoked.

              The monthly figure appears ONLY when the company stated its own
              APR and term; otherwise this is the company's own "ask us"
              sentence and nothing numeric. FieldQuo has no default rate to
              fall back on, deliberately — see lib/financing/monthlyEstimate.js.

              And where a real lender quotes its own terms, that wins: the
              provider link goes to them, and at Stripe Checkout Affirm renders
              its own figure. This panel is the contractor's illustration
              before any of that, and says so. */}
          {quote.financing && (
            <div
              className="rounded-xl border px-4 py-3.5"
              style={{
                borderColor: theme.accentRule,
                backgroundColor: wash.bg,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                // washPair measures against the wash it hands back, so this is
                // the real pairing rather than the darkest-composite estimate
                // the 5%-alpha version had to settle for. It also substitutes a
                // neutral surface outright when the brand is too pale to tint,
                // which is the case the estimate could not cover: a panel you
                // cannot see is not fixed by darkening the text on it.
                style={{ color: wash.accent }}
              >
                {/* "Pay monthly" is a promise the heading can only make when
                    there IS a monthly figure under it. With no stated terms the
                    panel is just "financing exists, ask us", and it says that. */}
                {instalment ? copy.financingHeading : copy.financingAvailable}
              </p>

              {/* Ink measured against the panel's own wash, not against paper.
                  The /80, /70 and /60 alphas here were all computed for white
                  and lose roughly 0.2 on a tinted surface — enough to put the
                  monthly-payment caveat under 4.5:1 for several brands. */}
              {quote.financing.note && (
                <p
                  className="text-sm mt-1.5 leading-relaxed"
                  style={{ color: wash.ink }}
                >
                  {quote.financing.note}
                </p>
              )}

              {instalment && (
                <div className="mt-2.5">
                  <p
                    className="text-xl font-bold tabular-nums leading-tight"
                    style={{ color: wash.ink }}
                  >
                    {copy.financingMonthly(money(instalment.monthly))}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: wash.muted }}>
                    {copy.financingTermsLine(
                      instalment.termMonths,
                      percent(instalment.aprPct),
                    )}
                  </p>
                  <p
                    className="text-xs mt-2 leading-relaxed"
                    style={{ color: wash.muted }}
                  >
                    {copy.financingEstimateNote(c.name)}
                  </p>
                </div>
              )}

              {quote.financing.url && (
                <a
                  href={quote.financing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center min-h-11 mt-3 px-5 py-2 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: fill.bg, color: fill.fg }}
                >
                  {copy.financingCta}
                </a>
              )}
            </div>
          )}

          {quote.paymentTerms && (
            <div className="pt-4 border-t border-black/5">
              <h3
                className="text-xs font-bold tracking-wider mb-2.5 uppercase"
                style={{ color: theme.accentText }}
              >
                {copy.paymentTerms}
              </h3>
              {quote.paymentSchedule?.length > 0 ? (
                // grid-cols-2, not -3: parsePaymentSchedule (lib/documents/
                // paymentSchedule.js) reads the company's own free-text
                // payment terms, so a stage's label can be "At rough-in
                // inspection" rather than "Deposit", and there can be more
                // than three stages. Three fixed columns on a 375px phone
                // gave labels like that ~100px to wrap into; two columns
                // leaves real room and still shows the whole schedule at a
                // glance from sm up.
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {quote.paymentSchedule.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2.5 border"
                      style={{
                        backgroundColor: wash.bg,
                        borderColor: theme.accentRule,
                      }}
                    >
                      <div
                        className="text-xl font-bold leading-none"
                        style={{ color: wash.accent }}
                      >
                        {s.pct}
                      </div>
                      <div
                        className="text-xs font-semibold mt-1"
                        style={{ color: wash.ink }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#2d2520]/70">
                  {quote.paymentTerms}
                </p>
              )}
              {/* Where to send the deposit — the block the quote PDF prints
                  under the same cards, built server-side in the document's
                  language (lib/payments/offlineMethods.js depositHowToPay).
                  Only when a schedule parsed: no schedule, nothing due at
                  approval, nothing to say. */}
              {quote.howToPay && (
                <HowToPayBlock block={quote.howToPay} theme={theme} className="mt-4" />
              )}
            </div>
          )}

          {quote.notes && (
            <div className="pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold text-[#2d2520] mb-1">
                {labels.notes}
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

        </div>

        {/* ── Waivers attached to this quote ─────────────────────────────
            Read in plain sections, every box ticked, then signed — the same
            component /w/[token] renders. Until every attached waiver is
            signed the Accept buttons stay disabled with the reason printed;
            the server refuses the approval regardless. */}
        {waivers.length > 0 && (
          <div className="px-6 sm:px-8 pb-6 space-y-6">
            {waivers.map((w) => (
              <div key={w.token} className="rounded-xl border border-black/10 p-4 sm:p-5">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: theme.accentText }}>
                  {copy.waiverKicker}
                </p>
                <WaiverSign
                  waiver={w}
                  company={c}
                  language={language}
                  embedded
                  onSigned={() => setWaiverSigned((prev) => new Set([...prev, w.token]))}
                />
              </div>
            ))}
          </div>
        )}

        <div ref={approveRef} className="px-6 sm:px-8 py-6 bg-[#faf8f4] border-t border-black/5 scroll-mt-24">
          {decided === "accepted" ? (
            <Settled
              tone="ok"
              title={copy.approvedTitle}
              body={copy.approvedBody(c.name)}
            />
          ) : decided === "declined" ? (
            <Settled
              tone="muted"
              title={copy.declinedTitle}
              body={copy.declinedBody(c.name)}
            />
          ) : expired ? (
            <Settled
              tone="muted"
              title={copy.expiredTitle}
              body={copy.expiredBody(c.name)}
            />
          ) : confirming ? (
            <div className="text-center">
              <p className="font-semibold text-[#2d2520]">
                {confirming === "accepted"
                  ? copy.approveConfirm(money(pricing.total))
                  : copy.declineConfirm}
              </p>
              <p className="text-sm text-[#2d2520]/70 mt-1">
                {confirming === "accepted"
                  ? pricing.extras > 0
                    ? copy.approveSubExtras(money(pricing.extras))
                    : copy.approveSubPlain
                  : copy.declineSub}
              </p>

              {confirming === "accepted" && (
                <div className="mt-5 text-left max-w-sm mx-auto">
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    {copy.yourFullName}
                  </label>
                  <input
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    placeholder={copy.typeYourName}
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm mb-3"
                  />
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    {copy.signature}
                  </label>
                  <SignaturePad onChange={setSigDataUrl} />
                  <label className="flex items-start gap-2 mt-3 text-xs text-[#2d2520]/80">
                    <input
                      type="checkbox"
                      checked={sigConsent}
                      onChange={(e) => setSigConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{copy.signatureConsent(money(pricing.total))}</span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                <button
                  onClick={() => submit(confirming)}
                  disabled={
                    submitting || (confirming === "accepted" && !canSign)
                  }
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-60"
                  style={{
                    backgroundColor:
                      confirming === "accepted" ? APPROVE_GREEN : "#4b5563",
                  }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  {confirming === "accepted"
                    ? copy.yesApprove
                    : copy.yesDecline}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={submitting}
                  className="px-6 py-3 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]"
                >
                  {copy.goBack}
                </button>
              </div>
              {actionError && (
                <p className="text-sm text-red-700 mt-3">{actionError}</p>
              )}
            </div>
          ) : (
            <div className="flex gap-3 justify-center flex-wrap">
              {waiverBlocks && (
                <p className="w-full text-center text-sm" style={{ color: theme.warning }}>
                  {copy.waiverRequiredBeforeApprove}
                </p>
              )}
              <button
                onClick={() => setConfirming("accepted")}
                disabled={waiverBlocks}
                className="inline-flex items-center gap-2 text-white px-7 py-3 rounded-full text-sm font-semibold disabled:cursor-not-allowed"
                style={{ backgroundColor: waiverBlocks ? "#4b5563" : APPROVE_GREEN }}
              >
                <Check size={16} /> {copy.approveThisQuote}
              </button>
              <button
                onClick={() => setConfirming("declined")}
                className="inline-flex items-center gap-2 border border-black/15 text-[#2d2520] px-7 py-3 rounded-full text-sm font-semibold"
              >
                <X size={16} /> {copy.decline}
              </button>
            </div>
          )}
        </div>
      </div>

      </section>

      {/* ── The company beside the document ───────────────────────────────
          Each of these renders only when the server listed it — see the
          file header. Same paper, same measured theme, same language. */}
      {proposal?.about && sectionKeys.includes("about") && (
        <ProposalSection id={SECTION_IDS.about} kicker={copy.proposal.aboutUs} title={proposal.about.headline} theme={theme}>
          <div className={proposal.about.teamPhotoUrl ? "grid gap-4 sm:grid-cols-[1fr_200px] items-start" : ""}>
            <p className="text-sm leading-relaxed text-[#2d2520]/80 whitespace-pre-line">{proposal.about.story}</p>
            {proposal.about.teamPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proposal.about.teamPhotoUrl} alt={copy.proposal.teamPhotoAlt} className="w-full rounded-lg border border-black/10 object-cover aspect-[4/3]" />
            )}
          </div>
          {proposal.about.videoUrl && (
            <a
              href={proposal.about.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm font-semibold min-h-11"
              style={{ color: theme.accentText }}
            >
              <Play size={14} /> {copy.proposal.watchVideo}
            </a>
          )}
        </ProposalSection>
      )}

      {proposal?.gallery?.length > 0 && sectionKeys.includes("beforeAfter") && (
        <ProposalSection id={SECTION_IDS.beforeAfter} kicker={copy.proposal.beforeAfter} title={copy.proposal.recentWork} theme={theme}>
          <div className="grid gap-4 sm:grid-cols-2">
            {proposal.gallery.map((p, i) => (
              <figure key={i}>
                <div className="grid grid-cols-2 gap-1">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.before} alt={`${copy.proposal.before}${p.caption ? ` — ${p.caption}` : ""}`} className="w-full aspect-[4/3] object-cover rounded-l-md border border-black/10" />
                    <span className="absolute left-1.5 top-1.5 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#20242b]/80 text-white">{copy.proposal.before.toUpperCase()}</span>
                  </div>
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.after} alt={`${copy.proposal.after}${p.caption ? ` — ${p.caption}` : ""}`} className="w-full aspect-[4/3] object-cover rounded-r-md border border-black/10" />
                    <span className="absolute left-1.5 top-1.5 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#20242b]/80 text-white">{copy.proposal.after.toUpperCase()}</span>
                  </div>
                </div>
                {p.caption && <figcaption className="text-xs text-[#2d2520]/70 mt-1.5">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal?.documents?.length > 0 && sectionKeys.includes("documents") && (
        <ProposalSection id={SECTION_IDS.documents} kicker={copy.proposal.importantDocuments} title={copy.proposal.documentsHeading} theme={theme}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {proposal.documents.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/10 p-3 hover:border-black/25 flex flex-col"
              >
                <div className="h-14 rounded-md border border-black/10 flex items-center justify-center" style={{ backgroundColor: wash.bg, color: wash.accent }}>
                  <FileText size={22} />
                </div>
                <p className="text-sm font-semibold text-[#2d2520] mt-2 leading-snug">{d.title}</p>
                {d.summary && <p className="text-xs text-[#2d2520]/70 mt-0.5">{d.summary}</p>}
                <span className="text-xs font-bold mt-auto pt-2" style={{ color: theme.accentText }}>
                  {copy.proposal.viewDocument}
                </span>
              </a>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal?.testimonials?.length > 0 && sectionKeys.includes("testimonials") && (
        <ProposalSection id={SECTION_IDS.testimonials} kicker={copy.proposal.testimonials} title={copy.proposal.whatClientsSaid} theme={theme}>
          <div className="grid gap-3 sm:grid-cols-2">
            {proposal.testimonials.map((r, i) => (
              <blockquote key={i} className="rounded-lg border border-black/10 p-3.5 text-sm">
                <Star size={13} className="inline -mt-0.5 mr-1" style={{ color: "#b45309" }} aria-hidden="true" />
                <span className="text-[#2d2520]/85">“{r.quote}”</span>
                {r.author && <footer className="text-xs text-[#2d2520]/70 mt-2">— {r.author}</footer>}
              </blockquote>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal?.services?.length > 0 && sectionKeys.includes("services") && (
        <ProposalSection id={SECTION_IDS.services} kicker={copy.proposal.services} title={copy.proposal.whatElseWeDo} theme={theme}>
          <ul className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {proposal.services.map((sv) => (
              <li key={sv.key} className="rounded-lg border border-black/10 px-3 py-2.5 text-sm font-semibold text-[#2d2520]" style={{ borderLeft: `3px solid ${rule}` }}>
                {sv.label}
              </li>
            ))}
          </ul>
        </ProposalSection>
      )}

      <p className="text-center text-xs text-[#2d2520]/70 mt-2">
        {copy.quoteQuestions(c.name, c.phone)}
      </p>
        </div>
      </div>

      {/* Phone: the total and Accept stay pinned at the foot (the header's
          Accept is sm-and-up only). Same handler, same lock while a waiver
          is pending; gone once the quote is decided or expired. */}
      {!decided && !expired && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-black/10 px-4 py-2.5 flex items-center gap-3">
          <span className="font-bold tabular-nums text-[#2d2520]">{money(pricing.total)}</span>
          <button
            type="button"
            onClick={startAccept}
            disabled={waiverBlocks}
            className="ml-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white min-h-11 disabled:cursor-not-allowed"
            style={{ backgroundColor: waiverBlocks ? "#4b5563" : APPROVE_GREEN }}
          >
            <Check size={15} /> {copy.proposal.acceptQuote}
          </button>
        </div>
      )}
    </Shell>
  );
}

/** The section ids the contents jump to; keys match the server's `sections`. */
const SECTION_IDS = {
  project: "project",
  about: "about",
  beforeAfter: "before-after",
  documents: "documents",
  testimonials: "testimonials",
  services: "services",
};

/**
 * "Scope of work": each group's scope paragraph under its label, then any
 * prose block the estimator added as a text-kind line. Groups with neither
 * contribute nothing, and an empty list hides the whole heading.
 */
function scopeOfWork(groups) {
  const out = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    if (g?.description) out.push({ heading: g.label, text: g.description });
    for (const li of Array.isArray(g?.lineItems) ? g.lineItems : []) {
      if (li?.kind === "text" && li.text) out.push({ heading: li.description || "", text: li.text });
    }
  }
  return out;
}

function SectionKicker({ theme, children }) {
  return (
    <h2
      className="text-xs font-bold tracking-wider mb-3 uppercase"
      style={{ color: theme.accentText }}
    >
      {children}
    </h2>
  );
}

function ProposalSection({ id, kicker, title, theme, children }) {
  return (
    <section id={id} className="scroll-mt-24 bg-white border border-black/10 rounded-2xl shadow-sm px-6 sm:px-8 py-6">
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: theme.accentText }}>
        {kicker}
      </p>
      {title && <h2 className="text-lg font-semibold text-[#2d2520] mt-0.5 mb-3">{title}</h2>}
      {!title && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Shell({ children, wide = false }) {
  return (
    <div className={`min-h-dvh bg-[#f5f2ec] px-4 ${wide ? "pb-24 sm:pb-10" : "py-8 sm:py-14"}`}>
      <div className={wide ? "" : "max-w-2xl mx-auto"}>{children}</div>
    </div>
  );
}

// `money` is component-scoped (it carries the quote's currency AND the reader's
// locale), so this module-level helper takes it as a prop rather than
// referencing a `money` that isn't in scope — which would crash the whole page.
function Row({ label, value, money }) {
  return (
    <div className="flex justify-between text-[#2d2520]/70">
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function Settled({ tone, title, body }) {
  const ok = tone === "ok";
  return (
    <div
      className={`rounded-xl px-5 py-5 text-center border ${
        ok ? "bg-green-50 border-green-200" : "bg-white border-black/10"
      }`}
    >
      <p
        className={`font-semibold ${ok ? "text-green-800" : "text-[#2d2520]"}`}
      >
        {title}
      </p>
      <p
        className={`text-sm mt-1 ${
          ok ? "text-green-700" : "text-[#2d2520]/70"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
