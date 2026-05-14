import { useState, useEffect, useMemo } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings, OffsetMethod, ShutterMode } from '../types';
import { formatMs, wholeSliceAngles } from '../lib/timing';
import { EVERTZ_FORMATS, calculateEvertzOffset } from '../lib/evertz';

const CELL_W      = 56;
const ROW_H       = 44;
const LABEL_W     = 220;
const ADD_BTN_W   = 40;
const GHOST_SEP_W = 3;
const GHOST_BG    = '#0c0f18';
const SEP_COLOR   = '#1e2236';
const GHOST_BORD  = '#111520';

// Convert a hex color to a visible grayscale value via luminance
function toGray(hex: string): string {
  if (!hex.startsWith('#') || hex.length !== 7) return '#888888';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  lum = Math.max(95, Math.min(170, lum));
  const h = lum.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

interface Props {
  camera: CameraConfig;
  global: GlobalConfig;
  timings: CameraTimings;
  ghostCount: number;
  onUpdate: (camera: CameraConfig) => void;
  onDelete: () => void;
}

export default function CameraRow({ camera, global, timings, ghostCount, onUpdate, onDelete }: Props) {
  const ghostColor = useMemo(() => toGray(camera.color), [camera.color]);

  const [hoverSlice, setHoverSlice] = useState<number | null>(null);
  const [closeRaw, setCloseRaw] = useState(String(camera.closeSlice));
  const [angleRaw, setAngleRaw] = useState(() => angleToRaw(camera.shutterAngleDeg, camera.shutterMode, global.fps));

  useEffect(() => { setCloseRaw(String(camera.closeSlice)); }, [camera.closeSlice]);
  useEffect(() => {
    setAngleRaw(angleToRaw(camera.shutterAngleDeg, camera.shutterMode, global.fps));
  }, [camera.shutterAngleDeg, camera.shutterMode, global.fps]);

  function angleToRaw(deg: number, mode: ShutterMode, fps: number): string {
    if (mode === 'angle') return String(deg);
    return String(Math.round((360 * fps) / deg));
  }

  function rawToDeg(raw: string): number | null {
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) return null;
    if (camera.shutterMode === 'angle') return Math.max(0.1, Math.min(360, v));
    return Math.max(0.1, Math.min(360, (360 * global.fps) / v));
  }

  function handleAngleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAngleRaw(e.target.value);
    const deg = rawToDeg(e.target.value);
    if (deg !== null) onUpdate({ ...camera, shutterAngleDeg: deg });
  }

  function commitAngle(raw: string) {
    const deg = rawToDeg(raw);
    if (deg === null) {
      setAngleRaw(angleToRaw(camera.shutterAngleDeg, camera.shutterMode, global.fps));
      return;
    }
    setAngleRaw(angleToRaw(deg, camera.shutterMode, global.fps));
    if (Math.abs(deg - camera.shutterAngleDeg) > 1e-6) onUpdate({ ...camera, shutterAngleDeg: deg });
  }

  function handleModeSwitch(mode: ShutterMode) {
    if (mode === camera.shutterMode) return;
    onUpdate({ ...camera, shutterMode: mode });
  }

  function commitClose(raw: string) {
    const v = parseInt(raw);
    const clamped = isNaN(v) ? camera.closeSlice : Math.max(1, Math.min(global.sliceCount, v));
    setCloseRaw(String(clamped));
    if (clamped !== camera.closeSlice) onUpdate({ ...camera, closeSlice: clamped });
  }

  const presets = useMemo(() => wholeSliceAngles(global.sliceCount), [global.sliceCount]);

  // Preview: which sub-frames would be captured if hoverSlice were the new closeSlice?
  const previewSlices = useMemo(() => {
    if (hoverSlice === null) return new Set<number>();
    const n = global.sliceCount;
    const numCapture = Math.max(1, Math.round(timings.captureSlices));
    const rawOpen = hoverSlice - numCapture + 1;
    const openSlice = ((rawOpen - 1 + n) % n) + 1;
    const set = new Set<number>();
    for (let i = 0; i < numCapture; i++) {
      set.add(((openSlice - 1 + i) % n) + 1);
    }
    return set;
  }, [hoverSlice, timings.captureSlices, global.sliceCount]);

  const capturedSet = useMemo(() => new Set(timings.capturedSlices), [timings.capturedSlices]);

  // Ghost cells: sub-frames captured in the adjacent frame periods when shutter wraps
  const leaderGhostSet = useMemo(() => {
    if (!timings.isWrapped) return new Set<number>();
    const set = new Set(timings.capturedSlices.filter(s => s > camera.closeSlice));
    if (timings.partialOpenSlice !== null && timings.partialOpenSlice > camera.closeSlice) {
      set.add(timings.partialOpenSlice);
    }
    return set;
  }, [timings.isWrapped, timings.capturedSlices, timings.partialOpenSlice, camera.closeSlice]);

  const trailerGhostSet = useMemo(() => {
    if (!timings.isWrapped) return new Set<number>();
    const set = new Set(timings.capturedSlices.filter(s => s <= camera.closeSlice));
    if (timings.partialOpenSlice !== null && timings.partialOpenSlice <= camera.closeSlice) {
      set.add(timings.partialOpenSlice);
    }
    return set;
  }, [timings.isWrapped, timings.capturedSlices, timings.partialOpenSlice, camera.closeSlice]);

  // Preview ghost sets: cyclical visualization — show preview wherever the
  // captured SFs land in the visible leader/trailer ranges, independent of wrap.
  const previewLeaderSet = useMemo(() => {
    if (hoverSlice === null) return new Set<number>();
    const minSF = global.sliceCount - ghostCount + 1;
    const set = new Set<number>();
    previewSlices.forEach(s => { if (s >= minSF) set.add(s); });
    return set;
  }, [hoverSlice, previewSlices, ghostCount, global.sliceCount]);

  const previewTrailerSet = useMemo(() => {
    if (hoverSlice === null) return new Set<number>();
    const set = new Set<number>();
    previewSlices.forEach(s => { if (s <= ghostCount) set.add(s); });
    return set;
  }, [hoverSlice, previewSlices, ghostCount]);

  const evertzResult = useMemo(() => {
    if (camera.offsetMethod !== 'evertz-genlock') return null;
    const fmt = EVERTZ_FORMATS.find((f) => f.id === global.evertzFormatId) ?? EVERTZ_FORMATS[0];
    return calculateEvertzOffset(timings.sensorOffsetMs, fmt);
  }, [camera.offsetMethod, global.evertzFormatId, timings.sensorOffsetMs]);

  function handleCellClick(s: number) {
    onUpdate({ ...camera, closeSlice: s });
  }

  const captureStr = Number.isInteger(timings.captureSlices)
    ? String(Math.round(timings.captureSlices))
    : timings.captureSlices.toFixed(2);

  return (
    <>
      {/* ── Main camera row ── */}
      <div className="flex border-t border-gray-800" style={{ minWidth: '100%' }}>
        {/* Header — sticky left column */}
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 flex items-center gap-2 px-3 border-r border-gray-800"
          style={{ width: LABEL_W, height: ROW_H }}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: camera.color }} />
          <span className="text-xs text-gray-300 flex-1 truncate">{camera.name}</span>
          <span className="text-xs text-gray-600 flex-shrink-0">
            {captureStr}sf · {camera.shutterAngleDeg.toFixed(1)}°          </span>
          <button
            onClick={() => onUpdate({ ...camera, expanded: !camera.expanded })}
            className="text-gray-600 hover:text-gray-300 text-xs flex-shrink-0 px-1"
            title="Settings"
          >
            {camera.expanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Centering spacer (left) */}
        <div style={{ flexGrow: 1, height: ROW_H, backgroundColor: GHOST_BG }} />

        {/* Leader ghost cells (last N of previous frame) */}
        {Array.from({ length: ghostCount }, (_, i) => {
          const s = global.sliceCount - ghostCount + i + 1;
          const captured = leaderGhostSet.has(s);
          const isPreview = !captured && previewLeaderSet.has(s);
          const isClose = s === camera.closeSlice;
          const isHoverClose = s === hoverSlice;

          let bg: string = GHOST_BG;
          if (captured) bg = ghostColor;
          else if (isPreview) bg = ghostColor + '66';

          return (
            <div
              key={`l${s}`}
              className="flex-shrink-0 cursor-pointer transition-colors"
              style={{
                width: CELL_W,
                height: ROW_H,
                backgroundColor: bg,
                borderLeft: `1px solid ${GHOST_BORD}`,
                borderTop: isClose
                  ? '2px solid rgba(255,255,255,0.8)'
                  : isHoverClose && !captured
                  ? '2px solid rgba(255,255,255,0.3)'
                  : '2px solid transparent',
              }}
              onMouseEnter={() => setHoverSlice(s)}
              onMouseLeave={() => setHoverSlice(null)}
              onClick={() => handleCellClick(s)}
            />
          );
        })}
        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: ROW_H, backgroundColor: SEP_COLOR }} />

        {/* ── Current frame cells ── */}
        {Array.from({ length: global.sliceCount }, (_, i) => {
          const s = i + 1;
          const captured   = capturedSet.has(s);
          const isPartial  = !captured && s === timings.partialOpenSlice;
          const preview    = !captured && !isPartial && previewSlices.has(s);
          const isClose    = s === camera.closeSlice;
          const isOpen     = s === timings.openSlice;
          const isHoverClose = s === hoverSlice;

          let bg: string = '#1c1f2e';
          if (captured) {
            bg = camera.color;
          } else if (isPartial) {
            const pct = timings.partialOpenFraction * 100;
            bg = `linear-gradient(to right, #1c1f2e ${100 - pct}%, ${camera.color}88 ${100 - pct}%)`;
          } else if (preview) {
            bg = camera.color + '55';
          }

          return (
            <div
              key={s}
              className="flex-shrink-0 cursor-pointer relative transition-colors"
              style={{
                width: CELL_W,
                height: ROW_H,
                background: bg,
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

        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: ROW_H, backgroundColor: SEP_COLOR }} />
        {/* Trailer ghost cells (first N of next frame) */}
        {Array.from({ length: ghostCount }, (_, i) => {
          const s = i + 1;
          const captured = trailerGhostSet.has(s);
          const isPreview = !captured && previewTrailerSet.has(s);
          const isClose = s === camera.closeSlice;
          const isHoverClose = s === hoverSlice;

          let bg: string = GHOST_BG;
          if (captured) bg = ghostColor;
          else if (isPreview) bg = ghostColor + '66';

          return (
            <div
              key={`t${s}`}
              className="flex-shrink-0 cursor-pointer transition-colors"
              style={{
                width: CELL_W,
                height: ROW_H,
                backgroundColor: bg,
                borderLeft: `1px solid ${GHOST_BORD}`,
                borderTop: isClose
                  ? '2px solid rgba(255,255,255,0.8)'
                  : isHoverClose && !captured
                  ? '2px solid rgba(255,255,255,0.3)'
                  : '2px solid transparent',
              }}
              onMouseEnter={() => setHoverSlice(s)}
              onMouseLeave={() => setHoverSlice(null)}
              onClick={() => handleCellClick(s)}
            />
          );
        })}

        {/* Centering spacer (right) */}
        <div style={{ flexGrow: 1, height: ROW_H, backgroundColor: GHOST_BG }} />
        <div className="flex-shrink-0 sticky right-0 z-10 bg-gray-950" style={{ width: ADD_BTN_W, height: ROW_H }} />
      </div>

      {/* ── Expanded settings ── */}
      {camera.expanded && (
        <div className="flex border-t border-gray-800 bg-gray-900" style={{ minWidth: '100%' }}>
          {/* Sticky left column filler */}
          <div className="flex-shrink-0 sticky left-0 z-10 bg-gray-900 border-r border-gray-800" style={{ width: LABEL_W }} />

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

            {/* ── Shutter input ── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-gray-500">Shutter Mode</label>
                <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
                  {(['angle', 'speed'] as ShutterMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModeSwitch(m)}
                      className={`px-2.5 py-0.5 transition-colors ${
                        camera.shutterMode === m
                          ? 'bg-gray-600 text-gray-100'
                          : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {m === 'angle' ? 'Angle' : 'Speed'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {camera.shutterMode === 'speed' && (
                  <span className="text-xs text-gray-500">1/</span>
                )}
                <input
                  type="number"
                  min={camera.shutterMode === 'angle' ? 0.1 : 1}
                  max={camera.shutterMode === 'angle' ? 360 : undefined}
                  value={angleRaw}
                  onChange={handleAngleChange}
                  onBlur={(e) => commitAngle(e.target.value)}
                  className="w-20 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
                />
                {camera.shutterMode === 'angle' && (
                  <span className="text-xs text-gray-500">°</span>
                )}
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onUpdate({ ...camera, shutterAngleDeg: parseFloat(e.target.value) });
                  }}
                  className="bg-gray-800 border border-gray-700 text-xs text-gray-500 rounded px-1 py-1 focus:outline-none focus:border-gray-500"
                >
                  <option value="">preset</option>
                  {presets.map((a) => {
                    const sf = Math.round((a / 360) * global.sliceCount);
                    return (
                      <option key={a} value={a}>
                        {a % 1 === 0 ? a.toFixed(0) : a.toFixed(2)}° · {sf}sf
                      </option>
                    );
                  })}
                </select>
              </div>
              {timings.partialOpenSlice !== null && (
                <div className="text-amber-400 text-xs bg-amber-950/30 border border-amber-900/50 rounded px-2 py-1">
                  Partial: SF{timings.partialOpenSlice} ({(timings.partialOpenFraction * 100).toFixed(1)}% captured)
                </div>
              )}
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
              <span className="text-xs text-gray-500">Capture Sub-frames</span>
              <span className="text-xs text-gray-200 font-mono">{captureStr}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Open Sub-frame</span>
              <span className="text-xs text-gray-200 font-mono">
                {timings.openSlice}              </span>
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

            <div className="w-px self-stretch bg-gray-700" />

            <div className="w-px self-stretch bg-gray-700" />

            <button
              onClick={() => { if (window.confirm(`Delete "${camera.name}"?`)) onDelete(); }}
              className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 px-2 py-1 rounded transition-colors self-center"
            >
              Delete
            </button>

            <div className="w-px self-stretch bg-gray-700" />

            {/* ── Offset output values ── */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Required Offset</span>
              <span className="text-xs text-gray-200 font-mono">{formatMs(timings.sensorOffsetMs)}</span>

              {camera.offsetMethod === 'red-sensor' ? (
                <span className="text-xs text-gray-400 font-mono">
                  Sync Shift: {Math.round(timings.sensorOffsetPs / 13468).toLocaleString()}
                </span>
              ) : evertzResult ? (
                <>
                  <span className="text-xs text-gray-400 font-mono">
                    V{evertzResult.vLines} H{evertzResult.hSamples}
                  </span>
                  <span className="text-xs text-gray-700">5601 MSC output delay</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
