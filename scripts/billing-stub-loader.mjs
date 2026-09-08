// scripts/billing-stub-loader.mjs — see billing-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./billing-stub-hooks.mjs", pathToFileURL(import.meta.filename));
