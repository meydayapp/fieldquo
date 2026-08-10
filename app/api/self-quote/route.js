// app/api/self-quote/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { normaliseMediaList } from "@/lib/media/validate";
import { createScoredLead } from "@/lib/leads/createLead";

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
 * Builds the readable LeadRequest.message. The structured answers are ALSO kept
 * verbatim in LeadRequest.intake now (scoring and quote conversion need typed
 * values), but the message stays because staff read prose faster than JSON.
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
  // Public and unauthenticated — same throttle as the other lead intakes, so a
  // script can't fill a contractor's pipeline with invented enquiries.
  const limited = rateLimit(request, "self-quote");
  if (limited) return limited;

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
    // The two universal qualifiers (validated to known keys server-side).
    budgetBand,
    timeline,
    language,
    // Photos/videos attached in the browser. Re-normalised below, never trusted.
    media,
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

  const clientMedia = normaliseMediaList(media);

  // Address lives in the structured intake too, so a converted quote can seed
  // the client's address without re-parsing the message blob.
  const intake =
    details && typeof details === "object"
      ? { ...details, ...(address ? { address } : {}) }
      : address
        ? { address }
        : null;

  const lead = await createScoredLead({
    companyId: company.id,
    name,
    email,
    phone,
    categoryId,
    message: buildMessage({ address, description, details }),
    source: "self_quote",
    clientPhotos: clientMedia,
    intake,
    budgetBand,
    timeline,
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
