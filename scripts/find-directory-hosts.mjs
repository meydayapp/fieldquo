#!/usr/bin/env node
//
// scripts/find-directory-hosts.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/find-directory-hosts.mjs [--min 20] [--top 30]
//
// READ-ONLY. Which hosts are attached, as `websiteUrl`, to many prospects at
// once — and what each one is.
//
// ══ Why a host shared by twenty prospects is worth a look ═════════════════
//
// Overture attaches one `websites` value to one place record. Twenty records
// naming the same host is one of three things, and the classifier in
// lib/sales/intel/siteKind.js treats them differently:
//
//   a directory     411habitation.com, plumbersnearyou.com, contractors.com
//                   — the listing site itself was written down as the
//                   business's website, and every reader downstream believed
//                   it (Ring A Ling's "website" was a carpet-cleaner
//                   directory). These belong on KNOWN_DIRECTORY_HOSTS, and
//                   this script is how that list is grown from data.
//   a franchise     key.me, minutekey.com, servpro.com, rotorooter.com —
//                   the franchisor's site is the franchisee's own web
//                   presence, and it is NOT a directory. Measured on
//                   2026-09-14 these are the large majority of shared hosts,
//                   which is why the classifier never decides on the count
//                   alone.
//   a platform      maps.app.goo.gl, homeadvisor.com, yp.ca — decided by
//                   host and already on a list.
//
// So the report prints the count AND what the lists already say about each
// host, so the person reading it sees the ones that still need a decision:
// a shared host that is on neither list. It writes nothing and queues
// nothing — adding a host to a list is a code change with a commit message,
// and re-crawling is the owner's call.
//
// The host is derived in SQL from `websiteUrl` rather than read off
// `Prospect.domain`, deliberately: `domain` is what discovery normalised and
// this is a check on the raw column, so the two can be compared by eye.
import "dotenv/config";
import { db } from "@/lib/db";
import { knownDirectoryHost, platformProfileHost } from "@/lib/sales/intel/siteKind";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : Number(args[at + 1]) || fallback;
};
const MIN = flag("--min", 20);
const TOP = flag("--top", 30);

const rows = await db.$queryRawUnsafe(
  `SELECT
     lower(regexp_replace(regexp_replace(regexp_replace("websiteUrl", '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '^www\\.', ''), '[/?#:].*$', '')) AS host,
     count(*)::int AS prospects,
     count(*) FILTER (WHERE "lastCrawledAt" IS NOT NULL)::int AS crawled,
     count(*) FILTER (WHERE "websiteUrl" ~ '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+/.+')::int AS "withPath",
     min("websiteUrl") AS sample
   FROM "Prospect"
   WHERE "websiteUrl" IS NOT NULL AND "websiteUrl" <> ''
   GROUP BY 1
   HAVING count(*) >= $1
   ORDER BY 2 DESC
   LIMIT $2`,
  MIN,
  TOP,
);

const total = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "Prospect" WHERE "websiteUrl" IS NOT NULL AND "websiteUrl" <> ''`);

console.log(`prospects with a websiteUrl: ${total[0].n}`);
console.log(`hosts shared by >= ${MIN} prospects, top ${TOP}:\n`);
console.log(["prospects", "crawled", "with path", "list", "host", "sample"].map((h, i) => h.padEnd([9, 7, 9, 18, 32, 0][i])).join("  "));
let undecided = 0;
for (const r of rows) {
  const list = platformProfileHost(r.host) ? "platform_profile" : knownDirectoryHost(r.host) ? "known directory" : "— not listed";
  if (list === "— not listed") undecided++;
  console.log(
    [String(r.prospects).padEnd(9), String(r.crawled).padEnd(7), String(r.withPath).padEnd(9), list.padEnd(18), String(r.host).slice(0, 32).padEnd(32), String(r.sample).slice(0, 80)].join("  "),
  );
}
console.log(`\n${undecided} of ${rows.length} shared hosts are on neither list — a franchise, a chain, or a directory nobody has named yet.`);
console.log("Nothing was written and nothing was queued.");
await db.$disconnect();
