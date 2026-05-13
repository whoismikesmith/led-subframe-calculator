import { useState, useMemo } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings } from '../types';
import { formatMs, formatPs } from '../lib/timing';

const CELL_W = 56;
const ROW_H = 44;

interface Props {
  camera: CameraConfig;
  global: GlobalConfig;
  timings: CameraTimings;
  onUpdate: (camera: CameraConfig) => void;
  onDelete: () => void;
}

export default function CameraRow({ camera, global, timings, onUpdate, onDelete }: Props) {
  const [hoverSlice, setHoverSlice] = useState<number | null>(null);

  // Build the set of slices that would be captured if hoverSlice became the closeSlice
  const previewSlices = useMemo(() => {
    if (hoverSlice === null) return new Set<number>();
    const n = global.sliceCount;
    const rawOpen = hoverSlice - camera.captureSlices + 1;
    const openSlice = ((rawOpen - 1 + n) % n) + 1;
    const set = new Set<number>();
    for (let i = 0; i < camera.captureSlices; i++) {
      set.add(((openSlice - 1 + i) % n) + 1);
    }
    return set;
  }, [hoverSlice, camera.captureSlices, global.sliceCount]);

  const capturedSet = useMemo(
    () => new Set(timings.capturedSlices),
    [timings.capturedSlices]
  );

  function isCaptured(s: number) { return capturedSet.has(s); }
  function isPreview(s: number) { return !capturedSet.has(s) && previewSlices.has(s); }

  // Any slice is a valid close slice — wrap-around handles the rest
  function handleCellClick(s: number) {
    onUpdate({ ...camera, closeSlice: s });
  }

  const isWrapped = timings.openSlice > camera.closeSlice;

  return (
    <>
      {/* Main camera row */}
      <div className="flex min-w-max border-t border-gray-800 group">
        {/* Header — sticky left column */}
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 flex items-center gap-2 px-3 border-r border-gray-800"
          style={{ width: 220, height: ROW_H }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: camera.color }}
          />
          <span className="text-xs text-gray-300 flex-1 truncate">{camera.name}</span>
          <span className="text-xs text-gray-600 flex-shrink-0">
            {camera.captureSlices}sf · {timings.shutterAngleDeg.toFixed(1)}°{isWrapped ? ' ↩' : ''}
          </span>
          <button
            onClick={() => onUpdate({ ...camera, expanded: !camera.expanded })}
            className="text-gray-600 hover:text-gray-300 text-xs flex-shrink-0 px-1"
            title="Settings"
          >
            {camera.expanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Slice cells */}
        {Array.from({ length: global.sliceCount }, (_, i) => {
          const s = i + 1;
          const captured = isCaptured(s);
          const preview = isPreview(s);
          const isClose = s === camera.closeSlice;
          const isOpen = s === timings.openSlice;
          const isHoverClose = s === hoverSlice;

          let bg = '#1c1f2e';
          if (captured) bg = camera.color;
          else if (preview) bg = camera.color + '55';

          return (
            <div
              key={s}
              className="flex-shrink-0 cursor-pointer relative transition-colors"
              style={{
                width: CELL_W,
                height: ROW_H,
                backgroundColor: bg,
                borderLeft: '1px solid #1a1d2e',
                borderTop: isClose
                  ? '2px solid rgba(255,255,255,0.8)'
                  : isHoverClose && !captured
                  ? '2px solid rgba(255,255,255,0.3)'
                  : '2px solid transparent',
              }}
              onMouseEnter={() => setHoverSlice(s)}
              onMouseLeave={() => setHoverSlice(null)}
              onClick={() => handleCellClick(s)}
            >
              {/* Open slice marker */}
              {isOpen && !isClose && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
                />
              )}
            </div>
          );
        })}

        {/* Spacer to align with add-column button */}
        <div className="flex-shrink-0" style={{ width: 40, height: ROW_H }} />
      </div>

      {/* Expanded settings */}
      {camera.expanded && (
        <div className="flex min-w-max border-t border-gray-800 bg-gray-900">
          {/* Sticky left column */}
          <div
            className="flex-shrink-0 sticky left-0 z-10 bg-gray-900 border-r border-gray-800"
            style={{ width: 220 }}
          />

          {/* Settings content */}
          <div className="flex flex-wrap items-end gap-5 px-4 py-3">
            {/* Camera type */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Camera</span>
              <span className="text-xs text-gray-300">RED Komodo 6K</span>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={camera.name}
                onChange={(e) => onUpdate({ ...camera, name: e.target.value })}
                className="w-28 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-500"
              />
            </div>

            {/* Color */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Color</label>
              <input
                type="color"
                value={camera.color}
                onChange={(e) => onUpdate({ ...camera, color: e.target.value })}
                className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>

            <div className="w-px h-8 bg-gray-700 self-center" />

            {/* Capture sub-frames */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Capture Sub-frames</label>
              <input
                type="number"
                min={1}
                max={global.sliceCount}
                value={camera.captureSlices}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(global.sliceCount, parseInt(e.target.value) || 1));
                  onUpdate({ ...camera, captureSlices: v });
                }}
                className="w-16 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
              />
            </div>

            {/* Close sub-frame (click on grid or type) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Close Sub-frame</label>
              <input
                type="number"
                min={1}
                max={global.sliceCount}
                value={camera.closeSlice}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(global.sliceCount, parseInt(e.target.value) || 1));
                  onUpdate({ ...camera, closeSlice: v });
                }}
                className="w-16 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
              />
            </div>

            {/* Derived: shutter angle */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Shutter Angle</span>
              <span className="text-xs text-gray-200 font-mono">{timings.shutterAngleDeg.toFixed(2)}°</span>
            </div>

            {/* Derived: open sub-frame */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Open Sub-frame</span>
              <span className="text-xs font-mono text-gray-200">
                {timings.openSlice}{isWrapped ? ' ↩' : ''}
              </span>
            </div>

            <div className="w-px h-8 bg-gray-700 self-center" />

            {/* Offset outputs */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Sensor Offset</span>
              <span className="text-xs text-gray-200 font-mono">{formatMs(timings.sensorOffsetMs)}</span>
              <span className="text-xs text-gray-400 font-mono">{formatPs(timings.sensorOffsetPs)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">RCP2 Angle Value</span>
              <span className="text-xs text-gray-300 font-mono">{timings.shutterAngleRcp2.toLocaleString()}</span>
              <span className="text-xs text-gray-600">(deg × 1000)</span>
            </div>

            <div className="w-px h-8 bg-gray-700 self-center" />

            <button
              onClick={onDelete}
              className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 px-2 py-1 rounded transition-colors self-center"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
