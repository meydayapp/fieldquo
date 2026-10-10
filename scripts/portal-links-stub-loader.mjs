// scripts/portal-links-stub-loader.mjs — see portal-links-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./portal-links-stub-hooks.mjs", pathToFileURL(import.meta.filename));
