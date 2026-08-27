// app/api/quotes/[id]/email-sections/route.js
//
// The two optional sections of THIS quote's email: references and
// before/after photos.
//
// ── Why a route of its own rather than fields on PATCH /api/quotes/[id] ─────
//
// Because of what the send gate does with it. When a send is refused for an
// empty section, the 409 hands the UI a ready-made action — "remove this
// section from this quote" — as a URL and a body (see `sectionActions` in
// lib/quotes/emailSections.js). That has to be an endpoint that does exactly
// one small thing and cannot accidentally carry a stale copy of the quote's
// line items along with it, which is what firing the general quote PATCH from
// an error dialog would risk.
//
// ── null is not false ──────────────────────────────────────────────────────
//
// The include flags are tri-state. `null` means "follow the company default",
// which is how a company that adds references next month gets them on the
// drafts already in the pipeline. The UI offers all three; this route accepts
// all three, and refuses anything else rather than coercing — `Boolean("no")`
// is true, and a coerced answer here is a section on a client's email that
// nobody chose.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  QUOTE_EMAIL_SECTIONS,
  QUOTE_EMAIL_SECTION_KEYS,
  QUOTE_EMAIL_COMPANY_SELECT,
  QUOTE_EMAIL_QUOTE_SELECT,
  resolveQuoteEmailSections,
  emptyIncludedSections,
  sanitiseSectionItems,
  sectionActions,
} from "@/lib/quotes/emailSections";

async function load(member, id) {
  const [quote, company] = await Promise.all([
    db.quote.findFirst({
      where: { id, companyId: member.companyId },
      select: { id: true, quoteNumber: true, ...QUOTE_EMAIL_QUOTE_SELECT },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: QUOTE_EMAIL_COMPANY_SELECT,
    }),
  ]);
  return { quote, company: company || {} };
}

/**
 * What this quote's email would carry, and where each answer came from.
 *
 * `companyDefault` rides along so the panel can say "on for every quote" as
 * opposed to "on for this one" — the difference between inheriting a policy
 * and having made a decision, which a toggle alone cannot show.
 */
function present(company, quote) {
  const resolved = resolveQuoteEmailSections({ company, quote });
  const empty = emptyIncludedSections(resolved);

  return {
    quoteId: quote.id,
    sections: QUOTE_EMAIL_SECTION_KEYS.map((key) => {
      const meta = QUOTE_EMAIL_SECTIONS[key];
      return {
        key,
        included: resolved[key].included,
        inherited: resolved[key].inherited,
        source: resolved[key].source,
        items: resolved[key].items,
        companyDefault: Boolean(company[meta.companyIncludeField]),
        companyItemCount: sanitiseSectionItems(
          key,
          company[meta.companyItemsField],
        ).length,
        // The thing the send gate will refuse on. Surfaced BEFORE the send so
        // the panel can warn while there is still time, rather than only at
        // the moment someone presses the button.
        blocksSend: empty.includes(key),
      };
    }),
    blocked: empty,
    // The SAME shape the send route's 409 carries, built from the same
    // helper. The "Save & Send" path on the quote builder redirects here when
    // a send is refused, and the blocked dialog on this page needs the two
    // actions to offer — reconstructing them in the browser is how the
    // dialog and the gate would come to disagree about which column "remove"
    // writes to.
    blockedDetail: empty.map((key) => ({
      key,
      labelKey: QUOTE_EMAIL_SECTIONS[key].labelKey,
      emptyKey: QUOTE_EMAIL_SECTIONS[key].emptyKey,
      actions: sectionActions(key, quote.id),
    })),
  };
}

export async function GET(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Reading what a quote's covering email says is reading the quote.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  const { quote, company } = await load(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(present(company, quote));
}

// null | true | false, and nothing else. See the header.
function readTriState(value) {
  if (value === null || value === true || value === false)
    return { ok: true, value };
  return { ok: false };
}

export async function PATCH(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same weight as editing the quote: this decides what a client reads.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "edit quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { quote, company } = await load(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};
  const changed = [];

  for (const key of QUOTE_EMAIL_SECTION_KEYS) {
    const meta = QUOTE_EMAIL_SECTIONS[key];

    if (meta.quoteIncludeField in body) {
      const parsed = readTriState(body[meta.quoteIncludeField]);
      if (!parsed.ok) {
        return NextResponse.json(
          {
            error: `${meta.quoteIncludeField} must be true, false, or null (follow the company default).`,
          },
          { status: 400 },
        );
      }
      data[meta.quoteIncludeField] = parsed.value;
      changed.push(meta.quoteIncludeField);
    }

    if (meta.quoteItemsField in body) {
      const raw = body[meta.quoteItemsField];
      // null clears the override and hands the section back to the company
      // list. An array — including an empty one — is this quote's own answer,
      // and an empty one is allowed to be SAVED: someone mid-edit has not made
      // a mistake. It is only refused at SEND, which is the moment it would
      // reach a client.
      if (raw === null) {
        data[meta.quoteItemsField] = null;
      } else if (Array.isArray(raw)) {
        data[meta.quoteItemsField] = sanitiseSectionItems(key, raw).slice(
          0,
          meta.max,
        );
      } else {
        return NextResponse.json(
          { error: `${meta.quoteItemsField} must be an array, or null to use the company list.` },
          { status: 400 },
        );
      }
      changed.push(meta.quoteItemsField);
    }
  }

  if (!changed.length) {
    return NextResponse.json(
      { error: "Nothing to change." },
      { status: 400 },
    );
  }

  const updated = await db.quote.update({
    where: { id: quote.id },
    data,
    select: { id: true, quoteNumber: true, ...QUOTE_EMAIL_QUOTE_SELECT },
  });

  await recordActivity(member, {
    action: "quote.email_sections_changed",
    entityType: "quote",
    entityId: quote.id,
    summary: `Changed the email sections on quote ${quote.quoteNumber}`,
    metadata: { changed },
  });

  return NextResponse.json(present(company, updated));
}
