// app/app/invoices/[id]/page.js
//
// The back-office view of an invoice.
//
// ── Why this looks like the quote detail page ──────────────────────────────
//
// AGENTS.md: "Invoices MIRROR quotes; they are not a lesser version of them."
// This page was the counter-example. A quote showed the estimator the document
// their client reads — brand rule, letterhead, scope groups, what's included,
// what could change the price, the process with its timelines, the payment
// terms. The invoice showed a flat list of line-item rows and a totals block,
// which is roughly a tenth of what the client's copy says.
//
// That gap matters most on the invoice, not least. By the time an invoice is
// raised, the office is defending a price somebody already agreed to, and the
// person on the phone could not see the sentences they were being asked about.
//
// So the <article> below is the same structure the quote page's document mirror
// uses, filled from /api/invoices/[id]/document — which is field for field the
// same shape /api/quotes/[id]/document returns, deliberately, so the two pages
// cannot drift.
//
// ── And the half a quote does not have ─────────────────────────────────────
//
// Above the document: banners that say what is true about this invoice and what
// to do about it, chosen by lib/invoices/lifecycle.js and checked by
// scripts/check-invoice-banners.mjs. Below it: the job this invoice bills for,
// its visits, the crew's hours and whether payroll has covered them, and what
// the work cost against what it was quoted at. Those are the links the owner
// asked for — "so it gets linked with the rest — job, payroll, etc — throughout
// the life cycle of the project."
//
// The seam is the same one the quote page draws: what is inside the framed
// article is the client's document, in the company's colour; what is outside it
// is the office, in FieldQuo's.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Send,
  DollarSign,
  Download,
  Mail,
  Loader2,
  Check,
  Building2,
  FileText,
} from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import BrandTheme from "@/app/components/BrandTheme";
import { moneyFormatter } from "@/lib/format/money";
import { paymentMethodLabel } from "@/lib/payments/methodLabels";
import { documentLabels } from "@/lib/i18n/documentLabels";
import { taxStatement } from "@/lib/tax/documentTax";
import TaxUnresolvedModal from "@/app/components/tax/TaxUnresolvedModal";
import LifecycleBanners from "./LifecycleBanners";
import JobPanel from "./JobPanel";
import CostPanel from "./CostPanel";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  overdue: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function InvoiceDetailPage() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const router = useRouter();
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  // The company: currency, letterhead and brand colour. One request, not the
  // two this page used to make for the currency alone — it is the same endpoint
  // the layout already reads for date preferences, so it is warm, and the
  // masthead degrades to the brand mark alone if it fails.
  const [company, setCompany] = useState(null);
  // The send refused because this invoice can't say what tax is owed.
  const [taxBlocked, setTaxBlocked] = useState(null);
  // Everything the invoice SAYS. Its own request for the same reason the quote
  // page makes one: several kilobytes of prose that the PDF route and the
  // editor have no use for.
  const [doc, setDoc] = useState(null);
  // Where it sits in the project — banners, job, visits, payroll, variance.
  const [life, setLife] = useState(null);
  const [savedCosting, setSavedCosting] = useState(null);
  const [creditInfo, setCreditInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The same question DELETE /api/invoices/[id] asks, asked of the same grid —
  // requireLevel(full, "invoices", "view_create_edit_delete"). The trash icon
  // was offered to everyone, and a Dispatcher capped at view_create_edit got
  // the real "permanently removed" dialog for an invoice they cannot delete.
  const caller = usePermissions();
  const canDeleteInvoice = hasLevel(
    caller,
    "invoices",
    "view_create_edit_delete",
  );
  const [showPayment, setShowPayment] = useState(false);
  const [showChase, setShowChase] = useState(false);
  const [chaseNote, setChaseNote] = useState("");
  const [payment, setPayment] = useState({
    amount: "",
    method: "e_transfer",
    notes: "",
  });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState("");
  const [creditingId, setCreditingId] = useState("");
  // Which JobPanel form a banner asked to open. A counter is appended so
  // pressing the same banner twice re-opens it after the user closed it —
  // a prop that never changes value would silently stop working.
  const [jobFocus, setJobFocus] = useState("");

  // The company's billing currency and the reader's language, bound once. Every
  // money render on this page goes through it, including the document's — the
  // page beside it prints $2,100.00 and an invoice that printed $2100.00 next
  // to it reads as a bug.
  const money = moneyFormatter(company?.currency, language);

  // What this document's tax line is allowed to say. `company` is the business
  // -info payload, which already carries province, country, taxRate,
  // autoApplyLocalTax, vatRegistered and the company's own TaxRate rows — so
  // the office copy resolves it exactly as the PDF and the client's copy do,
  // rather than reaching a different conclusion about the same row.
  //
  // Reads only. Nothing here re-prices anything: `invoice.tax` is untouched.
  const taxLine = taxStatement({
    taxEnabled: invoice?.taxEnabled,
    tax: invoice?.tax,
    company,
    taxRates: company?.taxRates,
    client: invoice?.client,
    asOf: invoice?.createdAt ? new Date(invoice.createdAt) : undefined,
    lang: language,
  });
  // The document's own furniture — "Invoice", "Prepared for", "Balance due" —
  // from the catalogue the PDF and the portal use, in the STAFF's language.
  const labels = documentLabels(language);

  // Re-read after anything that can change the invoice's state. Kept as one
  // function so a send, a payment and a credit all refresh the same three
  // things — a page where the totals updated and the banners didn't would go on
  // claiming an invoice was overdue after it had just been paid.
  const refresh = useCallback(async () => {
    const [inv, lifecycle] = await Promise.all([
      fetch(`/api/invoices/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/invoices/${id}/lifecycle`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    if (inv) setInvoice(inv);
    if (lifecycle) setLife(lifecycle);
    return inv;
  }, [id]);

  useEffect(() => {
    // Guard res.ok on every one of these: a 404/401 returns { error }, and
    // setting that as the invoice made `if (!invoice)` pass, rendering a $NaN
    // page instead of not-found.
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInvoice)
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
    fetch(`/api/invoices/${id}/lifecycle`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setLife)
      .catch(() => {});
    // The prose. A failure here loses the trade content and nothing else, so
    // the document still renders its scope and totals rather than waiting.
    fetch(`/api/invoices/${id}/document`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDoc)
      .catch(() => {});
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCompany(d))
      .catch(() => {});
    // 403 is the normal answer for someone without the jobCosting toggle, and
    // `saved` is null when nobody has costed this invoice — both mean "show
    // nothing", not "show zeroes".
    fetch(`/api/invoices/costing?invoiceId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSavedCosting(d?.saved || null))
      .catch(() => {});
    fetch(`/api/invoices/${id}/credit-visit-fee`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCreditInfo)
      .catch(() => {});
  }, [id]);

  // Carried over from the new-invoice page when "Save & Send" saved the invoice
  // but the email failed — so the user learns why it's still a draft instead of
  // assuming the client got it. Mirrors the quote detail page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sendError = params.get("sendError");
    if (!sendError) return;
    setError(sendError);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /**
   * Actually emails the invoice.
   *
   * This button used to call updateStatus("sent") — it changed a word on
   * screen and then hid itself, and no email was ever constructed. sentAt is
   * now written only after Resend accepts the message, and the send route
   * raises the chase task on the way out.
   */
  async function sendInvoice() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      const data = await res.json().catch(() => null);
      // The invoice says tax applies and charges none. Not a failure to
      // report — a decision to make, and the dialog holds both ways out. An
      // invoice is the harder of the two documents to get wrong: this is what
      // the household owes and what the company remits against.
      if (res.status === 409 && data?.code === "tax_unresolved") {
        setTaxBlocked(data);
        return;
      }
      if (!res.ok)
        throw new Error(data?.error || t("app.invoiceDetail.sendError"));
      setJustSent(data.to);
      setTimeout(() => setJustSent(""), 6000);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: id,
        ...payment,
        amount: Number(payment.amount),
      }),
    });
    if (!res.ok) {
      await reportResponseError(
        res,
        setError,
        t("app.invoiceDetail.recordPaymentError"),
      );
      return;
    }
    await refresh();
    setShowPayment(false);
    setPayment({ amount: "", method: "e_transfer", notes: "" });
  }

  /**
   * Chase an unpaid invoice.
   *
   * ── One send path, not two ────────────────────────────────────────────────
   *
   * This posts to the SAME /request-payment route the button always used, which
   * builds its email with buildInvoiceEmail in the client's language and links
   * to the portal rather than to a Stripe URL that expires overnight. The only
   * thing added here is the note the route already accepted and no screen ever
   * sent — "we agreed you'd settle after the final visit, which was Tuesday" is
   * the sentence that gets an invoice paid, and it was unreachable.
   *
   * The chase TASK is not created or closed here. The send route raises it
   * (`invoice_sent:<id>`, idempotent on a unique sourceKey) and the payment
   * paths close it once the balance is settled. A second reminder-writing
   * mechanism on this page would be the copy that rots.
   */
  async function handleChase(e) {
    e?.preventDefault?.();
    setRequesting(true);
    setError("");
    setRequested(null);
    try {
      const res = await fetch(`/api/invoices/${id}/request-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: chaseNote.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error || t("app.invoiceDetail.requestError"));
      setRequested(data);
      setShowChase(false);
      setChaseNote("");
      // The route stamps sentAt and can move a draft to sent, so the banners
      // above must be re-read or they keep offering to send an invoice that
      // has just gone out.
      await refresh();
    } catch (err) {
      setError(err.message);
      setShowChase(false);
    } finally {
      setRequesting(false);
    }
  }

  // Apply or remove a visit-fee credit, then refresh both the invoice (for the
  // new balance) and the credit state (for which toggles are on).
  async function handleVisitCredit(bookingId, apply) {
    setCreditingId(bookingId);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}/credit-visit-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, apply }),
      });
      if (!res.ok) {
        await reportResponseError(
          res,
          setError,
          t("app.invoiceDetail.visitCreditError"),
        );
        return;
      }
      setCreditInfo(await res.json());
      await refresh();
    } finally {
      setCreditingId("");
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    const res = await fetch(`/api/invoices/${id}/pdf`, { method: "POST" });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setDownloadingPdf(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/app/invoices");
        return;
      }
      // The modal no longer closes itself on confirm, so close it here —
      // otherwise the error lands behind an open dialog.
      setShowDelete(false);
      // Into the page's own banner as well as the toast. Toast-only read as
      // "the dialog closed and nothing happened", which is indistinguishable
      // from a successful delete to the person who pressed the button.
      await reportResponseError(
        res,
        setError,
        t("app.invoiceDetail.deleteError"),
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!invoice)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        {t("app.invoiceDetail.notFound")}
      </div>
    );

  const amountPaid = Number(invoice.amountPaid || 0);
  const amountDue = Number(invoice.amountDue ?? invoice.total);
  // The one place the page asks "is there anything left to do about the money".
  // Half a cent, matching every balance recompute in the API.
  const owing = amountDue > 0.005;
  const superseded = (life?.banners || []).some((b) => b.id === "superseded");

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <Link
        href="/app/invoices"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={14} /> {t("app.invoiceDetail.backToInvoices")}
      </Link>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <Check size={16} className="shrink-0" />
          {t("app.invoiceDetail.emailedTo")}{" "}
          <span className="font-medium">{justSent}</span>.
        </div>
      )}

      {requested && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300">
          <div className="flex items-start gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <div>
              {t("app.invoiceDetail.paymentRequestSentTo")}{" "}
              <strong>{requested.to}</strong> —{" "}
              {money(requested.balance)}.
              {/* The email still goes out — the client just can't pay through
                  it. Better they hear from you than get a dead button. */}
              {requested.onlinePaymentsEnabled === false && (
                <div className="mt-1 text-amber-800 dark:text-amber-300">
                  {t("app.invoiceDetail.stripeNotConnected")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── The command strip ─────────────────────────────────────────────
          Deliberately above the document rather than inside it: none of this
          is anything the client ever sees. */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[invoice.status]}`}
            >
              {t(`app.status.${invoice.status}`, invoice.status)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {invoice.client?.name}
          </p>
        </div>

        {/* Every control here is hidden on a superseded version rather than
            disabled: the actions belong to the invoice that replaced this one,
            and a greyed-out Send invites somebody to wonder why. */}
        {!superseded && (
          <div className="flex flex-wrap gap-2">
            {/* Available while anything is still owed, not only on a draft —
                re-sending an invoice a client mislaid is routine. */}
            {owing && (
              <button
                onClick={sendInvoice}
                disabled={sending}
                className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {invoice.sentAt
                  ? t("app.invoiceDetail.sendAgain")
                  : t("app.action.send")}
              </button>
            )}
            {owing && (
              <button
                onClick={() => setShowPayment(true)}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
              >
                <DollarSign size={14} /> {t("app.invoiceDetail.recordPayment")}
              </button>
            )}
            {/* Only meaningful once the invoice has left the office and there's
                still something owing on it. */}
            {invoice.status !== "draft" && owing && (
              <button
                onClick={() => setShowChase(true)}
                disabled={requesting}
                className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {requesting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Mail size={14} />
                )}
                {t("app.invoiceDetail.requestPayment")}
              </button>
            )}
            {["draft", "sent"].includes(invoice.status) && (
              <Link
                href={`/app/invoices/${id}/edit`}
                className="border border-border px-4 py-2 rounded-full text-sm font-semibold"
              >
                {t("app.action.edit")}
              </Link>
            )}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="border border-border text-foreground p-2 rounded-full disabled:opacity-60"
              aria-label={t("app.invoiceDetail.downloadPdf")}
            >
              {downloadingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </button>
            {/* Hidden rather than disabled, matching Jobs: a greyed trash
                icon still asserts that deleting an invoice is something this
                screen does. */}
            {canDeleteInvoice && (
              <button
                onClick={() => setShowDelete(true)}
                className="border border-border text-muted-foreground p-2 rounded-full"
                aria-label={t("app.invoiceDetail.deleteTitle")}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── What is true, and what to do next ──────────────────────────────
          Chosen server-side from real columns. The handlers wired here are the
          only ones offered: a banner whose action this page cannot perform
          renders without a button rather than with a dead one. */}
      <TaxUnresolvedModal
        isOpen={Boolean(taxBlocked)}
        blocked={taxBlocked}
        docPath="invoices"
        docId={id}
        sending={sending}
        onClose={() => setTaxBlocked(null)}
        onRetry={async () => {
          setTaxBlocked(null);
          // Refresh first — "send with no tax" flipped taxEnabled and the
          // totals block is still showing the old row.
          await refresh();
          sendInvoice();
        }}
      />

      <LifecycleBanners
        banners={life?.banners || []}
        money={money}
        busy={sending ? "send" : requesting ? "chase" : ""}
        handlers={{
          send: sendInvoice,
          chase: () => setShowChase(true),
          createJob: () => setJobFocus(`create:${Date.now()}`),
          scheduleVisit: () => setJobFocus(`visit:${Date.now()}`),
        }}
      />

      {/* The email trail. Written only after Resend accepted the message, so
          "Emailed 3 July" is an event rather than the intention the old
          sentAt recorded. */}
      {invoice.sentAt && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-baseline justify-between gap-3 flex-wrap text-sm">
          <span className="font-medium text-foreground">
            {t("app.invoiceDetail.emailed")}
            {invoice.sentToEmail && (
              <span className="font-normal text-muted-foreground">
                {" "}
                → {invoice.sentToEmail}
              </span>
            )}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatDate(invoice.sentAt)}
          </span>
        </div>
      )}

      {/* ── The document ──────────────────────────────────────────────────
          A mirror of what the client sees: the PDF built from
          lib/documentSections/* and the portal copy at
          /portal/[token]/invoices/[id]. data-brand scopes BrandTheme's
          variables to the article, so `bg-inverted` inside it IS the company's
          colour with a foreground picked by measured contrast, while the rest
          of the screen stays FieldQuo's. */}
      <article
        data-brand
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <BrandTheme
          brandColor={company?.brandColor}
          brandColors={company?.brandColors}
        />
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
                {labels.invoice}
              </div>
              <h2 className="text-xl font-bold text-foreground tabular-nums">
                {invoice.invoiceNumber}
                {/* Version is part of the document's identity once there is
                    more than one — the client has a specific one of these. */}
                {invoice.version > 1 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    v{invoice.version}
                  </span>
                )}
              </h2>
              <span
                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[invoice.status]}`}
              >
                {t(`app.status.${invoice.status}`, invoice.status)}
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
              {invoice.client?.name}
            </p>
            {invoice.client?.contactName && (
              <p className="text-sm text-muted-foreground">
                {invoice.client.contactName}
              </p>
            )}
            {invoice.client?.email && (
              <p className="text-sm text-muted-foreground break-all">
                {invoice.client.email}
              </p>
            )}
            {invoice.client?.phone && (
              <p className="text-sm text-muted-foreground">
                {invoice.client.phone}
              </p>
            )}
          </div>

          <dl className="text-sm space-y-1 sm:text-right">
            <Fact label={labels.date} value={formatDate(invoice.createdAt)} />
            {/* Only when there is one. A due date is the thing the overdue
                banner is measured against, and an absent one is why that
                banner correctly says nothing. */}
            {invoice.dueDate && (
              <Fact
                label={labels.dueDate}
                value={formatDate(invoice.dueDate)}
              />
            )}
            {doc?.quote && (
              <div>
                <dt className="inline text-muted-foreground">
                  {t("app.invoiceDoc.fromQuote")}{" "}
                </dt>
                <dd className="inline">
                  <Link
                    href={`/app/quotes/${doc.quote.id}`}
                    className="text-foreground font-medium underline tabular-nums"
                  >
                    {doc.quote.quoteNumber}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* ── Scope, by trade ────────────────────────────────────────────
            One card per service, as on the quote and the approval page. The
            grouping is recovered from the descriptions the conversion wrote —
            see lib/invoices/documentGroups.js. An invoice with no quote behind
            it produces a single unlabelled card, which is the honest shape for
            a callout nobody ever quoted. */}
        {doc?.groups?.length > 0 ? (
          <section className="px-5 sm:px-7 py-5 space-y-3">
            {doc.groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border overflow-hidden"
              >
                {group.label && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted">
                    <h3 className="font-semibold text-foreground text-sm truncate">
                      {group.label}
                    </h3>
                    {group.subtotal > 0 && (
                      <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                        {money(group.subtotal)}
                      </span>
                    )}
                  </div>
                )}
                <div className="px-4 py-1">
                  {group.lineItems.map((item, i) => (
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
                      {/* See the totals block below: with `pricingHidden`
                          the API removed every `amount`, and money() coerces a
                          missing amount to zero on purpose. Printing it here
                          put "$0.00" beside real work — a stronger false claim
                          than an absent column. */}
                      {!invoice.pricingHidden && (
                        <span className="tabular-nums shrink-0">
                          {money(item.amount)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : (
          // The unstyled fallback, used while /document is still in flight or
          // if it failed. The figures are the invoice's own, so the document
          // is never blank waiting on prose.
          <section className="px-5 sm:px-7 py-5">
            {(invoice.lineItems || []).map((item, i) => (
              <div
                key={i}
                className="flex justify-between gap-4 text-sm text-foreground py-1.5 border-b border-border last:border-0"
              >
                <span>
                  {item.description}
                  {item.quantity > 1 && ` × ${item.quantity}`}
                </span>
                {!invoice.pricingHidden && (
                  <span className="tabular-nums">{money(item.amount)}</span>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── What the client is actually reading ────────────────────────
            Resolved through the same helpers the client's copy uses, so the
            two cannot drift. Absent for an invoice with no trade behind it,
            and the page says which rather than showing a gap. */}
        {doc?.groups?.some((g) => g.included?.length || g.mayChange?.length) && (
          <Block title={t("app.invoiceDoc.whatThisSays")}>
            <div className="space-y-4">
              {doc.groups
                .filter(
                  (g) => g.description || g.included?.length || g.mayChange?.length,
                )
                .map((g) => (
                  <div
                    key={g.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: g.accent || undefined }}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {g.label}
                    </p>
                    {/* The scope paragraph, first — the same order the quote
                        and the PDF print it in. No heading: the group's own
                        label is the heading, and this is the sentence under
                        it. */}
                    {g.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {g.description}
                      </p>
                    )}
                    {g.included?.length > 0 && (
                      <>
                        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {labels.whatsIncluded}
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
                          {labels.whatCouldChange}
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

        {/* The process the client was told the job would follow, with the
            durations that were on their quote. Timelines are printed only for
            the trades whose content states one — a guess here would be a
            commitment this software made on a contractor's behalf. */}
        {doc?.processSteps?.length > 0 && (
          <Block title={labels.howTheWorkRuns}>
            <ol className="space-y-2.5">
              {doc.processSteps.map((step) => (
                <li key={step.num} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {step.title}
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
            {doc.processNotes && (
              <div className="mt-3 rounded-lg bg-muted border-l-[3px] border-inverted px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {doc.processNotes}
                </p>
                {/* Whose words these are. A company default printing as if it
                    had been written for this job is how a contractor discovers
                    boilerplate on a document a client has already paid. */}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {doc.processNotesSource === "quote"
                    ? t("app.invoiceDoc.notesOnQuote")
                    : t("app.invoiceDoc.notesFromCompany")}
                </p>
              </div>
            )}
          </Block>
        )}

        {doc?.glossary?.length > 0 && (
          <Block title={t("app.invoiceDoc.glossary")}>
            <dl className="space-y-1">
              {doc.glossary.map((entry) => (
                <div key={entry.title}>
                  <dt className="text-sm font-medium text-foreground">
                    {entry.title}
                  </dt>
                  <dd className="text-sm text-muted-foreground">{entry.body}</dd>
                </div>
              ))}
            </dl>
          </Block>
        )}

        {invoice.notes && (
          <Block title={labels.notes}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {invoice.notes}
            </p>
          </Block>
        )}

        {Array.isArray(invoice.clientPhotos) &&
          invoice.clientPhotos.length > 0 && (
            <Block title={t("app.quoteDetail.clientMedia")}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {invoice.clientPhotos.map((m, i) => (
                  <ClientMediaTile
                    key={(typeof m === "string" ? m : m?.url) + i}
                    media={m}
                  />
                ))}
              </div>
            </Block>
          )}

        {/* Same rule as the quote page: with showPricing off the money columns
            are absent, money() renders a missing amount as $0.00, and an
            invoice reading "$0.00 total, $0.00 balance due" is a worse lie than
            saying nothing. The reason replaces the block. */}
        {invoice.pricingHidden ? (
          <div className="px-5 sm:px-7 py-5 border-t border-border">
            <p className="sm:w-3/5 sm:ml-auto text-sm text-muted-foreground">
              {t(
                "app.access.pricingHidden",
                "Pricing is hidden by your access level. Ask an owner or admin if you need to see it.",
              )}
            </p>
          </div>
        ) : (
        <div className="px-5 sm:px-7 py-5 border-t border-border">
          <div className="sm:w-3/5 sm:ml-auto space-y-1 text-sm">
            <Row label={labels.subtotal} value={money(invoice.subtotal)} />
            {Number(invoice.discount) > 0 && (
              <Row
                label={labels.discount}
                value={`-${money(invoice.discount)}`}
              />
            )}
            {/* Not always a figure. See lib/tax/documentTax.js — "$0.00" on a
                tax row is a claim ("worked out, came to nothing") that a
                document with no jurisdiction behind it cannot make. This is
                the office's own copy of what the client will read. */}
            <Row
              label={labels.tax}
              value={
                taxLine.kind === "charged"
                  ? money(invoice.tax)
                  : taxLine.kind === "unresolved"
                    ? t("app.tax.line.unresolved")
                    : t("app.tax.line.none")
              }
            />

            {/* The headline figure in a filled band in their colour, matching
                the PDF and the portal. */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-inverted text-inverted-foreground px-4 py-3 mt-2">
              <span className="text-xs font-bold uppercase tracking-wide">
                {labels.total}
              </span>
              <span className="text-xl font-bold tabular-nums">
                {money(invoice.total)}
              </span>
            </div>

            {amountPaid > 0 && (
              <>
                <div className="flex justify-between text-green-600 dark:text-green-400 mt-1.5">
                  <span>{labels.amountPaid}</span>
                  <span className="tabular-nums">{money(amountPaid)}</span>
                </div>
                <div
                  className={`flex justify-between font-semibold text-base ${owing ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                >
                  <span>{labels.balanceDue}</span>
                  <span className="tabular-nums">{money(amountDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* ── Payment terms ──────────────────────────────────────────────
            The milestones when the company's terms parse as a schedule, the
            sentence verbatim when they don't. parsePaymentSchedule declines
            whenever it isn't sure, precisely so a mangled set of cards never
            replaces a perfectly clear sentence. */}
        {doc?.paymentTerms && (
          <Block title={t("app.invoiceDoc.paymentTerms")}>
            {doc.paymentSchedule?.length > 0 ? (
              <ol className="space-y-1">
                {doc.paymentSchedule.map((stage, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 text-sm text-foreground"
                  >
                    <span>{stage.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stage.pct}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {doc.paymentTerms}
              </p>
            )}
          </Block>
        )}
      </article>

      {/* ── Below the document: the office's own record ────────────────── */}

      {creditInfo &&
        (creditInfo.eligible?.length > 0 || creditInfo.applied?.length > 0) && (
          <section className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">
              {t("app.invoiceDetail.visitCredit")}
            </h2>
            <p className="text-xs text-muted-foreground mb-2">
              {t("app.invoiceDetail.visitCreditHint")}
            </p>
            <div className="space-y-2">
              {creditInfo.applied?.map((c) => (
                <div
                  key={c.bookingId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {c.eventName} — {money(c.feePaidCents / 100)}
                  </span>
                  <button
                    onClick={() => handleVisitCredit(c.bookingId, false)}
                    disabled={creditingId === c.bookingId}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {creditingId === c.bookingId && (
                      <Loader2 size={13} className="animate-spin" />
                    )}
                    {t("app.invoiceDetail.visitCreditRemove")}
                  </button>
                </div>
              ))}
              {creditInfo.eligible?.map((c) => (
                <div
                  key={c.bookingId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {c.eventName} — {money(c.feePaidCents / 100)}
                  </span>
                  <button
                    onClick={() => handleVisitCredit(c.bookingId, true)}
                    disabled={creditingId === c.bookingId}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {creditingId === c.bookingId && (
                      <Loader2 size={13} className="animate-spin" />
                    )}
                    {t("app.invoiceDetail.visitCreditApply")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      {invoice.payments?.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {t("app.invoiceDetail.paymentHistory")}
          </h2>
          <div className="space-y-1">
            {invoice.payments.map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-sm text-muted-foreground"
              >
                <span>
                  {formatDate(p.date)} —{" "}
                  {p.method === "visit_credit"
                    ? t("app.invoiceDetail.visitCreditLabel")
                    : paymentMethodLabel(p.method)}
                </span>
                {/* The payment ROWS survive a redaction — that somebody
                    paid, when, and how is not the amount — but their `amount`
                    is stripped, so the figure would read $0.00. */}
                {!invoice.pricingHidden && (
                  <span className="tabular-nums">{money(p.amount)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The job, its visits, and the crew's hours. Rendered whether or not
          there is a job — "no job is linked" is the state that most needs a
          control on it. */}
      <JobPanel
        invoiceId={id}
        clientId={invoice.clientId}
        clientName={invoice.client?.name}
        // Seeded from what the invoice is for, and editable before it is
        // created. Not silently applied: the field is shown, and somebody
        // presses the button.
        defaultJobTitle={
          invoice.client?.name
            ? t("app.invoiceJob.defaultTitle", {
                name: invoice.client.name,
                number: invoice.invoiceNumber,
              })
            : invoice.invoiceNumber
        }
        job={life?.job || null}
        payroll={life?.payroll || null}
        focusRequest={jobFocus}
        onJobChange={(job, whole) =>
          setLife((l) =>
            whole ? whole : l ? { ...l, job } : { job, banners: [] },
          )
        }
      />

      {/* Estimated vs costed vs actual. Null-safe throughout: absent for a
          reader without job costing, and absent figure by figure where nothing
          was measured. */}
      <CostPanel
        saved={savedCosting}
        lifecycleCosting={life?.costing || null}
        money={money}
        editHref={
          ["draft", "sent"].includes(invoice.status)
            ? `/app/invoices/${id}/edit`
            : null
        }
      />

      {showPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-sm p-6">
            <h2 className="font-semibold mb-4">
              {t("app.invoiceDetail.recordPayment")}
            </h2>
            <form onSubmit={handleAddPayment} className="space-y-3">
              <input
                required
                type="number"
                step="0.01"
                placeholder={t("app.invoiceDetail.amountPlaceholder", {
                  amount: money(amountDue),
                })}
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <select
                value={payment.method}
                onChange={(e) =>
                  setPayment({ ...payment, method: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm bg-card"
              >
                <option value="cash">{t("app.invoiceDetail.cash")}</option>
                <option value="e_transfer">
                  {t("app.invoiceDetail.eTransfer")}
                </option>
                <option value="cheque">{t("app.invoiceDetail.cheque")}</option>
              </select>
              <input
                placeholder={t("app.invoiceDetail.notesOptional")}
                value={payment.notes}
                onChange={(e) =>
                  setPayment({ ...payment, notes: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayment(false)}
                  className="flex-1 border border-border py-2 rounded-full text-sm font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
                >
                  {t("app.invoiceDetail.record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chasing payment. The note is optional and the email goes either way —
          the route has always accepted one and no screen ever offered it. */}
      {showChase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <FileText size={16} /> {t("app.invoiceChase.title")}
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              {t("app.invoiceChase.hint", {
                name: invoice.client?.name || "",
                amount: money(amountDue),
              })}
            </p>
            <form onSubmit={handleChase} className="space-y-3">
              <textarea
                rows={3}
                value={chaseNote}
                maxLength={800}
                onChange={(e) => setChaseNote(e.target.value)}
                placeholder={t("app.invoiceChase.notePlaceholder")}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowChase(false)}
                  className="flex-1 border border-border py-2 rounded-full text-sm font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={requesting}
                  className="flex-1 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  {requesting && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {t("app.invoiceChase.send")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t("app.invoiceDetail.deleteTitle")}
        message={t("app.invoiceDetail.deleteMessage")}
        itemName={invoice.invoiceNumber}
        busy={deleting}
      />
    </div>
  );
}

/**
 * A titled block inside the document.
 *
 * Every section on the PDF and the portal copy is introduced by a small heading
 * over a hairline; this keeps that rhythm rather than leaving each block to
 * invent its own spacing. Same component the quote page's document uses.
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
