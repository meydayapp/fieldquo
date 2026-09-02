// app/api/self-quote/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { normaliseMediaList } from "@/lib/media/validate";
import { createScoredLead } from "@/lib/leads/createLead";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { publicIntakeFields } from "@/app/data/quoteIntakeFields";
import { resolveRequestedLanguage } from "@/lib/company/sendLanguages";
import { buildSelfQuoteEmail } from "@/lib/email/selfQuoteEmail";
import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";

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
    // The structured halves of that address, straight off Google Places. The
    // form used to send the formatted string alone, so a lead carried
    // "…, Gatineau, QC J8T 2S9, Canada" as prose and the client it converted
    // into had no jurisdiction at all — see lib/tax/documentTax.js. Ride in
    // `intake` rather than as Lead columns: convertLead already seeds the
    // client's address from there, and LeadRequest needs no new schema.
    city,
    province,
    country,
    categoryId,
    description,
    // Answers to the intake fields the public form showed — { key: value }.
    // Kept structured so whoever picks the lead up can see "40 doors" rather
    // than reading it out of a paragraph.
    details,
    // The two universal qualifiers (validated to known keys server-side).
    budgetBand,
    timeline,
    // The language the homeowner picked on the form. Was destructured here and
    // then dropped — the pick changed the words on screen and nothing else.
    // Now validated against the company's send languages and FIXED on the lead,
    // so the quote it converts into is CREATED in it rather than written in the
    // contractor's language and translated later (AGENTS.md non-negotiable 6).
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

  // findBookingCompany, not findUnique({ slug }) — the GET that RENDERED this
  // form resolves either slug, so a company with a custom bookingSlug got a
  // form that loaded fine and a Send button that 404'd. Same resolver on both
  // halves of one round trip.
  const company = await findBookingCompany(companySlug);
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The language the homeowner chose on the form, kept only if the company
  // actually sends in it — the same list the GET offered, from the same helper,
  // so the form can never offer an option this route then quietly discards.
  const docLanguage = resolveRequestedLanguage(company, language);

  const clientMedia = normaliseMediaList(media);

  // Address lives in the structured intake too, so a converted quote can seed
  // the client's address without re-parsing the message blob.
  //
  // Only keys that actually arrived are written. A homeowner who typed their
  // address by hand instead of picking a suggestion has no province, and
  // storing `province: null` beside a real address invites a later reader to
  // treat the absence as an answer.
  const jurisdiction = {
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(province ? { province } : {}),
    ...(country ? { country } : {}),
  };
  const intake =
    details && typeof details === "object"
      ? { ...details, ...jurisdiction }
      : Object.keys(jurisdiction).length
        ? jurisdiction
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
    language: docLanguage,
  });

  // ── The confirmation ──────────────────────────────────────────────────────
  //
  // There wasn't one. A homeowner typed their name, their number and a
  // description of their kitchen into a stranger's form and got nothing in
  // writing — the only acknowledgement was a screen they then closed.
  //
  // It goes out on the company's stationery, in the language the LEAD was
  // created in, and carries no price: nothing here has been costed by a person
  // and this endpoint has no rates to leak. Best-effort, exactly like the
  // instant-quote confirmation — a mail hiccup must not fail the request the
  // homeowner just made, because the lead is already saved and the screen has
  // already told them so.
  if (email) {
    try {
      const { subject, html, text } = buildSelfQuoteEmail({
        company,
        contact: { name, email, phone, address },
        service: await publicServiceFor(company.id, categoryId),
        details,
        description,
        budgetBand: lead.budgetBand,
        timeline: lead.timeline,
        language: docLanguage,
        submittedAt: lead.createdAt,
      });
      await sendEmail({
        companyId: company.id,
        to: email,
        subject,
        html,
        text,
        ...(await resolveSender(company, company.id)),
      });
    } catch (err) {
      console.error("[self-quote] confirmation email failed:", err?.message);
    }
  }

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

  return NextResponse.json(
    {
      success: true,
      id: lead.id,
      // The confirmation SCREEN composes itself from what the browser already
      // typed, so nothing about the job comes back here. These two are the
      // facts only the server knows: when it landed, and whether a copy is
      // actually on its way. The page used to promise neither, and a page that
      // says "check your email" when no mail was sent is the dead-control
      // failure in written form.
      submittedAt: lead.createdAt,
      emailed: Boolean(email),
      language: docLanguage,
    },
    { status: 201 },
  );
}

/**
 * The service label and field labels for the category the homeowner picked.
 *
 * Same gate as the GET that rendered the form — enabled categories only, the
 * same first-three number/select fields — so the confirmation email can name
 * "Doors: 40" instead of "doorCount: 40" without widening what this endpoint
 * treats as public. No rates are read here and none exist on these rows.
 */
async function publicServiceFor(companyId, categoryId) {
  if (!categoryId) return null;

  const enabled = await db.companyServiceCategory.findFirst({
    where: { companyId, enabled: true, categoryId },
    select: { category: { select: { key: true, label: true } } },
  });
  if (!enabled?.category) return null;

  return {
    label: enabled.category.label,
    fields: publicIntakeFields(enabled.category.key).map((f) => ({
      key: f.key,
      label: f.label,
    })),
  };
}
