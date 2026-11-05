import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  HeadingPitchRange,
  IntersectionTests,
  Math as CesiumMath,
  Matrix4,
  Plane,
  Ray,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Scene,
} from "cesium";
import {
  clampPinchRatio,
  keepGlobeInView,
  MAX_PITCH,
  MAX_RANGE,
  MIN_PITCH,
  MIN_RANGE,
  panSampleScale,
  PINCH_HEIGHT_FROM_PIXELS,
  pinchTwist,
  poseAfterPinch,
} from "@/cesium/touchOrbit";
import type { SavedCamera } from "@/lib/cameraMemory";
import { LONDON_CAMERA } from "@/lib/cameraMemory";
// Cesium's wheel delta is positive when the wheel rolls forward. That zooms in.
const WHEEL_GAIN = 0.00115;
// Seconds-scale so one notch eases instead of jumping.
const ZOOM_RESPONSE = 14;
// Smaller than a mouse notch (~0.12) so a noisy trackpad sample cannot flip direction.
const WHEEL_NOISE = 0.01;
// Cap the queue so a fast spin cannot keep travelling after the wheel stops.
const MAX_PENDING_LOG = 0.85;

export interface OrbitCamera {
  flyTo: (lon: number, lat: number, range: number) => void;
  setTopDown: (on: boolean) => void;
  getPose: () => SavedCamera;
  destroy: () => void;
}

/** Google-Maps-style orbit: tilt and zoom stay locked to a ground point. */
export function attachOrbitCamera(scene: Scene, initial?: SavedCamera): OrbitCamera {
  const controller = scene.screenSpaceCameraController;
  controller.enableInputs = false;

  const canvas = scene.canvas;
  const start = initial ?? LONDON_CAMERA;
  const anchor = Cartesian3.fromDegrees(start.lon, start.lat, 0);
  let heading = start.heading;
  let pitch = CesiumMath.clamp(start.pitch, MIN_PITCH, MAX_PITCH);
  let range = CesiumMath.clamp(start.range, MIN_RANGE, MAX_RANGE);
  let pitchBeforeTopDown: number | null = null;

  const target = new Cartesian3();
  const carto = new Cartographic();
  const grab = new Cartesian3();
  const grabNormal = new Cartesian3();
  const grabPlane = new Plane(Cartesian3.UNIT_Z, 0);
  const planeHit = new Cartesian3();
  const panDelta = new Cartesian3();
  const viewOffset = new HeadingPitchRange();
  let holdingGround = false;
  let flyToken = 0;
  let pendingLog = 0;
  let zooming = false;
  let zoomStamp = 0;
  const wheelFocus = new Cartesian2();
  const zoomFocus = new Cartesian3();
  let hasWheelFocus = false;
  let pinching = false;
  const scratchRay = new Ray();
  const scratchScreen = new Cartesian2();
  const touches = new Map<number, { x: number; y: number }>();
  let touchGesture: "none" | "pan" | "pinch" = "none";
  let mode: "none" | "orbit" | "pan" = "none";
  const pinchLast = { dist: 0, angle: 0, midY: 0 };

  function frame() {
    // Stay locked to a ground point, and pitch down as range grows so the
    // globe cannot slide below the frame into empty sky. Skip while pinching
    // so tilt gestures are not fought mid-gesture (feels like the map slides away).
    if (!pinching) {
      pitch = keepGlobeInView(range, pitch);
    }
    Cartesian3.clone(anchor, target);
    viewOffset.heading = heading;
    viewOffset.pitch = pitch;
    viewOffset.range = range;
    scene.camera.lookAt(target, viewOffset);
    scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  function groundUnder(screen: Cartesian2, result: Cartesian3): boolean {
    const ray = scene.camera.getPickRay(screen, scratchRay);
    if (!ray) return false;
    const hit = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    if (!hit) return false;
    Ray.getPoint(ray, hit.start, result);
    return true;
  }

  function stopZoom() {
    pendingLog = 0;
    zooming = false;
  }

  function cancelMotion() {
    flyToken += 1;
    stopZoom();
  }

  /** Ease the queued wheel zoom. One loop; the latest scroll owns the direction. */
  function stepZoom(now: number) {
    if (!zooming) return;
    const elapsed = zoomStamp === 0 ? 1 / 60 : (now - zoomStamp) / 1000;
    const dt = Math.min(0.05, Math.max(0, elapsed));
    zoomStamp = now;
    const absorb = 1 - Math.exp(-ZOOM_RESPONSE * dt);
    let step = pendingLog * absorb;
    pendingLog -= step;
    if (Math.abs(pendingLog) < 0.0008) {
      step += pendingLog;
      pendingLog = 0;
      zooming = false;
    }
    const prevRange = range;
    range = CesiumMath.clamp(range * Math.exp(step), MIN_RANGE, MAX_RANGE);
    shiftAnchorForZoom(prevRange, range);
    const roomDown = Math.log(MIN_RANGE) - Math.log(range);
    const roomUp = Math.log(MAX_RANGE) - Math.log(range);
    if (pendingLog < roomDown || pendingLog > roomUp) {
      pendingLog = CesiumMath.clamp(pendingLog, roomDown, roomUp);
      if (pendingLog === 0) zooming = false;
    }
    frame();
    scene.requestRender();
    if (zooming) requestAnimationFrame(stepZoom);
  }

  function queueZoom(delta: number) {
    if (delta === 0) return;
    flyToken += 1;
    const impulse = -delta * WHEEL_GAIN;
    const reversing = pendingLog !== 0
      && Math.sign(impulse) !== Math.sign(pendingLog)
      && Math.abs(impulse) >= WHEEL_NOISE;
    pendingLog = reversing ? impulse : pendingLog + impulse;
    const logRange = Math.log(range);
    pendingLog = CesiumMath.clamp(
      pendingLog,
      Math.max(-MAX_PENDING_LOG, Math.log(MIN_RANGE) - logRange),
      Math.min(MAX_PENDING_LOG, Math.log(MAX_RANGE) - logRange),
    );
    if (pendingLog === 0 || zooming) return;
    zooming = true;
    zoomStamp = 0;
    requestAnimationFrame(stepZoom);
  }

  /** Move the orbit anchor so wheel zoom travels toward the point under the cursor. */
  function shiftAnchorForZoom(fromRange: number, toRange: number) {
    if (!hasWheelFocus || fromRange === toRange) return;
    if (!groundUnder(wheelFocus, zoomFocus)) return;
    const t = 1 - toRange / fromRange;
    Cartesian3.lerp(anchor, zoomFocus, t, anchor);
    Ellipsoid.WGS84.cartesianToCartographic(anchor, carto);
    carto.height = 0;
    Ellipsoid.WGS84.cartographicToCartesian(carto, anchor);
  }

  function beginPan(screen: Cartesian2) {
    holdingGround = groundUnder(screen, grab);
  }

  /** Keep the grabbed ground point under the cursor. Grazing rays are dropped so the map cannot jump. */
  function panTo(screen: Cartesian2) {
    if (!holdingGround) return;
    const ray = scene.camera.getPickRay(screen, scratchRay);
    if (!ray) return;
    Ellipsoid.WGS84.geodeticSurfaceNormal(grab, grabNormal);
    Plane.fromPointNormal(grab, grabNormal, grabPlane);
    if (!IntersectionTests.rayPlane(ray, grabPlane, planeHit)) return;
    const along = Cartesian3.distance(ray.origin, planeHit);
    Cartesian3.subtract(grab, planeHit, panDelta);
    const scale = panSampleScale(along, Cartesian3.magnitude(panDelta), range);
    if (scale === 0) return;
    if (scale < 1) Cartesian3.multiplyByScalar(panDelta, scale, panDelta);
    Cartesian3.add(anchor, panDelta, anchor);
    flattenAnchorToEllipsoid();
  }

  function screenOf(point: { x: number; y: number }): Cartesian2 {
    scratchScreen.x = point.x;
    scratchScreen.y = point.y;
    return scratchScreen;
  }

  function canvasPoint(event: PointerEvent, into: { x: number; y: number }) {
    const rect = canvas.getBoundingClientRect();
    into.x = event.clientX - rect.left;
    into.y = event.clientY - rect.top;
  }

  function touchPair(): [{ x: number; y: number }, { x: number; y: number }] | null {
    const it = touches.values();
    const a = it.next().value as { x: number; y: number } | undefined;
    const b = it.next().value as { x: number; y: number } | undefined;
    if (!a || !b) return null;
    return [a, b];
  }

  /** Baseline for the next pinch frame. Does not move the camera. */
  function rememberPinch() {
    const pair = touchPair();
    if (!pair) return;
    const [a, b] = pair;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    pinchLast.dist = Math.hypot(dx, dy);
    pinchLast.angle = Math.atan2(dy, dx);
    pinchLast.midY = (a.y + b.y) * 0.5;
    wheelFocus.x = (a.x + b.x) * 0.5;
    wheelFocus.y = pinchLast.midY;
    hasWheelFocus = true;
  }

  function applyPinch() {
    const pair = touchPair();
    if (!pair) return;
    const [a, b] = pair;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const midY = (a.y + b.y) * 0.5;
    wheelFocus.x = (a.x + b.x) * 0.5;
    wheelFocus.y = midY;
    hasWheelFocus = true;

    let prevDist = pinchLast.dist;
    let nextDist = dist;
    if (prevDist > 1 && nextDist > 1) nextDist = prevDist / clampPinchRatio(prevDist / nextDist);
    const prevRange = range;
    const next = poseAfterPinch(
      { heading, pitch, range },
      {
        prevDist,
        nextDist,
        dAngle: pinchTwist(angle - pinchLast.angle),
        dHeight: (midY - pinchLast.midY) * PINCH_HEIGHT_FROM_PIXELS,
      },
    );
    heading = next.heading;
    pitch = next.pitch;
    range = next.range;
    // Zoom toward the fingers. The anchor is not retargeted, so a tilt stays on the same ground point.
    if (range !== prevRange) shiftAnchorForZoom(prevRange, range);
    pinchLast.dist = dist;
    pinchLast.angle = angle;
    pinchLast.midY = midY;
    frame();
    scene.requestRender();
  }

  function finishTouch(event: PointerEvent) {
    touches.delete(event.pointerId);
    if (touches.size === 0) {
      touchGesture = "none";
      pinching = false;
      holdingGround = false;
      mode = "none";
      frame();
      scene.requestRender();
      return;
    }
    if (touches.size === 1) {
      // The finger that remains starts a pan where it already is. The camera does not move.
      touchGesture = "pan";
      pinching = false;
      const only = touches.values().next().value as { x: number; y: number } | undefined;
      if (only) beginPan(screenOf(only));
      return;
    }
    if (touchGesture === "pinch") rememberPinch();
  }

  function onTouchPointerDown(event: PointerEvent) {
    if (event.pointerType !== "touch") return;
    const point = { x: 0, y: 0 };
    canvasPoint(event, point);
    touches.set(event.pointerId, point);
    if (touches.size > 2) return;
    cancelMotion();
    mode = "none";
    if (touches.size === 1) {
      touchGesture = "pan";
      pinching = false;
      beginPan(screenOf(point));
      return;
    }
    touchGesture = "pinch";
    holdingGround = false;
    pinching = true;
    rememberPinch();
  }

  function onTouchPointerMove(event: PointerEvent) {
    if (event.pointerType !== "touch") return;
    const point = touches.get(event.pointerId);
    if (!point) return;
    canvasPoint(event, point);
    if (touchGesture === "pan" && touches.size === 1) {
      panTo(screenOf(point));
      frame();
      scene.requestRender();
      return;
    }
    if (touchGesture === "pinch" && touches.size >= 2) applyPinch();
  }

  function onTouchPointerUp(event: PointerEvent) {
    if (event.pointerType !== "touch") return;
    finishTouch(event);
  }

  function blockBrowserTouch(event: TouchEvent) {
    if (event.cancelable) event.preventDefault();
  }

  canvas.addEventListener("pointerdown", onTouchPointerDown);
  canvas.addEventListener("pointermove", onTouchPointerMove);
  canvas.addEventListener("pointerup", onTouchPointerUp);
  canvas.addEventListener("pointercancel", onTouchPointerUp);
  // touchmove only. preventDefault on touchstart would swallow the tap that selects airspace.
  canvas.addEventListener("touchmove", blockBrowserTouch, { passive: false });

  frame();

  const handler = new ScreenSpaceEventHandler(canvas);
  const last = new Cartesian2();

  handler.setInputAction((event: { position: Cartesian2 }) => {
    if (touches.size > 0) return;
    cancelMotion();
    mode = "pan";
    Cartesian2.clone(event.position, last);
    beginPan(event.position);
  }, ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction((event: { position: Cartesian2 }) => {
    if (touches.size > 0) return;
    cancelMotion();
    mode = "orbit";
    Cartesian2.clone(event.position, last);
  }, ScreenSpaceEventType.RIGHT_DOWN);

  handler.setInputAction(() => {
    if (touches.size > 0) return;
    mode = "none";
    holdingGround = false;
  }, ScreenSpaceEventType.LEFT_UP);
  handler.setInputAction(() => {
    mode = "none";
  }, ScreenSpaceEventType.RIGHT_UP);

  handler.setInputAction((event: { endPosition: Cartesian2 }) => {
    if (touches.size > 0) return;
    Cartesian2.clone(event.endPosition, wheelFocus);
    hasWheelFocus = true;
    if (mode === "none") return;
    const dx = event.endPosition.x - last.x;
    const dy = event.endPosition.y - last.y;
    Cartesian2.clone(event.endPosition, last);
    if (mode === "orbit") {
      heading += dx * 0.004;
      // Drag down tilts steeper; drag up raises toward the horizon.
      pitch = CesiumMath.clamp(pitch - dy * 0.004, MIN_PITCH, MAX_PITCH);
    } else {
      panTo(event.endPosition);
    }
    frame();
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction((delta: number) => {
    queueZoom(typeof delta === "number" ? delta : 0);
  }, ScreenSpaceEventType.WHEEL);

  function flattenAnchorToEllipsoid() {
    Ellipsoid.WGS84.cartesianToCartographic(anchor, carto);
    carto.height = 0;
    Ellipsoid.WGS84.cartographicToCartesian(carto, anchor);
  }

  return {
    getPose() {
      Ellipsoid.WGS84.cartesianToCartographic(anchor, carto);
      return {
        lon: CesiumMath.toDegrees(carto.longitude),
        lat: CesiumMath.toDegrees(carto.latitude),
        range,
        heading,
        pitch,
      };
    },
    flyTo(lon: number, lat: number, nextRange: number) {
      stopZoom();
      const token = ++flyToken;
      const from = Cartesian3.clone(anchor);
      const to = Cartesian3.fromDegrees(lon, lat, 0);
      const fromRange = range;
      const destination = CesiumMath.clamp(nextRange, MIN_RANGE, MAX_RANGE);
      const start = performance.now();
      const duration = 720;
      const step = (now: number) => {
        if (token !== flyToken) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = t * t * (3 - 2 * t);
        Cartesian3.lerp(from, to, eased, anchor);
        Ellipsoid.WGS84.cartesianToCartographic(anchor, carto);
        carto.height = 0;
        Ellipsoid.WGS84.cartographicToCartesian(carto, anchor);
        range = fromRange + (destination - fromRange) * eased;
        frame();
        scene.requestRender();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    setTopDown(on: boolean) {
      if (on) {
        pitchBeforeTopDown = pitch;
        pitch = MIN_PITCH;
      } else if (pitchBeforeTopDown !== null) {
        pitch = pitchBeforeTopDown;
        pitchBeforeTopDown = null;
      }
      frame();
    },
    destroy() {
      flyToken += 1;
      stopZoom();
      canvas.removeEventListener("pointerdown", onTouchPointerDown);
      canvas.removeEventListener("pointermove", onTouchPointerMove);
      canvas.removeEventListener("pointerup", onTouchPointerUp);
      canvas.removeEventListener("pointercancel", onTouchPointerUp);
      canvas.removeEventListener("touchmove", blockBrowserTouch);
      handler.destroy();
      controller.enableInputs = true;
    },
  };
}
