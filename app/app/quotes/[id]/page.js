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
import { moneyFormatter } from "@/lib/format/money";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import SendConfirmModal from "@/app/components/SendConfirmModal";
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
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { documentLabels } from "@/lib/i18n/documentLabels";
import ImportedByPanel from "./ImportedByPanel";
import EmailSectionsPanel from "./EmailSectionsPanel";
import EmailSectionsBlockedModal from "./EmailSectionsBlockedModal";
import ImportedCostsPanel from "./ImportedCostsPanel";
import { formatAddress } from "@/lib/format/address";
import {
  COMPLEXITY_LEVELS,
  COMPLEXITY_REASONS,
} from "@/app/data/cabinetPricing";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted:
    "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

// Formatted exactly as it was before this page was restyled, and exactly as the
// invoice detail page still does it. Prettier grouping is tempting, but quotes
// and invoices sitting side by side with different money formatting reads as a
// bug — that's a change to make in both places or neither.
// Was a private `toFixed(2)` copy, which does not group — this page printed
// $2100.00 while the list view beside it printed $2,100.00. See
// lib/format/money.js; the formatter is bound to the quote's own currency
// inside the component, below.

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
  // What the quote SAYS — per-trade prose, resolved the same way the client's
  // copy resolves it, so the two documents cannot drift.
  const [docContent, setDocContent] = useState(null);
  // What it COSTS — internal, permission-gated, never on a client surface.
  const [costing, setCosting] = useState(null);
  // The company's billing currency, the reader's language. All eight money
  // renders below go through this — they used to go through a private
  // toFixed(2) helper that printed $2100.00 on the page a client opens.
  //
  // MUST stay below the useState above. It read `quote` eleven lines before
  // that line declared it, which is a temporal dead zone: the whole page threw
  // "Cannot access 'A' before initialization" and rendered nothing at all. The
  // `?.` reads as a guard and is not one — optional chaining protects against
  // null, not against touching a `const` binding that does not exist yet.
  const money = moneyFormatter(quote?.company?.currency, language);
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
  // The send refused because an optional email section is switched on with
  // nothing in it. Held as state rather than flattened into `error`, because
  // the 409 carries the two ways out and a red banner cannot offer a button.
  // See lib/quotes/emailSections.js for why the server refuses rather than
  // dropping the section.
  const [blockedSections, setBlockedSections] = useState(null);

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

    // ── The two things this page used to be missing ────────────────────────
    //
    // The client's copy of a quote carries what's included, what could change
    // the price, the process with its timelines and the payment schedule. This
    // page carried none of it — so the person who WROTE the quote saw a bare
    // list of amounts while the homeowner read a document. They are the one
    // who has to defend every sentence on it.
    //
    // Both are separate endpoints rather than a wider GET: this response is
    // already spread into the PDF route and the editor, and neither needs
    // several kilobytes of trade prose or a costing block.
    fetch(`/api/quotes/${id}/document`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDocContent)
      // Silent: the document reads correctly without the prose, and an error
      // banner about missing boilerplate above a perfectly good quote is noise.
      .catch(() => setDocContent(null));

    fetch(`/api/quotes/${id}/costing`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCosting)
      // A 403 here is NORMAL — job costing is a permission, and somebody
      // without it should see the quote and not the margin.
      .catch(() => setCosting(null));
  }, [id]);

  // Carried over from the builder when "Save & Send" saved the quote but the
  // email failed. Without this the user lands on a draft with no explanation
  // of why it isn't sent — which is how you get someone pressing Send four
  // more times.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sendError = params.get("sendError");
    const sendBlocked = params.get("sendBlocked");
    if (!sendError && !sendBlocked) return;
    if (sendError) setError(sendError);
    // The builder's "Save & Send" hit the empty-section gate. Re-read the
    // sections rather than smuggling the 409 payload through the URL: it is
    // one request, and it means the dialog opens on the CURRENT state — if
    // somebody filled the list in another tab while this navigated, there is
    // nothing left to block and the dialog says so instead of arguing with a
    // stale copy.
    if (sendBlocked) {
      fetchJson(`/api/quotes/${id}/email-sections`)
        .then((data) =>
          setBlockedSections({
            kind: sendBlocked === "follow_up" ? "follow_up" : "quote",
            blocked: data.blockedDetail || [],
          }),
        )
        .catch((err) => setError(err.message));
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [id]);

  /**
   * Actually emails the client.
   *
   * This button used to call updateStatus("sent"), which changed a word on
   * screen and then hid itself because the status was no longer draft. Every
   * signal said the quote had gone out; nothing had been sent. It now calls a
   * route that emails, and only reports success once Resend has accepted the
   * message.
   */
  const [pendingSend, setPendingSend] = useState(null);

  async function sendQuote(kind) {
    // ── One click used to email the client ────────────────────────────────
    //
    // No confirmation, no chance to check the address. Sending a quote is
    // outbound, irreversible, and lands in a stranger's inbox under the
    // contractor's name — a misfire is a client reading a price that wasn't
    // meant for them yet, and there is no unsend.
    //
    // The recipient is named IN the prompt because that is the thing worth
    // checking. QA created a client through the quick-add and sent to whatever
    // address happened to be on it; "Send to whom?" is the question this
    // answers.
    const to = quote?.client?.email;
    if (!to) {
      setError(
        t(
          "app.quoteDetail.noEmail",
          "This client has no email address, so there's nowhere to send it. Add one on the client first.",
        ),
      );
      return;
    }
    // A rendered modal, not window.confirm — see SendConfirmModal for why.
    // The actual send happens in doSend once they confirm.
    setPendingSend({ kind, to });
  }

  async function doSend(kindOverride) {
    const kind = kindOverride || pendingSend?.kind;
    if (!kind) return;
    setPendingSend(null);

    setSending(kind);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "email_sections_empty") {
        // Not an error state: nothing is wrong with the request, the quote
        // just isn't ready. The kind is kept alongside so Retry sends the same
        // thing — a follow-up must not come back as a fresh quote.
        setBlockedSections({ kind, blocked: data.blocked || [] });
        return;
      }
      if (!res.ok)
        throw new Error(data?.error || t("app.quoteDetail.sendError"));

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
    if (res.ok) {
      router.push("/app/quotes");
    } else {
      // Was silent: a failed request did nothing visible at all.
      //
      // The modal no longer closes itself on confirm (it used to, before the
      // request had even finished), so close it here — otherwise the error
      // lands behind an open dialog.
      setShowDelete(false);
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

  // The stored address is Google's FORMATTED string and already contains the
  // city and province — appending them printed "…, Canada, Toronto, ON" on the
  // document a client opens. See lib/format/address.js.
  const clientAddress = formatAddress(quote.client);

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
              {quote.sentAt
                ? t("app.quoteDetail.sendAgain")
                : t("app.action.send")}
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
      <SendConfirmModal
        isOpen={Boolean(pendingSend)}
        busy={Boolean(sending)}
        onClose={() => setPendingSend(null)}
        onConfirm={doSend}
        recipient={pendingSend?.to}
        title={
          pendingSend?.kind === "follow_up"
            ? t("app.quoteDetail.confirmFollowUpTitle", "Send a follow-up?")
            : t("app.quoteDetail.confirmSendTitle", "Send this quote?")
        }
        detail={t(
          "app.quoteDetail.confirmSendDetail",
          "They'll get it by email straight away. You can't unsend it.",
        )}
        confirmLabel={t("app.quoteDetail.send", "Send")}
      />

      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 size={16} className="shrink-0" />
          {/* The sentence is ONE flex item. It used to be three — the label,
              the address span, and a bare "." — and the container's gap-2.5
              spaced them all, rendering "Sent to someone@example.com ." with a
              float before the full stop. Raw text in a flex row becomes an
              anonymous flex item, which is easy to forget. */}
          <span>
            {t("app.quoteDetail.sentTo")}{" "}
            <span className="font-medium">{justSent}</span>.
          </span>
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
                  ? t("app.quoteDetail.followedUpN", {
                      count: quote.followUpCount,
                    })
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
                label={
                  quote.status === "accepted"
                    ? t("app.status.approved")
                    : t("app.status.declined")
                }
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

      <EmailSectionsBlockedModal
        isOpen={Boolean(blockedSections)}
        quoteId={id}
        blocked={blockedSections?.blocked || []}
        sending={Boolean(sending)}
        onClose={() => setBlockedSections(null)}
        onCleared={(stillBlocked) =>
          setBlockedSections((b) => (b ? { ...b, blocked: stillBlocked } : b))
        }
        onRetry={() => {
          const kind = blockedSections?.kind;
          setBlockedSections(null);
          doSend(kind);
        }}
      />

      {/* What this quote's email will carry beyond the quote itself. Editable
          while the client can still act on it; frozen once they have decided,
          because the email has already been read by then. */}
      <EmailSectionsPanel
        quoteId={id}
        editable={["draft", "sent"].includes(quote.status)}
      />

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
              <p className="text-sm text-muted-foreground">
                {quote.client.phone}
              </p>
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
                  {/* ── Why this line costs what it costs ──────────────────
                      The takeoff already stores it. `meta` carries the base
                      unit price, the complexity level the estimator chose and
                      the reasons they ticked — and until now this page threw
                      all of it away and printed a bare "Cabinet Refinishing ×
                      37". Somebody looking at a quote three weeks later, or
                      defending it to a client on the phone, had no way to see
                      that $170 was $150 plus a moderate uplift, let alone
                      why.

                      Staff-only, like the rest of this page. The client's copy
                      states the price; this states the reasoning behind it. */}
                  {(group.lineItems || []).map((item, i) =>
                    item?.meta?.complexityLevel ? (
                      <PriceReasoning
                        key={`why${i}`}
                        item={item}
                        money={money}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── What the client is actually reading ────────────────────────
            Everything below mirrors the document at /q/<token>, resolved
            through the same helpers so the two cannot drift. It used to live
            only on the client's copy, which meant the estimator defending a
            quote on the phone could not see the sentences they were being
            asked about. */}
        {docContent?.groups?.some(
          (g) => g.included?.length || g.mayChange?.length,
        ) && (
          <Block
            title={t(
              "app.quoteDetail.whatTheClientReads",
              "What this quote says",
            )}
          >
            <div className="space-y-4">
              {docContent.groups
                .filter((g) => g.included?.length || g.mayChange?.length)
                .map((g) => (
                  <div
                    key={g.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: g.accent }}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {g.label}
                    </p>
                    {g.included?.length > 0 && (
                      <>
                        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(
                            "app.quoteDetail.whatsIncluded",
                            "What's included",
                          )}
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {g.included.map((line) => (
                            <li
                              key={line}
                              className="flex gap-1.5 text-sm text-muted-foreground"
                            >
                              <span aria-hidden="true">·</span>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {g.mayChange?.length > 0 && (
                      <>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(
                            "app.quoteDetail.whatCouldChange",
                            "What could change this price",
                          )}
                        </p>
                        <dl className="mt-0.5 space-y-1">
                          {g.mayChange.map((e) => (
                            <div key={e.title}>
                              <dt className="text-sm font-medium text-foreground">
                                {e.title}
                              </dt>
                              <dd className="text-sm text-muted-foreground">
                                {e.body}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </Block>
        )}

        {docContent?.processSteps?.length > 0 && (
          <Block
            title={t("app.quoteDetail.howTheWorkRuns", "How the work runs")}
          >
            <ol className="space-y-2.5">
              {docContent.processSteps.map((step) => (
                <li key={step.num} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {step.title}
                      {/* The duration the client was quoted. Absent for a
                          trade whose content states none — printing a guess
                          here would be printing a commitment. */}
                      {step.timeline && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {step.timeline}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {docContent.processNotes && (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {docContent.processNotes}
                </p>
                {/* Whose words these are. A company default silently printing
                    as if it were written for this job is how a contractor
                    discovers boilerplate on a signed document. */}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {docContent.processNotesSource === "quote"
                    ? t(
                        "app.quoteDetail.notesOnThisQuote",
                        "Written on this quote",
                      )
                    : t(
                        "app.quoteDetail.notesFromCompany",
                        "Your company default — edit the quote to change it for this job only",
                      )}
                </p>
              </div>
            )}
          </Block>
        )}

        {docContent?.paymentTerms && (
          <Block title={t("app.quoteDetail.paymentTerms", "Payment terms")}>
            {docContent.paymentSchedule?.length > 0 ? (
              <ol className="space-y-1">
                {docContent.paymentSchedule.map((stage, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 text-sm text-foreground"
                  >
                    <span>{stage.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stage.percent != null
                        ? `${stage.percent}%`
                        : stage.amount != null
                          ? money(stage.amount)
                          : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {docContent.paymentTerms}
              </p>
            )}
          </Block>
        )}

        {/* ── What it costs YOU ──────────────────────────────────────────
            Internal. Never on the PDF, never in the email, never on /q/.
            Permission-gated server-side too — /api/quotes/[id]/costing
            answers 403 without job-costing access rather than a body of
            zeroes, because zeroes read as a job that cost nothing. */}
        {costing && (
          <Block title={t("app.quoteDetail.costAndMargin", "Cost & margin")}>
            {!costing.saved && (
              // The difference between "what we quoted at" and "what it would
              // cost today" is the whole reason QuoteCosting exists. A page
              // that showed the second while implying the first would be
              // quietly rewriting history every time the rate card moved.
              <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Nothing was costed when this quote was saved, so these figures
                are worked out from today&apos;s rates — not what it was priced
                at. Nobody recorded who was doing the work either, so the hours
                carry no money.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [
                  t("app.quoteDetail.labour", "Labour"),
                  `${costing.labourHours} hrs`,
                  money(costing.labourCost),
                ],
                [
                  t("app.quoteDetail.materials", "Materials"),
                  null,
                  money(costing.materialTotal),
                ],
                [
                  t("app.quoteDetail.overhead", "Overhead"),
                  costing.overheadBasis === "per_job"
                    ? t("app.quoteDetail.thisJobsShare", "this job's share")
                    : t("app.quoteDetail.estimated", "estimated"),
                  money(costing.overhead),
                ],
                [
                  t("app.quoteDetail.totalCost", "Total cost"),
                  null,
                  money(costing.estimatedCost),
                ],
              ].map(([label, sub, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border px-3 py-2"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    {value}
                  </div>
                  {sub && (
                    <div className="text-[11px] text-muted-foreground">
                      {sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">
                {money(costing.price)} − {money(costing.estimatedCost)} ={" "}
                <strong className="text-foreground">
                  {money(costing.profit)}
                </strong>
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  costing.signal === "red"
                    ? "text-red-600 dark:text-red-400"
                    : costing.signal === "amber"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {costing.marginPct == null
                  ? "—"
                  : `${costing.marginPct}% margin`}
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  {t("app.quoteDetail.target", "target")}{" "}
                  {costing.marginTargetPct}%
                </span>
              </span>
            </div>

            {/* Amber on a healthy-looking margin needs explaining, or it reads
                as a broken badge. */}
            {costing.costIncomplete && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Some of the work has no cost against it, so the real margin is
                lower than this.
              </p>
            )}
            {costing.unpricedMaterials > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {costing.unpricedMaterials} material
                {costing.unpricedMaterials === 1 ? " has" : "s have"} no price
                set.
              </p>
            )}

            {costing.crew?.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("app.quoteDetail.crew", "Crew")}
                  {costing.blendedRate != null && (
                    <span className="ml-2 font-normal normal-case">
                      {money(costing.blendedRate)}/hr blended
                    </span>
                  )}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {costing.crew.map((m, i) => (
                    <li
                      key={`${m.name}${i}`}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {m.name || t("app.quoteDetail.unnamed", "Unnamed")}
                        <span className="ml-2 text-xs">
                          {m.hours} hrs
                          {m.hourlyRate != null
                            ? ` × ${money(m.hourlyRate)}`
                            : ""}
                        </span>
                      </span>
                      <span className="tabular-nums text-foreground">
                        {money(m.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {costing.groups?.some((g) => g.materials?.length) && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(
                    "app.quoteDetail.billOfMaterials",
                    "Materials this job needs",
                  )}
                </p>
                {costing.groups
                  .filter((g) => g.materials?.length)
                  .map((g, gi) => (
                    <div key={gi} className="mt-1.5">
                      <p className="text-xs font-medium text-foreground">
                        {g.label}
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {g.materials.map((m, i) => (
                          <li
                            key={`${m.name}${i}`}
                            className="flex justify-between gap-3 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {m.name} — {m.qty} {m.unit}
                            </span>
                            {/* Not $0.00. Nobody has priced it, and a zero
                                would read as free. */}
                            {m.unpriced ? (
                              <span className="shrink-0 text-amber-700 dark:text-amber-400">
                                {t(
                                  "app.quoteDetail.noPriceSet",
                                  "no price set",
                                )}
                              </span>
                            ) : (
                              <span className="shrink-0 tabular-nums text-foreground">
                                {money(m.cost)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Block>
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
                <ClientMediaTile
                  key={(typeof m === "string" ? m : m?.url) + i}
                  media={m}
                />
              ))}
            </div>
          </Block>
        )}

        <div className="px-5 sm:px-7 py-5 border-t border-border">
          {/* Right-aligned and narrow above sm, exactly as TotalsSection lays
              the PDF out: a totals block spanning the full width reads as
              another table, kept to a column it reads as a summary. */}
          <div className="sm:w-3/5 sm:ml-auto space-y-1 text-sm">
            <Row
              label={t("app.quoteDetail.subtotal")}
              value={money(quote.subtotal)}
            />
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
/**
 * The estimator's reasoning, read back off the stored takeoff.
 *
 * Nothing here is computed: `meta.baseUnitPrice`, `meta.complexityLevel` and
 * `meta.complexityReasons` are what the builder wrote when the quote was
 * priced. Re-deriving them from today's rate card would show what the job
 * WOULD cost now, which is a different and much less useful number than what
 * was actually quoted.
 *
 * Renders nothing when the line carries no complexity — most trades don't.
 */
function PriceReasoning({ item, money }) {
  const meta = item?.meta || {};
  const level = COMPLEXITY_LEVELS.find((l) => l.value === meta.complexityLevel);
  if (!level) return null;

  const base = Number(meta.baseUnitPrice) || 0;
  const rate = Number(item.rate) || 0;
  const uplift = rate - base;

  // Ids are stored; the labels live in one catalogue. An id nobody recognises
  // is dropped rather than printed raw — "deep_damage" on screen is a leak of
  // the database into the office.
  const labels = [];
  for (const list of Object.values(COMPLEXITY_REASONS)) {
    for (const r of list) {
      if ((meta.complexityReasons || []).includes(r.id)) labels.push(r.label);
    }
  }

  return (
    <div className="border-t border-border py-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium" style={{ color: level.color }}>
          {level.label} complexity
        </span>
        {base > 0 && uplift > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {money(base)} + {money(uplift)} uplift = {money(rate)} per{" "}
            {item.unit || "unit"}
          </span>
        )}
      </div>
      {labels.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {labels.map((l) => (
            <li key={l} className="flex gap-1.5">
              <span aria-hidden="true">·</span>
              {l}
            </li>
          ))}
        </ul>
      ) : (
        // A level with no reasons ticked is a judgement nobody wrote down.
        // Saying so is more useful than an empty space, because the person
        // reading this is usually about to be asked to justify it.
        <p className="mt-1 text-muted-foreground">
          No reasons were recorded for this level.
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label} </dt>
      <dd className="inline text-foreground font-medium tabular-nums">
        {value}
      </dd>
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
