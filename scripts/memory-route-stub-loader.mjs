// scripts/memory-route-stub-loader.mjs — see memory-route-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./memory-route-stub-hooks.mjs", pathToFileURL(import.meta.filename));
