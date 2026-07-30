// app/api/self-quote/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

import { recordConsent } from "@/lib/voice/outbound";
import { DISCLOSURE } from "@/lib/voice/disclosure";
// Public — a website visitor requesting a quote through an embeddable widget,
// identified by companySlug. This is functionally very close to /api/leads/public
// (both create a LeadRequest); the distinction from TrueFinish is that self-quote
// captures more structured intake (service category + rough details) meant to feed
// straight into building a draft Quote, vs. leads/public being a lighter "call me back"
// form. If your actual usage ends up identical, these two should probably merge —
// worth revisiting once you see which one companies actually embed on their sites.
/**
 * Flattens the structured answers into LeadRequest.message.
 *
 * LeadRequest has no field for arbitrary intake, and adding one would mean a
 * migration for something only this form produces. Formatting it as readable
 * lines keeps the leads list useful without inventing schema — and if this
 * form earns its keep, that's the moment to give it a real column.
 */
function buildMessage({ address, description, details }) {
  const answers =
    details && typeof details === "object"
      ? Object.entries(details)
          .filter(([, v]) => v !== "" && v !== null && v !== undefined)
          .map(([k, v]) => `${humanise(k)}: ${v}`)
      : [];

  return (
    [address, description, answers.join("\n")].filter(Boolean).join("\n\n") ||
    null
  );
}

function humanise(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export async function POST(request) {
  const body = await request.json();
  const {
    companySlug,
    name,
    email,
    phone,
    address,
    categoryId,
    description,
    // Answers to the intake fields the public form showed — { key: value }.
    // Kept structured so whoever picks the lead up can see "40 doors" rather
    // than reading it out of a paragraph.
    details,
    language,
  } = body;

  if (!companySlug || !name || (!email && !phone)) {
    return NextResponse.json(
      {
        error:
          "companySlug, name, and at least one of email/phone are required",
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { slug: companySlug } });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await db.leadRequest.create({
    data: {
      companyId: company.id,
      name,
      email: email || null,
      phone: phone || null,
      categoryId: categoryId || null,
      message: buildMessage({ address, description, details }),
      source: "self_quote",
    },
  });

  // Same as every other inbound form: they gave a number expecting a reply, so
  // that's consent to ring them. See lib/voice/outbound.js.
  if (phone) {
    await recordConsent({
      companyId: company.id,
      phone,
      source: "self_quote",
      disclosure: DISCLOSURE.lead,
      leadId: lead.id,
    }).catch((err) => console.error("[self-quote] consent not recorded:", err));
  }

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
