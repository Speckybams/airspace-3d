import polylineColorVS from "@cesium/engine/Source/Shaders/Appearances/PolylineColorAppearanceVS.js";
import polylineCommon from "@cesium/engine/Source/Shaders/PolylineCommon.js";
import { PerInstanceColorAppearance, PolylineColorAppearance } from "cesium";

export interface SliceBand {
  u_low: number;
  u_high: number;
}

const HEIGHT_FN = `
float voluspaceEllipsoidHeight(vec3 p) {
  const float a = 6378137.0;
  const float b = 6356752.314245;
  const float e2 = 6.69437999014e-3;
  const float ep2 = 6.73949674228e-3;
  float xy = length(p.xy);
  float theta = atan(p.z * a, xy * b);
  float sinT = sin(theta);
  float cosT = cos(theta);
  float lat = atan(p.z + ep2 * b * sinT * sinT * sinT, xy - e2 * a * cosT * cosT * cosT);
  float sinLat = sin(lat);
  float N = a / sqrt(1.0 - e2 * sinLat * sinLat);
  float cosLat = cos(lat);
  if (abs(cosLat) < 1e-6) {
    return abs(p.z) - b;
  }
  return xy / cosLat - N;
}
`;

const FILL_FS = `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;

uniform float u_low;
uniform float u_high;

${HEIGHT_FN}

void main()
{
    vec3 positionWC = (czm_inverseView * vec4(v_positionEC, 1.0)).xyz;
    float h = voluspaceEllipsoidHeight(positionWC);
    if (h < u_low - 2.0 || h > u_high + 2.0) {
        discard;
    }

    vec3 positionToEyeEC = -v_positionEC;
    vec3 normalEC = normalize(v_normalEC);
#ifdef FACE_FORWARD
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);
#endif

    vec4 color = czm_gammaCorrect(v_color);
    czm_materialInput materialInput;
    materialInput.normalEC = normalEC;
    materialInput.positionToEyeEC = positionToEyeEC;
    czm_material material = czm_getDefaultMaterial(materialInput);
    material.diffuse = color.rgb;
    material.alpha = color.a;
    out_FragColor = czm_phong(normalize(positionToEyeEC), material, czm_lightDirectionEC);
}
`;

const EDGE_VS =
  "#define CLIP_POLYLINE \n" +
  polylineCommon +
  "\n" +
  polylineColorVS
    .replace("out vec4 v_color;", "out vec4 v_color;\nout vec3 v_positionEC;")
    .replace(
      "vec4 p = czm_computePosition();",
      "vec4 p = czm_computePosition();\n    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;",
    );

if (!EDGE_VS.includes("v_positionEC")) {
  throw new Error("Airspace outline shader did not receive a height varying.");
}

const EDGE_FS = `
in vec4 v_color;
in vec3 v_positionEC;

uniform float u_low;
uniform float u_high;

${HEIGHT_FN}

void main()
{
    vec3 positionWC = (czm_inverseView * vec4(v_positionEC, 1.0)).xyz;
    float h = voluspaceEllipsoidHeight(positionWC);
    if (h < u_low - 2.0 || h > u_high + 2.0) {
        discard;
    }
    out_FragColor = czm_gammaCorrect(v_color);
}
`;

function attachBand<T extends object>(appearance: T, band: SliceBand): T {
  (appearance as T & { uniforms: SliceBand }).uniforms = band;
  return appearance;
}

export function createFillAppearance(band: SliceBand): PerInstanceColorAppearance {
  return attachBand(
    new PerInstanceColorAppearance({
      closed: true,
      translucent: true,
      fragmentShaderSource: FILL_FS,
    }),
    band,
  );
}

export function createEdgeAppearance(band: SliceBand): PolylineColorAppearance {
  return attachBand(
    new PolylineColorAppearance({
      translucent: true,
      vertexShaderSource: EDGE_VS,
      fragmentShaderSource: EDGE_FS,
    }),
    band,
  );
}
