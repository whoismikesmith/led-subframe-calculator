export type CameraType = 'komodo';
export type OffsetMethod = 'red-sensor' | 'evertz-genlock';
export type ShutterMode = 'angle' | 'speed';

export interface CameraConfig {
  id: string;
  name: string;
  color: string;
  type: CameraType;
  shutterAngleDeg: number;
  shutterMode: ShutterMode;
  closeSlice: number;
  expanded: boolean;
  offsetMethod: OffsetMethod;  // how this camera expresses its offset from genlock
}

export interface GlobalConfig {
  fps: number;
  sliceCount: number;
  evertzFormatId: string;  // genlock reference signal format (shared by all cameras)
}

export interface CameraTimings {
  framePeriodMs: number;
  sliceDurationMs: number;
  captureSlices: number;
  shutterAngleDeg: number;
  exposureDurationMs: number;
  openSlice: number;
  shutterOpenMs: number;
  isWrapped: boolean;
  partialOpenSlice: number | null;
  partialOpenFraction: number;
  sensorOffsetMs: number;
  sensorOffsetNs: number;
  sensorOffsetPs: number;
  shutterAngleRcp2: number;
  capturedSlices: number[];
  isValid: boolean;
}
