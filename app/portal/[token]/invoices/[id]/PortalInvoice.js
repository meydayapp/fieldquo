// app/portal/[token]/invoices/[id]/PortalInvoice.js
//
// Reads from the existing GET /api/portal/[token], which already returns every
// invoice for this client, and picks one out — rather than adding a
// per-invoice public endpoint.
//
// That's the safer shape: there is exactly one place where a portal token is
// turned into a set of records, so there's exactly one place to get the
// tenant scoping wrong. A second endpoint taking both a token and an invoice
// id would need its own "does this invoice belong to this token" check, which
// is precisely the check that gets forgotten.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  Landmark,
  Clock,
} from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import { documentTheme } from "@/lib/documents/theme";
import HowToPayBlock from "@/app/components/public/HowToPayBlock";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { documentFacts } from "@/lib/documentSections/customFacts";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { taxIdLine } from "@/lib/documents/taxId";
import { documentIssueDate } from "@/lib/documents/issueDate";
import { jsonBody } from "@/lib/jsonBody";
import { reviewQrCopy } from "@/lib/reviews/reviewQrCopy";
import { surchargeRatePercent } from "@/lib/stripe/clientCardSurchargeMath";
import CardPayPanel from "../../CardPayPanel";
import { clientPayChoices } from "@/lib/invoices/paymentRequest";

export default function PortalInvoice({ token, invoiceId, stageId = null, requestId = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  // The portal's own card form (CardPayPanel), open. Arrives open when the
  // portal index's Pay button sent the client here with ?pay=card.
  const [cardOpen, setCardOpen] = useState(false);
  // The client's one choice on a link that asks for part of the bill: the
  // figure asked for (default), or the whole balance. Both figures come from
  // the server; choosing the balance just leaves the stage/request hint off
  // the pay request, which is the plain balance checkout that always existed.
  const [payFull, setPayFull] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("pay") === "card") {
      setCardOpen(true);
      url.searchParams.delete("pay");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/${token}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(d?.error || "This link isn't valid.");
        setData(d);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // `method` is "card" or "bank" — HOW, never how much. The bank button only
  // exists when the server said the company can take it for the amount this
  // page asks for (invoice.bankDebit / stage.bankDebit), and the route
  // re-checks.
  async function pay(method = "card") {
    setPaying(method);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // stageId is a HINT, not an amount — the server re-derives the
        // figure from the JobPaymentStage row itself and caps it against the
        // invoice's real balance (lib/stripe.js). The browser never sends
        // money amounts (non-negotiable #5).
        // `requestId` is the same kind of hint, for the office's "different
        // amount". Choosing the full balance sends neither.
        body: jsonBody(
          {
            invoiceId,
            stageId: payFull ? null : stageId,
            requestId: payFull || stage ? null : request ? requestId : null,
            method,
          },
          "payment",
        ),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.checkoutUrl) {
        throw new Error(d?.error || "Couldn't start the payment.");
      }
      window.location.href = d.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (loading)
    return (
      <Shell token={token}>
        <div className="animate-pulse h-64 bg-black/10 rounded-2xl" />
      </Shell>
    );

  const invoice = data?.invoices?.find((i) => i.id === invoiceId);

  // The client's language, resolved server-side and shared by the whole portal.
  // Derived before the not-found branch so even that message lands translated.
  const language = data?.language || "en";
  const labels = documentLabels(language);
  const copy = clientDocCopy(language);
  const fmt = documentFormatters(language, data?.company?.currency);
  const money = fmt.money;
  const date = fmt.date;

  if (!invoice)
    return (
      <Shell token={token} backLabel={copy.backToAccount}>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="font-semibold text-[#2d2520]">
            {error || copy.invoiceNotFound}
          </p>
        </div>
      </Shell>
    );

  const c = data.company || {};
  const accent = c.brandColor || "#06356b";
  // Measured, not assumed white — see the quote page for why.
  const accentOn = readableForeground(accent);
  // For the "How to pay" block: the same measured palette the PDF uses.
  const theme = documentTheme(c);
  // The block as it was sent (or built by the route in the document's
  // language) — the e-transfer address, who to make the cheque out to.
  // Sentences only; the company's settings never reach this page.
  const howToPay = invoice.howToPay || null;
  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const balance = Math.max(
    0,
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0),
  );
  // The payment-schedule stage this link is for, if any — only ever a
  // `requested` stage (see the route's own select), and only ever DISPLAYED
  // here. The server re-derives and caps the real charge from the same row
  // when `pay()` posts stageId; this is not what makes that safe, it only
  // makes the button say the true figure before the client gets there.
  const stage = stageId
    ? (invoice.jobPaymentStages || []).find((s) => s.id === stageId)
    : null;
  // The office's "different amount" request this link names, when no stage
  // applies — id and the figure it still asks for, from the server (a spent
  // request is not in the list, so its link shows the balance).
  const request =
    !stage && requestId ? (invoice.paymentRequests || []).find((r) => r.id === requestId) || null : null;
  const picked = stage || request;
  const stageAmount = picked ? Math.min(picked.amountCents / 100, balance) : null;
  // The two figures this link may pay, both server-derived — only offered
  // as a choice when they differ (lib/invoices/paymentRequest.js).
  const choices = picked
    ? clientPayChoices({ requestedCents: Math.round(stageAmount * 100), balanceCents: Math.round(balance * 100) })
    : [];
  const asking = picked && !(payFull && choices.length > 1) ? stageAmount : null;
  // What THIS page asks for: the stage's (or request's) remaining share
  // when one applies and the client has not chosen the full balance,
  // otherwise the invoice's full remaining balance — unchanged from before
  // this feature existed.
  const due = asking != null ? asking : balance;
  const overdue =
    invoice.dueDate && due > 0.005 && new Date(invoice.dueDate) < new Date();
  // Same flag the portal index reads — the company may never have finished
  // connecting Stripe, in which case there is no card to take and the button
  // below would only 400.
  const onlinePayments = Boolean(data.onlinePayments);
  // "Pay from bank account" — only when Stripe has activated the capability
  // on the company's account AND the figure this page asks for is inside
  // Stripe's per-debit cap (lib/stripe/bankDebit.js); never a button that
  // fails. The offer is decided server-side for the stage's share when a
  // stage applies (a $3,000 deposit qualifies where the $12,000 balance does
  // not) and for the balance otherwise — the same figure `due` shows. Over
  // the cap the button is absent and `bankOverCap` says why. A bank debit
  // clears in 3–5 business days, so a pending one is said out loud beside
  // the balance rather than looking unpaid.
  const bankOffer = onlinePayments
    ? (asking != null ? picked.bankDebit : invoice.bankDebit) || null
    : null;
  const bankDebit = bankOffer?.eligible ? bankOffer.method : null;
  const pendingBank = invoice.pendingPayment || null;
  const failedBank = invoice.failedPayment || null;
  // The company passes its card fee on to clients paying by CREDIT card, and
  // this client may be charged it (decided server-side — `cardFee` is null
  // otherwise). The card button then opens the portal's own card form,
  // which shows the fee before payment; Stripe's hosted page could not.
  const cardFee = onlinePayments && data.cardForm?.publishableKey ? invoice.cardFee || null : null;
  const cardFeesPaid = Array.isArray(invoice.cardFeesPaid) ? invoice.cardFeesPaid : [];

  return (
    <Shell token={token} backLabel={copy.backToAccount}>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        {/* Same brand rule as the quote page. A client who approved a quote
            and then lands here should recognise it as the same company —
            previously these two pages shared no visual language at all. */}
        <div className="flex h-1.5">
          <div className="flex-[2]" style={{ backgroundColor: accent }} />
          <div className="flex-1" style={{ backgroundColor: `${accent}99` }} />
        </div>

        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
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
                  style={{ backgroundColor: accent, color: accentOn }}
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
                    className="text-xs text-[#2d2520]/55 hover:text-[#2d2520]"
                  >
                    {c.phone}
                  </a>
                )}
                {/* The registration number, where the contractor has one. This
                    is the invoice a client actually pays from, so it needs the
                    same line the PDF carries — without it a GST/HST-registered
                    contractor's client cannot claim the tax back. Renders
                    nothing at all when they are not registered. */}
                {taxIdLine(c) && (
                  <div className="text-xs text-[#2d2520]/55">{taxIdLine(c)}</div>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-lg font-bold tracking-[0.15em] leading-none uppercase"
                style={{ color: accent }}
              >
                {labels.invoice}
              </div>
              <div className="font-mono text-sm text-[#2d2520] mt-1">
                {invoice.invoiceNumber}
              </div>
              {/* The one date this document was missing entirely — the number
                  and the amount owed were here, but nothing said which day the
                  bill was actually raised. sentAt over createdAt: an invoice
                  drafted in March and emailed in May is a May invoice to the
                  household reading it — see lib/documents/issueDate.js. */}
              {documentIssueDate(invoice) && (
                <div className="text-xs text-[#2d2520]/55 mt-1">
                  {labels.date} {date(documentIssueDate(invoice))}
                </div>
              )}
              {invoice.dueDate && (
                <div
                  className={`text-xs mt-1 ${overdue ? "text-red-700" : "text-[#2d2520]/55"}`}
                >
                  {overdue ? copy.wasDue : copy.due} {date(invoice.dueDate)}
                </div>
              )}
              {/* The company's own boxes flagged for the document — a PO
                  number — in the same words as the PDF and the email. */}
              {documentFacts(invoice, { date, labels }).map(([label, value]) => (
                <div key={label} className="text-xs text-[#2d2520]/55 mt-1">
                  {label} · <span className="text-[#2d2520]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5">
          {items.length === 0 ? (
            <p className="text-sm text-[#2d2520]/50">
              {copy.noItemisedBreakdown}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((li, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-4 text-sm text-[#2d2520]"
                >
                  <span>
                    {li.description}
                    {Number(li.quantity) > 1 && (
                      <span className="text-[#2d2520]/50"> × {li.quantity}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {money(li.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {invoice.notes && (
            <div className="mt-5 pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold text-[#2d2520] mb-1">
                {labels.notes}
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row label={labels.subtotal} value={invoice.subtotal} money={money} />
            {Number(invoice.discount) > 0 && (
              <Row label={labels.discount} value={-Number(invoice.discount)} money={money} />
            )}
            {Number(invoice.offlineDiscountAmount) > 0 && (
              <p className="text-xs text-[#2d2520]/60 leading-snug">{labels.offlineDiscountIncluded}</p>
            )}
            {/* Not always a number — see lib/tax/documentTax.js. An invoice
                is the harder of the two documents to get wrong: this is what
                the household actually owes, and what the company remits
                against. `taxKind` is resolved server-side in
                app/api/portal/[token]/route.js. */}
            {invoice.taxKind && invoice.taxKind !== "charged" ? (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{labels.tax}</span>
                <span>
                  {invoice.taxKind === "unresolved"
                    ? labels.taxUnresolved
                    : labels.taxNone}
                </span>
              </div>
            ) : (
              <Row label={labels.tax} value={invoice.tax} money={money} />
            )}
            <div className="flex justify-between pt-1 font-semibold text-[#2d2520]">
              <span>{labels.total}</span>
              <span className="tabular-nums">{money(invoice.total)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <Row label={copy.paid} value={-Number(invoice.amountPaid)} money={money} />
            )}
            {/* The credit-card fee the client paid on top of a payment — a
                line of its own on their receipt, outside the invoice total
                (it is not part of the invoice and carries no tax). */}
            {cardFeesPaid.map((line, i) => (
              <div key={`${line.date}-${i}`} data-card-fee-paid className="flex justify-between text-xs text-[#2d2520]/60">
                <span>
                  {(line.refund ? copy.cardFee.receiptReturned : copy.cardFee.receiptLine)(
                    surchargeRatePercent(line.rateBps || undefined),
                    line.date ? date(line.date) : "",
                  )}
                </span>
                <span className="tabular-nums">{money(line.cents / 100)}</span>
              </div>
            ))}
            {/* The rate came from the contractor's province rather than this
                household's, because we hold no address for them. */}
            {invoice.taxAssumedRegion && (
              <p className="text-xs text-[#2d2520]/55 leading-snug pt-1">
                {labels.taxAssumedNote.replace(
                  "{region}",
                  invoice.taxAssumedRegion,
                )}
              </p>
            )}
            {/* The US sentence, inherited from the quote's record. */}
            {invoice.taxSentence && (
              <p className="text-xs text-[#2d2520]/55 leading-snug pt-1">
                {invoice.taxSentence}
              </p>
            )}
          </div>

          {/* The one figure that matters, in their colour — same treatment as
              the quote's total. Reading three similar numbers to find the one
              you owe is the opposite of helpful on a payment page. */}
          <div
            className="mt-4 flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            <span className="text-sm font-bold tracking-wide uppercase">
              {due > 0.005
                ? asking != null
                  ? stage
                    ? stage.label
                    : copy.payChoice.requested
                  : labels.balanceDue
                : copy.paidInFull}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {money(due > 0.005 ? due : invoice.total)}
            </span>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5 bg-[#faf8f4] border-t border-black/5">
          {error && (
            <div className="mb-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {due > 0.005 && !onlinePayments ? (
            // The balance still shows above — what changes is that we don't
            // offer a card we can't charge. The block says how to pay by
            // the methods the company DOES take; with none on, the same
            // "get in touch" line the invoice email carries.
            howToPay?.methods?.length ? (
              <HowToPayBlock block={howToPay} theme={theme} showOnline={false} />
            ) : (
              <p className="text-center text-sm text-[#2d2520]/60">{copy.arrangePayment}</p>
            )
          ) : due > 0.005 && pendingBank ? (
            <div className="flex items-start justify-center gap-2 text-sm text-[#2d2520]/70">
              <Clock size={16} className="shrink-0 mt-0.5" />
              <span>{copy.bankPendingBanner}</span>
            </div>
          ) : due > 0.005 ? (
            <div className="space-y-3">
              {/* What was asked for, or everything owed — two figures the
                  server computed, never a box to type in. Only when they
                  differ; a change closes the card form, whose review was
                  for the other figure. */}
              {choices.length > 1 && (
                <fieldset className="space-y-2" data-pay-choice>
                  <legend className="text-sm font-semibold text-[#2d2520] mb-1">{copy.payChoice.title}</legend>
                  {choices.map((choice) => {
                    const on = choice.choice === "balance" ? payFull : !payFull;
                    return (
                      <label
                        key={choice.choice}
                        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer bg-white"
                        style={{ borderColor: on ? accent : "rgba(0,0,0,0.12)" }}
                      >
                        <span className="flex items-center gap-2.5 text-sm text-[#2d2520]">
                          <input
                            type="radio"
                            name="pay-choice"
                            checked={on}
                            onChange={() => {
                              setPayFull(choice.choice === "balance");
                              setCardOpen(false);
                            }}
                            data-pay-choice-option={choice.choice}
                          />
                          {choice.choice === "balance"
                            ? copy.payChoice.balance
                            : stage
                              ? stage.label
                              : copy.payChoice.requested}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-[#2d2520]">
                          {money(choice.cents / 100)}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
              {failedBank && (
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {copy.bankFailed(failedBank.reason)}
                </div>
              )}
              {cardFee && cardOpen ? (
                <CardPayPanel
                  token={token}
                  invoiceId={invoice.id}
                  stageId={stage && asking != null ? stageId : null}
                  requestId={request && asking != null ? requestId : null}
                  dueCents={Math.round(due * 100)}
                  form={data.cardForm}
                  rateBps={cardFee.rateBps}
                  copy={copy}
                  money={money}
                  accent={accent}
                  accentOn={accentOn}
                  otherWaysFree={Boolean(bankDebit) || howToPay?.methods?.length > 0}
                  onPaid={() => {
                    window.location.href = `/portal/${token}?paid=true`;
                  }}
                />
              ) : (
                <button
                  onClick={() => (cardFee ? setCardOpen(true) : pay("card"))}
                  disabled={Boolean(paying)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold disabled:opacity-60"
                  style={{ backgroundColor: accent, color: accentOn }}
                >
                  {paying === "card" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CreditCard size={15} />
                  )}
                  {bankDebit ? copy.payCard(money(due)) : copy.pay(money(due))}
                </button>
              )}
              {cardFee && !cardOpen && (
                <p data-card-fee-notice className="text-center text-xs text-[#2d2520]/60">
                  {copy.cardFee.notice(surchargeRatePercent(cardFee.rateBps))}
                </p>
              )}
              {/* Pay-over-time lives on Stripe's hosted page; with the card
                  fee on, the card button no longer goes there, so it gets
                  its own button rather than silently disappearing. */}
              {cardFee && data.cardForm?.affirm && (
                <button
                  data-pay-over-time
                  onClick={() => pay("card")}
                  disabled={Boolean(paying)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold border disabled:opacity-60"
                  style={{ borderColor: accent, color: accent }}
                >
                  {paying === "card" ? <Loader2 size={13} className="animate-spin" /> : null}
                  {copy.cardFee.payOverTime}
                </button>
              )}
              {bankDebit && (
                <>
                  <button
                    data-pay-bank={bankDebit}
                    onClick={() => pay("bank")}
                    disabled={Boolean(paying)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold border disabled:opacity-60"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {paying === "bank" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Landmark size={15} />
                    )}
                    {copy.payBank(money(due))}
                  </button>
                  <p className="text-center text-xs text-[#2d2520]/60">{copy.bankNote}</p>
                </>
              )}
              {bankOffer && !bankOffer.eligible && (
                <p data-bank-over-cap className="text-center text-xs text-[#2d2520]/60">
                  {copy.bankOverCap(money(bankOffer.maxCents / 100), money(due))}
                </p>
              )}
              {/* The other ways to pay, under the buttons: the online row
                  is left out because the buttons above ARE it. */}
              {howToPay?.methods?.length > 0 && (
                <HowToPayBlock block={howToPay} theme={theme} showOnline={false} className="pt-4 mt-1 border-t border-black/5" />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700">
                <Check size={16} /> {copy.paidInFullThanks}
              </div>
              {/* The one moment a homeowner is warmest is the moment the
                  bill is settled. The link is the company's own review
                  address (Settings → Reviews); absent when unset — no
                  button to nowhere. Same words as the review email. */}
              {data?.company?.reviewUrl && /^https?:\/\//i.test(data.company.reviewUrl) && (
                <a
                  href={data.company.reviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-review-link
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#2d2520] hover:bg-black/5"
                >
                  {reviewQrCopy(language).leaveReview}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ token, children, backLabel = "Back to your account" }) {
  return (
    <div className="min-h-dvh bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/portal/${token}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#2d2520]/60 hover:text-[#2d2520] mb-5"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Link>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, money }) {
  return (
    <div className="flex justify-between text-[#2d2520]/70">
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
