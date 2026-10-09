// scripts/team-access-stub-loader.mjs — see team-access-stub-hooks.mjs.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./team-access-stub-hooks.mjs", pathToFileURL(import.meta.filename));
