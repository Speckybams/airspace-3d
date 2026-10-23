import { feetToMetres } from "@/lib/units";

/** At this camera height and above, columns give way to flat plates. */
const ENTER_M = feetToMetres(1_000_000);
/** Columns return a little below that, so the switch does not flicker. */
const EXIT_M = feetToMetres(960_000);

export function overviewLod(active: boolean, heightM: number): boolean {
  if (active) return heightM > EXIT_M;
  return heightM > ENTER_M;
}
