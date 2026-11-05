/** Shared with the mouse orbit so a two-finger drag matches a right-button drag. */
export const MIN_PITCH = (-89 * Math.PI) / 180;
export const MAX_PITCH = (-8 * Math.PI) / 180;
export const MIN_RANGE = 80;
export const MAX_RANGE = 4.2e7;

/**
 * Cesium reports the pinch midpoint in quarter-pixels.
 * Mouse tilt is 0.004 rad per pixel, so the touch gain is 0.004 / 0.25.
 */
export const PINCH_TILT_GAIN = 0.016;

export interface OrbitPose {
  heading: number;
  pitch: number;
  range: number;
}

export interface PinchStep {
  /** Previous and current finger separation, in Cesium's quarter-pixel units. */
  prevDist: number;
  nextDist: number;
  /** Change in the angle between the two fingers, radians. */
  dAngle: number;
  /** Change in the vertical midpoint, quarter-pixels. Positive is downward. */
  dHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Cesium's pinch "height" is the vertical midpoint delta, in CSS pixels, times this. */
export const PINCH_HEIGHT_FROM_PIXELS = 0.25;

const PAN_RAY_LIMIT = 6;
const PAN_SHIFT_LIMIT = 0.45;

/**
 * Scale for one pan sample. A ray that skims the ground reports a hit far past
 * the finger and would throw the map, so that sample is dropped. A merely
 * large shift is shortened instead of applied in full.
 */
export function panSampleScale(alongRay: number, shift: number, range: number): number {
  if (!(range > 0) || !Number.isFinite(alongRay) || !Number.isFinite(shift) || shift < 0) return 0;
  if (alongRay > range * PAN_RAY_LIMIT) return 0;
  const cap = range * PAN_SHIFT_LIMIT;
  if (shift <= cap) return 1;
  return cap / shift;
}

/** Per-frame pinch zoom ratio. One bad sample cannot throw the camera. */
export function clampPinchRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(1.18, Math.max(0.85, ratio));
}

/**
 * Twist for one pinch frame. A step near half a turn is the two fingers swapping
 * order in the event, not a real twist, so it is ignored.
 */
export function pinchTwist(delta: number): number {
  let twist = delta;
  if (twist > Math.PI) twist -= Math.PI * 2;
  if (twist < -Math.PI) twist += Math.PI * 2;
  if (Math.abs(twist) > 2.5) return 0;
  return twist;
}

const EARTH_RADIUS_M = 6_378_137;
/** Radians of the frame below the view centre that can still see the ground. */
const GLOBE_HALF_VIEW = 0.42;
const GLOBE_MARGIN = 0.1;

/**
 * Shallow pitch at a long range looks over the horizon into the sky and the
 * map leaves the screen. Pull the view down just enough that the globe stays
 * in frame. A view that is already steep enough is left alone.
 */
export function keepGlobeInView(range: number, pitch: number): number {
  const minDown = -MAX_PITCH;
  const maxDown = -MIN_PITCH;
  let down = clamp(-pitch, minDown, maxDown);
  for (let i = 0; i < 8; i++) {
    const height = Math.max(1, range * Math.sin(down));
    const horizon = Math.acos(Math.min(1, EARTH_RADIUS_M / (EARTH_RADIUS_M + height)));
    const needed = clamp(horizon - GLOBE_HALF_VIEW + GLOBE_MARGIN, minDown, maxDown);
    if (down + 1e-3 >= needed) break;
    down = needed;
  }
  return clamp(-down, MIN_PITCH, MAX_PITCH);
}

function wrapTwist(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

/**
 * Two-finger step: spread zooms in, a downward drag tilts toward overhead,
 * and a twist rotates the heading with the fingers. Zoom and twist are
 * suppressed when the gesture is mostly vertical tilt so the pivot stays put.
 */
export function poseAfterPinch(pose: OrbitPose, step: PinchStep): OrbitPose {
  let range = pose.range;
  let heading = pose.heading;

  const distRatio = step.prevDist > 1 && step.nextDist > 1 ? step.prevDist / step.nextDist : 1;
  const distLog = Math.abs(Math.log(distRatio));
  const tiltRad = Math.abs(step.dHeight) * PINCH_TILT_GAIN;
  const zoomIntent = distLog > 0.03 && distLog > tiltRad * 0.4;
  if (zoomIntent) {
    range = clamp(pose.range * distRatio, MIN_RANGE, MAX_RANGE);
  }

  const twist = wrapTwist(step.dAngle);
  const twistIntent = Math.abs(twist) > 0.003 && Math.abs(twist) > tiltRad * 0.3;
  if (twistIntent) {
    heading = pose.heading - twist;
  }

  const pitch = clamp(pose.pitch - step.dHeight * PINCH_TILT_GAIN, MIN_PITCH, MAX_PITCH);
  return { heading, pitch, range };
}
