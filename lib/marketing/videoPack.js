// lib/marketing/videoPack.js
//
// The "Video pack" add-on — +90 video posts a month for US$77/month (the
// numbers and why they are what they are: lib/marketing/videoAllowance.js).
//
// ══ Mirrors lib/ai/creditBundle.js, on purpose ═══════════════════════════════
//
// Same Stripe Billing customer as the company's plan and its AI credit plan
// (getOrCreateStripeCustomer), same inline price_data (no Stripe catalogue to
// keep in step with the constant), same two settlement doors — the browser's
// return from Checkout and invoice.payment_succeeded — converging on one
// idempotent function, same interception in the billing webhook BEFORE the
// company-plan handler (a pack's invoice on the plan's customer would
// otherwise be read as the plan renewing), same USD-only refusal for a
// company whose plan bills in another currency.
//
// ══ What differs, and why ═══════════════════════════════════════════════════
//
// An AI bundle GRANTS credit into a wallet, so its idempotency is a ledger ref
// per period. A pack grants nothing to spend down: it RAISES A LIMIT while it
// is paid for. So the fact recorded is `paidThrough` — the end of the latest
// paid period — and it only ever moves forward. Settling the same invoice
// twice writes the same date; a delayed webhook for last month's invoice
// cannot pull it back. That is the whole idempotency: there is nothing to
// double.
//
// A company may hold several packs. Each is its own subscription and its own
// row — "Add another pack" is another Checkout — so there is never a quantity
// change to prorate and cancelling one pack cannot touch another.
//
// Cancelling sets cancel_at_period_end: the company paid for the month, so the
// pack keeps counting until paidThrough, and Stripe stops the next invoice.
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { recordActivity } from "@/lib/activity/log";
import { invoiceSubscriptionId } from "@/lib/billing/subscriptionChargeEvent";
import { VIDEO_PACK, formatPackPrice } from "@/lib/marketing/videoAllowance";

export const VIDEO_PACK_KIND = "video_pack_subscription";

/** Same rule, same reason as lib/ai/creditBundle.js bundleAvailability. */
export function packAvailability(companyCurrency) {
  const currency = String(companyCurrency || "USD").toUpperCase();
  if (currency === "USD") return { ok: true, reason: null };
  return {
    ok: false,
    code: "currency_locked",
    reason:
      `Video packs are billed in US dollars, and your FieldQuo plan bills in ${currency}. ` +
      "Stripe can't run both on one account, so packs aren't available on a non-USD account yet.",
  };
}

/** What a screen may see — no Stripe ids. */
export function publicPack(row, now = new Date()) {
  if (!row) return null;
  const through = row.paidThrough ? new Date(row.paidThrough) : null;
  return {
    id: row.id,
    status: row.status,
    counts: Boolean(through && through > now),
    paidThrough: row.paidThrough || null,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    currentPeriodEnd: row.currentPeriodEnd || null,
  };
}

export async function createVideoPackCheckoutSession({ company, successUrl, cancelUrl, deps = {} }) {
  const stripeClient = deps.stripe || stripe;
  const customerFor = deps.getOrCreateStripeCustomer || getOrCreateStripeCustomer;
  const customerId = await customerFor(company);
  const metadata = { companyId: company.id, kind: VIDEO_PACK_KIND, packKey: VIDEO_PACK.key };
  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: VIDEO_PACK.currency.toLowerCase(),
          product_data: { name: `FieldQuo — Video pack, ${VIDEO_PACK.videos} videos/month` },
          unit_amount: VIDEO_PACK.priceCents,
          recurring: { interval: VIDEO_PACK.interval },
        },
        quantity: 1,
      },
    ],
    // On BOTH: the invoice and subscription events only ever see the
    // subscription's own metadata (same reasoning as creditBundle.js).
    metadata,
    subscription_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return { ok: true, checkoutUrl: session.url };
}

function unix(seconds) {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
}

/** Create or refresh the row from a Stripe Subscription. Null when it is not a pack. */
export async function upsertVideoPackFromSubscription(subscription, { prisma = db } = {}) {
  const companyId = subscription?.metadata?.companyId || null;
  if (!companyId || subscription?.metadata?.kind !== VIDEO_PACK_KIND || !subscription.id) return null;
  const status =
    subscription.status === "incomplete_expired" ? "canceled" : String(subscription.status || "incomplete");
  const data = {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "",
    status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    // Newer API versions moved current_period_end onto the subscription item.
    currentPeriodEnd: unix(subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end),
  };
  return prisma.videoPack.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { companyId, stripeSubscriptionId: subscription.id, ...data },
    update: data,
  });
}

/** Is this subscription id a pack? Asks Stripe when the row isn't here yet. */
export async function resolveVideoPackSubscription(subscriptionId, { prisma = db, deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  if (!subscriptionId) return null;
  const existing = await prisma.videoPack.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
  if (existing) return existing;
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId).catch(() => null);
  if (subscription?.metadata?.kind !== VIDEO_PACK_KIND) return null;
  return upsertVideoPackFromSubscription(subscription, { prisma });
}

/** The newer of two dates — paidThrough never moves backwards. */
export function laterOf(a, b) {
  const x = a ? new Date(a) : null;
  const y = b ? new Date(b) : null;
  if (!x || Number.isNaN(x.getTime())) return y;
  if (!y || Number.isNaN(y.getTime())) return x;
  return x >= y ? x : y;
}

/**
 * The one settlement. Called from both doors.
 *
 * @returns {{handled: false}} when the invoice is not a pack's — the webhook
 *   must fall through to the company-plan handler, as for the AI bundle.
 */
export async function settleVideoPackInvoice(invoice, { deps = {} } = {}) {
  const prisma = deps.db || db;
  const logActivity = deps.recordActivity || recordActivity;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { handled: false, reason: "no_subscription" };

  const row = await resolveVideoPackSubscription(subscriptionId, { prisma, deps });
  if (!row) return { handled: false, reason: "not_a_pack" };
  if (invoice?.status && invoice.status !== "paid") return { handled: true, settled: false, reason: "not_paid" };

  // The period this invoice paid for, from its own line — a fact about the
  // charge, not today's clock.
  const periodEnd = unix(invoice?.lines?.data?.[0]?.period?.end);
  if (!periodEnd) return { handled: true, settled: false, reason: "no_period" };

  const paidThrough = laterOf(row.paidThrough, periodEnd);
  const moved = !row.paidThrough || paidThrough.getTime() !== new Date(row.paidThrough).getTime();
  // A compare-and-set on the value we read, so two doors racing cannot let
  // the older period land last.
  const updated = await prisma.videoPack.updateMany({
    where: { id: row.id, paidThrough: row.paidThrough ?? null },
    data: { paidThrough, lastPaidInvoiceId: moved ? invoice.id || null : row.lastPaidInvoiceId, status: "active" },
  });
  if (updated.count === 0) {
    // The other door wrote first. Re-read and keep the later of the two.
    const fresh = await prisma.videoPack.findUnique({ where: { id: row.id } });
    const final = laterOf(fresh?.paidThrough, periodEnd);
    if (fresh && final.getTime() !== new Date(fresh.paidThrough || 0).getTime()) {
      await prisma.videoPack.update({ where: { id: row.id }, data: { paidThrough: final, lastPaidInvoiceId: invoice.id || null } });
    }
  }

  if (moved) {
    await logActivity(
      { companyId: row.companyId },
      {
        action: "marketing.video_pack_paid",
        entityType: "settings",
        actorName: "Stripe (video pack)",
        summary: `Video pack paid — ${VIDEO_PACK.videos} more videos a month until ${paidThrough.toISOString().slice(0, 10)} (${formatPackPrice()}/mo)`,
        metadata: { subscriptionId, invoiceId: invoice.id || null },
      },
    ).catch(() => {});
  }
  return { handled: true, settled: true, moved, companyId: row.companyId, paidThrough };
}

/** The browser-return door. Converges on settleVideoPackInvoice. */
export async function settleVideoPackCheckoutSession(session, { deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  const prisma = deps.db || db;
  if (session?.mode !== "subscription" || session?.metadata?.kind !== VIDEO_PACK_KIND) {
    return { ok: false, reason: "not_a_pack_session" };
  }
  if (session.status !== "complete") return { ok: false, reason: "checkout_incomplete" };
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
  if (!subscriptionId) return { ok: false, reason: "no_subscription" };

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
  if (subscription?.metadata?.companyId !== session.metadata?.companyId) return { ok: false, reason: "session_mismatch" };

  const row = await upsertVideoPackFromSubscription(subscription, { prisma });
  if (!row) return { ok: false, reason: "not_a_pack" };
  const invoice = subscription.latest_invoice;
  const settled =
    invoice && typeof invoice === "object" && invoice.status === "paid"
      ? await settleVideoPackInvoice(invoice, { deps })
      : { handled: true, settled: false, reason: "invoice_not_paid_yet" };
  return { ok: true, packId: row.id, settled };
}

/** Stop renewing at the end of the paid period. Stripe first — see creditBundle's cancel. */
export async function cancelVideoPack(companyId, packId, { prisma = db, deps = {} } = {}) {
  const stripeClient = deps.stripe || stripe;
  const row = await prisma.videoPack.findUnique({ where: { id: String(packId || "") } });
  if (!row || row.companyId !== companyId) return { ok: false, reason: "not_found" };
  if (row.status === "canceled" || row.cancelAtPeriodEnd) return { ok: true, config: row };
  try {
    await stripeClient.subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: true });
  } catch (err) {
    if (err?.code !== "resource_missing") return { ok: false, reason: "stripe_unavailable" };
  }
  const updated = await prisma.videoPack.update({ where: { id: row.id }, data: { cancelAtPeriodEnd: true } });
  await recordActivity(
    { companyId },
    { action: "marketing.video_pack_cancelled", entityType: "settings", summary: "Video pack set to end at the close of its paid month" },
  ).catch(() => {});
  return { ok: true, config: updated };
}
