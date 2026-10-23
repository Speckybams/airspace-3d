import bearing from "@turf/bearing";
import length from "@turf/length";
import { lineString, point } from "@turf/helpers";

export interface MeasureLeg {
  from: { lon: number; lat: number };
  to: { lon: number; lat: number };
  bearingDeg: number;
  km: number;
  nm: number;
}

export function measureLeg(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): MeasureLeg {
  const from = point([lon1, lat1]);
  const to = point([lon2, lat2]);
  const brg = bearing(from, to);
  const km = length(lineString([[lon1, lat1], [lon2, lat2]]), { units: "kilometers" });
  return {
    from: { lon: lon1, lat: lat1 },
    to: { lon: lon2, lat: lat2 },
    bearingDeg: (brg + 360) % 360,
    km,
    nm: km / 1.852,
  };
}

export function sumMeasureLegs(legs: MeasureLeg[]): { km: number; nm: number } {
  let km = 0;
  for (const leg of legs) km += leg.km;
  return { km, nm: km / 1.852 };
}
