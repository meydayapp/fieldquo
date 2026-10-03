// app/portal/[token]/demo-pay/DemoPay.js
//
// The pay step of a DEMO company, shown to a prospect playing the homeowner.
//
// ══ Why a screen and not a refusal ════════════════════════════════════════
//
// The owner: "we want to showcase what the client gets." A Pay button that
// errored, or vanished, on a demo would show the prospect a broken product at
// the one step that matters most to a contractor. So the button works: it
// lands here, in the company's own colours and logo, where it says in the
// client's language that this is a demo and no card is charged — and then
// walks to the same "Payment received" screen a real card payment returns to.
//
// Nothing here can take money. There is no card field, the page never talks
// to Stripe, and the confirm posts back to the portal pay route, which
// answers a demo by recording a `demo_pi_…` payment (lib/demo/demoPayment.js)
// and refuses a real company (lib/demo/simulatedSpend.js refuseDemoCharge
// stands behind it in every Stripe seam). The amount shown is read from the
// same portal payload PortalInvoice.js reads; the route re-derives the one it
// records — the browser never sends money (non-negotiable #5).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, ShieldCheck } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { jsonBody } from "@/lib/jsonBody";

export default function DemoPay({ token, invoiceId, stageId = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

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

  async function confirm() {
    setPaying(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A yes, not a figure: the route derives the amount from the invoice
        // and the stage row, exactly as for a card.
        body: jsonBody({ invoiceId, stageId, method: "card", demoConfirm: true }, "payment"),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.checkoutUrl) throw new Error(d?.error || "Couldn't complete the payment.");
      window.location.href = d.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  const language = data?.language || "en";
  const copy = clientDocCopy(language);
  const labels = documentLabels(language);
  const money = documentFormatters(language, data?.company?.currency).money;

  if (loading) {
    return (
      <Shell token={token} backLabel={copy.backToAccount}>
        <div className="animate-pulse h-64 bg-black/10 rounded-2xl" />
      </Shell>
    );
  }

  const invoice = data?.invoices?.find((i) => i.id === invoiceId) || null;
  // Only a demo's portal ever links here; a real company's page says nothing
  // about demos and offers nothing to press.
  if (!data?.demoPayments || !invoice) {
    return (
      <Shell token={token} backLabel={copy.backToAccount}>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="font-semibold text-[#2d2520]">{error || copy.invoiceNotFound}</p>
        </div>
      </Shell>
    );
  }

  const c = data.company || {};
  const accent = c.brandColor || "#06356b";
  const accentOn = readableForeground(accent);
  const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amountPaid || 0));
  const stage = stageId ? (invoice.jobPaymentStages || []).find((s) => s.id === stageId) : null;
  const due = stage ? Math.min(stage.amountCents / 100, balance) : balance;

  return (
    <Shell token={token} backLabel={copy.backToAccount}>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex h-1.5">
          <div className="flex-[2]" style={{ backgroundColor: accent }} />
          <div className="flex-1" style={{ backgroundColor: `${accent}99` }} />
        </div>
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5 flex items-center gap-3 min-w-0">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt={c.name} className="h-11 w-auto max-w-[180px] object-contain" />
          ) : (
            <div
              className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: accent, color: accentOn }}
            >
              <Building2 size={20} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-[#2d2520] truncate">{c.name}</div>
            <div className="text-sm text-[#2d2520]/70">
              {labels.invoice} {invoice.invoiceNumber}
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-5">
          {/* Near-black on pale amber, measured at 12.6:1 and independent of
              the brand colour — the one panel on this page that must never
              be missed. The button below takes the brand fill with
              readableForeground's measured ink, as PortalInvoice does. */}
          <div className="rounded-xl border border-[#e8c46a] bg-[#fff7e0] px-4 py-3 text-[#3d2c00]">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} className="shrink-0" />
              {copy.demoPayBadge}
            </div>
            <p className="mt-1 text-sm leading-relaxed">{copy.demoPayBody}</p>
          </div>

          <div className="text-3xl font-semibold tabular-nums text-[#2d2520]">{money(due)}</div>

          {due > 0.005 ? (
            <button
              type="button"
              onClick={confirm}
              disabled={paying}
              className="w-full rounded-xl px-5 py-3.5 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: accent, color: accentOn }}
            >
              {paying && <Loader2 size={18} className="animate-spin" />}
              {copy.demoPayButton(money(due))}
            </button>
          ) : (
            <p className="text-sm text-[#2d2520]/70">{copy.demoPayNothingOwed}</p>
          )}
          {error && <p className="text-sm text-[#a11a1a]">{error}</p>}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ token, children, backLabel }) {
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
