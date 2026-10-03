// app/api/platform/business-numbers/route.js
//
// FieldQuo's side of "Bring your number".
//
//   GET                  every request in flight or live — no secrets
//                        (company:view, like the rest of the console)
//   GET ?package=<id>    one Canadian port's filing package: the account
//                        number, PIN, LOA wording with the signature, and the
//                        bill — superadmin only ("porting:handle"), and every
//                        open is written to PlatformAuditLog
//   POST { id, action: "filed" | "rejected" | "confirmed", note?, portDate? }
//                        FieldQuo's own record of what it did — a PortFiling
//                        row. The company's BroughtNumber is never written
//                        here (non-negotiable #3); its status is derived from
//                        these rows by lib/businessNumber/state.js
//                        mapCanadianFiling, and "complete" only ever comes
//                        from the number appearing in FieldQuo's Twilio
//                        account.
//
// ══ Why a person files Canadian ports ═════════════════════════════════════════
//
// Twilio's Port In API is United States only. Its Canadian guideline sends
// local and mobile numbers through the international porting form
// (https://twlo.my.salesforce-sites.com/InternationalPorting) with an LOA
// dated within 30 days, the latest bill, the account number and the PIN.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { canPlatform } from "@/lib/platform/permissions";
import { openPortSecret } from "@/lib/businessNumber/secrets";
import { loaText } from "@/lib/businessNumber/loa";

const FILING_ACTIONS = ["filed", "rejected", "confirmed"];

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPlatform(admin.role, "company:view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pkg = new URL(request.url).searchParams.get("package");
  if (pkg) {
    if (!canPlatform(admin.role, "porting:handle")) {
      return NextResponse.json({ error: "Only a superadmin can open a port package — it holds the carrier PIN." }, { status: 403 });
    }
    const row = await db.broughtNumber.findUnique({
      where: { id: pkg },
      include: { company: { select: { id: true, name: true } }, filings: { orderBy: { createdAt: "asc" } } },
    });
    if (!row || row.path !== "port" || row.submitChannel !== "twilio_form") {
      return NextResponse.json({ error: "No Canadian port package with that id." }, { status: 404 });
    }
    let accountNumber = null;
    let pin = null;
    let bill = null;
    let unreadable = null;
    try {
      accountNumber = openPortSecret(row.id, row.accountNumberEnc);
      pin = openPortSecret(row.id, row.pinEnc);
      bill = row.billEnc ? openPortSecret(row.id, row.billEnc) : null;
    } catch (err) {
      unreadable = `The stored details could not be opened (${err?.message}). Ask the company to resubmit.`;
    }
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "port_package_opened",
        targetCompanyId: row.companyId,
        details: { broughtNumberId: row.id, e164: row.e164 },
      },
    });
    return NextResponse.json({
      id: row.id,
      company: row.company,
      e164: row.e164,
      lineType: row.lineType,
      carrierName: row.carrierName,
      holderName: row.holderName,
      holderEmail: row.holderEmail,
      customerType: row.customerType,
      serviceAddress: row.serviceAddress,
      accountNumber,
      pin,
      bill: bill ? { name: row.billName, type: row.billType, base64: bill } : null,
      secretsPurgedAt: row.secretsPurgedAt,
      loa: loaText(row),
      loaSignedName: row.loaSignedName,
      loaSignedAt: row.loaSignedAt,
      loaSignedIp: row.loaSignedIp,
      filings: row.filings,
      unreadable,
      formUrl: "https://twlo.my.salesforce-sites.com/InternationalPorting",
      accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    });
  }

  const rows = await db.broughtNumber.findMany({
    where: { status: { notIn: ["draft"] } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      e164: true,
      country: true,
      lineType: true,
      path: true,
      status: true,
      providerStatus: true,
      failureReason: true,
      submitChannel: true,
      submittedAt: true,
      expectedAt: true,
      activatedAt: true,
      simulated: true,
      secretsPurgedAt: true,
      company: { select: { id: true, name: true } },
      filings: { orderBy: { createdAt: "desc" }, take: 1, select: { action: true, note: true, portDate: true, createdAt: true } },
    },
  });
  return NextResponse.json({ rows, canHandle: canPlatform(admin.role, "porting:handle") });
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPlatform(admin.role, "porting:handle")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "");
  if (!FILING_ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const row = await db.broughtNumber.findUnique({ where: { id: String(body?.id || "") }, select: { id: true, companyId: true, path: true, submitChannel: true, status: true } });
  if (!row || row.path !== "port" || row.submitChannel !== "twilio_form") {
    return NextResponse.json({ error: "No Canadian port with that id." }, { status: 404 });
  }
  if (["active", "failed", "cancelled"].includes(row.status)) {
    return NextResponse.json({ error: "That request has ended; nothing to record." }, { status: 409 });
  }
  const note = body?.note ? String(body.note).slice(0, 500) : null;
  if (action === "rejected" && !note) return NextResponse.json({ error: "Say why the carrier rejected it — the company sees this sentence." }, { status: 400 });
  const portDate = action === "confirmed" && body?.portDate ? new Date(body.portDate) : null;
  if (action === "confirmed" && (!portDate || Number.isNaN(portDate.getTime()))) {
    return NextResponse.json({ error: "A confirmed port needs the date the carrier gave." }, { status: 400 });
  }
  const filing = await db.portFiling.create({
    data: { broughtNumberId: row.id, action, note, portDate, platformAdminId: admin.id },
  });
  // Spelled out, not `port_${action}`: the audit screen's vocabulary is
  // checked against the literal action names this file writes.
  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: action === "filed" ? "port_filed" : action === "rejected" ? "port_rejected" : "port_confirmed",
      targetCompanyId: row.companyId,
      details: { broughtNumberId: row.id, note },
    },
  });
  return NextResponse.json({ ok: true, filing });
}
