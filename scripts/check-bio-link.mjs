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
// Every pairing the page renders is measured here, and a company whose brand
// is white must come out of it with legible text or the check fails.

import { readFileSync } from "node:fs";
import { linkCandidates, linkGroupLabels, LINK_GROUPS } from "@/lib/links/candidates";
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
import { linkPageTheme, themeContrastReport } from "@/lib/links/theme";
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
  "review/whatsapp/email are present but off",
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
    const off = ["whatsapp", "email", "review"];
    return off.every((k) => c.find((x) => x.key === k)?.defaultOn === false);
  })(),
);

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

// ── contrast, against brand colours that break the naive rule ──────────────
console.log("\ncontrast (4.5:1 on text, 3:1 on the card edge — every pairing the page paints)");
const BRANDS = [
  ["unset (null)", null],
  ["empty string", ""],
  ["not-a-colour", "not-a-colour"],
  ["#fff", "#fff"],
  ["#ffffff", "#ffffff"],
  ["#000000", "#000000"],
  ["#c0c0c0 silver (live)", "#c0c0c0"],
  ["#fefcdd near-white (live)", "#fefcdd"],
  ["#1a1a1a near-black (live)", "#1a1a1a"],
  ["#bd9d60 sand (live)", "#bd9d60"],
  ["#808080 mid grey", "#808080"],
  ["#ffff00 yellow", "#ffff00"],
  ["#7cfc00 lawn green", "#7cfc00"],
  ["#ff5a00 fieldquo orange", "#ff5a00"],
];
for (const [name, brandColor] of BRANDS) {
  const theme = linkPageTheme({ brandColor });
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
}

console.log(
  failures === 0
    ? "\n✓ bio link: all checks passed"
    : `\n✗ bio link: ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
