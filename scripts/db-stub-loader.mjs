// scripts/db-stub-loader.mjs — see db-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./db-stub-hooks.mjs", pathToFileURL(import.meta.filename));
