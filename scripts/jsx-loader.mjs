// scripts/jsx-loader.mjs — see jsx-hooks.mjs for what and why.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./jsx-hooks.mjs", pathToFileURL(import.meta.filename));
