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

function wrapTwist(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

/**
 * Two-finger step: spread zooms in, a downward drag tilts toward overhead,
 * and a twist rotates the heading with the fingers.
 */
export function poseAfterPinch(pose: OrbitPose, step: PinchStep): OrbitPose {
  let range = pose.range;
  if (step.prevDist > 1 && step.nextDist > 1) {
    range = clamp(pose.range * (step.prevDist / step.nextDist), MIN_RANGE, MAX_RANGE);
  }
  return {
    heading: pose.heading + wrapTwist(step.dAngle),
    pitch: clamp(pose.pitch - step.dHeight * PINCH_TILT_GAIN, MIN_PITCH, MAX_PITCH),
    range,
  };
}
