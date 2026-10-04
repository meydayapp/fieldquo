// app/api/settings/business-number/port/route.js
//
// POST multipart/form-data — move the company's number to FieldQuo.
//
//   fields  holderName, customerType, email, accountNumber, pin,
//           street, street2, city, region, postalCode,
//           acks (JSON array), signatureName, signatureAgreed ("true")
//   file    bill — a recent phone bill, PDF / PNG / JPEG, ≤ 4 MB
//
// Multipart because of the bill, which is why this is not an action on the
// JSON route beside it. The bill is read into memory and handed straight to
// lib/businessNumber/store.js: for a US number it goes to Twilio and is never
// stored; for a Canadian one it is sealed to the row (secrets.js) until the
// port ends.
//
// ══ Nothing secret is logged ═════════════════════════════════════════════════
//
// The account number and PIN appear in this handler only as values passed to
// startPort(). The activity entry names the number and the path, never the
// form; errors are logged by the store through redactPortDetail().
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { startPort, BILL_MAX_BYTES } from "@/lib/businessNumber/store";
import { phoneGateResponse } from "@/lib/trial/phoneGate";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  // A card-free trial verifies a mobile before this spends FieldQuo money
  // (lib/trial/phoneGate.js). Paid companies never reach a refusal here.
  const phoneGate = await phoneGateResponse(member, "business_number");
  if (phoneGate) return phoneGate;

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The form didn't arrive in one piece. Try again." }, { status: 400 });
  }
  const s = (k) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  let acks = [];
  try {
    acks = JSON.parse(s("acks") || "[]");
  } catch {
    acks = [];
  }

  const file = form.get("bill");
  let bill = null;
  if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
    if (file.size > BILL_MAX_BYTES) {
      return NextResponse.json({ error: "The bill is larger than 4 MB. A photo or PDF of the first page is enough.", problems: ["bill_size"] }, { status: 400 });
    }
    bill = { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name || "bill", contentType: file.type || "" };
  }

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

  const result = await startPort({
    companyId: member.companyId,
    ip,
    bill,
    form: {
      holderName: s("holderName"),
      customerType: s("customerType"),
      email: s("email"),
      accountNumber: s("accountNumber"),
      pin: s("pin"),
      address: {
        street: s("street"),
        street2: s("street2"),
        city: s("city"),
        region: s("region"),
        postalCode: s("postalCode"),
      },
      acks,
      signature: { name: s("signatureName"), agreed: s("signatureAgreed") === "true" },
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, reasonKey: result.reasonKey, ...(result.problems ? { problems: result.problems } : {}), ...(result.needCents ? { needCents: result.needCents, balanceCents: result.balanceCents } : {}) },
      { status: result.status || 400 },
    );
  }

  await recordActivity(member, {
    action: "business_number.port_started",
    entityType: "settings",
    summary: `Asked to move ${result.number?.e164} to FieldQuo`,
    metadata: { e164: result.number?.e164, country: result.number?.country, simulated: Boolean(result.simulated) },
  });
  return NextResponse.json(result);
}
