// app/api/platform/sales/payouts/[batchId]/paid/route.js
//
// Mark a payout batch paid — with the receipt, the reference, where it was
// sent through — or add proof to one already paid. The ONE route that flips
// a batch to `paid`; lib/sales/payoutProof.js's header says what it demands
// and why. Superadmin only, re-checked inside markBatchPaid on the admin row
// read here.
//
// Multipart, because a receipt is a file: `proof` (image or PDF),
// `paymentReference`, `paidVia`, `paymentNote`. The file is read into a
// Buffer and uploaded SERVER-SIDE with uploadBuffer into FieldQuo's own
// Cloudinary folder — never through /api/upload, which files under the
// caller's company, and this caller has none.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { markBatchPaid } from "@/lib/sales/payoutProof";

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only a superadmin can mark a payout paid." }, { status: 403 });
  }

  const { batchId } = await params;

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 400 });
  }

  const raw = form.get("proof");
  let file = null;
  if (raw && typeof raw === "object" && typeof raw.arrayBuffer === "function" && raw.size > 0) {
    file = {
      buffer: Buffer.from(await raw.arrayBuffer()),
      type: raw.type,
      size: raw.size,
      name: raw.name,
    };
  }

  const result = await markBatchPaid({
    batchId,
    admin: { id: admin.id, role: admin.role },
    fields: {
      paymentReference: form.get("paymentReference"),
      paidVia: form.get("paidVia"),
      paymentNote: form.get("paymentNote"),
    },
    file,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    batch: result.batch,
    cents: result.cents,
    driftedFromClose: result.driftedFromClose,
    notified: result.notified,
  });
}
