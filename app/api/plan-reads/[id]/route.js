// app/api/plan-reads/[id]/route.js
//
// GET   one drawing read, with its overview and draft computed now
//       (lib/planRead/view.js). A running read whose lease has lapsed is
//       picked up again here — the poll that shows progress is what keeps a
//       read moving across Vercel's per-invocation ceiling (lib/planRead/run.js).
//   ?sheet=<key> adds that sheet's dimension list for the measure tool.
//       Also: who wrote each line of the history, and — when an earlier read
//       of the same drawing file has sheet passes this one still needs — the
//       offer to reuse them (lib/planRead/sheetCache.js, POST …/reuse).
// PATCH the estimator's own edits: the title, what the client wants, a
//       measurement traced on a sheet, a price typed for a lift, a surface or
//       area switched off, a photo grouping split or merged. The same
//       applyOps the chat uses, with actor "person" — so only a person can set
//       a measurement, and only a person can price equipment freely (the chat
//       may enter only a figure the estimator typed or accepted, flagged as
//       the AI's). A 0 is a price: owned equipment. Each one is logged in the read's history
//       beside the chat's changes (lib/planRead/history.js).
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { aiBalanceFor } from "@/lib/voice/credits";
import { loadPlanRead } from "@/lib/planRead/load";
import { planReadView } from "@/lib/planRead/view";
import { withOpenUrls } from "@/lib/media/fileOpen";
import { advanceRead, readInputs, loadPaintBooks } from "@/lib/planRead/run";
import { applyOps, buildDimIndex } from "@/lib/planRead/projectModel";
import { planSubstrateKeys } from "@/lib/planRead/catalogue";
import { splitPhotoSurface, mergePhotoSurfaces } from "@/lib/planRead/photoScale";
import { editLogEntry, withAuthors } from "@/lib/planRead/history";
import { findSheetCache } from "@/lib/planRead/sheetCache";
import { loadScopeOptions, resolveScope } from "@/lib/planRead/scope";
import { applyTradeOps, TRADE_PERSON_OPS } from "@/lib/planRead/tradeModel";
import { Prisma } from "@prisma/client";
import { applyPricingOps, PRICING_PERSON_OPS } from "@/lib/planRead/pricingOps";
import { priceReadNow, pricingContextFor } from "@/lib/planRead/priceRead";
import { tradesFromScope } from "@/lib/planRead/tradeCatalogue";
import { chatSpendCents } from "@/lib/planRead/billing";
import { loadFirstPassContext } from "@/lib/planRead/firstPassContext";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see drawing reads");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId);
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stale = read.status === "reading" && (!read.leaseUntil || new Date(read.leaseUntil).getTime() < Date.now());
  // Never from a read-only support session: continuing a read writes the
  // company's data and spends its held credit.
  if (stale && member.impersonationMode !== "read_only") {
    after(() => advanceRead(read.id, { companyId: member.companyId, userId: member.userId || null }));
  }

  const sheetKey = new URL(request.url).searchParams.get("sheet");
  const [balanceCents, company, authors, cache, scopeOptions, chatChargedCents, fpCtx] = await Promise.all([
    aiBalanceFor(member.companyId),
    db.company.findUnique({ where: { id: member.companyId }, select: { currency: true } }),
    // The chat's authors, and whoever ticked "Check before sending" or gave
    // an access line's reason — so each says a name, not "your team".
    withAuthors(
      [
        ...(read.messages || []),
        ...Object.values(read.model?.review && typeof read.model.review === "object" ? read.model.review : {}).map((r) => ({ userId: r?.by || null })),
        ...(Array.isArray(read.model?.access) ? read.model.access : []).map((a) => ({ userId: a?.zeroBy || null })),
      ],
      { prisma: db, companyId: member.companyId },
    ),
    // The offer is a convenience: a failed lookup shows no offer, never a
    // broken page.
    findSheetCache(read, { companyId: member.companyId, prisma: db }).catch((err) => {
      console.error("[planRead] sheet cache:", err?.message);
      return { offers: [] };
    }),
    // The company's own services to scope the read by. A failed lookup shows
    // none to choose from — never a broken page.
    loadScopeOptions(member.companyId, { prisma: db }).catch((err) => {
      console.error("[planRead] scope options:", err?.message);
      return [];
    }),
    // What the chat has cost, from the ledger — "charged so far" includes
    // it. A failed lookup names the read's own charge alone (null).
    chatSpendCents({ prisma: db, companyId: member.companyId, planReadId: read.id }).catch((err) => {
      console.error("[planRead] chat spend:", err?.message);
      return null;
    }),
    // The first pass's crew and currency (lib/planRead/firstPassContext.js) —
    // each part degrades on its own inside.
    loadFirstPassContext(member.companyId, { prisma: db }),
  ]);
  // The company's pricing context — its books, services, labour cost rate,
  // target margin and overhead — for the recommendation. Money: only for a
  // member who may see prices, and a failed lookup shows no recommendation
  // (said on screen), never a broken page.
  const canSeeMoney = hasToggle(full, "showPricing");
  const pricingCtx = canSeeMoney && read.model
    ? await pricingContextFor(member.companyId, { prisma: db }).catch((err) => {
        console.error("[planRead] pricing context:", err?.message);
        return null;
      })
    : null;
  // Each file opens through /api/files/open on a link minted here, after the
  // quotes gate above (lib/media/fileOpen.js).
  const view = await planReadView({ ...read, documents: withOpenUrls(member, "quote-document", read.documents) }, {
    companyId: member.companyId,
    canSeeMoney,
    balanceCents,
    sheetKey,
    authors,
    reuseOffer: cache.offers[0] || null,
    scopeOptions,
    pricingCtx,
    chatChargedCents,
    fpCtx,
  });
  return NextResponse.json({ ...view, currency: company?.currency || null });
}

const clip = (s, n) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit drawing reads");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (read.status === "reading") return NextResponse.json({ error: "A read is running. Edit it when it finishes." }, { status: 409 });

  const raw = await request.json().catch(() => ({}));
  const data = {};
  const changes = [];
  if (typeof raw?.title === "string") {
    data.title = clip(raw.title, 120) || read.title;
    if (data.title !== read.title) changes.push(`Renamed the project to “${data.title}”`);
  }
  if (typeof raw?.clientRequest === "string") {
    data.clientRequest = clip(raw.clientRequest, 2000) || null;
    if ((data.clientRequest || "") !== (read.clientRequest || "")) changes.push("Changed what the client wants");
  }

  // What the read is for — the quote's services, from the company's own
  // switched-on list (never trusted from the browser). Changing it is new
  // work: the next read re-routes the sheets (lib/planRead/run.js inputsKey).
  if (Array.isArray(raw?.scope)) {
    const next = await resolveScope(raw.scope.map(String).slice(0, 12), { companyId: member.companyId, from: "estimator" });
    const keyOf = (sc) => (Array.isArray(sc?.categories) ? sc.categories.map((c) => c.key).sort().join(",") : "");
    if (keyOf(next) !== keyOf(read.scope)) {
      data.scope = next || Prisma.DbNull;
      changes.push(next ? `Set what this read is for: ${next.categories.map((c) => c.label).join(", ")}` : "Cleared what this read is for");
    }
  }

  if (raw?.photo && read.photoRead) {
    const next =
      raw.photo.op === "split"
        ? splitPhotoSurface(read.photoRead, String(raw.photo.id || ""))
        : raw.photo.op === "merge"
          ? mergePhotoSurfaces(read.photoRead, Array.isArray(raw.photo.ids) ? raw.photo.ids.map(String).slice(0, 10) : [])
          : read.photoRead;
    if (next !== read.photoRead) {
      data.photoRead = next;
      changes.push(raw.photo.op === "split" ? "Split a photo grouping" : "Merged photo groupings");
      // Keep the overview's surfaces pointing at a photo surface that still
      // exists: a split one's link follows its first part, a merged one's
      // follows the surface it was merged into.
      const live = new Set(next.surfaces.map((s) => s.id));
      const relink = (pid) => {
        if (!pid || live.has(pid)) return pid;
        if (raw.photo.op === "split" && live.has(`${pid}.1`)) return `${pid}.1`;
        if (raw.photo.op === "merge") return next.surfaces.find((s) => Array.isArray(raw.photo.ids) && raw.photo.ids.includes(s.id))?.id || null;
        return null;
      };
      if (read.model?.surfaces) {
        data.model = { ...read.model, surfaces: read.model.surfaces.map((s) => ({ ...s, photoSurfaceId: relink(s.photoSurfaceId) })) };
      }
    }
  }

  // The trades' own edits (a measurement, an item or a whole trade left out)
  // go through applyTradeOps; everything else through the painting model's
  // applyOps, exactly as before.
  const tradeOps = Array.isArray(raw?.ops) ? raw.ops.filter((o) => o && TRADE_PERSON_OPS.includes(o.op)) : [];
  if (tradeOps.length && read.model) {
    const result = applyTradeOps(data.model || read.model, tradeOps.slice(0, 20), { actor: "person" });
    data.model = result.model;
    changes.push(...result.changes);
  }

  // A person's pricing choices — money, so only for a member who sees
  // prices. The margin adjustment's amount is the server's own current gap
  // (priceReadNow), and figures from the conversation are re-checked against
  // the read's stored messages (lib/planRead/pricingOps.js).
  const pricingOps = Array.isArray(raw?.ops) ? raw.ops.filter((o) => o && PRICING_PERSON_OPS.includes(o.op)) : [];
  if (pricingOps.length && read.model) {
    if (!hasToggle(full, "showPricing")) return NextResponse.json({ error: "Prices are hidden by your access level." }, { status: 403 });
    const current = data.model || read.model;
    const needsPrice = pricingOps.some((o) => o.op === "add_margin_adjustment");
    const priced = needsPrice ? await priceReadNow(read, { companyId: member.companyId, prisma: db, model: current }) : null;
    const messages = pricingOps.some((o) => o.op === "set_pricing_assumptions")
      ? await db.planReadMessage.findMany({ where: { planReadId: read.id, companyId: member.companyId, role: "user" }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, text: true } })
      : [];
    const result = applyPricingOps(current, pricingOps, {
      recommendation: priced?.pricing?.recommendation || null,
      messages,
      trades: tradesFromScope(read.scope).trades.map((t) => t.tradeKey),
      userId: member.userId || null,
    });
    data.model = result.model;
    changes.push(...result.changes, ...result.dropped.map((x) => `Not applied: ${x}`));
  }

  const otherOps = Array.isArray(raw?.ops) ? raw.ops.filter((o) => o && !TRADE_PERSON_OPS.includes(o.op) && !PRICING_PERSON_OPS.includes(o.op)) : [];
  if (otherOps.length && read.model) {
    // A price for equipment is money on the estimator's own draft; a member
    // whose access hides pricing may not set one — nor confirm one.
    const canSeeMoney = hasToggle(full, "showPricing");
    let ops = otherOps.filter((o) => canSeeMoney || (o.op !== "set_access_price" && o.op !== "confirm_access")).slice(0, 20);
    // Who and when, from the session — never from the body — on the ops the
    // read records them for (a left-out access line's reason, a ticked check,
    // the building state priced).
    const at = new Date().toISOString();
    ops = ops.map((o) => (o.op === "set_access_reason" || o.op === "review_check" || o.op === "set_plan_state" ? { ...o, userId: member.userId || null, at } : o));
    // "Confirm" an estimated access line: the amount is the server's own,
    // worked out from the read now (lib/planRead/firstPass.js priceAccessLine)
    // — a price in the request is never read (AGENTS.md rule 5's spirit).
    if (ops.some((o) => o.op === "confirm_access")) {
      const now = await priceReadNow(read, { companyId: member.companyId, prisma: db, model: data.model || read.model });
      const pricedAccess = now?.pricedPaint?.access || [];
      ops = ops.map((o) => {
        if (o.op !== "confirm_access") return o;
        const line = pricedAccess.find((x) => x.id === String(o.accessId || ""));
        return { op: "confirm_access", accessId: String(o.accessId || ""), price: line && line.price !== null ? line.price : null, why: line?.why || null };
      });
    }
    const { books } = await loadPaintBooks(member.companyId);
    const book = books.interior_painting;
    const { sheets, excel } = readInputs(read);
    const dims = buildDimIndex(sheets);
    const result = applyOps(
      data.model || read.model,
      ops,
      {
        dimIds: new Set(dims.keys()),
        itemKeys: new Set(planSubstrateKeys(book)),
        productKeys: new Set(Object.keys(book?.products || {})),
        photoIds: new Set(((data.photoRead || read.photoRead)?.surfaces || []).map((s) => s.id)),
        excel,
      },
      { actor: "person" },
    );
    data.model = result.model;
    changes.push(...result.changes);
  }

  if (!Object.keys(data).length) return NextResponse.json({ ok: true, changes: [] });
  // The estimator's own edits go into the same history as the chat's — who,
  // when, what changed — written in the SAME transaction as the edit, the
  // messages route's rule: the history and the read can never disagree.
  // Nothing is logged when nothing changed (a title saved as it was).
  const log = editLogEntry({ changes, companyId: member.companyId, planReadId: read.id, userId: member.userId || null });
  await db.$transaction([
    db.planRead.updateMany({ where: { id: read.id, companyId: member.companyId }, data }),
    ...(log ? [db.planReadMessage.create({ data: log })] : []),
  ]);
  return NextResponse.json({ ok: true, changes });
}
