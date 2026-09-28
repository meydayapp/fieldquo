// scripts/impersonation-stub-loader.mjs — see impersonation-stub-hooks.mjs.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./impersonation-stub-hooks.mjs", pathToFileURL(import.meta.filename));
