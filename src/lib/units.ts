const FT_TO_M = 0.3048;

export function feetToMetres(ft: number): number {
  return ft * FT_TO_M;
}

export function flightLevelToMetres(fl: number): number {
  return feetToMetres(fl * 100);
}

export function metresToFeet(m: number): number {
  return m / FT_TO_M;
}

export function formatFeet(ft: number): string {
  return `${Math.round(ft).toLocaleString("en-GB")} ft`;
}

export function formatFl(fl: number): string {
  return `FL${String(Math.round(fl)).padStart(3, "0")}`;
}

export function nmFromMetres(m: number): number {
  return m / 1852;
}

export function formatNm(m: number): number {
  return Math.round(nmFromMetres(m) * 10) / 10;
}

export function bearingLabel(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  return `${d.toFixed(0).padStart(3, "0")}°`;
}
