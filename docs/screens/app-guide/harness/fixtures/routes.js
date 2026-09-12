// docs/screens/app-guide/harness/fixtures/routes.js
//
// The API surface the photographed pages read, answered from the fixture
// company. Each entry is { path, method?, status?, reply } — `path` a string
// (exact pathname) or a RegExp, `reply` returning the JSON body (or a
// Response). First match wins, so a group file may answer a route more
// specifically than routes-core.js does by listing it — the group files are
// consulted first.
//
// Split by sidebar group so six people could write fixtures at once without
// editing one file; routes-core.js holds what every page reads.
import { ROUTES_CORE } from "./routes-core.js";
import { ROUTES_WORK } from "./routes-work.js";
import { ROUTES_PEOPLE } from "./routes-people.js";
import { ROUTES_MONEY } from "./routes-money.js";
import { ROUTES_GROW } from "./routes-grow.js";
import { ROUTES_SETTINGS_A } from "./routes-settings-a.js";
import { ROUTES_SETTINGS_B } from "./routes-settings-b.js";
import { ROUTES_CHAT } from "./routes-chat.js";

// Settings B before Grow: both answer /api/settings/document-templates,
// and only the settings file's list carries the PDF layouts and the
// isDefault flags the Email/PDF Templates pages draw; it also includes the
// two rows Marketing reads, so the order costs Grow nothing.
export const ROUTES = [
  ...ROUTES_WORK,
  ...ROUTES_PEOPLE,
  ...ROUTES_MONEY,
  ...ROUTES_SETTINGS_B,
  ...ROUTES_GROW,
  ...ROUTES_SETTINGS_A,
  ...ROUTES_CHAT,
  ...ROUTES_CORE,
];
