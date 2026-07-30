// scripts/alias-hooks.mjs
//
// The resolve hook behind alias-loader.mjs. Maps "@/x/y" to <repo>/x/y and
// appends ".js" when the specifier is extensionless, which is how the product
// code writes its imports (webpack fills the extension in; node does not).
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = join(ROOT, specifier.slice(2));
  // Try the specifier as written, then with .js, then as a directory index —
  // the three shapes the codebase actually uses.
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, "index.js")]) {
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
