// lib/agency/nudge.js
//
// "Something may have happened to a lead at this company — send what the
// agency's hooks are owed." Called from the write paths that move a lead
// (createScoredLead, rescoreLead, the quote lifecycle, quote send and view,
// the appointment routes, payment recording, job status) AFTER their own work
// is done, and never awaited: the sweep runs in next/server's after() when
// there is a request to hang it on, and as a detached promise when there is
// not (a webhook, a cron). Either way the user's action has already answered,
// and a failure here is logged and nothing else — the cron
// (app/api/cron/agency-events) sweeps every company with a live subscription
// on a schedule, so a nudge that is lost costs minutes, never an event.
//
// No static imports, on purpose: this file is imported by createLead.js and
// the quote lifecycle, which plain-node check scripts load with a stubbed
// database. The sweep and everything behind it load only when a nudge runs.

/**
 * Fire-and-forget. Never throws, never blocks the caller.
 * `client`: the database the caller itself was handed — a function tested
 * against a fake db (recordStripePayment) nudges against that same fake,
 * never a real connection no fixture controls.
 */
export function nudgeAgencyEvents(companyId, { client } = {}) {
  if (!companyId) return;
  schedule(() =>
    import("@/lib/agency/runEvents")
      .then((m) => m.runAgencyEventsForCompany(companyId, client ? { client } : {}))
      .catch((err) => {
        console.error("[agency-events] nudge failed:", companyId, err?.message);
      }),
  );
}

/**
 * The same, for a write path that holds a row id but not its company (the
 * quote lifecycle, payment recording): the company is looked up inside the
 * deferred work, so the caller pays nothing for it.
 */
export function nudgeAgencyEventsFor(model, id) {
  if (!id || !["quote", "invoice", "appointment", "job", "leadRequest"].includes(model)) return;
  schedule(() =>
    Promise.all([import("@/lib/db"), import("@/lib/agency/runEvents")])
      .then(async ([{ db }, m]) => {
        const row = await db[model].findUnique({ where: { id }, select: { companyId: true } });
        if (row?.companyId) await m.runAgencyEventsForCompany(row.companyId);
      })
      .catch((err) => {
        console.error("[agency-events] nudge failed:", model, id, err?.message);
      }),
  );
}

function schedule(run) {
  // after() exists only inside a Next request; anywhere else the import or
  // the call throws, and the sweep runs detached instead.
  import("next/server")
    .then(({ after }) => {
      try {
        after(run);
      } catch {
        run();
      }
    })
    .catch(() => run());
}
