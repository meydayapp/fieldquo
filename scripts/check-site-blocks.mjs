// scripts/check-site-blocks.mjs
//
// sanitiseBlocks is the boundary between "what a browser sent" and "what is
// served to the public" — and it runs on every save, so anything it drops is
// gone from the company's own content, not merely hidden.
//
// ══ The bug this exists for ════════════════════════════════════════════════
//
// The "drop an incomplete item" rule was keyed on `def.imagePair` — meaning
// "does this block type have any image fields?" — and applied to every block
// that did. `beforeafter` genuinely needs both halves: a pair with one side is
// not a slider. `credentials` also has an image field, an OPTIONAL manufacturer
// badge, and `safeImageUrl` returns null when there isn't one. So every
// credentials row without an uploaded logo failed the `every()` and was
// deleted on save.
//
// The rows deleted were the ones that matter most: a licence number, a
// warranty length, years in business. Company-TYPED claims, on the one block
// the site generator is forbidden from writing precisely because several of
// them are legal assertions. The renderer never asked for this — it keeps any
// item with a label, a value OR a logo, and two of the three variants never
// draw the logo at all.
//
// Every assertion here EXECUTES sanitiseBlocks. A regex over the source would
// have passed against the broken version.
import { sanitiseBlocks, BLOCK_TYPES } from "@/app/data/siteBlocks";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const save = (type, content, repeats) =>
  sanitiseBlocks([{ id: "b1", type, visible: true, content }])[0]?.content?.[repeats] ?? [];

section("1. Company-typed credentials survive a save");

{
  const items = save(
    "credentials",
    {
      items: [
        { label: "Years in business", value: "22" },
        { label: "Licence", value: "RBQ 5812-4471-01" },
        { label: "Workmanship warranty", value: "5 years" },
        { label: "Certified installer", value: "GAF Master Elite", logo: "https://res.cloudinary.com/x/gaf.png" },
      ],
    },
    "items",
  );
  ok(items.length === 4, "all four rows survive — three of them have no logo", items.map((i) => i.label));
  ok(
    items.some((i) => i.value === "RBQ 5812-4471-01"),
    "…including the licence number, which is the whole reason the block exists",
  );
  ok(
    items.find((i) => i.label === "Certified installer")?.logo === "https://res.cloudinary.com/x/gaf.png",
    "…and a logo that WAS uploaded is kept",
  );
}

section("2. A before/after half-pair is still dropped");

{
  const pairs = save(
    "beforeafter",
    {
      pairs: [
        { before: "https://x/a.png", after: "https://x/b.png" },
        { before: "https://x/c.png" },
      ],
    },
    "pairs",
  );
  ok(pairs.length === 1, "one side is not a slider — dropping beats a divider over a blank rectangle", pairs.length);
  ok(
    BLOCK_TYPES.beforeafter.requireImages === true,
    "and it opts IN, rather than every block with an image field inheriting the rule",
  );
  ok(
    !BLOCK_TYPES.credentials.requireImages,
    "credentials does not — its image is an optional badge and its text is the point",
  );
}

section("3. The XSS guard is untouched — it was always the correct half");

{
  const items = save("credentials", { items: [{ label: "Bad", value: "x", logo: "javascript:alert(1)" }] }, "items");
  ok(items[0]?.logo === null, "a javascript: URL is nulled", items[0]?.logo);
  ok(items.length === 1, "…and the ROW survives, because its text is still real content");
  const pairs = save("beforeafter", { pairs: [{ before: "javascript:alert(1)", after: "https://x/b.png" }] }, "pairs");
  ok(pairs.length === 0, "…while a before/after whose image was rejected still drops, as it must");
}

section("4. Nothing else quietly inherits a drop rule");

{
  // The bug was a rule applying to more block types than anyone intended. This
  // asserts the blast radius directly: exactly one type may drop items for
  // missing images, and adding a second is a deliberate act.
  const requiring = Object.entries(BLOCK_TYPES)
    .filter(([, def]) => def?.requireImages)
    .map(([k]) => k);
  ok(
    JSON.stringify(requiring) === JSON.stringify(["beforeafter"]),
    "exactly one block type drops items for a missing image",
    requiring,
  );
  const withImagePair = Object.entries(BLOCK_TYPES)
    .filter(([, def]) => Array.isArray(def?.imagePair))
    .map(([k]) => k);
  ok(
    withImagePair.length > requiring.length,
    "…and more block types have image fields than drop rows for them, which is the distinction that was missing",
    withImagePair,
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
