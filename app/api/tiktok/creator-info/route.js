// app/api/tiktok/creator-info/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { tiktokAudited, tiktokConfigured } from "@/lib/tiktok/config";
import { queryCreatorInfo } from "@/lib/tiktok/client";
import { getTikTokAccess, updateCreatorDisplay } from "@/lib/tiktok/connection";
import { classifyTikTokError, creatorPostingBlock, offeredPrivacyOptions } from "@/lib/tiktok/specs";

// The composer's first call every time it opens — TikTok's guidelines require
// the LATEST creator info (nickname shown, privacy options from TikTok, comment
// setting honoured), so this is never cached and never stored as the answer.
// The publish POST fetches it again itself rather than trusting what this
// returned to the browser.
//
// A TikTok refusal is answered 200 with `error` — it is a state the composer
// renders (reconnect / try later / the account's own setting), not a failure
// of this route. A refusal of THIS route (not configured, not connected, not
// allowed) is a 4xx with a code, same as every other route.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    // Same axis as publishing — see app/api/marketing/designer/designs/[id]/tiktok.
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can publish marketing content", code: "forbidden" },
      { status: err.status || 403 },
    );
  }

  if (!tiktokConfigured()) {
    return NextResponse.json({ error: "TikTok posting isn't available yet.", code: "not_available" }, { status: 403 });
  }

  const access = await getTikTokAccess(member.companyId);
  if (!access.connected) {
    return NextResponse.json({
      creatorInfo: null,
      error: { ...classifyTikTokError({ code: access.reason === "not_connected" ? "not_connected" : "token_expired" }) },
    });
  }

  const info = await queryCreatorInfo({ accessToken: access.accessToken });
  if (!info.ok) {
    const block = creatorPostingBlock(info.code);
    return NextResponse.json({
      creatorInfo: null,
      error: { ...classifyTikTokError(info), blocked: Boolean(block) },
    });
  }

  // The avatar URL creator_info returns lives two hours; the card's copy is
  // refreshed from here so it is not left pointing at an expired one.
  await updateCreatorDisplay(access.connection.id, {
    nickname: info.data.nickname,
    avatarUrl: info.data.avatarUrl,
  });

  const audited = tiktokAudited();
  return NextResponse.json({
    creatorInfo: info.data,
    audited,
    // What the dropdown may list — TikTok's own options for this creator,
    // narrowed to "Only me" while FieldQuo is unaudited. The composer shows
    // exactly this list, with nothing pre-selected.
    privacyOptions: offeredPrivacyOptions({ creatorOptions: info.data.privacyLevelOptions, audited }),
  });
}
