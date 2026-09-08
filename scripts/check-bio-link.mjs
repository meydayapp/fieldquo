// scripts/check-bio-link.mjs
//
// Executes the pure half of the bio-link page against input nobody would type
// on purpose: no slug, no links at all, a "__proto__" key in the stored
// config, a javascript: URL in a custom link, a "social:__proto__" and a
// "social:myspace" platform, a 200-character social handle, an icon name off
// the allow-list (and one that is a URL), and the brand colours contractors
// actually pick — "", "#fff", "not-a-colour", plus the three that are live in
// the database today (#c0c0c0 silver, #fefcdd near-white, #1a1a1a near-black).
//
// It also proves two things across files: that every icon name the sanitiser
// allows has a component in the renderer, and that every section heading
// exists in every supported language.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-bio-link.mjs
//
// Contrast is the reason this file exists rather than a reading of the code.
// Every pairing the page renders is measured here, in both colour schemes,
// and a company whose brand is white must come out of it with legible text
// or the check fails.
//
// It also pins the look: the classes that make the page nxt lnk's (the ring,
// the 4px-tracked headings, the hover wash, the press, motion-reduce, the
// footer credit) are asserted from the view's source, and every --lp-* token
// the view reads is proven defined in both schemes by the CSS the theme
// emits, and vice versa.

//
// Since the owner's follow-ups of 2026-09-08 it also proves three more
// things: that every row is derived from a feature that is actually live
// (instant estimator off → no row; funnel unpublished → no row; website
// column first, hosted site only when published, neither → nothing); that
// the brand is VISIBLE on the page for the four hostile brands the owner
// named, in both schemes, on at least one element at its bar; and that the
// settings screen previews the same component the public route renders,
// with the same inputs, and no second drawing of the page anywhere.

import { readFileSync } from "node:fs";
import { linkCandidates, linkGroupLabels, LINK_GROUPS } from "@/lib/links/candidates";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import {
  sanitiseLinkConfig,
  resolveLinks,
  visibleLinks,
  splitSocial,
  groupLinks,
} from "@/lib/links/config";
import { safeUrl, telHref, whatsappHref, linkPageUrl } from "@/lib/links/href";
import { socialHref, SOCIAL_PLATFORMS, SOCIAL_NAMES } from "@/lib/links/social";
import { CUSTOM_ICON_NAMES } from "@/lib/links/icons";
import {
  linkPageTheme,
  linkPageSchemes,
  linkPageTokenCss,
  themeContrastReport,
  brandCarriers,
  carriesBrand,
  TOKEN_FIELDS,
  SCHEMES,
} from "@/lib/links/theme";
import { linkPageHandle } from "@/lib/links/handle";
import { LANGUAGES } from "@/app/i18n/languages";

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── href boundary ──────────────────────────────────────────────────────────
console.log("\nhref allow-list");
check("javascript: refused", safeUrl("javascript:alert(1)") === null);
check("JaVaScRiPt: refused", safeUrl("JaVaScRiPt:alert(1)") === null);
check("java\\nscript: refused", safeUrl("java\nscript:alert(1)") === null);
check("data: refused", safeUrl("data:text/html,<script>") === null);
check("vbscript: refused", safeUrl("vbscript:msgbox") === null);
check("empty refused", safeUrl("") === null && safeUrl(null) === null && safeUrl(undefined) === null);
check("object refused", safeUrl({ toString: () => "javascript:x" }) === null);
check("https kept", safeUrl("https://northline.ca/x?a=1") === "https://northline.ca/x?a=1");
check("bare host gets https", safeUrl("northline.ca") === "https://northline.ca/");
check("scheme with no host refused", safeUrl("https://") === null);

console.log("\nphone");
check("tel from local format", telHref("819-238-7263") === "tel:8192387263");
check("tel refuses junk", telHref("call us") === null);
check("tel refuses short", telHref("911") === null);
check("whatsapp refuses unknown country", whatsappHref("819-238-7263", "FR") === null);
check("whatsapp refuses no country", whatsappHref("819-238-7263", null) === null);
check("whatsapp from CA", whatsappHref("819-238-7263", "CA") === "https://wa.me/18192387263");
check("whatsapp from +", whatsappHref("+33 6 12 34 56 78", "FR") === "https://wa.me/33612345678");

console.log("\nurl shape");
check("url built", linkPageUrl("https://fieldquo.com/", "northline") === "https://fieldquo.com/l/northline");
check("no slug, no url", linkPageUrl("https://fieldquo.com", "") === "");

// ── social: handle or URL, never anything else ─────────────────────────────
console.log("\nsocial handles");
check("unknown platform refused", socialHref("myspace", "northline") === null);
check("__proto__ platform refused", socialHref("__proto__", "northline") === null);
check("non-string platform refused", socialHref({}, "northline") === null && socialHref(null, "x") === null);
check("javascript: refused", socialHref("instagram", "javascript:alert(1)") === null);
check("tel: refused (not a profile)", socialHref("instagram", "tel:8192387263") === null);
check("mailto: refused", socialHref("x", "mailto:a@b.ca") === null);
check("200-char handle refused", socialHref("instagram", "a".repeat(200)) === null);
check("61-char handle refused", socialHref("instagram", "a".repeat(61)) === null);
check("60-char handle kept", socialHref("instagram", "a".repeat(60)) === `https://www.instagram.com/${"a".repeat(60)}`);
check("empty refused", socialHref("instagram", "") === null && socialHref("instagram", "   ") === null);
check("@handle becomes a profile URL", socialHref("instagram", "@northline") === "https://www.instagram.com/northline");
check("bare handle too", socialHref("facebook", "northline.painting") === "https://www.facebook.com/northline.painting");
check("tiktok keeps its @", socialHref("tiktok", "@northline") === "https://www.tiktok.com/@northline");
check("youtube keeps its @", socialHref("youtube", "northline") === "https://www.youtube.com/@northline");
check("linkedin goes to /in/", socialHref("linkedin", "jane-doe") === "https://www.linkedin.com/in/jane-doe");
check("x goes to x.com", socialHref("x", "@northline") === "https://x.com/northline");
check("a slash in a handle is not a handle", socialHref("instagram", "northline/../admin") === null);
check("a space in a handle refused", socialHref("instagram", "north line") === null);
check("<script> as a handle refused", socialHref("instagram", "<script>") === null);
check("pasted URL kept", socialHref("instagram", "https://www.instagram.com/northline/?igsh=abc") === "https://www.instagram.com/northline/?igsh=abc");
check("bare host gets https", socialHref("instagram", "instagram.com/northline") === "https://instagram.com/northline");
check("a host alone is a URL, not a handle", socialHref("instagram", "instagram.com") === "https://instagram.com/");
check("every platform has a name", SOCIAL_PLATFORMS.every((p) => typeof SOCIAL_NAMES[p] === "string" && SOCIAL_NAMES[p]));

// ── candidates: nothing in, nothing out ────────────────────────────────────
console.log("\ncandidates from an empty company");
check("undefined input", linkCandidates().length === 0);
check("no slug means no internal links", linkCandidates({ company: { name: "X" } }).length === 0);
check(
  "a slug alone yields exactly the quote form",
  (() => {
    const c = linkCandidates({ company: { slug: "x" } });
    return c.length === 1 && c[0].key === "quote";
  })(),
);
check(
  "no event types means no booking link",
  !linkCandidates({ company: { slug: "x" }, activeEventTypes: 0 }).some((c) => c.key === "book"),
);
check(
  "a draft funnel is not a link",
  !linkCandidates({
    company: { slug: "x" },
    funnels: [{ slug: "f", name: "F", status: "draft" }],
  }).some((c) => c.key.startsWith("funnel:")),
);
check(
  "an unpublished site is not a link",
  !linkCandidates({ company: { slug: "x" }, site: { subdomain: "x", published: false } }).some(
    (c) => c.key === "site",
  ),
);
check(
  "bookingSlug wins over slug",
  linkCandidates({ company: { slug: "a", bookingSlug: "b" } })[0].url === "/quote/b",
);
check(
  "a blank website column is not a link",
  !linkCandidates({ company: { slug: "x", website: "" } }).some((c) => c.key === "site"),
);
check(
  "review and email are on by default; WhatsApp is present but off",
  (() => {
    const c = linkCandidates({
      company: {
        slug: "x",
        phone: "819-238-7263",
        country: "CA",
        email: "a@b.ca",
        reviewUrl: "https://g.page/r/x/review",
      },
    });
    return (
      c.find((x) => x.key === "review")?.defaultOn === true &&
      c.find((x) => x.key === "email")?.defaultOn === true &&
      c.find((x) => x.key === "phone")?.defaultOn === true &&
      c.find((x) => x.key === "whatsapp")?.defaultOn === false
    );
  })(),
);

// ── candidates: every row is a feature that is live ────────────────────────
//
// Each fixture is the same condition the public route applies, and the
// negative of it. A row here with no live feature behind it is the dead link
// the whole file exists to prevent.
console.log("\ncandidates derive from live features");
const live = (over = {}, input = {}) =>
  linkCandidates({ company: { slug: "northline", ...over }, ...input });
const has = (list, key) => list.some((c) => c.key === key);
check("instant estimator off → no row", !has(live({}, { enabledEstimators: 0 }), "instant"));
check("instant estimator on → row, on by default", (() => {
  const c = live({}, { enabledEstimators: 1 }).find((x) => x.key === "instant");
  return c?.url === "/instant-quote/northline" && c.defaultOn === true;
})());
check("no active event type → no booking row", !has(live({}, { activeEventTypes: 0 }), "book"));
check("an active event type → booking row, on by default", (() => {
  const c = live({}, { activeEventTypes: 1 }).find((x) => x.key === "book");
  return c?.url === "/book/northline" && c.defaultOn === true;
})());
check("funnel unpublished → no row", !live({}, { funnels: [{ slug: "quiz", name: "60-second quiz", status: "draft" }] }).some((c) => c.key.startsWith("funnel:")));
check("funnel with no slug → no row", !live({}, { funnels: [{ slug: "", name: "Quiz", status: "published" }] }).some((c) => c.key.startsWith("funnel:")));
check("funnel published → row under its own name, on by default", (() => {
  const c = live({}, { funnels: [{ slug: "quiz", name: "60-second quiz", status: "published" }] }).find((x) => x.key === "funnel:quiz");
  return c?.url === "/f/northline/quiz" && c.label === "60-second quiz" && c.group === "price" && c.defaultOn === true;
})());
check("the quote form is always a row", has(live(), "quote"));
check("website empty + site published → the hosted URL", (() => {
  const c = live({ website: "" }, { site: { subdomain: "northline", published: true } }).find((x) => x.key === "site");
  return c?.url === "https://northline.fieldquo.com" && c.defaultOn === true;
})());
check("website empty + site unpublished → no row", !has(live({ website: "" }, { site: { subdomain: "northline", published: false } }), "site"));
check("website empty + no site → no row", !has(live({ website: "" }, { site: null }), "site"));
check("website set → the domain, even with a published site", (() => {
  const c = live({ website: "northline.ca" }, { site: { subdomain: "northline", published: true } }).find((x) => x.key === "site");
  return c?.url === "https://northline.ca/";
})());
check("website set → the domain, with no site at all", live({ website: "https://www.northline.ca/" }).find((x) => x.key === "site")?.url === "https://www.northline.ca/");
check("a javascript: website column is not a row, and the hosted site is not used to cover it", (() => {
  const c = live({ website: "javascript:alert(1)" }, { site: { subdomain: "northline", published: true } }).find((x) => x.key === "site");
  // The column is refused; the published site is the honest fallback.
  return c?.url === "https://northline.fieldquo.com";
})());
check("a `published: 1` that is not the boolean is not published", !has(live({ website: "" }, { site: { subdomain: "northline", published: 1 } }), "site"));
check("the row and the handle disagree on purpose for a hosted site", (() => {
  const company = { slug: "northline", website: "", city: "Ottawa", province: "ON" };
  const row = linkCandidates({ company, site: { subdomain: "northline", published: true } }).find((x) => x.key === "site");
  return row?.url === "https://northline.fieldquo.com" && linkPageHandle(company) === "Ottawa, ON";
})());
check("no review link → no review row", !has(live({ reviewUrl: "" }), "review"));
check("a review link → review row, on by default", live({ reviewUrl: "https://g.page/r/x/review" }).find((x) => x.key === "review")?.defaultOn === true);
check("candidates that are on by default are appended ON when nobody configured them", (() => {
  const c = live(
    { website: "northline.ca", reviewUrl: "https://g.page/r/x/review", email: "a@b.ca", phone: "819-238-7263", country: "CA" },
    { enabledEstimators: 1, activeEventTypes: 1, funnels: [{ slug: "quiz", name: "Quiz", status: "published" }] },
  );
  const rows = resolveLinks(c, sanitiseLinkConfig({}));
  const on = rows.filter((r) => r.enabled).map((r) => r.key).sort().join();
  return on === ["instant", "quote", "book", "funnel:quiz", "site", "phone", "email", "review"].sort().join();
})());
check("a row the contractor turned off stays off when a new candidate appears", (() => {
  const c = live({ reviewUrl: "https://g.page/r/x/review" }, { enabledEstimators: 1, funnels: [{ slug: "quiz", name: "Quiz", status: "published" }] });
  const rows = resolveLinks(c, sanitiseLinkConfig({ items: [{ key: "review", enabled: false }] }));
  return rows.find((r) => r.key === "review")?.enabled === false && rows.find((r) => r.key === "funnel:quiz")?.enabled === true;
})());

// ── the config sanitiser ───────────────────────────────────────────────────
console.log("\nconfig sanitiser");
const hostile = JSON.parse(
  JSON.stringify({
    published: true,
    headline: "  Northline\n\nPainting  ".padEnd(400, "!"),
    bio: 12345,
    items: [
      { key: "__proto__", enabled: true },
      { key: "constructor", enabled: true },
      { key: "quote", enabled: false },
      { key: "quote", enabled: true },
      { key: "custom", label: "Hack", url: "javascript:alert(1)" },
      { key: "custom", label: "Instagram", url: "instagram.com/northline" },
      { key: "custom", label: "", url: "https://ok.ca" },
      null,
      "quote",
      { key: "book", label: "   " },
      // The icon row.
      { key: "social:instagram", url: "@northline" },
      { key: "social:instagram", url: "@someone-else" },
      { key: "social:myspace", url: "northline" },
      { key: "social:__proto__", url: "northline" },
      { key: "social:facebook", url: "javascript:alert(1)" },
      { key: "social:tiktok", url: "a".repeat(200) },
      { key: "social:x", url: "" },
      { key: "social:youtube", url: "https://www.youtube.com/@northline" },
      // Custom icons.
      { key: "custom", label: "Gallery", url: "https://ok.ca/g", icon: "images" },
      { key: "custom", label: "Odd", url: "https://ok.ca/o", icon: "not-an-icon" },
      { key: "custom", label: "Proto", url: "https://ok.ca/p", icon: "__proto__" },
      { key: "custom", label: "Num", url: "https://ok.ca/n", icon: 42 },
      { key: "custom", label: "Remote", url: "https://ok.ca/r", icon: "https://evil.example/i.svg" },
    ],
  }),
);
const clean = sanitiseLinkConfig(hostile);
const socialsStored = clean.items.filter((i) => i.key.startsWith("social:"));
check("known platform with a handle stored as a URL", socialsStored.some((i) => i.key === "social:instagram" && i.url === "https://www.instagram.com/northline"));
check("duplicate platform: first wins", socialsStored.filter((i) => i.key === "social:instagram").length === 1);
check("unknown platform dropped", !socialsStored.some((i) => i.key === "social:myspace"));
check("social:__proto__ dropped", !socialsStored.some((i) => /proto/.test(i.key)));
check("javascript: social dropped", !socialsStored.some((i) => i.key === "social:facebook"));
check("200-char handle dropped", !socialsStored.some((i) => i.key === "social:tiktok"));
check("empty social dropped", !socialsStored.some((i) => i.key === "social:x"));
check("pasted profile URL kept", socialsStored.some((i) => i.key === "social:youtube" && i.url === "https://www.youtube.com/@northline"));
check("social entries carry nothing but key/enabled/url", socialsStored.every((i) => Object.keys(i).sort().join() === "enabled,key,url"));
const customs = clean.items.filter((i) => i.key.startsWith("custom:"));
check("allow-listed icon kept", customs.some((i) => i.label === "Gallery" && i.icon === "images"));
check("unknown icon dropped, row kept", customs.some((i) => i.label === "Odd" && i.icon === undefined));
check("__proto__ icon dropped, row kept", customs.some((i) => i.label === "Proto" && i.icon === undefined));
check("non-string icon dropped", customs.some((i) => i.label === "Num" && i.icon === undefined));
check("icon URL dropped", customs.some((i) => i.label === "Remote" && i.icon === undefined));
check("prototype keys dropped", !clean.items.some((i) => /proto|constructor/.test(i.key)));
check("duplicate key dropped", clean.items.filter((i) => i.key === "quote").length === 1);
check("first duplicate wins (disabled)", clean.items.find((i) => i.key === "quote").enabled === false);
check("javascript: custom dropped", !clean.items.some((i) => i.url?.startsWith("javascript")));
check(
  "good custom kept and re-keyed",
  clean.items.some((i) => i.key === "custom:0" && i.url === "https://instagram.com/northline"),
);
check("labelless custom dropped", !clean.items.some((i) => i.key.startsWith("custom:") && !i.label));
check("custom keys are positional and unique", customs.every((i, n) => i.key === `custom:${n}`));
check("headline collapsed and clamped", clean.headline.length === 80 && !/\n/.test(clean.headline));
check("non-string bio becomes empty", clean.bio === "");
check("blank label not stored", clean.items.find((i) => i.key === "book")?.label === undefined);
check("nothing survives being a string entry", !clean.items.some((i) => typeof i !== "object"));
check("Object.prototype untouched", ({}).enabled === undefined && ({}).polluted === undefined);
check("garbage in, valid shape out", (() => {
  const c = sanitiseLinkConfig("nope");
  return c.published === true && c.items.length === 0 && c.headline === "" && c.bio === "";
})());
check("published:false survives", sanitiseLinkConfig({ published: false }).published === false);

// ── merge ──────────────────────────────────────────────────────────────────
console.log("\nresolve + merge");
const candidates = linkCandidates({
  company: { slug: "northline", phone: "819-238-7263", country: "CA" },
  activeEventTypes: 1,
  enabledEstimators: 1,
  funnels: [{ slug: "tiktok", name: "TikTok quiz", status: "published" }],
});
check("candidate order puts instant first", candidates[0].key === "instant");

const stored = sanitiseLinkConfig({
  items: [
    { key: "book", enabled: true },
    { key: "funnel:deleted-last-year", enabled: true },
    { key: "quote", enabled: false, label: "Ask us for a price" },
  ],
});
const merged = resolveLinks(candidates, stored);
check("stored order leads", merged[0].key === "book" && merged[1].key === "quote");
check("stale key dropped", !merged.some((l) => l.key.startsWith("funnel:deleted")));
check("label override applied", merged[1].label === "Ask us for a price");
check(
  "a candidate nobody configured still appears",
  merged.some((l) => l.key === "funnel:tiktok" && l.enabled === true),
);
check(
  "every candidate is represented exactly once",
  new Set(merged.map((l) => l.key)).size === merged.length &&
    candidates.every((c) => merged.some((l) => l.key === c.key)),
);
check("disabled row hidden from the public list", !visibleLinks(candidates, stored).some((l) => l.key === "quote"));
check(
  "a config that disables everything renders nothing, not junk",
  visibleLinks(
    candidates,
    sanitiseLinkConfig({ items: candidates.map((c) => ({ key: c.key, enabled: false })) }),
  ).length === 0,
);

// ── groups and the icon row ────────────────────────────────────────────────
console.log("\ngroups");
check("every candidate has a known group", candidates.every((c) => LINK_GROUPS.includes(c.group)));
check("funnels count as getting a price", candidates.find((c) => c.key === "funnel:tiktok")?.group === "price");
check("phone is contact", candidates.find((c) => c.key === "phone")?.group === "contact");
// A company with a website, so the stored "site" override below is live
// rather than stale (the shared `candidates` above has none, and a stale
// override is dropped — see resolveLinks).
const groupCandidates = linkCandidates({
  company: { slug: "northline", phone: "819-238-7263", country: "CA", website: "northline.ca" },
  activeEventTypes: 1,
  enabledEstimators: 1,
  funnels: [{ slug: "tiktok", name: "TikTok quiz", status: "published" }],
});
const withSocial = resolveLinks(
  groupCandidates,
  sanitiseLinkConfig({
    items: [
      { key: "site", enabled: true },
      { key: "social:instagram", url: "@northline" },
      { key: "custom", label: "Gallery", url: "https://ok.ca/g", icon: "images" },
      { key: "phone", enabled: true },
    ],
  }),
);
check("resolved rows all carry a group", withSocial.every((l) => LINK_GROUPS.includes(l.group)));
check("social resolves to kind social, group follow", withSocial.some((l) => l.kind === "social" && l.platform === "instagram" && l.group === "follow"));
check("custom icon survives resolve", withSocial.some((l) => l.kind === "custom" && l.icon === "images"));
const split = splitSocial(withSocial);
check("splitSocial separates the icon row", split.social.length === 1 && split.rows.every((l) => l.kind !== "social"));
const sections = groupLinks(split.rows.filter((l) => l.enabled));
// Stored order was site, (social), custom, phone — so "More" leads, holds
// site then custom in that order, and "Contact" follows. The rows the
// contractor never mentioned (instant, quote, book, funnel) are appended
// after, so "Get a price" comes LAST here despite being first by default:
// that is the reorder winning over the grouping, which is the point.
check("sections follow the contractor's order (site first → More leads)", sections[0]?.group === "more");
check("no empty section", sections.every((sec) => sec.rows.length > 0));
check("no group appears twice", new Set(sections.map((sec) => sec.group)).size === sections.length);
check("rows keep relative order inside a section", (() => {
  const more = sections.find((sec) => sec.group === "more");
  return more && more.rows[0].key === "site" && more.rows[1]?.key === "custom:0";
})());
check(
  "a section the contractor pushed down stays down",
  sections.findIndex((sec) => sec.group === "price") > sections.findIndex((sec) => sec.group === "more"),
);
check("the first row of the first section is the contractor's first row", sections[0].rows[0].key === "site");
check("no book section for a company with nothing bookable", !groupLinks(visibleLinks(linkCandidates({ company: { slug: "x" } }), sanitiseLinkConfig({}))).some((sec) => sec.group === "book"));
check("groupLinks on junk", groupLinks(null).length === 0 && groupLinks("x").length === 0);
check("a row with no group lands in More", groupLinks([{ key: "k" }])[0].group === "more");
check("every heading in every supported language", LANGUAGES.every(({ code }) => {
  const h = linkGroupLabels(code);
  return LINK_GROUPS.every((g) => typeof h[g] === "string" && h[g].trim());
}));
check("headings differ between en and fr", linkGroupLabels("en").price !== linkGroupLabels("fr").price);

// The name list the sanitiser allows must be the list the renderer can draw.
// The renderer is JSX, which plain node can't import, so this reads its
// source and matches the object keys — a name here with no component there
// would render a row with no icon and this is the only thing that says so.
console.log("\ncustom icons");
const iconSrc = readFileSync(new URL("../app/components/links/linkIcons.js", import.meta.url), "utf8");
const drawn = new Set(
  [...iconSrc.matchAll(/^\s+(?:"([a-z-]+)"|([a-z]+)):\s*[A-Z][A-Za-z0-9]*,\s*$/gm)].map((m) => m[1] || m[2]),
);
for (const name of CUSTOM_ICON_NAMES) {
  check(`icon "${name}" has a component`, drawn.has(name));
}
check("no duplicate icon names", new Set(CUSTOM_ICON_NAMES).size === CUSTOM_ICON_NAMES.length);
const lucideTypes = readFileSync(new URL("../node_modules/lucide-react/dist/lucide-react.d.ts", import.meta.url), "utf8");
const imported = iconSrc.match(/import \{([^}]+)\} from "lucide-react"/)?.[1].split(",").map((n) => n.trim()).filter(Boolean) || [];
check("every lucide name imported by the renderer exists in the installed lucide", imported.every((n) => new RegExp(`declare const ${n}:`).test(lucideTypes)), imported.filter((n) => !new RegExp(`declare const ${n}:`).test(lucideTypes)).join(", "));
check("every social platform has a glyph in the renderer", SOCIAL_PLATFORMS.every((p) => new RegExp(`^\\s+${p}:`, "m").test(iconSrc)));

// ── the line under the name ────────────────────────────────────────────────
console.log("\nhandle line");
check("own domain wins", linkPageHandle({ website: "https://www.northline.ca/", city: "Ottawa" }) === "northline.ca");
check("bare host accepted", linkPageHandle({ website: "Northline.CA" }) === "northline.ca");
check("a FieldQuo site host never appears", linkPageHandle({ website: "https://northline.fieldquo.com", city: "Ottawa", province: "ON" }) === "Ottawa, ON");
check("city alone", linkPageHandle({ city: "  Gatineau " }) === "Gatineau");
check("city and province", linkPageHandle({ city: "Gatineau", province: "QC" }) === "Gatineau, QC");
check("province alone is still a place", linkPageHandle({ province: "QC" }) === "QC");
check("nothing invents nothing", linkPageHandle({}) === "" && linkPageHandle(null) === "" && linkPageHandle({ city: 42 }) === "");
check("javascript: website is not a handle", linkPageHandle({ website: "javascript:alert(1)" }) === "");
check("an IP is not a handle", linkPageHandle({ website: "http://127.0.0.1/" }) === "");
check("newlines collapsed", linkPageHandle({ city: "Val\n\nd'Or" }) === "Val d'Or");

// ── contrast, against brand colours that break the naive rule ──────────────
//
// Both schemes. The four the brief names as hostile — yellow, white, black,
// mid grey — plus the ones live in the database and the ones that broke
// documentTheme's helpers historically.
console.log("\ncontrast (4.5:1 on text, 3:1 on edges, 1.6:1 on the one fill — every pairing the page paints, light and dark)");
const BRANDS = [
  ["unset (null)", null],
  ["empty string", ""],
  ["not-a-colour", "not-a-colour"],
  ["#FFD500 yellow", "#FFD500"],
  ["#fff", "#fff"],
  ["#ffffff white", "#ffffff"],
  ["#000000 black", "#000000"],
  ["#111111 near-black", "#111111"],
  ["#808080 mid grey", "#808080"],
  ["#1D4ED8 blue", "#1D4ED8"],
  ["#c0c0c0 silver (live)", "#c0c0c0"],
  ["#fefcdd near-white (live)", "#fefcdd"],
  ["#1a1a1a near-black (live)", "#1a1a1a"],
  ["#bd9d60 sand (live)", "#bd9d60"],
  ["#ffff00 yellow", "#ffff00"],
  ["#7cfc00 lawn green", "#7cfc00"],
  ["#ff5a00 fieldquo orange", "#ff5a00"],
  ["#06356b navy", "#06356b"],
];
const HEX6 = /^#[0-9a-f]{6}$/i;
for (const scheme of SCHEMES) {
  console.log(`  ${scheme}`);
  for (const [name, brandColor] of BRANDS) {
    const theme = linkPageTheme({ brandColor }, { scheme });
    const report = themeContrastReport(theme);
    const worst = report.entries.reduce((a, b) => (a.ratio < b.ratio ? a : b));
    check(
      `${name}`.padEnd(28),
      report.ok,
      `worst ${worst.name} ${worst.ratio.toFixed(2)}:1` +
        (report.ok
          ? ""
          : ` [${report.entries
              .filter((e) => !e.ok)
              .map((e) => `${e.name} ${e.ratio.toFixed(2)} < ${e.target}`)
              .join(", ")}]`),
    );
    // Every painted field is a six-digit hex — what the token CSS below
    // demands — and every field is measured somewhere.
    const painted = Object.values(TOKEN_FIELDS).concat(["hoverFrom", "hoverTo"]);
    check(`${name} (${scheme}) every token is a hex`.padEnd(28), painted.every((f) => HEX6.test(theme[f])), painted.filter((f) => !HEX6.test(theme[f])).join(","));
  }
}
check("the dark scheme is not the light one", (() => {
  const s = linkPageSchemes({ brandColor: "#06356b" });
  return s.light.pageBg !== s.dark.pageBg && s.light.pageInk !== s.dark.pageInk;
})());
check("dark mode is where a yellow brand keeps its yellow", (() => {
  const s = linkPageSchemes({ brandColor: "#FFD500" });
  // Light: too pale to carry, swapped for ink. Dark: the brand, lifted or as is.
  return s.light.primaryBg !== "#FFD500".toLowerCase() && /^#f{2}[c-f][0-9a-f]/i.test(s.dark.primaryBg);
})());

// ── the brand is visible, not only measured ────────────────────────────────
//
// For every brand above, in both schemes, at least one element the page
// paints carries the brand at the bar that applies to it. The four the owner
// named are printed in full so the report can say exactly which elements
// carry the brand for each.
console.log("\nbrand carriers (≥1 element carries the brand at its bar — ring/primary 3:1, on-primary/accent 4.5:1)");
const NAMED = new Set(["#FFD500", "#111111", "#808080", "#1D4ED8"]);
for (const scheme of SCHEMES) {
  for (const [name, brandColor] of BRANDS) {
    const theme = linkPageTheme({ brandColor }, { scheme });
    const report = brandCarriers(theme, { brandColor });
    const carriers = report.entries.filter((e) => e.ok);
    check(
      `${name} (${scheme})`.padEnd(34),
      report.visible,
      carriers.map((e) => `${e.element}=${e.hex}@${e.ratio.toFixed(1)}`).join(" ") || "NOTHING carries the brand",
    );
    if (NAMED.has(brandColor)) {
      console.log(
        `         all: ${report.entries.map((e) => `${e.element} ${e.hex} ${e.carries ? "brand" : "not"} ${e.ratio.toFixed(1)}:1`).join(" · ")}`,
      );
    }
  }
}
check("yellow on the light scheme: the pill is ink and its TEXT is the brand", (() => {
  const t = linkPageTheme({ brandColor: "#FFD500" }, { scheme: "light" });
  return t.primaryBg === t.cardInk && t.primaryFg === "#ffd500";
})());
check("near-black on the dark scheme: the pill is light and its TEXT is the brand", (() => {
  const t = linkPageTheme({ brandColor: "#111111" }, { scheme: "dark" });
  return t.primaryBg === t.pageInk && t.primaryFg === "#111111";
})());
check("a brand the page can show is the pill's FILL, not its text", (() => {
  const t = linkPageTheme({ brandColor: "#1D4ED8" }, { scheme: "light" });
  return t.primaryBg === "#1d4ed8" && t.primaryFg !== "#1d4ed8";
})());
check("the initials avatar and the pill share tokens, so the brand-on-ink rule reaches the avatar", /bg-\(color:--lp-primary\) text-4xl font-black text-\(color:--lp-on-primary\)/.test(readFileSync(new URL("../app/components/links/LinkPageView.js", import.meta.url), "utf8")));
check("carriesBrand: a lifted navy is still navy", carriesBrand("#0b60c2", "#06356b"));
check("carriesBrand: a wash of navy is not", !carriesBrand("#f4f4f6", "#06356b"));
check("carriesBrand: ink is not a yellow", !carriesBrand("#20242b", "#FFD500"));
check("carriesBrand: a black lifted to mid grey has stopped being black", !carriesBrand("#676767", "#111111"));
check("carriesBrand: a deepened mid grey is still grey", carriesBrand("#8d8d8d", "#808080"));
check("carriesBrand: junk in, false out", !carriesBrand("nope", "#111111") && !carriesBrand("#111111", null));

// ── the CSS the page emits ─────────────────────────────────────────────────
console.log("\ntoken css");
const tokenCss = linkPageTokenCss(linkPageSchemes({ brandColor: "#06356b" }));
const tokenNames = Object.keys(TOKEN_FIELDS).concat(["hover"]);
check("light block first, dark block under the media query", /^\.lp\{.*\}@media \(prefers-color-scheme:dark\)\{\.lp\{.*\}\}$/.test(tokenCss));
const [lightBlock, darkBlock] = tokenCss.split("@media (prefers-color-scheme:dark)");
for (const t of tokenNames) {
  check(`--lp-${t} defined in both schemes`, lightBlock.includes(`--lp-${t}:`) && darkBlock.includes(`--lp-${t}:`));
}
check("color-scheme set per block", lightBlock.includes("color-scheme:light") && darkBlock.includes("color-scheme:dark"));
check("a pinned scheme emits that block alone, with no media query", (() => {
  const s = linkPageSchemes({ brandColor: "#06356b" });
  const light = linkPageTokenCss(s, ".lp", { scheme: "light" });
  const dark = linkPageTokenCss(s, ".lp", { scheme: "dark" });
  return (
    !light.includes("@media") && light.includes("color-scheme:light") && light === lightBlock &&
    !dark.includes("@media") && dark.includes("color-scheme:dark") && dark === darkBlock.slice(1, -1)
  );
})());
check("an unknown scheme falls back to auto", linkPageTokenCss(linkPageSchemes({ brandColor: "#06356b" }), ".lp", { scheme: "sepia" }) === tokenCss);
check("a non-hex value never reaches the stylesheet", (() => {
  const s = linkPageSchemes({ brandColor: "#06356b" });
  const hostile = { ...s, light: { ...s.light, cardBg: "red;}body{background:url(x)", hoverFrom: "}" } };
  const css = linkPageTokenCss(hostile);
  // Three braces: the light block, the media query, the dark block. A fourth
  // would be the injected one.
  return !css.includes("url(") && !css.includes("red") && (css.match(/\{/g) || []).length === 3;
})());
// The FALLBACK is the one that shipped broken: every token that failed the
// hex test fell back to pageBg, which was itself written raw. A malformed
// pageBg therefore escaped the block on every public bio link. The chain has
// to end at a literal, so this drives BOTH the value and its fallback hostile.
check("a hostile fallback cannot escape the block either", (() => {
  const s = linkPageSchemes({ brandColor: "#06356b" });
  const evil = { pageBg: "red;}body{display:none}.x{a:b", pageInk: "also;}bad{", brandRing: "x", hoverFrom: "y", hoverTo: "z" };
  return ["light", "dark", "auto"].every((scheme) => {
    const css = linkPageTokenCss({ light: evil, dark: evil }, ".lp", { scheme });
    const open = (css.match(/\{/g) || []).length;
    const close = (css.match(/\}/g) || []).length;
    return open === close && !/body\{|bad\{|\.x\{/.test(css) && !/[<>]/.test(css);
  });
})());

// ── the markup: what the classes must say ──────────────────────────────────
//
// Read from source, as the icon check above does, because the view is JSX.
// Each of these is a thing the owner asked for by name against nxt lnk, and
// a refactor that drops one would still render a page — just not that one.
console.log("\nview markup");
const viewSrc = readFileSync(new URL("../app/components/links/LinkPageView.js", import.meta.url), "utf8");
const viewCode = viewSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
check("avatar ring: a padded circle in the ring token", /rounded-full bg-\(color:--lp-ring\) p-\[3px\]/.test(viewCode));
check("name is 800 weight, tight", /font-extrabold[^"]*tracking-\[-0\.05em\]/.test(viewCode) && /text-\[38px\]/.test(viewCode));
check("handle line is muted", /text-\(color:--lp-muted\)[^"]*sm:text-lg/.test(viewCode) || /sm:text-lg[^"]*text-\(color:--lp-muted\)/.test(viewCode));
check("bio at 18–22px medium", /font-medium leading-\[26px\][^"]*sm:text-\[22px\]/.test(viewCode));
check("section heading: small uppercase, 4px tracking, muted", /uppercase tracking-\[4px\] text-\(color:--lp-muted\)/.test(viewCode));
check("rows lift on hover", /hover:-translate-y-px/.test(viewCode));
check("rows press to .98", /active:scale-\[0\.98\]/.test(viewCode));
check("hover wash is the brand gradient on a ::before", /before:bg-\(image:--lp-hover\)/.test(viewCode) && /hover:before:opacity-100/.test(viewCode) && /isolate/.test(viewCode) && /before:-z-10/.test(viewCode));
check("border deepens on hover", /hover:border-\(color:--lp-border-hover\)/.test(viewCode));
check("motion-reduce turns every movement off", ["motion-reduce:transition-none", "motion-reduce:hover:translate-y-0", "motion-reduce:active:scale-100", "motion-reduce:before:transition-none", "motion-reduce:before:scale-100"].every((c) => viewCode.includes(c)));
check("transition names translate and scale, not transform", /transition-\[translate,scale/.test(viewCode) && !/transition-\[transform/.test(viewCode));
check("social circles carry the 1px border", /rounded-full sm:h-14 sm:w-14 \$\{BOX\}/.test(viewCode) && /const BOX = `[^`]*border border-\(color:--lp-border\)/.test(viewCode));
check("the arrow is nxt lnk's NewUp", /<NewUpIcon/.test(viewCode) && /export function NewUpIcon/.test(iconSrc));
check("featured pill is the contractor's first row, lifted out", /const featured = grouped\[0\]\?\.rows\[0\] \|\| null/.test(viewCode) && /rows: section\.rows\.slice\(1\)/.test(viewCode) && /filter\(\(section\) => section\.rows\.length > 0\)/.test(viewCode));
check("featured pill painted in the primary tokens", /rounded-full bg-\(color:--lp-primary\)[^"`]*text-\(color:--lp-on-primary\)/.test(viewCode));
check("footer: © year company", /©\s*\{year\}\s*\{company\.name\}/.test(viewCode));
check("footer: Made by FieldQuo, linked", /href="https:\/\/www\.fieldquo\.com"[\s\S]{0,400}Made by FieldQuo/.test(viewCode));
check("footer credit in the muted token", /Made by FieldQuo/.test(viewCode) && /className="underline underline-offset-2 text-\(color:--lp-muted\)"/.test(viewCode));
check("column is capped at 680", /max-w-\[680px\]/.test(viewCode));
check("no literal colour in the view", !/#[0-9a-f]{3,6}\b/i.test(viewCode.replace(/rgba\([^)]*\)/g, "")));
check("no class-based dark: variant (it cannot fire on /l)", !/\bdark:/.test(viewCode));
check("no external stylesheet or font request", !/<link|fonts\.googleapis|@import/.test(viewCode));
check("tokens are read via var(--lp-*) only", !/style=\{\{[^}]*(color|background)/i.test(viewCode));
const usedTokens = new Set([...viewCode.matchAll(/--lp-([a-z-]+)/g)].map((m) => m[1]));
for (const t of tokenNames) {
  check(`--lp-${t} is read by the view`, usedTokens.has(t));
}
for (const t of usedTokens) {
  check(`--lp-${t} read by the view is defined`, tokenNames.includes(t));
}
check("page.js renders the view and nothing else", (() => {
  const page = readFileSync(new URL("../app/l/[slug]/page.js", import.meta.url), "utf8");
  return /<LinkPageView company=\{company\} config=\{config\} candidates=\{candidates\} \/>/.test(page) && !/className=/.test(page);
})());
check("the loader selects what the handle line reads", (() => {
  const load = readFileSync(new URL("../lib/links/load.js", import.meta.url), "utf8");
  return /city: true/.test(load) && /province: true/.test(load) && /website: true/.test(load);
})());
check("the view takes a pinned scheme and passes it to the token CSS", /linkPageTokenCss\(schemes, "\.lp", \{ scheme \}\)/.test(viewCode) && /scheme = "auto"/.test(viewCode));
check("inFrame swaps the two min-heights and nothing else", (() => {
  const fills = viewCode.match(/\$\{fill\}/g) || [];
  return /const fill = inFrame \? "min-h-full" : "min-h-screen"/.test(viewCode) && fills.length === 2 && !/min-h-screen[^"`]*"/.test(viewCode.replace(/const fill[^\n]*/, ""));
})());
check("the avatar is the logo when there is one, initials otherwise", /company\.logoUrl \?/.test(viewCode) && /src=\{company\.logoUrl\}/.test(viewCode) && /initial\(company\.name\)/.test(viewCode));

// ── the loader mirrors the estimator's own gate ────────────────────────────
console.log("\nloader");
const loadSrc = readFileSync(new URL("../lib/links/load.js", import.meta.url), "utf8");
check("instant rows are filtered by the trades the estimator can price", /INSTANT_ESTIMATE_TRADES\[trade\]/.test(loadSrc) && /select: \{ trade: true \}/.test(loadSrc));
check("painting needs an offered scope, as it does on /instant-quote", /paintingScopesOffered\(await companyEnabledCategoryKeys\(company\.id\)\)/.test(loadSrc));
check("the loader still reads what the website row needs", /site: \{ select: \{ subdomain: true, published: true \} \}/.test(loadSrc) && /reviewUrl: true/.test(loadSrc) && /logoUrl: true/.test(loadSrc) && /brandColor: true/.test(loadSrc));

// ── the settings screen previews the page, it does not redraw it ───────────
console.log("\nsettings preview");
const routeSrc = readFileSync(new URL("../app/api/settings/links/route.js", import.meta.url), "utf8");
const settingsSrc = readFileSync(new URL("../app/app/settings/links/page.js", import.meta.url), "utf8");
const settingsCode = settingsSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
check("GET returns brandColor, logoUrl and the candidate list", /brandColor: company\.brandColor/.test(routeSrc) && /logoUrl: company\.logoUrl/.test(routeSrc) && /^\s+candidates,$/m.test(routeSrc));
check("GET returns every company field the view reads", ["name", "logoUrl", "brandColor", "website", "city", "province", "defaultLanguage"].every((f) => new RegExp(`^\\s+${f}: company\\.${f},$`, "m").test(routeSrc)));
check("GET and PATCH share one payload", (routeSrc.match(/payload\(/g) || []).length === 3 && /function payload\(/.test(routeSrc));
check("the settings screen renders LinkPageView itself", /import LinkPageView from "@\/app\/components\/links\/LinkPageView"/.test(settingsCode) && /<LinkPageView\s/.test(settingsCode));
check("…with the server's company and candidates and the config being typed", /company=\{data\.company\}/.test(settingsCode) && /candidates=\{data\.candidates\}/.test(settingsCode) && /config=\{previewConfig\}/.test(settingsCode));
check("…through the same sanitiser the server runs", /sanitiseLinkConfig\(\{ published, headline, bio, items: buildItems\(\) \}\)/.test(settingsCode));
// Three: the definition, the Save body, the preview config — and no fourth
// place assembling an items array by hand.
check("the preview and Save build their items with one function", (settingsCode.match(/buildItems\(\)/g) || []).length === 3 && /function buildItems\(\)/.test(settingsCode) && !/items: \[\s*\.\.\.SOCIAL_PLATFORMS/.test(settingsCode.replace(/function buildItems[\s\S]*?\n  \}\n/, "")));
check("the frame pins a scheme and is in-frame", /scheme=\{previewScheme\}/.test(settingsCode) && /inFrame\s*\/?>?/.test(settingsCode));
check("light/dark toggle is for the preview only", /setPreviewScheme\(scheme\)/.test(settingsCode) && /aria-pressed=\{previewScheme === scheme\}/.test(settingsCode));
check("no second drawing of the page: the screen never writes a --lp-* token", !/--lp-/.test(settingsCode) && !/linkPageTokenCss/.test(settingsCode) && !/linkPageSchemes/.test(settingsCode));
check("the frame is a ceiling, not a fixed width", /max-w-\[375px\]/.test(settingsCode) && !/(?<!max-)w-\[375px\]/.test(settingsCode));
check("no frame when the GET predates the preview fields", /previewable = Boolean\(data\.company && Array\.isArray\(data\.candidates\)\)/.test(settingsCode) && /\{previewable && \(/.test(settingsCode));

// ── every new t() key, in every language block ─────────────────────────────
console.log("\ni18n");
const NEW_KEYS = ["app.setBioLink.previewHint"];
const blocks = Object.keys(APP_MESSAGES);
check("nine language blocks", blocks.length === 9, blocks.join(","));
for (const key of NEW_KEYS) {
  check(`"${key}" in every block`, blocks.every((code) => typeof APP_MESSAGES[code][key] === "string" && APP_MESSAGES[code][key].trim()), blocks.filter((code) => !APP_MESSAGES[code][key]).join(",") || "all");
  check(`"${key}" is used by the settings screen`, settingsCode.includes(`"${key}"`));
}
check("the toggle reuses existing keys rather than adding its own", ["app.setBranding.light", "app.setBranding.dark", "app.action.preview"].every((k) => settingsCode.includes(`"${k}"`) && blocks.every((code) => APP_MESSAGES[code][k])));

console.log(
  failures === 0
    ? "\n✓ bio link: all checks passed"
    : `\n✗ bio link: ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
