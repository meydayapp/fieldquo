// app/api/settings/links/route.js
//
// Read and write the bio-link page.
//
// The GET returns the SAME resolved list the public page renders, out of the
// same loader — see lib/links/load.js for why that matters. A settings screen
// whose preview is assembled separately from the page it configures is a
// screen that will eventually lie, and this one's whole output is a URL the
// contractor pastes somewhere they can't take back.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { loadLinkPageDataForCompany } from "@/lib/links/load";
import { sanitiseLinkConfig, resolveLinks } from "@/lib/links/config";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const data = await loadLinkPageDataForCompany(member.companyId);
  if (!data) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const { company, config, candidates } = data;
  return NextResponse.json({
    // The slug the public page resolves on, so the screen can build the URL
    // against its own origin rather than one this route guesses from headers.
    slug: company.bookingSlug || company.slug,
    published: config.published,
    headline: config.headline,
    bio: config.bio,
    companyName: company.name,
    // Disabled rows included: they are what the switches switch.
    links: resolveLinks(candidates, config),
    // Why a link a contractor might expect ISN'T here. Without this the screen
    // is silent about the absence, and silence reads as a missing feature
    // rather than as "you have no bookable event types yet".
    unavailable: unavailableReasons(candidates, company),
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate every other settings route uses — there is no
  // `settings:edit` permission; `user:manage` is the admin role here.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can change the bio link page" },
      { status: 403 },
    );
  }

  const data = await loadLinkPageDataForCompany(member.companyId);
  if (!data) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  // Sanitise first, then drop overrides for links that don't exist. Storing
  // them would let the row accumulate references to funnels deleted years ago
  // — harmless to render (resolveLinks ignores them) and confusing to anyone
  // who ever reads the column.
  const clean = sanitiseLinkConfig(body);
  const known = new Set(data.candidates.map((c) => c.key));
  clean.items = clean.items.filter(
    (i) => i.key.startsWith("custom:") || known.has(i.key),
  );

  const row = {
    published: clean.published,
    headline: clean.headline || null,
    bio: clean.bio || null,
    items: clean.items,
  };

  await db.linkPage.upsert({
    where: { companyId: member.companyId },
    create: { companyId: member.companyId, ...row },
    update: row,
  });

  await recordActivity(member, {
    action: "settings.linkPage.updated",
    entityType: "company",
    entityId: member.companyId,
    summary: clean.published
      ? `Updated the bio link page (${clean.items.filter((i) => i.enabled !== false).length} links on)`
      : "Took the bio link page down",
    metadata: row,
  });

  // Re-read rather than echoing what was sent: the caller must see what is
  // stored, including anything the sanitiser refused.
  const fresh = await loadLinkPageDataForCompany(member.companyId);
  return NextResponse.json({
    slug: fresh.company.bookingSlug || fresh.company.slug,
    published: fresh.config.published,
    headline: fresh.config.headline,
    bio: fresh.config.bio,
    companyName: fresh.company.name,
    links: resolveLinks(fresh.candidates, fresh.config),
    unavailable: unavailableReasons(fresh.candidates, fresh.company),
  });
}

/**
 * The links that could exist and don't, and what would make them exist.
 *
 * Each entry names a screen rather than a state, because "no bookable times"
 * is a fact and "set up an event type in Booking Page" is an action.
 */
function unavailableReasons(candidates, company) {
  const have = new Set(candidates.map((c) => c.key));
  const out = [];

  if (!have.has("book")) {
    out.push({
      key: "book",
      reason: "No bookable times yet — add one in Settings → Booking Page.",
    });
  }
  if (!have.has("instant")) {
    out.push({
      key: "instant",
      reason: "No instant estimator switched on — Settings → Instant Quotes.",
    });
  }
  if (!have.has("site")) {
    out.push({
      key: "site",
      reason: "No published website — Settings → Website, or add one in Company Settings.",
    });
  }
  if (!have.has("whatsapp")) {
    out.push({
      key: "whatsapp",
      reason: company.phone
        ? "WhatsApp needs the number in international form (+1 819 555 0123) — or add your wa.me link as a custom link below."
        : "Add a phone number in Company Settings.",
    });
  }
  if (!have.has("review")) {
    out.push({
      key: "review",
      reason: "No review link — add one in Settings → Reviews.",
    });
  }
  return out;
}
