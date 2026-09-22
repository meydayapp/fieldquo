// scripts/member-stub-loader.mjs — see member-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./member-stub-hooks.mjs", pathToFileURL(import.meta.filename));
