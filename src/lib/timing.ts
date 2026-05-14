import type { GlobalConfig, CameraConfig, CameraTimings } from '../types';

export const FRAME_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, 120] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

/**
 * Core timing model:
 * - shutterAngleDeg drives exposure duration (may produce fractional captureSlices)
 * - closeSlice is fixed (shutter stop reference, 1-indexed)
 * - Wrap-around is valid: shutterOpenMs < 0 means shutter opens in previous frame
 * - sensorOffset = time when shutter CLOSES = closeSlice * sliceDuration
 *   (RED Komodo interprets sync shift as close time, not open time)
 */
export function calculateTimings(global: GlobalConfig, camera: CameraConfig): CameraTimings {
  const framePeriodMs = 1000 / global.fps;
  const sliceDurationMs = framePeriodMs / global.sliceCount;
  const captureSlices = (camera.shutterAngleDeg / 360) * global.sliceCount;
  const exposureDurationMs = (camera.shutterAngleDeg / 360) * framePeriodMs;

  const shutterCloseMs = camera.closeSlice * sliceDurationMs;
  const shutterOpenMs = shutterCloseMs - exposureDurationMs;
  const isWrapped = shutterOpenMs < -1e-9;

  const n = global.sliceCount;

  // Fractional open position (0-indexed from frame start), wrapped to [0, n)
  const openPosRaw = shutterOpenMs / sliceDurationMs;
  const openPosWrapped = ((openPosRaw % n) + n) % n;

  const EPS = 1e-6;
  const captureSlicesFrac = captureSlices - Math.floor(captureSlices);
  const hasPartial = captureSlicesFrac > EPS && captureSlicesFrac < 1 - EPS;

  let partialOpenSlice: number | null = null;
  let partialOpenFraction = 0;
  let openSlice: number;

  if (hasPartial) {
    const floorPos = Math.floor(openPosWrapped + EPS);
    partialOpenSlice = floorPos + 1;                   // 1-indexed, partially captured
    partialOpenFraction = captureSlicesFrac;           // fraction of that slice IS captured (right portion)
    openSlice = (partialOpenSlice % n) + 1;            // first fully captured, 1-indexed
  } else {
    const roundedPos = Math.round(openPosWrapped) % n;
    openSlice = roundedPos + 1;
  }

  const numFullSlices = hasPartial ? Math.floor(captureSlices) : Math.round(captureSlices);
  const capturedSlices: number[] = [];
  for (let i = 0; i < numFullSlices; i++) {
    capturedSlices.push(((openSlice - 1 + i) % n) + 1);
  }

  const sensorOffsetMs = shutterCloseMs;
  const sensorOffsetNs = sensorOffsetMs * 1_000_000;
  const sensorOffsetPs = Math.round(sensorOffsetMs * 1_000_000_000);
  const shutterAngleRcp2 = Math.round(camera.shutterAngleDeg * 1000);
  const isValid = camera.shutterAngleDeg > 0 && camera.shutterAngleDeg <= 360;

  return {
    framePeriodMs,
    sliceDurationMs,
    captureSlices,
    shutterAngleDeg: camera.shutterAngleDeg,
    exposureDurationMs,
    openSlice,
    shutterOpenMs,
    isWrapped,
    partialOpenSlice,
    partialOpenFraction,
    sensorOffsetMs,
    sensorOffsetNs,
    sensorOffsetPs,
    shutterAngleRcp2,
    capturedSlices,
    isValid,
  };
}

/** Returns the shutter angles (degrees) that produce whole-number sub-frame counts. */
export function wholeSliceAngles(sliceCount: number): number[] {
  return Array.from({ length: sliceCount }, (_, i) => ((i + 1) / sliceCount) * 360);
}

export function formatMs(ms: number, decimals = 3): string {
  return `${ms.toFixed(decimals)}ms`;
}

export function formatPs(ps: number): string {
  return `${ps.toLocaleString()} ps`;
}

export function sliceStartMs(sliceNum: number, sliceDurationMs: number): number {
  return (sliceNum - 1) * sliceDurationMs;
}
