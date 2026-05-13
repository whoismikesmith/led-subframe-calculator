import { useState } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings } from '../types';
import { sliceStartMs, formatPs } from '../lib/timing';

type DisplayUnit = 'ms' | 'us' | 'ns';

interface Props {
  global: GlobalConfig;
  cameras: CameraConfig[];
  timingsMap: Record<string, CameraTimings>;
}

export default function TimingPanel({ global, cameras, timingsMap }: Props) {
  const [unit, setUnit] = useState<DisplayUnit>('ms');

  const sliceDurationMs = (1000 / global.fps) / global.sliceCount;

  function formatValue(ms: number): string {
    switch (unit) {
      case 'ms': return `${ms.toFixed(3)}ms`;
      case 'us': return `${(ms * 1000).toFixed(0)}µs`;
      case 'ns': return `${(ms * 1_000_000).toFixed(0)}ns`;
    }
  }

  return (
    <div className="flex flex-col bg-gray-950 border-l border-gray-800 overflow-y-auto" style={{ width: 240 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 tracking-wide">Sub-frame Timings</span>

        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as DisplayUnit)}
          className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded px-1 py-0.5 focus:outline-none"
        >
          <option value="ms">ms</option>
          <option value="us">µs</option>
          <option value="ns">ns</option>
        </select>
      </div>

      {/* Slice start times */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="space-y-0.5">
          {Array.from({ length: global.sliceCount }, (_, i) => (
            <div key={i} className="flex justify-between items-center text-xs py-0.5">
              <span className="text-gray-600">SF {i + 1}</span>
              <span className="text-gray-300 font-mono tabular-nums">
                {formatValue(sliceStartMs(i + 1, sliceDurationMs))}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center text-xs py-0.5 border-t border-gray-800 mt-1 pt-1.5">
            <span className="text-gray-500">Total</span>
            <span className="text-gray-200 font-mono">{formatValue(1000 / global.fps)}</span>
          </div>
        </div>
      </div>

      {/* Per-camera results */}
      {cameras.map((cam) => {
        const t = timingsMap[cam.id];
        return (
          <div key={cam.id} className="px-4 py-3 border-b border-gray-800">
            {/* Camera label */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cam.color }} />
              <span className="text-xs text-gray-300 font-medium truncate">{cam.name}</span>
            </div>

            <div className="space-y-1 text-xs">
              <Row
                label="Sub-frames"
                value={
                  t.openSlice > cam.closeSlice
                    ? `${cam.captureSlices} (${t.openSlice}→${global.sliceCount}, 1→${cam.closeSlice})`
                    : `${cam.captureSlices} (${t.openSlice}→${cam.closeSlice})`
                }
              />
              <Row label="Shutter" value={`${t.shutterAngleDeg.toFixed(2)}°`} />
              <Row label="Exposure" value={`${t.exposureDurationMs.toFixed(3)}ms`} />

              <div className="border-t border-gray-800 pt-1 mt-1" />

              <Row label="Sensor Offset" value={formatValue(t.sensorOffsetMs)} highlight />
              <div className="pl-0">
                <span className="text-gray-600">Picoseconds</span>
                <div className="font-mono text-gray-300 mt-0.5 break-all">
                  {formatPs(t.sensorOffsetPs)}
                </div>
              </div>

              <div className="border-t border-gray-800 pt-1 mt-1" />

              <div>
                <span className="text-gray-600 block mb-0.5">RCP2 Angle Value</span>
                <span className="font-mono text-gray-400">{t.shutterAngleRcp2.toLocaleString()}</span>
              </div>

              <div>
                <span className="text-gray-600 block">RCP2 Param (set)</span>
                <span className="font-mono text-gray-600 text-xs break-all leading-tight">
                  SENSOR_SYNC_OFFSET_PIXELS
                </span>
              </div>

              {t.openSlice > cam.closeSlice && (
                <div className="text-amber-400 text-xs mt-1 bg-amber-950/30 border border-amber-900/50 rounded px-2 py-1">
                  ↩ Wraps: opens at sub-frame {t.openSlice}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {cameras.length === 0 && (
        <div className="px-4 py-6 text-xs text-gray-600 text-center">
          Add a camera to see results
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  dim = false,
  highlight = false,
}: {
  label: string;
  value: string;
  dim?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-600 flex-shrink-0">{label}</span>
      <span className={`font-mono tabular-nums ${dim ? 'text-red-400' : highlight ? 'text-gray-100' : 'text-gray-400'}`}>
        {value}
      </span>
    </div>
  );
}
