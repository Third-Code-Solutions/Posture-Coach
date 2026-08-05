import type { Landmark, Point3D } from "../contracts";

export const isFinitePoint = (point: Point3D | undefined): point is Point3D =>
  point !== undefined &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  Number.isFinite(point.z);

export function distance(a: Point3D, b: Point3D): number {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return 0;
  const result = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return Number.isFinite(result) ? result : 0;
}

export function midpoint(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function angleAt(a: Point3D, vertex: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(vertex) || !isFinitePoint(b)) return null;
  const ab = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const cb = { x: b.x - vertex.x, y: b.y - vertex.y, z: b.z - vertex.z };
  const aLength = Math.hypot(ab.x, ab.y, ab.z);
  const cLength = Math.hypot(cb.x, cb.y, cb.z);
  if (!Number.isFinite(aLength) || !Number.isFinite(cLength) || aLength < 1e-6 || cLength < 1e-6)
    return null;
  const rawCosine = (ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / (aLength * cLength);
  if (!Number.isFinite(rawCosine)) return null;
  const cosine = Math.min(1, Math.max(-1, rawCosine));
  const result = (Math.acos(cosine) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function verticalDeviation(a: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const result = (Math.atan2(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function horizontalDeviation(a: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const result = (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function averageVisibility(points: readonly Landmark[]): number {
  const usable = points.filter(
    (point) =>
      Number.isFinite(point.visibility) &&
      Number.isFinite(point.presence) &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z),
  );
  if (usable.length === 0) return 0;
  return (
    usable.reduce((sum, point) => sum + Math.min(point.visibility, point.presence), 0) /
    usable.length
  );
}
