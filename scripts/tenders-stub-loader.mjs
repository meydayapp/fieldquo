// scripts/tenders-stub-loader.mjs — see tenders-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tenders-stub-hooks.mjs", pathToFileURL(import.meta.filename));
