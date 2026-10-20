import { Color, Scene, SkyBox } from "cesium";

type Face = "positiveX" | "negativeX" | "positiveY" | "negativeY" | "positiveZ" | "negativeZ";

const FACES: Face[] = [
  "positiveX",
  "negativeX",
  "positiveY",
  "negativeY",
  "positiveZ",
  "negativeZ",
];

/** OpenGL cube-face direction so neighbouring faces meet without a seam. */
function direction(face: Face, s: number, t: number): [number, number, number] {
  const u = s * 2 - 1;
  const v = t * 2 - 1;
  switch (face) {
    case "positiveX":
      return [1, -v, -u];
    case "negativeX":
      return [-1, -v, u];
    case "positiveY":
      return [u, 1, v];
    case "negativeY":
      return [u, -1, -v];
    case "positiveZ":
      return [u, -v, 1];
    case "negativeZ":
      return [-u, -v, -1];
  }
}

function hashDir(nx: number, ny: number, nz: number): number {
  let h = Math.imul(Math.round(nx * 1e6), 0x27d4eb2d);
  h ^= Math.imul(Math.round(ny * 1e6), 0x165667b1);
  h ^= Math.imul(Math.round(nz * 1e6), 0x1b873593);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function paintPixel(data: Uint8ClampedArray, size: number, x: number, y: number, bright: number) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  data[i] = bright;
  data[i + 1] = bright;
  data[i + 2] = Math.min(255, bright + 18);
}

/** Dark star field. Point stars, not filtered blobs. */
function paintFace(face: Face, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 16;
    data[i + 1] = 10;
    data[i + 2] = 42;
    data[i + 3] = 255;
  }

  // Keep the same star count as the old 512px faces, just drawn smaller.
  const density = (size / 512) * (size / 512);
  const dimCut = 1 - 0.006 / density;
  const brightCut = 1 - 0.0025 / density;
  const inv = 1 / (size - 1);

  for (let y = 0; y < size; y++) {
    const v = (1 - y * inv) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const u = x * inv * 2 - 1;
      const [dx, dy, dz] = direction(face, (u + 1) / 2, (v + 1) / 2);
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const star = hashDir(dx * invLen, dy * invLen, dz * invLen);
      if (star < dimCut) continue;
      const bright = star >= brightCut ? 235 : 150;
      if (star >= brightCut) {
        paintPixel(data, size, x, y, bright);
        paintPixel(data, size, x + 1, y, bright);
        paintPixel(data, size, x, y + 1, bright);
        paintPixel(data, size, x + 1, y + 1, bright);
      } else {
        paintPixel(data, size, x, y, bright);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const NEAREST = 9728;
const CLAMP_TO_EDGE = 33071;

export async function applyVoluSpaceSky(scene: Scene): Promise<void> {
  const size = 2048;
  const sources = Object.fromEntries(FACES.map((face) => [face, paintFace(face, size)])) as Record<
    Face,
    HTMLCanvasElement
  >;
  scene.skyBox = new SkyBox({ sources });
  const sharpen = scene.preRender.addEventListener(() => {
    const cube = (scene.skyBox as { _panorama?: { _cubeMap?: { sampler: object } } } | undefined)
      ?._panorama?._cubeMap;
    if (!cube) return;
    cube.sampler = {
      minificationFilter: NEAREST,
      magnificationFilter: NEAREST,
      wrapS: CLAMP_TO_EDGE,
      wrapT: CLAMP_TO_EDGE,
      maximumAnisotropy: 1,
    };
    sharpen();
  });
  scene.backgroundColor = Color.fromCssColorString("rgb(16, 10, 42)");

  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.perFragmentAtmosphere = true;
    scene.skyAtmosphere.hueShift = 0.08;
    scene.skyAtmosphere.saturationShift = 0.15;
    scene.skyAtmosphere.brightnessShift = -1;
    scene.skyAtmosphere.atmosphereLightIntensity = 0;
  }
  scene.globe.showGroundAtmosphere = false;
  scene.globe.atmosphereLightIntensity = 0;
  scene.globe.atmosphereHueShift = 0.08;
  scene.globe.atmosphereSaturationShift = 0.15;
  scene.globe.atmosphereBrightnessShift = -1;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
}

export function setSharpGlobe(scene: Scene): void {
  scene.globe.maximumScreenSpaceError = 1.25;
  scene.globe.tileCacheSize = 800;
}
