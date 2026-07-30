// lib/platform/companyHealth.js
//
// A support-facing health read for one company: is this account actually being
// used, and is anything visibly broken?
//
// ── Why a score at all ──────────────────────────────────────────────────────
//
// When a customer calls, the first question is "are they a heavy user having a
// bad day, or a dormant trial that never got set up?" — and the answer changes
// the whole conversation. A single number plus the signals behind it answers it
// in one glance.
//
// ── Every component is EARNED, never assumed ────────────────────────────────
//
// The score only counts things that actually happened: quotes sent, invoices
// sent, payments recorded, members logging in, setup completed. There is no
// participation credit and no invented baseline — a brand-new company scores
// low because it IS low, and that's the useful signal. `signals` is returned
// alongside so support sees the reasoning rather than a bare number they have
// to trust.

import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

function pct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Health for one company. Returns { score, band, signals[], metrics }.
 * Read-only; safe for the platform console (which never mutates tenant data).
 */
export async function companyHealth(companyId) {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);

  const [
    company,
    quotes30,
    quotesSent30,
    invoices30,
    payments30,
    activeMembers,
    lastActivity,
    aiUsage30,
    jobsOpen,
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        createdAt: true,
        onboardingStatus: true,
        stripeChargesEnabled: true,
        logoUrl: true,
        businessHours: true,
        trialEndsAt: true,
        subscription: { select: { status: true } },
      },
    }),
    db.quote.count({ where: { companyId, createdAt: { gte: since30 } } }),
    db.quote.count({ where: { companyId, sentAt: { gte: since30 } } }),
    db.invoice.count({ where: { companyId, createdAt: { gte: since30 } } }),
    db.payment.count({ where: { invoice: { companyId }, createdAt: { gte: since30 } } }),
    db.member.count({ where: { companyId, active: true } }),
    // The most recent thing anyone in the company did. The activity log is the
    // best proxy we have for "are they logged in and working" without tracking
    // sessions.
    db.activityLog.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, summary: true, actorName: true },
    }),
    db.aiUsage.aggregate({
      where: { companyId, createdAt: { gte: since30 } },
      _sum: { costMicros: true },
      _count: true,
    }),
    db.job.count({ where: { companyId, status: { in: ["unscheduled", "scheduled", "in_progress"] } } }),
  ]);

  if (!company) return null;

  const ageDays = Math.max(1, Math.round((now - company.createdAt) / DAY));
  const brandNew = ageDays <= 14;

  // ── Score components (max 100) ──
  // Weighted toward the pipeline actually moving, because that's what a
  // healthy field-service account looks like.
  let score = 0;
  const signals = [];

  // Using the core pipeline (50)
  if (quotesSent30 > 0) {
    score += Math.min(25, 5 + quotesSent30 * 2);
    signals.push({ ok: true, label: `${quotesSent30} quotes sent in 30 days` });
  } else {
    signals.push({ ok: false, label: "No quotes sent in 30 days" });
  }
  if (invoices30 > 0) {
    score += Math.min(15, 5 + invoices30 * 2);
    signals.push({ ok: true, label: `${invoices30} invoices created in 30 days` });
  } else {
    signals.push({ ok: false, label: "No invoices in 30 days" });
  }
  if (payments30 > 0) {
    score += 10;
    signals.push({ ok: true, label: `${payments30} payments recorded` });
  } else {
    signals.push({ ok: false, label: "No payments recorded in 30 days" });
  }

  // Recency of use (20)
  const lastSeenDays = lastActivity
    ? Math.round((now - lastActivity.createdAt) / DAY)
    : null;
  if (lastSeenDays != null && lastSeenDays <= 2) {
    score += 20;
    signals.push({ ok: true, label: "Active in the last 2 days" });
  } else if (lastSeenDays != null && lastSeenDays <= 14) {
    score += 10;
    signals.push({ ok: true, label: `Last active ${lastSeenDays} days ago` });
  } else {
    signals.push({
      ok: false,
      label: lastSeenDays == null ? "No recorded activity yet" : `Last active ${lastSeenDays} days ago`,
    });
  }

  // Setup completeness (20)
  if (company.stripeChargesEnabled) {
    score += 10;
    signals.push({ ok: true, label: "Can take card payments" });
  } else {
    signals.push({ ok: false, label: "Stripe not connected — can't take cards" });
  }
  if (company.logoUrl) {
    score += 5;
    signals.push({ ok: true, label: "Branding set up" });
  } else {
    signals.push({ ok: false, label: "No logo uploaded" });
  }
  if (Array.isArray(company.businessHours) && company.businessHours.length) {
    score += 5;
    signals.push({ ok: true, label: "Opening hours set" });
  } else {
    signals.push({ ok: false, label: "No opening hours set" });
  }

  // Team engaged (10)
  if (activeMembers > 1) {
    score += 10;
    signals.push({ ok: true, label: `${activeMembers} active team members` });
  } else {
    score += 3;
    signals.push({ ok: false, label: "Single-user account" });
  }

  score = pct(score);

  // A two-week-old account can't have a 30-day history — say so rather than
  // letting support read "unhealthy" off an account that hasn't had time.
  const band = brandNew
    ? "new"
    : score >= 70
      ? "healthy"
      : score >= 40
        ? "at_risk"
        : "dormant";

  return {
    score,
    band,
    brandNew,
    ageDays,
    signals,
    metrics: {
      quotes30,
      quotesSent30,
      invoices30,
      payments30,
      activeMembers,
      jobsOpen,
      lastSeenDays,
      lastActivity: lastActivity || null,
      aiCalls30: aiUsage30._count || 0,
      aiCostUsd30: (aiUsage30._sum?.costMicros || 0) / 1_000_000,
      subscriptionStatus: company.subscription?.status || null,
      onboardingStatus: company.onboardingStatus,
      trialEndsAt: company.trialEndsAt,
    },
  };
}
