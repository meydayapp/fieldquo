// prisma/seed-design-templates.js
//
//   npm run seed:design-templates
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

async function main() {
  for (const t of TEMPLATES) {
    const doc = readJson(t.jsonFile);
    const clip = clipOf(doc);
    if (!clip?.width || !clip?.height) {
      throw new Error(`${t.jsonFile}: no "clip" object with width/height — not a usable template`);
    }

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

  const count = await db.designTemplate.count();
  console.log(`\n${count} design template(s) in the gallery.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
