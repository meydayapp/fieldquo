// lib/sales/discovery/providers.js
//
// The one import that puts real discovery providers into the registry.
//
// Same shape and the same reason as lib/sales/pipeline/handlers/index.js: on
// Vercel the cron route is the only entry point that ever loads this code, so
// a provider nobody imports is a provider that never registers — and a
// campaign naming it would fail with "no such provider" while the file sat in
// the tree looking finished.
//
// Explicit rather than a directory scan. A glob would make the set of live
// providers depend on what happens to be on disk, and bundlers do not resolve
// one anyway (see scripts/check-imports.mjs on computed specifiers).
import "./overture/provider";

export { discoveryProviders, getDiscoveryProvider } from "./provider";
