// app/api/cron/meta-leads/route.js
//
// The polling fallback for Meta lead ads. Every active MetaLeadForm is
// re-read, and anything newer than its cursor is imported.
//
// ══ Why a cron when there is already a webhook ═════════════════════════════
//
// Because Meta's webhook is lossy. Its own documentation says a delivery can
// be dropped, and FieldQuo's endpoint can be down for a deploy, rate-limited,
// or 500ing on a Neon cold start. Every one of those is a homeowner who typed
// their name and number into a painter's ad, waited, and was never called —
// which is the worst outcome this product has, and the reason
// docs/ROADMAP.md's whole pipeline exists.
//
// The two paths overlap on purpose and cannot double-count: both end at
// lib/meta/leadsImport.js's importMetaLead(), which is idempotent on Meta's
// leadgen id, enforced by a unique constraint rather than by a check either
// path could skip.
//
// ══ Gated like every other cron ════════════════════════════════════════════
//
// requireCronSecret — the same helper the other twenty-three use, which
// refuses when CRON_SECRET is unset rather than comparing against the string
// "Bearer undefined". See lib/security/cronAuth.js for what that bug was.
//
// ══ Nothing flows until Meta approves the permission ═══════════════════════
//
// This does real work only for companies with active lead forms, and no
// company can HAVE one until `leads_retrieval` is granted and a Page's forms
// can be read. Until then it finds nothing and says so — it does not pretend
// to have polled something.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { getConnection, getDecryptedToken, recordSyncOutcome } from "@/lib/meta/connection";
import { pollForm } from "@/lib/meta/leadsFetch";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const forms = await db.metaLeadForm.findMany({
    where: { active: true },
    orderBy: { companyId: "asc" },
  });

  // Grouped by company so the connection is read (and the token decrypted)
  // once per tenant rather than once per form.
  const byCompany = new Map();
  for (const form of forms) {
    if (!byCompany.has(form.companyId)) byCompany.set(form.companyId, []);
    byCompany.get(form.companyId).push(form);
  }

  const summary = { companies: 0, forms: 0, created: 0, duplicates: 0, skipped: 0, errors: [] };

  for (const [companyId, companyForms] of byCompany) {
    const connection = await getConnection(companyId);
    if (!connection) {
      summary.errors.push(`company ${companyId}: lead forms are active but the Meta connection is gone`);
      continue;
    }

    let userToken;
    try {
      userToken = getDecryptedToken(connection);
    } catch {
      // A corrupted row after a key rotation — NOT an expired Meta token, and
      // not fixable by reconnecting through Facebook. Recorded as "error" so
      // the settings screen shows it, on exactly the reasoning
      // app/api/meta-ads/sync/route.js uses for the same failure.
      await recordSyncOutcome({
        companyId,
        status: "error",
        error: "Stored token could not be read. Disconnect and reconnect.",
      }).catch(() => {});
      summary.errors.push(`company ${companyId}: stored token unreadable`);
      continue;
    }

    summary.companies += 1;
    // One /me/accounts call per company rather than one per form. In memory,
    // for this run only — see pageTokenFor().
    const pageTokenCache = new Map();

    for (const form of companyForms) {
      summary.forms += 1;
      let result;
      try {
        result = await pollForm({ companyId, userToken, form, pageTokenCache });
      } catch (err) {
        // One form's failure must not abandon another company's leads.
        summary.errors.push(`form ${form.formId}: ${err?.message || String(err)}`);
        continue;
      }

      summary.created += result.created;
      summary.duplicates += result.duplicates;
      summary.skipped += result.skipped;
      for (const e of result.errors) summary.errors.push(e);

      // ── The cursor moves only past leads that were actually handled ──────
      //
      // newestCreatedTime is set from leads this run imported, deduplicated
      // or deliberately skipped — never from one that errored, because
      // advancing past a lead we failed on is how a lost lead becomes
      // permanently lost: the next poll would ask for anything AFTER it and
      // never see it again.
      //
      // Only ever moves forward. A clock skew or an out-of-order page must
      // not rewind the cursor and re-import a month of leads.
      if (
        result.newestCreatedTime &&
        (!form.cursorLeadCreatedAt || result.newestCreatedTime > form.cursorLeadCreatedAt)
      ) {
        await db.metaLeadForm
          .update({
            where: { id: form.id },
            data: { cursorLeadCreatedAt: result.newestCreatedTime },
          })
          .catch((err) => summary.errors.push(`cursor ${form.formId}: ${err?.message}`));
      }
    }
  }

  if (summary.errors.length) {
    console.error(`[cron/meta-leads] ${summary.errors.length} problem(s):`, summary.errors);
  }
  console.log(
    `[cron/meta-leads] ${summary.companies} companies, ${summary.forms} forms, ` +
      `${summary.created} created, ${summary.duplicates} already had.`,
  );

  return NextResponse.json(summary);
}
