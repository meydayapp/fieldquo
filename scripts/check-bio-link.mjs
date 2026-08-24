// scripts/check-bio-link.mjs
//
// Executes the pure half of the bio-link page against input nobody would type
// on purpose: no slug, no links at all, a "__proto__" key in the stored
// config, a javascript: URL in a custom link, and the brand colours
// contractors actually pick — "", "#fff", "not-a-colour", plus the three that
// are live in the database today (#c0c0c0 silver, #fefcdd near-white, #1a1a1a
// near-black).
//
//   node --import ./scripts/alias-loader.mjs scripts/check-bio-link.mjs
//
// Contrast is the reason this file exists rather than a reading of the code.
// Every pairing the page renders is measured here, and a company whose brand
// is white must come out of it with legible text or the check fails.

import { linkCandidates } from "@/lib/links/candidates";
import { sanitiseLinkConfig, resolveLinks, visibleLinks } from "@/lib/links/config";
import { safeUrl, telHref, whatsappHref, linkPageUrl } from "@/lib/links/href";
import { linkPageTheme, themeContrastReport } from "@/lib/links/theme";

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
    ],
  }),
);
const clean = sanitiseLinkConfig(hostile);
check("prototype keys dropped", !clean.items.some((i) => /proto|constructor/.test(i.key)));
check("duplicate key dropped", clean.items.filter((i) => i.key === "quote").length === 1);
check("first duplicate wins (disabled)", clean.items.find((i) => i.key === "quote").enabled === false);
check("javascript: custom dropped", !clean.items.some((i) => i.url?.startsWith("javascript")));
check(
  "good custom kept and re-keyed",
  clean.items.some((i) => i.key === "custom:0" && i.url === "https://instagram.com/northline"),
);
check("labelless custom dropped", clean.items.filter((i) => i.key.startsWith("custom:")).length === 1);
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
