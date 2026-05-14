import { useState, useEffect, useMemo } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings } from '../types';
import { sliceStartMs, FRAME_RATES } from '../lib/timing';
import { EVERTZ_FORMATS, calculateEvertzOffset } from '../lib/evertz';
import type { EvertzOffsetResult } from '../lib/evertz';

type DisplayUnit = 'ms' | 'us' | 'ns';

interface Props {
  global: GlobalConfig;
  cameras: CameraConfig[];
  timingsMap: Record<string, CameraTimings>;
  onGlobalChange: (cfg: GlobalConfig) => void;
}

function SidebarSection({
  title,
  colorDot,
  defaultOpen = true,
  children,
}: {
  title: string;
  colorDot?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide text-gray-400 hover:text-gray-200 transition-colors"
      >
        {colorDot && (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorDot }} />
        )}
        <span className="flex-1 text-left">{title}</span>
        <span className="text-gray-700 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  );
}

export default function TimingPanel({ global, cameras, timingsMap, onGlobalChange }: Props) {
  const [unit, setUnit] = useState<DisplayUnit>(
    () => (localStorage.getItem('ghostframe-rcp2-unit') as DisplayUnit | null) ?? 'ms'
  );
  const [sliceRaw, setSliceRaw] = useState(String(global.sliceCount));

  useEffect(() => { setSliceRaw(String(global.sliceCount)); }, [global.sliceCount]);

  function handleUnitChange(u: DisplayUnit) {
    setUnit(u);
    try { localStorage.setItem('ghostframe-rcp2-unit', u); } catch {}
  }

  function commitSlice(raw: string) {
    const v = parseInt(raw);
    const clamped = isNaN(v) ? global.sliceCount : Math.max(1, Math.min(64, v));
    setSliceRaw(String(clamped));
    if (clamped !== global.sliceCount) onGlobalChange({ ...global, sliceCount: clamped });
  }

  const framePeriodMs = 1000 / global.fps;
  const sliceDurationMs = framePeriodMs / global.sliceCount;

  const evertzResultsMap = useMemo(() => {
    const map: Record<string, EvertzOffsetResult | null> = {};
    const fmt = EVERTZ_FORMATS.find((f) => f.id === global.evertzFormatId) ?? EVERTZ_FORMATS[0];
    for (const cam of cameras) {
      if (cam.offsetMethod !== 'evertz-genlock') { map[cam.id] = null; continue; }
      map[cam.id] = calculateEvertzOffset(timingsMap[cam.id].sensorOffsetMs, fmt);
    }
    return map;
  }, [cameras, timingsMap, global.evertzFormatId]);

  function formatValue(ms: number): string {
    switch (unit) {
      case 'ms': return `${ms.toFixed(3)}ms`;
      case 'us': return `${(ms * 1000).toFixed(0)}µs`;
      case 'ns': return `${(ms * 1_000_000).toFixed(0)}ns`;
    }
  }

  return (
    <div className="flex flex-col bg-gray-950 border-l border-gray-800 overflow-y-auto" style={{ width: 264 }}>

      {/* ── LED Processor ── */}
      <SidebarSection title="LED Processor">
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Frame Rate</span>
            <select
              value={global.fps}
              onChange={(e) => onGlobalChange({ ...global, fps: parseFloat(e.target.value) })}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
            >
              {FRAME_RATES.map((fps) => (
                <option key={fps} value={fps}>{fps} fps</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Sub-frames</span>
            <input
              type="number"
              min={1}
              max={64}
              value={sliceRaw}
              onChange={(e) => {
                setSliceRaw(e.target.value);
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onGlobalChange({ ...global, sliceCount: Math.max(1, Math.min(64, v)) });
              }}
              onBlur={(e) => commitSlice(e.target.value)}
              className="w-16 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-700 pt-0.5">
            <span>{sliceDurationMs.toFixed(3)}ms / SF</span>
            <span>{framePeriodMs.toFixed(3)}ms / frame</span>
          </div>
        </div>
      </SidebarSection>

      {/* ── Genlock ── */}
      <SidebarSection title="Genlock">
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Format</span>
            <select
              value={global.evertzFormatId}
              onChange={(e) => onGlobalChange({ ...global, evertzFormatId: e.target.value })}
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
        </div>
      </SidebarSection>

      {/* ── Sub-frame Timings ── */}
      <SidebarSection title="Sub-frame Timings">
        <div className="px-4 pb-3">
          <div className="flex justify-end mb-2">
            <select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value as DisplayUnit)}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded px-1 py-0.5 focus:outline-none"
            >
              <option value="ms">ms</option>
              <option value="us">µs</option>
              <option value="ns">ns</option>
            </select>
          </div>
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
              <span className="text-gray-200 font-mono">{formatValue(framePeriodMs)}</span>
            </div>
          </div>
        </div>
      </SidebarSection>

      {/* ── Per-camera sections ── */}
      {cameras.map((cam) => {
        const t = timingsMap[cam.id];
        const evertz = evertzResultsMap[cam.id];
        const fmt = cam.offsetMethod === 'evertz-genlock'
          ? (EVERTZ_FORMATS.find((f) => f.id === global.evertzFormatId) ?? EVERTZ_FORMATS[0])
          : null;

        const captureStr = Number.isInteger(t.captureSlices)
          ? String(Math.round(t.captureSlices))
          : t.captureSlices.toFixed(2);

        const sliceRange = t.isWrapped
          ? `${t.openSlice}→${global.sliceCount}, 1→${cam.closeSlice}`
          : `${t.openSlice}→${cam.closeSlice}`;

        return (
          <SidebarSection key={cam.id} title={cam.name} colorDot={cam.color}>
            <div className="px-4 pb-3 space-y-1 text-xs">
              <Row label="Sub-frames" value={`${captureStr} (${sliceRange})`} />
              {t.partialOpenSlice !== null && (
                <Row label="Partial SF" value={`SF${t.partialOpenSlice} · ${(t.partialOpenFraction * 100).toFixed(1)}%`} />
              )}
              <Row label="Shutter" value={`${t.shutterAngleDeg.toFixed(2)}°`} />
              <Row label="Exposure" value={`${t.exposureDurationMs.toFixed(3)}ms`} />

              <div className="border-t border-gray-800 pt-1 mt-1" />

              <Row label="Required Offset" value={formatValue(t.sensorOffsetMs)} highlight />

              {cam.offsetMethod === 'red-sensor' ? (() => {
                const syncShift = Math.round(t.sensorOffsetPs / 13468);
                const syncShiftTimeUs = syncShift * 0.013468;
                return (
                  <>
                    <Row label="Sync Shift" value={syncShift.toLocaleString()} highlight bold />
                    <Row label="Sync Shift Time" value={`${syncShiftTimeUs.toFixed(4)}µs`} />
                    <Row label="Time Unit" value="0.013468µs" />
                    <div className="border-t border-gray-800 pt-1 mt-1" />
                    <div>
                      <span className="text-gray-600 block mb-0.5">RCP2 Angle</span>
                      <span className="font-mono text-gray-400">{t.shutterAngleRcp2.toLocaleString()}</span>
                      <span className="text-gray-700 ml-1">× 1000</span>
                    </div>
                  </>
                );
              })() : evertz && fmt ? (
                <>
                  <div className="border-t border-gray-800 pt-1 mt-1" />
                  <div className="mb-1">
                    <span className="text-gray-500 block">{fmt.name}</span>
                  </div>
                  <Row label="V (lines)" value={String(evertz.vLines)} />
                  <Row label="H (samples)" value={String(evertz.hSamples)} />
                  <Row label="Fine" value="0.0%" />
                  <div className="border-t border-gray-800 pt-1 mt-1" />
                  <Row label="Pixel period" value={`${evertz.pixelPeriodNs.toFixed(3)}ns`} />
                  <Row label="H-line period" value={`${evertz.linePeriodUs.toFixed(3)}µs`} />
                  <div className="border-t border-gray-800 pt-1 mt-1" />
                  <Row label="Actual offset" value={`${evertz.actualOffsetMs.toFixed(4)}ms`} />
                  <Row
                    label="Rounding error"
                    value={`${evertz.roundingErrorNs.toFixed(2)}ns`}
                    dim={Math.abs(evertz.roundingErrorNs) > 10}
                  />
                </>
              ) : null}

              {t.isWrapped && (
                <div className="text-amber-400 text-xs mt-1 bg-amber-950/30 border border-amber-900/50 rounded px-2 py-1">
                  ↩ Wraps: opens at sub-frame {t.openSlice}
                </div>
              )}
            </div>
          </SidebarSection>
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
  bold = false,
}: {
  label: string;
  value: string;
  dim?: boolean;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-600 flex-shrink-0">{label}</span>
      <span className={`font-mono tabular-nums ${bold ? 'font-bold' : ''} ${dim ? 'text-red-400' : highlight ? 'text-gray-100' : 'text-gray-400'}`}>
        {value}
      </span>
    </div>
  );
}
