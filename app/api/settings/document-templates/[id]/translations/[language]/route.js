// app/api/settings/document-templates/[id]/translations/[language]/route.js
//
// One translation of one email template, for the Review / Edit screen.
//
//   GET   → every string of the template in reading order: the source, the
//           translation (if any), and whether it is out of date or refused.
//   PATCH { strings?: { "<path>": "text" }, approve?: true|false }
//         → save a person's wording (every {{token}} must survive — a save that
//           drops or adds one is refused whole), approve it for sending, or
//           stop using it. No model call here, ever.
//
// Next 16: `params` is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isSupported } from "@/app/i18n/languages";
import { extractStrings, templateLanguageOf, mergeTokensOf } from "@/lib/email/templateTranslation";
import { reviewTemplateTranslation, summariseTranslations } from "@/lib/email/templateTranslationStore";
import { isPdfTemplate } from "@/lib/documents/templateKind";

async function load(id, language, companyId) {
  const template = await db.documentTemplate.findFirst({ where: { id: String(id), companyId, documentKind: null } });
  if (!template || isPdfTemplate(template.type)) return { template: null };
  const lang = String(language || "").toLowerCase();
  if (!isSupported(lang)) return { template, lang: null };
  const [company, row] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { id: true, defaultLanguage: true } }),
    db.templateTranslation.findFirst({ where: { templateId: template.id, companyId, language: lang } }),
  ]);
  return { template, lang, company, row };
}

export async function GET(request, { params }) {
  const { id, language } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { template, lang, company, row } = await load(id, language, member.companyId);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lang) return NextResponse.json({ error: "Unsupported language", code: "bad_language" }, { status: 400 });

  const saved = row?.strings && typeof row.strings === "object" ? row.strings : {};
  const problems = new Map((Array.isArray(row?.problems) ? row.problems : []).map((p) => [p.path, p.reason]));
  const strings = extractStrings(template).map((s) => {
    const entry = saved[s.path] || null;
    return {
      path: s.path,
      source: s.text,
      tokens: mergeTokensOf(s.text),
      text: entry?.text || "",
      edited: Boolean(entry?.edited),
      // Drafted from wording the template no longer has.
      stale: Boolean(entry && entry.src !== s.text),
      problem: problems.get(s.path) || null,
    };
  });
  const summary = summariseTranslations({ template, company, rows: row ? [row] : [] }).find((l) => l.language === lang) || null;

  return NextResponse.json({
    language: lang,
    sourceLanguage: templateLanguageOf(template, company),
    status: row?.status || null,
    summary,
    strings,
  });
}

export async function PATCH(request, { params }) {
  const { id, language } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can manage email templates", code: "forbidden" }, { status: 403 });
  }

  const { template, lang, company, row } = await load(id, language, member.companyId);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lang) return NextResponse.json({ error: "Unsupported language", code: "bad_language" }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Translate this language first.", code: "no_translation" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const approve = body?.approve === true ? true : body?.approve === false ? false : undefined;
  const result = await reviewTemplateTranslation({
    row,
    template,
    company,
    edits: body?.strings || {},
    approve,
    userId: member.userId || null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, code: result.code, reason: result.reason || null, errors: result.errors || [] },
      { status: result.code === "token_mismatch" ? 422 : 409 },
    );
  }
  return NextResponse.json({ ok: true, status: result.row.status });
}
