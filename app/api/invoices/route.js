// app/api/invoices/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { attachDefaultWaivers } from "@/lib/waivers/service";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { attachUsTaxRate } from "@/lib/tax/usRates";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { readTaxResolution, resolutionForDocument, resolutionMatchesAmount } from "@/lib/tax/taxResolution";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  redactInvoice,
  redactInvoices,
} from "@/lib/permissions/enforce";
import {
  buildCostingRow,
  mayCost,
  requireCost,
  isEmptyCosting,
} from "./costingWrite";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { readOfflineKey, withOfflineKey, recordOfflineRefusal } from "@/lib/offline/idempotency";
import { buildLabourLine, labourRequestFrom, retotal } from "@/lib/invoices/labourLine";
import { resolveLabourRate } from "@/lib/invoices/labourRates";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The bottom of this ladder used to be view_only, so reading was open to
  // anyone the route could reach. A member at invoices:none is refused rather
  // than handed an empty list — "you have no invoices" is a different statement
  // from "these are not yours to read".
  const { full, response: denied } = await levelOrRefusal(
    member,
    "invoices",
    "view_only",
    "see invoices",
  );
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const rows = await db.invoice.findMany({
    where: {
      companyId: member.companyId,
      parentInvoiceId: null, // one row per family — versions nest under their root
      // `status` is applied AFTER the current version's status is known, below,
      // not here on the root: after an amendment the root's status is the old
      // snapshot's, and filtering on it hid a paid invoice whose latest version
      // was the one that got paid.
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      payments: true,
      versions: {
        // The document fields and payments of every version, so the row the
        // grid shows can carry the CURRENT version's numbers — see below.
        select: {
          id: true,
          version: true,
          total: true,
          subtotal: true,
          tax: true,
          discount: true,
          dueDate: true,
          status: true,
          payments: true,
        },
        orderBy: { version: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── The current document's numbers, on the row the grid shows ────────────
  //
  // The list shows the ROOT of each family (versions nest under it — that is
  // the identity lib/invoices/jobLink.js links a job to), but the root is the
  // v1 SNAPSHOT: after an amendment its total is the old total and its
  // payments are only the ones taken while it was current, so the grid kept
  // saying the old amount and the old balance. Present the latest version's
  // document fields, with a balance re-derived from every payment across the
  // family, and hand `versions` back out in the [{id, version}] shape the grid
  // already reads. Unamended invoices pass through untouched. See
  // lib/invoices/family.js.
  const invoices = rows
    .map((root) => {
      const versions = root.versions || [];
      if (!versions.length) return root;
      const latest = versions[0]; // ordered version desc above
      const familyRows = [
        ...(root.payments || []),
        ...versions.flatMap((v) => v.payments || []),
      ];
      const state = computeInvoiceState({
        total: latest.total,
        payments: familyRows,
        priorStatus: latest.status,
      });
      return {
        ...root,
        currentVersionId: latest.id,
        total: latest.total,
        subtotal: latest.subtotal,
        tax: latest.tax,
        discount: latest.discount,
        dueDate: latest.dueDate,
        status: state.status,
        amountPaid: state.amountPaid,
        amountDue: state.amountDue,
        amountRefunded: state.amountRefunded,
        payments: familyRows,
        versions: versions.map((v) => ({ id: v.id, version: v.version })),
      };
    })
    .filter((inv) => !status || inv.status === status);

  // Shaped before it leaves, by the same entry point the detail route uses.
  // Two things travelled on this list that the grid has an opinion about and
  // nothing was checking: the nested client's email (hidden on GET /api/clients
  // since the first redaction sweep) and every money column — total, balance,
  // and the whole Payment rows, which reconstruct the balance on their own.
  //
  // `invoices: view_only` is a real grant, so this is a redaction rather than a
  // 403: a crew member may see that invoice 1042 for the Tremblay job is
  // overdue without seeing what it is for.
  return NextResponse.json(redactInvoices(full, invoices));
}

// Creates a fresh invoice, typically from an accepted Quote — NOT how new versions of
// an existing invoice are created (that's PATCH .../route.js below, which snapshots
// a version before applying changes).
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Invoices carry pricing, so two checks: the category level, and the
  // showPricing toggle. A member who can't see prices shouldn't be able to
  // create a document that consists mostly of them.
  // Hoisted out of the try because the costing block below needs it too, and
  // loading the same member twice to learn the same thing is waste.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "create invoices");
    requireToggle(full, "showPricing", "create invoices");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const body = await request.json();
  const {
    clientId,
    quoteId,
    // The job this invoice bills for, when the editor was opened from one
    // (/app/invoices/new?jobId=). Owned-id checked below like the other two.
    jobId,
    // { timeEntryIds, rateKey } — "add today's clocked hours as a line". Ids
    // and a key only; the server prices it (lib/invoices/labourLine.js).
    labour,
    // A body replayed from the phone's offline queue (lib/offline/queue.js)
    // carries no subtotal/tax/total — this flag says "derive them here".
    offline,
    // The tax PERCENTAGE the editor showed, when it showed one. A rate, not
    // an amount: used only to re-derive the tax after the server changes the
    // lines. Absent → the company's own resolver decides.
    taxRatePct,
    lineItems: postedLineItems,
    subtotal: postedSubtotal,
    discount,
    tax: postedTax,
    // Whether this invoice CLAIMS tax applies. Distinct from `tax` being zero
    // — see the schema note on Invoice.taxEnabled.
    taxEnabled,
    total: postedTotal,
    dueDate,
    notes,
    language,
    clientPhotos,
    // Internal cost panel — crew, their actual hours, materials. Never part of
    // the document; see the InvoiceCosting model for why it is a separate row.
    costing,
  } = body;

  const offlineKey = readOfflineKey(request);
  const labourRequest = labour ? labourRequestFrom(labour) : null;
  const serverPrices = Boolean(offline || labourRequest);

  if (!clientId || (postedTotal === undefined && !serverPrices)) {
    return NextResponse.json(
      { error: "clientId and total are required" },
      { status: 400 },
    );
  }
  if (labour && !labourRequest) {
    return NextResponse.json(
      { error: "The labour block needs timeEntryIds and a rateKey." },
      { status: 400 },
    );
  }

  // ── An offline replay the ledger already answered ─────────────────────────
  //
  // Checked before any validation so a replay of a key that was REFUSED last
  // time answers with the same refusal (the phone shows "needs attention" and
  // stops) rather than re-running the write and maybe succeeding on a body
  // that was fixed elsewhere. See lib/offline/idempotency.js.
  if (offlineKey) {
    const seen = await db.offlineSyncItem.findUnique({
      where: { companyId_clientKey: { companyId: member.companyId, clientKey: offlineKey } },
      select: { entityId: true, status: true, error: true },
    });
    if (seen?.status === "failed") {
      return NextResponse.json({ error: seen.error || "This invoice was refused earlier." }, { status: 409 });
    }
    if (seen?.entityId) {
      const existing = await db.invoice.findFirst({
        where: { id: seen.entityId, companyId: member.companyId },
        include: { client: true },
      });
      if (existing) return NextResponse.json(redactInvoice(full, existing), { status: 200 });
    }
  }

  // Neither id was proved to belong to this company before being written.
  //
  // `clientId` went straight onto the invoice, so posting another tenant's
  // client id raised an invoice in THIS company addressed to THEIR client,
  // whose details came back on every read of it.
  //
  // `quoteId` LOOKED checked — the lookup below is company-scoped — but that
  // lookup only reads a quote number, and a miss just leaves `sourceQuote`
  // null while `quoteId: quoteId || null` still stores the foreign id. A
  // scoped read next to an unscoped write is the easiest version of this to
  // miss in review, which is why both now go through one call.
  // See lib/tenant/ownedIds.js.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    clientId,
    quoteId,
    jobId,
  });
  if (notOurs) return notOurs;

  // ── The clocked-hours line ────────────────────────────────────────────────
  //
  // Entries are loaded scoped to this company through their worker, and to
  // the job when one was named. Anything open, already billed, rejected or
  // without hours is left out by buildLabourLine; if nothing survives there is
  // no line and the request is refused rather than answered with a $0 row.
  let lineItems = Array.isArray(postedLineItems) ? postedLineItems : [];
  let labourEntries = [];
  if (labourRequest) {
    labourEntries = await db.timeEntry.findMany({
      where: {
        id: { in: labourRequest.timeEntryIds },
        worker: { companyId: member.companyId },
        ...(jobId ? { jobId } : {}),
      },
      select: {
        id: true, clockIn: true, clockOut: true, hours: true, status: true, billedInvoiceId: true,
        worker: { select: { name: true } },
      },
    });
    const rate = await resolveLabourRate(db, member.companyId, labourRequest.rateKey);
    if (rate == null) {
      const refusal = "No hourly rate is set for that key — set one under Settings → Field work.";
      await recordOfflineRefusal({ db, companyId: member.companyId, memberId: member.id, key: offlineKey, kind: "invoice", error: refusal });
      return NextResponse.json({ error: refusal }, { status: 422 });
    }
    const line = buildLabourLine({
      entries: labourEntries,
      rate,
      rateKey: labourRequest.rateKey,
      label: language === "fr" ? "Main-d'œuvre" : language === "es" ? "Mano de obra" : "Labour",
    });
    if (!line) {
      const refusal = "None of those clock-ins can be billed — they are still open, already on an invoice, or have no hours.";
      await recordOfflineRefusal({ db, companyId: member.companyId, memberId: member.id, key: offlineKey, kind: "invoice", error: refusal });
      return NextResponse.json({ error: refusal }, { status: 422 });
    }
    labourEntries = labourEntries.filter((e) => line.labour.timeEntryIds.includes(e.id));
    lineItems = [line, ...lineItems.filter((li) => li && String(li.description || "").trim())];
  }

  // An invoice raised against a quote takes that quote's number so the pair
  // reconciles at a glance; one raised on its own has nothing to borrow and
  // continues the sequence. lib/invoices/invoiceNumber.js has both rules and
  // the reason the old "last invoice by createdAt" lookup could repeat one.
  const sourceQuote = quoteId
    ? await db.quote.findFirst({
        where: { id: quoteId, companyId: member.companyId },
        select: { quoteNumber: true, taxResolution: true, siteAddress: true },
      })
    : null;

  // ── What the tax line says ──────────────────────────────────────────────
  //
  // Raised from a quote: the quote's record, verbatim, as long as the money
  // still matches it — the invoice mirrors the quote. Raised on its own: the
  // resolver's answer for this client, recorded now so the invoice keeps
  // explaining itself after the rates table moves on. A figure the record
  // does not explain is recorded as typed by hand. See lib/tax/taxResolution.js.
  // ── Money the server derives ──────────────────────────────────────────────
  //
  // An online save from the editor posts the figures it showed. A replay from
  // the offline queue posts none, and a save that asked for a labour line
  // posted figures that no longer include it — in both cases the lines are
  // the truth and the totals are re-derived from them. The tax percentage is
  // the editor's when it sent one, else the company's own resolver's answer
  // ("the rate comes from your settings, not from this phone").
  let resolved = null;
  const readResolver = async () => {
    if (resolved) return resolved;
    const [companyForTax, taxRates, clientRow] = await Promise.all([
      db.company.findUnique({
        where: { id: member.companyId },
        select: { taxRate: true, autoApplyLocalTax: true, taxMode: true, country: true, province: true, vatRegistered: true, usTaxOverrides: true },
      }),
      db.taxRate.findMany({ where: { companyId: member.companyId } }),
      db.client.findFirst({ where: { id: clientId, companyId: member.companyId } }),
    ]);
    resolved = resolveDocumentTax({
      company: companyForTax || {},
      taxRates,
      client: await attachUsTaxRate(clientRow),
      // The quote's job address, when the invoice is raised from one: the
      // property's province decides (lib/tax/documentTax.js). An invoice
      // raised on its own has no site and reads the client's record.
      siteAddress: sourceQuote?.siteAddress || null,
    });
    return resolved;
  };

  let subtotal = postedSubtotal;
  let tax = postedTax;
  let total = postedTotal;
  if (serverPrices) {
    const pctPosted = Number(taxRatePct);
    const pct = Number.isFinite(pctPosted) && pctPosted >= 0 && typeof taxRatePct !== "undefined" && taxRatePct !== null
      ? pctPosted
      : Number((await readResolver())?.rate) || 0;
    const money = retotal({ lineItems, discount, taxEnabled: taxEnabled !== false, taxRatePct: pct });
    subtotal = money.subtotal;
    tax = money.tax;
    total = money.total;
  }

  const taxableBase = (Number(subtotal) || 0) - (Number(discount) || 0);
  const inherited = readTaxResolution(sourceQuote?.taxResolution);
  let taxResolution = null;
  if (taxEnabled !== false) {
    if (inherited && resolutionMatchesAmount(inherited, tax || 0, taxableBase)) {
      taxResolution = inherited;
    } else {
      taxResolution = resolutionForDocument({
        resolution: await readResolver(),
        tax: tax || 0,
        taxableBase,
        taxEnabled,
      });
    }
  }
  const nextNumber = await allocateInvoiceNumber(db, {
    companyId: member.companyId,
    quoteNumber: sourceQuote?.quoteNumber || null,
  });

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

  // Costed against subtotal MINUS discount — the pre-tax money the crew's time
  // and materials actually have to come out of. Tax is the government's, not
  // the company's, and a discount given away is not revenue either; counting
  // either as income flatters the margin.
  const costingRow =
    costing !== undefined && mayCost(full)
      ? await buildCostingRow({
          companyId: member.companyId,
          costing,
          price: (Number(subtotal) || 0) - (Number(discount) || 0),
          lineItems,
        })
      : null;

  const createInvoice = (tx) => tx.invoice.create({
    data: {
      companyId: member.companyId,
      invoiceNumber: nextNumber,
      clientId,
      quoteId: quoteId || null,
      jobId: jobId || null,
      createdById: member.userId,
      lineItems: lineItems || null,
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      // Same three-state care as the quote route: `taxEnabled: false` is a
      // decision and must not be read as "unset". Only an absent field falls
      // back to the column default.
      taxEnabled: taxEnabled === undefined ? true : Boolean(taxEnabled),
      taxResolution: taxResolution ?? Prisma.DbNull,
      total,
      // Seed the balance so list views and emails that read amountDue are
      // correct BEFORE any payment. It was defaulting to 0 (the column default),
      // which made a brand-new invoice read as fully paid.
      amountDue: total,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      language: language || "en",
      // An invoice raised without a quote behind it still needs the job
      // photos — same sanitising boundary as the quote routes.
      ...(clientPhotos !== undefined && {
        clientPhotos: normaliseMediaList(clientPhotos),
      }),
      // Nested create rather than a second round-trip: the cost panel is
      // filled in on the same screen as the line items, and an invoice that
      // saved while its crew and hours quietly didn't is the failure the whole
      // "never ship a control that appears to work" rule is about.
      //
      // Nothing typed, nothing written. A brand-new invoice from someone who
      // never opened the panel gets no costing row, rather than a row of
      // zeroes that then renders as "Job cost $0.00" on the invoice page.
      ...(costingRow && !isEmptyCosting(costingRow) && {
        costing: { create: costingRow },
      }),
    },
    include: { client: true },
  });

  // One transaction for the invoice, the hours it bills and the replay key:
  // an invoice whose labour line exists while its entries stay unbilled is
  // how the same afternoon ends up on two invoices. See
  // lib/offline/idempotency.js for the replay side.
  const { replayed, entityId, result: invoice } = await withOfflineKey(
    { db, companyId: member.companyId, memberId: member.id, key: offlineKey, kind: "invoice" },
    async (tx) => {
      const created = await createInvoice(tx);
      if (labourEntries.length) {
        await tx.timeEntry.updateMany({
          where: { id: { in: labourEntries.map((e) => e.id) }, billedInvoiceId: null },
          data: { billedInvoiceId: created.id },
        });
      }
      return { entityId: created.id, result: created };
    },
  );
  if (replayed) {
    const existing = entityId
      ? await db.invoice.findFirst({ where: { id: entityId, companyId: member.companyId }, include: { client: true } })
      : null;
    if (!existing) return NextResponse.json({ error: "This invoice was refused earlier." }, { status: 409 });
    return NextResponse.json(redactInvoice(full, existing), { status: 200 });
  }

  // `costing` is deliberately NOT included in the response. Nothing on the
  // create path needs it back, and the fewer places a whole invoice row
  // carries cost data, the fewer places it can be forwarded to a client.
  //
  // The client IS included and is redacted: creating an invoice needs
  // invoices/view_create_edit, which says nothing about clientsProperties, so
  // the two dials are independent and someone at name_address_only can reach
  // here. Reading the record back out of your own save is the same shape as
  // the bug already fixed on PATCH /api/quotes/[id].
  // Waivers marked "attach to every invoice" — see the quote route.
  await attachDefaultWaivers({ companyId: member.companyId, invoiceId: invoice.id }).catch((err) =>
    console.error("[invoices] default waivers failed:", err?.message),
  );

  return NextResponse.json(redactInvoice(full, invoice), { status: 201 });
}
