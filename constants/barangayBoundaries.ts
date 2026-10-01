import { VALENZUELA_BARANGAY_POLYGONS } from "./valenzuelaBarangayPolygons";

// The boundary file is simplified, so a point on a border or river bank can fall
// a few metres outside every polygon. Within this distance of an edge we still
// assign the nearest barangay (and flag it as not exact).
const EDGE_TOLERANCE_M = 350;
const M_PER_DEG_LAT = 110540;
const mPerDegLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

type Ring = [number, number][];

const BOXES = VALENZUELA_BARANGAY_POLYGONS.map((b) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of b.rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
});

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRingM(x: number, y: number, ring: Ring): number {
  const kx = mPerDegLng(y);
  const px = x * kx;
  const py = y * M_PER_DEG_LAT;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] * kx, ay = ring[j][1] * M_PER_DEG_LAT;
    const bx = ring[i][0] * kx, by = ring[i][1] * M_PER_DEG_LAT;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Which Valenzuela barangay is this GPS point in? Pure point-in-polygon on the
 * real boundaries, works offline and instantly. Returns null when the point is
 * outside Valenzuela City (beyond the edge tolerance).
 */
export function barangayFromBoundaries(
  lat: number,
  lng: number,
): { name: string; exact: boolean } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  for (let i = 0; i < VALENZUELA_BARANGAY_POLYGONS.length; i++) {
    const b = BOXES[i];
    if (lng < b.minX || lng > b.maxX || lat < b.minY || lat > b.maxY) continue;
    let count = 0;
    for (const ring of VALENZUELA_BARANGAY_POLYGONS[i].rings) if (inRing(lng, lat, ring)) count++;
    if (count % 2 === 1) return { name: VALENZUELA_BARANGAY_POLYGONS[i].name, exact: true };
  }

  let best: { name: string; d: number } | null = null;
  for (let i = 0; i < VALENZUELA_BARANGAY_POLYGONS.length; i++) {
    for (const ring of VALENZUELA_BARANGAY_POLYGONS[i].rings) {
      const d = distToRingM(lng, lat, ring);
      if (d <= EDGE_TOLERANCE_M && (!best || d < best.d)) best = { name: VALENZUELA_BARANGAY_POLYGONS[i].name, d };
    }
  }
  return best ? { name: best.name, exact: false } : null;
}
