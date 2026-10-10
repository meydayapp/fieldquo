// scripts/portal-links-dry-run.mjs
//
//   node --env-file=<path/to/.env> --import ./scripts/alias-loader.mjs \
//     scripts/portal-links-dry-run.mjs --company <companyId> [--days 30]
//
// What the Clients page's "Email clients their portal link" WOULD send for one
// company, printed and NOT done: every eligible client (name, email, why
// eligible), how many were skipped and why, and the rendered subject and body
// of the email the first recipient would get.
//
// READ-ONLY, twice over. It calls lib/portal/bulkLinks.js with dryRun: true —
// the mode that mints no token, sends nothing and writes no SentEmail row —
// and it hands that code a database wrapped so that any write method throws
// before it reaches Postgres. There is no flag that turns this into a send;
// sending is the POST route behind an explicit confirm, and nothing else.

import { db as realDb } from "@/lib/db";
import { sendBulkPortalLinks, DRY_RUN_LINK, RECENT_LINK_DAYS, BULK_BATCH } from "@/lib/portal/bulkLinks";
import { SENDER_SELECT } from "@/lib/email/resend";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const companyId = arg("--company");
const days = arg("--days") ? Number(arg("--days")) : RECENT_LINK_DAYS;
if (!companyId || !/^[a-z0-9]{10,40}$/i.test(companyId) || !Number.isFinite(days) || days < 0) {
  console.error("usage: scripts/portal-links-dry-run.mjs --company <companyId> [--days 30]");
  process.exit(2);
}

// ── The read-only wrapper ───────────────────────────────────────────────────
//
// Every model delegate is proxied: find*/count/aggregate/groupBy pass through,
// anything else throws. $executeRaw / $transaction / $queryRawUnsafe throw too
// — the dry run has no reason to touch them.
const READS = new Set(["findMany", "findFirst", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "count", "aggregate", "groupBy"]);
const writesAttempted = [];
function readOnly(db) {
  return new Proxy(db, {
    get(target, model) {
      const delegate = target[model];
      if (typeof model === "string" && model.startsWith("$")) {
        if (model === "$disconnect") return delegate?.bind(target);
        return () => {
          writesAttempted.push(model);
          throw new Error(`read-only dry run: ${model} refused`);
        };
      }
      if (!delegate || typeof delegate !== "object") return delegate;
      return new Proxy(delegate, {
        get(d, method) {
          const fn = d[method];
          if (typeof fn !== "function") return fn;
          if (READS.has(method)) return fn.bind(d);
          return () => {
            writesAttempted.push(`${String(model)}.${String(method)}`);
            throw new Error(`read-only dry run: ${String(model)}.${String(method)} refused`);
          };
        },
      });
    },
  });
}

const db = readOnly(realDb);
const line = (s = "") => console.log(s);

try {
  // Neon scales to zero; the first query after idle can fail once (AGENTS.md).
  let company;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      company = await db.company.findUnique({
        where: { id: companyId },
        select: { ...SENDER_SELECT, id: true, slug: true, bookingSlug: true, logoUrl: true, brandColor: true, phone: true, defaultLanguage: true },
      });
      break;
    } catch (err) {
      if (attempt === 1 || !/P1001|ECONN|timeout/i.test(String(err?.message))) throw err;
    }
  }
  if (!company) {
    console.error(`No company ${companyId}.`);
    process.exit(1);
  }

  const out = await sendBulkPortalLinks({ db, companyId, company, dryRun: true, windowDays: days });
  if (!out.dryRun) throw new Error("expected a dry run");

  const slug = company.bookingSlug || company.slug;
  line(`DRY RUN — nothing was sent, no link was minted, nothing was written.`);
  line();
  line(`Company:        ${company.name} (${company.id})`);
  line(`Login page:     https://www.fieldquo.com/portal/login/${slug}`);
  line(`Clients:        ${out.total}`);
  line(`Eligible:       ${out.recipients.length}${out.recipients.length > out.batch ? ` (one press sends ${out.batch}; press again for the rest)` : ""}`);
  line(`Skipped:        no email ${out.skipped.no_email} · opted out / do-not-contact ${out.skipped.opted_out} · nothing open ${out.skipped.inactive} · emailed a link in the last ${days} days ${out.skipped.recent}`);
  line(`Batch per press: ${BULK_BATCH}`);
  line();
  line(`Eligible recipients:`);
  out.recipients.forEach((r, i) => {
    const why = r.why.map((w) => (w.kind === "job" ? `open job "${w.label}" (${w.status})` : `quote ${w.label} (${w.status})`)).join("; ");
    line(`  ${String(i + 1).padStart(3)}. ${r.name} <${r.email}> — ${why}`);
  });
  if (out.sample) {
    line();
    line(`Email for ${out.sample.name} <${out.sample.to}> (language: ${out.sample.language}; the link reads ${DRY_RUN_LINK} until a real send mints it):`);
    line(`  Subject: ${out.sample.subject}`);
    line(`  ── text part ──`);
    for (const l of out.sample.text.split("\n")) line(`  ${l}`);
    // White-label, measured on what a reader can SEE: text and alt text, not
    // the src/href of an image or link (a logo stored under a Cloudinary
    // folder named after us is an address, not a word on the page).
    const visible = out.sample.html.replace(/\s(?:src|href)="[^"]*"/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const inAddress = /fieldquo/i.test(out.sample.html) && !/fieldquo/i.test(visible);
    line(`  ── html part: ${out.sample.html.length} characters; "FieldQuo" in visible text: ${/fieldquo/i.test(visible) ? "YES" : "no"}${inAddress ? " (appears only inside a link/image address)" : ""} ──`);
  }
  line();
  line(`Writes attempted: ${writesAttempted.length ? writesAttempted.join(", ") : "none"}`);
} finally {
  await realDb.$disconnect?.().catch(() => {});
}
