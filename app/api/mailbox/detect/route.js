// app/api/mailbox/detect/route.js
//
// POST { address } — which provider hosts this address, from the domain's MX
// records (a free DNS lookup on our side), so the connect form picks the
// right preset — or says "use the Google / Microsoft option" — as soon as
// the person types their address. Nothing is stored; the answer is a preset
// key and the MX host names.
//
// Signed-in members only, rate-limited: an open MX-lookup endpoint is a free
// DNS reflector for anyone.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { memberOrRefusal } from "@/lib/apiMember";
import { rateLimit } from "@/lib/rateLimit";
import { bareAddress } from "@/lib/mailbox/addresses";
import { presetForMx, presetForDomain } from "@/lib/mailbox/presets";

const TIMEOUT_MS = 4000;

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  void member;

  const limited = rateLimit(request, "mailbox-detect", { limit: 30, windowMs: 10 * 60 * 1000, message: "Too many lookups. Try again in a few minutes." });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const address = bareAddress(body.address);
  if (!address) return NextResponse.json({ error: "Enter the full email address.", code: "bad_address" }, { status: 400 });
  const domain = address.split("@")[1];

  // A mailbox provider's own domain (gmail.com, icloud.com, shaw.ca) is
  // answered from the list; a company's own domain from its MX records.
  const byDomain = presetForDomain(domain);
  let hosts = [];
  if (!byDomain) {
    try {
      const records = await Promise.race([
        dns.resolveMx(domain),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
      ]);
      hosts = (records || []).sort((a, b) => a.priority - b.priority).map((r) => String(r.exchange || "").toLowerCase()).filter(Boolean).slice(0, 10);
    } catch {
      hosts = [];
    }
  }

  const preset = byDomain || presetForMx(hosts);
  return NextResponse.json({
    domain,
    mx: hosts,
    preset: preset?.route === "imap" ? preset.key : null,
    route: preset?.route || null,
    label: preset?.label || null,
    noteKey: preset?.noteKey || null,
  });
}
