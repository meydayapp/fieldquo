// app/api/platform/billing/tax-registrations/route.js
//
// Where FieldQuo must register to charge tax on its own subscriptions, and how
// close each place is. Stripe Billing only — FieldQuo charging companies —
// never Connect. READ-ONLY: three Stripe list/retrieve calls and one database
// read, nothing written anywhere. The decision logic is
// lib/platform/taxRegistrations.js, pure, so scripts/check-tax-registrations.mjs
// executes it; this file only gathers the inputs and says which of them it
// could not read, rather than letting an unreadable source become a zero.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { registrationReport } from "@/lib/platform/taxRegistrations";

// Enough for years at FieldQuo's size; a cap so a runaway list cannot hold the
// request open. Reaching it is reported, never silently truncated.
const INVOICE_CAP = 5000;

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "analytics:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const now = new Date();
  const since = Math.floor(now.getTime() / 1000) - 365 * 24 * 60 * 60;

  // ── FieldQuo's own rows: who is paying or trialling, and where ───────────
  const companies = await db.company.findMany({
    where: { isDemo: false },
    select: {
      country: true,
      isDemo: true,
      trialEndsAt: true,
      subscription: {
        select: {
          status: true,
          billingInterval: true,
          plan: { select: { priceMonthly: true, priceAnnual: true, currency: true } },
        },
      },
    },
  });

  // ── Stripe: paid subscription invoices, last 12 months ───────────────────
  //
  // The invoice's own customer_address and customer_tax_ids are what Stripe
  // Tax decided on, so they are read rather than the company's settings.
  // Only invoices that belong to a subscription: that is the sale this page
  // is about.
  let invoices = null;
  let invoiceError = null;
  let invoiceCapped = false;
  try {
    const list = [];
    for await (const inv of stripe.invoices.list({ status: "paid", created: { gte: since }, limit: 100 })) {
      if (inv?.subscription) {
        list.push({
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          customer_address: inv.customer_address ? { country: inv.customer_address.country } : null,
          customer_tax_ids: Array.isArray(inv.customer_tax_ids)
            ? inv.customer_tax_ids.map((t) => ({ type: t?.type, value: t?.value ? "present" : null }))
            : [],
        });
      }
      if (list.length >= INVOICE_CAP) {
        invoiceCapped = true;
        break;
      }
    }
    invoices = list;
  } catch (err) {
    invoiceError = err?.message || "Stripe invoices could not be listed.";
  }

  // ── Stripe: the registrations that make Stripe Tax collect ───────────────
  let registrations = null;
  let registrationError = null;
  try {
    const list = [];
    for await (const r of stripe.tax.registrations.list({ status: "all", limit: 100 })) {
      list.push({ country: r.country, status: r.status, country_options: r.country_options, active_from: r.active_from, expires_at: r.expires_at });
    }
    registrations = list;
  } catch (err) {
    registrationError = err?.message || "Stripe tax registrations could not be listed.";
  }

  // ── Stripe: the account's Tax settings — the preconditions ───────────────
  //
  // Stripe Tax computes nothing useful without a head office and a preset
  // product tax code, and the default tax behaviour decides whether A$99 is
  // A$99 + GST or A$99 including it. Shown, not changed.
  let settings = null;
  let settingsError = null;
  try {
    const s = await stripe.tax.settings.retrieve();
    settings = {
      status: s?.status || null,
      taxCode: s?.defaults?.tax_code || null,
      taxBehavior: s?.defaults?.tax_behavior || null,
      headOfficeCountry: s?.head_office?.address?.country || null,
      missingFields: s?.status_details?.pending?.missing_fields || [],
    };
  } catch (err) {
    settingsError = err?.message || "Stripe tax settings could not be read.";
  }

  const report = registrationReport({ invoices, companies, registrations, now });
  return NextResponse.json({
    ...report,
    registrations,
    settings,
    errors: { invoices: invoiceError, registrations: registrationError, settings: settingsError },
    invoiceCapped,
    since: new Date(since * 1000).toISOString(),
    generatedAt: now.toISOString(),
  });
}
