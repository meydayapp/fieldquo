// app/api/clients/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactClients,
} from "@/lib/permissions/enforce";
import { isSupported } from "@/app/i18n/languages";
import { normaliseCountry } from "@/lib/tax/jurisdictions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Loaded here rather than reusing `member`: getCurrentMember doesn't carry
  // the permissions grid, and redaction needs it.
  const full = await loadEnforceableMember(db, member.id);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const clients = await db.client.findMany({
    where: {
      companyId: member.companyId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    // The list cards show "N quotes / N invoices"; without these counts the
    // relations are undefined and every card read "0 quotes / 0 invoices".
    include: { _count: { select: { quotes: true, invoices: true } } },
  });

  // Shaped to the caller's level before it leaves the server.
  //
  // Not a `select` on the query: the same rows feed a search that filters
  // on email, and narrowing the SELECT would break matching on a field the
  // caller isn't allowed to READ — which is a different question. Fetch
  // whole, redact on the way out.
  return NextResponse.json(redactClients(full, clients));
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // "Clients and Properties: view client name and address only" is the
  // narrowest level and must not permit creating client records.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_edit", "add clients");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const body = await request.json();
  const {
    name,
    type,
    contactName,
    email,
    phone,
    address,
    city,
    province,
    country,
    notes,
    language,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const client = await db.client.create({
      data: {
        companyId: member.companyId,
        name,
        type: type === "company" ? "company" : "individual",
        // Only meaningful for company clients; ignored/blank for individuals.
        contactName: type === "company" ? contactName || null : null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        province: province || null,
        // Stored only when it is a real two-letter code. A half-typed "Ca" or
        // a stray "Canada" is dropped rather than saved, because the tax
        // lookup keys on this and a value it cannot parse would read as a
        // country we simply don't support — a different, more alarming
        // message than the "not set yet" the contractor actually needs.
        country: normaliseCountry(country),
        notes: notes || null,
        // Null means "use the company default". Storing the company's own
        // language explicitly would freeze this client's documents to it,
        // so a company that later switches default would keep sending old-
        // language quotes to everyone already on file.
        language: isSupported(language) ? language : null,
      },
    });

    await recordActivity(member, {
      action: "client.created",
      entityType: "client",
      entityId: client.id,
      summary: `Added client ${client.name}`,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("[clients POST]", err);

    // Name the actual fault. The old message said "if you just changed the
    // schema, run prisma db push" for EVERY failure, which is unhelpful in
    // production where nobody is changing a schema — and it buried the real
    // cause behind a generic sentence.
    //
    // P2022 is Prisma's "column does not exist": the deployed schema is ahead
    // of the database. That's the one failure here worth naming precisely,
    // because the fix is a single command and nothing else looks like it.
    if (err.code === "P2022") {
      return NextResponse.json(
        {
          error:
            `The database is missing a column this app expects (${err.meta?.column || "unknown"}). ` +
            "Run `npx prisma db push` against this environment to bring it up to date.",
        },
        { status: 500 },
      );
    }

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A client with those details already exists." },
        { status: 409 },
      );
    }

    // Never echo a raw Prisma message. When `member.id` was undefined this
    // returned a 900-character `prisma.member.findUnique()` dump listing every
    // column on the Member model, rendered verbatim in the UI. That tells the
    // user nothing, and tells anyone reading over their shoulder the shape of
    // the database. The detail belongs in the server log.
    return NextResponse.json(
      { error: "Could not create client. Support has been sent the details." },
      { status: 500 },
    );
  }
}
