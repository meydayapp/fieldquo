// scripts/role-access-stub-loader.mjs — see role-access-stub-hooks.mjs.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./role-access-stub-hooks.mjs", pathToFileURL(import.meta.filename));
