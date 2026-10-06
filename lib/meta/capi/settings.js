// lib/meta/capi/settings.js
//
// The one door to MetaConversionSettings — the "Send lead results to Meta"
// switch — and the one function that decides what each half of the feature
// can do right now (`capiReadiness`). The settings screen, the sweep, the
// sender and the backfill all ask capiReadiness, so no two of them can
// disagree about whether events are supposed to be flowing.
//
// The dataset token follows lib/meta/connection.js's discipline: encrypted on
// the way in, decrypted only at the moment of a send, never in a shape a
// browser receives.
import { db } from "@/lib/db";
import { encryptToken, decryptToken, tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";
import { validateTrackingIdsForWrite } from "@/lib/funnels/pixels";

/** The permission each messaging channel needs, by Meta's own name. */
export const MESSAGING_PERMISSION = Object.freeze({
  messenger: "page_events",
  instagram: "instagram_manage_events",
});

/** The granted permission names on a Page connection's stored scope string. Pure. */
export function grantedPermissions(scopes) {
  return new Set(
    String(scopes || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * What each half can do, and the reason when it cannot. Pure.
 *
 * crm / website (one dataset, one token, the same readiness):
 *   off | no_terms | no_encryption | no_dataset | no_token | ready
 * messenger / instagram:
 *   off | no_terms | no_page | no_instagram | needs_permission | ready
 *
 * "off" wins over everything: a switch that is off sends nothing, whatever
 * else is configured.
 */
export function capiReadiness({ settings = null, pageConnection = null, encryptionConfigured = tokenCryptoConfigured() } = {}) {
  const s = settings || {};
  const base = !s.enabled ? "off" : !s.termsAcceptedAt ? "no_terms" : null;
  const dataset = base
    ? base
    : !encryptionConfigured
      ? "no_encryption"
      : !/^\d{15,16}$/.test(String(s.datasetId || ""))
        ? "no_dataset"
        : !s.datasetTokenEnc
          ? "no_token"
          : "ready";
  const granted = grantedPermissions(pageConnection?.scopes);
  const channel = (name) => {
    if (base) return { state: base, permission: MESSAGING_PERMISSION[name] };
    if (!pageConnection || pageConnection.disconnectedAt) return { state: "no_page", permission: MESSAGING_PERMISSION[name] };
    if (name === "instagram" && !pageConnection.instagramUserId) return { state: "no_instagram", permission: MESSAGING_PERMISSION[name] };
    if (!granted.has(MESSAGING_PERMISSION[name])) return { state: "needs_permission", permission: MESSAGING_PERMISSION[name] };
    return { state: "ready", permission: MESSAGING_PERMISSION[name] };
  };
  return {
    crm: dataset,
    website: dataset,
    messenger: channel("messenger"),
    instagram: channel("instagram"),
  };
}

/** May this half send? Pure. */
export function kindReady(readiness, kind, channel = null) {
  if (!readiness) return false;
  if (kind === "crm" || kind === "website") return readiness[kind] === "ready";
  if (kind === "messaging") return readiness[channel]?.state === "ready";
  return false;
}

/** What a browser may see. Never the token. Pure. */
export function publicCapiSettings(row) {
  const s = row || {};
  return {
    enabled: Boolean(s.enabled),
    enabledAt: s.enabledAt || null,
    enabledByName: s.enabledByName || null,
    datasetId: s.datasetId || null,
    datasetName: s.datasetName || null,
    hasToken: Boolean(s.datasetTokenEnc),
    tokenHint: s.datasetTokenHint || null,
    termsAcceptedAt: s.termsAcceptedAt || null,
    termsAcceptedByName: s.termsAcceptedByName || null,
    messengerDatasetId: s.messengerDatasetId || null,
    instagramDatasetId: s.instagramDatasetId || null,
    lastSyncAt: s.lastSyncAt || null,
    lastSyncError: s.lastSyncError || null,
  };
}

export async function getCapiSettings(companyId, prisma = db) {
  if (!companyId) return null;
  return prisma.metaConversionSettings.findUnique({ where: { companyId } });
}

/** The dataset token, decrypted at the moment of a send. Null when none. */
export function datasetToken(settings) {
  if (!settings?.datasetTokenEnc) return null;
  return decryptToken(settings.datasetTokenEnc);
}

/**
 * A Conversions API token as pasted: Meta's tokens are long runs of letters
 * and digits. Anything with whitespace inside, or too short to be one, is
 * refused with a reason rather than stored and failing on the first send.
 * Pure.
 */
export function cleanDatasetToken(raw) {
  if (typeof raw !== "string") return { ok: false };
  const v = raw.trim();
  if (v.length < 40 || v.length > 1024 || /\s/.test(v) || !/^[A-Za-z0-9_\-|.]+$/.test(v)) return { ok: false };
  return { ok: true, value: v };
}

/**
 * Validate a PATCH body into the columns it writes. Pure.
 *
 * @returns {{ data: object, errors: string[], acceptTerms: boolean, enable: boolean|null, clearToken: boolean, token: string|null }}
 */
export function validateCapiPatch(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  const data = {};
  const errors = [];
  if (Object.hasOwn(b, "datasetId")) {
    const { data: ids, errors: bad } = validateTrackingIdsForWrite({ metaPixelId: b.datasetId });
    if (bad.length) errors.push("datasetId");
    else data.datasetId = ids.metaPixelId ?? null;
  }
  if (Object.hasOwn(b, "datasetName")) {
    data.datasetName = typeof b.datasetName === "string" && b.datasetName.trim() ? b.datasetName.trim().slice(0, 120) : null;
  }
  let token = null;
  let clearToken = false;
  if (Object.hasOwn(b, "datasetToken")) {
    if (b.datasetToken === null || b.datasetToken === "") clearToken = true;
    else {
      const t = cleanDatasetToken(b.datasetToken);
      if (!t.ok) errors.push("datasetToken");
      else token = t.value;
    }
  }
  const enable = Object.hasOwn(b, "enabled") ? b.enabled === true : null;
  if (Object.hasOwn(b, "enabled") && typeof b.enabled !== "boolean") errors.push("enabled");
  return { data, errors, acceptTerms: b.acceptTerms === true, enable, clearToken, token };
}

/**
 * Write a validated patch for ONE company. Turning the switch on requires the
 * terms to be accepted (now or before); that rule is enforced here, not only
 * on the screen, so a typed request cannot skip it.
 *
 * @returns {{ ok: true, row } | { ok: false, error: string, status: number }}
 */
export async function saveCapiSettings({ companyId, actor = {}, patch, prisma = db, now = new Date() }) {
  if (!companyId) throw new Error("saveCapiSettings needs a companyId");
  const existing = await prisma.metaConversionSettings.findUnique({ where: { companyId } });
  const data = { ...patch.data };
  if (patch.token) {
    if (!tokenCryptoConfigured()) return { ok: false, error: "no_encryption", status: 409 };
    data.datasetTokenEnc = encryptToken(patch.token);
    data.datasetTokenHint = patch.token.slice(-4);
  } else if (patch.clearToken) {
    data.datasetTokenEnc = null;
    data.datasetTokenHint = null;
  }
  if (patch.acceptTerms && !existing?.termsAcceptedAt) {
    data.termsAcceptedAt = now;
    data.termsAcceptedById = actor.userId || null;
    data.termsAcceptedByName = actor.name || null;
  }
  if (patch.enable === true) {
    const termsAt = data.termsAcceptedAt || existing?.termsAcceptedAt;
    if (!termsAt) return { ok: false, error: "terms_required", status: 409 };
    if (!existing?.enabled) {
      data.enabled = true;
      data.enabledAt = now;
      data.enabledById = actor.userId || null;
      data.enabledByName = actor.name || null;
    }
  } else if (patch.enable === false) {
    data.enabled = false;
  }
  const row = await prisma.metaConversionSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
  return { ok: true, row };
}

/** Record the outcome of a delivery run on the company's row. */
export async function recordCapiSync(prisma, companyId, { error = null, at = new Date() } = {}) {
  await prisma.metaConversionSettings.updateMany({
    where: { companyId },
    data: { lastSyncAt: at, lastSyncError: error },
  });
}
