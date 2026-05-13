export type CameraType = 'komodo';

export interface CameraConfig {
  id: string;
  name: string;
  color: string;
  type: CameraType;
  captureSlices: number; // how many slices this camera captures (drives shutter angle)
  closeSlice: number;    // 1-indexed: the last (rightmost) slice the shutter covers
  expanded: boolean;
}

export interface GlobalConfig {
  fps: number;
  sliceCount: number;
}

export interface CameraTimings {
  framePeriodMs: number;
  sliceDurationMs: number;
  shutterAngleDeg: number;
  exposureDurationMs: number;
  openSlice: number;          // 1-indexed (may be < 1 if invalid)
  shutterOpenMs: number;
  sensorOffsetMs: number;
  sensorOffsetNs: number;
  sensorOffsetPs: number;
  shutterAngleRcp2: number;   // degrees * 1000 for RCP2 set
  capturedSlices: number[];   // 1-indexed list of captured slices
  isValid: boolean;
}
