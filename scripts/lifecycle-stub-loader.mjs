// scripts/lifecycle-stub-loader.mjs — see lifecycle-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./lifecycle-stub-hooks.mjs", pathToFileURL(import.meta.filename));
