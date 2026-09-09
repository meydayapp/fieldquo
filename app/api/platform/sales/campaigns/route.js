// app/api/platform/sales/campaigns/route.js
//
// The discovery campaigns, for the superadmin screen that creates them.
//
// ══ Why a campaign names its own sources ══════════════════════════════════
//
// `ProspectCampaign.discoverySources` has NO default. The schema comment
// explains it at length: the obvious default was Google, and the Maps Platform
// ToS forbids storing business names and addresses and forbids building a
// directory at all — so a default would have quietly pointed the first
// campaign at the one source that cannot legally serve it. This route
// therefore REFUSES a campaign with no source rather than filling one in.
//
// A campaign names a SET, per the owner's rule that "where the business comes
// from should be a checkbox to allow multiple sources". Two things this route
// is careful about as a result:
//
//   - a source that CANNOT RUN is refused rather than saved. RBQ reports
//     itself unavailable today (the register carries no website column, so
//     nothing can ever establish a trade for its rows), and a campaign saved
//     with it ticked would render a Start button that fails on click.
//   - the config is keyed per source. Both shipped sources have a field called
//     `snapshotUrl`, so one blob for several sources means the second reads
//     the first one's file — a wrong dataset under the right provider name.
//
// ══ Why the territory can be created here ═════════════════════════════════
//
// The owner's standing rule is that every setting is editable from the
// superadmin UI, not from a seed script. A campaign is meaningless without a
// territory, and shipping the campaign form while leaving territories to
// `psql` would be exactly the half-done version that rule names.
//
// A separate territory console — renaming, deactivating, editing a radius
// after the fact — is NOT built. That is stated on the screen rather than
// hinted at with a control that does nothing.
//
// ══ Nobody types a snapshot URL any more ═══════════════════════════════════
//
// UPDATED 2026-09-09. Every source used to demand its own "Snapshot URL
// (required)", with help telling the owner to run a DuckDB extractor and host
// the output — for an extract that had already been run and uploaded: 80 files,
// 1,320,105 rows, in R2. His words: "where the fuck do I get the snapshot URL…
// it should be just automated for me in a way that I can just select few things
// and get the total number of trade."
//
// So this route no longer accepts a snapshot URL from anybody. It reads the
// base URL configured once at /platform/sales/snapshots, looks up which files
// cover the chosen sources and region in the measured library, DERIVES each
// URL, and fetches each one's first line before saving. A campaign pointed at a
// file that is not there now fails on the form rather than running, reading
// nothing and reporting itself complete.
//
// ══ Which is why one submission can create several campaigns ═══════════════
//
// The extract is split at 50,000 rows a file — California's register is five
// files — and a campaign carries ONE snapshot URL per source. Rather than
// invent a multi-file cursor (a change to every provider's paging, for a
// property the library already knows), one campaign is created per file and the
// form says so with the count before the button is pressed. Same territory,
// same trade, same sources; the funnel adds up across them on the list.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { discoveryProviders, getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { campaignTradeLabel, discoveryTradeKeys, DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { campaignProgress, funnelRows } from "@/lib/sales/discovery/funnel";
import {
  describeSources,
  readSourceSelection,
  startProblems,
  unavailableReasonOf,
} from "@/lib/sales/discovery/sources";
import { campaignNameForFile, snapshotSelection, snapshotUrlFor } from "@/lib/sales/discovery/snapshotLibrary";
import { loadSnapshotLibrarySetting } from "@/lib/sales/discovery/snapshotSetting";
import { probeSnapshot } from "@/lib/sales/discovery/snapshotProbe";
import { campaignStartBlockers, territoryRegistration } from "@/lib/sales/discovery/campaignGate";

const MAX_NAME = 120;
const MAX_TARGET = 50_000;
/** How many campaigns one submission may create. The largest single selection
 *  in the library is California — 5 register parts plus 2 Overture parts — so
 *  this is headroom, not a policy. It exists because a bug in the selection
 *  arithmetic should fail loudly rather than write two hundred rows. */
const MAX_CAMPAIGNS_PER_SUBMISSION = 24;

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [campaigns, territories] = await Promise.all([
    db.prospectCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { territory: true },
      take: 200,
    }),
    db.salesTerritory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const library = await loadSnapshotLibrarySetting(db);

  return NextResponse.json({
    // Whether snapshots are configured at all, and where to go if not. The form
    // needs this BEFORE it renders anything: with no base URL there is no way
    // to build a snapshot URL, so the honest screen is a sentence pointing at
    // the one setting — not a URL box on every source, which is what this
    // whole change removed.
    library,
    campaigns: campaigns.map((c) => {
      const sources = describeSources(c, { getProvider: getDiscoveryProvider });
      return {
        ...c,
        // Named on the LIST and not only inside the campaign: "All trades" and
        // "Painting" are different campaigns with different costs, and a list
        // that shows neither makes them look like the same thing.
        tradeLabel: campaignTradeLabel(c),
        // Serialised here rather than in the page, so the list and the detail
        // screen cannot disagree about what "62%" means.
        progress: campaignProgress(c),
        funnel: funnelRows(c),
        // Never the whole config, and not the summary either: a source's
        // settings can hold a signed URL, and a list endpoint has no reason to
        // hand out even the host it points at. Names and readiness only.
        sources: sources.map((s) => ({
          key: s.key,
          label: s.label,
          ready: s.configOk,
          blocked: s.state.blocked,
          ended: s.state.ended,
        })),
        sourcesReady: sources.length > 0 && sources.every((s) => s.configOk),
      };
    }),
    territories,
    providers: discoveryProviders(),
    trades: discoveryTradeKeys().map((key) => ({
      key,
      label: DISCOVERY_TRADES[key].label,
      categoryKeys: DISCOVERY_TRADES[key].categoryKeys,
    })),
  });
}

/**
 * Create a campaign, and its territory when the form defined a new one.
 *
 * Both in one transaction. A territory written without its campaign is an
 * orphan nothing lists, and the superadmin would create a second one on the
 * retry.
 */
export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));

  const name = String(body?.name ?? "").trim();
  if (!name) return bad("A campaign needs a name — it is what the list is scanned by.");
  if (name.length > MAX_NAME) return bad(`Keep the campaign name under ${MAX_NAME} characters.`);

  // ── One trade, or every trade, and never neither and never both ─────────
  //
  // The queue argument is unchanged and still true: a rep who says the same
  // script forty times gets better at it, so what a rep is HANDED is
  // single-trade. All-trades is a statement about the BANK — what FieldQuo may
  // know — and it changes nothing about the queue, because
  // claimCandidateWhere() filters on an exact trade key and has never heard of
  // a campaign. A roofer banked by an all-trades campaign is claimable from the
  // roofing queue and from no other.
  //
  // Both at once is refused rather than resolved. Two statements that disagree
  // is exactly the state campaignTradeScope() exists to keep out of the
  // database, and picking one here would leave the screen showing "Painting"
  // over a campaign that banked a province.
  const allTrades = body?.allTrades === true;
  const tradeKey = String(body?.tradeKey ?? "").trim();
  if (allTrades && tradeKey) {
    return bad("Pick one trade or tick every trade — a campaign that says both says nothing.");
  }
  if (!allTrades && !tradeKey) {
    return bad(
      "A campaign targets one trade. A rep who says the same script forty times gets better at it; " +
        "one who switches trade every call never does. Tick “every trade” if you are building the bank " +
        "rather than a queue.",
    );
  }
  if (tradeKey && !DISCOVERY_TRADES[tradeKey]) return bad(`"${tradeKey}" is not a trade this build discovers.`);

  const targetCount = Math.floor(Number(body?.targetCount));
  if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > MAX_TARGET) {
    return bad(`How many prospects? A whole number between 1 and ${MAX_TARGET}.`);
  }

  // ── The sources, and their per-source settings ─────────────────────────
  //
  // Validated against a DRAFT campaign row rather than against the request, so
  // the create path and the start path ask exactly the same question of
  // exactly the same shape. Two validators for one rule is how a campaign gets
  // saved that the start button then refuses.
  const selection = readSourceSelection(body);
  if (selection.error) return bad(selection.error);

  const unknown = selection.keys.filter((key) => !getDiscoveryProvider(key));
  if (unknown.length) {
    return bad(`No discovery source named ${unknown.map((k) => `"${k}"`).join(", ")} is registered.`);
  }

  // Refused rather than saved-and-disabled. A source that cannot run whatever
  // it is configured with makes every control downstream of it a control that
  // appears to work and does not.
  const unavailable = selection.keys
    .map((key) => ({ key, reason: unavailableReasonOf(getDiscoveryProvider(key)) }))
    .filter((s) => s.reason);
  if (unavailable.length) {
    return NextResponse.json(
      {
        error: "One of the sources you ticked cannot run, so the campaign was not saved.",
        problems: unavailable.map((s) => `${s.key}: ${s.reason}`),
      },
      { status: 400 },
    );
  }

  // ── The territory, which is now also WHICH FILES ───────────────────────
  //
  // Resolved before the snapshots, because the region decides which files the
  // library hands back and an existing territory carries its own.
  const territoryInput = shapeTerritory(body);
  if (territoryInput.error) return bad(territoryInput.error);

  let territoryId = String(body?.territoryId ?? "").trim() || null;
  let territory = territoryInput.value;
  if (territoryId) {
    const exists = await db.salesTerritory.findUnique({ where: { id: territoryId } });
    if (!exists) return bad("That territory no longer exists.");
    territory = exists;
  } else if (!territory) {
    return bad("A campaign needs a territory — pick an existing one or describe a new one.");
  }

  // ── The snapshot base URL, which nobody types per campaign ──────────────
  const library = await loadSnapshotLibrarySetting(db);
  if (!library.configured) {
    return NextResponse.json(
      {
        error: "Snapshots are not configured, so no campaign can be given a file to read.",
        problems: [
          "Set the bucket's public base URL once at /platform/sales/snapshots. Every campaign's snapshot " +
            "URL is built from it — there is no per-campaign URL to type, deliberately.",
        ],
      },
      { status: 400 },
    );
  }

  // ── Which files cover this selection, and how many rows are in them ────
  const files = snapshotSelection({
    providers: selection.keys,
    country: territory.country,
    province: territory.province,
    tradeKey: allTrades ? null : tradeKey,
  });
  if (files.problems.length) {
    return NextResponse.json(
      { error: "There is no snapshot for that combination, so nothing was saved.", problems: files.problems },
      { status: 400 },
    );
  }
  if (files.fileCount > MAX_CAMPAIGNS_PER_SUBMISSION) {
    return bad(`That selection covers ${files.fileCount} snapshot files, which is more than one submission may create.`);
  }

  // ── Each derived URL, PROVED before anything is written ────────────────
  //
  // The key comes from the library so it cannot be mistyped; the base is the
  // one thing a human pasted. Every way of getting that slightly wrong — wrong
  // bucket, public access never switched on, a domain that serves the root but
  // not the prefix — produces a URL that looks perfect and fetches nothing, and
  // a campaign built on one runs, reads zero rows and reports itself complete.
  const plans = [];
  const problems = [];
  for (const file of files.files) {
    const url = snapshotUrlFor(library.baseUrl, file.objectKey);
    const probe = await probeSnapshot(url, file);
    if (!probe.ok) {
      problems.push(probe.problem);
      continue;
    }
    plans.push({ file, url });
  }
  if (problems.length) {
    return NextResponse.json(
      {
        error: "A snapshot this campaign would read is not where it should be, so nothing was saved.",
        problems: [
          ...problems,
          "Check the base URL at /platform/sales/snapshots, and that the files were uploaded under the same " +
            "prefixes the library records.",
        ],
      },
      { status: 400 },
    );
  }

  // ── Where the campaign would be calling, and whether FieldQuo may ──────
  //
  // Recorded now and returned with the result. It does NOT stop the campaign
  // being created — the gate is on START, where the spending begins — but a
  // superadmin who ticked Washington has to be told at the moment they tick it,
  // not the first time they press a button that refuses.
  const registration = territoryRegistration(territory);
  const startBlockers = campaignStartBlockers(territory);

  const created = await db.$transaction(async (tx) => {
    if (!territoryId) {
      const existingName = await tx.salesTerritory.findUnique({ where: { name: territoryInput.value.name } });
      if (existingName) {
        // Reused rather than refused. Two campaigns for Ottawa painting and
        // Ottawa roofing want the SAME territory, and making the second one
        // invent "Ottawa 2" would break every report that groups by it.
        territoryId = existingName.id;
      } else {
        territoryId = (await tx.salesTerritory.create({ data: territoryInput.value })).id;
      }
    }

    const rows = [];
    for (const plan of plans) {
      // `snapshotFile` travels beside the URL so the campaign remembers WHICH
      // library row it was derived from. Without it, re-deriving after the base
      // URL changes would mean parsing the URL back into a key — and a campaign
      // created before the library existed would be indistinguishable from one
      // whose file was renamed.
      const sourceConfigs = {
        [plan.file.provider]: { snapshotUrl: plan.url, snapshotFile: plan.file.objectKey },
      };
      const draft = { discoverySources: [plan.file.provider], sourceConfigs };
      const sourceProblems = startProblems(draft, { getProvider: getDiscoveryProvider });
      if (sourceProblems.length) {
        // Thrown rather than returned: this is inside the transaction, and a
        // partial set of campaigns is worse than none. It should be
        // unreachable — the URL was just fetched — so it says so.
        throw new Error(`derived config rejected for ${plan.file.objectKey}: ${sourceProblems.join(" ")}`);
      }
      const described = describeSources(draft, { getProvider: getDiscoveryProvider });

      const campaign = await tx.prospectCampaign.create({
        data: {
          name: campaignNameForFile(name, plan.file, plans.length, MAX_NAME),
          territoryId,
          // Null rather than "" for an all-trades campaign: the column means
          // "the one trade this campaign banks", and an empty string is not a
          // trade.
          tradeKey: allTrades ? null : tradeKey,
          allTrades,
          targetCount,
          // The plural fields only. `discoveryProvider` and `providerConfig`
          // are read for campaigns created before this change and are never
          // written again — a column that had to name one of three sources
          // would lie about the other two. See the schema comment.
          discoverySources: [plan.file.provider],
          sourceConfigs,
          status: "draft",
        },
        include: { territory: true },
      });

      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_campaign_created",
          details: {
            campaignId: campaign.id,
            name: campaign.name,
            // Both, always. "tradeKey: null" alone in an audit log cannot say
            // whether somebody chose every trade or the row was written wrong.
            tradeKey: allTrades ? null : tradeKey,
            allTrades,
            targetCount,
            sources: [plan.file.provider],
            // Which obligations this campaign just took on, recorded at the
            // moment somebody accepted them. Ticking three sources is ticking
            // three licences, and an audit log that recorded only the keys
            // would not show that the choice was made with the terms on screen.
            licences: described.map((s) => `${s.key}: ${s.licence?.name || "unstated"}`),
            territoryId,
            // The object key, not the URL. The key is the durable fact; the
            // base URL is a setting that can be changed on another screen, and
            // an audit log repeating it would rot the day it is.
            snapshotFile: plan.file.objectKey,
            snapshotRows: plan.file.rows,
            // Recorded at the moment of creation: this campaign was created
            // knowing it could not be started, and by whom.
            startBlocked: startBlockers.map((b) => b.code),
          },
        },
      });

      rows.push(campaign);
    }
    return rows;
  });

  return NextResponse.json({
    campaigns: created.map((c) => ({ ...c, progress: campaignProgress(c), funnel: funnelRows(c) })),
    // The first one, so a caller written against the single-campaign response
    // still finds what it was reading.
    campaign: created[0]
      ? { ...created[0], progress: campaignProgress(created[0]), funnel: funnelRows(created[0]) }
      : null,
    snapshot: {
      files: plans.map((p) => ({ objectKey: p.file.objectKey, rows: p.file.rows, provider: p.file.provider })),
      rows: files.rows,
      tradeRows: files.tradeRows,
      tradeUnknownRows: files.tradeUnknownRows,
    },
    registration,
    startBlockers,
  });
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * A new territory from the form, or null when the form named an existing one.
 *
 * ══ Why a radius needs a centre and a centre needs a radius ═══════════════
 *
 * Half of either is not a territory. A centre with no radius matches nothing;
 * a radius with no centre matches everything. Both would look like a working
 * territory on the screen and produce a campaign that finds nobody or finds a
 * continent, and the superadmin would find out two days later.
 */
function shapeTerritory(body) {
  const name = String(body?.territoryName ?? "").trim();
  const country = String(body?.country ?? "").trim().toUpperCase();
  const province = String(body?.province ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const centerLat = body?.centerLat === "" || body?.centerLat == null ? null : Number(body.centerLat);
  const centerLng = body?.centerLng === "" || body?.centerLng == null ? null : Number(body.centerLng);
  const radiusKm = body?.radiusKm === "" || body?.radiusKm == null ? null : Math.floor(Number(body.radiusKm));

  if (!name && !country && !province && !city && centerLat == null && radiusKm == null) {
    return { value: null };
  }
  if (!name) return { error: "A new territory needs a name." };
  if (!country) return { error: "A territory needs a country — pick one from the list." };
  if (country.length !== 2) return { error: 'A country code is two letters, like "CA" or "US".' };
  // Required now, where it used to be optional. The snapshot library is
  // extracted and counted PER REGION, so a territory with no region names no
  // file — and the campaign built from it would have nothing to read. This is
  // the error a form that lost its region select would produce, rather than a
  // campaign that saves and discovers nothing.
  if (!province) {
    return { error: "A territory needs a region — the snapshots are extracted per region, so one names the file." };
  }

  const hasCentre = centerLat != null && centerLng != null;
  if (hasCentre && (!Number.isFinite(centerLat) || !Number.isFinite(centerLng))) {
    return { error: "The centre must be two numbers — latitude then longitude." };
  }
  if (hasCentre && (Math.abs(centerLat) > 90 || Math.abs(centerLng) > 180)) {
    return { error: "That centre is not a point on Earth." };
  }
  if (hasCentre && !(radiusKm > 0)) {
    return { error: "A centre without a radius matches nothing. Give the radius in kilometres, or clear the centre." };
  }
  if (radiusKm != null && radiusKm > 0 && !hasCentre) {
    return { error: "A radius without a centre matches everything. Give the centre latitude and longitude, or clear the radius." };
  }

  return {
    value: {
      name,
      country,
      province: province || null,
      city: city || null,
      centerLat: hasCentre ? centerLat : null,
      centerLng: hasCentre ? centerLng : null,
      radiusKm: hasCentre ? radiusKm : null,
    },
  };
}
