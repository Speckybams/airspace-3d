/** Local equirectangular land image for the opening camera. Degrees, WGS84. */
export const OVERVIEW_BOUNDS = {
  west: -5.8,
  south: 49.4,
  east: 2.2,
  north: 53.8,
};

export const OVERVIEW_SIZE = {
  width: 1600,
  height: 880,
};

export const OVERVIEW_URL = "/basemap/uk-overview.png";

/** Sea colour, also used as the globe base so the first frame is a map. */
export const OVERVIEW_SEA = "#d6e2ea";
