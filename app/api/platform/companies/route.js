// app/api/platform/companies/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDefaultFollowUps } from "@/lib/followUps/defaults";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { isCardFreeTrial } from "@/lib/signup/abandoned";
import { companyStanding } from "@/lib/platform/companyStanding";
import { subscriberBucket } from "@/lib/platform/trialCounting";
import { BUCKETS, BUCKET_GROUPS } from "@/lib/platform/subscriberBuckets";
import { getOnboardingStatus } from "@/lib/onboarding";
import { callBackFor, needsChecklistRead } from "@/lib/platform/callBack";

/**
 * The status filter: one of the buckets every /platform number counts
 * (lib/platform/subscriberBuckets.js), a group of them ("trialing"), or
 * "card_free".
 *
 * It was `active` / `pending` / `churned` — Company.onboardingStatus — beside
 * two bucket-like extras. onboardingStatus flips to "active" at Stripe
 * checkout, i.e. at trial START, and stays "pending" for every card-free
 * trial, so the chip labelled "Trial / pending" held three of the five
 * trialing companies and "Active" held two companies that had paid nothing.
 * The chips now filter by the SAME classification the dashboard tiles count
 * with, so "Trialing (5)" on the home page opens a list of five.
 *
 * Resolved against each row's bucket in memory, after the one query — the
 * bucket reads lib/billing/access.js, which no `where` can say without a
 * second copy of the rule. Still server-side, so the list never says "12
 * companies" over a page showing 3.
 *
 * `card_free` is every company on the card-free trial whatever its day —
 * running, ended read-only, or locked — which is the population
 * /platform/signups and /platform/billing/subscriptions list as "free trials
 * without a plan", and the page their "Open in Companies" links land on.
 *
 * @returns a predicate over a row carrying `bucket`, or null for "unknown filter"
 */
//
// Test companies (owner, 2026-10-03 — Company.isTestCompany, bucket "test")
// are hidden from every chip like a demo, unless `?tests=1`: then they are
// listed under the chip their REAL standing belongs to (`realBucket`), with
// the badge the page draws. The "Test company" chip lists only them. The
// page's per-country tally counts `bucket`, which stays "test", so showing
// them never puts them back in a number.
function statusFilter(status, showTests = false) {
  const visible = (c) => showTests || c.bucket !== "test";
  const bucketOf = (c) => (c.bucket === "test" ? c.realBucket : c.bucket);
  // The demo companies are FieldQuo's own sales props, not customers, and
  // they never see Stripe. The day after the test companies were purged this
  // list was ten rows of "pending · Never finished checkout · No plan" — all
  // demos, read by the owner as ten abandoned signups. Every customer filter
  // (All included) leaves them out, and "demo" is the one place they show —
  // the same line /platform/signups and the analytics overview draw.
  if (!status) return (c) => c.bucket !== "demo" && visible(c);
  if (status === "test") return (c) => c.bucket === "test";
  if (status === "card_free") return (c) => visible(c) && isCardFreeTrial(c);
  if (BUCKET_GROUPS[status]) return (c) => visible(c) && BUCKET_GROUPS[status].includes(bucketOf(c));
  if (BUCKETS[status]) return (c) => visible(c) && bucketOf(c) === status;
  return null;
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const keep = statusFilter(status, searchParams.get("tests") === "1");
  // A filter nobody implements answering with the whole list under its label
  // is the "control that appears to work" — refused by name instead.
  if (!keep) {
    return NextResponse.json({ error: `Unknown filter "${status}".` }, { status: 400 });
  }

  const companies = await db.company.findMany({
    where: {
      // Narrowed in SQL where it is free: demos are their own bucket.
      ...(status === "demo" ? { isDemo: true } : { isDemo: false }),
      ...(q && { name: { contains: q, mode: "insensitive" } }),
    },
    include: {
      subscription: { include: { plan: { select: { name: true } } } },
      _count: { select: { members: true, quotes: true } },
      // The owner's own number and product-news consent, from the one-screen
      // signup and its welcome questions (2026-09-29) — for sales and support
      // to reach the person, and to know whether product news may be sent.
      members: {
        where: { role: "owner" },
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { user: { select: { email: true, phone: true, marketingConsentAt: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // `bucket` — which of the dashboard's numbers this company is in (the
  // page's per-country tally counts it); `standing` — the words the screen
  // prints, derived from the same bucket (lib/platform/companyStanding.js).
  const now = new Date();
  const rows = companies
    .map((c) => {
      const bucket = subscriberBucket(c, now);
      // The bucket a test company would be in unmarked — for the filters
      // above when tests are shown; never counted.
      const realBucket = bucket === "test" ? subscriberBucket({ ...c, isTestCompany: false }, now) : bucket;
      return { ...c, bucket, realBucket };
    })
    .filter(keep)
    .map((c) => ({ ...c, standing: companyStanding(c, now) }));

  // ── "Needs call back" (lib/platform/callBack.js) ─────────────────────────
  //
  // The checklist is read — read-only, never stamping — only for the rows
  // whose welcome questions are done and whose checklist has not been
  // stamped complete; a failed read is "not asked", never a flag.
  const checklists = await Promise.all(
    rows.map((c) => (needsChecklistRead(c) ? getOnboardingStatus(c.id, { readOnly: true }).catch(() => null) : null)),
  );
  const withCallBack = rows.map((c, i) => ({
    ...c,
    callBack: callBackFor({ company: c, onboarding: checklists[i], ownerPhone: c.members?.[0]?.user?.phone || null }),
  }));
  // ?callBack=1 — only the companies someone should ring.
  const onlyCallBack = searchParams.get("callBack") === "1";
  return NextResponse.json(onlyCallBack ? withCallBack.filter((c) => c.callBack) : withCallBack);
}

// Manual company creation — used before self-serve signup exists, or for
// white-glove onboarding of early customers
export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, slug, email, ownerEmail, ownerName } = body;

  if (!name || !slug || !ownerEmail || !ownerName) {
    return NextResponse.json(
      { error: "name, slug, ownerEmail, and ownerName are required" },
      { status: 400 },
    );
  }

  const existingSlug = await db.company.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json(
      { error: "That slug is already taken" },
      { status: 409 },
    );
  }

  const company = await db.company.create({
    data: { name, slug, email: email || null, onboardingStatus: "pending" },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "company_created",
      targetCompanyId: company.id,
      details: { name, slug },
    },
  });

  // The same defaults a self-serve signup gets (app/api/companies/route.js):
  // three follow-up rules, so a company FieldQuo created by hand is not the
  // one company whose quotes are never chased. Creating rows inside a tenant
  // is what this route already does — it is the company's own birth, not an
  // edit to anything a customer wrote.
  try {
    await ensureDefaultFollowUps(db, company.id);
  } catch (err) {
    console.error("[platform companies POST] default follow-up seeding failed", err);
  }

  // Note: this creates the Company record only — the actual owner still needs to
  // complete their own signup (Better Auth account + organization) to log in.
  // Consider sending ownerEmail an invite link here once the signup flow exists.

  return NextResponse.json(company, { status: 201 });
}
