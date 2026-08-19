// scripts/alias-hooks.mjs
//
// The resolve hook behind alias-loader.mjs. Maps "@/x/y" to <repo>/x/y and
// appends ".js" when the specifier is extensionless, which is how the product
// code writes its imports (webpack fills the extension in; node does not).
import { pathToFileURL, fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");

// existsSync is not the question — "is there a FILE here" is.
//
// `@/lib/permissions` has both lib/permissions.js and a lib/permissions/
// directory beside it. The candidate list tried the bare path first, existsSync
// said yes about the DIRECTORY, and node then died with
//
//   Error: EISDIR: illegal operation on a directory, read
//
// which reads like a broken script rather than a resolution miss. Webpack picks
// the file; so does this now. The directory case is still reachable through the
// explicit index.js candidate at the end of the list.
function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  // Relative, extensionless — how the product code writes intra-module imports
  // ("./geometry"). Webpack fills the extension in; node does not, and without
  // this a check script dies the moment the file it imports has a sibling
  // import of its own.
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const dir = dirname(fileURLToPath(context.parentURL));
    for (const candidate of [`${join(dir, specifier)}.js`, join(dir, specifier, "index.js")]) {
      if (isFile(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }

  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = join(ROOT, specifier.slice(2));
  // Try the specifier as written, then with .js, then as a directory index —
  // the three shapes the codebase actually uses.
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, "index.js")]) {
    if (isFile(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
