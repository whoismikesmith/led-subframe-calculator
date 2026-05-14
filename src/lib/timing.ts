import type { GlobalConfig, CameraConfig, CameraTimings } from '../types';

export const FRAME_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, 120] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

/**
 * Core timing model:
 * - closeSlice is fixed (shutter stop reference, 1-indexed)
 * - Increasing captureSlices adds slices to the LEFT (earlier in time)
 * - Wrap-around is valid: if openSlice < 1 it wraps to the end of the frame
 * - sensorOffset = time when shutter CLOSES = closeSlice * sliceDuration
 *   (the RED camera interprets sync shift as the close time, not open time)
 */
export function calculateTimings(global: GlobalConfig, camera: CameraConfig): CameraTimings {
  const framePeriodMs = 1000 / global.fps;
  const sliceDurationMs = framePeriodMs / global.sliceCount;
  const shutterAngleDeg = (camera.captureSlices / global.sliceCount) * 360;
  const exposureDurationMs = sliceDurationMs * camera.captureSlices;

  // Cyclic open slice: wraps to end of frame when captureSlices > closeSlice
  const openSliceRaw = camera.closeSlice - camera.captureSlices + 1;
  const openSlice = ((openSliceRaw - 1 + global.sliceCount) % global.sliceCount) + 1;
  const shutterOpenMs = (openSlice - 1) * sliceDurationMs;
  const shutterCloseMs = camera.closeSlice * sliceDurationMs;
  const sensorOffsetMs = shutterCloseMs;
  const sensorOffsetNs = sensorOffsetMs * 1_000_000;
  const sensorOffsetPs = Math.round(sensorOffsetMs * 1_000_000_000);

  // RCP2 shutter angle: degrees * 1000 per protocol
  const shutterAngleRcp2 = Math.round(shutterAngleDeg * 1000);

  // Build captured slices using modular arithmetic (wrap-around supported)
  const capturedSlices: number[] = [];
  for (let i = 0; i < camera.captureSlices; i++) {
    capturedSlices.push(((openSlice - 1 + i) % global.sliceCount) + 1);
  }

  const isValid = camera.captureSlices >= 1 && camera.captureSlices <= global.sliceCount;

  return {
    framePeriodMs,
    sliceDurationMs,
    shutterAngleDeg,
    exposureDurationMs,
    openSlice,
    shutterOpenMs,
    sensorOffsetMs,
    sensorOffsetNs,
    sensorOffsetPs,
    shutterAngleRcp2,
    capturedSlices,
    isValid,
  };
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
