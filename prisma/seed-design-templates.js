// prisma/seed-design-templates.js
//
//   npm run seed:design-templates             (writes)
//   npm run seed:design-templates -- --dry-run  (builds and checks, writes nothing)
//
// ── 2026-09-29: the contractor catalogue ────────────────────────────────────
//
// Besides the two generic starters below, this seeds FieldQuo's own
// contractor templates — lib/designer/templateCatalog.js's TEMPLATE_CATALOG,
// before/after, win-work, trust, tips and people posts, each with a layout in
// every publishing format (4:5, 9:16, 1.91:1; never the square). Upserted on
// the template's stable `key`, so re-running fixes a template in place and a
// company's own saved templates (companyId set) are never touched. Additive:
// nothing is deleted, and a key dropped from the catalogue leaves its row
// alone for a person to decide about.
//
// The documents carry colour ROLES and copy KEYS, not colours and words — the
// company's brand and language are applied when a template is opened
// (app/api/designer/templates). That is also why there is no thumbnail file:
// the sidebar renders each preview in the company's own colours.
//
// The Marketing Designer's starter-template gallery — DesignTemplate rows,
// global (no companyId), same reasoning as seed-checklists.js's system
// checklists: every company sees the same shelf.
//
// ── Why exactly two, and why THESE two ──────────────────────────────────────
//
// The source clone this editor was ported from (nextjs-canva-clone-master)
// shipped four sample templates in its public/ folder: car_sale, coming_soon,
// flash_sale, travel — real fabric.js documents with real matching
// thumbnails, referenced by nothing in that project (no seed mechanism
// existed there either). Seeding fabricated "trade template" JSON by hand was
// considered and rejected: a hand-rolled shape/text layout claiming to be a
// professional starter is the "must be real, not placeholder" instruction
// violated in spirit even where it's technically true in form, and a
// customer-facing gallery is a bad place for a first attempt at graphic
// design.
//
// Of the four, only coming_soon and flash_sale are seeded here. car_sale and
// travel both embed a `type: "image"` object pointing at a live third-party
// URL (uploadthing's CDN and Unsplash's CDN respectively) — a hotlink this
// repo doesn't control and didn't upload, which can 404 the moment either
// host rotates or deletes the file, silently breaking a template that
// APPEARED to work. coming_soon and flash_sale are pure shapes/text, fully
// self-contained, and will render identically forever. Restoring the other
// two is one line each (see TEMPLATES below) once their images are
// re-hosted on Cloudinary — genuinely five minutes of work, deliberately not
// done blind in this session.
//
// Idempotent on `name`: re-running updates the JSON/thumbnail rather than
// duplicating the row, so fixing a typo in a template doesn't leave the old
// version sitting in the gallery next to the new one.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "../lib/db.js";
import { TEMPLATE_CATALOG, buildTemplateSlides } from "../lib/designer/templateCatalog.js";
import { TEMPLATE_FORMATS } from "../lib/marketing/destinations.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(HERE, rel), "utf8"));

const clipOf = (doc) => doc.objects.find((o) => o.name === "clip");

const TEMPLATES = [
  {
    name: "Coming Soon",
    jsonFile: "seed-assets/design-templates/coming-soon.json",
    thumbnailUrl: "/design-templates/coming-soon.png",
  },
  {
    name: "Flash Sale",
    jsonFile: "seed-assets/design-templates/flash-sale.json",
    thumbnailUrl: "/design-templates/flash-sale.png",
  },
  // {
  //   name: "Car Sale",
  //   jsonFile: "seed-assets/design-templates/car-sale.json",
  //   thumbnailUrl: "/design-templates/car-sale.png",
  // }, // needs its `type:"image"` src re-hosted off utfs.io first
  // {
  //   name: "Travel",
  //   jsonFile: "seed-assets/design-templates/travel.json",
  //   thumbnailUrl: "/design-templates/travel.png",
  // }, // needs its `type:"image"` src re-hosted off images.unsplash.com first
];

const DRY_RUN = process.argv.includes("--dry-run");

async function seedCatalogue() {
  for (const t of TEMPLATE_CATALOG) {
    const slides = buildTemplateSlides(t);
    for (const [i, slide] of slides.entries()) {
      for (const key of TEMPLATE_FORMATS) {
        if (!slide[key]?.json?.objects?.length) throw new Error(`${t.key}: slide ${i + 1} has no ${key} layout`);
      }
      if (slide.instagram_post) throw new Error(`${t.key}: a new template must not carry a square layout`);
    }
    const primary = slides[0].instagram_portrait;
    const data = {
      category: t.category,
      slides,
      // The 4:5 first slide doubles as the row's `json`, which is what the
      // template's column has always held and what an older reader expects.
      json: primary.json,
      width: primary.width,
      height: primary.height,
      thumbnailUrl: null,
    };
    if (!DRY_RUN) {
      await db.designTemplate.upsert({
        where: { key: t.key },
        // `name` stays unique and internal for catalogue rows — the sidebar
        // prints the translated app.designerTemplates.name.<key>.
        create: { key: t.key, name: `catalog:${t.key}`, ...data },
        update: data,
      });
    }
    console.log(`  ${DRY_RUN ? "dry " : "ok  "} ${t.key} (${t.category}, ${slides.length} slide(s) x ${TEMPLATE_FORMATS.length} formats)`);
  }
}

async function main() {
  await seedCatalogue();
  for (const t of TEMPLATES) {
    const doc = readJson(t.jsonFile);
    const clip = clipOf(doc);
    if (!clip?.width || !clip?.height) {
      throw new Error(`${t.jsonFile}: no "clip" object with width/height — not a usable template`);
    }

    if (DRY_RUN) continue;
    await db.designTemplate.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        json: doc,
        width: clip.width,
        height: clip.height,
        thumbnailUrl: t.thumbnailUrl,
      },
      update: {
        json: doc,
        width: clip.width,
        height: clip.height,
        thumbnailUrl: t.thumbnailUrl,
      },
    });
    console.log(`  ok   ${t.name} (${clip.width}x${clip.height}, ${doc.objects.length} objects)`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run: ${TEMPLATE_CATALOG.length} catalogue template(s) built; nothing written.`);
    return;
  }
  const count = await db.designTemplate.count({ where: { companyId: null } });
  console.log(`\n${count} FieldQuo template(s) in the gallery.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
