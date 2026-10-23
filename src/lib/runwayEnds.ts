/** Split "09/27" or "09L/27R" into low and high end labels. */
export function runwayEndLabels(designator: string): [string, string] {
  const parts = designator.split("/").map((s) => s.trim());
  if (parts.length >= 2) return [parts[0], parts[1]];
  const n = parseInt(designator.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return [designator, designator];
  const low = String(n).padStart(2, "0");
  const high = String(((Math.floor(n / 10) + 18) % 36) * 10 + (n % 10)).padStart(2, "0");
  return [low, high];
}

/** Magnetic runway number from true heading (nearest 10°). */
export function runwayNumberFromHeading(trueHeadingDeg: number): string {
  const mag = ((Math.round(trueHeadingDeg / 10) % 36) + 36) % 36;
  return String(mag === 0 ? 36 : mag).padStart(2, "0");
}
