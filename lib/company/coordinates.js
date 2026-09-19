// lib/company/coordinates.js
//
// Coordinates for a company's stored address that has none — geocoded once,
// on read, and persisted so it costs one Google call ever.
//
// Lifted out of app/api/settings/business-info/route.js when the day map
// needed the same thing: the map is centred on the company's own address, and
// an address that arrived at SIGNUP has no coordinates, so without this the
// map opened on nothing while the address sat filled in on the settings page.
// One helper, two readers, rather than a second copy of the "geocode if
// missing" rule.
//
// Silent on failure: no coordinates means no centre, which is what the
// company already had, and a geocoding outage must not stop either page
// loading. Through the ONE geocoder (lib/measure/roofMeasurement.js).

/**
 * @param db         Prisma client.
 * @param companyId  the company to write to.
 * @param company    { address, city, province, postalCode, latitude, longitude }
 *                   — the row as already loaded, so a reader that has it does
 *                   not load it twice.
 * @returns the same object, with latitude/longitude filled when they could be.
 */
export async function ensureCompanyCoordinates(db, companyId, company) {
  if (!company?.address) return company;
  if (company.latitude != null && company.longitude != null) return company;

  try {
    const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
    const full = [company.address, company.city, company.province, company.postalCode]
      .filter(Boolean)
      .join(", ");
    const hit = await geocodeAddress(full);
    if (!hit?.lat || !hit?.lng) return company;

    await db.company.update({
      where: { id: companyId },
      data: { latitude: hit.lat, longitude: hit.lng },
    });
    return { ...company, latitude: hit.lat, longitude: hit.lng };
  } catch (err) {
    console.error("[company/coordinates] coordinate backfill failed:", err?.message);
    return company;
  }
}
