// scripts/check-tenant-surfaces.mjs
//
//   npm run check:tenant-surfaces
//
// The four surfaces a stranger sees on a contractor's own hostname: the client
// portal, the booking page, the embeds, and the generated website. Every
// assertion here is a bug that shipped, and most of them are the same bug
// twice — a page that reads a value nobody writes, or writes one nobody reads.
//
// ══ 1. The passthrough that ate two pages of every website ═════════════════
//
// middleware.js rewrites sunset.fieldquo.com/<path> to /site/sunset/<path>,
// with a short list of prefixes that must resolve on a tenant host instead:
// /book, /quote, /q, /portal and so on, so a link the contractor sent lands on
// the booking form rather than their marketing page.
//
// It matched `pathname === p` as well as `pathname.startsWith(p + "/")`. Not
// one of those prefixes has an index route — /book is app/book/[companySlug] —
// so the bare arm could only ever 404. What it also did was swallow `/book`
// and `/quote`, which are entries in the site builder's own PAGE_CATALOGUE and
// therefore two of the six links in the header menu of a default multi-page
// site. Both answered with app/not-found.js: FieldQuo's marketing 404, our
// nav, our pricing, our footer, on the contractor's hostname — the exact leak
// app/site/[subdomain]/not-found.js exists to stop, which never fired because
// the request was never rewritten far enough to reach it.
//
// Asserted by EXECUTING the predicate lifted out of middleware.js, against the
// real page catalogue. Reading it for the words "startsWith" would pass on
// `if (false && …)`.
//
// ══ 2. The tab title is a white-label surface ══════════════════════════════
//
// /book/<slug> had no title of its own, so it inherited the root layout's:
// "FieldQuo", in the tab, on a link contractors put in email signatures. The
// embed route had already closed this and written down why; the page it embeds
// had not.
//
// ══ 3. A field selected and never forwarded ════════════════════════════════
//
// The portal API's invoice query gained `jobPaymentStages` when the payment
// schedule landed. The response builder — an allow-list, written earlier — did
// not, so the stage never reached the browser: a deposit email's own ?stage=
// link showed the invoice's FULL balance and a "Pay $12,000" button, while the
// pay route charged the $3,000 the email had asked for. This holds every
// selected column to being either forwarded or named as computed-only.
//
// ══ 4. A raw enum on a translated page ═════════════════════════════════════
//
// The portal printed Quote.status through a `capitalize` class, so a French
// client's account read "Accepted" under "Soumissions". The map is held
// against prisma/schema.prisma rather than against the four values someone
// remembered, in every language the table has — a count derived from the
// catalogue, never written down here.
//
// ══ 5. Site chrome that reads a key nothing writes ═════════════════════════
//
// Four star rows in SiteBlocks.js read `item.fiveStars` and the largest
// testimonial read `item.eyebrowTestimonials` — `item` is `{quote, author}`,
// so both were undefined and the eyebrow rendered nothing at all. Generalised:
// every `t.<key>` in that file must exist in the siteCopy table.
//
// ══ 6. English leaking through a translated website ════════════════════════
//
// The header pill said "Fermé · ouvre Friday 8:00 a.m." and the hours table
// said "Mon – Fri" and "Closed", because businessHours.js had one English
// weekday table and no way to pass a locale through. Executed, not read.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, decomment, balanced } from "./tenantScopeScan.mjs";
import { PAGE_CATALOGUE, HOME_SLUG } from "@/lib/site/pages";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";
import { SITE_COPY } from "@/lib/site/siteCopy";
import { groupHours, openState, dayNames } from "@/lib/company/businessHours";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty label becomes the condition and this file
// can never fail — which has happened in this repo before.
const ok = (label, cond, detail) =>
  cond
    ? (pass++, undefined)
    : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
// Every regex assertion below runs on a decommented source. This file's own
// subjects spend paragraphs describing the behaviour they must not have —
// middleware.js names `pathname === p`, SiteBlocks.js names `item.fiveStars` —
// and a raw read cannot tell the confession from the crime.
const src = (p) => decomment(read(p));

const MIDDLEWARE = "middleware.js";
const BOOK_PAGES = [
  "app/book/[companySlug]/page.js",
  "app/book/[companySlug]/[eventSlug]/page.js",
];
const PORTAL_ROUTE = "app/api/portal/[token]/route.js";
const CLIENT_PORTAL = "app/portal/[token]/ClientPortal.js";
const SITE_BLOCKS = "app/site/[subdomain]/SiteBlocks.js";

/* ══ 1. The subdomain passthrough ═════════════════════════════════════════ */
{
  const mw = src(MIDDLEWARE);

  const listStart = mw.indexOf("const SUBDOMAIN_PASSTHROUGH");
  ok("middleware.js still declares SUBDOMAIN_PASSTHROUGH", listStart >= 0);
  const listText = balanced(mw, mw.indexOf("[", listStart));
  const prefixes = JSON.parse(listText.replace(/,(\s*])/, "$1"));
  ok(
    "the passthrough list is non-empty and every entry is an absolute path",
    prefixes.length > 0 && prefixes.every((p) => /^\/[a-z-]+$/.test(p)),
    JSON.stringify(prefixes),
  );

  // Lift the real predicate out and RUN it. Not "does the source say
  // startsWith" — `if (false && pathname.startsWith(...))` says startsWith.
  const someAt = mw.indexOf("SUBDOMAIN_PASSTHROUGH.some(");
  ok("middleware.js still matches the passthrough with .some()", someAt >= 0);
  const someArgs = balanced(mw, mw.indexOf("(", someAt));
  const arrow = someArgs.match(/\(p\)\s*=>\s*([\s\S]+?)\s*,?\s*\)$/);
  ok("the passthrough predicate is a single (p) => … arrow", Boolean(arrow), someArgs.slice(0, 120));
  const matches = arrow
    ? new Function("pathname", "prefixes", `return prefixes.some((p) => ${arrow[1]});`)
    : () => true;

  // Every page a site can have must survive the rewrite. `book` and `quote` are
  // in this list, which is the whole point: they are what the bare-equality arm
  // was eating.
  for (const page of PAGE_CATALOGUE) {
    if (page.slug === HOME_SLUG) continue;
    ok(
      `a website page at /${page.slug} is rewritten to the tenant's site, not passed through`,
      !matches(`/${page.slug}`, prefixes),
      "middleware would hand this to the app, which has no index route for it — FieldQuo's own 404 answers on the contractor's hostname",
    );
  }

  // …and the client links it exists for still pass through.
  for (const p of prefixes) {
    ok(
      `${p}/<segment> still passes through on a tenant host`,
      matches(`${p}/abc123`, prefixes),
      "a link the contractor sent would render their marketing site instead",
    );
  }

  // The fix rests on this fact, so it is asserted rather than assumed: if
  // someone adds app/book/page.js tomorrow, the bare arm becomes meaningful
  // again and this has to be reconsidered rather than silently wrong.
  for (const p of prefixes) {
    ok(
      `no index route exists at app${p}/page.js, so a bare ${p} was only ever a 404`,
      !existsSync(join(ROOT, `app${p}`, "page.js")),
      "this prefix now has an index page — the passthrough needs to match it again, and a colliding site page slug needs a decision",
    );
  }
}

/* ══ 2. Booking page titles ═══════════════════════════════════════════════ */
for (const file of BOOK_PAGES) {
  const s = src(file);
  ok(
    `${file} resolves its own <title> from the company`,
    /export\s+async\s+function\s+generateMetadata/.test(s) &&
      /title:\s*company\?\.name/.test(s),
    "with no title of its own this page inherits the root layout's, which is \"FieldQuo\" — in the tab, on a link a contractor put in their email signature",
  );
  ok(
    `${file} has no static metadata export to shadow it`,
    !/export\s+const\s+metadata\s*=/.test(s),
    "two metadata sources on one route",
  );
}

/* ══ 3. Nothing selected by the portal route is dropped on the way out ════ */
{
  const s = src(PORTAL_ROUTE);

  // The `invoices: { … }` sub-query's own select, and the object literal the
  // response builder returns for each invoice.
  const invAt = s.indexOf("invoices: {");
  ok("the portal route still has an invoices sub-query", invAt >= 0);
  const invBlock = balanced(s, s.indexOf("{", invAt));
  const selAt = invBlock.indexOf("select: {");
  // Only the OUTERMOST keys of that select. `jobPaymentStages` is a relation
  // with its own where/orderBy/select nested under it, and a depth-blind scan
  // reads those Prisma operators as columns.
  const selText = balanced(invBlock, invBlock.indexOf("{", selAt));
  const keyed = [...selText.matchAll(/^([ \t]+)(\w+):/gm)];
  const topIndent = Math.min(...keyed.map((m) => m[1].length));
  const selected = keyed.filter((m) => m[1].length === topIndent).map((m) => m[2]);
  ok("the invoice select names fields", selected.length > 5, selected.join(","));

  const mapAt = s.indexOf("const invoices = client.invoices.map");
  ok("the portal route still maps invoices into an allow-list", mapAt >= 0);
  const forwarded = new Set(
    [...balanced(s, s.indexOf("{", s.indexOf("return {", mapAt))).matchAll(/^\s+(\w+):/gm)].map(
      (m) => m[1],
    ),
  );

  // Read to COMPUTE something, never forwarded. Named individually: the point
  // of the check is that "it was only for the tax statement" has to be a claim
  // someone made on purpose, not the default for anything that goes missing.
  const COMPUTED_ONLY = new Set(["taxEnabled", "createdAt"]);
  for (const field of selected) {
    ok(
      `the portal payload forwards or explicitly withholds \`${field}\``,
      forwarded.has(field) || COMPUTED_ONLY.has(field),
      "selected from the database and dropped by the allow-list — the browser never sees it, and whatever reads it renders its fallback instead (this is how ?stage= showed the full balance)",
    );
  }
  ok(
    "…including jobPaymentStages, the one this was written for",
    selected.includes("jobPaymentStages") && forwarded.has("jobPaymentStages"),
    `selected=${selected.includes("jobPaymentStages")} forwarded=${forwarded.has("jobPaymentStages")}`,
  );
}

/* ══ 4. The quote pill: every enum value, in every language ═══════════════ */
{
  const schema = read("prisma/schema.prisma");
  const enumBlock = schema.slice(schema.indexOf("enum QuoteStatus {"));
  const values = enumBlock
    .slice(0, enumBlock.indexOf("}"))
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/.test(l));
  ok("QuoteStatus was parsed out of prisma/schema.prisma", values.length >= 3, values.join(","));

  // Derived from the table, never a number written here. Seven checks in this
  // repo have already been fixed for hardcoding a language count.
  for (const [code, table] of Object.entries(CLIENT_DOC_COPY)) {
    const map = table.quoteStatus || {};
    const missing = values.filter((v) => !map[v]);
    const extra = Object.keys(map).filter((k) => !values.includes(k));
    ok(
      `clientDocCopy "${code}" labels every QuoteStatus (${values.length} values)`,
      missing.length === 0 && extra.length === 0,
      [...missing.map((v) => `missing ${v}`), ...extra.map((v) => `extra ${v}`)].join(", "),
    );
  }

  const s = src(CLIENT_PORTAL);
  // `>{q.status}` — the RENDERED value, not `status={q.status}`, which is how
  // the pill is legitimately fed. A looser `\{q\.status\}` matched the prop and
  // failed on the fix; the same trap as `key={row.raw}` matching `{row.raw}`.
  ok(
    "the portal never renders Quote.status as text",
    !/>\s*\{\s*q\.status\s*\}/.test(s) && !/capitalize/.test(s),
    "a snake_case database value, untranslated, on the one page the whole portal is translated for",
  );
  // Colour AND words. A tone map missing a value is a pill that silently falls
  // back to grey, which is the state this was fixed out of.
  const toneAt = s.indexOf("const QUOTE_STATUS_TONE");
  ok("the portal defines a tone per status", toneAt >= 0);
  const tones = [...balanced(s, s.indexOf("{", toneAt)).matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  ok(
    "every QuoteStatus has its own tone, so `accepted` and `sent` cannot look alike",
    values.every((v) => tones.includes(v)),
    `tones=${tones.join(",")} enum=${values.join(",")}`,
  );
}

/* ══ 5. Site chrome reads keys that exist ═════════════════════════════════ */
{
  // Against `en` only, deliberately. Whether every OTHER language has the same
  // keys is check:language-completeness's job — it holds all four copy tables
  // key-for-key with English and derives the language count from the catalogue.
  // What it cannot see is the direction asserted here: which keys the RENDERER
  // actually asks for. A second per-language loop in this file would be the
  // copy that rots.
  const s = src(SITE_BLOCKS);
  const known = new Set(Object.keys(SITE_COPY.en));
  const referenced = [...s.matchAll(/\bt\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]);
  ok("SiteBlocks.js reads copy keys off `t`", referenced.length > 10, String(referenced.length));
  for (const key of [...new Set(referenced)]) {
    ok(`siteCopy has \`${key}\`, read by SiteBlocks.js`, known.has(key));
  }

  // The specific typo, kept as its own assertion because the general rule above
  // cannot see it: `item.fiveStars` is not a `t.` reference at all, which is
  // exactly why nothing caught it for as long as it shipped.
  for (const key of ["fiveStars", "eyebrowTestimonials"]) {
    ok(
      `SiteBlocks.js reads \`${key}\` off the copy table, not off a testimonial`,
      !new RegExp(`item\\.${key}`).test(s),
      "`item` is {quote, author}; this was always undefined",
    );
  }
  ok(
    "the star row is one labelled graphic, not five unlabelled icons",
    /role="img"/.test(s) && /aria-label=\{label\}/.test(s),
    "aria-label on a bare <div> is not announced",
  );
}

/* ══ 6. The language switcher keeps the page you were on ═════════════════ */
{
  const s = src(SITE_BLOCKS);
  const at = s.indexOf("const langHref");
  ok("SiteBlocks.js builds language links through langHref", at >= 0);
  const body = balanced(s, s.indexOf("{", at));
  ok(
    "…which keeps the current page",
    /currentPage/.test(body),
    "switching language on /services returned the visitor to the homepage",
  );
  ok(
    "…and honours the editor preview's link base",
    /linkBase/.test(body) && /linkSuffix/.test(body),
    "in the preview iframe the switcher navigated out of the preview entirely",
  );
  ok(
    "the switcher has no hardcoded root href left",
    !/href=\{code === languages\[0\] \? "\/"/.test(s),
  );
  ok(
    "the switcher is not hidden on a phone",
    !/aria-label=\{t\.chooseLanguage\}[^>]*className="hidden/.test(s),
    "a bilingual site's visitors are mostly on phones",
  );
}

/* ══ 7. Opening hours speak the page's language ═══════════════════════════ */
{
  const HOURS = [
    { day: 0, closed: true, open: "09:00", close: "17:00" },
    { day: 1, closed: false, open: "08:00", close: "17:00" },
    { day: 2, closed: false, open: "08:00", close: "17:00" },
    { day: 3, closed: false, open: "08:00", close: "17:00" },
    { day: 4, closed: false, open: "08:00", close: "17:00" },
    { day: 5, closed: false, open: "08:00", close: "16:00" },
    { day: 6, closed: true, open: "09:00", close: "13:00" },
  ];

  // Executed, not read: the English default is a default PARAMETER, so the
  // string "Closed" is legitimately still in the source.
  const en = groupHours(HOURS, { weekStartsOn: 0 });
  ok(
    "groupHours is unchanged for its English callers (the settings editor, the voice prompt)",
    en.some((r) => r.label === "Mon – Thu") && en.some((r) => r.hours === "Closed"),
    JSON.stringify(en.map((r) => `${r.label}=${r.hours}`)),
  );

  const fr = groupHours(HOURS, { weekStartsOn: 0, locale: "fr-CA", closedLabel: "Fermé" });
  ok(
    "…and speaks French when the page does",
    fr.every((r) => !/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(r.label)) &&
      fr.some((r) => r.hours === "Fermé") &&
      !fr.some((r) => r.hours === "Closed"),
    JSON.stringify(fr.map((r) => `${r.label}=${r.hours}`)),
  );

  const days = dayNames("fr-CA");
  ok(
    "dayNames is indexed 0 = Sunday, like everything else in this module",
    days.length === 7 && /dim/i.test(days[0]) && /lun/i.test(days[1]),
    days.join(","),
  );
  ok(
    "dayNames falls back rather than throwing on a locale Intl rejects",
    dayNames("not a locale").length === 7,
  );

  // The old `opensDay` was an English name, which is what put "ouvre Friday" in
  // a French header. The index is the caller's to translate.
  const state = openState(HOURS, "America/Toronto");
  ok("openState still answers for a company with hours", state !== null);
  ok(
    "openState hands back a day INDEX, never an English day name",
    state.opensDay === undefined,
    "a formatting decision made inside a module that cannot know the page's language",
  );
  ok(
    "…and null hours still return null rather than a guessed 'Closed'",
    openState([], "America/Toronto") === null,
  );

  const s = src(SITE_BLOCKS);
  ok(
    "the header pill formats its time in the page's locale",
    /formatTime\(state\.closesAt, locale\)/.test(s) &&
      /formatTime\(state\.opensAt, locale\)/.test(s),
    "\"Fermé · ouvre 8:00 a.m.\" — French words, an English clock",
  );
  ok(
    "the pill reads the day index with a null check, not a truthy one",
    /state\.opensDayIndex != null/.test(s),
    "index 0 is Sunday and it is falsy — a truthy test drops the day name for exactly one day of the week",
  );
  ok(
    "the hours table passes both the locale and the translated 'closed'",
    /locale: siteLocale\(language\)/.test(s) && /closedLabel: t\.closed/.test(s),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
