// scripts/timeclock-stub-loader.mjs — see timeclock-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./timeclock-stub-hooks.mjs", pathToFileURL(import.meta.filename));
