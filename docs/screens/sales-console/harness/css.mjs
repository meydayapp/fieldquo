// Compile app/globals.css with Tailwind v4's node API, scanning the app for classes.
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
// The checkout build.sh cd'd into — a worktree builds from its own sources,
// not the main checkout's (a hardcoded path once compiled a ring dialog
// with no z-[80] rule, because that class existed only in the worktree).
const ROOT = process.cwd();
const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
const compiler = await compile(css, { base: path.join(ROOT, "app"), onDependency() {} });
const scanner = new Scanner({ sources: [{ base: ROOT, pattern: "**/*", negated: false }, ...compiler.sources] });
const candidates = scanner.scan();
const out = compiler.build(candidates);
writeFileSync(process.argv[2], out);
console.log("css bytes", out.length, "candidates", candidates.length);
