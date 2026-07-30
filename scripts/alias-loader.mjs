// scripts/alias-loader.mjs
//
// Teaches bare node the "@/" alias, so check scripts can import real product
// code instead of a copy of it.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-whatever.mjs
//
// AGENTS.md says throwaway check scripts have to either copy the file or
// rewrite the specifier, because node's resolver doesn't know the alias that
// jsconfig sets up for webpack. Both of those workarounds test something that
// is not quite the shipped file — a copy drifts, and a rewritten specifier
// stops working the moment the real file gains an import.
//
// That already bit twice in one session: check-translations.mjs had been dead
// for long enough that the coverage gate it exists to provide never ran, and
// the contrast check broke as soon as it reached a file that itself used "@/".
// A resolver hook fixes the whole class instead of one script at a time.
//
// Resolution only — no transpiling. These are plain ES modules; node reads them
// directly (with a MODULE_TYPELESS warning, because package.json has no
// "type": "module" and adding one would change how Next builds).
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hooks.mjs", pathToFileURL(import.meta.filename));
