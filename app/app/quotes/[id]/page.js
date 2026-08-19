// app/app/quotes/[id]/page.js
//
// The back-office view of a quote.
//
// ── Why this looks like the document and not like a form ────────────────────
//
// The PDF and the client-facing approval page at /q/[token] are the two things
// a homeowner ever sees, and both are laid out as a document: brand rule,
// masthead, "prepared for", scope groups as sections, one filled band carrying
// the total. This screen showed the same data as an unstyled list of rows, so
// the person selling the job was looking at something that bore no resemblance
// to what their client was reading — which makes "check the quote before you
// send it" a much weaker check than it should be.
//
// So the structure below deliberately mirrors lib/documentSections/* and
// QuoteApproval.js. What it does NOT mirror is their colour handling: those
// render for a stranger with no session and compute literal hex values from
// Company.brandColor, while the <article> here is wrapped in data-brand +
// BrandTheme, which puts the same brand colour into the semantic tokens.
// `bg-inverted` inside the document IS the company's colour, with a foreground
// picked by the same measured contrast, and it stays legible in dark mode —
// which a hardcoded hex would not.
//
// The wrapper is around the DOCUMENT only, not the page. /app itself is
// FieldQuo's palette (see app/app/layout.js): the brand colour is what the
// client sees, and the command strip above — Send, Convert, Delete — is not
// something the client ever sees. The seam is the point. What's inside the
// frame is the quote; what's outside it is the office.
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Send,
  RefreshCw,
  Pencil,
  Ruler,
  Link2,
  Mail,
  Loader2,
  CheckCircle2,
  Building2,
} from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import BrandTheme from "@/app/components/BrandTheme";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { documentLabels } from "@/lib/i18n/documentLabels";
import ImportedByPanel from "./ImportedByPanel";
import ImportedCostsPanel from "./ImportedCostsPanel";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

// Formatted exactly as it was before this page was restyled, and exactly as the
// invoice detail page still does it. Prettier grouping is tempting, but quotes
// and invoices sitting side by side with different money formatting reads as a
// bug — that's a change to make in both places or neither.
const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

export default function QuoteDetailPage() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  // The document's own furniture — "Quote", "Prepared for" — from the same
  // catalogue the PDF and the approval page use, in the STAFF's language here.
  // Minting app-catalogue keys for words that are already translated six ways
  // would be a second copy to keep in step, and English literals would put an
  // English word in the middle of an otherwise French screen.
  const labels = documentLabels(language);
  const router = useRouter();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  // Letterhead: logo, name, phone. GET /api/quotes/[id] doesn't return the
  // company, and widening a shared API response for one screen's decoration is
  // the wrong trade — this is the same endpoint the layout already reads for
  // date preferences, so it's warm, and the masthead degrades to the brand mark
  // alone if it fails.
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(""); // "" | "quote" | "follow_up"
  const [justSent, setJustSent] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setCompany(d);
      })
      // Swallowed on purpose: a missing letterhead costs a logo, and showing an
      // error banner about it above a perfectly good quote would be noise.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Guard res.ok: on a 404/401 the route returns { error }, and setting that
    // as the quote made `if (!quote)` pass, rendering the detail body with a
    // $NaN total instead of the not-found screen. Leave quote null on failure so
    // the existing not-found branch shows.
    fetch(`/api/quotes/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Carried over from the builder when "Save & Send" saved the quote but the
  // email failed. Without this the user lands on a draft with no explanation
  // of why it isn't sent — which is how you get someone pressing Send four
  // more times.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sendError = params.get("sendError");
    if (!sendError) return;
    setError(sendError);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /**
   * Actually emails the client.
   *
   * This button used to call updateStatus("sent"), which changed a word on
   * screen and then hid itself because the status was no longer draft. Every
   * signal said the quote had gone out; nothing had been sent. It now calls a
   * route that emails, and only reports success once Resend has accepted the
   * message.
   */
  async function sendQuote(kind) {
    setSending(kind);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.quoteDetail.sendError"));

      // Merge rather than refetch: the response carries exactly the fields
      // that changed, and a refetch would blank the page for a moment on the
      // one action the user most wants confirmation of.
      setQuote((q) => ({ ...q, ...data }));
      setJustSent(data.to);
      setTimeout(() => setJustSent(""), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending("");
    }
  }

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setQuote(await res.json());
    } else {
      // Marking a quote sent or accepted is a status change the whole
      // pipeline depends on. Failing at it silently means the board is wrong
      // and nobody knows why.
      setError(
        (await res.json().catch(() => null))?.error ||
          t("app.quoteDetail.statusError"),
      );
    }
    setActionLoading(false);
  }

  async function handleConvert() {
    setError("");
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error || t("app.quoteDetail.convertError"));
      return;
    }
    router.push(`/app/invoices/${data.id}`);
  }

  async function handleDelete() {
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/app/quotes"); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!quote)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        {t("app.quoteDetail.notFound")}
      </div>
    );

  // ── Is this a kitchen? ──────────────────────────────────────────────────
  //
  // True when the quote already carries a design, or when any of its scope
  // groups is cabinetry work — which is how a quote that hasn't been designed
  // yet can still open the designer and become one.
  //
  // Deliberately not "always show it": on a fence quote the button would open an
  // empty room and a pricing panel for cabinetry nobody is buying. And not "only
  // when a design exists" either — that would make the designer impossible to
  // reach the first time.
  //
  // Placed after the !quote guard because it reads `quote`.
  const isKitchen =
    quote.quoteType === "kitchen" ||
    quote.scopeDetails?.serviceType === "kitchen" ||
    (quote.scopeGroups || []).some((g) =>
      /cabinet|kitchen|countertop|remodel/.test(g.category?.key || ""),
    );

  const clientAddress = [
    quote.client?.address,
    quote.client?.city,
    quote.client?.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 pb-10">
      {/* The command strip. Deliberately above the document rather than inside
          it: these are things the staff member does TO the quote, and a Delete
          button sitting on the letterhead reads as part of what the client
          receives. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Link
          href="/app/quotes"
          className="flex items-center gap-1 text-sm text-muted-foreground py-2"
        >
          <ArrowLeft size={14} /> {t("app.quoteDetail.backToQuotes")}
        </Link>

        <div className="flex flex-wrap gap-2">
          {/* Shown while the quote is still live, not only while it's a draft.
              Re-sending a quote a client says they never received is one of
              the most common things anyone needs to do, and the old button
              vanished the moment the status changed. */}
          {["draft", "sent"].includes(quote.status) && (
            <button
              onClick={() => sendQuote("quote")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "quote" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {quote.sentAt ? t("app.quoteDetail.sendAgain") : t("app.action.send")}
            </button>
          )}
          {quote.status === "sent" && quote.sentAt && (
            <button
              onClick={() => sendQuote("follow_up")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "follow_up" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              {t("app.quoteDetail.followUp")}
            </button>
          )}
          {["sent", "draft"].includes(quote.status) && (
            <Link
              href={`/app/quote-approval/${id}`}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Link2 size={14} /> {t("app.quoteDetail.getApproved")}
            </Link>
          )}
          {quote.status === "accepted" && !quote.invoices?.length && (
            <button
              onClick={handleConvert}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw size={14} /> {t("app.quoteDetail.convertToInvoice")}
            </button>
          )}
          {/* Only offered when this quote actually IS a kitchen. Showing it on
              a fence quote would be a button that opens an empty room and a
              pricing panel for cabinetry nobody is buying. */}
          {isKitchen && (
            <Link
              href={`/app/quotes/${id}/kitchen`}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Ruler size={14} /> {t("app.quoteDetail.kitchenDesigner")}
            </Link>
          )}
          <Link
            href={`/app/quotes/${id}/edit`}
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold"
          >
            <Pencil size={14} /> {t("app.action.edit")}
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="border border-border text-muted-foreground p-2 rounded-full"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* The email trail. Every banner here is written only after Resend
          accepted the message, so "Emailed 3 July" is a fact rather than an
          intention — which is what the old sentAt recorded, since the Send
          button never sent anything. */}
      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 size={16} className="shrink-0" />
          {t("app.quoteDetail.sentTo")} <span className="font-medium">{justSent}</span>.
        </div>
      )}

      {(quote.sentAt || quote.followUpSentAt) && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-1.5">
          {quote.sentAt && (
            <TrailRow
              label={t("app.quoteDetail.emailed")}
              at={quote.sentAt}
              detail={quote.sentToEmail}
            />
          )}
          {quote.followUpSentAt && (
            <TrailRow
              label={
                quote.followUpCount > 1
                  ? t("app.quoteDetail.followedUpN", { count: quote.followUpCount })
                  : t("app.quoteDetail.followedUp")
              }
              at={quote.followUpSentAt}
            />
          )}
          {/* clientDesignAt is reused by the public approval endpoint to
              record when the client decided — see the comment there. */}
          {["accepted", "declined"].includes(quote.status) &&
            quote.clientDesignAt && (
              <TrailRow
                label={quote.status === "accepted" ? t("app.status.approved") : t("app.status.declined")}
                at={quote.clientDesignAt}
                tone={quote.status === "accepted" ? "positive" : "muted"}
              />
            )}
        </div>
      )}

      {quote.invoices?.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {t("app.quoteDetail.alreadyConverted")}{" "}
          <Link
            href={`/app/invoices/${quote.invoices[0].id}`}
            className="underline font-medium"
          >
            {quote.invoices[0].invoiceNumber}
          </Link>
        </div>
      )}

      {/* Sub-side of a cross-company import: shows if another company pulled
          this quote into their project, with an honest pending/confirmed state.
          Self-hides when it hasn't been imported. */}
      <ImportedByPanel quoteId={id} />

      {/* Importer side: subcontractor costs pulled INTO this quote, removable
          while it's still open. Self-hides when there are none. */}
      <ImportedCostsPanel
        quoteId={id}
        currency={quote.company?.currency}
        editable={["draft", "sent"].includes(quote.status)}
        onTotalChange={(total) => setQuote((q) => ({ ...q, total }))}
      />

      {/* ── The document ──────────────────────────────────────────────────
          Everything below is a mirror of what the client sees: the PDF built
          from lib/documentSections/* and the approval page at /q/[token]. Same
          order, same blocks, same shape.

          data-brand on the <article> scopes BrandTheme's variables to the
          document, so the brand rule, the letterhead mark and the total band
          are the company's colour while the rest of the screen stays
          FieldQuo's. The company is the same object the masthead already
          needed, so this costs no extra request.

          One honest caveat: company arrives by fetch, so the band can paint
          FieldQuo navy for the frame before it lands. Gating the whole document
          on a decoration would be worse — the masthead already degrades to the
          brand mark alone when that request fails, and a document you can read
          beats a document you're waiting for. */}
      <article
        data-brand
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        {/* The attribute above and this <style> are deliberately on the same
            element rather than a wrapper: a wrapper is one refactor away from
            being flattened, and the attribute would survive it while the theme
            quietly stopped applying. A custom property set on an element
            resolves for that element's own declarations too, so the article's
            bg-card is themed as well as its children. */}
        <BrandTheme
          brandColor={company?.brandColor}
          brandColors={company?.brandColors}
        />
        {/* The brand rule, before anything else. Two weights of the company's
            own colour, as in HeaderSection's PDF band — it reads as the quote
            being ON their letterhead rather than in a generic frame. */}
        <div className="flex h-1.5" aria-hidden="true">
          <div className="flex-[2] bg-inverted" />
          <div className="flex-1 bg-inverted opacity-50" />
        </div>

        <header className="px-5 sm:px-7 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {company?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name || ""}
                  className="h-10 w-auto max-w-[160px] object-contain"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-inverted text-inverted-foreground flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
              )}
              {/* Only what came back. A placeholder company name here would be
                  inventing the one thing on the page that has to be theirs. */}
              {company?.name && (
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {company.name}
                  </div>
                  {company.phone && (
                    <div className="text-xs text-muted-foreground truncate">
                      {company.phone}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
                {labels.quote}
              </div>
              <h1 className="text-xl font-bold text-foreground tabular-nums">
                {quote.quoteNumber}
              </h1>
              <span
                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[quote.status]}`}
              >
                {quote.status}
              </span>
            </div>
          </div>
        </header>

        <div className="px-5 sm:px-7 py-5 border-b border-border grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              {labels.preparedFor}
            </p>
            <p className="text-base font-semibold text-foreground mt-0.5 break-words">
              {quote.client?.name}
            </p>
            {quote.client?.contactName && (
              <p className="text-sm text-muted-foreground">
                {quote.client.contactName}
              </p>
            )}
            {quote.client?.email && (
              <p className="text-sm text-muted-foreground break-all">
                {quote.client.email}
              </p>
            )}
            {quote.client?.phone && (
              <p className="text-sm text-muted-foreground">{quote.client.phone}</p>
            )}
            {clientAddress && (
              <p className="text-sm text-muted-foreground">{clientAddress}</p>
            )}
          </div>

          {/* Dates in the company's chosen format, not a hardcoded locale —
              this is staff reading their own data, which is the internal side
              of the split described at the top of lib/format/companyDate.js. */}
          <dl className="text-sm space-y-1 sm:text-right">
            <Fact label={labels.date} value={formatDate(quote.createdAt)} />
            {quote.validUntil && (
              // Borrowed from the quote EDITOR's catalogue rather than adding a
              // seventh translation of "Valid until" — same field, same words,
              // one string to keep right.
              <Fact
                label={t("app.quoteEdit.validUntil")}
                value={formatDate(quote.validUntil)}
              />
            )}
          </dl>
        </div>

        {quote.scopeGroups?.length > 0 && (
          <section className="px-5 sm:px-7 py-5 space-y-3">
            {/* One card per service, as on the approval page. A flat list of
                lines gives a three-trade quote no seams at all, which is how a
                client ends up asking "so what's the painting costing me?" */}
            {quote.scopeGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted">
                  <h2 className="font-semibold text-foreground text-sm truncate">
                    {group.label || group.category?.label}
                  </h2>
                  {Number(group.subtotal) > 0 && (
                    <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                      {money(group.subtotal)}
                    </span>
                  )}
                </div>
                <div className="px-4 py-1">
                  {(group.lineItems || []).map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-4 text-sm text-foreground py-1.5 border-b border-border last:border-0"
                    >
                      <span className="min-w-0">
                        {item.description}
                        {item.quantity > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            × {item.quantity}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums shrink-0">
                        {money(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {quote.addOns?.length > 0 && (
          <Block title={t("app.quoteDetail.optionalExtras")}>
            <div className="space-y-1.5">
              {quote.addOns.map((a) => (
                <div key={a.id} className="flex justify-between text-sm gap-3">
                  <span
                    className={
                      a.selected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {a.description}
                    {a.selected && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                        {t("app.quoteDetail.addedByClient")}
                      </span>
                    )}
                  </span>
                  <span
                    className={`tabular-nums shrink-0 ${
                      a.selected ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {money(a.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {quote.processNotes && (
          <Block title={t("app.quoteEdit.whatHappensNext")}>
            {/* The wash-and-rule callout the approval page gives this text.
                It's the block that answers "what am I agreeing to", so it
                shouldn't read like a footnote here either. */}
            <div className="rounded-lg bg-muted border-l-[3px] border-inverted px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {quote.processNotes}
              </p>
            </div>
          </Block>
        )}

        {quote.notes && (
          <Block title={t("app.field.notes")}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {quote.notes}
            </p>
          </Block>
        )}

        {Array.isArray(quote.clientPhotos) && quote.clientPhotos.length > 0 && (
          <Block title={t("app.quoteDetail.clientMedia")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quote.clientPhotos.map((m, i) => (
                <ClientMediaTile key={(typeof m === "string" ? m : m?.url) + i} media={m} />
              ))}
            </div>
          </Block>
        )}

        <div className="px-5 sm:px-7 py-5 border-t border-border">
          {/* Right-aligned and narrow above sm, exactly as TotalsSection lays
              the PDF out: a totals block spanning the full width reads as
              another table, kept to a column it reads as a summary. */}
          <div className="sm:w-3/5 sm:ml-auto space-y-1 text-sm">
            <Row label={t("app.quoteDetail.subtotal")} value={money(quote.subtotal)} />
            {/* Only when there is one — a "Discount $0.00" line invites the
                question of why nothing was discounted. */}
            {Number(quote.discount) > 0 && (
              <Row
                label={t("app.quoteEdit.discount")}
                value={`-${money(quote.discount)}`}
              />
            )}
            <Row label={t("app.quoteDetail.tax")} value={money(quote.tax)} />

            {/* The headline figure in a filled band in their colour, matching
                the PDF and the approval page. Everything above it is quiet, so
                the eye lands on the one number that matters instead of reading
                three of similar weight to find it. */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-inverted text-inverted-foreground px-4 py-3 mt-2">
              <span className="text-xs font-bold uppercase tracking-wide">
                {t("app.quoteDetail.quotedTotal")}
              </span>
              <span className="text-xl font-bold tabular-nums">
                {money(quote.total)}
              </span>
            </div>

            {/* Shown only when it differs, so it reads as news rather than as
                a second total to reconcile. This is the figure the invoice is
                built from. */}
            {quote.acceptedTotal !== null &&
              quote.acceptedTotal !== undefined &&
              Number(quote.acceptedTotal) !== Number(quote.total) && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 px-4 py-2.5 mt-1.5 text-green-800 dark:text-green-300">
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {t("app.quoteDetail.approvedWithExtras")}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {money(quote.acceptedTotal)}
                  </span>
                </div>
              )}
          </div>
        </div>
      </article>

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t("app.quoteDetail.deleteTitle")}
        message={t("app.quoteDetail.deleteMessage")}
        itemName={quote.quoteNumber}
      />
    </div>
  );
}

/**
 * A titled block inside the document.
 *
 * Every section on the PDF and the approval page is introduced by a small
 * heading over a hairline; this keeps that rhythm rather than leaving each
 * block to invent its own spacing.
 */
function Block({ title, children }) {
  return (
    <section className="px-5 sm:px-7 py-5 border-t border-border">
      <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A label/value pair in the document's fact column. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label} </dt>
      <dd className="inline text-foreground font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** A quiet totals line. The loud one is the band, and there is only one. */
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * One line of the email trail.
 *
 * Absolute date AND relative age, because they answer different questions:
 * "when exactly" matters when a client disputes it, "how long ago" is what
 * tells you whether it's time to chase.
 */
function TrailRow({ label, at, detail, tone }) {
  const { t } = useTranslation();
  // The company's chosen ordering, not a hardcoded en-CA. This is staff reading
  // their own audit trail, which is precisely the case Company.dateFormat
  // exists for — and a page that respects the setting in one place and ignores
  // it two inches lower is how a preference stops being believed.
  const { formatDateTime } = useCompanyPreferences();
  const when = new Date(at);
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  const ago =
    days === 0
      ? t("app.quoteDetail.today")
      : days === 1
        ? t("app.quoteDetail.yesterday")
        : t("app.quoteDetail.daysAgo", { days });

  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap text-sm">
      <span
        className={
          tone === "positive"
            ? "font-medium text-green-700 dark:text-green-400"
            : "font-medium text-foreground"
        }
      >
        {label}
        {detail && (
          <span className="font-normal text-muted-foreground"> → {detail}</span>
        )}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(when)}
        <span className="text-muted-foreground/60"> · {ago}</span>
      </span>
    </div>
  );
}
