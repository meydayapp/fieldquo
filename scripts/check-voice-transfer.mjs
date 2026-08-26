// scripts/check-voice-transfer.mjs
//
// VoiceAgent.transferTo shipped as a DEAD CONTROL. It was editable in
// Settings > Voice, trimmed and validated by PATCH /api/settings/voice,
// returned by that route's GET, and it reached the provider nowhere: no grep
// for "transfer" matched anything in provision.js, prompt.js, tools.js or
// retell.js. A contractor who typed their mobile in got an agent that could
// not put anyone through, and nothing on the screen said so.
//
// The field-exists-but-nothing-reads-it half is the reason this check reads
// SOURCE as well as executing the builders — the executable half would have
// passed all along on a tool nobody ever handed to Retell.

import { readFileSync } from "node:fs";
import { toolDefinitions, TOOL_NAMES } from "../lib/voice/tools.js";
import { buildAgentPrompt } from "../lib/voice/prompt.js";
import { toE164 } from "../lib/voice/numbers.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};
const ORIGIN = "https://app.example.com";
const find = (tools, name) => tools.find((t) => t.name === name) || null;

// ── The tool only exists when there is somewhere to transfer TO ───────────
{
  const without = toolDefinitions(ORIGIN, { canBook: true });
  ok("no destination, no transfer tool", find(without, "transfer_to_human") === null);
  for (const empty of [null, undefined, "", 0, false])
    ok(`falsy destination offers no transfer: ${JSON.stringify(empty)}`,
       find(toolDefinitions(ORIGIN, { transferTo: empty }), "transfer_to_human") === null);

  const withT = toolDefinitions(ORIGIN, { canBook: true, transferTo: "+16135550123" });
  const tool = find(withT, "transfer_to_human");
  ok("a destination produces the tool", tool !== null);
  ok("it is the provider's built-in, not one of our endpoints", tool?.type === "transfer_call");
  ok("it carries no url — Retell bridges it, we serve nothing", tool?.url === undefined);
  ok("the number reaches the provider", tool?.transfer_destination?.number === "+16135550123");
  ok("predefined destination", tool?.transfer_destination?.type === "predefined");
  // Warm transfer puts the contractor on hold listening to a summary while the
  // customer waits on the other leg. A one-van business is usually driving.
  ok("cold transfer", tool?.transfer_option?.type === "cold_transfer");
  ok("transfer does not displace booking", find(withT, "book_visit") !== null);
  ok("transfer does not displace lead capture", find(withT, "save_caller") !== null);
}

// ── It must NOT be served over HTTP ───────────────────────────────────────
ok("transfer is absent from the served tool names",
   !TOOL_NAMES.includes("transfer_to_human") && !TOOL_NAMES.includes("transfer"));
ok("the served names are unchanged",
   JSON.stringify(TOOL_NAMES) === JSON.stringify(["save-caller", "availability", "book"]),
   JSON.stringify(TOOL_NAMES));

// ── The prompt says which world it is in, BOTH ways ───────────────────────
//
// An agent that doesn't know it can't transfer offers to put people through
// and then can't. One that doesn't know it can takes a message from someone
// asking for a human. Silence is wrong in both directions.
{
  const co = { name: "Acme Painting" };
  const off = buildAgentPrompt({ company: co, canTransfer: false });
  const on = buildAgentPrompt({ company: co, canTransfer: true });
  ok("without transfer it is told not to offer", /cannot transfer calls/i.test(off));
  ok("without transfer it is told what to do instead", /ring them back/i.test(off));
  ok("with transfer it is told the tool name", /transfer_to_human/.test(on));
  ok("with transfer it is told to say so first", /putting them through/i.test(on));
  ok("the default is no transfer", buildAgentPrompt({ company: co }).includes("cannot transfer calls"));
  // The escape hatch must not become a licence to quote.
  ok("never-quote survives either way",
     /NEVER give a price/.test(off) && /NEVER give a price/.test(on));
}

// ── A typed number is normalised before it is dialled ─────────────────────
//
// The settings API stores what was typed, trimmed to 40 chars. A transfer
// destination has to be dialable E.164 or the provider rejects the whole agent.
ok("(613) 555-0123 normalises", toE164("(613) 555-0123") === "+16135550123");
ok("13 digits with a 1 normalises", toE164("1-613-555-0123") === "+16135550123");
ok("an already-E.164 number survives", toE164("+16135550123") === "+16135550123");
for (const junk of ["", "  ", "ext 2", "call me", "12", null, undefined, "abc"])
  ok(`unusable destination becomes null: ${JSON.stringify(junk)}`, toE164(junk) === null);

// ── The wiring itself, because the executable half passed while it was dead ─
{
  const prov = readFileSync("lib/voice/provision.js", "utf8");
  ok("provision normalises the stored value", /toE164\(agent\?\.transferTo\)/.test(prov));
  ok("provision hands the destination to the tools", /toolDefinitions\([^)]*transferTo/s.test(prov));
  ok("provision tells the prompt which world it is in", /canTransfer:/.test(prov));

  const api = readFileSync("app/api/settings/voice/route.js", "utf8");
  // Saving the field has to push, or it stays dead until something else does.
  ok("saving voice settings re-provisions the agent", /provisionAgent\(/.test(api));
  ok("the field is still accepted and stored", /body\.transferTo/.test(api));
}

console.log(fail === 0 ? "\nALL PASS — the transfer number reaches the phone" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
