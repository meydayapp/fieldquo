// app/api/quotes/access-rental/route.js
//
// POST — price one piece of access equipment for the quote builder's painting
// card ("Add access equipment"), from the SAME function and the same figures
// the drawing read prices access with (lib/pricing/paintHeightPrep.js
// priceRental): the company's own rental rate for the kind (Settings →
// Services, painting), its frame scaffold rate by the face, else the cited
// reference table (Craftsman NPC 2023, Figure 15, US$) converted at the
// product's dated exchange rate. The browser sends WHAT (kind, working
// height, days, face area) — never a price; the answer carries the price and
// the sentence that explains it, which the builder stores on the line's
// office-only meta.
//
// Staff-side only, and money: a member whose access hides prices is refused.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { loadPaintBooks } from "@/lib/planRead/run";
import { loadFirstPassContext } from "@/lib/planRead/firstPassContext";
import { figuresBook } from "@/lib/planRead/firstPass";
import { priceRental, ACCESS_KINDS, ACCESS_REFERENCE } from "@/lib/pricing/paintHeightPrep";

/**
 * GET — the reference rental table in the COMPANY's currency, for Settings →
 * Services → Equipment & access, where each empty box shows the default in
 * use. Converted at the same dated rate the pricing uses; null figures (and
 * the reason) where no rate exists for the currency.
 */
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see access rental rates");
  if (denied) return denied;
  if (!hasToggle(full, "showPricing")) return NextResponse.json({ error: "Prices are hidden by your access level." }, { status: 403 });
  const ctx = await loadFirstPassContext(member.companyId, { prisma: db });
  const k = ctx.fx?.rate || null;
  const conv = (v) => (k ? Math.round(v * k * 100) / 100 : null);
  return NextResponse.json({
    currency: ctx.currency,
    converted: Boolean(k && k !== 1),
    fxText: ctx.fx?.text || null,
    noRate: !k,
    kinds: ACCESS_KINDS.map((kind) => ({
      kind,
      label: ACCESS_REFERENCE[kind].label,
      heading: ACCESS_REFERENCE[kind].heading,
      rows: ACCESS_REFERENCE[kind].rows.map((row) => ({ size: row.size, label: row.label, day: conv(row.day), week: conv(row.week), month: conv(row.month), usd: { day: row.day, week: row.week, month: row.month }, page: row.page })),
    })),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "price access equipment");
  if (denied) return denied;
  if (!hasToggle(full, "showPricing")) return NextResponse.json({ error: "Prices are hidden by your access level." }, { status: 403 });

  const raw = await request.json().catch(() => ({}));
  const kind = typeof raw?.kind === "string" && ACCESS_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return NextResponse.json({ error: "Choose the equipment." }, { status: 400 });
  const height = Number(raw?.workingHeightFt);
  const days = Number(raw?.days);
  const face = Number(raw?.faceSqft);
  const { books } = await loadPaintBooks(member.companyId, { prisma: db });
  const ctx = await loadFirstPassContext(member.companyId, { prisma: db });
  const out = priceRental({
    kind,
    workingHeightFt: Number.isFinite(height) && height > 0 && height <= 400 ? height : null,
    days: Number.isFinite(days) && days >= 1 && days <= 500 ? Math.ceil(days) : 1,
    faceSqft: Number.isFinite(face) && face > 0 && face <= 10_000_000 ? face : null,
    currency: ctx.currency,
    fx: ctx.fx,
    // The book carrying the company's figures (firstPass.js figuresBook) — the
    // same choice the drawing read makes.
    book: figuresBook(books),
  });
  return NextResponse.json({ ...out, kind, label: ACCESS_REFERENCE[kind]?.label || kind, currency: ctx.currency });
}
