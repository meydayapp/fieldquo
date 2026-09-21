// scripts/jsx-hooks.mjs — the load hook behind jsx-loader.mjs.
//
// Teaches bare node the JSX the product's .js files carry, so a check can
// RENDER a component (react-dom/server) rather than grep its source. The
// transform is Next's own bundled swc (next/dist/build/swc), the same
// compiler the build uses — nothing new is installed and the output is what
// ships. Only files under app/ and lib/ that contain a closing or
// self-closing tag are transformed; everything else passes straight through.
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc/index.js");
let bindings = null;
const ready = () => (bindings ||= swc.loadBindings());
const JSX_LIKE = /<\/[A-Za-z]|<[A-Za-z][\w.]*(\s[^<>]*)?\/>/;

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !/\.js$/.test(url)) return nextLoad(url, context);
  const file = fileURLToPath(url);
  if (!/\/(app|lib)\//.test(file) || file.includes("/node_modules/")) return nextLoad(url, context);
  const loaded = await nextLoad(url, { ...context, format: "module" });
  const source = String(loaded.source);
  if (!JSX_LIKE.test(source)) return { ...loaded, format: "module", source };
  await ready();
  const out = await swc.transform(source, {
    filename: file,
    jsc: {
      parser: { syntax: "ecmascript", jsx: true },
      transform: { react: { runtime: "automatic" } },
      target: "es2022",
    },
    isModule: true,
  });
  return { format: "module", shortCircuit: true, source: out.code };
}
