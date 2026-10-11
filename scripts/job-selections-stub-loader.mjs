// scripts/job-selections-stub-loader.mjs — see job-selections-stub-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./job-selections-stub-hooks.mjs", pathToFileURL(import.meta.filename));
