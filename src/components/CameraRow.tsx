import { useState, useEffect, useMemo } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings, OffsetMethod } from '../types';
import { formatMs, formatPs } from '../lib/timing';
import { EVERTZ_FORMATS, calculateEvertzOffset } from '../lib/evertz';

const CELL_W = 56;
const ROW_H  = 44;

interface Props {
  camera: CameraConfig;
  global: GlobalConfig;
  timings: CameraTimings;
  onUpdate: (camera: CameraConfig) => void;
  onDelete: () => void;
}

export default function CameraRow({ camera, global, timings, onUpdate, onDelete }: Props) {
  const [hoverSlice, setHoverSlice] = useState<number | null>(null);
  const [captureRaw, setCaptureRaw] = useState(String(camera.captureSlices));
  const [closeRaw, setCloseRaw] = useState(String(camera.closeSlice));

  useEffect(() => { setCaptureRaw(String(camera.captureSlices)); }, [camera.captureSlices]);
  useEffect(() => { setCloseRaw(String(camera.closeSlice)); }, [camera.closeSlice]);

  function commitCapture(raw: string) {
    const v = parseInt(raw);
    const clamped = isNaN(v) ? camera.captureSlices : Math.max(1, Math.min(global.sliceCount, v));
    setCaptureRaw(String(clamped));
    if (clamped !== camera.captureSlices) onUpdate({ ...camera, captureSlices: clamped });
  }

  function commitClose(raw: string) {
    const v = parseInt(raw);
    const clamped = isNaN(v) ? camera.closeSlice : Math.max(1, Math.min(global.sliceCount, v));
    setCloseRaw(String(clamped));
    if (clamped !== camera.closeSlice) onUpdate({ ...camera, closeSlice: clamped });
  }

  // Preview: which sub-frames would be captured if hoverSlice were the new closeSlice?
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

  // Evertz offset — only computed when method is evertz-genlock
  const evertzResult = useMemo(() => {
    if (camera.offsetMethod !== 'evertz-genlock') return null;
    const fmt = EVERTZ_FORMATS.find((f) => f.id === camera.evertzFormatId) ?? EVERTZ_FORMATS[0];
    return calculateEvertzOffset(timings.sensorOffsetMs, fmt);
  }, [camera.offsetMethod, camera.evertzFormatId, timings.sensorOffsetMs]);

  function isCaptured(s: number) { return capturedSet.has(s); }
  function isPreview(s: number)  { return !capturedSet.has(s) && previewSlices.has(s); }

  function handleCellClick(s: number) {
    onUpdate({ ...camera, closeSlice: s });
  }

  const isWrapped = timings.openSlice > camera.closeSlice;

  return (
    <>
      {/* ── Main camera row ── */}
      <div className="flex min-w-max border-t border-gray-800">
        {/* Header — sticky left column */}
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 flex items-center gap-2 px-3 border-r border-gray-800"
          style={{ width: 220, height: ROW_H }}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: camera.color }} />
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

        {/* Sub-frame cells */}
        {Array.from({ length: global.sliceCount }, (_, i) => {
          const s = i + 1;
          const captured  = isCaptured(s);
          const preview   = isPreview(s);
          const isClose   = s === camera.closeSlice;
          const isOpen    = s === timings.openSlice;
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
              {isOpen && !isClose && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />
              )}
            </div>
          );
        })}

        <div className="flex-shrink-0" style={{ width: 40, height: ROW_H }} />
      </div>

      {/* ── Expanded settings ── */}
      {camera.expanded && (
        <div className="flex min-w-max border-t border-gray-800 bg-gray-900">
          {/* Sticky left column filler */}
          <div className="flex-shrink-0 sticky left-0 z-10 bg-gray-900 border-r border-gray-800" style={{ width: 220 }} />

          <div className="flex flex-wrap items-start gap-5 px-4 py-3">

            {/* ── Identity ── */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Camera</span>
              <span className="text-xs text-gray-300">RED Komodo 6K</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={camera.name}
                onChange={(e) => onUpdate({ ...camera, name: e.target.value })}
                className="w-28 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Color</label>
              <input
                type="color"
                value={camera.color}
                onChange={(e) => onUpdate({ ...camera, color: e.target.value })}
                className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>

            <div className="w-px self-stretch bg-gray-700" />

            {/* ── Timing ── */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Capture Sub-frames</label>
              <input
                type="number"
                min={1}
                max={global.sliceCount}
                value={captureRaw}
                onChange={(e) => {
                  setCaptureRaw(e.target.value);
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onUpdate({ ...camera, captureSlices: Math.max(1, Math.min(global.sliceCount, v)) });
                }}
                onBlur={(e) => commitCapture(e.target.value)}
                className="w-16 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Close Sub-frame</label>
              <input
                type="number"
                min={1}
                max={global.sliceCount}
                value={closeRaw}
                onChange={(e) => {
                  setCloseRaw(e.target.value);
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onUpdate({ ...camera, closeSlice: Math.max(1, Math.min(global.sliceCount, v)) });
                }}
                onBlur={(e) => commitClose(e.target.value)}
                className="w-16 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Shutter Angle</span>
              <span className="text-xs text-gray-200 font-mono">{timings.shutterAngleDeg.toFixed(2)}°</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Open Sub-frame</span>
              <span className="text-xs text-gray-200 font-mono">
                {timings.openSlice}{isWrapped ? ' ↩' : ''}
              </span>
            </div>

            <div className="w-px self-stretch bg-gray-700" />

            {/* ── Offset method selector ── */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">Offset Method</span>
              <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
                {(['red-sensor', 'evertz-genlock'] as OffsetMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => onUpdate({ ...camera, offsetMethod: method })}
                    className={`px-2.5 py-1 transition-colors ${
                      camera.offsetMethod === method
                        ? 'bg-gray-600 text-gray-100'
                        : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {method === 'red-sensor' ? 'RED Sensor' : 'Evertz Genlock'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Evertz format selector (only when Evertz selected) ── */}
            {camera.offsetMethod === 'evertz-genlock' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Genlock Format</label>
                <select
                  value={camera.evertzFormatId}
                  onChange={(e) => onUpdate({ ...camera, evertzFormatId: e.target.value })}
                  className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-500"
                >
                  <optgroup label="1080p">
                    {EVERTZ_FORMATS.filter((f) => f.totalLines === 1125).map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="720p">
                    {EVERTZ_FORMATS.filter((f) => f.totalLines === 750).map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            <div className="w-px self-stretch bg-gray-700" />

            {/* ── Offset output values ── */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Required Offset</span>
              <span className="text-xs text-gray-200 font-mono">{formatMs(timings.sensorOffsetMs)}</span>

              {camera.offsetMethod === 'red-sensor' ? (
                <>
                  <span className="text-xs text-gray-500 font-mono">{formatPs(timings.sensorOffsetPs)}</span>
                  <span className="text-xs text-gray-700 leading-tight">SENSOR_SYNC_OFFSET</span>
                </>
              ) : evertzResult ? (
                <>
                  <span className="text-xs text-gray-400 font-mono">
                    V{evertzResult.vLines} H{evertzResult.hSamples}
                  </span>
                  <span className="text-xs text-gray-700">5601 MSC output delay</span>
                </>
              ) : null}
            </div>

            {camera.offsetMethod === 'red-sensor' && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">RCP2 Angle Value</span>
                <span className="text-xs text-gray-300 font-mono">{timings.shutterAngleRcp2.toLocaleString()}</span>
                <span className="text-xs text-gray-600">deg × 1000</span>
              </div>
            )}

            <div className="w-px self-stretch bg-gray-700" />

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
