// app/api/meta/leads/forms/refresh/route.js
//
// "Find my lead forms" — reads the lead forms on the company's connected
// Facebook Page and stores them as MetaLeadForm rows so the settings panel can
// list real forms rather than ask a contractor to type an id.
//
// ══ Which connection it reads through ══════════════════════════════════════
//
// The FACEBOOK PAGE connection (MetaPageConnection — the "Facebook & Instagram
// publishing" connect), with the page token it stores. Not the Meta Ads
// connection: that one is an ads_read login that cannot see the Page, and
// reading /me/accounts with it is what answered "Lead forms found: 0" for a
// Page that has a form (TrueFinish, 2026-09-28). The choice is made in ONE
// place, lib/meta/leadsFetch.js's resolveLeadsCredential, which the webhook
// and the cron also use.
//
// Every answer names the Page it looked at, and every refusal carries a
// `code` the panel turns into a translated sentence — "found 0" alone could
// not tell a contractor whether the Page has no forms, FieldQuo looked at the
// wrong thing, or Meta refused.
//
// ══ Still gated on the one flag ════════════════════════════════════════════
//
// metaLeadsScopeEnabled() refuses up front, with the reason, before anything
// is read. The button that reaches this is disabled with the same sentence:
// two surfaces, one source of truth, because a screen and a route that
// disagree about whether a feature is on is how a dead control ships.
//
// ══ What it never does ═════════════════════════════════════════════════════
//
// It never turns a form ON. Discovering a form is not consent to import from
// it — a Page can carry a newsletter sign-up as easily as a quote request,
// and importing one would put a stranger who never asked for a quote on a
// contractor's call list. New rows land inactive; an existing row's `active`
// is left exactly as the contractor set it, so a refresh can never silently
// re-enable a form somebody turned off.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaLeadsScopeEnabled } from "@/lib/meta/client";
import { fetchPageForms, resolveLeadsCredential } from "@/lib/meta/leadsFetch";

// English for a caller that shows `error` as-is; the panel shows its own
// translated sentence per `code` instead.
const REFUSALS = {
  no_page_connection: {
    status: 409,
    error: "Connect your Facebook Page first (Facebook & Instagram publishing) — lead forms are read through that connection.",
  },
  token_unreadable: {
    status: 409,
    error: "The stored Page access can't be read. Reconnect the Page.",
  },
  permission_missing: {
    status: 409,
    error: "Meta didn't grant the Page connection every permission lead forms need. Reconnect the Page and allow them.",
  },
  leads_access: {
    status: 502,
    error: "Meta's Leads Access Manager is not letting FieldQuo read this Page's leads. Assign FieldQuo as a CRM for the Page in Meta Business Suite.",
  },
  auth_error: {
    status: 502,
    error: "Meta no longer accepts the stored Page access. Reconnect the Page.",
  },
};

function refusal(code, extra = {}) {
  const r = REFUSALS[code];
  return NextResponse.json({ error: r.error, code, ...extra }, { status: r.status });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  if (!metaLeadsScopeEnabled()) {
    return NextResponse.json(
      {
        error:
          "Facebook lead forms need Meta's approval of one more permission (leads_retrieval). Nothing can be read from your Page until then.",
      },
      { status: 400 },
    );
  }

  const credential = await resolveLeadsCredential(member.companyId);
  if (!credential.ok) {
    const page = credential.pageId ? { id: credential.pageId, name: credential.pageName } : null;
    return refusal(credential.reason, { page, missing: credential.missing || [] });
  }
  const page = { id: credential.pageId, name: credential.pageName };

  let formsRes;
  try {
    formsRes = await fetchPageForms({ credential });
  } catch (err) {
    // graphFetch throws only for FieldQuo's own connectivity — not Meta's
    // answer, so not a refusal to translate.
    return NextResponse.json(
      { error: `Could not reach Meta: ${err?.message || "network error"}`, code: "network", page },
      { status: 502 },
    );
  }
  if (!formsRes.ok) {
    if (REFUSALS[formsRes.kind]) return refusal(formsRes.kind, { page });
    // Meta's message, verbatim, for anything else — a rate limit or a Graph
    // blip is not a broken connection and must not send a contractor round
    // Facebook's consent screen for nothing.
    return NextResponse.json(
      { error: formsRes.message, code: formsRes.kind || "unknown_error", page },
      { status: 502 },
    );
  }

  const seen = [];
  for (const form of Array.isArray(formsRes.data?.data) ? formsRes.data.data : []) {
    if (!form?.id) continue;
    const formId = String(form.id);
    // Upsert on the (companyId, formId) unique. `active` appears only in
    // `create` — never in `update` — which is what makes a refresh unable to
    // re-enable a form the contractor switched off.
    await db.metaLeadForm.upsert({
      where: { companyId_formId: { companyId: member.companyId, formId } },
      create: {
        companyId: member.companyId,
        pageId: page.id,
        pageName: page.name,
        formId,
        name: form.name ? String(form.name) : null,
        active: false,
      },
      update: {
        pageId: page.id,
        pageName: page.name,
        name: form.name ? String(form.name) : null,
      },
    });
    seen.push(formId);
  }

  // Forms that have disappeared from Meta are NOT deleted. A deleted form's
  // past leads still point at it by formId, and removing the row would leave
  // those leads labelled with nothing. Reported instead, so the panel can say
  // "3 forms are no longer on your Page" rather than quietly dropping them.
  const stale = await db.metaLeadForm.count({
    // `notIn: []` is fine in Prisma; what is not fine is the "\x00" sentinel
    // that used to stand in for it. Postgres refuses a NUL byte in text, so
    // the one case the sentinel covered -- a contractor whose Pages carry no
    // lead forms at all -- was the one case that answered 500. Two shapes,
    // no sentinel.
    where: seen.length
      ? { companyId: member.companyId, formId: { notIn: seen } }
      : { companyId: member.companyId },
  });

  return NextResponse.json({ found: seen.length, stale, errors: [], page });
}
