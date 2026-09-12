// lib/meta/leadsWebhookIngest.js
//
// The `leadgen` half of a Page webhook delivery, as one function — so it can
// run behind EITHER callback URL.
//
// ══ Why two routes share this ══════════════════════════════════════════════
//
// Meta's App Dashboard takes ONE callback URL per webhook object. The Page
// object carries both `messages` (a homeowner writing to the Page) and
// `leadgen` (a homeowner filling in a lead-ad form), and the code answers
// them at two URLs — /api/meta/messaging/webhook and /api/meta/leads/webhook.
// Whichever URL the dashboard holds receives BOTH fields; the other receives
// nothing. Before this file, a `leadgen` change arriving at the messaging
// route was counted as "dropped" and lost until the hourly poll, and a
// `messages` event arriving at the leads route was silently skipped.
//
// So the loop lives here, and each route calls it for the changes it sees.
// The routes keep their own signature check and their own answer-status
// policy (the leads route asks Meta to retry with a 500; the messaging route
// never does, and leans on app/api/cron/meta-leads for the second attempt —
// both reasons are written at the call sites).
//
// Pure apart from the database and Graph calls it always made; executed by
// scripts/check-meta-leads-webhook.mjs.
import { db } from "@/lib/db";
import { resolveCompanyForPage } from "@/lib/meta/leadsImport";
import { ingestLeadgenId } from "@/lib/meta/leadsFetch";
import { getConnection } from "@/lib/meta/connection";

/** True when at least one entry carries a `leadgen` change. */
export function hasLeadgenChanges(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  return entries.some((entry) =>
    (Array.isArray(entry?.changes) ? entry.changes : []).some((c) => c?.field === "leadgen"),
  );
}

/**
 * Walk every `leadgen` change in a (signature-verified, parsed) Page webhook
 * body and import each lead.
 *
 * @returns {Promise<{ results: object[], retryNeeded: boolean }>}
 *   `retryNeeded` is true when at least one lead failed for a reason a later
 *   delivery could fix (rate limit, Graph blip). What to do with that is the
 *   caller's decision.
 */
export async function ingestLeadgenChanges(body, { log = "meta/leads/webhook" } = {}) {
  // Meta batches: several entries, each with several changes. Every one is
  // processed, and one failing does not abandon the rest.
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let retryNeeded = false;
  const results = [];

  for (const entry of entries) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue; // Another subscription's field.
      const value = change.value || {};
      const leadgenId = value.leadgen_id ? String(value.leadgen_id) : null;
      // The Page from the ENTRY, falling back to the change value. Both are
      // Meta's; neither is trusted as a tenant — they are lookup keys.
      const pageId = String(value.page_id || entry?.id || "");
      const formId = value.form_id ? String(value.form_id) : null;
      if (!leadgenId || !pageId) {
        results.push({ leadgenId, status: "skipped", reason: "incomplete_payload" });
        continue;
      }

      const companyId = await resolveCompanyForPage(pageId);
      if (!companyId) {
        // No company has ever registered this Page. Acknowledged, not retried:
        // Meta redelivering it for hours will not make the Page ours, and this
        // is the ordinary state of a webhook subscribed at APP level while
        // only some Pages are connected.
        results.push({ leadgenId, status: "skipped", reason: "unknown_page" });
        continue;
      }

      // The form has to be one this company switched ON. A form row that
      // does not exist is also a refusal — a delivery for a form nobody has
      // seen in the settings panel is not something to import silently.
      const form = await db.metaLeadForm.findFirst({
        where: { companyId, ...(formId ? { formId } : { pageId }) },
        select: { active: true, formId: true },
      });
      if (!form?.active) {
        results.push({ leadgenId, status: "skipped", reason: "form_inactive" });
        continue;
      }

      const connection = await getConnection(companyId);
      if (!connection) {
        // The Page is registered but the ad-account connection is gone, so
        // there is no token to fetch the lead with. Not retryable by Meta —
        // it needs a human to reconnect — so it is acknowledged and logged
        // loudly rather than turned into an hours-long retry storm.
        console.error(
          `[${log}] company ${companyId} has lead forms but no Meta connection — lead ${leadgenId} could not be fetched.`,
        );
        results.push({ leadgenId, status: "skipped", reason: "no_connection" });
        continue;
      }

      let result;
      try {
        result = await ingestLeadgenId({
          companyId,
          connection,
          pageId,
          formId: form.formId || formId,
          leadgenId,
        });
      } catch (err) {
        console.error(`[${log}] lead ${leadgenId} threw: ${err?.message}`);
        result = { status: "error", retryable: true, reason: "exception" };
      }

      if (result.status === "error" && result.retryable) retryNeeded = true;
      if (result.status === "error") {
        console.error(
          `[${log}] lead ${leadgenId} failed (${result.reason}): ${result.message || ""}`,
        );
      }
      results.push({ leadgenId, ...result });
    }
  }

  return { results, retryNeeded };
}
