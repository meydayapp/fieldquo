// lib/kitchen/key.js
//
// The one string that says a company sells kitchen design, in a file with no
// imports — so a CLIENT component can read it. lib/kitchen/access.js exports
// the same constant and re-exports this one, but it also imports lib/db, and a
// browser bundle that reaches for the key must not drag the database driver
// in behind it. Share your links (app/app/settings/lead-form) is that client.
//
// This is a ServiceCategory key (Settings → Services → "Kitchen Design & New
// Installs"), NOT a platform feature flag — lib/features/registry.js has no
// entry for it. A company turns the public designer on by saying it does the
// work, which is the only honest switch: the page asks strangers to draw a
// kitchen they expect this company to build.
export const KITCHEN_DESIGN_KEY = "kitchen_design";
