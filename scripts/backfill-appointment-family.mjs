// scripts/backfill-appointment-family.mjs
//
//   node --env-file=.env scripts/backfill-appointment-family.mjs           # dry run
//   node --env-file=.env scripts/backfill-appointment-family.mjs --apply   # writes
//
// Appointments written before the family fill (lib/schedule/appointmentFamily.js)
// carry the ONE link they were booked against — Maureen Faulkner's Oct 10
// visit has invoiceId and nothing else, so the job and the quote never list
// it. This lists every appointment with a quote, job or invoice link whose
// family names records it is missing, and what it would fill.
//
// Rules, the same as the live fill:
//   - only NULL links are filled; a link that is set is never overwritten
//     (the UPDATE is COALESCE(column, value), so even a row changed between
//     the read and the write keeps what it had);
//   - every candidate record is the appointment's OWN company's;
//   - a link is filled only when the family names exactly one record of that
//     kind (an invoice family counts once, by its root);
//   - aboutKind is recorded (when null) as what the row was about before the
//     fill — invoice, else job, else quote — so its label does not change;
//   - clientId is never touched.
//
// The dry run runs inside BEGIN TRANSACTION READ ONLY … ROLLBACK and needs no
// schema change. --apply needs the Appointment.aboutKind column (the SQL in
// the change that added this script) and refuses without it.
import pg from "pg";
import { familyOf, familyFill, legacyAboutKind } from "../lib/schedule/appointmentFamily.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
const q = async (sql, args = []) => (await client.query(sql, args)).rows;

let exitCode = 0;
try {
  await client.query(APPLY ? "BEGIN" : "BEGIN TRANSACTION READ ONLY");
  const hasAboutKind =
    (await q(`select 1 from information_schema.columns where table_name = 'Appointment' and column_name = 'aboutKind'`)).length > 0;
  if (APPLY && !hasAboutKind) {
    throw new Error('Appointment."aboutKind" does not exist yet — apply the SQL first, then run --apply.');
  }
  const appts = await q(
    `select id, "companyId", "clientId", "quoteId", "jobId", "invoiceId"${hasAboutKind ? `, "aboutKind"` : ""}
       from "Appointment"
      where "quoteId" is not null or "jobId" is not null or "invoiceId" is not null
      order by "createdAt" asc`,
  );
  const companies = [...new Set(appts.map((a) => a.companyId))];
  const rowsBy = new Map();
  for (const companyId of companies) {
    rowsBy.set(companyId, {
      quotes: await q(`select id, "companyId" from "Quote" where "companyId" = $1`, [companyId]),
      jobs: await q(`select id, "companyId", "quoteId" from "Job" where "companyId" = $1`, [companyId]),
      invoices: await q(`select id, "companyId", "quoteId", "jobId", "parentInvoiceId" from "Invoice" where "companyId" = $1`, [companyId]),
    });
  }

  let toFill = 0;
  let written = 0;
  console.log(`${APPLY ? "APPLY" : "DRY RUN (read-only)"} — ${appts.length} appointment(s) carry a quote, job or invoice link\n`);
  for (const a of appts) {
    const about = (hasAboutKind && ["quote", "job", "invoice"].includes(a.aboutKind) ? a.aboutKind : null) || legacyAboutKind(a);
    const aboutId = a[`${about}Id`];
    const family = familyOf({ kind: about, id: aboutId, companyId: a.companyId, rows: rowsBy.get(a.companyId) });
    const fill = familyFill({ ...a, aboutKind: hasAboutKind ? a.aboutKind : null }, family, about);
    const links = Object.keys(fill).filter((k) => k !== "aboutKind");
    if (!links.length) continue;
    toFill++;
    console.log(
      `appointment ${a.id} (company ${a.companyId}) about ${about} ${aboutId}\n` +
        `  has     quoteId=${a.quoteId ?? "NULL"} jobId=${a.jobId ?? "NULL"} invoiceId=${a.invoiceId ?? "NULL"}\n` +
        `  fill    ${links.map((k) => `${k}=${fill[k]}`).join(" ")}${fill.aboutKind ? ` aboutKind=${fill.aboutKind}` : ""}`,
    );
    if (APPLY) {
      const r = await client.query(
        `update "Appointment"
            set "quoteId" = coalesce("quoteId", $2),
                "jobId" = coalesce("jobId", $3),
                "invoiceId" = coalesce("invoiceId", $4),
                "aboutKind" = coalesce("aboutKind", $5)
          where id = $1 and "companyId" = $6`,
        [a.id, fill.quoteId ?? null, fill.jobId ?? null, fill.invoiceId ?? null, fill.aboutKind ?? null, a.companyId],
      );
      written += r.rowCount;
    }
  }
  console.log(`\n${toFill} appointment(s) ${APPLY ? `filled (${written} row(s) written)` : "would be filled"}.`);
  await client.query(APPLY ? "COMMIT" : "ROLLBACK");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err.message);
  exitCode = 1;
} finally {
  await client.end();
}
process.exit(exitCode);
