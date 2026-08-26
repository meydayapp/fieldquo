// app/api/settings/quote-email/route.js
//
// The company-level defaults for the two optional quote-email sections:
// the past clients who agreed to take a call, and the before/after pairs.
//
// Separate from /api/settings/business-info because that route is already a
// sixty-field allowlist and these are a different concern — but the shape is
// the same one every settings route in this app uses: GET returns the current
// values, PATCH saves only the keys that were sent.
//
// Nothing here deletes a Cloudinary asset when a pair is removed. The branding
// route does that for the logo, and it is right to: a logo has exactly one
// place it can be used. A photo does not — the same upload can sit in the
// website gallery — so removing a pair here removes the PAIR, and the file
// stays. An orphaned image costs storage; a deleted one takes a hole out of a
// published website.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  QUOTE_EMAIL_SECTIONS,
  QUOTE_EMAIL_SECTION_KEYS,
  QUOTE_EMAIL_COMPANY_SELECT,
  sanitiseSectionItems,
} from "@/lib/quotes/emailSections";

/**
 * The stored values, cleaned on the way out as well as on the way in.
 *
 * A row written before a sanitiser tightened would otherwise show in the
 * editor as valid and then vanish from the email, which is the two-sources-of-
 * truth problem this codebase keeps finding. What the settings page shows is
 * what the email would print.
 */
function present(company = {}) {
  const out = {};
  for (const key of QUOTE_EMAIL_SECTION_KEYS) {
    const meta = QUOTE_EMAIL_SECTIONS[key];
    out[key] = {
      include: Boolean(company[meta.companyIncludeField]),
      max: meta.max,
      items: sanitiseSectionItems(key, company[meta.companyItemsField]),
    };
  }
  return out;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: QUOTE_EMAIL_COMPANY_SELECT,
  });

  return NextResponse.json(present(company || {}));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can change the quote email." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  const changed = [];

  for (const key of QUOTE_EMAIL_SECTION_KEYS) {
    const meta = QUOTE_EMAIL_SECTIONS[key];
    const patch = body[key];
    if (!patch || typeof patch !== "object") continue;

    if ("items" in patch) {
      if (!Array.isArray(patch.items)) {
        return NextResponse.json(
          { error: `${key}.items must be an array.` },
          { status: 400 },
        );
      }
      // Rows that can't be shown are dropped rather than repaired — see the
      // sanitisers for why half a reference is worse than one fewer. The
      // response returns what was actually kept, so the page can re-render
      // from the truth instead of from what it hoped it sent.
      data[meta.companyItemsField] = sanitiseSectionItems(key, patch.items).slice(
        0,
        meta.max,
      );
      changed.push(meta.companyItemsField);
    }

    if ("include" in patch) {
      if (typeof patch.include !== "boolean") {
        return NextResponse.json(
          { error: `${key}.include must be true or false.` },
          { status: 400 },
        );
      }
      data[meta.companyIncludeField] = patch.include;
      changed.push(meta.companyIncludeField);
    }
  }

  if (!changed.length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data,
    select: QUOTE_EMAIL_COMPANY_SELECT,
  });

  await recordActivity(member, {
    action: "settings.quote_email_updated",
    entityType: "company",
    entityId: member.companyId,
    summary: "Updated the optional sections on the quote email",
    metadata: { changed },
  });

  return NextResponse.json(present(updated));
}
