// app/api/settings/website/photos/route.js
//
// The photo library, and before/after pairing.
//
// ── The question this answers ──────────────────────────────────────────────
//
// "Right now I can upload 3, 4, 6 — how will it know which is which?"
//
// It can't, and it must not guess. Nothing in an image file says whether it's the
// before or the after, and a public page that captions a finished kitchen as the
// "before" is worse than having no slider. Two photos on one job visit is a
// reasonable SUGGESTION (see jobPhotoPairs) but it is only ever a suggestion.
//
// So pairing is an explicit, repeatable act: choose a before, choose an after,
// name the job, confirm. Then do it again. One pair per iteration, which is what
// makes a pool of six photos resolvable into three known pairs instead of a bag
// the software has to interpret.
//
// POST   { url } | { urls }        add to the library
// PUT    { pairs: [...] }          replace the confirmed pairs (the pairing step)
// DELETE ?url=                     remove one from the library
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { makeBlock, sanitiseBlocks } from "@/app/data/siteBlocks";
import { recordActivity } from "@/lib/activity/log";

function isAdmin(role) {
  return role === "owner" || role === "admin";
}

/** Same guard the block sanitiser uses — these land in src on a public page. */
function safeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url.slice(0, 1000) : null;
}

async function requireSite(member) {
  const site = await db.companySite.findUnique({
    where: { companyId: member.companyId },
  });
  return site;
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the website." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const incoming = (Array.isArray(body?.urls) ? body.urls : [body?.url])
    .map(safeUrl)
    .filter(Boolean);
  if (!incoming.length) {
    return NextResponse.json({ error: "No usable image URL." }, { status: 400 });
  }

  const site = await requireSite(member);
  if (!site) {
    return NextResponse.json(
      { error: "Create your site first, then add photos." },
      { status: 409 },
    );
  }

  const existing = Array.isArray(site.photoLibrary) ? site.photoLibrary : [];
  const have = new Set(existing.map((p) => p?.url));
  // Deduped: uploading the same file twice would otherwise give you two
  // identical thumbnails to pair between, which is confusing rather than useful.
  const added = incoming
    .filter((url) => !have.has(url))
    .map((url) => ({ url, at: new Date().toISOString() }));

  const photoLibrary = [...existing, ...added].slice(-60);
  await db.companySite.update({
    where: { companyId: member.companyId },
    data: { photoLibrary },
  });

  return NextResponse.json({ photoLibrary, added: added.length });
}

export async function PUT(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the website." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const pairs = (Array.isArray(body?.pairs) ? body.pairs : [])
    .map((p) => ({
      before: safeUrl(p?.before),
      after: safeUrl(p?.after),
      caption: typeof p?.caption === "string" ? p.caption.slice(0, 200) : "",
    }))
    // A half pair is not a pair. Dropping it beats rendering a divider over a
    // blank rectangle, which reads as a broken image.
    .filter((p) => p.before && p.after && p.before !== p.after)
    .slice(0, 12);

  const site = await requireSite(member);
  if (!site) {
    return NextResponse.json(
      { error: "Create your site first." },
      { status: 409 },
    );
  }

  const blocks = Array.isArray(site.blocks) ? [...site.blocks] : [];
  const at = blocks.findIndex((b) => b?.type === "beforeafter");

  if (pairs.length === 0) {
    // No pairs left: hide the section rather than leaving a heading over
    // nothing. Not deleted — the company may re-pair tomorrow and the heading
    // they wrote should survive that.
    if (at !== -1) blocks[at] = { ...blocks[at], visible: false };
  } else if (at === -1) {
    // First pair ever: the section doesn't exist yet. Insert it high — before
    // services if there is one — because it's the reason a visitor stays.
    const block = makeBlock("beforeafter", { pairs });
    const servicesAt = blocks.findIndex((b) => b?.type === "services");
    blocks.splice(servicesAt === -1 ? 1 : servicesAt, 0, block);
  } else {
    blocks[at] = {
      ...blocks[at],
      visible: true,
      content: { ...blocks[at].content, pairs },
    };
  }

  const saved = sanitiseBlocks(blocks);
  await db.companySite.update({
    where: { companyId: member.companyId },
    data: { blocks: saved },
  });

  await recordActivity(member, {
    action: "website.pairs_set",
    entityType: "settings",
    summary: `Set ${pairs.length} before/after pair(s) on the website`,
    metadata: { pairs: pairs.length },
  });

  return NextResponse.json({ blocks: saved, pairs });
}

export async function DELETE(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the website." },
      { status: 403 },
    );
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });

  const site = await requireSite(member);
  if (!site) return NextResponse.json({ error: "No site." }, { status: 404 });

  const photoLibrary = (Array.isArray(site.photoLibrary) ? site.photoLibrary : []).filter(
    (p) => p?.url !== url,
  );

  // Removing a photo that is HALF of a confirmed pair would leave that pair
  // broken, so the pair goes with it. Said in the response so the UI can tell
  // the company rather than having a slider quietly disappear.
  const blocks = Array.isArray(site.blocks) ? [...site.blocks] : [];
  let brokenPairs = 0;
  const at = blocks.findIndex((b) => b?.type === "beforeafter");
  if (at !== -1) {
    const before = blocks[at].content?.pairs || [];
    const kept = before.filter((p) => p.before !== url && p.after !== url);
    brokenPairs = before.length - kept.length;
    blocks[at] = {
      ...blocks[at],
      visible: kept.length > 0,
      content: { ...blocks[at].content, pairs: kept },
    };
  }

  await db.companySite.update({
    where: { companyId: member.companyId },
    data: { photoLibrary, blocks: sanitiseBlocks(blocks) },
  });

  return NextResponse.json({ photoLibrary, brokenPairs });
}
