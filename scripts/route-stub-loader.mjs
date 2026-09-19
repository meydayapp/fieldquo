// scripts/route-stub-loader.mjs — see route-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./route-stub-hooks.mjs", pathToFileURL(import.meta.filename));
