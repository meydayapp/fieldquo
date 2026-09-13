// scripts/memory-db-loader.mjs — see memory-db-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./memory-db-hooks.mjs", pathToFileURL(import.meta.filename));
