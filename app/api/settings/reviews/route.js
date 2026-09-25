// app/api/settings/reviews/route.js
//
// The review-request settings, and a count of who's waiting.
//
// The count is the honest part. A screen that says "Automatic review requests:
// On" tells you nothing about whether it's working; "3 customers will be asked
// in the next day" is checkable against reality, and its absence is how you
// find out the delay is set to 30 days by accident.
//
// ── What else this GET carries, and why in one call ───────────────────────
//
// The Google listing (place_id → review link), the invoice-footer QR switch,
// the digital business card's address and its tap counts, whether the two
// wallet passes can be signed on this deployment, the Google Business
// Profile connection and its last error, and the NFC record sizes. All
// derived from the company row plus env; one round trip for one screen,
// and every "not set up yet" sentence on it is a fact the server stated.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { normaliseWebsiteUrl } from "@/lib/signup/website";
import { validReviewUrl, clampDelay, MAX_DELAY_HOURS } from "@/lib/reviews/request";
import { reviewUrlForPlaceId, looksLikePlaceId, placeLabel } from "@/lib/reviews/googlePlace";
import { cardUrl } from "@/lib/reviews/card";
import { cardTapCounts } from "@/lib/reviews/cardTaps";
import { loadCardData, cardVCards } from "@/lib/reviews/cardData";
import { ndefSize, tagThatFits, NTAG215_BYTES } from "@/lib/reviews/vcard";
import { appleWalletConfigured, appleWalletMissing, googleWalletConfigured, googleWalletMissing } from "@/lib/reviews/wallet/config";
import { googleCalendarConfigured, googleCalendarMissing } from "@/lib/calendar/googleClient";
import { getBusinessConnection, publicBusinessShape } from "@/lib/reviews/googleBusiness/connection";

const HOUR = 60 * 60 * 1000;

const SELECT = {
  reviewUrl: true,
  reviewDelayHours: true,
  reviewRequestsEnabled: true,
  googlePlaceId: true,
  googlePlaceLabel: true,
  invoiceReviewQr: true,
  slug: true,
  bookingSlug: true,
  name: true,
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: SELECT,
  });

  // Who is currently in the queue, and who was asked recently. Both counts are
  // derived from the same columns the cron reads, so they can't drift from
  // what will actually happen.
  const [waiting, askedRecently, connection, taps] = await Promise.all([
    db.job.count({
      where: {
        companyId: member.companyId,
        status: "completed",
        reviewRequestedAt: null,
        completedAt: {
          not: null,
          gte: new Date(Date.now() - MAX_DELAY_HOURS * HOUR),
        },
        client: { email: { not: null } },
      },
    }),
    db.job.count({
      where: {
        companyId: member.companyId,
        reviewRequestedAt: { gte: new Date(Date.now() - 30 * 24 * HOUR) },
      },
    }),
    getBusinessConnection(member.companyId),
    cardTapCounts(member.companyId),
  ]);

  const origin = getAppOrigin(request);
  const slug = company?.bookingSlug || company?.slug || "";
  const card = slug ? await loadCardData(slug, { origin }) : null;
  const vcards = card ? cardVCards(card, { origin }) : { full: null, compact: null };
  const compact = vcards.compact;

  const { slug: _s, bookingSlug: _b, name: _n, ...settings } = company || {};
  return NextResponse.json({
    ...settings,
    waiting,
    askedRecently,
    card: slug
      ? {
          url: cardUrl(origin, slug),
          qrUrl: cardUrl(origin, slug, "qr"),
          nfcUrl: cardUrl(origin, slug, "nfc"),
          stickerUrl: cardUrl(origin, slug, "sticker"),
          vcfUrl: `${cardUrl(origin, slug)}/contact.vcf`,
          taps,
        }
      : null,
    nfc: compact
      ? {
          vcard: compact,
          bytes: ndefSize(compact),
          tag: tagThatFits(compact),
          ntag215Bytes: NTAG215_BYTES,
        }
      : null,
    wallet: {
      apple: { configured: appleWalletConfigured(), missing: appleWalletMissing() },
      google: { configured: googleWalletConfigured(), missing: googleWalletMissing() },
    },
    googleBusiness: {
      configured: googleCalendarConfigured(),
      missing: googleCalendarMissing(),
      connection: publicBusinessShape(connection),
    },
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate every other settings route uses. There is no `settings:edit`
  // permission — `user:manage` is the admin role in this codebase.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can change review settings" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const data = {};

  if (body.reviewUrl !== undefined) {
    // "g.page/r/.../review" pasted without a scheme gains https:// (the
    // signup's reader, lib/signup/website.js) rather than being refused.
    const typed = typeof body.reviewUrl === "string" ? body.reviewUrl.trim() : "";
    const url = (typed && normaliseWebsiteUrl(typed)) || typed;
    if (url && !validReviewUrl(url)) {
      // Refused with a sentence rather than silently stored. A link that
      // doesn't work is only discovered by the customer who clicks it, weeks
      // later, and by then the ask has been spent.
      return NextResponse.json(
        { error: "That doesn't look like a working link. It should start with https://" },
        { status: 400 },
      );
    }
    data.reviewUrl = url || null;
    // A hand-typed link replaces the listing: the two must not disagree
    // about where customers are sent, and the typed one is the later choice.
    data.googlePlaceId = null;
    data.googlePlaceLabel = null;
  }

  // ── The Google listing ───────────────────────────────────────────────────
  //
  // { googlePlaceId, googlePlaceName, googlePlaceAddress } from the Places
  // box on the screen. The review link is DERIVED here from the id — the
  // browser never sends the URL, only what Google returned — and stored in
  // the same reviewUrl column everything downstream reads. `googlePlaceId:
  // null` is "not my business": the listing and the derived link both go.
  if (body.googlePlaceId !== undefined) {
    if (body.googlePlaceId === null || body.googlePlaceId === "") {
      data.googlePlaceId = null;
      data.googlePlaceLabel = null;
      data.reviewUrl = null;
    } else {
      if (!looksLikePlaceId(body.googlePlaceId)) {
        return NextResponse.json({ error: "That doesn't look like a Google listing." }, { status: 400 });
      }
      const id = String(body.googlePlaceId).trim();
      data.googlePlaceId = id;
      data.googlePlaceLabel = placeLabel({ name: body.googlePlaceName, address: body.googlePlaceAddress });
      data.reviewUrl = reviewUrlForPlaceId(id);
    }
  }

  if (body.invoiceReviewQr !== undefined) {
    data.invoiceReviewQr = Boolean(body.invoiceReviewQr);
  }

  if (body.reviewDelayHours !== undefined) {
    data.reviewDelayHours = clampDelay(body.reviewDelayHours);
  }

  if (body.reviewRequestsEnabled !== undefined) {
    const on = Boolean(body.reviewRequestsEnabled);
    // Can't switch it on with nowhere to send people. Checked against what's
    // being saved in THIS request first, then what's already stored — so
    // setting the link and the toggle together works, and flipping the toggle
    // alone on an empty link is refused instead of quietly doing nothing.
    if (on) {
      const url = data.reviewUrl !== undefined
        ? data.reviewUrl
        : (await db.company.findUnique({
            where: { id: member.companyId },
            select: { reviewUrl: true },
          }))?.reviewUrl;
      if (!validReviewUrl(url)) {
        return NextResponse.json(
          { error: "Add the link where customers should leave a review first." },
          { status: 400 },
        );
      }
    }
    data.reviewRequestsEnabled = on;
  }

  // Clearing the link while the ask is on would leave a switch that says On
  // and a cron with nowhere to send anyone. The switch goes off with it.
  if (data.reviewUrl === null && data.reviewRequestsEnabled === undefined) {
    data.reviewRequestsEnabled = false;
  }
  // Same for the invoice QR: no link, no QR — the footer refuses to draw one
  // anyway, but the switch must not sit On over nothing.
  if (data.reviewUrl === null && data.invoiceReviewQr === undefined) {
    data.invoiceReviewQr = false;
  }
  // And the QR switch cannot be turned on over an empty link, for the same
  // reason the ask cannot.
  if (data.invoiceReviewQr === true) {
    const url = data.reviewUrl !== undefined
      ? data.reviewUrl
      : (await db.company.findUnique({ where: { id: member.companyId }, select: { reviewUrl: true } }))?.reviewUrl;
    if (!validReviewUrl(url)) {
      return NextResponse.json(
        { error: "Add the link where customers should leave a review first." },
        { status: 400 },
      );
    }
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const company = await db.company.update({
    where: { id: member.companyId },
    data,
    select: SELECT,
  });

  await recordActivity(member, {
    action: "settings.reviews.updated",
    entityType: "company",
    entityId: member.companyId,
    summary: data.reviewRequestsEnabled === false
      ? "Turned off automatic review requests"
      : data.googlePlaceId
        ? "Linked the Google listing for reviews"
        : "Updated review request settings",
    metadata: data,
  });

  const { slug: _s, bookingSlug: _b, name: _n, ...settings } = company;
  return NextResponse.json(settings);
}
