// lib/marketing/routeOrder.js
//
// Orders pamphlet stops into an efficient walking/driving path using a simple
// nearest-neighbor heuristic over lat/lng. This is NOT the optimal travelling-
// salesman solution — it's the standard, good-enough greedy approximation that
// real route tools start from, and it's O(n^2) which is fine for the few dozen
// addresses a single distribution run realistically has. Stops missing
// coordinates are appended at the end in their original order (they can't be
// placed geographically, so they don't get to distort the ones that can).

// Squared planar distance is enough for *ordering* nearby points — we never
// need real distances, only "which unvisited stop is closest", and over a
// single neighbourhood the lat/lng plane is locally flat enough that the
// cheaper metric picks the same neighbour as the great-circle one would.
function distSq(a, b) {
  const dLat = a.lat - b.lat;
  // Longitude degrees shrink toward the poles; scale by cos(lat) so east-west
  // spacing isn't overweighted vs north-south at typical latitudes.
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLng = (a.lng - b.lng) * Math.cos(meanLat);
  return dLat * dLat + dLng * dLng;
}

// Returns a new array of the same stop objects, reordered. Each stop must have
// numeric `latitude`/`longitude` (Prisma Decimals should be coerced to Number
// before calling) to participate in geographic ordering.
export function nearestNeighborOrder(stops, start) {
  const withCoords = [];
  const withoutCoords = [];
  for (const s of stops) {
    const lat = s.latitude != null ? Number(s.latitude) : null;
    const lng = s.longitude != null ? Number(s.longitude) : null;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      withCoords.push({ stop: s, lat, lng });
    } else {
      withoutCoords.push(s);
    }
  }

  if (withCoords.length === 0) return [...stops];

  const ordered = [];
  const remaining = [...withCoords];

  // Seed from an explicit start point (e.g. the company address) if given,
  // otherwise from the first stop as provided.
  let current =
    start && typeof start.lat === "number" && typeof start.lng === "number"
      ? start
      : remaining[0];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distSq(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next.stop);
    current = next;
  }

  return [...ordered, ...withoutCoords];
}
