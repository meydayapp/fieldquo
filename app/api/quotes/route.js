// app/api/quotes/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { getNextQuoteNumber } from "@/lib/quotes/quoteNumber";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMediaList } from "@/lib/media/validate";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactQuotes,
  redactQuote,
} from "@/lib/permissions/enforce";
import {
  buildQuoteCostingRow,
  shouldWriteQuoteCosting,
  mayCost,
  requireCost,
} from "./costingWrite";
import { syncTakeoffAddOns } from "@/lib/quotes/takeoffAddOns";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The floor of this ladder used to BE view_only, so reading was open to
  // everyone the route could reach. It no longer is: a member at quotes:none is
  // refused here rather than handed a redacted list, because the grid says they
  // may not see the documents at all — an empty list would be a lie about how
  // many quotes the company has.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const quotes = await db.quote.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      scopeGroups: { include: { category: { select: { label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Shaped before it leaves. Two things travel on a quote that the grid has
  // an opinion about: the nested client (email and phone, which the clients
  // route now hides) and shareToken, which resolves to a credential-free
  // public page showing the price. QA read that token as an employee with
  // showPricing:false and opened the priced document logged out.
  return NextResponse.json(redactQuotes(full, quotes));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Granular check. Previously this route trusted the coarse role alone, so a
  // member configured as "Quotes: view only" could still create quotes —
  // PERMISSIONS.employee includes "quote:create". The grid said no; the API
  // said yes.
  //
  // Hoisted out of the try because the costing block below needs the same
  // member to answer a different question, and loading it twice would be two
  // round trips to learn one thing.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "create quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  try {
    await requireWithinLimit(member.companyId, "quotes");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 402 },
    );
  }

  const body = await request.json();
  const {
    clientId,
    quoteType,
    // Active build time reported by the browser. Trusted only within a sane
    // range and otherwise dropped — it is a product metric, not a control, so
    // the cost of a bad value is a skewed average rather than a security
    // problem. Clamped rather than rejected so a weird client doesn't fail the
    // save of a real quote.
    composeSeconds,
    scopeGroups,
    subtotal,
    discount,
    tax,
    total,
    // The flag, not just the amount. See the note in [id]/route.js: this column
    // was read by the edit page and by the public quote route, and written by
    // nothing, so the "Apply tax" checkbox never survived a save.
    taxEnabled,
    notes,
    // Internal, and never on the document. What a caller asked for that the
    // draft could not place — see the Quote.reviewNotes comment in the schema.
    reviewNotes,
    // What happens next, per quote. The company's default is still what the box
    // OPENS with — see the copy below — but the builder now lets it be edited
    // before the first save instead of only afterwards on the edit route, which
    // is where the two screens had drifted apart.
    processNotes,
    validUntil,
    language,
    // Photos of the job. Previously only ever set by lead intake, so a quote
    // typed up by staff had no way to carry the pictures the estimator took.
    clientPhotos,
    // The internal cost estimate — crew, their share of the predicted hours,
    // the estimator's own additions. Never part of the document a client sees;
    // see the QuoteCosting model for why it is a separate row.
    costing,
    // ── The call this quote came out of ─────────────────────────────────
    //
    // The builder opens with `?fromCall=<voiceCallId>` and prefills the scope
    // FieldQuo AI read off the recording — and then saved a quote with no link
    // back to it. Two things depended on that link and quietly did not work:
    // the recording button on the quote (callRecordingHref reads
    // Quote.sourceCallId), and the receptionist screen archiving a call once
    // its quote exists, which is derived from this column precisely so a
    // deleted quote puts the call back on the list.
    //
    // Validated below against the caller's own company — a call id is a
    // reference to a customer's recording, and one from another tenant must not
    // be attachable to a quote here.
    sourceCallId,
  } = body;

  // Scoped before it is trusted. findFirst with the companyId in the WHERE, so
  // an id from another tenant resolves to nothing rather than to their call.
  const verifiedSourceCallId =
    typeof sourceCallId === "string" && sourceCallId
      ? (
          await db.voiceCall.findFirst({
            where: { id: sourceCallId, companyId: member.companyId },
            select: { id: true },
          })
        )?.id || null
      : null;

  if (!clientId || total === undefined) {
    return NextResponse.json(
      { error: "clientId and total are required" },
      { status: 400 },
    );
  }

  // The clientId arrives from a browser and was written straight onto the
  // quote. Posting another tenant's client id built a quote inside THIS
  // company pointing at THEIR client — and every GET on it returns
  // `client`, so the address book crossed the boundary one quote at a time.
  // Sending that quote would then email their client on this company's
  // letterhead. See lib/tenant/ownedIds.js.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    clientId,
  });
  if (notOurs) return notOurs;

  const [lastQuote, company] = await Promise.all([
    db.quote.findFirst({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      select: { quoteNumber: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultProcessNotes: true },
    }),
  ]);
  const quoteNumber = getNextQuoteNumber(lastQuote?.quoteNumber);

  try {
    // A costing block from someone without the toggle used to be dropped right
    // below and the save answered 200 — the panel's contents gone, nothing
    // said. See requireCost: silence stays silence, an actual block is
    // refused.
    if (costing !== undefined) requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Costed against the pre-tax subtotal minus any discount — the money the
  // work has to come out of. Tax is the government's, not the job's.
  //
  // `undefined` means the request said nothing about costing. On a create that
  // simply means no row; the distinction matters on the PATCH, where it means
  // "leave the existing one alone".
  const costingRow =
    costing !== undefined && mayCost(full)
      ? await buildQuoteCostingRow({
          companyId: member.companyId,
          costing,
          price: (Number(subtotal) || 0) - (Number(discount) || 0),
          scopeGroups,
        })
      : null;

  const quote = await db.quote.create({
    data: {
      // Null unless the browser reported something plausible. Absence is not
      // zero: a quote created by an API client or an older page carries no
      // claim about how long it took, and summariseComposeTimes drops nulls
      // rather than averaging them in as instant.
      composeSeconds:
        Number.isFinite(Number(composeSeconds)) &&
        Number(composeSeconds) > 0 &&
        Number(composeSeconds) <= 2700
          ? Math.round(Number(composeSeconds))
          : null,
      companyId: member.companyId,
      // The call this quote came out of, only when it really is this company's.
      // Omitted rather than set null, so the automatic estimate path's own id
      // is never overwritten by a hand save that didn't carry one.
      ...(verifiedSourceCallId ? { sourceCallId: verifiedSourceCallId } : {}),
      quoteNumber,
      clientId,
      createdById: member.userId,
      quoteType: quoteType || null,
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      // Default true only when the client didn't say — matching the column's own
      // default. `taxEnabled: false` must not be read as "unset".
      taxEnabled: taxEnabled === undefined ? true : Boolean(taxEnabled),
      total,
      notes: notes || null,
      reviewNotes: reviewNotes || null,
      // COPIED onto the quote, not referenced from the company. A quote sent
      // in March must keep saying what it said in March even after the terms
      // change — reading the live company record would silently rewrite the
      // history of every document ever sent.
      //
      // The request wins when it says something, so an estimator who tailored
      // the wording on the builder keeps their version. Silence still means the
      // company default: an API client that has never heard of this field must
      // not end up creating quotes with no terms on them.
      processNotes:
        processNotes !== undefined
          ? processNotes || null
          : company?.defaultProcessNotes || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      language: language || "en",
      // Same boundary the public self-quote intake uses — the browser sends
      // URLs, and these end up on a document a homeowner opens, so nothing
      // reaches the column that isn't an https media entry we recognise.
      ...(clientPhotos !== undefined && {
        clientPhotos: normaliseMediaList(clientPhotos),
      }),
      ...(scopeGroups?.length && {
        scopeGroups: {
          create: scopeGroups.map((g, i) => ({
            categoryId: g.categoryId,
            label: g.label || null,
            lineItems: g.lineItems || null,
            // The structured takeoff behind those lines, when the trade has
            // one. Stored so the form can be reopened; lineItems above stays
            // what is billed.
            takeoff: g.takeoff ?? null,
            // What the recipe-based cost estimate is derived from. See the
            // QuoteScopeGroup model.
            intakeValues: g.intakeValues ?? null,
            subtotal: g.subtotal || 0,
            sortOrder: i,
          })),
        },
      }),
      // Only when the estimator said something. A row of zeroes would put a
      // "costed at 0% margin" card on a quote nobody costed. A brand-new quote
      // has no existing row, which is what makes an empty panel mean nothing
      // here and a deletion on the PATCH — see shouldWriteQuoteCosting.
      ...(shouldWriteQuoteCosting({
        costingSent: costing !== undefined,
        may: mayCost(full),
        hasExistingRow: false,
        row: costingRow,
      }) && { costing: { create: costingRow } }),
    },
    include: { client: true, scopeGroups: true },
  });

  // Optional areas and substrates on a takeoff become tickable extras. Derived
  // server-side from the stored takeoff and this company's rate card — see
  // lib/quotes/takeoffAddOns.js. Best-effort: the quote is committed, and a
  // failure to write the offers must not report the save as failed.
  if (scopeGroups?.length) {
    try {
      await syncTakeoffAddOns({
        companyId: member.companyId,
        quoteId: quote.id,
        scopeGroups,
      });
    } catch (err) {
      console.error("[quotes POST] takeoff add-ons:", err?.message);
    }
  }

  await recordActivity(member, {
    action: "quote.created",
    entityType: "quote",
    entityId: quote.id,
    summary: `Created quote ${quote.quoteNumber} for ${quote.client?.name || "a client"}`,
    metadata: { total: quote.total },
  });

  // Redacted like GET beside it. Creating a quote needs quotes/view_create_edit
  // and says nothing about clientsProperties, so an estimator restricted to
  // name-and-address reaches here — and read the client's email back out of
  // their own save. Same shape as the bug already fixed on PATCH
  // /api/quotes/[id]; the POST in the same file was the copy nobody looked at.
  return NextResponse.json(redactQuote(full, quote), { status: 201 });
}
