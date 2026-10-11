// scripts/billing-lifecycle-stub-loader.mjs — see billing-lifecycle-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./billing-lifecycle-stub-hooks.mjs", pathToFileURL(import.meta.filename));
