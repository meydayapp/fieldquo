// Compile app/globals.css with Tailwind v4's node API, scanning the app for classes.
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const ROOT = "/Users/emilioboves/StudioProjects/fieldquo";
const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
const compiler = await compile(css, { base: path.join(ROOT, "app"), onDependency() {} });
const scanner = new Scanner({ sources: [{ base: ROOT, pattern: "**/*", negated: false }, ...compiler.sources] });
const candidates = scanner.scan();
const out = compiler.build(candidates);
writeFileSync(process.argv[2], out);
console.log("css bytes", out.length, "candidates", candidates.length);
