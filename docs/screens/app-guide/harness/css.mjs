// Compile app/globals.css with Tailwind v4's node API, scanning the app for classes.
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// build.sh copies this file to the checkout's root before running it, so the
// root is this file's own directory — a worktree compiles its own CSS.
const ROOT = process.env.ROOT || path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
const compiler = await compile(css, { base: path.join(ROOT, "app"), onDependency() {} });
const scanner = new Scanner({ sources: [{ base: ROOT, pattern: "**/*", negated: false }, ...compiler.sources] });
const candidates = scanner.scan();
const out = compiler.build(candidates);
writeFileSync(process.argv[2], out);
console.log("css bytes", out.length, "candidates", candidates.length);
