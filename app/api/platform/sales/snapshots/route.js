// app/api/platform/sales/snapshots/route.js
//
// The one place the snapshot bucket's public URL is set.
//
// ══ Why this route exists at all ═══════════════════════════════════════════
//
// Every campaign used to demand its own "Snapshot URL (required)" and tell the
// owner to run a DuckDB extractor and host the result. The extract had already
// been run and uploaded — 80 files, 1,320,105 rows, in R2 — so the form was
// asking, eighty times over, for a thing that was done once. The base URL is
// the ONLY part of a snapshot URL a human can know, so it is the only part a
// human is asked for; everything after the slash comes from
// lib/sales/discovery/snapshotLibraryData.js.
//
// ══ Why a save is a fetch ══════════════════════════════════════════════════
//
// PUT does not store what it is given. It derives the URL of one real object
// from it, fetches that object's first line, and refuses the save unless the
// header comes back saying what the library says it should. A base URL that
// saves cleanly and 404s on every object would leave eighty campaigns that run,
// read nothing, and report themselves complete.
//
// ══ Not the credentials ════════════════════════════════════════════════════
//
// `Cloudfare_Access_Key_ID` and its siblings (the misspelling is real, and is
// kept: it is what the deployment already carries, and renaming it in code
// without renaming it in Vercel breaks the uploader for a tidier variable
// name) stay in the environment. This is the PUBLIC read URL — the one a
// browser could fetch — and nothing here reads, returns or wants a secret.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { normaliseSnapshotBase, snapshotUrlFor } from "@/lib/sales/discovery/snapshotLibrary";
import {
  SNAPSHOT_LIBRARY_SINGLETON,
  librarySummary,
  loadSnapshotLibrarySetting,
  probeTarget,
} from "@/lib/sales/discovery/snapshotSetting";
import { probeSnapshot } from "@/lib/sales/discovery/snapshotProbe";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json({
    library: await loadSnapshotLibrarySetting(db),
    catalogue: librarySummary(),
  });
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const { baseUrl, error } = normaliseSnapshotBase(body?.baseUrl);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const target = probeTarget();
  if (!target) {
    return NextResponse.json(
      { error: "This build ships no snapshot library, so there is nothing to point a base URL at." },
      { status: 400 },
    );
  }

  const url = snapshotUrlFor(baseUrl, target.objectKey);
  const probe = await probeSnapshot(url, target);
  if (!probe.ok) {
    // Refused, not saved-with-a-warning. A base URL stored while known to be
    // wrong reads as "configured" on every screen that asks, and eighty
    // campaigns downstream would be built on it.
    return NextResponse.json(
      { error: "That base URL did not serve a snapshot, so it was not saved.", problems: [probe.problem] },
      { status: 400 },
    );
  }

  const now = new Date();
  const stored = {
    baseUrl,
    verifiedObjectKey: target.objectKey,
    verifiedRows: target.rows,
    verifiedAt: now,
    updatedByAdminId: admin.id,
  };
  await db.platformSnapshotLibrary.upsert({
    where: { id: SNAPSHOT_LIBRARY_SINGLETON },
    create: { id: SNAPSHOT_LIBRARY_SINGLETON, ...stored },
    update: stored,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_snapshot_base_url_set",
      details: {
        baseUrl,
        provedAgainst: target.objectKey,
        headerProvider: probe.header?.provider ?? null,
        headerRelease: probe.header?.release ?? null,
      },
    },
  });

  return NextResponse.json({ library: await loadSnapshotLibrarySetting(db), catalogue: librarySummary() });
}
