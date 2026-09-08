// app/api/ai-employee/sources/route.js
//
// The resource material — the policy, the troubleshooting guide, the manual.
//
//   GET  → every source, with its status and why a failed one failed
//   POST → multipart upload, or { title, kind, text } pasted straight in
//
// ══ Why this does not go through /api/upload ═══════════════════════════════
//
// That route puts a FILE on Cloudinary and hands back a URL, which is exactly
// right for a logo and exactly wrong here: what this feature needs is the TEXT,
// read once, stored, and handed to a model. A Cloudinary URL would be a second
// place the same document lives, a second thing to keep in sync with a delete,
// and a file we would then have to fetch back and parse on every reply.
//
// The formats FieldQuo can honestly read are the ones whose bytes are their
// text — lib/aiEmployee/sources.js draws that line and says why. A PDF is
// REFUSED BY NAME, with the reason stored on the row and printed on the
// screen, rather than accepted and quietly not read.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  MAX_SOURCE_BYTES,
  SOURCE_KINDS,
  classifySourceFile,
  estimateTokens,
  extractText,
} from "@/lib/aiEmployee/sources";

async function admin(request, { allowSupportToLook = false } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  try {
  // Read-only support may look. Only the GET passes the flag, so support
  // reads the uploaded material and can add or remove none of it —
  // non-negotiable #3, the console views everything and edits nothing.
  if (allowSupportToLook && member.impersonation) return { member };
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      response: NextResponse.json(
        { error: "Only an owner or admin can manage the AI employee's material." },
        { status: 403 },
      ),
    };
  }
  return { member };
}

/** Never returns extractedText. A settings list does not need the document,
 *  and shipping a whole manual into a browser to render a row is waste. */
function publicSource(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    originalFilename: row.originalFilename,
    bytes: row.bytes,
    tokenCount: row.tokenCount,
    status: row.status,
    // An i18n KEY, translated by the screen — see the schema note.
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  };
}

async function employeeFor(companyId) {
  const existing = await db.aiEmployee.findUnique({ where: { companyId } });
  return existing || db.aiEmployee.create({ data: { companyId } });
}

export async function GET(request) {
  const { member, response } = await admin(request, { allowSupportToLook: true });
  if (response) return response;

  const employee = await employeeFor(member.companyId);
  const rows = await db.aiEmployeeSource.findMany({
    where: { companyId: member.companyId, employeeId: employee.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sources: rows.map(publicSource) });
}

export async function POST(request) {
  const { member, response } = await admin(request);
  if (response) return response;

  const employee = await employeeFor(member.companyId);
  const contentType = request.headers.get("content-type") || "";

  let title;
  let kind;
  let filename = null;
  let mimeType = null;
  let bytes = 0;
  let raw = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    filename = typeof file.name === "string" ? file.name : null;
    mimeType = typeof file.type === "string" ? file.type : null;
    bytes = Number(file.size) || 0;
    title = String(form.get("title") || "").trim() || filename || "Untitled";
    kind = String(form.get("kind") || "other");

    // ── The refusal is RECORDED, not thrown away ────────────────────────
    //
    // A contractor who uploads a 40-page PDF manual needs to see that it
    // arrived and was not read. A 400 and a toast is a file that vanished,
    // which reads as a bug and gets uploaded again.
    const verdict = classifySourceFile({ filename, mimeType, bytes });
    if (!verdict.ok) {
      const row = await db.aiEmployeeSource.create({
        data: {
          companyId: member.companyId,
          employeeId: employee.id,
          kind: SOURCE_KINDS.includes(kind) ? kind : "other",
          title,
          originalFilename: filename,
          mimeType,
          bytes,
          status: "failed",
          failureReason: verdict.reason,
        },
      });
      return NextResponse.json({ source: publicSource(row) }, { status: 201 });
    }

    raw = new Uint8Array(await file.arrayBuffer());
  } else {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Paste something first." }, { status: 400 });
    }
    if (text.length > MAX_SOURCE_BYTES) {
      return NextResponse.json(
        { error: "That's longer than one source can hold. Split it in two." },
        { status: 400 },
      );
    }
    title = String(body.title || "").trim() || "Pasted note";
    kind = String(body.kind || "other");
    bytes = Buffer.byteLength(text, "utf8");
    raw = text;
  }

  const extracted = extractText(raw);
  const row = await db.aiEmployeeSource.create({
    data: {
      companyId: member.companyId,
      employeeId: employee.id,
      kind: SOURCE_KINDS.includes(kind) ? kind : "other",
      title: title.slice(0, 200),
      originalFilename: filename,
      mimeType,
      bytes,
      status: extracted.ok ? "ready" : "failed",
      failureReason: extracted.ok ? null : extracted.reason,
      // Null when it failed. Never a placeholder and never the filename — a
      // source with no text contributes nothing to a prompt, and that is the
      // honest state for the screen to show.
      extractedText: extracted.ok ? extracted.text : null,
      tokenCount: extracted.ok ? estimateTokens(extracted.text) : 0,
    },
  });

  return NextResponse.json({ source: publicSource(row) }, { status: 201 });
}
