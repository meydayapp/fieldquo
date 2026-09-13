// The fixture registry: each module answers the routes it knows and returns
// undefined for the rest; the first answer wins. A route nobody answers is a
// loud 500 in stubs/platformFetch.js, recorded on window.__harnessUnanswered
// so the frame is marked rather than quietly rendering an empty state.
//
// Contract for a module:
//   export default function answer({ method, path, url, body })
//     → a plain object (sent as JSON 200), a Response (sent as is), or undefined.
//   export const scenes = { "/platform/route": { name: async ({ until, wait, settled }) => {} } }
//     → optional; a scene presses shipped controls before the frame is taken
//       (?scene=name on the harness URL, SCENE=name to shoot.mjs).
import core from "./core.js";
import customers, { scenes as customerScenes } from "./customers.js";
import support, { scenes as supportScenes } from "./support.js";
import salesTeam, { scenes as salesTeamScenes } from "./salesTeam.js";
import salesDiscovery, { scenes as salesDiscoveryScenes } from "./salesDiscovery.js";
import salesFunnel, { scenes as salesFunnelScenes } from "./salesFunnel.js";

export const FIXTURES = [core, customers, support, salesTeam, salesDiscovery, salesFunnel];

/** Scenes by route, merged across the modules. */
export const SCENES = Object.assign({}, customerScenes, supportScenes, salesTeamScenes, salesDiscoveryScenes, salesFunnelScenes);
