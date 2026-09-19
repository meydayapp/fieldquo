// app/api/settings/document-emails/route.js
//
// The document emails — quote, invoice, reminder, receipt, deposit request —
// as the settings page sees them: the ORIGINAL's wording per language (from
// code, read-only) and the company's COPIES (rows, editable).
//
//   GET   → { kinds, languages, originals: { [kind]: { [language]: slots } },
//             copies: [ { id, kind, language, active, slots, sentMode, … } ] }
//   POST  { kind, language } → create (or return) the copy, seeded from the
//           original. Not switched on; that is a separate, deliberate PATCH.
//
// The original is never written: there is no route that could, because it is
// not a row (lib/email/documentEmailWording.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  DOCUMENT_EMAIL_KINDS,
  COPY_LANGUAGES,
  ORIGINAL_LANGUAGES,
  WORDING_SLOTS,
  WORDING_TOKENS,
  originalWording,
  documentEmailKind,
} from "@/lib/email/documentEmailWording";
import { listDocumentEmailCopies, ensureDocumentEmailCopy } from "@/lib/email/documentEmailCopies";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const originals = {};
  for (const { kind } of DOCUMENT_EMAIL_KINDS) {
    originals[kind] = {};
    for (const language of ORIGINAL_LANGUAGES) {
      originals[kind][language] = originalWording(kind, language);
    }
  }

  return NextResponse.json({
    kinds: DOCUMENT_EMAIL_KINDS.map(({ kind, labelKey }) => ({ kind, labelKey })),
    languages: COPY_LANGUAGES,
    originalLanguages: ORIGINAL_LANGUAGES,
    slots: WORDING_SLOTS,
    tokens: WORDING_TOKENS,
    originals,
    copies: await listDocumentEmailCopies(db, member.companyId),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can manage email templates" }, { status: 403 });
  }

  const { kind, language } = await request.json().catch(() => ({}));
  if (!documentEmailKind(kind)) {
    return NextResponse.json({ error: `kind must be one of ${DOCUMENT_EMAIL_KINDS.map((k) => k.kind).join(", ")}` }, { status: 400 });
  }
  if (!COPY_LANGUAGES.includes(language)) {
    return NextResponse.json({ error: `language must be one of ${COPY_LANGUAGES.join(", ")}` }, { status: 400 });
  }

  const copy = await ensureDocumentEmailCopy(db, { companyId: member.companyId, kind, language });
  return NextResponse.json(copy, { status: 201 });
}
