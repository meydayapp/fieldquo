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
//
// ══ And the history walk (2026-10-03) ══════════════════════════════════════
//
// A form that has never been polled is not polled: its ninety days of
// history are lib/meta/historyBackfill.js's job, which imports them silently
// (no "new lead" alert for a July enquiry) and sets the form's cursor when it
// finishes. This cron queues that walk for any active form that has none,
// runs the walk's next chunks, and only then polls the forms that have a
// cursor. A form whose walk stopped on an error is polled the old way, so a
// broken walk can never leave a form deaf.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { pollForm, resolveLeadsCredential } from "@/lib/meta/leadsFetch";
import { ensureBackfills, continueBackfills } from "@/lib/meta/historyBackfill";

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

  const summary = { companies: 0, forms: 0, created: 0, duplicates: 0, linked: 0, skipped: 0, errors: [], history: [] };

  // ── History first: queue a walk for every never-polled form, run chunks ──
  //
  // "Never polled" is read ONCE, here, before the walk runs — a walk that
  // finishes this tick sets the form's cursor, and the poll below must not
  // then read the same window a second time in the same run.
  const neverPolled = new Set(forms.filter((f) => !f.cursorLeadCreatedAt).map((f) => f.id));
  const walks = await db.metaHistoryBackfill
    .findMany({ where: { kind: "lead_form" }, select: { scopeId: true, status: true } })
    .catch(() => []);
  const walkFor = new Map(walks.map((w) => [w.scopeId, w.status]));
  const needWalk = [...new Set(forms.filter((f) => !f.cursorLeadCreatedAt && !walkFor.has(f.id)).map((f) => f.companyId))];
  for (const companyId of needWalk) {
    await ensureBackfills({ companyId, scope: "leads" }).catch((err) => summary.errors.push(`history ${companyId}: ${err?.message}`));
  }
  summary.history = await continueBackfills({ kinds: ["lead_form"], budgetMs: 120000, maxRows: 20 }).catch((err) => {
    summary.errors.push(`history: ${err?.message}`);
    return [];
  });
  // The walk's leads are this cron's leads: counted in the same totals, and
  // a walk Meta refused is an error in the same list as a refused poll.
  for (const h of summary.history) {
    summary.created += h.delta?.created || 0;
    summary.duplicates += h.delta?.duplicates || 0;
    summary.linked += h.delta?.linked || 0;
    summary.skipped += h.delta?.skipped || 0;
    if (h.status === "rate_limited" || h.status === "error") {
      summary.errors.push(`history ${h.kind} ${h.id}: ${h.lastErrorKind || h.error || h.status}`);
    }
  }
  const walksNow = await db.metaHistoryBackfill
    .findMany({ where: { kind: "lead_form" }, select: { scopeId: true, status: true } })
    .catch(() => []);
  const walkStatus = new Map(walksNow.map((w) => [w.scopeId, w.status]));

  for (const [companyId, companyForms] of byCompany) {
    // The Page connection's stored page token, resolved once per company —
    // the same credential the webhook and "Find my lead forms" use (see
    // resolveLeadsCredential). It used to be the AD connection's user token,
    // which cannot see the Page. No sync status is written on a refusal: the
    // ad connection's status describes the spend sync, and a Page problem
    // stamped on it would tell a contractor their ads stopped syncing.
    const credential = await resolveLeadsCredential(companyId);
    if (!credential.ok) {
      summary.errors.push(
        `company ${companyId}: lead forms are active but ${credential.reason}` +
          (credential.missing ? ` (${credential.missing.join(",")})` : ""),
      );
      continue;
    }

    summary.companies += 1;

    for (const form of companyForms) {
      // History still walking: not polled (see the header). An errored walk
      // falls back to the poll.
      if (neverPolled.has(form.id) && walkStatus.has(form.id) && walkStatus.get(form.id) !== "error") continue;
      summary.forms += 1;
      let result;
      try {
        result = await pollForm({ companyId, credential, form });
      } catch (err) {
        // One form's failure must not abandon another company's leads.
        summary.errors.push(`form ${form.formId}: ${err?.message || String(err)}`);
        continue;
      }

      summary.created += result.created;
      summary.duplicates += result.duplicates;
      summary.linked += result.linked || 0;
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
      //
      // And never when the poll stopped short of the end of Meta's pages
      // (`incomplete`): moving past the newest lead of a window it did not
      // finish is exactly how the leads beyond the first hundred were lost.
      if (
        !result.incomplete &&
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
