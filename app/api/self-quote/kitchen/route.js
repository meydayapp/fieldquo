// app/api/self-quote/kitchen/route.js
//
// A homeowner designs their own kitchen and asks for a price.
//
//   POST { companySlug, name, email|phone, address, design, notes }
//
// Public. No account, no token — this is the top of the funnel, reached from
// the company's website or a QR code on a van.
//
// ── Why this creates a LEAD and not a quote ────────────────────────────────
//
// Because nobody has priced it yet. A Quote row that exists before a human has
// looked at the drawing is a number the client can see and the contractor never
// agreed to — and the whole reason a cabinet maker quotes by hand is that a
// layout can be drawable and unbuildable. So the design lands as a lead, the
// company opens it, prices it, and sends a real quote back.
//
// That's also what the client is told: "we'll come back with a price", not a
// figure. Nothing on this path returns money, which is the same rule the rest
// of the public surface follows (AGENTS.md §4).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normaliseFinish, describeFinish } from "@/lib/kitchen/finishes";
import { KINDS } from "@/lib/kitchen/geometry";
import { resolveSender } from "@/lib/email/companySender";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";
import { getAppOrigin } from "@/lib/appUrl";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

/** Elements this build understands, capped, with only the fields we draw. */
function cleanDesign(input) {
  if (!input || typeof input !== "object") return null;

  const num = (v, d, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : d;
  };

  const elements = (Array.isArray(input.elements) ? input.elements : [])
    // A kind this build doesn't have would throw in the renderer, and the
    // renderer runs inside the contractor's app when they open the lead.
    .filter((el) => el && KINDS[el.kind])
    .slice(0, 300)
    .map((el, i) => ({
      id: typeof el.id === "string" ? el.id.slice(0, 40) : `e${i}`,
      kind: el.kind,
      wall: ["A", "B", "C", "D"].includes(el.wall) ? el.wall : "A",
      pos: num(el.pos, 0, -600, 600),
      y: num(el.y, 0, -600, 600),
      width: num(el.width, 24, 1, 480),
      height: num(el.height, 34.5, 1, 144),
      depth: num(el.depth, 24, 1, 60),
      config: cleanConfig(el.config),
    }));

  return {
    serviceType: "kitchen",
    room: {
      width: num(input.room?.width, 144, 24, 1200),
      depth: num(input.room?.depth, 120, 24, 1200),
      ceiling: num(input.room?.ceiling, 96, 60, 240),
    },
    elements,
    // Validated to real hexes — this ends up in an SVG `fill` on the
    // contractor's screen.
    finish: normaliseFinish(input.finish),
  };
}

/** Only the config fields that affect the DRAWING. No prices, ever. */
function cleanConfig(c) {
  if (!c || typeof c !== "object") return {};
  const out = {};
  if (Number.isFinite(Number(c.doors))) out.doors = Math.min(Math.max(Math.floor(c.doors), 0), 6);
  if (Number.isFinite(Number(c.doorRows))) out.doorRows = Math.min(Math.max(Math.floor(c.doorRows), 1), 3);
  if (Array.isArray(c.drawers)) {
    out.drawers = c.drawers
      .slice(0, 8)
      .filter((d) => ["small", "medium", "big"].includes(d));
  }
  if (Number.isFinite(Number(c.heightClass))) out.heightClass = Math.min(Math.max(Number(c.heightClass), 6), 60);
  if (typeof c.sink === "boolean") out.sink = c.sink;
  if (typeof c.hoodVariant === "string") out.hoodVariant = c.hoodVariant.slice(0, 20);
  // supplyPrice / installPrice / billable deliberately absent: a self-quote
  // client has no prices to send and no business setting one.
  return out;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { companySlug, name, email, phone, address, notes } = body;

  if (!companySlug || !name || (!email && !phone)) {
    return NextResponse.json(
      { error: "We need your name and either an email or a phone number." },
      { status: 400 },
    );
  }

  const design = cleanDesign(body.design);
  if (!design?.elements?.length) {
    return NextResponse.json(
      { error: "Add at least one cabinet to your layout before sending it." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { slug: String(companySlug) },
    select: { id: true, name: true, slug: true, dateFormat: true, email: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The category a kitchen belongs to for THIS company. Null is fine — the lead
  // still lands, and forcing a category the company hasn't enabled would file it
  // under work they don't do.
  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId: company.id, enabled: true },
    include: { category: { select: { id: true, key: true } } },
  });
  const categoryId =
    enabled.find((e) => /cabinet|kitchen|countertop|remodel/.test(e.category?.key || ""))
      ?.category?.id || null;

  const counts = design.elements.reduce((acc, el) => {
    const g = KINDS[el.kind]?.group || "other";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const lead = await db.leadRequest.create({
    data: {
      companyId: company.id,
      name: String(name).slice(0, 200),
      email: email ? String(email).slice(0, 200) : null,
      phone: phone ? String(phone).slice(0, 60) : null,
      categoryId,
      // A readable summary as well as the JSON, because the leads list shows
      // `message` and nobody should have to open the designer to find out
      // whether a lead is worth opening the designer for.
      message: [
        address ? `Address: ${address}` : null,
        `Room: ${Math.round(design.room.width)}" × ${Math.round(design.room.depth)}"`,
        `${plural(counts.cabinet || 0, "cabinet")}, ${plural(counts.appliance || 0, "appliance")}`,
        describeFinish(design.finish),
        notes ? `Notes: ${String(notes).slice(0, 2000)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      source: "self_quote_kitchen",
      kitchenDesign: design,
    },
  });

  // ── Tell the company ────────────────────────────────────────────────────
  //
  // Best-effort. A failed email must not lose the client's design — they drew
  // it, it's saved, and the lead is in the list either way.
  try {
    const staff = await db.member.findMany({
      where: { companyId: company.id, active: true, role: { in: ["owner", "admin"] } },
      include: { user: { select: { email: true } } },
      distinct: ["userId"],
    });
    const to = staff.map((m) => m.user?.email).filter(Boolean);
    if (to.length) {
      const { from, replyTo } = await resolveSender(company, company.id);
      // The leads LIST. There's no lead detail route, and emailing a link to
      // a 404 is worse than emailing no link at all — it reads as the product
      // being broken at the exact moment a new enquiry arrives.
      const link = `${getAppOrigin(request)}/app/leads`;
      await resend.emails.send({
        from,
        replyTo,
        to,
        subject: `Kitchen design request — ${name}`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;line-height:1.5;">
          <p><strong>${esc(name)}</strong> designed a kitchen on your website and asked for a price.</p>
          <p>${esc(counts.cabinet || 0)} cabinets · ${esc(describeFinish(design.finish))}</p>
          <p>Open the lead to see their drawing, price it, and send them a quote.</p>
          <p><a href="${link}">Open the request →</a></p>
        </div>`,
        text: `${name} designed a kitchen on your website and asked for a price.\n\n${link}`,
      });
    }
  } catch (err) {
    console.error("[self-quote/kitchen] couldn't notify the company:", err);
  }

  return NextResponse.json(
    {
      success: true,
      id: lead.id,
      // Said plainly, and no number. The client is waiting on a human.
      message: `Thanks — ${company.name} has your layout and will come back with a price.`,
    },
    { status: 201 },
  );
}

/** "1 cabinet" / "4 cabinets". It's on a screen a contractor reads all day. */
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
